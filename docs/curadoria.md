# Curadoria: candidatos para a coleção da casa

Pesquisa de 3 de novembro de 2026 (Fase 6.2a). **Nada foi baixado, convertido ou posto em `public/`.** Só entram CC0 e CC-BY 4.0 (AGENTS.md); NC, ND, SA, "uso pessoal" e licença ambígua ficam de fora.

**Limite desta pesquisa:** vi as páginas e os resumos da busca, não os arquivos. As notas de estilo (1 a 5) são estimadas pela descrição; a licença, o ângulo (vista de cima ortogonal) e a resolução precisam ser conferidos no pacote antes de importar. Por isso a coluna "onde a licença está escrita" diz o que a página afirma, e a conferência do arquivo de licença do pacote é a primeira coisa a fazer se algum candidato for aprovado.

## Resumo honesto

O que existe com licença clara é, em sua maioria, **pixel art de 16 a 48 px por tile**, o que dá bem menos de 64 px/m na pegada real e destoa do traço ilustrado do Atlas. Os pacotes bonitos de mapa de mesa (2-Minute Tabletop, Roll20, DungeonFog) têm licença que **não** permite redistribuir. Por isso **não há nenhum candidato que eu "recomende" sem ressalva**. A coleção da casa pode seguir quase toda gerada (já são 45 itens: estofados capitonê, plantas, árvores, tapetes), e isso não é falha. Os "talvez" abaixo só valem se você quiser reforçar categorias que as receitas e os geradores não cobrem bem (objetos de masmorra e fantasia, utensílios).

## Talvez

| objeto | categoria | fonte | url | autor | licença | onde a licença está escrita | estilo (1 a 5) | por que serve / ressalva |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kenney Furniture Kit (sprites 2D de cima e isométricos: cadeiras, sofás, mesas, estantes, cozinha, banheiro) | assentos, mesas, armazenamento, cozinha, banheiro | Kenney | https://www.kenney.nl/assets/furniture-kit | Kenney | CC0 | página do pacote ("Creative Commons CC0") e a listagem do OpenGameArt | 3 (renders limpos em 3D, sem traço) | Maior cobertura de móveis de casa moderna e do banheiro. Ressalvas: os sprites "top-down" saem de renders 3D (sombreado liso, sem contorno), então dependem da harmonização (6.3); preciso abrir o pacote para ver a resolução e se a vista é mesmo ortogonal de cima. Bom candidato para o **kit moderno**. |
| 70 Free Flat Greyscale Dungeon Assets | decoração, armazenamento (barris, caixotes, mobília de masmorra) | itch.io | https://markgosbell.itch.io/70-free-flat-greyscale-dungeon-assets | Mark Gosbell | CC0 | página do pacote (CC0) | 2 (cinza chapado; precisa ganhar cor e contorno) | Todos na mesma escala: a página diz "70 pixels = um quadrado"; é preciso confirmar se o quadrado é de 1 m ou de 5 pés, o que muda a resolução (de 70 a 46 px/m). Em cinza, a harmonização de cor (6.3b) as tinge. Serve ao **kit fantasia** (barris, caixas). |
| Furniture Pack (2D) | geral | OpenGameArt | https://opengameart.org/content/2d-furniture-pack | (autor na página) | CC-BY 4.0 | página do OpenGameArt | ? (não vi) | CC-BY exige crédito aqui e na tela de ajuda. Não vi as imagens: só entra se a vista e o traço combinarem. |

## Não recomendo (e por quê)

| objeto | fonte | url | licença | motivo |
| --- | --- | --- | --- | --- |
| 32x32 furniture (sofá, cama, mesa de bilhar) | OpenGameArt | https://opengameart.org/node/4726 | CC0 | 32 px por tile: cerca de 21 px/m numa casa de 1,5 m por célula, bem abaixo de 64 px/m; traço pixelado. Só serviria ao estilo Pixel (Fase 8), que ainda rasteriza a mesma descrição. |
| Furniture for nobles (48x48, RPG Maker) | OpenGameArt | https://opengameart.org/node/160826 | CC0 | RPG Maker costuma ser vista 3/4, não de cima; a página não diz o ângulo; resolução baixa. |
| Top-down interior assets pixel art, Top-down retro house | itch.io (pixelsbyskab, penzilla) | https://pixelsbyskab.itch.io/top-down-interior-assets-pixel-art | não vi | licença não confirmada; pixel art de baixa resolução. |
| Faultbox "Interior" (16x16) | itch.io | https://faultbox.itch.io/interior | não vi | licença não aparece nos resultados; 16 px por tile. |
| Furniture Map Assets (2-Minute Tabletop) | 2minutetabletop.com | https://2minutetabletop.com/?p=1018575 | CC BY-NC 4.0 | NC: não permite redistribuir livremente. Os melhores móveis de mapa de mesa que achei, mas fora dos critérios. |
| Bandits and brigands (tapetes e peles) | Roll20 Marketplace | https://marketplace.roll20.net/browse/set/13672/bandits-and-brigands-asset-pack | Roll20 EULA (uso pessoal, não distribuir) | proibida a redistribuição. |
| Fetching Furnishings, Modern Essentials (DungeonFog) | DungeonFog | https://www.dungeonfog.com/marketplace/fetching-furnishings-1/ | não declarada | licença ambígua: não entra. |
| Beds (tilesets de cama) | OpenGameArt | https://opengameart.org/content/beds | CC-BY-SA | SA obrigaria a licenciar a coleção igual: fora. |
| Isometric table, chair and sofa | OpenGameArt | (resultado da busca) | CC0 | isométrico 45°, não de cima. |

