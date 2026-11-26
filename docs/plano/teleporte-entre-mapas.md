# Frente T — Vínculo de Portas e Escadas com Teleporte entre Mapas (Sub-mapas)

Planejada em 2026-11-21. O objetivo é permitir que uma porta, arco, escada ou alçapão em um mapa do Atlas seja vinculado a outro mapa/lugar da campanha (e a uma porta, escada, andar ou coordenada específica de chegada). No modo Sessão, clicar na ação de transição (ou no ícone de passagem) abre ou alterna a aba para o mapa de destino já centralizado na entrada correspondente, podendo levar as peças dos jogadores junto e atualizar o projetor.

## Problema

- **Escadas hoje são só intra-mapa (`Frente H`).** `Interacao.kind === 'stairs'` tem `toLevel?: string | null` e `toPosition?: Ponto`, mas só funciona entre andares do **mesmo** documento `MapaAtlas`.
- **Portas (`Abertura`) não têm vínculo de transição.** Em campanhas com um mapa de região/rua e sub-mapas de interiores (ex.: a rua do porto e o interior da taverna, ou a entrada de uma caverna e a masmorra subterrânea), o mestre precisa procurar o outro mapa na galeria/abas, abri-lo, posicionar a câmera e recriar as peças dos jogadores lá.

## Decisões

1. **Vínculo de transição (`TransicaoDeMapa`) unificado para Aberturas e Objetos.**
   - `TransicaoDeMapa = { toMapId: string; toLevel?: string | null; toTargetId?: string | null; toPosition?: Ponto; label?: string }`.
   - `Abertura` ganha `transition?: TransicaoDeMapa | null`.
   - `Interacao` (em `Objeto`, como escadas, alçapões, portais, bueiros) ganha `toMapId?: string | null` e `toTargetId?: string | null` (reaproveitando `toLevel` e `toPosition` já existentes em `Interacao`).
2. **Alvo de chegada resiliente.**
   - O mestre escolhe primeiro o **Mapa de destino** (listando os mapas do repositório do Atlas e os lugares da campanha ativa).
   - Opcionalmente, escolhe a **Entrada de chegada** no mapa de destino (qualquer porta, escada ou alçapão daquele mapa, carregado sob demanda de `repo.obter(toMapId)`), ou o andar/coordenada. Se a entrada de chegada for apagada depois, o teleporte cai em `toPosition` ou no centro do mapa de destino sem quebrar.
   - Botão **"Vincular caminho de volta"** no Inspetor: grava automaticamente na porta/escada de destino do outro mapa a transição inversa apontando para esta porta/escada.
3. **Como funciona no Modo Construir e no Modo Sessão:**
   - **Construir:** clicar com botão direito numa porta, escada ou alçapão mostra no `MenuRadial` a ação **"Vincular a outro mapa…"** (que seleciona o item e foca o bloco de vínculo no `Inspetor`). O mapa desenha um selo discreto de transição (`↗`) sobre portas/escadas vinculadas (visível só para o mestre).
   - **Sessão:**
     - No `CartaoContextual`, no `MenuRadial` (ao clicar com botão direito na porta/escada ou numa peça a até 1,5 m dela) e ao clicar no marcador `↗` da transição, aparece **"Ir para `<Nome do mapa>`"** (e **"Levar jogadores para `<Nome do mapa>`"** quando houver peças de jogador no mapa atual).
     - Ao acionar: o Atlas abre o mapa de destino (ou muda para a aba dele se já estiver aberto), muda para o `toLevel` correspondente, centraliza a câmera na entrada de chegada (`toTargetId` / `toPosition`), transfere opcionalmente as peças de jogador (`player: true`) posicionando-as ao redor da entrada de chegada e atualiza o projetor (`mapaNoProjetorId`).

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| T1 | Modelo, validação e resolução de chegada entre mapas | domínio |
| T2 | Inspetor e menu radial: vincular porta/escada a outro mapa e criar vínculo de volta | comandos + interface |
| T3 | Marcador visual no mapa e ação de transição na Sessão (troca de aba, câmera e peças) | render + sessão |
| T4 | Ponte MCP: vincular sub-mapas pelo assistente | ponte + testes |

Ordem: T1 → T2 → T3 → T4.

---

