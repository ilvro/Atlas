import { elipse, poli, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { bolha, lente, LUZ_X, LUZ_Y, sombraNoChao, tira } from '../organico.ts';
import { num, piso, type Receita } from './comum.ts';

// Carimbos de chão (Frente P, P7): o que dá ao chão de mata a variedade desenhada que a textura sozinha não dá a 32 px/m.
// Traço das copas: nanquim por baixo, poucos tons chapados, luz a noroeste, z baixo. Nenhum bloqueia (o espalhar já os põe livres).

const CHAO = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim'], kit: 'mata' };
const NANQUIM = '#14100c';
const O = { contorno: false as const, semSombra: true };

/** Polilinha curva de `n` pontos de (x, y) na direção `ang`, entortando `curva` (rad no total) e com um tremor `tremor` (m). */
function curva(r: () => number, x: number, y: number, ang: number, len: number, curv: number, n = 6, tremor = 0): number[] {
  const pts: number[] = [];
  let a = ang, px = x, py = y;
  pts.push(px, py);
  for (let i = 1; i < n; i++) { a += curv / (n - 1) + (r() - 0.5) * tremor; px += Math.cos(a) * (len / (n - 1)); py += Math.sin(a) * (len / (n - 1)); pts.push(px, py); }
  return pts;
}

/** Fita que afina da base (`w0`) à ponta (`w1`) ao longo de `pts`; `e` > 1 segura a largura e afina só no fim. */
function afilada(pts: readonly number[], w0: number, w1: number, mat: string, z: number, extra: Partial<Parte> = {}, e = 1): Parte {
  const n = pts.length / 2, esq: number[] = [], dir: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = pts[b * 2]! - pts[a * 2]!, dy = pts[b * 2 + 1]! - pts[a * 2 + 1]!, l = Math.hypot(dx, dy) || 1;
    const w = (w1 + (w0 - w1) * (1 - Math.pow(i / Math.max(1, n - 1), e))) / 2;
    esq.push(pts[i * 2]! - (dy / l) * w, pts[i * 2 + 1]! + (dx / l) * w); dir.push(pts[i * 2]! + (dy / l) * w, pts[i * 2 + 1]! - (dx / l) * w);
  }
  const volta: number[] = []; for (let i = n - 1; i >= 0; i--) volta.push(dir[i * 2]!, dir[i * 2 + 1]!);
  return poli([...esq, ...volta], mat, z, extra);
}

/** Desloca uma polilinha `d` metros para o lado da luz (noroeste). */
const paraALuz = (pts: readonly number[], d: number): number[] => pts.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * d);

/**
 * Tronco caído: casca cinza-parda com estrias ao comprido, o lado da luz claro e o do sudeste escuro, um nó, tocos de galho, musgo por
 * cima, uma ponta lascada (madeira clara em farpas) e a outra afinando para a copa perdida.
 */
