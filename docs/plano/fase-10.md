# Fase 10 — Mundo lá fora: mapas de exemplo

"Sete mapas que mostram do que o Atlas é capaz." O usuário trouxe sete mapas feitos no Inkarnate como alvo de qualidade (cópias só para consulta em `docs/referencias/exemplos/`, fora do git e do build). A fase entrega esses sete como **exemplos da galeria**, feitos com o próprio Atlas: documentos comuns, editáveis, sem nenhuma imagem pronta de mapa.

Critério de pronto da fase: os sete exemplos abrem pela galeria ("Começar de um exemplo"), funcionam em Construir e em Sessão, nos dois estilos (Ilustrado e Pixel), com climas próprios; a captura de cada um, lado a lado com a referência, mostra a mesma composição, a mesma ambientação e o mesmo nível de acabamento.

Planejado em 5 de novembro de 2026 contra o código do fim da Fase 9. As fichas de 10.0 a 10.2 estão detalhadas; as de 10.3 em diante têm escopo fechado e são **detalhadas ao começar o lote** (o código dos lotes anteriores muda o que elas tocam).

## Os sete exemplos

Composições **próprias, inspiradas** nas referências (a mesma ideia de cena e de luz), sem decalcar o desenho nem trazer marcas d'água ou nomes dos autores. Medidas em metros, célula de 1,5 m.

| # | Exemplo | Tamanho | Referência | O que a cena tem |
| --- | --- | --- | --- | --- |
| 1 | **Desfiladeiro nevado** | 48 × 27 | `desfiladeiro-nevado.png` | Neve funda com ondulações de vento e trilhas; uma crista de rocha em "C" com estrias e neve no topo, que lança sombra longa e azulada; pinheiros nevados (copas redondas brancas) com sombras longas; arbustos secos e galhos; pedras com neve; lago congelado com rachaduras à direita, cercado por rochedos; um trenó; nuvens baixas nas bordas; neve caindo. |
| 2 | **Ruína à beira-mar** | 50 × 37 | `ruina-costeira.png` | Calçamento antigo de lajes com grama nas juntas; plataforma octogonal com círculo rúnico entalhado, mureta de pedra e pilares com esferas; escada; coluna caída; trilha de escombros escuros e queimados com uma viga partida; rochedos grandes com musgo; copas densas de carvalho; tocos; mar à direita com ondas e espuma batendo nas rochas. |
| 3 | **Ravina noturna** | 50 × 33 | `ravina-noturna.png` | Duas escarpas paralelas em patamares; chão de lajes rachadas com grama; rio no fundo da fenda, cachoeira no alto e outra embaixo; ponte de tábuas sobre a fenda e uma tábua solta; mata densa e escura; tochas em estaca com poças de luz quente; noite azulada. |
| 4 | **Porto à noite** | 60 × 36 | `porto-noturno.png` | Rua de paralelepípedos; casas com interiores (quartos, sala de jantar, oficina) e telhados de telha; praça com fonte e estátua; barracas de feira com toldos listrados; caixotes, barris e sacos; armazém; cais de madeira com guindastes; quatro navios atracados e um barco; mar escuro com espuma; postes com halos quentes e neblina rasteira. |
| 5 | **Entreposto do rio** | 58 × 36 | `entreposto-do-rio.png` | Estrada de terra com sulcos de rodas; carroça carregada com dois cavalos; cavalos no bebedouro e fardos de feno; armazém grande com escritório, depósito e cômodos (caixotes, sacas, mesas); deque de carga com carrinho; píer com barcaça e um cavalo a bordo; margem de areia com espuma; lago com vitórias-régias e juncos; mata; lanterna no fim do píer. |
| 6 | **Covil na caverna** | 45 × 34 | `covil-na-caverna.png` | Maciço de rocha em volta, com o vazio negro além; chão de rocha rachada; rastro de sangue seco; ossadas e crânios de animais, uma pilha de ossos; pilha de peles; dois buracos no chão; árvore morta caída; seixos; um feixe de luz frio vindo do alto à esquerda; o resto no escuro. |
| 7 | **Gruta dos contrabandistas** | 32 × 42 | `gruta-dos-contrabandistas.png` | Gruta com paredes de rocha; água rasa e cristalina com fundo visível (rochas submersas, corais, ouriços, anêmonas, algas); duas ilhotas de rocha com plantas; passarelas de tábuas irregulares; botes a remo, dois barcos de vela com flutuador, um navio; duas cabanas de pedra com telhado; lanternas; luz verde-dourada entrando pela boca da gruta, com cáusticas na água. |

