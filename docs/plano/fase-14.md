# Fase 14 — Assistente: o Claude operando a plataforma (só em desenvolvimento)

"Planejar a sessão com quem sabe o que a plataforma faz." O mestre conversa com o **app de desktop do Claude** (pela assinatura, num projeto com as instruções e a memória da campanha) e ele escreve e planeja com ele, lê a campanha, monta mapas e momentos no Atlas, organiza sessões na Mesa e, mais adiante, cria documentos no Ateliê e fichas no Dossiê. Tudo acontece nas abas abertas, com desfazer, e **nada disso existe no GitHub Pages**.

Critério de pronto da fase: com `npm run mesa-dev` rodando e o servidor `mesa` registrado no app do Claude, o Claude lê a campanha e o mapa aberto, vê o mapa renderizado, cria um mapa pequeno e um momento a pedido, e o `dist/` de produção de Atlas e Mesa não contém nenhum traço da ponte.

Planejado em 9 de novembro de 2026 contra o código do fim da Fase 13 em andamento. As etapas 1 a 3 estão detalhadas; a 4 tem escopo fechado e é detalhada ao começar. **Ao começar as etapas 2 e 3, o Opus confere as fichas contra o código do momento** (o que a etapa 1 de fato entregou), como nas Fases 7 a 9. A etapa 3 só começa depois que o mestre testar a etapa 1 com o app do Claude conectado.

## Como funciona

```
 app de desktop do Claude (assinatura; ou o Claude Code, opcional)
     │  MCP (stdio)
     ▼
 servidor MCP  ── Atlas/scripts/ponte/mcp.ts (lançado pelo app, via ~/.config/Claude/claude_desktop_config.json)
     │  WebSocket + token
     ▼
 ponte  ── /__ponte dentro do mesa-dev (Atlas/scripts/ponte/servidor.ts), só em 127.0.0.1
     │  WebSocket (mesma origem)
     ▼
 abas abertas: Atlas, Mesa (depois Ateliê, Dossiê)
     cada aba registra as suas ferramentas e as executa por dentro do app (comandos, validação, desfazer)
```

- **Por que o app do Claude e não um chat embutido:** a assinatura não dá chave de API, e usar o login da assinatura para chamar a API por fora não é permitido. O app de desktop roda na assinatura, fala MCP (a build do Fedora, `claude-desktop` empacotado do oficial, já tem o subsistema de MCP ativo) e guarda as instruções e a memória da campanha num projeto. Ele escreve e planeja; pelas ferramentas, executa o plano na plataforma. O Claude Code fica para desenvolver a plataforma (e, se quiser, também conecta na ponte pelo `.mcp.json`).
- **Visual: a conversa fica no app, a plataforma mostra o trabalho.** Nada de chat dentro da Mesa ou do Atlas. Em desenvolvimento, as abas ganham:
  - um selo "Assistente conectado" no cabeçalho;
  - um painel de atividade com o que o assistente fez, um "desfazer" por chamada e o destaque no mapa do que foi criado;
  - os pedidos de confirmação;
  - a ferramenta "o que estou vendo e selecionando", para o mestre dizer "este cômodo" e o assistente saber qual.
- **Por que a ponte passa pelas abas:** os dados vivem no IndexedDB do navegador. Executar dentro do app garante as mesmas regras do mestre: comandos do store, validação, desfazer, dono de cada entidade no banco da campanha.
- **Por que no `mesa-dev`:** ele já é o servidor de desenvolvimento único da plataforma (todos os apps na mesma origem, como no Pages) e não existe no build. O `npm run dev` avulso de um app não tem ponte (fica para depois, se fizer falta).

## Decisões (não rediscutir na implementação)

- **Só em desenvolvimento, em três travas:**
  1. a ponte é uma rota do `mesa-dev` (Node), que não vai para o build;
  2. o cliente da ponte em cada app entra por `if (import.meta.env.DEV) import('./…/ponte.ts')`: o Vite elimina o trecho e o chunk no `vite build`;
  3. `scripts/ponte/verificar-build.ts` procura o marcador `__ponte` no `dist/` de Atlas e Mesa e falha se achar.
- **Segurança local:** a ponte escuta só em `127.0.0.1`. Abas são aceitas só com `Origin` igual à origem do `mesa-dev` (outra página aberta no navegador não consegue se conectar). O servidor MCP se autentica com um **token** aleatório que o `mesa-dev` grava em `Atlas/.ponte/token` (fora do git) a cada partida.
- **Ferramentas são registradas pelas abas**, não fixas no servidor MCP: cada app descreve as suas (`nome`, `descricao`, `esquema` JSON Schema) e o MCP as repassa ao Claude, avisando quando a lista muda (`notifications/tools/list_changed`). Nome sempre com o prefixo do app: `atlas_mapa_ler`, `mesa_sessao_criar`, `campanha_ler`. Com o mesmo app aberto em duas abas, vale a última que teve foco.
- **Resultados** são `texto` (JSON compacto ou prosa curta) ou `imagem` (PNG em base64). Erros voltam como texto, com o que fazer.
- **Escrita (etapa 2 em diante):** toda ferramenta que escreve vira **comandos comuns** do app, numa única transação do store (`store.transacao`), com rótulo `IA: …`: um Ctrl+Z desfaz a chamada inteira. Criar é livre; **apagar ou sobrescrever** o que a IA não criou pede confirmação na aba (aviso com Permitir/Recusar). Na campanha vale a regra de dono do contrato (§4 do PLATAFORMA.md): cada app só altera o que criou.
- **Cliente da ponte no `mesa-core`** (`mesa-core/src/ponte.ts`, entrada própria, fora do `index.ts`): Atlas e Mesa o importam da fonte e da cópia em `vendor/`; Ateliê e Dossiê (JavaScript) usam a mesma cópia compilada. As ferramentas da **campanha** (leitura do `mesa-campanha-v1`) também moram lá: qualquer aba as oferece.
- **Dependências** (devDependencies do Atlas, onde os scripts moram): `ws` (servidor WebSocket; o Node não tem um embutido) e `@modelcontextprotocol/sdk` (servidor MCP por stdio). Versões fixas no `package-lock`.
- **Genérico para qualquer campanha:** nada no código ou nas instruções cita uma campanha específica. As instruções do assistente são um texto genérico de "assistente de campanha de RPG", para colar no projeto de cada campanha no app.
- **Projetos de outros:** a etapa 1 toca Atlas e Mesa (pedido do usuário). Ateliê e Dossiê só na etapa 4, com autorização explícita, um por vez.

## Etapas

| Etapa | Tarefas | Entrega |
| --- | --- | --- |
| **1 — Ponte e leitura** | 14.1a–f | O Claude lê a campanha, lista e lê mapas, conhece o catálogo do Atlas e vê o mapa renderizado |
| **2 — Mapas e momentos** | 14.2a–f | O Claude monta mapas e momentos no Atlas, com desfazer e confirmação |
| **3 — Sessões na Mesa** | 14.3a–d | O Claude organiza sessões, roteiro, entidades e notas; planejamento de sessão completo |
| **4 — Documentos e fichas** | 14.4a–c | Ateliê e Dossiê na ponte (com autorização) |

## Tarefas

| # | Tarefa | Tipo | Etapa |
| --- | --- | --- | --- |
| 14.1a | Protocolo e servidor da ponte no `mesa-dev` | script + testes | 1 |
| 14.1b | Cliente da ponte e ferramentas da campanha no `mesa-core` | mesa-core | 1 |
| 14.1c | Servidor MCP e registro no app do Claude | script | 1 |
| 14.1d | Atlas na ponte: mapas e catálogo | app | 1 |
| 14.1e | Atlas: ver o mapa | app + render | 1 |
| 14.1f | Mesa na ponte e verificação do build | Mesa + script | 1 |
| 14.1g | Presença do assistente na aba: selo e "o que estou vendo" | app + interface | 1 |
| 14.2a | Construção em comandos: módulo puro compartilhado | domínio | 2 |
| 14.2b | Ferramentas de mapa: criar, terreno, cômodos, paredes, portas | app | 2 |
| 14.2c | Ferramentas de mapa: objetos, espalhar, luzes, ambiente, regiões, presença, notas | app | 2 |
| 14.2d | Ferramentas de momentos | app | 2 |
| 14.2e | Painel de atividade: histórico, desfazer por chamada, destaque e confirmação | app + interface | 2 |
| 14.2f | Instruções do assistente: compor mapas e momentos | documentação | 2 |
| 14.3a | Mesa: sessões planejadas e roteiro | Mesa | 3 |
| 14.3b | Mesa: entidades, ligações e notas | Mesa | 3 |
| 14.3c | Mesa: montar cenas (e abrir os apps) | Mesa | 3 |
| 14.3d | Instruções do assistente: planejar uma sessão | documentação | 3 |
| 14.4a | Ateliê na ponte: documentos e pistas | Ateliê | 4 |
| 14.4b | Dossiê na ponte: fichas e ameaças | Dossiê | 4 |
| 14.4c | Jukebox: cenas sonoras e efeitos (leitura e "tocar") | Jukebox | 4 |

---

### 14.1a — Protocolo e servidor da ponte no `mesa-dev`  ✅
Objetivo: o `mesa-dev` aceita abas e um cliente MCP num WebSocket em `/__ponte` e repassa chamadas de ferramenta entre eles.
Depende de: —
Ler: `scripts/mesa-dev.ts` (`criarProxy`, o `servidor.on('upgrade')` que repassa o WebSocket do Vite), `scripts/mesa-tudo.ts`, `docs/PLATAFORMA.md` §2.
Arquivos: criar `scripts/ponte/protocolo.ts`, `scripts/ponte/servidor.ts`, `tests/unit/ponte.test.ts`; mudar `scripts/mesa-dev.ts`, `package.json` (devDependencies `ws` e `@types/ws`), `.gitignore` (`.ponte/`).
Como:
1. `protocolo.ts` (puro): os tipos das mensagens e `lerMensagem(texto): Mensagem | null` (valida forma, descarta o resto).
   - Aba → ponte: `{ tipo: 'registrar', app, titulo, ferramentas: Ferramenta[] }`, `{ tipo: 'foco' }`, `{ tipo: 'resultado', id, ok: true, conteudo: Conteudo[] } | { …, ok: false, erro: string }`.
   - Ponte → aba: `{ tipo: 'chamar', id, ferramenta, args }`.
   - MCP → ponte: `{ tipo: 'ola', token }`, `{ tipo: 'chamar', id, ferramenta, args }`.
   - Ponte → MCP: `{ tipo: 'ferramentas', lista: (Ferramenta & { app })[] }` (enviado ao conectar e a cada mudança), `{ tipo: 'resultado', … }`.
   - `Ferramenta = { nome, descricao, esquema }`; `Conteudo = { tipo: 'texto', texto } | { tipo: 'imagem', dados, mime }`.
