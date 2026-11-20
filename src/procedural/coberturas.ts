import { contextoDe, criarTela, type Tela } from './canvas.ts';
import type { Material } from './materiais.ts';
import { hash2D } from './ruido.ts';

/**
 * Coberturas de telhado: cada uma é uma função pura que diz, para um ponto em metros `(u, v)` sobre a água,
 * o **tom** (`t`, 0 = escuro, 0,5 = base, 1 = claro), a vontade de **mancha** (`m`: musgo, ferrugem, azinhavre),
 * a **altura miúda** dentro da peça (`h`, 0–1, para relevo e normais) e o **id** inteiro estável da peça.
 * A queda d'água aponta para +y (+v): as fiadas correm em x (u) e a de cima cobre a de baixo.
 * O modo contínuo amostra em metros sem repetir a cada 2 m (usado pelo assado por edifício); o modo periódico
 * fecha em `PERIODO_DA_COBERTURA` para miniaturas e para o Pixel.
 */

export const PADROES_DE_COBERTURA = [
  'telha-canal',
  'escamas',
  'ardosia',
  'palha',
  'tabuinhas',
  'lajes-telhado',
  'ondulado',
  'cobre',
  'concreto-laje',
  'grama-telhado',
  'lona',
  'tabuas-telhado',
  'telha-francesa',
  'telha-esmaltada',
  'chapa-com-junta',
  'fibrocimento',
  'bambu',
  'couro-telhado',
  'chumbo',
] as const;
export type PadraoDeCobertura = (typeof PADROES_DE_COBERTURA)[number];
export const ehPadraoDeCobertura = (p: string): p is PadraoDeCobertura => (PADROES_DE_COBERTURA as readonly string[]).includes(p);

/** Estilos de capa de cumeeira/espigão recomendados por padrão de cobertura (usado pelo assado de telhado). */
export const CAPAS_DE_CUMEEIRA = [
  'telha-canal',
  'telha-esmaltada',
  'ardosia',
  'tabua',
  'palha',
  'pedra',
  'chapa-dobrada',
  'fibrocimento',
  'bambu',
  'couro',
  'chumbo',
  'lona',
  'grama',
  'platibanda',
] as const;
export type CapaDeCumeeira = (typeof CAPAS_DE_CUMEEIRA)[number];

export const CAPA_DA_COBERTURA: Readonly<Record<PadraoDeCobertura, CapaDeCumeeira>> = {
  'telha-canal': 'telha-canal',
  'telha-francesa': 'telha-canal',
  'telha-esmaltada': 'telha-esmaltada',
  escamas: 'ardosia',
  ardosia: 'ardosia',
  palha: 'palha',
  tabuinhas: 'tabua',
  'tabuas-telhado': 'tabua',
  'lajes-telhado': 'pedra',
  ondulado: 'chapa-dobrada',
  cobre: 'chapa-dobrada',
  'chapa-com-junta': 'chapa-dobrada',
  fibrocimento: 'fibrocimento',
  bambu: 'bambu',
  'couro-telhado': 'couro',
  chumbo: 'chumbo',
  'concreto-laje': 'platibanda',
  'grama-telhado': 'grama',
  lona: 'lona',
};

/** Lado do ladrilho periódico em metros: no modo periódico todo padrão fecha nos dois eixos. */
export const PERIODO_DA_COBERTURA = 2;
/** Resolução do ladrilho no Ilustrado (px/m). */
export const RES_DA_COBERTURA = 80;

export interface AmostraDeCobertura {
  /** Tom local (0 = escuro, 0,5 = base, 1 = claro). */
  t: number;
  /** Vontade de mancha (musgo, ferrugem, azinhavre). */
  m: number;
  /** Altura miúda dentro da peça (0–1): juntas fundas perto de 0, bordas/cristas altas perto de 1. */
  h: number;
  /** Inteiro não-negativo estável por peça (telha, placa, tábua, chapa, painel). */
  id: number;
}

type AmostradorInterno = (x: number, y: number, s: number, o: AmostraDeCobertura, periodico: boolean) => void;
export type AmostradorDeCobertura = (u: number, v: number, saida: AmostraDeCobertura) => void;

const P = PERIODO_DA_COBERTURA;
const md = (i: number, n: number) => ((i % n) + n) % n;
const fr = (v: number) => v - Math.floor(v);
const lim = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const liso = (t: number) => t * t * (3 - 2 * t);
const entre = (a: number, b: number, x: number) => liso(lim((x - a) / (b - a)));
const h2 = (i: number, j: number, s: number) => hash2D(i, j, s);

/** Inteiro não-negativo estável para a peça `(i, j)` (e subpeça opcional `sub`). */
function idPeca(i: number, j: number, sub = 0): number {
  let n = (Math.imul(i | 0, 374761393) ^ Math.imul(j | 0, 668265263) ^ Math.imul(sub | 0, 1442695041)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) & 0x7fffffff;
}

/** Hash determinístico [0, 1) a partir do `id` da peça e de uma semente. */
export function hashDaPeca(id: number, semente = 0): number {
  return hash2D(id | 0, semente | 0, 9187);
}

/** Ruído de valor: `nx` células a cada `P` m em x e `ny` em y; fecha no período só quando `periodico` é verdadeiro. */
function vr(x: number, y: number, nx: number, ny: number, s: number, periodico: boolean): number {
  const u = (x / P) * nx, v = (y / P) * ny, xi = Math.floor(u), yi = Math.floor(v), a = liso(u - xi), b = liso(v - yi);
  if (periodico) {
    const g = (i: number, j: number) => h2(md(i, nx), md(j, ny), s);
    return (g(xi, yi) * (1 - a) + g(xi + 1, yi) * a) * (1 - b) + (g(xi, yi + 1) * (1 - a) + g(xi + 1, yi + 1) * a) * b;
  }
  return (h2(xi, yi, s) * (1 - a) + h2(xi + 1, yi, s) * a) * (1 - b) + (h2(xi, yi + 1, s) * (1 - a) + h2(xi + 1, yi + 1, s) * a) * b;
}

/** Oitavas de `vr`, preservando a mesma frequência espacial nos modos contínuo e periódico. */
function fb(x: number, y: number, nx: number, ny: number, s: number, periodico: boolean, oitavas = 3): number {
  let soma = 0, amp = 1, total = 0;
  for (let k = 0; k < oitavas; k++) {
    soma += amp * vr(x, y, nx << k, ny << k, s + k * 31, periodico);
    total += amp;
    amp *= 0.5;
  }
  return soma / total;
}

/**
 * Fronteiras de peças de largura variada numa fiada (`n` peças a cada `P` m), com a fiada inteira deslocada.
 * No modo periódico fecha em `[0, P]`; no contínuo corre livremente em `x` sem repetir.
 */
function pecaNaFiada(
  x: number,
  j: number,
  n: number,
  tremor: number,
  s: number,
  periodico: boolean,
): { k: number; a: number; b: number; xx: number } {
  const w = P / n;
  if (periodico) {
    const desl = h2(j, 0, s + 41) * P, xx = fr((x - desl) / P) * P;
    const borda = (k: number) => (k <= 0 ? 0 : k >= n ? P : k * w + (h2(k, j, s + 43) - 0.5) * tremor * w);
    let k = Math.min(n - 1, Math.floor(xx / w));
    while (k > 0 && xx < borda(k)) k--;
    while (k < n - 1 && xx >= borda(k + 1)) k++;
    return { k, a: borda(k), b: borda(k + 1), xx };
  }
  const desl = h2(j, 0, s + 41) * w * 7, xx = x - desl;
  const borda = (k: number) => k * w + (h2(k, j, s + 43) - 0.5) * tremor * w;
  let k = Math.floor(xx / w);
  while (xx < borda(k)) k--;
  while (xx >= borda(k + 1)) k++;
  return { k, a: borda(k), b: borda(k + 1), xx };
}

/** Platô com junta funda e bisel nítido, como nos pintores de altura. */
const bisel = (d: number, junta: number, larg: number) => entre(junta, junta + larg, d);

