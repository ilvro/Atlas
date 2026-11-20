import { ehRef } from '#mesa';
import { ehCanonica } from './celulas.ts';
import { AREA_MINIMA_CONTORNO, MAX_VERTICES_CONTORNO, MIN_VERTICES_CONTORNO, areaDoPoligono, ehPoligonoSimples } from './formas-de-comodo.ts';
import { ErroDeValidacao, HEX, IDENT, e, type Esq } from './esquema.ts';
import { COLECOES, CUMEEIRAS_DE_TELHADO, DETALHES_DE_TELHADO, ESTADOS_FIGURA, ESTILOS_DE_LINHA_DA_GRADE, FORMAS_DE_TELHADO, MODOS_TELHADOS_SESSAO, SCHEMA_MAPA, TIPOS_DE_GRADE, VERSAO_MAPA, colunas, linhas, type MapaAtlas } from './mapa.ts';
import { momentoValido, type Momento } from './momentos.ts';

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

const contorno = e.lista(ponto, { min: MIN_VERTICES_CONTORNO, max: MAX_VERTICES_CONTORNO });

const desgasteDeTelhado = e.obj({
  moss: e.opt(unidade),
  dirt: e.opt(unidade),
  damage: e.opt(unidade),
  snow: e.opt(e.proprio((v, c) => {
    if (v !== 'auto') unidade.verificar(v, c);
  })),
});

const comodo = e.obj({
  id, name: nome, function: e.nulo(e.texto({ min: 1, max: 60 })), cells: faixas,
  outline: e.opt(e.proprio((v, c) => {
    contorno.verificar(v, c);
    const pts = v as readonly [number, number][];
    if (!ehPoligonoSimples(pts)) throw new ErroDeValidacao('O contorno do cômodo não pode se cruzar.', c);
    if (areaDoPoligono(pts) < AREA_MINIMA_CONTORNO) throw new ErroDeValidacao(`O contorno do cômodo precisa ter pelo menos ${AREA_MINIMA_CONTORNO} m².`, c);
  })),
  floor: e.obj({ material, seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }) }),
  wallpaper: e.nulo(e.obj({ material, seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }) })),
  wallFace: e.opt(material),
  wallStyle: e.nulo(e.um('box', 'solid')), palette: e.nulo(e.texto({ min: 1, max: 60 })),
  roof: e.obj({
    material: e.nulo(material),
    visible: e.bool(),
    shape: e.opt(e.um(...FORMAS_DE_TELHADO)),
    ridge: e.opt(e.um(...CUMEEIRAS_DE_TELHADO)),
    steep: e.opt(e.bool()),
    details: e.opt(e.lista(e.um(...DETALHES_DE_TELHADO), { max: 12 })),
    wear: e.opt(desgasteDeTelhado),
    seed: e.opt(e.num()),
  }), levelId: idOuNulo,
});
const parede = e.obj({
  id, path: e.lista(ponto, { min: 2, max: 5_000 }), height: e.num({ min: 0.1, max: 400 }), thickness: e.num({ min: 0.02, max: 5 }), material,
  kind: e.um('wall', 'low', 'fence', 'cliff'), blocks: e.obj({ move: e.bool(), sight: e.bool(), light: e.bool() }),
  drop: e.nulo(e.um('a', 'b')),
  source: e.nulo(e.proprio((v, c) => {
    // Origem da parede: cômodo, maciço ou degrau de relevo.
    if (v && typeof v === 'object' && 'terrainLayerId' in v) e.obj({ terrainLayerId: id }).verificar(v, c);
    else if (v && typeof v === 'object' && 'reliefStep' in v) e.obj({ reliefStep: e.num({ min: -200, max: 200 }) }).verificar(v, c);
    else e.obj({ roomId: id }).verificar(v, c);
  })),
  levelId: e.opt(idOuNulo),
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
  roomId: idOuNulo, blocks: e.obj({ move: e.bool(), sight: e.bool(), light: e.opt(e.bool()) }), castsShadow: e.bool(), harmonize: e.bool(),
  layer: e.opt(e.num({ inteiro: true, min: -100000, max: 100000 })),
  oculto: e.opt(e.bool()),
  flip: e.opt(e.bool()),
  opacity: e.opt(e.num({ min: 0.1, max: 1 })),
  levelId: e.opt(idOuNulo),
  interaction: e.nulo(e.obj({
    kind: e.um('switch', 'drawer', 'clue', 'note', 'stairs'),
    on: e.bool(),
    targets: e.lista(id, { max: 200 }),
    sound: e.nulo(ref),
    clue: e.nulo(ref),
    note: e.opt(e.texto({ max: 50_000 })),
    noteTitle: e.opt(e.texto({ max: 200 })),
    gmOnly: e.opt(e.bool()),
    toLevel: e.opt(idOuNulo),
    toPosition: e.opt(ponto),
  })),
});
const luz = e.obj({
  id, position: ponto, radius: e.num({ min: 0.1, max: 200 }), color: hex, intensity: e.num({ min: 0, max: 3 }), flicker: unidade,
  cone: e.nulo(e.obj({ angle: e.num({ min: 0.05, max: Math.PI * 2 }), direction: e.num({ min: -1000, max: 1000 }) })),
  ownerId: idOuNulo, power: e.um('grid', 'fire', 'battery', 'magic'), on: e.bool(), nightOnly: e.bool(), preset: e.nulo(e.texto({ min: 1, max: 40 })), rays: e.bool(),
  levelId: e.opt(idOuNulo),
});
const regiao = e.obj({
  id, polygon: e.lista(ponto, { min: 3, max: 2_000 }), kind: e.um('reveal', 'trigger', 'note', 'audio'), gmOnly: e.bool(), payload: e.json(), refs,
  levelId: e.opt(idOuNulo),
});
const presenca = e.obj({ id, brush: e.texto({ min: 1, max: 60 }), cells: faixas, intensity: unidade, seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }), gmOnly: e.bool(), levelId: e.opt(idOuNulo) });
const peca = e.obj({
  id, name: nome, portrait: refAsset,
  sprite: e.nulo(e.obj({ body: e.texto({ min: 1, max: 40 }), hair: e.texto({ min: 1, max: 40 }), outfit: e.texto({ min: 1, max: 40 }), accessories: e.lista(e.texto({ min: 1, max: 40 }), { max: 20 }), colors: e.json(2_000), seed: e.num({ inteiro: true, min: 0, max: 2 ** 31 }) })),
  facing: e.um('down', 'left', 'right', 'up'), position: ponto, size: e.num({ min: 0.5, max: 12 }), player: e.bool(),
  vision: e.obj({ radius: e.num({ min: 0, max: 200 }), dark: e.bool() }), lightId: idOuNulo,
  figure: e.obj({ state: e.um(...ESTADOS_FIGURA) }), refs,
  hp: e.opt(e.nulo(e.obj({ pv: e.num({ min: 0 }), pvMax: e.num({ min: 1 }) }))),
  tokenStyle: e.opt(e.um('coin', 'immersive')),
  portraitScale: e.opt(e.num({ min: 0.5, max: 3.0 })),
  levelId: e.opt(idOuNulo),
});