2. `servidor.ts`: `criarPonte({ origem, pastaDoToken })` devolve `{ aceitar(req, socket, cabeca): boolean, fechar() }` sobre um `WebSocketServer` do `ws` em modo `noServer`.
   - Abas: aceitas só com `Origin === origem`; a lista de ferramentas é a união das abas, por app a que teve `foco` por último.
   - MCP: a primeira mensagem tem de ser `ola` com o token, senão fecha.
   - Chamadas: id da chamada → resolve; tempo máximo de 60 s (`erro: 'a aba não respondeu'`); aba que fecha falha as chamadas pendentes dela.
   - O token: 32 bytes aleatórios em hex, gravado em `.ponte/token` ao subir.
3. `mesa-dev.ts`: no `upgrade`, se o caminho é `/__ponte`, entrega à ponte; o resto segue para o Vite como hoje. Na página índice do `mesa-dev`, uma linha "ponte do assistente: N abas".
Não fazer: o MCP (14.1c), cliente nas abas (14.1b).
Testes: `lerMensagem` aceita as formas válidas e recusa lixo; com a ponte num servidor HTTP de teste e clientes `ws`: aba com `Origin` errado é recusada; MCP sem token é recusado; uma chamada vai à aba do app certo e o resultado volta ao MCP; foco troca a aba escolhida; aba que fecha falha a chamada pendente.
Pronto quando: os testes passam e `npm run mesa-dev` sobe com a ponte (sem mudar nada para quem não a usa).
Commit: assistant bridge in mesa-dev
Nota: `criarPonte` ganhou `abas()` (para a linha do índice) e `tempoDaChamadaMs` opcional (para testar o prazo); `criarProxy(projetos, ponte?)` recebe a ponte, criada em `principal` com a origem `http://127.0.0.1:<porta>`. Cliente MCP = conexão sem header `Origin` (autentica com o token); navegador sempre manda `Origin`, então é tratado como aba. `ws` 8.22.2 e `@types/ws` 8.18.2 em versão exata.

### 14.1b — Cliente da ponte e ferramentas da campanha no `mesa-core`  ✅
Objetivo: um app registra ferramentas na ponte com uma chamada; toda aba já oferece a leitura da campanha.
Depende de: 14.1a (protocolo)
Ler: `mesa-core/src/campanha.ts`, `mesa-core/src/idb.ts`, `mesa-core/src/index.ts`, `mesa-core/tsconfig.build.json`, `scripts/ponte/protocolo.ts`.
Arquivos: criar `mesa-core/src/ponte.ts`, `mesa-core/tests/ponte.test.ts`; mudar `mesa-core/tsconfig.build.json` (a entrada nova gera `dist/ponte.js`).
Como:
1. `conectarPonte({ app, titulo, ferramentas })` abre `ws(s)://${location.host}/__ponte`, registra, avisa `foco` em `focus`/`visibilitychange`, atende `chamar` (procura a ferramenta, roda `executar(args)`, devolve `resultado`; exceção vira `ok: false` com a mensagem) e reconecta sozinho (1 s, 2 s, 5 s, depois a cada 10 s). Devolve `{ atualizar(ferramentas), fechar() }`. Sem ponte (porta errada, `npm run dev` avulso) não faz barulho: uma linha no console e mais nada.
2. `FerramentaDaPonte = { nome, descricao, esquema, executar(args): Promise<Conteudo[]> }` e os ajudantes `texto(t)`, `json(v)`, `imagem(dataUrl)`.
3. `ferramentasDaCampanha()`: lê o `mesa-campanha-v1` pelas funções que já existem:
   - `campanha_listar`: id, nome e sistema de cada campanha;
   - `campanha_ler { campanhaId }`: a campanha, as entidades por tipo (nome, tags, refs) e as sessões (data, título, tamanho do roteiro);
   - `campanha_entidade_ler { id }`: uma entidade inteira, com notas e ligações;
   - `campanha_sessao_ler { id }`: a sessão inteira, com roteiro e notas.
   Respostas em JSON compacto, sem blobs (retratos viram `"retrato": true`).
4. **Não** exportar de `index.ts`: a entrada é `mesa-core/src/ponte.ts` (e `dist/ponte.js`), importada só dentro do trecho de desenvolvimento dos apps.
Não fazer: escrita na campanha (etapa 3).
Testes: com um WebSocket falso: registra ao abrir, responde `chamar` com o resultado e com o erro, reconecta depois de cair; as ferramentas da campanha sobre um banco em memória (`fake-indexeddb`, como os testes atuais do `mesa-core`) devolvem o esperado e omitem blobs.
Pronto quando: `npm run build:core` gera `dist/ponte.js` e os testes passam.
Commit: bridge client and campaign tools in mesa-core
Nota: `tsconfig.build.json` não precisou mudar (`include: ["src"]` já emite `dist/ponte.js`). `ferramentasDaCampanha(obterRepositorio)` recebe como abrir o repositório (o app passa o dele). `conectarPonte` aceita `url`, `criarSocket`, `agendar` e `cancelar` opcionais (para testes). Os tipos do protocolo são redeclarados em `ponte.ts` (o `mesa-core` não importa de `scripts/`). `campanha_entidade_ler` inclui as ligações da entidade; `campanha_sessao_ler` procura a sessão em todas as campanhas. `dist/` é ignorado pelo git.

### 14.1c — Servidor MCP e registro no app do Claude  ✅
Objetivo: o app do Claude (e, opcionalmente, o Claude Code) enxerga as ferramentas das abas abertas.
Depende de: 14.1a
Ler: `scripts/ponte/protocolo.ts`, `scripts/ponte/servidor.ts`; a documentação do `@modelcontextprotocol/sdk` (servidor stdio, `setRequestHandler` de `tools/list` e `tools/call`, notificação de lista alterada).
Arquivos: criar `scripts/ponte/mcp.ts`, `scripts/ponte/LEIAME.md`, `tests/unit/ponte-mcp.test.ts`; mudar `package.json` (devDependency `@modelcontextprotocol/sdk`; script `"ponte:mcp": "node scripts/ponte/mcp.ts"`).
Como:
1. `mcp.ts`: servidor MCP por stdio, nome `mesa`. Conecta em `ws://127.0.0.1:5100/__ponte` (porta por `MESA_PORTA`) com o token de `.ponte/token`; reconecta em silêncio.
2. `tools/list`: as ferramentas recebidas da ponte, mais sempre `ponte_estado` (quais apps e abas estão conectados; sem ponte, explica: "rode `npm run mesa-dev` no Atlas e abra a Mesa ou o Atlas em http://127.0.0.1:5100/").
3. `tools/call`: repassa à ponte e converte `Conteudo` em conteúdo MCP (`text` e `image`). Ferramenta que sumiu (aba fechada) volta como erro legível.
4. Ao receber `ferramentas` diferentes, envia `notifications/tools/list_changed`.
5. Nada vai para stdout além do protocolo (logs em stderr).
6. `LEIAME.md` explica o registro:
   - **No app do Claude:** a chave `mcpServers.mesa` em `~/.config/Claude/claude_desktop_config.json`, com `command: "node"` e o caminho absoluto do `mcp.ts`. Antes de editar: fechar o app (ele reescreve o arquivo enquanto roda), guardar uma cópia e validar o JSON com `python3 -m json.tool`.
   - **No Claude Code (opcional):** um `.mcp.json` com a mesma entrada.
Não fazer: ferramentas próprias além de `ponte_estado`.
Testes: com uma ponte de teste e uma aba falsa: `tools/list` reflete a aba; `tools/call` devolve texto e imagem; sem ponte, só `ponte_estado`, com a explicação.
Pronto quando: no app do Claude, o servidor `mesa` aparece nas ferramentas da conversa e `ponte_estado` responde com e sem o `mesa-dev`.
Commit: mcp server for the assistant bridge
Nota: `@modelcontextprotocol/sdk` 1.32.2 (versão exata). A lógica fica em funções exportadas de `mcp.ts` (`conectarNaPonte`, `criarServidorMcp`, `chamarFerramenta`, `listarFerramentas`, `converterConteudo`); o `main` só roda com `import.meta.main`. O token vem de `.ponte/token` relativo à raiz do Atlas (`import.meta.dirname`), reconexão 1/2/5/10 s. Testes de ponta a ponta com `Client` + `InMemoryTransport` e uma ponte real. O registro no app do Claude só foi documentado (`scripts/ponte/LEIAME.md`), não feito; o "Pronto quando" no app depende do mestre registrar.

