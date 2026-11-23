# Frente Q — Épocas e cenários

Planejada em 2026-11-20. O objetivo é chegar à variedade do Inkarnate: mapas de várias épocas (Antiguidade, Oriente, deserto, faroeste, colonial e pirata, vitoriano e steampunk, moderno, pós-apocalíptico e cyberpunk) e de vários cenários (deserto, selva, outono, vulcão, subterrâneo exótico, praia, cidade).

Divisão do trabalho, como manda o `CLAUDE.md`: o **Opus** faz tudo o que é visual (curadoria e pintura de terreno, materiais, brilho próprio, receitas, plantas geradas, mapas de exemplo). O **Sonnet** faz domínio e interface (marcas de época, filtro, gêneros, regras de mobília). As fichas marcadas com **[Opus]** são feitas pelo Opus. As demais vão ao Sonnet, com esforço medium, uma ficha por subagente.

O estilo Pixel está em espera: os assets novos só precisam ficar bons no Ilustrado, e o Pixel não pode quebrar (o teste da coleção e o derivado automático continuam passando).

## Problema

- **Épocas:** há três gêneros em `GENEROS` (`investigacao`, `moderno`, `fantasia`); `ficcao-cientifica` está planejado na E4 ([acervo-ampliado.md](acervo-ampliado.md)). O acervo de cerca de 355 itens cobre bem a casa dos anos 1920 e o medieval, cobre pouco o moderno (4 famílias) e não tem nada de Antiguidade, Oriente, deserto, faroeste, colonial, steampunk, pós-apocalíptico ou cyberpunk.
- **Cenários:** os 35 materiais de terreno são todos de clima temperado ou frio. Não há duna, terra rachada, selva, folhas de outono, asfalto, basalto, lava nem chão de fungos. Na natureza também faltam palmeira de praia, cacto, cerejeira, bambu, árvore de selva e cogumelo gigante.
- **Pisos, paredes e telhados** são quase todos europeus.
- **Brilho próprio:** o motor não tem parte de objeto nem água que brilhe acima do mapa de luz. Uma luz (`PRESETS_DE_LUZ`) ilumina em volta, mas o objeto continua escuro à noite. Por isso lava, néon, cristal, tela e brasa não ficam convincentes. **É do motor, não do desenho**, e vem antes dos kits que dependem dele (Q8).
- **Volume:** sem filtro, centenas de itens novos devolvem a biblioteca ao scroll infinito que a Frente O resolveu.

## Decisões

1. **Época é gênero.** O gênero já guia a mobília, a paleta e as luzes do assistente, e a receita já tem `generos?: string[]`. Por isso não se cria um eixo novo de "época": os estilos de época viram gêneros. Gêneros desta frente: `antiguidade`, `oriental`, `deserto`, `faroeste`, `colonial`, `vitoriano`, `pos-apocaliptico` e `cyberpunk`. Somam-se a `investigacao`, `moderno`, `fantasia` e `ficcao-cientifica` (E4).
2. **Cenário é bioma**, uma marca à parte, que vale só para a natureza e o terreno: `temperado`, `frio`, `deserto`, `tropical`, `outono`, `vulcanico`, `subterraneo`, `urbano` e `mar`.
3. **A marca fica na família, não no item.** `Familia` ganha `generos?` e `biomas?`. Família sem `generos` é atemporal e aparece em qualquer gênero (pedra, caixote, barril). `GrupoDeTerreno` e o `Material` de terreno ganham `biomas?`. Há um teste que exige `generos` em toda família com receita que também tenha `generos`, para as duas marcas não divergirem.
4. **O filtro é preferência do editor, com padrão vindo do mapa.** A biblioteca abre filtrada pelo gênero do mapa, mais os atemporais. Um chip "Todas as épocas" desliga o filtro. A escolha manual fica no `localStorage`, com `try/catch`, como `objetosNaGrade`. O documento do mapa não muda de formato.
5. **Texturas só CC0** (Poly Haven, ambientCG), na infraestrutura da Frente P: a curadoria em prancha é aprovada pelo usuário, `scripts/preparar-texturas.ts` prepara os arquivos, e cada um entra no `LICENCAS.md`.
6. **Plantas e árvores novas são geradas** (`src/procedural/pesados/plantas.ts`, assadas por `npm run assar` em `public/colecao/gerados/`), como as árvores de hoje. Objetos são receitas.
7. **Tamanho de kit:** cada época tem duas fichas de objetos [Opus] com 12 a 16 itens cada, uma ficha de gênero (Sonnet) e um mapa de exemplo [Opus]. O mapa de exemplo fecha a época: se algo destoar na composição, a correção sai ali mesmo, antes da época seguinte.
8. **Ids** seguem o estilo do acervo: português, kebab-case, e ponto para variante (`coluna.dorica`, `carro.sedan`). Todo item novo entra numa família em `familias.ts` (já há teste para isso) e, quando for de época, com `generos` na receita.

## Ordem

| Bloco | Fichas | Quem | Depende de |
| --- | --- | --- | --- |
| 1. Base | Q1 → Q2 → Q3 | Sonnet | — |
| 2. Brilho próprio | Q4 | Opus | — |
| 3. Terreno | Q5 → Q6, Q7, Q8, Q9 | Opus | Q5 (curadoria); Q9 depende da Q4 |
| 4. Pisos, paredes, telhados | Q10, Q11, Q12 | Opus | Q12 depende da Q4 |
| 5. Biomas | Q13, Q14 | Opus | Q14 depende da Q4 |
| 6. Épocas | Q15 … Q23 (a, b, c, d em cada) | Opus (a, b, d), Sonnet (c) | Q3; cada época depende dos materiais e biomas que usa |

Ordem recomendada das épocas: Antiguidade, Oriental, Deserto, Faroeste, Colonial, Vitoriano, Moderno, Pós-apocalíptico, Cyberpunk. O Pós-apocalíptico reaproveita os carros do Moderno, e o Cyberpunk depende da E4 e do Moderno.

Os blocos 1 a 5 podem andar em paralelo, desde que se respeitem as dependências. Cada mapa de exemplo (`d`) é mostrado ao usuário ao lado da referência antes de seguir para a próxima época.

---

## Bloco 1 — Base

### Q1 — Gêneros e biomas nas famílias  ✅
Objetivo: cada família diz a que épocas e biomas serve.
Depende de: —.
Ler: `src/procedural/familias.ts` (inteiro), `src/procedural/grupos-de-terreno.ts`, `src/procedural/receitas/comum.ts` (`Receita.generos`, `kit`), `src/domain/presets.ts` (`GENEROS`), o teste de famílias em `tests/unit/` (procure `FAMILIAS`).
Arquivos: mudar `familias.ts`, `grupos-de-terreno.ts` e o teste de famílias.
Como:
1. `Familia` ganha `generos?: readonly string[]` e `biomas?: readonly string[]`. O helper `f` recebe um 5º argumento opcional `{ generos?, biomas? }`.
2. `export const BIOMAS = [{ id: 'temperado', nome: 'Temperado' }, { id: 'frio', nome: 'Frio e neve' }, { id: 'deserto', nome: 'Deserto' }, { id: 'tropical', nome: 'Tropical' }, { id: 'outono', nome: 'Outono' }, { id: 'vulcanico', nome: 'Vulcânico' }, { id: 'subterraneo', nome: 'Subterrâneo' }, { id: 'urbano', nome: 'Urbano' }, { id: 'mar', nome: 'Mar e praia' }] as const`.
3. Classificar as famílias existentes, deixando atemporal tudo o que serve a qualquer época:
   - `moderno` (grupo inteiro), `tv-de-parede`, `notebook`, `vaso-sanitario`, `escrivaninha`: `['moderno', 'investigacao']` quando o item serve aos dois (o `notebook` só ao moderno);
   - grupo `ficcao`: `['ficcao-cientifica', 'cyberpunk']`;
   - `maquina-de-cerco`, `pelourinho`, `suporte-de-armas`, `treino`: `['fantasia']`;
   - `banco-de-igreja`, `crucifixo`, `orgao-de-tubos`: `['fantasia', 'investigacao', 'colonial', 'vitoriano']`;
   - natureza: `arvore-nevada`, `monte-de-neve` com `biomas: ['frio']`; `arvore`, `carvalho`, `arvore-da-mata`, `samambaia`, `folhico`, `brotos` com `['temperado']`; `pinheiro` com `['temperado', 'frio']`; `palmeira`, `folhagem-tropical`, `costela-de-adao` com `['tropical']`; `coral`, `planta-aquatica` com `['mar', 'tropical']`; `estalagmite` com `['subterraneo']`; `arvore-morta`, `arbusto-seco` com `['temperado', 'frio', 'deserto']`.
   - Na dúvida, deixe atemporal.
