> resumo: repertório de exteriores (aldeia, cidade, igreja e cemitério, natureza, costa e porto, acampamento): portes, arranjos, peças úteis e armadilhas. Use com `projetar`.

# Lugares: exteriores

Ids conferidos no catálogo; confirme com `atlas_catalogo` se algum for recusado. Interiores estão em `interiores`.

## Aldeia e vila rural

- **Tamanho:** 8 a 25 edifícios em 60 a 150 m. Rua principal de terra de 4 a 6 m, praça com poço, becos de 1,5 a 3 m.
- **Programa típico:** salão ou taverna (dominante), capela, 1 ou 2 ofícios (ferraria, moinho, armazém), casas de família, estábulo ou celeiro, cercados.
- **Arranjo:** casas agrupadas ao longo da rua, com quintais atrás; o que é de trabalho na periferia; cerca ou paliçada seguindo o terreno, com portão onde a estrada entra.
- **Vida:** `pilha-de-lenha`, `varal`, `barril-de-chuva`, `galinheiro`, `carroca`, `carroca-de-feno`, `fardo-de-feno`, `bebedouro`, `poste-de-amarracao`, `espantalho` na horta, `canteiro` com `cerca`, `lanterna-de-poste` na praça.
- **Telhados:** `choupana` e `casa-velha` (pobre), `casa-de-pedra` (montanha), `casa-nordica` (frio), `celeiro` para celeiro e estábulo, `igreja` na capela.
- **Neve:** chão `neve` ou `neve.funda`, caminhos `neve.pisada` e `terra.sulcos`, `monte-de-neve` junto das paredes, `casa:pinheiro-nevado-3m` e `-4m`, `casa:arvore-nevada-5m`, `casa:arbusto-seco-2m-neve`.
- **4 quadrantes externos:** os arredores de vilas nunca podem ficar apenas no material base; cubra os quatro quadrantes com afloramentos `rocha.*` + `atlas_espalhar` + trilhas sinuosas + variação de terreno (como `neve.funda` e `neve.pisada` em regiões frias).
- **Armadilhas:** casas do mesmo tamanho espaçadas igualmente; vila oval no centro do mapa; muro de rocha em volta no lugar de um desnível; trilha reta e larga demais; cantos externos vazios.

## Cidade e rua

- Fachadas geminadas em fileira, frente para a rua, fundos com pátios. Rua de 5 a 8 m (`paralelepipedo` ou `calcada`), calçadas e becos estreitos.
- Térreo comercial (loja, taverna, oficina) e moradia em cima (outro mapa).
- **Vida:** `barraca-de-feira`, `carroca`, `lanterna-de-poste`, `barril`, `caixote`, `sacos`, `poco` ou `fonte` na praça.
- **Armadilhas:** quarteirões quadrados e vazios; todas as portas para o mesmo lado.

## Igreja e cemitério

- **Igreja:** nave longa (2:1 a 3:1), torre ou campanário encostado na frente (telhado `torre`), sacristia pequena ao lado. Telhado `igreja`. Interior em `interiores`.
- **Cemitério:** atrás ou ao lado da igreja, cercado por `grade.ferro` (ou `mureta-de-pedra`) com `portao.ferro`. Quadras de túmulos com **corredores** de 1,2 a 2 m de cascalho (`cascalho`) entre elas.
- **Túmulos variados:** `lapide` (campo `modelo` de 1 a 5: reta, arredondada, gótica, quebrada, inclinada), `cruz.madeira`, `cruz.pedra`, `tumulo` (laje), `cova` (monte de terra; `fresca: 0` para antiga), `cova.aberta`. Pontos focais: `jazigo` de família, `anjo`, `arvore-morta` ou um pinheiro grande.
- **Arranjo:** fileiras **levemente tortas** (desloque 0,1 a 0,3 m e gire ±0,15 rad cada peça), com falhas, túmulos antigos inclinados e cobertos de musgo, os novos mais alinhados. Cada lápide com a frente (+y) para o corredor.
- **Armadilhas:** a mesma `lapide` repetida em grade perfeita; cemitério sem cerca nem caminho.

## Natureza

- **Mata:** bordas irregulares, densa no miolo e rala na borda; árvores de 3 a 8 m misturadas com arbustos, `toco`, `tronco.caido`, `pedra.media`, `rochedo`. `atlas_espalhar` com `mata` faz a base; acrescente à mão.
- **Mata fechada (floresta escura, vista de cima):** chão `chao.de.mata` e copas `casa:arvore-da-mata-4m/6m/8m` (variantes `6m-rala` e `5m-amarelada`) **encostando umas nas outras e saindo pela borda**; `atlas_espalhar` com `mata-fechada` faz a base. A mata cobre a maior parte do mapa; o que se vê do chão são clareiras e vãos.
- **Clareira e trilha:** a trilha contorna obstáculos, alarga nas curvas e some sob a copa.
- **Montanha e desfiladeiro:** maciço (`rocha.cinza`, `rocha.nevada`) nas bordas, escarpas para os degraus, `laje-de-pedra` e `rochedo` soltos, `seixos`.
- **Pântano:** `agua.pantano` em manchas irregulares ligadas, `lama`, `junco`, `vitoria-regia`, `arvore-morta`, `raiz-exposta`, neblina.
- **Armadilhas:** discos perfeitos de material; árvores todas do mesmo tamanho; rocha como parede reta.

## Costa e porto

- Água com rebentação (`agua.mar`), praia (`areia`, `areia.molhada`), cais de `cais-segmento` com `rotacao` explícita, `estaca`, `barco-a-remo`, `barcaca`, `guindaste-de-cais`, `rede-de-pesca`, `ancora`, `rolo-de-corda`, pilhas de `caixote` e `barril`.
- Armazéns grandes e cheios, com corredores; taverna do porto perto do cais.

## Acampamento

- `tenda` em aglomerado em volta de uma `fogueira` (luz `fogueira`, `intensity` 0,9 a 1,1), `tora-assento` em volta do fogo, `catre-de-peles` ou `saco-de-dormir`, `espeto-de-assar`, `caldeirao`, cavalos amarrados (`cavalo`, `poste-de-amarracao`), carroças fechando o perímetro. A fogueira solta fumaça sozinha.
- Clareira de `chao.batido` (a borda se mistura sozinha com o chão vizinho) de **forma irregular**, mais funda para um lado, nunca um disco centrado; em mata fechada, as copas avançam sobre a borda da clareira.