## O que já existe e o que falta

**Já existe (serve como está):** terreno pintado em camadas com borda orgânica (`assarTerreno`); materiais `grama`, `terra`, `areia`, `pedregulho`, `lama`, `neve`, `calcada`; cômodos com paredes caixa, portas e telhados (`telha.barro`, `telha.ardosia`, `telha.palha`); luzes com tocha, fogueira, lamparina, cone e flicker; climas `noite`, `neve`, `neblina`; partículas (neve, chuva, brasas, folhas) e neblina; presença (`musgo`, `poca`, `ordem.sangue`); receitas exteriores (pedras, toco, tronco caído, poço, fonte, estátua, pilar, escada externa, balaustrada, poste); coleção com árvores, pinheiros e arbustos; estilo Pixel para tudo isso.

**Falta** (o que separa o Atlas das referências), por ordem de peso:

| Falta | Exemplos que precisam | Tarefa |
| --- | --- | --- |
| **Água**: superfície animada, profundidade pela distância à margem, espuma na borda, correnteza, fundo visível na água rasa, cáusticas | 2, 3, 4, 5, 7 | 10.1 |
| **Relevo**: maciço de rocha (cavernas, rochedos de costa) e escarpas com lado alto e baixo, que bloqueiam visão | 1, 2, 3, 6, 7 | 10.2 |
| **Sombra do sol** nos exteriores: árvores, rochas e escarpas lançam sombra longa pela hora e pelo ângulo do sol | 1, 2, 3, 5 | 10.3 |
| **Materiais**: gelo, neve com dunas, paralelepípedo, lajes com grama, rocha rachada, terra com sulcos, areia molhada, cascalho | todos | 10.4 |
| **Acervo**: ~70 itens novos (natureza de inverno e de mata, ruína, porto, estrada, caverna, fundo do mar) | todos | 10.5 |
| **Ambientação**: nuvens ou escuro nas bordas do mapa, halo das luzes, feixe de luz com raios, objetos submersos e cachoeira animada | 1, 4, 6, 7 / 3 | 10.6 |
| **Exemplos na galeria**: formato, construtor por script, "Começar de um exemplo" | todos | 10.0 |

Não falta: andares, grid hexagonal ou mapa de região (nenhum exemplo pede).

## Decisões (não rediscutir na implementação)

- **Documento v6**, com uma migração 5 → 6 que só acrescenta campos com padrão neutro:
  - `Terreno.layers[].flow: null | { angle: number; speed: number }` (correnteza da camada de água; `null` é água parada);
  - `Parede.drop: 'a' | 'b' | null` (de que lado a escarpa desce; só vale para `kind: 'cliff'`) e `Parede.source` aceita `{ terrainLayerId: string }` (contorno gerado de um maciço);
  - `Objeto.elevation` aceita `'underwater'` (desenhado sob a superfície da água);
  - `Acabamento.edges: { kind: 'none' | 'clouds' | 'dark' | 'fog'; amount: number }` e `Acabamento.glow: number` (halo das luzes, 0 a 1);
  - `Luz.rays: boolean` (raios visíveis no cone).
- **Água e maciço são materiais de terreno** com um novo `uso` (`'agua'` e `'macico'`) no catálogo de materiais. O mestre pinta com o pincel de terreno que já existe; o renderizador reconhece o uso. Nada de entidade nova para lago ou rocha.
- **A água tem duas partes:** o **leito** (assado com o terreno: o que fica sob a água, escurecendo com a profundidade) e a **superfície** (camada de render nova, animada por shader, acima do terreno e abaixo dos cômodos e objetos). A profundidade é a distância à margem, calculada no assar, nunca guardada no documento.
- **Animação só onde a referência pede:** superfície da água, espuma, cachoeira, chamas (já é o flicker), raios de luz e nuvens de borda. Barcos e árvores ficam parados. Movimento reduzido (`FATOR_DE_MOVIMENTO_REDUZIDO`) vale para tudo isso.
- **Pixel:** cada novidade tem a versão Pixel na mesma tarefa (AGENTS.md: uma descrição, dois estilos). Água no Pixel anima em degraus (6 quadros por segundo, faixas da paleta).
- **Exemplos são gerados por script**, não desenhados à mão no editor: `scripts/exemplos/<id>.ts` monta o documento com funções do domínio (as mesmas de pintar terreno, criar cômodo, espalhar) e grava `public/exemplos/<id>.atlas.json`, validado por `validarMapa`. Assim cada exemplo é reprodutível, revisável em diff e refeito quando o acervo melhora. A miniatura sai do Playwright, como o `npm run assar`.
- **Usar um exemplo** cria uma cópia no repositório (`duplicarParaNovaSessao`, id novo); o exemplo publicado nunca é alterado.
- **Referências** ficam em `docs/referencias/exemplos/` (ignoradas pelo git: arte de terceiros, 56 MB). As capturas lado a lado vão para `test-results/fase10-*.png`.

