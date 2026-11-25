import { elipse, poli, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, tira } from '../organico.ts';
import { num, piso, type Receita } from './comum.ts';

// Biomas (Frente Q): o que dá caráter a caverna, selva, praia, deserto, outono e vulcão. Os que brilham usam partes `brilho`, que emitem
// acima da luz da cena (multiplicam a própria cor por até 3): por isso as cores do brilho são escuras e saturadas. O clarão no chão é uma
// parte `brilho` larga e desfocada por baixo do objeto, como o da lava: ilumina o entorno sem luz posta à mão.

const O = { contorno: false as const, semSombra: true };
const S = { ...O, suave: true };
/** O ângulo de onde vem a luz; `Math.cos(a − LUZ_A)` é 1 no que aponta para ela. */
const LUZ_A = Math.atan2(LUZ_Y, LUZ_X);
const sorteio = (r: () => number, lista: readonly string[]): string => lista[Math.floor(r() * lista.length)]!;
/** Um oval girado (`ang`) em polígono. */
function oval(cx: number, cy: number, rx: number, ry: number, ang: number, n = 14): number[] {
  const c = Math.cos(ang), s = Math.sin(ang), pts: number[] = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, u = Math.cos(t) * rx, v = Math.sin(t) * ry; pts.push(cx + u * c - v * s, cy + u * s + v * c); }
  return pts;
}

/** Fungos luminosos: um tufo de chapéus pequenos (2 a 7 cm) em verde-água ou lilás, com o miolo aceso e um halo fraco no chão. */
function fungosLuminosos(seed: number, R: number, lilas: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], base = lilas ? '#3a2458' : '#14484a', aceso = lilas ? '#7a3ab0' : '#1a8a74', halo = lilas ? '#5a2a90' : '#14705e';
  partes.push(elipse(0, 0, R * 2.2, R * 2.2, halo, 0.01, { ...O, brilho: true, alfa: 0.32, desfoque: R * 0.5, detalhe: 1 }));
  const n = Math.round(10 * R * R / 0.09 + 5);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(r()) * R, a = r() * Math.PI * 2, x = Math.cos(a) * d, y = Math.sin(a) * d, rc = 0.022 + r() * 0.04 * (1 - d / R * 0.5), z = 0.03 + r() * 0.04;
    partes.push(elipse(x + 0.006, y + 0.006, rc * 2.3, rc * 2.3, '#08060a', z - 0.001, { ...O, alfa: 0.6, detalhe: 2 }));
    partes.push(elipse(x, y, rc * 2, rc * 2, tom(base, (r() - 0.5) * 0.2), z, { contorno: 'leve', semSombra: true, detalhe: 2 }));
    partes.push(elipse(x + LUZ_X * rc * 0.3, y + LUZ_Y * rc * 0.3, rc * 1.1, rc * 1.1, aceso, z + 0.002, { ...O, brilho: true, alfa: 1, detalhe: 2 }));
  }
  return partes;
}

// ---------- Cogumelo gigante ----------

/** Cores do cogumelo: nanquim, base, meio, luz, brilho, pintas e a cor que emite (escura e saturada). */
interface CoresDeCogumelo { nanquim: string; base: string; meio: string; luz: string; brilho: string; pintas: string; emite: string }
const COGUMELOS: readonly CoresDeCogumelo[] = [
  { nanquim: '#24140a', base: '#7a4e30', meio: '#94643e', luz: '#b0845a', brilho: '#d0aa80', pintas: '#e6d8bc', emite: '#a85a24' },   // castanho
  { nanquim: '#06161a', base: '#1a5052', meio: '#226866', luz: '#30847a', brilho: '#5cb4a2', pintas: '#9ce8d0', emite: '#12806a' },   // verde-água
  { nanquim: '#120a1c', base: '#42265e', meio: '#56327a', luz: '#704698', brilho: '#9a70c0', pintas: '#dab4fa', emite: '#6a2ea6' },   // lilás
  { nanquim: '#240604', base: '#801c16', meio: '#9c261c', luz: '#bc3a28', brilho: '#d86446', pintas: '#f2eadc', emite: '#b0301e' },   // vermelho de pintas
];

