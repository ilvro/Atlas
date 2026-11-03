# Fase 5 — Construção inteligente

"O assistente lê o que o mestre fez e sugere o próximo passo." Critério de pronto da fase (ROADMAP): pintar três cômodos, nomear as funções e aceitar as sugestões gera uma casa jogável que o mestre ajusta, não refaz.

Detalhado em 3 de novembro de 2026, contra o código do fim da Fase 4. Faça na ordem da tabela; cada tarefa depende das anteriores do mesmo grupo.

## Decisões já tomadas (não rediscutir na implementação)

- **Assistente, não presets.** Uma proposta só **acrescenta**: nunca move, remove nem altera o que o mestre pôs (objetos, luzes, portas). A única coisa existente que uma proposta pode trocar é o piso e o papel de um cômodo, e só quando o par atual é exatamente o de um `TIPOS_DE_COMODO` (ou seja, o mestre não escolheu à mão). O que já existe no cômodo conta: se já há uma cama, a proposta não põe outra.
- **Código em `src/authoring/`**, puro: importa `src/domain`, `src/procedural/receitas.ts` e `materiais.ts` (dados puros) e **tipos** de `src/state`. Nunca importa render, UI, app nem Pixi. Testes em `tests/unit/`.
- **Proposta** = `{ id, tipo, rotulo, comandos, versaoEsperada, roomId, semente }`. Aceitar executa o comando novo `proposta.aceitar { rotulo, comandos }` por `store.executar(…, { rotulo, versaoEsperada })`: **uma** entrada de histórico, e a recusa por versão já existe no store ("O mapa mudou; gere a sugestão novamente.").
- **Determinismo:** todo gerador recebe `semente` e uma função `gerarId` (padrão `novoIdEntidade`). Mesmo documento + mesma semente = mesma proposta (a não ser pelos ids). "Gerar de novo" é `semente + 1`.
- **Malha fina de 0,25 m** (`RES_MALHA`) para ocupação e circulação, porque a célula do cômodo (1,5 m) é grossa demais para móveis.
- **Rotação dos objetos:** nas receitas, o "fundo" do móvel (encosto, cabeceira) fica em −y local. Encostar na parede de normal para dentro `n` é `rotation = atan2(-n[0], n[1])` (parede de cima → 0). Confirme com um teste antes de usar.
- **Gênero do mapa** vai para o documento (v4, `style.genre`), com um catálogo pequeno: `investigacao` (padrão, o acervo atual), `moderno` e `fantasia`. Um id desconhecido vale como `investigacao`, para a Fase 6 poder acrescentar gêneros sem migrar. Com só 22 receitas, o gênero muda sobretudo materiais, paleta e luzes; a mobília muda pouco até o acervo da Fase 6.
- **Uma pílula por vez**, no cômodo em foco. Dispensar vale para aquele tipo de sugestão naquele cômodo até fechar o mapa (memória da sessão, não do documento). Sugestões podem ser desligadas (preferência local, como o "Ver atmosfera no editor").
- **Prioridade das sugestões** num cômodo: função → porta → mobiliar → luz. Só a primeira que se aplica aparece.
- As transições automáticas entre terrenos (antiga 5.4a) já foram feitas nas pendências da Fase 3 (borda com ruído e aro). Saíram desta lista.

## Tarefas

| # | Tarefa | Tipo |
| --- | --- | --- |
| 5.0 | Documento v4: gênero do mapa | domínio + interface |
| 5.1a | Insight do cômodo | authoring |
| 5.1b | Malha e circulação livre | authoring |
| 5.1c | Função provável | authoring |
| 5.2a | Proposta e `proposta.aceitar` | authoring + estado |
| 5.2b | Fantasma da proposta | render |
| 5.2c | Pílula de sugestão (primeira sugestão: função) | app + interface |
| 5.3a | Regras de mobília | dados |
| 5.3b | Gerador de layout | authoring |
| 5.3c | Materiais, paleta e a sugestão "Mobiliar" | authoring + app |
| 5.4a | Regras de espalhamento | authoring |
| 5.4b | Pincel de espalhar | ferramenta + interface |
| 5.5a | Portas entre vizinhos e porta de entrada | authoring + app |
| 5.5b | Luzes pela função | authoring + app |
| 5.6 | Validação da fase | e2e + relatório |

---

### 5.0 — Documento v4: gênero do mapa  ⬜
Objetivo: o mapa guarda o gênero (`style.genre`), e o mestre o escolhe na aba Mapa.
Depende de: —
Ler: `src/domain/mapa.ts` (`Estilo`, `VERSAO_MAPA`, `criarMapa`); `src/domain/migracoes.ts` (`de2para3` como modelo); `src/domain/validacao.ts` (linha do `style`); `src/ui/Inspetor.tsx` (`PainelDoMapa`).
Arquivos: mudar `src/domain/mapa.ts`, `src/domain/migracoes.ts`, `src/domain/validacao.ts`, `src/domain/presets.ts`, `src/ui/Inspetor.tsx`, `tests/unit/dominio.test.ts`.
Como:
1. `Estilo` ganha `genre: string`; `VERSAO_MAPA = 4`; `criarMapa` põe `genre: 'investigacao'`.
2. `de3para4`: `style.genre = 'investigacao'` quando falta. Registre na tabela de migrações.
3. Validação: `genre: e.texto({ min: 1, max: 40 })`.
4. Em `presets.ts`: `export interface Genero { id: string; nome: string; descricao: string }`, `GENEROS` com `investigacao` ("Investigação: casa antiga, lamparinas, damasco"), `moderno` ("Moderno: lâmpadas, cores claras"), `fantasia` ("Fantasia: velas, tochas, pedra e madeira") e `generoDe(id): Genero` que cai em `investigacao` para id desconhecido.
5. Aba Mapa, seção Mapa: `CampoOpcoes` "Gênero" executando `estilo.atualizar { genre }` com rótulo "Gênero do mapa".
Não fazer: nada que use o gênero (5.3c e 5.5b usam).
Testes: migração 3→4 preenche o gênero; mapa v4 válido; `generoDe('xyz').id === 'investigacao'`.
Pronto quando: testes passam; trocar o gênero na aba Mapa entra no histórico e sobrevive a gravar e recarregar.
Commit: map genre (document v4)

