import type { Contexto } from '../canvas.ts';
import type { Parte } from '../descricao.ts';
import type { Area } from '../materiais.ts';
import { ILUSTRADO } from './ilustrado.ts';
import { PIXEL } from './pixel.ts';

export type IdDoEstilo = 'illustrated' | 'pixel';
/** O que o Pixel precisa saber além do estilo: pixels por célula (corta o detalhe que não cabe) e se há contorno. */
export interface OpcoesDoPixel { ppc: number; contorno: boolean; /** Id da paleta e dithering: só as imagens derivadas usam. */ paleta: string; dither: 'none' | 'bayer4' }
export type TipoDeAssado = 'objeto' | 'comodo' | 'terreno';

/**
 * Como uma descrição de desenho vira pixels. Receitas, geradores, materiais, faces e terreno são descritos uma vez;
 * cada estilo de raster os interpreta à sua maneira (o Ilustrado com sombras e traço, o Pixel em blocos de cor).
 */
export interface EstiloDeRaster {
  id: IdDoEstilo;
  /** px por metro para objetos, cômodos e terreno, dados o pixelsPerCell e o tamanho da célula. */
  resolucao(tipo: TipoDeAssado, o: { ppc: number; celula: number }): number;
  desenharPartes(ctx: Contexto, partes: readonly Parte[], o: { res: number; seed: number; sombras: boolean; ppc?: number }): void;
  pintarMaterial(ctx: Contexto, id: string, area: Area, seed: number, o?: { dir?: number; res?: number }): void;
  /** Passo final da tela assada (contorno de 1 px do Pixel; nada no Ilustrado). */
  finalizar?(ctx: Contexto, largura: number, altura: number, o: { contorno: boolean }): void;
}

/** O estilo de raster de um id. */
export function estiloDe(id: IdDoEstilo): EstiloDeRaster {
  switch (id) {
    case 'pixel': return PIXEL;
    default: return ILUSTRADO;
  }
}