/** Um chapéu de cogumelo visto de cima: borda ondulada no nanquim, volume em degraus para o noroeste, pintas e, com `brilho`, pintas e chapéu acesos. */
function chapeu(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number, c: CoresDeCogumelo, brilho: number): void {
  const giro = r() * 6;
  partes.push(poli(bolha(x, y, R * 1.05, R * 1.05, 28, 0.05, r, giro), c.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(bolha(x, y, R, R, 28, 0.04, r, giro), c.base, z + 0.005, { ...S, detalhe: 1 }));
  partes.push(poli(bolha(x + LUZ_X * R * 0.1, y + LUZ_Y * R * 0.1, R * 0.8, R * 0.8, 22, 0.05, r), c.meio, z + 0.01, { ...S, detalhe: 1 }));
  partes.push(poli(bolha(x + LUZ_X * R * 0.24, y + LUZ_Y * R * 0.24, R * 0.5, R * 0.48, 18, 0.08, r), c.luz, z + 0.015, { ...S, detalhe: 2 }));
  partes.push(poli(bolha(x + LUZ_X * R * 0.4, y + LUZ_Y * R * 0.4, R * 0.18, R * 0.16, 12, 0.15, r), c.brilho, z + 0.02, { ...S, alfa: 0.8, detalhe: 3 }));
  // Estrias finas da borda para o centro, que dão a curvatura do chapéu.
  const nE = Math.round(14 + R * 10);
  for (let i = 0; i < nE; i++) { const a = (i / nE) * Math.PI * 2 + r() * 0.2; partes.push(lente(x + Math.cos(a) * R * 0.98, y + Math.sin(a) * R * 0.98, a + Math.PI, R * (0.18 + r() * 0.12), R * 0.03, tom(c.base, -0.18), z + 0.021, { ...S, alfa: 0.7, detalhe: 3 })); }
  const nP = Math.round(5 + R * 6);
  for (let i = 0; i < nP; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.78, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d, rp = R * (0.05 + r() * 0.07) * (1 - d / R * 0.4);
    partes.push(poli(bolha(px, py, rp, rp * 0.9, 9, 0.2, r), c.pintas, z + 0.025, { ...S, detalhe: 2 }));
    if (brilho > 0) partes.push(elipse(px, py, rp * 1.6, rp * 1.5, c.emite, z + 0.026, { ...O, brilho: true, alfa: Math.min(1, 0.4 + brilho * 0.6), desfoque: rp * 0.4, detalhe: 2 }));
  }
  if (brilho > 0) partes.push(elipse(x, y, R * 1.9, R * 1.9, c.emite, z + 0.03, { ...O, brilho: true, alfa: 0.18 * brilho, desfoque: R * 0.3, detalhe: 1 }));
}

/** Cogumelo gigante: um chapéu de `altura` × 0,45 + 0,8 m de largura, dois a quatro filhotes em volta e, com `brilho`, o clarão no chão. */
function cogumeloGigante(seed: number, altura: number, cor: number, brilho: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], c = COGUMELOS[cor]!, R = (0.8 + altura * 0.45) / 2;
  if (brilho > 0) partes.push(elipse(0, 0, R * 2.5, R * 2.5, c.emite, 0.01, { ...O, brilho: true, alfa: 0.35 * brilho, desfoque: R * 0.18, detalhe: 1 }));
  partes.push(elipse(LUZ_X * -R * 0.1, LUZ_Y * -R * 0.1, R * 2.1, R * 2.1, '#08060a', 0.02, { ...O, alfa: 0.35, desfoque: R * 0.25, detalhe: 1 }));
  const nF = 2 + Math.floor(r() * 3), giro = r() * Math.PI * 2;
  for (let i = 0; i < nF; i++) {
    const a = giro + (i / nF) * Math.PI * 2 + (r() - 0.5) * 0.8, rf = R * (0.12 + r() * 0.12), d = R * (1.02 + r() * 0.2);
    chapeu(partes, r, Math.cos(a) * d, Math.sin(a) * d, rf, 0.3 + rf * 0.8, c, brilho);
  }
  chapeu(partes, r, 0, 0, R, altura, c, brilho);
  return partes;
}

// ---------- Cristal ----------

/** Cores do cristal: escuro, base, claro, brilho (aresta) e a que emite. */
const CRISTAIS: readonly (readonly [string, string, string, string, string])[] = [
  ['#0c2a3a', '#1e6a8a', '#48a8c8', '#c8f2ff', '#127ca6'],   // ciano
  ['#1e1238', '#4a2a8a', '#8058c8', '#e4d2ff', '#5a26b4'],   // violeta
  ['#3a1e08', '#8a4a14', '#d08a2a', '#ffe4a8', '#a8560c'],   // âmbar
  ['#0c2a18', '#1e6a3a', '#48b068', '#ccffdc', '#148a46'],   // verde
  ['#3a1028', '#8a2a5a', '#d0609a', '#ffd4ea', '#a8266a'],   // rosa
];

/**
 * Aglomerado de cristais visto de cima: prismas deitados em leque, cada um com duas faces (a virada para a luz clara) e a ponta, e no
 * meio de um a três prismas em pé, vistos de topo como hexágonos de seis facetas. Com `brilho`, as faces emitem e há o clarão no chão.
 */