### T1 — Modelo, validação e resolução de chegada entre mapas  ✅
Objetivo: `Abertura` e `Interacao` guardam vínculos para outros mapas, com validação e cálculo puro do ponto de chegada.
Depende de: —.
Ler: `src/domain/mapa.ts` (`Abertura`, `Interacao`, `Objeto`), `src/domain/validacao.ts`, `src/domain/andares.ts` (`acaoEscadaParaPeca`, `escadasPerto`), `src/domain/interacao.ts` (`interagiveisPerto`), `src/domain/geometria.ts` (`centroDaAbertura`, `pontoNaParede`).
Arquivos: mudar `src/domain/mapa.ts`, `src/domain/validacao.ts`; criar `src/domain/transicao-mapa.ts` e `tests/unit/transicao-mapa.test.ts`.
Como:
1. Em `src/domain/mapa.ts`:
   - `export interface TransicaoDeMapa { toMapId: string; toLevel?: string | null; toTargetId?: string | null; toPosition?: Ponto; label?: string }`.
   - Em `Abertura`: `transition?: TransicaoDeMapa | null`.
   - Em `Interacao`: `toMapId?: string | null; toTargetId?: string | null` (quando `kind === 'stairs'` e `toMapId` está definido, `toLevel` pode ser qualquer andar do mapa de destino ou `null`, não sendo proibido ser igual ao andar de origem).
2. Em `src/domain/validacao.ts`:
   - Validar `Abertura.transition` (`toMapId` string não vazia; `toLevel`, `toTargetId`, `label` strings opcionais; `toPosition` par finito).
   - Em `Interacao` com `kind === 'stairs'`: quando `toMapId` está presente (string não vazia), aceitar qualquer `toLevel` (`string | null | undefined`) sem exigir que exista em `m.levels` do mapa de origem.
3. Em `src/domain/transicao-mapa.ts`:
   - `entradasDeTransicao(m: MapaAtlas): { id: string; colecao: 'openings' | 'props'; nome: string; levelId: string | null; posicao: Ponto }[]`: lista todas as portas/arcos (`openings`) e escadas/alçapões (`props`) de um mapa com suas coordenadas em metros e andar.
   - `resolverChegada(destino: MapaAtlas, transicao: TransicaoDeMapa): { levelId: string | null; posicao: Ponto; alvoId: string | null }`: se `toTargetId` existir em `destino.openings` ou `destino.props`, devolve a posição e o andar desse alvo (com um deslocamento de 0,9 m para dentro do cômodo/piso no caso de porta); senão usa `toPosition` e `toLevel ?? null`; se nada disso existir, devolve o centro de `destino.bounds` no térreo.
   - `posicoesDeChegadaDasPecas(destino: MapaAtlas, centro: Ponto, n: number): Ponto[]`: distribui `n` peças de jogador em formação compacta ao redor de `centro` (respeitando `destino.bounds` e `destino.grid.size`).
   - `transicaoPertoDaPeca(m: MapaAtlas, peca: Pick<Peca, 'position' | 'facing' | 'levelId'>): { colecao: 'openings' | 'props'; id: string; transicao: TransicaoDeMapa } | null`: encontra a porta ou escada vinculada a outro mapa a até 1,5 m da peça no mesmo andar.
Não fazer: interface e troca de aba (T2 e T3).
Testes: validação aceita `transition` em abertura e `toMapId` em escada (mesmo num mapa de 1 só andar!); `resolverChegada` acha porta, acha escada, faz fallback para `toPosition` e para o centro; `transicaoPertoDaPeca` encontra porta e escada próximas.
Pronto quando: `npm run typecheck` e `npm test` passam.
Commit: `(feature) domain model and arrival resolver for cross-map transitions`
Nota: Entregue `TransicaoDeMapa` em `Abertura.transition` e `toMapId`/`toTargetId` em `Interacao`, validação de esquema e relaxamento de `toLevel` para escadas inter-mapas, mais `src/domain/transicao-mapa.ts` (`entradasDeTransicao`, `resolverChegada`, `posicoesDeChegadaDasPecas`, `transicaoPertoDaPeca`, `transicaoDaAbertura`, `transicaoDoObjeto`) com 5 testes unitários em `tests/unit/transicao-mapa.test.ts`.

---

