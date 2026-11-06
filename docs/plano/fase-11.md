# Fase 11 — Abas de Mapas, Prévia do Dossiê, Barra Inferior e Grade Avançada

"A mesa do mestre organizada e sem atrito." Inspirada no fluxo do Atlas VTT: múltiplos mapas abertos em abas no topo, projeção independente pelo ícone de olho na aba, barra inferior unificada de utilidades, customização completa da grade com alinhamento visual, e prévia da ficha real do Dossiê colada ao token.

**Critério de pronto:** O mestre mantém 3 mapas abertos em abas no topo do Atlas, projeta o Mapa A para os jogadores pelo ícone de olho na aba enquanto navega no Mapa B, customiza a cor/opacidade/estilo da grade pelo popover inferior (ou alinha no olho), ajusta PV/PD direto no cartão do token ou abre a gaveta flutuante com a ficha real do Dossiê em modo compacto, e cada mapa salvo publica sua miniatura WebP na campanha.

**🔒 = muda outro projeto (`Dossie` na 11.2a).** Só começa com autorização explícita do usuário para aquele projeto.

## Execução Paralela com a Mesa e Recomendação de Modelo

Esta fase do **Atlas** é **100% independente** do desenvolvimento da interface de Coleção na **Mesa** (`Mesa/docs/plano/fase-2.md`). Você pode rodar um chat no repositório `Atlas` executando esta Fase 11 ao mesmo tempo em que outro chat trabalha no repositório `Mesa`.

| # | Tarefa | Escopo | Modelo Sugerido | Paralelizável com a Mesa? |
| --- | --- | --- | --- | --- |
| `11.1a` | Estado de abas de mapas abertos e barra de abas no topo | Atlas | **Gemini 3.8 Flash Medium** | ✅ Sim (independente) |
| `11.1b` | Cache rápido entre abas e "Olho do Projetor" independente por aba | Atlas | **Gemini 3.8 Flash High** | ✅ Sim (independente) |
| `11.2a` | 🔒 Modo `?compacto=1` no Dossiê e pedido `ficha.ajustar-recursos` no `mesa-core` | `mesa-core` + Dossiê | **Gemini 3.8 Flash Medium** | ✅ Sim (só toca `mesa-core` e `Dossie`) |
| `11.2b` | Ajuste rápido de PV/PD (`-`/`+`) e barra de vida no cartão do token | Atlas | **Gemini 3.8 Flash Medium** | ✅ Sim (depende da `11.2a`) |
| `11.2c` | Gaveta flutuante de prévia da ficha (`PreviaDaFicha.tsx`) colada ao token | Atlas | **Gemini 3.8 Flash High** | ✅ Sim (depende da `11.2b`) |
| `11.3a` | Barra de utilidades inferior unificada com submenus e Olho da Vista de Jogador | Atlas | **Gemini 3.8 Flash Medium** | ✅ Sim (independente) |
| `11.3b` | Relógio/cronômetro de sessão e contadores dramáticos no canto superior direito | Atlas | **Gemini 3.8 Flash Medium** | ✅ Sim (depende da `11.3a`) |
| `11.4a` | Documento `atlas.map` v7: propriedades visuais da grade e `snap` independente | Atlas | **Gemini 3.8 Flash Medium** | ✅ Sim (independente) |
| `11.4b` | Renderização PixiJS da grade (estilos, cor auto-contraste, espessura) e Modo de Alinhamento | Atlas | **Gemini 3.8 Flash High** | ✅ Sim (depende da `11.4a`) |
| `11.4c` | Popover `ConfiguracaoDeGrade.tsx` ("Grid Settings") na barra inferior | Atlas | **Gemini 3.8 Flash Medium** | ✅ Sim (depende de `11.3a` e `11.4b`) |
| `11.5a` | Publicar miniatura WebP do mapa na entidade `lugar` da campanha | Atlas | **Gemini 3.8 Flash High** | ✅ Sim (usa `Entidade.retrato` já existente no v1) |
| `11.5b` | Atender pedido `atlas.preparar-cena` (lançar cena/encontro vindo da Mesa) | `mesa-core` + Atlas | **Gemini 3.8 Flash High** | ⚠️ Ponto de encontro com `M2.2b` da Mesa |