function troncoCaido(seed: number, L: number): Parte[] {
  const r = mulberry32(seed), D = 0.46, partes: Parte[] = [], casca = r() < 0.5 ? '#5c5246' : '#544a3e', escuro = tom(casca, -0.5), claro = tom(casca, 0.3);
  const bend = (r() - 0.5) * 0.25, eixo: number[] = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; eixo.push(-L / 2 + t * L, Math.sin(t * Math.PI) * bend * L * 0.12); }
  const wIni = D, wFim = D * 0.62, yDo = (t: number) => Math.sin(t * Math.PI) * bend * L * 0.12, wDo = (t: number) => wIni + (wFim - wIni) * t;
  /** O eixo deslocado `v` (−1 a 1, fração da meia-largura) para o lado. */
  const faixa = (v: number) => eixo.map((c, i) => (i % 2 ? c + v * wDo(Math.floor(i / 2) / 12) / 2 : c));
  sombraNoChao(partes, afilada(eixo, wIni * 1.15, wFim * 1.15, '#000', 0).pts!, 0.05, '#0d0a08', 0.6, [0.07, 0.09]);
  // Corpo: nanquim, a casca chapada e o cilindro em faixas (borda do sudeste bem escura, a do noroeste um pouco, uma faixa clara perto dela).
  partes.push(afilada(eixo, wIni + 0.04, wFim + 0.04, NANQUIM, 0.38, { ...O, detalhe: 1 }));
  partes.push(afilada(eixo, wIni, wFim, casca, 0.4, { ...O, suave: true, detalhe: 1 }));
  partes.push(afilada(faixa(0.62), wIni * 0.38, wFim * 0.38, escuro, 0.41, { ...O, suave: true, alfa: 0.8, detalhe: 2 }));
  partes.push(afilada(faixa(-0.78), wIni * 0.2, wFim * 0.2, escuro, 0.41, { ...O, suave: true, alfa: 0.45, detalhe: 2 }));
  partes.push(afilada(faixa(-0.36), wIni * 0.22, wFim * 0.18, claro, 0.411, { ...O, suave: true, alfa: 0.55, detalhe: 2 }));
  // Estrias da casca: muitos fios escuros ao comprido, ondulando, e alguns claros (as cristas da casca).
  const nEstrias = Math.round(L * 24);
  for (let k = 0; k < nEstrias; k++) {
    const t0 = r() * 0.9, t1 = Math.min(1, t0 + 0.06 + r() * 0.25), v = (r() * 2 - 1) * 0.85, clara = r() < 0.3, pts: number[] = [];
    for (let j = 0; j <= 5; j++) { const t = t0 + (t1 - t0) * (j / 5); pts.push(-L / 2 + t * L, yDo(t) + v * wDo(t) / 2 + Math.sin(j * 1.7 + k) * 0.006); }
    const lado = v > 0.3 ? -0.2 : v < -0.3 ? 0.15 : 0;
    partes.push(tira(pts, clara ? 0.009 : 0.012 + r() * 0.008, clara ? tom(claro, 0.12 + lado) : tom(escuro, -0.25), 0.42, { ...O, alfa: clara ? 0.55 : 0.8, detalhe: 3 }, 0.3));
  }
  // Cortes de galho na casca: um anel de madeira clara rente ao tronco, com o cerne escuro.
  for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
    const t = 0.25 + r() * 0.6, x = -L / 2 + t * L, y = yDo(t) + (r() - 0.5) * wDo(t) * 0.4, d = wDo(t) * (0.22 + r() * 0.12);
    partes.push(elipse(x, y, d * 1.1, d, NANQUIM, 0.432, { ...O, detalhe: 2 }), elipse(x - 0.006, y - 0.006, d * 0.95, d * 0.85, '#8c7656', 0.433, { ...O, suave: true, detalhe: 2 }), elipse(x, y, d * 0.4, d * 0.35, '#5e4c38', 0.434, { ...O, detalhe: 3 }));
  }
  // Nó escuro.
  { const t = 0.3 + r() * 0.4, x = -L / 2 + t * L, y = yDo(t) + (r() - 0.5) * D * 0.3; partes.push(elipse(x, y, 0.1, 0.065, NANQUIM, 0.43, { ...O, alfa: 0.8, detalhe: 2 }), elipse(x - 0.012, y - 0.01, 0.055, 0.03, tom(casca, -0.15), 0.431, { ...O, detalhe: 3 })); }
  // Musgo: tufinhos verdes escuros em grupos, no lado da luz e na casca de cima.
  for (let k = 0; k < 2 + Math.floor(r() * 3); k++) {
    const t = 0.1 + r() * 0.75, cx = -L / 2 + t * L, cy = yDo(t) - wDo(t) * (0.05 + r() * 0.3), n = 5 + Math.floor(r() * 6);
    for (let j = 0; j < n; j++) partes.push(poli(bolha(cx + (r() - 0.5) * 0.28, cy + (r() - 0.5) * 0.1, 0.025 + r() * 0.04, 0.02 + r() * 0.03, 7, 0.35, r), r() < 0.5 ? '#3c5226' : '#4e6a30', 0.44, { ...O, suave: true, alfa: 0.8, detalhe: 3 }));
  }
  // A ponta lascada (início do eixo): o tronco partido, com duas ou três lascas compridas e desiguais e o resto quebrado rente.
  const x0 = -L / 2, y0 = eixo[1]!, borda: number[] = [], nB = 12, saida = new Array<number>(nB + 1).fill(0);
  for (let k = 0; k < 3 + Math.floor(r() * 3); k++) { const c = 1 + Math.floor(r() * (nB - 2)), comp = 0.06 + r() * 0.24, larg = Math.floor(r() * 2); for (let j = -larg; j <= larg; j++) if (c + j >= 0 && c + j <= nB) saida[c + j] = Math.max(saida[c + j]!, comp * (1 - Math.abs(j) / (larg + 1)) * (0.7 + r() * 0.3)); }
  borda.push(x0 + 0.1, y0 + wIni / 2);
  for (let i = nB; i >= 0; i--) borda.push(x0 - saida[i]! + (r() - 0.5) * 0.03, y0 + (-wIni / 2 + (i / nB) * wIni) * 0.97);
  borda.push(x0 + 0.1, y0 - wIni / 2);
  partes.push(poli(borda.map((v, i) => (i % 2 ? v : v - 0.025)), NANQUIM, 0.45, { ...O, detalhe: 2 }), poli(borda, '#9a8462', 0.46, { ...O, suave: true, detalhe: 2 }));
  partes.push(poli(borda.map((v, i) => (i % 2 ? y0 + (v - y0) * 0.55 + 0.03 : x0 + 0.06 + (v - x0) * 0.6)), '#6a5842', 0.47, { ...O, suave: true, alfa: 0.75, detalhe: 3 }));
  partes.push(tira([x0 - 0.06, y0 - 0.01, x0 + 0.05, y0 + 0.015, x0 + 0.14, y0 - 0.005], 0.014, NANQUIM, 0.48, { ...O, detalhe: 3 }, 0.2));
  return partes;
}