const AMOSTRADORES: Record<PadraoDeCobertura, AmostradorInterno> = {
  /**
   * Telha canal (barro e telha velha): capas convexas em arco alto e canais côncavos fundos em colunas,
   * borda inferior espessa em arco sobrepondo a fiada de baixo, variação por peça (±8%) e ~1 em 40 telhas trocadas.
   */
  'telha-canal': (x, y, s, o, per) => {
    const cw = 0.25, rh = 0.4;
    const iRaw = Math.floor(x / cw), jRaw = Math.floor(y / rh);
    const i = per ? md(iRaw, 8) : iRaw, j = per ? md(jRaw, 5) : jRaw;
    const u = x / cw - iRaw, v = y / rh - jRaw;
    const capa = u >= 0.28;
    const uc = capa ? (u - 0.28) / 0.72 : u / 0.28;
    const id = idPeca(i, j, capa ? 1 : 0);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;      // ±8%
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.2;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.06;
    const pontaPeca = (hashDaPeca(id, s + 61) - 0.5) * 0.03;
    // Cerca de 1 em cada 40 telhas é visivelmente mais clara ou mais escura (telha trocada).
    const rTroca = hashDaPeca(id, s + 53);
    const troca = capa ? (rTroca < 0.0125 ? -0.26 : rTroca > 0.9875 ? 0.26 : 0) : 0;

    const dx = 2 * uc - 1;
    // Perfil semicircular forte na capa (sem derivada infinita nas bordas) e calha côncava no canal.
    const arco = capa ? Math.sqrt(Math.max(0, 1 - 0.92 * dx * dx)) : 0;
    const bojo = Math.sin(Math.PI * uc);
    const ponta = (capa ? 0.84 + 0.11 * bojo : 0.88 + 0.04 * bojo) + pontaPeca;

    let h: number;
    let t: number;
    if (v > ponta) {
      const f = (v - ponta) / Math.max(1e-4, 1 - ponta);
      h = 0.05 + 0.06 * f;
      t = 0.09 + 0.08 * f;
    } else if (capa) {
      const rampa = 0.74 + 0.26 * (v / ponta);
      const lip = entre(ponta, ponta - 0.06, v);
      const encaixe = entre(0, 0.09, v);
      const bordaLat = entre(0, 0.08, Math.min(uc, 1 - uc));
      h = (0.26 + 0.66 * arco) * rampa * (0.34 + 0.66 * lip) * (0.72 + 0.28 * encaixe) * (0.74 + 0.26 * bordaLat) + altPeca;
      // Albedo quase simétrico (deixa a luz direcional ler o arco em `h`), com leve realce de crista e oclusão de borda.
      t = 0.45 + 0.06 * Math.cos(Math.PI * uc) + 0.17 * bojo + tomPeca + troca - (ponta - v < 0.04 ? 0.12 : 0);
      if (v < 0.12) t -= 0.24 * (1 - v / 0.12);
    } else {
      const rampa = 0.82 + 0.18 * (v / ponta);
      const lip = entre(ponta, ponta - 0.05, v);
      h = (0.12 + 0.16 * dx * dx) * rampa * (0.45 + 0.55 * lip) + altPeca * 0.4;
      t = 0.26 + 0.1 * dx * dx + tomPeca * 0.7;
      if (v < 0.12) t -= 0.2 * (1 - v / 0.12);
    }

    const grao = fb(x, y, 16, 16, s + 3, per);
    o.t = t + (grao - 0.5) * 0.12;
    o.m = fb(x, y, 4, 4, s + 7, per) * 0.68 + fb(x, y, 40, 40, s + 8, per) * 0.24 + (capa ? -0.05 : 0.12) + 0.12 * v + manchaPeca - (troca > 0 ? 0.24 : 0);
    o.h = lim(h + (grao - 0.5) * 0.025);
    o.id = id;
  },

  /**
   * Escamas de ardósia: fiadas desencontradas de placas arredondadas; cada escama sobe suavemente até
   * a borda inferior espessa em arco, com bisel nítido e sombra funda sobre a fiada de baixo.
   */
  escamas: (x, y, s, o, per) => {
    const sw = 0.25, rh = 0.2, r = sw / 2;
    const escama = (jRow: number) => {
      const off = md(jRow, 2) * r;
      const iRaw = Math.floor((x - off) / sw);
      const cx = off + iRaw * sw + r;
      const dx = (x - cx) / r;
      const fundo = jRow * rh + rh * 0.55 + rh * 0.9 * Math.sqrt(Math.max(0, 1 - dx * dx));
      return { iRaw, dx, fundo };
    };
    const j0 = Math.floor(y / rh), cima = escama(j0 - 1);
    const dentroDeCima = y <= cima.fundo;
    const e = dentroDeCima ? cima : escama(j0);
    const jRaw = dentroDeCima ? j0 - 1 : j0;
    const i = per ? md(e.iRaw, 8) : e.iRaw, j = per ? md(jRaw, 10) : jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.22;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.18;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.06;
    const inclinacao = (hashDaPeca(id, s + 73) - 0.5) * 0.05 * e.dx;

    const vb = e.fundo - y;                                      // distância até a borda inferior curva (m)
    const vs = (1 - Math.abs(e.dx)) * r;                         // distância até a junta lateral (m)
    const sobCima = dentroDeCima ? 1 : y - cima.fundo;

    // A escama é mais alta na borda inferior exposta e afunda suavemente sob a fiada de cima.
    const rampa = 0.9 - 0.34 * lim(vb / 0.2);
    const bordaInf = bisel(vb, 0.004, 0.017);
    const bordaLat = bisel(vs, 0.004, 0.014);
    const degrauCima = dentroDeCima ? 1 : 0.22 + 0.78 * entre(0, 0.024, sobCima);
    const grao = fb(x, y, 20, 20, s + 3, per);

    let h = (0.09 + (rampa - 0.09) * bordaInf * bordaLat) * degrauCima + altPeca + inclinacao + (grao - 0.5) * 0.02;
    let t = 0.5 + tomPeca - e.dx * 0.03 + 0.07 * entre(0, 0.08, vb) + (grao - 0.5) * 0.09;
    if (vb < 0.013) { t = 0.13; h = Math.min(h, 0.11 + (vb / 0.013) * 0.16); }
    if (vs < 0.006) { t = Math.min(t, 0.18); }
    if (!dentroDeCima && sobCima < 0.036) t -= 0.28 * (1 - sobCima / 0.036);

    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) + manchaPeca + (vb < 0.03 ? 0.1 : 0);
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Ardósia: placas retangulares finas e desencontradas, platô plano com quina biselada nítida,
   * junta lateral fina, leve lascado na borda inferior e degrau marcante em cada fiada.
   */
  ardosia: (x, y, s, o, per) => {
    const w = 0.25, rh = 0.2;
    const jRaw = Math.floor(y / rh), v = y / rh - jRaw;
    const off = md(jRaw, 2) * (w / 2);
    const iRaw = Math.floor((x - off) / w), u = (x - off) / w - iRaw;
    const i = per ? md(iRaw, 8) : iRaw, j = per ? md(jRaw, 10) : jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.28;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.18;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.08;
    const tilt = (hashDaPeca(id, s + 73) - 0.5) * 0.05 * (u - 0.5);
    const lascaBorda = (hashDaPeca(id, s + 61) - 0.5) * 0.006 + (vr(x, 0, 48, 1, s + md(j, 10) * 13 + (per ? 0 : j * 7), per) - 0.5) * 0.004;

    const du = Math.min(u, 1 - u) * w;
    const db = (1 - v) * rh + lascaBorda;
    const dt = v * rh;

    const rampa = 0.46 + 0.46 * lim(v / 0.92);
    const platLat = bisel(du, 0.005, 0.011);
    const platInf = bisel(db, 0.008, 0.013);
    const sobCima = 0.3 + 0.7 * entre(0, 0.02, dt);
    const grao = fb(x, y, 24, 24, s + 3, per);

    const h = (0.07 + (rampa - 0.07) * platLat * platInf) * sobCima + altPeca + tilt + (grao - 0.5) * 0.025;
    let t = 0.5 + tomPeca + (grao - 0.5) * 0.11 + (u < 0.08 ? 0.02 : 0);
    if (du < 0.007) t = 0.12;
    if (db < 0.013) t = 0.1;
    if (dt < 0.032) t -= 0.24 * (1 - dt / 0.032);

    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) + manchaPeca + (du < 0.02 || db < 0.025 ? 0.12 : 0);
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Palha: feixes espessos na direção da queda em cursos de 0,5 m, borda grossa e desfiada no beiral
   * de cada curso e estrias fundas de colmo para o sol ler o volume dos feixes.
   */
  palha: (x, y, s, o, per) => {
    const rh = 0.5;
    const jRaw = Math.floor(y / rh), v = y / rh - jRaw;
    const j = per ? md(jRaw, 4) : jRaw;
    // Feixes de largura variada (~25 cm) dão identidade de peça e volume arredondado ao colmo.
    const { k, a, b, xx } = pecaNaFiada(x, j, 8, 0.4, s, per);
    const id = idPeca(k, j);
    const uLocal = (xx - a) / Math.max(1e-4, b - a);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;      // ±8%
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.18;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.08;

    const fibra = fb(x, y, 64, 4, s, per, 3);
    const estriaFina = vr(x, y, 128, 6, s + 19, per);
    const colmoX = per ? md(Math.floor(x / 0.02), 100) : Math.floor(x / 0.02);
    const fio = h2(colmoX, j, s + 5);

    const sBeira = s + md(j, 4) * 17 + (per ? 0 : j * 7);
    const ondaLarga = (vr(x, 0, 12, 1, sBeira + 3, per) - 0.5) * 0.1;
    const fiapo = (vr(x, 0, 64, 1, sBeira, per) - 0.5) * 0.16;
    const beira = lim(0.82 + ondaLarga + fiapo + (hashDaPeca(id, s + 61) - 0.5) * 0.05);
    const domoFeixe = 0.72 + 0.28 * Math.sin(Math.PI * lim(uLocal));

    const tSombra = 0.09 + 0.12 * fibra;
    let h: number;
    let t = 0.34 + 0.38 * fibra + (fio - 0.5) * 0.2 + tomPeca;
    if (v > beira) {
      const f = (v - beira) / Math.max(1e-4, 1 - beira);
      h = 0.06 + 0.09 * fibra * (1 - 0.45 * f);
      t = tSombra;
    } else {
      // Feixe cresce em espessura até a borda grossa do curso e cai de golpe na ponta desfiada.
      const rampa = 0.42 + 0.5 * entre(0.03, Math.max(0.15, beira - 0.05), v);
      const quedaBorda = entre(beira, beira - 0.075, v);
      const sobCima = entre(0, 0.12, v);
      h = (0.08 + (rampa * domoFeixe * (0.26 + 0.74 * quedaBorda) - 0.08) * (0.28 + 0.72 * sobCima)) + altPeca + (fibra - 0.5) * 0.22 + (estriaFina - 0.5) * 0.1;
      // Em v = 0, a sombra sob a beira da fiada de cima emenda suavemente com a sombra em v = 1.
      if (v < 0.14) t = tSombra + (t - tSombra) * entre(0, 0.14, v);
    }

    o.t = t;
    o.m = fb(x, y, 4, 4, s + 7, per) + 0.14 * v + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Tabuinhas de madeira: fiadas de 25 cm com tábuas curtas desencontradas de largura e ponta variadas,
   * frestas fundas entre peças, degrau firme sob cada fiada e veio na direção da queda.
   */
  tabuinhas: (x, y, s, o, per) => {
    const rh = 0.25;
    const jRaw = Math.floor(y / rh), v = y / rh - jRaw;
    const j = per ? md(jRaw, 8) : jRaw;
    const { k, a, b, xx } = pecaNaFiada(x, j, 9, 0.5, s, per);
    const id = idPeca(k, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.26;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.2;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.09;
    const tilt = (hashDaPeca(id, s + 73) - 0.5) * 0.06 * ((xx - a) / Math.max(1e-4, b - a) - 0.5);

    const dL = xx - a, dR = b - xx, lado = Math.min(dL, dR);
    // Ponta inferior lascada e levemente desigual entre tabuinhas vizinhas, com cantos gastos.
    const lasca = (vr(x, 0, 36, 1, s + md(j, 8) * 19 + (per ? 0 : j * 11), per) - 0.5) * 0.04;
    const pe = 0.91 + (hashDaPeca(id, s + 61) - 0.5) * 0.08 + lasca - 0.07 * (1 - lim(lado / 0.025)) ** 2;
    const veio = fb(x, y, 96, 6, s + 13, per);

    let h: number;
    let t = 0.48 + tomPeca + (veio - 0.5) * 0.32;
    if (v > pe) {
      h = 0.05 + 0.05 * ((v - pe) / Math.max(1e-4, 1 - pe));
      t = 0.1;
    } else {
      const rampa = 0.42 + 0.5 * (v / pe);
      const bordaLat = bisel(lado, 0.006, 0.012);
      const bordaInf = entre(pe, pe - 0.055, v);
      const sobCima = 0.3 + 0.7 * entre(0, 0.12, v);
      h = (0.06 + (rampa - 0.06) * bordaLat * bordaInf) * sobCima + altPeca + tilt + (veio - 0.5) * 0.09;
      if (dL < 0.011 || dR < 0.006) t = 0.09;
      if (v < 0.14) t -= 0.25 * (1 - v / 0.14);
    }

    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) + 0.12 * v + manchaPeca + (lado < 0.018 ? 0.1 : 0);
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Lajes de pedra: placas grossas e irregulares, beira torta, cantos quebrados, juntas fundas e
   * sombra pesada sob cada fiada.
   */
  'lajes-telhado': (x, y, s, o, per) => {
    const rh = 0.4;
    const jRaw = Math.floor(y / rh), v = y / rh - jRaw;
    const j = per ? md(jRaw, 5) : jRaw;
    const { k, a, b, xx } = pecaNaFiada(x, j, 4, 0.45, s, per);
    const id = idPeca(k, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.26;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.2;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.1;

    const lado = Math.min(xx - a, b - xx);
    const pe = 0.82 + 0.11 * vr(x, 0, 20, 1, s + md(j, 5) * 13 + (per ? 0 : j * 11), per) + (hashDaPeca(id, s + 61) - 0.5) * 0.05 - 0.14 * (1 - lim(lado / 0.065)) ** 2;
    const pedra = fb(x, y, 24, 24, s + 3, per);

    let h: number;
    let t = 0.5 + tomPeca + (pedra - 0.5) * 0.28 + 0.07 * entre(0.18, 0, lado);
    if (v > pe) {
      h = 0.04 + 0.06 * ((v - pe) / Math.max(1e-4, 1 - pe));
      t = 0.07 + 0.07 * (v - pe);
    } else {
      const rampa = 0.54 + 0.38 * (v / pe);
      const bordaLat = bisel(lado, 0.009, 0.036);
      const bordaInf = entre(pe, pe - 0.085, v);
      const sobCima = 0.26 + 0.74 * entre(0, 0.14, v);
      h = (0.06 + (rampa - 0.06) * bordaLat * bordaInf) * sobCima + altPeca + (pedra - 0.5) * 0.08;
      if (lado < 0.011) t = 0.1;
      if (v < 0.17) t -= 0.28 * (1 - v / 0.17);
    }

    o.t = t;
    o.m = fb(x, y, 6, 6, s + 7, per) * 0.7 + fb(x, y, 40, 40, s + 8, per) * 0.22 + 0.24 * (1 - lim(lado / 0.06)) + 0.15 * entre(pe - 0.15, pe, v) + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Zinco ondulado: ondas senoidais pronunciadas na queda, chapas de 1 × 1 m sobrepostas nos vales,
   * pregos em relevo nas cristas e ferrugem escorrendo pelos vales.
   */
  ondulado: (x, y, s, o, per) => {
    const onda = P / 24;
    const iRaw = Math.floor(x), jRaw = Math.floor(y + 0.5);
    const i = per ? md(iRaw, 2) : iRaw, j = per ? md(jRaw, 2) : jRaw;
    const id = idPeca(i, j);
    const v = fr(y + 0.5), ux = fr(x);
    // Fase deslocada para que a emenda lateral de 1 m caia exatamente num vale (sin = -1) e a crista em k + 0,5.
    const fase = (x / onda) * Math.PI * 2 - Math.PI / 2;
    const sen = Math.sin(fase);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;      // ±8%
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.22;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.04;

    const grao = fb(x, y, 8, 8, s + 3, per);
    // Onda forte em altura (0,16 no vale até 0,84 na crista) com leve inclinação de sobreposição entre chapas.
    let h = 0.48 + 0.35 * sen + 0.07 * v + altPeca + (grao - 0.5) * 0.025;
    let t = 0.5 + 0.24 * sen + tomPeca + (grao - 0.5) * 0.11;

    // Emenda horizontal entre chapas (degrau de sobreposição).
    if (v > 0.965) {
      const f = (v - 0.965) / 0.035;
      h = h * (1 - 0.72 * f);
      t = 0.16;
    } else if (v < 0.022) {
      h += 0.04 * (1 - v / 0.022);
      t = 0.84;
    }
    // Emenda lateral escondida no vale da chapa (a cada 1 m = 12 ondas inteiras).
    if (ux < 0.01 || ux > 0.99) {
      h -= 0.06;
      t -= 0.09;
    }
    // Pregos/parafusos nas cristas (k + 0,5) logo abaixo da emenda horizontal.
    const cx = (Math.round((x / onda - 0.5) / 4) * 4 + 0.5) * onda, cy = jRaw - 0.45;
    const dPrego = Math.hypot(x - cx, y - cy);
    if (dPrego < 0.015) {
      const bPrego = Math.sqrt(Math.max(0, 1 - (dPrego / 0.015) ** 2));
      h += 0.14 * bPrego;
      t = Math.max(t, 0.82 + 0.14 * bPrego);
    }

    o.t = t;
    o.m = fb(x, y, 6, 6, s + 7, per) * 0.74 + 0.2 * entre(0.6, 1, v) + 0.16 * vr(x, y, 48, 2, s + 9, per) + 0.08 * (1 - sen) * 0.5 + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Cobre de junta em pé: chapas verticais de 40 cm, nervuras salientes em relevo forte, emendas
   * transversais desencontradas em dobra e azinhavre escorrendo das juntas.
   */
  cobre: (x, y, s, o, per) => {
    const pan = 0.4;
    const iRaw = Math.floor(x / pan), u = x / pan - iRaw;
    const off = md(iRaw, 2) * 0.5;
    const jRaw = Math.floor(y + off), v = fr(y + off);
    const i = per ? md(iRaw, 5) : iRaw, j = per ? md(jRaw, 2) : jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;      // ±8%
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.2;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.04;

    const grao = fb(x, y, 10, 10, s + 3, per);
    // Chapa quase plana com leve rampa até a emenda inferior e nervura trapezoidal alta exatamente na junta (u = 0 / 1).
    const duJunta = Math.min(u, 1 - u);
    const nervura = 1 - entre(0.018, 0.056, duJunta);
    let h = 0.36 + 0.1 * v + 0.03 * Math.sin(Math.PI * u) + 0.52 * nervura + altPeca + (grao - 0.5) * 0.02;
    let t = 0.5 + tomPeca + (grao - 0.5) * 0.11;

    // Crista metálica da junta em pé e vincos escuros simétricos dos dois lados (funciona sob qualquer sol).
    if (duJunta < 0.022) t = 0.78;
    else if (duJunta < 0.048) t = 0.24;

    // Emenda horizontal dobrada (dobra saliente sobre o degrau da chapa de baixo).
    if (v > 0.98) {
      h = Math.min(h, 0.18);
      t = 0.22;
    } else if (v < 0.014) {
      h = Math.min(h, 0.24);
      t = 0.26;
    } else if (v < 0.04) {
      h += 0.22 * (1 - (v - 0.014) / 0.026);
      t = Math.max(t, 0.68);
    }

    o.t = t;
    o.m = fb(x, y, 4, 4, s + 7, per) * 0.44 + fb(x, y, 48, 3, s + 9, per) * 0.38 + fb(x, y, 32, 32, s + 8, per) * 0.14 + 0.24 * (1 - entre(0.04, 0.28, duJunta)) + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Laje de concreto: placas de 1 × 1 m com juntas de dilatação chanfradas e fundas,
   * ligeiro desnível por placa, textura mineral granulada e manchas de umidade.
   */
  'concreto-laje': (x, y, s, o, per) => {
    const ladoPlaca = 1;
    const iRaw = Math.floor(x / ladoPlaca), jRaw = Math.floor(y / ladoPlaca);
    const i = per ? md(iRaw, 2) : iRaw, j = per ? md(jRaw, 2) : jRaw;
    const lx = x - iRaw * ladoPlaca, ly = y - jRaw * ladoPlaca;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;      // ±8%
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.18;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.06;

    const d = Math.min(lx, ladoPlaca - lx, ly, ladoPlaca - ly);
    const macro = fb(x, y, 10, 10, s + 3, per);
    const micro = fb(x, y, 32, 32, s + 13, per);
    const umidade = fb(x, y, 3, 3, s + 5, per);
    const gx = per ? md(Math.floor(x * 60), 120) : Math.floor(x * 60);
    const gy = per ? md(Math.floor(y * 60), 120) : Math.floor(y * 60);
    const poro = h2(gx, gy, s);

    const plat = bisel(d, 0.011, 0.022);
    const h = 0.07 + (0.58 + altPeca + (macro - 0.5) * 0.09 + (micro - 0.5) * 0.06 + (poro - 0.5) * 0.035) * plat;

    let t = 0.52 + tomPeca + (macro - 0.5) * 0.24 + (poro - 0.5) * 0.08;
    t -= 0.16 * entre(0.55, 0.8, umidade);
    if (d < 0.012) t = 0.19;
    else if (d < 0.025) t -= 0.06;

    o.t = t;
    o.m = fb(x, y, 4, 4, s + 7, per) + manchaPeca + (d < 0.04 ? 0.1 : 0);
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Telhado verde: leivas de grama de 0,5 × 0,5 m desencontradas e orgânicas, tufos densos com volume
   * acentuado e costuras macias sob a vegetação.
   */
  'grama-telhado': (x, y, s, o, per) => {
    const rw = 0.5, rh = 0.5;
    // Deformação orgânica suave nas bordas das leivas para não parecer bloco retangular.
    const wx = x + (vr(x, y, 6, 6, s + 21, per) - 0.5) * 0.08;
    const wy = y + (vr(x, y, 6, 6, s + 27, per) - 0.5) * 0.08;
    const jRaw = Math.floor(wy / rh), v = wy / rh - jRaw;
    const off = md(jRaw, 2) * (rw / 2);
    const iRaw = Math.floor((wx - off) / rw), u = (wx - off) / rw - iRaw;
    const i = per ? md(iRaw, 4) : iRaw, j = per ? md(jRaw, 4) : jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;      // ±8%
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.18;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.06;

    const tufo = fb(x, y, 20, 20, s + 3, per);
    const fino = fb(x, y, 52, 52, s + 11, per);
    const fx = per ? md(Math.floor(x * 32), 64) : Math.floor(x * 32);
    const fy = per ? md(Math.floor(y * 32), 64) : Math.floor(y * 32);
    const folha = h2(fx, fy, s);

    const du = Math.min(u, 1 - u) * rw, dv = Math.min(v, 1 - v) * rh;
    const leiva = 0.84 + 0.16 * entre(0, 0.055, Math.min(du, dv));
    const h = (0.24 + 0.44 * tufo + 0.24 * fino + (folha - 0.5) * 0.12) * leiva + altPeca - (v > 0.93 ? 0.12 * entre(0.93, 1, v) : 0);

    let t = 0.46 + tomPeca + (tufo - 0.5) * 0.72 + (folha - 0.5) * 0.38;
    if (v > 0.94) t -= 0.12;

    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) + manchaPeca + (1 - leiva) * 0.35;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Lona: painéis de 1 × 1 m costurados, barriga macia em catenária entre costuras tensas,
   * nervura dobrada na emenda, dobras suaves de tecido, pespontos e trama fina.
   */
  lona: (x, y, s, o, per) => {
    const pw = 1, ph = 1;
    const iRaw = Math.floor(x / pw), jRaw = Math.floor(y / ph);
    const i = per ? md(iRaw, 2) : iRaw, j = per ? md(jRaw, 2) : jRaw;
    const u = x / pw - iRaw, v = y / ph - jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;      // ±8%
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.18;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.04;

    const tx = per ? md(Math.floor(x * 100), 200) : Math.floor(x * 100);
    const ty = per ? md(Math.floor(y * 100), 200) : Math.floor(y * 100);
    const trama = h2(tx, ty, s);
    const dobra = fb(x, y, 4, 8, s + 13, per, 2);

    // Costura tensa nas bordas (u = 0 e u = 1) e barriga suave caída no meio do painel com leve folga.
    const catenaria = 0.32 + 0.42 * (0.5 + 0.5 * Math.cos(Math.PI * 2 * u));
    const folga = (dobra - 0.5) * 0.14 * Math.sin(Math.PI * u);
    const du = Math.min(u, 1 - u);
    let h = catenaria + folga + altPeca + (trama - 0.5) * 0.025;
    let t = 0.52 + tomPeca + 0.11 * Math.cos(Math.PI * 2 * u) + (trama - 0.5) * 0.08;

    // Bainha dobrada saliente e sulco nítido da costura longitudinal.
    if (du < 0.011) {
      h = 0.36;
      t = 0.27;
    } else if (du < 0.038) {
      h += 0.13 * (1 - (du - 0.011) / 0.027);
      if (fr(y * 12.5) < 0.5) { h -= 0.05; t = 0.38; }
    }
    // Emenda transversal sobreposta a cada 1 m.
    if (v > 0.976) {
      h -= 0.18 * ((v - 0.976) / 0.024);
      t -= 0.14;
    } else if (v < 0.02) {
      h += 0.09 * (1 - v / 0.02);
      t += 0.06;
    }

    o.t = t;
    o.m = fb(x, y, 4, 4, s + 7, per) + 0.12 * vr(x, y, 2, 8, s + 9, per) + 0.1 * Math.sin(Math.PI * u) + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Tábuas na queda com mata-junta: tábuas compridas correndo na direção da queda (+v) com veio forte,
   * nós ocasionais e emendas horizontais, e ripas de mata-junta salientes com bisel cobrindo as frestas.
   */
  'tabuas-telhado': (x, y, s, o, per) => {
    const bw = 0.2, bl = 1.0;
    const iRaw = Math.floor(x / bw), u = x / bw - iRaw;
    const i = per ? md(iRaw, 10) : iRaw;
    const du = Math.min(u, 1 - u) * bw;
    const meiaRipa = 0.022;
    const naRipa = du < meiaRipa;

    const iJuntaRaw = Math.round(x / bw);
    const iJunta = per ? md(iJuntaRaw, 10) : iJuntaRaw;
    const off = (naRipa ? h2(iJunta, 1, s + 47) : h2(i, 0, s + 41)) * bl;
    const jRaw = Math.floor((y + off) / bl), v = (y + off) / bl - jRaw;
    const j = per ? md(jRaw, 2) : jRaw;
    const id = idPeca(naRipa ? iJunta : i, j, naRipa ? 1 : 0);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.24;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.22;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.06;
    const tilt = (hashDaPeca(id, s + 73) - 0.5) * 0.05 * (u - 0.5);

    // Nós ocasionais alongados no sentido da fibra (~35% das tábuas).
    let noFator = 0;
    let warpNo = 0;
    if (!naRipa && hashDaPeca(id, s + 83) < 0.36) {
      const nu = 0.3 + hashDaPeca(id, s + 89) * 0.4;
      const nv = 0.2 + hashDaPeca(id, s + 97) * 0.6;
      const dnx = (u - nu) * bw / 0.018;
      const dny = (v - nv) * bl / 0.052;
      const rn = Math.hypot(dnx, dny);
      if (rn < 2.2) {
        warpNo = (1 - rn / 2.2) * 0.04 * (dnx >= 0 ? 1 : -1);
        if (rn < 1.15) noFator = 1 - entre(0.35, 1.15, rn);
      }
    }

    const veio = fb(x + warpNo, y, 88, 5, s + 13, per, 3);
    const fibra = vr(x + warpNo, y, 176, 8, s + 19, per);
    const manchaMad = fb(x, y, 6, 3, s + 7, per);

    let h: number;
    let t = 0.52 + tomPeca * 1.15 + (veio - 0.5) * 0.4 + (fibra - 0.5) * 0.14;

    if (naRipa) {
      // Ripa de mata-junta saliente cobrindo a emenda entre duas tábuas, com bisel nítido nas laterais.
      const bordaRipa = entre(meiaRipa, meiaRipa - 0.008, du);
      const coroa = Math.cos((du / meiaRipa) * Math.PI * 0.45);
      h = 0.24 + (0.64 + 0.08 * coroa) * bordaRipa + altPeca * 0.7 + (veio - 0.5) * 0.06;
      t += 0.07 * coroa - 0.14 * (1 - bordaRipa);
      // Emenda transversal discreta da ripa.
      const dvM = Math.min(v, 1 - v) * bl;
      if (dvM < 0.005) {
        h = Math.min(h, 0.34);
        t -= 0.2;
      }
    } else {
      // Tábua principal: sulco escuro encostado ao mata-junta, face plana com veio forte e emenda de topo sutil.
      const dFresta = du - meiaRipa;
      const juntaLat = bisel(dFresta, 0.004, 0.01);
      const dv = Math.min(v, 1 - v) * bl;
      const emendaTopo = bisel(dv, 0.003, 0.008);
      h = (0.09 + (0.43 + 0.04 * v + altPeca + tilt) * juntaLat * (0.45 + 0.55 * emendaTopo)) + (veio - 0.5) * 0.085 - 0.1 * noFator;
      if (dFresta < 0.009) t = 0.09 + (dFresta / 0.009) * 0.08;
      else if (dFresta < 0.02) t -= 0.14 * (1 - (dFresta - 0.009) / 0.011);
      if (dv < 0.005) t -= 0.28;
      else if (v < 0.018) t -= 0.08 * (1 - v / 0.018);
      if (noFator > 0) t -= 0.28 * noFator;
      // Dois pregos discretos perto da emenda superior da tábua.
      for (const pu of [0.3, 0.7]) {
        const dp = Math.hypot((u - pu) * bw, (v - 0.035) * bl);
        if (dp < 0.006) {
          h -= 0.05 * (1 - dp / 0.006);
          t -= 0.28;
        }
      }
    }

    o.t = t;
    o.m = manchaMad * 0.68 + fb(x, y, 32, 6, s + 23, per) * 0.22 + (naRipa ? -0.06 : 0.18 * (1 - entre(0, 0.032, du - meiaRipa))) + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Telha francesa (Marselha): placas cerâmicas prensadas em colunas alinhadas, com encaixe lateral em canal,
   * moldura espessa, painel central rebaixado com losango em relevo e degrau acentuado entre fiadas.
   */
  'telha-francesa': (x, y, s, o, per) => {
    const cw = 0.25, rh = 0.4;
    const iRaw = Math.floor(x / cw), jRaw = Math.floor(y / rh);
    const i = per ? md(iRaw, 8) : iRaw, j = per ? md(jRaw, 5) : jRaw;
    const u = x / cw - iRaw, v = y / rh - jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.18;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.2;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.05;
    const rTroca = hashDaPeca(id, s + 53);
    const troca = rTroca < 0.011 ? -0.22 : rTroca > 0.989 ? 0.22 : 0;

    const grao = fb(x, y, 20, 20, s + 3, per);
    const ponta = 0.925;
    let h: number;
    let t = 0.5 + tomPeca + troca + (grao - 0.5) * 0.1;

    if (v > ponta) {
      const f = (v - ponta) / (1 - ponta);
      h = 0.06 + 0.06 * f;
      t = 0.1 + 0.07 * f;
    } else {
      const rampa = 0.78 + 0.22 * (v / ponta);
      const lip = entre(ponta, ponta - 0.05, v);
      const sobCima = 0.45 + 0.55 * entre(0, 0.08, v);

      // Perfil transversal: sulco de encaixe à esquerda, nervura esquerda, miolo com losango e nervura direita.
      let perfil = 0.44;
      if (u < 0.13) {
        // Canal lateral de encaixe.
        const duC = Math.abs(u - 0.065) / 0.065;
        perfil = 0.22 + 0.12 * duC * duC;
        t -= 0.14 * (1 - duC * duC);
      } else if (u < 0.25) {
        // Nervura lateral esquerda saliente.
        const nr = Math.sin(((u - 0.13) / 0.12) * Math.PI);
        perfil = 0.52 + 0.34 * nr;
        t += 0.08 * nr;
      } else if (u > 0.85) {
        // Borda direita com nervura de sobreposição e fresta fina na junta.
        if (u > 0.96) {
          perfil = 0.12;
          t = 0.14;
        } else {
          const nr = Math.sin(((u - 0.85) / 0.11) * Math.PI);
          perfil = 0.52 + 0.3 * nr;
          t += 0.07 * nr;
        }
      } else {
        // Painel central prensado com losango (diamante) característico da telha Marselha.
        const dLos = Math.abs((u - 0.55) / 0.22) + Math.abs((v - 0.48) / 0.28);
        const dentroLos = 1 - entre(0.86, 1.04, dLos);
        const cristaLos = 1 - entre(0.28, 0.86, dLos);
        const sulcoVert = Math.exp(-(((u - 0.55) / 0.045) ** 2)) * (v > 0.75 || v < 0.2 ? 0.18 : 0);
        // Moldura horizontal espessa na base (v ∈ [0.8, 0.92]).
        const abaInf = entre(0.78, 0.85, v);
        perfil = 0.42 + 0.32 * dentroLos + 0.14 * cristaLos + 0.36 * abaInf - sulcoVert;
        t += 0.11 * dentroLos + 0.06 * cristaLos + 0.07 * abaInf - 0.09 * sulcoVert;
        // Pequeno rebaixo em moldura ao redor do losango.
        if (dLos >= 0.95 && dLos < 1.18) {
          perfil -= 0.08;
          t -= 0.09;
        }
      }

      h = perfil * rampa * (0.36 + 0.64 * lip) * sobCima + altPeca + (grao - 0.5) * 0.025;
      if (ponta - v < 0.035) t -= 0.12;
      if (v < 0.11) t -= 0.24 * (1 - v / 0.11);
    }

    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) * 0.7 + (u < 0.15 ? 0.16 : 0) + 0.12 * v + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Telha esmaltada oriental: canais largos em meia-cana separados por capas cilíndricas altas e estreitas
   * com ponteiras arredondadas no beiral de cada fiada e brilho forte de cerâmica vitrificada.
   */
  'telha-esmaltada': (x, y, s, o, per) => {
    const cw = 0.25, rh = 0.25;
    const iRaw = Math.floor(x / cw), jRaw = Math.floor(y / rh);
    const i = per ? md(iRaw, 8) : iRaw, j = per ? md(jRaw, 8) : jRaw;
    const u = x / cw - iRaw, v = y / rh - jRaw;
    const capa = u >= 0.62;
    const uc = capa ? (u - 0.62) / 0.38 : u / 0.62;
    const id = idPeca(i, j, capa ? 1 : 0);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.12;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.14;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.035;

    const dx = 2 * uc - 1;
    const bojo = Math.sin(Math.PI * uc);
    const esmalte = fb(x, y, 12, 12, s + 3, per, 2);

    let h: number;
    let t: number;
    if (capa) {
      // Capa cilíndrica alta com ponteira circular (wadang) marcada no pé da peça.
      const ponta = 0.85 + 0.1 * bojo;
      if (v > ponta) {
        const f = (v - ponta) / Math.max(1e-4, 1 - ponta);
        h = 0.08 + 0.08 * f;
        t = 0.11 + 0.06 * f;
      } else {
        const arco = Math.sqrt(Math.max(0, 1 - 0.94 * dx * dx));
        const anel = Math.exp(-(((v - (ponta - 0.09)) / 0.07) ** 2));
        const lip = entre(ponta, ponta - 0.06, v);
        const encaixe = 0.78 + 0.22 * entre(0, 0.1, v);
        h = (0.29 + 0.59 * arco + 0.13 * anel * arco) * (0.86 + 0.14 * (v / ponta)) * (0.4 + 0.6 * lip) * encaixe + altPeca;
        // Forte brilho especular vitrificado correndo pela crista da capa e no anel da ponteira.
        const brilho = (bojo ** 5) * 0.36 + anel * bojo * 0.2;
        t = 0.44 + 0.14 * bojo + brilho + tomPeca + (esmalte - 0.5) * 0.05;
        if (v < 0.11) t -= 0.2 * (1 - v / 0.11);
        if (Math.abs(v - (ponta - 0.17)) < 0.025) t -= 0.1;
      }
    } else {
      // Canal largo e suave em meia-cana côncava com leve brilho vitrificado no fundo.
      const ponta = 0.91;
      if (v > ponta) {
        h = 0.07;
        t = 0.12;
      } else {
        const lip = entre(ponta, ponta - 0.05, v);
        const concavo = dx * dx;
        h = (0.14 + 0.22 * concavo) * (0.86 + 0.14 * (v / ponta)) * (0.5 + 0.5 * lip) + altPeca * 0.4;
        const brilhoCanal = Math.exp(-(((uc - 0.38) / 0.16) ** 2)) * 0.15;
        t = 0.34 + 0.16 * concavo + brilhoCanal + tomPeca * 0.7 + (esmalte - 0.5) * 0.05;
        if (v < 0.12) t -= 0.18 * (1 - v / 0.12);
      }
    }

    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) * 0.6 + (capa ? -0.1 : 0.12) + 0.1 * v + manchaPeca;
    o.h = lim(h + (esmalte - 0.5) * 0.012);
    o.id = id;
  },

  /**
   * Chapa metálica com junta em pé (standing seam): painéis largos planos de 50 cm com duas micro-nervuras
   * de reforço, juntas em pé altas e nítidas, emendas horizontais desencontradas com rebites e ferrugem sutil.
   */
  'chapa-com-junta': (x, y, s, o, per) => {
    const pan = 0.5, rh = 1.0;
    const iRaw = Math.floor(x / pan), u = x / pan - iRaw;
    const off = md(iRaw, 2) * 0.5 + 0.25;
    const jRaw = Math.floor((y + off) / rh), v = (y + off) / rh - jRaw;
    const i = per ? md(iRaw, 4) : iRaw, j = per ? md(jRaw, 2) : jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.14;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.22;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.035;

    const laminado = fb(x, y, 36, 4, s + 3, per, 2);
    const du = Math.min(u, 1 - u) * pan;

    // Junta em pé alta e estreita nas bordas da chapa + duas micro-nervuras de rigidez no meio do painel.
    const juntaPe = 1 - entre(0.011, 0.025, du);
    const sulcoJunta = entre(0.022, 0.031, du) * (1 - entre(0.031, 0.044, du));
    const vinco1 = Math.exp(-(((u - 0.34) / 0.02) ** 2));
    const vinco2 = Math.exp(-(((u - 0.66) / 0.02) ** 2));
    const microVincos = vinco1 + vinco2;

    let h = 0.34 + 0.07 * v + 0.58 * juntaPe - 0.07 * sulcoJunta + 0.1 * microVincos + altPeca + (laminado - 0.5) * 0.015;
    let t = 0.5 + tomPeca + (laminado - 0.5) * 0.09 + 0.08 * microVincos - 0.1 * sulcoJunta;

    if (du < 0.012) t = 0.84;
    else if (du < 0.026) t = 0.25;

    // Emenda transversal sobreposta (vinco escuro simétrico em v = 0/1 e dobra clara logo abaixo).
    if (v > 0.976) {
      h = Math.min(h, 0.17);
      t = 0.2;
    } else if (v < 0.014) {
      h = Math.min(h, 0.22);
      t = 0.24;
    } else if (v < 0.042) {
      h += 0.16 * (1 - (v - 0.014) / 0.028);
      t = Math.max(t, 0.7);
    }

    // Rebites salientes ao longo da emenda horizontal e perto da base.
    let pertoRebite = 0;
    for (const ru of [0.2, 0.5, 0.8]) {
      const dr = Math.hypot((u - ru) * pan, (v - 0.055) * rh);
      if (dr < 0.014) {
        const calota = Math.sqrt(Math.max(0, 1 - (dr / 0.014) ** 2));
        h += 0.17 * calota;
        t = Math.max(t, 0.78 + 0.14 * calota);
        pertoRebite = 1;
      } else if (dr < 0.032) {
        pertoRebite = Math.max(pertoRebite, 1 - (dr - 0.014) / 0.018);
      }
    }

    const escorrido = fb(x, y, 48, 3, s + 9, per, 2);
    o.t = t;
    o.m = fb(x, y, 6, 6, s + 7, per) * 0.42 + escorrido * 0.28 + 0.34 * (1 - entre(0.015, 0.09, du)) + 0.22 * (1 - entre(0, 0.12, v)) + 0.24 * pertoRebite + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Fibrocimento: chapas grandes de 1 × 1 m com onda larga e funda (10 ondas em 2 m, 2,4× mais larga que zinco),
   * textura mineral fosca, parafusos com arruela nas cristas e musgo/sujeira acumulados nos vales.
   */
  fibrocimento: (x, y, s, o, per) => {
    const onda = P / 10; // 0,20 m por onda (5 ondas inteiras por chapa de 1 m)
    const iRaw = Math.floor(x), jRaw = Math.floor(y + 0.5);
    const i = per ? md(iRaw, 2) : iRaw, j = per ? md(jRaw, 2) : jRaw;
    const id = idPeca(i, j);
    const ux = x - iRaw, v = y + 0.5 - jRaw;

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.16;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.24;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.04;

    // Fase alinhada para que a emenda lateral da chapa (1 m) caia exatamente num vale (sin = -1).
    const fase = (x / onda) * Math.PI * 2 - Math.PI / 2;
    const sen = Math.sin(fase);
    const ondaCheia = sen * (1 - 0.1 * sen * sen);

    const mineral = fb(x, y, 16, 16, s + 3, per, 3);
    const poro = vr(x, y, 64, 64, s + 19, per);

    let h = 0.49 + 0.41 * ondaCheia + 0.06 * v + altPeca + (mineral - 0.5) * 0.04 + (poro - 0.5) * 0.025;
    let t = 0.5 + 0.19 * sen + tomPeca + (mineral - 0.5) * 0.22 + (poro - 0.5) * 0.08;

    // Sobreposição horizontal espessa de chapa mineral (~8 mm reais).
    if (v > 0.945) {
      const f = (v - 0.945) / 0.055;
      h = h * (1 - 0.78 * f);
      t = 0.14 + 0.08 * (1 - f);
    } else if (v < 0.026) {
      h += 0.05 * (1 - v / 0.026);
      t += 0.08 * (1 - v / 0.026);
    }
    // Emenda lateral discreta no vale.
    if (ux < 0.014 || ux > 0.986) {
      h -= 0.08;
      t -= 0.12;
    }

    // Parafusos com arruela de vedação nas cristas das ondas (duas linhas por chapa).
    const kCrista = Math.round((x / onda - 0.5) / 2) * 2 + 0.5;
    const cx = kCrista * onda;
    for (const ry of [0.09, 0.55]) {
      const cy = jRaw - 0.5 + ry;
      const dp = Math.hypot(x - cx, y - cy);
      if (dp < 0.022) {
        const arruela = entre(0.022, 0.012, dp);
        h += 0.12 * arruela;
        t = dp < 0.009 ? 0.82 : 0.24;
      }
    }

    const depressao = (1 - sen) * 0.5;
    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) * 0.55 + fb(x, y, 28, 4, s + 9, per) * 0.2 + 0.34 * depressao + 0.16 * entre(0.55, 1, v) + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Bambu: meias-canas alternadas (côncavas por baixo, convexas por cima) correndo na queda,
   * com nós transversais (internódios) salientes em anel e variação natural entre verde-oliva e palha seca.
   */
  bambu: (x, y, s, o, per) => {
    const cw = 0.2, rh = 0.4;
    const iRaw = Math.floor(x / cw), u = x / cw - iRaw;
    const i = per ? md(iRaw, 10) : iRaw;
    const capa = u >= 0.44;
    const uc = capa ? (u - 0.44) / 0.56 : u / 0.44;
    const sub = capa ? 1 : 0;

    // Cada cana tem seus nós desencontrados em v.
    const off = h2(i, sub, s + 41) * rh;
    const jRaw = Math.floor((y + off) / rh), v = (y + off) / rh - jRaw;
    const j = per ? md(jRaw, 5) : jRaw;
    const id = idPeca(i, j, sub);
    const idCana = idPeca(i, 0, sub);

    // Cor principal vem da vara inteira de bambu + nuance sutil por gomo.
    const tomCana = (hashDaPeca(idCana, s + 17) - 0.5) * 0.22;
    const tomGomo = (hashDaPeca(id, s + 19) - 0.5) * 0.08;
    const manchaCana = (hashDaPeca(idCana, s + 29) - 0.5) * 0.46;
    const altCana = (hashDaPeca(idCana, s + 71) - 0.5) * 0.05;

    const dx = 2 * uc - 1;
    const fibra = fb(x, y, 128, 4, s + 13, per, 2);
    const dvNo = Math.min(v, 1 - v);

    // Anel transversal saliente do nó (diafragma) com vinco escuro fino no meio.
    const sulcoNo = 1 - entre(0.008, 0.022, dvNo);
    const calomboNo = entre(0.012, 0.034, dvNo) * (1 - entre(0.042, 0.082, dvNo));
    const bojoGomo = 1 - 0.05 * Math.sin(Math.PI * v);

    let h: number;
    let t: number;
    if (capa) {
      const arco = Math.sqrt(Math.max(0, 1 - 0.93 * dx * dx));
      const bordaLat = entre(0, 0.08, Math.min(uc, 1 - uc));
      h = (0.3 + 0.56 * arco * bojoGomo) * (0.72 + 0.28 * bordaLat) + 0.14 * calomboNo * arco - 0.18 * sulcoNo + altCana;
      t = 0.5 + 0.14 * Math.sin(Math.PI * uc) + tomCana + tomGomo + (fibra - 0.5) * 0.16 + 0.12 * calomboNo - 0.28 * sulcoNo;
      if (bordaLat < 0.4) t -= 0.18 * (1 - bordaLat / 0.4);
    } else {
      const concavo = dx * dx;
      h = (0.1 + 0.24 * concavo * bojoGomo) + 0.09 * calomboNo - 0.08 * sulcoNo + altCana * 0.4;
      t = 0.28 + 0.12 * concavo + tomCana * 0.8 + tomGomo + (fibra - 0.5) * 0.14 + 0.08 * calomboNo - 0.2 * sulcoNo;
    }

    o.t = t;
    o.m = 0.48 + manchaCana + (fb(x, y, 6, 4, s + 7, per) - 0.5) * 0.34 + (capa ? 0.04 : 0.1) - 0.15 * calomboNo;
    o.h = lim(h + (fibra - 0.5) * 0.025);
    o.id = id;
  },

  /**
   * Couro costurado (tendas e iurtas): peles curtidas em painéis orgânicos desencontrados,
   * tensão irregular, poros/rugas naturais e costuras grossas aparentes com pontos em X.
   */
  'couro-telhado': (x, y, s, o, per) => {
    const pw = P / 3, ph = 0.5;
    // Deformação suave periódica em 2 m para que o recorte das peles seja orgânico, não uma grade rígida.
    const wx = x + (vr(x, y, 4, 4, s + 21, per) - 0.5) * 0.09;
    const wy = y + (vr(x, y, 4, 4, s + 27, per) - 0.5) * 0.07;

    const jRaw = Math.floor(wy / ph), v = wy / ph - jRaw;
    const off = md(jRaw, 2) * (pw * 0.5);
    const iRaw = Math.floor((wx - off) / pw), u = (wx - off) / pw - iRaw;
    const i = per ? md(iRaw, 3) : iRaw, j = per ? md(jRaw, 4) : jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.24;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.26;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.06;

    const du = Math.min(u, 1 - u) * pw;
    const dv = Math.min(v, 1 - v) * ph;
    const dBorda = Math.min(du, dv);

    const ruga = fb(x, y, 10, 10, s + 3, per, 3);
    const poro = fb(x, y, 44, 44, s + 11, per, 2);
    const tensao = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);

    let h = 0.4 + 0.22 * tensao + (ruga - 0.5) * 0.14 + (poro - 0.5) * 0.04 + altPeca;
    let t = 0.5 + tomPeca + (ruga - 0.5) * 0.22 + (poro - 0.5) * 0.1 + 0.07 * tensao;

    // Costura grossa aparente entre peles: vinco escuro + aba sobreposta + pontos em X de cordão.
    if (dBorda < 0.046) {
      const sulco = 1 - entre(0.005, 0.012, dBorda);
      const aba = entre(0.01, 0.02, dBorda) * (1 - entre(0.032, 0.046, dBorda));
      h = h * (1 - 0.72 * sulco) + 0.08 * aba;
      t -= 0.34 * sulco + 0.08 * aba;

      // Pontos em X correndo paralelamente à costura (passo de 5 cm = 40 pontos em 2 m).
      const coord = du < dv ? wy : wx;
      const pL = fr(coord / 0.05);
      const pN = (dBorda - 0.005) / 0.036;
      if (pN >= 0 && pN <= 1) {
        const dX = Math.min(Math.abs(pL - pN), Math.abs(1 - pL - pN));
        const ponto = 1 - entre(0.11, 0.22, dX);
        if (ponto > 0) {
          h += 0.28 * ponto;
          t = t * (1 - ponto) + 0.8 * ponto;
        }
        // Furos escuros da sovela nas extremidades dos pontos.
        if (pN > 0.78 && (pL < 0.18 || pL > 0.82)) {
          h -= 0.12;
          t = 0.12;
        }
      }
    }

    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) * 0.6 + 0.28 * (1 - entre(0.01, 0.12, dBorda)) + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },

  /**
   * Chumbo de catedral: placas pesadas de ~67 cm separadas por rolos cilíndricos grossos (batten rolls),
   * emendas transversais em degrau desencontradas, superfície martelada suave e pátina esbranquiçada.
   */
  chumbo: (x, y, s, o, per) => {
    const pan = P / 3, rh = 1.0;
    const iRaw = Math.floor(x / pan), u = x / pan - iRaw;
    const i = per ? md(iRaw, 3) : iRaw;
    const off = h2(i, 0, s + 41) * 0.65;
    const jRaw = Math.floor((y + off) / rh), v = (y + off) / rh - jRaw;
    const j = per ? md(jRaw, 2) : jRaw;
    const id = idPeca(i, j);

    const tomPeca = (hashDaPeca(id, s + 17) - 0.5) * 0.14;
    const manchaPeca = (hashDaPeca(id, s + 29) - 0.5) * 0.22;
    const altPeca = (hashDaPeca(id, s + 71) - 0.5) * 0.04;

    const martelado = fb(x, y, 7, 7, s + 3, per, 3);
    const fino = fb(x, y, 24, 24, s + 11, per, 2);
    const du = Math.min(u, 1 - u) * pan;
    const rRolo = 0.042;

    let h: number;
    let t = 0.48 + tomPeca + (martelado - 0.5) * 0.16 + (fino - 0.5) * 0.06;

    if (du < rRolo) {
      // Rolo de junta cilíndrico cheio (batten roll) sobre o sarrafo de madeira.
      const q = du / rRolo;
      const arco = Math.sqrt(Math.max(0, 1 - 0.94 * q * q));
      h = 0.32 + 0.62 * arco + altPeca * 0.5 + (fino - 0.5) * 0.02;
      t += 0.24 * arco - 0.12 * q * q;
    } else {
      // Chapa pesada de chumbo com vinco fundo ao pé do rolo e superfície levemente martelada.
      const dPe = du - rRolo;
      const vinco = 1 - entre(0.004, 0.022, dPe);
      h = 0.38 + 0.08 * v - 0.22 * vinco + (martelado - 0.5) * 0.07 + altPeca;
      t -= 0.26 * vinco;
    }

    // Emenda horizontal em degrau (drip step joint) pesada.
    if (v > 0.955) {
      const f = (v - 0.955) / 0.045;
      h = h * (1 - 0.68 * f);
      t -= 0.3 * f;
    } else if (v < 0.032) {
      const f = 1 - v / 0.032;
      h += 0.13 * f;
      t += 0.12 * f;
    }

    // Pátina esbranquiçada / carbonato de chumbo escorrendo dos rolos e dos degraus.
    const escorrido = fb(x, y, 32, 3, s + 9, per, 2);
    o.t = t;
    o.m = fb(x, y, 5, 5, s + 7, per) * 0.44 + escorrido * 0.3 + 0.26 * (1 - entre(0.02, 0.14, du)) + 0.16 * (1 - entre(0, 0.18, v)) + manchaPeca;
    o.h = lim(h);
    o.id = id;
  },
};

function padraoDe(m: Material): PadraoDeCobertura {
  const padrao = m.padrao as string;
  if (!ehPadraoDeCobertura(padrao)) throw new Error(`O material “${m.id}” não é uma cobertura de telhado.`);
  return padrao;
}

/** Devolve o estilo de capa de cumeeira/espigão recomendado para a cobertura ou padrão. */
export function capaDaCobertura(m: Material | PadraoDeCobertura): CapaDeCumeeira {
  return CAPA_DA_COBERTURA[typeof m === 'string' ? m : padraoDe(m)];
}

/** O tom, a mancha, a altura miúda e o id da peça num ponto (periódico a cada `PERIODO_DA_COBERTURA` m). */
export function amostrarPonto(m: Material, x: number, y: number, semente = 1): AmostraDeCobertura {
  const o: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  AMOSTRADORES[padraoDe(m)](fr(x / P) * P, fr(y / P) * P, md(Math.floor(semente), 5) * 101 + 7, o, true);
  return o;
}

/**
 * Amostra contínua em `(u, v)` em metros, sem repetição periódica de 2 m (para assado por edifício).
 * Aceita `saida` reutilizável para evitar alocações em laços por pixel.
 */
export function amostrarPontoContinuo(
  m: Material,
  u: number,
  v: number,
  semente = 1,
  saida: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 },
): AmostraDeCobertura {
  AMOSTRADORES[padraoDe(m)](u, v, Math.floor(semente) * 101 + 7, saida, false);
  return saida;
}

/** Devolve um amostrador contínuo vinculado ao material e à semente (sem busca de mapa por pixel). */
export function amostradorContinuo(m: Material, semente = 1): AmostradorDeCobertura {
  const fn = AMOSTRADORES[padraoDe(m)], s = Math.floor(semente) * 101 + 7;
  return (u, v, saida) => fn(u, v, s, saida, false);
}

const rgb = (hex: string): [number, number, number] => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const mix = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

/** Converte `(t, mancha)` de uma amostra na cor RGB (0–255) do material de cobertura. */
export function corDaAmostra(
  m: Material,
  t: number,
  mancha: number,
  saida: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  const E = rgb(m.escuro), B = rgb(m.base), C = rgb(m.claro), q = m.mancha?.quanto ?? 0, M = m.mancha ? rgb(m.mancha.cor) : B;
  const media = lim(t), peso = q > 0 ? entre(1 - q - 0.12, 1 - q + 0.12, mancha) : 0;
  const base = media < 0.5 ? mix(E, B, media * 2) : mix(B, C, (media - 0.5) * 2);
  const cor = peso > 0 ? mix(base, mix(mix(M, [0, 0, 0], 0.45), mix(M, [255, 255, 255], 0.12), media), peso * 0.92) : base;
  saida[0] = cor[0]!; saida[1] = cor[1]!; saida[2] = cor[2]!;
  return saida;
}

export type EstiloDaCobertura = 'illustrated' | 'pixel';
/** Um ladrilho pronto, em RGBA: `lado × lado` pixels que valem `metros` metros em cada eixo. */
export interface LadrilhoDeCobertura { lado: number; metros: number; dados: Uint8ClampedArray }

/**
 * O ladrilho periódico de uma cobertura, puro (sem canvas), usado em miniaturas e no Pixel.
 * Ilustrado: `RES_DA_COBERTURA` px/m, 2×2 amostras por pixel e cores contínuas.
 * Pixel: `res` px/m (o do mapa), cinco tons do material e a mancha em dois tons, decididos por pixel, sem mistura.
 */
export function amostrarCobertura(m: Material, estilo: EstiloDaCobertura, semente = 1, res = RES_DA_COBERTURA): LadrilhoDeCobertura {
  const amostrar = AMOSTRADORES[padraoDe(m)], s = md(Math.floor(semente), 5) * 101 + 7, pixel = estilo === 'pixel';
  const lado = Math.max(8, Math.round(P * (pixel ? res : RES_DA_COBERTURA))), passo = P / lado, sub = pixel ? 3 : 2;
  const E = rgb(m.escuro), B = rgb(m.base), C = rgb(m.claro), q = m.mancha?.quanto ?? 0, M = m.mancha ? rgb(m.mancha.cor) : B;
  const tons = pixel ? [E, mix(B, E, 0.5), B, mix(B, C, 0.5), C] : [];
  const manchaPx = pixel ? [mix(M, [0, 0, 0], 0.35), M] : [];
  const dados = new Uint8ClampedArray(lado * lado * 4), o: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  for (let py = 0; py < lado; py++) for (let px = 0; px < lado; px++) {
    let soma = 0, menor = 1, somaM = 0;
    for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
      amostrar((px + (sx + 0.5) / sub) * passo, (py + (sy + 0.5) / sub) * passo, s, o, true);
      const t = lim(o.t); soma += t; somaM += o.m; if (t < menor) menor = t;
    }
    const n = sub * sub, media = soma / n, mm = somaM / n, peso = q > 0 ? entre(1 - q - 0.12, 1 - q + 0.12, mm) : 0;
    let cor: readonly number[];
    if (pixel) {
      // A linha fina (junta, beira) puxa o pixel para baixo: o Pixel mantém as fiadas legíveis mesmo menores que um pixel.
      const t = media * 0.6 + menor * 0.4;
      cor = peso > 0.5 ? manchaPx[t < 0.42 ? 0 : 1]! : tons[Math.min(4, Math.floor(t * 5))]!;
    } else {
      const base = media < 0.5 ? mix(E, B, media * 2) : mix(B, C, (media - 0.5) * 2);
      cor = peso > 0 ? mix(base, mix(mix(M, [0, 0, 0], 0.45), mix(M, [255, 255, 255], 0.12), media), peso * 0.92) : base;
    }
    const k = (py * lado + px) * 4;
    dados[k] = cor[0]!; dados[k + 1] = cor[1]!; dados[k + 2] = cor[2]!; dados[k + 3] = 255;
  }
  return { lado, metros: P, dados };
}

const telas = new Map<string, { tela: Tela; metros: number }>();
/** O ladrilho da cobertura numa tela (em cache por material, estilo, semente e resolução), pronto para virar padrão ou textura. */
export function texturaDeCobertura(m: Material, estilo: EstiloDaCobertura, semente = 1, res = RES_DA_COBERTURA): { tela: Tela; metros: number } {
  const chave = `${m.id}|${estilo}|${md(Math.floor(semente), 5)}|${estilo === 'pixel' ? res.toFixed(3) : ''}`;
  let t = telas.get(chave);
  if (!t) {
    const l = amostrarCobertura(m, estilo, semente, res), tela = criarTela(l.lado, l.lado), ctx = contextoDe(tela), img = ctx.createImageData(l.lado, l.lado);
    img.data.set(l.dados); ctx.putImageData(img, 0, 0);
    t = { tela, metros: l.metros }; telas.set(chave, t);
  }
  return t;
}