### 5.1a — Insight do cômodo  ⬜
Objetivo: do documento e de um cômodo, saber área, perímetro, portas, janelas, vizinhos, objetos e luzes.
Depende de: —
Ler: `src/domain/geometria.ts` (`arestasDeParede`, `salasDaAbertura`, `pontoNaParede`, `comprimentoDaParede`, `comodoEm`, `caixaDasCelulas`); `src/domain/clima.ts` (`luzesDerivadas`: como descobre a normal para dentro de uma janela); `src/render/selecao.ts` (`tamanhoDoObjeto`).
Arquivos: criar `src/authoring/insight.ts`, `tests/unit/insight.test.ts`; mudar `src/domain/geometria.ts` (só se extrair a normal).
Como:
1. Se a lógica "normal para dentro do cômodo num ponto da parede" de `luzesDerivadas` servir aos dois, extraia para `geometria.ts` como `normalParaDentro(m, parede, at, roomId): Ponto | null` e use nos dois lugares (sem mudar o comportamento da 4.1d).
2. Tipos:
   ```ts
   export interface AberturaDoComodo { id: string; kind: Abertura['kind']; wallId: string; at: number; centro: Ponto; largura: number; /** Aponta para dentro do cômodo. */ normal: Ponto; /** Cômodo do outro lado, ou null (lado de fora). */ outro: string | null }
   export interface VizinhoDoComodo { id: string; /** Metros de parede em comum. */ comprimento: number; /** Há porta, arco ou passagem secreta entre os dois? */ ligado: boolean }
   export interface InsightDoComodo {
     id: string; nome: string; funcao: string | null; celulas: Celula[];
     area: number; perimetro: number; caixa: { x0: number; y0: number; x1: number; y1: number };
     portas: AberturaDoComodo[];   // door, arch, secret
     janelas: AberturaDoComodo[];
     vizinhos: VizinhoDoComodo[]; /** Metros de parede para o lado de fora. */ externo: number;
     objetos: { id: string; receita: string | null; elevation: Objeto['elevation']; caixa: { x0: number; y0: number; x1: number; y1: number } }[];
     luzes: string[];
   }
   export function insightDoComodo(m: MapaAtlas, roomId: string, arestas = arestasDeParede(m)): InsightDoComodo | null
   ```
3. Área e perímetro em metros (células × `grid.size²`; arestas de parede × `grid.size`). Vizinhos e `externo` pelas arestas: `salas` com o cômodo de um lado. Objetos: `roomId === id`. Luzes: `comodoEm(luz.position) === id`, sem as derivadas.
4. A caixa de cada objeto é a pegada (`tamanhoDoObjeto`) girada: para rotação qualquer, use a caixa que envolve o retângulo girado.
Não fazer: circulação (5.1b), função (5.1c).
Testes: sala 4×3 células (grid 1,5) tem área 27 m² e perímetro 21 m; porta entre dois cômodos aparece nos dois, com `outro` trocado e normais opostas; janela externa tem `outro: null`; vizinho sem porta tem `ligado: false` e passa a `true` com um arco; objeto de parede entra em `objetos`; cômodo inexistente devolve `null`.
Pronto quando: testes passam; `src/authoring` não importa render, UI nem app.
Commit: room insight

### 5.1b — Malha e circulação livre  ⬜
Objetivo: saber, numa malha de 0,25 m, o que está ocupado, o que cada porta precisa de livre e por onde se passa entre as portas.
Depende de: 5.1a
Ler: `src/authoring/insight.ts`; `src/domain/celulas.ts`.
Arquivos: criar `src/authoring/malha.ts`, `tests/unit/malha.test.ts`.
Como:
1. ```ts
   export const RES_MALHA = 0.25, LARGURA_DE_PASSAGEM = 0.75;
   export interface Malha { res: number; x0: number; y0: number; colunas: number; linhas: number;
     dentro: Uint8Array; ocupada: Uint8Array; /** Na frente das portas: precisa ficar livre. */ porta: Uint8Array }
   export function malhaDoComodo(m: MapaAtlas, ins: InsightDoComodo): Malha
   export function marcarRetangulo(malha: Malha, caixa: Caixa, camada: 'ocupada' | 'porta', folga?: number): void
   export function retanguloLivre(malha: Malha, caixa: Caixa, evitar: readonly Uint8Array[]): boolean
   ```
   `x0, y0` = canto da caixa do cômodo; `dentro` = sub-célula cujo centro está numa célula do cômodo.
2. `ocupada`: objetos de piso do cômodo com `blocks.move` (tapetes não bloqueiam).
3. `porta`: para cada porta, o quadrado `largura × largura` à frente dela, dos dois lados que estiverem dentro do cômodo.
4. ```ts
   export interface Circulacao { /** Todas as portas se alcançam (ou há uma porta só e ela alcança o meio do cômodo). */ ligada: boolean; /** Portas que não alcançam as outras. */ isoladas: string[]; /** Faixa de passagem: os caminhos entre as portas, alargados para LARGURA_DE_PASSAGEM. */ faixa: Uint8Array }
   export function circulacao(malha: Malha, ins: InsightDoComodo): Circulacao
   ```
   Busca em largura (4 vizinhos) sobre `dentro && !ocupada`, da sub-célula de entrada de cada porta (centro + normal × 0,2) até as outras; com uma porta só, até a sub-célula livre mais perto do centro da caixa. A `faixa` é a união dos caminhos mais curtos, dilatada em `ceil((LARGURA_DE_PASSAGEM / RES_MALHA − 1) / 2)` sub-células.
