import { ACERVO } from '../procedural/acervo.ts';
import { codificar, decodificar, unir, type Faixa } from './celulas.ts';
import type { Edificio } from './edificios.ts';
import type { Abertura, MapaAtlas, ModoDeVisao, Objeto, Peca, Ponto, Sessao } from './mapa.ts';
import { IndiceDeSegmentos, oclusores, oclusoresDeObjetos, poligonoDeVisaoDarkwood, poligonoIluminado, segmentosParaFonte } from './visibilidade.ts';

/** Lado de cada célula do explorado, em metros. */
export const RES_NEVOA = 0.5;
/** Abertura padrão do cone de visão direcional em graus (estilo Darkwood). */
export const ABERTURA_VISAO_PADRAO = 85;
/** Raio padrão da bolha de percepção imediata 360° em metros. */
export const PROXIMIDADE_VISAO_PADRAO = 1.8;

const ANGULO_DO_LADO: Record<Peca['facing'], number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
};

const RECEITAS_DOCUMENTOS_DINAMICOS = new Set([
  'papeis',
  'jornais',
  'livro.aberto',
  'livros.pilha',
  'mapa-do-tesouro',
  'tinteiro.pena',
]);

/**
 * Indica se o objeto representa um detalhe dinâmico/documento (pista, nota, item solto sobre mesa ou papelada)
 * que só deve ficar visível dentro da linha de visão ativa dos jogadores, sumindo na memória escurecida.
 */
export function objetoDinamicoDeVisao(o: Pick<Objeto, 'elevation' | 'interaction' | 'source'>): boolean {
  if (o.interaction?.kind === 'clue' || o.interaction?.kind === 'note') return true;
  if (o.elevation === 'table') return true;
  if (o.source.kind === 'recipe' && RECEITAS_DOCUMENTOS_DINAMICOS.has(ACERVO.idDaFonte(o.source))) return true;
  return false;
}

/** Modo efetivo de visão da peça ('cone' ou 'circle'). Segue `vision.mode` quando definido; padrão é 'circle' (360°). */
export function modoDeVisaoDaPeca(_m: Pick<MapaAtlas, 'memory'>, t: Pick<Peca, 'vision'>): ModoDeVisao {
  if (t.vision.mode === 'cone' || t.vision.mode === 'circle') return t.vision.mode;
  return 'circle';
}

/** Direção do olhar da peça em radianos: `vision.direction` explícita, direção do cone da luz portada acesa, ou `facing`. */
export function direcaoDeVisaoDaPeca(
  m: Pick<MapaAtlas, 'lights'>,
  t: Pick<Peca, 'vision' | 'lightId' | 'facing'>,
): number {
  if (typeof t.vision.direction === 'number' && Number.isFinite(t.vision.direction)) return t.vision.direction;
  const luz = t.lightId ? m.lights?.[t.lightId] : undefined;
  if (luz?.on && luz.cone) return luz.cone.direction;
  return ANGULO_DO_LADO[t.facing] ?? 0;
}

/** Filtro de visão: controla quais tokens de jogador contribuem com visão na tela. */
export type FiltroDeVisao =
  | { tipo: 'todos' }
  | { tipo: 'foco'; tokenId: string }
  | { tipo: 'individual'; grupos?: Record<string, string> };

/**
 * A peça de jogador aparece sempre (sem depender de ser vista)? Sim, salvo quando a tela está presa à visão de **um** personagem:
 * então só ele aparece sempre, e os outros jogadores seguem a regra das ameaças (só se estiverem no alcance da visão dele).
 */
export function pecaSempreVisivel(t: Pick<Peca, 'id' | 'player'>, filtro?: FiltroDeVisao | null): boolean {
  if (!t.player) return false;
  return !filtro || filtro.tipo !== 'foco' || filtro.tokenId === t.id;
}

