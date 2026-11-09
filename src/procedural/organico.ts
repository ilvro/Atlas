import { poli, type Parte } from './descricao.ts';
import { tom } from './materiais.ts';

/**
 * Formas orgânicas para receitas e geradores: copas, neve, pelos e ossos. A luz vem sempre do noroeste (−x, −y), como no resto do Atlas.
 * Tudo aqui devolve partes comuns (`suave` nas pinceladas internas), então os dois estilos as interpretam.
 */

export const LUZ_X = -Math.SQRT1_2, LUZ_Y = -Math.SQRT1_2;

/** Uma fita contínua ao longo de uma polilinha, numa só parte (sem as emendas de `faixa`); `w` pode afinar nas pontas com `ponta`. */
export function tira(pts: readonly number[], w: number, mat: string, z: number, extra: Partial<Parte> = {}, ponta = 1): Parte {
  const n = pts.length / 2, esq: number[] = [], dir: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = pts[b * 2]! - pts[a * 2]!, dy = pts[b * 2 + 1]! - pts[a * 2 + 1]!, l = Math.hypot(dx, dy) || 1;
    const t = n > 1 ? i / (n - 1) : 0.5, k = ponta + (1 - ponta) * Math.sin(t * Math.PI), nx = (-dy / l) * (w / 2) * k, ny = (dx / l) * (w / 2) * k;
    esq.push(pts[i * 2]! + nx, pts[i * 2 + 1]! + ny); dir.push(pts[i * 2]! - nx, pts[i * 2 + 1]! - ny);
  }
  const volta: number[] = []; for (let i = n - 1; i >= 0; i--) volta.push(dir[i * 2]!, dir[i * 2 + 1]!);
  return poli([...esq, ...volta], mat, z, extra);
}

export interface Disco { x: number; y: number; r: number }

/** O contorno da união de discos vista de (cx, cy), em `passos` raios: serve a silhuetas estreladas a partir do centro (copas, montes). */
export function silhuetaDeDiscos(discos: readonly Disco[], passos = 96, cx = 0, cy = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < passos; i++) {
    const a = (i / passos) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
    let m = 0;
    for (const d of discos) {   // a saída mais distante do raio pelo disco
      const ox = d.x - cx, oy = d.y - cy, b = ox * ux + oy * uy, c = ox * ox + oy * oy - d.r * d.r, delta = b * b - c;
      if (delta >= 0) m = Math.max(m, b + Math.sqrt(delta));
    }
    pts.push(cx + ux * m, cy + uy * m);
  }
  return pts;
}

/** Um polígono de borda irregular (bolha) com `n` vértices: raio `rx` × `ry`, ondulação `irreg` (0 a 0,5). */
export function bolha(cx: number, cy: number, rx: number, ry: number, n: number, irreg: number, r: () => number, giro = 0): number[] {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) { const a = giro + (i / n) * Math.PI * 2, k = 1 - irreg + r() * irreg * 2; pts.push(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k); }
  return pts;
}

/** Os tons de um tufo, do escuro (fundo e frestas) ao brilho. */
export interface Tons { fundo: string; base: string; meio: string; luz: string; brilho: string }

/**
 * Um tufo arredondado pintado como nas copas ilustradas: a base escura inteira, o meio-tom deslocado para a luz, a luz e o brilho
 * cada vez menores e mais para o noroeste. Opcional: `folhas` pinceladas pequenas (textura) no meio-tom e na luz.
 */
