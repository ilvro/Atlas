import { signal } from '@preact/signals';

export const MAX_RECENTES = 20;

/** Põe o id na frente, sem repetir, e corta no máximo. Pura. */
export function registrarRecente(lista: readonly string[], id: string, max = MAX_RECENTES): string[] {
  return [id, ...lista.filter(x => x !== id)].slice(0, max);
}

/** Liga ou desliga o id na lista de favoritos (novos entram no fim). Pura. */
export function alternarFavorito(lista: readonly string[], id: string): string[] {
  return lista.includes(id) ? lista.filter(x => x !== id) : [...lista, id];
}

function ler(chave: string): string[] {
  try {
    const bruto = typeof localStorage !== 'undefined' ? localStorage.getItem(chave) : null;
    const v: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch { return []; }
}

function gravar(chave: string, lista: readonly string[]): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(chave, JSON.stringify(lista)); } catch { /* sem armazenamento: só some ao recarregar */ }
}

/** Ids de item postos por último (o mais novo primeiro). Fica no navegador, nunca no mapa. */
export const recentes = signal<string[]>(ler('atlas:recentes').slice(0, MAX_RECENTES));
/** Ids de família fixados. */
export const favoritos = signal<string[]>(ler('atlas:favoritos'));

export function lembrarRecente(id: string): void {
  recentes.value = registrarRecente(recentes.value, id);
  gravar('atlas:recentes', recentes.value);
}

export function alternarFavoritoDaFamilia(id: string): void {
  favoritos.value = alternarFavorito(favoritos.value, id);
  gravar('atlas:favoritos', favoritos.value);
}
