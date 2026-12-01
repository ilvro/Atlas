import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, silhuetaDeDiscos, sombraNoChao, tira, tonsComLuz, tufo } from '../organico.ts';
import { num, parede, piso, type LuzDeReceita, type Receita } from './comum.ts';
import {
  BRONZE, ID, MADEIRA, O, OURO, PATINA, S, anel, arco, bloco, desgaste, disco, em, estofado, fogoQueBrilha, fruta,
  luzLocal, olhar, quadro, retQ, retR, tomDaFace, type Quadro, type Tons,
} from './formas.ts';

// Antiguidade (Q15a): templo e cidade. Mármore claro e quente, bronze com pátina, arenito e granito pintados para o Egito.
// Como no resto do acervo: nanquim por baixo do que conta na silhueta, volume em degraus de tom para o noroeste e `z` moderado
// (≈1–1,5 m) nas partes, com a `altura` real declarada na receita para a sombra do sol: peça estreita com `z` alto escurece um anel
// do chão em volta à noite (oclusão do mapa de altura).

const MARMORE: Tons = { nanquim: '#2a231b', sombra: '#8f8472', base: '#b5aa94', meio: '#cbc1ab', luz: '#ded5c1', brilho: '#f2ebdb' };
const MARMORE_VELHO: Tons = { nanquim: '#26201a', sombra: '#7e7462', base: '#a29682', meio: '#b8ad98', luz: '#cdc3ae', brilho: '#e0d8c6' };
const ARENITO: Tons = { nanquim: '#2a1c10', sombra: '#7e6040', base: '#a6865a', meio: '#bc9c6c', luz: '#d2b484', brilho: '#e8cfa0' };
const GRANITO: Tons = { nanquim: '#1e1210', sombra: '#5a3a32', base: '#7e5448', meio: '#956656', luz: '#ae7e6a', brilho: '#c89c86' };
const AZUL = '#24447e', TURQUESA = '#2c8480', VERMELHO = '#963a1e', TINTA = '#1e1612', CINZA = '#3a3430';

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

// ---------- Casa e vida (Q15b) ----------
// Terracota, madeira escura, linho e as cores pompeianas (vermelho, ocre, púrpura) por cima do mármore e do bronze da Q15a.

const TERRACOTA: Tons = { nanquim: '#2a1208', sombra: '#6e3218', base: '#984a26', meio: '#b05c32', luz: '#c87648', brilho: '#e09a6c' };
const BARRO: Tons = { nanquim: '#2a1a0e', sombra: '#7a5a3a', base: '#a07a50', meio: '#b48c60', luz: '#c8a274', brilho: '#e0c094' };
const ESTUQUE: Tons = { nanquim: '#2a2018', sombra: '#8a7860', base: '#b0a080', meio: '#c4b494', luz: '#d6c8a8', brilho: '#ece0c4' };
const POMPEIA = '#8e2c1c', OCRE = '#b8862e', PURPURA = '#5a2440', LINHO = '#d8ccb0', ANIL = '#2e4a6a';

/** Cacho de uvas (n bagos) em volta de (x, y). */
function cacho(partes: Parte[], r: () => number, x: number, y: number, k: number, cor: string, z: number, n = 9): void {
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * k * 0.9; fruta(partes, x + Math.cos(a) * d, y + Math.sin(a) * d * 1.3, k * 0.32, tom(cor, (r() - 0.5) * 0.2), z + i * 0.002); }
}

/** Leito de refeição (lectus) no referencial `f` (u ao comprido, v para a frente): moldura de madeira, colchão de linho, a coberta com franja que cai pela frente, o fulcro (cabeceira curva) com medalhão de bronze e as almofadas. */
function leito(partes: Parte[], r: () => number, f: Quadro, ang: number, L: number, W: number, cobre: string, almofada: string): void {
  bloco(partes, f, L, W, MADEIRA, 0.38, 0.05, ang);
  for (const s of [-1, 1]) partes.push(poli(retQ(f, s * (L / 2 - 0.03), 0, 0.03, W - 0.06), BRONZE.luz, 0.395, { ...O, detalhe: 3 }));
  estofado(partes, f, ang, 0.03, -0.01, L - 0.12, W - 0.12, LINHO, 0.45);
  // A coberta: cobre a frente do colchão e cai pela borda, com uma barra dourada e a franja.
  estofado(partes, f, ang, 0.08, W * 0.14, L - 0.26, W * 0.7, cobre, 0.5, 0.05);
  // Dobras da coberta: vincos escuros e o lado de cima de cada dobra claro, de través.
  for (let u = -L / 2 + 0.45; u < L / 2 - 0.3; u += 0.42 + r() * 0.25) {
    const a = (r() - 0.5) * 0.25, pts = em(f, [u, -W * 0.18, u + a * 0.4 + 0.04, W * 0.12, u + a, W * 0.44]);
    partes.push(tira(pts, 0.05, tom(cobre, -0.35), 0.505, { ...S, alfa: 0.55, detalhe: 2 }, 0.3), tira(pts.map((p, i) => p + (i % 2 ? LUZ_Y : LUZ_X) * 0.035), 0.03, tom(cobre, 0.12), 0.506, { ...S, alfa: 0.5, detalhe: 3 }, 0.3));
  }
  partes.push(poli(retQ(f, 0.08, W * 0.43, L - 0.3, 0.05), OCRE, 0.51, { ...O, alfa: 0.9, detalhe: 2 }));
  for (let u = -L / 2 + 0.22; u < L / 2 - 0.08; u += 0.065) partes.push(tira(em(f, [u, W / 2 - 0.02, u + (r() - 0.5) * 0.02, W / 2 + 0.05]), 0.022, tom(OCRE, -0.25), 0.395, { ...O, detalhe: 3 }));
  // O fulcro: a cabeceira curva na ponta esquerda, de madeira com aplique de bronze e o medalhão na frente.
  const fu = -L / 2, cur: number[] = [];
  for (let k = 0; k <= 10; k++) { const v = -W / 2 + 0.04 + (k / 10) * (W - 0.1); cur.push(fu + 0.04, v); }
  for (let k = 10; k >= 0; k--) { const v = -W / 2 + 0.04 + (k / 10) * (W - 0.1), t = (v + W / 2) / W; cur.push(fu + 0.12 + 0.12 * Math.sin(t * Math.PI * 0.95), v); }
  partes.push(poli(em(f, cur).map((p, i) => p + (i % 2 ? 0.014 : 0.012)), MADEIRA.nanquim, 0.6, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(em(f, cur), MADEIRA.meio, 0.605, { ...O, detalhe: 1 }));
  partes.push(tira(em(f, cur.slice(cur.length / 2 + 2, cur.length - 2)), 0.03, BRONZE.luz, 0.61, { ...O, detalhe: 2 }, 0.4));
  const [mx, my] = f(fu + 0.12, W / 2 - 0.1);
  partes.push(elipse(mx, my, 0.1, 0.1, BRONZE.nanquim, 0.615, { contorno: 'leve', detalhe: 2 }), elipse(mx, my, 0.075, 0.075, BRONZE.meio, 0.62, { ...O, detalhe: 2 }), elipse(mx + LUZ_X * 0.01, my + LUZ_Y * 0.01, 0.035, 0.035, BRONZE.brilho, 0.625, { ...O, detalhe: 3 }));
  // Almofadas: o rolo (pulvinus) junto ao fulcro e uma ou duas ao longo das costas.
  estofado(partes, f, ang, fu + 0.38, -W * 0.08, 0.34, W * 0.56, almofada, 0.56, 0.12);
  partes.push(tira(em(f, [fu + 0.38, -W * 0.34, fu + 0.38, W * 0.18]), 0.012, tom(almofada, -0.4), 0.57, { ...O, alfa: 0.6, detalhe: 3 }));
  const n = L > 3 ? 2 : 1;
  for (let i = 0; i < n; i++) estofado(partes, f, ang, fu + L * (0.48 + i * 0.3) + (r() - 0.5) * 0.1, -W * 0.3, 0.5, 0.26, i % 2 ? LINHO : almofada, 0.54, 0.1);
}

/** Triclínio: um leito só (`leitos` 1) ou três em U em volta do lugar da mesa (`leitos` 3), abertos para +y. */
function triclinio(seed: number, leitos: number): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.05;
  const [cobre, almofada] = ([['#7a2a1c', OCRE], [PURPURA, OCRE], [ANIL, LINHO]] as const)[Math.floor(r() * 3)]!;
  if (leitos < 2) {
    sombraNoChao(partes, [-1.2, -0.55, 1.2, -0.55, 1.2, 0.6, -1.2, 0.6], 0.02, '#0d0a08', 0.4);
    leito(partes, r, ID, 0, 2.3, W, cobre, almofada);
    return { pegada: [2.4, 1.2], partes };
  }
  const PX = 4.4, PY = 4.2, Ls = PY - W - 0.05;
  sombraNoChao(partes, [-2.2, -2.1, 2.2, -2.1, 2.2, 2.1, 1.1, 2.1, 1.1, -1.0, -1.1, -1.0, -1.1, 2.1, -2.2, 2.1], 0.02, '#0d0a08', 0.35);
  leito(partes, r, quadro(0, -PY / 2 + W / 2, 0), 0, PX, W, cobre, almofada);
  leito(partes, r, quadro(-PX / 2 + W / 2, PY / 2 - Ls / 2, -Math.PI / 2), -Math.PI / 2, Ls, W, cobre, almofada);
  leito(partes, r, quadro(PX / 2 - W / 2, PY / 2 - Ls / 2, Math.PI / 2), Math.PI / 2, Ls, W, cobre, almofada);
  return { pegada: [PX, PY], partes };
}

