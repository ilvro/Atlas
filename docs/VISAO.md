# Atlas — visão do produto

Data: 2 de novembro de 2026. Documento de visão da Fase 1 do planejamento. Ainda não existe código do Atlas; as decisões abaixo foram tomadas com o usuário e as propostas estão identificadas como tal.

## 1. Por que o Atlas existe

O Tabletop 3D entrega cenas lindas, mas para um mestre que prepara tudo sozinho montar um cenário em 3D ainda é trabalhoso, mesmo com construção assistida. O próprio Tabletop registrou que o gargalo é o conteúdo — modelos, materiais e composição —, não o motor ([VISUAL_TARGET.md](../../Tabletop/docs/VISUAL_TARGET.md)).

O **Atlas** é o editor de mapas 2D do ecossistema, para **mapas de qualquer gênero**: casa de investigação, taverna medieval, nave, escola, floresta, cripta. O horror é um dos climas possíveis, não o foco; quem define o clima é a engine de luz, a paleta e os assets. A promessa:

> Em dez minutos, o mestre desenha uma casa de três cômodos mobiliada, iluminada e com portas, e já joga a cena no projetor com névoa, luz e iniciativa.

O nome funciona igual em português e inglês, como Jukebox e Ateliê.

## 2. Lugar no ecossistema

| Projeto | Papel | Relação com o Atlas |
| --- | --- | --- |
| **Atlas** | Mapas 2D de cena: construir rápido e jogar | — |
| Tabletop (3D) | Cenas 3D detalhadas e cinematográficas | Recebe mapas promovidos do Atlas (futuro) |
| Ficha Ordem II | Fichas, rolagens, game feel | Tokens vinculados por `sheetId`; rolagens aparecem na mesa |
| Ateliê | Documentos de pista com luz UV | Pistas colocadas no mapa e inspecionadas na sessão |
| Jukebox | Música e cenas sonoras | Cena sonora por mapa e por região |

Os projetos continuam independentes, mas formam **uma plataforma para a campanha**, como o Atlas VTT faz dentro do Obsidian: todos no mesmo endereço do GitHub Pages, falando um contrato comum (referências, campanha, eventos, tema) e reunidos por um hub leve, a **Mesa**. Detalhes em [PLATAFORMA.md](PLATAFORMA.md). O Atlas é a implementação de referência desse contrato.

| Na plataforma | Exemplo |
| --- | --- |
| Tudo ligado | O cômodo "Biblioteca" sabe que a "Carta queimada" (Ateliê) está nele e que a cena sonora "Chuva na janela" (Jukebox) toca ali |
| A sessão conversa | Uma rolagem na Ficha aparece flutuando sobre o token no mapa; entrar na biblioteca troca a música |
| Um tema só | Trocar para Ordem ou Prata muda todos os aplicativos ao mesmo tempo |
| Notas da campanha | Lugares, personagens e pistas com `[[ligações]]`, abrindo cada coisa no aplicativo dono |

## 3. Decisões tomadas

| Tema | Decisão | Motivo |
| --- | --- | --- |
| Gênero | **Mapas no geral** | A luz, a paleta e os assets fazem o clima: um mesmo cômodo serve para um dia ensolarado ou para uma cena de horror. |
| Perspectiva | **Vista de cima com profundidade falsa** | Pintar, alinhar ao grid e construir continuam simples. A profundidade vem das paredes **caixa** (faces internas inclinadas para dentro de cada cômodo, como nos mapas de *O Segredo na Ilha*), de sombra de contato, de telhados que somem, de luz com relevo e de névoa pelas paredes. Isométrico multiplicaria o custo de arte e de construção. |
| Render | **Engine com dois renderizadores**: Ilustrado (padrão) e Pixel (no espírito do Enigma do Medo) | Cada asset é descrito **uma vez**; cada renderizador o desenha do seu jeito. A troca é ao vivo e o mapa não muda. |
| Origem dos objetos | **Coleção própria**: geradores procedurais + acervo da casa (gerado por nós ou achado com licença livre). Importar pacotes de terceiros é **opcional** e privado. | O mestre não desenha arte. O Atlas tem de ser completo e bonito sem nenhum pacote externo, como o Ateliê sem expansões. |
| Escala | **Mapas de cena primeiro** (cômodo, casa, rua, mata), com grid e tokens | É o que a sessão usa. Mapas de região e mundo, o forte do Inkarnate, vêm depois. |
| Execução | **Site estático offline**, como o Ateliê | GitHub Pages, IndexedDB e cópia de segurança; abre em qualquer lugar, sem instalar nada. |

## 4. Princípio central: o mapa sabe o que é