5. Cômodo sem portas: `ligada: true`, `faixa` vazia.
Não fazer: decidir onde pôr móveis (5.3b).
Testes: cômodo vazio com duas portas está ligado e a faixa liga as duas; um móvel bloqueando de parede a parede separa as portas (`ligada: false`, `isoladas` com uma delas); tapete não bloqueia; a área `porta` fica na frente da porta, do lado de dentro.
Pronto quando: testes passam; uma casa de 3 cômodos de 6 × 4,5 m calcula a malha em menos de 5 ms (meça no teste, sem afirmar o tempo).
Commit: room grid and free circulation

### 5.1c — Função provável  ⬜
Objetivo: dizer para que serve um cômodo pelo nome, pelos objetos ou pelo tamanho, com um grau de confiança.
Depende de: 5.1a
Ler: `src/domain/presets.ts` (`TIPOS_DE_COMODO`: as funções válidas); `src/procedural/receitas.ts` (`funcoes` de cada receita); `src/app/busca.ts` (`normalizar`, sem acento: copie a linha, porque `authoring` não importa `app`).
Arquivos: criar `src/authoring/funcao.ts`, `tests/unit/funcao.test.ts`.
Como:
1. ```ts
   export interface Palpite { funcao: string; confianca: number; motivo: 'nome' | 'objetos' | 'tamanho' }
   export function funcaoProvavel(ins: InsightDoComodo): Palpite | null
   ```
   Só devolve funções que existem em `TIPOS_DE_COMODO[].funcao`.
2. **Nome** (sem acento, minúsculas, por palavras): tabela de sinônimos, das mais específicas para as mais genéricas. Ex.: cozinha/copa → cozinha (0,9); quarto/dormitório/suíte/alcova → quarto; biblioteca → biblioteca; escritório/gabinete/estudo → escritório; banheiro/lavabo/banho/wc → banheiro; corredor/hall/passagem/vestíbulo → corredor; enfermaria/consultório/hospital → hospital; taverna/bar/estalagem/pub → taverna; porão/adega/cripta → porão; estar/jantar/salão → sala (0,9); "sala" sozinha → sala (0,6). Nomes desconhecidos ("ponte de comando", "sala de ritual") não acertam nada pelo nome: "sala de ritual" não vira sala, porque "de" seguido de palavra desconhecida anula o "sala" genérico.
3. **Objetos:** cada objeto de receita vota nas `funcoes` dela (1 / número de funções); sinais fortes valem 3: `cama.*` → quarto, `balcao` → cozinha, `estante`/`estante.piso` → biblioteca, `escrivaninha` → escritório. Confiança = votos do primeiro / total × min(1, objetos / 3).
4. **Tamanho:** caixa com razão ≥ 3 e lado menor ≤ 2 m → corredor (0,5); área ≤ 5 m² → banheiro (0,35).
5. Ordem: nome com confiança ≥ 0,6; senão objetos com ≥ 0,5; senão tamanho; senão `null`.
Não fazer: aplicar a função (a sugestão é da 5.2c).
Testes: por tabela, um caso por linha (`'Cozinha'`, `'Sala de jantar'`, `'Sala 2'`, `'Sala de ritual'`, `'Quarto do Hugo'`, `'Escritório'`, `'Ponte de comando'`, cômodo com duas camas e nome "Cômodo", corredor comprido sem nome útil, banheiro pequeno, cômodo grande vazio → `null`).
Pronto quando: a tabela passa.
Commit: guess room function

### 5.2a — Proposta e `proposta.aceitar`  ⬜
Objetivo: uma lista de comandos que se vê antes, se aceita como uma ação e se recusa se o mapa mudou.
Depende de: —
Ler: `src/state/comandos.ts` (`Comando`, `aplicar`, `aplicarComando`, `ROTULOS`); `src/state/store.ts` (`executar` com `versaoEsperada`).
Arquivos: criar `src/authoring/proposta.ts`, `tests/unit/proposta.test.ts`; mudar `src/state/comandos.ts`.
Como:
1. Em `comandos.ts`: `| { tipo: 'proposta.aceitar'; rotulo: string; comandos: Comando[] }`. Em `aplicar`: lista vazia → `nao('A sugestão está vazia.')`; algum `proposta.aceitar` dentro → `nao(…)`; senão `for (const c of comandos) aplicar(m, c)` no mesmo rascunho. Rótulo padrão "Aceitar sugestão".
2. Em `proposta.ts`:
   ```ts
   export interface Proposta { id: string; tipo: string; rotulo: string; comandos: Comando[]; versaoEsperada: number; roomId: string | null; semente: number }
   export function novaProposta(dados: Omit<Proposta, 'id'>): Proposta
   /** O mapa como ficaria; lança ErroDeComando se a proposta não cabe mais. */
   export function previaDaProposta(m: MapaAtlas, p: Proposta): MapaAtlas
   export function aceitarProposta(store: Store, p: Proposta): MapaAtlas
   ```
   `previaDaProposta` usa `aplicarComando(m, { tipo: 'proposta.aceitar', … })`; `aceitarProposta` chama `store.executar(…, { rotulo: p.rotulo, versaoEsperada: p.versaoEsperada })`.
