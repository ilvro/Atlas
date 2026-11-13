import { ACERVO } from '../procedural/acervo.ts';
import type { FonteObjeto } from '../domain/mapa.ts';

/** Tags de coisas que flutuam, são finas ou são vegetação baixa: a água passa por elas sem quebrar em espuma. */
const SEM_ANEL = ['planta', 'grama', 'capim', 'junco', 'vitoria-regia', 'nenufar', 'flor', 'galho', 'raiz', 'arbusto', 'folha'];

/** Se o objeto de piso dentro d'água ganha anel de espuma: pedras, troncos, colunas, cascos sim; juncos, vitórias-régias, capim, galhos e raízes não. */
export function geraAnelDeEspuma(fonte: FonteObjeto, pegada: [number, number]): boolean {
  const item = ACERVO.item(ACERVO.idDaFonte(fonte));
  if (item && item.tags.some(t => SEM_ANEL.includes(t))) return false;
  return Math.max(pegada[0], pegada[1]) >= 0.5;
}

/** A força do anel (0,5 a 1) cresce com o objeto: o pequeno ganha um anel mais fraco e curto. */
export const forcaDoAnel = (pegada: [number, number]): number => Math.min(1, 0.5 + 0.2 * Math.max(pegada[0], pegada[1]));
