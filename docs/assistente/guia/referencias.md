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

Meça pelo que tem tamanho conhecido: porta de 0,9 a 1,2 m, cama de 2 m, carroça de 3 m, pinheiro de 3 a 8 m de copa. Em perspectiva, o que está ao fundo encolhe: normalize antes de medir.

- **Porte tático mínimo:** casa rural simples `>= 5×4 m` de largura útil; casarão ou estalagem `>= 10–14 m`; torre, moinho ou farol com `raio >= 3,5–5 m` (use vários andares via `atlas_andares` + escadas quando a referência mostrar torre alta). Nunca faça casas-miniatura de `1×2` células.
- **Recorte tático de ilustrações em perspectiva:** se a imagem mostrar uma paisagem panorâmica enorme (vilarejo inteiro com montanhas distantes), **não** infle o mapa para `150×150 m` deixando bordas vazias; escolha um **recorte focal denso** (`45–85 m`) com os pontos marcantes. Só use mapa amplo se o mestre pedir explicitamente — e, nesse caso, preencha os **4 cantos** com floresta densa, rochedos e patamares de relevo.

## 4. Traduzir perspectiva em planta

- **Penhasco visto de lado** → borda de platô vista de cima: rocha (`macico`) ou escarpa (`atlas_paredes` com `kind: 'cliff'`) com o lado baixo (`drop`) para fora. **Do outro lado, o terreno continua** (mata, rio, campo), mais escuro e com névoa (`atlas_presenca` fina ou clima). Nunca feche a vila com um muro de rocha ao redor.
- **Casas em perspectiva** → plantas com portes e formas variados (`projetar`, passo 4), com telhado e frente para a rua.
- **Paliçada, muro, cerca** → acompanhe a borda real do platô ou perímetro, não um retângulo mecânico. Use `palicada` via `atlas_arranjo` (`padrao: "ao-longo"`, `espacamento: [2.0, 0]`) para muralhas de toras defensivas e `atlas_paredes { kind: "fence" }` ou `"low"` para cercas leves e muretas.
- **Floresta pintada como textura** → árvores de verdade (`atlas_espalhar` com `mata`, ou `casa:pinheiro-nevado-*` e `casa:arvore-nevada-*`), em bordas irregulares, densas na encosta e ralas perto das casas.
- **Torre, farol e moinho redondos** → use `atlas_comodos` com `circulo: { centro, raio, lados }` (`lados: 24` a `32`, `raio >= 3,5` m), telhado `torre-redonda` ou `torre-conica-de-palha`, andares extras via `atlas_andares` + `escada` e peças no topo ou entorno (`pas.moinho`, `lanterna.farol`). Para plantas inclinadas ou absides irregulares, use `poligono`.
- **Vários andares** → use `atlas_andares` (`ordem` negativo para porões, positivo para andares superiores) com as paredes externas e escadas (`escada: { leva }`) alinhadas nas mesmas coordenadas.

## 5. Dizer o que não dá

Antes de construir, diga ao mestre, em uma ou duas frases, o que o Atlas não reproduz da imagem: a vista em perspectiva e a altitude fotorealista. E diga como você vai aproximar cada um. Isso evita a decepção do "ficou plano".

## 6. Conferir contra a referência

No fim, ponha a captura (`atlas_ver_mapa`) ao lado da sua lista de traços marcantes e confira cada um: "paliçada seguindo a borda: sim; moinho isolado no alto: sim; floresta abaixo do penhasco: não, ficou um muro; vou trocar". Corrija antes de entregar.
