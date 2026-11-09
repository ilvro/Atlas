import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';
import { LUZ_X, LUZ_Y, bolha, silhuetaDeDiscos, tira, tufo, type Disco, type Tons } from '../organico.ts';

const G = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim'], kit: 'ermos' };
const LUZ = Math.atan2(-1, -1);   // a luz vem do noroeste (−x, −y)
const CINZA_PADRAO = '#7d838b', CINZA = CINZA_PADRAO;
/** Os tons de rocha do rochedo: cinza, arenito (falésias de costa) e basalto escuro. */
const TONS_DE_ROCHA = [CINZA_PADRAO, '#a48c68', '#55595f'];

/** Um galho: lente fina da base (x, y) para `ang`, com `len` de comprimento e `w` de largura. */
export function galho(x: number, y: number, ang: number, len: number, w: number, mat: string, z: number): Parte {
  const c = Math.cos(ang), s = Math.sin(ang), local = [0, 0, len * 0.3, w / 2, len * 0.7, w / 3, len, 0, len * 0.7, -w / 3, len * 0.3, -w / 2], pts: number[] = [];
  for (let i = 0; i < local.length; i += 2) pts.push(x + local[i]! * c - local[i + 1]! * s, y + local[i]! * s + local[i + 1]! * c);
  return poli(pts, mat, z, { contorno: 'leve', detalhe: 2 });
}

/**
 * Rochedo visto de cima: dois a quatro blocos facetados juntos (uma silhueta só, com contorno e sombra), cada um pintado do escuro ao claro
 * para o noroeste em polígonos de poucos lados (as facetas), fendas finas entre eles e, por cima, musgo macio (`cobertura` 1) ou uma capa
 * de neve em cada bloco (`cobertura` 2). `base` é o tom da pedra (cinza, arenito, basalto).
 */
function rochedo(tamanho: number, cobertura: number, seed: number, base = CINZA_PADRAO): Parte[] {
  const r = mulberry32(seed), W = tamanho / 2, H = (Math.round(tamanho * 80) / 100) / 2, partes: Parte[] = [];
  const tons: Tons = { fundo: tom(base, -0.6), base: tom(base, -0.3), meio: tom(base, -0.05), luz: tom(base, 0.18), brilho: tom(base, 0.36) };
  const n = 2 + Math.floor(r() * 3), blocos: Disco[] = [];
  blocos.push({ x: -W * 0.12, y: -H * 0.1, r: Math.min(W, H) * 0.72 });
  for (let i = 1; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 1.2, rr = Math.min(W, H) * (0.4 + r() * 0.2); blocos.push({ x: Math.cos(a) * (W - rr) * 0.9, y: Math.sin(a) * (H - rr) * 0.9, r: rr }); }
  for (const b of blocos) { b.x = Math.max(-W + b.r, Math.min(W - b.r, b.x)); b.y = Math.max(-H + b.r, Math.min(H - b.r, b.y)); }
  const contorno = silhuetaDeDiscos(blocos, 40).map((v, k) => v * (0.97 + mulberry32(seed * 7 + k)() * 0.06));
  partes.push(poli(contorno, tons.fundo, 0.5, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  // Do menor (atrás) ao maior; cada bloco com 6 a 8 facetas.
  blocos.sort((a, b) => a.r - b.r).forEach((b, i) => tufo(partes, r, b.x, b.y, b.r, tons, 0.6 + i * 0.05, 0, 6 + Math.floor(r() * 3)));
  // Fendas: traços finos e escuros, curtos, em direções quebradas.
  for (let i = 0; i < 2 + Math.floor(tamanho); i++) {
    const b = blocos[Math.floor(r() * blocos.length)]!, a = r() * Math.PI * 2, d = b.r * r() * 0.5, x0 = b.x + Math.cos(a) * d, y0 = b.y + Math.sin(a) * d, pts = [x0, y0];
    let ang = r() * Math.PI * 2; for (let k = 0; k < 3; k++) { ang += (r() - 0.5) * 1.2; pts.push(pts[pts.length - 2]! + Math.cos(ang) * b.r * 0.22, pts[pts.length - 1]! + Math.sin(ang) * b.r * 0.22); }
    partes.push(tira(pts, 0.03 + r() * 0.02, tom(base, -0.65), 0.8, { contorno: false, semSombra: true, suave: true, detalhe: 2 }, 0.3));
  }
  if (cobertura === 1) {
    const verdes: Tons = { fundo: '#2f4a22', base: '#4f7a3a', meio: '#557a38', luz: '#678f45', brilho: '#8fb05a' };
    for (const b of blocos) for (let k = 0; k < 2 + Math.floor(b.r * 2); k++) {
      const a = Math.atan2(LUZ_Y, LUZ_X) + (r() - 0.5) * 2.2, d = b.r * (0.25 + r() * 0.45), t = b.r * (0.14 + r() * 0.14);
      const mx = b.x + Math.cos(a) * d, my = b.y + Math.sin(a) * d, o = { contorno: false as const, semSombra: true, suave: true };
      partes.push(poli(bolha(mx, my, t * 1.3, t, 12, 0.35, r, r() * 6), verdes.base, 0.85, { ...o, detalhe: 2 }), poli(bolha(mx + LUZ_X * t * 0.25, my + LUZ_Y * t * 0.25, t * 0.85, t * 0.6, 10, 0.35, r, r() * 6), verdes.luz, 0.86, { ...o, detalhe: 3, alfa: 0.85 }));
    }
  } else if (cobertura === 2) {
    for (const b of blocos) {
      const cx = b.x + LUZ_X * b.r * 0.12, cy = b.y + LUZ_Y * b.r * 0.12;
      partes.push(poli(bolha(cx + b.r * 0.04, cy + b.r * 0.05, b.r * 0.66, b.r * 0.62, 12, 0.18, r), '#b8c8dc', 0.9, { contorno: false, semSombra: true, suave: true, detalhe: 2 }));
      partes.push(poli(bolha(cx, cy, b.r * 0.6, b.r * 0.56, 12, 0.18, r), '#f4f8fc', 0.91, { contorno: false, semSombra: true, suave: true, detalhe: 2 }));
      partes.push(poli(bolha(cx + LUZ_X * b.r * 0.2, cy + LUZ_Y * b.r * 0.2, b.r * 0.26, b.r * 0.22, 10, 0.2, r), '#ffffff', 0.92, { contorno: false, semSombra: true, suave: true, detalhe: 3 }));
    }
  }
  return partes;
}

/** O kit de ermos: o que o inverno e as rochas pedem (as árvores e arbustos de neve são da coleção). */
export const RECEITAS_ERMOS: Receita[] = [
  { id: 'rochedo', nome: 'Rochedo', ...G, tags: ['rocha', 'pedra', 'natureza', 'inverno'], pegada: [3, 2.4], altura: 1.5,
    campos: [{ id: 'tamanho', rotulo: 'Tamanho (m)', tipo: 'numero', padrao: 3, min: 1.5, max: 5, passo: 0.25 }, { id: 'cobertura', rotulo: 'Cobertura (0 nenhuma, 1 musgo, 2 neve)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }, { id: 'tom', rotulo: 'Tom (0 cinza, 1 arenito, 2 basalto)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => { const t = num(p, 'tamanho', 3, 1.5, 5); return piso([t, Math.round(t * 80) / 100], rochedo(t, Math.round(num(p, 'cobertura', 0, 0, 2)), p.seed, TONS_DE_ROCHA[Math.round(num(p, 'tom', 0, 0, 2))])); } },
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
