# Frente W — Visão estilo Darkwood, Luz de Itens da Ficha e Sombreamento de Peças

Planejada em 2026-11-21. Esta frente resolve três problemas interligados de iluminação e visão tática na sessão do Atlas:

1. **Peças brilhando no escuro (4ª imagem de referência do usuário):** hoje `pecasC` é desenhado fora de `mundoIluminado` e acima do `MapaDeLuz`, com `tint = 0xffffff`. Quando uma peça entra numa sala ou região totalmente escura, o mapa ao redor fica preto, mas o token do personagem continua 100% aceso e visível.
2. **Ativar lanterna, lamparina ou item de luz da ficha no Atlas:** quando o personagem tem uma lanterna, lamparina, vela, tocha ou sinalizador na ficha do Dossiê, o jogador (ou o mestre) precisa poder ativar/desativar essa luz direto no Atlas e girar/mirar o facho, iluminando o ambiente ao redor.
3. **Rework da lógica de visão estilo *Darkwood* (1ª, 2ª e 3ª imagens de referência do usuário):**
   - Em *Darkwood*, o personagem tem um **cone de visão direcional** (apontado para onde ele olha/mira) combinado com uma **pequena bolha de percepção imediata 360°** ao redor dos pés.
   - **Dentro do alcance/cone de visão direta** (recortado por paredes, portas fechadas e obstáculos altos): tudo é visível com **cores reais, luz dinâmica e todos os detalhes, incluindo NPCs, monstros e elementos dinâmicos**.
   - **Fora da visão direta** (por exemplo, o mundo exterior quando o personagem está dentro de uma casa, ou os cômodos/corredores atrás das costas dele): o jogador **ainda enxerga a arquitetura e o mundo estático** (terreno, paredes, pisos, móveis fixos), porém **mais escuro, dessaturado e frio (penumbra periférica de *Darkwood*)**, e **não consegue ver coisas específicas/dinâmicas como NPCs, ameaças ou itens móveis ocultos**.

---

## Arquitetura e Decisões

### 1. Sombreamento de peças pela luz e escuridão do mapa (`W1`)
- `pecasC` continua acima das paredes e objetos para que os anéis de seleção, barras de PV/PD (`pips`), `badge` e indicadores de vez (`vezG`) nunca sejam borrados pelo bloom nem cobertos pela parede.
- Contudo, o **corpo visual da peça** (`corpo` em `src/render/pecas.ts`: o retrato em moeda, o standee imersivo ou o sprite pixel) passa a **receber a iluminação real do mapa no ponto `t.position`**:
  - O `MapaDeLuz` expõe um amostrador leve em CPU `amostrarLuzEm(ponto: Ponto): [r: number, g: number, b: number]` que calcula a soma da luz ambiente efetiva (interna se o ponto estiver em cômodo coberto, externa se ao ar livre, já com relâmpago/efeitos) mais a contribuição das luzes ativas (`todasAsLuzes()`) cujos polígonos de visibilidade (`poligono(id)`) contêm `ponto` (com queda suave pela distância e cone).
  - A cor de luz `[r, g, b]` (passada pela mesma curva de exposição/ACES ou clamp suave) multiplica o `tint` do `corpo` da peça (e a opacidade da sombra de contato nos pés da peça).
  - **Piso mínimo de silhueta (`LUZ_MINIMA_PECA_PROPRIA`):** na vista do mestre (`vista !== 'jogador'`), ou para a própria peça do jogador (`doJogador || t.player`), aplica-se um piso mínimo sutil (`~0.14` no jogador para a própria peça, `~0.28` na vista do mestre) para que o controlador ainda distinga a silhueta escura do personagem no breu sem que ele pareça aceso; já NPCs/ameaças no escuro (ou peças sem luz na vista dos jogadores) escurecem até o breu real do ambiente (`0.03`).

