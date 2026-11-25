# Quadro em WebGL / PixiJS 8 (estilo Miro) + linhas curvas e pan com botão direito

## Contexto

O quadro da **Mesa** (`Mesa/src/ui/quadro/`) nasceu sobre **HTML/DOM + Preact + TipTap** com um fallback de Canvas 2D distante (`desenho-lod.ts`). Com quadros reais importados do Miro (~7.100 itens, ~434k × 461k px, e mais ~4.275 traços à mão livre por entrar), esse modelo híbrido mostra três limites claros:

1. **Fluidez:** montar/diffar centenas de nós DOM em zoom intermediário e redesenhar milhares de caixas/imagens no Canvas 2D a cada frame causa engasgo no pan e no zoom.
2. **Linhas/setas estilo Miro:** hoje `rota: 'curva'` usa pontos de controle fixos e automáticos em `Mesa/src/dominio/setas.ts`, sem alça arrastável para curvar a linha manualmente, e a espessura em `BarraDeFormatacao.tsx` fica limitada a `1–12` px.
3. **Navegação estilo Miro:** o pan com o mouse hoje aceita apenas botão do meio (`e.button === 1`) ou ferramenta Mão; arrastar com o botão direito (`e.button === 2`) abre o menu de contexto imediatamente em vez de mover o quadro.

Este plano organiza a implementação dessas melhorias de UX primeiro (já utilizáveis no quadro atual) seguidas da migração progressiva da renderização do `Mundo` para **PixiJS 8** (`pixi.js`), mantendo `Mesa/src/dominio/` e `Mesa/src/app/` intactos e usando DOM apenas como overlay pontual para edição de texto rico (`EditorRico`/TipTap) e cartões interativos.

### Princípios de arquitetura

- **`src/dominio/` continua 100% puro:** toda geometria, índice espacial, rotas de setas/curvas e validação vivem em `Mesa/src/dominio/` sem depender de Pixi, DOM ou Preact.
- **Um `PIXI.Application` por quadro aberto:** o palco acompanha a câmera por `container.position` e `container.scale` (zero recriação de elementos por frame).
- **Orçamento de memória/VRAM:** imagens carregam em dois níveis (miniatura ≤ 256 px para zoom distante e textura completa até 2048 px sob demanda) e texturas de texto rico usam cache LRU gerado apenas quando o item está visível e legível na tela (`>= 2.5 px`).
- **DOM só na hora de editar/clicar:** `EditorRico` (TipTap), edição de título de moldura/rótulo de seta e cartões `ItemRef` / links `[[Entidade]]` montam em overlay alinhado à câmera apenas para o item ativo.

---

### QW1 — Pan com botão direito + menu de contexto apenas no clique parado  ✅
Objetivo: permitir mover o quadro arrastando com o botão direito (`e.button === 2`), mantendo o menu de contexto quando o clique direito não arrastar.
Depende de: —
Ler: `Mesa/src/ui/quadro/Quadro.tsx` (`aoPressionarArea`, `aoMoverArea`, `aoSoltarArea`, `onContextMenu`), `Mesa/tests/e2e/quadro.test.ts`.
Arquivos: mudar `Mesa/src/ui/quadro/Quadro.tsx`, `Mesa/tests/e2e/quadro.test.ts`.
Como:
- Em `Quadro.tsx`:
  - No `Gesto` `'pan'`, acrescentar `botao: number`, `inicioCliente: Ponto` e `arrastou: boolean`.
  - Em `aoPressionarArea`, aceitar `e.button === 2` para iniciar `'pan'` (sem capturar ainda ou liberando o menu caso não arraste mais que `4 px`).
  - Em `aoMoverArea`, ao ultrapassar `4 px` de distância com `botao === 2`, marcar `arrastou = true`, definir `suprimirContextMenuRef.current = true` e atualizar `camera.value`.
  - Em `aoSoltarArea`, finalizar o gesto normalmente; em `onContextMenu`, se `suprimirContextMenuRef.current` for `true`, zerar a ref e retornar sem abrir `abrirMenuNoPonto`.
Não fazer: não alterar o comportamento do botão do meio (`e.button === 1`), da ferramenta Mão (`modoPanAtivo`), nem dos atalhos de menu de contexto ao clicar parado.
Testes: `npm run typecheck` e novo caso em `Mesa/tests/e2e/quadro.test.ts` verificando que arrastar com o botão direito move a câmera sem abrir o menu de contexto e clicar direito parado continua abrindo o menu.
Pronto quando: arrastar com o botão direito move o quadro em qualquer lugar (fundo ou sobre itens) e um clique direito curto continua abrindo o menu de contexto.
Commit: (feature) pan board by dragging with right mouse button

