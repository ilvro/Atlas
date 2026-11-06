# Fase 10 — Mundo lá fora: mapas de exemplo

"Sete mapas que mostram do que o Atlas é capaz." O usuário trouxe sete mapas feitos no Inkarnate como alvo de qualidade (cópias só para consulta em `docs/referencias/exemplos/`, fora do git e do build). A fase entrega esses sete como **exemplos da galeria**, feitos com o próprio Atlas: documentos comuns, editáveis, sem nenhuma imagem pronta de mapa.

Critério de pronto da fase: os sete exemplos abrem pela galeria ("Começar de um exemplo"), funcionam em Construir e em Sessão, nos dois estilos (Ilustrado e Pixel), com climas próprios; a captura de cada um, lado a lado com a referência, mostra a mesma composição, a mesma ambientação e o mesmo nível de acabamento.

Planejado em 5 de novembro de 2026 contra o código do fim da Fase 9. As fichas do lote A e as de 10.1a–b estão detalhadas; as outras têm escopo fechado e são **detalhadas ao começar o lote** (o código dos lotes anteriores muda o que elas tocam).

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

## Quem faz

- **Sonnet:** as features e o acervo (10.0 a 10.6), uma ficha por sessão, como nas fases anteriores.
- **Opus:** os sete exemplos (10.7a a 10.7g) e a validação (10.8). Ao começar cada lote, o Opus também detalha as fichas do lote contra o código do momento.

## Lotes

A fase é entregue em três lotes; cada um termina com exemplos prontos e mostrados ao usuário antes do seguinte.

| Lote | Tarefas | Exemplos que fecham |
| --- | --- | --- |
| **A — Rocha, neve e sombra** | 10.0a–b, 10.2a–c, 10.3, 10.4a, 10.5a, 10.5e, 10.6a–b, 10.7a, 10.7b | 1 Desfiladeiro nevado, 6 Covil na caverna |
| **B — Água** | 10.1a–d, 10.4b, 10.5b, 10.5c, 10.5d, 10.5f, 10.6c, 10.7c–e | 2 Ruína à beira-mar, 5 Entreposto do rio, 7 Gruta dos contrabandistas |
| **C — Cachoeira e cidade** | 10.6d, 10.7f–g, 10.8 | 3 Ravina noturna, 4 Porto à noite |

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
| 10.5c | Acervo: porto e cidade | receitas | B |
| 10.5d | Acervo: estrada e estábulo | receitas | B |
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

### 10.0a — Documento v6  ✅
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
Nota: `drop` fora de uma escarpa é aceito sem aviso (o validador não tem canal de avisos; o render o ignora). `misturar` (clima.ts) e `PAREDE_PADRAO` também ganharam os campos novos para os tipos fecharem; `parede.adicionar` passou a exigir `drop`. A migração também cobre o `finish` dos climas salvos (`customClimates`).

### 10.0b — Exemplos: formato, construtor e galeria  ✅
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
Nota: a miniatura sai do servidor de desenvolvimento do Vite (como `npm run assar`), não do `vite preview` com `?exemplo=<id>`: o script grava o mapa no repositório do navegador de teste e abre `#/mapa/<id>`, sem rota nova no app. `espalhar` (authoring) ganhou o campo opcional `densidade` no pedido, para o kit trocar a densidade do conjunto. O kit também ganhou `presenca`, `peca`, `porta`, `estilo`, `fundo`, `notas`, `montarExemplo` e o tipo `Exemplo` (com tamanho e semente); a lista dos exemplos fica em `gerar.ts` (`EXEMPLOS`). `npm run exemplos -- --sem-miniatura` gera só os JSON.

### 10.1a — Água: materiais, profundidade e leito  ✅
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
Nota: o leito vive em `src/procedural/agua.ts` (puro: `leitoDaAgua`, `texturaDeAgua`); `assarTerreno` só o liga. Cores `raso`/`fundo`/`espuma`/`transparencia` nos cinco materiais (`agua.gruta` 0,85). Ilustrado: tinge o que está embaixo de `raso` a `fundo` (alfa de 0,14 até `1 − transparencia` pela profundidade, com ruído) e escurece 0,3 m de terra em volta (areia molhada); Pixel: três faixas (0,5 m e 1,5 m), a mais rasa vazada em xadrez, e margem de 2 px. `Assado.agua` (e `ResultadoDeBake.agua`, transferido pelo worker) é a textura de 2 px/m: R profundidade (0 a 3 m), G margem (1 na borda, rampa até 0,6 m), B índice da camada de água (`(i+1)×50`, até 4 camadas). A chave do terreno inclui o `flow`. Os cinco materiais aparecem no pincel de terreno. Testes: `tests/unit/agua.test.ts` e `tests/e2e/fase10-agua.test.ts` (captura em `test-results/fase10-agua.png`).

### 10.1b — Água: superfície animada e espuma  ✅
Objetivo: a água se mexe: ondulação, brilho e espuma na margem.
Depende de: 10.1a
Ler: `src/render/cena.ts` (ordem de `raiz`), `src/render/presenca.ts` (shader com tempo, como modelo), `src/render/mapa-de-luz.ts`, `src/render/particulas.ts` (`FATOR_DE_MOVIMENTO_REDUZIDO`).
Arquivos: criar `src/render/agua.ts`; mudar `cena.ts`, `src/render/viewport.ts` (relógio).
Como: um `Container` entre `terrenoC` e `comodosC` com um sprite por mapa, o filtro lendo a textura `agua` do assar (R profundidade, G margem). O shader: duas camadas de ruído de normais rolando em direções diferentes (lenta), brilho especular fraco puxado pela cor do ambiente do clima, opacidade crescendo com a profundidade, espuma = faixas de ruído na zona G que vêm e vão (período 4 a 6 s) e espuma fixa em volta dos objetos que tocam a água (pedras, cascos: a máscara de objetos do terreno não existe; nesta tarefa só a margem). A luz do mapa multiplica por cima como em tudo.
Não fazer: correnteza e cáusticas (10.1c), Pixel (10.1c).
Testes: e2e com o lago da 10.1a: duas capturas com 1 s de diferença diferem na água e são iguais fora dela; com movimento reduzido a diferença cai.
Pronto quando: o lago ondula e a espuma bate na margem a 60 quadros por segundo num mapa de 50 × 35 m.
Commit: animated water surface
Nota: `render/agua.ts` é uma malha própria (como a presença) com o shader lendo a textura `agua`, num container entre o terreno e as escarpas; `cena.aguaAtiva()`/`viewport.aguaAtiva()` servem aos testes. Ondas = duas camadas de ruído com normais por diferença finita, brilho especular na direção do sol do clima, sombras de ondulação, espuma em faixas que avançam e recuam na zona da margem (~5 s). Movimento reduzido usa o mesmo fator das partículas (0,35). Os 60 quadros por segundo não foram medidos (só a diferença entre capturas).

