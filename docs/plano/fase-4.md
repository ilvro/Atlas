# Fase 4 — Climas e atmosfera

"O mesmo mapa, vários momentos." Critério de pronto da fase (ROADMAP): a casa da Fase 3 passa por dia → tempestade → noite → apagão ao vivo, sem editar nada, e cada momento parece outra cena.

Detalhado em 2 de novembro de 2026, contra o código da Fase 3. Faça na ordem da tabela; cada tarefa depende das anteriores do mesmo grupo.

## Decisões já tomadas (não rediscutir na implementação)

- **A luz vira um mapa de luz multiplicado sobre a cena**, como no protótipo (`spikes/estilos/src/main.js`, passes `luzBrutaRT` → `luzRT`). O brilho aditivo atual (`desenharLuz` em `src/render/cena.ts`) sai; o marcador da luz (círculo, cone, ponto) fica, porque é sobreposição do editor.
- **Tudo que o clima calcula é derivado, nunca gravado:** luzes das janelas, luzes apagadas no apagão, clarões. Funções puras em `src/domain/clima.ts`; o render só consome.
- **Documento v3** concentra todas as mudanças de esquema da fase numa tarefa só (4.2a).
- **`climate.sun` continua sendo o que o render usa.** O horário (`time`) serve para as predefinições e o inspetor preencherem `sun`, `ambient` e "é noite" por `ceuNoHorario`.
- **Áudio do clima é por mapa:** `climateAudio: Record<idDoClima, Ref>` (o mapa diz "Tempestade → cena X do Jukebox").
- **Transição de clima é do render:** o documento muda na hora (uma entrada de histórico) e o render interpola o que está exibindo. Desfazer também anima.
- O toggle "Ver no editor" do acabamento (`acabamentoLigado` em `src/app/app.ts`) passa a valer para toda a atmosfera (luz, partículas, neblina, acabamento). Rótulo novo: "Ver atmosfera no editor".

## Tarefas

| # | Tarefa | Tipo |
| --- | --- | --- |
| 4.1a | Visibilidade pura | domínio |
| 4.1b | Mapa de luz com sombras | render |
| 4.1c | Céu por horário | domínio |
| 4.1d | Luz do céu pelas janelas | domínio + render |
| 4.2a | Documento v3 | domínio |
| 4.2b | Predefinições de clima e comandos | domínio + estado |
| 4.2c | Seletor de clima | interface |
| 4.3a | Luzes que reagem ao clima | domínio + render |
| 4.3b | Relâmpago e trovão | render + som |
| 4.3c | Janelas acesas à noite | domínio + render |
| 4.4a | Partículas: base e chuva | render |
| 4.4b | Neve, poeira, brasas, folhas | render |
| 4.4c | Neblina | render |
| 4.5a | Mistura de climas | domínio |
| 4.5b | Transição animada | render |
| 4.6a | Pincel de presença | estado + ferramenta |
| 4.6b | Render de presença | render |
| 4.6c | Pacotes de presença | domínio + interface |
| 4.7a | Áudio do clima | app + interface |
| 4.8 | Validação da fase | e2e |

---