### 2. Itens emissores de luz da ficha (`Dossiê` ↔ `Atlas`) (`W2`, `W3`)
- **Detecção automática no Dossiê (`Dossie/src/mesa.js`):**
  - Ao publicar `ficha.recursos` (ou sincronizar a ficha), o Dossiê inspeciona o inventário/equipamentos da ficha (`sheet.inventory`, `sheet.items`, `sheet.attacks`) procurando nomes/chaves de itens que emitem luz e mapeia para os presets do Atlas:
    - `lanterna`, `flashlight`, `facho`, `farol` → preset `'lanterna'` (cone direcional de 60°, alcance 9 m, bateria);
    - `lamparina`, `lampiao`, `lampião`, `lanterna a oleo` → preset `'lamparina'` (360°, alcance 6 m, fogo);
    - `tocha`, `archote` → preset `'tocha'` (360°, alcance 7 m, fogo, tremor);
    - `vela`, `castical`, `castiçal`, `isqueiro`, `fosforo`, `fósforo` → preset `'vela'` (360°, alcance 2,5 m, fogo);
    - `sinalizador`, `flare`, `bastao de luz`, `bastão de luz`, `glowstick` → preset `'sinalizador'` (360°, alcance 8 m, cor quente/intensa).
  - O evento `ficha.recursos` passa a incluir opcionalmente `luzesDisponiveis?: string[]` (lista de presets disponíveis no inventário daquela ficha, ex.: `['lanterna', 'vela']`).
- **Ativação no Atlas (Mestre e Jogador):**
  - Novo pedido no contrato (`mesa-core/src/eventos.ts`): `atlas.luz-peca { mapa: string; peca: string; acao: 'alternar' | 'definir' | 'mirar'; preset?: string | null; direcao?: number }` (permitido ao mestre e, na sala online `Mesa/sala/permissoes.ts`, ao jogador dono da ficha vinculada à peça).
  - No `CartaoContextual.tsx` da peça (na Sessão), no `MenuRadial.tsx`, pela tecla de atalho **`L`** (ou **`F`** quando uma peça está selecionada na Sessão) e no **`Projetor.tsx` remoto** (botão flutuante `🔦 Lanterna` quando o jogador tem peça com item de luz na ficha ou `lightId` já atribuído):
    - Um clique **liga/desliga** a luz da peça (`Luz.on` ou cria a `Luz` com o preset do item da ficha se `t.lightId` ainda for `null`).
    - Se a ficha tiver mais de um item de luz (ou para o mestre, qualquer um de `['lanterna', 'lamparina', 'tocha', 'vela']`), permite trocar qual está ativo.
    - Com uma lanterna (cone) acesa na Sessão ou no Projetor remoto, segurar **`Alt` + mover o mouse** (ou arrastar o marcador de mira / teclas **`Q` e `E`**) gira suavemente a direção do facho (`cone.direction`) e o `facing` da peça para onde o cursor aponta!

### 3. Visão estilo *Darkwood* (`W4`, `W5`, `W6`)
- **Geometria do campo de visão (`W4`):**
  - `Peca.vision` ganha campos opcionais retrocompatíveis:
    - `mode?: 'cone' | 'circle'` (padrão `'cone'` quando o estilo de memória do mapa é `'darkwood'`, ou configurável por peça/mapa);
    - `angle?: number` (abertura do cone em graus, padrão `85°`);
    - `direction?: number` (direção do olhar em radianos; acompanha a direção da lanterna `lights[t.lightId].cone.direction` se houver, ou `DIRECAO_DO_LADO[t.facing]`, ou a mira do cursor);
    - `proximity?: number` (raio da bolha de percepção 360° imediata ao redor do corpo, padrão `1.8` m).
  - Em `poligonosDeVisao(m)` (`src/domain/nevoa.ts`):
    - Para cada peça de jogador com `vision.radius > 0`:
      - Se estiver em modo `'cone'` (estilo Darkwood): calcula **dois polígonos recortados pelos mesmos oclusores** (`paredes`, `portas fechadas`, `objetos altos que bloqueiam visão`):
        1. o **polígono do cone principal** (`poligonoIluminado(p, segs, r, { angle, direction })`);
        2. o **polígono da bolha de proximidade 360°** (`poligonoIluminado(p, segs, Math.min(r, proximity), null)`).
      - Assim, o personagem enxerga em detalhes o que está imediatamente ao seu redor (1,8 m, sem atravessar paredes!) e tudo o que está dentro do seu cone de visão longo!
