# Fase 6 — Acervo da casa

"O app é completo só com a coleção da casa." Critério de pronto da fase (ROADMAP): recriar um dos mapas de referência só com a coleção da casa fica no mesmo nível de detalhe, com cor coerente.

Detalhado em 3 de novembro de 2026, contra o código do fim da Fase 5. Faça na ordem da tabela; cada tarefa depende das anteriores do mesmo grupo. 👤 = a tarefa para e pede uma decisão do usuário antes de terminar.

## Como o código está hoje (o que a fase muda)

- Só existem **receitas leves** (`src/procedural/receitas.ts`, 22 receitas), desenhadas em tempo real no worker (`executar.ts` → `assarObjeto`).
- O documento já aceita `Objeto.source = { kind: 'asset'; assetId }`, mas o render **não desenha** objetos assim: `chaveDoObjeto` devolve `null` e a cena remove a entrada. A pegada vira 0,8 × 0,8 em vários lugares.
- Uns quinze pontos do código perguntam direto às receitas (`pegadaDaReceita`, `receitaDe`, `listaDeReceitas`): `render/cena.ts`, `selecao.ts`, `viewport.ts`, `fantasma-proposta.ts`, `authoring/insight.ts`, `layout.ts`, `espalhar.ts`, `mobiliar.ts`, `funcao.ts`, `domain/fabrica.ts`, `ui/Biblioteca.tsx`, `ui/Inspetor.tsx`. Eles passam a perguntar ao **acervo** (6.0b).
- Não existem `public/colecao/`, `docs/LICENCAS.md` nem script de assar.

## Decisões já tomadas (não rediscutir na implementação)

- **Duas fontes, um acervo.** Item do acervo = receita leve (id como hoje, ex.: `sofa`) **ou** item da coleção (id `casa:<nome>`, imagem em `public/colecao/`). No documento, item da coleção é `source: { kind: 'asset', assetId: 'casa:<nome>' }`. **Sem mudança de esquema** nesta fase.
- **Receita leve é o padrão.** Gerador pesado só quando o desenho passa de ~200 partes ou de 30 ms para assar a 96 px/m (o script mede e mostra). Receitas leves mudam de cor por parâmetro e vão bem no Pixel; imagens não.
- **Gerador pesado continua sendo descrição de desenho** (`Descricao`, em `src/procedural/pesados/`), fora do bundle do app. O script assa a versão Ilustrada; o catálogo guarda `gerador`, `params`, `seed` e `versao`, para regenerar e para o Pixel (Fase 8) rasterizar a mesma descrição. Nada de duas artes por estilo (AGENTS.md).
- **Catálogo** em `public/colecao/colecao.json` (servido junto, para outros apps poderem ler), importado estaticamente pelo código com `import … with { type: 'json' }` (funciona no Vite e no `node --test` do Node 22; ligue `resolveJsonModule` no tsconfig). As imagens se carregam por URL só no render.
- **Imagens:** WebP com alfa a 128 px/m, cada arquivo ≤ 400 KB, `public/colecao/` inteira ≤ 15 MB (o teste de validação confere).
- **Assar exige navegador** (o Node não tem canvas): o script sobe o Vite e o Chromium do Playwright, que já são dependências, como os e2e fazem (`tests/e2e/apoio.ts`).
- **Coleção só com objetos de piso** nesta fase. Objetos de parede (quadros, estantes, espelhos) continuam receitas, porque a face do cômodo é assada a partir das receitas (`assarComodo`).
- **Harmonização é do render** e só mexe em imagens (as receitas já nascem no traço da casa): recorte do vazio, ajuste à pegada, contorno de nanquim, sombra de contato e cor puxada para o alvo do gênero do mapa. O arquivo original não muda. `harmonize: false` desliga por objeto.
- **Licenças:** CC0 de preferência; CC-BY 4.0 só com crédito em `docs/LICENCAS.md` e na tela de ajuda. Nada de NC, ND, "uso pessoal" ou licença ambígua. A lista de achados passa pelo usuário antes de baixar (6.2a).
- **Kit por gênero** = itens novos (receitas leves na maioria) + regras de mobília + materiais e paletas desse gênero. Cada item ganha `generos?: string[]` (vazio = serve a todos).

## Tarefas

