import type { Ref } from '../../mesa-core/src/refs.ts';

/** PV e PD de uma ficha, como a Ficha os publica em `ficha.recursos`. Vivem na memória da sessão: o documento do mapa só guarda o `Ref`. */
export interface Recursos { pv: number; pvMax: number; pd: number; pdMax: number }

/** O Ref da ficha de uma peça (a primeira referência do aplicativo `ficha`), ou `null` se a peça não é de uma ficha. */
export const refDaFicha = (refs: readonly Ref[]): Ref | null => refs.find(r => r.app === 'ficha' && r.tipo === 'ficha') ?? null;

/** Fração cheia (0 a 1) de um recurso; máximo zero ou ausente vale zero. */
export const fracao = (valor: number, maximo: number): number => (maximo > 0 ? Math.min(1, Math.max(0, valor / maximo)) : 0);

/** PV em 25% ou menos (e há máximo): a peça aparece "ferida" na tela, sem tocar no documento. */
export const emEstadoCritico = (r: Pick<Recursos, 'pv' | 'pvMax'>): boolean => r.pvMax > 0 && r.pv / r.pvMax <= 0.25;

/** Quantos dos `n` pips ficam cheios: o que sobrou, arredondado para cima (qualquer vida restante acende um pip). */
export const pipsCheios = (valor: number, maximo: number, n = 10): number => (valor <= 0 || maximo <= 0 ? 0 : Math.max(1, Math.ceil(fracao(valor, maximo) * n - 1e-9)));

/** Destaque só de cor para a rolagem (o dado sem o modificador: 19 ou mais é alto, 2 ou menos é baixo). Não decide sucesso nem falha: o Atlas não conhece a regra do sistema. */
export type TomDaRolagem = 'alto' | 'baixo' | 'normal';
export function tomDaRolagem(total: number, modificador = 0): TomDaRolagem {
  const bruto = total - modificador;
  return bruto >= 19 ? 'alto' : bruto <= 2 ? 'baixo' : 'normal';
}