/** Seleciona os tokens de jogador que contribuem para a visão ativa no andar atual conforme `filtro` e `minhasFichas`. */
export function tokensDeVisaoAtivos(
  m: Pick<MapaAtlas, 'tokens'>,
  filtro?: FiltroDeVisao | null,
  minhasFichas?: readonly string[] | null,
): Peca[] {
  const jogadores = Object.values(m.tokens).filter(t => t.player);
  if (!filtro || filtro.tipo === 'todos') return jogadores;
  if (filtro.tipo === 'foco') {
    const t = m.tokens[filtro.tokenId];
    return t ? [t] : [];
  }
  if (!minhasFichas || minhasFichas.length === 0) return jogadores;
  const alvo = new Set(minhasFichas);
  const proprios = jogadores.filter(t =>
    t.refs.some(r => r.app === 'ficha' && r.tipo === 'ficha' && alvo.has(r.id)),
  );
  if (!proprios.length) return [];
  const grupos = filtro.grupos ?? {};
  const gruposDosProprios = new Set<string>();
  for (const t of proprios) {
    const g = grupos[t.id];
    if (g && g !== 'solo') gruposDosProprios.add(g);
  }
  if (gruposDosProprios.size === 0) return proprios;
  const ids = new Set(proprios.map(t => t.id));
  return jogadores.filter(t => ids.has(t.id) || (grupos[t.id] !== undefined && gruposDosProprios.has(grupos[t.id]!)));
}

function chaveFiltroDeVisao(filtro?: FiltroDeVisao | null, minhasFichas?: readonly string[] | null): string {
  if (!filtro || filtro.tipo === 'todos') return 'todos';
  if (filtro.tipo === 'foco') return `foco:${filtro.tokenId}`;
  const grupos = filtro.grupos
    ? Object.entries(filtro.grupos).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',')
    : '';
  return `ind:${minhasFichas?.join(',') ?? ''}:${grupos}`;
}

/** O que uma peça de jogador enxerga: um polígono por peça (paredes, portas fechadas, janelas e objetos que bloqueiam visão recortam; portas abertas e arcos deixam ver), limitado ao raio de visão. */
export function poligonosDeVisao(
  m: MapaAtlas,
  filtro?: FiltroDeVisao | null,
  minhasFichas?: readonly string[] | null,
): number[][] {
  // Quem pergunta várias vezes sobre o mesmo documento (névoa, telhados, explorado) paga uma vez: o resultado vale enquanto o que importa não mudar.
  const modoMemoria = m.memory?.mode;
  const chaveFiltro = chaveFiltroDeVisao(filtro, minhasFichas);
  if (
    guardado &&
    guardado.tokens === m.tokens &&
    guardado.walls === m.walls &&
    guardado.openings === m.openings &&
    guardado.props === m.props &&
    guardado.lights === m.lights &&
    guardado.modoMemoria === modoMemoria &&
    guardado.revealed === m.session.revealed &&
    guardado.chaveFiltro === chaveFiltro
  ) {
    return guardado.poligonos;
  }
  const poligonos = calcularPoligonos(m, filtro, minhasFichas);
  guardado = {
    tokens: m.tokens,
    walls: m.walls,
    openings: m.openings,
    props: m.props,
    lights: m.lights,
    modoMemoria,
    revealed: m.session.revealed,
    chaveFiltro,
    poligonos,
  };
  return poligonos;
}
let guardado: {
  tokens: MapaAtlas['tokens'];
  walls: MapaAtlas['walls'];
  openings: MapaAtlas['openings'];
  props: MapaAtlas['props'];
  lights: MapaAtlas['lights'];
  modoMemoria: MapaAtlas['memory']['mode'];
  revealed: MapaAtlas['session']['revealed'];
  chaveFiltro: string;
  poligonos: number[][];
} | null = null;

/** Uma porta secreta que ninguém revelou ainda é parede para os jogadores, esteja ela aberta ou não. */
export function secretaOculta(m: Pick<MapaAtlas, 'session'>, a: Pick<Abertura, 'id' | 'kind'>): boolean {
  return a.kind === 'secret' && !m.session.revealed.includes(a.id);
}

/** O polígono de cada peça, guardado pela posição, parâmetros de visão e assinatura dos segmentos que bloqueiam a visão: mover uma peça só refaz a dela. */
const porPeca = new Map<string, { x: number; y: number; chaveVisao: string; assinatura: string; pts: number[] }>();

/** Assinatura barata dos segmentos (o tamanho e dois hashes de 32 bits das coordenadas). */
function assinaturaDe(segs: readonly { a: Ponto; b: Ponto }[]): string {
  let h1 = 0x811c9dc5, h2 = 0x1b873593;
  for (const s of segs) for (const v of [s.a[0], s.a[1], s.b[0], s.b[1]]) {
    const n = Math.round(v * 1e4) | 0;
    h1 = Math.imul(h1 ^ n, 16777619); h2 = Math.imul(h2 + n, 0x85ebca6b) ^ (h2 >>> 13);
  }
  return `${segs.length}:${h1 >>> 0}:${h2 >>> 0}`;
}

