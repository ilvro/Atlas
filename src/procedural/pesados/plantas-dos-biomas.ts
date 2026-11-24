import { elipse, poli, type DescricaoDePiso, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, lente, tira, type Tons } from '../organico.ts';
import type { GeradorPesado } from './index.ts';
import { copaDeRaminhos, misturar } from './plantas.ts';

// Árvores e plantas dos biomas da Frente Q (selva, praia, deserto, jardim oriental, mangue). Seguem a mesma luz (noroeste) e o mesmo
// nanquim das copas de `plantas.ts`: toda forma que conta na silhueta tem por baixo uma cópia escura um pouco mais larga.

const num = (v: unknown, padrao: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : padrao);
/** O ângulo de onde vem a luz; `Math.cos(a − LUZ_A)` é 1 no que aponta para ela. */
const LUZ_A = Math.atan2(LUZ_Y, LUZ_X);
const O = { contorno: false as const, semSombra: true, suave: true };

/** Desloca partes (para montar uma copa a partir de copas menores). */
function mover(partes: readonly Parte[], dx: number, dy: number, dz = 0): Parte[] {
  return partes.map(p => (p.forma === 'poli' ? { ...p, z: p.z + dz, pts: p.pts!.map((v, i) => v + (i % 2 ? dy : dx)) } : { ...p, z: p.z + dz, x: p.x! + dx, y: p.y! + dy }));
}
/** Um oval girado (`ang`) em polígono: o `elipse` da descrição não gira. */
function oval(cx: number, cy: number, rx: number, ry: number, ang: number, n = 16): number[] {
  const c = Math.cos(ang), s = Math.sin(ang), pts: number[] = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, u = Math.cos(t) * rx, v = Math.sin(t) * ry; pts.push(cx + u * c - v * s, cy + u * s + v * c); }
  return pts;
}
/** A escala de cinco tons como lista, do escuro ao brilho, e a cor contínua nela (`k` de 0 a 4). */
const escala = (t: Tons) => [t.fundo, t.base, t.meio, t.luz, t.brilho];
function naEscala(t: Tons, k: number): string { const e = escala(t), q = Math.max(0, Math.min(3.999, k)), i = Math.floor(q); return misturar(e[i]!, e[i + 1]!, q - i); }

// ---------- Palmeiras ----------

/**
 * Uma fronde de palmeira vista de cima: a raque curva sai de (x, y) para `ang` e os folíolos saem dos dois lados, inclinados para a
 * ponta, maiores no meio. Cada folíolo tem o nanquim por baixo; os virados para a luz clareiam. `curva` entorta a raque para o lado.
 */
function fronde(partes: Parte[], r: () => number, x: number, y: number, ang: number, comp: number, z: number, cores: readonly string[], { foliolos = 20, curva = 0.12, abertura = 0.95, largura = 0.26, nanquim = '#0e1a0c' }: { foliolos?: number; curva?: number; abertura?: number; largura?: number; nanquim?: string } = {}): void {
  const c = Math.cos(ang), s = Math.sin(ang), lado = r() < 0.5 ? -1 : 1, raque: number[] = [];
  const ponto = (t: number): [number, number] => { const b = Math.sin(t * Math.PI) * curva * comp * lado; return [x + c * comp * t - s * b, y + s * comp * t + c * b]; };
  for (let i = 0; i <= 8; i++) raque.push(...ponto(i / 8));
  const f0 = Math.cos(ang - LUZ_A), folhas: { x: number; y: number; a: number; len: number; w: number; cor: string }[] = [];
  for (let k = 1; k <= foliolos; k++) {
    const t = 0.06 + (k / (foliolos + 1)) * 0.94, [px, py] = ponto(t), [qx, qy] = ponto(Math.min(1, t + 0.02)), ta = Math.atan2(qy - py, qx - px);
    for (const l of [-1, 1]) {
      const a = ta + l * abertura * (1 - t * 0.45) + (r() - 0.5) * 0.12, len = comp * largura * Math.sin(Math.PI * (0.12 + 0.82 * t)) * (0.85 + r() * 0.3), f = Math.cos(a - LUZ_A);
      const k2 = 1 + f * 0.9 + f0 * 0.5 + (r() - 0.5) * 0.6 - t * 0.3, i = Math.max(0, Math.min(cores.length - 1.001, k2)), i0 = Math.floor(i);
      folhas.push({ x: px, y: py, a, len, w: len * 0.17, cor: misturar(cores[i0]!, cores[Math.min(cores.length - 1, i0 + 1)]!, i - i0) });
    }
  }
  for (const q of folhas) partes.push(lente(q.x, q.y, q.a, q.len + 0.03, q.w + 0.035, nanquim, z, { contorno: false, sombraLeve: true, detalhe: 1 }));
  for (const q of folhas) partes.push(lente(q.x, q.y, q.a, q.len, q.w, q.cor, z + 0.005, { ...O, detalhe: 2 }));
  partes.push(tira(raque, comp * 0.035, nanquim, z + 0.008, { ...O, detalhe: 1 }, 0.4), tira(raque, comp * 0.02, tom(cores[cores.length - 1]!, 0.08), z + 0.01, { ...O, detalhe: 2 }, 0.4));
}

