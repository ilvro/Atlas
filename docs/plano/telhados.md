# Telhados — casas cobertas na vista dos jogadores

## Diagnóstico (2026-11-14)

O Atlas **já tem telhado** desde a 7.2c (`src/render/telhados.ts`): `Comodo.roof = { material, visible }`, três materiais (`telha.barro`, `telha.ardosia`, `telha.palha`), fade de 0,4 s quando uma peça de jogador entra, 25% para o mestre, nada em Construir, campos "Telhado" e "Telhado visível" no Inspetor do cômodo e `telhado`/`telhadoVisivel` em `atlas_comodos`. A chuva, a neve, a neblina (`mascara-de-comodos.ts`), a sombra do sol e os halos já tratam o cômodo como coberto. Os exemplos com casas (porto, entreposto, gruta) têm telhado em todos os cômodos.

O que faz o mapa parecer "a céu aberto":

1. **Todo cômodo nasce sem telhado.** `comodo.criar` grava `roof.material: null` (`comandos-construir.ts:112`), a ferramenta Cômodo não passa material (`viewport.ts:641`), e `construcao.ts` só o põe se o pedido trouxer. Quem não abre o Inspetor de cada cômodo nunca vê um telhado.
2. **O telhado abre cômodo por cômodo, não por casa.** Quando a peça entra no corredor, a cozinha ao lado continua coberta, mesmo vista pela porta aberta (a camada de telhados fica **acima** da névoa em `cena.ts:96`). Por isso o mestre tende a desligar o telhado.
3. **O desenho é uma placa chapada** (fileiras de telhas sobre as células, com contorno): sem águas, sem cumeeira, sem beiral cobrindo a espessura da parede e sem sombra no chão. De longe, parece mais um piso escuro do que um telhado.
4. **Só existe um tipo de telhado.** Os três materiais mudam apenas a cor: `desenhar()` ignora o `padrao` do material, então barro, ardósia e palha saem com as mesmas fileiras. Não há forma (duas águas, laje, torre), nem estilo de igreja, de pedra ou de zinco, nem detalhes (chaminé, cruz, campanário).
5. **Dentro de casa a luz é a do céu.** O mapa de luz usa um só ambiente (`mapa-de-luz.ts`, `clearColor: amb`): ao meio-dia, um quarto sem janela fica tão claro quanto a rua.

## Decisões