Não fazer: geradores de proposta; render; interface.
Testes: aceitar três `item.adicionar` cria uma entrada de histórico com o rótulo da proposta, e um desfazer tira os três; com `versaoEsperada` antiga, lança e o mapa não muda; um comando inválido no meio não deixa nada aplicado; prévia não mexe no store.
Pronto quando: testes passam.
Commit: proposals accepted as one action

### 5.2b — Fantasma da proposta  ⬜
Objetivo: o que a proposta acrescenta aparece no mapa, translúcido, antes de aceitar.
Depende de: 5.2a
Ler: `src/render/viewport.ts` (fantasma da ferramenta, ~linhas 209–275: como pede o desenho do objeto ao `baker` com `chaveDoObjeto`; `fantasmaC`; `fxAtivo`); `src/render/selecao.ts` (`caixaDe`); `src/domain/geometria.ts` (`pontoNaParede`).
Arquivos: criar `src/render/fantasma-proposta.ts`; mudar `src/render/viewport.ts`.
Como:
1. `criarFantasmaDeProposta({ baker, acento, efeitos }): { raiz: Container; mostrar(atual: MapaAtlas, previa: MapaAtlas | null): void; quadro(tempo: number): void; contagem(): number; destruir(): void }`.
2. `mostrar` compara as coleções por id: objetos novos → desenho de verdade (mesma fila do baker) com alpha 0,55 e contorno tracejado no acento; objeto de parede novo → traço grosso na face da parede; luz nova → círculo de raio `min(radius, 4)` com alpha 0,12 e o ponto; abertura nova → traço como o fantasma da ferramenta de abertura; cômodo com piso ou papel trocado → contorno das células no acento e preenchimento alpha 0,12. `null` limpa tudo.
3. `quadro`: pulsação suave do alpha (0,45 ↔ 0,7, período 1,6 s); parada com efeitos desligados.
4. No viewport: `raiz` logo depois de `fantasmaC`; API nova `mostrarProposta(previa: MapaAtlas | null)` e `contagemDoFantasma(): number` (para os testes). Se o documento mudar com uma prévia na tela, quem chamou é que recalcula (o viewport não guarda proposta).
Não fazer: decidir quando mostrar (5.2c).
Testes: e2e em `tests/e2e/fase5.test.ts`: montar uma prévia com dois objetos e uma luz por `__atlas.viewport().mostrarProposta(…)` e conferir `contagemDoFantasma() === 3`; `null` volta a 0; nenhum erro de console. Os e2e das fases 2 a 4 continuam passando.
Pronto quando: a prévia aparece translúcida no lugar certo e some com `null`.
Commit: proposal ghost preview

### 5.2c — Pílula de sugestão  ⬜
Objetivo: junto ao cômodo em foco, uma pílula discreta oferece a próxima sugestão: aceitar, outra, dispensar. A primeira sugestão é a função.
Depende de: 5.1c, 5.2b
Ler: `src/ui/CartaoContextual.tsx` (como segue o item na tela); `src/app/sessao.ts`; `src/app/app.ts` (onde a sessão é criada, `acabamentoLigado` como modelo de preferência local, `aoColocar`); `src/app/acoes.ts`; `src/app/toasts.ts`; `docs/INTERFACE.md` ("Sugestões no fluxo").
Arquivos: criar `src/authoring/sugestoes.ts`, `src/app/sugestoes.ts`, `src/ui/PilulaDeSugestao.tsx`, `tests/unit/sugestoes.test.ts`; mudar `src/ui/Editor.tsx`, `src/app/app.ts`, `src/app/acoes.ts`, `src/ui/Inspetor.tsx`, `src/ui/estilo.css`.
Como:
1. `src/authoring/sugestoes.ts` (puro):
   ```ts
   export interface Contexto { m: MapaAtlas; versao: number; semente: number; gerarId?: (prefixo: string) => string }
   export interface TipoDeSugestao { tipo: 'funcao' | 'porta' | 'mobiliar' | 'luz'; /** Texto da pílula, ou null se não se aplica a este cômodo. */ texto(c: Contexto, roomId: string): string | null; gerar(c: Contexto, roomId: string): Proposta | null }
   export const TIPOS_DE_SUGESTAO: TipoDeSugestao[]   // em ordem de prioridade
   export function proximaSugestao(c: Contexto, roomId: string, dispensadas: ReadonlySet<string>): Proposta | null
   ```
   A chave de dispensa é `${tipo}:${roomId}`. Nesta tarefa só entra `funcao`: aplica-se quando `funcaoProvavel` vem do **nome** com confiança ≥ 0,6 e é diferente de `room.function`. Texto "Usar como Cozinha?" (nome do `TIPOS_DE_COMODO`). A proposta faz `comodo.atualizar { function }` e, se o par piso/papel atual for o de algum tipo de cômodo, troca também piso e papel pelos do tipo novo (mantendo as sementes).
