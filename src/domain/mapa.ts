import type { Ref } from '#mesa';
import type { Faixa } from './celulas.ts';

export const SCHEMA_MAPA = 'atlas.map';
export const VERSAO_MAPA = 1;

/** Unidade de mundo: metro. Coordenadas [x, y] com origem no canto superior esquerdo e y para baixo. */
export type Ponto = [x: number, y: number];
export interface RefAsset { id: string; hash: string }

export interface Grade { kind: 'square'; size: number; offset: Ponto; visible: boolean }
export interface Estilo {
  renderer: 'illustrated' | 'pixel';
  palette: string;
  walls: 'box' | 'solid';
  pixel: { pixelsPerCell: number; dither: 'none' | 'bayer4'; outline: boolean };
}
export interface Clima {
  preset: string;
  ambient: { color: string; intensity: number };
  sun: null | { angle: number; color: string; intensity: number };
  /** HH:MM */
  time: string;
}
export interface Acabamento { preset: string; texture: number; vignette: number; saturation: number; grain: number; grade: { lift: number; gamma: number; gain: number } }
export interface Memoria { sketch: boolean; paper: string; ink: string }
export interface Fundo { kind: 'solid' | 'texture'; color: string; material: string | null; title: null | { text: string; font: string; position: Ponto } }
export interface Terreno { resolution: number; base: string; layers: Record<string, { id: string; material: string; mask: RefAsset | null; order: number }> }

export interface Comodo {
  id: string; name: string; function: string | null; cells: Faixa[];
  floor: { material: string; seed: number }; wallpaper: { material: string; seed: number } | null;
  wallStyle: null | 'box' | 'solid'; palette: string | null;
  roof: { material: string | null; visible: boolean }; levelId: string | null;
}
export interface Parede {
  id: string; path: Ponto[]; height: number; thickness: number; material: string;
  kind: 'wall' | 'low' | 'fence' | 'cliff'; blocks: { move: boolean; sight: boolean; light: boolean };
  source: null | { roomId: string };
}
export interface Abertura {
  id: string; wallId: string; at: number; width: number; kind: 'door' | 'window' | 'arch' | 'secret';
  state: 'closed' | 'open' | 'locked'; material: string; som: Ref | null;
}
export type FonteObjeto = { kind: 'recipe'; recipe: string; seed: number; params: Record<string, unknown> } | { kind: 'asset'; assetId: string };
export interface Objeto {
  id: string; source: FonteObjeto; position: Ponto; rotation: number; scale: number;
  elevation: 'floor' | 'table' | 'wall' | 'ceiling';
  wall: null | { wallId: string; at: number; face: 'inner' | 'outer' };
  roomId: string | null; blocks: { move: boolean; sight: boolean }; castsShadow: boolean; harmonize: boolean;
}
export interface Luz {
  id: string; position: Ponto; radius: number; color: string; intensity: number; flicker: number;
  cone: null | { angle: number; direction: number }; ownerId: string | null;
  power: 'grid' | 'fire' | 'battery' | 'magic'; on: boolean; nightOnly: boolean;
}
export interface Regiao {
  id: string; polygon: Ponto[]; kind: 'reveal' | 'trigger' | 'note' | 'audio'; gmOnly: boolean;
  payload: Record<string, unknown>; refs: Ref[];
}
export interface Presenca { id: string; brush: string; mask: RefAsset | null; intensity: number; seed: number; gmOnly: boolean }
export const ESTADOS_FIGURA = ['normal', 'hurt', 'dying', 'unconscious', 'dead', 'maddened'] as const;
export interface Peca {
  id: string; name: string; portrait: RefAsset | null;
  sprite: null | { body: string; hair: string; outfit: string; accessories: string[]; colors: Record<string, string>; seed: number };
  facing: 'down' | 'left' | 'right' | 'up'; position: Ponto; size: number;
  vision: { radius: number; dark: boolean }; lightId: string | null;
  figure: { state: (typeof ESTADOS_FIGURA)[number] }; refs: Ref[];
}
export interface NotaDeComodo { id: string; leitura: string; notasMestre: string; refs: Ref[] }
export interface Sessao {
  explored: RefAsset | null;
  initiative: null | { order: { tokenId: string; value: number }[]; current: number; round: number };
  revealed: string[]; event: string | null;
}

