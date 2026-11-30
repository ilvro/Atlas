import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, parede, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { ID, MADEIRA, O, S, anel, arco, bloco, disco, em, estofado, olhar, quadro, retQ, retR, tomDaFace, type Quadro, type Tons } from './antiguidade.ts';
import { LATAO, PRATA } from './deserto.ts';
import { cranio } from './caverna.ts';

// Faroeste (Q18): saloon e cidade (Q18a), rua e estrada de ferro (Q18b). Mogno envernizado do saloon, pinho cinzento de tábua velha,
// ferro preto com latão, feltro verde, lona crua. As regras do acervo: nanquim por baixo da silhueta, volume em degraus de tom para o
// noroeste, `z` das partes até 1,5 m e a `altura` real na receita (a sombra do sol estica o desenho inteiro na direção do sol).

const MOGNO: Tons = { nanquim: '#140806', sombra: '#3e1a10', base: '#5e2818', meio: '#723420', luz: '#8e472c', brilho: '#b87452' };
const PINHO: Tons = { nanquim: '#241c12', sombra: '#5e5040', base: '#7c6c54', meio: '#8e7e64', luz: '#a49478', brilho: '#c4b496' };
const FERRO: Tons = { nanquim: '#060606', sombra: '#16171a', base: '#24262a', meio: '#303338', luz: '#464a50', brilho: '#7a8088' };
const FELTRO = '#2e5a3a', LONA = '#ddd4ba', PAPEL = '#e2d2a8', TINTA = '#1a1410', CORDA = '#a8946a';
const tonsDe = (cor: string): Tons => ({ nanquim: tom(cor, -0.78), sombra: tom(cor, -0.42), base: cor, meio: tom(cor, 0.1), luz: tom(cor, 0.24), brilho: tom(cor, 0.5) });

/** Tábuas no referencial `f` (`w` ao longo das tábuas): o fundo, as juntas e os nós. */
function tabuado(partes: Parte[], r: () => number, f: Quadro, w: number, h: number, t: Tons, z: number, larg = 0.16): void {
  partes.push(poli(retQ(f, 0, 0, w, h), t.base, z, { ...O, detalhe: 1 }));
  for (let v = -h / 2 + larg; v < h / 2 - 0.02; v += larg) partes.push(tira(em(f, [-w / 2, v, w / 2, v]), 0.012, t.nanquim, z + 0.002, { ...O, alfa: 0.55, detalhe: 3 }));
  for (let v = -h / 2 + larg / 2, k = 0; v < h / 2; v += larg, k++) if (k % 2) partes.push(poli(retQ(f, (r() - 0.5) * w * 0.4, v, w * (0.3 + r() * 0.4), larg * 0.7), tom(t.base, (r() - 0.5) * 0.14), z + 0.001, { ...S, alfa: 0.6, detalhe: 3 }));
  for (let k = 0; k < Math.ceil(w * h * 3); k++) partes.push(elipse(...f((r() - 0.5) * w * 0.9, (r() - 0.5) * h * 0.9), 0.03, 0.02, t.sombra, z + 0.003, { ...O, alfa: 0.6, detalhe: 3 }));
}

/** Roda vista de cima (a banda de ferro ao longo de u), com o cubo saindo para fora (lado `s` de v). */
export function roda(partes: Parte[], f: Quadro, u: number, v: number, D: number, w: number, z: number, s: number, cor = '#6a2a1a'): void {
  partes.push(tira(em(f, [u - D / 2, v, u + D / 2, v]), w + 0.03, FERRO.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, 0.6));
  partes.push(tira(em(f, [u - D / 2 + 0.03, v, u + D / 2 - 0.03, v]), w * 0.7, cor, z + 0.003, { ...O, detalhe: 2 }, 0.7));
  partes.push(tira(em(f, [u - D / 2 + 0.06, v - w * 0.15, u + D / 2 - 0.06, v - w * 0.15]), w * 0.18, tom(cor, 0.35), z + 0.005, { ...O, alfa: 0.7, detalhe: 3 }, 0.5));
  const [hx, hy] = f(u, v + s * w * 0.7); partes.push(elipse(hx, hy, 0.12, 0.12, FERRO.base, z + 0.006, { contorno: 'leve', detalhe: 2 }), elipse(hx, hy, 0.05, 0.05, FERRO.brilho, z + 0.008, { ...O, detalhe: 3 }));
}

/** Garrafa vista de cima: o ombro de vidro escuro, o gargalo, a rolha e o brilho. */
function garrafa(partes: Parte[], x: number, y: number, R: number, cor: string, z: number): void {
  partes.push(elipse(x + 0.004, y + 0.005, R * 2 + 0.012, R * 2 + 0.012, tom(cor, -0.7), z, { contorno: false, semSombra: true, detalhe: 2 }), elipse(x, y, R * 2, R * 2, cor, z + 0.001, { ...O, vidro: true, detalhe: 2 }));
  partes.push(elipse(x, y, R * 0.8, R * 0.8, tom(cor, -0.3), z + 0.003, { ...O, detalhe: 3 }), elipse(x, y, R * 0.5, R * 0.5, '#b89a6a', z + 0.004, { ...O, detalhe: 3 }), elipse(x + LUZ_X * R * 0.45, y + LUZ_Y * R * 0.45, R * 0.5, R * 0.35, '#f0f0e8', z + 0.005, { ...S, alfa: 0.55, detalhe: 3 }));
}

/** Copo de dose com uísque. */
function copo(partes: Parte[], x: number, y: number, z: number, cheio = true): void {
  partes.push(elipse(x, y, 0.07, 0.07, '#3a3a3a', z, { contorno: false, semSombra: true, detalhe: 3 }), elipse(x, y, 0.06, 0.06, '#c8d0d0', z + 0.001, { ...O, vidro: true, alfa: 0.7, detalhe: 3 }));
  if (cheio) partes.push(elipse(x, y, 0.04, 0.04, '#9a5a14', z + 0.002, { ...O, detalhe: 3 }));
  partes.push(elipse(x + LUZ_X * 0.015, y + LUZ_Y * 0.015, 0.02, 0.014, '#ffffff', z + 0.003, { ...S, alfa: 0.6, detalhe: 3 }));
}

// ---------- Saloon e cidade (Q18a) ----------

const VIDROS = ['#4a2a10', '#2a4a24', '#6a4a1a', '#3a1a14', '#8a8a7a', '#1e3a3a'];

/** Balcão de saloon: o balcão de mogno com o tampo envernizado, a barra de latão para os pés (+y), copos, garrafa e a caixa registradora; atrás (−y), o corredor do barman e a prateleira de garrafas. */
function balcaoDeSaloon(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], D = 1.9, vb = -D / 2 + 0.24, vc = D / 2 - 0.42;
  sombraNoChao(partes, [-C / 2, -D / 2, C / 2, -D / 2, C / 2, D / 2 - 0.1, -C / 2, D / 2 - 0.1], 0.01, '#0d0a08', 0.35);
  // A prateleira de trás, com fileiras de garrafas.
  bloco(partes, quadro(0, vb), C, 0.42, MOGNO, 1.2, 0.04);
  for (const v of [vb - 0.09, vb + 0.09]) for (let u = -C / 2 + 0.12; u < C / 2 - 0.08; u += 0.13 + r() * 0.05) if (r() < 0.85) garrafa(partes, u, v + (r() - 0.5) * 0.02, 0.04, VIDROS[Math.floor(r() * VIDROS.length)]!, 1.25);
  // O balcão.
  bloco(partes, quadro(0, vc), C, 0.62, MOGNO, 1.05, 0.05);
  partes.push(lente(-C / 2 + 0.2, vc - 0.1, 0, C - 0.4, 0.12, MOGNO.brilho, 1.11, { ...S, alfa: 0.35, detalhe: 2 }));
  partes.push(tira([-C / 2 + 0.05, vc + 0.36, C / 2 - 0.05, vc + 0.36], 0.05, LATAO.nanquim, 0.15, { contorno: 'leve', detalhe: 2 }), tira([-C / 2 + 0.05, vc + 0.355, C / 2 - 0.05, vc + 0.355], 0.026, LATAO.luz, 0.152, { ...O, detalhe: 3 }));
  for (let u = -C / 2 + 0.3; u < C / 2 - 0.2; u += 1.0) partes.push(elipse(u, vc + 0.34, 0.06, 0.06, LATAO.base, 0.16, { contorno: 'leve', detalhe: 3 }));
  // Em cima: a registradora numa ponta, copos e uma garrafa.
  const ru = (r() < 0.5 ? -1 : 1) * (C / 2 - 0.35);
  bloco(partes, quadro(ru, vc), 0.42, 0.36, LATAO, 1.3, 0.04);
  for (let k = 0; k < 8; k++) partes.push(elipse(ru - 0.15 + (k % 4) * 0.1, vc + 0.06 + Math.floor(k / 4) * 0.07, 0.04, 0.04, '#e8e0cc', 1.35, { contorno: 'leve', detalhe: 3 }));
  partes.push(ret(ru, vc - 0.11, 0.3, 0.06, '#e8e0cc', 1.35, { contorno: 'leve', detalhe: 3 }));
  for (let k = 0; k < 4 + Math.floor(r() * 4); k++) copo(partes, -C / 2 + 0.5 + r() * (C - 1.3), vc + (r() - 0.5) * 0.3, 1.12, r() < 0.7);
  garrafa(partes, (r() - 0.5) * C * 0.5, vc - 0.08, 0.045, VIDROS[Math.floor(r() * 3)]!, 1.14);
  return partes;
}

/** Piano de armário: a caixa de nogueira com a tampa e os castiçais, a partitura, o teclado saindo na frente (+y) e o banco. */
function pianoDeArmario(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.5, vc = -0.25, D = 0.6, NOGUEIRA: Tons = { ...MOGNO, base: '#4a2c1a', meio: '#5a3822', luz: '#70482e', brilho: '#9a7050' };
  sombraNoChao(partes, [-W / 2, -0.55, W / 2, -0.55, W / 2, 0.62, -W / 2, 0.62], 0.01, '#0d0a08', 0.4);
  // O banco.
  bloco(partes, quadro(0, 0.42), 0.9, 0.36, NOGUEIRA, 0.5, 0.04);
  partes.push(poli(retR(ID, 0, 0.42, 0.78, 0.26, 0.04), '#5a1e1e', 0.545, { ...O, detalhe: 2 }), poli(retR(ID, -0.03, 0.4, 0.6, 0.12, 0.04), '#7a3030', 0.547, { ...S, alfa: 0.6, detalhe: 3 }));
  // O teclado: teclas brancas e pretas em grupos de 2 e 3.
  const vt = vc + D / 2 + 0.11;
  partes.push(poli(retQ(ID, 0, vt, W - 0.1, 0.24), NOGUEIRA.nanquim, 0.75, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, 0, vt + 0.02, W - 0.24, 0.17), '#e8e0cc', 0.752, { ...O, detalhe: 2 }));
  const n = 36, kw = (W - 0.24) / n;
  for (let k = 0; k <= n; k++) partes.push(tira([-W / 2 + 0.12 + k * kw, vt - 0.065, -W / 2 + 0.12 + k * kw, vt + 0.105], 0.003, '#8a8478', 0.754, { ...O, detalhe: 3 }));
  for (let k = 0; k < n - 1; k++) if ([0, 1, 3, 4, 5].includes(k % 7)) partes.push(ret(-W / 2 + 0.12 + (k + 1) * kw, vt - 0.02, kw * 0.6, 0.1, TINTA, 0.756, { ...O, detalhe: 3 }));
  for (const s of [-1, 1]) partes.push(ret(s * (W / 2 - 0.08), vt, 0.08, 0.24, NOGUEIRA.base, 0.76, { contorno: 'leve', detalhe: 2 }));
  // A caixa e a tampa.
  bloco(partes, quadro(0, vc), W, D, NOGUEIRA, 1.25, 0.05);
  partes.push(tira(em(ID, [-W / 2 + 0.12, vc - D / 2 + 0.1, W / 2 - 0.12, vc - D / 2 + 0.1]), 0.01, NOGUEIRA.nanquim, 1.31, { ...O, alfa: 0.6, detalhe: 3 }));
  for (const s of [-1, 1]) { const x = s * (W / 2 - 0.16); disco(partes, x, vc + 0.12, 0.05, LATAO, 1.32); partes.push(elipse(x, vc + 0.12, 0.03, 0.03, '#e8e0c8', 1.38, { contorno: 'leve', detalhe: 3 })); }
  if (r() < 0.8) { const f = quadro(-0.2 + r() * 0.3, vc + 0.02, (r() - 0.5) * 0.3); partes.push(poli(retQ(f, 0, 0, 0.32, 0.24), '#d8ccaa', 1.33, { contorno: 'leve', detalhe: 2 })); for (let k = 0; k < 5; k++) partes.push(tira(em(f, [-0.13, -0.09 + k * 0.045, 0.13, -0.09 + k * 0.045]), 0.004, TINTA, 1.335, { ...O, alfa: 0.6, detalhe: 3 })); }
  if (r() < 0.6) copo(partes, 0.42, vc - 0.05, 1.34, r() < 0.5);
  return partes;
}

