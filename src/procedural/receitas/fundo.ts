import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';
import { faixa, rot } from './porto.ts';

const F = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['agua', 'praia'], kit: 'fundo' };
const SUBMERSO = { ...F, submerso: true as const };
const BARCO = { ...F, kit: 'barcos', funcoes: ['agua', 'porto', 'praia'] };
const FINO: Partial<Parte> = { contorno: false, semSombra: true, detalhe: 3 };
const SOMBRA = '#2a1c10';

/** Casco simétrico de `L × B`, ponta em `proaFim` (1 = afiado nas duas pontas, <1 = popa chata): meia-largura em `u` de 0 a 1. */
function casco(L: number, B: number, k: number, popa = 0.35, passos = 20): number[] {
  const a: number[] = [], b: number[] = [];
  for (let i = 0; i <= passos; i++) { const u = i / passos, h = (B / 2) * k * Math.max(popa * (1 - u) + Math.pow(Math.sin(u * Math.PI), 0.7) * (1 - popa * (1 - u)) * 1, 0) * (u > 0.5 ? 1 : 1); const x = -L / 2 * k + u * L * k; a.push(x, -h); b.unshift(x, h); }
  return [...a, ...b];
}

/** Um remo de `len` m de (x, y) para `ang`, com a pá no fim. */
function remo(x: number, y: number, ang: number, len: number, z: number): Parte[] {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [...faixa([x, y, x + c * len, y + s * len], 0.05, 'madeira.media', z, { contorno: 'leve', semSombra: true, detalhe: 2 }), poli(rot(x + c * (len - 0.16), y + s * (len - 0.16), 0.36, 0.14, ang), 'madeira.clara', z + 0.01, { contorno: 'leve', semSombra: true, detalhe: 2 })];
}

/** Um caixote pequeno visto de cima. */
const caixa = (x: number, y: number, s: number, ang: number, z: number): Parte[] => [poli(rot(x + 0.03, y + 0.04, s, s, ang), SOMBRA, z, { contorno: false, sombraLeve: true }), poli(rot(x, y, s, s, ang), 'madeira.media', z + 0.01, { contorno: 'leve', detalhe: 1 }), poli(rot(x, y, s * 0.74, s * 0.74, ang), 'madeira.clara', z + 0.02, { contorno: false, semSombra: true, detalhe: 2 })];

