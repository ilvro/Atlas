import type { Faixa } from './celulas.ts';
import { limparOrfaos, PAREDE_PADRAO } from './geometria.ts';
import type { MapaAtlas, Parede, Ponto } from './mapa.ts';
import { materialDe } from '../procedural/materiais.ts';

/**
 * Contorno de um maciço de terreno: as faixas da camada viram polilinhas (marching squares sobre os centros das células, depois
 * Douglas-Peucker). Um polígono fechado repete o primeiro ponto no fim; uma linha que chega à borda do mapa fica aberta
 * (o mapa não ganha parede em volta de si mesmo).
 */

/** Recuo do contorno para dentro da rocha, em células do terreno (0,25 m): o assar torce a borda visível em lóbulos de cerca de ±0,25 m. */
export const RECUO_DO_CONTORNO = 1;
/** Altura da escarpa gerada do maciço (m) e espessura do traço. */
export const ALTURA_DA_ESCARPA = 3;
const MAX_PONTOS_POR_PAREDE = 4000;

type Chave = number;
const chaveDoPonto = (x: number, y: number): Chave => (y + 4) * 1_000_003 + (x + 4);

/**
 * `contornar(faixas, res)`: polilinhas em metros ao redor das células das `faixas` (de `res` metros). `tolerancia` (m) é a do
 * Douglas-Peucker (meia célula por padrão). `limite = [colunas, linhas]` diz onde o mapa acaba: o que fica além é cópia da
 * célula da borda, então a rocha que encosta no limite não ganha contorno ali. `recuo` encolhe a rocha em células antes de contornar.
 */