function cristal(seed: number, S0: number, cor: number, brilho: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], [escuro, base, claro, aresta, emite] = CRISTAIS[cor]!, R = S0 / 2;
  if (brilho > 0) partes.push(elipse(0, 0, S0 * 1.1, S0 * 1.1, emite, 0.01, { ...O, brilho: true, alfa: 0.35 * brilho, desfoque: S0 * 0.08, detalhe: 1 }));
  partes.push(poli(bolha(0, 0, R * 0.55, R * 0.55, 12, 0.2, r), '#16141a', 0.02, { ...O, detalhe: 1 }));
  const prismas: { a: number; d: number; len: number; w: number; z: number }[] = [];
  const n = Math.round(5 + S0 * 3);
  for (let i = 0; i < n; i++) { const len = R * (0.45 + r() * 0.5); prismas.push({ a: (i / n) * Math.PI * 2 + (r() - 0.5) * 0.7, d: R * 0.08 * r(), len, w: len * (0.26 + r() * 0.1), z: S0 * (0.2 + r() * 0.3) }); }
  for (const p of prismas.sort((a, b) => a.z - b.z)) {
    const c = Math.cos(p.a), s = Math.sin(p.a), nx = -s, ny = c, x0 = c * p.d, y0 = s * p.d;
    const P = (u: number, v: number): [number, number] => [x0 + c * u + nx * v, y0 + s * u + ny * v];
    const bE = P(0, -p.w / 2), oE = P(p.len * 0.74, -p.w / 2), ponta = P(p.len, 0), oD = P(p.len * 0.74, p.w / 2), bD = P(0, p.w / 2), meio = P(0, 0), om = P(p.len * 0.74, 0);
    const fE = Math.cos(p.a - Math.PI / 2 - LUZ_A), fD = -fE;
    partes.push(poli([...P(-0.02, -p.w / 2 - 0.03), ...P(p.len * 0.74, -p.w / 2 - 0.03), ...P(p.len + 0.04, 0), ...P(p.len * 0.74, p.w / 2 + 0.03), ...P(-0.02, p.w / 2 + 0.03)], escuro, p.z, { contorno: false, sombraLeve: true, detalhe: 1 }));
    for (const [pts, f] of [[[...meio, ...bE, ...oE, ...om], fE], [[...meio, ...om, ...oD, ...bD], fD], [[...om, ...oE, ...ponta], fE + 0.4], [[...om, ...ponta, ...oD], fD + 0.4]] as const) {
      const corF = f > 0.3 ? claro : f > -0.3 ? base : tom(base, -0.2);
      partes.push(poli([...pts], corF, p.z + 0.005, { ...O, detalhe: 1 }));
      if (brilho > 0) partes.push(poli([...pts], emite, p.z + 0.006, { ...O, brilho: true, alfa: brilho * (f > 0 ? 0.5 : 0.8), detalhe: 2 }));
    }
    partes.push(tira([...meio, ...om, ...ponta], p.w * 0.09, aresta, p.z + 0.008, { ...O, alfa: 0.85, detalhe: 2 }, 0.5));
  }
  // Os de pé no meio: hexágonos de seis facetas, a ponta no centro.
  const nP = S0 < 0.8 ? 1 : 1 + Math.floor(r() * 3);
  for (let i = 0; i < nP; i++) {
    const a = r() * Math.PI * 2, d = i ? R * 0.22 : 0, x = Math.cos(a) * d, y = Math.sin(a) * d, rh = R * (i ? 0.16 : 0.24), z = S0 * (i ? 0.6 : 0.85), giro = r() * Math.PI;
    partes.push(poli(Array.from({ length: 6 }, (_, k) => [x + Math.cos(giro + k * Math.PI / 3) * (rh + 0.03), y + Math.sin(giro + k * Math.PI / 3) * (rh + 0.03)]).flat(), escuro, z, { contorno: false, sombraLeve: true, detalhe: 1 }));
    for (let k = 0; k < 6; k++) {
      const a0 = giro + k * Math.PI / 3, a1 = a0 + Math.PI / 3, f = Math.cos((a0 + a1) / 2 - LUZ_A), pts = [x, y, x + Math.cos(a0) * rh, y + Math.sin(a0) * rh, x + Math.cos(a1) * rh, y + Math.sin(a1) * rh];
      partes.push(poli(pts, f > 0.5 ? aresta : f > 0 ? claro : f > -0.5 ? base : tom(base, -0.25), z + 0.005, { ...O, detalhe: 1 }));
      if (brilho > 0) partes.push(poli(pts, emite, z + 0.006, { ...O, brilho: true, alfa: brilho * 0.6, detalhe: 2 }));
    }
  }
  return partes;
}

// ---------- Vulcão ----------

/** Fumarola: uma fenda no chão com o fundo em brasa, a boca escura no meio e crostas de enxofre em volta; o vapor sai pela cena (`fumaca.ts`). */
function fumarola(seed: number, L: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  partes.push(poli(bolha(0, 0, L * 0.6, L * 0.36, 18, 0.25, r), '#2a2420', 0.01, { ...S, alfa: 0.6, detalhe: 1 }));
  for (let i = 0; i < 9; i++) {   // crostas: enxofre amarelo, ocre e branco, mais densas perto da boca
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * L * 0.3, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.5, t = L * (0.06 + r() * 0.1);
    partes.push(poli(bolha(x, y, t, t * 0.8, 10, 0.3, r), sorteio(r, ['#b89a34', '#c8b048', '#d8cc78', '#a8642a', '#e2dcc4']), 0.02 + i * 0.001, { ...S, alfa: 0.75, detalhe: 2 }));
  }
  const fenda: number[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10; fenda.push((t - 0.5) * L * 0.9, (r() - 0.5) * L * 0.08 + Math.sin(t * 5) * L * 0.03); }
  partes.push(tira(fenda, L * 0.09, '#120a08', 0.04, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.25), tira(fenda, L * 0.04, '#6e2410', 0.045, { ...O, brilho: true, alfa: 0.9, detalhe: 1 }, 0.2));
  for (const lado of [-1, 1]) { const i0 = 3 + Math.floor(r() * 4), x = fenda[i0 * 2]!, y = fenda[i0 * 2 + 1]!; partes.push(tira([x, y, x + L * 0.08 * lado, y + L * 0.1 * lado, x + L * 0.12 * lado, y + L * 0.2 * lado], L * 0.035, '#140c0a', 0.041, { ...O, detalhe: 2 }, 0.2)); }
  partes.push(poli(bolha(0, 0, L * 0.1, L * 0.07, 10, 0.2, r), '#0a0606', 0.05, { contorno: 'leve', semSombra: true, detalhe: 1 }), elipse(0, 0, L * 0.1, L * 0.07, '#8a3212', 0.051, { ...O, brilho: true, alfa: 0.8, desfoque: L * 0.03, detalhe: 1 }));
  partes.push(elipse(0, 0, L * 0.7, L * 0.36, '#5a1e0a', 0.005, { ...O, brilho: true, alfa: 0.25, desfoque: L * 0.08, detalhe: 1 }));
  return partes;
}

