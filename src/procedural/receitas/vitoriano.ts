import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, parede, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { ID, MADEIRA, O, S, anel, arco, bloco, disco, em, estofado, olhar, quadro, retQ, retR, tomDaFace, type Tons } from './antiguidade.ts';
import { roda } from './faroeste.ts';
import { LATAO } from './deserto.ts';
import { cilindro } from './colonial.ts';
import { brasas, halo } from './oriental.ts';

// Vitoriano e steampunk (Q20): fábrica e vapor (Q20a), rua e invenções (Q20b). Ferro fundido preto e o verde-garrafa das máquinas pintadas, latão polido,
// cobre com azinhavre, tijolo de fuligem, aço claro das hastes. As regras do acervo: nanquim por baixo da silhueta, volume em degraus
// de tom para o noroeste, `z` das partes até 1,5 m e a `altura` real na receita (a sombra do sol estica o desenho inteiro).

const FERRO: Tons = { nanquim: '#060607', sombra: '#18191c', base: '#26282c', meio: '#32353a', luz: '#4a4e55', brilho: '#848a92' };
const VERDE: Tons = { nanquim: '#06100c', sombra: '#15271e', base: '#21382b', meio: '#2b4635', luz: '#3b5a45', brilho: '#6e8c76' };
const COBRE: Tons = { nanquim: '#1c0904', sombra: '#5a2812', base: '#86401e', meio: '#9e5028', luz: '#b86636', brilho: '#e49a68' };
const TIJOLO: Tons = { nanquim: '#160806', sombra: '#4a1e14', base: '#6a2c1c', meio: '#7a3622', luz: '#8e442c', brilho: '#b0664a' };
const ACO: Tons = { nanquim: '#141618', sombra: '#5a5e64', base: '#7e848a', meio: '#969ca2', luz: '#b2b8be', brilho: '#e4e8ec' };
const MOGNO: Tons = { nanquim: '#140806', sombra: '#3e1a10', base: '#5e2818', meio: '#723420', luz: '#8e472c', brilho: '#b87452' };
const PEDRA: Tons = { nanquim: '#1a1816', sombra: '#5a5650', base: '#7a756c', meio: '#8e887e', luz: '#a49e92', brilho: '#c8c2b4' };
const PATINA = '#4f8a72', CARVAO = '#121214', MOSTRADOR = '#e8e0c8', TINTA = '#141210', VERMELHO = '#8a1e16', LINHO = '#ddd2b6';
const tonsDe = (cor: string): Tons => ({ nanquim: tom(cor, -0.78), sombra: tom(cor, -0.42), base: cor, meio: tom(cor, 0.1), luz: tom(cor, 0.24), brilho: tom(cor, 0.5) });
/** Os pontos de uma polilinha na ordem inversa. */
const inverter = (pts: readonly number[]): number[] => { const o: number[] = []; for (let i = pts.length - 2; i >= 0; i -= 2) o.push(pts[i]!, pts[i + 1]!); return o; };

/** Rebites em fila de (ax, ay) a (bx, by), a cada `passo`. */
function rebites(partes: Parte[], ax: number, ay: number, bx: number, by: number, passo: number, t: Tons, z: number): void {
  const n = Math.max(1, Math.round(Math.hypot(bx - ax, by - ay) / passo));
  for (let k = 0; k <= n; k++) { const x = ax + ((bx - ax) * k) / n, y = ay + ((by - ay) * k) / n; partes.push(elipse(x, y, 0.035, 0.035, t.sombra, z, { ...O, detalhe: 3 }), elipse(x + LUZ_X * 0.006, y + LUZ_Y * 0.006, 0.018, 0.018, t.brilho, z + 0.001, { ...O, alfa: 0.8, detalhe: 3 })); }
}

/**
 * Engrenagem vista de frente (deitada, vista de cima, ou na face de uma parede): os dentes em volta, o aro claro do lado da luz (`lx, ly`)
 * e escuro do outro, os vãos entre os raios, o cubo e o eixo. O dente tem a profundidade do passo, para duas engrenagens do mesmo passo
 * engrenarem (ver `engrenar`).
 */
function engrenagem(partes: Parte[], x: number, y: number, R: number, n: number, t: Tons, z: number, giro = 0, raios = 5, lx = LUZ_X, ly = LUZ_Y): void {
  const p = (Math.PI * 2) / n, d = Math.min(R * 0.2, R * p * 0.42), Rr = R - d, pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = giro + i * p;
    for (const [rr, da] of [[Rr, -0.5], [Rr, -0.3], [R, -0.17], [R, 0.17], [Rr, 0.3]] as const) pts.push(x + Math.cos(a + da * p) * rr, y + Math.sin(a + da * p) * rr);
  }
  partes.push(poli(pts.map((v, i) => v + (i % 2 ? -ly : -lx) * 0.018), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(pts, t.base, z + 0.002, { ...O, detalhe: 1 }));
  const aL = Math.atan2(ly, lx);
  partes.push(tira(arco(x, y, Rr - d * 0.6, Rr - d * 0.6, aL - 1.4, aL + 1.4, 16), d * 1.2, t.luz, z + 0.004, { ...S, alfa: 0.85, detalhe: 2 }));
  partes.push(tira(arco(x, y, R - d * 0.5, R - d * 0.5, aL - 0.9, aL + 0.9, 12), d * 0.5, t.brilho, z + 0.005, { ...S, alfa: 0.55, detalhe: 3 }));
  partes.push(tira(arco(x, y, Rr - d * 0.6, Rr - d * 0.6, aL + Math.PI - 1.3, aL + Math.PI + 1.3, 16), d * 1.1, t.sombra, z + 0.004, { ...S, alfa: 0.75, detalhe: 2 }));
  if (raios > 0 && R > 0.16) {
    // Os vãos entre os raios: setores escuros entre o cubo e o aro, com a borda de dentro do aro clara do lado da sombra (a luz entra pelo vão).
    const r0 = R * 0.3, r1 = Rr * 0.8, q = (Math.PI * 2) / raios, folga = Math.min(0.3, (R * 0.09) / r1);
    for (let k = 0; k < raios; k++) {
      const a0 = giro * 0.5 + q * k + q * 0.13 + folga, a1 = giro * 0.5 + q * (k + 1) - q * 0.13 - folga;
      partes.push(poli([...arco(x, y, r1, r1, a0, a1, 8), ...inverter(arco(x, y, r0 + (r1 - r0) * 0.12, r0 + (r1 - r0) * 0.12, a0 + 0.12, a1 - 0.12, 4))], '#070708', z + 0.006, { ...O, alfa: 0.92, detalhe: 2 }));
    }
  } else partes.push(tira(anel(x, y, R * 0.55, R * 0.55, 20), R * 0.08, t.sombra, z + 0.006, { ...O, alfa: 0.7, detalhe: 3 }));
  // O cubo e o eixo, com o brilho do lado da luz.
  const Rc = R * 0.22;
  partes.push(elipse(x - lx * 0.01, y - ly * 0.01, Rc * 2 + 0.03, Rc * 2 + 0.03, t.nanquim, z + 0.008, { contorno: 'leve', detalhe: 2 }), elipse(x, y, Rc * 2, Rc * 2, t.meio, z + 0.01, { ...O, detalhe: 2 }));
  partes.push(elipse(x + lx * Rc * 0.3, y + ly * Rc * 0.3, Rc * 1.1, Rc * 1.0, t.luz, z + 0.012, { ...S, detalhe: 3 }), elipse(x, y, Rc * 0.8, Rc * 0.8, t.nanquim, z + 0.014, { ...O, detalhe: 3 }));
  partes.push(elipse(x + lx * Rc * 0.15, y + ly * Rc * 0.15, Rc * 0.3, Rc * 0.3, t.brilho, z + 0.015, { ...O, alfa: 0.7, detalhe: 3 }));
}

/** Quantos dentes uma engrenagem de raio `R` tem com o passo `passo` (m de arco por dente). */
const dentes = (R: number, passo: number): number => Math.max(8, Math.round((Math.PI * 2 * R) / passo));

/** Onde fica e como gira a engrenagem de raio `R2` que engrena na primeira (centro, raio, dentes e giro) na direção `ang`. */
function engrenar(x1: number, y1: number, R1: number, n1: number, giro1: number, R2: number, ang: number): { x: number; y: number; n: number; giro: number } {
  const p1 = (Math.PI * 2) / n1, passo = R1 * p1, n2 = dentes(R2, passo), p2 = (Math.PI * 2) / n2, d1 = Math.min(R1 * 0.2, R1 * p1 * 0.42), d2 = Math.min(R2 * 0.2, R2 * p2 * 0.42);
  const D = R1 + R2 - (d1 + d2) / 2 - 0.005, fase = (ang - giro1) / p1;
  return { x: x1 + Math.cos(ang) * D, y: y1 + Math.sin(ang) * D, n: n2, giro: ang + Math.PI - fase * p2 + p2 / 2 };
}