### 14.1d — Atlas na ponte: mapas e catálogo  ✅
Objetivo: o Claude sabe o que o Atlas tem e o que ele sabe fazer.
Depende de: 14.1b, 14.1c
Ler: `src/main.tsx` (o `__atlas` exposto), `src/app/servicos.ts` (repositório), `src/app/sessao.ts`, `src/procedural/receitas/index.ts` (receitas e campos), `src/procedural/materiais.ts` (`materiaisDo`), `src/procedural/colecao.ts`, `src/domain/presets.ts` (climas, acabamentos, luzes, pincéis de presença), `src/domain/momentos.ts`.
Arquivos: criar `src/app/ponte.ts`, `src/app/ponte-leitura.ts`, `tests/unit/ponte-leitura.test.ts`; mudar `src/main.tsx` (só o `if (import.meta.env.DEV) import('./app/ponte.ts')`).
Como:
1. `ponte.ts`: `conectarPonte({ app: 'atlas', titulo: 'Atlas', ferramentas: [...ferramentasDaCampanha(), ...ferramentasDeLeitura(servicos)] })`.
2. `ponte-leitura.ts` (funções que recebem os serviços; testáveis sem DOM):
   - `atlas_mapas_listar`: id, nome, tamanho, gênero, campanha e data de cada mapa do repositório;
   - `atlas_mapa_ler { id? }` (sem id: o aberto): o resumo do documento. Inclui tamanho e grade; terreno (base e camadas com material e número de células); cômodos (nome, função, retângulo envolvente); objetos agrupados por receita ou asset, com contagem e posições; luzes; regiões; clima e acabamento; momentos (nome e passos); notas. Não inclui as células cruas;
   - `atlas_catalogo { parte? }` (`receitas` | `colecao` | `materiais` | `climas` | `luzes` | `presenca` | `momentos`): ids, nomes, tags, pegada, campos com mínimo, máximo e padrão. É o que o Claude precisa para não inventar ids;
   - `atlas_abrir { id }`: navega até o mapa (para ver e editar).
Não fazer: escrita (etapa 2); ver o mapa (14.1e).
Testes: `atlas_mapa_ler` de um exemplo (`public/exemplos/covil-na-caverna.atlas.json`) devolve as contagens certas e cabe em ~8 mil caracteres; `atlas_catalogo` lista todas as receitas do `ACERVO` com os campos.
Pronto quando: no app do Claude, "liste os mapas e descreva o aberto" responde com dados reais; no `npm run build`, o chunk da ponte não aparece.
Commit: atlas read tools for the assistant
Nota: `package.json` ganhou o alias `#mesa/ponte` (`mesa-core/src/ponte.ts`), pois a ponte não está no `index.ts`. `ferramentasDeLeitura` recebe um contexto mínimo (`repo`, `mapaAberto`, `abrirMapa`) em vez dos `servicos` inteiros. `atlas_catalogo` sem `parte` devolve um índice com contagens (receitas e coleção são grandes); a parte `climas` inclui também acabamentos, gêneros e tipos de cômodo. O resumo do covil tem 3.006 caracteres. Build de produção sem traço da ponte (grep vazio).

### 14.1e — Atlas: ver o mapa  ✅
Objetivo: o Claude enxerga o mapa como o mestre vê, para conferir o que montou.
Depende de: 14.1d
Ler: `scripts/exemplos/gerar.ts` (como a captura prepara a vista: `definirModoProjetor`, `enquadrarCaixa`, esperar `pintando === 0`), `src/render/viewport.ts`, `src/render/cena.ts`.
Arquivos: mudar `src/render/viewport.ts` (método `capturar`), `src/app/ponte-leitura.ts`; criar `tests/e2e/ponte-captura.test.ts`.
Como:
1. `viewport.capturar({ caixa?, ladoMaximo = 1568, estilo? })`:
   - guarda a câmera e o modo;
   - liga o modo projetor (sem grade, pinos nem regiões) e enquadra a caixa (padrão: o mapa inteiro);
   - espera o assar terminar;
   - extrai o quadro da cena pelo renderer do Pixi, no tamanho que cabe em `ladoMaximo`;
   - restaura tudo e devolve um `dataURL` PNG.
2. `atlas_ver_mapa { caixa?: [x0, y0, x1, y1], estilo?: 'illustrated' | 'pixel' }`: devolve a imagem e uma linha de texto com a escala (px por metro), para o Claude ler coordenadas na imagem.
Não fazer: comparação com referência (a skill da 14.2f ensina).
Testes: e2e: num exemplo, a captura tem o tamanho esperado, não é vazia (variância de pixels) e a câmera volta ao lugar.
Pronto quando: no app do Claude, "olhe o mapa aberto" mostra a imagem e o Claude a descreve.
Commit: map snapshot tool
Nota: `capturar` devolve `{ dataUrl, largura, altura, pxPorMetro, caixa }` (a caixa é recortada ao mapa) e recorta a imagem à própria caixa, não à tela; usa `renderer.extract.canvas` sobre a stage, com `resolution` calculada para o maior lado caber em `ladoMaximo`. O parâmetro `estilo` ficou de fora (trocar o estilo re-assaria tudo e mexeria no documento); `atlas_ver_mapa` só aceita `caixa`. O contexto da ponte ganhou `capturar` (opcional). Captura do covil (45 × 34 m) com `ladoMaximo` 800: 800 × 604 px, 17,77 px/m.
Nota (correção do tamanho): o app do Claude recusava a imagem PNG (1568 × 942, cerca de 3 MB). `capturar` agora gera JPEG (qualidade 0,85; padrão `ladoMaximo` 1280) e garante base64 até 700 000 caracteres: baixa a qualidade (0,85, 0,75, 0,65) e depois o lado (×0,8, mínimo 512); devolve também `bytes` e `qualidade`. `atlas_ver_mapa` ganhou `ladoMaximo` (256 a 1600) e informa px/m, caixa e KB; o `mime` já seguia o data URL (mesa-core e mcp.ts sem mudança). Porto noturno (60 × 36 m): 1280 × 769, 195 542 bytes, 260 724 de base64, qualidade 0,85; covil: 1280 × 967, 208 083 bytes. As descrições de `atlas_paredes` e `atlas_comodos` foram reescritas: construção com interior é `atlas_comodos`.

### 14.1f — Mesa na ponte e verificação do build  ✅
Objetivo: com só a Mesa aberta, o Claude já lê a campanha; e fica provado que nada disso vai para o Pages.
Depende de: 14.1b
Ler: `../Mesa/src/main.tsx`, `../Mesa/AGENTS.md` (como atualizar o `vendor/mesa-core`), `../Mesa/vite.config.ts`.
Arquivos: no Mesa, criar `src/app/ponte.ts`; mudar `src/main.tsx` e `vendor/mesa-core/` (cópia nova do `dist`). No Atlas, criar `scripts/ponte/verificar-build.ts`; mudar `package.json` (`"ponte:verificar"`).
Como:
1. Mesa: `if (import.meta.env.DEV) import('./app/ponte.ts')`, que registra `app: 'mesa'` com `ferramentasDaCampanha()` e `mesa_campanha_atual` (a campanha selecionada no hub).
2. `verificar-build.ts`: roda o `vite build` de Atlas e Mesa em pastas temporárias e procura `__ponte`, `conectarPonte` e `ponte_` nos arquivos gerados; falha com a lista do que achou.
Não fazer: ferramentas de escrita da Mesa (etapa 3).
Testes: o próprio `ponte:verificar` passa; o typecheck e os testes do Mesa passam.
Pronto quando: `npm run ponte:verificar` passa e, com só a Mesa aberta no `mesa-dev`, `campanha_ler` responde no app do Claude.
Commit: mesa on the assistant bridge and build check
Nota: o Mesa ganhou o alias `#mesa/ponte` (`imports` do package.json, como no Atlas) e `ponte:verificar` aceita `--mesa <caminho>`/`MESA_DIR`; a busca usa nomes reais (`__ponte`, `conectarPonte`, `ponte_estado`, `atlas_mapa_ler`, `atlas_ver_mapa`, `campanha_ler`, `mesa_campanha_atual`) em vez de `ponte_` solto, para evitar falso positivo.

### 14.1g — Presença do assistente na aba: selo e "o que estou vendo"  ✅
Objetivo: o mestre sabe que o assistente está conectado e pode se referir ao que tem na tela ("este cômodo", "esta sessão").
Depende de: 14.1d, 14.1f
Ler: `mesa-core/src/ponte.ts`, `src/app/ponte.ts`, `src/app/sessao.ts` (`selecao`), `src/ui/` (o cabeçalho do editor), `../Mesa/src/ui/Cabecalho.tsx`, `docs/INTERFACE.md`.
Arquivos: mudar `mesa-core/src/ponte.ts` (estado da conexão como assinatura: `aoMudarEstado`), `src/app/ponte.ts`, `src/app/ponte-leitura.ts`; criar `src/ui/SeloDoAssistente.tsx`; no Mesa, mudar `src/app/ponte.ts` e criar `src/ui/SeloDoAssistente.tsx`.
Como:
1. O cliente da ponte expõe o estado (`desligada`, `conectando`, `conectada`) e o horário da última chamada.
2. Selo no cabeçalho, só montado no trecho de desenvolvimento:
   - conectado: um ponto verde e "Assistente";
   - trabalhando (uma chamada em curso): o ponto pulsa;
   - desligado: nada aparece.
   A dica ao passar o mouse diz quantas ferramentas a aba oferece.
3. `atlas_o_que_vejo`: o mapa aberto, o modo (Construir/Sessão), a caixa visível da câmera em metros e a seleção (ids, tipos, nomes, posições).
4. `mesa_o_que_vejo`: a campanha, a tela atual (coleção, sessão, diário…) e o item aberto.
Não fazer: painel de atividade (14.2e).
Testes: `atlas_o_que_vejo` com seleção de um cômodo e de dois objetos devolve os ids e nomes certos.
Pronto quando: com o app do Claude conectado, o selo aparece nas duas abas; "o que eu selecionei?" responde certo.
Commit: assistant presence badge and what-i-see tools
Nota: o cliente expõe `estado()` (`conexao`, `ocupada`, `ultimaChamadaEm`, `ferramentas`) e `aoMudarEstado(fn)`. O selo entra por um signal `seloDoAssistente` (`src/app/assistente-slot.ts`, nos dois apps) que o cabeçalho lê e só o `ponte.ts` (dev) preenche; `SeloDoAssistente.tsx` leva o próprio CSS num `<style>` e a marca `selo-assistente` foi para `verificar-build.ts`. `oQueVejo` ficou em `ponte-leitura.ts` (Atlas) e em `src/app/o-que-vejo.ts` (Mesa, com teste em `tests/unit/o-que-vejo.test.ts`); a ficha não citava este arquivo da Mesa.

---