- **Edifício = cômodos com telhado que se tocam** (células vizinhas em 4 direções, com ou sem parede entre elas). É derivado do documento, nunca gravado. Casas geminadas viram um só edifício; para separá-las, basta deixar uma célula de rua entre elas (ou desligar o telhado de uma).
- **O telhado abre por edifício.** Basta uma peça de jogador estar em qualquer cômodo do edifício para o telhado inteiro sumir; daí em diante, a névoa decide o que se vê lá dentro.
- **Telhado por padrão, não migração.** Cômodos novos já nascem cobertos, com o material vindo do gênero ou do edifício vizinho. Mapas antigos não são alterados sozinhos: um botão "Cobrir as casas" faz isso num gesto que se pode desfazer.
- **Varanda e afins nascem sem telhado** (lista de funções ao ar livre).
- **Um telhado = cobertura + forma (+ detalhes).** A *cobertura* é o material (`roof.material`, `uso: 'telhado'`), e cada uma tem um pintor próprio: telha de barro, ardósia, escamas de ardósia, palha, tabuinhas de madeira, lajes de pedra, cobre com azinhavre, zinco ondulado, concreto, grama. A *forma* é `roof.shape`: `quatro-aguas`, `duas-aguas`, `plano` (laje com platibanda) ou `piramide` (torre, campanário). Ela vem com `roof.ridge` (`auto`/`h`/`v`) e `roof.steep` (íngreme: telhado de igreja, mais claro e escuro entre as águas e com a cumeeira marcada). Os *detalhes* são `roof.details`: `chamine`, `cruz`, `sino`, `catavento`, `claraboia` e `caixa-dagua`.
- **Estilos de telhado são atalhos, não dados.** "Igreja", "Torre", "Choupana", "Casa de pedra", "Galpão de zinco", "Laje moderna", "Celeiro", "Casa nórdica", "Templo de cobre" e "Casa de telha" preenchem cobertura, forma e detalhes de uma vez. O documento guarda o resultado, que continua editável campo a campo.
- **Partes de uma casa podem ter telhados diferentes.** A nave da igreja em duas águas e a torre em pirâmide formam um edifício (abrem juntas), mas são desenhadas como *trechos* separados: cômodos vizinhos com o mesmo `material` e `shape` se juntam num trecho. As pirâmides são desenhadas por cima, depois os telhados de águas e, por baixo, os planos.
- O documento ganha campos **opcionais** em `roof` (`shape`, `ridge`, `steep`, `details`). Sem eles, vale o que já existe (`quatro-aguas`, `auto`, não íngreme, sem detalhes): os mapas salvos abrem sem migração.
- O Atlas desenha cômodos na grade, então casas giradas como as do print do Tabletop ficam fora. Quem quiser uma casa girada usa um objeto da coleção.

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| T1 | Edifícios: agrupar os cômodos cobertos | domínio |
| T2 | O telhado abre por edifício | render |
| T3 | Telhado por padrão ao criar cômodos | domínio + comandos + ponte |
| T4 | Cobrir as casas de um mapa existente | interface |
| T5a | Forma do telhado no documento e geometria das águas | domínio |
| T5b | Coberturas com desenho próprio | procedural |
| T5c | Desenho do telhado: trechos, águas, luz, beiral e sombra | render |
| T5d | Estilos de telhado e o seletor no Inspetor | domínio + interface + ponte |
| T5e | Detalhes do telhado: chaminé, cruz, sino, cata-vento, claraboia | procedural + render |
| T6 | Penumbra dos interiores | render |
| T7 | Mestre abre e fecha telhados na sessão | interface |

Ordem: T1 → T2 → T3 → T4; T5a → T5b → T5c → T5d → T5e depois de T2; T6 e T7 depois de T2, em qualquer ordem. O T3 escolhe o material do padrão; quando o T5d existir, ele passa a escolher um **estilo** (ver nota no T5d).

---

### T1 — Edifícios: agrupar os cômodos cobertos  ✅
Objetivo: saber quais cômodos formam uma mesma casa.
Depende de: —.
Ler: `src/domain/celulas.ts` (`decodificar`), `src/domain/nevoa.ts` (cache por documento no topo e `comodosConhecidos`), `src/domain/mapa.ts` (`Comodo`).
Arquivos: criar `src/domain/edificios.ts`, `tests/unit/edificios.test.ts`.
Como:
1. `export interface Edificio { id: string; salas: string[]; celulas: [number, number][] }`; o `id` é o menor id de cômodo, em ordem lexicográfica, para ser estável entre quadros.
2. `edificiosDe(m: Pick<MapaAtlas, 'rooms'>): Edificio[]`: só entram cômodos com `roof.material` não nulo; união e busca (union-find) sobre o mapa `"x,y" → salaId`, unindo salas com células vizinhas em 4 direções. Cômodos de `levelId` diferentes não se unem.
3. `edificioDaSala(m, salaId): Edificio | null`.
4. Cache como em `nevoa.ts`: o resultado vale enquanto `m.rooms` for o mesmo objeto (WeakMap).
Não fazer: nada de render; não olhar paredes nem portas.
Testes: duas salas lado a lado formam 1 edifício; com uma célula de folga, 2; sala sem material fica fora; níveis diferentes não se unem; `id` estável quando a ordem de `rooms` muda; o cache devolve o mesmo array para o mesmo `rooms`.
Pronto quando: `npm run typecheck` e `npm test` passam.
Commit: `added building grouping for roofed rooms`