2. `src/app/sugestoes.ts`: `sugestao = signal<Proposta | null>`, `sugestoesLigadas` (localStorage, como `acabamentoLigado`), `iniciarSugestoes(s): () => void` chamado onde a sessão é criada e desfeito ao fechar. Ele assina o store e recalcula 300 ms depois de eventos `executar`, `concluir`, `desfazer` e `refazer` (nunca durante gesto). Cômodo em foco: o único cômodo selecionado; senão o último id de `mudancas.colecoes.rooms` que ainda existe; senão o foco anterior. Ações: `aceitarSugestao()` (toca `pop`, toast "Sugestão aceita: <rótulo>" com Desfazer, recalcula), `outraSugestao()` (mesmo tipo, `semente + 1`), `dispensarSugestao()`. Sempre que `sugestao` muda, chama `viewport.atual?.mostrarProposta(previa ou null)`; se a prévia lançar, a sugestão some.
3. `PilulaDeSugestao`: ancorada no topo da caixa do cômodo (mesmo laço de `requestAnimationFrame` do cartão; abaixo do cômodo se o cartão contextual estiver no mesmo cômodo). Texto clicável aceita; botão ↻ "Outra"; botão ✕ "Agora não". Some com gesto em andamento, paleta ou menu radial abertos, e com `sugestoesLigadas` falso. `data-testid`: `pilula`, `pilula-aceitar`, `pilula-outra`, `pilula-dispensar`.
4. Paleta de comandos: "Aceitar a sugestão", "Outra sugestão", "Dispensar a sugestão", "Ligar ou desligar sugestões". Aba Mapa: caixa "Sugestões do assistente".
5. CSS: pílula com a identidade da interface (fundo do painel, borda no acento, entrada animada curta, respeitando movimento reduzido).
Não fazer: outros tipos de sugestão (5.3c, 5.5a, 5.5b).
Testes: unitário de `proximaSugestao` (renomear "Sala 2" para "Cozinha" sugere cozinha e troca piso e papel; com piso escolhido à mão, troca só a função; dispensada não volta; cômodo com função já certa não sugere nada). e2e: pintar um cômodo, renomear para "Cozinha" no inspetor, a pílula aparece com o fantasma; aceitar muda função, piso e papel em uma entrada de histórico; desfazer volta; dispensar some e não volta.
Pronto quando: o fluxo do e2e funciona sem erros de console.
Commit: suggestion pill with room function

### 5.3a — Regras de mobília  ⬜
Objetivo: para cada função, que móveis um cômodo costuma ter, onde ficam e quantos, em dados puros.
Depende de: —
Ler: `src/procedural/receitas.ts` (ids, `funcoes`, `pegada`, `campos`); `src/domain/presets.ts` (`TIPOS_DE_COMODO`, `GENEROS`).
Arquivos: criar `src/authoring/regras-mobilia.ts`, `tests/unit/regras-mobilia.test.ts`.
Como:
1. ```ts
   export type Lugar = 'parede' | 'canto' | 'centro' | 'junto' | 'na-parede';
   export interface ItemDeRegra {
     id: string; /** Alternativas; o gerador sorteia pela semente. */ receitas: string[]; lugar: Lugar;
     quantos: [min: number, max: number]; /** Abaixo disso, o item não entra. */ areaMinima?: number;
     prioridade: number; /** Para 'junto': ao redor de que item (id da regra) e como. */ junto?: { de: string; modo: 'ao-redor' | 'ao-lado' | 'em-frente' };
     /** Não fica na frente de janela. */ alto?: boolean; params?: Record<string, unknown>;
   }
   export const REGRAS_DE_MOBILIA: Readonly<Record<string, ItemDeRegra[]>>
   export const VARIACOES_DE_GENERO: Readonly<Record<string, { trocar?: Record<string, string[]>; sem?: string[] }>>
   export function regrasPara(funcao: string, genero: string): ItemDeRegra[]
   ```
2. Uma regra para cada função de `TIPOS_DE_COMODO` (sala, cozinha, quarto, biblioteca, escritório, banheiro, corredor, hospital, taverna, porão), **só com receitas que existem**. Exemplos do espírito: quarto = cama (casal se área ≥ 12 m², senão solteiro) na parede, prioridade 1, `alto: false`; mesinha `junto` da cama `ao-lado`; armário/cômoda na parede, `alto` para o armário; tapete no centro; quadro ou espelho `na-parede`. Sala = sofá na parede; poltrona `em-frente`; mesinha `junto` do sofá; tapete no centro; aparador ou estante na parede; vaso no canto; quadro na parede. Cozinha = balcão na parede (o mais comprido possível); mesa no centro; cadeiras `ao-redor` da mesa (2 a 4). Biblioteca = estantes de parede e estante baixa; poltrona; mesa redonda; pilhas de livros. Taverna = mesas com bancos ou cadeiras ao redor, balcão. Porão = caixotes nos cantos e na parede. Corredor = aparador, vaso, quadro. Banheiro = balcão com pia, espelho na parede.
3. Gênero: `fantasia` troca cadeira por banco na taverna e na cozinha e tira o sofá da sala (vira bancos e poltrona); `moderno` tira as estantes de parede do quarto; `investigacao` não muda nada.
Não fazer: posicionar (5.3b); materiais (5.3c).
Testes: toda receita citada existe e é do tipo certo (`na-parede` só com receitas `tipo: 'parede'`); toda função de `TIPOS_DE_COMODO` tem regra; todo `junto.de` aponta para um item da mesma regra com prioridade menor; `regrasPara('taverna', 'fantasia')` não tem cadeira.
Pronto quando: testes passam.
Commit: furnishing rules by function and genre

### 5.3b — Gerador de layout  ⬜
Objetivo: dado um cômodo e as regras, as posições dos móveis que faltam, encostados na parede, sem tampar porta nem passagem.
Depende de: 5.1b, 5.3a
Ler: `src/authoring/insight.ts`, `malha.ts`, `regras-mobilia.ts`; `src/domain/geometria.ts` (`contornoDoComodo`, `encaixarObjetoDeParede`, `motivoDeNaoCaber` como modelo para objetos de parede); `src/domain/fabrica.ts` (`novoObjeto`); `src/procedural/receitas.ts` (`pegadaDaReceita`, `mulberry32` em `ruido.ts`).
Arquivos: criar `src/authoring/layout.ts`, `tests/unit/layout.test.ts`.
Como:
1. ```ts
   export interface PedidoDeLayout { roomId: string; funcao: string; genero: string; semente: number; gerarId?: (p: string) => string; /** Parâmetros por receita (a paleta da 5.3c). */ params?: (receita: string) => Record<string, unknown> }
   export interface Layout { objetos: Objeto[]; /** Ids de itens da regra que não couberam. */ faltaram: string[] }
   export function gerarLayout(m: MapaAtlas, pedido: PedidoDeLayout): Layout
   ```
