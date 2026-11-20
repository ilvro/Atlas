# Frente O — Biblioteca por famílias e pincel de objetos

Planejada em 2026-11-20. Implementação pelo Sonnet, uma ficha por subagente, na ordem abaixo.

## Problema

- **Objetos:** a biblioteca lista 355 itens (303 receitas e 52 da coleção) numa grade só. Os chips de `CATEGORIAS` são por cômodo, e "Exterior" sozinho tem 107 itens. Variações da mesma coisa aparecem como itens soltos: `casa:arvore-3m`, `-5m` e `-7m`; `pedra.pequena`, `.media` e `.grande`; nove tapetes `casa:tapete-persa-*`.
- **Terreno:** os 35 materiais (25 de terreno, 4 de maciço e 6 de água) estão numa lista corrida, sem grupos.
- **Propriedades:** escala, camada, sombra e opacidade só podem ser ajustadas no inspetor, depois que o objeto já está no mapa. O pincel tem só item, parâmetros, semente e rotação.
- **Grade:** objeto e luz se encaixam na grade sempre que `grid.snap` está ligado, que é o padrão do mapa. Para pôr livre é preciso segurar `Alt`.

## Referência: o Inkarnate

O carimbo do Inkarnate se organiza assim:

- **Família com variantes:** "Tree" tem as variantes 1 a 6, com setas ‹ 1/6 ›. Um dado sorteia a variante a cada carimbo e uma paleta varia a cor.
- **Recentes e Favoritos.**
- **Propriedades antes de pôr:** Scale, Rotation (com dado), Sublayer, espelhar H/V, Opacity, Shadow, Blend Mode e Blur.
- **Colocação:** One/Many/Auto, Auto Select e, em "More Options", Area, Density e Random Flip.
- **Catálogo de texturas:** agrupado por "Terrain / Dirt (23)", com seções que se recolhem.

Como cada ideia vira Atlas:

| Inkarnate | Atlas |
| --- | --- |
| Família + variantes 1..N | `Familia` com `itens` ordenados (os ids de hoje não mudam) |
| Dado da variante | `varianteAleatoria` no pincel |
| Paleta (cor) | "Variar o desenho": semente aleatória. Só vale para receitas; as variantes de cor já são itens da família |
| Scale, Rotation + dado, Sublayer | `scale`, `rotation`, `layer`; rotação aleatória no pincel |
| Espelhar H / V | campo novo `flip`. V é H mais 180° |
| Opacity, Shadow | campo novo `opacity`; `castsShadow` |
| Place One/Many, Auto Select, Area, Density, Random Flip | colocação `um`/`varios`, `selecionarAoPor`, `area`, `densidade`, espelho aleatório e escala aleatória |
| Blend Mode, Blur | **fora do escopo.** O objeto é assado e entra na luz HDR e nas sombras. Modos de mistura e desfoque por objeto quebrariam essa composição |
| Catálogo agrupado | grupos de terreno |

## Decisões

1. **A taxonomia fica num arquivo central**, `src/procedural/familias.ts`, e não espalhada pelas 25 receitas nem pelo `colecao.json`. Ela tem dois níveis, grupo → família, e a família lista os ids das variantes. Um teste exige que todo item do acervo esteja em exatamente uma família. Assim, quem acrescenta um asset é obrigado a classificá-lo.
2. **`Categoria` continua como está.** É a categoria por cômodo, usada pela construção inteligente, pela validação da coleção e pela ponte. A família não a substitui: é outra forma de olhar o mesmo item.
3. **O documento do mapa não muda de formato por causa das famílias.** O objeto continua guardando o id do item. A família só aparece no pincel e na autoria.
4. **Colocação livre é o padrão para objetos e luzes.** A preferência é do editor, não do mapa: `objetosNaGrade`, guardada no `localStorage` com `try/catch` e desligada por padrão. Cômodos, paredes, aberturas e peças continuam seguindo `grid.snap`. Nos dois casos, `Alt` inverte.
5. **Espelhar objetos de receita espelha a descrição antes do assado,** e não o sprite. Assim a luz e o relevo continuam certos. Na imagem da coleção, o espelho é `scale.x = -1` no sprite.
6. **Um só componente de propriedades** edita o pincel (antes de pôr) e o objeto ou a seleção (depois de pôr).

## Grupos de objetos (proposta para a O1)

