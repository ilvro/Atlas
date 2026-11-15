# Frente D — Construção de alto nível

> Parte de [mapas-melhores.md](mapas-melhores.md). Projeto: **Atlas** (`src/authoring/` puro, ferramentas em `src/app/ponte-escrita.ts`). Quem implementa: Gemini.

## O que estamos tentando fazer

Hoje o Claude do app constrói com ferramentas de baixo nível: `atlas_comodos` (retângulos de células), `atlas_portas` (um ponto perto da parede), `atlas_objetos` (um objeto por vez, posição e rotação à mão) e `atlas_terreno` (formas). Montar uma casa boa assim exige dezenas de decisões geométricas por casa. O Claude simplifica, e todas as casas viram um retângulo com uma porta.

O Atlas já sabe fazer boa parte do que falta, mas só pela interface:

- `src/authoring/mobiliar.ts` (`propostaDeMobilia`) mobília um cômodo pela função e pelo gênero, com móveis encostados nas paredes, cadeiras em volta da mesa e portas livres;
- `src/authoring/luzes.ts` (`propostaDeLuzes`) ilumina pela função;
- `src/authoring/portas.ts` (`propostaDePorta`) sugere a porta que falta.

**Meta:** dar ao Claude ferramentas que trabalham no nível em que ele pensa:

- **`atlas_mobiliar`**: mobília e ilumina cômodos prontos (expõe o que já existe).
- **Tipos de cômodo genéricos**: estábulo, celeiro, loja, depósito, oficina, cela, dormitório, refeitório, salão, pátio. Assim o moinho não vira "porão".
- **`atlas_edificio`**: recebe um **programa** (nome, frente, cômodos com função e área, forma desejada, alpendre, telhado) e devolve um edifício inteiro: planta composta, portas que dão acesso a tudo, janelas na fachada, telhado, mobília e luz. Serve para casa, igreja, quartel, hangar ou módulo de nave. Ele não sabe o que é uma vila; sabe o que é um edifício.
- **`atlas_arranjo`**: dispõe objetos em padrões com variação controlada (fileiras desalinhadas, grade solta, aglomerado, ao longo de um caminho, em círculo, junto às bordas). Serve para cemitério, acampamento, baia de carga, bancos de igreja, feira e estacionamento.
- **`atlas_caminho`**: trilha ou estrada orgânica ao longo de pontos, com curva suave, largura que varia, borda de outro material e sulcos.

## Decisões

- **Tudo puro em `src/authoring/`**, no padrão de `construcao.ts`: recebe o `MapaAtlas`, devolve `{ comandos, ids }` e nunca toca no documento. A ferramenta aplica tudo **numa só transação** (um passo de desfazer), via `escrever` em `ponte-escrita.ts`.
- **Determinístico pela `semente`**: mesma entrada, mesma saída. Ids pelo `gerarId`.
- **Respeitar o que existe.** Nada se sobrepõe a cômodos, paredes ou objetos que bloqueiam. Quando não cabe, o erro diz onde e por quê, e sugere outra origem.
- **A resposta descreve o resultado em texto** (cômodos, área, forma e onde fica a entrada), para o Claude conferir sem precisar de imagem.

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| D1 | `atlas_mobiliar` | conector sobre o que existe |
| D2 | Tipos de cômodo genéricos e a mobília deles | dados (presets + regras) |
| D3a | Planta do edifício a partir do programa | `authoring` puro |
| D3b | Portas e janelas do edifício | `authoring` puro |
| D3c | Ferramenta `atlas_edificio` | conector |
| D4a | Arranjos de objetos | `authoring` puro |
| D4b | Ferramenta `atlas_arranjo` | conector |
| D5a | Caminho orgânico | `authoring` puro |
| D5b | Ferramenta `atlas_caminho` | conector |

Ordem: D1 → D2 → D3a → D3b → D3c; D4a → D4b e D5a → D5b em qualquer momento.

---