const COQUEIRO = ['#1c3a1a', '#33602a', '#4f8034', '#72a242', '#98c05a'];
const TAMAREIRA = ['#1f3329', '#3a5644', '#56735c', '#76937a', '#9db29a'];
const SECA = ['#3a2a16', '#5e4626', '#7e6236', '#a0824a', '#bea060'];

/**
 * Coqueiro: o tronco inclinado aparece entre o pé e a copa (anéis claros e o lado da luz), e a copa tem três voltas de frondes, das
 * longas e caídas às novas do miolo, com cocos no meio. O pé fica perto da borda da pegada e a copa, do outro lado.
 */
function coqueiro(D: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], Rc = D * 0.4, cx = D * 0.08, bx = -D * 0.4;
  // Tronco: do pé (bx) à copa (cx), com uma leve curva.
  const tronco: number[] = []; for (let i = 0; i <= 8; i++) { const t = i / 8; tronco.push(bx + (cx - bx) * t, Math.sin(t * Math.PI) * D * 0.035); }
  partes.push(elipse(bx, 0, D * 0.09, D * 0.08, '#2a2016', 0.3, { ...O, alfa: 0.7, detalhe: 1 }));
  partes.push(tira(tronco, D * 0.075, '#2b2118', 1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, 0.8), tira(tronco, D * 0.06, '#7a6550', 1.01, { ...O, detalhe: 1 }, 0.8));
  partes.push(tira(tronco.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * D * 0.012), D * 0.022, '#a48d70', 1.02, { ...O, detalhe: 2 }, 0.8));
  for (let i = 1; i < 14; i++) { const t = i / 14, x = bx + (cx - bx) * t, y = Math.sin(t * Math.PI) * D * 0.035; partes.push(lente(x, y - D * 0.03, Math.PI / 2, D * 0.06, D * 0.012, '#4a3a2c', 1.03, { ...O, detalhe: 3 })); }
  // Copa: frondes longas e caídas, depois as do meio, os cocos e as novas.
  partes.push(elipse(cx, 0, Rc * 0.5, Rc * 0.5, '#0c160a', 2.9, { ...O, alfa: 0.75, desfoque: Rc * 0.12, detalhe: 1 }));
  const voltas = [{ n: 9, comp: Rc * 0.98, z: 3, cores: COQUEIRO.slice(0, 4), curva: 0.14 }, { n: 7, comp: Rc * 0.74, z: 3.3, cores: COQUEIRO.slice(1), curva: 0.1 }, { n: 4, comp: Rc * 0.42, z: 3.6, cores: COQUEIRO.slice(2), curva: 0.06 }];
  voltas.forEach((v, iv) => {
    const giro = r() * Math.PI * 2;
    for (let i = 0; i < v.n; i++) fronde(partes, r, cx, 0, giro + (i / v.n) * Math.PI * 2 + (r() - 0.5) * 0.3, v.comp * (0.88 + r() * 0.12), v.z + i * 0.01, v.cores, { curva: v.curva, foliolos: iv === 2 ? 12 : 22, largura: 0.34 });
    if (iv === 0) for (let i = 0; i < 6; i++) {
      const a = r() * Math.PI * 2, d = Rc * (0.06 + r() * 0.08), x = cx + Math.cos(a) * d, y = Math.sin(a) * d, rc = D * 0.03;
      partes.push(elipse(x, y, rc * 2.3, rc * 2.3, '#10140a', 3.2, { contorno: false, sombraLeve: true, detalhe: 2 }), elipse(x, y, rc * 2, rc * 2, i % 3 ? '#6a6a2a' : '#7a5a2a', 3.21, { ...O, detalhe: 2 }), elipse(x + LUZ_X * rc * 0.35, y + LUZ_Y * rc * 0.35, rc * 0.9, rc * 0.9, '#a6a04a', 3.22, { ...O, detalhe: 3 }));
    }
  });
  partes.push(elipse(cx, 0, Rc * 0.1, Rc * 0.1, '#5e7a2e', 3.8, { ...O, detalhe: 2 }));
  return { tipo: 'piso', pegada: [D, D], partes };
}

/** Tamareira: tronco reto (fica sob a copa), uma saia de frondes secas por baixo e frondes duras, cinza-azuladas, com cachos de tâmaras. */
function tamareira(D: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], R = D * 0.48;
  partes.push(elipse(0, 0, R * 0.6, R * 0.6, '#0e140e', 2.4, { ...O, alfa: 0.7, desfoque: R * 0.15, detalhe: 1 }));
  const giro0 = r() * Math.PI * 2;
  for (let i = 0; i < 12; i++) fronde(partes, r, 0, 0, giro0 + (i / 12) * Math.PI * 2 + (r() - 0.5) * 0.3, R * (0.78 + r() * 0.12), 2.5 + i * 0.01, SECA, { curva: 0.05, abertura: 0.6, largura: 0.2, nanquim: '#1a1208', foliolos: 16 });
  const voltas = [{ n: 13, comp: R, z: 3, cores: TAMAREIRA.slice(0, 4) }, { n: 9, comp: R * 0.72, z: 3.3, cores: TAMAREIRA.slice(1) }, { n: 5, comp: R * 0.42, z: 3.6, cores: TAMAREIRA.slice(2) }];
  voltas.forEach((v, iv) => {
    const giro = r() * Math.PI * 2;
    for (let i = 0; i < v.n; i++) fronde(partes, r, 0, 0, giro + (i / v.n) * Math.PI * 2 + (r() - 0.5) * 0.2, v.comp * (0.9 + r() * 0.1), v.z + i * 0.01, v.cores, { curva: 0.04, abertura: 0.75, largura: 0.22, nanquim: '#0d1610', foliolos: iv === 2 ? 12 : 22 });
    if (iv === 0) for (let c = 0; c < 4; c++) {   // cachos de tâmaras: grãos âmbar entre as frondes de baixo e as do meio
      const a = r() * Math.PI * 2, d = R * (0.14 + r() * 0.08);
      for (let k = 0; k < 9; k++) { const b = a + (r() - 0.5) * 0.6, e = d + (r() - 0.3) * R * 0.08, x = Math.cos(b) * e, y = Math.sin(b) * e; partes.push(elipse(x, y, 0.09, 0.09, '#1c1008', 3.2, { contorno: false, sombraLeve: true, detalhe: 2 }), elipse(x - 0.008, y - 0.008, 0.07, 0.07, k % 3 ? '#b8662a' : '#d0883a', 3.21, { ...O, detalhe: 3 })); }
    }
  });
  partes.push(elipse(0, 0, R * 0.09, R * 0.09, '#8aa088', 3.8, { ...O, detalhe: 2 }));
  return { tipo: 'piso', pegada: [D, D], partes };
}

