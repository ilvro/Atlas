import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { bolha, lente, LUZ_X, LUZ_Y } from '../organico.ts';
import { num, piso, type Receita } from './comum.ts';

// Chão da cidade (Frente Q, Q8): sinalização pintada no asfalto, bueiros e manchas, e folhas largas para o chão de selva.
// A tinta é gasta: cada faixa é feita de placas com a borda tremida e falhas onde o asfalto aparece. Gire o objeto para seguir a rua.

const RUA = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['rua', 'estacionamento', 'patio'], kit: 'moderno', generos: ['moderno', 'pos-apocaliptico', 'cyberpunk'] };
const O = { contorno: false as const, semSombra: true };
const BRANCO = '#e4e2da', AMARELO = '#e0b43a';

/**
 * Uma faixa de tinta de `L` × `W` m centrada em (cx, cy): uma tira contínua de borda levemente tremida (a tinta não vem em placas),
 * mais clara ou mais rala conforme o desgaste (0 nova, 1 quase apagada). O desgaste abre falhas irregulares onde o asfalto aparece
 * e deixa grão escuro por cima.
 */
function tinta(partes: Parte[], r: () => number, cx: number, cy: number, L: number, W: number, cor: string, desgaste: number): void {
  const n = Math.max(4, Math.round(L / 0.12)), tr = 0.008 + desgaste * 0.012, cima: number[] = [], baixo: number[] = [];
  for (let k = 0; k <= n; k++) { const x = cx - L / 2 + (k / n) * L; cima.push(x, cy - W / 2 + (r() - 0.5) * tr); baixo.push(x, cy + W / 2 + (r() - 0.5) * tr); }
  const volta: number[] = []; for (let k = n; k >= 0; k--) volta.push(baixo[k * 2]!, baixo[k * 2 + 1]!);
  partes.push(poli([...cima, ...volta], cor, 0.012, { ...O, alfa: 0.9 - desgaste * 0.4, detalhe: 1 }));
  // Falhas: manchas de asfalto por cima da tinta, mais e maiores com o desgaste.
  const nFalhas = Math.round(L * W * 14 * desgaste * desgaste + L * desgaste * 1.5);
  for (let f = 0; f < nFalhas; f++) {
    const fx = cx - L / 2 + r() * L, fy = cy + (r() - 0.5) * W, rf = Math.min(W * 0.7, 0.03 + r() * 0.12 * desgaste);
    partes.push(poli(bolha(fx, fy, rf * (1 + r()), rf, 9, 0.45, r, r() * 3), '#36373a', 0.013, { ...O, alfa: 0.7 + r() * 0.25, detalhe: 2 }));
  }
  const nGrao = Math.round(L * W * 220 * (0.3 + desgaste));
  for (let g = 0; g < nGrao; g++) partes.push(elipse(cx - L / 2 + r() * L, cy + (r() - 0.5) * W, 0.008 + r() * 0.012, 0.008 + r() * 0.012, '#2a2a2c', 0.0135, { ...O, alfa: 0.45 + r() * 0.4, detalhe: 3 }));
}

/** Meio-fio: guia de concreto de 15 cm de largura em blocos de 1 m, com a face virada para a rua em sombra e o topo gasto. */
function meioFio(seed: number, L: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], w = 0.15, n = Math.max(1, Math.round(L));
  partes.push(ret(0, w * 0.75, L, w * 0.7, '#0e0e10', 0.005, { ...O, alfa: 0.45, desfoque: 0.05, detalhe: 1 }));
  for (let k = 0; k < n; k++) {
    const x = -L / 2 + (k + 0.5) * (L / n), c = tom('#a6a39c', (r() - 0.5) * 0.12);
    partes.push(ret(x, 0, L / n - 0.012, w, c, 0.15, { contorno: 'leve', semSombra: false, detalhe: 1 }));
    partes.push(ret(x, -w * 0.3, L / n - 0.03, w * 0.28, tom(c, 0.12), 0.151, { ...O, detalhe: 2 }));
    partes.push(ret(x, w * 0.38, L / n - 0.02, w * 0.22, tom(c, -0.25), 0.151, { ...O, detalhe: 2 }));
  }
  return partes;
}

function faixaDePedestre(seed: number, largura: number, desgaste: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], listra = 0.45, vao = 0.45, n = Math.max(2, Math.round(largura / (listra + vao)));
  // As listras correm ao longo da rua (x) e se repetem através dela (y): o pedestre atravessa em y.
  for (let i = 0; i < n; i++) { const y = -((n - 1) * (listra + vao)) / 2 + i * (listra + vao); tinta(partes, r, 0, y, 3, listra, BRANCO, desgaste); }
  return partes;
}

function linha(seed: number, comprimento: number, tracejada: boolean, cor: string, desgaste: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], w = 0.12;
  if (!tracejada) { tinta(partes, r, 0, 0, comprimento, w, cor, desgaste); return partes; }
  for (let x = -comprimento / 2; x < comprimento / 2 - 0.5; x += 3) tinta(partes, r, x + 1, 0, Math.min(2, comprimento / 2 - x), w, cor, desgaste);
  return partes;
}

