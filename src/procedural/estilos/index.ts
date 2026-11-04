import type { Contexto } from '../canvas.ts';
import type { Parte } from '../descricao.ts';
import type { Area } from '../materiais.ts';
import { ILUSTRADO } from './ilustrado.ts';

export type IdDoEstilo = 'illustrated' | 'pixel';
export type TipoDeAssado = 'objeto' | 'comodo' | 'terreno';

/**
 * Como uma descrição de desenho vira pixels. Receitas, geradores, materiais, faces e terreno são descritos uma vez;
 * cada estilo de raster os interpreta à sua maneira (o Ilustrado com sombras e traço, o Pixel em blocos de cor).
 */
export interface EstiloDeRaster {
  id: IdDoEstilo;
  /** px por metro para objetos, cômodos e terreno, dados o pixelsPerCell e o tamanho da célula. */
  resolucao(tipo: TipoDeAssado, o: { ppc: number; celula: number }): number;
  desenharPartes(ctx: Contexto, partes: readonly Parte[], o: { res: number; seed: number; sombras: boolean }): void;
  pintarMaterial(ctx: Contexto, id: string, area: Area, seed: number, o?: { dir?: number; res?: number }): void;
  /** Passo final da tela assada (contorno de 1 px do Pixel; nada no Ilustrado). */
  finalizar?(ctx: Contexto, largura: number, altura: number): void;
}

/** O estilo de raster de um id. O Pixel ainda devolve o Ilustrado: as tarefas 8.1c em diante o preenchem. */
export function estiloDe(id: IdDoEstilo): EstiloDeRaster {
  switch (id) {
    case 'pixel': return ILUSTRADO;
    default: return ILUSTRADO;
  }
}
