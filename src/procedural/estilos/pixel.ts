import { desenharPartesPixel, finalizarPixel } from './partes-pixel.ts';
import { pintarMaterialPixel } from './materiais-pixel.ts';
import type { EstiloDeRaster } from './index.ts';

/** O renderizador Pixel: materiais e partes de objetos em blocos de cor na grade de pixels, com contorno de 1 px. */
export const PIXEL: EstiloDeRaster = {
  id: 'pixel',
  resolucao: (_tipo, { ppc, celula }) => ppc / celula,
  desenharPartes: desenharPartesPixel,
  finalizar: finalizarPixel,
  pintarMaterial: (ctx, id, area, seed, o) => pintarMaterialPixel(ctx, id, area, seed, { dir: o?.dir, res: o?.res }),
};