A ordem abaixo é a de exibição. Os nomes das famílias são exemplos; quem implementa completa a lista.

| Grupo (`id`) | Nome | Famílias de exemplo |
| --- | --- | --- |
| `natureza` | Natureza | Árvore, Árvore da mata, Carvalho, Pinheiro, Árvore nevada, Árvore morta, Arbusto, Folhagem, Pedra, Tronco e toco, Capim e junco, Neve |
| `agua` | Água e fundo | Planta aquática, Coral e fundo, Cachoeira |
| `moveis` | Móveis | Mesa, Cadeira e banco, Sofá e poltrona, Cama, Armário e estante, Escrivaninha, Tapete, Banheiro, Cozinha |
| `luz-e-fogo` | Luz e fogo | Lareira, Fogueira e braseiro, Castiçal e candelabro, Lustre e luminária, Tocha |
| `sobre-a-mesa` | Sobre a mesa | Livros e papéis, Louça e comida, Pequenos objetos |
| `parede` | De parede | Quadro, Espelho, Prateleira, Armas e troféus, Tapeçaria e cortina |
| `carga` | Carga e armazenamento | Caixote, Barril, Saco, Baú |
| `construcao` | Construção | Escada, Coluna e pilar, Muro e cerca, Portão e grade, Estrutura, Escombros |
| `religiao` | Templo e cemitério | Altar, Banco de igreja, Lápide e cruz, Túmulo, Estátua, Sino |
| `oficio` | Ofício e guerra | Forja, Fiação, Armas, Máquina de cerco, Prisão e tortura |
| `campo` | Campo e estrada | Carroça, Animal, Feno, Poço, Varal, Barraca |
| `porto` | Porto | Barco, Cais, Corda e rede, Âncora |
| `moderno` | Moderno | Eletrodoméstico, Eletrônico |
| `ficcao` | Ficção científica | Console, Contêiner, Médico e laboratório, Tubulação |
| `ossos` | Ossos e restos | Ossada, Crânio, Peles |

Regras de classificação:

- Uma família reúne coisas **intercambiáveis no mapa**, a mesma coisa em tamanho, cor, estação ou desenho diferente. Exemplos: as árvores `casa:arvore-3m`, `-5m` e `-7m`; as pedras `pedra.pequena`, `pedra.media`, `pedra.grande` e `rochedo`; os tapetes persas em três tamanhos e três cores. Não junte coisas que só combinam entre si.
- **Ordem das variantes:** do menor para o maior e, dentro do mesmo tamanho, na ordem de cor da coleção.
- Uma família de um item só é válida. Ainda assim, o alvo é ficar entre 90 e 130 famílias: 355 famílias de um item cada não resolvem nada.
- Uma família não mistura objeto de parede (`tipo: 'parede'`) com objeto de piso.
- O nome da família vai no singular e é o que o usuário digitaria na busca: "Árvore", "Mesa", "Barril".

## Grupos de terreno (proposta para a O2)

| Grupo | Materiais |
| --- | --- |
| Grama | `grama`, `grama.acinzentada`, `grama.seca`, `grama.escura` |
| Terra e lama | `terra`, `terra.sulcos`, `terra.congelada`, `chao.batido`, `chao.de.mata`, `lama` |
| Areia | `areia`, `areia.molhada` |
| Pedra e cascalho | `pedregulho`, `cascalho`, `rocha.rachada` |
| Calçamento | `calcada`, `paralelepipedo`, `lajes.gramadas`, `lajes.escuras`, `lajes.antigas`, `piso.hangar` |
| Neve e gelo | `neve`, `neve.funda`, `neve.pisada`, `gelo` |
| Rocha (maciço) | os 4 de `materiaisDo('macico')` |
| Água | os 6 de `materiaisDo('agua')` |

---