### D1 — `atlas_mobiliar`  ✅
Objetivo: o Claude mobília e ilumina cômodos com o gerador que a interface já usa.
Depende de: —.
Ler: `src/authoring/mobiliar.ts` (`propostaDeMobilia`), `src/authoring/luzes.ts` (`propostaDeLuzes`), `src/authoring/sugestoes.ts` (`Contexto`), `src/authoring/proposta.ts`, `src/authoring/construcao.ts` (`aplicarEmCopia`), `src/app/ponte-escrita.ts` (`escrever`, `geracao` e uma ferramenta inteira, como `atlas_comodos`), `tests/unit/ponte-escrita.test.ts`.
Arquivos: criar `src/authoring/mobiliar-lote.ts` e `tests/unit/mobiliar-lote.test.ts`; mudar `ponte-escrita.ts`, `ferramentas-atlas.md`, `catalogo-base.json` (regenerado).
Como:
1. `mobiliarLote(m, pedido: { comodos: string[]; luzes?: boolean; semente?: number; gerarId? }): Construcao & { relatorio: { id: string; nome: string; objetos: number; luzes: number; motivo?: string }[] }`:
   - para cada id, em ordem, monta o `Contexto` `{ m: atual, versao: 0, semente: semente + índice, gerarId }`, chama `propostaDeMobilia` e aplica numa cópia (`aplicarEmCopia`), para que o cômodo seguinte veja o anterior;
   - com `luzes !== false`, faz o mesmo com `propostaDeLuzes`;
   - sem proposta, registra `motivo` ("função sem regras de mobília", "cômodo pequeno demais", "cômodo não existe") e segue;
   - ids inexistentes não derrubam o lote: viram `motivo`.
2. Ferramenta `atlas_mobiliar { comodos: string[] (1 a 60), luzes?: boolean, semente? }`, destrutiva, um passo de desfazer. A resposta traz o relatório em texto ("Casa Falk · sala: 9 objetos, 1 luz").
3. Guia: quando usar (logo depois de criar cômodos; depois, ajustar à mão o que conta a história do lugar).
Não fazer: mobiliar cômodos que já têm muitos objetos de piso de propósito (o gerador já conta o que existe; não mude isso).
Testes: lote com sala e quarto gera objetos nos dois; id inexistente vira `motivo`; mesma semente dá o mesmo resultado; tudo cabe numa transação.
Pronto quando: `atlas_mobiliar` mobília os 40 cômodos de "Lysdal · a vila (neve)" numa chamada (com `luzes: false`) e o Ctrl+Z desfaz tudo de uma vez.
Commit: `added atlas_mobiliar tool`

### D2 — Tipos de cômodo genéricos e a mobília deles  ✅
Nota: em `src/app/ponte-escrita.ts`, `atlas_comodos.tipo` passou a aceitar `{ type: 'string' }` sem `enum` inline no esquema JSON para manter a soma das ferramentas abaixo de 22 KB (com `catalogo-base.json` atualizado).
Objetivo: os lugares comuns fora de casa têm tipo, piso, papel, telhado padrão e mobília.
Depende de: D1 (para testar pela ferramenta).
Ler: `src/domain/presets.ts` (`TIPOS_DE_COMODO`, `FUNCOES_AO_AR_LIVRE`, `telhadoPadrao`), `src/authoring/regras-mobilia.ts` inteiro (`ItemDeRegra`, `item`, `REGRAS_DE_MOBILIA`, `VARIACOES_DE_GENERO`), `src/authoring/mobiliar.ts` (`MATERIAIS_POR_GENERO`), `src/authoring/funcao.ts` (`POR_NOME`), `src/authoring/luzes.ts` (`LUZES_POR_FUNCAO`). Use `atlas_catalogo { parte: 'receitas' }` (ou `listaDeReceitas()`) para conferir que cada receita citada existe.
Arquivos: mudar `presets.ts`, `regras-mobilia.ts`, `mobiliar.ts`, `funcao.ts`, `luzes.ts`; testes em `tests/unit/presets.test.ts` e no teste de regras de mobília que existir (procure em `tests/unit/`).
Como:
1. Novos tipos (id = função), com piso e papel que já existem. Escolha pelo nome e confira no catálogo de materiais:

   | id | nome | piso | papel | ar livre |
   | --- | --- | --- | --- | --- |
   | `estabulo` | Estábulo | `tabuas.escuras` | `tijolo` | não |
   | `celeiro` | Celeiro | `tabuas.escuras` | `tijolo` | não |
   | `deposito` | Depósito | `concreto` | `tijolo` | não |
   | `loja` | Loja | `tabuas.carvalho` | `papel.liso-claro` | não |
   | `oficina` | Oficina | `tabuas.escuras` | `tijolo` | não |
   | `cela` | Cela | `laje.pedra` | `tijolo` | não |
   | `dormitorio` | Dormitório | `tabuas.escuras` | `reboco.branco` | não |
   | `refeitorio` | Refeitório | `tabuas.escuras` | `tijolo` | não |
   | `salao` | Salão | `tabuas.carvalho` | `boiserie.escura` | não |
   | `patio` | Pátio | `laje.pedra` | `reboco.branco` | **sim** |

   `patio` já está em `FUNCOES_AO_AR_LIVRE`. Quando a frente E criar pisos melhores (terra batida, palha), a E2 troca o piso de `estabulo` e `celeiro`.