| # | Tarefa | Tipo |
| --- | --- | --- |
| 6.0a | Receitas em pasta, com gêneros | procedural (sem mudar o resultado) |
| 6.0b | Acervo unificado | procedural + todos os consumidores |
| 6.1a | Catálogo da coleção e `docs/LICENCAS.md` | dados + validação |
| 6.1b | Script de assar e o primeiro lote pesado: estofados | script + procedural |
| 6.1c | Objetos da coleção no mapa | render + interface |
| 6.1d | Lote pesado: plantas e árvores | procedural + coleção |
| 6.1e | Lote pesado: tapetes ornamentados | procedural + coleção |
| 6.2a | 👤 Curadoria: lista de candidatos | pesquisa (sem baixar) |
| 6.2b | Curadoria: importar o lote aprovado | coleção |
| 6.3a | Harmonização: forma, contorno e sombra | render |
| 6.3b | Harmonização: cor e o interruptor por objeto | render + interface |
| 6.4a | Kit investigação | procedural + authoring |
| 6.4b | Kit casa moderna | procedural + authoring |
| 6.4c | Kit fantasia | procedural + authoring |
| 6.4d | Kit exterior | procedural + authoring |
| 6.5 | Recriar um mapa de referência; relatório | validação |

---

### 6.0a — Receitas em pasta, com gêneros  ⬜
Objetivo: abrir espaço para dezenas de receitas novas sem um arquivo de 1 000 linhas, e marcar a que gênero cada uma serve.
Depende de: —
Ler: `src/procedural/receitas.ts` inteiro.
Arquivos: criar `src/procedural/receitas/index.ts`, `src/procedural/receitas/comum.ts` (ajudantes `num`, `mat`, `piso`, `parede`, `folhas`, `LOMBADAS`), `src/procedural/receitas/casa.ts` (as 22 de hoje); apagar `src/procedural/receitas.ts`; mudar os imports (o caminho vira `../procedural/receitas/index.ts`).
Como:
1. Mova sem mudar nenhum desenho. `Receita` ganha `generos?: string[]` e `kit?: string` (ainda vazios).
2. `index.ts` reexporta tudo o que `receitas.ts` exportava (`RECEITAS`, `receitaDe`, `listaDeReceitas`, `descreverReceita`, `pegadaDaReceita`, `funcoesDeComodo`, `CATEGORIAS`, tipos) juntando as listas dos arquivos de kit (hoje, só `casa.ts`).
3. `CATEGORIAS` ganha `banheiro`, `lareira-e-luz` (lareiras, castiçais, candeeiros de chão) e `exterior`.
Não fazer: receitas novas; mudar nomes ou ids.
Testes: os de `tests/unit/receitas.test.ts` continuam passando; um teste novo confere que cada id é único entre os arquivos.
Pronto quando: `npm test` e `npm run test:e2e` passam sem mudar nenhuma captura.
Commit: split recipes into kit files

### 6.0b — Acervo unificado  ⬜
Objetivo: todo o código pergunta "o que é este objeto, que tamanho tem, para que serve" a um lugar só, que conhece receitas e coleção.
Depende de: 6.0a
Ler: os pontos da lista em "Como o código está hoje"; `src/domain/mapa.ts` (`FonteObjeto`).
Arquivos: criar `src/procedural/acervo.ts`, `tests/unit/acervo.test.ts`; mudar os consumidores listados acima.
Como:
1. ```ts
   export interface ItemDoAcervo {
     id: string;                       // id da receita, ou 'casa:<nome>'
     fonte: 'receita' | 'colecao';
     nome: string; categoria: Categoria; tipo: 'piso' | 'parede';
     funcoes: string[]; tags: string[]; generos: string[]; kit: string | null;
     /** Pegada padrão (m). */ pegada: [number, number];
     campos: CampoDeReceita[];         // vazio para a coleção
   }
   export interface Acervo {
     item(id: string): ItemDoAcervo | undefined;
     lista(): ItemDoAcervo[];
     /** Pegada de um objeto do mapa, com params e escala de fora. Objeto desconhecido: [0.8, 0.8]. */
     pegadaDaFonte(f: FonteObjeto): [number, number];
     /** Id do acervo de um objeto do mapa (a receita, ou o assetId). */
     idDaFonte(f: FonteObjeto): string;
     /** A fonte para pôr um item no mapa. */
     fonte(id: string, seed: number, params?: Record<string, unknown>): FonteObjeto;
   }
   export function criarAcervo(receitas: readonly Receita[], colecao: readonly ItemDaColecao[]): Acervo
   export const ACERVO: Acervo   // receitas de verdade + coleção (vazia até a 6.1a)
   ```
   Nesta tarefa, `ItemDaColecao` é só `{ id; nome; categoria; pegada; funcoes; tags; generos; kit }` declarado em `acervo.ts`; a 6.1a o completa.