### 10.1c — Água: correnteza, cáusticas e Pixel  ✅
Escopo (detalhar ao começar): `flow` desloca as normais e a espuma na direção e velocidade da camada; inspetor da camada de água com ângulo (gesto de seta no mapa) e velocidade; `agua.gruta` ganha cáusticas (rede de luz animada sobre o leito, mais forte no raso); Pixel: superfície em 4 quadros com faixas da paleta e espuma em pixels inteiros. Teste: espuma de um rio com `flow` anda no sentido certo.
Commit: water currents and caustics
Nota: comando novo `terreno.correnteza` (material, `flow` ou `null`; valida 0 a 3 m/s e só água), no painel do pincel de terreno quando o material é água: velocidade, direção em graus (0° leste, horário) e oito setas. **Desvio da ficha:** não há o gesto de seta no mapa (só campos e botões). A camada de água é uma por material (`t_<material>`): dois corpos d'água do mesmo material compartilham a correnteza. No shader, `flow` desloca o domínio das normais, da espuma da margem e de fiapos de espuma esticados no sentido da corrente; `agua.gruta` (`causticas: true` no material) ganha a rede de luz, mais forte no raso. Pixel: coordenada arredondada ao pixel do Pixel, 4 quadros por ciclo de ~1,2 s, espuma/brilho/rede em cor chapada e alfa 0 ou 1 (a paleta do mapa faz o resto). Teste de direção: deslocamento dos pixels claros entre duas capturas (+ para 0 rad, − para π rad).

### 10.1d — Água: objetos submersos e pincel de margem  ✅
Escopo: `elevation: 'underwater'` desenha o objeto entre o leito e a superfície (com a cor da água por cima, pela profundidade no ponto); objetos `floor` dentro da água ganham anel de espuma (máscara de objetos na textura da água); o inspetor oferece "Submerso" quando o objeto está sobre água. Pincel de terreno com "suavizar margem" opcional para a água (borda mais redonda que a das outras camadas).
Commit: underwater props and foam rings
Nota: objetos `underwater` vão para um container entre o leito e a superfície e são tingidos pela cor do fundo e esmaecidos pela profundidade no ponto (lida de uma cópia da textura `agua` na CPU; no Pixel, três degraus e sem alfa); o Inspetor mostra "Submerso" quando o objeto de piso está sobre água (`domain/agua.ts`: `aguaEm`) e ao submergir tira a sombra. O anel de espuma vem de uma máscara de objetos de piso fora de cômodos (elipse da pegada, na grade de 2 px/m), refeita quando os objetos mudam. "Suavizar a margem" (pincel de terreno, só água) é `suavizar: true` no `terreno.pintar`: média numa janela de 3 células na caixa da pincelada, mantida onde passa de 50% (as células viram o dado; nada novo no documento).

### 10.2a — Maciço: material de relevo e assar com volume  ✅
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
Nota: o relevo vive em `src/procedural/macico.ts` (puro, testável sem canvas) e o `assarTerreno` só o liga; `profundidade.ts` foi criado aqui (`distanciaAMargem(mascara, w, h, res, maximo)`, fora da imagem conta como dentro). Os maciços entram na lista do pincel de terreno (`Biblioteca.tsx`). Revisão: sem rede de rachaduras (só poucas fendas, Voronoi de 1,6 m torcido); borda e quebras em lóbulos grandes (ruído de ~0,7 m, sem serrilhado fino); a neve de `rocha.nevada` segue o relevo (patamares altos e faces ao sol, sombra `#b8c8dc`, rocha aparecendo em estrias); o pé da parede escurece até quase negro e a sombra de contato é suave nos dois lados, de 0,6 m (`SOMBRA_DE_CONTATO`). As estrias vêm de ruído borrado ao longo da encosta, sem coordenada tangente. O Pixel só mudou de leve (os patamares passaram a seguir lóbulos). A captura (anel de `rocha.caverna` sobre `rocha.rachada` com vazio além, `rocha.nevada` sobre `neve.funda`, `rocha.arenito` sobre `grama`, Ilustrado e Pixel) sai de `tests/e2e/fase10-macico.test.ts`.

