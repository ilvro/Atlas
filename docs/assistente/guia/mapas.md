> resumo: compor um mapa: ler o que existe, decidir a composição, ordem de construção, conferir com os olhos e as regras aprendidas na Fase 10.

## Antes de construir

1. `ponte_estado`: confirma que a ponte está conectada e quais apps estão abertos. Se não estiver, diga ao mestre para subir o `mesa-dev` e abrir o Atlas. Se a resposta trouxer o aviso de dados separados (ex.: Mesa no Firefox e Atlas no app de desktop), pare imediatamente e peça ao mestre para usar um lugar só, dizendo qual app está em qual lugar.
2. `atlas_o_que_vejo` (no Atlas) e `mesa_o_que_vejo` (na Mesa): o que o mestre tem na tela. No Atlas, o mapa aberto, o modo, a área visível e a seleção; na Mesa, a campanha, a tela e o item aberto. É o que dá sentido a "este cômodo", "esses objetos" ou "esta sessão".
3. `campanha_ler` (com `campanha_listar` para achar o `campanhaId`): entidades, sessões e o que já existe. Use `campanha_entidade_ler` e `campanha_sessao_ler` para aprofundar.
4. `atlas_mapas_listar` e `atlas_mapa_ler`: o que já há no Atlas e o que tem dentro do mapa aberto (cômodos, objetos, luzes, regiões, momentos, notas).
5. `atlas_catalogo`: nunca invente ids. Sem argumento devolve um índice; com `parte` (`receitas`, `colecao`, `materiais`, `climas`, `luzes`, `presenca`, `momentos`) devolve a lista. Quando uma ferramenta recusar um id, ela volta com os mais parecidos: use essas sugestões, não chute outro.
6. `atlas_abrir`: abre o mapa certo antes de escrever nele.

## Compor um mapa

### Decida a composição antes do detalhe

Antes de qualquer chamada, desenhe em texto uma grade mental de 5 em 5 metros e decida onde ficam as massas grandes: rocha, água, mata, construções e caminhos. Escreva esse rascunho para o mestre em poucas linhas (ex.: "rocha ao norte, lago no centro, trilha de oeste a leste, cabana a sudeste"). Só depois do rascunho aprovado vem o detalhe. Coordenadas são em metros, com origem no canto superior esquerdo e y para baixo; a única exceção são os cômodos (`atlas_comodos`), em células de 1,5 m.

### Ordem de construção

1. **Mapa:** `atlas_mapa_criar` (`nome`, `largura`, `altura` em metros, `base`, `genero`, `estilo`, `campanhaId`). Ele abre sozinho.
2. **Terreno:** `atlas_terreno`. Primeiro a `base`, depois as camadas em `operacoes`: água, maciço de rocha, chão. Use `correnteza` para a água se mover.
3. **Estrutura:** `atlas_comodos` (cômodos, com as paredes nascendo sozinhas; `rets` em células de 1,5 m com limites exclusivos, ex.: `[2, 3, 5, 6]` para 3 × 3 células = 4,5 × 4,5 m; tipos com padrões de piso e papel em `atlas_catalogo { parte: "climas" }`), `atlas_paredes` (muros, cercas, muretas e escarpas/barrancos avulsos) e `atlas_portas` (portas, janelas, arcos, passagens secretas). Crie o cômodo ou a parede antes da porta, em chamadas separadas.
4. **Objetos grandes:** árvores, rochedos e móveis grandes, com `atlas_objetos`; para muitos iguais, `atlas_espalhar` com um `conjunto`.
5. **Objetos pequenos:** adereços, bagunça e detalhes, com `atlas_objetos` e `atlas_espalhar`.
6. **Luzes:** `atlas_luzes`.
7. **Ambiente:** `atlas_ambiente` (clima, horário, tempo, acabamento) e, se couber, `atlas_presenca`.
8. **Regiões e notas:** `atlas_regioes` (revelar, gatilho, som, anotação) e `atlas_notas` (nota geral, leitura em voz alta e notas do mestre por cômodo).
9. **Momentos:** só no fim, quando o mapa já está de pé. Momentos que alteram o mapa (água que sobe, luzes, objetos) mudam o documento ao tocar: teste com `atlas_momento_testar` e volte ao estado anterior com `atlas_desfazer`.
10. **Gravar:** ao fim de uma leva de mudanças (e antes de pedir ao mestre para conferir ou de ler o mapa por outro caminho), `atlas_salvar`. Toda escrita termina com o lembrete "Não gravado" até você gravar.

### Confira com os olhos depois de cada bloco

Depois de cada bloco, chame `atlas_ver_mapa` (mapa inteiro, ou só uma `caixa` [x0, y0, x1, y1] em metros para olhar um detalhe de perto) e compare com a intenção. Corrija o que destoa antes de seguir. Mapas montados sem olhar a imagem saem errados: massas fora de lugar, objetos minúsculos, rotações trocadas. Quando uma escrita responder "nada mudou", confira as coordenadas na imagem.

## Regras que valem ouro

Elas vêm de refazer mapas comparando com referências profissionais.

- **Maciços de rocha vs. escarpas e barrancos:**
  - **Maciços volumétricos de rocha, caverna e falésia são terreno (`atlas_terreno` com uso `macico`):** use materiais maciços (ex.: `rocha.caverna`, `rocha.arenito`, `rocha.nevada`, `rocha.cinza`; confira em `atlas_catalogo { parte: "materiais" }`) para grandes massas, montanhas, platôs e paredes de caverna que cobrem áreas de células. Rochedos como objetos por cima dão volume adicional.
  - **Escarpa linear (`atlas_paredes` com `kind: 'cliff'` e `drop: 'a' | 'b'`):** use para desníveis de relevo, barrancos, margens altas de lagos/rios ou degraus entre patamares ao longo de uma linha de pontos. A escarpa bloqueia o passo (`move: true`), mas não bloqueia a visão nem a luz, assando a face rochosa inclinada em direção ao lado baixo indicado por `drop` (`'a'` para a esquerda do traçado, `'b'` para a direita; padrão `'b'`). Exemplo: `atlas_paredes { paredes: [{ path: [[10, 5], [10, 25]], kind: 'cliff', drop: 'b', material: 'rocha.cinza' }] }`. Nunca use paredes comuns (`kind: 'wall'`) para desníveis naturais.
- **Construções e interiores sempre com `atlas_comodos`.** Nunca use contorno de `atlas_paredes` para casas, salas, cabanas ou masmorras: paredes soltas não criam piso nem telhado, deixando o chão cru do terreno por dentro. `atlas_paredes` é só para cercas, muros e divisórias externas. Crie o cômodo antes das portas (`atlas_portas`).
- **Sem manchas de material em disco isolado.** Cascalho ou terra em círculos perfeitos parecem recortes. Use `irregular` alto (0,8 a 1,4) e formas maiores, ou não use.
- **Presença com economia.** Sangue, fuligem, musgo e mofo em pouca quantidade e finos: faixas estreitas (0,4 a 0,5 m) e `intensidade` baixa (0,3 a 0,45). A presença é desenhada por cima dos objetos: não pinte onde há um objeto importante.
- **Peças de cais, deque e tablado sempre com `rotacao` explícita** (0 ou o ângulo desejado, em radianos). Sem ela, o objeto sai girado ao acaso.
- **Escala real.** Árvores de 3 a 8 m de diâmetro, rochedos de 2 a 5 m, esqueletos com cerca de 2 m, pilhas de ossos ou peles de 1,5 a 3 m. Coisas pequenas demais somem no mapa. Ajuste com `escala` se a receita sair miúda.
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

