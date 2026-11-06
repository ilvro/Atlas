import { elipse, poli, type DescricaoDePiso, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import type { GeradorPesado } from './index.ts';

const num = (v: unknown, padrao: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : padrao);

/** Uma folha em forma de lente: da base (x, y) para a direção `ang`, com `len` de comprimento e `w` de largura. */
function folha(x: number, y: number, ang: number, len: number, w: number, mat: string, z: number, extra: Partial<Parte> = {}): Parte {
  const c = Math.cos(ang), s = Math.sin(ang), local = [0, 0, len * 0.3, w / 2, len * 0.7, w / 3, len, 0, len * 0.7, -w / 3, len * 0.3, -w / 2];
  const pts: number[] = []; for (let i = 0; i < local.length; i += 2) pts.push(x + local[i]! * c - local[i + 1]! * s, y + local[i]! * s + local[i + 1]! * c);
  return poli(pts, mat, z, { contorno: false, sombraLeve: true, ...extra });
}
/** Uma estrela de `pontas` pontas (copa de pinheiro): raio externo `re`, interno `ri`. */
const estrela = (cx: number, cy: number, pontas: number, re: number, ri: number, giro: number): number[] => { const pts: number[] = []; for (let i = 0; i < pontas * 2; i++) { const a = giro + (i / (pontas * 2)) * Math.PI * 2, r = i % 2 ? ri : re; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } return pts; };

/** Copa redonda em anéis de touceiras, do escuro de fora ao claro do meio (a luz lê o volume pelos `z`); folhas pequenas por cima. */
function copaRedonda(diametro: number, seed: number, verde = ['#1d3d24', '#2a5530', '#3a6f3f', '#52894a', '#6fa65a']): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [];
  // O tronco só aparece na borda: um pedaço de galho e tronco para o lado da frente.
  partes.push(elipse(R * 0.12, R * 0.78, R * 0.1, R * 0.16, 'madeira.escura', 0.3, { sombraLeve: true }), elipse(R * 0.08, R * 0.9, R * 0.07, R * 0.07, 'madeira.media', 0.32, { contorno: false, semSombra: true }));
  const aneis = verde.length;
  for (let a = 0; a < aneis; a++) {
    const raioDoAnel = R * (1 - a * (0.78 / aneis)) * (a === 0 ? 0.86 : 1), n = Math.round(10 + (aneis - a) * 5 + R * 3), tam = R * (0.46 - a * 0.045);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r() * 0.5, d = raioDoAnel * 0.84 * (0.78 + r() * 0.22) * (a === aneis - 1 ? 0.5 : 1), t = tam * (0.8 + r() * 0.5);
      partes.push(elipse(Math.cos(ang) * d, Math.sin(ang) * d, t, t * (0.85 + r() * 0.2), verde[a]!, 2 + a * 0.5 + r() * 0.15, { sombraLeve: true, contorno: a === 0 ? 'leve' : false, detalhe: 1 }));
    }
  }
  const folhas = Math.round(40 + R * 14);
  for (let i = 0; i < folhas; i++) { const ang = r() * Math.PI * 2, d = R * Math.sqrt(r()) * 0.92; partes.push(folha(Math.cos(ang) * d, Math.sin(ang) * d, r() * Math.PI * 2, 0.22 + r() * 0.1, 0.1, r() < 0.5 ? verde[Math.min(aneis - 1, 3)]! : tom(verde[aneis - 1]!, 0.15), 3 + aneis * 0.5 + r() * 0.3, { detalhe: 3, semSombra: true })); }
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

function pinheiro(diametro: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], camadas = 7, tons = ['#24573a', '#2d6a47', '#377d54', '#439063', '#52a574', '#65ba86', '#82cf9c'];
  for (let c = 0; c < camadas; c++) {
    const raio = R * (1 - c * 0.13), pontas = 12 + Math.round(R * 2) + c;
    partes.push(poli(estrela(0, 0, pontas, raio, raio * 0.52, r() * 0.6), tons[c]!, 1.5 + c * 0.6, { sombraLeve: true, contorno: c === 0 ? 'leve' : false, detalhe: 1 }));
    for (let i = 0; i < pontas; i++) { const a = (i / pontas) * Math.PI * 2 + r() * 0.2; partes.push(folha(Math.cos(a) * raio * 0.28, Math.sin(a) * raio * 0.28, a, raio * 0.62, 0.07, tom(tons[c]!, 0.22), 1.55 + c * 0.6, { detalhe: 3, semSombra: true })); }
  }
  partes.push(elipse(0, 0, R * 0.18, R * 0.18, 'madeira.media', 6, { contorno: false, semSombra: true }));
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