2. Regras de mobília, **só com receitas que existem**:
   - `estabulo`: `fardo-de-feno` (parede, 2 a 4), `bebedouro` (parede, 1 a 2), `monte-de-palha` (canto, 1 a 2), `cavalo` (centro, 0 a 2, área mínima 12), `tina-de-agua` (junto do bebedouro, 0 a 1).
   - `celeiro`: `fardo-de-feno` (parede, 3 a 6), `sacos` (canto, 1 a 3), `carroca` (centro, 0 a 1, área mínima 20), `carrinho-de-mao`, `pilha-de-barris`.
   - `deposito`: `pilha-de-caixotes` (canto, 1 a 3), `caixote` (parede, 2 a 5), `barril` e `pilha-de-barris` (parede), `sacos`, `estante.piso`.
   - `loja`: `balcao` (parede, 1), `estante.piso` (parede, 2 a 4), `prateleira.parede` (na parede), `caixote` e `barril` (canto).
   - `oficina`: `bancada.trabalho` (parede, 1 a 2), `estante` (parede), `caixote`, `pedra-de-amolar`, `banqueta` (junto da bancada).
   - `cela`: `catre` ou `enxergao` (parede, 1), `grilhoes.parede` (na parede, 0 a 1), `monte-de-palha` (canto).
   - `dormitorio`: `beliche` ou `cama.solteiro` (parede, por área: 1 a cada 6 m²), `bau` (junto, ao lado), `suporte-de-armas` (parede, 0 a 1, só fantasia).
   - `refeitorio`: `mesa.banquete` ou `mesa.taverna` (centro, por área), `banco.longo` (junto, ao redor), `lareira.pedra` (parede, 0 a 1), `caldeirao` (canto, 0 a 1).
   - `salao`: `mesa.banquete` (centro), `banco.longo` (junto), `lareira.pedra` (parede), `estandarte` (na parede), `trono` (parede, 0 a 1, só fantasia).
   - `patio`: `banco.jardim` (parede, 0 a 2), `vaso.planta` (canto), `poco` ou `fonte` (centro, 0 a 1, área mínima 20).
   Ajuste `quantos`, `prioridade` e `areaMinima` imitando as regras vizinhas (taverna e forja são as mais próximas).
3. `funcao.ts`: palavras no `POR_NOME` (estábulo, cocheira; celeiro, paiol; depósito, armazém, almoxarifado; loja, mercearia, botica, venda; oficina, carpintaria; cela, prisão, calabouço; dormitório, alojamento, quartel; refeitório, cantina; salão, salão comunal, hall; pátio, quintal).
4. `luzes.ts`: luz por função para os tipos novos (lamparina na maioria, tocha na cela, nenhuma no pátio).
5. `MATERIAIS_POR_GENERO`: pisos e papéis alternativos coerentes para os tipos novos nos três gêneros.
6. `telhadoPadrao`: estábulo e celeiro com o estilo `celeiro`; depósito e oficina com `galpao-de-zinco` no gênero moderno.
Não fazer: tipos de ficção científica (frente E, E1).
Testes: todo tipo novo tem regras e só cita receitas que existem (faça um teste que percorre `REGRAS_DE_MOBILIA` e confere cada receita em `ACERVO.item`); `palpite` de "Armazém do Ben" dá `deposito`; `telhadoPadrao` do estábulo é o estilo celeiro.
Pronto quando: `atlas_comodos` aceita os tipos novos e `atlas_mobiliar` mobília um estábulo com feno, bebedouro e palha.
Commit: `added generic room types with furnishing rules`

