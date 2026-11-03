import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { mulberry32 } from '../ruido.ts';
import { mat, num, piso, type Receita } from './comum.ts';

const G = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim'], kit: 'exterior' };
const PEDRA = ['#7d7f86', '#6a6c73', '#8c8e94', '#5f6168'];

/** Uma pedra irregular: polígono de bordas quebradas, com faces mais claras e escuras, e um pouco de musgo. */
function pedra(w: number, h: number, seed: number): Parte[] {
  const r = mulberry32(seed), pts: number[] = [], n = 11;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = 0.82 + r() * 0.18; pts.push(Math.cos(a) * (w / 2) * k, Math.sin(a) * (h / 2) * k); }
  const faces = pts.map((v, i) => (i % 2 ? v * 0.6 : v * 0.6));
  return [poli(pts, PEDRA[1]!, 0.5, { contorno: 'leve' }), poli(faces, PEDRA[2]!, 0.6, { contorno: false, detalhe: 2 }), poli(faces.map(v => v * 0.55), PEDRA[0]!, 0.68, { contorno: false, semSombra: true, detalhe: 3 }),
    elipse(-w * 0.2, h * 0.15, w * 0.25, h * 0.18, '#4f7a3a', 0.62, { contorno: false, semSombra: true, detalhe: 3 })];
}

