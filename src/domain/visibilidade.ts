import { ACERVO } from '../procedural/acervo.ts';
import { ehArvore } from './camadas.ts';
import { pontoNoPoligono, poligonoRegular } from './formas-de-comodo.ts';
import type { MapaAtlas, Objeto, Peca, Ponto } from './mapa.ts';
import { centroDaAbertura } from './geometria.ts';

/**
 * Visibilidade pura: quais segmentos bloqueiam a luz (ou a visão) e que região uma fonte ilumina.
 * Sem Pixi e sem documento além do que a pergunta precisa: a Fase 7 usa as mesmas funções para a visão das peças.
 */
export interface Segmento { a: Ponto; b: Ponto }

export interface OclusorDeObjeto {
  id: string;
  poligono: Ponto[];
  segmentos: Segmento[];
}

export interface OclusorDeToken {
  id: string;
  centro: Ponto;
  raio: number;
  lightId: string | null;
  poligono: Ponto[];
  segmentos: Segmento[];
}

export interface FiltroDeFonte {
  ownerId?: string | null;
  lightId?: string | null;
}

export interface OpcoesOclusoresDeObjetos {
  levelId?: string | null;
}

/** O vão da abertura deixa passar a luz, a visão ou quem anda? Arco sempre; porta e porta secreta só abertas (a trancada não); janela passa luz e visão. */
const deixaPassar = (kind: 'door' | 'window' | 'arch' | 'secret', estado: 'closed' | 'open' | 'locked', para: 'luz' | 'visao' | 'movimento'): boolean =>
  kind === 'arch' || ((kind === 'door' || kind === 'secret') && estado === 'open') || (kind === 'window' && para !== 'movimento');

/** Os segmentos que bloqueiam, já sem os vãos das aberturas que deixam passar. */
export function oclusores(m: Pick<MapaAtlas, 'walls' | 'openings'>, para: 'luz' | 'visao' | 'movimento'): Segmento[] {
  const saida: Segmento[] = [], vaos = new Map<string, [number, number][]>();
  for (const o of Object.values(m.openings)) {
    if (!deixaPassar(o.kind, o.state, para)) continue;
    const p = m.walls[o.wallId]; if (!p) continue;
    const c = centroDaAbertura(p, o), lista = vaos.get(p.id) ?? [];
    lista.push([c - o.width / 2, c + o.width / 2]); vaos.set(p.id, lista);
  }
  for (const p of Object.values(m.walls)) {
    if (!(para === 'luz' ? p.blocks.light : para === 'visao' ? p.blocks.sight : p.blocks.move)) continue;
    const buracos = (vaos.get(p.id) ?? []).sort((x, y) => x[0] - y[0]);
    let inicio = 0;
    for (let i = 0; i + 1 < p.path.length; i++) {
      const [x0, y0] = p.path[i]!, [x1, y1] = p.path[i + 1]!, comp = Math.hypot(x1 - x0, y1 - y0), fim = inicio + comp;
      if (comp > 0) {
        // O trecho [inicio, fim] menos a união dos vãos.
        let cursor = inicio;
        const emitir = (de: number, ate: number) => {
          if (ate - de < 1e-6) return;
          const u0 = (de - inicio) / comp, u1 = (ate - inicio) / comp;
          saida.push({ a: [x0 + (x1 - x0) * u0, y0 + (y1 - y0) * u0], b: [x0 + (x1 - x0) * u1, y0 + (y1 - y0) * u1] });
        };
        for (const [b0, b1] of buracos) {
          if (b1 <= cursor || b0 >= fim) continue;
          emitir(cursor, Math.min(b0, fim)); cursor = Math.max(cursor, b1);
        }
        emitir(cursor, fim);
      }
      inicio = fim;
    }
  }
  return saida;
}