### 4.1a — Visibilidade pura  ⬜
Objetivo: dado o documento, calcular os segmentos que bloqueiam a luz e o polígono iluminado de uma fonte (círculo ou cone).
Depende de: —
Ler: `spikes/estilos/src/geometria.js` (`oclusores`, `raio`, `visibilidade`); `src/domain/geometria.ts` (`comprimentoDaParede`, `pontoNaParede`, `centroDaAbertura`).
Arquivos: criar `src/domain/visibilidade.ts`, `tests/unit/visibilidade.test.ts`.
Como:
1. `export interface Segmento { a: Ponto; b: Ponto }`.
2. `oclusores(m: Pick<MapaAtlas, 'walls' | 'openings'>, para: 'luz' | 'visao'): Segmento[]` — paredes com `blocks.light` (ou `blocks.sight` para visão), quebrando cada `path` em segmentos e **recortando o vão** das aberturas que deixam passar: `arch` sempre; `door`/`secret` com `state === 'open'`; `window` só para `'luz'`. O vão é o intervalo `centroDaAbertura ± width/2` ao longo do caminho.
3. `poligonoIluminado(o: Ponto, segs: readonly Segmento[], alcance: number, cone: { angle: number; direction: number } | null): number[]` — porta de `visibilidade` do protótipo (lista plana `[x, y, x, y…]`; com cone, começa em `o`). Mantenha as 96 direções de base e os ±1e-4 nos vértices.
4. `class IndiceDeSegmentos` (ou função que devolve `{ perto(o, alcance): Segmento[] }`): baldes de 4 m; `poligonoIluminado` recebe só os segmentos próximos.
Não fazer: nada de Pixi; nada de visão de token (Fase 7 usa a mesma função).
Testes: cômodo fechado não vaza luz para fora; porta fechada bloqueia e aberta deixa passar; janela deixa passar luz mas não visão; cone de 60° não ilumina atrás; índice devolve o mesmo resultado que a lista inteira.
Pronto quando: testes passam; `src/domain` continua sem importar render.
Commit: add pure light visibility

### 4.1b — Mapa de luz com sombras  ⬜
Objetivo: a cena passa a ser escurecida pelo ambiente e iluminada pelas luzes do mapa, com sombras das paredes.
Depende de: 4.1a
Ler: `spikes/estilos/src/main.js` (linhas ~70–100 e o laço, `atualizarLuz`); `src/render/cena.ts` (`criarCena`, `desenharLuz`, `sincronizar`); `src/render/luzes.ts`; `src/render/viewport.ts` (`aplicarAcabamento`, `aoQuadro`).
Arquivos: criar `src/render/mapa-de-luz.ts`; mudar `src/render/cena.ts`, `src/render/viewport.ts`, `src/app/app.ts` (rótulo do toggle), `src/ui/Inspetor.tsx` (rótulo).
Como:
1. `criarMapaDeLuz(renderer)` devolve `{ sprite, sincronizar(m), quadro(tempo), definirLigado(b), destruir() }`.
2. Dois `RenderTexture` de `bounds × RES_LUZ` (RES_LUZ = 8 px/m): bruta (luzes somadas) e final (limpa com a cor do ambiente `climate.ambient.color × intensity`, mais a bruta desfocada com `BlurFilter` em `add`).
3. Cada luz: `Sprite(texturaDeBrilho())` em `add`, tingido, `alpha = intensity`, mascarado por um `Graphics` com `poligonoIluminado`. Os polígonos só são refeitos em `sincronizar` quando mudam `lights`, `walls`, `openings` (use as `Mudancas` como `cena.sincronizar` faz); a tremulação (`flicker`) só mexe em `alpha` no `quadro`, com ruído (`valueNoise2D` de `src/procedural/ruido.ts`).
4. O `sprite` (textura final, escala `1/RES_LUZ`, `blendMode = 'multiply'`) entra em `cena.raiz` **logo depois de `paredesG`**, antes de regiões, marcadores de luz e peças.
5. Em `desenharLuz`, remova o brilho aditivo e a máscara; fique só com o marcador.
6. Toggle desligado → `sprite.visible = false` (editor vê o mapa claro).
Não fazer: janelas, clima, apagão (próximas tarefas); faixas do Pixel (Fase 8).
Testes: unitário não cabe (Pixi); rode `npm run test:e2e` — os testes da Fase 3 têm de continuar passando. Confira à mão: lamparina dentro de um cômodo não ilumina o vizinho com a porta fechada; abrir a porta deixa a luz passar.
Pronto quando: as luzes projetam sombra das paredes ao vivo e o FPS no editor continua em 60 com 10 luzes.
Commit: light map with wall shadows

