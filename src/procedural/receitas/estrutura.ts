import { elipse, ret, type Parte } from '../descricao.ts';
import { materialDe, tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { mat, num, piso, type Receita } from './comum.ts';
import { alvenaria } from './praca.ts';

/**
 * Estruturas com altura (Frente L, L11): escadaria, estrado, muralha e plataforma. Cada uma recebe o material do piso em
 * volta, para que degrau, estrado e piso sejam da mesma pedra, e põe a altura real em `Parte.z`: o relevo da luz (L5) e a
 * oclusão (L6) dão o volume sozinhos, sem a sombra pintada "do lado do sol" que cada receita antiga inventava. A escadaria
 * que desce usa `z` negativo (o mapa de altura aceita até −2 m): o poço escurece pela oclusão e pelo véu de profundidade.
 */
const ESTRUTURA = { categoria: 'exterior' as const, tipo: 'piso' as const, funcoes: ['ruina', 'salao', 'capela', 'porao', 'caverna', 'corredor', 'jardim'], kit: 'ruina' };
/** Altura de um degrau (m). */
const ESPELHO = 0.17;
/** Parte só de cor (veladura): não projeta sombra, não escreve altura (alfa < 0,5) e não ganha traço. */
const veu = (x: number, y: number, w: number, h: number, cor: string, z: number, alfa: number, desfoque?: number): Parte =>
  ret(x, y, w, h, cor, z, { contorno: false, semSombra: true, suave: true, alfa, ...(desfoque ? { desfoque } : {}) });

/**
 * Escadaria embutida (sobe ou desce de +y para −y). A pisada de cada degrau é uma fiada de blocos do material do piso, com
 * tom próprio, quina gasta e clara na frente e o espelho do degrau seguinte como uma faixa escura. Descendo, cada degrau
 * fica mais escuro (o poço engole a luz) e as laterais viram as paredes do poço, com o aro no nível do piso.
 */
export function escadaria(w: number, l: number, desce: boolean, material: string, muretas: boolean, seed: number): Parte[] {
  const r = mulberry32(seed), M = materialDe(material), n = Math.max(3, Math.round(l / 0.4)), passo = l / n, partes: Parte[] = [];
  const lat = muretas ? Math.min(0.42, Math.max(0.24, w * 0.1)) : 0, wd = w - lat * 2;
  // A subida (ou descida) total fica em 1,8 m: o mapa de altura satura em ±2 m e o degrau de cima ainda precisa se distinguir.
  const espelho = Math.min(ESPELHO, 1.8 / n);
  const yD = (i: number) => l / 2 - (i + 0.5) * passo, zD = (i: number) => (desce ? -1 : 1) * (i + 1) * espelho;
  // Fundo contínuo sob os degraus (sem fresta entre blocos).
  partes.push(ret(0, 0, wd, l, tom(M.escuro, -0.35), desce ? zD(n - 1) - 0.02 : 0.01, { contorno: false, semSombra: true, detalhe: 1 }));
  for (let i = 0; i < n; i++) {
    const y = yD(i), z = zD(i), nb = Math.max(1, Math.round(wd / (0.85 + r() * 0.5))), bw = wd / nb;
    for (let b = 0; b < nb; b++) {
      const x = -wd / 2 + (b + 0.5) * bw;
      partes.push(ret(x, y, bw - 0.025, passo - 0.02, material, z, { contorno: false, semSombra: desce, sombraLeve: true, detalhe: 1 }));
      partes.push(veu(x, y, bw - 0.03, passo - 0.03, r() < 0.5 ? '#000000' : '#ffffff', z + 0.001, 0.05 + r() * 0.1));
    }
    // Quina da frente (+y), clara e gasta; no meio da escada, o desgaste dos passos.
    partes.push(veu(0, y + passo / 2 - 0.03, wd - 0.04, 0.045, M.claro, z + 0.002, 0.45));
    partes.push(veu((r() - 0.5) * wd * 0.2, y, wd * 0.45, passo * 0.5, M.claro, z + 0.002, 0.08, 0.08));
    if (desce) {
      // O degrau de cima faz sombra na frente deste, e a profundidade apaga a luz a cada degrau.
      partes.push(veu(0, y + passo / 2 - passo * 0.18, wd, passo * 0.36, '#000000', z + 0.003, 0.4, 0.05));
      partes.push(veu(0, y, wd, passo, '#05040a', z + 0.004, 0.04 + (i / Math.max(1, n - 1)) * 0.32));
    } else if (i < n - 1) {
      // Subindo: o espelho do degrau seguinte (em pé, voltado para quem chega) fica no fundo desta pisada.
      partes.push(ret(0, y - passo / 2 + 0.035, wd, 0.07, tom(M.escuro, -0.2), z + 0.004, { contorno: false, semSombra: true, detalhe: 2 }));
    }
  }
  if (desce) {
    // O fim do poço: escuro fechado, e uma última sombra macia subindo pelos degraus de baixo.
    partes.push(ret(0, -l / 2 + passo * 0.25, wd, passo * 0.5, '#040308', zD(n - 1) + 0.005, { contorno: false, semSombra: true, detalhe: 1 }));
    partes.push(veu(0, -l / 2 + passo, wd, passo * 2, '#000000', zD(n - 1) + 0.006, 0.45, 0.25));
  }
  if (muretas) {
    for (const s of [-1, 1]) {
      const cx = s * (w / 2 - lat / 2);
      if (desce) {
        // Aro no nível do piso (blocos do material) e, para dentro, a parede do poço descendo para o escuro.
        const nbl = Math.max(2, Math.round(l / 0.8));
        for (let k = 0; k < nbl; k++) {
          const yy = l / 2 - (k + 0.5) * (l / nbl);
          partes.push(ret(cx + s * lat * 0.2, yy, lat * 0.6, l / nbl - 0.03, material, 0.08, { contorno: false, sombraLeve: true, detalhe: 1 }));
          partes.push(veu(cx + s * lat * 0.2, yy, lat * 0.6, l / nbl - 0.03, r() < 0.5 ? '#000000' : '#ffffff', 0.081, 0.06 + r() * 0.08));
        }
        for (let i = 0; i < n; i++) {
          const y = yD(i), t = i / Math.max(1, n - 1);
          partes.push(ret(cx - s * lat * 0.3, y, lat * 0.4, passo + 0.01, tom(M.escuro, -0.3 - t * 0.35), zD(i) * 0.5, { contorno: false, semSombra: true, detalhe: 1 }));
        }
        partes.push(veu(cx - s * lat * 0.48, 0, 0.03, l, M.claro, 0.09, 0.35));
      } else {
        // Guardas de pedra em lances que acompanham a subida, com capa clara.
        const lances = Math.max(2, Math.round(l / 1.2)), cl = l / lances;
        for (let k = 0; k < lances; k++) {
          const y = l / 2 - (k + 0.5) * cl, zz = zD(Math.min(n - 1, Math.floor(((k + 0.5) * n) / lances))) + 0.55;
          partes.push(ret(cx, y, lat, cl - 0.02, material, zz, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
          partes.push(veu(cx - s * 0.03, y, lat * 0.6, cl - 0.06, M.claro, zz + 0.001, 0.3));
        }
      }
    }
  }
  return partes;
}

/**
 * Estrado (tablado de relicário, altar, palco): `degraus` patamares recuados até o topo, todos do material dado. Cada
 * patamar tem a quina clara e, no pé do patamar de cima, um escuro de contato; o relevo e a oclusão fazem o resto.
 */
export function estrado(W: number, P: number, H: number, degraus: number, material: string, seed: number): Parte[] {
  const r = mulberry32(seed), M = materialDe(material), partes: Parte[] = [], tiers = degraus + 1, recuo = Math.min(0.5, Math.min(W, P) / (tiers * 4));
  for (let k = 0; k < tiers; k++) {
    const w = W - 2 * k * recuo, p = P - 2 * k * recuo, z = (H * (k + 1)) / tiers, topo = k === tiers - 1;
    // O patamar em lajes (tom por laje), para ler como pedra assentada e não como um bloco liso.
    const lado = topo ? 1.1 : recuo, nx = Math.max(1, Math.round(w / Math.max(lado, 0.9))), ny = Math.max(1, Math.round(p / Math.max(lado, 0.9)));
    partes.push(ret(0, 0, w, p, tom(M.escuro, -0.25), z - 0.005, { contorno: k === 0 ? 'leve' : false, sombraLeve: true, detalhe: 1 }));
    for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
      const x = -w / 2 + (a + 0.5) * (w / nx), y = -p / 2 + (b + 0.5) * (p / ny);
      if (!topo && Math.abs(x) < w / 2 - recuo * 1.2 && Math.abs(y) < p / 2 - recuo * 1.2) continue;      // o miolo fica sob o patamar de cima
      partes.push(ret(x, y, w / nx - 0.03, p / ny - 0.03, material, z, { contorno: false, semSombra: true, detalhe: 1 }));
      partes.push(veu(x, y, w / nx - 0.04, p / ny - 0.04, r() < 0.5 ? '#000000' : '#ffffff', z + 0.001, 0.05 + r() * 0.1));
    }
    // Quina clara em volta e escuro de contato no pé do patamar de cima.
    for (const [x, y, ww, hh] of [[0, -p / 2 + 0.025, w, 0.05], [0, p / 2 - 0.025, w, 0.05], [-w / 2 + 0.025, 0, 0.05, p], [w / 2 - 0.025, 0, 0.05, p]] as const) partes.push(veu(x, y, ww, hh, M.claro, z + 0.002, 0.4));
    if (!topo) partes.push(veu(0, 0, w - 2 * recuo + 0.2, p - 2 * recuo + 0.2, '#000000', z + 0.003, 0.4, 0.08));
  }
  return partes;
}

/**
 * Muralha de alvenaria em patamares (bastião, guarda de escadaria): blocos do material, o patamar mais alto no fundo (−y) e a
 * face em pé de cada um descendo para a frente (+y), escura. As alturas ficam até 1,9 m para o mapa de altura distinguir os
 * patamares (o mapa satura em 2 m).
 */
export function muralha(L: number, P: number, patamares: number, material: string, seed: number): Parte[] {
  const r = mulberry32(seed), M = materialDe(material), partes: Parte[] = [], n = Math.max(1, patamares);
  const sombra = Math.min(0.5, P * 0.08), face = Math.min(P * 0.35, 0.5 + n * 0.2), topoP = P - face - sombra, passo = topoP / n, recuo = Math.min(0.6, L * 0.05);
  // Sombra de contato no chão, à frente da face (dentro da pegada): a muralha pesa sobre o piso.
  partes.push(veu(0, P / 2 - sombra / 2, L, sombra, '#000000', 0.02, 0.45, sombra * 0.6));
  for (let k = 0; k < n; k++) {
    // Do patamar mais alto (fundo) ao mais baixo (frente); cada um em blocos grandes, com quina clara e junta funda.
    const w = L - (n - 1 - k) * recuo * 2, cor = tom(M.escuro, 0.12 - k * 0.06), y0 = -P / 2 + k * passo, z = 1.9 - k * 0.3;
    const fiadas = Math.max(1, Math.round(passo / 0.9)), alt = passo / fiadas;
    partes.push(ret(0, y0 + passo / 2, w, passo, tom(M.escuro, -0.45), z - 0.01, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    for (let j = 0; j < fiadas; j++) {
      const y = y0 + (j + 0.5) * alt;
      let x = -w / 2 - (j % 2 ? r() * 0.6 : 0);
      while (x < w / 2 - 0.05) {
        const x0 = Math.max(-w / 2, x), x1 = Math.min(w / 2, x + 1 + r() * 0.7), bw = x1 - x0, c = tom(cor, (r() - 0.5) * 0.22);
        if (bw > 0.15) {
          partes.push(ret((x0 + x1) / 2, y, bw - 0.06, alt - 0.06, material, z, { raio: 0.03, contorno: false, semSombra: true, detalhe: 1 }));
          partes.push(veu((x0 + x1) / 2, y, bw - 0.07, alt - 0.07, c, z + 0.001, 0.45));
          partes.push(veu((x0 + x1) / 2 - 0.02, y - alt / 2 + 0.06, bw - 0.12, 0.05, M.claro, z + 0.002, 0.42));
          partes.push(veu((x0 + x1) / 2 - bw / 2 + 0.06, y, 0.05, alt - 0.12, M.claro, z + 0.002, 0.25));
          partes.push(veu((x0 + x1) / 2 + 0.02, y + alt / 2 - 0.06, bw - 0.1, 0.06, '#000000', z + 0.002, 0.4));
        }
        x = x1;
      }
    }
    if (k > 0) partes.push(veu(0, y0 + 0.14, w, 0.26, '#000000', z + 0.011, 0.45, 0.07));
  }
  // A face em pé (rebatida como as faces de parede): fiadas escuras, mais escuras embaixo, quina clara no alto.
  const yf = -P / 2 + topoP;
  alvenaria(partes, r, 0, yf + face / 2, L, face, tom(M.escuro, 0.05), 0.9, 0.34);
  for (let k = 0; k < 5; k++) partes.push(veu(0, yf + face * (k + 0.5) / 5, L, face / 5 + 0.01, '#000000', 0.91, 0.08 + 0.08 * k));
  partes.push(veu(0, yf + 0.03, L, 0.05, M.claro, 0.92, 0.48));
  return partes;
}

/**
 * Plataforma de tábuas sobre vigas (andaime de obra, passarela de mina, palanque): tábuas de través do material, vigas de
 * borda, postes que passam do piso e, com `guarda`, o corrimão.
 */
export function plataforma(L: number, P: number, H: number, material: string, guarda: boolean, seed: number): Parte[] {
  const r = mulberry32(seed), M = materialDe(material), partes: Parte[] = [];
  for (const y of [-P / 2 + 0.1, P / 2 - 0.1]) partes.push(ret(0, y, L, 0.18, tom(M.escuro, -0.1), H - 0.04, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let x = -L / 2; x < L / 2 - 0.05;) {
    const w = 0.22 + r() * 0.08;
    if (r() > 0.05) {
      const xc = x + w / 2, dy = (r() - 0.5) * 0.08;
      partes.push(ret(xc, dy, w - 0.025, P - 0.02 + (r() - 0.5) * 0.1, material, H, { dir: Math.PI / 2, contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      partes.push(veu(xc, dy, w - 0.03, P - 0.05, r() < 0.5 ? '#000000' : '#ffffff', H + 0.001, 0.05 + r() * 0.12));
      for (const y of [-P / 2 + 0.1, P / 2 - 0.1]) partes.push(elipse(xc, y, 0.035, 0.035, '#2a2622', H + 0.002, { contorno: false, semSombra: true, detalhe: 3 }));
    }
    x += w;
  }
  const nPostes = Math.max(2, Math.round(L / 2) + 1);
  for (let k = 0; k < nPostes; k++) for (const sy of [-1, 1]) {
    const x = -L / 2 + 0.12 + (k / (nPostes - 1)) * (L - 0.24), y = sy * (P / 2 - 0.1);
    partes.push(ret(x, y, 0.2, 0.2, tom(M.base, -0.15), H + (guarda ? 0.9 : 0.15), { raio: 0.03, contorno: 'leve' }));
  }
  if (guarda) for (const sy of [-1, 1]) partes.push(ret(0, sy * (P / 2 - 0.1), L - 0.1, 0.09, tom(M.base, 0.05), H + 0.85, { raio: 0.03, contorno: 'leve', sombraLeve: true }));
  return partes;
}

const campoMaterial = (padrao: string, rotulo = 'Material (o do piso em volta)') => ({ id: 'material', rotulo, tipo: 'material' as const, padrao, uso: 'piso' as const });

export const RECEITAS_DE_ESTRUTURA: Receita[] = [
  { id: 'estrutura.escadaria', nome: 'Escadaria embutida', ...ESTRUTURA, tags: ['escada', 'escadaria', 'degraus', 'subida', 'descida', 'poco', 'estrutura', 'pedra'], pegada: [3, 4],
    campos: [
      { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 3, min: 1, max: 14, passo: 0.2 },
      { id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4, min: 1.2, max: 16, passo: 0.2 },
      { id: 'desce', rotulo: 'Sentido (0 sobe, 1 desce)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 },
      { id: 'muretas', rotulo: 'Laterais (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 },
      campoMaterial('laje.pedra'),
    ],
    gerar: p => { const w = num(p, 'largura', 3, 1, 14), l = num(p, 'comprimento', 4, 1.2, 16); return piso([w, l], escadaria(w, l, Math.round(num(p, 'desce', 0, 0, 1)) === 1, mat(p, 'material', 'laje.pedra'), Math.round(num(p, 'muretas', 1, 0, 1)) === 1, p.seed)); } },
  { id: 'estrutura.estrado', nome: 'Estrado de pedra', ...ESTRUTURA, tags: ['estrado', 'tablado', 'altar', 'palco', 'plataforma', 'relicario', 'estrutura', 'pedra'], pegada: [6, 6],
    campos: [
      { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 6, min: 1.5, max: 20, passo: 0.5 },
      { id: 'profundidade', rotulo: 'Profundidade (m)', tipo: 'numero', padrao: 6, min: 1.5, max: 20, passo: 0.5 },
      { id: 'altura', rotulo: 'Altura (m)', tipo: 'numero', padrao: 0.5, min: 0.15, max: 1.6, passo: 0.05 },
      { id: 'degraus', rotulo: 'Degraus em volta', tipo: 'numero', padrao: 2, min: 0, max: 4, passo: 1 },
      campoMaterial('laje.pedra'),
    ],
    gerar: p => { const W = num(p, 'largura', 6, 1.5, 20), P = num(p, 'profundidade', 6, 1.5, 20); return piso([W, P], estrado(W, P, num(p, 'altura', 0.5, 0.15, 1.6), Math.round(num(p, 'degraus', 2, 0, 4)), mat(p, 'material', 'laje.pedra'), p.seed)); } },
  { id: 'estrutura.muralha', nome: 'Muralha em patamares', ...ESTRUTURA, tags: ['muralha', 'bastiao', 'alvenaria', 'parede', 'patamares', 'estrutura', 'pedra', 'templo'], pegada: [6, 3],
    campos: [
      { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 6, min: 1.5, max: 24, passo: 0.5 },
      { id: 'profundidade', rotulo: 'Profundidade (m)', tipo: 'numero', padrao: 3, min: 1, max: 10, passo: 0.5 },
      { id: 'patamares', rotulo: 'Patamares', tipo: 'numero', padrao: 3, min: 1, max: 5, passo: 1 },
      { ...campoMaterial('parede.alvenaria', 'Material'), uso: 'papel' as const },
    ],
    gerar: p => { const L = num(p, 'largura', 6, 1.5, 24), P = num(p, 'profundidade', 3, 1, 10); return piso([L, P], muralha(L, P, Math.round(num(p, 'patamares', 3, 1, 5)), mat(p, 'material', 'parede.alvenaria'), p.seed)); } },
  { id: 'estrutura.plataforma', nome: 'Plataforma de tábuas', ...ESTRUTURA, tags: ['plataforma', 'andaime', 'passarela', 'palanque', 'tabuas', 'madeira', 'estrutura', 'mina'], pegada: [6, 2.4],
    campos: [
      { id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 6, min: 1.5, max: 24, passo: 0.5 },
      { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2.4, min: 1, max: 8, passo: 0.2 },
      { id: 'altura', rotulo: 'Altura (m)', tipo: 'numero', padrao: 0.8, min: 0.2, max: 1.8, passo: 0.1 },
      { id: 'guarda', rotulo: 'Corrimão (0 não, 1 sim)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 },
      campoMaterial('tabuas.rusticas', 'Tábuas'),
    ],
    gerar: p => { const L = num(p, 'comprimento', 6, 1.5, 24), P = num(p, 'largura', 2.4, 1, 8); return piso([L, P], plataforma(L, P, num(p, 'altura', 0.8, 0.2, 1.8), mat(p, 'material', 'tabuas.rusticas'), Math.round(num(p, 'guarda', 0, 0, 1)) === 1, p.seed)); } },
];
