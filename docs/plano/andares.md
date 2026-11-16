# Frente H — Andares

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Atlas**. Quem implementa: Gemini. Recomendado depois da frente G (torre redonda de vários andares).

## O que estamos tentando fazer

O mestre perguntou se o Atlas tem múltiplos andares. Não tem: o documento prevê `Comodo.levelId` desde o começo, mas nenhuma outra entidade tem andar e não há interface (`docs/VISAO.md:203`). Hoje cada andar vira um mapa separado ("O Moinho (térreo e andar de cima)"), e uma peça que sobe a escada precisa trocar de mapa.

As referências do mestre mostram por que isso importa: o porão do moinho com o poço e a escada em caracol, a mansão com térreo, andar de cima e telhado, e a nave com vários deques.

**Meta:** um mapa pode ter vários **andares** (porão, térreo, andares de cima). O editor mostra um andar por vez; o mestre troca com um seletor. Cada entidade pertence a um andar. Na sessão, cada peça está num andar, e a visão, a névoa e o explorado são calculados por andar. Uma escada (objeto) liga dois andares, e a peça que a usa muda de andar. O projetor mostra o andar das peças dos jogadores.

## Decisões

- **O andar é um filtro do documento, não um documento novo.** Uma função pura, `mapaDoAndar(m, andarId)`, devolve um `MapaAtlas` só com as entidades daquele andar. O render, a visão, a névoa, a projeção, os telhados e a mobília recebem esse mapa filtrado e funcionam como hoje. É a decisão que deixa a frente pequena: quase nada abaixo do filtro precisa saber de andares.
- **Documento:** `MapaAtlas.levels?: Record<string, Andar>`, com `Andar = { id: string; name: string; order: number }` (`order` 1, 2… acima do térreo; −1, −2… abaixo). **O térreo é o andar `null`** e não fica em `levels`, o que garante que todo mapa salvo já é "só térreo". Nome do térreo: `MapaAtlas.groundLevelName?` (padrão "Térreo").
- Ganham `levelId?: string | null` (ausente = térreo): `Parede`, `Objeto`, `Luz`, `Regiao`, `Peca` e `Presenca`. Aberturas seguem a parede. `Comodo.levelId` já existe.
- **Terreno, relevo, água e clima são do térreo.** Num andar de cima, o filtro mantém o terreno do térreo, escurecido (o que se vê pela janela, lá embaixo), e esconde os cômodos e objetos do térreo. Num porão, a base é `vazio` sobre um fundo de rocha escura (`backdrop`), sem terreno nem clima de céu (chuva e neve não caem).
- **Paredes derivadas por andar.** Cômodos de andares diferentes em células vizinhas não dividem parede, e cada parede derivada leva o `levelId` do cômodo.
- **Escada:** `Interacao.kind: 'stairs'`, com `toLevel: string | null` (e `toPosition?: Ponto`, para escadas que não descem no mesmo ponto). Uma peça a até 1,5 m da escada ganha a ação "Subir para…" ou "Descer para…".
- **Explorado por andar:** `Sessao.explored` continua sendo o do térreo; `Sessao.exploredLevels?: Record<string, { res; cells }>` guarda o dos outros andares.

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| H1 | Andares no documento e o filtro `mapaDoAndar` | domínio |
| H2 | Comandos de andar e paredes por andar | comandos + geometria |
| H3 | Editor: andar ativo, seletor e criar no andar | interface + render |
| H4 | Sessão: peças, visão, explorado e projetor por andar | sessão + projeção |
| H5 | Escadas que levam a outro andar | interação |
| H6 | Andares pelo conector | conector + guia |

Ordem: H1 → H2 → H3 → H4 → H5 → H6.

---

