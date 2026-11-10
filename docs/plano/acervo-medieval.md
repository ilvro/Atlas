# Acervo medieval — plano de tarefas

Pedido do usuário: mais objetos variados no acervo (coisas medievais, armamentos, escadas, mesas, camas de palha, objetos de igreja). Tudo entra como **receita leve** (`src/procedural/receitas/`), no kit `fantasia`: uma descrição de desenho por objeto, que os estilos Ilustrado e Pixel interpretam. Nada de imagem, nada de `colecao.json`.

Os quatro lotes são independentes e podem ser feitos em paralelo: cada um preenche **um arquivo já criado e já ligado** em `receitas/index.ts` e cria **um arquivo de teste próprio**.

## Regras comuns aos quatro lotes

Ler antes: `AGENTS.md`, `src/procedural/descricao.ts`, `src/procedural/receitas/comum.ts`, `src/procedural/receitas/fantasia.ts` (o modelo de receita de piso), `src/procedural/receitas/parede.ts` (o modelo de receita de parede), `src/procedural/organico.ts` (`tira`, `bolha`, `tufo`, `sombraNoChao`, úteis para palha, panos, cordas e chamas) e `tests/unit/receitas.test.ts` (o que todo o acervo tem de cumprir).

- **Vista de cima.** Coordenadas locais em metros, origem no centro, frente do objeto para `+y`. `z` é a altura real da parte (m): ordena o desenho (o maior fica por cima) e projeta a sombra. Um objeto alto visto de cima mostra o **topo**: um manequim de armadura é elmo e ombreiras, não a figura de frente.
- **Estrutura de uma receita de piso:** primeiro a parte que dá a silhueta (com contorno normal), depois os volumes (`contorno: 'leve'`, `detalhe: 2`), por fim os miúdos (`contorno: false, semSombra: true, detalhe: 3`). De 6 a 25 partes por objeto: tem de ser reconhecível a 64 px por metro, sem virar um borrão de detalhe.
- **Receita de parede:** `parede(largura, face, topo)`. `face` em (u, z) vista de frente (z entre ~1,2 e ~2,5 m, espessura no lugar do `z` da parte, 0,03 a 0,08); `topo` em (u, profundidade), o fio colado à parede. `pegada: [largura, 0.05]`, `categoria: 'parede'`, `tipo: 'parede'`.
- **Materiais:** só ids de `MATERIAIS` (`madeira.escura`, `madeira.media`, `madeira.clara`, `ferro`, `latao`, `pedra.escura`, `laje.pedra`, `tijolo`, `tecido.*`, `couro.marrom`, `marmore.branco`, `vidro`, `telha.palha`…) ou cor `#rrggbb`. Paleta contida e coerente com `fantasia.ts`: pedra `#6e7078`/`#3a3c42`, palha `#c9ae5a`/`#e0c878`, aço `#9aa0aa`/`#c8ccd4`, ouro `latao`, vinho `#7a1f24`, fogo `#ff7a2a`/`#ffc24a`, brasa `#c8401a`.
- **Aleatório** só por `mulberry32(p.seed)`. Tamanhos editáveis por `campos` + `num(p, …)` onde a ficha indicar (padrão dentro de min/max, `passo` > 0); material editável por `mat(p, …)` com `uso: 'objeto'`.
- **Metadados:** `generos: ['fantasia']`, `kit: 'fantasia'` (igreja: `generos: ['fantasia', 'investigacao']`). `funcoes` só destas: `sala, cozinha, quarto, biblioteca, escritorio, banheiro, corredor, hospital, taverna, sala-de-jantar, sala-de-jogos, capela, forja, varanda, porao, jardim`. `tags` em minúsculas, sem acento, com sinônimos úteis à busca. `categoria` só as de `CATEGORIAS`.
- **Pegada:** as partes cabem na pegada declarada (o teste tolera 25% + 5 cm). A pegada do campo `pegada` é igual à devolvida por `gerar` com os padrões.
- **Ids** exatamente os da ficha (já conferidos: não repetem nenhum id existente).

Não fazer (em todos): mexer em `index.ts`, `comum.ts`, materiais, renderizadores, `regras-mobilia.ts`, exemplos, `colecao.json`, `progress.md` ou neste arquivo; criar funções de cômodo novas; criar receitas fora da lista.

