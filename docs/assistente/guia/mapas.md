> resumo: construir um mapa: o que ler antes, a ordem das chamadas, conferir com os olhos, as regras de ouro e o respeito ao que é do mestre. O projeto vem antes: leia `projetar`.

## Antes de construir

1. `ponte_estado`: confirma que a ponte está conectada e quais apps estão abertos. Se não estiver, diga ao mestre para subir o `mesa-dev` e abrir o Atlas. Se a resposta trouxer o aviso de dados separados (ex.: Mesa no Firefox e Atlas no app de desktop), pare imediatamente e peça ao mestre para usar um lugar só, dizendo qual app está em qual lugar.
2. `atlas_o_que_vejo` (no Atlas) e `mesa_o_que_vejo` (na Mesa): o que o mestre tem na tela. No Atlas, o mapa aberto, o modo, a área visível e a seleção; na Mesa, a campanha, a tela e o item aberto. É o que dá sentido a "este cômodo", "esses objetos" ou "esta sessão".
3. `campanha_ler` (com `campanha_listar` para achar o `campanhaId`): entidades, sessões e o que já existe. Use `campanha_entidade_ler` e `campanha_sessao_ler` para aprofundar.
4. `atlas_mapas_listar` e `atlas_mapa_ler`: o que já há no Atlas e o que tem dentro do mapa aberto (cômodos, objetos, luzes, regiões, momentos, notas).
5. `atlas_catalogo`: nunca invente ids. Sem argumento devolve um índice; com `parte` (`receitas`, `colecao`, `conjuntos`, `comodos`, `materiais`, `telhado`, `climas`, `luzes`, `presenca`, `momentos`) devolve a lista; com `busca` (ex.: `atlas_catalogo { busca: "cemiterio" }`) procura por palavra em receitas, coleção, conjuntos e materiais. Os conjuntos do `atlas_espalhar` estão em `atlas_catalogo { parte: "conjuntos" }` (`mata`, `jardim`, `cemiterio`, `papelada`, `caixotes`, `bibelos`, `refeicao`, `bagunca`, `plantas`). Quando uma ferramenta recusar um id, ela volta com os mais parecidos: use essas sugestões, não chute outro.
6. `atlas_abrir`: abre o mapa certo antes de escrever nele.

## Compor um mapa

O que não está carregado (`atlas_espalhar`, `atlas_ambiente`, `atlas_presenca`, `atlas_caminho`, `atlas_regioes`, `atlas_andares`, `atlas_notas`, `atlas_momento`): carregue com `plataforma_ferramentas`.

### Projete antes de construir

Antes de qualquer chamada, faça o projeto com `plataforma_guia projetar` (brief, programa, circulação, massa, identidade) e consulte o repertório do lugar em `lugares` (exteriores) ou `interiores`. Com imagem de referência, leia antes `referencias`. Depois desenhe em texto uma grade mental de 5 em 5 metros com as massas grandes (rocha, água, mata, construções e caminhos) e mostre ao mestre o resumo em poucas linhas (ex.: "platô na diagonal, mata abaixo do penhasco a leste, rua de sul a norte, salão dominante na praça"). Só depois do resumo aprovado vem o detalhe. Coordenadas são em metros, com origem no canto superior esquerdo e y para baixo; a única exceção são os cômodos (`atlas_comodos`), em células de 1,5 m.

### Ordem de construção

1. **Mapa:** `atlas_mapa_criar` (`nome`, `largura`, `altura` em metros, `base`, `genero`, `estilo`, `campanhaId`). Ele abre sozinho.
2. **Terreno:** `atlas_terreno`. Primeiro a `base`, depois as camadas em `operacoes`: água, maciço de rocha, chão. Use `correnteza` para a água se mover.
3. **Estrutura:** edifícios com `atlas_edificio` (monta planta composta, portas, janelas, telhado, mobília e luzes por programa); `atlas_comodos` para o que for irregular (`rets` em células de 1,5 m com limites exclusivos, ex.: `[2, 3, 5, 6]`; tipos em `atlas_catalogo { parte: "comodos" }` e estilos de telhado em `atlas_catalogo { parte: "telhado" }`), `atlas_paredes` (muros, cercas, muretas e escarpas/barrancos avulsos) e `atlas_portas` (portas, janelas, arcos, passagens secretas). Crie o cômodo ou a parede antes da porta, em chamadas separadas.
4. **Objetos grandes:** árvores, rochedos e móveis grandes, com `atlas_objetos`; para muitos iguais, `atlas_espalhar` com um `conjunto`.
5. **Objetos pequenos:** adereços, bagunça e detalhes, com `atlas_objetos` e `atlas_espalhar`.
6. **Luzes:** `atlas_luzes`.
7. **Ambiente:** `atlas_ambiente` (clima, horário, tempo, acabamento) e, se couber, `atlas_presenca`.
8. **Regiões e notas:** `atlas_regioes` (revelar, gatilho, som, anotação) e `atlas_notas` (nota geral, leitura em voz alta e notas do mestre por cômodo).
9. **Momentos:** só no fim, quando o mapa já está de pé. Momentos que alteram o mapa (água que sobe, luzes, objetos) mudam o documento ao tocar: teste com `atlas_momento_testar` e volte ao estado anterior com `atlas_desfazer`.
10. **Revisar antes de entregar:** chame `atlas_revisar` para apontar defeitos objetivos (cômodos sem acesso, portas bloqueadas, objetos fora do mapa, edifícios sem telhado, interiores vazios, casas todas iguais, fileiras mecânicas, repetição excessiva, noite sem luz) e corrija todos os `erros` e `avisos` antes de dar o mapa por pronto.
11. **Gravar:** ao fim de uma leva de mudanças (e antes de pedir ao mestre para conferir ou de ler o mapa por outro caminho), `atlas_salvar`. Toda escrita termina com o lembrete "Não gravado" até você gravar.