- **Renderização da periferia / exterior estilo *Darkwood* (`W5`):**
  - `Memoria` (`src/domain/mapa.ts`) ganha `mode?: 'darkwood' | 'sketch' | 'shroud'` (quando ausente, se `sketch === false` usa `'shroud'`; o mestre pode escolher **"Darkwood (penumbra viva)"**, **"Esboço em papel"** ou **"Breu total"** no Inspetor, sendo **`'darkwood'` o novo padrão**).
  - No modo **`'darkwood'`**:
    - O que está **fora** de `poligonosDeVisao(m)` (por exemplo, o lado de fora da casa, outros quartos cujas portas estão fechadas, ou a área às costas do personagem) **NÃO é tapado por papel bege opaco nem por preto absoluto**.
    - Em vez disso, o renderizador da névoa (`src/render/nevoa.ts`) aplica sobre a área fora da visão direta uma **camada/filtro de penumbra Darkwood**:
      - A arquitetura e o terreno estático continuam visíveis por baixo, mas com **dessaturação forte (~82% grayscale), redução de brilho/exposição (~38% da luminância), tonalização fria/sombria (`#141820`) e vinheta suave na borda do cone**.
      - Áreas internas de cômodos ainda **nunca explorados** (`!contem(explorado, ...)`) permanecem fechadas pelo telhado (se tiverem telhado) ou em penumbra mais densa (`alpha ~0.82`), enquanto o exterior e as áreas já conhecidas ficam na penumbra viva de *Darkwood* (`alpha ~0.58` + dessaturação), exatamente como nas imagens 1, 2 e 3 de referência!
- **Ocultação estrita de NPCs e elementos dinâmicos fora do cone (`W6`):**
  - Na vista de jogador (`vista === 'jogador'` ou `modoDoProjetor`):
    - Qualquer peça que não seja de jogador (`!t.player`: NPCs, monstros, animais como o "Cachorro" da imagem 3) tem sua visibilidade testada contra os `poligonosDeVisao(m)` atuais (`pontoEmAlgumPoligono(t.position, poligonos)`).
    - Se estiver fora do cone/bolha de visão direta, a peça (e seus pips/anéis/luzes portadas ocultas) faz um **fade-out rápido (180 ms)** até `alpha = 0` (`visible = false`), e em `projetarParaJogadores` / `projetarParaRemoto` continua sendo filtrada para nunca vazar na rede!
    - Objetos do mapa marcados como `oculto` ou com nova flag opcional `dynamic?: boolean` (armadilhas reveladas, pistas no chão, cadáveres/itens dinâmicos) também só aparecem dentro do cone de visão direta!

---

## Tarefas

| # | Tarefa | Camada |
| --- | --- | --- |
| W1 | Sombras e escuridão afetam o token do personagem (`MapaDeLuz` → `PecaVisual`) | render |
| W2 | Contrato e Dossiê: detectar itens de luz na ficha e pedido `atlas.luz-peca` | contrato + dossiê + sala |
| W3 | Ativar e mirar lanterna/lamparina no Atlas (Sessão e Projetor do jogador) | app + interface |
| W4 | Geometria de visão estilo Darkwood: cone direcional + bolha de proximidade e mira | domínio |
| W5 | Renderização Darkwood: mundo exterior visível em penumbra dessaturada fora do cone | render + inspetor |
| W6 | Ocultação com fade de NPCs e objetos dinâmicos fora do cone de visão | render + projeção |

Ordem: W1, W2 e W4 podem começar em paralelo; W3 depende de W2; W5 e W6 dependem de W4.

---

### W1 — Sombras e escuridão afetam o token do personagem  ⬜
Objetivo: quando uma peça vai para uma região escura ou sombreada, o corpo do token escurece e recebe a cor da luz local em vez de continuar 100% aceso.
Depende de: —.
Ler: `src/render/mapa-de-luz.ts` (`todasAsLuzes`, `poligono`, `intensidade`, `ambiente`, `ambienteInterior`, `ehLuzExterna`), `src/render/pecas.ts` (`criarPeca`, `atualizar`, `tingir`), `src/render/cena.ts` (`desenharPeca`, `quadro`).
Arquivos: mudar `src/render/mapa-de-luz.ts`, `src/render/pecas.ts`, `src/render/cena.ts`; criarteste unitário em `tests/unit/luz-nas-pecas.test.ts`.
Como:
1. Em `src/render/mapa-de-luz.ts`:
   - Criar e exportar a função pura `calcularLuzNoPonto(ponto: Ponto, opcoes: { ambiente: readonly [number, number, number]; ambienteInterior: readonly [number, number, number]; emInteriorCoberto: boolean; luzes: readonly { luz: Luz; intensidade: number; poligono: readonly number[] | null }[] }): [number, number, number]`.
   - Para a base: usa `ambienteInterior` se `emInteriorCoberto` for verdadeiro, senão `ambiente`.
   - Para cada luz ativa com `intensidade > 0.01`: se `ponto` estiver a até `luz.radius` e dentro de `poligono` (quando presente), soma `corDaLuz * intensidade * quedaRadial(dist / luz.radius)` (a mesma curva suave `(1 - u*u)^2` de `texturaDeBrilho`).
   - Aplica a curva de tom `aces(canal * EXPOSICAO_PADRAO)` em cada canal `(r, g, b)` para obter um multiplicador RGB linear em `[0, 1]`.
   - Expor `amostrarPonto(ponto: Ponto): [number, number, number]` na interface `MapaDeLuz`.