### O1 — Famílias e grupos do acervo  ✅
Objetivo: todo item do acervo pertence a uma família, e toda família pertence a um grupo.
Depende de: —.
Ler: `src/procedural/acervo.ts` (inteiro); `src/procedural/receitas/comum.ts:1-30`; `src/procedural/colecao.ts:1-30`; a seção "Grupos de objetos" acima. Para listar todos os ids com nome, categoria e tags, rode `npx tsx -e "import {ACERVO} from './src/procedural/acervo.ts'; for (const i of ACERVO.lista()) console.log(i.id, '|', i.nome, '|', i.categoria, '|', i.tags.join(','))"`.
Arquivos: criar `src/procedural/familias.ts` e `tests/unit/familias.test.ts`; mudar `src/procedural/acervo.ts`.
Como:
- `export interface GrupoDeObjetos { id: string; nome: string }` e `export const GRUPOS_DE_OBJETOS: readonly GrupoDeObjetos[]`, na ordem da tabela.
- `export interface Familia { id: string; nome: string; grupo: string; itens: readonly string[] }`, onde `itens` é a ordem das variantes. Depois vem `export const FAMILIAS: readonly Familia[]`. O id da família é kebab-case sem prefixo (`arvore`, `pedra`, `tapete-persa`).
- Em `Acervo`, acrescente `familias(): readonly Familia[]`, `familia(id: string): Familia | undefined` e `familiaDoItem(itemId: string): Familia | undefined`. Monte os índices uma vez em `criarAcervo`, que passa a receber as famílias como terceiro parâmetro (padrão `FAMILIAS`), para os testes poderem injetar outras.
- Classifique os 355 itens seguindo as regras da seção acima.
Não fazer: mexer na interface, no pincel, em `CATEGORIAS` ou no `colecao.json`.
Testes: (1) todo `ACERVO.lista()` aparece em exatamente uma família; (2) toda família tem pelo menos um item, e todo item existe; (3) todo `grupo` existe em `GRUPOS_DE_OBJETOS`, e todo grupo tem pelo menos uma família; (4) ids de família únicos; (5) nenhuma família mistura `tipo: 'piso'` com `tipo: 'parede'`; (6) `familiaDoItem('casa:arvore-5m')` devolve a família das árvores.
Pronto quando: os testes passam e o relatório final traz a tabela grupo → família → nº de variantes, para o Opus revisar a classificação.
Nota (Frente P): se a P7 de [terreno-com-textura.md](terreno-com-textura.md) já tiver criado os carimbos de chão, classifique-os pela tabela da seção "Pontos de contato com a Frente O" de lá.
Commit: `assets are grouped into families with variants`

### O2 — Terreno em grupos  ✅
Objetivo: a gaveta de Terreno mostra os materiais em grupos que se recolhem, com contagem, como o catálogo de texturas do Inkarnate.
Depende de: —.
Ler: `src/ui/Biblioteca.tsx` (função `Terreno`); `src/procedural/materiais.ts:1-20` e `materiaisDo`; a tabela "Grupos de terreno" acima; a classe `.faixa` e `.lista-cartas` em `src/ui/estilo.css`.
Arquivos: criar `src/procedural/grupos-de-terreno.ts` e `tests/unit/grupos-de-terreno.test.ts`; mudar `src/ui/Biblioteca.tsx` e `src/ui/estilo.css`.
Como:
- `export const GRUPOS_DE_TERRENO: readonly { id: string; nome: string; materiais: readonly string[] }[]`.
- Na UI, acrescente uma busca no topo (com `filtrar` de `src/app/busca.ts`, pelo nome do material e do grupo). Cada grupo vira um `<details open>` com o título "Nome (n)" e a grade de amostras (`Amostra`, maiores que hoje, 40 px), com o nome no `title`. O grupo do material atual começa aberto; os outros, também. Guarde quais grupos estão recolhidos num `signal` do módulo, para não reabrir ao trocar de ferramenta.
- O bloco de Relevo e os campos abaixo da lista (pincel, tom da grama, correnteza, base) ficam como estão.
Não fazer: mudar materiais nem `materiaisDo`.
Nota (Frente P): o material `musgo`, da P5 de [terreno-com-textura.md](terreno-com-textura.md), entra no grupo Grama. As amostras usam a `Amostra` de `campos-material.tsx`, que a P6 faz mostrar a textura; não crie outra.
Testes: todo material de `terreno`, `macico` e `agua` está em exatamente um grupo; todo id de grupo existe em `MATERIAIS`.
Pronto quando: a gaveta de Terreno mostra 8 grupos recolhíveis e a busca filtra.
Commit: `terrain materials are grouped in collapsible sections`