function vaga(seed: number, desgaste: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 5, W = 2.5, w = 0.1;
  tinta(partes, r, 0, -W / 2, L, w, BRANCO, desgaste);
  tinta(partes, r, 0, W / 2, L, w, BRANCO, desgaste);
  // A linha do fundo é a mesma tinta, girada: desenhada em x e depois rodada 90° em volta da ponta.
  const fundo: Parte[] = []; tinta(fundo, r, 0, 0, W + w, w, BRANCO, desgaste);
  // (x, y) → (−L/2 + y, x): a faixa deitada vira a linha do fundo, em pé, na ponta da vaga.
  for (const p of fundo) partes.push(p.pts ? { ...p, pts: p.pts.map((_, i, a) => (i % 2 ? a[i - 1]! : -L / 2 + a[i + 1]!)) } : { ...p, x: -L / 2 + p.y!, y: p.x! });
  return partes;
}

/** Bueiro: tampa de ferro redonda com nervuras em grade ou grelha retangular de meio-fio, com o anel de sujeira em volta. */
function bueiro(seed: number, grelha: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], ferro = '#2e2f32', claro = '#4c4e52';
  partes.push(poli(bolha(0, 0, grelha ? 0.54 : 0.4, grelha ? 0.3 : 0.4, 18, 0.1, r), '#151517', 0.01, { ...O, alfa: 0.55, desfoque: 0.06, detalhe: 1 }));
  if (grelha) {
    partes.push(ret(0, 0, 0.9, 0.42, ferro, 0.02, { contorno: 'leve', semSombra: true, detalhe: 1 }));
    for (let i = 0; i < 7; i++) partes.push(ret(-0.36 + i * 0.12, 0, 0.05, 0.34, '#0c0c0e', 0.021, { ...O, detalhe: 2 }));
    partes.push(ret(0, -0.19, 0.86, 0.02, claro, 0.022, { ...O, detalhe: 2 }));
  } else {
    partes.push(elipse(0, 0, 0.66, 0.66, ferro, 0.02, { contorno: 'leve', semSombra: true, detalhe: 1 }));
    partes.push(elipse(0, 0, 0.58, 0.58, tom(ferro, 0.08), 0.021, { ...O, detalhe: 1 }));
    for (let k = -2; k <= 2; k++) { partes.push(ret(k * 0.1, 0, 0.025, 0.52 * Math.sqrt(1 - (k * 0.1 / 0.29) ** 2), '#1c1d20', 0.022, { ...O, detalhe: 2 })); partes.push(ret(0, k * 0.1, 0.52 * Math.sqrt(1 - (k * 0.1 / 0.29) ** 2), 0.025, '#1c1d20', 0.022, { ...O, detalhe: 2 })); }
    partes.push(elipse(-LUZ_X * -0.06, -LUZ_Y * -0.06, 0.5, 0.5, claro, 0.023, { ...O, alfa: 0.18, suave: true, detalhe: 2 }));
  }
  return partes;
}

/** Mancha de óleo: poça escura de borda irregular, com um brilho de arco-íris fraco por cima. */
function manchaDeOleo(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  partes.push(poli(bolha(0, 0, R, R * (0.6 + r() * 0.3), 22, 0.35, r, r() * 3), '#141416', 0.008, { ...O, alfa: 0.4, desfoque: R * 0.15, detalhe: 1 }));
  partes.push(poli(bolha(r() * 0.1, r() * 0.1, R * 0.6, R * 0.4, 16, 0.3, r, r() * 3), '#0a0a0c', 0.009, { ...O, alfa: 0.35, desfoque: R * 0.1, detalhe: 1 }));
  for (const [cor, k] of [['#5a5070', 0.35], ['#4a6a60', 0.28]] as const) partes.push(poli(bolha((r() - 0.5) * R * 0.5, (r() - 0.5) * R * 0.4, R * k, R * k * 0.5, 12, 0.3, r, r() * 3), cor, 0.0095, { ...O, alfa: 0.1, desfoque: R * 0.08, detalhe: 2 }));
  return partes;
}

/** Folhas largas caídas no chão de selva: folhas inteiras de 20 a 45 cm, verdes e amareladas, com nervura central, sobre nanquim. */
function folhasLargas(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), nanquim: Parte[] = [], cor: Parte[] = [], tons = ['#3e5a24', '#4a6a2a', '#6a6a2a', '#7a5e2a', '#34502a'];
  const n = Math.round(9 * R * R / 0.36 + 3);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(r()) * R, a0 = r() * Math.PI * 2, x = Math.cos(a0) * d, y = Math.sin(a0) * d, a = r() * Math.PI * 2, l = 0.2 + r() * 0.25, w = l * (0.38 + r() * 0.12), c = tons[Math.floor(r() * tons.length)]!;
    const luz = Math.cos(a) * LUZ_X + Math.sin(a) * LUZ_Y;
    nanquim.push(lente(x, y, a, l + 0.025, w + 0.025, '#0e100a', 0.03 + i * 0.0004, { ...O, alfa: 0.75 }));
    cor.push(lente(x, y, a, l, w, luz > 0.3 ? tom(c, 0.1) : luz < -0.3 ? tom(c, -0.12) : c, 0.031 + i * 0.0004, { ...O, suave: true, detalhe: 1 }));
    cor.push(lente(x, y, a, l * 0.95, w * 0.08, tom(c, 0.25), 0.0315 + i * 0.0004, { ...O, detalhe: 3 }));
  }
  return [...nanquim, ...cor];
}

