import { elipse, poli, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira, tufo, type Tons as TonsDeTufo } from '../organico.ts';
import { num, piso, type LuzDeReceita, type Receita } from './comum.ts';
import {
  ID, O, S, anel, arco, bloco, cilindro, disco, em, estofado, fogoQueBrilha, halo, olhar, quadro, retQ, retR,
  tomDaFace, type Quadro, type Tons,
} from './formas.ts';
import { ACO, CONCRETO, CORES_DE_CARRO, GRAFITE, LIBRES, MODELOS, lataria, ligado, tonsDe, type Modelo } from './moderno-urbano.ts';

// Pós-apocalíptico (Q22): a ruína e a sucata (Q22a). Tinta desbotada pelo sol e comida pela ferrugem, vidro quebrado, chapa ondulada remendada,
// lona, sacos de aniagem, borracha gasta e fogo de tonel. As regras do acervo: nanquim por baixo da silhueta, volume em degraus de tom para o
// noroeste, `z` das partes até 1,5 m e a `altura` real na receita. Os veículos olham para +x, como os da Q21. O acampamento (Q22b): lona, paletes,
// papelão, plástico azul, horta em pneus e fogo de aro de roda.

const FERRUGEM: Tons = { nanquim: '#140b06', sombra: '#3a2213', base: '#55321c', meio: '#663e22', luz: '#7c4e2e', brilho: '#9e6a44' };
const PNEU: Tons = { nanquim: '#040405', sombra: '#0c0c0e', base: '#17171a', meio: '#1f1f23', luz: '#2b2b30', brilho: '#4a4a52' };
const SACO: Tons = { nanquim: '#1c140a', sombra: '#5a482c', base: '#7a6642', meio: '#8e7850', luz: '#a48c62', brilho: '#c2aa7e' };
const MADEIRA: Tons = { nanquim: '#140e08', sombra: '#3a2c1c', base: '#56442c', meio: '#665238', luz: '#7c6646', brilho: '#9c8664' };
const POEIRA = '#8a7a5c', ESCURO = '#0c0b0a', CACO = '#9ab0b8';

/** Mistura duas cores `#rrggbb` (t = 0 dá `a`, 1 dá `b`). */
function misturar(a: string, b: string, t: number): string {
  const c = (h: string, i: number): number => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(c(a, i) + (c(b, i) - c(a, i)) * t).toString(16).padStart(2, '0')).join('');
}
/** Tinta velha: a cor puxada para o cinza-terra do sol e da poeira. */
const desbotada = (cor: string, k = 0.45): Tons => tonsDe(misturar(cor, '#6e665a', k));

/**
 * Ferrugem num retângulo (u, v, w, h) do referencial `f`, mais densa nas bordas (onde a água para): cada mancha é uma auréola escura e macia,
 * o miolo marrom e o picado de pontinhos em volta, para não ler como adesivo.
 */
function ferrugem(partes: Parte[], r: () => number, f: Quadro, u: number, v: number, w: number, h: number, z: number, n: number, borda = 0.6): void {
  for (let k = 0; k < n; k++) {
    const naBorda = r() < borda, lado = r() < 0.5 ? -1 : 1;
    const pu = u + (naBorda && r() < 0.5 ? lado * w * (0.38 + r() * 0.1) : (r() - 0.5) * w * 0.9);
    const pv = v + (naBorda ? lado * h * (0.36 + r() * 0.1) : (r() - 0.5) * h * 0.85);
    const rx = 0.04 + r() * Math.min(w, h) * 0.1, ry = rx * (0.5 + r() * 0.5), [x, y] = f(pu, pv), zz = z + k * 0.0004, g = r() * 6;
    partes.push(poli(bolha(x, y, rx * 1.5, ry * 1.5, 14, 0.25, r, g), FERRUGEM.sombra, zz, { ...S, alfa: 0.35, desfoque: rx * 0.3, detalhe: 2 }));
    partes.push(poli(bolha(x, y, rx, ry, 14, 0.22, r, g), r() < 0.5 ? FERRUGEM.base : FERRUGEM.meio, zz + 0.0001, { ...S, alfa: 0.55 + r() * 0.25, detalhe: 2 }));
    for (let j = 0; j < 4; j++) { const a = r() * 6.28, d = 1 + r() * 0.8; partes.push(elipse(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, 0.018 + r() * 0.02, 0.018 + r() * 0.02, r() < 0.5 ? FERRUGEM.sombra : FERRUGEM.base, zz + 0.0002, { ...S, alfa: 0.7, detalhe: 3 })); }
  }
}

/** Cacos de vidro espalhados num disco: lascas claras com um ponto de brilho. */
function cacos(partes: Parte[], r: () => number, x: number, y: number, rx: number, ry: number, n: number, z: number): void {
  for (let k = 0; k < n; k++) {
    const a = r() * 6.28, d = Math.sqrt(r()), px = x + Math.cos(a) * rx * d, py = y + Math.sin(a) * ry * d, s = 0.025 + r() * 0.04, g = r() * 6.28;
    partes.push(poli([px + Math.cos(g) * s, py + Math.sin(g) * s, px + Math.cos(g + 2.2) * s * 0.6, py + Math.sin(g + 2.2) * s * 0.6, px + Math.cos(g + 4) * s * 0.8, py + Math.sin(g + 4) * s * 0.8], CACO, z, { ...O, alfa: 0.55 + r() * 0.35, detalhe: 3 }));
  }
}

/** Buraco de vidro quebrado no polígono `pts` (já no mapa): o escuro de dentro, os dentes de vidro que sobraram na moldura e as trincas em teia. */
function vidroQuebrado(partes: Parte[], r: () => number, pts: number[], z: number, dentro = ESCURO): void {
  partes.push(poli(pts, dentro, z, { ...O, detalhe: 1 }));
  const n = pts.length / 2;
  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) { cx += pts[i * 2]!; cy += pts[i * 2 + 1]!; }
  cx /= n; cy /= n;
  // Os dentes: triângulos que partem das quinas e do meio de cada lado, apontando para o centro.
  for (let i = 0; i < n; i++) {
    const ax = pts[i * 2]!, ay = pts[i * 2 + 1]!, bx = pts[((i + 1) % n) * 2]!, by = pts[((i + 1) % n) * 2 + 1]!;
    for (let k = 0; k < 2; k++) {
      if (r() < 0.35) continue;
      const t0 = r() * 0.7, t1 = t0 + 0.15 + r() * 0.25, p = 0.15 + r() * 0.4;
      const x0 = ax + (bx - ax) * t0, y0 = ay + (by - ay) * t0, x1 = ax + (bx - ax) * Math.min(1, t1), y1 = ay + (by - ay) * Math.min(1, t1);
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      partes.push(poli([x0, y0, x1, y1, mx + (cx - mx) * p, my + (cy - my) * p], '#5a6e78', z + 0.001, { ...O, alfa: 0.75, detalhe: 2 }));
      partes.push(tira([x0, y0, mx + (cx - mx) * p * 0.8, my + (cy - my) * p * 0.8], 0.012, '#c8dce4', z + 0.002, { ...O, alfa: 0.6, detalhe: 3 }));
    }
  }
}

/** Trincas em teia num vidro que ainda está no lugar, a partir de (x, y). */
function teia(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number): void {
  for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28 + r() * 0.5, l = R * (0.5 + r() * 0.6); partes.push(tira([x, y, x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 0.03, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l], 0.012, '#dce8ee', z, { ...O, alfa: 0.55, detalhe: 3 }, 0.4)); }
  for (const f of [0.35, 0.7]) partes.push(tira(arco(x, y, R * f, R * f * 0.9, r() * 6, r() * 6 + 4.5, 10), 0.01, '#dce8ee', z, { ...O, alfa: 0.4, detalhe: 3 }));
  partes.push(elipse(x, y, 0.05, 0.05, '#eef6fa', z + 0.001, { ...O, alfa: 0.7, detalhe: 3 }));
}

// ---------- Carcaças (Q22a) ----------

/**
 * Carcaça de carro (cada modelo da Q21), com a frente para +x: sem pneus (as rodas no chão, só aro, ou um pneu murcho), a lataria desbotada
 * e comida de ferrugem, o capô amassado ou arrancado (com o motor à vista), o para-brisa estourado com os bancos rasgados lá dentro, uma porta
 * que falta, os faróis quebrados, poeira no teto e cacos em volta.
 */
