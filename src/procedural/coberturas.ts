import { contextoDe, criarTela, type Tela } from './canvas.ts';
import type { Material } from './materiais.ts';
import { hash2D } from './ruido.ts';

/**
 * Coberturas de telhado: cada uma é uma função pura e periódica que diz, para um ponto do ladrilho (em metros), o **tom**
 * (0 = escuro, 0,5 = base, 1 = claro) e a vontade de **mancha** (musgo, ferrugem, azinhavre). A queda d'água aponta para +y:
 * as fiadas correm em x e a de cima cobre a de baixo. O Ilustrado amostra em alta resolução e mistura as cores; o Pixel
 * amostra na grade dele e quantiza em cinco tons, sem gradiente. O mesmo desenho serve aos dois.
 */

export const PADROES_DE_COBERTURA = ['telha-canal', 'escamas', 'ardosia', 'palha', 'tabuinhas', 'lajes-telhado', 'ondulado', 'cobre', 'concreto-laje', 'grama-telhado', 'lona'] as const;
export type PadraoDeCobertura = (typeof PADROES_DE_COBERTURA)[number];
export const ehPadraoDeCobertura = (p: string): p is PadraoDeCobertura => (PADROES_DE_COBERTURA as readonly string[]).includes(p);

/** Lado do ladrilho em metros: todo padrão repete um número inteiro de vezes nele, então o ladrilho emenda nos dois eixos. */
export const PERIODO_DA_COBERTURA = 2;
/** Resolução do ladrilho no Ilustrado (px/m). */
export const RES_DA_COBERTURA = 80;

interface Amostra { t: number; m: number }
type Amostrador = (x: number, y: number, s: number, o: Amostra) => void;

const P = PERIODO_DA_COBERTURA;
const md = (i: number, n: number) => ((i % n) + n) % n;
const fr = (v: number) => v - Math.floor(v);
const lim = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const liso = (t: number) => t * t * (3 - 2 * t);
const entre = (a: number, b: number, x: number) => liso(lim((x - a) / (b - a)));
const h2 = (i: number, j: number, s: number) => hash2D(i, j, s);

/** Ruído de valor periódico: `nx` células no período em x e `ny` em y. */
function vr(x: number, y: number, nx: number, ny: number, s: number): number {
  const u = (x / P) * nx, v = (y / P) * ny, xi = Math.floor(u), yi = Math.floor(v), a = liso(u - xi), b = liso(v - yi);
  const g = (i: number, j: number) => h2(md(i, nx), md(j, ny), s);
  return (g(xi, yi) * (1 - a) + g(xi + 1, yi) * a) * (1 - b) + (g(xi, yi + 1) * (1 - a) + g(xi + 1, yi + 1) * a) * b;
}
/** Três oitavas de `vr`, cada uma com o dobro de células (continua periódico). */
function fb(x: number, y: number, nx: number, ny: number, s: number, oitavas = 3): number {
  let soma = 0, amp = 1, total = 0;
  for (let k = 0; k < oitavas; k++) { soma += amp * vr(x, y, nx << k, ny << k, s + k * 31); total += amp; amp *= 0.5; }
  return soma / total;
}

/** Fronteiras de `n` peças numa fiada (de 0 a `P`), com tamanhos tremidos e a fiada inteira deslocada: devolve o índice e as bordas da peça em `x`. */
function pecaNaFiada(x: number, j: number, n: number, tremor: number, s: number): { k: number; a: number; b: number } {
  const desl = h2(j, 0, s + 41) * P, xx = fr((x - desl) / P) * P, w = P / n;
  const borda = (k: number) => (k <= 0 ? 0 : k >= n ? P : k * w + (h2(k, j, s + 43) - 0.5) * tremor * w);
  let k = Math.min(n - 1, Math.floor(xx / w));
  while (k > 0 && xx < borda(k)) k--;
  while (k < n - 1 && xx >= borda(k + 1)) k++;
  return { k, a: borda(k), b: borda(k + 1) };
}