### 4.1c — Céu por horário  ⬜
Objetivo: do horário `HH:MM`, obter sol ou lua, ambiente sugerido e se é noite.
Depende de: —
Ler: `src/domain/mapa.ts` (`Clima`); `spikes/estilos/src/climas.js` (cores dos climas).
Arquivos: criar `src/domain/clima.ts`, `tests/unit/clima.test.ts`.
Como:
1. `export interface Ceu { sun: Clima['sun']; ambient: Clima['ambient']; noite: boolean }`.
2. `ceuNoHorario(time: string): Ceu` — sol entre 06:00 e 18:00 (ângulo vai de leste a oeste, `angle` em rad; intensidade pico ao meio-dia; cor quente perto do nascer/pôr); fora disso lua (cor `#9fb3e8`, intensidade ~0.35) e `noite: true`. Ambiente interpolado entre âncoras (06h, 09h, 12h, 17h, 19h, 00h) com as cores do protótipo.
3. `ehNoite(m: Pick<MapaAtlas, 'climate'>): boolean` atalho para `ceuNoHorario(m.climate.time).noite`.
4. `lerHorario` valida `HH:MM` (lança `ErroDeValidacao` se não for).
Não fazer: tocar no render ou no store.
Testes: 12:00 tem sol mais forte que 07:00; 23:00 é noite com lua; 18:30 é noite; horário inválido lança.
Pronto quando: testes passam.
Commit: sky from time of day

### 4.1d — Luz do céu pelas janelas  ⬜
Objetivo: cada janela entre um cômodo e o lado de fora derrama a luz do sol ou da lua para dentro.
Depende de: 4.1b, 4.1c
Ler: `spikes/estilos/src/main.js` (`luzesJanela`); `src/domain/geometria.ts` (`salasDaAbertura`, `pontoNaParede`, `centroDaAbertura`, `comodoEm`).
Arquivos: mudar `src/domain/clima.ts`, `src/render/mapa-de-luz.ts`, `tests/unit/clima.test.ts`.
Como:
1. `luzesDerivadas(m: MapaAtlas): Luz[]` — para cada `openings` com `kind === 'window'` cuja parede tem cômodo de um lado só (`salasDaAbertura` devolve 1): luz em cone com id `janela:<id>`, posição 0.3 m para dentro do cômodo a partir do centro da janela, direção = normal para dentro (descubra o lado testando `comodoEm` nos dois lados), `angle` 2.1 rad, `radius` 9.5, cor e intensidade de `m.climate.sun` (nenhuma luz se `sun` for `null`), `power: 'magic'`, `on: true`, `ownerId: id da janela`.
2. O mapa de luz desenha `[...Object.values(m.lights), ...luzesDerivadas(m)]`; refaz as derivadas quando mudam `openings`, `walls`, `rooms` ou o campo `climate`.
Não fazer: clarão de relâmpago (4.3b); janela acesa para fora (4.3c).
Testes: janela externa gera uma luz apontando para dentro; janela entre dois cômodos não gera; `sun: null` não gera.
Pronto quando: de dia, uma sala escura com janela tem o facho da janela no piso.
Commit: sky light through windows

### 4.2a — Documento v3  ⬜
Objetivo: o documento ganha os campos de clima, áudio do clima, climas do usuário e presença por células, com migração 2→3.
Depende de: —
Ler: `src/domain/mapa.ts`; `src/domain/validacao.ts`; `src/domain/esquema.ts`; `src/domain/migracoes.ts` (`de1para2` como modelo); `tests/unit/fixtures.ts`; `tests/unit/dominio.test.ts` (testes de migração existentes).
Arquivos: mudar `src/domain/mapa.ts`, `src/domain/validacao.ts`, `src/domain/migracoes.ts`, `tests/unit/fixtures.ts`, `tests/unit/dominio.test.ts`.
Como:
1. `VERSAO_MAPA = 3`.
2. `Clima` ganha `weather: { rain: number; snow: number; fog: number; wind: number; dust: number; embers: number; leaves: number; lightning: number }` (todos 0–1; `wind` −1–1, sinal = direção) e `gridPower: boolean`.
3. `MapaAtlas` ganha `climateAudio: Record<string, Ref>` e `customClimates: Record<string, ClimaSalvo>` com `ClimaSalvo = { id: string; name: string; climate: Omit<Clima, 'preset'>; finish: Omit<Acabamento, 'preset'> }`.
4. `Presenca`: `mask` sai, entra `cells: Faixa[]` (mesma resolução do terreno, `terrain.resolution`).
5. `criarMapa` com os padrões (tudo 0, `gridPower: true`, objetos vazios); `de2para3` preenche os mesmos padrões e troca `mask` por `cells: []`.
6. Validação: limites dos números, refs válidos, células de presença dentro dos limites (copie a checagem das camadas de terreno).
Não fazer: comandos e interface.
Testes: mapa v2 (o da fixture antes da mudança) migra para v3 válido; campo desconhecido em `weather` é rejeitado; `lightning: 2` é rejeitado.
Pronto quando: `npm test` passa e um mapa salvo na Fase 3 abre sem erro.
Commit: map document v3 for climates

