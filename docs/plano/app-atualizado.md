# Frente A — App de desktop sempre atualizado

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Mesa** (`Mesa/scripts/`). Quem implementa: Gemini.

## O que estamos tentando fazer

O mestre usa a plataforma pelo app de desktop (atalho `mesa-vtt.desktop` → `node Mesa/scripts/launch-desktop.mjs`). O lançador sobe um servidor estático na porta 5100, que serve `Mesa/dist-desktop/` e hospeda a ponte do assistente, e abre uma janela WebKitGTK escrita em Python, dentro do próprio `.mjs`.

Hoje o `dist-desktop` só é montado quando `dist-desktop/Mesa/index.html` não existe (`iniciarAppDesktop`). Por isso, **reiniciar o app não atualiza nada**: o Claude do app trabalhou num Atlas de um dia antes, sem telhados. O servidor MCP, por sua vez, lê o guia e as descrições direto do código-fonte. O resultado é o pior dos casos: o guia descreve ferramentas que o app aberto não tem.

**Meta:** o app sempre roda o código atual. Ao abrir, ele remonta só os apps cujo código mudou. Enquanto está aberto, ele percebe mudanças no código (edição ou commit), remonta em segundo plano e mostra na aba do app afetado um aviso "atualizado — recarregar". Nunca recarrega sozinho, porque o mestre pode ter edições não gravadas ou estar no meio da sessão.

## Decisões

- **Carimbo por app, não por commit.** O carimbo é um hash de (caminho relativo, tamanho, `mtimeMs`) dos arquivos de entrada do build. Ele pega edições não commitadas e commits (que tocam os arquivos), não precisa de git e custa milissegundos.
- **Entradas explícitas por app.** Uma lista fechada de pastas e arquivos que entram no build. Nunca "a pasta toda", porque os builds escrevem dentro do projeto (`dist-desktop-app`, e o Dossiê gera fichas) e isso causaria laço de rebuild.
- **Troca atômica.** O build novo é copiado para `dist-desktop/<App>.novo/` e só então troca de lugar com o antigo (renomear). O servidor nunca serve meio build.
- **Um build por vez**, em fila, e só um build por app na fila.
- **O aviso é injetado pelo hospedeiro Python** (JavaScript na página via WebKit), sem mexer no código dos apps.
- **A ponte (`Atlas/scripts/ponte/servidor.ts`) e o servidor MCP não recarregam sozinhos.** Mudança neles gera um aviso diferente, só na aba da Mesa: "a ponte do assistente mudou: feche e abra o app (e reinicie o app do Claude)".

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| A1 | Carimbo de versão de cada app | script puro + teste |
| A2 | Montagem seletiva e troca atômica | `build-desktop.ts` |
| A3 | O lançador remonta o que mudou ao abrir | `launch-desktop.mjs` |
| A4 | Observador: remonta enquanto o app está aberto | `launch-desktop.mjs` |
| A5 | Aviso "atualizado — recarregar" na aba | hospedeiro Python em `launch-desktop.mjs` |
| A6 | Documentação | LEIAMEs |

Ordem: A1 → A2 → A3 → A4 → A5 → A6.

---