2. Troque nos consumidores: `pegadaDaReceita(o.source…)` → `ACERVO.pegadaDaFonte(o.source)`; `receitaDe(id)` para nome, categoria e funções → `ACERVO.item(id)`; `listaDeReceitas()` na Biblioteca e em `funcao.ts` → `ACERVO.lista()`. Nas regras de mobília e no espalhar, os ids das listas podem ser de qualquer fonte: `layout.ts` e `espalhar.ts` criam o objeto com `ACERVO.fonte(id, seed, params)`.
3. Continuam com receitas puras: `assar.ts` (desenho), o pincel do objeto no viewport quando a receita tem `campos`, e o fantasma do viewport (a 6.1c estende).
Não fazer: carregar imagens; o catálogo JSON.
Testes: com `criarAcervo` e um item falso da coleção, `pegadaDaFonte` de `{ kind: 'asset', assetId: 'casa:x' }` dá a pegada do catálogo; desconhecido dá `[0.8, 0.8]`; `fonte('casa:x', …)` dá `kind: 'asset'`; `fonte('sofa', 3, {…})` dá a receita com seed e params. Os testes de authoring da Fase 5 passam sem mudar.
Pronto quando: `npm test` e `npm run test:e2e` passam; `grep -rn "pegadaDaReceita\|listaDeReceitas" src` só acha `procedural/`.
Commit: unified catalog for recipes and collection

### 6.1a — Catálogo da coleção e `docs/LICENCAS.md`  ⬜
Objetivo: o formato do `colecao.json`, a validação que impede asset sem licença, e o arquivo de licenças.
Depende de: 6.0b
Ler: `src/procedural/acervo.ts`; `src/domain/esquema.ts` (validação com `e.*`); `docs/ARQUITETURA.md` §5.9; `package.json` (fontes `@fontsource`).
Arquivos: criar `public/colecao/colecao.json` (`{ "versao": 1, "itens": [] }`), `src/procedural/colecao.ts`, `docs/LICENCAS.md`, `tests/unit/colecao.test.ts`; mudar `tsconfig.json` (`resolveJsonModule: true`), `src/procedural/acervo.ts`.
Como:
1. ```ts
   export type OrigemDoItem =
     | { tipo: 'gerado'; gerador: string; params: Record<string, unknown>; seed: number; versao: number }
     | { tipo: 'achado'; autor: string; fonte: string; url: string; licenca: 'CC0-1.0' | 'CC-BY-4.0'; arquivoOriginal: string };
   export interface ItemDaColecao {
     id: string; nome: string; arquivo: string;      // relativo a public/colecao/
     categoria: Categoria; pegada: [number, number]; funcoes: string[]; tags: string[]; generos: string[]; kit: string | null;
     origem: OrigemDoItem;
   }
   export function validarColecao(bruto: unknown): ItemDaColecao[]   // lança ErroDeValidacao
   export const COLECAO: readonly ItemDaColecao[]                     // do JSON, validado ao importar
   ```
   `ACERVO` passa a usar `COLECAO`.
2. `docs/LICENCAS.md`: tabela por arquivo (`arquivo | autor | fonte | licença | observação`) com uma seção para os gerados ("gerado pelo Atlas, mesma licença do projeto") e uma para os achados; e as fontes tipográficas já usadas (Cinzel, Special Elite, Hanken Grotesk, com a licença OFL).
3. Teste de coleção (roda em `npm test`): ids únicos com prefixo `casa:`; todo `arquivo` existe em `public/colecao/`; todo arquivo em `public/colecao/` (fora o JSON) está no catálogo; todo achado tem licença aceita e aparece em `LICENCAS.md`; pegada > 0; tamanhos (≤ 400 KB por arquivo, ≤ 15 MB no total); funções conhecidas (`TIPOS_DE_COMODO` ou funções das receitas).
Não fazer: assets de verdade (6.1b em diante); render.
Testes: os do item 3, mais `validarColecao` recusando item sem licença, id sem `casa:` e pegada zero.
Pronto quando: testes passam com o catálogo vazio.
Commit: collection catalog and licenses

### 6.1b — Script de assar e o primeiro lote pesado: estofados  ⬜
Objetivo: `npm run assar` gera as imagens dos geradores pesados e atualiza o catálogo; primeiro lote: estofados capitonê.
Depende de: 6.1a
Ler: `tests/e2e/apoio.ts` (`iniciarAmbiente`: Vite + Chromium); `src/procedural/assar.ts` (`assarObjeto`, `MARGEM_SOMBRA`); `src/procedural/raster.ts`; `src/procedural/receitas/casa.ts` (`sofa`, `poltrona`); `docs/referencias/segredo-na-ilha-mansao.png` (o nível de detalhe a buscar).
Arquivos: criar `src/procedural/pesados/index.ts`, `src/procedural/pesados/estofados.ts`, `src/procedural/pesados/no-navegador.ts`, `scripts/assar-colecao.ts`, as imagens em `public/colecao/gerados/`; mudar `src/procedural/assar.ts` (aceitar uma `Descricao` pronta), `package.json` (`"assar": "node scripts/assar-colecao.ts"`), `public/colecao/colecao.json`, `docs/LICENCAS.md`.
Como:
1. `assar.ts`: extraia `assarDescricao(d: Descricao, seed, res): Assado`; `assarObjeto` passa a chamá-la.
2. `pesados/index.ts`:
   ```ts
   export interface GeradorPesado { id: string; nome: string; categoria: Categoria; funcoes: string[]; tags: string[]; generos: string[]; kit: string | null; versao: number;
     variantes: { nome: string; sufixo: string; params: Record<string, unknown>; seed: number }[];
     gerar(p: PedidoDeReceita): DescricaoDePiso }
   export const PESADOS: readonly GeradorPesado[]
   ```
   O id do item é `casa:<id>-<sufixo>`.