function calcularPoligonos(
  m: MapaAtlas,
  filtro?: FiltroDeVisao | null,
  minhasFichas?: readonly string[] | null,
): number[][] {
  const aberturas = Object.values(m.openings).some(a => secretaOculta(m, a) && a.state !== 'closed')
    ? Object.fromEntries(Object.entries(m.openings).map(([id, a]) => [id, secretaOculta(m, a) ? { ...a, state: 'closed' as const } : a]))
    : m.openings;
  const segsParedes = oclusores({ walls: m.walls, openings: aberturas }, 'visao');
  const oclusoresPorAndar = new Map<string | null, ReturnType<typeof oclusoresDeObjetos>>();
  const oclusoresDoAndar = (nivel: string | null) => {
    let lista = oclusoresPorAndar.get(nivel);
    if (!lista) {
      const propsVisao = Object.fromEntries(
        Object.entries(m.props ?? {}).filter(([, o]) => (o.levelId ?? null) === nivel && o.blocks.sight && !o.oculto),
      );
      lista = oclusoresDeObjetos({ props: propsVisao }, { levelId: nivel });
      oclusoresPorAndar.set(nivel, lista);
    }
    return lista;
  };
  let indiceParedes: IndiceDeSegmentos | null = null;
  const saida: number[][] = [];
  const vivos = new Set<string>();
  for (const t of tokensDeVisaoAtivos(m, filtro, minhasFichas)) {
    if (t.vision.radius <= 0) continue;
    const x = t.position[0], y = t.position[1], r = t.vision.radius;
    const p: Ponto = [x, y];
    const nivel = t.levelId ?? null;
    const modo = modoDeVisaoDaPeca(m, t);
    const luz = t.lightId ? m.lights?.[t.lightId] : undefined;
    const rCone = modo === 'cone' && luz?.on && luz.cone ? Math.max(r, luz.radius) : r;
    const proxBase = t.vision.proximity ?? PROXIMIDADE_VISAO_PADRAO;
    const rProx = modo === 'cone'
      ? Math.min(rCone, luz?.on && !luz.cone ? Math.max(proxBase, luz.radius * 0.85) : proxBase)
      : r;
    const anguloGraus = t.vision.angle ?? ABERTURA_VISAO_PADRAO;
    const direcao = modo === 'cone' ? direcaoDeVisaoDaPeca(m, t) : 0;
    const chaveVisao = modo === 'cone'
      ? `cone:${rCone.toFixed(3)}:${rProx.toFixed(3)}:${anguloGraus.toFixed(2)}:${direcao.toFixed(4)}`
      : `circle:${r.toFixed(3)}`;

    const objs = oclusoresDoAndar(nivel);
    let segsPerto: ReturnType<typeof segmentosParaFonte>;
    if (objs.length === 0) {
      indiceParedes ??= new IndiceDeSegmentos(segsParedes);
      segsPerto = indiceParedes.perto(p, rCone);
    } else {
      const todos = segmentosParaFonte(p, segsParedes, objs, [], { ownerId: t.id });
      segsPerto = new IndiceDeSegmentos(todos).perto(p, rCone);
    }
    const assinatura = assinaturaDe(segsPerto);
    vivos.add(t.id);
    let e = porPeca.get(t.id);
    if (!e || e.x !== x || e.y !== y || e.chaveVisao !== chaveVisao || e.assinatura !== assinatura) {
      const pts = modo === 'cone'
        ? poligonoDeVisaoDarkwood(p, segsPerto, rCone, rProx, { angle: (anguloGraus * Math.PI) / 180, direction: direcao })
        : poligonoIluminado(p, segsPerto, r, null);
      e = { x, y, chaveVisao, assinatura, pts };
      porPeca.set(t.id, e);
    }
    if (e.pts.length >= 6) saida.push(e.pts);
  }
  if (porPeca.size > 64) for (const id of porPeca.keys()) if (!vivos.has(id)) porPeca.delete(id);
  return saida;
}

