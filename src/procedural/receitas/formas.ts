import { elipse, poli, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { LUZ_X, LUZ_Y, bolha, tira } from '../organico.ts';

// Formas, referenciais e paletas compartilhadas entre os kits de época (sem depender de nenhum kit).

export const O = { contorno: false as const, semSombra: true };
export const S = { ...O, suave: true };
const LUZ_A = Math.atan2(LUZ_Y, LUZ_X);

/** Os tons de um material de pedra, madeira ou metal, do nanquim (silhueta) ao brilho. */
export interface Tons { nanquim: string; sombra: string; base: string; meio: string; luz: string; brilho: string }
export const BRONZE: Tons = { nanquim: '#1a120a', sombra: '#4a3418', base: '#74522a', meio: '#8e6834', luz: '#b08646', brilho: '#d8b26c' };
export const OURO: Tons = { nanquim: '#2a1a06', sombra: '#7a5418', base: '#a27424', meio: '#bc8c2e', luz: '#d6aa44', brilho: '#f0d684' };
export const PATINA = '#4f8a72';
export const MADEIRA: Tons = { nanquim: '#1c1008', sombra: '#432814', base: '#62401f', meio: '#7a5229', luz: '#946637', brilho: '#b88a52' };
export const LATAO: Tons = { nanquim: '#241806', sombra: '#6a4c16', base: '#946e26', meio: '#ad8532', luz: '#c89e46', brilho: '#ead07c' };
export const PRATA: Tons = { nanquim: '#161618', sombra: '#5a5c62', base: '#80848a', meio: '#989ca2', luz: '#b4b8be', brilho: '#e0e4e8' };

export type Quadro = (u: number, v: number) => [number, number];
/** Um referencial local (u ao longo, v através) com centro em (cx, cy) e girado `ang`. */
export const quadro = (cx: number, cy: number, ang = 0): Quadro => { const c = Math.cos(ang), s = Math.sin(ang); return (u, v) => [cx + u * c - v * s, cy + u * s + v * c]; };
export const em = (f: Quadro, uv: readonly number[]): number[] => { const out: number[] = []; for (let i = 0; i < uv.length; i += 2) out.push(...f(uv[i]!, uv[i + 1]!)); return out; };
export const ID = quadro(0, 0);
/** Quanto uma face de normal `ang` olha para a luz (1 de frente, −1 de costas). */
export const olhar = (ang: number): number => Math.cos(ang - LUZ_A);
export const tomDaFace = (t: Tons, d: number): string => (d > 0.55 ? t.luz : d > 0.05 ? t.meio : d > -0.55 ? t.base : t.sombra);
/** A direção da luz (noroeste) no referencial girado de `ang`. */
export const luzLocal = (ang: number): [number, number] => [LUZ_X * Math.cos(ang) + LUZ_Y * Math.sin(ang), -LUZ_X * Math.sin(ang) + LUZ_Y * Math.cos(ang)];

/** Retângulo de cantos arredondados (u, v, w, h, raio) no referencial `f`. */
export function retR(f: Quadro, u: number, v: number, w: number, h: number, raio = 0): number[] {
  const rr = Math.max(0.001, Math.min(raio, w / 2, h / 2)), pts: number[] = [];
  const cantos: [number, number, number][] = [[u + w / 2 - rr, v - h / 2 + rr, -Math.PI / 2], [u + w / 2 - rr, v + h / 2 - rr, 0], [u - w / 2 + rr, v + h / 2 - rr, Math.PI / 2], [u - w / 2 + rr, v - h / 2 + rr, Math.PI]];
  for (const [cu, cv, a0] of cantos) for (let k = 0; k <= 3; k++) { const a = a0 + (k / 3) * (Math.PI / 2); pts.push(cu + Math.cos(a) * rr, cv + Math.sin(a) * rr); }
  return em(f, pts);
}
/** Retângulo (u, v, w, h) no referencial `f`. */
export const retQ = (f: Quadro, u: number, v: number, w: number, h: number): number[] => em(f, [u - w / 2, v - h / 2, u + w / 2, v - h / 2, u + w / 2, v + h / 2, u - w / 2, v + h / 2]);
/** Um arco de `a0` a `a1` (rad) em `n` passos. */
export const arco = (x: number, y: number, rx: number, ry: number, a0: number, a1: number, n = 12): number[] => { const p: number[] = []; for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (a1 - a0); p.push(x + Math.cos(a) * rx, y + Math.sin(a) * ry); } return p; };
/** Um círculo de `n` pontos (para tiras em anel). */
export const anel = (x: number, y: number, rx: number, ry = rx, n = 28): number[] => { const p: number[] = []; for (let k = 0; k <= n; k++) { const a = (k / n) * Math.PI * 2; p.push(x + Math.cos(a) * rx, y + Math.sin(a) * ry); } return p; };