### O3 — Família no pincel  ✅
Objetivo: o pincel de objeto guarda a família e a variante. Com o dado ligado, cada objeto posto sai de uma variante sorteada, e o fantasma mostra exatamente a próxima.
Depende de: O1.
Ler: `src/render/pincel.ts` (tipo `Pincel` e `PINCEL_PADRAO`); `src/render/viewport.ts:505-575` (`novaSemente`, `sementeAtual` e o fantasma do objeto) e `:788-800` (`colocar`, ramo `objeto`); `src/procedural/acervo.ts`.
Arquivos: mudar `src/render/pincel.ts`, `src/render/viewport.ts` e `src/procedural/familias.ts`; criar `tests/unit/pincel-familia.test.ts`.
Como:
- `Pincel['objeto']` ganha `familia: string | null` e `varianteAleatoria: boolean` (padrão `false`). `item` continua sendo a variante atual: é o que o fantasma mostra e o que se põe.
- Em `familias.ts`, acrescente a função pura `sortearVariante(f: Familia, atual: string, rand: () => number): string`. Ela devolve um item da família diferente de `atual` quando a família tem mais de um item.
- No `viewport`, depois de pôr um objeto com `varianteAleatoria` e `familia`, chame `ponte.definirPincel({ objeto: { ...item: sortearVariante(...) } })`. É o mesmo padrão de `novaSemente`, e assim o fantasma já mostra a próxima variante.
- Ao escolher um item solto (`Ctrl+clique` copiando o pincel, ou a busca), preencha `familia` com `ACERVO.familiaDoItem(id)?.id ?? null`.
Não fazer: a interface da biblioteca (O4).
Testes: `sortearVariante` nunca repete o atual numa família de 2 ou mais; numa família de 1, devolve o próprio item; é determinística para o mesmo `rand`.
Pronto quando: com `varianteAleatoria` ligado no código, pôr três árvores dá variantes diferentes, e o fantasma antecipa cada uma.
Commit: `object brush remembers family and rolls a random variant`

### O4 — Biblioteca de objetos por grupo e família  ⬜
Objetivo: a gaveta de Objetos navega por grupo → família → variante, como o carimbo do Inkarnate.
Depende de: O3.
Ler: `src/ui/Biblioteca.tsx` (função `Objetos` e `MiniReceita`); `src/ui/previa.ts`; as capturas do Inkarnate descritas na seção "Referência" acima.
Arquivos: mudar `src/ui/Biblioteca.tsx` e `src/ui/estilo.css`; criar `src/ui/FamiliaNoPincel.tsx` se `Biblioteca.tsx` passar de ~300 linhas.
Como:
- **Topo (a família na mão):** título com o nome da família; prévia grande (`MiniReceita` com tamanho por parâmetro, ~140 px) com setas ‹ n / N › embaixo; à direita, a grade de miniaturas numeradas das variantes, com a atual destacada. Há dois botões de alternância no canto do título: **dado** (`varianteAleatoria`) e **Variar o desenho** (`semente: null` contra semente fixa; só aparece se alguma variante for receita).
- **Abaixo, o catálogo:** busca; chips dos grupos (`Todos` mais `GRUPOS_DE_OBJETOS`); a grade de **famílias** (miniatura da primeira variante, nome e selo com o nº de variantes). Clicar numa família põe a primeira variante no pincel com `familia` preenchida.
- **Busca:** casa o nome da família, o nome dos itens, as tags e as funções. O resultado mostra as famílias que têm pelo menos um item que casou. Ao clicar, a variante escolhida é a primeira que casou, não a primeira da família.
- O bloco de campos da receita (`receita.campos`) continua abaixo do topo, para a variante atual.
- Os chips de `CATEGORIAS` saem desta gaveta. Eles continuam existindo no domínio.
Não fazer: recentes e favoritos (O5); propriedades do pincel (O8).
Testes: e2e opcional. Se existir `tests/e2e` cobrindo a biblioteca (`data-testid="lista-receitas"`, `receita-*`), ajuste os seletores para que continuem passando. Mantenha `data-testid="receita-<id>"` nas miniaturas de variante e `busca-objeto` na busca.
Pronto quando: achar "árvore" leva a uma família com ‹ 1/N ›, as setas e as miniaturas trocam a variante, e o dado sorteia a cada clique no mapa.
Commit: `object library browses groups, families and variants`