/** Manômetro redondo: o aro de latão, o mostrador de esmalte, as marcas em 270°, a faixa vermelha, o ponteiro e o pino. `cima` = sentido do alto do mostrador. */
function manometro(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number, cima = -1): void {
  partes.push(elipse(x + 0.01, y - cima * 0.012, R * 2 + 0.03, R * 2 + 0.03, LATAO.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(x, y, R * 2, R * 2, LATAO.base, z + 0.002, { ...O, detalhe: 1 }));
  partes.push(tira(arco(x, y, R * 0.9, R * 0.9, Math.PI * 0.9, Math.PI * 1.6, 10), R * 0.16, LATAO.brilho, z + 0.003, { ...S, alfa: 0.7, detalhe: 3 }));
  partes.push(elipse(x, y, R * 1.62, R * 1.62, MOSTRADOR, z + 0.004, { ...O, detalhe: 1 }));
  // O alto do mostrador é a direção `cima` em y; as marcas vão de 225° a −45° em volta dele.
  const base = cima < 0 ? -Math.PI / 2 : Math.PI / 2, s = cima < 0 ? 1 : -1, ang = (t: number): number => base + s * (-Math.PI * 0.75 + t * Math.PI * 1.5);
  for (let k = 0; k <= 10; k++) { const a = ang(k / 10), l = k % 5 === 0 ? 0.22 : 0.12; partes.push(tira([x + Math.cos(a) * R * 0.78, y + Math.sin(a) * R * 0.78, x + Math.cos(a) * R * (0.78 - l), y + Math.sin(a) * R * (0.78 - l)], R * 0.05, TINTA, z + 0.005, { ...O, detalhe: 3 })); }
  const vermelha: number[] = []; for (let k = 0; k <= 6; k++) { const a = ang(0.78 + (k / 6) * 0.22); vermelha.push(x + Math.cos(a) * R * 0.7, y + Math.sin(a) * R * 0.7); }
  partes.push(tira(vermelha, R * 0.09, VERMELHO, z + 0.005, { ...O, detalhe: 3 }));
  const a = ang(0.2 + r() * 0.6); partes.push(tira([x - Math.cos(a) * R * 0.15, y - Math.sin(a) * R * 0.15, x + Math.cos(a) * R * 0.7, y + Math.sin(a) * R * 0.7], R * 0.07, TINTA, z + 0.006, { ...O, detalhe: 3 }, 0.4));
  partes.push(elipse(x, y, R * 0.18, R * 0.18, LATAO.sombra, z + 0.007, { ...O, detalhe: 3 }), elipse(x + R * 0.25, y + cima * R * 0.25, R * 0.5, R * 0.3, '#ffffff', z + 0.008, { ...S, alfa: 0.35, detalhe: 3 }));
}

/** Volante de válvula visto de cima: o aro vermelho com os raios e o cubo. */
function volanteDeValvula(partes: Parte[], x: number, y: number, R: number, z: number, giro = 0): void {
  partes.push(tira(anel(x + 0.01, y + 0.012, R, R, 18), R * 0.24, '#1a0604', z, { contorno: false, semSombra: true, detalhe: 2 }), tira(anel(x, y, R, R, 18), R * 0.2, VERMELHO, z + 0.001, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 4; k++) { const a = giro + (k * Math.PI) / 2; partes.push(tira([x, y, x + Math.cos(a) * R, y + Math.sin(a) * R], R * 0.14, tom(VERMELHO, -0.2), z + 0.002, { ...O, detalhe: 3 })); }
  partes.push(tira(arco(x, y, R, R, Math.PI * 1.0, Math.PI * 1.5, 6), R * 0.08, '#d0604a', z + 0.003, { ...O, alfa: 0.8, detalhe: 3 }), elipse(x, y, R * 0.4, R * 0.4, FERRO.meio, z + 0.004, { contorno: 'leve', detalhe: 3 }));
}

/** Azinhavre: manchas verdes macias sobre o cobre. */
function azinhavre(partes: Parte[], r: () => number, x: number, y: number, w: number, h: number, z: number, n: number): void {
  for (let k = 0; k < n; k++) partes.push(poli(bolha(x + (r() - 0.5) * w, y + (r() - 0.5) * h, 0.04 + r() * 0.06, 0.03 + r() * 0.03, 8, 0.4, r), PATINA, z, { ...S, alfa: 0.4 + r() * 0.25, detalhe: 3 }));
}

// ---------- Fábrica e vapor (Q20a) ----------

/**
 * Caldeira de tubo de fogo (tipo Lancashire), deitada ao longo de y e com a frente para +y: o maciço de tijolo, o casco de ferro
 * rebitado em virolas, o domo de vapor, a válvula de segurança de contrapeso, o tubo de vapor de cobre, a caixa de fumaça e o toco de
 * chaminé atrás; na frente, as duas fornalhas (uma aberta, com a brasa que brilha), o nível de vidro, o manômetro, o monte de carvão e a pá.
 */
function caldeira(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], y0 = -1.7, y1 = 1.4, D = 1.9;
  sombraNoChao(partes, [-1.3, -2.2, 1.3, -2.2, 1.3, 1.8, -1.3, 1.8], 0.01, '#0d0a08', 0.5);
  // O clarão da fornalha aberta no chão, na frente.
  const aberta = r() < 0.5 ? -1 : 1;
  halo(partes, aberta * 0.45, 1.95, 0.26, '#4a0c02', 0.28);
  // O maciço de tijolo, com as fiadas na borda que aparece em volta do casco.
  bloco(partes, quadro(0, -0.15), 2.6, 3.55, TIJOLO, 0.8, 0.06);
  for (const s of [-1, 1]) for (let v = -1.85, k = 0; v < 1.55; v += 0.11, k++) {
    partes.push(tira([s * 1.07, v, s * 1.25, v], 0.008, TIJOLO.nanquim, 0.808, { ...O, alfa: 0.55, detalhe: 3 }));
    partes.push(tira([s * (k % 2 ? 1.16 : 1.11), v + 0.01, s * (k % 2 ? 1.16 : 1.11), v + 0.1], 0.008, TIJOLO.nanquim, 0.808, { ...O, alfa: 0.45, detalhe: 3 }));
  }
  for (let k = 0; k < 10; k++) partes.push(poli(bolha((r() < 0.5 ? -1 : 1) * (1.12 + r() * 0.1), -1.8 + r() * 3.3, 0.08, 0.14, 8, 0.4, r), '#1a1210', 0.809, { ...S, alfa: 0.35, detalhe: 3 }));
  // A caixa de fumaça atrás, de tijolo, com o toco da chaminé (o duto vai à chaminé da fábrica).
  bloco(partes, quadro(0, -1.98), 1.6, 0.42, TIJOLO, 1.0, 0.05);
  disco(partes, 0.45, -1.98, 0.3, FERRO, 1.3);
  partes.push(elipse(0.45, -1.98, 0.42, 0.42, '#050505', 1.33, { ...O, detalhe: 2 }), elipse(0.45, -1.98, 0.5, 0.5, '#1e1814', 1.329, { ...S, alfa: 0.6, detalhe: 3 }));
  // O casco: o cilindro de ferro, as virolas rebitadas e a costura do lado da luz.
  cilindro(partes, 0, y0, 0, y1, D, D, FERRO, 1.2);
  for (const v of [-1.0, -0.2, 0.6]) { partes.push(tira([-D / 2 + 0.04, v, D / 2 - 0.04, v], 0.04, FERRO.nanquim, 1.215, { ...O, alfa: 0.7, detalhe: 2 })); rebites(partes, -D / 2 + 0.16, v + 0.04, D / 2 - 0.16, v + 0.04, 0.12, FERRO, 1.216); }
  rebites(partes, -D * 0.3, y0 + 0.1, -D * 0.3, y1 - 0.1, 0.13, FERRO, 1.216);
  // O tubo de vapor de cobre, do domo para o lado (+x), com o flange e a válvula.
  cilindro(partes, 0.1, -0.5, 1.28, -0.5, 0.15, 0.15, COBRE, 1.42);
  partes.push(poli(retQ(ID, 1.15, -0.5, 0.06, 0.24), COBRE.sombra, 1.44, { contorno: 'leve', detalhe: 3 }));
  volanteDeValvula(partes, 0.85, -0.5, 0.11, 1.46, r());
  azinhavre(partes, r, 0.7, -0.5, 1.0, 0.1, 1.432, 4);
  // O domo de vapor, a válvula de segurança com a alavanca e o contrapeso.
  disco(partes, 0, -0.5, 0.36, FERRO, 1.38);
  disco(partes, 0, -0.5, 0.2, LATAO, 1.42);
  disco(partes, 0, 0.35, 0.1, LATAO, 1.4);
  const ag = Math.PI + (r() - 0.5) * 0.5;
  partes.push(tira([0, 0.35, Math.cos(ag) * 0.55, 0.35 + Math.sin(ag) * 0.55], 0.035, FERRO.nanquim, 1.45, { contorno: 'leve', detalhe: 2 }), tira([0, 0.35, Math.cos(ag) * 0.53, 0.35 + Math.sin(ag) * 0.53], 0.016, FERRO.brilho, 1.452, { ...O, alfa: 0.7, detalhe: 3 }));
  disco(partes, Math.cos(ag) * 0.55, 0.35 + Math.sin(ag) * 0.55, 0.08, FERRO, 1.46);
  // A frente: a chapa da testa, vista um pouco de frente, com as duas fornalhas, o nível de vidro e o manômetro.
  partes.push(poli([-D / 2 - 0.06, y1, D / 2 + 0.06, y1, D / 2 + 0.06, y1 + 0.42, -D / 2 - 0.06, y1 + 0.42], FERRO.nanquim, 1.1, { contorno: 'leve', detalhe: 1 }), poli([-D / 2, y1 + 0.02, D / 2, y1 + 0.02, D / 2, y1 + 0.38, -D / 2, y1 + 0.38], FERRO.sombra, 1.102, { ...O, detalhe: 1 }));
  partes.push(tira([-D / 2 + 0.05, y1 + 0.05, D / 2 - 0.05, y1 + 0.05], 0.03, FERRO.luz, 1.104, { ...O, alfa: 0.7, detalhe: 3 }));
  rebites(partes, -D / 2 + 0.08, y1 + 0.34, D / 2 - 0.08, y1 + 0.34, 0.12, FERRO, 1.105);
  for (const s of [-1, 1]) {
    const x = s * 0.45, yc = y1 + 0.2;
    partes.push(poli(retR(ID, x, yc, 0.5, 0.26, 0.04), FERRO.nanquim, 1.106, { contorno: 'leve', detalhe: 2 }));
    if (s === aberta) {
      partes.push(poli(retR(ID, x, yc, 0.42, 0.2, 0.03), '#1a0804', 1.108, { ...O, detalhe: 2 }));
      brasas(partes, r, x, yc, 0.11, 1.11, 10);
      // A porta aberta, girada para fora no gonzo.
      partes.push(poli([x - s * 0.25, yc - 0.12, x - s * 0.25, yc + 0.12, x - s * 0.38, yc + 0.32, x - s * 0.38, yc + 0.08], FERRO.base, 1.112, { contorno: 'leve', detalhe: 2 }), tira([x - s * 0.27, yc + 0.0, x - s * 0.36, yc + 0.2], 0.02, FERRO.brilho, 1.113, { ...O, alfa: 0.6, detalhe: 3 }));
    } else {
      partes.push(poli(retR(ID, x, yc, 0.42, 0.2, 0.03), FERRO.base, 1.108, { ...O, detalhe: 2 }), tira([x - 0.17, yc - 0.06, x + 0.17, yc - 0.06], 0.02, FERRO.luz, 1.109, { ...O, alfa: 0.7, detalhe: 3 }));
      for (let k = 0; k < 3; k++) partes.push(ret(x - 0.1 + k * 0.1, yc + 0.03, 0.05, 0.02, '#4a1806', 1.11, { ...O, brilho: true, alfa: 0.6, detalhe: 3 }));
      partes.push(tira([x + 0.12, yc, x + 0.2, yc], 0.025, LATAO.luz, 1.111, { contorno: 'leve', detalhe: 3 }));
    }
  }
  partes.push(ret(0, y1 + 0.2, 0.05, 0.26, '#b8c8c8', 1.12, { contorno: 'leve', vidro: true, detalhe: 3 }), ret(0, y1 + 0.25, 0.03, 0.14, '#5a7a80', 1.121, { ...O, alfa: 0.8, detalhe: 3 }));
  manometro(partes, r, 0.55, y1 - 0.2, 0.12, 1.44);
  // O monte de carvão no chão, do lado da fornalha fechada, e a pá.
  const cx = -aberta * 0.95, cy = 1.98;
  partes.push(poli(bolha(cx, cy, 0.32, 0.18, 12, 0.25, r), '#0a0a0c', 0.05, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 22; k++) { const a = r() * 6.28, d = Math.sqrt(r()); partes.push(elipse(cx + Math.cos(a) * d * 0.28, cy + Math.sin(a) * d * 0.15, 0.07, 0.05, r() < 0.5 ? '#1e1e22' : '#34343a', 0.06 + (1 - d) * 0.08, { ...O, detalhe: 3 }), elipse(cx + Math.cos(a) * d * 0.28 - 0.012, cy + Math.sin(a) * d * 0.15 - 0.012, 0.025, 0.02, '#6a6a74', 0.061 + (1 - d) * 0.08, { ...S, alfa: 0.6, detalhe: 3 })); }
  const pf = quadro(cx * 0.55, 1.98, -aberta * 0.4);
  partes.push(tira(em(pf, [-0.4, 0, 0.1, 0]), 0.035, MADEIRA.luz, 0.12, { contorno: 'leve', detalhe: 3 }), poli(em(pf, [0.1, -0.1, 0.32, -0.12, 0.32, 0.12, 0.1, 0.1]), FERRO.luz, 0.12, { contorno: 'leve', detalhe: 2 }));
  return partes;
}

/**
 * Máquina a vapor horizontal (de moinho), com o eixo ao longo de x: a base pintada, o cilindro revestido de ripas de mogno com as
 * cintas de latão, a caixa de válvulas e a entrada de vapor (que vem de −y), o regulador de bolas, as guias, a cruzeta, a biela e a
 * manivela; o eixo de manivelas ao longo de y, nos mancais, e o volante grande no fosso, desenhado um pouco de frente (como o biombo).
 */
function maquinaAVapor(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], ve = 0.45, xm = 1.0, vv = -0.55, Rv = 1.12, kv = 0.3;
  sombraNoChao(partes, [-2.3, -0.1, 1.3, -0.1, 1.3, 0.95, -2.3, 0.95], 0.01, '#0d0a08', 0.45);
  // O fosso do volante e o volante: a coroa grossa, seis raios e o cubo; a metade de baixo some no fosso.
  partes.push(poli(retR(ID, xm, vv, Rv * 2 + 0.1, 0.34, 0.04), '#060606', 0.02, { contorno: 'leve', detalhe: 1 }));
  const giro = r() * 6.28, pv = (a: number, k: number): [number, number] => [xm + Math.cos(a) * Rv * k, vv + Math.sin(a) * Rv * kv * k];
  const coroa = (k: number, n = 40): number[] => { const p: number[] = []; for (let i = 0; i <= n; i++) p.push(...pv((i / n) * Math.PI * 2, k)); return p; };
  partes.push(tira(coroa(0.94), 0.2, VERDE.nanquim, 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 6; k++) { const a = giro + (k * Math.PI) / 3, [ax, ay] = pv(a, 0.2), [bx, by] = pv(a, 0.88); partes.push(tira([ax, ay, bx, by], 0.08, VERDE.nanquim, 1.405, { ...O, detalhe: 2 }), tira([ax, ay, bx, by], 0.05, tomDaFace(VERDE, olhar(a)), 1.406, { ...O, detalhe: 2 })); }
  partes.push(tira(coroa(0.94), 0.15, VERDE.base, 1.41, { ...O, detalhe: 1 }));
  const alto: number[] = []; for (let i = 0; i <= 20; i++) alto.push(...pv(Math.PI + (i / 20) * Math.PI, 0.94));
  partes.push(tira(alto, 0.09, VERDE.luz, 1.412, { ...O, detalhe: 2 }), tira(alto.map((v, i) => (i % 2 ? v - 0.03 : v)), 0.03, VERDE.brilho, 1.413, { ...O, alfa: 0.6, detalhe: 3 }));
  disco(partes, xm, vv, 0.17, VERDE, 1.42, 0.17 * 0.7);
  // O eixo de manivelas ao longo de y e os mancais.
  cilindro(partes, xm, -1.15, xm, ve + 0.25, 0.16, 0.16, ACO, 0.8);
  for (const v of [-0.05, -1.05]) { bloco(partes, quadro(xm, v), 0.42, 0.26, FERRO, 0.85, 0.04); partes.push(elipse(xm, v, 0.08, 0.08, LATAO.luz, 0.9, { contorno: 'leve', detalhe: 3 })); }
  // A base, ao longo da linha da máquina.
  bloco(partes, quadro(-0.6, ve), 3.4, 0.8, VERDE, 0.4, 0.06);
  partes.push(tira([-2.2, ve + 0.33, 1.0, ve + 0.33], 0.02, LATAO.luz, 0.41, { ...O, alfa: 0.7, detalhe: 3 }));
  // A manivela, o pino e a biela; a cruzeta corre nas guias, a haste do êmbolo vai ao cilindro.
  const th = r() * 6.28, rc = 0.32, L = 1.05, px = xm + Math.cos(th) * rc, cx = px - Math.sqrt(L * L - (Math.sin(th) * rc) ** 2);
  disco(partes, xm, ve, 0.36, FERRO, 0.95);
  disco(partes, px, ve, 0.08, ACO, 1.0);
  for (const s of [-1, 1]) partes.push(tira([-0.95, ve + s * 0.17, 0.3, ve + s * 0.17], 0.05, ACO.nanquim, 0.72, { contorno: 'leve', detalhe: 2 }), tira([-0.95, ve + s * 0.17 - 0.008, 0.3, ve + s * 0.17 - 0.008], 0.025, ACO.luz, 0.722, { ...O, detalhe: 3 }));
  partes.push(tira([-0.98, ve, cx, ve], 0.06, ACO.nanquim, 0.78, { contorno: 'leve', detalhe: 2 }), tira([-0.98, ve - 0.006, cx, ve - 0.006], 0.03, ACO.brilho, 0.782, { ...O, detalhe: 3 }));
  bloco(partes, quadro(cx, ve), 0.22, 0.3, FERRO, 0.8, 0.03);
  partes.push(tira([cx, ve, px, ve], 0.12, ACO.nanquim, 1.02, { contorno: 'leve', detalhe: 2 }), tira([cx, ve - 0.01, px, ve - 0.01], 0.07, ACO.base, 1.024, { ...O, detalhe: 2 }), tira([cx, ve - 0.025, px, ve - 0.025], 0.02, ACO.brilho, 1.026, { ...O, alfa: 0.8, detalhe: 3 }));
  bloco(partes, quadro(px, ve), 0.18, 0.2, LATAO, 1.03, 0.03);
  // O cilindro: as tampas de ferro nas pontas, as ripas de mogno e as cintas de latão.
  for (const u of [-2.18, -0.98]) bloco(partes, quadro(u, ve), 0.12, 0.98, FERRO, 1.1, 0.03);
  cilindro(partes, -2.12, ve, -1.04, ve, 0.86, 0.86, MOGNO, 1.12);
  for (let k = -3; k <= 3; k++) partes.push(tira([-2.1, ve + k * 0.11, -1.06, ve + k * 0.11], 0.006, MOGNO.nanquim, 1.13, { ...O, alfa: 0.5, detalhe: 3 }));
  for (const u of [-1.9, -1.58, -1.26]) partes.push(tira([u, ve - 0.42, u, ve + 0.42], 0.05, LATAO.base, 1.135, { ...O, detalhe: 2 }), tira([u - 0.012, ve - 0.4, u - 0.012, ve - 0.05], 0.015, LATAO.brilho, 1.136, { ...O, detalhe: 3 }));
  // A caixa de válvulas em cima, com a lubrificadeira de latão, e o tubo de vapor de cobre que chega de −y.
  bloco(partes, quadro(-1.55, ve - 0.05), 0.6, 0.36, FERRO, 1.3, 0.04);
  cilindro(partes, -1.55, ve - 0.2, -1.55, -1.28, 0.15, 0.15, COBRE, 1.34);
  partes.push(poli(retQ(ID, -1.55, -0.55, 0.26, 0.06), COBRE.sombra, 1.36, { contorno: 'leve', detalhe: 3 }));
  azinhavre(partes, r, -1.55, -0.6, 0.1, 0.9, 1.352, 3);
  disco(partes, -1.35, ve - 0.05, 0.06, LATAO, 1.4);
  // O regulador de bolas: a coluna, os braços e as duas bolas de latão.
  const gr = r() * 3.14, gx = -0.55, gy = -0.12;
  disco(partes, gx, gy, 0.07, FERRO, 1.35);
  for (const s of [-1, 1]) { const bx = gx + Math.cos(gr) * s * 0.22, by = gy + Math.sin(gr) * s * 0.22; partes.push(tira([gx, gy, bx, by], 0.025, ACO.base, 1.4, { contorno: 'leve', detalhe: 3 })); disco(partes, bx, by, 0.085, LATAO, 1.42); }
  disco(partes, gx, gy, 0.04, LATAO, 1.45);
  // A almotolia de óleo esquecida na base.
  if (r() < 0.7) { const ox = -0.2 + r() * 0.4; disco(partes, ox, ve + 0.3, 0.07, LATAO, 0.46); partes.push(tira([ox, ve + 0.3, ox + 0.14, ve + 0.24], 0.015, LATAO.sombra, 0.5, { contorno: 'leve', detalhe: 3 })); }
  return partes;
}

/** Trem de engrenagens sobre a base de ferro fundido: a coroa grande de ferro, o pinhão de latão e a terceira engrenagem, com os mancais e os parafusos da base. */
function engrenagensDeChao(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], passo = 0.1;
  sombraNoChao(partes, [-0.95, -0.68, 0.95, -0.68, 0.95, 0.68, -0.95, 0.68], 0.01, '#0d0a08', 0.45);
  bloco(partes, ID, 1.9, 1.36, FERRO, 0.3, 0.06);
  for (const [u, v] of [[-0.85, -0.58], [0.85, -0.58], [0.85, 0.58], [-0.85, 0.58]] as const) { disco(partes, u, v, 0.04, FERRO, 0.32); partes.push(elipse(u, v, 0.03, 0.03, FERRO.nanquim, 0.345, { ...O, detalhe: 3 })); }
  for (let k = 0; k < 5; k++) partes.push(poli(bolha(-0.7 + r() * 1.4, -0.5 + r() * 1.0, 0.08, 0.05, 8, 0.4, r), '#3a2a14', 0.311, { ...S, alfa: 0.35, detalhe: 3 }));
  const R1 = 0.5, n1 = dentes(R1, passo), g1 = r() * 6.28, x1 = -0.38, y1 = 0.08 + (r() - 0.5) * 0.06;
  const p = engrenar(x1, y1, R1, n1, g1, 0.2, 0.25 + (r() - 0.5) * 0.3);
  const q = engrenar(p.x, p.y, 0.2, p.n, p.giro, 0.34, -1.15 + (r() - 0.5) * 0.25);
  engrenagem(partes, x1, y1, R1, n1, FERRO, 0.6, g1, 6);
  engrenagem(partes, q.x, q.y, 0.34, q.n, VERDE, 0.62, q.giro, 5);
  engrenagem(partes, p.x, p.y, 0.2, p.n, LATAO, 0.7, p.giro, 4);
  return partes;
}

/** Engrenagens de parede: um trem de engrenagens de ferro e latão sobre a chapa rebitada, na face; de cima, a chapa e as bordas dos dentes saindo da parede. */
function engrenagensDeParede(seed: number): { face: Parte[]; topo: Parte[] } {
  const r = mulberry32(seed), face: Parte[] = [], topo: Parte[] = [], passo = 0.09, lx = -Math.SQRT1_2, ly = Math.SQRT1_2;
  face.push(ret(0, 1.5, 1.5, 1.1, FERRO.nanquim, 0.01), ret(0, 1.5, 1.44, 1.04, FERRO.sombra, 0.012, { ...O, detalhe: 1 }));
  for (const v of [1.0, 2.0]) rebites(face, -0.66, v, 0.66, v, 0.11, FERRO, 0.013);
  const R1 = 0.38, n1 = dentes(R1, passo), g1 = r() * 6.28, x1 = -0.25, y1 = 1.45;
  const p = engrenar(x1, y1, R1, n1, g1, 0.16, 0.35 + (r() - 0.5) * 0.3);
  const q = engrenar(p.x, p.y, 0.16, p.n, p.giro, 0.24, -0.9 + (r() - 0.5) * 0.3);
  const s = engrenar(x1, y1, R1, n1, g1, 0.14, 2.6 + (r() - 0.5) * 0.3);
  engrenagem(face, x1, y1, R1, n1, FERRO, 0.03, g1, 6, lx, ly);
  engrenagem(face, q.x, q.y, 0.24, q.n, COBRE, 0.035, q.giro, 5, lx, ly);
  engrenagem(face, s.x, s.y, 0.14, s.n, LATAO, 0.04, s.giro, 0, lx, ly);
  engrenagem(face, p.x, p.y, 0.16, p.n, LATAO, 0.045, p.giro, 4, lx, ly);
  topo.push(ret(0, 0.03, 1.5, 0.06, FERRO.base, 2.05, { contorno: 'leve' }));
  for (const [x, w] of [[x1, R1 * 2], [p.x, 0.32], [q.x, 0.48]] as const) topo.push(ret(x, 0.1, w, 0.06, x === x1 ? FERRO.luz : LATAO.base, 2.1, { contorno: 'leve' }));
  return { face, topo };
}

/** Esteira de fábrica: o quadro de ferro, os rolos das pontas, a correia de couro em ripas, a polia do motor e a carga pela semente (caixotes, sacos, carvão). */
function esteira(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 0.9, z = 0.8;
  sombraNoChao(partes, [-C / 2, -W / 2, C / 2, -W / 2, C / 2, W / 2, -C / 2, W / 2], 0.01, '#0d0a08', 0.45);
  // A polia de acionamento numa ponta (fora do quadro, em +y) e a correia que sobe ao eixo do teto.
  const pu = C / 2 - 0.15;
  bloco(partes, quadro(pu, W / 2 + 0.12), 0.38, 0.1, FERRO, z + 0.1, 0.02);
  partes.push(tira([pu, W / 2 + 0.12, pu + 0.05, W / 2 + 0.24], 0.16, '#2a1e16', z + 0.3, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) cilindro(partes, s * (C / 2 - 0.13), -W / 2 + 0.02, s * (C / 2 - 0.13), W / 2 - 0.02, 0.24, 0.24, ACO, z - 0.02);
  // A correia: couro escuro em ripas, com o lado da luz claro.
  partes.push(poli(retR(ID, 0, 0, C - 0.26, W - 0.16, 0.03), '#1e1a16', z, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, 0, -0.04, C - 0.3, W - 0.3), '#2e2822', z + 0.002, { ...O, detalhe: 1 }));
  for (let u = -C / 2 + 0.25; u < C / 2 - 0.15; u += 0.14) partes.push(tira([u, -W / 2 + 0.1, u, W / 2 - 0.1], 0.012, '#0e0c0a', z + 0.004, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(tira([-C / 2 + 0.16, -W / 2 + 0.14, C / 2 - 0.16, -W / 2 + 0.14], 0.03, '#5a5048', z + 0.005, { ...S, alfa: 0.5, detalhe: 3 }));
  // O quadro: duas longarinas verdes com rebites.
  for (const s of [-1, 1]) { partes.push(tira([-C / 2, s * W / 2, C / 2, s * W / 2], 0.09, VERDE.nanquim, z + 0.04, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-C / 2 + 0.01, s * W / 2 - 0.01, C / 2 - 0.01, s * W / 2 - 0.01], 0.055, s < 0 ? VERDE.luz : VERDE.base, z + 0.043, { ...O, detalhe: 2 })); rebites(partes, -C / 2 + 0.1, s * W / 2, C / 2 - 0.1, s * W / 2, 0.3, VERDE, z + 0.045); }
  // A carga.
  const tipo = Math.floor(r() * 3);
  for (let u = -C / 2 + 0.45 + r() * 0.3; u < C / 2 - 0.4; u += 0.75 + r() * 0.5) {
    if (r() < 0.2) continue;
    const v = (r() - 0.5) * 0.15;
    if (tipo === 0) bloco(partes, quadro(u, v, (r() - 0.5) * 0.2), 0.46, 0.42, tonsDe(tom('#7c6c54', (r() - 0.5) * 0.15)), z + 0.12, 0.04);
    else if (tipo === 1) { const f = quadro(u, v, (r() - 0.5) * 0.5); partes.push(poli(em(f, bolha(0, 0, 0.26, 0.18, 12, 0.12, r)), '#3a2e1e', z + 0.06, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(em(f, bolha(0, 0, 0.23, 0.15, 12, 0.12, r)), '#a8926a', z + 0.08, { ...O, detalhe: 1 }), poli(em(f, bolha(-0.04, -0.03, 0.14, 0.08, 10, 0.2, r)), '#c8b48c', z + 0.09, { ...S, alfa: 0.7, detalhe: 3 }), tira(em(f, [0.2, -0.08, 0.2, 0.08]), 0.03, '#6a5a3a', z + 0.095, { ...O, detalhe: 3 })); }
    else { partes.push(poli(bolha(u, v, 0.26, 0.2, 10, 0.3, r), CARVAO, z + 0.03, { contorno: 'leve', detalhe: 1 })); for (let k = 0; k < 8; k++) partes.push(elipse(u + (r() - 0.5) * 0.36, v + (r() - 0.5) * 0.26, 0.07, 0.05, r() < 0.5 ? '#24242a' : '#3a3a42', z + 0.05, { ...O, detalhe: 3 })); }
  }
  return partes;
}

/** Tear mecânico: o quadro de ferro verde, o rolo de urdume atrás (−y) com os fios correndo para a frente, os quadros de liços, o batente com o pente e as caixas da lançadeira, o tecido já tecido enrolando no rolo da frente (+y) e a polia com a correia de um lado. */
function tearMecanico(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.1, tecido = ['#7a2a24', '#2a3a5a', '#8a7a5a', '#4a5a3a', LINHO][Math.floor(r() * 5)]!, tt = tonsDe(tecido);
  sombraNoChao(partes, [-W / 2, -0.75, W / 2, -0.75, W / 2, 0.75, -W / 2, 0.75], 0.01, '#0d0a08', 0.45);
  // O rolo de urdume, coberto de fio, e os fios até o pente.
  cilindro(partes, -0.88, -0.58, 0.88, -0.58, 0.32, 0.32, tonsDe(LINHO), 0.9);
  for (let u = -0.82; u <= 0.82; u += 0.035) partes.push(tira([u, -0.45, u, 0.16], 0.006, '#ece2c8', 0.92, { ...O, alfa: 0.55, detalhe: 3 }));
  // Os quadros de liços, de madeira, no alto.
  for (const v of [-0.22, -0.08]) { partes.push(tira([-0.95, v, 0.95, v], 0.06, MADEIRA.nanquim, 1.3, { contorno: 'leve', detalhe: 2 }), tira([-0.95, v - 0.008, 0.95, v - 0.008], 0.035, MADEIRA.luz, 1.302, { ...O, detalhe: 3 })); for (let u = -0.85; u <= 0.85; u += 0.07) partes.push(tira([u, v - 0.025, u, v + 0.025], 0.006, ACO.luz, 1.303, { ...O, alfa: 0.6, detalhe: 3 })); }
  // O tecido já feito e o rolo da frente.
  partes.push(poli(retQ(ID, 0, 0.38, 1.66, 0.28), tt.base, 0.85, { ...O, detalhe: 1 }));
  for (let v = 0.26; v < 0.52; v += 0.04) partes.push(tira([-0.83, v, 0.83, v], 0.012, (Math.round(v * 25) % 2 ? tt.sombra : tt.luz), 0.852, { ...O, alfa: 0.5, detalhe: 3 }));
  cilindro(partes, -0.88, 0.58, 0.88, 0.58, 0.2, 0.2, tt, 0.88);
  // O batente com o pente, as caixas da lançadeira nas pontas e a lançadeira.
  partes.push(tira([-1.0, 0.2, 1.0, 0.2], 0.13, MADEIRA.nanquim, 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-1.0, 0.19, 1.0, 0.19], 0.09, MADEIRA.base, 1.003, { ...O, detalhe: 2 }));
  for (let u = -0.85; u <= 0.85; u += 0.025) partes.push(tira([u, 0.16, u, 0.2], 0.004, ACO.brilho, 1.005, { ...O, alfa: 0.5, detalhe: 3 }));
  for (const s of [-1, 1]) bloco(partes, quadro(s * 0.92, 0.2), 0.22, 0.16, MADEIRA, 1.02, 0.02);
  const lu = (r() < 0.5 ? -1 : 1) * (0.88 + r() * 0.04);
  partes.push(lente(lu - 0.12, 0.2, 0, 0.24, 0.06, '#c89a5a', 1.04, { contorno: 'leve', detalhe: 2 }), elipse(lu - 0.12, 0.2, 0.02, 0.02, ACO.brilho, 1.045, { ...O, detalhe: 3 }), elipse(lu + 0.12, 0.2, 0.02, 0.02, ACO.brilho, 1.045, { ...O, detalhe: 3 }));
  // O quadro: as laterais de ferro fundido verde, as travessas e o peito da frente.
  for (const s of [-1, 1]) bloco(partes, quadro(s * 0.98, 0), 0.14, 1.42, VERDE, 1.1, 0.03);
  for (const v of [-0.7, 0.7]) partes.push(tira([-0.98, v, 0.98, v], 0.07, VERDE.nanquim, 1.05, { contorno: 'leve', detalhe: 2 }), tira([-0.98, v - 0.008, 0.98, v - 0.008], 0.04, v < 0 ? VERDE.luz : VERDE.base, 1.052, { ...O, detalhe: 3 }));
  // Os tacos da lançadeira, de couro, e a polia com a correia que sobe ao eixo do teto (+x).
  for (const s of [-1, 1]) partes.push(tira([s * 0.98, 0.3, s * 1.0, -0.05], 0.035, '#5a3a20', 1.2, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, quadro(1.12, -0.25), 0.1, 0.56, FERRO, 1.15, 0.02);
  partes.push(tira([1.12, -0.25, 1.14, -0.55], 0.12, '#2a1e16', 1.35, { contorno: 'leve', detalhe: 2 }), tira([1.11, -0.27, 1.13, -0.53], 0.04, '#4a3a2a', 1.352, { ...O, alfa: 0.6, detalhe: 3 }));
  return partes;
}

/** Prensa de parafuso (de balancim): a mesa de ferro fundido com a peça sobre a chapa, as colunas e a travessa verde, o parafuso de aço e a barra do balancim com as duas bolas de ferro, girada pela semente. */
function prensa(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, [-0.6, -0.5, 0.6, -0.5, 0.6, 0.5, -0.6, 0.5], 0.01, '#0d0a08', 0.5);
  bloco(partes, ID, 1.15, 0.95, FERRO, 0.75, 0.06);
  // A peça na mesa: chapas empilhadas (papel ou latão) na frente do parafuso.
  const folhas = r() < 0.5;
  for (let k = 0; k < 4; k++) partes.push(poli(retQ(quadro(0.02 * k - 0.03, 0.28, (r() - 0.5) * 0.1), 0, 0, 0.42, 0.24), folhas ? tom('#e6dcc4', -k * 0.04) : tom(LATAO.luz, -k * 0.05), 0.8 + k * 0.004, { contorno: 'leve', detalhe: 2 }));
  // O prato sob o parafuso, as colunas e a travessa.
  disco(partes, 0, -0.05, 0.2, ACO, 0.95);
  for (const s of [-1, 1]) disco(partes, s * 0.45, -0.1, 0.09, VERDE, 1.25);
  bloco(partes, quadro(0, -0.1), 1.08, 0.32, VERDE, 1.3, 0.05);
  partes.push(tira([-0.45, -0.18, 0.45, -0.18], 0.018, LATAO.luz, 1.32, { ...O, alfa: 0.7, detalhe: 3 }));
  // O parafuso e o balancim.
  const a = r() * Math.PI, c = Math.cos(a), s = Math.sin(a), L = 0.68;
  disco(partes, 0, -0.1, 0.1, ACO, 1.36);
  partes.push(tira([-c * L, -0.1 - s * L, c * L, -0.1 + s * L], 0.07, ACO.nanquim, 1.42, { contorno: 'leve', detalhe: 2 }), tira([-c * L, -0.1 - s * L - 0.01, c * L, -0.1 + s * L - 0.01], 0.03, ACO.brilho, 1.422, { ...O, alfa: 0.8, detalhe: 3 }));
  for (const k of [-1, 1]) disco(partes, k * c * L, -0.1 + k * s * L, 0.13, FERRO, 1.44);
  partes.push(tira([c * L, -0.1 + s * L, c * (L + 0.1), -0.1 + s * (L + 0.1) + 0.04], 0.04, MADEIRA.luz, 1.48, { contorno: 'leve', detalhe: 3 }));
  disco(partes, 0, -0.1, 0.05, LATAO, 1.47);
  return partes;
}

/** Tubulação de cobre: dois canos de cobre e um de ferro, com flanges aparafusados, as braçadeiras dos suportes, a válvula de volante, o manômetro, o cotovelo que sai para +y numa ponta e o azinhavre. */
function tubulacaoCobre(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], canos: [number, number, Tons, number][] = [[-0.2, 0.2, COBRE, 0.55], [0.08, 0.14, COBRE, 0.5], [0.27, 0.08, FERRO, 0.45]];
  sombraNoChao(partes, [-C / 2, -0.34, C / 2, -0.34, C / 2, 0.34, -C / 2, 0.34], 0.01, '#0d0a08', 0.35);
  const ex = C / 2 - 0.2;
  for (const [v, w, t, z] of canos) {
    const fim = t === COBRE && w < 0.18 ? ex : C / 2;
    cilindro(partes, -C / 2, v, fim, v, w, w, t, z);
    for (let u = -C / 2 + 0.6 + r() * 0.3; u < fim - 0.3; u += 1.2) { partes.push(poli(retQ(ID, u, v, 0.06, w * 1.5), t.nanquim, z + 0.02, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, u - 0.006, v, 0.04, w * 1.4), t.luz, z + 0.021, { ...O, detalhe: 3 })); for (const k of [-1, 1]) partes.push(elipse(u, v + k * w * 0.6, 0.03, 0.03, FERRO.brilho, z + 0.022, { ...O, detalhe: 3 })); }
    if (t === COBRE) azinhavre(partes, r, 0, v, C * 0.9, w * 0.6, z + 0.012, Math.ceil(C * 1.5));
  }
  // O cotovelo do cano do meio, para +y.
  disco(partes, ex, 0.08, 0.1, COBRE, 0.52);
  cilindro(partes, ex, 0.1, ex, 0.4, 0.14, 0.14, COBRE, 0.5);
  // As braçadeiras dos suportes, por cima dos canos.
  for (let u = -C / 2 + 0.25; u < C / 2; u += 1.5) partes.push(tira([u, -0.33, u, 0.33], 0.06, FERRO.nanquim, 0.62, { contorno: 'leve', detalhe: 2 }), tira([u - 0.008, -0.32, u - 0.008, 0.32], 0.03, FERRO.luz, 0.622, { ...O, detalhe: 3 }));
  // A válvula de volante no cano grosso e o manômetro no do meio.
  const uv = (r() - 0.5) * (C - 1.2);
  bloco(partes, quadro(uv, -0.2), 0.22, 0.28, LATAO, 0.62, 0.03);
  volanteDeValvula(partes, uv, -0.2, 0.14, 0.7, r());
  manometro(partes, r, uv + (r() < 0.5 ? -0.5 : 0.5), 0.08, 0.09, 0.6);
  return partes;
}