O documento guarda **significado**, não pixels: piso de madeira, cômodo "cozinha", parede de tijolo com 2,6 m, porta fechada, mesa (receita + seed), lampião, token do Arthur. Isso habilita, de uma vez:

- **Renderizadores trocáveis.** Ilustrado e Pixel desenham as mesmas entidades.
- **Construção inteligente.** O assistente lê cômodos, portas e móveis para sugerir o próximo passo.
- **Imersão real.** Visão, luz e névoa usam as paredes de verdade; portas abertas mudam o que se vê.
- **Promoção para o 3D.** Paredes, aberturas e cômodos já estão definidos; o Tabletop 3D só monta o volume.

Regra herdada do Tabletop: **toda automação produz entidades comuns**, com IDs, parâmetros e propriedades editáveis. Nada fica "assado" ou bloqueado.

## 5. Identidade própria

As referências ensinam a **gramática** de um bom mapa 2D (ver §8.1). A **estética** é do Atlas. Três marcas que nenhum editor de mapas tem juntas:

### 5.1. A memória vira desenho

A névoa deixa de ser uma tarja preta e passa a contar a história:

| Estado | Como aparece |
| --- | --- |
| Visível agora | Pintado e iluminado pela engine de luz |
| Já explorado, fora da vista | Esboço a traço sobre papel, sem cor e sem luz, como a anotação de quem passou por ali. Objetos móveis e tokens não aparecem. |
| Nunca visto | Fundo do mapa |

No editor, o mestre vê tudo, mas o que ainda está só planejado (cômodo sem piso definido, área marcada para depois) aparece como esboço. A transição entre estados é animada: o traço ganha tinta e cor ao ser revelado, e desbota de volta quando sai da vista. Funciona em qualquer gênero: planta de investigador, mapa de aventureiro, diagrama de nave.

### 5.2. A luz é a protagonista

- Uma **engine de luz** única para os dois renderizadores: luz ambiente, sol e lua por horário, luzes pontuais e com cone, sombras das paredes, tremulação, cor por temperatura.
- **Predefinições de clima**, combinando luz, paleta e acabamento: "Tarde ensolarada", "Taverna à noite", "Corredor de hospital", "Apagão", "Neon", "Cripta". O horror nasce aqui, não de uma estética fixa.
- **O mesmo mapa, vários momentos:** a casa de dia na investigação, a casa numa tempestade, a casa à noite, a casa sem energia. Nada é redesenhado: o clima muda a luz do sol e da lua, a paleta, o acabamento e as partículas, e as luzes do mapa reagem sozinhas (lâmpadas apagam no apagão, janelas acendem à noite, relâmpagos iluminam pelas janelas na tempestade). A troca é ao vivo e animada na sessão.

### 5.3. Pincéis de presença

Camadas animadas pintadas por cima do mapa, que reagem à luz e cuja intensidade o mestre controla durante a sessão:

- **Naturais:** musgo e trepadeiras invadindo, poeira e teia, neve acumulando, água subindo, fogo se espalhando.
- **Sobrenaturais:** corrupção que pulsa, cristais que brilham, inscrições que só aparecem sob certa luz, cintilação de falha, distorção.
- **Pacote Ordem Paranormal:** um conjunto por elemento (Sangue, Morte, Conhecimento, Energia, Medo), com cores coerentes com a Ficha e desenhos próprios, nunca os símbolos do livro.

### 5.4. Família visual: a interface da Ficha

A interface segue a Ficha Ordem II: faixas rasgadas, títulos grandes em serifa, cor de destaque por tema (vermelho do Ordem, prata da Vigília), ícones facetados, ações dentro do conteúdo, dock, transições e efeitos de jogo. Acima de tudo, o que faz a Ficha parecer um jogo: **tudo é fluido e integrado**, com qualidade de vida em cada canto. Detalhes em [INTERFACE.md](INTERFACE.md). O mapa segue a paleta escolhida, não a interface.

## 6. A engine de renderização

Um asset é descrito **uma única vez**, como formas, materiais, alturas e pontos de luz — não como uma imagem. Cada renderizador interpreta essa descrição:

| | Ilustrado (padrão) | Pixel (opcional, troca ao vivo) |
| --- | --- | --- |
| Resolução | Alta, nítida em qualquer zoom | Fixa por célula do grid (12, 16 ou 24 px), ampliada sem suavização |
| Superfícies | Texturas procedurais pintadas, grão, desgaste, relevo | Mesmas formas, paleta limitada, dithering, sombreado em degraus |
| Contorno | Traço leve de nanquim | 1 px por objeto |
| Luz | Contínua, borda suave | Mesma engine, em faixas, borda dura, sombras em blocos |
| Personagens | Retrato no token, com estado (ferido, morrendo…) | **Sprite animado** parado e andando em 4 direções |
| Revelação e transições | Tinta escorrendo, traço ganhando cor | Dissolução em dithering |
| Interface no projetor | Tipografia da família | Fonte pixel na iniciativa, títulos e eventos |

