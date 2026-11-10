/**
 * Formas do terreno em metros (disco, polígono, faixa, retângulo, células) e a conta que as transforma em células do terreno.
 * Pura: compartilhada pelo kit dos exemplos e pela construção por comandos (`construcao.ts`).
 */
import type { Ponto } from '../domain/mapa.ts';
import { fbm, valueNoise2D } from '../procedural/ruido.ts';

/** Retângulo de células do GRID: `[x0, y0, x1, y1]`, com `x1` e `y1` exclusivos. */
export type Ret = readonly [x0: number, y0: number, x1: number, y1: number];

/** `irregular`: amplitude (m) de um ruído suave na borda da forma; 0 ou ausente = borda lisa. Ex.: 0,3 a 0,8 para bordas naturais. */
export interface Irregular { irregular?: number }
/**
 * Uma região do mapa, em metros:
 *  - `{ disco: [x, y], raio }`
 *  - `{ poligono: [[x, y], ...] }`
 *  - `{ faixa: [[x, y], ...], largura }`: uma faixa ao longo de uma polilinha (trilha, rio, muro de rocha)
 *  - `{ retangulo: [x0, y0, x1, y1] }`
 *  - `{ celulas: [[i, j], ...] }`: células exatas do terreno (sem `irregular`)
 */
export type Forma =
  | ({ disco: Ponto; raio: number } & Irregular)
  | ({ poligono: readonly Ponto[] } & Irregular)
  | ({ faixa: readonly Ponto[]; largura: number } & Irregular)
  | ({ retangulo: readonly [x0: number, y0: number, x1: number, y1: number] } & Irregular)
  | { celulas: readonly (readonly [number, number])[] };

export interface Medida {
  caixa: { x0: number; y0: number; x1: number; y1: number };
  /** Distância assinada (m) à borda lisa: negativa dentro. */ sdf: (p: Ponto) => number;
  /** Dentro da forma, já com a borda irregular. */ dentro: (p: Ponto) => boolean;
}

const distSeg = (p: Ponto, a: Ponto, b: Ponto): number => {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy, t = q ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const distPolilinha = (p: Ponto, pts: readonly Ponto[]): number => {
  if (pts.length === 1) return Math.hypot(p[0] - pts[0]![0], p[1] - pts[0]![1]);
  let d = Infinity; for (let i = 0; i + 1 < pts.length; i++) d = Math.min(d, distSeg(p, pts[i]!, pts[i + 1]!)); return d;
};
const dentroDoPoligono = (p: Ponto, pts: readonly Ponto[]): boolean => {
  let dentro = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]!, b = pts[j]!;
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) dentro = !dentro;
  }
  return dentro;
};
const caixaDe = (pts: readonly Ponto[], folga: number) => ({
  x0: Math.min(...pts.map(p => p[0])) - folga, y0: Math.min(...pts.map(p => p[1])) - folga,
  x1: Math.max(...pts.map(p => p[0])) + folga, y1: Math.max(...pts.map(p => p[1])) + folga,
});

/** Escala (m) do ruído da borda irregular: ondulações de ~1,5 m. */
const ESCALA_DO_RUIDO = 1.5;

/** Chave de uma célula do terreno (`j * 65536 + i`). */
export const chaveDaCelula = (i: number, j: number): number => j * 65_536 + i;

