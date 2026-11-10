import { elipse, poli, ret } from '../descricao.ts';
import { bolha, lente } from '../organico.ts';
import { mulberry32 } from '../ruido.ts';
import { mat, num, piso, type Receita } from './comum.ts';

const G = { generos: ['fantasia'], kit: 'fantasia' }, PEDRA = '#6e7078', PEDRA_ESC = '#3a3c42', PALHA = '#c9ae5a', PALHA_CL = '#e0c878', ACO = '#9aa0aa', VINHO = '#7a1f24', FOGO = '#ffc24a';
const V = { contorno: 'leve' as const, detalhe: 2 as const };                       // volumes
const D = { contorno: false as const, semSombra: true, detalhe: 3 as const };     // miúdos
const retang = (x: number, y: number, w: number, h: number, a: number): number[] => { const c = Math.cos(a), s = Math.sin(a); return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([u, v]) => [x + u! * c - v! * s, y + u! * s + v! * c]); };
/** Centro (y) do degrau `i` de `n`, contando de baixo (+y) para cima (−y). */
const yDegrau = (l: number, n: number, i: number): number => l / 2 - ((i + 0.5) * l) / n;
const lado = [-1, 1];

/** Mobiliário de castelo, estalagem e caserna: escadas, mesas, camas e assentos. */
export const RECEITAS_DE_CASTELO: Receita[] = [
  // Escadas: a subida vai de +y (embaixo) para −y (em cima); o z dos degraus cresce nesse sentido.
  { id: 'escada.madeira', nome: 'Escada de madeira', categoria: 'decoracao', tipo: 'piso', funcoes: ['corredor', 'porao', 'sala', 'taverna'], tags: ['escada', 'degraus', 'madeira', 'andar', 'subida'], pegada: [1.2, 2.6], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.2, min: 0.8, max: 2.4, passo: 0.1 }, { id: 'comprimento', rotulo: 'Comprimento', tipo: 'numero', padrao: 2.6, min: 1.6, max: 5, passo: 0.1 }],
    gerar: p => {
      const w = num(p, 'largura', 1.2, 0.8, 2.4), l = num(p, 'comprimento', 2.6, 1.6, 5), n = Math.max(4, Math.round(l / 0.28)), z = (i: number) => 0.15 + i * 0.17, zt = (k: number) => z(Math.floor(((k + 0.5) * n) / 3)), x = w / 2 - 0.04;
      return piso([w, l], [
        ret(0, 0, w, l, 'madeira.escura', 0.1),
        ...Array.from({ length: n }, (_, i) => ret(0, yDegrau(l, n, i), w - 0.14, (l / n) * 0.9, i % 2 ? 'madeira.clara' : 'madeira.media', z(i), V)),
        ...[0, 1, 2].flatMap(k => lado.map(s => ret(s * x, yDegrau(l, 3, k), 0.08, l / 3, 'madeira.escura', zt(k) + 0.02, V))),
        ...[0, 1, 2].map(k => ret(x, yDegrau(l, 3, k), 0.05, l / 3, 'madeira.clara', zt(k) + 0.9, V)),   // corrimão de um lado
        ...[[l / 2 - 0.06, z(0)], [0, zt(1)], [-l / 2 + 0.06, z(n - 1)]].map(([y, zz]) => ret(x, y!, 0.08, 0.08, 'madeira.escura', zz! + 0.9, { raio: 0.02, ...V })),
      ]);
    } },
  { id: 'escada.pedra', nome: 'Escada de pedra', categoria: 'decoracao', tipo: 'piso', funcoes: ['corredor', 'porao', 'sala', 'taverna'], tags: ['escada', 'degraus', 'pedra', 'castelo', 'subida'], pegada: [1.4, 2.8], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.4, min: 1, max: 4, passo: 0.1 }, { id: 'comprimento', rotulo: 'Comprimento', tipo: 'numero', padrao: 2.8, min: 1.6, max: 6, passo: 0.1 }],
    gerar: p => {
      const w = num(p, 'largura', 1.4, 1, 4), l = num(p, 'comprimento', 2.8, 1.6, 6), n = Math.max(4, Math.round(l / 0.3)), z = (i: number) => 0.1 + i * 0.16, wd = w - 0.42;
      return piso([w, l], [
        ret(0, 0, w, l, PEDRA_ESC, 0.05),
        ...Array.from({ length: n }, (_, i) => ret(0, yDegrau(l, n, i), wd, (l / n) * 0.92, i % 2 ? '#8e9098' : '#a0a2aa', z(i), { raio: 0.02, ...V })),
        ...Array.from({ length: n }, (_, i) => ret(0, yDegrau(l, n, i) + 0.02, wd * 0.6, (l / n) * 0.4, '#b4b6be', z(i) + 0.005, { alfa: 0.5, suave: true, ...D })),   // o desgaste do meio
        ...[0, 1, 2].flatMap(k => lado.map(s => ret(s * (w / 2 - 0.1), yDegrau(l, 3, k), 0.2, l / 3, PEDRA, z(Math.floor(((k + 0.5) * n) / 3)) + 0.35, { raio: 0.02, ...V }))),
      ]);
    } },
  { id: 'escada.caracol', nome: 'Escada em caracol', categoria: 'decoracao', tipo: 'piso', funcoes: ['corredor', 'porao', 'sala', 'taverna'], tags: ['escada', 'caracol', 'torre', 'degraus', 'espiral', 'subida'], pegada: [2.2, 2.2], ...G,
    campos: [{ id: 'diametro', rotulo: 'Diâmetro', tipo: 'numero', padrao: 2.2, min: 1.6, max: 3.6, passo: 0.1 }],
    gerar: p => {
      const d = num(p, 'diametro', 2.2, 1.6, 3.6), n = 12 + Math.round(((d - 1.6) / 2) * 4), da = (Math.PI * 2) / n, R = d / 2, r0 = 0.18, zt = 0.1 + (n - 1) * 0.12;
      return piso([d, d], [
        elipse(0, 0, d, d, PEDRA_ESC, 0.05),
        ...Array.from({ length: n }, (_, i) => { const a0 = Math.PI / 2 + i * da, a1 = a0 + da * 1.05, c = Math.cos, s = Math.sin; return poli([c(a0) * r0, s(a0) * r0, c(a0) * R, s(a0) * R, c(a1) * R, s(a1) * R, c(a1) * r0, s(a1) * r0], i % 2 ? '#8e9098' : '#a0a2aa', 0.1 + i * 0.12, V); }),
        elipse(0, 0, 0.4, 0.4, PEDRA, zt + 0.5, { contorno: 'leve' }),
        elipse(-0.04, -0.04, 0.2, 0.2, '#a2a4ac', zt + 0.52, D),
      ]);
    } },
  { id: 'escada.de-mao', nome: 'Escada de mão', categoria: 'decoracao', tipo: 'piso', funcoes: ['corredor', 'porao', 'sala', 'taverna'], tags: ['escada', 'mao', 'madeira', 'travessas', 'subida'], pegada: [0.5, 2.4], ...G,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento', tipo: 'numero', padrao: 2.4, min: 1.6, max: 4, passo: 0.1 }],
    gerar: p => {
      const l = num(p, 'comprimento', 2.4, 1.6, 4), n = Math.max(4, Math.round((l - 0.2) / 0.3));
      return piso([0.5, l], [
        ...lado.map(s => ret(s * 0.2, 0, 0.07, l, 'madeira.escura', 0.5, { raio: 0.015, ...V })),
        ...Array.from({ length: n }, (_, i) => ret(0, yDegrau(l - 0.2, n, i), 0.36, 0.045, 'madeira.media', 0.55 + i * 0.08, V)),
        ...lado.map(s => ret(s * 0.2, l / 2 - 0.03, 0.08, 0.05, 'ferro', 0.52, D)),
      ]);
    } },
  { id: 'alcapao', nome: 'Alçapão', categoria: 'decoracao', tipo: 'piso', funcoes: ['corredor', 'porao', 'sala', 'taverna', 'cozinha'], tags: ['alcapao', 'tampa', 'porao', 'passagem', 'argola'], pegada: [1.0, 1.0], ...G,
    gerar: () => piso([1, 1], [
      ret(0, 0, 1, 1, 'madeira.escura', 0.04, { raio: 0.02, sombraLeve: true }),
      ...[-0.36, -0.12, 0.12, 0.36].map((x, i) => ret(x, 0, 0.23, 0.9, i % 2 ? 'madeira.clara' : 'madeira.media', 0.05, V)),
      ...[-0.3, 0.3].map(y => ret(0, y, 0.92, 0.08, 'madeira.escura', 0.06, V)),
      ...[-0.3, 0.3].map(x => ret(x, -0.4, 0.14, 0.06, 'ferro', 0.07, D)),    // dobradiças
      elipse(0, 0.3, 0.17, 0.17, 'ferro', 0.07, V), elipse(0, 0.3, 0.1, 0.1, '#0e0a09', 0.075, D),
      ...[-0.38, 0.38].flatMap(x => [-0.3, 0.3].map(y => elipse(x, y, 0.03, 0.03, 'ferro', 0.07, D))),
    ]) },

  // Mesas
  { id: 'mesa.cavalete', nome: 'Mesa de cavalete', categoria: 'mesas', tipo: 'piso', funcoes: ['taverna', 'sala-de-jantar', 'cozinha', 'forja'], tags: ['mesa', 'cavalete', 'tabuas', 'rustica', 'medieval'], pegada: [2.2, 0.8], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2.2, min: 1.4, max: 4, passo: 0.1 }],
    gerar: p => {
      const w = num(p, 'largura', 2.2, 1.4, 4), r = mulberry32(p.seed), xc = w / 2 - 0.3;
      return piso([w, 0.8], [
        ...lado.map(s => ret(s * xc, 0, 0.12, 0.8, 'madeira.escura', 0.45, { raio: 0.02 })),     // os cavaletes aparecem nas pontas do tampo
        ret(0, 0, w, 0.7, 'madeira.escura', 0.74, { raio: 0.02 }),
        ...[-0.26, -0.09, 0.09, 0.26].map(y => ret(0, y, w - 0.02, 0.165, r() < 0.5 ? 'madeira.media' : 'madeira.clara', 0.76, V)),
        ...lado.map(s => ret(s * xc, 0, 0.05, 0.7, 'madeira.escura', 0.78, D)),                 // cunhas dos cavaletes
        ...lado.flatMap(s => [-0.2, 0.2].map(y => elipse(s * (w / 2 - 0.1), y, 0.03, 0.03, 'ferro', 0.77, D))),
      ]);
    } },
  { id: 'mesa.banquete', nome: 'Mesa de banquete posta', categoria: 'mesas', tipo: 'piso', funcoes: ['sala-de-jantar', 'taverna', 'sala'], tags: ['mesa', 'banquete', 'festa', 'posta', 'jantar', 'castelo'], pegada: [4.0, 1.1], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 4, min: 2.4, max: 7, passo: 0.1 }],
    gerar: p => {
      const w = num(p, 'largura', 4, 2.4, 7), n = Math.max(2, Math.round((w - 0.5) / 0.7)), xs = Array.from({ length: n }, (_, i) => -w / 2 + ((i + 0.5) * w) / n), cand = w > 5 ? [0.34, 0.2] : [0.34];
      return piso([w, 1.1], [
        ret(0, 0, w, 1.1, 'madeira.escura', 0.78, { raio: 0.03 }),
        ret(0, 0, w - 0.3, 0.34, VINHO, 0.8, V),
        ...lado.map(s => ret(0, s * 0.17, w - 0.3, 0.02, 'latao', 0.81, D)),
        ...xs.flatMap(x => lado.flatMap(s => [elipse(x, s * 0.4, 0.22, 0.22, 'porcelana', 0.82, V), elipse(x + 0.2, s * 0.3, 0.09, 0.09, ACO, 0.86, { contorno: 'leve', detalhe: 3 })])),
        elipse(-w * 0.12, 0, 0.42, 0.26, ACO, 0.84, V), elipse(-w * 0.12, 0, 0.3, 0.17, '#8a4a22', 0.9, V), elipse(-w * 0.12 - 0.05, -0.03, 0.12, 0.06, '#b9743c', 0.92, D),   // travessa com assado
        ...[[0, -0.06], [0.1, 0.05], [-0.1, 0.06]].map(([dx, dy]) => elipse(w * 0.08 + dx!, dy!, 0.14, 0.1, '#b9823c', 0.86, V)),   // pães
        elipse(w * 0.2, 0, 0.14, 0.14, '#8a5a30', 0.88, V), elipse(w * 0.2, 0, 0.07, 0.07, '#2a1a10', 0.92, D),                       // jarra
        ...cand.flatMap(f => lado.flatMap(s => [elipse(s * w * f, 0, 0.1, 0.1, 'latao', 0.9, V), elipse(s * w * f, 0, 0.05, 0.05, FOGO, 1.0, D)])),   // castiçais
      ]);
    } },
  { id: 'mesa.redonda-rustica', nome: 'Mesa redonda rústica', categoria: 'mesas', tipo: 'piso', funcoes: ['taverna', 'cozinha'], tags: ['mesa', 'redonda', 'rustica', 'taverna', 'cartas', 'dados'], pegada: [1.1, 1.1], ...G,
    campos: [{ id: 'diametro', rotulo: 'Diâmetro', tipo: 'numero', padrao: 1.1, min: 0.8, max: 2, passo: 0.1 }],
    gerar: p => {
      const d = num(p, 'diametro', 1.1, 0.8, 2), R = d / 2 - 0.04, k = d / 1.1;
      return piso([d, d], [
        elipse(0, 0, d, d, 'ferro', 0.76),    // o aro de ferro
        elipse(0, 0, d - 0.08, d - 0.08, 'madeira.media', 0.78, V),
        ...[-0.5, -0.25, 0, 0.25, 0.5].map(f => ret(f * R * 1.5, 0, 0.012, Math.sqrt(Math.max(0, R * R - (f * R * 1.5) ** 2)) * 2 - 0.04, 'madeira.escura', 0.8, D)),
        elipse(-0.22 * k, 0.12 * k, 0.12, 0.12, ACO, 0.85, V), elipse(-0.22 * k, 0.12 * k, 0.07, 0.07, '#2a1a10', 0.88, D),    // caneca
        elipse(0.14 * k, -0.18 * k, 0.1, 0.1, '#d8c9a4', 0.84, V), elipse(0.14 * k, -0.18 * k, 0.04, 0.04, FOGO, 0.95, D),       // vela
        ...[0, 1, 2].map(i => poli(retang(0.16 * k + i * 0.04, 0.16 * k + i * 0.015, 0.1, 0.15, -0.5 + i * 0.4), 'papel.folha', 0.81 + i * 0.005, V)),   // cartas
        ...[[-0.05, 0.1], [0.0, 0.2]].map(([dx, dy], i) => ret(dx! * k, dy! * k, 0.05, 0.05, 'porcelana', 0.83, { raio: 0.01, ...V, ...(i ? { dir: 0.4 } : {}) })),
      ]);
    } },
  { id: 'bancada.trabalho', nome: 'Bancada de trabalho', categoria: 'mesas', tipo: 'piso', funcoes: ['forja', 'porao'], tags: ['bancada', 'oficina', 'torno', 'ferramentas', 'carpinteiro'], pegada: [1.8, 0.7], ...G,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.8, min: 1.2, max: 3, passo: 0.1 }],
    gerar: p => {
      const w = num(p, 'largura', 1.8, 1.2, 3), r = mulberry32(p.seed), x0 = -w / 2;
      return piso([w, 0.7], [
        ret(0, 0, w, 0.7, 'madeira.escura', 0.9, { raio: 0.02 }),
        ret(0, 0, w - 0.06, 0.64, 'madeira.media', 0.92, V),
        ...[-0.2, 0, 0.2].map(y => ret(0, y, w - 0.08, 0.012, 'madeira.escura', 0.93, D)),
        ret(x0 + 0.22, -0.2, 0.22, 0.16, 'ferro', 1.0, V), ret(x0 + 0.22, -0.3, 0.26, 0.05, '#4a4d56', 1.04, V), ret(x0 + 0.1, -0.12, 0.03, 0.2, 'ferro', 1.02, D),   // torno: corpo, mordente e fuso
        ret(-w * 0.05, 0.14, 0.34, 0.03, 'madeira.clara', 0.96, D), ret(-w * 0.05 + 0.2, 0.14, 0.1, 0.06, 'ferro', 0.97, V),      // martelo
        poli([w * 0.12, -0.12, w * 0.12 + 0.36, -0.1, w * 0.12 + 0.36, -0.02, w * 0.12, -0.02], '#c8ccd4', 0.96, V), ret(w * 0.12 - 0.07, -0.07, 0.14, 0.05, 'madeira.escura', 0.97, V),   // serrote
        ret(w * 0.15, 0.2, 0.24, 0.025, ACO, 0.96, D), ret(w * 0.15 - 0.16, 0.2, 0.1, 0.04, 'madeira.escura', 0.97, V),         // formão
        ...Array.from({ length: 6 }, () => lente(x0 + 0.5 + r() * (w - 0.9), -0.28 + r() * 0.56, r() * 6.28, 0.07 + r() * 0.05, 0.02, r() < 0.5 ? '#d8b87a' : '#c49a56', 0.95, D)),   // aparas
      ]);
    } },

  // Camas
  { id: 'enxergao', nome: 'Enxergão de palha', categoria: 'camas', tipo: 'piso', funcoes: ['quarto', 'taverna', 'porao', 'hospital'], tags: ['cama', 'enxergao', 'palha', 'colchao', 'dormir', 'estopa'], pegada: [0.9, 1.9], ...G,
    campos: [{ id: 'cobertor', rotulo: 'Cobertor', tipo: 'material', padrao: 'tecido.linho', uso: 'objeto' }],
    gerar: p => {
      const r = mulberry32(p.seed), cb = mat(p, 'cobertor', 'tecido.linho');
      return piso([0.9, 1.9], [
        ret(0, 0, 0.84, 1.84, '#b59a6a', 0.3, { raio: 0.08 }),     // o saco de estopa
        ret(0, -0.62, 0.52, 0.34, '#d8c27a', 0.36, { raio: 0.1, ...V }),
        ...[-0.5, 0.5].map(y => ret(0, y, 0.8, 0.014, '#8a7348', 0.32, D)),   // costuras
        ret(0, 0.5, 0.74, 0.52, cb, 0.4, { raio: 0.04, ...V }),    // cobertor dobrado
        ret(0, 0.5, 0.74, 0.03, '#000000', 0.41, { alfa: 0.15, ...D }),
        ...Array.from({ length: 16 }, (_, i) => { const t = i / 16, a = t * Math.PI * 2, bx = Math.cos(a) * 0.36, by = Math.sin(a) * 0.85; return lente(bx, by, a + (r() - 0.5), 0.1 + r() * 0.08, 0.03, i % 2 ? PALHA_CL : PALHA, 0.34, D); }),   // palha escapando pelas bordas
        ...Array.from({ length: 6 }, () => ret((r() - 0.5) * 0.6, -0.9 + r() * 0.5, 0.2, 0.012, PALHA_CL, 0.37, { dir: r() * 3, ...D })),
      ]);
    } },
  { id: 'monte-de-palha', nome: 'Monte de palha', categoria: 'camas', tipo: 'piso', funcoes: ['porao', 'jardim', 'quarto'], tags: ['palha', 'monte', 'feno', 'cama', 'dormir', 'estabulo'], pegada: [1.6, 1.3], ...G,
    gerar: p => {
      const r = mulberry32(p.seed), cores = [PALHA_CL, '#b8993f', '#d4b865'];
      return piso([1.6, 1.3], [
        poli(bolha(0, 0, 0.7, 0.56, 22, 0.14, r, r() * 6), PALHA, 0.3, { contorno: 'leve' }),
        poli(bolha(-0.08, -0.06, 0.48, 0.36, 18, 0.18, r, r() * 6), PALHA_CL, 0.38, { suave: true, ...V }),
        ...Array.from({ length: 28 }, (_, i) => { const a = r() * 6.28, d = Math.sqrt(r()) * 0.85; return lente(Math.cos(a) * d * 0.7, Math.sin(a) * d * 0.56, r() * 6.28, 0.22 + r() * 0.16, 0.025, cores[i % 3]!, 0.4 + i * 0.002, D); }),
      ]);
    } },
  { id: 'saco-de-dormir', nome: 'Rolo de dormir', categoria: 'camas', tipo: 'piso', funcoes: ['quarto', 'jardim', 'porao'], tags: ['rolo', 'saco', 'dormir', 'manta', 'pele', 'acampamento', 'cama'], pegada: [0.7, 1.9], ...G,
    campos: [{ id: 'manta', rotulo: 'Manta', tipo: 'material', padrao: 'tecido.verde', uso: 'objeto' }],
    gerar: p => piso([0.7, 1.9], [
      ret(0, 0.05, 0.66, 1.8, mat(p, 'manta', 'tecido.verde'), 0.3, { raio: 0.12 }),
      poli([-0.3, -0.5, 0.3, -0.5, 0.3, -0.12, -0.3, -0.2], 'couro.marrom', 0.34, V),    // a pele dobrada para trás
      ret(0, 0.25, 0.012, 1.1, '#000000', 0.32, { alfa: 0.2, ...D }),
      ...[0.2, 0.62].map(y => ret(0, y, 0.68, 0.05, 'couro.marrom', 0.35, D)),
      elipse(0, -0.72, 0.46, 0.3, '#a8814e', 0.42, { contorno: 'leve' }),     // a trouxa que faz de travesseiro
      elipse(0, -0.82, 0.12, 0.08, '#8a6a3c', 0.46, V), ret(0, -0.72, 0.4, 0.015, 'couro.marrom', 0.45, D),
    ]) },
  { id: 'cama.dossel', nome: 'Cama com dossel', categoria: 'camas', tipo: 'piso', funcoes: ['quarto'], tags: ['cama', 'dossel', 'cortinas', 'nobre', 'castelo', 'dormir'], pegada: [1.8, 2.2], ...G,
    campos: [{ id: 'tecido', rotulo: 'Tecido', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }],
    gerar: p => {
      const t = mat(p, 'tecido', 'tecido.veludo-vinho');
      return piso([1.8, 2.2], [
        ret(0, 0, 1.8, 2.2, 'madeira.escura', 0.5, { raio: 0.03 }),
        ret(0, 0.03, 1.62, 2.04, 'tecido.linho', 0.56, { raio: 0.04, ...V }),
        ret(0, 0.4, 1.62, 1.3, t, 0.64, { raio: 0.04, ...V }), ret(0, -0.26, 1.62, 0.12, 'tecido.linho', 0.65, V),
        ...lado.map(s => ret(s * 0.4, -0.78, 0.7, 0.36, 'tecido.linho', 0.72, { raio: 0.1, ...V })),
        ...lado.flatMap(sx => lado.map(sy => ret(sx * 0.84, sy * 1.04, 0.12, 0.12, 'madeira.escura', 2.0, { raio: 0.02, ...V }))),      // as colunas
        ...lado.flatMap(sx => lado.map(sy => elipse(sx * 0.84, sy * 1.04, 0.08, 0.08, 'latao', 2.05, D))),
        // O dossel cobre só a cabeceira: faixas opacas e um véu que deixa ver os travesseiros.
        ret(0, -1.02, 1.8, 0.16, t, 2.1, V), ret(0, -0.18, 1.8, 0.1, 'latao', 2.1, V), ...lado.map(s => ret(s * 0.82, -0.6, 0.16, 0.92, t, 2.1, V)),
        ret(0, -0.6, 1.48, 0.76, t, 2.08, { alfa: 0.45, suave: true, ...D }),
        ...lado.map(s => ret(s * 0.8, -0.5, 0.16, 0.7, t, 1.95, { raio: 0.05, ...V })), ...lado.map(s => ret(s * 0.8, -0.2, 0.2, 0.04, 'latao', 1.97, D)),    // cortinas presas
        ...lado.map(s => ret(s * 0.8, 0.9, 0.14, 0.34, t, 1.9, { raio: 0.05, ...V })),
      ]);
    } },
  { id: 'beliche', nome: 'Beliche de caserna', categoria: 'camas', tipo: 'piso', funcoes: ['quarto', 'taverna', 'porao'], tags: ['beliche', 'cama', 'caserna', 'dormitorio', 'litera', 'dormir'], pegada: [1.0, 2.0], ...G,
    gerar: () => piso([1, 2], [
      ret(-0.07, 0, 0.86, 2.0, 'madeira.escura', 1.5, { raio: 0.03 }),     // o estrado de cima, visto inteiro
      ret(-0.07, 0.02, 0.76, 1.88, '#b8a77c', 1.58, { raio: 0.04, ...V }),
      ret(-0.07, 0.42, 0.76, 1.1, 'tecido.cinza', 1.62, { raio: 0.04, ...V }), ret(-0.07, -0.14, 0.76, 0.07, '#000000', 1.63, { alfa: 0.15, ...D }),
      ret(-0.07, -0.72, 0.5, 0.3, 'tecido.linho', 1.68, { raio: 0.08, ...V }),
      ret(-0.46, -0.45, 0.04, 1.0, 'madeira.media', 1.75, V),    // a grade de proteção
      ...lado.flatMap(sx => lado.map(sy => ret(-0.07 + sx * 0.4, sy * 0.95, 0.09, 0.09, 'madeira.escura', 1.9, { raio: 0.015, ...V }))),
      ...[0.385, 0.485].map(x => ret(x, 0.55, 0.025, 0.8, 'madeira.escura', 1.0, V)),    // a escadinha lateral
      ...[0.88, 0.7, 0.52, 0.34].map((y, i) => ret(0.435, y, 0.12, 0.03, 'madeira.media', 1.02 + i * 0.12, V)),
    ]) },

  // Assentos
  { id: 'trono', nome: 'Trono', categoria: 'assentos', tipo: 'piso', funcoes: ['sala', 'capela'], tags: ['trono', 'rei', 'assento', 'nobre', 'castelo', 'cadeira'], pegada: [1.1, 1.0], ...G,
    gerar: () => piso([1.1, 1.0], [
      ret(0, 0, 1.1, 1.0, PEDRA_ESC, 0.2, { raio: 0.02 }),     // o estrado
      ret(0, 0.04, 1.0, 0.88, PEDRA, 0.3, { raio: 0.02, ...V }),
      ret(0, 0.1, 0.62, 0.56, 'madeira.escura', 0.5, { raio: 0.04 }),
      ret(0, 0.12, 0.46, 0.42, 'tecido.veludo-vinho', 0.6, { raio: 0.05, ...V }),
      ...lado.map(s => ret(s * 0.3, 0.1, 0.12, 0.6, 'madeira.escura', 0.7, { raio: 0.03, ...V })),
      ...lado.map(s => elipse(s * 0.3, 0.38, 0.09, 0.09, 'latao', 0.78, V)),       // pomos dos braços
      ret(0, -0.28, 0.66, 0.14, 'madeira.escura', 1.6, { raio: 0.03 }),         // o espaldar alto, visto pelo topo
      ret(0, -0.28, 0.5, 0.06, 'tecido.veludo-vinho', 1.62, D),
      ...lado.map(s => elipse(s * 0.3, -0.28, 0.1, 0.1, 'latao', 1.75, V)), elipse(0, -0.28, 0.12, 0.12, 'latao', 1.85, V),    // remates dourados
    ]) },
  { id: 'banqueta', nome: 'Banqueta de três pés', categoria: 'assentos', tipo: 'piso', funcoes: ['taverna', 'cozinha', 'forja', 'porao'], tags: ['banqueta', 'tamborete', 'assento', 'madeira', 'tres pes'], pegada: [0.4, 0.4], ...G,
    gerar: () => piso([0.4, 0.4], [
      ...[Math.PI / 2, Math.PI * 1.1667, Math.PI * 1.8333].map(a => elipse(Math.cos(a) * 0.165, Math.sin(a) * 0.165, 0.09, 0.09, 'madeira.escura', 0.3, V)),
      elipse(0, 0, 0.36, 0.36, 'madeira.media', 0.45, { contorno: 'leve' }),
      elipse(0, 0, 0.28, 0.28, 'madeira.clara', 0.46, D), ret(0, 0.02, 0.26, 0.012, 'madeira.escura', 0.47, D), ret(0, -0.06, 0.22, 0.012, 'madeira.escura', 0.47, D),
    ]) },
  { id: 'cadeira.espaldar', nome: 'Cadeira de espaldar alto', categoria: 'assentos', tipo: 'piso', funcoes: ['sala-de-jantar', 'sala', 'taverna', 'capela'], tags: ['cadeira', 'espaldar', 'assento', 'couro', 'entalhada', 'medieval'], pegada: [0.6, 0.6], ...G,
    gerar: () => piso([0.6, 0.6], [
      ...lado.flatMap(sx => lado.map(sy => ret(sx * 0.24, sy * 0.22, 0.07, 0.07, 'madeira.escura', 0.3, V))),     // pés nos cantos
      ret(0, 0.04, 0.5, 0.46, 'madeira.escura', 0.45, { raio: 0.03 }),
      ret(0, 0.05, 0.4, 0.36, 'couro.marrom', 0.5, { raio: 0.03, ...V }),
      ...Array.from({ length: 9 }, (_, i) => elipse(i < 5 ? -0.18 + i * 0.09 : (i % 2 ? 0.2 : -0.2), i < 5 ? 0.21 : -0.05 + ((i - 5) >> 1) * 0.1, 0.025, 0.025, 'latao', 0.52, D)),   // tachas
      ret(0, -0.25, 0.52, 0.08, 'madeira.escura', 1.1, { raio: 0.03 }),         // o espaldar entalhado
      ret(0, -0.25, 0.4, 0.03, 'madeira.clara', 1.12, D),
      ...lado.map(s => elipse(s * 0.24, -0.25, 0.07, 0.07, 'madeira.escura', 1.2, V)),
    ]) },
];
