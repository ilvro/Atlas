import { ILUSTRADO } from './ilustrado.ts';
import { pintarMaterialPixel } from './materiais-pixel.ts';
import type { EstiloDeRaster } from './index.ts';

/** O renderizador Pixel: materiais em blocos de cor na grade de pixels. As partes dos objetos ainda caem no Ilustrado (8.1d). */
export const PIXEL: EstiloDeRaster = {
  id: 'pixel',
  resolucao: (_tipo, { ppc, celula }) => ppc / celula,
  desenharPartes: ILUSTRADO.desenharPartes,
  pintarMaterial: (ctx, id, area, seed, o) => pintarMaterialPixel(ctx, id, area, seed, { dir: o?.dir, res: o?.res }),
};
