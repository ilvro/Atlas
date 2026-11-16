/**
 * Relevo em patamares: consulta de altitude por célula/ponto com cache WeakMap,
 * extração de bordas e degraus por altitude distinta e derivação automática das escarpas.
 */
import { materialDe } from '../procedural/materiais.ts';
import { codificar, type Faixa } from './celulas.ts';
import { contornar } from './contorno.ts';
import { limparOrfaos, PAREDE_PADRAO } from './geometria.ts';
import type { Clima, MapaAtlas, Parede, Ponto, RelevoDoTerreno } from './mapa.ts';

export const DEGRAU_TRANSPONIVEL = 1;
export const ALTITUDE_MIN = -200;
export const ALTITUDE_MAX = 200;
export const PROFUNDIDADE_DE_NEVOA = 30;
const MAX_PONTOS_POR_PAREDE = 4000;

export const idDoPatamar = (altura: number): string => `p${Math.round((altura === 0 ? 0 : altura) * 10)}`;

export interface BordaDoRelevo {
  limiar: number;
  desnivel: number;
  caminhos: Ponto[][];
  drops: ('a' | 'b')[];
}

interface GradeCacheada {
  cols: number;
  lins: number;
  alturas: Float32Array;
  distintas: number[];
}

const cache = new WeakMap<RelevoDoTerreno, GradeCacheada>();

function gradeDoRelevo(m: Pick<MapaAtlas, 'bounds' | 'terrain'>): GradeCacheada | null {
  const rel = m.terrain.relief;
  if (!rel) return null;
  const res = m.terrain.resolution || 0.25;
  const cols = Math.max(1, Math.ceil(m.bounds.width / res));
  const lins = Math.max(1, Math.ceil(m.bounds.height / res));
  const salvo = cache.get(rel);
  if (salvo && salvo.cols === cols && salvo.lins === lins) return salvo;

  const alturas = new Float32Array(cols * lins);
  for (const pat of Object.values(rel.patamares)) {
    const val = pat.altura === 0 ? 0 : pat.altura;
    for (const [y, x0, n] of pat.cells) {
      if (y < 0 || y >= lins) continue;
      const inicio = Math.max(0, x0), fim = Math.min(cols, x0 + n);
      const base = y * cols;
      for (let x = inicio; x < fim; x++) alturas[base + x] = val;
    }
  }
  const set = new Set<number>();
  for (let k = 0; k < alturas.length; k++) set.add(alturas[k]! === 0 ? 0 : alturas[k]!);
  const distintas = [...set].sort((a, b) => a - b);
  const novo: GradeCacheada = { cols, lins, alturas, distintas };
  cache.set(rel, novo);
  return novo;
}

/** Altitude em metros na célula `(i, j)` da grade do terreno; 0 fora de patamares ou limites. */
export function alturaNaCelula(m: Pick<MapaAtlas, 'bounds' | 'terrain'>, i: number, j: number): number {
  const g = gradeDoRelevo(m);
  if (!g || i < 0 || j < 0 || i >= g.cols || j >= g.lins) return 0;
  return g.alturas[j * g.cols + i]!;
}

/** Altitude em metros no ponto `(x, y)` em metros. */
export function alturaEm(m: Pick<MapaAtlas, 'bounds' | 'terrain'>, p: Ponto): number {
  const res = m.terrain.resolution || 0.25;
  return alturaNaCelula(m, Math.floor(p[0] / res), Math.floor(p[1] / res));
}

/** Altitudes distintas em ordem crescente (inclui 0 se houver célula fora de patamares). */
export function alturasDistintas(m: Pick<MapaAtlas, 'bounds' | 'terrain'>): number[] {
  const g = gradeDoRelevo(m);
  return g ? [...g.distintas] : [0];
}

