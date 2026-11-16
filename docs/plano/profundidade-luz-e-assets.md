# Frente K — Profundidade, luz dinâmica, consistência e salto visual 2.5D

Frente nascida da segunda rodada de auditoria visual comparando o mapa *Lua da Renquerença* (pós-Frente J) com referências externas de VTT (*Farol* de *O Segredo na Ilha* — com iluminação ambiente desligada vs ligada com sombras dinâmicas — e interiores de casas em estilo top-down 2.5D) a partir de nove capturas comparativas.

---

## Contexto completo e diagnóstico técnico

Depois da Frente J (`J1`–`J10`), o mapa passou a ter casas rotacionadas, torres realmente circulares (`Moinho` e `Farol`), floresta nevada nos 4 quadrantes, relevo em patamares e ausência do halo branco aditivo nas casas. Ainda assim, a comparação lado a lado revelou **quatro eixos claros de problema** — parte de composição e auditoria, parte estrutural no motor e nos assets:

### 1. Inconsistências espaciais e bug de sombra em casas rotacionadas

- **Neve/objeto exterior invadindo interiores:** objetos externos como `monte-de-neve` colocados perto de uma casa rotacionada via `atlas_objetos` podem cruzar o polígono do cômodo (como no canto noroeste da *Casa Maior*), aparecendo sobre o piso interno na vista `planta`; além disso, quadros/arandelas colocados sem conferir rotação de parede inclinada podem vazar na quina.
- **Paredes avulsas cortando cômodos:** paredes criadas por `atlas_paredes` (ex.: mureta baixa perto da *Capela*) não verificam interseção com polígonos de cômodo e podem atravessar interiores obliquamente.
- **Paliçadas cruzando escarpas e degraus de relevo:** sem checagem de distância mínima ou interseção com `escarpasDerivadas` / `degrausDoRelevo`, linhas de `palicada` podem montar sobre a crista do platô elevado e sobre os degraus de rampa.
- **Por que o `atlas_revisar` deixou passar (`src/authoring/revisao.ts`):** hoje ele valida `porta-bloqueada`, `edificio-sem-telhado`, `interior-vazio`, `comodo-sem-luz`, `casas-iguais`, `fileira-mecanica`, `repeticao` e `ermos-vazios`, mas **não verifica** objetos externos dentro de cômodos fechados, paredes avulsas cruzando cômodos nem estruturas montadas sobre bordas de relevo.
- **Bug real de sombra desalinhada em casas rotacionadas (detectado na captura da casa em L):** em `src/render/mapa-de-luz.ts` (`desenharInterior`, linhas 133–146), a camada que escurece cômodos cobertos por `FATOR_DO_INTERIOR = 0.55` desenha **`sala.cells` (grade ortogonal de `1,5 m`) em vez de `sala.outline` (polígono rotacionado)**. O mesmo ocorre em `faixasDosComodos` de `src/render/mascara-de-comodos.ts` (linha 25). Em qualquer edifício rotacionado, uma caixa cinza ortogonal vaza para a neve ao redor das paredes.

### 2. Perspectiva de elevação superficial e penhasco parecendo parede

- **Face de escarpa muito estreita (`src/procedural/escarpa.ts`):** `larguraDaFace(altura)` usa `Math.min(6, Math.max(0.4, 0.35 * altura))` com sombra de pé fixa `SOMBRA_DA_ESCARPA = 0.5` m. Um degrau de `3,5 m` vira uma faixa de apenas `1,22 m`; uma queda de `5 m`, apenas `1,75 m`. Visto rigorosamente a `90°` de cima, um penhasco de `9,5 m` parece um muro fino no plano.
- **Degradê de profundidade tímido (`src/domain/relevo.ts`, `src/procedural/assar.ts`):** `fatorDeProfundidade` usa curva linear `clamp((topo - altura) / 30, 0, 1)` (`PROFUNDIDADE_DE_NEVOA = 30`). Entre `+3,5 m`, `0 m` e `-9,5 m`, a diferença de cor e contraste entre platôs é fraca demais (`p ≈ 0,11` a `0,31`), sem separação visual de altura nem suavização de profundidade no fundo.
- **Sombra direcional condicional (`src/render/sombras-do-sol.ts`, linhas 102–119):** `alcancaBaixo` só projeta sombra do relevo quando `n · dir >= 0.05`. Encostas voltadas para o lado iluminado (como a escarpa oeste do vale) ficam sem sombra longa projetada e parecem rasas.
- **Degraus `< 1 m` quase invisíveis (`src/procedural/assar.ts`, linhas 417–441):** hoje `e.relevo.degraus` risca apenas duas linhas translúcidas de `0,15 m` e `0,05 m`, sem largura de talude nem degraus visíveis na transição de rampa.

### 3. Qualidade das casas, *Farol de OSNI* e resposta sobre refazer os assets

Comparando as referências do *Farol de OSNI* e das duas casas externas com o resultado atual do Atlas, há **quatro fatores somados**:

1. **Perspectiva de câmera (~70°–75° oblíqua 2.5D vs 90° ortogonal):** nas referências, paredes de alvenaria e madeira mostram altura real voltada para dentro/sul, a torre central do farol tem volume cilíndrico com sombra na base, escadas em caracol mostram degraus com espelho e corrimão e batentes têm espessura. No Atlas (`src/procedural/assar.ts:59`), só paredes de sala comum usam `profundidadeDaFace(altura) = altura * 0.21` em faixa espremida; paredes externas e circulares têm traço fino (`~0,22 m`) e `escada.caracol` (`src/procedural/receitas/castelo.ts:40-49`) é um disco plano fatiado em `90°`.
2. **Linguagem visual das receitas (`src/procedural/raster.ts:22-45`):** `desenharPartes` usa `rect` / `roundRect` / `elipse` com contorno preto (`0.02 m`, alfa `0.9`) e gradiente linear diagonal genérico. Cama, sofá, estante e mesa ficam com leitura de diagrama vetorial limpo, sem dobras de tecido, desgaste orgânico de tábuas nem sombra de oclusão ambiental pesada debaixo dos móveis. Além disso, salões amplos geram áreas centrais vazias quando o mobiliário não adensa cantos e circulações.
3. **Iluminação e oclusão dinâmica (`src/render/mapa-de-luz.ts`, `src/domain/visibilidade.ts`):**
   - `oclusores(m, 'luz')` considera **apenas `m.walls`** (menos vãos abertos/janelas). Pilares centrais (como a coluna da torre do farol), estantes altas, armários, paliçadas e **tokens de personagens (`m.tokens`)** não projetam sombra dinâmica contra lanternas e tochas (justamente o efeito que transforma o farol na referência com luz ligada!).
   - `FATOR_DO_INTERIOR = 0.55` mantém todo cômodo coberto claro demais em mapas diurnos, diluindo lamparinas e lareiras internas mesmo sob telhado.
