import { signal } from '@preact/signals';
import { GENEROS } from '../domain/presets.ts';
import { BIOMAS } from '../procedural/familias.ts';

const CHAVE_EPOCA = 'atlas.filtroDeEpoca';
const CHAVE_BIOMA = 'atlas.filtroDeBioma';

/** 'mapa' = o gênero do mapa aberto; 'todas' = sem filtro; ou o id de um gênero. */
export type FiltroDeEpoca = 'mapa' | 'todas' | string;

function ler(chave: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(chave) : null; } catch { return null; }
}
function gravar(chave: string, v: string | null): void {
  try { if (typeof localStorage === 'undefined') return; if (v === null) localStorage.removeItem(chave); else localStorage.setItem(chave, v); } catch { /* só some ao recarregar */ }
}

const epocaLida = ler(CHAVE_EPOCA), biomaLido = ler(CHAVE_BIOMA);
/** Época escolhida na biblioteca. Preferência do editor: fica no navegador, nunca no mapa. */
export const filtroDeEpoca = signal<FiltroDeEpoca>(epocaLida === 'todas' || GENEROS.some(g => g.id === epocaLida) ? epocaLida! : 'mapa');
/** Bioma escolhido na natureza e no terreno; `null` = todos. */
export const filtroDeBioma = signal<string | null>(BIOMAS.some(b => b.id === biomaLido) ? biomaLido : null);

export function definirFiltroDeEpoca(v: FiltroDeEpoca): void { filtroDeEpoca.value = v; gravar(CHAVE_EPOCA, v === 'mapa' ? null : v); }
export function definirFiltroDeBioma(v: string | null): void { filtroDeBioma.value = v; gravar(CHAVE_BIOMA, v); }

/** O gênero que o filtro de época aplica, dado o gênero do mapa; `null` = não filtra. */
export const generoDoFiltro = (filtro: FiltroDeEpoca, generoDoMapa: string): string | null => filtro === 'todas' ? null : filtro === 'mapa' ? generoDoMapa : filtro;