## Lotes

A fase é entregue em três lotes; cada um termina com exemplos prontos e mostrados ao usuário antes do seguinte.

| Lote | Tarefas | Exemplos que fecham |
| --- | --- | --- |
| **A — Rocha, neve e sombra** | 10.0a–b, 10.2a–c, 10.3, 10.4a, 10.5a, 10.5e, 10.6a–b, 10.7a, 10.7b | 1 Desfiladeiro nevado, 6 Covil na caverna |
| **B — Água** | 10.1a–d, 10.4b, 10.5b, 10.5f, 10.6c, 10.7c–e | 2 Ruína à beira-mar, 5 Entreposto do rio, 7 Gruta dos contrabandistas |
| **C — Cachoeira e cidade** | 10.5c–d, 10.6d, 10.7f–g, 10.8 | 3 Ravina noturna, 4 Porto à noite |

## Tarefas

| # | Tarefa | Tipo | Lote |
| --- | --- | --- | --- |
| 10.0a | Documento v6 | domínio | A |
| 10.0b | Exemplos: formato, construtor e galeria | dados + interface | A |
| 10.1a | Água: materiais, profundidade e leito | procedural | B |
| 10.1b | Água: superfície animada e espuma | render | B |
| 10.1c | Água: correnteza, cáusticas e Pixel | render | B |
| 10.1d | Água: objetos submersos e pincel de margem | render + interface | B |
| 10.2a | Maciço: material de relevo e assar com volume | procedural | A |
| 10.2b | Maciço: contorno vira escarpa que bloqueia | domínio + comando | A |
| 10.2c | Escarpa avulsa com lado baixo | render + interface | A |
| 10.3 | Sombra do sol nos exteriores | domínio + render | A |
| 10.4a | Materiais: gelo, neve com dunas, rocha rachada, cascalho | procedural | A |
| 10.4b | Materiais: paralelepípedo, lajes com grama, terra com sulcos, areia molhada | procedural | B |
| 10.5a | Acervo: inverno e rocha | receitas + coleção | A |
| 10.5b | Acervo: mata, ruína e margem | receitas + coleção | B |
| 10.5c | Acervo: porto e cidade | receitas | C |
| 10.5d | Acervo: estrada e estábulo | receitas | C |
| 10.5e | Acervo: caverna | receitas | A |
| 10.5f | Acervo: fundo da água e barcos pequenos | receitas | B |
| 10.6a | Bordas do mapa: nuvens, escuro, neblina | render + interface | A |
| 10.6b | Halo das luzes e raios no cone | render + interface | A |
| 10.6c | Presenças novas: sangue seco, fuligem, sulcos, algas | domínio + render | B |
| 10.6d | Cachoeira animada | render | C |
| 10.7a | Exemplo: Covil na caverna | exemplo | A |
| 10.7b | Exemplo: Desfiladeiro nevado | exemplo | A |
| 10.7c | Exemplo: Ruína à beira-mar | exemplo | B |
| 10.7d | Exemplo: Entreposto do rio | exemplo | B |
| 10.7e | Exemplo: Gruta dos contrabandistas | exemplo | B |
| 10.7f | Exemplo: Ravina noturna | exemplo | C |
| 10.7g | Exemplo: Porto à noite | exemplo | C |
| 10.8 | Validação da fase | e2e + relatório | C |

---