---

### QW2 — Curvas editáveis e espessura ampliada nas setas (domínio)  ✅
Objetivo: permitir que setas curvas armazenem um ponto de controle manual (`curva`) e suportem espessura maior (até `48 px`) no modelo puro.
Depende de: —
Ler: `Mesa/src/dominio/quadro.ts` (`Item` tipo `'seta'`, `validarItem`), `Mesa/src/dominio/setas.ts` (`caminhoDaSeta`, `caixaDaSeta`), `Mesa/tests/unit/setas.test.ts`.
Arquivos: mudar `Mesa/src/dominio/quadro.ts`, `Mesa/src/dominio/setas.ts`, `Mesa/tests/unit/setas.test.ts`, `Mesa/tests/unit/quadro.test.ts`.
Como:
- Em `Mesa/src/dominio/quadro.ts`:
  - Adicionar `curva?: [number, number]` (ponto em coordenadas do mundo por onde a curva passa) no tipo `seta` e na lista `CHAVES_POR_TIPO.seta`.
  - Em `validarItem` (`case 'seta'`), validar `v.curva` quando presente (`[number, number]` finitos) e validar `v.espessura` no intervalo `0.5..48`.
- Em `Mesa/src/dominio/setas.ts`:
  - Em `caminhoDaSeta`: quando `seta.rota === 'curva'` e `seta.curva` estiver definido (`M = { x: curva[0], y: curva[1] }`), calcular o ponto de controle quadrático `C = { x: 2 * M.x - (p1.x + p2.x) / 2, y: 2 * M.y - (p1.y + p2.y) / 2 }` para que a Bézier quadrática `M p1 Q C p2` passe exatamente por `M` (mesmo comportamento intuitivo de puxar o meio da linha no Miro); expor `meio: [M.x, M.y]`, `angInicio = anguloEntre(p1, C)`, `angFim = anguloEntre(C, p2)` e `pontosControle: [p1, C, p2]`.
  - Quando `seta.curva` for `undefined`, manter o cálculo automático atual com `C1`/`C2` (100% compatível com quadros antigos e importados do Miro).
  - Em `caixaDaSeta`, incluir `M` e `C` na caixa envolvente.
Não fazer: não alterar ainda UI, barra de formatação nem importação do Miro.
Testes: testes unitários em `Mesa/tests/unit/setas.test.ts` (ponto `meio` coincide com `curva`, ângulos nas pontas, `caixaDaSeta` cobre a barriga da curva, fallback automático sem `curva`) e validação em `quadro.test.ts`.
Pronto quando: `npm run typecheck` e `npm test` passam com `curva` e espessura ampliada no domínio.
Commit: (feature) add editable curve handle and wider thickness to arrow model

---

### QW3 — Alça arrastável de curva e controles de linha/espessura na barra  ✅
Nota: adicionada `z-index: 10000` em `.alca-ponta-seta` para que as alças fiquem acima da área clicável de setas espessas.
Objetivo: permitir puxar o meio de uma seta curva diretamente na tela e ajustar espessura (`1–48`) e tipo de rota com fluidez na barra.
Depende de: QW2
Ler: `Mesa/src/ui/quadro/Selecao.tsx`, `Mesa/src/ui/quadro/Quadro.tsx`, `Mesa/src/ui/quadro/BarraDeFormatacao.tsx`, `Mesa/src/ui/quadro/ItemSeta.tsx`.
Arquivos: mudar `Mesa/src/ui/quadro/Selecao.tsx`, `Mesa/src/ui/quadro/Quadro.tsx`, `Mesa/src/ui/quadro/BarraDeFormatacao.tsx`, `Mesa/src/ui/estilo.css`, `Mesa/tests/e2e/quadro.test.ts`.
Como:
- Em `Selecao.tsx`:
  - Quando `unicaSeta` estiver selecionada e `unicaSeta.rota === 'curva'`, renderizar uma alça arrastável em `caminhoSeta.meio` (`data-testid="alca-curva-seta"`, `onPointerDown` -> `onIniciarCurvaSeta(unicaSeta.id, e)` e `onDblClick` para resetar `curva: undefined`).
  - Se a seta selecionada estiver em `rota === 'reta'`, oferecer o mesmo ponto central para puxar já convertendo para `'curva'` (comum no Miro).