/** Raízes que saem de um ponto (a base de uma árvore) e afundam no chão: grossas e alargadas no pé, afinando, com o lado da luz claro e terra por cima das pontas. */
function raizes(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = r() < 0.5 ? '#4a3828' : '#503f30', claro = tom(cor, 0.3), escuro = tom(cor, -0.4), terra = '#3a3024';
  const n = 6 + Math.floor(r() * 3), giro = r() * Math.PI * 2, pontas: [number, number, number, number][] = [], corpo: Parte[] = [], nanquim: Parte[] = [];
  const raiz = (x: number, y: number, a: number, len: number, w: number, nivel: number): void => {
    const pts = curva(r, x, y, a, len, (r() - 0.5) * 1.4, 12, 0.4), wF = w * 0.35;
    nanquim.push(afilada(pts, w + 0.035, wF + 0.03, NANQUIM, 0.18, O));
    corpo.push(afilada(pts, w, wF, cor, 0.2 + nivel * 0.005, { ...O, suave: true, detalhe: nivel ? 2 : 1 }));
    corpo.push(afilada(pts.map((v, i) => v - (i % 2 ? LUZ_Y : LUZ_X) * -w * 0.25), w * 0.4, wF * 0.4, escuro, 0.201 + nivel * 0.005, { ...O, suave: true, alfa: 0.6, detalhe: 2 }));
    corpo.push(afilada(paraALuz(pts, w * 0.22), w * 0.3, wF * 0.3, claro, 0.202 + nivel * 0.005, { ...O, suave: true, alfa: 0.6, detalhe: 2 }));
    pontas.push([pts[pts.length - 2]!, pts[pts.length - 1]!, w, Math.atan2(pts[pts.length - 1]! - pts[pts.length - 3]!, pts[pts.length - 2]! - pts[pts.length - 4]!)]);
    if (nivel >= 1) return;
    for (let k = 0; k < 1 + Math.floor(r() * 2); k++) { const i = 3 + Math.floor(r() * 6), dx = pts[i * 2 + 2]! - pts[i * 2]!, dy = pts[i * 2 + 3]! - pts[i * 2 + 1]!; raiz(pts[i * 2]!, pts[i * 2 + 1]!, Math.atan2(dy, dx) + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), len * (0.3 + r() * 0.25), w * 0.55, 1); }
  };
  for (let i = 0; i < n; i++) raiz(0, 0, giro + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.6, R * (0.65 + r() * 0.45), 0.13 + r() * 0.06, 0);
  // O pé alargado de onde as raízes saem.
  const pe = bolha(0, 0, 0.26, 0.25, 22, 0.1, r);
  nanquim.push(poli(pe.map(v => v * 1.08), NANQUIM, 0.18, O));
  corpo.push(poli(pe, cor, 0.22, { ...O, suave: true, detalhe: 1 }), poli(bolha(-0.1, -0.1, 0.2, 0.08, 10, 0.3, r, -0.8), claro, 0.23, { ...O, suave: true, alfa: 0.35, detalhe: 2 }));
  partes.push(...nanquim, ...corpo);
  // Onde a raiz entra no chão: um véu de terra rala, alongado, por cima do último trecho (ela some em vez de acabar).
  for (const [x, y, w, a] of pontas) partes.push(lente(x - Math.cos(a) * 0.14, y - Math.sin(a) * 0.14, a, 0.24, 0.08 + w * 0.5, terra, 0.25, { ...O, suave: true, alfa: 0.7, detalhe: 3 }));
  return partes;
}

