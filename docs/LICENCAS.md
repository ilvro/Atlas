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
| gerados/arbusto-verde.webp | arbusto | Arbusto (verde) |
| gerados/arvore-3m.webp | arvore | Árvore (3 m) |
| gerados/arvore-5m.webp | arvore | Árvore (5 m) |
| gerados/arvore-7m.webp | arvore | Árvore (7 m) |
| gerados/chesterfield-couro.webp | chesterfield | Sofá chesterfield (couro) |
| gerados/chesterfield-verde.webp | chesterfield | Sofá chesterfield (verde-garrafa) |
| gerados/chesterfield-vinho.webp | chesterfield | Sofá chesterfield (vinho) |
| gerados/costela-de-adao-madeira.webp | costela-de-adao | Costela-de-adão (madeira) |
| gerados/costela-de-adao-pedra.webp | costela-de-adao | Costela-de-adão (pedra) |
| gerados/diva-couro.webp | diva | Divã capitonê (couro) |
| gerados/diva-verde.webp | diva | Divã capitonê (verde-garrafa) |
| gerados/diva-vinho.webp | diva | Divã capitonê (vinho) |
| gerados/palmeira-madeira.webp | palmeira | Palmeira em vaso (madeira) |
| gerados/palmeira-pedra.webp | palmeira | Palmeira em vaso (pedra) |
| gerados/passadeira-creme.webp | passadeira | Passadeira de corredor (creme e terracota) |
| gerados/passadeira-verde.webp | passadeira | Passadeira de corredor (verde e ouro) |
| gerados/passadeira-vinho.webp | passadeira | Passadeira de corredor (vinho e azul-marinho) |
| gerados/pinheiro-3m.webp | pinheiro | Pinheiro (3 m) |
| gerados/pinheiro-4m.webp | pinheiro | Pinheiro (4,5 m) |
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