function determinarDrop(m: Pick<MapaAtlas, 'bounds' | 'terrain'>, path: readonly Ponto[], limiar: number): 'a' | 'b' {
  const res = m.terrain.resolution || 0.25;
  let votosA = 0, votosB = 0;
  for (let k = 0; k + 1 < path.length; k++) {
    const a = path[k]!, b = path[k + 1]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], comp = Math.hypot(dx, dy);
    if (comp < 1e-6) continue;
    const nx = -dy / comp, ny = dx / comp;
    const mx = (a[0] + b[0]) * 0.5, my = (a[1] + b[1]) * 0.5;
    for (const passo of [res * 0.65, res * 0.35]) {
      const hA = alturaEm(m, [mx + nx * passo, my + ny * passo]);
      const hB = alturaEm(m, [mx - nx * passo, my - ny * passo]);
      if (hA < limiar && hB >= limiar) { votosA += comp; break; }
      if (hB < limiar && hA >= limiar) { votosB += comp; break; }
    }
  }
  return votosA >= votosB ? 'a' : 'b';
}

/** Bordas de contorno por degrau de altitude (de cada altitude distinta acima da menor). */
export function bordasDoRelevo(m: Pick<MapaAtlas, 'bounds' | 'terrain'>): BordaDoRelevo[] {
  const g = gradeDoRelevo(m);
  if (!g || g.distintas.length < 2) return [];
  const res = m.terrain.resolution || 0.25;
  const limite = [g.cols, g.lins] as const;
  const saida: BordaDoRelevo[] = [];

  for (let idx = 1; idx < g.distintas.length; idx++) {
    const limiar = g.distintas[idx]!;
    const desnivel = Math.round((limiar - g.distintas[idx - 1]!) * 1000) / 1000;
    const celulas: [number, number][] = [];
    for (let j = 0; j < g.lins; j++) {
      const base = j * g.cols;
      for (let i = 0; i < g.cols; i++) {
        if (g.alturas[base + i]! >= limiar) celulas.push([i, j]);
      }
    }
    const faixas: Faixa[] = codificar(celulas);
    const caminhos = contornar(faixas, res, { limite });
    if (!caminhos.length) continue;
    const drops = caminhos.map(c => determinarDrop(m, c, limiar));
    saida.push({ limiar, desnivel, caminhos, drops });
  }
  return saida;
}

/** Bordas com desnível menor que `DEGRAU_TRANSPONIVEL` (1 m): não bloqueiam passagem, só desenham degrau. */
export function degrausDoRelevo(m: Pick<MapaAtlas, 'bounds' | 'terrain'>): BordaDoRelevo[] {
  return bordasDoRelevo(m).filter(b => b.desnivel > 0 && b.desnivel < DEGRAU_TRANSPONIVEL);
}

function materialDoRelevo(m: Pick<MapaAtlas, 'terrain'>, referencia: Ponto): string {
  const res = m.terrain.resolution || 0.25;
  let melhor = 'rocha.cinza', menorDist = Infinity;
  for (const camada of Object.values(m.terrain.layers)) {
    if (materialDe(camada.material).uso !== 'macico') continue;
    for (const [y, x0, n] of camada.cells) {
      const mx = (x0 + n * 0.5) * res, my = (y + 0.5) * res;
      const d = (mx - referencia[0]) ** 2 + (my - referencia[1]) ** 2;
      if (d < menorDist) { menorDist = d; melhor = camada.material; }
    }
  }
  return melhor;
}

const sufixoDoLimiar = (limiar: number): string => {
  const n = limiar === 0 ? 0 : limiar;
  return Number.isInteger(n) ? String(n) : String(n).replace('.', '_');
};