Verificar: `npm run typecheck` e `npm test`. Como os lotes correm em paralelo, uma falha citando ids de **outro** lote não é sua: reporte e siga.

---

### M1 — Armamentos  ✅
Objetivo: armas e equipamento de guarnição para arsenal, pátio de treino e muralha.
Arquivos: preencher `src/procedural/receitas/armas.ts` (`RECEITAS_DE_ARMAS`); criar `tests/unit/acervo-armas.test.ts`.
Receitas de piso (id — nome — pegada — categoria — funções — o que se vê de cima):
- `suporte-de-armas` — Suporte de armas — 1,6×0,5, campo `largura` 1–3 — armazenamento — forja, porao, corredor — cavalete de madeira com espadas, machados e maças de pé (pomos, guardas e cabeças de machado em fila, variando pela semente).
- `suporte-de-lancas` — Suporte de lanças — 1,2×0,4 — armazenamento — forja, porao, corredor — travessa com 5 a 7 hastes e pontas de aço.
- `manequim-de-armadura` — Armadura em suporte — 0,7×0,6 — decoracao — forja, corredor, sala, quarto — base em cruz, peitoral, ombreiras e elmo com crista.
- `mesa-de-armas` — Mesa do armeiro — 1,8×0,8 — mesas — forja, porao — mesa rústica com duas espadas, um elmo, adaga, pano e pedra de afiar.
- `barril-de-flechas` — Barril de flechas — 0,6×0,6 — armazenamento — forja, porao — barril aberto com penas de flechas coloridas saindo.
- `escudos-empilhados` — Escudos encostados — 1,0×0,7 — decoracao — forja, porao, corredor — três escudos (redondo, amêndoa, heráldico) sobrepostos, cores pela semente.
- `armas-caidas` — Armas caídas — 1,2×1,0 — decoracao — porao, forja, jardim — espada, machado e elmo largados no chão, em ângulos pela semente; baixo (z ≤ 0,15).
- `alvo-de-arqueiro` — Alvo de arqueiro — 1,0×0,6 — exterior — jardim — fardo de palha em cavalete com os anéis do alvo (elipse achatada, pois está de pé) e duas flechas cravadas.
- `boneco-de-treino` — Boneco de treino — 0,9×0,7 — exterior — jardim, forja — poste com braço cruzado, saco de palha remendado e um escudo velho.
- `balista` — Balista — 2,2×2,4 — exterior — jardim, varanda — base, calha com virote, arco de aço atravessado e corda.
- `catapulta` — Catapulta — 2,4×3,4 — exterior — jardim — chassi com quatro rodas, braço com colher e pedra, guincho e cordas.
- `canhao` — Canhão — 1,2×2,2 — exterior — jardim, varanda, porao — carreta de madeira com duas rodas e tubo de bronze/ferro com anéis.
- `pilha-de-balas` — Pilha de balas de canhão — 0,7×0,7 — exterior — jardim, porao, varanda — pirâmide de esferas de ferro (camadas em z crescente).
Receitas de parede:
- `machados.cruzados` — Machados cruzados — 1,0 — taverna, sala, forja, corredor.
- `escudo.parede` — Escudo de parede — 0,7 — taverna, sala, corredor, forja — redondo com umbo; campo `cor` (material, padrão `tecido.veludo-vinho`).
- `arco.parede` — Arco e aljava — 0,9 — taverna, sala, forja, quarto.
- `lancas.parede` — Lanças na parede — 1,8, campo `largura` 1,2–3 — corredor, forja, sala, porao — duas ou três lanças na horizontal em ganchos.
Testes: todos os ids existem com o tipo certo; `suporte-de-armas` e `lancas.parede` mudam de pegada com `largura` e respeitam os limites; `suporte-de-armas`, `escudos-empilhados` e `armas-caidas` variam com a semente e são determinísticos; `escudo.parede` usa o material pedido.
Pronto quando: 17 receitas no arquivo, `typecheck` e `npm test` verdes.
Commit: `weapons and garrison recipes`