/** O kit exterior: pedras, toco, tronco caído, cerca, poço, banco de jardim, canteiro, poste e lápide (as árvores e arbustos são da coleção). */
export const RECEITAS_EXTERIORES: Receita[] = [
  { id: 'pedra.pequena', nome: 'Pedra pequena', ...G, funcoes: ['jardim', 'cemiterio'], tags: ['pedra', 'rocha', 'natureza'], pegada: [0.5, 0.4], gerar: p => piso([0.5, 0.4], pedra(0.5, 0.4, p.seed)) },
  { id: 'pedra.media', nome: 'Pedra', ...G, tags: ['pedra', 'rocha', 'natureza'], pegada: [0.9, 0.7], gerar: p => piso([0.9, 0.7], pedra(0.9, 0.7, p.seed)) },
  { id: 'pedra.grande', nome: 'Pedra grande', ...G, tags: ['pedra', 'rocha', 'natureza'], pegada: [1.6, 1.2], gerar: p => piso([1.6, 1.2], pedra(1.6, 1.2, p.seed)) },
  { id: 'toco', nome: 'Toco de árvore', ...G, tags: ['toco', 'madeira', 'natureza'], pegada: [0.6, 0.6],
    gerar: p => { const r = mulberry32(p.seed); return piso([0.6, 0.6], [elipse(0, 0, 0.6, 0.58, 'madeira.escura', 0.5, { contorno: 'leve' }), elipse(0, 0, 0.5, 0.48, 'madeira.clara', 0.6, { contorno: 'leve', detalhe: 2 }), ...[0.38, 0.26, 0.14].map((d, i) => elipse((r() - 0.5) * 0.02, (r() - 0.5) * 0.02, d, d * 0.96, i % 2 ? '#c9a06a' : '#b08850', 0.62 + i * 0.01, { contorno: false, semSombra: true, detalhe: 3 }))]); } },
  { id: 'tronco.caido', nome: 'Tronco caído', ...G, tags: ['tronco', 'madeira', 'natureza'], pegada: [2.4, 0.55],
    gerar: p => { const r = mulberry32(p.seed); return piso([2.4, 0.55], [ret(0, 0, 2.4, 0.5, 'madeira.escura', 0.55, { raio: 0.25, contorno: 'leve' }), ret(0, -0.06, 2.3, 0.28, 'madeira.media', 0.6, { raio: 0.14, contorno: false, semSombra: true, detalhe: 2 }), elipse(1.15, 0, 0.14, 0.46, 'madeira.clara', 0.65, { contorno: 'leve', detalhe: 2 }), ...Array.from({ length: 5 }, (_, i) => ret(-1 + i * 0.5 + r() * 0.1, (r() - 0.5) * 0.3, 0.3, 0.015, '#2a1a10', 0.62, { contorno: false, semSombra: true, detalhe: 3 })), elipse(-0.5, 0.18, 0.4, 0.2, '#4f7a3a', 0.66, { contorno: false, semSombra: true, detalhe: 3 })]); } },
  { id: 'cerca', nome: 'Cerca de madeira', ...G, funcoes: ['jardim'], tags: ['cerca', 'madeira', 'limite'], pegada: [2.0, 0.12],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2, min: 0.6, max: 6, passo: 0.2 }],
    gerar: p => { const w = num(p, 'largura', 2, 0.6, 6), n = Math.max(2, Math.round(w / 0.28)); return piso([w, 0.12], [ret(0, 0, w, 0.04, 'madeira.media', 0.7, { contorno: 'leve', detalhe: 2 }), ...Array.from({ length: n + 1 }, (_, i) => ret(-w / 2 + (i * w) / n, 0, 0.09, 0.12, 'madeira.escura', 0.9, { raio: 0.01, contorno: 'leve' })), ret(0, 0, w, 0.03, 'madeira.clara', 0.8, { contorno: false, semSombra: true, detalhe: 3 })]); } },
  { id: 'poco', nome: 'Poço', ...G, tags: ['poco', 'agua', 'pedra'], pegada: [1.4, 1.4],
    gerar: () => piso([1.4, 1.4], [elipse(0, 0, 1.4, 1.4, PEDRA[1]!, 0.8, { contorno: 'leve' }), ...Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2; return elipse(Math.cos(a) * 0.58, Math.sin(a) * 0.58, 0.26, 0.2, i % 2 ? PEDRA[0]! : PEDRA[2]!, 0.85, { contorno: 'leve', detalhe: 2 }); }), elipse(0, 0, 0.9, 0.9, '#14202a', 0.9, { contorno: 'leve' }), elipse(0.05, 0.05, 0.5, 0.5, '#1f3a4d', 0.92, { contorno: false, semSombra: true, detalhe: 3 }), ret(0, 0, 1.5, 0.07, 'madeira.escura', 1.6, { contorno: 'leve', detalhe: 2 }), ret(-0.7, 0, 0.1, 0.1, 'madeira.escura', 1.65, { contorno: 'leve', detalhe: 3 }), ret(0.7, 0, 0.1, 0.1, 'madeira.escura', 1.65, { contorno: 'leve', detalhe: 3 })]) },
  { id: 'banco.jardim', nome: 'Banco de jardim', ...G, funcoes: ['jardim', 'cemiterio'], tags: ['banco', 'assento', 'jardim'], pegada: [1.5, 0.5],
    gerar: () => piso([1.5, 0.5], [ret(0, 0.04, 1.5, 0.36, 'madeira.media', 0.5, { raio: 0.02, contorno: 'leve' }), ...[-0.12, 0, 0.12].map(y => ret(0, y + 0.04, 1.44, 0.02, 'madeira.escura', 0.52, { contorno: false, semSombra: true, detalhe: 3 })), ret(0, -0.2, 1.5, 0.1, 'madeira.escura', 0.9, { raio: 0.02, contorno: 'leve' }), ...[-1, 1].map(s => ret(s * 0.7, 0, 0.06, 0.5, 'ferro', 0.95, { contorno: 'leve', detalhe: 2 }))]) },
  { id: 'canteiro', nome: 'Canteiro de flores', ...G, tags: ['canteiro', 'flores', 'jardim', 'planta'], pegada: [1.7, 0.85],
    campos: [{ id: 'flor', rotulo: 'Cor das flores', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }],
    gerar: p => { const r = mulberry32(p.seed), cor = mat(p, 'flor', 'tecido.veludo-vinho'), cores = ['#d94a6a', '#f2c230', '#f4f1ea', '#8e6bd9', cor]; return piso([1.7, 0.85], [ret(0, 0, 1.7, 0.85, 'madeira.escura', 0.45, { raio: 0.06, contorno: 'leve' }), ret(0, 0, 1.58, 0.73, '#4a3322', 0.5, { raio: 0.04, contorno: false, semSombra: true, detalhe: 2 }), ...Array.from({ length: 16 }, () => elipse((r() - 0.5) * 1.4, (r() - 0.5) * 0.6, 0.24, 0.18, '#3f7a3c', 0.6, { contorno: false, sombraLeve: true, detalhe: 2 })), ...Array.from({ length: 26 }, () => elipse((r() - 0.5) * 1.5, (r() - 0.5) * 0.65, 0.09, 0.09, cores[Math.floor(r() * cores.length)]!, 0.7 + r() * 0.05, { contorno: false, semSombra: true, detalhe: 3 }))]); } },
  { id: 'poste.luz', nome: 'Poste de luz', ...G, funcoes: ['jardim', 'cemiterio'], tags: ['poste', 'luz', 'lampiao'], pegada: [0.3, 0.3],
    gerar: () => piso([0.3, 0.3], [elipse(0, 0, 0.28, 0.28, 'ferro', 0.3, { contorno: 'leve' }), elipse(0, 0, 0.14, 0.14, '#2a2d33', 2.4, { contorno: 'leve', detalhe: 2 }), elipse(0, 0, 0.24, 0.24, '#f4e2a8', 2.5, { contorno: 'leve', detalhe: 2 }), elipse(0, 0, 0.12, 0.12, '#fff6d6', 2.52, { contorno: false, semSombra: true, detalhe: 3 })]) },
  { id: 'lapide', nome: 'Lápide', ...G, funcoes: ['cemiterio', 'jardim'], tags: ['lapide', 'cemiterio', 'tumulo'], pegada: [0.5, 0.2],
    gerar: p => { const r = mulberry32(p.seed); return piso([0.5, 0.2], [ret(0, 0, 0.5, 0.2, PEDRA[0]!, 0.9, { raio: 0.06, contorno: 'leve' }), ret(0, 0, 0.42, 0.12, PEDRA[2]!, 0.95, { raio: 0.04, contorno: false, semSombra: true, detalhe: 2 }), ret(0, 0, 0.012, 0.09, PEDRA[3]!, 0.97, { contorno: false, semSombra: true, detalhe: 3 }), ret(0, -0.01, 0.07, 0.012, PEDRA[3]!, 0.97, { contorno: false, semSombra: true, detalhe: 3 }), elipse(-0.18 + r() * 0.05, 0.05, 0.08, 0.05, '#4f7a3a', 0.98, { contorno: false, semSombra: true, detalhe: 3 })]); } },
];
