import { decodificar, type Celula } from './celulas.ts';
import type { Abertura, MapaAtlas, Objeto, Parede, Ponto } from './mapa.ts';

/**
 * Geometria derivada dos cômodos: que arestas da grade viram parede, em que trechos, e como portas e janelas
 * acompanham as paredes quando um cômodo muda. Tudo puro, sem render nem interface.
 *
 * Arestas unitárias: `h:i:j` é a aresta horizontal no topo da célula (i, j) e `v:i:j`, a vertical à esquerda dela.
 */
export type Orientacao = 'h' | 'v';
export interface ArestaUnitaria {
  chave: string; orient: Orientacao; i: number; j: number;
  /** Cômodos dos dois lados: [acima ou à esquerda, abaixo ou à direita]. `null` é fora de qualquer cômodo. */
  salas: [string | null, string | null];
}

const chaveCel = (x: number, y: number) => y * 200_003 + x;
export const arredondar = (v: number): number => Math.round(v * 1e6) / 1e6;

/** Célula → cômodo. */
export function indiceDeCelulas(m: Pick<MapaAtlas, 'rooms'>): Map<number, string> {
  const indice = new Map<number, string>();
  for (const sala of Object.values(m.rooms)) for (const [x, y] of decodificar(sala.cells)) indice.set(chaveCel(x, y), sala.id);
  return indice;
}
export const salaDaCelula = (indice: Map<number, string>, x: number, y: number): string | null => indice.get(chaveCel(x, y)) ?? null;

/** O cômodo sob um ponto do mundo (metros). */
export function comodoEm(m: Pick<MapaAtlas, 'rooms' | 'grid'>, p: Ponto, indice = indiceDeCelulas(m)): string | null {
  const t = m.grid.size;
  return salaDaCelula(indice, Math.floor((p[0] - m.grid.offset[0]) / t), Math.floor((p[1] - m.grid.offset[1]) / t));
}

/** Todas as arestas que separam cômodos diferentes ou um cômodo do vazio, sem repetir as compartilhadas. */
export function arestasDeParede(m: Pick<MapaAtlas, 'rooms'>): Map<string, ArestaUnitaria> {
  const indice = indiceDeCelulas(m), saida = new Map<string, ArestaUnitaria>();
  for (const sala of Object.values(m.rooms)) for (const [x, y] of decodificar(sala.cells)) {
    const visitar = (orient: Orientacao, i: number, j: number, outra: string | null, eMeu: 0 | 1) => {
      if (outra === sala.id) return;
      const chave = `${orient}:${i}:${j}`;
      if (saida.has(chave)) return;
      saida.set(chave, { chave, orient, i, j, salas: eMeu === 1 ? [outra, sala.id] : [sala.id, outra] });
    };
    visitar('h', x, y, salaDaCelula(indice, x, y - 1), 1);
    visitar('v', x, y, salaDaCelula(indice, x - 1, y), 1);
    visitar('h', x, y + 1, salaDaCelula(indice, x, y + 1), 0);
    visitar('v', x + 1, y, salaDaCelula(indice, x + 1, y), 0);
  }
  return saida;
}

export const cantoDoMundo = (m: Pick<MapaAtlas, 'grid'>, i: number, j: number): Ponto => [arredondar(m.grid.offset[0] + i * m.grid.size), arredondar(m.grid.offset[1] + j * m.grid.size)];

/** Segmento (em metros) de uma aresta unitária. */
export function segmentoDaAresta(m: Pick<MapaAtlas, 'grid'>, a: Pick<ArestaUnitaria, 'orient' | 'i' | 'j'>): [Ponto, Ponto] {
  const p = cantoDoMundo(m, a.i, a.j), q = a.orient === 'h' ? cantoDoMundo(m, a.i + 1, a.j) : cantoDoMundo(m, a.i, a.j + 1);
  return [p, q];
}