### M2 — Objetos de igreja  ✅
Objetivo: mobiliar capela, igreja, cripta e mosteiro além do altar e do banco.
Arquivos: preencher `src/procedural/receitas/igreja.ts` (`RECEITAS_DE_IGREJA`); criar `tests/unit/acervo-igreja.test.ts`.
Todas com `funcoes` incluindo `capela` (cripta e túmulos também `porao`).
Receitas de piso:
- `pulpito` — Púlpito — 1,2×1,2 — decoracao — tribuna octogonal de madeira com degraus atrás e atril com livro.
- `pia-batismal` — Pia batismal — 0,9×0,9 — decoracao — bacia de pedra octogonal com água (`#5d8aa0`) e base.
- `confessionario` — Confessionário — 2,2×1,1 — armazenamento — três cabines de madeira escura, cortina vinho no centro, treliças nas laterais.
- `genuflexorio` — Genuflexório — 0,7×0,6 — assentos — apoio inclinado com almofada vinho para os joelhos.
- `atril` — Atril com livro — 0,6×0,6 — decoracao — capela, biblioteca — pé de latão com livro aberto e fita marcadora.
- `tocheiro` — Tocheiro — 0,5×0,5 — lareira-e-luz — capela, sala, corredor — candelabro de pé: base de ferro, pratos e 3 a 5 velas com chama.
- `velas-votivas` — Velas votivas — 1,2×0,5 — lareira-e-luz — bancada de ferro em degraus com fileiras de velas, algumas acesas pela semente.
- `sarcofago` — Sarcófago — 1,1×2,3 — decoracao — capela, porao — arca de pedra com tampa e efígie deitada (cabeça, mãos postas, espada).
- `caixao` — Caixão — 0,8×2,0 — decoracao — capela, porao — forma hexagonal alongada de madeira com cruz de latão; campo `madeira` (material).
- `orgao-de-tubos` — Órgão de tubos — 2,6×1,0 — decoracao — móvel com tubos de estanho em degraus (mais altos no centro), teclado duplo e banco.
- `relicario` — Relicário em pedestal — 0,6×0,6 — decoracao — pedestal de pedra, caixa dourada com vidro e gema.
- `imagem-de-santo` — Imagem de santo — 0,8×0,8 — decoracao — capela, jardim — pedestal, figura de manto (cor pela semente entre azul, branco e vinho), auréola dourada e velas aos pés.
- `passadeira` — Passadeira da nave — 1,4×6,0, campos `largura` 1–2,5 e `comprimento` 2–14 — tapetes — capela, corredor, sala — faixa vinho com barras douradas e franjas nas pontas; baixa (z ≈ 0,02), `sombraLeve` ou `semSombra`.
- `sino` — Sino de bronze — 1,0×1,0 — decoracao — capela, jardim — sino visto de cima (anéis concêntricos de bronze) com cabeçote de madeira.
Receitas de parede:
- `crucifixo` — Crucifixo — 0,6 — capela, quarto, hospital.
- `vitral` — Vitral — 1,2, campo `largura` 0,8–2,4 — capela, biblioteca, sala — arco ogival de chumbo com vidros coloridos sorteados pela semente (`vidro: true` nas peças).
- `pia-de-agua-benta` — Pia de água benta — 0,5 — capela — concha de pedra com água; aparece bem no `topo`.
- `icone.parede` — Ícone dourado — 0,5 — capela, quarto, corredor — tábua dourada com figura e auréola.
Testes: todos os ids existem com o tipo certo e têm `capela` nas funções; `passadeira` e `vitral` respondem aos campos e limites; `vitral`, `velas-votivas` e `imagem-de-santo` variam com a semente; `caixao` usa a madeira pedida.
Pronto quando: 18 receitas no arquivo, `typecheck` e `npm test` verdes.
Commit: `church and crypt recipes`

