import { elipse, poli, ret } from '../descricao.ts';
import { mulberry32 } from '../ruido.ts';
import { mat, num, piso, type Receita } from './comum.ts';

const MARMORE = '#d9d5cc', MARMORE_ESCURO = '#a8a399', FELTRO = '#2f6a45', G = { generos: ['investigacao'], kit: 'investigacao' };

/** O kit investigação: o que falta para mobiliar uma mansão antiga (lareira, piano, bilhar, banheiro de época…). Todas leves, com parâmetros de cor quando fazem sentido. */
export const RECEITAS_DE_INVESTIGACAO: Receita[] = [
  { id: 'lareira.marmore', nome: 'Lareira de mármore', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala', 'sala-de-jantar', 'biblioteca', 'quarto'], tags: ['lareira', 'marmore', 'fogo'], pegada: [1.8, 0.55], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.8, min: 1.2, max: 3, passo: 0.1 }],
    gerar: p => { const w = num(p, 'largura', 1.8, 1.2, 3), r = mulberry32(p.seed); return piso([w, 0.55], [
      ret(0, 0, w, 0.55, MARMORE, 1.0, { raio: 0.02 }), ret(0, -0.02, w - 0.24, 0.42, MARMORE_ESCURO, 1.02, { contorno: 'leve', detalhe: 2 }), ret(0, 0.0, w - 0.5, 0.3, '#120b0a', 0.8, { contorno: 'leve' }),
      ret(0, 0.22, w - 0.4, 0.1, MARMORE_ESCURO, 0.5, { contorno: 'leve' }), ret(0, 0.08, w - 0.6, 0.06, '#3a2a22', 0.82, { contorno: false, semSombra: true }),
      ...[-1, 1].map(s => ret(s * (w / 2 - 0.06), 0, 0.12, 0.55, MARMORE, 1.06, { raio: 0.02 })),
      elipse(-0.1, 0.02, 0.28, 0.1, '#5a3a22', 0.84, { contorno: 'leve', detalhe: 2 }), elipse(0.12, 0.04, 0.24, 0.09, '#6a4428', 0.85, { contorno: 'leve', detalhe: 2 }),
      ...Array.from({ length: 6 }, (_, i) => elipse(-0.15 + i * 0.06 + r() * 0.03, 0.03 + r() * 0.04, 0.06, 0.04, i % 2 ? '#ff9a3c' : '#ffcf6a', 0.9, { contorno: false, semSombra: true, detalhe: 3 })),
    ]); } },

  { id: 'piano.cauda', nome: 'Piano de cauda', categoria: 'decoracao', tipo: 'piso', funcoes: ['sala', 'sala-de-jantar'], tags: ['piano', 'musica', 'instrumento'], pegada: [1.5, 2.0], ...G,
    gerar: () => piso([1.5, 2.0], [
      poli([-0.7, -0.25, -0.7, 0.55, -0.45, 0.95, 0.0, 1.0, 0.45, 0.8, 0.7, 0.3, 0.7, -0.25, 0.6, -0.95, -0.1, -1.0, -0.6, -0.95], '#16141a', 0.9, { contorno: 'leve' }),
      poli([-0.62, -0.2, -0.62, 0.5, -0.4, 0.85, 0.0, 0.9, 0.4, 0.72, 0.62, 0.28, 0.62, -0.2], '#221f28', 0.98, { contorno: false, detalhe: 2 }),
      ret(0.0, -0.7, 1.2, 0.3, '#f0eadc', 0.95, { contorno: 'leve' }), ...Array.from({ length: 12 }, (_, i) => ret(-0.55 + i * 0.1 + 0.05, -0.72, 0.012, 0.22, '#222', 0.96, { contorno: false, semSombra: true, detalhe: 3 })),
      elipse(0.0, -0.95, 0.5, 0.25, 'madeira.escura', 0.5, { contorno: 'leve' }), elipse(0.5, 0.2, 0.05, 0.05, 'latao', 0.8, { contorno: false, semSombra: true, detalhe: 3 }),
    ]) },

  { id: 'mesa.bilhar', nome: 'Mesa de bilhar', categoria: 'mesas', tipo: 'piso', funcoes: ['sala-de-jogos'], tags: ['bilhar', 'jogo', 'mesa', 'feltro'], pegada: [1.5, 2.8], ...G,
    campos: [{ id: 'feltro', rotulo: 'Feltro', tipo: 'material', padrao: 'tecido.verde', uso: 'objeto' }],
    gerar: p => { const r = mulberry32(p.seed), f = mat(p, 'feltro', 'tecido.verde'); return piso([1.5, 2.8], [
      ret(0, 0, 1.5, 2.8, 'madeira.escura', 0.85, { raio: 0.06 }), ret(0, 0, 1.2, 2.5, f, 0.9, { contorno: 'leve', detalhe: 2 }),
      ...[[-0.6, -1.2], [0.6, -1.2], [-0.62, 0], [0.62, 0], [-0.6, 1.2], [0.6, 1.2]].map(([x, y]) => elipse(x!, y!, 0.14, 0.14, '#08080a', 0.92, { contorno: false, semSombra: true })),
      ...Array.from({ length: 9 }, (_, i) => elipse(-0.2 + (i % 3) * 0.2 + r() * 0.04, 0.2 + Math.floor(i / 3) * 0.18, 0.1, 0.1, ['#f2e8d0', '#d83030', '#2a52be', '#e8b020', '#222'][i % 5]!, 0.95, { contorno: 'leve', detalhe: 3 })),
      ...[-1, 1].map(s => ret(s * 0.66, 0, 0.04, 2.5, 'madeira.media', 0.93, { contorno: false, semSombra: true, detalhe: 3 })),
    ]); } },

  { id: 'mesa.oval', nome: 'Mesa de jantar oval', categoria: 'mesas', tipo: 'piso', funcoes: ['sala-de-jantar', 'sala', 'cozinha'], tags: ['mesa', 'jantar', 'oval'], pegada: [2.6, 1.3], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2.6, min: 1.6, max: 4.5, passo: 0.1 }, { id: 'madeira', rotulo: 'Madeira', tipo: 'material', padrao: 'madeira.escura', uso: 'objeto' }, { id: 'toalha', rotulo: 'Caminho de mesa', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }],
    gerar: p => { const w = num(p, 'largura', 2.6, 1.6, 4.5), m = mat(p, 'madeira', 'madeira.escura'), t = mat(p, 'toalha', 'tecido.veludo-vinho'); return piso([w, 1.3], [
      elipse(0, 0, w, 1.3, m, 0.8, { contorno: 'leve' }), elipse(0, 0, w - 0.14, 1.16, m, 0.82, { contorno: false, semSombra: true, detalhe: 2 }), ret(0, 0, w - 0.5, 0.36, t, 0.84, { raio: 0.03, contorno: 'leve' }),
      elipse(-w * 0.2, 0, 0.16, 0.16, 'latao', 0.9, { contorno: 'leve', detalhe: 2 }), elipse(w * 0.2, 0, 0.16, 0.16, 'latao', 0.9, { contorno: 'leve', detalhe: 2 }), elipse(0, 0, 0.1, 0.1, '#e8d9a8', 0.92, { contorno: false, semSombra: true, detalhe: 3 }),
    ]); } },

  { id: 'relogio.pe', nome: 'Relógio de pé', categoria: 'decoracao', tipo: 'piso', funcoes: ['sala', 'sala-de-jantar', 'corredor', 'biblioteca'], tags: ['relogio', 'pendulo'], pegada: [0.5, 0.4], ...G,
    gerar: () => piso([0.5, 0.4], [ret(0, 0, 0.5, 0.4, 'madeira.escura', 1.4, { raio: 0.03 }), ret(0, 0, 0.4, 0.3, 'madeira.media', 1.5, { contorno: 'leve', detalhe: 2 }), ret(0, -0.02, 0.26, 0.2, 'madeira.escura', 1.55, { contorno: 'leve' }), elipse(0, 0.04, 0.14, 0.14, 'latao', 1.6, { contorno: 'leve', detalhe: 2 }), elipse(0, 0.04, 0.05, 0.05, '#1a1410', 1.62, { contorno: false, semSombra: true, detalhe: 3 })]) },

  { id: 'cristaleira', nome: 'Cristaleira', categoria: 'armazenamento', tipo: 'piso', funcoes: ['sala-de-jantar', 'sala'], tags: ['movel', 'vidro', 'porcelana'], pegada: [1.2, 0.45], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.2, min: 0.8, max: 2, passo: 0.1 }],
    gerar: p => { const w = num(p, 'largura', 1.2, 0.8, 2); return piso([w, 0.45], [ret(0, 0, w, 0.45, 'madeira.escura', 1.8, { raio: 0.02 }), ret(0, 0.02, w - 0.1, 0.36, 'vidro', 1.85, { vidro: true, contorno: 'leve' }), ...Array.from({ length: Math.round(w / 0.25) }, (_, i) => elipse(-w / 2 + 0.16 + i * 0.25, 0.02, 0.12, 0.12, i % 2 ? 'porcelana' : '#c9a45a', 1.9, { contorno: 'leve', detalhe: 3 })), ret(0, -0.19, w - 0.06, 0.04, 'madeira.media', 1.92, { contorno: false, semSombra: true })]); } },

  { id: 'banheira.pes', nome: 'Banheira com pés', categoria: 'banheiro', tipo: 'piso', funcoes: ['banheiro'], tags: ['banheira', 'banho', 'porcelana'], pegada: [1.7, 0.8], ...G,
    gerar: () => piso([1.7, 0.8], [...[[-0.7, -0.28], [-0.7, 0.28], [0.7, -0.28], [0.7, 0.28]].map(([x, y]) => elipse(x!, y!, 0.1, 0.1, 'latao', 0.2, { contorno: 'leve', detalhe: 2 })), elipse(0, 0, 1.7, 0.8, 'porcelana', 0.55, { contorno: 'leve' }), elipse(0.04, 0, 1.5, 0.6, '#cfd8dc', 0.58, { contorno: 'leve', detalhe: 2 }), elipse(0.1, 0, 1.3, 0.5, '#9db9c8', 0.6, { contorno: false, semSombra: true, detalhe: 3 }), elipse(-0.68, 0, 0.1, 0.1, 'latao', 0.7, { contorno: 'leve', detalhe: 3 }), ret(-0.82, 0, 0.12, 0.04, 'latao', 0.72, { contorno: false, semSombra: true, detalhe: 3 })]) },

  { id: 'vaso.sanitario', nome: 'Vaso sanitário antigo', categoria: 'banheiro', tipo: 'piso', funcoes: ['banheiro'], tags: ['vaso', 'banheiro', 'porcelana'], pegada: [0.5, 0.75], ...G,
    gerar: () => piso([0.5, 0.75], [ret(0, -0.26, 0.46, 0.2, 'porcelana', 0.9, { raio: 0.04, contorno: 'leve' }), ret(0, -0.3, 0.3, 0.04, 'latao', 0.95, { contorno: false, semSombra: true, detalhe: 3 }), elipse(0, 0.12, 0.42, 0.5, 'porcelana', 0.6, { contorno: 'leve' }), elipse(0, 0.13, 0.3, 0.38, '#cfd8dc', 0.62, { contorno: 'leve', detalhe: 2 }), elipse(0, 0.17, 0.18, 0.2, '#7f9fb0', 0.64, { contorno: false, semSombra: true, detalhe: 3 })]) },

  { id: 'pia.pedestal', nome: 'Pia de pedestal', categoria: 'banheiro', tipo: 'piso', funcoes: ['banheiro'], tags: ['pia', 'banheiro', 'porcelana'], pegada: [0.55, 0.45], ...G,
    gerar: () => piso([0.55, 0.45], [ret(0, 0, 0.55, 0.45, 'porcelana', 0.85, { raio: 0.1, contorno: 'leve' }), elipse(0, 0.03, 0.4, 0.3, '#cfd8dc', 0.88, { contorno: 'leve', detalhe: 2 }), elipse(0, 0.04, 0.05, 0.05, '#222', 0.9, { contorno: false, semSombra: true, detalhe: 3 }), elipse(0, -0.17, 0.07, 0.07, 'latao', 0.95, { contorno: 'leve', detalhe: 3 })]) },

  { id: 'cabideiro', nome: 'Cabideiro de pé', categoria: 'decoracao', tipo: 'piso', funcoes: ['corredor', 'sala', 'escritorio'], tags: ['cabideiro', 'casacos'], pegada: [0.45, 0.45], ...G,
    gerar: p => { const r = mulberry32(p.seed); return piso([0.45, 0.45], [elipse(0, 0, 0.44, 0.44, 'madeira.escura', 0.3, { contorno: 'leve' }), ...Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return elipse(Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0.1, 0.1, 'latao', 1.7, { contorno: 'leve', detalhe: 3 }); }), elipse(0, 0, 0.12, 0.12, 'madeira.media', 1.8, { contorno: 'leve' }), elipse(0.02 + r() * 0.04, 0.02, 0.2, 0.14, '#3a3a44', 1.6, { contorno: false, detalhe: 3 })]); } },

  { id: 'globo.terrestre', nome: 'Globo terrestre', categoria: 'decoracao', tipo: 'piso', funcoes: ['biblioteca', 'escritorio', 'sala'], tags: ['globo', 'mapa', 'estudo'], pegada: [0.6, 0.6], ...G,
    gerar: p => { const r = mulberry32(p.seed); return piso([0.6, 0.6], [elipse(0, 0, 0.6, 0.6, 'madeira.escura', 0.3, { contorno: 'leve' }), ...[0].map(() => elipse(0, 0, 0.5, 0.5, '#5b7a93', 1.0, { contorno: 'leve' })), ...Array.from({ length: 5 }, () => elipse((r() - 0.5) * 0.3, (r() - 0.5) * 0.3, 0.12 + r() * 0.1, 0.1 + r() * 0.08, '#b9a46a', 1.02, { contorno: false, semSombra: true, detalhe: 3 })), elipse(0, 0, 0.5, 0.06, 'latao', 1.05, { contorno: 'leve', detalhe: 2 })]); } },

  { id: 'escrivaninha.verde', nome: 'Escrivaninha de tampo verde', categoria: 'mesas', tipo: 'piso', funcoes: ['escritorio', 'biblioteca', 'sala'], tags: ['mesa', 'trabalho', 'abajur', 'couro'], pegada: [1.6, 0.85], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.6, min: 1, max: 3, passo: 0.1 }, { id: 'tampo', rotulo: 'Tampo', tipo: 'material', padrao: 'tecido.verde', uso: 'objeto' }],
    gerar: p => { const w = num(p, 'largura', 1.6, 1, 3), r = mulberry32(p.seed); return piso([w, 0.85], [ret(0, 0, w, 0.85, 'madeira.escura', 0.76, { raio: 0.03 }), ret(0, 0.02, w - 0.14, 0.7, mat(p, 'tampo', 'tecido.verde'), 0.8, { contorno: 'leve', detalhe: 2 }), ret(-w * 0.2, 0.08, 0.34, 0.24, 'papel.folha', 0.82, { contorno: 'leve', detalhe: 3 }), elipse(w * 0.3, -0.22, 0.2, 0.2, 'latao', 0.95, { contorno: 'leve', detalhe: 2 }), elipse(w * 0.3, -0.22, 0.1, 0.1, '#ffd98a', 0.97, { contorno: false, semSombra: true, detalhe: 3 }), elipse(r() * 0.3, 0.12, 0.1, 0.05, '#1a1a1e', 0.84, { contorno: false, detalhe: 3 })]); } },
];
