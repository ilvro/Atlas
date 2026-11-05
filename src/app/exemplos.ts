import { signal } from '@preact/signals';
import { duplicarParaNovaSessao } from '../domain/mapa.ts';
import { lerMapa } from '../domain/migracoes.ts';
import { tocar } from '../fx/som.ts';
import { navegar, servicos } from './app.ts';
import { campanhaAtiva, sincronizarMapaComCampanha } from './campanha.ts';
import { avisar } from './toasts.ts';

/** Um mapa de exemplo da galeria (`public/exemplos/indice.json`, gerado por `npm run exemplos`). */
export interface ExemploDaGaleria { id: string; nome: string; descricao: string; tamanho: [number, number]; miniatura: string }

/** `null` até o índice chegar; lista vazia se não há exemplos ou o índice falhou (o app segue completo sem eles). */
export const exemplos = signal<ExemploDaGaleria[] | null>(null);

/** A URL de um arquivo de `public/exemplos/`, respeitando a base do app (mesma regra de `render/url-da-colecao.ts`). */
export function urlDoExemplo(arquivo: string): string {
  const caminho = `${import.meta.env?.BASE_URL ?? '/'}exemplos/${arquivo}`;
  return typeof location === 'undefined' ? caminho : new URL(caminho, location.href).href;
}

const ehExemplo = (v: unknown): v is ExemploDaGaleria => {
  const e = v as ExemploDaGaleria | null;
  return !!e && typeof e.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(e.id) && typeof e.nome === 'string' && typeof e.descricao === 'string' && typeof e.miniatura === 'string'
    && Array.isArray(e.tamanho) && e.tamanho.length === 2 && e.tamanho.every(n => typeof n === 'number');
};

/** Carrega o índice (uma vez). Qualquer falha vira lista vazia: a galeria não mostra a seção. */
export async function carregarIndiceDeExemplos(): Promise<ExemploDaGaleria[]> {
  if (exemplos.peek()) return exemplos.peek()!;
  let lista: ExemploDaGaleria[] = [];
  try {
    const r = await fetch(urlDoExemplo('indice.json'));
    if (r.ok) { const bruto: unknown = await r.json(); if (Array.isArray(bruto)) lista = bruto.filter(ehExemplo); }
  } catch { /* sem índice, sem exemplos */ }
  exemplos.value = lista; return lista;
}

/** Cria uma cópia do exemplo no repositório (id novo; o exemplo publicado nunca muda) e a abre. */
export async function usarExemplo(id: string): Promise<void> {
  const s = servicos.value; if (!s) return;
  try {
    const r = await fetch(urlDoExemplo(`${id}.atlas.json`)); if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const exemplo = lerMapa(await r.json());
    const copia = duplicarParaNovaSessao(exemplo, { nome: exemplo.name });
    copia.campanhaId = campanhaAtiva.value?.id ?? null;
    const gravado = await s.repo.salvar(copia);
    await sincronizarMapaComCampanha(s, gravado);
    tocar('pop'); navegar({ tipo: 'mapa', id: gravado.id });
  } catch (erro) { avisar(`Não consegui abrir o exemplo: ${erro instanceof Error ? erro.message : String(erro)}`, { tipo: 'erro' }); }
}
