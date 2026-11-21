# Licenças

Tudo o que o Atlas distribui (código, receitas, imagens da coleção, fontes) tem licença que permite redistribuir. Todo asset **achado** entra aqui, com autor, fonte e licença; o teste de coleção (`tests/unit/colecao.test.ts`) recusa um arquivo de `public/colecao/` que não esteja neste arquivo.

Só entram **CC0** e **CC-BY 4.0** (esta com crédito aqui e na tela de ajuda). Nada de NC, ND, "uso pessoal" ou licença ambígua. Importações do mestre ficam em `data-private/` ou no IndexedDB, nunca no git, em `public/` ou em `dist/`.

## Versão Pixel manual (`pixelArquivo`)

Um item da coleção pode ter uma versão Pixel feita à mão (`pixelArquivo`, um PNG em `public/colecao/`, a 16 px por célula). Ela segue a regra do item: se o item é achado, o arquivo manual é um derivado do achado e herda a licença e o crédito dele; se o item é gerado ou feito para o Atlas, vale a licença do projeto. O teste de coleção exige que todo `pixelArquivo` esteja listado neste arquivo, como os demais. Hoje nenhum item tem versão manual.

## Coleção da casa: itens gerados

Imagens assadas pelo próprio Atlas (`npm run assar`) a partir de geradores em `src/procedural/pesados/`, sob a mesma licença do projeto. Os parâmetros, a semente e a versão de cada uma estão em `public/colecao/colecao.json`, para regenerar.

<!-- gerados:inicio -->
| arquivo | gerador | observação |
| --- | --- | --- |
| gerados/arbusto-florido.webp | arbusto | Arbusto (florido) |
| gerados/arbusto-grande.webp | arbusto | Arbusto (grande) |
| gerados/arbusto-seco-1m.webp | arbusto-seco | Arbusto seco (1,2 m) |
| gerados/arbusto-seco-2m.webp | arbusto-seco | Arbusto seco (2 m) |
| gerados/arbusto-seco-2m-neve.webp | arbusto-seco | Arbusto seco (2 m com neve) |
| gerados/arbusto-verde.webp | arbusto | Arbusto (verde) |
| gerados/arvore-3m.webp | arvore | Árvore (3 m) |
| gerados/arvore-5m.webp | arvore | Árvore (5 m) |
| gerados/arvore-7m.webp | arvore | Árvore (7 m) |
| gerados/arvore-da-mata-4m.webp | arvore-da-mata | Árvore da mata (4 m) |
| gerados/arvore-da-mata-5m-amarelada.webp | arvore-da-mata | Árvore da mata (5 m, amarelada) |
| gerados/arvore-da-mata-6m.webp | arvore-da-mata | Árvore da mata (6 m) |
| gerados/arvore-da-mata-6m-rala.webp | arvore-da-mata | Árvore da mata (6 m, ralinha) |
| gerados/arvore-da-mata-8m.webp | arvore-da-mata | Árvore da mata (8 m) |
| gerados/arvore-nevada-3m.webp | arvore-nevada | Árvore nevada (3 m) |
| gerados/arvore-nevada-5m.webp | arvore-nevada | Árvore nevada (5 m) |
| gerados/carvalho-grande-6m.webp | carvalho-grande | Carvalho grande (6 m) |
| gerados/carvalho-grande-7m.webp | carvalho-grande | Carvalho grande (7 m) |
| gerados/carvalho-grande-8m.webp | carvalho-grande | Carvalho grande (8 m) |
| gerados/chesterfield-couro.webp | chesterfield | Sofá chesterfield (couro) |
| gerados/chesterfield-verde.webp | chesterfield | Sofá chesterfield (verde-garrafa) |
| gerados/chesterfield-vinho.webp | chesterfield | Sofá chesterfield (vinho) |
| gerados/costela-de-adao-madeira.webp | costela-de-adao | Costela-de-adão (madeira) |
| gerados/costela-de-adao-pedra.webp | costela-de-adao | Costela-de-adão (pedra) |
| gerados/diva-couro.webp | diva | Divã capitonê (couro) |
| gerados/diva-verde.webp | diva | Divã capitonê (verde-garrafa) |
| gerados/diva-vinho.webp | diva | Divã capitonê (vinho) |
| gerados/folhagem-tropical-1m.webp | folhagem-tropical | Folhagem tropical (1,6 m) |
| gerados/folhagem-tropical-2m.webp | folhagem-tropical | Folhagem tropical (2,4 m) |
| gerados/palmeira-madeira.webp | palmeira | Palmeira em vaso (madeira) |
| gerados/palmeira-pedra.webp | palmeira | Palmeira em vaso (pedra) |
| gerados/passadeira-creme.webp | passadeira | Passadeira de corredor (creme e terracota) |
| gerados/passadeira-verde.webp | passadeira | Passadeira de corredor (verde e ouro) |
| gerados/passadeira-vinho.webp | passadeira | Passadeira de corredor (vinho e azul-marinho) |
| gerados/pinheiro-3m.webp | pinheiro | Pinheiro (3 m) |
| gerados/pinheiro-4m.webp | pinheiro | Pinheiro (4,5 m) |
| gerados/pinheiro-nevado-3m.webp | pinheiro-nevado | Pinheiro nevado (3 m) |
| gerados/pinheiro-nevado-4m.webp | pinheiro-nevado | Pinheiro nevado (4,5 m) |
| gerados/poltrona-capitone-couro.webp | poltrona-capitone | Poltrona capitonê (couro) |
| gerados/poltrona-capitone-verde.webp | poltrona-capitone | Poltrona capitonê (verde-garrafa) |
| gerados/poltrona-capitone-vinho.webp | poltrona-capitone | Poltrona capitonê (vinho) |
| gerados/samambaia-a.webp | samambaia | Samambaia em pedestal (a) |
| gerados/samambaia-b.webp | samambaia | Samambaia em pedestal (b) |
| gerados/tapete-oval-creme.webp | tapete-oval | Tapete oval (creme e terracota) |
| gerados/tapete-oval-verde.webp | tapete-oval | Tapete oval (verde e ouro) |
| gerados/tapete-oval-vinho.webp | tapete-oval | Tapete oval (vinho e azul-marinho) |
| gerados/tapete-persa-g-creme.webp | tapete-persa-g | Tapete persa com medalhão (4 × 2,8 m) (creme e terracota) |
| gerados/tapete-persa-g-verde.webp | tapete-persa-g | Tapete persa com medalhão (4 × 2,8 m) (verde e ouro) |
| gerados/tapete-persa-g-vinho.webp | tapete-persa-g | Tapete persa com medalhão (4 × 2,8 m) (vinho e azul-marinho) |
| gerados/tapete-persa-p-creme.webp | tapete-persa-p | Tapete persa com medalhão (3 × 2 m) (creme e terracota) |
| gerados/tapete-persa-p-verde.webp | tapete-persa-p | Tapete persa com medalhão (3 × 2 m) (verde e ouro) |
| gerados/tapete-persa-p-vinho.webp | tapete-persa-p | Tapete persa com medalhão (3 × 2 m) (vinho e azul-marinho) |
<!-- gerados:fim -->

