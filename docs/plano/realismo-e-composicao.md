# Frente J — Realismo, rotação, composição e guias

Frente de melhorias nascida da auditoria comparativa entre mapas gerados via MCP a partir de referências visuais (ex.: *Lua da Renquerença* em vila nevada) e os mapas de exemplo oficiais em `scripts/exemplos/` (*Gruta dos Contrabandistas*, *Ravina Noturna*, *Covil na Caverna*, *Desfiladeiro Nevado*).

Ataca sete gargalos reais separados em **quatro etapas** e **dez fichas curtas**:

1. Guias MCP desatualizados ou vagos (`referencias.md` ainda diz que não há cômodo redondo; falta receita de `acabamento`, luz rasante e recorte de referências em perspectiva).
2. `insightDoComodo`, `malhaDoComodo` e `revisao.ts` não enxergam bem contornos `outline` (`circulo` / `poligono`), escadas entre andares nem subsolos.
3. `atlas_edificio` gera apenas blocos ortogonais sem `rotacao`.
4. `atlas_espalhar` não tem conjuntos prontos para neve, encosta rochosa, bosque morto ou costa.
5. Cercas (`fence` / `low`) desenham uma linha vetorial lisa e falta receita `palicada`.
6. Material `'neve'` usa ruído uniforme que lembra grama clara em vez de neve e falta textura leve de vento.
7. `relevo` próximo às bordas do mapa e `PRESETS_DE_CLIMA` / `PRESETS_DE_ACABAMENTO` ainda nascem sem `glow`/`edges` (`SEM_BORDA`), deixando os mapas sem o acabamento cinematográfico dos exemplos.

---

## Como executar este plano (otimizado para modelos de contexto curto / Gemini 4 Hydrogen)

- **Uma única ficha por sessão/prompt.** Nunca tente fazer uma etapa inteira num turno só.
- **Leia apenas o bloco `Ler` da ficha atual**, nos intervalos indicados. Não varra o repositório inteiro.
- **Respeite `Não fazer`** para evitar edições fora de escopo que quebram o fluxo ou estouram o contexto.
- **Separação de camadas (`AGENTS.md`):** `src/domain/` não importa `render/`, UI nem Pixi; `src/authoring/` é puro sobre `MapaAtlas`.
- **Catálogo MCP:** qualquer alteração em esquemas de `src/app/ponte-escrita.ts` ou em `TODOS_OS_CONJUNTOS` / `PRESETS_DE_ACABAMENTO` exige rodar `npm run ponte:catalogo`, manter esquemas inline abaixo de 22 KB e conferir `tests/unit/ponte-escrita.test.ts`.
- **Um commit atômico por ficha**, rodando os testes listados antes de fechar.

---

## Índice de etapas e fichas

