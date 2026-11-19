# Frente L — Fidelidade de render (luz com relevo, HDR, oclusão e paredes com face)

Frente aberta em 2026-11-18, depois que o *Santuário da luz* foi apagado (três rodadas sem chegar perto da referência). As referências do usuário são o santuário e a sala da guarda (render 3D escuro, tochas quentes), o acampamento orc (pintado em sépia), o jardim do colosso (render 3D diurno, sombras longas) e três interiores pintados (dois quartos e uma cabana). O alvo **não é 3D**: é um 2D pintado com luz que reage ao relevo, no nível de Dungeondraft e Forgotten Adventures.

**Quem implementa:** as fichas **[Gemini]** são de motor e vão para o Gemini 4 Hydrogen; cada uma traz o que ler, o que mudar e como verificar. As fichas **[Opus]** são de desenho (materiais, receitas, mapas) e o Opus faz diretamente, como na Frente K. Regras de fechamento no [README](README.md): `npm run typecheck` e `npm test` passando, ficha marcada ✅, uma linha no [progress.md](../../progress.md), um commit por ficha.

**Mapa de teste:** o santuário, refeito na L11 sobre a referência `docs/referencias/exemplos/santuario-da-luz.png`. Depois dele vêm a sala da guarda, a mansão e o jardim do colosso (L12).

---

## Diagnóstico: o que as referências têm e o motor não

Comparação lado a lado de `test-results/fase10-sala-da-guarda.png` e `fase10-mansao-da-ilha.png` com as referências. Em ordem de impacto:

1. **A luz não realça as superfícies, só tinge.** O `MapaDeLuz` ([mapa-de-luz.ts](../../src/render/mapa-de-luz.ts)) é uma textura de 8 bits a 8 px/m que **multiplica** a cena (`sprite.blendMode = 'multiply'`). Multiplicar por um valor ≤ 1 nunca passa da cor de base: uma mesa sob a tocha volta, no máximo, à cor que tem de dia. Nas referências, a madeira sob a vela fica *mais clara e saturada* que a cor de base (sobre-exposição quente), e o resto cai no azul escuro. Falta **luz em HDR** (acima de 1) com **curva de tom**.
2. **A luz não sabe de que lado vem.** Uma tocha ilumina por igual as duas bordas de uma laje, de um degrau ou de uma tábua. Nas referências, a junta do lado da luz brilha e a do outro lado escurece: é isso que dá relevo. Falta **normal por pixel** e **direção da luz por pixel**.
3. **Nada assenta no chão.** Faltam oclusão de contato e de canto: escuro no pé das paredes, nas juntas, embaixo e em volta dos móveis, nos cantos dos cômodos. A K9 pôs um pouco de AO dentro de cada objeto, mas não existe AO *entre* objeto e chão nem entre parede e chão.
4. **Paredes são linhas.** As paredes são traços vetoriais em `desenharParede` ([cena.ts](../../src/render/cena.ts)). Nos interiores de referência, as paredes têm **topo grosso e escuro** e **face interna visível** (papel de parede, rodapé, quadros e janelas *na face*), como se olhássemos de cima para dentro de uma caixa. Na sala da guarda e no santuário, as paredes são alvenaria com altura, com o topo claro e a face na sombra.
5. **Fogo e brilho sem bloom.** O fogo é um desenho com `brilho` aditivo ([raster.ts](../../src/procedural/raster.ts)), e o halo é um degradê. Falta o **estouro** (núcleo branco saturado, bloom amplo e quente) e a **cintilação na própria chama**.
6. **Textura rasa e uniforme.** O terreno sai a 24 px/m e os cômodos a 64 px/m (`resolucao` em [ilustrado.ts](../../src/procedural/estilos/ilustrado.ts)). Nas referências, cada tábua e cada laje tem tom próprio, bisel, desgaste e sujeira nas juntas. Os padrões atuais em [materiais.ts](../../src/procedural/materiais.ts) variam pouco de peça a peça e não têm altura (necessária para os itens 2 e 3).
7. **Cor sem direção.** As referências têm gradação dividida: sombras puxadas para azul-petróleo e luzes para âmbar (sala da guarda), ou monocromia sépia (acampamento). O `acabamento` tem saturação, tinta, lift/gamma/gain, mas não **tonalização dividida** (uma cor para as sombras e outra para as luzes).
8. **Estrutura com altura não existe como peça.** Escadas, estrados, muralhas e plataformas são desenhos planos de receitas soltas, cada uma com o próprio sol (foi o que gerou as paredes duplicadas do santuário). Falta uma **família de receitas estruturais** que usem o material do piso e a mesma convenção de luz.

O que **já existe** e esta frente aproveita: oclusão de luz por paredes, objetos altos e peças (K4/K5), relevo em patamares (Frente F), `Parte.z` em toda receita (altura de cada parte, já usada para ordenar e para a sombra), AO interna de objetos (K9), halos e raios ([halos.ts](../../src/render/halos.ts)) e o filtro de acabamento ([acabamento.ts](../../src/render/acabamento.ts)).

---

## Arquitetura

A ideia central é um **passo de luz em tela cheia** que substitui a multiplicação simples:

```
cena (cores de base) ──┐
mapa de altura ────────┼──► filtro "luz com relevo" ──► bloom ──► acabamento (tom + gradação)
mapa de luz (HDR) ─────┤        cor = base × (ambiente + luz × sombreamento(N·L)) + AO
mapa de direção ───────┘
```

- **Mapa de luz HDR** (L1): o mesmo `MapaDeLuz` de hoje (oclusão por paredes, objetos e peças), mas guardando valores até 4 em vez de até 1.
- **Mapa de direção** (L2): uma segunda textura, do mesmo tamanho e com a mesma oclusão, em que cada luz soma o *vetor* da direção até ela, pesado pela intensidade. Com isso, cada pixel sabe de onde vem a luz dominante sem que o shader precise percorrer a lista de luzes.
- **Mapa de altura** (L3 e L4): cada desenho assado (terreno, cômodo, objeto) ganha uma tela irmã em tons de cinza com a altura. Para objetos, a altura vem de `Parte.z`. Para materiais, vem de um pintor de altura por padrão; o padrão que ainda não tiver o dele usa a luminância da cor como aproximação. A cena de altura é montada com os mesmos sprites e transformações da cena de cor.
- **Filtro de luz com relevo** (L5): calcula a normal a partir do mapa de altura (Sobel), faz `N·L` com o mapa de direção, aplica o mapa de luz HDR e a AO derivada da altura (L6), e devolve a cor em HDR.
- **Bloom e curva de tom** (L7 e L8): o brilho acima de 1 vaza em bloom; o acabamento ganha curva de tom (ACES aproximada) e tonalização dividida.

Tudo isso fica **só no estilo Ilustrado**. O Pixel continua com o caminho atual (ver memória "Pixel em espera"): toda ficha deve manter o Pixel funcionando e com os testes passando, sem gastar esforço nele.

