# Atlas — andamento

Atualizado em 2 de novembro de 2026.

## Fase 0 — Planejamento (2 de novembro) — concluída

- Decisões com o usuário: vista de cima com profundidade falsa; arte ilustrada sombria procedural com modo pixel opcional (clima do Enigma do Medo); mapas de cena primeiro; site estático offline.
- Documentos: [VISAO.md](docs/VISAO.md), [ARQUITETURA.md](docs/ARQUITETURA.md), [INTERFACE.md](docs/INTERFACE.md), [ROADMAP.md](docs/ROADMAP.md) e [AGENTS.md](AGENTS.md).
- Sem código.
- Revisão com as referências do usuário (mapas de Inkarnate das temporadas anteriores, em docs/referencias/): paredes caixa no lugar da inclinação 3/4; acabamento da cena, fundo e identidade por cômodo; objetos de coleção própria (procedural + acervo gerado ou achado com licença livre), importação só opcional.
- Segunda revisão: mapas de qualquer gênero (o horror é um clima, não o foco); identidade própria (névoa com memória em esboço, luz como protagonista com climas, pincéis de presença); engine de renderização com descrição única por asset e renderizadores Ilustrado e Pixel, incluindo sprites animados.
- Terceira revisão: interface com a identidade da Ficha Ordem II (fluida e integrada; INTERFACE.md); climas como "o mesmo mapa, vários momentos" (dia, tempestade, noite, apagão) com luzes que reagem sozinhas; roadmap detalhado em 9 fases com etapas.

## Fase 1 — Protótipo técnico (2 de novembro) — concluída

Protótipo em [spikes/estilos/](spikes/estilos/README.md), com PixiJS 8.22.0 e Vite 7.3.6.

- Concluído: etapas 1.1–1.8. Mapa semântico (sala + biblioteca em L), descrição de desenho única para todos os objetos, renderizadores Ilustrado e Pixel (12/16/24 px por célula), paredes caixa e sólidas, luz com sombras das paredes, luz pelas janelas, visão e névoa com memória em esboço, porta que abre, quatro climas com transição (dia, tempestade com chuva/relâmpago/trovão, noite, apagão com falha das luzes), lanterna, sprite paramétrico andando, painel no tema da Ficha (Ordem e Prata), toasts e transições.
- Validação: `npm run build` sem erros; `npm run medir` em 1920×1080 na RX 580: 60 fps (p5 = 60) nas 10 combinações, sem erros no console; capturas em `spikes/estilos/medicao/`.
- Respostas: as seis perguntas da fase deram sim; detalhes e lições no README do protótipo.
- Pendências: fonte pixel própria para a cartela; transição animada da memória; borda suave da névoa no Ilustrado; sprite opcional no Ilustrado; luzes vindas das receitas; assar em worker.

## Plataforma (2 de novembro) — planejada

- Decisão com o usuário: todos os projetos no mesmo GitHub Pages (`ilvro.github.io`) falam um contrato comum. Novo documento [PLATAFORMA.md](docs/PLATAFORMA.md): Refs, banco da campanha `mesa-campanha-v1`, barramento `mesa:eventos`, manifestos `mesa.json`, tema `mesa:tema`, biblioteca `mesa-core` e o hub "Mesa". O contrato Ateliê ↔ Tabletop v1 vira parte dele, sem mudança.
- Roadmap: contrato e campanha entram na Fase 2 (2.7, 2.8); notas por cômodo na Fase 3 (3.10); Fase 9 virou "Plataforma e tutoriais".
- Obsidian e Miro ficam como possibilidades em aberto, sem desenho.
- Detalhado depois: tipos de luz (círculo e cone) com cor ajustável (3.7), áudio do clima (4.7), portas com estados (7.3), interagíveis com efeito sonoro (7.6) e as duas camadas de áudio (ARQUITETURA §8.1).

## Stack (2 de novembro) — decidida

- TypeScript 7 (`strict`) e Preact 11 com signals; Pixi 8 fora do Preact; `mesa-core` em TS publicado como JS + `.d.ts`. Versões fixadas em ARQUITETURA §1. O protótipo continua em JavaScript (descartável).

## Fase 2 — Fundação (2 de novembro) — concluída

Projeto definitivo em TypeScript `strict` + Preact 11 com signals, PixiJS 8.22.0 (fora do Preact) e Vite 7.3.6. README com o mapa do código.

- **2.1 Projeto e casca:** `npm run typecheck | test | test:e2e | build | dev | dev:mesa`; fontes OFL locais (Hanken Grotesk, Cinzel, Special Elite, via fontsource); três temas (Ordem, Prata, Neutro) por variáveis CSS; faixas rasgadas, chips, pílulas e transições (glitch, tinta, fade) da Ficha.
- **2.2 Documento `atlas.map` v1:** tipos, esquema declarativo com validação estrita (campo desconhecido, tipo e limite com o caminho exato do erro), relações entre as partes conferidas, migrações encadeadas (testadas com tabelas de mentira), células em RLE, duplicar para nova sessão.
- **2.3 Store:** comandos puros e atômicos sobre rascunhos copy-on-write (compartilhamento estrutural), histórico de 150 com rótulos, gestos e transações (uma entrada de histórico por arrasto; Esc ou Ctrl+Z cancelam), `versaoEsperada`, `marcarSalvo` que aceita edições feitas durante a gravação, recuperar rascunho sobre o mapa do disco.
- **2.4 Dados:** repositório IndexedDB com escopo de caminho (revisão otimista e conflito), assets endereçados pelo conteúdo, rascunho automático (um cronômetro só, fila de gravações, descarregar ao sair), galeria com miniaturas, exportar e importar (mapa avulso ou cópia de segurança; cópia, substituir ou pular; um mapa ruim não derruba os outros).
- **2.5 Viewport:** pan, zoom no cursor, grade configurável (adaptativa), seleção por clique, Shift, retângulo e laço (Alt), arrastar com encaixe de meia célula (Alt desliga), setas, marcadores provisórios de luz (círculo e cone), objeto, peça e região.
- **2.6 Interface de jogo:** efeitos adaptados da Ficha (número flutuante, faíscas), sons sintetizados, toasts com Desfazer, paleta de comandos (Ctrl+K, busca sem acento), menu radial, mapa de atalhos (`?`), animações e sons desligáveis, `prefers-reduced-motion` respeitado.
- **2.7 `mesa-core` v1:** referências, barramento de eventos com pedidos e respostas, banco da campanha com regra de quem altera o quê, manifesto, tema compartilhado; publicado como JS + `.d.ts`.
- **2.8 Plataforma:** `mesa.json`, rotas profundas (`#/mapa/{id}`, `#/mapa/{id}/comodo/{c}`), mapa ligado à campanha (entidade "lugar" que acompanha o nome e sobrevive à remoção do mapa), pedido `atlas.focar` atendido, `mesa-dev` (todos os projetos numa origem).

### Validação