- Em `Quadro.tsx`:
  - Adicionar gesto `'curva-seta'` agrupado no `historico` para atualizar `curva: [p.x, p.y]` (e `rota: 'curva'`) durante o arrasto, recalculando `caixaDaSeta`.
- Em `BarraDeFormatacao.tsx`:
  - Ampliar `fmt-seta-espessura` para `min={1}` `max={48}` com controle deslizante + input numérico (ou presets rápidos `2 / 4 / 8 / 16` + input) e botões claros para `reta`, `curva` e `cotovelo`.
Não fazer: não trocar ainda o renderizador para PixiJS.
Testes: `npm run typecheck` e teste E2E em `Mesa/tests/e2e/quadro.test.ts` criando uma seta, ajustando espessura > 12, arrastando a alça de curva e verificando persistência após recarregar.
Pronto quando: é possível curvar qualquer linha arrastando o meio dela e ajustar espessura até `48 px` com `Ctrl+Z` funcionando.
Commit: (feature) add draggable curve handle and extended arrow thickness controls

---

### QW4 — Dependência PixiJS 8 no Mesa e índice espacial O(log N) / O(1)  ✅
Objetivo: instalar `pixi.js` 8.22.0 no projeto `Mesa` e criar um índice espacial puro para consultas de viewport e hit-test em quadros com 10.000+ itens.
Depende de: —
Ler: `Mesa/package.json`, `Mesa/src/dominio/camera.ts` (`itensVisiveis`, `caixaEnvolventeDeItem`), `Mesa/src/dominio/quadro-operacoes.ts` (`itemNoPonto`), `Atlas/package.json`.
Arquivos: mudar `Mesa/package.json` (e `package-lock.json`); criar `Mesa/src/dominio/indice-espacial.ts`, `Mesa/tests/unit/indice-espacial.test.ts`.
Como:
- Adicionar `"pixi.js": "8.22.0"` em `Mesa/package.json`.
- Criar `Mesa/src/dominio/indice-espacial.ts` com uma grade espacial multi-nível (células pequenas para itens normais + balde separado para itens gigantes/molduras/setas) implementando:
  - `criarIndiceEspacial(itens: Iterable<Item>): IndiceEspacial`
  - `consultarCaixa(indice, caixa, margem): Item[]` (preservando ordem por moldura/z quando ordenado ou retornando conjunto único)
  - `consultarPonto(indice, ponto): Item[]` (candidatos sob o cursor)
- Manter atualização incremental ou reconstrução rápida (< 3 ms para 10.000 itens).
Não fazer: não ligar ainda o PixiJS na UI; não alterar a assinatura pública de `itensVisiveis` em `camera.ts`.
Testes: `npm run typecheck`, `npm test` e benchmark em `tests/unit/indice-espacial.test.ts` garantindo equivalência exata com `itensVisiveis` e consulta < 2 ms em 10.000 itens.
Pronto quando: `pixi.js` instala/compila sem erro de tipos no `tsconfig.json` `strict` da Mesa e o índice espacial passa nos testes unitários.
Commit: (performance) add spatial index for large boards and pixi.js dependency

---

### QW5 — Motor `ViewportQuadro` em PixiJS 8: câmera, fundo, grade e imagens com mipmaps  ✅
Objetivo: criar a fundação do renderizador WebGL/Canvas do quadro em PixiJS 8 com fundo, grade e pipeline de imagens em duas resoluções (miniatura + completa).
Depende de: QW4
Ler: `Mesa/src/ui/quadro/Quadro.tsx`, `Mesa/src/ui/quadro/quadro-helpers.ts` (`estiloGrade`), `Mesa/src/app/imagens-quadro.ts`, `Mesa/src/app/banco-quadros.ts`, `Atlas/src/render/viewport.ts` (referência de ciclo de vida PixiJS 8).
Arquivos: criar `Mesa/src/ui/quadro/pixi/viewport-quadro.ts`, `Mesa/src/ui/quadro/pixi/cache-imagens-pixi.ts`, `Mesa/src/ui/quadro/pixi/grade-pixi.ts`.
Como:
- `viewport-quadro.ts`:
  - Inicializar `new Application()` (`preference: 'webgl'`, `antialias: true`, `autoDensity: true`, `resolution: Math.min(2, devicePixelRatio || 1)`, `backgroundAlpha: 1`).
  - Montar `camadaGrade`, `camadaMundo` (com `camadaMolduras`, `camadaItens`, `camadaSetas`, `camadaSelecao`) e método `aplicarCamera(camera)` que apenas ajusta `camadaMundo.position` e `camadaMundo.scale` (O(1)).
  - Destruição limpa no `unmount` (`app.destroy(true, { children: true })`, revogação/destruição de texturas).
