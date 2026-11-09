# Fase 13 — Momentos e Barra de Efeitos

"Direção de cena num botão." Uma cena do Jukebox junta faixas; um **Momento** junta **tudo** o que a mesa sabe fazer, em sequência e com tempo: silêncio, um efeito sonoro, a tela dos jogadores escurece, as luzes piscam, o clima vira tempestade, a câmera do projetor corre para o porão, a porta se abre sozinha, entra o letreiro com o retrato e o nome da criatura. O mestre prepara antes e dispara na hora: pelo painel, por uma região de gatilho ou por uma tecla.

A **Barra de Efeitos** é o lado improvisado: nove espaços (teclas 1–9 no modo Sessão) com um efeito avulso ou um Momento inteiro em cada um, para responder ao que os jogadores fazem sem abrir menu nenhum.

Referência de tom: as sessões de Ordem Paranormal: cortes secos, silêncio antes do susto, apresentação de criatura com letreiro.

## Decisões

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Onde o Momento mora | No **documento do mapa** (`moments`, documento **v8**) | Os passos apontam para coisas do mapa (cômodos, portas, regiões, peças). Exportar o mapa leva os momentos junto. |
| Modelo de tempo | **Lista em ordem**; só o passo `esperar` segura o tempo; os outros disparam e seguem | É o que o mestre entende sem linha do tempo. Durações visuais (letreiro, tela) não bloqueiam. |
| Histórico | Passos que mudam o mapa (clima, revelar, interagir) entram no histórico como hoje, um por passo | Agrupar exigiria gesto aberto durante as esperas; não vale a complexidade agora. |
| Segurança | **Esc** ou **■** cancela o momento em curso **e limpa** tela escura e letreiro no projetor | O mestre nunca fica com a tela dos jogadores presa no preto. |
| O que os jogadores veem | `moments` é **removido** do documento projetado (`projetarParaJogadores`) | Os textos dos letreiros e notas são do mestre até serem disparados. |
| Barra de Efeitos | **Por aparelho** (`localStorage`), não por mapa; um espaço de Momento aponta para o id no mapa aberto e fica apagado se o mapa não tem esse momento | É a ferramenta de improviso do mestre, a mesma em todos os mapas. |
| Executor único | Barra, painel e gatilho chamam o **mesmo** `executarPasso`/`tocarMomento` | Um efeito se comporta igual venha de onde vier. |
| Silenciar a música | Fica para a 13.6 (🔒 muda o Jukebox e o `mesa-core`) | Até lá, o mestre usa uma cena vazia do Jukebox como "silêncio". |

Pré-requisito: a **12.11** (correções dos gatilhos e do projetor) aplicada, porque a 13.3b usa o modo de disparo dos gatilhos e a saída `dispararEfeito` com todos os eventos de cena.

## Tarefas

| Ficha | Título | Depende de |
| --- | --- | --- |
| 13.1a | Domínio: tipo `Momento`, documento v8 e comandos | 12.11 |
| 13.1b | Executor de momentos e saídas no app | 13.1a |
| 13.2a | Projetor: cortina preta e letreiro de apresentação | 13.1b |
| 13.3a | Painel Momentos no Dock e editor de passos | 13.1b, 13.2a |
| 13.3b | Região de gatilho dispara um momento | 13.3a |
| 13.4a | Barra de Efeitos: modelo, persistência e teclas 1–9 | 13.1b |
| 13.4b | Barra de Efeitos: a barra na tela e a configuração dos espaços | 13.4a, 13.3a |
| 13.5 | Tutorial "Momentos e improviso" | 13.3b, 13.4b |
| 13.6 | 🔒 `jukebox.parar` (silêncio com fade) | autorização do usuário |
| 13.7 | Mesa: a cena da campanha dispara um momento (`atlas.momento`) | 13.3a; só lista |

---

