import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, silhuetaDeDiscos, sombraNoChao, tira } from '../organico.ts';
import { num, parede, piso, type Receita } from './comum.ts';

// Antiguidade (Q15a): templo e cidade. Mármore claro e quente, bronze com pátina, arenito e granito pintados para o Egito.
// Como no resto do acervo: nanquim por baixo do que conta na silhueta, volume em degraus de tom para o noroeste e `z` moderado
// (≈1–1,5 m) nas partes, com a `altura` real declarada na receita para a sombra do sol: peça estreita com `z` alto escurece um anel
// do chão em volta à noite (oclusão do mapa de altura).

const O = { contorno: false as const, semSombra: true };
const S = { ...O, suave: true };
const LUZ_A = Math.atan2(LUZ_Y, LUZ_X);

/** Os tons de um material de pedra ou metal, do nanquim (silhueta) ao brilho. */
interface Tons { nanquim: string; sombra: string; base: string; meio: string; luz: string; brilho: string }
const MARMORE: Tons = { nanquim: '#2a231b', sombra: '#8f8472', base: '#b5aa94', meio: '#cbc1ab', luz: '#ded5c1', brilho: '#f2ebdb' };
const MARMORE_VELHO: Tons = { nanquim: '#26201a', sombra: '#7e7462', base: '#a29682', meio: '#b8ad98', luz: '#cdc3ae', brilho: '#e0d8c6' };
const ARENITO: Tons = { nanquim: '#2a1c10', sombra: '#7e6040', base: '#a6865a', meio: '#bc9c6c', luz: '#d2b484', brilho: '#e8cfa0' };
const GRANITO: Tons = { nanquim: '#1e1210', sombra: '#5a3a32', base: '#7e5448', meio: '#956656', luz: '#ae7e6a', brilho: '#c89c86' };
const BRONZE: Tons = { nanquim: '#1a120a', sombra: '#4a3418', base: '#74522a', meio: '#8e6834', luz: '#b08646', brilho: '#d8b26c' };
const OURO: Tons = { nanquim: '#2a1a06', sombra: '#7a5418', base: '#a27424', meio: '#bc8c2e', luz: '#d6aa44', brilho: '#f0d684' };
const PATINA = '#4f8a72', AZUL = '#24447e', TURQUESA = '#2c8480', VERMELHO = '#963a1e', TINTA = '#1e1612', CINZA = '#3a3430';

type Quadro = (u: number, v: number) => [number, number];
/** Um referencial local (u ao longo, v através) com centro em (cx, cy) e girado `ang`. */
const quadro = (cx: number, cy: number, ang = 0): Quadro => { const c = Math.cos(ang), s = Math.sin(ang); return (u, v) => [cx + u * c - v * s, cy + u * s + v * c]; };
const em = (f: Quadro, uv: readonly number[]): number[] => { const out: number[] = []; for (let i = 0; i < uv.length; i += 2) out.push(...f(uv[i]!, uv[i + 1]!)); return out; };
const ID = quadro(0, 0);
/** Quanto uma face de normal `ang` olha para a luz (1 de frente, −1 de costas). */
const olhar = (ang: number): number => Math.cos(ang - LUZ_A);
const tomDaFace = (t: Tons, d: number): string => (d > 0.55 ? t.luz : d > 0.05 ? t.meio : d > -0.55 ? t.base : t.sombra);