/** As células (de lado `res`) cujo centro está dentro de algum polígono, em faixas canônicas. */
export function celulasDosPoligonos(m: Pick<MapaAtlas, 'bounds'>, poligonos: readonly (readonly number[])[], res = RES_NEVOA): Faixa[] {
  const colunas = Math.ceil(m.bounds.width / res), linhas = Math.ceil(m.bounds.height / res), celulas: [number, number][] = [];
  for (const pts of poligonos) {
    let y0 = Infinity, y1 = -Infinity;
    for (let i = 1; i < pts.length; i += 2) { y0 = Math.min(y0, pts[i]!); y1 = Math.max(y1, pts[i]!); }
    for (let j = Math.max(0, Math.floor(y0 / res - 0.5)); j <= Math.min(linhas - 1, Math.ceil(y1 / res - 0.5)); j++) {
      const y = (j + 0.5) * res, xs: number[] = [];
      // Cruzamentos da linha horizontal com as arestas (par-ímpar).
      for (let i = 0, k = pts.length - 2; i < pts.length; k = i, i += 2) {
        const ay = pts[k + 1]!, by = pts[i + 1]!;
        if ((ay > y) !== (by > y)) xs.push(pts[k]! + ((y - ay) / (by - ay)) * (pts[i]! - pts[k]!));
      }
      xs.sort((a, b) => a - b);
      for (let n = 0; n + 1 < xs.length; n += 2) for (let i = Math.max(0, Math.ceil(xs[n]! / res - 0.5)); i <= Math.min(colunas - 1, Math.floor(xs[n + 1]! / res - 0.5)); i++) celulas.push([i, j]);
    }
  }
  return codificar(celulas);
}

/** Tudo o que as peças de jogador veem agora, como células do explorado. */
export const celulasVisiveis = (
  m: MapaAtlas,
  res = RES_NEVOA,
  filtro?: FiltroDeVisao | null,
  minhasFichas?: readonly string[] | null,
): Faixa[] => celulasDosPoligonos(m, poligonosDeVisao(m, filtro, minhasFichas), res);

function pontoEmPoligonoPlano(x: number, y: number, pts: readonly number[]): boolean {
  let dentro = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i]!, yi = pts[i + 1]!;
    const xj = pts[j]!, yj = pts[j + 1]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Verifica diretamente se `ponto` (ou sua borda de raio `margem`) está dentro de algum polígono de visão ativa das peças de jogador. */
export function pontoVisivelAgora(
  m: MapaAtlas,
  ponto: Ponto,
  margem = 0.25,
  filtro?: FiltroDeVisao | null,
  minhasFichas?: readonly string[] | null,
): boolean {
  const poligonos = poligonosDeVisao(m, filtro, minhasFichas);
  if (!poligonos.length) return false;
  const emAlgum = (x: number, y: number) => poligonos.some(pts => pontoEmPoligonoPlano(x, y, pts));
  const [x, y] = ponto;
  if (emAlgum(x, y)) return true;
  if (margem > 0) {
    return (
      emAlgum(x + margem, y) ||
      emAlgum(x - margem, y) ||
      emAlgum(x, y + margem) ||
      emAlgum(x, y - margem)
    );
  }
  return false;
}

/** As células do explorado (de lado `res`) que cobrem os cômodos dados, que vivem na grade do mapa. */
export function celulasDosComodos(m: Pick<MapaAtlas, 'grid' | 'rooms' | 'bounds'>, ids: readonly string[], res = RES_NEVOA): Faixa[] {
  const t = m.grid.size, [ox, oy] = m.grid.offset, colunas = Math.ceil(m.bounds.width / res), linhas = Math.ceil(m.bounds.height / res), celulas: [number, number][] = [];
  for (const id of ids) for (const [cx, cy] of decodificar(m.rooms[id]?.cells ?? [])) {
    const x0 = ox + cx * t, y0 = oy + cy * t;
    for (let j = Math.max(0, Math.ceil(y0 / res - 0.5)); j <= Math.min(linhas - 1, Math.floor((y0 + t) / res - 0.5)); j++) for (let i = Math.max(0, Math.ceil(x0 / res - 0.5)); i <= Math.min(colunas - 1, Math.floor((x0 + t) / res - 0.5)); i++) celulas.push([i, j]);
  }
  return codificar(celulas);
}

/** As células do explorado (de lado `res`) que cobrem as regiões reveladas (kind === 'reveal'). */
export function celulasDasRegioes(m: Pick<MapaAtlas, 'regions' | 'bounds'>, ids: readonly string[], res = RES_NEVOA): Faixa[] {
  const poligonos: number[][] = [];
  for (const id of ids) {
    const r = m.regions[id];
    if (r && r.kind === 'reveal' && r.polygon.length >= 3) {
      poligonos.push(r.polygon.flatMap(([x, y]) => [x, y]));
    }
  }
  return poligonos.length ? celulasDosPoligonos(m, poligonos, res) : [];
}