### 10.2b — Maciço: contorno vira escarpa que bloqueia  ✅
Objetivo: o maciço bloqueia movimento e visão por paredes comuns, geradas do contorno e editáveis.
Depende de: 10.2a
Ler: `src/domain/geometria.ts`, `src/domain/visibilidade.ts`, `src/state/comandos-construir.ts` (`terreno.pintar`, `parede.adicionar`), `src/authoring/malha.ts`.
Arquivos: criar `src/domain/contorno.ts`, `tests/unit/contorno.test.ts`; mudar o comando de pintar terreno e o render das paredes (`cena.ts`).
Como: `contornar(faixas, res): Ponto[][]` por marching squares + Douglas-Peucker (tolerância de meia célula do terreno), polígonos fechados. Ao gravar uma pincelada numa camada de uso `macico`, o comando recalcula as paredes `{ kind: 'cliff', source: { terrainLayerId } }` dessa camada (apaga as antigas da mesma origem, cria as novas, `blocks` tudo `true`, `drop: null`) num único passo do histórico. O render não desenha essas paredes no mapa (o assar já mostra a rocha); no editor, com a parede selecionada, mostra o traço.
Não fazer: escarpa avulsa (10.2c).
Testes: contorno de um anel dá dois polígonos; desfazer a pincelada desfaz as paredes; a visão de uma peça dentro da caverna para no maciço.
Commit: massifs block sight
Nota: `contornar(faixas, res, { tolerancia, limite, recuo })` ganhou opções: o contorno é traçado 1 célula (0,25 m) para dentro da rocha (medi a borda visível do assar em discos: ela oscila entre -0,46 e +0,48 m do contorno cru, mediana 0, p5 -0,24 m; com o recuo a parede fica dentro da rocha em ~95% da borda e no máximo ~0,7 m dentro nas saliências), e a rocha que encosta no limite do mapa gera linha aberta, sem parede em volta do mapa. A função de domínio é `atualizarEscarpasDoMacico(m, camadas?)` (`src/domain/contorno.ts`), chamada por `terreno.pintar`/`terreno.apagar` só nas camadas cujas células mudaram (e pelo `Kit.construir`, que cobre os exemplos); paredes de camadas que sumiram saem com as aberturas e objetos presos a elas. `recalcularParedes` deixou de apagar as paredes `terrainLayerId` (só as `roomId`). As escarpas geradas têm altura 3 m, espessura 0,2 m e o material da camada; `parede.remover` nelas pede desanexar antes (mensagem própria). Aberturas postas numa escarpa gerada se perdem quando a pincelada refaz o contorno (ids novos). Não há comando de trocar o material de uma camada: pintar outro material por cima já passa pelo mesmo recálculo. Recálculo medido: ~4–6 ms num maciço de borda irregular em volta de 60 × 40 m (0,25 m).

### 10.2c — Escarpa avulsa com lado baixo  ✅
Objetivo: desenhar uma escarpa com a ferramenta de parede dá uma face de rocha do lado baixo, que bloqueia o passo e deixa ver de cima.
Depende de: 10.0a, 10.2a (reaproveita o desenho de rocha)
Ler: `src/render/cena.ts` (`desenharParede`, linhas ~180–205, e como `low`/`fence` são desenhadas), `src/ui/Biblioteca.tsx` (os `tipos` do pincel de parede, linha ~90), `src/ui/Inspetor.tsx` (campo "Tipo" da parede, linha ~426, que já tem "Penhasco"), `src/domain/visibilidade.ts` (`oclusores`), `src/procedural/assar.ts` (o maciço da 10.2a).
Arquivos: criar `src/procedural/escarpa.ts`, `tests/unit/escarpa.test.ts`; mudar `cena.ts`, `Biblioteca.tsx`, `Inspetor.tsx`, `visibilidade.ts` (se preciso), `src/procedural/executar.ts` e `src/render/entradas.ts` (pedido de bake novo).
Como:
1. Pincel de parede: quarto tipo `{ tipo: 'cliff', nome: 'Escarpa', desc: 'Rocha em degrau: bloqueia o passo; de cima se vê embaixo' }`. Parede nova de tipo `cliff` nasce com `drop: 'b'`, `height: 3`, `thickness: 0.4`, `blocks: { move: true, sight: false, light: false }`, material `rocha.cinza`. No Inspetor, "Penhasco" vira "Escarpa"; com `cliff` aparecem "Lado baixo" (botão que troca `a`/`b`, com seta no mapa enquanto a parede está selecionada), "Altura" (0,5 a 12 m) e "Rocha" (materiais de uso `macico`).
2. `escarpa.ts` (procedural, sem Pixi): `descreverEscarpa(path, drop, altura, material, seed)` → uma tela assada como a do terreno: a **face** é uma faixa do lado `drop` com largura `0,35 × altura` (mín. 0,4 m), quebrada em 3 patamares com borda de ruído, estrias perpendiculares ao caminho, aresta clara no topo e traço de nanquim; uma **sombra de contato** de 0,5 m no pé da face. Material `rocha.nevada` põe neve na aresta. Pixel: 2 faixas da paleta + contorno de 1 px.
3. A cena assa as escarpas como entradas próprias (chave = estilo + caminho + drop + altura + material + seed) num container logo acima do terreno (abaixo dos cômodos); a linha de parede comum deixa de ser desenhada para `cliff` com `source: null`. As de `source: { terrainLayerId }` (10.2b) seguem invisíveis.
4. Visão: `oclusores` já respeita `blocks.sight`; conferir que `cliff` com `sight: false` não corta a visão nem a luz (`light: false`).
5. Ajuste herdado da revisão da 10.2a: o pé escuro da face e a sombra de contato do maciço passam a ser por material (campo opcional `pe` em `Material`, de 0 a 1): forte em `rocha.caverna` (como hoje), leve em `rocha.cinza`, `rocha.nevada` e `rocha.arenito` (hoje o arenito sobre grama ganha um halo escuro pesado demais).
Não fazer: sombra longa do sol (10.3); "subir" e "descer" com regras de altura para peças.
Testes: unitário de que a face fica do lado certo (`drop: 'a'` e `'b'` num segmento horizontal: a caixa da tela fica acima ou abaixo); chave muda com `drop`. e2e: desenhar uma escarpa com o pincel, trocar o lado no inspetor e ver a face mudar de lado (captura); uma peça não atravessa, mas a névoa revela do outro lado.
Pronto quando: a crista em "C" do Desfiladeiro pode ser feita com três escarpas e parece rocha, não uma linha.
Commit: cliff walls with a low side
Nota: `escarpa.ts` tem `caixaDaEscarpa`, `sombrearEscarpa` (puro) e `assarEscarpa`; o caminho vai relativo ao 1º ponto (mover a parede não refaz o desenho) e a semente sai do id da parede. O lado `a` é o da normal `(-ty, tx)`, o mesmo de `swing: 'a'` das portas (num segmento da esquerda para a direita, `a` é para baixo na tela). Há um lábio claro de 0,12 m do lado alto. Parede `cliff` antiga (`drop: null`, material de parede) desenha com lado `b` e `rocha.cinza`. Ao trocar o tipo para Escarpa no Inspetor, o patch já põe lado, rocha e `sight/light: false`. `pe` (0 a 1, padrão 1): caverna 1, cinza e nevada 0,35, arenito 0,25; escala o pé escuro e a sombra de contato (no Pixel, faixa de 1 px abaixo de 0,5). Capturas: `test-results/fase10-escarpa.png` (C com três escarpas, 3 rochas, 2 estilos) e `fase10-escarpa-a/b.png` (`tests/e2e/fase10-escarpa.test.ts`). `oclusores` não precisou mudar.