2. Em `src/render/pecas.ts`:
   - Adicionar `definirLuzAmbiente(rgb: readonly [number, number, number], pisoMinimo: number): void` em `PecaVisual`.
   - Combinar a cor da luz `rgb` (aplicando `Math.max(pisoMinimo, canal)` para manter uma silhueta mínima quando aplicável) com a `tinta` de estado da figura (`aparenciaDoEstado`), aplicando o `tint` resultante ao `corpo` (retrato em moeda, retrato imersivo, sprite ou fundo da inicial), **sem** escurecer `anel`, `jogadorG`, `vezG`, `pips` nem `badge`.
   - No modo `immersive` ou `sprite`, modular também o `alpha` da sombra de chão da peça pela luminância da luz local (no breu total, a peça não projeta sombra preta mais escura que o chão).
3. Em `src/render/cena.ts`:
   - Ao desenhar/atualizar as peças em `quadro(agora)` e `sincronizar` (quando `atmosferaLigada` for `true`), consultar `luz.amostrarPonto(t.position)` e passar a `v.definirLuzAmbiente(rgb, piso)`:
     - Se `!atmosferaLigada` ou `vistaDaCena === 'construir'`: `[1, 1, 1]`, piso `1`.
     - Se `vistaDaCena === 'mestre'` (editor na Sessão): aplica a luz real com `piso = 0.28` (o mestre vê claramente que a peça está no escuro, mas ainda identifica o retrato).
     - Se `vistaDaCena === 'jogador'` (ou `modoDoProjetor`): para peças `t.player` usa `piso = 0.12` (silhueta escura no breu, como na 4ª imagem corrigida); para NPCs/ameaças (`!t.player`) usa `piso = 0.02`.
Testes: `calcularLuzNoPonto` devolve o ambiente puro fora das luzes, soma luz direta quando dentro do polígono de visão da luz, ignora luz bloqueada por parede (fora do polígono) e aplica o piso mínimo corretamente.
Pronto quando: num mapa noturno (`sala-da-guarda` ou mapa sem luz), mover a peça para fora das tochas escurece o personagem de acordo com a escuridão da cena.
Commit: `(visual) shade character tokens with local light and darkness`

---

### W2 — Contrato e Dossiê: detectar itens de luz na ficha e pedido `atlas.luz-peca`  ⬜
Objetivo: o Dossiê informa quais fontes de luz o personagem possui no inventário da ficha, e o contrato permite ativar/alternar/mirar a luz da peça no Atlas (local e online).
Depende de: —.
Ler: `Atlas/mesa-core/src/eventos.ts`, `Dossie/src/mesa.js`, `Mesa/sala/permissoes.ts`, `Mesa/src/online/protocolo.ts`.
Arquivos: mudar `Atlas/mesa-core/src/eventos.ts`, `Atlas/docs/PLATAFORMA.md`, `Dossie/src/mesa.js`, `Mesa/sala/permissoes.ts`; sincronizar `vendor/mesa-core/` em `Mesa`, `Dossie`, `Jukebox` e `Atelie`; testes.
Como:
1. Em `Dossie/src/mesa.js`:
   - Criar a função pura `luzesDoInventario(sheet): string[]` que inspeciona os itens de inventário/equipamento da ficha (`sheet.inventory`, `sheet.items`, `sheet.equipments`, `sheet.attacks`) procurando termos de fontes de luz (sem acento e minúsculo):
     - `lanterna`, `flashlight`, `farol`, `holofote` → `'lanterna'`
     - `lamparina`, `lampiao`, `lampião` → `'lamparina'`
     - `tocha`, `archote` → `'tocha'`
     - `vela`, `castical`, `isqueiro`, `fosforo` → `'vela'`
   - Em `recursosDaFicha(sheet)` e no envio de `ficha.recursos`, anexar `luzes?: string[]` (sem duplicatas) quando houver ao menos um item de luz na ficha.
