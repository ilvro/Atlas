import type { DescricaoDePiso } from '../descricao.ts';
import type { PedidoDeReceita } from '../receitas/comum.ts';
import type { Categoria } from '../receitas/index.ts';
import { ESTOFADOS } from './estofados.ts';
import { PLANTAS } from './plantas.ts';
import { TAPETES } from './tapetes.ts';

/**
 * Um gerador pesado: desenha objetos com centenas de partes (capitonê, folhagem densa, tapete ornamentado) que não cabem em tempo real.
 * O script `npm run assar` assa cada variante em WebP e grava no catálogo da coleção; o gerador, os parâmetros, a semente e a versão ficam
 * no catálogo para regenerar, e o estilo Pixel (Fase 8) poderá rasterizar a mesma descrição. Fora do bundle do app.
 */
export interface GeradorPesado {
  id: string; nome: string; categoria: Categoria; funcoes: string[]; tags: string[]; generos: string[]; kit: string | null;
  /** Sobe quando o desenho muda: o script regrava as imagens dessa versão. */
  versao: number;
  /** Pixels por metro em que se assa; padrão 128. */
  res?: number;
  variantes: { nome: string; sufixo: string; params: Record<string, unknown>; seed: number }[];
  gerar(p: PedidoDeReceita): DescricaoDePiso;
}

export const PESADOS: readonly GeradorPesado[] = [...ESTOFADOS, ...PLANTAS, ...TAPETES];

/** O id do item da coleção de uma variante: `casa:<gerador>-<sufixo>`. */
export const idDaVariante = (g: GeradorPesado, sufixo: string): string => `casa:${g.id}-${sufixo}`;
