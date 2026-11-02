# Atlas — arquitetura

Data: 2 de novembro de 2026. Proposta de arquitetura da Fase 1. Nada aqui está implementado; os pontos que o spike técnico precisa confirmar estão marcados como **[spike]**.

Leia antes: [VISAO.md](VISAO.md).

## 1. Stack

| Camada | Escolha | Observação |
| --- | --- | --- |
| Linguagem | **TypeScript 7** (`strict`), módulos ES | Tipos para o documento do mapa, a descrição de desenho, os comandos e o contrato da mesa. O Vite compila; `tsc --noEmit` checa |
| Build | Vite 7 (o ecossistema resolve 7.3.6) | `base: './'` para o GitHub Pages |
| Render | **PixiJS 8** | Batching de sprites, render targets, filtros e shaders próprios. Versão exata fixada no lockfile. **[spike]** confirmar desempenho com luz e névoa. |
| Interface | **Preact 11 + @preact/signals**, JSX, CSS próprio (sem Tailwind) | API do React; os signals atualizam só o que mudou. Resolve a armadilha do `render()` completo da Ficha. `@preact/preset-vite` no build |
| Persistência | IndexedDB, com exportar e importar backup em JSON | Padrão do Ateliê (`Atelie/src/data/backup.js`); banco interno com escopo de caminho (`atlas-v1:<caminho>`) |
| Plataforma | `vendor/mesa-core/` (cópia com versão fixa) | Refs, banco da campanha, barramento, manifesto e tema de [PLATAFORMA.md](PLATAFORMA.md) |
| Testes | `node --test` (com o carregamento de TS do Node) para domínio puro; `tsc --noEmit`; Playwright para e2e, capturas e FPS | Padrão do Tabletop |
| Versões | preact 11.0.1, @preact/signals 2.11.3, @preact/preset-vite 2.10.6, typescript 7.0.2, pixi.js 8.22.0, vite 7.3.6 | Fixadas no lockfile em 2 de novembro de 2026 |
| Node | 22.12 ou superior | Exigência do Vite 7 |

Sem servidor. Tudo roda no navegador.

## 2. Estrutura de pastas proposta

```
Atlas/
  index.html
  src/
    main.tsx
    app/          inicialização, modos Construir/Sessão, janela do projetor
    domain/       documento, validação, migrações, geometria, regras (puro, sem DOM nem Pixi)
    state/        store, comandos, undo/redo, rascunho
    authoring/    construção inteligente: cômodos→paredes, encaixe de portas, sugestões
    procedural/   receitas (→ descrição de desenho), materiais, sprites, ruído, paletas (rodam em worker)
    render/       Pixi: camadas, renderizadores Ilustrado e Pixel, luz, visão, névoa com memória, presença, acabamento
    session/      tokens, iniciativa, revelação, eventos de cena, projeção filtrada
    integrations/ Ficha, Ateliê, Jukebox
    fx/           efeitos de interface (adaptado da Ficha)
    tutorial/     lições e condições
    ui/           painéis, paleta de comandos, atalhos, tema
    data/         repositório IndexedDB, backup, cache de texturas
  public/colecao/ acervo da casa (no git, com licenças)
  scripts/        assar o acervo gerado, utilitários
  data-private/   importações locais (fora do git, fora do build)
  tests/          unitários (node --test) e e2e/ (Playwright)
  spikes/         protótipos descartáveis
  docs/
```

Regra de dependência: `domain` não importa nada de `render`, `ui` ou Pixi. `authoring` e `session` produzem comandos; nunca mexem em sprites.

Duas árvores, uma fonte de verdade:

- **Mapa:** Pixi puro em `render/`, fora do Preact. Lê o store e redesenha só o que mudou.
- **Interface:** componentes Preact em `ui/` (`.tsx`). Leem o store por signals derivados (`documento`, `selecao`, `ferramenta`, `clima`…) e alteram só por comandos.
- O store de comandos (`state/`) é a ponte: nenhum componente mexe em sprite, e o render nunca mexe em DOM de painel.
- Efeitos de jogo (`fx/`) ficam numa camada própria sobre a interface, como na Ficha, mas sem fila pós-render: um componente pode animar sem ser recriado.

## 3. Documento do mapa