2. Em `Atlas/mesa-core/src/eventos.ts`:
   - `ficha.recursos` continua aceitando campos extras (ou documenta `luzes?: string[]`).
   - Adicionar ao `CATALOGO` o pedido `'atlas.luz-peca': { dono: 'atlas', especie: 'pedido', obrigatorios: ['mapa', 'peca', 'acao'] }` com `acao: 'alternar' | 'definir' | 'mirar'`, `preset?: string | null` e `direcao?: number`.
   - Rodar `npm run build:core` no Atlas e copiar `dist/` para `vendor/mesa-core/` nos 4 repositórios (`Mesa`, `Dossie`, `Jukebox`, `Atelie`).
3. Em `Mesa/sala/permissoes.ts`:
   - Permitir ao jogador enviar o evento `atlas.luz-peca` (assim como já pode enviar `atlas.mover-peca`), carimbando `autor` na sala.
Testes: `luzesDoInventario` reconhece lanterna, lamparina, tocha e vela em diferentes formatos de inventário; `validarEvento` aceita `atlas.luz-peca`; `permitido` na sala aceita `atlas.luz-peca` de jogador.
Pronto quando: os testes do `mesa-core`, `Dossie` e `Mesa` passam com `vendor/mesa-core` sincronizado.
Commit: `(feature) publish sheet light items and allow toggling token light in contract`

---

### W3 — Ativar e mirar lanterna/lamparina no Atlas (Sessão e Projetor do jogador)  ⬜
Objetivo: o mestre e o jogador podem ativar/desativar a lanterna ou lamparina da ficha com um clique no Atlas e apontar o facho em tempo real.
Depende de: W2.
Ler: `src/app/fichas.ts` (`recursosDasFichas`), `src/ui/CartaoContextual.tsx`, `src/app/acoes.ts` (`itensDoMenuRadial`, `ACOES`), `src/app/app.ts` (`comLanterna`, `virarLanterna`, `iniciar`), `src/ui/Projetor.tsx`.
Arquivos: mudar `src/domain/fichas.ts`, `src/app/fichas.ts`, `src/app/app.ts`, `src/app/acoes.ts`, `src/ui/CartaoContextual.tsx`, `src/ui/Projetor.tsx`; criar `src/app/luz-da-peca.ts` e `tests/unit/luz-da-peca.test.ts`.
Como:
1. Em `src/domain/fichas.ts` e `src/app/fichas.ts`:
   - Guardar `luzes?: string[]` vindo de `ficha.recursos` em `Recursos` (`recursosDasFichas`).
   - Função `luzesDisponiveisParaPeca(m: MapaAtlas, t: Peca, recursos: Recursos | null): { presets: string[]; ativa: boolean; presetAtivo: string | null }`:
     - Se a peça tem ficha vinculada com `recursos?.luzes?.length`, lista esses presets (e o preset atual de `m.lights[t.lightId]` se já existir).
     - Se a peça não tem ficha (ou o mestre está controlando), oferece os presets padrão `['lanterna', 'lamparina', 'vela']`.
2. Criar `src/app/luz-da-peca.ts`:
   - `alternarLuzDaPeca(store, pecaId, presetPreferido?)`:
     - Se `t.lightId` já existe em `m.lights`: alterna `on: !luz.on` (ou troca para `presetPreferido` se informado e diferente).
     - Se `t.lightId` é `null`: cria a `Luz` na posição da peça com o primeiro preset disponível na ficha (ou `'lanterna'`), `ownerId: t.id`, `levelId: t.levelId`, apontando para `DIRECAO_DO_LADO[t.facing]`, e liga `t.lightId = nova.id`.
   - `mirarLuzDaPeca(store, pecaId, direcaoRad)`: atualiza `cone.direction` da luz da peça e o `facing` da peça (`peca.virar`).
   - Atendente de `atlas.luz-peca` no barramento (em `app.ts`): valida `autor` quando vier da sala (confere se `t.player` e se alguma `ref` de `t.refs` está em `autor.fichas`, como em `atenderMoverPeca`), e executa `alternarLuzDaPeca` ou `mirarLuzDaPeca`.