### H1 — Andares no documento e o filtro `mapaDoAndar`  ✅
Objetivo: o documento sabe de andares, e uma função pura recorta um andar.
Depende de: —.
Ler: `src/domain/mapa.ts` inteiro, `src/domain/validacao.ts`, `src/domain/migracoes.ts`, `src/domain/projecao.ts` (como outra função pura copia e filtra o mapa: o mesmo estilo serve aqui), `src/domain/edificios.ts` (já separa por `levelId`).
Arquivos: mudar `mapa.ts`, `validacao.ts`; criar `src/domain/andares.ts`, `tests/unit/andares.test.ts`.
Como:
1. Tipos e campos opcionais da seção "Decisões". Validação: `order` inteiro diferente de 0 e único; todo `levelId` de entidade aponta para um andar que existe (ou é `null` ou ausente).
2. `andares.ts`:
   - `listaDeAndares(m): { id: string | null; nome: string; order: number }[]`, ordenada, com o térreo (`id: null`, `order: 0`);
   - `andarDe(e: { levelId?: string | null }): string | null`;
   - `mapaDoAndar(m, andar: string | null): MapaAtlas`: cópia rasa com `rooms`, `walls`, `props`, `lights`, `regions`, `tokens` e `presence` filtrados pelo andar, e `openings` pelas paredes que ficaram. Andar acima do térreo: mantém `terrain` (a render escurece; ver H3) e zera `presence` do térreo. Andar abaixo: `terrain` com base `vazio`, sem camadas e sem relevo; `backdrop` sólido `#141210`; `climate.weather` zerado. `session.explored` passa a ser o do andar (`exploredLevels[andar]` ou `null`). Cache por `WeakMap` (documento → andar → resultado).
   - `ehMultiandar(m)`: `levels` com pelo menos 1 andar.
Não fazer: comandos, render.
Testes: um mapa sem `levels` dá o mesmo conteúdo no filtro do térreo; um objeto com `levelId: 'a1'` só aparece em `mapaDoAndar(m, 'a1')`; porta segue a parede; o porão não tem terreno; o cache devolve o mesmo objeto para o mesmo documento.
Pronto quando: `npm test` passa.
Commit: `added map levels and per-level map filter`

### H2 — Comandos de andar e paredes por andar  ✅
Objetivo: criar, renomear, reordenar e remover andares; tudo o que é derivado respeita o andar.
Depende de: H1.
Ler: `src/state/comandos.ts` e `src/state/comandos-construir.ts` (todos os comandos de criação: `comodo.criar`, `parede.adicionar`, `item.adicionar`, `terreno.*`, `presenca.*`), `src/domain/geometria.ts` (`arestasDeParede`, `paredesDerivadas`, `recalcularParedes`, `encaixarNaParede`), `src/domain/presets.ts` (`telhadoPadrao`: já filtra por nível), `src/authoring/insight.ts` e `layout.ts` (a mobília só deve ver o andar do cômodo).
Arquivos: mudar `comandos.ts`, `comandos-construir.ts`, `geometria.ts`, `insight.ts` (se precisar); testes.
Como:
1. Comandos `andar.criar { andar: Andar }`, `andar.atualizar { id, patch: { name?, order? } }` e `andar.remover { id }`. Remover apaga as entidades daquele andar (num comando só, desfazível); a interface (H3) pede confirmação.
2. `comodo.criar` aceita `levelId`. Os outros já recebem o item inteiro: garanta que `levelId` passa pela validação.
3. `arestasDeParede` e `paredesDerivadas` agrupam por andar: duas células de andares diferentes nunca formam parede comum. A parede derivada recebe o `levelId` do cômodo. O id da parede derivada inclui o andar, para não colidir.
4. `encaixarNaParede(m, ponto, largura, andar?)`: só paredes daquele andar. Revise os chamadores (`construcao.ts` `portas`, ferramenta Porta do viewport) para passar o andar.
5. Ao gerar mobília (`gerarLayout`, `insightDoComodo`), use `mapaDoAndar(m, sala.levelId)`, para que os objetos de outro andar não ocupem lugar.
Testes: dois cômodos sobrepostos em andares diferentes não geram paredes comuns e cada um tem as suas; a porta no térreo não encaixa na parede do andar de cima; remover um andar apaga os cômodos dele e o desfazer devolve tudo; a mobília de um quarto no andar 1 ignora a mesa do térreo no mesmo lugar.
Pronto quando: `npm test` passa.
Commit: `level commands and per-level derived walls`