### 13.1a — Domínio: tipo `Momento`, documento v8 e comandos  ✅
Objetivo: o mapa guarda momentos validados e editáveis por comando, com migração 7 → 8.
Depende de: 12.11.
Ler: `src/domain/mapa.ts` (`MapaAtlas`, `criarMapa`, `ClimaSalvo` como modelo de coleção por id); `src/domain/migracoes.ts` (a migração 6 → 7 como modelo); `src/domain/validacao.ts`; `src/state/comandos.ts` (`clima.salvar`/`clima.esquecer` como modelo, `ROTULOS`); `src/render/eventos-de-cena.ts`; `src/domain/projecao.ts` (`projetarParaJogadores`).
Arquivos: criar `src/domain/momentos.ts`, `src/domain/eventos-de-cena.ts`, `tests/unit/momentos.test.ts`; mudar `mapa.ts`, `migracoes.ts`, `validacao.ts`, `comandos.ts`, `projecao.ts`, `src/render/eventos-de-cena.ts`.
Como:
1. **Eventos de cena no domínio.** Mova `EVENTOS_DE_CENA`, `EventoDeCena` e `ROTULO_DO_EVENTO` para `src/domain/eventos-de-cena.ts` (o `src/domain` não importa render) e reexporte de `src/render/eventos-de-cena.ts` para não mexer nos importadores. `DURACAO_DO_EVENTO_MS` e o resto do render ficam onde estão.
2. **Tipos** em `src/domain/momentos.ts`:
   ```ts
   export type EfeitoDeCena = EventoDeCena | 'relampago';
   export type AlvoDeCamera = { colecao: 'rooms' | 'regions' | 'tokens'; id: string };
   export type PassoDeMomento =
     | { tipo: 'esperar'; ms: number }                                   // 100..120000
     | { tipo: 'som'; ref: Ref }                                         // jukebox cena-sonora ou efeito
     | { tipo: 'efeito'; efeito: EfeitoDeCena }
     | { tipo: 'clima'; clima: string }                                  // id de predefinição ou de customClimates
     | { tipo: 'tela'; acao: 'escurecer' | 'clarear'; ms: number }      // fade da cortina preta no projetor, 0..10000
     | { tipo: 'letreiro'; titulo: string; subtitulo: string; peca: string | null; estilo: 'apresentacao' | 'capitulo'; ms: number } // ms 1000..20000
     | { tipo: 'camera'; alvo: AlvoDeCamera }
     | { tipo: 'revelar'; ids: string[] }                                // ids de cômodos (comando sessao.revelar)
     | { tipo: 'interagir'; id: string }                                 // porta/interagível (comando interagir)
     | { tipo: 'pista'; ref: Ref; mostrar: boolean }                     // documento do Ateliê; mostrar = já projeta
     | { tipo: 'nota'; texto: string };                                  // aviso só para o mestre, ≤ 400
   export interface Momento { id: string; nome: string; cor: string | null; passos: PassoDeMomento[] } // nome ≤ 60, ≤ 60 passos
   ```
   Funções puras: `novoMomento(id, nome)`; `duracaoEstimada(m): number` (soma dos `esperar`, mais o fim do último letreiro/tela a partir do seu instante); `descreverPasso(p, mapa): string` (texto curto em português para a lista, ex. "Esperar 1,5 s", "Efeito: Tremor", "Letreiro: Kian", usando nomes de cômodo/peça do mapa quando houver, e "(sumiu)" quando o alvo não existe mais); `passoValido(p): string | null` e `momentoValido(m): string | null` (mensagem do primeiro erro).
3. **Documento v8.** `VERSAO_MAPA = 8`, `MapaAtlas.moments: Record<string, Momento>`, `criarMapa` com `moments: {}`; migração 7 → 8 adiciona `moments: {}`; a validação usa `momentoValido` em cada entrada e confere `id` igual à chave.
4. **Comandos**: `{ tipo: 'momento.salvar'; momento: Momento }` (cria ou substitui; recusa com `nao(...)` se `momentoValido` falhar) e `{ tipo: 'momento.remover'; id: string }`. Rótulos "Salvar momento" e "Remover momento". `moments` **não** entra em `COLECOES` (não é selecionável no mapa).
5. **Projeção**: `projetarParaJogadores` devolve `moments: {}`.
Não fazer: executar passos, UI, projetor.
Testes: migração 7 → 8; validação aceita um momento com todos os tipos de passo e recusa `ms` fora da faixa, `tipo` desconhecido, `titulo` vazio no letreiro, `ref` de outro app no `som`; comandos salvar/remover e histórico; `duracaoEstimada`; `descreverPasso` com alvo sumido; projeção sem momentos. Ajustar testes que fixam `VERSAO_MAPA`.
Pronto quando: typecheck e testes passando; um mapa v7 abre e grava como v8 sem perder nada.
Commit: `moments in the map document`