### 4.2b — Predefinições de clima e comandos  ⬜
Objetivo: nove climas prontos e os comandos para aplicar e salvar climas, cada um uma entrada de histórico.
Depende de: 4.1c, 4.2a
Ler: `src/domain/presets.ts` (`PRESETS_DE_ACABAMENTO` como modelo); `src/state/comandos.ts` (`clima.aplicar`, `mesclar`, `ROTULOS`); `spikes/estilos/src/climas.js`.
Arquivos: mudar `src/domain/presets.ts`, `src/state/comandos.ts`, `tests/unit/store.test.ts` (ou novo `tests/unit/climas.test.ts`).
Como:
1. `PresetDeClima { id; nome; descricao; climate: Omit<Clima, 'preset'>; finish: Omit<Acabamento, 'preset'> & { preset: string } }` e `PRESETS_DE_CLIMA` com: `manha`, `tarde`, `entardecer`, `noite`, `tempestade`, `neblina`, `neve`, `apagao`, `neon`. `sun`/`ambient` vêm de `ceuNoHorario(time)` com ajustes (tempestade e neblina escurecem; apagão `gridPower: false`; neon noite com acabamento saturado e tinta magenta/ciano). Mantenha a predefinição `dia` existente como alias de `tarde` para mapas antigos.
2. Comando `clima.predefinir { id }`: procura em `PRESETS_DE_CLIMA` e depois em `m.customClimates`; substitui `climate` inteiro (com `preset: id`) e `finish` inteiro. Rótulo "Clima: <nome>".
3. Comando `clima.salvar { nome }`: grava o clima e o acabamento atuais em `customClimates` com id `usuario-<uuid>`; `clima.esquecer { id }` remove (e a entrada de `climateAudio`).
4. `clima.aplicar` continua para ajustes finos (horário, chuva…); quando o patch muda `time`, recalcula `sun` e `ambient` por `ceuNoHorario`.
Não fazer: interface; animação.
Testes: cada predefinição produz documento válido; `clima.predefinir` é uma entrada e desfaz para o clima anterior; salvar → predefinir o salvo restaura os valores; id desconhecido lança `ErroDeComando`.
Pronto quando: testes passam.
Commit: climate presets and commands

### 4.2c — Seletor de clima  ⬜
Objetivo: trocar de clima pela aba Mapa, pela paleta de comandos e por atalho.
Depende de: 4.2b
Ler: `src/ui/Inspetor.tsx` (`PainelDoMapa`); `src/app/acoes.ts` (`ACOES`, `tratarTecla`); `src/ui/estilo.css` (chips e pílulas).
Arquivos: mudar `src/ui/Inspetor.tsx`, `src/app/acoes.ts`, `src/ui/estilo.css`.
Como:
1. Seção "Clima" na aba Mapa, acima de "Acabamento": grade de chips, um por predefinição e por clima salvo, cada um com uma amostra de cor (ambiente + tinta do acabamento); o ativo destacado.
2. Campos finos: horário (`HH:MM`), chuva, neve, neblina, vento, relâmpagos, "Energia da rede" (caixa) → `clima.aplicar`.
3. "Salvar este clima…" pede nome (campo inline) → `clima.salvar`; clima salvo tem "esquecer".
4. Ações na paleta: "Clima: <nome>" para cada predefinição (grupo "Clima"); atalhos `Alt+1` a `Alt+9` na ordem de `PRESETS_DE_CLIMA`.
Não fazer: dock de sessão (Fase 7).
Testes: unitário de `buscarAcoes('tempest')` achar a ação; e2e curto: clicar no chip "Noite" muda `climate.preset`.
Pronto quando: trocar de clima por qualquer dos três caminhos muda o documento e desfaz.
Commit: climate picker in inspector and palette