4. `GRUPOS_DE_TERRENO`: cada grupo ganha `biomas` (ex.: `neve` → `['frio']`; `areia` → `['deserto', 'mar']`; `calcamento` → `['urbano', 'temperado']`).
5. `familiasVisiveis(genero: string | null, bioma: string | null): Familia[]`. `null` não filtra. Uma família sem a marca correspondente aparece sempre.
Não fazer: a interface (Q2), gêneros novos (Q3).
Testes: todo gênero citado existe em `GENEROS` ou na lista dos planejados (`GENEROS_PLANEJADOS`, um array temporário no teste: `antiguidade`, `oriental`, `deserto`, `faroeste`, `colonial`, `vitoriano`, `pos-apocaliptico`, `cyberpunk`, `ficcao-cientifica`); todo bioma citado está em `BIOMAS`; se uma receita tem `generos`, a família dela também tem e os conjuntos se cruzam; `familiasVisiveis('fantasia', null)` não traz `notebook`, mas traz `caixote`.
Pronto quando: os testes passam, e a biblioteca continua igual (nada lê a marca ainda).
Commit: `families are tagged with genres and biomes`
Nota: o teste mostrou famílias mistas (o `caixote` tem uma receita só de ficção científica e outras livres). Exigir `generos` nelas tiraria o caixote da fantasia, então a regra ficou: família com `generos` cruza com cada receita marcada dela; família sem `generos` só é aceita se ao menos uma receita dela for livre. As famílias em que toda receita tem `generos` (lareira, piano, mesa de jogo, mesa de jantar, relógio de pé, banheira, pia, baú, forja, altar, munição, armas de parede, castiçal, passadeira, sino, alçapão, mesa posta, bancada, fogueira, tear, grilhões) ganharam a união dos gêneros das receitas.

### Q2 — Filtro de época e bioma na biblioteca  ✅
Objetivo: a biblioteca e a gaveta de terreno mostram, de início, só o que combina com o mapa.
Depende de: Q1.
Ler: `src/ui/Biblioteca.tsx` (onde monta grupos, famílias e `GRUPOS_DE_TERRENO`, linha ~129), como `objetosNaGrade` é guardado no `localStorage` (procure em `src/ui/` e `src/app/`), `src/domain/mapa.ts` (`style.genre`), `INTERFACE.md` (padrões de chip).
Arquivos: mudar `Biblioteca.tsx` e o estado de preferências do editor; criar um teste e2e curto, ou estender o da biblioteca.
Como:
1. No topo da biblioteca, uma linha de chips de época: "Deste mapa" (padrão, que usa `style.genre` do mapa), um chip por gênero e "Todas". A escolha manual vai para `localStorage['atlas.filtroDeEpoca']` com `try/catch`. "Deste mapa" acompanha a troca de gênero do mapa.
2. Dentro do grupo Natureza e na gaveta de Terreno, uma linha de chips de bioma, com "Todos" como padrão, guardada em `atlas.filtroDeBioma`.
3. A busca ignora os filtros. Quem procura pelo nome quer achar o item; o resultado de fora do filtro aparece com um selo do gênero.
4. Recentes e favoritos não são filtrados.
5. Quando o filtro esvazia um grupo, o grupo some. Se esvaziar tudo, aparece a mensagem "Nada desta época aqui — ver todas" com o atalho.
Não fazer: gêneros novos (Q3).
Testes: e2e: um mapa `fantasia` não mostra `notebook` na grade; com "Todas", mostra; a busca por "notebook" acha mesmo filtrado.
Pronto quando: abrir um mapa de fantasia deixa a biblioteca visivelmente mais curta, e "Todas" devolve tudo.
Commit: `library filters by the map's era and by biome`
Nota: o catálogo de objetos mora em `src/ui/FamiliaNoPincel.tsx` (não em `Biblioteca.tsx`); o estado fica em `src/app/filtros.ts`. O chip de bioma dos objetos só aparece (e só vale) no grupo Natureza; a gaveta de terreno filtra só por bioma. O catálogo flutuante obedece ao mesmo filtro. Recentes e favoritos não são filtrados. Teste: `tests/e2e/filtro-epoca.test.ts`.

### Q3 — Gêneros de época  ✅
Objetivo: os oito gêneros novos existem, podem ser escolhidos e têm paleta, luz e materiais básicos.
Depende de: Q1. Pode correr em paralelo com a Q2. A E4 (`ficcao-cientifica`) continua uma ficha à parte, em [acervo-ampliado.md](acervo-ampliado.md).
Ler: `src/domain/presets.ts` (`GENEROS`, `PRESETS_DE_LUZ`, `telhadoPadrao`), `src/authoring/mobiliar.ts` (`MATERIAIS_POR_GENERO`, `PALETAS_POR_GENERO`, `materiaisDe`), `src/authoring/luzes.ts` (`LUZES_POR_GENERO`), a ficha E4 (o formato que ela segue), `src/ui/Inspetor.tsx` (escolha de gênero).
Arquivos: mudar `presets.ts`, `mobiliar.ts` e `luzes.ts`; testes em `tests/unit/presets.test.ts`; retirar o `GENEROS_PLANEJADOS` do teste da Q1 (os gêneros passam a existir de verdade).
Como:
1. `GENEROS` recebe as entradas abaixo (`alvoDeCor`: saturação, luminância, tinta):
   - `antiguidade`, "Antiguidade": "Mármore, bronze, lucernas" (0,42, 0,5, `#f3e6cc`);
   - `oriental`, "Oriental": "Papel, laca, lanternas" (0,4, 0,42, `#f2e2c4`);
   - `deserto`, "Deserto": "Adobe, tecido, lanternas de latão" (0,5, 0,52, `#f7dcb0`);
   - `faroeste`, "Faroeste": "Tábuas, poeira, lampião" (0,4, 0,46, `#f0d6ae`);
   - `colonial`, "Colonial e pirata": "Caiado, convés, velas" (0,44, 0,46, `#f1e0c2`);
   - `vitoriano`, "Vitoriano e steampunk": "Latão, vapor, gás" (0,36, 0,36, `#ecd9b8`);
   - `pos-apocaliptico`, "Pós-apocalíptico": "Ferrugem, lona, fogo de tonel" (0,3, 0,38, `#e2d6c0`);
   - `cyberpunk`, "Cyberpunk": "Néon, chuva, telas" (0,55, 0,3, `#d6e4f4`).
2. `PRESETS_DE_LUZ`: `lucerna` (raio 3,5, `#ffc27a`, intensidade 0,75, tremor 0,2, `fire`), `lanterna-de-papel` (raio 4, `#ffb870`, intensidade 0,8, tremor 0,1, `fire`), `lampiao-a-gas` (raio 5, `#ffe2a8`, intensidade 0,95, tremor 0,05, `fire`), `tonel` (raio 6, `#ff7a2a`, intensidade 1,1, tremor 0,4, `fire`), `neon-rosa` (raio 5, `#ff4fd8`, intensidade 1,1, tremor 0,06, `grid`).
3. `LUZES_POR_GENERO`, principal e pequena por gênero: antiguidade `lucerna`/`vela`; oriental `lanterna-de-papel`/`vela`; deserto `lamparina`/`vela`; faroeste `lamparina`/`vela`; colonial `lamparina`/`vela`; vitoriano `lampiao-a-gas`/`vela`; pós-apocalíptico `tonel`/`lanterna`; cyberpunk `neon`/`neon-rosa`.
4. `MATERIAIS_POR_GENERO` e `PALETAS_POR_GENERO`: por enquanto cada gênero novo **copia** o mais próximo (antiguidade, deserto e oriental copiam `fantasia`; faroeste, colonial e vitoriano copiam `investigacao`; pós-apocalíptico e cyberpunk copiam `moderno`), com um comentário `// trocado na ficha Q1Xc`. Os materiais próprios chegam com as Q10–Q12, e as fichas `c` os ligam.
5. `telhadoPadrao`: sem mudança.
6. **Herança de gênero.** `Genero` ganha `herda?: readonly string[]`. Valores: antiguidade, oriental e deserto herdam `['fantasia']`; faroeste, colonial e vitoriano herdam `['investigacao', 'fantasia']`; pós-apocalíptico herda `['moderno']`; cyberpunk herda `['moderno', 'ficcao-cientifica']`. `familiasVisiveis(genero, …)` (em `familias.ts`) passa a aceitar a família quando ela cita o gênero **ou** um dos gêneros que ele herda. Sem isso, as 21 famílias que a Q1 marcou pela soma das receitas (lareira, piano, castiçal…) sumiriam nos gêneros novos. Para evitar o ciclo de importação, `familias.ts` recebe uma função `generosVisiveis(id): string[]` exportada de `presets.ts`, ou a lógica fica numa função em `presets.ts`. Escolha a que não criar import circular.
Não fazer: tipos de cômodo e regras de mobília (vêm nas fichas `c` de cada época).
Testes: os onze gêneros (doze, com a E4) são escolhíveis; cada um tem luzes que existem no catálogo e materiais para todas as funções que o `investigacao` tem; `herda` só cita gêneros que existem (ou `ficcao-cientifica`, enquanto a E4 não chega); `familiasVisiveis('vitoriano', null)` traz `lareira` e `piano`, e `familiasVisiveis('fantasia', null)` não traz `notebook`.
Pronto quando: o inspetor oferece os gêneros novos; `atlas_mobiliar` num mapa `faroeste` funciona (ainda com o acervo de investigação).
Commit: `added era genres with lights, palettes and base materials`
Nota: `generosVisiveis` ficou em `presets.ts`, que `familias.ts` importa (sem ciclo). Três testes existentes precisaram de ajuste: a lista de `GENEROS` em `dominio.test.ts`, a igualdade entre `VARIACOES_DE_GENERO` e `GENEROS` em `regras-mobilia.test.ts` (virou "só cita gêneros que existem"; as variações dos gêneros novos chegam nas fichas `c`) e o orçamento total das ferramentas em `ponte-escrita.test.ts` (30 KB para 31 KB, pois o enum de gênero cresceu); `scripts/ponte/catalogo-base.json` foi regenerado. `Receita.generos` (via `serve` em `regras-mobilia.ts`) ainda não herda: itens só de `fantasia` não aparecem nos gêneros novos.