const AMOSTRADORES: Record<PadraoDeCobertura, Amostrador> = {
  /** Telha canal: capas convexas e canais côncavos em colunas, com a ponta arredondada de cada capa sombreando a fiada de baixo. */
  'telha-canal': (x, y, s, o) => {
    const cw = 0.25, rh = 0.4, i = Math.floor(x / cw), j = Math.floor(y / rh), u = x / cw - i, v = y / rh - j;
    const capa = u >= 0.3, uc = capa ? (u - 0.3) / 0.7 : u / 0.3, bojo = Math.sin(Math.PI * uc);
    const ponta = capa ? 0.82 + 0.13 * bojo : 0.86 + 0.05 * bojo, varia = (h2(md(i, 8), md(j, 5), s) - 0.5) * 0.18;
    let t: number;
    if (v > ponta) t = 0.08 + 0.1 * (v - ponta) / (1 - ponta);
    else if (capa) t = 0.5 + 0.27 * Math.cos(Math.PI * uc) + 0.1 * bojo + varia - (ponta - v < 0.035 ? 0.14 : 0);
    else t = 0.27 + 0.1 * bojo + varia * 0.6;
    if (v < 0.12) t -= 0.22 * (1 - v / 0.12);
    o.t = t + (fb(x, y, 16, 16, s + 3) - 0.5) * 0.14;
    o.m = fb(x, y, 4, 4, s + 7) * 0.72 + fb(x, y, 40, 40, s + 8) * 0.28 + (capa ? -0.04 : 0.08) + 0.12 * v;
  },
  /** Escamas de ardósia: fiadas desencontradas de escamas com a ponta redonda; a fiada de cima cobre o alto da de baixo. */
  escamas: (x, y, s, o) => {
    const sw = 0.25, rh = 0.2, r = sw / 2;
    const escama = (j: number) => {
      const off = md(j, 2) * r, i = Math.floor((x - off) / sw), cx = off + i * sw + r, dx = (x - cx) / r;
      const fundo = j * rh + rh * 0.55 + rh * 0.9 * Math.sqrt(Math.max(0, 1 - dx * dx));
      return { i, dx, fundo };
    };
    const j0 = Math.floor(y / rh), cima = escama(j0 - 1);
    const dentroDeCima = y <= cima.fundo, e = dentroDeCima ? cima : escama(j0), j = dentroDeCima ? j0 - 1 : j0, vb = e.fundo - y;
    let t = 0.5 + (h2(md(e.i, 8), md(j, 10), s) - 0.5) * 0.28 - e.dx * 0.12 + 0.08 * entre(0, 0.1, vb);
    if (vb < 0.016) t = 0.14;
    if (!dentroDeCima && y - cima.fundo < 0.035) t -= 0.26 * (1 - (y - cima.fundo) / 0.035);
    o.t = t + (fb(x, y, 20, 20, s + 3) - 0.5) * 0.1;
    o.m = fb(x, y, 5, 5, s + 7);
  },
  /** Ardósia: placas retangulares desencontradas de tom variado, juntas finas e a beira de cada fiada marcada. */
  ardosia: (x, y, s, o) => {
    const w = 0.25, rh = 0.2, j = Math.floor(y / rh), v = y / rh - j, off = md(j, 2) * (w / 2), i = Math.floor((x - off) / w), u = (x - off) / w - i;
    let t = 0.5 + (h2(md(i, 8), md(j, 10), s) - 0.5) * 0.34 + (fb(x, y, 24, 24, s + 3) - 0.5) * 0.12 + (u < 0.12 ? 0.05 : 0);
    if (u < 0.04 || u > 0.975) t = 0.13;
    if (v > 0.92) t = 0.1;
    if (v < 0.16) t -= 0.2 * (1 - v / 0.16);
    o.t = t; o.m = fb(x, y, 5, 5, s + 7);
  },
  /** Palha: fibras na direção da queda, em cursos de 0,5 m com a beira desfiada e funda. */
  palha: (x, y, s, o) => {
    const rh = 0.5, j = Math.floor(y / rh), v = y / rh - j, fibra = fb(x, y, 64, 4, s, 3), beira = 0.8 + 0.14 * vr(x, 0, 48, 1, s + md(j, 4) * 17);
    let t = 0.33 + 0.42 * fibra + (h2(md(Math.floor(x / 0.02), 100), md(j, 4), s + 5) - 0.5) * 0.22;
    if (v > beira) t = 0.1 + 0.12 * fibra;
    if (v < 0.1) t -= 0.16 * (1 - v / 0.1);
    o.t = t; o.m = fb(x, y, 4, 4, s + 7) + 0.12 * v;
  },
  /** Tabuinhas de madeira: fiadas de 25 cm com tábuas curtas de largura variada, veio na queda e frestas escuras. */
  tabuinhas: (x, y, s, o) => {
    const rh = 0.25, j = md(Math.floor(y / rh), 8), v = y / rh - Math.floor(y / rh), { k, a, b } = pecaNaFiada(x, j, 9, 0.5, s);
    const xx = fr((x - h2(j, 0, s + 41) * P) / P) * P;
    let t = 0.47 + (h2(k, j, s + 11) - 0.5) * 0.28 + (fb(x, y, 96, 6, s + 13) - 0.5) * 0.34;
    if (xx - a < 0.014 || b - xx < 0.006) t = 0.1;
    if (v > 0.93) t = 0.12;
    if (v < 0.14) t -= 0.24 * (1 - v / 0.14);
    o.t = t; o.m = fb(x, y, 5, 5, s + 7) + 0.1 * v;
  },
  /** Lajes de pedra: placas grossas e irregulares, de beira torta e cantos gastos, com sombra funda sob cada fiada. */
  'lajes-telhado': (x, y, s, o) => {
    const rh = 0.4, j = md(Math.floor(y / rh), 5), v = y / rh - Math.floor(y / rh), { k, a, b } = pecaNaFiada(x, j, 4, 0.45, s);
    const xx = fr((x - h2(j, 0, s + 41) * P) / P) * P, lado = Math.min(xx - a, b - xx);
    const pe = 0.76 + 0.14 * vr(x, 0, 20, 1, s + j * 13) - 0.18 * (1 - lim(lado / 0.07)) ** 2;
    let t = 0.5 + (h2(k, j, s + 11) - 0.5) * 0.3 + (fb(x, y, 24, 24, s + 3) - 0.5) * 0.32 + 0.08 * entre(0.2, 0, lado);
    if (v > pe) t = 0.07 + 0.08 * (v - pe);
    if (lado < 0.012 && v <= pe) t = 0.1;
    if (v < 0.18) t -= 0.3 * (1 - v / 0.18);
    o.t = t; o.m = fb(x, y, 6, 6, s + 7) * 0.75 + fb(x, y, 40, 40, s + 8) * 0.25 + 0.25 * (1 - lim(lado / 0.06)) + 0.15 * entre(pe - 0.15, pe, v);
  },
  /** Zinco ondulado: ondas na queda, chapas de 1 m sobrepostas (as emendas a 0,5 m da borda do ladrilho) com a aba clara, pregos nas cristas e ferrugem escorrendo. */
  ondulado: (x, y, s, o) => {
    const onda = P / 24, v = fr(y + 0.5), fase = (x / onda) * Math.PI * 2;
    let t = 0.5 + 0.32 * Math.sin(fase) + (fb(x, y, 8, 8, s + 3) - 0.5) * 0.12;
    if (v > 0.975) t = 0.16; else if (v < 0.02) t = 0.86;
    const cx = (Math.round((x / onda - 0.25) / 4) * 4 + 0.25) * onda, cy = Math.floor(y + 0.5) - 0.45;
    if (Math.hypot(x - cx, y - cy) < 0.013) t = 0.92;
    o.t = t; o.m = fb(x, y, 6, 6, s + 7) * 0.8 + 0.22 * entre(0.6, 1, v) + 0.18 * vr(x, y, 48, 2, s + 9);
  },
  /** Cobre de junta em pé: chapas verticais de 40 cm, juntas salientes, emendas desencontradas e azinhavre escorrendo das juntas. */
  cobre: (x, y, s, o) => {
    const pan = 0.4, i = Math.floor(x / pan), u = x / pan - i, off = md(i, 2) * 0.5, v = fr(y + off);
    let t = 0.5 + (h2(md(i, 5), md(Math.floor(y + off), 2), s) - 0.5) * 0.14 + (fb(x, y, 10, 10, s + 3) - 0.5) * 0.12;
    if (u < 0.04) t = 0.86; else if (u < 0.08) t = 0.2;
    if (v < 0.012) t = 0.24; else if (v < 0.025) t = 0.72;
    // O azinhavre nasce nas juntas e escorre na queda: listras finas em x e compridas em y, mais forte logo depois da junta.
    o.t = t; o.m = fb(x, y, 4, 4, s + 7) * 0.45 + fb(x, y, 48, 3, s + 9) * 0.4 + fb(x, y, 32, 32, s + 8) * 0.15 + 0.2 * (1 - entre(0.08, 0.5, u));
  },
  /** Laje de concreto: liso manchado, juntas de dilatação a cada 2 m e manchas de umidade. */
  'concreto-laje': (x, y, s, o) => {
    let t = 0.52 + (fb(x, y, 10, 10, s + 3) - 0.5) * 0.28 + (h2(md(Math.floor(x * 60), 120), md(Math.floor(y * 60), 120), s) - 0.5) * 0.08;
    t -= 0.16 * entre(0.55, 0.8, fb(x, y, 3, 3, s + 5));
    if (x < 0.014 || y < 0.014) t = 0.24;
    o.t = t; o.m = fb(x, y, 4, 4, s + 7);
  },
  /** Telhado verde: grama densa em tufos, com leivas em faixas de 0,5 m e terra aparecendo. */
  'grama-telhado': (x, y, s, o) => {
    let t = 0.46 + (fb(x, y, 20, 20, s + 3) - 0.5) * 0.8 + (h2(md(Math.floor(x * 32), 64), md(Math.floor(y * 32), 64), s) - 0.5) * 0.45;
    if (fr(y / 0.5) > 0.95) t -= 0.14;
    o.t = t; o.m = fb(x, y, 5, 5, s + 7);
  },
  /** Lona: painéis de 1 m costurados, caídos entre as costuras, com trama fina e sujeira. */
  lona: (x, y, s, o) => {
    const u = fr(x);
    let t = 0.52 + 0.12 * Math.cos(Math.PI * 2 * u) + (h2(md(Math.floor(x * 100), 200), md(Math.floor(y * 100), 200), s) - 0.5) * 0.08;
    if (u < 0.012 || u > 0.988) t = 0.28; else if ((u < 0.03 || u > 0.97) && fr(y * 12.5) < 0.5) t = 0.38;
    o.t = t; o.m = fb(x, y, 4, 4, s + 7) + 0.12 * vr(x, y, 2, 8, s + 9);
  },
};