- `cache-imagens-pixi.ts`:
  - Carregar `lerImagem(imagemId)` sob demanda, gerar textura miniatura (`<= 256 px` via `OffscreenCanvas`) e textura principal (`<= 2048 px` via `createImageBitmap`) com limite LRU em VRAM para texturas completas quando saem da área próxima.
  - Expor seleção automática da textura pelo tamanho na tela (`Math.max(w, h) * camera.zoom <= 180` usa miniatura; acima disso promove para textura completa).
- `grade-pixi.ts`:
  - Desenhar cor de fundo e grade/pontos alinhados à câmera sem re-layout de CSS.
Não fazer: não substituir ainda `Mundo.tsx` no `Quadro.tsx` (manter isolado até QW6–QW8 ficarem prontos, ou testar atrás de flag/componente dedicado).
Testes: `npm run typecheck` e testes unitários de seleção de nível de mipmap e ciclo de vida do cache.
Pronto quando: `ViewportQuadro` monta, responde a `aplicarCamera` e exibe fundo, grade e imagens com troca automática de resolução.
Commit: (feature) add PixiJS 8 board viewport, grid, and mipmap image cache

---

### QW6 — Renderização GPU de molduras, formas, traços e setas (incluindo curvas QW2)  ⬜
Objetivo: desenhar na cena PixiJS todos os itens vetoriais e de imagem (molduras, formas, caixas de texto, cartões, traços à mão livre e setas com curvas editáveis).
Depende de: QW2, QW5
Ler: `Mesa/src/dominio/formas.ts`, `Mesa/src/dominio/tracos.ts`, `Mesa/src/dominio/setas.ts`, `Mesa/src/dominio/paleta.ts`, `Mesa/src/ui/quadro/ItemForma.tsx`, `Mesa/src/ui/quadro/ItemSeta.tsx`, `Mesa/src/ui/quadro/ItemMoldura.tsx`.
Arquivos: criar `Mesa/src/ui/quadro/pixi/render-itens.ts`, `Mesa/src/ui/quadro/pixi/render-setas.ts`, `Mesa/src/ui/quadro/pixi/render-tracos.ts`.
Como:
- Manter um mapa `Map<string, Container>` sincronizado incrementalmente com `itens` (só reconstrói o display object dos itens cujo objeto `Item` mudou por referência, aproveitando a imutabilidade dos updates da Mesa).
- **Formas e caixas:** desenhar todas as 9 `FORMAS` em `PIXI.Graphics` respeitando `caixa.fundo`, `caixa.opacidade` (`0` = transparente), `caixa.borda`, `espessuraBorda`, `tracejado` (`tracejado` / `pontilhado`) e `semantica` (`paleta`).
- **Traços (`traco`):** para quadros com milhares de traços (ex.: 4.275 do Miro), agrupar ou assar traços estáticos em `PIXI.Graphics` por células espaciais (ou cachear geometria `GraphicsContext`) para evitar milhares de draw calls.
- **Setas (`seta`):** desenhar linhas retas, curvas quadráticas/cúbicas (`QW2`) e cotovelos com tracejado e todas as 5 cabeças (`nenhuma`, `seta`, `triangulo`, `losango`, `circulo`).
- **Culling por viewport + tamanho mínimo:** usar o `IndiceEspacial` (`QW4`) para marcar `visible = true` apenas nos itens dentro da câmera (+ margem), e pular detalhes sub-pixel (`< 1.2 px` na tela).
Não fazer: não desenhar ainda texto rico (`DocRico`), tratado em QW7.
Testes: `npm run typecheck` e testes unitários de sincronização incremental (apenas itens alterados são reconstruídos) e cálculos geométricos compartilhados.
Pronto quando: formas, imagens, molduras, traços e setas renderizam fielmente no palco PixiJS com culling espacial.
Commit: (feature) render shapes, frames, strokes, and curved arrows in PixiJS

---