const DESGASTE = { id: 'desgaste', rotulo: 'Desgaste (0 nova, 1 apagada)', tipo: 'numero' as const, padrao: 0.4, min: 0, max: 1, passo: 0.1 };

export const RECEITAS_DA_CIDADE: Receita[] = [
  { id: 'faixa-de-pedestre', nome: 'Faixa de pedestre', ...RUA, tags: ['faixa', 'pedestre', 'zebra', 'rua', 'sinalizacao', 'cidade', 'pintura'], pegada: [3, 5.4], altura: 0.01,
    campos: [{ id: 'largura', rotulo: 'Largura da rua (m)', tipo: 'numero', padrao: 5.4, min: 1.8, max: 12, passo: 0.9 }, DESGASTE],
    gerar: p => { const L = num(p, 'largura', 5.4, 1.8, 12), d = num(p, 'desgaste', 0.4, 0, 1); return piso([3, L], faixaDePedestre(p.seed, L, d)); } },
  { id: 'faixa-continua', nome: 'Faixa contínua', ...RUA, tags: ['faixa', 'linha', 'rua', 'sinalizacao', 'cidade', 'pintura', 'amarela'], pegada: [8, 0.2], altura: 0.01,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 8, min: 1, max: 20, passo: 1 }, { id: 'amarela', rotulo: 'Amarela (0 branca, 1 amarela)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }, DESGASTE],
    gerar: p => { const L = num(p, 'comprimento', 8, 1, 20), d = num(p, 'desgaste', 0.4, 0, 1); return piso([L, 0.2], linha(p.seed, L, false, num(p, 'amarela', 1, 0, 1) >= 0.5 ? AMARELO : BRANCO, d)); } },
  { id: 'faixa-tracejada', nome: 'Faixa tracejada', ...RUA, tags: ['faixa', 'linha', 'tracejada', 'rua', 'sinalizacao', 'cidade', 'pintura'], pegada: [8, 0.2], altura: 0.01,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 8, min: 3, max: 20, passo: 1 }, DESGASTE],
    gerar: p => { const L = num(p, 'comprimento', 8, 3, 20), d = num(p, 'desgaste', 0.4, 0, 1); return piso([L, 0.2], linha(p.seed, L, true, BRANCO, d)); } },
  { id: 'vaga-pintada', nome: 'Vaga pintada', ...RUA, tags: ['vaga', 'estacionamento', 'carro', 'sinalizacao', 'cidade', 'pintura'], pegada: [5, 2.6], altura: 0.01, campos: [DESGASTE],
    gerar: p => piso([5, 2.6], vaga(p.seed, num(p, 'desgaste', 0.4, 0, 1))) },
  { id: 'meio-fio', nome: 'Meio-fio', ...RUA, tags: ['meio-fio', 'guia', 'calcada', 'rua', 'borda', 'cidade'], pegada: [4, 0.3], altura: 0.15,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4, min: 1, max: 20, passo: 1 }],
    gerar: p => { const L = num(p, 'comprimento', 4, 1, 20); return piso([L, 0.3], meioFio(p.seed, L)); } },
  { id: 'bueiro', nome: 'Bueiro', ...RUA, tags: ['bueiro', 'tampa', 'esgoto', 'grelha', 'rua', 'cidade'], pegada: [0.9, 0.9], altura: 0.03,
    campos: [{ id: 'grelha', rotulo: 'Grelha de meio-fio (0 tampa, 1 grelha)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const g = num(p, 'grelha', 0, 0, 1) >= 0.5; return piso(g ? [1.2, 0.7] : [0.9, 0.9], bueiro(p.seed, g)); } },
  { id: 'mancha-de-oleo', nome: 'Mancha de óleo', ...RUA, tags: ['mancha', 'oleo', 'sujeira', 'rua', 'garagem', 'rasteira', 'cidade'], pegada: [1.2, 0.9], altura: 0.01,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.6, min: 0.2, max: 1.5, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 0.6, 0.2, 1.5); return piso([R * 2, R * 2], manchaDeOleo(p.seed, R)); } },
  { id: 'folhas-largas', nome: 'Folhas largas caídas', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], kit: 'mata', tags: ['folhas', 'selva', 'tropical', 'rasteira', 'chao', 'natureza'], pegada: [1.6, 1.6], altura: 0.04,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.8, min: 0.4, max: 1.6, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 0.8, 0.4, 1.6); return piso([R * 2, R * 2], folhasLargas(p.seed, R)); } },
];