> **Dica de paralelismo dentro do próprio Atlas:** As trilhas `11.1` (Abas), `11.2` (Ficha no Token), `11.3` (Barra Inferior) e `11.4a–b` (Domínio e Render da Grade) mexem em arquivos quase disjuntos; num único chat do Atlas, siga na ordem da tabela (uma tarefa por vez).

---

### 11.1a — Estado de abas de mapas abertos e barra de abas no topo  ✅
Objetivo: permitir manter vários mapas abertos em abas no topo do Atlas, abrindo novos mapas pelo botão `+` e alternando entre eles sem precisar voltar à Galeria.
Depende de: —
Ler: `src/app/app.ts` (`abrirMapa`, `fecharSessao`, `resumos`, `navegar`, `renomearMapaAberto`), `src/ui/Cabecalho.tsx`, `src/ui/estilo.css`.
Arquivos: criar `src/app/abas.ts`, `src/ui/AbasDeMapas.tsx`, `tests/unit/abas.test.ts`; mudar `src/app/app.ts`, `src/ui/Cabecalho.tsx`, `src/ui/estilo.css`.
Como:
1. Em `src/app/abas.ts`, criar o estado persistido em `localStorage['atlas:abas-abertas']`:
   - `export interface AbaMapa { id: string; nome: string; camera?: { x: number; y: number; zoom: number } }`.
   - `export const abasAbertas = signal<AbaMapa[]>([])`.
   - Funções: `registrarAbaAberta(id: string, nome: string)`, `atualizarNomeDaAba(id: string, nome: string)`, `lembrarCameraDaAba(id: string, camera: { x: number; y: number; zoom: number })`, `obterCameraDaAba(id: string)`, `fecharAba(id: string): string | null` (devolve o `id` da aba vizinha para navegar se a aba fechada era a ativa, ou `null` se não sobrou nenhuma).
2. Em `abrirMapa(id)` (`src/app/app.ts`), antes de fechar a sessão anterior, salvar `viewport.atual?.camera` na aba anterior via `lembrarCameraDaAba`; ao abrir o novo mapa, chamar `registrarAbaAberta(mapa.id, mapa.name)` e, se houver câmera salva para essa aba (e não houver `comodo` em `focoPendente`), restaurar a câmera salva.
3. Criar `src/ui/AbasDeMapas.tsx` e integrá-lo ao `Cabecalho.tsx` quando `noEditor` for verdadeiro (fora de `?embutido=1`):
   - Lista horizontal de abas com o nome do mapa, estado de gravação na aba ativa, clique para trocar de mapa (`navegar({ tipo: 'mapa', id })`) e botão `×` para fechar a aba (`data-testid="fechar-aba-<id>"`).
   - Botão `+` (`data-testid="abrir-nova-aba"`) ao fim das abas que abre um popover leve listando os outros mapas de `resumos.value` (com busca rápida) e um botão `"Criar novo mapa"`.
Não fazer: projetor desacoplado da aba ativa (fica na 11.1b).
Testes: unitários em `tests/unit/abas.test.ts` (registrar, não duplicar, atualizar nome, lembrar câmera, fechar aba ativa escolhendo a vizinha, persistência no `localStorage`).
Pronto quando: o mestre abre 3 mapas em abas no topo, alterna entre eles com 1 clique mantendo o zoom/posição de cada um, e abre outro mapa pelo `+`.
Commit: feat(atlas): add multi-map tabs bar with camera memory

### 11.1b — Cache rápido entre abas e "Olho do Projetor" independente por aba  ✅
Objetivo: permitir que o mestre escolha qual aba está sendo exibida no Projetor pelo ícone de "olho" na aba, podendo editar ou consultar outro mapa sem tirar o projetor da cena dos jogadores.
Depende de: 11.1a
Ler: `src/app/projetor.ts` (`iniciarPublicacao`, `abrirJanelaDoProjetor`, `nomeDoCanalDoProjetor`), `src/ui/Projetor.tsx`, `src/app/abas.ts`, `src/ui/AbasDeMapas.tsx`, `src/app/app.ts`.
Arquivos: mudar `src/app/projetor.ts`, `src/ui/Projetor.tsx`, `src/app/abas.ts`, `src/ui/AbasDeMapas.tsx`, `src/app/app.ts`, `tests/unit/projetor.test.ts`.
Como:
1. Em `src/app/projetor.ts`, adicionar `export const mapaNoProjetorId = signal<string | null>(null)` e um canal global de projeção `atlas:projetor:ativo` (além do canal específico do mapa para compatibilidade):
   - Quando o projetor é aberto (`abrirProjetor()`), se `mapaNoProjetorId.value` for `null`, assume o `id` do mapa ativo.
