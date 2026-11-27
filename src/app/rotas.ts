import { signal } from '@preact/signals';

/** Rotas por hash: `#/` (galeria), `#/mapa/{id}`, `#/mapa/{id}/comodo/{comodo}`, `#/mapa/{id}/objeto/{objeto}`, `#/mapa/{id}/regiao/{regiao}`, `#/projetor/{id}`, `#/projetor-remoto/{salaId}`, `#/construir-remoto/{salaId}`. Os mesmos formatos do manifesto `mesa.json`. */
export type Rota =
  | { tipo: 'galeria' }
  | { tipo: 'mapa'; id: string; comodo?: string; objeto?: string; regiao?: string }
  | { tipo: 'projetor'; id: string }
  /** O projetor da casca do jogador (mesa online): `#/projetor-remoto/{salaId}`. Ouve só os canais prefixados pela sala e aceita o mapa de qualquer `estado`. */
  | { tipo: 'projetor-remoto'; sala: string }
  /** O editor colaborativo na casca (mesa online / Activity): `#/construir-remoto/{salaId}`. Ouve só o canal da sala, sem gravar no IndexedDB local. */
  | { tipo: 'construir-remoto'; sala: string }
  | { tipo: 'desconhecida'; hash: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export function lerRota(hash: string): Rota {
  const limpo = hash.replace(/^#/, '');
  if (limpo === '' || limpo === '/') return { tipo: 'galeria' };
  const partes = limpo.split('/').filter(Boolean).map(p => { try { return decodeURIComponent(p); } catch { return null; } });
  if (partes.some(p => p === null)) return { tipo: 'desconhecida', hash };
  const [raiz, id, sub, filho, ...resto] = partes as string[];
  if (raiz === 'projetor' && id && ID.test(id) && !sub) return { tipo: 'projetor', id };
  if (raiz === 'projetor-remoto' && id && ID.test(id) && !sub) return { tipo: 'projetor-remoto', sala: id };
  if (raiz === 'construir-remoto' && id && ID.test(id) && !sub) return { tipo: 'construir-remoto', sala: id };
  if (raiz === 'mapa' && id && ID.test(id)) {
    if (!sub && !resto.length) return { tipo: 'mapa', id };
    if (sub === 'comodo' && filho && ID.test(filho) && !resto.length) return { tipo: 'mapa', id, comodo: filho };
    if (sub === 'objeto' && filho && ID.test(filho) && !resto.length) return { tipo: 'mapa', id, objeto: filho };
    if (sub === 'regiao' && filho && ID.test(filho) && !resto.length) return { tipo: 'mapa', id, regiao: filho };
  }
  return { tipo: 'desconhecida', hash };
}

export function formatarRota(rota: Rota): string {
  if (rota.tipo === 'galeria') return '#/';
  if (rota.tipo === 'projetor') return `#/projetor/${encodeURIComponent(rota.id)}`;
  if (rota.tipo === 'projetor-remoto') return `#/projetor-remoto/${encodeURIComponent(rota.sala)}`;
  if (rota.tipo === 'construir-remoto') return `#/construir-remoto/${encodeURIComponent(rota.sala)}`;
  if (rota.tipo === 'mapa') {
    if (rota.comodo) return `#/mapa/${encodeURIComponent(rota.id)}/comodo/${encodeURIComponent(rota.comodo)}`;
    if (rota.objeto) return `#/mapa/${encodeURIComponent(rota.id)}/objeto/${encodeURIComponent(rota.objeto)}`;
    if (rota.regiao) return `#/mapa/${encodeURIComponent(rota.id)}/regiao/${encodeURIComponent(rota.regiao)}`;
    return `#/mapa/${encodeURIComponent(rota.id)}`;
  }
  return rota.hash;
}

export const rota = signal<Rota>(lerRota(typeof location !== 'undefined' ? location.hash : ''));
