import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { bolha, sombraNoChao } from '../organico.ts';
import { num, piso, type Receita } from './comum.ts';

/**
 * Praça e ruína monumental: arquibancada em arco, roseta de calçamento, arco de pedra com roseira, estátua heroica
 * e o casulo do pântano. Pedra clara gasta pelo tempo, juntas escuras e musgo nas frestas, como no resto do kit de ruína.
 */
const PRACA = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim', 'ruina'], kit: 'ruina' };
const PEDRA = '#b3aa98', JUNTA = '#2d2924', MUSGO = ['#4f7a3a', '#6b8f46', '#3d5f2e'];

/** Um quadrilátero de anel entre os raios `r0`–`r1` e os ângulos `a0`–`a1` (centro em `cx`, `cy`), com `k` passos no arco. */
export function setorDeAnel(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, k = 3): number[] {
  const pts: number[] = [];
  for (let i = 0; i <= k; i++) { const a = a0 + ((a1 - a0) * i) / k; pts.push(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
  for (let i = k; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / k; pts.push(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); }
  return pts;
}

/** Desloca uma lista de pontos [x, y, …]. */
const mover = (pts: readonly number[], dx: number, dy: number): number[] => pts.map((v, i) => v + (i % 2 ? dy : dx));
/** Encolhe uma lista de pontos em direção ao próprio centro. */
function encolher(pts: readonly number[], k: number): number[] {
  let cx = 0, cy = 0; const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i]!; cy += pts[i + 1]!; }
  cx /= n; cy /= n;
  return pts.map((v, i) => (i % 2 ? cy + (v - cy) * k : cx + (v - cx) * k));
}

/** Contorno da bacia da fonte: círculo, octógono ou estrela de oito pontas arredondadas. */
function contornoDaBacia(forma: number, R: number, giro = 0): number[] {
  const pts: number[] = [];
  if (forma === 1) { for (let i = 0; i < 8; i++) { const a = giro + Math.PI / 8 + (i / 8) * Math.PI * 2; pts.push(Math.cos(a) * R, Math.sin(a) * R); } return pts; }
  if (forma === 2) {
    const n = 64;
    for (let i = 0; i < n; i++) { const a = giro + (i / n) * Math.PI * 2, k = 0.8 + 0.2 * Math.pow(Math.abs(Math.cos(a * 4)), 0.7); pts.push(Math.cos(a) * R * k, Math.sin(a) * R * k); }
    return pts;
  }
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; pts.push(Math.cos(a) * R, Math.sin(a) * R); }
  return pts;
}