### Q2b — Biblioteca enxuta, como a do Inkarnate  ✅
Objetivo: o painel de objetos cabe numa tela sem rolar até a grade: filtros em uma linha e propriedades raras escondidas.
Depende de: Q2.
Problema (captura do usuário, 2026-11-20): duas paredes de chips empilhadas, 13 de época e 15 de grupo, empurram a grade para baixo, e o painel de propriedades mostra Aparência e Colocação sempre abertas. No Inkarnate, a busca e as categorias ficam numa linha, e as opções raras ficam recolhidas.
Ler: `src/ui/FamiliaNoPincel.tsx` (linhas ~100–170: `filtroAtual`, os chips de época, bioma e grupo, a grade), `src/ui/PropriedadesDoObjeto.tsx` (inteiro, 69 linhas), `src/app/filtros.ts`, o CSS dos `chips`/`select` existentes (procure um `<select>` já estilizado em `src/ui/` para copiar a classe), `docs/INTERFACE.md`.
Arquivos: mudar `FamiliaNoPincel.tsx`, `PropriedadesDoObjeto.tsx` e o CSS do painel, se preciso; ajustar `tests/e2e/filtro-epoca.test.ts` e os e2e que clicam nos chips de grupo ou nas propriedades.
Como:
1. **Uma linha de filtros:** a busca ocupa a largura, e logo abaixo vêm dois `<select>` compactos lado a lado: **Grupo** ("Todos os grupos", depois os grupos que o filtro não esvazia) e **Época** ("Deste mapa (Fantasia)", depois os gêneros, depois "Todas as épocas"). Os chips de época e de grupo deixam de existir.
2. **Bioma:** também vira `<select>`, que só aparece quando o grupo é Natureza. Na gaveta de terreno, os chips de bioma viram o mesmo `<select>`.
3. **Recentes e Favoritos** continuam como abas pequenas, mas recolhidas por padrão numa linha "Recentes ▸", com o estado no `localStorage`.
4. **Propriedades:** ficam à vista só **Escala** e **Rotação** (com o dado). **Camada**, **Espelhar**, **Aparência** (opacidade, sombra, bloqueio) e **Colocação** (um/vários, selecionar ao pôr, grade, mais opções) entram num único bloco recolhido **"Ver mais…"**. O estado aberto ou fechado fica no `localStorage` (`atlas.propriedadesAbertas`). Quando "Vários" está ativo, o resumo mostra "Ver mais… (vários)", para o usuário não esquecer.
5. Nada de CSS novo além do necessário: reuse classes e tokens existentes.
Não fazer: mudar a lógica dos filtros, a ordem das famílias ou o que as propriedades fazem.
Testes: e2e atualizados (filtro por `<select>`; "Ver mais…" abre e fecha e guarda o estado); `npm test`.
Pronto quando: com 900 px de altura de janela, o painel mostra a família na mão, a busca, os dois selects e ao menos duas fileiras da grade sem rolar.
Commit: `object library uses compact filters and folds rare properties`
Nota: o estado de "Ver mais…" e de Recentes (`atlas.propriedadesAbertas`, `atlas.recentesAbertos`) mora em `src/app/preferencias.ts`, não em `filtros.ts`. "Ver mais…" guarda Camada e espelho, Aparência e Colocação em cartões próprios; vale também para o inspetor (mesmo componente). `ChipsDeBioma`/`ChipsDeEpoca` viraram `SeletorDeBioma` e os selects da grade. Capturas: `test-results/q2b-painel.png`.

### Q2c — Prévias que não morrem caladas  ⬜
Objetivo: se o worker das prévias falhar, a biblioteca se recupera ou avisa, em vez de ficar com todos os quadros vazios para sempre.
Depende de: —.
Problema: quando o Vite reotimiza dependências, o import dinâmico falha ("504 Outdated Optimize Dep"), e o worker do baker das prévias (`src/ui/previa.ts`, `criarBaker({ workers: 1 })`) morre sem rejeitar as promessas. Como `pedirPrevia` guarda a promessa no cache e o `MiniReceita` engole o erro, nada mais aparece até recarregar a página.
Ler: `src/procedural/baker.ts` (criação dos workers, fila, `pedir`), `src/procedural/bake.worker.ts`, `src/ui/previa.ts`, `src/ui/FamiliaNoPincel.tsx` (`MiniReceita`).
Arquivos: mudar `baker.ts` e `previa.ts`; um teste unitário do baker, se ele já tiver testes (procure em `tests/unit/`), senão um teste do comportamento de `previa.ts` com baker falso.
Como:
1. No `baker.ts`, os eventos `error` e `messageerror` do worker rejeitam todas as tarefas que estavam nele, e o worker é recriado na próxima `pedir`, com no máximo 3 tentativas seguidas. Na terceira falha, o baker fica "quebrado" e rejeita na hora.
2. Em `previa.ts`, uma promessa rejeitada sai do cache `previas`, para que a próxima montagem tente de novo.
3. Quando o baker fica quebrado, a primeira falha registra um `console.warn` legível: "As miniaturas pararam de carregar; recarregue a página (Ctrl+Shift+R)". O mapa principal usa outro baker: confira se ele tem o mesmo problema e, se tiver, aplique a mesma recriação.
Não fazer: mudar o formato das tarefas ou a resolução das prévias.
Testes: um worker que dispara `error` rejeita a tarefa pendente e a seguinte cria um worker novo.
Pronto quando: matar o worker das prévias no console (`__atlas` ou um teste) e reabrir a biblioteca mostra as miniaturas de novo.
Commit: `bakers recover when a worker dies`

---

## Bloco 2 — Brilho próprio

### Q4 — Partes e água que brilham  ✅ **[Opus]**
Objetivo: uma parte de objeto, um piso ou uma água pode brilhar acima do mapa de luz, para que lava, néon, cristal, tela e brasa leiam à noite.
Depende de: —.
Ler: `src/procedural/descricao.ts` (`Parte`), `src/procedural/assar.ts`, `src/procedural/sprite.ts`, `src/render/mapa-de-luz.ts` (a composição HDR), `src/render/halos.ts`, `src/procedural/agua.ts` e o shader de água em `src/render/`.
Arquivos: mudar `descricao.ts` (campo `brilho?: number`, de 0 a 1, na `Parte`), o assado (gera uma segunda saída, a máscara de brilho, só quando alguma parte brilha), o render (soma a máscara depois do mapa de luz, com o bloom da Frente L), `Material` de água (campo `brilho?` e `luzDoBrilho?`) e o shader de água.
Como (o Opus detalha ao começar, conferindo o código):
1. A máscara de brilho é assada junto com o sprite, na mesma resolução, e guardada no cache de assados (`cache-de-assados.ts` com a versão nova). O Pixel ignora a máscara.
2. No render, o sprite continua multiplicado pela luz, e a máscara é somada por cima, na cor da própria parte, antes da curva de tom.
3. Água com `brilho` (lava) não escurece com a noite e pulsa devagar. Nas margens, uma luz derivada (`luzDoBrilho`) ilumina o entorno, sem que o usuário precise pôr luzes à mão.
4. Interagir com a sessão: a névoa de guerra continua escondendo o brilho.
Não fazer: os materiais e objetos que usam o brilho (Q9, Q12, Q14 e kits).
Testes: unitário: a descrição com `brilho` gera máscara e a sem `brilho` não gera; regressão visual da prancha de luz (de noite, um console com tela e uma poça de lava de teste).
Pronto quando: na prancha noturna, a tela e a lava de teste brilham e iluminam em volta, e um mapa sem brilho fica idêntico ao de antes.
Commit: `object parts and water can glow above the light map`
Nota: a parte já existia desde a Frente L. `brilho: true` (sólida ou com `desfoque`) soma a cor e grava emissão no canal G do mapa de altura, e a composição de luz a faz brilhar acima da luz; telas, letreiros e brasas dos kits usam isso. O que faltava era a água: o material de água ganhou `brilho`, e `leitoDaAgua` desenha a lava (placas de crosta por ruído celular, fendas acesas que alargam no fundo, miolo derretido e um clarão chamuscado e laranja de 1,4 m em volta, que ilumina o chão sem luz posta à mão). O assar grava esse calor no canal de emissão e deixa a lava fora da superfície animada (sem ondas nem espuma). O `agua.lava` já entrou no grupo Água (com bioma vulcânico); a Q9 cuida das outras águas. Não há pulsação própria além da cintilação da emissão. Prancha: `node scripts/dev/prancha-terreno.ts --sem-luz agua.lava`.