3. `estofados.ts`: sofá chesterfield (capitonê: grade de botões com vincos radiais, braços enrolados, almofadas com volume), poltrona capitonê e divã, cada um com 3 variantes de cor (vinho, verde-garrafa, couro). Use as partes de sempre (`ret`, `elipse`, `poli`, `z` para o relevo); o "pesado" é o número de partes.
4. `no-navegador.ts`: `assarParaWebp(gerador, variante, res): Promise<{ dataUrl; largura; altura; partes; ms }>` (OffscreenCanvas → `convertToBlob({ type: 'image/webp', quality: 0.92 })`). A imagem cobre a pegada mais a margem de sombra, como `assarObjeto`.
5. `scripts/assar-colecao.ts`: sobe o ambiente como `iniciarAmbiente`, abre uma página em branco do Vite, `page.evaluate` com `import('/src/procedural/pesados/no-navegador.ts')` para cada variante; grava `public/colecao/gerados/<id>.webp`; reescreve só os itens `gerado` do `colecao.json` (os `achado` ficam), com `pegada` = pegada da descrição e `origem` com gerador, params, seed e versão; imprime uma tabela (id, partes, ms, KB). `--so <id>` assa um gerador só. Mesma versão e mesmos params = mesmo arquivo (o script não regrava o que não mudou).
6. `LICENCAS.md`: os gerados entram na seção própria (o teste da 6.1a cobra).
Não fazer: desenhar no mapa (6.1c); harmonização.
Testes: o teste de coleção passa com os 9 itens; unitário: cada gerador pesado devolve descrição válida com pegada estável entre variantes; `npm run assar` duas vezes seguidas não muda nenhum arquivo.
Pronto quando: as 9 imagens existem, cabem nos limites e, abertas no visualizador, têm o capitonê legível a 128 px/m.
Commit: bake script and tufted upholstery

### 6.1c — Objetos da coleção no mapa  ⬜
Objetivo: um item `casa:` aparece no mapa com a imagem dele, se escolhe na biblioteca e entra no mobiliar.
Depende de: 6.1b
Ler: `src/procedural/executar.ts`, `baker.ts`, `bake.worker.ts`; `src/render/entradas.ts` (`chaveDoObjeto`); `src/render/cena.ts` (`sincronizarObjetos`, `desenharMarcadorDeObjeto`); `src/render/viewport.ts` (fantasma do objeto); `src/render/fantasma-proposta.ts`; `src/ui/Biblioteca.tsx`; `src/render/pincel.ts` (`Pincel.objeto`).
Arquivos: mudar `executar.ts`, `entradas.ts`, `cena.ts`, `viewport.ts`, `fantasma-proposta.ts`, `pincel.ts`, `Biblioteca.tsx`, `src/ui/previa.ts`; criar `src/render/url-da-colecao.ts`.
Como:
1. `PedidoDeBake` ganha `{ tipo: 'imagem'; url: string; pegada: [number, number]; res: number }`. Em `executarBake`: `fetch` → `createImageBitmap`, desenha centrado numa tela de `(pegada + 2 × MARGEM_SOMBRA) × res`, com `origem` como a de `assarObjeto`. Falha de rede rejeita (a cena fica com o marcador).
2. `url-da-colecao.ts`: `urlDoItem(item): string` = `new URL(import.meta.env.BASE_URL + 'colecao/' + item.arquivo, location.href).href` (só render; o worker recebe a URL pronta).
3. `chaveDoObjeto`: para `kind: 'asset'` de um item da coleção, `a|<res>|<assetId>`; para assetId desconhecido, `null` como hoje (o marcador fica, sem erro). A cena pede `tipo: 'imagem'` nesses casos.
4. `Pincel.objeto.receita` passa a guardar qualquer id do acervo (renomeie para `item`; o pincel não é gravado em lugar nenhum, então não há migração). Pôr um objeto usa `ACERVO.fonte`. Pipeta (Ctrl+clique) e Ctrl+arrastar funcionam com item da coleção.
5. Biblioteca: lista `ACERVO.lista()`; item da coleção com uma marca discreta "acervo" e a miniatura pela própria imagem (`previa.ts`). Itens sem `campos` não mostram parâmetros.
6. Fantasma da ferramenta e fantasma da proposta desenham a imagem pelo mesmo pedido.
7. Regras de mobília: `sala` e `biblioteca` ganham `casa:chesterfield-*` e `casa:poltrona-capitone-*` como alternativas de `sofa` e `poltrona` para `investigacao` (a cor vem do sorteio, não da paleta: item da coleção não tem parâmetros).
Não fazer: harmonização (6.3); itens da coleção na parede.
Testes: unitário de `chaveDoObjeto` para asset conhecido e desconhecido; e2e: escolher o chesterfield na biblioteca, pôr no mapa, conferir no documento `source.kind === 'asset'` e que a cena tem a textura (sem marcador: exponha `__atlas.viewport().objetosPintados()` ou similar); recarregar e continua; "Mobiliar a sala" com semente fixa pode usar o chesterfield.
Pronto quando: os e2e passam, sem erro de console, e o sofá aparece igual à imagem assada.
Commit: render collection items on the map