## O que preciso de você

Qual destes (se algum) devo importar na 6.2b? Minha sugestão: **nenhum agora**. Os candidatos "talvez" exigem abrir os pacotes para conferir ângulo, resolução e arquivo de licença, e o ganho é pequeno diante do que os geradores já cobrem. Se quiser tentar, o mais promissor é o **Kenney Furniture Kit** para o kit moderno; me diga e eu baixo só esse pacote, confiro a licença do arquivo e mostro as imagens antes de importar qualquer coisa.

## Padrão 2.5D (~75°) para sprites pintados (Frente K)

As receitas procedurais seguem desenhando pisos, terrenos, formas livres e mobília paramétrica. Um sprite pintado só entra onde a ilustração vence o desenho vetorial: as **peças heroicas**, que o olho procura primeiro numa cena. Todo sprite desse pack segue o mesmo padrão, para conviver com as receitas sem destoar.

### Especificação

- **Câmera:** oblíqua consistente de ~75°, inclinada do sul para o norte. Mostra o topo inteiro e uma faixa estreita da face da frente (`+y`, a frente local do objeto, a mesma das receitas), com cerca de 20 a 25% da altura real. Nunca isométrico (45°) nem vista 3/4 de RPG Maker.
- **Luz:** neutra, vinda de noroeste (a mesma do chanfro das paredes e do nanquim das receitas). **Nenhuma sombra longa embutida**: a sombra projetada vem de `sombras-do-sol.ts` pela `altura` do item. Só vale a oclusão de contato curta, colada à base.
- **Resolução:** `128 px/m` para peças grandes e `256 px/m` para miúdas (o validador recusa fora dessa faixa). A pegada declarada é a da base no chão; a imagem cobre a pegada mais a margem de sombra, como os itens gerados.
- **Fundo e borda:** PNG/WebP com alfa limpo (sem halo nem franja de cor), compatível com `derivarPixel`. Contorno pintado fino e escuro, nunca o traço preto grosso de CAD.
- **Paleta:** tons terrosos e dessaturados, coerentes com os materiais (`madeira.*`, `tecido.*`, `pedra.*`) e com a harmonização de cor da coleção.
- **Registro:** no `colecao.json`, `vista: "obliqua"`, `altura` em metros e `res`; a origem segue as regras de sempre (gerado, ou achado com CC0/CC-BY 4.0 e linha em `docs/LICENCAS.md`).

### Pack piloto (ordem de prioridade)

1. Cama com lençol amassado (solteiro e casal).
2. Sofá estofado.
3. Estante cheia.
4. Fogão a lenha e pia de pedra.
5. Mesa rústica gasta.
6. Tapete persa detalhado.
7. Escada circular de madeira e pedra com poço central.
8. Pinheiro nevado em camadas.
9. Carroça coberta.
10. Barco a remo de tábuas.
11. Segmento de paliçada alta.
12. Lareira de pedra.

### Como um sprite entra

1. Conferir licença no arquivo do pacote (não só na página) e registrar autor, fonte, URL e arquivo original.
2. Conferir o ângulo contra a especificação: topo + faixa da frente, luz de noroeste, sem sombra longa. Se a sombra vier embutida, recortar antes.
3. Reamostrar para 128 ou 256 px/m pela pegada real, com alfa limpo.
4. Registrar no `colecao.json` (`vista: "obliqua"`, `altura`, `res`) e em `docs/LICENCAS.md`; `npm test` valida os dois.
5. Comparar no mapa, lado a lado com a receita equivalente, em Ilustrado e Pixel, antes de trocar a receita no acervo.

Até haver arte pintada com licença conferida, **nenhum binário entra**: a escada em caracol, as camas e a paliçada já foram refeitas em 2.5D nas receitas (K8 e K9) e cobrem o pack provisoriamente.
