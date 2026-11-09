import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { materialDe, tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { bolha, sombraNoChao } from '../organico.ts';
import { num, piso, type Receita } from './comum.ts';
import { galho } from './ermos.ts';

const MATA = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim'], kit: 'mata' };
const RUINA = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['jardim', 'ruina'], kit: 'ruina' };
const PEDRA = '#8a8d8f', MUSGO = ['#4f7a3a', '#678f45'];

/** Uma folha fina curva (lâmina de capim, junco): `curva` entorta a ponta. */
function lamina(x: number, y: number, ang: number, len: number, w: number, mat: string, z: number, curva = 0): Parte {
  const c = Math.cos(ang), s = Math.cos(ang + Math.PI / 2), t = Math.sin(ang), u = Math.sin(ang + Math.PI / 2), pts: number[] = [];
  const local = [0, w / 2, len * 0.5, w * 0.35 + curva * 0.2, len, curva, len * 0.5, -w * 0.35 + curva * 0.2, 0, -w / 2];
  for (let i = 0; i < local.length; i += 2) pts.push(x + local[i]! * c + local[i + 1]! * s, y + local[i]! * t + local[i + 1]! * u);
  return poli(pts, mat, z, { contorno: false, sombraLeve: true, detalhe: 2 });
}

/** Uma pedra facetada de uso geral: sombra, corpo, faceta clara a noroeste. */
/** Um bloco de pedra quebrado: polígono de 5 a 7 lados com uma quina partida, face lateral escura (sudeste) e topo claro com uma lasca. */
function bloco(partes: Parte[], r: () => number, x: number, y: number, w: number, h: number, ang: number, cor: string, z: number, musgo: boolean): void {
  const n = 5 + Math.floor(r() * 3), c = Math.cos(ang), s = Math.sin(ang), topo: number[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5, k = 0.8 + r() * 0.25, u = Math.cos(a) * (w / 2) * k, v = Math.sin(a) * (h / 2) * k; topo.push(x + u * c - v * s, y + u * s + v * c); }
  const alto = Math.min(w, h) * 0.22;
  partes.push(poli(topo.map((v, i) => v + alto * (i % 2 ? 0.9 : 0.6)), tom(cor, -0.42), z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(topo, cor, z + 0.01, { contorno: 'leve', semSombra: true, detalhe: 1 }));
  partes.push(poli(topo.map((v, i) => (i % 2 ? y + (v - y) * 0.55 - h * 0.08 : x + (v - x) * 0.55 - w * 0.08)), tom(cor, 0.18), z + 0.02, { contorno: false, semSombra: true, suave: true, detalhe: 2 }));
  if (r() < 0.6) { const i0 = Math.floor(r() * n) * 2, i1 = (i0 + 2) % (n * 2); partes.push(poli([topo[i0]!, topo[i0 + 1]!, topo[i1]!, topo[i1 + 1]!, x + (topo[i0]! + topo[i1]! - 2 * x) * 0.3, y + (topo[i0 + 1]! + topo[i1 + 1]! - 2 * y) * 0.3], tom(cor, -0.18), z + 0.025, { contorno: false, semSombra: true, suave: true, detalhe: 3 })); }
  if (musgo) partes.push(poli(bolha(x - w * 0.1, y - h * 0.1, w * 0.22, h * 0.18, 8, 0.25, r), MUSGO[0]!, z + 0.03, { contorno: false, semSombra: true, suave: true, detalhe: 3 }));
}

function pedra(partes: Parte[], x: number, y: number, w: number, h: number, base: string, z: number, musgo = false): void {
  partes.push(elipse(x + w * 0.06, y + h * 0.08, w, h, tom(base, -0.45), z, { contorno: 'leve', sombraLeve: true }), elipse(x, y, w * 0.92, h * 0.9, base, z + 0.01, { contorno: false, semSombra: true, detalhe: 2 }), elipse(x - w * 0.15, y - h * 0.16, w * 0.45, h * 0.35, tom(base, 0.3), z + 0.02, { contorno: false, semSombra: true, detalhe: 3 }));
  if (musgo) partes.push(elipse(x + w * 0.1, y - h * 0.1, w * 0.4, h * 0.3, MUSGO[0]!, z + 0.03, { contorno: false, semSombra: true, detalhe: 3 }));
}

/** Anel de segmentos entre `r0` e `r1` (de `a0` a `a1`), em quadriláteros. */
function anel(partes: Parte[], r0: number, r1: number, mat: string, z: number, passos = 40, a0 = 0, a1 = Math.PI * 2): void {
  for (let i = 0; i < passos; i++) {
    const p = a0 + (a1 - a0) * (i / passos), q = a0 + (a1 - a0) * ((i + 1.15) / passos);
    partes.push(poli([Math.cos(p) * r0, Math.sin(p) * r0, Math.cos(p) * r1, Math.sin(p) * r1, Math.cos(q) * r1, Math.sin(q) * r1, Math.cos(q) * r0, Math.sin(q) * r0], mat, z, { contorno: false, semSombra: true, detalhe: 2 }));
  }
}

/** O kit da mata (beira de rio e sub-bosque) e da ruína. */
export const RECEITAS_MATA: Receita[] = [
  { id: 'tufo-de-grama', nome: 'Tufo de grama', ...MATA, tags: ['grama', 'planta', 'natureza', 'mata'], pegada: [0.6, 0.6], altura: 0.25,
    campos: [{ id: 'material', rotulo: 'Grama', tipo: 'material', padrao: 'grama', uso: 'terreno' }],
    gerar: p => {
      const matId = typeof p.params?.material === 'string' ? p.params.material : 'grama';
      const m = materialDe(matId);
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 12 + Math.floor(r() * 9), verdes = [m.escuro, m.base, m.claro, tom(m.claro, 0.25)];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.5, len = 0.24 + r() * 0.06; partes.push(lamina(Math.cos(a) * 0.03, Math.sin(a) * 0.03, a, len, 0.07, verdes[Math.floor(r() * 4)]!, 0.5 + r() * 0.3, (r() - 0.5) * 0.08)); }
      return piso([0.6, 0.6], partes);
    } },
  { id: 'junco', nome: 'Junco', ...MATA, tags: ['junco', 'planta', 'agua', 'margem', 'natureza'], pegada: [0.8, 0.8], altura: 0.9,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], n = 9 + Math.floor(r() * 5);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.4, len = 0.34 + r() * 0.05; partes.push(lamina(0, 0, a, len, 0.05, i % 2 ? '#8ab04a' : '#b5cc62', 0.5 + i * 0.02, (r() - 0.5) * 0.1)); }
      for (let i = 0; i < 2 + Math.floor(r() * 2); i++) { const a = r() * Math.PI * 2, d = 0.22 + r() * 0.1; partes.push(ret(Math.cos(a) * d, Math.sin(a) * d, 0.14, 0.06, '#5a3a22', 1, { raio: 0.02, contorno: 'leve', detalhe: 2 })); }
      return piso([0.8, 0.8], partes);
    } },
  { id: 'vitoria-regia', nome: 'Vitória-régia', ...MATA, tags: ['vitoria-regia', 'planta', 'agua', 'flor', 'natureza'], pegada: [1.4, 1.4], altura: 0.05,
    campos: [{ id: 'flor', rotulo: 'Flor (0 sem, 1 com)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], R = 0.66, corte = r() * Math.PI * 2, pts: number[] = [];
      for (let i = 0; i <= 40; i++) { const a = corte + 0.18 + (i / 40) * (Math.PI * 2 - 0.36); pts.push(Math.cos(a) * R, Math.sin(a) * R); }
      pts.push(0, 0);
      partes.push(poli(pts, '#245a30', 0.5, { contorno: 'leve', sombraLeve: true }), poli(pts.map(v => v * 0.93), '#3d8a43', 0.51, { contorno: false, semSombra: true, detalhe: 2 }));
      for (let i = 0; i < 10; i++) { const a = corte + 0.4 + (i / 10) * (Math.PI * 2 - 0.8); partes.push(lamina(0, 0, a, R * 0.85, 0.02, '#2a6a34', 0.52, 0)); }
      if (Math.round(num(p, 'flor', 0, 0, 1)) === 1) {
        const fx = Math.cos(corte + Math.PI) * 0.2, fy = Math.sin(corte + Math.PI) * 0.2;
        for (let i = 0; i < 9; i++) partes.push(lamina(fx, fy, (i / 9) * Math.PI * 2, 0.17, 0.09, i % 2 ? '#f0a8c0' : '#fbd4e0', 0.7 + (i % 2) * 0.02));
        partes.push(elipse(fx, fy, 0.08, 0.08, '#f3d36a', 0.8, { contorno: false, semSombra: true, detalhe: 2 }));
      }
      return piso([1.4, 1.4], partes);
    } },
  { id: 'raiz-exposta', nome: 'Raiz exposta', ...MATA, tags: ['raiz', 'madeira', 'natureza', 'mata'], pegada: [2.2, 1.6], altura: 0.3,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [elipse(0, 0, 1.6, 1.0, '#3a2a1c', 0.4, { contorno: false, semSombra: true, detalhe: 2 })];
      const raiz = (x: number, y: number, ang: number, len: number, w: number, nivel: number): void => {
        partes.push(galho(x, y, ang, len, w, nivel ? '#5b4636' : '#4a3a2c', 0.6 + nivel * 0.05));
        if (nivel >= 2) return;
        for (let i = 0; i < 2; i++) { const t = 0.45 + r() * 0.4; raiz(x + Math.cos(ang) * len * t, y + Math.sin(ang) * len * t, ang + (i ? 1 : -1) * (0.2 + r() * 0.25), len * (0.4 + r() * 0.15), w * 0.55, nivel + 1); }
      };
      const n = 4 + Math.floor(r() * 2);
      for (let i = 0; i < n; i++) raiz(-0.9, 0, -0.45 + (i / (n - 1)) * 0.9 + (r() - 0.5) * 0.1, 0.9 + r() * 0.15, 0.15, 0);
      partes.push(elipse(-0.9, 0, 0.4, 0.4, '#3a2c22', 0.9, { contorno: 'leve', detalhe: 2 }));
      return piso([2.2, 1.6], partes);
    } },

  { id: 'mureta-de-pedra', nome: 'Mureta de pedra', ...RUINA, tags: ['mureta', 'muro', 'pedra', 'ruina'], pegada: [3, 0.5], altura: 0.9,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 3, min: 1, max: 10, passo: 0.5 }, { id: 'falha', rotulo: 'Falhas (0 inteira, 1 quebrada)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), L = num(p, 'largura', 3, 1, 10), quebrada = Math.round(num(p, 'falha', 1, 0, 1)) === 1, partes: Parte[] = [];
      for (let fila = 0; fila < 2; fila++) {
        let x = -L / 2 + (fila ? 0.18 : 0);
        while (x < L / 2 - 0.1) {
          const w = Math.min(0.3 + r() * 0.35, L / 2 - x), y = (fila ? 0.12 : -0.12) + (r() - 0.5) * 0.03;
          if (!(quebrada && r() < 0.14)) { const cor = tom(PEDRA, (r() - 0.5) * 0.3); partes.push(ret(x + w / 2 + 0.01, y + 0.02, w - 0.02, 0.22, tom(cor, -0.5), 0.5, { raio: 0.04, contorno: 'leve', sombraLeve: true }), ret(x + w / 2, y, w - 0.04, 0.2, cor, 0.55, { raio: 0.05, contorno: false, semSombra: true, detalhe: 2 }), ret(x + w * 0.4, y - 0.05, w * 0.5, 0.06, tom(cor, 0.3), 0.58, { raio: 0.03, contorno: false, semSombra: true, detalhe: 3 })); if (r() < 0.2) partes.push(elipse(x + w / 2, y, w * 0.5, 0.1, MUSGO[r() < 0.5 ? 0 : 1]!, 0.6, { contorno: false, semSombra: true, detalhe: 3 })); }
          x += w;
        }
      }
      return piso([L, 0.5], partes);
    } },
  { id: 'coluna-arruinada', nome: 'Coluna arruinada', ...RUINA, tags: ['coluna', 'pedra', 'ruina', 'esfera'], pegada: [1, 1], altura: 2.2,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [];
      partes.push(ret(0.03, 0.04, 0.96, 0.96, tom(PEDRA, -0.5), 0.5, { raio: 0.04, contorno: 'leve', sombraLeve: true }), ret(0, 0, 0.94, 0.94, tom(PEDRA, -0.05), 0.55, { raio: 0.04, contorno: false, semSombra: true, detalhe: 2 }));
      partes.push(elipse(0.02, 0.03, 0.74, 0.74, tom(PEDRA, -0.5), 1, { sombraLeve: true, contorno: 'leve' }), elipse(0, 0, 0.7, 0.7, tom(PEDRA, 0.05), 1.1, { contorno: false, semSombra: true, detalhe: 1 }), elipse(0, 0, 0.5, 0.5, tom(PEDRA, 0.15), 1.2, { contorno: false, semSombra: true, detalhe: 2 }));
      partes.push(elipse(0, 0, 0.3, 0.3, tom(PEDRA, -0.25), 2, { contorno: 'leve', sombraLeve: true }), elipse(-0.06, -0.07, 0.26, 0.24, tom(PEDRA, 0.2), 2.1, { contorno: false, semSombra: true, detalhe: 2 }), elipse(-0.1, -0.11, 0.1, 0.08, '#e8eaea', 2.2, { contorno: false, semSombra: true, detalhe: 3 }));
      for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2; partes.push(elipse(Math.cos(a) * 0.34, Math.sin(a) * 0.34, 0.1, 0.07, MUSGO[i % 2]!, 1.3, { contorno: false, semSombra: true, detalhe: 3 })); }
      return piso([1, 1], partes);
    } },
  { id: 'coluna-caida', nome: 'Coluna caída', ...RUINA, tags: ['coluna', 'pedra', 'ruina', 'entulho'], pegada: [2.6, 0.8], altura: 0.7,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], tambores = 4;
      for (let i = 0; i < tambores; i++) {
        const w = 0.58, x = -0.95 + i * 0.58 + (r() - 0.5) * 0.03, y = (r() - 0.5) * 0.05, cor = tom(PEDRA, (r() - 0.5) * 0.12);
        partes.push(ret(x + 0.03, y + 0.05, w, 0.7, tom(cor, -0.5), 0.5, { raio: 0.05, contorno: 'leve', sombraLeve: true }), ret(x, y, w, 0.68, cor, 0.55, { raio: 0.05, contorno: false, semSombra: true, detalhe: 1 }), ret(x - 0.02, y - 0.2, w * 0.9, 0.2, tom(cor, 0.25), 0.6, { raio: 0.04, contorno: false, semSombra: true, detalhe: 2 }), ret(x, y + 0.24, w * 0.95, 0.16, tom(cor, -0.3), 0.6, { raio: 0.04, contorno: false, semSombra: true, detalhe: 2 }));
        for (let k = -1; k <= 1; k++) partes.push(ret(x, y + k * 0.14, w - 0.05, 0.015, tom(cor, -0.4), 0.65, { contorno: false, semSombra: true, detalhe: 3 }));
      }
      partes.push(poli([1.08, -0.3, 1.22, -0.1, 1.0, 0.05, 1.14, 0.2, 1.04, 0.32, 0.98, 0, 1.06, -0.25], tom(PEDRA, -0.3), 0.66, { contorno: 'leve', detalhe: 2 }));
      for (let i = 0; i < 3; i++) partes.push(elipse(-1 + r() * 1.8, (r() - 0.5) * 0.4, 0.14, 0.09, MUSGO[i % 2]!, 0.7, { contorno: false, semSombra: true, detalhe: 3 }));
      return piso([2.6, 0.8], partes);
    } },
  { id: 'circulo-runico', nome: 'Círculo rúnico', ...RUINA, tags: ['runas', 'circulo', 'entalhe', 'magia', 'ruina'], pegada: [4, 4], altura: 0.02,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 2, min: 1, max: 5, passo: 0.25 }, { id: 'raios', rotulo: 'Raios', tipo: 'numero', padrao: 6, min: 0, max: 12, passo: 1 }],
    gerar: p => {
      const r = mulberry32(p.seed), R = num(p, 'raio', 2, 1, 5), n = Math.round(num(p, 'raios', 6, 0, 12)), partes: Parte[] = [], fundo = '#23252a', luz = '#6e727a';
      const par = (r0: number, r1: number, z: number): void => { anel(partes, r0 * R, r1 * R, fundo, z, 56); anel(partes, (r0 + 0.012) * R, (r1 - 0.012) * R, luz, z + 0.01, 56); };
      par(0.97, 1, 0.5); par(0.8, 0.84, 0.5); par(0.66, 0.68, 0.5);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + 0.2; partes.push(galho(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2, a, R * 0.46, 0.035, fundo, 0.52)); }
      const runas = 14 + Math.round(R * 4);
      for (let i = 0; i < runas; i++) {
        const a = (i / runas) * Math.PI * 2, cx = Math.cos(a) * R * 0.9, cy = Math.sin(a) * R * 0.9;
        for (let k = 0; k < 2 + Math.floor(r() * 2); k++) partes.push(galho(cx + (r() - 0.5) * 0.12, cy + (r() - 0.5) * 0.12, a + (r() < 0.5 ? 0 : Math.PI / 2) + (r() - 0.5) * 0.7, 0.1 + r() * 0.08, 0.025, fundo, 0.55));
      }
      anel(partes, 0, R * 0.12, fundo, 0.5, 16); partes.push(elipse(0, 0, R * 0.16, R * 0.16, luz, 0.52, { contorno: false, semSombra: true, detalhe: 3 }));
      return piso([R * 2, R * 2], partes);
    } },
  { id: 'escombros', nome: 'Escombros', ...RUINA, tags: ['escombros', 'pedra', 'ruina', 'entulho'], pegada: [2, 1.6], altura: 0.4,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [], monte = bolha(0, 0, 0.82, 0.62, 16, 0.15, r);
      sombraNoChao(partes, monte, 0.05, '#0d0a08', 0.4); sombraNoChao(partes, monte.map(v => v * 0.85), 0.07, '#6b665c', 0.9, [0, 0]);
      for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()), t = 0.03 + r() * 0.04; partes.push(poli(bolha(Math.cos(a) * d * 0.85, Math.sin(a) * d * 0.62, t, t * 0.8, 5, 0.3, r), tom(PEDRA, (r() - 0.5) * 0.4), 0.1, { contorno: false, semSombra: true, suave: true, detalhe: 3 })); }
      // Blocos quebrados: do maior (no meio, alto) aos lascados da borda; topo claro, face lateral escura para o sudeste.
      const n = 18 + Math.floor(r() * 6);
      for (let i = 0; i < n; i++) {
        const t = i / n, w = 0.14 + (1 - t) * (0.24 + r() * 0.26), a = r() * Math.PI * 2, d = (0.25 + t * 0.7) * Math.sqrt(0.3 + r() * 0.7), x = Math.cos(a) * d * (0.95 - w / 2), y = Math.sin(a) * d * (0.7 - w / 2);
        bloco(partes, r, x, y, w, w * (0.55 + r() * 0.35), r() * Math.PI, tom(PEDRA, (r() - 0.5) * 0.3), 0.7 - t * 0.4, r() < 0.12);
      }
      return piso([2, 1.6], partes);
    } },
  { id: 'viga-partida', nome: 'Viga partida', ...RUINA, funcoes: ['jardim', 'ruina', 'estabulo'], tags: ['viga', 'madeira', 'ruina', 'entulho'], pegada: [2.4, 0.5], altura: 0.3,
    gerar: p => {
      const r = mulberry32(p.seed), partes: Parte[] = [ret(-0.57, 0.05, 1.6, 0.26, tom('#4a3220', -0.5), 0.5, { contorno: 'leve', sombraLeve: true }), ret(-0.6, 0, 1.6, 0.26, 'madeira.escura', 0.6, { dir: 0, contorno: 'leve', detalhe: 1 })];
      const pts: number[] = [0.2, -0.13]; for (let i = 0; i <= 5; i++) pts.push(0.2 + (i % 2 ? 0.08 : 0.28) + r() * 0.08, -0.13 + (i / 5) * 0.26); pts.push(0.2, 0.13);
      partes.push(poli(pts, 'madeira.clara', 0.62, { contorno: 'leve', detalhe: 2 }));
      partes.push(ret(-1.15, -0.13, 0.04, 0.05, 'ferro', 0.7, { contorno: false, semSombra: true, detalhe: 3 }), ret(-0.5, 0.12, 0.04, 0.05, 'ferro', 0.7, { contorno: false, semSombra: true, detalhe: 3 }));
      for (let i = 0; i < 4; i++) partes.push(poli([0.6 + r() * 0.2, (r() - 0.5) * 0.35, 0.7 + r() * 0.3, (r() - 0.5) * 0.4, 0.65 + r() * 0.3, (r() - 0.5) * 0.4], 'madeira.media', 0.66, { contorno: 'leve', detalhe: 3 }));
      return piso([2.4, 0.5], partes);
    } },
  { id: 'tabua-solta', nome: 'Tábua solta', ...RUINA, funcoes: ['jardim', 'ruina', 'estabulo'], tags: ['tabua', 'madeira', 'ruina', 'entulho'], pegada: [1.2, 0.3], altura: 0.1,
    gerar: p => {
      const r = mulberry32(p.seed), L = 0.95 + r() * 0.15;
      return piso([1.2, 0.3], [ret(0.02, 0.03, L, 0.18, tom('#4a3220', -0.5), 0.5, { contorno: 'leve', sombraLeve: true }), ret(0, 0, L, 0.18, r() < 0.5 ? 'madeira.media' : 'madeira.clara', 0.6, { dir: 0, contorno: 'leve', detalhe: 1 }), ret(-L / 2 + 0.08, 0, 0.035, 0.04, 'ferro', 0.7, { contorno: false, semSombra: true, detalhe: 3 }), poli([L / 2, -0.09, L / 2 + 0.1, -0.03, L / 2 + 0.05, 0.02, L / 2 + 0.12, 0.05, L / 2, 0.09], 'madeira.clara', 0.62, { contorno: 'leve', detalhe: 2 })]);
    } },
];
