import { arestasDeParede, comprimentoDaParede, pontoNaParede, salasDaAbertura, type ArestaUnitaria } from '../domain/geometria.ts';
import type { Comodo, MapaAtlas, Objeto, Parede } from '../domain/mapa.ts';
import { generoDe } from '../domain/presets.ts';
import type { EntradaDeEscarpa } from '../procedural/escarpa.ts';
import { materialDe } from '../procedural/materiais.ts';
import { ACERVO } from '../procedural/acervo.ts';
import type { EntradaDeTerreno, EntradaDoComodo } from '../procedural/assar.ts';
import { COLECAO, PPC_DO_PIXEL_ARQUIVO, RES_DA_COLECAO, fonteDoPixel, type ItemDaColecao } from '../procedural/colecao.ts';
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
  const alturas = Object.values(m.walls).filter(p => p.source && 'roomId' in p.source && p.source.roomId === sala.id).map(p => p.height);
  return {
    grade: { size: m.grid.size, offset: [m.grid.offset[0], m.grid.offset[1]] }, celulas: sala.cells, piso: sala.floor, papel: sala.wallpaper,
    estilo: sala.wallStyle ?? m.style.walls, altura: alturas.length ? Math.max(...alturas) : 2.6, aberturas, objetos,
  };
}

export function entradaDoTerreno(m: MapaAtlas): EntradaDeTerreno {
  return { largura: m.bounds.width, altura: m.bounds.height, resolucao: m.terrain.resolution, // Um fundo em textura aparece onde o terreno é 'vazio': o mesmo desenho do terreno, sem uma segunda via.
    base: m.terrain.base !== 'vazio' ? m.terrain.base : m.backdrop.kind === 'texture' && m.backdrop.material ? m.backdrop.material : 'vazio',
    camadas: Object.values(m.terrain.layers).sort((a, b) => a.order - b.order).map(c => ({ material: c.material, celulas: c.cells, ...(c.flow ? { flow: c.flow } : {}) })) };
}

/** Chave do cache de um objeto de piso: a mesma receita, semente e parâmetros reaproveitam o mesmo desenho. */
/** px por metro de um tipo de desenho no estilo do mapa. */
export const resolucaoDe = (m: Pick<MapaAtlas, 'style' | 'grid'>, tipo: TipoDeAssado): number =>
  estiloDe(m.style.renderer).resolucao(tipo, { ppc: m.style.pixel.pixelsPerCell, celula: m.grid.size });

/** As opções do Pixel de um mapa (pixels por célula e contorno); `undefined` no Ilustrado, que não as usa. */
export const opcoesDoPixel = (m: Pick<MapaAtlas, 'style'>): OpcoesDoPixel | undefined => (m.style.renderer === 'pixel' ? { ppc: m.style.pixel.pixelsPerCell, contorno: m.style.pixel.outline, paleta: m.style.palette, dither: m.style.pixel.dither } : undefined);
const sufixoDoPixel = (px?: OpcoesDoPixel): string => (px ? `|c${px.contorno ? 1 : 0}` : '');
/** A imagem derivada também depende da paleta e do dithering. */
const sufixoDaImagemNoPixel = (px?: OpcoesDoPixel): string => (px ? `${sufixoDoPixel(px)}|${px.paleta}|${px.dither}` : '');

/** A chave do cache de um item da coleção. No Pixel ela diz de onde vem o desenho: o arquivo manual (com a escala), o gerador ou a imagem derivada. */
export function chaveDoItem(assetId: string, item: ItemDaColecao, harmonizado: boolean, res: number, genero: string, estilo: IdDoEstilo, pixel?: OpcoesDoPixel): string {
  const base = `${estilo}|a|${res}|${assetId}|${harmonizado ? `h:${generoDe(genero).id}` : '-'}`;
  if (estilo !== 'pixel') return base;
  const fonte = pixel ? fonteDoPixel(item, pixel.ppc) : { tipo: 'derivada' as const };
  if (fonte.tipo === 'manual') return `${base}|manual:${fonte.arquivo}:${fonte.escala}`;
  return base + (item.origem.tipo === 'gerado' ? sufixoDoPixel(pixel) : sufixoDaImagemNoPixel(pixel));
}

/** Toda chave começa pelo estilo de raster: o mesmo objeto nos dois estilos são dois desenhos, e o do outro estilo fica em cache até a troca terminar. */
export function chaveDoObjeto(o: Objeto, res: number, genero = 'investigacao', estilo: IdDoEstilo = 'illustrated', pixel?: OpcoesDoPixel): string | null {
  if (o.elevation === 'wall') return null;
  if (o.source.kind === 'asset') { const item = itemDaColecao(o.source.assetId); return item ? chaveDoItem(o.source.assetId, item, harmoniza(o, item), res, genero, estilo, pixel) : null; }     // asset desconhecido: o marcador fica, sem erro
  return `${estilo}|o|${res}|${o.source.recipe}|${o.source.seed}|${JSON.stringify(o.source.params)}${sufixoDoPixel(pixel)}`;
}