- `tsc --noEmit` limpo; `npm run build` e `build:core` sem erros; o build funciona em qualquer caminho.
- **115 testes unitários** (36 do `mesa-core`, 79 do Atlas) e **16 testes e2e** em Chromium com WebGL, todos passando. O e2e cobre os critérios de pronto: criar, gravar, reabrir, desfazer, exportar e importar; tema trocando em outra aba ao vivo; link profundo; rascunho recuperado; conflito entre duas abas; campanha; `atlas.focar` vindo de outro aplicativo; e dois aplicativos sob o `mesa-dev` compartilhando tema e campanha na mesma origem.
- Fluxo real `npm run dev:mesa` + `mesa-dev` verificado no navegador, sem erros no console (recarregamento ao vivo incluído).
- Os testes acharam, além de erros meus, **defeitos reais que foram corrigidos**: `acharRefs` engolindo o ponto final; `salvar` lançando de forma síncrona em vez de rejeitar; cronômetro do rascunho duplicado depois de gravar; tela em branco para mapa inexistente; menu radial fechando sozinho (evento `contextmenu` tardio); atalhos engolidos por caixas de seleção; "Luz aqui" caindo no centro em vez do ponto clicado; `Espaço` com cedilha no parser de atalhos.

### Pendências reais

- Os marcadores do viewport são provisórios (cômodos, paredes, objetos, luzes e peças reais chegam na Fase 3); as ferramentas L, O, T e R existem só para exercitar seleção, mover e inspetor.
- Estilo, clima e acabamento já estão no documento e nos comandos, mas ainda não têm interface nem efeito visível (Fases 3 e 4).
- O `mesa-dev` não foi testado com os outros projetos (só com o Atlas e uma página de mentira): eles precisam rodar com `base: '/Nome/'` ou entrar como `@raiz`.
- Os outros projetos (Ficha, Ateliê, Jukebox, Tabletop) ainda não usam o `mesa-core`; mudam só com autorização.
- Dois relatórios do protótipo continuam valendo: fonte pixel própria e transição da memória (Fases 3 a 8).

## Fase 3 — Construir (2 de novembro) — concluída

### Implementado

- **Documento v2** com migração 1→2 testada: terreno por camadas de material (RLE), `swing` nas aberturas, `preset` nas luzes, `tint` no acabamento.
- **Geometria pura e testada** (`domain/geometria.ts`): paredes derivadas do contorno dos cômodos, portas e objetos de parede que acompanham a parede ao redesenhar, encaixe com tolerância, parede manual e desanexar.
- **Comandos de construção** (`state/comandos-construir.ts`): cômodo criar/pintar/apagar/remover/notas, parede, abertura, terreno; pintar rouba células de outros cômodos e cômodos vazios somem; tudo desfaz, e cada arrasto é UMA entrada de histórico.
- **Procedural**: descrição de desenho, 22 receitas (mesas, cadeiras, camas, sofá, estantes, tapetes, balcão, vaso, livros, papéis, quadro, espelho…), materiais de piso/papel/objeto/terreno, assado em Web Worker com cache e textura enquanto chega.
- **Render**: cômodos com piso, papel e paredes caixa, terreno, luzes (círculo e cone, 10 predefinições), acabamento (vinheta, grão, tinta) com liga/desliga só para quem edita.
- **Ferramentas**: pintar cômodo (pincel; `Shift` faz retângulo), borracha, parede, porta/janela/arco/secreta, objeto, luz, peça, região, terreno; fantasma de prévia, `Q`/`E` giram, `Ctrl`+clique é pipeta, `Ctrl`+arrastar duplica, `Alt` desliga o encaixe.
- **Interface**: biblioteca buscável por ferramenta (com prévia de cada receita), cartão contextual colado ao item (some com ferramentas de construção na mão), inspetor completo para cômodo, parede, abertura, objeto (variar), luz (predefinição) e aba Mapa (terreno base, acabamento).

### Validação

- `tsc --noEmit` limpo; `npm run build` sem erros (aviso de chunk grande, esperado por causa do Pixi).
- **161 testes unitários** passando (repetidos várias vezes, sem oscilação) e **21 testes e2e** em Chromium com WebGL.
- O e2e cobre o critério de pronto: casa de três cômodos com portas, objeto e luz **só pela interface**, cartão contextual abrindo a porta, desfazer, gravar e recarregar; borracha refazendo paredes e desfazendo; busca na biblioteca, terreno e Esc cancelando o traço; notas do mestre do cômodo.
- Captura visual conferida nos temas Ordem e Prata (cômodos com piso e papel, portas, mobília, luzes).
- Defeitos reais achados e corrigidos no caminho: a paleta de comandos apagava o que já tinha sido digitado (efeito rodava depois de abrir); teste do `mesa-core` dependia de um atraso fixo; o cartão contextual cobria os cliques de quem estava pondo itens.

### Pendências da Fase 3: resolvidas no mesmo dia

- **3.1 Transições de terreno:** cada camada tem agora a borda torcida por ruído (orgânica, não um borrão) e um aro escuro do próprio material por baixo. Antes era só um desfoque.
- **3.8 Cartela de título e fundo:** aba Mapa com texto, fonte (Cinzel, Special Elite, Hanken Grotesk) e canto da cartela, que some com o texto vazio; fundo em cor ou **textura** (a textura aparece onde o terreno base é "Vazio"). O render passou a respeitar a fonte escolhida.
- **3.10 Ligações do cômodo:** lista de `refs` no inspetor do cômodo, colar `mesa:app/tipo/id` (recusa texto inválido e repetido), escolher algo da campanha ligada ao mapa, remover, e copiar a referência do próprio cômodo.
- Novo e2e cobre título, fonte, canto, fundo em textura (com desfazer) e ligações.
- Corrigido junto: o menu radial só ouvia o teclado depois do primeiro desenho (mesma classe de defeito da paleta); agora ouve na hora.

### Ainda em aberto

- Parâmetros de receita só aparecem na biblioteca antes de pôr; depois, o inspetor oferece apenas "Variar".
- O tempo "menos de dez minutos" foi conferido pelo fluxo automatizado, não cronometrado com uma pessoa.
- A textura "Terra" mostra a repetição do ladrilho em áreas grandes; vale um ladrilho maior ou sem emenda na Fase 6 (acervo).
- ~~Testes e2e oscilam sob carga~~ **Corrigido na Fase 4.1:** a oscilação que atribuí à carga da máquina era uma corrida real (ver abaixo).

## Fase 4 — Climas e atmosfera (concluída em 3 de novembro)

### 4.1 Luz por horário (2 de novembro) — concluída

- **4.1a Visibilidade pura** (`domain/visibilidade.ts`): `oclusores` (paredes que bloqueiam luz ou visão, recortando o vão de arcos, portas abertas e, só para a luz, janelas), `poligonoIluminado` (círculo ou cone, 96 direções de base) e `IndiceDeSegmentos` (baldes de 4 m; devolve exatamente o mesmo polígono que a lista inteira).
- **4.1b Mapa de luz** (`render/mapa-de-luz.ts`): cada luz vira um brilho recortado pelo que ela enxerga (as paredes fazem sombra), somado, desfocado e multiplicado sobre a cena, 8 px/m. Polígonos só são refeitos quando a luz ou a geometria mudam; a tremulação mexe só na opacidade. O brilho aditivo antigo saiu e o marcador da luz ficou. O botão passou a "Ver atmosfera no editor" e vale para luz e acabamento.
- **4.1c Céu por horário** (`domain/clima.ts`): `ceuNoHorario` (sol de 06:00 a 18:00, lua fora disso, ambiente interpolado entre âncoras), `ehNoite`, `lerHorario`.
- **4.1d Luz do céu pelas janelas**: `luzesDerivadas` põe um cone de 2,1 rad a 0,3 m para dentro de cada janela entre um cômodo e o lado de fora; nada é gravado no documento. Janela entre dois cômodos, fora de cômodo ou com `sun: null` não gera luz.