/** Painel de manômetros: a chapa verde rebitada com a placa de latão, três manômetros grandes e dois pequenos, o vidro de nível, a régua de canos de cobre que sobe a cada um, a válvula de volante e a alavanca; de cima, a chapa e os manômetros saindo da parede. */
function painelDeManometros(seed: number): { face: Parte[]; topo: Parte[] } {
  const r = mulberry32(seed), face: Parte[] = [], topo: Parte[] = [], W = 1.3;
  face.push(ret(0, 1.5, W + 0.06, 1.0, VERDE.nanquim, 0.01), ret(0, 1.5, W, 0.94, VERDE.base, 0.012, { ...O, detalhe: 1 }), ret(-0.01, 1.52, W - 0.08, 0.86, VERDE.meio, 0.013, { ...S, alfa: 0.6, detalhe: 2 }));
  for (const v of [1.06, 1.94]) rebites(face, -W / 2 + 0.06, v, W / 2 - 0.06, v, 0.1, VERDE, 0.014);
  // A placa de latão com o nome (traços).
  face.push(ret(0, 1.86, 0.5, 0.08, LATAO.nanquim, 0.015), ret(0, 1.86, 0.47, 0.06, LATAO.luz, 0.016, { ...O, detalhe: 2 }));
  for (let k = 0; k < 6; k++) face.push(ret(-0.17 + k * 0.068, 1.86, 0.04, 0.02, TINTA, 0.017, { ...O, alfa: 0.7, detalhe: 3 }));
  // A régua de canos: o coletor embaixo e um cano subindo a cada manômetro.
  const grandes = [-0.4, 0, 0.4], pequenos = [-0.2, 0.2];
  face.push(ret(0, 1.12, W - 0.1, 0.06, COBRE.base, 0.02, { contorno: 'leve' }), ret(0, 1.135, W - 0.12, 0.015, COBRE.brilho, 0.021, { ...O, alfa: 0.7, detalhe: 3 }));
  for (const x of grandes) face.push(ret(x, 1.38, 0.035, 0.5, COBRE.base, 0.022, { contorno: 'leve' }));
  for (const x of pequenos) face.push(ret(x, 1.23, 0.03, 0.2, COBRE.base, 0.022, { contorno: 'leve' }));
  azinhavre(face, r, 0, 1.12, W * 0.8, 0.04, 0.023, 4);
  for (const x of grandes) manometro(face, r, x, 1.62, 0.15, 0.03, 1);
  for (const x of pequenos) manometro(face, r, x, 1.3, 0.08, 0.03, 1);
  // O vidro de nível, a válvula e a alavanca.
  face.push(ret(-0.58, 1.48, 0.07, 0.5, LATAO.base, 0.025, { contorno: 'leve' }), ret(-0.58, 1.48, 0.035, 0.42, '#b8c8c8', 0.026, { ...O, vidro: true, detalhe: 2 }), ret(-0.58, 1.38, 0.03, 0.2 + r() * 0.15, '#5a7a80', 0.027, { ...O, alfa: 0.8, detalhe: 3 }));
  volanteDeValvula(face, 0.5, 1.12, 0.09, 0.04, r());
  const la = Math.PI / 2 + (r() - 0.5) * 0.8;
  face.push(tira([0.58, 1.35, 0.58 + Math.cos(la) * 0.3, 1.35 + Math.sin(la) * 0.3], 0.03, ACO.base, 0.04, { contorno: 'leve', detalhe: 2 }), elipse(0.58 + Math.cos(la) * 0.3, 1.35 + Math.sin(la) * 0.3, 0.06, 0.06, '#1a1410', 0.041, { contorno: 'leve', detalhe: 3 }), elipse(0.58, 1.35, 0.05, 0.05, LATAO.base, 0.042, { contorno: 'leve', detalhe: 3 }));
  // De cima.
  topo.push(ret(0, 0.03, W, 0.06, VERDE.base, 2.0, { contorno: 'leve' }));
  for (const x of grandes) topo.push(elipse(x, 0.1, 0.32, 0.1, LATAO.base, 1.7, { contorno: 'leve' }));
  topo.push(ret(0, 0.09, W - 0.1, 0.06, COBRE.base, 1.15, { contorno: 'leve' }));
  return { face, topo };
}

