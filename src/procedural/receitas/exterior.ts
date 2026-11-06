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
  { id: 'balaustrada', nome: 'Balaustrada', ...G, funcoes: ['varanda', 'jardim'], tags: ['balaustrada', 'varanda', 'pedra', 'terraco'], pegada: [2.0, 0.28],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2, min: 0.6, max: 6, passo: 0.2 }],
    gerar: p => { const w = num(p, 'largura', 2, 0.6, 6), n = Math.max(2, Math.round(w / 0.22)); return piso([w, 0.28], [ret(0, 0, w, 0.28, '#c9c5bb', 1.0, { raio: 0.02, contorno: 'leve' }), ret(0, 0, w - 0.04, 0.18, '#dcd8ce', 1.02, { contorno: false, semSombra: true, detalhe: 2 }), ...Array.from({ length: n }, (_, i) => elipse(-w / 2 + ((i + 0.5) * w) / n, 0, 0.11, 0.11, '#bdb9ae', 0.9, { contorno: 'leve', detalhe: 2 })), ...[-1, 1].map(s2 => ret(s2 * (w / 2 - 0.1), 0, 0.2, 0.3, '#c9c5bb', 1.2, { raio: 0.02, contorno: 'leve' }))]); } },
  { id: 'escada.externa', nome: 'Escada externa', ...G, funcoes: ['varanda', 'jardim'], tags: ['escada', 'degraus', 'pedra', 'entrada'], pegada: [3.0, 1.8],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 3, min: 1.2, max: 8, passo: 0.2 }],
    gerar: p => { const w = num(p, 'largura', 3, 1.2, 8); return piso([w, 1.8], [ret(0, 0, w, 1.8, '#9a968c', 0.3, { contorno: 'leve' }), ...Array.from({ length: 6 }, (_, i) => ret(0, -0.75 + i * 0.3, w - 0.04, 0.28, i % 2 ? '#c4c0b6' : '#d2cec4', 0.35 + i * 0.12, { contorno: 'leve', detalhe: 2 })), ...[-1, 1].map(s2 => ret(s2 * (w / 2 - 0.1), 0, 0.2, 1.8, '#b6b2a8', 1.1, { raio: 0.02, contorno: 'leve' }))]); } },
  { id: 'fonte', nome: 'Fonte', ...G, funcoes: ['jardim', 'varanda'], tags: ['fonte', 'agua', 'pedra', 'jardim'], pegada: [2.4, 2.4],
    gerar: () => piso([2.4, 2.4], [elipse(0, 0, 2.4, 2.4, '#b6b2a8', 0.5, { contorno: 'leve' }), elipse(0, 0, 2.1, 2.1, '#8aa9bd', 0.6, { contorno: 'leve', detalhe: 2 }), elipse(0.1, 0.1, 1.6, 1.6, '#5f8aa5', 0.62, { contorno: false, semSombra: true, detalhe: 3 }), elipse(0, 0, 0.9, 0.9, '#c9c5bb', 1.2, { contorno: 'leve' }), elipse(0, 0, 0.6, 0.6, '#9fc3d6', 1.25, { contorno: 'leve', detalhe: 2 }), elipse(0, 0, 0.3, 0.3, '#c9c5bb', 1.5, { contorno: 'leve' }), elipse(0, 0, 0.14, 0.14, '#e8f4fb', 1.6, { contorno: false, semSombra: true, detalhe: 3 })]) },
  { id: 'estatua', nome: 'Estátua', ...G, funcoes: ['jardim', 'varanda', 'cemiterio'], tags: ['estatua', 'pedra', 'pedestal'], pegada: [0.8, 0.8],
    gerar: () => piso([0.8, 0.8], [ret(0, 0, 0.8, 0.8, '#b6b2a8', 0.6, { raio: 0.03, contorno: 'leve' }), ret(0, 0, 0.64, 0.64, '#d0ccc2', 0.65, { contorno: false, semSombra: true, detalhe: 2 }), elipse(0, 0.02, 0.36, 0.22, '#c4c0b6', 1.8, { contorno: 'leve' }), elipse(0, -0.02, 0.2, 0.2, '#d6d2c8', 2.0, { contorno: 'leve', detalhe: 2 }), elipse(-0.18, 0.02, 0.1, 0.1, '#c4c0b6', 1.85, { contorno: false, detalhe: 3 })]) },
  { id: 'urna.pedestal', nome: 'Urna em pedestal', ...G, funcoes: ['varanda', 'jardim', 'sala', 'corredor'], tags: ['urna', 'vaso', 'pedestal', 'planta'], pegada: [0.6, 0.6],
    gerar: p => { const r = mulberry32(p.seed); return piso([0.6, 0.6], [ret(0, 0, 0.6, 0.6, '#b6b2a8', 0.5, { raio: 0.03, contorno: 'leve' }), elipse(0, 0, 0.5, 0.5, '#c9c5bb', 0.9, { contorno: 'leve', detalhe: 2 }), elipse(0, 0, 0.4, 0.4, '#2a1b12', 0.95, { contorno: false, semSombra: true, detalhe: 3 }), ...Array.from({ length: 10 }, () => elipse((r() - 0.5) * 0.3, (r() - 0.5) * 0.3, 0.2, 0.14, '#3f7a3c', 1.2 + r() * 0.1, { contorno: false, sombraLeve: true, detalhe: 2 }))]); } },
  { id: 'pilar', nome: 'Pilar', ...G, funcoes: ['varanda', 'jardim', 'sala', 'capela'], tags: ['pilar', 'coluna', 'pedra'], pegada: [0.5, 0.5],
    gerar: () => piso([0.5, 0.5], [ret(0, 0, 0.5, 0.5, '#b6b2a8', 1.5, { raio: 0.03, contorno: 'leve' }), ret(0, 0, 0.38, 0.38, '#d2cec4', 1.7, { raio: 0.02, contorno: 'leve', detalhe: 2 }), ret(0, 0, 0.26, 0.26, '#c4c0b6', 1.8, { contorno: false, semSombra: true, detalhe: 3 })]) },
  { id: 'cachoeira', nome: 'Cachoeira', ...G, funcoes: ['jardim', 'agua'], tags: ['cachoeira', 'agua', 'rio', 'rocha', 'queda', 'natureza'], pegada: [3, 4], altura: 0.4, animacao: 'cachoeira',
    campos: [
      { id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 3, min: 1.5, max: 8, passo: 0.5 },
      { id: 'queda', rotulo: 'Queda', tipo: 'numero', padrao: 4, min: 2, max: 10, passo: 0.5 },
    ],
    gerar: p => {
      const r = mulberry32(p.seed), W = num(p, 'largura', 3, 1.5, 8), H = num(p, 'queda', 4, 2, 10);
      const partes: Parte[] = [
        // Leito molhado de rocha escura e canal da queda
        ret(0, 0, W * 0.88, H * 0.92, '#2d3d47', 0.35, { raio: Math.min(W, H) * 0.08, contorno: 'leve', sombraLeve: true }),
        ret(0, H * 0.02, W * 0.66, H * 0.86, '#3e6a7e', 0.4, { raio: Math.min(W, H) * 0.06, contorno: false, semSombra: true, detalhe: 2 }),
        ret(0, H * 0.03, W * 0.52, H * 0.8, '#5a8ea3', 0.42, { raio: Math.min(W, H) * 0.05, contorno: false, semSombra: true, detalhe: 2 }),
        // Borda/soleira rochosa no topo e crista de espuma
        ret(0, -H * 0.41, W * 0.82, H * 0.12, '#48505a', 0.48, { raio: 0.05, contorno: 'leve', detalhe: 2 }),
        elipse(0, -H * 0.38, W * 0.62, Math.min(0.45, H * 0.14), '#cdecf5', 0.52, { contorno: false, semSombra: true, detalhe: 2 }),
        elipse(0, -H * 0.39, W * 0.48, Math.min(0.28, H * 0.09), '#eefaff', 0.54, { contorno: false, semSombra: true, detalhe: 3 }),
        // Espuma de base no pé da queda (para miniatura e base sob o shader)
        elipse(0, H * 0.36, W * 0.64, Math.min(0.55, H * 0.18), '#9ecad8', 0.49, { contorno: false, semSombra: true, detalhe: 2 }),
        elipse(0, H * 0.35, W * 0.46, Math.min(0.36, H * 0.12), '#dcf4fa', 0.51, { contorno: false, semSombra: true, detalhe: 3 }),
      ];
      // Fios verticais de água na base assada
      for (let i = 0; i < 5; i++) {
        const fx = ((i - 2) / 2.5) * W * 0.24 + (r() - 0.5) * W * 0.04;
        partes.push(ret(fx, -H * 0.02, Math.max(0.08, W * 0.05), H * 0.68, i % 2 ? '#8cc2d4' : '#bce6f2', 0.45 + i * 0.005, { raio: 0.03, contorno: false, semSombra: true, detalhe: 3 }));
      }
      // Paredões e pedras molhadas nas bordas esquerda e direita da queda
      const nPedras = Math.max(4, Math.round(H * 1.4));
      for (const lado of [-1, 1] as const) {
        for (let i = 0; i < nPedras; i++) {
          const t = (i + 0.5) / nPedras;
          const pw = Math.min(W * 0.22, 0.28 + r() * 0.18), ph = Math.min(H / nPedras * 1.35, 0.32 + r() * 0.22);
          const cx = lado * (W * 0.36 + (r() - 0.5) * W * 0.04), cy = -H * 0.4 + t * H * 0.78;
          const cor = PEDRA[i % PEDRA.length]!, z = 0.6 + i * 0.02 + (lado > 0 ? 0.01 : 0);
          partes.push(
            elipse(cx + 0.02, cy + 0.02, pw, ph, '#353840', z, { contorno: 'leve', sombraLeve: true }),
            elipse(cx, cy, pw * 0.88, ph * 0.88, cor, z + 0.005, { contorno: false, semSombra: true, detalhe: 2 }),
            elipse(cx - pw * 0.14, cy - ph * 0.14, pw * 0.42, ph * 0.36, '#9699a3', z + 0.01, { contorno: false, semSombra: true, detalhe: 3 }),
          );
          if (r() < 0.35) partes.push(elipse(cx + lado * pw * 0.1, cy, pw * 0.38, ph * 0.28, '#4f7a3a', z + 0.012, { contorno: false, semSombra: true, detalhe: 3 }));
        }
      }
      return piso([W, H], partes);
    } },
];