### 4.3a — Luzes que reagem ao clima  ⬜
Objetivo: luzes da rede apagam sem energia, `nightOnly` só acende à noite, e a queda de energia pisca antes de apagar.
Depende de: 4.1d, 4.2a
Ler: `src/domain/clima.ts`; `src/render/mapa-de-luz.ts`; `spikes/estilos/src/main.js` (`falhaRede`).
Arquivos: mudar `src/domain/clima.ts`, `src/render/mapa-de-luz.ts`, `tests/unit/clima.test.ts`.
Como:
1. `nivelDaLuz(l: Luz, m: MapaAtlas): number` (0 ou 1): `on === false` → 0; `power === 'grid'` e `!climate.gridPower` → 0; `nightOnly` e `!ehNoite(m)` → 0; senão 1.
2. O mapa de luz multiplica `alpha` por esse nível. Quando `gridPower` passa de `true` para `false`, as luzes `grid` piscam por 1,1 s (fórmula do protótipo) antes de apagar; de `false` para `true`, voltam com um piscar curto.
3. O marcador no editor mostra a luz apagada pelo clima com contorno tracejado (para o mestre entender por que não acende).
Não fazer: sobrescrita por luz na sessão (Fase 7).
Testes: tabela de casos de `nivelDaLuz` (grid/fire × energia × noite × nightOnly × on).
Pronto quando: aplicar "Apagão" apaga as lâmpadas piscando e deixa velas e lanternas acesas.
Commit: lights react to climate

### 4.3b — Relâmpago e trovão  ⬜
Objetivo: com `weather.lightning > 0`, clarões aleatórios entram pelas janelas e clareiam o ambiente, seguidos de trovão.
Depende de: 4.1d, 4.2a
Ler: `spikes/estilos/src/main.js` (`relampago`, `trovao`, `flash`, `clarao`, `proximoRaio`); `src/fx/som.ts`.
Arquivos: mudar `src/render/mapa-de-luz.ts`, `src/fx/som.ts`.
Como:
1. No `quadro` do mapa de luz: cronômetro com intervalo `4 + rand × 7 / lightning` s; o clarão segue a curva do protótipo (`sin(f·π·3)·f`, decaindo 2,2/s) e soma no ambiente (+0,35) e nas luzes `janela:*` (cor +0,6, intensidade +1,2).
2. `trovao()` em `som.ts`: ruído filtrado sintetizado (porte do protótipo), respeitando `somPreferido()`; tocado com atraso de 0,4–1,6 s.
3. `prefers-reduced-motion`: clarão com metade da força e sem tremer.
4. Exponha `relampagoAgora()` no mapa de luz (o dock da Fase 7 vai usar).
Não fazer: chuva (4.4a).
Testes: manual (aleatório); garanta que `lightning: 0` nunca dispara.
Pronto quando: na tempestade, a sala com janela pisca branca de tempos em tempos e o trovão vem depois.
Commit: lightning and thunder

### 4.3c — Janelas acesas à noite  ⬜
Objetivo: à noite, janelas de cômodos com luz acesa brilham para fora.
Depende de: 4.3a
Ler: `src/domain/clima.ts` (`luzesDerivadas`, `nivelDaLuz`).
Arquivos: mudar `src/domain/clima.ts`, `tests/unit/clima.test.ts`.
Como: em `luzesDerivadas`, se `ehNoite(m)` e o cômodo da janela tem ao menos uma luz com `nivelDaLuz = 1` e `position` dentro dele (`comodoEm`), gerar também `janela-fora:<id>`: cone para fora, raio 4, cor média das luzes do cômodo, intensidade 0,6.
Não fazer: nada no render além do que já consome `luzesDerivadas`.
Testes: noite + luz acesa → gera; dia → não; apagão sem velas → não.
Pronto quando: a casa vista de fora à noite mostra as janelas acesas.
Commit: lit windows at night