### M3 — Escadas, mesas, camas e assentos medievais  ✅
Objetivo: o mobiliário de castelo, estalagem e caserna que falta, e escadas para ligar andares.
Arquivos: preencher `src/procedural/receitas/castelo.ts` (`RECEITAS_DE_CASTELO`); criar `tests/unit/acervo-castelo.test.ts`.
Ler também: a `escada.externa` em `receitas/exterior.ts` (degraus com `z` crescente: é o que faz a escada "subir").
Escadas (categoria `decoracao`, funções `corredor, porao, sala, taverna`; a subida vai de `+y` (embaixo) para `−y` (em cima), com degraus alternando dois tons e `z` crescente):
- `escada.madeira` — Escada de madeira — 1,2×2,6, campos `largura` 0,8–2,4 e `comprimento` 1,6–5 — degraus de tábua (um a cada ~0,28 m), longarinas e corrimão de um lado.
- `escada.pedra` — Escada de pedra — 1,4×2,8, campos `largura` 1–4 e `comprimento` 1,6–6 — degraus de laje gastos, sem corrimão, com muretas baixas.
- `escada.caracol` — Escada em caracol — 2,2×2,2, campo `diametro` 1,6–3,6 — 12 a 16 degraus em leque (polígonos em cunha) ao redor de um pilar central, `z` subindo ao girar.
- `escada.de-mao` — Escada de mão — 0,5×2,4, campo `comprimento` 1,6–4 — dois montantes e travessas.
- `alcapao` — Alçapão — 1,0×1,0 — tampa de tábuas com ferragens e argola, rente ao chão (z ≈ 0,04, `sombraLeve`); também função `cozinha`.
Mesas (categoria `mesas`):
- `mesa.cavalete` — Mesa de cavalete — 2,2×0,8, campo `largura` 1,4–4 — taverna, sala-de-jantar, cozinha, forja — tampo de tábuas largas sobre dois cavaletes que aparecem nas pontas.
- `mesa.banquete` — Mesa de banquete posta — 4,0×1,1, campo `largura` 2,4–7 — sala-de-jantar, taverna, sala — tampo escuro com caminho de mesa vinho, pratos e canecas a cada ~0,7 m dos dois lados, travessa com assado, pães, jarra e dois castiçais; quantidade proporcional à largura.
- `mesa.redonda-rustica` — Mesa redonda rústica — 1,1×1,1, campo `diametro` 0,8–2 — taverna, cozinha — tábuas com aro de ferro, caneca, vela e cartas ou dados.
- `bancada.trabalho` — Bancada de trabalho — 1,8×0,7, campo `largura` 1,2–3 — forja, porao — tampo grosso com torno, martelo, serrote, formão e aparas.
Camas (categoria `camas`):
- `enxergao` — Enxergão de palha — 0,9×1,9 — quarto, taverna, porao, hospital — colchão de saco de estopa no chão, palha escapando pelas bordas, cobertor dobrado; campo `cobertor` (material, padrão `tecido.linho`).
- `monte-de-palha` — Monte de palha — 1,6×1,3 — porao, jardim, quarto — monte irregular de palha para dormir (silhueta orgânica, fios soltos, forma pela semente).
- `saco-de-dormir` — Rolo de dormir — 0,7×1,9 — quarto, jardim, porao — pele/manta estendida com travesseiro de trouxa; campo `manta` (material, padrão `tecido.verde`).
- `cama.dossel` — Cama com dossel — 1,8×2,2 — quarto — quatro colunas, dossel de tecido cobrindo a cabeceira (só meia cama, para a colcha e os travesseiros aparecerem), cortinas presas nos cantos; campo `tecido` (material, padrão `tecido.veludo-vinho`).
- `beliche` — Beliche de caserna — 1,0×2,0 — quarto, taverna, porao — estrado de cima visto inteiro, escadinha lateral, cobertor cinza e travesseiro.
Assentos (categoria `assentos`):
- `trono` — Trono — 1,1×1,0 — sala, capela — estrado baixo, assento de veludo, espaldar alto com remates dourados, braços com pomos.
- `banqueta` — Banqueta de três pés — 0,4×0,4 — taverna, cozinha, forja, porao — assento redondo de madeira com três pés aparecendo.
- `cadeira.espaldar` — Cadeira de espaldar alto — 0,6×0,6 — sala-de-jantar, sala, taverna, capela — assento de couro com tachas e espaldar entalhado.
Testes: todos os ids existem; as quatro escadas e as três mesas com campo mudam de pegada e respeitam limites; nas escadas o `z` máximo dos degraus cresce de `+y` para `−y` (caracol: há pelo menos 10 valores de `z` distintos); `mesa.banquete` com largura maior tem mais partes; `monte-de-palha` varia com a semente; camas usam o material pedido.
Pronto quando: 17 receitas no arquivo, `typecheck` e `npm test` verdes.
Commit: `stairs, tables, beds and seats for castles and inns`