/** Mesa romana redonda de mármore (pé de leão escondido) com o que se serve: bandeja de bronze com uvas e romãs, taça, jarro e pão. */
function mesaRomana(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.46;
  sombraNoChao(partes, bolha(0, 0, R * 1.05, R * 1.05, 16, 0.03, r), 0.02, '#0d0a08', 0.45);
  for (let k = 0; k < 3; k++) { const a = 0.5 + (k / 3) * Math.PI * 2, x = Math.cos(a) * R * 0.98, y = Math.sin(a) * R * 0.98; partes.push(elipse(x, y, 0.12, 0.1, BRONZE.nanquim, 0.08, { contorno: 'leve', detalhe: 2 }), elipse(x, y, 0.08, 0.07, BRONZE.meio, 0.085, { ...O, detalhe: 3 })); }
  disco(partes, 0, 0, R, MARMORE, 0.7);
  partes.push(tira(anel(0, 0, R * 0.9), 0.012, MARMORE.sombra, 0.716, { ...O, alfa: 0.6, detalhe: 3 }));
  for (let k = 0; k < 3; k++) { const a = r() * 6.28, pts: number[] = []; let x = Math.cos(a) * R * 0.7, y = Math.sin(a) * R * 0.7; for (let j = 0; j < 5; j++) { pts.push(x, y); x += (r() - 0.5) * 0.18 - Math.cos(a) * 0.08; y += (r() - 0.5) * 0.18 - Math.sin(a) * 0.08; } partes.push(tira(pts, 0.008, '#8a8070', 0.717, { ...O, alfa: 0.45, detalhe: 3 }, 0.3)); }
  // Bandeja de bronze com uvas, romãs e figos.
  const bx = -0.08, by = 0.08;
  disco(partes, bx, by, 0.17, BRONZE, 0.73);
  partes.push(elipse(bx, by, 0.27, 0.27, tom(BRONZE.base, -0.2), 0.745, { ...O, detalhe: 2 }));
  cacho(partes, r, bx - 0.04, by - 0.02, 0.07, '#4a2050', 0.75);
  fruta(partes, bx + 0.07, by + 0.06, 0.045, '#9a2a22', 0.76); fruta(partes, bx + 0.08, by - 0.06, 0.035, '#5a3a4a', 0.76);
  partes.push(elipse(bx + 0.06, by + 0.03, 0.018, 0.012, '#e8c070', 0.77, { ...O, detalhe: 3 }));
  // Taça de verniz negro com o fundo vermelho e as duas asas.
  const tx = 0.2, ty = -0.12;
  partes.push(tira([tx - 0.1, ty, tx + 0.1, ty], 0.03, '#141010', 0.76, { contorno: 'leve', detalhe: 2 }));
  partes.push(elipse(tx, ty, 0.15, 0.15, '#141010', 0.762, { contorno: 'leve', detalhe: 2 }), elipse(tx, ty, 0.11, 0.11, '#7a2a1a', 0.764, { ...O, detalhe: 2 }), elipse(tx + 0.008, ty + 0.008, 0.06, 0.06, '#4a0e10', 0.766, { ...O, detalhe: 3 }), elipse(tx - 0.03, ty - 0.03, 0.03, 0.02, '#d0a080', 0.768, { ...O, alfa: 0.6, detalhe: 3 }));
  // Jarro (enócoa) de terracota com a boca trilobada.
  const jx = -0.2, jy = -0.2;
  disco(partes, jx, jy, 0.07, TERRACOTA, 0.8);
  partes.push(poli([jx - 0.03, jy - 0.035, jx + 0.035, jy - 0.02, jx + 0.02, jy + 0.03, jx - 0.035, jy + 0.02], '#160804', 0.82, { contorno: 'leve', detalhe: 2 }), tira([jx + 0.04, jy + 0.03, jx + 0.08, jy + 0.06], 0.02, TERRACOTA.sombra, 0.815, { contorno: 'leve', detalhe: 3 }));
  // Pão redondo em oito gomos.
  const px = 0.2, py = 0.18;
  disco(partes, px, py, 0.085, { nanquim: '#2a1608', sombra: '#7a4a1c', base: '#a06a2a', meio: '#b87e36', luz: '#cc9848', brilho: '#e6bc70' }, 0.74);
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; partes.push(tira([px - Math.cos(a) * 0.075, py - Math.sin(a) * 0.075, px + Math.cos(a) * 0.075, py + Math.sin(a) * 0.075], 0.008, '#5a3412', 0.76, { ...O, alfa: 0.8, detalhe: 3 })); }
  return partes;
}

/** Ânfora de pé vista de cima: o ombro, o gargalo, o lábio com a boca escura (ou o selo de piche) e as duas asas. */
function anforaDePe(partes: Parte[], r: () => number, x: number, y: number, R: number, t: Tons, z: number, ang = r() * 6.28): void {
  disco(partes, x, y, R, t, z);
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const lado of [-1, 1]) {
    const p = (k: number, d: number) => [x + c * lado * R * k - s * R * d, y + s * lado * R * k + c * R * d];
    const pts = [...p(0.3, 0), ...p(0.6, -0.06), ...p(0.88, 0)], claro = olhar(Math.atan2(s * lado, c * lado)) > 0;
    partes.push(tira(pts, R * 0.2, t.nanquim, z + 0.03, { contorno: 'leve', detalhe: 1 }), tira(pts, R * 0.11, claro ? t.luz : t.base, z + 0.034, { ...O, detalhe: 2 }));
  }
  partes.push(elipse(x + 0.008, y + 0.01, R * 0.8, R * 0.8, t.nanquim, z + 0.04, { contorno: 'leve', detalhe: 1 }), elipse(x, y, R * 0.72, R * 0.72, t.base, z + 0.043, { ...O, detalhe: 1 }), elipse(x + LUZ_X * R * 0.08, y + LUZ_Y * R * 0.08, R * 0.5, R * 0.5, t.luz, z + 0.046, { ...S, detalhe: 2 }));
  const selo = r() < 0.4;
  partes.push(elipse(x, y, R * 0.36, R * 0.36, selo ? '#1a1410' : '#120804', z + 0.05, { contorno: 'leve', detalhe: 2 }));
  if (selo) partes.push(elipse(x + LUZ_X * R * 0.06, y + LUZ_Y * R * 0.06, R * 0.16, R * 0.16, '#4a4038', z + 0.052, { ...S, alfa: 0.8, detalhe: 3 }));
}

/** Ânfora deitada no referencial `f` (vista de lado, de cima): a ponta, o bojo comprido, o ombro, o gargalo e as asas; cilindro claro do lado da luz. */
const PERFIL_DE_ANFORA: readonly (readonly [number, number])[] = [[-0.52, 0.018], [-0.47, 0.03], [-0.41, 0.07], [-0.32, 0.115], [-0.18, 0.145], [0.04, 0.152], [0.15, 0.142], [0.21, 0.1], [0.25, 0.052], [0.43, 0.046], [0.45, 0.062], [0.52, 0.062]];
function anforaDeitada(partes: Parte[], f: Quadro, ang: number, t: Tons, z: number): void {
  const [lu, lv] = luzLocal(ang);
  const contorno = (k: number, du = 0, dv = 0): number[] => em(f, [...PERFIL_DE_ANFORA.flatMap(([u, w]) => [u + du, -w * k + dv]), ...[...PERFIL_DE_ANFORA].reverse().flatMap(([u, w]) => [u + du, w * k + dv])]);
  for (const s of [-1, 1]) {
    const asa = em(f, [0.19, s * 0.1, 0.3, s * 0.135, 0.42, s * 0.055]);
    partes.push(tira(asa, 0.04, t.nanquim, z - 0.004, { contorno: 'leve', detalhe: 1 }), tira(asa, 0.022, s * lv < 0 ? t.luz : t.base, z - 0.002, { ...O, detalhe: 2 }));
  }
  partes.push(poli(contorno(1.08, 0.006, 0.008), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(contorno(1), t.sombra, z + 0.002, { ...O, detalhe: 1 }));
  partes.push(poli(contorno(0.82, 0, lv * 0.025), t.base, z + 0.004, { ...S, detalhe: 1 }), poli(contorno(0.5, 0, lv * 0.06), t.meio, z + 0.006, { ...S, detalhe: 2 }));
  partes.push(poli(contorno(0.2, 0, lv * 0.095), t.luz, z + 0.008, { ...S, alfa: 0.85, detalhe: 2 }));
  partes.push(tira(em(f, [0.452, -0.06, 0.452, 0.06]), 0.012, t.nanquim, z + 0.01, { ...O, alfa: 0.6, detalhe: 3 }));
  void lu;
}

/** Ânforas empilhadas: uma camada de cinco deitadas, de pontas trocadas, e quatro por cima nos vãos, sobre a areia. */
function anforasEmpilhadas(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, bolha(0, 0, 0.85, 0.66, 14, 0.08, r), 0.01, '#3a2a18', 0.5, [0.03, 0.04]);
  for (let i = 0; i < 5; i++) { const x = -0.6 + i * 0.3 + (r() - 0.5) * 0.02, a = (i % 2 ? 1 : -1) * Math.PI / 2 + (r() - 0.5) * 0.05; anforaDeitada(partes, quadro(x, (r() - 0.5) * 0.06, a), a, r() < 0.3 ? BARRO : TERRACOTA, 0.25); }
  for (let i = 0; i < 4; i++) { const x = -0.45 + i * 0.3 + (r() - 0.5) * 0.02, a = (i % 2 ? -1 : 1) * Math.PI / 2 + (r() - 0.5) * 0.05; anforaDeitada(partes, quadro(x, (r() - 0.5) * 0.06, a), a, r() < 0.3 ? BARRO : TERRACOTA, 0.5); }
  return partes;
}