### 6.1d — Lote pesado: plantas e árvores  ⬜
Objetivo: plantas de interior com folhagem densa e as primeiras árvores, que o kit exterior e o espalhar "sob árvore" vão usar.
Depende de: 6.1c
Ler: `src/procedural/pesados/estofados.ts` (modelo); `src/procedural/receitas/casa.ts` (`vaso.planta`, `folhas`); `src/procedural/ruido.ts`.
Arquivos: criar `src/procedural/pesados/plantas.ts`; mudar `pesados/index.ts`, `colecao.json`, imagens.
Como:
1. Interior: palmeira em vaso, samambaia em pedestal, costela-de-adão; 2 variantes cada.
2. Exterior (`kit: 'exterior'`, `categoria: 'exterior'`, `funcoes: ['jardim']`): árvore de copa redonda (3 tamanhos: 3, 5 e 7 m), pinheiro (2 tamanhos), arbusto (3 variantes). Copa em camadas de folhas com `z` crescente e um tom mais escuro por baixo, para a luz dar volume; o tronco aparece só na borda. A sombra de árvore é larga e suave (`sombraLeve`).
3. Tag `arvore` nas árvores (o espalhar usa).
Não fazer: árvores que bloqueiam a luz (a copa não é oclusor; anote como pendência se fizer falta).
Testes: o teste de coleção passa; cada variante fica abaixo de 400 KB (árvores grandes podem ir a 96 px/m: guarde a resolução no item e respeite-a ao desenhar).
Pronto quando: imagens geradas; uma árvore de 7 m posta num terreno de grama tem cara de árvore vista de cima.
Commit: baked plants and trees

### 6.1e — Lote pesado: tapetes ornamentados  ⬜
Objetivo: tapetes com medalhão, bordas e franja, como os da referência.
Depende de: 6.1c
Ler: `src/procedural/materiais.ts` (padrão `persa`); `src/procedural/receitas/casa.ts` (`tapete.persa`).
Arquivos: criar `src/procedural/pesados/tapetes.ts`; mudar `pesados/index.ts`, `colecao.json`, imagens; mudar `src/authoring/mobiliar.ts` ou `regras-mobilia.ts` (alternativas de tapete).
Como:
1. Tapete persa com medalhão (3 × 2 m e 4 × 2,8 m), tapete oval (2,4 × 1,6 m), passadeira de corredor (3 × 0,9 m); 3 paletas cada (vinho e azul-marinho, verde e ouro, creme e terracota). Simetria em dois eixos, bordas em 3 faixas, franja nas pontas menores, desgaste leve por ruído.
2. Tapetes não bloqueiam (como hoje). A paleta do tapete entra no sorteio do mobiliar: a variante cuja paleta mais combina com a paleta sorteada do cômodo (5.3c) ganha peso maior.
Não fazer: tapete com parâmetros de cor (é imagem: a cor é a da variante).
Testes: coleção válida; mobiliar uma sala com semente fixa escolhe um tapete da coleção quando há.
Pronto quando: imagens geradas e um tapete com medalhão aparece mobiliando uma sala.
Commit: baked ornate rugs

### 6.2a — 👤 Curadoria: lista de candidatos  ⬜
Objetivo: achar objetos vistos de cima, com licença que permite redistribuir, e trazer a lista para o usuário aprovar. **Não baixe nada nesta tarefa.**
Depende de: 6.1a
Ler: `docs/LICENCAS.md`; AGENTS.md (regras de assets); as referências em `docs/referencias/` (para saber o estilo que combina).
Arquivos: criar `docs/curadoria.md`.
Como:
1. Procure primeiro em fontes de licença clara: OpenGameArt (filtro CC0), Kenney (CC0), itch.io com licença CC0 declarada no pacote, Poly Haven (CC0; só se houver imagens de cima utilizáveis), Wikimedia Commons (CC0 ou CC-BY, imagem de cima).
2. Critérios: vista de cima ortogonal (não isométrica nem 3/4); traço ou pintura compatível com o Ilustrado; fundo transparente ou fácil de recortar; resolução ≥ 64 px/m na pegada real; licença explícita no próprio pacote (a página não basta se o arquivo de licença do pacote disser outra coisa).
3. `docs/curadoria.md`: tabela `objeto | categoria | fonte | url | autor | licença | onde a licença está escrita | nota de estilo (1 a 5) | por que serve`. Separe "recomendo" de "talvez". Se houver pouco material bom, diga isso: a coleção pode ser quase toda gerada, e isso não é falha.
4. **Pare** e peça a aprovação do usuário com o resumo da tabela.
Não fazer: baixar, converter ou pôr qualquer arquivo em `public/`.
Testes: —
Pronto quando: `docs/curadoria.md` existe e o usuário respondeu quais entram.
Commit: collection curation shortlist