3. Na interface do Atlas (Sessão e Projetor):
   - **`CartaoContextual.tsx` (quando uma peça é selecionada na Sessão)**: botão **`🔦 Lanterna`** (acende/apaga a luz da peça; se a ficha tiver itens de luz, mostra o nome do item da ficha, ex.: *"🔦 Lanterna (acesa)"* ou *"🏮 Lamparina"*), mais seletor rápido se houver mais de um item de luz.
   - **`MenuRadial.tsx` (`itensDoMenuRadial` na Sessão)**: ao clicar com botão direito numa peça, inclui **"Acender/Apagar `<item de luz>`"**.
   - **Mira com o cursor na Sessão e no Projetor remoto**: com uma peça selecionada (ou a peça própria do jogador no `Projetor.tsx` remoto), segurar **`Alt` + mover o mouse** (ou clicar no botão `🔦` na barra do projetor remoto do jogador) aponta o facho da lanterna/visão para o cursor (enviando `atlas.luz-peca { acao: 'mirar', direcao }` com throttle de 12 Hz no remoto).
Testes: `alternarLuzDaPeca` cria luz com o preset da ficha, apaga e reacende; atendente remoto aceita o dono da ficha e recusa terceiros.
Pronto quando: um personagem com lanterna ou lamparina na ficha pode acendê-la e mirar o facho direto no Atlas e no projetor online.
Commit: `(feature) toggle and aim character sheet light items directly in atlas`

---

### W4 — Geometria de visão estilo Darkwood: cone direcional + bolha de proximidade  ⬜
Objetivo: o campo de visão das peças de jogador funciona como em *Darkwood*: um cone direcional para onde o personagem olha/mira somado a uma bolha curta de percepção imediata 360° ao redor do corpo, ambos bloqueados por paredes e obstáculos altos.
Depende de: —.
Ler: `src/domain/mapa.ts` (`Peca`, `Memoria`), `src/domain/validacao.ts`, `src/domain/nevoa.ts` (`poligonosDeVisao`, `calcularPoligonos`), `src/domain/visibilidade.ts` (`poligonoIluminado`, `oclusores`, `oclusoresDeObjetos`).
Arquivos: mudar `src/domain/mapa.ts`, `src/domain/validacao.ts`, `src/domain/nevoa.ts`; testes em `tests/unit/nevoa.test.ts`.
Como:
1. Em `src/domain/mapa.ts`:
   - Estender `Peca['vision']`:
     ```ts
     vision: {
       radius: number;
       dark: boolean;
       /** 'cone' (estilo Darkwood: cone direcional + bolha curta) ou 'circle' (360° clássico). Ausente segue o modo do mapa ('cone' quando memory.mode === 'darkwood'). */
       mode?: 'cone' | 'circle';
       /** Abertura do cone de visão em graus (30 a 360; padrão 85). */
       angle?: number;
       /** Direção do olhar em radianos; quando ausente, segue o cone da lanterna da peça ou `facing`. */
       direction?: number;
       /** Raio da bolha de percepção imediata 360° ao redor da peça em metros (padrão 1.8). */
       proximity?: number;
     };
     ```
   - Estender `Memoria`:
     ```ts
     export type ModoDeMemoria = 'darkwood' | 'sketch' | 'shroud';
     export interface Memoria {
       sketch: boolean;
       paper: string;
       ink: string;
       /** 'darkwood': mundo estático fora do cone visível em penumbra dessaturada, sem NPCs. 'sketch': esboço em papel. 'shroud': véu escuro só no explorado. */
       mode?: ModoDeMemoria;
     }
     ```
2. Em `src/domain/nevoa.ts`:
   - `direcaoDeVisaoDaPeca(m: Pick<MapaAtlas, 'lights'>, t: Peca): number`:
     1. se `typeof t.vision.direction === 'number'`, usa `t.vision.direction`;
     2. senão, se `t.lightId && m.lights[t.lightId]?.on && m.lights[t.lightId]?.cone`, usa `m.lights[t.lightId]!.cone!.direction` (a visão acompanha para onde a lanterna aponta!);
     3. senão, usa o ângulo de `t.facing` (`right: 0, down: π/2, left: π, up: -π/2`).
   - Em `calcularPoligonos(m)`:
     - Incluir nos segmentos bloqueadores de visão tanto `oclusores({ walls, openings }, 'visao')` quanto os polígonos dos objetos de piso que têm `o.blocks.sight === true` (pilares, armários altos, rochedos fechados), exceto objetos que contêm a própria peça.
     - Quando o modo efetivo de visão da peça for `'cone'` (`t.vision.mode === 'cone' || (t.vision.mode === undefined && (m.memory.mode ?? 'darkwood') === 'darkwood')`):
       - Gera o polígono do cone: `poligonoIluminado(p, segsPerto, r, { angle: ((t.vision.angle ?? 85) * Math.PI) / 180, direction: direcaoDeVisaoDaPeca(m, t) })`.
       - Gera o polígono da bolha de proximidade 360°: `rProx = Math.min(r, t.vision.proximity ?? 1.8)`; se `rProx > 0.2`, gera `poligonoIluminado(p, segsPerto, rProx, null)`.
       - Se a peça tiver uma luz 360° acesa (`lamparina`, `tocha`, `vela` sem cone), a bolha de visão clara se expande até `Math.min(r, luz.radius * 0.85)` dentro do cômodo iluminado; se tiver uma lanterna em cone acesa, o alcance do cone de visão vai até `Math.max(r, luz.radius)`.
     - Quando o modo efetivo for `'circle'`, mantém o círculo 360° atual (`poligonoIluminado(p, segsPerto, r, null)`).
   - Atualizar `peca.virar` (`src/state/comandos.ts`) para atualizar também `vision.direction` quando a peça gira o facho ou olha para uma direção.