### H3 — Editor: andar ativo, seletor e criar no andar  ✅
Objetivo: o mestre vê e edita um andar por vez.
Depende de: H2.
Ler: `src/render/cena.ts` (`sincronizar` e como o mapa chega), `src/render/viewport.ts` (de onde vem o mapa que a cena recebe; as ferramentas que criam entidades), `src/app/app.ts` e `src/app/abas.ts` (estado por mapa aberto), `src/ui/Cabecalho.tsx` ou `src/ui/BarraInferior.tsx` (onde cabe o seletor; siga `docs/INTERFACE.md`), `src/app/acoes.ts`.
Arquivos: mudar os arquivos acima conforme o lugar escolhido; testes de interação.
Como:
1. Estado `andarAtivo` por mapa aberto (signal), padrão `null`; lembrado por aba (como a câmera).
2. A cena recebe `mapaDoAndar(doc, andarAtivo)`. Num andar de cima, o terreno é desenhado com um véu escuro de 45% por cima (um `Graphics` do tamanho do mapa, abaixo dos cômodos); num porão, o fundo de rocha.
3. **Fantasma do andar de baixo**, só em Construir: os contornos dos cômodos do andar imediatamente abaixo, em traço tracejado fino, para alinhar paredes entre andares.
4. Seletor (aparece com 1 andar ou mais, ou pelo botão "+ Andar"): lista ordenada, andar ativo destacado, "+ Andar acima", "+ Porão", renomear e remover (com confirmação que conta o que será apagado). Atalhos: PageUp e PageDown trocam de andar.
5. Toda criação no editor (cômodo, parede, porta, objeto, luz, região, presença, peça) recebe `levelId: andarAtivo`. A seleção e o "selecionar tudo" só pegam o andar ativo.
Testes: trocar de andar troca o que a cena mostra; criar um cômodo no andar 1 grava `levelId`; PageUp e PageDown funcionam.
Pronto quando: o mestre monta o térreo e o andar de cima de uma casa, alinhando as paredes pelo fantasma.
Commit: `editor shows one level at a time with level picker`

### H4 — Sessão: peças, visão, explorado e projetor por andar  ✅
Objetivo: na sessão, cada peça enxerga o próprio andar, e o projetor mostra o andar dos jogadores.
Depende de: H3.
Ler: `src/domain/nevoa.ts` (`poligonosDeVisao`, `celulasExploradas`, `exploradoAgora`), `src/domain/projecao.ts` (`projetarParaJogadores`), `src/app/projetor.ts`, `src/app/sessao.ts`, `src/render/nevoa.ts`, `src/render/telhados.ts` (`alguemDentro`).
Arquivos: mudar `nevoa.ts` (domínio), `projecao.ts`, `projetor.ts`, `sessao.ts` e o render da névoa; testes.
Como:
1. A visão e o explorado são calculados sobre `mapaDoAndar(m, andar)` com as peças daquele andar. O explorado é gravado em `explored` (térreo) ou `exploredLevels[andar]`.
2. **Andar do projetor:** o andar onde estão as peças de jogador. Se elas estiverem em andares diferentes, vale o escolhido pelo mestre (novo controle "Projetor: <andar>" no cabeçalho da sessão, visível só nesse caso); o padrão é o andar da última peça movida. `projetarParaJogadores` recebe o andar e projeta `mapaDoAndar`.
3. No editor da sessão, o mestre vê o andar ativo dele; peças de outros andares não aparecem (há um indicador "2 peças no Andar 1" que, clicado, troca de andar).
Testes: duas peças em andares diferentes têm visões independentes; o explorado de um andar não vaza para outro; a projeção com peças em andares diferentes usa o andar escolhido.
Pronto quando: numa sessão de teste, uma peça no porão não revela nada do térreo no projetor.
Commit: `session vision, exploration and projector per level`