---

## Bloco 3 — Terreno

Todas as fichas deste bloco seguem o método da Frente P: prancha a 32 px/m ao lado de uma referência na mesma escala, `tingir` só no matiz, luminância da paleta, carimbos com nanquim e a tag `rasteira` no que se repete de propósito.

### Q5 — Curadoria de texturas: lote 2 e biomas novos  ✅ **[Opus]**
Objetivo: escolher as texturas CC0 de todos os terrenos deste bloco, numa prancha aprovada pelo usuário.
Depende de: —.
Ler: a seção "Curadoria (P1)" de [terreno-com-textura.md](terreno-com-textura.md) (formato da prancha e da tabela), `scripts/texturas-aprovadas.json`.
Arquivos: acrescentar a seção "Curadoria (Q5)" no fim deste arquivo; baixar os originais para `data-private/texturas-fonte/` (fora do git). Nada vai para `public/`.
Como: uma linha por material: recomendada, camada extra, alternativas e observação.
- Lote 2 da P: `grama.escura`, `grama.acinzentada`, `lama`, `areia`, `areia.molhada`, `cascalho`, `pedregulho`, `neve`, `neve.funda`, `neve.pisada`, `terra.congelada`.
- Deserto e campo: `areia.duna`, `terra.rachada` (`dry_ground_01`, já separada), `laterita`, `salina`, `terra.arada`, `grama.florida`.
- Selva, outono e cidade: `chao.de.selva`, `folhas.outono` (camada com máscara), `grama.outono`, `asfalto`, `asfalto.rachado`, `concreto.calcada`.
- Vulcão e subterrâneo: `basalto`, `cinza.vulcanica`, `chao.de.fungos`, `cristal.chao`.
Não fazer: preparar ou ligar texturas.
Pronto quando: a prancha está em `test-results/q5-texturas.png` e o usuário aprovou a tabela.
Commit: — (só documentação; entra no commit da Q6 junto com `texturas-aprovadas.json`)

### Q6 — Lote 2 com textura  ✅ **[Opus]**
Objetivo: os onze materiais do lote 2 da Frente P passam a ser pintados com textura.
Depende de: Q5.
Arquivos: `scripts/texturas-aprovadas.json`, `public/colecao/texturas/`, `LICENCAS.md`, `src/procedural/materiais.ts` (`textura` dos onze).
Como: o mesmo fluxo da P4/P5. A neve pisada leva uma camada de pegadas em manchas; a lama leva poças com `areia.molhada` por máscara.
Pronto quando: a prancha dos onze materiais, ao lado da do lote 1, não destoa em tom nem em escala; `npm test` passa (inclusive a regra `repeticao`).
Commit: `second terrain batch is painted from cc0 textures`
Nota: `tingir` 1 é só a paleta; a grama acinzentada pede 0,92, e as neves, 0,15 (a foto já é neutra). O cascalho a 32 px/m perde o grão: virou `gravel_floor` a 2,2× com manchas de `rocks_ground_02`. A neve pisada usa manchas de `snow_03` no lugar da camada de pegadas. A prancha sai de `node scripts/dev/prancha-terreno.ts [materiais…]` (tarde e noite, quadros de 6 m), que também serve às Q7–Q9.

### Q7 — Deserto e campo  ✅ **[Opus]**
Objetivo: terrenos de deserto e de lavoura.
Depende de: Q5.
Arquivos: `materiais.ts`, `grupos-de-terreno.ts` (grupo novo `deserto`, "Deserto e sertão", com `biomas: ['deserto']`, e `campo`, "Campo e lavoura"), texturas e licenças, `receitas/chao.ts` (carimbos).
Como:
- `areia.duna`: textura e ondulações direcionais (`dir` do `pintarMaterial`), clara nas cristas;
- `terra.rachada`, `laterita` (vermelha) e `salina` (branca rachada, com brilho baixo);
- `terra.arada`: fileiras que seguem a direção do pincel;
- `grama.florida`: base de grama com carimbos `flores-do-campo` (`rasteira`);
- carimbos `plantacao.trigo` e `plantacao.milho` em fileiras, e `arrozal` (água rasa `agua.arrozal` com mudas em grade).
Pronto quando: um recorte de 20 × 20 m com duna, oásis e lavoura lê como deserto à primeira vista.
Commit: `added desert and farmland terrain`
Nota: material com textura não aceita padrão procedural por cima, então as dunas não usam o `Ground054`. Elas têm um pintor próprio (`dunas-areia`), com cristas a cada 4–6 m, barlavento claro com ondulações de vento e face de sombra. As cristas variam de força, se fundem e somem. As coordenadas giram com a direção da camada, que é calculada sobre a camada inteira (em `entradas.ts`, como nos sulcos). Calculada por ladrilho, uma faixa estreita no fim do mapa girava 90°. `sulcos` e `dunas-areia` passaram a usar a área do mapa inteiro, para não emendar entre ladrilhos. A `terra.arada` seria o `terra.sulcos` repetido: ele virou "Terra arada" no grupo Campo. A `grama.florida` virou o carimbo `flores-do-campo`, e as lavouras viraram carimbos `plantacao.trigo`, `plantacao.milho` e `plantacao.arroz` (fileiras ao longo do comprimento; o milho tem 2 m e faz sombra), com `agua.arrozal` para as mudas. Grupos novos: "Deserto e sertão" e "Campo e lavoura". Depois da ficha, cada parte conectada da camada passou a ter a própria direção (`componentesDeFaixas` em `orientacao.ts`).

### Q8 — Selva, outono e cidade  ✅ **[Opus]**
Objetivo: terrenos tropicais, de outono e urbanos.
Depende de: Q5.
Arquivos: `materiais.ts`, `grupos-de-terreno.ts` (grupos `selva` e `cidade`; `folhas.outono` e `grama.outono` entram em `grama`, com bioma `outono`), texturas e licenças, `receitas/chao.ts`.
Como:
- `chao.de.selva`: escuro e úmido, com carimbo `folhas-largas` (`rasteira`);
- `folhas.outono`: camada com máscara (como o musgo) sobre grama ou terra, em laranja e vermelho;
- `asfalto`, `asfalto.rachado` (rachaduras e remendos), `concreto.calcada` (placas com junta);
- carimbos urbanos: `faixa-de-pedestre`, `faixa-continua`, `faixa-tracejada`, `bueiro`, `mancha-de-oleo`, `vaga-pintada`. Os pintados seguem a direção do pincel.
Pronto quando: uma rua de 2 faixas com calçada e cruzamento é montada só com o terreno e os carimbos, sem nenhum objeto.
Commit: `added jungle, autumn and city terrain`
Nota: desvios. `folhas.outono` usa a alternativa `forest_floor` (com manchas de `dry_decay_leaves`), porque o preparo de texturas guarda só cor e relevo, e a `ScatteredLeaves007` dependia da transparência. A `grama.outono` é `withered_grass` com manchas de folhas secas. A `concrete_pavement` não tem relevo próprio: o deslocamento não fechava em ladrilho pelo critério do script, e o preparo ganhou `semRelevo`. A sinalização (faixa de pedestre, contínua, tracejada e vaga) é desenhada como carimbo: segue a rotação do objeto, não o pincel, e a tinta é contínua e gasta (falhas e grão, com `desgaste` de 0 a 1). Entraram ainda o `meio-fio`, porque a borda de toda camada de terreno é macia e a cidade precisa de borda nítida, além de `bueiro` (tampa ou grelha), `mancha-de-oleo` e `folhas-largas` para a selva. Grupos novos: Selva e Cidade; as duas de outono entram em Grama. Cena de teste: rua de duas faixas com calçada e cruzamento, só com terreno e carimbos.

