import { ehRef } from '#mesa';
import { ehCanonica } from './celulas.ts';
import { ErroDeValidacao, HEX, IDENT, e, type Esq } from './esquema.ts';
import { COLECOES, ESTADOS_FIGURA, ESTILOS_DE_LINHA_DA_GRADE, SCHEMA_MAPA, TIPOS_DE_GRADE, VERSAO_MAPA, colunas, linhas, type MapaAtlas } from './mapa.ts';

const ponto = e.tupla(e.num({ min: -10_000, max: 10_000 }), e.num({ min: -10_000, max: 10_000 }));
const id = e.texto({ min: 1, max: 64, padrao: IDENT });
const idOuNulo = e.nulo(id);
const hex = e.texto({ min: 7, max: 7, padrao: HEX });
const nome = e.texto({ min: 1, max: 120 });
const material = e.texto({ min: 1, max: 80 });
const unidade = e.num({ min: 0, max: 1 });
const refAsset = e.nulo(e.obj({ id: e.texto({ min: 1, max: 80 }), hash: e.texto({ min: 8, max: 128 }) }));
const ref = e.proprio((v, c) => { if (!ehRef(v)) throw new ErroDeValidacao('Deve ser uma referência da mesa.', c); });
const refs = e.lista(ref, { max: 64 });
const faixa = e.tupla(e.num({ inteiro: true, min: 0, max: 100_000 }), e.num({ inteiro: true, min: 0, max: 100_000 }), e.num({ inteiro: true, min: 1, max: 100_000 }));
const faixas = e.proprio((v, c) => { e.lista(faixa, { max: 200_000 }).verificar(v, c); if (!ehCanonica(v as never)) throw new ErroDeValidacao('As faixas devem estar ordenadas, sem sobreposição nem emendas.', c); });

const comodo = e.obj({
  id, name: nome, function: e.nulo(e.texto({ min: 1, max: 60 })), cells: faixas,
  floor: e.obj({ material, seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }) }),
  wallpaper: e.nulo(e.obj({ material, seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }) })),
  wallStyle: e.nulo(e.um('box', 'solid')), palette: e.nulo(e.texto({ min: 1, max: 60 })),
  roof: e.obj({ material: e.nulo(material), visible: e.bool() }), levelId: idOuNulo,
});
const parede = e.obj({
  id, path: e.lista(ponto, { min: 2, max: 5_000 }), height: e.num({ min: 0.1, max: 30 }), thickness: e.num({ min: 0.02, max: 5 }), material,
  kind: e.um('wall', 'low', 'fence', 'cliff'), blocks: e.obj({ move: e.bool(), sight: e.bool(), light: e.bool() }),
  drop: e.nulo(e.um('a', 'b')),
  source: e.nulo(e.proprio((v, c) => {
    // Origem da parede: um cômodo ou uma camada de terreno (o maciço que gerou o contorno).
    if (v && typeof v === 'object' && 'terrainLayerId' in v) e.obj({ terrainLayerId: id }).verificar(v, c); else e.obj({ roomId: id }).verificar(v, c);
  })),
});
const abertura = e.obj({
  id, wallId: id, at: unidade, width: e.num({ min: 0.2, max: 10 }), kind: e.um('door', 'window', 'arch', 'secret'),
  state: e.um('closed', 'open', 'locked'), material, som: e.nulo(ref), swing: e.um('a', 'b'),
});
const objeto = e.obj({
  id,
  source: e.uniao('kind', {
    recipe: e.obj({ kind: e.um('recipe'), recipe: e.texto({ min: 1, max: 80 }), seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }), params: e.json() }),
    asset: e.obj({ kind: e.um('asset'), assetId: e.texto({ min: 1, max: 100 }) }),
  }),
  position: ponto, rotation: e.num({ min: -1000, max: 1000 }), scale: e.num({ min: 0.05, max: 50 }),
  elevation: e.um('floor', 'table', 'wall', 'ceiling', 'underwater'),
  wall: e.nulo(e.obj({ wallId: id, at: unidade, face: e.um('inner', 'outer') })),
  roomId: idOuNulo, blocks: e.obj({ move: e.bool(), sight: e.bool() }), castsShadow: e.bool(), harmonize: e.bool(),
  layer: e.opt(e.num({ inteiro: true, min: -100000, max: 100000 })),
  interaction: e.nulo(e.obj({
    kind: e.um('switch', 'drawer', 'clue', 'note'),
    on: e.bool(),
    targets: e.lista(id, { max: 200 }),
    sound: e.nulo(ref),
    clue: e.nulo(ref),
    note: e.opt(e.texto({ max: 50_000 })),
    noteTitle: e.opt(e.texto({ max: 200 })),
    gmOnly: e.opt(e.bool()),
  })),
});
const luz = e.obj({
  id, position: ponto, radius: e.num({ min: 0.1, max: 200 }), color: hex, intensity: e.num({ min: 0, max: 3 }), flicker: unidade,
  cone: e.nulo(e.obj({ angle: e.num({ min: 0.05, max: Math.PI * 2 }), direction: e.num({ min: -1000, max: 1000 }) })),
  ownerId: idOuNulo, power: e.um('grid', 'fire', 'battery', 'magic'), on: e.bool(), nightOnly: e.bool(), preset: e.nulo(e.texto({ min: 1, max: 40 })), rays: e.bool(),
});
const regiao = e.obj({
  id, polygon: e.lista(ponto, { min: 3, max: 2_000 }), kind: e.um('reveal', 'trigger', 'note', 'audio'), gmOnly: e.bool(), payload: e.json(), refs,
});
const presenca = e.obj({ id, brush: e.texto({ min: 1, max: 60 }), cells: faixas, intensity: unidade, seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }), gmOnly: e.bool() });
const peca = e.obj({
  id, name: nome, portrait: refAsset,
  sprite: e.nulo(e.obj({ body: e.texto({ min: 1, max: 40 }), hair: e.texto({ min: 1, max: 40 }), outfit: e.texto({ min: 1, max: 40 }), accessories: e.lista(e.texto({ min: 1, max: 40 }), { max: 20 }), colors: e.json(2_000), seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }) })),
  facing: e.um('down', 'left', 'right', 'up'), position: ponto, size: e.num({ min: 0.5, max: 12 }), player: e.bool(),
  vision: e.obj({ radius: e.num({ min: 0, max: 200 }), dark: e.bool() }), lightId: idOuNulo,
  figure: e.obj({ state: e.um(...ESTADOS_FIGURA) }), refs,
  hp: e.opt(e.nulo(e.obj({ pv: e.num({ min: 0 }), pvMax: e.num({ min: 1 }) }))),
  tokenStyle: e.opt(e.um('coin', 'immersive')),
  portraitScale: e.opt(e.num({ min: 0.5, max: 3.0 })),
});