/** Disco em volume (tambor, toro, cabeça): nanquim, base e degraus de luz para o noroeste. */
function disco(partes: Parte[], x: number, y: number, R: number, t: Tons, z: number, rY = R): void {
  partes.push(elipse(x + 0.012, y + 0.014, R * 2 + 0.05, rY * 2 + 0.05, t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(elipse(x, y, R * 2, rY * 2, t.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(elipse(x + LUZ_X * R * 0.1, y + LUZ_Y * rY * 0.1, R * 1.72, rY * 1.72, t.meio, z + 0.006, { ...S, detalhe: 1 }));
  partes.push(elipse(x + LUZ_X * R * 0.28, y + LUZ_Y * rY * 0.28, R * 1.0, rY * 0.96, t.luz, z + 0.009, { ...S, detalhe: 2 }));
  partes.push(elipse(x + LUZ_X * R * 0.46, y + LUZ_Y * rY * 0.46, R * 0.34, rY * 0.3, t.brilho, z + 0.012, { ...S, alfa: 0.8, detalhe: 3 }));
}

/** Bloco de pedra visto de cima, no referencial `f`: nanquim, tampo e bisel com cada face no tom da luz que recebe. */
function bloco(partes: Parte[], f: Quadro, w: number, h: number, t: Tons, z: number, b = Math.min(w, h) * 0.12, ang = 0): void {
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
function desgaste(partes: Parte[], r: () => number, f: Quadro, w: number, h: number, t: Tons, z: number, n = 3): void {
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

/** Contorno de um fuste canelado (vista de cima): `n` caneluras côncavas de fundo `fundo`·R, com filete plano entre elas (`filete`, de 0 a 0,4). */
function contornoCanelado(R: number, n: number, fundo: number, filete: number, cx = 0, cy = 0): number[] {
  const pts: number[] = [], passos = 5;
  for (let i = 0; i < n; i++) for (let k = 0; k < passos; k++) {
    const t = k / passos, a = ((i + t) / n) * Math.PI * 2, dentro = t < 1 - filete ? Math.sin((t / (1 - filete)) * Math.PI) : 0;
    pts.push(cx + Math.cos(a) * R * (1 - fundo * dentro), cy + Math.sin(a) * R * (1 - fundo * dentro));
  }
  return pts;
}

/** Fuste canelado visto de cima: estrela de caneluras, cada uma com o lado que olha a luz claro e o outro escuro (raios em volta do capitel). */
function fuste(partes: Parte[], R: number, n: number, t: Tons, z: number, filete: number): void {
  partes.push(elipse(0.014, 0.016, R * 2 + 0.05, R * 2 + 0.05, t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(contornoCanelado(R, n, 0.07, filete), t.base, z + 0.003, { ...O, detalhe: 1 }));
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1 - filete) / n) * Math.PI * 2, am = (a0 + a1) / 2, d = olhar(am);
    const P = (a: number, k: number): number[] => [Math.cos(a) * R * k, Math.sin(a) * R * k];
    // Na canelura côncava, a metade que fica de costas para a luz recebe luz, e vice-versa.
    partes.push(poli([0, 0, ...P(a0, 0.99), ...P((a0 + am) / 2, 0.955), ...P(am, 0.93)], tom(t.base, d * 0.22 + 0.1), z + 0.005, { ...O, detalhe: 2 }));
    partes.push(poli([0, 0, ...P(am, 0.93), ...P((am + a1) / 2, 0.955), ...P(a1, 0.99)], tom(t.base, d * 0.22 - 0.2), z + 0.005, { ...O, detalhe: 2 }));
    if (filete > 0) partes.push(poli([0, 0, ...P(a1, 1), ...P(((i + 1) / n) * Math.PI * 2, 1)], tom(t.base, d * 0.2 + 0.12), z + 0.005, { ...O, detalhe: 3 }));
  }
}

/** Base ática (plinto quadrado, toro, escócia e toro de cima) das colunas jônica e coríntia. */
function baseAtica(partes: Parte[], R: number, t: Tons): void {
  bloco(partes, ID, R * 2.84, R * 2.84, MARMORE_VELHO, 0.1);
  disco(partes, 0, 0, R * 1.3, t, 0.18);
  partes.push(elipse(0, 0, R * 2.36, R * 2.36, t.nanquim, 0.2, { ...O, alfa: 0.75, detalhe: 2 }));
  disco(partes, 0, 0, R * 1.14, t, 0.24);
}

/** Coluna clássica de pé, vista de cima: o capitel é o que se vê, e o fuste canelado aparece em raios em volta dele. */
function coluna(ordem: 0 | 1 | 2, altura: number, seed: number): { pegada: [number, number]; partes: Parte[] } {
  // O topo fica abaixo de 1,6 m: acima disso o objeto vira oclusor das luzes e o próprio capitel fica escuro à noite.
  const r = mulberry32(seed), D = 0.5 + altura * 0.06, R = D / 2, zT = Math.min(1.5, 0.5 + altura * 0.13), t = MARMORE, partes: Parte[] = [];
  const lado = Math.round(D * 1.5 * 100) / 100;
  sombraNoChao(partes, bolha(0, 0, R * 1.35, R * 1.35, 16, 0.03, r), 0.02, '#0d0a08', 0.45);
  if (ordem === 0) {
    // Dórica: sem base; o fuste de 20 caneluras em aresta viva e o ábaco quadrado liso, um pouco menor que o fuste.
    fuste(partes, R, 20, t, zT * 0.55, 0);
    disco(partes, 0, 0, R * 0.8, t, zT - 0.03);   // o equino, abaulado, sob o ábaco
    bloco(partes, ID, D * 0.74, D * 0.74, t, zT, D * 0.08);
    desgaste(partes, r, ID, D * 0.74, D * 0.74, t, zT, 3);
  } else if (ordem === 1) {
    // Jônica: base ática, 24 caneluras com filete, e o capitel de volutas: dois rolos (pulvinos) nos lados e as espirais nas pontas.
    baseAtica(partes, R, t);
    fuste(partes, R, 24, t, zT * 0.55, 0.25);
    partes.push(elipse(0, 0, D * 0.9, D * 0.9, t.nanquim, zT - 0.04, { ...O, alfa: 0.55, detalhe: 2 }));
    disco(partes, 0, 0, R * 0.86, t, zT - 0.02);   // equino (óvalos) entre os rolos
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; partes.push(elipse(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, R * 0.2, R * 0.2, tom(t.base, olhar(a) * 0.15 - 0.05), zT - 0.005, { ...O, detalhe: 3 })); }
    bloco(partes, ID, D * 0.62, D * 0.98, t, zT + 0.02, D * 0.05);
    for (const s of [-1, 1]) {
      const x = s * D * 0.46, w = D * 0.26, h = D * 0.98;
      partes.push(ret(x + 0.012, 0.014, w + 0.05, h + 0.05, t.nanquim, zT, { contorno: 'leve', sombraLeve: true, raio: w * 0.5, detalhe: 1 }));
      // O rolo é um cilindro deitado ao longo de y: claro do lado oeste, escuro do leste, cintado no meio.
      for (let k = 0; k < 4; k++) partes.push(ret(x - w / 2 + (k + 0.5) * (w / 4), 0, w / 4 + 0.002, h, tom(t.base, 0.22 - k * 0.14), zT + 0.003, { ...O, raio: k === 0 || k === 3 ? w * 0.12 : 0, detalhe: 1 }));
      partes.push(ret(x, 0, w * 1.02, h * 0.12, t.sombra, zT + 0.006, { ...O, detalhe: 2 }), ret(x, -h * 0.03, w * 1.02, h * 0.04, t.luz, zT + 0.007, { ...O, detalhe: 3 }));
      for (const sy of [-1, 1]) {
        // As espirais das volutas nas pontas dos rolos.
        const cy = sy * h * 0.5, rv = w * 0.62;
        partes.push(elipse(x + 0.01, cy + 0.012, rv * 2 + 0.04, rv * 1.3 + 0.04, t.nanquim, zT + 0.008, { contorno: 'leve', detalhe: 2 }), elipse(x, cy, rv * 2, rv * 1.3, t.meio, zT + 0.01, { ...O, detalhe: 2 }));
        const esp: number[] = []; for (let k = 0; k <= 18; k++) { const a = k * 0.62 + (s > 0 ? 0 : Math.PI), rr = rv * (0.9 - k * 0.045); esp.push(x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.62); }
        partes.push(tira(esp, 0.016, t.nanquim, zT + 0.012, { ...O, alfa: 0.8, detalhe: 3 }), elipse(x, cy, rv * 0.32, rv * 0.24, t.brilho, zT + 0.013, { ...O, detalhe: 3 }));
      }
    }
    desgaste(partes, r, ID, D * 0.62, D * 0.98, t, zT + 0.02, 2);
  } else {
    // Coríntia: base ática, fuste com filete, duas coroas de acanto que transbordam e o ábaco de lados côncavos com a flor no meio de cada lado.
    baseAtica(partes, R, t);
    fuste(partes, R, 24, t, zT * 0.55, 0.25);
    for (let coroa = 0; coroa < 2; coroa++) {
      const n = 8, giro = coroa ? Math.PI / 8 : 0, len = D * (coroa ? 0.5 : 0.62), z = zT - 0.1 + coroa * 0.04;
      for (let k = 0; k < n; k++) {
        const a = giro + (k / n) * Math.PI * 2, d = olhar(a), x0 = Math.cos(a) * D * 0.1, y0 = Math.sin(a) * D * 0.1, w = D * 0.3;
        partes.push(lente(x0 + 0.01, y0 + 0.012, a, len + 0.03, w + 0.04, t.nanquim, z, { contorno: 'leve', detalhe: 1 }));
        partes.push(lente(x0, y0, a, len, w, tom(t.base, d * 0.2), z + 0.003, { ...O, detalhe: 1 }));
        // Lóbulos recortados da folha e a nervura do meio.
        for (const s of [-1, 1]) for (let j = 1; j <= 2; j++) { const tt = 0.38 + j * 0.2, px = x0 + Math.cos(a) * len * tt - Math.sin(a) * s * w * 0.32, py = y0 + Math.sin(a) * len * tt + Math.cos(a) * s * w * 0.32; partes.push(lente(px, py, a + s * 0.9, w * 0.32, w * 0.2, tom(t.base, d * 0.2 + (s * d > 0 ? 0.1 : -0.12)), z + 0.005, { ...O, detalhe: 3 })); }
        partes.push(tira([x0, y0, x0 + Math.cos(a) * len * 0.85, y0 + Math.sin(a) * len * 0.85], 0.012, t.sombra, z + 0.006, { ...O, detalhe: 3 }, 0.3));
        partes.push(elipse(x0 + Math.cos(a) * len * 0.92, y0 + Math.sin(a) * len * 0.92, w * 0.22, w * 0.22, t.sombra, z + 0.007, { ...O, detalhe: 3 }));
      }
    }
    // Ábaco de lados côncavos: as quinas avançam sobre as volutinhas (hélices), a flor fica no meio de cada lado.
    const m = D * 0.5, c = D * 0.1, aba: number[] = [];
    for (let lado4 = 0; lado4 < 4; lado4++) for (let k = 0; k < 6; k++) {
      const t6 = k / 6, a = lado4 * Math.PI / 2, px = m, py = -m + t6 * 2 * m, dentro = Math.sin(t6 * Math.PI) * c;
      const lx = px - dentro, ly = py; aba.push(lx * Math.cos(a) - ly * Math.sin(a), lx * Math.sin(a) + ly * Math.cos(a));
    }
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) partes.push(elipse(sx * m * 0.98, sy * m * 0.98, D * 0.16, D * 0.16, t.sombra, zT - 0.01, { contorno: 'leve', detalhe: 2 }), elipse(sx * m * 0.98 - 0.008, sy * m * 0.98 - 0.008, D * 0.08, D * 0.08, t.luz, zT - 0.005, { ...O, detalhe: 3 }));
    partes.push(poli(aba.map((v, i) => v + (i % 2 ? 0.014 : 0.012)), t.nanquim, zT, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(aba, t.meio, zT + 0.004, { ...O, detalhe: 1 }));
    partes.push(poli(aba.map(v => v * 0.8), t.base, zT + 0.006, { ...O, detalhe: 2 }), poli(aba.map((v, i) => v * 0.72 + (i % 2 ? LUZ_Y : LUZ_X) * D * 0.03), t.luz, zT + 0.007, { ...S, detalhe: 2 }));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, x = Math.cos(a) * (m - c * 0.6), y = Math.sin(a) * (m - c * 0.6); partes.push(elipse(x, y, D * 0.15, D * 0.15, t.nanquim, zT + 0.008, { contorno: 'leve', detalhe: 2 }), elipse(x, y, D * 0.12, D * 0.12, t.luz, zT + 0.01, { ...O, detalhe: 2 }), elipse(x, y, D * 0.05, D * 0.05, t.sombra, zT + 0.012, { ...O, detalhe: 3 })); }
  }
  return { pegada: [lado, lado], partes };
}

/** Coluna caída: o fuste deitado em tambores separados, com as caneluras ao comprido, e o capitel dórico tombado na ponta. */
function colunaCaida(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = MARMORE, D = 0.86, n = 7;
  sombraNoChao(partes, [-2.2, -0.35, 1.6, -0.45, 2.25, 0.1, 1.8, 0.6, -2.2, 0.55], 0.02, '#0d0a08', 0.5);
  let u = -2.15;
  const tambores = [1.75, 1.45];
  tambores.forEach((L, i) => {
    const f = quadro(u + L / 2, (r() - 0.5) * 0.12, (r() - 0.5) * 0.06 + (i === 1 ? 0.08 : 0)), v = D / 2, z = 0.5;
    partes.push(poli(em(f, [-L / 2 - 0.02, -v - 0.02, L / 2 + 0.03, -v - 0.02, L / 2 + 0.03, v + 0.04, -L / 2 - 0.02, v + 0.04]), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1, raio: 0.04 }));
    // O cilindro deitado: o tom de cada faixa sai da normal da superfície contra a luz do noroeste e de cima (claro no norte, núcleo
    // de sombra no sul); cada canelura é uma faixa com a borda de cima escura (sombra da aresta) e um filete claro embaixo.
    const tomDe = (sv: number) => tom(t.base, 0.3 - 0.72 * ((sv + 1) / 2) ** 1.4);
    partes.push(poli(em(f, [-L / 2, -v, L / 2, -v, L / 2, v, -L / 2, v]), tomDe(0.95), z + 0.003, { ...O, detalhe: 1 }));
    for (let k = 0; k < n; k++) {
      const s0 = -1 + (k / n) * 2, s1 = -1 + ((k + 1) / n) * 2, sm = (s0 + s1) / 2, cor = tomDe(sm);
      const v0 = Math.sin(s0 * Math.PI / 2) * v, v1 = Math.sin(s1 * Math.PI / 2) * v, dv = v1 - v0;
      partes.push(poli(em(f, [-L / 2, v0, L / 2, v0, L / 2, v1, -L / 2, v1]), cor, z + 0.004, { ...O, detalhe: 1 }));
      if (k > 0) partes.push(tira(em(f, [-L / 2 + 0.02, v0, L / 2 - 0.02, v0]), Math.max(0.012, dv * 0.16), tom(cor, -0.3), z + 0.005, { ...O, alfa: 0.7, detalhe: 3 }));
    }
    partes.push(poli(em(f, [-L / 2 + 0.03, -v * 0.66, L / 2 - 0.03, -v * 0.66, L / 2 - 0.03, -v * 0.46, -L / 2 + 0.03, -v * 0.46]), t.brilho, z + 0.006, { ...S, alfa: 0.7, detalhe: 3 }), poli(em(f, [-L / 2 + 0.02, v * 0.55, L / 2 - 0.02, v * 0.55, L / 2 - 0.02, v * 0.86, -L / 2 + 0.02, v * 0.86]), t.nanquim, z + 0.006, { ...S, alfa: 0.35, detalhe: 2 }));
    // Junta do tambor: as faces das pontas, gastas, com uma lasca às vezes.
    // As juntas dos tambores (linhas finas atravessadas) e as pontas, gastas.
    for (let j = 1; j < Math.round(L / 0.85); j++) { const uj = -L / 2 + (j * L) / Math.round(L / 0.85) + (r() - 0.5) * 0.06; partes.push(tira(em(f, [uj, -v * 0.98, uj + 0.01, 0, uj, v * 0.98]), 0.015, t.nanquim, z + 0.006, { ...O, alfa: 0.3, detalhe: 3 })); }
    for (const s of [-1, 1]) partes.push(poli(em(f, [s * L / 2 - s * 0.05, -v, s * L / 2, -v * 0.9, s * L / 2, v * 0.9, s * L / 2 - s * 0.05, v]), tom(t.sombra, -0.1), z + 0.006, { ...O, alfa: 0.8, detalhe: 2 }));
    if (r() < 0.7) { const s = r() < 0.5 ? -1 : 1; partes.push(poli(em(f, [s * L * 0.3, -v, s * L * 0.45, -v, s * L * 0.38, -v + 0.12]), t.sombra, z + 0.007, { ...O, detalhe: 3 })); }
    u += L + 0.06 + r() * 0.1;
  });
  // A ponta quebrada do último tambor: fratura irregular, mais escura.
  // O capitel dórico tombado: o ábaco de lado (bloco baixo) e o equino abaulado à frente.
  const fc = quadro(1.72, 0.12 + (r() - 0.5) * 0.1, 0.35);
  bloco(partes, fc, 0.28, D * 1.05, t, 0.55, 0.05, 0.35);
  partes.push(poli(em(fc, [0.14, -D * 0.46, 0.38, -D * 0.38, 0.44, 0, 0.38, D * 0.38, 0.14, D * 0.46]), t.nanquim, 0.5, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(em(fc, [0.14, -D * 0.44, 0.36, -D * 0.36, 0.42, 0, 0.36, D * 0.36, 0.14, D * 0.44]), t.base, 0.504, { ...O, detalhe: 1 }), poli(em(fc, [0.14, -D * 0.42, 0.34, -D * 0.33, 0.38, -D * 0.05, 0.14, -D * 0.1]), t.luz, 0.506, { ...S, detalhe: 2 }));
  desgaste(partes, r, fc, 0.28, D * 1.05, t, 0.56, 2);
  // Lascas e pó no chão em volta.
  for (let i = 0; i < 9; i++) { const x = -2 + r() * 4, y = (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.15); partes.push(poli(bolha(x, y, 0.05 + r() * 0.06, 0.04 + r() * 0.04, 6, 0.35, r), tom(t.base, (r() - 0.5) * 0.2), 0.06, { contorno: 'leve', sombraLeve: true, detalhe: 3 })); }
  return partes;
}

/** Frontão caído: o tímpano triangular deitado de face para cima, partido em dois, com cornijas, dentículos e figuras em relevo. */
function frontaoCaido(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = MARMORE_VELHO, W = 2.25, Hb = 0.62, Ht = -0.62, z = 0.42;
  const yS = (x: number, W0: number, base: number, topo: number) => topo + (base - topo) * Math.abs(x) / W0;
  // Corte em zigue-zague entre os dois pedaços, do alto da cornija inclinada até a base.
  const xTopo = 0.55, yTopo = yS(xTopo, W, Hb, Ht), xc = (y: number) => xTopo - ((y - yTopo) / (Hb - yTopo)) * 0.2, corte: number[] = [xTopo, yTopo];
  for (let k = 1; k <= 6; k++) { const y = yTopo + (k / 6) * (Hb - yTopo); corte.push(xc(y) + (k === 6 ? 0 : k % 2 ? 0.07 : -0.04), y); }
  const girar: Quadro = (u, v) => { const c = Math.cos(0.16), s = Math.sin(0.16), du = u - 1.3, dv = v - 0.3; return [1.3 + du * c - dv * s + 0.22, 0.3 + du * s + dv * c + 0.06]; };
  const pedacos: { pts: number[]; f: Quadro; lado: number }[] = [{ pts: [-W, Hb, 0, Ht, ...corte], f: ID, lado: -1 }, { pts: [...corte, W, Hb], f: girar, lado: 1 }];
  sombraNoChao(partes, [-2.3, 0.75, 0, -0.75, 2.5, 0.95], 0.02, '#0d0a08', 0.5);
  for (const { pts, f, lado } of pedacos) {
    const p = em(f, pts);
    partes.push(poli(p.map((v, i) => v + (i % 2 ? 0.05 : 0.04)), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(p, t.base, z + 0.003, { ...O, detalhe: 1 }));
    // As molduras só se desenham do lado do corte que é deste pedaço.
    const dentro = (x: number, y: number) => (lado < 0 ? x < xc(y) - 0.04 : x > xc(y) + 0.04);
    const seg = (a: number, b: number, y: (x: number) => number, k = 12) => Array.from({ length: k + 1 }, (_, i) => a + ((b - a) * i) / k).filter(x => dentro(x, y(x)));
    // Cornijas inclinadas (a da esquerda olha o noroeste e fica clara) e a horizontal, com dentículos por baixo.
    for (const ld of [-1, 1]) {
      const xsL = seg(ld < 0 ? -W + 0.1 : 0, ld < 0 ? 0 : W - 0.1, x => yS(x, W, Hb, Ht) + 0.1);
      if (xsL.length < 2) continue;
      const fora = xsL.flatMap(x => [x, yS(x, W, Hb, Ht) + 0.1]), meio = xsL.flatMap(x => [x, yS(x, W, Hb, Ht) + 0.2]);
      partes.push(tira(em(f, fora), 0.13, ld < 0 ? t.luz : t.meio, z + 0.01, { ...O, detalhe: 1 }), tira(em(f, meio), 0.05, t.sombra, z + 0.011, { ...O, detalhe: 2 }), tira(em(f, fora.map((v, i) => (i % 2 ? v - 0.05 : v))), 0.025, t.brilho, z + 0.012, { ...O, alfa: 0.8, detalhe: 3 }));
    }
    const xsB = seg(-W + 0.4, W - 0.4, () => Hb - 0.08, 30);
    if (xsB.length >= 2) {
      partes.push(tira(em(f, [xsB[0]!, Hb - 0.08, xsB[xsB.length - 1]!, Hb - 0.08]), 0.12, t.meio, z + 0.01, { ...O, detalhe: 1 }), tira(em(f, [xsB[0]!, Hb - 0.02, xsB[xsB.length - 1]!, Hb - 0.02]), 0.03, t.sombra, z + 0.011, { ...O, detalhe: 2 }));
      for (let x = -W + 0.45; x < W - 0.4; x += 0.13) if (dentro(x, Hb - 0.2)) partes.push(poli(em(f, [x - 0.04, Hb - 0.25, x + 0.04, Hb - 0.25, x + 0.04, Hb - 0.16, x - 0.04, Hb - 0.16]), t.luz, z + 0.012, { contorno: 'leve', detalhe: 3 }));
    }
    // Tímpano rebaixado (mais escuro) e as figuras em relevo: um deus em pé no meio, sentados e reclinados para as pontas.
    const Wi = W - 0.7, Bi = Hb - 0.3, Ti = Ht + 0.38, xsT = seg(-Wi, Wi, x => (yS(x, Wi, Bi, Ti) + Bi) / 2, 20);
    if (xsT.length >= 2) partes.push(poli(em(f, [...xsT.flatMap(x => [x, yS(x, Wi, Bi, Ti)]), xsT[xsT.length - 1]!, Bi, xsT[0]!, Bi]), t.sombra, z + 0.008, { ...O, alfa: 0.7, detalhe: 2 }));
    const figura = (x: number, yPe: number, alto: number, deitada: boolean) => {
      if (!dentro(x - 0.12, yPe - alto * 0.5) || !dentro(x + 0.12, yPe - alto * 0.5)) return;
      const corpo = deitada ? [x - alto * 0.5, yPe, x - alto * 0.45, yPe - 0.12, x + alto * 0.2, yPe - 0.16, x + alto * 0.45, yPe - 0.06, x + alto * 0.5, yPe] : [x - 0.1, yPe, x - 0.12, yPe - alto * 0.55, x - 0.06, yPe - alto * 0.78, x + 0.06, yPe - alto * 0.78, x + 0.12, yPe - alto * 0.55, x + 0.1, yPe];
      const cab = deitada ? [x - alto * 0.42, yPe - 0.2] : [x, yPe - alto * 0.88];
      partes.push(poli(em(f, corpo.map((v, i) => v + (i % 2 ? 0.025 : 0.02))), t.nanquim, z + 0.013, { ...O, alfa: 0.75, detalhe: 2 }), poli(em(f, corpo), t.luz, z + 0.014, { ...O, detalhe: 2 }));
      const [hx, hy] = f(cab[0]!, cab[1]!);
      partes.push(elipse(hx + 0.02, hy + 0.025, 0.11, 0.11, t.nanquim, z + 0.013, { ...O, alfa: 0.75, detalhe: 2 }), elipse(hx, hy, 0.1, 0.1, t.brilho, z + 0.015, { ...O, detalhe: 2 }));
    };
    figura(0, Bi, 0.62, false); figura(-0.55, Bi, 0.42, false); figura(0.75, Bi, 0.42, false); figura(-1.05, Bi, 0.5, true); figura(1.15, Bi, 0.5, true);
  }
  // A fratura: a borda do corte escura, e lascas soltas no vão.
  partes.push(tira(corte.map((v, i) => v + (i % 2 ? 0 : 0.03)), 0.05, t.nanquim, z + 0.016, { ...O, alfa: 0.7, detalhe: 2 }));
  for (let i = 0; i < 8; i++) partes.push(poli(bolha(0.5 + (r() - 0.3) * 0.5, Ht + 0.4 + r() * 1.1, 0.05 + r() * 0.06, 0.04 + r() * 0.05, 6, 0.35, r), tom(t.base, (r() - 0.5) * 0.2), 0.08, { contorno: 'leve', sombraLeve: true, detalhe: 3 }));
  for (let i = 0; i < 4; i++) partes.push(elipse(-1.6 + r() * 3.2, Hb - 0.1 - r() * 0.3, 0.2, 0.08, '#5a6a44', z + 0.017, { ...S, alfa: 0.35, detalhe: 3 }));
  return partes;
}

/** Obelisco: o plinto, o fuste de granito afunilado (as quatro faces em tons de luz, com sinais incisos) e o piramídio dourado. */
function obelisco(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = GRANITO, B = 0.6, T = 0.3;
  sombraNoChao(partes, bolha(0, 0, 1.0, 1.0, 16, 0.03, r), 0.02, '#0d0a08', 0.4);
  bloco(partes, ID, 1.9, 1.9, ARENITO, 0.25, 0.14);
  bloco(partes, ID, 1.4, 1.4, ARENITO, 0.42, 0.1);
  desgaste(partes, r, ID, 1.9, 1.9, ARENITO, 0.25, 4);
  partes.push(ret(0.02, 0.03, B * 2 + 0.06, B * 2 + 0.06, t.nanquim, 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  const faces: [number[], number][] = [[[-B, -B, B, -B, T, -T, -T, -T], -Math.PI / 2], [[B, -B, B, B, T, T, T, -T], 0], [[B, B, -B, B, -T, T, T, T], Math.PI / 2], [[-B, B, -B, -B, -T, -T, -T, T], Math.PI]];
  for (const [pts, n] of faces) {
    const d = olhar(n);
    partes.push(poli(pts, d > 0.3 ? t.luz : d > -0.3 ? t.base : t.sombra, 1.0, { ...O, detalhe: 1 }));
    // Uma coluna de sinais incisos no meio de cada face (do pé ao topo, encolhendo com o afunilamento).
    const c = Math.cos(n), s = Math.sin(n);
    for (let k = 0; k < 6; k++) { const tt = 0.15 + k * 0.13, d0 = B - (B - T) * tt, w = 0.08 * (1 - tt * 0.4); partes.push(ret(c * (d0 - 0.0) + 0, s * (d0 - 0.0), Math.abs(c) > 0.5 ? 0.03 : w, Math.abs(c) > 0.5 ? w : 0.03, tom(d > 0.3 ? t.luz : t.base, -0.35), 1.01, { ...O, detalhe: 3 })); }
  }
  partes.push(ret(0, 0, T * 2, T * 2, t.meio, 1.15, { contorno: 'leve', detalhe: 1 }));
  // Piramídio de electro: quatro triângulos, o do norte e o do oeste na luz.
  const tri: [number[], number][] = [[[-T, -T, T, -T, 0, 0], -Math.PI / 2], [[T, -T, T, T, 0, 0], 0], [[T, T, -T, T, 0, 0], Math.PI / 2], [[-T, T, -T, -T, 0, 0], Math.PI]];
  for (const [pts, n] of tri) partes.push(poli(pts.map(v => v * 0.92), tomDaFace(OURO, olhar(n)), 1.3, { contorno: 'leve', detalhe: 1 }));
  partes.push(tira([-T * 0.92, -T * 0.92, 0, 0], 0.014, OURO.brilho, 1.31, { ...O, detalhe: 3 }, 0.4));
  // Areia acumulada no pé do plinto.
  for (let i = 0; i < 5; i++) { const a = r() * 6.28; partes.push(poli(bolha(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.22, 0.1, 8, 0.3, r, a), '#c8aa78', 0.27, { ...S, alfa: 0.6, detalhe: 3 })); }
  return partes;
}

/** Figura clássica vista de cima (cabeça para −y, frente para +y), em escala 1: manto, ombros, braços conforme a `pose`, cabeça com coroa de louros. */
function figuraClassica(pose: number, t: Tons, z: number, r: () => number): Parte[] {
  const ps: Parte[] = [], N = { contorno: 'leve' as const, detalhe: 1 as const };
  // Manto (himátion): a saia que cai até os pés aparece em volta e à frente dos ombros.
  partes2(ps, [-0.36, -0.12, -0.3, 0.32, -0.12, 0.44, 0.14, 0.44, 0.32, 0.3, 0.36, -0.1, 0.2, -0.24, -0.2, -0.24], t, z - 0.25);
  for (let k = 0; k < 6; k++) { const x = -0.26 + k * 0.1; ps.push(tira([x, 0.06, x + 0.02, 0.24, x - 0.01, 0.4], 0.018, t.sombra, z - 0.24, { ...O, alfa: 0.7, detalhe: 3 }, 0.3)); }
  // Ombros e tórax, com o manto passando pelo ombro esquerdo.
  partes2(ps, [-0.34, -0.02, -0.3, -0.16, -0.12, -0.22, 0.12, -0.22, 0.3, -0.16, 0.34, -0.02, 0.24, 0.1, -0.24, 0.1], t, z - 0.1);
  ps.push(poli([-0.34, -0.02, -0.2, -0.2, -0.04, -0.21, 0.1, 0.1, -0.24, 0.1], t.sombra, z - 0.09, { ...O, alfa: 0.55, detalhe: 2 }));
  const braco = (pts: number[], w: number) => { ps.push(tira(pts.map((v, i) => v + (i % 2 ? 0.014 : 0.012)), w + 0.04, t.nanquim, z - 0.12, { ...O, ...N }), tira(pts, w, t.meio, z - 0.115, { ...O, detalhe: 1 }), tira(pts.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * w * 0.2), w * 0.4, t.luz, z - 0.11, { ...O, detalhe: 2 })); };
  if (pose === 0) {
    // Cetro: braço direito aberto para o lado segurando o cetro, o esquerdo junto ao corpo sob o manto.
    braco([0.3, -0.1, 0.48, -0.16, 0.6, -0.2], 0.11);
    ps.push(tira([0.66, -0.62, 0.6, -0.2, 0.55, 0.42], 0.045, BRONZE.nanquim, z + 0.05, { ...O, detalhe: 1 }), tira([0.66, -0.62, 0.6, -0.2, 0.55, 0.42], 0.025, BRONZE.luz, z + 0.06, { ...O, detalhe: 2 }));
    ps.push(elipse(0.66, -0.64, 0.09, 0.09, OURO.luz, z + 0.07, { contorno: 'leve', detalhe: 2 }));
    braco([-0.3, -0.05, -0.36, 0.1, -0.32, 0.22], 0.1);
  } else if (pose === 1) {
    // Escudo e lança: o escudo redondo apoiado no chão à esquerda, a lança inclinada na mão direita.
    braco([0.3, -0.1, 0.42, 0.02, 0.44, 0.12], 0.1);
    ps.push(tira([0.32, 0.5, 0.44, 0.12, 0.62, -0.62], 0.045, BRONZE.nanquim, z + 0.05, { ...O, detalhe: 1 }), tira([0.32, 0.5, 0.44, 0.12, 0.62, -0.62], 0.024, BRONZE.luz, z + 0.06, { ...O, detalhe: 2 }), lente(0.62, -0.62, -1.33, 0.14, 0.06, BRONZE.brilho, z + 0.07, { contorno: 'leve', detalhe: 2 }));
    braco([-0.3, -0.05, -0.42, 0.04], 0.1);
    ps.push(elipse(-0.52, 0.12, 0.2, 0.62, t.nanquim, z - 0.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(-0.52, 0.12, 0.16, 0.58, t.meio, z - 0.19, { ...O, detalhe: 1 }), elipse(-0.535, 0.1, 0.07, 0.44, t.luz, z - 0.18, { ...O, detalhe: 2 }), elipse(-0.51, 0.12, 0.08, 0.12, t.sombra, z - 0.17, { contorno: 'leve', detalhe: 3 }));
  } else {
    // Oferenda: os dois braços à frente segurando a pátera (taça rasa).
    braco([0.28, -0.08, 0.26, 0.12, 0.1, 0.3], 0.1); braco([-0.28, -0.08, -0.26, 0.12, -0.1, 0.3], 0.1);
    disco(ps, 0, 0.34, 0.11, BRONZE, z + 0.02);
    ps.push(elipse(0, 0.34, 0.12, 0.12, PATINA, z + 0.04, { ...O, alfa: 0.55, detalhe: 3 }));
  }
  // Cabeça: cachos em volta, coroa de louros, o rosto virado para +y.
  ps.push(elipse(0.012, -0.03, 0.31, 0.32, t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  disco(ps, 0, -0.04, 0.135, t, z + 0.01, 0.14);
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; ps.push(elipse(Math.cos(a) * 0.1, -0.05 + Math.sin(a) * 0.1, 0.06, 0.06, tom(t.base, olhar(a) * 0.2 - 0.04), z + 0.03, { ...O, detalhe: 3 })); }
  if (pose === 1) ps.push(tira([0, -0.22, 0, 0.08], 0.06, t.nanquim, z + 0.04, { ...O, detalhe: 2 }), tira([0, -0.22, 0, 0.08], 0.035, t.brilho, z + 0.045, { ...O, detalhe: 2 }));   // crista do elmo
  else for (let k = 0; k < 9; k++) { const a = Math.PI * 1.1 + (k / 8) * Math.PI * 0.8 + (k > 4 ? Math.PI * 0.05 : 0); ps.push(lente(Math.cos(a) * 0.1, -0.05 + Math.sin(a) * 0.1, a + Math.PI / 2, 0.07, 0.035, '#6f7a54', z + 0.04, { ...O, detalhe: 3 })); }
  ps.push(elipse(0, 0.09, 0.05, 0.04, t.meio, z + 0.02, { contorno: 'leve', detalhe: 3 }));
  // Pátina e manchas de chuva nas dobras.
  for (let k = 0; k < 3; k++) ps.push(elipse(-0.2 + r() * 0.4, 0.15 + r() * 0.2, 0.12, 0.06, '#6e7466', z - 0.22, { ...S, alfa: 0.35, detalhe: 3 }));
  return ps;
}

/** Uma massa de figura em volume: nanquim, base, meio para o noroeste e luz. */
function partes2(ps: Parte[], pts: number[], t: Tons, z: number): void {
  let cx = 0, cy = 0, x0 = Infinity, x1 = -Infinity; for (let i = 0; i < pts.length; i += 2) { cx += pts[i]!; cy += pts[i + 1]!; x0 = Math.min(x0, pts[i]!); x1 = Math.max(x1, pts[i]!); }
  cx /= pts.length / 2; cy /= pts.length / 2;
  const tam = x1 - x0, k = (s: number, d: number) => pts.map((v, i) => (i % 2 ? cy + (v - cy) * s + LUZ_Y * d * tam : cx + (v - cx) * s + LUZ_X * d * tam));
  ps.push(poli(pts.map((v, i) => v + (i % 2 ? 0.016 : 0.014)), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  // A base é a sombra: o tom da base, o meio e a luz vão para o noroeste e deixam a borda do sudeste escura.
  ps.push(poli(pts, t.sombra, z + 0.003, { ...O, detalhe: 1 }));
  ps.push(poli(k(0.9, 0.035), t.base, z + 0.005, { ...S, detalhe: 1 }));
  ps.push(poli(k(0.72, 0.07), t.meio, z + 0.007, { ...S, detalhe: 1 }));
  ps.push(poli(k(0.42, 0.12), t.luz, z + 0.009, { ...S, detalhe: 2 }));
}

/** Escala (e desloca) uma lista de partes ao redor da origem. */
function escalar(ps: Parte[], k: number, dx = 0, dy = 0): Parte[] {
  return ps.map(p => (p.pts ? { ...p, pts: p.pts.map((v, i) => v * k + (i % 2 ? dy : dx)) } : { ...p, x: p.x! * k + dx, y: p.y! * k + dy, w: p.w! * k, h: p.h! * k, ...(p.desfoque ? { desfoque: p.desfoque * k } : {}) }));
}

/** Estátua clássica de mármore sobre pedestal de dois degraus; `pose` 0 cetro, 1 escudo e lança, 2 oferenda. */
function estatuaClassica(seed: number, pose: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, bolha(0, 0, 0.95, 0.95, 16, 0.03, r), 0.02, '#0d0a08', 0.45);
  bloco(partes, ID, 1.7, 1.7, MARMORE_VELHO, 0.3, 0.12);
  bloco(partes, ID, 1.25, 1.25, MARMORE_VELHO, 0.7, 0.09);
  desgaste(partes, r, ID, 1.7, 1.7, MARMORE_VELHO, 0.3, 3);
  partes.push(...escalar(figuraClassica(pose, MARMORE, 1.4, r), 1.32, 0, -0.04));
  return partes;
}

/** Busto em pedestal: o pilar (herma) de mármore e o busto de ombros largos, cabeça cacheada e, às vezes, barba. */
function busto(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = MARMORE, barba = r() < 0.5;
  sombraNoChao(partes, bolha(0, 0, 0.34, 0.34, 12, 0.04, r), 0.02, '#0d0a08', 0.45);
  bloco(partes, ID, 0.6, 0.6, MARMORE_VELHO, 0.9, 0.06);
  bloco(partes, ID, 0.5, 0.5, MARMORE_VELHO, 0.95, 0.04);
  // Busto: o peito com a toga cruzada e os ombros cortados retos.
  partes2(partes, [-0.3, -0.02, -0.26, -0.1, -0.1, -0.12, 0.1, -0.12, 0.26, -0.1, 0.3, -0.02, 0.24, 0.16, -0.24, 0.16], t, 1.15);
  for (let k = 0; k < 4; k++) partes.push(tira([-0.2 + k * 0.05, 0.02, -0.05 + k * 0.08, 0.14], 0.012, t.sombra, 1.17, { ...O, alfa: 0.7, detalhe: 3 }, 0.3));
  partes.push(elipse(0.01, -0.03, 0.24, 0.25, t.nanquim, 1.22, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  disco(partes, 0, -0.04, 0.105, t, 1.23, 0.11);
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2 + Math.PI; partes.push(elipse(Math.cos(a) * 0.075, -0.05 + Math.sin(a) * 0.075, 0.045, 0.045, tom(t.base, olhar(a) * 0.2), 1.25, { ...O, detalhe: 3 })); }
  partes.push(elipse(0, 0.07, 0.04, 0.035, t.meio, 1.25, { contorno: 'leve', detalhe: 3 }));
  if (barba) partes.push(elipse(0, 0.04, 0.12, 0.07, t.sombra, 1.24, { contorno: 'leve', detalhe: 2 }), elipse(-0.01, 0.035, 0.07, 0.04, t.base, 1.245, { ...O, detalhe: 3 }));
  return partes;
}

/** Brasas e chamas que brilham (cores escuras e saturadas: a emissão multiplica por até 3), num disco de raio `R`. */
function fogoQueBrilha(partes: Parte[], r: () => number, R: number, z: number): void {
  partes.push(elipse(0, 0, R * 2, R * 2, '#2a0a04', z, { ...O, detalhe: 1 }));
  for (let k = 0; k < 16; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.85; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.06 + r() * 0.05, 0.05 + r() * 0.04, r() < 0.35 ? '#1a0e0a' : r() < 0.5 ? '#8a2206' : '#a8380a', z + 0.005, { ...O, brilho: true, detalhe: 2 })); }
  const macio = (pts: number[], c: string, zz: number, alfa: number, d: number): Parte => poli(pts, c, zz, { ...O, alfa, desfoque: d, brilho: true, detalhe: 2 });
  for (let k = 0; k < 7; k++) { const a = (k / 7) * 6.28 + r() * 0.5, d = R * 0.35; partes.push(macio(bolha(Math.cos(a) * d, Math.sin(a) * d, R * 0.42, R * 0.3, 9, 0.3, r, a), '#a8340a', z + 0.02 + k * 0.001, 0.85, 0.03)); }
  partes.push(macio(bolha(0, 0, R * 0.62, R * 0.62, 12, 0.22, r), '#b8480c', z + 0.03, 0.9, 0.03));
  partes.push(macio(bolha(0.01, 0.01, R * 0.4, R * 0.4, 10, 0.2, r), '#c06414', z + 0.035, 0.92, 0.025));
  partes.push(elipse(0, 0, R * 0.36, R * 0.36, '#c88a2a', z + 0.04, { ...O, desfoque: 0.02, brilho: true, detalhe: 2 }));
  for (let k = 0; k < 8; k++) { const a = r() * 6.28, d = R * (0.9 + r() * 0.3); partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.025, 0.025, '#c0600e', z + 0.05, { ...O, alfa: 0.9, desfoque: 0.006, brilho: true, detalhe: 3 })); }
}

/** Tripé de bronze: três pernas de pata de leão abertas, a bacia com pátina e o fogo que brilha; o clarão no chão cabe na pegada. */
function tripe(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.3, giro = r() * 6.28;
  partes.push(elipse(0, 0, 0.92, 0.92, '#7a2806', 0.01, { ...O, brilho: true, alfa: 0.3, desfoque: 0.1, detalhe: 1 }));
  for (let k = 0; k < 3; k++) {
    const a = giro + (k / 3) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), ex = c * 0.48, ey = s * 0.48;
    partes.push(tira([c * 0.22, s * 0.22, c * 0.36, s * 0.36, ex, ey], 0.08, BRONZE.nanquim, 0.6, { contorno: 'leve', detalhe: 1 }), tira([c * 0.22, s * 0.22, c * 0.36, s * 0.36, ex, ey], 0.045, tom(BRONZE.base, olhar(a) * 0.2), 0.605, { ...O, detalhe: 2 }));
    // Pata de leão: almofada e três dedos.
    partes.push(elipse(ex + c * 0.03, ey + s * 0.03, 0.12, 0.1, BRONZE.nanquim, 0.1, { contorno: 'leve', detalhe: 2 }), elipse(ex + c * 0.03, ey + s * 0.03, 0.09, 0.075, BRONZE.meio, 0.105, { ...O, detalhe: 2 }));
    for (const d of [-0.5, 0, 0.5]) partes.push(elipse(ex + Math.cos(a + d) * 0.08, ey + Math.sin(a + d) * 0.08, 0.035, 0.035, BRONZE.luz, 0.11, { ...O, detalhe: 3 }));
  }
  // A bacia: aro de bronze com pátina verde e o fogo dentro.
  partes.push(elipse(0.012, 0.014, R * 2 + 0.1, R * 2 + 0.1, BRONZE.nanquim, 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(elipse(0, 0, R * 2 + 0.06, R * 2 + 0.06, BRONZE.base, 1.203, { ...O, detalhe: 1 }), elipse(LUZ_X * 0.02, LUZ_Y * 0.02, R * 2 + 0.03, R * 2 + 0.03, BRONZE.luz, 1.205, { ...O, detalhe: 2 }), elipse(0, 0, R * 2 - 0.02, R * 2 - 0.02, BRONZE.sombra, 1.207, { ...O, detalhe: 1 }));
  for (let k = 0; k < 5; k++) { const a = r() * 6.28; partes.push(elipse(Math.cos(a) * (R + 0.01), Math.sin(a) * (R + 0.01), 0.08, 0.05, PATINA, 1.208, { ...O, alfa: 0.7, detalhe: 3 })); }
  fogoQueBrilha(partes, r, R - 0.04, 1.21);
  return partes;
}

/** Altar de sacrifício romano: plataforma, bloco com pulvinos nas pontas, o foco com cinza e brasa, sangue escorrido e louros. */
function altar(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = MARMORE;
  sombraNoChao(partes, [-0.95, -0.7, 0.95, -0.7, 0.95, 0.7, -0.95, 0.7], 0.02, '#0d0a08', 0.4);
  bloco(partes, ID, 1.9, 1.45, MARMORE_VELHO, 0.15, 0.08);
  desgaste(partes, r, ID, 1.9, 1.45, MARMORE_VELHO, 0.15, 3);
  bloco(partes, ID, 1.36, 0.86, t, 0.9, 0.07);
  // Pulvinos: rolos ao longo de y nas pontas, com rosetas nas cabeças.
  for (const s of [-1, 1]) {
    const x = s * 0.58, w = 0.2, h = 0.86;
    partes.push(ret(x + 0.012, 0.014, w + 0.04, h + 0.04, t.nanquim, 0.98, { contorno: 'leve', sombraLeve: true, raio: 0.1, detalhe: 1 }));
    for (let k = 0; k < 4; k++) partes.push(ret(x - w / 2 + (k + 0.5) * (w / 4), 0, w / 4 + 0.002, h, tom(t.base, 0.22 - k * 0.14), 0.985, { ...O, detalhe: 1 }));
    for (const sy of [-1, 1]) partes.push(elipse(x, sy * h * 0.48, 0.2, 0.08, t.meio, 0.99, { contorno: 'leve', detalhe: 2 }), elipse(x, sy * h * 0.48, 0.07, 0.04, t.sombra, 0.995, { ...O, detalhe: 3 }));
    partes.push(ret(x, 0, w * 1.02, 0.08, t.sombra, 0.99, { ...O, detalhe: 2 }));
  }
  // O foco: bacia rasa de bronze com cinza e umas brasas.
  partes.push(elipse(0.01, 0.012, 0.6, 0.46, t.nanquim, 0.95, { contorno: 'leve', detalhe: 1 }), elipse(0, 0, 0.56, 0.42, BRONZE.base, 0.955, { ...O, detalhe: 1 }), elipse(0, 0, 0.46, 0.33, '#5a524a', 0.96, { ...O, detalhe: 1 }));
  for (let k = 0; k < 10; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.16; partes.push(elipse(Math.cos(a) * d * 1.3, Math.sin(a) * d, 0.05 + r() * 0.04, 0.04, r() < 0.4 ? '#8a8078' : r() < 0.6 ? '#7a2006' : CINZA, 0.965, { ...O, detalhe: 3 })); }
  for (let k = 0; k < 4; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.1; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.04, 0.035, '#9a2a08', 0.97, { ...O, brilho: true, detalhe: 3 })); }
  // Sangue escorrido pela borda da frente e louros espalhados no tampo.
  for (let k = 0; k < 3; k++) { const x = -0.3 + r() * 0.6; partes.push(tira([x, 0.2, x + (r() - 0.5) * 0.05, 0.36, x + (r() - 0.5) * 0.06, 0.43], 0.03 + r() * 0.02, '#4a0e0a', 0.97, { ...O, alfa: 0.8, detalhe: 3 }, 0.5)); }
  for (let k = 0; k < 7; k++) partes.push(lente(-0.4 + r() * 0.8, (r() < 0.5 ? -1 : 1) * (0.28 + r() * 0.08), r() * 6.28, 0.07, 0.03, k % 2 ? '#4e6a34' : '#6a8442', 0.975, { ...O, detalhe: 3 }));
  // Faca de sacrifício pousada na plataforma.
  partes.push(tira([0.5, 0.56, 0.78, 0.6], 0.03, '#c8ccd4', 0.2, { contorno: 'leve', detalhe: 3 }, 0.4), ret(0.45, 0.555, 0.09, 0.035, '#4a3020', 0.2, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Contorno de nemes (o toucado listrado do faraó) visto de cima: a calota, as abas que caem nos ombros e a trança atrás. */
function nemes(ps: Parte[], x: number, y: number, k: number, pedra: Tons, z: number, pintado = true): void {
  // Abas (lapelas) que caem à frente dos ombros, com listras.
  for (const s of [-1, 1]) {
    const pts = [x + s * 0.1 * k, y - 0.02 * k, x + s * 0.2 * k, y + 0.04 * k, x + s * 0.2 * k, y + 0.22 * k, x + s * 0.12 * k, y + 0.24 * k, x + s * 0.09 * k, y + 0.06 * k];
    ps.push(poli(pts.map((v, i) => v + (i % 2 ? 0.012 : 0.01)), pedra.nanquim, z - 0.02, { contorno: 'leve', detalhe: 1 }), poli(pts, pintado ? OURO.meio : (s < 0 ? pedra.luz : pedra.base), z - 0.015, { ...O, detalhe: 1 }));
    for (let j = 0; j < 4; j++) { const yy = y + (0.06 + j * 0.05) * k; ps.push(ret(x + s * 0.15 * k, yy, 0.09 * k, 0.022 * k, pintado ? AZUL : pedra.sombra, z - 0.01, { ...O, alfa: pintado ? 1 : 0.7, detalhe: 2 })); }
  }
  // Trança (a cauda do nemes) atrás.
  ps.push(ret(x + 0.01, y - 0.2 * k, 0.1 * k, 0.16 * k, pedra.nanquim, z - 0.02, { contorno: 'leve', raio: 0.03 * k, detalhe: 2 }), ret(x, y - 0.2 * k, 0.08 * k, 0.14 * k, pintado ? OURO.base : pedra.meio, z - 0.015, { ...O, raio: 0.03 * k, detalhe: 2 }));
  // Calota: listras concêntricas ouro e azul, mais claras para o noroeste.
  disco(ps, x, y, 0.155 * k, pintado ? OURO : pedra, z + 0.003);
  // As listras do nemes: arcos finos só nas laterais da calota (em cima o pano é liso).
  for (let j = 0; j < 3; j++) for (const s of [-1, 1]) { const rr = (0.145 - j * 0.022) * k, arco: number[] = []; for (let i = 0; i <= 8; i++) { const a = Math.PI / 2 + s * (Math.PI * 0.18 + (i / 8) * Math.PI * 0.62); arco.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ps.push(tira(arco, 0.014 * k, pintado ? AZUL : pedra.sombra, z + 0.02, { ...O, alfa: pintado ? 0.9 : 0.6, detalhe: 3 })); }
  // Ureu (a naja na testa) virado para a frente.
  ps.push(elipse(x, y + 0.15 * k, 0.05 * k, 0.06 * k, OURO.brilho, z + 0.02, { contorno: 'leve', detalhe: 3 }), elipse(x, y + 0.17 * k, 0.02 * k, 0.02 * k, VERMELHO, z + 0.021, { ...O, detalhe: 3 }));
}

/** Faraó sentado no trono-bloco, de frente para +y: nemes, colar largo, mãos nos joelhos e os pés no escabelo. */
function estatuaEgipcia(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = ARENITO;
  sombraNoChao(partes, [-0.72, -1.1, 0.72, -1.1, 0.72, 1.1, -0.72, 1.1], 0.02, '#0d0a08', 0.45);
  bloco(partes, ID, 1.36, 2.1, GRANITO, 0.25, 0.1);
  desgaste(partes, r, ID, 1.36, 2.1, GRANITO, 0.25, 3);
  // Trono: bloco atrás e dos lados do corpo, com o sinal da união das Duas Terras gravado no lado.
  bloco(partes, quadro(0, -0.38), 1.04, 1.0, t, 0.75, 0.07);
  for (const s of [-1, 1]) partes.push(elipse(s * 0.43, -0.3, 0.08, 0.24, t.sombra, 0.76, { ...O, alfa: 0.6, detalhe: 3 }));
  // Escabelo e pés.
  bloco(partes, quadro(0, 0.75), 0.62, 0.32, t, 0.38, 0.04);
  for (const s of [-1, 1]) partes.push(elipse(s * 0.1 + 0.01, 0.76, 0.14, 0.26, t.nanquim, 0.42, { contorno: 'leve', detalhe: 2 }), elipse(s * 0.1, 0.75, 0.11, 0.23, t.meio, 0.425, { ...O, detalhe: 2 }));
  // Coxas e mãos espalmadas nos joelhos.
  for (const s of [-1, 1]) {
    partes.push(ret(s * 0.13 + 0.012, 0.12, 0.25, 0.66, t.nanquim, 1.0, { contorno: 'leve', sombraLeve: true, raio: 0.08, detalhe: 1 }), ret(s * 0.13, 0.1, 0.22, 0.62, s < 0 ? t.luz : t.meio, 1.005, { ...O, raio: 0.07, detalhe: 1 }));
    partes.push(ret(s * 0.13, 0.2, 0.16, 0.24, tom(s < 0 ? t.luz : t.meio, 0.1), 1.02, { contorno: 'leve', raio: 0.05, detalhe: 2 }));
    for (let j = 0; j < 4; j++) partes.push(ret(s * 0.13 - 0.06 + j * 0.04, 0.3, 0.012, 0.06, t.sombra, 1.025, { ...O, detalhe: 3 }));
  }
  partes.push(ret(0, 0.0, 0.1, 0.5, VERMELHO, 1.01, { ...O, alfa: 0.4, detalhe: 3 }));   // avental (shendyt) pintado
  // Ombros e tronco, o colar largo (wesekh) em faixas sobre o peito.
  partes2(partes, [-0.36, -0.4, -0.32, -0.54, -0.12, -0.6, 0.12, -0.6, 0.32, -0.54, 0.36, -0.4, 0.26, -0.24, -0.26, -0.24], t, 1.3);
  [OURO.luz, AZUL, VERMELHO, TURQUESA, OURO.base].forEach((c, j) => { const rr = 0.2 - j * 0.028; const arco: number[] = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * 0.12 + (k / 10) * Math.PI * 0.76; arco.push(Math.cos(a) * rr, -0.46 + Math.sin(a) * rr * 0.9); } partes.push(tira(arco, 0.03, c, 1.32 + j * 0.002, { ...O, alfa: 0.85, detalhe: 2 })); });
  nemes(partes, 0, -0.48, 1, t, 1.45);
  // Barba postiça e nariz, virados para a frente.
  partes.push(ret(0, -0.29, 0.05, 0.08, t.nanquim, 1.46, { contorno: 'leve', raio: 0.02, detalhe: 3 }));
  return partes;
}

/** Esfinge deitada no plinto, de frente para +y: corpo de leão com ancas e cauda, patas estendidas e cabeça de nemes. */
function esfinge(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = ARENITO;
  sombraNoChao(partes, [-1.15, -2.1, 1.15, -2.1, 1.15, 2.1, -1.15, 2.1], 0.02, '#0d0a08', 0.45);
  bloco(partes, ID, 2.3, 4.2, { ...ARENITO, base: '#9a7c54', meio: '#ae8e62', luz: '#c4a476' }, 0.3, 0.14);
  desgaste(partes, r, ID, 2.3, 4.2, ARENITO, 0.3, 5);
  // Ancas (patas traseiras dobradas) e a cauda que contorna a anca direita.
  for (const s of [-1, 1]) partes2(partes, silhuetaDeDiscos([{ x: s * 0.5, y: -1.3, r: 0.32 }, { x: s * 0.42, y: -0.9, r: 0.24 }], 40, s * 0.47, -1.15), t, 0.75);
  partes.push(tira([0.42, -1.72, 0.72, -1.66, 0.86, -1.4, 0.86, -1.05, 0.76, -0.86], 0.07, t.nanquim, 0.8, { contorno: 'leve', detalhe: 2 }, 0.6), tira([0.42, -1.72, 0.72, -1.66, 0.86, -1.4, 0.86, -1.05, 0.76, -0.86], 0.04, t.meio, 0.805, { ...O, detalhe: 2 }, 0.6));
  // Patas da frente estendidas, com os dedos.
  for (const s of [-1, 1]) {
    partes.push(ret(s * 0.38 + 0.012, 1.15, 0.34, 1.4, t.nanquim, 0.62, { contorno: 'leve', sombraLeve: true, raio: 0.12, detalhe: 1 }), ret(s * 0.38, 1.13, 0.3, 1.36, s < 0 ? t.meio : t.base, 0.625, { ...O, raio: 0.11, detalhe: 1 }), ret(s * 0.38 - 0.06, 1.1, 0.1, 1.2, t.luz, 0.63, { ...S, raio: 0.05, detalhe: 2 }));
    for (const d of [-0.09, 0, 0.09]) partes.push(ret(s * 0.38 + d, 1.76, 0.012, 0.09, t.nanquim, 0.635, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  // Corpo: o dorso longo, mais largo nos ombros, com a espinha.
  partes2(partes, silhuetaDeDiscos([{ x: 0, y: 0.35, r: 0.46 }, { x: 0, y: -0.1, r: 0.58 }, { x: 0, y: -0.7, r: 0.5 }, { x: 0, y: -1.2, r: 0.52 }], 64, 0, -0.4), t, 1.0);
  partes.push(tira([0, -1.55, 0.02, -0.8, 0, 0.2], 0.04, t.sombra, 1.015, { ...O, alfa: 0.6, detalhe: 3 }, 0.4));
  for (let k = 0; k < 4; k++) partes.push(tira([0.15, -1.2 + k * 0.32, 0.5, -1.15 + k * 0.32], 0.02, t.sombra, 1.014, { ...O, alfa: 0.5, detalhe: 3 }, 0.3));
  // Cabeça com nemes, ampliada para a escala do corpo.
  nemes(partes, 0, 0.62, 2.1, t, 1.35, false);
  partes.push(ret(0, 1.02, 0.12, 0.14, t.nanquim, 1.36, { contorno: 'leve', raio: 0.04, detalhe: 3 }), ret(-0.01, 1.01, 0.08, 0.1, t.luz, 1.365, { ...O, raio: 0.03, detalhe: 3 }));
  // Areia acumulada e rachaduras.
  for (let i = 0; i < 6; i++) { const lado = r() < 0.5 ? -1 : 1; partes.push(poli(bolha(lado * (0.9 + r() * 0.15), -1.6 + r() * 3.4, 0.16, 0.34, 8, 0.3, r), '#c8aa78', 0.32, { ...S, alfa: 0.65, detalhe: 3 })); }
  return partes;
}

/** Sarcófago antropoide: máscara de ouro, nemes listrado, colar largo, braços cruzados com cajado e mangual, a deusa-abutre e a coluna de sinais. */
function sarcofagoEgipcio(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 2.1;
  // Largura ao longo do comprimento (y de −1,05 a 1,05): cabeça, ombros, pernas que afunilam e o pé.
  const larg = (y: number): number => { const t = (y + L / 2) / L; return t < 0.06 ? 0.26 + t * 3 : t < 0.2 ? 0.44 - (t - 0.06) * 0.6 : t < 0.3 ? 0.36 + (t - 0.2) * 1.0 : 0.46 - (t - 0.3) * 0.24 + (t > 0.93 ? -(t - 0.93) * 2 : 0); };
  const contorno = (k: number, dx = 0, dy = 0): number[] => { const n = 26, d: number[] = [], e: number[] = []; for (let i = 0; i <= n; i++) { const y = -L / 2 + (i / n) * L; d.push(larg(y) * k + dx, y * (0.98 + k * 0.02) + dy); e.unshift(-larg(y) * k + dx, y * (0.98 + k * 0.02) + dy); } return [...d, ...e]; };
  sombraNoChao(partes, contorno(1.1), 0.02, '#0d0a08', 0.5);
  partes.push(poli(contorno(1.04, 0.015, 0.02), TINTA, 0.7, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(contorno(1), OURO.base, 0.74, { ...O, detalhe: 1 }));
  partes.push(poli(contorno(0.82, LUZ_X * 0.03, LUZ_Y * 0.02), OURO.meio, 0.75, { ...S, detalhe: 1 }), poli(contorno(0.4, LUZ_X * 0.1, LUZ_Y * 0.02), OURO.luz, 0.755, { ...S, alfa: 0.8, detalhe: 2 }));
  // Peruca listrada azul e ouro em volta do rosto, e a máscara.
  partes.push(elipse(0.01, -0.78, 0.54, 0.46, TINTA, 0.76, { contorno: 'leve', detalhe: 1 }), elipse(0, -0.79, 0.5, 0.42, AZUL, 0.762, { ...O, detalhe: 1 }));
  for (let j = 0; j < 6; j++) partes.push(ret(0, -0.96 + j * 0.065, 0.5 - Math.abs(j - 2.5) * 0.04, 0.022, OURO.luz, 0.764, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(ret(s * 0.2, -0.56, 0.1, 0.18, AZUL, 0.763, { contorno: 'leve', raio: 0.03, detalhe: 2 }), ret(s * 0.2, -0.56, 0.1, 0.03, OURO.luz, 0.765, { ...O, detalhe: 3 }));
  partes.push(elipse(0.008, -0.76, 0.3, 0.34, OURO.nanquim, 0.77, { contorno: 'leve', detalhe: 1 }));
  disco(partes, 0, -0.77, 0.14, OURO, 0.772, 0.16);
  for (const s of [-1, 1]) partes.push(lente(s * 0.1, -0.8, s > 0 ? 0 : Math.PI, 0.08, 0.035, '#f4eee0', 0.79, { ...O, detalhe: 3 }), elipse(s * 0.06, -0.8, 0.03, 0.03, TINTA, 0.792, { ...O, detalhe: 3 }), tira([s * 0.02, -0.83, s * 0.1, -0.84, s * 0.15, -0.82], 0.014, TINTA, 0.792, { ...O, detalhe: 3 }));
  partes.push(ret(0, -0.6, 0.05, 0.1, AZUL, 0.79, { contorno: 'leve', raio: 0.02, detalhe: 3 }));   // barba postiça
  // Colar largo: arcos de contas sobre o peito.
  [TURQUESA, OURO.luz, VERMELHO, AZUL, OURO.luz, TURQUESA].forEach((c, j) => { const rr = 0.22 + j * 0.035, arco: number[] = []; for (let k = 0; k <= 12; k++) { const a = Math.PI * 0.18 + (k / 12) * Math.PI * 0.64; arco.push(Math.cos(a) * rr * 1.3, -0.68 + Math.sin(a) * rr); } partes.push(tira(arco, 0.032, c, 0.78 + j * 0.001, { ...O, detalhe: 2 })); });
  // Braços cruzados no peito com o cajado (listras azul e ouro) e o mangual.
  for (const s of [-1, 1]) partes.push(tira([s * 0.36, -0.36, s * 0.1, -0.2, -s * 0.12, -0.14], 0.09, OURO.nanquim, 0.8, { contorno: 'leve', detalhe: 1 }), tira([s * 0.36, -0.36, s * 0.1, -0.2, -s * 0.12, -0.14], 0.065, OURO.luz, 0.805, { ...O, detalhe: 2 }));
  partes.push(tira([-0.12, -0.42, -0.08, -0.14, -0.06, 0.02], 0.04, AZUL, 0.81, { contorno: 'leve', detalhe: 2 }), tira([-0.12, -0.42, -0.2, -0.46, -0.24, -0.4], 0.04, AZUL, 0.81, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 4; k++) partes.push(ret(-0.09 - k * 0.003, -0.32 + k * 0.08, 0.05, 0.015, OURO.brilho, 0.812, { ...O, detalhe: 3 }));
  partes.push(tira([0.1, -0.42, 0.08, 0.0], 0.03, OURO.brilho, 0.81, { contorno: 'leve', detalhe: 2 }));
  for (const d of [-0.04, 0, 0.04]) partes.push(tira([0.1, -0.42, 0.16 + d, -0.32, 0.18 + d * 2, -0.24], 0.018, AZUL, 0.811, { ...O, detalhe: 3 }));
  // A deusa-abutre de asas abertas sobre o ventre.
  for (const s of [-1, 1]) { const asa = [0, 0.02, s * 0.15, -0.04, s * 0.36, 0.02, s * 0.36, 0.12, s * 0.12, 0.12, 0, 0.1]; partes.push(poli(asa, TINTA, 0.815, { contorno: 'leve', detalhe: 2 }), poli(asa.map((v, i) => (i % 2 ? v + 0.01 : v * 0.95)), VERMELHO, 0.817, { ...O, detalhe: 2 })); for (let k = 0; k < 4; k++) partes.push(ret(s * (0.1 + k * 0.07), 0.08, 0.035, 0.07, k % 2 ? AZUL : TURQUESA, 0.82, { ...O, detalhe: 3 })); }
  partes.push(elipse(0, 0.04, 0.08, 0.1, OURO.brilho, 0.82, { contorno: 'leve', detalhe: 3 }));
  // Coluna de sinais descendo pelas pernas, entre faixas transversais.
  partes.push(ret(0, 0.6, 0.16, 0.82, OURO.brilho, 0.815, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 7; k++) { const y = 0.25 + k * 0.11, tipo = Math.floor(r() * 4); partes.push(tipo === 0 ? elipse(0, y, 0.08, 0.05, TINTA, 0.82, { ...O, detalhe: 3 }) : tipo === 1 ? ret(0, y, 0.08, 0.025, AZUL, 0.82, { ...O, detalhe: 3 }) : tipo === 2 ? poli([-0.04, y + 0.03, 0, y - 0.04, 0.04, y + 0.03], TINTA, 0.82, { ...O, detalhe: 3 }) : elipse(0, y, 0.05, 0.05, VERMELHO, 0.82, { ...O, detalhe: 3 })); }
  for (const y of [0.18, 0.5, 0.78]) partes.push(ret(0, y, larg(y) * 1.9, 0.03, AZUL, 0.818, { ...O, detalhe: 2 }));
  partes.push(elipse(0, 0.96, 0.32, 0.12, OURO.sombra, 0.816, { ...O, detalhe: 2 }));
  return partes;
}

/** Áquila: o estandarte da legião. A águia de ouro de asas erguidas na coroa de louros, a travessa com o vexilo vermelho e a base de pedra. */
function aquila(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, bolha(0, 0, 0.36, 0.36, 12, 0.04, r), 0.02, '#0d0a08', 0.45);
  disco(partes, 0, 0, 0.3, MARMORE_VELHO, 0.3);
  // Travessa e vexilo (pano vermelho com franja de ouro), um pouco à frente da águia.
  partes.push(ret(0.01, 0.31, 0.78, 0.26, TINTA, 0.95, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), ret(0, 0.3, 0.74, 0.22, '#8a1c16', 0.955, { ...O, detalhe: 1 }), ret(-0.04, 0.27, 0.6, 0.08, '#a8302a', 0.96, { ...S, detalhe: 2 }));
  for (let k = 0; k < 12; k++) partes.push(ret(-0.33 + k * 0.06, 0.42, 0.025, 0.05, OURO.luz, 0.958, { ...O, detalhe: 3 }));
  partes.push(ret(0, 0.19, 0.84, 0.05, BRONZE.nanquim, 0.97, { contorno: 'leve', detalhe: 1 }), ret(0, 0.185, 0.82, 0.03, BRONZE.luz, 0.975, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(elipse(s * 0.42, 0.19, 0.06, 0.06, OURO.luz, 0.98, { contorno: 'leve', detalhe: 3 }));
  // Coroa de louros de ouro em volta da águia.
  const coroa: number[] = []; for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI * 2; coroa.push(Math.cos(a) * 0.24, -0.04 + Math.sin(a) * 0.24); }
  partes.push(tira(coroa, 0.07, OURO.nanquim, 1.1, { contorno: 'leve', detalhe: 1 }), tira(coroa, 0.045, OURO.base, 1.105, { ...O, detalhe: 2 }));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; partes.push(lente(Math.cos(a) * 0.24, -0.04 + Math.sin(a) * 0.24, a + Math.PI / 2, 0.07, 0.03, tom(OURO.luz, olhar(a) * 0.2), 1.11, { ...O, detalhe: 3 })); }
  // A águia: asas erguidas e abertas, penas em leque, o corpo e a cabeça virada de lado.
  for (const s of [-1, 1]) {
    const asa = [s * 0.06, -0.06, s * 0.26, -0.26, s * 0.5, -0.36, s * 0.56, -0.2, s * 0.44, -0.04, s * 0.2, 0.06, s * 0.06, 0.04];
    partes.push(poli(asa.map((v, i) => v + (i % 2 ? 0.016 : 0.014)), OURO.nanquim, 1.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(asa, s < 0 ? OURO.luz : OURO.meio, 1.305, { ...O, detalhe: 1 }));
    for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + s * (0.35 + k * 0.2), bx = s * (0.18 + k * 0.05), by = -0.12 + k * 0.025; partes.push(lente(bx, by, a + (s > 0 ? 0.5 : -0.5) * 0, 0.18 - k * 0.012, 0.05, tom(s < 0 ? OURO.luz : OURO.meio, k % 2 ? 0.12 : -0.08), 1.31 + k * 0.001, { ...O, detalhe: 2 })); }
    partes.push(tira([s * 0.06, -0.04, s * 0.3, -0.24, s * 0.5, -0.32], 0.02, OURO.brilho, 1.32, { ...O, alfa: 0.8, detalhe: 3 }, 0.4));
  }
  partes.push(elipse(0.01, 0.0, 0.18, 0.3, OURO.nanquim, 1.33, { contorno: 'leve', detalhe: 1 }), elipse(0, -0.01, 0.15, 0.27, OURO.meio, 1.335, { ...O, detalhe: 1 }), elipse(-0.02, -0.03, 0.07, 0.16, OURO.brilho, 1.34, { ...S, detalhe: 2 }));
  partes.push(poli([-0.06, -0.14, 0, -0.26, 0.06, -0.14], OURO.base, 1.33, { contorno: 'leve', detalhe: 2 }));   // cauda
  partes.push(elipse(0.04, 0.13, 0.1, 0.09, OURO.luz, 1.36, { contorno: 'leve', detalhe: 2 }), poli([0.08, 0.12, 0.15, 0.15, 0.08, 0.17], OURO.sombra, 1.365, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

// ---------- Painel de hieróglifos (objeto de parede) ----------

/** Um sinal hieroglífico grande, em coordenadas da face (u ao longo, `y` para cima), cabendo num quadro de `s` × `s`. */
function sinal(tipo: number, cx: number, cy: number, s: number, z: number): Parte[] {
  const ps: Parte[] = [], O2 = { contorno: false as const, detalhe: 2 as const }, k = s / 2;
  switch (tipo) {
    case 0: // olho de Hórus
      ps.push(lente(cx - k * 0.85, cy + k * 0.1, 0, k * 1.7, k * 0.75, TINTA, z, O2), lente(cx - k * 0.7, cy + k * 0.1, 0, k * 1.4, k * 0.5, '#f0e4c8', z + 0.001, O2), elipse(cx, cy + k * 0.1, k * 0.42, k * 0.42, AZUL, z + 0.002, O2));
      ps.push(tira([cx - k * 0.8, cy + k * 0.55, cx, cy + k * 0.62, cx + k * 0.85, cy + k * 0.5], k * 0.14, TINTA, z, O2), tira([cx - k * 0.1, cy - k * 0.2, cx - k * 0.2, cy - k * 0.7, cx - k * 0.45, cy - k * 0.85], k * 0.14, TINTA, z, O2), tira([cx + k * 0.15, cy - k * 0.2, cx + k * 0.5, cy - k * 0.75, cx + k * 0.75, cy - k * 0.6], k * 0.14, TINTA, z, O2));
      break;
    case 1: { // ankh
      const laco: number[] = []; for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI * 2; laco.push(cx + Math.cos(a) * k * 0.34, cy + k * 0.5 + Math.sin(a) * k * 0.42); }
      ps.push(tira(laco, k * 0.2, VERMELHO, z, O2), ret(cx, cy + k * 0.05, k * 1.2, k * 0.22, VERMELHO, z, O2), ret(cx, cy - k * 0.45, k * 0.24, k * 1.0, VERMELHO, z, O2));
      break;
    }
    case 2: // falcão
      ps.push(poli([cx - k * 0.8, cy - k * 0.1, cx - k * 0.2, cy + k * 0.35, cx + k * 0.35, cy + k * 0.55, cx + k * 0.55, cy + k * 0.3, cx + k * 0.3, cy - k * 0.25, cx - k * 0.2, cy - k * 0.5, cx - k * 0.85, cy - k * 0.55], AZUL, z, O2));
      ps.push(elipse(cx + k * 0.5, cy + k * 0.55, k * 0.5, k * 0.45, AZUL, z, O2), poli([cx + k * 0.72, cy + k * 0.55, cx + k * 0.95, cy + k * 0.42, cx + k * 0.72, cy + k * 0.4], OURO.base, z + 0.001, O2), elipse(cx + k * 0.55, cy + k * 0.6, k * 0.12, k * 0.12, '#f0e4c8', z + 0.001, O2));
      ps.push(ret(cx, cy - k * 0.7, k * 0.12, k * 0.4, TINTA, z, O2), ret(cx + k * 0.2, cy - k * 0.7, k * 0.12, k * 0.4, TINTA, z, O2), ret(cx - k * 0.55, cy - k * 0.25, k * 0.6, k * 0.12, TINTA, z + 0.001, O2));
      break;
    case 3: // disco solar com a naja
      ps.push(elipse(cx, cy + k * 0.15, k * 1.3, k * 1.3, VERMELHO, z, O2), elipse(cx - k * 0.15, cy + k * 0.3, k * 0.45, k * 0.45, '#c05a2a', z + 0.001, O2));
      ps.push(tira([cx - k * 0.75, cy - k * 0.6, cx, cy - k * 0.72, cx + k * 0.75, cy - k * 0.6], k * 0.18, OURO.base, z, O2));
      break;
    case 4: // água (zigue-zague em três linhas)
      for (let j = 0; j < 3; j++) { const pts: number[] = []; for (let i = 0; i <= 8; i++) pts.push(cx - k * 0.9 + (i / 8) * k * 1.8, cy + k * (0.5 - j * 0.5) + (i % 2 ? k * 0.15 : -k * 0.15)); ps.push(tira(pts, k * 0.14, AZUL, z, O2)); }
      break;
    case 5: // junco florido
      ps.push(ret(cx, cy - k * 0.2, k * 0.18, k * 1.5, TURQUESA, z, O2), lente(cx, cy + k * 0.5, Math.PI / 2, k * 0.55, k * 0.45, TURQUESA, z, O2), lente(cx + k * 0.08, cy + k * 0.55, Math.PI / 2 - 0.6, k * 0.4, k * 0.2, OURO.base, z + 0.001, O2));
      break;
    case 6: // naja
      ps.push(tira([cx - k * 0.8, cy - k * 0.75, cx - k * 0.2, cy - k * 0.7, cx + k * 0.35, cy - k * 0.55, cx + k * 0.3, cy - k * 0.1, cx + k * 0.1, cy + k * 0.3, cx + k * 0.15, cy + k * 0.6], k * 0.2, OURO.sombra, z, O2, 0.5), elipse(cx + k * 0.12, cy + k * 0.55, k * 0.5, k * 0.5, OURO.sombra, z, O2), elipse(cx + k * 0.22, cy + k * 0.62, k * 0.12, k * 0.12, TINTA, z + 0.001, O2));
      break;
    case 7: // homem sentado
      ps.push(elipse(cx + k * 0.1, cy + k * 0.65, k * 0.45, k * 0.45, TINTA, z, O2), poli([cx - k * 0.15, cy + k * 0.4, cx + k * 0.35, cy + k * 0.4, cx + k * 0.4, cy - k * 0.2, cx + k * 0.85, cy - k * 0.25, cx + k * 0.85, cy - k * 0.5, cx - k * 0.2, cy - k * 0.5], AZUL, z, O2), ret(cx - k * 0.1, cy - k * 0.8, k * 0.8, k * 0.18, TINTA, z, O2));
      break;
    case 8: // escaravelho
      ps.push(elipse(cx, cy - k * 0.1, k * 0.9, k * 1.1, AZUL, z, O2), elipse(cx, cy + k * 0.6, k * 0.55, k * 0.35, AZUL, z, O2), ret(cx, cy - k * 0.1, k * 0.06, k * 1.0, TINTA, z + 0.001, O2));
      for (const sx of [-1, 1]) for (const dy of [-0.4, 0, 0.35]) ps.push(tira([cx + sx * k * 0.4, cy + k * dy, cx + sx * k * 0.8, cy + k * (dy - 0.15)], k * 0.1, TINTA, z, O2));
      break;
    default: { // cartucho com dois sinais dentro
      const anel: number[] = []; for (let i = 0; i <= 20; i++) { const a = (i / 20) * Math.PI * 2; anel.push(cx + Math.cos(a) * k * 0.6, cy + Math.sin(a) * k * 0.95); }
      ps.push(tira(anel, k * 0.12, TINTA, z, O2), ret(cx, cy - k * 1.05, k * 0.9, k * 0.12, TINTA, z, O2), elipse(cx, cy + k * 0.4, k * 0.4, k * 0.4, VERMELHO, z, O2), ret(cx, cy - k * 0.3, k * 0.6, k * 0.2, AZUL, z, O2));
    }
  }
  return ps;
}

/** Painel de hieróglifos: laje de arenito pintada, com cornija em gola egípcia, duas fiadas de sinais grandes entre faixas e o rodapé. */
function painelDeHieroglifos(seed: number, l: number): { face: Parte[]; topo: Parte[] } {
  const r = mulberry32(seed), face: Parte[] = [], z0 = 0.03, base = 0.35, alto = 2.3, meio = (base + alto) / 2;
  face.push(ret(0, meio, l, alto - base, ARENITO.nanquim, z0), ret(0, meio, l - 0.06, alto - base - 0.06, '#d8bc8a', z0 + 0.005, { ...O, detalhe: 1 }));
  // Cornija (gola) em listras azul, vermelho e ouro, e o rodapé.
  face.push(ret(0, alto - 0.11, l - 0.06, 0.16, OURO.base, z0 + 0.01, { ...O, detalhe: 1 }));
  for (let x = -l / 2 + 0.06; x < l / 2 - 0.05; x += 0.1) face.push(ret(x + 0.025, alto - 0.11, 0.05, 0.14, Math.round((x + l) / 0.1) % 2 ? AZUL : VERMELHO, z0 + 0.012, { ...O, detalhe: 2 }));
  face.push(ret(0, alto - 0.2, l - 0.06, 0.03, TINTA, z0 + 0.013, { ...O, detalhe: 2 }), ret(0, base + 0.08, l - 0.06, 0.1, AZUL, z0 + 0.01, { ...O, detalhe: 2 }), ret(0, base + 0.135, l - 0.06, 0.02, TINTA, z0 + 0.011, { ...O, detalhe: 2 }));
  // Duas fiadas de sinais grandes (0,6 m), separadas por uma faixa: grandes para ler na face achatada do mapa.
  // A fiada de baixo é a principal (a de cima some em parte atrás do topo da parede, na vista do mapa).
  const fiadas = [base + 0.62, base + 1.42], s = 0.66, n = Math.max(2, Math.floor((l - 0.1) / 0.74)), passo = (l - 0.1) / n;
  face.push(ret(0, (fiadas[0]! + fiadas[1]!) / 2, l - 0.06, 0.03, TINTA, z0 + 0.011, { ...O, detalhe: 2 }));
  const usados: number[] = [];
  for (const cy of fiadas) for (let i = 0; i < n; i++) {
    let tipo = Math.floor(r() * 10);
    if (usados.length && usados[usados.length - 1] === tipo) tipo = (tipo + 3) % 10;
    usados.push(tipo);
    face.push(...sinal(tipo, -l / 2 + 0.05 + passo * (i + 0.5), cy, s, z0 + 0.015));
  }
  // Desgaste: manchas e uma lasca no canto.
  for (let k = 0; k < 4; k++) face.push(elipse((r() - 0.5) * l * 0.9, base + 0.2 + r() * 1.5, 0.18, 0.1, '#8a6a40', z0 + 0.02, { ...S, alfa: 0.25, detalhe: 3 }));
  const topo = [ret(0, 0.04, l, 0.08, ARENITO.sombra, 2.3, { contorno: 'leve' }), ret(0, 0.065, l - 0.04, 0.02, AZUL, 2.31, { ...O, alfa: 0.8, detalhe: 2 })];
  return { face, topo };
}

// ---------- Receitas ----------

const A = { generos: ['antiguidade', 'fantasia'], kit: 'antiguidade' };
const EGITO = { generos: ['antiguidade', 'fantasia'], kit: 'antiguidade' };
const campoAltura = { id: 'altura', rotulo: 'Altura (m)', tipo: 'numero' as const, padrao: 6, min: 2, max: 10, passo: 0.5 };
const ladoDaColuna = (altura: number) => Math.round((0.5 + altura * 0.06) * 1.5 * 100) / 100;

const colunaReceita = (id: string, nome: string, ordem: 0 | 1 | 2, tags: string[]): Receita => ({
  id, nome, categoria: 'decoracao', tipo: 'piso', funcoes: ['templo', 'salao', 'jardim', 'ruina', 'praca', 'capela'], ...A,
  tags: ['coluna', 'pilar', 'marmore', 'templo', 'grega', 'romana', 'classica', ...tags], pegada: [ladoDaColuna(6), ladoDaColuna(6)], campos: [campoAltura],
  gerar: p => { const c = coluna(ordem, num(p, 'altura', 6, 2, 10), p.seed); return piso(c.pegada, c.partes); },
});

/** O kit da Antiguidade, parte 1 (Q15a): templo e cidade. */
export const RECEITAS_DA_ANTIGUIDADE: Receita[] = [
  colunaReceita('coluna.dorica', 'Coluna dórica', 0, ['dorica', 'abaco']),
  colunaReceita('coluna.jonica', 'Coluna jônica', 1, ['jonica', 'voluta']),
  colunaReceita('coluna.corintia', 'Coluna coríntia', 2, ['corintia', 'acanto']),
  { id: 'coluna-classica.caida', nome: 'Coluna clássica caída', categoria: 'exterior', tipo: 'piso', funcoes: ['templo', 'ruina', 'jardim', 'praca'], ...A, tags: ['coluna', 'caida', 'tambor', 'marmore', 'ruina', 'templo', 'classica', 'entulho'], pegada: [4.6, 1.3], altura: 0.9,
    gerar: p => piso([4.6, 1.3], colunaCaida(p.seed)) },
  { id: 'frontao-caido', nome: 'Frontão caído', categoria: 'exterior', tipo: 'piso', funcoes: ['templo', 'ruina', 'praca'], ...A, tags: ['frontao', 'timpano', 'relevo', 'marmore', 'ruina', 'templo', 'classica', 'entulho'], pegada: [5, 1.9], altura: 0.5,
    gerar: p => piso([5, 1.9], frontaoCaido(p.seed)) },
  { id: 'obelisco', nome: 'Obelisco', categoria: 'exterior', tipo: 'piso', funcoes: ['templo', 'praca', 'jardim', 'ruina', 'forum'], ...EGITO, tags: ['obelisco', 'egito', 'granito', 'monumento', 'hieroglifos', 'piramide'], pegada: [2, 2], altura: 9,
    gerar: p => piso([2, 2], obelisco(p.seed)) },
  { id: 'estatua-classica', nome: 'Estátua clássica', categoria: 'decoracao', tipo: 'piso', funcoes: ['templo', 'praca', 'jardim', 'salao', 'ruina', 'forum'], ...A, tags: ['estatua', 'deus', 'deusa', 'marmore', 'pedestal', 'templo', 'grega', 'romana', 'classica'], pegada: [1.8, 1.8], altura: 4.2,
    campos: [{ id: 'pose', rotulo: 'Pose (0 cetro, 1 escudo e lança, 2 oferenda)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => piso([1.8, 1.8], estatuaClassica(p.seed, Math.round(num(p, 'pose', 0, 0, 2)))) },
  { id: 'busto-em-pedestal', nome: 'Busto em pedestal', categoria: 'decoracao', tipo: 'piso', funcoes: ['templo', 'salao', 'jardim', 'biblioteca', 'sala', 'forum'], ...A, tags: ['busto', 'herma', 'retrato', 'marmore', 'pedestal', 'romana', 'classica', 'imperador', 'filosofo'], pegada: [0.8, 0.8], altura: 1.5,
    gerar: p => piso([0.8, 0.8], busto(p.seed)) },
  { id: 'altar-de-sacrificio', nome: 'Altar de sacrifício', categoria: 'decoracao', tipo: 'piso', funcoes: ['templo', 'capela', 'ruina', 'forum'], ...A, tags: ['altar', 'sacrificio', 'oferenda', 'marmore', 'templo', 'romana', 'grega', 'sangue', 'ritual'], pegada: [2, 1.5], altura: 1.1,
    gerar: p => piso([2, 1.5], altar(p.seed)) },
  { id: 'tripe-de-bronze', nome: 'Tripé de bronze', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['templo', 'capela', 'salao', 'sala', 'jardim'], ...A, tags: ['tripe', 'braseiro', 'bronze', 'fogo', 'brasa', 'luz', 'templo', 'oraculo', 'brilho'], pegada: [1.2, 1.2], altura: 1.4,
    gerar: p => piso([1.2, 1.2], tripe(p.seed)) },
  { id: 'estatua-egipcia', nome: 'Estátua de faraó', categoria: 'decoracao', tipo: 'piso', funcoes: ['templo', 'salao', 'ruina', 'cripta'], ...EGITO, tags: ['estatua', 'farao', 'egito', 'trono', 'sentado', 'nemes', 'arenito', 'templo', 'tumba'], pegada: [1.4, 2.2], altura: 3.2,
    gerar: p => piso([1.4, 2.2], estatuaEgipcia(p.seed)) },
  { id: 'esfinge', nome: 'Esfinge', categoria: 'exterior', tipo: 'piso', funcoes: ['templo', 'ruina', 'jardim', 'praca'], ...EGITO, tags: ['esfinge', 'leao', 'egito', 'nemes', 'arenito', 'templo', 'monumento', 'guardiao'], pegada: [2.4, 4.4], altura: 2.4,
    gerar: p => piso([2.4, 4.4], esfinge(p.seed)) },
  { id: 'sarcofago.egipcio', nome: 'Sarcófago egípcio', categoria: 'decoracao', tipo: 'piso', funcoes: ['templo', 'cripta', 'porao', 'capela'], ...EGITO, tags: ['sarcofago', 'mumia', 'farao', 'egito', 'ouro', 'tumba', 'cripta', 'jazigo'], pegada: [1.0, 2.2], altura: 0.85,
    gerar: p => piso([1.0, 2.2], sarcofagoEgipcio(p.seed)) },
  { id: 'painel-de-hieroglifos', nome: 'Painel de hieróglifos', categoria: 'parede', tipo: 'parede', funcoes: ['templo', 'cripta', 'salao', 'corredor'], ...EGITO, tags: ['hieroglifos', 'egito', 'relevo', 'pintura', 'parede', 'templo', 'tumba', 'escrita'], pegada: [2, 0.05],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2, min: 1.2, max: 4, passo: 0.1 }],
    gerar: p => { const l = num(p, 'largura', 2, 1.2, 4), d = painelDeHieroglifos(p.seed, l); return parede(l, d.face, d.topo); } },
  { id: 'aquila', nome: 'Áquila (estandarte romano)', categoria: 'decoracao', tipo: 'piso', funcoes: ['salao', 'forum', 'quartel', 'praca', 'templo'], generos: ['antiguidade'], kit: 'antiguidade', tags: ['aquila', 'aguia', 'estandarte', 'legiao', 'romana', 'ouro', 'bandeira', 'militar'], pegada: [1.1, 1.1], altura: 1.5,
    gerar: p => piso([1.1, 1.1], escalar(aquila(p.seed), 1.15)) },
];