### Q9 — Vulcão, subterrâneo e águas novas  ✅ **[Opus]**
Objetivo: terrenos vulcânicos e de caverna exótica, e as águas especiais.
Depende de: Q4 e Q5.
Arquivos: `materiais.ts` (terrenos, maciço e água), `grupos-de-terreno.ts` (grupo `vulcao`), texturas e licenças.
Como:
- terreno: `basalto` (colunas hexagonais vistas de cima), `cinza.vulcanica`, `chao.de.fungos` (com pontos que brilham fraco), `cristal.chao`;
- maciço: `rocha.basalto`, `rocha.cristal` (veios que brilham);
- água: `agua.lava` (já feita na Q4), `agua.tropical` (turquesa, transparente, cáusticas), `agua.acida` (verde, brilho 0,3), `agua.esgoto`.
Pronto quando: à noite, um rio de lava ilumina o basalto em volta sem nenhuma luz posta à mão; a água tropical mostra o fundo de areia.
Commit: `added volcanic and underground terrain with lava and new waters`
Nota: desvios e motor. O `brilho` da água deixou de significar lava: o campo `lava` escolhe o desenho de crosta, e `brilho` sozinho faz a água emitir pela própria cor (a `agua.acida` brilha fraco e continua com ondas e espuma). O maciço ganhou veios que brilham (`brilho` + `veio`, em `veiosDoMacico` no assar), usados pela `rocha.cristal`. O basalto e o cristal são procedurais (`celulaHex`): colunas hexagonais com chanfro, colunas afundadas e rachadas; facetas com degradê próprio. O basalto não usa o grão de `dark_rock_02`, porque material com textura não aceita padrão por cima. O `chao.de.fungos` não emite; os pontos que brilham são o carimbo `fungos-luminosos` (em `receitas/biomas.ts`, que a Q14 amplia). Dois defeitos antigos achados e corrigidos: a espuma da água era uma cor só para todas as camadas (a da primeira, e a lava amarelava todas), e agora cada camada tem a sua; e a lava ocupava uma das 4 vagas de água animada. Cena de teste com vulcão e caverna, de dia e de noite.

---

## Bloco 4 — Pisos, paredes e telhados

Os materiais seguem o padrão de `materiais.ts` (uso `piso`, `papel` ou `telhado`). Telhados passam pelo `assar-telhado.ts` e pelas coberturas da Frente N.

### Q10 — Antiguidade, Oriente e deserto  ✅ **[Opus]**
Objetivo: os materiais das três épocas mais distantes do acervo atual.
Arquivos: `materiais.ts`, `coberturas.ts` (se o telhado pedir relevo próprio).
Como:
- pisos: `mosaico.romano` (tesselas com borda de meandro), `mosaico.medalhao`, `terracota.quadrada`, `lajes.arenito`, `tatami` (módulos 0,9 × 1,8 m com borda escura), `tabuas.laqueadas`, `zellige` (ladrilho geométrico);
- paredes: `estuque.pompeiano` (vermelho com faixa preta), `alvenaria.arenito`, `parede.hieroglifos`, `shoji` (grade de madeira com papel, deixa passar luz), `madeira.laqueada`, `adobe`, `taipa`;
- telhados: `telha.imbrex` (romana), `telha.curva.cinza` (oriental), `terraco.barro` (laje plana de barro com parapeito).
Pronto quando: a prancha de materiais mostra os três estilos lado a lado e cada um se reconhece sem legenda.
Commit: `added ancient, eastern and desert floors, walls and roofs`
Nota: pintores novos: `mosaico` (grade preta com rosetas sobre tesselas), `medalhao` (centrado no cômodo: moldura em meandro e medalhão em faixas com roseta de 8 pétalas), `tatami`, `zellige` (estrelas de 8 pontas), `pompeiano`, `hieroglifos`, `shoji` e `taipa`. Reaproveitados: terracota em `xadrez` (que ganhou rejunte opcional por `borda`), arenito em `lajes-rusticas` e `laje`, tábuas laqueadas em `tabuas`, madeira laqueada em `lambri`, adobe em `manchado`. Cobertura nova `imbrex` (tégula chata com aba e ímbrice redondo na junta); a telha curva cinza usa a `telha-esmaltada`; o terraço de barro é `concreto-laje` com forma `plano` (a capa `platibanda` faz o parapeito). Cenas de teste: oito cômodos (piso e parede de cada época) e três casas (romana em duas águas, cinza em pagode, terraço).

### Q11 — Colonial, faroeste e vitoriano  ✅ **[Opus]**
Como:
- pisos: `conves` (tábuas longas com calafeto e cavilhas), `tijoleira`, `tabuas.gastas`, `ladrilho.hidraulico`;
- paredes: `caiado`, `enxaimel`, `tabuas.descascadas`, `tijolo.fuligem`, `azulejo.portugues`;
- telhados: `telha.capa-canal`, `chapa.rebitada`.
Pronto quando: a prancha mostra os três estilos lado a lado e cada um se reconhece sem legenda.
Commit: `added colonial, frontier and victorian floors, walls and roofs`
Nota: pintores novos: `conves` (pranchas de 4 a 6 m, calafeto de breu, cavilhas nas emendas), `hidraulico` (peças de 25 cm espelhadas formando rosáceas), `enxaimel`, `descascado` (tinta saindo em placas, mais gasta no pé) e `azulejo`. Reaproveitados: tijoleira em `espinha`, tábuas gastas em `tabuas`, caiado em `manchado`, tijolo com fuligem em `laje`, telha colonial em `telha-canal`, com manchas escuras. Cobertura nova `rebitada` (placas desencontradas com rebites, usada também no steampunk). A ficha previa `telha.capa-canal` e `chapa.rebitada`, e os dois ids foram mantidos. Cenas de teste: oito cômodos e três casas.

### Q12 — Pós-apocalíptico e cyberpunk  ⬜ **[Opus]**
Depende de: Q4 (néon).
Como:
- pisos: `concreto.rachado`, `entulho`, `linoleo`, `piso.neon` (faixas que brilham), `grade.cyber`;
- paredes: `concreto.pichado` (pichações geradas, sem texto legível de marca), `chapa.enferrujada`, `painel.neon`, `azulejo.metro`;
- telhados: `chapa.remendada`, e `laje.equipada` (laje com caixas de ar-condicionado e antenas como detalhe, via `detalhes-de-telhado.ts`).
Pronto quando: à noite, o `painel.neon` e o `piso.neon` brilham; de dia, parecem tinta.
Commit: `added post-apocalyptic and cyberpunk floors, walls and roofs`

---

## Bloco 5 — Biomas

### Q13a — Árvores antigas no padrão novo  ✅ **[Opus]**
Objetivo: `arvore`, `carvalho-grande`, `pinheiro`, `arbusto`, `arvore-nevada`, `pinheiro-nevado` e `arbusto-seco` ficam na mesma qualidade da `arvore-da-mata` v12 (copa em nanquim, folhas em tufos, luz e sombra próprias).
Depende de: —. Vem antes da Q13, que usa a mesma técnica para as árvores dos biomas.
Problema (captura do usuário no Jardim do Colosso, 2026-11-20): o `carvalho-grande` (v2) e a `arvore` (v3) são bolas lisas e genéricas ao lado da `arvore-da-mata` refeita para o Acampamento.
Ler: `src/procedural/pesados/plantas.ts` (o gerador da `arvore-da-mata` e os antigos), o histórico do `acampamento-na-nevoa` (git log de `plantas.ts`) e `scripts/assar-colecao.ts`.
Como: extrair da `arvore-da-mata` uma copa parametrizada (tamanho do tufo, densidade, tons, silhueta) e refazer os antigos sobre ela, cada um com caráter próprio: o carvalho largo e irregular, a árvore comum redonda, os pinheiros em camadas de agulhas, as versões nevadas com neve nos tufos de cima. Sobe a `versao` de cada gerador e reassa com `npm run assar`.
Pronto quando: uma prancha com as árvores antigas e as da mata lado a lado não tem uma árvore que destoe; o Jardim do Colosso e o Desfiladeiro Nevado regenerados ficam melhores que antes.
Commit: `older trees share the forest tree's inked crowns`
Nota: a `copaDeRaminhos` ganhou `variantes`, `folha` (escala do raminho), `nanquim` e `galhos`; os padrões não mudaram, então a `arvore-da-mata` saiu igual. `arvore`, `arbusto`, `carvalho-grande` e `arvore-nevada` passaram a usá-la, cada uma com a sua paleta. Os pinheiros ficaram como estavam (já em camadas de agulhas). As miniaturas dos exemplos não foram regeneradas: o Jardim do Colosso tinha mudanças de outra sessão em aberto.

