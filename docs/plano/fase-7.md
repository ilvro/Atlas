# Fase 7 — Sessão

"Jogar o mapa." Critério de pronto da fase (ROADMAP): jogar a casa com dois tokens no projetor, abrindo portas, trocando o clima e revelando cômodos, sem nada do mestre vazar.

Detalhado em 3 de novembro de 2026, **antes da Fase 6**, contra o código do fim da Fase 5. A Fase 6 mexe em `procedural/`, no acervo e no render de objetos, não no que esta fase usa; mesmo assim, **ao começar a fase, o Opus confere as fichas de novo** (caminhos de arquivo, assinaturas). Se uma ficha não bater com o código, pare e reporte, como sempre.

## Como o código está hoje (o que a fase muda)

- Não há modo Sessão: o editor é o único modo. As peças (`tokens`) são um círculo com a inicial (`desenharPeca` em `render/cena.ts`), sem retrato.
- O documento já tem `Peca` (retrato, sprite, tamanho, visão, `lightId`, estado), `session` (`explored`, `initiative`, `revealed`, `event`) e `Comodo.roof`, mas quase nada disso é usado. `session.explored` é uma imagem (`RefAsset`) e nunca foi escrita.
- `poligonoIluminado` e `oclusores(m, 'visao')` (`domain/visibilidade.ts`, 4.1a) já servem para a visão.
- A cena desenha tudo para o mestre: marcadores de luz, regiões (inclusive `gmOnly`), portas secretas como portas.
- O Tabletop tem o que adaptar: `src/domain/initiative.js` (`startInitiative`, `stepInitiative`, `sortOrder`, `setInitiativeValue`, `pruneInitiative`), `src/domain/figures.js` (`FIGURE_STATES`, `stateLook`) e `src/app/presentation-window.js` (janela de projetor por `BroadcastChannel`). Copie e adapte; não importe (AGENTS.md).

## Decisões já tomadas (não rediscutir na implementação)

- **Modo é estado do aplicativo, não do documento:** `modo: 'construir' | 'sessao'` em signal, alternado pelo cabeçalho, pela paleta e pelo atalho `M`. O mapa é o mesmo; a sessão só usa outras ferramentas e mostra outras coisas.
- **Documento v5** concentra todas as mudanças de esquema da fase numa tarefa (7.0b): peças de jogador, interagíveis e o explorado em células.
- **Explorado em células, não imagem:** `session.explored = { res: 0.5; cells: Faixa[] } | null`, em RLE como terreno e presença. Imagem no IndexedDB a cada passo encheria o banco de assets.
- **Ações de sessão são comandos comuns** (entram no histórico e desfazem): mover peça, abrir porta, revelar, iniciativa, interruptor. Mover uma peça de jogador **acumula o explorado no mesmo comando** (o domínio calcula a visão; é puro).
- **Visível** = união dos polígonos de visão (`oclusores(m, 'visao')`, raio `vision.radius`) das peças de jogador. O escuro já aparece pelo mapa de luz; não há regra de "só vê o que está iluminado" nesta fase.
- **O que o jogador vê é uma função pura:** `projetarParaJogadores(m)` (7.5a) tira o que é do mestre. O projetor **só recebe** o resultado dela; a janela do mestre usa a mesma função no "Ver como jogador".
- **Projetor** é uma rota do próprio Atlas (`#/projetor/{mapaId}`) numa segunda janela, falando por `BroadcastChannel('atlas:projetor:<mapaId>')`. Não é o barramento `mesa:eventos` (que é para fatos entre aplicativos).
- **Movimento:** a peça encaixa no centro da célula; não atravessa parede com `blocks.move` nem porta fechada (Alt ignora, para o mestre). A trilha é só do render.
- **Sons dos interagíveis** são sintetizados no Atlas (`fx/som.ts`) nesta fase. O `som: Ref` de portas e interagíveis fica guardado para a 9.4d.
- **O assistente da Fase 5 não aparece na Sessão** (pílula, fantasmas, espalhar), nem a biblioteca, nem as ferramentas de construir.

## Tarefas

| # | Tarefa | Tipo |
| --- | --- | --- |
| 7.0a | Modos Construir e Sessão | app + interface |
| 7.0b | Documento v5 | domínio |
| 7.1a | Peça com retrato, tamanho e estado | render + interface |
| 7.1b | Movimento com trilha | estado + render |
| 7.1c | Lanterna da peça | domínio + interface |
| 7.2a | Visão das peças de jogador | domínio + render |
| 7.2b | Explorado e névoa com memória em esboço | domínio + render |
| 7.2c | Revelação animada e telhados | render + interface |
| 7.3a | Portas na sessão | estado + interface |
| 7.3b | Régua em quadrados | ferramenta |
| 7.3c | Iniciativa | domínio + estado |
| 7.4a | Dock: clima ao vivo | interface |
| 7.4b | Dock: eventos de cena e presença | interface + render |
| 7.4c | Dock: iniciativa | interface |
| 7.5a | Projeção filtrada | domínio |
| 7.5b | Janela de projetor | app + render |
| 7.6a | Interagíveis: interruptor e gaveta | estado + interface |
| 7.6b | Sons dos interagíveis | som |
| 7.7 | Validação da fase | e2e + relatório |