### T2 — O telhado abre por edifício  ✅
Objetivo: a peça entra em qualquer cômodo da casa e o telhado da casa inteira some; a névoa cuida do resto.
Depende de: T1.
Ler: `src/render/telhados.ts` inteiro, `src/render/halos.ts:225-245` (`telhados.visivel`), `tests/e2e/fase7.test.ts:248-290`.
Arquivos: mudar `src/render/telhados.ts`, `tests/e2e/fase7.test.ts`.
Como:
1. Em `reavaliar()`, calcular `edificiosDe(m)` e, por edifício, `dentro = salas.some(alguemDentro)` e `conhecido = salas.some(conhecidos.has)`; cada `DoComodo` recebe os valores do seu edifício. Cômodo com `roof.visible === false` continua com alvo 0, mas **conta** para o edifício (a casa existe).
2. `alguemDentro` passa a montar o conjunto de células uma vez por edifício, não por sala.
3. `diagnostico()` ganha o campo `edificio: string`.
4. A interface `Telhados` não muda (`visivel(salaId)` continua servindo os halos).
Não fazer: mudar o desenho (T5b); mexer na névoa.
Testes: e2e novo em `fase7.test.ts`: duas salas que se tocam, ambas com telhado, e uma peça de jogador em uma delas → as duas com `alvo` 0; a peça sai → as duas voltam a 1. O teste antigo (uma sala) continua passando.
Pronto quando: entrar no corredor descobre a cozinha vizinha, e a porta aberta mostra o interior pela névoa.
Commit: `roofs now open per building instead of per room`

### T3 — Telhado por padrão ao criar cômodos  ✅
Nota: a lição de Sessão (`src/tutorial/licoes.ts`) não precisou mudar porque `sala` e `cozinha` se tocam e as peças estão dentro da `sala`, então ambos os telhados abrem juntos na vista de jogador.
Objetivo: quem desenha uma casa já a vê coberta na vista dos jogadores, sem abrir o Inspetor.
Depende de: T1.
Ler: `src/domain/presets.ts` (`TIPOS_DE_COMODO`, `GENEROS`), `src/state/comandos-construir.ts:105-120` (`comodo.criar`), `src/render/viewport.ts:630-645`, `src/authoring/construcao.ts:67-95`, `src/app/ponte-escrita.ts:185-200`, `docs/assistente/guia/ferramentas-atlas.md` (seção de `atlas_comodos`), `src/tutorial/licoes.ts:165-215` (lição de Sessão).
Arquivos: mudar `presets.ts`, `comandos-construir.ts`, `viewport.ts`, `construcao.ts`, `ferramentas-atlas.md`; testes em `tests/unit/construcao.test.ts` e `tests/unit/presets.test.ts` (ou o arquivo de presets que já existir).
Como:
1. Em `presets.ts`: `FUNCOES_AO_AR_LIVRE = new Set(['varanda', 'patio', 'claustro', 'quintal'])` e `telhadoPadrao(m: Pick<MapaAtlas, 'rooms' | 'style'>, funcao: string, celulas: readonly [number, number][]): string | null`:
   - função ao ar livre → `null`;
   - se alguma célula vizinha (em 4 direções) pertence a um cômodo com telhado → o material desse cômodo (casa coerente);
   - senão, pelo gênero: `fantasia` → `telha.palha`, `moderno` → `telha.ardosia`, os demais → `telha.barro`.
2. `comodo.criar` aceita `telhado?: string | null`; ausente → `null` (o comando continua puro e o padrão é escolhido por quem chama).
3. `viewport.ts:641` passa `telhado: telhadoPadrao(mapa, tipo.funcao, novas)`.
4. `construcao.ts`: com `p.telhado === undefined`, usa `telhadoPadrao`; `null` explícito continua significando "sem telhado". Atualizar a descrição de `atlas_comodos` em `ponte-escrita.ts` (mantendo o limite de 180 caracteres do PM4b) e o guia: "omitido = telhado do gênero; `null` = sem telhado".
5. Tutorial: conferir se a lição de Sessão (passo "Ver como jogador", com a peça **fora** da cozinha e a porta aberta) continua verdadeira. Se o telhado novo cobrir a cozinha nesse passo, a lição cria os cômodos com `telhado: null` ou o texto do `porque` muda. Escolha a primeira opção e anote na ficha.
Não fazer: alterar mapas já salvos; mudar os exemplos.
Testes: `telhadoPadrao` (gênero, vizinho, ar livre); `construcao` sem `telhado` grava o padrão, com `null` grava `null`; `npm run test:e2e` da lição de Sessão.
Pronto quando: desenhar um cômodo com a ferramenta Cômodo e ir para a vista de jogador mostra o telhado.
Commit: `new rooms get a default roof from genre or neighbors`

