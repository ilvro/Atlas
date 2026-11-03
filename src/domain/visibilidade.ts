import type { MapaAtlas, Ponto } from './mapa.ts';
import { centroDaAbertura } from './geometria.ts';

/**
 * Visibilidade pura: quais segmentos bloqueiam a luz (ou a visão) e que região uma fonte ilumina.
 * Sem Pixi e sem documento além do que a pergunta precisa: a Fase 7 usa as mesmas funções para a visão das peças.
 */
export interface Segmento { a: Ponto; b: Ponto }

/** O vão da abertura deixa passar a luz (ou a visão)? Arco sempre; porta e porta secreta só abertas; janela só a luz. */
const deixaPassar = (kind: 'door' | 'window' | 'arch' | 'secret', estado: 'closed' | 'open' | 'locked', para: 'luz' | 'visao'): boolean =>
  kind === 'arch' || ((kind === 'door' || kind === 'secret') && estado === 'open') || (kind === 'window' && para === 'luz');

/** Os segmentos que bloqueiam, já sem os vãos das aberturas que deixam passar. */
export function oclusores(m: Pick<MapaAtlas, 'walls' | 'openings'>, para: 'luz' | 'visao'): Segmento[] {
  const saida: Segmento[] = [], vaos = new Map<string, [number, number][]>();
  for (const o of Object.values(m.openings)) {
    if (!deixaPassar(o.kind, o.state, para)) continue;
    const p = m.walls[o.wallId]; if (!p) continue;
    const c = centroDaAbertura(p, o), lista = vaos.get(p.id) ?? [];
    lista.push([c - o.width / 2, c + o.width / 2]); vaos.set(p.id, lista);
  }
  for (const p of Object.values(m.walls)) {
    if (!(para === 'luz' ? p.blocks.light : p.blocks.sight)) continue;
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

/** Distância até o primeiro segmento atingido pelo raio de `o` na direção (dx, dy). */
function raio(o: Ponto, dx: number, dy: number, segs: readonly Segmento[]): number {
  let melhor = Infinity;
  for (const s of segs) {
    const sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1], den = dx * sy - dy * sx;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((s.a[0] - o[0]) * sy - (s.a[1] - o[1]) * sx) / den, u = ((s.a[0] - o[0]) * dy - (s.a[1] - o[1]) * dx) / den;
    if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && t < melhor) melhor = t;
  }
  return melhor;
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
  for (const a of lista) {
    const dx = Math.cos(a), dy = Math.sin(a), t = Math.min(alcance, raio(o, dx, dy, segs));
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