### 4.2 Climas (2 de novembro) — concluída

- **4.2a Documento v3** (migração 2→3 testada): `climate.weather` (chuva, neve, neblina, vento, poeira, brasas, folhas, relâmpagos) e `gridPower`; `customClimates` (climas do mestre) e `climateAudio` (cena do Jukebox por clima); a presença deixa a máscara de imagem pelas células em RLE. Um mapa da Fase 3 abre sem perder nada, e um v1 passa pelas duas migrações de uma vez.
- **4.2b Predefinições e comandos:** nove climas (manhã, tarde, entardecer, noite, tempestade, neblina, neve, apagão, neon) com céu, tempo e acabamento próprios; `dia` virou apelido de `tarde`. Comandos `clima.predefinir`, `clima.salvar` e `clima.esquecer`, cada um uma entrada de histórico (“Clima: Noite”); mexer no horário em `clima.aplicar` move sol e ambiente, a menos que o comando diga como ficam.
- **4.2c Seletor:** seção “Clima” na aba Mapa com chips (amostra de cor de cada clima, o ativo destacado, os salvos com “esquecer”), horário, chuva, neve, neblina, vento, relâmpagos e energia da rede, “Salvar este clima…”; na paleta, “Clima: <nome>” para cada um; atalhos `Alt+1` a `Alt+9`.

### 4.3 Reações ao clima (2 de novembro) — concluída

- **4.3a Luzes que reagem ao clima:** `nivelDaLuz` (apagada, rede caída e só-noturna de dia valem 0; tabela de 64 casos testada). Ao cortar a rede, as lâmpadas piscam por 1,1 s e então apagam; ao voltar, piscam de leve; velas, lanternas e luzes mágicas não mudam. Abrir ou importar um mapa não anima. O marcador da luz apagada pelo clima ganha um aro tracejado.
- **4.3b Relâmpago e trovão:** com `weather.lightning > 0`, clarões aleatórios (de 4 a 11 s, mais seguidos quanto mais forte) clareiam o ambiente e as luzes do céu pelas janelas, e o trovão (ruído sintetizado) vem 0,4 a 1,6 s depois, se o som estiver ligado. Com movimento reduzido o clarão tem metade da força e não treme. `lightning: 0` nunca dispara. Nova ação na paleta: “Clima: relâmpago agora”. Nada disso acontece com “Ver atmosfera no editor” desligado.
- **4.3c Janelas acesas à noite:** a janela de um cômodo com luz acesa brilha para fora (raio 4 m, na cor média das luzes de dentro), mesmo sem lua; de dia, com a luz apagada ou com a rede caída e sem velas, não.

### 4.4 Partículas e neblina (2 de novembro) — concluída

- **4.4a Sistema de partículas e chuva** (`render/particulas.ts`, números em `particulas-config.ts`): um `ParticleContainer` por tipo, quantidade proporcional à área × intensidade (teto de 4000), chuva de traços a 16–24 m/s inclinada pelo vento (`vento × 0,4`), `alpha = weather.rain`. Cai só fora: uma máscara invertida com as células de todos os cômodos. A camada fica acima do mapa de luz e abaixo dos marcadores.
- **4.4b Neve, poeira, brasas, folhas:** neve oscila e cai fora; folhas giram e derivam com o vento, fora; poeira vive só dentro dos cômodos (máscara normal) e some e aparece; brasas sobem das luzes de fogo (24 por luz; sem luz de fogo, soltas pelo mapa) com mistura aditiva. Cada controle do inspetor liga o seu tipo ao vivo.
- **4.4c Neblina** (`render/neblina.ts`): um véu do tamanho do mapa com filtro próprio (ruído de 3 oitavas com o domínio girado, para não sair quadriculado), que anda devagar e é empurrado pelo vento; cor vinda do ambiente (de noite é escura); opacidade máxima 0,55 × `fog`; dentro dos cômodos vale metade.
- Com movimento reduzido tudo anda a 35% da velocidade. “Ver atmosfera no editor” desligado esconde partículas e neblina junto com a luz. Novo `contagemDeParticulas()` no viewport, usado nos testes.

### 4.5 Mistura e transição (3 de novembro) — concluída

- **4.5a `misturar(a, b, t)`** (`domain/clima.ts`): números por lerp, cores por canal (o ambiente pela cor efetiva, que embute a intensidade), sol que aparece ou some muda só de intensidade com a cor do lado que tem sol, `gridPower` vira `rede` (0 a 1), `preset` e `time` do destino. 4 testes novos.
- **4.5b Transição animada** (`render/viewport.ts`): o documento muda na hora e o viewport guarda o clima **exibido**, que caminha até ele em 1,6 s com `t²(3−2t)`. Luz, partículas, neblina e acabamento leem o exibido (`cena.atualizarAtmosfera` a cada quadro; `cena.sincronizar` ganhou a "visão do clima"). Só anima troca de `climate.preset` e desfazer/refazer; ajuste fino do inspetor vale na hora, e abrir mapa, movimento reduzido ou atmosfera desligada são instantâneos. O marcador das luzes no editor segue o documento.
- Limites assumidos: o piscar do apagão continua sendo o da 4.3a (acionado pelo `gridPower` do destino; `rede` da mistura não é lido pelo render); `time` e "é noite" já valem o destino, então luzes só-noturnas ligam/desligam no início; o relâmpago sorteia de novo o intervalo enquanto a intensidade muda.
- e2e novo: Tarde → Noite escurece aos poucos (o meio fica entre os dois), desfazer volta animando, ajuste fino não espera. Os testes antigos de 4.x agora esperam a transição acabar antes de medir (`aplicarClimaPor`).

### 4.6 Presença (3 de novembro) — concluída

- **4.6a Pincel e comandos:** ferramenta `presenca` (atalho `P`, ícone de gota, biblioteca própria; `[` e `]` mudam o raio dela). `presenca.pintar { brush, celulas }` acha ou cria a entidade do pincel (`p_<pincel>`, intensidade 0,6, semente estável por pincel) e soma as células; `presenca.apagar { brush | null, celulas }` tira de um pincel ou de todos, e entidade sem células some. Mesmo gesto do terreno: uma pincelada, uma entrada de histórico; Esc cancela; Alt apaga. A prévia do pincel é um círculo na cor dele. Não fiz a prévia "provisória em contorno" da ficha: fui direto ao render da 4.6b.
- **4.6b Render** (`render/presenca.ts`): cada entidade é uma malha com shader próprio sobre a caixa das suas células (e não um filtro, porque o filtro do Pixi recorta ao que está na tela e o ruído nadaria ao mover a câmera). A máscara é 1 px por célula, ampliada em linear e desfocada por 4 amostras; um fbm decide até onde a mancha chegou (`intensity` 0 recolhe, 1 vai até a máscara inteira), com manchas de tom e pulsação. Naturais entram **antes** do mapa de luz (a luz as escurece); as que brilham ficam **acima** dele, com um halo. `gmOnly` aparece a 50% com hachura. Movimento reduzido anda a 35%.
- **4.6c Pacotes:** `PINCEIS_DE_PRESENCA` com os dez (naturais: musgo, mofo, poça; sobrenaturais: corrupção, sombra; Ordem: sangue, morte, conhecimento, energia, medo, com as cores da Ficha), agrupados por pacote na biblioteca. Como a presença não tem caixa e não se pega com o clique, o "inspetor da presença" ficou numa seção **Presença** da aba Mapa: intensidade (campo numérico, não arrasto), "Só o mestre vê" e Remover.
- Testes: 2 unitários novos (comandos de presença com desfazer; catálogo dos pincéis) e 2 e2e novos (pintar pela ferramenta, intensidade expande/recolhe, desfazer; dez pincéis, inspetor, quadros por segundo). Capturas em `test-results/fase4-presenca.png` e `fase4-presencas.png`.
- Fica para depois: dar um jeito de selecionar uma presença no mapa (hoje só pela aba Mapa); versão Pixel (Fase 8); arrastar a intensidade como gesto.