// Os campos do clima e do acabamento sem o `preset`: o mapa os guarda com ele, o clima salvo sem.
const CAMPOS_DO_CLIMA = {
  ambient: e.obj({ color: hex, intensity: unidade }),
  sun: e.nulo(e.obj({ angle: e.num({ min: -1000, max: 1000 }), color: hex, intensity: e.num({ min: 0, max: 3 }) })),
  time: e.texto({ min: 5, max: 5, padrao: /^([01]\d|2[0-3]):[0-5]\d$/ }),
  weather: e.obj({ rain: unidade, snow: unidade, fog: unidade, wind: e.num({ min: -1, max: 1 }), dust: unidade, embers: unidade, leaves: unidade, lightning: unidade }),
  gridPower: e.bool(),
};
const CAMPOS_DO_ACABAMENTO = {
  texture: unidade, vignette: unidade, saturation: e.num({ min: 0, max: 2 }), grain: unidade, tint: hex,
  grade: e.obj({ lift: e.num({ min: -1, max: 1 }), gamma: e.num({ min: 0.1, max: 4 }), gain: e.num({ min: 0, max: 4 }) }),
  edges: e.obj({ kind: e.um('none', 'clouds', 'dark', 'fog'), amount: unidade }), glow: unidade,
};

export const ESQUEMA_MAPA: Esq = e.obj({
  schema: e.um(SCHEMA_MAPA), version: e.num({ inteiro: true, min: 1, max: 1_000 }),
  id, name: nome, revision: e.num({ inteiro: true, min: 0, max: 2 ** 31 }), createdAt: e.num({ min: 0 }), updatedAt: e.num({ min: 0 }),
  campanhaId: idOuNulo,
  grid: e.obj({
    kind: e.um(...TIPOS_DE_GRADE),
    size: e.num({ min: 0.25, max: 10 }),
    offset: ponto,
    visible: e.bool(),
    snap: e.bool(),
    lineStyle: e.um(...ESTILOS_DE_LINHA_DA_GRADE),
    color: e.proprio((v, c) => { if (v !== 'auto') hex.verificar(v, c); }),
    opacity: e.num({ min: 0.05, max: 1 }),
    lineWidth: e.num({ min: 0.5, max: 5 }),
  }),
  bounds: e.obj({ width: e.num({ min: 3, max: 600 }), height: e.num({ min: 3, max: 600 }) }),
  style: e.obj({
    renderer: e.um('illustrated', 'pixel'), palette: e.texto({ min: 1, max: 60 }), walls: e.um('box', 'solid'), genre: e.texto({ min: 1, max: 40 }),
    pixel: e.obj({ pixelsPerCell: e.num({ inteiro: true, min: 8, max: 64 }), dither: e.um('none', 'bayer4'), outline: e.bool() }),
  }),
  climate: e.obj({ preset: e.texto({ min: 1, max: 60 }), ...CAMPOS_DO_CLIMA }),
  finish: e.obj({ preset: e.texto({ min: 1, max: 60 }), ...CAMPOS_DO_ACABAMENTO }),
  memory: e.obj({ sketch: e.bool(), paper: e.texto({ min: 1, max: 60 }), ink: hex }),
  backdrop: e.obj({
    kind: e.um('solid', 'texture'), color: hex, material: e.nulo(material),
    title: e.nulo(e.obj({ text: e.texto({ min: 1, max: 120 }), font: e.texto({ min: 1, max: 80 }), position: ponto })),
  }),
  terrain: e.obj({
    resolution: e.num({ min: 0.05, max: 2 }), base: material,
    layers: e.porId(e.obj({ id, material, cells: faixas, order: e.num({ inteiro: true, min: 0, max: 10_000 }), flow: e.nulo(e.obj({ angle: e.num({ min: -1000, max: 1000 }), speed: e.num({ min: 0, max: 3 }) })) })),
  }),
  rooms: e.porId(comodo), walls: e.porId(parede), openings: e.porId(abertura), props: e.porId(objeto), lights: e.porId(luz),
  regions: e.porId(regiao), presence: e.porId(presenca), tokens: e.porId(peca),
  comodosExtra: e.proprio((v, c) => {
    e.porId(e.obj({ id, leitura: e.texto({ max: 50_000 }), notasMestre: e.texto({ max: 50_000 }), refs })).verificar(v, c);
  }),
  session: e.obj({
    explored: e.nulo(e.obj({ res: e.num({ min: 0.25, max: 2 }), cells: faixas })),
    initiative: e.nulo(e.obj({
      order: e.lista(e.obj({ tokenId: id, value: e.num({ min: -999, max: 999 }) }), { max: 64 }),
      current: e.num({ inteiro: true, min: 0, max: 64 }), round: e.num({ inteiro: true, min: 1, max: 9999 }),
    })),
    revealed: e.lista(id, { max: 5_000 }), event: e.nulo(e.texto({ min: 1, max: 60 })),
  }),
  audioCue: e.nulo(ref), notes: e.texto({ max: 200_000 }),
  climateAudio: e.proprio((v, c) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroDeValidacao('Deve ser um dicionário.', c);
    for (const [k, r] of Object.entries(v)) { id.verificar(k, `${c}.${k}`); ref.verificar(r, `${c}.${k}`); }
  }),
  customClimates: e.porId(e.obj({ id, name: nome, climate: e.obj(CAMPOS_DO_CLIMA), finish: e.obj(CAMPOS_DO_ACABAMENTO) })),
});

