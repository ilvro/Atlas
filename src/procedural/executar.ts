import { assarComodo, assarObjeto, assarTerreno, type Assado, type EntradaDeTerreno, type EntradaDoComodo } from './assar.ts';

export type PedidoDeBake =
  | { tipo: 'objeto'; receita: string; params: Record<string, unknown>; seed: number; res: number }
  | { tipo: 'comodo'; entrada: EntradaDoComodo; res: number }
  | { tipo: 'terreno'; entrada: EntradaDeTerreno; res: number };

export interface ResultadoDeBake { bitmap: ImageBitmap; origem: [number, number]; res: number }

/** O trabalho pesado: pinta numa tela e devolve um `ImageBitmap`. Roda no worker, ou na página se o navegador não tiver worker. */
export async function executarBake(p: PedidoDeBake): Promise<ResultadoDeBake> {
  const a: Assado = p.tipo === 'objeto' ? assarObjeto(p.receita, p.params, p.seed, p.res) : p.tipo === 'comodo' ? assarComodo(p.entrada, p.res) : assarTerreno(p.entrada, p.res);
  const bitmap = 'transferToImageBitmap' in a.tela ? a.tela.transferToImageBitmap() : await createImageBitmap(a.tela);
  return { bitmap, origem: a.origem, res: a.res };
}
