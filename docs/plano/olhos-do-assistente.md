# Frente B — Olhos do assistente

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Atlas** (conector em `src/app/ponte-*.ts`, servidor em `scripts/ponte/`). Quem implementa: Gemini.

## O que estamos tentando fazer

O Claude do app constrói às cegas em três sentidos:

1. **Não vê o que o jogador vê.** `atlas_ver_mapa` fotografa a vista Construir, onde os telhados ficam escondidos (`alvoDe` em `src/render/telhados.ts` devolve 0 em `construir`). Um mapa de vila pode estar todo coberto, e o Claude vê só interiores.
2. **Não lê o que fez.** `atlas_mapa_ler` resume cada cômodo como o retângulo envolvente, sem telhado, sem forma real e sem a casa (edifício) a que pertence.
3. **Não tem crítica.** O guia diz "confira com os olhos", mas "bom" fica a critério dele. Erros que um mestre vê de cara passam: 118 lápides iguais em grade, 40 casas do mesmo tamanho, cômodo sem porta, interior vazio.

Além disso, o catálogo esconde coisas. Os **conjuntos** do `atlas_espalhar` (`cemiterio`, `mata`, `jardim`…) não aparecem em nenhuma parte do `atlas_catalogo`, embora a descrição da ferramenta mande procurá-los em `receitas`. Os tipos de cômodo estão escondidos em `climas`. E não há busca: para achar "o que existe para cemitério", o Claude teria de ler 234 receitas.

**Meta:** o Claude vê o mapa como o jogador vai ver, lê o que construiu em termos de casas e formas, acha o que precisa no catálogo e roda uma revisão objetiva que aponta os defeitos clássicos antes de entregar.

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| B1 | `atlas_ver_mapa` com `vista: 'planta' \| 'telhados'` | render + conector |
| B2 | `atlas_mapa_ler` com edifícios, forma e telhado | conector (puro) |
| B3 | O guia é relido a cada chamada | servidor MCP |
| B4 | Catálogo: conjuntos, tipos de cômodo e busca | conector (puro) |
| B5a | Revisão: regras de estrutura | `authoring` puro |
| B5b | Revisão: regras de composição | `authoring` puro |
| B5c | Ferramenta `atlas_revisar` | conector |

Ordem: B1, B2, B3 e B4 em qualquer ordem; B5a → B5b → B5c.

---

### B1 — `atlas_ver_mapa` com vista de telhados  ✅
Objetivo: o Claude escolhe entre ver a planta (interiores) e ver os telhados (como o mapa aparece aos jogadores por fora).
Depende de: —.
Ler: `src/render/viewport.ts` (`capturar`, `projetor`), `src/render/cena.ts` (como `telhados` é criado e a interface `Cena`), `src/render/telhados.ts` inteiro (`alvoDe`, `reavaliar`, `imediato`, o `return`), `src/app/ponte-leitura.ts` (`atlas_ver_mapa`, `ContextoDeLeitura.capturar`), `src/app/ponte.ts:31` (a ligação de `capturar`).
Arquivos: mudar `telhados.ts`, `cena.ts`, `viewport.ts`, `ponte-leitura.ts`, `ponte.ts`, `docs/assistente/guia/ferramentas-atlas.md`; testes em `tests/unit/ponte-leitura.test.ts` e um e2e em `tests/e2e/telhados.test.ts`.
Como:
1. Em `criarTelhados`, acrescente `forcar(alfa: number | null): void`. Com um número, todo edifício com algum cômodo `roof.visible` fica com esse alfa **na hora** (sem fade, como no ramo `imediato`), ignorando vista, sessão e peças. Com `null`, volta ao cálculo normal (`reavaliar()` e alfa imediato no alvo). `alvoDe` passa a checar o forçado primeiro.
2. Na `Cena`, exponha `forcarTelhados(alfa: number | null)`.
3. Em `capturar(opcoes)`, aceite `vista?: 'planta' | 'telhados'` (padrão `'planta'`). Com `'telhados'`, chame `cena.forcarTelhados(1)` antes do laço de espera e `cena.forcarTelhados(null)` no `finally`. Os telhados são assados no worker: o laço que espera `cena.pintando === 0` já cobre isso. Confira no e2e que a captura sai com o telhado desenhado.
4. Em `ContextoDeLeitura.capturar` e na ferramenta: parâmetro `vista` (`enum: ['planta', 'telhados']`). O texto da resposta diz qual vista foi usada. Mantenha a descrição com até 180 caracteres, por exemplo: "Captura JPEG do mapa aberto (todo ou caixa [x0,y0,x1,y1] m). vista: planta (interiores) ou telhados (como os jogadores veem de fora). Retorna escala e caixa."
5. No guia, seção `atlas_ver_mapa`: quando usar cada vista ("depois de construir casas, confira as duas").
Não fazer: vista de andar (fica para a frente H); mudar a vista do editor.
Testes: unitário da ferramenta (a opção `vista` chega ao `capturar`; valor inválido é recusado); e2e com um mapa de uma casa coberta em que a captura `telhados` difere da `planta` (compare a cor média do centro da casa nas duas).
Pronto quando: `atlas_ver_mapa { vista: 'telhados' }` mostra os telhados num mapa em Construir, e a vista do editor não muda depois da captura.
Commit: `ver_mapa can capture with roofs closed`