### 4.7a Áudio do clima (3 de novembro) — concluída

- Comando `clima.audio { id, ref | null }` (aceita predefinido, apelido `dia` ou clima salvo; `clima.esquecer` já limpa a entrada). Na seção Clima, "Som deste clima" lista as entidades da campanha ativa com ref do Jukebox, mais "Nenhum"; sem campanha, o campo explica por quê (provisório até a 9.4).
- `app/audio-do-clima.ts`: ao mudar `climate.preset` do mesmo mapa e havendo cena para ele, `barramento.pedir('jukebox.tocar', { ref })`; sem resposta ou recusado, nada aparece na tela. Abrir outro mapa não pede nada. Testado com dois barramentos (Atlas e um Jukebox falso) e por e2e escutando o canal `mesa:eventos`. **Não testei com o `mesa-dev` e o Jukebox de verdade.**

### 4.8 Validação da fase (3 de novembro) — concluída

- `__atlas.fps(ms)` (média e p5) exposto como no protótipo. e2e novo `fase 4: Tarde → Tempestade → Noite → Apagão`: casa com janela externa e lâmpada de rede, troca pelo seletor, espera a transição, confere que o documento não mudou fora de `climate`/`finish`, mede o brilho (as quatro cenas diferem e escurecem da tarde à noite) e captura `test-results/fase4-<clima>.png`. Sem erros de console.
- **FPS em 1920×1080 com tempestade, 5 s: média 60,0, p5 59,9** (300 quadros), no Chromium de teste com WebGL por software.

### Validação

- `tsc --noEmit` limpo, `npm run build` sem erros, **208 testes unitários** e **36 e2e** passando em rodadas completas seguidas, depois de todas as tarefas da fase (4.1 a 4.8).
- Novos e2e medem o brilho dos pixels: o cômodo vizinho fica escuro com a porta fechada, clareia com ela aberta e volta a escurecer ao desfazer; desligar a atmosfera clareia o mapa sem mexer no documento; a janela clareia o piso de dia, menos à noite e nada sem sol.
- Capturas conferidas: sombra pela porta, facho pela porta aberta, janelas de dia e de noite.
- **60 FPS** medidos com 10 luzes tremulando (igual ao mapa sem luzes), no Chromium de teste com WebGL por software: indica que o custo é pequeno, mas não substitui medir no notebook do mestre.

### Defeito real achado e corrigido no caminho

- **Corrida ao abrir um mapa pela galeria:** clicar num mapa logo ao chegar na galeria (dentro dos ~170 ms da transição que fecha o editor) fazia `abrirMapa` ver a sessão antiga, desistir, e a transição então a fechava: a URL mudava e a tela ficava na galeria. Era o que fazia o e2e de `atlas.focar` oscilar (antes eu tinha atribuído isso à carga da máquina, e estava errado). A sincronização de rota agora é uma de cada vez e a rota mais recente vence; há teste de regressão.
- O viewport agora avisa com um toast quando não consegue abrir (antes a falha era silenciosa).

### Pendências

- **Um teste de regressão meu oscilava** (o da corrida da galeria, da 4.1): `esperarEditor` aceitava o viewport da sessão antiga que ainda estava fechando. Era defeito do teste, não do app; agora espera o estado final estável (8 de 8 seguidas).
- O teste de chuva mede o brilho médio do terreno: a diferença é pequena (cerca de +1 em 255), então a margem é estreita; ele passou em todas as rodadas, mas é o primeiro a olhar se um dia oscilar. A contagem de partículas é o que garante a quantidade.
- **60 FPS** medidos com todos os tipos em 1 no mapa de 45 × 30 m, no Chromium de teste com WebGL por software; falta medir no notebook do mestre.
- As partículas de cada tipo são fixas (tamanhos e cores definidos no código); não há ainda botão para estilo (por exemplo, neve maior).
- O som do clima é do Jukebox: o pedido `jukebox.tocar` sai (4.7a), mas não foi conferido com o Jukebox de verdade; a escolha definitiva da cena é da Fase 9.4.
- Uma presença não se seleciona no mapa (só pela aba Mapa); a intensidade é campo numérico, não arrasto; a versão Pixel dela é da Fase 8.
- O estilo Pixel (Fase 8) ainda não tem versão em pixels das partículas e da neblina.

## Fase 5 — Construção inteligente (3 de novembro) — concluída

"O assistente lê o que o mestre fez e sugere o próximo passo." Critério: pintar três cômodos, nomear as funções e aceitar as sugestões gera uma casa jogável que o mestre ajusta, não refaz. Código em `src/authoring/` (puro: nunca importa render, UI, app nem Pixi).

### Implementado

- **5.0 Documento v4:** `style.genre` (`investigacao` padrão, `moderno`, `fantasia`; id desconhecido vale como `investigacao`), migração 3→4, campo "Gênero" na aba Mapa.
- **5.1 Ler o cômodo:** `insightDoComodo` (área, perímetro, portas e janelas com normal para dentro, vizinhos com metros em comum e se estão ligados, objetos com caixa girada, luzes); `normalParaDentro` saiu de `luzesDerivadas` para `geometria.ts` (4.1d sem mudar). Malha de 0,25 m (`malha.ts`): dentro, ocupada, vão das portas e circulação (busca em largura entre as portas; faixa de 0,75 m). `funcaoProvavel`: nome (tabela de sinônimos, "sala de ritual" não vira sala), objetos (votos, sinais fortes valem 3) e tamanho; 26 casos por tabela.
- **5.2 Propostas:** `Proposta` e o comando `proposta.aceitar` (uma entrada de histórico, recusada se a versão de edição mudou, vazia ou aninhada é erro); fantasma no render (`fantasma-proposta.ts`: objetos com o desenho de verdade a 55%, traço na parede, luz, abertura, cômodo com piso trocado; pulsa); pílula de sugestão junto do cômodo (aceitar, ↻ outra, ✕ agora não), uma por vez, recalculada 300 ms depois de cada edição, "dispensar" vale até fechar o mapa, ligada e desligada pela aba Mapa e pela paleta.
- **5.3 Mobiliar:** regras por função e gênero (`regras-mobilia.ts`, só receitas que existem; fantasia troca cadeira e sofá por banco, moderno tira a estante do quarto); gerador de layout determinístico por semente (`layout.ts`): encosta o fundo do móvel na parede (`rotação = atan2(-n.x, n.y)`), cantos, centro, "junto" (ao redor, ao lado, em frente) e objetos de parede, sem tampar porta nem a faixa de passagem, contando o que já existe; piso e papel por gênero (só se ainda são o par de um tipo de cômodo) e três paletas por gênero (tecidos, madeira e tapete que combinam).
- **5.4 Espalhar:** conjuntos `papelada` (sobre as mesas), `caixotes` (de costas para a parede) e `plantas`, por amostragem com distância mínima, densidade caindo para a borda e contando o que já existe (pincelar duas vezes não dobra); ferramenta `S` com raio em `[` `]`, Alt apaga, uma pincelada é uma entrada.
- **5.5 Portas e luzes:** porta entre vizinhos para o cômodo sem nenhuma ligação (corredor, depois sala, depois quem tem mais parede em comum; a cozinha prefere a sala; abre para o cômodo maior) e a porta de entrada da casa; luzes pela função e pelo gênero, sobre as mesas quando há (`ownerId`), moderno de rede (some no apagão) e fantasia de fogo.
- Fila de sugestões por cômodo: função → porta → mobiliar → luz; só a primeira que se aplica aparece.

