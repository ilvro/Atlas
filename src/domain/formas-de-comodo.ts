/**
 * Contornos livres de cômodo (polígonos em metros, círculos e octógonos) e derivação
 * das células da grade cujo centro cai dentro do polígono.
 *
 * Convenção de coordenadas do Atlas: X cresce para a direita (leste) e Y cresce para
 * baixo (sul). Nesse plano, o sentido visual anti-horário corresponde a `areaComSinal < 0`,
 * o mesmo sentido produzido por `contornoDoComodo` (com normal interna `[dy, -dx]`).
 */
import type { MapaAtlas, Ponto } from './mapa.ts';

export const AREA_MINIMA_CONTORNO = 2;
export const MIN_VERTICES_CONTORNO = 3;
export const MAX_VERTICES_CONTORNO = 64;

const arred6 = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Área com sinal pela fórmula do cadarço. Negativa no sentido anti-horário do mapa (Y para baixo). */
export function areaComSinal(pts: readonly Ponto[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  let soma = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i]!, b = pts[(i + 1) % n]!;
    soma += a[0] * b[1] - b[0] * a[1];
  }
  return soma * 0.5;
}

/** Área positiva de um polígono simples, em m². */
export const areaDoPoligono = (pts: readonly Ponto[]): number => Math.abs(areaComSinal(pts));

/**
 * Polígono regular com `lados` vértices ao redor de `centro`, no sentido anti-horário do mapa.
 * `giro` em radianos desloca o primeiro vértice a partir do leste (`[centro[0] + raio, centro[1]]`).
 */
export function poligonoRegular(centro: Ponto, raio: number, lados: number, giro = 0): Ponto[] {
  const n = Math.max(MIN_VERTICES_CONTORNO, Math.min(MAX_VERTICES_CONTORNO, Math.round(lados)));
  const r = Math.max(0.1, raio);
  const saida: Ponto[] = [];
  for (let i = 0; i < n; i++) {
    const ang = giro - (2 * Math.PI * i) / n;
    saida.push([arred6(centro[0] + Math.cos(ang) * r), arred6(centro[1] + Math.sin(ang) * r)]);
  }
  return saida;
}

/** Aproximação circular por `lados` vértices (padrão 24) no sentido anti-horário do mapa. */
export const circulo = (centro: Ponto, raio: number, lados = 24): Ponto[] =>
  poligonoRegular(centro, raio, lados, 0);

/** Octógono regular com faces paralelas aos eixos cardeais (`giro = π/8`). */
export const octogono = (centro: Ponto, raio: number): Ponto[] =>
  poligonoRegular(centro, raio, 8, Math.PI / 8);

function orient(a: Ponto, b: Ponto, c: Ponto): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function noSegmento(a: Ponto, b: Ponto, p: Ponto, eps = 1e-9): boolean {
  return (
    Math.abs(orient(a, b, p)) <= eps &&
    p[0] >= Math.min(a[0], b[0]) - eps &&
    p[0] <= Math.max(a[0], b[0]) + eps &&
    p[1] >= Math.min(a[1], b[1]) - eps &&
    p[1] <= Math.max(a[1], b[1]) + eps
  );
}

function segmentosSeCruzam(a1: Ponto, a2: Ponto, b1: Ponto, b2: Ponto): boolean {
  const d1 = orient(b1, b2, a1), d2 = orient(b1, b2, a2);
  const d3 = orient(a1, a2, b1), d4 = orient(a1, a2, b2);
  const eps = 1e-9;
  if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) &&
      ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) {
    return true;
  }
  if (Math.abs(d1) <= eps && noSegmento(b1, b2, a1, eps)) return true;
  if (Math.abs(d2) <= eps && noSegmento(b1, b2, a2, eps)) return true;
  if (Math.abs(d3) <= eps && noSegmento(a1, a2, b1, eps)) return true;
  if (Math.abs(d4) <= eps && noSegmento(a1, a2, b2, eps)) return true;
  return false;
}