### 10.3 — Sombra do sol nos exteriores  ✅
Objetivo: de dia, árvores, rochas e escarpas lançam sombra longa na direção oposta ao sol, que encurta ao meio-dia e some à noite.
Depende de: 10.0a, 10.2a, 10.2c
Ler: `src/domain/clima.ts` (`ehNoite`, hora), `src/domain/mapa.ts` (`Clima.sun`, `Objeto.castsShadow`), `src/render/cena.ts` (`sincronizarObjetos`, como cada objeto vira sprite a partir da textura assada), `src/render/telhados.ts` (cômodo com telhado), `src/procedural/descricao.ts` (`Parte.z`), `src/procedural/colecao.ts` (`ItemDaColecao`), `src/procedural/receitas/comum.ts` (`Receita`).
Arquivos: criar `src/domain/sol.ts`, `src/render/sombras-do-sol.ts`, `tests/unit/sol.test.ts`; mudar `cena.ts`, `comum.ts` (`altura?`), `colecao.ts` (`altura?`), `scripts/assar-colecao.ts` (grava `altura` = maior `z`).
Como:
1. `sol.ts` (puro): `sombraDoSol(clima: Clima): null | { dir: Ponto; porMetro: number; alfa: number; cor: string }`. Elevação pela hora (`time`): 0 antes das 6h e depois das 18h30 (devolve `null`), máxima às 12h30; `porMetro = clamp(1 / tan(elevacao), 0.25, 4)`; `dir` = vetor unitário oposto a `sun.angle` (radianos, 0 = sol vindo do leste; conferir a convenção que `sun.angle` já usa no código e documentá-la); `alfa = 0,45 × sun.intensity × (1 − fog)`; `cor` = a cor do ambiente escurecida a 35% (na neve fica azulada sozinha, porque o ambiente do preset `neve` é azul-claro). `sun: null` → `null`.
2. Altura de cada coisa: `Receita.altura?` e `ItemDaColecao.altura?` (m); sem elas, o maior `z` das partes, saturado em 12. O script de assar grava `altura` nos itens gerados (rodar `npm run assar` só para preencher, sem mudar imagens).
3. `sombras-do-sol.ts`: um `Container` logo acima do terreno (e da água, quando existir) e abaixo dos objetos. Para cada objeto com `castsShadow` e `elevation: 'floor'`, fora de cômodo com telhado visível: um `Sprite` com a **mesma textura** do objeto, `tint` na cor da sombra, `alpha` da sombra, com a transformação de cisalhamento que estica a silhueta na direção `dir` por `altura × porMetro` (base fixa no pé do objeto; aproximação: escala no eixo do sol + deslocamento de metade do comprimento) e um `BlurFilter` leve compartilhado. Escarpas: polígono da face estendido `height × porMetro` para o lado baixo. Maciços: a tela de sombra do maciço (silhueta deslocada `1,5 m × porMetro`) feita no mesmo assar da 10.2a como camada à parte.
4. Atualiza quando muda `climate`, `props` ou a textura do objeto chega; nada por quadro.
5. Pixel: sem blur, `alpha` 1 com a cor da faixa mais escura do ambiente, silhueta arredondada ao pixel do Pixel.
Não fazer: sombra das paredes dos cômodos (as caixas já têm a delas); sombra dentro de casa.
Testes: `sol.test.ts`: 12h30 curta (`porMetro` ≤ 0,5), 8h longa (≥ 2), 23h `null`, `sun: null` `null`; direção oposta ao sol. e2e: árvore da coleção no mapa às 8h e às 12h30: a área escura em volta é maior às 8h (contagem de pixels escuros na captura).
Pronto quando: os pinheiros do Desfiladeiro às 9h têm sombras longas e azuladas, todas para o mesmo lado.
Commit: sun shadows outdoors
Nota: convenção de `sun.angle` documentada em `sol.ts`: posição no arco do dia (0 = nasce a leste, π = põe a oeste); o sol fica na direção `(cos a, −sin a)` e a sombra cai em `(−cos a, sin a)` (de manhã para oeste, ao meio-dia para baixo na tela). A elevação é `70° × sin(…)^1,5` entre 6h e 18h30 (8h → ~2,3 m de sombra por metro; 12h30 → 0,36). O `z` das partes das plantas é ordem de desenho (copa de 3 m e de 7 m têm o mesmo `z`), então `GeradorPesado.altura?(pegada)` dá a altura real: árvore 1,6 × diâmetro, pinheiro 2 ×, arbusto 0,5 ×; o resto usa o maior `z`. `ACERVO.alturaDaFonte` resolve receita e item (sem `altura`: maior `z`, ou maior lado da pegada), no máximo 12 m; `npm run assar` gravou `altura` nos 8+ itens gerados sem regravar imagens. Em vez de um filtro por sprite, todas as sombras ficam num container com um `ColorMatrixFilter` (achata numa cor) e um `BlurFilter` (só no Ilustrado), com o alfa no container: sombras que se cruzam não escurecem em dobro. Maciços: em vez de assar uma tela de sombra no terreno, a cena contorna as camadas de rocha (`contornar`) e varre o contorno por `1,5 m × porMetro`, apagando a própria rocha (`blendMode: 'erase'`). Escarpas avulsas: o corte da crista varrido `height × porMetro`, só quando o sol está do lado alto. Objetos com `roomId` ficam sem sombra. Capturas: `test-results/fase10-sombras-9h.png`, `fase10-sombra-08h.png`, `fase10-sombra-12h30.png` (`tests/e2e/fase10-sombras.test.ts`; 8h tem 1,7× mais pixels escuros que 12h30).

