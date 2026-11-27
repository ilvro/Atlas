import type { Descricao } from '../descricao.ts';
import { RECEITAS_DA_CASA } from './casa.ts';
import { RECEITAS_DE_INVESTIGACAO } from './investigacao.ts';
import { RECEITAS_DE_ENFEITES } from './enfeites.ts';
import { RECEITAS_ERMOS } from './ermos.ts';
import { RECEITAS_MATA } from './mata.ts';
import { RECEITAS_DE_CHAO, TRONCO_CAIDO } from './chao.ts';
import { RECEITAS_DA_LAVOURA } from './lavoura.ts';
import { RECEITAS_DA_CIDADE } from './cidade.ts';
import { RECEITAS_DE_BIOMAS } from './biomas.ts';
import { RECEITAS_PORTO } from './porto.ts';
import { RECEITAS_ESTRADA } from './estrada.ts';
import { RECEITAS_CAVERNA } from './caverna.ts';
import { RECEITAS_FUNDO } from './fundo.ts';
import { RECEITAS_EXTERIORES } from './exterior.ts';
import { RECEITAS_DE_PAREDE } from './parede.ts';
import { RECEITAS_DE_FANTASIA } from './fantasia.ts';
import { RECEITAS_MODERNAS } from './moderno.ts';
import { RECEITAS_DE_ARMAS } from './armas.ts';
import { RECEITAS_DE_IGREJA } from './igreja.ts';
import { RECEITAS_DE_CASTELO } from './castelo.ts';
import { RECEITAS_DE_MASMORRA } from './masmorra.ts';
import { RECEITAS_RURAIS } from './rural.ts';
import { RECEITAS_DE_FICCAO } from './ficcao.ts';
import { RECEITAS_DA_PRACA } from './praca.ts';
import { RECEITAS_DE_ESTRUTURA } from './estrutura.ts';
import { RECEITAS_DA_MANSAO } from './mansao.ts';
import { RECEITAS_DA_ANTIGUIDADE } from './antiguidade.ts';
import { RECEITAS_ORIENTAIS } from './oriental.ts';
import { RECEITAS_DO_DESERTO } from './deserto.ts';
import type { PedidoDeReceita, Receita } from './comum.ts';

export { CATEGORIAS, type CampoDeReceita, type Categoria, type PedidoDeReceita, type Receita } from './comum.ts';

/** Todas as receitas, juntando as listas de cada kit. Os ids são únicos entre os arquivos (um teste confere). */
const lista: Receita[] = [...RECEITAS_DA_CASA, ...RECEITAS_DE_INVESTIGACAO, ...RECEITAS_MODERNAS, ...RECEITAS_DE_FANTASIA, ...RECEITAS_DE_ARMAS, ...RECEITAS_DE_IGREJA, ...RECEITAS_DE_CASTELO, ...RECEITAS_DE_MASMORRA, ...RECEITAS_EXTERIORES, ...RECEITAS_RURAIS, ...RECEITAS_DE_FICCAO, ...RECEITAS_ERMOS, ...RECEITAS_MATA, ...RECEITAS_DE_CHAO, ...RECEITAS_DA_LAVOURA, ...RECEITAS_DA_CIDADE, ...RECEITAS_DE_BIOMAS, TRONCO_CAIDO, ...RECEITAS_DA_PRACA, ...RECEITAS_DE_ESTRUTURA, ...RECEITAS_DA_MANSAO, ...RECEITAS_PORTO, ...RECEITAS_ESTRADA, ...RECEITAS_CAVERNA, ...RECEITAS_FUNDO, ...RECEITAS_DE_PAREDE, ...RECEITAS_DE_ENFEITES, ...RECEITAS_DA_ANTIGUIDADE, ...RECEITAS_ORIENTAIS, ...RECEITAS_DO_DESERTO];

/** O catálogo de receitas. */
export const RECEITAS: Readonly<Record<string, Receita>> = Object.fromEntries(lista.map(r => [r.id, r]));
export const receitaDe = (id: string): Receita | undefined => RECEITAS[id];
export const listaDeReceitas = (): Receita[] => lista;

/** Descrição de uma receita com os parâmetros dados; uma receita que não existe vira um caixote, nunca um erro. */
export function descreverReceita(id: string, pedido: PedidoDeReceita): Descricao {
  return (RECEITAS[id] ?? RECEITAS.caixa!).gerar(pedido);
}

/** Largura × profundidade (m) que o objeto ocupa, com os parâmetros dados. */
export function pegadaDaReceita(id: string, params: Record<string, unknown> = {}): [number, number] {
  const d = descreverReceita(id, { seed: 1, params });
  return d.tipo === 'piso' ? d.pegada : [d.largura, 0.05];
}

export const funcoesDeComodo = (): string[] => [...new Set(lista.flatMap(r => r.funcoes))].sort();
