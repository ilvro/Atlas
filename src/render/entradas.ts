import { arestasDeParede, comprimentoDaParede, pontoNaParede, salasDaAbertura, type ArestaUnitaria } from '../domain/geometria.ts';
import type { Comodo, MapaAtlas, Objeto } from '../domain/mapa.ts';
import { generoDe } from '../domain/presets.ts';
import { ACERVO } from '../procedural/acervo.ts';
import type { EntradaDeTerreno, EntradaDoComodo } from '../procedural/assar.ts';
import { COLECAO, RES_DA_COLECAO, type ItemDaColecao } from '../procedural/colecao.ts';
import { estiloDe, type IdDoEstilo, type OpcoesDoPixel, type TipoDeAssado } from '../procedural/estilos/index.ts';
import type { PedidoDeBake } from '../procedural/executar.ts';
import { urlDoItem } from './url-da-colecao.ts';

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
  return { largura: m.bounds.width, altura: m.bounds.height, resolucao: m.terrain.resolution, // Um fundo em textura aparece onde o terreno é 'vazio': o mesmo desenho do terreno, sem uma segunda via.
    base: m.terrain.base !== 'vazio' ? m.terrain.base : m.backdrop.kind === 'texture' && m.backdrop.material ? m.backdrop.material : 'vazio',
    camadas: Object.values(m.terrain.layers).sort((a, b) => a.order - b.order).map(c => ({ material: c.material, celulas: c.cells })) };
}

/** Chave do cache de um objeto de piso: a mesma receita, semente e parâmetros reaproveitam o mesmo desenho. */
/** px por metro de um tipo de desenho no estilo do mapa. */
export const resolucaoDe = (m: Pick<MapaAtlas, 'style' | 'grid'>, tipo: TipoDeAssado): number =>
  estiloDe(m.style.renderer).resolucao(tipo, { ppc: m.style.pixel.pixelsPerCell, celula: m.grid.size });

/** As opções do Pixel de um mapa (pixels por célula e contorno); `undefined` no Ilustrado, que não as usa. */
export const opcoesDoPixel = (m: Pick<MapaAtlas, 'style'>): OpcoesDoPixel | undefined => (m.style.renderer === 'pixel' ? { ppc: m.style.pixel.pixelsPerCell, contorno: m.style.pixel.outline } : undefined);
const sufixoDoPixel = (px?: OpcoesDoPixel): string => (px ? `|c${px.contorno ? 1 : 0}` : '');

/** Toda chave começa pelo estilo de raster: o mesmo objeto nos dois estilos são dois desenhos, e o do outro estilo fica em cache até a troca terminar. */
export function chaveDoObjeto(o: Objeto, res: number, genero = 'investigacao', estilo: IdDoEstilo = 'illustrated', pixel?: OpcoesDoPixel): string | null {
  if (o.elevation === 'wall') return null;
  if (o.source.kind === 'asset') { const item = itemDaColecao(o.source.assetId); return item ? `${estilo}|a|${res}|${o.source.assetId}|${harmoniza(o, item) ? `h:${generoDe(genero).id}` : '-'}${geradoNoPixel(item, estilo) ? sufixoDoPixel(pixel) : ''}` : null; }     // asset desconhecido: o marcador fica, sem erro
  return `${estilo}|o|${res}|${o.source.recipe}|${o.source.seed}|${JSON.stringify(o.source.params)}${sufixoDoPixel(pixel)}`;
}

/** Item gerado desenhado no estilo Pixel: vai pela descrição, não pela imagem. */
const geradoNoPixel = (item: ItemDaColecao, estilo: IdDoEstilo): boolean => estilo === 'pixel' && item.origem.tipo === 'gerado';
const porId = new Map(COLECAO.map(i => [i.id, i]));
/** Só as imagens achadas passam pela harmonização (as geradas já nascem no traço da casa, com contorno e sombra), e o mestre pode desligar por objeto (`harmonize`). */
const harmoniza = (o: Objeto, item: ItemDaColecao): boolean => o.harmonize && item.origem.tipo === 'achado';
export const itemDaColecao = (assetId: string) => porId.get(assetId);

/** O pedido de pintura de um objeto de piso, de receita ou da coleção; `null` se não há o que pintar (asset desconhecido). */
export function pedidoDoObjeto(o: Objeto, res: number, genero = 'investigacao', estilo: IdDoEstilo = 'illustrated', pixel?: OpcoesDoPixel): PedidoDeBake | null {
  if (o.source.kind === 'recipe') return { tipo: 'objeto', receita: o.source.recipe, params: o.source.params, seed: o.source.seed, res, estilo, pixel };
  const item = itemDaColecao(o.source.assetId); if (!item) return null;
  // No Pixel os itens gerados são assados da descrição do gerador (o Ilustrado usa a imagem já assada); os achados seguem como imagem.
  if (geradoNoPixel(item, estilo) && item.origem.tipo === 'gerado') return { tipo: 'gerado', gerador: item.origem.gerador, params: item.origem.params, seed: item.origem.seed, res, estilo, pixel };
  return { tipo: 'imagem', url: urlDoItem(item), pegada: ACERVO.pegadaDaFonte(o.source), res, resImagem: item.res ?? RES_DA_COLECAO, harmonizar: harmoniza(o, item), alvo: harmoniza(o, item) ? generoDe(genero).alvoDeCor : null };
}
export const chaveDoComodo = (e: EntradaDoComodo, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|c|${res}|${JSON.stringify(e)}`;
export const chaveDoTerreno = (e: EntradaDeTerreno, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|t|${res}|${JSON.stringify(e)}`;