---

### 13.1b — Executor de momentos e saídas no app  ✅
Objetivo: tocar um momento passo a passo, com cancelamento, e ligar cada passo ao que o Atlas já sabe fazer.
Depende de: 13.1a.
Ler: `src/app/regioes.ts` (`SaidasDeRegiao`: o modelo de saídas injetadas); em `src/app/app.ts`: `iniciarRegioes(...)` com as saídas (~l. 294), `aplicarClima`, `dispararEventoDeCena`, `relampagoNoProjetor`; `src/app/audio-do-clima.ts` (`pedirCena`, pedido `jukebox.efeito`); `src/app/inspecao.ts` (`abrirInspecao`, `mostrandoAosJogadores`); `src/app/projetor.ts` (`caixaDoProjetor`, `ajustarAoAspecto`, `aspectoDoProjetor`, `seguirJogadores`); `src/fx/som.ts` (`trovao`).
Arquivos: criar `src/app/momentos.ts`, `tests/unit/executor-momentos.test.ts`; mudar `src/app/app.ts`.
Como:
1. Em `src/app/momentos.ts`:
   ```ts
   export interface SaidasDeMomento {
     som(ref: Ref): void; efeito(e: EfeitoDeCena): void; clima(id: string): void;
     tela(acao: 'escurecer' | 'clarear', ms: number): void;
     letreiro(l: Extract<PassoDeMomento, { tipo: 'letreiro' }> | null): void;   // null = tira da tela
     camera(alvo: AlvoDeCamera): void; revelar(ids: string[]): void; interagir(id: string): void;
     pista(ref: Ref, mostrar: boolean): void; nota(texto: string): void;
   }
   export interface Relogio { esperar(ms: number, sinal: AbortSignal): Promise<void> }
   export const momentoEmCurso = signal<{ mapaId: string; id: string; nome: string; passo: number; total: number } | null>(null);
   export function executarPasso(p: PassoDeMomento, saidas: SaidasDeMomento): void;           // passo instantâneo; `esperar` é ignorado aqui
   export async function tocarMomento(mapaId: string, m: Momento, saidas: SaidasDeMomento, relogio?: Relogio): Promise<'fim' | 'cancelado'>;
   export function pararMomento(): void;   // aborta o em curso; chama saidas.tela('clarear', 300) e saidas.letreiro(null) se o momento escureceu a tela ou pôs letreiro
   ```
   Um momento por vez: tocar outro cancela o atual antes. Cada passo roda em `try/catch` (um passo quebrado avisa no console e o momento segue). `momentoEmCurso` avança a cada passo e volta a `null` no fim ou no cancelamento. O relógio padrão usa `setTimeout` com `AbortSignal`.