### Validação

- `tsc --noEmit` limpo, `npm run build` sem erros, **324 testes unitários** e **42 e2e** passando (duas rodadas completas seguidas).
- **Casa jogável (unitário, nos 3 gêneros):** três cômodos de 6 × 4,5 m com os nomes "Sala", "Cozinha" e "Quarto"; aceitar `proximaSugestao` em laço dá 12 sugestões, ~22 objetos, 5 luzes e 3 portas; funções certas, todos os cômodos alcançáveis pelas portas, uma porta para fora, circulação ligada em cada cômodo, nenhum móvel que bloqueia sobrepõe outro nem sai do cômodo, luz em todos, mapa válido; uma entrada de histórico por sugestão; desfazer e refazer a última.
- **e2e `fase 5: três cômodos viram uma casa`:** pintar os três pela interface, renomear no inspetor, aceitar as pílulas pelo clique até não haver mais (11 pílulas, 21 objetos, 5 luzes, 3 portas), conferido pelo mesmo verificador; uma entrada por pílula; desfazer e refazer; Noite. Capturas em `test-results/fase5-casa.png`, `fase5-casa-noite.png` e `fase5-quarto.png`.
- Conferi à mão a captura da casa: a mobília encosta nas paredes, nada atravessa porta, o tapete fica no centro e cada cômodo tem cara do que é.

### Defeitos reais achados no caminho

- **Mobiliar antes de pôr a porta tampava a porta:** a cozinha era mobiliada antes de o quarto ganhar a sua porta, e os móveis ocupavam toda a parede comum. O gerador agora reserva o vão onde a porta que falta ainda vai entrar (para o cômodo e para os vizinhos sem ligação), mesmo sem a porta existir.
- O sorteio de quantos móveis de cada item entram era refeito depois de aceitar (o consumo do sorteio mudava), e a sugestão voltava; agora cada item tem o seu sorteio, e a sugestão de mobiliar não reaparece depois de aceita.
- Gerar de novo dá ids novos, então a pílula piscava a cada edição; agora ela só troca quando muda o tipo, o cômodo, a semente ou a versão do mapa.
- A pílula (HTML) cobre cliques no mapa e o fantasma muda o brilho medido, o que quebrou três e2e das Fases 3 e 4. As sugestões são uma preferência local, então os e2e das fases anteriores a desligam (`novoContexto`, `comSugestoes = false`) e só os da Fase 5 a ligam; há um e2e da preferência (desligada: nada aparece; ligar na aba Mapa traz a pílula e vale ao recarregar).
- Os blocos 4.5 a 4.8 deste arquivo estavam na seção da Fase 2; foram para a da Fase 4.

### Pendências

- A paleta (`Comodo.palette`) ainda não é usada pelo render: as cores dos tecidos vão nos parâmetros de cada objeto.
- Só 22 receitas: a mobília varia pouco entre gêneros até o acervo da Fase 6 (fantasia só troca cadeira e sofá por banco).
- "Sob árvore" no espalhar fica para quando houver árvores (Fase 6).
- A pílula flutua sobre o mapa e pode cobrir cliques perto do cômodo; dá para dispensá-la ou desligar as sugestões, mas ela poderia sair da frente do ponteiro.
- A pílula só acompanha um cômodo por vez (o selecionado ou o último pintado); não há uma lista de sugestões pendentes.
- Móvel de parede (quadro, estante) não considera os móveis de piso na frente; uma estante pode ficar atrás de um armário.
- O desempenho do gerador foi medido só pelos testes (a casa de três cômodos gera em milissegundos); não medi um mapa grande com dezenas de cômodos.

## Fase 6 — Acervo da casa (3 de novembro) — concluída, menos a 6.2b (esperando decisão)

"O app é completo só com a coleção da casa." Critério: recriar um dos mapas de referência só com a coleção da casa, no mesmo nível de detalhe e com cor coerente. **Atendido em parte** (ver o relatório abaixo): a ala da mansão sai mobiliada e coerente, mas abaixo da referência em detalhe de parede e variedade.

### Implementado

- **6.0 Acervo unificado:** `receitas.ts` virou a pasta `receitas/` (comum, casa e um arquivo por kit, com `generos` e `kit` em cada receita; categorias novas `banheiro`, `lareira-e-luz`, `exterior`). `procedural/acervo.ts` (`ACERVO`: `item`, `lista`, `pegadaDaFonte`, `idDaFonte`, `fonte`) é o único lugar que autoria, render e interface consultam: receita leve ou item da coleção (`casa:<nome>`).
- **6.1 Coleção da casa:** `public/colecao/colecao.json` (validado ao importar; recusa item sem licença, id sem `casa:`, pegada zero…), `docs/LICENCAS.md` (a tabela dos gerados é reescrita pelo script) e o teste de coleção (todo arquivo no catálogo e no LICENCAS, ≤ 400 KB cada, ≤ 15 MB). `npm run assar` sobe o Vite e o Chromium e assa os **geradores pesados** (`procedural/pesados/`, descrição de desenho, fora do bundle) em WebP: estofados capitonê (chesterfield, poltrona e divã em 3 cores), plantas (palmeira, samambaia, costela-de-adão), árvores, pinheiros e arbustos, tapetes persas com medalhão (3 × 2 e 4 × 2,8 m), oval e passadeira em 3 paletas. Rodar de novo não muda nenhum arquivo (idempotente, conferido por hash). No mapa, um item `casa:` é pintado pelo mesmo worker (pedido `imagem`), entra na biblioteca (marca "acervo", miniatura pela imagem), no pincel, na pipeta, nos fantasmas e no mobiliar (o chesterfield e os tapetes entram nas regras da investigação; o tapete cuja paleta combina com a do cômodo pesa 4 vezes mais).
- **6.3 Harmonização** (`procedural/harmonizar.ts`, funções puras testadas sem navegador): recorte do vazio, encaixe na pegada, contorno de nanquim (1,5 px a 128 px/m) e sombra de contato; cor puxada para o alvo do gênero (`alvoDeCor` em `GENEROS`) mantendo o matiz; chave de cache inclui `harmonize` e o gênero (trocar o gênero repinta); caixa "Harmonizar com o mapa" e origem do item no inspetor. **Só imagens achadas passam por ela** (as geradas já nascem no traço da casa, com contorno e sombra): desvio da ficha, porque harmonizar de novo recortaria a própria sombra.
- **6.4 Kits por gênero:** investigação (12 receitas: lareira de mármore, piano de cauda, bilhar, mesa oval, relógio de pé, cristaleira, banheira com pés, vaso e pia de época, cabideiro, globo, escrivaninha de tampo verde; funções novas `sala-de-jantar` e `sala-de-jogos`), moderno (11: sofá de canto, rack com TV, geladeira, fogão, mesa de vidro, cama box, guarda-roupa liso, box, vaso moderno, escrivaninha com computador, luminária; materiais cinza, mostarda e sálvia; 3 paletas novas), fantasia (12: barris, mesa e banco de taverna, lareira com caldeirão, catre, baú, prateleira de poções, bigorna, altar, banco de igreja, tapeçaria de parede; funções `capela` e `forja`) e exterior (11: pedras, toco, tronco caído, cerca com largura, poço, banco de jardim, canteiro, poste, lápide). `VARIACOES_DE_GENERO` troca os itens por gênero; um item que só serve a outros gêneros sai das alternativas e leva embora quem dependia dele. O **espalhar** ganhou o contexto `sob-arvore` (dentro da copa) e os conjuntos `mata`, `jardim` e `cemiterio` (lápides em fileiras); espaçamento por par de itens; a frente de porta externa (1,5 m) fica livre.