/**
 * Moita de samambaia: frondes arqueadas que saem do centro, cada uma com a nervura e folíolos alternados que diminuem até a ponta; cada
 * fronde tem o próprio nanquim (as de cima recortam as de baixo), e as do lado da luz são mais claras.
 */
function moitaDeSamambaia(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), n = 9 + Math.floor(r() * 4), giro = r() * Math.PI * 2;
  const tons = ['#2f4826', '#3d5a2c', '#4e6c34', '#5e7e3c'], partes: Parte[] = [];
  sombraNoChao(partes, bolha(0.04, 0.05, R * 0.7, R * 0.65, 12, 0.2, r), 0.05, '#0b0d08', 0.35, [0, 0]);
  const frondes = Array.from({ length: n }, (_, i) => ({ a: giro + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5, z: r() })).sort((p, q) => p.z - q.z);
  frondes.forEach(({ a }, idx) => {
    const len = R * (0.5 + r() * 0.5), eixo = curva(r, 0, 0, a, len, (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.8), 12, 0.08), z = 0.3 + idx * 0.004;
    const luz = Math.cos(a) * LUZ_X + Math.sin(a) * LUZ_Y, tomF = tons[Math.max(0, Math.min(3, Math.round(1.5 + luz * 1.3 + (r() - 0.5))))]!;
    const nanquim: Parte[] = [tira(eixo, 0.028, NANQUIM, z, O, 0.3)], cor: Parte[] = [tira(eixo, 0.01, tom(tomF, -0.35), z + 0.002, { ...O, detalhe: 2 }, 0.3)];
    for (let k = 1; k < 11; k++) {
      const t = k / 11, x = eixo[k * 2]!, y = eixo[k * 2 + 1]!, dx = eixo[k * 2 + 2]! - eixo[k * 2 - 2]!, dy = eixo[k * 2 + 3]! - eixo[k * 2 - 1]!, ae = Math.atan2(dy, dx);
      const l = len * 0.3 * (1 - t * 0.72) * (0.85 + r() * 0.3), w = l * 0.5;
      for (const lado of [-1, 1]) {
        const af = ae + lado * (1.3 - t * 0.5) + (r() - 0.5) * 0.25, claro = lado * (Math.cos(af) * LUZ_X + Math.sin(af) * LUZ_Y) > 0;
        nanquim.push(lente(x, y, af, l + 0.018, w + 0.022, NANQUIM, z, O));
        cor.push(lente(x, y, af, l, w, claro ? tom(tomF, 0.1) : tomF, z + 0.001, { ...O, suave: true, detalhe: k > 6 ? 3 : 2 }));
      }
    }
    partes.push(...nanquim, ...cor);
  });
  return partes;
}

/** Tufo de capim alto: lâminas finas e curvas saindo do centro, escuras na base e claras na ponta, com o miolo sombreado. */
function tufoDeCapim(seed: number, R: number, seco: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], n = 34 + Math.floor(r() * 18);
  const verde = ['#2f3a1e', '#47552c', '#62703a', '#7f8a4c'], palha = ['#3e3a24', '#5e5838', '#857c50', '#a49a68'];
  const tons = verde.map((v, i) => (seco > 0 ? mistura(v, palha[i]!, seco) : v));
  partes.push(poli(bolha(0, 0, R * 0.32, R * 0.3, 10, 0.25, r), '#141209', 0.05, { ...O, suave: true, alfa: 0.55, detalhe: 2 }));
  const laminas: { pts: number[]; w: number; c: string; z: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, len = R * (0.5 + r() * 0.5), d0 = r() * R * 0.12;
    const pts = curva(r, Math.cos(a) * d0, Math.sin(a) * d0, a, len, (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.6), 6);
    const luz = Math.cos(a) * LUZ_X + Math.sin(a) * LUZ_Y;
    laminas.push({ pts, w: 0.022 + r() * 0.014, c: tons[Math.max(0, Math.min(3, Math.round(1.6 + luz + (r() - 0.5) * 1.6)))]!, z: 0.1 + r() * 0.15 });
  }
  laminas.sort((p, q) => p.z - q.z);
  for (const l of laminas) {
    partes.push(afilada(l.pts, l.w + 0.016, 0.006, NANQUIM, l.z, { ...O, alfa: 0.75 }));
    partes.push(afilada(l.pts, l.w, 0.002, l.c, l.z + 0.001, { ...O, detalhe: 2 }));
  }
  return partes;
}