Ordem sugerida: 7.0b, 7.0a, 7.5a, depois a tabela. A 7.5a é pura e dá o "Ver como jogador" que as tarefas de névoa usam para conferir.

---

### 7.0a — Modos Construir e Sessão  ✅
Objetivo: alternar entre construir e jogar na mesma janela, cada modo com as suas ferramentas.
Depende de: —
Ler: `src/app/sessao.ts`; `src/app/acoes.ts` (`usarFerramenta`, `habilitada`); `src/render/pincel.ts` (`Ferramenta`); `src/ui/Editor.tsx`, `Cabecalho.tsx`, `Biblioteca.tsx`, `CartaoContextual.tsx`, `PilulaDeSugestao.tsx`; `src/app/sugestoes.ts`.
Arquivos: criar `src/app/modo.ts`; mudar `sessao.ts` (ou `app.ts`), `acoes.ts`, `pincel.ts`, `Editor.tsx`, `Cabecalho.tsx`, `src/app/sugestoes.ts`, `src/ui/estilo.css`.
Como:
1. `modo = signal<'construir' | 'sessao'>('construir')`, por sessão de edição (abrir outro mapa volta a construir). Atalho `M`, ação na paleta "Alternar modo: Construir / Sessão", chave no cabeçalho com os dois rótulos.
2. `FERRAMENTAS_DA_SESSAO = ['selecionar', 'mao', 'regua']` (a régua chega na 7.3b; até lá, não entra). Ao entrar na sessão, a ferramenta volta a `selecionar` e os atalhos de construir ficam desabilitados (`habilitada` olha o modo).
3. Na sessão: sem biblioteca, sem pílula e sem fantasma (`sugestoes.ts` não calcula), sem cartão de construir (a 7.3a e a 7.6a põem ações de sessão no cartão). O inspetor mostra só a aba Mapa e a seleção, sem os campos de construção (a 7.1a define o que a peça mostra).
4. Visual: o cabeçalho ganha uma faixa no acento com "SESSÃO", na identidade da interface (`docs/INTERFACE.md`).
Não fazer: projetor; visão; o que cada ação de sessão faz.
Testes: e2e: `M` entra na sessão, a biblioteca e a pílula somem, `C` não troca a ferramenta; `M` volta e tudo reaparece. Os e2e anteriores continuam passando (todos começam em Construir).
Pronto quando: o e2e passa.
Commit: build and session modes

### 7.0b — Documento v5  ✅
Objetivo: o documento passa a guardar quem é jogador, os interagíveis e o explorado em células.
Depende de: —
Ler: `src/domain/mapa.ts` (`Peca`, `Objeto`, `Sessao`, `duplicarParaNovaSessao`); `src/domain/migracoes.ts`; `src/domain/validacao.ts`; `src/domain/assets.ts`; `src/domain/celulas.ts`.
Arquivos: mudar `mapa.ts`, `migracoes.ts`, `validacao.ts`, `assets.ts`, `src/domain/fabrica.ts`, `tests/unit/dominio.test.ts`, `tests/unit/fixtures.ts`.
Como:
1. `Peca.player: boolean` (padrão `false` em `novaPeca`).
2. `Objeto.interaction: null | { kind: 'switch' | 'drawer' | 'clue'; on: boolean; targets: string[]; sound: Ref | null; clue: Ref | null }` (padrão `null`). `targets` vazio num interruptor = luzes `power: 'grid'` do cômodo do objeto.
3. `Sessao.explored: null | { res: number; cells: Faixa[] }`.
4. `VERSAO_MAPA = 5`; `de4para5`: `player: false` em todas as peças, `interaction: null` em todos os objetos, `explored: null` (nunca foi escrito como imagem).
5. `assetsDoMapa` deixa de olhar `session.explored`.
6. Validação: `res` entre 0,25 e 2; células canônicas (`ehCanonica`); `targets` só ids de luzes existentes; `kind` conhecido.
Não fazer: usar os campos (as tarefas seguintes usam).
Testes: migração 4→5 de um mapa da Fase 6 (fixture); validação recusa `targets` com luz inexistente; `duplicarParaNovaSessao` zera o explorado.
Pronto quando: testes passam; mapas antigos abrem.
Commit: document v5 for session

