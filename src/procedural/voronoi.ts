import { hash2D } from './ruido.ts';

/** Um sítio de Voronoi: posição, índice na grade e um número estável em [0, 1) para variar o tom, o ângulo etc. de cada célula. */
export interface Sitio { x: number; y: number; i: number; j: number; azar: number }
/** A resposta de uma consulta: o sítio mais próximo, as duas menores distâncias e a diferença entre elas (zero na fenda). */
export interface Consulta { f1: number; f2: number; /** `f2 − f1`, sempre ≥ 0: pequena perto da borda entre duas células. */ borda: number; sitio: Sitio }
export interface Voronoi {
  tamanho: number;
  /** Os sítios que caem em `area` (ou, sem ela, na área dada ao criar). */
  sitios(area?: { x: number; y: number; w: number; h: number }): Sitio[];
  /** Distâncias e sítio mais próximo de um ponto. Passe `saida` para reaproveitar o objeto num laço quente. */
  consultar(x: number, y: number, saida?: Consulta): Consulta;
  /** Atalho: a distância à borda mais próxima (F2 − F1). */
  bordaEm(x: number, y: number): number;
}

/**
 * Células de Voronoi com um sítio por quadradinho de uma grade de lado `tamanhoMedio`, deslocado por jitter. Determinístico e
 * infinito: o sítio de cada quadradinho sai de um hash (`seed`), então a mesma semente dá sempre as mesmas células, em qualquer área.
 */
export function celulasDeVoronoi(area: { x: number; y: number; w: number; h: number }, tamanhoMedio: number, seed: number): Voronoi {
  const t = Math.max(1e-4, tamanhoMedio), s = Math.floor(seed) || 0;
  const sitioDe = (i: number, j: number, para?: Sitio): Sitio => {
    const o = para ?? { x: 0, y: 0, i, j, azar: 0 };
    o.i = i; o.j = j; o.x = (i + 0.12 + 0.76 * hash2D(i, j, s)) * t; o.y = (j + 0.12 + 0.76 * hash2D(i, j, s + 7919)) * t; o.azar = hash2D(i, j, s + 104729);
    return o;
  };
  const consultar = (x: number, y: number, saida?: Consulta): Consulta => {
    const ci = Math.floor(x / t), cj = Math.floor(y / t);
    let d1 = Infinity, d2 = Infinity, bi = 0, bj = 0, bx = 0, by = 0, ba = 0;
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
      const sx = (i + 0.12 + 0.76 * hash2D(i, j, s)) * t, sy = (j + 0.12 + 0.76 * hash2D(i, j, s + 7919)) * t, d = (sx - x) * (sx - x) + (sy - y) * (sy - y);
      if (d < d1) { d2 = d1; d1 = d; bi = i; bj = j; bx = sx; by = sy; ba = 0; } else if (d < d2) d2 = d;
    }
    ba = hash2D(bi, bj, s + 104729);
    const f1 = Math.sqrt(d1), f2 = Math.sqrt(d2), o = saida ?? { f1: 0, f2: 0, borda: 0, sitio: { x: 0, y: 0, i: 0, j: 0, azar: 0 } };
    o.f1 = f1; o.f2 = f2; o.borda = f2 - f1; o.sitio.x = bx; o.sitio.y = by; o.sitio.i = bi; o.sitio.j = bj; o.sitio.azar = ba;
    return o;
  };
  return {
    tamanho: t,
    sitios(a = area) {
      const r: Sitio[] = [];
      for (let j = Math.floor(a.y / t) - 1; j <= Math.ceil((a.y + a.h) / t) + 1; j++) for (let i = Math.floor(a.x / t) - 1; i <= Math.ceil((a.x + a.w) / t) + 1; i++) {
        const p = sitioDe(i, j); if (p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h) r.push(p);
      }
      return r;
    },
    consultar,
    bordaEm: (x, y) => consultar(x, y).borda,
  };
}