// ---------- Cactos ----------

/** Uma coluna de cacto vista de cima: costelas em leque do centro à borda (claras do lado da luz), sulcos escuros e aréolas de espinhos. */
function colunaDeCacto(partes: Parte[], r: () => number, x: number, y: number, R: number, n: number, z: number, cores: readonly [string, string, string, string], espinho: string, densos = 3): void {
  const [sulco, base, luz, brilho] = cores, giro = r() * Math.PI;
  partes.push(elipse(x, y, R * 2.12, R * 2.12, '#0e140c', z - 0.01, { contorno: false, sombraLeve: true, detalhe: 1 }), elipse(x, y, R * 2, R * 2, sulco, z, { ...O, detalhe: 1 }));
  for (let i = 0; i < n; i++) {
    const a = giro + (i / n) * Math.PI * 2, f = Math.cos(a - LUZ_A), w = ((Math.PI * 2 * R) / n) * 0.82;
    partes.push(lente(x, y, a, R * 0.97, w, misturar(base, luz, Math.max(0, f) * 0.85 + 0.1), z + 0.01, { ...O, detalhe: 1 }));
    if (f > 0.2) partes.push(lente(x + Math.cos(a) * R * 0.15, y + Math.sin(a) * R * 0.15, a, R * 0.75, w * 0.35, brilho, z + 0.015, { ...O, alfa: 0.7, detalhe: 2 }));
    for (let k = 1; k <= densos; k++) {
      const t = 0.25 + (k / densos) * 0.68, ex = x + Math.cos(a) * R * t, ey = y + Math.sin(a) * R * t, e = R * 0.05 + 0.006;
      partes.push(elipse(ex, ey, e * 1.6, e * 1.6, espinho, z + 0.02, { ...O, detalhe: 3 }));
      for (let j = 0; j < 3; j++) partes.push(lente(ex, ey, a + (j - 1) * 0.9 + (r() - 0.5) * 0.3, e * 3, e * 0.5, espinho, z + 0.021, { ...O, alfa: 0.85, detalhe: 3 }));
    }
  }
  partes.push(elipse(x + LUZ_X * R * 0.05, y + LUZ_Y * R * 0.05, R * 0.3, R * 0.3, tom(espinho, -0.15), z + 0.03, { ...O, alfa: 0.8, detalhe: 2 }));
}
const VERDE_CACTO = ['#24361e', '#3e5e32', '#6a8a4e', '#9cb878'] as const;

/**
 * Saguaro. O `z` das partes fica baixo (1,2 m) de propósito: o mapa de altura sai do `z`, e uma coluna estreita de 3 m escurecia um anel do chão
 * em volta (oclusão); a `altura` do gerador (3 m) continua dando o comprimento da sombra do sol.
 * A coluna alta no meio e de 2 a 4 braços; cada braço sai deitado (visto de lado, costelas ao longo) e sobe numa ponta redonda. */
function saguaro(seed: number, bracos: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], giro = r() * Math.PI * 2;
  partes.push(elipse(0, 0, 0.8, 0.8, '#2a2018', 0.05, { ...O, alfa: 0.35, desfoque: 0.12, detalhe: 1 }));
  for (let i = 0; i < bracos; i++) {
    const a = giro + (i / bracos) * Math.PI * 2 + (r() - 0.5) * 0.8, d = 0.42 + r() * 0.2, x = Math.cos(a) * d, y = Math.sin(a) * d, z = 0.75 + r() * 0.2;
    const braco = [Math.cos(a) * 0.15, Math.sin(a) * 0.15, x * 0.65, y * 0.65, x, y];
    partes.push(tira(braco, 0.3, '#0e140c', z - 0.2, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.9), tira(braco, 0.26, VERDE_CACTO[1], z - 0.19, { ...O, detalhe: 1 }, 0.9));
    for (const k of [-1, 0, 1]) partes.push(tira(braco.map((v, j) => v + (j % 2 ? Math.cos(a) : -Math.sin(a)) * k * 0.07), 0.03, k === (Math.cos(a - Math.PI / 2 - LUZ_A) > 0 ? 1 : -1) ? VERDE_CACTO[3] : VERDE_CACTO[0], z - 0.18, { ...O, alfa: 0.8, detalhe: 2 }, 0.8));
    colunaDeCacto(partes, r, x, y, 0.15, 10, z, VERDE_CACTO, '#e4dcb0', 2);
  }
  colunaDeCacto(partes, r, 0, 0, 0.27, 14, 1.2, VERDE_CACTO, '#e4dcb0');
  return { tipo: 'piso', pegada: [1.7, 1.7], partes };
}