### T4 — Cobrir as casas de um mapa existente  ⬜
Objetivo: mapas feitos antes do T3 ganham telhado com um clique, e o clique se desfaz com Ctrl+Z.
Depende de: T3.
Ler: `src/ui/Inspetor.tsx:590-610` (`CamposDoComodo`) e a seção do Inspetor sem seleção (dados do mapa), `src/state/` (como `iniciarGesto` agrupa comandos num registro).
Arquivos: mudar `src/ui/Inspetor.tsx`; criar `src/authoring/cobrir.ts` e `tests/unit/cobrir.test.ts`.
Como:
1. `cobrirCasas(m): Comando[]`: para cada cômodo com `roof.material === null` e função fora de `FUNCOES_AO_AR_LIVRE`, um `comodo.atualizar` com `roof: { material: telhadoPadrao(...), visible: true }`. Processar em ordem de vizinhança, para que um cômodo recém-coberto passe o material ao vizinho.
2. No Inspetor sem seleção, quando houver cômodos descobertos: "Cobrir as casas (N cômodos sem telhado)". Aplicar num só gesto, com o rótulo "Telhados".
3. Em `CamposDoComodo`, abaixo de "Telhado": se o cômodo pertence a um edifício com mais de uma sala, mostrar "Casa: N cômodos" e o botão "Usar este telhado na casa toda" (um gesto).
Não fazer: aplicar nada sozinho ao abrir o mapa.
Testes: `cobrirCasas` deixa varanda de fora, herda o material do vizinho e não toca cômodo que já tem telhado.
Pronto quando: abrir um mapa antigo, clicar em "Cobrir as casas", ver os telhados na vista de jogador e desfazer tudo com um Ctrl+Z.
Commit: `added cover houses action and roof per building in inspector`

### T5a — Forma do telhado no documento e geometria das águas  ⬜
Objetivo: o documento sabe a forma de cada telhado, e um código puro transforma a planta em faces.
Depende de: T1.
Ler: `src/domain/mapa.ts:70-80` (`Comodo.roof`), `src/domain/validacao.ts:25`, `src/state/comandos-construir.ts` (`comodo.atualizar` e o merge de `roof`), `src/domain/geometria.ts`, `src/domain/celulas.ts`.
Arquivos: mudar `mapa.ts`, `validacao.ts`; criar `src/domain/telhado-geometria.ts`, `tests/unit/telhado-geometria.test.ts`; testes de validação no arquivo que já existir.
Como:
1. `roof: { material: string | null; visible: boolean; shape?: FormaDeTelhado; ridge?: 'auto' | 'h' | 'v'; steep?: boolean; details?: DetalheDeTelhado[] }`, com `FormaDeTelhado = 'quatro-aguas' | 'duas-aguas' | 'plano' | 'piramide'` e `DetalheDeTelhado = 'chamine' | 'cruz' | 'sino' | 'catavento' | 'claraboia' | 'caixa-dagua'`. A validação aceita a ausência dos campos e recusa valor desconhecido. `formaDe(roof)` devolve a forma com os padrões (`quatro-aguas`, `auto`, `false`, `[]`).
2. `trechosDe(m, edificio): Trecho[]`: cômodos do edifício vizinhos e com o mesmo `material` e `shape` formam um trecho (`{ salas, celulas, roof }`).
3. `retangulosDe(celulas): Ret[]`: decomposição gulosa em retângulos maximais, o de maior área primeiro.
4. `aguasDe(ret, roof, beiral = 0.25): { faces: Face[]; cumeeiras: Segmento[] }`, com `Face = { pontos: [number, number][]; normal: [number, number]; queda: [number, number] }` (`queda` aponta para onde a água escorre e orienta as fileiras da cobertura). O retângulo é expandido pelo beiral:
   - `quatro-aguas`: cumeeira no eixo maior, recuada metade do lado menor em cada ponta (2 trapézios + 2 triângulos);
   - `duas-aguas`: cumeeira no eixo maior, ou no eixo de `ridge` quando não for `auto`, de ponta a ponta (2 retângulos, com oitões nas pontas);
   - `plano`: uma face com `normal` nula e uma platibanda (anel de 0,2 m) como segunda face;
   - `piramide`: 4 triângulos até o centro, sem cumeeira.