### 4.4a — Partículas: base e chuva  ⬜
Objetivo: um sistema de partículas leve e a chuva caindo só fora dos cômodos, inclinada pelo vento.
Depende de: 4.2a
Ler: `spikes/estilos/src/main.js` (`criarChuva`, laço da chuva); `src/render/cena.ts`.
Arquivos: criar `src/render/particulas.ts`; mudar `src/render/cena.ts`.
Como:
1. `criarParticulas()` → `{ raiz, sincronizar(m), quadro(dt) }` com `ParticleContainer` do Pixi 8 e um pool por tipo; quantidade proporcional à área do mapa × intensidade (teto de 4000).
2. Chuva: traços finos, velocidade ~18 m/s, deslocamento horizontal `wind × 0.4`; `alpha = weather.rain`.
3. Máscara: tudo menos os cômodos — um `Graphics` com as células de todos os cômodos usado como máscara invertida (`raiz.setMask({ mask, inverse: true })`), refeito quando `rooms` muda.
4. A camada fica acima do mapa de luz e abaixo dos marcadores (ARQUITETURA §5.1, camada 11).
Não fazer: outros tipos (4.4b); som de chuva (é do Jukebox).
Testes: e2e existentes passam; FPS em 60 com chuva 1 num mapa 45×30.
Pronto quando: aplicar "Tempestade" faz chover no terreno e não dentro da casa.
Commit: particle system and rain

### 4.4b — Neve, poeira, brasas, folhas  ⬜
Objetivo: os outros quatro tipos de partícula, cada um com seu movimento.
Depende de: 4.4a
Ler: `src/render/particulas.ts`.
Arquivos: mudar `src/render/particulas.ts`.
Como: neve (flocos que oscilam, só fora); poeira (pontos lentos, **dentro** dos cômodos, máscara normal); brasas (sobem, laranja, com `add`); folhas (giram e derivam com o vento, só fora). Intensidade por `weather.snow|dust|embers|leaves`. Uma textura pequena por tipo, gerada em canvas uma vez.
Não fazer: neblina.
Testes: manual; FPS com todos em 1.
Pronto quando: cada controle do inspetor liga seu tipo ao vivo.
Commit: snow, dust, embers and leaves

### 4.4c — Neblina  ⬜
Objetivo: neblina rasteira animada por ruído, com densidade por `weather.fog`.
Depende de: 4.2a
Ler: `src/render/acabamento.ts` (modelo de filtro com `GlProgram`, vértice e cuidados com GLSL ES 1.00).
Arquivos: criar `src/render/neblina.ts`; mudar `src/render/cena.ts`.
Como: um `Sprite` do tamanho do mapa com filtro próprio: fbm de 2 oitavas deslocado no tempo e pelo vento, cor puxada do ambiente, `alpha` máximo 0,55 × `fog`. Mais densa fora dos cômodos (máscara dos cômodos com 50% de força).
Não fazer: neblina como presença (é 4.6).
Testes: manual; FPS.
Pronto quando: o clima "Neblina" cobre o terreno com névoa que se move devagar.
Commit: animated fog

### 4.5a — Mistura de climas  ⬜
Objetivo: interpolar dois estados de clima + acabamento, para a transição.
Depende de: 4.2a
Ler: `spikes/estilos/src/climas.js` (`misturarClimas`).
Arquivos: mudar `src/domain/clima.ts`, `tests/unit/clima.test.ts`.
Como: `misturar(a, b, t)` sobre `{ climate, finish }` — números por `lerp`, cores hex por canal, `sun` nulo vira intensidade 0 com a cor do outro lado, `gridPower` vira número 0–1 (`rede`), `preset` e `time` do destino.
Não fazer: render.
Testes: `t = 0` é `a`, `t = 1` é `b`, meio-termo de cores; sol → nulo some suave.
Pronto quando: testes passam.
Commit: climate interpolation