2. Em `app.ts`, uma função `saidasDeMomento(s)` que liga cada saída: `som` → `jukebox.tocar` para `cena-sonora` ou `jukebox.efeito` para `efeito` (reaproveitar `pedirCena` e o pedido de efeito de `audio-do-clima.ts`); `efeito` → o mesmo caminho da saída `dispararEfeito` dos gatilhos (relâmpago, tremor com `trovao(1.2)`, demais eventos por `dispararEventoDeCena`), **extraído para uma função única** que os gatilhos também passam a usar; `clima` → `aplicarClima`; `camera` → caixa do alvo (cômodo: caixa das células; região: caixa do polígono; peça: caixa de 6 × 6 células em volta) ajustada com `ajustarAoAspecto(..., aspectoDoProjetor.peek())`, desligando `seguirJogadores` e gravando em `caixaDoProjetor`; `revelar` → `store.executar({ tipo: 'sessao.revelar', ids })` só com ids que existem; `interagir` → `store.executar({ tipo: 'interagir', id })` se existe; `pista` → `abrirInspecao(ref)` e, se `mostrar`, o mesmo caminho do botão "Mostrar aos jogadores" da inspeção; `nota` → `avisar(texto, { duracao: 5000 })`. `tela` e `letreiro` chamam o publicador (`publicador?.tela(...)` / `publicador?.letreiro(...)`) que a 13.2a cria: **nesta tarefa** deixe as duas saídas como `console.debug` com um comentário `// 13.2a`.
3. Exporte de `app.ts`: `tocarMomentoDoMapa(id: string)` (pega o momento do mapa aberto; avisa "Momento não encontrado neste mapa." se não houver) e `executarPassoAvulso(p)`.
4. Atalho: **Esc** no modo Sessão com `momentoEmCurso` não nulo chama `pararMomento()` antes de qualquer outra coisa que o Esc faça (ver como `src/app/acoes.ts` trata teclas).
Não fazer: UI de painel, mensagens novas do projetor, barra de efeitos.
Testes: com um relógio falso (resolve na hora e registra os `ms`): ordem dos passos e das esperas; `esperar` não chama saída; cancelar no meio para os passos seguintes, limpa a tela e o letreiro só quando foram usados e devolve `'cancelado'`; tocar um segundo momento cancela o primeiro; passo que lança erro não interrompe o resto; `momentoEmCurso` acompanha o passo e zera no fim.
Pronto quando: pela paleta/console, um momento salvo com efeito + esperar + clima + nota toca na ordem e o Esc o interrompe.
Commit: `moment player with cancel`

---

### 13.2a — Projetor: cortina preta e letreiro de apresentação  ✅
Objetivo: os dois passos visuais que só existem no projetor: o corte para o preto e a apresentação de personagem.
Depende de: 13.1b.
Ler: `src/app/projetor.ts` (`MensagemDoMestre`, `Publicador`, `iniciarPublicacao`, envio de retratos); `src/ui/Projetor.tsx` (`tratarMensagem`, `retratos`, overlays como a inspeção e `flutuarRolagem`); `docs/INTERFACE.md` (tema Vigília, tokens de cor e tipografia); `src/ui/estilo.css` (seção do projetor).
Arquivos: criar `src/ui/LetreiroDoProjetor.tsx`; mudar `src/app/projetor.ts`, `src/ui/Projetor.tsx`, `src/app/app.ts` (trocar os `console.debug` da 13.1b), `src/ui/estilo.css`, `tests/unit/projetor.test.ts`.
Como:
1. Mensagens novas: `{ tipo: 'tela'; acao: 'escurecer' | 'clarear'; ms: number }` e `{ tipo: 'letreiro'; titulo: string; subtitulo: string; estilo: 'apresentacao' | 'capitulo'; retrato: string | null; ms: number } | { tipo: 'letreiro-fim' }`. `retrato` é o id do asset do retrato da peça (`peca.portrait`); o publicador garante que o blob do retrato foi enviado antes (o mesmo mecanismo `retrato` que as peças usam).
2. `Publicador` ganha `tela(acao, ms)` e `letreiro(l | null)`, com o mesmo cuidado de `projetorConectado` dos outros métodos. Guardar o último estado de `tela` e reenviá-lo no `ola` (projetor que reabre no meio de um corte continua no preto).
3. **Cortina**: uma `div` fixa sobre o canvas no projetor, preto puro, `opacity` com `transition` de `ms` (0 = corte seco). Fica acima do mapa e abaixo do letreiro.
4. **Letreiro** (`LetreiroDoProjetor.tsx`): estilo `apresentacao`: retrato grande à esquerda (recorte retangular com grão e vinheta), nome em caixa alta grande, subtítulo menor, um traço de acento na cor de destaque do tema; entra com um corte de 1–2 quadros de "glitch" (deslocamento horizontal e separação de cor com `clip-path`/`transform`, 180 ms) e sai com fade. `capitulo`: só texto centralizado, título grande e subtítulo, fundo escurecido, para "Capítulo 3 — O Porão". Some sozinho após `ms`; `letreiro-fim` tira na hora. Com `prefers-reduced-motion`, sem glitch, só fade. Letras grandes o bastante para ler de longe (título ≥ 6vw).
5. No **mestre**, nada aparece sobre o mapa; o Dock mostrará o estado (13.3a). Expor `telaEscura = signal(false)` em `projetor.ts` para isso.
Não fazer: editor de passos; animações por canvas/Pixi (é DOM sobre o canvas).
Testes: unitário do publicador: `tela` e `letreiro` só enviam com projetor conectado; o retrato é enviado antes do letreiro; `ola` reenvia a cortina escura. Captura e2e opcional em `tests/e2e/fase13-letreiro.test.ts` (projetor com cortina a meio e letreiro de apresentação) se o padrão das outras capturas de projetor permitir sem muito custo.
Pronto quando: um momento "escurecer 800 ms → esperar 1 s → letreiro da peça X → esperar 4 s → clarear 1 s" roda no projetor como descrito e o Esc devolve a imagem.
Commit: `projector blackout and title cards`