5. `aguasDoTrecho(trecho)` junta os retângulos do trecho. `ordemDoTrecho(roof)`: plano 0, águas 1, pirâmide 2.
Não fazer: rincão de verdade em L (a sobreposição dos retângulos basta na vista de cima); render.
Testes: 4×2 em quatro águas dá 4 faces e uma cumeeira de 2 células; em duas águas dá 2 faces e uma cumeeira de 4; `ridge: 'v'` gira a cumeeira; pirâmide 3×3 dá 4 triângulos; L dá 2 retângulos; área das faces = área do retângulo expandido; igreja (nave em duas águas + torre em pirâmide vizinha) dá 1 edifício e 2 trechos; documento sem os campos novos passa na validação.
Pronto quando: `npm run typecheck` e `npm test` passam, e os exemplos continuam abrindo.
Commit: `added roof shapes and roof face geometry`

### T5b — Coberturas com desenho próprio  ⬜
Objetivo: cada cobertura tem cara própria (barro não é ardósia, que não é palha) e o mesmo desenho serve ao Ilustrado e ao Pixel.
Depende de: T5a.
Ler: `src/procedural/materiais.ts` (`Material`, `Padrao`, os pintores de `tabuas`, `laje`, `trama` e `metal` e a ligação `padrao → pintor`), `src/procedural/canvas.ts`, `src/procedural/ruido.ts`, o pintor Pixel em `src/estilos/materiais-pixel.ts`, `docs/LICENCAS.md` (tudo procedural, nada novo a licenciar).
Arquivos: mudar `materiais.ts` (materiais e padrões novos) e `materiais-pixel.ts`; criar `src/procedural/coberturas.ts` e `tests/unit/coberturas.test.ts`.
Como:
1. Novos `Padrao` só de telhado: `telha-canal` (fileiras de telhas curvas com borda em arco e sombra embaixo), `escamas` (ardósia em escamas arredondadas), `ardosia` (placas retangulares desencontradas), `palha` (fibras longas na direção da queda, com borda grossa), `tabuinhas` (tábuas curtas desencontradas), `lajes-telhado` (pedras irregulares sobrepostas), `ondulado` (zinco: listras claro/escuro com ferrugem por ruído), `cobre` (placas com junta saliente e azinhavre por `fbm`), `concreto-laje` (liso com manchas e ralo), `grama-telhado` (grama sobre terra com bordas de casca).
2. Materiais (`uso: 'telhado'`): manter `telha.barro` (agora `telha-canal`), `telha.ardosia` (agora `ardosia`) e `telha.palha` (agora `palha`); acrescentar `telha.escamas`, `telha.velha` (barro com musgo), `telha.tabuinhas`, `telha.pedra`, `telha.cobre`, `telha.zinco`, `telha.concreto`, `telha.grama` e `telha.lona` (tenda; usa `pregas`).
3. `texturaDeCobertura(material, estilo: 'ilustrado' | 'pixel', semente): Tela`: ladrilho que se repete, desenhado com a **queda para baixo** (o render gira por face). No Pixel, as mesmas descrições, pintadas em `fillRect` com a paleta.
Não fazer: render na cena.
Testes: todo material `telhado` tem pintor nas duas versões; o ladrilho emenda (a primeira e a última coluna batem dentro de uma tolerância); mesma semente dá os mesmos pixels.
Pronto quando: a prancha de materiais (ou a lista do Inspetor) mostra as 13 coberturas distintas.
Commit: `added distinct roof coverings with their own patterns`

