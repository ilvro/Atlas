import { elipse, poli, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, parede, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { ID, O, S, anel, arco, bloco, disco, em, estofado, quadro, retQ, retR, type Quadro, type Tons } from './antiguidade.ts';
import { cilindro } from './colonial.ts';
import { ACO, CONCRETO, GRAFITE, cadeiraDeEscritorio, ligado, maquinaDeVenda, tonsDe } from './moderno-urbano.ts';

// Cyberpunk (Q23): a rua (Q23a) e os interiores (Q23b). Néon em tubo (o halo largo e macio, a luva colorida e o miolo quase branco), telas que brilham, chapa preta,
// cromo gasto e cabos demais. As regras do acervo: nanquim por baixo da silhueta, volume em degraus de tom para o noroeste, `z` das partes até
// 1,5 m e a `altura` real na receita. A emissão multiplica a cor da parte por até 3, então o que brilha usa tons escuros e saturados, e só o
// miolo do tubo é claro (estoura no branco tingido). Os letreiros têm glifos inventados, sem marca nem palavra real.

/** Uma cor de néon: o miolo (claro), a luva do tubo, o halo (escuro, pois soma luz) e a cor da luz que o objeto traz. */
export interface Neon { nucleo: string; tubo: string; halo: string; luz: string }
export const NEONS: readonly Neon[] = [
  { nucleo: '#5ad0e0', tubo: '#16707e', halo: '#06343e', luz: '#7af0ff' },   // 0 ciano
  { nucleo: '#d85ac0', tubo: '#7e1a6c', halo: '#3a0634', luz: '#ff4fd8' },   // 1 magenta
  { nucleo: '#a0d84a', tubo: '#3e6e12', halo: '#1a3006', luz: '#b8ff5a' },   // 2 verde ácido
  { nucleo: '#e8a84a', tubo: '#80480e', halo: '#3a1e04', luz: '#ffc060' },   // 3 âmbar
  { nucleo: '#e85a4a', tubo: '#801a12', halo: '#3a0604', luz: '#ff5a4a' },   // 4 vermelho
  { nucleo: '#9a72e8', tubo: '#3e1e86', halo: '#1a0a40', luz: '#a87aff' },   // 5 violeta
];
const corDe = (params: Record<string, unknown>, padrao: number): Neon => NEONS[Math.round(num({ seed: 0, params }, 'cor', padrao, 0, NEONS.length - 1))]!;
/** A cor de acento de um néon (o contorno do letreiro, a segunda cor da tela): três passos adiante na roda. */
const acento = (n: Neon): Neon => NEONS[(NEONS.indexOf(n) + 3) % NEONS.length]!;

const CHAPA: Tons = { nanquim: '#050608', sombra: '#0e1014', base: '#16181e', meio: '#1e2128', luz: '#2a2e36', brilho: '#565c68' };
const CABOS = ['#0c0c0e', '#16161a', '#202024', '#2a2a2e', '#6a1a16', '#a8861a', '#1e3a6a', '#3a3a3e'];

/** Um tubo de néon ao longo de `pts`: aceso, o halo, a luva e o miolo (tudo `brilho`); apagado, o vidro cinza com um fio de reflexo. */
function tubo(partes: Parte[], pts: number[], w: number, n: Neon, z: number, aceso: boolean): void {
  if (aceso) {
    partes.push(tira(pts, w * 5, n.halo, z, { ...O, brilho: true, alfa: 0.5, desfoque: w * 2, detalhe: 1 }));
    partes.push(tira(pts, w * 1.8, n.tubo, z + 0.001, { ...O, brilho: true, alfa: 0.9, detalhe: 2 }));
    partes.push(tira(pts, w * 0.8, n.nucleo, z + 0.002, { ...O, brilho: true, detalhe: 2 }));
  } else {
    partes.push(tira(pts, w * 1.3, '#2a2c32', z, { contorno: 'leve', detalhe: 2 }));
    partes.push(tira(pts, w * 0.4, '#6a6e78', z + 0.001, { ...O, alfa: 0.6, detalhe: 3 }));
  }
}
/** O contorno fechado de um retângulo, para tubos e fios. */
const contornoQ = (u: number, v: number, w: number, h: number): number[] => { const p = retQ(ID, u, v, w, h); return [...p, p[0]!, p[1]!]; };

// ---------- Glifos ----------

/**
 * Os traços de que se montam as letras inventadas, numa célula de −0,5 a 0,5 (y para baixo): barras, hastes, ganchos e diagonais,
 * que juntas leem como escrita de letreiro (kana, hangul, cirílico de mentira) sem formar palavra.
 */
const TRACOS: readonly (readonly number[])[] = [
  [-0.38, -0.38, 0.38, -0.38], [-0.3, 0, 0.3, 0], [-0.38, 0.38, 0.38, 0.38], [0, -0.42, 0, 0.42], [-0.32, -0.3, -0.32, 0.36, 0.34, 0.36],
  [-0.34, -0.34, 0.34, -0.34, 0.1, 0.4], [0.32, -0.4, -0.06, 0.06, -0.36, 0.4], [-0.2, -0.4, -0.2, 0.1, 0.36, 0.38], [0.24, -0.42, 0.24, 0.4],
  [-0.36, -0.1, 0.36, -0.1, 0.36, 0.4], [-0.36, 0.12, -0.05, 0.4], [-0.3, -0.42, 0.3, 0.42], [0.34, -0.2, -0.34, -0.2, -0.34, 0.12, 0.34, 0.12],
];
/** Uma letra inventada: de dois a três traços distintos, sempre com um que desce (haste, diagonal ou gancho) para não ler como sinal de igual. */
function letra(r: () => number): number[][] {
  const descem = [3, 4, 5, 6, 7, 8, 11], usados = new Set<number>([descem[Math.floor(r() * descem.length)]!]);
  const n = 2 + (r() < 0.55 ? 1 : 0);
  while (usados.size < n) usados.add(Math.floor(r() * TRACOS.length));
  return [...usados].map(i => [...TRACOS[i]!]);
}
const curva = (f: (t: number) => [number, number], n = 12): number[] => { const p: number[] = []; for (let k = 0; k <= n; k++) p.push(...f(k / n)); return p; };
/** O ícone do letreiro, num quadrado de −0,5 a 0,5 (y para baixo): 1 seta para a porta, 2 tigela de lámen, 3 olho, 4 taça, 5 cruz de clínica. */
function icone(forma: number): number[][] {
  switch (forma) {
    case 1: return [[-0.42, -0.3, 0.08, -0.3, 0.24, -0.2, 0.28, 0, 0.28, 0.36], [0.06, 0.16, 0.28, 0.42, 0.5, 0.16]];
    case 2: return [[-0.44, -0.02, 0.44, -0.02, 0.34, 0.2, 0.14, 0.34, -0.14, 0.34, -0.34, 0.2, -0.44, -0.02], [-0.02, -0.06, 0.4, -0.46], [0.1, -0.05, 0.48, -0.36], [-0.24, -0.1, -0.32, -0.22, -0.2, -0.32, -0.28, -0.46], [-0.06, -0.1, -0.14, -0.2, -0.04, -0.3]];
    case 3: return [curva(t => [-0.46 + t * 0.92, -0.3 * (1 - (2 * t - 1) ** 2)]), curva(t => [-0.46 + t * 0.92, 0.28 * (1 - (2 * t - 1) ** 2)]), anel(0, 0, 0.14, 0.14, 16)];
    case 4: return [[-0.36, -0.38, 0.36, -0.38, 0, 0.04, -0.36, -0.38], [0, 0.04, 0, 0.36], [-0.22, 0.4, 0.22, 0.4], [0.1, -0.3, 0.32, -0.5], anel(-0.1, -0.24, 0.06, 0.06, 10)];
    case 5: return [[-0.13, -0.44, 0.13, -0.44, 0.13, -0.13, 0.44, -0.13, 0.44, 0.13, 0.13, 0.13, 0.13, 0.44, -0.13, 0.44, -0.13, 0.13, -0.44, 0.13, -0.44, -0.13, -0.13, -0.13, -0.13, -0.44]];
    default: return [];
  }
}
const levar = (tr: readonly number[], cx: number, cy: number, sx: number, sy: number): number[] => tr.map((v, i) => (i % 2 ? cy + v * sy : cx + v * sx));

/**
 * A placa de um letreiro (W × H, centro em 0, y para baixo), vista de frente: o fundo de chapa preta com a moldura, o contorno de néon na cor de
 * acento, o ícone de `forma` à esquerda (0 = só letras) e as letras inventadas na cor principal. Aceso, às vezes um traço pisca apagado.
 */
function placa(r: () => number, W: number, H: number, n: Neon, forma: number, aceso: boolean, z: number): Parte[] {
  const partes: Parte[] = [], w = H * 0.045, a = acento(n);
  partes.push(poli(retR(ID, 0.012, 0.014, W + 0.05, H + 0.05, 0.03), CHAPA.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(ID, 0, 0, W, H, 0.025), CHAPA.base, z + 0.002, { ...O, detalhe: 1 }), poli(retR(ID, -0.01, -0.01, W - 0.06, H - 0.06, 0.02), CHAPA.sombra, z + 0.003, { ...O, detalhe: 2 }));
  partes.push(tira([-W / 2 + 0.02, -H / 2 + 0.015, W / 2 - 0.02, -H / 2 + 0.015], 0.012, CHAPA.brilho, z + 0.004, { ...O, alfa: 0.6, detalhe: 3 }));
  if (r() < 0.6) tubo(partes, contornoQ(0, 0, W - 0.07, H - 0.07), w * 0.7, a, z + 0.01, aceso);
  const apagado = aceso && r() < 0.35 ? Math.floor(r() * 6) : -1;
  let k = 0;
  const tracar = (pts: number[], cor: Neon): void => { tubo(partes, pts, w, cor, z + 0.02 + k * 0.003, aceso && k !== apagado); k++; };
  let u0 = -W / 2 + 0.08;
  if (forma > 0) {
    const s = H * 0.72, cx = u0 + s / 2;
    for (const tr of icone(forma)) tracar(levar(tr, cx, 0, s, s), forma === 5 ? NEONS[2]! : n);
    u0 += s + 0.06;
  }
  const livre = W / 2 - 0.08 - u0, ch = H * 0.62, m = Math.max(2, Math.min(5, Math.floor(livre / (ch * 0.85)))), cw = livre / m;
  for (let i = 0; i < m; i++) for (const tr of letra(r)) tracar(levar(tr, u0 + cw * (i + 0.5), 0, Math.min(cw * 0.8, ch), ch), n);
  return partes;
}

/**
 * Leva partes desenhadas de frente (y para baixo) à face da parede (y para cima, a partir do chão), esticando a altura contra o achatamento da
 * face. A face de dentro corre da direita para a esquerda de quem olha do cômodo, então o desenho vai espelhado em x para as letras e o ícone
 * saírem na ordem certa.
 */
const K_FACE = 2.8;
const paraFace = (partes: Parte[], cy: number): Parte[] => partes.map(p => (p.forma === 'poli' ? { ...p, pts: p.pts!.map((v, i) => (i % 2 ? cy - v * K_FACE : -v)) } : { ...p, x: -p.x!, y: cy - p.y! * K_FACE, h: p.h! * K_FACE }));

/** Letreiro de parede: a placa presa à face por dois chumbadores, com o cabo que desce; de cima, a caixa fina com o tubo aceso na borda. */
function letreiroDeParede(seed: number, n: Neon, forma: number, aceso: boolean): { face: Parte[]; topo: Parte[] } {
  const r = mulberry32(seed), W = 1.3, H = 0.42, frente = placa(r, W, H, n, forma, aceso, 0.02);
  for (const s of [-1, 1]) frente.push(elipse(s * (W / 2 - 0.06), -H / 2 + 0.03, 0.03, 0.03, ACO.luz, 0.06, { ...O, detalhe: 3 }));
  frente.push(tira([W / 2 - 0.15, H / 2, W / 2 - 0.12, H / 2 + 0.12, W / 2 - 0.16, H / 2 + 0.3], 0.018, '#0c0c0e', 0.015, { contorno: 'leve', detalhe: 3 }));
  const topo: Parte[] = [poli(retQ(ID, 0, 0.07, W, 0.12), CHAPA.base, 2.2, { contorno: 'leve' })];
  tubo(topo, [-W / 2 + 0.04, 0.13, W / 2 - 0.04, 0.13], 0.02, n, 2.21, aceso);
  return { face: paraFace(frente, 1.2), topo };
}

/**
 * Letreiro de rua (de fachada): a placa presa à parede (−y) por dois braços, mostrada um pouco de frente como o orelhão e a máquina de venda,
 * com o clarão colorido no chão da calçada (+y) e na parede atrás.
 */
function letreiroDeRua(seed: number, n: Neon, forma: number, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.5, H = 0.5, yP = -0.12;
  sombraNoChao(partes, retQ(ID, 0, 0.05, W, 0.3), 0.01, '#0a0a0c', 0.25);
  if (aceso) {
    partes.push(elipse(0, 0.22, W + 0.1, 0.62, n.halo, 0.01, { ...O, brilho: true, alfa: 0.55, desfoque: 0.12, detalhe: 1 }));
    partes.push(elipse(0, -0.48, W + 0.05, 0.12, n.halo, 0.012, { ...O, brilho: true, alfa: 0.6, desfoque: 0.04, detalhe: 2 }));
  }
  for (const s of [-1, 1]) {
    partes.push(poli(retQ(ID, s * (W / 2 - 0.12), -0.5, 0.1, 0.05), GRAFITE.nanquim, 1.38, { contorno: 'leve', detalhe: 2 }));
    partes.push(tira([s * (W / 2 - 0.12), -0.5, s * (W / 2 - 0.12), yP - H / 2], 0.035, GRAFITE.base, 1.39, { contorno: 'leve', detalhe: 2 }));
  }
  partes.push(tira([W / 2 - 0.2, yP - H / 2, W / 2 - 0.26, -0.4, W / 2 - 0.4, -0.5], 0.02, '#0c0c0e', 1.395, { contorno: 'leve', detalhe: 3 }));
  partes.push(...placa(r, W, H, n, forma, aceso, 1.4).map(p => (p.forma === 'poli' ? { ...p, pts: p.pts!.map((v, i) => (i % 2 ? v + yP : v)) } : { ...p, y: p.y! + yP })));
  return partes;
}

// ---------- Holograma ----------

/**
 * Holograma: o projetor redondo no chão (frente, +y) com o anel de leds, e a figura de luz que sobe dele vista um pouco de frente (a cabeça
 * para −y), translúcida, com as linhas de varredura e uma faixa deslocada pelo chiado. `forma`: 0 dançarina, 1 losango girando, 2 carpa.
 */
function holograma(seed: number, n: Neon, forma: number, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], by = 0.42;
  sombraNoChao(partes, anel(0, by, 0.26, 0.2, 14), 0.01, '#0a0a0c', 0.4);
  if (aceso) partes.push(elipse(0, by - 0.05, 1.1, 0.6, n.halo, 0.01, { ...O, brilho: true, alfa: 0.6, desfoque: 0.1, detalhe: 1 }));
  disco(partes, 0, by, 0.22, GRAFITE, 0.1, 0.17);
  disco(partes, 0, by - 0.01, 0.13, ACO, 0.14, 0.1);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; partes.push(elipse(Math.cos(a) * 0.18, by + Math.sin(a) * 0.135, 0.03, 0.025, aceso ? n.nucleo : '#2a2c32', 0.15, { ...O, brilho: aceso, detalhe: 3 })); }
  partes.push(elipse(0, by - 0.01, 0.1, 0.075, aceso ? n.nucleo : '#101216', 0.16, { ...O, brilho: aceso, detalhe: 2 }));
  if (!aceso) { partes.push(lente(-0.05, by - 0.04, 0, 0.06, 0.02, '#c8d0d8', 0.17, { ...S, alfa: 0.6, detalhe: 3 })); return partes; }
  // O feixe: um leque macio do projetor ao alto da figura.
  partes.push(poli([-0.05, by, 0.05, by, 0.44, -0.62, -0.44, -0.62], n.halo, 1.2, { ...O, brilho: true, alfa: 0.4, desfoque: 0.08, detalhe: 1 }));
  const corpo: Partial<Parte> = { ...O, brilho: true, alfa: 0.55, detalhe: 2 }, risco: Partial<Parte> = { ...O, brilho: true, alfa: 0.7, detalhe: 3 }, z = 1.25;
  if (forma === 1) {
    const cy = -0.18, top = [0, cy - 0.4], dir = [0.27, cy], bai = [0, cy + 0.36], esq = [-0.27, cy], fr = [0.07, cy + 0.04];
    partes.push(poli([...top, ...dir, ...bai, ...esq], n.tubo, z, corpo));
    for (const p of [top, dir, bai, esq]) partes.push(tira([...p, ...fr], 0.014, n.nucleo, z + 0.01, risco));
    partes.push(tira([...top, ...dir, ...bai, ...esq, ...top], 0.02, n.nucleo, z + 0.012, risco));
    partes.push(tira(anel(0, cy, 0.42, 0.09, 24), 0.014, acento(n).nucleo, z + 0.014, { ...risco, alfa: 0.6 }));
    for (let k = 0; k < 8; k++) { const a = r() * 6.28; partes.push(elipse(Math.cos(a) * 0.42, cy + Math.sin(a) * 0.09, 0.03, 0.03, n.nucleo, z + 0.015, risco)); }
  } else if (forma === 2) {
    const espinha = [0.02, -0.54, 0.1, -0.4, 0.08, -0.22, -0.04, -0.06, -0.06, 0.08, 0.02, 0.18];
    partes.push(tira(espinha, 0.3, n.tubo, z, corpo, 0.35), tira(espinha, 0.2, n.nucleo, z + 0.0005, { ...corpo, alfa: 0.3 }, 0.35));
    for (const [x, y, R] of [[0.09, -0.36, 0.06], [0.0, -0.12, 0.05], [0.07, -0.2, 0.035]] as const) partes.push(elipse(x, y, R * 2, R * 1.6, acento(n).tubo, z + 0.0008, { ...corpo, alfa: 0.7 }));
    const cauda = [-0.04, 0.12, 0.24, 0.34, 0.1, 0.24, 0.0, 0.36, -0.1, 0.24, -0.3, 0.3];
    partes.push(poli(cauda, n.tubo, z + 0.001, { ...corpo, alfa: 0.75 }), tira([0.24, 0.34, 0.06, 0.16, -0.12, 0.18, -0.3, 0.3], 0.012, n.nucleo, z + 0.01, risco));
    for (const s of [-1, 1]) {
      const pts = [0.08 + s * 0.06, -0.32, 0.08 + s * 0.3, -0.26, 0.08 + s * 0.2, -0.16];
      partes.push(poli(pts, n.tubo, z + 0.002, { ...corpo, alfa: 0.75 }), tira(pts, 0.012, n.nucleo, z + 0.01, risco));
    }
    partes.push(tira(espinha, 0.05, n.nucleo, z + 0.01, risco, 0.3));
    for (let k = 0; k < 5; k++) partes.push(tira([-0.07 + k * 0.01, -0.38 + k * 0.08, 0.13 - k * 0.02, -0.36 + k * 0.08], 0.01, n.nucleo, z + 0.011, { ...risco, alfa: 0.4 }));
    partes.push(elipse(0.06, -0.5, 0.035, 0.035, acento(n).nucleo, z + 0.012, risco));
    for (const s of [-1, 1]) partes.push(tira([0.02 + s * 0.04, -0.56, 0.02 + s * 0.12, -0.62], 0.01, n.nucleo, z + 0.012, risco));
  } else {
    partes.push(elipse(0, -0.5, 0.14, 0.16, n.tubo, z, corpo));
    partes.push(poli([-0.09, -0.41, 0.09, -0.41, 0.07, -0.16, -0.06, -0.16], n.tubo, z, corpo));
    partes.push(tira([-0.08, -0.39, -0.2, -0.48, -0.15, -0.62], 0.045, n.tubo, z, corpo), tira([0.08, -0.39, 0.22, -0.32, 0.31, -0.44], 0.045, n.tubo, z, corpo));
    partes.push(poli([-0.06, -0.17, 0.06, -0.17, 0.21, 0.02, 0.02, 0.05, -0.19, 0.03], n.tubo, z, corpo));
    partes.push(tira([-0.05, 0.02, -0.08, 0.3], 0.04, n.tubo, z, corpo), tira([0.05, 0.02, 0.13, 0.15, 0.08, 0.3], 0.04, n.tubo, z, corpo));
    partes.push(lente(0.04, -0.56, -0.4, 0.22, 0.07, n.tubo, z, corpo));
    // As linhas de luz do contorno, mais vivas que o corpo.
    for (const pts of [[-0.15, -0.62, -0.2, -0.48, -0.08, -0.39, -0.06, -0.16, -0.19, 0.03], [0.31, -0.44, 0.22, -0.32, 0.08, -0.39, 0.07, -0.16, 0.21, 0.02], [-0.05, 0.03, -0.08, 0.3], [0.05, 0.03, 0.13, 0.15, 0.08, 0.3]]) partes.push(tira(pts, 0.014, n.nucleo, z + 0.01, risco));
    partes.push(tira(anel(0, -0.5, 0.07, 0.08, 14), 0.014, n.nucleo, z + 0.01, risco));
  }
  // A varredura e o chiado: linhas finas de lado a lado e uma faixa que escorrega para o lado.
  for (let y = -0.62; y < by - 0.1; y += 0.05) partes.push(tira([-0.34, y, 0.34, y], 0.01, n.nucleo, z + 0.02, { ...O, brilho: true, alfa: 0.12, detalhe: 3 }));
  const yg = -0.45 + r() * 0.5, dx = (r() < 0.5 ? -1 : 1) * (0.05 + r() * 0.05);
  partes.push(poli(retQ(ID, dx, yg, 0.42, 0.04), n.nucleo, z + 0.021, { ...O, brilho: true, alfa: 0.25, detalhe: 3 }), poli(retQ(ID, -dx * 1.5, yg + 0.05, 0.2, 0.015), acento(n).nucleo, z + 0.021, { ...O, brilho: true, alfa: 0.35, detalhe: 3 }));
  return partes;
}