### 10.0a — Documento v6  ⬜
Objetivo: o documento aceita tudo o que a fase precisa, e os mapas antigos abrem iguais.
Depende de: —
Ler: `src/domain/mapa.ts`, `src/domain/migracoes.ts` (a 4 → 5 como modelo), `src/domain/validacao.ts`.
Arquivos: mudar `mapa.ts`, `migracoes.ts`, `validacao.ts`, `src/domain/fabrica.ts`; testes em `tests/unit/dominio.test.ts` (onde já estão os de migração).
Como:
1. `VERSAO_MAPA = 6` e os campos listados em "Decisões", com os tipos exatos de lá. `criarMapa` preenche `finish.edges = { kind: 'none', amount: 0 }` e `finish.glow = 0`; `novaLuz` põe `rays: false`; as paredes novas `drop: null`.
2. `de5para6`: camadas sem `flow` ganham `null`; paredes sem `drop`, `null`; luzes sem `rays`, `false`; o acabamento ganha `edges` e `glow`. Os presets de acabamento (`presets.ts`) ganham os dois campos neutros.
3. `validacao.ts`: `flow` (`angle` finito, `speed` de 0 a 3), `drop` só em `cliff` (em outro tipo é aviso, não erro), `source` com `roomId` ou `terrainLayerId`, `elevation` com `'underwater'`, `edges.kind` no conjunto e `amount`/`glow` de 0 a 1.
Não fazer: nada que leia os campos novos (render e interface ficam para as tarefas deles).
Testes: migração de um v5 completo (o da 7.7) para v6 com os padrões; ida e volta sem perder nada; validação rejeita `edges.kind` desconhecido e `glow` 2.
Pronto quando: `tsc` limpo, unitários e e2e passando sem mudar captura nenhuma.
Commit: document v6

### 10.0b — Exemplos: formato, construtor e galeria  ⬜
Objetivo: um exemplo gerado por script aparece na galeria e vira um mapa do mestre com um clique.
Depende de: 10.0a
Ler: `src/ui/Galeria.tsx` (`ATALHOS_DE_INICIO`), `src/app/app.ts` (`criarMapaNovo`, `navegar`), `src/app/tutoriais.ts` (`iniciarLicao`, para o padrão de criar e abrir), `src/domain/mapa.ts` (`duplicarParaNovaSessao`), `src/authoring/espalhar.ts`, `src/domain/celulas.ts`, `scripts/assar-colecao.ts` (Playwright).
Arquivos: criar `scripts/exemplos/kit.ts`, `scripts/exemplos/gerar.ts`, `scripts/exemplos/clareira.ts` (exemplo-semente pequeno), `src/app/exemplos.ts`, `tests/unit/exemplos-kit.test.ts`; mudar `src/ui/Galeria.tsx`, `package.json` (`"exemplos": "node scripts/exemplos/gerar.ts"`).
Como:
1. `kit.ts` (puro, importa só `src/domain` e `src/authoring`): um construtor fluente sobre um `MapaAtlas` com semente fixa: `pintar(material, forma)` onde `forma` é `{ disco }`, `{ poligono }`, `{ faixa: Ponto[], largura }` ou `{ celulas }`, rasterizado em `terrain.resolution` e acrescentado à camada daquele material (cria a camada se falta); `apagar(forma)`; `comodo(ret, preset)`, `parede(path, extra)`, `objeto(receitaOuAsset, pos, extra)`, `espalhar(conjunto, forma, densidade)` (usa `authoring/espalhar.ts` com semente), `luz(preset, pos, extra)`, `clima(presetId)`, `acabamento(presetId, extra)`. Todos os ids são derivados da semente (o mesmo script gera o mesmo JSON).
2. `gerar.ts`: importa a lista de exemplos (`{ id, nome, descricao, construir(kit) }`), gera cada documento, roda `validarMapa`, grava `public/exemplos/<id>.atlas.json` e `public/exemplos/indice.json` (`{ id, nome, descricao, tamanho, miniatura }[]`), e tira a miniatura (Playwright abre o mapa no app de `vite preview` com `?exemplo=<id>`, 640 × 360, webp em `public/exemplos/<id>.webp`).
3. `clareira.ts`: 30 × 20, grama, uma trilha de terra, seis árvores da coleção, uma fogueira com luz; serve de teste da cadeia até o primeiro exemplo de verdade.
4. `app/exemplos.ts`: `carregarIndiceDeExemplos()` (fetch de `exemplos/indice.json` com a mesma base de `render/url-da-colecao.ts`), `usarExemplo(id)` (fetch, `lerMapa`, `duplicarParaNovaSessao` com o nome do exemplo, `repo.salvar`, `navegar`).
5. Galeria: seção **Exemplos** (cartões com miniatura, nome, tamanho, "Usar este exemplo") abaixo dos atalhos de início; o atalho "Começar de um exemplo" rola até ela. Nada aparece se o índice falha (o app continua completo sem exemplos).
Não fazer: os exemplos reais (10.7); mudar o repositório.
Testes: unitário do kit (o mesmo script gera o mesmo JSON duas vezes; `pintar` com disco cobre as células certas; tudo valida). e2e: a galeria mostra a Clareira; "Usar" abre um mapa novo com as árvores e a fogueira; o exemplo publicado não muda.
Pronto quando: `npm run exemplos` gera a Clareira e ela abre pela galeria.
Commit: example maps in the gallery

