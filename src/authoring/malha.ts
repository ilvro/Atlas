import type { MapaAtlas } from '../domain/mapa.ts';
import { caixaDoObjeto, type Caixa, type InsightDoComodo } from './insight.ts';

export const RES_MALHA = 0.25, LARGURA_DE_PASSAGEM = 0.75;
const EPS = 1e-6;

/** Uma malha de 0,25 m sobre a caixa do cômodo: a célula do cômodo (1,5 m) é grossa demais para decidir onde cabe um móvel. */
export interface Malha {
  res: number; x0: number; y0: number; colunas: number; linhas: number;
  /** 1 onde a sub-célula está dentro do cômodo. */
  dentro: Uint8Array;
  /** 1 onde há móvel que bloqueia. */
  ocupada: Uint8Array;
  /** 1 na frente das portas: precisa ficar livre. */
  porta: Uint8Array;
}

export const indiceNaMalha = (malha: Malha, c: number, l: number): number => l * malha.colunas + c;

/** Cria a malha do cômodo: o que está dentro, os móveis que bloqueiam e a área na frente de cada porta. */
export function malhaDoComodo(m: MapaAtlas, ins: InsightDoComodo): Malha {
  const res = RES_MALHA, { x0, y0, x1, y1 } = ins.caixa, t = m.grid.size, [ox, oy] = m.grid.offset;
  const colunas = Math.max(1, Math.ceil((x1 - x0) / res - EPS)), linhas = Math.max(1, Math.ceil((y1 - y0) / res - EPS));
  const malha: Malha = { res, x0, y0, colunas, linhas, dentro: new Uint8Array(colunas * linhas), ocupada: new Uint8Array(colunas * linhas), porta: new Uint8Array(colunas * linhas) };
  const minhas = new Set(ins.celulas.map(([x, y]) => y * 200_003 + x));
  for (let l = 0; l < linhas; l++) for (let c = 0; c < colunas; c++) {
    const cx = x0 + (c + 0.5) * res, cy = y0 + (l + 0.5) * res;
    if (minhas.has(Math.floor((cy - oy) / t) * 200_003 + Math.floor((cx - ox) / t))) malha.dentro[indiceNaMalha(malha, c, l)] = 1;
  }
  // Móveis de piso que bloqueiam (tapetes e o que está sobre mesas ou nas paredes não contam).
  for (const o of ins.objetos) {
    const obj = m.props[o.id]; if (!obj || obj.elevation !== 'floor' || !obj.blocks.move) continue;
    marcarRetangulo(malha, caixaDoObjeto(obj), 'ocupada');
  }
  for (const p of ins.portas) {
    const [nx, ny] = p.normal, meio = p.largura / 2;
    for (const lado of [1, -1]) {
      const cx = p.centro[0] + nx * meio * lado, cy = p.centro[1] + ny * meio * lado;
      marcarRetangulo(malha, { x0: cx - meio, y0: cy - meio, x1: cx + meio, y1: cy + meio }, 'porta');
    }
  }
  return malha;
}

/** Faixa de sub-células que a caixa (com `folga` em volta) toca, já cortada nos limites da malha. */
function faixaDe(malha: Malha, caixa: Caixa, folga: number): [number, number, number, number] {
  const r = malha.res;
  const c0 = Math.floor((caixa.x0 - folga - malha.x0) / r + EPS), c1 = Math.ceil((caixa.x1 + folga - malha.x0) / r - EPS) - 1;
  const l0 = Math.floor((caixa.y0 - folga - malha.y0) / r + EPS), l1 = Math.ceil((caixa.y1 + folga - malha.y0) / r - EPS) - 1;
  return [Math.max(0, c0), Math.min(malha.colunas - 1, c1), Math.max(0, l0), Math.min(malha.linhas - 1, l1)];
}

export function marcarRetangulo(malha: Malha, caixa: Caixa, camada: 'ocupada' | 'porta', folga = 0): void {
  const [c0, c1, l0, l1] = faixaDe(malha, caixa, folga), alvo = malha[camada];
  for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) alvo[indiceNaMalha(malha, c, l)] = 1;
}

/** A caixa cabe inteira dentro do cômodo, sem tocar nenhuma das camadas a evitar? */
export function retanguloLivre(malha: Malha, caixa: Caixa, evitar: readonly Uint8Array[]): boolean {
  const r = malha.res;
  // Fora da caixa do cômodo, ou saindo dela: não cabe.
  if (caixa.x0 < malha.x0 - EPS || caixa.y0 < malha.y0 - EPS || caixa.x1 > malha.x0 + malha.colunas * r + EPS || caixa.y1 > malha.y0 + malha.linhas * r + EPS) return false;
  const [c0, c1, l0, l1] = faixaDe(malha, caixa, 0);
  for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) {
    const i = indiceNaMalha(malha, c, l);
    if (!malha.dentro[i]) return false;
    for (const camada of evitar) if (camada[i]) return false;
  }
  return true;
}

export interface Circulacao {
  /** Todas as portas se alcançam (ou há uma porta só e ela alcança o meio do cômodo). */
  ligada: boolean;
  /** Portas que não alcançam as outras. */
  isoladas: string[];
  /** Faixa de passagem: os caminhos entre as portas, alargados para LARGURA_DE_PASSAGEM. */
  faixa: Uint8Array;
}