### 4.5b — Transição animada  ⬜
Objetivo: trocar de clima anima luz, partículas, neblina e acabamento em ~1,6 s.
Depende de: 4.5a, 4.3a, 4.4a
Ler: `src/render/viewport.ts` (`aplicarAcabamento`, `aoQuadro`); `src/render/mapa-de-luz.ts`; `src/render/particulas.ts`.
Arquivos: mudar `src/render/viewport.ts`, `src/render/mapa-de-luz.ts`, `src/render/particulas.ts`, `src/render/neblina.ts`.
Como:
1. O viewport guarda `exibido` (`{ climate, finish }`). Quando a mudança toca `climate` ou `finish`, começa uma transição de `exibido` para o documento com suavização `t²(3−2t)`; `prefers-reduced-motion` ou efeitos desligados → instantâneo.
2. Mapa de luz, partículas, neblina e acabamento leem `exibido`, não o documento.
3. Edições finas no inspetor (arrastar chuva) não animam: transição só quando muda `climate.preset` (ou em desfazer/refazer).
Não fazer: duração configurável (dock da Fase 7).
Testes: e2e da 4.8 cobre.
Pronto quando: dia → noite escurece suave, a chuva aparece aos poucos, desfazer volta animando.
Commit: animated climate transitions

### 4.6a — Pincel de presença  ⬜
Objetivo: pintar e apagar presença por células, como o terreno.
Depende de: 4.2a
Ler: `src/state/comandos-construir.ts` (`terreno.pintar`, `terreno.apagar`); `src/render/pincel.ts`; `src/render/viewport.ts` (interação `'terreno'`); `src/app/acoes.ts` (`usarFerramenta`); `src/ui/Biblioteca.tsx` (aba do terreno).
Arquivos: mudar `src/render/pincel.ts`, `src/state/comandos-construir.ts`, `src/render/viewport.ts`, `src/ui/Biblioteca.tsx`, `src/app/acoes.ts`.
Como:
1. Ferramenta `'presenca'` (atalho `P`, está livre) e `Pincel.presenca = { brush: string; raio: number }`.
2. Comandos `presenca.pintar { brush, celulas }` (acha ou cria a entidade daquele `brush`, intensidade 0,6) e `presenca.apagar { brush | null, celulas }`; entidade sem células some.
3. Mesmo gesto do terreno: uma pincelada = uma entrada; Esc cancela.
4. Biblioteca: lista dos pincéis (por enquanto só `musgo` e `corrupcao`, até 4.6c).
5. Prévia provisória: células pintadas como contorno colorido (o efeito vem na 4.6b).
Não fazer: shader.
Testes: unitários dos comandos (pintar, apagar, entidade vazia some, desfazer).
Pronto quando: pintar musgo num canto e desfazer funciona.
Commit: presence brush tool

### 4.6b — Render de presença  ⬜
Objetivo: a presença aparece como efeito vivo: borda que cresce por ruído, pulsação e reação à luz.
Depende de: 4.6a, 4.1b
Ler: `src/render/acabamento.ts` (filtro); `src/render/cena.ts` (`sincronizarTerreno`, como as células viram textura); ARQUITETURA §5.7.
Arquivos: criar `src/render/presenca.ts`; mudar `src/render/cena.ts`.
Como:
1. Por entidade: máscara das células num canvas pequeno (1 px por célula de terreno), ampliada com `linear` e desfocada (borda macia).
2. Filtro com uniformes `cor`, `intensidade`, `tempo`, `pulso`: limiar por fbm que avança com `intensity` (0 recolhe, 1 expande até a máscara inteira), brilho pulsante para os sobrenaturais.
3. Camada 9b: acima do mapa de luz quando o pincel "brilha" (sobrenatural), abaixo quando é natural (musgo escurece com a luz).
4. `gmOnly` mostra com 50% e hachura no editor.
Não fazer: versão Pixel (Fase 8).
Testes: manual; FPS com 5 presenças.
Pronto quando: musgo parece musgo e mudar `intensity` no inspetor expande ou recolhe ao vivo.
Commit: animated presence rendering