/** Borda de pedras ao longo de um contorno fechado: cada lado vira um bloco entre o contorno e a cópia encolhida. */
function bordaDePedras(partes: Parte[], r: () => number, fora: readonly number[], dentro: readonly number[], cor: string, z: number, juntar = 1): void {
  const n = fora.length / 2;
  for (let i = 0; i < n; i += juntar) {
    const j = Math.min(n, i + juntar), q: number[] = [];
    for (let k = i; k <= j; k++) { const m = (k % n) * 2; q.push(fora[m]!, fora[m + 1]!); }
    for (let k = j; k >= i; k--) { const m = (k % n) * 2; q.push(dentro[m]!, dentro[m + 1]!); }
    const c = tom(cor, (r() - 0.5) * 0.18);
    partes.push(poli(encolher(q, 0.97), c, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    partes.push(poli(encolher(mover(q, -0.015, -0.02), 0.78), tom(c, 0.16), z + 0.01, { contorno: false, semSombra: true, detalhe: 3 }));
  }
}

/** Fonte de praça: bacia de pedra (redonda, octogonal ou em estrela), espelho d'água com ondas e taça central com bica. */
function fonte(D: number, forma: number, seed: number): Parte[] {
  const r = mulberry32(seed), R = D / 2, partes: Parte[] = [];
  const degrau = contornoDaBacia(forma, R), aro = contornoDaBacia(forma, R * 0.9), dentro = contornoDaBacia(forma, R * 0.78);
  partes.push(poli(degrau, tom(PEDRA, -0.22), 0.2, { contorno: 'leve', sombraLeve: true }), poli(encolher(degrau, 0.97), tom(PEDRA, -0.08), 0.22, { contorno: false, semSombra: true, detalhe: 2 }));
  // Espelho d'água: fundo escuro na borda, claro no meio, com anéis de onda.
  partes.push(poli(dentro, '#2c4a5a', 0.3, { contorno: false, semSombra: true }), poli(encolher(dentro, 0.86), '#3d6578', 0.31, { contorno: false, semSombra: true, detalhe: 2 }), poli(encolher(dentro, 0.62), '#5a8a9c', 0.32, { contorno: false, semSombra: true, suave: true, detalhe: 2 }));
  for (let i = 0; i < 3; i++) { const k = 0.32 + i * 0.16; partes.push(poli(setorDeAnel(0, 0, R * k, R * (k + 0.018), 0, Math.PI * 2, 36), '#b9dbe6', 0.33, { contorno: false, semSombra: true, alfa: 0.55, detalhe: 3 })); }
  // Aro de pedra.
  bordaDePedras(partes, r, aro, dentro, PEDRA, 0.62, forma === 0 ? 4 : forma === 2 ? 4 : 1);
  // Taça central sobre coluna, com a bica.
  const taca = contornoDaBacia(forma === 2 ? 1 : forma, R * 0.32, Math.PI / 8);
  partes.push(elipse(0.04, 0.05, R * 0.22, R * 0.22, tom(PEDRA, -0.5), 0.7, { contorno: 'leve', sombraLeve: true }));
  partes.push(poli(taca, tom(PEDRA, -0.05), 1.15, { contorno: 'leve', sombraLeve: true }), poli(encolher(taca, 0.78), '#4f7d90', 1.17, { contorno: false, semSombra: true, detalhe: 2 }), poli(encolher(taca, 0.5), '#8dbccb', 1.18, { contorno: false, semSombra: true, suave: true, detalhe: 3 }));
  partes.push(elipse(0, 0, R * 0.12, R * 0.12, tom(PEDRA, 0.1), 1.6, { contorno: 'leve' }), elipse(-R * 0.02, -R * 0.025, R * 0.06, R * 0.06, '#eef7fa', 1.65, { contorno: false, semSombra: true, detalhe: 3 }));
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + r() * 0.3; partes.push(elipse(Math.cos(a) * R * 0.36, Math.sin(a) * R * 0.36, 0.1, 0.06, '#e6f3f7', 0.35, { contorno: false, semSombra: true, alfa: 0.7, detalhe: 3 })); }
  if (r() < 0.8) partes.push(poli(bolha(R * 0.55, R * 0.62, 0.22, 0.14, 7, 0.3, r), MUSGO[0]!, 0.66, { contorno: false, semSombra: true, suave: true, detalhe: 3 }));
  return partes;
}

/** Arquibancada em arco (anfiteatro): `degraus` fileiras concêntricas de blocos, a mais alta por fora, abrindo para +y. */
function arquibancada(R: number, abertura: number, degraus: number, seed: number): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), prof = 0.8, r0 = Math.max(1, R - degraus * prof), meio = -Math.PI / 2, a0 = meio - abertura / 2, a1 = meio + abertura / 2;
  // Caixa do arco, para centrar as partes na pegada.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i <= 48; i++) { const a = a0 + ((a1 - a0) * i) / 48; for (const rr of [r0, R]) { const x = Math.cos(a) * rr, y = Math.sin(a) * rr; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
  const cx = -(x0 + x1) / 2, cy = -(y0 + y1) / 2, partes: Parte[] = [];
  partes.push(poli(setorDeAnel(cx + 0.08, cy + 0.12, r0 - 0.1, R + 0.15, a0 - 0.02, a1 + 0.02, 40), '#0d0a08', 0.05, { contorno: false, semSombra: true, alfa: 0.35, suave: true }));
  for (let d = 0; d < degraus; d++) {
    const ri = r0 + d * prof, re = ri + prof, z = 0.25 + d * 0.42, n = Math.max(3, Math.round(((a1 - a0) * re) / 1.3));
    for (let i = 0; i < n; i++) {
      const b0 = a0 + ((a1 - a0) * i) / n, b1 = a0 + ((a1 - a0) * (i + 1)) / n, folga = 0.02 / re;
      if (r() < 0.05 && d > 0) { partes.push(poli(setorDeAnel(cx, cy, ri + 0.1, re - 0.1, b0 + 0.05, b1 - 0.05, 3), tom(PEDRA, -0.55), z - 0.4, { contorno: false, semSombra: true, detalhe: 2 })); continue; }
      const c = tom(PEDRA, (r() - 0.5) * 0.2 - d * 0.015);
      // Espelho do degrau (a face que olha para o centro), depois o piso do degrau e o desgaste claro na quina.
      partes.push(poli(setorDeAnel(cx, cy, ri, ri + 0.2, b0 + folga, b1 - folga, 3), tom(c, -0.42), z - 0.02, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      partes.push(poli(setorDeAnel(cx, cy, ri + 0.16, re, b0 + folga, b1 - folga, 3), c, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      partes.push(poli(setorDeAnel(cx, cy, ri + 0.18, ri + 0.3, b0 + folga * 2, b1 - folga * 2, 3), tom(c, 0.22), z + 0.01, { contorno: false, semSombra: true, detalhe: 3 }));
      if (r() < 0.22) { const b = b0 + (b1 - b0) * r(), rr = ri + 0.3 + r() * (prof - 0.4); partes.push(poli(bolha(cx + Math.cos(b) * rr, cy + Math.sin(b) * rr, 0.16 + r() * 0.14, 0.1 + r() * 0.08, 7, 0.35, r), MUSGO[Math.floor(r() * 3)]!, z + 0.02, { contorno: false, semSombra: true, suave: true, detalhe: 3 })); }
    }
  }
  return { pegada: [x1 - x0, y1 - y0], partes };
}

/** Roseta de calçamento: anéis concêntricos de paralelepípedos com um meio-fio largo, rente ao chão. */
function roseta(R: number, seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], tons = ['#a49d90', '#8f887c', '#b5ae9f', '#7d776c'];
  partes.push(elipse(0, 0, R * 2, R * 2, JUNTA, 0.01, { contorno: false, semSombra: true }));
  // Meio-fio: blocos compridos na borda externa.
  const nB = Math.max(10, Math.round((Math.PI * 2 * R) / 0.75));
  for (let i = 0; i < nB; i++) { const b0 = (i / nB) * Math.PI * 2, b1 = ((i + 1) / nB) * Math.PI * 2, c = tom('#9c9585', (r() - 0.5) * 0.14); partes.push(poli(setorDeAnel(0, 0, R - 0.34, R - 0.02, b0 + 0.012, b1 - 0.012, 2), c, 0.03, { contorno: 'leve', semSombra: true, detalhe: 2 }), poli(setorDeAnel(0, 0, R - 0.26, R - 0.1, b0 + 0.03, b1 - 0.03, 2), tom(c, 0.14), 0.035, { contorno: false, semSombra: true, detalhe: 3 })); }
  // Anéis de pedras miúdas, alternando o tom por anel, e o miolo.
  let rr = R - 0.38, anel = 0;
  while (rr > 0.45) {
    const w = 0.26, ri = rr - w, n = Math.max(6, Math.round((Math.PI * 2 * (rr - w / 2)) / 0.3)), giro = r() * Math.PI;
    const base = tons[anel % 2 === 0 ? (anel % 4 === 0 ? 0 : 2) : 1]!;
    for (let i = 0; i < n; i++) {
      const b0 = giro + (i / n) * Math.PI * 2, b1 = giro + ((i + 1) / n) * Math.PI * 2, f = 0.03 / rr, c = tom(base, (r() - 0.5) * 0.2);
      partes.push(poli(setorDeAnel(0, 0, ri + 0.025, rr - 0.025, b0 + f, b1 - f, 1), c, 0.02, { contorno: false, semSombra: true, detalhe: 2 }));
      if (r() < 0.35) partes.push(poli(encolher(setorDeAnel(0, 0, ri + 0.1, rr - 0.04, b0 + f * 2, b1 - f * 2, 1), 0.8), tom(c, 0.18), 0.025, { contorno: false, semSombra: true, detalhe: 3 }));
    }
    rr = ri; anel++;
  }
  partes.push(elipse(0, 0, rr * 2 + 0.1, rr * 2 + 0.1, tom(tons[3]!, -0.1), 0.02, { contorno: 'leve', semSombra: true }), elipse(0, 0, rr * 1.4, rr * 1.4, tons[0]!, 0.025, { contorno: false, semSombra: true, detalhe: 2 }));
  // Grama nas juntas, aqui e ali.
  for (let i = 0; i < Math.round(R * 3); i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (R - 0.4); partes.push(poli(bolha(Math.cos(a) * d, Math.sin(a) * d, 0.12 + r() * 0.1, 0.06 + r() * 0.05, 6, 0.4, r), MUSGO[1]!, 0.04, { contorno: false, semSombra: true, suave: true, alfa: 0.8, detalhe: 3 })); }
  return partes;
}

/** Casulo do pântano: um monte em escamas sobrepostas, do pé escuro e úmido ao topo claro com a boca aberta. */
function casulo(T: number, seed: number): Parte[] {
  const r = mulberry32(seed), W = T, H = T * 1.25, partes: Parte[] = [], base = '#8a7a63', giro = (r() - 0.5) * 0.4;
  sombraNoChao(partes, bolha(0, 0, W * 0.55, H * 0.55, 18, 0.1, r, giro), 0.04, '#0a0a08', 0.6);
  const camadas = 7;
  for (let i = 0; i < camadas; i++) {
    const t = i / (camadas - 1), k = 1 - t * 0.72, rx = (W / 2) * k, ry = (H / 2) * k, cx = -W * 0.07 * t, cy = -H * 0.09 * t, n = 14 + Math.round(10 * k), pts: number[] = [];
    for (let j = 0; j < n * 3; j++) { const a = giro + (j / (n * 3)) * Math.PI * 2, lobo = 0.93 + 0.07 * Math.abs(Math.sin((j / 3) * Math.PI)); pts.push(cx + Math.cos(a) * rx * lobo, cy + Math.sin(a) * ry * lobo); }
    const c = tom(base, -0.5 + t * 0.62);
    partes.push(poli(pts, c, 0.2 + t * T * 0.75, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    // Brilho nas pontas das escamas do lado da luz (noroeste).
    partes.push(poli(setorDeAnel(cx, cy, Math.min(rx, ry) * 0.86, Math.min(rx, ry) * 0.97, Math.PI * 1.05, Math.PI * 1.55, 6).map((v, m) => (m % 2 ? cy + (v - cy) * (ry / Math.min(rx, ry)) : cx + (v - cx) * (rx / Math.min(rx, ry)))), tom(c, 0.25), 0.21 + t * T * 0.75, { contorno: false, semSombra: true, suave: true, detalhe: 3 }));
  }
  const tx = -W * 0.07, ty = -H * 0.09;
  partes.push(elipse(tx, ty, W * 0.14, H * 0.12, '#1a140e', T * 0.8, { contorno: 'leve', semSombra: true }), elipse(tx + 0.02, ty + 0.03, W * 0.07, H * 0.06, '#000000', T * 0.81, { contorno: false, semSombra: true, detalhe: 2 }));
  for (let i = 0; i < 5; i++) { const a = r() * Math.PI * 2; partes.push(elipse(Math.cos(a) * W * 0.46, Math.sin(a) * H * 0.46, 0.18, 0.1, MUSGO[2]!, 0.3, { contorno: false, semSombra: true, suave: true, detalhe: 3 })); }
  return partes;
}

/** Arco de pedra (portal visto de cima): dois pilares e as aduelas por cima; com `flores`, uma roseira trepadeira cobre a volta. */
function arcoDePedra(L: number, flores: boolean, seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], P = 0.8, x = L / 2 + P / 2, lim = (v: number) => Math.max(-x - P * 0.45, Math.min(x + P * 0.45, v));
  for (const s of [-1, 1]) {
    partes.push(ret(s * x + 0.05, 0.07, P + 0.04, 0.9, tom(PEDRA, -0.55), 2.6, { raio: 0.04, contorno: 'leve', sombraLeve: true }), ret(s * x, 0, P, 0.86, tom(PEDRA, -0.08), 2.7, { raio: 0.04, contorno: 'leve', detalhe: 1 }), ret(s * x - 0.06, -0.08, P * 0.6, 0.5, tom(PEDRA, 0.16), 2.72, { contorno: false, semSombra: true, detalhe: 3 }));
  }
  const n = Math.max(5, Math.round(L / 0.42)), passo = (L + 0.2) / n;
  for (let i = 0; i < n; i++) {
    const xi = -L / 2 - 0.1 + passo * (i + 0.5), c = tom(PEDRA, (r() - 0.5) * 0.16), z = 3.1 + Math.sin(((i + 0.5) / n) * Math.PI) * 0.6;
    partes.push(ret(xi, 0, passo - 0.04, 0.7, c, z, { raio: 0.03, contorno: 'leve', sombraLeve: true, detalhe: 1 }), ret(xi - 0.03, -0.12, (passo - 0.04) * 0.7, 0.3, tom(c, 0.2), z + 0.01, { contorno: false, semSombra: true, detalhe: 3 }));
  }
  partes.push(ret(0, 0, passo * 0.9, 0.78, tom(PEDRA, 0.08), 3.75, { raio: 0.04, contorno: 'leve', detalhe: 1 }));
  if (flores) {
    for (let i = 0; i < Math.round(L * 3.5); i++) {
      const t = r(), xx = (t < 0.5 ? -1 : 1) * (L / 2 + P * (0.2 + r() * 0.6)) + (r() < 0.3 ? (r() - 0.5) * L : 0), yy = (r() - 0.5) * 0.9, z = 3.8 + r() * 0.2;
      partes.push(poli(bolha(lim(xx), yy, 0.2 + r() * 0.16, 0.16 + r() * 0.1, 7, 0.35, r), MUSGO[Math.floor(r() * 3)]!, z, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
    }
    for (let i = 0; i < Math.round(L * 3); i++) {
      const xx = (r() < 0.5 ? -1 : 1) * (L / 2 + P * (0.1 + r() * 0.7)) + (r() < 0.3 ? (r() - 0.5) * L : 0), yy = (r() - 0.5) * 0.8, cor = r() < 0.7 ? '#b8243a' : '#e0607a';
      partes.push(elipse(lim(xx), yy, 0.13, 0.13, cor, 4.05, { contorno: 'leve', semSombra: true, detalhe: 2 }), elipse(lim(xx) - 0.02, yy - 0.02, 0.05, 0.05, tom(cor, 0.4), 4.06, { contorno: false, semSombra: true, detalhe: 3 }));
    }
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++) partes.push(poli(bolha(s * x + (r() - 0.5) * 0.6, 0.5 + r() * 0.15, 0.25, 0.14, 7, 0.4, r), MUSGO[i % 3]!, 0.4 + i * 0.6, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
  }
  return partes;
}

/** Estátua heroica sobre pedestal em dois degraus: figura de manto com a espada erguida (vista de cima), alta para lançar sombra longa. */
function estatuaHeroica(seed: number): Parte[] {
  const r = mulberry32(seed), BR = '#a8a396', partes: Parte[] = [];
  partes.push(ret(0.06, 0.08, 1.9, 1.9, tom(PEDRA, -0.55), 0.3, { raio: 0.05, contorno: 'leve', sombraLeve: true }), ret(0, 0, 1.86, 1.86, tom(PEDRA, -0.1), 0.35, { raio: 0.05, contorno: 'leve', detalhe: 1 }));
  partes.push(ret(0, 0, 1.4, 1.4, tom(PEDRA, 0.05), 1.2, { raio: 0.04, contorno: 'leve', sombraLeve: true, detalhe: 1 }), ret(-0.1, -0.1, 1.0, 0.18, tom(PEDRA, 0.25), 1.21, { contorno: false, semSombra: true, detalhe: 3 }));
  // Manto aberto, ombros, braço erguido com a espada e a cabeça (desenhados em escala 1 e ampliados para o pedestal).
  const fig: Parte[] = [];
  fig.push(poli([-0.55, 0.45, -0.62, -0.05, -0.35, -0.38, 0.35, -0.38, 0.62, -0.05, 0.55, 0.45, 0.2, 0.55, -0.2, 0.55], tom(BR, -0.25), 3.6, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  fig.push(elipse(0, -0.05, 0.86, 0.5, BR, 4.6, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(-0.12, -0.14, 0.5, 0.22, tom(BR, 0.22), 4.62, { contorno: false, semSombra: true, detalhe: 3 }));
  fig.push(poli([0.32, -0.12, 0.5, -0.5, 0.62, -0.46, 0.46, -0.06], tom(BR, -0.05), 5.0, { contorno: 'leve', detalhe: 2 }));
  fig.push(poli([0.52, -0.45, 0.62, -0.47, 0.82, -1.25, 0.76, -1.28], '#c9c6bd', 5.6, { contorno: 'leve', detalhe: 2 }), ret(0.56, -0.47, 0.32, 0.06, tom(BR, -0.1), 5.4, { contorno: 'leve', detalhe: 3 }));
  fig.push(poli([-0.32, -0.08, -0.48, 0.18, -0.38, 0.26, -0.2, 0.05], tom(BR, -0.12), 4.4, { contorno: 'leve', detalhe: 2 }));
  fig.push(elipse(0, -0.08, 0.34, 0.36, tom(BR, 0.05), 5.8, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(-0.05, -0.14, 0.16, 0.14, tom(BR, 0.3), 5.82, { contorno: false, semSombra: true, detalhe: 3 }));
  const S = 1.3;
  for (const q of fig) { if (q.pts) q.pts = q.pts.map(v => v * S); else { q.x! *= S; q.y! *= S; q.w! *= S; q.h! *= S; } }
  partes.push(...fig);
  // Pátina verde nas dobras e musgo no pé do pedestal.
  for (let i = 0; i < 4; i++) partes.push(elipse(-0.5 + r() * 1, 0.1 + r() * 0.45, 0.2, 0.1, '#6f8b74', 3.62, { contorno: false, semSombra: true, alfa: 0.6, detalhe: 3 }));
  for (let i = 0; i < 4; i++) { const a = r() * Math.PI * 2; partes.push(poli(bolha(Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0.2, 0.1, 7, 0.4, r), MUSGO[i % 3]!, 0.4, { contorno: false, semSombra: true, suave: true, detalhe: 3 })); }
  return partes;
}

export const RECEITAS_DA_PRACA: Receita[] = [
  { id: 'arquibancada', nome: 'Arquibancada em arco', ...PRACA, tags: ['arquibancada', 'anfiteatro', 'degraus', 'pedra', 'ruina', 'arena'], pegada: [13.9, 6], altura: 2.4,
    campos: [
      { id: 'raio', rotulo: 'Raio externo (m)', tipo: 'numero', padrao: 8, min: 4, max: 16, passo: 0.5 },
      { id: 'abertura', rotulo: 'Abertura do arco (graus)', tipo: 'numero', padrao: 120, min: 40, max: 240, passo: 10 },
      { id: 'degraus', rotulo: 'Fileiras', tipo: 'numero', padrao: 5, min: 2, max: 10, passo: 1 },
    ],
    gerar: p => {
      const R = num(p, 'raio', 8, 4, 16), ab = (num(p, 'abertura', 120, 40, 240) * Math.PI) / 180, d = Math.round(num(p, 'degraus', 5, 2, 10));
      const { pegada, partes } = arquibancada(R, ab, Math.min(d, Math.floor((R - 1) / 0.8)), p.seed);
      return piso(pegada, partes);
    } },
  { id: 'roseta-de-calcamento', nome: 'Roseta de calçamento', ...PRACA, funcoes: ['jardim', 'ruina', 'praca'], tags: ['calcamento', 'roseta', 'paralelepipedo', 'praca', 'chao', 'circulo'], pegada: [8, 8], altura: 0.02,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 4, min: 1.5, max: 9, passo: 0.5 }],
    gerar: p => { const R = num(p, 'raio', 4, 1.5, 9); return piso([R * 2, R * 2], roseta(R, p.seed)); } },
  { id: 'arco-de-pedra', nome: 'Arco de pedra', ...PRACA, funcoes: ['jardim', 'ruina', 'cemiterio'], tags: ['arco', 'portal', 'portao', 'pedra', 'roseira', 'flores', 'entrada'], pegada: [4.8, 1.5], altura: 4,
    campos: [{ id: 'largura', rotulo: 'Vão (m)', tipo: 'numero', padrao: 3, min: 1.5, max: 6, passo: 0.5 }, { id: 'flores', rotulo: 'Roseira (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => { const L = num(p, 'largura', 3, 1.5, 6); return piso([L + 1.8, 1.5], arcoDePedra(L, Math.round(num(p, 'flores', 1, 0, 1)) === 1, p.seed)); } },
  { id: 'estatua-heroica', nome: 'Estátua heroica', ...PRACA, funcoes: ['jardim', 'ruina', 'praca', 'cemiterio'], tags: ['estatua', 'heroi', 'monumento', 'pedestal', 'espada', 'praca'], pegada: [2, 2.6], altura: 6,
    gerar: p => piso([2, 2.6], estatuaHeroica(p.seed)) },
  { id: 'casulo', nome: 'Casulo', ...PRACA, funcoes: ['jardim', 'caverna', 'pantano'], kit: 'pantano', tags: ['casulo', 'ninho', 'ovo', 'monte', 'pantano', 'criatura', 'cupinzeiro'], pegada: [2, 2.5], altura: 1.6,
    campos: [{ id: 'tamanho', rotulo: 'Tamanho (m)', tipo: 'numero', padrao: 2, min: 0.8, max: 4, passo: 0.2 }],
    gerar: p => { const T = num(p, 'tamanho', 2, 0.8, 4); return piso([T, T * 1.25], casulo(T, p.seed)); } },
];

export { fonte as fonteDePraca };