### B2 — `atlas_mapa_ler` com edifícios, forma e telhado  ✅
Objetivo: o Claude lê o mapa em termos de casas, com a forma e o telhado de cada uma.
Depende de: —.
Ler: `src/app/ponte-leitura.ts` (`resumirMapa`), `src/domain/edificios.ts` (`edificiosDe`), `src/domain/telhado-geometria.ts` (`retangulosDe`), `src/domain/presets.ts` (`ESTILOS_DE_TELHADO`), `src/domain/celulas.ts` (`decodificar`, `area`).
Arquivos: mudar `ponte-leitura.ts`, `tests/unit/ponte-leitura.test.ts`, guia `ferramentas-atlas.md` (seção `atlas_mapa_ler`).
Como:
1. Cada cômodo ganha:
   - `rets`: os retângulos de `retangulosDe(decodificar(c.cells))` **em células** `[x0, y0, x1, y1]` (fim exclusivo), no mesmo formato que `atlas_comodos` recebe;
   - `area` em m²;
   - `telhado`: `null` sem material; senão `{ estilo }` quando material, forma, íngreme e detalhes batem com um `ESTILOS_DE_TELHADO` (compare com `formaDe` dos dois lados), ou `{ cobertura, forma, ingreme, detalhes }`;
   - `edificio`: id do edifício (de `edificiosDe`), ou ausente.
   - Mantenha `retangulo` (em metros), por compatibilidade.
2. Novo campo de topo `edificios`: `[{ id, nome, salas: [ids], area (m²), caixa: [x, y, largura, altura] em m, telhados: [estilos ou coberturas distintos] }]`. O `nome` é o prefixo comum dos nomes das salas antes de " · " (ex.: "Casa Falk · sala" → "Casa Falk"), ou o nome da maior sala.
3. Novo campo `resumo`: `{ edificios: n, areaMedia: m², areaMin, areaMax, comodosSemTelhado: n, retangulares: n }`, em que `retangulares` conta edifícios cujo conjunto de células é um único retângulo.
4. Atualize a resposta para mapas grandes: se o JSON passar de 60 KB, troque `rets` por `retsResumidos: n` nos cômodos (o Claude pede o detalhe com `atlas_mapa_ler { id, comodos: [ids] }`, parâmetro novo opcional que limita a resposta aos cômodos pedidos).
Não fazer: andares (frente H acrescenta `andar`).
Testes: cômodo em L devolve 2 `rets` iguais aos de entrada; telhado de estilo `igreja` volta como `{ estilo: 'igreja' }`; um telhado ajustado volta por campos; duas salas que se tocam caem no mesmo `edificio`; `resumo.retangulares` conta certo.
Pronto quando: o resumo de "Lysdal · a vila (neve)" mostra 40 cômodos em cerca de 18 edifícios, com `comodosSemTelhado` alto.
Commit: `map summary reports buildings, room shapes and roofs`

### B3 — O guia é relido a cada chamada  ⬜
Objetivo: melhorar o guia não exige reiniciar o app do Claude.
Depende de: —.
Ler: `scripts/ponte/mcp.ts` (`lerGuia`, `ferramentaGuia`, `textoDoGuia`, `listarFerramentas`, `chamarFerramenta` e o trecho de `criarServidor` que faz `const guia = lerGuia(...)`), `tests/unit/ponte-mcp.test.ts`.
Arquivos: mudar `mcp.ts` e `ponte-mcp.test.ts`.
Como:
1. Em `criarServidor`, troque a leitura única por uma função `guiaAgora = () => lerGuia(pasta)`, chamada no `ListTools` e em cada `plataforma_guia`. Ler alguns `.md` por chamada é barato.
2. Se a pasta sumir ou um arquivo falhar, devolva o que deu para ler e um aviso, sem derrubar o servidor.
3. `plataforma_guia` aceita `secao` como texto ou lista de até 4 seções, e devolve as seções concatenadas, cada uma com um título.
Não fazer: reler o `nucleo.md` (ele vai no `initialize`; o MCP não tem como reenviar).
Testes: criar um `.md` novo na pasta temporária depois de criar o servidor e ver a seção aparecer; lista de seções; seção inexistente dá a lista das que existem.
Pronto quando: editar `docs/assistente/guia/mapas.md` com o app do Claude aberto e chamar `plataforma_guia mapas` traz o texto novo.
Commit: `guide sections are reread on every call`