/** Parâmetro `t` em que o raio de `o` na direção (dx, dy) atinge o segmento (`Infinity` se não atinge). */
function tNoSegmento(o: Ponto, dx: number, dy: number, s: Segmento): number {
  const sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1], den = dx * sy - dy * sx;
  if (Math.abs(den) < 1e-12) return Infinity;
  const t = ((s.a[0] - o[0]) * sy - (s.a[1] - o[1]) * sx) / den, u = ((s.a[0] - o[0]) * dy - (s.a[1] - o[1]) * dx) / den;
  return t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity;
}

/** Distância até o primeiro segmento atingido pelo raio de `o` na direção (dx, dy). */
function raio(o: Ponto, dx: number, dy: number, segs: readonly Segmento[]): number {
  let melhor = Infinity;
  for (const s of segs) { const t = tNoSegmento(o, dx, dy, s); if (t < melhor) melhor = t; }
  return melhor;
}

/** Com tantos segmentos ou mais, os raios andam por uma grade em vez de testar todos. */
const SEGMENTOS_PARA_GRADE = 24;

/** Grade quadrada centrada na fonte: cada célula lista os segmentos cuja caixa a toca. Só para raios limitados a `alcance`. */
function criarGradeDeRaios(o: Ponto, segs: readonly Segmento[], alcance: number): (dx: number, dy: number) => number {
  const n = 16, lado = (2 * alcance) / n, x0 = o[0] - alcance, y0 = o[1] - alcance;
  const celulas: Segmento[][] = Array.from({ length: n * n }, () => []);
  const idx = (v: number) => Math.max(0, Math.min(n - 1, Math.floor(v / lado)));
  for (const s of segs) {
    const i0 = idx(Math.min(s.a[0], s.b[0]) - x0), i1 = idx(Math.max(s.a[0], s.b[0]) - x0), j0 = idx(Math.min(s.a[1], s.b[1]) - y0), j1 = idx(Math.max(s.a[1], s.b[1]) - y0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) celulas[j * n + i]!.push(s);
  }
  return (dx, dy) => {
    let ix = idx(o[0] - x0), iy = idx(o[1] - y0), melhor = Infinity;
    const px = o[0] - x0, py = o[1] - y0, passoX = dx > 0 ? 1 : -1, passoY = dy > 0 ? 1 : -1;
    const deltaX = dx === 0 ? Infinity : Math.abs(lado / dx), deltaY = dy === 0 ? Infinity : Math.abs(lado / dy);
    let proxX = dx === 0 ? Infinity : ((dx > 0 ? (ix + 1) * lado - px : px - ix * lado) / Math.abs(dx));
    let proxY = dy === 0 ? Infinity : ((dy > 0 ? (iy + 1) * lado - py : py - iy * lado) / Math.abs(dy));
    for (;;) {
      for (const s of celulas[iy * n + ix]!) { const t = tNoSegmento(o, dx, dy, s); if (t < melhor) melhor = t; }
      const saida = Math.min(proxX, proxY);
      // Uma folga na saída da célula: um acerto bem na quina também vive na vizinha.
      if (melhor <= saida - 1e-7 || saida >= alcance) return melhor;
      if (proxX < proxY) { ix += passoX; proxX += deltaX; } else { iy += passoY; proxY += deltaY; }
      if (ix < 0 || ix >= n || iy < 0 || iy >= n) return melhor;
    }
  };
}

/** Quadrado da menor distância entre o ponto `o` e o segmento. */
function distanciaAoSegmento2(o: Ponto, s: Segmento): number {
  const sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1], c2 = sx * sx + sy * sy;
  const u = c2 > 0 ? Math.max(0, Math.min(1, ((o[0] - s.a[0]) * sx + (o[1] - s.a[1]) * sy) / c2)) : 0;
  const dx = s.a[0] + sx * u - o[0], dy = s.a[1] + sy * u - o[1];
  return dx * dx + dy * dy;
}