Unidade de mundo: **metro**. Grid padrão: quadrados de **1,5 m**, configurável por mapa (1,5 m em Ordem Paranormal e D&D em metros; 5 pés convertidos). Coordenadas `[x, y]` com origem no canto superior esquerdo e `y` para baixo, como na tela.

```js
{
  schema: 'atlas.map', version: 1,
  id, name, revision, createdAt, updatedAt,
  grid:   { kind: 'square', size: 1.5, offset: [0, 0], visible: true },
  bounds: { width: 45, height: 30 },                       // metros
  style:  { renderer: 'illustrated'|'pixel', palette: 'investigacao-sepia', walls: 'box', pixel: { pixelsPerCell: 16, dither: 'bayer4', outline: true } },
  climate: { preset: 'tarde', ambient: { color, intensity }, sun: null | { angle, color, intensity }, time: '16:30' },
  finish: { preset: 'neutro', texture: 0.2, vignette: 0.3, saturation: 1, grain: 0.1, grade: { lift, gamma, gain } },
  memory: { sketch: true, paper: 'papel-claro', ink: '#2a2a2a' },     // aparência das áreas exploradas fora da vista
  backdrop: { kind: 'solid'|'texture', color: '#000000', material: null, title: null | { text, font, position } },

  terrain: {
    resolution: 0.25,                                     // metros por texel das máscaras
    base: 'terra',
    layers: { [id]: { material: 'grama', mask: assetRef, order } },
  },
  rooms:    { [id]: { name, function: 'cozinha'|null, cells: rle, floor: { material, seed }, wallpaper: { material, seed } | null,
                      wallStyle: null | 'box' | 'solid', palette: null, roof: { material, visible }, levelId: null } },
  walls:    { [id]: { path: [[x, y], ...], height: 2.6, thickness: 0.2, material, kind: 'wall'|'low'|'fence'|'cliff',
                      blocks: { move: true, sight: true, light: true }, source: { roomId } | null } },
  openings: { [id]: { wallId, at: 0.42, width: 0.9, kind: 'door'|'window'|'arch'|'secret', state: 'closed'|'open'|'locked', material, som: Ref | null } },
  props:    { [id]: { source: { kind: 'recipe', recipe: 'mesa.madeira', seed, params }
                            | { kind: 'asset', assetId: 'casa:sofa-chesterfield' | 'import:<hash>' },
                      position, rotation, scale, elevation: 'floor'|'table'|'wall'|'ceiling',
                      wall: null | { wallId, at, face: 'inner'|'outer' },  // objetos de parede: quadros, janelas falsas, estantes
                      roomId, blocks: { move, sight }, castsShadow: true, harmonize: true } },
  lights:   { [id]: { position, radius, color, intensity, flicker, cone: null | { angle, direction }, ownerId: null,
                      power: 'grid'|'fire'|'battery'|'magic', on: true, nightOnly: false } },
  regions:  { [id]: { polygon, kind: 'reveal'|'trigger'|'note'|'audio', gmOnly, payload, refs: Ref[] } },
  presence: { [id]: { brush: 'musgo'|'neve'|'corrupcao'|'ordem.sangue'|…, mask: assetRef, intensity: 0.6, seed, gmOnly: false } },
  tokens:   { [id]: { name, portrait: assetRef, sprite: null | { body, hair, outfit, accessories, colors, seed }, facing,
                      position, size: 1, vision: { radius, dark: false }, lightId,
                      figure: { state }, refs: Ref[] } },          // ex.: a ficha na Ficha e o personagem na campanha
  campanhaId: null | string,                            // campanha a que o mapa pertence (PLATAFORMA.md §4)
  comodosExtra: { [roomId]: { leitura: '', notasMestre: '', refs: Ref[] } },   // texto para ler em voz alta, notas e ligações por cômodo
  session:  { explored: assetRef | null, initiative: null | { order, current, round }, revealed: [], event: null },
  audioCue: null,
  notes: '',
}
```

Pontos de desenho:

- **Cômodos guardam células, não polígonos.** Pintar no grid é o gesto principal; o contorno (polígono) é derivado por traçado de bordas e cacheado. Células em RLE por linha mantêm o JSON pequeno.
- **Paredes derivadas são entidades comuns.** Uma parede criada a partir de um cômodo tem `source.roomId`. Se o cômodo muda, as paredes derivadas são recalculadas; se o mestre edita uma à mão, `source` vira `null` e ela passa a ser manual. As aberturas sobrevivem ao recálculo por `at` relativo, reprojetadas no segmento mais próximo.
- **Climas reagem ao mapa sem alterá-lo.** O clima aplicado é um estado de render calculado a partir do documento: `power: 'grid'` apaga no apagão; `nightOnly` acende só à noite; janelas (`openings.kind: 'window'`) deixam entrar luz do sol, da lua e dos relâmpagos; a tempestade liga chuva, vento e relâmpagos. O mestre pode sobrescrever qualquer luz.
- **Climas são predefinições editáveis.** Um clima combina `climate`, `style.palette` e `finish`; trocar de clima na sessão é um comando como outro qualquer, com transição animada.
- **Objetos são referências.** Receita procedural (`recipe` + `seed` + `params`) ou ID de um asset da coleção ou importado. O sprite é gerado ou carregado e cacheado. Nenhuma imagem de objeto entra no documento. Um mapa que usa um asset importado abre em outra máquina com um substituto procedural da mesma categoria e um aviso.
- **Máscaras e retratos são `assetRef`** (`{ id, hash }`) apontando para blobs no IndexedDB, fora do JSON. O backup os embute em base64.
- **`session` é separado do mapa.** Duplicar um mapa para uma nova sessão copia o mapa e zera `session`.
- **Validação estrita** com caminhos de erro, campos desconhecidos rejeitados e **migrações** por `version` desde a primeira versão, como em `Tabletop/src/domain/validation.js` e `migrations.js`.

## 4. Estado, comandos e histórico

Adaptado de `Tabletop/src/state/scene-store.js`, `state/commands.js` e `state/immutable.js`:

- Documento imutável com rascunhos copy-on-write (`createDraft`/`finishDraft`).
- `store.execute(type, payload, { label })` aplica um comando puro (`applyCommand(document, command)`), empilha `{ before, after, label }` e notifica os assinantes com as mudanças por coleção.
- `editVersion` protege propostas: uma sugestão gerada para uma versão antiga é recusada ("o mapa mudou; gere a sugestão novamente").
- **Propostas:** a construção inteligente gera `{ label, commands, preview, expectedEditVersion }`. A prévia vira fantasma no render; aceitar executa `proposal.accept` como **uma** entrada de histórico.
- **Gestos contínuos** (pincel, arrastar) acumulam numa transação e viram um único comando ao soltar o mouse.
- Histórico em memória limitado (150, como no Tabletop) com rótulos legíveis ("Pintar cozinha", "Mobiliar escritório").
- Rascunho automático no IndexedDB com debounce; salvar explícito marca revisão.

Comandos iniciais: `terrain.paint`, `room.paint`, `room.erase`, `room.update`, `wall.add/update/remove/detach`, `opening.add/update/remove`, `prop.add/update/remove`, `light.*`, `region.*`, `token.*`, `session.*`, `presence.*`, `climate.apply`, `style.update`, `finish.update`, `backdrop.update`, `grid.update`, `proposal.accept`.

## 5. Render

### 5.1. Camadas (de baixo para cima)

| # | Camada | Conteúdo |
| --- | --- | --- |
| 1 | Terreno | Base, camadas por máscara, transições automáticas |
| 2 | Pisos | Piso de cada cômodo recortado pelo contorno |
| 3 | Decalques e espalhamento | Manchas, papéis, folhas, entulho |
| 4 | Sombras de contato | Oclusão suave na base de paredes e objetos |
| 5 | Objetos baixos | Tapetes, mesas, camas |
| 6 | Paredes | Estilo caixa (faces internas + objetos de parede) ou sólido (faixa + sombra) |
| 7 | Objetos altos | Estantes, árvores, postes |
| 8 | Telhados | Desaparecem com animação quando um token entra no cômodo |
| 9 | Luz | Mapa de luz com sombras das paredes, multiplicado sobre a cena |
| 9b | Presença | Pincéis animados (musgo, neve, corrupção…), afetados pela luz |
| 10 | Névoa com memória | Visível = cena; explorado fora da vista = esboço (§5.6); nunca visto = fundo |
| 11 | Clima e partículas | Chuva, neve, poeira, brasas, neblina, folhas |
| 12 | Acabamento | Sujeira, vinheta, dessaturação, granulação e ajuste de cor (também no projetor) |
| 13 | Sobreposições do editor | Grid, seleção, fantasmas, régua (nunca no projetor) |