O que **não** muda entre os dois: documento, grid, colisão, visão, névoa, iniciativa, sessão. Trocar no meio da sessão é instantâneo e volta do mesmo jeito.

- **Receitas procedurais** emitem a descrição; os dois estilos saem dela, sem trabalho extra por asset.
- **Imagens** (acervo achado ou importado) não têm descrição: o renderizador Pixel deriva a versão pixel automaticamente (redução que preserva bordas, paleta, contorno). Uma versão pixel feita à mão pode substituir a automática quando existir.
- **Sprites dos personagens** vêm de um gerador paramétrico (corpo, cabelo, roupa, acessórios, cores puxadas do retrato ou da ficha). O mestre ajusta em segundos; ninguém precisa desenhar.
- O Ilustrado também pode usar sprites animados nos tokens, em resolução alta, como opção.

## 7. Elementos do mapa

### 7.1. Paredes, cômodos e cena

- **Paredes em dois estilos**, escolhidos por mapa ou por cômodo:
  - **Caixa** (padrão): cada cômodo mostra as quatro faces internas das paredes inclinadas para o próprio centro, com janelas, quadros, estantes e papel de parede nelas.
  - **Sólida**: faixa escura grossa com sombra projetada no piso. Mais limpa para combate.
- **Cômodos como ilhas** sobre um fundo do mapa (cor, papel, textura), com área externa opcional (varanda, escada, jardim).
- **Identidade por cômodo**: a função escolhe piso, papel de parede, paleta e objetos juntos.
- **Paletas por campanha**: fantasia quente, investigação sépia, ficção científica fria, horror dessaturado, pastel diurno, e as do usuário.
- **Acabamento da cena**: camada final que unifica tudo — textura, vinheta, saturação, granulação e ajuste de cor —, com predefinições. Ela também harmoniza objetos de origens diferentes.
- **Cartela de título** opcional sobre o fundo (nome da campanha ou do lugar).

### 7.2. De onde vêm os objetos

O mestre não desenha arte, então o Atlas precisa ser completo sem pacotes externos. Três fontes, nesta ordem de prioridade:

| Fonte | O que é | Onde fica |
| --- | --- | --- |
| **Geradores procedurais** | Código que descreve o objeto a partir de parâmetros e seed, em qualquer resolução e nos dois renderizadores. Forte em pisos, paredes, padrões de tapete, mesas, camas, estantes, armários, papéis, livros, garrafas, entulho e móveis estofados simples. | `src/procedural/` (no git) |
| **Acervo da casa** | Assets que **nós geramos** (geradores pesados rodados por script, em alta resolução) ou **achamos** com licença livre (CC0 e semelhantes), sempre com licença registrada. Cobre o que é difícil de gerar em tempo real: plantas, sofás ornamentados, objetos orgânicos. | `public/colecao/` (no git) + `docs/LICENCAS.md` |
| **Importação** (opcional) | Pacotes que o mestre já tem ou baixar. Nunca é requisito, nunca é publicado. | IndexedDB do navegador; arquivos locais em `data-private/` (fora do git) |

Toda imagem, de qualquer fonte, passa pela mesma **harmonização**: escala forçada pelo grid, recorte, contorno, sombra de contato e correção de cor para a paleta da cena.

## 8. Pilares de produto

### 8.1. Construção inteligente

- **Pintar cômodo.** Arrastar no grid cria o piso; as paredes nascem nas bordas, com cantos e espessura corretos. Cômodos vizinhos compartilham a parede.
- **Portas que encaixam.** Arrastar uma porta perto de uma parede encaixa no vão; entre dois cômodos, o Atlas sugere a parede compartilhada.
- **Mobília pela função.** O mestre nomeia o cômodo ("cozinha", "taverna", "ponte de comando", "sala de ritual") ou o Atlas deduz pelos objetos já colocados. A sugestão respeita portas, janelas, circulação e o que já existe, e segue o gênero e a paleta do mapa.
- **Assistente, não presets.** As sugestões leem o que o mestre fez e se adaptam; não substituem o trabalho dele por um modelo pronto.
- **Transições de terreno.** Grama encontrando terra, lama perto de água, calçada com bordas — sem pintar a borda à mão.
- **Espalhamento contextual.** Entulho junto às paredes, folhas sob árvores, papéis perto de mesas, com densidade controlada por pincel.
- **Prévia antes de confirmar.** Toda sugestão aparece como fantasma, é aceita como uma única ação e pode ser desfeita.

