# Fase 8 — Renderizador Pixel completo

"O mesmo mapa, outro estilo, ao vivo." Critério de pronto da fase (ROADMAP): o mapa da casa, sem nenhuma alteração, é jogado inteiro no Pixel e trocado ao vivo com o Ilustrado.

Detalhado em 3 de novembro de 2026, **antes das Fases 6 e 7**, contra o código do fim da Fase 5 e o protótipo `spikes/estilos/`. A 6 muda o acervo e o render de objetos, e a 7 acrescenta névoa, memória, peças e projetor, que o Pixel também precisa cobrir. **Ao começar a fase, o Opus confere as fichas de novo**; os pontos que dependem da 6 e da 7 estão marcados com "(depois da 6)" ou "(depois da 7)".

## Como o código está hoje

- `style.renderer: 'illustrated' | 'pixel'`, `style.palette` (`'investigacao-sepia'`) e `style.pixel = { pixelsPerCell: 16, dither: 'bayer4', outline: true }` já estão no documento e são validados. **Nada os lê.**
- Tudo é Ilustrado: `procedural/raster.ts` (`desenharPartes`), `materiais.ts` (`pintarMaterial`), `assar.ts` (objeto, cômodo com faces, terreno), no worker por `executar.ts`; a cena compõe no Pixi com o mapa de luz multiplicado (`render/mapa-de-luz.ts`), presença em shader (`presenca.ts`), partículas, neblina e acabamento.
- O protótipo já resolveu o Pixel: `spikes/estilos/src/materiais.js` (`pintarPixel` por padrão de material), `raster.js` (partes no Pixel e `contornar`), `filtros.js` (`filtroFaixas` da luz, `filtroPaleta` com Bayer 4×4 e a `PALETA` de 32 cores), `sprite.js` (`gerarFolha`, 16 × 24 por quadro, 4 direções, parado e andando) e `main.js` (cena num render target de `largura × pixelsPerCell` ampliado em `nearest`). Porte do protótipo, com as adaptações às estruturas do Atlas.

## Decisões já tomadas (não rediscutir na implementação)

- **Uma descrição, dois estilos de raster.** Receitas, geradores pesados (6.1b), materiais, faces de parede e terreno passam a ser pintados por um **estilo de raster** escolhido no pedido de bake. Nenhum asset ganha arte separada por estilo (AGENTS.md); a única exceção é o `pixelArquivo` manual de imagens (8.3b).
- **Resolução do Pixel:** `res = pixelsPerCell / grid.size` px por metro (16 / 1,5 ≈ 10,7). Tudo que é assado no Pixel usa essa resolução e `scaleMode: 'nearest'`.
- **A cena inteira é pixelizada:** no Pixel, a raiz da cena (camadas de terreno a peças) é renderizada num `RenderTexture` de `colunas × pixelsPerCell` por `linhas × pixelsPerCell`, ampliado em `nearest`, e passa pelo filtro de paleta (quantização + Bayer) **antes** do acabamento. As sobreposições do editor (grade, seleção, fantasmas) ficam fora, na resolução da tela.
- **Paleta por `style.palette`:** catálogo `PALETAS_PIXEL` com a de 32 cores do protótipo como `investigacao-sepia` e mais duas (uma clara para o moderno, uma quente para a fantasia). O gênero sugere a paleta, mas o mestre escolhe.
- **Câmera no Pixel:** zoom em múltiplos inteiros da resolução do render target, e posição arredondada ao pixel do Pixel (como `main.js` faz), para não tremer.
- **A luz é a mesma** (mesmos polígonos e sombras); no Pixel, o mapa de luz é feito na resolução do Pixel e passa pelo filtro de faixas (luz em degraus de borda dura).
- **Troca ao vivo:** mudar `style.renderer` repinta só o que falta, mantendo a textura do outro estilo visível até a nova chegar (as chaves de cache incluem o estilo).

## Tarefas