/** Mesa de pôquer: o tampo redondo de feltro com a borda de madeira, as pilhas de fichas e as cartas de cada jogador, o pote no meio, o baralho, a garrafa e os copos. */
function mesaDePoquer(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.65, z = 0.78;
  sombraNoChao(partes, bolha(0, 0, R, R, 16, 0.02, r), 0.01, '#0d0a08', 0.45);
  partes.push(elipse(0.012, 0.015, R * 2 + 0.05, R * 2 + 0.05, MOGNO.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(0, 0, R * 2, R * 2, MOGNO.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(tira(arco(0, 0, R * 0.94, R * 0.94, Math.PI * 1.05, Math.PI * 1.6, 10), 0.03, MOGNO.brilho, z + 0.004, { ...S, alfa: 0.5, detalhe: 3 }));
  partes.push(elipse(0, 0, R * 1.72, R * 1.72, tom(FELTRO, -0.3), z + 0.005, { ...O, detalhe: 1 }), elipse(LUZ_X * 0.03, LUZ_Y * 0.03, R * 1.62, R * 1.62, FELTRO, z + 0.006, { ...O, detalhe: 1 }));
  const fichas = ['#a8281a', '#e8e0d0', '#24447e', '#1e1a16'], n = 4 + Math.floor(r() * 3);
  for (let j = 0; j < n; j++) {
    const a = (j / n) * 6.28 + r() * 0.3, c = Math.cos(a), s = Math.sin(a);
    // As fichas do jogador, em pilhas.
    for (let k = 0; k < 2 + Math.floor(r() * 2); k++) { const x = c * 0.5 + (-s) * (k - 1) * 0.07, y = s * 0.5 + c * (k - 1) * 0.07, cor = fichas[Math.floor(r() * 4)]!; partes.push(elipse(x + 0.004, y + 0.005, 0.06, 0.06, tom(cor, -0.6), z + 0.02, { contorno: false, semSombra: true, detalhe: 3 }), elipse(x, y, 0.055, 0.055, cor, z + 0.022, { ...O, detalhe: 3 }), tira(anel(x, y, 0.018, 0.018, 8), 0.006, tom(cor, 0.5), z + 0.023, { ...O, alfa: 0.8, detalhe: 3 })); }
    // As cartas: duas viradas, de costas vermelhas, ou a mão aberta em leque.
    const cx = c * 0.32, cy = s * 0.32, aberto = r() < 0.35;
    for (let k = 0; k < (aberto ? 5 : 2); k++) { const ang = a + Math.PI / 2 + (k - (aberto ? 2 : 0.5)) * (aberto ? 0.25 : 0.15), f = quadro(cx, cy, ang); partes.push(poli(retR(f, 0, 0, 0.09, 0.13, 0.01), aberto ? '#f2ede0' : '#8a1e1a', z + 0.025 + k * 0.002, { contorno: 'leve', detalhe: 3 })); if (aberto) partes.push(elipse(...f(0, -0.03), 0.02, 0.02, k % 2 ? '#a8281a' : TINTA, z + 0.026 + k * 0.002, { ...O, detalhe: 3 })); else partes.push(tira(em(f, [-0.03, -0.05, 0.03, 0.05]), 0.006, '#e8c8b0', z + 0.026 + k * 0.002, { ...O, alfa: 0.6, detalhe: 3 })); }
  }
  // O pote: fichas e moedas espalhadas no meio, e o baralho.
  for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.15, cor = k % 4 === 0 ? LATAO.luz : fichas[Math.floor(r() * 4)]!; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.055, 0.055, cor, z + 0.02 + k * 0.001, { contorno: 'leve', detalhe: 3 })); }
  const bf = quadro(0.12, -0.18, r());
  partes.push(poli(retR(bf, 0, 0, 0.09, 0.13, 0.01), '#8a1e1a', z + 0.04, { contorno: 'leve', detalhe: 3 }));
  const ga = r() * 6.28; garrafa(partes, Math.cos(ga) * 0.2, Math.sin(ga) * 0.2, 0.045, VIDROS[Math.floor(r() * 3)]!, z + 0.06);
  for (let k = 0; k < 2; k++) copo(partes, Math.cos(ga + 0.8 + k * 0.5) * 0.25, Math.sin(ga + 0.8 + k * 0.5) * 0.25, z + 0.05, r() < 0.6);
  return partes;
}

/** Porta de vaivém do saloon: os batentes e as duas folhas de venezianas, entreabertas para a rua (+y), com a face das venezianas vista um pouco de frente. */
function portaDeVaivem(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 1.4, F = 0.2, t = PINHO, a = 0.15 + r() * 0.35;
  for (const s of [-1, 1]) {
    const hx = s * L / 2, ang = s < 0 ? a : Math.PI - a, len = L / 2 - 0.04, ex = hx + Math.cos(ang) * len, ey = Math.sin(ang) * len;
    // A face da folha: as venezianas e as bordas recortadas, à frente da tábua do topo.
    const face = [hx, 0, ex, ey, ex, ey + F, hx, F];
    partes.push(poli(face, t.base, 1.2, { contorno: 'leve', detalhe: 1 }));
    for (let k = 1; k < 6; k++) { const q = k / 6; partes.push(tira([hx, F * q, ex, ey + F * q], 0.01, t.nanquim, 1.205, { ...O, alfa: 0.6, detalhe: 3 }), tira([hx, F * q - 0.008, ex, ey + F * q - 0.008], 0.006, t.brilho, 1.206, { ...O, alfa: 0.5, detalhe: 3 })); }
    partes.push(tira([hx, 0, ex, ey], 0.06, t.nanquim, 1.35, { contorno: 'leve', detalhe: 1 }), tira([hx, 0, ex, ey], 0.035, tomDaFace(t, olhar(ang - Math.PI / 2)), 1.355, { ...O, detalhe: 2 }));
    partes.push(elipse(hx, 0, 0.12, 0.12, t.nanquim, 1.4, { contorno: 'leve', detalhe: 2 }), elipse(hx + LUZ_X * 0.01, LUZ_Y * 0.01, 0.08, 0.08, t.luz, 1.402, { ...O, detalhe: 3 }));
  }
  return partes;
}

/** Escarradeira de latão: a boca larga e escura, a aba e a mancha no assoalho; às vezes tombada. */
function escarradeira(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  partes.push(poli(bolha(0.05, 0.06, 0.18, 0.14, 10, 0.3, r), '#3a2410', 0.01, { ...S, alfa: 0.35, detalhe: 2 }));
  if (r() < 0.25) {
    const a = r() * 6.28; partes.push(lente(-Math.cos(a) * 0.12, -Math.sin(a) * 0.12, a, 0.28, 0.2, LATAO.nanquim, 0.12, { contorno: 'leve', detalhe: 1 }), lente(-Math.cos(a) * 0.11, -Math.sin(a) * 0.11, a, 0.25, 0.16, LATAO.base, 0.122, { ...O, detalhe: 2 }));
    partes.push(elipse(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.1, 0.16, LATAO.luz, 0.13, { contorno: 'leve', detalhe: 2 }), elipse(Math.cos(a) * 0.125, Math.sin(a) * 0.125, 0.06, 0.1, '#1a0e06', 0.132, { ...O, detalhe: 3 }));
  } else {
    disco(partes, 0, 0, 0.15, LATAO, 0.2);
    partes.push(tira(anel(0, 0, 0.11, 0.11, 20), 0.02, LATAO.brilho, 0.225, { ...O, alfa: 0.7, detalhe: 3 }), elipse(0, 0, 0.13, 0.13, '#1a0e06', 0.23, { ...O, detalhe: 2 }));
  }
  return partes;
}