### Confira com os olhos depois de cada bloco

Depois de cada bloco, chame `atlas_ver_mapa` (mapa inteiro, ou só uma `caixa` [x0, y0, x1, y1] em metros para olhar um detalhe de perto; passe `andar` para conferir outro pavimento sem perder o ativo) e compare com a intenção. Corrija o que destoa antes de seguir. Mapas montados sem olhar a imagem saem errados: massas fora de lugar, objetos minúsculos, rotações trocadas. Quando uma escrita responder "nada mudou", confira as coordenadas na imagem. Depois de levantar edifícios e antes de `atlas_salvar`, confira tanto `vista: "planta"` quanto `vista: "telhados"` inspecionando os **4 quadrantes externos** do mapa: proporção realista das casas, variedade de ângulos e formas, vegetação/rochedos nos arredores e profundidade com luz e acabamento. No fim, rode `atlas_revisar` e passe pela conferência do passo 8 de `projetar`.

### Construções em vários andares

Quando um edifício tiver subsolo ou pavimentos superiores:

1. **Crie os andares primeiro** com `atlas_andares` (`ordem: -1` para porão, `1`, `2` para andares de cima; o térreo já é `null`).
2. **Alinhe as paredes externas entre os andares** (mesmas células `rets` ou contorno nas paredes estruturais; o porão costuma ser menor ou igual ao térreo e nunca maior que a base que o sustenta).
3. **Alinhe escadas e alçapões no mesmo `[x, y]`** nos dois andares (`escada`, `escada.caracol`, `escada.pedra`, `escada.madeira`, `alcapao`), ligando cada uma ao andar de destino com `escada: { leva }` (para descer ao térreo use `leva: null`).
4. **Confira andar por andar** com `atlas_ver_mapa { andar: "porao" }`, `{ andar: null }`, `{ andar: "andar-1" }` usando `vista: "planta"` e `"telhados"`.

Exemplo — moinho de 3 andares (subsolo úmido com poço, térreo com moenda/farinha e 1º andar com depósito de grãos):
1. `atlas_andares { acao: "criar", id: "porao", ordem: -1, nome: "Porão" }` e `atlas_andares { acao: "criar", id: "andar-1", ordem: 1, nome: "1º andar" }`.
2. Cômodos nas mesmas coordenadas externas: base menor em `porao` (`rets: [[10, 10, 14, 14]]`), `térreo` (`andar: null`, `rets: [[10, 10, 14, 14]]`) e `andar-1` (`rets: [[10, 10, 14, 14]]`, telhado `torre`).
3. Em `[17, 17]` nos três andares: `escada.caracol` em `porao` (`escada: { leva: null }`), em `null` (`escada: { leva: "andar-1" }`, mais outra descendo se quiser dupla) e em `andar-1` (`escada: { leva: null }`).
4. Mobília por andar: poço e barris no `porao`; moenda, sacos de farinha e balcão no térreo; depósito de grãos e engrenagens no `andar-1`.

## Regras que valem ouro

Elas vêm de refazer mapas comparando com referências profissionais.

- **Casas com forma e porte.** Nunca uma fileira de retângulos iguais: cada edifício tem programa, porte e forma próprios (L, anexo, alpendre) e um traço de identidade. Veja `projetar`, passos 2, 4 e 5.
- **Nada em grade mecânica.** Lápides, árvores, caixas e bancos: varie receita, rotação e espaçamento, e deixe falhas.