### Q13 — Árvores e plantas geradas  ⬜ **[Opus]**
Objetivo: a vegetação dos biomas novos.
Ler: `src/procedural/pesados/plantas.ts` (`PLANTAS`), `scripts/assar-colecao.ts`, `public/colecao/colecao.json`.
Arquivos: `plantas.ts`, `colecao.json`, os `.webp` gerados, `LICENCAS.md` (bloco gerados) e `familias.ts`.
Como (famílias novas com bioma):
- `arvore-de-selva` (5 e 8 m, copa larga em camadas com cipós pendentes) — `tropical`;
- `coqueiro` (4 e 6 m, inclinado) e `tamareira` (5 m) — `tropical`, `mar`, `deserto`;
- `cacto` (`saguaro` 3 m, `opuntia` 1,5 m, `cacto-redondo` 0,8 m) — `deserto`;
- `cerejeira` (4 e 6 m, flor rosa, e uma variante com pétalas no chão) — `temperado`;
- `bambuzal` (moita de 2 e 4 m) — `tropical`, `temperado`;
- outono: `arvore` e `carvalho` ganham variantes `-outono-laranja` e `-outono-vermelha` (mesma família, bioma `outono` acrescentado à família);
- `arvore-de-mangue` (raízes aéreas sobre a água) — `tropical`, `mar`;
- `baoba` (7 m) — `deserto`, `tropical`.
Pronto quando: uma prancha com cada bioma (selva, praia, deserto, outono, jardim oriental) lê à primeira vista, e as árvores novas usam a mesma luz e o mesmo nanquim das atuais.
Commit: `added jungle, beach, desert, blossom and autumn trees`

### Q14 — Fungos, cristais, praia e outono  ⬜ **[Opus]**
Depende de: Q4.
Arquivos: uma receita nova `receitas/biomas.ts` e o `index.ts`; `familias.ts`.
Como:
- `cogumelo-gigante` (2, 4 e 6 m; campo `brilho`, de 0 a 1) — `subterraneo`, `temperado` (o tufo pequeno já existe: `fungos-luminosos`, da Q9);
- `cristal` (aglomerado de 0,5, 1,5 e 3 m, brilho, campo `cor`) — `subterraneo`;
- `fumarola` (rachadura com vapor; usa o sistema de partículas do clima) — `vulcanico`;
- `concha`, `estrela-do-mar`, `madeira-a-deriva`, `alga-na-areia` — `mar`;
- `cipo-pendente` (de parede de maciço) e `raizes-de-mangue` — `tropical`;
- `cupinzeiro` — `deserto`, `tropical`;
- `monte-de-folhas` (laranja e vermelho) — `outono`.
Pronto quando: uma caverna de fungos com cristais, à noite, se ilumina só com os próprios objetos.
Commit: `added fungi, crystals, beach and autumn props`

---

## Bloco 6 — Épocas

Cada época tem quatro fichas:
- **a e b [Opus]:** receitas num arquivo novo `receitas/<epoca>.ts`, com `kit: '<epoca>'` e `generos: ['<epoca>', …]`, ligadas no `index.ts` e classificadas em `familias.ts` (famílias novas com `generos`, ou itens novos em famílias que já existem). Pronto quando: uma prancha da ficha, de dia e de noite, mostra cada item legível e no tom do acervo.
- **c (Sonnet):** gênero completo, no formato da E4. Ler: a E4 inteira; `presets.ts` (`TIPOS_DE_COMODO`), `regras-mobilia.ts` (`REGRAS_DE_MOBILIA`, `VARIACOES_DE_GENERO`), `mobiliar.ts` (`MATERIAIS_POR_GENERO`, `PALETAS_POR_GENERO`, trocando a cópia provisória da Q3), `luzes.ts` (`LUZES_POR_FUNCAO`), `funcao.ts` (palavras), `espalhar.ts` (`CONJUNTOS_EXTERIORES`). Testes: cada tipo novo tem regras e só cita receitas que existem; os conjuntos só citam receitas que existem; os materiais do gênero existem. Pronto quando: pelo MCP, um mapa do gênero com três cômodos típicos, mobiliado com `atlas_mobiliar`, já parece da época.
- **d [Opus]:** um mapa de exemplo gerado por script em `scripts/exemplos/`, com captura em `public/exemplos/`. A composição é própria, não decalque. É mostrado ao usuário antes de seguir.

### Q15 — Antiguidade (`antiguidade`)  ⬜
- **Q15a — templo e cidade [Opus]:** `coluna.dorica`, `coluna.jonica`, `coluna.corintia` (família `coluna-classica`, campo `altura`), `coluna-classica.caida`, `frontao-caido`, `obelisco`, `estatua-classica` (deus em pé, campo `pose`), `busto-em-pedestal`, `altar-de-sacrificio`, `tripe-de-bronze` (braseiro, brasa com brilho), `estatua-egipcia` (faraó sentado), `esfinge`, `sarcofago.egipcio` (na família `sarcofago`), `painel-de-hieroglifos` (parede), `aquila` (estandarte romano). Commit: `added ancient temple and city kit`
- **Q15b — casa e vida [Opus]:** `triclinio`, `mesa-romana`, `anfora`, `anforas-empilhadas`, `pithos`, `lucerna` (com luz `lucerna`), `tear-vertical`, `biga`, `pergolado-com-videira`, `impluvio` (tanque do átrio com água), `fonte-com-mascara`, `estante-de-rolos`, `banca-de-mercado.toldo`, `lira`. Commit: `added ancient household kit`
- **Q15c — gênero (Sonnet):** tipos `atrio`, `peristilo` (ao ar livre), `triclinio`, `termas`, `templo`, `forum` (ao ar livre), `taberna`; materiais da Q10; conjuntos `ruina-classica` e `mercado-antigo`; palavras: átrio, peristilo, termas, templo, fórum, ágora. Commit: `added ancient genre with rooms and furnishing`
- **Q15d — exemplo [Opus]:** "Vila do átrio" — uma vila romana com peristilo, triclínio e termas, à tarde.

### Q16 — Oriental (`oriental`)  ⬜
Depende de: Q10, Q13 (cerejeira e bambu).
- **Q16a — casa [Opus]:** `mesa-baixa`, `zabuton`, `futon`, `biombo` (campo `folhas`, com pintura), `tansu`, `irori` (fogo no chão, brasa com brilho), `andon` (luz `lanterna-de-papel`), `lanterna-de-papel` (pendurada), `pergaminho-de-parede`, `ikebana`, `bonsai`, `suporte-de-espadas`, `armadura-oriental` (no suporte), `bule-e-xicaras.oriental`. Commit: `added eastern household kit`
- **Q16b — jardim e templo [Opus]:** `torii`, `lanterna-de-pedra`, `ponte-arqueada` (campo `vao`), `sino-de-templo` (com estrutura), `incensario`, `guardiao-de-pedra` (par), `estatua-sentada`, `carpas` (submerso, no lago), `rastelado` (carimbo de cascalho rastelado, `rasteira`), `bacia-de-pedra` (tsukubai), `muro-de-bambu`, `portao-de-madeira`. Commit: `added eastern garden and temple kit`
- **Q16c — gênero (Sonnet):** tipos `sala-de-tatami`, `casa-de-cha`, `dojo`, `santuario`, `jardim` (ao ar livre), `cozinha` (versão do gênero); telhado padrão `telha.curva.cinza`; conjuntos `jardim-de-pedras` e `bosque-de-bambu`; palavras: tatami, dojo, santuário, casa de chá. Commit: `added eastern genre with rooms and furnishing`
- **Q16d — exemplo [Opus]:** "Templo na encosta" — santuário com torii, lago de carpas e cerejeiras, na neblina da manhã.

### Q17 — Deserto (`deserto`)  ⬜
Depende de: Q7, Q10, Q13.
- **Q17a — tenda e casa [Opus]:** `tenda-beduina` (aberta, campo `largura`), `almofadas`, `tapete-de-chao` (famílias de cor), `narguile`, `mesa-de-latao` (bandeja com chá), `jarro-de-barro`, `cesto`, `lanterna-marroquina` (pendurada e de chão), `bau-pintado`, `tear-de-chao`. Commit: `added desert tent and household kit`
- **Q17b — caravana e mercado [Opus]:** `camelo` (em pé, deitado, carregado), `poco.oasis` (na família `poco`), `banca-de-especiarias` (montes coloridos), `tapetes-pendurados`, `toldo-listrado`, `palanquim`, `cantaros-empilhados`, `fogueira-de-caravana` (família `fogueira`), `ossada-de-camelo` (família `ossada`). Commit: `added desert caravan and market kit`
- **Q17c — gênero (Sonnet):** tipos `tenda`, `patio-com-fonte` (ao ar livre), `bazar`, `salao-de-cha`, `deposito`; telhado padrão `terraco.barro`; conjuntos `oasis` e `acampamento-de-caravana`; palavras: tenda, bazar, souk, oásis, caravançará. Commit: `added desert genre with rooms and furnishing`
- **Q17d — exemplo [Opus]:** "Oásis da caravana" — dunas, tamareiras, tendas e camelos ao entardecer.

