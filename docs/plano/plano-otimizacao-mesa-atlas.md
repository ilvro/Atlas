# Plano de Otimização — Renderização Instantânea e Fluidez na Activity (Atlas + Mesa)

## 1. Diagnóstico: o que causa o chão sem textura e o atraso em objetos

Ao comparar a tela do Mestre com a tela do Jogador na Activity do Discord, a terra base (`terrain.base`), as paredes, os cômodos internos e alguns objetos já estão renderizados, mas as camadas de chão (`terrain.layers`: paralelepípedos e calçada) estão ausentes — e o mesmo atraso ocorre com objetos recém-revelados.

O problema não é um único bug, mas **cinco gargalos encadeados** entre `Atlas` e `Mesa`:

1. **Invalidação total de ladrilhos `16×16 m` a cada passo + fila do `baker` sem cancelamento (`Atlas`)**
   - Em [`projecao-remota.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/domain/projecao-remota.ts#L55-L59), `projetarParaRemoto()` recorta `terrain.layers[].cells` para `areaConhecida` (`explorado ∪ visível + 1 célula`) por segurança anti-spoiler.
   - Na abertura do mapa, o ladrilho `16×16 m` da rua é assado **sem** as camadas ainda não exploradas (ficando apenas com `terrain.base`, a terra marrom).
   - Quando o jogador anda e revela novas células, `terrain.layers` muda em poucos metros → `chaveDoTerreno` ([`entradas.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/entradas.ts#L443)) muda por completo (**0% de cache hit**).
   - Em [`cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts#L275-L276), `terrenoTimer = setTimeout(pedirLadrilhos, 140)` **reinicia a cada `estado` novo**, adiando o início do assado enquanto o jogador se move.
   - Em [`cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts#L258-L260), como `alvo.sprite` já existe (o sprite velho só com terra marrom), **nenhuma prévia rápida (`res / 4`) é gerada** — o jogador continua vendo o chão velho até o assado em resolução cheia terminar.
   - **Gargalo crítico:** em [`baker.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/baker.ts#L170-L172), `coletar(emUso)` só apaga chaves do `cache`, mas **nunca remove da `fila` nem cancela consultas pendentes**. Se o jogador andar 5 passos, entram 5 versões obsoletas do mesmo ladrilho na fila com **prioridade `0`**. Os workers ficam saturados assando versões descartadas (`cena.ts:182`), **bloqueando todos os objetos recém-revelados** (que têm prioridade `1`).

2. **Thrashing de CPU e IndexedDB no cache persistente (`Atlas`)**
   - Em [`bake.worker.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/bake.worker.ts#L80-L89), todo ladrilho de terreno parcial recortado pelo fog (efêmero, usado por 1 passo) é clonado, codificado em PNG (`cor` + `altura` + `agua`) e gravado no IndexedDB.
   - Em [`cache-de-assados.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/cache-de-assados.ts#L344-L366), **cada gravação (`gravarBruto`) percorre o cursor do IndexedDB inteiro** (`percorrerIndiceUsadoEm`) para somar o total de bytes — complexidade `O(N)` por escrita, travando leituras concorrentes e expulsando objetos reutilizáveis do cache de 400 MB.

3. **Tempestade de renderização na Main Thread a cada sprite assado (`Atlas`)**
   - Em [`cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts#L190-L191), **para cada único item** (objeto, cômodo ou ladrilho) que termina de assar:
     ```ts
     if (!ehPrevia) op.baker.coletar(chavesEmUso());
     if (mapa && !e.c.destroyed) { sombras.atualizar(mapa, objetos, pixelRes0(mapa)); tempo.atualizar(mapa, objetos); }
     ```
   - `sombras.atualizar` ([`sombras-do-sol.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/sombras-do-sol.ts#L162)) renderiza o mapa inteiro numa `RenderTexture` até `4096×4096` com `BlurFilter(quality: 3)`. Se 60 objetos chegam ao abrir/explorar uma área, isso roda **60 vezes seguidas** na main thread.
   - Em [`cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts#L585), cada objeto pintado também chama `cenaDeAltura.sincronizarObjetos(objetos, objetosC)` (`O(N)` por objeto → `O(N²)` na carga).
   - Não há **priorização espacial (viewport-first)**: ladrilhos e objetos fora da câmera disputam worker de igual para igual com o que está bem na frente do jogador.

4. **Sem coalescência de `estado` nas pontes e trabalho redundante por pacote (`Mesa` + `Atlas`)**
   - Em [`Mesa/src/app/online.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/app/online.ts#L443) (`fila = fila.then(() => sairProjetor(data))`), se 3 `estado`s chegam enquanto o 1º está comprimindo gzip / subindo blob, o mestre comprime e envia os 3 em série em vez de pular para o mais novo.
   - Em [`Mesa/src/jogar/ponte-jogador.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/ponte-jogador.ts#L159-L192), a fila de entrada do jogador também descomprime e entrega todos os `estado`s intermediários ao Atlas em vez de ficar só com o último.
   - Em [`Atlas/src/app/projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts#L253-L260), o mestre reenvia `estado` remoto mesmo quando `projetarParaRemoto()` produziu saída idêntica (ex.: edição de notas, objetos ocultos ou movimento fora da visão), e durante arrasto contínuo dispara `enviarEstado` completo a cada `200 ms` ([`projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts#L396)).
   - Em [`Atlas/src/ui/Projetor.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Projetor.tsx#L237) → [`store.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/state/store.ts#L202-L210), cada `estado` roda `validarMapa(mapa)` inteiro na main thread do jogador.

5. **Sobrecarga em imagens de objetos da coleção + boot tardio do catálogo de texturas (`Atlas`)**
   - Em [`executar.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/executar.ts#L97-L129) e [`cache-de-assados.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/cache-de-assados.ts#L75-L79), imagens da coleção já prontas (`harmonizar: false`, estilo `illustrated`) ainda passam por `OffscreenCanvas` + clone + re-codificação PNG + gravação no IndexedDB, mesmo já cacheadas pelo HTTP cache do navegador.
   - Em [`cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts#L216), `carregarCatalogo()` só é disparado quando o primeiro terreno com textura chega; iniciar esse fetch no boot do `Projetor.tsx` elimina uma rodada extra de rede na Activity.

---

## 2. Regras para o implementador (Sonnet)

- **Um commit atômico por tarefa abaixo** (seguindo `Atlas/AGENTS.md`, `Mesa/AGENTS.md` e `AGENTS.md` da raiz: categorias `(performance)` / `(refactor)` em inglês minúsculo, sem `Co-authored-by`, respeitando o limite diário de 45 commits).
- **Segurança anti-spoiler preservada:** nunca enviar células, objetos, paredes ou luzes fora de `areaConhecida` em `projetarParaRemoto()`.
- **Validação obrigatória após cada tarefa:**
  - No `Atlas`: `npm --prefix Atlas run typecheck && npm --prefix Atlas test`
  - Na `Mesa`: `npm --prefix Mesa run typecheck && npm --prefix Mesa test`
- Ao concluir o lote inteiro, rodar `npm --prefix Mesa run desktop:prep`.
- **Desvios e limites vão para o fim deste arquivo** (seção "Desvios e limites registrados"): sempre que um agente implementar uma tarefa e encontrar um desvio do que está escrito ou um limite que não conseguiu eliminar, anota ali, numa linha por item, com a tarefa, o que mudou e por quê. Antes de reportar, tente eliminar o limite; só registre o que sobrar. Se não houve nenhum, escreva "sem desvios".

---

## 3. Tarefas de Implementação

### Tarefa 1 (Atlas) — Cancelamento de jobs obsoletos e prioridade dinâmica na fila do `baker`

**Objetivo:** Garantir que versões antigas de ladrilhos de terreno ou cômodos nunca entupam os workers quando uma nova versão já foi pedida.

**Arquivos:**
- [`Atlas/src/procedural/baker.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/baker.ts)
- [`Atlas/src/render/cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts)
- [`Atlas/tests/unit/baker-fila.test.ts`](file:///home/ilvro/Documents/Projects/Atlas/tests/unit/baker-fila.test.ts)

**O que implementar:**
1. Exportar uma classe/símbolo `ErroDeBakeCancelado extends Error` (com `name = 'BakeCancelado'`) em `baker.ts`.
2. Em `criarFilaDeBake` (`baker.ts:170-172`), atualizar `coletar(emUso: ReadonlySet<string>)`:
   - Além de remover de `cache`, percorrer `fila` de trás para frente: se `!emUso.has(item.chave)`, remover da `fila`, apagar de `naFilaPorChave` e rejeitar `item.rejeitar(new ErroDeBakeCancelado())`.
   - Para `consultandoPorChave`: se `!emUso.has(chave)`, marcar como cancelada (`consulta.cancelada = true`), apagar de `consultandoPorChave` e rejeitar com `ErroDeBakeCancelado`; quando a `Promise` de `consultarCache` resolver, se `consulta.cancelada`, fechar eventuais `ImageBitmap`s retornados (via callback opcional `descartar?: (r: TResultado) => void` nas opções de `criarFilaDeBake`, fechando `bitmap`, `altura`, `agua?.bitmap`, `normal`, `fachada` em `criarBaker`) e **não** enfileirar no worker.
   - Ao cancelar em `coletar`, garantir que o `cache.delete(chave)` ocorra sem erro não tratado.
3. Em `criarFilaDeBake.pedir`, adicionar suporte a opção/parâmetro `semCachePersistente?: boolean` (ou propriedade no `PedidoDeBake` / `podeCachear`) para que pedidos marcados assim pulem tanto a consulta quanto a gravação no IndexedDB.
4. Em `cena.ts` (`pintar`, L199 e L205): ignorar `ErroDeBakeCancelado` no `.catch(...)` (sem `console.warn`).
5. **Testes (`baker-fila.test.ts`):**
   - Testar que `coletar(emUso)` remove itens pendentes da fila antes de irem para os executores e rejeita com `ErroDeBakeCancelado`.
   - Testar que uma consulta de cache em andamento cancelada por `coletar` não enfileira trabalho no executor.
   - Testar que itens ainda em `emUso` continuam executando normalmente.

---

### Tarefa 2 (Atlas) — Ladrilhos `8×8 m`, prévia rápida na atualização do projetor, sem debounce infinito e sem poluir IndexedDB

**Objetivo:** Fazer o terreno recém-revelado pelo fog aparecer praticamente instantâneo (4× menos pixels por ladrilho + prévia `res/4` imediata + sem atraso de 140 ms no projetor + sem gravar ladrilhos efêmeros no IDB).

**Arquivos:**
- [`Atlas/src/render/entradas.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/entradas.ts)
- [`Atlas/src/render/cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts)
- [`Atlas/src/procedural/executar.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/executar.ts)
- [`Atlas/src/procedural/cache-de-assados.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/cache-de-assados.ts)
- [`Atlas/src/procedural/baker.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/baker.ts)
- [`Atlas/tests/unit/entradas.test.ts`](file:///home/ilvro/Documents/Projects/Atlas/tests/unit/entradas.test.ts)

**O que implementar:**
1. Em `entradas.ts:215`: reduzir `LADO_DO_LADRILHO` de `16` para `8` (cada ladrilho cai de `512×512` para `256×256` px a `32 px/m` — **4× menos pixels**, 4× menos área invalidada pelo fog e melhor paralelismo nos workers). Atualizar a asserção em `entradas.test.ts:85` e verificar `terreno-ladrilhos.test.ts`.
2. Em `executar.ts`: adicionar campo opcional `semCache?: boolean` em `PedidoDeBake` (para `terreno`).
3. Em `cache-de-assados.ts` (`pedidoCacheavel`, L75-79):
   - Retornar `false` se `'semCache' in pedido && pedido.semCache === true`.
   - Retornar `false` também para `pedido.tipo === 'imagem' && !pedido.harmonizar && pedido.estilo !== 'pixel'` (imagens da coleção já prontas vêm do HTTP cache do navegador e não devem ser re-codificadas em PNG para o IndexedDB).
4. Em `cena.ts` (`sincronizarTerreno`, L246-277):
   - Detectar se o terreno é parcial/efêmero: `const terrenoEfemero = modoDoProjetor && m.session.explored !== null;`. Passar `...(terrenoEfemero ? { semCache: true } : {})` no pedido do ladrilho (e da prévia).
   - **Corrigir o atraso no projetor:** em L275-276, executar `pedirLadrilhos()` **imediatamente** quando `terrenos.size === 0 || modoDoProjetor` (manter o debounce de `140 ms` apenas no editor durante pinceladas manuais).
   - **Prévia rápida ao revelar camadas no projetor:** em `pintar()` (`cena.ts:177`), aceitar um flag `forcarPrevia?: boolean` (ou `usarPrevia = !!previa && previa.chave !== chave && (!e.sprite || forcarPrevia)`). Em `sincronizarTerreno`, quando `estilo === 'illustrated'` e `(!alvo.sprite || modoDoProjetor)`, enviar prévia `resPrevia = Math.max(1, res / 4)` com `semCache: true` e prioridade `0`, enquanto o assado em alta resolução vai com prioridade `1` (ou `2` se fora da tela, ver Tarefa 4). Assim o calçamento aparece em ~5 ms (baixa res) e refina para alta resolução logo em seguida!
   - **Evitar re-sync de terreno em mudanças irrelevantes:** em `cena.ts:830`, só incluir `colecao('rooms') || colecao('walls') || colecao('openings')` no gatilho de `sincronizarTerreno(m)` quando `m.style.settle !== false` (abrir/fechar porta sem assentamento ativo não muda o terreno).
5. **Testes:**
   - Atualizar `entradas.test.ts` para `LADO_DO_LADRILHO === 8` e adicionar teste garantindo continuidade sem costuras entre ladrilhos `8×8 m`.
   - Em `cache-de-assados.test.ts`, testar que `pedidoCacheavel` retorna `false` para `terreno` com `semCache: true` e para `imagem` ilustrada sem harmonização.

---

### Tarefa 3 (Atlas) — Eliminar scan `O(N)` no IndexedDB em `cache-de-assados.ts`

**Objetivo:** Remover o gargalo de I/O que bloqueia o IndexedDB a cada gravação de assado.

**Arquivos:**
- [`Atlas/src/procedural/cache-de-assados.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/procedural/cache-de-assados.ts)
- [`Atlas/tests/unit/cache-de-assados.test.ts`](file:///home/ilvro/Documents/Projects/Atlas/tests/unit/cache-de-assados.test.ts)

**O que implementar:**
1. Manter no closure de `criarCacheDeAssados` um contador em memória `totalBytesEstimado: number | null = null` e `tamanhosPorChave: Map<string, number> | null = null` (ou só `totalBytesEstimado` sincronizado com um scan inicial único).
2. Na primeira gravação após abrir o banco (`totalBytesEstimado === null`), calcular `totalBytesEstimado` percorrendo o índice uma única vez; nas gravações seguintes:
   - Ler o registro existente (se houver) apenas por `store.get(chaveHash)` (`O(1)`) para subtrair `existente.bytes`.
   - Somar `bytes` do novo registro.
   - **Só** percorrer `percorrerIndiceUsadoEm` para evicção LRU quando `totalBytesEstimado > limiteBytes`!
   - Atualizar `totalBytesEstimado` após deletar vítimas.
3. Em `fechar()` e `onclose`/`onversionchange`, resetar `totalBytesEstimado = null`.
4. **Testes (`cache-de-assados.test.ts`):**
   - Garantir que todos os testes existentes de LRU/evicção continuam passando.
   - Adicionar teste verificando que gravações abaixo do `limiteBytes` não abrem cursor `openCursor` repetidamente após a inicialização (ou respeitam exatamente o limite quando ultrapassado).

---

### Tarefa 4 (Atlas) — Coalescência de pós-processamento na Main Thread + Priorização por Viewport (Camera-First)

**Objetivo:** Eliminar os travamentos de main thread causados por 50+ re-renderizações de sombras/tempo/altura durante o carregamento e garantir que terreno e objetos visíveis na câmera atual sempre assem antes do que está fora da tela.

**Arquivos:**
- [`Atlas/src/render/cena.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/cena.ts)
- [`Atlas/src/render/viewport.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/render/viewport.ts)
- [`Atlas/src/ui/Projetor.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Projetor.tsx)

**O que implementar:**
1. **Coalescência em `cena.ts`:**
   - Criar flags no closure de `criarCena`: `sombrasSujas = false`, `tempoSujo = false`, `alturaObjetosSuja = false`, `coletaSuja = false`.
   - Em `aplicarResultado` (`cena.ts:181-192`):
     - Remover as chamadas síncronas diretas a `op.baker.coletar(chavesEmUso())`, `sombras.atualizar(...)` e `tempo.atualizar(...)`.
     - Em vez disso, aceitar um callback/flag indicando o tipo do item (`afetaSombras`, `afetaTempo`, `afetaAlturaObjetos`):
       - Para objetos: marcar `sombrasSujas = true` apenas se o objeto tiver `castsShadow || ehSombraProjetada(o)` e `elevation === 'floor' && roomId === null`; marcar `tempoSujo = true` apenas se `(mapa.climate.weather.snow > 0.2 || mapa.climate.weather.rain > 0.3)`; marcar `alturaObjetosSuja = true` apenas se `e.texAltura !== null`.
       - Para terreno/escarpa: marcar `sombrasSujas` apenas se houver maciços/escarpas; `coletaSuja = true` apenas se `!ehPrevia`.
     - No início de `quadro()` (`cena.ts:894`) — e também num helper `descarregarPendencias()` chamado em `captura.ts` / antes de `cenaDeAltura.atualizar`:
       - Se `coletaSuja`: `coletaSuja = false; op.baker.coletar(chavesEmUso());`
       - Se `alturaObjetosSuja`: `alturaObjetosSuja = false; cenaDeAltura.sincronizarObjetos(objetos, objetosC);`
       - Se `sombrasSujas && mapa`: `sombrasSujas = false; sombras.atualizar(mapa, objetos, pixelRes0(mapa));`
       - Se `tempoSujo && mapa`: `tempoSujo = false; tempo.atualizar(mapa, objetos);`
   - Chamar `op.aoPintar?.()` normalmente para acordar o loop de render quando necessário.
2. **Priorização espacial (Viewport-First) em `cena.ts` + `viewport.ts`:**
   - Adicionar callback opcional `caixaVisivel?(): Caixa | null` em `OpcoesDaCena` (`cena.ts:44`), fornecido por `viewport.ts` a partir de `camera` e `tela()` (com margem de +2 m).
   - Em `sincronizarTerreno`: calcular se cada ladrilho intersecta `caixaVisivel()`.
     - Ladrilho visível: prévia com prioridade `0`, alta res com prioridade `1`.
     - Ladrilho fora da tela: prioridade `4` (sem prévia se fora da tela).
     - Ordenar os ladrilhos pela distância ao centro da câmera antes de chamar `pintar()`.
   - Em `sincronizarObjetos`: calcular se o objeto está dentro de `caixaVisivel()`.
     - Objeto visível: prioridade `1` (mesma prioridade que terreno em alta res, **nunca bloqueado** por terreno fora da tela!).
     - Objeto fora da tela: prioridade `5`.
   - Em `telhados`: prioridade `6` (ou `3` se visível, `6` se fora).
   - Quando a câmera do jogador se mover significativamente (`viewport.ts`, ao mudar câmera), opcionalmente repriorizar itens já na fila (como `baker.pedir` já promove a prioridade de itens em `naFilaPorChave` se a nova prioridade for menor — `baker.ts:120-124`!).
3. **Pré-carregar catálogo de texturas no boot do projetor (`Projetor.tsx`):**
   - No início do `useEffect` de `Projetor.tsx` (L79), disparar `void carregarCatalogo();` (importado de `../procedural/texturas-carregadas.ts`) para buscar `texturas.json` em paralelo enquanto o WebSocket/BroadcastChannel entrega o primeiro `estado`.

---

### Tarefa 5 (Atlas) — Evitar reenvio redundante de `estado` no mestre e validação redundante no projetor

**Objetivo:** Reduzir drasticamente a quantidade de snapshots pesados gerados, serializados e validados durante a sessão.

**Arquivos:**
- [`Atlas/src/app/projetor.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/app/projetor.ts)
- [`Atlas/src/ui/Projetor.tsx`](file:///home/ilvro/Documents/Projects/Atlas/src/ui/Projetor.tsx)
- [`Atlas/src/state/imutavel.ts`](file:///home/ilvro/Documents/Projects/Atlas/src/state/imutavel.ts)

**O que implementar:**
1. **Suprimir envio remoto redundante (`Atlas/src/app/projetor.ts`):**
   - Guardar o último JSON serializado (ou hash leve / `conteudo` dos campos relevantes) da projeção remota enviada (`ultimoDocRemotoJson: string | null`).
   - Em `enviarEstado` (L253-260): quando `!forcarRetratos` (ou fora de `ola`), comparar a projeção `doc` recém-gerada com a última enviada; se for idêntica (ex.: mestre editou notas, moveu monstro fora da visão, mexeu em região `gmOnly`), **não enviar** `{ tipo: 'estado' }` novamente pela rede!
   - Resetar `ultimoDocRemotoJson = null` ao receber `ola` remoto ou `tchau` remoto.
2. **Reduzir rajadas de `estado` durante arrasto contínuo (`Atlas/src/app/projetor.ts:396`):**
   - Durante `e.tipo === 'gesto'` de peça única, o mestre já envia `peca-gesto` leve a cada 12 ms.
   - Em L396 (`if (e.mudancas.campos.includes('session')) agendar(200)`), aumentar para `agendar(350)` durante gesto contínuo — assim o `peca-gesto` mantém o movimento em 60 fps e o fog/terreno atualiza ~3×/s durante o arrasto e imediatamente (`agendar(50)` ou imediato) ao soltar a peça (`e.tipo === 'concluir'`).
3. **Pular validação completa repetida no projetor remoto (`Projetor.tsx:237`):**
   - Na primeira carga ou troca de mapa (`docAntesId !== msg.doc.id`), manter validação completa (`store!.projetar(msg.doc)`).
   - Em atualizações incrementais do **mesmo** mapa (`docAntesId === msg.doc.id`), chamar `store!.projetar(msg.doc, { emGesto: msg.emGesto, pularValidacao: false })` → ou adicionar opção `compartilharSemValidar` em `store.projetar` (`validarMapa` só na primeira carga, mas **mantendo** `compartilhar(antes, mapa)` para que `diferencas()` continue preciso e não marque tudo como mudado!).
   - **Atenção:** em `store.ts:205`, hoje `pularValidacao` pula TAMBÉM `compartilhar(antes, mapa)`! Separar as duas opções (`pularValidacao?: boolean` e `pularCompartilhamento?: boolean`) para que `Projetor.tsx` possa pular `validarMapa` em updates do mesmo mapa **sem** perder `compartilhar(antes, mapa)`.
4. **Otimizar `compartilhar` em `Atlas/src/state/imutavel.ts:105-117`:**
   - Para arrays de números ou tuplas primitivas como `Faixa` (`[y, x0, n]`), fazer fast-path sem criar array intermediário `.map(...)` quando todos os elementos são primitivos iguais (`Object.is(velho[i], novo[i])`). Isso evita dezenas de milhares de alocações temporárias em mapas com muitas células de terreno/fog.
5. **Testes:**
   - Testar em `projetor.test.ts` (ou novo teste unitário) que mudanças invisíveis ao jogador (ex.: `notes`, objeto `oculto`) não reenviam `estado` remoto.
   - Testar em `store.test.ts` que `pularValidacao: true` com `pularCompartilhamento: false` mantém referências compartilhadas em `diferencas()`.

---

### Tarefa 6 (Mesa) — Coalescência de `estado` (latest-wins) nas pontes do Mestre e do Jogador

**Objetivo:** Evitar acúmulo de blobs gzip antigos na fila de saída do mestre e na fila de entrada do jogador quando vários `estado`s chegam em sequência rápida.

**Arquivos:**
- [`Mesa/src/app/online.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/app/online.ts)
- [`Mesa/src/jogar/ponte-jogador.ts`](file:///home/ilvro/Documents/Projects/Mesa/src/jogar/ponte-jogador.ts)
- Testes unitários correspondentes em `Mesa/tests/unit/`

**O que implementar:**
1. **Ponte do Mestre (`Mesa/src/app/online.ts:443-491`):**
   - Manter uma fila explícita de itens pendentes (`filaItens: unknown[]`) drenada por um loop `async` único (em vez de encadear `.then()` cegamente).
   - Ao enfileirar uma nova mensagem `msg` com `msg.tipo === 'estado'` (não-gesto): remover qualquer `estado` anterior que ainda esteja aguardando em `filaItens` (substituindo pelo mais novo, ou mantendo a posição relativa a `camera`/`controle-jogadores` ao final).
   - Se chegar um `estado` mais novo enquanto outro está no meio de `comprimirEstado`, o próximo ciclo já pega diretamente o último, sem nunca comprimir/subir estados intermediários descartados.
2. **Ponte do Jogador (`Mesa/src/jogar/ponte-jogador.ts:159-192`):**
   - Mesmo padrão: usar uma lista `filaEntrada: unknown[]` drenada por um loop `async` único.
   - Ao enfileirar uma nova mensagem `msg` com `msg.tipo === 'estado'`: se já existir outro `estado` pendente na `filaEntrada` ainda não iniciado, removê-lo (e se tiver `blobId`, opcionalmente limpar de `blobs` quando chegar) para que o jogador **só descomprima e entregue ao Atlas o `estado` mais recente**.
   - **Cuidado com ordem:** preservar mensagens de `camera`, `controle-jogadores`, `visao-remota` e `retrato` (removendo apenas `estado`s superados).
3. **Testes:**
   - Teste na ponte do mestre: enfileirar 3 `estado`s grandes enquanto o 1º está em andamento → verificar que apenas o 1º e o 3º são comprimidos/enviados (o 2º é descartado).
   - Teste na ponte do jogador: enfileirar 3 `estado`s enquanto o 1º aguarda blob → verificar que o 2º é pulado e o 3º é entregue ao `BroadcastChannel` local.

---

### Tarefa 7 (Validação Final e Empacotamento Desktop)

1. Rodar `npm --prefix Atlas run typecheck && npm --prefix Atlas test`.
2. Rodar `npm --prefix Mesa run typecheck && npm --prefix Mesa test`.
3. Rodar `npm --prefix Mesa run desktop:prep` para atualizar `Mesa/dist-desktop/`.
4. Conferir manualmente na Activity do Discord:
   - Abrir mapa com fog ativo e andar pela rua com paralelepípedos e objetos.
   - Verificar que o chão (camadas de terreno) e objetos aparecem de forma imediata na tela do jogador, sem engasgos e sem vazar áreas não exploradas no DevTools.

---

## 4. Ordem de Prioridade e Impacto Esperado

| Ordem | Tarefa | Projeto | Impacto direto no sintoma das imagens |
| :---: | :--- | :---: | :--- |
| **1** | Cancelamento na fila do `baker` | `Atlas` | **Crítico** — para de travar os workers com bakes antigos e destrava objetos |
| **2** | Ladrilhos `8×8 m` + prévia no projetor + sem debounce + sem IDB efêmero | `Atlas` | **Crítico** — chão com calçamento aparece em ~5 ms (prévia) e 4× mais rápido em alta res |
| **3** | Eliminar scan `O(N)` no IndexedDB | `Atlas` | **Alto** — elimina engasgos de I/O em sessões longas (mestre e jogador) |
| **4** | Coalescência de sombras/tempo/altura + prioridade por viewport + boot do catálogo | `Atlas` | **Alto** — elimina travamentos na main thread e prioriza o que está na câmera |
| **5** | Supressão de reenvio redundante + `store.projetar` + `compartilhar` | `Atlas` | **Médio/Alto** — reduz tráfego de rede e CPU na sincronização |
| **6** | Coalescência latest-wins nas pontes do mestre e jogador | `Mesa` | **Médio/Alto** — evita backlog de blobs gzip em movimentos rápidos |
| **7** | Validação completa + `desktop:prep` | `Mesa` | Obrigatório ao fim do lote |

---

## 5. Desvios e limites registrados

Formato: **Tarefa N** — desvio ou limite; motivo; estado (corrigido / aceito / aberto).

### Tarefa 1
- Não implementou `semCachePersistente` em `baker.pedir` (item 3): uma opção separada não seria honrada na gravação sem mexer em `executar.ts`. A Tarefa 2 cobre com `semCache` em `PedidoDeBake` + `pedidoCacheavel`. **Corrigido pela Tarefa 2.**
- Cancelar um item da fila rejeita a Promise compartilhada da chave; `pintar` ignora o erro e o próximo `pedir` refaz o trabalho. **Aceito.**

### Tarefa 2
- A prévia `res/4` com `semCache` valia também no editor (antes era cacheada). **Corrigido:** agora só leva `semCache` no terreno efêmero do projetor.
- Teste "semCache não muda a chave" era vazio (`chaveDoTerreno` não recebe `semCache`). **Corrigido:** removido; a cobertura real está em `pedidoCacheavel` (`cache-de-assados.test.ts`).
- Teste e2e `terreno-ladrilhos` não tinha sido rodado. **Corrigido:** rodado com `LADO_DO_LADRILHO = 8`, passa.
- No projetor, a prévia de baixa resolução substitui o sprite antigo até a alta chegar; o chão pode ficar borrado por instantes ao revelar. **Aceito:** troca consciente por mostrar o calçamento na hora (o sprite antigo nem tem as camadas novas).
- Imagens da coleção prontas (`harmonizar: false`, não Pixel) saem do IndexedDB e dependem do cache HTTP do navegador. **Aceito:** é o item 3 do plano.
- A prioridade 2 para ladrilho fora da tela fica para a Tarefa 4. **Aberto.**

### Tarefa 3
- O total em memória não enxerga gravações de outra aba. **Corrigido:** a cada 64 gravações o índice é varrido de novo e o total é recalculado.
- As gravações passaram a ser **serializadas** (cadeia de promessas), coisa que o plano não pedia: sem isso duas gravações simultâneas liam o total antes de a outra terminar. **Corrigido** (é parte da solução).

### Tarefa 4
- Repriorização ao mover a câmera. **Corrigido:** `cena.repriorizar()` (chamada pelo viewport 120 ms após a câmera parar) sobe na fila o que entrou na tela, via `baker.pedir` com prioridade menor. Só promove; o que saiu da tela não é rebaixado. **Aceito.**
- Cômodos ficavam com prioridade 0. **Corrigido:** entram na regra por viewport (0 na tela, 3 fora, sem prévia fora).
- Objeto grande com o centro fora da margem. **Corrigido:** a visibilidade usa o ponto com folga de 1,5 m, além da margem de 2 m do viewport.
- O `sombrasSuja` de terreno só liga com camadas de terreno no mapa (a sombra dos maciços lê `terrain.layers`, não a textura). **Aceito:** é o comportamento correto.
- Adicionado `descarregarPendencias()` à `Cena` e chamado em `captura.ts` antes do `render` final. **Corrigido** (acréscimo ao plano).

### Tarefa 5
- `pularValidacao` antes pulava também `compartilhar`; agora são opções separadas e os 4 chamadores de gesto (viewport e Projetor) passam as duas para manter o comportamento. **Corrigido.**
- O envio remoto é comparado por `JSON.stringify([doc, emGesto, controleJogadores])`, não por hash: custa uma serialização por envio, mas o doc serializaria de qualquer jeito na ponte. **Aceito.**
- O `peca-gesto` e o `estado` de gesto não passam pela comparação (só o estado firme e o de gesto que chegam a `enviarEstado` passam, e o de gesto tem `emGesto` na chave). **Aceito.**
- `concluir` cancela o timer pendente do arrasto e envia em 50 ms (o plano dizia "50 ou imediato"). **Corrigido.**

### Tarefa 6
- Os `estado`s só se substituem dentro do **mesmo mapa** (`doc.id`; no comprimido, pelo `blobId`): a ponte do mestre pode ter mais de um mapa na fila. **Corrigido** (acréscimo ao plano).
- No mestre, um `estado` de gesto não derruba um `estado` firme que espera; um firme derruba qualquer um anterior. **Aceito:** o firme traz a posição final.
- No jogador, o blob de um `estado` descartado que ainda não chegou é ignorado ao chegar (`blobsDescartados`); o que já estava guardado é apagado. **Corrigido.**
- Sem desvios abertos.