| # | Tarefa | Tipo |
| --- | --- | --- |
| 8.1a | Estilo de raster e o Ilustrado atrás dele | procedural (sem mudar o resultado) |
| 8.1b | Cena pixelizada, paleta e seletor de estilo | render + interface |
| 8.1c | Pixel: materiais, pisos e terreno | procedural |
| 8.1d | Pixel: objetos e coleção | procedural |
| 8.1e | Pixel: paredes caixa e sólidas | procedural |
| 8.1f | Pixel: presença e memória em blocos | render |
| 8.2a | Gerador de sprites | procedural |
| 8.2b | Sprite na peça e painel do sprite | render + interface |
| 8.2c | Cores pelo retrato e estados no sprite | procedural + interface |
| 8.3a | Derivação automática de imagens | procedural |
| 8.3b | `pixelArquivo` manual | dados + render |
| 8.4a | Luz em faixas | render |
| 8.4b | Revelação em dithering e fonte pixel | render + interface |
| 8.4c | Partículas, neblina e transição de clima no Pixel | render |
| 8.5 | Validação da fase | e2e + relatório |

---

### 8.1a — Estilo de raster e o Ilustrado atrás dele  ⬜
Objetivo: o código de pintura passa a perguntar "em que estilo?", e o Ilustrado vira a primeira implementação, sem mudar um pixel.
Depende de: —
Ler: `src/procedural/raster.ts`, `materiais.ts` (`pintarMaterial`), `assar.ts`, `executar.ts`, `baker.ts`; `src/render/entradas.ts` (chaves); `docs/ARQUITETURA.md` §5.4.
Arquivos: criar `src/procedural/estilos/index.ts`, `src/procedural/estilos/ilustrado.ts`; mudar `raster.ts`, `assar.ts`, `executar.ts`, `entradas.ts`, `src/render/cena.ts`.
Como:
1. ```ts
   export type IdDoEstilo = 'illustrated' | 'pixel';
   export interface EstiloDeRaster {
     id: IdDoEstilo;
     /** px por metro para objetos, cômodos e terreno, dados o pixelsPerCell e o tamanho da célula. */
     resolucao(tipo: 'objeto' | 'comodo' | 'terreno', o: { ppc: number; celula: number }): number;
     desenharPartes(ctx: Contexto, partes: readonly Parte[], o: { res: number; seed: number; sombras: boolean }): void;
     pintarMaterial(ctx: Contexto, id: string, area: Area, seed: number, o?: { dir?: number; res?: number }): void;
     /** Passo final da tela assada (contorno de 1 px do Pixel; nada no Ilustrado). */
     finalizar?(ctx: Contexto, largura: number, altura: number): void;
   }
   export function estiloDe(id: IdDoEstilo): EstiloDeRaster
   ```
   O Pixel ainda devolve o Ilustrado (a 8.1c em diante o preenche).
2. Os assadores (`assarObjeto`, `assarComodo`, `assarTerreno`, `assarDescricao`) recebem o estilo; `PedidoDeBake` ganha `estilo: IdDoEstilo`; as resoluções `RES_OBJETO`, `RES_COMODO` e `RES_TERRENO` vêm de `estilo.resolucao`.
3. As chaves de cache (`chaveDoObjeto`, `chaveDoComodo`, `chaveDoTerreno` e a das imagens da 6.1c) começam pelo estilo.
Não fazer: nada visível de Pixel.
Testes: os unitários e e2e passam sem mudar nenhuma captura; unitário de que as chaves de estilos diferentes diferem.
Pronto quando: tudo passa.
Commit: raster style interface

### 8.1b — Cena pixelizada, paleta e seletor de estilo  ⬜
Objetivo: escolher Pixel na aba Mapa já pixeliza a cena inteira na paleta, mesmo antes dos materiais próprios.
Depende de: 8.1a
Ler: `spikes/estilos/src/main.js` (render target do mundo, `scaleMode`, arredondar o zoom); `spikes/estilos/src/filtros.js` (`filtroPaleta`, `PALETA`); `src/render/viewport.ts` (acabamento, câmera); `src/render/cena.ts` (`raiz`).
Arquivos: criar `src/render/pixelizar.ts`, `src/domain/paletas.ts`, `tests/unit/paletas.test.ts`; mudar `viewport.ts`, `cena.ts`, `src/render/camera.ts`, `src/ui/Inspetor.tsx`.
Como:
1. `paletas.ts` (puro): `PALETAS_PIXEL: { id; nome; cores: string[] }[]` com `investigacao-sepia` (a do protótipo), `moderno-claro` e `fantasia-quente` (32 cores cada, muitos escuros, como a original); `paletaDe(id)` cai na primeira.
2. `pixelizar.ts`: `criarPixelizacao(renderer)` com `{ sprite; definir(m, ligado); renderizar(raiz) }`: um `RenderTexture` de `colunas × ppc` por `linhas × ppc`, `nearest`, onde a raiz da cena é renderizada com a transformação mundo→pixel; o `sprite` ampliado ocupa o mapa no mundo. Filtro de paleta (porte do `filtroPaleta`, com a paleta do mapa e `dither: 'none' | 'bayer4'`).
3. No viewport, com `renderer === 'pixel'`: a raiz da cena sai do palco e entra o sprite pixelizado; o acabamento vai por cima do sprite. Câmera: zoom e posição arredondados como no protótipo.
4. Aba Mapa, seção nova "Estilo": Ilustrado/Pixel, pixels por célula (12, 16, 24, 32), paleta, dithering, contorno. Tudo por `estilo.atualizar` (rótulo "Estilo do mapa"). Trocar é instantâneo e desfaz.
Não fazer: materiais e objetos no Pixel (as tarefas seguintes); a luz em faixas (8.4a).
Testes: unitário: toda paleta tem 32 cores hex válidas e `paletaDe('xyz')` cai na primeira. e2e: trocar para Pixel conta no máximo 32 cores distintas numa amostra da cena (sem acabamento); desfazer volta ao Ilustrado.
Pronto quando: o e2e passa e a câmera não treme ao arrastar no Pixel.
Commit: pixelated scene with palette