// ---------- Praia ----------

/** Conchas soltas na areia: vieiras (leque com costelas), caramujos (espiral) e mexilhões (ovais escuros). */
function conchas(seed: number, n: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.2, x = Math.cos(a0) * d, y = Math.sin(a0) * d, giro = r() * Math.PI * 2, tipo = r(), t = 0.06 + r() * 0.04, z = 0.03 + i * 0.002;
    if (tipo < 0.45) {   // vieira: leque de 9 costelas a partir da charneira
      const cor = sorteio(r, ['#e8d8c0', '#e8b8a0', '#d89878', '#f0e6d4']), leque: number[] = [x, y];
      for (let k = 0; k <= 10; k++) { const a = giro - 1 + (k / 10) * 2; leque.push(x + Math.cos(a) * t * 2, y + Math.sin(a) * t * 2); }
      partes.push(poli(leque, tom(cor, -0.45), z, { contorno: false, sombraLeve: true, detalhe: 2 }));
      partes.push(poli(leque.map((v, j) => (j < 2 ? v : (j % 2 ? y + (v - y) * 0.9 : x + (v - x) * 0.9))), cor, z + 0.001, { ...O, detalhe: 2 }));
      for (let k = 0; k < 9; k++) { const a = giro - 0.9 + (k / 8) * 1.8; partes.push(lente(x, y, a, t * 1.8, t * 0.18, tom(cor, k % 2 ? -0.2 : 0.15), z + 0.002, { ...O, detalhe: 3 })); }
    } else if (tipo < 0.8) {   // caramujo: corpo oval e a espiral clara
      const cor = sorteio(r, ['#d8c4a4', '#c8a07a', '#e6dccc']);
      partes.push(poli(oval(x, y, t * 1.3, t, giro), tom(cor, -0.45), z, { contorno: false, sombraLeve: true, detalhe: 2 }), poli(oval(x, y, t * 1.15, t * 0.86, giro), cor, z + 0.001, { ...O, detalhe: 2 }));
      const esp: number[] = []; for (let k = 0; k <= 14; k++) { const a = giro + k * 0.75, e = t * 0.75 * (1 - k / 16); esp.push(x + Math.cos(giro) * t * 0.25 + Math.cos(a) * e, y + Math.sin(giro) * t * 0.25 + Math.sin(a) * e); }
      partes.push(tira(esp, t * 0.12, tom(cor, -0.3), z + 0.002, { ...O, detalhe: 3 }, 0.6));
    } else {   // mexilhão: dois ovais azul-escuros
      partes.push(poli(oval(x, y, t * 1.4, t * 0.6, giro), '#141a26', z, { contorno: false, sombraLeve: true, detalhe: 2 }), poli(oval(x + LUZ_X * t * 0.1, y + LUZ_Y * t * 0.1, t * 1.1, t * 0.35, giro), '#3a4a6a', z + 0.001, { ...O, detalhe: 3 }));
    }
  }
  return partes;
}

/** Estrela-do-mar: cinco braços curvos, a crista clara e as pintas. */
function estrelaDoMar(seed: number, R: number, cor: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], [escuro, base, claro, pinta] = ([['#4a1a08', '#c05a1e', '#e48a3a', '#f6d29a'], ['#40080a', '#a8221e', '#d24a34', '#f0b098'], ['#20102e', '#6a3280', '#9458aa', '#e0c0ec']] as const)[cor]!;
  const giro = r() * Math.PI * 2, contorno: number[] = [];
  for (let i = 0; i < 40; i++) { const a = giro + (i / 40) * Math.PI * 2, k = Math.pow(Math.abs(Math.cos((a - giro) * 2.5)), 2.2), rr = R * (0.32 + 0.68 * k) * (0.92 + r() * 0.08), torce = Math.sin((a - giro) * 5) * 0.06; contorno.push(Math.cos(a + torce) * rr, Math.sin(a + torce) * rr); }
  partes.push(poli(contorno.map(v => v * 1.08), escuro, 0.04, { contorno: false, sombraLeve: true, detalhe: 1 }), poli(contorno, base, 0.041, { ...O, detalhe: 1 }));
  for (let b = 0; b < 5; b++) {
    const a = giro + (b / 5) * Math.PI * 2;
    partes.push(lente(0, 0, a, R * 0.92, R * 0.2, Math.cos(a - LUZ_A) > 0 ? claro : tom(base, 0.08), 0.042, { ...O, detalhe: 2 }));
    for (let k = 1; k <= 5; k++) partes.push(elipse(Math.cos(a) * R * k * 0.16, Math.sin(a) * R * k * 0.16, R * 0.07, R * 0.07, pinta, 0.043, { ...O, detalhe: 3 }));
  }
  return partes;
}

