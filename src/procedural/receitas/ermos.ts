import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';

const G = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim'], kit: 'ermos' };
const LUZ = Math.atan2(-1, -1);   // a luz vem do noroeste (−x, −y)
const CINZA = '#7d838b';

/** Um galho: lente fina da base (x, y) para `ang`, com `len` de comprimento e `w` de largura. */
function galho(x: number, y: number, ang: number, len: number, w: number, mat: string, z: number): Parte {
  const c = Math.cos(ang), s = Math.sin(ang), local = [0, 0, len * 0.3, w / 2, len * 0.7, w / 3, len, 0, len * 0.7, -w / 3, len * 0.3, -w / 2], pts: number[] = [];
  for (let i = 0; i < local.length; i += 2) pts.push(x + local[i]! * c - local[i + 1]! * s, y + local[i]! * s + local[i + 1]! * c);
  return poli(pts, mat, z, { contorno: 'leve', detalhe: 2 });
}

/**
 * Rochedo visto de cima: contorno de 14 a 20 vértices com bordas quebradas, 4 faces em tons de cinza ao redor de uma cumeeira
 * deslocada para a luz (noroeste), rachaduras e, por cima, musgo (`cobertura` 1) ou um tampo de neve (`cobertura` 2).
 */
function rochedo(tamanho: number, cobertura: number, seed: number): Parte[] {
  const r = mulberry32(seed), W = tamanho, H = Math.round(tamanho * 80) / 100, n = 14 + Math.floor(r() * 7), borda: number[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, k = (0.8 + r() * 0.2) * (i % 2 ? 0.93 : 1); borda.push(Math.cos(a) * (W / 2) * k, Math.sin(a) * (H / 2) * k); }
  const cx = -W * 0.08, cy = -H * 0.08, partes: Parte[] = [poli(borda, tom(CINZA, -0.35), 0.5, { contorno: 'leve', sombraLeve: true })];
  const faces = 4, por = n / faces;
  for (let f = 0; f < faces; f++) {
    const i0 = Math.round(f * por), i1 = Math.round((f + 1) * por), pts = [cx, cy];
    for (let i = i0; i <= i1; i++) pts.push(borda[(i % n) * 2]! * 0.97, borda[(i % n) * 2 + 1]! * 0.97);
    const meio = ((i0 + i1) / 2 / n) * Math.PI * 2, olha = Math.cos(meio - LUZ);   // 1: de frente para a luz
    partes.push(poli(pts, tom(CINZA, olha * 0.28), 0.6 + f * 0.01, { contorno: false, detalhe: 2 }));
  }
  const topo: number[] = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + r() * 0.3, k = 0.3 + r() * 0.12; topo.push(cx + Math.cos(a) * (W / 2) * k, cy + Math.sin(a) * (H / 2) * k); }
  partes.push(poli(topo, tom(CINZA, 0.22), 0.7, { contorno: false, semSombra: true, detalhe: 3 }));
  for (let i = 0; i < 3 + Math.floor(W / 2); i++) {   // rachaduras: traços finos que saem da cumeeira
    const a = r() * Math.PI * 2, len = (W / 2) * (0.25 + r() * 0.25), ox = cx + Math.cos(a) * W * 0.05, oy = cy + Math.sin(a) * H * 0.05;
    partes.push(galho(ox, oy, a, len, 0.025 + r() * 0.015, tom(CINZA, -0.6), 0.72));
  }
  if (cobertura === 1) {
    for (let i = 0; i < 6 + Math.floor(W * 2); i++) {
      const a = LUZ + (r() - 0.5) * 2.4, d = (W / 2) * (0.2 + r() * 0.6), t = W * (0.07 + r() * 0.08);
      partes.push(elipse(cx + Math.cos(a) * d * 0.8, cy + Math.sin(a) * d * 0.7, t * 1.3, t, r() < 0.5 ? '#4f7a3a' : '#678f45', 0.8 + r() * 0.04, { contorno: false, semSombra: true, detalhe: 3 }));
    }
  } else if (cobertura === 2) {
    const neve = (k: number, dx: number, dy: number): number[] => Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, kk = k * (0.72 + r() * 0.28); return [dx + Math.cos(a) * (W / 2) * kk, dy + Math.sin(a) * (H / 2) * kk]; }).flat();
    partes.push(poli(neve(0.66, cx * 0.5 + W * 0.02, cy * 0.5 + H * 0.03), '#b8c8dc', 0.8, { contorno: false, semSombra: true, detalhe: 2 }), poli(neve(0.62, cx * 0.5 - W * 0.01, cy * 0.5 - H * 0.01), '#f4f8fc', 0.85, { contorno: false, semSombra: true, detalhe: 2 }),
      elipse(cx - W * 0.1, cy - H * 0.1, W * 0.22, H * 0.16, '#ffffff', 0.9, { contorno: false, semSombra: true, detalhe: 3 }));
  }
  return partes;
}

