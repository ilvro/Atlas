/** Filtro único dos mapas por campanha: galeria e "+" da barra de abas. Sem campanha (null) é a vista geral e devolve todos. */
export function mapasDaCampanha<T extends { campanhaId: string | null }>(mapas: readonly T[], campanhaId: string | null | undefined): T[] {
  if (!campanhaId) return [...mapas];
  return mapas.filter(m => m.campanhaId === campanhaId);
}

/** O complemento: os mapas de outras campanhas (ou sem campanha) que o filtro escondeu. Vazio na vista geral. */
export function mapasDeOutrasCampanhas<T extends { campanhaId: string | null }>(mapas: readonly T[], campanhaId: string | null | undefined): T[] {
  if (!campanhaId) return [];
  return mapas.filter(m => m.campanhaId !== campanhaId);
}