### T5c — Desenho do telhado: trechos, águas, luz, beiral e sombra  ⬜
Objetivo: o telhado tem cara de telhado: cada água com a textura girada na queda, luz e sombra conforme o sol, cumeeira, beiral sobre as paredes e sombra no chão.
Depende de: T2, T5a, T5b.
Ler: `src/render/telhados.ts`, `src/render/textura-propria.ts` (como textura procedural vira `Texture` do Pixi), `src/domain/clima.ts` (`Ceu.sun`), `src/render/sombras-do-sol.ts` (direção e cor da sombra), `fase-8.md:101` (telhado no Pixel).
Arquivos: mudar `src/render/telhados.ts`; criar `tests/e2e/telhados.test.ts`.
Como:
1. Um `Container` por **edifício** (o fade continua por edifício, como no T2), com a sombra embaixo e um `Graphics` por trecho em `ordemDoTrecho`.
2. Sombra: a silhueta expandida do edifício deslocada na direção oposta ao sol por `0,6 m` (pirâmide e íngreme: `1,2 m`), na cor da sombra do sol, alfa 0,35, com `BlurFilter` compartilhado.
3. Cada face: `g.poly(face.pontos).fill({ texture, matrix })`, com a matriz girando o ladrilho para `face.queda` e escalando a 1 ladrilho = 1 m. Por cima, um véu da face: branco ou preto, alfa `0,18 × dot(normal, dirDoSol)` (`steep`: 0,28). Cumeeira: traço de 0,12 m em `claro`. Oitões de duas águas: borda de 0,08 m em `escuro`. Platibanda: em `escuro`, com sombra interna.
4. Texturas em cache por `material + estilo`, destruídas no `destruir()`. Redesenho só quando `rooms`, `grid`, `climate` ou `style` mudarem. Sem `sun`: luz de cima à esquerda.
5. `visivel(salaId)` consulta o edifício da sala.
Não fazer: detalhes (T5e).
Testes: e2e com captura ao meio-dia na vista de jogador: casa 4×3 em quatro águas → as águas opostas diferem em mais de 10% de brilho; duas águas com `ridge: 'v'` → a divisão de luz é vertical; o pixel logo fora da parede, do lado da sombra, é mais escuro do que sem telhado; barro e ardósia na mesma posição dão capturas diferentes.
Pronto quando: o porto à noite e o entreposto mostram telhados com volume, e o fade continua funcionando.
Commit: `roofs drawn per building with textured faces, light and shadow`

### T5d — Estilos de telhado e o seletor no Inspetor  ⬜
Objetivo: escolher "Igreja" ou "Choupana" num clique, sem montar cobertura e forma à mão.
Depende de: T5c.
Ler: `src/domain/presets.ts` (`TIPOS_DE_COMODO`, `telhadoPadrao` do T3), `src/ui/Inspetor.tsx:595-610`, `src/authoring/construcao.ts` (`PedidoDeComodo`), `src/app/ponte-escrita.ts:185-200`, `src/app/ponte-leitura.ts:105-115` (`atlas_catalogo`), `src/render/miniatura.ts`.
Arquivos: mudar `presets.ts`, `Inspetor.tsx`, `construcao.ts`, `ponte-escrita.ts`, `ponte-leitura.ts`, `docs/assistente/guia/ferramentas-atlas.md` e `mapas.md`; testes em `tests/unit/presets.test.ts` e `tests/unit/ponte-escrita.test.ts`.
Como:
1. `ESTILOS_DE_TELHADO: { id; nome; roof: Omit<Comodo['roof'], 'visible'> }[]`:

   | Estilo | Cobertura | Forma | Íngreme | Detalhes |
   | --- | --- | --- | --- | --- |
   | Casa de telha | `telha.barro` | quatro águas | não | chaminé |
   | Casa velha | `telha.velha` | duas águas | não | chaminé |
   | Choupana | `telha.palha` | quatro águas | não | — |
   | Casa de pedra | `telha.pedra` | duas águas | não | chaminé |
   | Celeiro | `telha.tabuinhas` | duas águas | sim | catavento |
   | Igreja | `telha.ardosia` | duas águas | sim | cruz |
   | Torre / campanário | `telha.escamas` | pirâmide | sim | sino |
   | Templo de cobre | `telha.cobre` | quatro águas | sim | — |
   | Galpão de zinco | `telha.zinco` | duas águas | não | — |
   | Laje moderna | `telha.concreto` | plano | — | caixa-d'água |
   | Casa nórdica | `telha.grama` | duas águas | não | chaminé |
   | Tenda | `telha.lona` | pirâmide | não | — |

