import { podar } from './iniciativa.ts';
import type { Interacao, MapaAtlas, Objeto, Peca, Ponto } from './mapa.ts';

export const NOME_TERREO_PADRAO = 'Térreo';

export const RECEITAS_DE_ESCADA = new Set([
  'escada.madeira',
  'escada.pedra',
  'escada.caracol',
  'escada.de-mao',
  'alcapao',
]);

export const ehReceitaDeEscada = (receita: string): boolean => RECEITAS_DE_ESCADA.has(receita);

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

/** O identificador do andar exibido por um documento já recortado por `mapaDoAndar` (`null` = térreo). */
export function andarDoDocumento(
  doc: Pick<MapaAtlas, 'tokens' | 'rooms' | 'walls' | 'props' | 'lights' | 'presence' | 'regions'>,
): string | null {
  for (const col of [doc.tokens, doc.rooms, doc.walls, doc.props, doc.lights, doc.presence, doc.regions]) {
    for (const item of Object.values(col)) {
      const a = andarDe(item);
      if (a) return a;
    }
  }
  return null;
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

/** Andar vizinho padrão ao colocar uma escada (`alcapao` desce quando possível; demais sobem). */
export function andarVizinhoDeEscada(
  m: Pick<MapaAtlas, 'levels' | 'groundLevelName'>,
  origem: string | null,
  receita: string,
): string | null | undefined {
  const lista = listaDeAndares(m);
  if (lista.length <= 1) return undefined;
  const idx = lista.findIndex(a => a.id === origem);
  if (idx < 0) return undefined;
  const prefereDescer = receita === 'alcapao';
  const alvo = prefereDescer ? (lista[idx - 1] ?? lista[idx + 1]) : (lista[idx + 1] ?? lista[idx - 1]);
  return alvo?.id;
}

/** Cria uma interação de escada padrão para um objeto recém-posto quando o mapa tem mais de um andar. */
export function interacaoDeEscadaPadrao(
  m: Pick<MapaAtlas, 'levels' | 'groundLevelName'>,
  origem: string | null,
  receita: string,
): Interacao | null {
  if (!ehReceitaDeEscada(receita)) return null;
  const destino = andarVizinhoDeEscada(m, origem, receita);
  if (destino === undefined) return null;
  return { kind: 'stairs', on: false, targets: [], sound: null, clue: null, toLevel: destino };
}

/** Escadas no mesmo andar que uma peça a até `alcance` metros, da mais próxima à mais distante. */
export function escadasPerto(
  m: Pick<MapaAtlas, 'props'>,
  ponto: Ponto,
  andar: string | null,
  alcance = 1.5,
): Objeto[] {
  const achadas: { obj: Objeto; dist: number }[] = [];
  for (const o of Object.values(m.props)) {
    if (andarDe(o) !== andar || o.interaction?.kind !== 'stairs') continue;
    const dist = Math.hypot(o.position[0] - ponto[0], o.position[1] - ponto[1]);
    if (dist <= alcance) achadas.push({ obj: o, dist });
  }
  return achadas.sort((a, b) => a.dist - b.dist).map(x => x.obj);
}

/** Já existe alguma escada ou ponto de escada no andar `destino` dentro de `raio` metros de `ponto`? */
export function temEscadaDeChegada(
  m: Pick<MapaAtlas, 'props'>,
  destino: string | null,
  ponto: Ponto,
  raio = 2,
): boolean {
  for (const o of Object.values(m.props)) {
    if (andarDe(o) !== destino) continue;
    const ehEscada = o.interaction?.kind === 'stairs' || (o.source.kind === 'recipe' && ehReceitaDeEscada(o.source.recipe));
    if (!ehEscada) continue;
    if (Math.hypot(o.position[0] - ponto[0], o.position[1] - ponto[1]) <= raio) return true;
  }
  return false;
}

export interface AcaoDeEscada {
  escadaId: string;
  rotulo: string;
  destino: string | null;
  posicao: Ponto;
  subindo: boolean;
}

/** Descreve a ação de subir ou descer pela escada mais próxima de uma peça na sessão (até 1,5 m). */
export function acaoEscadaParaPeca(
  m: Pick<MapaAtlas, 'props' | 'levels' | 'groundLevelName'>,
  peca: Pick<Peca, 'position' | 'levelId'>,
): AcaoDeEscada | null {
  const origem = andarDe(peca);
  const esc = escadasPerto(m, peca.position, origem, 1.5).find(e => !e.interaction?.toMapId);
  if (!esc || esc.interaction?.kind !== 'stairs') return null;
  const dest = esc.interaction.toLevel ?? null;
  if (dest === origem) return null;
  const lista = listaDeAndares(m);
  const itemOrig = lista.find(a => a.id === origem);
  const itemDest = lista.find(a => a.id === dest);
  if (!itemOrig || !itemDest) return null;
  const subindo = itemDest.order > itemOrig.order;
  return {
    escadaId: esc.id,
    rotulo: `${subindo ? 'Subir' : 'Descer'} para ${itemDest.nome}`,
    destino: dest,
    posicao: esc.interaction.toPosition ? [esc.interaction.toPosition[0], esc.interaction.toPosition[1]] : [peca.position[0], peca.position[1]],
    subindo,
  };
}
