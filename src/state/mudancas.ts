import { COLECOES, type MapaAtlas, type NomeColecao } from '../domain/mapa.ts';

/** O que mudou entre dois documentos. Como o compartilhamento estrutural mantém o que não mudou idêntico, basta comparar referências. */
export interface Mudancas {
  /** Documento trocado por inteiro (abrir, importar): quem escuta deve redesenhar tudo. */
  completo: boolean;
  /** Por coleção, os ids adicionados, removidos ou alterados. */
  colecoes: Partial<Record<NomeColecao, string[]>>;
  /** Campos do topo que mudaram e não são coleções (grid, style, climate…). */
  campos: string[];
}

export const MUDANCA_COMPLETA: Mudancas = Object.freeze({ completo: true, colecoes: {}, campos: [] }) as Mudancas;

export function diferencas(antes: MapaAtlas | null, depois: MapaAtlas): Mudancas {
  if (!antes || antes.id !== depois.id) return MUDANCA_COMPLETA;
  const colecoes: Mudancas['colecoes'] = {}, campos: string[] = [];
  for (const chave of Object.keys(depois) as (keyof MapaAtlas)[]) {
    if (antes[chave] === depois[chave]) continue;
    if ((COLECOES as readonly string[]).includes(chave)) {
      const a = antes[chave as NomeColecao] as Record<string, unknown>, d = depois[chave as NomeColecao] as Record<string, unknown>;
      const ids = [...new Set([...Object.keys(a), ...Object.keys(d)])].filter(id => a[id] !== d[id]);
      if (ids.length) colecoes[chave as NomeColecao] = ids;
    } else if (!['revision', 'createdAt', 'updatedAt'].includes(chave)) campos.push(chave);
  }
  return { completo: false, colecoes, campos };
}

export const mudouAlgo = (m: Mudancas): boolean => m.completo || m.campos.length > 0 || Object.keys(m.colecoes).length > 0;