2. Manter um cache em memória de até 3 `SessaoDeEdicao` abertas nas abas (`cacheDeSessoes` em `src/app/app.ts`):
   - Trocar de uma aba para outra que está nas `abasAbertas` preserva a `SessaoDeEdicao` viva em `cacheDeSessoes` (sem fechar o `Store` nem parar o `publicador` se aquela aba for a `mapaNoProjetorId`). Fechar a aba pelo `×` encerra e remove do cache.
3. Em `src/ui/AbasDeMapas.tsx`, cada aba exibe um botão de ícone `olho` (`data-testid="aba-projetor-<id>"`, `title="Mostrar <nome> na visão dos jogadores"`):
   - A aba cujo `id === mapaNoProjetorId.value` (quando o projetor está aberto ou marcado) fica com o ícone de olho aceso/destacado.
   - Clicar no olho de outra aba define `mapaNoProjetorId.value = id`, aponta o `publicador` para a sessão daquela aba (abrindo o projetor se ainda não estava aberto) e transmite a projeção do novo mapa para a janela do projetor existente sem precisar abrir um novo popup.
Não fazer: alterar o filtro `projetarParaJogadores` de névoa de guerra.
Testes: unitários em `tests/unit/projetor.test.ts` garantindo que navegar para outra aba no editor mantém o `publicador` transmitindo a aba marcada em `mapaNoProjetorId`, e clicar no olho troca o mapa projetado.
Pronto quando: com dois mapas abertos em abas, o mestre navega para o segundo mapa sem alterar a tela do projetor, e ao clicar no olho da segunda aba o projetor passa a exibi-la na hora.
Commit: feat(atlas): decouple active editor tab from projector target tab via eye toggle

### 11.2a — 🔒 Modo `?compacto=1` no Dossiê e pedido `ficha.ajustar-recursos` no `mesa-core`  ⬜
Objetivo: permitir que o Atlas ajuste PV/PD de uma ficha pelo barramento e embuta qualquer ficha ou ameaça do Dossiê num card compacto sem a sidebar lateral.
Depende de: autorização do usuário para alterar `Projects/Dossie` (🔒).
Ler: `mesa-core/src/eventos.ts`, `../Dossie/src/mesa.js`, `../Dossie/src/app.js`, `../Dossie/src/styles.css`.
Arquivos: mudar `mesa-core/src/eventos.ts`, `tests/unit/mesa-core.test.ts` (rodar `npm run build:core` e copiar `mesa-core/dist/.` para `../Dossie/vendor/mesa-core/` e `../Mesa/vendor/mesa-core/`); mudar `../Dossie/src/mesa.js`, `../Dossie/src/app.js`, `../Dossie/src/styles.css`, `../Dossie/tests/mesa.test.js`.
Como:
1. Em `mesa-core/src/eventos.ts`, adicionar ao `CATALOGO`:
   - `'ficha.ajustar-recursos': { natureza: 'pedido', dono: 'ficha', validar: todos(ref('ficha'), num('deltaPv', true), num('deltaPd', true), num('pv', true), num('pd', true)) }`.
   - Rodar `npm run build:core` e atualizar `vendor/mesa-core/` no Dossiê e na Mesa.
2. Em `../Dossie/src/mesa.js`, atender `ficha.ajustar-recursos`:
   - Achar a ficha por `dados.ficha.id` em `ficha.fichas()`.
   - Aplicar `pv` absoluto ou `deltaPv` (limitado entre `0` e `pvMax`/`maxPv`) e `pd` absoluto ou `deltaPd` (limitado entre `0` e `maxPd`/`maxSan`/`maxPe`), chamar `ficha.salvar?.(sheet)` (ou atualizar e persistir), emitir `publicarRecursos(sheet)` na hora e responder `{ ok: true }`.
3. Em `../Dossie/src/app.js` e `../Dossie/src/styles.css`:
   - Se `new URLSearchParams(location.search).get('compacto') === '1'`, definir `document.body.dataset.compacto = '1'`.
   - Em `body[data-compacto="1"]`: ocultar `.workspace-sidebar`, botões de navegação global de pastas e margens largas, exibindo a ficha/statblock de ameaça ocupando 100% da largura do `iframe`.
   - Escutar `window.addEventListener('hashchange' / 'popstate')` ou mensagem para trocar rapidamente de ficha se `?ficha=` mudar.