2. Começa da malha (5.1b) e da faixa de circulação, que ficam proibidas para móveis que bloqueiam. Conta o que já existe no cômodo por receita: o alvo de cada item é sorteado em `quantos` e desconta os existentes. Os existentes servem de âncora para `junto` (cadeiras em volta da mesa que o mestre já pôs).
3. Candidatos por lugar:
   - `parede`: ao longo de cada segmento de `contornoDoComodo`, passo de 0,25 m, centro a `profundidade/2 + espessura/2` da linha da parede, rotação pela fórmula das decisões; fora do vão das portas, e fora das janelas se `alto`.
   - `canto`: os candidatos de parede a até 0,3 m da ponta do segmento.
   - `centro`: centro da área livre (`dentro` sem faixa); rotação alinhada ao lado maior do cômodo. Tapetes podem ficar sob móveis e não marcam ocupação, mas não entram na área `porta`.
   - `junto`: `ao-redor` = os quatro lados da âncora, virados para ela; `ao-lado` = esquerda e direita da âncora, mesma rotação; `em-frente` = à frente da âncora, virado para ela, a 1,2 m.
   - `na-parede`: objeto `elevation: 'wall'` com `wall: { wallId, at, face: 'inner' }` achado por `encaixarObjetoDeParede`, a pelo menos 0,2 m de aberturas e de outros objetos de parede.
4. Ordem dos candidatos: sorteio pela semente, com preferência (parede: a mais longe das portas; centro: o mais perto do meio). Aceita o primeiro em que `retanguloLivre` vale para `ocupada`, `porta` e `faixa`; marca a ocupação com folga de 0,1 m.
5. Cada objeto: `novoObjeto(posicao, { id: gerarId('o'), source: { kind: 'recipe', recipe, seed, params }, rotation, roomId, blocks: { move: !tapete, sight: false } })`.
Não fazer: comandos e proposta (5.3c); mexer em objetos existentes.
Testes: a rotação de parede bate com a fórmula (cama na parede de cima fica com rotação 0 e cabeceira para cima); quarto 6 × 4,5 m com porta gera cama na parede, nada na frente da porta e circulação ainda ligada (refaça `circulacao` com os objetos novos); quarto que já tem cama não ganha outra; cozinha com mesa já posta ganha cadeiras ao redor dela; cômodo de 1,5 × 1,5 m devolve pouco ou nada sem lançar; mesma semente = mesmas posições; semente diferente muda alguma coisa.
Pronto quando: testes passam.
Commit: furniture layout generator

### 5.3c — Materiais, paleta e a sugestão "Mobiliar"  ⬜
Objetivo: a proposta de mobília vem com piso, papel e uma paleta de tecidos e madeiras que combinam, e aparece na pílula.
Depende de: 5.2c, 5.3b
Ler: `src/procedural/materiais.ts` (`materiaisDo`, ids de piso, papel e objeto); `src/procedural/receitas.ts` (`campos` com `tipo: 'material'`); `src/authoring/sugestoes.ts`.
Arquivos: criar `src/authoring/mobiliar.ts`, `tests/unit/mobiliar.test.ts`; mudar `src/authoring/sugestoes.ts`.
Como:
1. Dados: `MATERIAIS_POR_GENERO[genero][funcao] = { pisos: string[]; papeis: string[] }` (para `investigacao`, os pares atuais de `TIPOS_DE_COMODO` vêm primeiro) e `PALETAS_POR_GENERO[genero] = { nome; madeira: string; tecidos: string[] }[]` (por exemplo, "vinho e carvalho", "azul e nogueira", "verde e pinho"). Só ids de material que existem.
2. A paleta é sorteada pela semente; cada receita com campo de material de uso `objeto` recebe um tecido da paleta (`estofado`, `toalha`, `cobertor`, `material` dos tapetes) ou a madeira (`madeira`). Isso é o `params` do `PedidoDeLayout`. O campo `Comodo.palette` não muda: o render ainda não o usa.
3. ```ts
   export function propostaDeMobilia(c: Contexto, roomId: string): Proposta | null
   ```
   Comandos: `comodo.atualizar` do piso e papel (só se o par atual for um par de `TIPOS_DE_COMODO` e for diferente do sorteado) + um `item.adicionar` por objeto do layout. `null` se o cômodo não tem função, não há regra ou o layout trouxe menos de 2 objetos. Rótulo "Mobiliar a Cozinha" (nome do cômodo).
4. Registre `mobiliar` em `TIPOS_DE_SUGESTAO`, depois de `funcao`. Texto: "Mobiliar a Cozinha?". "Outra" troca a semente: outra paleta e outro arranjo.
Não fazer: luzes (5.5b).
Testes: todos os materiais das tabelas existem com o uso certo; a proposta de um quarto vazio tem cama e uma paleta só (todos os tecidos da mesma paleta); piso escolhido à mão não é trocado; cômodo já mobiliado devolve `null` ou só o que falta; a proposta aceita passa na validação do mapa.
Pronto quando: no editor, renomear um cômodo para "Quarto" e aceitar duas pílulas (função, mobiliar) gera um quarto mobiliado, com fantasma antes, desfazível em duas entradas.
Commit: furnish suggestion with materials and palette