### 6.2b — Curadoria: importar o lote aprovado  ⬜
Objetivo: os achados aprovados entram na coleção com licença registrada.
Depende de: 6.2a (com a aprovação do usuário), 6.1c
Ler: `docs/curadoria.md` (só as linhas aprovadas); `src/procedural/colecao.ts`.
Arquivos: criar `scripts/importar-achado.ts`; mudar `public/colecao/` (`achados/<fonte>/`), `colecao.json`, `docs/LICENCAS.md`.
Como:
1. `node scripts/importar-achado.ts <arquivo> --id casa:<nome> --pegada 1.2x0.6 --categoria … --fonte … --autor … --url … --licenca CC0-1.0`: recorta o vazio, gira para a frente do objeto ficar em +y se for preciso (`--girar 90`), redimensiona para 128 px/m sobre a pegada, converte para WebP, grava em `achados/<fonte>/` e acrescenta o item `achado` no catálogo. O arquivo baixado original fica fora do git, em `data-private/achados/` (`data-private/` já está no `.gitignore`).
2. Uma linha em `LICENCAS.md` por arquivo.
Não fazer: aceitar algo que não esteja aprovado no `curadoria.md`.
Testes: o teste de coleção passa (licença, tamanho, presença no `LICENCAS.md`).
Pronto quando: os achados aprovados aparecem na biblioteca.
Commit: import curated assets

### 6.3a — Harmonização: forma, contorno e sombra  ⬜
Objetivo: uma imagem da coleção (achada ou não) fica do tamanho certo, recortada, com o contorno e a sombra de contato do resto do mapa.
Depende de: 6.1c
Ler: `src/procedural/executar.ts` (pedido `imagem`); `src/procedural/raster.ts` (como as receitas fazem contorno e sombra, para imitar a cor e a largura); `src/domain/mapa.ts` (`Objeto.harmonize`).
Arquivos: criar `src/procedural/harmonizar.ts`, `tests/unit/harmonizar.test.ts`; mudar `executar.ts`, `src/render/entradas.ts` (chave), `src/render/cena.ts`.
Como:
1. Funções puras sobre `ImageData` (testáveis sem navegador): `caixaDoConteudo(img, limiar = 8)`, `contorno(img, px, cor)` (dilatação do alfa por `px` pixels, desenhada por baixo), `sombraDeContato(img, raioPx, deslocamento, opacidade)` (alfa desfocado e deslocado na direção do sol padrão).
2. O pedido `imagem` ganha `harmonizar: boolean`. Ligado: recorta pelo conteúdo, encaixa na pegada mantendo a proporção (sobra transparente), contorno de 1,5 px a 128 px/m na cor de nanquim das receitas, sombra de contato. Desligado: só encaixa na pegada.
3. A chave do objeto inclui `o.harmonize`.
Não fazer: cor (6.3b).
Testes: unitários das três funções com imagens pequenas feitas à mão (um quadrado no meio: caixa certa, contorno com 1 px a mais, sombra deslocada).
Pronto quando: um achado com margem transparente grande aparece do tamanho da pegada, com contorno e sombra como os móveis procedurais ao lado.
Commit: harmonize collection images shape

### 6.3b — Harmonização: cor e o interruptor por objeto  ⬜
Objetivo: a cor das imagens se aproxima da do mapa; o mestre pode desligar isso num objeto.
Depende de: 6.3a
Ler: `src/procedural/harmonizar.ts`; `src/domain/presets.ts` (`GENEROS`); `src/authoring/mobiliar.ts` (`PALETAS_POR_GENERO`, para o alvo combinar); `src/ui/Inspetor.tsx` (`CamposDoObjeto`).
Arquivos: mudar `harmonizar.ts`, `presets.ts`, `executar.ts`, `entradas.ts`, `Inspetor.tsx`, `tests/unit/harmonizar.test.ts`.
Como:
1. `Genero` ganha `alvoDeCor: { saturacao: number; luminancia: number; tinta: string }` (investigação: dessaturado e quente; moderno: mais claro e neutro; fantasia: quente e médio).
2. `puxarCor(img, alvo, forca = 0.6)`: mede a saturação e a luminância médias (só pixels com alfa > 0,5), aproxima as duas do alvo por `forca` e multiplica por uma tinta leve; o matiz não muda.
3. O pedido `imagem` recebe o alvo do gênero do mapa; a chave inclui o gênero. Trocar o gênero na aba Mapa repinta as imagens.
4. Inspetor do objeto da coleção: nome do item, a origem ("gerado" ou "achado: autor, licença") e a caixa "Harmonizar com o mapa" (`item.atualizar { harmonize }`, rótulo "Harmonizar objeto").
Não fazer: harmonizar receitas (já nascem no estilo).
Testes: `puxarCor` aproxima a saturação média do alvo e não mexe em pixels transparentes; o matiz de um pixel vermelho continua vermelho.
Pronto quando: um achado de cor muito viva fica coerente com os móveis ao lado, e desligar a caixa mostra o original.
Commit: harmonize collection colors