### 10.4a — Materiais: gelo, neve com dunas, rocha rachada, cascalho  ✅
Objetivo: quatro materiais de terreno que as cenas de inverno e de caverna pedem, nos dois estilos.
Depende de: —
Ler: `src/procedural/materiais.ts` (`Padrao`, `MATERIAIS`, `pintarMaterial` e os casos `neve`, `pedra`, `laje`), `src/procedural/ruido.ts`, `src/procedural/estilos/materiais-pixel.ts`, `tests/unit/materiais-pixel.test.ts`; recortes de `docs/referencias/exemplos/desfiladeiro-nevado.png` (lago à direita, neve no centro) e `covil-na-caverna.png` (chão).
Arquivos: mudar `materiais.ts`, `estilos/materiais-pixel.ts`; criar `src/procedural/voronoi.ts`, `tests/unit/voronoi.test.ts`.
Como:
1. `voronoi.ts` (puro): `celulasDeVoronoi(area, tamanhoMedio, seed)` → sítios com jitter numa grade (determinístico) e, para um ponto, a distância à borda mais próxima (F2 − F1). Usado pela rocha rachada agora e pelo paralelepípedo na 10.4b.
2. Padrões novos (`Padrao`): `gelo`, `dunas`, `rachado`, `cascalho`. Materiais (uso `terreno`):
   - `gelo` (base `#9cc7e0`, escuro `#5d93b8`, claro `#e8f6ff`): manchas grandes de ruído entre base e escuro (o "fundo" visto pelo gelo), rachaduras longas (polilinhas aleatórias que se ramificam, traço claro de 1,5 px com um fio escuro ao lado), estrias brancas finas em diagonal e pontos de reflexo.
   - `neve.funda` (padrão `dunas`; base `#eef3f8`, escuro `#b9c8da`, claro `#ffffff`): a neve de hoje mais linhas onduladas longas (ruído em uma direção) com sombra azul de um lado e luz do outro, a cada 2 a 4 m.
   - `rocha.rachada` (padrão `rachado`; base `#5f6872`, escuro `#2b3138`, claro `#8d98a3`): placas de Voronoi de 0,3 a 0,6 m com fendas escuras (F2 − F1 pequeno), cada placa com tom levemente diferente e manchas de ruído.
   - `cascalho` (base `#7a756c`): muitas pedrinhas (elipses de 2 a 6 cm) com luz e sombra sobre terra escura.
3. Pixel: `gelo` em 3 tons com rachaduras de 1 px; `dunas` em faixas de 2 tons; `rachado` com fendas de 1 px; `cascalho` em pontos de 1 px.
Não fazer: água (10.1); mudar os materiais que existem.
Testes: `voronoi.test.ts` (mesma semente, mesmo resultado; F2 − F1 ≥ 0); os testes que percorrem `MATERIAIS` passam; no Pixel, cada material novo tem no máximo 6 cores numa amostra de 64 × 64.
Pronto quando: uma captura com os quatro lado a lado, a 64 px/m, mostra gelo com rachaduras, neve com dunas, chão de caverna rachado e cascalho (anexar em `test-results/fase10-materiais-a.png`).
Commit: ice, deep snow and cracked rock
Nota: os padrões Ilustrados são pintados pixel a pixel (`porPixel`, com `voronoi.ts` e ruído) em vez de formas soltas, para dar volume e caber em áreas grandes; as rachaduras do gelo são polilinhas por cima. A contagem de cores do Pixel (≤ 6) e a captura estão num e2e novo (`tests/e2e/fase10-materiais.test.ts`), pois o teste unitário não tem canvas. Cascalho: semieixos de 3 a 6,5 cm. `ladrilhoDeRuido` (ruido.ts) agora é periódico de verdade (cada oitava dá a volta na própria grade): o antigo deixava emendas quadradas visíveis em `neve` e nos outros materiais que usam `camadaDeRuido`; o visual muda só por isso.

### 10.4b — Materiais: paralelepípedo, lajes com grama, terra com sulcos, areia molhada  ✅
Escopo: `paralelepipedo` (pedras arredondadas irregulares, Voronoi, rejunte escuro), `lajes.gramadas` (lajes grandes com grama e musgo nas juntas, algumas faltando), `terra.sulcos` (estrada com duas trilhas de roda; os sulcos seguem a orientação dominante da camada), `areia.molhada`.
Commit: cobbles, grassy flagstones and rutted dirt
Nota: padrões novos `paralelepipedo` (Voronoi de 21 cm, cada pedra um domo iluminado a noroeste, rejunte escuro e sujo), `lajegrama` (lajes de ~1,15 × 0,85 m em fileiras desencontradas, 10% faltando, musgo, rachaduras e grama nas juntas), `sulcos` (duas trilhas paralelas ao eixo x do contexto, com banco claro, fundo escuro e capim na crista) e `molhada` (areia escurecida, marolas, poças de brilho). Os sulcos seguem a camada: `src/procedural/orientacao.ts` (`orientacaoDominante`, análise de componentes principais das células, 0 para forma quase redonda) e o assar passa `dir` só para o padrão `sulcos` (no Pixel gira em múltiplos de 90°). No Pixel as lajes usam as duas cores de verde fixas (`#4f7a35`, `#7fa650`), com 6 cores no total. Captura: `test-results/fase10-materiais-b.png` (`tests/e2e/fase10-materiais.test.ts`).