/** Mede a forma: caixa, distância e "dentro". `resolucao` (m) só importa para `{ celulas }`; `sementeDoRuido` é a semente do ruído da borda irregular. */
export function medirForma(forma: Forma, resolucao: number, sementeDoRuido: number): Medida {
  const irr = 'irregular' in forma ? forma.irregular ?? 0 : 0;
  const ruido = valueNoise2D(sementeDoRuido);
  const tremor = irr > 0 ? (p: Ponto) => irr * (fbm(ruido, p[0] / ESCALA_DO_RUIDO, p[1] / ESCALA_DO_RUIDO, 3) * 2 - 1) * 1.6 : () => 0;
  let caixa: Medida['caixa'], sdf: (p: Ponto) => number;
  if ('disco' in forma) {
    const c = forma.disco, r = forma.raio; caixa = { x0: c[0] - r - irr, y0: c[1] - r - irr, x1: c[0] + r + irr, y1: c[1] + r + irr };
    sdf = p => Math.hypot(p[0] - c[0], p[1] - c[1]) - r;
  } else if ('poligono' in forma) {
    const pts = forma.poligono; if (pts.length < 3) throw new Error('Forma: um polígono precisa de ao menos 3 pontos.');
    caixa = caixaDe(pts, irr); sdf = p => { const d = distPolilinha(p, [...pts, pts[0]!]); return dentroDoPoligono(p, pts) ? -d : d; };
  } else if ('faixa' in forma) {
    const pts = forma.faixa; if (!pts.length) throw new Error('Forma: uma faixa precisa de ao menos 1 ponto.');
    const w = forma.largura / 2; caixa = caixaDe(pts, w + irr); sdf = p => distPolilinha(p, pts) - w;
  } else if ('retangulo' in forma) {
    const [x0, y0, x1, y1] = forma.retangulo; caixa = { x0: x0 - irr, y0: y0 - irr, x1: x1 + irr, y1: y1 + irr };
    sdf = p => { const dx = Math.max(x0 - p[0], p[0] - x1), dy = Math.max(y0 - p[1], p[1] - y1); return dx > 0 || dy > 0 ? Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) : Math.max(dx, dy); };
  } else {
    const res = resolucao, chaves = new Set(forma.celulas.map(([i, j]) => chaveDaCelula(i, j))), lista = forma.celulas;
    const xs = lista.map(c => c[0]), ys = lista.map(c => c[1]);
    caixa = { x0: Math.min(...xs) * res, y0: Math.min(...ys) * res, x1: (Math.max(...xs) + 1) * res, y1: (Math.max(...ys) + 1) * res };
    sdf = p => {
      if (chaves.has(chaveDaCelula(Math.floor(p[0] / res), Math.floor(p[1] / res)))) return -res / 2;
      let d = Infinity; for (const [i, j] of lista) d = Math.min(d, Math.hypot((i + 0.5) * res - p[0], (j + 0.5) * res - p[1])); return d - res / 2;
    };
    return { caixa, sdf, dentro: p => chaves.has(chaveDaCelula(Math.floor(p[0] / res), Math.floor(p[1] / res))) };
  }
  return { caixa, sdf, dentro: p => sdf(p) + tremor(p) <= 0 };
}

/** A semente do ruído da borda da forma de número `indice` (0, 1, 2…) num documento de semente `semente`. */
export const sementeDaForma = (semente: number, indice: number): number => semente * 31 + indice * 7919;

export interface OpcoesDaForma {
  /** Lado da célula do terreno (m). */ resolucao: number;
  /** Largura e altura do mapa (m): as células ficam dentro. */ largura: number; altura: number;
  /** Semente do ruído da borda irregular; mesma semente, mesma borda. */ semente: number;
}

/** As células `[i, j]` do terreno cobertas pela forma, dentro do mapa. */
export function celulasDaForma(forma: Forma, o: OpcoesDaForma): [number, number][] {
  const res = o.resolucao, colunas = Math.ceil(o.largura / res), linhas = Math.ceil(o.altura / res);
  return chavesDaForma(medirForma(forma, res, o.semente), res, colunas, linhas).map(k => [k % 65_536, Math.floor(k / 65_536)]);
}

/** Como `celulasDaForma`, mas a partir de uma `Medida` pronta e devolvendo chaves (`j * 65536 + i`). */
export function chavesDaForma(medida: Medida, res: number, colunas: number, linhas: number): number[] {
  const { caixa, dentro } = medida, saida: number[] = [];
  const i0 = Math.max(0, Math.floor(caixa.x0 / res)), i1 = Math.min(colunas - 1, Math.floor(caixa.x1 / res));
  const j0 = Math.max(0, Math.floor(caixa.y0 / res)), j1 = Math.min(linhas - 1, Math.floor(caixa.y1 / res));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (dentro([(i + 0.5) * res, (j + 0.5) * res])) saida.push(chaveDaCelula(i, j));
  return saida;
}
