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

/** Um pompom de neve: bola branca com sombra do lado oposto à luz (noroeste), "algodão" de elipses em 3 tons e brilho. `frestas` mostra um pouco de verde por baixo. */
function pompom(partes: Parte[], r: () => number, cx: number, cy: number, raio: number, z: number): void {
  const D = raio * 2;
  partes.push(elipse(cx + raio * 0.1, cy + raio * 0.12, D, D, '#b8c8dc', z, { sombraLeve: true, contorno: 'leve', detalhe: 1 }), elipse(cx - raio * 0.06, cy - raio * 0.07, D * 0.88, D * 0.88, '#f4f8fc', z + 0.05, { contorno: false, semSombra: true, detalhe: 1 }));
  const cores = ['#ffffff', '#eaf1f9', '#d3e0ee'], n = Math.round(10 + raio * 16);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = raio * Math.sqrt(r()) * 0.78, t = raio * (0.2 + r() * 0.18), lado = (Math.cos(a) + Math.sin(a)) * 0.5;   // lado > 0: virado para a sombra
    partes.push(elipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, t, t * 0.9, cores[lado > 0.35 ? 2 : lado > -0.15 ? 1 : 0]!, z + 0.1 + r() * 0.04, { contorno: false, semSombra: true, detalhe: 3 }));
  }
  partes.push(elipse(cx - raio * 0.3, cy - raio * 0.32, raio * 0.6, raio * 0.5, '#ffffff', z + 0.2, { contorno: false, semSombra: true, detalhe: 3 }));
}

/** Árvore vista de cima coberta de neve: 5 a 9 pompons sobrepostos, quase nenhum verde (só frestas entre as bolas). */
function arvoreNevada(diametro: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], n = 5 + Math.floor(r() * 5);
  partes.push(elipse(0, 0, diametro * 0.7, diametro * 0.7, '#4a6a5a', 1, { contorno: false, sombraLeve: true, detalhe: 1 }));
  for (let i = 0; i < n; i++) {
    const raio = R * (0.36 + r() * 0.12), a = (i / n) * Math.PI * 2 + r() * 0.6, d = i === 0 ? 0 : (R - raio) * (0.55 + r() * 0.45);
    pompom(partes, r, Math.cos(a) * d, Math.sin(a) * d, raio, 2 + i * 0.5);
  }
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

/** Pinheiro de neve: a forma do pinheiro com um anel branco sobre cada camada; o verde só aparece nas pontas. */
function pinheiroNevado(diametro: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], camadas = 7, tons = ['#24573a', '#2d6a47', '#377d54', '#439063', '#52a574', '#65ba86', '#7fcf9a'], brancos = ['#c3d2e4', '#cfdbea', '#dce6f1', '#e6eef6', '#eef4fa', '#f6f9fd', '#ffffff'];
  for (let c = 0; c < camadas; c++) {
    const raio = R * (1 - c * 0.13), pontas = 12 + Math.round(R * 2) + c, giro = r() * 0.6, z = 1.5 + c * 0.6;
    partes.push(poli(estrela(0, 0, pontas, raio, raio * 0.52, giro), tons[c]!, z, { sombraLeve: true, contorno: c === 0 ? 'leve' : false, detalhe: 1 }));
    partes.push(poli(estrela(-raio * 0.03, -raio * 0.03, pontas, raio * 0.92, raio * 0.5, giro + 0.05), brancos[c]!, z + 0.2, { contorno: false, semSombra: true, detalhe: 1 }));
    for (let i = 0; i < pontas; i++) { const a = (i / pontas) * Math.PI * 2 + giro; partes.push(folha(Math.cos(a) * raio * 0.28, Math.sin(a) * raio * 0.28, a, raio * 0.5, 0.06, '#ffffff', z + 0.25, { detalhe: 3, semSombra: true })); }
  }
  partes.push(elipse(0, 0, R * 0.3, R * 0.3, '#ffffff', 6, { contorno: false, semSombra: true }));
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

/** Arbusto sem folhas: galhos finos que se ramificam do centro (3 níveis), de 1 a 3 cm; com `neve`, tufos brancos nos nós. */
function arbustoSeco(diametro: number, seed: number, neve: boolean): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], cores = ['#3a2c22', '#5b4636'];
  const galho = (x: number, y: number, ang: number, comp: number, nivel: number): void => {
    const larg = [0.05, 0.035, 0.02][nivel]!, ex = x + Math.cos(ang) * comp, ey = y + Math.sin(ang) * comp;
    partes.push(folha(x, y, ang, comp, larg, cores[nivel === 2 ? 1 : (r() < 0.5 ? 0 : 1)]!, 1 + nivel * 0.3 + r() * 0.05, { detalhe: nivel < 2 ? 1 : 2, semSombra: true }));
    if (neve && nivel > 0 && r() < 0.5) partes.push(elipse(ex, ey, 0.07, 0.05, '#f4f8fc', 2.5, { contorno: false, semSombra: true, detalhe: 3 }));
    if (nivel >= 2) return;
    const filhos = 2 + Math.floor(r() * 2);
    for (let i = 0; i < filhos; i++) { const t = 0.45 + r() * 0.5; galho(x + Math.cos(ang) * comp * t, y + Math.sin(ang) * comp * t, ang + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.5), comp * (0.5 + r() * 0.25), nivel + 1); }
  };
  const base = 5 + Math.floor(r() * 3);
  for (let i = 0; i < base; i++) galho(0, 0, (i / base) * Math.PI * 2 + r() * 0.5, R * (0.4 + r() * 0.15), 0);
  partes.push(elipse(0, 0, 0.1, 0.1, '#3a2c22', 0.9, { contorno: false, semSombra: true }));
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
  { id: 'arvore-nevada', altura: ([w]) => w * 1.6, nome: 'Árvore nevada', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior', 'inverno', 'neve'], generos: [], kit: 'ermos', versao: 2, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 61 }, { nome: '5 m', sufixo: '5m', params: { diametro: 5 }, seed: 62 }], gerar: p => arvoreNevada(num(p.params.diametro, 4, 2, 8), p.seed) },
  { id: 'pinheiro-nevado', altura: ([w]) => w * 2, nome: 'Pinheiro nevado', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'pinheiro', 'conifera', 'exterior', 'inverno', 'neve'], generos: [], kit: 'ermos', versao: 2, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 71 }, { nome: '4,5 m', sufixo: '4m', params: { diametro: 4.5 }, seed: 72 }], gerar: p => pinheiroNevado(num(p.params.diametro, 3, 2, 8), p.seed) },
  { id: 'arbusto-seco', altura: ([w]) => w * 0.4, nome: 'Arbusto seco', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'exterior', 'inverno', 'seco'], generos: [], kit: 'ermos', versao: 2, res: 64,
    variantes: [{ nome: '1,2 m', sufixo: '1m', params: { diametro: 1.2 }, seed: 81 }, { nome: '2 m', sufixo: '2m', params: { diametro: 2 }, seed: 82 }, { nome: '2 m com neve', sufixo: '2m-neve', params: { diametro: 2, neve: true }, seed: 83 }],
    gerar: p => arbustoSeco(num(p.params.diametro, 1.5, 0.8, 4), p.seed, p.params.neve === true) },
];