### QW7 — Renderização de texto rico no PixiJS com cache LRU e LOD nítido  ⬜
Objetivo: renderizar textos de notas, formas, molduras e rótulos de setas dentro do PixiJS com fidelidade tipográfica e sem estourar VRAM em quadros com milhares de textos.
Depende de: QW6
Ler: `Mesa/src/dominio/doc-rico.ts`, `Mesa/src/dominio/fontes.ts`, `Mesa/src/ui/quadro/TextoDecorado.tsx`, `Mesa/src/ui/quadro/desenho-lod.ts`.
Arquivos: criar `Mesa/src/ui/quadro/pixi/render-textos.ts`.
Como:
- Implementar um rasterizador dedicado em `OffscreenCanvas` → `PIXI.Texture` (ou `CanvasTextMetrics` + rich-runs de `DocRico`: parágrafos, cabeçalhos `H1`/`H2`, negrito, itálico, sublinhado, riscado, cores, listas, alinhamento horizontal/vertical e destaque de links `[[Entidade]]`).
- **LOD e orçamento por frame:**
  - Só gerar/manter textura de texto quando o item estiver visível e com altura estimada de fonte na tela `>= 2 px`.
  - Limitar a geração a um orçamento por frame (ex.: máx. `8 ms` por frame durante pan rápido, completando nos próximos frames sem travar) e respeitar escala adequada ao zoom (cap de 2× para não criar texturas gigantes).
  - Evicção LRU quando passar do limite configurado de memória de texturas de texto (ex.: ~128 MB).
Não fazer: não incluir o editor TipTap nesta tarefa (fica no overlay DOM em QW9).
Testes: `npm run typecheck` e testes unitários do layout/quebra de linhas e cache LRU das texturas de texto.
Pronto quando: os textos ricos e rótulos aparecem nítidos no PixiJS ao navegar e dar zoom, mantendo 60 FPS em quadros com 2.000+ blocos de texto.
Commit: (feature) render rich text items with LRU texture cache in PixiJS

---

### QW8 — Seleção, alças (redimensionar, girar, conectar, curvar) e hit-test no PixiJS  ⬜
Objetivo: unificar seleção múltipla, retângulo de seleção, linhas-guia, prévia de traço e todas as alças de manipulação no viewport PixiJS usando o índice espacial.
Depende de: QW3, QW4, QW6
Ler: `Mesa/src/ui/quadro/Selecao.tsx`, `Mesa/src/ui/quadro/Quadro.tsx` (gestos e `itemNoPonto`), `Mesa/src/dominio/gestos.ts`, `Mesa/src/dominio/alinhamento.ts`.
Arquivos: criar `Mesa/src/ui/quadro/pixi/selecao-pixi.ts`, `Mesa/src/ui/quadro/pixi/hittest-pixi.ts`; ajustar `Mesa/src/ui/quadro/Quadro.tsx`.
Como:
- `hittest-pixi.ts`: usar `consultarPonto` do `IndiceEspacial` + teste exato (incluindo rotação do item, distância à curva/segmento da seta, e prioridade para alças da seleção atual e pinos de âncora) em O(1).
- `selecao-pixi.ts`: desenhar em `camadaSelecao` (em escala constante de tela via `1 / camera.zoom`):
  - Contorno da seleção, 8 alças de redimensionamento, alça de rotação, 4 pinos de conector, pontas da seta selecionada, alça de curva (`QW3`), retângulo de seleção por arrasto, linhas-guia de alinhamento e prévia do traço sendo desenhado.
- Manter os cursores dinâmicos (`grab`, `nwse-resize`, `pointer`, etc.) no `<canvas>` conforme o hit-test no `pointermove`.
Não fazer: não remover ainda o `Mundo.tsx` antigo enquanto o overlay DOM de edição (`QW9`) não estiver ligado.
Testes: `npm run typecheck` e testes unitários de `hittest-pixi.ts` (item rotacionado, seta reta/curva/cotovelo, alças e ordem de `z`).
Pronto quando: selecionar, arrastar, redimensionar, girar, ligar setas e curvar linhas funciona diretamente sobre o canvas PixiJS.
Commit: (feature) implement PixiJS selection overlay, handles, and spatial hit-testing

---

