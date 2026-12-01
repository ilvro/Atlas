import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';
import { galho } from './ermos.ts';
import { costela, cranio, osso } from './formas.ts';
import { faixa, rot } from './porto.ts';
import { bolha, sombraNoChao, tira, lente } from '../organico.ts';

const G = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['caverna', 'masmorra', 'jardim'], kit: 'ermos' };
const FINO: Partial<Parte> = { contorno: false, semSombra: true, detalhe: 3 };
const MANCHA = '#1c1410';
const TONS_DE_OSSO = ['#e4ddca', '#d8ccb0', '#cbbf9f', '#c2bba9', '#dcd3bd'];
const PINCEL: Partial<Parte> = { contorno: false, semSombra: true, suave: true };

/** O kit da caverna: ossos, peles, buracos e as feições da pedra. */
export const RECEITAS_CAVERNA: Receita[] = [
  { id: 'ossada', nome: 'Ossada', ...G, tags: ['ossos', 'ossada', 'caverna', 'masmorra', 'esqueleto'], pegada: [1.9, 0.9], altura: 0.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], cor = TONS_DE_OSSO[Math.floor(r() * TONS_DE_OSSO.length)]!, curva = (u: number): number => Math.sin(u * 3 + 0.5) * 0.07;
      sombraNoChao(partes, bolha(0.05, 0.02, 0.8, 0.32, 16, 0.18, r), 0.05, MANCHA, 0.5, [0, 0]);
      // Coluna: vértebras do quadril (−0,5) ao pescoço (0,45).
      for (let i = 0; i < 17; i++) { const u = i / 16, x = -0.5 + u * 0.95, t = 0.075 - Math.abs(u - 0.45) * 0.04; partes.push(poli(bolha(x, curva(u), t, t * 0.85, 7, 0.15, r), cor, 0.6 + u * 0.001, { contorno: 'leve', sombraLeve: true, detalhe: 2 })); }
      // Costelas: pares do peito, mais longas no meio.
      const n = 6 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) { const u = 0.38 + (i / (n - 1)) * 0.42, x = -0.5 + u * 0.95, len = 0.24 + 0.1 * Math.sin((i / (n - 1)) * Math.PI); for (const lado of [-1, 1]) if (r() > 0.08) costela(partes, x, curva(u) + lado * 0.03, lado * Math.PI / 2 + lado * -0.25, len * (0.9 + r() * 0.2), 0.035, -lado * 0.9, cor, 0.65 + i * 0.002); }
      // Bacia.
      for (const lado of [-1, 1]) partes.push(poli(bolha(-0.5, curva(0) + lado * 0.11, 0.1, 0.07, 9, 0.2, r, lado * 0.4), cor, 0.62, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
      cranio(partes, 0.66, curva(1.1) + 0.02, 0.15 + (r() - 0.5) * 0.4, 0.42, 0.7, r() < 0.35, cor);
      // Patas desmontadas.
      osso(partes, 0.22, -0.3, -0.5 + r() * 0.4, 0.34, 0.045, 0.66, cor, r); osso(partes, 0.1, 0.22, 0.4 + r() * 0.3, 0.32, 0.045, 0.66, cor, r);
      osso(partes, -0.62, -0.08, 2.9 + r() * 0.4, 0.3, 0.042, 0.66, cor, r); osso(partes, -0.6, 0.12, 3.4 + r() * 0.3, 0.27, 0.04, 0.66, cor, r);
      for (let i = 0; i < 4; i++) partes.push(poli(bolha(-0.75 + r() * 1.4, (r() - 0.5) * 0.6, 0.03, 0.025, 6, 0.2, r), tom(cor, -0.1), 0.6, { contorno: 'leve', semSombra: true, detalhe: 3 }));
      return piso([1.9, 0.9], partes);
    } },
  { id: 'cranio-animal', nome: 'Crânio de animal', ...G, tags: ['cranio', 'ossos', 'animal', 'caverna', 'masmorra'], pegada: [0.4, 0.25], altura: 0.15,
    campos: [{ id: 'chifres', rotulo: 'Chifres (0 sem, 1 com)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), chifres = Math.round(num(p, 'chifres', 0, 0, 1)) === 1, partes: Parte[] = [];
      cranio(partes, -0.03 + (r() - 0.5) * 0.01, 0, 0, chifres ? 0.32 : 0.34, 0.6, chifres, TONS_DE_OSSO[Math.floor(r() * 3)]!);
      return piso([0.4, 0.25], partes);
    } },
  { id: 'pilha-de-ossos', nome: 'Pilha de ossos', ...G, tags: ['ossos', 'pilha', 'caverna', 'masmorra', 'covil'], pegada: [1.5, 1.5], altura: 0.35,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], monte = bolha(0, 0, 0.62, 0.6, 16, 0.12, r);
      sombraNoChao(partes, monte);
      sombraNoChao(partes, monte.map(v => v * 0.8), 0.08, '#2e271d', 0.45, [0, 0]);
      // Do fundo para o topo: ossos de fora (baixos) aos do meio (altos), cruzados.
      const n = 26 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) {
        const t = i / n, d = 0.5 * (1 - t) * Math.sqrt(r()) + 0.02, a = r() * Math.PI * 2, len = 0.22 + r() * 0.3, ang = r() * Math.PI * 2, w = 0.035 + r() * 0.025, cor = TONS_DE_OSSO[Math.floor(r() * TONS_DE_OSSO.length)]!;
        const cx = Math.cos(a) * d, cy = Math.sin(a) * d, z = 0.3 + t * 0.5;
        if (r() < 0.25) costela(partes, cx - Math.cos(ang) * len * 0.4, cy - Math.sin(ang) * len * 0.4, ang, len * 1.1, w * 0.8, r() < 0.5 ? -1 : 1, tom(cor, -t * 0.05 - 0.05), z);
        else osso(partes, cx - Math.cos(ang) * len / 2, cy - Math.sin(ang) * len / 2, ang, len, w, z, tom(cor, (1 - t) * -0.12), r);
      }
      cranio(partes, -0.12, 0.1, 2.4 + r() * 0.5, 0.38, 0.85, false, TONS_DE_OSSO[0]!); cranio(partes, 0.2, -0.14, -0.6 + r() * 0.5, 0.33, 0.88, r() < 0.5, TONS_DE_OSSO[2]!);
      if (r() < 0.6) cranio(partes, 0.3, 0.28, 0.8 + r(), 0.28, 0.6, false, TONS_DE_OSSO[3]!);
      return piso([1.5, 1.5], partes);
    } },
  { id: 'pilha-de-peles', nome: 'Pilha de peles', ...G, tags: ['peles', 'pelagem', 'couro', 'caverna', 'covil'], pegada: [2, 1.6], altura: 0.3,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 4 + Math.floor(r() * 2), CORES = ['#5e4129', '#c9b48a', '#2a221d', '#7d5232', '#a88d62', '#8f8a82'];
      sombraNoChao(partes, bolha(0, 0, 0.92, 0.7, 14, 0.12, r));
      for (let i = 0; i < n; i++) {
        const x = (r() - 0.5) * 0.5, y = (r() - 0.5) * 0.3, a = (i / n) * Math.PI + (r() - 0.5) * 0.8, z = 0.3 + i * 0.06, cor = CORES[(i + Math.floor(r() * 2)) % CORES.length]!, c = Math.cos(a), s = Math.sin(a), k = 0.85 - i * 0.05;
        const l = (u: number, v: number): [number, number] => [x + (u * c - v * s) * k, y + (u * s + v * c) * k];
        // A pele aberta: corpo, quatro patas, rabo e o toco da cabeça; borda franjada de pelo.
        const molde: [number, number][] = [[-0.62, 0], [-0.5, -0.12], [-0.42, -0.3], [-0.5, -0.46], [-0.32, -0.4], [-0.1, -0.3], [0.2, -0.3], [0.38, -0.4], [0.5, -0.5], [0.52, -0.3], [0.56, -0.14], [0.72, -0.08], [0.78, 0], [0.72, 0.08], [0.56, 0.14], [0.52, 0.3], [0.5, 0.5], [0.38, 0.4], [0.2, 0.3], [-0.1, 0.3], [-0.32, 0.4], [-0.5, 0.46], [-0.42, 0.3], [-0.5, 0.12]];
        const borda: number[] = [];
        for (let m = 0; m < molde.length; m++) {
          const [u0, v0] = molde[m]!, [u1, v1] = molde[(m + 1) % molde.length]!;
          for (let q = 0; q < 3; q++) { const t = q / 3, u = u0 + (u1 - u0) * t, v = v0 + (v1 - v0) * t, f = 1 + (q % 2 ? 0.06 : -0.02) + (r() - 0.5) * 0.05; borda.push(...l(u * f, v * f)); }
        }
        partes.push(poli(borda, cor, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
        partes.push(poli(bolha(...l(0.05, 0), 0.4 * k, 0.16 * k, 12, 0.15, r, a), tom(cor, i === n - 1 ? 0.12 : 0.06), z + 0.005, { ...PINCEL, detalhe: 2 }));
        partes.push(tira([...l(-0.55, 0), ...l(-0.75, 0.04), ...l(-0.92, 0.1)], 0.07 * k, tom(cor, -0.15), z - 0.005, { contorno: 'leve', semSombra: true, detalhe: 2 }, 0.4));
        if (cor === '#c9b48a' || r() < 0.2) for (let q = -3; q <= 3; q++) partes.push(tira([...l(q * 0.1, -0.26), ...l(q * 0.1 + 0.03, 0), ...l(q * 0.1, 0.26)], 0.04 * k, tom(cor, -0.45), z + 0.008, { ...PINCEL, detalhe: 3 }, 0.3));
        for (let q = 0; q < 70; q++) { const u = (r() - 0.5) * 1.1, v = (r() - 0.5) * 0.6, dir = Math.atan2(v, u) * 0.3 + a + Math.PI * (u < 0 ? 1 : 0); partes.push(lente(...l(u, v), dir, 0.07 + r() * 0.05, 0.014, tom(cor, r() < 0.5 ? 0.2 : -0.22), z + 0.01, { ...PINCEL, detalhe: 3 })); }
        if (i < n - 1) partes.push(poli(borda.map((v, m) => v + (m % 2 ? 0.04 : 0.03)), MANCHA, z + 0.03, { ...PINCEL, alfa: 0.18, detalhe: 3 }));
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
  { id: 'arvore-morta-caida', nome: 'Árvore morta caída', ...G, tags: ['arvore', 'tronco', 'galhos', 'caverna', 'morta', 'caida'], pegada: [3.4, 1.6], altura: 0.5,
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
