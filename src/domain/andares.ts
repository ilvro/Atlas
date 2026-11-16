import { podar } from './iniciativa.ts';
import type { MapaAtlas } from './mapa.ts';

export const NOME_TERREO_PADRAO = 'Térreo';

export interface ItemDeAndar {
  id: string | null;
  nome: string;
  order: number;
}

const cache = new WeakMap<MapaAtlas, Map<string | null, MapaAtlas>>();

/** O identificador do andar de uma entidade (`null` = térreo). */
export function andarDe(e: { levelId?: string | null }): string | null {
  return e.levelId ?? null;
}

/** O mapa tem pelo menos um andar além do térreo? */
export function ehMultiandar(m: Pick<MapaAtlas, 'levels'>): boolean {
  return !!m.levels && Object.keys(m.levels).length > 0;
}

/** Lista ordenada de andares (do porão mais fundo aos andares de cima), incluindo sempre o térreo (`id: null`, `order: 0`). */
export function listaDeAndares(m: Pick<MapaAtlas, 'levels' | 'groundLevelName'>): ItemDeAndar[] {
  const itens: ItemDeAndar[] = [
    { id: null, nome: m.groundLevelName || NOME_TERREO_PADRAO, order: 0 },
  ];
  if (m.levels) {
    for (const a of Object.values(m.levels)) {
      itens.push({ id: a.id, nome: a.name, order: a.order });
    }
  }
  return itens.sort((a, b) => a.order - b.order);
}

/** Andares (ordenados) que têm ao menos uma peça de jogador neste instante. */
export function andaresDosJogadores(m: Pick<MapaAtlas, 'tokens' | 'levels' | 'groundLevelName'>): ItemDeAndar[] {
  const presentes = new Set<string | null>();
  for (const t of Object.values(m.tokens)) if (t.player) presentes.add(andarDe(t));
  return listaDeAndares(m).filter(a => presentes.has(a.id));
}

function filtrarDicionario<T extends { levelId?: string | null }>(
  dic: Record<string, T>,
  andar: string | null,
): Record<string, T> {
  const saida: Record<string, T> = {};
  for (const [id, item] of Object.entries(dic)) {
    if (andarDe(item) === andar) saida[id] = item;
  }
  return saida;
}

/**
 * Recorte puro do mapa para um único andar (`null` = térreo), com cache `WeakMap` por padrão.
 * Passe `semCache = true` quando `m` estiver sendo mutado no momento (ex.: rascunho Immer).
 */
export function mapaDoAndar(m: MapaAtlas, andar: string | null, semCache = false): MapaAtlas {
  if (!semCache) {
    let porAndar = cache.get(m);
    if (!porAndar) {
      porAndar = new Map();
      cache.set(m, porAndar);
    }
    const guardado = porAndar.get(andar);
    if (guardado) return guardado;
  }

  const rooms = filtrarDicionario(m.rooms, andar);
  const walls = filtrarDicionario(m.walls, andar);
  const openings: MapaAtlas['openings'] = {};
  for (const [id, a] of Object.entries(m.openings)) {
    if (walls[a.wallId]) openings[id] = a;
  }
  const props = filtrarDicionario(m.props, andar);
  const lights = filtrarDicionario(m.lights, andar);
  const regions = filtrarDicionario(m.regions, andar);
  const presence = filtrarDicionario(m.presence, andar);
  const tokens = filtrarDicionario(m.tokens, andar);

  const comodosExtra: MapaAtlas['comodosExtra'] = {};
  for (const [rid, extra] of Object.entries(m.comodosExtra)) {
    if (rooms[rid]) comodosExtra[rid] = extra;
  }

  const ordem = andar === null ? 0 : (m.levels?.[andar]?.order ?? 0);
  const abaixo = ordem < 0;

  const terrain = abaixo
    ? { resolution: m.terrain.resolution, base: 'vazio', layers: {} }
    : m.terrain;
  const backdrop = abaixo
    ? { kind: 'solid' as const, color: '#141210', material: null, title: m.backdrop.title }
    : m.backdrop;
  const climate = abaixo
    ? {
        ...m.climate,
        weather: { rain: 0, snow: 0, fog: 0, wind: 0, dust: 0, embers: 0, leaves: 0, lightning: 0 },
      }
    : m.climate;

  const explored = andar === null
    ? m.session.explored
    : (m.session.exploredLevels?.[andar] ?? null);
  const revealed = m.session.revealed.filter(
    id => !!(rooms[id] || walls[id] || openings[id] || props[id] || lights[id] || regions[id] || presence[id] || tokens[id]),
  );
  const initiative = m.session.initiative
    ? podar(m.session.initiative, id => !!tokens[id])
    : null;

  const filtrado: MapaAtlas = {
    ...m,
    backdrop,
    terrain,
    climate,
    rooms,
    walls,
    openings,
    props,
    lights,
    regions,
    presence,
    tokens,
    comodosExtra,
    session: {
      ...m.session,
      explored,
      initiative,
      revealed,
    },
  };

  if (!semCache) cache.get(m)?.set(andar, filtrado);
  return filtrado;
}