### M4 — Fogo, ofícios, masmorra e acampamento  ✅
Objetivo: o que dá vida a forja, pátio, masmorra e acampamento.
Arquivos: preencher `src/procedural/receitas/masmorra.ts` (`RECEITAS_DE_MASMORRA`); criar `tests/unit/acervo-masmorra.test.ts`.
Fogo (categoria `lareira-e-luz`):
- `braseiro` — Braseiro — 0,7×0,7 — sala, porao, capela, forja, jardim — bacia de ferro em tripé com brasas e chamas pequenas.
- `fogueira` — Fogueira — 1,1×1,1 — jardim — anel de pedras, lenha cruzada, chamas e cinza (pedras e lenha pela semente).
- `caldeirao` — Caldeirão em tripé — 0,9×0,9 — cozinha, taverna, jardim — três pés, corrente, caldeirão de ferro com caldo (`#6a7a34`) e colher.
- `espeto-de-assar` — Espeto de assar — 1,6×0,7 — cozinha, taverna, jardim — duas forquilhas, espeto com assado, manivela e brasas embaixo.
- `tocha.parede` (parede, 0,3) — Tocha de parede — corredor, porao, taverna, capela, forja — suporte de ferro e tocha acesa.
Ofícios:
- `fornalha` — Fornalha de forja — 1,8×1,4 — lareira-e-luz — forja — bloco de tijolo com leito de carvão em brasa, coifa de pedra atrás e fole de couro ao lado.
- `pedra-de-amolar` — Pedra de amolar — 0,9×0,6 — decoracao — forja, jardim — cavalete com roda de pedra de perfil (retângulo estreito), manivela e cocho d'água.
- `tina-de-agua` — Tina d'água — 0,9×0,9 — decoracao — forja, cozinha, jardim, banheiro — meia barrica com aros, água e balde ao lado.
- `roca-de-fiar` — Roca de fiar — 0,9×0,6 — decoracao — quarto, sala — roda raiada, banco e fuso com lã.
- `tear` — Tear — 1,4×1,1 — decoracao — quarto, sala — moldura, fios da urdidura e tecido listrado pela metade (cores pela semente).
- `mo` — Mó de moinho — 0,9×0,9 — decoracao — cozinha, porao, jardim — duas pedras redondas, sulcos radiais, olho central e cabo.
Masmorra (funções `porao`):
- `pelourinho` — Tronco de castigo — 1,4×0,5 — exterior — porao, jardim — duas tábuas com três furos entre dois postes, cadeado.
- `gaiola-de-ferro` — Gaiola de ferro — 0,9×0,9 — decoracao — porao, jardim — grade de barras vista de cima (aro e travessas), argola no topo, chão escuro dentro.
- `mesa-de-tortura` — Potro — 1,0×2,2 — mesas — porao — mesa com roldanas nas duas pontas, cordas, grilhões e manivela.
- `grilhoes.parede` (parede, 0,8) — Grilhões — porao — argola na parede e duas correntes com algemas.
Acampamento (categoria `exterior`, função `jardim`):
- `tenda` — Tenda — 2,4×2,8 — duas águas de lona com cumeeira, abertura na frente (+y) mostrando o interior escuro, estacas e cordas; campo `lona` (material, padrão `tecido.linho`).
- `estandarte` — Estandarte — 0,6×0,9 — também `sala`, `corredor` — base, haste e pano caído para +y com emblema; campo `cor` (material, padrão `tecido.veludo-azul`).
Testes: todos os ids existem com o tipo certo; `fogueira` e `tear` variam com a semente e são determinísticos; `tenda` e `estandarte` usam o material pedido; `tocha.parede` e `grilhoes.parede` são de parede com `topo` não vazio.
Pronto quando: 17 receitas no arquivo, `typecheck` e `npm test` verdes.
Commit: `fire, crafts, dungeon and camp recipes`

---

## Segunda rodada (revisão das pranchas)

Conferência visual: `node <scratchpad>/prancha.ts <pasta-de-saída> armas` assa as receitas de um arquivo no Ilustrado e grava `<pasta>/armas.png` (o caminho do script vai no pedido; ele não entra no repositório).