---

### 13.3a — Painel Momentos no Dock e editor de passos  ✅
Objetivo: o mestre cria, edita, testa e dispara momentos sem sair do mapa.
Depende de: 13.1b, 13.2a.
Ler: `src/ui/Dock.tsx` (seções `SecaoDeCena`, `SecaoDoProjetor`, `PainelFlutuante`); `src/ui/Inspetor.tsx` (`CampoOpcoes`, `CampoTexto`, `CamposDaRegiao` como modelo de campos); `src/ui/EscolherCena.tsx` (com `tipo='efeito'` para efeitos avulsos); `src/app/dock.ts`.
Arquivos: criar `src/ui/Momentos.tsx` (seção do Dock + editor), `tests/unit/momentos-ui.test.ts` (só as funções puras que a UI usar: mover passo, duplicar, etc., se ficarem em `src/domain/momentos.ts`); mudar `src/ui/Dock.tsx`, `src/ui/estilo.css`, `src/domain/momentos.ts` (funções puras de edição), `src/app/acoes.ts` (ação na paleta "Tocar momento: <nome>" para cada momento do mapa).
Como:
1. **Seção "Momentos" no Dock** (modo Sessão e Construir): lista dos momentos do mapa com a cor, o nome, a duração estimada e um botão ▶; o que está em curso mostra ■, a barra de progresso (`passo/total`) e o nome do passo atual. Uma pílula "Tela escura · Clarear" aparece enquanto `telaEscura` estiver ligado. Botão "+ Novo momento".
2. **Editor** num `PainelFlutuante` (ou no mesmo padrão de painel do Dock): nome, cor (6 amostras do tema), e a lista de passos. Cada passo é uma linha com ícone, `descreverPasso` e ações ↑ ↓ duplicar remover; clicar abre os campos do tipo logo abaixo. "+ Passo" abre um menu com os tipos agrupados: **Tempo** (esperar), **Som** (cena do Jukebox, efeito do Jukebox), **Mapa** (efeito de cena, clima, câmera, revelar cômodo, abrir porta/usar), **Projetor** (cortina, letreiro), **Mestre** (pista, nota). Campos: `esperar` com atalhos 0,5/1/2/5 s e campo numérico; `som` com `EscolherCena` (`tipo` cena ou efeito); `camera`/`revelar`/`interagir`/`letreiro.peca` com seletor dos itens do mapa por nome (e um botão "usar a seleção atual" que pega o cômodo/peça/porta selecionado no mapa); `pista` com a lista de pistas do mapa (`src/app/pistas.ts`).
3. Gravar: o editor trabalha numa cópia local e salva com `momento.salvar` ao clicar "Salvar" (um passo de histórico); "Testar" toca a cópia local sem salvar (`tocarMomento`), "Excluir" pede confirmação.
4. Passos com alvo sumido aparecem com o aviso do `descreverPasso` e destacados.
Não fazer: gatilho de região; barra de efeitos.
Testes: funções puras de edição (mover passo, duplicar, remover) e a ação da paleta listando os momentos do mapa.
Pronto quando: dá para montar o momento da 13.2a só pela interface, testar, salvar, fechar e reabrir o mapa com ele lá.
Commit: `moments panel and step editor`

---