### 10.1a — Água: materiais, profundidade e leito  ⬜
Objetivo: pintar água no terreno dá um leito que escurece com a profundidade, nos dois estilos.
Depende de: 10.0a
Ler: `src/procedural/materiais.ts` (`Material.uso`, `pintarMaterial`), `src/procedural/assar.ts` (`assarTerreno`), `src/procedural/estilos/materiais-pixel.ts`, `src/render/entradas.ts` (`chaveDoTerreno`).
Arquivos: mudar `materiais.ts`, `assar.ts`, `estilos/materiais-pixel.ts`; criar `src/procedural/profundidade.ts`, `tests/unit/profundidade.test.ts`.
Como:
1. `Material.uso` ganha `'agua'`; campos opcionais `raso`, `fundo`, `espuma` (cores) e `transparencia` (0 a 1). Materiais: `agua.mar` (azul-petróleo, espuma forte), `agua.lago` (azul-esverdeado), `agua.rio` (mais clara), `agua.gruta` (verde-turquesa, transparência 0,85), `agua.pantano` (verde-oliva turvo, transparência 0,2).
2. `profundidade.ts` (puro): dada a máscara binária de uma camada (W × H), a distância à margem em metros por transformada de distância de duas passadas (chamfer 3-4), saturada em `profundidadeMaxima` (3 m padrão).
3. `assarTerreno`: camada de água pinta o **leito**: o que está abaixo (camadas anteriores e base) continua visível e recebe a cor `raso → fundo` multiplicada pela profundidade (perto da margem quase só o leito; no fundo, a cor da água com `1 − transparencia`). Sem o aro escuro das outras camadas: a margem da água recebe uma faixa de areia molhada escurecida de 0,3 m.
4. O assar devolve também, para camadas de água, a textura de profundidade (canal R) e de margem (canal G = 1 a até 0,6 m da borda) numa tela à parte (`Assado.agua?`), em 2 px por metro. A chave do terreno inclui as camadas de água.
5. Pixel: leito em 3 faixas de cor por profundidade, borda em degraus.
Não fazer: animação (10.1b); interface nova (o pincel de terreno já lista os materiais por uso: conferir se mostra `agua`, e só ajustar o filtro).
Testes: distância de um quadrado 10 × 10 (centro = 5 células, borda = 1); `assarTerreno` com água devolve `agua` com as dimensões certas; chave muda ao mudar o `flow`.
Pronto quando: pintar `agua.lago` sobre `areia` mostra o fundo arenoso perto da margem e azul escuro no meio (captura no e2e).
Commit: water beds by depth

### 10.1b — Água: superfície animada e espuma  ⬜
Objetivo: a água se mexe: ondulação, brilho e espuma na margem.
Depende de: 10.1a
Ler: `src/render/cena.ts` (ordem de `raiz`), `src/render/presenca.ts` (shader com tempo, como modelo), `src/render/mapa-de-luz.ts`, `src/render/particulas.ts` (`FATOR_DE_MOVIMENTO_REDUZIDO`).
Arquivos: criar `src/render/agua.ts`; mudar `cena.ts`, `src/render/viewport.ts` (relógio).
Como: um `Container` entre `terrenoC` e `comodosC` com um sprite por mapa, o filtro lendo a textura `agua` do assar (R profundidade, G margem). O shader: duas camadas de ruído de normais rolando em direções diferentes (lenta), brilho especular fraco puxado pela cor do ambiente do clima, opacidade crescendo com a profundidade, espuma = faixas de ruído na zona G que vêm e vão (período 4 a 6 s) e espuma fixa em volta dos objetos que tocam a água (pedras, cascos: a máscara de objetos do terreno não existe; nesta tarefa só a margem). A luz do mapa multiplica por cima como em tudo.
Não fazer: correnteza e cáusticas (10.1c), Pixel (10.1c).
Testes: e2e com o lago da 10.1a: duas capturas com 1 s de diferença diferem na água e são iguais fora dela; com movimento reduzido a diferença cai.
Pronto quando: o lago ondula e a espuma bate na margem a 60 quadros por segundo num mapa de 50 × 35 m.
Commit: animated water surface

