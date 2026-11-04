import { Container, Graphics, RenderTexture, type Renderer } from 'pixi.js';
import { decodificar } from '../domain/celulas.ts';
import { centroDaAbertura, comprimentoDaParede, contornoDoComodo, pontoNaParede } from '../domain/geometria.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { valueNoise2D } from '../procedural/ruido.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';

/** Pixels por metro da memória: o traço precisa de mais resolução do que as máscaras. */
export const RES_MEMORIA = 16;
const TEXTURA_MAX = 4096, ESPERA = 300;
const PAPEIS: Record<string, string> = { 'papel-claro': '#e6dcc3', 'papel-velho': '#d3bf96', 'papel-pardo': '#c9b48a' };

/** A cor do papel: um hex, ou o nome de um papel conhecido (qualquer outro vira o claro). */
export const corDoPapel = (paper: string): number => hexParaNumero(/^#[0-9a-f]{6}$/i.test(paper) ? paper : PAPEIS[paper] ?? PAPEIS['papel-claro']!);

export interface Memoria {
  /** O mapa em esboço (papel e nanquim), em `RES_MEMORIA` px/m; `null` até o primeiro desenho. */
  readonly textura: RenderTexture | null;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Refaz o esboço se algo mudou há mais de `ESPERA` ms; devolve se refez. */
  quadro(agora: number): boolean;
  destruir(): void;
}

/**
 * O que um jogador "lembra" do lugar: piso e paredes viram traço de nanquim sobre papel, sem cor nem luz; portas viram vão; objetos fixos só
 * no contorno; peças, luzes e objetos soltos não aparecem. A largura do traço varia por ruído, para parecer feita à mão.
 */
export function criarMemoria(renderer: Renderer): Memoria {
  const raiz = new Container(), g = new Graphics(), ruido = valueNoise2D(11);
  raiz.addChild(g);
  let rt: RenderTexture | null = null, largura = 0, altura = 0, mapa: MapaAtlas | null = null, pendente = false, desde = 0, destruido = false;

  function dimensionar(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height;
    if (rt && w === largura && h === altura) return;
    largura = w; altura = h;
    const res = Math.min(RES_MEMORIA, TEXTURA_MAX / Math.max(w, h)), antiga = rt;
    rt = RenderTexture.create({ width: Math.max(1, Math.round(w * res)), height: Math.max(1, Math.round(h * res)) }); raiz.scale.set(rt.width / w, rt.height / h);
    antiga?.destroy(true);
  }

  /** Um traço à mão: pedaços curtos com a posição e a largura variando um pouco. */
  function tracar(pts: readonly Ponto[], largura0: number, cor: number, alfa = 0.92): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i]!, [x1, y1] = pts[i + 1]!, comp = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(comp / 0.5));
      let ax = x0, ay = y0;
      for (let k = 1; k <= n; k++) {
        const f = k / n, bx = x0 + (x1 - x0) * f + (k < n ? (ruido(x0 + (x1 - x0) * f * 1.9, y0 + (y1 - y0) * f * 1.9) - 0.5) * 0.06 : 0), by = y0 + (y1 - y0) * f + (k < n ? (ruido(y0 + (y1 - y0) * f * 1.9 + 50, x0 + (x1 - x0) * f * 1.9) - 0.5) * 0.06 : 0);
        g.moveTo(ax, ay).lineTo(bx, by).stroke({ width: largura0 * (0.7 + 0.6 * ruido(bx * 2.3, by * 2.3)), color: cor, alpha: alfa, cap: 'round', join: 'round' });
        ax = bx; ay = by;
      }
    }
  }

  function desenhar(): void {
    const m = mapa; if (!m || !rt) return;
    const papel = corDoPapel(m.memory.paper), tinta = hexParaNumero(m.memory.ink);
    g.clear().rect(0, 0, m.bounds.width, m.bounds.height).fill(papel);
    // Fibras do papel: manchas suaves de ruído, só para o fundo não ficar chapado.
    for (let y = 0; y < m.bounds.height; y += 0.3) for (let x = 0; x < m.bounds.width; x += 0.3) { const n = ruido(x * 1.1, y * 1.1) - 0.5; if (Math.abs(n) > 0.2) g.rect(x, y, 0.3, 0.3).fill({ color: n > 0 ? 0xffffff : 0x8a7a5a, alpha: Math.min(0.14, (Math.abs(n) - 0.2) * 0.5) }); }
    for (const c of Object.values(m.rooms)) for (const laco of contornoDoComodo(m, decodificar(c.cells))) tracar([laco[0]!.a, ...laco.map(s => s.b)], 0.05, tinta, 0.75);
    for (const p of Object.values(m.walls)) tracar(p.path as Ponto[], Math.max(0.1, p.thickness * (p.kind === 'wall' ? 0.8 : 0.5)), tinta);
    // As aberturas apagam o traço da parede (vão) e deixam só a folha da porta ou o vidro da janela.
    for (const o of Object.values(m.openings)) {
      const p = m.walls[o.wallId]; if (!p) continue;
      const d = centroDaAbertura(p, o), meia = Math.min(o.width / 2, comprimentoDaParede(p) / 2), a = pontoNaParede(p, d - meia), b = pontoNaParede(p, d + meia);
      g.moveTo(a.ponto[0], a.ponto[1]).lineTo(b.ponto[0], b.ponto[1]).stroke({ width: p.thickness * 0.8 + 0.12, color: papel, cap: 'butt' });
      if (o.kind === 'window') tracar([a.ponto, b.ponto], 0.04, tinta, 0.7);
      else if (o.kind !== 'arch' && o.state !== 'open') tracar([a.ponto, b.ponto], 0.06, tinta, 0.85);
      else if (o.kind === 'door') { const n: Ponto = [-a.tangente[1], a.tangente[0]]; tracar([a.ponto, [a.ponto[0] + n[0] * o.width * 0.9, a.ponto[1] + n[1] * o.width * 0.9]], 0.05, tinta, 0.6); }
    }
    // Objetos fixos (que bloqueiam o movimento): só o contorno da pegada, girada como o objeto.
    for (const o of Object.values(m.props)) {
      if (o.elevation !== 'floor' || !o.blocks.move) continue;
      const [pw, ph] = ACERVO.pegadaDaFonte(o.source), hw = (pw * o.scale) / 2, hh = (ph * o.scale) / 2, c = Math.cos(o.rotation), s = Math.sin(o.rotation);
      const cantos = ([[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh], [-hw, -hh]] as const).map(([x, y]): Ponto => [o.position[0] + x * c - y * s, o.position[1] + x * s + y * c]);
      tracar(cantos, 0.035, tinta, 0.7);
    }
    renderer.render({ container: raiz, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
  }

  return {
    get textura() { return rt; },
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => c.some(x => mud!.campos.includes(x));
      mapa = m;
      if (tudo || campo('bounds') || !rt) dimensionar(m);
      if (tudo || col('rooms') || col('walls') || col('openings') || col('props') || campo('grid', 'memory', 'bounds')) { pendente = true; desde = performance.now(); if (tudo || !rt) desde = 0; }
    },
    quadro(agora) {
      if (destruido || !pendente || agora - desde < ESPERA) return false;
      pendente = false; desenhar(); return true;
    },
    destruir() { destruido = true; rt?.destroy(true); raiz.destroy({ children: true }); },
  };
}