Abaixo de tudo, o **fundo do mapa** (cor ou textura, com cartela de título opcional). Os cômodos são ilhas sobre ele.

### 5.2. Profundidade falsa: paredes caixa

Referência: mapas da mansão em [referencias/](referencias/).

- Cada cômodo é desenhado como uma caixa vista de cima: as faces internas das quatro paredes aparecem como trapézios inclinados para o centro do cômodo, com largura proporcional à altura da parede (`height`) e a uma constante de profundidade do mapa.
- As faces recebem papel de parede ou material da parede e os **objetos de parede** (`prop.wall`): janelas, quadros, estantes, cabeceiras, armários altos. Janelas e portas recortam a face.
- A perspectiva é **por cômodo**, não global: não existe "lado sul" privilegiado, e o grid continua alinhado ao piso.
- Paredes compartilhadas mostram uma face em cada cômodo; o topo da parede é a faixa escura entre elas, e o contorno grosso fecha a ilha.
- O piso visível encolhe pela largura das faces, mas **o grid e a colisão usam o piso real**. As faces são visuais; tokens podem ficar por cima delas.
- Estilo **sólido**: sem faces, faixa escura com sombra projetada no piso, na direção da luz principal.
- Objetos altos ocultam parcialmente tokens atrás deles e ficam translúcidos quando um token está sob eles.
- **[spike]** Validar a leitura do grid perto das faces, o encontro das faces nos cantos e em cômodos não retangulares (em L), e como portas aparecem nas duas faces.

### 5.3. Luz, visão e névoa

- **Polígono de visibilidade** por fonte (lançamento de raios contra os vértices dos segmentos que bloqueiam), sobre um índice espacial dos segmentos. Portas fechadas e janelas entram ou saem do conjunto conforme `blocks` e `state`.
- Luzes desenhadas num render target de luz em meia resolução, com borda suavizada por desfoque; ambiente escuro configurável.
- Visão dos jogadores = união das visões dos tokens dos jogadores; área explorada acumulada numa máscara de baixa resolução.
- Recalcular só o que mudou: mover um token refaz a visão dele; abrir uma porta refaz as fontes cujo raio cruza a porta.
- **[spike]** Medir o custo com 32 luzes e 6 tokens num mapa de 30 × 20 células.

### 5.4. Engine de renderização: uma descrição, dois renderizadores

Nenhum asset é desenhado duas vezes. Receitas procedurais não produzem imagens: produzem uma **descrição de desenho** independente de estilo, e cada renderizador a interpreta.

```js
// O que uma receita devolve (exemplo: mesa redonda com toalha e um lampião em cima)
drawSpec = {
  footprint: [w, h],                                  // metros
  parts: [
    { shape: 'ellipse', size, at, height: 0.75, material: 'madeira.escura', role: 'tampo', detail: 1 },
    { shape: 'ellipse', size, at, height: 0.76, material: 'tecido.linho', pattern: 'renda', role: 'toalha', detail: 2 },
    { shape: 'path',    points, height: 0.8, material: 'latao', role: 'lampiao', detail: 2 },
  ],
  lights: [{ at, radius, color, flicker }],          // vira luz real na engine
  shadow: { height: 0.8 },
}
```

- `shape`: retângulo arredondado, elipse, caminho, faixa, pontos espalhados. `height` dá a ordem, a sombra e o relevo para a luz. `material` aponta para materiais procedurais. `detail` diz em que nível o elemento some (o renderizador pixel descarta o que não cabe na resolução).
- **Ilustrado** rasteriza a descrição em alta resolução: preenchimento com textura do material, sombreado suave pela altura e pela luz, traço de nanquim nas bordas por `role`.
- **Pixel** rasteriza a mesma descrição na resolução da célula: cores da paleta por material, sombreado em 2–3 degraus pela altura, dithering, contorno de 1 px, partes com `detail` alto descartadas.
- **Imagens** (acervo achado, importações) entram como `{ shape: 'image', src }`. O Ilustrado usa direto; o Pixel deriva a versão pixel automaticamente (redução que preserva bordas, mapeamento para a paleta, contorno). Uma versão pixel feita à mão (`pixelSrc`) tem prioridade quando existir.
- **Materiais** também têm duas interpretações: textura procedural com relevo (Ilustrado) e ladrilho pequeno de paleta com dithering (Pixel), da mesma seed.