Testes: em modo `'cone'`, um ponto a 5 m à frente da peça está dentro de `celulasVisiveis`, um ponto a 5 m atrás da peça está **fora**, e um ponto a 1,2 m atrás da peça (dentro da bolha `proximity = 1.8`) está **dentro** (desde que não haja parede entre eles).
Pronto quando: `poligonosDeVisao` produz o cone direcional + bolha de proximidade recortados pelas paredes e todos os testes unitários passam.
Commit: `(feature) directional vision cone and proximity bubble for darkwood vision`

---

### W5 — Renderização Darkwood: mundo exterior visível em penumbra dessaturada fora do cone  ⬜
Objetivo: fora do cone/alcance de visão direta (ex.: o mundo exterior quando o personagem está dentro de uma casa), o jogador ainda vê o terreno, paredes e arquitetura do mundo, porém mais escuro e dessaturado como em *Darkwood*, sem papel bege tapando a cena.
Depende de: W4.
Ler: `src/render/nevoa.ts`, `src/render/cena.ts`, `src/domain/projecao-remota.ts`, `src/ui/Inspetor.tsx`.
Arquivos: mudar `src/render/nevoa.ts`, `src/domain/projecao-remota.ts`, `src/ui/Inspetor.tsx`; criar `src/render/filtro-darkwood.ts`; testes.
Como:
1. Criar `src/render/filtro-darkwood.ts` (ou integrar em `src/render/nevoa.ts`):
   - No modo `modoDeMemoria(m) === 'darkwood'`:
     - Em vez de desenhar o fundo opaco (`backdrop.color`) ou o papel sépia (`memoria.textura`) cobrindo tudo o que está fora do visível, a camada de névoa aplica uma **cobertura translúcida + ColorMatrixFilter / shader de penumbra Darkwood** nas regiões fora da máscara `visível` (`rt(11)`):
       - **Dentro do cone + bolha de visão (`visível = 1`)**: `alpha = 0` na cobertura → o jogador vê a cena 100% nítida, com cores quentes reais, bloom e luz dinâmica.
       - **Fora do cone de visão (mundo exterior e arredores fora da linha de visão direta)**: a cena estática por baixo permanece visível através de um véu escuro azulado/frio (`#0b0e14`, `alpha ≈ 0.56` na área explorada/exterior e `alpha ≈ 0.72` em áreas distantes nunca visitadas, com desfoque suave na transição da borda do cone de visão + vinheta periférica).
       - Se o navegador estiver no caminho Ilustrado (`composicao-de-luz.ts`), passar opcionalmente a máscara `uVisivel` para o shader de composição para **dessaturar em ~80% (`mix(cor, vec3(luma) * vec3(0.78, 0.84, 0.94), 0.82 * (1.0 - vis))`) e reduzir o brilho em ~48%** fora do polígono de visão! Isso reproduz fielmente o visual de *Darkwood* das imagens 1, 2 e 3: o interior iluminado dentro do cone é colorido e quente, enquanto o exterior da casa e o que está atrás das paredes aparece em cinza-azulado escuro e atmosférico!
2. Em `src/domain/projecao-remota.ts`:
   - Quando `(m.memory.mode ?? 'darkwood') === 'darkwood'`, a projeção remota mantém a geometria estática do andar (terreno, paredes, aberturas não-secretas e móveis não-ocultos) para que o jogador online veja a silhueta escura do mundo exterior como em *Darkwood*, mas **continua removendo 100% dos nomes (`NOME_DO_COMODO_OCULTO`), notas, gatilhos, portas secretas, objetos `oculto` e todos os tokens não-jogadores (`!t.player`) fora da visão direta**.