/** Fundo do mar, barcos pequenos: o que fica sob a água e o que boia nela. */
export const RECEITAS_FUNDO: Receita[] = [
  { id: 'coral', nome: 'Coral', ...SUBMERSO, tags: ['coral', 'recife', 'mar', 'submerso', 'agua'], pegada: [1.0, 1.0], altura: 0.3,
    campos: [{ id: 'cor', rotulo: 'Cor (0 rosado, 1 lilás)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), base = Math.round(num(p, 'cor', 0, 0, 1)) === 1 ? '#a070c0' : '#e0708a', partes: Parte[] = [], n = 5 + Math.floor(r() * 3);
      partes.push(elipse(0.03, 0.04, 0.9, 0.9, '#10202a', 0.5, { contorno: false, sombraLeve: true }));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + r(), d = i === 0 ? 0 : 0.2 + r() * 0.1, x = Math.cos(a) * d, y = Math.sin(a) * d, t = 0.3 + r() * 0.16, z = 0.6 + i * 0.05;
        partes.push(elipse(x, y, t, t, tom(base, -0.25), z, { contorno: 'leve', detalhe: 1 }));
        for (let k = 0; k < 9; k++) { const b = r() * Math.PI * 2, e = r() * t * 0.34; partes.push(elipse(x + Math.cos(b) * e - t * 0.06, y + Math.sin(b) * e - t * 0.06, t * 0.34, t * 0.3, tom(base, k % 3 ? 0.1 : 0.28), z + 0.01 + k * 0.001, { contorno: false, semSombra: true, detalhe: 2 })); }
        for (let k = 0; k < 4; k++) partes.push(elipse(x + (r() - 0.5) * t * 0.5, y + (r() - 0.5) * t * 0.5, 0.025, 0.025, tom(base, -0.45), z + 0.03, FINO));
      }
      return piso([1.0, 1.0], partes);
    } },
  { id: 'ourico', nome: 'Ouriço-do-mar', ...SUBMERSO, tags: ['ourico', 'espinhos', 'mar', 'submerso', 'agua'], pegada: [0.5, 0.5], altura: 0.15,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [elipse(0.02, 0.03, 0.4, 0.4, '#0a1418', 0.5, { contorno: false, sombraLeve: true })];
      for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + r() * 0.1, l = 0.14 + r() * 0.06; partes.push(...faixa([Math.cos(a) * 0.08, Math.sin(a) * 0.08, Math.cos(a) * (0.08 + l), Math.sin(a) * (0.08 + l)], 0.018, i % 4 ? '#3a2850' : '#6a4a8a', 0.6 + i * 0.002, FINO)); }
      partes.push(elipse(0, 0, 0.2, 0.2, '#4a3068', 0.8, { contorno: 'leve', detalhe: 1 }), elipse(-0.04, -0.04, 0.09, 0.08, '#8a6aaa', 0.85, FINO));
      return piso([0.5, 0.5], partes);
    } },
  { id: 'anemona', nome: 'Anêmona', ...SUBMERSO, tags: ['anemona', 'tentaculos', 'mar', 'submerso', 'agua'], pegada: [0.8, 0.8], altura: 0.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [elipse(0.03, 0.04, 0.7, 0.7, '#0a1a1c', 0.5, { contorno: false, sombraLeve: true })];
      for (let anel = 0; anel < 2; anel++) for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2 + anel * 0.17 + r() * 0.08, i0 = 0.08 + anel * 0.05, l = (anel ? 0.2 : 0.3) + r() * 0.04, mid = a + 0.18; partes.push(...faixa([Math.cos(a) * i0, Math.sin(a) * i0, Math.cos(mid) * (i0 + l * 0.6), Math.sin(mid) * (i0 + l * 0.6), Math.cos(a + 0.1) * (i0 + l), Math.sin(a + 0.1) * (i0 + l)], 0.04 - anel * 0.012, anel ? '#e07a9a' : '#c05a7a', 0.6 + anel * 0.1 + i * 0.002, { contorno: false, semSombra: true, detalhe: 2 }), elipse(Math.cos(a + 0.1) * (i0 + l), Math.sin(a + 0.1) * (i0 + l), 0.05, 0.05, '#fbd8e0', 0.85 + anel * 0.02, FINO)); }
      partes.push(elipse(0, 0, 0.2, 0.2, '#d8602a', 0.9, { contorno: 'leve', detalhe: 1 }), elipse(0, 0, 0.09, 0.09, '#3a1408', 0.95, FINO));
      return piso([0.8, 0.8], partes);
    } },
  { id: 'alga', nome: 'Alga', ...SUBMERSO, tags: ['alga', 'planta', 'mar', 'submerso', 'agua'], pegada: [1.1, 1.2], altura: 0.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 7 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 1.1 + (r() - 0.5) * 0.2, l = 0.7 + r() * 0.4, ond = 0.12 + r() * 0.1, fase = r() * 6, pts: number[] = [];
        for (let k = 0; k <= 8; k++) { const t = k / 8, perp = Math.sin(t * 5 + fase) * ond * t, c = Math.cos(a), s = Math.sin(a); pts.push(c * t * l - s * perp, 0.45 + s * t * l + c * perp); }
        const cor = ['#2f6a3a', '#3f8a46', '#1f5a4a'][i % 3]!;
        partes.push(...faixa(pts.map((v, k) => v + (k % 2 ? 0.03 : 0.02)), 0.09, '#0a1a14', 0.5, { contorno: false, sombraLeve: true }), ...faixa(pts, 0.085, cor, 0.6 + i * 0.01, { contorno: 'leve', semSombra: true, detalhe: 2 }), ...faixa(pts.map((v, k) => (k % 2 ? v : v - 0.01)), 0.025, tom(cor, 0.3), 0.62 + i * 0.01, FINO));
      }
      partes.push(elipse(0, 0.5, 0.22, 0.16, '#3a3a40', 0.9, { contorno: 'leve', detalhe: 2 }));
      return piso([1.1, 1.2], partes);
    } },
  { id: 'rocha-submersa', nome: 'Rocha submersa', ...SUBMERSO, tags: ['rocha', 'pedra', 'mar', 'submerso', 'agua'], pegada: [1.6, 1.2], altura: 0.4,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 14, borda: number[] = [];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.82 + r() * 0.18; borda.push(Math.cos(a) * 0.76 * k, Math.sin(a) * 0.56 * k); }
      partes.push(poli(borda.map(v => v + 0.03), '#0a1418', 0.5, { contorno: false, sombraLeve: true }), poli(borda, '#5a6068', 0.6, { contorno: 'leve', detalhe: 1 }), poli(borda.map(v => v * 0.7 - 0.04), '#7a8088', 0.7, { contorno: false, semSombra: true, detalhe: 2 }), poli(borda.map(v => v * 0.38 - 0.1), '#9aa0a6', 0.75, { contorno: false, semSombra: true, detalhe: 2 }));
      for (let i = 0; i < 10; i++) { const a = r() * Math.PI * 2, d = 0.3 + r() * 0.4; partes.push(elipse(Math.cos(a) * d * 0.9, Math.sin(a) * d * 0.65, 0.1 + r() * 0.1, 0.07 + r() * 0.07, i % 2 ? '#3a6a3a' : '#2a5a4a', 0.8 + i * 0.002, FINO)); }
      return piso([1.6, 1.2], partes);
    } },
  { id: 'barco-a-remo', nome: 'Barco a remo', ...BARCO, tags: ['barco', 'remo', 'bote', 'agua', 'pequeno'], pegada: [3.2, 1.8], altura: 0.5,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], L = 3.0, B = 1.2;
      partes.push(poli(casco(L, B, 1).map((v, i) => v + (i % 2 ? 0.05 : 0.04)), SOMBRA, 0.5, { contorno: false, sombraLeve: true }), poli(casco(L, B, 1), 'madeira.escura', 0.6, { contorno: 'leve', detalhe: 1 }), poli(casco(L, B, 0.84), 'madeira.clara', 0.7, { dir: 0, contorno: false, semSombra: true, detalhe: 1 }));
      for (let k = -2; k <= 2; k++) partes.push(ret(0, k * 0.2, L * 0.86, 0.014, tom('#3a2412', -0.1), 0.72, FINO));
      for (const x of [-0.7, 0.1, 0.8]) partes.push(ret(x, 0, 0.16, B * 0.8, 'madeira.media', 0.8, { contorno: 'leve', semSombra: true, detalhe: 2 }));
      partes.push(...faixa(casco(L, B, 0.97).slice(0, 44), 0.06, 'madeira.media', 0.85, { contorno: 'leve', semSombra: true, detalhe: 2 }), ...faixa(casco(L, B, 0.97).slice(44), 0.06, 'madeira.media', 0.85, { contorno: 'leve', semSombra: true, detalhe: 2 }), elipse(-0.1, -0.62, 0.12, 0.12, 'ferro', 0.9, FINO), elipse(-0.1, 0.62, 0.12, 0.12, 'ferro', 0.9, FINO), elipse(L / 2 - 0.1, 0, 0.14, 0.14, 'ferro', 0.9, FINO));
      partes.push(...remo(-0.1, -0.62, -2.95 + (r() - 0.5) * 0.2, 1.1, 0.95), ...remo(-0.1, 0.62, 2.95 + (r() - 0.5) * 0.2, 1.1, 0.95));
      return piso([3.2, 1.8], partes);
    } },
  { id: 'barco-de-vela', nome: 'Barco de vela', ...BARCO, tags: ['barco', 'vela', 'flutuador', 'agua', 'pequeno'], pegada: [4.6, 2.4], altura: 3,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], L = 4.2, B = 0.8, fy = 0.95;
      const flut = (k: number, y: number): number[] => casco(L * 0.8, 0.32, k).map((v, i) => (i % 2 ? v + y : v));
      partes.push(poli(flut(1, fy).map((v, i) => v + (i % 2 ? 0.05 : 0.04)), SOMBRA, 0.5, { contorno: false, sombraLeve: true }), poli(flut(1, fy), 'madeira.clara', 0.6, { contorno: 'leve', detalhe: 1 }), poli(flut(0.7, fy), tom('#e8dcc0', 0.1), 0.65, { contorno: false, semSombra: true, detalhe: 2 }));
      for (const x of [-0.9, 0.9]) partes.push(ret(x, fy / 2, 0.12, fy, 'madeira.media', 0.7, { contorno: 'leve', sombraLeve: true, detalhe: 2 }), ...faixa([x - 0.06, 0.1, x + 0.06, fy - 0.1], 0.03, '#c8bca0', 0.75, FINO));
      partes.push(poli(casco(L, B, 1).map((v, i) => v + (i % 2 ? 0.05 : 0.04)), SOMBRA, 0.5, { contorno: false, sombraLeve: true }), poli(casco(L, B, 1), 'madeira.escura', 0.7, { contorno: 'leve', detalhe: 1 }), poli(casco(L, B, 0.82), 'madeira.clara', 0.8, { dir: 0, contorno: false, semSombra: true, detalhe: 1 }));
      partes.push(poli(rot(-0.1 + r() * 0.1, 0, 2.6, 0.16, (r() - 0.5) * 0.06), tom('#e6dbc3', -0.15), 1.5, { contorno: 'leve', sombraLeve: true, detalhe: 2 }), poli(rot(0, 0.04, 2.3, 0.07, 0), tom('#f6efdd', 0.1), 1.55, FINO), ...faixa([-1.1, 0.06, -1.1, -0.06, -0.3, -0.06], 0.02, '#a8895a', 1.6, FINO), elipse(-0.3, 0, 0.2, 0.2, 'madeira.escura', 1.8, { contorno: 'leve', detalhe: 1 }), elipse(-0.3, 0, 0.09, 0.09, tom('#b88a55', 0.1), 1.9, FINO));
      partes.push(ret(L * 0.38, 0, 0.12, 0.5, 'madeira.media', 0.9, { contorno: 'leve', semSombra: true, detalhe: 2 }), ...faixa([L * 0.4, 0, L * 0.5 - 0.05, 0], 0.07, 'madeira.media', 0.95, { contorno: 'leve', semSombra: true, detalhe: 2 }));
      return piso([4.6, 2.4], partes);
    } },
  { id: 'bote-com-carga', nome: 'Bote com carga', ...BARCO, tags: ['barco', 'bote', 'carga', 'caixote', 'agua'], pegada: [3.6, 1.6], altura: 0.9,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], L = 3.4, B = 1.4;
      partes.push(poli(casco(L, B, 1, 0.5).map((v, i) => v + (i % 2 ? 0.05 : 0.04)), SOMBRA, 0.5, { contorno: false, sombraLeve: true }), poli(casco(L, B, 1, 0.5), 'madeira.escura', 0.6, { contorno: 'leve', detalhe: 1 }), poli(casco(L, B, 0.84, 0.5), 'madeira.media', 0.7, { dir: 0, contorno: false, semSombra: true, detalhe: 1 }));
      for (const [x, y, s] of [[-0.7, -0.2, 0.5], [-0.15, 0.25, 0.44], [0.25, -0.3, 0.4]] as const) partes.push(...caixa(x + (r() - 0.5) * 0.06, y, s, (r() - 0.5) * 0.4, 1.0));
      for (let i = 0; i < 3; i++) partes.push(elipse(0.55 + i * 0.22, (i - 1) * 0.28, 0.38, 0.26, ['tecido.linho', 'tecido.mostarda', 'tecido.salvia'][i]!, 1.0 + i * 0.01, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      partes.push(poli(rot(-0.2, 0.05, 1.5, 0.9, 0.06), 'tecido.cinza', 1.5, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(rot(-0.3, -0.05, 0.9, 0.4, 0.06), tom('#9a9ea6', 0.2), 1.55, FINO), ...faixa([-0.8, -0.3, 0.4, 0.4], 0.035, '#d8cfae', 1.6, FINO), ...faixa([-0.8, 0.4, 0.4, -0.3], 0.035, '#d8cfae', 1.6, FINO));
      partes.push(...faixa(casco(L, B, 0.97, 0.5).slice(0, 44), 0.06, 'madeira.media', 0.85, { contorno: 'leve', semSombra: true, detalhe: 2 }), ...faixa(casco(L, B, 0.97, 0.5).slice(44), 0.06, 'madeira.media', 0.85, { contorno: 'leve', semSombra: true, detalhe: 2 }), elipse(L / 2 - 0.1, 0, 0.14, 0.14, 'ferro', 0.9, FINO));
      return piso([3.6, 1.6], partes);
    } },
];