// ---------- Barraca de lámen ----------

/**
 * Barraca de lámen: o toldo listrado cobrindo o fogão (de costas para −y), com a aba da frente, as cortininhas e as duas lanternas de papel
 * acesas nas pontas; por baixo, o balcão de madeira com as tigelas fumegando, os hashis e os molhos, e as banquetas na frente (+y). Um letreirinho
 * de néon sobre o toldo, o vapor que sobe do fundo e os cabos que vão para a parede.
 */
function barracaDeLamen(seed: number, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.5, y0 = -1.02, y1 = 0.3, cor = ['#a8281e', '#1e3a6a', '#2a2a30'][Math.floor(r() * 3)]!, t = tonsDe(cor), clara = '#d8d0c0';
  const madeira = tonsDe('#7a5434'), pano = r() < 0.5 ? '#1e2a4a' : '#5a1a1a', n = NEONS[[0, 1, 3][Math.floor(r() * 3)]!]!;
  sombraNoChao(partes, retQ(ID, 0, -0.25, W + 0.05, 1.7), 0.01, '#0a0a0c', 0.45);
  if (aceso) partes.push(elipse(0, 0.62, 2.3, 0.85, '#3a1e08', 0.01, { ...O, brilho: true, alfa: 0.55, desfoque: 0.12, detalhe: 1 }));
  // Os cabos que saem do fundo para a parede.
  for (let k = 0; k < 3; k++) { const x = -0.9 + k * 0.25 + r() * 0.1; partes.push(tira([x, y0 + 0.05, x + (r() - 0.5) * 0.2, -1.06, x + (r() - 0.5) * 0.3, -1.1], 0.025, CABOS[k]!, 1.505, { contorno: 'leve', detalhe: 3 })); }
  // As banquetas: o assento de vinil e o pé cromado.
  for (const x of [-0.75, 0, 0.75]) {
    const xx = x + (r() - 0.5) * 0.08, yy = 0.94 + (r() - 0.5) * 0.06;
    sombraNoChao(partes, anel(xx, yy, 0.15, 0.15, 12), 0.012, '#0a0a0c', 0.35);
    disco(partes, xx, yy, 0.11, ACO, 0.3);
    estofado(partes, quadro(xx, yy), 0, 0, 0, 0.27, 0.27, '#9a1e1a', 0.6, 0.13);
  }
  // O balcão: a tábua grossa, com a borda da frente gasta, e o que está em cima.
  bloco(partes, quadro(0, 0.5), W - 0.2, 0.38, madeira, 1.0, 0.04);
  for (let k = 0; k < 5; k++) partes.push(tira([-W / 2 + 0.2 + r() * (W - 0.6), 0.36 + r() * 0.28, -W / 2 + 0.4 + r() * (W - 0.6), 0.36 + r() * 0.28], 0.008, madeira.sombra, 1.006, { ...O, alfa: 0.5, detalhe: 3 }));
  for (const x of [-0.75, 0, 0.75]) {
    if (r() < 0.25) continue;
    const xx = x + (r() - 0.5) * 0.12, yy = 0.55;
    partes.push(elipse(xx, yy, 0.25, 0.25, '#1a0a08', 1.02, { contorno: 'leve', detalhe: 2 }), elipse(xx, yy, 0.22, 0.22, r() < 0.5 ? '#e8e2d4' : '#8a1e14', 1.022, { ...O, detalhe: 2 }));
    partes.push(elipse(xx, yy, 0.17, 0.17, '#a86a2a', 1.024, { ...O, detalhe: 2 }), elipse(xx - 0.02, yy - 0.02, 0.12, 0.1, '#c88a3a', 1.025, { ...S, alfa: 0.7, detalhe: 3 }));
    for (let j = 0; j < 4; j++) partes.push(tira([xx - 0.06, yy - 0.03 + j * 0.02, xx + 0.06, yy - 0.02 + j * 0.02], 0.012, '#e8c86a', 1.026, { ...O, alfa: 0.8, detalhe: 3 }, 0.4));
    partes.push(elipse(xx + 0.04, yy + 0.03, 0.06, 0.05, '#f0ece0', 1.027, { ...O, detalhe: 3 }), elipse(xx + 0.045, yy + 0.03, 0.03, 0.025, '#e8a020', 1.028, { ...O, detalhe: 3 }));
    partes.push(poli(retQ(ID, xx - 0.05, yy + 0.04, 0.05, 0.035), '#2a4a2a', 1.027, { ...O, detalhe: 3 }));
    partes.push(tira([xx + 0.12, yy - 0.1, xx + 0.16, yy + 0.12], 0.012, '#c8a46a', 1.03, { contorno: 'leve', detalhe: 3 }), tira([xx + 0.14, yy - 0.1, xx + 0.19, yy + 0.11], 0.012, '#c8a46a', 1.03, { contorno: 'leve', detalhe: 3 }));
  }
  for (const [x, c] of [[-1.05, '#7a1a10'], [-0.98, '#1a1410'], [1.0, '#c8a020']] as const) disco(partes, x, 0.45, 0.035, tonsDe(c), 1.05);
  bloco(partes, quadro(0.38, 0.4), 0.14, 0.08, ACO, 1.04, 0.01);
  // O toldo: o pano listrado, a barriga (mais clara no fundo, que pega a luz) e as manchas.
  partes.push(poli(retR(ID, 0.015, (y0 + y1) / 2 + 0.02, W + 0.04, y1 - y0 + 0.04, 0.04), t.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(ID, 0, (y0 + y1) / 2, W, y1 - y0, 0.03), t.base, 1.452, { ...O, detalhe: 1 }));
  const faixas = 9, fw = W / faixas;
  for (let i = 0; i < faixas; i += 2) partes.push(poli(retQ(ID, -W / 2 + fw * (i + 0.5), (y0 + y1) / 2, fw, y1 - y0 - 0.02), cor === '#2a2a30' ? '#4a4a52' : clara, 1.454, { ...O, alfa: 0.92, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, y0 + 0.28, W - 0.04, 0.5), '#ffffff', 1.456, { ...S, alfa: 0.14, desfoque: 0.08, detalhe: 2 }), poli(retQ(ID, 0, y1 - 0.18, W - 0.04, 0.3), '#000000', 1.456, { ...S, alfa: 0.18, desfoque: 0.06, detalhe: 2 }));
  for (let i = 1; i < faixas; i++) partes.push(tira([-W / 2 + fw * i, y0 + 0.02, -W / 2 + fw * i, y1 - 0.02], 0.008, t.nanquim, 1.457, { ...O, alfa: 0.35, detalhe: 3 }));
  for (let k = 0; k < 5; k++) partes.push(poli(bolha(-W / 2 + 0.2 + r() * (W - 0.4), y0 + 0.15 + r() * 1.0, 0.08 + r() * 0.12, 0.06 + r() * 0.08, 12, 0.3, r), '#2a1e14', 1.458, { ...S, alfa: 0.25, desfoque: 0.03, detalhe: 3 }));
  // A aba da frente (um pouco de frente), com o recorte em ondas e as cortininhas (noren) com o glifo branco.
  partes.push(poli(retQ(ID, 0, y1 + 0.06, W, 0.12), t.sombra, 1.46, { contorno: 'leve', detalhe: 1 }));
  for (let i = 0; i < faixas; i++) partes.push(elipse(-W / 2 + fw * (i + 0.5), y1 + 0.12, fw * 0.9, 0.06, i % 2 ? t.sombra : tom(clara, -0.3), 1.459, { ...O, detalhe: 2 }));
  for (let i = 0; i < 4; i++) {
    const x = -0.45 + i * 0.3;
    partes.push(poli(retQ(ID, x, y1 + 0.2, 0.27, 0.16), pano, 1.47, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, x - 0.07, y1 + 0.2, 0.06, 0.15), tom(pano, 0.25), 1.471, { ...S, alfa: 0.5, detalhe: 3 }));
    for (const tr of letra(r)) partes.push(tira(levar(tr, x, y1 + 0.2, 0.12, 0.1), 0.014, '#e8e4d8', 1.472, { ...O, alfa: 0.85, detalhe: 3 }));
  }
  // As lanternas de papel nas pontas da aba.
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.12), y = y1 + 0.2;
    if (aceso) partes.push(elipse(x, y, 0.42, 0.42, '#4a0e04', 1.474, { ...O, brilho: true, alfa: 0.6, desfoque: 0.08, detalhe: 2 }));
    partes.push(elipse(x, y, 0.2, 0.26, '#1a0604', 1.475, { contorno: 'leve', detalhe: 2 }), elipse(x, y, 0.18, 0.24, aceso ? '#a83418' : '#6a1a10', 1.476, { ...O, brilho: aceso, detalhe: 2 }));
    if (aceso) partes.push(elipse(x - 0.01, y - 0.01, 0.1, 0.14, '#c86a2a', 1.477, { ...S, brilho: true, alfa: 0.8, detalhe: 3 }));
    for (const dy of [-0.06, 0, 0.06]) partes.push(tira([x - 0.085, y + dy, x + 0.085, y + dy], 0.006, '#3a0a04', 1.478, { ...O, alfa: 0.6, detalhe: 3 }));
    for (const dy of [-0.13, 0.13]) partes.push(poli(retQ(ID, x, y + dy, 0.1, 0.03), '#0c0a08', 1.479, { contorno: 'leve', detalhe: 3 }));
  }
  // O letreirinho de néon sobre o toldo e o vapor que sobe da panela do fundo.
  partes.push(...placa(r, 0.95, 0.26, n, 2, aceso, 1.48).map(p => (p.forma === 'poli' ? { ...p, pts: p.pts!.map((v, i) => (i % 2 ? v - 0.02 : v)) } : { ...p, y: p.y! - 0.02 })));
  for (let k = 0; k < 6; k++) {
    const x = -0.75 + r() * 0.5 + (k % 2) * 0.9, y = y0 + 0.2 + r() * 0.35, R = 0.12 + r() * 0.12;
    partes.push(poli(bolha(x, y, R, R * 0.8, 14, 0.3, r), '#e8e8ec', 1.5 + k * 0.001, { ...S, alfa: 0.16 + r() * 0.08, desfoque: R * 0.5, detalhe: 2 }));
  }
  return partes;
}