| Ficha | Etapa | Foco | Depende de | Estado |
| --- | --- | --- | --- | --- |
| [J1](#j1--atualizar-referenciasmd-e-lugaresmd-para-círculos-escala-e-ermos) | Etapa 1 · Guias | Círculos reais, escala e recorte tático de perspectiva | — | ✅ |
| [J2](#j2--receitas-de-iluminação-acabamento-e-profundidade-nos-guias) | Etapa 1 · Guias | Receitas `atlas_ambiente`, profundidade e `nucleo.md` | J1 | ✅ |
| [J3](#j3--suportar-outline-em-insightdocomodo-e-malhadocomodo) | Etapa 2 · Formas & Edifícios | Mobília e malha fina `0,25 m` em `circulo` e `poligono` | — | ⬜ |
| [J4](#j4--atualizar-atlas_revisar-para-escadas-subsolos-outline-e-ermos-vazios) | Etapa 2 · Formas & Edifícios | Revisão multi-andar, porões, `outline` e quadrantes vazios | J3 | ⬜ |
| [J5](#j5--suportar-rotacao-em-atlas_edificio) | Etapa 2 · Formas & Edifícios | Casas rotacionadas (`poligono`) no construtor de edifícios | J3, J4 | ⬜ |
| [J6](#j6--conjuntos-exteriores-por-bioma-em-atlas_espalhar) | Etapa 3 · Ermos & Cercas | Conjuntos `mata-nevada`, `bosque-morto`, `encosta-rochosa`, `costa-rochosa` | — | ⬜ |
| [J7](#j7--receita-palicada-e-visual-tático-de-cercasmuros-fence-e-low) | Etapa 3 · Ermos & Cercas | Postes/travessas em `fence`, destaque em `low` e receita `palicada` | — | ⬜ |
| [J8](#j8--enriquecer-textura-de-neve-padrão-em-materiaists) | Etapa 4 · Terreno & Atmosfera | Micro-cristas e sombra fria em `'neve'` (sem parecer grama) | — | ⬜ |
| [J9](#j9--proteger-bordas-e-desempenho-do-relevo-em-mapas-grandes) | Etapa 4 · Terreno & Atmosfera | Sem artefatos radiais na margem do mapa e bake rápido | — | ⬜ |
| [J10](#j10--presets-cinematográficos-de-climaacabamento-com-glow-edges-e-sol-rasante) | Etapa 4 · Terreno & Atmosfera | Climas/acabamentos prontos com `glow`, `edges` e `sol` baixo | J2 | ⬜ |

---

## Etapa 1 — Guias do assistente e receitas no prompt

Objetivo: corrigir instruções obsoletas e dar ao assistente receitas concretas antes mesmo de mudar o motor. Risco mínimo, alto impacto imediato.

### J1 — Atualizar `referencias.md` e `lugares.md` para círculos, escala e ermos

**Objetivo:** remover recomendações obsoletas em `docs/assistente/guia/referencias.md` (que ainda manda simular círculos com octógono e usar `fence` para paliçada) e acrescentar regras objetivas de escala mínima, recorte tático de ilustrações panorâmicas e densidade uniforme dos ermos em `lugares.md`.

**Depende de:** nenhuma (`I4` concluída).

**Ler:**
- `docs/assistente/guia/referencias.md` (arquivo inteiro, ~4 KB)
- `docs/assistente/guia/lugares.md` (arquivo inteiro, ~4,5 KB)
- `docs/assistente/guia/ferramentas-atlas.md` (linhas 78–120, apenas seção `atlas_comodos`)

**Arquivos:**
- `docs/assistente/guia/referencias.md`
- `docs/assistente/guia/lugares.md`

**Como:**
1. Em `referencias.md`: substituir a nota *"ainda não há cômodo redondo: aproxime com um octógono de células..."* pela instrução direta de usar `atlas_comodos` com `circulo: { centro, raio, lados }` (`lados: 24` a `32`) para torres, faróis, moinhos, poços e arenas, e `poligono` para plantas inclinadas ou irregulares.
2. Em `referencias.md` (`## 3. Escala` e `## 4. Traduzir perspectiva em planta`):
   - Explicitar faixas de tamanho tático realista em metros: casa rural simples `>= 5×4 m` de largura útil; casarão/estalagem `>= 10–14 m`; torre/moinho/farol `raio >= 3.5–5 m` (com andares via `atlas_andares` + `escada` quando a referência mostrar torre alta). Evitar casas-miniatura de `1×2` células.
   - Ensinar a regra de **recorte tático de ilustrações em perspectiva**: quando a imagem mostrar uma paisagem panorâmica enorme (vilarejo inteiro + montanhas distantes), **não** inflar o mapa para `150×150 m` com bordas vazias; escolher um recorte focal denso (`45–85 m`) com todos os pontos importantes, **ou**, se o mestre pedir explícita e intencionalmente o mapa amplo, garantir preenchimento denso de floresta, rochedos e patamares até os 4 cantos.
   - Enquanto `J7` não for implementada, orientar a evitar `atlas_paredes { kind: "fence" }` como paliçada defensiva pesada (preferir muros baixos/toras/muralha ou esperar `J7`).
3. Em `lugares.md`: reforçar no item de aldeia/natureza a verificação dos **4 quadrantes externos** (arredores de vilas não podem ficar apenas no material base; combinar afloramentos `rocha.*` + `espalhar` + trilhas sinuosas + variação de terreno como `neve.funda` e `neve.pisada` em regiões frias).
4. Manter ambos os arquivos concisos (`< 6144` bytes cada).

**Não fazer:** não editar `nucleo.md` nem código TypeScript nesta ficha; não mexer nas demais seções de `docs/assistente/guia/`.

**Testes:**
```bash
wc -c docs/assistente/guia/referencias.md docs/assistente/guia/lugares.md
npm test
```

**Pronto quando:** `referencias.md` não cita mais "ainda não há cômodo redondo", traz escala mínima de edificações e regra de recorte de perspectiva, ambos os arquivos têm menos de 6 KB e a suíte passa.

**Commit:** `updated assistant reference and location guides for round rooms and scale`

---

### J2 — Receitas de iluminação, acabamento e profundidade nos guias

**Objetivo:** dar ao assistente receitas numéricas explícitas de `atlas_ambiente` (`sol` rasante, `glow`, `edges`, `vignette`), composição de profundidade em camadas/degraus (`relevo`, `rocha.*`, `cliff`) e checklist final de entrega em `projetar.md`, `mapas.md`, `ferramentas-atlas.md` e `nucleo.md`.

**Depende de:** `J1`.

**Ler:**
- `docs/assistente/nucleo.md` (1–51)
- `docs/assistente/guia/projetar.md` (inteiro, ~5 KB)
- `docs/assistente/guia/mapas.md` (linhas 1–90)
- `docs/assistente/guia/ferramentas-atlas.md` (linhas 11–26 e 325–354, seções `atlas_ambiente` e `atlas_terreno`)
- `scripts/exemplos/desfiladeiro-nevado.ts` (1–90, para consultar os valores de iluminação e acabamento usados nos exemplos oficiais)
- `scripts/exemplos/ravina-noturna.ts` (1–65)

**Arquivos:**
- `docs/assistente/guia/projetar.md`
- `docs/assistente/guia/mapas.md`
- `docs/assistente/guia/ferramentas-atlas.md`
- `docs/assistente/nucleo.md`

**Como:**
1. Em `projetar.md` (`## 7. Luz e clima` e `## 8. Conferir antes de entregar`):
   - Incluir tabela curta com receitas de `atlas_ambiente` inspiradas nos exemplos oficiais (ex.: exterior frio/nevado com `sol` rasante `angle: 0.65–0.85`, `glow: 0.35–0.55`, `vignette: 0.35–0.48`, `edges: { kind: "clouds"|"fog", amount: 0.35–0.5 }`; noturno com `glow: 0.45–0.8`, `edges: { kind: "dark"|"fog", amount: 0.5–0.7 }`; gruta com contraste entre tochas quentes e `ambiente` frio/escuro).
   - Adicionar regra prática de profundidade: alternar ao menos 2–3 degraus de altura (via `relevo` ou `rocha.*` maciço + `cliff` sequencial) e nunca deixar apenas um plano liso entre vila/caminho e abismo/encosta.
2. Em `mapas.md`: na conferência visual (`Confira com os olhos depois de cada bloco` e antes de `atlas_salvar`), exigir conferência dos **4 quadrantes externos** em `vista: "planta"` e `"telhados"`, verificando proporção das casas, variedade de ângulos/formas, vegetação externa e profundidade/luz.
3. Em `ferramentas-atlas.md`: expandir brevemente `## atlas_ambiente` (citando `glow`, `edges`, `grade` e `sol.angle` baixo para relevo dramático) e adicionar nota em `## atlas_terreno` sobre preferir `macico` (`rocha.*`) + `cliff` em grandes escarpas de contorno ou evitar patamares gigantes encostados na borda do mapa (até `J9` pousar).
4. Em `nucleo.md`: acrescentar lembrete curto (2–3 linhas) de nunca encerrar o ambiente no preset cru (`neutro` sem `glow`/`edges`) em mapas exteriores/atmosféricos e nunca entregar bordas externas vazias.
5. Garantir `< 6144` bytes em `nucleo.md` e `projetar.md`.

**Não fazer:** não alterar `ferramentas-atlas.md` fora de `atlas_ambiente` e `atlas_terreno`; não editar código TypeScript.

**Testes:**
```bash
wc -c docs/assistente/nucleo.md docs/assistente/guia/projetar.md
npm test
```

**Pronto quando:** `projetar.md`, `mapas.md`, `ferramentas-atlas.md` e `nucleo.md` ensinam receitas de `acabamento`/`sol`/profundidade e os testes passam.

**Commit:** `updated assistant guides with lighting finish and depth recipes`

---

## Etapa 2 — Formas livres, mobília, revisão e rotação de edifícios

Objetivo: fazer `src/authoring/` trabalhar nativamente com círculos, polígonos inclinados e edifícios multi-andar.

### J3 — Suportar `outline` em `insightDoComodo` e `malhaDoComodo`

**Objetivo:** fazer `insightDoComodo` (`src/authoring/insight.ts`) e `malhaDoComodo` (`src/authoring/malha.ts`) calcularem caixa, área e malha de colisão (`0,25 m`) diretamente a partir de `sala.outline` quando presente (`circulo` ou `poligono`), desbloqueando `atlas_mobiliar` e `propostaDeLuzes` em torres redondas e casas rotacionadas sem móveis atravessando paredes curvas ou diagonais.

**Depende de:** nenhuma (`G1–G4` concluídas).

**Ler:**
- `src/authoring/insight.ts` (1–63)
- `src/authoring/malha.ts` (1–85)
- `src/domain/formas-de-comodo.ts` (1–60 e 163–217)
- `tests/unit/insight.test.ts` (1–80)
- `tests/unit/malha.test.ts` (1–80)

**Arquivos:**
- `src/authoring/insight.ts`
- `src/authoring/malha.ts`
- `tests/unit/insight.test.ts`
- `tests/unit/malha.test.ts`
- `tests/unit/mobiliar-lote.test.ts` (se precisar de caso de integração com `circulo`/`poligono`)

**Como:**
1. Em `src/authoring/insight.ts` (`insightDoComodo`):
   - Quando `sala.outline && sala.outline.length >= 3`, calcular `caixa` pelo `min/max` dos pontos de `sala.outline` e `area` via `areaDoPoligono(sala.outline)` — sem retornar `null` caso `celulas` esteja vazio (como pode ocorrer em torres estreitas ou faixas diagonais).
   - Manter o comportamento atual intacto quando `sala.outline` for ausente.
2. Em `src/authoring/malha.ts` (`malhaDoComodo`):
   - Quando `sala?.outline && sala.outline.length >= 3`, marcar cada subcélula `(c, l)` da malha de `RES_MALHA` (`0,25 m`) como ocupada fora do cômodo se `!pontoNoPoligono([cx, cy], sala.outline)`, em vez de depender apenas da grade bruta de células quadradas `1,5 m`.
   - Conferir se o `Buffer` / marcação de borda junto às paredes (`arestas` ou distância aos segmentos de `contornoDoComodo`) respeita folga de parede sem bloquear toda uma torre circular de `raio = 3..4 m`.
3. Escrever testes unitários cobrindo um cômodo `circulo([10, 10], 4, 24)` e um retângulo `poligono` rotacionado em 30°: `insightDoComodo` retorna `area` e `caixa` precisas, `malhaDoComodo` nega pontos fora do círculo dentro da AABB e `mobiliarLote` / `propostaDeMobilia` posiciona móveis inteiramente dentro do contorno.

**Não fazer:** não reescrever `src/authoring/layout.ts` nem `regras-mobilia.ts`; não importar nada de `render/` ou UI.

**Testes:**
```bash
npm run typecheck
npx vitest run tests/unit/insight.test.ts tests/unit/malha.test.ts tests/unit/mobiliar.test.ts tests/unit/mobiliar-lote.test.ts tests/unit/luzes.test.ts
```

**Pronto quando:** `atlas_mobiliar` mobília torres redondas (`circulo`) e cômodos rotacionados (`poligono`) mantendo todos os objetos dentro do contorno.

**Commit:** `supported outline rooms in insight and furniture grid`

---

### J4 — Atualizar `atlas_revisar` para escadas, subsolos, `outline` e ermos vazios

**Objetivo:** eliminar falsos positivos em mapas multi-andar/redondos e detectar quadrantes externos vazios em `src/authoring/revisao.ts`.

**Depende de:** `J3`.

**Ler:**
- `src/authoring/revisao.ts` (linhas 70–170 e 450–515)
- `src/domain/mapa.ts` (linhas 120–160, campos `Interacao` e `levelId`)
- `src/domain/geometria.ts` (linhas 275–315, como `comodoEm` trata `outline`)
- `tests/unit/revisao.test.ts` (1–120)

**Arquivos:**
- `src/authoring/revisao.ts`
- `tests/unit/revisao.test.ts`

**Como:**
1. Em `regraComodoSemAcesso` (`src/authoring/revisao.ts:76-128`):
   - Além das portas e aberturas horizontais entre cômodos, inspecionar `m.props` com `interaction?.kind === 'stairs'` (e `toLevel !== undefined` / `toPosition`): ligar no grafo o cômodo de origem da escada ao cômodo (no andar `toLevel`) que contém `toPosition` (via `comodoEm`), ou marcar o cômodo destino como conectado quando a escada parte do exterior acessível. Isso evita que porões e 2º andares de faróis/moinhos sejam marcados como inacessíveis.
2. Em `regraEdificioSemTelhado` (`src/authoring/revisao.ts:138-157`):
   - Pular cômodos cujo `levelId` aponte para um andar com `order < 0` (`m.levels?.[s.levelId]?.order < 0`), pois porões e subterrâneos não têm telhado próprio.
3. Em `regraComposicaoCentralizada` (`src/authoring/revisao.ts:460`):
   - Calcular a caixa do cômodo usando o `min/max` de `s.outline` quando existir (caindo para `caixaDasCelulas(m, decodificar(s.cells))` caso contrário).
4. Adicionar regra leve `regraErmosVazios`: em mapas com exterior (`temTerrenoExterior(m)` e `W >= 40 && H >= 40`), dividir o mapa em quadrantes `2×2`; se algum quadrante tiver ao menos 60% de área fora de prédios e **nenhum** prop, camada extra de terreno (`terrain.layers`), água ou patamar de relevo distinto ali dentro, emitir aviso `ermos-vazios` sugerindo povoar o quadrante.
5. Cobrir os quatro casos novos em `tests/unit/revisao.test.ts`.

**Não fazer:** não alterar `src/domain/` nem regras de UI; não disparar `ermos-vazios` em mapas pequenos (`< 40 m`) ou puramente interiores.

**Testes:**
```bash
npm run typecheck
npx vitest run tests/unit/revisao.test.ts
```

**Pronto quando:** `atlas_revisar` aceita escadas entre andares e subsolos sem alarme falso, enxerga cômodos `outline` na composição e aponta quadrantes externos abandonados.

**Commit:** `fixed review rules for stairs levels outlines and empty wilderness`

---

### J5 — Suportar `rotacao` em `atlas_edificio`

**Objetivo:** permitir que cada edifício em `atlas_edificio` receba `rotacao?: number` (em radianos, consistente com `atlas_objetos`, `atlas_arranjo` e `sol.angle`), gerando casas e galpões distribuídos em ângulos naturais via `outline` (`poligono`), com portas, janelas, telhados e mobília alinhados.

**Depende de:** `J3`, `J4`.

**Ler:**
- `src/authoring/edificio.ts` (linhas 1–70 e o retorno final do módulo)
- `src/authoring/edificio-construir.ts` (1–120)
- `src/domain/geometria.ts` (linhas 443–480, `contornoDoComodo`)
- `src/app/ponte-escrita.ts` (linhas 360–425, `atlas_edificio`)
- `tests/unit/edificio-construir.test.ts` (1–100)

**Arquivos:**
- `src/authoring/edificio.ts`
- `src/authoring/edificio-construir.ts`
- `src/app/ponte-escrita.ts`
- `scripts/ponte/catalogo-base.json` (gerado por `npm run ponte:catalogo`)
- `docs/assistente/guia/ferramentas-atlas.md` (seção `atlas_edificio`, menção a `rotacao`)
- `tests/unit/edificio-construir.test.ts`
- `tests/unit/ponte-escrita.test.ts`

**Como:**
1. Estender `PedidoDeEdificio` / `ProgramaDeEdificio` em `edificio.ts` / `edificio-construir.ts` com `rotacao?: number` (em radianos; padrão `0`).
2. Manter todo o cálculo retangular de planta (`plantaDoEdificio` sobre `origem`..`lote`) em coordenadas locais ortogonais, para não duplicar nem quebrar lógica de cômodos, alpendre, portas internas e telhado.
3. Em `construirEdificios`: quando `rotacao` for diferente de `0` (`Math.abs(rotacao) > 1e-4`), calcular o pivô `[cx, cy]` como o centro da bounding box total do edifício em metros.
   - Para cada cômodo, converter suas células em contorno poligonal via `contornoDoComodo` (ou fusão dos `rets` em vértices externos) e rotacionar cada vértice em torno de `[cx, cy]` por `rotacao`, gravando o resultado em `poligono` (`outline`) ao chamar `construir` (reaproveitando o fluxo de cômodo `outline` + telhado já suportado pelo núcleo desde `ce7e8f8` / `d82184c`).
   - Rotacionar igualmente posições de alpendre/aberturas (`portas`, `janelas`) ou reconstruir janelas externas a partir das paredes resultantes e girar posição (`rotacionarPonto`) e orientação (`rotation + rotacao`) de todos os móveis/luzes gerados.
4. Quando `rotacao` for `0` ou omitido, manter exatamente o caminho por células atual (`rets`), sem regressão nos testes existentes.
5. Expor `rotacao: { type: 'number' }` no esquema de `edificios[]` em `src/app/ponte-escrita.ts` (validando `numero(..., -100, 100)`), atualizar brevemente a seção `## atlas_edificio` de `ferramentas-atlas.md` (exemplificando ângulos úteis como `0.26` rad ≈ 15°, `-0.35` rad ≈ -20°) e regerar `scripts/ponte/catalogo-base.json`.

**Não fazer:** não alterar `plantaDoEdificio` para alocar cômodos diretamente em coordenadas livres; manter esquema inline de `ponte-escrita.ts` abaixo de 22 KB.

**Testes:**
```bash
npm run ponte:catalogo
npm run typecheck
npx vitest run tests/unit/edificio.test.ts tests/unit/edificio-construir.test.ts tests/unit/ponte-escrita.test.ts
```

**Pronto quando:** `atlas_edificio` com `rotacao: 0.35` cria uma casa coesa inclinada a ~20°, com paredes, portas, janelas, telhado e móveis alinhados e dentro dos cômodos.

**Commit:** `added building rotation support in high-level builder`

---

## Etapa 3 — Ermos por bioma e renderização real de cercas e paliçadas

Objetivo: encerrar mapas com vegetação de bioma compatível e cercas/paliçadas com volume visual tático.

### J6 — Conjuntos exteriores por bioma em `atlas_espalhar`

**Objetivo:** acrescentar conjuntos exteriores específicos (`mata-nevada`, `bosque-morto`, `encosta-rochosa`, `costa-rochosa`) em `CONJUNTOS_EXTERIORES` (`src/authoring/espalhar.ts`) usando os assets já existentes no acervo (`casa:pinheiro-nevado-*`, árvores nevadas/mortas, rochedos, pedras), evitando que vilas nevadas ou montanhas recebam árvores verdes temperadas.

**Depende de:** nenhuma.

**Ler:**
- `src/authoring/espalhar.ts` (1–75)
- `src/app/ponte-escrita.ts` (linhas 515–534, `atlas_espalhar`)
- `tests/unit/espalhar.test.ts` (1–90)
- Catálogo de assets nevados/rochosos existentes (`grep -rn "nevad\|pinheiro\|rochedo\|arvore-morta" src/procedural/`)

**Arquivos:**
- `src/authoring/espalhar.ts`
- `scripts/ponte/catalogo-base.json` (regere via `npm run ponte:catalogo` porque `atlas_espalhar` usa `enum: TODOS_OS_CONJUNTOS.map(c => c.id)`)
- `docs/assistente/guia/ferramentas-atlas.md` (linhas 188–196, seção `atlas_espalhar`)
- `tests/unit/espalhar.test.ts`
- `tests/unit/ponte-escrita.test.ts` (se validar conjuntos)

**Como:**
1. Confirmar com `grep` os IDs exatos no acervo (`casa:pinheiro-nevado-*`, `casa:arvore-nevada-*`, `casa:arbusto-seco-2m-neve`, `arvore-morta`, `galho-seco`, `rochedo`, `seixos`, `toco`, etc. — nunca inventar ID não existente).
2. Adicionar em `CONJUNTOS_EXTERIORES` (`src/authoring/espalhar.ts`):
   - `'mata-nevada'`: pinheiros e árvores nevadas com variação de porte, arbustos nevados/secos e pedras/rochedos;
   - `'bosque-morto'`: árvores mortas, galhos secos, tocos e pedras;
   - `'encosta-rochosa'`: rochedos, seixos e vegetação rala seca/nevada;
   - `'costa-rochosa'`: rochedos, pedras/seixos e troncos/detritos costeiros.
3. Atualizar a seção `## atlas_espalhar` em `docs/assistente/guia/ferramentas-atlas.md` listando os novos conjuntos recomendados por bioma.
4. Rodar `npm run ponte:catalogo` para atualizar `scripts/ponte/catalogo-base.json` com o enum atualizado de `conjunto`.

**Não fazer:** não criar novas receitas em `src/procedural/` nesta ficha; não mexer no algoritmo geométrico de `espalhar.ts`.

**Testes:**
```bash
npm run ponte:catalogo
npm run typecheck
npx vitest run tests/unit/espalhar.test.ts tests/unit/ponte-escrita.test.ts
```

**Pronto quando:** `atlas_catalogo { parte: "conjuntos" }` lista os novos conjuntos e `atlas_espalhar` distribui apenas flora/rochas compatíveis em mapas nevados/rochosos.

**Commit:** `added snow rocky and deadwood scatter presets for outdoors`

---

### J7 — Receita `palicada` e renderização tática de cercas (`fence`, `low`)

**Objetivo:** substituir o traço cinza liso de `p.kind === 'fence'` e `'low'` em `src/render/cena.ts` por uma representação visual tática com postes/estacas e travessas, e criar a receita `palicada` em `src/procedural/receitas/exterior.ts` para fortificações de madeira via `atlas_arranjo` (`ao-longo`).

**Depende de:** nenhuma.

**Ler:**
- `src/render/cena.ts` (linhas 220–262, `desenharParede` e `desenharParedes`)
- `src/procedural/receitas/exterior.ts` (1–80)
- `docs/assistente/guia/referencias.md` (seção `## 4`) e `ferramentas-atlas.md` (`## atlas_paredes`)
- `tests/unit/receitas.test.ts` (1–80)

**Arquivos:**
- `src/procedural/receitas/exterior.ts`
- `src/render/cena.ts`
- `docs/assistente/guia/referencias.md`
- `docs/assistente/guia/ferramentas-atlas.md`
- `tests/unit/receitas.test.ts`

**Como:**
1. Em `src/procedural/receitas/exterior.ts`: adicionar receita `palicada` (ao lado de `cerca`), gerando segmentos modulares de toras verticais encostadas (~`2 m` de largura por padrão, diâmetros e alturas levemente variados com `seed`, travessa horizontal amarrada e sombra de contato), com `blocos` / cobertura limpa compatível com o sistema de receitas (`descreverReceita` / `ilustrado`).
2. Em `src/render/cena.ts` (`desenharParede`, por volta das linhas 237–251):
   - Quando `p.kind === 'fence'`: desenhar sombra sutil deslocada, travessas de madeira conectando os vértices de `p.path` e mourões/postes periódicos ao longo de cada segmento (espaçamento ~`1,0–1,4 m`, respeitando largura visual mínima `lw(...)` no Pixel), usando tons quentes de madeira com contorno escuro legível em qualquer terreno (inclusive neve clara).
   - Quando `p.kind === 'low'`: manter a parede baixa distinta das paredes altas, mas usando o tom/material configurado no trecho (ou pedra/madeira sóbria) com borda externa escura nítida e sombra leve em vez da única cor fixa `0x4a4658`.
3. Atualizar `referencias.md` e `ferramentas-atlas.md` indicando `palicada` (via `atlas_arranjo` `padrao: "ao-longo"`, `espacamento: [2.0, 0]`) para muralhas de toras e `fence` para cercas leves de pasto/jardim.

**Não fazer:** não alterar `blocks.sight` ou propriedades de colisão de `Parede` em `src/domain/`; não criar cache de textura pesado para linhas vetoriais simples.

**Testes:**
```bash
npm run typecheck
npx vitest run tests/unit/receitas.test.ts tests/unit/preparar-cena.test.ts tests/unit/acervo.test.ts
```

**Pronto quando:** cercas (`fence`) e muros baixos (`low`) exibem postes/textura tática legível sobre neve e terra, e a receita `palicada` aparece em `atlas_catalogo` e renderiza fileiras contínuas de toras.

**Commit:** `improved fence wall rendering and added palisade exterior prop`

---

## Etapa 4 — Terreno de neve, relevo seguro e presets cinematográficos

Objetivo: dar ao terreno base, patamares em mapas amplos e presets atmosféricos a mesma qualidade visual dos mapas de exemplo oficiais.

### J8 — Enriquecer textura de `'neve'` padrão em `materiais.ts`

**Objetivo:** melhorar o padrão de pintura de `'neve'` em `src/procedural/materiais.ts` (linhas 113 e 344) para exibir variações suaves de vento e sombra fria em vez de parecer ruído uniforme de grama clara em zoom tático.

**Depende de:** nenhuma.

**Ler:**
- `src/procedural/materiais.ts` (linhas 105–145, 335–365 e 445–475)
- `tests/unit/materiais-rusticos.test.ts` (1–60)
- `tests/unit/materiais-pixel.test.ts` (1–60)

**Arquivos:**
- `src/procedural/materiais.ts`
- `tests/unit/materiais-rusticos.test.ts` (se necessário validar o material)

**Como:**
1. Em `src/procedural/materiais.ts` (`case 'neve'` em `pintarMaterial`, perto da linha 344):
   - Substituir o ruído de alta frequência com cara de folhagem por uma versão sutil de ondas de vento em baixa frequência (inspirada em `pintarDunas`, porém com amplitude e contraste reduzidos para permanecer um fundo neutro legível sob objetos e trilhas) combinada com um brilho frio sutil (`#ffffff`) e sombra azulada suave (`#c8d6e6` / `escuro`), preservando tileabilidade (se aplicada em ladrilhos periódicos) ou usando ruído coerente sem costuras.
2. Conferir que `'neve'`, `'neve.funda'` (cristas marcadas) e `'neve.pisada'` mantêm clara hierarquia visual quando sobrepostas em camadas.

**Não fazer:** não modificar `'neve.funda'` nem `'neve.pisada'`; não tornar `'neve'` tão contrastada a ponto de poluir a leitura de tokens e móveis.

**Testes:**
```bash
npm run typecheck
npx vitest run tests/unit/materiais-rusticos.test.ts tests/unit/materiais-pixel.test.ts tests/unit/receitas.test.ts
```

**Pronto quando:** `'neve'` renderiza como manto nevado frio suave em qualquer escala, claramente distinto de grama em tom claro.

**Commit:** `enriched snow terrain texture to avoid grass-like noise`

---

### J9 — Proteger bordas e desempenho do `relevo` em mapas grandes

**Objetivo:** eliminar artefatos radiais na margem do mapa em `mascaraSuavizada` (`src/procedural/assar.ts`) quando patamares tocam as bordas e reduzir o tempo de bake de `relevo` em mapas extensos (`>= 100×100 m`).

**Depende de:** nenhuma (`J2` já documentou o cuidado manual nos guias).

**Ler:**
- `src/procedural/assar.ts` (linhas 195–290)
- `src/domain/relevo.ts` (linhas 100–145)
- `src/render/entradas.ts` (linhas 144–175)
- `tests/unit/relevo.test.ts` (1–90)
- `tests/unit/profundidade.test.ts` (1–90)

**Arquivos:**
- `src/procedural/assar.ts`
- `src/domain/relevo.ts` (apenas se precisar filtrar escarpas geradas exatamente na moldura externa do mundo)
- `tests/unit/relevo.test.ts`

**Como:**
1. Em `src/procedural/assar.ts` (`mascaraSuavizada`, linhas 199–220):
   - Diagnosticar o comportamento nas bordas ao desenhar com `drawImage` + desfoque em margem estendida: quando uma faixa de `relevo` toca a margem do mapa (`0`, `W` ou `Hh`), evitar que a extensão linear de borda ou recorte do filtro gere faixas/arcos anômalos dentro da área útil (preencher a margem de segurança de maneira consistente com os vizinhos reais ou tratar a borda do canvas temporário).
2. Avaliar e reduzir o custo de CPU em `relevo` para mapas grandes (`W * H >= 8000` m²):
   - Reduzir passes duplicados de máscara por faixa ou ajustar a resolução da máscara de altitude (`relevo` aplica cor/neblina suavizada sobre `0,5 m` de blur — não precisa de sub-pixelização pesada em `165×135 m`).
3. Em `tests/unit/relevo.test.ts`, adicionar caso com patamar encostado em duas margens do mapa (`x = 0`, `y = 0`) garantindo ausência de borda espúria / estabilidade de escarpas.

**Não fazer:** não mudar o formato persistido de `terrain.relief` nem quebrar `bordasDoRelevo` / `alturaEm`.

**Testes:**
```bash
npm run typecheck
npx vitest run tests/unit/relevo.test.ts tests/unit/profundidade.test.ts tests/unit/escarpa.test.ts
```

**Pronto quando:** patamares que encostam na margem do mapa não criam listras radiais nas bordas e mapas acima de `120×120 m` com múltiplos níveis de relevo assam rapidamente.

**Commit:** `fixed relief edge masking artifacts and optimized large map baking`

---

### J10 — Presets cinematográficos de clima e acabamento (`glow`, `edges`, `sol` rasante)

**Objetivo:** fazer `PRESETS_DE_CLIMA` e `PRESETS_DE_ACABAMENTO` (`src/domain/presets.ts`) entregarem atmosferas com `glow`, `edges` (`clouds`/`fog`/`dark`) e `sol` baixo rasante comparáveis aos mapas de exemplo oficiais, em vez de todos nascerem com `...SEM_BORDA` (`glow: 0`, `edges: none`).

**Depende de:** `J2`.

**Ler:**
- `src/domain/presets.ts` (linhas 62–115)
- `scripts/exemplos/desfiladeiro-nevado.ts` (linhas 1–40, `climate`/`finish`)
- `scripts/exemplos/ravina-noturna.ts` (linhas 1–40)
- `tests/unit/presets.test.ts` (1–90)
- `tests/unit/climas.test.ts` (1–70 — **atenção à linha 15**, que faz `deepEqual` na lista exata de IDs de `PRESETS_DE_CLIMA`)

**Arquivos:**
- `src/domain/presets.ts`
- `src/app/ponte-escrita.ts` (somente se ajustar enum/descrição; já usa `PRESETS_DE_ACABAMENTO.map(...)` dinamicamente)
- `scripts/ponte/catalogo-base.json` (regere via `npm run ponte:catalogo` se IDs mudarem)
- `docs/assistente/guia/ferramentas-atlas.md` (seção `atlas_ambiente`)
- `tests/unit/presets.test.ts`
- `tests/unit/climas.test.ts`

**Como:**
1. Enriquecer presets existentes sem quebrar mapas salvos nem contratos de cor/noite:
   - Ajustar `'neve'` em `PRESETS_DE_CLIMA` para incluir `sol` mais rasante (~`0.7–0.8` rad em vez de 11:00 a pino), `glow` suave (`0.3–0.45`), `vignette` leve (`0.38`) e `edges: { kind: 'clouds', amount: 0.35 }`.
   - Dar `glow` discreto e `edges` coerentes aos presets naturalmente atmosféricos (`'neblina'` → `edges: 'fog'`; `'tempestade'` → `vignette` + `dark` leve; `'noite'` / `'apagao'` → `glow: 0.35–0.5`, `edges: 'dark'` sutil).
   - Conferir primeiro as asserções em `tests/unit/climas.test.ts` e `tests/unit/presets.test.ts` para preservar invariantes testados.
2. Opcionalmente adicionar 1–2 presets novos em `PRESETS_DE_ACABAMENTO` (ex.: `'inverno-nevado'`, `'sombrio-cinematografico'`) com `glow`, `grade` e `edges` ajustados — lembrando que adicionar IDs em `PRESETS_DE_CLIMA` exige atualizar `tests/unit/climas.test.ts:15` e rodar `npm run ponte:catalogo`.
3. Atualizar brevemente `## atlas_ambiente` em `docs/assistente/guia/ferramentas-atlas.md` destacando os presets enriquecidos.

**Não fazer:** não remover ou renomear nenhum `id` existente em `PRESETS_DE_CLIMA` ou `PRESETS_DE_ACABAMENTO`.

**Testes:**
```bash
npm run ponte:catalogo
npm run typecheck
npx vitest run tests/unit/presets.test.ts tests/unit/climas.test.ts tests/unit/ponte-presets.test.ts tests/unit/ponte-escrita.test.ts
```

**Pronto quando:** aplicar presets como `neve`, `noite` e `neblina` via `atlas_ambiente` já produz vinheta, `glow`, `edges` e direção de sol cinematográfica sem ajuste manual extenso.

**Commit:** `added atmospheric glow edges and grazing sun to climate presets`