**Desempenho:** os mapas de luz e direção ficam a 8 px/m (a luz é suave). O mapa de altura acompanha a resolução da tela, porque é ele que dá o detalhe. O filtro de luz roda uma vez por quadro em tela cheia, como o acabamento já faz. Quando o desempenho cair abaixo do aceitável (ver L5), existe a opção `relevo: false` no mapa, que volta ao caminho atual.

---

## Índice

| Ficha | Quem | O quê | Depende de | Estado |
|---|---|---|---|---|
| [L1](#l1--mapa-de-luz-em-hdr) | Gemini | Mapa de luz em ponto flutuante, valores até 4, composição por filtro em vez de `multiply` | — | ✅ |
| [L2](#l2--mapa-de-direção-da-luz) | Gemini | Segunda textura com a direção da luz dominante, mesma oclusão | L1 | ✅ |
| [L3](#l3--altura-nos-desenhos-assados-objetos) | Gemini | Tela de altura irmã para objetos assados, a partir de `Parte.z` | — | ✅ |
| [L4](#l4--altura-de-terreno-e-cômodos-e-cena-de-altura) | Gemini | Altura de terreno e cômodos (luminância como reserva) e a cena de altura montada em paralelo | L3 | ✅ |
| [L5](#l5--filtro-de-luz-com-relevo) | Gemini | Filtro em tela cheia: normal por Sobel, `N·L`, luz HDR; chave `relevo` | L1, L2, L4 | ✅ |
| [L6](#l6--oclusão-de-contato-e-de-canto) | Gemini | AO derivada da altura no mesmo filtro + AO no pé das paredes | L5 | ✅ |
| [L7](#l7--bloom-e-fogo-emissivo) | Gemini | Bloom do que passa de 1; partes `brilho` marcam emissão | L5 | ✅ |
| [L8](#l8--curva-de-tom-e-tonalização-dividida) | Gemini | ACES aproximado e `finish.split` (sombras/luzes) no acabamento | L5 | ✅ |
| [L9](#l9--paredes-com-topo-e-face-interna) | Gemini + Opus | Parede com topo e face interna visível, material por cômodo, objetos de parede na face | — | 🟡 (1–4 ✅, falta 5 [Opus]) |
| [L10](#l10--materiais-com-altura-e-variação-por-peça) | **Opus** | Pintores de altura e variação peça a peça nos padrões de piso principais; resolução do terreno | L4 | ✅ |
| [L11](#l11--estruturas-com-altura-fogo-e-o-santuário) | **Opus** | Família `estrutura.*` (estrado, escadaria, muralha, plataforma), fogo novo e o santuário refeito | L5–L10 | ⬜ |
| [L12](#l12--exemplos-revistos-e-guia) | **Opus** | Sala da guarda, mansão e jardim revistos; guia do assistente atualizado | L11 | ⬜ |

As fichas L1–L4 e L9 podem andar em paralelo (L1 → L2 numa sessão; L3 → L4 em outra; L9 em outra).

---

## L1 — Mapa de luz em HDR  ✅

**Objetivo:** a luz pode passar de 1 (sobre-exposição quente), e a composição deixa de ser `multiply` de 8 bits.

**Depende de:** —

**Ler:**
- [src/render/mapa-de-luz.ts](../../src/render/mapa-de-luz.ts) inteiro, em especial `RenderTexture.create` (linha ~54), os `alpha` de `s`, `s2`, `s3` (linhas ~66–70, que hoje empilham três sprites para simular intensidade > 1) e o cálculo do ambiente (`Math.min(1, …)`, linhas ~139–175).
- A ordem das camadas em [src/render/cena.ts](../../src/render/cena.ts), linha ~112 (`raiz.addChild(…)`): `luz.sprite` fica entre `presenca.abaixo` e `presenca.acima`.
- [src/render/acabamento.ts](../../src/render/acabamento.ts), para o padrão de `Filter` com `GlProgram` e `UniformGroup` usado no projeto.

**Arquivos:** mudar `src/render/mapa-de-luz.ts`, `src/render/cena.ts`; criar `src/render/composicao-de-luz.ts`.

**Como:**
1. Crie `brutaRT` e `finalRT` com `format: 'rgba16float'` quando o renderizador for WebGL2 ou WebGPU (`renderer.context.webGLVersion === 2` ou `renderer.type` WebGPU). Senão, mantenha 8 bits e guarde `luz / ESCALA_HDR` com `ESCALA_HDR = 4`, decodificando no filtro. Exporte `ESCALA_HDR` e uma função `formatoDaLuz(renderer): { formato; escala }`.
2. Troque o empilhamento `s/s2/s3` por um sprite só com `alpha = k / escala` (no caminho de 16 bits, `escala = 1` e a cor da luz pode passar de 1 via `tint` com intensidade aplicada como `alpha` acima de 1, o que o blend aditivo em float aceita). Remova o `Math.min(1, …)` do ambiente no caminho HDR.
3. Pare de pôr `luz.sprite` na cena com `multiply`. Agrupe em `cena.ts` todas as camadas **abaixo** de `luz.sprite` (de `terrenoC` até `presenca.abaixo`) num `Container` novo, `mundoIluminado`, e aplique a ele um `Filter` de [composicao-de-luz.ts](../../src/render/composicao-de-luz.ts) que lê a textura de luz (como `uniform sampler2D uLuz` com a matriz mundo → UV da luz) e faz `cor.rgb * luz.rgb * escala`. Nesta ficha o resultado deve ser **visualmente igual** ao de hoje quando nenhuma luz passa de 1.
4. Clampe a saída do filtro em 1 por enquanto (a curva de tom vem na L8). A diferença visível desta ficha é só que luzes com `intensity > 1` deixam de saturar no branco da cor de base.
5. Pixel: mantenha o caminho atual (`multiply`, 8 bits, faixas). Separe por `estilo === 'pixel'`.

**Decisão (2026-11-18, depois da conferência do Gemini):** no Pixi 8.22.0, `Sprite.alpha` é limitado a [0, 1] e guardado em 8 bits (`updateRenderGroupTransforms.mjs`), e o `FilterSystem` e o `BlurFilter` pegam texturas temporárias do `TexturePool` sem formato, isto é, em 8 bits. Por isso os passos 1–2 valem com estas trocas (opção A):
- cada luz é desenhada com `Mesh` + `Shader` próprio (`uCor` e `uIntensidade` num `UniformGroup` f32, sem limite em 1), com `blendMode = 'add'` e a mesma máscara do polígono;
- o desfoque do Ilustrado sai de `composicao.filters = [blur]` e vira duas passadas gaussianas separáveis (H e V) feitas à mão com `Mesh` em tela cheia, entre `brutaRT`, uma `desfoqueRT` e `finalRT`, todas no mesmo formato;
- o formato float exige WebGL2 **com** `EXT_color_buffer_float` (`renderer.context.extensions.colorBufferFloat`, acessível só quando o renderizador é `WebGLRenderer`). Sem isso (WebGL1, WebGPU nesta versão), use 8 bits com `ESCALA_HDR = 4` e o mesmo caminho de `Mesh`;
- o Pixel continua no caminho atual;
- linhas atuais em `mapa-de-luz.ts`: `RenderTexture.create` ~193, `s/s2/s3` ~202–211, ambiente ~278–314.

**Não fazer:** normal, direção, bloom, curva de tom. Não mude o cálculo de oclusão.

**Testes:** em `tests/unit/luzes.test.ts`, teste puro de `formatoDaLuz` (WebGL1 → 8 bits com escala 4; WebGL2 → float com escala 1) e da codificação `codificarLuz(v, escala)` / `decodificarLuz`. Abra `public/exemplos/sala-da-guarda.atlas.json` no app (`npm run dev`) e confira que nada escureceu nem estourou.

**Pronto quando:** o mapa de luz é float em WebGL2, a cena é composta por filtro e o resultado é igual ao de antes para intensidades ≤ 1.

**Nota:** o teste estrutural em `tests/unit/presenca-camada.test.ts` foi atualizado para ler a ordem das camadas entre `mundoIluminado.addChild` e `raiz.addChild`. Conferido no Chromium (`sala-da-guarda`, `fase10-halos.test.ts` 3/3 e `intensity=1` vs `3` linear 10→29); em `fase4.test.ts` apenas os testes legados que ainda clicavam fora da parede (`janelas`, `relâmpago`, `janelas acesas`) ou esperavam `finish.preset === 'frio'` continuam com a regressão anterior à Frente L.

**Commit:** `light map is now hdr and composited by a filter`

---

## L2 — Mapa de direção da luz  ✅

**Objetivo:** cada pixel sabe a direção (no plano) da luz dominante e se ela vem de cima ou rasante.

**Depende de:** L1.

**Ler:** `criar(l)` e `atualizar(g, l)` em [mapa-de-luz.ts](../../src/render/mapa-de-luz.ts) (cada luz é um `Container` com sprite aditivo e máscara do polígono iluminado); `texturaDeBrilho` em [luzes.ts](../../src/render/luzes.ts).

**Arquivos:** mudar `src/render/mapa-de-luz.ts`, `src/render/luzes.ts`; mudar `src/render/composicao-de-luz.ts`.

**Como:**
1. Em `luzes.ts`, crie `texturaDeDirecao()`: textura 256 × 256 em que o pixel `(u, v)` (com `d = (u, v) − centro`, normalizado pelo raio) guarda `R = 0.5 − 0.5·dx·f`, `G = 0.5 − 0.5·dy·f`, `B = f`, com `f` a mesma queda de `texturaDeBrilho`. Ou seja: o vetor que aponta **do pixel para a luz**, pesado pela intensidade. Use float se disponível (mesma regra da L1); em 8 bits, guarde já com o deslocamento de 0,5.
2. Para cada luz, crie um segundo sprite com essa textura, na mesma posição, escala, máscara (o mesmo polígono de oclusão) e `alpha` que o sprite de brilho, mas **sem** a cor da luz (branco) e numa raiz separada, `raizDirecao`. Renderize `raizDirecao` numa `direcaoRT` do mesmo tamanho e formato de `finalRT`, com blend aditivo e o mesmo desfoque. Use o mesmo caminho da L1 (`Mesh` por luz e desfoque à mão, sem `filters`), porque a soma de várias luzes passa de 1.
3. Os campos `R` e `G` se somam entre luzes: o resultado, depois de subtrair `0.5 × soma de B`, é a soma vetorial pesada. Essa correção fica no shader da L5, não aqui.
4. Exponha `direcao: Texture` em `MapaDeLuz` e passe-a para o filtro de composição como `uDirecao`. Nesta ficha o filtro só a recebe; o uso vem na L5. Adicione um modo de depuração `?luz=direcao` (query string, lido em `composicao-de-luz.ts`) que mostra `normalize(xy)` como cor, para conferir.
5. Altura da luz: não acrescente campo em `Luz`. O shader da L5 usa uma altura fixa `ALTURA_DA_LUZ = 1.6` m (tocha na parede), e `feixe`/luz com `rays` usa 6 m (vem do alto). Exporte a constante.

**Não fazer:** usar a direção para iluminar (L5).

**Testes:** teste puro do pixel de `texturaDeDirecao` (centro com `B = 1` e `R = G = 0.5`; borda direita com `R < 0.5`). Conferência visual com `?luz=direcao` no `sala-da-guarda`: as cores giram em volta de cada tocha e somem atrás das paredes.

**Pronto quando:** `direcaoRT` acompanha o mapa de luz (mesmo tamanho, oclusão e desfoque) e o modo de depuração mostra as setas certas.

**Nota:** `pixelDeDirecao` codifica `((0.5 − 0.5·dx)·f, (0.5 − 0.5·dy)·f, f, f)` (com `(0.5 − 0.5·dx)` multiplicado por `f`) para que `d.rg − 0.5·d.b` recupere exatamente a soma vetorial pesada e dê zero fora do círculo/atrás das paredes; `texturaDeDirecao` usa `BufferImageSource` (`alphaMode: 'no-premultiply-alpha'`) em `rgba16float` (via `floatParaHalf`) ou `rgba8unorm`. Em `mapa-de-luz.ts`, cada luz tem seu `meshDir` e máscara própria em `raizDirecao`, reutilizando `desfoqueRT` para o blur separável até `direcaoRT`. Conferido no Chromium em `sala-da-guarda` com `?luz=direcao` (`test-results/l2-direcao.png`) e `tests/e2e/fase10-halos.test.ts` (3/3).

**Commit:** `light map also tracks the light direction`

---

## L3 — Altura nos desenhos assados: objetos  ✅

**Objetivo:** cada objeto assado vem com uma tela de altura (cinza 0–1) alinhada à tela de cor.

**Depende de:** —

**Ler:**
- `desenharPartes` em [src/procedural/raster.ts](../../src/procedural/raster.ts) (ordena por `z`, desenha sombra, corpo, volume e contorno).
- [src/procedural/baker.ts](../../src/procedural/baker.ts) e [bake.worker.ts](../../src/procedural/bake.worker.ts): o que o worker devolve (a tela e a origem).
- `Parte` em [src/procedural/descricao.ts](../../src/procedural/descricao.ts).

**Arquivos:** criar `src/procedural/altura.ts`; mudar `raster.ts`, `baker.ts`, `bake.worker.ts`, o tipo do resultado do assado e a entrada correspondente em [src/render/cena.ts](../../src/render/cena.ts) (só para guardar a textura de altura ao lado da de cor; ainda não usada).

**Como:**
1. Em `altura.ts`, `desenharAlturaDasPartes(ctx, partes, { res })`: mesma ordem por `z` de `desenharPartes`, mesma geometria, mas cada parte preenche com cinza `v = clamp(z / ALTURA_MAXIMA)` (`ALTURA_MAXIMA = 4` m). Partes com `suave`, `desfoque`, `brilho`, `alfa < 0.5` ou `semSombra` **não** escrevem altura. Partes com `raio` (arredondadas) ganham um domo: `v` no centro, caindo 15% na borda (degradê radial), para dar volume a barris e almofadas.
2. Sem traço, sem sombra, sem AO: a tela de altura é limpa. Fundo transparente = altura 0.
3. O worker passa a devolver `{ tela, altura, origem, res }` (a `altura` como `ImageBitmap` do mesmo tamanho). Só no Ilustrado; no Pixel, `altura: null`.
4. Na `Entrada` de objeto em `cena.ts`, guarde `texAltura` ao lado da textura. Libere junto quando a entrada for destruída (siga o padrão de `chaveTextura`).
5. Cache: a altura entra na mesma chave do objeto (não é um assado separado).

**Não fazer:** terreno e cômodos (L4); montar a cena de altura (L4); objetos de parede (`DescricaoDeParede`) ficam com `altura: null` até a L9.

**Testes:** `tests/unit/altura.test.ts`: uma descrição com duas partes (z 0,4 e 1,2) produz pixels de altura 0,1 e 0,3 nas posições certas; parte `brilho` não escreve. Use o canvas de teste que `tests/unit/raster*.test.ts` já usa.

**Pronto quando:** todo objeto Ilustrado assado chega à cena com `texAltura`, sem mudança visual.

**Nota:** `desenharAlturaDasPartes` e `ALTURA_MAXIMA` (`4` m) em `src/procedural/altura.ts` reutilizam `ordenarPartes`, `caixaDe` e `caminho` de `src/procedural/raster.ts`; `assarDescricao` (`src/procedural/assar.ts`) gera a tela irmã apenas no Ilustrado para `tipo === 'piso'` (`null` para Pixel e `DescricaoDeParede`); `ResultadoDeBake.altura` (`src/procedural/executar.ts`) é transferido em `src/procedural/bake.worker.ts` (com `src/procedural/baker.ts` preservando o tipo automaticamente) e armazenado/liberado em `Entrada.texAltura` e `texturas` em `src/render/cena.ts`. Conferido em `tests/unit/altura.test.ts` (3/3), `tests/e2e/fase6.test.ts` (5/5) e no Chromium com Web Worker e `OffscreenCanvas`.

**Commit:** `baked objects also carry a height map`

---

## L4 — Altura de terreno e cômodos, e a cena de altura  ✅

**Objetivo:** existe uma textura de altura da tela inteira, montada com os mesmos sprites da cena.

**Depende de:** L3.

**Ler:** `pintarMaterial` em [materiais.ts](../../src/procedural/materiais.ts) (despacha por `padrao`); [assar.ts](../../src/procedural/assar.ts) (terreno, cômodos, degraus, relevo); `cena.ts` linhas ~110–190 (como terreno, cômodos e objetos viram sprites).

**Arquivos:** mudar `src/procedural/altura.ts`, `materiais.ts` (só o registro), `assar.ts`, `src/render/cena.ts`; criar `src/render/cena-de-altura.ts`.

**Como:**
1. Registro de pintores de altura: em `altura.ts`, `PINTORES_DE_ALTURA: Partial<Record<Padrao, (ctx, mat, area, seed, px) => void>>`, vazio nesta ficha (o Opus preenche na L10). `pintarAlturaDoMaterial(ctx, id, area, seed, o)`: se o padrão tem pintor, usa; senão, **reserva por luminância**: pinta o material em cor numa tela temporária, converte para luminância, aplica passa-alta (luminância menos a média borrada com raio de 0,5 m) e grava `0.5 + 0.35 × passaAlta`. Isso dá juntas mais baixas e peças mais altas na maioria dos padrões.
2. Em `assar.ts`, o assado de terreno e de cômodo produz a tela de altura em paralelo: base 0,5 para piso, mais o relevo do terreno (os patamares da Frente F: `0.5 + altura_do_patamar / 40`, saturado), e os degraus (`pintarDegrausConstruidos`) com a altura de cada degrau. Devolva junto como na L3.
3. `cena-de-altura.ts`: um `Container` paralelo, `alturaC`, que espelha `terrenoC`, `comodosC` e `objetosC` (mesmas posições, escalas, rotações e ordem), com sprites que usam `texAltura`. Objetos somam a altura sobre o chão: use `blendMode = 'max'` (ou `lighten`) para que o objeto nunca afunde abaixo do piso. Renderize `alturaC` numa `alturaRT` com a mesma câmera da cena, a cada quadro em que a câmera ou o conteúdo mudar (não a cada quadro parado).
4. Exponha `alturaRT` para o filtro de composição como `uAltura` (com a mesma matriz de tela da cena). Modo de depuração `?luz=altura`.

**Não fazer:** usar a altura para iluminar (L5). Não escreva pintores de padrão (L10).

**Testes:** puro: a reserva por luminância de um padrão `laje` dá valor menor nas juntas que no miolo da laje (amostre os pixels sabidos de junta e de miolo). Visual: `?luz=altura` no `sala-da-guarda` mostra lajes, mesas e caixotes em relevo.

**Pronto quando:** `alturaRT` acompanha a câmera, com terreno, cômodos e objetos.

**Nota:** `PINTORES_DE_ALTURA` (vazio), `alturaPorLuminancia` (passa-alta de luminância com média móvel de raio `RAIO_PASSA_ALTA = 0.5` m) e `pintarAlturaDoMaterial` em `src/procedural/altura.ts` (reutilizando `pxDe` exportado de `src/procedural/materiais.ts`); `assarComodo` (piso + `pintarAlturaDegrausConstruidos`) e `assarTerreno` (base, camadas, maciço/água e patamares de relevo via `comporAltitudeDoRelevo` somando `alt / 40`) em `src/procedural/assar.ts`, com `altura: null` no Pixel. Em `src/render/cena-de-altura.ts`, `chaoAlturaC` renderiza em `alturaRT`, `objetosAlturaC` (com `blendMode = 'max'`) renderiza em `objetosRT` e soma em `alturaRT` via `objetosAddC` (`blendMode = 'add'`), para que móveis abaixo de `2` m (`z / ALTURA_MAXIMA < 0.5`) somem sobre a base `0.5` do piso sem soma dupla em sobreposições; atualização só quando câmera, tela ou conteúdo mudam, ligada a `uAltura` / `uAlturaMatriz` / `?luz=altura` em `src/render/composicao-de-luz.ts` e `src/render/cena.ts`. Conferido em `tests/unit/altura.test.ts` (5/5), `tests/unit/luzes.test.ts`, `tests/e2e/fase6.test.ts` + `fase10-halos.test.ts` (8/8) e no Chromium com `?luz=altura` em `sala-da-guarda` (`test-results/l4-altura.png`) inclusive após pan + zoom.

**Commit:** `terrain and rooms carry height and the scene has a height pass`

---

## L5 — Filtro de luz com relevo  ✅

**Objetivo:** a luz realça as superfícies do lado de onde vem e escurece o lado oposto.

**Depende de:** L1, L2, L4.

**Ler:** o filtro de `composicao-de-luz.ts` (L1) e as três texturas: `uLuz`, `uDirecao`, `uAltura`.

**Arquivos:** mudar `src/render/composicao-de-luz.ts`; mudar `src/domain/mapa.ts` e `src/domain/validacao.ts` (campo `finish.relief`); mudar `src/app/ponte-escrita.ts` (expor em `atlas_ambiente`, junto do acabamento que ela já edita, `Acabamento` em `src/domain/mapa.ts`) e regenerar `scripts/ponte/catalogo-base.json` como as fichas K fizeram.

**Como (shader):**
```glsl
// h(p) = altura em metros (amostra × ALTURA_MAXIMA); passo = 1 texel da alturaRT
vec3 N = normalize(vec3(-(hR - hL) * uForca, -(hD - hU) * uForca, 2.0 * passoEmMetros));
vec4 d = texture(uDirecao, uvLuz);            // L2
vec2 dirXY = (d.rg - 0.5 * d.b) / max(d.b, 1e-3);   // direção pesada, em −1..1
vec3 L = normalize(vec3(dirXY, uAlturaDaLuz / uAlcance));
float lambert = clamp(dot(N, L), 0.0, 1.0);
float plano = L.z;                             // o que um chão liso receberia
float realce = lambert / max(plano, 0.25);     // > 1 no lado virado para a luz, < 1 no oposto
vec3 luz = texture(uLuz, uvLuz).rgb * uEscala;
vec3 ambiente = uAmbiente * (0.75 + 0.25 * N.z); // o céu ilumina mais o que está virado para cima
vec3 cor = base * (ambiente + (luz - uAmbiente) * mix(1.0, realce, uRelevo));
```
- `uAmbiente` é a cor de ambiente que o `MapaDeLuz` já calcula (passe-a como uniform). A diferença `luz − ambiente` é a parte que vem das luzes, a única que ganha direção.
- `uForca` (padrão 3) e `uRelevo` (`finish.relief`, 0–1, padrão 0,7) controlam a força. `relief: 0` dá exatamente o resultado da L1 e é o desligamento.
- Pixel: o filtro não é aplicado.

**Desempenho:** meça em `npm run dev` com o `porto-noturno` (o maior em luzes) no notebook do usuário: anote os quadros por segundo antes e depois na linha "Nota:" da ficha. Se cair mais de 25%, reduza a `alturaRT` à metade da resolução de tela e anote.

**Não fazer:** AO (L6), bloom (L7), curva de tom (L8).

**Testes:** puro em `tests/unit/luzes.test.ts`: a função TypeScript espelho `realceDoRelevo(N, L)` (mesma fórmula, exportada para teste) dá 1 para chão liso, > 1 para normal inclinada para a luz, < 1 para a inclinada contra. Validação de `finish.relief` em `tests/unit/validacao*.test.ts`. Visual: `sala-da-guarda` com `relief` 0 e 0,7 lado a lado em `test-results/l5-relevo.png`.

**Pronto quando:** juntas de laje e bordas de tábua acendem do lado da tocha; `relief: 0` volta ao de antes.

**Nota:** `Acabamento.relief?` + `RELEVO_PADRAO = 0.7` em `src/domain/mapa.ts`, `src/domain/validacao.ts` (`0..1`), interpolação em `misturar` (`src/domain/clima.ts`), exposição em `atlas_ambiente` (`src/app/ponte-escrita.ts`) e `scripts/ponte/catalogo-base.json` regenerado. Em `src/render/composicao-de-luz.ts`, a normal é derivada por Sobel 3×3 sobre `uAltura` (`uPassoEmMetros` exposto em `CenaDeAltura.metrosPorTexel`), `dirXY` recupera o vetor `[-1, 1]` de `uDirecao` (`2.0 * (d.rg - 0.5 * d.b) / d.b`), e a altura da luz (`ALTURA_DA_LUZ = 1.6` m ou `ALTURA_DO_FEIXE = 6` m para `rays`) vai codificada no canal `A` de `direcaoRT` (`uAlturaNorm` em `src/render/mapa-de-luz.ts`) junto de `ambiente` e `alcance`; para manter interiores sem luz direta (`luz < uAmbiente`) coerentes e `relief: 0` idêntico à L1, a parcela direta é `max(luz - uAmbiente, 0.0)` e o fator `0.75 + 0.25 * N.z` do ambiente também é ponderado por `uRelevo`. Medição em `porto-noturno` (Chromium headless/SwiftShader, 1440×860): `relief: 0` = `60.0 fps` (120 quadros / 2000 ms), `relief: 0.7` = `50.6 fps` (102 quadros / 2016,5 ms) — queda de 15,7% (< 25%), mantida `alturaRT` em resolução cheia. Conferido em `tests/unit/luzes.test.ts` (`realceDoRelevo`), `validacao.test.ts`, `ponte-escrita.test.ts`, `clima.test.ts`, `tests/e2e/fase6.test.ts` + `fase10-halos.test.ts` (8/8) e visualmente em `test-results/l5-relevo.png`.

**Commit:** `lights now shade surfaces by their relief`

---

## L6 — Oclusão de contato e de canto  ✅

**Objetivo:** objetos e paredes assentam no chão; juntas e cantos escurecem.

**Depende de:** L5.

**Ler:** `composicao-de-luz.ts`; `desenharParedes` em `cena.ts` (linha ~328); a AO interna dos objetos na K9 (`desenharPartes`, segunda passada de oclusão).

**Arquivos:** mudar `src/render/composicao-de-luz.ts`, `src/render/cena-de-altura.ts`, `src/render/cena.ts`.

**Como:**
1. AO por altura no shader: 8 amostras em anel a 2 raios (0,25 m e 0,7 m em pixels de tela), `ao = Σ max(0, h(amostra) − h(p)) / n`, com peso maior no raio curto. `cor *= 1 − uAO × smoothstep(0, 0.6, ao)`, com `uAO = finish.ao` (0–1, padrão 0,55). Aplique a AO **antes** de somar a luz, e só sobre o ambiente e metade da luz direta (a luz forte apaga um pouco a AO, como nas referências).
2. Paredes: desenhe as paredes também na `alturaC` (uma `Graphics` irmã de `paredesG`, mesmo traçado, cinza `ALTURA_DE_PAREDE / ALTURA_MAXIMA`, com `ALTURA_DE_PAREDE = 3`). Assim a AO do passo 1 escurece o pé das paredes e os cantos dos cômodos sem código extra.
3. Campo `finish.ao` no domínio, validação e ponte (como `relief` na L5).

**Não fazer:** sombra projetada nova (a K5 já cuida); AO no Pixel.

**Testes:** validação de `finish.ao`; função espelho `oclusaoDeAmostras(h0, amostras)` com caso plano (0) e caso de quina (> 0). Visual: `test-results/l6-ao.png` com `mansao-da-ilha` (pés de parede e móveis).

**Pronto quando:** móveis e paredes têm um escuro de contato visível e macio, e `ao: 0` desliga.

**Nota:** `AO_PADRAO` (`0.55`) e `Acabamento.ao?` em `src/domain/mapa.ts`, validação `0..1` em `src/domain/validacao.ts`, interpolação em `misturar` (`src/domain/clima.ts`), exposição em `atlas_ambiente` (`src/app/ponte-escrita.ts`) e `scripts/ponte/catalogo-base.json` regenerado. Em `src/render/cena-de-altura.ts`, `ALTURA_DE_PAREDE = 3` e `paredesAlturaG` (atualizada via `atualizarParedes` em `desenharParedes` de `src/render/cena.ts` para `p.kind === 'wall'`, usando os mesmos trechos com vãos de portas/arcos e `larguraDaParede` com cinza `ALTURA_DE_PAREDE / ALTURA_MAXIMA`). Em `src/render/composicao-de-luz.ts`, `anelAO` com 8 direções a dois raios em metros (`RAIO_AO_CURTO = 0.25` m peso `2`, `RAIO_AO_LONGO = 0.7` m peso `1` rotacionado em 22,5°) aplicada antes da soma final sobre `ambiente` por inteiro e `0.5` da `luzDireta`, mais a função espelho `oclusaoDeAmostras(h0, amostras)`. Conferido em `tests/unit/validacao.test.ts`, `tests/unit/luzes.test.ts`, `tests/unit/clima.test.ts`, `tests/unit/ponte-escrita.test.ts` (1140/1140), `tests/e2e/fase6.test.ts` + `fase10-halos.test.ts` (8/8), `npm run build` e comparativo `test-results/l6-ao.png` em `mansao-da-ilha`.

**Commit:** `added contact and corner occlusion from the height pass`

---

## L7 — Bloom e fogo emissivo  ✅

**Objetivo:** o que passa de 1 (fogo, velas, feixe) estoura num brilho quente.

**Depende de:** L5.

**Ler:** `Parte.brilho` e `desfoque` em [descricao.ts](../../src/procedural/descricao.ts) e como `raster.ts` os desenha; `finish.glow` em [halos.ts](../../src/render/halos.ts) (linha ~242).

**Arquivos:** mudar `src/procedural/altura.ts` (canal de emissão), `raster.ts`, `src/render/composicao-de-luz.ts`; criar `src/render/bloom.ts`.

**Como:**
1. Emissão: a tela de altura da L3 usa só o canal R. Grave em **G** a emissão: partes com `brilho: true` escrevem `G = alfa da parte`. No shader, `cor += base × G × uEmissao` (com `uEmissao = 3`): o miolo do fogo passa de 1 sem depender do mapa de luz.
2. `bloom.ts`: extrai `max(cor − 0.9, 0)` da cor **antes** da curva de tom, reduz para 1/4, desfoca em duas escalas (raio 0,5 m e 2 m) e soma de volta com peso `finish.glow` (campo que já existe; hoje só controla o halo). **Não use `BlurFilter` nem `filters`**: eles passam por texturas de 8 bits (ver a decisão da L1). Reaproveite as passadas gaussianas feitas à mão da L1, em `RenderTexture` no formato da luz. Para isso, a composição da L5 deixa de ser um `Filter` em `mundoIluminado` e passa a renderizar `mundoIluminado` numa `corRT` própria, com um `Mesh` em tela cheia que escreve a cor HDR numa `hdrRT`; o bloom lê a `hdrRT`.
3. Cintilação: o `MapaDeLuz` já tremula o halo das luzes (`quadro(agora)`), mas a chama desenhada fica parada. Passe um uniform global `uTempo` e faça a emissão oscilar com `0.85 + 0.15 × ruído(tempo × 7 + hash(posição/0.5 m))`, para que cada chama tremule por conta própria.

**Não fazer:** redesenhar o braseiro (L11, Opus).

**Testes:** puro `limiarDoBloom(cor)`. Visual: `test-results/l7-bloom.png` com `sala-da-guarda` (velas e braseiro).

**Pronto quando:** velas e braseiros têm núcleo estourado e um brilho quente que vaza sobre a mesa; `glow: 0` desliga.

**Nota:** altura isolada no canal **R** (`alturaPorLuminancia` e `desenharAlturaDasPartes` em `src/procedural/altura.ts`, `assarComodo`/`assarTerreno` em `src/procedural/assar.ts`, `paredesAlturaG` em `src/render/cena-de-altura.ts`) para que o canal **G** carregue apenas emissão (`parteEscreveEmissao`, `brilho: true` com `lighter` + `desfoque` preservando `R`; `src/procedural/raster.ts` também trata `brilho: true` sem `desfoque`). Em `src/render/composicao-de-luz.ts`, `criarComposicaoDeLuz` substitui `FiltroDeComposicaoDeLuz`: renderiza `mundoIluminado` em `corRT`, compõe luz/relevo/AO + `base * G * EMISSAO_PADRAO` (`3`) com cintilação espacial/temporal (`uTempo` zerado sob `movimentoReduzido()`) em `hdrRT` no formato da luz (`rgba16float` ou `rgba8unorm` escalado por `ESCALA_HDR`), e `src/render/bloom.ts` (`criarBloom`, `limiarDoBloom`) extrai `max(cor − 0.9, 0)` em 1/4, desfoca em `0.5` m (`1/4`) e `2.0` m (`1/8`) via passadas gaussianas manuais (sem `BlurFilter`/`filters`) e soma em `saidaRT` com peso `finish.glow` (ligado em `src/render/cena.ts`). Conferido em `tests/unit/altura.test.ts`, `tests/unit/luzes.test.ts` (1141/1141), `tests/e2e/fase6.test.ts` + `fase10-halos.test.ts` (8/8), `tests/e2e/ponte-captura.test.ts` (5/5), `npm run build`, verificação em Chromium de `?luz=altura`, `?luz=direcao`, cintilação da emissão e comparativo `test-results/l7-bloom.png` em `sala-da-guarda` (média no braseiro `178.9` com `glow: 0` → `380.6` com `glow: 0.8`). Em `tests/e2e/acabamento.test.ts`, o teste `I1` (sem `settle`) segue com a regressão introduzida na L6 pela oclusão de parede no raio `0.7` m (`pertoSem = 204.7` vs `longeSem = 224.0`).

**Commit:** `added bloom and emissive fire`

---

## L8 — Curva de tom e tonalização dividida  ✅

**Objetivo:** o HDR vira cor de tela com uma curva bonita, e o mapa pode puxar sombras e luzes para cores diferentes.

**Depende de:** L5.

**Ler:** [acabamento.ts](../../src/render/acabamento.ts) inteiro; o tipo `finish` em `src/domain/mapa.ts`; os presets de acabamento, se houver em `src/domain/presets.ts`.

**Arquivos:** mudar `acabamento.ts`, `composicao-de-luz.ts` (tirar o clamp da L1), `src/domain/mapa.ts`, `validacao.ts`, `presets.ts`, ponte e catálogo.

**Como:**
1. Tire o `clamp(…, 1)` da composição. A curva de tom roda **no passo que lê a `hdrRT` e soma o bloom** (L7), não no filtro de acabamento, porque o acabamento é um `Filter` e recebe uma textura de 8 bits já cortada em 1. Esse passo escreve a cor já em 0–1, e o acabamento segue igual depois dele. Curva: ACES aproximada de Narkowicz: `c = (x(2.51x + 0.03)) / (x(2.43x + 0.59) + 0.14)`, com `x = cor × finish.exposure` (padrão 1). Ajuste a exposição padrão para que um mapa sem luz forte fique igual ao de antes (± 3% de luminância média; meça com `sala-da-guarda` e `aldeia-ao-entardecer`).
2. `finish.split?: { shadows: '#rrggbb'; highlights: '#rrggbb'; balance: number; amount: number }`. No shader: `l = luminância`, `t = smoothstep(0, 1, l + balance)`, `cor = mix(cor, cor × mix(sombra, luz, t) × 2, amount)`, mantendo a luminância original (normalize depois).
3. Presets novos de acabamento: `masmorra` (sombras `#2a4a5a`, luzes `#ffb060`, amount 0,35), `sepia` (sombras `#4a3a2a`, luzes `#e8d0a0`, amount 0,5, saturação 0,6) e `dia-dourado` (sombras `#3a4a6a`, luzes `#ffe0a0`, amount 0,25).

**Não fazer:** mexer em vinheta, grão ou textura.

**Testes:** puro `aces(x)` (0 → 0, 1 → ≈ 0,8, 10 → < 1); `tonalizar(cor, split)` preserva a luminância. Validação de `split` e `exposure`.

**Pronto quando:** as luzes fortes saturam suavemente em vez de cortar, e os três presets existem.

**Nota:** `EXPOSICAO_PADRAO` (`0.82`), `TonalizacaoDividida`, `Acabamento.exposure?` (`0..4`) e `Acabamento.split?` em `src/domain/mapa.ts`; validação em `src/domain/validacao.ts`, interpolação em `misturar` (`src/domain/clima.ts`), exposição em `atlas_ambiente` (`src/app/ponte-escrita.ts`, com `acabamento.preset` sem `enum` duplicado para manter a soma dos esquemas < 30 KB; `scripts/ponte/catalogo-base.json` regenerado) e limpeza de `exposure`/`split` ao trocar preset em `src/ui/Inspetor.tsx`. O preset `sepia` já existia em `src/domain/presets.ts` (sem `split`, com `saturation: 0.45`): foi atualizado para `saturation: 0.6` com `split` (e `tests/unit/ponte-escrita.test.ts` ajustado), junto dos novos presets `masmorra` e `dia-dourado`. Em `src/render/bloom.ts`, `fragmentCombinar` aplica `aces(x)` (desfazendo pré-multiplicação por `a`, desativado nos modos `?luz=direcao`/`?luz=altura`, e `aces` exportada com clamp `[0, 1]` conforme Narkowicz); `src/render/composicao-de-luz.ts` (`definirExposicao`) e `src/render/cena.ts` repassam `finish.exposure ?? EXPOSICAO_PADRAO`; `src/render/acabamento.ts` aplica `finish.split` com preservação de luminância e exporta `tonalizar`. Calibração no Chromium: `aldeia-ao-entardecer` `34.150 → 35.064` (`+2.7%`); `sala-da-guarda` (mapa noturno com `glow: 0.8` e 6 luzes de fogo) `21.768 → 20.051` (`−7.9%`; em `0.85` ficava `20.946`, `−3.8%`, e `aldeia-ao-entardecer` subia para `+5.3%`). Conferido em `tests/unit/luzes.test.ts`, `validacao.test.ts`, `clima.test.ts`, `presets.test.ts`, `ponte-escrita.test.ts` (`1144/1144`), `npm run build`, `tests/e2e/fase6.test.ts` + `fase10-halos.test.ts` + `ponte-captura.test.ts` (`13/13`) e visualmente em `test-results/l8-tom.png`. Em `tests/e2e/relevo.test.ts`, o primeiro subteste (`bBaixa <= bAlta * 0.8`) já falhava em `HEAD` antes da L8 (`48.0` vs `41.1`; com L8 `56.4` vs `46.7`).

**Commit:** `added tone curve and split toning to the finish`

---

## L9 — Paredes com topo e face interna  🟡 (passos 1–4 ✅; falta passo 5 [Opus])

**Objetivo:** paredes deixam de ser linhas: têm topo e, nos interiores, uma face voltada para dentro do cômodo, como nas referências de quarto e cabana.

**Depende de:** —

**Divisão:** o Gemini faz a geometria e o encaixe (passos 1–4); o Opus faz os materiais de face e os objetos de parede desenhados na face (passo 5).

**Ler:** `desenharParede` e `desenharParedes` em [cena.ts](../../src/render/cena.ts) (linhas ~225–360, inclusive o chanfro e as juntas da K8); `DescricaoDeParede` em [descricao.ts](../../src/procedural/descricao.ts) (`face` em (u, z) e `topo`); as salas e paredes em `src/domain/mapa.ts`; como os cômodos são assados em [assar.ts](../../src/procedural/assar.ts).

**Arquivos:** criar `src/procedural/faces-de-parede.ts`; mudar `assar.ts` (o assado do cômodo desenha as faces), `cena.ts` (o topo), `src/domain/mapa.ts` (`Sala.wallFace?: string` com o id do material da face; `Parede.height?`), validação e ponte.

**Como:**
1. A face é desenhada **dentro do assado do cômodo**, não na camada de paredes: para cada lado do contorno da sala que coincide com uma parede `wall`, pinte uma faixa para dentro do cômodo com largura `PROJECAO × altura` (`PROJECAO = 0.18`, ou seja, 0,54 m para 3 m de parede). A faixa usa o material `sala.wallFace` (padrão: o material da parede, ou `parede.reboco`), com rodapé (os 12% de baixo, mais escuros), degradê de luz (mais escuro embaixo) e quinas em meia-esquadria (nos cantos, as faces se encontram na diagonal).
2. Portas e janelas cortam a face: porta = vão na face mostrando o batente; janela = retângulo de vidro na face com peitoril.
3. O topo da parede (em `cena.ts`) fica mais grosso e escuro (`#1a1820` com borda clara do lado de dentro), como nas referências; mantenha o chanfro da K8.
4. Alinhamento com a AO (L6) e a altura (L4): a face escreve altura em rampa (0 no pé, `altura/ALTURA_MAXIMA` no topo).
5. **[Opus]** Materiais de face: `parede.papel-damasco`, `parede.papel-listrado`, `parede.lambri`, `parede.tabuas`, `parede.alvenaria`, `parede.rocha`. Objetos de parede (`DescricaoDeParede`) passam a desenhar a `face` sobre a faixa da face em vez de só o `topo`: quadro, janela, lareira, estante, arandela.

**Não fazer:** paredes `low` e `fence` (seguem como estão); exteriores (a face aparece só do lado de dentro do cômodo coberto).

**Testes:** puro em `tests/unit/faces-de-parede.test.ts`: a faixa de uma sala retangular 4 × 3 m com parede de 3 m tem 0,54 m de largura e quinas diagonais; porta abre vão na faixa. Visual: `mansao-da-ilha` em `test-results/l9-faces.png`.

**Pronto quando:** os cômodos da mansão leem como caixas vistas de cima, com face interna em todas as paredes.

**Nota (passos 1–4, Gemini):** `Comodo.wallFace?` em `src/domain/mapa.ts` (mantido `Comodo` no lugar de `Sala`, `wallpaper` preservado como fallback antes do material da parede/reboco e `Parede.height: number` mantido obrigatório para compatibilidade), validado em `src/domain/validacao.ts`, aceito em `comodo.criar` (`src/state/comandos-construir.ts`), `comodos` (`src/authoring/construcao.ts`) e `atlas_comodos` (`src/app/ponte-escrita.ts`) com `scripts/ponte/catalogo-base.json` regenerado. Novo `src/procedural/faces-de-parede.ts` (`PROJECAO = 0.18`, `PROPORCAO_RODAPE = 0.12`, `profundidadeDaFace`, `calcularFacesDasParedes` filtrando apenas lados coincidentes com `wall` e excluindo `low`/`fence`, com quinas em meia-esquadria via `facesDoContorno` em `src/domain/geometria.ts`, prioridade `wallFace → wallpaper → parede → papel.liso-claro`, vão recortado para portas/arcos e peitoril/vidro em janelas) ligado a `assarComodo` (`src/procedural/assar.ts`) e `entradaDoComodo` (`src/render/entradas.ts`, filtrando cômodos ao ar livre sem telhado via `FUNCOES_AO_AR_LIVRE` para preservar salas internas como `mansao-da-ilha` e `sala-da-guarda`). A rampa de altura na face vai da base do piso (`ALTURA_BASE_PISO = 0.5`) até `alturaTopoDaFace(H)` (`0.75` para 3 m), evitando degrau para baixo no rodapé e casando com `paredesAlturaG` e L6. Em `src/render/cena.ts`, o topo das paredes `wall` usa `#1a1820` (`ESPESSURA_MINIMA_ILUSTRADO = 0.38`), borda clara interna nos lados com cômodo, chanfro e juntas da K8 preservados. Conferido em `tests/unit/faces-de-parede.test.ts` + suíte unitária (`1145/1145`), `npm run typecheck`, `npm run build`, `tests/e2e/comodos-livres.test.ts` + `fase6.test.ts` + `fase10-halos.test.ts` + `ponte-captura.test.ts` (`14/14`) e visualmente em `test-results/l9-faces.png` (`mansao-da-ilha`). Falta apenas o passo 5 `[Opus]`.

**Commit:** `walls now show their inner face inside rooms`

---

## L10 — Materiais com altura e variação por peça  ✅  [Opus]

**Objetivo:** os pisos principais têm altura própria (para a L5 e a L6) e variação de tom, desgaste e sujeira peça a peça.

**Depende de:** L4.

**Escopo:** pintores de altura e revisão de cor para `laje`, `lajes-grandes`, `lajes.escuras`, `tabuas`, `espinha`, `paralelepipedo`, `pedra`, `rachado`, `cascalho`, `terra`, `areia`, `lajes-rusticas` e as escadas de alvenaria. Cada peça (tábua, laje) ganha tom, desgaste de borda e sujeira de junta próprios; juntas ficam abaixo do miolo na altura, com bisel. Subir a resolução do terreno no Ilustrado de 24 para 40 px/m, medindo memória e tempo de assado no `desfiladeiro-nevado` (o maior); se passar de 1,5× no tempo, voltar a 32.

**Pronto quando:** sob a L5, lajes e tábuas leem como peças com relevo, sem o ar de padrão repetido.

**Nota:** `ALTURAS_DE_PADRAO` em `src/procedural/materiais.ts` (ligado a `PINTORES_DE_ALTURA`) dá altura própria, com a geometria do desenho de cor, a `tabuas`, `laje`, `xadrez`, `losango`, `hexagono`, `marmore`, `espinha`, `marchetaria`, `lajes-grandes`, `lajes-rusticas`, `rachado`, `paralelepipedo`, `lajegrama` e `placas`: platô com junta (meia-largura mínima de 0,8 px, senão a junta some no assado), bisel, inclinação própria de cada peça e micro-relevo. Os lisos e estampados (`liso`, `trama`, `couro`, `metal`, `vidro`, `pintura`, `persa`, `damasco`, `listras`, `floral`, `manchado`) ficam planos: na reserva por luminância os veios do mármore viravam sulcos e as casas escuras do xadrez afundavam. `tabuas` e `laje` passaram a desenhar a partir de `layoutDeTabuas` e `layoutDeLajes`, que consomem os sorteios na mesma ordem (sequência de chamadas de desenho idêntica à anterior, conferida em 12 combinações de material e semente). Os padrões naturais (`terra`, `areia`, `pedra`, `cascalho`, `grama`, `neve`) seguem na reserva por luminância, que lê bem neles. A variação de tom, desgaste e sujeira por peça já existia nos pintores de cor e foi mantida. Terreno do Ilustrado: 40 px/m dobrava o tempo de pintura do `desfiladeiro-nevado` (5,6 → 11,3 s no Chromium sem GPU), então ficou em 32 px/m (8,0 s, 1,45×). Teste em `tests/unit/altura.test.ts`.

---

## L11 — Estruturas com altura, fogo e o santuário  ⬜  [Opus]

**Objetivo:** escadas, estrados e muralhas deixam de ser desenhos soltos; o santuário é refeito como teste da frente.

**Depende de:** L5–L10.

**Escopo:**
- Família `estrutura.*` em `src/procedural/receitas/`: `estrutura.estrado`, `estrutura.escadaria` (embutida no piso, descendo ou subindo, com o material do piso em volta), `estrutura.muralha` (alvenaria com topo e face, alturas em degrau) e `estrutura.plataforma`. Todas recebem o material do piso como parâmetro, para que piso, degrau e muralha sejam da mesma pedra. Altura em `Parte.z` coerente, para a L5 dar o relevo sozinha (sem sombra pintada à mão do lado "do sol").
- Braseiro e tocha refeitos para o bloom: núcleo emissivo, brasa, fumaça leve; o círculo rúnico com brilho fraco.
- Santuário refeito em `scripts/exemplos/santuario-da-luz.ts` sobre `docs/referencias/exemplos/santuario-da-luz.png`, com preset de acabamento `masmorra`. Comparação em `test-results/` gerada por `npm run exemplos -- --so santuario-da-luz`.
- Antes de cada rodada de ajuste, comparar com a referência e dizer com franqueza se o que falta é do mapa ou do motor.

---

## L12 — Exemplos revistos e guia  ⬜  [Opus]

Revisar `sala-da-guarda`, `mansao-da-ilha` e `jardim-do-colosso` com as estruturas, faces de parede e presets novos; regenerar as miniaturas; atualizar o guia do assistente (`relief`, `ao`, `split`, `estrutura.*`, `wallFace`) para que o Claude do app use o que existe.

---

## O que esta frente **não** alcança

Para alinhar a expectativa: mesmo com tudo pronto, as referências renderizadas em 3D (santuário, sala da guarda, jardim) continuam à frente em três coisas que pediriam um motor 3D: **sombras longas e exatas do sol** sobre geometria complexa (as do jardim), **luz indireta** (a luz que rebate na parede e tinge o chão) e **objetos fotorrealistas** com muitos milhares de detalhes. O alvo realista é ficar entre as referências pintadas (quartos, cabana, acampamento), que esta frente alcança, e as renderizadas, das quais ela chega perto na luz e no relevo.