/**
 * Chaminé industrial redonda, vista de cima: o fuste de tijolo em tronco de cone (cada gomo no tom da luz que recebe), as fiadas e as
 * cintas de ferro, a coroa de pedra, a boca preta de fuligem e, com `fumaca`, a fumaça que sai e vai
 * com o vento. Só o fuste: a base larga ganharia a sombra de 12 m do fuste inteiro.
 */
function chamineIndustrial(seed: number, fumaca: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R0 = 1.35, R1 = 0.95, n = 28;
  sombraNoChao(partes, bolha(0, 0, R0 + 0.05, R0 + 0.05, 20, 0.02, r), 0.01, '#0d0a08', 0.5);
  partes.push(elipse(0.02, 0.025, R0 * 2 + 0.06, R0 * 2 + 0.06, TIJOLO.nanquim, 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2, e = 0.004;
    partes.push(poli([Math.cos(a0 - e) * R0, Math.sin(a0 - e) * R0, Math.cos(a1 + e) * R0, Math.sin(a1 + e) * R0, Math.cos(a1 + e) * R1, Math.sin(a1 + e) * R1, Math.cos(a0 - e) * R1, Math.sin(a0 - e) * R1], tom(tomDaFace(TIJOLO, olhar(am)), (r() - 0.5) * 0.08), 1.22, { ...O, detalhe: 1 }));
  }
  // As fiadas (anéis finos), as juntas desencontradas e as manchas de fuligem.
  for (let k = 1; k < 7; k++) { const rr = R1 + ((R0 - R1) * k) / 7; partes.push(tira(anel(0, 0, rr, rr, 48), 0.008, TIJOLO.nanquim, 1.225, { ...O, alfa: 0.5, detalhe: 3 })); for (let j = 0; j < 30; j++) { const a = ((j + (k % 2) * 0.5) / 30) * Math.PI * 2, r2 = rr + (R0 - R1) / 7; partes.push(tira([Math.cos(a) * rr, Math.sin(a) * rr, Math.cos(a) * Math.min(R0, r2), Math.sin(a) * Math.min(R0, r2)], 0.007, TIJOLO.nanquim, 1.226, { ...O, alfa: 0.35, detalhe: 3 })); } }
  for (let k = 0; k < 8; k++) { const a = r() * 6.28, d = R1 + r() * (R0 - R1); partes.push(poli(bolha(Math.cos(a) * d, Math.sin(a) * d, 0.12, 0.08, 8, 0.4, r, a), '#140c0a', 1.227, { ...S, alfa: 0.3, detalhe: 3 })); }
  for (const rr of [R1 + 0.14, R1 + 0.3]) partes.push(tira(anel(0, 0, rr, rr, 48), 0.035, FERRO.nanquim, 1.23, { ...O, alfa: 0.85, detalhe: 2 }), tira(arco(0, 0, rr - 0.008, rr - 0.008, Math.PI * 0.9, Math.PI * 1.6, 16), 0.012, FERRO.brilho, 1.231, { ...O, alfa: 0.6, detalhe: 3 }));
  // A coroa de pedra, enegrecida de fuligem, a parede grossa do topo e a boca.
  const Rb = R1 * 0.56;
  partes.push(tira(anel(0, 0, R1 + 0.02, R1 + 0.02, 48), 0.07, PEDRA.nanquim, 1.4, { contorno: 'leve', detalhe: 1 }));
  partes.push(poli(anel(0, 0, R1 - 0.02, R1 - 0.02, 48), tom(PEDRA.sombra, -0.15), 1.405, { ...O, detalhe: 1 }));
  partes.push(tira(arco(0, 0, R1 - 0.1, R1 - 0.1, Math.PI * 0.75, Math.PI * 1.75, 24), 0.14, PEDRA.base, 1.407, { ...S, detalhe: 2 }), tira(arco(0, 0, R1 - 0.08, R1 - 0.08, Math.PI * 1.0, Math.PI * 1.5, 16), 0.06, PEDRA.luz, 1.408, { ...S, alfa: 0.7, detalhe: 3 }));
  // O topo da parede de tijolo, entre a coroa e a boca, com as juntas radiais.
  partes.push(poli(anel(0, 0, R1 - 0.2, R1 - 0.2, 48), TIJOLO.sombra, 1.41, { ...O, detalhe: 1 }));
  for (let j = 0; j < 36; j++) { const a = (j / 36) * Math.PI * 2; partes.push(tira([Math.cos(a) * (Rb + 0.02), Math.sin(a) * (Rb + 0.02), Math.cos(a) * (R1 - 0.2), Math.sin(a) * (R1 - 0.2)], 0.008, TIJOLO.nanquim, 1.411, { ...O, alfa: 0.5, detalhe: 3 })); }
  partes.push(tira(anel(0, 0, (Rb + R1 - 0.2) / 2, (Rb + R1 - 0.2) / 2, 40), 0.008, TIJOLO.nanquim, 1.411, { ...O, alfa: 0.5, detalhe: 3 }));
  partes.push(elipse(0, 0, (Rb + 0.1) * 2, (Rb + 0.1) * 2, '#140e0c', 1.415, { ...S, alfa: 0.85, detalhe: 2 }));
  partes.push(elipse(0, 0, Rb * 2, Rb * 2, '#050404', 1.42, { contorno: 'leve', detalhe: 1 }));
  if (fumaca) {
    // A fumaça: rolos escuros que saem da boca e vão com o vento, cada vez maiores e mais ralos (dentro da pegada).
    const va = Math.PI * 0.25 + (r() - 0.5) * 0.5;
    for (let k = 0; k < 6; k++) {
      const t = k / 5, d = 0.25 + t * 0.85, x = Math.cos(va) * d + (r() - 0.5) * 0.12, y = Math.sin(va) * d + (r() - 0.5) * 0.12, R = 0.22 + t * 0.2;
      partes.push(poli(bolha(x, y, R * 1.25, R * 0.9, 14, 0.22, r, va), tom('#3a3836', t * 0.35), 1.45 + k * 0.003, { ...S, alfa: 0.55 - t * 0.3, detalhe: 2 }));
      partes.push(poli(bolha(x + LUZ_X * R * 0.25, y + LUZ_Y * R * 0.25, R * 0.8, R * 0.55, 12, 0.25, r, va), tom('#5a5854', t * 0.3), 1.451 + k * 0.003, { ...S, alfa: 0.35 - t * 0.2, detalhe: 3 }));
    }
  }
  return partes;
}

// ---------- Rua e invenções (Q20b) ----------

const PAPEL = '#e6dcc4', LACA: Tons = { nanquim: '#030304', sombra: '#0c0c10', base: '#16161b', meio: '#202027', luz: '#33333c', brilho: '#7a7a88' };
/** Polígono regular de `n` lados, raio `R`, girado de `giro`. */
const poligono = (x: number, y: number, R: number, n: number, giro = 0): number[] => { const p: number[] = []; for (let k = 0; k < n; k++) { const a = giro + (k / n) * Math.PI * 2; p.push(x + Math.cos(a) * R, y + Math.sin(a) * R); } return p; };

/** Tampa em pirâmide de `n` lados, vista de cima: cada face no tom da luz que recebe, as arestas em nanquim. */
function piramide(partes: Parte[], x: number, y: number, R: number, n: number, t: Tons, z: number, giro = 0): void {
  partes.push(poli(poligono(x + 0.012, y + 0.014, R + 0.025, n, giro), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < n; k++) {
    const a0 = giro + (k / n) * Math.PI * 2, a1 = giro + ((k + 1) / n) * Math.PI * 2;
    partes.push(poli([x, y, x + Math.cos(a0) * R, y + Math.sin(a0) * R, x + Math.cos(a1) * R, y + Math.sin(a1) * R], tomDaFace(t, olhar((a0 + a1) / 2)), z + 0.003, { ...O, detalhe: 1 }));
    partes.push(tira([x, y, x + Math.cos(a0) * R, y + Math.sin(a0) * R], 0.008, t.nanquim, z + 0.004, { ...O, alfa: 0.6, detalhe: 3 }));
  }
}

/** Faísca: um raio em zigue-zague de (ax, ay) a (bx, by), com o halo violeta e o miolo branco, os dois somando luz; às vezes um galho. */
function faisca(partes: Parte[], r: () => number, ax: number, ay: number, bx: number, by: number, z: number, galho = true): void {
  const n = 7, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts: number[] = [ax, ay];
  for (let k = 1; k < n; k++) { const t = k / n, d = (r() - 0.5) * L * 0.22; pts.push(ax + dx * t + nx * d, ay + dy * t + ny * d); }
  pts.push(bx, by);
  partes.push(tira(pts, 0.09, '#5a3cff', z, { ...O, brilho: true, alfa: 0.45, desfoque: 0.05, detalhe: 2 }, 0.3));
  partes.push(tira(pts, 0.022, '#f2eeff', z + 0.002, { ...O, brilho: true, detalhe: 2 }, 0.2));
  if (galho) { const i = 2 + Math.floor(r() * 3) * 2, gx = pts[i]!, gy = pts[i + 1]!, a = Math.atan2(dy, dx) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.4), l = L * (0.25 + r() * 0.2); faisca(partes, r, gx, gy, gx + Math.cos(a) * l, gy + Math.sin(a) * l, z + 0.001, false); }
}

/**
 * Lampião a gás de rua: o pé de ferro fundido canelado, a escora da escada do acendedor saindo dos dois lados, a lanterna sextavada
 * com os vidros acesos (somam luz e brilham à noite) e a tampa em pirâmide com o respiro e o pináculo. Traz a luz `lampiao-a-gas`.
 */
function lampiaoAGas(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = r() < 0.6 ? FERRO : VERDE, giro = Math.PI / 6 + (r() - 0.5) * 0.3;
  sombraNoChao(partes, poligono(0, 0, 0.27, 8), 0.01, '#0d0a08', 0.45);
  // O pé: o octógono da base, os gomos canelados e o anel do fuste.
  partes.push(poli(poligono(0.012, 0.014, 0.28, 8, Math.PI / 8), t.nanquim, 0.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 8; k++) { const a0 = Math.PI / 8 + (k / 8) * Math.PI * 2, a1 = a0 + Math.PI / 4; partes.push(poli([Math.cos(a0) * 0.12, Math.sin(a0) * 0.12, Math.cos(a0) * 0.26, Math.sin(a0) * 0.26, Math.cos(a1) * 0.26, Math.sin(a1) * 0.26, Math.cos(a1) * 0.12, Math.sin(a1) * 0.12], tomDaFace(t, olhar((a0 + a1) / 2)), 0.303, { ...O, detalhe: 1 })); }
  disco(partes, 0, 0, 0.1, t, 0.9);
  // A escora da escada, por baixo da lanterna.
  const ex = Math.cos(giro + Math.PI / 2), ey = Math.sin(giro + Math.PI / 2);
  partes.push(tira([-ex * 0.36, -ey * 0.36, ex * 0.36, ey * 0.36], 0.04, t.nanquim, 1.3, { contorno: 'leve', detalhe: 2 }), tira([-ex * 0.35, -ey * 0.35 - 0.006, ex * 0.35, ey * 0.35 - 0.006], 0.016, t.brilho, 1.302, { ...O, alfa: 0.6, detalhe: 3 }));
  for (const s of [-1, 1]) partes.push(elipse(s * ex * 0.36, s * ey * 0.36, 0.06, 0.06, t.luz, 1.305, { contorno: 'leve', detalhe: 3 }));
  // A aura dos vidros acesos e a lanterna: o aro, os seis vidros e os montantes.
  partes.push(elipse(0, 0, 0.66, 0.66, '#ffcf7a', 1.36, { ...O, brilho: true, alfa: 0.3, desfoque: 0.1, detalhe: 2 }));
  partes.push(poli(poligono(0.01, 0.012, 0.25, 6, giro), t.nanquim, 1.38, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < 6; k++) {
    const a0 = giro + (k / 6) * Math.PI * 2, a1 = a0 + Math.PI / 3, e = 0.05;
    partes.push(poli([Math.cos(a0 + e) * 0.225, Math.sin(a0 + e) * 0.225, Math.cos(a1 - e) * 0.225, Math.sin(a1 - e) * 0.225, Math.cos(a1 - e * 1.6) * 0.15, Math.sin(a1 - e * 1.6) * 0.15, Math.cos(a0 + e * 1.6) * 0.15, Math.sin(a0 + e * 1.6) * 0.15], '#d8a04a', 1.384, { ...O, brilho: true, alfa: 0.9, detalhe: 1 }));
    partes.push(poli([Math.cos(a0 + e * 2) * 0.2, Math.sin(a0 + e * 2) * 0.2, Math.cos(a1 - e * 2) * 0.2, Math.sin(a1 - e * 2) * 0.2, Math.cos(a1 - e * 2.6) * 0.16, Math.sin(a1 - e * 2.6) * 0.16, Math.cos(a0 + e * 2.6) * 0.16, Math.sin(a0 + e * 2.6) * 0.16], '#fff0c0', 1.386, { ...O, brilho: true, alfa: 0.7, detalhe: 2 }));
  }
  piramide(partes, 0, 0, 0.15, 6, t, 1.42, giro);
  disco(partes, 0, 0, 0.045, t, 1.46);
  partes.push(elipse(-0.01, -0.012, 0.025, 0.025, t.brilho, 1.48, { ...O, alfa: 0.8, detalhe: 3 }));
  return partes;
}

/**
 * Banca de jornal: a cabine de madeira pintada atrás (−y) com o telhado de zinco ondulado, o lambrequim recortado e a placa;
 * na frente (+y), o balcão com as pilhas de jornal dobrado e as revistas em leque, o cavalete de manchetes e um fardo amarrado no chão.
 */
function bancaDeJornal(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = tonsDe(['#2a4a3a', '#6a1e18', '#1e2e4a'][Math.floor(r() * 3)]!), W = 2.0;
  sombraNoChao(partes, [-W / 2, -0.78, W / 2, -0.78, W / 2, 0.5, -W / 2, 0.5], 0.01, '#0d0a08', 0.4);
  // O balcão e as pilhas de jornal.
  bloco(partes, quadro(0, 0.22), W - 0.1, 0.5, MADEIRA, 0.9, 0.04);
  for (let u = -W / 2 + 0.28; u < W / 2 - 0.2; u += 0.34 + r() * 0.06) {
    const f = quadro(u, 0.22 + (r() - 0.5) * 0.06, (r() - 0.5) * 0.25), n = 2 + Math.floor(r() * 3);
    if (r() < 0.25) {
      // Revistas em leque.
      for (let k = 0; k < 3; k++) { const g = quadro(...f(-0.04 + k * 0.04, 0), -0.3 + k * 0.3); partes.push(poli(retQ(g, 0, 0, 0.2, 0.27), ['#a8281a', '#2a5a8a', '#d8b040', '#3a6a3a'][Math.floor(r() * 4)]!, 0.95 + k * 0.004, { contorno: 'leve', detalhe: 2 }), poli(retQ(g, 0, -0.08, 0.16, 0.05), PAPEL, 0.951 + k * 0.004, { ...O, alfa: 0.8, detalhe: 3 })); }
      continue;
    }
    for (let k = 0; k < n; k++) partes.push(poli(retQ(quadro(...f(0.006 * k, -0.006 * k), (r() - 0.5) * 0.08), 0, 0, 0.27, 0.36), tom(PAPEL, -0.12 + k * 0.04), 0.93 + k * 0.006, { contorno: 'leve', detalhe: 2 }));
    const z = 0.93 + n * 0.006;
    partes.push(poli(retQ(f, 0, -0.12, 0.22, 0.05), TINTA, z, { ...O, alfa: 0.85, detalhe: 2 }));
    for (let v = -0.06; v < 0.15; v += 0.035) partes.push(tira(em(f, [-0.1, v, -0.01, v]), 0.012, TINTA, z + 0.001, { ...O, alfa: 0.45, detalhe: 3 }), tira(em(f, [0.01, v, 0.1, v]), 0.012, TINTA, z + 0.001, { ...O, alfa: 0.45, detalhe: 3 }));
    if (r() < 0.5) partes.push(ret(...f(0.04, 0.04), 0.07, 0.06, '#5a5a5a', z + 0.001, { ...O, alfa: 0.6, detalhe: 3 }));
    if (r() < 0.4) partes.push(tira(em(f, [0, -0.19, 0, 0.19]), 0.01, '#8a6a3a', z + 0.002, { ...O, detalhe: 3 }), tira(em(f, [-0.14, 0, 0.14, 0]), 0.01, '#8a6a3a', z + 0.002, { ...O, detalhe: 3 }));
  }
  // A cabine: o telhado de zinco ondulado, pintado, caindo para a frente.
  bloco(partes, quadro(0, -0.4), W, 0.76, t, 1.4, 0.05);
  for (let u = -W / 2 + 0.06, k = 0; u < W / 2 - 0.03; u += 0.07, k++) partes.push(tira([u, -0.74, u, -0.06], 0.03, k % 2 ? t.luz : t.sombra, 1.41, { ...O, alfa: 0.5, detalhe: 3 }));
  partes.push(tira([-W / 2, -0.76, W / 2, -0.76], 0.05, t.brilho, 1.412, { ...O, alfa: 0.6, detalhe: 3 }));
  // O lambrequim recortado na beira da frente.
  for (let u = -W / 2 + 0.06; u < W / 2; u += 0.12) partes.push(elipse(u, -0.02, 0.1, 0.1, t.base, 1.395, { contorno: 'leve', detalhe: 3 }));
  // A placa no alto: o fundo creme e as letras.
  partes.push(poli(retQ(ID, 0, -0.28, 1.2, 0.2), LATAO.nanquim, 1.42, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0, -0.28, 1.14, 0.15), '#e8dcbc', 1.422, { ...O, detalhe: 2 }));
  for (let k = 0; k < 7; k++) partes.push(ret(-0.42 + k * 0.14, -0.28, 0.09, 0.07, VERMELHO, 1.423, { ...O, alfa: 0.85, detalhe: 3 }));
  // O cavalete de manchetes, na calçada (+y, de lado): as duas tábuas que se encontram na cumeeira.
  const cf = quadro(W / 2 - 0.25, 0.68, (r() - 0.5) * 0.4);
  partes.push(poli(retQ(cf, 0, 0, 0.56, 0.3), MADEIRA.nanquim, 0.7, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(cf, 0, -0.07, 0.52, 0.13), MADEIRA.luz, 0.705, { ...O, detalhe: 2 }), poli(retQ(cf, 0, 0.07, 0.52, 0.13), MADEIRA.sombra, 0.705, { ...O, detalhe: 2 }));
  partes.push(tira(em(cf, [-0.26, 0, 0.26, 0]), 0.02, MADEIRA.brilho, 0.71, { ...O, alfa: 0.7, detalhe: 3 }));
  // O fardo de jornais amarrado, no chão.
  if (r() < 0.8) { const bf = quadro(-W / 2 + 0.3, 0.7, (r() - 0.5) * 0.6); bloco(partes, bf, 0.4, 0.3, tonsDe(PAPEL), 0.25, 0.02); partes.push(tira(em(bf, [-0.2, 0, 0.2, 0]), 0.015, '#6a4a2a', 0.28, { ...O, detalhe: 3 }), tira(em(bf, [0, -0.15, 0, 0.15]), 0.015, '#6a4a2a', 0.28, { ...O, detalhe: 3 })); }
  return partes;
}

/**
 * Carruagem fechada (berlinda de um cavalo): a caixa de laca preta com o friso de cor e o filete dourado, o teto de couro lustroso,
 * o vidro curvo da frente, as duas lanternas de latão, a boleia (+x) com o banco, a manta e o chicote no suporte, as rodas (as de trás
 * maiores) e os dois varais. Sem cavalo: o `cavalo` se põe entre os varais.
 */
function carruagemFechada(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = ['#5a1418', '#1e3a2a', '#1a2440', '#3a2a18'][Math.floor(r() * 4)]!, o = -0.45, f = quadro(o, 0);
  sombraNoChao(partes, em(f, [-1.3, -0.85, 1.45, -0.85, 1.45, 0.85, -1.3, 0.85]), 0.01, '#0d0a08', 0.4);
  // Os varais, que vão ao cavalo, com as ponteiras de latão.
  for (const s of [-1, 1]) {
    const pts = em(f, [0.95, s * 0.42, 1.7, s * 0.36, 2.35, s * 0.33]);
    partes.push(tira(pts, 0.07, LACA.nanquim, 0.7, { contorno: 'leve', detalhe: 2 }), tira(pts.map((v, i) => (i % 2 ? v - 0.008 : v)), 0.035, tonsDe(cor).luz, 0.702, { ...O, detalhe: 3 }));
    partes.push(elipse(...f(2.35, s * 0.33), 0.06, 0.06, LATAO.luz, 0.71, { contorno: 'leve', detalhe: 3 }));
  }
  // As rodas, de raios pintados na cor da caixa.
  for (const s of [-1, 1]) { roda(partes, f, -0.55, s * 0.76, 1.3, 0.09, 0.5, s, cor); roda(partes, f, 0.95, s * 0.66, 0.95, 0.08, 0.5, s, cor); }
  // A plataforma de trás e o estribo.
  bloco(partes, quadro(o - 1.1, 0), 0.22, 0.9, LACA, 0.75, 0.02);
  // A boleia: o pé, o banco com a almofada e a manta, o chicote.
  bloco(partes, quadro(o + 1.08, 0), 0.36, 0.95, LACA, 1.0, 0.03);
  bloco(partes, quadro(o + 0.75, 0), 0.4, 1.05, LACA, 1.3, 0.03);
  estofado(partes, ID, 0, o + 0.75, 0, 0.3, 0.92, '#6a2a1e', 1.33);
  if (r() < 0.7) partes.push(poli(retR(quadro(o + 0.76, 0.2, (r() - 0.5) * 0.2), 0, 0, 0.34, 0.45, 0.05), ['#2a4a3a', '#6a5a3a', '#3a2a4a'][Math.floor(r() * 3)]!, 1.36, { contorno: 'leve', detalhe: 2 }));
  partes.push(elipse(...f(0.98, -0.42), 0.06, 0.06, LATAO.base, 1.38, { contorno: 'leve', detalhe: 3 }), tira([...f(0.98, -0.42), ...f(1.3, -0.62), ...f(1.7, -0.6), ...f(2.1, -0.5)], 0.015, '#2a1e14', 1.4, { ...O, detalhe: 3 }, 0.3));
  // A caixa: a laca, o friso de cor e o filete dourado, o vidro curvo da frente.
  bloco(partes, quadro(o - 0.35, 0), 1.45, 1.22, LACA, 1.35, 0.06);
  partes.push(tira([...retR(quadro(o - 0.35, 0), 0, 0, 1.33, 1.1, 0.1), ...retR(quadro(o - 0.35, 0), 0, 0, 1.33, 1.1, 0.1).slice(0, 2)], 0.06, cor, 1.36, { ...O, detalhe: 2 }));
  partes.push(tira([...retR(quadro(o - 0.35, 0), 0, 0, 1.24, 1.0, 0.1), ...retR(quadro(o - 0.35, 0), 0, 0, 1.24, 1.0, 0.1).slice(0, 2)], 0.012, LATAO.luz, 1.362, { ...O, alfa: 0.8, detalhe: 3 }));
  partes.push(tira(arco(...f(0.15, 0), 0.22, 0.52, -1.3, 1.3, 10), 0.08, '#4a5a62', 1.37, { ...O, vidro: true, detalhe: 2 }), tira(arco(...f(0.16, -0.08), 0.2, 0.36, -1.2, -0.2, 6), 0.02, '#c8d8e0', 1.372, { ...O, alfa: 0.6, detalhe: 3 }));
  // O teto de couro, lustroso, com o reflexo do lado da luz.
  partes.push(poli(retR(quadro(o - 0.4, 0), 0, 0, 1.15, 0.98, 0.22), '#121216', 1.4, { contorno: 'leve', detalhe: 1 }));
  partes.push(poli(retR(quadro(o - 0.43, -0.12), 0, 0, 0.95, 0.5, 0.2), '#26262e', 1.402, { ...S, desfoque: 0.08, detalhe: 2 }), lente(o - 0.85, -0.3, 0, 0.75, 0.07, '#8a8a98', 1.404, { ...S, alfa: 0.55, detalhe: 3 }));
  for (const u of [-0.82, -0.4, 0.02]) partes.push(tira(em(f, [u, -0.46, u, 0.46]), 0.01, '#050506', 1.403, { ...O, alfa: 0.5, detalhe: 3 }));
  // As lanternas de latão nos cantos da frente.
  for (const s of [-1, 1]) { disco(partes, ...f(0.4, s * 0.66), 0.075, LATAO, 1.42); partes.push(elipse(...f(0.4, s * 0.66), 0.07, 0.07, '#f0e4b8', 1.44, { ...O, vidro: true, detalhe: 3 })); }
  return partes;
}

/**
 * Relógio de rua: o pedestal de ferro fundido, o fuste, e no alto a caixa redonda de dois mostradores com a coroa e o pináculo;
 * o mostrador da frente (+y), de pé, é desenhado um pouco de frente (como o volante), com os números, os ponteiros e o aro de latão.
 */
function relogioDeRua(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = r() < 0.5 ? VERDE : FERRO;
  sombraNoChao(partes, poligono(0, 0, 0.36, 8), 0.01, '#0d0a08', 0.45);
  // O pedestal: o degrau de pedra, o pé octogonal e o fuste.
  bloco(partes, ID, 0.8, 0.8, PEDRA, 0.15, 0.04);
  partes.push(poli(poligono(0.012, 0.014, 0.34, 8, Math.PI / 8), t.nanquim, 0.5, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 8; k++) { const a0 = Math.PI / 8 + (k / 8) * Math.PI * 2, a1 = a0 + Math.PI / 4; partes.push(poli([Math.cos(a0) * 0.16, Math.sin(a0) * 0.16, Math.cos(a0) * 0.32, Math.sin(a0) * 0.32, Math.cos(a1) * 0.32, Math.sin(a1) * 0.32, Math.cos(a1) * 0.16, Math.sin(a1) * 0.16], tomDaFace(t, olhar((a0 + a1) / 2)), 0.503, { ...O, detalhe: 1 })); }
  disco(partes, 0, -0.04, 0.12, t, 1.0);
  // A caixa: a faixa redonda vista de cima, ao longo de x.
  const fy = 0.1, Rx = 0.36, Ry = Rx * 0.45;
  partes.push(poli(retR(ID, 0, -0.1, 0.8, 0.3, 0.12), t.nanquim, 1.4, { contorno: 'leve', detalhe: 1 }), poli(retR(ID, 0, -0.1, 0.76, 0.26, 0.11), t.base, 1.402, { ...O, detalhe: 1 }), poli(retR(ID, 0, -0.14, 0.72, 0.1, 0.05), t.luz, 1.404, { ...S, detalhe: 2 }));
  // O mostrador da frente: o aro de latão, o esmalte, os números, os ponteiros.
  partes.push(elipse(0, fy, Rx * 2 + 0.06, Ry * 2 + 0.05, LATAO.nanquim, 1.43, { contorno: 'leve', detalhe: 1 }), elipse(0, fy, Rx * 2 + 0.02, Ry * 2 + 0.02, LATAO.base, 1.432, { ...O, detalhe: 1 }));
  partes.push(tira(arco(0, fy, Rx + 0.005, Ry + 0.005, Math.PI * 1.0, Math.PI * 1.6, 10), 0.015, LATAO.brilho, 1.433, { ...O, alfa: 0.8, detalhe: 3 }));
  partes.push(elipse(0, fy, Rx * 1.78, Ry * 1.78, MOSTRADOR, 1.434, { ...O, detalhe: 1 }));
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2, l = k % 3 === 0 ? 0.2 : 0.1; partes.push(tira([Math.cos(a) * Rx * 0.8, fy + Math.sin(a) * Ry * 0.8, Math.cos(a) * Rx * (0.8 - l), fy + Math.sin(a) * Ry * (0.8 - l)], 0.016, TINTA, 1.435, { ...O, detalhe: 3 })); }
  const h = r() * Math.PI * 2, m = r() * Math.PI * 2;
  partes.push(tira([0, fy, Math.cos(h) * Rx * 0.45, fy + Math.sin(h) * Ry * 0.45], 0.022, TINTA, 1.436, { ...O, detalhe: 3 }, 0.5), tira([0, fy, Math.cos(m) * Rx * 0.68, fy + Math.sin(m) * Ry * 0.68], 0.014, TINTA, 1.437, { ...O, detalhe: 3 }, 0.4));
  partes.push(elipse(0, fy, 0.03, 0.025, LATAO.luz, 1.438, { ...O, detalhe: 3 }), elipse(-Rx * 0.35, fy - Ry * 0.4, Rx * 0.6, Ry * 0.35, '#ffffff', 1.439, { ...S, alfa: 0.3, detalhe: 3 }));
  // A coroa e o pináculo em cima da caixa.
  disco(partes, 0, -0.1, 0.1, t, 1.45);
  disco(partes, 0, -0.1, 0.04, LATAO, 1.49);
  return partes;
}

/**
 * Dirigível ancorado: o envelope de lona dopada (fuso com o nariz rombudo e a cauda fina), as costuras dos gomos e as cintas, a rede
 * de cordas, o nariz de latão preso ao mastro, as quatro aletas da cauda (as de lado e a de cima), os dois motores nos braços com as
 * hélices; e o mastro de amarração de treliça com a plataforma, e os cabos aos espeques no chão.
 */
function dirigivel(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = tonsDe(['#b4aa92', '#8a4a32', '#6e7478'][Math.floor(r() * 3)]!), cx = -1.0, L = 11.2, R = 1.85, xm = 5.8;
  // O contorno do fuso: meia-largura em u (−1 cauda, 1 nariz).
  const meia = (u: number): number => R * Math.pow(Math.max(0, 1 - Math.abs(u) ** (u > 0 ? 2.6 : 1.7)), 1 / (u > 0 ? 2.6 : 1.7));
  const X = (u: number): number => cx + (u * L) / 2;
  const contorno = (k: number, dy = 0, u0 = -1, u1 = 1, n = 40): number[] => { const a: number[] = [], b: number[] = []; for (let i = 0; i <= n; i++) { const u = u0 + ((u1 - u0) * i) / n, w = meia(u) * k; a.push(X(u), dy - w); b.push(X(u), dy + w); } return [...a, ...inverter(b)]; };
  const linha = (fr: number, u0 = -0.97, u1 = 0.97, n = 30): number[] => { const p: number[] = []; for (let i = 0; i <= n; i++) { const u = u0 + ((u1 - u0) * i) / n; p.push(X(u), meia(u) * fr); } return p; };
  // O mastro de amarração: as quatro pernas, os contraventos, a plataforma e a escada.
  const B = 0.6;
  sombraNoChao(partes, [xm - B - 0.1, -B - 0.1, xm + B + 0.1, -B - 0.1, xm + B + 0.1, B + 0.1, xm - B - 0.1, B + 0.1], 0.01, '#0d0a08', 0.4);
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { partes.push(tira([xm + su * B, sv * B, xm + su * 0.3, sv * 0.3], 0.07, FERRO.nanquim, 1.0, { contorno: 'leve', detalhe: 1 }), tira([xm + su * B, sv * B, xm + su * 0.3, sv * 0.3], 0.035, tomDaFace(FERRO, olhar(Math.atan2(sv, su))), 1.002, { ...O, detalhe: 2 })); partes.push(ret(xm + su * B, sv * B, 0.16, 0.16, PEDRA.base, 0.05, { contorno: 'leve', detalhe: 2 })); }
  for (const k of [0.85, 0.62]) partes.push(tira([xm - B * k, -B * k, xm + B * k, -B * k, xm + B * k, B * k, xm - B * k, B * k, xm - B * k, -B * k], 0.025, FERRO.base, 0.9, { ...O, alfa: 0.85, detalhe: 3 }));
  for (const s of [-1, 1]) partes.push(tira([xm - B * 0.85, -B * 0.85 * s, xm + B * 0.62, B * 0.62 * s], 0.018, FERRO.sombra, 0.88, { ...O, alfa: 0.8, detalhe: 3 }));
  bloco(partes, quadro(xm, 0), 0.7, 0.7, FERRO, 1.45, 0.04);
  partes.push(tira([xm - 0.35, -0.35, xm + 0.35, -0.35, xm + 0.35, 0.35, xm - 0.35, 0.35, xm - 0.35, -0.35], 0.02, LATAO.luz, 1.47, { ...O, alfa: 0.8, detalhe: 3 }));
  for (let v = -0.3; v <= 0.3; v += 0.1) partes.push(tira([xm + 0.62, v, xm + 0.78, v], 0.015, MADEIRA.luz, 0.6, { contorno: 'leve', detalhe: 3 }));
  // Os cabos de amarração aos espeques no chão.
  for (const [u, s] of [[-0.5, -1], [-0.5, 1], [0.35, -1], [0.35, 1]] as const) {
    const ax = X(u), ay = s * meia(u) * 0.85, bx = ax + (r() - 0.5) * 0.6, by = s * 2.55;
    partes.push(tira([ax, ay, (ax + bx) / 2, (ay + by) / 2 + s * 0.08, bx, by], 0.025, '#4a3a26', 0.5, { contorno: 'leve', detalhe: 3 }, 0.6), elipse(bx, by, 0.1, 0.1, MADEIRA.base, 0.1, { contorno: 'leve', detalhe: 3 }));
  }
  // As aletas de lado da cauda, por baixo do envelope.
  const ua = -0.86;
  for (const s of [-1, 1]) {
    const pts = [X(ua - 0.12), s * meia(ua - 0.12) * 0.9, X(ua + 0.06), s * meia(ua + 0.06) * 0.92, X(ua - 0.06), s * (R + 0.55), X(ua - 0.15), s * (R + 0.6)];
    partes.push(poli(pts, t.nanquim, 1.36, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(pts.map((v, i) => (i % 2 ? v * 0.97 : v + 0.04)), s < 0 ? t.luz : t.sombra, 1.362, { ...O, detalhe: 1 }));
    for (const k of [0.3, 0.6]) partes.push(tira([X(ua - 0.04 * k), s * (meia(ua) + 0.1), X(ua - 0.08 - 0.05 * k), s * (R + 0.5 * k + 0.05)], 0.012, t.nanquim, 1.364, { ...O, alfa: 0.5, detalhe: 3 }));
    partes.push(poli([X(ua - 0.14), s * (R + 0.2), X(ua - 0.15), s * (R + 0.6), X(ua - 0.06), s * (R + 0.55), X(ua - 0.07), s * (R + 0.2)], VERMELHO, 1.363, { ...O, alfa: 0.85, detalhe: 2 }));
  }
  // Os motores: os braços, as naceles de cobre e as hélices girando.
  const um = -0.12;
  for (const s of [-1, 1]) {
    const y = s * (R + 0.42);
    partes.push(tira([X(um), s * meia(um) * 0.8, X(um), y], 0.06, FERRO.nanquim, 1.33, { contorno: 'leve', detalhe: 2 }), tira([X(um + 0.06), s * meia(um + 0.06) * 0.8, X(um), y], 0.04, FERRO.base, 1.332, { contorno: 'leve', detalhe: 3 }));
    cilindro(partes, X(um) + 0.5, y, X(um) - 0.5, y, 0.34, 0.26, COBRE, 1.34);
    rebites(partes, X(um) + 0.3, y, X(um) - 0.3, y, 0.15, COBRE, 1.36);
    const hx = X(um) - 0.58;
    partes.push(elipse(hx, y, 0.14, 0.95, '#2a2620', 1.37, { ...S, alfa: 0.3, detalhe: 2 }), tira([hx, y - 0.46, hx, y + 0.46], 0.07, MADEIRA.base, 1.372, { contorno: 'leve', detalhe: 2 }, 0.5), elipse(hx, y, 0.1, 0.1, LATAO.luz, 1.375, { contorno: 'leve', detalhe: 3 }));
  }
  // O envelope: o nanquim, a base e os degraus de volume para o lado da luz (−y).
  partes.push(poli(contorno(1.02, 0.03), t.nanquim, 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(contorno(1), t.sombra, 1.402, { ...O, detalhe: 1 }));
  partes.push(poli(contorno(0.35, 1.2, -0.9, 0.92), tom(t.sombra, -0.25), 1.403, { ...S, alfa: 0.7, desfoque: 0.15, detalhe: 2 }));
  partes.push(poli(contorno(0.74, -0.26), t.base, 1.404, { ...S, desfoque: 0.15, detalhe: 1 }));
  partes.push(poli(contorno(0.5, -0.55, -0.95, 0.96), t.meio, 1.406, { ...S, desfoque: 0.15, detalhe: 1 }));
  partes.push(poli(contorno(0.26, -0.95, -0.85, 0.9), t.luz, 1.408, { ...S, desfoque: 0.12, detalhe: 2 }));
  partes.push(poli(contorno(0.08, -1.25, -0.6, 0.8), t.brilho, 1.41, { ...S, alfa: 0.7, desfoque: 0.08, detalhe: 3 }));
  // As costuras dos gomos, ao longo, e as cintas, de través.
  for (const fr of [-0.72, -0.4, 0, 0.4, 0.72]) partes.push(tira(linha(fr), 0.014, t.nanquim, 1.42, { ...O, alfa: 0.45, detalhe: 3 }));
  for (let u = -0.86; u < 0.92; u += 0.13) partes.push(tira(arco(X(u) - 0.12, 0, 0.12, meia(u) * 0.96, -Math.PI / 2, Math.PI / 2, 10), 0.03, t.nanquim, 1.421, { ...O, alfa: 0.3, detalhe: 3 }));
  // A rede de cordas, em losangos.
  for (let k = -6; k <= 6; k++) for (const s of [-1, 1]) { const u0 = -0.7 + k * 0.12, p: number[] = []; for (let i = 0; i <= 6; i++) { const u = u0 + s * i * 0.04; if (Math.abs(u) > 0.9) break; p.push(X(u), meia(u) * (-0.85 + (i / 6) * 1.7)); } if (p.length >= 4) partes.push(tira(p, 0.012, '#3a2a18', 1.425, { ...O, alfa: 0.35, detalhe: 3 })); }
  // A aleta de cima, de pé ao longo do eixo, e o nariz de latão no mastro.
  partes.push(poli([X(-0.98), -0.06, X(-0.7), -0.05, X(-0.7), 0.05, X(-0.98), 0.06], t.nanquim, 1.47, { contorno: 'leve', detalhe: 2 }), tira([X(-0.97), -0.015, X(-0.71), -0.015], 0.03, t.brilho, 1.472, { ...O, alfa: 0.7, detalhe: 3 }), poli([X(-0.98), -0.06, X(-0.9), -0.06, X(-0.9), 0.06, X(-0.98), 0.06], VERMELHO, 1.473, { ...O, detalhe: 2 }));
  disco(partes, X(0.985), 0, 0.22, LATAO, 1.44, 0.3);
  partes.push(tira([X(1), 0, xm - 0.2, 0], 0.08, FERRO.nanquim, 1.48, { contorno: 'leve', detalhe: 2 }), tira([X(1), -0.01, xm - 0.2, -0.01], 0.03, FERRO.brilho, 1.482, { ...O, alfa: 0.7, detalhe: 3 }));
  disco(partes, xm, 0, 0.16, LATAO, 1.485);
  return partes;
}

/**
 * Autômato a vapor, de pé, olhando para +y: a caldeira de latão ou cobre do tronco com os rebites e o mostrador do peito, a fornalha
 * nas costas com a chaminé e o fio de vapor, a chave de corda, os ombros, os braços articulados com as pinças, os pés de ferro e a
 * cabeça em domo com a viseira e os dois olhos acesos.
 */
function automato(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = r() < 0.5 ? LATAO : COBRE, olho = r() < 0.5 ? '#ffb040' : '#60e0ff';
  sombraNoChao(partes, bolha(0, 0, 0.36, 0.28, 12, 0.05, r), 0.01, '#0d0a08', 0.45);
  // Os pés.
  for (const s of [-1, 1]) bloco(partes, quadro(s * 0.13, 0.12), 0.14, 0.26, FERRO, 0.12, 0.02);
  // A chave de corda nas costas.
  partes.push(tira([0, -0.25, 0, -0.38], 0.03, LATAO.sombra, 1.15, { contorno: 'leve', detalhe: 3 }));
  for (const s of [-1, 1]) partes.push(elipse(s * 0.06, -0.4, 0.1, 0.06, LATAO.base, 1.16, { contorno: 'leve', detalhe: 3 }), elipse(s * 0.06, -0.4, 0.04, 0.02, LATAO.nanquim, 1.162, { ...O, detalhe: 3 }));
  // Os braços: do ombro ao cotovelo, do cotovelo à pinça.
  const ang = (r() - 0.5) * 0.4;
  for (const s of [-1, 1]) {
    const ox = s * 0.27, oy = -0.02, cxo = s * 0.33, cyo = 0.08 + s * ang * 0.1, px = s * 0.29, py = 0.24 + s * ang * 0.15;
    partes.push(tira([ox, oy, cxo, cyo], 0.07, ACO.nanquim, 1.0, { contorno: 'leve', detalhe: 2 }), tira([ox, oy, cxo, cyo], 0.04, ACO.base, 1.002, { ...O, detalhe: 3 }));
    partes.push(tira([cxo, cyo, px, py], 0.06, ACO.nanquim, 1.05, { contorno: 'leve', detalhe: 2 }), tira([cxo - 0.008, cyo, px - 0.008, py], 0.03, ACO.luz, 1.052, { ...O, detalhe: 3 }));
    disco(partes, cxo, cyo, 0.045, t, 1.06);
    for (const k of [-1, 1]) partes.push(lente(px, py, Math.PI / 2 + k * 0.35, 0.11, 0.04, FERRO.luz, 1.07, { contorno: 'leve', detalhe: 3 }));
  }
  // O tronco: a caldeira, as cintas rebitadas e o mostrador do peito.
  disco(partes, 0, 0, 0.23, t, 1.2);
  partes.push(tira(anel(0, 0, 0.2, 0.2, 24), 0.02, t.nanquim, 1.215, { ...O, alfa: 0.5, detalhe: 3 }));
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; partes.push(elipse(Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.025, 0.025, t.brilho, 1.216, { ...O, alfa: 0.8, detalhe: 3 })); }
  // A fornalha nas costas, a chaminé e o vapor.
  disco(partes, 0, -0.2, 0.12, FERRO, 1.3);
  partes.push(elipse(0.06, -0.24, 0.06, 0.04, '#c0400c', 1.32, { ...O, brilho: true, alfa: 0.7, detalhe: 3 }));
  disco(partes, -0.07, -0.25, 0.04, FERRO, 1.38);
  partes.push(elipse(-0.07, -0.25, 0.04, 0.04, '#050505', 1.42, { ...O, detalhe: 3 }));
  for (let k = 0; k < 3; k++) partes.push(poli(bolha(-0.12 - k * 0.07, -0.3 - k * 0.06, 0.05 + k * 0.025, 0.04 + k * 0.02, 10, 0.25, r), '#d8d8d4', 1.43 + k * 0.002, { ...S, alfa: 0.35 - k * 0.08, detalhe: 3 }));
  // Os ombros.
  for (const s of [-1, 1]) disco(partes, s * 0.24, -0.02, 0.08, t, 1.33);
  // A cabeça: o domo, a viseira da frente e os olhos acesos.
  disco(partes, 0, 0.04, 0.12, t, 1.4);
  partes.push(tira(arco(0, 0.04, 0.115, 0.115, Math.PI * 0.15, Math.PI * 0.85, 10), 0.04, FERRO.nanquim, 1.45, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(elipse(s * 0.045, 0.14, 0.05, 0.035, olho, 1.46, { ...O, brilho: true, detalhe: 3 }), elipse(s * 0.045, 0.15, 0.1, 0.08, olho, 1.459, { ...O, brilho: true, alfa: 0.5, desfoque: 0.03, detalhe: 3 }));
  partes.push(tira([0, -0.02, 0, -0.08], 0.015, t.sombra, 1.47, { ...O, detalhe: 3 }), elipse(0, -0.09, 0.03, 0.03, t.brilho, 1.48, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/**
 * Bancada de inventor: o tampo de mogno, a prateleira de trás (−y) com os frascos (um que brilha), a planta azul presa por tachinhas
 * e por uma engrenagem, o mecanismo de corda pela metade, a lupa no braço articulado, as ferramentas, a mola, o torno de bancada e o
 * candeeiro de latão com a cúpula verde (traz luz).
 */
function bancadaDeInventor(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.0, D = 0.85;
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2, -W / 2, D / 2], 0.01, '#0d0a08', 0.45);
  bloco(partes, ID, W, D, MOGNO, 0.85, 0.035);
  for (let v = -D / 2 + 0.12; v < D / 2 - 0.05; v += 0.12) partes.push(tira([-W / 2 + 0.05, v, W / 2 - 0.05, v], 0.008, MOGNO.nanquim, 0.86, { ...O, alfa: 0.45, detalhe: 3 }));
  for (let k = 0; k < 4; k++) partes.push(poli(bolha(-0.8 + r() * 1.6, -0.3 + r() * 0.6, 0.08, 0.05, 8, 0.4, r), '#1a0c08', 0.861, { ...S, alfa: 0.35, detalhe: 3 }));
  // A prateleira de trás e os frascos.
  bloco(partes, quadro(0, -D / 2 + 0.07), W, 0.14, MOGNO, 1.25, 0.02);
  const brilha = Math.floor(r() * 5);
  for (let k = 0, u = -W / 2 + 0.2; u < W / 2 - 0.15; u += 0.16 + r() * 0.12, k++) {
    const cor = ['#3a8a4a', '#8a2a5a', '#c8a040', '#3a5a9a', '#7a8a8a'][Math.floor(r() * 5)]!, R = 0.04 + r() * 0.02;
    partes.push(elipse(u, -D / 2 + 0.07, R * 2 + 0.02, R * 2 + 0.02, '#1a1a1a', 1.3, { contorno: false, semSombra: true, detalhe: 2 }), elipse(u, -D / 2 + 0.07, R * 2, R * 2, cor, 1.301, { ...O, vidro: true, brilho: k === brilha, detalhe: 2 }));
    if (k === brilha) partes.push(elipse(u, -D / 2 + 0.07, R * 5, R * 5, cor, 1.299, { ...O, brilho: true, alfa: 0.4, desfoque: 0.06, detalhe: 3 }));
    partes.push(elipse(u - R * 0.3, -D / 2 + 0.07 - R * 0.3, R * 0.6, R * 0.4, '#ffffff', 1.302, { ...S, alfa: 0.5, detalhe: 3 }));
  }
  // A planta azul, presa por tachinhas e por uma engrenagem.
  const pf = quadro(-0.35, 0.05, (r() - 0.5) * 0.2);
  partes.push(poli(retQ(pf, 0, 0, 0.72, 0.46), '#1e3a6a', 0.88, { contorno: 'leve', detalhe: 1 }));
  for (let u = -0.32; u <= 0.32; u += 0.08) partes.push(tira(em(pf, [u, -0.21, u, 0.21]), 0.004, '#4a6a9a', 0.881, { ...O, alfa: 0.6, detalhe: 3 }));
  for (let v = -0.2; v <= 0.2; v += 0.08) partes.push(tira(em(pf, [-0.34, v, 0.34, v]), 0.004, '#4a6a9a', 0.881, { ...O, alfa: 0.6, detalhe: 3 }));
  partes.push(tira([...arco(...pf(-0.08, 0.02), 0.14, 0.14, 0, Math.PI * 2, 24)], 0.008, '#e8eef8', 0.882, { ...O, alfa: 0.85, detalhe: 3 }), tira([...arco(...pf(-0.08, 0.02), 0.05, 0.05, 0, Math.PI * 2, 12)], 0.006, '#e8eef8', 0.882, { ...O, alfa: 0.85, detalhe: 3 }));
  partes.push(tira(em(pf, [0.1, -0.15, 0.3, -0.15, 0.3, 0.1]), 0.006, '#e8eef8', 0.882, { ...O, alfa: 0.8, detalhe: 3 }), tira(em(pf, [0.12, 0.17, 0.3, 0.17]), 0.006, '#e8eef8', 0.882, { ...O, alfa: 0.7, detalhe: 3 }));
  for (const [u, v] of [[-0.34, -0.21], [0.34, -0.21], [-0.34, 0.21]] as const) partes.push(elipse(...pf(u, v), 0.035, 0.035, LATAO.luz, 0.885, { contorno: 'leve', detalhe: 3 }));
  engrenagem(partes, ...pf(0.33, 0.2), 0.08, 10, FERRO, 0.89, r() * 6, 0);
  // O mecanismo pela metade: a base, três engrenagens de latão e a mola.
  const mx = 0.38, my = -0.06;
  bloco(partes, quadro(mx, my), 0.4, 0.3, LATAO, 0.9, 0.02);
  const R1 = 0.11, n1 = dentes(R1, 0.045), g1 = r() * 6.28, p = engrenar(mx - 0.05, my, R1, n1, g1, 0.07, 0.4 + r() * 0.4);
  engrenagem(partes, mx - 0.05, my, R1, n1, LATAO, 0.95, g1, 4);
  engrenagem(partes, p.x, p.y, 0.07, p.n, COBRE, 0.96, p.giro, 0);
  { const pts: number[] = []; for (let k = 0; k <= 40; k++) { const a = k * 0.6; pts.push(0.12 + k * 0.006, 0.22 + Math.sin(a) * 0.025); } partes.push(tira(pts, 0.008, ACO.luz, 0.9, { contorno: 'leve', detalhe: 3 })); }
  // A lupa no braço articulado, presa à beira da frente.
  partes.push(tira([0.62, 0.4, 0.66, 0.25, 0.55, 0.12], 0.025, LATAO.sombra, 1.1, { contorno: 'leve', detalhe: 3 }));
  partes.push(tira(anel(0.5, 0.06, 0.08, 0.08, 16), 0.022, LATAO.base, 1.12, { contorno: 'leve', detalhe: 2 }), elipse(0.5, 0.06, 0.14, 0.14, '#c8d8e0', 1.115, { ...O, vidro: true, alfa: 0.5, detalhe: 2 }), elipse(0.47, 0.03, 0.05, 0.03, '#ffffff', 1.121, { ...S, alfa: 0.6, detalhe: 3 }));
  // As ferramentas: a chave inglesa, a chave de fenda e o compasso.
  const ff = quadro(-0.05, 0.3, (r() - 0.5) * 0.6);
  partes.push(tira(em(ff, [-0.14, 0, 0.1, 0]), 0.03, ACO.base, 0.9, { contorno: 'leve', detalhe: 3 }), tira(anel(...ff(0.14, 0), 0.04, 0.04, 10), 0.02, ACO.base, 0.9, { contorno: 'leve', detalhe: 3 }));
  const sf = quadro(-0.78, 0.28, (r() - 0.5) * 1.2);
  partes.push(tira(em(sf, [-0.12, 0, 0.02, 0]), 0.035, VERMELHO, 0.9, { contorno: 'leve', detalhe: 3 }), tira(em(sf, [0.02, 0, 0.14, 0]), 0.012, ACO.luz, 0.9, { contorno: 'leve', detalhe: 3 }));
  partes.push(tira([0.82, 0.12, 0.72, 0.28], 0.01, ACO.brilho, 0.9, { contorno: 'leve', detalhe: 3 }), tira([0.82, 0.12, 0.88, 0.3], 0.01, ACO.brilho, 0.9, { contorno: 'leve', detalhe: 3 }));
  // O torno de bancada no canto da frente (+x).
  bloco(partes, quadro(0.86, 0.32), 0.18, 0.2, FERRO, 1.0, 0.02);
  partes.push(tira([0.74, 0.44, 0.98, 0.44], 0.025, ACO.luz, 1.05, { contorno: 'leve', detalhe: 3 }));
  // O candeeiro de latão com a cúpula verde.
  const lx = -0.82, ly = -0.18;
  disco(partes, lx, ly, 0.08, LATAO, 0.9);
  partes.push(elipse(lx + 0.05, ly + 0.08, 0.5, 0.42, '#ffd890', 0.887, { ...O, brilho: true, alfa: 0.35, desfoque: 0.08, detalhe: 2 }));
  disco(partes, lx + 0.04, ly + 0.06, 0.13, tonsDe('#1e5a3a'), 1.35, 0.1);
  partes.push(elipse(lx + 0.04, ly + 0.06, 0.04, 0.04, LATAO.brilho, 1.37, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/**
 * Gramofone sobre o móvel: o armário de mogno, a caixa do gramofone com o disco preto (os sulcos, o selo e o reflexo), o braço de
 * latão com o diafragma, a manivela do lado (+x) e a corneta em flor que vai para trás (−y), com os gomos em tons de luz e a garganta escura.
 */
function gramofone(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = [LATAO, tonsDe('#6a1a18'), tonsDe('#1e4a32')][Math.floor(r() * 3)]!, selo = ['#a8281a', '#2a4a8a', '#3a6a3a'][Math.floor(r() * 3)]!;
  sombraNoChao(partes, [-0.3, -0.2, 0.3, -0.2, 0.3, 0.4, -0.3, 0.4], 0.01, '#0d0a08', 0.45);
  bloco(partes, quadro(0, 0.12), 0.56, 0.54, MOGNO, 0.8, 0.03);
  bloco(partes, quadro(0, 0.13), 0.42, 0.42, tonsDe('#3e1a10'), 0.95, 0.03);
  // O disco.
  const dx = -0.01, dy = 0.15;
  partes.push(elipse(dx, dy, 0.33, 0.33, '#060608', 0.98, { contorno: 'leve', detalhe: 1 }), elipse(dx, dy, 0.31, 0.31, '#141418', 0.981, { ...O, detalhe: 1 }));
  for (const rr of [0.14, 0.12, 0.1, 0.08]) partes.push(tira(anel(dx, dy, rr, rr, 28), 0.004, '#2a2a30', 0.982, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(tira(arco(dx, dy, 0.11, 0.11, Math.PI * 1.05, Math.PI * 1.45, 8), 0.04, '#5a5a66', 0.983, { ...S, alfa: 0.5, detalhe: 3 }));
  partes.push(elipse(dx, dy, 0.1, 0.1, selo, 0.984, { ...O, detalhe: 2 }), elipse(dx, dy, 0.015, 0.015, ACO.brilho, 0.985, { ...O, detalhe: 3 }));
  // A manivela.
  partes.push(tira([0.21, 0.18, 0.3, 0.18, 0.3, 0.26], 0.018, ACO.base, 0.92, { contorno: 'leve', detalhe: 3 }), elipse(0.3, 0.27, 0.04, 0.05, MADEIRA.base, 0.93, { contorno: 'leve', detalhe: 3 }));
  // A corneta: do pé do braço, atrás, a garganta sobe e se abre em flor para trás (−y), um pouco de frente.
  const bx = 0.03, by = -0.22, Rx = 0.3, Ry = 0.22, n = 10;
  partes.push(tira([0.14, 0.02, 0.12, -0.06, bx + 0.05, by + Ry * 0.4], 0.06, t.nanquim, 1.2, { contorno: 'leve', detalhe: 2 }), tira([0.14, 0.02, 0.12, -0.06, bx + 0.05, by + Ry * 0.4], 0.035, t.base, 1.202, { ...O, detalhe: 3 }));
  partes.push(elipse(bx + 0.01, by + 0.012, Rx * 2 + 0.04, Ry * 2 + 0.04, t.nanquim, 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
    partes.push(poli([bx + Math.cos(a0) * Rx, by + Math.sin(a0) * Ry, bx + Math.cos(am) * Rx * 1.04, by + Math.sin(am) * Ry * 1.04, bx + Math.cos(a1) * Rx, by + Math.sin(a1) * Ry, bx + Math.cos(a1) * Rx * 0.25 + 0.03, by + Math.sin(a1) * Ry * 0.25 + 0.06, bx + Math.cos(a0) * Rx * 0.25 + 0.03, by + Math.sin(a0) * Ry * 0.25 + 0.06], tomDaFace(t, -olhar(am)), 1.402, { ...O, detalhe: 1 }));
    partes.push(tira([bx + Math.cos(a0) * Rx, by + Math.sin(a0) * Ry, bx + Math.cos(a0) * Rx * 0.25 + 0.03, by + Math.sin(a0) * Ry * 0.25 + 0.06], 0.006, t.nanquim, 1.403, { ...O, alfa: 0.5, detalhe: 3 }));
  }
  partes.push(tira(anel(bx, by, Rx, Ry, 30), 0.02, t === LATAO ? LATAO.brilho : LATAO.luz, 1.404, { ...O, detalhe: 2 }));
  partes.push(elipse(bx + 0.03, by + 0.06, Rx * 0.5, Ry * 0.5, t.nanquim, 1.405, { ...S, alfa: 0.85, desfoque: 0.03, detalhe: 2 }), elipse(bx + 0.035, by + 0.065, Rx * 0.18, Ry * 0.18, '#000000', 1.406, { ...O, detalhe: 3 }));
  // O braço de latão e o diafragma sobre o disco.
  partes.push(tira([0.14, 0.02, 0.12, 0.12, 0.06, 0.22], 0.025, LATAO.nanquim, 1.1, { contorno: 'leve', detalhe: 2 }), tira([0.14, 0.02, 0.12, 0.12, 0.06, 0.22], 0.012, LATAO.brilho, 1.102, { ...O, detalhe: 3 }));
  disco(partes, 0.14, 0.02, 0.035, LATAO, 1.12);
  disco(partes, 0.06, 0.22, 0.04, ACO, 1.05);
  return partes;
}

/**
 * Bobina de Tesla: a base de mogno com os bornes de latão, a bobina primária de cobre em espiral chata, a coluna da secundária e o
 * toroide de alumínio no alto; ligada (`arcos`), as faíscas violetas que saltam do toroide e a aura, que somam luz, e a luz própria.
 */
function bobinaDeTesla(seed: number, ligada: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, poligono(0, 0, 0.62, 8, Math.PI / 8), 0.01, '#0d0a08', 0.45);
  partes.push(poli(poligono(0.012, 0.014, 0.6, 8, Math.PI / 8), MOGNO.nanquim, 0.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 8; k++) { const a0 = Math.PI / 8 + (k / 8) * Math.PI * 2, a1 = a0 + Math.PI / 4; partes.push(poli([Math.cos(a0) * 0.5, Math.sin(a0) * 0.5, Math.cos(a0) * 0.58, Math.sin(a0) * 0.58, Math.cos(a1) * 0.58, Math.sin(a1) * 0.58, Math.cos(a1) * 0.5, Math.sin(a1) * 0.5], tomDaFace(MOGNO, olhar((a0 + a1) / 2)), 0.403, { ...O, detalhe: 1 })); }
  partes.push(poli(poligono(0, 0, 0.5, 8, Math.PI / 8), MOGNO.meio, 0.404, { ...O, detalhe: 1 }));
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; disco(partes, Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.045, LATAO, 0.45); }
  partes.push(tira([Math.cos(Math.PI / 4) * 0.44, Math.sin(Math.PI / 4) * 0.44, 0.6, 0.3, 0.7, 0.2], 0.02, '#1a1410', 0.42, { contorno: 'leve', detalhe: 3 }, 0.6));
  // A primária: a espiral chata de cobre.
  { const pts: number[] = []; for (let k = 0; k <= 80; k++) { const a = k * 0.25, rr = 0.16 + k * 0.0028; pts.push(Math.cos(a) * rr, Math.sin(a) * rr); } partes.push(tira(pts, 0.02, COBRE.base, 0.5, { contorno: 'leve', detalhe: 2 }), tira(pts.map((v, i) => v - 0.005 * (i % 2 ? 1 : 1)), 0.007, COBRE.brilho, 0.502, { ...O, alfa: 0.6, detalhe: 3 })); }
  // A coluna da secundária, que aparece no furo do toroide.
  disco(partes, 0, 0, 0.22, COBRE, 1.25);
  for (const rr of [0.08, 0.12, 0.16, 0.2]) partes.push(tira(anel(0, 0, rr, rr, 24), 0.006, COBRE.nanquim, 1.265, { ...O, alfa: 0.5, detalhe: 3 }));
  // O toroide: o anel de alumínio, a luz do noroeste e a sombra do outro lado.
  const Rt = 0.42, aL = Math.atan2(LUZ_Y, LUZ_X);
  partes.push(tira(anel(0.012, 0.014, Rt, Rt, 40), 0.26, ACO.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(anel(0, 0, Rt, Rt, 40), 0.22, ACO.base, 1.452, { ...O, detalhe: 1 }));
  partes.push(tira(arco(0, 0, Rt, Rt, aL + Math.PI - 1.3, aL + Math.PI + 1.3, 20), 0.14, ACO.sombra, 1.454, { ...S, alfa: 0.8, detalhe: 2 }));
  partes.push(tira(arco(0, 0, Rt + 0.02, Rt + 0.02, 0, Math.PI * 2, 40), 0.08, ACO.luz, 1.455, { ...S, alfa: 0.5, detalhe: 2 }));
  partes.push(tira(arco(0, 0, Rt + 0.03, Rt + 0.03, aL - 1.0, aL + 1.0, 16), 0.04, ACO.brilho, 1.456, { ...S, alfa: 0.85, detalhe: 3 }));
  partes.push(tira(arco(0, 0, Rt - 0.07, Rt - 0.07, aL + Math.PI - 0.9, aL + Math.PI + 0.9, 12), 0.03, ACO.brilho, 1.456, { ...S, alfa: 0.5, detalhe: 3 }));
  if (ligada) {
    partes.push(elipse(0, 0, 1.5, 1.5, '#4a38c8', 1.2, { ...O, brilho: true, alfa: 0.3, desfoque: 0.25, detalhe: 2 }));
    const n = 5 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + (r() - 0.5) * 0.6, d = 0.85 + r() * 0.3; faisca(partes, r, Math.cos(a) * (Rt + 0.1), Math.sin(a) * (Rt + 0.1), Math.cos(a + (r() - 0.5) * 0.4) * d, Math.sin(a + (r() - 0.5) * 0.4) * d, 1.47 + k * 0.003); }
  }
  return partes;
}

// ---------- Receitas ----------

const VI = { generos: ['vitoriano', 'investigacao', 'fantasia'], kit: 'vitoriano' };
const luzDaFornalha = (): LuzDeReceita => ({ raio: 4.5, cor: '#ff9a4a', intensidade: 0.8, power: 'fire', flicker: 0.15 });
const luzDoLampiao = (): LuzDeReceita => ({ preset: 'lampiao-a-gas', raio: 5, cor: '#ffe2a8', intensidade: 0.95, power: 'fire', flicker: 0.05 });
const luzDoCandeeiro = (): LuzDeReceita => ({ raio: 2.5, cor: '#ffd89a', intensidade: 0.6, power: 'fire', flicker: 0.04 });
const ligada = (params: Record<string, unknown>): boolean => Math.round(num({ seed: 0, params }, 'arcos', 1, 0, 1)) === 1;
const luzDaBobina = (params: Record<string, unknown>): LuzDeReceita | null => (ligada(params) ? { raio: 4, cor: '#a89cff', intensidade: 0.9, power: 'grid', flicker: 0.5 } : null);

/** O kit vitoriano e steampunk: fábrica e vapor (Q20a), rua e invenções (Q20b). */
export const RECEITAS_VITORIANAS: Receita[] = [
  { id: 'caldeira', nome: 'Caldeira a vapor', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['fabrica', 'sala-de-maquinas', 'porao', 'oficina-de-inventor'], ...VI, tags: ['caldeira', 'vapor', 'fornalha', 'carvao', 'ferro', 'rebites', 'fabrica', 'steampunk', 'luz'], pegada: [2.6, 4.6], altura: 2.6,
    luz: luzDaFornalha, gerar: p => piso([2.6, 4.6], caldeira(p.seed)) },
  { id: 'maquina-a-vapor', nome: 'Máquina a vapor', categoria: 'decoracao', tipo: 'piso', funcoes: ['fabrica', 'sala-de-maquinas'], ...VI, tags: ['maquina', 'vapor', 'volante', 'cilindro', 'biela', 'regulador', 'fabrica', 'steampunk'], pegada: [4.6, 2.6], altura: 2.8,
    gerar: p => piso([4.6, 2.6], maquinaAVapor(p.seed)) },
  { id: 'engrenagens', nome: 'Trem de engrenagens', categoria: 'decoracao', tipo: 'piso', funcoes: ['fabrica', 'sala-de-maquinas', 'oficina-de-inventor', 'oficina'], ...VI, tags: ['engrenagem', 'engrenagens', 'roda dentada', 'mecanismo', 'ferro', 'latao', 'fabrica', 'steampunk'], pegada: [2.0, 1.5], altura: 0.8,
    gerar: p => piso([2.0, 1.5], engrenagensDeChao(p.seed)) },
  { id: 'engrenagens.parede', nome: 'Engrenagens de parede', categoria: 'parede', tipo: 'parede', funcoes: ['fabrica', 'sala-de-maquinas', 'oficina-de-inventor', 'clube'], ...VI, tags: ['engrenagem', 'engrenagens', 'mecanismo', 'parede', 'latao', 'cobre', 'steampunk'], pegada: [1.5, 0.05],
    gerar: p => { const d = engrenagensDeParede(p.seed); return parede(1.5, d.face, d.topo); } },
  { id: 'esteira', nome: 'Esteira de fábrica', categoria: 'decoracao', tipo: 'piso', funcoes: ['fabrica', 'deposito', 'estacao-de-dirigivel'], ...VI, tags: ['esteira', 'correia', 'rolos', 'caixotes', 'sacos', 'carvao', 'fabrica', 'steampunk'], pegada: [4, 1.2], altura: 1.1,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4, min: 1.5, max: 14, passo: 0.5 }],
    gerar: p => { const C = num(p, 'comprimento', 4, 1.5, 14); return piso([C, 1.2], esteira(p.seed, C)); } },
  { id: 'tear-mecanico', nome: 'Tear mecânico', categoria: 'decoracao', tipo: 'piso', funcoes: ['fabrica'], ...VI, tags: ['tear', 'mecanico', 'tecelagem', 'fio', 'tecido', 'lancadeira', 'fabrica', 'steampunk'], pegada: [2.4, 1.6], altura: 1.5,
    gerar: p => piso([2.4, 1.6], tearMecanico(p.seed)) },
  { id: 'prensa', nome: 'Prensa de balancim', categoria: 'decoracao', tipo: 'piso', funcoes: ['fabrica', 'oficina-de-inventor', 'oficina', 'grafica'], ...VI, tags: ['prensa', 'parafuso', 'balancim', 'ferro', 'chapa', 'fabrica', 'steampunk'], pegada: [1.6, 1.6], altura: 1.9,
    gerar: p => piso([1.6, 1.6], prensa(p.seed)) },
  { id: 'tubulacao.cobre', nome: 'Tubulação de cobre', categoria: 'decoracao', tipo: 'piso', funcoes: ['fabrica', 'sala-de-maquinas', 'porao', 'oficina-de-inventor'], ...VI, tags: ['tubo', 'cano', 'tubulacao', 'cobre', 'valvula', 'manometro', 'vapor', 'industrial', 'steampunk'], pegada: [3, 0.8], altura: 0.7,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 3, min: 1, max: 12, passo: 0.5 }],
    gerar: p => { const C = num(p, 'comprimento', 3, 1, 12); return piso([C, 0.8], tubulacaoCobre(p.seed, C)); } },
  { id: 'painel-de-manometros', nome: 'Painel de manômetros', categoria: 'parede', tipo: 'parede', funcoes: ['fabrica', 'sala-de-maquinas', 'oficina-de-inventor', 'estacao-de-dirigivel'], ...VI, tags: ['manometro', 'painel', 'pressao', 'valvula', 'cobre', 'latao', 'vapor', 'steampunk'], pegada: [1.4, 0.05],
    gerar: p => { const d = painelDeManometros(p.seed); return parede(1.4, d.face, d.topo); } },
  { id: 'chamine-industrial', nome: 'Chaminé industrial', categoria: 'exterior', tipo: 'piso', funcoes: ['fabrica', 'patio'], ...VI, tags: ['chamine', 'fabrica', 'tijolo', 'fumaca', 'fuligem', 'industrial', 'steampunk'], pegada: [3.2, 3.2], altura: 12,
    campos: [{ id: 'fumaca', rotulo: 'Fumaça (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => piso([3.2, 3.2], chamineIndustrial(p.seed, Math.round(num(p, 'fumaca', 1, 0, 1)) === 1)) },
  // Rua e invenções (Q20b)
  { id: 'lampiao-a-gas', nome: 'Lampião a gás', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['rua', 'praca', 'jardim', 'estacao-de-dirigivel', 'patio'], ...VI, tags: ['lampiao', 'gas', 'poste', 'luz', 'rua', 'lanterna', 'vitoriano', 'steampunk'], pegada: [0.75, 0.75], altura: 3.4,
    luz: luzDoLampiao, gerar: p => piso([0.75, 0.75], lampiaoAGas(p.seed)) },
  { id: 'banca-de-jornal', nome: 'Banca de jornal', categoria: 'exterior', tipo: 'piso', funcoes: ['rua', 'praca', 'estacao', 'estacao-de-dirigivel'], ...VI, tags: ['banca', 'jornal', 'jornais', 'revistas', 'quiosque', 'manchete', 'rua', 'vitoriano'], pegada: [2.2, 1.7], altura: 2.4,
    gerar: p => piso([2.2, 1.7], bancaDeJornal(p.seed)) },
  { id: 'carruagem-fechada', nome: 'Carruagem fechada', categoria: 'exterior', tipo: 'piso', funcoes: ['rua', 'praca', 'estabulo', 'estacao'], ...VI, tags: ['carruagem', 'coche', 'berlinda', 'cabriole', 'rodas', 'cavalo', 'rua', 'vitoriano'], pegada: [3.8, 1.8], altura: 2.3,
    gerar: p => piso([3.8, 1.8], carruagemFechada(p.seed)) },
  { id: 'relogio-de-rua', nome: 'Relógio de rua', categoria: 'exterior', tipo: 'piso', funcoes: ['rua', 'praca', 'estacao', 'estacao-de-dirigivel'], ...VI, tags: ['relogio', 'hora', 'poste', 'coluna', 'praca', 'rua', 'vitoriano'], pegada: [0.9, 0.9], altura: 3.8,
    gerar: p => piso([0.9, 0.9], relogioDeRua(p.seed)) },
  { id: 'dirigivel', nome: 'Dirigível ancorado', categoria: 'exterior', tipo: 'piso', funcoes: ['estacao-de-dirigivel', 'patio'], ...VI, tags: ['dirigivel', 'zepelim', 'aeronave', 'balao', 'mastro', 'helice', 'voo', 'steampunk'], pegada: [13.8, 5.4], altura: 7,
    gerar: p => piso([13.8, 5.4], dirigivel(p.seed)) },
  { id: 'automato', nome: 'Autômato', categoria: 'decoracao', tipo: 'piso', funcoes: ['oficina-de-inventor', 'fabrica', 'clube', 'laboratorio'], ...VI, tags: ['automato', 'robo', 'mecanico', 'corda', 'vapor', 'latao', 'invencao', 'steampunk'], pegada: [0.9, 0.9], altura: 1.9,
    gerar: p => piso([0.9, 0.9], automato(p.seed)) },
  { id: 'bancada-de-inventor', nome: 'Bancada de inventor', categoria: 'mesas', tipo: 'piso', funcoes: ['oficina-de-inventor', 'oficina', 'laboratorio', 'escritorio'], ...VI, tags: ['bancada', 'inventor', 'planta', 'engrenagem', 'frascos', 'lupa', 'ferramentas', 'oficina', 'invencao', 'steampunk'], pegada: [2.1, 1.0], altura: 1.4,
    luz: luzDoCandeeiro, gerar: p => piso([2.1, 1.0], bancadaDeInventor(p.seed)) },
  { id: 'gramofone', nome: 'Gramofone', categoria: 'decoracao', tipo: 'piso', funcoes: ['sala', 'clube', 'salao', 'escritorio', 'quarto'], ...VI, tags: ['gramofone', 'fonografo', 'disco', 'musica', 'corneta', 'vitrola', 'vitoriano'], pegada: [0.7, 0.9], altura: 1.5,
    gerar: p => piso([0.7, 0.9], gramofone(p.seed)) },
  { id: 'bobina-de-tesla', nome: 'Bobina de Tesla', categoria: 'decoracao', tipo: 'piso', funcoes: ['oficina-de-inventor', 'laboratorio', 'fabrica'], ...VI, tags: ['bobina', 'tesla', 'eletricidade', 'raio', 'faisca', 'arco', 'invencao', 'steampunk', 'luz'], pegada: [2.4, 2.4], altura: 3,
    campos: [{ id: 'arcos', rotulo: 'Faíscas (0 desligada, 1 ligada)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDaBobina, gerar: p => piso([2.4, 2.4], bobinaDeTesla(p.seed, ligada(p.params))) },
];