// ---------- Drone ----------

/**
 * Drone de quatro rotores parado no ar: a sombra solta no chão, deslocada e macia; os braços em X, os rotores borrados do giro com um risco de
 * pá, o casco com a faixa de cor, a câmera na frente (+x) e as luzes de navegação. `holofote` acende o facho no chão, à frente.
 */
function drone(seed: number, holofote: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], faixa = NEONS[Math.floor(r() * NEONS.length)]!;
  partes.push(poli(bolha(0.2, 0.24, 0.32, 0.3, 16, 0.08, r), '#0a0a0c', 0.01, { ...S, alfa: 0.22, desfoque: 0.1, detalhe: 2 }));
  for (const [x, y] of [[0.2 - 0.21, 0.24 - 0.21], [0.2 + 0.21, 0.24 - 0.21], [0.2 - 0.21, 0.24 + 0.21], [0.2 + 0.21, 0.24 + 0.21]] as const) partes.push(elipse(x, y, 0.2, 0.2, '#0a0a0c', 0.011, { ...S, alfa: 0.14, desfoque: 0.06, detalhe: 2 }));
  if (holofote) partes.push(elipse(0.3, 0.12, 0.5, 0.4, '#2a3444', 0.012, { ...O, brilho: true, alfa: 0.75, desfoque: 0.08, detalhe: 2 }));
  for (const a of [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4]) {
    const cx = Math.cos(a) * 0.3, cy = Math.sin(a) * 0.3, frente = cx > 0;
    partes.push(tira([Math.cos(a) * 0.08, Math.sin(a) * 0.08, cx, cy], 0.045, GRAFITE.nanquim, 1.4, { contorno: 'leve', detalhe: 2 }), tira([Math.cos(a) * 0.08, Math.sin(a) * 0.08, cx, cy], 0.022, GRAFITE.luz, 1.401, { ...O, detalhe: 3 }));
    disco(partes, cx, cy, 0.04, GRAFITE, 1.42);
    partes.push(elipse(cx, cy, 0.36, 0.36, '#8a949e', 1.45, { ...S, alfa: 0.2, detalhe: 2 }), tira(anel(cx, cy, 0.175, 0.175, 22), 0.01, '#c8d0d8', 1.451, { ...O, alfa: 0.3, detalhe: 3 }));
    const g = r() * Math.PI;
    for (const d of [0, Math.PI]) partes.push(lente(cx, cy, g + d, 0.17, 0.035, '#1a1c20', 1.452, { ...S, alfa: 0.45, detalhe: 3 }));
    partes.push(elipse(cx + Math.cos(a) * 0.05, cy + Math.sin(a) * 0.05, 0.035, 0.035, frente ? (cy < 0 ? '#8a1a14' : '#1a7a34') : '#a8a8a0', 1.455, { ...O, brilho: true, detalhe: 3 }));
  }
  partes.push(poli(retR(ID, 0.012, 0.014, 0.34, 0.25, 0.09), GRAFITE.nanquim, 1.43, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(ID, 0, 0, 0.32, 0.23, 0.08), GRAFITE.base, 1.432, { ...O, detalhe: 1 }), poli(retR(ID, -0.02, -0.02, 0.22, 0.15, 0.06), GRAFITE.luz, 1.434, { ...S, detalhe: 2 }));
  partes.push(tira([-0.12, 0, 0.12, 0], 0.025, faixa.tubo, 1.436, { ...O, brilho: true, detalhe: 3 }), tira([-0.12, 0, 0.12, 0], 0.01, faixa.nucleo, 1.437, { ...O, brilho: true, detalhe: 3 }));
  partes.push(lente(-0.12, -0.08, 0, 0.16, 0.025, GRAFITE.brilho, 1.438, { ...S, alfa: 0.6, detalhe: 3 }));
  disco(partes, 0.19, 0, 0.045, GRAFITE, 1.44);
  partes.push(elipse(0.2, 0, 0.045, 0.045, holofote ? '#c8d8e8' : '#0a1420', 1.445, { ...O, brilho: holofote, detalhe: 3 }), elipse(0.19, -0.012, 0.015, 0.012, '#e8f0f8', 1.446, { ...O, detalhe: 3 }));
  return partes;
}

// ---------- Antena parabólica ----------

/**
 * Antena parabólica de laje: o prato inclinado para o céu do sul (+y), côncavo (a borda de dentro do noroeste na sombra, a de sudeste clara),
 * o braço com o LNB no foco, as pernas do suporte até os blocos de concreto que a seguram, o cabo, a ferrugem e a sujeira.
 */