### 4.6c — Pacotes de presença  ⬜
Objetivo: os pincéis naturais, sobrenaturais e de Ordem Paranormal, com aparência própria.
Depende de: 4.6b
Ler: `src/render/presenca.ts`; cores da Ficha em `../Ficha teste - Ordem II/src/systems/original/original-compendium.js` (`ELEMENT_COLORS`: Sangue `#e0150d`, Morte `#70707a`, Energia `#a230ed`, Conhecimento `#e5a11c`, Medo `#d5d7e0`) — só copiar os valores.
Arquivos: mudar `src/domain/presets.ts`, `src/render/presenca.ts`, `src/ui/Biblioteca.tsx`, `src/ui/Inspetor.tsx`.
Como:
1. `PINCEIS_DE_PRESENCA: { id; nome; pacote: 'natural' | 'sobrenatural' | 'ordem'; cor; brilho: boolean; pulso: number; escala: number }[]` — naturais: musgo, mofo, poça; sobrenaturais: corrupção, sombra; ordem: `ordem.sangue`, `ordem.morte`, `ordem.conhecimento`, `ordem.energia`, `ordem.medo`.
2. Biblioteca agrupada por pacote; inspetor da presença com intensidade (gesto) e `gmOnly`.
Não fazer: desenhos com símbolos (Fase 6, se fizer falta).
Testes: unitário: todo pincel tem id único e cor hex válida; validação aceita os ids.
Pronto quando: os dez pincéis pintam e cada um tem cara própria.
Commit: presence brush packs

### 4.7a — Áudio do clima  ⬜
Objetivo: cada clima pode apontar para uma cena do Jukebox; trocar de clima pede para tocá-la.
Depende de: 4.2b
Ler: `src/app/app.ts` (onde já emite `atlas.cena-aberta` pelo `barramento`); `mesa-core/src/eventos.ts` (`jukebox.tocar` é pedido com `ref`); `src/app/campanha.ts`; PLATAFORMA.md §5; ARQUITETURA §8.1.
Arquivos: mudar `src/state/comandos.ts`, `src/app/app.ts`, `src/ui/Inspetor.tsx`.
Como:
1. Comando `clima.audio { id, ref: Ref | null }` grava/remove em `climateAudio`.
2. Na seção Clima: "Som deste clima" com a lista de entidades da campanha ativa cujo `ref.app === 'jukebox'` (`listarEntidades`), mais "nenhum". Sem campanha, o campo explica por quê. É provisório: a escolha de verdade vem na 9.4.
3. Em `app.ts`, ao observar o documento: quando `climate.preset` muda e há `climateAudio[preset]`, `barramento.pedir('jukebox.tocar', { ref })`; sem resposta no prazo, nada acontece (sem erro na tela).
Não fazer: alterar o Jukebox; trovão (já é 4.3b).
Testes: unitário do comando; teste com barramento em memória (padrão de `mesa-core/tests/eventos.test.ts`) recebendo o pedido ao trocar de clima.
Pronto quando: com `mesa-dev`, trocar para Tempestade emite `jukebox.tocar` com o ref certo.
Commit: climate audio requests

### 4.8 — Validação da fase  ⬜
Objetivo: provar o critério de pronto e medir desempenho.
Depende de: todas
Ler: `tests/e2e/fase3.test.ts` (o teste da casa de três cômodos); `tests/e2e/apoio.ts`; `spikes/estilos/` (`window.atlas.fps` e `npm run medir`).
Arquivos: criar `tests/e2e/fase4.test.ts`; mudar `src/main.tsx` (expor `fps(ms)` no `__atlas`, igual ao protótipo), `progress.md`.
Como:
1. Monta a casa da Fase 3 (reaproveite os passos), põe uma janela externa e uma lâmpada `grid`.
2. Passa por Tarde → Tempestade → Noite → Apagão pelo seletor; a cada um, espera a transição, tira captura em `test-results/fase4-<clima>.png` (pasta já ignorada pelo git) e confere: documento não mudou fora de `climate`/`finish`; sem erros no console.
3. Mede FPS 5 s em 1920×1080 com tempestade (média e p5) e registra no progress.md.
4. Resumo da fase no progress.md (implementado, validação, pendências).
Não fazer: consertos grandes aqui; o que falhar vira pendência ou tarefa nova.
Testes: `npm run test:e2e` inteiro.
Pronto quando: e2e passa, FPS p5 ≥ 50, capturas mostram quatro cenas diferentes.
Commit: phase 4 e2e and report