### 14.2a — Construção em comandos: módulo puro compartilhado  ✅
Objetivo: as operações do kit dos exemplos (formas, cômodos, portas, objetos, luzes) viram funções puras que **devolvem comandos**, para as ferramentas da ponte usarem sem duplicar a lógica do kit.
Depende de: —
Ler: `scripts/exemplos/kit.ts` (`medir`, `chavesDe`, `comodo`, `parede`, `porta`, `objeto`, `luz`, `espalhar`, `regiao`), `src/state/comandos.ts` e `src/state/comandos-construir.ts` (os tipos `Comando`), `src/domain/fabrica.ts` (`novoObjeto`, `novaLuz`, `novoIdEntidade`), `src/domain/geometria.ts` (`encaixarNaParede`, `motivoDeNaoCaber`), `src/procedural/acervo.ts`, `src/domain/presets.ts`.
Arquivos: criar `src/authoring/formas.ts`, `src/authoring/construcao.ts`, `tests/unit/construcao.test.ts`; mudar `scripts/exemplos/kit.ts` (passa a importar `formas.ts`).
Como:
1. `formas.ts`: o tipo `Forma` do kit e `celulasDaForma(forma, { resolucao, largura, altura, semente })`, que devolve `[i, j][]`. É a lógica de `medir` + `chavesDe` do kit, com o ruído de `irregular` pela semente. O kit troca a sua cópia por esta.
2. `construcao.ts` (puro, recebe o `MapaAtlas` atual e devolve `{ comandos: Comando[]; ids: string[] }`, sem tocar no documento):
   - `terreno(mapa, ops: { acao: 'pintar' | 'apagar'; material?: string; forma: Forma }[], semente)`: valida o material pelo uso (`terreno`, `macico`, `agua`) e gera `terreno.pintar`/`terreno.apagar`;
   - `comodos(mapa, lista: { rets: Ret[]; tipo: string; nome?; piso?; papel?; telhado?; telhadoVisivel? }[])`: `comodo.criar` (e `comodo.atualizar` para o telhado), como o `kit.comodo`;
   - `paredes(mapa, lista: { path: Ponto[]; kind?; altura?; espessura?; material?; drop? }[])`: `parede.adicionar` com `PAREDE_PADRAO`;
   - `portas(mapa, lista: { perto: Ponto; tipo?; estado?; largura? }[])`: encaixa como `kit.porta`. As portas são encaixadas sobre o mapa já com os cômodos da mesma chamada: aplicar os comandos anteriores numa cópia com `aplicarComando` antes de encaixar;
   - `objetos(mapa, lista: { item; pos; rotacao?; escala?; params?; camada?; submerso? }[], semente)`: `item.adicionar` em `props`, com `ACERVO.fonte` e o padrão de submerso do kit;
   - `espalhar(mapa, { conjunto, forma, densidade? }, semente)`: como `kit.espalhar`;
   - `luzes(mapa, lista: { preset; pos; direcao?; raio?; cor?; intensidade? }[])`: `item.adicionar` em `lights` por `presetDeLuz`/`camposDoPreset`;
   - `regioes(mapa, lista: { poligono; tipo; nome?; texto?; somenteMestre? }[])`: `item.adicionar` em `regions`, como `kit.regiao`.
3. Erros de entrada (item, material, tipo de cômodo ou preset desconhecido; porta sem parede perto) lançam `ErroDeConstrucao` com mensagem que diz o que existe. Exemplo: `material “pedra.musgo” não existe; materiais de terreno: grama, terra, …`.
Não fazer: as ferramentas (14.2b); mudar o kit além de importar `formas.ts`.
Testes: cada função num mapa vazio gera os comandos esperados e, aplicados com `aplicarComando`, dão um mapa que passa em `validarMapa`. Porta logo depois de um cômodo na mesma lista encaixa. Erros trazem a lista de opções. `npm run exemplos -- --sem-miniatura` não muda nenhum `public/exemplos/*.atlas.json` (`git diff --stat` vazio).
Pronto quando: os testes passam e os exemplos continuam idênticos.
Commit: shared construction helpers that emit commands

Nota: `formas.ts` também exporta `medirForma`, `chavesDaForma` e `sementeDaForma` (o kit e `espalhar` precisam da medida); `celulasDaForma` recebe `semente` como semente direta do ruído. Cada função tem `semente = 1` e `gerarId = novoIdEntidade` opcionais. `portas` encaixa sobre o mapa recebido (cada abertura vê as anteriores); para cômodos da mesma chamada use `aplicarEmCopia(mapa, comodos(...).comandos)`.

### 14.2b — Ferramentas de escrita do mapa: criar, terreno, cômodos, paredes, portas  ✅
Objetivo: o Claude cria um mapa e levanta a estrutura dele, e cada chamada é um passo de desfazer.
Depende de: 14.1d, 14.2a
Ler: `src/app/ponte.ts`, `src/app/ponte-leitura.ts`, `src/state/store.ts` (`transacao`), `src/app/app.ts` (`criarMapaNovo`, `navegar`), `src/app/exemplos.ts` (`usarExemplo`, o padrão de criar e abrir), `src/domain/mapa.ts` (`criarMapa`), `src/app/campanha.ts` (o mapa com `campanhaId` vira entidade sozinho), `src/authoring/construcao.ts`.
Arquivos: criar `src/app/ponte-escrita.ts`, `tests/unit/ponte-escrita.test.ts`; mudar `src/app/ponte.ts` (registrar as novas ferramentas).
Como:
1. Base comum `escrever(servicos, rotulo, gerar: (mapa) => { comandos; ids })`:
   - pega o mapa aberto (sem mapa: erro "abra um mapa com atlas_abrir ou crie com atlas_mapa_criar");
   - roda `store.transacao('IA: ' + rotulo, g => comandos.forEach(c => g.aplicar(c)))`;
   - guarda os ids criados em `criadosPeloAssistente` (um `Set` só da aba, exportado para a 14.2e);
   - devolve um texto curto: o que foi criado, com os ids, e uma dica para conferir com `atlas_ver_mapa`.
   Um erro de validação ou de comando volta como erro legível, e nada fica aplicado.
2. Ferramentas (as descrições citam as unidades: metros, e células do grid de 1,5 m nos cômodos):
   - `atlas_mapa_criar { nome, largura, altura, base?, genero?, estilo?, campanhaId?, notas? }`: cria pelo mesmo caminho do "novo mapa" do app, grava, abre e devolve o id. Com `campanhaId`, o mapa entra na campanha;
   - `atlas_terreno { base?, operacoes: [{ acao, material?, forma }], correnteza?: { material, angulo, velocidade } }`;
   - `atlas_comodos { comodos: [...] }`;
   - `atlas_paredes { paredes: [...] }`;
   - `atlas_portas { portas: [...] }`.
3. Os esquemas JSON das formas e dos retângulos ficam num só lugar (`esquemaDaForma`) e são reaproveitados.
Não fazer: objetos e ambiente (14.2c); apagar coisas (14.2e).
Testes: com um store de verdade e serviços falsos (o padrão de `tests/unit/` que já montam `servicos`):
- `atlas_terreno` com duas operações gera uma entrada só no histórico, e desfazer volta ao mapa anterior;
- erro no meio de uma lista não deixa nada aplicado;
- `atlas_mapa_criar` grava no repositório com o `campanhaId`.
Pronto quando: no app do Claude, "crie um mapa 20 × 15 de grama com uma trilha de terra e uma cabana de 3 × 3 células com porta" funciona, e cada chamada se desfaz com um Ctrl+Z.
Commit: assistant tools to create maps and build structure

Nota: contexto injetável `ContextoDeEscrita { store, repo, sincronizarCampanha?, abrirMapa, campanhaAtiva? }`; `ferramentasDeEscrita(ctx)` exporta as 5 ferramentas, além de `escrever`, `criadosPeloAssistente`, `esquemaDaForma` e `esquemaDoRetanguloDeCelulas` (o esquema da forma nasceu em `ponte-escrita.ts`, não em `formas.ts`). `atlas_mapa_criar` sem `campanhaId` usa a campanha ativa do app (como o "novo mapa") e abre pela rota (`navegar` e espera a sessão). Todas aceitam `semente` opcional (aleatória se omitida) e até 100 itens por lista. `correnteza.angulo` em radianos. Se a lista não gera comando algum, a ferramenta responde "nada mudou" sem entrada de histórico. Ids de camada de água seguem o material (`agua.rio`, não `agua`).

### 14.2c — Ferramentas de escrita do mapa: objetos, espalhar, luzes, ambiente, regiões, presença, notas  ✅
Objetivo: o Claude mobilia, ilumina e ambienta o mapa.
Depende de: 14.2b
Ler: `src/app/ponte-escrita.ts`, `src/authoring/construcao.ts`, `src/domain/presets.ts` (climas, acabamentos, luzes, pincéis), `src/state/comandos.ts` (`clima.predefinir`, `clima.aplicar`, `clima.salvar`, `acabamento.atualizar`, `presenca.pintar`, `comodo.notas`, `mapa.notas`).
Arquivos: mudar `src/app/ponte-escrita.ts`, `src/app/ponte.ts`, `tests/unit/ponte-escrita.test.ts`.
Como: ferramentas sobre a mesma base `escrever`.
- `atlas_objetos { objetos: [...] }`: até 200 por chamada.
- `atlas_espalhar { conjunto, forma, densidade? }`.
- `atlas_luzes { luzes: [...] }`.
- `atlas_ambiente { clima?: { preset, horario?, tempo?, ambiente?, sol? }, acabamento?: { preset?, ...ajustes }, guardarClima?: { id, nome } }`.
- `atlas_regioes { regioes: [...] }` (revelação, gatilho, áudio).
- `atlas_presenca { pincel, forma }`.
- `atlas_notas { mapa?: string, comodos?: [{ id, leitura?, notasMestre? }] }`.
Os ids desconhecidos (item, conjunto, preset, pincel) voltam como erro com sugestões, os mais parecidos pelo nome e pelas tags do catálogo.
Não fazer: remover ou mover o que já existe (14.2e).
Testes: cada ferramenta aplicada num mapa de teste gera o que o catálogo diz; 200 objetos numa chamada são uma entrada de histórico; item desconhecido sugere os parecidos.
Pronto quando: no app do Claude, o mapa da 14.2b ganha móveis na cabana, árvores espalhadas, uma fogueira com luz e o clima de entardecer, e o Claude confere com `atlas_ver_mapa`.
Commit: assistant tools to furnish, light and set the mood

