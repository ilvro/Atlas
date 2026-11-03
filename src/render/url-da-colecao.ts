import type { ItemDaColecao } from '../procedural/colecao.ts';

/** A URL de uma imagem da coleção, absoluta e respeitando a base do app (GitHub Pages). Só o render usa: o worker recebe a URL pronta. */
export const urlDoItem = (item: Pick<ItemDaColecao, 'arquivo'>): string => new URL(`${import.meta.env.BASE_URL}colecao/${item.arquivo}`, location.href).href;