/**
 * O polígono iluminado por uma fonte em `o`, como lista plana `[x, y, x, y…]`, limitado a `alcance` metros.
 * Com `cone`, só entre `direction ± angle / 2` e com o próprio `o` como primeiro vértice.
 */
export function poligonoIluminado(o: Ponto, segs: readonly Segmento[], alcance: number, cone: { angle: number; direction: number } | null): number[] {
  const angulos: number[] = [];
  for (const s of segs) for (const p of [s.a, s.b]) {
    if (Math.hypot(p[0] - o[0], p[1] - o[1]) > alcance * 1.5) continue;
    const a = Math.atan2(p[1] - o[1], p[0] - o[0]); angulos.push(a - 1e-4, a, a + 1e-4);
  }
  for (let i = 0; i < 96; i++) angulos.push(-Math.PI + i * Math.PI * 2 / 96);
  let lista = angulos;
  if (cone) {
    const rel = (a: number) => { let d = a - cone.direction; while (d <= -Math.PI) d += 2 * Math.PI; while (d > Math.PI) d -= 2 * Math.PI; return d; };
    const meia = cone.angle / 2;
    lista = angulos.map(rel).filter(d => Math.abs(d) <= meia);
    lista.push(-meia, meia); lista.sort((a, b) => a - b);
    lista = lista.map(d => d + cone.direction);
  } else lista.sort((a, b) => a - b);
  const pontos: number[] = cone ? [o[0], o[1]] : [];
  // Um segmento cujo ponto mais próximo já passa do alcance só seria atingido além dele (o raio é limitado ao alcance): fora da conta.
  const proximos = segs.filter(s => distanciaAoSegmento2(o, s) <= alcance * alcance);
  const pelaGrade = proximos.length >= SEGMENTOS_PARA_GRADE ? criarGradeDeRaios(o, proximos, alcance) : null;
  for (const a of lista) {
    const dx = Math.cos(a), dy = Math.sin(a), t = Math.min(alcance, pelaGrade ? pelaGrade(dx, dy) : raio(o, dx, dy, proximos));
    pontos.push(o[0] + dx * t, o[1] + dy * t);
  }
  return pontos;
}

/**
 * O polígono de visão estilo Darkwood: um único polígono estrelado contínuo em torno de `o`
 * que une o cone direcional longo (`alcanceCone` dentro de `cone.direction ± cone.angle / 2`)
 * com a bolha de percepção imediata 360° (`alcanceProximidade` fora do cone), recortados pelos mesmos oclusores.
 */
export function poligonoDeVisaoDarkwood(
  o: Ponto,
  segs: readonly Segmento[],
  alcanceCone: number,
  alcanceProximidade: number,
  cone: { angle: number; direction: number },
): number[] {
  const rCone = Math.max(0, alcanceCone);
  const rProx = Math.min(rCone, Math.max(0, alcanceProximidade));
  if (rProx <= 0) return poligonoIluminado(o, segs, rCone, cone);
  const meia = Math.min(Math.PI, Math.max(0, cone.angle / 2));
  if (meia >= Math.PI - 1e-6) return poligonoIluminado(o, segs, rCone, null);

  const rel = (a: number) => {
    let d = a - cone.direction;
    while (d <= -Math.PI) d += 2 * Math.PI;
    while (d > Math.PI) d -= 2 * Math.PI;
    return d;
  };

  const rels: number[] = [];
  for (const s of segs) for (const p of [s.a, s.b]) {
    if (Math.hypot(p[0] - o[0], p[1] - o[1]) > rCone * 1.5) continue;
    const a = Math.atan2(p[1] - o[1], p[0] - o[0]);
    rels.push(rel(a - 1e-4), rel(a), rel(a + 1e-4));
  }
  for (let i = 0; i < 96; i++) rels.push(rel(-Math.PI + (i * Math.PI * 2) / 96));

  const eps = 1e-7;
  const antes = rels.filter(d => d < -meia - eps).sort((a, b) => a - b);
  const dentro = rels.filter(d => d > -meia + eps && d < meia - eps).sort((a, b) => a - b);
  const depois = rels.filter(d => d > meia + eps).sort((a, b) => a - b);

  const amostras: { d: number; rMax: number }[] = [];
  for (const d of antes) amostras.push({ d, rMax: rProx });
  amostras.push({ d: -meia, rMax: rProx });
  amostras.push({ d: -meia, rMax: rCone });
  for (const d of dentro) amostras.push({ d, rMax: rCone });
  amostras.push({ d: meia, rMax: rCone });
  amostras.push({ d: meia, rMax: rProx });
  for (const d of depois) amostras.push({ d, rMax: rProx });

  const proximos = segs.filter(s => distanciaAoSegmento2(o, s) <= rCone * rCone);
  const pelaGrade = proximos.length >= SEGMENTOS_PARA_GRADE ? criarGradeDeRaios(o, proximos, rCone) : null;
  const pontos: number[] = [];
  for (const { d, rMax } of amostras) {
    const a = d + cone.direction;
    const dx = Math.cos(a), dy = Math.sin(a);
    const t = Math.min(rMax, pelaGrade ? pelaGrade(dx, dy) : raio(o, dx, dy, proximos));
    pontos.push(o[0] + dx * t, o[1] + dy * t);
  }
  return pontos;
}

