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

## Fase 3 — Construir (2 de novembro) — concluída, com pendências

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
- **161 testes unitários** passando (repetidos várias vezes, sem oscilação) e **20 testes e2e** em Chromium com WebGL.
- O e2e cobre o critério de pronto: casa de três cômodos com portas, objeto e luz **só pela interface**, cartão contextual abrindo a porta, desfazer, gravar e recarregar; borracha refazendo paredes e desfazendo; busca na biblioteca, terreno e Esc cancelando o traço; notas do mestre do cômodo.
- Captura visual conferida nos temas Ordem e Prata (cômodos com piso e papel, portas, mobília, luzes).
- Defeitos reais achados e corrigidos no caminho: a paleta de comandos apagava o que já tinha sido digitado (efeito rodava depois de abrir); teste do `mesa-core` dependia de um atraso fixo; o cartão contextual cobria os cliques de quem estava pondo itens.

### Pendências reais

- **3.1** Transições automáticas entre terrenos (hoje cada camada tem borda seca).
- **3.8** Editar a cartela de título na interface (o campo existe no documento) e escolher o fundo por textura.
- **3.10** `refs` do cômodo com a campanha: a leitura e as notas do mestre funcionam, ligar documentos de outros apps ainda não.
- Parâmetros de receita só aparecem na biblioteca antes de pôr; depois, o inspetor oferece apenas "Variar".
- O tempo "menos de dez minutos" foi conferido pelo fluxo automatizado, não cronometrado com uma pessoa.

## Próximo

Fase 4 — Climas e atmosfera: o mesmo mapa de dia, em tempestade, à noite e sem energia.

## Pendências

- As da Fase 3 acima; nenhuma bloqueia a Fase 4.