### 7.1a — Peça com retrato, tamanho e estado  ✅
Objetivo: a peça mostra o retrato recortado em círculo, ocupa o tamanho certo e muda de cara com o estado.
Depende de: 7.0b
Ler: `src/render/cena.ts` (`desenharPeca`, `sincronizarSimples`); `src/data/repositorio.ts` (`salvarAsset`, `obterAsset`); `Tabletop/src/domain/figures.js` (`stateLook`); `src/ui/Inspetor.tsx` (`CamposDaPeca`); `src/domain/mapa.ts` (`ESTADOS_FIGURA`).
Arquivos: criar `src/domain/figuras.ts`, `src/render/pecas.ts`, `tests/unit/figuras.test.ts`; mudar `cena.ts`, `Inspetor.tsx`, `src/app/app.ts` (carregar retratos).
Como:
1. `figuras.ts`: `ROTULOS_DE_ESTADO` e `aparenciaDoEstado(estado): { anel: string; tinta: string | null; deitado: boolean; pulso: number; tremor: number; marca: 'x' | null }`, adaptado de `stateLook` (ferido: anel vermelho; morrendo: pulso vermelho; inconsciente: deitado e cinza; morto: deitado, cinza e X; enlouquecendo: tremor e roxo).
2. `render/pecas.ts`: `criarPeca(tex)` com retrato (máscara circular), anel no acento (ou na cor do estado), inicial quando não há retrato, tamanho `size × grid.size`, rotação de 90° quando deitado. Animação de pulso e tremor no quadro (parada com efeitos desligados).
3. Retratos: o app lê o blob pelo `RefAsset` (`obterAsset`) e entrega à cena uma `Texture` por id (cache; solta ao fechar o mapa).
4. Inspetor da peça: retrato (enviar imagem → `salvarAsset` → `item.atualizar { portrait }`; remover), tamanho (0,5 a 4 células), estado (`CampoOpcoes` com `ROTULOS_DE_ESTADO`), "Jogador" (`player`), raio de visão.
Não fazer: sprite (Fase 8); movimento.
Testes: unitário de `aparenciaDoEstado` (os seis estados); e2e: enviar um retrato (arquivo de teste em `tests/e2e/`), a peça mostra a imagem (textura carregada), trocar o estado para morto deita a peça.
Pronto quando: os testes passam e uma peça com retrato fica legível no zoom normal.
Commit: tokens with portrait, size and state

### 7.1b — Movimento com trilha  ✅
Objetivo: na sessão, arrastar a peça a leva de célula em célula, sem atravessar paredes, com uma trilha que some aos poucos.
Depende de: 7.0a, 7.0b
Ler: `src/render/viewport.ts` (interação `mover`); `src/domain/visibilidade.ts` (`oclusores`, segmentos); `src/state/comandos.ts` (`selecao.mover`).
Arquivos: criar `src/domain/movimento.ts`, `tests/unit/movimento.test.ts`; mudar `src/state/comandos.ts`, `viewport.ts`, `src/render/pecas.ts`.
Como:
1. `movimento.ts`: `centroDaCelula(m, p)`; `bloqueioNoCaminho(m, de, para): string | null` (motivo, se o segmento cruza parede com `blocks.move` ou porta fechada ou trancada; arco e porta aberta passam).
2. Comando `peca.mover { id, para: Ponto, livre?: boolean }`: encaixa no centro da célula; sem `livre`, recusa com o motivo de `bloqueioNoCaminho`. Rótulo "Mover peça". (A 7.2b acrescenta o explorado; a 7.1c, a lanterna.)
3. Na sessão, arrastar uma peça mostra o caminho reto até a célula sob o ponteiro (verde se livre, vermelho com o motivo se não), e soltar executa `peca.mover`. Alt = `livre`. Setas movem uma célula. Em Construir, nada muda.
4. Render: a peça desliza da posição antiga à nova (160 ms por célula, no máximo 600 ms) e deixa uma trilha pontilhada que some em 2 s. O documento muda na hora; a animação é do render.
Não fazer: caminho com desvio (pathfinding); medir distância (7.3b).
Testes: unitários: atravessar parede é recusado, porta aberta passa, porta trancada não, `livre` passa; e2e: arrastar uma peça na sessão até o outro lado de uma parede é recusado com aviso; pela porta aberta vai.
Pronto quando: os testes passam e o movimento é uma entrada de histórico.
Commit: token movement with trail

### 7.1c — Lanterna da peça  ✅
Objetivo: a peça pode carregar uma lanterna que a acompanha e aponta para onde ela andou.
Depende de: 7.1b
Ler: `src/domain/presets.ts` (`camposDoPreset`, preset `lanterna`); `src/domain/fabrica.ts` (`novaLuz`); `src/state/comandos.ts` (`remover`: luz que pertence à peça).
Arquivos: mudar `src/state/comandos.ts`, `src/ui/Inspetor.tsx`, `tests/unit/movimento.test.ts`.
Como:
1. Inspetor da peça: "Lanterna" (nenhuma, lanterna, lamparina, vela). Escolher cria a luz com `ownerId` = peça, `position` = peça e liga `lightId`, numa transação; "nenhuma" remove a luz.
2. `peca.mover` leva junto a luz `lightId`: posição nova e, se for cone, `direction` = ângulo do movimento (parado não muda). `Peca.facing` acompanha (o mais perto de baixo, esquerda, direita, cima).
3. Comando `peca.virar { id, direcao }` (atalho `Q`/`E` na sessão, com a peça selecionada) gira a lanterna 45° sem mover.
Não fazer: bateria que acaba.
Testes: mover para a direita aponta o cone para 0 rad; remover a peça remove a lanterna; desfazer o movimento devolve a direção.
Pronto quando: andar com a peça num corredor escuro ilumina à frente dela.
Commit: token lantern follows movement