function antenaParabolica(seed: number, D: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = D / 2, ry = R * 0.84, t = tonsDe(r() < 0.7 ? '#c4c8c4' : '#6a6e72');
  sombraNoChao(partes, anel(0.08, 0.1, R, ry, 20), 0.01, '#0a0a0c', 0.45);
  // O suporte: as pernas até os blocos de concreto, que aparecem atrás do prato.
  for (const s of [-1, 1]) {
    const fx = s * R * 0.72, fy = -ry * 0.98;
    bloco(partes, quadro(fx, fy, (r() - 0.5) * 0.3), 0.28, 0.2, CONCRETO, 0.15, 0.03);
    partes.push(tira([0, -ry * 0.2, fx, fy], 0.04, ACO.sombra, 0.3, { contorno: 'leve', detalhe: 2 }));
  }
  partes.push(tira([0, -ry * 0.2, 0, -ry * 1.02], 0.05, ACO.base, 0.32, { contorno: 'leve', detalhe: 2 }));
  // O prato: nanquim, a base, a concavidade e a borda.
  partes.push(elipse(0.015, 0.018, D + 0.05, ry * 2 + 0.05, t.nanquim, 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(elipse(0, 0, D, ry * 2, t.base, 1.003, { ...O, detalhe: 1 }));
  partes.push(elipse(LUZ_X * R * 0.16, LUZ_Y * ry * 0.16, D * 0.86, ry * 1.7, t.sombra, 1.005, { ...S, alfa: 0.55, detalhe: 1 }));
  partes.push(elipse(-LUZ_X * R * 0.2, -LUZ_Y * ry * 0.2, D * 0.6, ry * 1.1, t.luz, 1.007, { ...S, alfa: 0.6, detalhe: 2 }));
  partes.push(elipse(-LUZ_X * R * 0.32, -LUZ_Y * ry * 0.32, D * 0.24, ry * 0.4, t.brilho, 1.008, { ...S, alfa: 0.45, detalhe: 3 }));
  partes.push(tira(anel(0, 0, R * 0.55, ry * 0.55, 28), 0.008, t.sombra, 1.009, { ...O, alfa: 0.3, detalhe: 3 }));
  const borda = (a0: number, a1: number): number[] => { const p: number[] = []; for (let k = 0; k <= 14; k++) { const a = a0 + (k / 14) * (a1 - a0); p.push(Math.cos(a) * (R - 0.01), Math.sin(a) * (ry - 0.01)); } return p; };
  partes.push(tira(borda(Math.PI * 0.85, Math.PI * 1.65), 0.025, t.brilho, 1.01, { ...O, alfa: 0.8, detalhe: 2 }), tira(borda(-0.15, Math.PI * 0.65), 0.025, t.nanquim, 1.01, { ...O, alfa: 0.55, detalhe: 2 }));
  // A sujeira e a ferrugem que escorrem para a borda de baixo.
  for (let k = 0; k < 5; k++) { const a = r() * 6.28, d = 0.3 + r() * 0.6; partes.push(poli(bolha(Math.cos(a) * R * d, Math.sin(a) * ry * d, 0.03 + r() * 0.05, 0.02 + r() * 0.04, 10, 0.3, r), r() < 0.5 ? '#5a3a1e' : '#3a3a30', 1.012, { ...S, alfa: 0.35, detalhe: 3 })); }
  // O braço do LNB, as duas escoras e o cabo.
  const fy = ry * 0.1;
  partes.push(tira([0, ry * 0.96, 0, fy], 0.035, ACO.base, 1.3, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(tira([s * R * 0.78, ry * 0.5, 0, fy + 0.04], 0.018, ACO.sombra, 1.29, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, quadro(0, fy), 0.09, 0.13, GRAFITE, 1.34, 0.012);
  disco(partes, 0, fy - 0.08, 0.04, tonsDe('#2a2c30'), 1.36);
  partes.push(tira([0.03, fy + 0.06, 0.04, ry * 0.9, R * 0.5, ry * 1.02, R * 0.9, ry * 0.95], 0.016, '#0c0c0e', 1.31, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

// ---------- Quadro de cabos ----------

/**
 * Quadro de cabos: o armário de chapa encostado na parede (−y), com o chapéu de chuva, e a frente (+y) vista um pouco de frente (a porta com as
 * venezianas, o triângulo do raio, o cadeado arrombado e a portinhola aberta com a caixinha pirata piscando); por cima, o feixe de cabos que sobe
 * do quadro e corre pela parede para os dois lados, com as barrigas penduradas, as abraçadeiras e uma emenda.
 */
function quadroDeCabos(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = tonsDe(['#5e6a60', '#6e6e68', '#4a5866'][Math.floor(r() * 3)]!), W = 0.8, D = 0.34, cx = -0.1, yb = -0.18, yF = yb + D / 2 + 0.07;
  sombraNoChao(partes, retQ(ID, cx, yb + 0.05, W + 0.05, D + 0.2), 0.01, '#0a0a0c', 0.45);
  // O armário, de cima, com o chapéu e a frente.
  bloco(partes, quadro(cx, yb), W, D, t, 1.28, 0.03);
  partes.push(poli(retQ(ID, cx, yb - D / 2 + 0.03, W + 0.06, 0.07), t.luz, 1.29, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 4; k++) partes.push(poli(bolha(cx + (r() - 0.5) * W * 0.8, yb + (r() - 0.5) * D * 0.6, 0.04 + r() * 0.04, 0.03, 10, 0.3, r), '#4a3018', 1.291, { ...S, alfa: 0.35, detalhe: 3 }));
  partes.push(poli(retQ(ID, cx, yF, W, 0.15), t.nanquim, 1.2, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, cx - 0.12, yF, W * 0.6, 0.13), t.base, 1.202, { ...O, detalhe: 1 }));
  for (let j = 0; j < 4; j++) partes.push(tira([cx - 0.32, yF - 0.04 + j * 0.018, cx + 0.06, yF - 0.04 + j * 0.018], 0.006, t.nanquim, 1.204, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(poli([cx - 0.24, yF + 0.055, cx - 0.17, yF + 0.055, cx - 0.205, yF + 0.01], '#d0a018', 1.205, { ...O, detalhe: 3 }), tira([cx - 0.2, yF + 0.02, cx - 0.212, yF + 0.035, cx - 0.198, yF + 0.035, cx - 0.21, yF + 0.05], 0.006, '#141010', 1.206, { ...O, detalhe: 3 }));
  partes.push(tira([cx + 0.13, yF - 0.01, cx + 0.15, yF + 0.03, cx + 0.12, yF + 0.05], 0.01, ACO.luz, 1.206, { contorno: 'leve', detalhe: 3 }));
  // A portinhola aberta: o escuro de dentro, os fios e a caixinha pirata com os leds.
  const px = cx + W / 2 - 0.13;
  partes.push(poli(retQ(ID, px, yF, 0.2, 0.13), '#060708', 1.203, { ...O, detalhe: 2 }), tira([px + 0.1, yF - 0.06, px + 0.2, yF - 0.04, px + 0.21, yF + 0.07, px + 0.11, yF + 0.07], 0.012, t.luz, 1.21, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, quadro(px, yF + 0.01), 0.1, 0.06, tonsDe('#1a1c22'), 1.207, 0.008);
  for (let k = 0; k < 3; k++) partes.push(elipse(px - 0.03 + k * 0.03, yF - 0.005, 0.014, 0.014, ['#2a8a3a', '#8a7a1a', '#2a8a3a'][k]!, 1.209, { ...O, brilho: true, detalhe: 3 }));
  for (const c of ['#a8221a', '#1e3a6a', '#d0a018']) partes.push(tira([px + (r() - 0.5) * 0.08, yF + 0.04, px + (r() - 0.5) * 0.16, yF + 0.08, px + 0.12 + r() * 0.1, yF + 0.12], 0.008, c, 1.21, { ...O, detalhe: 3 }));
  // O feixe: sobe do topo do quadro e corre pela parede para os dois lados, cada cabo numa barriga diferente.
  const yp = -0.36;
  for (let k = 0; k < 10; k++) {
    const s = k % 2 ? 1 : -1, x0 = cx + (k - 4.5) * 0.045, cor = CABOS[Math.floor(r() * CABOS.length)]!, w = 0.022 + r() * 0.016, barriga = 0.04 + r() * 0.12;
    const xf = s * (0.82 - r() * 0.02), xm = (x0 + xf) / 2;
    partes.push(tira([x0, yb - D / 2 + 0.04, x0 + s * 0.06, yp + 0.02, xm, yp + barriga, xf, yp + (r() - 0.5) * 0.03], w, cor, 1.5 + k * 0.002, { contorno: 'leve', detalhe: 2 }));
    partes.push(tira([x0 + s * 0.06, yp + 0.02 - w * 0.2, xm, yp + barriga - w * 0.2, xf, yp - w * 0.2], w * 0.3, tom(cor, 0.7), 1.501 + k * 0.002, { ...O, alfa: 0.45, detalhe: 3 }));
  }
  // As abraçadeiras e uma emenda.
  for (const x of [-0.55, -0.34, 0.25, 0.52]) partes.push(tira([x, yp - 0.04, x, yp + 0.06], 0.014, '#d8d8d0', 1.53, { ...O, alfa: 0.85, detalhe: 3 }));
  bloco(partes, quadro(0.56, yp + 0.02), 0.12, 0.08, GRAFITE, 1.535, 0.01);
  partes.push(elipse(0.56, yp + 0.02, 0.02, 0.02, '#8a1a14', 1.54, { ...O, brilho: true, detalhe: 3 }));
  return partes;
}

// ---------- Poste com telas ----------

/**
 * Poste com telas: a base de concreto e a haste de aço com a travessa no alto (−y) de onde pendem duas telas de anúncio, vistas um pouco de
 * frente, e uma terceira pequena na haste; acesas, cada uma mostra faixas de cor, um ícone e letras, com a varredura; os cabos caem da travessa
 * para os dois lados, a câmera de vigilância numa ponta e o clarão colorido na calçada.
 */
function posteComTelas(seed: number, n: Neon, acesa: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], a = acento(n), py = 0.32, ty = -0.5;
  sombraNoChao(partes, anel(0, py, 0.22, 0.2, 14), 0.01, '#0a0a0c', 0.4);
  if (acesa) partes.push(elipse(0, 0.25, 1.6, 0.66, n.halo, 0.01, { ...O, brilho: true, alfa: 0.55, desfoque: 0.12, detalhe: 1 }));
  disco(partes, 0, py, 0.2, CONCRETO, 0.05);
  disco(partes, 0, py, 0.09, GRAFITE, 0.4);
  cilindro(partes, 0, py, 0, ty, 0.08, 0.06, GRAFITE, 1.3);
  // Os cabos que caem da travessa para fora (para os prédios dos dois lados).
  for (let k = 0; k < 5; k++) { const s = k % 2 ? 1 : -1, x0 = s * (0.2 + r() * 0.4), y = ty + (r() - 0.5) * 0.08; partes.push(tira([x0, y, s * 0.6, y + 0.08 + r() * 0.12, s * 0.88, ty - 0.1 + r() * 0.2], 0.018 + r() * 0.01, CABOS[k]!, 1.49 + k * 0.001, { contorno: 'leve', detalhe: 2 })); }
  partes.push(tira([-0.68, ty, 0.68, ty], 0.06, GRAFITE.nanquim, 1.45, { contorno: 'leve', detalhe: 2 }), tira([-0.66, ty - 0.01, 0.66, ty - 0.01], 0.025, GRAFITE.luz, 1.451, { ...O, detalhe: 3 }));
  // A câmera numa ponta da travessa.
  bloco(partes, quadro(0.7, ty + 0.02), 0.12, 0.07, tonsDe('#c8c8c4'), 1.47, 0.01);
  partes.push(elipse(0.76, ty + 0.02, 0.03, 0.03, '#8a1a14', 1.48, { ...O, brilho: true, detalhe: 3 }));
  const tela = (x: number, y: number, w: number, h: number, z: number, forma: number): void => {
    partes.push(poli(retR(ID, x + 0.01, y + 0.012, w + 0.05, h + 0.05, 0.015), GRAFITE.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    partes.push(poli(retQ(ID, x, y, w, h), acesa ? n.halo : '#0a0b0e', z + 0.002, { ...O, brilho: acesa, detalhe: 1 }));
    if (!acesa) { partes.push(lente(x - w * 0.4, y - h * 0.3, 0.9, h * 0.6, w * 0.15, '#3a4048', z + 0.003, { ...S, alfa: 0.4, detalhe: 3 })); return; }
    for (let k = 0; k < 3; k++) partes.push(poli(retQ(ID, x, y - h / 2 + h * (0.15 + k * 0.12), w - 0.04, h * 0.07), (k % 2 ? a : n).tubo, z + 0.003, { ...O, brilho: true, alfa: 0.9, detalhe: 2 }));
    if (forma > 0) for (const tr of icone(forma)) partes.push(tira(levar(tr, x, y + h * 0.12, w * 0.6, w * 0.6), 0.014, n.nucleo, z + 0.005, { ...O, brilho: true, detalhe: 3 }));
    for (const tr of letra(r)) partes.push(tira(levar(tr, x - w * 0.18, y + h * 0.38, w * 0.22, h * 0.14), 0.01, a.nucleo, z + 0.005, { ...O, brilho: true, detalhe: 3 }));
    for (const tr of letra(r)) partes.push(tira(levar(tr, x + w * 0.18, y + h * 0.38, w * 0.22, h * 0.14), 0.01, a.nucleo, z + 0.005, { ...O, brilho: true, detalhe: 3 }));
    for (let yy = y - h / 2 + 0.02; yy < y + h / 2; yy += 0.035) partes.push(tira([x - w / 2 + 0.01, yy, x + w / 2 - 0.01, yy], 0.006, '#000000', z + 0.006, { ...O, alfa: 0.25, detalhe: 3 }));
  };
  for (const s of [-1, 1]) {
    const x = s * 0.4;
    for (const dx of [-0.1, 0.1]) partes.push(tira([x + dx, ty, x + dx, ty + 0.1], 0.015, ACO.sombra, 1.455, { contorno: 'leve', detalhe: 3 }));
    tela(x, ty + 0.38, 0.34, 0.56, 1.46, [3, 2, 4, 1][Math.floor(r() * 4)]!);
  }
  tela(0, 0.06, 0.16, 0.2, 1.35, 0);
  return partes;
}

// ---------- Máquina de venda de néon ----------

/** A máquina de venda da Q21b com o gabinete escuro, o tubo de néon contornando o tampo, a faixa acesa na frente e duas letras no alto. */
function maquinaDeNeon(seed: number, acesa: boolean, n: Neon): Parte[] {
  const r = mulberry32(seed ^ 0x9e37), partes = maquinaDeVenda(seed, acesa, true), yF = 0.27;
  tubo(partes, contornoQ(0, -0.12, 0.88, 0.66), 0.012, n, 1.47, acesa);
  tubo(partes, [-0.46, yF + 0.085, 0.46, yF + 0.085], 0.01, acento(n), 1.31, acesa);
  for (let i = 0; i < 2; i++) for (const tr of letra(r)) tubo(partes, levar(tr, -0.12 + i * 0.24, -0.16, 0.16, 0.2), 0.01, n, 1.475 + i * 0.002, acesa);
  return partes;
}

// ---------- Interiores (Q23b) ----------

/**
 * Uma tela vista um pouco de frente, no referencial `f` (centro em 0, w × h): a moldura, o vidro escuro e, acesa, o brilho com o conteúdo
 * (0 linhas de código, 1 gráfico com barras, 2 mapa de rede, 3 jogo em blocos) e a varredura; apagada, só o reflexo no vidro.
 */
function telaDeFrente(partes: Parte[], r: () => number, f: Quadro, w: number, h: number, z: number, n: Neon, acesa: boolean, tipo = Math.floor(r() * 3)): void {
  const T = (pts: number[]): number[] => em(f, pts), m = Math.min(w, h) * 0.1;
  partes.push(poli(T(retR(ID, 0.008, 0.01, w + 0.035, h + 0.035, 0.01)), GRAFITE.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(T(retQ(ID, 0, 0, w, h)), acesa ? n.halo : '#0a0b0e', z + 0.002, { ...O, brilho: acesa, detalhe: 1 }));
  if (!acesa) { partes.push(poli(T([-w * 0.42, -h * 0.4, -w * 0.12, -h * 0.4, -w * 0.32, h * 0.1]), '#3a4048', z + 0.003, { ...S, alfa: 0.35, detalhe: 3 })); return; }
  const a = acento(n), L = { ...O, brilho: true, detalhe: 3 as const };
  if (tipo === 0) {
    const linhas = Math.max(3, Math.floor((h - 2 * m) / 0.028));
    for (let k = 0; k < linhas; k++) {
      const v = -h / 2 + m + (k + 0.5) * (h - 2 * m) / linhas, rec = Math.floor(r() * 3) * w * 0.07, comp = (0.2 + r() * 0.65) * (w - 2 * m - rec);
      partes.push(tira(T([-w / 2 + m + rec, v, -w / 2 + m + rec + comp, v]), Math.min(0.012, ((h - 2 * m) / linhas) * 0.5), r() < 0.18 ? a.nucleo : n.nucleo, z + 0.004, { ...L, alfa: 0.85 }));
    }
  } else if (tipo === 1) {
    const pts: number[] = [];
    for (let k = 0; k <= 10; k++) pts.push(-w / 2 + m + (k * (w - 2 * m)) / 10, h * 0.1 - r() * h * 0.32);
    partes.push(tira(T(pts), 0.01, n.nucleo, z + 0.004, L));
    for (let k = 0; k < 5; k++) { const bh = h * (0.08 + r() * 0.2); partes.push(poli(T(retQ(ID, -w / 2 + m + ((k + 0.5) * (w - 2 * m)) / 5, h / 2 - m - bh / 2, ((w - 2 * m) / 5) * 0.6, bh)), a.tubo, z + 0.004, { ...L, alfa: 0.9 })); }
  } else if (tipo === 2) {
    const nos: [number, number][] = [];
    for (let k = 0; k < 6; k++) nos.push([(r() - 0.5) * (w - 2 * m), (r() - 0.5) * (h - 2 * m)]);
    for (let k = 1; k < nos.length; k++) partes.push(tira(T([...nos[Math.floor(r() * k)]!, ...nos[k]!]), 0.006, n.nucleo, z + 0.004, { ...L, alfa: 0.7 }));
    nos.forEach(([u, v], k) => partes.push(poli(T(retQ(ID, u, v, 0.035, 0.035)), k === 0 ? NEONS[4]!.nucleo : a.nucleo, z + 0.005, L)));
  } else {
    const c = Math.max(4, Math.floor((w - 2 * m) / 0.04)), lin = Math.max(3, Math.floor((h - 2 * m) / 0.04)), cw = (w - 2 * m) / c, ch = (h - 2 * m) / lin, cores = [n.nucleo, a.nucleo, NEONS[2]!.nucleo, NEONS[3]!.nucleo];
    for (let i = 0; i < c; i++) for (let j = 0; j < lin; j++) if (j >= lin - 1 || r() < 0.18) partes.push(poli(T(retQ(ID, -w / 2 + m + cw * (i + 0.5), -h / 2 + m + ch * (j + 0.5), cw * 0.8, ch * 0.8)), j >= lin - 1 ? n.tubo : cores[Math.floor(r() * cores.length)]!, z + 0.004, L));
  }
  for (let v = -h / 2 + 0.015; v < h / 2; v += 0.03) partes.push(tira(T([-w / 2 + 0.006, v, w / 2 - 0.006, v]), 0.005, '#000000', z + 0.006, { ...O, alfa: 0.25, detalhe: 3 }));
}

/** Uma fileira de leds de máquina (servidor, painel): pontinhos `brilho` nas cores de status, um ou outro vermelho; apagados, o plástico escuro. */
function leds(partes: Parte[], r: () => number, x0: number, x1: number, y: number, z: number, ligado: boolean, n = 6): void {
  const cores = ['#4ae05a', '#4ae05a', '#4ae05a', '#4ab0e8', '#e8b04a', '#e84a3a'];
  for (let k = 0; k < n; k++) {
    const x = x0 + ((k + 0.5) * (x1 - x0)) / n, aceso = ligado && r() < 0.8;
    partes.push(elipse(x, y, 0.016, 0.014, aceso ? cores[Math.floor(r() * cores.length)]! : '#1a1c20', z, { ...O, brilho: aceso, detalhe: 3 }));
  }
}

/**
 * Estação hacker: a mesa escura com o fundo para −y e as telas (de 2 a 6) em duas fileiras, a de baixo na mesa e a de cima em braços,
 * viradas para quem senta, todas acesas com código, gráficos e mapas de rede; o teclado de teclas acesas, um segundo teclado, o fone, as
 * latas, o emaranhado de cabos e a torre com o vidro aceso ao lado; a cadeira gamer na frente (+y).
 */
function estacaoHacker(seed: number, telas: number, n: Neon, acesa: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], a = acento(n), W = 1.8, yM = -0.32, D = 0.76;
  sombraNoChao(partes, retQ(ID, 0, -0.1, W + 0.4, 1.3), 0.01, '#0a0a0c', 0.35);
  if (acesa) partes.push(elipse(0, 0.1, W + 0.6, 1.4, n.halo, 0.01, { ...O, brilho: true, alfa: 0.5, desfoque: 0.15, detalhe: 1 }));
  // A torre ao lado da mesa (+x), com o vidro lateral e as ventoinhas acesas.
  const tx = W / 2 + 0.17, ty = -0.38;
  bloco(partes, quadro(tx, ty), 0.24, 0.5, CHAPA, 0.5, 0.02);
  for (const v of [-0.12, 0.05]) { partes.push(tira(anel(tx, ty + v, 0.065, 0.065, 16), 0.018, acesa ? a.tubo : '#22242a', 0.53, { ...O, brilho: acesa, detalhe: 3 })); partes.push(elipse(tx, ty + v, 0.035, 0.035, '#0a0a0c', 0.531, { ...O, detalhe: 3 })); }
  leds(partes, r, tx - 0.06, tx + 0.06, ty + 0.21, 0.53, acesa, 3);
  // A cadeira gamer.
  cadeiraDeEscritorio(partes, r, (r() - 0.5) * 0.2, 0.42, Math.PI / 2 + (r() - 0.5) * 0.5, ['#16161a', '#3a0a2a', '#0a2a3a'][Math.floor(r() * 3)]!);
  // A mesa, com a borda de néon na frente.
  bloco(partes, quadro(0, yM), W, D, CHAPA, 0.75, 0.025);
  tubo(partes, [-W / 2 + 0.04, yM + D / 2 - 0.02, W / 2 - 0.04, yM + D / 2 - 0.02], 0.008, n, 0.78, acesa);
  // Os cabos que descem do fundo da mesa e o emaranhado que corre para a parede.
  for (let k = 0; k < 7; k++) { const x = -W / 2 + 0.15 + r() * (W - 0.3); partes.push(tira([x, yM - D / 2 + 0.06, x + (r() - 0.5) * 0.3, yM - D / 2 - 0.02, x + (r() - 0.5) * 0.5, -0.74], 0.016 + r() * 0.01, CABOS[Math.floor(r() * CABOS.length)]!, 0.79 + k * 0.001, { contorno: 'leve', detalhe: 3 })); }
  // As telas: a fileira da mesa e a dos braços, as das pontas viradas para dentro.
  const baixo = Math.min(telas, 3), cima = telas - baixo;
  const fileira = (k: number, cont: number, y: number, z: number, w: number): void => {
    const u = (k - (cont - 1) / 2) * (w + 0.06), ang = cont > 1 ? -(u / W) * 0.7 : 0, f = quadro(u, y, ang);
    partes.push(poli(em(f, retQ(ID, 0, -0.05, w * 0.92, 0.05)), GRAFITE.nanquim, z - 0.01, { contorno: 'leve', detalhe: 2 }));
    telaDeFrente(partes, r, f, w, w * 0.42, z, n, acesa);
  };
  for (let k = 0; k < cima; k++) {
    fileira(k, cima, -0.66, 1.3, 0.5);
    partes.push(tira([(k - (cima - 1) / 2) * 0.56, -0.62, (k - (cima - 1) / 2) * 0.4, -0.7], 0.03, GRAFITE.luz, 1.29, { contorno: 'leve', detalhe: 3 }));
  }
  for (let k = 0; k < baixo; k++) fileira(k, baixo, -0.5, 1.05, 0.52);
  // O teclado aceso por baixo das teclas, o mouse com a faixa e o segundo teclado mecânico de lado.
  partes.push(poli(retR(ID, 0, -0.16, 0.46, 0.15, 0.015), '#0a0b0e', 0.79, { contorno: 'leve', detalhe: 2 }));
  if (acesa) partes.push(poli(retQ(ID, 0, -0.16, 0.42, 0.12), a.halo, 0.791, { ...O, brilho: true, alfa: 0.9, detalhe: 2 }));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 12; j++) partes.push(poli(retQ(ID, -0.19 + j * 0.035, -0.205 + i * 0.03, 0.026, 0.022), '#22242a', 0.792, { ...O, detalhe: 3 }));
  partes.push(elipse(0.33, -0.15, 0.06, 0.09, '#121316', 0.79, { contorno: 'leve', detalhe: 3 }), tira([0.33, -0.19, 0.33, -0.11], 0.008, acesa ? n.nucleo : '#2a2c32', 0.792, { ...O, brilho: acesa, detalhe: 3 }));
  const f2 = quadro(-0.6, -0.2, 0.35 + (r() - 0.5) * 0.2);
  partes.push(poli(em(f2, retR(ID, 0, 0, 0.32, 0.12, 0.012)), '#1e2026', 0.79, { contorno: 'leve', detalhe: 2 }));
  for (let j = 0; j < 8; j++) partes.push(poli(em(f2, retQ(ID, -0.13 + j * 0.037, 0, 0.028, 0.08)), ['#3a3d44', '#7a1e4a', '#3a3d44'][j % 3]!, 0.792, { ...O, detalhe: 3 }));
  // O fone, as latas (uma amassada) e uma placa de circuito solta.
  partes.push(tira(arco(0.62, -0.42, 0.1, 0.09, Math.PI, Math.PI * 2, 10), 0.03, '#141418', 0.8, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) disco(partes, 0.62 + s * 0.1, -0.41, 0.045, tonsDe('#1a1a20'), 0.8);
  for (let k = 0; k < 3; k++) { const c = ['#1a7a8a', '#8a1a5a', '#a8a01a'][Math.floor(r() * 3)]!; disco(partes, 0.72 - k * 0.09 + r() * 0.03, -0.16 - r() * 0.08, 0.033, tonsDe(c), 0.82); partes.push(elipse(0.72 - k * 0.09, -0.16, 0.022, 0.022, ACO.luz, 0.84, { ...O, alfa: 0.7, detalhe: 3 })); }
  const fp = quadro(-0.42, -0.42, (r() - 0.5) * 0.6);
  partes.push(poli(em(fp, retQ(ID, 0, 0, 0.2, 0.13)), '#1a4a2a', 0.79, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 5; k++) partes.push(poli(em(fp, retQ(ID, -0.07 + r() * 0.14, -0.04 + r() * 0.08, 0.03, 0.02)), k % 2 ? '#141418' : '#a8a080', 0.793, { ...O, detalhe: 3 }));
  return partes;
}

/**
 * Cadeira de implante: a poltrona reclinada de clínica clandestina (a cabeça para −y), com o vinil remendado e as cintas, sobre o pedestal;
 * do lado (+x), o braço robótico com a ponta de bisturi acesa sobre a cabeça; do outro, a bandeja com os ferros e a peça de cromo a instalar
 * e o monitor de sinais; por cima de tudo, o foco cirúrgico redondo. Os cabos no chão e a mancha que ninguém limpou.
 */
function cadeiraDeImplante(seed: number, acesa: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], vinil = ['#1a3a3a', '#2a1a1e', '#1e2430'][Math.floor(r() * 3)]!, n = NEONS[0]!;
  sombraNoChao(partes, retQ(ID, 0, 0, 1.4, 2.2), 0.01, '#0a0a0c', 0.35);
  partes.push(poli(bolha(0.15 + r() * 0.2, 0.45, 0.26, 0.18, 14, 0.35, r), '#2a0a08', 0.012, { ...S, alfa: 0.45, desfoque: 0.03, detalhe: 2 }));
  if (acesa) partes.push(elipse(0, -0.55, 1.5, 1.4, '#2a3a44', 0.013, { ...O, brilho: true, alfa: 0.5, desfoque: 0.18, detalhe: 1 }));
  // Os cabos no chão, do braço e do monitor para a parede.
  for (let k = 0; k < 3; k++) { const x0 = 0.6 + (k - 1) * 0.05; partes.push(tira([x0, -0.5, x0 + 0.08 + r() * 0.08, -0.75, x0 + (r() - 0.3) * 0.25, -1.08], 0.016 + r() * 0.006, CABOS[k]!, 0.02 + k * 0.001, { contorno: 'leve', detalhe: 3 })); }
  partes.push(tira([-0.67, -0.82, -0.6, -1.0, -0.7, -1.08], 0.016, CABOS[3]!, 0.024, { contorno: 'leve', detalhe: 3 }));
  // O pedestal e a poltrona em quatro segmentos: encosto de cabeça, encosto, assento e apoio das pernas.
  disco(partes, 0, 0.1, 0.24, CHAPA, 0.3, 0.3);
  const segs: [number, number, number, number][] = [[-0.9, 0.3, 0.24, 1.0], [-0.42, 0.62, 0.68, 0.9], [0.22, 0.64, 0.56, 0.72], [0.78, 0.5, 0.52, 0.58]];
  for (const [v, w, h, z] of segs) {
    bloco(partes, quadro(0, v), w + 0.06, h + 0.04, ACO, z - 0.06, 0.012);
    estofado(partes, ID, 0, 0, v, w, h, vinil, z, 0.06);
  }
  for (let k = 0; k < 3; k++) partes.push(poli(retQ(quadro((r() - 0.5) * 0.3, -0.5 + r() * 0.9, (r() - 0.5) * 0.6), 0, 0, 0.12, 0.06), '#5a5a50', 1.0, { contorno: 'leve', alfa: 0.85, detalhe: 3 }));
  for (const v of [-0.3, 0.3, 0.86]) partes.push(poli(retQ(ID, 0, v, 0.72, 0.06), '#141414', 1.01, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0.3, v, 0.06, 0.08), ACO.luz, 1.012, { ...O, detalhe: 3 }));
  for (const s of [-1, 1]) { partes.push(poli(retR(ID, s * 0.38, -0.25, 0.08, 0.5, 0.03), '#141416', 0.95, { contorno: 'leve', detalhe: 2 })); partes.push(poli(retQ(ID, s * 0.38, -0.15, 0.1, 0.05), '#141414', 0.96, { contorno: 'leve', detalhe: 3 })); }
  // A bandeja (−x) com os ferros, a peça de cromo e o monitor de sinais.
  const bx = -0.62, by = -0.2;
  partes.push(tira([bx, by, bx, by + 0.02], 0.04, ACO.sombra, 0.4, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, quadro(bx, by), 0.34, 0.5, ACO, 0.95, 0.012);
  for (let k = 0; k < 4; k++) partes.push(tira([bx - 0.12 + k * 0.06, by - 0.18, bx - 0.11 + k * 0.06, by + 0.02], 0.012, ACO.brilho, 0.97, { contorno: 'leve', detalhe: 3 }, 0.4));
  cilindro(partes, bx, by + 0.08, bx + 0.02, by + 0.2, 0.06, 0.05, ACO, 0.98);
  for (let k = 0; k < 3; k++) partes.push(tira([bx - 0.04 + k * 0.025, by + 0.09, bx - 0.04 + k * 0.025, by + 0.2], 0.008, k === 1 ? '#a8221a' : '#1e3a6a', 0.99, { ...O, detalhe: 3 }));
  partes.push(elipse(bx + 0.1, by + 0.18, 0.04, 0.04, acesa ? n.nucleo : '#1a1c20', 0.99, { ...O, brilho: acesa, detalhe: 3 }));
  disco(partes, bx - 0.05, -0.82, 0.05, GRAFITE, 0.8);
  telaDeFrente(partes, r, quadro(bx - 0.05, -0.88, 0.3), 0.32, 0.2, 1.35, NEONS[2]!, acesa, 1);
  // O braço robótico (+x): a coluna, dois segmentos e a ponta sobre a cabeça.
  const ax = 0.6, ay = -0.55;
  disco(partes, ax, ay, 0.12, CHAPA, 0.8);
  cilindro(partes, ax, ay, 0.42, -0.85, 0.09, 0.07, tonsDe('#c8c8c0'), 1.2);
  disco(partes, 0.42, -0.85, 0.06, CHAPA, 1.25);
  cilindro(partes, 0.42, -0.85, 0.12, -0.95, 0.06, 0.04, tonsDe('#c8c8c0'), 1.3);
  partes.push(tira([0.12, -0.95, 0.04, -0.93], 0.012, ACO.brilho, 1.32, { contorno: 'leve', detalhe: 3 }));
  if (acesa) partes.push(elipse(0.04, -0.93, 0.09, 0.09, NEONS[4]!.halo, 1.33, { ...O, brilho: true, desfoque: 0.03, detalhe: 3 }), elipse(0.04, -0.93, 0.025, 0.025, NEONS[4]!.nucleo, 1.335, { ...O, brilho: true, detalhe: 3 }));
  leds(partes, r, ax - 0.06, ax + 0.06, ay + 0.06, 0.83, acesa, 3);
  // O foco cirúrgico, no alto, um pouco para o lado para não esconder a cabeça.
  const fx = -0.25, fy = -0.6;
  partes.push(tira([fx, fy, fx - 0.25, -1.1], 0.04, ACO.sombra, 1.45, { contorno: 'leve', detalhe: 2 }));
  disco(partes, fx, fy, 0.24, tonsDe('#d0d4d4'), 1.46);
  for (let k = 0; k < 6; k++) { const ang = (k / 6) * Math.PI * 2; partes.push(elipse(fx + Math.cos(ang) * 0.13, fy + Math.sin(ang) * 0.13, 0.08, 0.08, acesa ? '#a8b8c0' : '#5a6064', 1.48, { ...O, brilho: acesa, detalhe: 3 })); }
  partes.push(elipse(fx, fy, 0.08, 0.08, acesa ? '#c8d4d8' : '#5a6064', 1.48, { ...O, brilho: acesa, detalhe: 3 }));
  return partes;
}

/**
 * Racks de servidores: de 1 a 4 armários pretos lado a lado, encostados na parede (−y). De cima, o teto perfurado com as eletrocalhas e o feixe
 * de cabos que vai para a parede; a frente (+y), vista um pouco de frente, com as gavetas de servidor e os leds piscando, um rack de porta aberta.
 */
function rackDeServidores(seed: number, racks: number, ligado: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], w = 0.6, C = racks * w, D = 1.0, yb = -0.1, yF = yb + D / 2 + 0.1, H = 0.2;
  sombraNoChao(partes, retQ(ID, 0, 0, C + 0.05, D + 0.25), 0.01, '#0a0a0c', 0.45);
  if (ligado) partes.push(elipse(0, yF + 0.2, C + 0.4, 0.7, '#0a2a3a', 0.01, { ...O, brilho: true, alfa: 0.55, desfoque: 0.12, detalhe: 1 }));
  bloco(partes, quadro(0, yb), C, D, CHAPA, 1.45, 0.02);
  for (let k = 0; k < racks; k++) {
    const u = -C / 2 + w * (k + 0.5);
    if (k > 0) partes.push(tira([u - w / 2, yb - D / 2 + 0.02, u - w / 2, yb + D / 2 - 0.02], 0.014, CHAPA.nanquim, 1.47, { ...O, detalhe: 3 }));
    for (let i = 0; i < 5; i++) for (let j = 0; j < 8; j++) partes.push(elipse(u - 0.18 + i * 0.09, yb - 0.32 + j * 0.09, 0.03, 0.03, '#060708', 1.472, { ...O, alfa: 0.8, detalhe: 3 }));
    partes.push(poli(retQ(ID, u, yb - D / 2 + 0.06, w - 0.1, 0.06), GRAFITE.luz, 1.48, { contorno: 'leve', detalhe: 2 }));
  }
  // A eletrocalha sobre os racks e o feixe que sobe para a parede.
  partes.push(poli(retQ(ID, 0, yb - D / 2 + 0.12, C + 0.1, 0.12), ACO.sombra, 1.49, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 4 + racks * 2; k++) {
    const x = -C / 2 + 0.05 + r() * (C - 0.1), c = r() < 0.4 ? ['#1e5aa0', '#d0a018', '#a8221a'][Math.floor(r() * 3)]! : CABOS[Math.floor(r() * 4)]!;
    partes.push(tira([x, yb - D / 2 + 0.16, x + (r() - 0.5) * 0.1, yb - D / 2 + 0.08, x + (r() - 0.5) * 0.2, -0.68], 0.018, c, 1.495 + k * 0.0005, { contorno: 'leve', detalhe: 3 }));
  }
  // A frente: as portas de malha com as gavetas e os leds; uma porta aberta mostra as gavetas sem a malha.
  const aberta = racks > 1 && r() < 0.6 ? Math.floor(r() * racks) : -1;
  partes.push(poli(retQ(ID, 0, yF, C, H), CHAPA.nanquim, 1.3, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < racks; k++) {
    const u = -C / 2 + w * (k + 0.5);
    partes.push(poli(retQ(ID, u, yF, w - 0.04, H - 0.025), CHAPA.sombra, 1.302, { ...O, detalhe: 2 }));
    const gavetas = 6;
    for (let g = 0; g < gavetas; g++) {
      const v = yF - H / 2 + 0.02 + (g + 0.5) * ((H - 0.04) / gavetas);
      if (r() < 0.15) continue;
      partes.push(poli(retQ(ID, u, v, w - 0.1, (H - 0.04) / gavetas - 0.006), CHAPA.luz, 1.304, { ...O, detalhe: 3 }));
      leds(partes, r, u - w / 2 + 0.07, u - w / 2 + 0.25, v, 1.306, ligado, 5);
    }
    if (k === aberta) partes.push(tira([u + w / 2 - 0.02, yF - H / 2, u + w / 2 + 0.1, yF + H / 2 + 0.14], 0.03, CHAPA.base, 1.31, { contorno: 'leve', detalhe: 2 }));
    else {
      for (let j = 0; j < 10; j++) partes.push(tira([u - w / 2 + 0.03 + j * ((w - 0.06) / 9), yF - H / 2 + 0.01, u - w / 2 + 0.03 + j * ((w - 0.06) / 9), yF + H / 2 - 0.01], 0.006, '#000000', 1.308, { ...O, alfa: 0.35, detalhe: 3 }));
      partes.push(poli(retQ(ID, u + w / 2 - 0.05, yF, 0.02, 0.06), ACO.luz, 1.309, { ...O, detalhe: 3 }));
    }
  }
  return partes;
}

/**
 * Fliperama: o gabinete com o fundo para −y; de cima, o tampo escuro com a arte lateral em faixas de néon; a frente (+y) vista um pouco de
 * frente: o letreiro aceso no alto com letras inventadas, a tela de jogo em blocos, o painel inclinado com a alavanca e os botões, e a porta das
 * fichas; o clarão no chão.
 */
function fliperama(seed: number, n: Neon, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], a = acento(n), W = 0.68, yb = -0.15, D = 0.6, yF = yb + D / 2;
  sombraNoChao(partes, retQ(ID, 0, -0.02, W + 0.05, 0.9), 0.01, '#0a0a0c', 0.4);
  if (aceso) partes.push(elipse(0, yF + 0.3, W + 0.5, 0.7, n.halo, 0.01, { ...O, brilho: true, alfa: 0.55, desfoque: 0.1, detalhe: 1 }));
  bloco(partes, quadro(0, yb), W, D, CHAPA, 1.45, 0.02);
  for (const s of [-1, 1]) tubo(partes, [s * (W / 2 - 0.03), yb - D / 2 + 0.04, s * (W / 2 - 0.03), yb + D / 2 - 0.04], 0.01, s < 0 ? n : a, 1.47, aceso);
  partes.push(poli(retQ(ID, 0, yb - 0.05, W - 0.16, 0.2), CHAPA.luz, 1.471, { ...O, alfa: 0.4, detalhe: 3 }));
  // O letreiro no alto, a tela, o painel e a porta das fichas, de cima para baixo na frente.
  const yL = yF + 0.04;
  partes.push(poli(retQ(ID, 0, yL, W, 0.08), CHAPA.nanquim, 1.44, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, 0, yL, W - 0.04, 0.06), aceso ? n.halo : '#14161a', 1.442, { ...O, brilho: aceso, detalhe: 2 }));
  for (let i = 0; i < 4; i++) for (const tr of letra(r)) partes.push(tira(levar(tr, -0.2 + i * 0.13, yL, 0.08, 0.045), 0.008, aceso ? n.nucleo : '#3a3c44', 1.444, { ...O, brilho: aceso, detalhe: 3 }));
  partes.push(poli(retQ(ID, 0, yF + 0.16, W, 0.16), CHAPA.base, 1.2, { contorno: 'leve', detalhe: 1 }));
  telaDeFrente(partes, r, quadro(0, yF + 0.16), W - 0.12, 0.13, 1.21, n, aceso, 3);
  partes.push(poli([-W / 2 - 0.02, yF + 0.24, W / 2 + 0.02, yF + 0.24, W / 2 + 0.03, yF + 0.36, -W / 2 - 0.03, yF + 0.36], CHAPA.luz, 0.95, { contorno: 'leve', detalhe: 1 }));
  partes.push(tira([-W / 2 + 0.02, yF + 0.355, W / 2 - 0.02, yF + 0.355], 0.008, a.tubo, 0.952, { ...O, brilho: aceso, detalhe: 3 }));
  disco(partes, -0.18, yF + 0.3, 0.032, tonsDe('#b8221a'), 0.97);
  for (let k = 0; k < 6; k++) { const x = 0.02 + (k % 3) * 0.075, y = yF + 0.28 + Math.floor(k / 3) * 0.045; partes.push(elipse(x, y, 0.04, 0.032, '#060708', 0.96, { contorno: 'leve', detalhe: 3 }), elipse(x, y - 0.003, 0.03, 0.024, [NEONS[0]!.nucleo, NEONS[1]!.nucleo, NEONS[3]!.nucleo][k % 3]!, 0.962, { ...O, brilho: aceso, detalhe: 3 })); }
  partes.push(poli(retQ(ID, 0, yF + 0.43, W - 0.04, 0.1), CHAPA.base, 0.6, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(poli(retQ(ID, s * 0.07, yF + 0.43, 0.05, 0.06), aceso ? NEONS[4]!.tubo : '#2a1010', 0.602, { ...O, brilho: aceso, detalhe: 3 }), tira([s * 0.07, yF + 0.41, s * 0.07, yF + 0.45], 0.008, '#060708', 0.604, { ...O, detalhe: 3 }));
  return partes;
}

/**
 * Balcão luminoso: o balcão de bar de `C` m com o atendente do lado de −y; o tampo de vidro escuro com a borda de néon, os copos, as garrafas,
 * a torre de chope e o porta-guardanapos; a frente (+y), vista um pouco de frente, é um painel translúcido aceso por dentro, com as nervuras;
 * as banquetas cromadas na frente.
 */
function balcaoLuminoso(seed: number, C: number, n: Neon, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], a = acento(n), D = 0.62, yb = -0.3, yF = yb + D / 2 + 0.07;
  sombraNoChao(partes, retQ(ID, 0, -0.05, C + 0.1, 1.3), 0.01, '#0a0a0c', 0.4);
  if (aceso) partes.push(elipse(0, yF + 0.28, C + 0.5, 0.9, n.halo, 0.01, { ...O, brilho: true, alfa: 0.6, desfoque: 0.15, detalhe: 1 }));
  // As banquetas.
  const nb = Math.max(1, Math.floor(C / 0.72));
  for (let k = 0; k < nb; k++) {
    const x = -C / 2 + (C * (k + 0.5)) / nb + (r() - 0.5) * 0.08, y = yF + 0.4 + (r() - 0.5) * 0.06;
    sombraNoChao(partes, anel(x, y, 0.17, 0.17, 12), 0.012, '#0a0a0c', 0.35);
    disco(partes, x, y, 0.14, ACO, 0.3);
    disco(partes, x, y, 0.17, tonsDe(['#1a1a20', '#4a0a2a', '#0a2a3a'][k % 3]!), 0.7);
    partes.push(tira(anel(x, y, 0.17, 0.17, 16), 0.008, a.tubo, 0.715, { ...O, brilho: aceso, alfa: 0.7, detalhe: 3 }));
  }
  // O tampo e a frente acesa.
  partes.push(poli(retQ(ID, 0, yF, C, 0.14), CHAPA.nanquim, 1.05, { contorno: 'leve', detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, yF, C - 0.04, 0.12), aceso ? n.halo : '#121418', 1.052, { ...O, brilho: aceso, detalhe: 1 }));
  if (aceso) partes.push(poli(retQ(ID, 0, yF - 0.01, C - 0.1, 0.05), n.tubo, 1.053, { ...O, brilho: true, alfa: 0.5, desfoque: 0.03, detalhe: 2 }));
  for (let k = 1; k < Math.round(C / 0.25); k++) { const x = -C / 2 + k * 0.25; partes.push(tira([x, yF - 0.055, x, yF + 0.055], 0.012, '#000000', 1.054, { ...O, alfa: 0.4, detalhe: 3 })); }
  bloco(partes, quadro(0, yb), C, D, tonsDe('#14161c'), 1.1, 0.02);
  partes.push(poli(retQ(ID, 0, yb - 0.05, C - 0.1, D * 0.5), '#ffffff', 1.106, { ...S, alfa: 0.05, detalhe: 2 }));
  tubo(partes, [-C / 2 + 0.03, yb + D / 2 - 0.02, C / 2 - 0.03, yb + D / 2 - 0.02], 0.009, n, 1.11, aceso);
  // Em cima: os copos (alguns cheios de néon líquido), as garrafas deitadas, a torre de chope, o porta-guardanapos e o cinzeiro.
  for (let k = 0; k < Math.round(C * 2); k++) {
    const x = -C / 2 + 0.15 + r() * (C - 0.3), y = yb + 0.1 + r() * 0.15;
    if (r() < 0.55) {
      partes.push(elipse(x, y, 0.075, 0.075, '#0a0c10', 1.12, { contorno: 'leve', detalhe: 3 }), elipse(x, y, 0.058, 0.058, r() < 0.5 ? a.tubo : '#a86a1a', 1.122, { ...O, brilho: aceso, alfa: 0.85, detalhe: 3 }));
      partes.push(elipse(x - 0.015, y - 0.015, 0.02, 0.015, '#e8f0f8', 1.124, { ...O, alfa: 0.7, detalhe: 3 }));
    } else {
      const f = quadro(x, y, r() * Math.PI);
      partes.push(poli(em(f, retR(ID, 0, 0, 0.24, 0.07, 0.03)), ['#1a4a2a', '#4a1a0a', '#2a2a3a'][Math.floor(r() * 3)]!, 1.12, { contorno: 'leve', detalhe: 3 }), poli(em(f, retQ(ID, 0.13, 0, 0.06, 0.03)), '#1a1a1a', 1.121, { contorno: 'leve', detalhe: 3 }));
      partes.push(tira(em(f, [-0.09, -0.015, 0.06, -0.015]), 0.01, '#e8f0f8', 1.122, { ...O, alfa: 0.4, detalhe: 3 }));
    }
  }
  const tx = (r() - 0.5) * (C - 0.8);
  bloco(partes, quadro(tx, yb - 0.12), 0.32, 0.1, ACO, 1.3, 0.012);
  for (let k = 0; k < 3; k++) partes.push(elipse(tx - 0.1 + k * 0.1, yb - 0.08, 0.035, 0.05, k === 1 ? '#a8221a' : '#1a1a1a', 1.32, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, quadro(C / 2 - 0.25, yb - 0.1), 0.12, 0.08, ACO, 1.15, 0.01);
  disco(partes, -C / 2 + 0.25, yb - 0.08, 0.05, tonsDe('#3a3a3e'), 1.12);
  return partes;
}

/**
 * Cápsulas de hotel em pilha: de 1 a 4 colunas de duas cápsulas, com a boca para a frente (+y) e o fundo na parede. De cima, o teto de
 * fibra da cápsula de cima com as nervuras, a grade de ar e o número; a frente, vista um pouco de frente, mostra as duas bocas uma sobre a
 * outra, a de cima mais ao fundo, cada uma com a cortina de enrolar meio baixada e, ocupada, a luz de dentro, o número em néon sobre a boca e
 * a escadinha entre as colunas.
 */
function capsulasDeHotel(seed: number, colunas: number, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], w = 1.15, C = colunas * w, D = 2.1, yb = -0.15, yF = yb + D / 2;
  const casca = tonsDe(['#d8d4c8', '#c8ccd0', '#2a2c34'][Math.floor(r() * 3)]!), n = NEONS[[0, 3, 1][Math.floor(r() * 3)]!]!;
  sombraNoChao(partes, retQ(ID, 0, 0, C + 0.05, D + 0.5), 0.01, '#0a0a0c', 0.45);
  if (aceso) partes.push(elipse(0, yF + 0.45, C + 0.3, 0.9, '#3a2a14', 0.01, { ...O, brilho: true, alfa: 0.5, desfoque: 0.15, detalhe: 1 }));
  for (let k = 0; k < colunas; k++) {
    const u = -C / 2 + w * (k + 0.5);
    partes.push(poli(retR(ID, u + 0.012, yb + 0.014, w + 0.02, D + 0.02, 0.18), casca.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    partes.push(poli(retR(ID, u, yb, w - 0.03, D - 0.02, 0.16), casca.base, 1.452, { ...O, detalhe: 1 }));
    partes.push(poli(retR(ID, u - 0.06, yb - 0.04, w - 0.3, D - 0.3, 0.12), casca.luz, 1.454, { ...S, alfa: 0.7, detalhe: 2 }));
    for (let j = 1; j < 5; j++) partes.push(tira([u - w / 2 + 0.08, yb - D / 2 + (D * j) / 5, u + w / 2 - 0.08, yb - D / 2 + (D * j) / 5], 0.012, casca.sombra, 1.456, { ...O, alfa: 0.6, detalhe: 3 }));
    for (let j = 0; j < 5; j++) partes.push(tira([u - 0.2, yb - D / 2 + 0.3 + j * 0.04, u + 0.2, yb - D / 2 + 0.3 + j * 0.04], 0.012, casca.nanquim, 1.458, { ...O, alfa: 0.6, detalhe: 3 }));
    partes.push(poli(retQ(ID, u + 0.3, yb + 0.5, 0.18, 0.1), casca.sombra, 1.458, { ...O, detalhe: 3 }));
  }
  // A frente: a faixa da casca com as duas bocas por coluna.
  const yC = yF + 0.16, yB = yF + 0.47, hB = 0.28;
  partes.push(poli(retQ(ID, 0, (yF + yB + hB / 2) / 2, C, yB + hB / 2 - yF + 0.02), casca.sombra, 1.1, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < colunas; k++) {
    const u = -C / 2 + w * (k + 0.5);
    for (const [y, z] of [[yC, 1.32], [yB, 1.2]] as const) {
      const ocupada = aceso && r() < 0.65, baixa = 0.25 + r() * 0.6;
      partes.push(poli(retR(ID, u, y, w - 0.18, hB, 0.05), casca.nanquim, z, { contorno: 'leve', detalhe: 1 }));
      partes.push(poli(retR(ID, u, y, w - 0.24, hB - 0.04, 0.04), ocupada ? '#4a3014' : '#14161c', z + 0.002, { ...O, brilho: ocupada, detalhe: 2 }));
      partes.push(poli(retQ(ID, u, y + hB / 2 - 0.06, w - 0.3, 0.05), ocupada ? '#e8d8b8' : '#8a8478', z + 0.003, { contorno: 'leve', detalhe: 3 }));
      if (ocupada) partes.push(poli(retQ(ID, u - 0.05, y + 0.03, w * 0.5, hB * 0.3), '#e8d0a0', z + 0.003, { ...S, alfa: 0.4, detalhe: 3 }));
      const hc = (hB - 0.04) * baixa;
      partes.push(poli(retQ(ID, u, y - (hB - 0.04) / 2 + hc / 2, w - 0.24, hc), '#4a6a9a', z + 0.004, { contorno: 'leve', detalhe: 2 }));
      for (let j = 1; j * 0.02 < hc; j++) partes.push(tira([u - (w - 0.26) / 2, y - (hB - 0.04) / 2 + j * 0.02, u + (w - 0.26) / 2, y - (hB - 0.04) / 2 + j * 0.02], 0.004, '#2a3a5a', z + 0.005, { ...O, alfa: 0.6, detalhe: 3 }));
      const num = String(k * 2 + (y === yB ? 1 : 2)).padStart(2, '0');
      for (let i = 0; i < num.length; i++) for (const tr of letra(mulberry32(seed + k * 7 + i + (y === yB ? 3 : 0)))) partes.push(tira(levar(tr, u + w / 2 - 0.16 + i * 0.05, y - hB / 2 - 0.0, 0.035, 0.03), 0.006, aceso ? n.nucleo : '#3a3c44', z + 0.006, { ...O, brilho: aceso, detalhe: 3 }));
    }
    // A escadinha da cápsula de cima, na ponta da coluna.
    const ex = u - w / 2 + 0.06;
    for (const dx of [-0.03, 0.03]) partes.push(tira([ex + dx, yC - hB / 2, ex + dx, yB + hB / 2 + 0.08], 0.012, ACO.luz, 1.34, { contorno: 'leve', detalhe: 3 }));
    for (let j = 0; j < 4; j++) partes.push(tira([ex - 0.03, yC + j * 0.1, ex + 0.03, yC + j * 0.1], 0.01, ACO.base, 1.341, { ...O, detalhe: 3 }));
  }
  return partes;
}

/**
 * Gaiola de cabos: o cercado de tela losangular (C × P), com os montantes de aço, o teto também de tela e a porta da frente (+y) com o cadeado
 * e a placa de perigo; dentro, os rolos de cabo, os feixes que entram pelo fundo (−y), o armário de junção com os leds e as caixas.
 */
function gaiolaDeCabos(seed: number, C: number, P: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], u = C / 2, v = P / 2, zT = 1.5;
  sombraNoChao(partes, retQ(ID, 0, 0, C + 0.05, P + 0.05), 0.01, '#0a0a0c', 0.35);
  partes.push(poli(retQ(ID, 0, 0, C - 0.04, P - 0.04), '#000000', 0.011, { ...S, alfa: 0.25, detalhe: 1 }));
  // Os feixes que entram pelo fundo e se espalham.
  for (let k = 0; k < 8; k++) {
    const x0 = -u * 0.6 + r() * u * 1.2, x1 = -u + 0.2 + r() * (C - 0.4), y1 = -v + 0.3 + r() * (P - 0.6);
    partes.push(tira([x0, -v - 0.15, x0 + (r() - 0.5) * 0.2, -v + 0.2, (x0 + x1) / 2 + (r() - 0.5) * 0.4, (y1 - v) / 2, x1, y1], 0.025 + r() * 0.015, CABOS[Math.floor(r() * CABOS.length)]!, 0.05 + k * 0.002, { contorno: 'leve', detalhe: 2 }));
  }
  // Os rolos de cabo, o armário de junção e as caixas.
  for (let k = 0; k < Math.max(2, Math.round(C * P * 0.5)); k++) {
    const x = -u + 0.35 + r() * (C - 0.7), y = -v + 0.35 + r() * (P - 0.7), R = 0.18 + r() * 0.12, cor = ['#2a2a2e', '#3a3a3e', '#4a1a16', '#1e2e4a', '#5a4a1a'][Math.floor(r() * 5)]!;
    disco(partes, x, y, R, tonsDe(cor), 0.25 + k * 0.01);
    for (let j = 1; j < 4; j++) partes.push(tira(anel(x, y, R * (0.3 + j * 0.17), R * (0.3 + j * 0.17), 18), 0.008, '#000000', 0.27 + k * 0.01, { ...O, alfa: 0.35, detalhe: 3 }));
    partes.push(elipse(x, y, R * 0.45, R * 0.45, '#0a0a0c', 0.275 + k * 0.01, { ...O, detalhe: 3 }));
  }
  const jx = -u + 0.35, jy = -v + 0.25;
  bloco(partes, quadro(jx, jy), 0.5, 0.3, tonsDe('#5a6268'), 1.2, 0.02);
  leds(partes, r, jx - 0.18, jx + 0.18, jy + 0.12, 1.23, true, 6);
  for (let k = 0; k < 2; k++) bloco(partes, quadro(u - 0.4 - k * 0.1, v - 0.35 - k * 0.32, (r() - 0.5) * 0.4), 0.45, 0.32, tonsDe('#6a5a3a'), 0.4 + k * 0.35, 0.02);
  // A tela losangular do teto (e, por baixo dela, a das paredes, vista de cima como a borda).
  const p = 0.13, malha = { ...O, alfa: 0.38, detalhe: 3 as const };
  for (let c = -u - v; c <= u + v; c += p) {
    const a0 = Math.max(-u, -v - c), a1 = Math.min(u, v - c);
    if (a1 - a0 > 0.02) partes.push(tira([a0, a0 + c, a1, a1 + c], 0.008, '#b8bcc0', zT, malha));
    const b0 = Math.max(-u, c - v), b1 = Math.min(u, c + v);
    if (b1 - b0 > 0.02) partes.push(tira([b0, c - b0, b1, c - b1], 0.008, '#8a8e92', zT + 0.001, malha));
  }
  // O quadro do teto, os montantes e a porta.
  partes.push(tira([-u, -v, u, -v, u, v, -u, v, -u, -v], 0.04, ACO.sombra, zT + 0.005, { contorno: 'leve', detalhe: 2 }), tira([-u, v, -u, -v, u, -v], 0.016, ACO.brilho, zT + 0.006, { ...O, alfa: 0.7, detalhe: 3 }));
  const nx = Math.max(1, Math.round(C / 1.2)), ny = Math.max(1, Math.round(P / 1.2));
  for (let i = 0; i <= nx; i++) for (const y of [-v, v]) disco(partes, -u + (C * i) / nx, y, 0.035, ACO, zT + 0.007);
  for (let j = 1; j < ny; j++) for (const x of [-u, u]) disco(partes, x, -v + (P * j) / ny, 0.035, ACO, zT + 0.007);
  const dx = Math.min(u - 0.5, 0.4);
  partes.push(tira([dx - 0.45, v, dx + 0.45, v], 0.05, ACO.base, zT + 0.008, { contorno: 'leve', detalhe: 2 }));
  partes.push(tira([dx + 0.45, v + 0.02, dx + 0.47, v + 0.09, dx + 0.43, v + 0.09], 0.016, '#c8a020', zT + 0.01, { contorno: 'leve', detalhe: 3 }));
  partes.push(poli([dx - 0.12, v + 0.14, dx + 0.12, v + 0.14, dx, v - 0.06], '#d0a018', zT + 0.009, { contorno: 'leve', detalhe: 3 }), tira([dx + 0.01, v - 0.01, dx - 0.025, v + 0.05, dx + 0.02, v + 0.05, dx - 0.01, v + 0.11], 0.012, '#141010', zT + 0.0095, { ...O, detalhe: 3 }));
  return partes;
}

// ---------- Receitas ----------

const CY = { tipo: 'piso' as const, generos: ['cyberpunk'], kit: 'cyberpunk' };
const campoCor = (padrao: number) => ({ id: 'cor', rotulo: 'Cor (0 ciano, 1 magenta, 2 verde, 3 âmbar, 4 vermelho, 5 violeta)', tipo: 'numero' as const, padrao, min: 0, max: 5, passo: 1 });
const ACESO = { id: 'aceso', rotulo: 'Aceso (0 não, 1 sim)', tipo: 'numero' as const, padrao: 1, min: 0, max: 1, passo: 1 };
const FORMA_DO_LETREIRO = { id: 'forma', rotulo: 'Desenho (0 só letras, 1 seta, 2 tigela, 3 olho, 4 taça, 5 cruz)', tipo: 'numero' as const, padrao: 0, min: 0, max: 5, passo: 1 };
const forma = (params: Record<string, unknown>, max: number): number => Math.round(num({ seed: 0, params }, 'forma', 0, 0, max));
const luzDeNeon = (padrao: number, raio: number, intensidade: number, campo = 'aceso') => (params: Record<string, unknown>): LuzDeReceita | null =>
  (ligado(params, campo, 1) ? { raio, cor: corDe(params, padrao).luz, intensidade, power: 'grid', flicker: 0.06 } : null);
const tagsDeLetreiro = ['letreiro', 'neon', 'placa', 'anuncio', 'luz', 'bar', 'loja', 'cyberpunk'];

export const RECEITAS_CYBERPUNK: Receita[] = [
  { id: 'letreiro-neon', nome: 'Letreiro de néon', categoria: 'parede', tipo: 'parede', generos: ['cyberpunk', 'moderno'], kit: 'cyberpunk', funcoes: ['bar', 'loja', 'lanchonete', 'clinica-clandestina', 'hotel-capsula', 'mercado', 'corredor'], tags: tagsDeLetreiro, pegada: [1.4, 0.05],
    campos: [campoCor(1), FORMA_DO_LETREIRO, ACESO], luz: luzDeNeon(1, 4, 0.8),
    gerar: p => { const d = letreiroDeParede(p.seed, corDe(p.params, 1), forma(p.params, 5), ligado(p.params, 'aceso', 1)); return parede(1.4, d.face, d.topo); } },
  { id: 'letreiro-neon.rua', nome: 'Letreiro de néon de fachada', categoria: 'exterior', ...CY, generos: ['cyberpunk', 'moderno'], funcoes: ['rua', 'beco', 'mercado-noturno', 'bar', 'loja'], tags: [...tagsDeLetreiro, 'fachada', 'rua', 'beco'], pegada: [1.6, 1.1], altura: 3,
    campos: [campoCor(1), FORMA_DO_LETREIRO, ACESO], luz: luzDeNeon(1, 4.5, 0.85),
    gerar: p => piso([1.6, 1.1], letreiroDeRua(p.seed, corDe(p.params, 1), forma(p.params, 5), ligado(p.params, 'aceso', 1))) },
  { id: 'holograma', nome: 'Holograma', categoria: 'decoracao', ...CY, generos: ['cyberpunk', 'ficcao-cientifica'], funcoes: ['rua', 'beco', 'bar', 'recepcao', 'mercado-noturno', 'hotel-capsula', 'loja'], tags: ['holograma', 'projecao', 'projetor', 'luz', 'anuncio', 'dancarina', 'carpa', 'cyberpunk'], pegada: [1.2, 1.3], altura: 2.2,
    campos: [campoCor(0), { id: 'forma', rotulo: 'Figura (0 dançarina, 1 losango, 2 carpa)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }, ACESO], luz: luzDeNeon(0, 3, 0.55),
    gerar: p => piso([1.2, 1.3], holograma(p.seed, corDe(p.params, 0), forma(p.params, 2), ligado(p.params, 'aceso', 1))) },
  { id: 'barraca-de-lamen', nome: 'Barraca de lámen', categoria: 'exterior', ...CY, funcoes: ['rua', 'beco', 'mercado-noturno', 'praca'], tags: ['barraca', 'lamen', 'ramen', 'comida', 'toldo', 'balcao', 'lanterna', 'banqueta', 'rua', 'cyberpunk'], pegada: [2.6, 2.2], altura: 2.6,
    campos: [ACESO], luz: (params) => (ligado(params, 'aceso', 1) ? { raio: 4.5, cor: '#ffb070', intensidade: 0.75, power: 'grid', flicker: 0.04 } : null),
    gerar: p => piso([2.6, 2.2], barracaDeLamen(p.seed, ligado(p.params, 'aceso', 1))) },
  { id: 'drone', nome: 'Drone', categoria: 'exterior', ...CY, generos: ['cyberpunk', 'moderno', 'ficcao-cientifica'], funcoes: ['rua', 'beco', 'mercado-noturno', 'sala-de-servidores', 'delegacia'], tags: ['drone', 'quadricoptero', 'vigilancia', 'camera', 'voo', 'rotor', 'cyberpunk'], pegada: [0.95, 0.95], altura: 0.3,
    campos: [{ id: 'holofote', rotulo: 'Holofote (0 apagado, 1 aceso)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    luz: (params) => (ligado(params, 'holofote') ? { raio: 3, cor: '#e8f0ff', intensidade: 0.6, power: 'battery', flicker: 0 } : null),
    gerar: p => piso([0.95, 0.95], drone(p.seed, ligado(p.params, 'holofote'))) },
  { id: 'antena-parabolica', nome: 'Antena parabólica', categoria: 'exterior', ...CY, generos: ['cyberpunk', 'moderno', 'pos-apocaliptico'], funcoes: ['laje', 'telhado', 'patio', 'rua', 'sala-de-servidores'], tags: ['antena', 'parabolica', 'satelite', 'prato', 'laje', 'cyberpunk', 'moderno'], pegada: [1.4, 1.4], altura: 1.4,
    campos: [{ id: 'diametro', rotulo: 'Diâmetro do prato (m)', tipo: 'numero', padrao: 1.2, min: 0.6, max: 3, passo: 0.1 }],
    gerar: p => { const D = num(p, 'diametro', 1.2, 0.6, 3); return piso([D + 0.2, D + 0.2], antenaParabolica(p.seed, D)); } },
  { id: 'quadro-de-cabos', nome: 'Quadro de cabos', categoria: 'exterior', ...CY, generos: ['cyberpunk', 'moderno', 'pos-apocaliptico'], funcoes: ['rua', 'beco', 'sala-de-servidores', 'oficina', 'garagem', 'corredor'], tags: ['quadro', 'cabos', 'fios', 'eletrico', 'gambiarra', 'parede', 'rua', 'beco', 'cyberpunk'], pegada: [1.7, 0.8], altura: 1.6,
    gerar: p => piso([1.7, 0.8], quadroDeCabos(p.seed)) },
  { id: 'poste-com-telas', nome: 'Poste com telas', categoria: 'exterior', ...CY, funcoes: ['rua', 'beco', 'mercado-noturno', 'praca'], tags: ['poste', 'tela', 'telao', 'anuncio', 'propaganda', 'camera', 'cabos', 'luz', 'rua', 'cyberpunk'], pegada: [1.8, 1.3], altura: 5,
    campos: [campoCor(0), { id: 'acesa', rotulo: 'Telas acesas (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }], luz: luzDeNeon(0, 4.5, 0.7, 'acesa'),
    gerar: p => piso([1.8, 1.3], posteComTelas(p.seed, corDe(p.params, 0), ligado(p.params, 'acesa', 1))) },
  { id: 'maquina-de-venda.neon', nome: 'Máquina de venda de néon', categoria: 'decoracao', ...CY, funcoes: ['corredor', 'rua', 'beco', 'bar', 'hotel-capsula', 'mercado-noturno', 'lanchonete'], tags: ['maquina', 'venda', 'neon', 'automatica', 'luz', 'rua', 'cyberpunk'], pegada: [1.0, 1.1], altura: 1.9,
    campos: [campoCor(5), { id: 'acesa', rotulo: 'Acesa (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }], luz: luzDeNeon(5, 2.6, 0.55, 'acesa'),
    gerar: p => piso([1.0, 1.1], maquinaDeNeon(p.seed, ligado(p.params, 'acesa', 1), corDe(p.params, 5))) },
  { id: 'estacao-hacker', nome: 'Estação hacker', categoria: 'mesas', ...CY, funcoes: ['sala-de-servidores', 'quarto', 'escritorio', 'esconderijo', 'loja', 'hotel-capsula'], tags: ['estacao', 'hacker', 'computador', 'telas', 'monitor', 'mesa', 'teclado', 'codigo', 'cyberpunk'], pegada: [2.3, 1.5], altura: 1.4,
    campos: [campoCor(0), { id: 'telas', rotulo: 'Telas', tipo: 'numero', padrao: 4, min: 2, max: 6, passo: 1 }, { id: 'acesa', rotulo: 'Telas acesas (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }], luz: luzDeNeon(0, 2.8, 0.6, 'acesa'),
    gerar: p => piso([2.3, 1.5], estacaoHacker(p.seed, Math.round(num(p, 'telas', 4, 2, 6)), corDe(p.params, 0), ligado(p.params, 'acesa', 1))) },
  { id: 'cadeira-de-implante', nome: 'Cadeira de implante', categoria: 'assentos', ...CY, generos: ['cyberpunk', 'ficcao-cientifica'], funcoes: ['clinica-clandestina', 'hospital', 'enfermaria', 'laboratorio'], tags: ['cadeira', 'implante', 'cirurgia', 'clinica', 'braco-robotico', 'foco', 'medico', 'cromo', 'cyberpunk'], pegada: [1.6, 2.3], altura: 1.9,
    campos: [{ id: 'acesa', rotulo: 'Foco aceso (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: (params) => (ligado(params, 'acesa', 1) ? { raio: 2.6, cor: '#dceaff', intensidade: 0.65, power: 'grid', flicker: 0.02 } : null),
    gerar: p => piso([1.6, 2.3], cadeiraDeImplante(p.seed, ligado(p.params, 'acesa', 1))) },
  { id: 'rack-de-servidores', nome: 'Rack de servidores', categoria: 'armazenamento', ...CY, generos: ['cyberpunk', 'moderno', 'ficcao-cientifica'], funcoes: ['sala-de-servidores', 'escritorio', 'laboratorio', 'deposito', 'sala-de-maquinas'], tags: ['rack', 'servidor', 'servidores', 'computador', 'leds', 'datacenter', 'cabos', 'cyberpunk'], pegada: [1.5, 1.5], altura: 2,
    campos: [{ id: 'racks', rotulo: 'Racks lado a lado', tipo: 'numero', padrao: 2, min: 1, max: 4, passo: 1 }, { id: 'ligado', rotulo: 'Ligado (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: (params) => (ligado(params, 'ligado', 1) ? { raio: 2.2, cor: '#5ac8ff', intensidade: 0.4, power: 'grid', flicker: 0.03 } : null),
    gerar: p => { const n = Math.round(num(p, 'racks', 2, 1, 4)); return piso([n * 0.6 + 0.3, 1.5], rackDeServidores(p.seed, n, ligado(p.params, 'ligado', 1))); } },
  { id: 'fliperama', nome: 'Fliperama', categoria: 'decoracao', ...CY, generos: ['cyberpunk', 'moderno'], funcoes: ['bar', 'lanchonete', 'loja', 'fliperama', 'sala', 'hotel-capsula'], tags: ['fliperama', 'arcade', 'jogo', 'videogame', 'maquina', 'tela', 'luz', 'cyberpunk'], pegada: [1.0, 1.1], altura: 1.8,
    campos: [campoCor(1), ACESO], luz: luzDeNeon(1, 2.2, 0.5),
    gerar: p => piso([1.0, 1.1], fliperama(p.seed, corDe(p.params, 1), ligado(p.params, 'aceso', 1))) },
  { id: 'balcao-luminoso', nome: 'Balcão luminoso', categoria: 'mesas', ...CY, funcoes: ['bar', 'lanchonete', 'recepcao', 'hotel-capsula', 'loja', 'boate'], tags: ['balcao', 'bar', 'luminoso', 'neon', 'copos', 'garrafas', 'banqueta', 'chope', 'cyberpunk'], pegada: [3.1, 1.5], altura: 1.1,
    campos: [campoCor(5), { id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 3, min: 1.5, max: 6, passo: 0.5 }, ACESO],
    luz: (params) => { const C = num({ seed: 0, params }, 'comprimento', 3, 1.5, 6); return ligado(params, 'aceso', 1) ? { raio: 2.5 + C * 0.5, cor: corDe(params, 5).luz, intensidade: 0.6, power: 'grid', flicker: 0.04 } : null; },
    gerar: p => { const C = num(p, 'comprimento', 3, 1.5, 6); return piso([C + 0.1, 1.5], balcaoLuminoso(p.seed, C, corDe(p.params, 5), ligado(p.params, 'aceso', 1))); } },
  { id: 'capsula-de-hotel', nome: 'Cápsulas de hotel', categoria: 'camas', ...CY, generos: ['cyberpunk', 'ficcao-cientifica'], funcoes: ['hotel-capsula', 'dormitorio', 'quarto', 'cabine'], tags: ['capsula', 'hotel', 'cama', 'dormir', 'pilha', 'beliche', 'alojamento', 'cyberpunk'], pegada: [2.4, 2.6], altura: 2.2,
    campos: [{ id: 'colunas', rotulo: 'Colunas de cápsulas', tipo: 'numero', padrao: 2, min: 1, max: 4, passo: 1 }, ACESO],
    luz: (params) => { const n = Math.round(num({ seed: 0, params }, 'colunas', 2, 1, 4)); return ligado(params, 'aceso', 1) ? { raio: 1.8 + n * 0.6, cor: '#ffc890', intensidade: 0.45, power: 'grid', flicker: 0.02 } : null; },
    gerar: p => { const n = Math.round(num(p, 'colunas', 2, 1, 4)); return piso([n * 1.15 + 0.1, 2.6], capsulasDeHotel(p.seed, n, ligado(p.params, 'aceso', 1))); } },
  { id: 'gaiola-de-cabos', nome: 'Gaiola de cabos', categoria: 'armazenamento', ...CY, generos: ['cyberpunk', 'moderno', 'pos-apocaliptico'], funcoes: ['sala-de-servidores', 'deposito', 'beco', 'garagem', 'oficina', 'sala-de-maquinas'], tags: ['gaiola', 'cabos', 'tela', 'alambrado', 'cercado', 'rolo', 'eletrico', 'cyberpunk'], pegada: [2.5, 2], altura: 2.2,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 2.4, min: 1.5, max: 5, passo: 0.1 }, { id: 'profundidade', rotulo: 'Profundidade (m)', tipo: 'numero', padrao: 1.8, min: 1, max: 3, passo: 0.1 }],
    gerar: p => { const C = num(p, 'comprimento', 2.4, 1.5, 5), P = num(p, 'profundidade', 1.8, 1, 3); return piso([C + 0.1, P + 0.3], gaiolaDeCabos(p.seed, C, P)); } },
];