/** Cabeça de bisão empalhada no escudo de madeira: na face, o escudo, a lã escura, o focinho, os olhos, os chifres curtos e a barba; de cima, a corcova de lã saindo da parede, o focinho e os chifres. */
function cabecaDeBufalo(seed: number): { face: Parte[]; topo: Parte[] } {
  const r = mulberry32(seed), face: Parte[] = [], topo: Parte[] = [], LA = '#3a2416', LA2 = '#4e3220', CHIFRE = '#1a1410';
  // A face.
  face.push(poli([-0.32, 2.25, 0.32, 2.25, 0.34, 1.75, 0, 1.45, -0.34, 1.75], MOGNO.base, 0.02, { contorno: 'leve', detalhe: 1 }), poli([-0.27, 2.2, 0.27, 2.2, 0.29, 1.77, 0, 1.52, -0.29, 1.77], MOGNO.luz, 0.025, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) face.push(tira([s * 0.22, 2.1, s * 0.4, 2.15, s * 0.46, 2.3], 0.06, CHIFRE, 0.06, { contorno: 'leve', detalhe: 2 }, 0.4));
  face.push(elipse(0, 1.95, 0.72, 0.58, LA, 0.05, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < 16; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.28; face.push(elipse(Math.cos(a) * d, 1.98 + Math.sin(a) * d * 0.7, 0.12, 0.1, r() < 0.5 ? LA2 : tom(LA, -0.3), 0.055, { ...S, alfa: 0.8, detalhe: 3 })); }
  face.push(elipse(0, 1.62, 0.34, 0.3, LA, 0.06, { contorno: 'leve', detalhe: 2 }), elipse(0, 1.6, 0.24, 0.18, '#1e140c', 0.065, { ...O, detalhe: 2 }));
  for (const s of [-1, 1]) face.push(elipse(s * 0.06, 1.58, 0.05, 0.035, '#0a0604', 0.07, { ...O, detalhe: 3 }), elipse(s * 0.18, 1.82, 0.05, 0.045, '#0a0604', 0.07, { ...O, detalhe: 3 }), elipse(s * 0.17, 1.83, 0.015, 0.015, '#e8e0d0', 0.072, { ...O, detalhe: 3 }));
  face.push(poli(bolha(0, 1.42, 0.12, 0.12, 8, 0.3, r), tom(LA, -0.2), 0.058, { ...S, detalhe: 3 }));
  // De cima: o escudo encostado, a corcova de lã e o focinho saindo, os chifres para os lados.
  topo.push(ret(0, 0.025, 0.66, 0.05, MOGNO.base, 2.0, { contorno: 'leve' }));
  topo.push(elipse(0, 0.25, 0.7, 0.46, LA, 2.1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 12; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.22; topo.push(elipse(Math.cos(a) * d * 1.3, 0.25 + Math.sin(a) * d * 0.8, 0.1, 0.08, r() < 0.5 ? LA2 : tom(LA, 0.15), 2.11, { ...S, alfa: 0.8, detalhe: 3 })); }
  topo.push(elipse(0, 0.5, 0.3, 0.22, '#1e140c', 2.05, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) topo.push(tira([s * 0.24, 0.2, s * 0.4, 0.24, s * 0.46, 0.34], 0.06, CHIFRE, 2.15, { contorno: 'leve', detalhe: 2 }, 0.4));
  return { face, topo };
}

/** Cartaz de procurado: o papel amarelado pregado e torto, o título em letras grossas, o retrato a traço (chapéu e ombros, sem rosto), a recompensa e as linhas de texto. */
function placaDeProcurado(seed: number): { face: Parte[]; topo: Parte[] } {
  const r = mulberry32(seed), face: Parte[] = [], ang = (r() - 0.5) * 0.12, f = quadro(0, 1.6, ang), w = 0.4, h = 0.56;
  face.push(poli(retQ(f, 0.006, -0.008, w + 0.012, h + 0.012), '#3a2a18', 0.02, { ...O, alfa: 0.5, detalhe: 2 }), poli(retQ(f, 0, 0, w, h), PAPEL, 0.025, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < 4; k++) face.push(poli(bolha(...f((r() - 0.5) * w * 0.8, (r() - 0.5) * h * 0.8), 0.06, 0.05, 8, 0.4, r), '#b89a62', 0.026, { ...S, alfa: 0.35, detalhe: 3 }));
  // O título: sete letras grossas a traço.
  for (let k = 0; k < 6; k++) { const u = -0.15 + k * 0.06; face.push(tira(em(f, [u, 0.2, u + 0.01, 0.25, u + 0.03, 0.2, u + 0.04, 0.25]), 0.012, TINTA, 0.03, { ...O, detalhe: 3 })); }
  // O retrato: moldura, a silhueta de chapéu e ombros, e o hachurado.
  face.push(poli(retQ(f, 0, 0.04, 0.2, 0.2), '#d4c296', 0.03, { ...O, detalhe: 2 }), tira(em(f, [-0.1, -0.06, 0.1, -0.06, 0.1, 0.14, -0.1, 0.14, -0.1, -0.06]), 0.006, TINTA, 0.032, { ...O, detalhe: 3 }));
  face.push(poli(em(f, [-0.09, -0.06, -0.07, 0.0, -0.03, 0.02, 0.03, 0.02, 0.07, 0.0, 0.09, -0.06]), '#3a2e22', 0.033, { ...O, detalhe: 3 }), elipse(...f(0, 0.05), 0.07, 0.08, '#8a7a5e', 0.033, { ...O, detalhe: 3 }));
  face.push(poli(em(f, [-0.09, 0.08, 0.09, 0.08, 0.06, 0.1, -0.06, 0.1]), '#2a2018', 0.034, { ...O, detalhe: 3 }), poli(em(f, [-0.04, 0.1, 0.04, 0.1, 0.035, 0.135, -0.035, 0.135]), '#2a2018', 0.034, { ...O, detalhe: 3 }));
  for (let k = 0; k < 5; k++) face.push(tira(em(f, [-0.08 + k * 0.03, -0.05, -0.06 + k * 0.03, 0.06]), 0.003, TINTA, 0.035, { ...O, alfa: 0.45, detalhe: 3 }));
  // A recompensa ($ grande) e as linhas.
  face.push(tira(em(f, [0.03, -0.1, -0.03, -0.1, -0.03, -0.13, 0.03, -0.13, 0.03, -0.16, -0.03, -0.16]), 0.012, TINTA, 0.035, { ...O, detalhe: 3 }), tira(em(f, [0, -0.085, 0, -0.175]), 0.006, TINTA, 0.035, { ...O, detalhe: 3 }));
  for (let k = 0; k < 3; k++) face.push(tira(em(f, [-0.14, -0.2 - k * 0.025, 0.14 - r() * 0.06, -0.2 - k * 0.025]), 0.006, TINTA, 0.035, { ...O, alfa: 0.7, detalhe: 3 }));
  for (const [u, v] of [[-0.17, 0.25], [0.17, 0.25], [-0.17, -0.25], [0.17, -0.25]] as const) face.push(elipse(...f(u, v), 0.018, 0.018, '#2a2a2a', 0.04, { ...O, detalhe: 3 }));
  return { face, topo: [ret(0, 0.01, 0.4, 0.02, PAPEL, 1.88, { contorno: 'leve' })] };
}

const FERRO_VERDE: Tons = { nanquim: '#050806', sombra: '#0e1612', base: '#18241e', meio: '#203028', luz: '#2c3e34', brilho: '#5a6e62' };

/** Cofre de ferro: o tampo pintado com o filete dourado e o letreiro, os pés; a porta na frente (+y) com o segredo e a maçaneta, ou aberta, mostrando as prateleiras com ouro e notas. */
function cofre(seed: number, aberto: boolean): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], W = 0.85, D = 0.75, z = 1.2;
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2, -W / 2, D / 2], 0.01, '#0d0a08', 0.5);
  if (aberto) {
    // O vão da porta visto de frente: as prateleiras com barras de ouro e maços de notas.
    const F = 0.5, y0 = D / 2;
    partes.push(poli([-W / 2 + 0.06, y0, W / 2 - 0.06, y0, W / 2 - 0.06, y0 + F, -W / 2 + 0.06, y0 + F], '#0a0c0a', 0.9, { contorno: 'leve', detalhe: 1 }));
    for (let k = 0; k < 3; k++) {
      const yy = y0 + 0.08 + k * 0.15; partes.push(tira([-W / 2 + 0.08, yy + 0.06, W / 2 - 0.08, yy + 0.06], 0.015, FERRO_VERDE.luz, 0.905, { ...O, detalhe: 3 }));
      for (let u = -W / 2 + 0.14; u < W / 2 - 0.1; u += 0.12) if (r() < 0.8) partes.push(k === 1 ? ret(u, yy + 0.02, 0.1, 0.05, '#4a6a3a', 0.906, { contorno: 'leve', detalhe: 3 }) : poli([u - 0.05, yy + 0.05, u + 0.05, yy + 0.05, u + 0.035, yy, u - 0.035, yy], LATAO.luz, 0.906, { contorno: 'leve', detalhe: 3 }));
    }
    // A porta aberta, girada na dobradiça esquerda.
    const fp = quadro(-W / 2 - 0.05, y0 + W / 2 - 0.04, Math.PI / 2);
    bloco(partes, fp, W - 0.08, 0.13, FERRO_VERDE, 1.1, 0.025, Math.PI / 2);
    disco(partes, ...fp(0.1, 0.09), 0.07, LATAO, 1.15);
  }
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) partes.push(elipse(u * (W / 2 - 0.04), v * (D / 2 - 0.04), 0.1, 0.1, FERRO.nanquim, 0.05, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, ID, W, D, FERRO_VERDE, z, 0.05);
  partes.push(tira(em(ID, [-W / 2 + 0.1, -D / 2 + 0.1, W / 2 - 0.1, -D / 2 + 0.1, W / 2 - 0.1, D / 2 - 0.1, -W / 2 + 0.1, D / 2 - 0.1, -W / 2 + 0.1, -D / 2 + 0.1]), 0.01, LATAO.luz, z + 0.01, { ...O, alfa: 0.85, detalhe: 3 }));
  for (let k = 0; k < 6; k++) partes.push(tira([-0.16 + k * 0.065, -0.03, -0.13 + k * 0.065, 0.03], 0.016, LATAO.luz, z + 0.012, { ...O, alfa: 0.8, detalhe: 3 }));
  for (const s of [-1, 1]) for (const q of [-1, 1]) partes.push(poli(bolha(s * 0.25, q * 0.2, 0.05, 0.03, 6, 0.3, r), LATAO.base, z + 0.012, { ...O, alfa: 0.7, detalhe: 3 }));
  if (!aberto) {
    disco(partes, 0.12, D / 2 + 0.01, 0.07, LATAO, 0.95);
    partes.push(tira([-0.2, D / 2 + 0.03, -0.06, D / 2 + 0.03], 0.03, LATAO.luz, 0.96, { contorno: 'leve', detalhe: 3 }));
    for (const v of [-0.2, 0.2]) partes.push(ret(-W / 2 - 0.01, v, 0.03, 0.1, LATAO.sombra, 0.95, { contorno: 'leve', detalhe: 3 }));
  }
  return { pegada: aberto ? [1.0, 1.4] : [1.0, 0.9], partes };
}

/** Mesa do xerife: a escrivaninha de pinho com papéis, cartazes de procurado, o revólver, o molho de chaves, a caneca de ágata, o lampião aceso e o chapéu; a cadeira atrás (−y). */
function mesaDeXerife(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.6, D = 0.8, z = 0.78;
  sombraNoChao(partes, [-W / 2, -0.95, W / 2, -0.95, W / 2, D / 2, -W / 2, D / 2], 0.01, '#0d0a08', 0.4);
  // A cadeira.
  const cf = quadro((r() - 0.5) * 0.3, -0.7, (r() - 0.5) * 0.3);
  partes.push(poli(retR(cf, 0, 0.02, 0.46, 0.42, 0.08), MOGNO.nanquim, 0.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retR(cf, 0, 0.02, 0.42, 0.38, 0.07), MOGNO.base, 0.453, { ...O, detalhe: 2 }), poli(retR(cf, -0.03, 0.0, 0.3, 0.22, 0.06), MOGNO.luz, 0.455, { ...S, alfa: 0.5, detalhe: 3 }));
  const costas: number[] = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * (1.05 + k * 0.09); costas.push(Math.cos(a) * 0.26, Math.sin(a) * 0.22 + 0.04); }
  partes.push(tira(em(cf, costas), 0.06, MOGNO.nanquim, 0.9, { contorno: 'leve', detalhe: 2 }), tira(em(cf, costas), 0.032, MOGNO.luz, 0.902, { ...O, detalhe: 3 }));
  for (let k = 1; k < 5; k++) { const a = Math.PI * (1.05 + k * 0.18); partes.push(tira(em(cf, [Math.cos(a) * 0.25, Math.sin(a) * 0.21 + 0.04, Math.cos(a) * 0.16, Math.sin(a) * 0.12 + 0.04]), 0.02, MOGNO.base, 0.7, { ...O, detalhe: 3 })); }
  // A mesa.
  bloco(partes, ID, W, D, PINHO, z, 0.04);
  tabuado(partes, r, quadro(0, 0), W - 0.1, D - 0.1, { ...PINHO, base: PINHO.meio }, z + 0.006, 0.17);
  // Papéis e cartazes.
  for (let k = 0; k < 4; k++) { const f = quadro(-0.45 + r() * 0.5, -0.1 + r() * 0.25, (r() - 0.5) * 0.6); partes.push(poli(retQ(f, 0, 0, 0.21, 0.28), k < 2 ? PAPEL : '#ece6d4', z + 0.02 + k * 0.002, { contorno: 'leve', detalhe: 2 })); if (k < 2) partes.push(poli(retQ(f, 0, -0.02, 0.1, 0.1), '#8a7a5e', z + 0.021 + k * 0.002, { ...O, alfa: 0.6, detalhe: 3 }), tira(em(f, [-0.08, 0.1, 0.08, 0.1]), 0.014, TINTA, z + 0.022 + k * 0.002, { ...O, detalhe: 3 })); }
  // O revólver: cano, tambor e cabo.
  const rf = quadro(0.15 + r() * 0.2, 0.22, r() * 6.28);
  partes.push(tira(em(rf, [0, 0, 0.2, 0]), 0.025, FERRO.luz, z + 0.04, { contorno: 'leve', detalhe: 3 }), elipse(...rf(-0.01, 0), 0.06, 0.05, FERRO.base, z + 0.045, { contorno: 'leve', detalhe: 3 }), lente(...rf(-0.04, 0), Math.PI + 0.5 + Math.atan2(rf(1, 0)[1] - rf(0, 0)[1], rf(1, 0)[0] - rf(0, 0)[0]), 0.11, 0.045, '#5a3a20', z + 0.042, { contorno: 'leve', detalhe: 3 }));
  // As chaves, a caneca de ágata.
  const kx = -0.6, ky = 0.25; partes.push(tira(anel(kx, ky, 0.05, 0.05, 14), 0.008, FERRO.brilho, z + 0.03, { contorno: 'leve', detalhe: 3 })); for (let k = 0; k < 3; k++) { const a = 0.5 + k * 0.6; partes.push(lente(kx + Math.cos(a) * 0.05, ky + Math.sin(a) * 0.05, a, 0.1, 0.025, LATAO.base, z + 0.031, { contorno: 'leve', detalhe: 3 })); }
  disco(partes, 0.55, -0.2, 0.06, tonsDe('#2a4a7a'), z + 0.03); partes.push(elipse(0.55, -0.2, 0.08, 0.08, '#2a1a0e', z + 0.1, { ...O, detalhe: 3 }));
  // O lampião de querosene: base de latão, a chaminé de vidro acesa.
  disco(partes, -0.6, -0.22, 0.09, LATAO, z + 0.05);
  partes.push(elipse(-0.6, -0.22, 0.12, 0.12, '#c8d0c8', z + 0.25, { contorno: 'leve', vidro: true, detalhe: 3 }), elipse(-0.6, -0.22, 0.07, 0.07, '#a85a10', z + 0.26, { ...O, brilho: true, desfoque: 0.01, detalhe: 3 }));
  // O chapéu, de aba larga, numa ponta.
  const hx = 0.62, hy = 0.12, hc = tonsDe(['#5a4430', '#2a2420', '#8a7458'][Math.floor(r() * 3)]!);
  partes.push(elipse(hx, hy, 0.4, 0.34, hc.nanquim, z + 0.05, { contorno: 'leve', detalhe: 2 }), elipse(hx, hy, 0.37, 0.31, hc.base, z + 0.052, { ...O, detalhe: 2 }), elipse(hx, hy, 0.2, 0.17, hc.sombra, z + 0.12, { contorno: 'leve', detalhe: 2 }), lente(hx - 0.07, hy, 0, 0.14, 0.04, hc.nanquim, z + 0.14, { ...O, alfa: 0.7, detalhe: 3 }), elipse(hx + LUZ_X * 0.03, hy + LUZ_Y * 0.03, 0.08, 0.06, hc.luz, z + 0.141, { ...S, alfa: 0.7, detalhe: 3 }));
  return partes;
}