- **Maciços de rocha vs. escarpas e barrancos:**
  - **Maciços volumétricos de rocha, caverna e falésia são terreno (`atlas_terreno` com uso `macico`):** use materiais maciços (ex.: `rocha.caverna`, `rocha.arenito`, `rocha.nevada`, `rocha.cinza`; confira em `atlas_catalogo { parte: "materiais" }`) para grandes massas, montanhas, platôs e paredes de caverna que cobrem áreas de células. Rochedos como objetos por cima dão volume adicional.
  - **Escarpa linear (`atlas_paredes` com `kind: 'cliff'` e `drop: 'a' | 'b'`):** use para desníveis pontuais ou margens altas sem dividir o relevo da área inteira. Quando uma parte inteira do mapa é platô e outra é vale/abismo, prefira `atlas_terreno` com `acao: 'relevo'` (`altura` de −200 a 200 m): ele cria os penhascos, a névoa de altitude e a sombra do sol automaticamente; árvores e objetos lá embaixo ficam em escala real (a névoa cuida da distância). A escarpa linear bloqueia o passo (`move: true`), mas não bloqueia a visão nem a luz. Nunca use paredes comuns (`kind: 'wall'`) para desníveis naturais.
- **Construções e interiores sempre com `atlas_comodos`.** Nunca use contorno de `atlas_paredes` para casas, salas, cabanas ou masmorras: paredes soltas não criam piso nem telhado, deixando o chão cru do terreno por dentro. `atlas_paredes` é só para cercas, muros e divisórias externas. Crie o cômodo antes das portas (`atlas_portas`).
- **Caminhos e trilhas sempre com `atlas_caminho`.** Nunca desenhe trilhas ou estradas com `faixa` reta de `atlas_terreno`; `atlas_caminho` suaviza curvas, varia a largura e cria bordas orgânicas e sulcos.
- **Sem manchas de material em disco isolado.** Cascalho ou terra em círculos perfeitos parecem recortes. Use `irregular` alto (0,8 a 1,4) e formas maiores, ou não use.
- **Presença com economia.** Sangue, fuligem, musgo e mofo em pouca quantidade e finos: faixas estreitas (0,4 a 0,5 m) e `intensidade` baixa (0,3 a 0,45). A presença é desenhada por cima dos objetos: não pinte onde há um objeto importante.
- **Peças de cais, deque e tablado sempre com `rotacao` explícita** (0 ou o ângulo desejado, em radianos). Sem ela, o objeto sai girado ao acaso.
- **Escala real.** Árvores de 3 a 8 m de diâmetro, rochedos de 2 a 5 m, esqueletos com cerca de 2 m, pilhas de ossos ou peles de 1,5 a 3 m. Coisas pequenas demais somem no mapa. Ajuste com `escala` se a receita sair miúda.
- **Cada coisa no seu lado.** Neve, árvores e props de fora nunca invadem um cômodo; paredes avulsas não atravessam salas; paliçadas e cercas ficam a 1,5 m ou mais de cristas e degraus do relevo. O `atlas_revisar` aponta os três casos: corrija antes de entregar.
- **Interiores de lugares de trabalho cheios.** Armazéns, oficinas e tavernas pedem fileiras de caixotes, barris e sacas com corredores entre elas, não meia dúzia de objetos soltos. Um interior vazio parece inacabado.
- **Água com caráter.** O mar tem rebentação e espuma na beira. A água parada de uma gruta é cristalina e calma. A correnteza é baixa (0,1 a 0,4 m/s) em lago e mais alta em rio.
- **Luz com propósito.** Poucas fontes: tochas, lanternas, o feixe de luz de uma abertura. À noite, ambiente baixo e poças de luz quentes. Não exagere no `raio` nem na `intensidade`. Luzes só aparecem de verdade em clima escuro, então ajuste `atlas_ambiente` junto.
- **Divida chamadas grandes.** Há limites por chamada (100 itens, 200 objetos). Em vez de uma chamada gigante, faça várias, uma por região ou ideia, e olhe o resultado entre elas.
- **Erros são informação.** Leia a mensagem (id inexistente, coordenada fora do mapa, ordem errada), corrija e tente de novo. Nunca repita a mesma chamada às cegas.

## Respeito ao que é do mestre

- O que o mestre fez é dele. Nunca apague nem mova nada dele sem motivo claro. `atlas_remover`, `atlas_mover` e `atlas_momento` agem na hora, sem pedir confirmação, e o app do Claude já pede a permissão de cada chamada; por isso o cuidado é seu. Antes de remover, mover ou refazer o que não foi você quem criou, confirme com o mestre na conversa. Para refazer um momento do mestre, prefira criar outro, a menos que ele peça a troca.
- Cômodos, paredes e aberturas não se movem; para mudar, apague (o que é seu) e recrie.
- Use `atlas_notas` com cuidado: ela substitui o texto anterior do campo. Leia antes (`atlas_mapa_ler`) para não sobrescrever uma nota do mestre.
- Explique o plano antes de chamadas grandes: o que vai fazer, em que ordem, e o que isso toca. Pergunte quando houver escolha criativa que mude o resultado.
- Tudo o que você faz pode ser desfeito pelo painel ou com Ctrl+Z; avise o mestre disso quando errar.
- Ao terminar, resuma o que foi feito, com nomes e ids (do mapa, dos cômodos, dos momentos), o que ficou de fora e o que vale revisar.