2. O `telhadoPadrao` do T3 passa a devolver um estilo. Por função: `capela` → Igreja; `forja` → Casa de pedra (pelo gênero) com chaminé; `torre` e `campanario` → Torre. Por gênero: fantasia → Choupana ou Casa de telha, investigação → Casa velha, moderno → Laje moderna. O vizinho coberto continua tendo prioridade, menos quando a função pede outro estilo (a torre ao lado da nave vira Torre).
3. Inspetor: "Telhado" vira uma grade de miniaturas dos estilos (mais "Nenhum"), feitas com o desenho do T5c num quadrado 2×2. Abaixo, recolhido em "Ajustar": cobertura, forma, cumeeira (auto, horizontal, vertical), íngreme e detalhes. "Usar este telhado na casa toda" (T4) copia o `roof` inteiro.
4. Ponte: `telhado` em `atlas_comodos` aceita o id de um estilo ou de uma cobertura; `telhadoForma`, `telhadoCumeeira` e `telhadoDetalhes` são opcionais. `atlas_catalogo { parte: 'telhado' }` lista estilos e coberturas. Descrições dentro do limite do PM4b; o guia ganha uma tabela de estilos e o exemplo da igreja (nave + torre).
Não fazer: estilos gravados no documento (só o `roof` resultante).
Testes: cada estilo passa na validação; `telhadoPadrao` dá Igreja para capela e Torre ao lado de nave; a ponte aceita estilo e cobertura e recusa id desconhecido.
Pronto quando: no Inspetor, clicar em "Igreja" na nave e em "Torre" no cômodo da torre dá uma igreja com campanário na vista de jogador.
Commit: `added roof styles and style picker in inspector`

### T5e — Detalhes do telhado: chaminé, cruz, sino, cata-vento, claraboia  ⬜
Objetivo: os detalhes que fazem uma casa ser casa e uma igreja ser igreja.
Depende de: T5c.
Ler: `src/procedural/descricao.ts` (`Parte`, desenho de receitas), uma receita pequena em `src/procedural/receitas/` (poço, poste), `src/render/telhados.ts`, `src/domain/telhado-geometria.ts`.
Arquivos: criar `src/procedural/detalhes-de-telhado.ts`; mudar `src/render/telhados.ts`; testes em `tests/unit/detalhes-de-telhado.test.ts`.
Como:
1. Cada detalhe é uma descrição de desenho (como as receitas), assada para os dois estilos: `chamine` (bloco de tijolo ou pedra conforme a cobertura, com boca escura e sombra; à noite, se o cômodo tiver lareira, um fio de fumaça com as partículas existentes, se for barato), `cruz` (na ponta da cumeeira), `sino` (abertura do campanário com o sino, no centro da pirâmide), `catavento` (no meio da cumeeira), `claraboia` (vidro com reflexo, numa água), `caixa-dagua` (sobre a laje).
2. `posicoesDosDetalhes(trecho, aguas, semente)` é puro: chaminé numa água, a 1/3 da cumeeira e fora da borda; cruz na ponta da cumeeira voltada para a frente do mapa; os demais no centro. A posição sai da semente do cômodo, para não pular entre quadros.
3. Desenho sobre as faces, com a mesma sombra deslocada pelo sol.
Não fazer: detalhes arrastáveis à mão (a posição é automática; se o usuário pedir, vira tarefa nova).
Testes: as posições caem dentro do trecho e se repetem com a mesma semente; todo detalhe tem desenho nos dois estilos.
Pronto quando: a igreja tem cruz e campanário com sino, e as casas de telha têm chaminé.
Commit: `added roof details like chimneys, crosses and bells`