const mistura = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  return '#' + [16, 8, 0].map(s => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t).toString(16).padStart(2, '0')).join('');
};

/** Galhada: gravetos secos claros cruzados em todas as direções, com raminhos laterais e a sombra curta de cada um. */
function galhada(seed: number, W: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], n = 8 + Math.floor(r() * 6), base = ['#a49478', '#8e7e64', '#b4a486', '#7c6c56'];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI, len = W * (0.3 + r() * 0.5), cx = (r() - 0.5) * W * 0.55, cy = (r() - 0.5) * W * 0.4;
    const pts = curva(r, cx - Math.cos(a) * len / 2, cy - Math.sin(a) * len / 2, a, len, (r() - 0.5) * 0.5, 6, 0.3), w = 0.02 + r() * 0.025, c = base[Math.floor(r() * 4)]!, z = 0.08 + i * 0.012;
    partes.push(tira(pts.map((v, j) => v + (j % 2 ? 0.03 : 0.022)), w * 1.3, '#0a0806', z - 0.005, { ...O, alfa: 0.45, detalhe: 2 }, 0.6));
    partes.push(tira(pts, w + 0.014, NANQUIM, z, O, 0.6), tira(pts, w, c, z + 0.002, { ...O, suave: true, detalhe: 2 }, 0.6));
    partes.push(tira(paraALuz(pts, w * 0.2), w * 0.35, tom(c, 0.25), z + 0.003, { ...O, alfa: 0.7, detalhe: 3 }, 0.6));
    for (let k = 0; k < Math.floor(r() * 3); k++) {
      const j = 1 + Math.floor(r() * 4), ra = a + (r() < 0.5 ? -1 : 1) * (0.5 + r() * 0.5), rp = curva(r, pts[j * 2]!, pts[j * 2 + 1]!, ra, len * (0.12 + r() * 0.15), (r() - 0.5) * 0.4, 3);
      partes.push(afilada(rp, w * 0.7 + 0.012, 0.008, NANQUIM, z + 0.001, O), afilada(rp, w * 0.7, 0.004, c, z + 0.003, { ...O, suave: true, detalhe: 3 }));
    }
  }
  return partes;
}