/** Madeira trazida pelo mar: tronco curvo e desbotado, com o toco de raízes numa ponta, veios ao comprido e galhos quebrados. */
function madeiraADeriva(seed: number, L: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], eixo: number[] = [], w = 0.14 + L * 0.03;
  for (let i = 0; i <= 10; i++) { const t = i / 10; eixo.push((t - 0.5) * L * 0.86, Math.sin(t * Math.PI * 1.3 + r()) * L * 0.05); }
  const [rx, ry] = [eixo[0]!, eixo[1]!];
  for (let k = 0; k < 6; k++) { const a = Math.PI + (k / 5 - 0.5) * 2.4 + (r() - 0.5) * 0.3, l = L * (0.08 + r() * 0.06); const pts = [rx, ry, rx + Math.cos(a) * l * 0.5 + (r() - 0.5) * 0.05, ry + Math.sin(a) * l * 0.5, rx + Math.cos(a) * l, ry + Math.sin(a) * l]; partes.push(tira(pts, w * 0.5 + 0.05, '#1a1612', 0.2, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.3), tira(pts, w * 0.5, '#9a8e7c', 0.205, { ...O, detalhe: 2 }, 0.3)); }
  for (let k = 0; k < 2; k++) { const i0 = 4 + k * 3, x = eixo[i0 * 2]!, y = eixo[i0 * 2 + 1]!, lado = k ? 1 : -1, pts = [x, y, x + L * 0.06, y + lado * L * 0.12]; partes.push(tira(pts, w * 0.45 + 0.05, '#1a1612', 0.2, { contorno: false, sombraLeve: true, detalhe: 2 }, 0.5), tira(pts, w * 0.45, '#a89c8a', 0.205, { ...O, detalhe: 2 }, 0.5)); }
  partes.push(tira(eixo, w + 0.05, '#1a1612', 0.25, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.55), tira(eixo, w, '#a49884', 0.255, { ...O, detalhe: 1 }, 0.55));
  partes.push(tira(eixo.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * w * 0.2), w * 0.45, '#cac0ae', 0.26, { ...O, detalhe: 2 }, 0.5));
  for (let k = -1; k <= 1; k++) partes.push(tira(eixo.map((v, i) => (i % 2 ? v + k * w * 0.22 + Math.sin(i) * 0.005 : v)), 0.012, '#6e6456', 0.262, { ...O, alfa: 0.7, detalhe: 3 }, 0.4));
  return partes;
}

/** Algas trazidas pela maré: fios ondulados ao longo de uma linha, com vesículas e lâminas soltas. */
function algaNaAreia(seed: number, L: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  partes.push(poli(bolha(0, 0, L * 0.5, 0.16, 20, 0.3, r), '#2a2418', 0.01, { ...S, alfa: 0.3, detalhe: 1 }));
  for (let f = 0; f < 7 + Math.round(L * 3); f++) {
    const x0 = (r() - 0.5) * L * 0.9, l = 0.2 + r() * 0.45, y0 = (r() - 0.5) * 0.22, a = (r() - 0.5) * 0.6 + (r() < 0.5 ? 0 : Math.PI), pts: number[] = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6, ox = x0 + Math.cos(a) * l * t, oy = y0 + Math.sin(a) * l * t + Math.sin(t * 9 + f) * 0.025; pts.push(Math.max(-L / 2, Math.min(L / 2, ox)), oy); }
    const cor = sorteio(r, ['#3a3a1a', '#4a4420', '#2c3418', '#5a4a24']);
    partes.push(tira(pts, 0.06, '#141408', 0.02 + f * 0.001, { ...O, detalhe: 1 }, 0.6), tira(pts, 0.04, cor, 0.021 + f * 0.001, { ...O, detalhe: 1 }, 0.6));
    if (r() < 0.5) partes.push(lente(pts[6]!, pts[7]!, a + (r() - 0.5), 0.12, 0.05, tom(cor, 0.1), 0.022 + f * 0.001, { ...O, detalhe: 3 }));
    for (let k = 1; k < 6; k += 2) if (r() < 0.6) partes.push(elipse(pts[k * 2]!, pts[k * 2 + 1]!, 0.03, 0.03, tom(cor, 0.2), 0.023 + f * 0.001, { ...O, detalhe: 3 }));
  }
  return partes;
}

// ---------- Selva ----------

/** Cipós caindo da beira de um maciço: fios da borda de cima (`y` = −comprimento/2) para baixo, de alturas diferentes, com folhas aos pares. */
function cipoPendente(seed: number, W: number, H: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], n = Math.round(4 + W * 3);
  for (let i = 0; i < n; i++) {
    const x0 = (i / (n - 1) - 0.5) * W * 0.92 + (r() - 0.5) * 0.1, l = H * (0.45 + r() * 0.55), pts: number[] = [], fase = r() * 6;
    for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(x0 + Math.sin(t * 4 + fase) * 0.06 * t, -H / 2 + l * t); }
    const z = 0.8 + r() * 0.3;
    partes.push(tira(pts, 0.05, '#0c1408', z, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.5), tira(pts, 0.028, '#5a6a2c', z + 0.002, { ...O, detalhe: 2 }, 0.5));
    for (let k = 1; k <= 8; k++) for (const lado of [-1, 1]) {
      if (r() < 0.25) continue;
      const x = pts[k * 2]!, y = pts[k * 2 + 1]!, a = Math.PI / 2 + lado * (0.9 + r() * 0.4), len = 0.1 + r() * 0.06, f = Math.cos(a - LUZ_A), cor = f > 0 ? '#5e8e34' : r() < 0.5 ? '#3c6a28' : '#467430';
      partes.push(lente(x, y, a, len + 0.02, len * 0.55 + 0.02, '#0c1408', z + 0.003, { ...O, detalhe: 2 }), lente(x, y, a, len, len * 0.55, cor, z + 0.004, { ...O, detalhe: 3 }));
    }
  }
  return partes;
}

