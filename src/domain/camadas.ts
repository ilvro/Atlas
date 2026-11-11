import { ACERVO } from '../procedural/acervo.ts';
import type { Objeto } from './mapa.ts';

/**
 * Verifica se um id do acervo representa uma árvore / copa em pé (e não um tronco caído ou árvore morta no chão).
 */
export function ehArvore(id: string): boolean {
  if (id === 'arvore-morta') return true;
  const item = ACERVO.item(id);
  return !!item && item.tags.includes('arvore') && !item.tags.includes('tronco') && !item.tags.includes('morta');
}

/**
 * Camada padrão (ordem z) de um objeto quando `layer` não foi definido explicitamente.
 * - Tapetes ficam no chão (-1), sob móveis e peças.
 * - Móveis, caixotes, pedras, tocos e troncos caídos ficam no piso comum (0).
 * - Enfeites de mesa (`elevation: 'table'`) ficam sobre os móveis (1).
 * - Árvores e copas em pé ficam elevadas (2), cobrindo o que está sob elas (tocos, troncos caídos, pedras).
 * - Objetos de teto (`elevation: 'ceiling'`) ficam no topo (3).
 */
export function camadaPadrao(o: Pick<Objeto, 'source' | 'elevation'>): number {
  if (o.elevation === 'ceiling') return 3;
  const id = ACERVO.idDaFonte(o.source);
  if (ehArvore(id)) return 2;
  if (o.elevation === 'table') return 1;
  const item = ACERVO.item(id);
  if (item?.categoria === 'tapetes') return -1;
  return 0;
}

/** Camada efetiva de um objeto: a definida pelo usuário, ou a padrão do tipo. */
export const camadaDoObjeto = (o: Objeto): number => o.layer ?? camadaPadrao(o);