### 8.2. Fluidez de jogo

Inspirado na Ficha Ordem II, que tem "parecer um jogo" como objetivo explícito ([plano-game-feel.md](../../Ficha%20teste%20-%20Ordem%20II/docs/plano/plano-game-feel.md)).

- Feedback em cada ação: objeto colocado dá um "pop" leve, pincelada solta partículas do material, parede encaixa com um estalo visual.
- Fantasma de prévia com encaixe inteligente; arrastar com leve inércia.
- Barra de ferramentas 1–9, pincel redimensionado com Alt + rolagem, pipeta com Alt + clique (copia material ou receita), Alt + arrastar duplica.
- Paleta de comandos com busca, histórico de ações com rótulos legíveis, desfazer ilimitado na sessão, rascunho automático.
- Sons sintetizados discretos (Web Audio, como na Ficha), desligáveis.
- Toggle global de animações e respeito a `prefers-reduced-motion`; com efeitos desligados, nada muda além do visual.
- Tutoriais interativos que conferem o resultado, não o botão clicado, com valores reais e alvo marcado (padrão do Tabletop).

### 8.3. Imersão na sessão

- Luz dinâmica com sombras das paredes: lamparinas, velas e lâmpadas iluminam em círculo; lanternas e holofotes, em cone. Cor, intensidade, alcance e abertura ajustáveis; tremulação de chamas.
- Névoa com memória em esboço (§5.1) e revelação animada.
- Tokens que andam: deslizam com trilha no Ilustrado e caminham como sprite no Pixel.
- Telhados que somem quando um token entra.
- Portas que abrem, fecham, trancam ou se revelam (secretas), com animação e som, mudando a visão na hora. Interruptores acendem e apagam as luzes do cômodo.
- Som no lugar certo: o clima e o cômodo trocam a cena sonora do Jukebox; portas, interruptores e objetos tocam seus próprios efeitos.
- Clima e partículas: chuva, neve, poeira, brasas, neblina, folhas.
- Pincéis de presença com intensidade ao vivo (§5.3).
- Eventos de cena acionados pelo mestre: troca de clima, apagão, relâmpago, tremor, falha na imagem.
- Iniciativa, régua em quadrados de 1,5 m e janela de projetor separada da câmera de trabalho.

## 9. Referências

| Referência | O que levar |
| --- | --- |
| Inkarnate | Pintura fluida de terreno e mistura de texturas |
| Dungeondraft | Cômodo pintado gerando paredes; ferramentas de construção por grid |
| Dungeon Alchemist | Mobília e decoração pela função do cômodo |
| Foundry VTT, Owlbear Rodeo | Luz dinâmica, visão por paredes, névoa e sessão |
| Enigma do Medo | Personagens em pixel art em cenários com luz dinâmica; escuridão densa |
| Ficha Ordem II | Game feel, efeitos, qualidade de vida |
| Tabletop 3D | Comandos, propostas, tutoriais, projetor e contratos de integração |

As referências guiam o comportamento e a leitura; o Atlas não reproduz arte, interface nem marca de nenhum deles.

### 9.1. Os mapas das temporadas antes de *Sinais do Outro Lado*

Três imagens enviadas pelo usuário em 2 de novembro de 2026, feitas no Inkarnate, guardadas em [referencias/](referencias/) só para consulta interna (não vão para `public/` nem para o build).

| Imagem | Gramática que fica | O que superar |
| --- | --- | --- |
| [QG](referencias/ordem-qg.png) | Cômodos como ilhas no fundo; paredes sólidas com sombra; identidade forte de cor por cômodo; poças de luz local | Luz pintada e fixa; cores destoantes entre objetos; escala variável |
| [Mansão](referencias/segredo-na-ilha-mansao.png) | Paredes **caixa** com quadros e estantes nas faces internas; fundo texturizado; área externa (varanda e escadas) | Resolução baixa e borrada ao aproximar |
| [Andar da mansão](referencias/segredo-na-ilha-andar.png) | Acabamento unificando a cena; janelas nas paredes; cômodo destruído contando história | Tudo é imagem: não há luz dinâmica, visão nem névoa |

O Atlas fica com a gramática e supera a qualidade: nítido em qualquer zoom, escala pelo grid, cor harmonizada, luz dinâmica com sombra das paredes, névoa com memória e estética própria.

## 10. Fora do escopo inicial

- Mapas de região e mundo.
- Grid hexagonal.
- Andares múltiplos no mesmo mapa (o modelo prevê `levelId`, mas a interface vem depois).
- Clientes de jogadores em celular ou multiplayer em rede.
- Promoção automática para o Tabletop 3D.