/** Raízes de mangue: o toco do tronco e as raízes aéreas em arco em volta, que entram na água ou na lama. */
function raizesDeMangue(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], n = Math.round(9 + R * 5);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4, d1 = R * (0.7 + r() * 0.28), lado = (r() - 0.5) * 0.5, pts: number[] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8, b = a + lado * Math.sin(t * Math.PI), d = R * 0.16 + (d1 - R * 0.16) * t; pts.push(Math.cos(b) * d, Math.sin(b) * d); }
    const w = 0.07 + r() * 0.04, z = 0.5 + r() * 0.3, f = Math.cos(a - LUZ_A);
    partes.push(elipse(pts[16]!, pts[17]!, 0.24, 0.16, '#0a1410', 0.02, { ...O, alfa: 0.45, desfoque: 0.04, detalhe: 2 }));
    partes.push(tira(pts, w + 0.04, '#120e0a', z, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.55), tira(pts, w, tom('#5a4a3a', f * 0.12), z + 0.005, { ...O, detalhe: 1 }, 0.55));
    partes.push(tira(pts.map((v, j) => v + (j % 2 ? LUZ_Y : LUZ_X) * w * 0.25), w * 0.35, '#8e7a62', z + 0.01, { ...O, alfa: 0.85, detalhe: 2 }, 0.5));
  }
  partes.push(poli(bolha(0, 0, R * 0.22, R * 0.22, 14, 0.12, r), '#120e0a', 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(bolha(LUZ_X * 0.02, LUZ_Y * 0.02, R * 0.19, R * 0.19, 14, 0.1, r), '#5e4e3e', 1.21, { ...S, detalhe: 1 }));
  for (let k = 0; k < 3; k++) partes.push(elipse(LUZ_X * R * 0.03, LUZ_Y * R * 0.03, R * (0.3 - k * 0.09), R * (0.3 - k * 0.09), k % 2 ? '#7a6854' : '#4a3c30', 1.22 + k * 0.001, { ...O, alfa: 0.7, detalhe: 3 }));
  return partes;
}

// ---------- Deserto ----------

/** Cupinzeiro: um monte de barro vermelho com torres arredondadas, cada uma clara no topo e do lado da luz, e furos escuros. */
function cupinzeiro(seed: number, altura: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = (0.6 + altura * 0.4) / 2, cores = ['#2a140a', '#7a4026', '#985436', '#b46e4a', '#d09068'];
  partes.push(poli(bolha(0, 0, R * 1.15, R * 1.1, 18, 0.15, r), '#3a2418', 0.02, { ...S, alfa: 0.5, detalhe: 1 }));
  partes.push(poli(bolha(0, 0, R, R * 0.95, 18, 0.12, r), cores[0]!, altura * 0.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(bolha(0, 0, R * 0.94, R * 0.9, 18, 0.1, r), cores[1]!, altura * 0.3 + 0.005, { ...S, detalhe: 1 }));
  const torres = [{ x: (r() - 0.5) * R * 0.2, y: (r() - 0.5) * R * 0.2, t: R * 0.5, z: altura }];
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++) { const a = r() * Math.PI * 2, d = R * (0.35 + r() * 0.3); torres.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, t: R * (0.2 + r() * 0.18), z: altura * (0.45 + r() * 0.35) }); }
  for (const t of torres.sort((a, b) => a.z - b.z)) {
    partes.push(poli(bolha(t.x, t.y, t.t * 1.05, t.t, 14, 0.12, r), cores[0]!, t.z, { contorno: false, sombraLeve: true, detalhe: 1 }));
    for (let k = 1; k <= 4; k++) { const e = 1 - (k - 1) * 0.22, o = (k - 1) * 0.12; partes.push(poli(bolha(t.x + LUZ_X * t.t * o, t.y + LUZ_Y * t.t * o, t.t * e, t.t * e * 0.95, 12, 0.12, r), cores[k]!, t.z + k * 0.005, { ...S, detalhe: k < 3 ? 1 : 2 })); }
  }
  for (let i = 0; i < 6; i++) { const a = r() * Math.PI * 2, d = R * (0.3 + r() * 0.55); partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.05, 0.04, '#1a0c06', altura * 0.5 + 0.03, { ...O, detalhe: 3 })); }
  return partes;
}

// ---------- Outono e jardim ----------