### 7.2a — Visão das peças de jogador  ✅
Objetivo: saber e mostrar o que as peças de jogador veem agora.
Depende de: 7.0b
Ler: `src/domain/visibilidade.ts`; `src/render/mapa-de-luz.ts` (como os polígonos viram máscara); `spikes/estilos/src/main.js` (`visivelRT`, `aplicarVisao`).
Arquivos: criar `src/domain/nevoa.ts`, `src/render/nevoa.ts`, `tests/unit/nevoa.test.ts`; mudar `src/render/cena.ts`.
Como:
1. `nevoa.ts`:
   ```ts
   export const RES_NEVOA = 0.5;
   export function poligonosDeVisao(m: MapaAtlas): number[][]          // um por peça de jogador
   export function celulasVisiveis(m: MapaAtlas, res = RES_NEVOA): Faixa[]   // centro da célula dentro de algum polígono
   ```
   Use `IndiceDeSegmentos` para não testar todas as paredes.
2. `render/nevoa.ts`: `criarNevoa(renderer)` com uma `RenderTexture` de máscara do visível (polígonos preenchidos, borda desfocada), refeita quando mudam peças de jogador, paredes, aberturas ou o clima não importa. `definirVista('mestre' | 'jogador')`: mestre = sem névoa; jogador = fora do visível fica o fundo do mapa (a 7.2b põe a memória).
3. Na cena, a máscara recorta tudo da camada de terreno às peças (as camadas 1–9b da ARQUITETURA §5.1); partículas e acabamento ficam por cima.
4. No modo Sessão, um botão "Ver como jogador" no cabeçalho alterna a vista (o mestre em Construir vê sempre tudo).
Não fazer: explorado (7.2b); projetor.
Testes: unitários: peça dentro de um cômodo fechado não vê o vizinho; com a porta aberta vê pela porta; janela não deixa ver; duas peças somam a visão. e2e: na vista de jogador, um ponto do cômodo vizinho fica com o brilho do fundo.
Pronto quando: abrir uma porta na vista de jogador revela o outro lado na hora, e os quadros por segundo continuam em 60 com 2 peças e 10 luzes.
Commit: player vision

### 7.2b — Explorado e névoa com memória em esboço  ✅
Objetivo: o que já foi visto fica no mapa como esboço a nanquim sobre papel; o nunca visto é fundo.
Depende de: 7.2a, 7.1b
Ler: `docs/ARQUITETURA.md` §5.6; `src/domain/mapa.ts` (`Memoria`: `sketch`, `paper`, `ink`); `spikes/estilos/src/assar.js` e `main.js` (a camada `memoria` do protótipo); `src/domain/celulas.ts` (`unir`).
Arquivos: criar `src/render/memoria.ts`; mudar `src/domain/nevoa.ts`, `src/state/comandos.ts`, `src/render/nevoa.ts`, `src/render/cena.ts`, `src/ui/Inspetor.tsx`, `tests/unit/nevoa.test.ts`.
Como:
1. `peca.mover` de peça de jogador une `celulasVisiveis` do documento resultante a `session.explored` (cria com `res: RES_NEVOA` se for `null`). Abrir uma porta também (a 7.3a chama a mesma função `explorarAgora(m)`).
2. Comandos `sessao.esquecer` (zera o explorado; "Recomeçar a exploração" na aba Mapa, com confirmação) e `sessao.revelar { ids }` / `sessao.ocultar { ids }` (cômodos inteiros entram e saem de `session.revealed`; um cômodo revelado conta como explorado).
3. `render/memoria.ts`: uma textura assada do mapa em esboço — fundo `memory.paper`, contorno dos cômodos e paredes a traço de `memory.ink` (largura variando por ruído), portas como vão, objetos fixos (`blocks.move`) só no contorno; peças, luzes e objetos soltos não aparecem. Refaz com debounce quando mudam cômodos, paredes, aberturas ou objetos.
4. Vista de jogador: visível = cena; explorado fora do visível = memória (máscara do explorado, ampliada com suavização); resto = fundo. `memory.sketch: false` desenha o explorado como a cena escurecida a 35%, sem esboço.
Não fazer: animação de revelar (7.2c).
Testes: unitários: mover acumula e nunca encolhe o explorado; desfazer o movimento devolve o explorado de antes; `sessao.revelar` de um cômodo faz as células dele contarem como exploradas. e2e: andar com a peça por dois cômodos e voltar: o primeiro aparece em esboço; captura `test-results/fase7-memoria.png`.
Pronto quando: a captura mostra visível em cor, memória em esboço e o nunca visto em fundo, sem costura entre eles.
Commit: explored memory as sketch

