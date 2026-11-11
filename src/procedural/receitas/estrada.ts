import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';
import { faixa, rot } from './porto.ts';

const P = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['estrada', 'estabulo', 'jardim'], kit: 'estrada' };
const FINO: Partial<Parte> = { contorno: false, semSombra: true, detalhe: 3 };
const SOMBRA = '#2a1c10';

/** Gira os pontos (x, y, x, y…) de `ang` em torno de (cx, cy). */
const gira = (pts: number[], cx: number, cy: number, ang: number): number[] => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return pts.map((v, i) => (i % 2 === 0 ? cx + (v - cx) * c - (pts[i + 1]! - cy) * s : cy + (pts[i - 1]! - cx) * s + (v - cy) * c));
};

/** Roda vista de cima: pneu de ferro, aro de madeira e cubo. `ang` é a direção do rolamento. */
function roda(partes: Parte[], x: number, y: number, d: number, z: number, ang = 0): void {
  const c = Math.cos(ang), s = Math.sin(ang), at = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  partes.push(poli(rot(x + 0.03, y + 0.04, d, d * 0.13, ang), SOMBRA, z, { contorno: false, sombraLeve: true }), poli(rot(x, y, d, d * 0.13, ang), 'ferro', z + 0.01, { contorno: 'leve', detalhe: 2 }), poli(rot(x, y, d * 0.94, d * 0.07, ang), 'madeira.media', z + 0.02, FINO));
  for (const k of [-0.34, -0.17, 0.17, 0.34]) { const [px, py] = at(k * d, 0); partes.push(poli(rot(px, py, d * 0.02, d * 0.1, ang), 'madeira.escura', z + 0.03, FINO)); }
  partes.push(elipse(x, y, d * 0.14, d * 0.14, 'ferro', z + 0.04, { contorno: 'leve', detalhe: 2 }));
}

/** Pelagens do cavalo: corpo, brilho no lombo, crina e cauda. */
const PELAGENS = [
  { corpo: '#7a4a28', crina: '#2a1a10' },   // pardo
  { corpo: '#e8e4da', crina: '#cfc8b8' },   // branco
  { corpo: '#25221f', crina: '#0e0d0d' },   // preto
  { corpo: '#7a4a28', crina: '#2a1a10' },   // malhado (manchas brancas)
];

