import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, parede, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { ID, MADEIRA, O, S, anel, arco, bloco, disco, em, estofado, olhar, quadro, retQ, retR, tomDaFace, type Quadro, type Tons } from './antiguidade.ts';
import { LATAO, PRATA } from './deserto.ts';

// Faroeste (Q18): saloon e cidade (Q18a). Mogno envernizado do saloon, pinho cinzento de tábua velha,
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

// ---------- Receitas ----------

const FA = { generos: ['faroeste', 'fantasia'], kit: 'faroeste' };
const luzDeLampiao = (): LuzDeReceita => ({ raio: 3.5, cor: '#ffc070', intensidade: 0.75, power: 'fire', flicker: 0.08 });

/** O kit do faroeste: saloon e cidade (Q18a). */
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
];
