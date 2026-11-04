import { pintarMaterial } from '../materiais.ts';
import { desenharPartes } from '../raster.ts';
import type { EstiloDeRaster } from './index.ts';

/** O renderizador Ilustrado: o desenho de sempre (`desenharPartes` e `pintarMaterial`), agora atrás da interface de estilo. */
export const ILUSTRADO: EstiloDeRaster = {
  id: 'illustrated',
  resolucao: tipo => (tipo === 'objeto' ? 96 : tipo === 'comodo' ? 64 : 24),
  desenharPartes: (ctx, partes, o) => desenharPartes(ctx, partes, o),
  pintarMaterial: (ctx, id, area, seed, o) => pintarMaterial(ctx, id, area, seed, { dir: o?.dir }),
};
