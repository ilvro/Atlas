import { elipse, poli, ret, type DescricaoDePiso, type Parte } from '../descricao.ts';
import { materialDe, tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import type { GeradorPesado } from './index.ts';

const VARIANTES = [
  { nome: 'vinho', sufixo: 'vinho', params: { estofado: 'tecido.veludo-vinho' }, seed: 11 },
  { nome: 'verde-garrafa', sufixo: 'verde', params: { estofado: 'tecido.verde' }, seed: 12 },
  { nome: 'couro', sufixo: 'couro', params: { estofado: 'couro.marrom' }, seed: 13 },
];

/** Uma linha fina como polígono (a descrição só tem formas preenchidas). */
function linha(x0: number, y0: number, x1: number, y1: number, esp: number, mat: string, z: number): Parte {
  const dx = x1 - x0, dy = y1 - y0, c = Math.hypot(dx, dy) || 1, nx = (-dy / c) * esp / 2, ny = (dx / c) * esp / 2;
  return poli([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], mat, z, { contorno: false, semSombra: true });
}

/** Um botão do capitonê: o botão, o brilho e os quatro vincos que partem dele em diagonal. */
function botao(x: number, y: number, vinco: string, z: number, passo: number): Parte[] {
  const saida: Parte[] = [], r = passo * 0.36;
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) saida.push(linha(x + Math.cos(a) * 0.03, y + Math.sin(a) * 0.03, x + Math.cos(a) * r, y + Math.sin(a) * r, 0.011, vinco, z));
  saida.push(elipse(x, y, 0.05, 0.05, tom(vinco, -0.3), z + 0.01, { contorno: false, semSombra: true }), elipse(x - 0.006, y - 0.006, 0.016, 0.016, '#e8d9a8', z + 0.02, { contorno: false, semSombra: true }));
  return saida;
}

/** Uma grade de botões em losango dentro de um retângulo (linhas alternadas deslocadas meio passo). */
function grade(cx: number, cy: number, w: number, h: number, passoX: number, linhas: number, vinco: string, z: number, r: () => number): Parte[] {
  const saida: Parte[] = [], colunas = Math.max(2, Math.round(w / passoX)), passo = w / colunas, dy = linhas > 1 ? h / (linhas - 1) : 0;
  for (let l = 0; l < linhas; l++) {
    const impar = l % 2 === 1, n = impar ? colunas - 1 : colunas;
    for (let c = 0; c < n; c++) saida.push(...botao(cx - w / 2 + (impar ? c + 1 : c + 0.5) * passo + (r() - 0.5) * 0.004, cy - h / 2 + l * dy, vinco, z, passoX));
  }
  return saida;
}

interface Forma { w: number; h: number; braco: 'ambos' | 'esquerdo' | 'nenhum'; tufosNoAssento: number; passo: number }

