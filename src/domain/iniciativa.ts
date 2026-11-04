import type { Sessao } from './mapa.ts';

/** A ordem de um combate, guardada na sessão: do maior valor para o menor; `current` é um índice em `order`. */
export type Iniciativa = NonNullable<Sessao['initiative']>;
export interface EntradaDeIniciativa { tokenId: string; value: number }

const numero = (v: unknown): number => Number(v) || 0;

/** Do maior valor para o menor; o empate mantém a ordem de entrada. */
export const ordenar = (ordem: readonly EntradaDeIniciativa[]): EntradaDeIniciativa[] =>
  ordem.map((entrada, i) => ({ entrada, i })).sort((a, b) => b.entrada.value - a.entrada.value || a.i - b.i).map(x => x.entrada);

/** Um combate novo com estas peças, do maior valor para o menor, na primeira rodada. */
export const iniciar = (entradas: readonly EntradaDeIniciativa[]): Iniciativa =>
  ({ order: ordenar(entradas.map(({ tokenId, value }) => ({ tokenId, value: numero(value) }))), current: 0, round: 1 });

/** A próxima vez (ou a anterior, com `passo = -1`), contando as rodadas. */
export function passo(ini: Iniciativa, p: 1 | -1 = 1): Iniciativa {
  const n = ini.order.length;
  if (!n) return ini;
  let current = ini.current + p, round = ini.round;
  if (current >= n) { current = 0; round++; } else if (current < 0) { current = n - 1; round = Math.max(1, round - 1); }
  return { ...ini, current, round };
}

/**
 * Troca um valor e reordena, mantendo a vez na mesma peça. Antes de alguém jogar (primeira vez da primeira rodada)
 * a vez fica no topo: digitar os valores é decidir quem começa.
 */
export function definirValor(ini: Iniciativa, tokenId: string, value: number): Iniciativa {
  const vez = ini.order[ini.current]?.tokenId, comecando = ini.round === 1 && ini.current === 0;
  const order = ordenar(ini.order.map(x => x.tokenId === tokenId ? { ...x, value: numero(value) } : x));
  return { ...ini, order, current: comecando ? 0 : Math.max(0, order.findIndex(x => x.tokenId === vez)) };
}

/** Sem as peças que não existem mais, a vez ficando na sua peça quando dá. Devolve `null` se ninguém sobrar. */
export function podar(ini: Iniciativa | null, existe: (tokenId: string) => boolean): Iniciativa | null {
  if (!ini) return ini;
  const vez = ini.order[ini.current]?.tokenId, order = ini.order.filter(x => existe(x.tokenId));
  if (order.length === ini.order.length) return ini;
  if (!order.length) return null;
  const ficou = order.findIndex(x => x.tokenId === vez);
  return { ...ini, order, current: ficou >= 0 ? ficou : Math.min(ini.current, order.length - 1) };
}