### 7.2c — Revelação animada e telhados  ✅
Objetivo: o que entra na vista ganha cor aos poucos; o que sai desbota em esboço; telhados cobrem cômodos até alguém entrar.
Depende de: 7.2b
Ler: `src/render/nevoa.ts`, `memoria.ts`; `src/domain/mapa.ts` (`Comodo.roof`); `src/ui/Inspetor.tsx` (`CamposDoComodo`); `src/procedural/materiais.ts` (materiais de telhado, se houver; senão use os de terreno/pedra).
Arquivos: mudar `nevoa.ts`, `cena.ts`, `Inspetor.tsx`; criar `src/render/telhados.ts`.
Como:
1. A máscara do visível é suavizada no tempo: cada quadro, a máscara exibida caminha até a nova (subindo em 0,5 s, descendo em 1,2 s). O efeito "tinta escorrendo" do Ilustrado é a borda com ruído durante a subida. Movimento reduzido: troca imediata.
2. Telhados: `roof.material` não nulo e `roof.visible` → na vista de jogador e no projetor, o cômodo é coberto pelo material de telhado até uma peça de jogador estar dentro dele; ao entrar, o telhado some com fade de 0,4 s; ao sair, volta. O mestre vê o telhado a 25% com contorno.
3. Inspetor do cômodo: "Telhado" (material ou nenhum) e "Telhado visível".
Não fazer: telhado de várias águas, beirais, sombras projetadas do telhado.
Testes: e2e: peça entra num cômodo com telhado e ele some (o brilho do ponto central muda); captura no meio da revelação mostra o meio-termo.
Pronto quando: entrar e sair de um cômodo anima a revelação e o telhado.
Commit: animated reveal and roofs

### 7.3a — Portas na sessão  ✅
Objetivo: abrir, fechar, trancar e revelar portas na sessão, por clique ou pela peça ao lado.
Depende de: 7.0a, 7.2a
Ler: `src/ui/CartaoContextual.tsx` (ações da abertura); `src/state/comandos-construir.ts` (`abertura.atualizar`); `src/domain/nevoa.ts` (`explorarAgora`).
Arquivos: mudar `CartaoContextual.tsx`, `src/app/acoes.ts`, `src/render/viewport.ts`, `src/render/cena.ts`, `src/app/app.ts`.
Como:
1. Sessão: clicar numa porta alterna aberta/fechada (`abertura.atualizar { state }`, rótulos "Abrir a porta"/"Fechar a porta") e chama `explorarAgora`. Trancada: não abre; toast "Trancada" e som de trinco (a 7.6b faz os sons; até lá, o `erro`).
2. Cartão da porta na sessão: abrir/fechar, trancar/destrancar; para `secret`: "Revelar aos jogadores" (`sessao.revelar { ids: [id] }`).
3. Com uma peça selecionada, `Enter` interage com a porta ou o interagível mais perto a até 1,2 m da peça (o que estiver à frente dela, se houver dois). `Espaço` não serve: já é o arrastar da vista.
4. Secretas não reveladas aparecem como parede comum na vista de jogador (e somem da projeção: 7.5a).
5. Revelar emite o fato `atlas.revelado { mapa, alvo }` no barramento (`servicos.barramento?.emitir`).
Não fazer: chaves e quem tem a chave.
Testes: e2e: na sessão, clicar abre a porta e a vista de jogador passa a ver o outro lado; trancada não abre; porta secreta não aparece como porta na vista de jogador até revelar; `Enter` com a peça ao lado abre.
Pronto quando: os testes passam.
Commit: doors in session
Nota: a função se chama `exploradoAgora` (não `explorarAgora`); abrir/fechar/trancar/revelar rodam numa transação com o comando novo `sessao.explorar` (uma entrada de histórico). `sessao.revelar` passou a aceitar também o id de uma abertura. Uma secreta que se abre é revelada junto; uma secreta aberta e não revelada continua parede para a visão (`secretaOculta` em `domain/nevoa.ts`) e não é desenhada na vista de jogador. O alcance é até o vão da porta, não até o centro (`domain/interacao.ts`, que a 7.6a estende com os interativos). O ref do fato é `atlas:abertura/<mapa>/<id>` e `atlas.revelado` entrou no `emite` do `mesa.json`. Clicar numa porta a abre e a seleciona; Shift+clique só seleciona.

### 7.3b — Régua em quadrados  ✅
Objetivo: medir distâncias em quadrados e metros, como na mesa.
Depende de: 7.0a
Ler: `src/render/viewport.ts` (sobreposições, `selecaoG`); `src/render/pincel.ts`.
Arquivos: criar `src/domain/regua.ts`, `tests/unit/regua.test.ts`; mudar `pincel.ts`, `viewport.ts`, `src/app/acoes.ts`, `src/ui/Icone.tsx`.
Como:
1. `regua.ts`: `distanciaEmQuadrados(de, para, tamanho, regra: 'simples' | 'alternada'): number` (simples: diagonal vale 1, como Chebyshev; alternada: 1, 2, 1, 2…) e `pontosDaRegua` (células cruzadas, para pintar).
2. Ferramenta `regua` (atalho `R` só na sessão; em Construir o `R` continua sendo região), nas duas vistas. Arrastar desenha a linha, pinta levemente as células e mostra "6 quadrados · 9 m"; cliques intermediários fazem pontos de dobra; Esc limpa. Não mexe no documento.
3. A regra das diagonais fica numa preferência local ("Diagonal: simples / alternada") na aba Mapa.
Não fazer: régua no projetor (a 7.5b decide se mostra a régua do mestre; nesta fase, não mostra).
Testes: unitários das duas regras; e2e: medir 4 células em reta mostra "4 quadrados".
Pronto quando: os testes passam.
Commit: ruler in squares
Nota: o clique intermediário vale quando não há arrasto: arrastar começa uma régua nova do ponto apertado, um clique acrescenta uma dobra, e com um ponto só a régua segue o ponteiro até o próximo clique. A regra alternada soma trecho a trecho (não continua a contagem 1, 2, 1, 2 entre dobras). Trocar de ferramenta também limpa a régua. A preferência "Diagonal" fica no `localStorage` (`atlas:regua-diagonal`).

