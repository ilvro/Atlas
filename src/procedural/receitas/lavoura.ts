import { elipse, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { lente, LUZ_X, LUZ_Y } from '../organico.ts';
import { num, piso, type Receita } from './comum.ts';

// Lavoura e campo (Frente Q, Q7): flores do campo e plantações em fileiras, no traço dos carimbos de chão (nanquim por baixo, poucos
// tons chapados, luz a noroeste). As fileiras correm ao longo do comprimento (x); gire o objeto para seguir o terreno arado.

const CAMPO = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim', 'quintal'], kit: 'campo' };
const NANQUIM = '#14100c';
const O = { contorno: false as const, semSombra: true };
const luzDe = (a: number) => Math.cos(a) * LUZ_X + Math.sin(a) * LUZ_Y;

/** Flores do campo: rosetas de folhas baixas e, por cima, flores miúdas de cinco pétalas (brancas, amarelas, lilases e vermelhas). */
function flores(seed: number, R: number): Parte[] {
  const r = mulberry32(seed), nanquim: Parte[] = [], folhas: Parte[] = [], petalas: Parte[] = [];
  const cores = ['#f2efe2', '#f0d24a', '#b48ad0', '#d8483a', '#f2efe2', '#f0d24a'], verdes = ['#2e5226', '#38602c', '#426c32'];
  const n = Math.round(26 * R * R / 0.36 + 6);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(r()) * R, a0 = r() * Math.PI * 2, x = Math.cos(a0) * d, y = Math.sin(a0) * d, verde = verdes[Math.floor(r() * verdes.length)]!;
    for (let k = 0; k < 4; k++) {
      const a = r() * Math.PI * 2, l = 0.05 + r() * 0.04, w = l * 0.45;
      nanquim.push(lente(x, y, a, l + 0.012, w + 0.012, NANQUIM, 0.04, { ...O, alfa: 0.55 }));
      folhas.push(lente(x, y, a, l, w, luzDe(a) > 0.3 ? tom(verde, 0.1) : verde, 0.042, { ...O, suave: true, detalhe: 2 }));
    }
    const cor = cores[Math.floor(r() * cores.length)]!, flor = 1 + Math.floor(r() * 3);
    for (let f = 0; f < flor; f++) {
      const fx = x + (r() - 0.5) * 0.08, fy = y + (r() - 0.5) * 0.08, rp = 0.03 + r() * 0.016, giro = r() * Math.PI;
      nanquim.push(elipse(fx, fy, rp * 2.6, rp * 2.6, NANQUIM, 0.05, { ...O, alfa: 0.5 }));
      for (let p = 0; p < 5; p++) { const a = giro + (p / 5) * Math.PI * 2; petalas.push(elipse(fx + Math.cos(a) * rp * 0.7, fy + Math.sin(a) * rp * 0.7, rp, rp, luzDe(a) < -0.3 ? tom(cor, -0.18) : cor, 0.052, { ...O, detalhe: 3 })); }
      petalas.push(elipse(fx, fy, rp * 0.6, rp * 0.6, cor === '#f0d24a' ? '#a8641e' : '#e0b030', 0.054, { ...O, detalhe: 3 }));
    }
  }
  return [...nanquim, ...folhas, ...petalas];
}

/** Trigo maduro: fileiras de touceiras douradas, cada uma um feixe de espigas em lente apontando para o lado, com a palha escura entre elas. */
function trigo(seed: number, L: number, W: number): Parte[] {
  const r = mulberry32(seed), nanquim: Parte[] = [], palha: Parte[] = [], espigas: Parte[] = [], passoFileira = 0.26, tons = ['#b8923e', '#c8a24a', '#d6b25a', '#a88438'];
  for (let y = -W / 2 + passoFileira / 2; y < W / 2; y += passoFileira) {
    for (let x = -L / 2 + 0.06; x < L / 2 - 0.04; x += 0.1 + r() * 0.04) {
      const cx = x + (r() - 0.5) * 0.04, cy = y + (r() - 0.5) * 0.06, base = tons[Math.floor(r() * tons.length)]!, inclina = -0.5 + (r() - 0.5) * 0.5;
      nanquim.push(elipse(cx, cy, 0.17, 0.15, NANQUIM, 0.5, { ...O, alfa: 0.6, sombraLeve: true }));
      palha.push(elipse(cx, cy, 0.13, 0.11, tom(base, -0.35), 0.52, { ...O, suave: true, detalhe: 2 }));
      const ne = 4 + Math.floor(r() * 3);
      for (let k = 0; k < ne; k++) {
        const a = inclina + (r() - 0.5) * 1.6, l = 0.07 + r() * 0.03, px = cx + (r() - 0.5) * 0.06, py = cy + (r() - 0.5) * 0.05;
        espigas.push(lente(px, py, a, l, 0.026, luzDe(a) > 0.2 ? tom(base, 0.14) : luzDe(a) < -0.3 ? tom(base, -0.12) : base, 0.6 + r() * 0.02, { ...O, detalhe: 2 }));
      }
    }
  }
  return [...nanquim, ...palha, ...espigas];
}