### H5 — Escadas que levam a outro andar  ⬜
Objetivo: a peça sobe e desce pela escada.
Depende de: H4.
Ler: `src/domain/mapa.ts` (`Interacao`), `src/domain/interagiveis.ts`, `src/domain/interacao.ts`, `src/app/acoes.ts` (ações de clique direito na peça), `src/ui/Inspetor.tsx` (campos de interação de um objeto), receitas `escada.madeira`, `escada.pedra`, `escada.caracol`, `escada.de-mao` e `alcapao`.
Arquivos: mudar `mapa.ts`, `validacao.ts`, `interagiveis.ts`, `acoes.ts`, `Inspetor.tsx` e os comandos de peça; testes.
Como:
1. `Interacao.kind` ganha `'stairs'`, com `toLevel: string | null` e `toPosition?: Ponto`. Validação: `toLevel` existe e é diferente do andar do objeto.
2. Ao colocar uma receita de escada (as listadas acima) num mapa com mais de um andar, o Inspetor oferece "Leva a: <andar>" (padrão: o andar vizinho acima; `alcapao`, abaixo).
3. Comando `peca.mudarAndar { id, levelId, position }`. Na sessão, o clique direito numa peça a até 1,5 m de uma escada mostra "Subir para <andar>" ou "Descer para <andar>". A peça vai para `toPosition` ou para a mesma posição, e o editor do mestre acompanha se a peça for de jogador e o mestre estiver no andar de origem.
4. **Par automático:** criar uma escada que leva ao andar X e não existe escada no andar X naquele ponto (raio de 2 m) oferece "Criar a escada de chegada", que põe a mesma receita no andar X, apontando de volta.
Testes: a ação aparece perto da escada e não longe; mudar de andar grava `levelId` e a posição; o par automático aponta de volta.
Pronto quando: numa sessão, a peça desce do térreo do moinho para o porão pela escada em caracol e o projetor acompanha.
Commit: `stairs move tokens between levels`

### H6 — Andares pelo conector  ⬜
Objetivo: o Claude constrói edifícios de vários andares.
Depende de: H5 (e D3c, se já existir, para o `atlas_edificio` aceitar `andar`).
Ler: `src/app/ponte-escrita.ts` (todas as ferramentas de criação), `src/app/ponte-leitura.ts` (`resumirMapa`, `atlas_o_que_vejo`, `atlas_ver_mapa`), `src/authoring/construcao.ts`, guias.
Arquivos: mudar `ponte-escrita.ts`, `ponte-leitura.ts`, `construcao.ts`, guias, `catalogo-base.json`; testes.
Como:
1. Ferramenta `atlas_andares { criar?: [{ nome, order }], renomear?: [{ id, nome }] }` (remover fica só na interface, por segurança). Devolve a lista de andares com ids.
2. Parâmetro `andar` (id ou `null`) em `atlas_comodos`, `atlas_paredes`, `atlas_portas`, `atlas_objetos`, `atlas_espalhar`, `atlas_luzes`, `atlas_regioes`, `atlas_presenca`, `atlas_edificio`, `atlas_arranjo` e `atlas_mobiliar` (o último usa o andar do cômodo). Ausente = térreo.
3. `atlas_objetos` aceita `escada: { leva: andarId, posicao? }` nos itens de escada (vira a interação `stairs`).
4. `atlas_ver_mapa { andar }` captura aquele andar (troca e devolve o andar ativo no `finally`, como a câmera). `atlas_mapa_ler` traz `andares` e o `andar` de cada cômodo, objeto e luz. `atlas_o_que_vejo` traz o andar ativo.
5. Guia: como pensar um edifício de vários andares (alinhar as paredes externas, escadas nos dois andares no mesmo ponto, porão menor que o térreo, o que vai em cada andar), com o exemplo do moinho: porão com o poço e a escada em caracol, térreo com a mó, andar de cima com o depósito.
Testes: criar andar e cômodo nele pelo conector; `ver_mapa` de um andar não muda o andar ativo do mestre; o resumo traz os andares.
Pronto quando: pelo MCP, o Claude monta o moinho de Lysdal em três andares ligados por escada.
Commit: `connector builds multi-level maps`