/** Palma (opuntia): raquetes em cadeia a partir do pé, umas de chapa (ovais) e outras de lado (estreitas), com aréolas e figos vermelhos na ponta das de fora. */
function opuntia(seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], raquetes: { x: number; y: number; a: number; len: number; w: number; z: number; ponta: boolean }[] = [];
  const crescer = (x: number, y: number, a: number, nivel: number): void => {
    const len = 0.2 - nivel * 0.025 + r() * 0.04, w = len * (0.4 + r() * 0.45), cx = x + Math.cos(a) * len * 0.9, cy = y + Math.sin(a) * len * 0.9, filhos = nivel >= 2 ? 0 : 1 + Math.floor(r() * 2);
    raquetes.push({ x: cx, y: cy, a, len, w, z: 0.6 + nivel * 0.35 + r() * 0.05, ponta: filhos === 0 });
    for (let i = 0; i < filhos; i++) crescer(cx + Math.cos(a) * len * 0.7, cy + Math.sin(a) * len * 0.7, a + (r() - 0.5) * 1.3, nivel + 1);
  };
  const n = 4 + Math.floor(r() * 2), giro = r() * Math.PI * 2;
  for (let i = 0; i < n; i++) crescer(0, 0, giro + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5, 0);
  partes.push(elipse(0, 0, 1.1, 1.1, '#2a2018', 0.05, { ...O, alfa: 0.3, desfoque: 0.15, detalhe: 1 }));
  for (const q of raquetes.sort((a, b) => a.z - b.z)) {
    const f = Math.cos(q.a + Math.PI / 2 - LUZ_A) * 0.3 + (q.w / q.len) * 0.4;
    partes.push(poli(oval(q.x, q.y, q.len + 0.02, q.w + 0.02, q.a), '#101a0e', q.z, { contorno: false, sombraLeve: true, detalhe: 1 }));
    partes.push(poli(oval(q.x, q.y, q.len, q.w, q.a), misturar('#3e6436', '#5e8a4c', 0.3 + f), q.z + 0.005, { ...O, detalhe: 1 }));
    partes.push(poli(oval(q.x + LUZ_X * q.w * 0.18, q.y + LUZ_Y * q.w * 0.18, q.len * 0.72, q.w * 0.55, q.a), misturar('#6e9a58', '#94bc78', f), q.z + 0.01, { ...O, alfa: 0.85, detalhe: 2 }));
    const c = Math.cos(q.a), s = Math.sin(q.a);
    for (let i = 0; i < 7; i++) { const u = (r() - 0.5) * q.len * 1.5, v = (r() - 0.5) * q.w * 1.3; partes.push(elipse(q.x + u * c - v * s, q.y + u * s + v * c, 0.025, 0.025, '#e2d8a6', q.z + 0.015, { ...O, detalhe: 3 })); }
    if (q.ponta) for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
      const b = q.a + (r() - 0.5) * 1.4, fx = q.x + Math.cos(b) * q.len * 0.95, fy = q.y + Math.sin(b) * q.w * 0.95 * (Math.abs(Math.sin(b - q.a)) + 0.4);
      partes.push(elipse(fx, fy, 0.075, 0.075, '#1c0a0c', q.z + 0.02, { contorno: false, sombraLeve: true, detalhe: 2 }), elipse(fx, fy, 0.06, 0.06, '#a8283a', q.z + 0.021, { ...O, detalhe: 2 }), elipse(fx - 0.008, fy - 0.008, 0.025, 0.025, '#e0607a', q.z + 0.022, { ...O, detalhe: 3 }));
    }
  }
  return { tipo: 'piso', pegada: [2, 2], partes };
}

/** Cacto redondo (de barril): muitas costelas, espinhos dourados densos e uma coroa de flores amarelas; em grupo, três de tamanhos diferentes. */
function cactoRedondo(seed: number, grupo: boolean): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], cores = ['#2a3a1c', '#4e6a32', '#7e9a50', '#aac078'] as const;
  const barril = (x: number, y: number, R: number, z: number) => {
    partes.push(elipse(x, y, R * 2.6, R * 2.6, '#2a2018', 0.05, { ...O, alfa: 0.3, desfoque: R * 0.3, detalhe: 1 }));
    colunaDeCacto(partes, r, x, y, R, 20, z, cores, '#e8c060', 4);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + r() * 0.4, fx = x + Math.cos(a) * R * 0.22, fy = y + Math.sin(a) * R * 0.22;
      for (let p = 0; p < 5; p++) partes.push(lente(fx, fy, (p / 5) * Math.PI * 2 + a, R * 0.13, R * 0.08, p % 2 ? '#f0c030' : '#e8a428', z + 0.04, { ...O, detalhe: 3 }));
      partes.push(elipse(fx, fy, R * 0.06, R * 0.06, '#c0601e', z + 0.045, { ...O, detalhe: 3 }));
    }
  };
  if (grupo) { barril(-0.22, 0.12, 0.3, 0.8); barril(0.36, -0.12, 0.22, 0.6); barril(0.02, -0.42, 0.15, 0.45); }
  else barril(0, 0, 0.34, 0.8);
  return { tipo: 'piso', pegada: grupo ? [1.4, 1.4] : [0.8, 0.8], partes };
}