export function tufo(partes: Parte[], r: () => number, x: number, y: number, raio: number, tons: Tons, z: number, folhas = 0, borda = 18, recorte = 0): void {
  const forma = (k: number, dx: number, dy: number, irr: number) => bolha(x + dx * raio, y + dy * raio, raio * k, raio * k * 0.96, borda, irr, r, r() * 6);
  const o = { contorno: false as const, semSombra: true, suave: true };
  partes.push(poli(forma(1, 0, 0, 0.06), tons.base, z, { ...o, detalhe: 1 }));
  // Recorte: ondinhas da cor da base na borda, que quebram o círculo.
  for (let i = 0; i < recorte; i++) { const a = (i / recorte) * Math.PI * 2 + r() * 0.4, d = raio * (0.86 + r() * 0.06), t = raio * (0.16 + r() * 0.08); partes.push(poli(bolha(x + Math.cos(a) * d, y + Math.sin(a) * d, t, t, 8, 0.1, r), tons.base, z, { ...o, detalhe: 2 })); }
  partes.push(poli(forma(0.8, LUZ_X * 0.13, LUZ_Y * 0.13, 0.08), tons.meio, z + 0.01, { ...o, detalhe: 1 }));
  partes.push(poli(forma(0.46 + r() * 0.14, LUZ_X * (0.26 + r() * 0.1), LUZ_Y * (0.26 + r() * 0.1), 0.14), tons.luz, z + 0.02, { ...o, detalhe: 2 }));
  if (r() < 0.45) partes.push(poli(forma(0.2 + r() * 0.08, LUZ_X * (0.42 + r() * 0.12), LUZ_Y * (0.42 + r() * 0.12), 0.18), tons.brilho, z + 0.03, { ...o, detalhe: 3, alfa: 0.75 }));
  for (let i = 0; i < folhas; i++) {
    const a = r() * Math.PI * 2, d = raio * Math.sqrt(r()) * 0.8, fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d;
    const lado = (fx - x) * LUZ_X + (fy - y) * LUZ_Y, cor = lado > raio * 0.15 ? tom(tons.luz, 0.12) : lado < -raio * 0.3 ? tons.base : tons.meio;
    partes.push(lente(fx, fy, r() * Math.PI * 2, raio * (0.2 + r() * 0.12), raio * 0.09, cor, z + 0.025, { ...o, detalhe: 3 }));
  }
}

/** Os tons escurecidos (`t` < 0) ou clareados de um conjunto: o volume da copa inteira (tufos do lado da sombra mais escuros). */
export function tonsComLuz(t: Tons, k: number): Tons {
  const f = (c: string) => tom(c, k);
  return { fundo: t.fundo, base: f(t.base), meio: f(t.meio), luz: f(t.luz), brilho: f(t.brilho) };
}

/** Uma lente (folha, pelo, galho) com base em (x, y), apontando para `ang`. */
export function lente(x: number, y: number, ang: number, len: number, w: number, mat: string, z: number, extra: Partial<Parte> = {}): Parte {
  const c = Math.cos(ang), s = Math.sin(ang), local = [0, 0, len * 0.3, w / 2, len * 0.7, w / 3, len, 0, len * 0.7, -w / 3, len * 0.3, -w / 2], pts: number[] = [];
  for (let i = 0; i < local.length; i += 2) pts.push(x + local[i]! * c - local[i + 1]! * s, y + local[i]! * s + local[i + 1]! * c);
  return poli(pts, mat, z, extra);
}

/** Mancha macia no chão (sombra de contato, poeira, mancha): cinco veladuras concêntricas, da borda larga e rala ao miolo, que desfocam a borda. */
export function sombraNoChao(partes: Parte[], pts: readonly number[], z = 0.05, cor = '#0d0a08', forca = 0.5, desvio: [number, number] = [0.05, 0.06]): void {
  let cx = 0, cy = 0; const n = pts.length / 2; for (let i = 0; i < pts.length; i += 2) { cx += pts[i]!; cy += pts[i + 1]!; }
  cx /= n; cy /= n;
  for (let k = 0; k < 5; k++) {
    const e = 1.1 - k * 0.07, t = k / 4;
    partes.push(poli(pts.map((v, i) => (i % 2 ? cy + (v - cy) * e + desvio[1] * (1 - t) : cx + (v - cx) * e + desvio[0] * (1 - t))), cor, z + k * 0.001, { contorno: false, semSombra: true, suave: true, alfa: forca * 0.22, detalhe: 2 }));
  }
}
