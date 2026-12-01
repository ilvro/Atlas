import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, piso, type LuzDeReceita, type Receita } from './comum.ts';
import {
  ID, LATAO, O, OURO, PRATA, S, anel, arco, bloco, cilindro, disco, em, estofado, quadro, retQ, retR,
  type Quadro, type Tons,
} from './formas.ts';

// Colonial e pirata (Q19): navio e tesouro (Q19a), colônia e praia (Q19b). Carvalho de navio gasto pelo sal, ferro preto de canhão,
// carreta pintada de zarcão, lona crua, corda de cânhamo, ouro. As regras do acervo: nanquim por baixo da silhueta, volume em degraus
// de tom para o noroeste, `z` das partes até 1,5 m e a `altura` real na receita (a sombra do sol estica o desenho inteiro).

const CARVALHO: Tons = { nanquim: '#1a120a', sombra: '#3e2e1e', base: '#5a442c', meio: '#6c5436', luz: '#846a46', brilho: '#a88c62' };
const ESCURO: Tons = { nanquim: '#100a06', sombra: '#2a1a10', base: '#3e2818', meio: '#4c3220', luz: '#60422a', brilho: '#86644a' };
const FERRO: Tons = { nanquim: '#060606', sombra: '#1a1c20', base: '#2a2d33', meio: '#363a41', luz: '#50555e', brilho: '#8a909a' };
const ZARCAO: Tons = { nanquim: '#1e0806', sombra: '#4e1a10', base: '#6e2a1a', meio: '#823420', luz: '#9a442a', brilho: '#c06a4a' };
const CORDA = '#b8a478', LONA = '#ddd4ba', PERGAMINHO = '#d8c08a', TINTA = '#2a1a10', SANGUE = '#9a1e14';
const tonsDe = (cor: string): Tons => ({ nanquim: tom(cor, -0.78), sombra: tom(cor, -0.42), base: cor, meio: tom(cor, 0.1), luz: tom(cor, 0.24), brilho: tom(cor, 0.5) });

/** Corda: o fio escuro por baixo e o cânhamo por cima, com a torção marcada. */
function corda(partes: Parte[], pts: number[], w: number, z: number, cor = CORDA): void {
  partes.push(tira(pts, w + 0.012, tom(cor, -0.7), z, { contorno: false, semSombra: true, detalhe: 2 }), tira(pts, w, cor, z + 0.001, { ...O, detalhe: 2 }));
}

/** Rolo de corda no chão: as voltas concêntricas e a ponta solta. */
function rolo(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number): void {
  partes.push(elipse(x + 0.02, y + 0.025, R * 2.1, R * 2.1, '#0d0a08', z, { ...S, alfa: 0.35, detalhe: 2 }));
  for (let k = 0; k < 4; k++) { const rr = R * (1 - k * 0.22); partes.push(tira(anel(x, y, rr, rr, 18), R * 0.22, tom(CORDA, -0.6), z + 0.002 + k * 0.002, { ...O, detalhe: 2 }), tira(anel(x, y, rr, rr, 18), R * 0.15, tom(CORDA, (r() - 0.5) * 0.1), z + 0.003 + k * 0.002, { ...O, detalhe: 2 })); }
  const a = r() * 6.28; corda(partes, [x + Math.cos(a) * R, y + Math.sin(a) * R, x + Math.cos(a + 0.3) * R * 1.6, y + Math.sin(a + 0.3) * R * 1.6, x + Math.cos(a + 0.1) * R * 2.1, y + Math.sin(a + 0.1) * R * 2.1], R * 0.14, z + 0.012);
}

/** Moeda vista de cima: a borda escura, a face e o brilho; `prata` troca o metal. */
function moeda(partes: Parte[], r: () => number, x: number, y: number, z: number, prata = false): void {
  const t = prata ? PRATA : OURO, R = 0.028 + r() * 0.01;
  partes.push(elipse(x + 0.004, y + 0.005, R * 2 + 0.01, R * 2 + 0.01, t.nanquim, z, { contorno: false, semSombra: true, detalhe: 2 }), elipse(x, y, R * 2, R * 2, r() < 0.5 ? t.meio : t.luz, z + 0.001, { ...O, detalhe: 2 }));
  partes.push(tira(anel(x, y, R * 0.7, R * 0.7, 10), 0.004, t.sombra, z + 0.002, { ...O, alfa: 0.6, detalhe: 3 }), elipse(x + LUZ_X * R * 0.4, y + LUZ_Y * R * 0.4, R * 0.6, R * 0.4, t.brilho, z + 0.003, { ...S, alfa: 0.8, detalhe: 3 }));
}

const GEMAS = ['#b0142a', '#1a8a4a', '#1e4ab0', '#7a2aa0', '#e0e8f0'];
/** Pedra preciosa lapidada: a forma de losango, a faceta clara e o brilho. */
function gema(partes: Parte[], x: number, y: number, R: number, cor: string, z: number, ang = 0): void {
  const f = quadro(x, y, ang);
  partes.push(poli(em(f, [-R * 1.1, 0, 0, -R * 1.1, R * 1.1, 0, 0, R * 1.1]), tom(cor, -0.7), z, { contorno: false, semSombra: true, detalhe: 2 }), poli(em(f, [-R, 0, 0, -R, R, 0, 0, R]), cor, z + 0.001, { ...O, vidro: true, detalhe: 2 }));
  partes.push(poli(em(f, [-R * 0.7, 0, 0, -R * 0.7, 0, 0]), tom(cor, 0.4), z + 0.002, { ...O, detalhe: 3 }), elipse(...f(-R * 0.3, -R * 0.3), R * 0.4, R * 0.3, '#ffffff', z + 0.003, { ...S, alfa: 0.7, detalhe: 3 }));
}

/** Cálice de ouro visto de cima: a boca com o vinho ou vazia, a borda e o brilho. */
function calice(partes: Parte[], x: number, y: number, z: number, tombado = 0): void {
  if (tombado) {
    const a = tombado; partes.push(lente(x - Math.cos(a) * 0.1, y - Math.sin(a) * 0.1, a, 0.24, 0.1, OURO.nanquim, z, { contorno: 'leve', detalhe: 2 }), lente(x - Math.cos(a) * 0.09, y - Math.sin(a) * 0.09, a, 0.21, 0.07, OURO.luz, z + 0.002, { ...O, detalhe: 3 }));
    partes.push(elipse(x + Math.cos(a) * 0.12, y + Math.sin(a) * 0.12, 0.07, 0.11, OURO.meio, z + 0.004, { contorno: 'leve', detalhe: 2 }), elipse(x + Math.cos(a) * 0.125, y + Math.sin(a) * 0.125, 0.04, 0.07, OURO.nanquim, z + 0.005, { ...O, detalhe: 3 }));
    return;
  }
  disco(partes, x, y, 0.065, OURO, z); partes.push(elipse(x, y, 0.09, 0.09, OURO.nanquim, z + 0.015, { ...O, detalhe: 3 }), elipse(x, y, 0.07, 0.07, '#4a0a12', z + 0.016, { ...O, detalhe: 3 }));
}

// ---------- Navio e tesouro (Q19a) ----------