### D3a — Planta do edifício a partir do programa  ✅
Objetivo: uma função pura transforma um programa em cômodos encaixados numa planta com forma.
Depende de: D2.
Ler: `src/authoring/construcao.ts` (`comodos`, `PedidoDeComodo`, `Ret`), `src/domain/celulas.ts`, `src/domain/edificios.ts`, `src/domain/telhado-geometria.ts` (`retangulosDe`), `src/domain/presets.ts` (`tipoDeComodo`, `FUNCOES_AO_AR_LIVRE`).
Arquivos: criar `src/authoring/edificio.ts` e `tests/unit/edificio.test.ts`.
Como:
1. Tipos:
   ```ts
   export type Frente = 'n' | 's' | 'l' | 'o';
   export type FormaDoEdificio = 'auto' | 'compacta' | 'L' | 'T' | 'U' | 'linear' | 'patio';
   export interface ComodoDoPrograma { tipo: string; area: number; nome?: string; principal?: boolean }
   export interface ProgramaDeEdificio {
     nome: string; origem: [number, number];        // célula do canto superior esquerdo do lote
     lote?: [number, number];                       // largura × altura máximas em células (padrão: 3 × √(área total))
     frente: Frente; forma?: FormaDoEdificio; alpendre?: boolean;
     comodos: ComodoDoPrograma[];                   // 1 a 12
   }
   export interface PlantaDoEdificio { comodos: { tipo: string; nome: string; rets: Ret[]; principal: boolean; ligadoA: number | null }[]; forma: FormaDoEdificio; caixa: Ret; entrada: { comodo: number; lado: Frente } }
   export function plantaDoEdificio(m: MapaAtlas, p: ProgramaDeEdificio, semente: number): PlantaDoEdificio
   ```
2. Áreas viram células: `max(2, round(area / grade²))`. Cada cômodo é um retângulo com proporção entre 1:1 e 1:2, perto da área pedida (±1 célula de cada lado).
3. Algoritmo de encaixe (determinístico pela semente):
   - o cômodo `principal` (ou o de maior área) fica junto da `frente`, recebe a entrada e é a raiz;
   - os demais, em ordem de área decrescente, encostam num cômodo já posto, compartilhando pelo menos 2 células de parede. As posições candidatas são as quatro faces do cômodo pai, alinhadas a uma das pontas ou centradas;
   - cada candidata recebe uma nota: penalidade por sair do lote, por colidir com cômodos ou paredes existentes do mapa (proibido) e por bloquear a frente; prêmio por seguir a `forma`: `compacta` (caixa envolvente mínima), `L` (dois braços ortogonais), `T`, `U`, `linear` (todos em fila ao longo do eixo paralelo à frente) e `patio` (anel em volta de um vazio central);
   - `auto` sorteia entre `compacta`, `L` e `linear` pela semente, ponderado pelo número de cômodos (2 ou 3: compacta ou L; 4 a 6: L, T ou linear; 7 ou mais: linear com corredor ou pátio);
   - com 5 cômodos ou mais, em `linear` e `T`, insira um `corredor` de 1 célula de largura ao longo do eixo, ligando todos;
   - `ligadoA` guarda o pai (para as portas da D3b).