// Os campos do clima e do acabamento sem o `preset`: o mapa os guarda com ele, o clima salvo sem.
const CAMPOS_DO_CLIMA = {
  ambient: e.obj({ color: hex, intensity: unidade }),
  sun: e.nulo(e.obj({ angle: e.num({ min: -1000, max: 1000 }), color: hex, intensity: e.num({ min: 0, max: 3 }) })),
  time: e.texto({ min: 5, max: 5, padrao: /^([01]\d|2[0-3]):[0-5]\d$/ }),
  weather: e.obj({ rain: unidade, snow: unidade, fog: unidade, wind: e.num({ min: -1, max: 1 }), dust: unidade, embers: unidade, leaves: unidade, lightning: unidade }),
  gridPower: e.bool(),
  interiorLight: e.opt(e.num({ min: 0.05, max: 1 })),
};
const CAMPOS_DO_ACABAMENTO = {
  texture: unidade, vignette: unidade, saturation: e.num({ min: 0, max: 2 }), grain: unidade, tint: hex,
  grade: e.obj({ lift: e.num({ min: -1, max: 1 }), gamma: e.num({ min: 0.1, max: 4 }), gain: e.num({ min: 0, max: 4 }) }),
  edges: e.obj({ kind: e.um('none', 'clouds', 'dark', 'fog'), amount: unidade }), glow: unidade, relief: e.opt(unidade), ao: e.opt(unidade),
  exposure: e.opt(e.num({ min: 0, max: 4 })),
  split: e.opt(e.obj({ shadows: hex, highlights: hex, balance: e.num({ min: -1, max: 1 }), amount: unidade })),
};