/** Pithos: o jarrão enterrado até o ombro, com dois cordões em relevo, o lábio grosso e o conteúdo (grão ou vinho); às vezes a tampa entreaberta. */
function pithos(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = TERRACOTA;
  sombraNoChao(partes, bolha(0, 0, 0.62, 0.6, 14, 0.1, r), 0.005, '#2a1a0c', 0.6, [0, 0]);
  disco(partes, 0, 0, 0.52, t, 0.1);
  for (const k of [0.9, 0.74]) {
    partes.push(tira(anel(0.006, 0.008, 0.52 * k), 0.05, t.nanquim, 0.116, { ...O, alfa: 0.55, detalhe: 2 }), tira(anel(0, 0, 0.52 * k), 0.032, t.base, 0.118, { ...O, detalhe: 2 }));
    for (let j = 0; j < 30; j++) { const a = (j / 30) * Math.PI * 2, R0 = 0.52 * k; partes.push(tira([Math.cos(a) * (R0 - 0.014), Math.sin(a) * (R0 - 0.014), Math.cos(a + 0.06) * (R0 + 0.014), Math.sin(a + 0.06) * (R0 + 0.014)], 0.012, tom(t.base, olhar(a) * 0.3 + 0.05), 0.12, { ...O, detalhe: 3 })); }
  }
  partes.push(elipse(0.01, 0.012, 0.72, 0.72, t.nanquim, 0.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(0, 0, 0.68, 0.68, t.meio, 0.203, { ...O, detalhe: 1 }));
  partes.push(tira(arco(LUZ_X * 0.012, LUZ_Y * 0.012, 0.3, 0.3, Math.PI * 0.85, Math.PI * 1.65), 0.05, t.luz, 0.205, { ...S, detalhe: 2 }, 0.3));
  partes.push(elipse(0, 0, 0.5, 0.5, '#140804', 0.21, { contorno: 'leve', detalhe: 1 }), elipse(-LUZ_X * 0.025, -LUZ_Y * 0.025, 0.4, 0.4, '#3a1a0c', 0.212, { ...S, alfa: 0.7, detalhe: 2 }));
  if (r() < 0.5) {   // grão
    partes.push(elipse(0.01, 0.01, 0.36, 0.36, '#8a6a30', 0.214, { ...S, detalhe: 2 }));
    for (let k = 0; k < 18; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.15; partes.push(elipse(0.01 + Math.cos(a) * d, 0.01 + Math.sin(a) * d, 0.02, 0.014, r() < 0.5 ? '#c8a050' : '#6a4a20', 0.216, { ...O, detalhe: 3 })); }
  } else {   // vinho escuro com o reflexo do céu
    partes.push(elipse(0.01, 0.01, 0.36, 0.36, '#2a0a10', 0.214, { ...S, detalhe: 2 }), elipse(-0.05, -0.05, 0.12, 0.05, '#8a6a78', 0.216, { ...S, alfa: 0.6, detalhe: 3 }));
  }
  if (r() < 0.5) {   // tampa entreaberta
    const tx = 0.3, ty = 0.22;
    disco(partes, tx, ty, 0.2, t, 0.26);
    partes.push(elipse(tx, ty, 0.08, 0.08, t.nanquim, 0.275, { contorno: 'leve', detalhe: 2 }), elipse(tx - 0.01, ty - 0.01, 0.055, 0.055, t.luz, 0.278, { ...O, detalhe: 3 }));
  }
  return partes;
}

/** Lucerna: a lamparina de óleo (corpo redondo com o disco em relevo, bico com a chama e a asa em anel), no chão (`pe` 0) ou no candelabro de bronze (`pe` 1). A chama brilha. */
function lucerna(seed: number, pe: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = pe ? BRONZE : TERRACOTA, z = pe ? 0.8 : 0.1, giro = pe ? r() * 6.28 : 0;
  partes.push(elipse(0.06, 0, 0.56, 0.56, '#7a2806', 0.01, { ...O, brilho: true, alfa: 0.3, desfoque: 0.08, detalhe: 1 }));
  if (pe) {
    for (let k = 0; k < 3; k++) {
      const a = giro + (k / 3) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a), ex = c * 0.22, ey = s * 0.22;
      partes.push(tira([c * 0.05, s * 0.05, c * 0.15, s * 0.15 - 0.01, ex, ey], 0.06, BRONZE.nanquim, 0.2, { contorno: 'leve', detalhe: 1 }, 0.6), tira([c * 0.05, s * 0.05, c * 0.15, s * 0.15 - 0.01, ex, ey], 0.032, tom(BRONZE.base, olhar(a) * 0.25), 0.205, { ...O, detalhe: 2 }));
      partes.push(elipse(ex, ey, 0.07, 0.06, BRONZE.nanquim, 0.06, { contorno: 'leve', detalhe: 2 }), elipse(ex, ey, 0.05, 0.042, BRONZE.luz, 0.065, { ...O, detalhe: 3 }));
    }
    disco(partes, 0.02, 0, 0.17, BRONZE, z - 0.06);
    partes.push(tira(anel(0.02, 0, 0.15), 0.012, BRONZE.sombra, z - 0.04, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  const bx = -0.06, R = 0.105;
  // O bico: do corpo à ponta arredondada, a leste.
  const bico = [bx, -R * 0.62, 0.12, -0.05, 0.17, -0.048, 0.205, -0.02, 0.21, 0.02, 0.17, 0.048, 0.12, 0.05, bx, R * 0.62];
  partes.push(poli(bico.map((v, i) => v + (i % 2 ? 0.01 : 0.008)), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(bico, t.base, z + 0.003, { ...O, detalhe: 1 }), poli(bico.map((v, i) => (i % 2 ? v * 0.45 - 0.018 : v)), t.luz, z + 0.005, { ...S, alfa: 0.8, detalhe: 2 }));
  // A asa em anel, a oeste.
  partes.push(tira(anel(bx - R - 0.02, 0, 0.035, 0.03, 12), 0.022, t.nanquim, z + 0.002, { contorno: 'leve', detalhe: 2 }), tira(anel(bx - R - 0.02, 0, 0.035, 0.03, 12), 0.012, t.luz, z + 0.004, { ...O, detalhe: 3 }));
  disco(partes, bx, 0, R, t, z + 0.006);
  // O disco côncavo com a roseta em relevo e o furo de encher.
  partes.push(elipse(bx, 0, R * 1.3, R * 1.3, tom(t.base, -0.15), z + 0.022, { ...O, detalhe: 2 }), elipse(bx - LUZ_X * R * 0.1, -LUZ_Y * R * 0.1, R * 1.0, R * 1.0, tom(t.meio, 0.05), z + 0.023, { ...S, detalhe: 2 }));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; partes.push(lente(bx + Math.cos(a) * R * 0.14, Math.sin(a) * R * 0.14, a, R * 0.42, R * 0.2, tom(t.base, olhar(a) * 0.3), z + 0.025, { ...O, detalhe: 3 })); }
  partes.push(elipse(bx, 0, R * 0.22, R * 0.22, '#120804', z + 0.027, { contorno: 'leve', detalhe: 2 }));
  // O pavio e a chama (brilho: cores escuras e saturadas).
  partes.push(elipse(0.17, 0, 0.05, 0.045, '#160804', z + 0.01, { contorno: 'leve', detalhe: 2 }));
  partes.push(elipse(0.19, 0, 0.16, 0.13, '#8a2a06', z + 0.03, { ...O, brilho: true, alfa: 0.7, desfoque: 0.03, detalhe: 1 }));
  partes.push(lente(0.165, 0, 0.12, 0.1, 0.06, '#b8480c', z + 0.035, { ...O, brilho: true, desfoque: 0.008, detalhe: 1 }), lente(0.17, 0, 0.12, 0.065, 0.034, '#c88a2a', z + 0.04, { ...O, brilho: true, desfoque: 0.004, detalhe: 2 }));
  return partes;
}

/** Tear vertical de pesos, encostado na parede (+y para a frente): as traves inclinadas, o pano tecido enrolado em cima com a barra grega, a urdidura que desce em feixes até os pesos de barro e o cesto de lã. */
function tearVertical(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  const cores = ([[POMPEIA, OCRE, LINHO], [ANIL, LINHO, OCRE], [PURPURA, OCRE, LINHO]] as const)[Math.floor(r() * 3)]!;
  sombraNoChao(partes, [-1.0, -0.5, 1.0, -0.5, 1.0, 0.42, -1.0, 0.42], 0.02, '#0d0a08', 0.3);
  // Os pesos de barro (pirâmides) em duas fiadas, e os feixes de fios que descem a eles.
  const pesos: [number, number][] = [];
  for (let i = 0; i < 14; i++) pesos.push([-0.74 + i * 0.114, 0.3 + (i % 2) * 0.07]);
  for (const [wx, wy] of pesos) for (const d of [-0.03, 0, 0.03]) partes.push(tira([wx + d, -0.08, wx + d * 0.3, wy - 0.03], 0.007, LINHO, 0.6, { ...O, alfa: 0.9, detalhe: 2 }));
  for (const [wx, wy] of pesos) {
    const pw = [wx - 0.045, wy - 0.04, wx + 0.045, wy - 0.04, wx + 0.055, wy + 0.045, wx - 0.055, wy + 0.045];
    partes.push(poli(pw.map((v, i) => v + (i % 2 ? 0.01 : 0.008)), TERRACOTA.nanquim, 0.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    partes.push(poli(pw, TERRACOTA.base, 0.303, { ...O, detalhe: 2 }), poli([wx - 0.045, wy - 0.04, wx, wy - 0.04, wx - 0.012, wy + 0.045, wx - 0.055, wy + 0.045], TERRACOTA.luz, 0.305, { ...O, detalhe: 3 }), elipse(wx, wy - 0.016, 0.016, 0.016, TERRACOTA.nanquim, 0.307, { ...O, detalhe: 3 }));
  }
  // As varas de liços e de cruz, apoiadas nos braços.
  for (const [y, w, z] of [[0.04, 0.04, 0.72], [0.16, 0.05, 0.66]] as const) partes.push(tira([-0.86, y, 0.86, y], w + 0.03, MADEIRA.nanquim, z, { contorno: 'leve', detalhe: 1 }), tira([-0.86, y, 0.86, y], w, MADEIRA.meio, z + 0.003, { ...O, detalhe: 2 }), tira([-0.86, y - w * 0.25, 0.86, y - w * 0.25], w * 0.3, MADEIRA.luz, z + 0.005, { ...O, detalhe: 3 }));
  // O pano tecido: listras e a barra grega (meandro) em cima.
  partes.push(poli([-0.8, -0.42, 0.8, -0.42, 0.8, -0.08, -0.8, -0.08], cores[0], 0.95, { contorno: 'leve', detalhe: 1 }));
  partes.push(poli([-0.8, -0.22, 0.8, -0.22, 0.8, -0.12, -0.8, -0.12], cores[2], 0.952, { ...O, detalhe: 2 }));
  const meandro: number[] = []; for (let x = -0.78, k = 0; x < 0.78; x += 0.04, k++) { const y = k % 4 < 2 ? -0.2 : -0.14; meandro.push(x, y, x + 0.04, y); }
  partes.push(tira(meandro, 0.012, cores[1], 0.954, { ...O, detalhe: 3 }));
  partes.push(poli([-0.8, -0.1, 0.8, -0.1, 0.8, -0.08, -0.8, -0.08], tom(cores[0], -0.3), 0.956, { ...O, detalhe: 2 }));
  partes.push(poli([-0.8, -0.42, 0.8, -0.42, 0.8, -0.3, -0.8, -0.3], tom(cores[0], 0.12), 0.957, { ...S, alfa: 0.7, detalhe: 2 }));
  // As traves laterais, inclinadas contra a parede, e o rolo de cima com o pano enrolado.
  for (const s of [-1, 1]) {
    const pts = [s * 0.9, -0.48, s * 0.9, 0.42];
    partes.push(tira(pts.map((v, i) => v + (i % 2 ? 0.012 : 0.01)), 0.12, MADEIRA.nanquim, 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(pts, 0.09, s < 0 ? MADEIRA.luz : MADEIRA.base, 1.003, { ...O, detalhe: 1 }), tira(pts.map((v, i) => (i % 2 ? v : v - 0.02)), 0.025, s < 0 ? MADEIRA.brilho : MADEIRA.meio, 1.005, { ...O, alfa: 0.8, detalhe: 3 }));
    partes.push(elipse(s * 0.9, 0.1, 0.1, 0.08, MADEIRA.nanquim, 1.01, { contorno: 'leve', detalhe: 2 }));
  }
  partes.push(tira([-1.0, -0.44, 1.0, -0.44], 0.13, MADEIRA.nanquim, 1.1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-0.98, -0.44, 0.98, -0.44], 0.1, MADEIRA.meio, 1.103, { ...O, detalhe: 1 }));
  partes.push(tira([-0.8, -0.44, 0.8, -0.44], 0.12, tom(cores[0], -0.2), 1.106, { ...O, detalhe: 1 }), tira([-0.8, -0.465, 0.8, -0.465], 0.04, tom(cores[0], 0.15), 1.108, { ...S, detalhe: 2 }));
  // O cesto (cálato) de lã, ao lado.
  const cx = 1.03, cy = 0.28;
  partes.push(elipse(cx + 0.01, cy + 0.012, 0.3, 0.3, '#2a1a0c', 0.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(cx, cy, 0.28, 0.28, '#8a6a38', 0.303, { ...O, detalhe: 1 }), tira(anel(cx, cy, 0.12), 0.02, '#a8884c', 0.305, { ...O, detalhe: 2 }));
  for (const [dx, dy, c] of [[-0.04, -0.03, cores[0]], [0.05, -0.01, cores[2]], [0, 0.05, cores[1]]] as const) fruta(partes, cx + dx, cy + dy, 0.05, c, 0.32);
  return partes;
}

/** Roda de carro de guerra vista de cima (de pé, rolando ao longo de x): aro de bronze, cambota e o cubo saliente. */
function rodaDeBiga(partes: Parte[], x: number, y: number, d: number, z: number): void {
  partes.push(poli(em(ID, [x - d / 2 + 0.01, y - 0.04, x + d / 2 + 0.03, y - 0.04, x + d / 2 + 0.03, y + 0.06, x - d / 2 + 0.01, y + 0.06]), MADEIRA.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(ID, x, y, d, 0.075, 0.03), BRONZE.base, z + 0.003, { ...O, detalhe: 1 }), poli(retR(ID, x, y - 0.012, d * 0.96, 0.03, 0.015), BRONZE.luz, z + 0.005, { ...O, detalhe: 2 }));
  for (const k of [-0.36, -0.18, 0.18, 0.36]) partes.push(poli(retQ(ID, x + k * d, y, 0.025, 0.1), MADEIRA.base, z + 0.006, { ...O, detalhe: 3 }));
  partes.push(elipse(x + 0.01, y + 0.01, 0.12, 0.26, BRONZE.nanquim, z + 0.01, { contorno: 'leve', detalhe: 1 }), elipse(x, y, 0.1, 0.24, BRONZE.meio, z + 0.013, { ...O, detalhe: 2 }), elipse(x - 0.015, y - 0.02, 0.04, 0.12, BRONZE.brilho, z + 0.015, { ...O, alfa: 0.8, detalhe: 3 }));
}

/** Biga: o carro de guerra de duas rodas, sem os cavalos: a caixa em D aberta atrás (guarda de bronze pintada de vermelho, piso de correias), o eixo, as rodas, o timão e o jugo pousado no chão. */
function biga(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = r() < 0.5 ? POMPEIA : ANIL;
  sombraNoChao(partes, [0.8, -0.6, 1.7, -0.6, 1.7, 0.6, 0.8, 0.6], 0.02, '#0d0a08', 0.4);
  // O timão (de madeira, cintado de bronze) e o jugo com as duas forquilhas.
  const timao = [0.85, 0, 0.2, 0.01, -0.6, 0.0, -1.5, -0.01];
  partes.push(tira(timao.map((v, i) => v + (i % 2 ? 0.014 : 0.012)), 0.11, MADEIRA.nanquim, 0.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(timao, 0.075, MADEIRA.meio, 0.403, { ...O, detalhe: 1 }), tira(timao.map((v, i) => (i % 2 ? v - 0.018 : v)), 0.02, MADEIRA.brilho, 0.405, { ...O, alfa: 0.7, detalhe: 3 }));
  for (const x of [0.4, -0.4, -1.2]) partes.push(poli(retQ(ID, x, 0, 0.05, 0.09), BRONZE.luz, 0.41, { contorno: 'leve', detalhe: 2 }));
  const jugo = [-1.48, -0.66, -1.53, -0.3, -1.54, 0, -1.53, 0.3, -1.48, 0.66];
  partes.push(tira(jugo.map((v, i) => v + (i % 2 ? 0.014 : 0.012)), 0.12, MADEIRA.nanquim, 0.42, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(jugo, 0.085, MADEIRA.base, 0.423, { ...O, detalhe: 1 }), tira(jugo.map((v, i) => (i % 2 ? v : v - 0.02)), 0.025, MADEIRA.luz, 0.425, { ...O, detalhe: 3 }));
  for (const s of [-1, 1]) {
    const y0 = s * 0.4;
    for (const d of [-0.13, 0.13]) partes.push(tira([-1.53, y0 + d * 0.4, -1.42, y0 + d, -1.3, y0 + d * 1.1], 0.04, BRONZE.nanquim, 0.43, { contorno: 'leve', detalhe: 2 }), tira([-1.53, y0 + d * 0.4, -1.42, y0 + d, -1.3, y0 + d * 1.1], 0.02, BRONZE.luz, 0.433, { ...O, detalhe: 3 }));
    partes.push(tira(anel(-1.53, y0, 0.04, 0.035, 10), 0.015, BRONZE.brilho, 0.44, { contorno: 'leve', detalhe: 3 }));
  }
  // O eixo e as rodas.
  partes.push(tira([1.3, -0.86, 1.3, 0.86], 0.07, MADEIRA.nanquim, 0.45, { contorno: 'leve', detalhe: 1 }), tira([1.3, -0.86, 1.3, 0.86], 0.045, MADEIRA.base, 0.452, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) rodaDeBiga(partes, 1.3, s * 0.78, 0.92, 0.5);
  // A caixa em D: o piso de correias trançadas e a guarda curva aberta atrás.
  const D: number[] = [1.62, -0.5]; for (let k = 0; k <= 14; k++) { const a = -Math.PI / 2 - (k / 14) * Math.PI; D.push(1.1 + Math.cos(a) * 0.32, Math.sin(a) * 0.5); } D.push(1.62, 0.5);
  partes.push(poli(D.map((v, i) => v + (i % 2 ? 0.016 : 0.014)), MADEIRA.nanquim, 0.6, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(D, '#4a2e18', 0.603, { ...O, detalhe: 1 }));
  for (let k = -4; k <= 4; k++) partes.push(tira([0.85, k * 0.1, 1.6, k * 0.1], 0.04, k % 2 ? '#6a4424' : '#5a3a1e', 0.605, { ...O, detalhe: 2 }));
  for (let k = 0; k < 7; k++) partes.push(tira([0.9 + k * 0.1, -0.48, 0.9 + k * 0.1, 0.48], 0.035, '#7a5230', 0.606, { ...O, alfa: 0.75, detalhe: 3 }));
  // A face de dentro da guarda (sombra no lado do noroeste, luz no do sudeste) e o topo com o friso de bronze.
  const guarda = D.slice(0);
  const dentro = guarda.map((v, i) => (i % 2 ? v * 0.84 : 1.1 + (v - 1.1) * 0.8 + 0.04));
  partes.push(tira(dentro, 0.09, tom(cor, -0.45), 0.7, { ...O, detalhe: 2 }));
  partes.push(tira(guarda.map((v, i) => v + (i % 2 ? 0.014 : 0.012)), 0.1, BRONZE.nanquim, 0.85, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(guarda, 0.075, cor, 0.853, { ...O, detalhe: 1 }));
  partes.push(tira(guarda, 0.025, BRONZE.luz, 0.856, { ...O, detalhe: 2 }));
  for (let k = 2; k < D.length - 2; k += 6) partes.push(elipse(D[k]!, D[k + 1]!, 0.05, 0.05, BRONZE.brilho, 0.86, { contorno: 'leve', detalhe: 3 }));
  // As rédeas enroladas no piso.
  partes.push(tira(anel(1.35, -0.18, 0.09, 0.07, 14), 0.018, '#3a2414', 0.62, { contorno: 'leve', detalhe: 3 }), tira([1.35, -0.11, 1.2, 0.05, 0.95, 0.1], 0.018, '#3a2414', 0.62, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Folha de parreira: três lóbulos em leque, nanquim, tom pelo lado da luz e a nervura. */
function folhaDeVideira(partes: Parte[], x: number, y: number, k: number, ang: number, t: { fundo: string; meio: string; luz: string }, z: number): void {
  const d = olhar(ang) > 0 ? t.luz : t.meio;
  for (const da of [-0.7, 0, 0.7]) partes.push(lente(x + 0.008, y + 0.01, ang + da, k * (da ? 0.85 : 1.05), k * 0.62, t.fundo, z, { contorno: 'leve', detalhe: 2 }));
  for (const da of [-0.7, 0, 0.7]) partes.push(lente(x, y, ang + da, k * (da ? 0.78 : 0.98), k * 0.52, d, z + 0.002, { ...O, detalhe: 2 }));
  partes.push(tira([x, y, x + Math.cos(ang) * k * 0.8, y + Math.sin(ang) * k * 0.8], 0.008, t.fundo, z + 0.004, { ...O, alfa: 0.7, detalhe: 3 }, 0.3));
}

/** Pérgola com videira: pilares de estuque, vigas e caibros de madeira e a copa da parreira, com falhas que deixam ver os caibros e os cachos. */
function pergolado(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], X = 1.8, Y = 1.3;
  const VIDE = { fundo: '#16240c', base: '#34501c', meio: '#486a24', luz: '#628832', brilho: '#86a84a' };
  for (const x of [-X, 0, X]) for (const y of [-Y, Y]) bloco(partes, quadro(x, y), 0.26, 0.26, ESTUQUE, 1.3, 0.04);
  for (const y of [-Y, Y]) partes.push(tira([-1.98, y, 1.98, y], 0.16, MADEIRA.nanquim, 1.42, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-1.98, y, 1.98, y], 0.12, MADEIRA.base, 1.423, { ...O, detalhe: 1 }), tira([-1.98, y - 0.03, 1.98, y - 0.03], 0.035, MADEIRA.luz, 1.425, { ...O, detalhe: 2 }));
  for (let x = -1.8; x <= 1.81; x += 0.45) partes.push(tira([x, -1.48, x, 1.48], 0.09, MADEIRA.nanquim, 1.48, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([x, -1.48, x, 1.48], 0.06, MADEIRA.meio, 1.483, { ...O, detalhe: 1 }), tira([x - 0.015, -1.48, x - 0.015, 1.48], 0.018, MADEIRA.brilho, 1.485, { ...O, alfa: 0.7, detalhe: 3 }));
  // O tronco da parreira, torcido, subindo em dois pilares.
  for (const [x, y] of [[-X, Y], [X, -Y]] as const) { const pts: number[] = []; for (let k = 0; k <= 8; k++) pts.push(x + Math.sin(k * 1.3) * 0.12 + (x < 0 ? k * 0.08 : -k * 0.08), y + Math.cos(k * 1.1) * 0.08 + (y > 0 ? -k * 0.05 : k * 0.05)); partes.push(tira(pts, 0.09, '#2a1a10', 1.5, { contorno: 'leve', detalhe: 1 }, 0.6), tira(pts, 0.04, '#5a3e26', 1.503, { ...O, detalhe: 2 }, 0.6)); }
  // A copa: a parreira corre ao longo dos caibros, em ramas de tufos pequenos que se encostam, com folhas soltas na borda e falhas entre as ramas.
  for (let x = -1.8; x <= 1.81; x += 0.45) {
    let y = -1.35 + r() * 0.3;
    while (y < 1.3) {
      if (r() < 0.18) { y += 0.35 + r() * 0.3; continue; }
      const R = 0.13 + r() * 0.09, tx = x + (r() - 0.5) * 0.28, ty = y;
      partes.push(poli(bolha(tx + 0.02, ty + 0.025, R * 1.1, R * 1.05, 12, 0.14, r), VIDE.fundo, 1.58, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      tufo(partes, r, tx, ty, R, tonsComLuz(VIDE, (r() - 0.5) * 0.14), 1.6, 3, 12, 5);
      if (r() < 0.6) { const a = r() * 6.28; folhaDeVideira(partes, tx + Math.cos(a) * R * 1.1, ty + Math.sin(a) * R * 1.1, 0.08 + r() * 0.03, a, VIDE, 1.62); }
      y += R * (1.2 + r() * 0.5);
    }
  }
  for (let k = 0; k < 12; k++) { const x = -1.8 + Math.floor(r() * 9) * 0.45 + (r() - 0.5) * 0.3, y = (r() - 0.5) * 2.4; cacho(partes, r, x, y, 0.09, r() < 0.7 ? '#4a2050' : '#8a9a3a', 1.66, 10); }
  return partes;
}

/** Impluvio: o tanque raso do átrio, com a borda de mármore, o fundo de mosaico (barra negra e roseta) visto pela água clara, a sombra da borda e os anéis da chuva. */
function impluvio(seed: number, C: number, Lg: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], b = 0.24, ci = C - 2 * b, li = Lg - 2 * b;
  // Fundo de mosaico.
  partes.push(poli(retQ(ID, 0, 0, ci + 0.02, li + 0.02), '#b4ae9a', 0.01, { ...O, detalhe: 1 }));
  partes.push(tira([-ci / 2 + 0.08, -li / 2 + 0.08, ci / 2 - 0.08, -li / 2 + 0.08, ci / 2 - 0.08, li / 2 - 0.08, -ci / 2 + 0.08, li / 2 - 0.08, -ci / 2 + 0.08, -li / 2 + 0.08], 0.06, '#1e1a16', 0.012, { ...O, detalhe: 2 }));
  for (let x = -ci / 2 + 0.2; x < ci / 2 - 0.15; x += 0.12) for (const s of [-1, 1]) partes.push(poli(retQ(ID, x, s * (li / 2 - 0.2), 0.05, 0.05), '#1e1a16', 0.013, { ...O, detalhe: 3 }));
  for (let y = -li / 2 + 0.32; y < li / 2 - 0.27; y += 0.12) for (const s of [-1, 1]) partes.push(poli(retQ(ID, s * (ci / 2 - 0.2), y, 0.05, 0.05), '#1e1a16', 0.013, { ...O, detalhe: 3 }));
  const Rr = Math.min(ci, li) * 0.22;
  partes.push(elipse(0, 0, Rr * 2, Rr * 2, '#1e1a16', 0.013, { ...O, detalhe: 2 }), elipse(0, 0, Rr * 1.8, Rr * 1.8, '#b4ae9a', 0.014, { ...O, detalhe: 2 }));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; partes.push(lente(0, 0, a, Rr * 0.86, Rr * 0.3, k % 2 ? '#8a2a1c' : '#1e1a16', 0.015, { ...O, detalhe: 3 })); }
  // A água: veladura verde-azulada, mais funda (escura) junto às bordas, o reflexo do céu e os anéis.
  partes.push(poli(retQ(ID, 0, 0, ci, li), '#1a5866', 0.02, { ...O, alfa: 0.62, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, 0, ci * 0.8, li * 0.7), '#6ab0b8', 0.021, { ...S, alfa: 0.16, detalhe: 2 }));
  partes.push(poli([-ci / 2, -li / 2, ci / 2, -li / 2, ci / 2, -li / 2 + 0.14, -ci / 2 + 0.14, -li / 2 + 0.14, -ci / 2 + 0.14, li / 2, -ci / 2, li / 2], '#0e2a30', 0.022, { ...S, alfa: 0.45, detalhe: 2 }));
  for (let k = 0; k < 3; k++) { const x = (r() - 0.5) * ci * 0.6, y = (r() - 0.5) * li * 0.5; partes.push(tira([x - 0.3, y + 0.12, x + 0.3, y - 0.12], 0.1, '#e4f4f2', 0.023, { ...S, alfa: 0.14, detalhe: 3 }, 0.2)); }
  for (let k = 0; k < 3; k++) { const x = (r() - 0.5) * ci * 0.5, y = (r() - 0.5) * li * 0.5; for (const rr of [0.06, 0.13]) partes.push(tira(anel(x, y, rr, rr * 0.9, 16), 0.012, '#e8f6f4', 0.024, { ...O, alfa: rr < 0.1 ? 0.6 : 0.35, detalhe: 3 })); }
  // A borda de mármore em quatro lajes, e a bica de escoar.
  bloco(partes, quadro(0, -Lg / 2 + b / 2), C, b, MARMORE, 0.14, 0.05);
  bloco(partes, quadro(0, Lg / 2 - b / 2), C, b, MARMORE, 0.14, 0.05);
  bloco(partes, quadro(-C / 2 + b / 2, 0), b, li, MARMORE, 0.141, 0.05);
  bloco(partes, quadro(C / 2 - b / 2, 0), b, li, MARMORE, 0.141, 0.05);
  partes.push(ret(C / 2 - b / 2, li / 2 - 0.25, 0.1, 0.14, '#2a2018', 0.15, { contorno: 'leve', raio: 0.02, detalhe: 2 }));
  for (const [x, y] of [[-C / 2 + b, -Lg / 2 + b], [C / 2 - b, -Lg / 2 + b], [-C / 2 + b, Lg / 2 - b], [C / 2 - b, Lg / 2 - b]] as const) partes.push(tira([x, y - 0.12, x, y + 0.12], 0.008, MARMORE.nanquim, 0.16, { ...O, alfa: 0.35, detalhe: 3 }));
  return partes;
}

/** Golfinho de mosaico no fundo do tanque, em tesselas escuras: corpo arqueado com bico, barbatanas, cauda em leque, a barriga clara e o olho. `k` é o comprimento. */
function golfinho(partes: Parte[], x: number, y: number, ang: number, k: number, cor: string, claro: string, z: number): void {
  const f = quadro(x, y, ang), arqueia = (pts: number[]) => pts.map((v, i) => (i % 2 ? (v - 0.16 * (1 - (2 * pts[i - 1]!) ** 2)) * k : v * k));
  const corpo = [0.5, 0, 0.44, -0.035, 0.3, -0.08, 0.1, -0.11, -0.1, -0.095, -0.3, -0.055, -0.42, -0.025, -0.52, -0.14, -0.47, 0, -0.52, 0.14, -0.42, 0.025, -0.3, 0.045, -0.1, 0.075, 0.1, 0.085, 0.3, 0.065, 0.44, 0.03];
  partes.push(poli(em(f, arqueia(corpo)), cor, z, { ...O, detalhe: 1 }));
  partes.push(poli(em(f, arqueia([0.06, -0.1, -0.1, -0.22, -0.12, -0.09])), cor, z, { ...O, detalhe: 2 }));
  partes.push(poli(em(f, arqueia([0.2, 0.07, 0.07, 0.2, 0.05, 0.08])), cor, z, { ...O, detalhe: 2 }));
  partes.push(tira(em(f, arqueia([0.38, 0.03, 0.15, 0.06, -0.15, 0.045])), 0.022 * k, claro, z + 0.001, { ...O, detalhe: 3 }, 0.3));
  const olho = em(f, arqueia([0.33, -0.03]));
  partes.push(elipse(olho[0]!, olho[1]!, 0.035 * k, 0.035 * k, claro, z + 0.001, { ...O, detalhe: 3 }));
}

/**
 * Tanque de banho das termas (alveus): borda larga de mármore, três degraus que descem para dentro da água numa ponta,
 * o banco submerso ao longo dos lados, o fundo de mosaico com golfinhos e a bica de bronze na outra ponta.
 * `quente` (caldário) põe vapor sobre a água e a deixa mais verde; frio (frigidário), mais azul e limpa.
 */
function tanqueDeBanho(seed: number, C: number, Lg: number, quente: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], b = 0.32, ci = C - 2 * b, li = Lg - 2 * b;
  const x0 = -ci / 2, x1 = ci / 2, y0 = -li / 2, y1 = li / 2, passo = Math.min(0.38, ci * 0.1), banco = Math.min(0.3, li * 0.12);
  const fundo = quente ? '#a49c84' : '#a8aca0', tessela = quente ? '#2a3a3a' : '#1c2c40';
  // Fundo de mosaico: o campo claro, a barra de ondas escura e os golfinhos.
  partes.push(poli(retQ(ID, 0, 0, ci + 0.02, li + 0.02), fundo, 0.01, { ...O, detalhe: 1 }));
  const fx0 = x0 + 3 * passo + 0.12, fx1 = x1 - 0.12, fy0 = y0 + banco + 0.12, fy1 = y1 - banco - 0.12;
  partes.push(tira([fx0, fy0, fx1, fy0, fx1, fy1, fx0, fy1, fx0, fy0], 0.05, tessela, 0.012, { ...O, detalhe: 2 }));
  for (const yy of [fy0 + 0.1, fy1 - 0.1]) for (let x = fx0 + 0.12; x < fx1 - 0.1; x += 0.22) partes.push(tira(arco(x, yy, 0.07, 0.05, Math.PI, Math.PI * 2.6, 8), 0.022, tessela, 0.013, { ...O, detalhe: 3 }));
  const meioX = (fx0 + fx1) / 2, kG = Math.min(1.6, (fx1 - fx0) * 0.36, (fy1 - fy0) * 0.75);
  golfinho(partes, meioX - kG * 0.3, -(fy1 - fy0) * 0.18, -0.12, kG, tessela, fundo, 0.014);
  golfinho(partes, meioX + kG * 0.3, (fy1 - fy0) * 0.2, Math.PI - 0.12, kG, tessela, fundo, 0.014);
  // O banco submerso ao longo dos lados compridos e os degraus da ponta de entrar, cada um mais fundo (mais escuro) que o de cima.
  for (const s of [-1, 1]) {
    const yb = s * (li / 2 - banco / 2);
    partes.push(poli(retQ(ID, (x0 + 3 * passo + x1) / 2, yb, ci - 3 * passo, banco), MARMORE.base, 0.015, { ...O, detalhe: 1 }));
    partes.push(tira([x0 + 3 * passo, yb - s * banco / 2, x1, yb - s * banco / 2], 0.02, MARMORE.sombra, 0.016, { ...O, detalhe: 2 }));
  }
  for (let k = 0; k < 3; k++) {
    const xa = x0 + k * passo, tons = [MARMORE.luz, MARMORE.meio, MARMORE.base];
    partes.push(poli([xa, y0, xa + passo, y0, xa + passo, y1, xa, y1], tons[k]!, 0.016 + k * 0.001, { ...O, detalhe: 1 }));
    partes.push(tira([xa + passo - 0.025, y0, xa + passo - 0.025, y1], 0.05, '#4e463a', 0.018, { ...O, alfa: 0.85, detalhe: 2 }));
    partes.push(tira([xa + 0.025, y0 + 0.02, xa + 0.025, y1 - 0.02], 0.035, MARMORE.brilho, 0.0235, { ...O, alfa: 0.75 - k * 0.2, detalhe: 2 }));
  }
  // A água: veladura que engrossa do degrau de cima para a parte funda, a sombra da borda (noroeste), o céu e as cáusticas.
  const agua = quente ? '#1f5a52' : '#1a4e6e', ceu = quente ? '#8cc4b0' : '#8cc0dc';
  // O degrau de cima fica quase fora d'água: só a lâmina rasa e a linha molhada.
  partes.push(poli([x0, y0, x0 + passo, y0, x0 + passo, y1, x0, y1], agua, 0.02, { ...O, alfa: 0.12, detalhe: 1 }));
  partes.push(poli([x0 + passo, y0, x1, y0, x1, y1, x0 + passo, y1], agua, 0.02, { ...O, alfa: 0.36, detalhe: 1 }));
  partes.push(poli([x0 + 2 * passo, y0, x1, y0, x1, y1, x0 + 2 * passo, y1], agua, 0.0205, { ...O, alfa: 0.16, detalhe: 1 }));
  partes.push(tira([x0 + passo, y0, x0 + passo, y1], 0.02, '#e8f6f4', 0.0225, { ...O, alfa: 0.45, detalhe: 2 }));
  partes.push(poli([x0 + 3 * passo, y0 + banco, x1, y0 + banco, x1, y1 - banco, x0 + 3 * passo, y1 - banco], agua, 0.021, { ...O, alfa: 0.2, detalhe: 1 }));
  partes.push(poli([x0, y0, x1, y0, x1, y0 + 0.16, x0 + 0.16, y0 + 0.16, x0 + 0.16, y1, x0, y1], '#0c2228', 0.022, { ...S, alfa: 0.4, detalhe: 2 }));
  partes.push(poli(retQ(ID, 0.1, 0, ci * 0.7, li * 0.6), ceu, 0.0225, { ...S, alfa: 0.14, detalhe: 2 }));
  for (let k = 0; k < 7; k++) {
    const x = x0 + passo * 2 + r() * (ci - passo * 2.6), y = y0 + 0.2 + r() * (li - 0.4), w = 0.25 + r() * 0.35;
    partes.push(tira([x - w / 2, y + (r() - 0.5) * 0.1, x, y + (r() - 0.5) * 0.12, x + w / 2, y + (r() - 0.5) * 0.1], 0.025, '#eaf6f4', 0.023, { ...O, alfa: 0.28, detalhe: 3 }, 0.4));
  }
  // A borda de mármore em lajes, com a junta das quinas.
  bloco(partes, quadro(0, -Lg / 2 + b / 2), C, b, MARMORE, 0.14, 0.06);
  bloco(partes, quadro(0, Lg / 2 - b / 2), C, b, MARMORE, 0.14, 0.06);
  bloco(partes, quadro(-C / 2 + b / 2, 0), b, li, MARMORE, 0.141, 0.06);
  bloco(partes, quadro(C / 2 - b / 2, 0), b, li, MARMORE, 0.141, 0.06);
  for (const [x, y] of [[-C / 2 + b, -Lg / 2 + b], [C / 2 - b, -Lg / 2 + b], [-C / 2 + b, Lg / 2 - b], [C / 2 - b, Lg / 2 - b]] as const) partes.push(tira([x, y - 0.14, x, y + 0.14], 0.008, MARMORE.nanquim, 0.16, { ...O, alfa: 0.35, detalhe: 3 }));
  for (let k = 0; k < 4; k++) { const x = (r() - 0.5) * (C - 0.6), s = r() < 0.5 ? -1 : 1; partes.push(tira([x, s * (Lg / 2 - b * 0.7), x + 0.1, s * (Lg / 2 - b * 0.4)], 0.008, MARMORE.sombra, 0.161, { ...O, alfa: 0.5, detalhe: 3 })); }
  // A bica de bronze no meio da ponta funda, com o jorro e a espuma.
  const bx = C / 2 - b / 2, B = BRONZE;
  disco(partes, bx, 0, 0.13, B, 0.2, 0.12);
  partes.push(elipse(bx - 0.06, 0, 0.07, 0.05, '#1a1612', 0.22, { contorno: 'leve', detalhe: 2 }));
  partes.push(elipse(bx + 0.03, -0.09, 0.05, 0.04, PATINA, 0.215, { ...O, alfa: 0.6, detalhe: 3 }));
  partes.push(tira([bx - 0.08, 0, x1 - 0.2, 0.01], 0.06, '#8ac4d0', 0.19, { contorno: 'leve', alfa: 0.9, detalhe: 1 }, 0.6), tira([bx - 0.08, -0.005, x1 - 0.22, 0], 0.018, '#f0fafa', 0.195, { ...O, alfa: 0.9, detalhe: 2 }));
  for (const rr of [0.1, 0.2, 0.3]) partes.push(tira(anel(x1 - 0.24, 0, rr, rr * 0.85, 18), 0.014, '#e8f6f4', 0.024, { ...O, alfa: 0.55 - rr, detalhe: 3 }));
  partes.push(elipse(x1 - 0.24, 0, 0.16, 0.13, '#f2fafa', 0.025, { ...S, alfa: 0.7, detalhe: 2 }));
  // Vapor do caldário: véus claros e moles por cima da água e da borda.
  if (quente) for (let k = 0; k < 7; k++) {
    const x = (r() - 0.5) * ci * 0.85, y = (r() - 0.5) * li * 0.7;
    for (let j = 0; j < 3; j++) { const w = 0.5 + r() * 0.6; partes.push(elipse(x + (r() - 0.5) * 0.6, y + (r() - 0.5) * 0.3, w, w * (0.45 + r() * 0.25), '#eef2ee', 0.3, { ...S, alfa: 0.07 + r() * 0.05, detalhe: 2 })); }
  }
  return partes;
}

/** Fonte de parede com máscara: a laje de mármore encostada na parede, a cabeça de leão que verte água e a bacia semicircular à frente. */
function fonteComMascara(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cy = -0.3, RX = 0.64, RY = 0.74;
  sombraNoChao(partes, [-0.7, -0.5, 0.7, -0.5, 0.7, 0.1, 0.4, 0.45, -0.4, 0.45, -0.7, 0.1], 0.02, '#0d0a08', 0.35);
  // A bacia: borda de mármore em segmentos com o tom da face, a água com a espuma da queda.
  const arco = (k: number, n = 16): number[] => { const p: number[] = []; for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI; p.push(Math.cos(a) * RX * k, cy + Math.sin(a) * RY * k); } return p; };
  const agua = arco(0.84);
  partes.push(poli(agua, '#2c4a5a', 0.3, { ...O, detalhe: 1 }), poli(arco(0.7).map((v, i) => (i % 2 ? v + 0.02 : v)), '#3d6578', 0.31, { ...S, detalhe: 2 }), poli(arco(0.45).map((v, i) => (i % 2 ? v + 0.04 : v)), '#5a8a9c', 0.32, { ...S, detalhe: 2 }));
  for (const rr of [0.08, 0.16, 0.25]) partes.push(tira(anel(0, -0.02, rr, rr * 0.8, 18).slice(0, 22), 0.014, '#cfe6ec', 0.33, { ...O, alfa: 0.6 - rr, detalhe: 3 }));
  partes.push(elipse(0, -0.02, 0.12, 0.09, '#e6f3f7', 0.335, { ...S, alfa: 0.8, detalhe: 2 }));
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI, a1 = ((i + 1) / n) * Math.PI, am = (a0 + a1) / 2;
    const p = (a: number, k: number) => [Math.cos(a) * RX * k, cy + Math.sin(a) * RY * k];
    const seg = [...p(a0, 1), ...p(a1, 1), ...p(a1, 0.84), ...p(a0, 0.84)];
    partes.push(poli(seg.map((v, j) => v + (j % 2 ? 0.014 : 0.012)), MARMORE.nanquim, 0.5, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    partes.push(poli(seg, tomDaFace(MARMORE, olhar(am)), 0.503, { ...O, detalhe: 1 }));
    partes.push(poli([...p(a0, 0.88), ...p(a1, 0.88), ...p(a1, 0.84), ...p(a0, 0.84)], tomDaFace(MARMORE, -olhar(am)), 0.505, { ...O, alfa: 0.8, detalhe: 2 }));
  }
  if (r() < 0.8) partes.push(poli(bolha(RX * 0.5, cy + RY * 0.55, 0.12, 0.06, 8, 0.3, r), '#4a5a2a', 0.51, { ...S, alfa: 0.7, detalhe: 3 }));
  // A laje de trás, com cornija.
  bloco(partes, quadro(0, -0.4), 1.36, 0.18, MARMORE_VELHO, 1.1, 0.04);
  bloco(partes, quadro(0, -0.44), 0.8, 0.1, MARMORE_VELHO, 1.14, 0.025);
  partes.push(tira([-0.62, -0.32, 0.62, -0.32], 0.02, MARMORE.sombra, 1.12, { ...O, alfa: 0.7, detalhe: 3 }));
  // A cabeça de leão: juba em mechas, a testa, o focinho e a boca que verte.
  const hx = 0, hy = -0.22, B = BRONZE;
  partes.push(elipse(hx + 0.014, hy + 0.016, 0.44, 0.38, B.nanquim, 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; partes.push(lente(hx + Math.cos(a) * 0.06, hy + Math.sin(a) * 0.05, a, 0.17, 0.08, tom(B.base, olhar(a) * 0.35), 0.905, { ...O, detalhe: 2 })); }
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2 + 0.2; partes.push(elipse(hx + Math.cos(a) * 0.16, hy + Math.sin(a) * 0.13, 0.03, 0.03, PATINA, 0.906, { ...O, alfa: 0.55, detalhe: 3 })); }
  disco(partes, hx, hy + 0.03, 0.11, B, 0.92, 0.1);
  partes.push(elipse(hx, hy + 0.11, 0.13, 0.1, B.meio, 0.94, { contorno: 'leve', detalhe: 2 }), elipse(hx - 0.015, hy + 0.095, 0.06, 0.035, B.brilho, 0.945, { ...O, detalhe: 3 }));
  for (const s of [-1, 1]) partes.push(elipse(hx + s * 0.05, hy + 0.0, 0.035, 0.024, B.nanquim, 0.95, { ...O, detalhe: 3 }), elipse(hx + s * 0.12, hy - 0.08, 0.06, 0.05, B.meio, 0.95, { contorno: 'leve', detalhe: 3 }));
  partes.push(elipse(hx, hy + 0.16, 0.06, 0.035, '#1a1612', 0.95, { contorno: 'leve', detalhe: 2 }));
  // O jorro, da boca à espuma.
  partes.push(tira([hx, hy + 0.16, hx, hy + 0.22, hx, -0.02], 0.055, '#7ab4c4', 0.7, { contorno: 'leve', alfa: 0.95, detalhe: 1 }, 0.7), tira([hx - 0.008, hy + 0.16, hx - 0.008, -0.03], 0.018, '#eef8fa', 0.705, { ...O, alfa: 0.95, detalhe: 2 }));
  return partes;
}

/** Armário de rolos (armarium sem portas, visto de cima): nichos com rolos de papiro deitados para a frente, as etiquetas penduradas, tabuinhas de cera e uma cápsula. */
function estanteDeRolos(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 1.8, P = 0.56, nb = 4, vao = (L - 0.08) / nb;
  sombraNoChao(partes, [-0.92, -0.3, 0.92, -0.3, 0.92, 0.3, -0.92, 0.3], 0.02, '#0d0a08', 0.4);
  bloco(partes, ID, L, P, MADEIRA, 0.3, 0.03);
  partes.push(poli(retQ(ID, 0, 0.02, L - 0.08, P - 0.08), '#1a0e06', 0.32, { ...O, detalhe: 1 }));
  for (let i = 0; i < nb; i++) {
    const x0 = -L / 2 + 0.04 + i * vao + 0.03, x1 = x0 + vao - 0.06, tipo = r();
    if (i === 2 && tipo < 0.5) {   // tabuinhas de cera empilhadas
      for (let k = 0; k < 4; k++) { const x = (x0 + x1) / 2 + (r() - 0.5) * 0.04, y = 0.02 + (r() - 0.5) * 0.04; partes.push(poli(retR(quadro(x, y, (r() - 0.5) * 0.2), 0, 0, 0.3, 0.22, 0.01), k % 2 ? MADEIRA.meio : MADEIRA.base, 0.6 + k * 0.05, { contorno: 'leve', detalhe: 1 }), poli(retR(quadro(x, y, 0), 0, 0, 0.24, 0.16, 0.01), '#2a2014', 0.602 + k * 0.05, { ...O, alfa: 0.85, detalhe: 2 })); }
      continue;
    }
    for (let camada = 0; camada < 2; camada++) {
      const d = 0.075, z = 0.7 + camada * 0.25;
      for (let x = x0 + d / 2 + (camada ? d / 2 : 0); x < x1 - d / 2 + 0.001; x += d) {
        if (camada && r() < 0.25) continue;
        const len = 0.34 + r() * 0.12, y = P / 2 - 0.04 - len / 2 - r() * 0.05, papiro = tom('#d4c08e', (r() - 0.5) * 0.15);
        partes.push(poli(retR(ID, x + 0.006, y + 0.008, d + 0.012, len + 0.012, d / 2), '#2a1a0c', z, { contorno: 'leve', detalhe: 1 }), poli(retR(ID, x, y, d, len, d / 2), tom(papiro, -0.15), z + 0.002, { ...O, detalhe: 1 }), poli(retR(ID, x - d * 0.15, y, d * 0.45, len * 0.94, d * 0.22), tom(papiro, 0.12), z + 0.004, { ...S, detalhe: 2 }));
        partes.push(elipse(x, y + len / 2 + 0.008, 0.03, 0.03, '#3a2414', z + 0.006, { contorno: 'leve', detalhe: 3 }));
        if (r() < 0.35) partes.push(poli(retQ(ID, x + 0.01, y + len / 2 + 0.035, 0.028, 0.05), [POMPEIA, OCRE, '#2f5a3a'][Math.floor(r() * 3)]!, z + 0.008, { contorno: 'leve', detalhe: 3 }));
      }
    }
  }
  for (let i = 0; i <= nb; i++) { const x = -L / 2 + 0.04 + i * vao; partes.push(poli(retQ(ID, x, 0, 0.05, P), MADEIRA.nanquim, 1.2, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, x - 0.005, 0, 0.032, P - 0.01), MADEIRA.luz, 1.203, { ...O, detalhe: 2 })); }
  partes.push(poli(retQ(ID, 0, -P / 2 + 0.025, L, 0.05), MADEIRA.nanquim, 1.2, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, 0, -P / 2 + 0.022, L - 0.01, 0.032), MADEIRA.meio, 1.203, { ...O, detalhe: 2 }));
  return partes;
}

/** Banca de mercado com toldo: o toldo de uma água com listras e o babado na frente, o balcão de mármore com três dólios embutidos (azeitona, grão, vinho), cestos de frutas, pães e ânforas ao lado. */
function bancaDeMercado(seed: number, paleta: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], [c1, c2] = ([['#9a3a24', '#cdbf9c'], ['#3a5470', '#cdbf9c'], ['#b08838', '#6a4628']] as const)[paleta]!;
  sombraNoChao(partes, [-1.5, -1.15, 1.5, -1.15, 1.5, 1.1, -1.5, 1.1], 0.02, '#0d0a08', 0.3);
  // Ânforas e cestos na frente e ao lado.
  anforaDePe(partes, r, 1.25, 0.5, 0.17, TERRACOTA, 0.5);
  anforaDePe(partes, r, 1.22, 0.88, 0.15, BARRO, 0.45);
  const cesto = (x: number, y: number, R: number, cor: string, n: number) => {
    partes.push(elipse(x + 0.01, y + 0.012, R * 2 + 0.04, R * 2 + 0.04, '#2a1a0c', 0.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(x, y, R * 2, R * 2, '#8a6a38', 0.303, { ...O, detalhe: 1 }), tira(anel(x, y, R * 0.85), 0.02, '#a8884c', 0.305, { ...O, detalhe: 2 }), elipse(x, y, R * 1.5, R * 1.5, '#3a2610', 0.306, { ...O, detalhe: 2 }));
    for (let k = 0; k < n; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.55; fruta(partes, x + Math.cos(a) * d, y + Math.sin(a) * d, R * 0.24, tom(cor, (r() - 0.5) * 0.15), 0.32 + k * 0.002); }
  };
  cesto(-1.05, 1.0, 0.17, '#a82a20', 7); cesto(-0.6, 1.02, 0.15, '#c8a030', 6); cesto(-0.15, 1.04, 0.15, '#3a4a20', 12);
  // O balcão de mármore com os dólios.
  bloco(partes, quadro(-0.2, 0.62), 2.3, 0.42, MARMORE_VELHO, 0.9, 0.05);
  for (const [k, x] of [-0.9, -0.3, 0.3].entries()) {
    partes.push(elipse(x, 0.62, 0.3, 0.3, TERRACOTA.nanquim, 0.92, { contorno: 'leve', detalhe: 1 }), elipse(x, 0.62, 0.26, 0.26, TERRACOTA.meio, 0.923, { ...O, detalhe: 2 }), elipse(x, 0.62, 0.2, 0.2, '#140804', 0.925, { ...O, detalhe: 1 }));
    if (k === 0) for (let j = 0; j < 10; j++) fruta(partes, x + (r() - 0.5) * 0.12, 0.62 + (r() - 0.5) * 0.12, 0.018, '#3a4020', 0.93);
    else if (k === 1) partes.push(elipse(x, 0.62, 0.17, 0.17, '#b8944a', 0.927, { ...S, detalhe: 2 }));
    else partes.push(elipse(x, 0.62, 0.17, 0.17, '#2a0a10', 0.927, { ...S, detalhe: 2 }), elipse(x - 0.03, 0.6, 0.06, 0.025, '#8a6a78', 0.93, { ...S, alfa: 0.6, detalhe: 3 }));
  }
  for (let k = 0; k < 3; k++) { const x = 0.55 + k * 0.13, y = 0.62 + (k % 2 ? 0.06 : -0.05); disco(partes, x, y, 0.06, { nanquim: '#2a1608', sombra: '#7a4a1c', base: '#a06a2a', meio: '#b87e36', luz: '#cc9848', brilho: '#e6bc70' }, 0.94); }
  // O toldo de uma água (alto atrás, baixo na frente): listras ao comprido, babado recortado e os dois paus da frente.
  const y0 = -1.15, y1 = 0.38, n = 10, w = 2.96 / n;
  partes.push(poli([-1.5, y0, 1.5, y0, 1.5, y1 + 0.04, -1.5, y1 + 0.04], tom(c1, -0.55), 2.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let i = 0; i < n; i++) {
    const x0 = -1.48 + i * w, c = i % 2 ? c2 : c1;
    partes.push(poli([x0, y0 + 0.02, x0 + w, y0 + 0.02, x0 + w, y1, x0, y1], tom(c, -0.12), 2.02, { ...O, detalhe: 1 }));
    partes.push(poli([x0, y0 + 0.02, x0 + w, y0 + 0.02, x0 + w, y0 + 0.55, x0, y0 + 0.55], tom(c, 0.02), 2.021, { ...S, alfa: 0.8, detalhe: 2 }));
    partes.push(poli([x0, y1 - 0.45, x0 + w, y1 - 0.45, x0 + w, y1, x0, y1], tom(c, -0.3), 2.021, { ...S, alfa: 0.5, detalhe: 2 }));
    partes.push(tira([x0 + w, y0 + 0.02, x0 + w, y1], 0.012, tom(c1, -0.6), 2.022, { ...O, alfa: 0.5, detalhe: 3 }));
    partes.push(poli([x0 + w * 0.12, y0 + 0.05, x0 + w * 0.4, y0 + 0.05, x0 + w * 0.4, y0 + 0.6, x0 + w * 0.12, y0 + 0.6], tom(c, 0.14), 2.025, { ...S, alfa: 0.6, detalhe: 3 }));
    partes.push(elipse(x0 + w / 2, y1, w * 0.96, 0.18, tom(c, -0.28), 2.015, { ...S, detalhe: 2 }));
  }
  partes.push(poli([-1.5, y1 - 0.1, 1.5, y1 - 0.1, 1.5, y1 - 0.04, -1.5, y1 - 0.04], tom(c1, -0.45), 2.03, { ...O, alfa: 0.5, detalhe: 2 }));
  for (const x of [-1.44, 1.44]) partes.push(elipse(x, y1 - 0.04, 0.1, 0.1, MADEIRA.nanquim, 2.05, { contorno: 'leve', detalhe: 2 }), elipse(x - 0.01, y1 - 0.05, 0.05, 0.05, MADEIRA.luz, 2.055, { ...O, detalhe: 3 }));
  return partes;
}

/** Lira (quélis) deitada: a caixa de casco de tartaruga, os dois braços de chifre, a travessa com as cravelhas, sete cordas e a fita. */
function lira(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, bolha(0, 0.05, 0.3, 0.4, 12, 0.05, r), 0.01, '#0d0a08', 0.3);
  // Os braços de chifre, curvos, e a travessa.
  for (const s of [-1, 1]) {
    const pts = [s * 0.09, 0.06, s * 0.17, -0.06, s * 0.21, -0.2, s * 0.17, -0.32, s * 0.19, -0.38];
    partes.push(tira(pts.map((v, i) => v + (i % 2 ? 0.01 : 0.008)), 0.06, '#140c06', 0.1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, 0.7), tira(pts, 0.042, '#4a3220', 0.103, { ...O, detalhe: 1 }, 0.7), tira(pts.map((v, i) => (i % 2 ? v : v - s * 0.008 - 0.004)), 0.014, '#8a6a48', 0.105, { ...O, detalhe: 3 }, 0.5));
  }
  partes.push(tira([-0.22, -0.34, 0.22, -0.34], 0.045, MADEIRA.nanquim, 0.11, { contorno: 'leve', detalhe: 1 }), tira([-0.22, -0.34, 0.22, -0.34], 0.03, MADEIRA.luz, 0.113, { ...O, detalhe: 2 }));
  // A caixa: casco de tartaruga com as placas.
  partes.push(elipse(0.01, 0.2, 0.38, 0.34, '#1a0e06', 0.08, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(0, 0.19, 0.35, 0.31, '#5a3a18', 0.083, { ...O, detalhe: 1 }), elipse(-0.02, 0.17, 0.26, 0.22, '#6e4a20', 0.085, { ...S, detalhe: 2 }));
  for (const [x, y] of [[0, 0.19], [-0.08, 0.14], [0.08, 0.14], [-0.08, 0.24], [0.08, 0.24], [0, 0.09], [0, 0.29]] as const) partes.push(poli(bolha(x, y, 0.045, 0.04, 6, 0.08, r, Math.PI / 6), tom('#8a6a30', y < 0.19 ? 0.1 : -0.1), 0.087, { contorno: 'leve', detalhe: 2 }), elipse(x - 0.008, y - 0.008, 0.03, 0.025, '#b08a48', 0.089, { ...S, alfa: 0.6, detalhe: 3 }));
  // O cavalete e as cordas, as cravelhas na travessa.
  partes.push(tira([-0.08, 0.22, 0.08, 0.22], 0.025, '#d8c8a0', 0.12, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 7; k++) { const x = -0.075 + k * 0.025, xt = -0.15 + k * 0.05; partes.push(tira([x, 0.23, xt, -0.34], 0.006, '#ece2c8', 0.125, { ...O, alfa: 0.9, detalhe: 2 })); partes.push(elipse(xt, -0.34, 0.025, 0.025, '#2a1a0c', 0.13, { contorno: 'leve', detalhe: 3 })); }
  partes.push(tira([0.2, -0.3, 0.26, -0.18, 0.24, -0.05, 0.28, 0.06], 0.025, POMPEIA, 0.115, { contorno: 'leve', detalhe: 3 }, 0.6));
  partes.push(tira([0.12, 0.3, 0.18, 0.36, 0.22, 0.34], 0.008, '#3a2414', 0.09, { ...O, detalhe: 3 }), lente(0.22, 0.34, -0.3, 0.06, 0.025, '#d8c8a0', 0.095, { contorno: 'leve', detalhe: 3 }));
  return partes;
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

/** O kit da Antiguidade: templo e cidade (Q15a), casa e vida (Q15b). */
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

  // Q15b: casa e vida.
  { id: 'triclinio', nome: 'Triclínio', categoria: 'camas', tipo: 'piso', funcoes: ['triclinio', 'sala-de-jantar', 'salao', 'atrio', 'peristilo'], ...A, tags: ['triclinio', 'leito', 'banquete', 'jantar', 'romana', 'grega', 'reclinado', 'almofada', 'divã'], pegada: [4.4, 4.2], altura: 0.75,
    campos: [{ id: 'leitos', rotulo: 'Leitos (1 um só, 3 em U)', tipo: 'numero', padrao: 3, min: 1, max: 3, passo: 2 }],
    gerar: p => { const t = triclinio(p.seed, Math.round(num(p, 'leitos', 3, 1, 3))); return piso(t.pegada, t.partes); } },
  { id: 'mesa-romana', nome: 'Mesa romana', categoria: 'mesas', tipo: 'piso', funcoes: ['triclinio', 'sala-de-jantar', 'salao', 'atrio', 'peristilo', 'taberna'], ...A, tags: ['mesa', 'marmore', 'redonda', 'banquete', 'uvas', 'vinho', 'pao', 'romana', 'grega'], pegada: [1.0, 1.0], altura: 0.8,
    gerar: p => piso([1.0, 1.0], mesaRomana(p.seed)) },
  { id: 'anfora', nome: 'Ânfora', categoria: 'cozinha', tipo: 'piso', funcoes: ['cozinha', 'taberna', 'porao', 'deposito', 'mercado', 'porto', 'atrio'], ...A, tags: ['anfora', 'jarro', 'vaso', 'terracota', 'barro', 'vinho', 'azeite', 'romana', 'grega'], pegada: [0.6, 0.6], altura: 1.0,
    gerar: p => { const r = mulberry32(p.seed), partes: Parte[] = []; sombraNoChao(partes, bolha(0.02, 0.03, 0.24, 0.24, 12, 0.05, r), 0.02, '#0d0a08', 0.5); anforaDePe(partes, r, 0, 0, 0.23, r() < 0.3 ? BARRO : TERRACOTA, 0.6); return piso([0.6, 0.6], partes); } },
  { id: 'anforas-empilhadas', nome: 'Ânforas empilhadas', categoria: 'cozinha', tipo: 'piso', funcoes: ['porao', 'deposito', 'taberna', 'mercado', 'porto', 'cozinha'], ...A, tags: ['anfora', 'pilha', 'carga', 'terracota', 'vinho', 'azeite', 'porto', 'armazem', 'romana'], pegada: [1.6, 1.3], altura: 0.7,
    gerar: p => piso([1.6, 1.3], anforasEmpilhadas(p.seed)) },
  { id: 'pithos', nome: 'Pithos (jarrão enterrado)', categoria: 'cozinha', tipo: 'piso', funcoes: ['porao', 'deposito', 'cozinha', 'taberna', 'jardim'], ...A, tags: ['pithos', 'dolio', 'jarro', 'jarrao', 'terracota', 'grao', 'vinho', 'enterrado', 'armazem'], pegada: [1.3, 1.3], altura: 0.35,
    gerar: p => piso([1.3, 1.3], pithos(p.seed)) },
  { id: 'lucerna', nome: 'Lucerna', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['atrio', 'triclinio', 'quarto', 'biblioteca', 'templo', 'termas', 'taberna', 'sala'], ...A, tags: ['lucerna', 'lamparina', 'candeeiro', 'oleo', 'chama', 'luz', 'candelabro', 'romana', 'brilho'], pegada: [0.6, 0.6],
    campos: [{ id: 'pe', rotulo: 'Pé (0 no chão, 1 no candelabro)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: (): LuzDeReceita => ({ preset: 'lucerna', raio: 3.5, cor: '#ffc27a', intensidade: 0.75, power: 'fire', flicker: 0.2 }),
    gerar: p => piso([0.6, 0.6], lucerna(p.seed, Math.round(num(p, 'pe', 1, 0, 1)) === 1)) },
  { id: 'tear-vertical', nome: 'Tear vertical de pesos', categoria: 'decoracao', tipo: 'piso', funcoes: ['atrio', 'quarto', 'oficina', 'sala'], ...A, tags: ['tear', 'tecelagem', 'pesos', 'urdidura', 'pano', 'la', 'grega', 'romana'], pegada: [2.3, 1.1], altura: 1.9,
    gerar: p => piso([2.3, 1.1], tearVertical(p.seed)) },
  { id: 'biga', nome: 'Biga (carro de guerra)', categoria: 'exterior', tipo: 'piso', funcoes: ['estabulo', 'estrada', 'arena', 'forum', 'quartel'], ...A, tags: ['biga', 'carro', 'carruagem', 'guerra', 'corrida', 'circo', 'roda', 'bronze', 'romana', 'grega'], pegada: [3.6, 1.9], altura: 1.1,
    gerar: p => piso([3.6, 1.9], biga(p.seed)) },
  { id: 'pergolado-com-videira', nome: 'Pérgola com videira', categoria: 'exterior', tipo: 'piso', funcoes: ['peristilo', 'jardim', 'patio', 'taberna'], ...A, tags: ['pergola', 'pergolado', 'videira', 'parreira', 'uva', 'sombra', 'jardim', 'romana', 'grega'], pegada: [4.2, 3.1], altura: 2.6,
    gerar: p => piso([4.2, 3.1], pergolado(p.seed)) },
  { id: 'impluvio', nome: 'Impluvio', categoria: 'decoracao', tipo: 'piso', funcoes: ['atrio', 'peristilo', 'termas'], ...A, tags: ['impluvio', 'tanque', 'agua', 'chuva', 'atrio', 'mosaico', 'marmore', 'romana'], pegada: [3, 2.2], altura: 0.15,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 3, min: 1.6, max: 6, passo: 0.2 }, { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2.2, min: 1.2, max: 4, passo: 0.2 }],
    gerar: p => { const C = num(p, 'comprimento', 3, 1.6, 6), L = num(p, 'largura', 2.2, 1.2, 4); return piso([C, L], impluvio(p.seed, C, L)); } },
  { id: 'tanque-de-banho', nome: 'Tanque de banho', categoria: 'banheiro', tipo: 'piso', funcoes: ['termas', 'banheiro', 'peristilo'], ...A, tags: ['tanque', 'banho', 'piscina', 'termas', 'caldario', 'frigidario', 'degraus', 'agua', 'mosaico', 'golfinho', 'marmore', 'romana', 'vapor'], pegada: [5, 3.6], altura: 0.15,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 5, min: 3, max: 9, passo: 0.2 }, { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 3.6, min: 2.4, max: 6, passo: 0.2 },
      { id: 'quente', rotulo: 'Água (0 fria, 1 quente com vapor)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const C = num(p, 'comprimento', 5, 3, 9), L = num(p, 'largura', 3.6, 2.4, 6); return piso([C, L], tanqueDeBanho(p.seed, C, L, Math.round(num(p, 'quente', 0, 0, 1)) === 1)); } },
  { id: 'fonte-com-mascara', nome: 'Fonte com máscara', categoria: 'decoracao', tipo: 'piso', funcoes: ['atrio', 'peristilo', 'jardim', 'praca', 'forum', 'termas'], ...A, tags: ['fonte', 'mascara', 'leao', 'bica', 'agua', 'bacia', 'marmore', 'parede', 'romana', 'grega'], pegada: [1.4, 1.0], altura: 1.5,
    gerar: p => piso([1.4, 1.0], fonteComMascara(p.seed)) },
  { id: 'estante-de-rolos', nome: 'Armário de rolos', categoria: 'armazenamento', tipo: 'piso', funcoes: ['biblioteca', 'atrio', 'escritorio', 'templo', 'sala'], ...A, tags: ['estante', 'armario', 'rolos', 'papiro', 'pergaminho', 'biblioteca', 'livros', 'tabuinhas', 'romana', 'grega'], pegada: [1.8, 0.56], altura: 1.9,
    gerar: p => piso([1.8, 0.56], estanteDeRolos(p.seed)) },
  { id: 'banca-de-mercado.toldo', nome: 'Banca de mercado com toldo', categoria: 'exterior', tipo: 'piso', funcoes: ['mercado', 'forum', 'praca', 'taberna', 'porto'], ...A, tags: ['banca', 'mercado', 'toldo', 'feira', 'balcao', 'termopolio', 'dolio', 'frutas', 'anfora', 'agora', 'romana'], pegada: [3, 2.3], altura: 2.4,
    campos: [{ id: 'paleta', rotulo: 'Cores do toldo (0 a 2)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => piso([3, 2.3], bancaDeMercado(p.seed, Math.round(num(p, 'paleta', 0, 0, 2)))) },
  { id: 'lira', nome: 'Lira', categoria: 'decoracao', tipo: 'piso', funcoes: ['triclinio', 'sala', 'atrio', 'peristilo', 'templo', 'quarto'], ...A, tags: ['lira', 'citara', 'instrumento', 'musica', 'cordas', 'tartaruga', 'grega', 'bardo'], pegada: [0.6, 0.8], altura: 0.15,
    gerar: p => piso([0.6, 0.8], lira(p.seed)) },
];