Interface dos renderizadores, escolhida por `style.renderer`:

```js
renderer = {
  id: 'illustrated' | 'pixel',
  rasterize(drawSpec, seed, pixelsPerMeter),     // → textura do objeto (+ mapa de altura para a luz)
  material(materialId, seed, pixelsPerMeter),    // → ladrilho + relevo
  walls(room, walls, openings),                  // faces caixa ou faixa sólida
  sprite(spriteSpec, facing, animation),         // personagem
  lightRamp,                                     // contínua | em faixas
  memorySketch,                                  // traço do esboço da memória
  revealTransition,                              // tinta escorrendo | dissolução em dithering
  postProcess,                                   // nenhum | quantização, dithering e contorno finais
}
```

- **Ruído e pincéis:** adaptar `Atelie/src/domain/noise.js` (`mulberry32`, `valueNoise2D`, `fbm`, `worley2D`, `domainWarp`) e as pontas de `Atelie/src/domain/brush.js`.
- **Pixel na tela:** a cena (camadas 1–11) vai para um render target de `largura em células × pixelsPerCell`, ampliado com `nearest`; quantização final por LUT da paleta garante que nada fuja dela.
- **Engine de luz única:** os dois renderizadores usam o mesmo mapa de luz e as mesmas sombras; só a rampa muda (contínua ou em faixas com borda dura).

### 5.5. Personagens e sprites

- Token com `portrait` (imagem) e opcionalmente `sprite` (parâmetros).
- **Gerador de sprites paramétrico**: corpo, cabeça, cabelo, roupa, acessórios e cores, descritos como `drawSpec` por quadro. Animações: parado (respiração) e andando, em 4 direções; estados da Ficha (`ferido`, `morrendo`, `inconsciente`, `morto`, `enlouquecendo`, de `Tabletop/src/domain/figures.js`) mudam pose, cor e efeito.
- Sugestão automática de cores a partir do retrato (cores dominantes) ou da ficha vinculada; o mestre ajusta num painel com prévia animada.
- Pixel: sprite é o padrão do token. Ilustrado: retrato por padrão; sprite em alta resolução como opção.
- Movimento: o token interpola entre células; no Pixel, o sprite anda com a animação na direção do movimento.

### 5.6. Névoa com memória

- Três máscaras por mapa: **visível** (calculada a cada mudança), **explorado** (acumulada em `session.explored`) e o resto.
- Áreas exploradas fora da vista são desenhadas pelo `memorySketch` do renderizador: piso e paredes como traço sobre papel (`memory.paper`), sem cor nem luz; objetos fixos em contorno; tokens e objetos móveis omitidos.
- No editor, o mestre vê tudo; cômodos e áreas marcados como "planejado" usam o mesmo traço.
- Transições animadas ao entrar e sair da vista (traço ganha cor; cor desbota em traço).

### 5.7. Pincéis de presença

- Cada pincel é uma máscara pintada (`presence[id].mask`) + um efeito animado em shader: crescimento por ruído na borda, pulsação, brilho reagindo à luz, distorção.
- `intensity` muda ao vivo na sessão (comando com transição), expandindo ou recolhendo o efeito dentro da máscara.
- Pacotes: naturais, sobrenaturais e **Ordem Paranormal** (um por elemento, cores alinhadas com `ELEMENT_COLORS` da Ficha, desenhos próprios).
- Os dois renderizadores têm versão do efeito (suave ou em blocos com dithering).

### 5.8. Acabamento e cache

- **Acabamento** (camada 12): um passe final com textura, vinheta, saturação, granulação e curva de cor, comum aos dois renderizadores (no Pixel, aplicado antes da quantização).
- **Cache de geração** por hash de `(style, recipe|material, seed, params, resolução)`: memória → IndexedDB → worker. Trocar de estilo ao vivo só gera o que falta, com a versão anterior visível até a nova ficar pronta.