/** O kit de ermos: o que o inverno e as rochas pedem (as árvores e arbustos de neve são da coleção). */
export const RECEITAS_ERMOS: Receita[] = [
  { id: 'rochedo', nome: 'Rochedo', ...G, tags: ['rocha', 'pedra', 'natureza', 'inverno'], pegada: [3, 2.4], altura: 1.5,
    campos: [{ id: 'tamanho', rotulo: 'Tamanho (m)', tipo: 'numero', padrao: 3, min: 1.5, max: 5, passo: 0.25 }, { id: 'cobertura', rotulo: 'Cobertura (0 nenhuma, 1 musgo, 2 neve)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => { const t = num(p, 'tamanho', 3, 1.5, 5); return piso([t, Math.round(t * 80) / 100], rochedo(t, Math.round(num(p, 'cobertura', 0, 0, 2)), p.seed)); } },
  { id: 'seixos', nome: 'Seixos', ...G, tags: ['pedra', 'seixos', 'natureza', 'rocha'], pegada: [1, 0.8], altura: 0.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 5 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) {
        const w = 0.14 + r() * 0.16, h = w * (0.7 + r() * 0.25), x = (r() - 0.5) * (1 - w), y = (r() - 0.5) * (0.8 - h), base = tom(CINZA, (r() - 0.5) * 0.3), z = 0.5 + i * 0.02;
        partes.push(elipse(x + 0.01, y + 0.015, w, h, tom(base, -0.4), z, { contorno: 'leve', sombraLeve: true }), elipse(x - w * 0.04, y - h * 0.04, w * 0.84, h * 0.84, base, z + 0.01, { contorno: false, semSombra: true, detalhe: 2 }), elipse(x - w * 0.15, y - h * 0.15, w * 0.35, h * 0.3, tom(base, 0.35), z + 0.015, { contorno: false, semSombra: true, detalhe: 3 }));
      }
      return piso([1, 0.8], partes);
    } },
  { id: 'galho-seco', nome: 'Galho seco', ...G, tags: ['galho', 'madeira', 'natureza', 'inverno'], pegada: [1.5, 0.6], altura: 0.15,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [galho(-0.72, 0.02, (r() - 0.5) * 0.12, 1.44, 0.07, '#4a3a2c', 0.6)];
      for (let i = 0; i < 5; i++) {
        const t = 0.1 + (i / 5) * 0.8 + r() * 0.08, x = -0.72 + 1.44 * t, lado = i % 2 ? 1 : -1, ang = lado * (0.45 + r() * 0.35), len = 0.26 + r() * 0.16;
        partes.push(galho(x, 0.02, ang, len, 0.03, '#5b4636', 0.62));
        const ex = x + Math.cos(ang) * len * 0.6, ey = 0.02 + Math.sin(ang) * len * 0.6;
        partes.push(galho(ex, ey, ang + lado * 0.5, len * 0.5, 0.018, '#5b4636', 0.64));
      }
      return piso([1.5, 0.6], partes);
    } },
  { id: 'treno', nome: 'Trenó', ...G, funcoes: ['jardim', 'estabulo'], tags: ['treno', 'madeira', 'inverno', 'veiculo'], pegada: [1.4, 0.6], altura: 0.3,
    gerar: () => piso([1.4, 0.6], [
      ...[-1, 1].map(s => ret(-0.02, s * 0.24, 1.3, 0.05, 'ferro', 0.5, { raio: 0.02, contorno: 'leve' })), ...[-1, 1].map(s => elipse(0.62, s * 0.24, 0.16, 0.06, 'ferro', 0.52, { contorno: 'leve', detalhe: 2 })),
      ...[-1, 1].map(s => ret(0, s * 0.2, 1.1, 0.04, 'madeira.escura', 0.7, { contorno: 'leve', detalhe: 2 })),
      ...Array.from({ length: 7 }, (_, i) => ret(-0.5 + i * 0.17, 0, 0.12, 0.5, i % 2 ? 'madeira.media' : 'madeira.clara', 0.9, { raio: 0.01, contorno: 'leve' })),
      ret(0, -0.29, 0.04, 0.04, 'ferro', 1.0, { contorno: false, semSombra: true, detalhe: 3 }),
    ]) },
];