/**
 * Valida o mapa por inteiro: o formato (com o caminho exato do erro) e as relações entre as partes —
 * toda referência a outra entidade precisa apontar para algo que existe.
 */
export function validarMapa(valor: unknown): asserts valor is MapaAtlas {
  ESQUEMA_MAPA.verificar(valor, '');
  const m = valor as MapaAtlas;
  if (m.version !== VERSAO_MAPA) throw new ErroDeValidacao(`Versão ${m.version}; esta validação é da ${VERSAO_MAPA}. Migre antes.`, 'version');
  const falha = (msg: string, c: string): never => { throw new ErroDeValidacao(msg, c); };
  const cols = colunas(m), lins = linhas(m);

  for (const [rid, c] of Object.entries(m.rooms)) {
    for (const [y, x0, n] of c.cells) if (y >= lins || x0 + n > cols) falha('Células fora dos limites do mapa.', `rooms.${rid}.cells`);
  }
  for (const [wid, p] of Object.entries(m.walls)) {
    if (p.source && 'roomId' in p.source && !m.rooms[p.source.roomId]) falha('Cômodo de origem inexistente.', `walls.${wid}.source.roomId`);
    if (p.source && 'terrainLayerId' in p.source && !m.terrain.layers[p.source.terrainLayerId]) falha('Camada de terreno de origem inexistente.', `walls.${wid}.source.terrainLayerId`);
    // `drop` fora de uma escarpa não tem efeito; o validador não tem canal de aviso, então aceita (e o render ignora).
  }
  for (const [oid, a] of Object.entries(m.openings)) if (!m.walls[a.wallId]) falha('Parede inexistente.', `openings.${oid}.wallId`);
  for (const [pid, o] of Object.entries(m.props)) {
    if (o.roomId && !m.rooms[o.roomId]) falha('Cômodo inexistente.', `props.${pid}.roomId`);
    for (const alvo of o.interaction?.targets ?? []) if (!m.lights[alvo]) falha('O interruptor controla uma luz que não existe.', `props.${pid}.interaction.targets`);
    if (o.wall && !m.walls[o.wall.wallId]) falha('Parede inexistente.', `props.${pid}.wall.wallId`);
    if ((o.elevation === 'wall') !== (o.wall !== null)) falha('Objeto de parede precisa de “wall”, e só ele.', `props.${pid}.wall`);
  }
  for (const [lid, l] of Object.entries(m.lights)) if (l.ownerId && !m.props[l.ownerId] && !m.tokens[l.ownerId]) falha('Dono inexistente (objeto ou token).', `lights.${lid}.ownerId`);
  for (const [tid, t] of Object.entries(m.tokens)) if (t.lightId && !m.lights[t.lightId]) falha('Luz inexistente.', `tokens.${tid}.lightId`);
  for (const [cid, c] of Object.entries(m.customClimates)) if (c.id !== cid) falha('Identificador diferente da chave.', `customClimates.${cid}.id`);
  for (const rid of Object.keys(m.comodosExtra)) if (!m.rooms[rid]) falha('Cômodo inexistente.', `comodosExtra.${rid}`);
  const ini = m.session.initiative;
  if (ini) {
    const vistos = new Set<string>();
    ini.order.forEach((x, i) => {
      if (!m.tokens[x.tokenId]) falha('Token inexistente.', `session.initiative.order[${i}].tokenId`);
      if (vistos.has(x.tokenId)) falha('Token repetido.', `session.initiative.order[${i}].tokenId`);
      vistos.add(x.tokenId);
    });
    if (ini.current >= Math.max(1, ini.order.length)) falha('Vez fora da ordem.', 'session.initiative.current');
  }
  for (const alvo of m.session.revealed) if (!COLECOES.some(c => (m[c] as Record<string, unknown>)[alvo])) falha('Alvo revelado inexistente.', 'session.revealed');
  const celT = Math.ceil(m.bounds.width / m.terrain.resolution), linT = Math.ceil(m.bounds.height / m.terrain.resolution);
  for (const [pid, p] of Object.entries(m.presence)) {
    if (p.id !== pid) falha('Identificador diferente da chave.', `presence.${pid}.id`);
    for (const [y, x0, n] of p.cells) if (y >= linT || x0 + n > celT) falha('Células de presença fora dos limites do mapa.', `presence.${pid}.cells`);
  }
  for (const [cid, camada] of Object.entries(m.terrain.layers)) {
    if (camada.id !== cid) falha('Identificador diferente da chave.', `terrain.layers.${cid}.id`);
    for (const [y, x0, n] of camada.cells) if (y >= linT || x0 + n > celT) falha('Células de terreno fora dos limites do mapa.', `terrain.layers.${cid}.cells`);
  }
}

/** Validação que devolve o erro em vez de lançar, para a interface. */
export function conferirMapa(valor: unknown): { ok: true } | { ok: false; erro: ErroDeValidacao } {
  try { validarMapa(valor); return { ok: true }; } catch (erro) {
    if (erro instanceof ErroDeValidacao) return { ok: false, erro };
    throw erro;
  }
}