### 10.5a — Acervo: inverno e rocha  ✅
Objetivo: os objetos de inverno e as rochas grandes que o Desfiladeiro e as costas pedem.
Depende de: — (o `altura` da 10.3 é opcional aqui)
Ler: `src/procedural/pesados/plantas.ts` (`copaRedonda`, `pinheiro`, `arbusto`, o formato das variantes), `src/procedural/pesados/index.ts`, `src/procedural/receitas/exterior.ts` (`pedra`), `src/procedural/receitas/index.ts`, `scripts/assar-colecao.ts`, `tests/unit/pesados.test.ts`, `tests/unit/kit-exterior.test.ts`; recortes de `desfiladeiro-nevado.png`.
Arquivos: mudar `pesados/plantas.ts`; criar `src/procedural/receitas/ermos.ts`, `tests/unit/kit-ermos.test.ts`; mudar `receitas/index.ts`; rodar `npm run assar` (gera os WebP e atualiza `public/colecao/colecao.json`).
Como:
1. Geradores pesados (categoria `exterior`, kit `exterior`, `res: 64`):
   - `arvore-nevada` (3, 5 m): a copa vista de cima como **pompons de neve** — 5 a 9 bolas brancas sobrepostas (`#f4f8fc` com sombra `#b8c8dc` do lado oposto à luz e brilho `#ffffff`), cada uma com textura de "algodão" (muitas elipses pequenas de 3 tons), contorno leve azul-acinzentado; quase nada de verde visível (só frestas `#4a6a5a`).
   - `pinheiro-nevado` (3, 4,5 m): a forma do `pinheiro` com camadas brancas por cima das verdes em anel, verde aparecendo só nas pontas.
   - `arbusto-seco` (1,2 e 2 m): galhos finos ramificados do centro para fora (3 níveis de ramificação, traço de 1 a 3 cm, `#3a2c22` e `#5b4636`), sem folhas, com um pouco de neve opcional (`neve: true`).
2. Receitas em `ermos.ts` (`kit: 'ermos'`, categoria `exterior`, tags `inverno`/`rocha`/`natureza`):
   - `rochedo` (campos `tamanho` 1,5–5 m e `cobertura`: `nenhuma`/`musgo`/`neve`): polígono de 14 a 20 vértices com bordas quebradas, 3 a 4 faces facetadas em tons de cinza (luz a noroeste), rachaduras, e a cobertura por cima (manchas de musgo nas faces de cima ou um tampo de neve irregular).
   - `seixos` (aglomerado de 5 a 12 pedrinhas numa pegada de 1 × 0,8 m).
   - `galho-seco` (galho caído com ramificações, 1,5 m).
   - `treno` (trenó de madeira com dois esquis de ferro e ripas, 1,4 × 0,6 m).
3. `npm run assar` gera os itens novos (`casa:arvore-nevada-3m` etc.); nenhum item antigo muda de versão.
Não fazer: sombra longa (10.3); mexer nas árvores que existem.
Testes: `kit-ermos.test.ts` (cada receita gera descrição válida com a pegada dentro da caixa; semente diferente, forma diferente; `cobertura` muda as partes); `pesados.test.ts` cobre os geradores novos.
Pronto quando: uma captura com os itens novos sobre `neve.funda` (ou `neve`), no Ilustrado e no Pixel, parece o recorte do Desfiladeiro (`test-results/fase10-inverno.png`).
Commit: winter trees and boulders
Nota: `cobertura` do rochedo é um campo numérico 0/1/2 (nenhuma/musgo/neve), pois `CampoDeReceita` não tem seleção. `rochedo` é um polígono de 14 a 20 vértices com 4 faces em torno de uma cumeeira deslocada para a luz, rachaduras curtas e musgo ou tampo de neve por cima; a pegada é `tamanho × 0,8·tamanho`. Geradores novos com `kit: 'ermos'`: `arvore-nevada` (3 e 5 m, pompons), `pinheiro-nevado` (3 e 4,5 m), `arbusto-seco` (1,2, 2 e 2 m com neve); 7 itens novos no catálogo, nenhum antigo regravado. Capturas: `test-results/fase10-inverno.png` (Ilustrado) e `fase10-inverno-pixel.png` (`tests/e2e/fase10-inverno.test.ts`). No Pixel os galhos finos do arbusto seco ficam esparsos.

### 10.5b — Acervo: mata, ruína e margem  ✅
Escopo: `carvalho-grande` (copa densa de folhas recortadas, 6 a 8 m), `folhagem-tropical` (arbusto de folhas largas, escuro), `tufo-de-grama`, `junco`, `vitoria-regia` (e flor), `raiz-exposta`; ruína: `mureta-de-pedra` (receita com largura, blocos irregulares, pode faltar pedaço), `coluna-arruinada` (com esfera), `coluna-caida`, `circulo-runico` (entalhe no chão, raios param.), `escombros` (pedras e pó escuro), `viga-partida`, `tabua-solta`.
Commit: woodland and ruin kit
Nota: dois geradores pesados novos (`carvalho-grande` 6, 7 e 8 m com lóbulos recortados; `folhagem-tropical` 1,6 e 2,4 m), kit `mata`, e 11 receitas em `receitas/mata.ts` (`mata`: `tufo-de-grama`, `junco`, `vitoria-regia` com `flor`, `raiz-exposta`; `ruina`: `mureta-de-pedra` com `largura` e `falha`, `coluna-arruinada` com esfera, `coluna-caida`, `circulo-runico` com `raio` e `raios`, `escombros`, `viga-partida`, `tabua-solta`). Os campos de 0/1 seguem o padrão da 10.5a. Nenhuma receita marca `blocks`: o padrão do objeto (bloqueia o passo) vale; ajustar mureta e coluna no inspetor se preciso. Capturas: `test-results/fase10-mata.png` e `fase10-mata-pixel.png`.

### 10.5c — Acervo: porto e cidade  ✅
Escopo: `navio` (casco de cima com proa, convés de tábuas, 2 ou 3 mastros, escotilha, gradil; comprimento 14 a 30 m), `barcaca`, `guindaste-de-cais`, `cais-segmento` (passarela de tábuas com estacas; comprimento e largura), `estaca`, `barraca-de-feira` (toldo listrado em 4 cores), `caixote`, `pilha-de-caixotes`, `barril`, `pilha-de-barris`, `sacos`, `rede-de-pesca`, `ancora`, `rolo-de-corda`, `lanterna-de-poste`.
Commit: harbor kit
Nota: 15 receitas em `receitas/porto.ts` (kit `porto`, categoria `exterior`; `lanterna-de-poste` em `lareira-e-luz`). `navio` tem `comprimento` (14–30) e `mastros` (2 ou 3), com largura de 28% do comprimento; `cais-segmento` tem `comprimento` e `largura`; `barraca-de-feira` tem `paleta` (0–3) para as 4 cores do toldo. `lanterna-de-poste` só desenha o brilho: a luz de verdade é posta à parte. Nenhuma receita marca `blocks` (padrão do objeto). Capturas: `test-results/fase10-porto.png` e `fase10-porto-pixel.png`. No Pixel a âncora e o guindaste ficam finos.