/** O kit da estrada e do estábulo: carroças, cavalos, feno e carrinhos. */
export const RECEITAS_ESTRADA: Receita[] = [
  { id: 'carroca', nome: 'Carroça', ...P, tags: ['carroca', 'carro', 'estrada', 'carga', 'madeira'], pegada: [3.6, 1.8], altura: 1.4,
    campos: [{ id: 'carga', rotulo: 'Carregada (0 vazia, 1 carregada)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), carga = Math.round(num(p, 'carga', 0, 0, 1)) === 1, partes: Parte[] = [];
      for (const s of [-1, 1]) partes.push(ret(1.35, s * 0.32, 1.0, 0.09, 'madeira.media', 0.55, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), ret(1.8 - 0.04, s * 0.32, 0.08, 0.14, 'ferro', 0.6, { contorno: 'leve', detalhe: 2 }));
      partes.push(ret(1.0, 0, 0.08, 0.64, 'madeira.escura', 0.6, { contorno: 'leve', detalhe: 2 }));
      for (const x of [-0.7, 0.5]) for (const s of [-1, 1]) roda(partes, x, s * 0.78, 0.9, 0.5, 0);
      partes.push(ret(-0.15, 0, 2.5, 1.36, tom(SOMBRA, -0.3), 0.7, { contorno: false, sombraLeve: true }), ret(-0.2, 0, 2.4, 1.3, 'madeira.media', 0.8, { dir: 0, contorno: 'leve', detalhe: 1 }));
      for (let i = 0; i < 10; i++) partes.push(ret(-1.4 + i * 0.24, 0, 0.012, 1.26, tom('#3a2412', -0.2), 0.82, FINO));
      for (const s of [-1, 1]) partes.push(ret(-0.2, s * 0.63, 2.4, 0.1, 'madeira.escura', 0.9, { contorno: 'leve', semSombra: true, detalhe: 1 }));
      partes.push(ret(-1.38, 0, 0.1, 1.3, 'madeira.escura', 0.9, { contorno: 'leve', semSombra: true, detalhe: 1 }), ret(0.98, 0, 0.1, 1.3, 'madeira.escura', 0.9, { contorno: 'leve', semSombra: true, detalhe: 1 }));
      if (carga) {
        partes.push(poli(rot(-0.15, 0.02, 2.0, 1.05, (r() - 0.5) * 0.04), 'tecido.linho', 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(rot(-0.35, -0.1, 1.2, 0.5, 0.05), tom('#f6efdd', 0.2), 1.25, FINO));
        for (const x of [-0.8, -0.15, 0.5]) partes.push(...faixa([x, -0.53, x + (r() - 0.5) * 0.1, 0.53], 0.05, '#a8895a', 1.3, { contorno: 'leve', semSombra: true, detalhe: 2 }));
        partes.push(...faixa([-1.1, -0.45, 0.8, 0.45], 0.03, tom('#a8895a', -0.2), 1.35, FINO), ...faixa([-1.1, 0.45, 0.8, -0.45], 0.03, tom('#a8895a', -0.2), 1.35, FINO));
      } else {
        partes.push(ret(-1.05, 0, 0.36, 1.06, 'madeira.clara', 1.0, { dir: 0, contorno: 'leve', sombraLeve: true, detalhe: 1 }), ret(-1.05, 0, 0.012, 1.06, tom('#3a2412', -0.2), 1.05, FINO));
        if (r() < 0.7) partes.push(poli(rot(0.3, (r() - 0.5) * 0.5, 0.5, 0.3, r() * 1.5), 'tecido.mostarda', 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      }
      return piso([3.6, 1.8], partes);
    } },
  { id: 'carroca-tombada', nome: 'Carroça tombada', ...P, tags: ['carroca', 'veiculo', 'tombada', 'madeira', 'estrada', 'pantano', 'ruina'], pegada: [3.6, 2.4], altura: 1.2,
    campos: [{ id: 'carga', rotulo: 'Carga espalhada (0 vazia, 1 caixotes e sacos)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), carga = Math.round(num(p, 'carga', 1, 0, 1)) === 1, partes: Parte[] = [];
      // Sombra geral no chão
      partes.push(ret(-0.15, -0.05, 2.7, 1.7, tom(SOMBRA, -0.3), 0.5, { contorno: false, sombraLeve: true }));

      // Chassi e piso inclinado visto em perspectiva
      partes.push(ret(-0.2, -0.15, 2.4, 0.76, 'madeira.media', 0.58, { contorno: 'leve', detalhe: 1 }));
      for (const x of [-0.8, -0.2, 0.4]) {
        partes.push(ret(x, -0.15, 0.02, 0.74, 'madeira.escura', 0.6, FINO));
      }

      // Trilhos / laterais da carroça
      partes.push(ret(-0.2, -0.55, 2.4, 0.1, 'madeira.escura', 0.62, { contorno: 'leve', detalhe: 1 }));
      partes.push(ret(-0.2, 0.25, 2.4, 0.1, 'madeira.clara', 0.95, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      for (const x of [-1.1, 0.7]) {
        partes.push(ret(x, -0.15, 0.07, 0.74, 'madeira.escura', 0.96, { contorno: 'leve', semSombra: true, detalhe: 2 }));
      }

      // Varais frontais partidos
      partes.push(...faixa([1.0, -0.22, 1.45, -0.32, 1.65, -0.2], 0.08, 'madeira.media', 0.58, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
      partes.push(ret(1.3, 0.18, 0.6, 0.08, 'madeira.media', 0.58, { dir: 0.18, contorno: 'leve', detalhe: 2 }));

      // Roda ainda suspensa no eixo traseiro
      partes.push(poli(rot(-0.7, 0.48, 0.85, 0.16, (r() - 0.5) * 0.15), 'ferro', 1.05, { contorno: 'leve', detalhe: 1 }));
      partes.push(elipse(-0.7, 0.48, 0.16, 0.16, 'madeira.escura', 1.1, { contorno: 'leve', detalhe: 2 }));

      // Eixo partido do lado que perdeu a roda
      partes.push(ret(0.48, -0.4, 0.1, 0.32, 'madeira.escura', 0.68, { contorno: 'leve', detalhe: 2 }));

      // Roda solta deitada no chão (círculo com aro de ferro e raios)
      const rx = 0.45, ry = -0.75, rd = 0.86;
      partes.push(elipse(rx, ry, rd, rd, 'ferro', 0.55, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      partes.push(elipse(rx, ry, rd * 0.86, rd * 0.86, 'madeira.media', 0.58, { contorno: 'leve', detalhe: 2 }));
      partes.push(elipse(rx, ry, rd * 0.68, rd * 0.68, '#2a1a10', 0.6, { contorno: false, semSombra: true, detalhe: 3 }));
      partes.push(ret(rx, ry, rd * 0.64, 0.04, 'madeira.clara', 0.62, FINO));
      partes.push(ret(rx, ry, 0.04, rd * 0.64, 'madeira.clara', 0.62, FINO));
      partes.push(elipse(rx, ry, 0.2, 0.2, 'madeira.escura', 0.65, { contorno: 'leve', detalhe: 2 }));

      if (carga) {
        // Carga espalhada pelo tombo
        partes.push(poli(rot(-0.2, 0.78, 0.52, 0.52, 0.32), 'madeira.media', 0.8, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
        partes.push(elipse(-0.82, -0.72, 0.44, 0.3, 'tecido.linho', 0.68, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
        partes.push(ret(0.2, 0.65, 0.6, 0.1, 'madeira.clara', 0.75, { dir: 0.35, contorno: 'leve', detalhe: 3 }));
      }
      return piso([3.6, 2.4], partes);
    } },
  { id: 'cavalo', nome: 'Cavalo', ...P, tags: ['cavalo', 'animal', 'montaria', 'estabulo', 'estrada'], pegada: [2.5, 1.0], altura: 1.6,
    campos: [{ id: 'pelagem', rotulo: 'Pelagem (0 pardo, 1 branco, 2 preto, 3 malhado)', tipo: 'numero', padrao: 0, min: 0, max: 3, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), k = Math.round(num(p, 'pelagem', 0, 0, 3)), { corpo, crina } = PELAGENS[k]!, partes: Parte[] = [], giro = (r() - 0.5) * 0.3;
      const claro = tom(corpo, 0.14), escuro = tom(corpo, -0.22), cabeca = (pts: number[]): number[] => gira(pts, 0.42, 0, giro);
      partes.push(elipse(-0.02, 0.07, 1.34, 0.66, '#1c120a', 0.5, { contorno: false, sombraLeve: true }));
      for (const [x, y, a] of [[0.45, -0.3, 0.2], [0.45, 0.3, -0.2], [-0.55, -0.3, 0.1], [-0.55, 0.3, -0.1]] as const) partes.push(elipse(x + 0.12 * Math.sign(a), y, 0.34, 0.13, escuro, 0.55, { contorno: 'leve', semSombra: true, detalhe: 2 }), elipse(x + 0.28 * Math.sign(a), y, 0.1, 0.1, '#1a1410', 0.56, FINO));
      partes.push(poli(cabeca([0.3, -0.22, 0.95, -0.14, 0.95, 0.14, 0.3, 0.22]), corpo, 0.7, { contorno: 'leve', detalhe: 1 }), poli(cabeca([0.3, -0.04, 0.95, -0.04, 0.95, 0.04, 0.3, 0.04]), crina, 0.75, { contorno: false, semSombra: true, detalhe: 2 }));
      partes.push(elipse(0, 0, 1.3, 0.62, corpo, 0.8, { contorno: 'leve', detalhe: 1 }), elipse(-0.04, -0.05, 1.0, 0.3, claro, 0.85, { contorno: false, semSombra: true, detalhe: 2 }), elipse(0.5, 0, 0.3, 0.5, escuro, 0.82, FINO), elipse(-0.55, 0, 0.35, 0.5, escuro, 0.82, FINO));
      if (k === 3) for (const [x, y, w, h] of [[-0.3, 0.12, 0.4, 0.26], [0.2, -0.14, 0.34, 0.22], [-0.65, -0.1, 0.22, 0.2]] as const) partes.push(elipse(x + (r() - 0.5) * 0.06, y, w, h, '#ece6d8', 0.9, { contorno: false, semSombra: true, detalhe: 2 }));
      partes.push(poli(cabeca([0.88, -0.14, 1.2, -0.08, 1.2, 0.08, 0.88, 0.14]), corpo, 0.95, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(cabeca([1.1, -0.07, 1.22, -0.05, 1.22, 0.05, 1.1, 0.07]), k === 1 ? '#c9b8a8' : escuro, 1.0, { contorno: 'leve', semSombra: true, detalhe: 2 }), ...[-1, 1].map(s => poli(cabeca([0.86, s * 0.1, 0.96, s * 0.17, 0.98, s * 0.1]), escuro, 1.0, { contorno: 'leve', semSombra: true, detalhe: 3 })));
      partes.push(poli(cabeca([0.3, -0.05, 0.9, -0.06, 0.9, -0.02, 0.3, 0.01]), crina, 1.05, { contorno: false, semSombra: true, detalhe: 3 }));
      for (let i = 0; i < 6; i++) partes.push(...faixa(cabeca([0.4 + i * 0.09, 0, 0.42 + i * 0.09, (i % 2 ? 1 : -1) * 0.1]), 0.025, crina, 1.06, FINO));
      const cauda: number[] = [-0.62, 0]; for (let i = 1; i <= 6; i++) cauda.push(-0.62 - i * 0.1, Math.sin(i * 0.9 + giro * 4) * 0.08);
      partes.push(...faixa(cauda, 0.1, crina, 0.9, { contorno: 'leve', semSombra: true, detalhe: 2 }), ...faixa(cauda.map((v, i) => (i % 2 ? v * 1.15 : v)), 0.05, tom(crina, 0.12), 0.95, FINO));
      return piso([2.5, 1.0], partes);
    } },
  { id: 'fardo-de-feno', nome: 'Fardo de feno', ...P, tags: ['feno', 'fardo', 'palha', 'estabulo', 'fazenda'], pegada: [1.0, 0.7], altura: 0.6,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [ret(0.04, 0.05, 0.96, 0.66, SOMBRA, 0.5, { contorno: false, sombraLeve: true }), ret(0, 0, 0.96, 0.66, '#c9a85a', 0.6, { raio: 0.04, contorno: 'leve', detalhe: 1 })];
      for (let i = 0; i < 46; i++) { const x = (r() - 0.5) * 0.9, y = (r() - 0.5) * 0.6, a = (r() - 0.5) * 0.5, l = 0.1 + r() * 0.16; partes.push(...faixa([x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2, x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2], 0.012, r() < 0.5 ? '#e0c47a' : '#9a7a3a', 0.7 + i * 0.002, FINO)); }
      for (const x of [-0.22, 0.22]) partes.push(ret(x, 0, 0.035, 0.68, '#5b4a2a', 0.9, { contorno: false, semSombra: true, detalhe: 2 }), ret(x - 0.01, 0, 0.012, 0.68, '#8a7648', 0.92, FINO));
      return piso([1.0, 0.7], partes);
    } },
  { id: 'bebedouro', nome: 'Bebedouro', ...P, tags: ['bebedouro', 'cocho', 'agua', 'estabulo', 'madeira'], pegada: [1.8, 0.8], altura: 0.5,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [ret(0.04, 0.06, 1.74, 0.74, SOMBRA, 0.5, { contorno: false, sombraLeve: true }), ret(0, 0, 1.74, 0.74, 'madeira.escura', 0.6, { raio: 0.05, contorno: 'leve', detalhe: 1 }), ret(0, 0, 1.6, 0.6, tom('#1e110a', 0.1), 0.7, { raio: 0.04, contorno: false, semSombra: true, detalhe: 2 }), ret(0, 0.02, 1.52, 0.5, '#3f6f8f', 0.8, { raio: 0.04, contorno: false, semSombra: true, vidro: true, detalhe: 3 }), ret(-0.2, -0.12, 0.9, 0.1, tom('#8fb8d0', 0.1), 0.85, FINO)];
      for (let i = 0; i < 5; i++) partes.push(ret(-0.7 + i * 0.35 + (r() - 0.5) * 0.08, (r() - 0.5) * 0.3, 0.14 + r() * 0.1, 0.01, tom('#b8d8e8', 0.2), 0.88, FINO));
      for (const x of [-0.6, 0.6]) partes.push(ret(x, 0, 0.1, 0.78, 'madeira.media', 0.95, { contorno: 'leve', semSombra: true, detalhe: 2 }), elipse(x, -0.3, 0.05, 0.05, 'ferro', 1.0, FINO), elipse(x, 0.3, 0.05, 0.05, 'ferro', 1.0, FINO));
      return piso([1.8, 0.8], partes);
    } },
  { id: 'carrinho-de-mao', nome: 'Carrinho de mão', ...P, tags: ['carrinho', 'mao', 'jardim', 'fazenda', 'carga'], pegada: [1.9, 0.7], altura: 0.5,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], bojo = [-0.1, -0.3, 0.5, -0.19, 0.5, 0.19, -0.1, 0.3];
      for (const s of [-1, 1]) partes.push(ret(-0.52, s * 0.22, 0.95, 0.045, 'madeira.media', 0.55, { contorno: 'leve', sombraLeve: true, detalhe: 2 }), ret(-1.02, s * 0.22, 0.12, 0.06, 'madeira.clara', 0.58, { contorno: 'leve', semSombra: true, detalhe: 2 }), ret(-0.2, s * 0.25, 0.04, 0.1, 'ferro', 0.6, FINO));
      partes.push(poli(bojo.map((v, i) => v + (i % 2 ? 0.05 : 0.04)), SOMBRA, 0.6, { contorno: false, sombraLeve: true }), poli(bojo, 'ferro', 0.7, { contorno: 'leve', detalhe: 1 }), poli([-0.04, -0.24, 0.44, -0.15, 0.44, 0.15, -0.04, 0.24], tom('#2c2e34', -0.1), 0.75, { contorno: false, semSombra: true, detalhe: 2 }));
      for (let i = 0; i < 9; i++) partes.push(elipse(0.2 + (r() - 0.5) * 0.5, (r() - 0.5) * 0.36, 0.08 + r() * 0.1, 0.07 + r() * 0.07, i % 3 ? '#5b4636' : '#7a6248', 0.8 + i * 0.005, { contorno: false, semSombra: true, detalhe: 3 }));
      partes.push(poli(rot(0.6, 0, 0.5, 0.1, 0), SOMBRA, 0.5, { contorno: false, sombraLeve: true }), poli(rot(0.6, 0, 0.5, 0.08, 0), 'ferro', 0.9, { contorno: 'leve', detalhe: 2 }), elipse(0.6, 0, 0.14, 0.14, 'madeira.media', 0.95, { contorno: 'leve', detalhe: 2 }));
      for (const s of [-1, 1]) partes.push(ret(0.5, s * 0.1, 0.1, 0.03, 'ferro', 0.92, FINO));
      return piso([1.9, 0.7], partes);
    } },
  { id: 'carrinho-de-carga', nome: 'Carrinho de carga', ...P, funcoes: ['porto', 'estrada', 'estabulo', 'mercado'], tags: ['carrinho', 'carga', 'deque', 'porto', 'madeira'], pegada: [2.0, 0.9], altura: 0.6,
    campos: [{ id: 'carga', rotulo: 'Carregado (0 vazio, 1 carregado)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), carga = Math.round(num(p, 'carga', 1, 0, 1)) === 1, partes: Parte[] = [];
      for (const x of [-0.55, 0.5]) for (const s of [-1, 1]) partes.push(poli(rot(x, s * 0.4, 0.34, 0.08, 0), 'ferro', 0.5, { contorno: 'leve', detalhe: 2 }));
      partes.push(ret(0.03, 0.05, 1.5, 0.8, SOMBRA, 0.55, { contorno: false, sombraLeve: true }));
      for (let i = 0; i < 6; i++) partes.push(ret(-0.62 + i * 0.25, 0, 0.24, 0.8, ['madeira.clara', 'madeira.media'][i % 2]!, 0.6, { dir: Math.PI / 2, contorno: 'leve', detalhe: 1 }));
      for (const s of [-1, 1]) partes.push(ret(-0.05, s * 0.36, 1.5, 0.06, 'madeira.escura', 0.7, { contorno: 'leve', semSombra: true, detalhe: 2 }));
      partes.push(...faixa([-0.7, -0.4, -0.95, -0.4, -0.95, 0.4, -0.7, 0.4], 0.05, 'ferro', 0.8, { contorno: 'leve', semSombra: true, detalhe: 2 }), ret(-0.97, 0, 0.1, 0.34, 'madeira.media', 0.85, { contorno: 'leve', detalhe: 2 }), ret(0.82, 0, 0.1, 0.5, 'madeira.escura', 0.7, { contorno: 'leve', detalhe: 2 }), elipse(0.95, 0, 0.1, 0.1, 'ferro', 0.8, FINO));
      if (carga) for (const [x, y, s, a] of [[-0.1, -0.15, 0.5, 0.08], [0.45, 0.1, 0.42, -0.12]] as const) {
        const c = 'madeira.media';
        partes.push(poli(rot(x + 0.03, y + 0.04, s, s, a), SOMBRA, 1.0, { contorno: false, sombraLeve: true }), poli(rot(x, y, s, s, a), c, 1.05, { contorno: 'leve', detalhe: 1 }), poli(rot(x, y, s * 0.78, s * 0.78, a), 'madeira.clara', 1.1, { contorno: false, semSombra: true, detalhe: 2 }), ...faixa([x - s * 0.4 * Math.cos(a), y - s * 0.4 * Math.sin(a), x + s * 0.4 * Math.cos(a), y + s * 0.4 * Math.sin(a)], 0.04, 'ferro', 1.15, FINO));
      }
      if (carga) partes.push(...faixa([0.2 + r() * 0.1, 0.36, 0.1, -0.35], 0.025, '#c8bca0', 1.2, FINO));
      return piso([2.0, 0.9], partes);
    } },
];