### Q18 — Faroeste (`faroeste`)  ⬜
Depende de: Q11, Q13 (cactos).
- **Q18a — saloon e cidade [Opus]:** `balcao-de-saloon` (com prateleira de garrafas), `piano-de-armario`, `mesa-de-poquer` (fichas e cartas), `porta-de-vaivem`, `escarradeira`, `cabeca-de-bufalo` (parede), `placa-de-procurado` (parede, sem rosto real), `cofre`, `mesa-de-xerife`, `cela-de-xerife` (família `grade`). Commit: `added frontier saloon and town kit`
- **Q18b — rua e estrada [Opus]:** `poste-de-amarrar`, `diligencia`, `carroca-coberta`, `bomba-de-manivela`, `cata-vento` (de fazenda), `caixa-dagua-de-ferrovia`, `trilho` (segmento reto e curvo, campo `comprimento`), `locomotiva`, `vagao`, `cerca-de-tabuas`, `cranio-de-boi` (família `ossada`). Commit: `added frontier street and railroad kit`
- **Q18c — gênero (Sonnet):** tipos `saloon`, `xerifado`, `armazem-geral`, `banco`, `estacao`, `estabulo` (versão do gênero); conjuntos `rua-de-fronteira` e `deserto-de-cactos`; palavras: saloon, xerife, armazém, estação, rancho. Commit: `added frontier genre with rooms and furnishing`
- **Q18d — exemplo [Opus]:** "Cidade da fronteira" — rua de terra com saloon, xerifado e estação, ao meio-dia.

### Q19 — Colonial e pirata (`colonial`)  ⬜
Depende de: Q11, Q13 (coqueiros).
- **Q19a — navio e tesouro [Opus]:** `canhao-naval` (com carreta), `timao`, `mastro` (base com cordame), `bau-de-tesouro` (aberto e fechado), `moedas-espalhadas`, `mapa-do-tesouro` (sobre a mesa), `luneta-e-sextante`, `rede-de-dormir`, `bandeira-pirata` (família `barraca`), `forca`, `barril-de-rum`. Commit: `added pirate ship and treasure kit`
- **Q19b — colônia e praia [Opus]:** `canoa`, `cabana-de-palha`, `sino-de-cais`, `mesa-de-cartografo`, `botica` (armário de frascos), `oratorio`, `pelourinho.colonial`, `fardos-de-acucar`, `canhao-de-forte` (na muralha). Commit: `added colonial town and beach kit`
- **Q19c — gênero (Sonnet):** tipos `conves` (sem telhado), `cabine-do-capitao`, `porao`, `taverna-do-porto`, `fortim`, `casa-colonial`; conjuntos `enseada` e `tesouro-espalhado`; palavras: convés, cabine, porão, forte, enseada. Commit: `added colonial and pirate genre with rooms and furnishing`
- **Q19d — exemplo [Opus]:** "Enseada dos piratas" — navio fundeado, praia de coqueiros e fortim, com água tropical.

### Q20 — Vitoriano e steampunk (`vitoriano`)  ⬜
Depende de: Q4 (faísca e caldeira), Q11.
- **Q20a — fábrica e vapor [Opus]:** `caldeira` (porta com brasa que brilha), `maquina-a-vapor` (volante), `engrenagens` (chão e parede), `esteira`, `tear-mecanico`, `prensa`, `tubulacao.cobre` (na família `tubulacao`), `painel-de-manometros`, `chamine-industrial`. Commit: `added steam factory kit`
- **Q20b — rua e invenções [Opus]:** `lampiao-a-gas` (poste, luz `lampiao-a-gas`), `banca-de-jornal`, `carruagem-fechada`, `relogio-de-rua`, `dirigivel` (ancorado, com mastro), `automato`, `bancada-de-inventor`, `gramofone`, `bobina-de-tesla` (arco que brilha). Commit: `added victorian street and inventions kit`
- **Q20c — gênero (Sonnet):** tipos `fabrica`, `oficina-de-inventor`, `clube`, `estacao-de-dirigivel`, mais as salas de `investigacao` com a paleta do gênero; conjuntos `rua-de-paralelepipedo` e `patio-de-fabrica`; palavras: fábrica, caldeira, dirigível, oficina. Commit: `added victorian and steampunk genre with rooms and furnishing`
- **Q20d — exemplo [Opus]:** "Doca do dirigível" — fábrica e doca de dirigível na névoa da noite, com lampiões.

### Q21 — Moderno urbano (`moderno`)  ⬜
Depende de: Q8.
- **Q21a — rua [Opus]:** `carro` (família: `sedan`, `hatch`, `picape`, `van`, `viatura`, `taxi`; campo `cor`), `moto`, `bicicleta`, `onibus`, `semaforo`, `hidrante`, `lixeira`, `cacamba`, `ponto-de-onibus`, `orelhao`, `cone`, `barreira`, `bomba-de-gasolina`. Commit: `added modern street kit`
- **Q21b — interiores [Opus]:** `estacao-de-trabalho` (mesa, cadeira e monitor), `divisoria`, `copiadora`, `bebedouro.galao`, `gondola` (prateleira de mercado com produtos), `caixa-registradora`, `freezer`, `mesa-de-lanchonete` (com assento estofado), `armario-de-vestiario`, `maquina-de-venda`, `cama-hospitalar`. Commit: `added modern office, shop and diner kit`
- **Q21c — gênero (Sonnet):** tipos `escritorio`, `mercado`, `lanchonete`, `garagem`, `posto`, `vestiario`, `enfermaria`; conjuntos `rua-urbana`, `estacionamento`; palavras: escritório, mercado, lanchonete, garagem, posto. Commit: `moderno genre gains offices, shops and street sets`
- **Q21d — exemplo [Opus]:** "Posto na estrada" — posto de gasolina com lanchonete à noite, sob chuva.

### Q22 — Pós-apocalíptico (`pos-apocaliptico`)  ⬜
Depende de: Q12, Q21a (carros).
- **Q22a — ruína e sucata [Opus]:** `carro.enferrujado` (cada modelo da Q21 em versão carcaça), `onibus-tombado`, `barricada` (sucata), `sacos-de-areia` (muro, campo `comprimento`), `tonel-com-fogo` (luz `tonel`), `pneus-empilhados`, `cerca-de-arame-farpado`, `torre-de-vigia` (sucata). Commit: `added post-apocalyptic ruin and scrap kit`
- **Q22b — acampamento [Opus]:** `barraca-improvisada` (lona e paletes), `colchao-no-chao`, `gerador-a-diesel`, `tanque-de-agua`, `horta-em-pneus`, `placa-pichada`, `caixa-de-suprimentos`, `fogareiro`. Commit: `added post-apocalyptic camp kit`
- **Q22c — gênero (Sonnet):** tipos `acampamento` (ao ar livre), `abrigo`, `enfermaria-improvisada`, `oficina-de-sucata`, `posto-de-guarda`; conjuntos `estrada-abandonada` e `acampamento-de-sobreviventes`; palavras: abrigo, bunker, acampamento, sucata. Commit: `added post-apocalyptic genre with rooms and furnishing`
- **Q22d — exemplo [Opus]:** "Posto avançado" — o posto da Q21d, anos depois: abandonado, cercado e habitado.

### Q23 — Cyberpunk (`cyberpunk`)  ⬜
Depende de: Q4, Q12, Q21, E4.
- **Q23a — rua [Opus]:** `letreiro-neon` (parede; campos `cor` e `forma`, com glifos sem marca real), `holograma` (brilho translúcido), `barraca-de-lamen` (toldo e balcão), `drone`, `antena-parabolica`, `quadro-de-cabos`, `poste-com-telas`, `maquina-de-venda.neon` (variante da Q21b). Commit: `added cyberpunk street kit`
- **Q23b — interiores [Opus]:** `estacao-hacker` (várias telas que brilham), `cadeira-de-implante`, `rack-de-servidores` (com leds), `fliperama`, `balcao-luminoso`, `capsula-de-hotel` (em pilha; o `beliche.capsula` existente vira variante), `gaiola-de-cabos`. Commit: `added cyberpunk interiors kit`
- **Q23c — gênero (Sonnet):** tipos `clinica-clandestina`, `bar`, `hotel-capsula`, `sala-de-servidores`, `mercado-noturno` (ao ar livre); conjuntos `beco-de-neon` e `mercado-noturno`; o clima padrão das capturas é chuva noturna; palavras: clínica, hacker, servidor, beco, cápsula. Commit: `added cyberpunk genre with rooms and furnishing`
- **Q23d — exemplo [Opus]:** "Beco de néon" — beco na chuva com barraca de lámen, letreiros e uma clínica clandestina.

---

## Validação da frente

Ao fim de tudo: uma prancha com os nove exemplos novos lado a lado; a biblioteca, num mapa de cada gênero, não mostra nada de outra época (salvo os atemporais); `npm run typecheck`, `npm test` e `npm run test:e2e` passam; o tempo de carregamento de um mapa grande não fica pior que o da Frente M (as texturas novas são pré-carregadas só quando usadas).