### 5.4a — Regras de espalhamento  ⬜
Objetivo: espalhar pequenos objetos num círculo de forma natural, conforme o contexto: junto à parede, sobre ou perto de mesas, livre.
Depende de: 5.1b
Ler: `src/authoring/malha.ts`; `src/procedural/receitas.ts` (categoria `mesas`, `caixa`, `papeis`, `livros.pilha`, `vaso.planta`); `src/domain/mapa.ts` (`elevation: 'table'`).
Arquivos: criar `src/authoring/espalhar.ts`, `tests/unit/espalhar.test.ts`.
Como:
1. ```ts
   export interface ItemDeConjunto { receita: string; peso: number; contexto: 'parede' | 'mesa' | 'livre' }
   export interface ConjuntoDeEspalhar { id: string; nome: string; itens: ItemDeConjunto[]; /** Itens por m² no centro do pincel. */ densidade: number }
   export const CONJUNTOS_DE_ESPALHAR: readonly ConjuntoDeEspalhar[]   // 'papelada' (papéis, livros: mesa), 'caixotes' (caixa: parede), 'plantas' (vaso: parede e livre)
   export function espalhar(m: MapaAtlas, o: { centro: Ponto; raio: number; conjunto: string; semente: number; gerarId?: (p: string) => string }): Objeto[]
   ```
2. Amostragem por disco de Poisson (distância mínima = 0,9 × maior lado da pegada), densidade caindo para a borda do pincel; contando os objetos já existentes no círculo para não amontoar em pinceladas repetidas.
3. Contexto: `parede` = a até 0,6 m de uma parede, de costas para ela, rotação com jitter de ±0,15 rad; `mesa` = dentro da caixa de um objeto da categoria `mesas` (então `elevation: 'table'`, `blocks.move: false`), e se não houver mesa no pincel, no chão a até 0,8 m de uma; `livre` = qualquer ponto. Dentro de cômodos, nunca sobre a faixa de circulação, a área das portas ou móveis que bloqueiam. Fora de cômodos, só `livre`.
4. Rotação de `papeis` e `livros.pilha` aleatória; caixotes com rotações próximas de múltiplos de 90°.
Não fazer: a ferramenta (5.4b); "sob árvore" fica para quando houver árvores no acervo (Fase 6).
Testes: papelada num escritório com escrivaninha põe itens com `elevation: 'table'` dentro da caixa da escrivaninha; caixotes ficam a ≤ 0,6 m das paredes; nada cai na frente da porta; pincelar duas vezes no mesmo ponto não dobra a quantidade; mesma semente = mesmo resultado.
Pronto quando: testes passam.
Commit: contextual scatter rules

### 5.4b — Pincel de espalhar  ⬜
Objetivo: uma ferramenta que espalha o conjunto escolhido por onde o mestre arrasta; cada pincelada é uma ação.
Depende de: 5.4a
Ler: `src/render/pincel.ts`; `src/render/viewport.ts` (interação `terreno`, gesto da pincelada, fantasma do pincel de terreno); `src/app/acoes.ts` (`usarFerramenta`, `mudarRaio`, atalhos); `src/ui/Biblioteca.tsx` (lista por ferramenta).
Arquivos: mudar `src/render/pincel.ts`, `src/render/viewport.ts`, `src/app/acoes.ts`, `src/ui/Biblioteca.tsx`, `src/ui/Icone.tsx` (ícone novo), `tests/e2e/fase5.test.ts`.
Como:
1. `Ferramenta` ganha `'espalhar'`; `Pincel.espalhar = { conjunto: 'papelada', raio: 1.5 }`; rótulo "Espalhar".
2. No viewport, a interação reusa a do terreno: ao apertar, `store.iniciarGesto('Espalhar')`; a cada deslocamento ≥ `raio/2`, `espalhar(store.documento, …)` com `semente` nova e um `item.adicionar` por objeto no gesto; soltar conclui, Esc cancela. Alt apaga: `item.remover` dos objetos do conjunto dentro do círculo.
3. Fantasma: círculo do pincel como o do terreno, na cor do acento.
4. Biblioteca da ferramenta: os conjuntos, com nome e uma linha do que fazem. Atalho `S` (livre hoje; só `Ctrl+S` existe); `[` e `]` mudam o raio dela também.
Não fazer: conjuntos novos; editar a densidade pela interface.
Testes: e2e: num escritório com escrivaninha, uma pincelada sobre ela põe papéis com `elevation: 'table'` em uma entrada de histórico; desfazer tira todos; Alt+arrastar remove.
Pronto quando: o e2e passa e os anteriores continuam passando.
Commit: scatter brush tool