/** Item gerado desenhado no estilo Pixel: vai pela descrição, não pela imagem. */
const geradoNoPixel = (item: ItemDaColecao, estilo: IdDoEstilo): boolean => estilo === 'pixel' && item.origem.tipo === 'gerado';
const porId = new Map(COLECAO.map(i => [i.id, i]));
/** Só as imagens achadas passam pela harmonização (as geradas já nascem no traço da casa, com contorno e sombra), e o mestre pode desligar por objeto (`harmonize`). */
const harmoniza = (o: Objeto, item: ItemDaColecao): boolean => o.harmonize && item.origem.tipo === 'achado';
export const itemDaColecao = (assetId: string) => porId.get(assetId);

/**
 * O pedido de pintura de um item da coleção. No Pixel: o arquivo manual, se há e cabe; senão o item gerado é assado da descrição; senão a imagem é derivada.
 * No Ilustrado, a imagem já assada (harmonizada se for achada).
 */
export function pedidoDoItem(item: ItemDaColecao, pegada: [number, number], harmonizado: boolean, res: number, genero: string, estilo: IdDoEstilo, pixel?: OpcoesDoPixel): PedidoDeBake {
  const fonte = estilo === 'pixel' && pixel ? fonteDoPixel(item, pixel.ppc) : null;
  if (fonte?.tipo === 'manual') return { tipo: 'imagem', url: urlDoItem({ arquivo: fonte.arquivo }), pegada, res, resImagem: PPC_DO_PIXEL_ARQUIVO / 1.5, harmonizar: false, alvo: null, estilo, pixel, pixelManual: { escala: fonte.escala } };
  if (geradoNoPixel(item, estilo) && item.origem.tipo === 'gerado') return { tipo: 'gerado', gerador: item.origem.gerador, params: item.origem.params, seed: item.origem.seed, res, estilo, pixel };
  return { tipo: 'imagem', url: urlDoItem(item), pegada, res, resImagem: item.res ?? RES_DA_COLECAO, harmonizar: harmonizado, alvo: harmonizado ? generoDe(genero).alvoDeCor : null, estilo, pixel };
}

/** O pedido de pintura de um objeto de piso, de receita ou da coleção; `null` se não há o que pintar (asset desconhecido). */
export function pedidoDoObjeto(o: Objeto, res: number, genero = 'investigacao', estilo: IdDoEstilo = 'illustrated', pixel?: OpcoesDoPixel): PedidoDeBake | null {
  if (o.source.kind === 'recipe') return { tipo: 'objeto', receita: o.source.recipe, params: o.source.params, seed: o.source.seed, res, estilo, pixel };
  const item = itemDaColecao(o.source.assetId); if (!item) return null;
  return pedidoDoItem(item, ACERVO.pegadaDaFonte(o.source), harmoniza(o, item), res, genero, estilo, pixel);
}
export const chaveDoComodo = (e: EntradaDoComodo, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|c|${res}|${JSON.stringify(e)}`;
export const chaveDoTerreno = (e: EntradaDeTerreno, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|t|${res}|${JSON.stringify(e)}`;

/** Semente estável de uma escarpa, a partir do id da parede. */
const sementeDoId = (id: string): number => { let h = 2166136261; for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619); return (h >>> 0) % 100000 + 1; };
/** A escarpa avulsa (parede `cliff` sem origem) como dado de desenho; o caminho é relativo ao primeiro ponto. Sem lado definido (documentos antigos) o lado baixo é o `b`; um material que não é de rocha vira `rocha.cinza`. */
export function entradaDaEscarpa(p: Parede): EntradaDeEscarpa {
  const [ox, oy] = p.path[0]!;
  return { path: p.path.map(q => [r3(q[0] - ox), r3(q[1] - oy)] as [number, number]), drop: p.drop ?? 'b', altura: p.height, material: materialDe(p.material).uso === 'macico' ? p.material : 'rocha.cinza', seed: sementeDoId(p.id) };
}
export const chaveDaEscarpa = (e: EntradaDeEscarpa, res: number, estilo: IdDoEstilo = 'illustrated'): string => `${estilo}|e|${res}|${JSON.stringify(e)}`;
/** Parede `cliff` desenhada como face de rocha (as do contorno do maciço, com `source`, ficam invisíveis). */
export const ehEscarpaAvulsa = (p: Parede): boolean => p.kind === 'cliff' && !p.source;