4. `alpendre: true`: uma faixa de 1 célula de profundidade na frente do principal, da largura dele, com tipo `varanda` (nasce sem telhado pelo `FUNCOES_AO_AR_LIVRE`).
5. Se nada couber, lance `ErroDeConstrucao` com o motivo e a área livre que faltou.
Não fazer: portas e janelas (D3b); comandos (D3c).
Testes: programa de 1 cômodo dá 1 retângulo na origem; 3 cômodos em `L` dão uma caixa não retangular (as células não preenchem a caixa); `linear` com 6 cômodos tem corredor; nenhuma planta colide com um cômodo existente no mapa de teste; a mesma semente dá a mesma planta e outra semente dá outra; todo cômodo tem `ligadoA` válido, menos a raiz; a área de cada cômodo fica a ±40% da pedida.
Pronto quando: `npm test` passa e um teste imprime (em comentário) a planta ASCII de 3 programas de exemplo para revisão do Opus.
Commit: `added building floor plan from a room program`

### D3b — Portas e janelas do edifício  ⬜
Objetivo: todo cômodo do edifício tem acesso, e a fachada tem janelas.
Depende de: D3a.
Ler: `src/authoring/construcao.ts` (`portas`, `PedidoDePorta`), `src/domain/geometria.ts` (`encaixarNaParede`, `motivoDeNaoCaber`), `src/authoring/portas.ts` (como a sugestão escolhe a parede).
Arquivos: mudar `src/authoring/edificio.ts` e `tests/unit/edificio.test.ts`.
Como:
1. `aberturasDoEdificio(planta, grade): { portas: PedidoDePorta[]; janelas: PedidoDePorta[] }`, em metros, no centro de uma célula de parede compartilhada:
   - entrada: na face `frente` do principal (ou do alpendre, se houver), porta de 1,2 m em casas e 1,5 m em salão, celeiro e capela;
   - porta interna entre cada cômodo e o seu `ligadoA`, no meio do trecho compartilhado; para o corredor, porta de cada cômodo para o corredor;
   - porta de fundos (`secundaria`) no cômodo de serviço (cozinha, depósito, oficina, estábulo) que tem face externa oposta à frente, se a planta tiver 3 cômodos ou mais;
   - janelas: 1 por face externa com 3 células ou mais, em cômodos que não são `porao`, `deposito`, `cela` nem `corredor`; 2 se a face tiver 6 células ou mais. Nunca a menos de 1 célula de uma porta.
2. Exporte também uma verificação `acessivel(planta, aberturas): boolean` (busca em largura a partir da entrada).
Testes: toda planta de D3a gerada no teste fica acessível; janelas não caem em cela; a entrada fica na face `frente`.
Pronto quando: `npm test` passa.
Commit: `building plans get doors and windows`

### D3c — Ferramenta `atlas_edificio`  ⬜
Objetivo: o Claude constrói edifícios inteiros por programa, num passo de desfazer.
Depende de: D3b, D1.
Ler: `src/authoring/construcao.ts` (`comodos`, `portas`, `aplicarEmCopia`), `src/authoring/mobiliar-lote.ts` (D1), `src/app/ponte-escrita.ts` (`atlas_comodos` como modelo), `tests/unit/ponte-escrita.test.ts`.
Arquivos: criar `src/authoring/edificio-construir.ts` e `tests/unit/edificio-construir.test.ts`; mudar `ponte-escrita.ts`, `ferramentas-atlas.md`, `mapas.md` (passo 3 da ordem: "edifícios com `atlas_edificio`; `atlas_comodos` para o que for irregular"), `catalogo-base.json`.
Como:
1. `construirEdificios(m, pedidos: (ProgramaDeEdificio & { telhado?: string | null; piso?: string; mobiliar?: boolean; luzes?: boolean })[], semente, gerarId): Construcao & { descricoes: string[] }`. Para cada edifício, numa cópia acumulada:
   1. `plantaDoEdificio`;
   2. `comodos(...)` com os `rets` (o telhado é o pedido, aplicado a todos os cômodos cobertos, ou o padrão);
   3. `portas(...)` sobre a cópia com os cômodos (portas e depois janelas, com `tipo: 'window'`);
   4. se `mobiliar !== false`, `mobiliarLote` sobre os cômodos novos, com `luzes` (padrão `true`).
   A descrição diz, por exemplo: "Casa Falk: 4 cômodos (sala 20 m², quarto 12 m², quarto 9 m², varanda), 51 m², em L; entrada ao sul em [61,5, 96]; telhado casa-de-telha".