### B4 — Catálogo: conjuntos, tipos de cômodo e busca  ⬜
Objetivo: o Claude acha o que existe sem ler o catálogo inteiro.
Depende de: —.
Ler: `src/app/ponte-leitura.ts` (`catalogo`, `PARTES`, a ferramenta `atlas_catalogo`), `src/authoring/espalhar.ts` (`TODOS_OS_CONJUNTOS`, a forma de cada conjunto), `src/procedural/receitas/index.ts` (`listaDeReceitas`), `src/procedural/colecao.ts` (`COLECAO`).
Arquivos: mudar `ponte-leitura.ts`, `ponte-escrita.ts` (descrição do `atlas_espalhar`, que hoje aponta para `receitas`), testes em `tests/unit/ponte-leitura.test.ts`, guia `ferramentas-atlas.md` e `mapas.md` (passo 5 de "Antes de construir").
Como:
1. Nova parte `conjuntos`: `TODOS_OS_CONJUNTOS.map(c => ({ id, nome, descricao, densidade, itens: c.itens.map(i => i.receita) }))`. Se o conjunto tiver `grade`, inclua `arranjo: 'fileiras'`.
2. Nova parte `comodos`: os `TIPOS_DE_COMODO` (id, nome, função, piso, papel, descrição) e, para cada função, se há mobília automática (`regrasPara(funcao, genero)` não vazia) e se nasce sem telhado (`FUNCOES_AO_AR_LIVRE`). Mantenha `tiposDeComodo` em `climas` por compatibilidade.
3. Parâmetro `busca` (texto, até 60): filtra receitas, coleção e conjuntos por id, nome, tags e funções, sem acento e sem maiúsculas. Sem `parte` e com `busca`, procura em receitas, coleção, conjuntos e materiais e devolve `{ receitas, colecao, conjuntos, materiais }`, até 40 de cada. Exemplo: `atlas_catalogo { busca: 'cemiterio' }`.
4. Índice (sem `parte`): inclua `conjuntos` e `comodos` nas contagens e a dica "use busca para procurar por palavra".
5. Descrição do `atlas_espalhar`: "Conjuntos em atlas_catalogo { parte: \"conjuntos\" }".
Testes: `busca: 'cemiterio'` traz o conjunto `cemiterio`, a `lapide` e o `banco.jardim`; `parte: 'conjuntos'` lista `mata`; a parte desconhecida continua dando a lista de partes.
Pronto quando: o índice mostra as partes novas e a busca funciona pela ferramenta.
Commit: `catalog lists scatter sets, room types and supports search`

### B5a — Revisão: regras de estrutura  ⬜
Objetivo: uma função pura aponta defeitos objetivos de construção.
Depende de: —.
Ler: `src/authoring/insight.ts` (`InsightDoComodo` e a função que o calcula), `src/authoring/portas.ts` (`reservasDePorta`), `src/domain/edificios.ts`, `src/domain/presets.ts` (`FUNCOES_AO_AR_LIVRE`), `src/procedural/acervo.ts` (`ACERVO.item`, `pegadaDaFonte`).
Arquivos: criar `src/authoring/revisao.ts` e `tests/unit/revisao.test.ts`.
Como:
1. Tipos:
   ```ts
   export type Gravidade = 'erro' | 'aviso' | 'dica';
   export interface Achado { regra: string; gravidade: Gravidade; mensagem: string; sugestao: string; ids: string[]; caixa?: [number, number, number, number] }
   export function revisarMapa(m: MapaAtlas, opcoes?: { regras?: string[] }): Achado[]
   ```
   O resultado sai ordenado por gravidade (erro, aviso, dica) e tem no máximo 15 achados; quando há mais, o último é um achado `mais` com a contagem.
2. Regras desta ficha (ids estáveis, mensagem em português simples):
   - `comodo-sem-acesso` (erro): cômodo sem porta, arco ou passagem para fora nem para outro cômodo que tenha acesso. Faça uma busca em largura a partir dos cômodos com abertura para fora.
   - `edificio-sem-telhado` (aviso): edifício (cômodos que se tocam) em que nenhum cômodo de função coberta tem `roof.material`. Ignore mapas sem nenhum terreno exterior (base `vazio` ou masmorra), em que o telhado não faz sentido.
   - `interior-vazio` (aviso): cômodo de área ≥ 9 m², função diferente de `corredor`, com menos de 1 objeto de piso por 8 m². Sugestão: `atlas_mobiliar` (frente D) ou objetos da função.
   - `porta-bloqueada` (erro): objeto que bloqueia o movimento sobre a reserva de uma porta (`reservasDePorta`).
   - `objeto-fora` (erro): objeto com o centro fora dos limites do mapa.
   - `escala-suspeita` (dica): objeto cuja receita tem tag `arvore` com pegada × escala < 2,5 m, ou tag `rochedo` < 1,5 m.