### M5 — Redesenhar quatro armamentos fracos  ✅
Objetivo: quatro receitas de `armas.ts` não se leem de cima na prancha; refazer o desenho sem mudar id, nome, pegada, categoria, funções nem campos.
Arquivos: mudar `src/procedural/receitas/armas.ts` (só as quatro receitas abaixo e, se preciso, ajudantes novos no topo do arquivo); ajustar `tests/unit/acervo-armas.test.ts` só se o teto de partes atrapalhar.
O que está errado e o que se espera:
- `barril-de-flechas`: hoje é um disco escuro com pontinhos. Quero aro de madeira clara e ferro bem marcados, interior escuro só no fundo, e 10 a 14 flechas **de pé e inclinadas para fora**: cada uma é uma haste curta que passa da borda do barril e termina numa pena em V (dois triângulos claros: branco, vermelho, azul, verde, pela semente). As penas são o que se vê de cima e precisam ser claras e grandes (≈ 6–8 cm). Para caber no teto de partes, a pena pode ser um único `poli` em V.
- `suporte-de-armas`: hoje é uma caixa com pontinhos. Um cavalete visto de cima são duas travessas finas paralelas (frente e trás) com as armas **encostadas e inclinadas para +y**, cada uma longa e reconhecível: 2 espadas (lâmina clara de 0,7 m a 0,9 m com guarda), 1 machado (cabeça de aço em crescente), 1 maça (cabeça redonda com cravos); a ordem varia pela semente. As armas saem um pouco da pegada para a frente (dentro da folga de 25%).
- `suporte-de-lancas`: travessa com 5 a 7 lanças **em leque**, hastes de madeira clara longas que se abrem para +y e terminam em pontas de aço em folha bem visíveis; base pesada atrás.
- `manequim-de-armadura`: hoje miúdo. Ocupar a pegada: ombreiras grandes e claras (`#c8ccd4` com contorno), peitoral (elipse larga de aço, com faixa central e, pela semente, tabardo vinho ou azul por cima), elmo redondo grande no centro com fenda da viseira escura voltada para +y e crista (vermelha ou pluma), braços de malha pendentes dos lados, base em cruz de madeira só nas pontas.
Não fazer: mudar outras receitas; mudar a pegada; mexer em outros arquivos.
Testes: os de `acervo-armas.test.ts` e `receitas.test.ts` seguem verdes (se uma das quatro passar de 25 partes, o teto do teste pode ir a 30 só para ela).
Verificar: `npm run typecheck`, `npm test` e a prancha de `armas`, olhando a imagem e conferindo que as quatro se reconhecem.
Pronto quando: as quatro se leem na prancha; typecheck e testes verdes.
Commit: `clearer weapon rack, spear rack, arrow barrel and armor stand`