### 6.4a — Kit investigação  ⬜
Objetivo: o que falta para mobiliar uma mansão como a da referência.
Depende de: 6.0a, 6.1c
Ler: `docs/referencias/segredo-na-ilha-mansao.png`; `src/procedural/receitas/casa.ts`; `src/authoring/regras-mobilia.ts`, `mobiliar.ts` (`MATERIAIS_POR_GENERO`, `PALETAS_POR_GENERO`); `src/authoring/funcao.ts` (sinais fortes e sinônimos).
Arquivos: criar `src/procedural/receitas/investigacao.ts`, `tests/unit/kit-investigacao.test.ts`; mudar `receitas/index.ts`, `regras-mobilia.ts`, `funcao.ts`, `mobiliar.ts` (se faltarem materiais), `src/procedural/materiais.ts` (só se um material novo for indispensável).
Como:
1. Receitas leves (`generos: ['investigacao']`, `kit: 'investigacao'`), com parâmetros de cor quando fizer sentido: lareira de mármore (objeto de piso encostado na parede, `alto` na regra), piano de cauda, mesa de bilhar, mesa de jantar oval (largura e cadeiras), relógio de pé, cristaleira, banheira com pés, vaso sanitário antigo, pia de pedestal, cabideiro, globo terrestre, escrivaninha de tampo verde. Use as partes como as receitas de hoje; o objetivo é o nível de detalhe da referência vista inteira, não de perto.
2. Funções novas onde a referência pede: `sala-de-jogos` (bilhar), `sala-de-jantar` (no `TIPOS_DE_COMODO`: piso, papel e nome; sinônimos em `funcao.ts`: "jantar" passa a ir para `sala-de-jantar`, com o caso de teste antigo atualizado).
3. Regras: banheiro com banheira, vaso e pia; sala com lareira (`alto`, prioridade alta) e poltronas `em-frente`; sala de jantar com mesa oval e cadeiras ao redor; biblioteca com globo e escrivaninha; sinais fortes (piano → sala, bilhar → sala-de-jogos, banheira → banheiro).
Não fazer: itens de outros gêneros.
Testes: cada receita nova desenha sem erro e tem pegada estável; regras só citam itens que existem; a casa jogável da 5.6 continua passando nos três gêneros; banheiro de 6 m² mobiliado tem banheira, vaso e pia sem tampar a porta.
Pronto quando: mobiliar uma sala, uma sala de jantar e um banheiro de investigação lembra os cômodos da referência.
Commit: investigation kit

### 6.4b — Kit casa moderna  ⬜
Objetivo: que uma casa de gênero `moderno` pareça de hoje.
Depende de: 6.4a
Ler: os mesmos da 6.4a.
Arquivos: criar `src/procedural/receitas/moderno.ts`, `tests/unit/kit-moderno.test.ts`; mudar `receitas/index.ts`, `regras-mobilia.ts`, `mobiliar.ts`, `presets.ts` (pisos e papéis claros, se faltarem materiais).
Como:
1. Receitas: sofá de canto (em L), rack com TV, geladeira, fogão, mesa de jantar de vidro, cama box, guarda-roupa de portas lisas, box de banheiro, vaso sanitário moderno, escrivaninha com computador, luminária de chão.
2. `VARIACOES_DE_GENERO.moderno` troca os itens antigos pelos novos (sofá → sofá de canto, cama → cama box, balcão → geladeira + fogão + balcão…).
3. Materiais e paletas do moderno: pisos de porcelanato, madeira clara e cimento queimado; paredes lisas claras; paletas cinza e mostarda, azul e branco, verde-sálvia e carvalho.
Não fazer: luzes novas (a lâmpada da 5.5b já serve).
Testes: como na 6.4a, para `moderno`.
Pronto quando: a mesma casa de três cômodos, mobiliada com gênero moderno, não lembra a de investigação.
Commit: modern home kit

