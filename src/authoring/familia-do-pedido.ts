import { ACERVO } from '../procedural/acervo.ts';

/** Prefixo com que o assistente pede “uma variante desta família” em vez de escolher o item: `familia:arvore`. */
export const PREFIXO_DE_FAMILIA = 'familia:';

export const ehPedidoDeFamilia = (id: string): boolean => id.startsWith(PREFIXO_DE_FAMILIA);

/** A família pedida (`familia:<id>`), ou `undefined` se o id não é de família ou ela não existe. */
export const familiaDoPedido = (id: string) => (ehPedidoDeFamilia(id) ? ACERVO.familia(id.slice(PREFIXO_DE_FAMILIA.length)) : undefined);

/**
 * O id de item de verdade para um pedido: um item comum volta como está (sem sortear); `familia:<id>` vira uma das variantes, escolhida com `rand`.
 * `null` quando o pedido é de família e ela não existe.
 */
export function itemDoPedido(id: string, rand: () => number): string | null {
  if (!ehPedidoDeFamilia(id)) return id;
  const f = familiaDoPedido(id); if (!f) return null;
  return f.itens[Math.min(f.itens.length - 1, Math.floor(rand() * f.itens.length))]!;
}

/** Mensagem de erro para uma família que não existe, com sugestões. */
export function erroDeFamilia(id: string): string {
  const termo = id.slice(PREFIXO_DE_FAMILIA.length).toLowerCase(), todas = ACERVO.familias();
  const parecidas = todas.filter(f => termo && (f.id.includes(termo) || f.nome.toLowerCase().includes(termo))).map(f => f.id);
  const lista = (parecidas.length ? parecidas : todas.map(f => f.id)).slice(0, 30).join(', ');
  return `família “${id}” não existe; ${parecidas.length ? 'parecidas' : 'famílias'}: ${lista} (veja atlas_catalogo { parte: "familias" })`;
}