/** Folhiço: mancha de folhas secas soltas (ocre, castanho, oliva), sem contorno, mais densa no meio; quebra a textura do chão. */
function folhico(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], tons = ['#6e5434', '#7f6440', '#5c4a30', '#8a7448', '#5e6236', '#75482c', '#9a7a46'];
  partes.push(poli(bolha(0, 0, R * 0.75, R * 0.65, 14, 0.3, r), '#3a2c1c', 0.02, { ...O, suave: true, alfa: 0.18, detalhe: 2 }));
  const n = Math.round(90 * R * R + 30);
  for (let i = 0; i < n; i++) {
    const d = Math.pow(r(), 0.65) * R, a = r() * Math.PI * 2, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85;
    const L = 0.1 + r() * 0.07, w = L * (0.45 + r() * 0.2), ang = r() * Math.PI * 2, c = tons[Math.floor(r() * tons.length)]!, z = 0.03 + i * 0.0002;
    const x0 = x - Math.cos(ang) * L / 2, y0 = y - Math.sin(ang) * L / 2;
    partes.push(lente(x0 + 0.012, y0 + 0.016, ang, L, w, '#0c0906', z, { ...O, alfa: 0.4, detalhe: 3 }));
    partes.push(lente(x0, y0, ang, L, w, c, z + 0.0001, { ...O, suave: true, detalhe: 2 }));
    partes.push(tira([x0 + Math.cos(ang) * L * 0.08, y0 + Math.sin(ang) * L * 0.08, x0 + Math.cos(ang) * L * 0.9, y0 + Math.sin(ang) * L * 0.9], 0.006, tom(c, -0.35), z + 0.0001, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  return partes;
}

/**
 * Brotos: raminhos de 8 a 12 cm (caule escuro e três ou quatro folhinhas arredondadas, com nanquim) espalhados numa mancha. É o verde miúdo
 * que salpica o chão de mata da referência; um carimbo cobre uma mancha inteira para não ter de pôr broto por broto.
 */
function brotos(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), nanquim: Parte[] = [], cor: Parte[] = [], tons = ['#22401c', '#2c4c22', '#365828', '#41642c'];
  const n = Math.round(22 * R * R / 0.36 + 6);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(r()) * R, a0 = r() * Math.PI * 2, x = Math.cos(a0) * d, y = Math.sin(a0) * d, a = r() * Math.PI * 2, len = 0.04 + r() * 0.05;
    const caule = curva(r, x, y, a, len, (r() - 0.5) * 0.8, 4), c = tons[Math.floor(r() * tons.length)]!;
    nanquim.push(tira(caule, 0.016, NANQUIM, 0.06, { ...O, alfa: 0.6 }, 0.5));
    cor.push(tira(caule, 0.008, '#2a2416', 0.062, { ...O, detalhe: 3 }, 0.5));
    const nf = 3 + Math.floor(r() * 2);
    for (let k = 0; k < nf; k++) {
      // As folhinhas saem da ponta e de um nó no meio, abertas em leque.
      const j = k < 2 ? 3 : 1 + Math.floor(r() * 2), px = caule[j * 2]!, py = caule[j * 2 + 1]!, af = a + (k - (nf - 1) / 2) * 1.1 + (r() - 0.5) * 0.4;
      const l = 0.04 + r() * 0.03, w = l * (0.6 + r() * 0.2), luz = Math.cos(af) * LUZ_X + Math.sin(af) * LUZ_Y;
      nanquim.push(lente(px, py, af, l + 0.012, w + 0.012, NANQUIM, 0.06, { ...O, alfa: 0.6 }));
      cor.push(lente(px, py, af, l, w, luz > 0.3 ? tom(c, 0.1) : luz < -0.3 ? tom(c, -0.15) : c, 0.064, { ...O, suave: true, detalhe: 2 }));
    }
  }
  return [...nanquim, ...cor];
}

/**
 * Gravetos soltos: gravetos pálidos de 10 a 20 cm espalhados numa mancha, pintados sem nanquim (só uma sombra macia embaixo e a luz
 * no lado noroeste), como os da referência de mata. Alguns têm um forquilha curta. A `galhada` é o monte; isto é o que sobra pelo chão.
 */
function gravetos(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), sombra: Parte[] = [], cor: Parte[] = [], tons = ['#b3a27f', '#a8946f', '#bfae8a', '#9c8763'];
  const n = Math.round(10 * R * R / 0.36 + 3);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(r()) * R, a0 = r() * Math.PI * 2, x = Math.cos(a0) * d, y = Math.sin(a0) * d, a = r() * Math.PI * 2, len = 0.1 + r() * 0.1;
    const g = curva(r, x, y, a, len, (r() - 0.5) * 0.5, 5, 0.25), c = tons[Math.floor(r() * tons.length)]!, w = 0.022 + r() * 0.01;
    // Sombra macia deslocada para sudeste (a luz vem de noroeste) e o graveto em dois tons: corpo e o fio claro do lado da luz.
    sombra.push(tira(g.map((v, j) => v + (j % 2 ? 0.012 : 0.01)), w + 0.012, '#1a140c', 0.03, { ...O, alfa: 0.32, desfoque: 0.012 }, 0.6));
    cor.push(tira(g, w, c, 0.032, { ...O, detalhe: 2 }, 0.6));
    cor.push(tira(g.map((v, j) => v - (j % 2 ? w * 0.22 : w * 0.18)), w * 0.4, tom(c, 0.22), 0.033, { ...O, alfa: 0.8, detalhe: 3 }, 0.6));
    if (r() < 0.35) {
      // Forquilha: um raminho curto saindo do meio.
      const px = g[4]!, py = g[5]!, ramo = curva(r, px, py, a + (r() < 0.5 ? 0.6 : -0.6), len * 0.35, 0.2, 3);
      sombra.push(tira(ramo.map((v, j) => v + (j % 2 ? 0.012 : 0.01)), w * 0.7 + 0.01, '#1a140c', 0.03, { ...O, alfa: 0.3, desfoque: 0.01 }, 0.6));
      cor.push(tira(ramo, w * 0.7, c, 0.032, { ...O, detalhe: 3 }, 0.6));
    }
  }
  return [...sombra, ...cor];
}

