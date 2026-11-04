import { codificar, decodificar, unir, type Faixa } from './celulas.ts';
import type { MapaAtlas, Ponto, Sessao } from './mapa.ts';
import { IndiceDeSegmentos, oclusores, poligonoIluminado } from './visibilidade.ts';

/** Lado de cada célula do explorado, em metros. */
export const RES_NEVOA = 0.5;

/** O que uma peça de jogador enxerga: um polígono por peça (paredes, portas fechadas e janelas bloqueiam; portas abertas e arcos deixam ver), limitado ao raio de visão. */
export function poligonosDeVisao(m: MapaAtlas): number[][] {
  // Quem pergunta várias vezes sobre o mesmo documento (névoa, telhados, explorado) paga uma vez: o resultado vale enquanto o que importa não mudar.
  if (guardado && guardado.tokens === m.tokens && guardado.walls === m.walls && guardado.openings === m.openings) return guardado.poligonos;
  const poligonos = calcularPoligonos(m);
  guardado = { tokens: m.tokens, walls: m.walls, openings: m.openings, poligonos };
  return poligonos;
}
let guardado: { tokens: MapaAtlas['tokens']; walls: MapaAtlas['walls']; openings: MapaAtlas['openings']; poligonos: number[][] } | null = null;

function calcularPoligonos(m: MapaAtlas): number[][] {
  const indice = new IndiceDeSegmentos(oclusores(m, 'visao')), saida: number[][] = [];
  for (const t of Object.values(m.tokens)) {
    if (!t.player || t.vision.radius <= 0) continue;
    const p: Ponto = [t.position[0], t.position[1]], pts = poligonoIluminado(p, indice.perto(p, t.vision.radius), t.vision.radius, null);
    if (pts.length >= 6) saida.push(pts);
  }
  return saida;
}

/** As células (de lado `res`) cujo centro está dentro de algum polígono, em faixas canônicas. */
export function celulasDosPoligonos(m: Pick<MapaAtlas, 'bounds'>, poligonos: readonly (readonly number[])[], res = RES_NEVOA): Faixa[] {
  const colunas = Math.ceil(m.bounds.width / res), linhas = Math.ceil(m.bounds.height / res), celulas: [number, number][] = [];
  for (const pts of poligonos) {
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]!); y1 = Math.max(y1, pts[i]!); }
    for (let j = Math.max(0, Math.floor(y0 / res - 0.5)); j <= Math.min(linhas - 1, Math.ceil(y1 / res - 0.5)); j++) {
      const y = (j + 0.5) * res, xs: number[] = [];
      // Cruzamentos da linha horizontal com as arestas (par-ímpar).
      for (let i = 0, k = pts.length - 2; i < pts.length; k = i, i += 2) {
        const ay = pts[k + 1]!, by = pts[i + 1]!;
        if ((ay > y) !== (by > y)) xs.push(pts[k]! + ((y - ay) / (by - ay)) * (pts[i]! - pts[k]!));
      }
      xs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < xs.length; n += 2) for (let i = Math.max(0, Math.ceil(xs[n]! / res - 0.5)); i <= Math.min(colunas - 1, Math.floor(xs[n + 1]! / res - 0.5)); i++) celulas.push([i, j]);
    }
  }
  return codificar(celulas);
}

/** Tudo o que as peças de jogador veem agora, como células do explorado. */
export const celulasVisiveis = (m: MapaAtlas, res = RES_NEVOA): Faixa[] => celulasDosPoligonos(m, poligonosDeVisao(m), res);

/** As células do explorado (de lado `res`) que cobrem os cômodos dados, que vivem na grade do mapa. */
export function celulasDosComodos(m: Pick<MapaAtlas, 'grid' | 'rooms' | 'bounds'>, ids: readonly string[], res = RES_NEVOA): Faixa[] {
  const t = m.grid.size, [ox, oy] = m.grid.offset, colunas = Math.ceil(m.bounds.width / res), linhas = Math.ceil(m.bounds.height / res), celulas: [number, number][] = [];
  for (const id of ids) for (const [cx, cy] of decodificar(m.rooms[id]?.cells ?? [])) {
    const x0 = ox + cx * t, y0 = oy + cy * t;
    for (let j = Math.max(0, Math.ceil(y0 / res - 0.5)); j <= Math.min(linhas - 1, Math.floor((y0 + t) / res - 0.5)); j++) for (let i = Math.max(0, Math.ceil(x0 / res - 0.5)); i <= Math.min(colunas - 1, Math.floor((x0 + t) / res - 0.5)); i++) celulas.push([i, j]);
  }
  return codificar(celulas);
}

/** O explorado de verdade: o que as peças já viram mais os cômodos que o mestre revelou. */
export function celulasExploradas(m: MapaAtlas): Faixa[] {
  const res = m.session.explored?.res ?? RES_NEVOA, vistas = m.session.explored?.cells ?? [], reveladas = m.session.revealed.filter(id => m.rooms[id]);
  return reveladas.length ? unir(vistas, celulasDosComodos(m, reveladas, res)) : [...vistas];
}

/** O explorado depois de somar o que as peças de jogador veem em `m` (e, se dado, o que viam antes). Nunca encolhe. */
export function exploradoAgora(m: MapaAtlas, jaViam: readonly Faixa[] = []): NonNullable<Sessao['explored']> {
  const res = m.session.explored?.res ?? RES_NEVOA;
  return { res, cells: unir(unir(m.session.explored?.cells ?? [], jaViam), celulasVisiveis(m, res)) };
}

/**
 * Os cômodos que os jogadores conhecem: algum pedaço deles, ou o que está logo fora das suas paredes, está à vista agora ou já foi explorado.
 * (De fora de uma casa vê-se a parede por fora, não o interior: é o bastante para o telhado aparecer.)
 */
export function comodosConhecidos(m: MapaAtlas): Set<string> {
  const res = m.session.explored?.res ?? RES_NEVOA, t = m.grid.size, [ox, oy] = m.grid.offset, saida = new Set<string>();
  const linhas = new Map<number, [number, number][]>();
  for (const [y, x0, n] of [...celulasVisiveis(m, res), ...celulasExploradas(m)]) { const l = linhas.get(y) ?? []; l.push([x0, x0 + n]); linhas.set(y, l); }
  const visto = (x: number, y: number) => { const i = Math.floor(x / res), l = linhas.get(Math.floor(y / res)); return !!l && l.some(([a, b]) => i >= a && i < b); };
  for (const sala of Object.values(m.rooms)) {
    for (const [cx, cy] of decodificar(sala.cells)) {
      const x = ox + (cx + 0.5) * t, y = oy + (cy + 0.5) * t, f = t / 2 + 0.3;
      if (visto(x, y) || visto(x - f, y) || visto(x + f, y) || visto(x, y - f) || visto(x, y + f)) { saida.add(sala.id); break; }
    }
  }
  return saida;
}