/** O documento do mapa. Guarda significado (cômodos, paredes, receitas), nunca pixels de objetos. */
export interface MapaAtlas {
  schema: typeof SCHEMA_MAPA; version: number;
  id: string; name: string; revision: number; createdAt: number; updatedAt: number;
  campanhaId: string | null;
  grid: Grade; bounds: { width: number; height: number };
  style: Estilo; climate: Clima; finish: Acabamento; memory: Memoria; backdrop: Fundo; terrain: Terreno;
  rooms: Record<string, Comodo>; walls: Record<string, Parede>; openings: Record<string, Abertura>;
  props: Record<string, Objeto>; lights: Record<string, Luz>; regions: Record<string, Regiao>;
  presence: Record<string, Presenca>; tokens: Record<string, Peca>;
  comodosExtra: Record<string, NotaDeComodo>;
  session: Sessao; audioCue: Ref | null; notes: string;
}

/** Coleções de entidades por identificador: as que o editor seleciona, move e remove. */
export const COLECOES = ['rooms', 'walls', 'openings', 'props', 'lights', 'regions', 'presence', 'tokens'] as const;
export type NomeColecao = (typeof COLECOES)[number];

export interface OpcoesNovoMapa {
  nome?: string; id?: string; agora?: number;
  largura?: number; altura?: number; celula?: number; campanhaId?: string | null;
}

const novoId = () => crypto.randomUUID();

/** Um mapa vazio, válido, pronto para receber o primeiro cômodo. */
export function criarMapa(o: OpcoesNovoMapa = {}): MapaAtlas {
  const t = o.agora ?? Date.now(), celula = o.celula ?? 1.5;
  return {
    schema: SCHEMA_MAPA, version: VERSAO_MAPA,
    id: o.id ?? novoId(), name: o.nome ?? 'Mapa sem nome', revision: 0, createdAt: t, updatedAt: t,
    campanhaId: o.campanhaId ?? null,
    grid: { kind: 'square', size: celula, offset: [0, 0], visible: true },
    bounds: { width: o.largura ?? 45, height: o.altura ?? 30 },
    style: { renderer: 'illustrated', palette: 'investigacao-sepia', walls: 'box', pixel: { pixelsPerCell: 16, dither: 'bayer4', outline: true } },
    climate: { preset: 'dia', ambient: { color: '#d1ccc0', intensity: 0.82 }, sun: { angle: 0.6, color: '#fff2d6', intensity: 1 }, time: '14:30' },
    finish: { preset: 'neutro', texture: 0.2, vignette: 0.28, saturation: 1, grain: 0.03, grade: { lift: 0, gamma: 1, gain: 1 } },
    memory: { sketch: true, paper: 'papel-claro', ink: '#241b14' },
    backdrop: { kind: 'solid', color: '#07080b', material: null, title: null },
    terrain: { resolution: 0.25, base: 'terra', layers: {} },
    rooms: {}, walls: {}, openings: {}, props: {}, lights: {}, regions: {}, presence: {}, tokens: {},
    comodosExtra: {},
    session: { explored: null, initiative: null, revealed: [], event: null },
    audioCue: null, notes: '',
  };
}

/** Uma cópia pronta para outra sessão: o mapa fica, o que aconteceu na sessão não. */
export function duplicarParaNovaSessao(mapa: MapaAtlas, o: { id?: string; agora?: number; nome?: string } = {}): MapaAtlas {
  const t = o.agora ?? Date.now(), copia = structuredClone(mapa);
  return { ...copia, id: o.id ?? novoId(), name: o.nome ?? `${mapa.name} (cópia)`, revision: 0, createdAt: t, updatedAt: t, session: { explored: null, initiative: null, revealed: [], event: null } };
}

/** O que conta para saber se o mapa mudou: tudo menos revisão e carimbos de tempo. */
export function conteudo(mapa: MapaAtlas): string {
  const { revision: _r, createdAt: _c, updatedAt: _u, ...corpo } = mapa;
  return JSON.stringify(corpo);
}

/** Células do grid que cobrem o mapa. */
export const colunas = (m: Pick<MapaAtlas, 'bounds' | 'grid'>) => Math.ceil(m.bounds.width / m.grid.size);
export const linhas = (m: Pick<MapaAtlas, 'bounds' | 'grid'>) => Math.ceil(m.bounds.height / m.grid.size);
