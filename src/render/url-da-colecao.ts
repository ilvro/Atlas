import type { ItemDaColecao } from '../procedural/colecao.ts';

/** A URL de uma imagem da coleção, absoluta e respeitando a base do app (GitHub Pages). Só o render usa: o worker recebe a URL pronta. Fora do navegador (testes) devolve o caminho. */
export function urlDoItem(item: Pick<ItemDaColecao, 'arquivo'>): string {
  const caminho = `${import.meta.env?.BASE_URL ?? '/'}colecao/${item.arquivo}`;
  return typeof location === 'undefined' ? caminho : new URL(caminho, location.href).href;
}