### 7.3c — Iniciativa  ✅
Objetivo: ordem de iniciativa no documento, com rodadas, passo à frente e atrás.
Depende de: —
Ler: `Tabletop/src/domain/initiative.js` inteiro; `src/domain/mapa.ts` (`Sessao.initiative`); `src/state/comandos.ts` (`remover` já poda a iniciativa).
Arquivos: criar `src/domain/iniciativa.ts`, `tests/unit/iniciativa.test.ts`; mudar `src/state/comandos.ts`.
Como:
1. Porte as funções para TypeScript com nomes em português (`ordenar`, `iniciar`, `passo`, `definirValor`, `podar`), mantendo o comportamento (empate pela ordem de entrada; rodada sobe ao passar do último).
2. Comandos: `iniciativa.iniciar { entradas: { tokenId; value }[] }`, `iniciativa.passo { passo: 1 | -1 }`, `iniciativa.valor { tokenId; value }`, `iniciativa.encerrar`. Rótulos em português.
Não fazer: interface (7.4c); rolar os dados (é da Ficha).
Testes: os do Tabletop adaptados (ordem, empate, rodada, passo para trás na primeira posição, podar ao remover peça).
Pronto quando: testes passam.
Commit: initiative
Nota: `remover` (comandos.ts) passou a usar `podar`, que devolve `null` quando ninguém sobra.

### 7.4a — Dock: clima ao vivo  ⬜
Objetivo: na sessão, trocar o clima, ajustar quanto dura a transição e soltar um relâmpago sem abrir o inspetor.
Depende de: 7.0a
Ler: `src/ui/Inspetor.tsx` (`SeletorDeClima`); `src/app/app.ts` (`aplicarClima`); `src/render/viewport.ts` (`DURACAO_DA_TRANSICAO`, `relampagoAgora`); `docs/INTERFACE.md` (dock flutuante).
Arquivos: criar `src/ui/Dock.tsx`; mudar `Editor.tsx`, `viewport.ts`, `src/app/app.ts`, `estilo.css`.
Como:
1. `Dock` só no modo Sessão, flutuando no pé da área do mapa, em pílulas como na Ficha: climas (os predefinidos e os salvos do mapa, com a amostra de cor), "Relâmpago", duração da transição (1, 3, 8, 20 s; preferência local).
2. `viewport.definirDuracaoDaTransicao(ms)` no lugar da constante.
3. O dock tem seções recolhíveis; esta tarefa faz a de clima. A 7.4b e a 7.4c acrescentam as outras.
Não fazer: eventos de cena; iniciativa.
Testes: e2e: na sessão, clicar "Noite" no dock muda o clima com a transição escolhida (o meio da transição de 3 s fica entre os dois brilhos).
Pronto quando: o teste passa.
Commit: session dock with live climate

### 7.4b — Dock: eventos de cena e presença  ⬜
Objetivo: efeitos curtos de cena (tremor, piscar das luzes, escurecer, clarão) e a intensidade das presenças, ao vivo.
Depende de: 7.4a
Ler: `src/render/viewport.ts` (câmera, `relampagoAgora`); `src/render/mapa-de-luz.ts` (piscar do apagão, 4.3a); `src/render/presenca.ts`; `src/ui/Inspetor.tsx` (seção Presença).
Arquivos: criar `src/render/eventos-de-cena.ts`; mudar `Dock.tsx`, `viewport.ts`, `mapa-de-luz.ts`.
Como:
1. `EVENTOS_DE_CENA`: `tremor` (câmera sacode 0,8 s), `piscar` (as luzes do mapa piscam 1,5 s), `escurecer` (ambiente cai a 30% por 4 s e volta), `clarao` (branco rápido). São do render, não do documento; o projetor recebe o mesmo evento na 7.5b.
2. Dock, seção "Cena": um botão por evento; seção "Presença": cada presença do mapa com um controle deslizante de intensidade. Arrastar é um gesto (uma entrada de histórico, comando `item.atualizar` em `presence`), e a presença cresce ou recolhe ao vivo enquanto arrasta (resolve a pendência da 4.6 sobre arrastar a intensidade).
3. Movimento reduzido: o tremor vira um clarão curto.
Não fazer: eventos com som (o Jukebox é da 9.4).
Testes: e2e: arrastar a intensidade de uma presença de 0 a 1 é uma entrada de histórico; `tremor` não muda o documento.
Pronto quando: os testes passam.
Commit: scene events and live presence

