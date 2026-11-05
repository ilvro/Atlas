import type { Ref } from '#mesa';
import type { Faixa } from './celulas.ts';

export const SCHEMA_MAPA = 'atlas.map';
export const VERSAO_MAPA = 5;

/** Unidade de mundo: metro. Coordenadas [x, y] com origem no canto superior esquerdo e y para baixo. */
export type Ponto = [x: number, y: number];
export interface RefAsset { id: string; hash: string }

export interface Grade { kind: 'square'; size: number; offset: Ponto; visible: boolean }
export interface Estilo {
  renderer: 'illustrated' | 'pixel';
  palette: string;
  walls: 'box' | 'solid';
  /** O gênero do mapa (`GENEROS`): guia as sugestões do assistente. Um id desconhecido vale como 'investigacao'. */
  genre: string;
  pixel: { pixelsPerCell: number; dither: 'none' | 'bayer4'; outline: boolean };
}
/** O tempo que faz: cada campo vai de 0 a 1 (o vento, de −1 a 1: o sinal é a direção). */
export interface Tempo { rain: number; snow: number; fog: number; wind: number; dust: number; embers: number; leaves: number; lightning: number }
export const CAMPOS_DO_TEMPO = ['rain', 'snow', 'fog', 'wind', 'dust', 'embers', 'leaves', 'lightning'] as const;
export interface Clima {
  preset: string;
  ambient: { color: string; intensity: number };
  sun: null | { angle: number; color: string; intensity: number };
  /** HH:MM */
  time: string;
  weather: Tempo;
  /** A rede elétrica está ligada? Desligada (apagão), as luzes `power: 'grid'` apagam. */
  gridPower: boolean;
}
export interface Acabamento { preset: string; texture: number; vignette: number; saturation: number; grain: number; /** Cor que tinge a cena; #ffffff não tinge. */ tint: string; grade: { lift: number; gamma: number; gain: number } }
/** Um clima do usuário: o clima e o acabamento de um momento, guardados com nome para voltar a eles. */
export interface ClimaSalvo { id: string; name: string; climate: Omit<Clima, 'preset'>; finish: Omit<Acabamento, 'preset'> }
export interface Memoria { sketch: boolean; paper: string; ink: string }
export interface Fundo { kind: 'solid' | 'texture'; color: string; material: string | null; title: null | { text: string; font: string; position: Ponto } }
/** Camadas de terreno pintadas por células de `resolution` metros (em RLE). `base: 'vazio'` deixa ver o fundo do mapa. */
export interface Terreno { resolution: number; base: string; layers: Record<string, { id: string; material: string; cells: Faixa[]; order: number }> }

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
  /** De que lado a porta abre: 'a' (esquerda/cima da parede) ou 'b' (direita/baixo). */
  swing: 'a' | 'b';
}
export type FonteObjeto = { kind: 'recipe'; recipe: string; seed: number; params: Record<string, unknown> } | { kind: 'asset'; assetId: string };
export interface Objeto {
  id: string; source: FonteObjeto; position: Ponto; rotation: number; scale: number;
  elevation: 'floor' | 'table' | 'wall' | 'ceiling';
  wall: null | { wallId: string; at: number; face: 'inner' | 'outer' };
  roomId: string | null; blocks: { move: boolean; sight: boolean }; castsShadow: boolean; harmonize: boolean;
  /** O que o mestre pode acionar na sessão (interruptor, gaveta, pista); `null` é um objeto comum. */
  interaction: Interacao | null;
  /** Ordem de empilhamento entre objetos: maior fica por cima; ausente vale 0. Empates seguem a ordem de criação. */
  layer?: number;
}
/** `targets` vazio num interruptor = as luzes `power: 'grid'` do cômodo do objeto. `clue` só vai ao jogador depois de revelada. */
export interface Interacao { kind: 'switch' | 'drawer' | 'clue'; on: boolean; targets: string[]; sound: Ref | null; clue: Ref | null }
export interface Luz {
  id: string; position: Ponto; radius: number; color: string; intensity: number; flicker: number;
  cone: null | { angle: number; direction: number }; ownerId: string | null;
  power: 'grid' | 'fire' | 'battery' | 'magic'; on: boolean; nightOnly: boolean;
  /** A predefinição que originou a luz (vela, lanterna…), só para a interface; os valores é que valem. */
  preset: string | null;
}
export interface Regiao {
  id: string; polygon: Ponto[]; kind: 'reveal' | 'trigger' | 'note' | 'audio'; gmOnly: boolean;
  payload: Record<string, unknown>; refs: Ref[];
}
/** Presença pintada (musgo, sangue, mofo…) em células de `terrain.resolution` metros, em RLE: como o terreno, sem imagem. */
export interface Presenca { id: string; brush: string; cells: Faixa[]; intensity: number; seed: number; gmOnly: boolean }
export const ESTADOS_FIGURA = ['normal', 'hurt', 'dying', 'unconscious', 'dead', 'maddened'] as const;
export interface Peca {
  id: string; name: string; portrait: RefAsset | null;
  sprite: null | { body: string; hair: string; outfit: string; accessories: string[]; colors: Record<string, string>; seed: number };
  facing: 'down' | 'left' | 'right' | 'up'; position: Ponto; size: number;
  /** É uma peça de jogador? A visão (névoa) e o explorado vêm só das peças de jogador. */
  player: boolean;
  vision: { radius: number; dark: boolean }; lightId: string | null;
  figure: { state: (typeof ESTADOS_FIGURA)[number] }; refs: Ref[];
}
export interface NotaDeComodo { id: string; leitura: string; notasMestre: string; refs: Ref[] }
export interface Sessao {
  /** `res`: lado de cada célula do explorado, em metros (independe da grade do mapa); `cells` são faixas `[y, x0, n]` nessa malha. */
  explored: null | { res: number; cells: Faixa[] };
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
  /** Que cena do Jukebox toca em cada clima (id da predefinição ou do clima salvo). */
  climateAudio: Record<string, Ref>;
  customClimates: Record<string, ClimaSalvo>;
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
    style: { renderer: 'illustrated', palette: 'investigacao-sepia', walls: 'box', genre: 'investigacao', pixel: { pixelsPerCell: 16, dither: 'bayer4', outline: true } },
    climate: { preset: 'dia', ambient: { color: '#d1ccc0', intensity: 0.82 }, sun: { angle: 0.6, color: '#fff2d6', intensity: 1 }, time: '14:30', weather: { rain: 0, snow: 0, fog: 0, wind: 0, dust: 0, embers: 0, leaves: 0, lightning: 0 }, gridPower: true },
    finish: { preset: 'neutro', texture: 0.2, vignette: 0.28, saturation: 1, grain: 0.03, tint: '#ffffff', grade: { lift: 0, gamma: 1, gain: 1 } },
    memory: { sketch: true, paper: 'papel-claro', ink: '#241b14' },
    backdrop: { kind: 'solid', color: '#07080b', material: null, title: null },
    terrain: { resolution: 0.25, base: 'vazio', layers: {} },
    rooms: {}, walls: {}, openings: {}, props: {}, lights: {}, regions: {}, presence: {}, tokens: {},
    comodosExtra: {},
    session: { explored: null, initiative: null, revealed: [], event: null },
    audioCue: null, notes: '', climateAudio: {}, customClimates: {},
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