/** Cela de cadeia: grades de ferro na frente (+y) e nos lados (o fundo é a parede), a porta de grade (aberta ou fechada) com a fechadura, o catre com cobertor de lã, o balde e palha no chão. */
function celaDeXerife(seed: number, aberta: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.6, D = 2.4, zb = 1.4;
  for (let k = 0; k < 7; k++) partes.push(lente((r() - 0.5) * W * 0.8, (r() - 0.5) * D * 0.7, r() * 6.28, 0.22, 0.03, '#b8a060', 0.01, { ...O, alfa: 0.7, detalhe: 3 }));
  // O catre de ferro no fundo, com o colchão de listras e o cobertor amarrotado.
  const ct = quadro(-W / 2 + 0.5, -0.15);
  partes.push(poli(retQ(ct, 0, 0, 0.78, 1.9), FERRO.nanquim, 0.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  estofado(partes, ct, 0, 0, 0, 0.7, 1.82, '#bcb6a6', 0.44, 0.05);
  for (let u = -0.28; u <= 0.28; u += 0.08) partes.push(tira(em(ct, [u, -0.88, u, 0.88]), 0.01, '#6a6a7a', 0.452, { ...O, alfa: 0.4, detalhe: 3 }));
  estofado(partes, ct, 0, 0, -0.75, 0.5, 0.22, '#d8d2c0', 0.47, 0.08);
  const cob = '#6a2a1e'; partes.push(poli(bolha(...ct(0.02, 0.35), 0.38, 0.55, 12, 0.18, r), tom(cob, -0.5), 0.48, { contorno: 'leve', detalhe: 2 }), poli(bolha(...ct(0.0, 0.33), 0.34, 0.5, 12, 0.18, r), cob, 0.482, { ...O, detalhe: 2 }));
  for (let k = 0; k < 3; k++) partes.push(tira(em(ct, [-0.3, 0.1 + k * 0.2, 0.3, 0.12 + k * 0.2]), 0.025, '#1e1a16', 0.484, { ...O, alfa: 0.6, detalhe: 3 }));
  // O balde.
  disco(partes, W / 2 - 0.4, -D / 2 + 0.4, 0.15, PRATA, 0.35); partes.push(elipse(W / 2 - 0.4, -D / 2 + 0.4, 0.22, 0.22, '#2a2418', 0.38, { ...O, detalhe: 3 }), tira(arco(W / 2 - 0.4, -D / 2 + 0.4, 0.15, 0.15, 0.3, 2.8, 8), 0.01, PRATA.brilho, 0.4, { ...O, detalhe: 3 }));
  // As grades: o trilho de cima e as barras, nos lados e na frente; a porta é um trecho da frente.
  const barras = (pts: number[], passo = 0.13): void => {
    partes.push(tira(pts, 0.11, FERRO.nanquim, zb, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(pts, 0.06, FERRO.luz, zb + 0.003, { ...O, detalhe: 2 }), tira(pts.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * 0.015), 0.02, FERRO.brilho, zb + 0.004, { ...O, alfa: 0.7, detalhe: 3 }));
    for (let i = 0; i + 3 < pts.length; i += 2) { const ax = pts[i]!, ay = pts[i + 1]!, bx = pts[i + 2]!, by = pts[i + 3]!, L = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(L / passo)); for (let k = 0; k <= n; k++) { const t = k / n; partes.push(elipse(ax + (bx - ax) * t, ay + (by - ay) * t, 0.075, 0.075, FERRO.meio, zb + 0.005, { contorno: 'leve', detalhe: 2 }), elipse(ax + (bx - ax) * t + LUZ_X * 0.012, ay + (by - ay) * t + LUZ_Y * 0.012, 0.03, 0.03, FERRO.brilho, zb + 0.006, { ...O, detalhe: 3 })); } }
  };
  const p0 = 0.15, p1 = 0.95;
  barras([-W / 2, -D / 2, -W / 2, D / 2, p0, D / 2]);
  barras([p1, D / 2, W / 2, D / 2, W / 2, -D / 2]);
  const ang = aberta ? 1.2 + r() * 0.3 : 0, dx = Math.cos(ang) * (p1 - p0), dy = Math.sin(ang) * (p1 - p0);
  barras([p0, D / 2, p0 + dx, D / 2 + dy]);
  partes.push(ret(p0 + dx * 0.95, D / 2 + dy * 0.95, 0.09, 0.09, FERRO.meio, zb + 0.01, { contorno: 'leve', detalhe: 3 }), elipse(p0 + dx * 0.95, D / 2 + dy * 0.95, 0.03, 0.03, LATAO.luz, zb + 0.012, { ...O, detalhe: 3 }));
  for (const [x, y] of [[-W / 2, -D / 2], [-W / 2, D / 2], [p0, D / 2], [p1, D / 2], [W / 2, D / 2], [W / 2, -D / 2]] as const) partes.push(ret(x, y, 0.1, 0.1, FERRO.nanquim, zb + 0.008, { contorno: 'leve', detalhe: 2 }));
  return partes;
}

// ---------- Rua e estrada de ferro (Q18b) ----------

/** Poste de amarrar: dois postes e a trave, as rédeas amarradas, o cocho d'água na frente (+y) e o feno pisado. */
function posteDeAmarrar(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 2.6;
  for (let k = 0; k < 8; k++) partes.push(lente((r() - 0.5) * L, 0.2 + (r() - 0.5) * 0.8, r() * 6.28, 0.25, 0.04, '#b8a060', 0.01, { ...O, alfa: 0.75, detalhe: 3 }));
  const cf = quadro(0, 0.42);
  bloco(partes, cf, 1.9, 0.42, PINHO, 0.45, 0.05);
  partes.push(poli(retR(cf, 0, 0, 1.74, 0.28, 0.03), '#1e3434', 0.46, { ...O, detalhe: 1 }), lente(-0.6, 0.38, 0, 0.6, 0.05, '#5a8a88', 0.462, { ...S, alfa: 0.45, detalhe: 3 }));
  for (const s of [-1, 1]) disco(partes, s * (L / 2 - 0.08), -0.15, 0.08, PINHO, 0.9);
  partes.push(tira([-L / 2, -0.15, L / 2, -0.15], 0.1, PINHO.nanquim, 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-L / 2 + 0.02, -0.16, L / 2 - 0.02, -0.16], 0.06, PINHO.luz, 1.003, { ...O, detalhe: 2 }));
  for (let k = 0; k < 1 + Math.floor(r() * 2); k++) { const u = -0.8 + r() * 1.6; partes.push(tira([u, -0.15, u + 0.05, -0.05, u - 0.02, 0.1, u + 0.1, 0.2], 0.022, '#3a2416', 1.01, { contorno: 'leve', detalhe: 3 }, 0.6)); }
  return partes;
}

/** Diligência: a caixa pintada com o teto de couro e o bagageiro com malas, a bagageira de trás, a boleia na frente (+x) com o baú de valores, as rodas (as de trás maiores) e o timão. Sem cavalos: o `cavalo` se põe à frente. */
function diligencia(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = ['#7a1e18', '#2a4a3a', '#6a4a1a'][Math.floor(r() * 3)]!, t = tonsDe(cor), o = -0.5, f = quadro(o, 0);
  sombraNoChao(partes, em(f, [-1.7, -0.85, 1.9, -0.85, 1.9, 0.85, -1.7, 0.85]), 0.01, '#0d0a08', 0.4);
  // O timão e a balança na frente.
  partes.push(tira(em(f, [1.6, 0, 3.0, 0]), 0.08, MADEIRA.nanquim, 0.6, { contorno: 'leve', detalhe: 2 }), tira(em(f, [1.6, 0, 3.0, 0]), 0.045, MADEIRA.luz, 0.602, { ...O, detalhe: 3 }), tira(em(f, [2.95, -0.5, 2.95, 0.5]), 0.07, MADEIRA.base, 0.61, { contorno: 'leve', detalhe: 2 }));
  // As rodas.
  for (const s of [-1, 1]) { roda(partes, f, -0.95, s * 0.82, 1.45, 0.1, 0.5, s, cor === '#7a1e18' ? '#a8862e' : '#7a2018'); roda(partes, f, 1.05, s * 0.74, 1.05, 0.09, 0.5, s, cor === '#7a1e18' ? '#a8862e' : '#7a2018'); }
  // A bagageira de trás, de couro, e a boleia na frente.
  partes.push(poli(retR(f, -1.55, 0, 0.5, 1.2, 0.18), '#1e140e', 1.0, { contorno: 'leve', detalhe: 1 }), poli(retR(f, -1.57, -0.02, 0.42, 1.08, 0.15), '#4a3424', 1.003, { ...O, detalhe: 2 }));
  for (const v of [-0.35, 0.35]) partes.push(tira(em(f, [-1.78, v, -1.32, v]), 0.03, '#2a1e14', 1.005, { ...O, detalhe: 3 }));
  bloco(partes, quadro(o + 1.45, 0), 0.6, 1.25, t, 1.25, 0.04);
  partes.push(poli(retR(quadro(o + 1.4, 0), 0, 0, 0.3, 1.05, 0.06), '#2a1e14', 1.3, { contorno: 'leve', detalhe: 2 }));
  bloco(partes, quadro(o + 1.66, 0.25), 0.24, 0.36, { ...FERRO_VERDE }, 1.32, 0.02);
  partes.push(ret(...quadro(o + 1.66, 0.25)(0, 0), 0.06, 0.06, LATAO.luz, 1.35, { contorno: 'leve', detalhe: 3 }));
  // A caixa e o teto, com o bagageiro: o gradil e as malas.
  bloco(partes, quadro(o, 0), 2.4, 1.38, t, 1.35, 0.06);
  partes.push(poli(retR(f, 0, 0, 2.2, 1.2, 0.12), '#2a2420', 1.36, { ...O, detalhe: 1 }), poli(retR(f, -0.05, -0.12, 1.9, 0.6, 0.12), '#3e3630', 1.362, { ...S, alfa: 0.7, detalhe: 2 }));
  partes.push(tira(retR(f, 0, 0, 2.0, 1.04, 0.08).concat(retR(f, 0, 0, 2.0, 1.04, 0.08).slice(0, 2)), 0.025, LATAO.luz, 1.4, { ...O, detalhe: 2 }));
  const malas: [number, number, number, number, string][] = [[-0.55, -0.2, 0.6, 0.38, '#5a3a20'], [0.1, -0.22, 0.5, 0.36, '#2a3a4a'], [-0.35, 0.22, 0.7, 0.34, '#6a5a3a'], [0.5, 0.2, 0.36, 0.3, '#4a2418']];
  for (const [u, v, w, h, c] of malas) if (r() < 0.85) { bloco(partes, quadro(o + u, v, (r() - 0.5) * 0.2), w, h, tonsDe(c), 1.43, 0.03); partes.push(tira(em(quadro(o + u, v), [0, -h / 2, 0, h / 2]), 0.025, '#2a1a10', 1.47, { ...O, detalhe: 3 })); }
  return partes;
}

