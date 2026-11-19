> resumo: o método para projetar qualquer lugar (vila, casa, masmorra, nave): brief, programa, circulação, massa, identidade, vida, luz e a conferência final. Leia antes de compor.

# Projetar um lugar

Um mapa bom não sai da ordem das chamadas: sai de decisões de projeto. Faça os passos abaixo **em texto, antes de construir**, e mostre ao mestre o resumo dos passos 1 a 4. O repertório de cada tipo de lugar (portes, arranjos, armadilhas) está em `lugares` (exteriores) e `interiores`.

## 1. Brief

- O que acontece aqui? Exploração, investigação, perseguição, combate, um encontro social. Onde fica a cena principal?
- Tom e época: terror rural, gótico, moderno, nave.
- **Escala.** O Atlas faz mapas táticos (célula de 1,5 m, peças de jogador em escala). Um mapa legível vai de ~20 × 15 m (uma casa) a ~150 × 120 m (uma vila pequena). Lugar maior vira vários mapas: o exterior e os interiores importantes.
- Uma imagem em perspectiva de uma vila inteira é um mapa regional, não tático: traduza-a (veja `referencias`).

## 2. Programa

Liste cada espaço com **função, porte (m²) e o que precisa ter**. Exemplo: "salão comunal, 140 m², mesas longas, lareira, cozinha anexa de 20 m²". Nada de "casas" genéricas: cada casa tem dono, ofício e tamanho.

Portes típicos: cabana de 15 a 30 m² (1 ou 2 cômodos); casa de família de 35 a 70 m² (2 a 4 cômodos); casa abastada de 90 a 160 m² (4 a 8); taverna de 120 a 250 m² (salão de 60 a 100); capela de 40 a 80 m²; igreja de vila de 120 a 250 m² (nave longa, 2:1 a 3:1); celeiro de 60 a 150 m²; ferraria de 30 a 60 m² com pátio. Num conjunto, faça **1 edifício dominante** (o dobro dos outros), **2 ou 3 médios** e o resto pequeno, e **nunca 3 vizinhos do mesmo porte e forma**.

## 3. Zoneamento e circulação

- O caminho principal **entra pela borda** do mapa e atravessa; não nasce no meio. As frentes dos edifícios viram para ele.
- Praça ou pátio no cruzamento; edifícios públicos (igreja, salão, taverna, poço) em volta dela.
- Serviços sujos (ferraria, estábulo, curtume) na periferia; cemitério junto da igreja ou fora da cerca.
- Agrupe casas de 2 a 4, com quintais, e deixe vazios e terrenos baldios. Espaçamento igual entre tudo é o defeito mais comum.
- Desenhe gargalos e linhas de visão para a cena: um portão, uma ponte, uma porta que se vê da praça.

## 4. Massa, forma e composição

- **Edifício = 2 a 4 retângulos**: corpo principal + anexo (cozinha, depósito, oficina) + alpendre ou varanda. Formas em L, T e U; casas geminadas dividem parede. Use várias `rets` em `atlas_comodos` para o L, e cômodos vizinhos para os anexos.
- Gire as plantas: a frente vira para a rua, não para o norte do mapa.
- Telhados (`telhado`): 1 estilo dominante na região + 1 ou 2 variações; edifícios especiais com estilo próprio (`igreja`, `torre`, `celeiro`). Lista em `atlas_catalogo { parte: "telhado" }`.
- **Composição do mapa:** as massas grandes (mata, rocha, água, a própria vila) **saem pela borda**; prefira diagonais; ocupe 60 a 75% do retângulo. Um oval de coisas no meio, com margem igual dos quatro lados, é o sinal de mapa amador.
- **Profundidade em camadas:** alterne ao menos 2 a 3 degraus de altura (via `relevo` em patamares ou `rocha.*` maciço + `cliff` sequencial); nunca deixe apenas um plano liso entre a vila/caminho e o abismo ou encosta.

## 5. Identidade

Dê a cada edifício pelo menos **um traço** que só ele tem: anexo, alpendre, chaminé, horta com cerca (`canteiro`, `cerca`), `pilha-de-lenha`, `varal`, `barril-de-chuva`, `galinheiro`, poço próprio, carroça, cor do telhado, piso diferente. O mestre deve conseguir dizer "a casa do ferreiro é aquela" olhando o mapa.

## 6. Vida e história

- **Três camadas de escala**, todas presentes: massas (rocha, mata, edifícios), médios (carroças, móveis, árvores) e pequenos (barris, ferramentas, papéis).
- **Uso deixa marca:** caminhos de terra ligando portas à rua (`terra.sulcos`, `neve.pisada`), lama na entrada, fuligem perto da forja, musgo no lado úmido. Presença com economia.
- **Algo fora do lugar** conta a história: uma porta arrombada, uma cova aberta, uma mesa posta abandonada, rastros que somem.
- Nada em grade perfeita: varie a rotação (±0,15 rad), desloque 0,1 a 0,3 m, misture 2 a 4 receitas e deixe falhas.

## 7. Luz e clima

Poucas fontes com propósito (lareira, tocha, lanterna na praça). Escolha o clima pela cena; nunca o acabamento cru (`neutro` sem `glow`/`edges`). À noite, ambiente baixo e poças de luz quente; interiores à luz de lanterna pedem `clima.luzInterna` baixo (ver `referencias`).

| Cena | `sol.angle` | `glow` | `vignette` | `edges` | Notas |
| --- | --- | --- | --- | --- | --- |
| Exterior frio / nevado | `0.65–0.85` (rasante) | `0.35–0.55` | `0.35–0.48` | `clouds` ou `fog` (`0.35–0.5`) | Sombras longas azuladas; neve 0.25–0.45 |
| Noturno / ravina | `0.7–0.8` | `0.45–0.8` | `0.3–0.5` | `dark` ou `fog` (`0.5–0.7`) | `ambient` azulado frio + tochas `#ffa842` |
| Gruta / masmorra | `null` (ou baixo fora) | `0.6–0.9` | `0.4–0.55` | `dark` (`0.3–0.5`) | Acabamento `masmorra`; tochas e braseiros quentes (`intensity` 1,4–2,2) sobre `ambient` frio a 0,5–0,6 |

## 8. Conferir antes de entregar

Depois de cada bloco, `atlas_ver_mapa` (`vista: "planta"` e `"telhados"`) e `atlas_revisar`. No fim, responda olhando a imagem:

1. Os portes variam? Há um dominante? Nenhuma sequência de 3 iguais?
2. Todo edifício tem forma própria, porta para fora, telhado (menos o que é ao ar livre) e um traço de identidade?
3. Todo interior tem função e mobília? Nenhum cômodo vazio sem razão?
4. Algo está em grade mecânica (lápides, árvores, caixas)?
5. As massas saem pela borda, os **4 quadrantes externos** têm vida/relevo e há 2–3 degraus de profundidade? Os caminhos ligam as portas?
6. A escala está certa (árvores de 3 a 8 m, porta de 1 m) e o acabamento tem `glow`, `edges` e direção de `sol` coerente?
7. Se houver referência: liste os **5 a 8 traços marcantes** dela e confira um por um. Diga ao mestre os que ficaram de fora e por quê.