### Acervo próprio ampliado (depois do relatório, a pedido: a importação de achados fica pendente e o acervo cresce com assets próprios)

O relatório abaixo apontou quatro lacunas; todas foram atacadas com assets gerados pelo Atlas:
- **Detalhe de parede:** 16 objetos de parede novos (retrato oval, paisagem grande, grupo de quadros, espelho grande, relógio, arandela, mapa-múndi, troféu de cervo, prateleira, painel de azulejos, espadas cruzadas, brasão, quadro abstrato, prateleira flutuante, TV na parede, cortina). As regras de cada cômodo ganharam quadros de seis tipos, arandelas, relógios, mapas, prateleiras, cortinas e, na fantasia, troféus, tapeçarias, espadas e brasões. Uma sala de investigação sai com ao menos 4 objetos de parede de 4 tipos, um corredor com 3 e uma biblioteca com 4.
- **Variedade de piso e papel:** 6 pisos novos (parquet em espinha de peixe, mármore branco, mármore preto e branco em diagonal, hexágonos verde-sálvia e de terracota, tábuas cinza) e 7 papéis (florais azul e rosa, damasco verde-esmeralda, listras bordô e azul-marinho, boiserie escura e verde-musgo), com seis padrões novos no renderizador. O mobiliar escolhe piso e papel por cômodo (pela identidade dele e a semente), então uma casa de vários cômodos já não sai com o mesmo piso em todos: na ala da mansão são **7 pisos e 7 papéis** diferentes nos 9 cômodos.
- **Bagunça:** 15 enfeites de mesa (bule com xícaras, castiçal, candelabro, vaso de flores, livro aberto, garrafa e taças, abajur, tabuleiro de xadrez, fruteira, serviço de pratos, relógio de mesa, tinteiro, telefone antigo, notebook) e 3 de chão (cesto de roupa, sapatos, jornais). O gerador de layout ganhou o lugar **`sobre`**: o enfeite entra em cima do móvel âncora (mesa de jantar, mesinha, aparador, escrivaninha, balcão do altar), com `elevation: 'table'`, sem sobrepor outro enfeite. Três conjuntos novos no espalhar: `bibelos`, `refeicao` (mesa posta) e `bagunca`.
- **Entorno:** função `varanda` (nome, sinônimos "terraço", "sacada", "alpendre", regras, luz, materiais) e 6 itens exteriores novos (balaustrada com largura, escada externa, fonte, estátua, urna em pedestal, pilar). O assistente mobilia a varanda com escada, urnas nos cantos e balaustrada nas bordas.

### Números

- **144 itens no acervo:** 109 receitas leves (51 básicas, incluindo 16 de parede e 18 enfeites; 12 investigação, 15 moderno, 14 fantasia, 17 exterior) e **35 imagens da coleção** (6 básicas, 21 de investigação, 8 de exterior), todas geradas; 0 achadas. `public/colecao/` tem **700 KB** (limite 15 MB; o maior arquivo, 38 KB). O build leva `colecao/` para o `dist/` e não leva `data-private/`.
- **Testes:** `tsc` limpo, build sem erros, **389 testes unitários** e **47 e2e** passando (duas rodadas completas seguidas).
- **Ala da mansão (e2e):** 9 cômodos criados por comando, 35 sugestões aceitas pelo assistente, **183 objetos** (48 de parede, 16 enfeites sobre mesas), 24 luzes e 8 portas, mais itens da coleção postos à mão e um entorno com fonte, calçada, jardim, mata e cemitério pelo espalhar; **primeira pintura completa em 4,9 s** (inclui montar o mapa e o entorno), no Chromium de teste. Capturas: `test-results/fase6-mansao.png` e `fase6-mansao-noite.png`.

### Relatório: a ala da mansão contra a referência

No mesmo nível: planta com salão, sala com piano e lareira, jantar com mesa oval, sala de jogos com bilhar, biblioteca, banheiro de época, quarto, corredor com passadeira e varanda; tapetes persas com medalhão, borda e franja; capitonê legível; plantas e arbustos com volume; luzes acesas à noite iluminando só os cômodos.
Abaixo da referência, e por quê (depois de ampliar o acervo próprio):
- **Detalhe de parede:** agora há quadros de vários tipos, arandelas, relógios e mapas, mas a referência cobre as paredes de cima a baixo (estantes até o teto, cortinas pesadas, molduras largas); aqui a densidade ainda é menor e o desenho de parede é pequeno visto de cima.
- **Variedade de piso e papel:** de 7 pisos e 7 papéis na ala, a referência ainda tem mais variação *dentro* do mesmo cômodo (faixas, bordas e tapetes de corredor em lã).
- **Densidade da bagunça:** os enfeites de mesa e de chão existem; a referência tem mais objetos pequenos e menos alinhados.
- **Cor:** coerente, mas a referência mistura mais tons por cômodo.
- **Entorno:** terraço com escada e balaustrada, fonte, calçada, jardim e mata existem; a referência tem escadaria monumental e balaústres esculpidos com mais detalhe.
Nada disso é erro de lógica: é densidade e acabamento do acervo, que cresce com mais itens próprios (e, se quiser, com os achados da 6.2b).

### Defeito real achado e corrigido no caminho

- **Fantasma derrubava a textura de um objeto do mapa** (erro raro de console `Cannot read properties of null (reading 'alphaMode')`, visto uma vez no e2e da casa da Fase 5): o fantasma da proposta e o do pincel criavam a textura com `Texture.from(bitmap)`, que reaproveita a fonte da GPU de quem já usa o mesmo bitmap (o baker devolve o mesmo bitmap para o mesmo desenho, que a cena também usa), e depois destruíam essa fonte compartilhada. Agora cada fantasma cria a sua (`render/textura-propria.ts`). Há um e2e que o reproduz de forma determinística (o sofá do mapa com uma prévia do mesmo desenho que some e volta); sem a correção ele falha, com ela passa.
- O e2e de transição de clima media o brilho num único instante (100 ms depois da troca), e a captura de tela leva um tempo imprevisível sob carga; passou a amostrar durante a transição e exigir ao menos uma amostra entre os dois extremos. O e2e do `atlas.focar` (da Fase 4) ainda oscilou uma vez em carga alta e passa 3 de 3 isolado.