export function contornar(faixas: readonly Faixa[], res: number, opcoes: { tolerancia?: number; limite?: readonly [number, number]; recuo?: number } = {}): Ponto[][] {
  if (!faixas.length) return [];
  const tol = opcoes.tolerancia ?? res / 2, recuo = opcoes.recuo ?? 0, limite = opcoes.limite;
  let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
  for (const [y, x, n] of faixas) { if (y < j0) j0 = y; if (y > j1) j1 = y; if (x < i0) i0 = x; if (x + n - 1 > i1) i1 = x + n - 1; }
  if (limite) { i0 = 0; j0 = 0; i1 = limite[0] - 1; j1 = limite[1] - 1; }
  // Grade com 1 célula de folga em volta (cópia da borda com `limite`, vazio sem ele).
  const P = 1 + recuo, ox = i0 - P, oy = j0 - P, W = i1 - i0 + 1 + 2 * P, H = j1 - j0 + 1 + 2 * P;
  let g = new Uint8Array(W * H);
  for (const [y, x, n] of faixas) { const r = y - oy; if (r < 0 || r >= H) continue; for (let k = 0; k < n; k++) { const c = x + k - ox; if (c >= 0 && c < W) g[r * W + c] = 1; } }
  if (limite) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const cx = Math.min(Math.max(x, P), W - 1 - P), cy = Math.min(Math.max(y, P), H - 1 - P);
      if (cx !== x || cy !== y) g[y * W + x] = g[cy * W + cx]!;
    }
  }
  for (let r = 0; r < recuo; r++) {
    const e = new Uint8Array(W * H), v = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? (limite ? g[Math.min(Math.max(y, 0), H - 1) * W + Math.min(Math.max(x, 0), W - 1)]! : 0) : g[y * W + x]!);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y * W + x] && v(x - 1, y) && v(x + 1, y) && v(x, y - 1) && v(x, y + 1)) e[y * W + x] = 1;
    g = e;
  }

  // Marching squares: cada quadrado entre quatro centros liga os pontos médios das arestas cortadas (coordenadas em meias células).
  const vizinhos = new Map<Chave, Chave[]>(), pos = new Map<Chave, [number, number]>();
  const liga = (ax: number, ay: number, bx: number, by: number) => {
    const ka = chaveDoPonto(ax, ay), kb = chaveDoPonto(bx, by);
    pos.set(ka, [ax, ay]); pos.set(kb, [bx, by]);
    (vizinhos.get(ka) ?? vizinhos.set(ka, []).get(ka)!).push(kb); (vizinhos.get(kb) ?? vizinhos.set(kb, []).get(kb)!).push(ka);
  };
  for (let y = 0; y + 1 < H; y++) for (let x = 0; x + 1 < W; x++) {
    const caso = g[y * W + x]! | (g[y * W + x + 1]! << 1) | (g[(y + 1) * W + x + 1]! << 2) | (g[(y + 1) * W + x]! << 3);
    if (caso === 0 || caso === 15) continue;
    const gx = x + ox, gy = y + oy, tx = 2 * gx + 2, ty = 2 * gy + 1, bx = 2 * gx + 2, by = 2 * gy + 3, lx = 2 * gx + 1, ly = 2 * gy + 2, rx = 2 * gx + 3, ry = 2 * gy + 2;
    const T = () => [tx, ty] as const, B = () => [bx, by] as const, L = () => [lx, ly] as const, R = () => [rx, ry] as const;
    const seg = (p: readonly [number, number], q: readonly [number, number]) => liga(p[0], p[1], q[0], q[1]);
    switch (caso) {
      case 1: case 14: seg(L(), T()); break;
      case 2: case 13: seg(T(), R()); break;
      case 3: case 12: seg(L(), R()); break;
      case 4: case 11: seg(R(), B()); break;
      case 6: case 9: seg(T(), B()); break;
      case 7: case 8: seg(L(), B()); break;
      case 5: seg(L(), T()); seg(R(), B()); break;
      case 10: seg(T(), R()); seg(L(), B()); break;
    }
  }

  // Encadeia: primeiro as linhas abertas (pontas de grau 1), depois os laços.
  const usado = new Set<Chave>(), cadeias: Ponto[][] = [];
  const andar = (inicio: Chave): Chave[] => {
    const seq = [inicio]; usado.add(inicio); let atual = inicio, anterior = -1;
    for (;;) {
      const proximo = vizinhos.get(atual)!.find(k => k !== anterior && !usado.has(k));
      if (proximo === undefined) { if (vizinhos.get(atual)!.some(k => k === seq[0] && k !== anterior) && seq.length > 2) seq.push(seq[0]!); break; }
      seq.push(proximo); usado.add(proximo); anterior = atual; atual = proximo;
    }
    return seq;
  };
  // A folga além do mapa (cópia da borda) é prendida ao limite: a linha termina na borda do mapa, não depois dela.
  const tx = limite ? limite[0] * res : Infinity, ty = limite ? limite[1] * res : Infinity;
  const emMetros = (seq: Chave[]): Ponto[] => seq.map(k => { const p = pos.get(k)!; return [Math.min(tx, Math.max(limite ? 0 : -Infinity, p[0] * res / 2)), Math.min(ty, Math.max(limite ? 0 : -Infinity, p[1] * res / 2))] as Ponto; });
  for (const [k, v] of vizinhos) if (v.length === 1 && !usado.has(k)) cadeias.push(simplificar(emMetros(andar(k)), tol, false));
  for (const k of vizinhos.keys()) if (!usado.has(k)) { const seq = andar(k); if (seq.length > 3 && seq[0] === seq.at(-1)) cadeias.push(simplificar(emMetros(seq), tol, true)); }
  return cadeias.filter(c => c.length >= 2);
}

function distSegmento(p: Ponto, a: Ponto, b: Ponto): number {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy;
  const t = q ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
}