Não fazer: criar a gaveta no Atlas ainda (fica nas 11.2b e 11.2c).
Testes: unitários do catálogo em `tests/unit/mesa-core.test.ts` e do handler `ficha.ajustar-recursos` em `../Dossie/tests/mesa.test.js`.
Pronto quando: `/Dossie/?ficha=<id>&compacto=1` mostra só a ficha limpa e `ficha.ajustar-recursos` altera PV/PD e republica `ficha.recursos`.
Commit: feat(ficha,mesa-core): add compact embed mode and ficha.ajustar-recursos request

### 11.2b — Ajuste rápido de PV/PD (`-`/`+`) e barra de vida no cartão do token  ⬜
Objetivo: permitir ajustar PV e PD diretamente no cartão contextual do token selecionado no modo Sessão.
Depende de: 11.2a
Ler: `src/ui/CartaoContextual.tsx`, `src/app/fichas.ts`, `src/domain/fichas.ts`, `src/ui/estilo.css`.
Arquivos: mudar `src/domain/fichas.ts`, `src/app/fichas.ts`, `src/ui/CartaoContextual.tsx`, `src/ui/estilo.css`, `tests/unit/fichas.test.ts`.
Como:
1. Em `src/domain/fichas.ts`, criar função pura `interpretarAjusteDeRecurso(entrada: string): { delta?: number; absoluto?: number } | null`:
   - `"-5"` → `{ delta: -5 }`, `"+3"` → `{ delta: 3 }`, `"18"` → `{ absoluto: 18 }`.
2. Em `src/app/fichas.ts`, criar `ajustarRecursos(b: Pick<Barramento, 'pedir'> | null | undefined, ref: Ref, patch: { deltaPv?: number; deltaPd?: number; pv?: number; pd?: number })`:
   - Atualiza otimisticamente `recursosDasFichas` no Atlas para feedback instantâneo e envia `b?.pedir('ficha.ajustar-recursos', { ficha: ref, ...patch })`.
3. Em `src/ui/CartaoContextual.tsx` (quando `emSessao && a.colecao === 'tokens'`):
   - Exibir barra de PV colorida (`32/32`) com botões `-` (`data-testid="cartao-pv-menos"`) e `+` (`data-testid="cartao-pv-mais"`, clique = `±1`, `Shift+clique` = `±5`), e input rápido ao clicar nos números para digitar dano/cura (ex.: `-8` e `Enter`).
   - Se `temPd(rec)`, mostrar também os controles compactos `-` / `+` para PD.
   - Manter `data-testid="cartao-recursos"` e `data-testid="cartao-abrir-ficha"` compatíveis com os testes existentes.
Não fazer: o popover flutuante com o `iframe` do Dossiê (fica na 11.2c).
Testes: unitários de `interpretarAjusteDeRecurso` e atualização otimista em `tests/unit/fichas.test.ts`.
Pronto quando: clicar num token na sessão exibe a barra de PV/PD com botões `-`/`+` e input rápido que atualizam os pips do token e a ficha no Dossiê.
Commit: feat(atlas): add inline HP/PD bar and quick delta controls on token card

### 11.2c — Gaveta flutuante de prévia da ficha (`PreviaDaFicha.tsx`) colada ao token  ⬜
Objetivo: abrir um card flutuante ao lado do token selecionado mostrando a página compacta da ficha no Dossiê, permitindo consultar stats e clicar em rolagens sem sair do mapa.
Depende de: 11.2b
Ler: `src/ui/CartaoContextual.tsx`, `src/ui/Editor.tsx`, `src/app/fichas.ts`, `src/ui/estilo.css`.
Arquivos: criar `src/ui/PreviaDaFicha.tsx`; mudar `src/ui/CartaoContextual.tsx`, `src/ui/Editor.tsx`, `src/ui/estilo.css`.
Como:
1. Criar `src/ui/PreviaDaFicha.tsx` com o signal `export const previaDaFichaAberta = signal<boolean>(false)` e `export const previaFixada = signal<boolean>(false)`:
   - No `CartaoContextual.tsx` de um token com `refDaFicha`, adicionar o botão `Espiar` / seta `▸` (`data-testid="cartao-espiar-ficha"`, `aria-pressed={previaDaFichaAberta.value}`) que alterna `previaDaFichaAberta`.
   - Quando `previaDaFichaAberta.value` é `true` e há 1 token com ficha selecionado, renderiza um card flutuante (`380px × 500px`) posicionado ao lado da caixa do token na tela (à direita se couber na `.area-do-mapa`, senão à esquerda; ou estacionado no canto direito se `previaFixada.value` for `true`).