### O5 — Recentes e favoritos  ⬜
Objetivo: abas "Recentes | Favoritos" na gaveta de Objetos.
Depende de: O4.
Ler: um uso de `localStorage` com `try/catch` já existente (`src/app/tema.ts`); `src/render/viewport.ts`, onde o objeto é posto (`ponte.aoColocar`).
Arquivos: criar `src/app/recentes.ts` e `tests/unit/recentes.test.ts`; mudar `src/ui/Biblioteca.tsx`, `src/render/viewport.ts` (ou o ponto da ponte que recebe `aoColocar`) e `src/ui/estilo.css`.
Como:
- `recentes: Signal<string[]>` guarda os ids de item, os 20 últimos, sem repetir, com o mais novo primeiro. `favoritos: Signal<string[]>` guarda os ids de família. As funções puras `registrarRecente(lista, id, max)` e `alternarFavorito(lista, id)` são as que os testes cobrem. A persistência fica no `localStorage` (`atlas:recentes`, `atlas:favoritos`), sempre com `try/catch`, e a lista vazia é o fallback.
- Registre o recente quando um objeto for posto pela ferramenta de objeto.
- Na UI, as abas ficam entre o topo da família e o catálogo. Recentes mostra a grade de miniaturas de itens, e clicar põe o item no pincel com a família. Favoritos mostra a grade de famílias. Uma estrela no título da família na mão alterna o favorito.
Não fazer: guardar recentes no documento do mapa.
Testes: `registrarRecente` (ordem, sem repetição, corte) e `alternarFavorito`.
Pronto quando: os itens postos aparecem em Recentes depois de recarregar a página, e a estrela fixa a família em Favoritos.
Commit: `object library has recents and favorites`

### O6 — Objetos e luzes livres por padrão  ⬜
Objetivo: objetos e luzes são postos e arrastados fora da grade por padrão; `Alt` encaixa.
Depende de: —.
Ler: `src/render/viewport.ts`: `colocar` (`:766-800`), `desenharFantasma` (`:516-575`), o arrasto de seleção com `deltaEncaixado` (`:945-955`) e `encaixarObjetoDeParede`; `src/app/sessao.ts:20-60`; `src/domain/geometria.ts:375`.
Arquivos: criar `src/app/preferencias.ts`; mudar `src/app/sessao.ts` (se a ponte do viewport sair dali), `src/render/viewport.ts` e o tipo da ponte do viewport; mudar `src/ui/Biblioteca.tsx` (dicas que falam de `Alt`).
Como:
- `preferencias.ts`: `objetosNaGrade = signal(false)`, persistido em `atlas:objetos-na-grade` com `try/catch`. Exponha à ponte do viewport como `ponte.objetosNaGrade(): boolean`.
- No `viewport`, crie `livreParaObjeto(e) = ponte.objetosNaGrade() ? (!m.grid.snap || e.altKey) : !e.altKey`. Use essa função em `colocar` quando `f` for `objeto` ou `luz` (inclusive no encaixe ao longo da parede), no fantasma dessas duas ferramentas e no arrasto da seleção **quando todos os alvos forem `props` ou `lights`**. Todo o resto continua usando `!m.grid.snap || e.altKey`.
- Troque as dicas: "`Alt` põe fora da grade" vira "`Alt` encaixa na grade" (ou o inverso, quando a preferência estiver ligada).
Não fazer: mudar `grid.snap` do mapa nem o encaixe de peças, cômodos, paredes e aberturas. O botão da preferência na interface entra na O8, na seção Colocação.
Testes: se a regra sair numa função pura (`livreParaObjeto(naGrade, snap, alt)`), um teste de tabela verdade; o e2e de colocação existente deve continuar passando (ajuste a expectativa de posição encaixada, se houver).
Pronto quando: num mapa novo, um objeto posto fica exatamente sob o cursor; com `Alt`, fica no centro da célula.
Commit: `objects and lights are placed off the grid by default`