/** Douglas-Peucker sem recursão. Um laço (primeiro = último ponto) é cortado em dois no ponto mais distante do início. */
function simplificar(pts: Ponto[], tol: number, fechado: boolean): Ponto[] {
  const n = pts.length; if (n < 3) return pts;
  const manter = new Uint8Array(n); manter[0] = manter[n - 1] = 1;
  const pilha: [number, number][] = [];
  if (fechado) {
    let longe = 1, dmax = -1; for (let i = 1; i < n - 1; i++) { const d = Math.hypot(pts[i]![0] - pts[0]![0], pts[i]![1] - pts[0]![1]); if (d > dmax) { dmax = d; longe = i; } }
    manter[longe] = 1; pilha.push([0, longe], [longe, n - 1]);
  } else pilha.push([0, n - 1]);
  while (pilha.length) {
    const [a, b] = pilha.pop()!; let m = -1, dm = tol;
    for (let i = a + 1; i < b; i++) { const d = distSegmento(pts[i]!, pts[a]!, pts[b]!); if (d > dm) { dm = d; m = i; } }
    if (m >= 0) { manter[m] = 1; pilha.push([a, m], [m, b]); }
  }
  return pts.filter((_, i) => manter[i]);
}

// ---------- Escarpas geradas do maciço ----------
const ehMacico = (material: string) => materialDe(material).uso === 'macico';
const idDaEscarpa = (camada: string, n: number) => `${camada}_e${n}`;

/**
 * Refaz as paredes `{ kind: 'cliff', source: { terrainLayerId } }` dos maciços do terreno: apaga as antigas das camadas pedidas
 * (todas, sem `camadas`) e cria as do contorno atual. Paredes de camadas que sumiram ou deixaram de ser maciço saem sempre, com
 * o que estava preso a elas. Uma função só para o comando de pintar/apagar terreno e para o Kit dos exemplos.
 */
export function atualizarEscarpasDoMacico(m: MapaAtlas, camadas?: ReadonlySet<string>): void {
  const removidas = new Set<string>();
  for (const p of Object.values(m.walls)) {
    if (!p.source || !('terrainLayerId' in p.source)) continue;
    const id = p.source.terrainLayerId, camada = m.terrain.layers[id];
    if (!camada || !ehMacico(camada.material) || !camadas || camadas.has(id)) { delete m.walls[p.id]; removidas.add(p.id); }
  }
  const res = m.terrain.resolution, limite = [Math.ceil(m.bounds.width / res), Math.ceil(m.bounds.height / res)] as const;
  for (const camada of Object.values(m.terrain.layers)) {
    if (!ehMacico(camada.material) || (camadas && !camadas.has(camada.id))) continue;
    let n = 0;
    for (const anel of contornar(camada.cells, res, { limite, recuo: RECUO_DO_CONTORNO })) {
      for (let a = 0; a < anel.length - 1; a += MAX_PONTOS_POR_PAREDE - 1) {
        const path = anel.slice(a, a + MAX_PONTOS_POR_PAREDE); if (path.length < 2) break;
        const parede: Parede = { id: idDaEscarpa(camada.id, n++), path, ...structuredClone(PAREDE_PADRAO), height: ALTURA_DA_ESCARPA, material: camada.material, kind: 'cliff', source: { terrainLayerId: camada.id } };
        m.walls[parede.id] = parede;
      }
    }
  }
  if (!removidas.size) return;
  // O que estava preso a uma parede que sumiu (e não voltou com o mesmo id) vai junto.
  for (const a of Object.values(m.openings)) if (!m.walls[a.wallId]) delete m.openings[a.id];
  for (const o of Object.values(m.props)) if (o.wall && !m.walls[o.wall.wallId]) delete m.props[o.id];
  limparOrfaos(m);
}

/** Células de uma camada, para saber se uma pincelada a mexeu (as faixas são imutáveis: igual em conteúdo = igual). */
export const mesmasFaixas = (a: readonly Faixa[], b: readonly Faixa[]): boolean => a === b || (a.length === b.length && a.every((f, i) => f[0] === b[i]![0] && f[1] === b[i]![1] && f[2] === b[i]![2]));