### 8.1c — Pixel: materiais, pisos e terreno  ⬜
Objetivo: pisos, papéis e terrenos pintados como pixel art, não como a textura ilustrada encolhida.
Depende de: 8.1b
Ler: `spikes/estilos/src/materiais.js` (`pintarPixel`, todos os padrões); `src/procedural/materiais.ts` (`Material`, todos os `Padrao` de hoje, que são mais que os do protótipo); `src/procedural/assar.ts` (`assarComodo`, `assarTerreno`).
Arquivos: criar `src/procedural/estilos/pixel.ts`, `src/procedural/estilos/materiais-pixel.ts`, `tests/unit/materiais-pixel.test.ts`; mudar `estilos/index.ts`.
Como:
1. `pintarMaterialPixel(ctx, id, area, seed, { dir, res })`: porte de `pintarPixel` com `px = 1 / res`, para **todos** os `Padrao` do Atlas. Para padrões que o protótipo não tem (grama, terra, areia, pedra, neve, lama, laje, persa…), siga o espírito: base chapada, 2 tons (`claro`, `escuro`) em blocos de 1 a 3 px, nada de gradiente.
2. Terreno no Pixel: borda das camadas em degraus de pixel (a borda com ruído da Fase 3 continua, só que quantizada) e o aro do material em 1 px.
3. O estilo Pixel usa isto no `pintarMaterial`; `desenharPartes` ainda cai no Ilustrado.
Não fazer: objetos (8.1d); faces (8.1e).
Testes: unitário com um `OffscreenCanvas` falso não cabe; teste por e2e: com o Pixel, assar um cômodo de tábuas usa no máximo 6 cores distintas antes da paleta. Captura `test-results/fase8-materiais.png` com uma faixa de cada material de piso e de terreno.
Pronto quando: a captura mostra todos os materiais legíveis a 16 px por célula.
Commit: pixel materials

### 8.1d — Pixel: objetos e coleção  ⬜
Objetivo: os objetos das receitas e os gerados da coleção desenhados no Pixel, com contorno de 1 px e sem o detalhe que não cabe.
Depende de: 8.1c; (depois da 6) o catálogo da coleção com `origem.tipo === 'gerado'`.
Ler: `spikes/estilos/src/raster.js` (partes no Pixel, `contornar`); `src/procedural/raster.ts`; `src/procedural/descricao.ts` (`detalhe`); `src/procedural/colecao.ts`, `pesados/` (6.1b).
Arquivos: mudar `src/procedural/estilos/pixel.ts`, `src/procedural/executar.ts`; criar `tests/unit/raster-pixel.test.ts`.
Como:
1. `desenharPartesPixel`: partes ordenadas por `z`; cada uma preenchida com o material no Pixel; sombreado em 2–3 degraus pela altura (`z` alto clareia o topo, como o protótipo); sombra de contato em 1–2 px escuros; descarta `detalhe` > limite (`detalhe 3` some abaixo de 24 px por célula, `detalhe 2` abaixo de 12); `vidro` vira 2 tons com um brilho de 1 px.
2. `finalizar`: `contornar` (1 px de nanquim por fora do alfa) quando `style.pixel.outline`.
3. Coleção (depois da 6): item com `origem.tipo === 'gerado'` é assado **da descrição** (`PESADOS[gerador].gerar({ seed, params })`) no Pixel, com import dinâmico de `pesados/` só no worker; item `achado` vai para a 8.3a.
Não fazer: imagens achadas; faces de parede.
Testes: unitário puro da escolha das partes por `detalhe` e `ppc`; e2e: a casa da Fase 5 no Pixel não tem nenhum objeto como marcador (todos pintados).
Pronto quando: mesas, camas, estantes e o sofá capitonê são reconhecíveis no Pixel a 16 px por célula.
Commit: pixel objects