/** Carroça coberta: a lona crua sobre os arcos (cilindro claro do lado norte), as bocas franzidas nas pontas, a caixa pintada, o barril d'água e a pá amarrados ao lado, as rodas e o timão para +x. */
function carrocaCoberta(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], caixa = tonsDe(['#3a5a7a', '#6a4a2a', '#4a5a3a'][Math.floor(r() * 3)]!), o = -0.45, f = quadro(o, 0), L = 3.2;
  sombraNoChao(partes, em(f, [-1.8, -0.9, 1.8, -0.9, 1.8, 0.9, -1.8, 0.9]), 0.01, '#0d0a08', 0.4);
  partes.push(tira(em(f, [1.6, 0, 3.2, 0]), 0.08, MADEIRA.nanquim, 0.6, { contorno: 'leve', detalhe: 2 }), tira(em(f, [1.6, 0, 3.2, 0]), 0.045, MADEIRA.luz, 0.602, { ...O, detalhe: 3 }), tira(em(f, [3.15, -0.45, 3.15, 0.45]), 0.07, MADEIRA.base, 0.61, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) { roda(partes, f, -1.05, s * 0.78, 1.35, 0.1, 0.5, s, '#7a2018'); roda(partes, f, 1.1, s * 0.72, 1.0, 0.09, 0.5, s, '#7a2018'); }
  bloco(partes, f, L, 1.2, caixa, 1.0, 0.05);
  // O barril e a pá do lado de fora (−y).
  disco(partes, ...f(0.4, -0.72), 0.16, MADEIRA, 1.05); partes.push(tira(anel(...f(0.4, -0.72), 0.14, 0.14, 14), 0.012, FERRO.base, 1.1, { ...O, detalhe: 3 }));
  partes.push(tira(em(f, [-0.9, -0.66, 0.0, -0.66]), 0.03, MADEIRA.luz, 1.05, { contorno: 'leve', detalhe: 3 }), poli(em(f, [-1.12, -0.6, -0.9, -0.62, -0.9, -0.7, -1.12, -0.72]), FERRO.luz, 1.05, { contorno: 'leve', detalhe: 3 }));
  // A lona: o meio-cilindro com os arcos e as dobras.
  const W = 1.5, l0 = -L / 2 + 0.1, l1 = L / 2 - 0.15;
  partes.push(poli(retR(f, (l0 + l1) / 2, 0, l1 - l0 + 0.06, W + 0.06, 0.2), tom(LONA, -0.72), 1.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  // O volume do meio-cilindro: a base na sombra, o meio e a crista clara deslocada para o lado da luz (−y), em veladuras macias.
  partes.push(poli(retR(f, (l0 + l1) / 2, 0, l1 - l0, W, 0.18), tom(LONA, -0.38), 1.33, { ...O, detalhe: 1 }));
  partes.push(poli(retR(f, (l0 + l1) / 2, -W * 0.08, l1 - l0 - 0.04, W * 0.76, 0.16), tom(LONA, -0.12), 1.332, { ...S, desfoque: 0.12, detalhe: 1 }));
  partes.push(poli(retR(f, (l0 + l1) / 2, -W * 0.16, l1 - l0 - 0.08, W * 0.44, 0.14), LONA, 1.334, { ...S, desfoque: 0.1, detalhe: 2 }));
  partes.push(poli(retR(f, (l0 + l1) / 2, -W * 0.24, l1 - l0 - 0.2, W * 0.14, 0.06), '#f6f0e2', 1.336, { ...S, alfa: 0.8, desfoque: 0.05, detalhe: 2 }));
  const n = 6;
  for (let k = 0; k <= n; k++) { const u = l0 + 0.15 + (k / n) * (l1 - l0 - 0.3); partes.push(tira(em(f, [u, -W / 2 + 0.05, u, W / 2 - 0.05]), 0.05, tom(LONA, -0.3), 1.35, { ...S, alfa: 0.35, desfoque: 0.02, detalhe: 2 })); }
  for (let k = 0; k < 6; k++) { const u = l0 + 0.3 + r() * (l1 - l0 - 0.6); partes.push(tira(em(f, [u, -W / 2 + 0.05, u + (r() - 0.5) * 0.2, -W / 2 + 0.35]), 0.02, tom(LONA, -0.25), 1.354, { ...O, alfa: 0.4, detalhe: 3 })); }
  // As bocas franzidas.
  for (const [u, s] of [[l0, -1], [l1, 1]] as const) {
    partes.push(elipse(...f(u, 0), 0.24, 0.9, tom(LONA, -0.15), 1.36, { contorno: 'leve', detalhe: 2 }), elipse(...f(u + s * 0.02, 0), 0.12, 0.5, '#1a140e', 1.37, { ...O, detalhe: 2 }));
    for (let k = 0; k < 7; k++) { const v = -0.4 + k * 0.133; partes.push(tira(em(f, [u - s * 0.08, v, u + s * 0.02, v * 0.6]), 0.012, tom(LONA, -0.35), 1.372, { ...O, alfa: 0.6, detalhe: 3 })); }
  }
  return partes;
}

/** Bomba de manivela: o tablado de tábuas, o corpo de ferro fundido com a bica para +y e a alavanca para trás, o balde sob a bica e a poça. */
function bombaDeManivela(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  partes.push(poli(bolha(0.05, 0.35, 0.4, 0.28, 12, 0.25, r), '#2a3030', 0.01, { ...S, alfa: 0.5, detalhe: 2 }));
  bloco(partes, ID, 0.8, 0.8, PINHO, 0.15, 0.03);
  tabuado(partes, r, ID, 0.74, 0.74, PINHO, 0.18, 0.15);
  disco(partes, 0.08, 0.3, 0.13, PRATA, 0.35); partes.push(elipse(0.08, 0.3, 0.2, 0.2, '#2a4040', 0.4, { ...O, detalhe: 3 }), tira(arco(0.08, 0.3, 0.14, 0.14, 3.6, 5.8, 8), 0.01, PRATA.brilho, 0.42, { ...O, detalhe: 3 }));
  disco(partes, 0, -0.05, 0.1, FERRO, 1.0);
  partes.push(tira([0, -0.02, 0.0, 0.18, 0.04, 0.24], 0.05, FERRO.base, 1.05, { contorno: 'leve', detalhe: 2 }, 0.8));
  const a = -Math.PI / 2 + (r() - 0.5) * 0.6;
  partes.push(tira([0, -0.08, Math.cos(a) * 0.55, -0.05 + Math.sin(a) * 0.55], 0.035, FERRO.nanquim, 1.2, { contorno: 'leve', detalhe: 2 }), tira([0, -0.08, Math.cos(a) * 0.53, -0.05 + Math.sin(a) * 0.53], 0.018, FERRO.brilho, 1.202, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(elipse(Math.cos(a) * 0.55, -0.05 + Math.sin(a) * 0.55, 0.06, 0.06, FERRO.base, 1.21, { contorno: 'leve', detalhe: 3 }));
  disco(partes, 0, -0.05, 0.05, FERRO, 1.25);
  return partes;
}

/** Cata-vento de fazenda: a torre de quatro pernas de madeira com as travessas, a plataforma no alto, a roda de pás de chapa (desenhada um pouco de frente, como o biombo) e o leme. */
function cataVento(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], B = 1.1;
  // As pernas: dos pés até o alto, com as travessas em X.
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    partes.push(tira([su * B, sv * B, su * 0.2, sv * 0.2], 0.08, PINHO.nanquim, 0.9, { contorno: 'leve', detalhe: 1 }), tira([su * B, sv * B, su * 0.2, sv * 0.2], 0.045, tomDaFace(PINHO, olhar(Math.atan2(sv, su))), 0.902, { ...O, detalhe: 2 }));
    partes.push(ret(su * B, sv * B, 0.16, 0.16, '#8a8478', 0.05, { contorno: 'leve', detalhe: 2 }));
  }
  for (const k of [0.75, 0.45]) partes.push(tira([-B * k, -B * k, B * k, -B * k, B * k, B * k, -B * k, B * k, -B * k, -B * k], 0.03, PINHO.base, 0.85, { ...O, alfa: 0.85, detalhe: 3 }));
  partes.push(tira([-B * 0.75, -B * 0.75, B * 0.45, B * 0.45], 0.02, PINHO.sombra, 0.84, { ...O, alfa: 0.7, detalhe: 3 }), tira([B * 0.75, -B * 0.75, -B * 0.45, B * 0.45], 0.02, PINHO.sombra, 0.84, { ...O, alfa: 0.7, detalhe: 3 }));
  bloco(partes, ID, 0.5, 0.5, PINHO, 1.2, 0.04);
  // O leme: a haste e a chapa com a letra pintada.
  const giro = (r() - 0.5) * 0.8, c = Math.cos(giro), s = Math.sin(giro), g = (u: number, v: number): [number, number] => [u * c - v * s, u * s + v * c];
  partes.push(tira([...g(0, 0), ...g(-1.3, 0)], 0.04, FERRO.base, 1.42, { contorno: 'leve', detalhe: 2 }), poli([...g(-1.1, -0.04), ...g(-1.65, -0.04), ...g(-1.65, 0.3), ...g(-1.2, 0.2)], '#a8281a', 1.43, { contorno: 'leve', detalhe: 2 }), tira([...g(-1.5, 0.02), ...g(-1.35, 0.18)], 0.02, '#e8e0cc', 1.435, { ...O, detalhe: 3 }));
  // A roda de pás, virada para o vento (+x), vista um pouco de frente.
  const cx = g(0.35, 0)[0], cy = g(0.35, 0)[1], R = 1.15, kx = 0.38, n = 18;
  partes.push(elipse(cx, cy, R * 2 * kx + 0.06, R * 2 + 0.06, FERRO.nanquim, 1.44, { contorno: 'leve', sombraLeve: true, detalhe: 1, alfa: 0.9 }));
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 6.28, a1 = a0 + (6.28 / n) * 0.72, p = (a: number, k: number): [number, number] => { const [u, v] = [Math.cos(a) * R * k * kx, Math.sin(a) * R * k]; return [cx + u * c - v * s, cy + u * s + v * c]; };
    partes.push(poli([...p(a0, 0.3), ...p(a0, 1), ...p(a1, 1), ...p(a1, 0.32)], tom('#9a9c9e', olhar(a0) * 0.2 + (i % 2 ? -0.06 : 0.04)), 1.45, { ...O, detalhe: 2 }));
  }
  const aro: number[] = []; for (let k = 0; k <= 28; k++) { const a = (k / 28) * 6.28, u = Math.cos(a) * R * kx, v = Math.sin(a) * R; aro.push(cx + u * c - v * s, cy + u * s + v * c); }
  partes.push(tira(aro, 0.03, FERRO.base, 1.46, { ...O, detalhe: 3 }));
  disco(partes, cx, cy, 0.12, FERRO, 1.47);
  return partes;
}

/** Caixa-d'água da ferrovia: o tanque redondo de aduelas com os aros, o telhado cônico de tábuas em gomos, a tampa, e a bica de lona caída para o lado da linha (+y). */
function caixaDagua(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 1.7;
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) partes.push(ret(su * R * 0.8, sv * R * 0.8, 0.22, 0.22, PINHO.nanquim, 0.4, { contorno: 'leve', detalhe: 2 }));
  // A bica: o cano de lona pendurado para +y, com o contrapeso.
  const ba = Math.PI / 2 + (r() - 0.5) * 0.4;
  partes.push(tira([Math.cos(ba) * R * 0.7, Math.sin(ba) * R * 0.7, Math.cos(ba) * (R + 0.9), Math.sin(ba) * (R + 0.9)], 0.2, '#2a2018', 1.2, { contorno: 'leve', detalhe: 2 }), tira([Math.cos(ba) * R * 0.7, Math.sin(ba) * R * 0.7, Math.cos(ba) * (R + 0.85), Math.sin(ba) * (R + 0.85)], 0.12, '#6a5a44', 1.202, { ...O, detalhe: 3 }));
  partes.push(tira([Math.cos(ba) * (R + 0.85), Math.sin(ba) * (R + 0.85), Math.cos(ba) * (R + 0.85) + 0.1, Math.sin(ba) * (R + 0.85) + 0.3], 0.15, '#3a3026', 1.15, { contorno: 'leve', detalhe: 3 }));
  // O tanque (só a borda aparece em volta do telhado), com os aros.
  disco(partes, 0, 0, R, PINHO, 1.3);
  for (let k = 0; k < 40; k++) { const a = (k / 40) * 6.28; partes.push(tira([Math.cos(a) * R * 0.88, Math.sin(a) * R * 0.88, Math.cos(a) * R, Math.sin(a) * R], 0.01, PINHO.nanquim, 1.31, { ...O, alfa: 0.5, detalhe: 3 })); }
  partes.push(tira(anel(0, 0, R * 0.97, R * 0.97, 40), 0.04, FERRO.base, 1.312, { ...O, alfa: 0.9, detalhe: 3 }));
  // O telhado cônico: gomos de tábua, cada um no tom da luz que recebe.
  const Rt = R * 0.94, n = 16;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 6.28, a1 = ((i + 1) / n) * 6.28, am = (a0 + a1) / 2;
    partes.push(poli([0, 0, Math.cos(a0) * Rt, Math.sin(a0) * Rt, Math.cos(a1) * Rt, Math.sin(a1) * Rt], tom(tomDaFace(PINHO, olhar(am)), (r() - 0.5) * 0.06), 1.4 + (i % 2) * 0.001, { ...O, detalhe: 1 }));
    partes.push(tira([0, 0, Math.cos(a0) * Rt, Math.sin(a0) * Rt], 0.012, PINHO.nanquim, 1.41, { ...O, alfa: 0.55, detalhe: 3 }));
  }
  for (const k of [0.35, 0.65]) partes.push(tira(anel(0, 0, Rt * k, Rt * k, 32), 0.008, PINHO.nanquim, 1.411, { ...O, alfa: 0.35, detalhe: 3 }));
  disco(partes, 0, 0, 0.14, FERRO, 1.45);
  return partes;
}