### A1 — Carimbo de versão de cada app  ✅
Objetivo: saber, sem compilar, se o build de um app está velho.
Depende de: —.
Ler: `Mesa/scripts/build-desktop.ts` inteiro (`planejarMontagemDesktop`, `filtroCopiaJukebox`); `Mesa/tests/unit/desktop.test.ts` (como os scripts são testados); os `vite.config.*` e `package.json` de Mesa, Atlas, Atelie e Dossie (o que entra no build); `Dossie/scripts/gen-default-sheets.js` (**o que ele lê e onde escreve**: o que ele escreve fica FORA das entradas).
Arquivos: criar `Mesa/scripts/carimbo.ts` e `Mesa/tests/unit/carimbo.test.ts`.
Como:
1. `export const ENTRADAS_DO_BUILD: Record<string, string[]>`, com caminhos relativos à raiz de cada projeto:
   - `Mesa`: `src`, `public`, `index.html`, `package.json`, `vite.config.ts`, `vendor`.
   - `Atlas`: `src`, `public`, `index.html`, `package.json`, `vite.config.ts`, `mesa-core/src` (o Atlas importa `#mesa` direto da fonte; ver `imports` no `package.json`).
   - `Atelie`: `src`, `public`, `index.html`, `package.json`, `vite.config.js`, `vendor`. Confira no `vite.config.js` se mais alguma pasta entra no bundle (ex.: `data`); se entrar, inclua.
   - `Dossie`: `src`, `public`, `index.html`, `package.json`, o `vite.config` que existir, `scripts/gen-default-sheets.js` e **as entradas que o gerador lê**. O que ele escreve não entra.
   - `Jukebox`: `['.']` (sem build; a cópia já filtra), com o filtro de `filtroCopiaJukebox`.
2. `export function carimboDe(raizDoProjeto: string, entradas: string[], ignorar?: (caminho: string) => boolean): string`: percorre as entradas recursivamente (as que não existem são puladas sem erro), ignora sempre `node_modules`, `.git`, `dist`, `dist-*`, `test-results`, `.ponte` e o que `ignorar` recusar, ordena os caminhos e devolve o `sha1` hex de `caminho\ttamanho\tmtimeMs\n` concatenados. Use `fs.statSync` e `crypto.createHash`.
3. `export const ARQUIVO_DO_CARIMBO = '.carimbo'`; `lerCarimboMontado(pastaDoApp): string | null` lê `dist-desktop/<App>/.carimbo` (null se não existe).
4. `export function appsVelhos(raizProjetos, distDesktop, apps = Object.keys(ENTRADAS_DO_BUILD)): string[]`: os apps cujo carimbo atual difere do montado, ou cuja pasta não existe. O Tabletop fica de fora (não tem build próprio aqui).
Não fazer: compilar nada; mexer no lançador.
Testes (pasta temporária com `fs.mkdtempSync`): o mesmo conteúdo dá o mesmo carimbo; tocar um arquivo (mudar o `mtime` com `fs.utimesSync`) muda o carimbo; criar arquivo em `node_modules` ou `dist-desktop-app` não muda; entrada inexistente não quebra; `appsVelhos` acusa o app sem `.carimbo` e não acusa o que bate.
Pronto quando: `npm run typecheck` e `npm test` passam na Mesa.
Commit: `added build stamps for desktop apps`

### A2 — Montagem seletiva e troca atômica  ✅
Objetivo: `npm run desktop:prep` remonta só o que mudou, e o servidor nunca vê meio build.
Depende de: A1.
Ler: `Mesa/scripts/build-desktop.ts` (`executarMontagemDesktop` e o bloco de execução direta no fim).
Arquivos: mudar `Mesa/scripts/build-desktop.ts` e `Mesa/tests/unit/desktop.test.ts`.
Como:
1. `executarMontagemDesktop(plano, log, rodar, opcoes?: { apps?: string[] })`: com `apps`, só esses entram no laço. O redirecionador continua sendo escrito.
2. Para cada app: compila (como hoje), copia para `path.join(distDesktop, pastaDestino + '.novo')` (apagando um `.novo` velho antes), grava `.carimbo` (de A1) **dentro do `.novo`**, depois `fs.rmSync(destino, { recursive: true, force: true })` e `fs.renameSync(novo, destino)`. Se a compilação falhar, apaga o `.novo` e lança o erro, sem tocar no destino.
3. Execução direta: aceita `--apps Atlas,Mesa` e `--se-mudou` (calcula `appsVelhos` e monta só esses; sem nenhum, escreve "tudo em dia" e sai 0). Sem flags, monta tudo, como hoje.
4. `export async function montarVelhos(raizProjetos, distDesktop, log, rodar?): Promise<string[]>`, o atalho que A3 e A4 usam: devolve os apps remontados.
Não fazer: observador; mudar `planejarMontagemDesktop`.
Testes (com `rodar` falso que cria a pasta de saída esperada): só os apps pedidos são montados; o `.carimbo` aparece no destino; build que falha deixa o destino antigo intacto e não deixa `.novo`; `montarVelhos` não monta nada quando tudo bate.
Pronto quando: tocar um arquivo do Atlas e rodar `npm run desktop:prep -- --se-mudou` remonta só o Atlas; rodar de novo diz "tudo em dia".
Commit: `desktop prep rebuilds only changed apps with atomic swap`