/** Estofado capitonê visto de cima: encosto e braços enrolados, assento e encosto com botões e vincos. A frente é +y; o fundo, −y. */
function estofado(f: Forma, estofadoMat: string, seed: number): DescricaoDePiso {
  const m = materialDe(estofadoMat), r = mulberry32(seed), { w, h } = f;
  const base = m.base, escuro = tom(m.base, -0.32), vinco = tom(m.base, -0.42), claro = m.claro;
  const larguraDoBraco = f.braco === 'nenhum' ? 0 : 0.27, interno = w - (f.braco === 'ambos' ? 2 : f.braco === 'esquerdo' ? 1 : 0) * larguraDoBraco;
  const x0 = f.braco === 'nenhum' ? 0 : f.braco === 'esquerdo' ? larguraDoBraco / 2 : 0;
  const partes: Parte[] = [
    ret(0, 0, w, h, base, 0.4, { raio: 0.1 }),
    ret(x0, 0.16, interno, h - 0.3, escuro, 0.46, { raio: 0.05, contorno: false }),                      // fundo escuro sob as almofadas (a sombra entre elas)
    ret(0, -h / 2 + 0.15, w, 0.3, base, 0.95, { raio: 0.1 }),                                           // encosto
    ret(0, -h / 2 + 0.1, w - 0.22, 0.1, claro, 0.97, { raio: 0.05, contorno: false, semSombra: true }),  // luz no alto do encosto
    ret(x0, 0.13, interno - 0.04, h - 0.46, base, 0.52, { raio: 0.07, contorno: 'leve' }),               // assento
    ret(x0, h / 2 - 0.2, interno - 0.04, 0.07, claro, 0.54, { raio: 0.03, contorno: false, semSombra: true }),
  ];
  const lados = f.braco === 'ambos' ? [-1, 1] : f.braco === 'esquerdo' ? [-1] : [];
  for (const s of lados) {
    const bx = s * (w / 2 - larguraDoBraco / 2);
    partes.push(ret(bx, 0.04, larguraDoBraco, h - 0.1, base, 0.74, { raio: 0.12 }), ret(bx, 0.04, larguraDoBraco - 0.1, h - 0.3, claro, 0.76, { raio: 0.08, contorno: false, semSombra: true }),
      elipse(bx, h / 2 - 0.12, larguraDoBraco + 0.02, 0.24, base, 0.8, { raio: 0.1 }), elipse(bx, h / 2 - 0.12, larguraDoBraco - 0.1, 0.12, escuro, 0.83, { contorno: false, semSombra: true }),
      elipse(bx, h / 2 - 0.12, 0.05, 0.05, tom(m.base, -0.55), 0.85, { contorno: false, semSombra: true }));
  }
  partes.push(...grade(0, -h / 2 + 0.17, w - 0.5, 0.14, f.passo, 2, vinco, 0.98, r));                      // capitonê do encosto
  partes.push(...grade(x0, 0.13, interno - 0.24, h - 0.62, f.passo, f.tufosNoAssento, vinco, 0.56, r));     // capitonê do assento
  return { tipo: 'piso', pegada: [w, h], partes };
}

const num = (v: unknown, padrao: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : padrao);

export const ESTOFADOS: GeradorPesado[] = [
  { id: 'chesterfield', nome: 'Sofá chesterfield', categoria: 'assentos', funcoes: ['sala', 'biblioteca', 'escritorio'], tags: ['assento', 'sofa', 'capitone', 'chesterfield', 'estofado'], generos: ['investigacao', 'fantasia'], kit: 'investigacao', versao: 1, variantes: VARIANTES,
    gerar: p => estofado({ w: num(p.params.largura, 2.2, 1.6, 3), h: 0.95, braco: 'ambos', tufosNoAssento: 3, passo: 0.17 }, String(p.params.estofado ?? 'tecido.veludo-vinho'), p.seed) },
  { id: 'poltrona-capitone', nome: 'Poltrona capitonê', categoria: 'assentos', funcoes: ['sala', 'biblioteca', 'escritorio'], tags: ['assento', 'poltrona', 'capitone', 'estofado'], generos: ['investigacao', 'fantasia'], kit: 'investigacao', versao: 1, variantes: VARIANTES,
    gerar: p => estofado({ w: 0.95, h: 0.95, braco: 'ambos', tufosNoAssento: 2, passo: 0.16 }, String(p.params.estofado ?? 'couro.marrom'), p.seed) },
  { id: 'diva', nome: 'Divã capitonê', categoria: 'assentos', funcoes: ['sala', 'quarto', 'biblioteca'], tags: ['assento', 'diva', 'chaise', 'capitone', 'estofado'], generos: ['investigacao'], kit: 'investigacao', versao: 1, variantes: VARIANTES,
    gerar: p => estofado({ w: 1.75, h: 0.8, braco: 'esquerdo', tufosNoAssento: 2, passo: 0.17 }, String(p.params.estofado ?? 'tecido.veludo-vinho'), p.seed) },
];