### 10.5d — Acervo: estrada e estábulo  ✅
Escopo: `carroca` (vazia e carregada, com varais), `cavalo` (pardo, branco, preto, malhado; de pé, de cima, com crina e cauda), `fardo-de-feno`, `bebedouro`, `carrinho-de-mao`, `carrinho-de-carga` (o do deque).
Commit: road and stable kit
Nota: 6 receitas em `receitas/estrada.ts` (kit `estrada`, categoria `exterior`): `carroca` (campo `carga` 0/1: vazia com banco e tábuas, ou carregada com lona amarrada e cordas; varais e quatro rodas), `cavalo` (campo `pelagem` 0 pardo, 1 branco, 2 preto, 3 malhado; visto de cima, pescoço e cabeça girados um pouco pela semente, crina, cauda), `fardo-de-feno`, `bebedouro`, `carrinho-de-mao` (1,9 m com os varais) e `carrinho-de-carga` (campo `carga` 0/1, com dois caixotes). `faixa` e `rot` passaram a ser exportados de `porto.ts`. Nenhuma receita marca `blocks` (padrão do objeto). Capturas: `test-results/fase10-estrada.png` e `-pixel.png` (`tests/e2e/fase10-estrada.test.ts`).

### 10.5e — Acervo: caverna  ✅
Objetivo: os restos e as feições do Covil na caverna.
Depende de: —
Ler: `src/procedural/receitas/ermos.ts` (da 10.5a; se ainda não existe, criar aqui com o mesmo formato), `src/procedural/receitas/exterior.ts` (`pedra`, `tronco.caido`), `src/procedural/descricao.ts`; recortes de `covil-na-caverna.png`.
Arquivos: mudar `receitas/ermos.ts` (ou criar `receitas/caverna.ts` no mesmo formato), `receitas/index.ts`; testes em `tests/unit/kit-ermos.test.ts`.
Como (kit `ermos`, categoria `exterior`, tags `caverna`/`ossos`/`masmorra`; ossos em `#d9d2c0`, sombra `#8f8775`, contorno de nanquim):
- `ossada` (variantes por `seed`; 1,6 × 0,9 m): esqueleto de quadrúpede deitado de lado — coluna curva de vértebras, caixa torácica (8 a 12 costelas em arco), crânio alongado, ossos das pernas em ângulos; peças soltas pela semente.
- `cranio-animal` (0,4 × 0,25 m, com chifres opcionais `chifres: true`).
- `pilha-de-ossos` (1,5 m): ossos longos cruzados, costelas, dois crânios, sobre uma mancha escura.
- `pilha-de-peles` (2 × 1,6 m): 5 a 7 peles sobrepostas com contorno de pele de animal (quatro patas e cauda), cores marrom, creme, preto e uma listrada, pelos em traços curtos.
- `buraco` (campos `largura` 0,8–3 m): fosso preto com borda de pedra quebrada e um degradê para dentro; `blocks.move` padrão `true` (ver como os objetos marcam isso em `fabrica.ts`).
- `estalagmite` (0,4–0,8 m): cone visto de cima, anéis concêntricos com ponta clara.
- `arvore-morta-caida` (3 m): tronco cinza-escuro com galhos secos ramificados e raízes na ponta.
Não fazer: presença de sangue seco (10.6c).
Testes: cada receita gera descrição válida; `buraco` nasce bloqueando o movimento.
Pronto quando: uma captura com os itens sobre `rocha.rachada`, com pouca luz, lembra o recorte do covil (`test-results/fase10-caverna.png`).
Commit: cave kit
Nota: criado `receitas/caverna.ts` (kit `ermos`, categoria `exterior`, tags `caverna`/`ossos`/`masmorra`) com 7 receitas: `ossada` (1,9 × 0,9 m; coluna, 9 a 11 costelas, crânio, ossos soltos), `cranio-animal` (`chifres` 0/1), `pilha-de-ossos`, `pilha-de-peles` (5 a 7 peles; uma listrada), `buraco` (`largura` 0,8–3 m, degradê para dentro), `estalagmite` (`tamanho` 0,4–0,8) e `arvore-morta-caida` (3,4 m com as raízes). Pegadas de `ossada` e da árvore passam um pouco dos valores da ficha por causa dos ossos soltos e das raízes. `buraco` bloqueia o passo pelo padrão do objeto (`novoObjeto`, `blocks.move: true`; o teste confere). Captura: `test-results/fase10-caverna.png` (+ `-pixel`), sobre `rocha.rachada` escurecida (`tests/e2e/fase10-caverna.test.ts`).

### 10.5f — Acervo: fundo da água e barcos pequenos  ✅
Escopo: `coral` (couve-flor rosada e lilás), `ourico`, `anemona`, `alga`, `rocha-submersa`, `barco-a-remo`, `barco-de-vela` (com flutuador, vela recolhida), `bote-com-carga`. Todos com `elevation` padrão certo (o fundo é `underwater`).
Commit: seabed and small boats
Nota: `receitas/fundo.ts` com 8 receitas: kit `fundo` (`coral` com `cor` 0 rosado/1 lilás, `ourico`, `anemona`, `alga`, `rocha-submersa`) e kit `barcos` (`barco-a-remo` com remos, `barco-de-vela` com flutuador e vela recolhida, `bote-com-carga`). Campo novo `submerso?: boolean` em `Receita` e `ItemDoAcervo`: o pincel de objeto (`viewport.ts`) põe os cinco do fundo com `elevation: 'underwater'`, sem sombra e sem bloquear; os barcos nascem `floor`. Pegadas: `alga` 1,1 × 1,2 e `barco-a-remo` 3,2 × 1,8 (remos para fora). Captura: `test-results/fase10-fundo.png` (+ `-pixel`) (`tests/e2e/fase10-fundo.test.ts`).

