import { arestasDeParede, comprimentoDaParede, pontoNaParede, salasDaAbertura, type ArestaUnitaria } from '../domain/geometria.ts';
import type { Comodo, MapaAtlas, Objeto } from '../domain/mapa.ts';
import type { EntradaDeTerreno, EntradaDoComodo } from '../procedural/assar.ts';

/** O que o desenho precisa saber de cada coisa, em dados simples: a chave do cache é o próprio JSON. */
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export interface ContextoDeEntradas { arestas: Map<string, ArestaUnitaria> }
export const contextoDeEntradas = (m: Pick<MapaAtlas, 'rooms'>): ContextoDeEntradas => ({ arestas: arestasDeParede(m) });

export function entradaDoComodo(m: MapaAtlas, sala: Comodo, ctx: ContextoDeEntradas = contextoDeEntradas(m)): EntradaDoComodo {
  const aberturas: EntradaDoComodo['aberturas'] = [], objetos: EntradaDoComodo['objetos'] = [];
  for (const a of Object.values(m.openings)) {
    if (!salasDaAbertura(m, a, ctx.arestas).includes(sala.id)) continue;
    const p = m.walls[a.wallId]!, { ponto } = pontoNaParede(p, a.at * comprimentoDaParede(p));
    aberturas.push({ tipo: a.kind, centro: [r3(ponto[0]), r3(ponto[1])], largura: a.width, material: a.material });
  }
  for (const o of Object.values(m.props) as Objeto[]) {
    if (o.elevation !== 'wall' || !o.wall || o.roomId !== sala.id || o.source.kind !== 'recipe') continue;
    const p = m.walls[o.wall.wallId]; if (!p) continue;
    const { ponto } = pontoNaParede(p, o.wall.at * comprimentoDaParede(p));
    objetos.push({ receita: o.source.recipe, params: o.source.params, seed: o.source.seed, centro: [r3(ponto[0]), r3(ponto[1])] });
  }
  aberturas.sort((a, b) => a.centro[0] - b.centro[0] || a.centro[1] - b.centro[1]); objetos.sort((a, b) => a.centro[0] - b.centro[0] || a.centro[1] - b.centro[1]);
  const alturas = Object.values(m.walls).filter(p => p.source?.roomId === sala.id).map(p => p.height);
  return {
    grade: { size: m.grid.size, offset: [m.grid.offset[0], m.grid.offset[1]] }, celulas: sala.cells, piso: sala.floor, papel: sala.wallpaper,
    estilo: sala.wallStyle ?? m.style.walls, altura: alturas.length ? Math.max(...alturas) : 2.6, aberturas, objetos,
  };
}

export function entradaDoTerreno(m: MapaAtlas): EntradaDeTerreno {
  return { largura: m.bounds.width, altura: m.bounds.height, resolucao: m.terrain.resolution, base: m.terrain.base,
    camadas: Object.values(m.terrain.layers).sort((a, b) => a.order - b.order).map(c => ({ material: c.material, celulas: c.cells })) };
}

/** Chave do cache de um objeto de piso: a mesma receita, semente e parâmetros reaproveitam o mesmo desenho. */
export function chaveDoObjeto(o: Objeto, res: number): string | null {
  if (o.elevation === 'wall' || o.source.kind !== 'recipe') return null;
  return `o|${res}|${o.source.recipe}|${o.source.seed}|${JSON.stringify(o.source.params)}`;
}
export const chaveDoComodo = (e: EntradaDoComodo, res: number): string => `c|${res}|${JSON.stringify(e)}`;
export const chaveDoTerreno = (e: EntradaDeTerreno, res: number): string => `t|${res}|${JSON.stringify(e)}`;
