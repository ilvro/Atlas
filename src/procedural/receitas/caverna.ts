import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';
import { galho } from './ermos.ts';
import { faixa, rot } from './porto.ts';

const G = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['caverna', 'masmorra', 'jardim'], kit: 'ermos' };
const FINO: Partial<Parte> = { contorno: false, semSombra: true, detalhe: 3 };
const OSSO = '#d9d2c0', OSSO_SOMBRA = '#8f8775', NANQUIM = '#2a2118', MANCHA = '#1c1410';

/** Um osso longo: haste com duas pontas arredondadas, de (x, y) para `ang`. */
function osso(partes: Parte[], x: number, y: number, ang: number, len: number, w: number, z: number): void {
  const c = Math.cos(ang), s = Math.sin(ang), ponta = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  const [sx, sy] = ponta(0.02, 0.03);
  partes.push(...faixa([sx, sy, ...ponta(len + 0.02, 0.03)], w, OSSO_SOMBRA, z, { contorno: false, sombraLeve: true, detalhe: 3 }), ...faixa([x, y, ...ponta(len, 0)], w, OSSO, z + 0.01, { contorno: 'leve', semSombra: true, detalhe: 2 }));
  for (const u of [0, len]) for (const v of [-0.5, 0.5]) { const [px, py] = ponta(u, v * w * 0.7); partes.push(elipse(px, py, w * 1.1, w * 1.1, OSSO, z + 0.02, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
}

/** Crânio de animal visto de cima, de (x, y) olhando para `ang`; `chifres` põe dois arcos. */
function cranio(partes: Parte[], x: number, y: number, ang: number, s: number, z: number, chifres: boolean): void {
  const c = Math.cos(ang), s2 = Math.sin(ang), p = (u: number, v: number): number[] => [x + u * c - v * s2, y + u * s2 + v * c];
  const forma = [p(-0.5 * s, -0.3 * s), p(-0.1 * s, -0.4 * s), p(0.3 * s, -0.22 * s), p(0.6 * s, -0.12 * s), p(0.62 * s, 0.12 * s), p(0.3 * s, 0.22 * s), p(-0.1 * s, 0.4 * s), p(-0.5 * s, 0.3 * s)].flat();
  if (chifres) for (const lado of [-1, 1]) { const arco: number[] = []; for (let i = 0; i <= 5; i++) { const t = i / 5; arco.push(...p(-0.3 * s - t * 0.15 * s, lado * (0.32 + t * 0.4) * s)); } partes.push(...faixa(arco, 0.05 * s + 0.02, OSSO_SOMBRA, z - 0.01, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
  partes.push(poli(forma.map((v, i) => v + (i % 2 ? 0.03 : 0.02)), NANQUIM, z, { contorno: false, sombraLeve: true }), poli(forma, OSSO, z + 0.01, { contorno: 'leve', detalhe: 1 }));
  for (const lado of [-1, 1]) partes.push(elipse(...(p(0.1 * s, lado * 0.15 * s) as [number, number]), 0.16 * s, 0.16 * s, NANQUIM, z + 0.03, FINO));
  partes.push(poli([...p(-0.2 * s, -0.05 * s), ...p(0.5 * s, -0.04 * s), ...p(0.5 * s, 0.04 * s), ...p(-0.2 * s, 0.05 * s)], OSSO_SOMBRA, z + 0.02, FINO));
}

/** O kit da caverna: ossos, peles, buracos e as feições da pedra. */
export const RECEITAS_CAVERNA: Receita[] = [
  { id: 'ossada', nome: 'Ossada', ...G, tags: ['ossos', 'ossada', 'caverna', 'masmorra', 'esqueleto'], pegada: [1.9, 0.9], altura: 0.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 9 + Math.floor(r() * 3), curva = (u: number): number => Math.sin(u * 3) * 0.08;
      partes.push(elipse(0.05, 0.04, 1.4, 0.7, MANCHA, 0.5, { contorno: false, sombraLeve: true }));
      for (let i = 0; i < 14; i++) { const u = i / 13; partes.push(elipse(-0.35 + u * 1.0, curva(u), 0.075, 0.06, OSSO, 0.7, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
      for (let i = 0; i < n; i++) {
        const u = 0.12 + (i / (n - 1)) * 0.55, x = -0.35 + u * 0.9, lado = i % 2 ? 1 : -1, len = (0.3 + 0.12 * Math.sin((i / (n - 1)) * Math.PI)) * (0.9 + r() * 0.2), arco: number[] = [];
        for (let k = 0; k <= 4; k++) { const t = k / 4; arco.push(x + t * 0.06, curva(u) + lado * (0.02 + len * Math.sin(t * 1.6) * 0.9)); }
        partes.push(...faixa(arco, 0.035, OSSO, 0.75 + i * 0.002, { contorno: 'leve', semSombra: true, detalhe: 2 }));
      }
      cranio(partes, 0.62, 0.08, 0.3 + (r() - 0.5) * 0.4, 0.46, 0.9, r() < 0.4);
      osso(partes, 0.15, -0.36, 2.4 + r() * 0.4, 0.4, 0.045, 0.8); osso(partes, -0.4, 0.34, -0.4 + r() * 0.5, 0.36, 0.045, 0.8);
      osso(partes, -0.62, -0.1 + r() * 0.1, 3.4, 0.3, 0.04, 0.8); osso(partes, -0.1 + r() * 0.2, 0.32, 0.1 + r() * 0.3, 0.3, 0.04, 0.82);
      if (r() < 0.7) osso(partes, 0.1 + r() * 0.3, 0.38, r() * 6, 0.22, 0.035, 0.84);
      return piso([1.9, 0.9], partes);
    } },
  { id: 'cranio-animal', nome: 'Crânio de animal', ...G, tags: ['cranio', 'ossos', 'animal', 'caverna', 'masmorra'], pegada: [0.4, 0.25], altura: 0.15,
    campos: [{ id: 'chifres', rotulo: 'Chifres (0 sem, 1 com)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), chifres = Math.round(num(p, 'chifres', 0, 0, 1)) === 1, partes: Parte[] = [];
      cranio(partes, -0.02 + (r() - 0.5) * 0.01, 0, 0, chifres ? 0.3 : 0.34, 0.6, chifres);
      return piso([0.4, 0.25], partes);
    } },
  { id: 'pilha-de-ossos', nome: 'Pilha de ossos', ...G, tags: ['ossos', 'pilha', 'caverna', 'masmorra', 'covil'], pegada: [1.5, 1.5], altura: 0.35,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], mancha: number[] = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, k = 0.85 + r() * 0.15; mancha.push(Math.cos(a) * 0.72 * k, Math.sin(a) * 0.7 * k); }
      partes.push(poli(mancha, MANCHA, 0.5, { contorno: false, sombraLeve: true }), poli(mancha.map(v => v * 0.85), tom(MANCHA, 0.12), 0.52, FINO));
      for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, d = r() * 0.3, len = 0.4 + r() * 0.35; osso(partes, Math.cos(a) * d - Math.cos(a + 1) * len / 2, Math.sin(a) * d - Math.sin(a + 1) * len / 2, a + 1, len, 0.05, 0.6 + i * 0.03); }
      for (let i = 0; i < 4; i++) { const a = r() * 6, x = Math.cos(a) * 0.3, y = Math.sin(a) * 0.3, arco: number[] = []; for (let k = 0; k <= 4; k++) { const t = k / 4; arco.push(x + Math.cos(a + 1.2) * t * 0.35, y + Math.sin(a + 1.2) * t * 0.35 + Math.sin(t * 2.6) * 0.14); } partes.push(...faixa(arco, 0.035, OSSO, 0.95 + i * 0.01, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
      cranio(partes, -0.18, 0.12, 2.4, 0.4, 1.2, false); cranio(partes, 0.22, -0.2, -0.6, 0.34, 1.3, r() < 0.5);
      return piso([1.5, 1.5], partes);
    } },
  { id: 'pilha-de-peles', nome: 'Pilha de peles', ...G, tags: ['peles', 'pelagem', 'couro', 'caverna', 'covil'], pegada: [2, 1.6], altura: 0.3,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 5 + Math.floor(r() * 3), CORES = ['#6b4a2e', '#d9c7a0', '#1f1a17', '#8a5a34', '#b89a6a', '#4a3524'];
      partes.push(elipse(0.04, 0.05, 1.9, 1.4, '#1c1410', 0.5, { contorno: false, sombraLeve: true }));
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * 0.7, y = (r() - 0.5) * 0.4, a = r() * Math.PI * 2, z = 0.6 + i * 0.1, cor = i === 2 ? '#a8845a' : CORES[i % CORES.length]!, listrada = i === 3, c = Math.cos(a), s = Math.sin(a);
        const l = (u: number, v: number): number[] => [x + u * c - v * s, y + u * s + v * c];
        const corpo = [l(-0.5, -0.1), l(-0.3, -0.34), l(0.1, -0.38), l(0.4, -0.26), l(0.55, -0.14), l(0.65, -0.06), l(0.7, 0.06), l(0.55, 0.14), l(0.4, 0.26), l(0.1, 0.38), l(-0.3, 0.34), l(-0.5, 0.1), l(-0.75, 0.05), l(-0.8, -0.04)].flat();
        for (const [u, v] of [[0.45, -0.38], [0.45, 0.38], [-0.3, -0.42], [-0.3, 0.42]] as const) corpo.push(...l(u, v * 1.05));
        const ord = [l(-0.5, -0.1), l(-0.3, -0.34), l(-0.28, -0.44), l(-0.1, -0.36), l(0.1, -0.38), l(0.42, -0.42), l(0.5, -0.24), l(0.55, -0.14), l(0.7, -0.06), l(0.7, 0.06), l(0.55, 0.14), l(0.5, 0.24), l(0.42, 0.42), l(0.1, 0.38), l(-0.1, 0.36), l(-0.28, 0.44), l(-0.3, 0.34), l(-0.5, 0.1), l(-0.8, 0.04), l(-0.8, -0.04)].flat();
        partes.push(poli(ord.map((v, k) => v + (k % 2 ? 0.04 : 0.03)), '#1c1410', z, { contorno: false, sombraLeve: true }), poli(ord, cor, z + 0.01, { contorno: 'leve', detalhe: 1 }));
        if (listrada) for (let k = -3; k <= 3; k++) partes.push(...faixa([...l(k * 0.1, -0.3), ...l(k * 0.1 + 0.03, 0.3)], 0.05, '#2a1f18', z + 0.03, FINO));
        for (let k = 0; k < 16; k++) { const u = (r() - 0.5) * 0.9, v = (r() - 0.5) * 0.55; partes.push(...faixa([...l(u, v), ...l(u + 0.06, v + 0.02)], 0.012, tom(cor, r() < 0.5 ? 0.18 : -0.2), z + 0.04, FINO)); }
      }
      return piso([2, 1.6], partes);
    } },
  { id: 'buraco', nome: 'Buraco', ...G, tags: ['buraco', 'fosso', 'abismo', 'caverna', 'masmorra'], pegada: [1.6, 1.6], altura: 0.05,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 1.6, min: 0.8, max: 3, passo: 0.1 }],
    gerar: p => {
      const r = mulberry32(p.seed), W = num(p, 'largura', 1.6, 0.8, 3), n = 16, partes: Parte[] = [], forma = (k: number, j: number): number[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [Math.cos(a) * (W / 2) * k * (1 + (i % 3 - 1) * j), Math.sin(a) * (W / 2) * k * (1 + ((i + 1) % 3 - 1) * j)]; }).flat();
      partes.push(poli(forma(1, 0.05).map(v => v), '#4a4540', 0.5, { contorno: 'leve', sombraLeve: true }));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + r() * 0.3, d = (W / 2) * (0.78 + r() * 0.08), t = 0.16 + r() * 0.1 * W; partes.push(poli(rot(Math.cos(a) * d, Math.sin(a) * d, t, t * 0.7, a + r()), tom('#7d838b', (r() - 0.5) * 0.5), 0.55 + i * 0.002, { contorno: 'leve', semSombra: true, detalhe: 2 })); }
      for (let k = 0; k < 5; k++) { const f = 0.84 - k * 0.14; partes.push(poli(forma(Math.max(0.1, f), 0.1), tom('#0e0c0b', k * 0.07), 0.7 + k * 0.02, { contorno: false, semSombra: true, detalhe: 3 })); }
      return piso([W, W], partes);
    } },
  { id: 'estalagmite', nome: 'Estalagmite', ...G, tags: ['estalagmite', 'caverna', 'pedra', 'rocha', 'masmorra'], pegada: [0.8, 0.8], altura: 0.8,
    campos: [{ id: 'tamanho', rotulo: 'Tamanho (m)', tipo: 'numero', padrao: 0.6, min: 0.4, max: 0.8, passo: 0.05 }],
    gerar: p => {
      const r = mulberry32(p.seed), t = num(p, 'tamanho', 0.6, 0.4, 0.8), partes: Parte[] = [elipse(0.03, 0.04, t * 1.05, t * 1.05, '#14110f', 0.5, { contorno: false, sombraLeve: true })];
      const cores = ['#5f6168', '#74767d', '#8b8d93', '#a6a8ad', '#c4c4c2'];
      for (let i = 0; i < 5; i++) { const d = t * (1 - i * 0.2); partes.push(elipse(-i * t * 0.03 + (r() - 0.5) * 0.01, -i * t * 0.03, d, d * 0.96, cores[i]!, 0.6 + i * 0.05, { contorno: i === 0 ? 'leve' : false, semSombra: i > 0, detalhe: i < 2 ? 1 : 2 })); }
      partes.push(elipse(-t * 0.14, -t * 0.14, t * 0.12, t * 0.1, '#e8e6e0', 1.0, FINO));
      return piso([0.8, 0.8], partes);
    } },
  { id: 'arvore-morta-caida', nome: 'Árvore morta caída', ...G, tags: ['arvore', 'tronco', 'galhos', 'caverna', 'morta'], pegada: [3.4, 1.6], altura: 0.5,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], CASCA = '#4a4540', CLARA = '#6b645c';
      partes.push(poli([-1.5, -0.1, -0.9, -0.2, 0, -0.18, 0.8, -0.14, 1.2, -0.08, 1.2, 0.1, 0.8, 0.14, 0, 0.18, -0.9, 0.24, -1.5, 0.12].map((v, i) => (i % 2 ? v + 0.05 : v + 0.04)), '#17120e', 0.5, { contorno: false, sombraLeve: true }));
      partes.push(poli([-1.4, -0.12, -0.9, -0.22, 0, -0.2, 0.8, -0.15, 1.1, -0.1, 1.1, 0.1, 0.8, 0.15, 0, 0.2, -0.9, 0.24, -1.4, 0.14], CASCA, 0.6, { contorno: 'leve', detalhe: 1 }), poli([-1.3, -0.1, -0.9, -0.18, 0, -0.16, 0.8, -0.12, 1.0, -0.05, 1.0, 0, 0.8, 0, 0, 0, -0.9, 0.04, -1.3, 0.02], CLARA, 0.65, { contorno: false, semSombra: true, detalhe: 2 }));
      for (let i = 0; i < 12; i++) partes.push(...faixa([-1.3 + i * 0.22, -0.1 + (r() - 0.5) * 0.1, -1.2 + i * 0.22 + 0.1, 0.12 + (r() - 0.5) * 0.1], 0.012, '#2a2622', 0.7, FINO));
      for (let i = 0; i < 6; i++) { const x = -0.8 + i * 0.35, lado = i % 2 ? 1 : -1, ang = lado * (0.6 + r() * 0.4) + (lado < 0 ? 0 : 0), len = 0.5 + r() * 0.4; partes.push(galho(x, lado * 0.08, ang, len, 0.07, '#3a352f', 0.8)); const sx = x + Math.cos(ang) * len * 0.6, sy = lado * 0.08 + Math.sin(ang) * len * 0.6; partes.push(galho(sx, sy, ang + lado * 0.5, len * 0.5, 0.04, '#3a352f', 0.82), galho(sx, sy, ang - lado * 0.4, len * 0.4, 0.035, '#3a352f', 0.83)); }
      for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6 - 0.5) * 2.2, len = 0.3 + r() * 0.35; partes.push(galho(-1.4, 0.02, a, len, 0.07, '#2e2a25', 0.85)); }
      partes.push(elipse(1.12, 0, 0.2, 0.22, '#8a8378', 0.9, { contorno: 'leve', detalhe: 2 }), elipse(1.12, 0, 0.1, 0.12, '#5a544c', 0.95, FINO));
      return piso([3.4, 1.6], partes);
    } },
];