### O7a — Espelho e opacidade no documento  ⬜
Objetivo: `Objeto` ganha `flip` e `opacity`, validados, com um espelho de descrição puro.
Depende de: —.
Ler: `src/domain/mapa.ts:145-160`; `src/domain/validacao.ts` (função `objeto` e o bloco `props`); `src/procedural/descricao.ts:1-40`; `src/state/comandos.ts:194-215` (`item.atualizar`).
Arquivos: mudar `src/domain/mapa.ts`, `src/domain/validacao.ts` e `src/procedural/descricao.ts`; criar `tests/unit/espelho.test.ts`.
Como:
- Em `Objeto`: `flip?: boolean` (espelhado na horizontal, no eixo local x, antes da rotação) e `opacity?: number` (0,1 a 1; ausente vale 1). Os dois são opcionais, sem migração.
- A validação aceita `flip` booleano e `opacity` finita em [0,1; 1].
- `espelharDescricao(d: Descricao): Descricao`, pura. No piso, nega `x` e os x de `pts` (invertendo a ordem dos pontos para manter o sentido do polígono) e troca `dir` por `Math.PI - dir`. Na parede, faz o mesmo no eixo u de `face` e de `topo`.
- Espelho vertical não existe no documento: a interface faz V = `flip` invertido + rotação de 180°.
Não fazer: render (O7b).
Testes: espelhar duas vezes devolve a mesma descrição; a pegada não muda; um `poli` assimétrico tem o x negado; a validação rejeita `opacity: 0` e `opacity: 2`.
Pronto quando: typecheck e testes passam.
Commit: `props can be flipped and made translucent`

### O7b — Render do espelho e da opacidade  ⬜
Objetivo: o mapa desenha `flip` e `opacity`.
Depende de: O7a.
Ler: `src/render/entradas.ts:400-450` (`chaveDoObjeto`, `pedidoDoObjeto`); `src/render/cena.ts:525-560` (laço dos objetos: `oculto`, `aplicarSubmersao`, escala); `src/procedural/executar.ts` (onde a descrição do objeto vira bake); `src/render/cena-de-altura.ts` (`sincronizarObjetos`).
Arquivos: mudar `src/render/entradas.ts`, `src/procedural/executar.ts` (ou onde o pedido chega à descrição) e `src/render/cena.ts`.
Como:
- **Receita:** o pedido leva `espelhar: true`, e o executor aplica `espelharDescricao` antes de assar. A chave do cache inclui `|f` quando espelhado. Assim a luz, o relevo e a sombra do sol saem certos sozinhos.
- **Coleção (imagem):** o sprite filho ganha `scale.x` negativo, com a posição de origem ajustada para o espelho ficar em torno do centro do objeto. Confira que a camada de altura (`cenaDeAltura`) recebe o mesmo espelho; se não receber, espelhe lá também.
- **Opacidade:** `entrada.c.alpha = o.opacity ?? 1`, aplicada **antes** do `*= 0.5` do oculto e sem pisar o alfa da submersão. Leia `aplicarSubmersao` para compor na ordem certa. A sombra projetada do objeto multiplica pela mesma opacidade, se for desenhada à parte.
- O fantasma do pincel (`desenharFantasma`) ainda não precisa espelhar; isso entra na O8.
Não fazer: interface.
Testes: unitário para `chaveDoObjeto` (com e sem `flip` dão chaves diferentes). Validação visual: ponha `escrivaninha` e `casa:arvore-5m` espelhados e com opacidade 0,5 pelo console da ponte ou num mapa de teste, e salve a prancha em `test-results/o7b-espelho.png`.
Pronto quando: os objetos espelhados aparecem espelhados com a luz ainda de noroeste nas receitas, e a opacidade aparece no editor e no projetor.
Commit: `flipped and translucent props render correctly`

### O8a — Propriedades no pincel  ⬜
Objetivo: o pincel de objeto carrega escala, camada, espelho, opacidade, sombra e bloqueio, mais as variações aleatórias, e aplica tudo ao pôr.
Depende de: O3, O7a.
Ler: `src/render/pincel.ts`; `src/render/viewport.ts` (`colocar`, ramo `objeto`, e o fantasma `falso`); `src/domain/fabrica.ts` (`novoObjeto`); `camadaDoObjeto` em `src/render/cena.ts`.
Arquivos: mudar `src/render/pincel.ts` e `src/render/viewport.ts`; criar `src/domain/pincel-de-objeto.ts` e `tests/unit/pincel-de-objeto.test.ts`.
Como:
- `Pincel['objeto']` ganha:
  - `escala: number` (1); `camada: number | null` (`null` = a camada padrão do tipo); `espelhado: boolean`; `opacidade: number` (1); `sombra: boolean` (true); `bloqueia: boolean` (true);
  - `rotacaoAleatoria: boolean`; `espelhoAleatorio: boolean`; `escalaAleatoria: number` (0 a 0,5, a variação ± em fração);
  - `colocar: 'um' | 'varios'` ('um'); `selecionarAoPor: boolean` (true); `area: number` (0 m); `densidade: number` (1).