/** Monte de folhas secas: centenas de folhas em lóbulos, empilhadas num domo (as do topo mais claras), sombra no pé. */
function monteDeFolhas(seed: number, R: number, cor: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], tons = [['#7a3a12', '#a85a1e', '#c87a2a', '#e0a040', '#8a6a1c'], ['#6a1c12', '#8e2a1a', '#b03e22', '#cc6a30', '#5a1a16'], ['#7a3a12', '#a85a1e', '#b03e22', '#d0a034', '#6a4a1a']][cor]!;
  partes.push(poli(bolha(0, 0, R * 1.02, R * 0.98, 20, 0.15, r), '#2a160a', 0.02, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(bolha(0, 0, R * 0.9, R * 0.86, 18, 0.15, r), '#5a2e12', 0.025, { ...S, detalhe: 1 }));
  const n = Math.min(900, Math.round(520 * R * R + 40));
  const folhas = Array.from({ length: n }, () => { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.95; return { x: Math.cos(a) * d, y: Math.sin(a) * d, h: 1 - (d / R) ** 2 }; }).sort((a, b) => a.h - b.h);
  for (const q of folhas) {
    const z = 0.03 + q.h * R * 0.35, giro = r() * Math.PI * 2, l = 0.08 + r() * 0.05, lado = (q.x * LUZ_X + q.y * LUZ_Y) / R, c = tom(sorteio(r, tons), -0.12 + q.h * 0.2 + lado * 0.12);
    for (let k = -1; k <= 1; k++) partes.push(lente(q.x, q.y, giro + k * 0.7, l * (k ? 0.75 : 1), l * 0.6, k ? tom(c, -0.06) : c, z, { ...O, detalhe: k ? 2 : 1 }));
    partes.push(lente(q.x, q.y, giro, l * 0.9, l * 0.06, tom(c, -0.3), z + 0.0005, { ...O, alfa: 0.6, detalhe: 3 }));
  }
  return partes;
}