/** Os pontos da linha central de um trilho de comprimento `C`, reto ou em arco de `curva` graus, e a tangente em cada um. */
function linhaDoTrilho(C: number, curva: number, n: number): [number, number, number][] {
  const th = (curva * Math.PI) / 180, pts: [number, number, number][] = [];
  if (Math.abs(th) < 1e-3) { for (let i = 0; i <= n; i++) pts.push([-C / 2 + (C * i) / n, 0, 0]); return pts; }
  const R = C / th;
  for (let i = 0; i <= n; i++) { const a = -th / 2 + (th * i) / n; pts.push([R * Math.sin(a), R * (1 - Math.cos(a)) - R * (1 - Math.cos(th / 2)) / 2, a]); }
  return pts;
}

/** Trilho: o leito de brita, os dormentes de madeira a cada 0,6 m e os dois trilhos de aço, reto ou em curva. */
function trilho(seed: number, C: number, curva: number): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], g = 0.72, n = Math.max(2, Math.ceil(C / 0.5)), pts = linhaDoTrilho(C, curva, n);
  const off = (d: number): number[] => pts.flatMap(([x, y, a]) => [x - Math.sin(a) * d, y + Math.cos(a) * d]);
  const centro = pts.flatMap(([x, y]) => [x, y]);
  partes.push(tira(centro, 3.0, '#6e665a', 0.01, { ...O, suave: true, alfa: 0.9, detalhe: 1 }), tira(centro, 2.5, '#827a6c', 0.011, { ...O, suave: true, detalhe: 1 }));
  for (let k = 0; k < C * 14; k++) { const i = Math.floor(r() * pts.length), [x, y, a] = pts[i]!, d = (r() - 0.5) * 2.6; partes.push(elipse(x - Math.sin(a) * d + (r() - 0.5) * 0.4, y + Math.cos(a) * d, 0.05, 0.04, r() < 0.5 ? '#5a544a' : '#9a9282', 0.012, { ...O, detalhe: 3 })); }
  const nd = Math.max(2, Math.round(C / 0.6));
  const dormentes = linhaDoTrilho(C, curva, nd);
  for (const [x, y, a] of dormentes) {
    const f = quadro(x, y, a + Math.PI / 2 + (r() - 0.5) * 0.04), tt = tonsDe(tom('#5e4e3a', (r() - 0.5) * 0.2));
    partes.push(poli(retQ(f, 0, 0, 2.4, 0.22), tt.nanquim, 0.05, { contorno: 'leve', detalhe: 1 }), poli(retQ(f, 0, -0.01, 2.36, 0.17), tt.base, 0.052, { ...O, detalhe: 2 }), tira(em(f, [-1.1, -0.04, 1.1, -0.04]), 0.02, tt.luz, 0.053, { ...O, alfa: 0.6, detalhe: 3 }));
  }
  for (const d of [-g, g]) { const pl = off(d); partes.push(tira(pl, 0.1, FERRO.nanquim, 0.1, { contorno: 'leve', detalhe: 1 }), tira(pl, 0.06, FERRO.meio, 0.102, { ...O, detalhe: 2 }), tira(off(d - 0.015), 0.022, '#b8bcc0', 0.104, { ...O, detalhe: 2 })); }
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of partes) for (let i = 0; i + 1 < (p.pts?.length ?? 0); i += 2) { x0 = Math.min(x0, p.pts![i]!); x1 = Math.max(x1, p.pts![i]!); y0 = Math.min(y0, p.pts![i + 1]!); y1 = Math.max(y1, p.pts![i + 1]!); }
  const dx = (x0 + x1) / 2, dy = (y0 + y1) / 2;
  const centradas = partes.map(p => (p.pts ? { ...p, pts: p.pts.map((v, i) => v - (i % 2 ? dy : dx)) } : { ...p, x: p.x! - dx, y: p.y! - dy }));
  return { pegada: [Math.round((x1 - x0) * 100) / 100, Math.round((y1 - y0) * 100) / 100], partes: centradas };
}