### 5.5a — Portas entre vizinhos e porta de entrada  ⬜
Objetivo: sugerir uma porta para o cômodo que não se liga a nada, e a porta de entrada da casa.
Depende de: 5.2c, 5.1b
Ler: `src/authoring/insight.ts`, `malha.ts`, `sugestoes.ts`; `src/domain/geometria.ts` (`paredesDerivadas` e o id `d{orient}{linha}_{ini}_{fim}`, `arestasDeParede`, `encaixarNaParede`, `motivoDeNaoCaber`).
Arquivos: criar `src/authoring/portas.ts`, `tests/unit/portas.test.ts`; mudar `src/authoring/sugestoes.ts`.
Como:
1. `export function propostaDePorta(c: Contexto, roomId: string): Proposta | null`.
2. **Entre vizinhos:** só se o cômodo não tem nenhuma ligação (`vizinhos.every(v => !v.ligado)`) e tem vizinho. Vizinho preferido: corredor, depois sala, depois o de maior parede em comum (cozinha prefere sala). Paredes candidatas: as que separam os dois (as arestas da parede têm `salas` = os dois). Posições: centros de célula ao longo da parede, do meio para as pontas; aceita a primeira em que `motivoDeNaoCaber` é `null` e a área à frente da porta está livre de móveis nos dois cômodos. `swing` para o lado do cômodo maior. Largura 0,9, `kind: 'door'`, `state: 'closed'`, material `madeira.media`.
3. **Porta de entrada:** se nenhum cômodo do mapa tem porta para fora (`outro === null`) e este cômodo é corredor ou sala (ou é o único), a porta vai na parede externa mais longa dele. Texto "Pôr a porta de entrada?".
4. "Outra" (semente + 1) anda para a próxima posição da lista e, no fim dela, para o próximo vizinho.
5. Registre `porta` entre `funcao` e `mobiliar`. Texto "Pôr uma porta para a Sala?".
Não fazer: janelas; arcos (o mestre troca o tipo pelo cartão).
Testes: dois cômodos lado a lado sem porta → proposta com uma porta na parede comum, que cabe; com porta já ligando, `null`; um cômodo que só encosta no corredor recebe a porta para o corredor; móvel colado na parede comum empurra a porta para outra posição; casa sem porta externa recebe a de entrada na sala.
Pronto quando: testes passam e, no editor, três cômodos sem portas ficam ligados aceitando as pílulas.
Commit: suggest doors between rooms

### 5.5b — Luzes pela função  ⬜
Objetivo: sugerir as luzes de um cômodo pela função e pelo gênero, de preferência sobre as mesas.
Depende de: 5.3c
Ler: `src/domain/presets.ts` (`PRESETS_DE_LUZ`, `camposDoPreset`, `GENEROS`); `src/domain/fabrica.ts` (`novaLuz`); `src/authoring/insight.ts`, `sugestoes.ts`.
Arquivos: criar `src/authoring/luzes.ts`, `tests/unit/luzes.test.ts`; mudar `src/authoring/sugestoes.ts`.
Como:
1. Dados: `LUZES_POR_GENERO[genero] = { principal: idDePreset; pequena: idDePreset }`: investigação = lamparina e vela; moderno = lâmpada e lâmpada; fantasia = tocha e vela. `LUZES_POR_FUNCAO[funcao] = { m2PorLuz: number; tamanho: 'principal' | 'pequena'; sobre: string[] /* receitas preferidas */ }` (quarto: pequena sobre mesinha/cômoda; escritório: principal sobre escrivaninha; banheiro: pequena; corredor: uma a cada 6 m de comprimento; porão: principal…).
2. `export function propostaDeLuzes(c: Contexto, roomId: string): Proposta | null` — `null` se o cômodo já tem luz ou não tem função. Quantidade = `max(1, round(area / m2PorLuz))`. Posições: sobre os objetos preferidos do cômodo (posição do objeto, `ownerId` = id dele, então a luz vai junto se o objeto sair); o que faltar, nos pontos livres mais afastados entre si (a partir do centro da área livre). `camposDoPreset` com o preset do gênero.
3. Registre `luz` por último. Texto "Iluminar a Cozinha?".
Não fazer: luzes externas; janelas (já derivadas pelo clima).
Testes: escritório com escrivaninha recebe a luz sobre ela com `ownerId`; cômodo com luz não recebe outra; gênero moderno usa `power: 'grid'` (some no apagão) e fantasia usa fogo; cômodo grande recebe mais de uma luz, a ≥ 2 m uma da outra.
Pronto quando: testes passam; à noite, aceitar "Iluminar" acende o cômodo.
Commit: suggest lights by room function

### 5.6 — Validação da fase  ⬜
Objetivo: provar o critério de pronto e registrar o relatório.
Depende de: todas
Ler: `tests/e2e/fase4.test.ts` (modelo de validação de fase e capturas); `tests/e2e/apoio.ts`.
Arquivos: criar `tests/unit/casa.test.ts`; mudar `tests/e2e/fase5.test.ts`, `progress.md`.
Como:
1. Unitário "casa jogável", puro: três cômodos encostados (6 × 4,5 m cada), com nomes "Sala", "Cozinha", "Quarto"; aceitar `proximaSugestao` de cada cômodo em laço até não haver mais nenhuma (limite de 20). Conferir: as três funções certas; todos os cômodos alcançáveis entre si pelas portas, e uma porta para fora; em cada cômodo, `circulacao(…).ligada` com os móveis postos; nenhum móvel que bloqueia sobrepõe outro nem sai do cômodo; cada cômodo tem luz; o mapa valida.
2. e2e `fase 5: três cômodos viram uma casa`: pintar três cômodos pela interface, renomear pelo inspetor, aceitar as pílulas pelo clique até acabarem, conferir o documento como no unitário, contar as entradas de histórico (uma por pílula), desfazer a última e refazer, mudar o clima para Noite e capturar `test-results/fase5-casa.png` e `fase5-casa-noite.png`. Sem erros de console.
3. Conferir à mão a captura: nada atravessa porta, a mobília tem cara de cômodo, as cores combinam. Se algo ficar feio, anote em "Pendências" em vez de esticar a tarefa.
4. progress.md: resumo da fase (implementado, validação com números, pendências reais) e "Próximo: Fase 6".
Não fazer: consertar o gerador aqui além de ajustes de número em tabelas; problema de lógica vira pendência.
Testes: os acima, mais `npm run typecheck`, `npm test` e `npm run test:e2e` inteiros.
Pronto quando: tudo passa e o relatório está no progress.md.
Commit: validate phase 5