### T2 — Inspetor e menu radial: vincular porta/escada a outro mapa e vínculo de volta  ✅
Objetivo: o mestre vincula uma porta, escada ou alçapão a outro mapa da campanha pelo botão direito ou pelo Inspetor, podendo criar o vínculo de volta com um clique.
Depende de: T1.
Ler: `src/ui/Inspetor.tsx` (`CamposDaAbertura`, `InteracaoDoObjeto`), `src/app/acoes.ts` (`itensDoMenuRadial`), `src/app/app.ts` (`resumos`, `servicos`), `src/app/modo.ts` (`abaDoInspetor`).
Arquivos: mudar `src/ui/Inspetor.tsx`, `src/app/acoes.ts`; criar `src/ui/BlocoTransicaoDeMapa.tsx`; testes.
Como:
1. Criar `src/ui/BlocoTransicaoDeMapa.tsx`:
   - Usado dentro de `CamposDaAbertura` (para `door`, `arch`, `secret`) e `InteracaoDoObjeto` (para objetos de escada/alçapão ou qualquer objeto com interação `stairs` — agora habilitada mesmo em mapas de 1 só andar!).
   - `<select>` **"Leva a outro mapa"**: lista `"Nenhum (mesmo mapa)"` e os outros mapas de `resumos.value` (priorizando os da mesma `campanhaId`).
   - Quando um `toMapId` está selecionado, carrega `servicos.value?.repo.obter(toMapId)` num `useEffect` e exibe:
     - `<select>` **"Entrada de chegada"**: `"Ponto personalizado"` ou qualquer porta/escada de `entradasDeTransicao(mapaDestino)`. Ao escolher uma entrada, preenche `toTargetId`, `toLevel` e `toPosition` automaticamente.
     - Se `"Ponto personalizado"`, mostra `<select>` de Andar do destino (se multiandar) e coordenadas `X` / `Y` (m).
     - Botão **"Vincular caminho de volta"** (quando uma entrada de chegada está escolhida e ela ainda não aponta de volta para `m.id` / `item.id`): abre o mapa de destino via `repo.obter`, grava nele o `transition` (se `openings`) ou `interaction` (se `props`) apontando para `{ toMapId: m.id, toTargetId: item.id, toLevel: andarAtual, toPosition: posAtual }`, salva no repositório e avisa `"Caminho de volta vinculado em <nome do mapa>"`.
2. Em `src/app/acoes.ts` (`itensDoMenuRadial`):
   - No modo Construir, quando `alvo` é uma abertura (`openings`) ou objeto (`props`), incluir o item radial **"Vincular a outro mapa…"** (`id: 'vincular-mapa'`, ícone `'mapa'`), que seleciona o alvo, abre a aba `'selecao'` do Inspetor (`abaDoInspetor.value = 'selecao'`) e foca o seletor `[data-testid="transicao-mapa-destino"]`.
Não fazer: a execução do teleporte na Sessão (T3).
Testes: teste unitário/e2e de vincular uma porta ao Mapa B, escolher a porta de chegada e clicar em "Vincular caminho de volta" (conferindo que o Mapa B salvo no repositório ganhou o vínculo inverso).
Pronto quando: no editor, botão direito numa porta ou escada permite vinculá-la a outro mapa e criar o vínculo recíproco.
Commit: `(feature) link doors and stairs to other campaign maps in inspector and radial menu`
Nota: Criado `src/ui/BlocoTransicaoDeMapa.tsx` integrado a `CamposDaAbertura` (`door`, `arch`, `secret`) e `InteracaoDoObjeto` (habilitando `stairs` mesmo em mapas de 1 andar), comando `abertura.atualizar` estendido com `transition`, item radial `vincular-mapa` com ícone `'mapa'` em `src/app/acoes.ts`, e funções puras `criarTransicaoDeRetorno`, `jaTemVinculoDeVolta` e `aplicarVinculoDeVolta` em `src/domain/transicao-mapa.ts` testadas em `tests/unit/transicao-mapa.test.ts`.

---

### T3 — Marcador visual e teleporte entre mapas na Sessão  ⬜
Objetivo: na Sessão, portas e escadas vinculadas mostram um ícone de transição e permitem abrir o mapa de destino já centralizado na chegada (com ou sem transferência das peças dos jogadores).
Depende de: T1, T2.
Ler: `src/render/cena.ts` (`desenharMarcas`), `src/ui/CartaoContextual.tsx`, `src/app/acoes.ts` (`itensDoMenuRadial`), `src/app/app.ts` (`abrirMapa`, `definirAndarAtivo`, `projetarAba`, `mapaNoProjetorId`, `viewport`), `src/domain/transicao-mapa.ts`.
Arquivos: mudar `src/render/cena.ts`, `src/ui/CartaoContextual.tsx`, `src/app/acoes.ts`, `src/app/app.ts`; testes.
Como:
1. Em `src/render/cena.ts` (`desenharMarcas`):
   - Para toda abertura com `transition?.toMapId` e todo objeto com `interaction?.kind === 'stairs' && interaction.toMapId`, desenhar em `marcasG` (visível apenas para o mestre, não no projetor) um pequeno selo circular turquesa (`0x38bdf8`) com seta de saída (`↗`) na posição da porta/escada.
