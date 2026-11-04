import { Container, Graphics } from 'pixi.js';
import { decodificar } from '../domain/celulas.ts';
import { contornoDoComodo } from '../domain/geometria.ts';
import type { Comodo, MapaAtlas } from '../domain/mapa.ts';
import { comodosConhecidos } from '../domain/nevoa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { materialDe } from '../procedural/materiais.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import type { Vista } from './nevoa.ts';

/** Quanto o telhado leva para sumir ou voltar, em segundos. */
export const DURACAO_DO_TELHADO = 0.4;
/** O mestre vê o telhado esmaecido, para saber que ele existe sem perder o cômodo de vista. */
const ALFA_DO_MESTRE = 0.25;

export interface Telhados {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Em Construir não há telhado; o mestre o vê a 25%; os jogadores o veem inteiro até alguém entrar. */
  definirVista(v: Vista): void;
  quadro(agora: number): void;
  /** Para os testes: a opacidade de cada telhado agora. */
  diagnostico(): { id: string; alfa: number; alvo: number; dentro: boolean; conhecido: boolean }[];
  destruir(): void;
}

interface DoComodo { c: Graphics; sala: Comodo; alfa: number; alvo: number; dentro: boolean; conhecido: boolean }

export function criarTelhados(): Telhados {
  const raiz = new Container(), telhas = new Map<string, DoComodo>();
  let mapa: MapaAtlas | null = null, vista: Vista = 'construir', ultimo = -1, destruido = false, imediato = true;

  /** O telhado de um cômodo: as telhas em fileiras sobre as células, com o contorno. */
  function desenhar(g: Graphics, m: MapaAtlas, sala: Comodo): void {
    const mat = materialDe(sala.roof.material ?? ''), t = m.grid.size, [ox, oy] = m.grid.offset, base = hexParaNumero(mat.base), escuro = hexParaNumero(mat.escuro), claro = hexParaNumero(mat.claro);
    g.clear();
    for (const [y, x0, n] of sala.cells) g.rect(ox + x0 * t, oy + y * t, n * t + 0.01, t + 0.01);
    g.fill(base);
    for (const [y, x0, n] of sala.cells) {
      const px0 = ox + x0 * t, py0 = oy + y * t, w = n * t;
      for (let k = 0, linha = 0; k < t; k += 0.4, linha++) {
        g.moveTo(px0, py0 + k).lineTo(px0 + w, py0 + k).stroke({ width: 0.035, color: escuro, alpha: 0.55 });
        g.moveTo(px0, py0 + k + 0.05).lineTo(px0 + w, py0 + k + 0.05).stroke({ width: 0.03, color: claro, alpha: 0.25 });
        for (let x = (linha % 2) * 0.3; x < w; x += 0.6) g.moveTo(px0 + x, py0 + k).lineTo(px0 + x, Math.min(py0 + t, py0 + k + 0.4)).stroke({ width: 0.025, color: escuro, alpha: 0.4 });
      }
    }
    for (const laco of contornoDoComodo(m, decodificar(sala.cells))) { g.moveTo(laco[0]!.a[0], laco[0]!.a[1]); for (const s of laco) g.lineTo(s.b[0], s.b[1]); g.closePath(); }
    g.stroke({ width: 0.14, color: escuro, join: 'round' });
  }

  /** Há peça de jogador dentro do cômodo (na célula dele)? */
  function alguemDentro(m: MapaAtlas, sala: Comodo): boolean {
    const t = m.grid.size, [ox, oy] = m.grid.offset, celulas = new Set(decodificar(sala.cells).map(([x, y]) => `${x},${y}`));
    return Object.values(m.tokens).some(p => p.player && celulas.has(`${Math.floor((p.position[0] - ox) / t)},${Math.floor((p.position[1] - oy) / t)}`));
  }

  function alvoDe(r: DoComodo): number {
    if (vista === 'construir' || !r.sala.roof.visible) return 0;
    return vista === 'mestre' ? ALFA_DO_MESTRE : r.dentro || !r.conhecido ? 0 : 1;
  }

  function reavaliar(): void {
    const m = mapa; if (!m) return;
    // Um telhado que ninguém viu continua escondido: só se mostra o de um cômodo de que algum pedaço está à vista ou explorado.
    const conhecidos = vista === 'jogador' && telhas.size ? comodosConhecidos(m) : null;
    for (const r of telhas.values()) { r.dentro = alguemDentro(m, r.sala); r.conhecido = !conhecidos || conhecidos.has(r.sala.id); r.alvo = alvoDe(r); if (imediato) { r.alfa = r.alvo; r.c.alpha = r.alfa; r.c.visible = r.alfa > 0.001; } }
  }

  return {
    raiz,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c];
      mapa = m;
      if (tudo) imediato = true;
      if (col('rooms') || tudo || (mud && mud.campos.includes('grid'))) {
        const vivos = new Set<string>();
        for (const sala of Object.values(m.rooms)) {
          if (!sala.roof.material) continue;
          vivos.add(sala.id);
          let r = telhas.get(sala.id);
          if (!r) { r = { c: new Graphics(), sala, alfa: 0, alvo: 0, dentro: false, conhecido: false }; r.c.visible = false; raiz.addChild(r.c); telhas.set(sala.id, r); }
          r.sala = sala; desenhar(r.c, m, sala);
        }
        for (const [id, r] of telhas) if (!vivos.has(id)) { r.c.destroy(); telhas.delete(id); }
      }
      reavaliar(); if (tudo) imediato = false;
    },
    definirVista(v) { if (v === vista) return; vista = v; imediato = true; reavaliar(); imediato = false; },
    quadro(agora) {
      if (destruido) return;
      const dt = ultimo < 0 ? 0 : Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
      for (const r of telhas.values()) {
        if (r.alfa === r.alvo) continue;
        const passo = movimentoReduzido() ? 1 : dt / DURACAO_DO_TELHADO;
        r.alfa = r.alfa < r.alvo ? Math.min(r.alvo, r.alfa + passo) : Math.max(r.alvo, r.alfa - passo);
        r.c.alpha = r.alfa; r.c.visible = r.alfa > 0.001;
      }
    },
    diagnostico: () => [...telhas.entries()].map(([id, r]) => ({ id, alfa: r.alfa, alvo: r.alvo, dentro: r.dentro, conhecido: r.conhecido })),
    destruir() { destruido = true; raiz.destroy({ children: true }); },
  };
}