### 13.3b — Região de gatilho dispara um momento  ✅
Objetivo: entrar numa região toca um momento inteiro.
Depende de: 13.3a.
Ler: `src/app/regioes.ts` (depois da 12.11: modos de disparo, `SaidasDeRegiao`); `src/ui/Inspetor.tsx` (`CamposDaRegiao`).
Arquivos: mudar `src/app/regioes.ts`, `src/app/app.ts`, `src/ui/Inspetor.tsx`, `tests/unit/regioes.test.ts`.
Como: `payload.momento?: string` na região de gatilho; `SaidasDeRegiao.tocarMomento?(id)`; no disparo (respeitando o modo da 12.11), o momento roda **depois** das ações simples do gatilho (texto, clima, efeito, cena). No Inspetor, "Momento" com a lista dos momentos do mapa ("Nenhum" por padrão) e um ▶ para testar. Se o momento foi apagado, o gatilho ignora e o Inspetor mostra "(momento removido)".
Não fazer: tirar os campos simples do gatilho (eles continuam para o caso rápido).
Testes: gatilho com momento chama `tocarMomento` uma vez por disparo, na ordem certa; momento inexistente não quebra.
Pronto quando: andar uma peça de jogador para dentro da região toca o momento no mestre e no projetor.
Commit: `trigger regions play moments`

---

### 13.4a — Barra de Efeitos: modelo, persistência e teclas 1–9  ⬜
Objetivo: nove espaços configuráveis disparados pelo teclado na sessão.
Depende de: 13.1b.
Ler: `src/app/acoes.ts` (atalhos `1`–`9` das ferramentas, `noEditor`, `executarAcao`, tratamento de teclas); `src/app/modo.ts`; `src/domain/relogio.ts` (persistência em `localStorage` com `try/catch`).
Arquivos: criar `src/domain/barra-de-efeitos.ts`, `src/app/barra-de-efeitos.ts`, `tests/unit/barra-de-efeitos.test.ts`; mudar `src/app/acoes.ts`.
Como:
1. Domínio puro:
   ```ts
   export type AcaoDoEspaco = { tipo: 'passo'; passo: PassoDeMomento } | { tipo: 'momento'; id: string };
   export interface EspacoDaBarra { rotulo: string; acao: AcaoDoEspaco }
   export type BarraDeEfeitos = (EspacoDaBarra | null)[];   // sempre 9
   export const BARRA_PADRAO: BarraDeEfeitos;   // 1 Relâmpago, 2 Tremor, 3 Luzes piscam, 4 Escurecer, 5 Clarão, 6–9 vazios
   export function lerBarra(bruto: unknown): BarraDeEfeitos;   // tolerante: completa até 9, descarta inválidos (usa passoValido)
   ```
   `esperar` não é aceito como passo de espaço.
2. App: `barraDeEfeitos = signal(...)` lida de `localStorage['atlas:barra-de-efeitos']`; `definirEspaco(i, e | null)`, `trocarEspacos(a, b)`; `dispararEspaco(i)`: `passo` → `executarPassoAvulso`; `momento` → `tocarMomentoDoMapa(id)`, ou aviso "Este momento não existe neste mapa." Um `ultimoDisparo = signal<{ i: number; quando: number } | null>` para a barra piscar.
3. Teclas: no modo **Sessão**, `1`–`9` disparam o espaço; as ferramentas por número continuam só no modo **Construir** (as letras V, H, C… seguem valendo nos dois). Conferir na tabela de atalhos (`?`/F1) que o texto mostra isso. Não disparar com foco em campo de texto (o tratamento de teclas já deve ignorar; conferir).
Não fazer: a barra visual e o editor dos espaços.
Testes: `lerBarra` com lixo, com menos e mais de 9, com passo inválido; `BARRA_PADRAO` válida; `dispararEspaco` chama o executor certo (saídas falsas) e avisa quando o momento não existe; teclas 1–9 resolvem para espaço na Sessão e para ferramenta no Construir.
Pronto quando: na sessão, apertar 2 faz o tremor no mestre e no projetor.
Commit: `effects hotbar keys`

---