3. Cada regra é uma função `(m) => Achado[]` num registro `REGRAS: Record<string, ...>`, para que B5b acrescente regras sem mexer no laço.
Não fazer: regras de composição (B5b); a ferramenta (B5c).
Testes: um caso mínimo que dispara cada regra e um que não dispara; ordenação; limite de 15.
Pronto quando: `npm test` passa; rodar `revisarMapa` sobre um mapa de exemplo da Fase 10 (`src/app/exemplos.ts`) não dá nenhum `erro`.
Commit: `added structural map review rules`

### B5b — Revisão: regras de composição  ⬜
Objetivo: a revisão também pega os defeitos de "mapa sem vida".
Depende de: B5a.
Ler: `src/authoring/revisao.ts` (B5a), `src/domain/celulas.ts`, `src/authoring/insight.ts` (`caixaDoObjeto`).
Arquivos: mudar `revisao.ts` e `revisao.test.ts`.
Como (cada regra com limiares em constantes exportadas, para ajustar sem caçar números):
- `casas-iguais` (aviso): 5 ou mais edifícios, e coeficiente de variação da área abaixo de 0,3 **ou** 70% ou mais deles de um único retângulo. Mensagem: "N casas de tamanho e forma parecidos". Sugestão: variar porte por função, plantas em L e anexos, alpendre (o guia de projeto explica).
- `fileiras-mecanicas` (aviso): 12 ou mais objetos da mesma fonte cujas posições caem numa grade regular (os x arredondados a 0,1 m formam no máximo √n + 2 valores distintos, e o mesmo para os y) **e** com rotações iguais (desvio-padrão < 0,05 rad). Sugestão: um conjunto de `atlas_espalhar`, variar receita, rotação e espaçamento.
- `repeticao` (aviso): uma receita que não é vegetação (sem tags `arvore`, `arbusto`, `grama`) com 40 cópias ou mais, ou mais de 35% dos objetos que não são vegetação.
- `mancha-em-disco` (dica): componente conexo de camada de terreno (não água, não maciço) com área ≥ 4 m² e razão área/(π·r²) > 0,85, em que r é o raio do círculo envolvente a partir do centróide.
- `composicao-centralizada` (dica): mapa exterior em que a caixa de tudo o que foi construído (cômodos e objetos que não são vegetação) ocupa menos de 55% da área do mapa **e** o centro dela está a menos de 10% do centro do mapa **e** as quatro margens livres diferem entre si menos de 30%. Sugestão: deixar massas saírem pela borda, compor em diagonal.
- `noite-sem-luz` (aviso): clima com ambiente escuro (use a mesma regra que o mapa de luz usa para "escuro"; procure em `src/domain/clima.ts`) e nenhuma luz ligada; ou um cômodo de área ≥ 6 m² sem luz nem janela num mapa escuro (dica).
Testes: um caso que dispara e um que não dispara para cada regra; o grid 8×15 de lápides do Lysdal (copie as posições num fixture pequeno) dispara `fileiras-mecanicas` e `repeticao`.
Pronto quando: `npm test` passa e os exemplos da Fase 10 dão no máximo dicas.
Commit: `added composition map review rules`

### B5c — Ferramenta `atlas_revisar`  ⬜
Objetivo: o Claude roda a revisão antes de entregar.
Depende de: B5b, B2 (para os ids fazerem sentido junto com o resumo).
Ler: `src/app/ponte-leitura.ts` (como uma ferramenta de leitura é registrada e anotada), `tests/unit/ponte-escrita.test.ts:35` (limite de descrição), `scripts/ponte/catalogo.ts`.
Arquivos: mudar `ponte-leitura.ts`, `ferramentas-atlas.md`, `mapas.md` (novo passo "revisar antes de entregar"), `docs/assistente/nucleo.md` (uma linha nas regras: "Antes de entregar, `atlas_revisar` e corrija os erros e avisos."), testes, `scripts/ponte/catalogo-base.json` (regenerado).
Como: ferramenta `atlas_revisar { id?, regras? }` de leitura, que devolve `{ achados, resumo: { erros, avisos, dicas } }`. Descrição: "Revisa o mapa aberto (ou por id) e aponta defeitos: cômodos sem acesso, casas iguais, fileiras mecânicas, interiores vazios, luz. Use antes de entregar."
Testes: a ferramenta devolve os achados de um mapa montado no teste; `regras` filtra.
Pronto quando: `atlas_revisar` aparece no MCP e aponta os defeitos de "Lysdal · a vila (neve)".
Commit: `added atlas_revisar tool`