export const PAREDE_PADRAO = { height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall' as const, blocks: { move: true, sight: true, light: true }, drop: null as 'a' | 'b' | null };
const IDENT_PAREDE = (orient: Orientacao, linha: number, ini: number, fim: number) => `d${orient}${linha}_${ini}_${fim}`;

export interface ParedeDerivada extends Parede { source: { roomId: string } }

/** Junta arestas vizinhas e colineares (mesmo par de cômodos) em trechos de parede contínuos. */
export function paredesDerivadas(m: Pick<MapaAtlas, 'rooms' | 'grid'>, ignorar: ReadonlySet<string> = new Set()): ParedeDerivada[] {
  const arestas = [...arestasDeParede(m).values()].filter(a => !ignorar.has(a.chave));
  const paredes: ParedeDerivada[] = [];
  for (const orient of ['h', 'v'] as const) {
    const doEixo = arestas.filter(a => a.orient === orient);
    // Agrupa por linha (j para horizontais, i para verticais) e por par de cômodos; dentro, ordena ao longo da linha.
    const grupos = new Map<string, ArestaUnitaria[]>();
    for (const a of doEixo) { const k = `${orient === 'h' ? a.j : a.i}|${a.salas.join('|')}`; (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(a); }
    for (const lista of grupos.values()) {
      const ao = (a: ArestaUnitaria) => (orient === 'h' ? a.i : a.j);
      lista.sort((a, b) => ao(a) - ao(b));
      let ini = 0;
      for (let k = 1; k <= lista.length; k++) {
        if (k < lista.length && ao(lista[k]!) === ao(lista[k - 1]!) + 1) continue;
        const primeira = lista[ini]!, ultima = lista[k - 1]!, linha = orient === 'h' ? primeira.j : primeira.i;
        const [a0] = segmentoDaAresta(m, primeira), [, b1] = segmentoDaAresta(m, ultima);
        const dono = [...primeira.salas].filter((s): s is string => s !== null).sort()[0]!;
        paredes.push({ id: IDENT_PAREDE(orient, linha, ao(primeira), ao(ultima) + 1), path: [a0, b1], ...structuredClone(PAREDE_PADRAO), source: { roomId: dono } });
        ini = k;
      }
    }
  }
  return paredes;
}

/** Arestas unitárias que uma parede manual, alinhada à grade, já cobre: a parede derivada não se repete nelas. */
export function arestasCobertas(m: Pick<MapaAtlas, 'grid'>, p: Pick<Parede, 'path'>): string[] {
  const t = m.grid.size, [ox, oy] = m.grid.offset, saida: string[] = [];
  for (let s = 0; s + 1 < p.path.length; s++) {
    const [x0, y0] = p.path[s]!, [x1, y1] = p.path[s + 1]!;
    const noEixoX = Math.abs(y0 - y1) < 1e-6, noEixoY = Math.abs(x0 - x1) < 1e-6;
    if (noEixoX && Math.abs((y0 - oy) / t - Math.round((y0 - oy) / t)) < 1e-6) {
      const j = Math.round((y0 - oy) / t), a = Math.round((Math.min(x0, x1) - ox) / t), b = Math.round((Math.max(x0, x1) - ox) / t);
      for (let i = a; i < b; i++) saida.push(`h:${i}:${j}`);
    } else if (noEixoY && Math.abs((x0 - ox) / t - Math.round((x0 - ox) / t)) < 1e-6) {
      const i = Math.round((x0 - ox) / t), a = Math.round((Math.min(y0, y1) - oy) / t), b = Math.round((Math.max(y0, y1) - oy) / t);
      for (let j = a; j < b; j++) saida.push(`v:${i}:${j}`);
    }
  }
  return saida;
}

// ---------- Posições sobre uma parede ----------
export const comprimentoDaParede = (p: Pick<Parede, 'path'>): number => { let c = 0; for (let i = 0; i + 1 < p.path.length; i++) c += Math.hypot(p.path[i + 1]![0] - p.path[i]![0], p.path[i + 1]![1] - p.path[i]![1]); return c; };

/** O ponto à distância `dist` (m) do início da parede e a direção do trecho ali. */
export function pontoNaParede(p: Pick<Parede, 'path'>, dist: number): { ponto: Ponto; tangente: Ponto } {
  let resta = dist;
  for (let i = 0; i + 1 < p.path.length; i++) {
    const [x0, y0] = p.path[i]!, [x1, y1] = p.path[i + 1]!, c = Math.hypot(x1 - x0, y1 - y0);
    if (resta <= c || i + 2 === p.path.length) { const u = c ? Math.max(0, Math.min(1, resta / c)) : 0; return { ponto: [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u], tangente: c ? [(x1 - x0) / c, (y1 - y0) / c] : [1, 0] }; }
    resta -= c;
  }
  return { ponto: p.path[0]!, tangente: [1, 0] };
}

/** O ponto da parede mais próximo de `ponto`: distância ao longo da parede, distância ao ponto, e de que lado ele está. */
export function projetarNaParede(p: Pick<Parede, 'path'>, ponto: Ponto): { dist: number; distancia: number; lado: 1 | -1 } {
  let melhor = { dist: 0, distancia: Infinity, lado: 1 as 1 | -1 }, acumulado = 0;
  for (let i = 0; i + 1 < p.path.length; i++) {
    const [x0, y0] = p.path[i]!, [x1, y1] = p.path[i + 1]!, dx = x1 - x0, dy = y1 - y0, c2 = dx * dx + dy * dy, c = Math.sqrt(c2);
    const u = c2 ? Math.max(0, Math.min(1, ((ponto[0] - x0) * dx + (ponto[1] - y0) * dy) / c2)) : 0;
    const qx = x0 + dx * u, qy = y0 + dy * u, d = Math.hypot(ponto[0] - qx, ponto[1] - qy);
    if (d < melhor.distancia) melhor = { dist: acumulado + u * c, distancia: d, lado: (dx * (ponto[1] - y0) - dy * (ponto[0] - x0)) >= 0 ? 1 : -1 };
    acumulado += c;
  }
  return melhor;
}

/** Os cômodos que enxergam uma abertura (um ou dois, se a parede é compartilhada); vazio se a parede não é de cômodo. */
export function salasDaAbertura(m: Pick<MapaAtlas, 'walls' | 'grid' | 'rooms'>, a: Pick<Abertura, 'wallId' | 'at'>, arestas: Map<string, ArestaUnitaria> = arestasDeParede(m)): string[] {
  const p = m.walls[a.wallId]; if (!p) return [];
  const { ponto, tangente } = pontoNaParede(p, a.at * comprimentoDaParede(p)), t = m.grid.size, [ox, oy] = m.grid.offset;
  const chave = Math.abs(tangente[0]) > 0.5 ? `h:${Math.floor((ponto[0] - ox) / t)}:${Math.round((ponto[1] - oy) / t)}` : `v:${Math.round((ponto[0] - ox) / t)}:${Math.floor((ponto[1] - oy) / t)}`;
  return (arestas.get(chave)?.salas ?? ([] as (string | null)[])).filter((x): x is string => x !== null);
}

/**
 * A normal da parede, no ponto a `dist` metros do início, que aponta para dentro de `roomId`: a que, um passo adiante, cai no cômodo.
 * `null` se nenhum dos dois lados cai nele.
 */
export function normalParaDentro(m: Pick<MapaAtlas, 'rooms' | 'grid'>, parede: Pick<Parede, 'path'>, dist: number, roomId: string, indice = indiceDeCelulas(m)): Ponto | null {
  const { ponto, tangente } = pontoNaParede(parede, dist);
  const candidatas: Ponto[] = [[-tangente[1], tangente[0]], [tangente[1], -tangente[0]]];
  return candidatas.find(n => comodoEm(m, [ponto[0] + n[0] * 0.4, ponto[1] + n[1] * 0.4], indice) === roomId) ?? null;
}

export const centroDaAbertura = (p: Pick<Parede, 'path'>, a: Pick<Abertura, 'at'>): number => a.at * comprimentoDaParede(p);

/** A abertura cabe na parede e não encosta nas outras? Devolve o motivo da recusa, ou `null`. */
export function motivoDeNaoCaber(m: Pick<MapaAtlas, 'walls' | 'openings'>, a: Pick<Abertura, 'id' | 'wallId' | 'at' | 'width'>): string | null {
  const parede = m.walls[a.wallId];
  if (!parede) return 'A parede não existe.';
  const c = comprimentoDaParede(parede), centro = a.at * c, folga = 1e-6;
  if (centro - a.width / 2 < -folga || centro + a.width / 2 > c + folga) return 'A abertura não cabe nesse trecho da parede.';
  for (const o of Object.values(m.openings)) {
    if (o.id === a.id || o.wallId !== a.wallId) continue;
    if (Math.abs(centroDaAbertura(parede, o) - centro) < (o.width + a.width) / 2 - folga) return 'Já há uma abertura aí.';
  }
  return null;
}

// ---------- Encaixe de aberturas e objetos de parede ----------
export interface EncaixeNaParede { parede: Parede; /** Fração ao longo da parede (0 a 1). */ at: number; /** Lado em que o ponto está: 1 à direita de quem anda do início ao fim, -1 à esquerda. */ lado: 1 | -1; /** Distância do ponto à parede. */ distancia: number; /** Ponto da parede onde a abertura fica. */ ponto: Ponto }

/** A parede mais próxima de `ponto`, e onde a abertura de `largura` metros ficaria nela: no centro de uma célula, e sempre inteira dentro da parede. */
export function encaixarNaParede(m: Pick<MapaAtlas, 'walls' | 'grid'>, ponto: Ponto, largura: number, tolerancia = 0.75): EncaixeNaParede | null {
  let melhor: { parede: Parede; dist: number; distancia: number; lado: 1 | -1 } | null = null;
  for (const p of Object.values(m.walls)) { const r = projetarNaParede(p, ponto); if (r.distancia <= tolerancia && (!melhor || r.distancia < melhor.distancia)) melhor = { parede: p, ...r }; }
  if (!melhor) return null;
  const p = melhor.parede, comp = comprimentoDaParede(p);
  if (comp < largura - 1e-6) return null;
  let centro = melhor.dist;
  // Parede reta e na grade: o centro vai para o meio de uma célula; senão, para múltiplos de 0,25 m.
  const reta = p.path.length === 2 && (Math.abs(p.path[0]![0] - p.path[1]![0]) < 1e-6 || Math.abs(p.path[0]![1] - p.path[1]![1]) < 1e-6);
  const t = m.grid.size;
  centro = reta ? (Math.floor(centro / t + 1e-9) + 0.5) * t : Math.round(centro / 0.25) * 0.25;
  centro = Math.max(largura / 2, Math.min(comp - largura / 2, centro));
  return { parede: p, at: arredondar(centro / comp), lado: melhor.lado, distancia: melhor.distancia, ponto: pontoNaParede(p, centro).ponto };
}

/** Onde pôr um objeto de parede (um quadro, uma estante): na face do cômodo que está do lado do ponteiro. `null` se desse lado não há cômodo. */
export function encaixarObjetoDeParede(m: Pick<MapaAtlas, 'walls' | 'grid' | 'rooms'>, ponto: Ponto, largura: number): (EncaixeNaParede & { roomId: string }) | null {
  const e = encaixarNaParede(m, ponto, largura, 1.0); if (!e) return null;
  const { tangente } = pontoNaParede(e.parede, e.at * comprimentoDaParede(e.parede)), n: Ponto = [-tangente[1] * e.lado, tangente[0] * e.lado];
  const sala = comodoEm(m, [e.ponto[0] + n[0] * 0.3, e.ponto[1] + n[1] * 0.3]);
  return sala ? { ...e, roomId: sala } : null;
}

// ---------- Recalcular as paredes quando os cômodos mudam ----------
type Rascunho = MapaAtlas;

/**
 * Refaz as paredes derivadas a partir dos cômodos e mantém no lugar o que estava preso a elas.
 * As paredes manuais (`source: null`) não mudam e suas arestas não são repetidas. Aberturas e objetos de parede são
 * reprojetados pelo ponto onde estavam; os que não encontram mais parede, ou não cabem, saem.
 */
export function recalcularParedes(m: Rascunho): void {
  const antigas = new Map<string, Pick<Parede, 'path'>>();
  for (const p of Object.values(m.walls)) antigas.set(p.id, { path: p.path.map(q => [q[0], q[1]] as Ponto) });
  const derivada = (p: Parede) => !!p.source && 'roomId' in p.source;      // as do maciço (terrainLayerId) não são dos cômodos: ficam
  const antesDerivadas = new Map(Object.values(m.walls).filter(derivada).map(p => [p.id, p]));

  const cobertas = new Set<string>();
  for (const p of Object.values(m.walls)) if (!p.source) for (const k of arestasCobertas(m, p)) cobertas.add(k);
  for (const id of Object.keys(m.walls)) if (derivada(m.walls[id]!)) delete m.walls[id];
  for (const d of paredesDerivadas(m, cobertas)) {
    const anterior = antesDerivadas.get(d.id);
    m.walls[d.id] = anterior ? { ...d, height: anterior.height, thickness: anterior.thickness, material: anterior.material, kind: anterior.kind, blocks: { ...anterior.blocks } } : d;
  }

  const parede = (id: string) => m.walls[id], achar = (ponto: Ponto, tolerancia = 0.06): { parede: Parede; dist: number } | null => {
    let melhor: { parede: Parede; dist: number; d: number } | null = null;
    for (const p of Object.values(m.walls)) { const r = projetarNaParede(p, ponto); if (r.distancia <= tolerancia && (!melhor || r.distancia < melhor.d)) melhor = { parede: p, dist: r.dist, d: r.distancia }; }
    return melhor;
  };
  const mesmaGeometria = (a: Pick<Parede, 'path'> | undefined, b: Pick<Parede, 'path'> | undefined) => !!a && !!b && a.path.length === b.path.length && a.path.every((q, i) => Math.abs(q[0] - b.path[i]![0]) < 1e-6 && Math.abs(q[1] - b.path[i]![1]) < 1e-6);

  for (const a of Object.values(m.openings)) {
    const velha = antigas.get(a.wallId);
    if (parede(a.wallId) && mesmaGeometria(velha, parede(a.wallId))) continue;
    if (!velha) { delete m.openings[a.id]; continue; }
    const alvo = achar(pontoNaParede(velha, a.at * comprimentoDaParede(velha)).ponto);
    if (!alvo) { delete m.openings[a.id]; continue; }
    a.wallId = alvo.parede.id; a.at = arredondar(alvo.dist / comprimentoDaParede(alvo.parede));
    if (motivoDeNaoCaber({ walls: m.walls, openings: m.openings }, a)) delete m.openings[a.id];
  }
  for (const o of Object.values(m.props) as Objeto[]) {
    if (!o.wall) continue;
    const velha = antigas.get(o.wall.wallId);
    if (parede(o.wall.wallId) && mesmaGeometria(velha, parede(o.wall.wallId))) continue;
    if (!velha) { delete m.props[o.id]; continue; }
    const alvo = achar(pontoNaParede(velha, o.wall.at * comprimentoDaParede(velha)).ponto);
    if (!alvo) { delete m.props[o.id]; continue; }
    o.wall.wallId = alvo.parede.id; o.wall.at = arredondar(alvo.dist / comprimentoDaParede(alvo.parede));
  }
  limparOrfaos(m);
}

/** Objeto de parede mora no cômodo da face; os demais moram no cômodo que está sob eles. */
export function atualizarSalasDosObjetos(m: Rascunho): void {
  const objetos = Object.values(m.props) as Objeto[];
  if (!objetos.length) return;
  const indice = indiceDeCelulas(m);
  for (const o of objetos) {
    if (o.elevation === 'wall') { if (o.roomId && !m.rooms[o.roomId]) delete m.props[o.id]; continue; }
    const sala = comodoEm(m, o.position, indice);
    if (o.roomId !== sala) o.roomId = sala;
  }
}

/** O que dependia de algo que não existe mais: luzes sem dono, peças sem luz, cômodos de objetos, notas de cômodo. */
export function limparOrfaos(m: Rascunho): void {
  atualizarSalasDosObjetos(m);
  for (const luz of Object.values(m.lights)) if (luz.ownerId && !m.props[luz.ownerId] && !m.tokens[luz.ownerId]) delete m.lights[luz.id];
  for (const t of Object.values(m.tokens)) if (t.lightId && !m.lights[t.lightId]) t.lightId = null;
  for (const id of Object.keys(m.comodosExtra)) if (!m.rooms[id]) delete m.comodosExtra[id];
  m.session.revealed = m.session.revealed.filter(id => [m.rooms, m.walls, m.openings, m.props, m.lights, m.regions, m.presence, m.tokens].some(c => (c as Record<string, unknown>)[id] !== undefined));
}

// ---------- Contorno de um cômodo (para o desenho das faces) ----------
export interface SegmentoDeContorno { a: Ponto; b: Ponto; /** Normal que aponta para dentro do cômodo. */ n: Ponto; /** Arestas unitárias que o segmento cobre. */ ks: string[] }

/** Laços fechados de segmentos ao redor das células, com as colineares juntas e a normal para dentro. */
export function contornoDoComodo(m: Pick<MapaAtlas, 'grid'>, cells: readonly Celula[]): SegmentoDeContorno[][] {
  const dentro = new Set(cells.map(([x, y]) => chaveCel(x, y)));
  interface Bruta { de: [number, number]; para: [number, number]; n: [number, number]; k: string }
  const brutas: Bruta[] = [];
  for (const [x, y] of cells) {
    if (!dentro.has(chaveCel(x, y - 1))) brutas.push({ de: [x + 1, y], para: [x, y], n: [0, 1], k: `h:${x}:${y}` });
    if (!dentro.has(chaveCel(x - 1, y))) brutas.push({ de: [x, y], para: [x, y + 1], n: [1, 0], k: `v:${x}:${y}` });
    if (!dentro.has(chaveCel(x, y + 1))) brutas.push({ de: [x, y + 1], para: [x + 1, y + 1], n: [0, -1], k: `h:${x}:${y + 1}` });
    if (!dentro.has(chaveCel(x + 1, y))) brutas.push({ de: [x + 1, y + 1], para: [x + 1, y], n: [-1, 0], k: `v:${x + 1}:${y}` });
  }
  const porInicio = new Map<string, Bruta>(brutas.map(e => [e.de.join(','), e])), usadas = new Set<Bruta>(), lacos: SegmentoDeContorno[][] = [];
  const mundo = ([i, j]: [number, number]) => cantoDoMundo(m, i, j);
  for (const inicio of brutas) {
    if (usadas.has(inicio)) continue;
    const laco: Bruta[] = [];
    for (let e: Bruta | undefined = inicio; e && !usadas.has(e); e = porInicio.get(e.para.join(','))) { usadas.add(e); laco.push(e); }
    const juntas: { de: [number, number]; para: [number, number]; n: [number, number]; ks: string[] }[] = [];
    for (const e of laco) {
      const u = juntas.at(-1);
      if (u && u.n[0] === e.n[0] && u.n[1] === e.n[1]) { u.para = e.para; u.ks.push(e.k); } else juntas.push({ de: e.de, para: e.para, n: e.n, ks: [e.k] });
    }
    if (juntas.length > 1) { const p = juntas[0]!, u = juntas.at(-1)!; if (p.n[0] === u.n[0] && p.n[1] === u.n[1]) { u.para = p.para; u.ks.push(...p.ks); juntas.shift(); } }
    lacos.push(juntas.map(e => ({ a: mundo(e.de), b: mundo(e.para), n: [e.n[0], e.n[1]] as Ponto, ks: e.ks })));
  }
  return lacos;
}

/** Faces internas (estilo caixa): o trapézio de cada segmento, com cantos em meia-esquadria, `prof` metros para dentro. */
export function facesDoContorno(laco: readonly SegmentoDeContorno[], prof: number): { segmento: SegmentoDeContorno; quad: [Ponto, Ponto, Ponto, Ponto] }[] {
  const m = laco.length;
  const interno = laco.map((e, i) => { const ant = laco[(i - 1 + m) % m]!; return [e.a[0] + prof * (ant.n[0] + e.n[0]), e.a[1] + prof * (ant.n[1] + e.n[1])] as Ponto; });
  return laco.map((e, i) => ({ segmento: e, quad: [e.a, e.b, interno[(i + 1) % m]!, interno[i]!] }));
}

/** Caixa que envolve um conjunto de células, em metros. */
export function caixaDasCelulas(m: Pick<MapaAtlas, 'grid'>, cells: readonly Celula[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!cells.length) return null;
  let i0 = Infinity, j0 = Infinity, i1 = -Infinity, j1 = -Infinity;
  for (const [x, y] of cells) { i0 = Math.min(i0, x); j0 = Math.min(j0, y); i1 = Math.max(i1, x + 1); j1 = Math.max(j1, y + 1); }
  const [x0, y0] = cantoDoMundo(m, i0, j0), [x1, y1] = cantoDoMundo(m, i1, j1);
  return { x0, y0, x1, y1 };
}