- Função pura `camposDoPincel(p: Pincel['objeto'], rand: () => number): Pick<Objeto, 'rotation' | 'scale'> & Partial<Pick<Objeto, 'flip' | 'opacity' | 'layer' | 'castsShadow' | 'blocks'>>`. Ela aplica as variações aleatórias e omite os campos que estão no padrão, para não poluir o documento.
- Mantenha o sorteio entre o fantasma e o clique: os valores sorteados ficam guardados, como a semente (`novaSemente`), e são renovados depois de pôr. O fantasma usa `rotation`, `scale` e `flip` do sorteio guardado.
- `selecionarAoPor: false` não seleciona o objeto posto.
Não fazer: modo `varios` e área (O9); interface (O8b).
Testes: `camposDoPincel` no padrão devolve só `rotation: 0, scale: 1`; com `rotacaoAleatoria`, a rotação fica em [0, 2π); a escala aleatória respeita a faixa; um `rand` fixo dá resultado determinístico.
Pronto quando: com valores mudados no código do pincel, o objeto nasce com eles e o fantasma os mostra.
Commit: `object brush carries scale, layer, flip, opacity and random variation`

### O8b — Painel de propriedades do objeto  ⬜
Objetivo: um único painel, no estilo do Inkarnate, edita o pincel na biblioteca e o objeto (ou a seleção) no inspetor.
Depende de: O4, O6, O8a.
Ler: `src/ui/campos.tsx` (inteiro); `src/ui/Inspetor.tsx:530-555` (`CamposDoObjeto`); `src/ui/Biblioteca.tsx` (`Objetos`); as capturas do Inkarnate descritas na seção "Referência".
Arquivos: criar `src/ui/PropriedadesDoObjeto.tsx`; mudar `src/ui/campos.tsx`, `src/ui/Biblioteca.tsx`, `src/ui/Inspetor.tsx` e `src/ui/estilo.css`.
Como:
- Em `campos.tsx`, crie `CampoDeslizante` (rótulo com ícone, valor numérico editável com unidade à direita, `<input type="range">` embaixo e um botão opcional de alternância à direita, como o dado da rotação). Ele confirma no `change`, não a cada `input`, para não encher o desfazer; a prévia pode ir no `input`.
- `PropriedadesDoObjeto` recebe `{ valores, aoMudar, modo: 'pincel' | 'selecao' }` e tem três seções em cartões, como no Inkarnate:
  1. **Transformar:** Escala (10–300%), Rotação (0–360°, com o dado `rotacaoAleatoria` só no modo pincel), Camada (−3 a 5, com "padrão"), botões Espelhar ↔ e ↕ (↕ = alterna o espelho e soma 180°).
  2. **Aparência:** Opacidade (10–100%), Projeta sombra, Bloqueia o movimento.
  3. **Colocação** (só no modo pincel): Pôr `Um | Vários`, Selecionar ao pôr, Encaixar na grade (a preferência da O6). Em "Mais opções", recolhido: Área (m), Densidade, Espelho aleatório, Escala aleatória (±%).
- Na **biblioteca**, o painel fica logo abaixo do topo da família, antes das abas de Recentes, e edita `s.pincel.value.objeto`.
- No **inspetor**, `CamposDoObjeto` passa a usar o painel no modo `selecao` para escala, rotação, camada, espelho, opacidade, sombra e bloqueio. A camada continua usando os comandos `objeto.camada` nos botões frente/trás que já existem, e o número da camada edita `layer` direto. Com vários objetos selecionados, o painel mostra o valor do primeiro e aplica a mudança a todos, num gesto só. Interação, oculto, submerso, harmonizar e "Variar" continuam como estão.
- Um botão "Copiar para o pincel" no inspetor leva as propriedades do objeto ao pincel. É o mesmo efeito do `Ctrl+clique`.
Não fazer: Blend Mode e Blur (fora do escopo, ver a tabela da Referência).
Testes: e2e: mudar a escala no painel da biblioteca e pôr um objeto faz o objeto nascer com essa escala; mudar a opacidade no inspetor muda o objeto selecionado (dá para ler pelo documento via `window` de teste, se houver, como nos outros e2e).
Pronto quando: dá para ajustar tudo antes de pôr, e o inspetor mostra o mesmo painel para o objeto selecionado.
Commit: `object properties panel works before and after placing`