2. Conteúdo de `PreviaDaFicha.tsx`:
   - Cabeçalho com o nome da peça, botão `📌` (fixar/soltar do token), botão `↗` (`abrirFicha` em aba cheia) e botão `×` (fechar).
   - `iframe` apontando para `../Dossie/?ficha=${encodeURIComponent(ref.id)}&compacto=1` (`data-testid="iframe-previa-ficha"`).
   - Se o Dossiê não responder (testado por `descobrir(new URL('../Dossie/', location.href))`), exibir um cartão de fallback nativo com retrato, nome, PV/PD e notas da entidade na campanha.
Não fazer: reimplementar regras de sistema dentro do Atlas.
Testes: teste verificando que clicar em `cartao-espiar-ficha` abre o painel `PreviaDaFicha` ancorado ao token e fecha ao desselecionar o token.
Pronto quando: clicar na seta do token abre o statblock real do Dossiê colado ao token (como na referência do Atlas VTT) e rolagens feitas ali flutuam sobre a peça no mapa.
Commit: feat(atlas): add live floating Dossie sheet preview popover anchored to tokens

### 11.3a — Barra de utilidades inferior unificada com submenus e Olho da Vista de Jogador  ✅
Objetivo: organizar as ferramentas e utilidades numa barra inferior flutuante moderna, com histórico à esquerda, ferramentas agrupadas com submenus ao centro e o botão de Olho (`Vista de Jogador`) destacado à direita.
Depende de: —
Ler: `src/ui/Editor.tsx`, `src/ui/Dock.tsx`, `src/ui/Cabecalho.tsx`, `src/app/acoes.ts`, `src/ui/estilo.css`.
Arquivos: criar `src/ui/BarraInferior.tsx`; mudar `src/ui/Editor.tsx`, `src/ui/Dock.tsx`, `src/ui/estilo.css`.
Como:
1. Criar `src/ui/BarraInferior.tsx` posicionada no pé da área do mapa:
   - **Esquerda:** botões `Desfazer` e `Refazer`.
   - **Centro:** ferramentas ativas conforme `modo.value` (`construir` ou `sessao`), mantendo **todos os `data-testid="ferramenta-<id>"`**, `data-testid="alternar-biblioteca"`, `data-testid="enquadrar"` e `data-testid="alternar-grade"` intactos para compatibilidade total com os testes e tutoriais (`Tutor.tsx`).
   - Adicionar chevrons discretos (`▾`) ao lado de grupos com opções rápidas (ex.: na `Régua`, o `▾` abre o seletor de regra de diagonal `Simples` / `5-10-5` / `Euclidiana`; na `Grade`, abre o popover da `11.4c`).
   - **Direita:** botão destacado em pílula roxa/acento com o ícone `olho` (`data-testid="barra-vista-jogador"`) que alterna `vistaDeJogador` (com `▾` ao lado para abrir o painel rápido do Projetor).
2. Integrar harmoniosamente com o `Dock.tsx` no modo Sessão (os botões dos painéis flutuantes da sessão ficam integrados ou logo acima da barra, sem sobrepor).
Não fazer: quebrar seletores do `Tutor.tsx` ou dos testes e2e existentes.
Testes: rodar `npm test` e conferir que todos os atalhos e seletores de ferramentas continuam funcionando.
Pronto quando: a barra inferior flutua organizada no pé do mapa com histórico, ferramentas, opções rápidas e o botão de olho da vista de jogador.
Commit: feat(atlas): unify bottom floating utility toolbar with submenus and player view toggle