### Pendências reais

- **6.2a/6.2b (curadoria):** a lista está em `docs/curadoria.md`; **nenhum achado foi baixado**. Os candidatos com licença clara são quase todos pixel art de 16 a 48 px por tile, que destoam do traço ilustrado; o único razoável é o Kenney Furniture Kit (CC0) para o kit moderno, mas precisa abrir o pacote para conferir ângulo e resolução. Falta a sua decisão sobre o que importar. O script `importar-achado.ts` da 6.2b **não foi escrito**, e a harmonização de cor e forma de achados só foi testada com imagem sintética (não há achado real).
- A harmonização só vale para achados; se um dia um gerado precisar ser retocado, falta um jeito de pedir isso.
- Árvores e plantas não bloqueiam luz nem visão (a copa não é oclusor).
- O item da coleção não tem parâmetros de cor (é imagem): o tapete e o estofado variam só pela variante escolhida no sorteio.
- Os objetos de parede são receitas (a face do cômodo é assada delas); a coleção de imagens ainda não tem nenhum.
- Os enfeites de mesa são postos em posição sorteada sobre o móvel: não há ainda arrumação (alinhados, em bandeja) nem se sabe a altura do móvel.
- O estilo Pixel (Fase 8) ainda não rasteriza as descrições dos geradores pesados.

## Fase 7 — Sessão (concluída)

- **7.0b Documento v5** — `Peca.player`, `Objeto.interaction`, `Sessao.explored` (células + resolução); migração `de4para5`, validação (luz inexistente em `targets`, `res` 0,25–2) e `assetsDoMapa` sem o explorado. Commit: `document v5 for session`.
- **7.0a Modos Construir e Sessão** — `app/modo.ts`, chave no cabeçalho, atalho `M`, faixa "SESSÃO"; na sessão somem biblioteca, pílula, fantasma e ferramentas de construir, e a paleta só oferece o que vale. Abrir outro mapa volta a Construir. Commit: `build and session modes`.
- **7.1a Peça com retrato, tamanho e estado** — `domain/figuras.ts` (`aparenciaDoEstado`), `render/pecas.ts`, `render/retratos.ts` (blob do IndexedDB → textura própria, em cache, solta ao fechar o mapa); inspetor com retrato (reduzido a 256 px), jogador, tamanho, visão e estado. Commit: `tokens with portrait, size and state`.
- **7.1b Movimento com trilha** — `domain/movimento.ts` (`centroDaCelula`, `bloqueioNoCaminho`, `ladoDoMovimento`); `oclusores(m, 'movimento')` reaproveita os vãos de arco e porta aberta; comando `peca.mover` (uma entrada "Mover peça", `livre` com Alt); na sessão o arrasto mostra o caminho verde/vermelho e as setas andam uma célula; a peça desliza (160 ms por célula, no máximo 600 ms) e deixa uma trilha pontilhada de 2 s (só com animações ligadas). Commit: `token movement with trail`.
- **7.1c Lanterna da peça** — campo "Lanterna" (nenhuma, lanterna, lamparina, vela) cria/troca/remove a luz numa transação; `peca.mover` leva a luz e aponta o cone para o movimento; `peca.virar` com `Q`/`E` (45°) na sessão. Commit: `token lantern follows movement`.
- **7.2a Visão das peças de jogador** — `domain/nevoa.ts` (`poligonosDeVisao`, `celulasVisiveis`, `RES_NEVOA = 0,5 m` por célula, com cache por documento) usa `oclusores(m, 'visao')`: porta aberta e arco deixam ver, porta fechada, trancada e janela não. `render/nevoa.ts`: máscara do visível com borda suave; fora dele fica o fundo do mapa. Botão "Ver como jogador" no cabeçalho da Sessão (e tecla `J`); em Construir o mestre vê sempre tudo. Commit: `player vision`.
- **7.2b Explorado e memória em esboço** — `peca.mover` de peça de jogador soma ao `session.explored` o que ela via antes e o que vê depois (nunca encolhe; desfazer devolve); comandos `sessao.esquecer`, `sessao.revelar`, `sessao.ocultar` (cômodos revelados contam como explorados sem gravar células); "Recomeçar a exploração" na aba Mapa, com confirmação. `render/memoria.ts` assa o mapa em esboço (papel, contorno dos cômodos e paredes a traço de largura variável, portas como vão, objetos fixos só no contorno); `memory.sketch: false` mostra a cena escurecida a 35%. Commit: `explored memory as sketch`.
- **7.2c Revelação animada e telhados** — o visível exibido sobe em ~0,5 s e desce em ~1,2 s (duas médias móveis combinadas; movimento reduzido troca na hora). `render/telhados.ts`: cômodo com `roof.material` fica coberto na vista de jogador até uma peça de jogador entrar (fade de 0,4 s); mestre vê a 25%; em Construir não aparece. Inspetor do cômodo ganhou "Telhado" (telha de barro, ardósia, palha: materiais novos de uso `telhado`). Commit: `animated reveal and roofs`.
- **7.3a Portas na sessão** — clicar numa porta a abre/fecha (Shift+clique só seleciona); trancada avisa "Trancada"; cartão da porta na sessão (abrir/fechar, trancar/destrancar, "Revelar aos jogadores" nas secretas); `Enter` com uma peça selecionada interage com a porta ao alcance (1,2 m do vão, a da frente primeiro). Comandos `sessao.explorar` e `sessao.revelar` para aberturas; secreta não revelada é parede na vista de jogador e para a visão; revelar emite `atlas.revelado`. Commit: `doors in session`.
- **7.3b Régua em quadrados** — `domain/regua.ts` (`distanciaEmQuadrados`, regra simples/alternada, `pontosDaRegua`); ferramenta `regua` (tecla `R` só na Sessão, nas duas vistas): arrastar mede, clique faz dobra, Esc limpa, "6 quadrados · 9 m"; preferência "Diagonal" na aba Mapa. Não mexe no documento. Commit: `ruler in squares`.
- **7.3c Iniciativa** — `domain/iniciativa.ts` (`ordenar`, `iniciar`, `passo`, `definirValor`, `podar`, portado do Tabletop) e comandos `iniciativa.iniciar/passo/valor/encerrar`. Sem interface (7.4c). Commit: `initiative`.
- **7.4a Dock: clima ao vivo** — `ui/Dock.tsx` (só na Sessão, pílulas no pé do mapa, seções que recolhem): climas predefinidos e salvos, "Relâmpago" e duração da transição (1, 3, 8, 20 s; preferência local). `viewport.definirDuracaoDaTransicao`. Commit: `session dock with live climate`.
- **7.4b Dock: eventos de cena e presença** — tremor, luzes piscam, escurecer e clarão (`render/eventos-de-cena.ts`, nada vai ao documento; movimento reduzido troca o tremor por clarão); controle de intensidade por presença, o arrasto é uma entrada de histórico e a presença reage ao vivo. Commit: `scene events and live presence`.
- **7.4c Dock: iniciativa** — montar com as peças selecionadas (ou todas) e valores, `FaixaDeIniciativa` com retratos, rodada, ‹ ›, editar valor e encerrar; anel pulsante na peça da vez. Commit: `initiative in the dock`.
- **7.5a Projeção filtrada** — `domain/projecao.ts` (`projetarParaJogadores`, `CAMPOS_DO_MESTRE`): sem notas, notas de cômodo, regiões e presenças do mestre, secretas não rereveladas, peças escondidas (com a luz e a vez), pistas não reveladas; o resultado valida. Commit: `filtered player projection`.
- **7.5b Janela de projetor** — rota `#/projetor/{mapaId}` (`ui/Projetor.tsx`, `app/projetor.ts`), canal `atlas:projetor:<mapaId>`: estado projetado (debounce de 100 ms), câmera, eventos de cena, relâmpago e retratos. Viewport somente leitura, vista de jogador, moldura com o título, faixa de iniciativa, tela cheia que some em 3 s, sem áudio. Dock: "Projetor" (abrir, seguir os jogadores, mostrar o quadro); o quadro azul no mapa do mestre se arrasta e redimensiona. Commit: `projector window`.
- **7.6a Interagíveis** — `domain/interagiveis.ts` (`alvosDoInterruptor`: as luzes escolhidas ou as de rede do cômodo, nunca as de fogo) e comando `interagir`; receita de parede `interruptor`; "Interação" no inspetor (nenhuma, interruptor, gaveta, com a lista de luzes); na sessão, clicar, o cartão ("Apagar as luzes", "Abrir a gaveta") ou `Enter` com a peça ao lado; marcador só para o mestre. No apagão a luz de rede continua apagada (o clima manda). Commit: `switches and drawers`.
- **7.6b Sons** — `porta-abrir` (rangido), `porta-fechar` (batida), `trancada` (dois cliques), `interruptor` e `gaveta` (atrito), sintetizados, com variação de ±5% na altura; respeitam o liga e desliga. O `som` (Ref) dos objetos fica para a 9.4d. Commit: `interaction sound effects`.
- **7.7 Validação** — e2e `fase 7: jogar a casa no projetor` (três cômodos, porta, porta secreta com nota do mestre, região `gmOnly`, ogro escondido, interruptor, duas peças): em cada passo o documento do projetor não tem notas, região, a secreta nem o ogro antes da hora, e o cômodo nunca visto tem o brilho do fundo; clima Tarde → Tempestade → Noite pelo dock; revelar a secreta e um cômodo; interruptor; iniciativa de duas rodadas. Capturas `test-results/fase7-projetor-{inicio,porta,tempestade,fim}.png`. Commit: `validate phase 7`.
- **Validação:** `tsc` limpo; testes unitários `figuras`, `movimento` (10), `nevoa` (7) e `dominio`; e2e `fase7` (modos ×2, retrato/estado, movimento com parede, porta fechada, porta aberta e Alt, lanterna, visão, memória, telhado, revelação; capturas em `test-results/fase7-*.png`).
- **Desvios:** a névoa fica **sob** as partículas só em parte (a chuva e a neblina ficam sob a névoa, para não vazar o que não se vê); o telhado é desenhado **sobre** a névoa e só aparece se algum pedaço do cômodo, ou o lado de fora das paredes, está à vista ou explorado (senão um telhado revelaria casas nunca vistas); a borda "tinta escorrendo" da subida não foi feita; na sessão só as peças se movem e ajustam (o resto só se seleciona); `FERRAMENTAS_DA_SESSAO` ainda sem a régua (feita na 7.3b).
- **Pendente da fase (pendências reais):** o `som` (Ref do Jukebox) das aberturas e dos interagíveis não toca (9.4d); pistas (`clue`) não se usam (9.3); a revelação "tinta escorrendo" na borda do visível não foi feita; o telhado só aparece se algo do cômodo ou do lado de fora está à vista ou explorado; sem régua do mestre no projetor (decisão da ficha); só um projetor por mapa; o dock inclui o inimigo na iniciativa quando nada está selecionado (selecione as peças antes de começar para escolher).
- **Medido (Chromium headless, 60 quadros por segundo de teto):** vista de jogador com 2 peças e 10 luzes 60,5; editor com o projetor aberto 60,5; tempestade com as peças andando, mestre 60,3 e projetor 60,3.
- **Validação da fase:** `tsc` limpo, 439 unitários e 67 e2e passando.