### 8.1e — Pixel: paredes caixa e sólidas  ⬜
Objetivo: as faces internas das paredes caixa, as faixas sólidas, portas, janelas e objetos de parede no Pixel.
Depende de: 8.1d
Ler: `src/procedural/assar.ts` (`assarComodo`, `facesDoContorno`, `profundidadeDaFace`, objetos na face); `src/render/cena.ts` (`desenharParede`, `desenharAbertura`); `docs/referencias/` (as faces da mansão).
Arquivos: mudar `src/procedural/assar.ts`, `src/procedural/estilos/pixel.ts`, `src/render/cena.ts`.
Como:
1. No Pixel, a face é pintada com o papel no Pixel e escurece em 2 degraus para a base; a junta de canto (meia-esquadria) cai na grade de pixels; a linha de topo vira 1 px claro.
2. As faixas de parede (topo), portas e janelas desenhadas pela cena (`Graphics`) passam a ter espessura em pixels inteiros do Pixel e cantos sem antialias (`roundPixels` ou desenho num `Graphics` dentro do render target pixelizado, que já resolve).
3. Objetos de parede na face: a parte `face` da descrição no Pixel.
Não fazer: telhados (já são da 7.2c; no Pixel, só quantizados pela pixelização).
Testes: captura `test-results/fase8-paredes.png` (cômodo em L com porta, janela, quadro e estante; caixa e sólido); o e2e de Pixel não tem linhas com antialias nas paredes (contagem de cores na faixa do topo).
Pronto quando: as faces se leem como as do protótipo.
Commit: pixel walls

### 8.1f — Pixel: presença e memória em blocos  ⬜
Objetivo: presença e névoa com memória com cara de pixel: blocos e dithering, sem gradiente liso.
Depende de: 8.1b; (depois da 7) a memória em esboço e a névoa.
Ler: `src/render/presenca.ts` (shader); `src/render/memoria.ts`, `nevoa.ts` (7.2a e 7.2b); `spikes/estilos/src/filtros.js` (Bayer).
Arquivos: mudar `presenca.ts`, `memoria.ts`, `nevoa.ts`.
Como:
1. Presença: no Pixel, o shader recebe `uPixel` e `uPpm` (px por metro); as coordenadas são arredondadas ao pixel do Pixel antes do ruído, e a borda da mancha usa limiar com Bayer 4×4 em vez de suavização. A pulsação muda em degraus.
2. Memória: o esboço no Pixel é o mapa em 2 cores (papel e tinta) com linhas de 1 px; a máscara do explorado, em blocos de célula da névoa com dithering na borda.
3. Névoa visível: borda em dithering.
Não fazer: transição de revelação (8.4b).
Testes: e2e: presença no Pixel numa amostra tem só cores da paleta (já garantido pela 8.1b) e não tem meio-tons fora do dithering; captura `test-results/fase8-presenca.png` e `fase8-memoria.png`.
Pronto quando: as capturas mostram blocos e dithering, sem borrão.
Commit: pixel presence and memory