/** O kit do chão de mata: carimbos que se espalham pelo folhiço. */
export const RECEITAS_DE_CHAO: Receita[] = [
  { id: 'brotos', nome: 'Brotos', ...CHAO, tags: ['brotos', 'rasteira', 'broto', 'plantinhas', 'mato', 'verde', 'chao', 'mata', 'natureza'], pegada: [1.2, 1.2], altura: 0.08,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.6, min: 0.3, max: 1.5, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 0.6, 0.3, 1.5); return piso([R * 2, R * 2], brotos(p.seed, R)); } },
  { id: 'folhico', nome: 'Folhiço', ...CHAO, tags: ['folhas', 'folhico', 'rasteira', 'chao', 'outono', 'mata', 'natureza'], pegada: [1.2, 1.1], altura: 0.04,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.6, min: 0.3, max: 1.5, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 0.6, 0.3, 1.5); return piso([R * 2, R * 1.8], folhico(p.seed, R)); } },
  { id: 'galhada', nome: 'Galhada', ...CHAO, tags: ['galhos', 'rasteira', 'gravetos', 'lenha', 'chao', 'mata', 'natureza'], pegada: [1.2, 0.8], altura: 0.1,
    gerar: p => piso([1.2, 0.8], galhada(p.seed, 1.2)) },
  { id: 'gravetos', nome: 'Gravetos soltos', ...CHAO, tags: ['gravetos', 'rasteira', 'galhos', 'chao', 'mata', 'natureza'], pegada: [1.2, 1.2], altura: 0.04,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.6, min: 0.3, max: 1.5, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 0.6, 0.3, 1.5); return piso([R * 2 + 0.3, R * 2 + 0.3], gravetos(p.seed, R)); } },
  { id: 'raizes', nome: 'Raízes', ...CHAO, tags: ['raiz', 'raizes', 'arvore', 'chao', 'mata', 'natureza'], pegada: [2.6, 2.6], altura: 0.25,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 1.3, min: 0.6, max: 2.5, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 1.3, 0.6, 2.5); return piso([R * 2, R * 2], raizes(p.seed, R)); } },
  { id: 'tufo-de-capim', nome: 'Tufo de capim', ...CHAO, tags: ['capim', 'grama', 'rasteira', 'mato', 'planta', 'mata', 'natureza'], pegada: [1, 1], altura: 0.3,
    campos: [{ id: 'seco', rotulo: 'Seco (0 verde, 1 palha)', tipo: 'numero', padrao: 0.4, min: 0, max: 1, passo: 0.1 }],
    gerar: p => piso([1, 1], tufoDeCapim(p.seed, 0.5, num(p, 'seco', 0.4, 0, 1))) },
  { id: 'moita-de-samambaia', nome: 'Moita de samambaia', ...CHAO, tags: ['samambaia', 'moita', 'rasteira', 'planta', 'folhagem', 'mata', 'natureza'], pegada: [1.3, 1.3], altura: 0.4,
    gerar: p => piso([1.4, 1.4], moitaDeSamambaia(p.seed, 0.68)) },
];

/** O tronco caído redesenhado (o id `tronco.caido` continua o mesmo; os mapas que já o usam ganham o desenho novo). */
export const TRONCO_CAIDO: Receita = { id: 'tronco.caido', nome: 'Tronco caído', ...CHAO, kit: 'exterior', tags: ['tronco', 'madeira', 'natureza', 'mata'], pegada: [2.4, 0.55], altura: 0.46,
  campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 2.4, min: 1.2, max: 6, passo: 0.1 }],
  gerar: p => { const L = num(p, 'comprimento', 2.4, 1.2, 6); return piso([L, 0.55], troncoCaido(p.seed, L)); } };
