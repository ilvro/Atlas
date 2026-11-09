import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';
import { galho } from './ermos.ts';

const P = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['porto', 'jardim'], kit: 'porto' };
const FINO: Partial<Parte> = { contorno: false, semSombra: true, detalhe: 3 };
const CORDA = '#c8bca0';

/** Faixa de largura `w` ao longo de uma polilinha (cordas, gradis, aros). */
export function faixa(pts: number[], w: number, mat: string, z: number, extra: Partial<Parte> = { contorno: false, semSombra: true, detalhe: 2 }): Parte[] {
  const saida: Parte[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i]!, y0 = pts[i + 1]!, x1 = pts[i + 2]!, y1 = pts[i + 3]!, a = Math.atan2(y1 - y0, x1 - x0), nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
    saida.push(poli([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], mat, z, extra));
  }
  return saida;
}

/** Um retângulo `w × h` centrado em (x, y) e girado `ang`, como pontos de polígono. */
export const rot = (x: number, y: number, w: number, h: number, ang: number): number[] => {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([u, v]) => [x + u! * c - v! * s, y + u! * s + v! * c]);
};

/** Um caixote visto de cima: sombra, tampa de tábuas, moldura e travessa em X. */
function caixote(partes: Parte[], x: number, y: number, s: number, ang: number, z: number, cor = 'madeira.media'): void {
  const d = (u: number, v: number): [number, number] => [x + u * Math.cos(ang) - v * Math.sin(ang), y + u * Math.sin(ang) + v * Math.cos(ang)];
  partes.push(poli(rot(x + s * 0.06, y + s * 0.08, s, s, ang), tom('#4a3220', -0.5), z, { contorno: 'leve', sombraLeve: true }), poli(rot(x, y, s, s, ang), cor, z + 0.01, { contorno: 'leve', detalhe: 1 }));
  for (const k of [-0.25, 0.25]) { const [px, py] = d(0, k * s); partes.push(poli(rot(px, py, s * 0.94, s * 0.015, ang), tom('#3a2412', -0.2), z + 0.02, FINO)); }
  for (const [u, v, w, h] of [[0, -0.44, 1, 0.12], [0, 0.44, 1, 0.12], [-0.44, 0, 0.12, 1], [0.44, 0, 0.12, 1]] as const) { const [px, py] = d(u * s, v * s); partes.push(poli(rot(px, py, w * s, h * s, ang), 'madeira.clara', z + 0.03, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
  const [ax, ay] = d(-s * 0.36, -s * 0.36), [bx, by] = d(s * 0.36, s * 0.36), [cx, cy] = d(s * 0.36, -s * 0.36), [ex, ey] = d(-s * 0.36, s * 0.36);
  partes.push(...faixa([ax, ay, bx, by], s * 0.07, 'madeira.clara', z + 0.04, FINO), ...faixa([cx, cy, ex, ey], s * 0.07, 'madeira.clara', z + 0.04, FINO));
}

/** Um barril visto de cima: aro de ferro, tampo de tábuas e batoque. */
function barril(partes: Parte[], x: number, y: number, d: number, z: number, ang = 0): void {
  partes.push(elipse(x + d * 0.06, y + d * 0.08, d, d, tom('#4a3220', -0.5), z, { contorno: 'leve', sombraLeve: true }), elipse(x, y, d, d, 'ferro', z + 0.01, { contorno: 'leve', detalhe: 1 }), elipse(x, y, d * 0.86, d * 0.86, 'madeira.media', z + 0.02, { contorno: false, semSombra: true, detalhe: 2 }));
  const c = Math.cos(ang), s = Math.sin(ang);
  for (const k of [-0.22, 0, 0.22]) { const len = d * 0.8 * Math.sqrt(Math.max(0, 1 - (k / 0.4) ** 2)); partes.push(poli(rot(x - s * k * d, y + c * k * d, len, d * 0.025, ang), tom('#3a2412', -0.2), z + 0.03, FINO)); }
  partes.push(elipse(x - d * 0.12, y - d * 0.14, d * 0.2, d * 0.14, tom('#c89a60', 0.2), z + 0.04, FINO), elipse(x + d * 0.12, y + d * 0.1, d * 0.1, d * 0.1, tom('#3a2412', -0.4), z + 0.05, FINO));
}

/** Meia-largura do casco (`u` de 0 a 1, da popa à proa): popa cheia, proa em ponta. */
const meia = (u: number, B: number): number => (u < 0.62 ? (B / 2) * (0.9 + 0.1 * Math.sin((u / 0.62) * Math.PI / 2)) : (B / 2) * Math.pow(Math.cos(((u - 0.62) / 0.38) * Math.PI / 2), 0.75));

/** Contorno do casco (ou do convés, com `k` < 1): a boreste da popa à proa, depois a bombordo de volta. */
function casco(L: number, B: number, k: number, passos = 24): number[] {
  const a: number[] = [], b: number[] = [];
  for (let i = 0; i <= passos; i++) { const u = (i / passos) * (k < 1 ? 0.96 : 1), x = -L / 2 + u * L + (k < 1 ? L * 0.012 : 0), h = meia(u, B) * k; a.push(x, -h); b.unshift(x, h); }
  return [...a, ...b];
}

/** O kit do porto: navios, cais, barracas de feira e as coisas que se empilham neles. */
export const RECEITAS_PORTO: Receita[] = [
  { id: 'navio', nome: 'Navio', ...P, tags: ['navio', 'barco', 'porto', 'agua', 'mastro'], pegada: [20, 5.6], altura: 6,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 20, min: 14, max: 30, passo: 1 }, { id: 'mastros', rotulo: 'Mastros (2 ou 3)', tipo: 'numero', padrao: 2, min: 2, max: 3, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), L = num(p, 'comprimento', 20, 14, 30), B = Math.round(L * 28) / 100, nm = Math.round(num(p, 'mastros', 2, 2, 3)), partes: Parte[] = [];
      const fora = casco(L, B, 1);
      partes.push(poli(fora, 'madeira.escura', 0.5, { contorno: 'leve', sombraLeve: true }), poli(casco(L, B, 0.84), 'madeira.clara', 0.6, { dir: 0, contorno: false, semSombra: true, detalhe: 1 }));
      for (let k = -6; k <= 6; k++) {   // juntas das tábuas do convés
        const y = k * B * 0.065, xs: number[] = [];
        for (let i = 0; i <= 48; i++) { const u = (i / 48) * 0.95; if (meia(u, B) * 0.84 > Math.abs(y) + 0.05) xs.push(-L / 2 + u * L + L * 0.012); }
        if (xs.length > 1) partes.push(ret((xs[0]! + xs[xs.length - 1]!) / 2, y, xs[xs.length - 1]! - xs[0]!, 0.02, tom('#5b3a1e', -0.2), 0.65, FINO));
      }
      const gr = { contorno: 'leve' as const, semSombra: true, detalhe: 2 as const };
      partes.push(...faixa(fora.slice(0, 50), 0.1, 'madeira.media', 0.8, gr), ...faixa(fora.slice(50).concat(fora.slice(0, 2)), 0.1, 'madeira.media', 0.8, gr));
      for (let i = 1; i < 25; i += 2) for (const lado of [0, 1]) { const idx = lado ? fora.length - 2 - i * 2 : i * 2; partes.push(elipse(fora[idx]! * 0.985, fora[idx + 1]! * 0.985, 0.14, 0.14, tom('#6b4024', 0.1), 0.85, gr)); }
      partes.push(poli(rot(-L * 0.4, 0, L * 0.18, B * 0.58, 0), 'madeira.media', 1.1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(rot(-L * 0.4, 0, L * 0.18 - 0.2, B * 0.58 - 0.2, 0), 'madeira.clara', 1.15, { dir: 0, contorno: false, semSombra: true, detalhe: 2 }), elipse(-L * 0.46, 0, 0.5, 0.5, 'madeira.escura', 1.3, { contorno: 'leve', detalhe: 2 }));
      partes.push(poli(rot(L * 0.04, 0, 1.6, 1.2, 0), 'madeira.escura', 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), ...[-0.4, 0, 0.4].map(k => ret(L * 0.04 + k, 0, 0.06, 1.0, tom('#1e110a', 0.2), 0.95, FINO)));
      const pos = nm === 3 ? [-0.18, 0.1, 0.32] : [-0.1, 0.22];
      pos.forEach((f, i) => {
        const x = f * L, ver = B * 0.9 * (i === pos.length - 1 && nm === 3 ? 0.7 : 1);
        partes.push(ret(x + 0.12, 0.1, 0.9, ver, tom('#c8bca0', -0.45), 2.5, { contorno: false, sombraLeve: true, detalhe: 2 }), ret(x, 0, 0.8, ver * 0.96, 'tecido.linho', 2.6, { raio: 0.1, contorno: 'leve', detalhe: 1 }), ret(x - 0.15, -ver * 0.2, 0.3, ver * 0.4, tom('#e6dbc3', 0.35), 2.7, { raio: 0.1, ...FINO }), ret(x, 0, 0.1, ver, 'madeira.media', 2.8, { contorno: 'leve', detalhe: 2 }), elipse(x, 0, 0.42, 0.42, 'madeira.escura', 3, { contorno: 'leve', detalhe: 1 }), elipse(x - 0.05, -0.05, 0.2, 0.2, tom('#74431f', 0.3), 3.1, FINO));
        partes.push(...faixa([x, -ver / 2, x + (r() - 0.5) * 0.6, -meia(f + 0.5, B) * 0.9], 0.03, CORDA, 2.4, FINO));
      });
      partes.push(elipse(L * 0.38, 0, 0.5, 0.5, tom(CORDA, -0.1), 0.95, { contorno: 'leve', detalhe: 2 }), ret(L * 0.43, 0, 0.3, 0.3, 'ferro', 1.0, { contorno: 'leve', detalhe: 2 }));
      return piso([L, B], partes);
    } },
  { id: 'barcaca', nome: 'Barcaça', ...P, tags: ['barcaca', 'barco', 'porto', 'agua', 'carga'], pegada: [8, 2.6], altura: 1.2,
    gerar: p => {
      const r = mulberry32(p.seed), L = 8, B = 2.6, partes: Parte[] = [];
      const forma = (k: number): number[] => { const h = (B / 2) * k, l = (L / 2) * k; return [-l, -h * 0.92, l * 0.78, -h, l, -h * 0.5, l, h * 0.5, l * 0.78, h, -l, h * 0.92]; };
      partes.push(poli(forma(1), 'madeira.escura', 0.5, { contorno: 'leve', sombraLeve: true }), poli(forma(0.9), 'madeira.media', 0.6, { dir: 0, contorno: false, semSombra: true, detalhe: 1 }), poli([-3.2, -0.95, 2.6, -0.95, 2.6, 0.95, -3.2, 0.95], tom('#1e110a', -0.1), 0.7, { contorno: 'leve', detalhe: 2 }));
      for (let x = -3.0; x < 2.5;) { const w = 0.45 + r() * 0.3; caixote(partes, x + w / 2, (r() - 0.5) * 0.9, Math.min(w, 0.7), (r() - 0.5) * 0.3, 0.8 + r() * 0.05); x += w + 0.05; }
      partes.push(poli(rot(1.2, 0.3, 2.4, 1.3, 0.08), 'tecido.cinza', 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(rot(1.0, 0.2, 1.4, 0.7, 0.08), tom('#9a9ea6', 0.2), 1.45, FINO), ...faixa([0.1, -0.4, 2.3, 1.0], 0.04, '#d8cfae', 1.5, FINO), ...faixa([0.2, 0.8, 2.3, -0.2], 0.04, '#d8cfae', 1.5, FINO));
      partes.push(ret(-3.55, 0, 0.14, 0.2, 'madeira.escura', 1.1, { contorno: 'leve', detalhe: 2 }), elipse(3.6, 0, 0.3, 0.3, 'ferro', 1.0, { contorno: 'leve', detalhe: 2 }));
      return piso([L, B], partes);
    } },
  { id: 'guindaste-de-cais', nome: 'Guindaste de cais', ...P, tags: ['guindaste', 'cais', 'porto', 'carga', 'madeira'], pegada: [4.2, 1.6], altura: 4,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [];
      partes.push(poli(rot(-1.3, 0, 1.4, 1.4, 0), tom('#4a3220', -0.5), 0.5, { contorno: 'leve', sombraLeve: true }), poli(rot(-1.32, 0, 1.4, 1.4, 0), 'madeira.escura', 0.6, { dir: 0, contorno: 'leve', detalhe: 1 }));
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) partes.push(elipse(-1.32 + u * 0.56, v * 0.56, 0.16, 0.16, 'ferro', 0.7, { contorno: 'leve', semSombra: true, detalhe: 3 }));
      partes.push(elipse(-1.32, 0, 0.8, 0.8, 'madeira.media', 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(-1.32, 0, 0.5, 0.5, tom('#74431f', 0.25), 1.1, { contorno: false, semSombra: true, detalhe: 2 }));
      for (const s of [-1, 1]) partes.push(ret(0.45, s * 0.1, 3.3, 0.1, 'madeira.media', 1.6, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      for (let i = 0; i < 8; i++) partes.push(...faixa([-1.0 + i * 0.4, i % 2 ? 0.1 : -0.1, -0.8 + i * 0.4, i % 2 ? -0.1 : 0.1], 0.04, 'madeira.clara', 1.7, FINO));
      partes.push(ret(-1.95, 0, 0.45, 0.5, 'ferro', 1.5, { raio: 0.04, contorno: 'leve', detalhe: 2 }), ...faixa([2.0, 0, 2.0, 0.4 + r() * 0.08], 0.03, CORDA, 1.8, FINO), elipse(2.0, 0.5, 0.2, 0.2, 'ferro', 1.9, { contorno: 'leve', detalhe: 2 }), poli([2.0, 0.55, 2.1, 0.7, 2.0, 0.8, 1.9, 0.7], 'ferro', 1.95, { contorno: 'leve', detalhe: 3 }));
      return piso([4.2, 1.6], partes);
    } },
  { id: 'cais-segmento', nome: 'Segmento de cais', ...P, tags: ['cais', 'passarela', 'porto', 'madeira', 'agua'], pegada: [4, 2], altura: 0.3,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4, min: 1, max: 12, passo: 0.5 }, { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2, min: 1, max: 4, passo: 0.25 }],
    gerar: p => {
      const r = mulberry32(p.seed), L = num(p, 'comprimento', 4, 1, 12), W = num(p, 'largura', 2, 1, 4), partes: Parte[] = [], n = Math.max(2, Math.round(L / 0.22)), w = L / n;
      partes.push(ret(0.04, 0.06, L, W, tom('#4a3220', -0.55), 0.5, { contorno: false, sombraLeve: true }));
      for (let i = 0; i < n; i++) {
        const cor = ['madeira.clara', 'madeira.media', 'madeira.escura'][Math.floor(r() * 3)]!, x = -L / 2 + (i + 0.5) * w, folga = r() < 0.15 ? 0.02 : 0;
        partes.push(ret(x, 0, w - 0.012, W - folga, cor, 0.6, { dir: Math.PI / 2, contorno: 'leve', detalhe: 1 }), ret(x, -W / 2 + 0.1, 0.04, 0.04, 'ferro', 0.65, FINO), ret(x, W / 2 - 0.1, 0.04, 0.04, 'ferro', 0.65, FINO));
      }
      for (const s of [-1, 1]) partes.push(ret(0, s * (W / 2 - 0.05), L, 0.1, 'madeira.escura', 0.7, { contorno: 'leve', semSombra: true, detalhe: 2 }));
      const estacas = Math.max(2, Math.round(L / 2) + 1);
      for (let i = 0; i < estacas; i++) for (const s of [-1, 1]) { const x = -L / 2 + 0.12 + (i / (estacas - 1)) * (L - 0.24); partes.push(elipse(x, s * (W / 2 - 0.12), 0.24, 0.24, 'madeira.escura', 0.9, { contorno: 'leve', detalhe: 1 }), elipse(x - 0.02, s * (W / 2 - 0.14), 0.1, 0.1, tom('#b88a55', -0.1), 0.95, FINO)); }
      return piso([L, W], partes);
    } },
  { id: 'estaca', nome: 'Estaca de amarração', ...P, tags: ['estaca', 'cais', 'porto', 'madeira', 'corda'], pegada: [0.4, 0.4], altura: 1.2,
    gerar: p => {
      const r = mulberry32(p.seed);
      return piso([0.4, 0.4], [elipse(0.02, 0.03, 0.36, 0.36, '#2a1c10', 0.5, { contorno: 'leve', sombraLeve: true }), elipse(0, 0, 0.34, 0.34, 'madeira.escura', 0.6, { contorno: 'leve', detalhe: 1 }), elipse(0, 0, 0.26, 0.26, 'madeira.media', 0.7, { contorno: false, semSombra: true, detalhe: 2 }), elipse(-0.04, -0.04, 0.1, 0.1, tom('#b88a55', 0.1), 0.8, FINO), ...[0, 1, 2].map(i => galho(-0.12, -0.1 + i * 0.1 + r() * 0.01, 0.3 * (i - 1) + 0.3, 0.2, 0.02, tom(CORDA, -0.2), 0.9))]);
    } },
  { id: 'barraca-de-feira', nome: 'Barraca de feira', ...P, funcoes: ['porto', 'praca', 'mercado', 'jardim'], tags: ['barraca', 'feira', 'mercado', 'toldo', 'cidade'], pegada: [3, 2.4], altura: 2.2,
    campos: [{ id: 'paleta', rotulo: 'Cores do toldo (0 a 3)', tipo: 'numero', padrao: 0, min: 0, max: 3, passo: 1 }],
    gerar: p => {
      const PALETAS = [['#b8322e', '#f1e6cc', '#2f5f8a', '#f1e6cc'], ['#2f6a46', '#f1e6cc', '#c9972e', '#f1e6cc'], ['#6b3a86', '#f1e6cc', '#c9622e', '#f1e6cc'], ['#2f5f8a', '#e3b84a', '#b8322e', '#2f6a46']], cores = PALETAS[Math.round(num(p, 'paleta', 0, 0, 3))]!, partes: Parte[] = [];
      // Toldo de duas águas visto de cima: a cumeeira em y = −0,1, a água norte na luz e a sul na sombra, listras correndo da cumeeira
      // para as bordas, franja ondulada na frente; o balcão com a mercadoria aparece por baixo da franja.
      const n = 8, w = 2.9 / n, S: Partial<Parte> = { contorno: false, semSombra: true, suave: true };
      partes.push(ret(0, 1.02, 2.6, 0.3, 'madeira.media', 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
      for (let i = 0; i < 9; i++) { const x = -1.15 + i * 0.29; partes.push(i % 3 === 2 ? ret(x, 1.02, 0.2, 0.2, 'madeira.clara', 0.95, { contorno: 'leve', semSombra: true, detalhe: 3 }) : elipse(x, 1.02, 0.14, 0.14, ['#c8452e', '#e0a838', '#6f9a3a', '#8a3f6a'][i % 4]!, 0.95, { contorno: 'leve', semSombra: true, detalhe: 3 })); }
      partes.push(ret(0, -0.1, 3, 2.04, tom(cores[0]!, -0.45), 2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      for (let i = 0; i < n; i++) {
        const c = cores[i % 4]!, x0 = -1.45 + i * w, x1 = x0 + w;
        partes.push(poli([x0, -1.08, x1, -1.08, x1, -0.1, x0, -0.1], tom(c, 0.1), 2.05, { ...S, detalhe: 1 }));
        partes.push(poli([x0, -0.1, x1, -0.1, x1, 0.86, x0, 0.86], tom(c, -0.16), 2.05, { ...S, detalhe: 1 }));
        partes.push(elipse(x0 + w / 2, 0.86, w * 0.96, 0.24, tom(c, -0.24), 2.04, { ...S, detalhe: 2 }));
        partes.push(poli([x0 + w * 0.15, -1.0, x0 + w * 0.35, -1.0, x0 + w * 0.35, -0.2, x0 + w * 0.15, -0.2], tom(c, 0.28), 2.06, { ...S, detalhe: 3, alfa: 0.6 }));
      }
      partes.push(ret(0, -0.1, 3, 0.06, tom(cores[0]!, -0.5), 2.08, { ...S, detalhe: 2 }));
      for (const [x, y] of [[-1.42, -1.04], [1.42, -1.04], [-1.42, 0.82], [1.42, 0.82]] as const) partes.push(elipse(x, y, 0.09, 0.09, 'madeira.escura', 2.1, FINO));
      return piso([3, 2.4], partes);
    } },
  { id: 'caixote', nome: 'Caixote', ...P, tags: ['caixote', 'caixa', 'carga', 'madeira', 'porto'], pegada: [0.8, 0.8], altura: 0.7,
    gerar: p => { const r = mulberry32(p.seed), partes: Parte[] = []; caixote(partes, 0, 0, 0.74, (r() - 0.5) * 0.1, 0.5, r() < 0.5 ? 'madeira.media' : 'madeira.clara'); return piso([0.8, 0.8], partes); } },
  { id: 'pilha-de-caixotes', nome: 'Pilha de caixotes', ...P, tags: ['caixote', 'caixa', 'carga', 'pilha', 'porto'], pegada: [1.6, 1.3], altura: 1.5,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [];
      caixote(partes, -0.4, -0.2, 0.68, (r() - 0.5) * 0.12, 0.5); caixote(partes, 0.4, -0.25, 0.64, (r() - 0.5) * 0.12, 0.52, 'madeira.clara'); caixote(partes, 0.0, 0.38, 0.62, (r() - 0.5) * 0.12, 0.54);
      caixote(partes, -0.3, -0.1, 0.56, 0.35 + (r() - 0.5) * 0.2, 1.2, 'madeira.clara'); caixote(partes, 0.1, 0.35, 0.46, -0.3 + (r() - 0.5) * 0.2, 1.8);
      return piso([1.6, 1.3], partes);
    } },
  { id: 'barril', nome: 'Barril', ...P, tags: ['barril', 'carga', 'madeira', 'porto', 'taverna'], pegada: [0.7, 0.7], altura: 0.9,
    gerar: p => { const r = mulberry32(p.seed), partes: Parte[] = []; barril(partes, 0, 0, 0.66, 0.5, r() * Math.PI); return piso([0.7, 0.7], partes); } },
  { id: 'pilha-de-barris', nome: 'Pilha de barris', ...P, tags: ['barril', 'carga', 'pilha', 'porto', 'taverna'], pegada: [1.6, 1.4], altura: 1.6,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [];
      for (const [x, y] of [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]] as const) barril(partes, x + (r() - 0.5) * 0.05, y + (r() - 0.5) * 0.05, 0.64, 0.5, r() * Math.PI);
      barril(partes, 0, 0, 0.6, 1.4, r() * Math.PI);
      return piso([1.6, 1.4], partes);
    } },
  { id: 'sacos', nome: 'Sacos', ...P, tags: ['sacos', 'carga', 'tecido', 'porto', 'armazem'], pegada: [1.2, 0.9], altura: 0.5,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 4 + Math.floor(r() * 3), cores = ['tecido.linho', 'tecido.mostarda', 'tecido.salvia', 'tecido.linho'];
      for (let i = 0; i < n; i++) {
        const x = -0.36 + (i % 3) * 0.36 + (r() - 0.5) * 0.08, y = i < 3 ? -0.18 : 0.2, a = (r() - 0.5) * 0.5, z = 0.5 + i * 0.05, c = cores[Math.floor(r() * 4)]!;
        partes.push(poli(rot(x + 0.03, y + 0.04, 0.42, 0.3, a), '#2a1c10', z, { contorno: 'leve', sombraLeve: true }), elipse(x, y, 0.42, 0.3, c, z + 0.01, { contorno: 'leve', detalhe: 1 }), elipse(x - 0.08, y - 0.05, 0.18, 0.1, tom('#f6efdd', 0.1), z + 0.02, FINO), elipse(x + Math.cos(a) * 0.22, y + Math.sin(a) * 0.22, 0.09, 0.07, tom('#5b4636', 0.1), z + 0.02, { contorno: 'leve', semSombra: true, detalhe: 2 }), ...faixa([x - Math.cos(a) * 0.1, y - Math.sin(a) * 0.1, x + Math.cos(a) * 0.12, y + Math.sin(a) * 0.12], 0.015, tom('#6b5a3a', -0.1), z + 0.03, FINO));
      }
      return piso([1.2, 0.9], partes);
    } },
  { id: 'rede-de-pesca', nome: 'Rede de pesca', ...P, tags: ['rede', 'pesca', 'corda', 'porto', 'agua'], pegada: [1.6, 1.2], altura: 0.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], pts: number[] = [];
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, k = 0.85 + r() * 0.15; pts.push(Math.cos(a) * 0.76 * k, Math.sin(a) * 0.56 * k); }
      partes.push(poli(pts.map(v => v + 0.03), '#1e2a1e', 0.5, { contorno: false, sombraLeve: true }), poli(pts, '#4a5a3e', 0.6, { contorno: 'leve', detalhe: 1 }));
      for (let i = 0; i < 9; i++) { const a = r() * Math.PI, d = (r() - 0.5) * 0.7, len = 0.5 + r() * 0.45; partes.push(...faixa([Math.cos(a) * len - Math.sin(a) * d, Math.sin(a) * len + Math.cos(a) * d, -Math.cos(a) * len - Math.sin(a) * d, -Math.sin(a) * len + Math.cos(a) * d].map((v, k) => (k % 2 ? v * 0.7 : v * 0.9)), 0.02, '#8a9a6a', 0.7 + i * 0.005, FINO)); }
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + r() * 0.3; partes.push(elipse(Math.cos(a) * 0.68, Math.sin(a) * 0.48, 0.13, 0.13, i % 2 ? '#c89a50' : '#b8663a', 0.9, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
      return piso([1.6, 1.2], partes);
    } },
  { id: 'ancora', nome: 'Âncora', ...P, tags: ['ancora', 'ferro', 'porto', 'navio'], pegada: [0.9, 1.1], altura: 0.2,
    gerar: () => {
      const arco: number[] = []; for (let i = 0; i <= 12; i++) { const a = Math.PI * (0.1 + 0.8 * (i / 12)); arco.push(Math.cos(a) * 0.36, 0.26 + Math.sin(a) * 0.26); }
      return piso([0.9, 1.1], [ret(0.03, 0.04, 0.09, 0.9, '#17181c', 0.5, { contorno: false, sombraLeve: true }), ret(0, 0, 0.09, 0.9, 'ferro', 0.6, { raio: 0.03, contorno: 'leve', detalhe: 1 }), ret(0, -0.28, 0.76, 0.07, 'ferro', 0.62, { raio: 0.03, contorno: 'leve', detalhe: 1 }), elipse(0, -0.44, 0.22, 0.22, 'ferro', 0.64, { contorno: 'leve', detalhe: 1 }), elipse(0, -0.44, 0.1, 0.1, '#9a8a6a', 0.66, FINO), ...faixa(arco, 0.07, 'ferro', 0.6, { contorno: 'leve', semSombra: true, detalhe: 1 }), poli([-0.42, 0.42, -0.3, 0.46, -0.34, 0.54], 'ferro', 0.62, { contorno: 'leve', detalhe: 2 }), poli([0.42, 0.42, 0.3, 0.46, 0.34, 0.54], 'ferro', 0.62, { contorno: 'leve', detalhe: 2 }), ret(-0.12, -0.2, 0.03, 0.4, tom('#6a6d77', 0.2), 0.7, FINO)]);
    } },
  { id: 'rolo-de-corda', nome: 'Rolo de corda', ...P, tags: ['corda', 'rolo', 'porto', 'navio'], pegada: [0.8, 0.8], altura: 0.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [elipse(0.03, 0.04, 0.7, 0.7, '#2a1c10', 0.5, { contorno: false, sombraLeve: true })];
      for (let i = 0; i < 5; i++) { const d = 0.7 - i * 0.12; partes.push(elipse(0, 0, d, d, i % 2 ? '#a8895a' : '#c8aa72', 0.6 + i * 0.03, { contorno: 'leve', semSombra: true, detalhe: i < 2 ? 1 : 2 })); }
      partes.push(elipse(0, 0, 0.12, 0.12, '#2a1c10', 0.8, FINO));
      for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2, d = 0.22 + (i % 3) * 0.1; partes.push(...faixa([Math.cos(a) * d, Math.sin(a) * d, Math.cos(a + 0.35) * (d + 0.03), Math.sin(a + 0.35) * (d + 0.03)], 0.015, '#7a5f38', 0.78, FINO)); }
      partes.push(...faixa([0.3, 0.25, 0.36 + r() * 0.02, 0.33], 0.07, '#c8aa72', 0.76, { contorno: 'leve', semSombra: true, detalhe: 2 }));
      return piso([0.8, 0.8], partes);
    } },
  { id: 'lanterna-de-poste', nome: 'Lanterna de poste', ...P, categoria: 'lareira-e-luz', funcoes: ['porto', 'rua', 'jardim'], tags: ['lanterna', 'poste', 'luz', 'rua', 'porto'], pegada: [0.5, 0.5], altura: 2.6,
    gerar: () => piso([0.5, 0.5], [elipse(0.02, 0.03, 0.4, 0.4, '#17181c', 0.5, { contorno: false, sombraLeve: true }), elipse(0, 0, 0.36, 0.36, 'ferro', 0.6, { contorno: 'leve', detalhe: 1 }), elipse(0, 0, 0.22, 0.22, tom('#3b3d44', 0.2), 0.7, { contorno: false, semSombra: true, detalhe: 2 }), elipse(0, 0, 0.5, 0.5, '#f3d36a', 2.4, { contorno: false, semSombra: true, vidro: true, detalhe: 3 }), elipse(0, 0, 0.34, 0.34, '#3b3d44', 2.5, { contorno: 'leve', detalhe: 1 }), elipse(0, 0, 0.22, 0.22, '#fbe9a0', 2.6, { contorno: false, semSombra: true, vidro: true, detalhe: 2 }), elipse(0, 0, 0.1, 0.1, '#ffffff', 2.7, FINO), ...[0, 1, 2, 3].map(i => ret(Math.cos(i * Math.PI / 2) * 0.17, Math.sin(i * Math.PI / 2) * 0.17, 0.04, 0.04, 'ferro', 2.65, FINO))]) },
];