### 8.2a — Gerador de sprites  ⬜
Objetivo: a folha de quadros de um personagem a partir de `Peca.sprite`, em 4 direções, parado e andando.
Depende de: —
Ler: `spikes/estilos/src/sprite.js` inteiro; `src/domain/mapa.ts` (`Peca.sprite`: `body`, `hair`, `outfit`, `accessories`, `colors`, `seed`); `src/procedural/canvas.ts`.
Arquivos: criar `src/procedural/sprite.ts`, `src/domain/sprite.ts`, `tests/unit/sprite.test.ts`.
Como:
1. `domain/sprite.ts` (puro): catálogos `CORPOS`, `CABELOS`, `ROUPAS`, `ACESSORIOS` (ids e nomes; o que o protótipo tem, mais: chapéu, óculos, capa, mochila, lanterna na mão), `CORES_PADRAO`, e `spriteAleatorio(seed): Peca['sprite']`.
2. `procedural/sprite.ts`: porte de `gerarFolha` para `OffscreenCanvas`, lendo os catálogos; `QUADRO = [16, 24]`; colunas parado 0–1, andando 0–3; linhas baixo, esquerda, direita (espelho), cima; contorno de 1 px. Função `folhaDoSprite(spec): Tela`.
3. Pedido de bake `{ tipo: 'sprite'; spec }` no worker (chave pelo JSON do spec).
Não fazer: interface; estados.
Testes: unitários de `domain/sprite.ts` (todo id do `spriteAleatorio` existe nos catálogos; mesma semente, mesmo sprite). Por e2e (`page.evaluate` importando o módulo): a folha tem 96 × 96 px e cada quadro tem pixels opacos.
Pronto quando: testes passam.
Commit: parametric sprite generator

### 8.2b — Sprite na peça e painel do sprite  ⬜
Objetivo: a peça usa o sprite (no Pixel por padrão; no Ilustrado, como opção), anda com a animação e se edita num painel com prévia animada.
Depende de: 8.2a; (depois da 7) peças com retrato (7.1a) e movimento (7.1b).
Ler: `src/render/pecas.ts`; `src/ui/Inspetor.tsx` (`CamposDaPeca`); `src/ui/campos.tsx`.
Arquivos: mudar `pecas.ts`, `Inspetor.tsx`; criar `src/ui/PainelDoSprite.tsx`.
Como:
1. Peça no Pixel: sprite, se houver; senão o retrato pixelizado pela 8.3a; senão a inicial. No Ilustrado: retrato; o sprite só aparece quando a peça tem sprite e não tem retrato.
2. Animação: parado alterna 2 quadros a 2 Hz; ao mover (7.1b), anda na direção do movimento (4 quadros a 8 Hz) enquanto desliza; `facing` escolhe a linha.
3. `PainelDoSprite`: corpo, cabelo, roupa, acessórios (múltipla escolha), cores (pele, cabelo, roupa, detalhe) com `CampoCor`, "Sortear", prévia animada nas 4 direções (canvas ampliado em `nearest`). Mudanças são `item.atualizar` em `tokens` com rótulo "Sprite da peça"; as cores usam o gesto de prévia que o inspetor já tem.
Não fazer: cores pelo retrato (8.2c).
Testes: e2e: criar um sprite pelo painel, ver a peça desenhada com ele no Pixel, mover a peça e conferir que a linha de quadros mudou com a direção (exponha o quadro atual para teste).
Pronto quando: o teste passa.
Commit: token sprites and sprite panel

### 8.2c — Cores pelo retrato e estados no sprite  ⬜
Objetivo: sugerir as cores do sprite a partir do retrato, e mostrar os estados da Ficha no sprite.
Depende de: 8.2b
Ler: `src/domain/figuras.ts` (7.1a: `aparenciaDoEstado`); `src/procedural/sprite.ts`.
Arquivos: criar `src/procedural/cores-do-retrato.ts`, `tests/unit/cores-do-retrato.test.ts`; mudar `sprite.ts`, `PainelDoSprite.tsx`, `src/render/pecas.ts`.
Como:
1. `coresDominantes(img: ImageData, k = 5): string[]` (k-médias com semente fixa sobre pixels opacos e não muito escuros nem claros) e `sugerirCoresDoSprite(cores): Peca['sprite']['colors']` (pele = a mais próxima de tons de pele; cabelo = a mais escura com saturação; roupa e detalhe = as mais saturadas restantes).
2. Painel: "Cores do retrato" quando a peça tem retrato.
3. Estados no sprite: ferido (2 px vermelhos e tinta), morrendo (pisca vermelho), inconsciente e morto (quadro deitado: a folha ganha uma linha "deitado" gerada girando o quadro parado e cortando a sombra; morto com X de 3 px), enlouquecendo (tremor de 1 px e tinta roxa). Usa `aparenciaDoEstado`.
Não fazer: ler cores da Ficha (9.2b, se a Ficha publicar).
Testes: `coresDominantes` numa imagem de 4 blocos de cor devolve as 4; a sugestão põe a cor de pele no campo de pele.
Pronto quando: um retrato vira um sprite com as mesmas cores, e os estados se distinguem a 16 px por célula.
Commit: sprite colors from portrait and figure states