/** Disco em volume (tambor, toro, cabeça): nanquim, base e degraus de luz para o noroeste. */
export function disco(partes: Parte[], x: number, y: number, R: number, t: Tons, z: number, rY = R): void {
  partes.push(elipse(x + 0.012, y + 0.014, R * 2 + 0.05, rY * 2 + 0.05, t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(elipse(x, y, R * 2, rY * 2, t.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(elipse(x + LUZ_X * R * 0.1, y + LUZ_Y * rY * 0.1, R * 1.72, rY * 1.72, t.meio, z + 0.006, { ...S, detalhe: 1 }));
  partes.push(elipse(x + LUZ_X * R * 0.28, y + LUZ_Y * rY * 0.28, R * 1.0, rY * 0.96, t.luz, z + 0.009, { ...S, detalhe: 2 }));
  partes.push(elipse(x + LUZ_X * R * 0.46, y + LUZ_Y * rY * 0.46, R * 0.34, rY * 0.3, t.brilho, z + 0.012, { ...S, alfa: 0.8, detalhe: 3 }));
}

/** Bloco de pedra visto de cima, no referencial `f`: nanquim, tampo e bisel com cada face no tom da luz que recebe. */
export function bloco(partes: Parte[], f: Quadro, w: number, h: number, t: Tons, z: number, b = Math.min(w, h) * 0.12, ang = 0): void {
  const u = w / 2, v = h / 2;
  partes.push(poli(em(f, [-u - 0.02, -v - 0.02, u + 0.035, -v - 0.02, u + 0.035, v + 0.04, -u - 0.02, v + 0.04]), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(em(f, [-u, -v, u, -v, u, v, -u, v]), t.base, z + 0.003, { ...O, detalhe: 1 }));
  const faces: [number[], number][] = [
    [[-u, -v, u, -v, u - b, -v + b, -u + b, -v + b], -Math.PI / 2], [[u, -v, u, v, u - b, v - b, u - b, -v + b], 0],
    [[u, v, -u, v, -u + b, v - b, u - b, v - b], Math.PI / 2], [[-u, v, -u, -v, -u + b, -v + b, -u + b, v - b], Math.PI],
  ];
  for (const [pts, n] of faces) partes.push(poli(em(f, pts), tomDaFace(t, olhar(n + ang)), z + 0.005, { ...O, detalhe: 2 }));
  partes.push(poli(em(f, [-u + b, -v + b, u - b, -v + b, u - b, v - b, -u + b, v - b]), t.meio, z + 0.006, { ...O, detalhe: 1 }));
  partes.push(tira(em(f, [-u + b * 0.2, v - b, -u + b * 0.2, -v + b * 0.2, u - b, -v + b * 0.2]), Math.max(0.012, b * 0.18), t.brilho, z + 0.007, { ...O, alfa: 0.8, detalhe: 3 }));
}

/** Lascas escuras nas quinas e rachaduras finas num bloco (pedra gasta pelo tempo). */
export function desgaste(partes: Parte[], r: () => number, f: Quadro, w: number, h: number, t: Tons, z: number, n = 3): void {
  for (let i = 0; i < n; i++) {
    const su = r() < 0.5 ? -1 : 1, sv = r() < 0.5 ? -1 : 1, s = Math.min(w, h) * (0.06 + r() * 0.08);
    const cu = su * w / 2, cv = sv * h / 2;
    partes.push(poli(em(f, [cu, cv, cu - su * s * (1 + r()), cv, cu - su * s * 0.5, cv - sv * s * 0.6, cu, cv - sv * s * (1 + r())]), t.sombra, z + 0.008, { ...O, detalhe: 2 }));
  }
  for (let i = 0; i < Math.ceil(n / 2); i++) {
    const u0 = (r() - 0.5) * w * 0.8, v0 = (r() - 0.5) * h * 0.8, pts: number[] = [u0, v0];
    let a = r() * 6.28, u = u0, v = v0;
    for (let k = 0; k < 4; k++) { a += (r() - 0.5) * 1.2; u += Math.cos(a) * Math.min(w, h) * 0.1; v += Math.sin(a) * Math.min(w, h) * 0.1; pts.push(u, v); }
    partes.push(tira(em(f, pts), 0.012, t.nanquim, z + 0.009, { ...O, alfa: 0.55, detalhe: 3 }, 0.3));
  }
}

/** Tecido estofado (colchão, almofada) no referencial `f`: nanquim, base, o lado da luz mais claro e a borda de baixo escura. */
export function estofado(partes: Parte[], f: Quadro, ang: number, u: number, v: number, w: number, h: number, cor: string, z: number, raio = Math.min(w, h) * 0.3): void {
  const [lu, lv] = luzLocal(ang);
  partes.push(poli(retR(f, u - lu * 0.012, v - lv * 0.014, w + 0.03, h + 0.03, raio), tom(cor, -0.62), z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(f, u, v, w, h, raio), tom(cor, -0.16), z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(retR(f, u + lu * w * 0.05, v + lv * h * 0.07, w * 0.88, h * 0.78, raio * 0.8), cor, z + 0.005, { ...S, detalhe: 1 }));
  partes.push(poli(retR(f, u + lu * w * 0.12, v + lv * h * 0.2, w * 0.7, h * 0.36, raio * 0.6), tom(cor, 0.1), z + 0.007, { ...S, alfa: 0.45, detalhe: 2 }));
}

/** Uma fruta ou bolinha em volume (uva, romã, figo, pão): nanquim, base e o brilho para o noroeste. */
export function fruta(partes: Parte[], x: number, y: number, R: number, cor: string, z: number): void {
  partes.push(elipse(x + 0.006, y + 0.007, R * 2 + 0.014, R * 2 + 0.014, tom(cor, -0.7), z, { contorno: false, semSombra: true, detalhe: 2 }), elipse(x, y, R * 2, R * 2, cor, z + 0.001, { ...O, detalhe: 2 }), elipse(x + LUZ_X * R * 0.4, y + LUZ_Y * R * 0.4, R * 0.7, R * 0.7, tom(cor, 0.35), z + 0.002, { ...S, alfa: 0.85, detalhe: 3 }));
}

/** Brasas e chamas que brilham (cores escuras e saturadas: a emissão multiplica por até 3), num disco de raio `R`. */
export function fogoQueBrilha(partes: Parte[], r: () => number, R: number, z: number): void {
  partes.push(elipse(0, 0, R * 2, R * 2, '#2a0a04', z, { ...O, detalhe: 1 }));
  for (let k = 0; k < 16; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.85; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.06 + r() * 0.05, 0.05 + r() * 0.04, r() < 0.35 ? '#1a0e0a' : r() < 0.5 ? '#8a2206' : '#a8380a', z + 0.005, { ...O, brilho: true, detalhe: 2 })); }
  const macio = (pts: number[], c: string, zz: number, alfa: number, d: number): Parte => poli(pts, c, zz, { ...O, alfa, desfoque: d, brilho: true, detalhe: 2 });
  for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28 + r() * 0.5, d = R * 0.35; partes.push(macio(bolha(Math.cos(a) * d, Math.sin(a) * d, R * 0.42, R * 0.3, 9, 0.3, r, a), '#a8340a', z + 0.02 + k * 0.001, 0.85, 0.03)); }
  partes.push(macio(bolha(0, 0, R * 0.62, R * 0.62, 12, 0.22, r), '#b8480c', z + 0.03, 0.9, 0.03));
  partes.push(macio(bolha(0.01, 0.01, R * 0.4, R * 0.4, 10, 0.2, r), '#c06414', z + 0.035, 0.92, 0.025));
  partes.push(elipse(0, 0, R * 0.36, R * 0.36, '#c88a2a', z + 0.04, { ...O, desfoque: 0.02, brilho: true, detalhe: 2 }));
  for (let k = 0; k < 8; k++) { const a = r() * 6.28, d = R * (0.9 + r() * 0.3); partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.025, 0.025, '#c0600e', z + 0.05, { ...O, alfa: 0.9, desfoque: 0.006, brilho: true, detalhe: 3 })); }
}

/** Clarão no chão que soma luz (lanterna, brasa): cores escuras e saturadas, porque a emissão multiplica por até 3. */
export const halo = (partes: Parte[], x: number, y: number, R: number, cor: string, alfa: number): void => { partes.push(elipse(x, y, R * 2, R * 2, cor, 0.01, { ...O, brilho: true, alfa, desfoque: R * 0.3, detalhe: 1 })); };

/** Brasas de carvão que brilham num disco de raio `R`. */
export function brasas(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number, n = 16): void {
  partes.push(elipse(x, y, R * 2, R * 2, '#2a0a04', z, { ...O, detalhe: 1 }));
  partes.push(elipse(x, y, R * 1.5, R * 1.5, '#8a2a06', z + 0.002, { ...O, brilho: true, alfa: 0.7, desfoque: R * 0.25, detalhe: 1 }));
  for (let k = 0; k < n; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.85; partes.push(elipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.05 + r() * 0.05, 0.04 + r() * 0.04, r() < 0.3 ? '#1a0e0a' : r() < 0.5 ? '#8a2206' : '#b0400c', z + 0.005, { ...O, brilho: true, detalhe: 2 })); }
  partes.push(elipse(x, y, R * 0.7, R * 0.7, '#c06414', z + 0.01, { ...O, brilho: true, alfa: 0.8, desfoque: R * 0.2, detalhe: 2 }));
}