### 11.3b — Relógio/cronômetro de sessão e contadores dramáticos no canto superior direito  ✅
Objetivo: adicionar os widgets flutuantes no canto superior direito do mapa (contador dramático e cronômetro/relógio de cena).
Depende de: 11.3a
Ler: `src/ui/Editor.tsx`, `src/domain/mapa.ts` (`Clima`), `src/ui/estilo.css`.
Arquivos: criar `src/ui/WidgetsDeTopo.tsx`, `tests/unit/widgets-topo.test.ts`; mudar `src/ui/Editor.tsx`, `src/ui/estilo.css`.
Como:
1. Criar `src/ui/WidgetsDeTopo.tsx` no canto superior direito de `.area-com-cartao`:
   - **Pílula do Contador Dramático (`data-testid="widget-contador"`):** guarda `{ rotulo: string; valor: number }` por mapa em `localStorage`. Clique esquerdo soma `+1`, clique direito (ou botão `-`) subtrai `-1`, clique no rótulo permite renomear (ex.: *Pavor*, *Tensão*, *Alerta*).
   - **Pílula do Tempo (`data-testid="widget-tempo"`):** alterna entre **Cronômetro da cena** (`MM:SS`, clicar inicia/pausa, duplo-clique zera) e **Hora do mundo** (`m.climate.time`, com botões `+15m` e `+1h` que executam `clima.atualizar` avançando o horário do mapa).
Não fazer: gravar tiques de segundo no histórico de undo do Store.
Testes: unitários da formatação do cronômetro e cálculo de avanço de `HH:MM` (`23:45` + 30 min → `00:15`).
Pronto quando: as duas pílulas aparecem no canto superior direito do mapa, contando o tempo da sessão ou avançando a hora do mapa.
Commit: feat(atlas): add top-right dramatic counter and session timer widgets

### 11.4a — Documento `atlas.map` v7: propriedades visuais da grade e `snap` independente  ✅
Objetivo: expandir `Grade` no documento para suportar `snap` separado de `visible`, tipo (`square` | `hex`), estilo de linha (`solid` | `dashed` | `dotted` | `corners`), cor (`auto` ou `#rrggbb`), opacidade e espessura.
Depende de: —
Ler: `src/domain/mapa.ts`, `src/domain/validacao.ts`, `src/domain/migracoes.ts`, `src/render/grade.ts`, `src/ui/Editor.tsx`.
Arquivos: mudar `src/domain/mapa.ts`, `src/domain/validacao.ts`, `src/domain/migracoes.ts`, `src/render/grade.ts`, `src/ui/Editor.tsx`, `tests/unit/migracoes.test.ts`, `tests/unit/validacao.test.ts`.
Como:
1. Em `src/domain/mapa.ts`, atualizar `VERSAO_MAPA = 7` e expandir `Grade`:
   ```ts
   export const TIPOS_DE_GRADE = ['square', 'hex'] as const;
   export const ESTILOS_DE_LINHA_DA_GRADE = ['solid', 'dashed', 'dotted', 'corners'] as const;
   export interface Grade {
     kind: (typeof TIPOS_DE_GRADE)[number];
     size: number;
     offset: Ponto;
     visible: boolean;
     snap: boolean;
     lineStyle: (typeof ESTILOS_DE_LINHA_DA_GRADE)[number];
     color: 'auto' | string;
     opacity: number;
     lineWidth: number;
   }
   ```
2. Em `src/domain/mapa.ts` (`criarMapa`) e `src/domain/migracoes.ts` (migração `6 → 7`), preencher os padrões: `snap: true`, `lineStyle: 'solid'`, `color: 'auto'`, `opacity: 0.5`, `lineWidth: 1`.
3. Em `src/domain/validacao.ts`, validar `snap` (booleano), `kind` (`'square' | 'hex'`), `lineStyle`, `color` (`'auto'` ou `#rrggbb`), `opacity` (`0.05` a `1`) e `lineWidth` (`0.5` a `5`).
4. Em `src/render/viewport.ts` e `src/ui/Editor.tsx`, usar `!m.grid.snap` para desativar o encaixe na grade (desacoplado de `m.grid.visible`).
Não fazer: desenhar os novos estilos no PixiJS ainda (fica na 11.4b).
Testes: migração `v6 → v7` em `tests/unit/migracoes.test.ts` e validação dos novos campos em `tests/unit/validacao.test.ts`.
Pronto quando: `npm run typecheck` e `npm test` passam com o documento na versão 7.
Commit: feat(domain): upgrade atlas.map to v7 with rich grid customization fields