export const ESQUEMA_MAPA: Esq = e.obj({
  schema: e.um(SCHEMA_MAPA), version: e.num({ inteiro: true, min: 1, max: 1_000 }),
  id, name: nome, revision: e.num({ inteiro: true, min: 0, max: 2 ** 31 }), createdAt: e.num({ min: 0 }), updatedAt: e.num({ min: 0 }),
  campanhaId: idOuNulo,
  levels: e.opt(e.porId(e.obj({ id, name: nome, order: e.num({ inteiro: true, min: -100, max: 100 }) }))),
  groundLevelName: e.opt(nome),
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
    settle: e.opt(e.bool()),
    facades: e.opt(e.bool()),
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
    submerged: e.opt(e.proprio((v, c) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroDeValidacao('Deve ser um dicionário.', c);
      for (const [k, x] of Object.entries(v)) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(k)) { throw new ErroDeValidacao('Identificador inválido.', `${c}.${k}`); };
        e.obj({ material, cells: faixas, order: e.opt(e.num({ inteiro: true, min: 0, max: 10_000 })) }).verificar(x, `${c}.${k}`);
      }
    })),
    relief: e.opt(e.obj({
      patamares: e.porId(e.obj({ id, altura: e.num({ min: -200, max: 200 }), cells: faixas })),
    })),
  }),
  rooms: e.porId(comodo), walls: e.porId(parede), openings: e.porId(abertura), props: e.porId(objeto), lights: e.porId(luz),
  regions: e.porId(regiao), presence: e.porId(presenca), tokens: e.porId(peca),
  comodosExtra: e.proprio((v, c) => {
    e.porId(e.obj({ id, leitura: e.texto({ max: 50_000 }), notasMestre: e.texto({ max: 50_000 }), refs })).verificar(v, c);
  }),
  session: e.obj({
    explored: e.nulo(e.obj({ res: e.num({ min: 0.25, max: 2 }), cells: faixas })),
    exploredLevels: e.opt(e.proprio((v, c) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroDeValidacao('Deve ser um dicionário.', c);
      for (const [k, x] of Object.entries(v)) {
        id.verificar(k, `${c}.${k}`);
        e.obj({ res: e.num({ min: 0.25, max: 2 }), cells: faixas }).verificar(x, `${c}.${k}`);
      }
    })),
    initiative: e.nulo(e.obj({
      order: e.lista(e.obj({ tokenId: id, value: e.num({ min: -999, max: 999 }) }), { max: 64 }),
      current: e.num({ inteiro: true, min: 0, max: 64 }), round: e.num({ inteiro: true, min: 1, max: 9999 }),
    })),
    revealed: e.lista(id, { max: 5_000 }), event: e.nulo(e.texto({ min: 1, max: 60 })),
    roofs: e.opt(e.um(...MODOS_TELHADOS_SESSAO)),
  }),
  audioCue: e.nulo(ref), notes: e.texto({ max: 200_000 }),
  climateAudio: e.proprio((v, c) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroDeValidacao('Deve ser um dicionário.', c);
    for (const [k, r] of Object.entries(v)) { id.verificar(k, `${c}.${k}`); ref.verificar(r, `${c}.${k}`); }
  }),
  customClimates: e.porId(e.obj({ id, name: nome, climate: e.obj(CAMPOS_DO_CLIMA), finish: e.obj(CAMPOS_DO_ACABAMENTO) })),
  moments: e.proprio((v, c) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErroDeValidacao('Deve ser um dicionário.', c);
    for (const [k, mto] of Object.entries(v)) {
      const erro = momentoValido(mto);
      if (erro) throw new ErroDeValidacao(erro, `${c}.${k}`);
      if ((mto as Momento).id !== k) throw new ErroDeValidacao('Identificador diferente da chave.', `${c}.${k}.id`);
    }
  }),
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
  const checarAndar = (lvl: string | null | undefined, caminho: string) => {
    if (lvl != null && !m.levels?.[lvl]) falha('Andar inexistente.', caminho);
  };
  if (m.levels) {
    const ordens = new Set<number>();
    for (const [aid, a] of Object.entries(m.levels)) {
      if (a.id !== aid) falha('Identificador diferente da chave.', `levels.${aid}.id`);
      if (a.order === 0) falha('O térreo (ordem 0) é o andar padrão e não vai em levels.', `levels.${aid}.order`);
      if (ordens.has(a.order)) falha('Ordem de andar repetida.', `levels.${aid}.order`);
      ordens.add(a.order);
    }
  }
  if (m.session.exploredLevels) {
    for (const k of Object.keys(m.session.exploredLevels)) checarAndar(k, `session.exploredLevels.${k}`);
  }

  for (const [rid, c] of Object.entries(m.rooms)) {
    checarAndar(c.levelId, `rooms.${rid}.levelId`);
    for (const [y, x0, n] of c.cells) if (y >= lins || x0 + n > cols) falha('Células fora dos limites do mapa.', `rooms.${rid}.cells`);
  }
  for (const [wid, p] of Object.entries(m.walls)) {
    checarAndar(p.levelId, `walls.${wid}.levelId`);
    if (p.source && 'roomId' in p.source && !m.rooms[p.source.roomId]) falha('Cômodo de origem inexistente.', `walls.${wid}.source.roomId`);
    if (p.source && 'terrainLayerId' in p.source && !m.terrain.layers[p.source.terrainLayerId]) falha('Camada de terreno de origem inexistente.', `walls.${wid}.source.terrainLayerId`);
    if (p.source && 'reliefStep' in p.source && p.kind !== 'cliff') falha('Origem de relevo vale só para escarpas.', `walls.${wid}.source`);
    // `drop` fora de uma escarpa não tem efeito; o validador não tem canal de aviso, então aceita (e o render ignora).
  }
  for (const [oid, a] of Object.entries(m.openings)) if (!m.walls[a.wallId]) falha('Parede inexistente.', `openings.${oid}.wallId`);
  for (const [pid, o] of Object.entries(m.props)) {
    checarAndar(o.levelId, `props.${pid}.levelId`);
    if (o.roomId && !m.rooms[o.roomId]) falha('Cômodo inexistente.', `props.${pid}.roomId`);
    for (const alvo of o.interaction?.targets ?? []) if (!m.lights[alvo]) falha('O interruptor controla uma luz que não existe.', `props.${pid}.interaction.targets`);
    if (o.interaction?.kind === 'stairs') {
      const dest = o.interaction.toLevel ?? null;
      checarAndar(dest, `props.${pid}.interaction.toLevel`);
      if (dest === (o.levelId ?? null)) falha('A escada precisa levar a um andar diferente do atual.', `props.${pid}.interaction.toLevel`);
    }
    if (o.wall && !m.walls[o.wall.wallId]) falha('Parede inexistente.', `props.${pid}.wall.wallId`);
    if ((o.elevation === 'wall') !== (o.wall !== null)) falha('Objeto de parede precisa de “wall”, e só ele.', `props.${pid}.wall`);
  }
  for (const [lid, l] of Object.entries(m.lights)) {
    checarAndar(l.levelId, `lights.${lid}.levelId`);
    if (l.ownerId && !m.props[l.ownerId] && !m.tokens[l.ownerId]) falha('Dono inexistente (objeto ou token).', `lights.${lid}.ownerId`);
  }
  for (const [rid, r] of Object.entries(m.regions)) checarAndar(r.levelId, `regions.${rid}.levelId`);
  for (const [tid, t] of Object.entries(m.tokens)) {
    checarAndar(t.levelId, `tokens.${tid}.levelId`);
    if (t.lightId && !m.lights[t.lightId]) falha('Luz inexistente.', `tokens.${tid}.lightId`);
  }
  for (const [cid, c] of Object.entries(m.customClimates)) if (c.id !== cid) falha('Identificador diferente da chave.', `customClimates.${cid}.id`);
  for (const [mid, mto] of Object.entries(m.moments)) {
    const erro = momentoValido(mto);
    if (erro) falha(erro, `moments.${mid}`);
    if (mto.id !== mid) falha('Identificador diferente da chave.', `moments.${mid}.id`);
  }
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
    checarAndar(p.levelId, `presence.${pid}.levelId`);
    if (p.id !== pid) falha('Identificador diferente da chave.', `presence.${pid}.id`);
    for (const [y, x0, n] of p.cells) if (y >= linT || x0 + n > celT) falha('Células de presença fora dos limites do mapa.', `presence.${pid}.cells`);
  }
  for (const [cid, camada] of Object.entries(m.terrain.layers)) {
    if (camada.id !== cid) falha('Identificador diferente da chave.', `terrain.layers.${cid}.id`);
    for (const [y, x0, n] of camada.cells) if (y >= linT || x0 + n > celT) falha('Células de terreno fora dos limites do mapa.', `terrain.layers.${cid}.cells`);
  }
  if (m.terrain.relief) {
    const porLinha = new Map<number, [number, number][]>();
    for (const [pid, pat] of Object.entries(m.terrain.relief.patamares)) {
      if (pat.id !== pid) falha('Identificador diferente da chave.', `terrain.relief.patamares.${pid}.id`);
      for (const [y, x0, n] of pat.cells) {
        if (y >= linT || x0 + n > celT) falha('Células de relevo fora dos limites do mapa.', `terrain.relief.patamares.${pid}.cells`);
        const intervalos = porLinha.get(y) ?? [];
        const x1 = x0 + n;
        for (const [a0, a1] of intervalos) {
          if (x0 < a1 && a0 < x1) falha('Patamares de relevo não podem se sobrepor.', `terrain.relief.patamares.${pid}.cells`);
        }
        intervalos.push([x0, x1]);
        porLinha.set(y, intervalos);
      }
    }
  }
}

/** Validação que devolve o erro em vez de lançar, para a interface. */
export function conferirMapa(valor: unknown): { ok: true } | { ok: false; erro: ErroDeValidacao } {
  try { validarMapa(valor); return { ok: true }; } catch (erro) {
    if (erro instanceof ErroDeValidacao) return { ok: false, erro };
    throw erro;
  }
}