### 10.1c — Água: correnteza, cáusticas e Pixel  ⬜
Escopo (detalhar ao começar): `flow` desloca as normais e a espuma na direção e velocidade da camada; inspetor da camada de água com ângulo (gesto de seta no mapa) e velocidade; `agua.gruta` ganha cáusticas (rede de luz animada sobre o leito, mais forte no raso); Pixel: superfície em 4 quadros com faixas da paleta e espuma em pixels inteiros. Teste: espuma de um rio com `flow` anda no sentido certo.
Commit: water currents and caustics

### 10.1d — Água: objetos submersos e pincel de margem  ⬜
Escopo: `elevation: 'underwater'` desenha o objeto entre o leito e a superfície (com a cor da água por cima, pela profundidade no ponto); objetos `floor` dentro da água ganham anel de espuma (máscara de objetos na textura da água); o inspetor oferece "Submerso" quando o objeto está sobre água. Pincel de terreno com "suavizar margem" opcional para a água (borda mais redonda que a das outras camadas).
Commit: underwater props and foam rings

### 10.2a — Maciço: material de relevo e assar com volume  ⬜
Objetivo: pintar rocha de maciço dá uma massa de pedra com volume, estrias e sombra no chão, nos dois estilos.
Depende de: 10.0a
Ler: `src/procedural/assar.ts` (`assarTerreno`), `src/procedural/ruido.ts` (`fbm`, `valueNoise2D`), `src/procedural/materiais.ts`, `docs/referencias/exemplos/covil-na-caverna.png`, `desfiladeiro-nevado.png`, `gruta-dos-contrabandistas.png`.
Arquivos: mudar `materiais.ts`, `assar.ts`, `estilos/materiais-pixel.ts`; usar `profundidade.ts` da 10.1a se já existir (senão criá-lo aqui, com o mesmo contrato, e a 10.1a o reaproveita).
Como:
1. `uso: 'macico'`, com `topo` opcional (cor do topo, para neve): `rocha.cinza`, `rocha.caverna` (azul-acinzentada, das cavernas), `rocha.nevada` (topo branco), `rocha.arenito` (bege das falésias de costa).
2. No assar: altura = distância à borda (saturada em 1,5 m) → relevo por iluminação de um ponto de luz fixo a noroeste (diferença de altura vizinha), em 4 a 5 patamares com borda quebrada por ruído (o "facetado" das rochas das referências), estrias perpendiculares à borda nas faces, traço de nanquim nas quebras de patamar, e uma sombra de contato escura de 0,4 m para fora, sobre o que está embaixo. `rocha.nevada`: topo branco onde a altura passa de 70% e o ruído permite.
3. Pixel: 3 patamares em faixas da paleta, contorno de 1 px na borda externa.
Não fazer: bloquear visão (10.2b); sombra longa do sol (10.3).
Testes: unitário de que o maciço não ganha o aro escuro das camadas comuns e que a chave do terreno muda com o material.
Pronto quando: um anel de `rocha.caverna` em volta de `rocha.rachada` (ou `pedregulho` antes da 10.4a) parece uma caverna vista de cima (captura).
Commit: rock massifs with volume

### 10.2b — Maciço: contorno vira escarpa que bloqueia  ⬜
Objetivo: o maciço bloqueia movimento e visão por paredes comuns, geradas do contorno e editáveis.
Depende de: 10.2a
Ler: `src/domain/geometria.ts`, `src/domain/visibilidade.ts`, `src/state/comandos-construir.ts` (`terreno.pintar`, `parede.adicionar`), `src/authoring/malha.ts`.
Arquivos: criar `src/domain/contorno.ts`, `tests/unit/contorno.test.ts`; mudar o comando de pintar terreno e o render das paredes (`cena.ts`).
Como: `contornar(faixas, res): Ponto[][]` por marching squares + Douglas-Peucker (tolerância de meia célula do terreno), polígonos fechados. Ao gravar uma pincelada numa camada de uso `macico`, o comando recalcula as paredes `{ kind: 'cliff', source: { terrainLayerId } }` dessa camada (apaga as antigas da mesma origem, cria as novas, `blocks` tudo `true`, `drop: null`) num único passo do histórico. O render não desenha essas paredes no mapa (o assar já mostra a rocha); no editor, com a parede selecionada, mostra o traço.
Não fazer: escarpa avulsa (10.2c).
Testes: contorno de um anel dá dois polígonos; desfazer a pincelada desfaz as paredes; a visão de uma peça dentro da caverna para no maciço.
Commit: massifs block sight