4. **Vale a pena refazer os assets?**
   - **Não vale** redesenhar receitas continuando no mesmo visual de retângulos planos com contorno preto em `desenharPartes` — mudaria detalhes sem fechar a distância para as referências.
   - **Vale muito a pena** combinando **três evoluções ordenadas**:
     1. Corrigir oclusão dinâmica (`walls` + pilares/objetos + tokens opcionais), `sala.outline` na luz interior e `interiorLight` configurável (ganho dramático imediato até com assets atuais);
     2. Evoluir relevo/escarpa, paredes com volume/chanfro, paliçada 2.5D robusta e polimento do raster (`desenharPartes` com contorno mais leve, AO duplo e `escada.caracol` com profundidade);
     3. Introduzir um **pack piloto de sprites pintados em 2.5D (~75° oblíquo consistente)** via `public/colecao/` (`colecao.json`) para peças heroicas de alto impacto (camas, sofás, estantes, escada circular, lareira/fogão, árvores nevadas, carroça, barco, paliçada), mantendo receitas procedurais para pisos, terrenos, formas livres e mobília paramétrica.

### 4. Paliçada minúscula

- Em `src/procedural/receitas/exterior.ts` (linhas 33–57), `palicada` tem `pegada: [largura, 0.45]` (toras de no máximo `0,38 m` de diâmetro vistas de cima em `90°`, sem ponta cônica oblíqua nem plataforma/travessa larga). Em escala de vilarejo (`120×96 m`), uma muralha defensiva de toras reduzida a `45 cm` de largura vira um cordão de bolinhas pequenas sem presença tática nem sombra proporcional de `2,4 m`–`3,0 m`.

---

## Como executar este plano (otimizado para contexto curto)

