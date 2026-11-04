/** Rotas por hash: `#/` (galeria), `#/mapa/{id}`, `#/mapa/{id}/comodo/{comodo}`. Os mesmos formatos do manifesto `mesa.json`. */
export type Rota =
  | { tipo: 'galeria' }
  | { tipo: 'mapa'; id: string; comodo?: string }
  | { tipo: 'projetor'; id: string }
  | { tipo: 'desconhecida'; hash: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function lerRota(hash: string): Rota {
  const limpo = hash.replace(/^#/, '');
  if (limpo === '' || limpo === '/') return { tipo: 'galeria' };
  const partes = limpo.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return null; } });
  if (partes.some(p => p === null)) return { tipo: 'desconhecida', hash };
  const [raiz, id, sub, comodo, ...resto] = partes as string[];
  if (raiz === 'projetor' && id && ID.test(id) && !sub) return { tipo: 'projetor', id };
  if (raiz === 'mapa' && id && ID.test(id)) {
    if (!sub && !resto.length) return { tipo: 'mapa', id };
    if (sub === 'comodo' && comodo && ID.test(comodo) && !resto.length) return { tipo: 'mapa', id, comodo };
  }
  return { tipo: 'desconhecida', hash };
}

export function formatarRota(rota: Rota): string {
  if (rota.tipo === 'galeria') return '#/';
  if (rota.tipo === 'projetor') return `#/projetor/${encodeURIComponent(rota.id)}`;
  if (rota.tipo === 'mapa') return rota.comodo ? `#/mapa/${encodeURIComponent(rota.id)}/comodo/${encodeURIComponent(rota.comodo)}` : `#/mapa/${encodeURIComponent(rota.id)}`;
  return rota.hash;
}