### 10.2c — Escarpa avulsa com lado baixo  ⬜
Escopo: a ferramenta de parede ganha o tipo "Escarpa"; `kind: 'cliff'` com `drop` desenha uma face de rocha (faixa de largura proporcional a `height`, estrias, patamares) do lado baixo, com sombra de contato; o inspetor troca o lado com um botão; a escarpa bloqueia movimento e não bloqueia visão de quem está em cima (decidir ao detalhar: `blocks.sight` editável, padrão `false`). Pixel: face em 2 faixas. Serve à crista do Desfiladeiro e aos patamares da Ravina.
Commit: cliff walls with a low side

### 10.3 — Sombra do sol nos exteriores  ⬜
Escopo: função pura `sombraDoSol(clima) → { direcao, comprimentoPorMetro, cor, alfa }` (hora → elevação, `sun.angle` → direção; noite: sem sombra de sol); camada de sombras entre terreno/água e objetos que desenha, para cada objeto `castsShadow` fora de cômodo com telhado, a silhueta da textura assada, escurecida e esticada na direção do sol pela altura (o maior `z` da descrição, ou `altura` da receita/coleção quando houver); mesma coisa para maciços (pela altura do patamar) e escarpas (`height`). Cor azulada na neve (cor do ambiente). Pixel: silhueta em bloco, 1 faixa. Teste puro de `sombraDoSol` (meio-dia curta, 8h longa, 23h nenhuma).
Commit: sun shadows outdoors

### 10.4a — Materiais: gelo, neve com dunas, rocha rachada, cascalho  ⬜
Escopo: padrões novos em `materiais.ts` e no Pixel: `gelo` (azul translúcido, rachaduras em rede, reflexo branco em faixas), `neve.funda` (dunas de vento: linhas onduladas com sombra azul de um lado, sulcos de trilha), `rocha.rachada` (piso de caverna: placas de Voronoi com fendas escuras e manchas), `cascalho`. Captura de cada um ao lado do recorte da referência.
Commit: ice, deep snow and cracked rock

### 10.4b — Materiais: paralelepípedo, lajes com grama, terra com sulcos, areia molhada  ⬜
Escopo: `paralelepipedo` (pedras arredondadas irregulares, Voronoi, rejunte escuro), `lajes.gramadas` (lajes grandes com grama e musgo nas juntas, algumas faltando), `terra.sulcos` (estrada com duas trilhas de roda; os sulcos seguem a orientação dominante da camada), `areia.molhada`.
Commit: cobbles, grassy flagstones and rutted dirt

### 10.5a — Acervo: inverno e rocha  ⬜
Escopo: geradores pesados `pinheiro-nevado` (3 e 4 m) e `arvore-nevada` (copa redonda coberta: pompons brancos com sombra azul, como as referências), `arbusto-seco` (galhos finos ramificados, inverno), `rochedo` (receita com tamanho 1,5 a 4 m, facetado, variantes com musgo e com neve), `seixos` (aglomerado), `trenó`, `galho-seco`. Entram na coleção (`npm run assar`) os de gerador pesado; na Biblioteca, as tags `inverno` e `rocha`.
Commit: winter trees and boulders

### 10.5b — Acervo: mata, ruína e margem  ⬜
Escopo: `carvalho-grande` (copa densa de folhas recortadas, 6 a 8 m), `folhagem-tropical` (arbusto de folhas largas, escuro), `tufo-de-grama`, `junco`, `vitoria-regia` (e flor), `raiz-exposta`; ruína: `mureta-de-pedra` (receita com largura, blocos irregulares, pode faltar pedaço), `coluna-arruinada` (com esfera), `coluna-caida`, `circulo-runico` (entalhe no chão, raios param.), `escombros` (pedras e pó escuro), `viga-partida`, `tabua-solta`.
Commit: woodland and ruin kit

### 10.5c — Acervo: porto e cidade  ⬜
Escopo: `navio` (casco de cima com proa, convés de tábuas, 2 ou 3 mastros, escotilha, gradil; comprimento 14 a 30 m), `barcaca`, `guindaste-de-cais`, `cais-segmento` (passarela de tábuas com estacas; comprimento e largura), `estaca`, `barraca-de-feira` (toldo listrado em 4 cores), `caixote`, `pilha-de-caixotes`, `barril`, `pilha-de-barris`, `sacos`, `rede-de-pesca`, `ancora`, `rolo-de-corda`, `lanterna-de-poste`.
Commit: harbor kit