// ---------- Copas de raminhos com cor própria ----------

const SELVA: Tons = { fundo: '#0b2214', base: '#1b4628', meio: '#275e32', luz: '#3a7a3a', brilho: '#5e9c4c' };
const SELVA_SOL: Tons = { fundo: '#1c2c10', base: '#38561e', meio: '#4c7026', luz: '#66902e', brilho: '#88ae44' };
const SELVA_AZUL: Tons = { fundo: '#0a2020', base: '#174438', meio: '#225a46', luz: '#317458', brilho: '#4c926e' };
const CEREJA: Tons = { fundo: '#4a2232', base: '#a65a74', meio: '#c87c96', luz: '#e6a6ba', brilho: '#fad4e0' };
const CEREJA_BRANCA: Tons = { fundo: '#4a3038', base: '#bc8c9a', meio: '#dcb0bc', luz: '#f0d0d8', brilho: '#fff0f4' };
const CEREJA_FUNDA: Tons = { fundo: '#3e1426', base: '#8c3c5c', meio: '#ac587a', luz: '#c87a98', brilho: '#e4a2ba' };
const CEREJA_VERDE: Tons = { fundo: '#1e2a16', base: '#3e5a2c', meio: '#527238', luz: '#6c8c46', brilho: '#8aa85a' };
const MANGUE: Tons = { fundo: '#0c2016', base: '#1c4230', meio: '#28583a', luz: '#387044', brilho: '#548c54' };
const BAOBA: Tons = { fundo: '#1e2612', base: '#3c4a24', meio: '#4e5e2e', luz: '#66763a', brilho: '#82904a' };

/**
 * Árvore de selva: a copa de raminhos em verde fundo e úmido, com rosetas de folhas largas e lustrosas por cima (a nervura clara) e
 * cipós que caem pela borda, com folhinhas.
 */
function arvoreDeSelva(D: number, seed: number): DescricaoDePiso {
  const folha = Math.min(1.15, 0.7 + D * 0.06), base = copaDeRaminhos(D, seed, { tons: SELVA, variantes: [SELVA_SOL, SELVA_AZUL], folha, ralo: 0.1, nanquim: ['#06120a', '#0e1c10'], galhos: '#3a2e20' });
  const r = mulberry32(seed + 7), partes = base.partes, R = D / 2 - 0.3 * folha;
  // Cipós: fitas que saem do miolo, passam pela borda e voltam, como se pendessem.
  const nC = 3 + Math.round(D * 0.6);
  for (let i = 0; i < nC; i++) {
    const a = (i / nC) * Math.PI * 2 + r() * 0.6, a2 = a + (r() - 0.5) * 0.9, d0 = R * (0.35 + r() * 0.2), d1 = R * (0.96 + r() * 0.06), lado = r() < 0.5 ? -1 : 1, pts: number[] = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10, b = a + (a2 - a) * t + Math.sin(t * Math.PI * 2) * 0.08 * lado, d = d0 + (d1 - d0) * Math.sin(t * Math.PI / 2); pts.push(Math.cos(b) * d, Math.sin(b) * d); }
    partes.push(tira(pts, 0.09, '#0a1208', 2.72, { ...O, detalhe: 1 }, 0.5), tira(pts, 0.05, '#5c6a2e', 2.725, { ...O, detalhe: 2 }, 0.5));
    for (let k = 2; k < 11; k += 1) { const x = pts[k * 2]!, y = pts[k * 2 + 1]!, b = Math.atan2(y, x) + (k % 2 ? 1.2 : -1.2); partes.push(lente(x, y, b, 0.16, 0.08, k % 3 ? '#4e7a2e' : '#6c9a3a', 2.73, { ...O, detalhe: 3 })); }
  }
  // Rosetas de folhas largas por cima.
  const nR = Math.round(D * 1.3);
  for (let i = 0; i < nR; i++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.75, x = Math.cos(a) * d, y = Math.sin(a) * d, n = 3 + Math.floor(r() * 3), giro = r() * Math.PI * 2, len = (0.42 + r() * 0.25) * folha;
    const lado = (x * LUZ_X + y * LUZ_Y) / R;
    for (let k = 0; k < n; k++) {
      const b = giro + (k - (n - 1) / 2) * (0.7 + r() * 0.5), f = Math.cos(b - LUZ_A), cor = naEscala(SELVA, 1.8 + lado * 0.8 + f * 0.5 + (r() - 0.5) * 0.5);
      partes.push(lente(x, y, b, len + 0.05, len * 0.46 + 0.06, '#06120a', 2.8 + i * 0.002, { ...O, detalhe: 1 }));
      partes.push(lente(x, y, b, len, len * 0.44, cor, 2.805 + i * 0.002, { ...O, detalhe: 1 }));
      partes.push(lente(x, y, b, len * 0.9, len * 0.04, tom(cor, 0.35), 2.806 + i * 0.002, { ...O, alfa: 0.8, detalhe: 3 }));
    }
  }
  return base;
}