### 13.4b — Barra de Efeitos: a barra na tela e a configuração dos espaços  ⬜
Objetivo: ver, disparar e configurar os nove espaços com o mouse.
Depende de: 13.4a, 13.3a (reaproveita os campos de passo do editor).
Ler: `src/ui/BarraInferior.tsx` (posição e estilo da barra flutuante do pé do mapa); `src/ui/Momentos.tsx` (campos por tipo de passo).
Arquivos: criar `src/ui/BarraDeEfeitos.tsx`; mudar `src/ui/Editor.tsx` (ou onde a `BarraInferior` é montada), `src/ui/Momentos.tsx` (exportar os campos de passo para reuso), `src/ui/estilo.css`.
Como: no modo Sessão, uma fileira de 9 botões quadrados logo acima da `BarraInferior`, recolhível (lembrar em `localStorage`). Cada botão mostra o número, um ícone pelo tipo e o rótulo curto; vazio aparece tracejado com "+". Clique dispara; o botão pisca com `ultimoDisparo`; um espaço de momento em curso mostra o progresso. Clique direito (ou o lápis ao passar o mouse) abre um popover: rótulo, tipo (efeito de cena, som do Jukebox, clima, cortina, letreiro, nota, momento do mapa) e os campos do tipo (os mesmos do editor de momentos); "Limpar espaço". Arrastar um botão sobre outro troca os dois. Não cobre a `BarraInferior` nem o Dock em 1280 × 720.
Não fazer: barras por mapa ou várias páginas de barra.
Testes: unitários do que for puro; captura e2e opcional `tests/e2e/fase13-barra.test.ts`.
Pronto quando: dá para trocar o espaço 6 para o efeito "Grito" do Jukebox pela barra e dispará-lo com a tecla 6.
Commit: `effects hotbar ui`

---

### 13.5 — Tutorial "Momentos e improviso"  ⬜
Objetivo: uma lição na pasta **Na mesa** que ensina a montar e disparar um momento e a usar a barra.
Depende de: 13.3b, 13.4b.
Ler: `src/tutorial/licoes.ts` (`regioes` como modelo), `src/tutorial/condicoes.ts`, `src/tutorial/tutor.ts`.
Arquivos: mudar `licoes.ts`, `condicoes.ts` e os testes de tutoriais existentes.
Como: lição `momentos` (≈ 5 min, depois de `regioes`) num mapa pequeno com um corredor e um porão: (1) criar o momento "O porão acorda" (cortina 600 ms, esperar 1 s, efeito Tremor, clima Apagão, letreiro de capítulo, clarear); (2) testar com ▶; (3) ligar o momento a uma região de gatilho na escada; (4) andar a peça e ver disparar; (5) disparar o espaço 3 da barra. Cada passo marca onde clicar e tem condição verificável no documento ou nos signals (`momentoEmCurso`, `ultimoDisparo`). O resultado tem de ficar bonito e fiel ao que a lição descreve.
Pronto quando: a lição roda do começo ao fim e as condições avançam sozinhas.
Commit: `moments tutorial`

---

### 13.6 — 🔒 `jukebox.parar` (silêncio com fade)  ⬜
**Precisa de autorização do usuário** (muda o Jukebox e o contrato do `mesa-core`).
Objetivo: um passo "Silêncio" que abaixa a música até parar em N ms, para o silêncio antes do susto.
Como (resumo, detalhar ao autorizar): pedido `jukebox.parar` `{ ms?: number }` no catálogo do `mesa-core` (aditivo; `npm run build:core` e cópia para os `vendor/`); o Jukebox atende com fade de volume de todas as faixas tocando e pausa ao fim; manifesto do Jukebox com `atende`; no Atlas, passo `{ tipo: 'silencio'; ms }` (documento continua v8: o tipo de passo é aditivo na validação).
Commit: `jukebox fade to silence`

---

### 13.7 — Mesa: a cena da campanha dispara um momento  ⬜ (só lista)
A cena/encontro da Mesa ganha um "Momento de abertura": pedido `atlas.momento` `{ mapa: Ref, momento: string }` atendido pelo Atlas (abre o mapa se preciso e toca). Detalhar depois da 13.3a, contra o código da Mesa.