### 5.9. Coleção de objetos e harmonização

Modelo do Ateliê: o app é completo só com a coleção da casa; o resto é opcional e privado.

| Fonte | Prefixo do ID | Onde | Git |
| --- | --- | --- | --- |
| Receitas procedurais | `recipe` | `src/procedural/recipes/` | Sim |
| Acervo da casa | `casa:` | `public/colecao/` + `colecao.json` (categoria, tamanho em células, função de cômodo, tags, licença, origem) | Sim |
| Importados | `import:<hash>` | IndexedDB; arquivos locais em `data-private/` | Nunca |

- **Acervo gerado por nós:** geradores pesados (estofados, plantas, tapetes ornamentados, objetos com muitos detalhes) rodam por script (`scripts/bake-colecao.js`) em alta resolução, nos dois estilos, e o resultado entra em `public/colecao/`. Os parâmetros ficam versionados para regenerar.
- **Acervo achado:** só licenças que permitem redistribuição (CC0 preferencialmente), cada arquivo registrado em `docs/LICENCAS.md` com autor, fonte e licença, como no Ateliê.
- **Importação:** PNG/WebP avulsos ou pasta; o importador pede categoria e tamanho em células, sugere ambos pela proporção e pelo nome, e guarda no IndexedDB. Nunca vai para `public/` ou `dist/`.
- **Harmonização** (todas as fontes, desligável por objeto com `harmonize: false`): recorte do vazio, escala pelo tamanho em células, contorno, sombra de contato e ajuste de cor (luminância e saturação puxadas para a paleta da cena). Feita no render, sem alterar o arquivo original.
- A biblioteca mostra as três fontes juntas, com filtro por função de cômodo; a construção inteligente usa a mesma busca.

## 6. Construção inteligente

Módulos em `src/authoring/`, todos puros sobre o documento, todos devolvendo comandos ou propostas:

| Módulo | Entrada | Saída |
| --- | --- | --- |
| `rooms.js` | Células pintadas | Contorno, paredes derivadas, paredes compartilhadas entre vizinhos |
| `openings.js` | Ponto e tipo de abertura | Parede e posição de encaixe, largura válida, sugestão entre cômodos |
| `room-insight.js` | Um cômodo | Área, portas, janelas, circulação livre, objetos presentes, função provável |
| `furnishing.js` | Insight + função | Proposta de piso, papel de parede, paleta, mobília e objetos de parede que respeita portas, circulação e o que já existe |
| `scatter.js` | Pincel, densidade, regras | Decalques e objetos pequenos por contexto (junto à parede, sob árvore, perto de mesa) |
| `transitions.js` | Máscaras de terreno | Bordas e misturas automáticas |

O Tabletop já tem a mesma ideia em 3D (`Tabletop/src/authoring/room-insight.js`, `furnishing.js`, `room-layout.js`); vale estudar as regras, mas a geometria do Atlas é 2D em grid e o código é novo.

## 7. Sessão e projetor

- Modos **Construir** e **Sessão** na mesma janela; papéis de mestre, jogador e projetor são projeções do documento, não botões escondidos.
- **Projeção filtrada:** o projetor recebe só o que os jogadores podem ver — sem notas, regiões `gmOnly`, portas secretas fechadas ou objetos fora da névoa.
- **Janela de projetor** por `BroadcastChannel` na mesma origem, com câmera publicada independente da câmera de trabalho, adaptando `Tabletop/src/app/presentation-window.js`.
- Iniciativa adaptada de `Tabletop/src/domain/initiative.js` (`startInitiative`, `stepInitiative`, `sortOrder`); estados dos personagens de `Tabletop/src/domain/figures.js` (`FIGURE_STATES`, `stateLook`).

## 8. Integrações: o Atlas na plataforma

O Atlas não faz pontes ponto a ponto. Ele fala o **contrato da mesa** ([PLATAFORMA.md](PLATAFORMA.md)) desde a Fase 2: mesma origem no GitHub Pages, Refs, banco da campanha `mesa-campanha-v1`, barramento `mesa:eventos`, manifesto `mesa.json` e tema `mesa:tema`.

