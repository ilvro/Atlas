import { codificar, decodificar, type Faixa } from './celulas.ts';
import { projetarParaJogadores } from './projecao.ts';
import type { MapaAtlas, Parede, Ponto } from './mapa.ts';
import { celulasVisiveis, RES_NEVOA } from './nevoa.ts';
import { podar } from './iniciativa.ts';

/**
 * A projeção remota (R5b): o que sai do computador do mestre para os navegadores dos jogadores. Parte de `projetarParaJogadores`
 * e corta tudo o que está fora de `explorado ∪ visível`, com 1 célula de folga (a "área"). Nada do que está fora da área
 * pode ser lido nas ferramentas do navegador. Sem névoa (`session.explored === null`), sai igual à projeção local.
 *
 * Campo a campo de `MapaAtlas`:
 * - `schema`, `version`, `id`, `revision`, `createdAt`, `updatedAt`: ficam (identificação, sem conteúdo do mapa).
 * - `name`: vira "Mapa". `groundLevelName` (se existe): vira "Mapa". `levels`: ficam as ids e a ordem; os nomes viram "Andar 1, 2…".
 * - `campanhaId`, `notes`, `comodosExtra`, `audioCue`, `climateAudio`, `customClimates`, `moments`: já saem vazios da projeção local.
 * - `grid`, `style`, `climate`, `finish`, `memory`: ficam (só estilo, sem posições; `memory` é cor de papel e tinta).
 * - `bounds`: fica (o tamanho do mapa, necessário para desenhar; não diz o que há dentro).
 * - `backdrop`: fica a cor e o material; o `title` (texto e posição) é cortado (`null`).
 * - `terrain.layers[].cells` e `terrain.relief.patamares[].cells`: recortados por faixa para a área. `base` fica; `submerged` já sai cortado.
 * - `presence`: as células de cada presença recortadas para a área; sem célula dentro, some.
 * - `rooms`: só as células dentro da área; sem nenhuma, o cômodo some. `name` e `function` vazios se o cômodo não está em `session.revealed`.
 *   O `outline` (contorno livre) só fica se o cômodo ficou inteiro; senão sai e valem as células.
 * - `walls`: cada parede é aparada ao trecho contínuo (o maior) que toca a área; sem trecho, some. A posição `at` das aberturas
 *   e dos objetos de parede é refeita para o trecho novo; os que caem fora saem. `source.roomId` de cômodo que sumiu vira `null`.
 * - `openings`: só as que ficam sobre o trecho mantido da parede.
 * - `props`: só os que têm a posição dentro da área; `interaction.note`, `noteTitle`, `toPosition` e `toLevel` saem (texto e destino).
 *   Um objeto de parede cuja parede sumiu sai também.
 * - `lights`: só as que têm a posição dentro da área.
 * - `regions`: todas saem (a projeção local já as deixa sem `payload` e `refs`; polígono fora da área não vai, e não há uso visual).
 * - `tokens`: os da projeção local (jogadores e o que está à vista); `refs` das peças que não são de jogador saem.
 * - `session.explored`: o explorado de verdade (já é o que os jogadores conhecem); `exploredLevels` sai; `event` vira `null`;
 *   `revealed` e `initiative` só com o que ficou; `roofs` fica.
 */
export function projetarParaRemoto(m: MapaAtlas, andar: string | null = null): MapaAtlas {
  const p = projetarParaJogadores(m, andar);
  if (p.session.explored === null) return p;
  const area = areaConhecida(p);

  p.name = 'Mapa';
  if (p.groundLevelName !== undefined) p.groundLevelName = 'Mapa';
  if (p.levels) {
    const ordenados = Object.values(p.levels).sort((a, b) => a.order - b.order);
    p.levels = Object.fromEntries(ordenados.map((a, i) => [a.id, { ...a, name: `Andar ${i + 1}` }]));
  }
  p.backdrop = { ...p.backdrop, title: null };

  // Terreno e presenças.
  const t = p.terrain.resolution;
  for (const [id, c] of Object.entries(p.terrain.layers)) {
    c.cells = area.recortar(c.cells, t);
    if (!c.cells.length) delete p.terrain.layers[id];
  }
  if (p.terrain.relief) {
    for (const [id, pat] of Object.entries(p.terrain.relief.patamares)) {
      pat.cells = area.recortar(pat.cells, t);
      if (!pat.cells.length) delete p.terrain.relief.patamares[id];
    }
  }
  for (const [id, x] of Object.entries(p.presence)) {
    x.cells = area.recortar(x.cells, t);
    if (!x.cells.length) delete p.presence[id];
  }

  // Cômodos.
  const revelados = new Set(p.session.revealed);
  const g = p.grid.size, [ox, oy] = p.grid.offset;
  for (const [id, r] of Object.entries(p.rooms)) {
    const todas = decodificar(r.cells);
    const dentro = todas.filter(([cx, cy]) => area.ponto(ox + (cx + 0.5) * g, oy + (cy + 0.5) * g));
    if (!dentro.length) { delete p.rooms[id]; continue; }
    if (dentro.length < todas.length) { r.cells = codificar(dentro); delete r.outline; }
    if (!revelados.has(id)) { r.name = ''; r.function = null; }
  }

  // Paredes (aparadas), aberturas e objetos de parede.
  const aparos = new Map<string, { s0: number; s1: number; comprimento: number }>();
  for (const [id, w] of Object.entries(p.walls)) {
    const r = aparar(w, area);
    if (!r) { delete p.walls[id]; continue; }
    w.path = r.path; aparos.set(id, { s0: r.s0, s1: r.s1, comprimento: r.comprimento });
    if (w.source && 'roomId' in w.source && !p.rooms[w.source.roomId]) w.source = null;
  }
  const refazer = (wallId: string, at: number): number | null => {
    const a = aparos.get(wallId); if (!a) return null;
    const novo = (at * a.comprimento - a.s0) / (a.s1 - a.s0);
    return novo >= 0 && novo <= 1 ? novo : null;
  };
  for (const [id, a] of Object.entries(p.openings)) {
    const novo = refazer(a.wallId, a.at);
    if (novo === null) delete p.openings[id]; else a.at = novo;
  }

  // Objetos e luzes.
  for (const [id, o] of Object.entries(p.props)) {
    if (!area.ponto(o.position[0], o.position[1])) { delete p.props[id]; continue; }
    if (o.wall) {
      const novo = refazer(o.wall.wallId, o.wall.at);
      if (novo === null) { delete p.props[id]; continue; }
      o.wall.at = novo;
    }
    if (o.interaction) {
      delete o.interaction.note; delete o.interaction.noteTitle; delete o.interaction.toPosition; delete o.interaction.toLevel;
    }
  }
  for (const [id, l] of Object.entries(p.lights)) if (!area.ponto(l.position[0], l.position[1])) delete p.lights[id];

  p.regions = {};
  for (const tk of Object.values(p.tokens)) if (!tk.player) tk.refs = [];

  p.session.event = null;
  p.session.initiative = podar(p.session.initiative, id => !!p.tokens[id]);
  const existe = (id: string) => ['rooms', 'walls', 'openings', 'props', 'lights', 'presence', 'tokens'].some(c => (p as unknown as Record<string, Record<string, unknown>>)[c]![id]);
  p.session.revealed = p.session.revealed.filter(existe);
  return p;
}