### 7.4c — Dock: iniciativa  ⬜
Objetivo: montar e conduzir a iniciativa pelo dock, com a faixa de retratos.
Depende de: 7.3c, 7.4a, 7.1a
Ler: `src/domain/iniciativa.ts`; `Tabletop/src/ui/initiative-panel.js` (`initiativeStrip`).
Arquivos: mudar `Dock.tsx`, `estilo.css`; criar `src/ui/FaixaDeIniciativa.tsx`.
Como:
1. Seção "Iniciativa": "Começar" com as peças selecionadas (ou todas), campo de valor por peça, "Começar" executa `iniciativa.iniciar`. Durante: faixa de retratos na ordem, o atual em destaque, rodada, botões ‹ › (`iniciativa.passo`), editar valor, "Encerrar".
2. A peça da vez ganha um anel pulsante no mapa (render, pela `session.initiative`).
3. A `FaixaDeIniciativa` é o mesmo componente que o projetor usa (7.5b).
Não fazer: rolar dados.
Testes: e2e: começar com duas peças, passar a vez duas vezes sobe a rodada; encerrar limpa.
Pronto quando: o teste passa.
Commit: initiative in the dock

### 7.5a — Projeção filtrada  ⬜
Objetivo: dado o mapa, o mapa que os jogadores podem ver, sem nada do mestre.
Depende de: 7.0b
Ler: `src/domain/mapa.ts` inteiro; `src/domain/nevoa.ts` (se já existir; senão, só o `session`).
Arquivos: criar `src/domain/projecao.ts`, `tests/unit/projecao.test.ts`.
Como:
1. `projetarParaJogadores(m: MapaAtlas): MapaAtlas`, pura, sem mudar `m`:
   - zera `notes`, `comodosExtra` (inteiro), `refs` de regiões, `audioCue`, `climateAudio`, `customClimates`;
   - tira regiões `gmOnly` e presenças `gmOnly`;
   - porta `secret` não revelada: remove a abertura (a parede fica contínua);
   - peças que não são de jogador e estão fora do visível: removidas (o projetor nunca recebe a posição delas);
   - interagíveis: tira `clue` de quem não foi revelado.
2. O resultado é um `MapaAtlas` válido (`validarMapa`).
3. `CAMPOS_DO_MESTRE` documentado no topo do arquivo, para quem acrescentar campos no futuro lembrar daqui.
Não fazer: render; canal.
Testes: com `mapaCompleto()` mais uma região `gmOnly`, uma porta secreta, uma presença `gmOnly` e um inimigo fora da vista: nada disso aparece no JSON da projeção (procure as strings), e o resultado valida. A porta secreta revelada aparece.
Pronto quando: testes passam.
Commit: filtered player projection

### 7.5b — Janela de projetor  ⬜
Objetivo: uma segunda janela, para a TV ou o projetor, mostra só a projeção, com a câmera que o mestre publica e a moldura do tema.
Depende de: 7.5a, 7.2b, 7.4c
Ler: `Tabletop/src/app/presentation-window.js` (estrutura, mensagens, tela cheia); `src/app/rotas.ts`; `src/render/viewport.ts` (`criarViewport`, `PonteViewport`); `src/app/tema.ts`.
Arquivos: criar `src/app/projetor.ts`, `src/ui/Projetor.tsx`; mudar `rotas.ts`, `src/ui/App.tsx`, `src/render/viewport.ts` (modo somente leitura), `src/render/cena.ts` (vista de projetor: sem marcadores de luz, regiões, grade de edição, seleção), `src/app/acoes.ts`, `Dock.tsx`, `mesa.json` (rota nova, se fizer sentido no manifesto).
Como:
1. Rota `#/projetor/{mapaId}`. A página não abre o repositório nem edita: espera mensagens em `BroadcastChannel('atlas:projetor:<mapaId>')`.
2. Mensagens do mestre: `{ tipo: 'estado'; doc: MapaAtlas /* já projetado */; versao }` (a cada mudança, com debounce de 100 ms), `{ tipo: 'camera'; caixa }`, `{ tipo: 'evento'; nome }` (7.4b), `{ tipo: 'relampago' }`. O projetor responde `{ tipo: 'ola' }` ao abrir, e o mestre manda o estado completo.
3. Câmera publicada: no modo Sessão, "Projetor" no dock abre a janela e mostra um retângulo da câmera do projetor no mapa do mestre; o mestre arrasta e redimensiona o retângulo, ou liga "Seguir os jogadores" (enquadra a caixa das peças de jogador com margem). A câmera de trabalho do mestre não muda.
4. A janela do projetor: viewport em vista de jogador, sem nenhuma sobreposição de editor, com transição de câmera suave; moldura do tema (faixa rasgada no acento, título do mapa); faixa de iniciativa quando houver; botão de tela cheia que some depois de 3 s parado.
5. O áudio não toca no projetor.
Não fazer: régua do mestre no projetor; vários projetores.
Testes: e2e com duas páginas no mesmo contexto: abrir o projetor, conferir que o documento recebido não contém notas, região `gmOnly` nem a porta secreta; mover uma peça de jogador e o projetor revelar; trocar o clima e o projetor acompanhar; o projetor não tem `[data-testid="biblioteca"]` nem inspetor.
Pronto quando: os testes passam e o projetor fica em 60 quadros por segundo junto com o editor aberto.
Commit: projector window