### QW9 — Troca do `Mundo.tsx` para PixiJS + overlay DOM só para edição e cartões  ⬜
Objetivo: conectar o `ViewportQuadro` PixiJS no `Mundo.tsx` / `Quadro.tsx`, mantendo um overlay DOM leve apenas para o item em edição (`EditorRico`/TipTap) e cartões/botões interativos em foco.
Depende de: QW1, QW7, QW8
Ler: `Mesa/src/ui/quadro/Mundo.tsx`, `Mesa/src/ui/quadro/Quadro.tsx`, `Mesa/src/ui/quadro/EditorRico.tsx`, `Mesa/src/ui/quadro/ItemRef.tsx`, `Mesa/tests/e2e/quadro.test.ts`, `Mesa/tests/e2e/quadro-pacote.test.ts`.
Arquivos: mudar `Mesa/src/ui/quadro/Mundo.tsx`, `Mesa/src/ui/quadro/Quadro.tsx`, `Mesa/src/ui/estilo.css`, `Mesa/tests/e2e/quadro.test.ts`, `Mesa/tests/e2e/quadro-pacote.test.ts`.
Como:
- Em `Mundo.tsx`:
  - Substituir a lista de `<Item>` + `<canvas data-testid="canvas-lod">` pelo `<canvas>` gerenciado por `ViewportQuadro`.
  - Quando `editandoId !== null`, montar o overlay HTML posicionado com `mundoParaTela(camera, ...)` contendo apenas o editor ativo (`EditorRico` para `texto`/`forma`, `<input>` para título de `moldura` ou rótulo de `seta`).
  - Para ações de clique em cartões `ItemRef` (abrir entidade) ou links `[[Entidade]]` / botão `✓ feito`, abrir/despachar pelo hit-test do PixiJS (ou montar o cartão em foco no overlay ao passar o mouse/clicar).
- Atualizar os testes E2E em `Mesa/tests/e2e/` que inspecionam itens diretamente no DOM (ou expor metadados de acessibilidade/inspeção para testes sem degradar produção, verificando pixels/bounding boxes e edição via overlay).
Não fazer: não apagar ainda `desenho-lod.ts` nem os componentes antigos até validar a suíte completa na tarefa seguinte.
Testes: `npm run typecheck`, `npm test` e `npm run test:e2e` completos na `Mesa`.
Pronto quando: toda a suíte unitária e E2E da `Mesa` passa usando o novo motor PixiJS como renderizador principal do quadro.
Commit: (refactor) switch whiteboard Mundo renderer to PixiJS with DOM edit overlay

---

### QW10 — Limpeza do legado DOM/LOD e validação em quadro de 7.100+ itens  ⬜
Objetivo: remover o código morto do renderizador DOM/Canvas 2D antigo e validar desempenho e uso de memória em escala real (`vaesen.miro.zip`).
Depende de: QW9
Ler: `Mesa/src/ui/quadro/` (arquivos legados não mais importados), `Mesa/src/ui/estilo.css`.
Arquivos: remover `Mesa/src/ui/quadro/desenho-lod.ts`, `Mesa/src/ui/quadro/Item.tsx`, `Mesa/src/ui/quadro/ItemForma.tsx`, `Mesa/src/ui/quadro/ItemImagem.tsx`, `Mesa/src/ui/quadro/ItemMoldura.tsx`, `Mesa/src/ui/quadro/ItemSeta.tsx`, `Mesa/src/ui/quadro/ItemTraco.tsx`, `Mesa/src/ui/quadro/Selecao.tsx` (se não usados em `ProjecaoDoQuadro.tsx`); mudar `Mesa/src/ui/quadro/ProjecaoDoQuadro.tsx` (se compartilhar renderizador ou mantiver próprio), `Mesa/src/ui/estilo.css`.
Como:
- Verificar antes se `ProjecaoDoQuadro.tsx` ainda importa algum componente de item (se sim, ou migrar `ProjecaoDoQuadro` para reusar `ViewportQuadro` em modo somente leitura, ou manter só o necessário para a janela de projeção).
- Remover classes CSS obsoletas (`.item-lod-linhas`, etc.) e arquivos órfãos.
- Validar manualmente e via teste automatizado de stress (quadro sintético com 7.500 itens + 4.000 traços): pan/zoom contínuos sem quedas bruscas de FPS e liberação de VRAM ao fechar o quadro.
Não fazer: não alterar o formato salvo no IndexedDB nem os pacotes `.mesa-quadro.zip` / `.miro.zip`.
Testes: `npm run typecheck`, `npm test` e `npm run test:e2e` na `Mesa`.
Pronto quando: não restam arquivos legados sem uso, o projetor continua funcionando e todos os testes da `Mesa` passam.
Commit: (cleanup) remove legacy DOM and 2D LOD board renderer