/** O explorado de verdade: o que as peças já viram mais os cômodos e as regiões que o mestre revelou. */
export function celulasExploradas(m: MapaAtlas): Faixa[] {
  const res = m.session.explored?.res ?? RES_NEVOA, vistas = m.session.explored?.cells ?? [];
  const salas = m.session.revealed.filter(id => m.rooms[id]);
  const regioes = m.session.revealed.filter(id => m.regions[id]);
  let resultado = vistas;
  if (salas.length) resultado = unir(resultado, celulasDosComodos(m, salas, res));
  if (regioes.length) resultado = unir(resultado, celulasDasRegioes(m, regioes, res));
  return resultado === vistas ? [...vistas] : resultado;
}

/** O explorado depois de somar o que as peças de jogador veem em `m` (e, se dado, o que viam antes). Nunca encolhe. */
export function exploradoAgora(m: MapaAtlas, jaViam: readonly Faixa[] = []): NonNullable<Sessao['explored']> {
  const res = m.session.explored?.res ?? RES_NEVOA;
  return { res, cells: unir(unir(m.session.explored?.cells ?? [], jaViam), celulasVisiveis(m, res)) };
}

/**
 * Os cômodos que os jogadores conhecem: algum pedaço deles, ou o que está logo fora das suas paredes, está à vista agora ou já foi explorado.
 * (De fora de uma casa vê-se a parede por fora, não o interior: é o bastante para o telhado aparecer.)
 */
export function comodosConhecidos(
  m: MapaAtlas,
  filtro?: FiltroDeVisao | null,
  minhasFichas?: readonly string[] | null,
): Set<string> {
  const res = m.session.explored?.res ?? RES_NEVOA, t = m.grid.size, [ox, oy] = m.grid.offset, saida = new Set<string>();
  const linhas = new Map<number, [number, number][]>();
  for (const [y, x0, n] of [...celulasVisiveis(m, res, filtro, minhasFichas), ...celulasExploradas(m)]) { const l = linhas.get(y) ?? []; l.push([x0, x0 + n]); linhas.set(y, l); }
  const visto = (x: number, y: number) => { const i = Math.floor(x / res), l = linhas.get(Math.floor(y / res)); return !!l && l.some(([a, b]) => i >= a && i < b); };
  for (const sala of Object.values(m.rooms)) {
    for (const [cx, cy] of decodificar(sala.cells)) {
      const x = ox + (cx + 0.5) * t, y = oy + (cy + 0.5) * t, f = t / 2 + 0.3;
      if (visto(x, y) || visto(x - f, y) || visto(x + f, y) || visto(x, y - f) || visto(x, y + f)) { saida.add(sala.id); break; }
    }
  }
  return saida;
}

/** Indica se alguma célula (ou borda externa de parede) do edifício está tocada por algum polígono de visão ativa. */
export function edificioTocadoPorPoligonos(
  m: Pick<MapaAtlas, 'grid'>,
  ed: Pick<Edificio, 'celulas'>,
  poligonos: readonly (readonly number[])[],
): boolean {
  if (!poligonos.length || !ed.celulas.length) return false;
  const caixas = poligonos.map(pts => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i]!, py = pts[i + 1]!;
      if (px < x0) x0 = px;
      if (py < y0) y0 = py;
      if (px > x1) x1 = px;
      if (py > y1) y1 = py;
    }
    return { pts, x0, y0, x1, y1 };
  });
  const t = m.grid.size, [ox, oy] = m.grid.offset, f = t / 2 + 0.3;
  const visto = (x: number, y: number): boolean => {
    for (const c of caixas) {
      if (x < c.x0 || x > c.x1 || y < c.y0 || y > c.y1) continue;
      if (pontoEmPoligonoPlano(x, y, c.pts)) return true;
    }
    return false;
  };
  for (const [cx, cy] of ed.celulas) {
    const x = ox + (cx + 0.5) * t, y = oy + (cy + 0.5) * t;
    if (visto(x, y) || visto(x - f, y) || visto(x + f, y) || visto(x, y - f) || visto(x, y + f)) return true;
  }
  return false;
}