3. Em `src/ui/Inspetor.tsx` (`ExploracaoDoMapa` / `PainelDoMapa`):
   - Adicionar seletor **"Modo de visão e névoa"**:
     - `darkwood`: *"Darkwood (cone de visão + mundo em penumbra)"* (padrão);
     - `sketch`: *"Esboço em papel (clássico)"*;
     - `shroud`: *"Breu (só explorado escurecido)"*.
   - Em `CamposDaPeca`, permitir ajustar **"Modo de visão"** (`Cone (Darkwood)` / `360°`) e **"Abertura do cone"** (`85°`).
Testes: teste unitário da função de cor/penumbra Darkwood fora do cone (dessaturação e escurecimento preservando contraste da arquitetura); teste de projeção remota em modo Darkwood garantindo que nenhum NPC, segredo ou texto vaza.
Pronto quando: dentro de uma casa no modo vista de jogador (`J`), o interior no cone da peça aparece colorido e iluminado, e o mundo exterior além das paredes aparece escuro e dessaturado no estilo *Darkwood*.
Commit: `(feature) darkwood vision mode renders areas outside line of sight in desaturated gloom`

---

### W6 — Ocultação com fade de NPCs e elementos dinâmicos fora do cone de visão  ⬜
Objetivo: fora do cone e da bolha de visão direta, NPCs, monstros e objetos dinâmicos desaparecem suavemente na vista dos jogadores (mesmo que estejam numa área iluminada ou já explorada).
Depende de: W4, W5.
Ler: `src/render/cena.ts` (`sincronizar`, `quadro`, `desenharPeca`, `sincronizarObjetos`), `src/domain/nevoa.ts` (`poligonosDeVisao`), `src/domain/projecao.ts` (`projetarParaJogadores`).
Arquivos: mudar `src/domain/nevoa.ts`, `src/domain/projecao.ts`, `src/render/cena.ts`; testes em `tests/unit/projecao.test.ts` e `tests/unit/nevoa.test.ts`.
Como:
1. Em `src/domain/nevoa.ts`:
   - Criar e exportar `pontoVisivelAgora(m: MapaAtlas, ponto: Ponto, margem = 0.25): boolean`: verifica diretamente se `ponto` (ou a borda do raio `margem`) está dentro de algum polígono de `poligonosDeVisao(m)` (teste ponto-em-polígono exato, mais preciso que a grade de 0,5 m de `celulasVisiveis`).
2. Em `src/domain/projecao.ts` (`projetarParaJogadores`):
   - Usar `pontoVisivelAgora(escopo, t.position, t.size * escopo.grid.size * 0.35)` para decidir se uma peça `!t.player` está visível. Se estiver fora do cone/bolha de visão direta, a peça e a luz que ela carrega são removidas da projeção dos jogadores — mesmo que o cômodo onde ela está já tenha sido explorado antes ou esteja iluminado por uma luz do mapa!
3. Em `src/render/cena.ts`:
   - Na vista de jogador (`vistaDaCena === 'jogador'` ou `modoDoProjetor`):
     - Para cada peça `!t.player`: calcular `visivel = pontoVisivelAgora(m, t.position, t.size * m.grid.size * 0.35)`.
     - Em `quadro(agora)`, interpolar `c.alpha` da peça não-jogadora em direção a `visivel ? 1 : 0` com constante de tempo de `150 ms` (e `c.visible = c.alpha > 0.01`).
     - Assim, quando o jogador vira o cone de visão na direção de um NPC/monstro (como o "Cachorro" da 3ª imagem de referência), o NPC surge suavemente da penumbra; quando o jogador desvia o olhar ou entra atrás de uma parede, o NPC some na penumbra enquanto o cenário estático continua visível em tom Darkwood!
Testes: um NPC posicionado num cômodo já explorado, mas atrás das costas da peça do jogador (fora do cone de visão), não aparece em `projetarParaJogadores` e fica com `alpha === 0` na vista de jogador; ao girar o cone da peça para o NPC, ele passa a `pontoVisivelAgora === true` e aparece.
Pronto quando: na vista de jogador (`J`), girar a lanterna/olhar (`Q`/`E` ou `Alt+mouse`) revela e esconde os NPCs dentro/fora do cone enquanto o mundo exterior permanece em penumbra Darkwood.
Commit: `(feature) hide npcs and dynamic tokens outside the active darkwood vision cone`