/** Milho: pés a cada ~0,3 m em fileiras de 0,8 m, cada um uma estrela de folhas longas e arqueadas; alto, projeta sombra. */
function milho(seed: number, L: number, W: number): Parte[] {
  const r = mulberry32(seed), nanquim: Parte[] = [], folhas: Parte[] = [], topos: Parte[] = [], tons = ['#3c6a2a', '#467832', '#52843a', '#38602a'];
  for (let y = -W / 2 + 0.4; y < W / 2; y += 0.8) {
    for (let x = -L / 2 + 0.22; x < L / 2 - 0.15; x += 0.28 + r() * 0.06) {
      const cx = x + (r() - 0.5) * 0.06, cy = y + (r() - 0.5) * 0.08, base = tons[Math.floor(r() * tons.length)]!, nf = 7 + Math.floor(r() * 3), giro = r() * Math.PI * 2;
      for (let k = 0; k < nf; k++) {
        const a = giro + (k / nf) * Math.PI * 2 + (r() - 0.5) * 0.5, l = 0.32 + r() * 0.18, z = 1.2 + k * 0.05;
        nanquim.push(lente(cx, cy, a, l + 0.02, 0.085, NANQUIM, z, { ...O, alfa: 0.7, sombraLeve: true }));
        folhas.push(lente(cx, cy, a, l, 0.06, luzDe(a) > 0.3 ? tom(base, 0.14) : luzDe(a) < -0.3 ? tom(base, -0.16) : base, z + 0.01, { ...O, suave: true, detalhe: 1 }));
        folhas.push(lente(cx + Math.cos(a) * 0.02, cy + Math.sin(a) * 0.02, a, l * 0.8, 0.012, tom(base, 0.25), z + 0.015, { ...O, detalhe: 3 }));
      }
      topos.push(elipse(cx, cy, 0.05, 0.05, '#c8a85a', 2, { ...O, detalhe: 2 }));
    }
  }
  return [...nanquim, ...folhas, ...topos];
}

/** Arroz: mudas em grade de 0,25 m, cada uma um tufo de folhas finas verde-vivo, para pôr sobre o `agua.arrozal`. */
function arroz(seed: number, L: number, W: number): Parte[] {
  const r = mulberry32(seed), nanquim: Parte[] = [], folhas: Parte[] = [], tons = ['#5a9a3a', '#68a842', '#4e8c34'];
  for (let y = -W / 2 + 0.125; y < W / 2; y += 0.25) {
    for (let x = -L / 2 + 0.125; x < L / 2; x += 0.25) {
      const cx = x + (r() - 0.5) * 0.04, cy = y + (r() - 0.5) * 0.04, base = tons[Math.floor(r() * tons.length)]!, nf = 5 + Math.floor(r() * 3);
      for (let k = 0; k < nf; k++) {
        const a = r() * Math.PI * 2, l = 0.08 + r() * 0.06;
        nanquim.push(lente(cx, cy, a, l + 0.01, 0.026, NANQUIM, 0.2, { ...O, alfa: 0.45 }));
        folhas.push(lente(cx, cy, a, l, 0.014, luzDe(a) > 0.2 ? tom(base, 0.15) : base, 0.22, { ...O, detalhe: 2 }));
      }
    }
  }
  return [...nanquim, ...folhas];
}

const TAMANHO = (padrao: [number, number]) => [
  { id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero' as const, padrao: padrao[0], min: 1, max: 12, passo: 0.5 },
  { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero' as const, padrao: padrao[1], min: 0.5, max: 8, passo: 0.5 },
];

export const RECEITAS_DA_LAVOURA: Receita[] = [
  { id: 'flores-do-campo', nome: 'Flores do campo', ...CAMPO, kit: 'mata', tags: ['flores', 'flor', 'rasteira', 'campo', 'prado', 'jardim', 'natureza'], pegada: [1.2, 1.2], altura: 0.1,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.6, min: 0.3, max: 1.5, passo: 0.1 }],
    gerar: p => { const R = num(p, 'raio', 0.6, 0.3, 1.5); return piso([R * 2, R * 2], flores(p.seed, R)); } },
  { id: 'plantacao.trigo', nome: 'Plantação de trigo', ...CAMPO, tags: ['plantacao', 'trigo', 'lavoura', 'campo', 'fazenda', 'cereal'], pegada: [4, 3], altura: 0.9, campos: TAMANHO([4, 3]),
    gerar: p => { const L = num(p, 'comprimento', 4, 1, 12), W = num(p, 'largura', 3, 0.5, 8); return piso([L, W], trigo(p.seed, L, W)); } },
  { id: 'plantacao.milho', nome: 'Plantação de milho', ...CAMPO, tags: ['plantacao', 'milho', 'milharal', 'lavoura', 'campo', 'fazenda'], pegada: [4, 3.2], altura: 2, campos: TAMANHO([4, 3.2]),
    gerar: p => { const L = num(p, 'comprimento', 4, 1, 12), W = num(p, 'largura', 3.2, 0.5, 8); return piso([L, W], milho(p.seed, L, W)); } },
  { id: 'plantacao.arroz', nome: 'Mudas de arroz', ...CAMPO, tags: ['plantacao', 'arroz', 'arrozal', 'mudas', 'lavoura', 'campo', 'oriental'], pegada: [4, 3], altura: 0.3, campos: TAMANHO([4, 3]),
    gerar: p => { const L = num(p, 'comprimento', 4, 1, 12), W = num(p, 'largura', 3, 0.5, 8); return piso([L, W], arroz(p.seed, L, W)); } },
];
