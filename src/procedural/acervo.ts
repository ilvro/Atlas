import type { FonteObjeto } from '../domain/mapa.ts';
import { COLECAO } from './colecao.ts';
import { listaDeReceitas, pegadaDaReceita, type CampoDeReceita, type Categoria, type Receita } from './receitas/index.ts';

/**
 * O acervo: um lugar só que sabe o que é cada objeto, que tamanho tem e para que serve, venha ele de uma receita leve (desenhada em tempo real)
 * ou da coleção (uma imagem em `public/colecao/`, id `casa:<nome>`). Autoria, render e interface perguntam aqui, nunca direto às receitas.
 */
export interface ItemDoAcervo {
  /** O id da receita, ou `casa:<nome>`. */
  id: string;
  fonte: 'receita' | 'colecao';
  nome: string; categoria: Categoria; tipo: 'piso' | 'parede';
  funcoes: string[]; tags: string[]; generos: string[]; kit: string | null;
  /** Pegada padrão (m). */
  pegada: [number, number];
  /** Parâmetros editáveis; vazio para a coleção (imagem pronta). */
  campos: CampoDeReceita[];
}

/** O que o acervo precisa saber de um item da coleção (o catálogo completo, com arquivo e origem, está em `colecao.ts`). */
export interface ItemParaOAcervo {
  id: string; nome: string; categoria: Categoria; pegada: [number, number];
  funcoes: string[]; tags: string[]; generos: string[]; kit: string | null;
}

export interface Acervo {
  item(id: string): ItemDoAcervo | undefined;
  lista(): ItemDoAcervo[];
  /** Pegada de um objeto do mapa, com os parâmetros dele (a escala é de quem chama). Objeto desconhecido: [0,8, 0,8]. */
  pegadaDaFonte(f: FonteObjeto): [number, number];
  /** O id do acervo de um objeto do mapa (a receita, ou o assetId). */
  idDaFonte(f: FonteObjeto): string;
  /** A fonte para pôr um item no mapa. */
  fonte(id: string, seed: number, params?: Record<string, unknown>): FonteObjeto;
}

const doReceita = (r: Receita): ItemDoAcervo => ({ id: r.id, fonte: 'receita', nome: r.nome, categoria: r.categoria, tipo: r.tipo, funcoes: r.funcoes, tags: r.tags, generos: r.generos ?? [], kit: r.kit ?? null, pegada: r.pegada, campos: r.campos ?? [] });
const daColecao = (c: ItemParaOAcervo): ItemDoAcervo => ({ id: c.id, fonte: 'colecao', nome: c.nome, categoria: c.categoria, tipo: 'piso', funcoes: c.funcoes, tags: c.tags, generos: c.generos, kit: c.kit, pegada: c.pegada, campos: [] });

export function criarAcervo(receitas: readonly Receita[], colecao: readonly ItemParaOAcervo[]): Acervo {
  const itens = [...receitas.map(doReceita), ...colecao.map(daColecao)], porId = new Map(itens.map(i => [i.id, i]));
  const receitaPorId = new Map(receitas.map(r => [r.id, r]));
  return {
    item: id => porId.get(id),
    lista: () => itens,
    pegadaDaFonte(f) {
      if (f.kind === 'recipe') { const r = receitaPorId.get(f.recipe); return r ? pegadaDaReceita(f.recipe, f.params) : [0.8, 0.8]; }
      return porId.get(f.assetId)?.pegada ?? [0.8, 0.8];
    },
    idDaFonte: f => (f.kind === 'recipe' ? f.recipe : f.assetId),
    fonte(id, seed, params = {}) { return porId.get(id)?.fonte === 'colecao' ? { kind: 'asset', assetId: id } : { kind: 'recipe', recipe: id, seed, params }; },
  };
}

/** As receitas de verdade e a coleção da casa. */
export const ACERVO: Acervo = criarAcervo(listaDeReceitas(), COLECAO);