/** Locomotiva a vapor (tipo americano): a caldeira de ferro com os aros de latão, a caixa de fumaça e a chaminé de balão na frente (+x), os domos de vapor e de areia, o sino, a cabine de madeira atrás, o limpa-trilhos, o farol e as rodas motrizes com a biela. */
function locomotiva(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cab = tonsDe(['#7a2418', '#2a4a3a', '#6a4a1a'][Math.floor(r() * 3)]!);
  sombraNoChao(partes, [-4.8, -1.2, 4.8, -1.2, 4.8, 1.2, -4.8, 1.2], 0.02, '#0d0a08', 0.4);
  // O estrado com os estribos e as rodas motrizes nos lados.
  partes.push(poli(retQ(ID, -0.3, 0, 8.6, 2.3), FERRO.nanquim, 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(ID, -0.3, 0, 8.5, 2.2), FERRO.base, 0.903, { ...O, detalhe: 1 }));
  for (const s of [-1, 1]) {
    for (const [u, D] of [[-1.6, 1.7], [0.3, 1.7], [2.4, 0.9], [3.3, 0.9]] as const) roda(partes, ID, u, s * 1.2, D, 0.12, 0.95, s, '#8a2018');
    partes.push(tira([-1.6, s * 1.32, 0.3, s * 1.32], 0.07, '#b8bcc0', 1.0, { contorno: 'leve', detalhe: 2 }));
  }
  // O limpa-trilhos, a viga dianteira e o farol.
  partes.push(poli([4.2, -1.05, 5.15, 0, 4.2, 1.05], FERRO.nanquim, 0.5, { contorno: 'leve', detalhe: 1 }));
  for (let k = -4; k <= 4; k++) partes.push(tira([4.25, k * 0.24, 5.1, 0], 0.035, '#8a2018', 0.52, { ...O, detalhe: 3 }));
  partes.push(poli(retQ(ID, 4.12, 0, 0.18, 2.3), '#8a2018', 0.95, { contorno: 'leve', detalhe: 2 }));
  bloco(partes, quadro(3.8, 0), 0.5, 0.5, tonsDe('#2a2a2a'), 1.42, 0.04);
  partes.push(elipse(4.05, 0, 0.12, 0.3, '#c87a20', 1.45, { ...O, brilho: true, alfa: 0.7, detalhe: 3 }), ret(3.8, 0, 0.3, 0.3, LATAO.luz, 1.46, { contorno: 'leve', detalhe: 3 }));
  // A caldeira: cilindro com o lado da luz (−y) claro e os aros de latão.
  const u0 = -2.4, u1 = 3.6, Rc = 0.72;
  partes.push(poli(retR(ID, (u0 + u1) / 2, 0, u1 - u0 + 0.04, Rc * 2 + 0.06, 0.1), FERRO.nanquim, 1.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  const bandas: [number, number, string][] = [[-Rc, -Rc * 0.55, FERRO.luz], [-Rc * 0.55, -Rc * 0.1, FERRO.meio], [-Rc * 0.1, Rc * 0.45, FERRO.base], [Rc * 0.45, Rc, FERRO.sombra]];
  for (const [a, b, c] of bandas) partes.push(poli(retQ(ID, (u0 + u1) / 2, (a + b) / 2, u1 - u0, b - a + 0.005), c, 1.33, { ...O, detalhe: 1 }));
  partes.push(tira([u0 + 0.1, -Rc * 0.62, u1 - 0.1, -Rc * 0.62], 0.05, FERRO.brilho, 1.34, { ...S, alfa: 0.5, detalhe: 2 }));
  partes.push(poli(retQ(ID, 3.1, 0, 1.0, Rc * 2), '#1c1c1e', 1.335, { ...O, detalhe: 1 }), poli(retQ(ID, 3.1, -Rc * 0.6, 1.0, Rc * 0.5), '#3a3a3e', 1.336, { ...O, alfa: 0.8, detalhe: 2 }));
  for (const u of [-1.9, -0.9, 0.2, 1.4, 2.55]) partes.push(tira([u, -Rc, u, Rc], 0.05, LATAO.base, 1.34, { ...O, detalhe: 2 }), tira([u - 0.012, -Rc, u - 0.012, -Rc * 0.3], 0.015, LATAO.brilho, 1.342, { ...O, detalhe: 3 }));
  // O sino, os domos e a chaminé de balão.
  disco(partes, 1.9, 0, 0.17, LATAO, 1.36);
  disco(partes, 0.75, 0, 0.36, LATAO, 1.37);
  disco(partes, -0.6, 0, 0.3, tonsDe('#3a3a3e'), 1.37);
  disco(partes, -0.6, 0, 0.18, LATAO, 1.4);
  disco(partes, 3.15, 0, 0.62, FERRO, 1.42);
  partes.push(tira(anel(3.15, 0, 0.5, 0.5, 28), 0.04, FERRO.brilho, 1.445, { ...O, alfa: 0.6, detalhe: 3 }), elipse(3.15, 0, 0.7, 0.7, '#0a0a0a', 1.45, { ...O, detalhe: 2 }));
  for (let k = 0; k < 6; k++) { const a = k * 1.05; partes.push(tira([3.15 + Math.cos(a) * 0.08, Math.sin(a) * 0.08, 3.15 + Math.cos(a) * 0.32, Math.sin(a) * 0.32], 0.01, '#3a3a3a', 1.452, { ...O, detalhe: 3 })); }
  // A cabine: o teto de madeira com o lado claro, a beirada e o respiro.
  bloco(partes, quadro(-3.45, 0), 2.1, 2.5, cab, 1.45, 0.08);
  partes.push(poli(retQ(ID, -3.45, -0.6, 1.9, 1.1), cab.luz, 1.456, { ...S, alfa: 0.4, detalhe: 2 }), tira([-4.4, 0, -2.5, 0], 0.03, cab.nanquim, 1.46, { ...O, alfa: 0.6, detalhe: 3 }));
  bloco(partes, quadro(-3.45, 0), 0.5, 0.36, tonsDe('#3a3a3e'), 1.48, 0.03);
  return partes;
}

/** Vagão: de carga (madeira vermelha, passadiço no teto, roda de freio e escadas), de passageiros (teto com lanternim e as plataformas das pontas), tênder (carvão e a boca do tanque) ou plataforma (com a carga). */
function vagao(seed: number, tipo: number): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], L = tipo === 2 ? 5.6 : 7.8, W = 2.6, z = tipo === 3 ? 1.0 : 1.4;
  sombraNoChao(partes, [-L / 2, -W / 2, L / 2, -W / 2, L / 2, W / 2, -L / 2, W / 2], 0.02, '#0d0a08', 0.4);
  for (const s of [-1, 1]) partes.push(tira([s * (L / 2 + 0.05), 0, s * (L / 2 + 0.3), 0], 0.15, FERRO.nanquim, 0.9, { contorno: 'leve', detalhe: 2 }));
  if (tipo === 0) {
    const t = tonsDe(['#7a2a1a', '#8a3a1e', '#5a4a3a'][Math.floor(r() * 3)]!);
    bloco(partes, ID, L, W, t, z, 0.08);
    for (let u = -L / 2 + 0.3; u < L / 2; u += 0.3) partes.push(tira([u, -W / 2 + 0.08, u, W / 2 - 0.08], 0.012, t.nanquim, z + 0.01, { ...O, alfa: 0.45, detalhe: 3 }));
    partes.push(poli(retQ(ID, 0, -W / 4, L - 0.16, W / 2 - 0.1), t.luz, z + 0.012, { ...S, alfa: 0.3, detalhe: 2 }));
    tabuado(partes, r, quadro(0, 0), L - 0.2, 0.5, PINHO, z + 0.015, 0.12);
    for (const s of [-1, 1]) { const x = s * (L / 2 - 0.35); partes.push(tira(anel(x, 0.6, 0.18, 0.18, 16), 0.03, FERRO.nanquim, z + 0.03, { contorno: 'leve', detalhe: 3 }), tira([x - 0.18, 0.6, x + 0.18, 0.6], 0.015, FERRO.nanquim, z + 0.03, { ...O, detalhe: 3 })); for (let k = 0; k < 4; k++) partes.push(tira([s * (L / 2 - 0.05), -W / 2 + 0.25 + k * 0.12, s * (L / 2 - 0.2), -W / 2 + 0.25 + k * 0.12], 0.02, FERRO.luz, z + 0.02, { ...O, detalhe: 3 })); }
  } else if (tipo === 1) {
    const t = tonsDe(['#2a4a3a', '#6a4a1a', '#5a1e1a'][Math.floor(r() * 3)]!), corpo = L - 1.2;
    for (const s of [-1, 1]) { tabuado(partes, r, quadro(s * (corpo / 2 + 0.3), 0), 0.6, W - 0.4, PINHO, 0.95, 0.12); partes.push(tira([s * (L / 2 - 0.02), -W / 2 + 0.2, s * (L / 2 - 0.02), W / 2 - 0.2], 0.04, FERRO.base, 1.2, { contorno: 'leve', detalhe: 3 })); }
    bloco(partes, ID, corpo, W, t, z, 0.06);
    partes.push(poli(retR(ID, 0, 0, corpo - 0.1, W - 0.2, 0.3), '#2a2624', z + 0.01, { ...O, detalhe: 1 }), poli(retQ(ID, 0, -W / 4, corpo - 0.3, W / 2 - 0.3), '#4a4440', z + 0.011, { ...S, alfa: 0.5, detalhe: 2 }));
    partes.push(poli(retR(ID, 0, 0, corpo - 0.8, 0.9, 0.2), '#3a3430', z + 0.03, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0, -0.2, corpo - 1.0, 0.3), '#5a5450', z + 0.032, { ...S, alfa: 0.6, detalhe: 3 }));
    for (let u = -corpo / 2 + 0.7; u < corpo / 2 - 0.5; u += 0.6) partes.push(ret(u, 0.32, 0.25, 0.08, '#8a7a4a', z + 0.034, { ...O, alfa: 0.8, detalhe: 3 }), elipse(u + 0.3, 0, 0.1, 0.1, FERRO.base, z + 0.035, { contorno: 'leve', detalhe: 3 }));
  } else if (tipo === 2) {
    bloco(partes, ID, L, W, tonsDe('#1e1e20'), z, 0.08);
    partes.push(tira(retR(ID, 0, 0, L - 0.2, W - 0.2, 0.1).concat(retR(ID, 0, 0, L - 0.2, W - 0.2, 0.1).slice(0, 2)), 0.03, LATAO.base, z + 0.01, { ...O, alfa: 0.8, detalhe: 3 }));
    const carvao = bolha(L / 4 - 0.2, 0, L / 4 + 0.2, W / 2 - 0.25, 16, 0.12, r);
    partes.push(poli(carvao, '#0e0e10', z + 0.02, { ...O, detalhe: 1 }));
    for (let k = 0; k < 60; k++) { const x = L / 4 - 0.2 + (r() - 0.5) * (L / 2 + 0.2), y = (r() - 0.5) * (W - 0.6); partes.push(elipse(x, y, 0.1, 0.08, r() < 0.5 ? '#1e1e22' : '#3a3a40', z + 0.022, { ...O, detalhe: 3 }), elipse(x - 0.02, y - 0.02, 0.04, 0.03, '#6a6a74', z + 0.023, { ...S, alfa: 0.6, detalhe: 3 })); }
    disco(partes, -L / 4 - 0.3, 0, 0.35, tonsDe('#2a2a2c'), z + 0.04);
  } else {
    tabuado(partes, r, ID, L, W, PINHO, z, 0.18);
    partes.push(tira(retR(ID, 0, 0, L, W, 0.02).concat(retR(ID, 0, 0, L, W, 0.02).slice(0, 2)), 0.06, FERRO.nanquim, z + 0.01, { contorno: 'leve', detalhe: 2 }));
    if (r() < 0.5) for (let k = 0; k < 5; k++) { const v = -W / 2 + 0.3 + k * 0.5; partes.push(tira([-L / 2 + 0.4, v, L / 2 - 0.4, v], 0.42, '#4a3220', z + 0.1 + (k % 2) * 0.12, { contorno: 'leve', detalhe: 1 }), tira([-L / 2 + 0.4, v - 0.08, L / 2 - 0.4, v - 0.08], 0.12, '#7a5a3a', z + 0.105 + (k % 2) * 0.12, { ...O, detalhe: 2 })); for (const s of [-1, 1]) partes.push(elipse(s * (L / 2 - 0.4), v, 0.12, 0.42, '#c8a878', z + 0.11 + (k % 2) * 0.12, { contorno: 'leve', detalhe: 3 })); }
    else for (let k = 0; k < 6; k++) bloco(partes, quadro(-L / 2 + 0.9 + (k % 3) * 1.9 + (r() - 0.5) * 0.3, (k < 3 ? -0.6 : 0.6) + (r() - 0.5) * 0.1, (r() - 0.5) * 0.15), 1.1, 0.9, PINHO, z + 0.3, 0.05);
    for (const v of [-0.55, 0.55]) partes.push(tira([-L / 2 + 0.3, v, L / 2 - 0.3, v], 0.03, CORDA, z + 0.5, { ...O, alfa: 0.8, detalhe: 3 }));
  }
  return { pegada: [Math.round((L + 0.7) * 100) / 100, W], partes };
}

/** Cerca de tábuas: os mourões a cada 2,4 m e as tábuas de cima, com uma tábua solta ou faltando de vez em quando. */
function cercaDeTabuas(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], n = Math.max(1, Math.round(C / 2.4)), passo = C / n;
  for (let i = 0; i < n; i++) {
    const a = -C / 2 + i * passo, b = a + passo, falta = r() < 0.12, caida = !falta && r() < 0.1;
    partes.push(tira([a, 0.04, b, 0.04], 0.05, PINHO.sombra, 0.8, { ...O, alfa: 0.8, detalhe: 2 }));
    if (!falta) {
      const sag = (r() - 0.5) * 0.03, pts = caida ? [a, 0, b - 0.3, 0.35] : [a, 0, (a + b) / 2, sag, b, 0];
      partes.push(tira(pts, 0.08, PINHO.nanquim, caida ? 0.3 : 1.15, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(pts.map((v, k) => (k % 2 ? v - 0.008 : v)), 0.05, tom(PINHO.luz, (r() - 0.5) * 0.15), caida ? 0.302 : 1.153, { ...O, detalhe: 2 }));
    }
  }
  for (let i = 0; i <= n; i++) { const u = -C / 2 + i * passo; bloco(partes, quadro(u, 0, (r() - 0.5) * 0.15), 0.15, 0.15, PINHO, 1.25, 0.03); }
  return partes;
}

/** Crânio de boi de chifres longos na areia: o crânio, os chifres abertos com as pontas viradas e escuras, e a areia que cobre um pouco. */
function cranioDeBoi(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = ['#e4dcc6', '#d8ccb0', '#ddd2bc'][Math.floor(r() * 3)]!, ang = (r() - 0.5) * 0.6;
  const c = Math.cos(ang), s = Math.sin(ang), g = (u: number, v: number): [number, number] => [u * c - v * s, u * s + v * c];
  sombraNoChao(partes, bolha(0, 0, 0.35, 0.7, 14, 0.15, r), 0.01, '#4a3420', 0.35, [0, 0]);
  for (const lado of [-1, 1]) {
    const pts: number[] = []; for (let k = 0; k <= 8; k++) { const t = k / 8; pts.push(...g(-0.12 + t * 0.12 + t * t * 0.18, lado * (0.08 + t * 0.62 - t * t * 0.06))); }
    partes.push(tira(pts, 0.14, tom('#c8b898', -0.7), 0.12, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, 0.3), tira(pts, 0.1, '#d8cab0', 0.122, { ...O, detalhe: 2 }, 0.3), tira(pts.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * 0.015), 0.03, '#f0e8d8', 0.123, { ...O, alfa: 0.7, detalhe: 3 }, 0.3));
    const n = pts.length; partes.push(tira(pts.slice(n - 6), 0.045, '#2a2018', 0.124, { ...O, detalhe: 3 }, 0.2));
  }
  cranio(partes, ...g(0.14, 0), ang, 0.55, 0.13, false, cor);
  for (let k = 0; k < 2; k++) { const [x, y] = g(-0.2 + r() * 0.5, (r() - 0.5) * 0.9); partes.push(poli(bolha(x, y, 0.14, 0.09, 10, 0.25, r), '#c9a874', 0.2, { ...S, alfa: 0.8, detalhe: 3 })); }
  return partes;
}