Nota: `atlas_ambiente.clima` aceita `preset` (pronto ou clima salvo do mapa), `horario`, `tempo`, `ambiente`, `sol` (ou `null`) e `redeLigada`; `acabamento` aceita `preset` e ajustes (com ajustes o preset vira `personalizado`); faixas validadas antes dos comandos, com erro legível. `atlas_presenca` ganhou `intensidade` opcional (comando `item.atualizar` em `presence`). `atlas_notas` substitui o texto do campo. Ids desconhecidos (conjunto, preset de luz/clima/acabamento, pincel) sugerem os parecidos por id e nome; o item do acervo usa a sugestão (id, nome, tags) de `construcao.ts`. Só `atlas_objetos` aceita 200 itens; as outras listas, 100.

### 14.2d — Ferramentas de momentos  ✅
Objetivo: o Claude monta momentos (sequências de cena) no mapa aberto.
Depende de: 14.2b
Ler: `src/domain/momentos.ts` (`PassoDeMomento`, `momentoValido`, `passoValido`, `descreverPasso`), `src/state/comandos.ts` (`momento.salvar`), `src/app/momentos.ts` (o executor, para a ferramenta de testar).
Arquivos: mudar `src/app/ponte-escrita.ts`, `src/app/ponte-leitura.ts`, `src/app/ponte.ts`, `tests/unit/ponte-escrita.test.ts`.
Como:
- `atlas_momento { id?, nome, cor?, passos: PassoDeMomento[] }`: cria, ou substitui se o `id` for de um momento que o assistente criou. Valida com `momentoValido` e confere as referências: o clima existe no preset ou nos climas salvos; os cômodos, regiões e peças da câmera existem; o `interagir` aponta para porta ou interagível. O esquema JSON da ferramenta descreve cada tipo de passo com os limites de `momentos.ts`.
- `atlas_momento_testar { id }`: toca o momento na aba (o mesmo executor do painel) e devolve a lista de passos executados, com a descrição de cada um.
- O catálogo (`atlas_catalogo { parte: 'momentos' }`) já lista os tipos de passo (14.1d); conferir que bate com o esquema.
Não fazer: apagar momento que o mestre criou (14.2e).
Testes: momento válido vira um `momento.salvar`; clima inexistente e cômodo inexistente voltam como erro claro; substituir só vale para ids criados pelo assistente.
Pronto quando: "faça um momento de chegada: escurece a tela, letreiro com o nome do lugar, clima de neblina e câmera no salão" funciona e toca com `atlas_momento_testar`.
Commit: assistant tools for moments
Nota: as duas ferramentas ficaram em `ferramentasDeEscrita` (`ponte-leitura.ts` não mudou). `ContextoDeEscrita` ganhou `tocarMomento(id)` e `pararMomento()` opcionais (o `ponte.ts` liga `tocarMomentoDoMapa` e `pararMomento`; os testes injetam falsos). `atlas_momento_testar` devolve a descrição de todos os passos do momento com o resultado (`fim`, `cancelado` ou `tempo esgotado`, parando o momento); o executor não informa passo a passo. O esquema vem de `esquemaDoPasso()` e a lista de tipos de `TIPOS_DE_PASSO_ESQUEMA`, ambos em `ponte-escrita.ts`; o catálogo continua com a sua própria lista e um teste confere que tipos e campos batem. `interagir` aceita porta/porta secreta ou objeto com interruptor/gaveta (janela, arco, pista e nota são recusados, pois o comando `interagir` não os aciona). `revelar` confere só cômodos (a ficha pede). Com `id` de momento inexistente a ferramenta recusa e pede para omitir o `id`.

### 14.2e — Painel de atividade: histórico, desfazer, destaque e confirmação  ✅
Objetivo: o mestre vê e controla o que o assistente faz no mapa.
Depende de: 14.1g, 14.2b
Ler: `src/ui/SeloDoAssistente.tsx`, `src/app/ponte-escrita.ts` (`criadosPeloAssistente`), `src/state/store.ts` (histórico, `podeDesfazer`), `src/render/viewport.ts` (enquadrar, destaque de seleção), `docs/INTERFACE.md` (painéis flutuantes, cores, tipografia).
Arquivos: criar `src/app/atividade-do-assistente.ts`, `src/ui/PainelDoAssistente.tsx`, `tests/unit/atividade-do-assistente.test.ts`; mudar `src/ui/SeloDoAssistente.tsx`, `src/app/ponte-escrita.ts`, `src/ui/estilo.css`.
Como:
1. `atividade-do-assistente.ts`: a lista das chamadas desta aba (rótulo, horário, ids criados, ok ou erro), num signal. Guarda até 100.
2. Painel (abre ao clicar no selo; só em desenvolvimento):
   - a lista, da mais nova para a mais velha;
   - **Desfazer** só na mais recente, e só se ela ainda é o topo do histórico do store (senão o botão leva ao histórico);
   - passar o mouse num item destaca no mapa os objetos, cômodos e luzes que ele criou (o mesmo contorno da seleção); clicar enquadra.
3. Confirmação e as ferramentas que apagam:
   - `atlas_remover { ids }` e `atlas_mover { ids, delta }`: o que está em `criadosPeloAssistente` segue direto. O resto vira um pedido no painel, com o que será apagado ou movido e os botões **Permitir** e **Recusar**;
   - a ferramenta espera a resposta (até 5 min; depois volta como "o mestre não respondeu");
   - **Recusar** volta ao Claude como erro "o mestre recusou".
4. O selo mostra um número quando há pedido esperando.
Não fazer: histórico entre recargas da aba (a lista é da sessão da aba).
Testes: a lista registra sucesso e erro; Desfazer só aparece no topo; um pedido de remoção de algo do mestre fica pendente até a resposta, e a recusa vira erro.
Pronto quando: no navegador, o painel mostra as chamadas, destaca o que cada uma criou e segura a remoção de um cômodo do mestre até Permitir.
Commit: assistant activity panel with undo and confirmation
Nota: o "topo do histórico" é decidido pela `versaoEdicao` do store guardada logo após a chamada (qualquer edição, desfazer ou refazer depois a muda; conservador: desfazer a edição do mestre não devolve o botão). O destaque no hover reaproveita a seleção do mapa (guarda a seleção do mestre e a devolve ao sair), sem mexer no viewport; o clique usa `enquadrarCaixa`. Recusa, silêncio (5 min) ou id inexistente não aplicam nada, nem a parte do assistente. `atlas_remover` aceita também momentos; `atlas_mover` só objetos, luzes, peças e regiões. Presença de pedido pendente abre o painel sozinho. `Geracao` ganhou `afetados` (ids só mexidos, sem virarem "do assistente"). O selo virou um botão.

### 14.2f — Instruções do assistente: compor mapas e momentos  ✅
Objetivo: um texto genérico de instruções para colar no projeto de qualquer campanha no app do Claude, que faz o assistente usar bem as ferramentas.
Depende de: 14.2c, 14.2d
Ler: `scripts/exemplos/*.ts` e o histórico de ajustes da Fase 10 (`docs/plano/fase-10.md`, notas das 10.7), `src/app/ponte-escrita.ts`.
Arquivos: criar `docs/assistente/instrucoes.md` e `docs/assistente/LEIAME.md` (como registrar o servidor e onde colar as instruções).
Como: texto curto (até ~2 mil palavras), em português, sem citar nenhuma campanha. Seções:
1. **Papel:** parceiro criativo do mestre. Primeiro conversar, escrever e planejar; só construir quando o mestre pedir ou aprovar.
2. **Antes de construir:** `atlas_o_que_vejo`, `atlas_catalogo` e `campanha_ler`.
3. **Compor um mapa:**
   - uma grade de 5 em 5 metros no rascunho;
   - a composição grande primeiro (terreno, maciços, água), depois a estrutura, os objetos e a luz;
   - `atlas_ver_mapa` depois de cada bloco, corrigindo o que destoa.
4. **Regras aprendidas na Fase 10:**
   - rocha e escarpa são maciço de terreno, não paredes avulsas;
   - presença em pouca quantidade e baixa;
   - peças de cais e deque com rotação explícita;
   - árvores e rochas na escala real, nada de manchas de material em disco;
   - interiores cheios em lugares de trabalho.
5. **Momentos:** curtos, com propósito; testar com `atlas_momento_testar`.
6. **Respeito ao que é do mestre:** nunca apagar sem motivo; explicar o que vai fazer antes de chamadas grandes.
Não fazer: instruções da Mesa (14.3d).
Testes: — (documentação). Conferir que todos os nomes de ferramenta citados existem.
Pronto quando: com as instruções coladas num projeto, um pedido de mapa curto sai composto em blocos e conferido com captura.
Commit: assistant instructions for maps and moments
Nota: `instrucoes.md` (cerca de 1,4 mil palavras) acrescenta um exemplo de pedido curto em blocos e recomenda ler antes de `atlas_notas` (que substitui o texto); `LEIAME.md` aponta para `scripts/ponte/LEIAME.md` em vez de repetir o registro. Todos os nomes de ferramenta citados foram conferidos por grep nos arquivos de ferramentas.

### 14.3a — Mesa: sessões planejadas e roteiro  ✅
Objetivo: o Claude cria a sessão da próxima mesa, sem começar a gravar, e monta o roteiro dela.
Depende de: 14.1f
Ler: `../Mesa/src/app/registro.ts` (`iniciarSessao`, `alterarSessao`, `adicionarAoRoteiro`, `definirNotaDoItem`, `carregarSessoes`), `../Mesa/src/dominio/roteiro.ts` (`adicionar`, `mover`, `MAXIMO_DO_ROTEIRO`, `ehAbrivel`), `../Atlas/mesa-core/src/campanha.ts` (`Sessao`, `salvarSessao`), `../Mesa/src/app/ponte.ts`.
Arquivos: no Mesa, mudar `src/app/registro.ts` (função `planejarSessao` e `alterarSessaoPorId`), `src/app/ponte.ts`; criar `src/app/ponte-escrita.ts`, `tests/unit/ponte-escrita.test.ts`.
Como:
1. `registro.ts`:
   - `planejarSessao(nome, data?)` cria a sessão no banco **sem** abrir nem gravar (diferente de `iniciarSessao`) e a acrescenta a `sessoes`;
   - `alterarSessaoPorId(id, mudancas)` altera qualquer sessão, não só a ativa. Se for a ativa, mantém `sessaoAtiva` em dia.