/** O tom e a mancha da cobertura num ponto (em metros, qualquer ponto: o desenho repete a cada `PERIODO_DA_COBERTURA`). */
export function amostrarPonto(m: Material, x: number, y: number, semente = 1): { t: number; m: number } {
  const padrao = m.padrao as string;
  if (!ehPadraoDeCobertura(padrao)) throw new Error(`O material “${m.id}” não é uma cobertura de telhado.`);
  const o: Amostra = { t: 0, m: 0 };
  AMOSTRADORES[padrao](fr(x / P) * P, fr(y / P) * P, md(Math.floor(semente), 5) * 101 + 7, o);
  return o;
}

const rgb = (hex: string): [number, number, number] => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const mix = (a: readonly number[], b: readonly number[], t: number): [number, number, number] => [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];

export type EstiloDaCobertura = 'illustrated' | 'pixel';
/** Um ladrilho pronto, em RGBA: `lado × lado` pixels que valem `metros` metros em cada eixo. */
export interface LadrilhoDeCobertura { lado: number; metros: number; dados: Uint8ClampedArray }

/**
 * O ladrilho de uma cobertura, puro (sem canvas). Ilustrado: `RES_DA_COBERTURA` px/m, 2×2 amostras por pixel e cores contínuas.
 * Pixel: `res` px/m (o do mapa), cinco tons do material e a mancha em dois tons, decididos por pixel, sem mistura.
 */