### T6 — Penumbra dos interiores  ⬜
Objetivo: debaixo do telhado não chega a luz do céu; o interior fica na penumbra, a não ser pelas luzes que tem.
Depende de: T1.
Ler: `src/render/mapa-de-luz.ts:40-60` e `125-170` (`renderizar`, ambiente, clarão), `src/render/mascara-de-comodos.ts`.
Arquivos: mudar `src/render/mapa-de-luz.ts`; e2e em `tests/e2e/telhados.test.ts`.
Como:
1. `FATOR_DO_INTERIOR = 0.55`. Um `Graphics` `interior` com as células de todos os cômodos com `roof.material` (visível ou não: o telhado existe mesmo aberto para quem está dentro), preenchido com `ambiente × FATOR_DO_INTERIOR`.
2. Em `renderizar()`: limpar `finalRT` com `amb`, desenhar `interior` (blend normal, `clear: false`) e depois `composicao` aditiva, como hoje. Assim, as luzes do cômodo somam por cima da penumbra.
3. Relâmpago: o `brilho` do clarão entra só a 30% no interior.
4. Redesenhar `interior` quando `rooms` ou `grid` mudarem.
Não fazer: luz do dia entrando pelas janelas (fica anotada como pendência); um campo novo no clima.
Testes: e2e ao meio-dia: o centro de um cômodo coberto e sem luz fica pelo menos 30% mais escuro do que a rua; com uma lamparina dentro, o centro fica claro.
Pronto quando: as casas do entreposto ficam em penumbra de dia, e nada muda nos mapas sem cômodos.
Commit: `roofed interiors get dimmer ambient light`
Nota para o planejamento: conferir com o usuário, pela captura, se 0,55 é o tom certo antes de fechar.

### T7 — Mestre abre e fecha telhados na sessão  ⬜
Objetivo: o mestre controla os telhados durante a sessão: todos de uma vez (como no Tabletop, em que se desliga a camada de telhados para mostrar o mapa) ou uma casa por vez.
Depende de: T2.
Ler: `src/render/viewport.ts` (`aoMenuContexto`), o menu de contexto e a barra da sessão em `src/ui/`, `src/app/modo.ts` (`vistaDeJogador`), `src/domain/mapa.ts` (`Sessao`), `src/render/telhados.ts` (`alvoDe`), `src/ui/Projetor.tsx` (o que chega ao projetor).
Arquivos: mudar `mapa.ts`, `validacao.ts`, `telhados.ts`, a barra e o menu de contexto da sessão; testes no arquivo de comandos da sessão que já existir e em `tests/e2e/telhados.test.ts`.
Como:
1. Chave geral `session.roofs?: 'auto' | 'fechados' | 'abertos'` (ausente vale `auto`). `auto` é o comportamento do T2 (abre quando alguém entra); `fechados` mantém todos cobertos, mesmo com peça dentro; `abertos` some com todos (o mapa "em corte", como hoje). Por estar em `session`, o projetor a recebe pela projeção. Em `alvoDe`, `abertos` → 0, e `fechados` ignora o `dentro`.
2. Na barra da sessão, um botão de três estados "Telhados: automático / sempre / abertos", com ícone de telhado.
3. Clique direito numa célula de um edifício: "Abrir telhado da casa" / "Fechar telhado da casa", que alterna `roof.visible` em todas as salas do edifício num só gesto ("Telhado"). Vale mesmo com a casa vazia; aberto o telhado, a névoa volta a decidir o que se vê.
Não fazer: atalho de teclado; passo de momento (pode vir depois, como `telhado` em `TIPOS_DE_PASSO`).
Testes: a chave geral muda o `alvo` de todos os telhados nos três estados e chega ao projetor; o comando por casa alterna todas as salas do edifício e se desfaz em um passo.
Pronto quando: o mestre põe "abertos" para mostrar o mapa inteiro, volta para "automático" e abre só a taverna pelo menu.
Commit: `gm controls roofs in session, all at once or per building`

## Pendências conhecidas (fora deste plano)

- Luz do dia entrando por portas e janelas abertas nos interiores.
- Passo de momento "abrir telhado" (cena do teto que desaba, por exemplo).
- Telhados em L com rincão de verdade (hoje, os retângulos se sobrepõem).
- Casas giradas fora da grade (hoje, só como objeto da coleção).
- Arrastar os detalhes (chaminé, cruz) para outra posição.