---

## Limites e pendências

Mantida ao longo da frente. Cada ficha registra aqui o que ficou de fora ou o que o motor ainda não faz, com a causa e o que resolveria. Quando um item é resolvido, ele é riscado aqui e citado na ficha que o resolveu. A meta é ter o mínimo de limites.

| origem | limite | causa | o que resolveria |
| --- | --- | --- | --- |
| Q4 | A lava não escorre: só cintila (a emissão tremula), sem a crosta deslizar. | A lava fica fora da superfície animada da água. | Um shader de superfície próprio que desloque o leito da lava pelo `flow` da camada. |
| Q4 | Algumas fendas finas da lava saem tracejadas. | Fenda mais fina que um pixel a 32 px/m. | Largura mínima maior, ou fenda fina só como emissão (sem cor). |
| Q4 | No Pixel, a lava não brilha. | O Pixel não tem mapa de altura nem emissão (Pixel em espera). | Retomar quando o Pixel voltar. |
| Q6 | A neve funda tem uma mancha azulada leve. | A camada `snow010a` é azulada. | Tingir mais essa camada, se incomodar. |
| Q13a | As miniaturas da galeria de exemplos ainda mostram as árvores antigas. | O Jardim do Colosso tinha mudanças de outra sessão em aberto. | `npm run exemplos` quando esses arquivos estiverem livres. |
| Q13a | Os pinheiros não foram refeitos. | Já eram em camadas de agulhas, sem a cara de bola. | Refazer com nanquim, se destoarem no Desfiladeiro Nevado. |
| Q8 | A borda de uma camada de terreno é sempre macia; a borda nítida da rua vem do carimbo `meio-fio`, posto à mão. | A borda do terreno se desfaz por ruído (`suave(0.22, 0.78)`) em todos os materiais. | Uma opção de borda nítida por material (asfalto, calçada, lajes) ou meio-fio automático entre `asfalto` e `concreto.calcada`. |
| Q8 | O meio-fio é reto: as esquinas não têm curva. | Só existe a peça reta. | Uma peça de esquina (quarto de círculo) na família. |
| Q8 | A sinalização segue a rotação do objeto, não o traço do pincel; uma faixa curva precisa de vários pedaços. | É carimbo, não terreno. | Faixas ao longo de um caminho (`atlas_caminho`), quando houver ruas curvas. |
| Q8 | A `ScatteredLeaves007` (folhas soltas com transparência) não é usada. | O preparo guarda só cor e relevo. | Guardar a opacidade no preparo e deixar a camada de textura usar alfa. |
| Q9 | Terreno pintado não emite: só a água, os veios do maciço e as partes de objeto. Os fungos que brilham são carimbo. | O canal de emissão do terreno só é escrito pela água e pelo maciço. | Um campo `brilho` em material de terreno com máscara própria (pontos, veios), como o do maciço. |
| Q9 | Água com borda reta mostra um anel claro de reflexo do sol. | O especular da superfície é forte onde a borda inclina a normal. | Atenuar o especular na zona da margem; observar nos mapas reais, onde a borda é irregular. |
| Q9 | No máximo 4 camadas de água animadas por mapa (a lava não conta). | Limite do shader (`MAX_CAMADAS_DE_AGUA`). | Uniformes em textura, se algum mapa precisar de mais. |
| ~~Q4~~ | ~~A espuma de todas as águas tinha a cor da primeira camada (com lava, amarela)~~ | | Resolvido na Q9: espuma por camada. |
| Q10 | Os hieróglifos (e qualquer desenho miúdo de parede) viram pontinhos na face da parede. | A face é achatada (~0,24) e estreita na vista de cima. | Sinais maiores ou um painel de parede em objeto (`painel-de-hieroglifos`, já previsto na Q15a). |
| Q10 | As tesselas do mosaico mal aparecem; o que lê são os motivos. | O piso de cômodo é assado a 64 px/m (tessela de 5 cm ≈ 3 px). | Subir a resolução de pisos de mosaico, se a cena pedir de perto. |
| Q10 | A forma `pagode` vista de cima parece um quatro-águas: as pontas erguidas não aparecem. | O telhado é desenhado em planta. | Pontas viradas e cumeeira curva desenhadas na forma (Q16, kit oriental). |
| Q10 | O terraço de barro mostra juntas de placa. | Reaproveita a cobertura `concreto-laje`. | Uma cobertura de barro lisa, com rachaduras, se destoar. |
| ~~Q2b~~ | ~~Os seletores cortavam o texto ("Deste mapa (Inv…")~~ | | Resolvido: os seletores ficam um embaixo do outro, cada um na largura toda. |
| ~~Q2c~~ | ~~O aviso do baker falava em "miniaturas" mesmo quando era o mapa~~ | | Resolvido: o texto agora vale para os dois. |
| ~~Q7~~ | ~~Uma camada de sulcos ou dunas tinha uma direção só (talhões diferentes saíam na média)~~ | | Resolvido: cada parte conectada da camada ganha a própria direção (`componentesDeFaixas`). |

## Curadoria (Q5)

Levantada em 2026-11-20 e aprovada pelo usuário no mesmo dia. A prancha está em `test-results/q5-texturas.png`: cada candidata a 32 px/m sobre 4 × 4 m, mostrada a 2×, com as cores cruas. Os originais (1K) ficam em `data-private/texturas-fonte/`, fora do git. Todas são CC0. A escolha pesa pela estrutura, porque o tom vem da paleta.

| material | ficha | escolhida | tamanho | alternativa | observação |
| --- | --- | --- | --- | --- | --- |
| `grama.escura` | Q6 | `grass_ground` | 2,51 m | `sparse_grass` | grão de grama sem padrão |
| `grama.acinzentada` | Q6 | `sparse_grass` | 2 m | — | o cinza vem da paleta |
| `lama` | Q6 | `mud_forest` | 2,35 m | `brown_mud` | úmida, com detritos |
| `areia` | Q6 | `sand_01` | 1,5 m | `dense_sand` | `park_sand` é lisa demais |
| `areia.molhada` | Q6 | `damp_beach_sand_02` | 1,87 m | `damp_sand` | ondulação de maré |
| `cascalho` | Q6 | `gravel_floor` | 2,25 m | `rocky_gravel` | |
| `pedregulho` | Q6 | `rocks_ground_02` | 2 m | `river_small_rocks` | o ladrilho aparece: depende da amostragem sem repetição |
| `neve` | Q6 | `snow_01` | 2 m | `Snow006` | `snow_02` repete pegadas |
| `neve.funda` | Q6 | `Snow010A` | 2 m (estimado) | — | `snow_04` tem rastro de pneu |
| `neve.pisada` | Q6 | `snow_03` | 2 m | `Footsteps001` (camada) | `snow_05` tem rastro de pneu |
| `terra.congelada` | Q6 | `rocky_trail` | 2 m | — | |
| `areia.duna` | Q7 | `Ground054` | 2 m (estimado) | `sand_02` | as ondulações das dunas são procedurais e seguem o `dir` |
| `terra.rachada` | Q7 | `dry_ground_01` | 4 m | `mud_cracked_dry_03` | |
| `salina` | Q7 | `mud_cracked_dry_03` | 1,5 m | — | tingida de branco |
| `laterita` | Q7 | `red_dirt_mud_01` | 1,5 m | `red_laterite_soil_stones` | |
| `terra.arada` | Q7 | `farm_soil` | 2 m | — | os sulcos são procedurais; `farm_furrows` tem direção fixa |
| `chao.de.selva` | Q8 | `brown_mud_leaves_01` | 1,3 m | `forrest_ground_03` | |
| `folhas.outono` | Q8 | `ScatteredLeaves007` | 1,5 m (estimado) | `forest_floor` | traz opacidade: é a camada com máscara |
| `grama.outono` | Q8 | `dry_decay_leaves` | 2 m | `winter_leaves` | |
| `asfalto` | Q8 | `worn_asphalt` | 2 m | `asphalt_02` | |
| `asfalto.rachado` | Q8 | `road_damaged` | 2,2 m | `asphalt_02` | |
| `concreto.calcada` | Q8 | `concrete_pavement` | 1,8 m | `concrete_pavers_02` | |
| `cinza.vulcanica` | Q9 | `moon_02` | 3,1 m | `burned_ground_01` | `burned_ground_01` repete a cada 1 m |
| `chao.de.fungos` | Q9 | `mud_forest` | 2,35 m | `roots` | os fungos entram por carimbo |
| crosta de `agua.lava` | Q9 | `Lava001` | 3 m (estimado) | `Lava004` | fendas acesas: base da máscara de brilho |

Ficam procedurais: `basalto` (colunas hexagonais com o Voronoi, sobre o grão de `dark_rock_02`), `cristal.chao` e `grama.florida` (grama atual mais o carimbo de flores).