### M6 — Mobiliar automático usa o acervo medieval  ✅
Objetivo: cômodos mobiliados no gênero fantasia passam a receber as receitas novas.
Ler: `src/authoring/regras-mobilia.ts` inteiro (`REGRAS_DE_MOBILIA`, `VARIACOES_DE_GENERO`, `regrasPara`), `src/authoring/layout.ts` (como `lugar`, `quantos`, `junto` e `sobre` são usados), `tests/unit/regras-mobilia.test.ts`, `tests/unit/kit-moderno.test.ts`, `tests/unit/kit-detalhes.test.ts`, `tests/unit/kit-investigacao.test.ts`.
Arquivos: mudar `src/authoring/regras-mobilia.ts`; criar `tests/unit/mobilia-medieval.test.ts`.
Como (o mecanismo já existe): `regrasPara` tira das alternativas, para cada gênero, as receitas cujo `generos` não o inclui, e um item sem alternativa some (com quem dependia dele). Logo:
- **Itens novos** entram em `REGRAS_DE_MOBILIA` com receitas só de fantasia: aparecem na fantasia e somem sozinhos no moderno e na investigação. Os de igreja (`generos: ['fantasia', 'investigacao']`) aparecem também na investigação, o que é desejado.
- **Trocas** de algo que já existe vão em `VARIACOES_DE_GENERO.fantasia.trocar`.
- Todo item novo com `quantos` mínimo 0, exceto onde dito. Prioridades depois das existentes da função (use decimais), para não tirar lugar do que já entra hoje.
Itens novos por função (id do item — receitas — lugar — quantos — extra):
- capela: `pulpito` — pulpito — canto — [0,1] — areaMinima 16; `pia-batismal` — pia-batismal — canto — [0,1] — areaMinima 14; `tocheiro` — tocheiro — junto de `altar`, ao-lado — [1,2]; `velas` — velas-votivas — parede — [0,1]; `confessionario` — confessionario — parede — [0,1] — areaMinima 24, alto; `imagem` — imagem-de-santo — canto — [0,2] — areaMinima 12; `orgao` — orgao-de-tubos — parede — [0,1] — areaMinima 30, alto; na-parede: `vitral` — vitral — [1,2]; `crucifixo` — crucifixo, icone.parede — [0,2]; `agua-benta` — pia-de-agua-benta — [0,1].
- forja: `amolar` — pedra-de-amolar — parede — [0,1]; `tina` — tina-de-agua — junto de `bigorna`, ao-lado — [0,1]; `suporte-armas` — suporte-de-armas, suporte-de-lancas — parede — [0,1] — alto; `mesa-armas` — mesa-de-armas, bancada.trabalho — parede — [0,1] — areaMinima 14; `armadura` — manequim-de-armadura — canto — [0,1] — areaMinima 12; `flechas` — barril-de-flechas — canto — [0,1]; na-parede: `tocha` — tocha.parede — [1,2]; `armas-parede` — escudo.parede, machados.cruzados, lancas.parede — [0,2]. Troca na fantasia: `forja:lareira` → fornalha.
- taverna: na-parede `tocha` — tocha.parede — [0,2]; item existente `espadas` passa a ter as alternativas espadas.cruzadas, machados.cruzados, escudo.parede, arco.parede (todas de fantasia; a investigação já não recebia espadas.cruzadas); `espeto` — espeto-de-assar — parede — [0,1] — areaMinima 20. Trocas na fantasia: `taverna:mesa` → mesa.taverna, mesa.redonda-rustica; `taverna:cadeira` → banco, banqueta.
- cozinha: `caldeirao` — caldeirao — canto — [0,1]; `espeto` — espeto-de-assar — parede — [0,1] — areaMinima 14; `tina` — tina-de-agua — canto — [0,1]. Trocas na fantasia: `cozinha:mesa` → mesa.taverna, mesa.cavalete; `cozinha:cadeira` → banco, banqueta.
- quarto: `roca` — roca-de-fiar — canto — [0,1] — areaMinima 10; `tear` — tear — parede — [0,1] — areaMinima 14. Trocas na fantasia: `quarto:cama` → catre, enxergao; `quarto:cama.casal` → cama.dossel.
- sala: `estandarte` — estandarte — canto — [0,2] — areaMinima 16; `armadura` — manequim-de-armadura — canto — [0,1] — areaMinima 16; `tocheiro` — tocheiro — canto — [0,1].
- sala-de-jantar: trocas na fantasia `sala-de-jantar:mesa` → mesa.cavalete, mesa.banquete; `sala-de-jantar:cadeira` → cadeira.espaldar.
- corredor: na-parede `tocha` — tocha.parede — [0,2]; `armadura` — manequim-de-armadura — canto — [0,1]; `estandarte` — estandarte — canto — [0,1]; na-parede `armas-parede` — escudo.parede, lancas.parede — [0,1].
- porao: `escada` — escada.madeira, escada.pedra — parede — [0,1] — areaMinima 10, alto; na-parede `tocha` — tocha.parede — [0,2].
- hospital: troca na fantasia `hospital:cama` → catre, enxergao.
Não fazer: masmorra (gaiola, potro, tronco, grilhões), sarcófago, caixão, armas de cerco e acampamento **não** entram no automático (não há função de cômodo para eles e não cabem num porão qualquer); não criar funções de cômodo; não mexer em `layout.ts`, receitas, exemplos (`public/exemplos/`) nem no assistente. Se um teste existente que fixa o resultado do mobiliar mudar para investigação ou moderno, pare e reporte em vez de atualizar o esperado (exceto capela na investigação, que pode mudar por causa dos itens de igreja).
Testes (`mobilia-medieval.test.ts`): toda receita citada nas regras e nas trocas existe no acervo; `regrasPara('forja', 'fantasia')` tem fornalha e tocha.parede; `regrasPara('capela', 'investigacao')` tem vitral e púlpito; `regrasPara(f, 'moderno')` não tem nenhuma receita do kit fantasia para todas as funções; mobiliar (pela mesma função que os testes de layout já usam) uma capela, uma forja e uma taverna de 6×5 m na fantasia dá objetos sem sobreposição bloqueante (use o critério que os testes de layout existentes usam) e com pelo menos uma receita nova cada.
Verificar: `npm run typecheck` e `npm test`.
Pronto quando: os testes novos e todos os existentes verdes.
Commit: `auto-furnish uses medieval recipes in fantasy rooms`