### 8.3a — Derivação automática de imagens  ⬜
Objetivo: imagens (achados da coleção, retratos, importações futuras) ganham versão Pixel automática.
Depende de: 8.1d; (depois da 6) achados da coleção e a harmonização (6.3).
Ler: `src/procedural/harmonizar.ts` (6.3a, funções sobre `ImageData`); `src/procedural/executar.ts` (pedido `imagem`); `src/domain/paletas.ts`.
Arquivos: criar `src/procedural/derivar-pixel.ts`, `tests/unit/derivar-pixel.test.ts`; mudar `executar.ts`.
Como:
1. `derivarPixel(img: ImageData, alvo: { largura; altura }, paleta: string[], o: { dither: boolean; contorno: boolean }): ImageData`, pura: redução por moda de cor por bloco (preserva bordas melhor que média), alfa binário (limiar 0,5), mapeamento para a paleta com Bayer opcional, contorno de 1 px.
2. O pedido `imagem` com estilo Pixel harmoniza (se ligado) e depois deriva no tamanho da pegada em px do Pixel.
3. Retratos de peças no Pixel (quando não há sprite) passam pelo mesmo caminho, recortados em círculo.
Não fazer: `pixelArquivo` (8.3b).
Testes: unitários com imagens pequenas: um tabuleiro 2×2 reduzido mantém 2 cores; borda dura continua dura; toda cor de saída está na paleta.
Pronto quando: um achado aparece no Pixel coerente com os objetos procedurais ao lado.
Commit: automatic pixel derivation for images

### 8.3b — `pixelArquivo` manual  ⬜
Objetivo: um item da coleção pode ter uma versão Pixel feita à mão, que tem prioridade sobre a derivada.
Depende de: 8.3a
Ler: `src/procedural/colecao.ts` (`ItemDaColecao`, `validarColecao`); `tests/unit/colecao.test.ts`.
Arquivos: mudar `colecao.ts`, `tests/unit/colecao.test.ts`, `executar.ts`, `src/render/entradas.ts`, `docs/LICENCAS.md` (se o arquivo manual for achado).
Como:
1. `ItemDaColecao.pixelArquivo?: string` (relativo a `public/colecao/`, PNG em escala 1:1 do Pixel a 16 px por célula). Validação: o arquivo existe; entra na conta de tamanho; se for de terceiros, licença registrada.
2. No Pixel, com `pixelArquivo`, o render usa o arquivo (reescalado em `nearest` para outros `pixelsPerCell`, só por múltiplos inteiros; senão, derivado), sem harmonização de cor e sem derivação.
Não fazer: editor de pixel.
Testes: validação da coleção com e sem `pixelArquivo`; unitário da escolha de fonte (manual > derivada).
Pronto quando: um item com versão manual usa a manual no Pixel.
Commit: manual pixel art override

### 8.4a — Luz em faixas  ⬜
Objetivo: no Pixel, a luz cai em degraus de borda dura, mantendo a cor.
Depende de: 8.1b
Ler: `spikes/estilos/src/filtros.js` (`filtroFaixas`); `spikes/estilos/src/main.js` (`luzFaixasRT`); `src/render/mapa-de-luz.ts` (render targets, desfoque, `RES_LUZ`).
Arquivos: mudar `mapa-de-luz.ts`; criar `src/render/faixas.ts`.
Como:
1. No Pixel, o mapa de luz é feito na resolução do Pixel (`ppc / grid.size`), sem desfoque, e passa pelo filtro de faixas (5 degraus; preferência no estilo: 3 a 8) antes de multiplicar a cena. `nearest` em tudo.
2. A tremulação das chamas muda o raio em passos de pixel, não a intensidade contínua (senão as faixas cintilam).
3. Relâmpago e janelas (4.1d e 4.3b) passam pelo mesmo caminho.
Não fazer: sombras diferentes das do Ilustrado.
Testes: e2e: no Pixel, a intensidade da luz numa linha do centro de uma lamparina para fora tem no máximo 6 valores distintos.
Pronto quando: a lamparina no Pixel tem anéis nítidos e a cor quente se mantém.
Commit: banded light for pixel style