/** Refaz as escarpas `{ kind: 'cliff', source: { reliefStep } }` derivadas do relevo para desníveis >= 1 m. */
export function atualizarEscarpasDoRelevo(m: MapaAtlas): void {
  const removidas = new Set<string>();
  for (const p of Object.values(m.walls)) {
    if (p.source && 'reliefStep' in p.source) {
      delete m.walls[p.id];
      removidas.add(p.id);
    }
  }

  for (const borda of bordasDoRelevo(m)) {
    if (borda.desnivel < DEGRAU_TRANSPONIVEL) continue;
    const prefixo = sufixoDoLimiar(borda.limiar);
    let n = 0;
    for (let k = 0; k < borda.caminhos.length; k++) {
      const anel = borda.caminhos[k]!;
      const drop = borda.drops[k] ?? 'b';
      const material = materialDoRelevo(m, anel[0]!);
      for (let a = 0; a < anel.length - 1; a += MAX_PONTOS_POR_PAREDE - 1) {
        const path = anel.slice(a, a + MAX_PONTOS_POR_PAREDE);
        if (path.length < 2) break;
        const id = `wr_${prefixo}_${n++}`;
        const parede: Parede = {
          id,
          path,
          ...structuredClone(PAREDE_PADRAO),
          height: borda.desnivel,
          material,
          kind: 'cliff',
          drop,
          blocks: { move: true, sight: false, light: false },
          source: { reliefStep: borda.limiar },
        };
        m.walls[id] = parede;
        removidas.delete(id);
      }
    }
  }

  if (!removidas.size) return;
  for (const a of Object.values(m.openings)) if (!m.walls[a.wallId]) delete m.openings[a.id];
  for (const o of Object.values(m.props)) if (o.wall && !m.walls[o.wall.wallId]) delete m.props[o.id];
  limparOrfaos(m);
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Cor de névoa de altitude: azul acinzentado (#8a9aae) misturado 50% com a luz ambiente iluminada do clima. */
export function corDaNeblinaDoRelevo(clima: Pick<Clima, 'ambient'>): string {
  const ceu = [0x6e, 0x82, 0x9c];
  const hex = clima.ambient.color;
  const itens = [1, 3, 5].map((i, idx) => {
    const amb = clamp(parseInt(hex.slice(i, i + 2), 16) * clima.ambient.intensity * 0.5, 0, 255);
    return Math.round((ceu[idx]! + amb) * 0.5);
  });
  return `#${itens.map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

/** Maior altitude do mapa (0 se não houver patamares). */
export function topoDoRelevo(m: Pick<MapaAtlas, 'bounds' | 'terrain'>): number {
  const dist = alturasDistintas(m);
  return dist.at(-1) ?? 0;
}

/** Fator normalizado de profundidade em [0, 1] abaixo do topo. */
export const fatorDeProfundidade = (altura: number, topo: number): number =>
  clamp((topo - altura) / PROFUNDIDADE_DE_NEVOA, 0, 1);

/** Cor multiplicativa Pixi para objetos abaixo do topo de relevo (escurecimento + mistura para névoa). */
export function tintDoRelevo(m: Pick<MapaAtlas, 'bounds' | 'terrain' | 'climate'>, ponto: Ponto): number {
  if (!m.terrain.relief) return 0xffffff;
  const topo = topoDoRelevo(m);
  const p = fatorDeProfundidade(alturaEm(m, ponto), topo);
  if (p <= 0.001) return 0xffffff;
  const esc = 1 - 0.6 * p;
  const alfa = 0.25 * p;
  const neblina = corDaNeblinaDoRelevo(m.climate);
  const canais = [1, 3, 5].map(i => {
    const nb = parseInt(neblina.slice(i, i + 2), 16);
    return clamp(Math.round((255 * (1 - alfa) + nb * alfa) * esc), 0, 255);
  });
  return (canais[0]! << 16) | (canais[1]! << 8) | canais[2]!;
}

/** Células a 0 m fora de patamares explícitos (usado quando topo > 0 para aplicar névoa no vale). */
export function celulasForaDePatamares(m: Pick<MapaAtlas, 'bounds' | 'terrain'>): Faixa[] {
  const g = gradeDoRelevo(m);
  if (!g) return [];
  const zeros: [number, number][] = [];
  for (let j = 0; j < g.lins; j++) {
    const base = j * g.cols;
    for (let i = 0; i < g.cols; i++) {
      if (g.alturas[base + i] === 0) zeros.push([i, j]);
    }
  }
  return codificar(zeros);
}