### 11.4b — Renderização PixiJS da grade (estilos, cor auto-contraste, espessura) e Modo de Alinhamento  ✅
Objetivo: desenhar no `viewport.ts` todos os estilos de grade (`solid`, `dashed`, `dotted`, `corners`, `hex`), a cor de auto-contraste Preto/Branco, opacidade e espessura, além do Modo de Alinhamento Visual da grade.
Depende de: 11.4a
Ler: `src/render/grade.ts`, `src/render/viewport.ts` (`desenharGrade`, `Interacao`).
Arquivos: mudar `src/render/grade.ts`, `src/render/viewport.ts`, `tests/unit/grade.test.ts`.
Como:
1. Em `src/render/grade.ts`, adicionar funções puras:
   - `segmentosTracejados(ini: number, fim: number, comp: number, espaco: number): [number, number][]` para `dashed` e `dotted`.
   - `verticesHexagonaisVisiveis(camera, tela, grade, limites)` para `kind: 'hex'`.
   - `ajustarGradePorAlinhamento(grade: Grade, origem: Ponto, novoPonto: Ponto, modo: 'offset' | 'escala'): Partial<Grade>`.
2. Em `desenharGrade()` (`src/render/viewport.ts`):
   - Aplicar `largura = px(m.grid.lineWidth)` e `opacidade = m.grid.opacity`.
   - Quando `m.grid.color === 'auto'`, desenhar traço duplo (sombra preta `0x07080b` e linha branca `0xffffff`) para garantir leitura sobre qualquer piso; quando for `#rrggbb`, usar `hexParaNumero(m.grid.color)`.
   - Suportar `lineStyle`: `'solid'` (linhas contínuas), `'dashed'` (traços), `'dotted'` (pontos), `'corners'` (pequenas cruzes apenas nas interseções das células) e `kind: 'hex'`.
3. Adicionar `alinhandoGrade?: () => boolean` na `PonteViewport`:
   - Quando ativo, desenha um gabarito 3×3 células destacado no centro da visão: arrastar o meio ajusta `grid.offset`; arrastar os cantos ajusta `grid.size` num único `Gesto` do store.
Não fazer: o componente Preact do popover (fica na 11.4c).
Testes: unitários em `tests/unit/grade.test.ts` cobrindo segmentos tracejados, cruzes de canto, hexágonos e cálculo de alinhamento.
Pronto quando: a grade muda de estilo, cor, opacidade e espessura em tempo real no canvas e o Modo de Alinhamento calibra `offset` e `size` pelo mouse.
Commit: feat(render): support custom grid styles, auto-contrast color, hex grid and visual alignment mode

### 11.4c — Popover `ConfiguracaoDeGrade.tsx` ("Grid Settings") na barra inferior  ✅
Objetivo: criar o popover flutuante de configuração da grade ("Grid Settings"), aberto pelo botão de grade na barra inferior.
Depende de: 11.3a, 11.4b
Ler: `src/ui/BarraInferior.tsx`, `src/ui/Inspetor.tsx`, `src/ui/campos.tsx`, `src/ui/estilo.css`.
Arquivos: criar `src/ui/ConfiguracaoDeGrade.tsx`; mudar `src/ui/BarraInferior.tsx`, `src/ui/Editor.tsx`, `src/ui/Inspetor.tsx`, `src/ui/estilo.css`.
Como:
1. Criar `src/ui/ConfiguracaoDeGrade.tsx` com layout em duas colunas:
   - **Cabeçalho:** título `Configurações da Grade`, botão `✥ Modo de Alinhamento` (`data-testid="grade-modo-alinhamento"`) e botão fechar `×`.
   - **Coluna Esquerda:** toggles `Mostrar grade` (`visible`, `data-testid="grade-mostrar"`) e `Encaixar na grade` (`snap`, `data-testid="grade-encaixar"`), selects `Tipo de grade` (`Quadrada` / `Hexagonal`) e `Estilo da linha` (`Sólida`, `Tracejada`, `Pontilhada`, `Cantos`), sliders `Opacidade` (`5%`–`100%`, usando `store.iniciarGesto`) e `Espessura da linha` (`0.5px`–`5px`), e tamanho da célula (`m`).
   - **Coluna Direita (`Cor`):** grade 6×2 de seletores grandes de cor: o 1º é o **Auto-contraste P&B** (`color: 'auto'`, dividido diagonalmente em preto e branco com `✓`), seguido por `#ffffff`, `#000000`, `#ff1f1f`, `#1fff1f`, `#1f3bff`, `#ffff00`, `#ff00ff`, `#808080`, `#ffa500`, `#800080`, `#ffc0cb`.