/**
 * Baldes de 4 m: só os segmentos perto da fonte entram na conta. O resultado é o mesmo de usar a lista inteira
 * (a área consultada, 1,5 × o alcance, é a mesma que `poligonoIluminado` considera para os ângulos).
 */
export class IndiceDeSegmentos {
  static readonly BALDE = 4;
  private readonly baldes = new Map<number, number[]>();
  readonly segmentos: readonly Segmento[];
  constructor(segmentos: readonly Segmento[]) {
    this.segmentos = segmentos;
    const B = IndiceDeSegmentos.BALDE;
    segmentos.forEach((s, i) => {
      const i0 = Math.floor(Math.min(s.a[0], s.b[0]) / B), i1 = Math.floor(Math.max(s.a[0], s.b[0]) / B), j0 = Math.floor(Math.min(s.a[1], s.b[1]) / B), j1 = Math.floor(Math.max(s.a[1], s.b[1]) / B);
      for (let j = j0; j <= j1; j++) for (let k = i0; k <= i1; k++) { const c = IndiceDeSegmentos.chave(k, j), l = this.baldes.get(c); if (l) l.push(i); else this.baldes.set(c, [i]); }
    });
  }
  private static chave(i: number, j: number): number { return j * 100_003 + i; }
  /** Os segmentos que podem influenciar uma fonte em `o` com esse alcance, sem repetir e na ordem original. */
  perto(o: Ponto, alcance: number): Segmento[] {
    const B = IndiceDeSegmentos.BALDE, r = alcance * 1.5, achados = new Set<number>();
    for (let j = Math.floor((o[1] - r) / B); j <= Math.floor((o[1] + r) / B); j++) for (let k = Math.floor((o[0] - r) / B); k <= Math.floor((o[0] + r) / B); k++) for (const i of this.baldes.get(IndiceDeSegmentos.chave(k, j)) ?? []) achados.add(i);
    return [...achados].sort((a, b) => a - b).map(i => this.segmentos[i]!);
  }
}

const ALTURA_MINIMA_OCLUSOR = 1.6;
const FATOR_OCTOGONO = Math.SQRT2 - 1;

const RECEITAS_OCLUSORAS_ESTRUTURAIS = new Set([
  'pilar', 'coluna-arruinada', 'palicada', 'rochedo', 'lareira.pedra', 'lareira.marmore', 'fornalha',
  'pilha-de-caixotes', 'pilha-de-barris', 'armario', 'armario.metal', 'armario.amostras',
  'guarda-roupa.liso', 'cristaleira', 'estante', 'prateleira.pocoes', 'confessionario', 'orgao-de-tubos',
  'jazigo', 'tenda', 'barraca-de-feira', 'conteiner', 'gerador', 'painel.eletrico', 'geladeira',
]);