export function amostrarCobertura(m: Material, estilo: EstiloDaCobertura, semente = 1, res = RES_DA_COBERTURA): LadrilhoDeCobertura {
  const padrao = m.padrao as string;
  if (!ehPadraoDeCobertura(padrao)) throw new Error(`O material “${m.id}” não é uma cobertura de telhado.`);
  const amostrar = AMOSTRADORES[padrao], s = md(Math.floor(semente), 5) * 101 + 7, pixel = estilo === 'pixel';
  const lado = Math.max(8, Math.round(P * (pixel ? res : RES_DA_COBERTURA))), passo = P / lado, sub = pixel ? 3 : 2;
  const E = rgb(m.escuro), B = rgb(m.base), C = rgb(m.claro), q = m.mancha?.quanto ?? 0, M = m.mancha ? rgb(m.mancha.cor) : B;
  const tons = pixel ? [E, mix(B, E, 0.5), B, mix(B, C, 0.5), C] : [];
  const manchaPx = pixel ? [mix(M, [0, 0, 0], 0.35), M] : [];
  const dados = new Uint8ClampedArray(lado * lado * 4), o: Amostra = { t: 0, m: 0 };
  for (let py = 0; py < lado; py++) for (let px = 0; px < lado; px++) {
    let soma = 0, menor = 1, somaM = 0;
    for (let sy = 0; sy < sub; sy++) for (let sx = 0; sx < sub; sx++) {
      amostrar((px + (sx + 0.5) / sub) * passo, (py + (sy + 0.5) / sub) * passo, s, o);
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