| Com | Como, pelo contrato | Base |
| --- | --- | --- |
| Campanha | Mapa com `campanhaId`; cômodos, regiões e tokens com `refs`; o Atlas cria entidades "lugar" e liga cômodos a pistas e personagens | PLATAFORMA.md §4 |
| Ficha | Token com `Ref` da ficha; lê a ficha pelo que a Ficha publicar; escuta `ficha.rolagem` e `ficha.recursos` (rolagem flutua sobre o token); pede `ficha.abrir`. A Ficha continua dona dos dados. | PLATAFORMA.md §5; `Tabletop/docs/INTEGRACAO_FICHA.md` |
| Ateliê | Pistas pelo banco `mesa-handouts-v1` e canal `mesa:handout` (contrato v1, sem mudança); pede `atelie.abrir` para editar | `Atelie/docs/plano/CONTRATO-TABLETOP.md` |
| Jukebox | Mapa, região e clima com `Ref` de cena sonora (as cenas do Jukebox já são mixagens de várias faixas com volume); ao entrar numa região ou trocar de clima, pede `jukebox.tocar` | PLATAFORMA.md §5 |
| Mesa (hub) | Manifesto com rotas (`#/mapa/{id}`, `#/mapa/{mapa}/comodo/{id}`); atende `atlas.focar`; pode ser embutido no modo sessão | PLATAFORMA.md §6, §9 |
| Tabletop 3D | Exportar paredes, aberturas, cômodos e luzes como mapa importável (futuro); a mesma entidade "lugar" liga os dois | — |

### 8.1. Áudio do mapa

Duas camadas, com donos diferentes:

| Camada | Quem toca | Exemplos |
| --- | --- | --- |
| **Música e ambiente** (longos, em loop, mixados) | Jukebox, pelo pedido `jukebox.tocar { ref }` | Cena "Chuva forte" no clima Tempestade; "Biblioteca" ao entrar no cômodo |
| **Efeitos de interação** (curtos, no momento da ação) | O próprio Atlas, com Web Audio | Porta rangendo, porta trancada, interruptor, gaveta, passos, trovão no relâmpago |

- Os efeitos do Atlas vêm de uma biblioteca da casa: sons sintetizados (como o trovão do protótipo e os sons da Ficha) e arquivos com licença livre em `public/colecao/sons/`, registrados em `docs/LICENCAS.md`. O mestre pode trocar o som de cada interagível (`som: Ref`), inclusive por um arquivo seu.
- Hoje os "efeitos" do Jukebox são filtros aplicados a trechos de músicas, não sons avulsos. Se um dia o Jukebox ganhar uma biblioteca de efeitos avulsos, `som` pode apontar para ela (pedido `jukebox.efeito`), com autorização.
- Volume geral e por camada; os efeitos tocam no computador do mestre (o projetor não tem som próprio).

Fora da mesma origem (desenvolvimento sem `mesa-dev`, domínio próprio), o Atlas cai para o caminho de janela + `postMessage`, com recursos reduzidos. Nenhum contrato existente muda sem mudar os dois lados.

## 9. Interface e efeitos

- Efeitos de interface adaptados de `Ficha teste - Ordem II/src/fx/ui-fx.js`: `floatText`, `burst`, `flyParticles`, `queuePostRenderFx`/`runPostRenderFx`, `fxEnabled`, `isReducedMotion`.
- Paleta de comandos adaptada de `Tabletop/src/ui/command-palette.js`.
- Tutoriais adaptados de `Tabletop/src/tutorial/` (`conditions.js`, `lessons.js`, `tutor.js`): cada passo confere o resultado no documento, não o botão clicado.

## 10. Orçamento de desempenho

Alvo: notebook intermediário com placa de vídeo, 1080p, editor e projetor abertos.

| Item | Meta inicial |
| --- | --- |
| Quadros por segundo | 60 no editor; 60 no projetor; nunca abaixo de 30 |
| Tamanho de mapa | 60 × 60 células (90 m) |
| Objetos | 2.000 |
| Luzes dinâmicas | 32 com sombra |
| Tokens com visão | 8 |
| Primeira abertura de um mapa médio | Menos de 2 s com cache quente |

Os números são hipóteses até o spike medir.
