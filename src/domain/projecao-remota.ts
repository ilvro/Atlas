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
 * - `rooms`: só as células dentro da área; sem nenhuma, o cômodo some. `name` vira "Cômodo" (`validarMapa` recusa nome vazio) e `function` vira `null` se o cômodo não está em `session.revealed`.
 *   O `outline` (contorno livre) só fica se o cômodo ficou inteiro; senão sai e valem as células.
 * - `walls`: cada trecho contínuo da parede dentro da área vira uma parede própria; sem trecho, some. O trecho maior mantém o id
 *   original e os outros levam `<id>_2`, `<id>_3`… (pulando ids já usados). `source.roomId` de cômodo que sumiu vira `null`.
 * - `openings`: vão para o trecho que as contém (`wallId` e `at` refeitos); as que não caem em nenhum trecho saem.
 * - `props`: só os que têm a posição dentro da área; `interaction.note`, `noteTitle`, `toPosition` e `toLevel` saem (texto e destino).
 *   Um objeto de parede vai para o trecho que o contém (`wall.wallId` e `wall.at` refeitos) e sai se não cair em nenhum.
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
    if (!revelados.has(id)) { r.name = NOME_DO_COMODO_OCULTO; r.function = null; }
  }

  // Paredes (um trecho contínuo dentro da área vira uma parede), aberturas e objetos de parede.
  const trechosDe = new Map<string, { id: string; s0: number; s1: number; comprimento: number }[]>();
  const usados = new Set(Object.keys(p.walls));
  for (const [id, w] of Object.entries(p.walls)) {
    const trechos = aparar(w, area);
    delete p.walls[id];
    if (!trechos.length) continue;
    let maior = 0;
    trechos.forEach((t, i) => { if (t.s1 - t.s0 > trechos[maior]!.s1 - trechos[maior]!.s0) maior = i; });
    let n = 1;
    const lista = trechos.map((t, i) => {
      let novoId = id;
      if (i !== maior) { do { n++; novoId = `${id}${SEPARADOR_DE_TRECHO}${n}`; } while (usados.has(novoId)); usados.add(novoId); }
      const parte: Parede = { ...w, id: novoId, path: t.path };
      if (w.source && 'roomId' in w.source && !p.rooms[w.source.roomId]) parte.source = null;
      p.walls[novoId] = parte;
      return { id: novoId, s0: t.s0, s1: t.s1, comprimento: t.comprimento };
    });
    trechosDe.set(id, lista);
  }
  /** O trecho que contém `at` (fração da parede original) e o `at` refeito para ele. */
  const refazer = (wallId: string, at: number): { wallId: string; at: number } | null => {
    for (const t of trechosDe.get(wallId) ?? []) {
      const novo = (at * t.comprimento - t.s0) / (t.s1 - t.s0);
      if (novo >= 0 && novo <= 1) return { wallId: t.id, at: novo };
    }
    return null;
  };
  for (const [id, a] of Object.entries(p.openings)) {
    const novo = refazer(a.wallId, a.at);
    if (!novo) delete p.openings[id]; else { a.wallId = novo.wallId; a.at = novo.at; }
  }

  // Objetos e luzes.
  for (const [id, o] of Object.entries(p.props)) {
    if (!area.ponto(o.position[0], o.position[1])) { delete p.props[id]; continue; }
    if (o.wall) {
      const novo = refazer(o.wall.wallId, o.wall.at);
      if (!novo) { delete p.props[id]; continue; }
      o.wall.wallId = novo.wallId; o.wall.at = novo.at;
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

/** O nome neutro do cômodo ainda não revelado. */
export const NOME_DO_COMODO_OCULTO = 'Cômodo';

/** Separador do id dos trechos extras de uma parede (`<id>_2`). O `~` não passa em `IDENT` (`[A-Za-z0-9_-]`). */
const SEPARADOR_DE_TRECHO = '_';

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

/** Cada trecho contínuo da parede dentro da área (amostras a cada meia célula), em ordem ao longo da parede. */
function aparar(w: Parede, area: Area): { path: Ponto[]; s0: number; s1: number; comprimento: number }[] {
  const pts = w.path;
  if (pts.length < 2) return pts.length === 1 && area.ponto(pts[0]![0], pts[0]![1]) ? [{ path: pts.map(q => [...q] as Ponto), s0: 0, s1: 1e-9, comprimento: 1e-9 }] : [];
  const acum = [0];
  for (let i = 1; i < pts.length; i++) acum.push(acum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const L = acum[acum.length - 1]!;
  if (L === 0) return [];
  const em = (s: number): Ponto => {
    let i = 1; while (i < pts.length - 1 && acum[i]! < s) i++;
    const d = acum[i]! - acum[i - 1]!, f = d === 0 ? 0 : (s - acum[i - 1]!) / d;
    return [pts[i - 1]![0] + (pts[i]![0] - pts[i - 1]![0]) * f, pts[i - 1]![1] + (pts[i]![1] - pts[i - 1]![1]) * f];
  };
  const passo = RES_NEVOA / 2, n = Math.max(1, Math.ceil(L / passo));
  const ss: number[] = []; for (let k = 0; k <= n; k++) ss.push(Math.min(L, k * passo));
  const saida: { path: Ponto[]; s0: number; s1: number; comprimento: number }[] = [];
  const fechar = (k0: number, k1: number) => {
    const s0 = ss[k0]!, s1 = ss[k1]!;
    if (s1 <= s0) return;
    const path: Ponto[] = [em(s0)];
    for (let i = 1; i < pts.length - 1; i++) if (acum[i]! > s0 && acum[i]! < s1) path.push([pts[i]![0], pts[i]![1]]);
    path.push(em(s1));
    saida.push({ path, s0, s1, comprimento: L });
  };
  let ini = -1;
  for (let k = 0; k <= ss.length; k++) {
    const dentro = k < ss.length && (() => { const q = em(ss[k]!); return area.ponto(q[0], q[1]); })();
    if (dentro && ini < 0) ini = k;
    if (!dentro && ini >= 0) { fechar(ini, k - 1); ini = -1; }
  }
  return saida;
}

/**
 * Ids das peças de jogador cujas `refs` apontam para alguma ficha em `fichas` (`ficha/ficha/<id>`).
 * Usado pelo projetor remoto (R14) para destacar e liberar a peça própria do jogador.
 */
export function pecasDoJogador(doc: Pick<MapaAtlas, 'tokens'> | null | undefined, fichas: readonly string[]): Set<string> {
  const ids = new Set<string>();
  if (!doc || fichas.length === 0) return ids;
  const alvo = new Set(fichas);
  for (const t of Object.values(doc.tokens)) {
    if (!t.player) continue;
    if (t.refs.some(r => r.app === 'ficha' && r.tipo === 'ficha' && alvo.has(r.id))) {
      ids.add(t.id);
    }
  }
  return ids;
}