const PEDRA_JARDIM: Tons = { nanquim: '#16161a', sombra: '#55554f', base: '#74736b', meio: '#88877e', luz: '#a09f95', brilho: '#c0bfb4' };
const MUSGO_JARDIM = '#4e6a2e';

/** Pedra de jardim arredondada (bolha), com o lado da luz claro e musgo do lado de sombra. */
export function pedra(partes: Parte[], r: () => number, x: number, y: number, rx: number, ry: number, z: number, musgo = 0.5): void {
  const forma = bolha(x, y, rx, ry, 14, 0.12, r, r() * 6);
  partes.push(poli(forma.map((v, i) => v + (i % 2 ? 0.03 : 0.025)), PEDRA_JARDIM.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(forma, PEDRA_JARDIM.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(bolha(x + LUZ_X * rx * 0.15, y + LUZ_Y * ry * 0.15, rx * 0.78, ry * 0.76, 12, 0.12, r), PEDRA_JARDIM.meio, z + 0.006, { ...S, detalhe: 2 }));
  partes.push(poli(bolha(x + LUZ_X * rx * 0.35, y + LUZ_Y * ry * 0.35, rx * 0.4, ry * 0.36, 10, 0.18, r), PEDRA_JARDIM.luz, z + 0.009, { ...S, alfa: 0.85, detalhe: 3 }));
  if (r() < musgo) partes.push(poli(bolha(x - LUZ_X * rx * 0.4, y - LUZ_Y * ry * 0.4, rx * 0.5, ry * 0.4, 10, 0.3, r), MUSGO_JARDIM, z + 0.012, { ...S, alfa: 0.75, detalhe: 2 }));
}

const FERRO_RODA: Tons = { nanquim: '#060606', sombra: '#16171a', base: '#24262a', meio: '#303338', luz: '#464a50', brilho: '#7a8088' };

/** Roda vista de cima (a banda de ferro ao longo de u), com o cubo saindo para fora (lado `s` de v). */
export function roda(partes: Parte[], f: Quadro, u: number, v: number, D: number, w: number, z: number, s: number, cor = '#6a2a1a'): void {
  partes.push(tira(em(f, [u - D / 2, v, u + D / 2, v]), w + 0.03, FERRO_RODA.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, 0.6));
  partes.push(tira(em(f, [u - D / 2 + 0.03, v, u + D / 2 - 0.03, v]), w * 0.7, cor, z + 0.003, { ...O, detalhe: 2 }, 0.7));
  partes.push(tira(em(f, [u - D / 2 + 0.06, v - w * 0.15, u + D / 2 - 0.06, v - w * 0.15]), w * 0.18, tom(cor, 0.35), z + 0.005, { ...O, alfa: 0.7, detalhe: 3 }, 0.5));
  const [hx, hy] = f(u, v + s * w * 0.7); partes.push(elipse(hx, hy, 0.12, 0.12, FERRO_RODA.base, z + 0.006, { contorno: 'leve', detalhe: 2 }), elipse(hx, hy, 0.05, 0.05, FERRO_RODA.brilho, z + 0.008, { ...O, detalhe: 3 }));
}

/**
 * Cilindro deitado de (ax, ay) a (bx, by), de largura `wa` a `wb` (cano de canhão, rolo, mastro deitado): o nanquim, a base, e as faixas
 * de meio-tom, luz e brilho do lado que olha para o noroeste; o outro lado, na sombra.
 */
export function cilindro(partes: Parte[], ax: number, ay: number, bx: number, by: number, wa: number, wb: number, t: Tons, z: number, nitido = 1): void {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, lado = nx * LUZ_X + ny * LUZ_Y >= 0 ? 1 : -1;
  const faixa = (o0: number, o1: number, e = 0): number[] => {
    const ex = (dx / L) * e, ey = (dy / L) * e;
    return [ax - ex + nx * wa / 2 * o0, ay - ey + ny * wa / 2 * o0, bx + ex + nx * wb / 2 * o0, by + ey + ny * wb / 2 * o0, bx + ex + nx * wb / 2 * o1, by + ey + ny * wb / 2 * o1, ax - ex + nx * wa / 2 * o1, ay - ey + ny * wa / 2 * o1];
  };
  partes.push(poli(faixa(-1.18, 1.18, 0.015), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(faixa(-1, 1), t.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(faixa(-lado * 0.62, -lado * 1), t.sombra, z + 0.004, { ...S, alfa: 0.7, detalhe: 2 }));
  partes.push(poli(faixa(-lado * 0.1, lado * 0.88), t.meio, z + 0.005, { ...S, detalhe: 1 }));
  partes.push(poli(faixa(lado * 0.3, lado * 0.72), t.luz, z + 0.007, { ...S, detalhe: 2 }));
  if (nitido) partes.push(poli(faixa(lado * 0.46, lado * 0.6), t.brilho, z + 0.009, { ...S, alfa: 0.75, detalhe: 3 }));
}

const OSSO = '#d9d2c0', NANQUIM_OSSO = '#2a2118';
const PINCEL_OSSO: Partial<Parte> = { contorno: false, semSombra: true, suave: true };

/** Um osso longo: haste em fita com as duas cabeças (epífises) em lóbulos, luz de um lado e sombra do outro; de (x, y) para `ang`. */
export function osso(partes: Parte[], x: number, y: number, ang: number, len: number, w: number, z: number, cor = OSSO, r: () => number = Math.random): void {
  const c = Math.cos(ang), s = Math.sin(ang), p = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  const curva = (r() - 0.5) * w * 0.6, haste = [...p(0, 0), ...p(len * 0.5, curva), ...p(len, 0)];
  partes.push(tira(haste, w, cor, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, 0.75));
  for (const u of [0, len]) for (const v of [-0.42, 0.42]) { const [px, py] = p(u + (u ? -1 : 1) * w * 0.15, v * w * 1.15); partes.push(poli(bolha(px, py, w * 0.62, w * 0.55, 8, 0.12, r, ang), cor, z + 0.005, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
  const ox = LUZ_X * w * 0.18, oy = LUZ_Y * w * 0.18;
  partes.push(tira([...p(w * 0.4, 0), ...p(len * 0.5, curva), ...p(len - w * 0.4, 0)].map((v, i) => v + (i % 2 ? oy : ox)), w * 0.32, tom(cor, 0.35), z + 0.01, { ...PINCEL_OSSO, detalhe: 3 }, 0.5));
  partes.push(tira([...p(w * 0.5, 0), ...p(len * 0.5, curva), ...p(len - w * 0.5, 0)].map((v, i) => v - (i % 2 ? oy : ox) * 1.6), w * 0.22, tom(cor, -0.28), z + 0.01, { ...PINCEL_OSSO, detalhe: 3 }, 0.5));
}

/** Uma costela: arco afinando, de (x, y) saindo em `ang` e curvando para `lado`. */
export function costela(partes: Parte[], x: number, y: number, ang: number, len: number, w: number, lado: number, cor: string, z: number): void {
  const pts: number[] = [];
  for (let k = 0; k <= 6; k++) { const t = k / 6, a = ang + lado * t * 1.1; pts.push(x + Math.cos(a) * len * t, y + Math.sin(a) * len * t); }
  partes.push(tira(pts, w, cor, z, { contorno: 'leve', sombraLeve: true, detalhe: 2 }, 0.35));
}

/**
 * Crânio de animal (lobo, cervo) visto de cima, de (x, y) olhando para `ang`: caixa craniana redonda atrás, arcos das maçãs abertos na altura
 * dos olhos, focinho longo e estreito; órbitas e narinas escuras, crista no meio, luz a noroeste. `chifres` põe dois chifres curvos.
 */
export function cranio(partes: Parte[], x: number, y: number, ang: number, s: number, z: number, chifres: boolean, cor = OSSO): void {
  const c = Math.cos(ang), s2 = Math.sin(ang), p = (u: number, v: number): [number, number] => [x + (u * c - v * s2) * s, y + (u * s2 + v * c) * s];
  const perfil: [number, number][] = [[-0.5, 0], [-0.47, 0.17], [-0.36, 0.3], [-0.18, 0.33], [-0.04, 0.4], [0.08, 0.38], [0.16, 0.22], [0.3, 0.17], [0.48, 0.14], [0.6, 0.1], [0.64, 0]];
  const forma = [...perfil, ...perfil.slice(1, -1).reverse().map(([u, v]) => [u, -v] as [number, number])].flatMap(([u, v]) => p(u, v));
  if (chifres) for (const lado of [-1, 1]) { const arcoPts: number[] = []; for (let i = 0; i <= 7; i++) { const t = i / 7; arcoPts.push(...p(-0.22 - t * 0.42 + t * t * 0.3, lado * (0.22 + t * 0.32 + t * t * 0.06))); } partes.push(tira(arcoPts, 0.09 * s, '#8a7d62', z - 0.01, { contorno: 'leve', sombraLeve: true, detalhe: 2 }, 0.3)); }
  partes.push(poli(forma, cor, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(forma.map((v, i) => (i % 2 ? y + (v - y) * 0.8 + LUZ_Y * 0.03 * s : x + (v - x) * 0.8 + LUZ_X * 0.03 * s)), tom(cor, 0.18), z + 0.01, { ...PINCEL_OSSO, detalhe: 2 }));
  for (const lado of [-1, 1]) {
    const [ox, oy] = p(0.08, lado * 0.25); partes.push(elipse(ox, oy, 0.17 * s, 0.13 * s, NANQUIM_OSSO, z + 0.02, { ...PINCEL_OSSO, detalhe: 1 }));
    const [nx, ny] = p(0.6, lado * 0.035); partes.push(elipse(nx, ny, 0.06 * s, 0.035 * s, NANQUIM_OSSO, z + 0.02, { ...PINCEL_OSSO, detalhe: 2 }));
    partes.push(tira([...p(-0.42, lado * 0.06), ...p(-0.2, lado * 0.2), ...p(0.0, lado * 0.32)], 0.025 * s, tom(cor, -0.3), z + 0.02, { ...PINCEL_OSSO, detalhe: 3 }, 0.4));
  }
  partes.push(tira([...p(-0.48, 0), ...p(-0.1, 0), ...p(0.45, 0)], 0.035 * s, tom(cor, -0.22), z + 0.02, { ...PINCEL_OSSO, detalhe: 3 }, 0.5));
}