function carcaca(seed: number, m: Modelo, cor: string): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], f = ID, { L, W } = m, t = desbotada(cor, 0.4 + r() * 0.2), [g0, g1] = m.cabine;
  sombraNoChao(partes, retR(f, 0, 0, L + 0.1, W + 0.1, m.raio), 0.01, '#0a0a0c', 0.7);
  // As rodas: aro enferrujado no chão ou o pneu murcho, que escapa mais que o cheio.
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    const v = sv * (W / 2 - 0.08);
    if (r() < 0.35) partes.push(poli(retR(f, su * m.eixo, v + sv * 0.04, 0.7, 0.32, 0.1), PNEU.base, 0.12, { contorno: 'leve', detalhe: 1 }), tira(em(f, [su * m.eixo - 0.25, v + sv * 0.16, su * m.eixo + 0.25, v + sv * 0.16]), 0.03, PNEU.luz, 0.122, { ...O, alfa: 0.7, detalhe: 3 }));
    else partes.push(poli(retR(f, su * m.eixo, v, 0.5, 0.18, 0.06), FERRUGEM.sombra, 0.12, { contorno: 'leve', detalhe: 2 }));
  }
  lataria(partes, f, 0, L, W, t, 0.6, m.raio);
  // A ferrugem da lataria, mais forte nos flancos baixos e nas caixas de roda.
  // A poeira assentada e o encardido de baixo, antes da ferrugem.
  partes.push(poli(bolha(0, -W * 0.05, L * 0.42, W * 0.36, 16, 0.2, r), POEIRA, 0.609, { ...S, alfa: 0.22, desfoque: 0.15, detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(poli(retR(f, 0, s * (W / 2 - 0.1), L - 0.3, 0.16, 0.06), t.nanquim, 0.61, { ...S, alfa: 0.3, desfoque: 0.06, detalhe: 2 }));
  ferrugem(partes, r, f, 0, 0, L - 0.2, W - 0.1, 0.612, 26, 0.75);
  for (const su of [-1, 1]) for (const sv of [-1, 1]) partes.push(poli(bolha(...f(su * m.eixo, sv * (W / 2 - 0.12)), 0.36, 0.1, 14, 0.25, r), FERRUGEM.sombra, 0.62, { ...S, alfa: 0.6, desfoque: 0.04, detalhe: 2 }));
  // O para-choque: um falta, o outro está torto.
  const falta = r() < 0.5 ? 1 : -1;
  partes.push(tira(arco(-falta * (L / 2 - m.raio * 0.9), 0.04, m.raio * 0.9, W / 2 - 0.08, falta < 0 ? -1.05 : Math.PI - 1.25, falta < 0 ? 1.25 : Math.PI + 1.05, 10), 0.07, '#18191b', 0.66, { ...O, detalhe: 2 }));
  // O capô: amassado e enferrujado, ou arrancado, com o motor à vista.
  const cf = L / 2 - 0.16, semCapo = !m.cacamba && r() < 0.45;
  if (semCapo) {
    const cu = (g1 + 0.08 + cf) / 2, cl = cf - g1 - 0.12;
    partes.push(poli(retR(f, cu, 0, cl, W * 0.78, 0.1), ESCURO, 0.68, { ...O, detalhe: 1 }));
    bloco(partes, quadro(cu - 0.05, -0.08), cl * 0.55, W * 0.42, tonsDe('#3a3632'), 0.7, 0.05);
    ferrugem(partes, r, quadro(cu - 0.05, -0.08), 0, 0, cl * 0.5, W * 0.38, 0.72, 5, 0.3);
    disco(partes, cu + cl * 0.32, W * 0.22, 0.12, tonsDe('#2a2826'), 0.69);
    partes.push(tira(em(f, [cu - cl * 0.3, W * 0.28, cu, W * 0.32, cu + cl * 0.2, W * 0.12]), 0.035, '#121212', 0.73, { contorno: 'leve', detalhe: 3 }));
    // O capô arrancado caído junto do carro.
    if (r() < 0.6) { const k = quadro(L / 2 - 0.3, -W * 0.45, 0.4 + r() * 0.5); partes.push(poli(retR(k, 0, 0, 0.9, 1.1, 0.12), t.nanquim, 0.05, { contorno: 'leve', detalhe: 1 }), poli(retR(k, -0.01, -0.01, 0.86, 1.06, 0.12), t.sombra, 0.052, { ...O, detalhe: 1 })); ferrugem(partes, r, k, 0, 0, 0.8, 1, 0.054, 5, 0.4); }
  } else {
    for (let k = 0; k < 3; k++) partes.push(lente(...f(g1 + 0.2 + r() * (cf - g1 - 0.4), (r() - 0.5) * W * 0.5), r() * 3, 0.3 + r() * 0.2, 0.12, t.sombra, 0.64, { ...S, alfa: 0.3, desfoque: 0.04, detalhe: 3 }));
    partes.push(lente(g1 + 0.1, -W * 0.12, 0, (cf - g1) * 0.7, W * 0.2, t.luz, 0.641, { ...S, alfa: 0.4, detalhe: 2 }));
  }
  // A porta que falta: o vão escuro no flanco, com a beira do banco.
  if (r() < 0.55) {
    const s = r() < 0.5 ? -1 : 1, pu = m.cacamba ? (g0 + g1) / 2 : g1 - 0.6;
    partes.push(poli(retQ(f, pu, s * (W / 2 - 0.12), 0.95, 0.24), ESCURO, 0.66, { ...O, detalhe: 2 }), poli(retQ(f, pu - 0.05, s * (W / 2 - 0.2), 0.5, 0.1), '#3a2e22', 0.662, { ...O, detalhe: 3 }));
  }
  // A caçamba da picape: o fundo enferrujado e o que sobrou de carga.
  if (m.cacamba) {
    const [c0, c1] = m.cacamba, cu = (c0 + c1) / 2, cl = c1 - c0;
    partes.push(poli(retQ(f, cu, 0, cl, W - 0.2), FERRUGEM.nanquim, 0.66, { ...O, detalhe: 1 }), poli(retQ(f, cu + 0.02, -0.02, cl - 0.08, W - 0.3), FERRUGEM.sombra, 0.662, { ...O, detalhe: 1 }));
    ferrugem(partes, r, f, cu, 0, cl - 0.1, W - 0.3, 0.664, 8, 0.2);
    if (r() < 0.6) partes.push(...pneuDeitado(cu + 0.2, 0.1, 0.32, 0.7));
  }
  // A cabine: o vidro de cada lado e o para-brisa estourados, o teto amassado com a poeira.
  const gu = (g0 + g1) / 2, gl = g1 - g0, tu0 = g0 + m.vidroTras, tu1 = g1 - m.parabrisa, tl = tu1 - tu0;
  partes.push(poli(retR(f, gu, 0, gl, W * 0.84, 0.26), '#141a1e', 1.0, { ...O, detalhe: 1 }));
  // Por dentro, pelo para-brisa: os bancos rasgados com a espuma, o volante.
  vidroQuebrado(partes, r, em(f, [tu1 + 0.04, -W * 0.38, g1 - 0.06, -W * 0.34, g1 - 0.06, W * 0.34, tu1 + 0.04, W * 0.38]), 1.002, '#12100e');
  for (const s of [-1, 1]) {
    estofado(partes, quadro(...f(tu1 + 0.06, s * W * 0.2)), 0, 0, 0, 0.22, W * 0.3, '#3e3226', 1.006, 0.05);
    if (r() < 0.6) partes.push(poli(bolha(...f(tu1 + 0.06, s * W * 0.2), 0.06, 0.05, 7, 0.4, r), '#b8a47a', 1.012, { ...S, alfa: 0.8, detalhe: 3 }));
  }
  partes.push(tira(arco(...f(tu1 + 0.22, -W * 0.2), 0.05, 0.13, -1.4, 1.4, 6), 0.03, '#0a0a0a', 1.014, { ...O, detalhe: 3 }));
  if (m.vidroTras > 0.15) { if (r() < 0.5) vidroQuebrado(partes, r, em(f, [g0 + 0.06, -W * 0.34, tu0 - 0.04, -W * 0.36, tu0 - 0.04, W * 0.36, g0 + 0.06, W * 0.34]), 1.002); else teia(partes, r, ...f((g0 + tu0) / 2, (r() - 0.5) * W * 0.3), 0.3, 1.004); }
  for (const s of [-1, 1]) { partes.push(tira(em(f, [tu1, s * W * 0.34, g1 - 0.06, s * W * 0.41]), 0.05, t.base, 1.204, { ...O, detalhe: 2 })); partes.push(tira(em(f, [tu0, s * W * 0.34, g0 + 0.06, s * W * 0.4]), 0.06, t.base, 1.204, { ...O, detalhe: 2 })); }
  partes.push(poli(retR(f, (tu0 + tu1) / 2 + 0.01, 0.012, tl + 0.03, W * 0.74, 0.16), t.nanquim, 1.25, { ...O, detalhe: 1 }));
  partes.push(poli(retR(f, (tu0 + tu1) / 2, 0, tl, W * 0.72, 0.15), t.meio, 1.252, { ...O, detalhe: 1 }));
  partes.push(poli(retR(f, (tu0 + tu1) / 2 - tl * 0.06, -W * 0.08, tl * 0.8, W * 0.4, 0.12), t.luz, 1.254, { ...S, alfa: 0.7, detalhe: 2 }));
  // O amassado do teto: a sombra da cova e a borda clara do lado da luz.
  const [ax, ay] = f((tu0 + tu1) / 2 + (r() - 0.5) * tl * 0.4, (r() - 0.5) * W * 0.3);
  partes.push(elipse(ax, ay, Math.min(0.8, tl * 0.45), W * 0.26, t.sombra, 1.256, { ...S, alfa: 0.35, desfoque: 0.08, detalhe: 2 }), lente(ax, ay + 0.1, 0, Math.min(0.6, tl * 0.35), 0.05, t.brilho, 1.257, { ...S, alfa: 0.45, detalhe: 3 }));
  ferrugem(partes, r, f, (tu0 + tu1) / 2, 0, tl, W * 0.7, 1.258, 8, 0.5);
  partes.push(poli(bolha(...f((tu0 + tu1) / 2 + 0.1, W * 0.1), tl * 0.4, W * 0.28, 12, 0.3, r), POEIRA, 1.26, { ...S, alfa: 0.3, detalhe: 2 }));
  if (tl > 2.5) for (let u = tu0 + 0.45; u < tu1 - 0.2; u += 0.45) partes.push(tira(em(f, [u, -W * 0.33, u, W * 0.33]), 0.025, t.sombra, 1.259, { ...O, alfa: 0.5, detalhe: 3 }));
  // O retrovisor que sobrou.
  const sr = r() < 0.5 ? -1 : 1, [rx, ry] = f(g1 - 0.12, sr * (W / 2 + 0.06));
  partes.push(elipse(rx + 0.01, ry + 0.01, 0.16, 0.12, t.nanquim, 0.9, { contorno: 'leve', detalhe: 2 }), elipse(rx, ry, 0.13, 0.09, t.base, 0.902, { ...O, detalhe: 2 }));
  // Os faróis e as lanternas: buracos escuros com os cacos da lente.
  for (const s of [-1, 1]) for (const [u, w, c] of [[L / 2 - 0.1, 0.12, '#8a9498'], [-L / 2 + 0.07, 0.08, '#4a1410']] as const) {
    partes.push(poli(retR(f, u, s * W * 0.35, w + 0.02, 0.32, 0.05), '#0a0a0c', 0.68, { ...O, detalhe: 2 }));
    if (r() < 0.5) partes.push(poli(retR(f, u, s * W * 0.35 - 0.06, w, 0.12, 0.04), c, 0.682, { ...O, alfa: 0.8, detalhe: 3 }));
  }
  cacos(partes, r, L * 0.3, -W * 0.5, 0.8, 0.25, 10, 0.02);
  return partes;
}

/** Pneu deitado (de pé, a boca virada para cima) em (x, y): o anel de borracha com a banda de rodagem, o furo escuro e a luz no lado do noroeste. */
function pneuDeitado(x: number, y: number, R: number, z: number, agua = false): Parte[] {
  const partes: Parte[] = [], ri = R * 0.55;
  partes.push(elipse(x + 0.015, y + 0.018, R * 2 + 0.05, R * 2 + 0.05, PNEU.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(elipse(x, y, R * 2, R * 2, PNEU.base, z + 0.003, { ...O, detalhe: 1 }));
  // A banda de rodagem: os sulcos curtos em volta da borda.
  for (let k = 0; k < 28; k++) { const a = (k / 28) * 6.28; partes.push(tira([x + Math.cos(a) * R * 0.86, y + Math.sin(a) * R * 0.86, x + Math.cos(a + 0.08) * R * 0.99, y + Math.sin(a + 0.08) * R * 0.99], 0.022, PNEU.nanquim, z + 0.004, { ...O, alfa: 0.8, detalhe: 3 })); }
  // O flanco em volume: a luz para o noroeste por fora; o furo; dentro do furo, a parede do outro lado acesa.
  partes.push(tira(arco(x, y, (R + ri) / 2, (R + ri) / 2, Math.PI * 0.9, Math.PI * 1.6, 10), (R - ri) * 0.45, PNEU.luz, z + 0.006, { ...S, detalhe: 2 }, 0.4));
  partes.push(tira(arco(x, y, (R + ri) / 2, (R + ri) / 2, Math.PI * 1.05, Math.PI * 1.45, 8), (R - ri) * 0.15, PNEU.brilho, z + 0.007, { ...S, alfa: 0.7, detalhe: 3 }, 0.3));
  partes.push(tira(arco(x, y, ri * 0.98, ri * 0.98, -0.1, Math.PI * 0.6, 8), 0.03, PNEU.sombra, z + 0.006, { ...O, detalhe: 3 }));
  partes.push(elipse(x, y, ri * 2, ri * 2, '#050506', z + 0.008, { ...O, detalhe: 1 }));
  partes.push(tira(arco(x, y, ri * 0.82, ri * 0.82, -0.25, Math.PI * 0.75, 8), ri * 0.28, PNEU.meio, z + 0.009, { ...S, detalhe: 3 }, 0.4));
  if (agua) partes.push(elipse(x + 0.01, y + 0.01, ri * 1.3, ri * 1.2, '#2a3236', z + 0.01, { ...S, alfa: 0.85, detalhe: 2 }), lente(x - ri * 0.2, y - ri * 0.2, -0.8, ri * 0.7, ri * 0.15, '#8aa0aa', z + 0.011, { ...S, alfa: 0.4, detalhe: 3 }));
  return partes;
}

/**
 * Ônibus tombado de lado (12 m, frente em +x): de cima se vê o costado, com a fita de janelas (quase todas estouradas, a escuridão de dentro e os
 * bancos de pé), as portas, a faixa da pintura desbotada e a saia comida de ferrugem; as rodas de cima mostram a face; o ar-condicionado do teto
 * fica apoiado no chão do lado −y, e o chassi aparece de canto do lado +y. Cacos e mato em volta.
 */
function onibusTombado(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 12, H = 2.9, [saia, faixa] = LIBRES[Math.floor(r() * LIBRES.length)]!, t = desbotada(saia, 0.5), teto = desbotada('#d4d2ca', 0.35);
  const v0 = -H / 2, v1 = H / 2;
  sombraNoChao(partes, retR(ID, 0.1, 0.1, L + 0.3, H + 0.3, 0.2), 0.01, '#0a0a0c', 0.75, [0.12, 0.14]);
  // O ar-condicionado e as escotilhas do teto, de lado, apoiados no chão do lado −y.
  bloco(partes, quadro(-2.2, v0 - 0.12), 2.6, 0.32, desbotada('#7e848a', 0.3), 0.35, 0.05);
  ferrugem(partes, r, quadro(-2.2, v0 - 0.12), 0, 0, 2.5, 0.3, 0.36, 4, 0.5);
  // O chassi e o eixo, de canto, do lado +y: a borda escura com os feixes de mola.
  partes.push(poli(retQ(ID, 0, v1 + 0.08, L - 1.4, 0.2), '#0e0e10', 0.5, { contorno: 'leve', detalhe: 1 }));
  for (const u of [-3.4, 3.7]) partes.push(poli(retQ(ID, u, v1 + 0.12, 1.1, 0.14), FERRUGEM.sombra, 0.52, { ...O, detalhe: 2 }));
  // O costado: o nanquim, a chapa, o friso do teto (−y) e a saia (+y) nos tons da face.
  partes.push(poli(retR(ID, 0.012, 0.014, L + 0.05, H + 0.05, 0.18), t.nanquim, 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(ID, 0, 0, L, H, 0.16), t.base, 1.203, { ...O, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, v0 + 0.14, L - 0.3, 0.22), teto.meio, 1.205, { ...O, detalhe: 1 }), tira([-L / 2 + 0.15, v0 + 0.05, L / 2 - 0.15, v0 + 0.05], 0.04, teto.brilho, 1.206, { ...O, alfa: 0.6, detalhe: 3 }));
  partes.push(poli(retQ(ID, 0, v1 - 0.3, L - 0.2, 0.55), t.sombra, 1.205, { ...S, alfa: 0.6, detalhe: 2 }));
  // A fita de janelas: os vãos estourados (escuros, com os encostos dos bancos lá embaixo) e algum vidro que ficou, fosco de poeira.
  const j0 = v0 + 0.32, j1 = v0 + 1.2, ju = (j0 + j1) / 2, jh = j1 - j0;
  partes.push(poli(retQ(ID, -0.6, ju, L - 2.4, jh + 0.08), t.nanquim, 1.21, { ...O, detalhe: 1 }));
  for (let u = -L / 2 + 0.75; u < L / 2 - 2.1; u += 1.25) {
    const x = u + 0.6, pts = retQ(ID, x, ju, 1.1, jh);
    if (r() < 0.72) {
      vidroQuebrado(partes, r, pts, 1.212, '#0e0f10');
      for (const dv of [-0.18, 0.18]) partes.push(poli(retR(ID, x + dv * 1.4, ju + 0.12, 0.38, 0.12, 0.04), '#2a2620', 1.213, { ...O, alfa: 0.9, detalhe: 3 }));
    } else {
      partes.push(poli(pts, '#3a4448', 1.212, { ...O, detalhe: 1 }), poli(retQ(ID, x - 0.1, ju - 0.1, 0.8, jh * 0.4), '#7a8a8e', 1.213, { ...S, alfa: 0.35, detalhe: 2 }));
      if (r() < 0.6) teia(partes, r, x + (r() - 0.5) * 0.5, ju + (r() - 0.5) * 0.3, 0.4, 1.214);
    }
  }
  // As portas dobradiças: os montantes e o vão do meio (uma aberta, escura).
  for (const [u, aberta] of [[L / 2 - 1.35, r() < 0.5], [-0.2, true]] as const) {
    partes.push(poli(retQ(ID, u, v0 + 0.95, 1.1, 1.5), t.nanquim, 1.215, { ...O, detalhe: 1 }));
    if (aberta) partes.push(poli(retQ(ID, u, v0 + 0.95, 1.0, 1.4), ESCURO, 1.216, { ...O, detalhe: 1 }), poli(retQ(ID, u + 0.1, v0 + 1.45, 0.7, 0.3), '#2a2a2c', 1.217, { ...O, detalhe: 3 }));
    else for (const s of [-1, 1]) vidroQuebrado(partes, r, retQ(ID, u + s * 0.25, v0 + 0.75, 0.42, 0.9), 1.216, '#101112');
  }
  // A faixa da pintura e a saia: a chapa, as tampas de serviço e a ferrugem que sobe de baixo.
  partes.push(poli(retQ(ID, -0.6, v0 + 1.42, L - 2.6, 0.16), misturar(faixa, '#6e665a', 0.45), 1.22, { ...O, detalhe: 2 }));
  for (const u of [-5.0, -1.6, 1.4]) partes.push(tira(retQ(ID, u, v1 - 0.55, 0.9, 0.55).concat(u - 0.45, v1 - 0.825), 0.02, t.nanquim, 1.222, { ...O, alfa: 0.6, detalhe: 3 }));
  ferrugem(partes, r, ID, 0, v1 - 0.55, L - 0.3, 1.0, 1.224, 30, 0.5);
  ferrugem(partes, r, ID, 0, 0, L - 0.4, H - 0.3, 1.226, 12, 0.6);
  // As rodas de cima: o pneu de face, com o aro e as porcas, nas caixas de roda.
  for (const u of [-3.4, 3.7]) {
    partes.push(elipse(u, v1 - 0.52, 1.2, 1.2, ESCURO, 1.23, { ...O, detalhe: 1 }));
    partes.push(...pneuDeitado(u, v1 - 0.52, 0.5, 1.232));
    disco(partes, u, v1 - 0.52, 0.2, desbotada('#8a8e92', 0.4), 1.245);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28; partes.push(elipse(u + Math.cos(a) * 0.13, v1 - 0.52 + Math.sin(a) * 0.13, 0.03, 0.03, FERRUGEM.nanquim, 1.26, { ...O, detalhe: 3 })); }
  }
  // A frente (+x): o para-brisa estourado de canto, os faróis; a traseira, a grade do motor.
  vidroQuebrado(partes, r, retQ(ID, L / 2 - 0.12, v0 + 0.85, 0.18, 1.3), 1.235);
  for (let v = v1 - 0.9; v < v1 - 0.2; v += 0.12) partes.push(tira([-L / 2 + 0.1, v, -L / 2 + 0.45, v], 0.04, t.nanquim, 1.236, { ...O, alfa: 0.7, detalhe: 3 }));
  // Os amassados e a pichação no costado.
  for (let k = 0; k < 4; k++) { const x = (r() - 0.5) * L * 0.8, y = v1 - 0.9 + (r() - 0.5) * 0.5; partes.push(elipse(x, y, 0.6 + r() * 0.6, 0.3, t.sombra, 1.24, { ...S, alfa: 0.5, detalhe: 2 }), lente(x - 0.1, y - 0.18, 0, 0.5, 0.04, t.luz, 1.241, { ...S, alfa: 0.5, detalhe: 3 })); }
  const px = 1.5 + r() * 1.5, cp = ['#c8c4b8', '#b8381c', '#2a2a2c'][Math.floor(r() * 3)]!;
  partes.push(tira([px, v1 - 0.4, px + 0.2, v1 - 0.9, px + 0.45, v1 - 0.45, px + 0.7, v1 - 0.95, px + 0.9, v1 - 0.4], 0.07, cp, 1.25, { ...S, alfa: 0.85, detalhe: 2 }, 0.6));
  // A poeira no costado, que o vento juntou do lado −y.
  partes.push(poli(bolha(-1, v0 + 0.6, L * 0.4, 0.4, 16, 0.3, r), POEIRA, 1.27, { ...S, alfa: 0.25, detalhe: 2 }));
  // Os cacos no chão do lado das janelas e o mato que cresceu junto do chassi.
  cacos(partes, r, -0.5, v0 - 0.25, L * 0.42, 0.15, 24, 0.02);
  for (let k = 0; k < 10; k++) { const x = (r() - 0.5) * L * 0.9, y = v1 + 0.22; for (let j = 0; j < 4; j++) { const a = -Math.PI / 2 + (r() - 0.5) * 1.6; partes.push(tira([x, y, x + Math.cos(a) * 0.25, y + Math.sin(a) * 0.12 + 0.12], 0.025, ['#5a5a2a', '#7a6a3a', '#4a5228'][j % 3]!, 0.3, { ...O, detalhe: 3 }, 0.2)); } }
  return partes;
}

// ---------- Defesas (Q22a) ----------

/** Chapa ondulada no referencial `k` (u ao longo das ondas), largura `w` e altura `h`: as ondas em listras de luz e sombra, a ferrugem e os furos dos pregos. */
function chapaOndulada(partes: Parte[], r: () => number, k: Quadro, w: number, h: number, t: Tons, z: number, enferrujada = 0.6): void {
  partes.push(poli(retQ(k, 0.015, 0.02, w + 0.04, h + 0.04), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(k, 0, 0, w, h), t.base, z + 0.002, { ...O, detalhe: 1 }));
  for (let u = -w / 2 + 0.04; u < w / 2 - 0.02; u += 0.08) {
    partes.push(tira(em(k, [u, -h / 2 + 0.01, u, h / 2 - 0.01]), 0.022, t.luz, z + 0.003, { ...O, alfa: 0.8, detalhe: 3 }));
    partes.push(tira(em(k, [u + 0.04, -h / 2 + 0.01, u + 0.04, h / 2 - 0.01]), 0.02, t.sombra, z + 0.003, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  if (enferrujada > 0) ferrugem(partes, r, k, 0, 0, w, h, z + 0.004, Math.round(4 + w * h * 10 * enferrujada), 0.6);
  for (const su of [-1, 1]) for (const sv of [-1, 1]) partes.push(elipse(...k(su * (w / 2 - 0.05), sv * (h / 2 - 0.05)), 0.03, 0.03, t.nanquim, z + 0.006, { ...O, detalhe: 3 }));
}

/** Tábua ou ripa de (ax, ay) a (bx, by): o nanquim, a madeira e o veio claro. */
function tabua(partes: Parte[], ax: number, ay: number, bx: number, by: number, w: number, t: Tons, z: number, ponta = 1): void {
  partes.push(tira([ax, ay, bx, by], w + 0.025, t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, ponta));
  partes.push(tira([ax, ay, bx, by], w, t.base, z + 0.002, { ...O, detalhe: 1 }, ponta));
  const nx = -(by - ay), ny = bx - ax, l = Math.hypot(nx, ny) || 1, o = (w * 0.22) * (nx * LUZ_X + ny * LUZ_Y >= 0 ? 1 : -1);
  partes.push(tira([ax + (nx / l) * o, ay + (ny / l) * o, bx + (nx / l) * o, by + (ny / l) * o], w * 0.3, t.luz, z + 0.004, { ...S, alfa: 0.8, detalhe: 2 }, ponta));
}

/**
 * Barricada de sucata ao longo de u (comprimento `C`, frente para +y): por trás, tambores e pneus; no meio, chapas onduladas em pé e deitadas,
 * paletes, uma porta de carro e tábuas; na frente, estacas de ponta viradas para fora; uma placa de trânsito torta espetada.
 */
function barricada(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], D = 1.5;
  sombraNoChao(partes, retR(ID, 0, 0, C + 0.1, D - 0.2, 0.3), 0.01, '#0a0a0c', 0.6);
  partes.push(poli(bolha(0, 0, C / 2 + 0.05, D / 2 - 0.15, Math.max(14, Math.round(C * 5)), 0.15, r), '#2a241c', 0.02, { ...S, alfa: 0.8, detalhe: 1 }));
  // Atrás (−y): tambores em pé e pneus.
  for (let u = -C / 2 + 0.35; u < C / 2 - 0.3; u += 0.7 + r() * 0.5) {
    if (r() < 0.55) { const tt = r() < 0.5 ? FERRUGEM : desbotada(['#2a4a6a', '#6a2a1a', '#3a5a2a'][Math.floor(r() * 3)]!, 0.4); disco(partes, u, -0.45, 0.29, tt, 0.85); partes.push(tira(anel(u, -0.45, 0.22, 0.22, 16), 0.025, tt.nanquim, 0.87, { ...O, alfa: 0.7, detalhe: 3 }), elipse(u + 0.1, -0.4, 0.07, 0.07, '#0a0a0a', 0.871, { ...O, detalhe: 3 })); ferrugem(partes, r, quadro(u, -0.45), 0, 0, 0.5, 0.5, 0.872, 3, 0.5); }
    else for (let k = 0; k < 2; k++) partes.push(...pneuDeitado(u + (r() - 0.5) * 0.1, -0.45 + (r() - 0.5) * 0.08, 0.3, 0.3 + k * 0.25));
  }
  // O meio: chapas onduladas, paletes, uma porta de carro e tábuas cruzadas, em ordem de cima a baixo.
  const pecas: (() => void)[] = [];
  for (let u = -C / 2 + 0.5; u < C / 2 - 0.4; u += 0.6 + r() * 0.5) {
    const g = (r() - 0.5) * 0.7, y = (r() - 0.5) * 0.25, z = 0.6 + r() * 0.5, tipo = r();
    if (tipo < 0.45) pecas.push(() => chapaOndulada(partes, r, quadro(u, y, g), 1.0 + r() * 0.5, 0.5 + r() * 0.2, r() < 0.4 ? desbotada('#7a8288', 0.2) : r() < 0.5 ? desbotada('#3a6a4a', 0.4) : FERRUGEM, z, 0.6));
    else if (tipo < 0.7) pecas.push(() => { const k = quadro(u, y, g), w = 1.1, h = 0.7; for (let i = 0; i < 4; i++) { const v = -h / 2 + 0.09 + i * ((h - 0.18) / 3); tabua(partes, ...k(-w / 2, v), ...k(w / 2, v), 0.12, MADEIRA, z + i * 0.004); } for (const su of [-1, 0, 1]) partes.push(tira(em(k, [su * (w / 2 - 0.06), -h / 2, su * (w / 2 - 0.06), h / 2]), 0.08, MADEIRA.sombra, z - 0.01, { ...O, detalhe: 2 })); });
    else if (tipo < 0.85) pecas.push(() => { const k = quadro(u, y, g), tt = desbotada(CORES_DE_CARRO[Math.floor(r() * CORES_DE_CARRO.length)]!, 0.45); partes.push(poli(retR(k, 0.015, 0.02, 1.1, 0.55, 0.1), tt.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retR(k, 0, 0, 1.06, 0.52, 0.1), tt.base, z + 0.002, { ...O, detalhe: 1 })); vidroQuebrado(partes, r, retQ(k, 0.12, -0.08, 0.6, 0.22), z + 0.004); ferrugem(partes, r, k, 0, 0, 1.0, 0.5, z + 0.006, 6, 0.7); partes.push(poli(retQ(k, -0.3, 0.15, 0.14, 0.04), '#1a1a1a', z + 0.008, { ...O, detalhe: 3 })); });
    else pecas.push(() => { for (let i = 0; i < 2; i++) { const a = g + (i ? 0.6 : -0.6); tabua(partes, u - Math.cos(a) * 0.6, y - Math.sin(a) * 0.6, u + Math.cos(a) * 0.6, y + Math.sin(a) * 0.6, 0.13, MADEIRA, z + 0.1 + i * 0.01); } });
  }
  pecas.forEach(p => p());
  // A frente (+y): as estacas apontadas para fora.
  for (let u = -C / 2 + 0.25; u < C / 2 - 0.2; u += 0.45 + r() * 0.2) {
    const a = Math.PI / 2 + (r() - 0.5) * 0.5, l = 0.55 + r() * 0.2, x0 = u, y0 = 0.2;
    tabua(partes, x0, y0, x0 + Math.cos(a) * l, y0 + Math.sin(a) * l, 0.07, MADEIRA, 0.45 + r() * 0.1, 0.15);
  }
  // A placa torta espetada na barricada.
  if (C >= 3) {
    const u = (r() - 0.5) * (C - 2), cor = r() < 0.5 ? '#a82a1e' : '#c8a01a';
    partes.push(tira([u, 0.0, u + 0.15, -0.3], 0.05, ACO.sombra, 1.3, { contorno: 'leve', detalhe: 2 }));
    disco(partes, u + 0.15, -0.3, 0.26, desbotada(cor, 0.35), 1.4, 0.24);
    partes.push(tira(anel(u + 0.15, -0.3, 0.22, 0.2, 18), 0.03, '#d8d4c8', 1.41, { ...O, alfa: 0.7, detalhe: 3 }));
    ferrugem(partes, r, quadro(u + 0.15, -0.3), 0, 0, 0.4, 0.4, 1.412, 4, 0.6);
    for (let k = 0; k < 3; k++) partes.push(elipse(u + 0.05 + r() * 0.2, -0.4 + r() * 0.2, 0.03, 0.03, '#0a0a0a', 1.415, { ...O, detalhe: 3 }));
  }
  return partes;
}

/** Saco de areia em (u, v) do referencial `k`, deitado ao longo de u: a aniagem estufada, as dobras das pontas amarradas e a costura. */
function sacoDeAreia(partes: Parte[], r: () => number, k: Quadro, u: number, v: number, w: number, h: number, t: Tons, z: number): void {
  const g = (r() - 0.5) * 0.12, [x, y] = k(u, v), q = quadro(x, y, Math.atan2(k(1, 0)[1] - k(0, 0)[1], k(1, 0)[0] - k(0, 0)[0]) + g);
  const forma = (du: number, dv: number, sw: number, sh: number): number[] => { const p: number[] = []; for (let i = 0; i < 20; i++) { const a = (i / 20) * 6.28, c = Math.cos(a), s = Math.sin(a), e = 0.88 + 0.12 * Math.abs(s); p.push(...q(du + Math.sign(c) * Math.pow(Math.abs(c), 0.55) * sw / 2 * e, dv + Math.sign(s) * Math.pow(Math.abs(s), 0.7) * sh / 2)); } return p; };
  partes.push(poli(forma(0.012, 0.016, w + 0.04, h + 0.04), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(forma(0, 0, w, h), t.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(forma(LUZ_X * 0.02, LUZ_Y * 0.02, w * 0.84, h * 0.72), t.meio, z + 0.005, { ...S, detalhe: 1 }));
  partes.push(poli(forma(LUZ_X * 0.05, LUZ_Y * 0.05, w * 0.5, h * 0.34), t.luz, z + 0.007, { ...S, alfa: 0.75, detalhe: 2 }));
  // As pontas: a dobra amarrada (−u) e a costura (+u).
  partes.push(tira(em(q, [-w / 2 + 0.08, -h * 0.3, -w / 2 + 0.03, 0, -w / 2 + 0.08, h * 0.3]), 0.02, t.nanquim, z + 0.008, { ...O, alfa: 0.6, detalhe: 3 }));
  partes.push(tira(em(q, [w / 2 - 0.07, -h * 0.32, w / 2 - 0.07, h * 0.32]), 0.015, t.sombra, z + 0.008, { ...O, alfa: 0.7, detalhe: 3 }));
  if (r() < 0.4) partes.push(tira(em(q, [-w * 0.2, -h * 0.1 + (r() - 0.5) * 0.05, w * 0.15, h * 0.05]), 0.012, t.sombra, z + 0.009, { ...O, alfa: 0.5, detalhe: 3 }, 0.4));
}

/** Muro de sacos de areia ao longo de u (`C` m): duas fiadas de baixo, lado a lado, e a de cima desencontrada; um ou outro saco rasgado, com a areia escorrida. */
function sacosDeAreia(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], w = 0.62, h = 0.36, n = Math.max(1, Math.round(C / (w - 0.04)));
  const passo = C / n, cores = [SACO, SACO, tonsDe('#6e6a48'), tonsDe('#8a7a58')];
  sombraNoChao(partes, retR(ID, 0, 0, C + 0.1, 0.85, 0.15), 0.01, '#0a0a0c', 0.55);
  for (const v of [-0.2, 0.2]) for (let i = 0; i < n; i++) sacoDeAreia(partes, r, ID, -C / 2 + passo * (i + 0.5) + (r() - 0.5) * 0.03, v + (r() - 0.5) * 0.03, w, h, cores[Math.floor(r() * cores.length)]!, 0.3 + (v > 0 ? 0.01 : 0) + i * 0.0001);
  for (let i = 0; i < n - 1 || (n === 1 && i < 1); i++) {
    const u = n === 1 ? 0 : -C / 2 + passo * (i + 1);
    sacoDeAreia(partes, r, ID, u + (r() - 0.5) * 0.04, (r() - 0.5) * 0.06, w, h + 0.04, cores[Math.floor(r() * cores.length)]!, 0.62 + i * 0.0001);
  }
  // Os rasgos: a boca escura e o monte de areia que escorreu para a frente.
  for (let i = 0; i < Math.max(1, Math.round(C / 3)); i++) if (r() < 0.6) {
    const u = (r() - 0.5) * (C - 0.6), s = r() < 0.5 ? -1 : 1;
    partes.push(poli(bolha(u, s * 0.38, 0.22, 0.08, 9, 0.3, r), '#a8946a', 0.05, { ...S, detalhe: 2 }), poli(bolha(u, s * 0.36, 0.14, 0.05, 7, 0.3, r), '#c0ac80', 0.052, { ...S, alfa: 0.8, detalhe: 3 }));
    partes.push(poli(bolha(u, s * 0.27, 0.06, 0.03, 6, 0.3, r), SACO.nanquim, 0.4, { ...O, detalhe: 3 }));
  }
  return partes;
}

/** Cerca de arame farpado ao longo de u (`C` m): os mourões de ferro em L, os três fios com as farpas e, opcional, a serpentina de concertina na frente (+y). */
function cercaDeArame(seed: number, C: number, serpentina: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], n = Math.max(1, Math.round(C / 2.5)), passo = C / n, ARAME = '#6e6a64';
  sombraNoChao(partes, retQ(ID, 0, 0.02, C, 0.08), 0.01, '#0a0a0c', 0.3);
  // Os fios: um pouco desencontrados de cima, para se ler a cerca, com a barriga entre os mourões.
  for (const [dv, z] of [[-0.05, 0.6], [0, 1.0], [0.05, 1.4]] as const) {
    for (let i = 0; i < n; i++) {
      const u0 = -C / 2 + passo * i, u1 = u0 + passo, m = (u0 + u1) / 2, b = 0.03 + r() * 0.04;
      const pts = [u0, dv, m, dv + b, u1, dv];
      partes.push(tira(pts, 0.03, '#141210', z, { contorno: false, semSombra: false, detalhe: 2 }));
      partes.push(tira(pts, 0.018, ARAME, z + 0.002, { ...O, detalhe: 2 }));
      for (let u = u0 + 0.12; u < u1 - 0.05; u += 0.16) {
        const t = (u - u0) / passo, v = dv + b * 4 * t * (1 - t);
        partes.push(tira([u - 0.035, v - 0.035, u + 0.035, v + 0.035], 0.014, ARAME, z + 0.003, { ...O, detalhe: 3 }), tira([u - 0.035, v + 0.035, u + 0.035, v - 0.035], 0.014, ARAME, z + 0.003, { ...O, detalhe: 3 }));
      }
    }
  }
  // Os mourões: o ferro em L enferrujado, de pé.
  for (let i = 0; i <= n; i++) {
    const u = -C / 2 + passo * i;
    partes.push(poli([u - 0.05, -0.05, u + 0.06, -0.05, u + 0.06, -0.02, u - 0.02, -0.02, u - 0.02, 0.06, u - 0.05, 0.06], FERRUGEM.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
    partes.push(poli([u - 0.04, -0.04, u + 0.05, -0.04, u + 0.05, -0.025, u - 0.025, -0.025, u - 0.025, 0.05, u - 0.04, 0.05], FERRUGEM.luz, 1.452, { ...O, detalhe: 2 }));
  }
  // A concertina: os laços de lâmina, que de cima se veem como argolas encadeadas.
  if (serpentina) for (let u = -C / 2 + 0.25; u < C / 2 - 0.2; u += 0.17) {
    const y = 0.32 + (r() - 0.5) * 0.03, g = (r() - 0.5) * 0.15;
    partes.push(tira(arco(u, y, 0.2, 0.3, g, g + 6.28, 18), 0.03, '#141210', 0.3, { contorno: false, detalhe: 2 }));
    partes.push(tira(arco(u, y, 0.2, 0.3, g, g + 6.28, 18), 0.016, '#9a9a96', 0.302, { ...O, detalhe: 2 }));
    partes.push(tira(arco(u, y, 0.2, 0.3, Math.PI * 1.05, Math.PI * 1.5, 6), 0.012, '#d8d8d2', 0.304, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  return partes;
}

// ---------- Fogo e sucata (Q22a) ----------

/** Tonel com fogo: o tambor de 200 l enferrujado, com os furos do lado acesos no chão, a borda, as brasas, a lenha e o fogo que brilha; apagado, só cinza. */
function tonelComFogo(seed: number, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.3;
  if (aceso) {
    halo(partes, 0, 0, 0.42, '#6a2004', 0.35);
    // A luz que escapa pelos furos do tambor, em raios no chão.
    for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28 + r() * 0.4; partes.push(lente(Math.cos(a) * 0.4, Math.sin(a) * 0.4, a, 0.24, 0.1, '#8a3008', 0.012, { ...O, brilho: true, alfa: 0.55, desfoque: 0.05, detalhe: 2 })); }
  }
  sombraNoChao(partes, anel(0, 0, R + 0.04, R + 0.04, 16), 0.015, '#0a0a0c', 0.5);
  disco(partes, 0, 0, R, FERRUGEM, 0.85);
  // Os frisos do tambor e a borda de cima.
  partes.push(tira(anel(0, 0, R * 0.93, R * 0.93, 24), 0.03, FERRUGEM.brilho, 0.88, { ...O, alfa: 0.6, detalhe: 3 }));
  partes.push(tira(arco(0, 0, R * 0.96, R * 0.96, -0.3, Math.PI * 0.7, 12), 0.03, FERRUGEM.nanquim, 0.881, { ...O, alfa: 0.8, detalhe: 3 }));
  partes.push(elipse(0, 0, R * 1.72, R * 1.72, '#0e0806', 0.89, { ...O, detalhe: 1 }));
  ferrugem(partes, r, ID, 0, 0, R * 1.9, R * 1.9, 0.886, 5, 0.9);
  if (!aceso) {
    partes.push(poli(bolha(0, 0, R * 0.7, R * 0.7, 12, 0.2, r), '#4a4640', 0.9, { ...S, detalhe: 2 }), poli(bolha(0.02, 0.02, R * 0.45, R * 0.45, 10, 0.3, r), '#6a665e', 0.902, { ...S, alfa: 0.7, detalhe: 3 }));
    for (let k = 0; k < 3; k++) { const a = r() * 6.28; partes.push(tira([Math.cos(a) * 0.05, Math.sin(a) * 0.05, Math.cos(a) * 0.22, Math.sin(a) * 0.22], 0.05, '#1a1410', 0.91, { contorno: 'leve', detalhe: 3 })); }
    return partes;
  }
  // A lenha que sai pela boca, as brasas e o fogo.
  for (let k = 0; k < 3; k++) { const a = r() * 6.28, c = Math.cos(a), s = Math.sin(a); partes.push(tira([c * 0.08, s * 0.08, c * 0.36, s * 0.36], 0.06, '#1e160e', 0.95, { contorno: 'leve', detalhe: 2 }), elipse(c * 0.1, s * 0.1, 0.05, 0.05, '#c05010', 0.96, { ...O, brilho: true, detalhe: 3 })); }
  fogoQueBrilha(partes, r, R * 0.8, 1.0);
  return partes;
}
const luzDoTonel = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'aceso', 1) ? { raio: 6, cor: '#ff7a2a', intensidade: 1.1, preset: 'tonel', power: 'fire', flicker: 0.4 } : null);

/** Pneus empilhados: duas ou três pilhas de alturas diferentes (os de baixo escapam um pouco), um pneu deitado no chão e outro encostado; água de chuva no de cima. */
function pneusEmpilhados(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.33;
  const pilhas: [number, number, number][] = [[-0.5, -0.18, 3 + Math.floor(r() * 2)], [0.25, -0.3, 1 + Math.floor(r() * 3)], [-0.12, 0.42, 2 + Math.floor(r() * 2)]];
  if (r() < 0.35) pilhas.pop();
  sombraNoChao(partes, bolha(0, 0.05, 0.85, 0.7, 14, 0.2, r), 0.01, '#0a0a0c', 0.5);
  // Um pneu solto, deitado no chão ao lado das pilhas.
  partes.push(...pneuDeitado(0.62, 0.42, R * 0.95, 0.1));
  for (const [x, y, n] of pilhas) for (let i = 0; i < n; i++) {
    const dx = (r() - 0.5) * 0.06, dy = (r() - 0.5) * 0.06;
    partes.push(...pneuDeitado(x + dx, y + dy, R + (r() - 0.5) * 0.03, 0.12 + i * 0.22, i === n - 1 && r() < 0.45));
  }
  return partes;
}

/**
 * Torre de vigia de sucata (3 × 3 m, 5 m): as quatro pernas de cano que abrem para o chão, com o contraventamento, a plataforma de tábuas,
 * o parapeito de chapas remendadas (ferrugem, tinta e compensado), a lona amarrada que cobre metade, os sacos de areia, a cadeira e o
 * alçapão com a escada que desce pelo lado +y.
 */
function torreDeVigia(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], P = 1.15, B = 1.5;
  sombraNoChao(partes, retQ(ID, 0.05, 0.05, 2 * B + 0.1, 2 * B + 0.1), 0.01, '#0a0a0c', 0.35);
  // As pernas: do pé (B) até a quina da plataforma (P), e as diagonais entre os pés.
  for (const su of [-1, 1]) for (const sv of [-1, 1]) { disco(partes, su * B, sv * B, 0.12, CONCRETO, 0.05); cilindro(partes, su * B, sv * B, su * P, sv * P, 0.1, 0.09, FERRUGEM, 0.6); }
  for (const s of [-1, 1]) { cilindro(partes, -B + 0.1, s * (B - 0.05), B - 0.1, s * (P + 0.05), 0.05, 0.05, FERRUGEM, 0.3); cilindro(partes, s * (B - 0.05), -B + 0.1, s * (P + 0.05), B - 0.1, 0.05, 0.05, FERRUGEM, 0.3); }
  // A escada do lado +y: os dois banzos e os degraus, até o alçapão.
  const eu = 0.45;
  for (const s of [-1, 1]) cilindro(partes, eu + s * 0.22, B + 0.05, eu + s * 0.22, P - 0.1, 0.05, 0.05, ACO, 0.8);
  for (let v = P + 0.05; v < B; v += 0.14) partes.push(tira([eu - 0.22, v, eu + 0.22, v], 0.035, ACO.sombra, 0.82, { contorno: 'leve', detalhe: 2 }));
  // A plataforma de tábuas.
  partes.push(poli(retQ(ID, 0.02, 0.025, 2 * P + 0.06, 2 * P + 0.06), MADEIRA.nanquim, 1.25, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let i = 0; i < 9; i++) { const v = -P + (i + 0.5) * ((2 * P) / 9), tt = i % 3 === 1 ? tonsDe('#6a5a40') : MADEIRA; partes.push(poli(retQ(ID, (r() - 0.5) * 0.04, v, 2 * P - 0.02, (2 * P) / 9 - 0.03), tt.base, 1.252, { ...O, detalhe: 1 }), tira([-P + 0.05, v - 0.05, P - 0.05, v - 0.05], 0.03, tt.luz, 1.253, { ...S, alfa: 0.6, detalhe: 3 })); }
  // O alçapão aberto sobre a escada.
  partes.push(poli(retQ(ID, eu, P - 0.38, 0.55, 0.5), ESCURO, 1.256, { ...O, detalhe: 1 }), poli(retQ(ID, eu, P - 0.12, 0.42, 0.04), ACO.luz, 1.257, { ...O, detalhe: 3 }));
  // Os sacos de areia no canto −x −y, a cadeira e a lata.
  for (let i = 0; i < 3; i++) sacoDeAreia(partes, r, quadro(-P + 0.5, -P + 0.28), (i - 1) * 0.55, 0, 0.58, 0.32, SACO, 1.3 + i * 0.001);
  const cx = -0.2 + r() * 0.3, cy = 0.15;
  bloco(partes, quadro(cx, cy, r() * 0.6), 0.45, 0.42, desbotada('#2a5a8a', 0.5), 1.3, 0.04);
  partes.push(poli(retQ(quadro(cx, cy, 0), 0, 0.2, 0.42, 0.06), '#1a1a1c', 1.32, { ...O, detalhe: 3 }));
  disco(partes, P - 0.35, -P + 0.4, 0.07, ACO, 1.3);
  // O parapeito: chapas remendadas em volta, menos no vão do alçapão.
  const tons = [FERRUGEM, desbotada('#7a8288', 0.2), desbotada('#3a6a4a', 0.45), tonsDe('#9a8460')];
  const lados: [number, number, number, number, number][] = [[0, -P + 0.05, 2 * P, 0.1, 0], [0, P - 0.05, 2 * P, 0.1, 0], [-P + 0.05, 0, 0.1, 2 * P, 0], [P - 0.05, 0, 0.1, 2 * P, 0]];
  lados.forEach(([u, v, w, h], i) => {
    const longo = w > h, n = 3, L = longo ? w : h;
    for (let k = 0; k < n; k++) {
      const c = -L / 2 + (k + 0.5) * (L / n), pu = longo ? u + c : u, pv = longo ? v : v + c;
      if (i === 1 && Math.abs(pu - eu) < 0.4) continue;
      const tt = tons[Math.floor(r() * tons.length)]!, ww = longo ? L / n + 0.04 : w, hh = longo ? h : L / n + 0.04;
      partes.push(poli(retQ(ID, pu + 0.01, pv + 0.012, ww + 0.03, hh + 0.03), tt.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(ID, pu, pv, ww, hh), tomDaFace(tt, olhar([-Math.PI / 2, Math.PI / 2, Math.PI, 0][i]!)), 1.452, { ...O, detalhe: 1 }));
      if (tt === FERRUGEM || r() < 0.4) ferrugem(partes, r, quadro(pu, pv), 0, 0, ww, hh, 1.454, 2, 0.5);
    }
  });
  // A lona amarrada sobre a metade +x: a lona que cede entre as cordas, com as dobras, e as cordas até as quinas.
  const lona = tonsDe(['#3a5a6a', '#5a5a3a', '#6a4a2a'][Math.floor(r() * 3)]!), lx0 = -0.05, lx1 = P + 0.12;
  const pts = [lx0, -P - 0.12, lx1, -P - 0.08, lx1 + 0.04, P + 0.1, lx0 + 0.05, P + 0.12, lx0 + 0.12, 0];
  partes.push(poli(pts.map((p, i) => p + (i % 2 ? 0.02 : 0.015)), lona.nanquim, 1.48, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(pts, lona.base, 1.482, { ...O, detalhe: 1 }));
  partes.push(poli(bolha((lx0 + lx1) / 2, 0, (lx1 - lx0) * 0.38, P * 0.8, 12, 0.2, r), lona.sombra, 1.484, { ...S, alfa: 0.55, detalhe: 2 }));
  for (let k = 0; k < 4; k++) partes.push(lente(lx0 + 0.3 + r() * 0.6, -P + 0.3 + r() * (2 * P - 0.6), Math.PI / 2 + (r() - 0.5) * 0.6, 0.6, 0.05, k % 2 ? lona.luz : lona.sombra, 1.486, { ...S, alfa: 0.55, detalhe: 3 }));
  partes.push(tira([lx0 + 0.04, -P - 0.1, lx0 + 0.1, 0, lx0 + 0.06, P + 0.1], 0.05, lona.luz, 1.487, { ...O, alfa: 0.7, detalhe: 2 }));
  for (const [x, y] of [[lx1, -P - 0.08], [lx1 + 0.04, P + 0.1]] as const) partes.push(tira([x, y, x + 0.18, y + Math.sign(y) * 0.18], 0.02, '#c8b48a', 1.488, { ...O, detalhe: 3 }));
  return partes;
}

// ---------- Acampamento (Q22b) ----------

const PALETE: Tons = { nanquim: '#1a140c', sombra: '#5e4c32', base: '#86704c', meio: '#967f58', luz: '#ac9468', brilho: '#c8b288' };
const LONAS = ['#2c5a8c', '#56663a', '#9a5a26', '#8a8a80', '#3a6a6a'];
const CORDA = '#c8b48a', TERRA = '#3a2a1a', TERRA_CLARA = '#5a4430';

/** Palete deitado no referencial `k` (1,2 × 0,8 m, as tábuas ao longo de u): o vão escuro, as três travessas por baixo e as cinco tábuas de cima. */
function palete(partes: Parte[], r: () => number, k: Quadro, z: number, t: Tons = PALETE): void {
  partes.push(poli(retQ(k, 0.015, 0.02, 1.24, 0.84), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(k, 0, 0, 1.2, 0.8), '#17120c', z + 0.002, { ...O, detalhe: 1 }));
  for (const u of [-0.55, 0, 0.55]) partes.push(poli(retQ(k, u, 0, 0.1, 0.78), t.sombra, z + 0.003, { ...O, detalhe: 2 }));
  for (let i = 0; i < 5; i++) { const v = -0.33 + i * 0.165, g = (r() - 0.5) * 0.02; tabua(partes, ...k(-0.6, v + g), ...k(0.6, v - g), 0.12, r() < 0.25 ? tonsDe('#7a6648') : t, z + 0.006 + i * 0.0005); }
  for (const u of [-0.55, 0, 0.55]) for (let i = 0; i < 5; i++) partes.push(elipse(...k(u, -0.33 + i * 0.165), 0.02, 0.02, t.nanquim, z + 0.01, { ...O, alfa: 0.7, detalhe: 3 }));
}

/** Pedra de segurar lona, pequena e cinza, com a luz do noroeste. */
function pedrinha(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number): void {
  const forma = bolha(x, y, R, R * 0.8, 10, 0.18, r, r() * 6);
  partes.push(poli(forma.map((v, i) => v + (i % 2 ? 0.025 : 0.02)), '#141412', z, { contorno: 'leve', sombraLeve: true, detalhe: 2 }), poli(forma, '#5e5a54', z + 0.002, { ...O, detalhe: 2 }));
  partes.push(poli(bolha(x + LUZ_X * R * 0.3, y + LUZ_Y * R * 0.3, R * 0.5, R * 0.4, 8, 0.2, r), '#8a857c', z + 0.004, { ...S, alfa: 0.8, detalhe: 3 }));
}

/**
 * Barraca improvisada (frente para +x): a lona em duas águas sobre uma cumeeira de cano, a água do noroeste mais clara, as dobras que cedem
 * entre os apoios, um remendo de outra lona com fita, as cordas até as estacas e as pedras na barra; atrás (−x), um palete em pé fecha o fundo;
 * na frente, a aba dobrada mostra o escuro de dentro com o colchão, e um palete deitado serve de soleira.
 */
function barracaImprovisada(seed: number, cor: string): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = desbotada(cor, 0.3), u0 = -1.4, u1 = 1.0, E = 1.1;
  sombraNoChao(partes, retR(ID, -0.2, 0.05, 2.8, 2.5, 0.3), 0.01, '#0a0a0c', 0.6);
  // O chão batido em volta e a soleira de palete.
  partes.push(poli(bolha(0, 0, 1.9, 1.35, 18, 0.12, r), '#2e261c', 0.012, { ...S, alfa: 0.35, desfoque: 0.2, detalhe: 2 }));
  palete(partes, r, quadro(1.45, 0.25, Math.PI / 2 + (r() - 0.5) * 0.12), 0.05);
  // O escuro de dentro, que a aba aberta mostra, com o colchão e o saco de dormir.
  partes.push(poli([u1 + 0.02, 0.02, u1 + 0.05, E, u1 - 0.95, E, u1 - 0.9, 0.02], '#0e0c0a', 0.2, { ...O, detalhe: 1 }));
  estofado(partes, quadro(u1 - 0.5, 0.55, 0.05), 0.05, 0, 0, 1.1, 0.7, '#7a7464', 0.22, 0.12);
  partes.push(poli(retR(quadro(u1 - 0.45, 0.6, 0.1), 0, 0, 0.9, 0.5, 0.15), desbotada('#8a3a22', 0.3).base, 0.24, { ...S, detalhe: 2 }));
  // O palete em pé que fecha o fundo (−x): de cima, o topo das tábuas.
  for (let v = -E + 0.05; v < E - 0.05; v += 0.2) partes.push(poli(retQ(ID, u0 - 0.12, v + 0.09, 0.16, 0.14), PALETE.base, 0.6, { contorno: 'leve', detalhe: 2 }), tira([u0 - 0.18, v + 0.04, u0 - 0.18, v + 0.14], 0.02, PALETE.luz, 0.602, { ...O, alfa: 0.8, detalhe: 3 }));
  partes.push(tira([u0 - 0.12, -E, u0 - 0.12, E], 0.05, PALETE.nanquim, 0.59, { ...O, alfa: 0.8, detalhe: 2 }));
  // As duas águas: a do noroeste (−y) na luz, a de +y na sombra, com a barra ondulada; a água de +y tem a quina da frente aberta.
  const barra = (s: number, a: number, b: number): number[] => { const p: number[] = []; for (let i = 0; i <= 10; i++) { const u = b + (a - b) * (i / 10); p.push(u, s * (E + Math.sin(i * 1.7 + seed) * 0.04)); } return p; };
  const norte = [u0, 0, u1, 0, ...barra(-1, u0 - 0.05, u1 + 0.05)], sul = [u0, 0, u1, 0, u1 - 0.85, E, ...barra(1, u0 - 0.05, u1 - 0.9).slice(2)];
  for (const [pts, base, meio] of [[norte, t.meio, t.luz], [sul, t.sombra, t.base]] as const) {
    partes.push(poli(pts.map((v, i) => v + (i % 2 ? 0.03 : 0.025)), t.nanquim, 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(pts, base, 1.002, { ...O, detalhe: 1 }));
    const s = pts === norte ? -1 : 1;
    partes.push(poli(bolha((u0 + u1) / 2 - (s > 0 ? 0.35 : 0), s * E * 0.3, (u1 - u0) * (s > 0 ? 0.32 : 0.42), E * 0.26, 16, 0.15, r), meio, 1.004, { ...S, alfa: 0.5, desfoque: 0.25, detalhe: 2 }));
  }
  // As dobras que cedem entre os apoios e descem para a barra.
  for (const s of [-1, 1]) for (let u = u0 + 0.4; u < u1 - (s > 0 ? 0.9 : 0.1); u += 0.55) partes.push(lente(u + (r() - 0.5) * 0.15, s * 0.15, s * Math.PI / 2 + (r() - 0.5) * 0.3, E * 0.85, 0.2, s < 0 ? t.base : t.nanquim, 1.006, { ...S, alfa: 0.55, desfoque: 0.05, detalhe: 2 }));
  for (const s of [-1, 1]) for (let u = u0 + 0.65; u < u1 - (s > 0 ? 1.0 : 0.3); u += 0.55) partes.push(lente(u + (r() - 0.5) * 0.1, s * 0.2, s * Math.PI / 2 + (r() - 0.5) * 0.3, E * 0.6, 0.08, s < 0 ? t.brilho : t.base, 1.007, { ...S, alfa: 0.45, desfoque: 0.03, detalhe: 3 }));
  // O remendo de outra lona com a fita prateada em xis.
  const rm = quadro(-0.5 + r() * 0.6, -0.55, (r() - 0.5) * 0.3), tr = desbotada(LONAS[(LONAS.indexOf(cor) + 2) % LONAS.length]!, 0.35);
  partes.push(poli(retR(rm, 0.015, 0.02, 0.62, 0.42, 0.04), tr.nanquim, 1.01, { ...O, alfa: 0.6, detalhe: 2 }), poli(retR(rm, 0, 0, 0.6, 0.4, 0.04), tr.meio, 1.012, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(tira(em(rm, [-0.36, s * 0.26, 0.36, -s * 0.26]), 0.07, '#9a9c9e', 1.014, { ...O, alfa: 0.85, detalhe: 3 }));
  // A cumeeira: o cano com a luz, e as pontas que sobram.
  cilindro(partes, u0 - 0.2, 0, u1 + 0.15, 0, 0.07, 0.07, ACO, 1.05);
  partes.push(tira([u0, 0.0, u1, 0.0], 0.03, CORDA, 1.07, { ...O, alfa: 0.6, detalhe: 3 }));
  // A aba dobrada da frente, mostrando o avesso, e o nó.
  partes.push(poli([u1, 0.02, u1 - 0.85, E, u1 - 0.6, 0.45], t.nanquim, 1.08, { contorno: 'leve', sombraLeve: true, detalhe: 2 }), poli([u1 - 0.03, 0.06, u1 - 0.82, E - 0.04, u1 - 0.6, 0.48], tom(t.sombra, -0.2), 1.082, { ...O, detalhe: 2 }));
  partes.push(elipse(u1 - 0.6, 0.47, 0.07, 0.06, CORDA, 1.085, { ...O, detalhe: 3 }));
  // As cordas até as estacas e as pedras na barra.
  for (const [x, y, ex, ey] of [[u0 - 0.05, -E, u0 - 0.35, -E - 0.3], [u0 - 0.05, E, u0 - 0.35, E + 0.3], [u1 + 0.05, -E, u1 + 0.35, -E - 0.3]] as const) {
    partes.push(tira([x, y, ex, ey], 0.022, CORDA, 0.5, { contorno: 'leve', detalhe: 3 }), elipse(ex, ey, 0.07, 0.07, '#2a1e12', 0.08, { contorno: 'leve', detalhe: 3 }));
  }
  for (const s of [-1, 1]) for (let u = u0 + 0.3; u < u1 - (s > 0 ? 1.0 : 0); u += 0.65 + r() * 0.3) pedrinha(partes, r, u, s * (E + 0.04), 0.11 + r() * 0.05, 1.1);
  // Um balde e latas na frente.
  disco(partes, 1.55, -0.95, 0.17, desbotada('#2a4a7a', 0.4), 0.3);
  partes.push(elipse(1.55, -0.95, 0.24, 0.24, '#141210', 0.32, { ...O, detalhe: 2 }), tira(arco(1.55, -0.95, 0.19, 0.19, -2.4, -0.6, 8), 0.015, ACO.luz, 0.34, { ...O, detalhe: 3 }));
  for (let k = 0; k < 2; k++) disco(partes, 1.85 + k * 0.12, -0.6 + k * 0.1, 0.045, ACO, 0.1);
  return partes;
}

/** Colchão no chão (2 × 1 m, cabeceira em −u): sobre um papelão aberto, o colchão de listras manchado, o travesseiro, o cobertor amarfanhado e o que fica à mão. */
function colchaoNoChao(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], g = (r() - 0.5) * 0.08, k = quadro(0, 0, g);
  sombraNoChao(partes, retR(k, 0, 0, 2.1, 1.1, 0.1), 0.01, '#0a0a0c', 0.4);
  // O papelão: aberto, com o vinco, a ponta rasgada e a marca impressa.
  const pk = quadro(0.05, 0.05, -g * 2);
  partes.push(poli(retQ(pk, 0, 0, 2.2, 1.35), '#4a3a24', 0.02, { contorno: 'leve', detalhe: 1 }), poli(retQ(pk, -0.01, -0.01, 2.17, 1.32), '#8a6e46', 0.022, { ...O, detalhe: 1 }));
  partes.push(tira(em(pk, [-1.08, 0.02, 1.08, 0.02]), 0.02, '#6a5434', 0.024, { ...O, alfa: 0.7, detalhe: 3 }), poli(retQ(pk, 0.7, 0.5, 0.3, 0.12), '#3a2c1a', 0.024, { ...O, alfa: 0.4, detalhe: 3 }));
  partes.push(poli(em(pk, [1.1, -0.67, 0.85, -0.67, 1.1, -0.4]), '#2a241c', 0.025, { ...O, detalhe: 2 }));
  // O colchão de listras, com as manchas e os botões.
  estofado(partes, k, g, 0, 0, 1.9, 0.92, '#a8a294', 0.15, 0.1);
  for (let v = -0.38; v <= 0.38; v += 0.095) partes.push(tira(em(k, [-0.9, v, 0.9, v]), 0.025, '#5a6a7e', 0.162, { ...O, alfa: 0.3, detalhe: 3 }));
  for (let i = 0; i < 4; i++) { const [x, y] = k((r() - 0.5) * 1.5, (r() - 0.5) * 0.6), rx = 0.1 + r() * 0.15; partes.push(poli(bolha(x, y, rx * 1.2, rx, 12, 0.3, r), '#5a4a2a', 0.164, { ...S, alfa: 0.18, detalhe: 2 }), poli(bolha(x, y, rx, rx * 0.8, 12, 0.3, r), '#8a7a4a', 0.165, { ...S, alfa: 0.22, detalhe: 2 })); }
  for (const u of [-0.6, -0.2, 0.2, 0.6]) for (const v of [-0.22, 0.22]) partes.push(elipse(...k(u, v), 0.035, 0.035, '#4a4638', 0.166, { ...O, alfa: 0.6, detalhe: 3 }));
  // O travesseiro na cabeceira.
  estofado(partes, quadro(...k(-0.68, -0.05), g + 0.15), g + 0.15, 0, 0, 0.42, 0.62, '#b8b0a0', 0.2, 0.12);
  partes.push(lente(...k(-0.68, -0.1), g + 1.5, 0.35, 0.06, '#8a8272', 0.208, { ...S, alfa: 0.5, detalhe: 3 }));
  // O cobertor jogado sobre a metade dos pés, com as dobras e a beira virada.
  const cb = desbotada(['#4a5236', '#7a2a22', '#4e5258', '#6a4a2a'][Math.floor(r() * 4)]!, 0.2);
  const cp = em(k, [-0.15, -0.5, 0.25, -0.52, 0.98, -0.44, 1.0, 0.1, 0.92, 0.5, 0.3, 0.55, -0.25, 0.48, -0.05, 0.1]);
  partes.push(poli(cp.map((v, i) => v + (i % 2 ? 0.025 : 0.02)), cb.nanquim, 0.22, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(cp, cb.base, 0.222, { ...O, detalhe: 1 }));
  for (let i = 0; i < 5; i++) { const [x, y] = k(0.1 + r() * 0.7, (r() - 0.5) * 0.7); partes.push(lente(x, y, g + (r() - 0.5) * 1.2, 0.35 + r() * 0.25, 0.09, i % 2 ? cb.luz : cb.sombra, 0.224, { ...S, alfa: 0.6, detalhe: 2 })); }
  if (r() < 0.6) for (let v = -0.45; v < 0.5; v += 0.15) partes.push(tira(em(k, [-0.1 + v * 0.1, v, 0.95, v + 0.02]), 0.02, cb.sombra, 0.226, { ...O, alfa: 0.35, detalhe: 3 }));
  partes.push(tira(em(k, [-0.22, -0.48, -0.05, 0.1, -0.22, 0.46]), 0.08, cb.luz, 0.228, { ...O, detalhe: 2 }));
  // À mão: a garrafa e a lata do lado +y, e um livro sem capa.
  const [bx, by] = k(-0.4, 0.62);
  partes.push(lente(bx, by, g + 0.3, 0.3, 0.09, '#2a4a2e', 0.05, { contorno: 'leve', detalhe: 2 }), lente(bx + 0.03, by - 0.01, g + 0.3, 0.2, 0.025, '#8ab08a', 0.052, { ...O, alfa: 0.6, detalhe: 3 }));
  disco(partes, ...k(0.1, 0.66), 0.05, ACO, 0.05);
  bloco(partes, quadro(...k(0.55, 0.68), g - 0.4), 0.22, 0.16, tonsDe('#d0c4a4'), 0.04, 0.02);
  return partes;
}

/**
 * Gerador a diesel de quadro aberto (frente para +y): o quadro de cano, o tanque em cima com a tampa, o motor com as aletas e a partida
 * retrátil, o escapamento enferrujado, o painel com as tomadas e a luz-piloto, o cabo laranja que sai pelo chão, a mancha de óleo e o galão.
 * Ligado, a luz-piloto brilha e sai fumaça pelo escapamento.
 */
function geradorADiesel(seed: number, ligadoAgora: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.2, H = 0.75, tinta = desbotada(r() < 0.6 ? '#d8a018' : '#b83a1e', 0.25);
  sombraNoChao(partes, retR(ID, 0, 0, W + 0.1, H + 0.1, 0.08), 0.01, '#0a0a0c', 0.65);
  partes.push(poli(bolha(0.15, 0.2, 0.55, 0.35, 14, 0.3, r), '#0a0806', 0.012, { ...S, alfa: 0.45, desfoque: 0.08, detalhe: 2 }), lente(0.0, 0.25, 0.3, 0.3, 0.06, '#3a4a5a', 0.014, { ...S, alfa: 0.25, detalhe: 3 }));
  // O cabo: sai do painel (+y) e corre pelo chão até a borda.
  partes.push(tira([-0.3, H / 2, -0.25, H / 2 + 0.2, 0.1, H / 2 + 0.25, 0.4, H / 2 + 0.15, 0.75, H / 2 + 0.28, 0.95, H / 2 + 0.25], 0.045, '#3a1a08', 0.05, { contorno: 'leve', detalhe: 2 }));
  partes.push(tira([-0.3, H / 2, -0.25, H / 2 + 0.2, 0.1, H / 2 + 0.25, 0.4, H / 2 + 0.15, 0.75, H / 2 + 0.28, 0.95, H / 2 + 0.25], 0.03, '#c8641a', 0.052, { ...O, detalhe: 2 }));
  // O motor (metade −u) e o alternador (metade +u), por baixo do tanque.
  bloco(partes, quadro(-0.25, 0.05), 0.55, 0.55, GRAFITE, 0.3, 0.05);
  for (let v = -0.2; v <= 0.2; v += 0.06) partes.push(tira([-0.5, v, -0.36, v], 0.025, GRAFITE.luz, 0.31, { ...O, alfa: 0.7, detalhe: 3 }));
  disco(partes, -0.5, 0.15, 0.14, tonsDe('#3a3c40'), 0.32);
  partes.push(elipse(-0.5, 0.15, 0.08, 0.08, '#c83a1e', 0.335, { ...O, detalhe: 3 }));
  disco(partes, 0.32, 0.05, 0.22, tonsDe('#5a5e64'), 0.3, 0.2);
  for (let k = 0; k < 6; k++) partes.push(tira(em(quadro(0.32, 0.05), [-0.16, -0.12 + k * 0.05, 0.16, -0.12 + k * 0.05]), 0.015, '#1a1a1c', 0.32, { ...O, alfa: 0.6, detalhe: 3 }));
  // O escapamento: o abafador enferrujado de lado e o cano virado para fora.
  cilindro(partes, -0.6, -0.3, -0.25, -0.3, 0.14, 0.14, FERRUGEM, 0.65);
  partes.push(elipse(-0.66, -0.3, 0.07, 0.07, '#0a0806', 0.68, { ...O, detalhe: 3 }));
  // O quadro de cano.
  for (const pts of [[-W / 2, -H / 2, W / 2, -H / 2], [-W / 2, H / 2, W / 2, H / 2], [-W / 2, -H / 2, -W / 2, H / 2], [W / 2, -H / 2, W / 2, H / 2]]) cilindro(partes, pts[0]!, pts[1]!, pts[2]!, pts[3]!, 0.06, 0.06, GRAFITE, 0.8);
  for (const su of [-1, 1]) for (const sv of [-1, 1]) partes.push(elipse(su * W / 2, sv * H / 2, 0.1, 0.1, GRAFITE.meio, 0.83, { ...O, detalhe: 3 }));
  // O tanque em cima, com a tampa e o marcador.
  const tk = quadro(0.05, -0.08);
  partes.push(poli(retR(tk, 0.015, 0.02, 0.82, 0.5, 0.12), tinta.nanquim, 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retR(tk, 0, 0, 0.8, 0.48, 0.12), tinta.base, 0.902, { ...O, detalhe: 1 }));
  partes.push(poli(retR(tk, -0.02, -0.03, 0.7, 0.36, 0.1), tinta.meio, 0.904, { ...S, detalhe: 1 }), poli(retR(tk, -0.08, -0.08, 0.45, 0.14, 0.06), tinta.luz, 0.906, { ...S, alfa: 0.7, detalhe: 2 }));
  ferrugem(partes, r, tk, 0, 0, 0.78, 0.46, 0.908, 4, 0.8);
  disco(partes, ...tk(0.22, -0.05), 0.07, ACO, 0.92);
  partes.push(elipse(...tk(-0.22, 0.08), 0.1, 0.06, '#e8e4d8', 0.92, { ...O, detalhe: 3 }), elipse(...tk(-0.22, 0.08), 0.07, 0.035, '#1a1a1a', 0.921, { ...O, detalhe: 3 }));
  // O painel na frente (+y), com as tomadas e a luz-piloto.
  partes.push(poli(retQ(ID, -0.15, H / 2 - 0.08, 0.5, 0.12), '#2a2c30', 0.86, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, -0.15, H / 2 - 0.09, 0.46, 0.08), '#5a5e64', 0.862, { ...O, detalhe: 2 }));
  for (const u of [-0.32, -0.2, -0.08]) partes.push(elipse(u, H / 2 - 0.09, 0.07, 0.05, '#141416', 0.864, { ...O, detalhe: 3 }));
  partes.push(elipse(0.04, H / 2 - 0.09, 0.05, 0.05, ligadoAgora ? '#30d040' : '#1a3a1e', 0.866, { ...O, brilho: ligadoAgora, detalhe: 3 }));
  // O galão ao lado e a fumaça, se ligado.
  const gk = quadro(0.78, 0.45, 0.4 + (r() - 0.5) * 0.3), gt = desbotada('#a82a1e', 0.35);
  bloco(partes, gk, 0.36, 0.2, gt, 0.35, 0.03);
  partes.push(tira(em(gk, [-0.1, 0, 0.06, 0]), 0.04, gt.nanquim, 0.4, { ...O, detalhe: 3 }), elipse(...gk(0.14, -0.05), 0.06, 0.06, '#1a1a1a', 0.4, { ...O, detalhe: 3 }));
  if (ligadoAgora) for (let k = 0; k < 4; k++) partes.push(elipse(-0.75 - k * 0.12 + (r() - 0.5) * 0.05, -0.32 - k * 0.1, 0.16 + k * 0.08, 0.13 + k * 0.07, '#5a5a58', 1.3 + k * 0.01, { ...S, alfa: 0.22 - k * 0.04, desfoque: 0.06 + k * 0.03, detalhe: 2 }));
  return partes;
}

/**
 * Tanque de água: a caixa d'água de plástico azul sobre blocos (modelo 0), com os anéis, a tampa de rosca e a torneira com a mangueira, o
 * balde e a poça; ou o contêiner IBC (modelo 1), o tanque branco leitoso na gaiola de ferro sobre o palete, com o limo verde na água de dentro.
 */
function tanqueDeAgua(seed: number, modelo: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  // A poça e a mangueira (comuns aos dois), na frente (+y).
  partes.push(poli(bolha(0.25, 0.95, 0.45, 0.22, 14, 0.3, r), '#20282c', 0.012, { ...S, alfa: 0.75, detalhe: 2 }), lente(0.1, 0.9, 0.2, 0.4, 0.05, '#7a909a', 0.014, { ...S, alfa: 0.35, detalhe: 3 }));
  const espiral: number[] = []; for (let k = 0; k <= 40; k++) { const a = k * 0.42, R = 0.08 + k * 0.006; espiral.push(-0.55 + Math.cos(a) * R, 0.95 + Math.sin(a) * R * 0.8); }
  partes.push(tira(espiral, 0.045, '#0e2a12', 0.04, { contorno: 'leve', detalhe: 2 }), tira(espiral, 0.028, '#3a8a3e', 0.042, { ...O, detalhe: 2 }));
  if (modelo === 1) {
    const L = 1.2, W = 1.0;
    sombraNoChao(partes, retQ(ID, 0, 0, L + 0.1, W + 0.1), 0.01, '#0a0a0c', 0.7);
    palete(partes, r, quadro(0, 0.04), 0.05);
    // O tanque leitoso: a água escura por dentro, o limo e a luz no plástico.
    const tq = quadro(0, 0);
    partes.push(poli(retR(tq, 0.015, 0.02, L - 0.06, W - 0.1, 0.12), '#3a3a34', 0.6, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retR(tq, 0, 0, L - 0.08, W - 0.12, 0.12), '#c8c6b8', 0.602, { ...O, detalhe: 1 }));
    partes.push(poli(retR(tq, 0.04, 0.06, L - 0.3, W - 0.34, 0.1), '#8a9286', 0.604, { ...S, alfa: 0.55, desfoque: 0.06, detalhe: 2 }), poli(bolha(0.25, 0.15, 0.25, 0.18, 12, 0.3, r), '#4a6a3a', 0.606, { ...S, alfa: 0.35, desfoque: 0.05, detalhe: 2 }));
    partes.push(poli(retR(tq, -0.25, -0.22, 0.5, 0.18, 0.08), '#ecebe2', 0.608, { ...S, alfa: 0.6, detalhe: 2 }));
    disco(partes, 0, 0, 0.14, tonsDe('#8a8a84'), 0.62);
    // A gaiola: os tubos verticais e horizontais.
    for (let u = -L / 2 + 0.02; u <= L / 2; u += L / 6) partes.push(tira([u, -W / 2 + 0.03, u, W / 2 - 0.03], 0.05, ACO.nanquim, 0.9, { contorno: 'leve', detalhe: 2 }), tira([u - 0.01, -W / 2 + 0.03, u - 0.01, W / 2 - 0.03], 0.025, ACO.luz, 0.902, { ...O, detalhe: 3 }));
    for (const v of [-W / 2 + 0.03, W / 2 - 0.03]) partes.push(tira([-L / 2, v, L / 2, v], 0.06, ACO.nanquim, 0.91, { contorno: 'leve', detalhe: 2 }), tira([-L / 2, v - 0.01, L / 2, v - 0.01], 0.03, ACO.meio, 0.912, { ...O, detalhe: 3 }));
    for (const u of [-L / 2, L / 2]) partes.push(tira([u, -W / 2, u, W / 2], 0.06, ACO.sombra, 0.91, { contorno: 'leve', detalhe: 2 }));
    ferrugem(partes, r, ID, 0, 0, L, W, 0.92, 6, 0.9);
    // A válvula da frente.
    partes.push(poli(retQ(ID, 0, W / 2 + 0.08, 0.16, 0.12), '#2a2a2c', 0.4, { contorno: 'leve', detalhe: 2 }), elipse(0, W / 2 + 0.1, 0.1, 0.06, '#c8961a', 0.42, { ...O, detalhe: 3 }));
  } else {
    const R = 0.78, t = desbotada('#2a5c94', 0.2);
    sombraNoChao(partes, anel(0, 0, R + 0.06, R + 0.06, 24), 0.01, '#0a0a0c', 0.75);
    for (const [x, y] of [[-0.55, -0.55], [0.55, -0.55], [-0.55, 0.55], [0.55, 0.55]] as const) bloco(partes, quadro(x, y), 0.4, 0.2, CONCRETO, 0.1, 0.03);
    disco(partes, 0, 0, R, t, 1.0);
    for (const f of [0.86, 0.62]) partes.push(tira(anel(0, 0, R * f, R * f, 36), 0.035, t.sombra, 1.02, { ...O, alfa: 0.55, detalhe: 2 }), tira(arco(0, 0, R * f - 0.03, R * f - 0.03, Math.PI * 0.95, Math.PI * 1.55, 10), 0.02, t.brilho, 1.021, { ...O, alfa: 0.5, detalhe: 3 }));
    partes.push(poli(bolha(0.25, 0.3, 0.35, 0.25, 12, 0.3, r), POEIRA, 1.025, { ...S, alfa: 0.25, detalhe: 2 }));
    disco(partes, 0, 0, 0.3, tonsDe('#1e4676'), 1.03);
    for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.28; partes.push(tira([Math.cos(a) * 0.24, Math.sin(a) * 0.24, Math.cos(a) * 0.3, Math.sin(a) * 0.3], 0.025, '#10264a', 1.05, { ...O, alfa: 0.7, detalhe: 3 })); }
    // A calha de lona que leva a chuva: uma ponta de cano entrando pela tampa.
    if (r() < 0.6) { cilindro(partes, -0.1, -0.1, -0.75, -0.65, 0.07, 0.07, tonsDe('#d0ccc0'), 1.2); }
    // A torneira em +y.
    partes.push(poli(retQ(ID, 0, R + 0.06, 0.08, 0.14), ACO.nanquim, 0.4, { contorno: 'leve', detalhe: 2 }), elipse(0, R + 0.1, 0.12, 0.05, ACO.luz, 0.42, { ...O, detalhe: 3 }));
  }
  // O balde ao pé da torneira.
  disco(partes, 0.3, 0.95, 0.18, desbotada('#8a8a84', 0.2), 0.3);
  partes.push(elipse(0.3, 0.95, 0.26, 0.26, '#2a343a', 0.32, { ...O, detalhe: 2 }), lente(0.26, 0.9, -0.8, 0.12, 0.04, '#9ab0ba', 0.33, { ...S, alfa: 0.5, detalhe: 3 }), tira(arco(0.3, 0.95, 0.2, 0.2, 0.4, 2.6, 8), 0.015, ACO.luz, 0.34, { ...O, detalhe: 3 }));
  return partes;
}

const VERDES: TonsDeTufo[] = [
  { fundo: '#0e1a0c', base: '#2a4a1e', meio: '#3a6428', luz: '#5a8a36', brilho: '#8ab456' },
  { fundo: '#0c1814', base: '#2a4a40', meio: '#386052', luz: '#56806a', brilho: '#86a890' },
  { fundo: '#121a0a', base: '#3a5a1a', meio: '#4e7420', luz: '#74982e', brilho: '#a6c454' },
];

/** Roseta de folhas (alface, couve) em (x, y): as folhas de fora escuras, as de dentro claras, com a nervura. */
function roseta(partes: Parte[], r: () => number, x: number, y: number, R: number, t: TonsDeTufo, z: number): void {
  const n = 7 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + r() * 0.4, c = Math.cos(a) * LUZ_X + Math.sin(a) * LUZ_Y > 0.3 ? t.meio : t.base; partes.push(lente(x, y, a, R, R * 0.62, c, z, { contorno: 'leve', detalhe: 2 })); }
  for (let k = 0; k < 5; k++) { const a = (k / 5) * 6.28 + r(); partes.push(lente(x, y, a, R * 0.6, R * 0.45, k % 2 ? t.luz : t.meio, z + 0.004, { ...O, detalhe: 2 }), tira([x, y, x + Math.cos(a) * R * 0.5, y + Math.sin(a) * R * 0.5], 0.012, t.brilho, z + 0.006, { ...O, alfa: 0.5, detalhe: 3 })); }
  partes.push(elipse(x + LUZ_X * R * 0.05, y + LUZ_Y * R * 0.05, R * 0.45, R * 0.42, t.brilho, z + 0.008, { ...S, alfa: 0.8, detalhe: 3 }));
}

/**
 * Horta em pneus: quatro ou cinco pneus deitados (um ou dois empilhados, de canteiro mais alto, e um pintado), cheios de terra, com alface,
 * couve, um pé de tomate amarrado na estaca e mudas em fila; o regador ao lado.
 */
function hortaEmPneus(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.38;
  const lugares: [number, number, number][] = [[-0.8, -0.35, 1 + (r() < 0.5 ? 1 : 0)], [0.0, -0.4, 1], [0.8, -0.3, 2], [-0.4, 0.42, 1], [0.45, 0.45, 1]];
  if (r() < 0.3) lugares.pop();
  sombraNoChao(partes, bolha(0, 0.05, 1.3, 0.85, 16, 0.15, r), 0.01, '#0a0a0c', 0.4);
  partes.push(poli(bolha(0, 0.05, 1.35, 0.9, 18, 0.15, r), TERRA, 0.012, { ...S, alfa: 0.4, desfoque: 0.15, detalhe: 2 }));
  lugares.forEach(([x, y, n], i) => {
    for (let j = 0; j < n; j++) partes.push(...pneuDeitado(x, y, R, 0.1 + j * 0.22));
    const z = 0.1 + (n - 1) * 0.22 + 0.012, ri = R * 0.58;
    // A tinta (um pneu pintado de branco ou de cor, já descascando).
    if (i === 2 || r() < 0.2) { const c = ['#d8d4c8', '#c84a2a', '#e0b82a'][Math.floor(r() * 3)]!; partes.push(tira(anel(x, y, R * 0.8, R * 0.8, 28), R * 0.3, c, z - 0.004, { ...O, alfa: 0.7, detalhe: 2 })); for (let k = 0; k < 5; k++) { const a = r() * 6.28; partes.push(elipse(x + Math.cos(a) * R * 0.8, y + Math.sin(a) * R * 0.8, 0.06, 0.05, PNEU.base, z - 0.003, { ...O, detalhe: 3 })); } }
    // A terra, mais escura na borda e esfarelada.
    partes.push(elipse(x, y, ri * 2.2, ri * 2.2, '#22170c', z, { ...O, detalhe: 1 }), elipse(x + LUZ_X * 0.02, y + LUZ_Y * 0.02, ri * 1.9, ri * 1.9, TERRA, z + 0.001, { ...S, detalhe: 1 }));
    for (let k = 0; k < 8; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * ri * 0.85; partes.push(elipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.03, 0.025, TERRA_CLARA, z + 0.002, { ...O, alfa: 0.8, detalhe: 3 })); }
    // A planta.
    const tipo = (i + seed) % 4;
    if (tipo === 0) roseta(partes, r, x, y, R * 0.95, VERDES[0]!, z + 0.01);
    else if (tipo === 1) for (const [dx, dy] of [[-0.09, -0.08], [0.1, -0.05], [0, 0.1]] as const) roseta(partes, r, x + dx * 1.4, y + dy * 1.4, R * 0.55, VERDES[1]!, z + 0.01 + dy * 0.01);
    else if (tipo === 2) {
      // O tomateiro: a copa irregular, os tomates e a estaca amarrada.
      tufo(partes, r, x - 0.02, y + 0.02, R * 1.05, VERDES[2]!, z + 0.3, 10, 16, 10);
      for (let k = 0; k < 5; k++) { const a = r() * 6.28, d = R * (0.25 + r() * 0.55); partes.push(elipse(x + Math.cos(a) * d + 0.012, y + Math.sin(a) * d + 0.014, 0.1, 0.1, '#3a0a06', z + 0.34, { ...O, detalhe: 2 }), elipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.085, 0.085, k % 3 ? '#b8281a' : '#c8781a', z + 0.342, { ...O, detalhe: 2 }), elipse(x + Math.cos(a) * d - 0.015, y + Math.sin(a) * d - 0.015, 0.03, 0.03, '#f0b8a0', z + 0.344, { ...O, alfa: 0.7, detalhe: 3 })); }
      partes.push(elipse(x + 0.03, y - 0.04, 0.06, 0.06, MADEIRA.luz, z + 0.4, { contorno: 'leve', detalhe: 3 }));
    } else for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) {
      // Mudas em fila.
      const mx = x + k * ri * 0.6, my = y + j * ri * 0.55;
      for (let f = 0; f < 4; f++) partes.push(lente(mx, my, (f / 4) * 6.28 + r(), 0.1, 0.06, f % 2 ? VERDES[2]!.luz : VERDES[2]!.meio, z + 0.01, { ...O, detalhe: 3 }));
    }
  });
  // O regador.
  const rk = quadro(1.05, 0.55, -0.6 + (r() - 0.5) * 0.4), rt = desbotada('#3a6a3a', 0.35);
  bloco(partes, rk, 0.26, 0.2, rt, 0.25, 0.04);
  partes.push(tira(em(rk, [0.12, 0, 0.42, -0.06]), 0.035, rt.sombra, 0.3, { contorno: 'leve', detalhe: 3 }), elipse(...rk(0.43, -0.06), 0.06, 0.06, rt.luz, 0.31, { ...O, detalhe: 3 }), tira(em(rk, [-0.12, -0.08, -0.16, 0, -0.12, 0.08]), 0.025, rt.nanquim, 0.32, { ...O, detalhe: 3 }));
  return partes;
}

/**
 * Placa pichada: um compensado ou uma chapa pregada em dois paus, com o aviso a spray (caveira, seta ou xis, e garatujas que leem como letras
 * sem formar palavra), escorridos de tinta. Como no orelhão, a face aparece um pouco de frente, numa faixa em +y, porque de cima é só uma tábua.
 */
function placaPichada(seed: number, desenho: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.4, H = 0.62, cy = 0.12, chapa = r() < 0.5;
  const fundo = chapa ? desbotada('#8a8e90', 0.2) : tonsDe('#a08a62'), sp = r() < 0.6 ? '#b0201a' : '#1a1a1c', sp2 = sp === '#1a1a1c' ? '#c8c4b8' : '#1a1a1c';
  sombraNoChao(partes, retQ(ID, 0.1, 0.12, W, 0.35), 0.01, '#0a0a0c', 0.5);
  // Os paus, com a ponta enterrada.
  for (const s of [-1, 1]) { partes.push(elipse(s * 0.5, -0.12, 0.12, 0.1, '#2a1e12', 0.03, { ...O, detalhe: 3 })); tabua(partes, s * 0.5, -0.12, s * 0.5, cy + H / 2 - 0.05, 0.08, MADEIRA, 0.5); }
  // A face: nanquim, o compensado (veio) ou a chapa (ferrugem), os pregos.
  const k = quadro(0, cy, (r() - 0.5) * 0.06);
  partes.push(poli(retQ(k, 0.015, 0.02, W + 0.04, H + 0.04), fundo.nanquim, 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(k, 0, 0, W, H), fundo.base, 1.202, { ...O, detalhe: 1 }));
  partes.push(poli(retQ(k, -0.05, -0.06, W - 0.2, H * 0.5), fundo.meio, 1.203, { ...S, alfa: 0.6, detalhe: 2 }));
  if (chapa) ferrugem(partes, r, k, 0, 0, W, H, 1.204, 8, 0.8);
  else for (let v = -H / 2 + 0.06; v < H / 2; v += 0.09) partes.push(tira(em(k, [-W / 2 + 0.03, v + (r() - 0.5) * 0.02, W / 2 - 0.03, v + (r() - 0.5) * 0.02]), 0.012, fundo.sombra, 1.204, { ...O, alfa: 0.4, detalhe: 3 }, 0.3));
  for (const s of [-1, 1]) for (const v of [-0.2, 0.2]) partes.push(elipse(...k(s * 0.5, v), 0.03, 0.03, '#141414', 1.205, { ...O, detalhe: 3 }));
  const spray = (pts: number[], w: number, cor: string, z: number): void => { partes.push(tira(em(k, pts), w * 1.8, cor, z, { ...S, alfa: 0.25, detalhe: 2 }, 0.5), tira(em(k, pts), w, cor, z + 0.001, { ...O, alfa: 0.9, detalhe: 2 }, 0.6)); };
  const escorrer = (u: number, v: number, cor: string): void => { partes.push(tira(em(k, [u, v, u + (r() - 0.5) * 0.01, v + 0.06 + r() * 0.1]), 0.012, cor, 1.215, { ...O, alfa: 0.8, detalhe: 3 }, 0.3)); };
  // O símbolo à esquerda.
  const sx = -0.42;
  if (desenho === 0) {
    // Caveira: o crânio, os olhos, os dentes e os ossos cruzados.
    spray([sx - 0.2, 0.2, sx + 0.2, -0.05], 0.035, sp, 1.21); spray([sx - 0.2, -0.05, sx + 0.2, 0.2], 0.035, sp, 1.21);
    partes.push(poli(em(k, arco(sx, -0.04, 0.13, 0.12, 0, 6.28, 16)), sp, 1.212, { ...O, alfa: 0.92, detalhe: 2 }), poli(retQ(k, sx, 0.08, 0.13, 0.08), sp, 1.212, { ...O, alfa: 0.92, detalhe: 2 }));
    for (const s of [-1, 1]) partes.push(elipse(...k(sx + s * 0.05, -0.05), 0.06, 0.06, fundo.base, 1.214, { ...O, detalhe: 3 }));
    for (const s of [-0.04, 0, 0.04]) partes.push(tira(em(k, [sx + s, 0.05, sx + s, 0.11]), 0.012, fundo.base, 1.214, { ...O, detalhe: 3 }));
    escorrer(sx + 0.05, 0.12, sp);
  } else if (desenho === 1) {
    spray([sx - 0.18, 0, sx + 0.16, 0], 0.05, sp, 1.21); spray([sx + 0.05, -0.12, sx + 0.18, 0, sx + 0.05, 0.12], 0.05, sp, 1.21); escorrer(sx - 0.1, 0.03, sp);
  } else {
    spray([sx - 0.17, -0.2, sx + 0.17, 0.2], 0.06, sp, 1.21); spray([sx - 0.17, 0.2, sx + 0.17, -0.2], 0.06, sp, 1.21); escorrer(sx + 0.15, 0.22, sp); escorrer(sx - 0.14, 0.22, sp);
  }
  // As garatujas: duas linhas de traços que leem como letras.
  for (const [v, h] of [[-0.12, 0.13], [0.12, 0.09]] as const) {
    let u = -0.15;
    while (u < W / 2 - 0.12) {
      const w = h * (0.5 + r() * 0.4), f = Math.floor(r() * 5), pts = f === 0 ? [u, v + h / 2, u, v - h / 2, u + w, v - h / 2] : f === 1 ? [u, v + h / 2, u + w / 2, v - h / 2, u + w, v + h / 2] : f === 2 ? [u + w, v - h / 2, u, v - h / 2, u, v + h / 2, u + w, v + h / 2] : f === 3 ? [u, v + h / 2, u, v - h / 2, u + w, v + h / 2, u + w, v - h / 2] : [u, v - h / 2, u + w, v - h / 2, u + w / 2, v - h / 2, u + w / 2, v + h / 2];
      spray(pts, 0.022, v < 0 ? sp : sp2, 1.22);
      if (r() < 0.25) escorrer(u + w / 2, v + h / 2, v < 0 ? sp : sp2);
      u += w + 0.05;
    }
  }
  // A borda de cima da tábua (o que se vê de cima), na luz.
  partes.push(tira(em(k, [-W / 2, -H / 2, W / 2, -H / 2]), 0.035, fundo.brilho, 1.23, { ...O, alfa: 0.8, detalhe: 3 }));
  return partes;
}

/**
 * Caixa de suprimentos militar (frente para +y): madeira verde-oliva com o estêncil, as alças de corda e as cantoneiras; aberta, a tampa
 * encostada atrás e, dentro, latas, sacos de ração, garrafas d'água e um kit de primeiros socorros.
 */
function caixaDeSuprimentos(seed: number, aberta: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 0.9, W = 0.55, t = desbotada('#4a5230', 0.15), k = quadro(0, 0.08, (r() - 0.5) * 0.1);
  sombraNoChao(partes, retR(k, 0, 0, L + 0.06, W + 0.06, 0.04), 0.01, '#0a0a0c', 0.6);
  // A tampa encostada atrás (−y), ou fechada.
  const tampa = (kk: Quadro, z: number): void => {
    partes.push(poli(retQ(kk, 0.015, 0.02, L + 0.04, W + 0.04), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(kk, 0, 0, L, W), t.meio, z + 0.002, { ...O, detalhe: 1 }));
    for (let v = -W / 2 + W / 6; v < W / 2; v += W / 3) partes.push(tira(em(kk, [-L / 2 + 0.02, v, L / 2 - 0.02, v]), 0.012, t.sombra, z + 0.003, { ...O, alfa: 0.6, detalhe: 3 }));
    partes.push(poli(retQ(kk, -0.1, -0.08, L - 0.3, 0.1), t.luz, z + 0.004, { ...S, alfa: 0.4, detalhe: 2 }));
    // O estêncil: a estrela e as letras de código, em amarelo apagado.
    const est: number[] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * 6.28, d = i % 2 ? 0.035 : 0.085; est.push(-0.25 + Math.cos(a) * d, 0.02 + Math.sin(a) * d); }
    partes.push(poli(em(kk, est), '#c8b46a', z + 0.005, { ...O, alfa: 0.7, detalhe: 3 }));
    for (let i = 0; i < 5; i++) partes.push(poli(retQ(kk, -0.05 + i * 0.07, 0.02, 0.045, 0.08), '#c8b46a', z + 0.005, { ...O, alfa: 0.6, detalhe: 3 }), poli(retQ(kk, -0.05 + i * 0.07, 0.02, 0.02, 0.04), t.meio, z + 0.006, { ...O, detalhe: 3 }));
    for (const su of [-1, 1]) for (const sv of [-1, 1]) partes.push(poli(retQ(kk, su * (L / 2 - 0.04), sv * (W / 2 - 0.04), 0.08, 0.08), '#3a3c3a', z + 0.007, { ...O, detalhe: 3 }));
  };
  if (aberta) tampa(quadro(...k(0, -W / 2 - W / 2 - 0.03), (r() - 0.5) * 0.15), 0.1);
  // A caixa: o nanquim, as paredes em volume e o fundo.
  partes.push(poli(retQ(k, 0.015, 0.02, L + 0.04, W + 0.04), t.nanquim, 0.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(k, 0, 0, L, W), t.base, 0.402, { ...O, detalhe: 1 }));
  for (const s of [-1, 1]) { const [x, y] = k(s * (L / 2 + 0.04), 0); partes.push(tira(arco(x, y, 0.05, 0.08, s > 0 ? -1.5 : 1.6, s > 0 ? 1.5 : 4.7, 8), 0.025, CORDA, 0.41, { contorno: 'leve', detalhe: 3 })); }
  if (!aberta) { tampa(k, 0.55); return partes; }
  partes.push(poli(retQ(k, 0, 0, L - 0.08, W - 0.08), '#1a1c12', 0.404, { ...O, detalhe: 1 }), poli(retQ(k, 0.02, 0.02, L - 0.12, W - 0.12), '#2a2c1e', 0.405, { ...O, detalhe: 1 }));
  // Dentro: as latas, os sacos de ração, as garrafas e o kit.
  for (let i = 0; i < 4; i++) disco(partes, ...k(-0.32 + (i % 2) * 0.12, -0.1 + Math.floor(i / 2) * 0.13), 0.055, i === 3 ? tonsDe('#8a6a3a') : ACO, 0.42 + i * 0.001);
  for (let i = 0; i < 2; i++) { const kk = quadro(...k(-0.03 + i * 0.05, -0.05 + i * 0.12), (r() - 0.5) * 0.6); partes.push(poli(retR(kk, 0.01, 0.01, 0.26, 0.15, 0.03), '#2a2a18', 0.43 + i * 0.002, { contorno: 'leve', detalhe: 2 }), poli(retR(kk, 0, 0, 0.24, 0.13, 0.03), '#8a7a52', 0.431 + i * 0.002, { ...O, detalhe: 2 }), poli(retQ(kk, 0, 0, 0.12, 0.04), '#3a3a28', 0.432 + i * 0.002, { ...O, alfa: 0.6, detalhe: 3 })); }
  for (let i = 0; i < 3; i++) { const [x, y] = k(0.2 + i * 0.07, -0.08 + (i % 2) * 0.04); partes.push(lente(x, y + 0.12, -Math.PI / 2, 0.26, 0.07, '#3a5a6a', 0.44, { contorno: 'leve', detalhe: 2 }), lente(x - 0.015, y + 0.1, -Math.PI / 2, 0.18, 0.02, '#c8dce4', 0.442, { ...O, alfa: 0.6, detalhe: 3 }), elipse(x, y - 0.13, 0.04, 0.04, '#2a5a9a', 0.443, { ...O, detalhe: 3 })); }
  const kk = quadro(...k(0.33, 0.12), 0.1);
  partes.push(poli(retR(kk, 0, 0, 0.16, 0.12, 0.02), '#d8d4c8', 0.45, { contorno: 'leve', detalhe: 2 }), poli(retQ(kk, 0, 0, 0.08, 0.025), '#b82a1e', 0.452, { ...O, detalhe: 3 }), poli(retQ(kk, 0, 0, 0.025, 0.08), '#b82a1e', 0.452, { ...O, detalhe: 3 }));
  // As bordas de cima das paredes, na luz do noroeste.
  partes.push(tira(em(k, [-L / 2 + 0.02, W / 2 - 0.02, -L / 2 + 0.02, -W / 2 + 0.02, L / 2 - 0.02, -W / 2 + 0.02]), 0.03, t.luz, 0.47, { ...O, detalhe: 3 }));
  partes.push(tira(em(k, [L / 2 - 0.02, -W / 2 + 0.02, L / 2 - 0.02, W / 2 - 0.02, -L / 2 + 0.02, W / 2 - 0.02]), 0.03, t.sombra, 0.47, { ...O, detalhe: 3 }));
  return partes;
}

/** Fogareiro de roda: o aro de carro deitado sobre três tijolos, com a grelha, o fogo de gravetos por baixo e a panela amassada em cima, com o vapor. */
function fogareiro(seed: number, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.24;
  if (aceso) halo(partes, 0, 0, 0.42, '#7a2804', 0.5);
  sombraNoChao(partes, anel(0, 0, R + 0.05, R + 0.05, 16), 0.012, '#0a0a0c', 0.5);
  for (let k = 0; k < 3; k++) { const a = (k / 3) * 6.28 + 0.4; bloco(partes, quadro(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95, a), 0.12, 0.2, tonsDe('#8a3a22'), 0.08, 0.02); }
  // O aro: o anel de ferro com os furos dos parafusos, por onde o fogo aparece.
  partes.push(tira(anel(0, 0, R, R, 28), 0.09, ACO.nanquim, 0.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(anel(0, 0, R, R, 28), 0.065, desbotada('#6a6a6a', 0.3).base, 0.202, { ...O, detalhe: 1 }));
  partes.push(tira(arco(0, 0, R, R, Math.PI * 0.95, Math.PI * 1.6, 10), 0.03, ACO.luz, 0.204, { ...O, alfa: 0.7, detalhe: 3 }));
  ferrugem(partes, r, ID, 0, 0, R * 2.1, R * 2.1, 0.206, 4, 0.9);
  partes.push(elipse(0, 0, R * 1.7, R * 1.7, '#0e0806', 0.21, { ...O, detalhe: 1 }));
  if (aceso) fogoQueBrilha(partes, r, R * 0.82, 0.22);
  else partes.push(poli(bolha(0, 0, R * 0.6, R * 0.6, 10, 0.2, r), '#4a4640', 0.22, { ...S, detalhe: 2 }));
  // A grelha.
  for (let u = -R * 0.7; u <= R * 0.7; u += 0.07) partes.push(tira([u, -Math.sqrt(R * R * 0.8 - u * u), u, Math.sqrt(R * R * 0.8 - u * u)], 0.015, '#1a1a1c', 0.3, { contorno: 'leve', detalhe: 3 }));
  // A panela amassada, com o cabo, a água e o vapor.
  const px = 0.08, py = 0.07, P = 0.12;
  disco(partes, px, py, P, ACO, 0.35);
  partes.push(elipse(px, py, P * 1.7, P * 1.7, '#2a3034', 0.37, { ...O, detalhe: 2 }), elipse(px + 0.02, py + 0.02, P * 1.3, P * 1.3, '#3a4448', 0.372, { ...S, alfa: 0.7, detalhe: 2 }));
  partes.push(tira([px + P * 0.95, py, px + P + 0.18, py + 0.05], 0.035, '#1a1a1c', 0.36, { contorno: 'leve', detalhe: 3 }));
  if (aceso) for (let k = 0; k < 5; k++) { const a = r() * 6.28, d = r() * P * 0.6; partes.push(elipse(px + Math.cos(a) * d, py + Math.sin(a) * d, 0.035, 0.035, '#8aa0aa', 0.374, { ...O, alfa: 0.6, detalhe: 3 })); }
  if (aceso) for (let k = 0; k < 3; k++) partes.push(elipse(px - 0.05 - k * 0.07, py - 0.06 - k * 0.08, 0.16 + k * 0.07, 0.12 + k * 0.06, '#c8ccd0', 0.5 + k * 0.01, { ...S, alfa: 0.18 - k * 0.04, desfoque: 0.05 + k * 0.02, detalhe: 2 }));
  // A lenha de reserva.
  for (let k = 0; k < 3; k++) partes.push(tira([0.3 + k * 0.03, 0.25 + k * 0.05, 0.05 + k * 0.03, 0.38 + k * 0.05], 0.04, '#3a2a1a', 0.05 + k * 0.01, { contorno: 'leve', detalhe: 3 }));
  return partes;
}
const luzDoFogareiro = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'aceso', 1) ? { raio: 3.5, cor: '#ff8a3a', intensidade: 0.8, preset: 'fogueira', power: 'fire', flicker: 0.35 } : null);

// ---------- Receitas ----------

const PA = { generos: ['pos-apocaliptico'], kit: 'pos-apocaliptico' };
const NOMES_DOS_MODELOS = ['sedan', 'hatch', 'picape', 'van'] as const;
const modeloDe = (params: Record<string, unknown>): Modelo => MODELOS[NOMES_DOS_MODELOS[Math.round(num({ seed: 0, params }, 'modelo', 0, 0, 3))]!];
const pegadaDaCarcaca = (m: Modelo): [number, number] => [m.L + 0.4, m.W + 0.5];

export const RECEITAS_POS_APOCALIPTICAS: Receita[] = [
  { id: 'carro.enferrujado', nome: 'Carcaça de carro', categoria: 'exterior', tipo: 'piso', ...PA, funcoes: ['rua', 'estacionamento', 'garagem', 'estrada', 'acampamento', 'oficina-de-sucata'], tags: ['carro', 'carcaca', 'enferrujado', 'ferrugem', 'abandonado', 'sucata', 'ruina', 'veiculo', 'pos-apocaliptico'],
    pegada: pegadaDaCarcaca(MODELOS.sedan), altura: 1.4,
    campos: [{ id: 'modelo', rotulo: 'Modelo (0 sedã, 1 hatch, 2 picape, 3 van)', tipo: 'numero', padrao: 0, min: 0, max: 3, passo: 1 }, { id: 'cor', rotulo: 'Cor (−1 sorteada; 0 vermelho, 1 azul, 2 prata, 3 branco, 4 preto, 5 verde, 6 amarelo, 7 grafite)', tipo: 'numero', padrao: -1, min: -1, max: 7, passo: 1 }],
    gerar: p => { const m = modeloDe(p.params), i = Math.round(num(p, 'cor', -1, -1, 7)), r = mulberry32(p.seed ^ 0x5eed); return piso(pegadaDaCarcaca(m), carcaca(p.seed, m, CORES_DE_CARRO[i >= 0 ? i : Math.floor(r() * CORES_DE_CARRO.length)]!)); } },
  { id: 'onibus-tombado', nome: 'Ônibus tombado', categoria: 'exterior', tipo: 'piso', ...PA, funcoes: ['rua', 'estrada', 'acampamento'], tags: ['onibus', 'tombado', 'carcaca', 'enferrujado', 'abandonado', 'sucata', 'ruina', 'barricada', 'veiculo', 'pos-apocaliptico'],
    pegada: [12.4, 3.8], altura: 2.6, gerar: p => piso([12.4, 3.8], onibusTombado(p.seed)) },
  { id: 'barricada', nome: 'Barricada de sucata', categoria: 'exterior', tipo: 'piso', ...PA, funcoes: ['rua', 'estrada', 'acampamento', 'posto-de-guarda', 'abrigo'], tags: ['barricada', 'sucata', 'chapa', 'estacas', 'pneus', 'tambor', 'defesa', 'bloqueio', 'muro', 'pos-apocaliptico'],
    pegada: [4, 1.5], altura: 1.5,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4, min: 2, max: 12, passo: 0.5 }],
    gerar: p => { const C = num(p, 'comprimento', 4, 2, 12); return piso([C, 1.5], barricada(p.seed, C)); } },
  { id: 'sacos-de-areia', nome: 'Sacos de areia', categoria: 'exterior', tipo: 'piso', generos: ['pos-apocaliptico', 'moderno'], kit: 'pos-apocaliptico', funcoes: ['rua', 'estrada', 'acampamento', 'posto-de-guarda', 'abrigo', 'trincheira'], tags: ['sacos', 'areia', 'trincheira', 'muro', 'defesa', 'militar', 'barricada', 'pos-apocaliptico'],
    pegada: [3, 0.9], altura: 0.8,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 3, min: 0.6, max: 12, passo: 0.3 }],
    gerar: p => { const C = num(p, 'comprimento', 3, 0.6, 12); return piso([C, 0.9], sacosDeAreia(p.seed, C)); } },
  { id: 'cerca-de-arame-farpado', nome: 'Cerca de arame farpado', categoria: 'exterior', tipo: 'piso', generos: ['pos-apocaliptico', 'moderno'], kit: 'pos-apocaliptico', funcoes: ['estrada', 'acampamento', 'posto-de-guarda', 'abrigo', 'campo'], tags: ['cerca', 'arame', 'farpado', 'concertina', 'mourao', 'defesa', 'pos-apocaliptico'],
    pegada: [6, 0.8], altura: 1.5,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 6, min: 2, max: 20, passo: 0.5 }, { id: 'serpentina', rotulo: 'Concertina (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => { const C = num(p, 'comprimento', 6, 2, 20); return piso([C, 0.8], cercaDeArame(p.seed, C, ligado(p.params, 'serpentina', 1))); } },
  { id: 'tonel-com-fogo', nome: 'Tonel com fogo', categoria: 'lareira-e-luz', tipo: 'piso', ...PA, funcoes: ['rua', 'acampamento', 'abrigo', 'posto-de-guarda', 'oficina-de-sucata'], tags: ['tonel', 'tambor', 'fogo', 'barril', 'brasa', 'aquecer', 'acampamento', 'luz', 'brilho', 'pos-apocaliptico'],
    pegada: [1.1, 1.1], altura: 0.95,
    campos: [{ id: 'aceso', rotulo: 'Aceso (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDoTonel, gerar: p => piso([1.1, 1.1], tonelComFogo(p.seed, ligado(p.params, 'aceso', 1))) },
  { id: 'pneus-empilhados', nome: 'Pneus empilhados', categoria: 'exterior', tipo: 'piso', generos: ['pos-apocaliptico', 'moderno'], kit: 'pos-apocaliptico', funcoes: ['garagem', 'oficina-de-sucata', 'acampamento', 'posto', 'rua'], tags: ['pneus', 'pneu', 'borracha', 'pilha', 'sucata', 'borracharia', 'garagem', 'pos-apocaliptico'],
    pegada: [1.8, 1.5], altura: 1.0, gerar: p => piso([1.8, 1.5], pneusEmpilhados(p.seed)) },
  { id: 'torre-de-vigia', nome: 'Torre de vigia de sucata', categoria: 'exterior', tipo: 'piso', ...PA, funcoes: ['acampamento', 'posto-de-guarda', 'estrada'], tags: ['torre', 'vigia', 'sentinela', 'plataforma', 'sucata', 'lona', 'defesa', 'pos-apocaliptico'],
    pegada: [3.2, 3.2], altura: 5, gerar: p => piso([3.2, 3.2], torreDeVigia(p.seed)) },
  { id: 'barraca-improvisada', nome: 'Barraca improvisada', categoria: 'exterior', tipo: 'piso', ...PA, funcoes: ['acampamento', 'abrigo', 'estrada'], tags: ['barraca', 'lona', 'palete', 'abrigo', 'tenda', 'acampamento', 'improvisado', 'pos-apocaliptico'],
    pegada: [4, 3], altura: 1.6,
    campos: [{ id: 'lona', rotulo: 'Lona (−1 sorteada; 0 azul, 1 oliva, 2 laranja, 3 cinza, 4 verde-água)', tipo: 'numero', padrao: -1, min: -1, max: 4, passo: 1 }],
    gerar: p => { const i = Math.round(num(p, 'lona', -1, -1, 4)), r = mulberry32(p.seed ^ 0x10a); return piso([4, 3], barracaImprovisada(p.seed, LONAS[i >= 0 ? i : Math.floor(r() * LONAS.length)]!)); } },
  { id: 'colchao-no-chao', nome: 'Colchão no chão', categoria: 'camas', tipo: 'piso', ...PA, funcoes: ['acampamento', 'abrigo', 'enfermaria-improvisada', 'quarto'], tags: ['colchao', 'cama', 'papelao', 'cobertor', 'dormir', 'abrigo', 'acampamento', 'pos-apocaliptico'],
    pegada: [2.3, 1.5], altura: 0.25, gerar: p => piso([2.3, 1.5], colchaoNoChao(p.seed)) },
  { id: 'gerador-a-diesel', nome: 'Gerador a diesel', categoria: 'exterior', tipo: 'piso', generos: ['pos-apocaliptico', 'moderno'], kit: 'pos-apocaliptico', funcoes: ['acampamento', 'abrigo', 'oficina-de-sucata', 'posto-de-guarda', 'garagem', 'obra'], tags: ['gerador', 'diesel', 'motor', 'energia', 'eletricidade', 'cabo', 'galao', 'acampamento', 'pos-apocaliptico'],
    pegada: [2, 1.3], altura: 1.0,
    campos: [{ id: 'ligado', rotulo: 'Ligado (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => piso([2, 1.3], geradorADiesel(p.seed, ligado(p.params, 'ligado', 1))) },
  { id: 'tanque-de-agua', nome: 'Tanque de água', categoria: 'exterior', tipo: 'piso', generos: ['pos-apocaliptico', 'moderno'], kit: 'pos-apocaliptico', funcoes: ['acampamento', 'abrigo', 'quintal', 'oficina-de-sucata'], tags: ['tanque', 'agua', 'caixa-dagua', 'ibc', 'cisterna', 'chuva', 'balde', 'mangueira', 'acampamento', 'pos-apocaliptico'],
    pegada: [1.9, 2.3], altura: 1.4,
    campos: [{ id: 'modelo', rotulo: "Modelo (0 caixa d'água de plástico, 1 contêiner IBC)", tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => piso([1.9, 2.3], tanqueDeAgua(p.seed, Math.round(num(p, 'modelo', 0, 0, 1)))) },
  { id: 'horta-em-pneus', nome: 'Horta em pneus', categoria: 'exterior', tipo: 'piso', ...PA, funcoes: ['acampamento', 'abrigo', 'quintal', 'horta'], tags: ['horta', 'pneus', 'canteiro', 'alface', 'couve', 'tomate', 'planta', 'cultivo', 'acampamento', 'pos-apocaliptico'],
    pegada: [2.8, 1.9], altura: 0.9, gerar: p => piso([2.8, 1.9], hortaEmPneus(p.seed)) },
  { id: 'placa-pichada', nome: 'Placa pichada', categoria: 'exterior', tipo: 'piso', ...PA, funcoes: ['acampamento', 'estrada', 'posto-de-guarda', 'abrigo', 'rua'], tags: ['placa', 'aviso', 'pichacao', 'spray', 'caveira', 'perigo', 'sinal', 'acampamento', 'pos-apocaliptico'],
    pegada: [1.6, 0.9], altura: 1.6,
    campos: [{ id: 'desenho', rotulo: 'Desenho (0 caveira, 1 seta, 2 xis)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => piso([1.6, 0.9], placaPichada(p.seed, Math.round(num(p, 'desenho', 0, 0, 2)))) },
  { id: 'caixa-de-suprimentos', nome: 'Caixa de suprimentos', categoria: 'armazenamento', tipo: 'piso', ...PA, funcoes: ['acampamento', 'abrigo', 'enfermaria-improvisada', 'posto-de-guarda', 'deposito'], tags: ['caixa', 'suprimentos', 'militar', 'racao', 'latas', 'agua', 'kit', 'saque', 'acampamento', 'pos-apocaliptico'],
    pegada: [1.0, 1.3], altura: 0.5,
    campos: [{ id: 'aberta', rotulo: 'Aberta (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => piso([1.0, 1.3], caixaDeSuprimentos(p.seed, ligado(p.params, 'aberta', 1))) },
  { id: 'fogareiro', nome: 'Fogareiro de roda', categoria: 'lareira-e-luz', tipo: 'piso', ...PA, funcoes: ['acampamento', 'abrigo', 'cozinha', 'posto-de-guarda'], tags: ['fogareiro', 'fogo', 'panela', 'cozinhar', 'aro', 'roda', 'grelha', 'brasa', 'acampamento', 'luz', 'brilho', 'pos-apocaliptico'],
    pegada: [0.9, 0.9], altura: 0.45,
    campos: [{ id: 'aceso', rotulo: 'Aceso (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDoFogareiro, gerar: p => piso([0.9, 0.9], fogareiro(p.seed, ligado(p.params, 'aceso', 1))) },
];