const RECEITAS_SEM_OCLUSAO = new Set([
  'poste.luz', 'lanterna-de-poste', 'lanterna.farol', 'luminaria.chao', 'tocheiro', 'velas-votivas',
  'braseiro', 'fogueira', 'caldeirao', 'espeto-de-assar', 'alcapao', 'cerca', 'grade.ferro',
  'balaustrada', 'portao.ferro', 'varal', 'pas.moinho', 'cabideiro', 'espantalho',
  'navio', 'barco-de-vela', 'guindaste-de-cais',
]);

const CATEGORIAS_SEM_OCLUSAO = new Set(['camas', 'assentos']);

/** Informa se um objeto de piso deve projetar sombra dinâmica contra fontes de luz. */
export function objetoBloqueiaLuz(o: Objeto): boolean {
  if (o.blocks.light !== undefined) return o.blocks.light;
  if (o.blocks.sight) return true;
  const id = ACERVO.idDaFonte(o.source);
  if (RECEITAS_SEM_OCLUSAO.has(id) || id.startsWith('tocha') || id.startsWith('escada')) return false;
  const item = ACERVO.item(id);
  if (ehArvore(id) || item?.tags.includes('arvore') || item?.tags.includes('arbusto')) return false;
  if (item && CATEGORIAS_SEM_OCLUSAO.has(item.categoria)) return false;
  if (RECEITAS_OCLUSORAS_ESTRUTURAIS.has(id) && o.scale >= 0.7) return true;
  return ACERVO.alturaDaFonte(o.source) * o.scale >= ALTURA_MINIMA_OCLUSOR;
}

/** Constrói segmentos fechados a partir dos vértices de um polígono simples. */
export function segmentosDoPoligono(poligono: readonly Ponto[]): Segmento[] {
  const segs: Segmento[] = [];
  for (let i = 0; i < poligono.length; i++) {
    segs.push({ a: poligono[i]!, b: poligono[(i + 1) % poligono.length]! });
  }
  return segs;
}

export function poligonoDoObjeto(o: Objeto): Ponto[] {
  const [pw, ph] = ACERVO.pegadaDaFonte(o.source);
  const w = pw * o.scale, h = ph * o.scale;
  if (w <= 0 || h <= 0) return [];
  const rx = w / 2, ry = h / 2;
  const quadrado = Math.max(w, h) <= Math.min(w, h) * 1.25;
  const locais: readonly Ponto[] = quadrado
    ? [
        [-rx, -ry * FATOR_OCTOGONO], [-rx * FATOR_OCTOGONO, -ry], [rx * FATOR_OCTOGONO, -ry], [rx, -ry * FATOR_OCTOGONO],
        [rx, ry * FATOR_OCTOGONO], [rx * FATOR_OCTOGONO, ry], [-rx * FATOR_OCTOGONO, ry], [-rx, ry * FATOR_OCTOGONO],
      ]
    : [[-rx, -ry], [rx, -ry], [rx, ry], [-rx, ry]];
  const c = Math.cos(o.rotation), s = Math.sin(o.rotation), [cx, cy] = o.position;
  return locais.map(([u, v]) => [cx + u * c - v * s, cy + u * s + v * c]);
}