/** Verifica se o polígono tem ≥ 3 vértices finitos e nenhuma aresta não adjacente se cruza. */
export function ehPoligonoSimples(pts: readonly Ponto[]): boolean {
  const n = pts.length;
  if (n < 3) return false;
  for (const p of pts) if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) return false;

  for (let i = 0; i < n; i++) {
    const a1 = pts[i]!, a2 = pts[(i + 1) % n]!;
    if (Math.hypot(a2[0] - a1[0], a2[1] - a1[1]) <= 1e-9) return false;
    for (let j = i + 1; j < n; j++) {
      const b1 = pts[j]!, b2 = pts[(j + 1) % n]!;
      const adjacente = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacente) {
        // Duas arestas adjacentes não podem se dobrar uma sobre a outra (ângulo de 180° voltando).
        const compartilhado = j === i + 1 ? a2 : a1;
        const outroA = j === i + 1 ? a1 : a2;
        const outroB = j === i + 1 ? b2 : b1;
        const vax = outroA[0] - compartilhado[0], vay = outroA[1] - compartilhado[1];
        const vbx = outroB[0] - compartilhado[0], vby = outroB[1] - compartilhado[1];
        const cross = vax * vby - vay * vbx;
        const dot = vax * vbx + vay * vby;
        if (Math.abs(cross) <= 1e-9 && dot > 0) return false;
        continue;
      }
      if (segmentosSeCruzam(a1, a2, b1, b2)) return false;
    }
  }
  return true;
}

/**
 * Remove vértices repetidos consecutivos, vértices colineares redundantes e garante
 * orientação anti-horária no mapa (`areaComSinal < 0`).
 */
export function normalizarContorno(pts: readonly Ponto[]): Ponto[] {
  const semRepetidos: Ponto[] = [];
  for (const p of pts) {
    const clean: Ponto = [arred6(p[0]), arred6(p[1])];
    const ult = semRepetidos.at(-1);
    if (!ult || Math.hypot(clean[0] - ult[0], clean[1] - ult[1]) > 1e-6) {
      semRepetidos.push(clean);
    }
  }
  if (semRepetidos.length > 1) {
    const pri = semRepetidos[0]!, ult = semRepetidos.at(-1)!;
    if (Math.hypot(pri[0] - ult[0], pri[1] - ult[1]) <= 1e-6) semRepetidos.pop();
  }
  const limpos: Ponto[] = [];
  const n = semRepetidos.length;
  for (let i = 0; i < n; i++) {
    const ant = semRepetidos[(i - 1 + n) % n]!;
    const atu = semRepetidos[i]!;
    const prox = semRepetidos[(i + 1) % n]!;
    const v1x = atu[0] - ant[0], v1y = atu[1] - ant[1];
    const v2x = prox[0] - atu[0], v2y = prox[1] - atu[1];
    const l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
    const cross = Math.abs(v1x * v2y - v1y * v2x);
    if (l1 > 1e-6 && l2 > 1e-6 && cross <= 1e-6 * l1 * l2 && v1x * v2x + v1y * v2y > 0) continue;
    limpos.push(atu);
  }
  if (areaComSinal(limpos) > 0) limpos.reverse();
  return limpos;
}

/** Teste par-ímpar (ray casting) de ponto dentro de um polígono simples. */
export function pontoNoPoligono(p: Ponto, poligono: readonly Ponto[]): boolean {
  const n = poligono.length;
  if (n < 3) return false;
  let dentro = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poligono[i]!, b = poligono[j]!;
    if ((a[1] > p[1]) !== (b[1] > p[1])) {
      const xInter = ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0];
      if (p[0] < xInter) dentro = !dentro;
    }
  }
  return dentro;
}

/** Células não negativas da grade cujo centro cai dentro de `outline`. */
export function celulasDoContorno(
  grade: Pick<MapaAtlas['grid'], 'size' | 'offset'>,
  outline: readonly Ponto[],
): [number, number][] {
  if (outline.length < 3 || grade.size <= 0) return [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outline) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const t = grade.size, [ox, oy] = grade.offset;
  const i0 = Math.max(0, Math.floor((minX - ox) / t));
  const j0 = Math.max(0, Math.floor((minY - oy) / t));
  const i1 = Math.ceil((maxX - ox) / t);
  const j1 = Math.ceil((maxY - oy) / t);
  const saida: [number, number][] = [];
  for (let j = j0; j <= j1; j++) {
    const cy = oy + (j + 0.5) * t;
    for (let i = i0; i <= i1; i++) {
      const cx = ox + (i + 0.5) * t;
      if (pontoNoPoligono([cx, cy], outline)) saida.push([i, j]);
    }
  }
  return saida;
}