### A3 — O lançador remonta o que mudou ao abrir  ✅
Objetivo: abrir o app pelo atalho sempre mostra o código atual.
Depende de: A2.
Ler: `Mesa/scripts/launch-desktop.mjs` (`iniciarAppDesktop`, o começo do arquivo e o ramo do binário Tauri).
Arquivos: mudar `Mesa/scripts/launch-desktop.mjs`.
Como:
1. Em `iniciarAppDesktop`, quando a porta está livre: em vez de só checar `index.html`, rodar `node scripts/build-desktop.ts --se-mudou` (com `execSync`, `stdio: 'inherit'`, `cwd: mesaRoot`). Um `.mjs` não importa `.ts` sem o carregador; manter o `execSync` é o caminho mais simples e já é o que o arquivo faz hoje.
2. Antes do build, se existir `notify-send`, avise com `spawn('notify-send', ['Mesa VTT', 'Atualizando os apps…'])` (ignore erros). Se o build falhar, avise ("A atualização falhou; abrindo a versão anterior") e **siga abrindo** com o `dist-desktop` que já existe.
3. Se a porta já está em uso (`mesa-dev` rodando), nada muda: quem serve é o `mesa-dev`, que já é o código atual.
Não fazer: observador (A4).
Testes: manual (abrir pelo atalho depois de tocar `Atlas/src/main.tsx` e conferir no log que só o Atlas foi montado). Os testes que importam `launch-desktop.mjs` continuam passando (o arquivo não tem efeito ao ser importado).
Pronto quando: editar o Atlas, fechar e abrir o app mostra a mudança.
Commit: `desktop launcher rebuilds stale apps on start`

### A4 — Observador: remonta enquanto o app está aberto  ✅
Objetivo: uma edição ou commit com o app aberto gera um build novo em segundo plano.
Depende de: A3.
Ler: `Mesa/scripts/launch-desktop.mjs`; `Mesa/scripts/carimbo.ts` (A1).
Arquivos: criar `Mesa/scripts/fila-de-montagem.mjs` (lógica pura da fila) e `Mesa/tests/unit/fila-de-montagem.test.ts`; mudar `launch-desktop.mjs`.
Como:
1. `fila-de-montagem.mjs`: `criarFila({ montar: (app) => Promise<boolean>, esperaMs = 4000, agendar = setTimeout, cancelar = clearTimeout, aoTerminar: (app, ok) => void })`, que devolve `{ sujar(app), parar() }`. `sujar` reinicia a espera daquele app (debounce). Quando a espera vence, o app entra na fila. Roda um build por vez. Se o app sujar de novo durante o próprio build, ele volta à fila uma vez no fim.
2. No lançador, só quando **este processo** hospeda o servidor (porta estava livre): para cada app de `ENTRADAS_DO_BUILD` (importe os dados de `carimbo.ts` copiando a lista para um `.json` gerado, ou duplique a lista num `.mjs` com um teste que confira as duas iguais), `fs.watch(caminho, { recursive: true })` em cada entrada existente. Um evento cujo nome passe pelo filtro de ignorados chama `fila.sujar(app)`. O `montar(app)` roda `node scripts/build-desktop.ts --apps <App>` em `spawn` (não bloquear o processo) e resolve `true` com código 0.
3. Observar também `Atlas/scripts/ponte/` com app fictício `__ponte`: não monta nada; só chama `aoTerminar('__ponte', true)`.
4. `aoTerminar(app, ok)` escreve uma linha JSON no stdin do processo Python: `{"tipo":"atualizado","app":"Atlas"}`, `{"tipo":"falhou","app":"Atlas"}` ou `{"tipo":"ponte"}`. O `spawn` do Python passa a ter `stdio: ['pipe', 'inherit', 'inherit']`.
5. `parar()` no `exit` do Python, junto com `hospedeiro.fechar()`.
Não fazer: o aviso na página (A5).
Testes (relógio falso): três `sujar` seguidos montam uma vez; dois apps montam em sequência, nunca juntos; sujar durante o build remonta uma vez no fim; falha chama `aoTerminar(app, false)`.
Pronto quando: com o app aberto, salvar um arquivo do Atlas gera, uns segundos depois, um build no log e uma linha `atualizado` enviada ao Python.
Commit: `desktop app watches sources and rebuilds in background`