2. Ferramentas:
   - `mesa_sessao_criar { nome, data? }`;
   - `mesa_sessao_editar { id, nome?, roteiro?: { acrescentar?: Ref[]; remover?: Ref[]; ordem?: Ref[] }, notas?: { ref, texto }[] }`, que usa as funções puras de `roteiro.ts` (limite de 64, sem repetição) e `podarNotas`;
   - `mesa_sessoes_listar`.
   As refs aceitam a forma em texto (`mesa:atlas/mapa/<id>`) além do objeto.
Não fazer: entidades e cenas (14.3b, 14.3c).
Testes: `planejarSessao` não liga a gravação; editar o roteiro respeita limite e repetição; nota de item que saiu do roteiro é podada.
Pronto quando: "crie a sessão 'Sessão 12' com o mapa X e a cena Y no roteiro" aparece no Diário da Mesa sem gravar.
Commit: assistant tools for planned sessions in mesa
Nota: `alterarSessaoPorId` aceita também `data` e devolve a sessão nova (async). `mesa_sessao_editar` aplica remover, acrescentar, ordem e notas, nesta ordem; o que não coube (repetido, roteiro cheio, ref fora do roteiro) volta em `ignorados`. `ordem` põe os itens listados no começo e deixa os demais depois. `data` é "AAAA-MM-DD" (meio-dia local). O contexto injetável é `ContextoDeSessoes`; `mesa_sessao_criar` entrou nas marcas de `verificar-build.ts`.

### 14.3b — Mesa: entidades, ligações e notas  ✅
Objetivo: o Claude registra NPCs, lugares, pistas, facções e notas na campanha e as liga entre si.
Depende de: 14.3a
Ler: `../Mesa/src/app/campanha.ts` (`criarEntidade`, `alterarEntidade`, `sincronizarLigacoes`), `../Mesa/src/dominio/entidades.ts` (`TIPOS_CRIAVEIS`), `../Mesa/src/dominio/notas.ts` (as `[[ligações]]` no texto), `../Atlas/mesa-core/src/campanha.ts` (regra de dono em `salvarEntidade`, `ligar`, `TIPOS_LIGACAO`).
Arquivos: no Mesa, mudar `src/app/ponte-escrita.ts`, `src/app/ponte.ts`, `tests/unit/ponte-escrita.test.ts`.
Como:
- `mesa_entidade_criar { tipo, nome, tags?, notas? }`: `tipo` em `TIPOS_CRIAVEIS` mais `cena` e `ameaca`; as notas aceitam `[[nome]]`, e `sincronizarLigacoes` roda depois.
- `mesa_entidade_editar { id, nome?, tags?, notas?, acrescentarNotas? }`: só entidades criadas pela Mesa (a regra de dono do repositório já recusa; a mensagem diz quem é o dono). `acrescentarNotas` soma ao fim em vez de trocar.
- `mesa_ligar { de, para, tipo }`, com `tipo` em `TIPOS_LIGACAO`.
- A seleção da Mesa não muda (`criarEntidade(..., selecionar = false)`).
Não fazer: remover entidades (fica com o mestre na interface).
Testes: criar personagem com `[[Lugar]]` nas notas gera a ligação; editar entidade de outro app volta erro claro; ligar com tipo inválido volta a lista de tipos.
Pronto quando: "registre o NPC Var Hoyde, ferreiro, ligado à Forja" aparece na coleção da Mesa com a ligação.
Commit: assistant tools for campaign entities and links
Nota: contexto injetável `ContextoDeEntidades`; `criar` usa `criarEntidade(..., false)` e depois `alterar` aplica tags e notas (que já sincroniza as `[[ligações]]`). `mesa_entidade_editar` checa o dono antes (`podeEditar`) e diz o app ("é do Dossiê"); `id` aceita também `mesa:mesa/entidade/<id>`. Novo `ligarRefs` em `src/app/campanha.ts` (dá o Ref da Mesa às entidades das pontas, como `sincronizar`). Respostas trazem o `ref` `mesa:mesa/entidade/<id>`. `mesa_entidade_criar` entrou nas marcas de `verificar-build.ts`.

### 14.3c — Mesa: montar cenas  ✅
Objetivo: o Claude monta a cena de jogo: mapa ou cômodo, trilha sonora, participantes, pistas e o momento que a abre.
Depende de: 14.3b
Ler: `../Mesa/src/app/campanha.ts` (`vincularMapaNaCena`, `vincularTrilhaNaCena`, `vincularParticipanteNaCena`, `vincularPistaNaCena`, `desvincularDaCena`, `alternarEncontroDaCena`, `definirMomentoDaCena`), `../Mesa/src/dominio/cenas.ts` (`extrairPacoteDeCena`), `../Mesa/src/ui/EditorDeCena.tsx`.
Arquivos: no Mesa, mudar `src/app/ponte-escrita.ts`, `src/app/ponte-leitura.ts` (criar se não existir), `src/app/ponte.ts`, `tests/unit/ponte-escrita.test.ts`.
Como:
- `mesa_cena_montar { cenaId, mapa?, trilha?, participantes?: string[], pistas?: string[], momento?, encontro? }`: cada campo chama a função `vincular…` correspondente. Os ids são de entidades da campanha. O `momento` segue o formato que `definirMomentoDaCena` espera (conferir no código e descrever no esquema).
- `mesa_cena_ler { cenaId }`: o pacote de `extrairPacoteDeCena`, com nomes.
- `mesa_abrir_apps { apps: ('atlas' | 'ficha' | 'atelie' | 'jukebox')[] }`: abre as abas pelo manifesto (`aplicativos.ts`). O navegador pode bloquear janela aberta sem gesto do mestre; nesse caso a ferramenta põe um aviso na Mesa com o botão "Abrir", e a resposta ao Claude diz isso.
Não fazer: criar o mapa ou o momento (são do Atlas, etapa 2).
Testes: montar uma cena com mapa, trilha e dois participantes cria as ligações certas; `mesa_cena_ler` devolve o pacote com nomes.
Pronto quando: "monte a cena 'Emboscada na ponte' com o mapa da ravina, a trilha de tensão e os dois bandidos" aparece pronta no Modo Sessão da Mesa.
Commit: assistant tools to assemble scenes
Nota: tudo em `src/app/ponte-escrita.ts` (`ferramentasDeCena`, contexto `ContextoDeCenas`; sem `ponte-leitura.ts`). Os ids aceitam id da entidade, `mesa:mesa/entidade/<id>` ou qualquer ref da entidade. Tudo é conferido (cena, mapa = lugar/ref do Atlas, trilha = Jukebox, participantes = personagem/ameaça, pistas = pista/Ateliê) antes de gravar; as funções `vincular…` seguem usando `avisar` e devolvendo `false` (o erro vira "veja o aviso na Mesa"). `momento` é o NOME (ou id) de um momento do mapa vinculado à cena, texto livre (vira a etiqueta `momento:<texto>`; o Atlas casa por id ou nome, sem diferenciar maiúsculas, e só toca com mapa vinculado); vazio remove. `encontro` é booleano. `avisar` ganhou o parâmetro `acao` (botão no aviso, 30 s). `abrirAplicativo` (em `aplicativos.ts`) abre a raiz do app pelo manifesto e NÃO usa `noopener` (ele faz `window.open` devolver sempre `null`); zera `opener` depois. `mesa_cena_montar` entrou nas marcas de `verificar-build.ts`.

### 14.3d — Instruções do assistente: planejar uma sessão  ✅
Objetivo: as instruções ganham o fluxo completo de preparar uma sessão.
Depende de: 14.2f, 14.3c
Ler: `docs/assistente/instrucoes.md`, as ferramentas da Mesa.
Arquivos: mudar `docs/assistente/instrucoes.md`, `docs/assistente/LEIAME.md`.
Como: seção "Planejar uma sessão":
1. ler a campanha, a última sessão e o registro dela;
2. conversar e escrever o plano com o mestre: cenas, NPCs, pistas, ritmo;
3. com o plano aprovado:
   - registrar as entidades;
   - criar os mapas e os momentos no Atlas, conferindo cada mapa com a captura;
   - montar as cenas;
   - criar a sessão com o roteiro e as notas por item;
4. terminar com um resumo do que foi criado, com os nomes.
Mais: abrir os apps que faltam com `mesa_abrir_apps`, e o que fazer quando uma ferramenta falha (ler o erro, corrigir, nunca repetir às cegas).
Testes: — (documentação). Conferir os nomes das ferramentas.
Pronto quando: com as instruções, "prepare a próxima sessão a partir das notas da anterior" produz cenas, mapas, momentos e a sessão ligados, com um resumo final.
Commit: assistant instructions for session planning
Nota: seção "Planejar uma sessão" em `instrucoes.md` (título do documento passou a "mapas, momentos e sessões"); `mesa_o_que_vejo` entrou em "Antes de construir". Nomes e parâmetros conferidos por grep nos arquivos de ferramentas.