2. Em `src/app/app.ts`, criar `viajarParaMapa(transicao: TransicaoDeMapa, opcoes?: { levarJogadores?: boolean; pecaId?: string }): Promise<void>`:
   - Carrega o mapa de destino (`repo.obter(transicao.toMapId)`). Se não existir, avisa erro.
   - Se `opcoes?.levarJogadores` for `true`:
     - Coleta as peças `player: true` do mapa atual (ou a peça `pecaId` e demais peças de jogador).
     - Se o mapa de destino ainda não tiver peças com as mesmas `refs` de ficha (ou mesmo `id`/`name`), cria/atualiza as peças de jogador no mapa de destino nas coordenadas de `posicoesDeChegadaDasPecas(destino, chegada.posicao, pecas.length)` e `levelId: chegada.levelId`, gravando no destino.
   - Chama `await abrirMapa(transicao.toMapId)` (que já registra e troca a aba aberta em `abasAbertas`), define o andar ativo para `chegada.levelId`, e centraliza a câmera (`viewport.atual?.focarEm({ x0: x - 6, y0: y - 4, x1: x + 6, y1: y + 4 })`).
   - Se o projetor estava projetando o mapa de origem (ou se `projetorConectado` / `projetorRemotoConectado` estiver ativo), atualiza `mapaNoProjetorId.value = transicao.toMapId` e sincroniza o publicador para que os jogadores vejam o novo mapa imediatamente.
   - Emite `atlas.cena-aberta` no barramento para a Mesa acompanhar se estiver em modo Seguir.
3. Onde o mestre aciona na Sessão:
   - **Cartão Contextual (`CartaoContextual.tsx`)**: ao selecionar uma porta ou escada com `toMapId` na Sessão (ou uma peça de jogador que esteja a até 1,5 m dela via `transicaoPertoDaPeca`), exibe os botões **"↗ Ir para `<Nome do mapa>`"** e **"👥 Levar grupo para `<Nome do mapa>`"**.
   - **Menu Radial (`itensDoMenuRadial` em `acoes.ts`)**: na Sessão, botão direito sobre a porta/escada vinculada ou sobre uma peça perto dela mostra **"Ir para `<Nome do mapa>`"** e **"Levar grupo para `<Nome do mapa>`"**.
Testes: e2e/unitário: vincular Porta A (Mapa 1) à Porta B (Mapa 2); em modo Sessão, acionar "Levar grupo para Mapa 2" → a aba ativa muda para o Mapa 2, o andar e a câmera focam na Porta B e as peças dos jogadores estão posicionadas na chegada.
Pronto quando: clicar na transição no modo Sessão troca para o mapa de destino centralizado na entrada correspondente e leva o grupo.
Commit: `(feature) travel between linked maps from doors and stairs during session`

---

### T4 — Ponte MCP: vincular sub-mapas pelo assistente  ⬜
Objetivo: o assistente pode vincular portas e escadas entre mapas da campanha via ferramentas MCP.
Depende de: T1, T2.
Ler: `src/app/ponte-escrita.ts` (`atlas_portas`, `atlas_objetos`), `src/app/ponte-leitura.ts` (`resumirMapa`), `scripts/ponte/catalogo-base.json`.
Arquivos: mudar `src/app/ponte-escrita.ts`, `src/app/ponte-leitura.ts`, `scripts/ponte/catalogo-base.json`; testes em `tests/unit/ponte-escrita.test.ts`.
Como:
1. Em `atlas_portas`, aceitar `transicao?: { mapa: string; entrada?: string; andar?: string | null; posicao?: [number, number] }` ao criar ou atualizar uma abertura.
2. Em `atlas_objetos`, estender `escada?: { leva?: string | null; mapa?: string; entrada?: string; posicao?: [number, number] }` para aceitar `mapa` e `entrada`.
3. Em `resumirMapa` (`ponte-leitura.ts`), incluir `transicao` nas aberturas e escadas que apontam para outro mapa.
4. Regenerar `scripts/ponte/catalogo-base.json` (`npm run ponte:catalogo`).
Testes: criar porta e escada com `transicao`/`mapa` pela ponte e verificar no resumo do mapa.
Pronto quando: `npm run typecheck` e `npm test` passam e o catálogo está atualizado.
Commit: `(feature) expose cross-map door and stair transitions in mcp bridge`