- **Uma única ficha por sessão/prompt.** Não junte etapas nem antecipe outra ficha.
- **Leia apenas o bloco `Ler` da ficha atual**, nos intervalos indicados.
- **Respeite `Não fazer`** e as fronteiras de `Atlas/AGENTS.md`: `src/domain/` não importa `render/`, UI nem Pixi; `src/authoring/` é puro sobre `MapaAtlas`.
- **Regra de estilo único (`AGENTS.md` #11):** qualquer asset ou melhoria de receita continua descrito uma única vez e funcionando em Ilustrado e Pixel (sem criar implementações duplicadas por estilo).
- **Catálogo MCP:** mexeu em esquema de `src/app/ponte-escrita.ts` ou presets/coleção → rode `npm run ponte:catalogo` e valide `tests/unit/ponte-escrita.test.ts` e `tests/unit/ponte-mcp.test.ts`.
- **Ao fechar cada ficha:** rode `npm run typecheck` e os testes da ficha, marque ✅ nesta tabela e registre uma linha em `progress.md`.

---

## Índice de etapas e fichas

| Ficha | Etapa | Foco | Depende de | Estado |
| --- | --- | --- | --- | --- |
| [K1](#k1--usar-salaoutline-na-máscara-de-luz-e-poeira-dos-interiores) | Etapa 1 · Correções Imediatas & Auditoria | Eliminar sombra quadrada em casas rotacionadas (`mapa-de-luz.ts`, `mascara-de-comodos.ts`) | — | ✅ |
| [K2](#k2--auditoria-espacial-em-atlas_revisar-exterior-em-cômodo-parede-e-relevo) | Etapa 1 · Correções Imediatas & Auditoria | Detectar neve/árvore em cômodo, parede cortando sala e paliçada em escarpa/degrau | — | ✅ |
| [K3](#k3--penumbra-de-interior-configurável-climainteriorlight-e-contraste-diurno) | Etapa 1 · Correções Imediatas & Auditoria | `Clima.interiorLight?` configurável via presets e `atlas_ambiente` | K1 | ✅ |
| [K4](#k4--oclusores-de-luz-para-pilares-e-objetos-altos-no-domínio) | Etapa 2 · Oclusão & Iluminação Dinâmica | Segmentos de oclusão rotacionados em `visibilidade.ts` sem auto-bloqueio de luzes embutidas | — | ✅ |
| [K5](#k5--sombras-dinâmicas-de-objetospilares-e-tokens-em-mapa-de-luzts) | Etapa 2 · Oclusão & Iluminação Dinâmica | Conectar oclusão de objetos altos e tokens no `MapaDeLuz` (efeito lanterna do Farol de OSNI) | K3, K4 | ✅ |
| [K6](#k6--escarpa-oblíqua-profunda-e-oclusão-de-base-independente-do-sol) | Etapa 3 · Relevo & Penhascos Dramáticos | Face mais larga (`escarpa.ts`) + oclusão basal contínua independente do ângulo solar | — | ✅ |
| [K7](#k7--curva-não-linear-de-profundidade-e-render-de-rampasdegraus-no-relevo) | Etapa 3 · Relevo & Penhascos Dramáticos | Curva não-linear de neblina em `relevo.ts` e textura visível para `degraus < 1 m` em `assar.ts` | K6 | ✅ |
| [K8](#k8--paliçada-25d-robusta-e-massa-visual-de-paredes) | Etapa 4 · Escala, Materialidade & Salto 2.5D | Paliçada defensiva ~1 m em 2.5D + reforço de massa/profundidade em paredes (`exterior.ts`, `cena.ts`) | — | ✅ |
| [K9](#k9--polimento-do-raster-procedural-e-escadacaracol-25d) | Etapa 4 · Escala, Materialidade & Salto 2.5D | Reduzir contorno vetorial pesado, ampliar AO em `raster.ts` e refazer `escada.caracol` | K8 | ✅ |
| [K10](#k10--especificação-e-pack-piloto-25d-em-publiccolecao-e-guias-atualizados) | Etapa 4 · Escala, Materialidade & Salto 2.5D | Padrão 2.5D (~75°) em `public/colecao/` (peças heroicas) + regras de densidade/folga nos guias | K2, K5, K7, K9 | ⬜ |

---

## Etapa 1 — Correções imediatas de render rotacionado, contraste interno e auditoria

Objetivo: resolver os bugs imediatamente visíveis nas capturas (sombra quadrada sob casas rotacionadas, interiores claros demais de dia e ausência de travas contra sobreposição em `atlas_revisar`).

### K1 — Usar `sala.outline` na máscara de luz e poeira dos interiores  ✅

**Objetivo:** corrigir `desenharInterior` em `src/render/mapa-de-luz.ts` e `faixasDosComodos` em `src/render/mascara-de-comodos.ts` para respeitar `sala.outline` em cômodos rotacionados ou livres, eliminando o retângulo cinza que vaza fora das paredes.

**Depende de:** —

**Ler:**
- `src/render/mapa-de-luz.ts` (linhas 130–160)
- `src/render/mascara-de-comodos.ts` (arquivo inteiro, 27 linhas)
- `src/domain/formas-de-comodo.ts` (função `pontoNoPoligono` e `areaDoPoligono`)
- `tests/unit/luzes.test.ts` (para manter padrão de testes)

**Arquivos:**
- `src/render/mapa-de-luz.ts`
- `src/render/mascara-de-comodos.ts`
- `src/domain/geometria.ts` (apenas se precisar extrair helper puro de caixa/faixas para teste sem Pixi)
- `tests/unit/luzes.test.ts` (ou novo teste unitário puro para `faixasDosComodos`)

**Como:**
1. Em `src/render/mapa-de-luz.ts`, atualizar `desenharInterior(m)` para verificar `sala.outline && sala.outline.length >= 3`:
   - Se presente, traçar o polígono com `interior.moveTo(x0, y0)` / `lineTo(...)` / `closePath()` (ou `interior.poly(sala.outline.flat())`) antes de `interior.fill(0xffffff)`.
   - Caso contrário, manter `for (const [y, x0, n] of sala.cells) interior.rect(...)`.
   - Verificar também que a chave de reconstrução de `interiorPronto` acompanha mudanças de geometria (`col('rooms') || campo('grid')`).
2. Em `src/render/mascara-de-comodos.ts`, atualizar `faixasDosComodos(m)`:
   - Para salas com `outline`, calcular bounding box do contorno e subamostrar faixas horizontais de passo `min(0.5, t / 2)` dentro do polígono via `pontoNoPoligono`, somando a área real com `areaDoPoligono(sala.outline)`.
3. Garantir funcionamento idêntico tanto para cômodos circulares quanto polígonos rotacionados no modo `illustrated` e `pixel`.

**Não fazer:** não alterar `FATOR_DO_INTERIOR` nem oclusão de objetos/tokens nesta ficha; não mexer em `assar.ts`.

**Testes:**
```bash
npm run typecheck
npm test
```
Incluir teste garantindo que `faixasDosComodos` em cômodo rotacionado/circular gera faixas estritamente contidas dentro do `outline` (nenhum ponto sorteado fora do polígono) e que a área reportada bate com `areaDoPoligono`.

**Pronto quando:** cômodos rotacionados com telhado não exibem mais retângulos ortogonais de sombra cinza vazando para o terreno ao redor.

**Commit:** `fixed rotated room outline masks in lightmap and room bounds`

---

### K2 — Auditoria espacial em `atlas_revisar`: exterior em cômodo, parede e relevo  ✅

**Nota:** Reclassificados itens de carga/armazém/oficina (`caixote`, `pilha-de-caixotes`, `barril`, `pilha-de-barris`, `sacos`, `ancora`, `rolo-de-corda` em `porto.ts` e `carrinho-de-mao` em `estrada.ts`) para `armazenamento`/`decoracao`, substituído o `canteiro` interno de `porto-noturno.ts` por `vaso.planta` e ajustadas sobreposições nos exemplos `porto-noturno` e `gruta-dos-contrabandistas` (com regeneração dos JSONs). Na regra `objeto-externo-no-interior`, os pontos amostrados usam a pegada rotacionada do objeto (`pontosDeAmostraDoObjeto`, margem ≤ 0,12 m) para evitar falsos positivos de cantos vazios da AABB.

**Objetivo:** acrescentar três regras em `src/authoring/revisao.ts` para detectar inconsistências físicas antes de entregar o mapa: objeto exterior dentro de cômodo coberto, parede avulsa cruzando cômodo e estrutura/paliçada sobre escarpa ou degrau de relevo.

**Depende de:** —

**Ler:**
- `src/authoring/revisao.ts` (linhas 1–115 e lista de regras chamadas em `revisarMapa`)
- `src/domain/relevo.ts` (linhas 101–131: `bordasDoRelevo` e `degrausDoRelevo`)
- `tests/unit/revisao.test.ts` (para acompanhar estilo das asserções)

**Arquivos:**
- `src/authoring/revisao.ts`
- `tests/unit/revisao.test.ts`

**Como:**
1. Criar regra `objeto-externo-no-interior` (`gravidade: 'erro'`):
   - Filtrar objetos em `m.props` cujo id/categoria/tags de `ACERVO.item(id)` sejam tipicamente externos (`categoria === 'exterior'` ou tags entre `['neve', 'arvore', 'arbusto', 'rocha', 'barco', 'cais', 'palicada', 'carroca', 'tenda']`, ignorando objetos explicitamente permitidos em varanda aberta quando `roof.material === null`).
   - Usar `salaNoPonto(m, o.position, o.levelId ?? null, indices)` (e cantos da `caixaDoObjeto` contra o mesmo cômodo com `roof.material !== null`); se cair dentro de sala coberta (como um `monte-de-neve` invadindo um quarto), emitir achado com sugestão de mover com `atlas_mover` ou remover com `atlas_remover`.
2. Criar regra `parede-atravessa-comodo` (`gravidade: 'erro'`):
   - Para cada parede avulsa (`!p.source` e `p.kind !== 'cliff'`) no mesmo `levelId` de cômodos existentes, amostrar pontos ao longo de cada segmento de `p.path` (excluindo encostos nas extremidades `<= 0,15 m` das pontas se tocar uma porta/parede de borda) e testar `salaNoPonto` com distância mínima de `0,25 m` para dentro da sala; se pontos internos da parede caírem dentro do cômodo, emitir achado indicando o id da parede e da sala afetada.
3. Criar regra `objeto-em-escarpa-ou-degrau` (`gravidade: 'aviso'`):
   - Coletar segmentos de escarpa (`p.kind === 'cliff'` ou `bordasDoRelevo(m)`) no `Térreo` (`levelId == null`); verificar se objetos lineares/estruturais (`palicada`, `cerca`, `tenda`, `carroca`, `pilha-de-lenha`, móveis) intersectam ou ficam a `< 0,5 m` de uma crista de `desnivel >= 1 m` ou cruzam `degrausDoRelevo` com menos de `0,6 m` de folga lateral no caso de paliçadas/cercas.
4. Respeitar `MAX_ACHADOS` e priorização por gravidade já existentes em `revisao.ts`.

**Não fazer:** não alterar `src/domain/relevo.ts` nem criar novas ferramentas MCP nesta ficha.

**Testes:**
```bash
npm run typecheck
node --test tests/unit/revisao.test.ts
```
Adicionar 3 testes em `tests/unit/revisao.test.ts`: `monte-de-neve` invadindo quarto rotacionado, parede `low` cortando uma `Sacristia` e `palicada` sobre crista/degrau de relevo.

**Pronto quando:** `atlas_revisar` acusa os três defeitos observados nas Imagens 1 e 2 com mensagens e `ids` acionáveis, sem falsos positivos em soleiras, móveis internos encostados em paredes ou pontes cruzando rios planos.

**Commit:** `added spatial consistency rules to atlas review for roofs walls and cliffs`

---

### K3 — Penumbra de interior configurável (`Clima.interiorLight?`) e contraste diurno  ✅

**Objetivo:** tornar configurável o fator de luz ambiente dentro de cômodos cobertos (`Clima.interiorLight`), permitindo interiores com clima de lanterna/lareira mesmo durante o dia sem escurecer o exterior.

**Depende de:** `K1`

**Ler:**
- `src/domain/mapa.ts` (linhas 52–66: `Clima`, e mapa padrão na linha 237)
- `src/domain/validacao.ts` (linhas 109–116: `CAMPOS_DO_CLIMA`)
- `src/domain/clima.ts` (linhas 117–146: `misturar`)
- `src/domain/presets.ts` (presets de clima)
- `src/render/mapa-de-luz.ts` (linhas 15–17 e 151–156)
- `src/app/ponte-escrita.ts` (linhas 629–646 e 1007–1045: `atlas_ambiente`)

**Arquivos:**
- `src/domain/mapa.ts`
- `src/domain/validacao.ts`
- `src/domain/clima.ts`
- `src/domain/presets.ts`
- `src/render/mapa-de-luz.ts`
- `src/app/ponte-escrita.ts`
- `scripts/ponte/catalogo-base.json` (via `npm run ponte:catalogo`)
- `tests/unit/climas.test.ts` e `tests/unit/ponte-escrita.test.ts`

**Como:**
1. Em `src/domain/mapa.ts`, adicionar campo opcional `interiorLight?: number` (`0.05` a `1`) em `Clima` (ausente = `FATOR_DO_INTERIOR` padrão, preservando compatibilidade com mapas salvos; atualizar `validacao.ts` com `e.opt(unidade)` ou intervalo `0.05..1`).
2. Em `src/domain/clima.ts`, interpolar `interiorLight` em `misturar(a, b, t)` (usando `FATOR_DO_INTERIOR` quando omitido em algum lado) e incluir no tipo `MisturaDeClima` se aplicável.
3. Em `src/render/mapa-de-luz.ts`, ler `mapa?.climate.interiorLight ?? FATOR_DO_INTERIOR` dentro de `renderizar()` ao calcular `intR`, `intG`, `intB`, garantindo que `campo('climate')` marque `sujo = true`.
4. Em `src/domain/presets.ts`, ajustar `interiorLight` nos presets atmosféricos diurnos/tempestuosos (`neve: 0.34`, `neblina: 0.32`, `tempestade: 0.25`, `entardecer: 0.38`) para que lamparinas e lareiras ganhem leitura interna dramática desde a criação do mapa.
5. Em `src/app/ponte-escrita.ts`, expor `luzInterna` opcional (`0.05` a `1`) dentro de `atlas_ambiente.clima` e tratar em `comandosDeAmbiente`. Rodar `npm run ponte:catalogo` e validar orçamento de bytes em `tests/unit/ponte-mcp.test.ts`.

**Não fazer:** não alterar `halos.ts` nem adicionar oclusão de objetos ainda (`K4`/`K5`).

**Testes:**
```bash
npm run ponte:catalogo
npm run typecheck
npm test
```
Testar validação de faixa (`0.05..1`), interpolação em `misturar`, presets e aceitação de `luzInterna` em `atlas_ambiente`.

**Pronto quando:** `atlas_ambiente` permite ajustar a penumbra interna independentemente da luz exterior (`0.05`–`1`), mantendo mapas antigos sem `interiorLight` idênticos.

**Commit:** `added configurable interior ambient light factor for daytime contrast`

---

## Etapa 2 — Oclusão dinâmica de pilares, objetos altos e tokens na iluminação

Objetivo: reproduzir o impacto visual da **Imagem 5 (OSNI)** — onde uma lanterna ou lareira não atravessa o núcleo maciço da torre, móveis grandes nem personagens, gerando sombras direcionais reais sobre o piso texturizado.

### K4 — Oclusores de luz para pilares e objetos altos no domínio  ✅

**Objetivo:** criar função pura em `src/domain/visibilidade.ts` que extrai segmentos de oclusão rotacionados para objetos altos/opacos (pilares, estantes, armários, paliçadas), sem bloquear fontes de luz situadas no interior da própria caixa do objeto.

**Depende de:** —

**Ler:**
- `src/domain/visibilidade.ts` (arquivo inteiro, 111 linhas)
- `src/domain/mapa.ts` (linhas 118–130: `Objeto`)
- `src/procedural/acervo.ts` (linhas 1–73: `pegadaDaFonte`, `alturaDaFonte`)
- `tests/unit/visibilidade.test.ts`

**Arquivos:**
- `src/domain/mapa.ts` (campo opcional `blocksLight?: boolean` ou `blocks.light?: boolean` em `Objeto`, se conveniente, mantendo opcional)
- `src/domain/visibilidade.ts`
- `tests/unit/visibilidade.test.ts`

**Como:**
1. Em `src/domain/visibilidade.ts`, manter `oclusores(m, para)` 100% compatível para paredes/aberturas e adicionar helper puro `oclusoresDeObjetos(m, opcoes)`:
   - Filtra `Object.values(m.props)` por `levelId` correspondente (`(o.levelId ?? null) === (opcoes.levelId ?? null)`), `o.elevation === 'floor'` e `!o.oculto`.
   - Critério de oclusão por objeto: `o.blocks.sight === true` (ou tag/receita estrutural pesada quando `altura >= 1.6 m`, como estantes, armários, `palicada`, `rochedo`, `lareira.pedra`, `forja`, `caixa`/`pilha-de-caixotes`, excluindo explicitamente objetos de iluminação/passagem como `poste.luz`, `lanterna-de-poste`, `tocha`, `escada*`, `cerca`, árvores se não bloquearem visão). Permitir override explícito se o objeto trouxer flag booleana opcional.
   - Converter a pegada `[pw * o.scale, ph * o.scale]` rotacionada por `o.rotation` ao redor de `o.position` num retângulo chanfrado (4 lados; ou octógono inscrito quando quadrado tipo pilar) em lista de `Segmento` junto de um `caixa/polígono` para filtro de auto-contenção.
2. Criar helper `segmentosParaFonte(posLuz, segmentosParedes, oclusoresObj)`: exclui qualquer oclusor de objeto cujo polígono contenha `posLuz` (evita que uma `lareira` ou `lampiao` preso à própria mobília apague a si mesma!).

**Não fazer:** não importar Pixi ou `render/` em `src/domain/`; não mexer em `mapa-de-luz.ts` nesta ficha (`K5`).

**Testes:**
```bash
npm run typecheck
node --test tests/unit/visibilidade.test.ts
```
Testar em `tests/unit/visibilidade.test.ts`: pilar/armário rotacionado projeta cone de sombra atrás de uma luz próxima, objeto baixo (`tapete`, `mesa`) não bloqueia luz, e luz posicionada dentro/sobre uma `lareira` não sofre auto-oclusão.

**Pronto quando:** `oclusoresDeObjetos` e `segmentosParaFonte` geram cones de sombra geométricos corretos em testes unitários puros.

**Commit:** `added domain light occluder geometry for tall props and pillars`

---

### K5 — Sombras dinâmicas de objetos/pilares e tokens em `mapa-de-luz.ts`  ✅

**Objetivo:** conectar `oclusoresDeObjetos` e silhuetas de oclusão opcional de `m.tokens` ao cálculo de `poligonoIluminado` em `src/render/mapa-de-luz.ts`, respeitando o orçamento de desempenho por quadro.

**Depende de:** `K3`, `K4`

**Ler:**
- `src/render/mapa-de-luz.ts` (linhas 65–125 e 162–223)
- `src/domain/visibilidade.ts` (funções adicionadas na `K4`)
- `src/domain/mapa.ts` (linhas 164–179: `Peca`)

**Arquivos:**
- `src/domain/visibilidade.ts` (adicionar `oclusorDeToken(peca): Segmento[]` leve — losango/hexágono com ~45% do tamanho do token para não bloquear a visão da própria cabeça)
- `src/render/mapa-de-luz.ts`
- `tests/unit/visibilidade.test.ts` e `tests/unit/luzes.test.ts`

**Como:**
1. Em `src/domain/visibilidade.ts`, criar `oclusoresDeTokens(m, nivel)`: para cada peça em `Object.values(m.tokens)` no `nivel` ativo (com `figure.state !== 'dead'`), gerar um octógono pequeno de raio `r = Math.max(0.22, p.size * 0.28)` centrado em `p.position`.
2. Em `src/render/mapa-de-luz.ts`:
   - Incluir `col('props') || col('tokens')` na invalidação de `geoMudou` (separando o índice estático `walls+props` do índice dinâmico com `tokens` para que mover um token recalcule apenas as luzes cujo raio alcança `token.position`, mantendo o render fluido mesmo em mapas com dezenas de luzes!).
   - Ao chamar `poligonoIluminado`, consultar `segmentosParaFonte(l.position, ...)` excluindo qualquer token dentro de `r + 0.15 m` da fonte (para a lanterna presa ao token `ownerId` / mão do personagem não ser bloqueada pelo próprio dono, projetando sombras atrás dos *outros* personagens e atrás de pilares — exatamente como na Imagem 5!).
3. Garantir que a visão do jogador (`nevoa.ts`) continue inalterada ou só use paredes conforme comportamento atual.

**Não fazer:** não alterar névoa de exploração (`nevoa.ts`) nem refazer shaders de halos nesta ficha.

**Testes:**
```bash
npm run typecheck
npm test
```
Adicionar teste verificando que a lanterna associada a um token (`lightId` / distância < raio do próprio token) ilumina ao redor do portador, enquanto projeta sombra atrás de um segundo token e atrás de um pilar próximo.

**Pronto quando:** pilares, móveis pesados e personagens próximos a uma fonte de luz projetam sombras dinâmicas em tempo real no mapa, sem auto-bloqueio da lanterna do portador.

**Commit:** `wired dynamic object pillar and token occlusion into lightmap`

---

## Etapa 3 — Relevo dramático, penhascos com altura real e degraus visíveis

Objetivo: resolver os pontos da **Imagem 2 e Imagem 3** — fazer desníveis de `+3,5 m`, `-4,5 m` e `-9,5 m` parecerem penhascos e terraços reais vistos de cima, não muros estreitos nem linhas tímidas na neve.

### K6 — Escarpa oblíqua profunda e oclusão de base independente do sol  ✅

**Objetivo:** ampliar a expressão vertical de `escarpa.ts` e garantir sombreamento de base ao longo de todo penhasco em `sombras-do-sol.ts`, inclusive quando a crista olha de frente para o sol.

**Depende de:** —

**Ler:**
- `src/procedural/escarpa.ts` (arquivo inteiro, 138 linhas)
- `src/render/sombras-do-sol.ts` (linhas 78–125)
- `tests/unit/escarpa.test.ts`

**Arquivos:**
- `src/procedural/escarpa.ts`
- `src/render/sombras-do-sol.ts`
- `tests/unit/escarpa.test.ts`

**Como:**
1. Em `src/procedural/escarpa.ts`:
   - Revisar `FATOR_DA_FACE` (`0.35 → ~0.55`), `FACE_MAXIMA` (`6 → 9.5`) e `SOMBRA_DA_ESCARPA` (`0.5 → altura <= 2 ? 0.65 : Math.min(2.4, 0.45 + 0.2 * altura)`), fazendo `caixaDaEscarpa` e `sombrearEscarpa` usarem esse alcance basal proporcional ao desnível.
   - Aumentar o contraste das quebras de estrato (`banda`), aprofundando a vinheta escura do pé da parede (`suave(0.45, 1, t) * 0.85 * pe`) e clareando ligeiramente a crista (`LABIO_DA_ESCARPA`) para que o olho separe topo e abismo em qualquer direção de bússola.
2. Em `src/render/sombras-do-sol.ts`:
   - Além da sombra solar direcional (ampliada até `Math.min(borda.desnivel * 0.85, 15)` quando `n · dir >= 0.05`), desenhar uma **faixa de sombra de base/oclusão** para bordas com `borda.desnivel >= 1.5` m na direção da normal baixa `n`, garantindo profundidade visível mesmo no penhasco voltado contra o sol (como o lado oeste do vale na Imagem 3).

**Não fazer:** não alterar `comporMascaraDeRelevo` nem os degraus `< 1 m` nesta ficha (`K7`); não quebrar assinaturas públicas de `escarpa.ts`.

**Testes:**
```bash
npm run typecheck
node --test tests/unit/escarpa.test.ts tests/unit/sol.test.ts
```
Ajustar ou ampliar `tests/unit/escarpa.test.ts` cobrindo `larguraDaFace` e caixa/sombra para desníveis grandes (`5 m` e `10 m`) e garantindo que mapas pixel (`pixel: true`) preservem contorno limpo.

**Pronto quando:** penhascos de `3,5 m`–`9,5 m` têm face larga com leitura imediata de altura e pé escuro ancorado mesmo contra a luz solar.

**Commit:** `deepened cliff rock faces and added orientation-independent base occlusion`

---

### K7 — Curva não-linear de profundidade e render de rampas/degraus no relevo  ✅

**Objetivo:** dar separação visual clara a terraços e abismos entre `2 m` e `12 m` em `relevo.ts`/`assar.ts` e transformar `degraus < 1 m` de linha tracejada tímida em transição legível de rampa/declive.

**Depende de:** `K6`

**Ler:**
- `src/domain/relevo.ts` (linhas 196–247: `fatorDeProfundidade`, `tintDoRelevo`)
- `src/procedural/assar.ts` (linhas 252–289 e 417–441: `comporMascaraDeRelevo` e `degraus`)
- `tests/unit/relevo.test.ts`

**Arquivos:**
- `src/domain/relevo.ts`
- `src/procedural/assar.ts`
- `src/render/entradas.ts` (se `degraus` precisar levar `desnivel` ou material)
- `tests/unit/relevo.test.ts`

**Como:**
1. Em `src/domain/relevo.ts`, ajustar `fatorDeProfundidade(altura, topo)`:
   - Em vez da rampa linear lenta `(topo - altura) / 30` (que quase não diferencia `3,5 m` nem `9 m`), aplicar curva suave não-linear `Math.pow(clamp((topo - altura) / 20, 0, 1), 0.72)` (mantendo `0` em `altura >= topo` e saturando próximo de `20 m` em `1`), garantindo leitura clara já em degraus médios de `3`–`10 m` sem apagar a textura do chão.
2. Em `src/procedural/assar.ts` (`e.relevo.degraus`, linhas 417–441):
   - Substituir o par de linhas finas por uma **faixa de declive sombreada** na direção da normal baixa `n` (~`0,55 m` de banda com gradiente suave de sombra `rgba(0,0,0,0.34) -> 0` + pequenas hachuras/travessas irregulares ao longo do contorno e borda clara na crista), de modo que rampas de transição em terra/neve/pedra pareçam taludes ou degraus rústicos reais (Imagem 2).
3. Revisar que `comporMascaraDeRelevo` continua compatível tanto no bake em worker quanto no caminho Pixel (sem regressão de desempenho em mapas `>= 8000 m²`).

**Não fazer:** não alterar `atualizarEscarpasDoRelevo` (`DEGRAU_TRANSPONIVEL = 1` permanece intacto); não mexer nas linhas de nível do editor (`linhas-de-nivel.ts`).

**Testes:**
```bash
npm run typecheck
node --test tests/unit/relevo.test.ts tests/unit/entradas.test.ts
```
Validar monotonicidade de `fatorDeProfundidade`, preservação de `0` no topo e presença de pixels sombreados reais no lado baixo dos `degraus` assados por `assarTerreno`.

**Pronto quando:** terraços de `+3,5 m` se destacam claramente do nível `0 m`, vales de `-9,5 m` ganham profundidade atmosférica real e rampas `< 1 m` exibem transição de declive em vez de arames cinzentos.

**Commit:** `improved nonlinear relief depth contrast and textured step slopes`

---

## Etapa 4 — Paliçada imponente, polimento 2.5D de receitas e trilha de sprites pintados

Objetivo: atacar o **Ponto 4** (paliçada minúscula) e o **Ponto 3** (salto de qualidade nas estruturas, escada do farol, mobiliário e arquitetura de sprites 2.5D em `public/colecao/`).

### K8 — Paliçada 2.5D robusta e massa visual de paredes  ✅

**Objetivo:** dar escala militar real à receita `palicada` (abandonando o visual de bolinhas de `0,45 m`) e enriquecer o volume de borda/topo das paredes em `cena.ts` para reforçar o peso arquitetônico visto nas referências.

**Depende de:** —

**Ler:**
- `src/procedural/receitas/exterior.ts` (linhas 30–59: `cerca` e `palicada`)
- `src/render/cena.ts` (linhas 223–305: `desenharParede` e desenho de `wall` / `fence` / `low`)
- `src/procedural/assar.ts` (linhas 58–60 e 140–168: `profundidadeDaFace` e `assarComodo`)
- `tests/unit/receitas.test.ts` e `tests/unit/kit-exterior.test.ts`

**Arquivos:**
- `src/procedural/receitas/exterior.ts`
- `src/render/cena.ts`
- `src/procedural/assar.ts`
- `tests/unit/receitas.test.ts` e `tests/unit/kit-exterior.test.ts`

**Como:**
1. Em `src/procedural/receitas/exterior.ts`, reformular `palicada`:
   - Aumentar a profundidade da pegada padrão para `[largura, 0.95]` e `altura: 2.9` (para a sombra solar de `sombras-do-sol.ts` alcançar mais longe).
   - Desenhar em leve ângulo 2.5D para frente/baixo (`+y` local): toras grossas (`0,34–0,46 m`) com corpo cilíndrico vertical aparente, ponta cônica afilada de madeira clara cortada à machado, duas vigas horizontais reforçadas com amarração escura, base de terra/neve socada e opção de parâmetro booleano `passarela` (passadiço interno estreito de tábuas atrás das estacas para portões/atalaias).
2. Em `src/render/cena.ts` (`desenharParede`):
   - Dar às paredes `kind === 'wall'` de espessura padrão acabamento de topo mais rico (sombra externa sutil junto ao traço, chanfro interno iluminado e variação sutil de junta nas paredes de pedra/madeira, evitando visual "traço preto plano de CAD").
3. Avaliar incremento moderado de `profundidadeDaFace` (`0.21 → 0.25` se não quebrar testes de geometria de móveis encostados; se alterar colisão visual de móveis, manter `0.21` em `assar.ts` e concentrar o peso nas paredes em `cena.ts` + chanfro de fundo).

**Não fazer:** não quebrar paredes de cômodos `box` existentes em `tests/e2e/comodos-livres.test.ts` nem alterar `cerca`.

**Testes:**
```bash
npm run typecheck
node --test tests/unit/receitas.test.ts tests/unit/kit-exterior.test.ts
```

**Pronto quando:** `palicada` em zoom regional de vila aparece como barreira maciça de toras pontiagudas com ~1 m de espessura visual e sombra marcada, não uma linha de pontinhos.

**Commit:** `upgraded palicada recipe to 2.5d fortified logs and enriched wall edges`

---

### K9 — Polimento do raster procedural (`raster.ts`) e `escada.caracol` 2.5D  ✅

**Objetivo:** diminuir o aspecto "diagrama vetorial com contorno preto grosso" em `src/procedural/raster.ts` e refazer `escada.caracol` (e camas/sofás-base selecionados) com camadas de profundidade inspiradas nas referências.

**Depende de:** `K8`

**Ler:**
- `src/procedural/raster.ts` (arquivo inteiro, 53 linhas)
- `src/procedural/receitas/castelo.ts` (linhas 40–50: `escada.caracol`)
- `src/procedural/receitas/casa.ts` (linhas 50–115: camas e sofás)
- `tests/unit/receitas.test.ts`

**Arquivos:**
- `src/procedural/raster.ts`
- `src/procedural/receitas/castelo.ts`
- `src/procedural/receitas/casa.ts`
- `tests/unit/receitas.test.ts`

**Como:**
1. Em `src/procedural/raster.ts` (`desenharPartes`):
   - Suavizar contornos internos: quando `p.contorno === 'leve'`, reduzir largura (`0.008`) e opacidade (`0.28`), preservando definição nítida apenas nas partes estruturais principais (`p.contorno !== 'leve'`) e eliminando traço duplicado pesado em itens miúdos (`detalhe: 3`).
   - Enriquecer sombra de contato para peças de piso com `p.z > 0.03`: além da sombra direcional existente, aplicar uma segunda passada curta de oclusão suave centrada sob a peça (`shadowOffsetX = shadowOffsetY = 0`, `alpha = 0.28`) para "ancorar" camas, mesas e armários no chão (como nas Imagens 7 e 8).
2. Em `src/procedural/receitas/castelo.ts`, refazer `escada.caracol`:
   - Pilar central robusto em alvenaria cilíndrica (`r0` maior, ~`0,32 * R`, sombreado em anéis de pedra como o núcleo do Farol de OSNI na Imagem 4);
   - Degraus em `madeira.media` / `madeira.escura` com espessura visual e sombreamento progressivo descendo para o poço escuro (`#0e0d12`) abaixo dos últimos degraus;
   - Corrimão curvo contínuo na borda externa (`madeira.escura` com postes espaçados).
3. Em `src/procedural/receitas/casa.ts`, refinar `cama.casal` e `cama.solteiro` com dobras diagonais suaves no cobertor, travesseiros encavalados com sombra própria e cabeceira chanfrada para reduzir a cara geométrica retangular.

**Não fazer:** não modificar `ILUSTRADO` / `PIXEL` em separado (tudo passa pelo mesmo `desenharPartes` com compatibilidade Pixel em `partes-pixel.ts`); não tocar em receitas de ficção científica.

**Testes:**
```bash
npm run typecheck
node --test tests/unit/receitas.test.ts tests/unit/acervo-castelo.test.ts
```

**Pronto quando:** móveis e especialmente a `escada.caracol` ganham oclusão de piso ancorada, contornos menos cartunescos e volume cilíndrico/degraus compatível em Ilustrado e Pixel.

**Commit:** `refined procedural contact shadows subtle outlines and 2.5d spiral stairs`

---

### K10 — Padrão de sprites 2.5D (~75°) em `public/colecao/` (pack piloto) e guias  ⬜

**Objetivo:** estabelecer a especificação visual do **pack piloto de sprites pintados em 2.5D (~75°)** via `public/colecao/` (`colecao.json`) para os ~12–15 assets heroicos em que ilustração supera desenho vetorial, e atualizar os guias MCP com regras anti-inconsistência e densidade interna.

**Depende de:** `K2`, `K5`, `K7`, `K9`

**Ler:**
- `src/procedural/colecao.ts` (linhas 1–78)
- `public/colecao/colecao.json` (primeiros 3 itens como exemplo de esquema e campos)
- `docs/LICENCAS.md` e `docs/curadoria.md` (regras de licença e curadoria)
- `docs/assistente/guia/referencias.md`, `interiores.md` e `projetar.md`
- `tests/unit/colecao.test.ts` e `tests/unit/ponte-mcp.test.ts` (linhas 817–855)

**Arquivos:**
- `docs/curadoria.md` (seção de padrão 2.5D ~75°, iluminação superior-esquerda neutra `res: 128`–`256`, margem limpa sem contorno CAD grosso)
- `public/colecao/colecao.json` + PNG/WebPs em `public/colecao/` (apenas se assets autorais/CC0 validados forem integrados junto ao registro em `docs/LICENCAS.md`; caso contrário, registrar especificação + scripts/pipeline de entrada antes de adicionar binários)
- `docs/assistente/guia/referencias.md`, `interiores.md`, `projetar.md`, `mapas.md`

**Como:**
1. Documentar em `docs/curadoria.md` o padrão oficial de sprites **2.5D (~75° oblíquo consistente)**:
   - Câmera inclinada levemente do sul para o norte (mostrando topo + pequena face frontal `+y`), luz neutra vinda de noroeste sem sombra dura embutida longa (a sombra direcional vem de `sombras-do-sol.ts`), resolução base `128 px/m` (`256 px/m` para peças miúdas), fundo transparente limpo compatível com `derivarPixel`.
   - Lista priorizada do pack piloto (~12–15 peças heroicas que hoje parecem mais planas): cama com lençol amassado, sofá estofado, estante cheia, fogão/pia, mesa rústica gasta, tapete persa detalhado, escada circular de madeira/pedra com poço central, pinheiro nevado em camada, carroça coberta, barco a remo de tábuas, segmento de paliçada alta.
   - Se a etapa incluir geração/adição imediata das imagens autorais/CC0 em `public/colecao/`, registrar cada item no `colecao.json` (validado por `validarColecao`) e documentar origem em `docs/LICENCAS.md`.
2. Atualizar os guias MCP (mantendo `< 6144` bytes nos arquivos com limite de orçamento, conferir `projetar.md` que já está em `6114` bytes — enxugar repetições ao editar!):
   - `referencias.md`: documentar folga obrigatória de `>= 1,5 m` entre paliçadas/cercas e cristas/degraus de `relevo`, proibição de `monte-de-neve` ou props exteriores encostando/invadindo polígonos de casas rotacionadas, e uso do novo `clima.luzInterna` em cenários com atmosfera de lanterna (como o *Farol de OSNI*).
   - `interiores.md`: regra de proporção e densidade dos cômodos (evitar salões exagerados com centro vazio como na Imagem 9; preferir cômodos compactos de `3–5 m` por lado ou dividir salões amplos com tapetes, lareira central, pilares oclusores e agrupamentos de móveis alinhados às paredes, aproximando-se das Imagens 7 e 8).

**Não fazer:** nunca adicionar imagens sem licença compatível e registro em `docs/LICENCAS.md`; nunca ultrapassar o limite de bytes de `nucleo.md` ou quebrar testes de `colecao.test.ts` / `ponte-mcp.test.ts`.

**Testes:**
```bash
wc -c docs/assistente/nucleo.md docs/assistente/guia/projetar.md docs/assistente/guia/referencias.md docs/assistente/guia/interiores.md
npm run typecheck
npm test
```

**Pronto quando:** o padrão de sprites 2.5D está documentado/validado em `colecao.ts` (com eventual pack piloto integrado e licenciado) e os guias orientam composição densa, folga de relevo e iluminação dramática interna sem estourar limites dos testes.

**Commit:** `defined 2.5d sprite pipeline standards and updated composition guides`

---

## Critério de conclusão da Frente K

1. Todas as fichas `K1`–`K10` marcadas ✅, `npm run typecheck` e suíte `npm test` passando sem falhas.
2. **Validação prática no mapa *Lua da Renquerença* (`Teste`):**
   - Corrigir/regerar o mapa e confirmar via `atlas_revisar` (`0` erros incluindo as 3 novas regras espaciais) e `atlas_ver_mapa`:
     - Casas rotacionadas sem quadrados cinzentos de sombra vazando no terreno (`K1`);
     - Nenhuma neve, parede ou paliçada cortando casas ou degraus (`K2`);
     - Penhasco do Vale Oeste e platô `[5]` com leitura clara de profundidade e degraus visíveis (`K6`, `K7`);
     - Paliçada impondo presença de barreira defensiva e `Farol` projetando sombras dinâmicas do núcleo/escada/tokens com atmosfera interna (`K3`, `K5`, `K8`, `K9`).