### Etapa 4 — regras comuns (valem para 14.4a–d)
Detalhada em 10 de novembro de 2026, contra o código do fim da etapa 3. Autorização do usuário para Ateliê, Dossiê e Jukebox dada no mesmo dia.
- **`mesa-core` com a ponte nos três:** `npm run build:core` no Atlas e copiar `mesa-core/dist/.` para `vendor/mesa-core/` do app (a cópia de hoje não tem `ponte.js`). Cada ficha copia para o seu app.
- **Só em desenvolvimento:** Ateliê e Dossiê (Vite) carregam a ponte por `if (import.meta.env.DEV) import('./ponte.js')`. A Jukebox não tem build: ela carrega a ponte só quando `location.hostname` é `127.0.0.1` ou `localhost`, e no Pages o código não roda.
- **Um módulo `ponte.js` por app**, com as ferramentas como funções que recebem um contexto injetável (como `ponte-escrita.ts` da Mesa) e testes com `node --test` sobre esse contexto, sem navegador.
- **Nome com prefixo do app:** `atelie_…`, `dossie_…`, `jukebox_…`. O id do app na ponte é o do contrato: `atelie`, `ficha` (Dossiê) e `jukebox`.
- **Regra de dono:** criar é livre. Mudar o que o assistente não criou pede confirmação na aba, e uma recusa volta como erro "o mestre recusou". Os ids criados pelo assistente ficam numa lista no `localStorage` (`<app>:ponte-criados`), só em desenvolvimento.
- **Campanha:** o que o app já publica na campanha sozinho (Dossiê, Jukebox) continua por esse caminho. A ferramenta só dispara a sincronização. O Ateliê, que não publica, passa a registrar como `pista` os documentos criados pelo assistente.
- **Sem commit:** o usuário revisa e commita. Cada ficha termina com a mensagem sugerida.

### 14.4a — Ateliê na ponte: documentos e pistas  ✅
Objetivo: o Claude cria um documento a partir de um modelo do Ateliê, preenche o texto (e o texto escondido sob luz UV), salva, publica para o Atlas e o Tabletop e registra a pista na campanha.
Depende de: 14.3d
Ler: `../Atelie/AGENTS.md`, `../Atelie/src/main.js`, `../Atelie/src/mesa.js`, `../Atelie/src/editor/editor.js` (`instantiateTemplate`, `archiveDocument`, a API devolvida no fim), `../Atelie/src/domain/handouts.js` (`textLayer`, `fillFields`, `setField`, `layer.light`), `../Atelie/src/data/api.js` (`handouts.list/read`, `library`), `../Atelie/src/editor/templates-drawer.js` (categorias, era, tom), um modelo em `../Atelie/public/colecao/modelos/`, `../Mesa/src/app/ponte-escrita.ts` (padrão de contexto e erros).
Arquivos: no Ateliê, copiar o `vendor/mesa-core/` novo, criar `src/ponte.js` e `tests/ponte.test.js`, e mudar `src/main.js` (carregar a ponte só em DEV) e `src/mesa.js` (função para registrar a pista na campanha).
Como:
- `atelie_modelos_listar { busca?, categoria?, era?, tom? }`: id, nome, categoria, era, tom e os **campos** de cada modelo (os rótulos que `fillFields` aceita). No máximo 40 por resposta, com o total.
- `atelie_documento_criar { modelo, nome, campos?: { [rotulo]: texto }, textoUV?: string, categoria?, tags? }`: instancia o modelo, preenche os campos, acrescenta uma camada de texto com `light: 'uv'` quando há `textoUV` (com estilo herdado de `inheritedTextStyle`) e arquiva pelo mesmo caminho do botão (`editor.archive`), que assa, publica no `mesa-handouts-v1` e avisa `atelie.documento-salvo`. O documento abre numa aba do editor. Depois registra a entidade `pista` com o Ref `mesa:atelie/documento/<id>` na campanha ativa (`abrirRepositorioCampanha({ app: 'atelie' })`, sem duplicar se já existe). Devolve id, ref, nome e campos que não existiam no modelo (ignorados).
- `atelie_documento_editar { id, nome?, campos?, textoUV? }`: os mesmos passos sobre um documento existente. Pede confirmação se o documento não foi criado pelo assistente.
- `atelie_documentos_listar { busca? }` e `atelie_documento_ler { id }` (nome, categoria, tags, os campos com o texto atual, se tem UV, revisão).
Não fazer: desenhar camadas livres, imagens ou efeitos, nem apagar documentos.
Testes: listar modelos filtra por categoria e devolve os campos; criar preenche os campos e acrescenta a camada UV; campo desconhecido volta em ignorados; editar documento alheio sem confirmação volta "o mestre recusou".
Pronto quando: "crie a carta do informante ameaçando a família, com o endereço escondido em UV" aparece no Ateliê arquivada, na coleção da Mesa como pista e na lista de pistas do Atlas.
Commit: assistant tools for atelie documents
Nota: `src/ponte.js` (`ferramentasDoAtelie(ctx)`, contexto injetável); `main.js` o carrega só em DEV. Criar e editar passam pelo histórico do editor (`state.edit`) e arquivam por `editor.archive()` (assa, publica, avisa `atelie.documento-salvo`); como o `archive` engole erros, a ferramenta relê e falha se a revisão não subiu. Modelo e documento abrem em aba nova (`newTab`), para não trocar o que o mestre tem aberto. O verso de modelos com `backTemplate` é criado pelo próprio `instantiateTemplate`, sem campos. `textoUV` vira a camada "Texto UV" (`light:'uv'`, estilo herdado, no rodapé); `""` a remove. Editar sem mudança nenhuma é erro ("Nada a alterar"). `registrarPista` em `src/mesa.js` (ambiente injetável) cria a `pista` sem duplicar; sem campanha ativa a resposta diz isso. Confirmação por `window.confirm`. 15 testes em `tests/ponte.test.js`.

### 14.4b — Dossiê na ponte: fichas e ameaças  ✅
Objetivo: o Claude cria e ajusta fichas de personagem e de ameaça no Dossiê, que já as publica na campanha.
Depende de: 14.4a (pelo `vendor` e pelo padrão)
Ler: `../Dossie/src/mesa.js` (`iniciarMesa`, `sincronizar`, `ehAmeaca`, `recursosDaFicha`), `../Dossie/src/app.js` (o clique em `[data-create-system]`, `normalizeSheet`, `save`, `switchToSheet`, `render`, a chamada a `iniciarMesa` no fim), `../Dossie/src/systems/threat/threat-data.js` (`DEFAULT_THREAT_SHEET`, elementos, tamanhos, tipos), `../Dossie/src/systems/threat/threat-balance.js` (`getBalance`, `applyPreset`) e o wizard de ameaça, que usa os dois.
Arquivos: no Dossiê, copiar o `vendor/mesa-core/` novo, criar `src/ponte.js` e `tests/ponte.test.mjs`, e mudar `src/app.js` (montar o adaptador e carregar a ponte só em DEV).
Como:
- O `app.js` monta um adaptador (`fichas`, `aberta`, `criar(dados)` com o mesmo caminho do clique de nova ficha, `salvar`, `abrir`, `sincronizar` da mesa) e o passa a `ponte.js`. Nada da lógica das ferramentas fica no `app.js`.
- `dossie_fichas_listar { tipo?: 'personagem' | 'ameaca', busca? }` e `dossie_ficha_ler { id }` (resumo legível: nome, sistema, atributos, PV/PD, para ameaça VD, elementos, defesa, ações).
- `dossie_ameaca_criar { nome, vd, elementos, categoria?, tipo?, tamanho?, preset?, descricao?, acoes?: { nome, tipoAcao, texto, dano? }[] }`: números de defesa, PV, salvaguardas e dano tirados de `getBalance(vd, preset)`, como o wizard faz; valores fora das listas do `threat-data.js` voltam como erro com as opções.
- `dossie_ficha_criar { nome, sistema: 'ordem2' | 'original', classe?, nex?, atributos?, conceito? }`: o mínimo coerente pelo caminho normal de criação.
- `dossie_ficha_editar { id, nome?, campos? }`: só campos de texto e números simples listados no esquema. Pede confirmação se a ficha não foi criada pelo assistente.
- Depois de criar ou editar: `salvar`, `sincronizar` (a entidade `personagem` ou `ameaca` entra na campanha pelo caminho de sempre) e a ficha nova abre na tela.
Não fazer: apagar fichas, mexer em retrato, licença do bestiário ou pastas.
Testes: ameaça VD 60 com `preset` sai com os números da tabela; elemento inválido volta as opções; editar ficha alheia sem confirmação volta "o mestre recusou"; criar dispara `sincronizar`.
Pronto quando: "crie a ameaça Carniçal de Sangue, VD 40, com uma mordida" aparece no Dossiê e na coleção da Mesa como ameaça.
Commit: assistant tools for dossie sheets and threats
Nota: `src/ponte.js` (`ferramentasDoDossie(ctx)`); `app.js` só monta o adaptador em DEV. O corpo do clique de nova ficha virou `criarFichaNova(mode, { raw, semAssistente })`, usado pelos dois; pela ponte a ficha nasce sem tutorial nem wizard. A ameaça reaproveita `aplicarEscolhas` e `ARQUETIPOS` do wizard (agora exportados) sobre `getBalance(vd, preset)`; parâmetro novo `arquetipo` (`tank`, `predador`, `mental`, `boss`); sem ele, PV e Defesa saem exatamente da tabela. Correção no wizard: `bonus || padrão` trocava salvaguarda de bônus 0 pelo padrão (`??` agora). `dossie_ficha_editar` aceita uma lista fixa de campos por tipo; `vd` editado só muda o rótulo. Editar ficha alheia pede `confirm()`. 7 testes em `tests/ponte.test.mjs`.