function arbusto(diametro: number, seed: number, flores: string | null): DescricaoDePiso {
  const g = copaRedonda(diametro, seed, ['#22472a', '#2f5f36', '#417a47', '#5a9650']), r = mulberry32(seed + 5), partes = g.partes.slice(2);   // sem tronco
  if (flores) for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = (diametro / 2) * Math.sqrt(r()) * 0.85; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.07, 0.07, flores, 5.5 + r() * 0.2, { contorno: false, semSombra: true, detalhe: 3 })); }
  return { tipo: 'piso', pegada: g.pegada, partes };
}

function vaso(mat: string, d: number): Parte[] { return [elipse(0, 0, d, d, mat, 0.5, { contorno: 'leve' }), elipse(0, 0, d * 0.82, d * 0.82, '#2a1b12', 0.52, { contorno: false, semSombra: true }), elipse(0, 0, d * 0.6, d * 0.6, '#3a2618', 0.53, { contorno: false, semSombra: true, detalhe: 3 })]; }

/** Palmeira em vaso: frondes longas saindo do centro, cada uma com folíolos dos dois lados. */
function palmeira(seed: number, vasoMat: string): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [...vaso(vasoMat, 0.55)], frondes = 11;
  for (let f = 0; f < frondes; f++) {
    const a = (f / frondes) * Math.PI * 2 + r() * 0.3, comp = 0.55 + r() * 0.2, z = 0.8 + f * 0.04;
    partes.push(folha(0, 0, a, comp, 0.03, '#2c5a32', z, { detalhe: 2 }));
    for (let k = 1; k <= 9; k++) for (const lado of [-1, 1]) { const t = k / 9.5, ang = a + lado * (0.95 - t * 0.35); partes.push(folha(Math.cos(a) * comp * t * 0.9, Math.sin(a) * comp * t * 0.9, ang, 0.2 * (1 - t * 0.5), 0.045, k % 2 ? '#3a7a40' : '#2f6a38', z + 0.02 + k * 0.002, { detalhe: 3, semSombra: true })); }
  }
  partes.push(elipse(0, 0, 0.1, 0.1, '#1d3d24', 1.4, { contorno: false, semSombra: true }));
  return { tipo: 'piso', pegada: [1.1, 1.1], partes };
}

/** Samambaia em pedestal: pedestal de pedra e frondes arqueadas, cheias de folíolos pequenos. */
function samambaia(seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [elipse(0, 0, 0.5, 0.5, 'pedra.escura', 0.4, { contorno: 'leve' }), elipse(0, 0, 0.4, 0.4, '#3a3d44', 0.45, { contorno: false, semSombra: true })], frondes = 14;
  for (let f = 0; f < frondes; f++) {
    const a = (f / frondes) * Math.PI * 2 + r() * 0.25, comp = 0.5 + r() * 0.15, z = 0.8 + f * 0.03;
    for (let k = 1; k <= 12; k++) for (const lado of [-1, 1]) { const t = k / 12.5, ang = a + lado * 1.25; partes.push(folha(Math.cos(a) * comp * t, Math.sin(a) * comp * t, ang, 0.13 * (1 - t * 0.55), 0.035, k % 2 ? '#4a8a45' : '#3c7a3c', z + k * 0.003, { detalhe: 3, semSombra: true })); }
    partes.push(folha(0, 0, a, comp, 0.02, '#274d2b', z, { detalhe: 2 }));
  }
  return { tipo: 'piso', pegada: [1.3, 1.3], partes };
}