Não fazer: remover a seção de grade do `Inspetor.tsx` (ambos editam o mesmo documento).
Testes: teste de interface abrindo o popover, trocando cor para vermelho, estilo para `dashed` e desligando `snap`.
Pronto quando: o popover abre sobre a barra inferior com o layout das duas colunas, altera todos os parâmetros da grade ao vivo e aciona o Modo de Alinhamento.
Commit: feat(atlas): add Grid Settings popover with color swatches, sliders and alignment toggle

### 11.5a — Publicar miniatura WebP do mapa na entidade `lugar` da campanha  ⬜
Objetivo: gravar uma miniatura visual (`retrato: Blob`) na entidade `lugar` do banco `mesa-campanha-v1` sempre que o mapa for sincronizado com a campanha, para que a coleção da Mesa exiba os cartões ilustrados dos mapas.
Depende de: —
Ler: `src/app/campanha.ts` (`sincronizarMapaComCampanha`), `src/ui/previa.ts` (`desenharPrevia`), `mesa-core/src/campanha.ts` (`Entidade.retrato`).
Arquivos: mudar `src/ui/previa.ts`, `src/app/campanha.ts`, `tests/unit/campanha.test.ts`.
Como:
1. Em `src/ui/previa.ts`, adicionar `export async function gerarMiniaturaDoMapa(m: MapaAtlas, l = 320, a = 200): Promise<Blob | undefined>`:
   - Usa `desenharPrevia` num canvas `320×200` e converte para `Blob` (`image/webp`, qualidade `0.82`), garantindo `< 512 KB` (limite do `mesa-core`). Em ambiente sem `toBlob`/`OffscreenCanvas` (como testes unitários Node), devolve `undefined` sem falhar.
2. Em `sincronizarMapaComCampanha` (`src/app/campanha.ts`), gerar a miniatura e passá-la no campo `retrato` ao criar ou salvar a entidade `lugar` (quando `criadaPor === 'atlas'`).
Não fazer: mudar o esquema do `mesa-core` (`retrato?: Blob` já faz parte de `Entidade` no contrato v1).
Testes: unitário em `tests/unit/campanha.test.ts` injetando um gerador de miniatura falso e verificando que `entidade.retrato` é gravado no repositório da campanha.
Pronto quando: mapas ligados a uma campanha publicam sua miniatura no `mesa-campanha-v1`.
Commit: feat(atlas): publish WebP map thumbnails to campaign place entities

### 11.5b — Atender pedido `atlas.preparar-cena` (lançar cena/encontro vindo da Mesa)  ⬜
Objetivo: permitir que a Mesa peça ao Atlas para preparar uma cena inteira (abrir mapa numa aba, aplicar clima, focar cômodo e posicionar as peças do encontro).
Depende de: 11.1a
Ler: `mesa-core/src/eventos.ts`, `src/app/app.ts` (`iniciar`), `src/app/fichas.ts` (`adicionarPersonagem`), `src/app/campanha.ts`.
Arquivos: mudar `mesa-core/src/eventos.ts`, `src/app/app.ts`, `tests/unit/mesa-core.test.ts` (rodar `npm run build:core` e copiar para `../Mesa/vendor/mesa-core/`).
Como:
1. Em `mesa-core/src/eventos.ts`, acrescentar ao `CATALOGO`:
   - `'atlas.preparar-cena': { natureza: 'pedido', dono: 'atlas', validar: todos(refOuNulo('mapa'), texto('comodo', true), texto('clima', true)) }` (com lista opcional `fichas?: Ref[]` validada).
   - Atualizar `../Mesa/vendor/mesa-core/` com `npm run build:core`.
2. Em `src/app/app.ts`, atender `atlas.preparar-cena`:
   - Se `dados.mapa` vier, abre o mapa (registrando na barra de abas da `11.1a`) e foca no `dados.comodo` se houver.
   - Se `dados.clima` vier e existir no mapa/presets, aplica o clima.
   - Para cada `Ref` em `dados.fichas`, busca a entidade correspondente em `entidadesDaCampanha` e, se ainda não estiver no mapa, chama `adicionarPersonagem(...)` distribuindo em células livres perto do cômodo focado (ou do centro).
Não fazer: apagar peças que já estavam no mapa.
Testes: unitários da validação do evento `atlas.preparar-cena` e do atendimento no Atlas.
Pronto quando: receber `atlas.preparar-cena` abre o mapa, muda o clima e coloca os participantes do encontro no tabuleiro.
Commit: feat(atlas,mesa-core): handle atlas.preparar-cena request for 1-click scene & encounter setup