/** Pétalas de cerejeira caídas: mais densas no miolo e ralas na borda, rosa em vários tons, umas viradas (mais claras). */
function petalas(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], n = Math.min(700, Math.round(110 * R * R + 20)), tons = ['#e8a4ba', '#f2c0cf', '#dc8ea6', '#fadae4', '#cc7892'];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = R * Math.pow(r(), 0.75), x = Math.cos(a) * d, y = Math.sin(a) * d, l = 0.055 + r() * 0.035, g = r() * Math.PI * 2, cor = sorteio(r, tons);
    partes.push(poli(bolha(x, y, l * 0.5, l * 0.36, 7, 0.15, r, g), cor, 0.02 + i * 0.00001, { ...O, alfa: 1 - (d / R) * 0.25, detalhe: d > R * 0.7 ? 2 : 1 }), elipse(x + LUZ_X * l * 0.08, y + LUZ_Y * l * 0.08, l * 0.3, l * 0.22, tom(cor, 0.12), 0.02 + i * 0.00001 + 0.000005, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  return partes;
}

const ALTURA = { id: 'altura', rotulo: 'Altura (m)', tipo: 'numero' as const };
const BRILHO = { id: 'brilho', rotulo: 'Brilho (0 a 1)', tipo: 'numero' as const, min: 0, max: 1, passo: 0.1 };

export const RECEITAS_DE_BIOMAS: Receita[] = [
  { id: 'fungos-luminosos', nome: 'Fungos luminosos', categoria: 'exterior', tipo: 'piso', funcoes: ['caverna', 'jardim'], kit: 'caverna', tags: ['fungos', 'cogumelos', 'brilho', 'luminoso', 'caverna', 'rasteira', 'subterraneo', 'natureza', 'magia'], pegada: [0.6, 0.6], altura: 0.08,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.3, min: 0.15, max: 0.8, passo: 0.05 }, { id: 'lilas', rotulo: 'Cor (0 verde-água, 1 lilás)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const R = num(p, 'raio', 0.3, 0.15, 0.8); return piso([R * 2, R * 2], fungosLuminosos(p.seed, R, num(p, 'lilas', 0, 0, 1) >= 0.5)); } },
  { id: 'cogumelo-gigante', nome: 'Cogumelo gigante', categoria: 'exterior', tipo: 'piso', funcoes: ['caverna', 'jardim'], kit: 'caverna', tags: ['cogumelo', 'fungo', 'gigante', 'brilho', 'luminoso', 'caverna', 'subterraneo', 'natureza', 'magia', 'floresta'], pegada: [4.68, 4.68],
    campos: [{ ...ALTURA, padrao: 4, min: 2, max: 6, passo: 1 }, { ...BRILHO, padrao: 0.7 }, { id: 'cor', rotulo: 'Cor (0 castanho, 1 verde-água, 2 lilás, 3 vermelho)', tipo: 'numero', padrao: 1, min: 0, max: 3, passo: 1 }],
    gerar: p => { const h = num(p, 'altura', 4, 2, 6), d = (0.8 + h * 0.45) * 1.8; return piso([d, d], cogumeloGigante(p.seed, h, Math.round(num(p, 'cor', 1, 0, 3)), num(p, 'brilho', 0.7, 0, 1))); } },
  { id: 'cristal', nome: 'Cristais', categoria: 'exterior', tipo: 'piso', funcoes: ['caverna'], kit: 'caverna', tags: ['cristal', 'cristais', 'gema', 'brilho', 'luminoso', 'caverna', 'subterraneo', 'magia', 'mina'], pegada: [2.4, 2.4],
    campos: [{ id: 'tamanho', rotulo: 'Tamanho (m)', tipo: 'numero', padrao: 1.5, min: 0.5, max: 3, passo: 0.5 }, { ...BRILHO, padrao: 0.7 }, { id: 'cor', rotulo: 'Cor (0 ciano, 1 violeta, 2 âmbar, 3 verde, 4 rosa)', tipo: 'numero', padrao: 0, min: 0, max: 4, passo: 1 }],
    gerar: p => { const t = num(p, 'tamanho', 1.5, 0.5, 3); return piso([t * 1.6, t * 1.6], cristal(p.seed, t, Math.round(num(p, 'cor', 0, 0, 4)), num(p, 'brilho', 0.7, 0, 1))); } },
  { id: 'fumarola', nome: 'Fumarola', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'caverna'], kit: 'ermos', tags: ['fumarola', 'vapor', 'enxofre', 'fenda', 'vulcao', 'vulcanico', 'brasa', 'rasteira'], pegada: [1.2, 0.84], altura: 0.06,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 1.2, min: 0.6, max: 2.5, passo: 0.1 }],
    gerar: p => { const L = num(p, 'comprimento', 1.2, 0.6, 2.5); return piso([L, L * 0.7], fumarola(p.seed, L)); } },
  { id: 'concha', nome: 'Conchas', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'porto', tags: ['concha', 'conchas', 'praia', 'mar', 'areia', 'rasteira'], pegada: [0.6, 0.6], altura: 0.04,
    campos: [{ id: 'quantas', rotulo: 'Quantas', tipo: 'numero', padrao: 4, min: 1, max: 10, passo: 1 }],
    gerar: p => piso([0.6, 0.6], conchas(p.seed, Math.round(num(p, 'quantas', 4, 1, 10)))) },
  { id: 'estrela-do-mar', nome: 'Estrela-do-mar', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'porto', tags: ['estrela-do-mar', 'praia', 'mar', 'areia', 'rasteira'], pegada: [0.25, 0.25], altura: 0.04,
    campos: [{ id: 'tamanho', rotulo: 'Tamanho (m)', tipo: 'numero', padrao: 0.25, min: 0.12, max: 0.5, passo: 0.01 }, { id: 'cor', rotulo: 'Cor (0 laranja, 1 vermelha, 2 roxa)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => { const t = num(p, 'tamanho', 0.25, 0.12, 0.5); return piso([t, t], estrelaDoMar(p.seed, t / 2, Math.round(num(p, 'cor', 0, 0, 2)))); } },
  { id: 'madeira-a-deriva', nome: 'Madeira à deriva', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'porto', tags: ['madeira', 'tronco', 'deriva', 'praia', 'mar', 'areia', 'natureza'], pegada: [1.8, 0.6], altura: 0.3,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 1.8, min: 1, max: 3.5, passo: 0.1 }],
    gerar: p => { const L = num(p, 'comprimento', 1.8, 1, 3.5); return piso([L, 0.6], madeiraADeriva(p.seed, L)); } },
  { id: 'alga-na-areia', nome: 'Algas na areia', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'porto', tags: ['alga', 'algas', 'mare', 'praia', 'mar', 'areia', 'rasteira'], pegada: [1.4, 0.5], altura: 0.04,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 1.4, min: 0.6, max: 3, passo: 0.1 }],
    gerar: p => { const L = num(p, 'comprimento', 1.4, 0.6, 3); return piso([L, 0.5], algaNaAreia(p.seed, L)); } },
  { id: 'cipo-pendente', nome: 'Cipós pendentes', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'caverna'], kit: 'mata', tags: ['cipo', 'cipos', 'trepadeira', 'selva', 'tropical', 'penhasco', 'macico', 'natureza'], pegada: [2, 1.6], altura: 1.1,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2, min: 0.8, max: 5, passo: 0.1 }, { id: 'comprimento', rotulo: 'Queda (m)', tipo: 'numero', padrao: 1.6, min: 0.8, max: 3, passo: 0.1 }],
    gerar: p => { const W = num(p, 'largura', 2, 0.8, 5), H = num(p, 'comprimento', 1.6, 0.8, 3); return piso([W, H], cipoPendente(p.seed, W, H)); } },
  { id: 'raizes-de-mangue', nome: 'Raízes de mangue', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'mata', tags: ['raizes', 'mangue', 'pantano', 'tropical', 'agua', 'natureza'], pegada: [2.4, 2.4], altura: 1.2,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 1.2, min: 0.6, max: 2.5, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 1.2, 0.6, 2.5); return piso([R * 2, R * 2], raizesDeMangue(p.seed, R)); } },
  { id: 'cupinzeiro', nome: 'Cupinzeiro', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'ermos', tags: ['cupinzeiro', 'cupim', 'monte', 'barro', 'savana', 'deserto', 'tropical', 'natureza'], pegada: [1.4, 1.4],
    campos: [{ ...ALTURA, padrao: 2, min: 1, max: 3, passo: 0.5 }],
    gerar: p => { const h = num(p, 'altura', 2, 1, 3), d = 0.6 + h * 0.4; return piso([d, d], cupinzeiro(p.seed, h)); } },
  { id: 'monte-de-folhas', nome: 'Monte de folhas', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'mata', tags: ['folhas', 'monte', 'outono', 'secas', 'natureza'], pegada: [1.4, 1.4], altura: 0.3,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.7, min: 0.3, max: 1.5, passo: 0.05 }, { id: 'cor', rotulo: 'Cor (0 laranja, 1 vermelha, 2 misturada)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => { const R = num(p, 'raio', 0.7, 0.3, 1.5); return piso([R * 2, R * 2], monteDeFolhas(p.seed, R, Math.round(num(p, 'cor', 0, 0, 2)))); } },
  { id: 'petalas-de-cerejeira', nome: 'Pétalas de cerejeira', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'exterior', tags: ['petalas', 'cerejeira', 'sakura', 'flor', 'rosa', 'oriental', 'rasteira', 'natureza'], pegada: [3, 3], altura: 0.02,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 1.5, min: 0.5, max: 3, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 1.5, 0.5, 3); return piso([R * 2, R * 2], petalas(p.seed, R)); } },
];