### 7.6a — Interagíveis: interruptor e gaveta  ⬜
Objetivo: um interruptor acende e apaga as luzes do cômodo; uma gaveta abre e fecha.
Depende de: 7.0b, 7.3a
Ler: `src/domain/mapa.ts` (`Objeto.interaction`); `src/ui/Inspetor.tsx` (`CamposDoObjeto`); `src/procedural/receitas/` (para uma receita de interruptor, de parede).
Arquivos: criar `src/domain/interagiveis.ts`, `tests/unit/interagiveis.test.ts`; mudar `src/state/comandos.ts`, `Inspetor.tsx`, `src/app/acoes.ts`, `src/render/viewport.ts`, uma receita nova `interruptor` (objeto de parede pequeno).
Como:
1. `interagiveis.ts`: `alvosDoInterruptor(m, objeto): string[]` (os `targets`, ou as luzes de rede do cômodo); comando `interagir { id }` que alterna `interaction.on` e, no interruptor, liga ou desliga os alvos (`on` das luzes) numa entrada só ("Interruptor").
2. Inspetor do objeto (Construir): "Interação" (nenhuma, interruptor, gaveta); no interruptor, a lista das luzes que ele controla (padrão: as de rede do cômodo).
3. Sessão: clicar num interagível, ou `Enter` com a peça ao lado (7.3a), chama `interagir`. Um ícone pequeno sobre o objeto marca que ele é interativo (só para o mestre).
4. Apagão: interruptor ligado não acende luz de rede sem energia (o clima manda).
Não fazer: pistas (9.3); som (7.6b).
Testes: unitários: interruptor sem alvos controla as luzes de rede do cômodo e não as de fogo; desfazer volta as luzes; e2e: na sessão, clicar no interruptor apaga a sala.
Pronto quando: os testes passam.
Commit: switches and drawers

### 7.6b — Sons dos interagíveis  ⬜
Objetivo: porta rangendo, porta batendo, trinco, interruptor e gaveta, cada um com som próprio.
Depende de: 7.3a, 7.6a
Ler: `src/fx/som.ts` (`tocar`, `trovao`: síntese com Web Audio); `docs/ARQUITETURA.md` §8.1.
Arquivos: mudar `src/fx/som.ts`, `src/app/app.ts` (ou onde a sessão chama as ações).
Como:
1. Sons novos sintetizados em `som.ts`: `porta-abrir` (rangido: oscilador com frequência variando por ruído, 0,7 s), `porta-fechar` (batida grave e curta), `trancada` (dois cliques metálicos), `interruptor` (clique seco), `gaveta` (atrito de ruído filtrado, 0,4 s). Variação pequena a cada toque (altura ± 5%).
2. As ações de sessão tocam o som do tipo. O `som: Ref` da abertura ou do interagível, quando houver, **não** é tocado ainda (fica para a 9.4d); anote no código.
3. Respeita o liga e desliga dos sons e o volume geral.
Não fazer: arquivos de som; Jukebox.
Testes: unitário de que cada nome novo existe e `tocar` não lança sem `AudioContext` (ambiente de teste).
Pronto quando: abrir, fechar, trancar, interruptor e gaveta soam diferentes e não cansam depois de dez vezes.
Commit: interaction sound effects

### 7.7 — Validação da fase  ⬜
Objetivo: provar o critério de pronto e registrar o relatório.
Depende de: todas
Ler: `tests/e2e/fase5.test.ts`, `fase6.test.ts` (modelo); `tests/e2e/apoio.ts`.
Arquivos: criar ou completar `tests/e2e/fase7.test.ts`; mudar `progress.md`.
Como:
1. e2e `fase 7: jogar a casa no projetor`: a casa da Fase 5 (ou da 6) com duas peças de jogador, uma porta secreta com nota do mestre atrás, uma região `gmOnly`, um inimigo num cômodo fechado e um interruptor. Modo Sessão; abrir o projetor; andar com as duas peças, abrir portas, trocar o clima pelo dock (Tarde → Tempestade → Noite), revelar um cômodo, usar o interruptor, iniciativa de duas rodadas.
2. Em cada passo, conferir na página do projetor: o documento recebido nunca contém as notas, a região, a porta secreta antes de revelada, nem o inimigo antes de visto; o brilho do cômodo nunca visto é o do fundo. Capturas `test-results/fase7-projetor-*.png`.
3. Medir quadros por segundo das duas janelas com tempestade e as duas peças andando.
4. progress.md: resumo da fase e "Próximo: Fase 8".
Não fazer: consertar lógica aqui; o que faltar vira pendência.
Testes: os acima, mais `npm run typecheck`, `npm test`, `npm run test:e2e`.
Pronto quando: tudo passa e o relatório está no progress.md.
Commit: validate phase 7
