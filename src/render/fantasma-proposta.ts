import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { decodificar } from '../domain/celulas.ts';
import { centroDaAbertura, comprimentoDaParede, contornoDoComodo, pontoNaParede } from '../domain/geometria.ts';
import type { Abertura, Luz, MapaAtlas, Objeto } from '../domain/mapa.ts';
import { ACERVO } from '../procedural/acervo.ts';
import type { Baker } from '../procedural/baker.ts';
import { hexParaNumero } from './cores.ts';
import { chaveDoObjeto, opcoesDoPixel, pedidoDoObjeto, resolucaoDe } from './entradas.ts';
import { texturaPropria } from './textura-propria.ts';

export interface FantasmaDeProposta {
  readonly raiz: Container;
  /** Mostra o que `previa` tem a mais que `atual`. `null` limpa tudo. */
  mostrar(atual: MapaAtlas, previa: MapaAtlas | null): void;
  /** Pulsação suave; `tempo` em milissegundos. */
  quadro(tempo: number): void;
  /** Quantas coisas estão desenhadas (para testes). */
  contagem(): number;
  destruir(): void;
}

const ALFA_MIN = 0.45, ALFA_MAX = 0.7, PERIODO = 1600;

/** O que uma proposta acrescenta, translúcido, antes de aceitar: objetos, luzes, aberturas e cômodos com piso ou papel trocado. */
export function criarFantasmaDeProposta(op: { baker: Baker; acento(): number; efeitos(): boolean }): FantasmaDeProposta {
  const raiz = new Container(), itens: Container[] = [], texturas: Texture[] = [];
  let geracao = 0, destruido = false;

  function limpar(): void {
    geracao++;
    for (const c of itens.splice(0)) c.destroy({ children: true });
    for (const t of texturas.splice(0)) t.destroy(true);
  }
  const novo = (): Container => { const c = new Container(); raiz.addChild(c); itens.push(c); return c; };

  /** Traço pontilhado em volta de um retângulo (já girado, em coordenadas locais do contêiner). */
  function contornoTracejado(w: number, h: number, cor: number): Graphics {
    const g = new Graphics(), x0 = -w / 2, y0 = -h / 2, tracos = 0.12, vazio = 0.08;
    const lado = (ax: number, ay: number, bx: number, by: number) => {
      const d = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(d / (tracos + vazio)));
      for (let i = 0; i < n; i++) { const t0 = i / n, t1 = Math.min(1, t0 + tracos / d); g.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0).lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1); }
    };
    lado(x0, y0, x0 + w, y0); lado(x0 + w, y0, x0 + w, y0 + h); lado(x0 + w, y0 + h, x0, y0 + h); lado(x0, y0 + h, x0, y0);
    return g.stroke({ width: 0.035, color: cor, alpha: 0.95 });
  }

  function objetoDePiso(o: Objeto, minha: number, m: MapaAtlas): void {
    const c = novo(), cor = op.acento(), [w, h] = ACERVO.pegadaDaFonte(o.source);
    c.position.set(o.position[0], o.position[1]); c.rotation = o.rotation; c.scale.set(o.scale);
    c.addChild(contornoTracejado(w, h, cor));
    const res = resolucaoDe(m, 'objeto'), chave = chaveDoObjeto(o, res, m.style.genre, m.style.renderer, opcoesDoPixel(m)), pedido = pedidoDoObjeto(o, res, m.style.genre, m.style.renderer, opcoesDoPixel(m)); if (!chave || !pedido) return;
    op.baker.pedir(chave, pedido).then(r => {
      if (destruido || geracao !== minha || c.destroyed) return;
      const tex = texturaPropria(r.bitmap); texturas.push(tex);
      const sp = new Sprite(tex); sp.position.set(r.origem[0], r.origem[1]); sp.scale.set(1 / r.res); sp.alpha = 0.8; c.addChildAt(sp, 0);
    }).catch(() => { /* a prévia é só um enfeite */ });
  }

  function objetoDeParede(m: MapaAtlas, o: Objeto): void {
    const w = o.wall && m.walls[o.wall.wallId]; if (!o.wall || !w || o.source.kind !== 'recipe') return;
    const largura = ACERVO.pegadaDaFonte(o.source)[0], total = comprimentoDaParede(w), c = o.wall.at * total;
    const a = pontoNaParede(w, Math.max(0, c - largura / 2)).ponto, b = pontoNaParede(w, Math.min(total, c + largura / 2)).ponto;
    novo().addChild(new Graphics().moveTo(a[0], a[1]).lineTo(b[0], b[1]).stroke({ width: w.thickness + 0.14, color: 0xd9a75e, alpha: 0.9, cap: 'butt' }));
  }

  function luzNova(l: Luz): void {
    const cor = hexParaNumero(l.color), g = new Graphics();
    g.circle(l.position[0], l.position[1], Math.min(l.radius, 4)).fill({ color: cor, alpha: 0.12 }).stroke({ width: 0.03, color: cor, alpha: 0.6 });
    g.circle(l.position[0], l.position[1], 0.2).fill(cor).stroke({ width: 0.04, color: 0x000000, alpha: 0.7 });
    novo().addChild(g);
  }

  function aberturaNova(m: MapaAtlas, a: Abertura): void {
    const w = m.walls[a.wallId]; if (!w) return;
    const c = centroDaAbertura(w, a), p = pontoNaParede(w, c - a.width / 2).ponto, q = pontoNaParede(w, c + a.width / 2).ponto;
    novo().addChild(new Graphics().moveTo(p[0], p[1]).lineTo(q[0], q[1]).stroke({ width: w.thickness + 0.12, color: op.acento(), alpha: 0.85, cap: 'butt' }));
  }

  function comodoTrocado(m: MapaAtlas, id: string): void {
    const sala = m.rooms[id]; if (!sala) return;
    const cor = op.acento(), g = new Graphics(), t = m.grid.size;
    for (const [x, y] of decodificar(sala.cells)) g.rect(m.grid.offset[0] + x * t, m.grid.offset[1] + y * t, t, t).fill({ color: cor, alpha: 0.12 });
    for (const laco of contornoDoComodo(m, decodificar(sala.cells))) { laco.forEach((s, i) => { if (i === 0) g.moveTo(s.a[0], s.a[1]); g.lineTo(s.b[0], s.b[1]); }); g.closePath(); }
    g.stroke({ width: 0.05, color: cor, alpha: 0.9 });
    novo().addChild(g);
  }

  return {
    raiz,
    mostrar(atual, previa) {
      if (destruido) return;
      limpar(); if (!previa) return;
      const minha = geracao;
      for (const o of Object.values(previa.props)) {
        if (atual.props[o.id]) continue;
        const item = ACERVO.item(ACERVO.idDaFonte(o.source));
        if (o.elevation === 'wall' || item?.tipo === 'parede') objetoDeParede(previa, o); else objetoDePiso(o, minha, previa);
      }
      for (const l of Object.values(previa.lights)) if (!atual.lights[l.id]) luzNova(l);
      for (const a of Object.values(previa.openings)) if (!atual.openings[a.id]) aberturaNova(previa, a);
      for (const r of Object.values(previa.rooms)) {
        const antes = atual.rooms[r.id];
        if (antes && (antes.floor.material !== r.floor.material || (antes.wallpaper?.material ?? null) !== (r.wallpaper?.material ?? null))) comodoTrocado(previa, r.id);
      }
    },
    quadro(tempo) {
      const a = op.efeitos() ? ALFA_MIN + (ALFA_MAX - ALFA_MIN) * (0.5 + 0.5 * Math.sin((tempo / PERIODO) * Math.PI * 2)) : 0.6;
      if (raiz.alpha !== a) raiz.alpha = a;
    },
    contagem: () => itens.length,
    destruir() { destruido = true; limpar(); raiz.destroy({ children: true }); },
  };
}