### A5 — Aviso "atualizado — recarregar" na aba  ⬜
Objetivo: o mestre vê que há versão nova e recarrega quando quiser.
Depende de: A4.
Ler: o script Python dentro de `launch-desktop.mjs` (`todas_as_abas`, `caminho_do_app`, `principal`).
Arquivos: mudar `Mesa/scripts/launch-desktop.mjs` (só o Python).
Como:
1. Ler o stdin sem travar o GTK: `GLib.io_add_watch(GLib.IOChannel.unix_new(sys.stdin.fileno()), GLib.PRIORITY_DEFAULT, GLib.IOCondition.IN | GLib.IOCondition.HUP, ao_ler)`. Em `HUP`, pare de observar (devolva `False`).
2. Para `atualizado`: em cada aba de `todas_as_abas()` cujo `caminho_do_app(wv.get_uri())` seja `'/' + app + '/'`, injete com `wv.run_javascript(js, None, None, None)` (no WebKit2 4.1 existe `evaluate_javascript`; use o que houver com `hasattr`) um aviso: `div` fixo no topo central, `z-index` máximo, fundo escuro translúcido, texto "<App> foi atualizado." e dois botões, "Recarregar" (`location.reload()`) e "Depois" (remove o aviso). O `id` fixo evita aviso duplicado. Se a página tiver edições não gravadas, ela mesma pergunta no `beforeunload`; não trate isso aqui.
3. Para `falhou`: o mesmo aviso, com o texto "Falha ao atualizar o <App>: veja o terminal" e só "Fechar".
4. Para `ponte`: só na aba da Mesa (`principal['mesa']`): "A ponte do assistente mudou. Feche e abra o app, e reinicie o app do Claude."
5. O JS fica numa função Python `aviso_js(texto, com_recarregar)` que escapa o texto com `json.dumps`.
Não fazer: recarregar sozinho.
Testes: manual (salvar um arquivo do Atlas com o app aberto → aviso na aba do Atlas → "Recarregar" mostra a mudança). Os testes da Mesa continuam passando.
Pronto quando: o ciclo editar → aviso → recarregar funciona sem fechar o app.
Commit: `desktop app shows reload notice after background rebuild`

### A6 — Documentação  ⬜
Objetivo: quem lê sabe que o app se atualiza e o que ainda exige reinício.
Depende de: A5.
Arquivos: mudar `Atlas/docs/assistente/LEIAME.md` (passo 3), `Atlas/scripts/ponte/LEIAME.md` e o `README.md` da Mesa (seção do app de desktop, se houver).
Como: trocar "rode `npm run desktop:prep`" por: o app remonta sozinho o que mudou (ao abrir e enquanto está aberto) e avisa na aba. Reinício só é preciso para a ponte (`Atlas/scripts/ponte/`) e para o núcleo das instruções (`nucleo.md`); o guia é relido a cada chamada depois de B3. `npm run desktop:prep -- --se-mudou` continua disponível à mão.
Pronto quando: os LEIAMEs descrevem o fluxo novo.
Commit: `documented self-updating desktop app`