2. Ferramenta `atlas_edificio { edificios: [...] (1 a 12), semente? }`, destrutiva. Descrição até 180: "Constrói edifícios inteiros por programa: cômodos com função e área, forma (L, T, linear…), frente, alpendre, telhado; portas, janelas, mobília e luz. Um desfazer."
3. Erros por edifício não abortam os outros: a resposta lista quais entraram e o motivo dos que falharam. Os que entraram ficam numa só transação.
4. Guia (`ferramentas-atlas.md`): esquema, exemplo de casa de camponês, de igreja (nave principal grande + sacristia + torre) e de módulo de nave (corredor linear com cabines), e a dica de variar `forma`, porte e `frente` entre edifícios vizinhos.
Testes: dois edifícios num mapa vazio entram, acessíveis e mobiliados; um edifício que colide falha com motivo e o outro entra; um único rótulo de transação.
Pronto quando: pelo MCP, `atlas_edificio` com 6 programas variados monta 6 casas diferentes, e `atlas_revisar` não acusa `casas-iguais`, `comodo-sem-acesso` nem `interior-vazio`.
Commit: `added atlas_edificio tool`

### D4a — Arranjos de objetos  ⬜
Objetivo: dispor muitos objetos com ordem e variação, sem o aspecto de grade mecânica.
Depende de: —.
Ler: `src/authoring/espalhar.ts` (conjuntos e o espalhar orgânico), `src/authoring/formas.ts` (`Forma`, `medirForma`), `src/authoring/construcao.ts` (`objetos`, `itemInvalido`), `src/authoring/portas.ts` (`reservasDePorta`), `src/authoring/insight.ts` (`caixaDoObjeto`).
Arquivos: criar `src/authoring/arranjo.ts` e `tests/unit/arranjo.test.ts`.
Como:
1. Tipos:
   ```ts
   export type Padrao = 'fileiras' | 'grade-solta' | 'aglomerado' | 'ao-longo' | 'circulo' | 'bordas';
   export interface PedidoDeArranjo {
     padrao: Padrao; area: Forma;                 // 'ao-longo' usa { faixa } (a polilinha)
     itens: { item: string; peso?: number; escala?: [number, number]; params?: Record<string, unknown> }[];
     espacamento: [number, number];               // metros entre colunas e entre fileiras (ou passo ao longo)
     angulo?: number;                             // direção das fileiras (rad); padrão 0
     desalinho?: number;                          // metros de deslocamento aleatório (padrão 15% do espaçamento)
     giro?: number;                               // variação de rotação em rad (padrão 0,08)
     falhas?: number;                             // 0 a 0,6: chance de faltar um item (padrão 0,1)
     encarar?: 'fileira' | 'centro' | 'caminho' | 'livre';  // para onde os itens olham
     grupos?: { tamanho: [number, number]; vazio: number }; // fileiras em quadras com corredores
   }
   export function arranjar(m: MapaAtlas, p: PedidoDeArranjo, semente: number, gerarId): Construcao
   ```
2. `fileiras` e `grade-solta`: grade girada por `angulo` dentro da `area`, com desalinho, giro e falhas; `grade-solta` com desalinho maior e sem alinhar rotações. `aglomerado`: amostragem de Poisson-disc (raio mínimo = menor espaçamento) com densidade maior no centro. `ao-longo`: ao longo da polilinha, dos dois lados, a `espacamento[1]` metros dela. `circulo`: anéis concêntricos. `bordas`: junto da borda da área, olhando para dentro.
3. Pula posições que colidem com paredes, cômodos (a não ser que a `area` esteja dentro de um cômodo), objetos que bloqueiam e reservas de porta; usa a pegada real do item (`ACERVO.pegadaDaFonte`) com escala.
4. Itens sorteados por peso; escala sorteada no intervalo; `params` passa à receita.
Testes: `fileiras` em retângulo de 10 × 6 m com espaçamento 1,5 × 2 gera cerca de 20 itens (menos as falhas); os x não ficam todos iguais (há desalinho); nada sobre uma porta; mesma semente, mesmo resultado; item inexistente dá `ErroDeConstrucao` com os parecidos.
Pronto quando: `npm test` passa e um cemitério de teste com 3 receitas variadas não dispara a regra `fileiras-mecanicas` da B5b (se ela já existir).
Commit: `added object arrangements with controlled variation`