const VIZINHOS: readonly [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** Por onde se passa entre as portas, andando só sobre o que está dentro e livre. */
export function circulacao(malha: Malha, ins: InsightDoComodo): Circulacao {
  const faixa = new Uint8Array(malha.colunas * malha.linhas);
  if (!ins.portas.length) return { ligada: true, isoladas: [], faixa };
  const livre = (i: number) => malha.dentro[i] === 1 && malha.ocupada[i] === 0;
  const celulaDe = (x: number, y: number): [number, number] => [Math.floor((x - malha.x0) / malha.res), Math.floor((y - malha.y0) / malha.res)];
  const dentroDaMalha = (c: number, l: number) => c >= 0 && l >= 0 && c < malha.colunas && l < malha.linhas;

  // A entrada de cada porta: um passo para dentro do cômodo.
  const entradas = ins.portas.map(p => { const [c, l] = celulaDe(p.centro[0] + p.normal[0] * 0.2, p.centro[1] + p.normal[1] * 0.2); return dentroDaMalha(c, l) && livre(indiceNaMalha(malha, c, l)) ? indiceNaMalha(malha, c, l) : -1; });
  // Componentes conexos dos livres.
  const rotulo = new Int32Array(malha.colunas * malha.linhas).fill(-1); let n = 0;
  const inundar = (inicio: number, id: number) => {
    const fila = [inicio]; rotulo[inicio] = id;
    for (let k = 0; k < fila.length; k++) {
      const i = fila[k]!, c = i % malha.colunas, l = Math.floor(i / malha.colunas);
      for (const [dc, dl] of VIZINHOS) {
        const cc = c + dc, ll = l + dl; if (!dentroDaMalha(cc, ll)) continue;
        const j = indiceNaMalha(malha, cc, ll); if (rotulo[j] !== -1 || !livre(j)) continue;
        rotulo[j] = id; fila.push(j);
      }
    }
  };
  for (const e of entradas) if (e >= 0 && rotulo[e] === -1) inundar(e, n++);

  // Com uma porta só, o destino é a sub-célula livre mais perto do meio da caixa.
  const meio: [number, number] = [(ins.caixa.x0 + ins.caixa.x1) / 2, (ins.caixa.y0 + ins.caixa.y1) / 2];
  let alvoUnico = -1, alcancaMeio = true;
  if (ins.portas.length === 1 && entradas[0]! >= 0) {
    let melhor = Infinity;
    for (let i = 0; i < rotulo.length; i++) if (livre(i)) {
      const cx = malha.x0 + ((i % malha.colunas) + 0.5) * malha.res, cy = malha.y0 + (Math.floor(i / malha.colunas) + 0.5) * malha.res, d = Math.hypot(cx - meio[0], cy - meio[1]);
      if (d < melhor) { melhor = d; alvoUnico = i; }
    }
    // O meio do cômodo é livre mas fica numa região que a porta não alcança (ex.: cercada por móveis).
    alcancaMeio = alvoUnico >= 0 && rotulo[alvoUnico] === rotulo[entradas[0]!];
  }
  // Portas por componente; o maior grupo é "o resto da casa", e quem ficou fora está isolada.
  const grupos = new Map<number, string[]>();
  ins.portas.forEach((p, k) => { const g = entradas[k]! >= 0 ? rotulo[entradas[k]!]! : -1 - k; grupos.set(g, [...(grupos.get(g) ?? []), p.id]); });
  const maior = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)[0]![0];
  const isoladas = ins.portas.length === 1 ? (entradas[0]! >= 0 && alcancaMeio ? [] : [ins.portas[0]!.id]) : ins.portas.filter(p => !grupos.get(maior)!.includes(p.id)).map(p => p.id);

  // Caminhos: do alvo (a porta de referência, ou o meio) de volta às outras entradas, seguindo os pais da inundação.
  const raiz = ins.portas.length === 1 ? alvoUnico : entradas[ins.portas.findIndex(p => grupos.get(maior)!.includes(p.id))]!;
  const caminhos: number[] = [];
  const entradasDoGrupo = ins.portas.length === 1 ? [entradas[0]!] : entradas.filter((e, k) => e >= 0 && grupos.get(maior)!.includes(ins.portas[k]!.id));
  if (raiz >= 0) {
    // Refaz a árvore de busca a partir da raiz, para os caminhos saírem dela.
    const dist = new Int32Array(rotulo.length).fill(-1), de = new Int32Array(rotulo.length).fill(-1), fila = [raiz]; dist[raiz] = 0;
    for (let k = 0; k < fila.length; k++) {
      const i = fila[k]!, c = i % malha.colunas, l = Math.floor(i / malha.colunas);
      for (const [dc, dl] of VIZINHOS) { const cc = c + dc, ll = l + dl; if (!dentroDaMalha(cc, ll)) continue; const j = indiceNaMalha(malha, cc, ll); if (dist[j] !== -1 || !livre(j)) continue; dist[j] = dist[i]! + 1; de[j] = i; fila.push(j); }
    }
    for (const e of entradasDoGrupo) for (let i = e; i !== -1 && dist[i] !== -1; i = de[i]!) caminhos.push(i);
  }
  const r = Math.ceil((LARGURA_DE_PASSAGEM / malha.res - 1) / 2);
  for (const i of caminhos) {
    const c = i % malha.colunas, l = Math.floor(i / malha.colunas);
    for (let dl = -r; dl <= r; dl++) for (let dc = -r; dc <= r; dc++) { const cc = c + dc, ll = l + dl; if (dentroDaMalha(cc, ll) && malha.dentro[indiceNaMalha(malha, cc, ll)]) faixa[indiceNaMalha(malha, cc, ll)] = 1; }
  }
  return { ligada: isoladas.length === 0, isoladas, faixa };
}