/** Cerejeira: copa de raminhos rosa (moitas mais brancas e mais fundas), galhos escuros à mostra; `rala` deixa ver folhas verdes e o vão entre as moitas. */
function cerejeira(D: number, seed: number, rala: boolean): DescricaoDePiso {
  return copaDeRaminhos(D, seed, { tons: CEREJA, variantes: rala ? [CEREJA_VERDE, CEREJA_BRANCA] : [CEREJA_BRANCA, CEREJA_FUNDA], folha: Math.min(0.8, 0.4 + D * 0.07), ralo: rala ? 0.6 : 0.15, nanquim: ['#24101a', '#341824'], galhos: '#2e1e1c' });
}

/** Árvore de mangue: copa de verde escuro e lustroso, menor que a pegada, e raízes aéreas em arco que saem de baixo dela e entram na água. */
function arvoreDeMangue(D: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], dc = D * 0.72, nR = 14 + Math.floor(D * 1.5);
  for (let i = 0; i < nR; i++) {
    const a = (i / nR) * Math.PI * 2 + (r() - 0.5) * 0.35, d0 = D * 0.08, d1 = D * (0.36 + r() * 0.11), lado = (r() - 0.5) * 0.5, pts: number[] = [];
    for (let k = 0; k <= 8; k++) { const t = k / 8, b = a + lado * Math.sin(t * Math.PI), d = d0 + (d1 - d0) * t; pts.push(Math.cos(b) * d, Math.sin(b) * d); }
    const w = 0.09 + r() * 0.05, z = 0.6 + r() * 0.3, f = Math.cos(a - LUZ_A);
    const ex = pts[16]!, ey = pts[17]!;
    partes.push(elipse(ex, ey, 0.32, 0.22, '#0a1410', 0.1, { ...O, alfa: 0.45, desfoque: 0.06, detalhe: 2 }));
    partes.push(tira(pts, w + 0.05, '#120e0a', z, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.55), tira(pts, w, tom('#5a4a3a', f * 0.12), z + 0.005, { ...O, detalhe: 1 }, 0.55));
    partes.push(tira(pts.map((v, j) => v + (j % 2 ? LUZ_Y : LUZ_X) * w * 0.25), w * 0.35, '#8e7a62', z + 0.01, { ...O, alfa: 0.85, detalhe: 2 }, 0.5));
    if (r() < 0.45) {   // uma raiz que se divide no meio
      const t0 = 4, b = a + (r() < 0.5 ? -1 : 1) * (0.3 + r() * 0.2), d2 = d1 * (0.9 + r() * 0.1), filho = [pts[t0 * 2]!, pts[t0 * 2 + 1]!, Math.cos(b) * (d0 + d2) / 2 * 1.2, Math.sin(b) * (d0 + d2) / 2 * 1.2, Math.cos(b) * d2, Math.sin(b) * d2];
      partes.push(tira(filho, w * 0.8 + 0.04, '#120e0a', z - 0.05, { contorno: false, sombraLeve: true, detalhe: 2 }, 0.5), tira(filho, w * 0.8, '#4e4032', z - 0.045, { ...O, detalhe: 2 }, 0.5));
      partes.push(elipse(filho[4]!, filho[5]!, 0.26, 0.18, '#0a1410', 0.1, { ...O, alfa: 0.4, desfoque: 0.05, detalhe: 3 }));
    }
  }
  partes.push(...copaDeRaminhos(dc, seed + 3, { tons: MANGUE, variantes: [SELVA_SOL, SELVA_AZUL], folha: 0.55, ralo: 0.1, nanquim: ['#06120a', '#0c1a10'], galhos: '#3e3224' }).partes);
  return { tipo: 'piso', pegada: [D, D], partes };
}