/** Canhão na carreta, apontado para +y: as duas gualdras de zarcão em degraus, os eixos e as quatro rodinhas, o cano de ferro com os reforços, a culatra e o botão, a cunha de pontaria, os munhões e as cavilhas. */
function canhao(partes: Parte[], f: Quadro, C: number, rodas = true): void {
  const y0 = -C * 0.48, y1 = C * 0.52, cw = 0.15;
  // As gualdras (laterais da carreta), em dois degraus.
  for (const s of [-1, 1]) { bloco(partes, quadro(...f(s * 0.32, -0.15), 0), cw, C * 0.62, ZARCAO, 0.55, 0.03); bloco(partes, quadro(...f(s * 0.32, -C * 0.28), 0), cw, C * 0.2, ZARCAO, 0.4, 0.03); }
  // Os eixos e as rodas.
  for (const v of [C * 0.12, -C * 0.36]) {
    partes.push(poli(retQ(f, 0, v, 0.92, 0.12), ESCURO.nanquim, 0.3, { contorno: 'leve', detalhe: 1 }), poli(retQ(f, 0, v - 0.01, 0.88, 0.08), ESCURO.base, 0.303, { ...O, detalhe: 2 }));
    if (rodas) for (const s of [-1, 1]) { bloco(partes, quadro(...f(s * 0.5, v)), 0.12, 0.34, CARVALHO, 0.32, 0.025); partes.push(elipse(...f(s * 0.57, v), 0.05, 0.05, FERRO.luz, 0.36, { contorno: 'leve', detalhe: 3 })); }
  }
  // A cunha de pontaria, atrás, entre as gualdras.
  bloco(partes, quadro(...f(0, y0 + 0.2)), 0.3, 0.26, CARVALHO, 0.6, 0.03);
  partes.push(ret(...f(0, y0 + 0.08), 0.06, 0.12, CARVALHO.luz, 0.64, { contorno: 'leve', detalhe: 3 }));
  // O cano, do botão da culatra à boca, mais grosso atrás, com os reforços.
  const [ax, ay] = f(0, y0 + 0.1), [bx, by] = f(0, y1);
  cilindro(partes, ax, ay, bx, by, 0.36, 0.24, FERRO, 0.9);
  for (const [t, w] of [[0.12, 0.4], [0.36, 0.34], [0.72, 0.29], [0.97, 0.32]] as const) {
    const [cx, cy] = f(0, y0 + 0.1 + (y1 - y0 - 0.1) * t); const [ux, uy] = f(w / 2, y0 + 0.1 + (y1 - y0 - 0.1) * t), [vx, vy] = f(-w / 2, y0 + 0.1 + (y1 - y0 - 0.1) * t);
    partes.push(tira([vx, vy, cx, cy, ux, uy], 0.05, FERRO.nanquim, 0.915, { ...O, detalhe: 2 }), tira([vx, vy, cx, cy, ux, uy], 0.022, FERRO.luz, 0.916, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  const [bcx, bcy] = f(0, y0 - 0.02); disco(partes, bcx, bcy, 0.08, FERRO, 0.92);
  partes.push(elipse(...f(0, y1 - 0.02), 0.13, 0.13, '#050505', 0.93, { ...O, detalhe: 3 }));
  // O ouvido com a escorva e os munhões sobre as gualdras, com as braçadeiras.
  partes.push(elipse(...f(0, y0 + 0.32), 0.05, 0.05, '#0a0806', 0.92, { ...O, detalhe: 3 }), elipse(...f(0, y0 + 0.32), 0.09, 0.09, '#3a3428', 0.919, { ...S, alfa: 0.5, detalhe: 3 }));
  for (const s of [-1, 1]) { partes.push(poli(retQ(f, s * 0.31, -0.02, 0.2, 0.12), FERRO.nanquim, 0.95, { contorno: 'leve', detalhe: 2 }), poli(retQ(f, s * 0.31, -0.03, 0.17, 0.08), FERRO.luz, 0.953, { ...O, detalhe: 3 })); }
  for (const s of [-1, 1]) for (const v of [-0.3, C * 0.15]) partes.push(elipse(...f(s * 0.32, v), 0.04, 0.04, FERRO.brilho, 0.6, { contorno: 'leve', detalhe: 3 }));
}

/** Canhão naval: o canhão na carreta de rodinhas, a retranca (o cabo grosso que passa pelo botão e vai às argolas da amurada, na frente), as talhas, o soquete e a escova deitados ao lado e três balas. */
function canhaoNaval(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], C = 2.2;
  sombraNoChao(partes, [-0.62, -1.15, 0.62, -1.15, 0.62, 1.1, -0.62, 1.1], 0.01, '#0d0a08', 0.4);
  // A retranca, das argolas da amurada (+y) ao botão da culatra, por fora das gualdras.
  const ret0: number[] = [-0.72, 1.18, -0.6, 0.6, -0.48, -0.5, -0.26, -1.08, 0, -1.18, 0.26, -1.08, 0.48, -0.5, 0.6, 0.6, 0.72, 1.18];
  corda(partes, ret0, 0.06, 0.62);
  for (const s of [-1, 1]) partes.push(tira(anel(s * 0.72, 1.2, 0.06, 0.06, 12), 0.025, FERRO.luz, 0.2, { contorno: 'leve', detalhe: 3 }));
  // As talhas, das gualdras para os lados da portinhola.
  for (const s of [-1, 1]) { corda(partes, [s * 0.4, 0.3, s * 0.62, 0.75, s * 0.78, 1.0], 0.022, 0.45); partes.push(ret(s * 0.62, 0.75, 0.1, 0.14, CARVALHO.base, 0.47, { contorno: 'leve', detalhe: 3 })); }
  canhao(partes, ID, C);
  // O soquete e a escova, deitados à direita; as balas à esquerda.
  const ra = r() * 0.1;
  partes.push(tira(em(quadro(0.72, -0.05, Math.PI / 2 + ra), [-1.0, 0, 0.9, 0]), 0.035, CARVALHO.luz, 0.06, { contorno: 'leve', detalhe: 2 }));
  cilindro(partes, ...quadro(0.72, -0.05, Math.PI / 2 + ra)(0.9, 0), ...quadro(0.72, -0.05, Math.PI / 2 + ra)(1.12, 0), 0.14, 0.14, tonsDe('#3a3028'), 0.08);
  for (const [x, y] of [[-0.74, -0.85], [-0.6, -0.95], [-0.68, -0.72]] as const) { disco(partes, x, y, 0.07, FERRO, 0.1); }
  return partes;
}

/** Timão: as duas colunas e o tambor com o cabo do leme enrolado (−y), o eixo e a roda de oito raios com as malaguetas, vista um pouco de frente. */
function timao(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.6, cy = 0.12, ry = R * 0.42, rot = r() * 0.4;
  sombraNoChao(partes, [-0.8, -0.5, 0.8, -0.5, 0.8, 0.45, -0.8, 0.45], 0.01, '#0d0a08', 0.35);
  // O cabo do leme que desce do tambor para o convés, nos dois lados.
  for (const s of [-1, 1]) corda(partes, [s * 0.46, -0.28, s * 0.62, -0.42, s * 0.78, -0.48], 0.028, 0.4);
  for (const s of [-1, 1]) bloco(partes, quadro(s * 0.5, -0.28), 0.16, 0.18, ESCURO, 1.0, 0.03);
  cilindro(partes, -0.44, -0.28, 0.44, -0.28, 0.22, 0.22, CARVALHO, 1.05);
  for (let u = -0.36; u <= 0.36; u += 0.06) partes.push(tira([u, -0.38, u + 0.02, -0.18], 0.022, tom(CORDA, -0.1), 1.07, { ...O, alfa: 0.85, detalhe: 3 }));
  cilindro(partes, 0, -0.2, 0, cy, 0.07, 0.07, FERRO, 1.1, 0);
  // A roda: os raios que passam do aro e viram malaguetas, o aro duplo e o cubo de latão.
  for (let k = 0; k < 8; k++) {
    const a = rot + (k / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    partes.push(tira([c * 0.08, cy + s * 0.08 * 0.42, c * R, cy + s * ry], 0.035, ESCURO.nanquim, 1.2, { contorno: false, semSombra: true, detalhe: 2 }), tira([c * 0.08, cy + s * 0.08 * 0.42, c * R, cy + s * ry], 0.02, CARVALHO.luz, 1.202, { ...O, detalhe: 3 }));
    const p0: [number, number] = [c * R * 1.04, cy + s * ry * 1.04], p1: [number, number] = [c * R * 1.32, cy + s * ry * 1.32], ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    partes.push(lente(...p0, ang, len, 0.06, ESCURO.nanquim, 1.21, { contorno: 'leve', detalhe: 2 }), lente(p0[0] + LUZ_X * 0.005, p0[1] + LUZ_Y * 0.005, ang, len * 0.9, 0.035, CARVALHO.luz, 1.212, { ...O, detalhe: 3 }));
  }
  for (const [k, w, t] of [[1, 0.08, CARVALHO], [0.5, 0.05, CARVALHO]] as const) {
    partes.push(tira(anel(0, cy, R * k, ry * k, 40), w + 0.025, t.nanquim, 1.22, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(anel(0, cy, R * k, ry * k, 40), w, t.meio, 1.223, { ...O, detalhe: 2 }));
    partes.push(tira(arco(0, cy, R * k, ry * k, Math.PI * 1.0, Math.PI * 1.65, 12), w * 0.35, t.brilho, 1.225, { ...S, alfa: 0.7, detalhe: 3 }));
  }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; partes.push(elipse(Math.cos(a) * R, cy + Math.sin(a) * ry, 0.022, 0.022, LATAO.luz, 1.227, { ...O, detalhe: 3 })); }
  disco(partes, 0, cy, 0.09, LATAO, 1.24, 0.06);
  return partes;
}

/** Base do mastro: o mastro com as braçadeiras de ferro e o capote de lona no convés, a malagueteira em volta com as cavilhas e os rolos de corda, e as enxárcias que descem para os lados até as bigotas nas mesas de enxárcia, com os enfrechates. */
function mastro(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], X = 1.5, vs = [-0.5, -0.17, 0.17, 0.5];
  sombraNoChao(partes, bolha(0, 0, 0.7, 0.7, 14, 0.05, r), 0.01, '#0d0a08', 0.35);
  // As mesas de enxárcia (−x e +x), com as bigotas e os colhedores.
  for (const s of [-1, 1]) {
    bloco(partes, quadro(s * X, 0), 0.2, 1.36, ESCURO, 0.7, 0.03);
    for (const v of vs) { partes.push(elipse(s * (X - 0.12), v, 0.14, 0.14, ESCURO.nanquim, 0.78, { contorno: 'leve', detalhe: 2 }), elipse(s * (X - 0.12), v, 0.1, 0.1, CARVALHO.luz, 0.782, { ...O, detalhe: 3 })); for (const q of [-0.025, 0.025]) partes.push(tira([s * (X - 0.06), v + q, s * (X - 0.18), v + q], 0.01, CORDA, 0.79, { ...O, detalhe: 3 })); }
  }
  // As enxárcias, do mastro às bigotas, e os enfrechates que as cruzam como degraus.
  for (const s of [-1, 1]) {
    for (const v of vs) corda(partes, [s * 0.28, v * 0.3, s * (X - 0.18), v], 0.024, 1.3);
    for (let t = 0.22; t < 0.95; t += 0.1) { const pts: number[] = []; for (const v of vs) pts.push(s * (0.28 + (X - 0.46) * t), v * (0.3 + 0.7 * t)); partes.push(tira(pts, 0.01, tom(CORDA, -0.2), 1.305, { ...O, detalhe: 3 })); }
  }
  // A malagueteira: o quadro de cavilhas em volta do mastro.
  const M = 0.6, quadroDaMalagueta = [-M, -M, M, -M, M, M, -M, M, -M, -M];
  partes.push(tira(quadroDaMalagueta, 0.13, ESCURO.nanquim, 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(quadroDaMalagueta, 0.09, CARVALHO.meio, 0.903, { ...O, detalhe: 2 }), tira([-M, M, -M, -M, M, -M], 0.03, CARVALHO.brilho, 0.905, { ...S, alfa: 0.55, detalhe: 3 }));
  for (const [x, y] of [[-M, -M], [M, -M], [M, M], [-M, M]] as const) bloco(partes, quadro(x, y), 0.14, 0.14, ESCURO, 0.95, 0.025);
  for (let k = 0; k < 4; k++) for (let t = -0.4; t <= 0.41; t += 0.2) { const [x, y] = k === 0 ? [t, -M] : k === 1 ? [M, t] : k === 2 ? [-t, M] : [-M, -t]; partes.push(elipse(x!, y!, 0.045, 0.045, ESCURO.nanquim, 0.96, { contorno: false, semSombra: true, detalhe: 3 }), elipse(x! + LUZ_X * 0.006, y! + LUZ_Y * 0.006, 0.03, 0.03, '#c8b08a', 0.962, { ...O, detalhe: 3 })); }
  // Os rolos de corda pendurados nas cavilhas, caídos no convés.
  for (const [x, y] of [[-0.35, 0.82], [0.4, 0.84], [0.85, -0.35], [-0.84, 0.3]] as const) if (r() < 0.85) rolo(partes, r, x, y, 0.13, 0.05);
  // O mastro.
  partes.push(elipse(0, 0, 0.78, 0.78, tom(LONA, -0.5), 0.1, { contorno: 'leve', detalhe: 2 }), elipse(-0.02, -0.02, 0.7, 0.7, tom(LONA, -0.2), 0.103, { ...O, detalhe: 2 }));
  disco(partes, 0, 0, 0.29, CARVALHO, 1.4);
  for (const k of [0.75, 0.45]) partes.push(tira(anel(0, 0, 0.29 * k, 0.29 * k, 24), 0.03, FERRO.base, 1.42, { ...O, alfa: 0.85, detalhe: 3 }));
  return partes;
}

/** Baú de tesouro: fechado, a tampa abaulada de carvalho com as cintas de ferro, os cantos de latão e o fecho na frente (+y); aberto, a tampa tombada para trás e o baú cheio de ouro, pedras, colar de pérolas e cálice, com moedas caídas na frente. */
function bauDeTesouro(seed: number, aberto: boolean): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.0, D = 0.6, z = 0.5;
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2, -W / 2, D / 2], 0.01, '#0d0a08', 0.5);
  const cintas = [-0.36, 0, 0.36];
  if (!aberto) {
    cilindro(partes, -W / 2, 0, W / 2, 0, D, D, CARVALHO, z);
    for (let v = -D / 2 + 0.12; v < D / 2 - 0.05; v += 0.12) partes.push(tira([-W / 2 + 0.02, v, W / 2 - 0.02, v], 0.008, CARVALHO.nanquim, z + 0.01, { ...O, alfa: 0.5, detalhe: 3 }));
    for (const u of cintas) { partes.push(tira([u, -D / 2 - 0.01, u, D / 2 + 0.01], 0.07, FERRO.nanquim, z + 0.012, { contorno: 'leve', detalhe: 2 }), tira([u - 0.008, -D / 2, u - 0.008, D / 2], 0.035, FERRO.luz, z + 0.014, { ...O, detalhe: 3 })); for (let v = -D / 2 + 0.06; v < D / 2; v += 0.1) partes.push(elipse(u, v, 0.022, 0.022, FERRO.brilho, z + 0.016, { ...O, detalhe: 3 })); }
    for (const s of [-1, 1]) { partes.push(ret(s * (W / 2 - 0.01), 0, 0.04, D - 0.04, CARVALHO.sombra, z + 0.015, { ...O, detalhe: 3 }), tira(arco(s * (W / 2 + 0.03), 0, 0.04, 0.1, -Math.PI / 2, Math.PI / 2, 6).map((v, i) => (i % 2 ? v : s * (v - s * (W / 2 + 0.03)) + s * (W / 2 + 0.03))), 0.02, FERRO.luz, z, { contorno: 'leve', detalhe: 3 })); }
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { const cu = su * (W / 2 - 0.01), cv = sv * (D / 2 - 0.01); partes.push(poli([cu, cv, cu - su * 0.11, cv, cu, cv - sv * 0.11], LATAO.meio, z + 0.02, { contorno: 'leve', detalhe: 2 })); }
    partes.push(poli(retR(ID, 0, D / 2 - 0.02, 0.12, 0.1, 0.02), LATAO.base, z + 0.022, { contorno: 'leve', detalhe: 2 }), elipse(0, D / 2 - 0.02, 0.025, 0.035, LATAO.nanquim, z + 0.024, { ...O, detalhe: 3 }));
    return { pegada: [1.1, 0.75], partes };
  }
  // A tampa aberta, tombada para trás (−y): o forro de dentro, escuro, com as cintas.
  const tz = 0.95, tf = 0.38;
  partes.push(poli([-W / 2 - 0.01, -D / 2, W / 2 + 0.01, -D / 2, W / 2 - 0.01, -D / 2 - tf, -W / 2 + 0.01, -D / 2 - tf], CARVALHO.nanquim, tz, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli([-W / 2 + 0.03, -D / 2 - 0.02, W / 2 - 0.03, -D / 2 - 0.02, W / 2 - 0.05, -D / 2 - tf + 0.04, -W / 2 + 0.05, -D / 2 - tf + 0.04], ESCURO.base, tz + 0.003, { ...O, detalhe: 1 }));
  for (const u of cintas) partes.push(tira([u, -D / 2 - 0.02, u, -D / 2 - tf + 0.03], 0.05, FERRO.base, tz + 0.006, { ...O, detalhe: 2 }));
  partes.push(tira([-W / 2 + 0.05, -D / 2 - tf + 0.05, W / 2 - 0.05, -D / 2 - tf + 0.05], 0.04, CARVALHO.luz, tz + 0.008, { ...O, alfa: 0.7, detalhe: 3 }));
  // A caixa e o monte de ouro.
  bloco(partes, ID, W, D, CARVALHO, z, 0.06);
  for (const u of cintas) partes.push(tira([u, -D / 2, u, -D / 2 + 0.06], 0.06, FERRO.luz, z + 0.01, { ...O, detalhe: 3 }), tira([u, D / 2 - 0.06, u, D / 2], 0.06, FERRO.luz, z + 0.01, { ...O, detalhe: 3 }));
  partes.push(poli(retQ(ID, 0, 0, W - 0.12, D - 0.12), '#1a0e06', z + 0.012, { ...O, detalhe: 1 }));
  partes.push(poli(bolha(0, 0, W / 2 - 0.08, D / 2 - 0.08, 18, 0.08, r), OURO.sombra, z + 0.05, { ...O, detalhe: 1 }), poli(bolha(LUZ_X * 0.04, LUZ_Y * 0.03, W / 2 - 0.16, D / 2 - 0.14, 16, 0.1, r), OURO.base, z + 0.06, { ...S, detalhe: 1 }), poli(bolha(LUZ_X * 0.1, LUZ_Y * 0.06, W / 4, D / 5, 12, 0.15, r), OURO.luz, z + 0.07, { ...S, alfa: 0.8, detalhe: 2 }));
  for (let k = 0; k < 60; k++) { const x = (r() - 0.5) * (W - 0.2), y = (r() - 0.5) * (D - 0.2); moeda(partes, r, x, y, z + 0.08 + k * 0.0005, r() < 0.1); }
  for (let k = 0; k < 6; k++) gema(partes, (r() - 0.5) * (W - 0.3), (r() - 0.5) * (D - 0.25), 0.03 + r() * 0.02, GEMAS[k % GEMAS.length]!, z + 0.12, r());
  const colar: number[] = []; const c0 = -0.3 + r() * 0.2; for (let k = 0; k <= 12; k++) { const t = k / 12; colar.push(c0 + t * 0.4, -0.05 + Math.sin(t * Math.PI) * 0.32 + t * 0.05); }
  for (let i = 0; i < colar.length; i += 2) partes.push(elipse(colar[i]!, colar[i + 1]!, 0.032, 0.032, '#ece6da', z + 0.13, { contorno: 'leve', detalhe: 3 }));
  calice(partes, 0.25 + r() * 0.1, -0.08, z + 0.13);
  // As moedas caídas na frente.
  for (let k = 0; k < 9; k++) moeda(partes, r, (r() - 0.5) * 0.8, D / 2 + 0.06 + r() * 0.2, 0.02 + k * 0.001, r() < 0.15);
  return { pegada: [1.1, 1.5], partes };
}

/** Moedas espalhadas: montinhos e moedas soltas de ouro e prata, as pedras, o cálice tombado, o colar e a bolsa de couro aberta. */
function moedasEspalhadas(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.3, D = 0.9;
  const bx = (r() - 0.5) * 0.4, by = (r() - 0.5) * 0.3;
  // A bolsa de couro aberta, de onde o ouro escorre.
  partes.push(poli(bolha(bx - 0.25, by - 0.1, 0.17, 0.13, 10, 0.2, r), '#2a1a0e', 0.04, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(bolha(bx - 0.26, by - 0.11, 0.14, 0.1, 10, 0.2, r), '#6a4424', 0.043, { ...O, detalhe: 2 }), elipse(bx - 0.18, by - 0.06, 0.12, 0.09, '#1a0e06', 0.046, { ...O, detalhe: 3 }));
  corda(partes, [bx - 0.34, by - 0.18, bx - 0.42, by - 0.26, bx - 0.38, by - 0.32], 0.012, 0.047, '#8a6a40');
  for (let m = 0; m < 3; m++) {
    const mx = m === 0 ? bx - 0.1 : (r() - 0.5) * W * 0.7, my = m === 0 ? by : (r() - 0.5) * D * 0.6;
    partes.push(poli(bolha(mx, my, 0.12, 0.09, 10, 0.25, r), OURO.sombra, 0.012, { ...S, alfa: 0.8, detalhe: 2 }));
    for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.12; moeda(partes, r, mx + Math.cos(a) * d, my + Math.sin(a) * d * 0.8, 0.015 + k * 0.002, r() < 0.12); }
  }
  for (let k = 0; k < 26; k++) moeda(partes, r, (r() - 0.5) * W, (r() - 0.5) * D, 0.012, r() < 0.25);
  for (let k = 0; k < 5; k++) gema(partes, (r() - 0.5) * W * 0.8, (r() - 0.5) * D * 0.8, 0.025 + r() * 0.015, GEMAS[Math.floor(r() * GEMAS.length)]!, 0.04, r());
  calice(partes, 0.35 + (r() - 0.5) * 0.2, 0.2, 0.05, r() * 6.28);
  const colar: number[] = []; for (let k = 0; k <= 14; k++) { const t = k / 14; colar.push(-0.45 + t * 0.5, 0.3 + Math.sin(t * Math.PI * 1.6) * 0.08); }
  for (let i = 0; i < colar.length; i += 2) partes.push(elipse(colar[i]!, colar[i + 1]!, 0.03, 0.03, i % 6 ? OURO.luz : GEMAS[0]!, 0.04, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Mapa do tesouro sobre a mesa: o pergaminho de bordas queimadas, a ilha com o litoral, o caminho tracejado, o X vermelho, a rosa dos ventos, a caveira de aviso e o punhal cravado. */
function mapaDoTesouro(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], z = 0.8, f = quadro(0, 0, (r() - 0.5) * 0.25), w = 0.6, h = 0.42;
  const borda: number[] = []; const passo = 14;
  for (let k = 0; k < passo; k++) borda.push(-w / 2 + (k / passo) * w, -h / 2 + (r() - 0.5) * 0.025);
  for (let k = 0; k < passo; k++) borda.push(w / 2 + (r() - 0.5) * 0.025, -h / 2 + (k / passo) * h);
  for (let k = 0; k < passo; k++) borda.push(w / 2 - (k / passo) * w, h / 2 + (r() - 0.5) * 0.025);
  for (let k = 0; k < passo; k++) borda.push(-w / 2 + (r() - 0.5) * 0.025, h / 2 - (k / passo) * h);
  partes.push(poli(em(f, borda.map((v, i) => v * 1.04 + (i % 2 ? 0.006 : 0.004))), '#3a2410', z, { contorno: false, semSombra: true, detalhe: 1 }), poli(em(f, borda), '#8a5a28', z + 0.001, { ...O, detalhe: 1 }), poli(em(f, borda.map(v => v * 0.93)), PERGAMINHO, z + 0.002, { ...S, detalhe: 1 }));
  for (let k = 0; k < 5; k++) partes.push(poli(bolha(...f((r() - 0.5) * w * 0.7, (r() - 0.5) * h * 0.7), 0.05, 0.04, 8, 0.4, r), '#b8985a', z + 0.003, { ...S, alfa: 0.4, detalhe: 3 }));
  // A ilha e as ondinhas do mar.
  const ilha = bolha(-0.02, 0.01, 0.17, 0.12, 16, 0.22, r);
  partes.push(poli(em(f, ilha), '#c8a868', z + 0.004, { ...S, detalhe: 2 }), tira(em(f, ilha.concat(ilha.slice(0, 2))), 0.006, TINTA, z + 0.005, { ...O, detalhe: 2 }));
  for (let k = 0; k < 8; k++) { const a = r() * 6.28, d = 0.2 + r() * 0.05, u = Math.cos(a) * d, v = Math.sin(a) * d * 0.7; partes.push(tira(em(f, [u - 0.02, v, u - 0.01, v - 0.008, u, v, u + 0.01, v - 0.008]), 0.004, TINTA, z + 0.005, { ...O, alfa: 0.6, detalhe: 3 })); }
  // O caminho tracejado até o X e as palmeirinhas.
  const cam = [-0.12, 0.06, -0.08, -0.01, -0.02, 0.03, 0.03, -0.03, 0.08, -0.02];
  for (let i = 0; i + 3 < cam.length; i += 2) partes.push(tira(em(f, [cam[i]!, cam[i + 1]!, (cam[i]! + cam[i + 2]!) / 2, (cam[i + 1]! + cam[i + 3]!) / 2]), 0.006, TINTA, z + 0.006, { ...O, detalhe: 3 }));
  for (const [u, v] of [[-0.09, -0.05], [0.0, 0.07]] as const) { partes.push(tira(em(f, [u, v, u + 0.005, v - 0.03]), 0.005, TINTA, z + 0.006, { ...O, detalhe: 3 })); for (const a of [-2.4, -1.6, -0.7]) partes.push(lente(...f(u + 0.005, v - 0.03), a, 0.025, 0.01, '#4a5a2a', z + 0.007, { ...O, detalhe: 3 })); }
  for (const s of [-1, 1]) partes.push(tira(em(f, [0.08 - 0.022, -0.02 - s * 0.022, 0.08 + 0.022, -0.02 + s * 0.022]), 0.012, SANGUE, z + 0.008, { ...O, detalhe: 2 }));
  // A rosa dos ventos e a caveira de aviso.
  const [rx, ry] = f(w / 2 - 0.08, -h / 2 + 0.08); const rosa: number[] = [];
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 - Math.PI / 2, d = k % 4 === 0 ? 0.05 : k % 2 === 0 ? 0.03 : 0.012; rosa.push(rx + Math.cos(a) * d, ry + Math.sin(a) * d); }
  partes.push(poli(rosa, TINTA, z + 0.006, { ...O, detalhe: 2 }), elipse(rx, ry, 0.012, 0.012, PERGAMINHO, z + 0.007, { ...O, detalhe: 3 }));
  const [kx, ky] = f(-w / 2 + 0.08, h / 2 - 0.08);
  partes.push(elipse(kx, ky, 0.04, 0.036, TINTA, z + 0.006, { ...O, detalhe: 3 }), elipse(kx - 0.008, ky - 0.002, 0.01, 0.01, PERGAMINHO, z + 0.007, { ...O, detalhe: 3 }), elipse(kx + 0.008, ky - 0.002, 0.01, 0.01, PERGAMINHO, z + 0.007, { ...O, detalhe: 3 }));
  // O punhal cravado no X: o pomo, o punho e a guarda, vistos de cima.
  const [px, py] = f(0.1, 0.06), ga = r() * 6.28;
  partes.push(elipse(px + 0.03, py + 0.04, 0.08, 0.05, '#0d0a08', z + 0.009, { ...S, alfa: 0.35, detalhe: 3 }));
  partes.push(tira([px - Math.cos(ga) * 0.08, py - Math.sin(ga) * 0.08, px + Math.cos(ga) * 0.08, py + Math.sin(ga) * 0.08], 0.022, PRATA.nanquim, z + 0.1, { contorno: 'leve', detalhe: 2 }), tira([px - Math.cos(ga) * 0.07, py - Math.sin(ga) * 0.07, px + Math.cos(ga) * 0.07, py + Math.sin(ga) * 0.07], 0.012, PRATA.luz, z + 0.102, { ...O, detalhe: 3 }));
  disco(partes, px, py, 0.028, tonsDe('#4a2a14'), z + 0.11); disco(partes, px, py, 0.016, LATAO, z + 0.13);
  return partes;
}

/** Luneta e sextante sobre a mesa: a luneta de latão com os três tubos e o couro, o sextante (o arco graduado, os raios, a alidade e os espelhos) e a bússola de bolso. */
function lunetaESextante(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], z = 0.8, f = quadro(-0.05, -0.1, (r() - 0.5) * 0.4);
  // A luneta.
  const tubos: [number, number, number, Tons][] = [[-0.32, -0.12, 0.075, LATAO], [-0.12, 0.08, 0.062, tonsDe('#4a2a16')], [0.08, 0.2, 0.05, LATAO], [0.2, 0.3, 0.04, LATAO]];
  partes.push(lente(...f(-0.3, 0.06), 0, 0.6, 0.06, '#0d0a08', z, { ...S, alfa: 0.3, detalhe: 3 }));
  for (const [u0, u1, w, t] of tubos) cilindro(partes, ...f(u0, 0), ...f(u1, 0), w, w, t, z + 0.02);
  for (const u of [-0.32, -0.12, 0.08, 0.2]) partes.push(tira(em(f, [u, -0.04, u, 0.04]), 0.012, LATAO.brilho, z + 0.04, { ...O, alfa: 0.8, detalhe: 3 }));
  partes.push(elipse(...f(-0.33, 0), 0.025, 0.07, '#8aa0a8', z + 0.04, { ...O, vidro: true, detalhe: 3 }));
  // O sextante: o ápice atrás, o arco graduado na frente.
  const sx = 0.18, sy = 0.14, R = 0.2, a0 = Math.PI / 2 - 0.52, a1 = Math.PI / 2 + 0.52;
  partes.push(elipse(sx + 0.03, sy + 0.08, 0.36, 0.2, '#0d0a08', z + 0.001, { ...S, alfa: 0.3, detalhe: 3 }));
  const aro = arco(sx, sy - 0.08, R, R, a0, a1, 10);
  for (const [w, c, dz] of [[0.035, LATAO.nanquim, 0], [0.02, LATAO.luz, 0.002]] as const) {
    partes.push(tira(aro, w, c, z + 0.03 + dz, { ...O, detalhe: 2 }));
    partes.push(tira([sx, sy - 0.08, aro[0]!, aro[1]!], w * 0.8, c, z + 0.03 + dz, { ...O, detalhe: 2 }), tira([sx, sy - 0.08, aro[aro.length - 2]!, aro[aro.length - 1]!], w * 0.8, c, z + 0.03 + dz, { ...O, detalhe: 2 }));
  }
  for (let k = 0; k <= 12; k++) { const a = a0 + (k / 12) * (a1 - a0); partes.push(tira([sx + Math.cos(a) * (R - 0.012), sy - 0.08 + Math.sin(a) * (R - 0.012), sx + Math.cos(a) * (R + 0.008), sy - 0.08 + Math.sin(a) * (R + 0.008)], 0.003, TINTA, z + 0.034, { ...O, detalhe: 3 })); }
  const ai = a0 + 0.3 + r() * 0.4; partes.push(tira([sx, sy - 0.08, sx + Math.cos(ai) * (R + 0.02), sy - 0.08 + Math.sin(ai) * (R + 0.02)], 0.014, LATAO.brilho, z + 0.04, { contorno: 'leve', detalhe: 3 }));
  partes.push(ret(sx, sy - 0.08, 0.04, 0.03, '#a8c0c8', z + 0.042, { contorno: 'leve', vidro: true, detalhe: 3 }), ret(sx - 0.07, sy + 0.02, 0.03, 0.025, '#a8c0c8', z + 0.042, { contorno: 'leve', vidro: true, detalhe: 3 }));
  // A bússola de bolso.
  const bx = -0.25, by = 0.13; disco(partes, bx, by, 0.055, LATAO, z + 0.01); partes.push(elipse(bx, by, 0.085, 0.085, '#ece2c8', z + 0.03, { ...O, detalhe: 3 }), tira([bx, by - 0.035, bx, by + 0.035], 0.008, SANGUE, z + 0.032, { ...O, detalhe: 3 }, 0.2));
  return partes;
}

/** Rede de dormir: as argolas nos ganchos dos esteios, os punhos de corda em leque, o pano listrado que cede no meio e, às vezes, a coberta jogada. */
function redeDeDormir(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 2.5, A = 0.85, Wm = 0.74, z = 0.9;
  const listras = [['#c8b890', '#7a2a1e'], ['#d8ccae', '#2a4a6a'], ['#c8b890', '#3a5a3a']][Math.floor(r() * 3)]!;
  sombraNoChao(partes, bolha(0, 0.05, A, 0.32, 14, 0.05, r), 0.01, '#0d0a08', 0.4);
  // Os esteios e as argolas.
  for (const s of [-1, 1]) { bloco(partes, quadro(s * (L / 2 + 0.02), 0), 0.16, 0.16, ESCURO, 1.3, 0.03); partes.push(tira(anel(s * (L / 2 - 0.1), 0, 0.045, 0.045, 12), 0.016, FERRO.luz, 1.32, { contorno: 'leve', detalhe: 3 })); }
  // Os punhos: as cordinhas da argola às bordas do pano.
  for (const s of [-1, 1]) for (let k = 0; k < 7; k++) { const v = (k / 6 - 0.5) * Wm * 0.85; partes.push(tira([s * (L / 2 - 0.1), 0, s * A, v], 0.008, tom(CORDA, -0.15), 1.0, { ...O, detalhe: 3 })); }
  // O pano, mais largo no meio.
  const contorno = (k: number, dv = 0): number[] => { const a: number[] = [], b: number[] = []; for (let i = 0; i <= 16; i++) { const t = i / 16, x = -A + 2 * A * t, h = (Wm / 2) * k * (0.35 + 0.65 * Math.sin(t * Math.PI)); a.push(x, -h + dv); b.unshift(x, h + dv); } return [...a, ...b]; };
  partes.push(poli(contorno(1.06), tom(listras[0]!, -0.75), z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(contorno(1), listras[0]!, z + 0.003, { ...O, detalhe: 1 }));
  for (const k of [0.82, 0.3]) partes.push(tira(contorno(k).slice(0, 34), 0.035, listras[1]!, z + 0.004, { ...O, alfa: 0.85, detalhe: 2 }), tira(contorno(k).slice(34), 0.035, listras[1]!, z + 0.004, { ...O, alfa: 0.85, detalhe: 2 }));
  // A barriga da rede: a sombra do vão para o sudeste e a borda norte clara.
  partes.push(poli(contorno(0.62, 0.05), tom(listras[0]!, -0.45), z + 0.005, { ...S, alfa: 0.55, detalhe: 2 }), tira(contorno(0.96).slice(0, 34), 0.03, tom(listras[0]!, 0.3), z + 0.006, { ...S, alfa: 0.7, detalhe: 3 }));
  if (r() < 0.6) { const cx = (r() - 0.5) * 0.6, cob = ['#6a2a1e', '#3a4a2a', '#4a3a5a'][Math.floor(r() * 3)]!; partes.push(poli(bolha(cx, 0.04, 0.32, 0.2, 12, 0.2, r), tom(cob, -0.5), z + 0.02, { contorno: 'leve', detalhe: 2 }), poli(bolha(cx - 0.01, 0.03, 0.28, 0.17, 12, 0.2, r), cob, z + 0.022, { ...O, detalhe: 2 }), tira([cx - 0.2, -0.04, cx + 0.15, 0.08], 0.02, tom(cob, -0.4), z + 0.024, { ...O, alfa: 0.6, detalhe: 3 })); }
  return partes;
}

/** Bandeira pirata no mastro: a base de pedras, o pau e a adriça, e o pano preto tremulando, visto um pouco de frente, com a caveira e os ossos cruzados e a ponta esfarrapada. */
function bandeiraPirata(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], px = -0.55, py = -0.1, L = 1.15, F = 0.62, zb = 1.45;
  sombraNoChao(partes, bolha(px, py, 0.3, 0.26, 10, 0.2, r), 0.01, '#0d0a08', 0.4);
  // A base de pedras e o pau.
  for (let k = 0; k < 6; k++) { const a = (k / 6) * 6.28 + r() * 0.4; disco(partes, px + Math.cos(a) * 0.17, py + Math.sin(a) * 0.14, 0.08 + r() * 0.04, tonsDe('#6e6a60'), 0.08); }
  disco(partes, px, py, 0.06, CARVALHO, 1.2);
  // O pano: a borda de cima ondulada, a face caindo para +y, as dobras em faixas claras e escuras.
  const N = 12, cima: [number, number][] = [], baixo: [number, number][] = [], fase = r() * 6.28;
  for (let i = 0; i <= N; i++) { const t = i / N, x = px + 0.04 + t * L, y = py - 0.32 + Math.sin(t * 5 + fase) * 0.05 * t + t * 0.06; cima.push([x, y]); baixo.push([x + Math.sin(t * 4 + fase) * 0.03 * t, y + F - t * 0.08]); }
  const rasgo = baixo.map(([x, y], i): [number, number] => (i === N ? [x, y] : [x, y]));
  const pano = [...cima.flat(), ...[[cima[N]![0] + 0.02, cima[N]![1] + F * 0.25], [cima[N]![0] - 0.06, cima[N]![1] + F * 0.45], [cima[N]![0] + 0.01, cima[N]![1] + F * 0.65]].flat(), ...rasgo.slice().reverse().flat()];
  partes.push(poli(pano.map((v, i) => v + (i % 2 ? 0.012 : 0.008)), '#020203', zb, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(pano, '#16161a', zb + 0.003, { ...O, detalhe: 1 }));
  for (let i = 0; i < N; i++) { const d = Math.cos((i + 0.5) / N * 5 + fase); if (Math.abs(d) < 0.35) continue; partes.push(poli([...cima[i]!, ...cima[i + 1]!, ...baixo[i + 1]!, ...baixo[i]!], d > 0 ? '#34343a' : '#060608', zb + 0.004, { ...S, alfa: 0.6, detalhe: 2 })); }
  // A caveira e os ossos cruzados no meio do pano.
  const mi = Math.round(N * 0.45), [mx, my] = [(cima[mi]![0] + baixo[mi]![0]) / 2, (cima[mi]![1] + baixo[mi]![1]) / 2], OSSO = '#e4dccb';
  for (const s of [-1, 1]) { const pts = [mx - 0.16, my + s * 0.12, mx + 0.16, my - s * 0.12]; partes.push(tira(pts, 0.04, OSSO, zb + 0.006, { ...O, detalhe: 2 })); for (const q of [0, 2]) { partes.push(elipse(pts[q]! + (q ? 0.01 : -0.01), pts[q + 1]! - 0.02, 0.04, 0.04, OSSO, zb + 0.006, { ...O, detalhe: 3 }), elipse(pts[q]! + (q ? 0.01 : -0.01), pts[q + 1]! + 0.02, 0.04, 0.04, OSSO, zb + 0.006, { ...O, detalhe: 3 })); } }
  partes.push(elipse(mx, my - 0.03, 0.2, 0.18, OSSO, zb + 0.008, { ...O, detalhe: 2 }), ret(mx, my + 0.06, 0.11, 0.06, OSSO, zb + 0.008, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(elipse(mx + s * 0.045, my - 0.03, 0.06, 0.055, '#16161a', zb + 0.01, { ...O, detalhe: 3 }));
  partes.push(poli([mx - 0.012, my + 0.025, mx + 0.012, my + 0.025, mx, my + 0.0], '#16161a', zb + 0.01, { ...O, detalhe: 3 }));
  for (let k = -1; k <= 1; k++) partes.push(tira([mx + k * 0.03, my + 0.04, mx + k * 0.03, my + 0.085], 0.008, '#16161a', zb + 0.01, { ...O, detalhe: 3 }));
  // A adriça e o topo do pau.
  corda(partes, [px + 0.03, py - 0.32, px + 0.04, py + 0.2, px + 0.1, py + 0.3], 0.01, zb + 0.012);
  disco(partes, px, py - 0.33, 0.045, LATAO, zb + 0.02);
  return partes;
}

/** Forca: o patíbulo de tábuas com a escada na frente (+y), o alçapão com as dobradiças e a alavanca, o poste com o braço e a mão-francesa, e o laço pendurado sobre o alçapão. */
function forca(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.6, D = 2.4, cy = -0.25, z = 1.0, ax = -0.2, ay = -0.35;
  sombraNoChao(partes, [-W / 2, cy - D / 2, W / 2, cy - D / 2, W / 2, cy + D / 2 + 0.6, -W / 2, cy + D / 2 + 0.6], 0.01, '#0d0a08', 0.45);
  // A escada de cinco degraus na frente, à direita.
  const ex = 0.65;
  for (let k = 4; k >= 0; k--) { const v = cy + D / 2 + 0.1 + k * 0.14; bloco(partes, quadro(ex, v), 0.9, 0.16, CARVALHO, z - (k + 1) * 0.18, 0.02); }
  for (const s of [-1, 1]) partes.push(tira([ex + s * 0.47, cy + D / 2, ex + s * 0.47, cy + D / 2 + 0.78], 0.06, ESCURO.base, z - 0.1, { contorno: 'leve', detalhe: 2 }));
  // O tablado.
  bloco(partes, quadro(0, cy), W, D, ESCURO, z, 0.06);
  partes.push(poli(retQ(ID, 0, cy, W - 0.12, D - 0.12), CARVALHO.base, z + 0.006, { ...O, detalhe: 1 }));
  for (let v = cy - D / 2 + 0.06 + 0.2; v < cy + D / 2 - 0.08; v += 0.2) partes.push(tira([-W / 2 + 0.06, v, W / 2 - 0.06, v], 0.012, CARVALHO.nanquim, z + 0.008, { ...O, alfa: 0.6, detalhe: 3 }));
  for (let k = 0; k < 10; k++) { const v = cy - D / 2 + 0.16 + Math.floor(r() * 11) * 0.2; partes.push(poli(retQ(ID, (r() - 0.5) * (W - 0.6), v, 0.4 + r() * 0.6, 0.12), tom(CARVALHO.base, (r() - 0.5) * 0.16), z + 0.007, { ...S, alfa: 0.6, detalhe: 3 })); }
  // O alçapão: a fresta escura, as dobradiças e a alavanca.
  partes.push(tira([ax - 0.42, ay - 0.42, ax + 0.42, ay - 0.42, ax + 0.42, ay + 0.42, ax - 0.42, ay + 0.42, ax - 0.42, ay - 0.42], 0.03, '#0a0604', z + 0.01, { ...O, detalhe: 2 }), tira([ax, ay - 0.42, ax, ay + 0.42], 0.02, '#0a0604', z + 0.01, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) for (const v of [-0.25, 0.25]) partes.push(ret(ax + s * 0.42, ay + v, 0.12, 0.05, FERRO.luz, z + 0.012, { contorno: 'leve', detalhe: 3 }));
  partes.push(tira([ax + 0.7, ay + 0.3, ax + 0.82, ay - 0.1], 0.05, FERRO.base, z + 0.2, { contorno: 'leve', detalhe: 2 }), elipse(ax + 0.82, ay - 0.1, 0.07, 0.07, FERRO.luz, z + 0.22, { contorno: 'leve', detalhe: 3 }));
  // O poste, a mão-francesa e o braço até o alto do alçapão.
  const px = -W / 2 + 0.2;
  partes.push(tira([px, ay, px + 0.55, ay], 0.1, ESCURO.nanquim, 1.38, { contorno: 'leve', detalhe: 2 }), tira([px, ay - 0.01, px + 0.55, ay - 0.01], 0.06, CARVALHO.meio, 1.383, { ...O, detalhe: 3 }));
  bloco(partes, quadro(px, ay), 0.24, 0.24, ESCURO, 1.42, 0.035);
  bloco(partes, quadro((px + ax) / 2 + 0.06, ay), ax - px + 0.3, 0.2, CARVALHO, 1.5, 0.03);
  // O laço: a corda que desce do braço, a volta do nó e a laçada aberta.
  partes.push(elipse(ax + 0.06, ay + 0.08, 0.3, 0.26, '#0d0a08', z + 0.02, { ...S, alfa: 0.3, detalhe: 3 }));
  corda(partes, [ax, ay, ax + 0.01, ay + 0.06], 0.035, 1.52);
  for (let k = 0; k < 4; k++) partes.push(tira([ax - 0.03, ay + 0.04 + k * 0.025, ax + 0.04, ay + 0.04 + k * 0.025], 0.02, tom(CORDA, -0.15 + (k % 2) * 0.1), 1.3, { contorno: 'leve', detalhe: 3 }));
  corda(partes, anel(ax + 0.005, ay + 0.2, 0.09, 0.08, 16), 0.026, 1.2);
  return partes;
}

/** Barril de rum deitado no cavalete: as aduelas e os arcos de ferro, o tampo com a torneira de latão na ponta (+x), a marca XXX a ferro, a poça embaixo da torneira e a caneca de lata. */
function barrilDeRum(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 1.0, R = 0.3, z = 0.8;
  sombraNoChao(partes, [-0.55, -0.35, 0.55, -0.35, 0.55, 0.35, -0.55, 0.35], 0.01, '#0d0a08', 0.45);
  // A poça e a caneca.
  partes.push(poli(bolha(L / 2 + 0.16, 0.05, 0.14, 0.1, 10, 0.3, r), '#4a1e08', 0.01, { ...S, alfa: 0.55, detalhe: 2 }));
  const cx = L / 2 + 0.2, cyc = 0.28; disco(partes, cx, cyc, 0.07, PRATA, 0.15); partes.push(elipse(cx, cyc, 0.1, 0.1, '#5a2a0a', 0.17, { ...O, detalhe: 3 }), tira(arco(cx + 0.07, cyc, 0.05, 0.04, -Math.PI / 2, Math.PI / 2, 6), 0.016, PRATA.luz, 0.16, { contorno: 'leve', detalhe: 3 }));
  // O cavalete em X, nas duas pontas.
  for (const s of [-1, 1]) for (const q of [-1, 1]) partes.push(tira([s * 0.32 - 0.06, q * 0.36, s * 0.32 + 0.06, -q * 0.36], 0.07, ESCURO.base, 0.4, { contorno: 'leve', detalhe: 2 }));
  // O barril abaulado: as faixas de tom ao longo das aduelas, mais largo no meio.
  const perfil = (k: number): number[] => { const a: number[] = [], b: number[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10, x = -L / 2 + t * L, h = R * (0.84 + 0.16 * Math.sin(t * Math.PI)); a.push(x, -h * k); b.unshift(x, h * k); } return [...a, ...b]; };
  const faixa = (k0: number, k1: number): number[] => { const a: number[] = [], b: number[] = []; for (let i = 0; i <= 10; i++) { const t = i / 10, x = -L / 2 + t * L, h = R * (0.84 + 0.16 * Math.sin(t * Math.PI)); a.push(x, h * k0); b.unshift(x, h * k1); } return [...a, ...b]; };
  partes.push(poli(perfil(1.08), CARVALHO.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(perfil(1), CARVALHO.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(faixa(0.55, 1), CARVALHO.sombra, z + 0.004, { ...S, alfa: 0.7, detalhe: 2 }), poli(faixa(-0.85, 0.15), CARVALHO.meio, z + 0.005, { ...S, detalhe: 1 }), poli(faixa(-0.65, -0.3), CARVALHO.luz, z + 0.006, { ...S, detalhe: 2 }), poli(faixa(-0.55, -0.45), CARVALHO.brilho, z + 0.007, { ...S, alfa: 0.6, detalhe: 3 }));
  for (const k of [-0.6, -0.2, 0.2, 0.6]) partes.push(tira(faixa(k, k).slice(0, 22), 0.008, CARVALHO.nanquim, z + 0.008, { ...O, alfa: 0.5, detalhe: 3 }));
  for (const u of [-0.42, -0.16, 0.16, 0.42]) { const h = R * (0.84 + 0.16 * Math.sin((u / L + 0.5) * Math.PI)) * 1.02; partes.push(tira([u, -h, u, h], 0.05, FERRO.nanquim, z + 0.01, { ...O, detalhe: 2 }), tira([u - 0.008, -h, u - 0.008, h * 0.4], 0.02, FERRO.luz, z + 0.011, { ...O, alfa: 0.7, detalhe: 3 })); }
  // A marca XXX a ferro em cima.
  for (let k = -1; k <= 1; k++) for (const s of [-1, 1]) partes.push(tira([k * 0.08 - 0.025, -0.04 - s * 0.03, k * 0.08 + 0.025, -0.04 + s * 0.03], 0.012, '#1a0e06', z + 0.012, { ...O, alfa: 0.85, detalhe: 3 }));
  // O tampo e a torneira.
  partes.push(elipse(L / 2, 0, 0.08, R * 1.7, ESCURO.base, z + 0.012, { contorno: 'leve', detalhe: 2 }));
  partes.push(tira([L / 2 + 0.02, 0.05, L / 2 + 0.16, 0.05], 0.04, LATAO.nanquim, z + 0.02, { contorno: 'leve', detalhe: 2 }), tira([L / 2 + 0.02, 0.045, L / 2 + 0.16, 0.045], 0.02, LATAO.luz, z + 0.022, { ...O, detalhe: 3 }), tira([L / 2 + 0.08, 0.0, L / 2 + 0.08, 0.1], 0.025, LATAO.base, z + 0.03, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

// ---------- Colônia e praia (Q19b) ----------

const CANTARIA: Tons = { nanquim: '#1e1c18', sombra: '#6a665c', base: '#8e897c', meio: '#a29d8e', luz: '#b8b3a2', brilho: '#d4cfbe' };
const CAIADO: Tons = { nanquim: '#2a2620', sombra: '#a8a090', base: '#cec6b2', meio: '#dcd4c0', luz: '#e8e2d0', brilho: '#f6f2e6' };
const JACARANDA: Tons = { nanquim: '#0e0604', sombra: '#2a120a', base: '#3e1c10', meio: '#4c2416', luz: '#62321e', brilho: '#8a5236' };
const AZULEJO = '#2a4a8a', JUTA = '#a8946a';

/** Octógono em degraus (base de pelourinho, cruzeiro): nanquim, tampo e as oito faces do bisel no tom da luz que recebem. */
function octogono(partes: Parte[], x: number, y: number, R: number, t: Tons, z: number, b = R * 0.12): void {
  const v = (k: number, rr: number): [number, number] => { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr]; };
  const anelPts = (rr: number): number[] => { const p: number[] = []; for (let k = 0; k < 8; k++) p.push(...v(k, rr)); return p; };
  partes.push(poli(anelPts(R + 0.03).map((c, i) => c + (i % 2 ? 0.03 : 0.02)), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(anelPts(R), t.base, z + 0.003, { ...O, detalhe: 1 }));
  for (let k = 0; k < 8; k++) { const n = ((k + 0.5) / 8) * Math.PI * 2 + Math.PI / 8, d = Math.cos(n - Math.atan2(LUZ_Y, LUZ_X)); partes.push(poli([...v(k, R), ...v(k + 1, R), ...v(k + 1, R - b), ...v(k, R - b)], d > 0.55 ? t.luz : d > 0.05 ? t.meio : d > -0.55 ? t.base : t.sombra, z + 0.005, { ...O, detalhe: 2 })); }
  partes.push(poli(anelPts(R - b), t.meio, z + 0.006, { ...O, detalhe: 1 }));
}

/** Canoa escavada num tronco: o casco em ponta, a borda clara, o oco com as marcas da enxó, os dois remos, a rede enrolada e a cabaça. */
function canoa(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 4.6, B = 0.78, z = 0.4, t = tonsDe(['#5a3a20', '#4a3a2a', '#6a4a28'][Math.floor(r() * 3)]!);
  const casco = (k: number, dv = 0, enc = 0): number[] => { const a: number[] = [], b: number[] = []; for (let i = 0; i <= 20; i++) { const u = i / 20, x = (-L / 2 + enc) + u * (L - 2 * enc), h = (B / 2) * k * Math.pow(Math.sin(u * Math.PI), 0.55); a.push(x, -h + dv); b.unshift(x, h + dv); } return [...a, ...b]; };
  sombraNoChao(partes, casco(1.05), 0.01, '#0d0a08', 0.4);
  partes.push(poli(casco(1.08), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(casco(1), t.luz, z + 0.003, { ...O, detalhe: 1 }), poli(casco(1, 0.03).slice(42), t.base, z + 0.004, { ...S, alfa: 0.6, detalhe: 2 }));
  // O oco: escuro, mais fundo do lado da luz (a borda norte faz sombra dentro).
  partes.push(poli(casco(0.74, 0, 0.3), t.sombra, z + 0.006, { ...O, detalhe: 1 }), poli(casco(0.6, 0.03, 0.4), t.base, z + 0.007, { ...S, detalhe: 1 }));
  for (let k = 0; k < 18; k++) partes.push(lente(-L / 2 + 0.6 + r() * (L - 1.2), (r() - 0.5) * B * 0.4, (r() - 0.5) * 0.6, 0.14, 0.03, tom(t.base, -0.25), z + 0.008, { ...O, alfa: 0.55, detalhe: 3 }));
  // Os remos, deitados no oco.
  for (const [u, a] of [[-0.6, 0.12], [0.5, -0.1]] as const) { const f = quadro(u, 0, a); partes.push(tira(em(f, [-0.7, 0, 0.35, 0]), 0.04, ESCURO.base, z + 0.02, { contorno: 'leve', detalhe: 2 })); partes.push(poli(bolha(...f(0.6, 0), 0.28, 0.09, 12, 0.05, r, a), ESCURO.nanquim, z + 0.021, { contorno: 'leve', detalhe: 2 }), poli(bolha(...f(0.6, -0.005), 0.25, 0.07, 12, 0.05, r, a), CARVALHO.luz, z + 0.023, { ...O, detalhe: 2 })); }
  // A rede enrolada e a cabaça.
  if (r() < 0.7) { const x = 1.3; partes.push(poli(bolha(x, 0.02, 0.25, 0.16, 12, 0.2, r), '#5a5a48', z + 0.03, { contorno: 'leve', detalhe: 2 })); for (let k = 0; k < 8; k++) partes.push(tira([x - 0.2 + k * 0.05, -0.12, x - 0.25 + k * 0.06, 0.14], 0.006, '#c8c0a0', z + 0.032, { ...O, alfa: 0.7, detalhe: 3 })); }
  disco(partes, -1.5, 0.05, 0.09, tonsDe('#a88a3a'), z + 0.04);
  return partes;
}

/** Cabana de palha: o telhado cônico de palha de coqueiro visto de cima, em anéis amarrados, as palhas em leque iluminadas pelo noroeste, a franja esfiapada no beiral e o arremate no topo. */
function cabanaDePalha(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 2.0, z = 1.3, LA = Math.atan2(LUZ_Y, LUZ_X);
  const PALHAS = ['#7a5e30', '#8e7038', '#a48444', '#b89a58', '#ccb070'];
  const palha = (a: number, k: number): string => { const d = Math.cos(a - LA); return PALHAS[Math.max(0, Math.min(4, Math.round(1.6 + d * 1.6 + k)))]!; };
  sombraNoChao(partes, bolha(0.1, 0.12, R + 0.1, R + 0.1, 20, 0.04, r), 0.01, '#0d0a08', 0.55);
  partes.push(poli(bolha(0.02, 0.03, R + 0.06, R + 0.06, 32, 0.05, r), '#1e1408', z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  // Os anéis, de fora para dentro: base no tom do lado, depois as palhas em leque.
  const aneis = [R, R * 0.78, R * 0.56, R * 0.34];
  aneis.forEach((rr, i) => {
    const zi = z + 0.01 + i * 0.02;
    partes.push(poli(bolha(0, 0, rr, rr, 28, 0.04, r), PALHAS[1]!, zi, { ...O, detalhe: 1 }));
    const n = Math.round(rr * 34);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + r() * 0.08, d0 = rr * (0.6 + r() * 0.15), len = rr - d0 + 0.08 + r() * 0.08;
      partes.push(lente(Math.cos(a) * d0, Math.sin(a) * d0, a + (r() - 0.5) * 0.15, len, 0.1 + r() * 0.06, palha(a, (r() - 0.5) * 1.2), zi + 0.002, { ...O, detalhe: i === 0 ? 2 : 3 }));
    }
    partes.push(tira(anel(0, 0, rr * 0.62, rr * 0.62, 32), 0.035, '#3a2a14', zi + 0.004, { ...O, alfa: 0.55, detalhe: 3 }));
  });
  // A franja esfiapada que passa do beiral.
  for (let k = 0; k < 70; k++) { const a = (k / 70) * Math.PI * 2 + r() * 0.05; partes.push(lente(Math.cos(a) * (R - 0.12), Math.sin(a) * (R - 0.12), a + (r() - 0.5) * 0.3, 0.22 + r() * 0.12, 0.05, palha(a, -0.6), z + 0.005, { ...O, detalhe: 3 })); }
  // O volume do cone: a meia-sombra do sudeste e o brilho do noroeste.
  partes.push(poli(bolha(-LUZ_X * R * 0.3, -LUZ_Y * R * 0.3, R * 0.75, R * 0.75, 20, 0.05, r), '#1e1408', z + 0.09, { ...S, alfa: 0.22, detalhe: 2 }), poli(bolha(LUZ_X * R * 0.35, LUZ_Y * R * 0.35, R * 0.55, R * 0.55, 20, 0.05, r), '#f0dca0', z + 0.091, { ...S, alfa: 0.14, detalhe: 2 }));
  // O arremate do topo: o feixe amarrado e a ponta do esteio.
  disco(partes, 0, 0, 0.2, tonsDe('#8e7038'), z + 0.15); partes.push(tira(anel(0, 0, 0.14, 0.14, 16), 0.03, '#3a2a14', z + 0.17, { ...O, detalhe: 3 }));
  disco(partes, 0, 0, 0.06, ESCURO, z + 0.2);
  return partes;
}

/** Sino de cais: o estrado de tábuas, os dois esteios e a travessa, o sino de bronze com a pátina e a corda do badalo pendurada para a frente (+y). */
function sinoDeCais(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], BRONZE_V: Tons = { nanquim: '#1a120a', sombra: '#4a3418', base: '#74522a', meio: '#8e6834', luz: '#b08646', brilho: '#d8b26c' };
  sombraNoChao(partes, [-0.6, -0.35, 0.6, -0.35, 0.6, 0.4, -0.6, 0.4], 0.01, '#0d0a08', 0.4);
  bloco(partes, ID, 1.2, 0.6, CARVALHO, 0.12, 0.03);
  for (let u = -0.45; u < 0.5; u += 0.15) partes.push(tira([u, -0.27, u, 0.27], 0.008, CARVALHO.nanquim, 0.13, { ...O, alfa: 0.5, detalhe: 3 }));
  corda(partes, [0.05, 0.0, 0.08, 0.2, 0.06, 0.38], 0.022, 0.9);
  partes.push(elipse(0.06, 0.4, 0.05, 0.05, tom(CORDA, -0.3), 0.91, { contorno: 'leve', detalhe: 3 }));
  disco(partes, 0, 0.04, 0.3, BRONZE_V, 1.15); partes.push(tira(anel(0, 0.04, 0.27, 0.27, 28), 0.03, BRONZE_V.sombra, 1.16, { ...O, alfa: 0.8, detalhe: 3 }));
  for (let k = 0; k < 5; k++) { const a = r() * 6.28, d = 0.08 + r() * 0.12; partes.push(poli(bolha(Math.cos(a) * d, Math.sin(a) * d, 0.05, 0.035, 8, 0.3, r), '#4f8a72', 1.17, { ...S, alfa: 0.55, detalhe: 3 })); }
  for (const s of [-1, 1]) bloco(partes, quadro(s * 0.5, -0.2), 0.14, 0.14, ESCURO, 1.4, 0.025);
  bloco(partes, quadro(0, -0.2), 1.16, 0.08, ESCURO, 1.45, 0.015);
  partes.push(tira([0, -0.2, 0, 0.0], 0.05, FERRO.base, 1.3, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Mesa de cartógrafo: a mesa de jacarandá com a carta náutica aberta (litoral, linhas de rumo, rosa dos ventos), outra carta por baixo, os rolos de cartas atrás, o compasso de pontas, a régua paralela, o tinteiro com a pena, a lupa e o castiçal aceso. */
function mesaDeCartografo(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.9, D = 1.0, z = 0.82;
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2, -W / 2, D / 2], 0.01, '#0d0a08', 0.45);
  bloco(partes, ID, W, D, JACARANDA, z, 0.05);
  partes.push(poli(retQ(ID, 0, 0, W - 0.16, D - 0.16), '#2a3a2a', z + 0.008, { ...O, detalhe: 2 }));
  // A carta de baixo, torta, e a carta de cima.
  const f2 = quadro(-0.35, 0.08, 0.2 + r() * 0.1); partes.push(poli(retQ(f2, 0, 0, 0.8, 0.55), tom(PERGAMINHO, -0.12), z + 0.012, { contorno: 'leve', detalhe: 2 }));
  const f = quadro(0.05, 0.05, (r() - 0.5) * 0.12), cw = 1.0, ch = 0.68;
  partes.push(poli(retQ(f, 0.006, 0.008, cw + 0.01, ch + 0.01), '#3a2a18', z + 0.014, { ...O, alfa: 0.5, detalhe: 2 }), poli(retQ(f, 0, 0, cw, ch), PERGAMINHO, z + 0.016, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < 4; k++) partes.push(poli(bolha(...f((r() - 0.5) * cw * 0.8, (r() - 0.5) * ch * 0.8), 0.07, 0.05, 8, 0.4, r), '#b8985a', z + 0.017, { ...S, alfa: 0.3, detalhe: 3 }));
  // O litoral (terra à esquerda, pintada), as ilhas e as linhas de rumo da rosa.
  const costa: number[] = []; for (let k = 0; k <= 12; k++) { const v = -ch / 2 + (k / 12) * ch; costa.push(-0.15 + Math.sin(k * 1.3 + seed) * 0.06 + (r() - 0.5) * 0.04, v); }
  partes.push(poli(em(f, [-cw / 2 + 0.02, -ch / 2 + 0.02, ...costa.map((c, i) => (i % 2 ? Math.max(-ch / 2 + 0.02, Math.min(ch / 2 - 0.02, c)) : c)), -cw / 2 + 0.02, ch / 2 - 0.02]), '#c8a868', z + 0.018, { ...S, alfa: 0.8, detalhe: 2 }), tira(em(f, costa), 0.006, TINTA, z + 0.019, { ...O, detalhe: 2 }));
  for (let k = 0; k < 3; k++) { const il = bolha(0.08 + r() * 0.3, (r() - 0.5) * 0.4, 0.03 + r() * 0.03, 0.025, 8, 0.3, r); partes.push(poli(em(f, il), '#c8a868', z + 0.018, { ...O, detalhe: 3 }), tira(em(f, il.concat(il.slice(0, 2))), 0.004, TINTA, z + 0.019, { ...O, detalhe: 3 })); }
  const [rx, ry] = [0.25, 0.12];
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; partes.push(tira(em(f, [rx, ry, rx + Math.cos(a) * 0.6, ry + Math.sin(a) * 0.6].map((v, i) => (i % 2 ? Math.max(-ch / 2, Math.min(ch / 2, v)) : Math.max(-cw / 2, Math.min(cw / 2, v))))), 0.003, k % 2 ? '#2a5a3a' : SANGUE, z + 0.019, { ...O, alfa: 0.5, detalhe: 3 })); }
  const rosa: number[] = []; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 - Math.PI / 2, d = k % 4 === 0 ? 0.08 : k % 2 === 0 ? 0.05 : 0.02; rosa.push(...f(rx + Math.cos(a) * d, ry + Math.sin(a) * d)); }
  partes.push(poli(rosa, TINTA, z + 0.02, { ...O, detalhe: 2 }), elipse(...f(rx, ry), 0.025, 0.025, SANGUE, z + 0.021, { ...O, detalhe: 3 }));
  // Os rolos de cartas atrás.
  for (let k = 0; k < 3; k++) { const u = -0.7 + k * 0.28 + r() * 0.05; cilindro(partes, u - 0.04, -0.4, u + 0.04 + 0.2, -0.4 + 0.02, 0.09, 0.09, tonsDe(tom(PERGAMINHO, -0.05 * k)), z + 0.03 + k * 0.01); partes.push(tira([u + 0.06, -0.445, u + 0.06, -0.355], 0.012, SANGUE, z + 0.06 + k * 0.01, { ...O, detalhe: 3 })); }
  // O compasso de pontas e a régua paralela.
  const ca = r() * 6.28, [cx, cy] = f(-0.05, -0.05);
  for (const s of [-1, 1]) partes.push(tira([cx, cy, cx + Math.cos(ca + s * 0.25) * 0.22, cy + Math.sin(ca + s * 0.25) * 0.22], 0.012, LATAO.luz, z + 0.03, { contorno: 'leve', detalhe: 3 }, 0.4));
  partes.push(elipse(cx, cy, 0.03, 0.03, LATAO.base, z + 0.032, { contorno: 'leve', detalhe: 3 }));
  const rf = quadro(0.15, 0.3, -0.15 + r() * 0.1); for (const v of [-0.035, 0.035]) partes.push(poli(retQ(rf, 0, v, 0.5, 0.04), '#1a1410', z + 0.03, { contorno: 'leve', detalhe: 2 })); for (const u of [-0.15, 0.15]) partes.push(tira(em(rf, [u - 0.02, -0.035, u + 0.02, 0.035]), 0.01, LATAO.luz, z + 0.032, { ...O, detalhe: 3 }));
  // O tinteiro, a pena e a lupa.
  disco(partes, 0.75, -0.3, 0.05, tonsDe('#1a2a3a'), z + 0.03); partes.push(elipse(0.75, -0.3, 0.04, 0.04, '#050505', z + 0.06, { ...O, detalhe: 3 }), lente(0.74, -0.31, -2.2, 0.28, 0.045, '#e8e2d4', z + 0.07, { contorno: 'leve', detalhe: 3 }));
  partes.push(tira(anel(-0.6, 0.3, 0.07, 0.07, 16), 0.018, LATAO.luz, z + 0.03, { contorno: 'leve', detalhe: 3 }), elipse(-0.6, 0.3, 0.12, 0.12, '#c8dce0', z + 0.031, { ...O, vidro: true, alfa: 0.5, detalhe: 3 }), tira([-0.55, 0.35, -0.45, 0.44], 0.025, ESCURO.base, z + 0.03, { contorno: 'leve', detalhe: 3 }));
  // O castiçal aceso.
  disco(partes, 0.78, 0.32, 0.07, LATAO, z + 0.02); partes.push(elipse(0.78, 0.32, 0.05, 0.05, '#ece6d4', z + 0.2, { contorno: 'leve', detalhe: 3 }), elipse(0.78, 0.32, 0.12, 0.12, '#ffb84a', z + 0.25, { ...O, brilho: true, desfoque: 0.03, alfa: 0.8, detalhe: 3 }), elipse(0.78, 0.32, 0.03, 0.03, '#fff2c0', z + 0.26, { ...O, brilho: true, detalhe: 3 }));
  return partes;
}

/** Botica: o armário de prateleiras contra a parede (−y), com os potes de faiança azul e branca, os frascos de vidro colorido e os rótulos; na frente (+y), o balcão com o almofariz e a mão, a balança de pratos, o maço de ervas e os papéis de receita. */
function botica(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.0, va = -0.27, vb = 0.24;
  sombraNoChao(partes, [-W / 2, -0.5, W / 2, -0.5, W / 2, 0.5, -W / 2, 0.5], 0.01, '#0d0a08', 0.45);
  // O armário, com a cornija e as duas fileiras de potes no tampo da prateleira de cima.
  bloco(partes, quadro(0, va), W, 0.46, JACARANDA, 1.45, 0.05);
  partes.push(poli(retQ(ID, 0, va + 0.02, W - 0.12, 0.34), '#1a0c06', 1.47, { ...O, detalhe: 2 }));
  const VIDROS = ['#2a6a4a', '#7a2a1e', '#2a3a7a', '#8a6a1a', '#4a2a5a'];
  for (const v of [va - 0.08, va + 0.1]) for (let u = -W / 2 + 0.14; u < W / 2 - 0.1; u += 0.16 + r() * 0.03) {
    if (r() < 0.65) { disco(partes, u, v, 0.065, CAIADO, 1.5); partes.push(tira(anel(u, v, 0.05, 0.05, 16), 0.018, AZULEJO, 1.52, { ...O, detalhe: 3 }), elipse(u, v, 0.05, 0.05, tom(CAIADO.base, -0.1), 1.53, { contorno: 'leve', detalhe: 3 }), elipse(u, v, 0.022, 0.022, AZULEJO, 1.535, { ...O, detalhe: 3 })); }
    else { const c = VIDROS[Math.floor(r() * VIDROS.length)]!; partes.push(elipse(u + 0.005, v + 0.006, 0.1, 0.1, tom(c, -0.7), 1.5, { contorno: false, semSombra: true, detalhe: 2 }), elipse(u, v, 0.09, 0.09, c, 1.501, { ...O, vidro: true, detalhe: 2 }), elipse(u, v, 0.03, 0.03, '#b89a6a', 1.503, { ...O, detalhe: 3 }), elipse(u - 0.02, v - 0.02, 0.025, 0.018, '#ffffff', 1.504, { ...S, alfa: 0.55, detalhe: 3 })); }
  }
  for (let u = -W / 2 + 0.3; u < W / 2; u += 0.45) partes.push(ret(u, va + 0.21, 0.12, 0.04, '#ece2c4', 1.48, { contorno: 'leve', detalhe: 3 }));
  // O balcão.
  bloco(partes, quadro(0, vb), W, 0.5, JACARANDA, 0.95, 0.04);
  partes.push(poli(retQ(ID, 0, vb, W - 0.1, 0.4), JACARANDA.meio, 0.99, { ...O, detalhe: 1 }), tira([-W / 2 + 0.06, vb - 0.19, W / 2 - 0.06, vb - 0.19], 0.03, JACARANDA.brilho, 0.995, { ...S, alfa: 0.5, detalhe: 3 }));
  // O almofariz de pedra com a mão.
  const ax = -0.6; disco(partes, ax, vb, 0.12, CANTARIA, 1.0); partes.push(elipse(ax, vb, 0.16, 0.16, '#3a3428', 1.03, { ...O, detalhe: 3 }), elipse(ax, vb, 0.1, 0.1, '#5a6a3a', 1.035, { ...S, alfa: 0.8, detalhe: 3 }), tira([ax - 0.02, vb, ax + 0.16, vb - 0.12], 0.04, CANTARIA.luz, 1.06, { contorno: 'leve', detalhe: 3 }, 0.6));
  // A balança de pratos.
  const bx = 0.05; partes.push(tira([bx - 0.22, vb - 0.02, bx + 0.22, vb - 0.02], 0.02, LATAO.luz, 1.1, { contorno: 'leve', detalhe: 3 }), elipse(bx, vb - 0.02, 0.05, 0.05, LATAO.base, 1.12, { contorno: 'leve', detalhe: 3 }));
  for (const s of [-1, 1]) { disco(partes, bx + s * 0.22, vb + 0.03, 0.08, LATAO, 1.0); }
  partes.push(elipse(bx + 0.22, vb + 0.03, 0.08, 0.06, '#8a5a2a', 1.03, { ...O, detalhe: 3 }));
  // O maço de ervas, os papéis e dois frascos.
  for (let k = 0; k < 7; k++) partes.push(lente(0.55, vb + 0.05, -2.6 + k * 0.12, 0.25, 0.05, ['#4a6a2a', '#6a7a3a', '#5a5a2a'][k % 3]!, 1.0 + k * 0.001, { contorno: 'leve', detalhe: 3 }));
  partes.push(tira([0.5, vb + 0.02, 0.58, vb + 0.08], 0.03, '#8a6a40', 1.01, { ...O, detalhe: 3 }));
  for (let k = 0; k < 2; k++) partes.push(poli(retQ(quadro(0.85 - k * 0.06, vb - 0.02 + k * 0.05, (r() - 0.5) * 0.5), 0, 0, 0.16, 0.2), '#ece6d4', 1.0 + k * 0.002, { contorno: 'leve', detalhe: 3 }));
  for (const [x, c] of [[-0.3, VIDROS[0]!], [0.32, VIDROS[2]!]] as const) partes.push(elipse(x, vb - 0.05, 0.09, 0.09, c, 1.08, { contorno: 'leve', vidro: true, detalhe: 3 }), elipse(x, vb - 0.05, 0.03, 0.03, '#b89a6a', 1.09, { ...O, detalhe: 3 }));
  return partes;
}

/** Oratório: a caixa de jacarandá com a cornija dourada e o frontão recortado; as duas portinhas abertas para os lados, pintadas por dentro; o nicho azul de estrelas visto de frente, com a imagem do santo, as duas velas acesas e o vaso de flores. */
function oratorio(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 0.8, D = 0.45, z = 1.5, y1 = D / 2;
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2 + 0.2, -W / 2, D / 2 + 0.2], 0.01, '#0d0a08', 0.45);
  // As portinhas abertas, giradas nas dobradiças da frente.
  for (const s of [-1, 1]) { const ang = s < 0 ? Math.PI - 0.5 : 0.5, hx = s * W / 2, ex = hx + Math.cos(ang) * (W / 2 - 0.02), ey = y1 + Math.sin(ang) * (W / 2 - 0.02); partes.push(tira([hx, y1, ex, ey], 0.06, JACARANDA.nanquim, 1.2, { contorno: 'leve', detalhe: 2 }), tira([hx, y1, ex, ey], 0.035, tom('#3a5a8a', 0.05), 1.203, { ...O, detalhe: 3 }), tira([hx + (ex - hx) * 0.3, y1 + (ey - y1) * 0.3, hx + (ex - hx) * 0.7, y1 + (ey - y1) * 0.7], 0.012, OURO.luz, 1.205, { ...O, detalhe: 3 })); }
  // O nicho visto de frente, abaixo da borda da frente: o fundo azul com estrelas, a imagem, as velas e as flores.
  const F = 0.32; partes.push(poli([-W / 2 + 0.06, y1, W / 2 - 0.06, y1, W / 2 - 0.06, y1 + F, -W / 2 + 0.06, y1 + F], '#1a2a5a', 1.1, { contorno: 'leve', detalhe: 1 }), tira(arco(0, y1 + 0.02, W / 2 - 0.06, 0.08, Math.PI, 0, 10), 0.02, OURO.luz, 1.105, { ...O, detalhe: 3 }));
  for (let k = 0; k < 8; k++) partes.push(elipse((r() - 0.5) * (W - 0.2), y1 + 0.03 + r() * F * 0.6, 0.015, 0.015, OURO.brilho, 1.104, { ...O, detalhe: 3 }));
  partes.push(elipse(0, y1 + 0.08, 0.1, 0.1, OURO.luz, 1.106, { ...O, alfa: 0.8, detalhe: 3 }), elipse(0, y1 + 0.09, 0.06, 0.06, '#d8b890', 1.107, { contorno: 'leve', detalhe: 3 }));
  partes.push(poli([-0.05, y1 + 0.12, 0.05, y1 + 0.12, 0.08, y1 + F - 0.03, -0.08, y1 + F - 0.03], ['#3a5a9a', '#8a2a2a', '#6a4a2a'][Math.floor(r() * 3)]!, 1.107, { contorno: 'leve', detalhe: 2 }), tira([-0.06, y1 + 0.14, 0.06, y1 + 0.14], 0.03, '#e8e0cc', 1.108, { ...O, detalhe: 3 }));
  for (const s of [-1, 1]) { const x = s * 0.24; partes.push(ret(x, y1 + F - 0.09, 0.035, 0.12, '#ece6d4', 1.109, { contorno: 'leve', detalhe: 3 }), elipse(x, y1 + F - 0.17, 0.08, 0.1, '#ffb84a', 1.112, { ...O, brilho: true, desfoque: 0.02, alfa: 0.8, detalhe: 3 }), elipse(x, y1 + F - 0.165, 0.02, 0.035, '#fff2c0', 1.113, { ...O, brilho: true, detalhe: 3 })); }
  // A caixa, a cornija dourada e o frontão.
  bloco(partes, ID, W, D, JACARANDA, z, 0.04);
  partes.push(tira([-W / 2 + 0.05, -D / 2 + 0.05, W / 2 - 0.05, -D / 2 + 0.05, W / 2 - 0.05, D / 2 - 0.05, -W / 2 + 0.05, D / 2 - 0.05, -W / 2 + 0.05, -D / 2 + 0.05], 0.018, OURO.luz, z + 0.01, { ...O, alfa: 0.85, detalhe: 3 }));
  partes.push(poli([-0.26, y1 - 0.02, -0.18, y1 - 0.1, -0.06, y1 - 0.07, 0, y1 - 0.16, 0.06, y1 - 0.07, 0.18, y1 - 0.1, 0.26, y1 - 0.02], OURO.base, z + 0.02, { contorno: 'leve', detalhe: 2 }), elipse(0, y1 - 0.08, 0.06, 0.06, OURO.brilho, z + 0.03, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Pelourinho colonial: os três degraus de cantaria em octógono, a coluna com o capitel, os quatro braços de ferro com as argolas e o remate em esfera armilar. */
function pelourinhoColonial(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, bolha(0.05, 0.06, 1.35, 1.35, 16, 0.02, r), 0.01, '#0d0a08', 0.45);
  octogono(partes, 0, 0, 1.25, CANTARIA, 0.15); octogono(partes, 0, 0, 0.95, CANTARIA, 0.3); octogono(partes, 0, 0, 0.65, CANTARIA, 0.45);
  for (let k = 0; k < 6; k++) { const a = r() * 6.28, d = 0.7 + r() * 0.45; partes.push(poli(bolha(Math.cos(a) * d, Math.sin(a) * d, 0.08, 0.05, 8, 0.3, r), '#4a5a3a', 0.47, { ...S, alfa: 0.4, detalhe: 3 })); }
  disco(partes, 0, 0, 0.34, CANTARIA, 0.6);
  disco(partes, 0, 0, 0.22, CANTARIA, 1.1);
  partes.push(tira(anel(0, 0, 0.17, 0.17, 20), 0.012, CANTARIA.sombra, 1.13, { ...O, alfa: 0.7, detalhe: 3 }));
  // Os braços de ferro com as argolas.
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k / 4) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); partes.push(tira([c * 0.2, s * 0.2, c * 0.55, s * 0.55, c * 0.6, s * 0.55 - 0.06], 0.045, FERRO.nanquim, 1.35, { contorno: 'leve', detalhe: 2 }), tira([c * 0.2, s * 0.2, c * 0.55, s * 0.55], 0.022, FERRO.luz, 1.352, { ...O, detalhe: 3 }), tira(anel(c * 0.62, s * 0.62, 0.05, 0.05, 10), 0.014, FERRO.brilho, 1.34, { contorno: 'leve', detalhe: 3 })); }
  // O capitel e a esfera armilar de ferro.
  octogono(partes, 0, 0, 0.3, CANTARIA, 1.3);
  for (const [rx, ry] of [[0.16, 0.16], [0.16, 0.06], [0.06, 0.16]] as const) partes.push(tira(anel(0, 0, rx, ry, 20), 0.022, FERRO.nanquim, 1.45, { contorno: 'leve', detalhe: 2 }), tira(anel(0, 0, rx, ry, 20), 0.01, LATAO.luz, 1.452, { ...O, detalhe: 3 }));
  partes.push(elipse(0, 0, 0.05, 0.05, LATAO.base, 1.46, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Fardos de açúcar: as caixas de madeira com a marca do engenho a ferro, os sacos de juta amarrados com o carimbo e um saco aberto derramando o açúcar mascavo e branco. */
function fardosDeAcucar(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], PINHO: Tons = tonsDe('#8a7050');
  sombraNoChao(partes, [-0.9, -0.7, 0.9, -0.7, 0.9, 0.7, -0.9, 0.7], 0.01, '#0d0a08', 0.4);
  // O açúcar derramado.
  partes.push(poli(bolha(0.55, 0.45, 0.28, 0.18, 12, 0.3, r), '#efe8d8', 0.02, { ...S, detalhe: 2 }), poli(bolha(0.5, 0.42, 0.14, 0.09, 10, 0.3, r), '#c8a070', 0.025, { ...S, alfa: 0.7, detalhe: 3 }));
  for (let k = 0; k < 20; k++) partes.push(elipse(0.55 + (r() - 0.5) * 0.7, 0.45 + (r() - 0.5) * 0.45, 0.015, 0.015, '#f4f0e4', 0.03, { ...O, detalhe: 3 }));
  // As caixas, uma sobre a outra no fundo.
  const caixas: [number, number, number, number][] = [[-0.45, -0.32, 0.8, 0.55], [0.42, -0.36, 0.7, 0.5], [-0.4, -0.3, 0.7, 0.48]];
  caixas.forEach(([x, y, w, h], i) => {
    const zc = i === 2 ? 1.05 : 0.55, f = quadro(x, y, (r() - 0.5) * 0.1);
    bloco(partes, f, w, h, PINHO, zc, 0.03);
    for (let v = -h / 2 + 0.12; v < h / 2 - 0.04; v += 0.12) partes.push(tira(em(f, [-w / 2 + 0.02, v, w / 2 - 0.02, v]), 0.008, PINHO.nanquim, zc + 0.01, { ...O, alfa: 0.5, detalhe: 3 }));
    for (const s of [-1, 1]) partes.push(tira(em(f, [s * (w / 2 - 0.06), -h / 2, s * (w / 2 - 0.06), h / 2]), 0.04, PINHO.sombra, zc + 0.011, { ...O, detalhe: 3 }));
    const [mx, my] = f(0, 0); partes.push(tira(anel(mx, my, 0.09, 0.09, 16), 0.014, '#2a1a0e', zc + 0.012, { ...O, alfa: 0.85, detalhe: 3 }), tira(em(f, [-0.04, -0.04, 0, 0.04, 0.04, -0.04]), 0.012, '#2a1a0e', zc + 0.012, { ...O, alfa: 0.85, detalhe: 3 }));
  });
  // Os sacos de juta.
  for (const [x, y, a] of [[-0.55, 0.32, 0.3], [-0.1, 0.38, -0.2], [0.3, 0.16, 0.5]] as const) {
    const f = quadro(x, y, a); estofado(partes, f, a, 0, 0, 0.5, 0.36, JUTA, 0.35, 0.12);
    partes.push(tira(em(f, [0.25, -0.06, 0.3, 0.06]), 0.04, tom(JUTA, -0.3), 0.37, { ...O, detalhe: 3 }), elipse(...f(0.33, 0), 0.06, 0.08, tom(JUTA, 0.1), 0.38, { contorno: 'leve', detalhe: 3 }));
    partes.push(poli(retQ(f, -0.04, 0, 0.14, 0.12), '#3a2a6a', 0.371, { ...O, alfa: 0.45, detalhe: 3 }));
  }
  // O saco aberto.
  const af = quadro(0.42, 0.38, 0.9); estofado(partes, af, 0.9, 0, 0, 0.36, 0.3, JUTA, 0.25, 0.1); partes.push(elipse(...af(0.12, 0), 0.18, 0.2, '#efe8d8', 0.27, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Canhão de forte: o trecho de muralha na frente (+y) com os dois merlões de cantaria e a canhoneira aberta, o piso de lajes, o canhão na carreta de rodas apontando pela canhoneira, as balas empilhadas, o barril de pólvora e o soquete encostado. */
function canhaoDeForte(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.6, yp = 0.85, Dp = 0.7;
  // O piso de lajes.
  for (let y = -1.45; y < yp; y += 0.5) for (let x = -W / 2; x < W / 2 - 0.01; x += 0.65) { const w = 0.63, h = 0.48; partes.push(poli(retQ(ID, x + w / 2 + 0.01, y + h / 2, w, h), tom(CANTARIA.base, (r() - 0.5) * 0.14 - 0.08), 0.02, { contorno: 'leve', detalhe: 2 })); }
  // A muralha: dois merlões e o vão da canhoneira, que abre para fora.
  const cw = 0.42, cwFora = 0.75;
  for (const s of [-1, 1]) {
    const pts = s < 0 ? [-W / 2, yp, -cw / 2, yp, -cwFora / 2, yp + Dp, -W / 2, yp + Dp] : [cw / 2, yp, W / 2, yp, W / 2, yp + Dp, cwFora / 2, yp + Dp];
    partes.push(poli(pts.map((v, i) => v + (i % 2 ? 0.03 : 0.025)), CANTARIA.nanquim, 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(pts, CANTARIA.meio, 1.403, { ...O, detalhe: 1 }));
    partes.push(tira([pts[0]!, pts[1]!, pts[2]!, pts[3]!], 0.06, CANTARIA.luz, 1.405, { ...O, detalhe: 2 }), tira([pts[2]!, pts[3]!, pts[4]!, pts[5]!], 0.05, s < 0 ? CANTARIA.sombra : CANTARIA.luz, 1.405, { ...O, alfa: 0.8, detalhe: 2 }));
    for (let k = 0; k < 3; k++) partes.push(tira([s * (cw / 2 + 0.2 + k * 0.28), yp + 0.02, s * (cw / 2 + 0.25 + k * 0.28), yp + Dp - 0.02], 0.01, CANTARIA.nanquim, 1.406, { ...O, alfa: 0.5, detalhe: 3 }));
    partes.push(tira([pts[0]!, pts[1]! + Dp * 0.5, pts[2]! + (pts[4]! - pts[2]!) * 0.5, yp + Dp * 0.5], 0.01, CANTARIA.nanquim, 1.406, { ...O, alfa: 0.5, detalhe: 3 }));
  }
  partes.push(poli([-cw / 2, yp, cw / 2, yp, cwFora / 2, yp + Dp, -cwFora / 2, yp + Dp], tom(CANTARIA.base, -0.2), 0.7, { contorno: 'leve', detalhe: 2 }));
  // O canhão apontado pela canhoneira.
  canhao(partes, quadro(0, -0.1), 2.3);
  // As balas, o barril de pólvora e o soquete.
  for (const [x, y, zz] of [[-0.95, -1.05, 0.12], [-0.8, -1.05, 0.12], [-0.87, -0.93, 0.12], [-0.88, -1.0, 0.24]] as const) disco(partes, x, y, 0.07, FERRO, zz);
  disco(partes, 0.9, -1.0, 0.2, CARVALHO, 0.6); for (const k of [0.17, 0.1]) partes.push(tira(anel(0.9, -1.0, k, k, 16), 0.015, FERRO.base, 0.62, { ...O, detalhe: 3 }));
  partes.push(tira([0.85, -0.6, 1.1, 0.75], 0.035, CARVALHO.luz, 0.5, { contorno: 'leve', detalhe: 2 }), elipse(1.1, 0.78, 0.12, 0.12, tonsDe('#3a3028').base, 0.52, { contorno: 'leve', detalhe: 2 }));
  return partes;
}

// ---------- Receitas ----------

const CO = { generos: ['colonial', 'fantasia'], kit: 'colonial' };
const luzDeVela = (): LuzDeReceita => ({ preset: 'vela', raio: 3, cor: '#ffcf8a', intensidade: 0.7, power: 'fire', flicker: 0.25 });

/** O kit colonial e pirata: navio e tesouro (Q19a), colônia e praia (Q19b). */
export const RECEITAS_COLONIAIS: Receita[] = [
  // Q19a: navio e tesouro.
  { id: 'canhao-naval', nome: 'Canhão naval', categoria: 'exterior', tipo: 'piso', funcoes: ['conves', 'porao', 'fortim'], ...CO, tags: ['canhao', 'naval', 'navio', 'carreta', 'artilharia', 'polvora', 'pirata', 'colonial'], pegada: [1.6, 2.5], altura: 1.0,
    gerar: p => piso([1.6, 2.5], canhaoNaval(p.seed)) },
  { id: 'timao', nome: 'Timão', categoria: 'exterior', tipo: 'piso', funcoes: ['conves'], ...CO, tags: ['timao', 'leme', 'roda', 'navio', 'conves', 'pirata', 'colonial'], pegada: [1.8, 1.1], altura: 1.5,
    gerar: p => piso([1.8, 1.1], timao(p.seed)) },
  { id: 'mastro', nome: 'Base do mastro', categoria: 'exterior', tipo: 'piso', funcoes: ['conves'], ...CO, tags: ['mastro', 'cordame', 'enxarcia', 'corda', 'navio', 'conves', 'pirata', 'colonial'], pegada: [3.3, 1.9], altura: 3,
    gerar: p => piso([3.3, 1.9], mastro(p.seed)) },
  { id: 'bau-de-tesouro', nome: 'Baú de tesouro', categoria: 'armazenamento', tipo: 'piso', funcoes: ['cabine-do-capitao', 'porao', 'caverna', 'quarto'], ...CO, tags: ['bau', 'tesouro', 'ouro', 'moedas', 'joias', 'pirata', 'colonial'], pegada: [1.1, 0.75], altura: 0.7,
    campos: [{ id: 'aberto', rotulo: 'Aberto (0 não, 1 sim)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const b = bauDeTesouro(p.seed, Math.round(num(p, 'aberto', 0, 0, 1)) === 1); return piso(b.pegada, b.partes); } },
  { id: 'moedas-espalhadas', nome: 'Moedas espalhadas', categoria: 'decoracao', tipo: 'piso', funcoes: ['cabine-do-capitao', 'porao', 'caverna', 'praia'], ...CO, tags: ['moedas', 'ouro', 'tesouro', 'joias', 'calice', 'bolsa', 'pirata', 'colonial'], pegada: [1.3, 0.9], altura: 0.1,
    gerar: p => piso([1.3, 0.9], moedasEspalhadas(p.seed)) },
  { id: 'mapa-do-tesouro', nome: 'Mapa do tesouro', categoria: 'decoracao', tipo: 'piso', funcoes: ['cabine-do-capitao', 'taverna-do-porto'], ...CO, tags: ['mapa', 'tesouro', 'pergaminho', 'ilha', 'punhal', 'mesa', 'pirata', 'colonial'], pegada: [0.65, 0.5],
    gerar: p => piso([0.65, 0.5], mapaDoTesouro(p.seed)) },
  { id: 'luneta-e-sextante', nome: 'Luneta e sextante', categoria: 'decoracao', tipo: 'piso', funcoes: ['cabine-do-capitao', 'conves'], ...CO, tags: ['luneta', 'sextante', 'bussola', 'navegacao', 'latao', 'mesa', 'pirata', 'colonial'], pegada: [0.75, 0.5],
    gerar: p => piso([0.75, 0.5], lunetaESextante(p.seed)) },
  { id: 'rede-de-dormir', nome: 'Rede de dormir', categoria: 'camas', tipo: 'piso', funcoes: ['porao', 'conves', 'quarto', 'cabana'], ...CO, tags: ['rede', 'dormir', 'cama', 'marinheiro', 'pano', 'pirata', 'colonial'], pegada: [2.7, 0.9], altura: 1.3,
    gerar: p => piso([2.7, 0.9], redeDeDormir(p.seed)) },
  { id: 'bandeira-pirata', nome: 'Bandeira pirata', categoria: 'exterior', tipo: 'piso', funcoes: ['conves', 'praia', 'fortim'], ...CO, tags: ['bandeira', 'pirata', 'caveira', 'ossos', 'mastro', 'estandarte', 'colonial'], pegada: [1.4, 1.0], altura: 4,
    gerar: p => piso([1.4, 1.0], bandeiraPirata(p.seed)) },
  { id: 'forca', nome: 'Forca', categoria: 'exterior', tipo: 'piso', funcoes: ['praca', 'fortim'], ...CO, tags: ['forca', 'patibulo', 'execucao', 'laco', 'corda', 'alcapao', 'colonial'], pegada: [2.8, 3.2], altura: 3.2,
    gerar: p => piso([2.8, 3.2], forca(p.seed)) },
  { id: 'barril-de-rum', nome: 'Barril de rum', categoria: 'cozinha', tipo: 'piso', funcoes: ['taverna-do-porto', 'porao', 'taverna', 'conves'], ...CO, tags: ['barril', 'rum', 'torneira', 'cavalete', 'caneca', 'bebida', 'pirata', 'colonial'], pegada: [1.3, 0.9], altura: 1.1,
    gerar: p => piso([1.3, 0.9], barrilDeRum(p.seed)) },

  // Q19b: colônia e praia.
  { id: 'canoa', nome: 'Canoa', categoria: 'exterior', tipo: 'piso', funcoes: ['praia', 'porto', 'enseada'], ...CO, tags: ['canoa', 'barco', 'remo', 'tronco', 'pesca', 'praia', 'colonial'], pegada: [4.8, 1.0], altura: 0.5,
    gerar: p => piso([4.8, 1.0], canoa(p.seed)) },
  { id: 'cabana-de-palha', nome: 'Cabana de palha', categoria: 'exterior', tipo: 'piso', funcoes: ['praia', 'enseada', 'jardim'], ...CO, tags: ['cabana', 'palha', 'oca', 'telhado', 'coqueiro', 'praia', 'tropical', 'colonial'], pegada: [4.4, 4.4], altura: 3.5,
    gerar: p => piso([4.4, 4.4], cabanaDePalha(p.seed)) },
  { id: 'sino-de-cais', nome: 'Sino de cais', categoria: 'exterior', tipo: 'piso', funcoes: ['porto', 'enseada', 'fortim', 'praca'], ...CO, tags: ['sino', 'cais', 'bronze', 'alarme', 'porto', 'colonial'], pegada: [1.2, 0.9], altura: 2.2,
    gerar: p => piso([1.2, 0.9], sinoDeCais(p.seed)) },
  { id: 'mesa-de-cartografo', nome: 'Mesa de cartógrafo', categoria: 'mesas', tipo: 'piso', funcoes: ['cabine-do-capitao', 'escritorio', 'biblioteca', 'fortim'], ...CO, tags: ['mesa', 'cartografo', 'carta', 'mapa', 'compasso', 'navegacao', 'vela', 'luz', 'colonial'], pegada: [2.0, 1.1], altura: 1.0,
    luz: luzDeVela, gerar: p => piso([2.0, 1.1], mesaDeCartografo(p.seed)) },
  { id: 'botica', nome: 'Botica', categoria: 'armazenamento', tipo: 'piso', funcoes: ['loja', 'casa-colonial', 'enfermaria'], ...CO, tags: ['botica', 'boticario', 'potes', 'frascos', 'almofariz', 'balanca', 'ervas', 'colonial'], pegada: [2.0, 1.0], altura: 2.0,
    gerar: p => piso([2.0, 1.0], botica(p.seed)) },
  { id: 'oratorio', nome: 'Oratório', categoria: 'decoracao', tipo: 'piso', funcoes: ['casa-colonial', 'sala', 'quarto', 'capela'], ...CO, tags: ['oratorio', 'santo', 'altar', 'velas', 'dourado', 'religiao', 'luz', 'colonial'], pegada: [1.2, 0.9], altura: 1.7,
    luz: luzDeVela, gerar: p => piso([1.2, 0.9], oratorio(p.seed)) },
  { id: 'pelourinho.colonial', nome: 'Pelourinho colonial', categoria: 'exterior', tipo: 'piso', funcoes: ['praca'], ...CO, tags: ['pelourinho', 'coluna', 'cantaria', 'praca', 'castigo', 'colonial'], pegada: [2.6, 2.6], altura: 4.5,
    gerar: p => piso([2.6, 2.6], pelourinhoColonial(p.seed)) },
  { id: 'fardos-de-acucar', nome: 'Fardos de açúcar', categoria: 'armazenamento', tipo: 'piso', funcoes: ['porao', 'porto', 'deposito', 'enseada'], ...CO, tags: ['acucar', 'fardos', 'sacos', 'caixas', 'carga', 'engenho', 'colonial'], pegada: [1.8, 1.4], altura: 1.2,
    gerar: p => piso([1.8, 1.4], fardosDeAcucar(p.seed)) },
  { id: 'canhao-de-forte', nome: 'Canhão de forte', categoria: 'exterior', tipo: 'piso', funcoes: ['fortim', 'praca'], ...CO, tags: ['canhao', 'forte', 'muralha', 'canhoneira', 'merlao', 'artilharia', 'colonial'], pegada: [2.7, 3.2], altura: 1.6,
    gerar: p => piso([2.7, 3.2], canhaoDeForte(p.seed)) },
];