### D4b — Ferramenta `atlas_arranjo`  ⬜
Objetivo: o Claude compõe cemitérios, acampamentos, baias de carga e plateias.
Depende de: D4a.
Arquivos: mudar `ponte-escrita.ts`, `ferramentas-atlas.md` (exemplos: cemitério com cruzes, lápides e túmulos em quadras; tendas de acampamento em aglomerado; caixotes numa baia em fileiras com corredor; bancos de igreja em fileiras olhando o altar), `catalogo-base.json`; testes.
Como: ferramenta `atlas_arranjo { padrao, area, itens, espacamento, ... , semente? }` (até 300 objetos), destrutiva, um passo de desfazer. A resposta conta os itens e quantas posições não couberam.
Pronto quando: pelo MCP, um cemitério de 15 × 10 m sai com quadras, fileiras levemente tortas e lápides variadas.
Commit: `added atlas_arranjo tool`

### D5a — Caminho orgânico  ⬜
Objetivo: trilhas e estradas com curva suave, largura viva, borda e sulcos.
Depende de: —.
Ler: `src/authoring/formas.ts` (`Forma` `faixa`, `celulasDaForma`, `irregular`), `src/authoring/construcao.ts` (`terreno`, `OpDeTerreno`), o comando `presenca.pintar` (procure em `src/state/comandos*.ts`) e o pincel `sulcos` em `src/domain/presets.ts` (`PINCEIS_DE_PRESENCA`).
Arquivos: criar `src/authoring/caminho.ts` e `tests/unit/caminho.test.ts`.
Como:
1. `caminho(m, p: { pontos: Ponto[]; largura: number | [number, number]; material: string; borda?: { material: string; largura: number }; sulcos?: boolean; irregular?: number }, semente): Construcao`:
   - suaviza a polilinha com Catmull-Rom centrípeta (amostras a cada 0,5 m);
   - a largura varia ao longo do caminho por ruído suave (`valueNoise2D` de `procedural/ruido.ts`) entre os limites, ou fica fixa;
   - gera as células do miolo como a união de discos (raio = meia largura local) ao longo das amostras, com borda irregular (padrão 0,35 m);
   - se houver `borda`, pinta antes a faixa mais larga com o material da borda (que fica só nas margens, porque o miolo cobre o centro);
   - `sulcos: true` pinta presença `sulcos` em duas linhas paralelas a ±0,6 m do eixo, com intensidade 0,4, só onde a largura local passa de 2 m.
2. Devolve comandos `terreno.pintar` (borda, depois miolo) e `presenca.pintar`.
Testes: caminho em L sai com o canto arredondado (nenhuma célula no vértice externo do L); a largura varia quando é intervalo; a borda fica fora do miolo; mesma semente, mesmo resultado.
Pronto quando: `npm test` passa.
Commit: `added organic path builder`

### D5b — Ferramenta `atlas_caminho`  ⬜
Objetivo: o Claude traça trilhas e estradas que parecem gastas pelo uso.
Depende de: D5a.
Arquivos: mudar `ponte-escrita.ts`, `ferramentas-atlas.md` (exemplos: trilha de terra na neve com borda de neve suja; estrada de paralelepípedo com sulcos; corredor de cascalho entre túmulos), `mapas.md` (caminhos sempre com `atlas_caminho`, nunca com faixa reta de `atlas_terreno`), `catalogo-base.json`; testes.
Como: ferramenta `atlas_caminho { caminhos: [...] (1 a 20), semente? }`, destrutiva, um passo de desfazer.
Pronto quando: refazer a trilha em ziguezague de Lysdal com `atlas_caminho` dá um caminho de largura viva, sem as faixas retas de hoje.
Commit: `added atlas_caminho tool`