### O9 — Pôr vários: arrastar, área e densidade  ⬜
Objetivo: no modo `varios`, arrastar carimba a família ao longo do caminho; com área, cada carimbo espalha alguns itens no círculo.
Depende de: O8a.
Ler: `src/render/viewport.ts` (a interação `espalhar` e `espalharAqui`, que servem de modelo para gesto, passo e desfazer); `src/authoring/espalhar.ts` (amostragem e checagem de sobreposição).
Arquivos: mudar `src/render/viewport.ts`; criar `src/authoring/carimbar.ts` e `tests/unit/carimbar.test.ts`.
Como:
- Função pura `carimbar(centro, pincel, familia, existentes, rand): Array<{ item: string; posicao: Ponto; campos }>`. Com `area = 0`, sai um item no centro. Com `area > 0`, saem `max(1, round(densidade × área do círculo / pegada média))` itens no círculo, evitando sobreposição com `existentes` e entre si (reaproveite o critério de `espalhar.ts`). Cada item recebe uma variante (sorteada se `varianteAleatoria`) e `camposDoPincel`.
- No `viewport`, com `colocar === 'varios'`, o `pointerdown` abre um gesto ("Pôr <família>"), e o arrasto carimba de novo a cada distância de `max(pegada × escala, area)` ÷ `densidade`. Tudo vai num desfazer só. Com `'um'`, o comportamento é o de hoje.
- O fantasma mostra o círculo da área quando `area > 0`.
Não fazer: mudar a ferramenta Espalhar.
Testes: `carimbar` respeita o raio, não sobrepõe e é determinística com `rand` fixo.
Pronto quando: arrastar no modo Vários com a família Árvore e área de 4 m planta um bosque variado, e Ctrl+Z desfaz tudo de uma vez.
Commit: `object brush can stamp many along a drag with area and density`

### O10 — Famílias na construção automática e no assistente  ⬜
Objetivo: os conjuntos de Espalhar e a ponte MCP entendem família, para o assistente pedir "árvore" sem escolher a variante.
Depende de: O1.
Ler: `src/authoring/espalhar.ts:13-60`; `src/app/ponte-leitura.ts:265-320` (`catalogo`); `docs/assistente/nucleo.md` (o trecho de `atlas_catalogo`); `src/app/ponte-escrita.ts` (onde o assistente põe objetos por id).
Arquivos: mudar `src/authoring/espalhar.ts`, `src/app/ponte-leitura.ts`, `src/app/ponte-escrita.ts` e `docs/assistente/nucleo.md`; mudar os testes de espalhar e da ponte.
Como:
- `ItemDeConjunto` aceita `familia` como alternativa a `receita` (união discriminada, ou `receita?`/`familia?` com validação). Ao sortear, a família escolhe uma variante com o mesmo gerador. Converta para famílias apenas os itens cujas variantes já estavam todas listadas no conjunto com o mesmo contexto (por exemplo, as árvores da `mata`). Os pesos totais ficam iguais.
- Em `atlas_catalogo`, crie a parte nova `familias`, com grupo, id, nome e itens. Cada item de `receitas` e de `colecao` passa a trazer `familia`. A `busca` também casa o nome da família.
- Onde a ponte de escrita aceita um id de item para pôr um objeto, passe a aceitar `familia:<id>`, que sorteia a variante pela semente da chamada. A instrução fica documentada em `nucleo.md`.
Não fazer: mudar mapas de exemplo salvos.
Testes: um conjunto com família produz só itens daquela família; o catálogo traz a parte `familias`; `familia:arvore` é aceito e vira uma das variantes.
Pronto quando: o assistente consegue listar as famílias e pôr "familia:pedra" num mapa.
Commit: `assistant and scatter sets understand asset families`

## Ordem sugerida

O1 → O3 → O4 → O6 → O7a → O7b → O8a → O8b → O5 → O9 → O10. A O2 é independente e pode entrar a qualquer momento.

O1 é a ficha que o Opus precisa revisar com mais cuidado (a classificação), antes de seguir para a O3.