/** Costela-de-adão (monstera): folhas grandes em coração, recortadas, com nervuras. */
function monstera(seed: number, vasoMat: string): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [...vaso(vasoMat, 0.5)], folhas = 8;
  for (let f = 0; f < folhas; f++) {
    const a = (f / folhas) * Math.PI * 2 + r() * 0.4, d = 0.12 + r() * 0.12, cx = Math.cos(a) * d, cy = Math.sin(a) * d, tam = 0.34 + r() * 0.1, z = 0.8 + f * 0.05, c = Math.cos(a), s = Math.sin(a);
    const forma: number[] = [], n = 14;
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, rr = tam * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(t / 2)), 0.7)) * (1 - 0.12 * (i % 3 === 0 ? 1 : 0)); forma.push(Math.cos(t) * rr * 1.1, Math.sin(t) * rr * 0.85); }
    const rot = (pts: number[]) => pts.map((v, i) => (i % 2 ? cy + pts[i - 1]! * s + v * c : cx + v * c - pts[i + 1]! * s));
    partes.push(poli(rot(forma), f % 2 ? '#2f6a38' : '#27582f', z, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
    partes.push(folha(cx, cy, a, tam * 1.1, 0.02, '#8fc27a', z + 0.01, { detalhe: 3, semSombra: true }));
    for (const lado of [-1, 1]) for (let k = 1; k <= 3; k++) partes.push(folha(cx + Math.cos(a) * tam * 0.2 * k, cy + Math.sin(a) * tam * 0.2 * k, a + lado * 0.9, tam * 0.45, 0.015, '#7db36a', z + 0.012, { detalhe: 3, semSombra: true }));
  }
  return { tipo: 'piso', pegada: [1, 1], partes };
}

const DUAS = (a: string, pa: Record<string, unknown>, b: string, pb: Record<string, unknown>) => [{ nome: a, sufixo: a, params: pa, seed: 21 }, { nome: b, sufixo: b, params: pb, seed: 22 }];

export const PLANTAS: GeradorPesado[] = [
  { id: 'palmeira', nome: 'Palmeira em vaso', categoria: 'decoracao', funcoes: ['sala', 'corredor', 'escritorio', 'biblioteca'], tags: ['planta', 'palmeira', 'vaso', 'folhagem'], generos: [], kit: null, versao: 1,
    variantes: DUAS('madeira', { vaso: 'madeira.escura' }, 'pedra', { vaso: 'pedra.escura' }), gerar: p => palmeira(p.seed, String(p.params.vaso ?? 'madeira.escura')) },
  { id: 'samambaia', nome: 'Samambaia em pedestal', categoria: 'decoracao', funcoes: ['sala', 'corredor', 'biblioteca'], tags: ['planta', 'samambaia', 'pedestal', 'folhagem'], generos: ['investigacao', 'fantasia'], kit: null, versao: 2,
    variantes: DUAS('a', {}, 'b', {}), gerar: p => samambaia(p.seed) },
  { id: 'costela-de-adao', nome: 'Costela-de-adão', categoria: 'decoracao', funcoes: ['sala', 'quarto', 'escritorio', 'corredor'], tags: ['planta', 'monstera', 'vaso', 'folhagem'], generos: [], kit: null, versao: 1,
    variantes: DUAS('madeira', { vaso: 'madeira.escura' }, 'pedra', { vaso: 'pedra.escura' }), gerar: p => monstera(p.seed, String(p.params.vaso ?? 'madeira.escura')) },
  { id: 'arvore', altura: ([w]) => w * 1.6, nome: 'Árvore', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior'], generos: [], kit: 'exterior', versao: 2, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 31 }, { nome: '5 m', sufixo: '5m', params: { diametro: 5 }, seed: 32 }, { nome: '7 m', sufixo: '7m', params: { diametro: 7 }, seed: 33 }],
    gerar: p => copaRedonda(num(p.params.diametro, 5, 2, 10), p.seed) },
  { id: 'pinheiro', altura: ([w]) => w * 2, nome: 'Pinheiro', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'pinheiro', 'conifera', 'exterior'], generos: [], kit: 'exterior', versao: 2, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 41 }, { nome: '4,5 m', sufixo: '4m', params: { diametro: 4.5 }, seed: 42 }], gerar: p => pinheiro(num(p.params.diametro, 3, 2, 8), p.seed) },
  { id: 'arbusto', altura: ([w]) => w * 0.5, nome: 'Arbusto', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'exterior'], generos: [], kit: 'exterior', versao: 2,
    variantes: [{ nome: 'verde', sufixo: 'verde', params: { diametro: 1.4 }, seed: 51 }, { nome: 'florido', sufixo: 'florido', params: { diametro: 1.6, flores: '#d94a6a' }, seed: 52 }, { nome: 'grande', sufixo: 'grande', params: { diametro: 2.2 }, seed: 53 }],
    gerar: p => arbusto(num(p.params.diametro, 1.5, 0.8, 4), p.seed, typeof p.params.flores === 'string' ? p.params.flores : null) },
];