### 6.4c — Kit fantasia  ⬜
Objetivo: taverna, quarto de estalagem, armazém e capela de fantasia.
Depende de: 6.4a
Ler: os mesmos da 6.4a; `src/authoring/luzes.ts` (velas e tochas da fantasia).
Arquivos: criar `src/procedural/receitas/fantasia.ts`, `tests/unit/kit-fantasia.test.ts`; mudar `receitas/index.ts`, `regras-mobilia.ts`, `mobiliar.ts`, `funcao.ts`.
Como:
1. Receitas: barril (deitado e em pé), mesa de taverna rústica, banco longo, lareira de pedra com caldeirão, catre de palha, baú, prateleira de poções, bigorna, tapeçaria de parede (receita de parede), altar, banco de igreja.
2. Funções `capela` e `forja` (no `TIPOS_DE_COMODO` e nos sinônimos: igreja, templo, santuário → capela; ferraria → forja).
3. `VARIACOES_DE_GENERO.fantasia` usa os itens novos na taverna, no quarto (catre e baú), no porão (barris) e na cozinha (lareira com caldeirão no lugar do balcão).
Não fazer: elementos de dungeon (masmorra é outra fase do roadmap, se vier).
Testes: como na 6.4a, para `fantasia`.
Pronto quando: uma taverna mobiliada tem barris, mesas rústicas e lareira, e a luz vem de velas e tochas.
Commit: fantasy kit

### 6.4d — Kit exterior  ⬜
Objetivo: jardim, bosque e o entorno da casa, com o espalhar contextual.
Depende de: 6.1d
Ler: `src/authoring/espalhar.ts` (`CONJUNTOS_DE_ESPALHAR`, contextos); `src/procedural/materiais.ts` (terrenos); `src/procedural/pesados/plantas.ts`.
Arquivos: criar `src/procedural/receitas/exterior.ts`, `tests/unit/kit-exterior.test.ts`; mudar `receitas/index.ts`, `espalhar.ts`, `tests/unit/espalhar.test.ts`.
Como:
1. Receitas leves: pedra (3 tamanhos), toco, tronco caído, cerca de madeira (trecho com `largura`), poço, banco de jardim, canteiro de flores, poste de luz (só o objeto; a luz o mestre põe), lápide.
2. Contexto novo no espalhar: `sob-arvore` (dentro do raio da copa de um objeto com tag `arvore`, ou perto dele). Conjuntos novos: `mata` (árvores e arbustos da coleção em `livre`, pedras e tocos `sob-arvore`), `jardim` (canteiros, arbustos, vasos), `cemiterio` (lápides em fileiras com jitter, árvores esparsas).
3. Fora dos cômodos não há circulação, mas o espalhar evita a frente das portas externas (um semicírculo de 1,5 m).
Não fazer: árvores que bloqueiam a visão (anotar para a Fase 7, se preciso).
Testes: `mata` num terreno de grama põe pedras sob árvores; nada cai na frente de uma porta externa; mesma semente = mesmo resultado.
Pronto quando: uma pincelada de "mata" ao redor da casa parece um bosque, não objetos soltos.
Commit: outdoor kit

### 6.5 — Recriar um mapa de referência; relatório  ⬜
Objetivo: provar o critério da fase e registrar o que ainda falta.
Depende de: todas
Ler: `docs/referencias/segredo-na-ilha-mansao.png`; `tests/e2e/fase5.test.ts` (modelo de captura e de casa montada por interface).
Arquivos: criar `tests/e2e/fase6.test.ts`; mudar `progress.md`.
Como:
1. e2e `fase 6: ala da mansão`: montar pela API de comandos (não pela interface: o foco é o acervo) a ala esquerda da referência, uns 8 cômodos (sala com lareira, sala de jantar, biblioteca, banheiro, quarto, corredor, sala de jogos, varanda), gênero investigação; mobiliar pelo assistente (`proximaSugestao` em laço) e completar à mão com uns poucos itens da coleção, onde a referência tem algo marcante; clima Tarde. Capturar `test-results/fase6-mansao.png` e `fase6-mansao-noite.png`. Medir o tempo da primeira pintura completa (todas as texturas prontas, `viewport.pintando === 0`).
2. Uma captura lado a lado com a referência fica para conferência humana; escreva no relatório o que está no mesmo nível, o que está abaixo e por quê (falta de item, cor, escala).
3. progress.md: resumo da fase (implementado, quantos itens por fonte e por kit, tamanho de `public/colecao/`, validação, pendências reais) e "Próximo: Fase 7".
Não fazer: consertar desenho aqui além de ajuste de número; o que faltar vira pendência.
Testes: os acima, mais `npm run typecheck`, `npm test`, `npm run test:e2e` e `npm run build` (confira que `public/colecao/` vai para o `dist/` e que `data-private/` não vai).
Pronto quando: tudo passa e o relatório está no progress.md.
Commit: validate phase 6