### 14.4c — Jukebox na ponte: cenas sonoras e efeitos  ✅
Objetivo: o Claude sabe quais cenas sonoras e efeitos existem e pode tocar, disparar e parar.
Depende de: 14.4a (pelo `vendor`)
Ler: `../Jukebox/mesa.js` (`pedidoDeCena`, `pedidoDeEfeito`, `pedidoDeParar`, `efeitosDisponiveis`, `slugDoTitulo`), `../Jukebox/scenes.js` (`getScenesSnapshot`, `getActiveSceneId`, `activateSceneById`), `../Jukebox/index.html` (como os scripts entram), `../Atlas/scripts/mesa-tudo.ts` (Jukebox servida como estática).
Arquivos: na Jukebox, copiar o `vendor/mesa-core/` novo, criar `ponte.js`, mudar `mesa.js` (exportar as três funções de pedido e o que listar, e carregar `ponte.js` só em 127.0.0.1/localhost); testes em `tests/ponte.test.mjs` com `node --test` (a Jukebox não tem `package.json`: rodar `node --test tests/`).
Como:
- `jukebox_listar`: cenas sonoras (id, nome, ref `mesa:jukebox/cena-sonora/<id>`, se é a ativa) e efeitos (slug, título, ref `mesa:jukebox/efeito/<slug>`, se o áudio carregou).
- `jukebox_tocar { cena }`, `jukebox_efeito { efeito }` e `jukebox_parar { ms? }`: chamam as mesmas funções do barramento. Cena e efeito aceitam id/slug, ref em texto ou nome (sem diferenciar maiúsculas e acentos).
- Se o navegador bloquear o áudio por falta de gesto do mestre, a resposta diz isso ("clique na aba da Jukebox uma vez").
Não fazer: criar ou editar cenas sonoras, subir músicas, mexer no mixer.
Testes: achar cena por nome sem acento; efeito desconhecido volta a lista de efeitos; `jukebox_parar` usa 1000 ms por padrão.
Pronto quando: "toque a trilha de tensão" muda a cena na Jukebox, e o Registro da Mesa mostra "Tocando: …".
Commit: assistant tools for jukebox scenes and effects
Nota: `ponte.js` sem DOM, com contexto montado por `contextoDaPonte()` em `mesa.js` (reaproveita `pedidoDeCena`, `pedidoDeEfeito`, `pedidoDeParar`, agora exportadas); carregada no início de `iniciar()` só em 127.0.0.1/localhost. O player engole a rejeição do `play()`, então o autoplay bloqueado é inferido 400 ms depois (nada tocando). Cena com parte das faixas faltando toca o que tem e volta sucesso com `aviso`. Testes: `node --test` na pasta (não `node --test tests/`).

### 14.4d — Verificação do build e instruções  ✅
Objetivo: a trava 3 cobre Ateliê e Dossiê, e as instruções do assistente sabem usar os três apps.
Depende de: 14.4a–c
Ler: `scripts/ponte/verificar-build.ts`, `docs/assistente/instrucoes.md`, `docs/assistente/LEIAME.md`, as ferramentas novas.
Arquivos: mudar `scripts/ponte/verificar-build.ts`, `docs/assistente/instrucoes.md`, `docs/assistente/LEIAME.md`, `progress.md`.
Como:
- `verificar-build.ts` passa a construir também Ateliê (`vite build`) e Dossiê (`vite build`, sem o `gen-default-sheets`), aceitando `vite.config.js`, com as marcas novas (`atelie_documento_criar`, `dossie_ameaca_criar`, `jukebox_tocar` só por garantia nos dois). A Jukebox fica de fora (sem build), e a regra da 14.4c fica documentada no LEIAME.
- Instruções: em "Planejar uma sessão", as pistas viram documentos no Ateliê, os NPCs e as ameaças viram fichas no Dossiê e a trilha da cena vem de `jukebox_listar`. Uma seção curta sobre documentos: escolher modelo por era e tom, preencher só os campos do modelo e usar UV para o segredo.
Testes: `npm run ponte:verificar` passa com os quatro builds.
Pronto quando: a verificação passa e as instruções citam só ferramentas que existem.
Commit: build check and instructions for atelie, dossie and jukebox
Nota: `verificar-build.ts` constrói também Ateliê e Dossiê (só `vite build`, `vite.config.ts` ou `.js`; `--atelie`/`ATELIE_DIR`, `--dossie`/`DOSSIE_DIR`; ausentes são pulados com aviso) e ganhou as marcas `atelie_documento_criar`, `atelie_modelos_listar`, `dossie_ameaca_criar`, `dossie_ficha_criar`, `jukebox_tocar`. A Jukebox (sem build) fica de fora, com a regra do hostname no LEIAME. Instruções: "Planejar uma sessão" manda pistas ao Ateliê, NPCs e ameaças ao Dossiê e a trilha de `jukebox_listar`; seção nova "Documentos, fichas e trilha" depois do resumo.

**Fase 14 concluída** em 10 de novembro de 2026 (falta o teste da etapa 4 no navegador com o app do Claude).

## Depois da fase

### 14.5a — Ponte: avisar quando os apps estão em armazenamentos diferentes  ⬜
Objetivo: o Claude percebe quando a Mesa e o Atlas (ou outros apps) estão abertos em lugares com dados separados (o navegador e o app de desktop, dois navegadores, dois perfis) e avisa o mestre em vez de seguir. Caso real (10/11): o Atlas do app de desktop criou o mapa na campanha "Teste", e a Mesa do Firefox, com o banco vazio, não achou a campanha.
Depende de: 14.1a, 14.1b, 14.1c
Ler: `scripts/ponte/protocolo.ts` (`registrar`, `FerramentaDoApp`, `lerMensagem`), `scripts/ponte/servidor.ts` (registro das abas, "vale a última que teve foco", `aceitar`), `scripts/ponte/mcp.ts` (`textoDoEstado`, `listarFerramentas`, como repassa os resultados), `mesa-core/src/ponte.ts` (`registrar`).
Arquivos: mudar `mesa-core/src/ponte.ts`, `scripts/ponte/protocolo.ts`, `scripts/ponte/servidor.ts`, `scripts/ponte/mcp.ts`, `docs/assistente/instrucoes.md`, e os testes de cada um; copiar o `mesa-core` novo (`npm run build:core`) para o `vendor/` de Mesa, Ateliê, Dossiê e Jukebox.
Como:
- **Identidade do armazenamento:** o cliente da ponte lê do `localStorage` uma chave `mesa:ponte-armazenamento` (cria um id aleatório se não houver) e a manda no `registrar` como `armazenamento`. Abas que compartilham dados compartilham o id; navegador e app de desktop, ou dois perfis, têm ids diferentes. Sem `localStorage`: id novo a cada carga (vale como diferente).
- **Rótulo legível:** o servidor guarda, por aba, o `User-Agent` da conexão (`aceitar`) e o traduz para "Firefox", "Chrome", "app da Mesa (WebKit)" ou "outro navegador".
- **Protocolo:** `registrar` ganha `armazenamento?: string` (opcional, para clientes antigos). A lista que vai ao MCP ganha, por app, `{ armazenamento, onde }`, da aba que vale (a última com foco).
- **MCP:**
  - `ponte_estado` lista os apps com o lugar de cada um ("mesa: Firefox; atlas: app da Mesa") e, se há mais de um armazenamento entre os apps que valem, diz claramente: "Mesa e Atlas estão em lugares com dados separados: …; feche um deles".
  - Todo resultado de ferramenta ganha, no início, a mesma linha de aviso enquanto os armazenamentos estiverem misturados. O Claude pode não chamar `ponte_estado`, então o aviso vai junto do resultado.
- **Instruções:** em "Antes de construir", chamar `ponte_estado` no começo da conversa e, diante do aviso, parar e pedir ao mestre para usar um lugar só, dizendo qual app está em qual lugar.
Não fazer: bloquear chamadas (o aviso basta) nem tentar sincronizar dados entre lugares.
Testes: dois registros com o mesmo id não avisam; Mesa e Atlas com ids diferentes geram o aviso no `ponte_estado` e no resultado; cliente sem `armazenamento` é tratado como lugar desconhecido, sem aviso falso; o rótulo sai certo para UAs de Firefox, Chrome e WebKitGTK.
Pronto quando: com a Mesa aberta no Firefox e o Atlas no app de desktop, a primeira resposta de qualquer ferramenta traz o aviso com os dois lugares, e o Claude pede para fechar um deles.
Commit: warn when bridge tabs use different storage

### 14.5b — Ponte: catálogo de ferramentas estável  ✅
Objetivo: o app do Claude vê sempre a mesma lista de ferramentas, para que o "sempre permitir" de cada uma valha de vez. Caso real (10/11): o servidor `mesa` mandou 19 `tools/list_changed` num dia (cada aba que abre, fecha ou recarrega some e reaparece na lista), e o app voltou a pedir permissão para ferramentas já liberadas.
Depende de: 14.1c
Ler: `scripts/ponte/mcp.ts` (`criarServidorMcp`, `listarFerramentas`, `chamarFerramenta`, `aoMudar`), `scripts/ponte/servidor.ts` (`lista`, `avisarMcps`), `scripts/ponte/protocolo.ts`.
Arquivos: mudar `scripts/ponte/mcp.ts` e os testes; criar o cache `Atlas/.ponte/ferramentas.json` (fora do git, como o token).
Como:
- **Catálogo que só cresce:** o MCP guarda num cache em disco toda ferramenta que alguma aba já registrou (nome, descrição, esquema, app). O `tools/list` devolve o catálogo inteiro (o cache mais o que está registrado agora), com a versão mais nova de cada ferramenta.
- **Ferramenta sem aba aberta:** a chamada volta erro com o que fazer: "O Atlas não está aberto. Abra-o em http://127.0.0.1:5100/Atlas/ (ou peça mesa_abrir_apps) e tente de novo."
- **`list_changed` só quando o catálogo muda de fato:** ferramenta nova, ou descrição ou esquema diferente. Abrir, fechar ou recarregar abas não notifica.
- **Anotações MCP:** `readOnlyHint: true` nas ferramentas de leitura (as que terminam em `_ler`, `_listar`, `_o_que_vejo`, `_ver_mapa`, `campanha_*`, `ponte_estado`, `mesa_campanha_atual`) e `destructiveHint: false` nas de criar. Os apps que agrupam permissões por tipo passam a separar leitura de escrita.
- **Ferramenta removida do código:** sai do cache quando o app dela se registra sem ela.
Não fazer: mudar o protocolo das abas.
Testes: abrir e fechar a aba do Atlas não muda o `tools/list` nem notifica; uma ferramenta nova notifica uma vez; chamar uma ferramenta de app fechado devolve o erro com o endereço; o cache sobrevive a reiniciar o MCP; ferramenta que o app deixou de registrar sai.
Pronto quando: depois de liberar as ferramentas uma vez, fechar e reabrir as abas (e reiniciar o `mesa-dev`) não faz o app do Claude pedir permissão de novo.
Commit: stable tool catalog for the mcp server