### 8.4b — Revelação em dithering e fonte pixel  ⬜
Objetivo: no Pixel, o que entra na vista aparece por dissolução em dithering, e os textos do mapa e do projetor usam uma fonte pixel.
Depende de: 8.1f; (depois da 7) revelação animada (7.2c) e projetor (7.5b).
Ler: `src/render/nevoa.ts` (transição da 7.2c); `src/render/cena.ts` (cartela de título); `src/ui/Projetor.tsx`; `package.json` (fontes `@fontsource`).
Arquivos: mudar `nevoa.ts`, `cena.ts`, `Projetor.tsx`, `package.json`, `docs/LICENCAS.md`, `src/ui/estilo.css`.
Como:
1. A máscara do visível no Pixel não é suavizada: cada célula da névoa entra por um limiar de Bayer que cresce com o tempo (a mesma duração da 7.2c).
2. Fonte pixel com licença OFL instalada por `@fontsource` (escolha uma que tenha acentos do português, como Pixelify Sans; confira os glifos de "ção" e "ê"), registrada em `LICENCAS.md`. No Pixel, a cartela de título e a moldura do projetor usam essa fonte, renderizada em tamanho inteiro e `nearest`.
Não fazer: fonte pixel na interface do editor (só no mapa e no projetor).
Testes: e2e: revelar no Pixel tem um quadro intermediário com dithering (contagem de pixels parcialmente revelados num bloco); captura do título em pixel.
Pronto quando: revelar no Pixel dissolve em vez de esmaecer, e o título se lê com acentos.
Commit: dithered reveal and pixel font

### 8.4c — Partículas, neblina e transição de clima no Pixel  ⬜
Objetivo: chuva, neve, poeira, brasas, folhas, neblina e a mistura de climas com cara de Pixel (pendência da Fase 4).
Depende de: 8.1b, 8.4a
Ler: `src/render/particulas.ts`, `particulas-config.ts`, `neblina.ts`; `spikes/estilos/src/main.js` (`criarChuva` no Pixel: gotas de 1 × 3 px); `src/render/viewport.ts` (transição de clima).
Arquivos: mudar `particulas.ts`, `particulas-config.ts`, `neblina.ts`, `viewport.ts`.
Como:
1. Partículas no Pixel: texturas próprias em pixels inteiros (gota 1 × 3, floco 1 × 1 ou 2 × 2, brasa 1 × 1 com 2 cores, folha 2 × 2), posições arredondadas ao pixel do Pixel, sem rotação contínua. Elas entram no render target pixelizado (passam pela paleta).
2. Neblina no Pixel: o ruído em blocos com limiar de Bayer, em 2 ou 3 níveis.
3. Transição de clima no Pixel: a mistura dos parâmetros continua contínua, mas a luz e a neblina já caem em degraus, então nada muda no código da mistura; confira que não cintila.
Não fazer: tipos de partícula novos.
Testes: e2e: tempestade no Pixel conta partículas como no Ilustrado (mesma quantidade) e a amostra só tem cores da paleta; quadros por segundo em 60 com tempestade.
Pronto quando: os climas da Fase 4 funcionam no Pixel sem nada liso fora de lugar.
Commit: pixel particles and fog

### 8.5 — Validação da fase  ⬜
Objetivo: provar o critério de pronto e registrar o relatório.
Depende de: todas
Ler: `tests/e2e/fase7.test.ts` (a sessão no projetor).
Arquivos: criar `tests/e2e/fase8.test.ts`; mudar `progress.md`.
Como:
1. e2e `fase 8: a casa no Pixel`: o mapa da validação da Fase 7, **sem alterar o documento** (compare o JSON antes e depois, fora `style`); trocar para Pixel; jogar o roteiro da 7.7 no projetor (duas peças, portas, climas, revelar, interruptor); trocar para Ilustrado e de volta no meio da sessão, ao vivo; medir o tempo até não haver nada pintando depois de cada troca e os quadros por segundo nas duas janelas.
2. Capturas lado a lado de cada momento nos dois estilos (`test-results/fase8-*-ilustrado.png` e `-pixel.png`).
3. progress.md: resumo da fase, números (tempo de troca, FPS, cores) e "Próximo: Fase 9".
Não fazer: consertar desenho aqui além de ajuste de número; o resto vira pendência.
Testes: os acima, mais `npm run typecheck`, `npm test`, `npm run test:e2e`.
Pronto quando: tudo passa e o relatório está no progress.md.
Commit: validate phase 8