interface Area {
  /** O ponto (em metros) está na área? */
  ponto(x: number, y: number): boolean;
  /** Recorta faixas de células de lado `t` metros para a área. */
  recortar(faixas: readonly Faixa[], t: number): Faixa[];
}

/** `explorado ∪ visível` mais 1 célula de folga, em células de `RES_NEVOA`. */
function areaConhecida(p: MapaAtlas): Area {
  const res = p.session.explored?.res ?? RES_NEVOA;
  const base = [...(p.session.explored?.cells ?? []), ...celulasVisiveis(p, res)];
  const colunasPorLinha = new Map<number, Set<number>>();
  for (const [y, x0, n] of base) for (let j = y - 1; j <= y + 1; j++) {
    let l = colunasPorLinha.get(j); if (!l) colunasPorLinha.set(j, l = new Set());
    for (let i = x0 - 1; i <= x0 + n; i++) l.add(i);
  }
  const linhas = new Map<number, [number, number][]>();
  for (const [j, cols] of colunasPorLinha) {
    const ordem = [...cols].sort((a, b) => a - b), ints: [number, number][] = [];
    for (const i of ordem) { const u = ints.at(-1); if (u && u[1] === i) u[1] = i + 1; else ints.push([i, i + 1]); }
    linhas.set(j, ints);
  }
  return {
    ponto: (x, y) => colunasPorLinha.get(Math.floor(y / res))?.has(Math.floor(x / res)) ?? false,
    recortar(faixas, t) {
      const saida: Faixa[] = [];
      for (const [y, x0, n] of faixas) {
        const ints = linhas.get(Math.floor(((y + 0.5) * t) / res));
        if (!ints) continue;
        for (const [a, b] of ints) {
          const i0 = Math.max(x0, Math.ceil((a * res) / t - 0.5)), i1 = Math.min(x0 + n, Math.ceil((b * res) / t - 0.5));
          if (i1 > i0) saida.push([y, i0, i1 - i0]);
        }
      }
      return saida;
    },
  };
}

/** Apara a parede ao maior trecho contínuo dentro da área (amostras a cada meia célula). `null` se nenhum. */
function aparar(w: Parede, area: Area): { path: Ponto[]; s0: number; s1: number; comprimento: number } | null {
  const pts = w.path;
  if (pts.length < 2) return pts.length === 1 && area.ponto(pts[0]![0], pts[0]![1]) ? { path: pts.map(q => [...q] as Ponto), s0: 0, s1: 1e-9, comprimento: 1e-9 } : null;
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const L = acum[acum.length - 1]!;
  if (L === 0) return null;
  const em = (s: number): Ponto => {
    let i = 1; while (i < pts.length - 1 && acum[i]! < s) i++;
    const d = acum[i]! - acum[i - 1]!, f = d === 0 ? 0 : (s - acum[i - 1]!) / d;
    return [pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * f, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * f];
  };
  const passo = RES_NEVOA / 2, n = Math.max(1, Math.ceil(L / passo));
  const ss: number[] = []; for (let k = 0; k <= n; k++) ss.push(Math.min(L, k * passo));
  let melhor: [number, number] | null = null, ini = -1;
  for (let k = 0; k <= ss.length; k++) {
    const dentro = k < ss.length && (() => { const q = em(ss[k]!); return area.ponto(q[0], q[1]); })();
    if (dentro && ini < 0) ini = k;
    if (!dentro && ini >= 0) { if (!melhor || k - 1 - ini > melhor[1] - melhor[0]) melhor = [ini, k - 1]; ini = -1; }
  }
  if (!melhor) return null;
  const s0 = ss[melhor[0]]!, s1 = ss[melhor[1]]!;
  if (s1 <= s0) return null;
  const path: Ponto[] = [em(s0)];
  for (let i = 1; i < pts.length - 1; i++) if (acum[i]! > s0 && acum[i]! < s1) path.push([pts[i]![0], pts[i]![1]]);
  path.push(em(s1));
  return { path, s0, s1, comprimento: L };
}