/** Extrai segmentos de oclusão rotacionados e polígonos de auto-contenção para pilares e objetos altos no piso. */
export function oclusoresDeObjetos(m: Pick<MapaAtlas, 'props'>, opcoes: OpcoesOclusoresDeObjetos = {}): OclusorDeObjeto[] {
  const nivel = opcoes.levelId ?? null;
  const saida: OclusorDeObjeto[] = [];
  for (const o of Object.values(m.props)) {
    if ((o.levelId ?? null) !== nivel || o.elevation !== 'floor' || o.oculto) continue;
    if (!objetoBloqueiaLuz(o)) continue;
    const poligono = poligonoDoObjeto(o);
    if (poligono.length < 3) continue;
    saida.push({ id: o.id, poligono, segmentos: segmentosDoPoligono(poligono) });
  }
  return saida;
}

/** Diz se `p` está na borda do polígono (a menos de `tol`). */
export function pontoNaBorda(p: Ponto, poligono: readonly Ponto[], tol = 1e-4): boolean {
  const tol2 = tol * tol;
  for (let i = 0; i < poligono.length; i++) {
    const a = poligono[i]!, b = poligono[(i + 1) % poligono.length]!;
    const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
    const u = len2 > 1e-12 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2)) : 0;
    const px = a[0] + u * dx - p[0], py = a[1] + u * dy - p[1];
    if (px * px + py * py <= tol2) return true;
  }
  return false;
}

/** Junta segmentos de paredes com os de objetos que não contêm `posLuz` e tokens fora da margem de auto-oclusão. */
export function segmentosParaFonte(
  posLuz: Ponto,
  segmentosParedes: readonly Segmento[],
  oclusoresObj: readonly OclusorDeObjeto[],
  oclusoresTokens: readonly OclusorDeToken[] = [],
  filtro: FiltroDeFonte = {},
): Segmento[] {
  if (oclusoresObj.length === 0 && oclusoresTokens.length === 0) return [...segmentosParedes];
  const saida = [...segmentosParedes];
  for (const obj of oclusoresObj) {
    if (filtro.ownerId && obj.id === filtro.ownerId) continue;
    if (pontoNoPoligono(posLuz, obj.poligono) || pontoNaBorda(posLuz, obj.poligono)) continue;
    for (const seg of obj.segmentos) saida.push(seg);
  }
  for (const tok of oclusoresTokens) {
    if (filtro.ownerId && tok.id === filtro.ownerId) continue;
    if (filtro.lightId && tok.lightId === filtro.lightId) continue;
    const margem = tok.raio + 0.15;
    const dx = tok.centro[0] - posLuz[0], dy = tok.centro[1] - posLuz[1];
    if (dx * dx + dy * dy <= margem * margem) continue;
    for (const seg of tok.segmentos) saida.push(seg);
  }
  return saida;
}

/** Raio da silhueta octogonal de oclusão de uma peça (cerca de 45% do diâmetro mínimo). */
export const raioDoOclusorDeToken = (peca: Pick<Peca, 'size'>): number => Math.max(0.22, peca.size * 0.28);

function poligonoDoToken(peca: Pick<Peca, 'position' | 'size'>): Ponto[] {
  return poligonoRegular(peca.position, raioDoOclusorDeToken(peca), 8, Math.PI / 8);
}

/** Segmentos leves (octógono reduzido) para oclusão dinâmica de uma peça. */
export function oclusorDeToken(peca: Pick<Peca, 'position' | 'size'>): Segmento[] {
  return segmentosDoPoligono(poligonoDoToken(peca));
}

/** Extrai oclusores octogonais de todas as peças vivas no nível especificado. */
export function oclusoresDeTokens(m: Pick<MapaAtlas, 'tokens'>, nivel: string | null = null): OclusorDeToken[] {
  const saida: OclusorDeToken[] = [];
  for (const p of Object.values(m.tokens)) {
    if ((p.levelId ?? null) !== nivel || p.figure.state === 'dead') continue;
    const raio = raioDoOclusorDeToken(p);
    const poligono = poligonoDoToken(p);
    saida.push({ id: p.id, centro: p.position, raio, lightId: p.lightId, poligono, segmentos: segmentosDoPoligono(poligono) });
  }
  return saida;
}