/** Passeio de tábuas (calçada elevada da cidade): as tábuas atravessadas, gastas e de tons trocados, a viga da frente (+y) e os esteios do alpendre a cada 3 m. */
function passeioDeTabuas(seed: number, C: number, L: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, [-C / 2, -L / 2, C / 2, -L / 2, C / 2, L / 2 + 0.12, -C / 2, L / 2 + 0.12], 0.01, '#0d0a08', 0.4, [0, 0.06]);
  partes.push(poli(retQ(ID, 0, 0, C + 0.02, L + 0.02), PINHO.nanquim, 0.25, { contorno: 'leve', detalhe: 1 }));
  for (let u = -C / 2, k = 0; u < C / 2 - 0.01; u += 0.2, k++) {
    const w = Math.min(0.19, C / 2 - u), cor = tom(PINHO.base, (r() - 0.5) * 0.16 + (k % 3 === 0 ? -0.05 : 0));
    partes.push(poli(retQ(ID, u + w / 2, 0, w - 0.012, L - 0.02), cor, 0.252, { ...O, detalhe: 2 }));
    if (r() < 0.25) partes.push(tira([u + 0.04 + r() * 0.1, -L / 2 + 0.1 + r() * L * 0.4, u + 0.05 + r() * 0.1, L / 2 - 0.1 - r() * L * 0.3], 0.008, PINHO.sombra, 0.254, { ...O, alfa: 0.6, detalhe: 3 }));
    for (const v of [-L / 2 + 0.1, L / 2 - 0.12]) partes.push(elipse(u + 0.1, v, 0.02, 0.02, '#2a2a2a', 0.255, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  partes.push(poli(retQ(ID, 0, -L * 0.2, C, L * 0.5), PINHO.brilho, 0.256, { ...S, alfa: 0.12, detalhe: 2 }));
  partes.push(tira([-C / 2, L / 2 - 0.05, C / 2, L / 2 - 0.05], 0.12, PINHO.nanquim, 0.27, { contorno: 'leve', detalhe: 1 }), tira([-C / 2, L / 2 - 0.06, C / 2, L / 2 - 0.06], 0.07, PINHO.sombra, 0.272, { ...O, detalhe: 2 }));
  const n = Math.max(1, Math.round(C / 3));
  for (let i = 0; i <= n; i++) { const u = -C / 2 + 0.1 + (i * (C - 0.2)) / n; bloco(partes, quadro(u, L / 2 - 0.1), 0.16, 0.16, PINHO, 0.9, 0.03); }
  return partes;
}

// ---------- Receitas ----------

const FA = { generos: ['faroeste', 'fantasia'], kit: 'faroeste' };
const luzDeLampiao = (): LuzDeReceita => ({ raio: 3.5, cor: '#ffc070', intensidade: 0.75, power: 'fire', flicker: 0.08 });

/** O kit do faroeste: saloon e cidade (Q18a), rua e estrada de ferro (Q18b). */
export const RECEITAS_DO_FAROESTE: Receita[] = [
  // Q18a: saloon e cidade.
  { id: 'balcao-de-saloon', nome: 'Balcão de saloon', categoria: 'mesas', tipo: 'piso', funcoes: ['saloon', 'taverna'], ...FA, tags: ['balcao', 'bar', 'saloon', 'garrafas', 'prateleira', 'mogno', 'registradora', 'faroeste'], pegada: [4.5, 1.9], altura: 1.2,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4.5, min: 2.5, max: 9, passo: 0.25 }],
    gerar: p => { const C = num(p, 'comprimento', 4.5, 2.5, 9); return piso([C, 1.9], balcaoDeSaloon(p.seed, C)); } },
  { id: 'piano-de-armario', nome: 'Piano de armário', categoria: 'decoracao', tipo: 'piso', funcoes: ['saloon', 'taverna', 'sala', 'salao'], ...FA, tags: ['piano', 'armario', 'musica', 'teclado', 'banco', 'saloon', 'faroeste'], pegada: [1.55, 1.2], altura: 1.35,
    gerar: p => piso([1.55, 1.2], pianoDeArmario(p.seed)) },
  { id: 'mesa-de-poquer', nome: 'Mesa de pôquer', categoria: 'mesas', tipo: 'piso', funcoes: ['saloon', 'taverna', 'sala-de-jogos'], ...FA, tags: ['mesa', 'poquer', 'cartas', 'fichas', 'jogo', 'feltro', 'saloon', 'faroeste'], pegada: [1.4, 1.4], altura: 0.8,
    gerar: p => piso([1.4, 1.4], mesaDePoquer(p.seed)) },
  { id: 'porta-de-vaivem', nome: 'Porta de vaivém', categoria: 'decoracao', tipo: 'piso', funcoes: ['saloon', 'taverna'], ...FA, tags: ['porta', 'vaivem', 'saloon', 'venezianas', 'entrada', 'faroeste'], pegada: [1.5, 0.75], altura: 1.4,
    gerar: p => piso([1.5, 0.75], portaDeVaivem(p.seed)) },
  { id: 'escarradeira', nome: 'Escarradeira', categoria: 'decoracao', tipo: 'piso', funcoes: ['saloon', 'taverna', 'xerifado', 'banco'], ...FA, tags: ['escarradeira', 'latao', 'tabaco', 'saloon', 'faroeste'], pegada: [0.4, 0.4], altura: 0.3,
    gerar: p => piso([0.4, 0.4], escarradeira(p.seed)) },
  { id: 'cabeca-de-bufalo', nome: 'Cabeça de bisão', categoria: 'parede', tipo: 'parede', funcoes: ['saloon', 'taverna', 'sala', 'xerifado', 'salao'], ...FA, tags: ['trofeu', 'bisao', 'bufalo', 'cabeca', 'chifres', 'caca', 'saloon', 'faroeste'], pegada: [1.0, 0.05],
    gerar: p => { const d = cabecaDeBufalo(p.seed); return parede(1.0, d.face, d.topo); } },
  { id: 'placa-de-procurado', nome: 'Cartaz de procurado', categoria: 'parede', tipo: 'parede', funcoes: ['xerifado', 'saloon', 'banco', 'estacao', 'armazem-geral'], ...FA, tags: ['cartaz', 'procurado', 'recompensa', 'papel', 'xerife', 'bandido', 'faroeste'], pegada: [0.45, 0.05],
    gerar: p => { const d = placaDeProcurado(p.seed); return parede(0.45, d.face, d.topo); } },
  { id: 'cofre', nome: 'Cofre', categoria: 'armazenamento', tipo: 'piso', funcoes: ['banco', 'xerifado', 'escritorio', 'estacao'], ...FA, tags: ['cofre', 'ferro', 'ouro', 'dinheiro', 'segredo', 'banco', 'faroeste'], pegada: [1.0, 0.9], altura: 1.3,
    campos: [{ id: 'aberto', rotulo: 'Aberto (0 não, 1 sim)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const c = cofre(p.seed, Math.round(num(p, 'aberto', 0, 0, 1)) === 1); return piso(c.pegada, c.partes); } },
  { id: 'mesa-de-xerife', nome: 'Mesa do xerife', categoria: 'mesas', tipo: 'piso', funcoes: ['xerifado', 'escritorio', 'estacao'], ...FA, tags: ['mesa', 'escrivaninha', 'xerife', 'revolver', 'chapeu', 'lampiao', 'chaves', 'papeis', 'faroeste', 'luz'], pegada: [1.7, 1.4], altura: 0.9,
    luz: luzDeLampiao, gerar: p => piso([1.7, 1.4], mesaDeXerife(p.seed)) },
  { id: 'cela-de-xerife', nome: 'Cela de cadeia', categoria: 'decoracao', tipo: 'piso', funcoes: ['xerifado', 'cela'], ...FA, tags: ['cela', 'cadeia', 'grade', 'prisao', 'catre', 'xerife', 'faroeste'], pegada: [2.6, 2.4], altura: 1.5,
    campos: [{ id: 'aberta', rotulo: 'Porta aberta (0 não, 1 sim)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => piso([2.6, 2.4], celaDeXerife(p.seed, Math.round(num(p, 'aberta', 0, 0, 1)) === 1)) },

  // Q18b: rua e estrada de ferro.
  { id: 'poste-de-amarrar', nome: 'Poste de amarrar com cocho', categoria: 'exterior', tipo: 'piso', funcoes: ['estrada', 'praca', 'estabulo', 'saloon'], ...FA, tags: ['poste', 'amarrar', 'cavalo', 'cocho', 'agua', 'rua', 'faroeste'], pegada: [2.7, 1.1], altura: 1.1,
    gerar: p => piso([2.7, 1.1], posteDeAmarrar(p.seed)) },
  { id: 'diligencia', nome: 'Diligência', categoria: 'exterior', tipo: 'piso', funcoes: ['estrada', 'estacao', 'estabulo', 'praca'], ...FA, tags: ['diligencia', 'carruagem', 'coche', 'malas', 'rodas', 'viagem', 'faroeste'], pegada: [4.8, 1.9], altura: 2.4,
    gerar: p => piso([4.8, 1.9], diligencia(p.seed)) },
  { id: 'carroca-coberta', nome: 'Carroça coberta', categoria: 'exterior', tipo: 'piso', funcoes: ['estrada', 'estabulo', 'praca'], ...FA, tags: ['carroca', 'coberta', 'lona', 'pioneiro', 'rodas', 'viagem', 'faroeste'], pegada: [5.1, 1.9], altura: 2.8,
    gerar: p => piso([5.1, 1.9], carrocaCoberta(p.seed)) },
  { id: 'bomba-de-manivela', nome: 'Bomba de manivela', categoria: 'exterior', tipo: 'piso', funcoes: ['estrada', 'praca', 'estabulo', 'jardim'], ...FA, tags: ['bomba', 'agua', 'manivela', 'poco', 'balde', 'ferro', 'faroeste'], pegada: [1.0, 1.3], altura: 1.2,
    gerar: p => piso([1.0, 1.3], bombaDeManivela(p.seed)) },
  { id: 'cata-vento', nome: 'Cata-vento de fazenda', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'estrada', 'estabulo'], ...FA, tags: ['cata-vento', 'moinho', 'torre', 'fazenda', 'agua', 'rancho', 'faroeste'], pegada: [3.4, 2.6], altura: 9,
    gerar: p => piso([3.4, 2.6], cataVento(p.seed)) },
  { id: 'caixa-dagua-de-ferrovia', nome: "Caixa-d'água da ferrovia", categoria: 'exterior', tipo: 'piso', funcoes: ['estacao', 'estrada'], ...FA, tags: ['caixa-dagua', 'tanque', 'ferrovia', 'trem', 'agua', 'torre', 'faroeste'], pegada: [3.6, 4.0], altura: 8,
    gerar: p => piso([3.6, 4.0], caixaDagua(p.seed)) },
  { id: 'trilho', nome: 'Trilho', categoria: 'exterior', tipo: 'piso', funcoes: ['estacao', 'estrada'], ...FA, tags: ['trilho', 'ferrovia', 'linha', 'dormente', 'brita', 'trem', 'rasteira', 'faroeste'], pegada: [6.1, 3.0], altura: 0.1,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 6, min: 2, max: 20, passo: 0.5 }, { id: 'curva', rotulo: 'Curva (graus; 0 reto)', tipo: 'numero', padrao: 0, min: -90, max: 90, passo: 5 }],
    gerar: p => { const t = trilho(p.seed, num(p, 'comprimento', 6, 2, 20), num(p, 'curva', 0, -90, 90)); return piso(t.pegada, t.partes); } },
  { id: 'locomotiva', nome: 'Locomotiva a vapor', categoria: 'exterior', tipo: 'piso', funcoes: ['estacao', 'estrada'], ...FA, tags: ['locomotiva', 'trem', 'vapor', 'caldeira', 'chamine', 'ferrovia', 'faroeste'], pegada: [10.2, 2.7], altura: 4,
    gerar: p => piso([10.2, 2.7], locomotiva(p.seed)) },
  { id: 'vagao', nome: 'Vagão', categoria: 'exterior', tipo: 'piso', funcoes: ['estacao', 'estrada'], ...FA, tags: ['vagao', 'trem', 'carga', 'passageiros', 'tender', 'carvao', 'plataforma', 'ferrovia', 'faroeste'], pegada: [8.5, 2.6], altura: 3.6,
    campos: [{ id: 'tipo', rotulo: 'Tipo (0 carga, 1 passageiros, 2 tênder, 3 plataforma)', tipo: 'numero', padrao: 0, min: 0, max: 3, passo: 1 }],
    gerar: p => { const v = vagao(p.seed, Math.round(num(p, 'tipo', 0, 0, 3))); return piso(v.pegada, v.partes); } },
  { id: 'cerca-de-tabuas', nome: 'Cerca de tábuas', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'estrada', 'estabulo'], ...FA, tags: ['cerca', 'tabuas', 'mourao', 'curral', 'rancho', 'madeira', 'faroeste'], pegada: [4.8, 0.3], altura: 1.3,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4.8, min: 1.2, max: 14, passo: 0.2 }],
    gerar: p => { const C = num(p, 'comprimento', 4.8, 1.2, 14); return piso([C, 0.3], cercaDeTabuas(p.seed, C)); } },
  { id: 'cranio-de-boi', nome: 'Crânio de boi', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'estrada'], ...FA, tags: ['cranio', 'boi', 'chifres', 'ossos', 'deserto', 'faroeste'], pegada: [0.8, 1.5], altura: 0.25,
    gerar: p => piso([0.8, 1.5], cranioDeBoi(p.seed)) },
  { id: 'passeio-de-tabuas', nome: 'Passeio de tábuas', categoria: 'exterior', tipo: 'piso', funcoes: ['estrada', 'praca', 'varanda', 'saloon', 'estacao'], ...FA, tags: ['passeio', 'calcada', 'tabuas', 'tablado', 'alpendre', 'esteio', 'rua', 'cidade', 'faroeste'], pegada: [6, 1.8], altura: 0.3,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 6, min: 1.5, max: 24, passo: 0.5 }, { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 1.8, min: 1, max: 4, passo: 0.1 }],
    gerar: p => { const C = num(p, 'comprimento', 6, 1.5, 24), L = num(p, 'largura', 1.8, 1, 4); return piso([C, L], passeioDeTabuas(p.seed, C, L)); } },
];