## Coleção da casa: itens achados

| arquivo | autor | fonte | licença | observação |
| --- | --- | --- | --- | --- |

## Fontes tipográficas

| fonte | pacote | licença |
| --- | --- | --- |
| Cinzel | `@fontsource/cinzel` | SIL Open Font License 1.1 |
| Special Elite | `@fontsource/special-elite` | Apache License 2.0 |
| Hanken Grotesk | `@fontsource-variable/hanken-grotesk` | SIL Open Font License 1.1 |
| Pixelify Sans (títulos do estilo Pixel: cartela do mapa e janela do projetor) | `@fontsource/pixelify-sans` | SIL Open Font License 1.1 |

## Texturas de chão (CC0)

Ladrilhos de terreno preparados por `npm run texturas` (`scripts/preparar-texturas.ts`, lista em `scripts/texturas-aprovadas.json`) a partir de originais CC0 de Poly Haven e ambientCG, reduzidos a 128 px/m e gravados em WebP em `public/colecao/texturas/` (cor e deslocamento em tons de cinza). O catálogo, com a versão (hash) e o tamanho real de cada uma, está em `public/colecao/texturas/texturas.json`. Os originais ficam em `data-private/`, fora do git. O teste de coleção exige que todo arquivo de `public/colecao/texturas/` esteja listado aqui.

<!-- texturas:inicio -->
| arquivo | textura | autor | fonte | licença | link |
| --- | --- | --- | --- | --- | --- |
| texturas/brown_mud_dry.webp<br>texturas/brown_mud_dry-alt.webp | brown_mud_dry | Rob Tuytel | Poly Haven | CC0 | https://polyhaven.com/a/brown_mud_dry |
| texturas/dirt_floor.webp<br>texturas/dirt_floor-alt.webp | dirt_floor | eye-candy.xyz | Poly Haven | CC0 | https://polyhaven.com/a/dirt_floor |
| texturas/forest_ground_04.webp<br>texturas/forest_ground_04-alt.webp | forest_ground_04 | Rob Tuytel, Rico Cilliers | Poly Haven | CC0 | https://polyhaven.com/a/forest_ground_04 |
| texturas/ground068.webp<br>texturas/ground068-alt.webp | Ground068 (tamanho real estimado em 1.5 m) | ambientCG | ambientCG | CC0 | https://ambientcg.com/view?id=Ground068 |
| texturas/leafy_grass.webp<br>texturas/leafy_grass-alt.webp | leafy_grass | Charlotte Baglioni | Poly Haven | CC0 | https://polyhaven.com/a/leafy_grass |
| texturas/leaves_forest_ground.webp<br>texturas/leaves_forest_ground-alt.webp | leaves_forest_ground | Dario Barresi, Dimitrios Savva | Poly Haven | CC0 | https://polyhaven.com/a/leaves_forest_ground |
| texturas/stony_dirt_path.webp<br>texturas/stony_dirt_path-alt.webp | stony_dirt_path | eye-candy.xyz | Poly Haven | CC0 | https://polyhaven.com/a/stony_dirt_path |
| texturas/withered_grass.webp<br>texturas/withered_grass-alt.webp | withered_grass | Charlotte Baglioni | Poly Haven | CC0 | https://polyhaven.com/a/withered_grass |
<!-- texturas:fim -->