/** Baobá: galhos grossos e curtos em leque saindo do tronco largo, com moitas ralas só nas pontas: a silhueta de galhos à mostra. */
function baoba(D: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], R = D / 2;
  partes.push(elipse(0, 0, D * 0.32, D * 0.32, '#1a1410', 1.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(LUZ_X * 0.06, LUZ_Y * 0.06, D * 0.29, D * 0.29, '#64544a', 1.31, { ...O, detalhe: 1 }));
  for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; partes.push(lente(Math.cos(a) * D * 0.05, Math.sin(a) * D * 0.05, a, D * 0.1, D * 0.03, Math.cos(a - LUZ_A) > 0 ? '#7e6c5a' : '#463a30', 1.32, { ...O, detalhe: 3 })); }
  const pontas: { x: number; y: number }[] = [], nG = 6 + Math.floor(r() * 3), giro = r() * Math.PI * 2;
  const galho = (pts: number[], w: number, z: number) => {
    partes.push(tira(pts, w + 0.08, '#120e0a', z, { contorno: false, sombraLeve: true, detalhe: 1 }, 0.35), tira(pts, w, '#54463c', z + 0.005, { ...O, detalhe: 1 }, 0.35));
    partes.push(tira(pts.map((v, j) => v + (j % 2 ? LUZ_Y : LUZ_X) * w * 0.22), w * 0.4, '#7e6c5a', z + 0.01, { ...O, alfa: 0.8, detalhe: 2 }, 0.3));
  };
  for (let i = 0; i < nG; i++) {
    const a = giro + (i / nG) * Math.PI * 2 + (r() - 0.5) * 0.4, len = R * (0.5 + r() * 0.12), mx = Math.cos(a) * len, my = Math.sin(a) * len;
    galho([Math.cos(a) * D * 0.1, Math.sin(a) * D * 0.1, Math.cos(a + 0.08) * len * 0.6, Math.sin(a + 0.08) * len * 0.6, mx, my], 0.42, 1.5 + i * 0.01);
    const filhos = 2 + Math.floor(r() * 2);
    for (let k = 0; k < filhos; k++) {
      const b = a + (k - (filhos - 1) / 2) * 0.55 + (r() - 0.5) * 0.2, l2 = R * (0.22 + r() * 0.12), ex = mx + Math.cos(b) * l2, ey = my + Math.sin(b) * l2;
      galho([mx, my, (mx + ex) / 2 + (r() - 0.5) * 0.2, (my + ey) / 2 + (r() - 0.5) * 0.2, ex, ey], 0.2, 1.55 + i * 0.01 + k * 0.002);
      pontas.push({ x: ex, y: ey });
    }
  }
  // Moitas ralas nas pontas, menores perto da borda da pegada.
  pontas.forEach((p, i) => {
    const d = Math.hypot(p.x, p.y), dm = Math.max(1.1, Math.min(2.1, (R - d) * 2.4 + 0.6)), k = Math.min(1, (R - 0.15) / (d + dm / 2));
    partes.push(...mover(copaDeRaminhos(dm, seed + 11 + i, { tons: BAOBA, variantes: [SELVA_SOL, CEREJA_VERDE], folha: 0.42, ralo: 0.35, galhos: '#5a4a3c' }).partes, p.x * k, p.y * k));
  });
  return { tipo: 'piso', pegada: [D, D], partes };
}

/** Bambuzal visto de cima: colmos em arco saindo da touceira (com nós), feixes de folhas estreitas nas pontas e os topos dos colmos no meio. */
function bambuzal(D: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [], R = D / 2, cores = ['#24361a', '#3e5e26', '#5a7e30', '#7ea03e', '#a6c060'];
  partes.push(elipse(0, 0, D * 0.7, D * 0.7, '#0c1408', 1, { ...O, alfa: 0.7, desfoque: D * 0.08, detalhe: 1 }));
  const nC = Math.round(10 + D * 5), feixes: { x: number; y: number; a: number; z: number }[] = [];
  for (let i = 0; i < nC; i++) {
    const a = r() * Math.PI * 2, d0 = Math.sqrt(r()) * R * 0.18, x0 = Math.cos(a) * d0, y0 = Math.sin(a) * d0, len = R * (0.4 + r() * 0.25), z = 1.2 + r() * 0.8;
    const pts = [x0, y0, x0 + Math.cos(a + 0.05) * len * 0.5, y0 + Math.sin(a + 0.05) * len * 0.5, x0 + Math.cos(a + 0.12) * len, y0 + Math.sin(a + 0.12) * len], w = 0.035 + D * 0.008;
    partes.push(tira(pts, w + 0.025, '#10180a', z, { ...O, detalhe: 1 }, 0.6), tira(pts, w, i % 3 ? '#7e8a3a' : '#9a9a48', z + 0.002, { ...O, detalhe: 2 }, 0.6));
    for (let k = 1; k < 5; k++) { const t = k / 5, nx = x0 + Math.cos(a + 0.06) * len * t, ny = y0 + Math.sin(a + 0.06) * len * t; partes.push(lente(nx - Math.sin(a) * w, ny + Math.cos(a) * w, a - Math.PI / 2, w * 2, w * 0.5, '#3a4220', z + 0.003, { ...O, detalhe: 3 })); }
    for (let k = 0; k < 3; k++) { const t = 0.45 + k * 0.25 + r() * 0.1; feixes.push({ x: x0 + Math.cos(a + 0.08) * len * t, y: y0 + Math.sin(a + 0.08) * len * t, a: a + (r() - 0.5) * 0.8, z: z + 0.1 + k * 0.05 }); }
  }
  for (const f of feixes.sort((a, b) => a.z - b.z)) {
    const n = 6 + Math.floor(r() * 4), lado = (f.x * LUZ_X + f.y * LUZ_Y) / R, folhas: { a: number; len: number; cor: string }[] = [];
    for (let k = 0; k < n; k++) { const a = f.a + (k / (n - 1) - 0.5) * 1.8 + (r() - 0.5) * 0.2, len = (0.24 + r() * 0.12) * Math.min(1.3, 0.7 + D * 0.12), fl = Math.cos(a - LUZ_A); folhas.push({ a, len, cor: misturar(cores[1]!, cores[4]!, Math.max(0, Math.min(1, 0.45 + lado * 0.35 + fl * 0.2 + (f.z - 1.6) * 0.4 + (r() - 0.5) * 0.25))) }); }
    for (const q of folhas) partes.push(lente(f.x, f.y, q.a, q.len + 0.03, q.len * 0.2 + 0.03, '#0c1408', f.z, { contorno: false, sombraLeve: true, detalhe: 1 }));
    for (const q of folhas) partes.push(lente(f.x, f.y, q.a, q.len, q.len * 0.18, q.cor, f.z + 0.005, { ...O, detalhe: 2 }));
  }
  for (let i = 0; i < 8 + D * 3; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * R * 0.2, x = Math.cos(a) * d, y = Math.sin(a) * d, rc = 0.04 + D * 0.01; partes.push(elipse(x, y, rc * 2.4, rc * 2.4, '#10180a', 2.6, { ...O, detalhe: 2 }), elipse(x, y, rc * 2, rc * 2, '#8a9a46', 2.61, { ...O, detalhe: 2 }), elipse(x, y, rc * 1.2, rc * 1.2, '#c0c070', 2.62, { ...O, detalhe: 3 })); }
  return { tipo: 'piso', pegada: [D, D], partes };
}