## Fase 8 — Renderizador Pixel (em andamento)

- **8.1a Estilo de raster** — `procedural/estilos/` (`EstiloDeRaster`, `estiloDe`, `ILUSTRADO`): `assarObjeto/Comodo/Terreno/Descricao` pintam por ele; `PedidoDeBake` leva `estilo`; as chaves de cache começam pelo estilo; as resoluções vêm de `resolucaoDe`. Nada visível mudou (o Pixel ainda devolve o Ilustrado). Commit: `raster style interface`.
- **8.1b Cena pixelizada** — `domain/paletas.ts` (3 paletas de 32 cores), `render/pixelizar.ts` (render target `colunas × ppc`, filtro de paleta com Bayer 4×4, `nearest`); o viewport troca a raiz da cena pelo sprite pixelizado, põe o acabamento por cima e prende zoom (múltiplo do passo) e posição à grade de pixels; aba Mapa ganhou "Estilo" (renderizador, pixels por célula, paleta, dithering, contorno), tudo "Estilo do mapa" no histórico. e2e `fase8`: amostra com ≤ 32 cores todas da paleta, outra paleta, câmera na grade, desfazer volta ao Ilustrado. Commit: `pixelated scene with palette`.
- **8.1c Materiais do Pixel** — `procedural/estilos/pixel.ts` e `materiais-pixel.ts`: os 26 padrões em blocos de cor sólida de 1 a 3 px (2 a 3 tons por material, sem gradiente nem alfa), cômodo e terreno alinhados à grade de pixels, sombra de contato dura, borda do terreno em degraus com aro de 1 px; texturas do Pixel em `nearest`. e2e: piso de tábuas com ≤ 6 cores e opaco; captura `test-results/fase8-materiais.png`. Commit: `pixel materials`.
- **8.1d Objetos e coleção no Pixel** — `estilos/partes-pixel.ts`: cada parte vira pixels inteiros (material do Pixel, alfa binário, borda clara em cima/esquerda e escura embaixo/direita em 3 degraus de altura, vidro com brilho de 1 px, sombra de contato dura de 1–2 px), corta o `detalhe` que não cabe (3 abaixo de 24 px por célula, 2 abaixo de 12) e fecha com contorno de tinta de 1 px quando `style.pixel.outline`. Itens `gerado` da coleção são assados da descrição do gerador (pedido `gerado`, import dinâmico no worker). e2e: alfa só 0/115/255, contorno, ≤ 24 cores no sofá, casa de 9 objetos (7 receitas e 2 itens da coleção) sem nenhum marcador; captura `test-results/fase8-objetos.png`. Commit: `pixel objects`.

## Próximo

A Fase 7 está concluída. A Fase 6 está concluída, menos a 6.2b (importar os achados), que espera a sua decisão sobre [docs/curadoria.md](docs/curadoria.md). Próximo: Fase 8 ([docs/plano/fase-8.md](docs/plano/fase-8.md)); o Opus confere as fichas contra o código antes de começar. Da Fase 3 só resta a P3c ([docs/plano/fase-3-pendencias.md](docs/plano/fase-3-pendencias.md)).

## Pendências

- As "ainda em aberto" da Fase 3; nenhuma bloqueia a Fase 4.