### 10.6a — Bordas do mapa: nuvens, escuro, neblina  ✅
Objetivo: o mapa pode se fechar nas bordas com nuvens, escuridão ou neblina, que se mexem de leve.
Depende de: 10.0a
Ler: `src/render/neblina.ts` (inteiro: o shader de ruído e o padrão de uniformes), `src/render/viewport.ts` (onde a neblina é criada, recebe `quadro` e fica na ordem), `src/ui/Inspetor.tsx` (bloco do acabamento, linha ~120), `src/state/comandos*.ts` (`acabamento.atualizar`).
Arquivos: criar `src/render/bordas.ts`; mudar `viewport.ts` ou `cena.ts` (onde a neblina entra), `Inspetor.tsx`, `src/domain/presets.ts` (presets de acabamento continuam neutros).
Como:
1. `bordas.ts`, no formato de `criarNeblina` (sprite do tamanho do mapa com filtro): `alfa = (1 − smoothstep(0, largura, distânciaÀBorda + ruído)) `, com `largura = amount × 0,25 × min(w, h)` e o ruído (fbm do shader da neblina, escala maior) deformando a frente; desloca com o vento e o tempo.
2. Tipos: `clouds` — cor branca iluminada pelo ambiente, com sombreado interno (o ruído em duas escalas dá volume: mais claro no "topo" da nuvem, cinza-azulado embaixo) e sombra suave projetada para dentro do mapa; `dark` — preto, frente quebrada (sem movimento); `fog` — a cor da neblina atual, macia.
3. Ordem: acima das partículas e abaixo das peças, da névoa de jogador e das marcas do editor (as bordas fazem parte do mundo; no projetor aparecem igual).
4. Inspetor (aba Mapa → acabamento): "Bordas" (Nenhuma, Nuvens, Escuro, Neblina) e "Quanto entra" (0 a 1) por `acabamento.atualizar`.
5. Pixel: ruído medido em blocos de 2 px e alfa em 3 níveis com Bayer, como a neblina.
Não fazer: halo (10.6b).
Testes: e2e: `edges = clouds, 0,6` deixa os cantos claros e o centro igual (capturas); `dark` deixa as bordas pretas; movimento reduzido desacelera.
Pronto quando: o Desfiladeiro pode ter nuvens nas bordas como a referência e o Covil, o negro em volta.
Commit: map edge clouds and darkness
Nota: `render/bordas.ts` (`criarBordas`, no formato da neblina): um véu do tamanho do mapa com `finish.edges`; largura `amount × 0,25 × min(w, h)` (`larguraDaBorda`), frente deformada por fbm de 3 oitavas. Nuvens: topo claro e base cinza-azulada (a diferença entre o ruído e ele mesmo deslocado para a luz de noroeste) mais uma sombra suave para dentro; escuro: preto, ruído parado e borda mais seca; neblina: a cor do ambiente, macia. A cor vem do ambiente (de noite a nuvem escurece). Entra na cena logo acima das partículas (antes de regiões, luzes, peças e névoa), lê a `visao` do clima (então a transição de clima interpola `amount`; o `kind` troca no fim) e respeita `definirAtmosfera` e o movimento reduzido. Pixel: ruído em blocos de 2 px e alfa em 3 níveis com Bayer. Inspetor (Mapa → Acabamento): "Bordas" e "Quanto entra" (ao escolher um tipo com quantidade 0, vai para 0,5). Testes e capturas em `tests/e2e/fase10-bordas.test.ts` (`test-results/fase10-bordas-nuvens|escuro|neblina|pixel.png`).

### 10.6b — Halo das luzes e raios no cone  ⬜
Objetivo: tochas e postes brilham de verdade na escuridão, e o feixe da caverna mostra raios.
Depende de: 10.0a
Ler: `src/render/mapa-de-luz.ts` (as luzes, o flicker, `texturaDeBrilho` de `luzes.ts`, `luzesDerivadas`), `src/render/cena.ts` (ordem de `raiz`), `src/ui/Inspetor.tsx` (bloco da luz com cone e o do acabamento), `src/render/faixas.ts`.
Arquivos: criar `src/render/halos.ts`; mudar `cena.ts`, `mapa-de-luz.ts` (expor a intensidade atual por luz, com o flicker, para o halo acompanhar), `Inspetor.tsx`.
Como:
1. Halo: para cada luz acesa (as mesmas que o mapa de luz desenha, incluindo as derivadas), um sprite aditivo com `texturaDeBrilho`, na cor da luz, raio `0,35 × radius`, alfa `finish.glow × intensidade atual` (pisca junto com o flicker). Fica **acima** do mapa de luz multiplicado e das presenças, abaixo da névoa e das peças. Não é recortado pelas paredes (é o brilho no ar); dentro de cômodo com telhado visível não aparece.
2. Raios: luz com `cone` e `rays: true` ganha um sprite com shader: listras radiais a partir da origem, dentro do ângulo do cone, com ruído que anda devagar no ângulo, alfa caindo com a distância, aditivo, `0,25 × intensidade`; recortado pelo mesmo polígono de visão da luz (a máscara que o mapa de luz já calcula).
3. Inspetor: "Halo das luzes" (0 a 1) no acabamento; "Raios visíveis" (alternar) na luz com cone.
4. Pixel: halo em 2 faixas de borda dura; raios em listras de 1 px, sem animação contínua (troca a cada 0,5 s).
5. Movimento reduzido: raios parados.
Não fazer: bloom de tela inteira.
Testes: e2e: noite com uma tocha, `glow` 0 e 0,8: a captura em volta da tocha fica mais clara com 0,8 e igual longe dela; luz com cone e `rays` muda entre dois quadros e para com movimento reduzido.
Pronto quando: o Porto à noite e a Ravina podem ter as poças e halos quentes das referências, e o Covil, o feixe de luz.
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
