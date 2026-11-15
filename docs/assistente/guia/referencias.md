> resumo: como ler uma imagem de referência do mestre (mapa tático, mapa regional em perspectiva, arte de ambiente) e traduzi-la para o Atlas, com escala e o que o motor não faz.

# Ler uma referência

Quando o mestre mandar uma imagem, faça esta leitura **por escrito**, antes de qualquer chamada, e mostre a ele os itens 3 a 5.

## 1. Que tipo de imagem é

- **Mapa tático visto de cima** (battlemap): copie a estrutura quase direto; meça a escala.
- **Mapa regional ou vista em perspectiva** (uma vila inteira pintada de lado, um vale): é **tradução**. A composição e os pontos focais valem; as distâncias e a forma das casas, não.
- **Arte de ambiente** (um interior, uma paisagem): pegue clima, materiais, paleta e objetos marcantes.
- **Planta baixa**: copie os cômodos e as portas; invente o exterior.

## 2. O que extrair

1. **Massas:** o que ocupa mais área (platô, floresta, lago, a vila) e onde.
2. **Eixos:** estradas, trilhas, rios e cercas, e de que borda para que borda vão.
3. **Desníveis:** penhascos, platôs, degraus, encostas, e **para que lado o terreno desce**.
4. **Pontos focais:** torre, igreja, poço, ponte, portão: o que o olho procura primeiro.
5. **Materiais, paleta e clima:** neve, madeira escura, pedra, névoa, hora do dia.
6. **Os 5 a 8 traços marcantes:** a frase que o mestre usaria para descrever a imagem ("a vila no alto de um penhasco, cercada de paliçada, com o moinho e o farol isolados no ponto mais alto").

## 3. Escala

Meça pelo que tem tamanho conhecido: porta de 0,9 a 1,2 m, cama de 2 m, carroça de 3 m, casa de vila de 6 a 10 m de frente, pinheiro de 3 a 8 m de copa. Em perspectiva, o que está ao fundo encolhe: normalize antes de medir. Compare com o tamanho do mapa: se a imagem mostra 40 casas, um mapa tático legível não comporta todas; escolha o recorte (a praça e a rua principal, por exemplo) ou proponha mapas separados.

## 4. Traduzir perspectiva em planta

- **Penhasco visto de lado** → borda de platô vista de cima: rocha (`macico`) ou escarpa (`atlas_paredes` com `kind: 'cliff'`) com o lado baixo (`drop`) para fora. **Do outro lado, o terreno continua** (mata, rio, campo), mais escuro e com névoa (`atlas_presenca` fina ou clima). Nunca feche a vila com um muro de rocha ao redor.
- **Casas em perspectiva** → plantas com portes e formas variados (`projetar`, passo 4), com telhado e frente para a rua.
- **Paliçada, muro, cerca** → `atlas_paredes` (`fence`, `low`) acompanhando a borda real do platô, não um retângulo.
- **Floresta pintada como textura** → árvores de verdade (`atlas_espalhar` com `mata`, ou `casa:pinheiro-nevado-*` e `casa:arvore-nevada-*`), em bordas irregulares, densas na encosta e ralas perto das casas.
- **Torre, farol e moinho redondos** → ainda não há cômodo redondo: aproxime com um octógono de células, montado com 3 `rets` empilhadas, a do meio mais larga (ex.: `[[11, 10, 13, 11], [10, 11, 14, 13], [11, 13, 13, 14]]`), telhado `torre` e, por cima, peças que digam o que é (`pas.moinho`, `lanterna.farol`). Explique a aproximação ao mestre.
- **Vários andares** → o Atlas mostra um andar por mapa: faça mapas separados (térreo, porão, andar de cima) com o mesmo contorno externo e as escadas no mesmo ponto.

## 5. Dizer o que não dá

Antes de construir, diga ao mestre, em uma ou duas frases, o que o Atlas não reproduz da imagem: a vista em perspectiva, a altitude de verdade, os cômodos redondos e os andares no mesmo mapa. E diga como você vai aproximar cada um. Isso evita a decepção do "ficou plano".

## 6. Conferir contra a referência

No fim, ponha a captura (`atlas_ver_mapa`) ao lado da sua lista de traços marcantes e confira cada um: "paliçada seguindo a borda: sim; moinho isolado no alto: sim; floresta abaixo do penhasco: não, ficou um muro; vou trocar". Corrija antes de entregar.