### 10.5d — Acervo: estrada e estábulo  ⬜
Escopo: `carroca` (vazia e carregada, com varais), `cavalo` (pardo, branco, preto, malhado; de pé, de cima, com crina e cauda), `fardo-de-feno`, `bebedouro`, `carrinho-de-mao`, `carrinho-de-carga` (o do deque).
Commit: road and stable kit

### 10.5e — Acervo: caverna  ⬜
Escopo: `ossada` (esqueleto de quadrúpede deitado, variantes), `cranio-animal`, `pilha-de-ossos`, `pilha-de-peles` (peles com manchas e listras sobrepostas), `buraco` (fosso escuro com borda quebrada; bloqueia movimento), `estalagmite`, `arvore-morta-caida` (tronco com galhos secos).
Commit: cave kit

### 10.5f — Acervo: fundo da água e barcos pequenos  ⬜
Escopo: `coral` (couve-flor rosada e lilás), `ourico`, `anemona`, `alga`, `rocha-submersa`, `barco-a-remo`, `barco-de-vela` (com flutuador, vela recolhida), `bote-com-carga`. Todos com `elevation` padrão certo (o fundo é `underwater`).
Commit: seabed and small boats

### 10.6a — Bordas do mapa: nuvens, escuro, neblina  ⬜
Escopo: `finish.edges` desenhado pela neblina (`neblina.ts`): `clouds` (nuvens brancas volumosas que avançam das bordas e derivam com o vento, como no Desfiladeiro), `dark` (vazio negro com borda de ruído, para cavernas), `fog` (neblina cinza); `amount` = quanto entra. Controle no inspetor do acabamento. Pixel: blocos de 2 px.
Commit: map edge clouds and darkness

### 10.6b — Halo das luzes e raios no cone  ⬜
Escopo: `finish.glow` acrescenta um halo aditivo suave em volta das luzes acesas (tochas, postes), acima das peças e abaixo da névoa; `Luz.rays` desenha raios animados de leve dentro do cone (feixe da caverna, boca da gruta). Inspetor: "Halo" no acabamento, "Raios visíveis" na luz com cone. Pixel: halo em 2 faixas, raios em listras de 1 px.
Commit: light glow and visible rays

### 10.6c — Presenças novas: sangue seco, fuligem, sulcos, algas  ⬜
Escopo: pincéis no pacote `natural`: `sangue-seco` (marrom-avermelhado, sem brilho, em manchas arrastadas), `fuligem` (preto queimado), `sulcos` (trilhas paralelas, para estrada e neve), `algas` (verde no fundo da água; desenhado sob a superfície). O `escala` e a forma do ruído por pincel (arrastado ou manchado) entram no shader de presença.
Commit: dried blood, soot, ruts and algae

### 10.6d — Cachoeira animada  ⬜
Escopo: `Receita.animacao?: 'cachoeira'` no catálogo; a receita `cachoeira` (largura, queda) assa a rocha e a borda; a cena acrescenta por cima listras de água descendo (shader com ruído rolando no eixo da queda), névoa no pé (neblina local) e espuma que se espalha na água de baixo. Pixel: 4 quadros.
Commit: animated waterfalls

### 10.7a a 10.7g — Os exemplos  ⬜
Escopo comum (detalhar ao começar o lote, contra a referência e o acervo do momento): o script `scripts/exemplos/<id>.ts` com a composição da tabela "Os sete exemplos"; clima e acabamento próprios (com 2 ou 3 climas salvos no mapa: ex. o Porto à noite e ao amanhecer, o Desfiladeiro em nevasca); luzes, regiões de revelação e, onde couber, uma região de áudio; notas do mestre com uma frase de gancho. Captura em `test-results/fase10-<id>.png` lado a lado com a referência, mostrada ao usuário antes de marcar ✅; ajustes de acervo descobertos aqui voltam como nota na ficha do acervo.
Commits: `example: snowy pass`, `example: cave den`, `example: seaside ruin`, `example: river trading post`, `example: smugglers' cove`, `example: night ravine`, `example: night harbor`.

### 10.8 — Validação da fase  ⬜
Escopo: e2e `fase 10`: cada exemplo abre pela galeria, roda em Sessão com uma peça andando (névoa e visão respeitam maciço e escarpa), troca para Pixel e volta, troca de clima; medição de quadros por segundo no Porto (o maior) nos dois estilos; relatório no `progress.md` com as capturas lado a lado.
Commit: validate phase 10