const T = (nome: string, sufixo: string, params: Record<string, unknown>, seed: number) => ({ nome, sufixo, params, seed });

export const PLANTAS_DOS_BIOMAS: GeradorPesado[] = [
  { id: 'arvore-de-selva', altura: ([w]) => w * 1.8, nome: 'Árvore de selva', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior', 'selva', 'tropical', 'cipo'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [T('5 m', '5m', { diametro: 5 }, 121), T('8 m', '8m', { diametro: 8 }, 122)], gerar: p => arvoreDeSelva(num(p.params.diametro, 6, 3, 12), p.seed) },
  { id: 'coqueiro', altura: ([w]) => w * 1.5, nome: 'Coqueiro', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'palmeira', 'coqueiro', 'praia', 'tropical', 'exterior'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [T('4 m', '4m', { diametro: 4 }, 131), T('6 m', '6m', { diametro: 6 }, 132)], gerar: p => coqueiro(num(p.params.diametro, 5, 3, 8), p.seed) },
  { id: 'tamareira', altura: ([w]) => w * 1.3, nome: 'Tamareira', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'palmeira', 'tamareira', 'oasis', 'deserto', 'exterior'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [T('5 m', '5m', { diametro: 5 }, 141)], gerar: p => tamareira(num(p.params.diametro, 5, 3, 8), p.seed) },
  { id: 'saguaro', altura: () => 3, nome: 'Cacto saguaro', categoria: 'exterior', funcoes: ['jardim'], tags: ['cacto', 'saguaro', 'deserto', 'planta', 'exterior'], generos: [], kit: 'mata', versao: 1, res: 96,
    variantes: [T('dois braços', 'a', { bracos: 2 }, 151), T('três braços', 'b', { bracos: 3 }, 152)], gerar: p => saguaro(p.seed, Math.round(num(p.params.bracos, 2, 1, 4))) },
  { id: 'opuntia', altura: () => 1.5, nome: 'Palma (opuntia)', categoria: 'exterior', funcoes: ['jardim'], tags: ['cacto', 'palma', 'opuntia', 'deserto', 'planta', 'exterior'], generos: [], kit: 'mata', versao: 1, res: 96,
    variantes: [T('a', 'a', {}, 161), T('b', 'b', {}, 162)], gerar: p => opuntia(p.seed) },
  { id: 'cacto-redondo', altura: ([w]) => (w > 1 ? 0.7 : 0.8), nome: 'Cacto redondo', categoria: 'exterior', funcoes: ['jardim'], tags: ['cacto', 'barril', 'deserto', 'planta', 'exterior', 'flor'], generos: [], kit: 'mata', versao: 1, res: 128,
    variantes: [T('um', 'um', { diametro: 0.8 }, 171), T('grupo', 'grupo', { diametro: 1.4 }, 172)], gerar: p => cactoRedondo(p.seed, num(p.params.diametro, 0.8, 0.5, 2) > 1) },
  { id: 'cerejeira', altura: ([w]) => w * 1.3, nome: 'Cerejeira', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'cerejeira', 'sakura', 'flor', 'rosa', 'planta', 'copa', 'exterior', 'oriental'], generos: [], kit: 'exterior', versao: 1, res: 64,
    variantes: [T('4 m', '4m', { diametro: 4 }, 181), T('6 m', '6m', { diametro: 6 }, 182), T('5 m, perdendo as flores', '5m-rala', { diametro: 5, rala: true }, 183)], gerar: p => cerejeira(num(p.params.diametro, 5, 2, 10), p.seed, p.params.rala === true) },
  { id: 'bambuzal', altura: ([w]) => w * 2, nome: 'Bambuzal', categoria: 'exterior', funcoes: ['jardim'], tags: ['bambu', 'bambuzal', 'touceira', 'planta', 'exterior', 'oriental', 'tropical'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [T('2 m', '2m', { diametro: 2 }, 191), T('4 m', '4m', { diametro: 4 }, 192)], gerar: p => bambuzal(num(p.params.diametro, 3, 1, 6), p.seed) },
  { id: 'arvore-de-mangue', altura: ([w]) => w * 1.1, nome: 'Árvore de mangue', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'mangue', 'raizes', 'pantano', 'tropical', 'praia', 'exterior'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [T('4 m', '4m', { diametro: 4 }, 201), T('6 m', '6m', { diametro: 6 }, 202)], gerar: p => arvoreDeMangue(num(p.params.diametro, 5, 3, 9), p.seed) },
  { id: 'baoba', altura: () => 7, nome: 'Baobá', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'baoba', 'savana', 'deserto', 'tropical', 'exterior'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [T('7 m', '7m', { diametro: 7 }, 211)], gerar: p => baoba(num(p.params.diametro, 7, 4, 10), p.seed) },
];
