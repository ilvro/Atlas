import { BlurFilter, Container, Graphics, Matrix, Sprite, type Texture } from 'pixi.js';
import { edificiosDe, type Edificio } from '../domain/edificios.ts';
import type { DetalheDeTelhado, MapaAtlas, Peca, Ponto } from '../domain/mapa.ts';
import { comodosConhecidos } from '../domain/nevoa.ts';
import { sombraDoSol } from '../domain/sol.ts';
import { aguasDoTrecho, formaDe, retangulosDe, trechosDe } from '../domain/telhado-geometria.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import type { Baker } from '../procedural/baker.ts';
import { ehPadraoDeCobertura, PERIODO_DA_COBERTURA, RES_DA_COBERTURA } from '../procedural/coberturas.ts';
import { posicoesDosDetalhes } from '../procedural/detalhes-de-telhado.ts';
import type { IdDoEstilo, OpcoesDoPixel } from '../procedural/estilos/index.ts';
import { materialDe } from '../procedural/materiais.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { opcoesDoPixel, resolucaoDe } from './entradas.ts';
import type { Vista } from './nevoa.ts';
import { texturaPropria } from './textura-propria.ts';

/** Quanto tempo leva (em segundos) para um telhado aparecer ou sumir ao entrar/sair de uma casa. */
export const DURACAO_DO_TELHADO = 0.4;
/** O mestre vê o telhado esmaecido, para saber que ele existe sem perder o cômodo de vista. */
const ALFA_DO_MESTRE = 0.25;
/** Alcance da sombra projetada no chão pela cobertura (em metros). */
const SOMBRA_NORMAL = 0.6;
const SOMBRA_ALTA = 1.2;

export interface Telhados {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  definirVista(v: Vista): void;
  quadro(agora: number): void;
  /** Para os testes: a opacidade de cada telhado agora. */
  diagnostico(): { id: string; edificio: string; alfa: number; alvo: number; dentro: boolean; conhecido: boolean }[];
  /** Se o telhado do cômodo está visível e cobrindo a sala agora. */
  visivel(salaId: string): boolean;
  /** Chaves atualmente referenciadas no baker (para não serem coletadas enquanto em uso). */
  chavesEmUso(): Set<string>;
  destruir(): void;
}

interface DoEdificio {
  ed: Edificio;
  c: Container;
  sombra: Graphics;
  chaves: Set<string>;
  alfa: number;
  alvo: number;
  dentro: boolean;
  conhecido: boolean;
  visivelNoMapa: boolean;
}

interface DetalheEmCache {
  tex: Texture;
  origem: Ponto;
  res: number;
}

const chaveCobertura = (material: string, res: number, estilo: IdDoEstilo): string =>
  `cobertura|${material}|${estilo}|${estilo === 'pixel' ? res.toFixed(3) : 'i'}`;

const chaveDetalhe = (detalhe: DetalheDeTelhado, cobertura: string, seed: number, res: number, estilo: IdDoEstilo, px?: OpcoesDoPixel): string =>
  `detalhe-telhado|${detalhe}|${cobertura}|${seed}|${res.toFixed(3)}|${estilo}|${px ? `${px.ppc}|${px.contorno ? 1 : 0}|${px.paleta}|${px.dither}` : 'i'}`;

export function criarTelhados(op: { baker?: Baker; aoPintar?(): void } = {}): Telhados {
  const raiz = new Container();
  const edificios = new Map<string, DoEdificio>();
  const salaParaEdificio = new Map<string, string>();
  const coberturas = new Map<string, Texture>();
  const detalhes = new Map<string, DetalheEmCache>();
  const emVoo = new Set<string>();
  const chavesAtivas = new Set<string>();
  const desfoque = new BlurFilter({ strength: 2, quality: 3 });

  let mapa: MapaAtlas | null = null, vista: Vista = 'construir', ultimo = -1, destruido = false, imediato = true;

  function redesenharPorChave(chave: string): void {
    const m = mapa; if (!m || destruido) return;
    let tocou = false;
    for (const d of edificios.values()) {
      if (d.chaves.has(chave)) { desenharEdificio(d, m); tocou = true; }
    }
    if (tocou) op.aoPintar?.();
  }

  function pedirCobertura(chave: string, material: string, res: number, estilo: IdDoEstilo): Texture | null {
    const pronta = coberturas.get(chave);
    if (pronta) return pronta;
    if (!op.baker || emVoo.has(chave)) return null;
    emVoo.add(chave);
    op.baker.pedir(chave, { tipo: 'cobertura', material, seed: 1, res, estilo }).then(r => {
      emVoo.delete(chave);
      if (destruido) return;
      const tex = texturaPropria(r.bitmap);
      tex.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      coberturas.set(chave, tex);
      redesenharPorChave(chave);
    }).catch(erro => {
      emVoo.delete(chave);
      console.warn('Atlas: falha ao assar cobertura de telhado', erro);
    });
    return null;
  }

  function pedirDetalhe(chave: string, detalhe: DetalheDeTelhado, cobertura: string, seed: number, res: number, estilo: IdDoEstilo, pixel?: OpcoesDoPixel): DetalheEmCache | null {
    const pronto = detalhes.get(chave);
    if (pronto) return pronto;
    if (!op.baker || emVoo.has(chave)) return null;
    emVoo.add(chave);
    op.baker.pedir(chave, { tipo: 'detalhe-de-telhado', detalhe, cobertura, seed, res, estilo, pixel }).then(r => {
      emVoo.delete(chave);
      if (destruido) return;
      const tex = texturaPropria(r.bitmap);
      tex.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      detalhes.set(chave, { tex, origem: r.origem, res: r.res });
      redesenharPorChave(chave);
    }).catch(erro => {
      emVoo.delete(chave);
      console.warn('Atlas: falha ao assar detalhe de telhado', erro);
    });
    return null;
  }

  function desenharEdificio(d: DoEdificio, m: MapaAtlas): void {
    while (d.c.children.length > 1) d.c.removeChildAt(1).destroy({ children: true });
    d.chaves.clear();

    const estilo = m.style.renderer, pixel = estilo === 'pixel', pxOpts = opcoesDoPixel(m);
    const resCob = pixel ? Math.max(1, m.style.pixel.pixelsPerCell / m.grid.size) : RES_DA_COBERTURA;
    const resDet = resolucaoDe(m, 'objeto');
    const sun = m.climate.sun;
    const dirDoSol: [number, number] = sun ? [Math.cos(sun.angle), -Math.sin(sun.angle)] : [-Math.SQRT1_2, -Math.SQRT1_2];
    const sSol = sombraDoSol(m.climate, pixel);
    const trechos = trechosDe(m, d.ed);
    const t = m.grid.size, [ox, oy] = m.grid.offset, beiral = 0.25;

    d.sombra.clear();
    if (!sSol) {
      d.sombra.visible = false;
      d.sombra.filters = [];
    } else {
      d.sombra.visible = true;
      d.sombra.alpha = 0.35;
      d.sombra.filters = pixel ? [] : [desfoque];
      for (const trecho of trechos) {
        const dist = formaDe(trecho.roof).shape === 'piramide' || trecho.roof.steep ? SOMBRA_ALTA : SOMBRA_NORMAL;
        const dx = sSol.dir[0] * dist, dy = sSol.dir[1] * dist;
        for (const [rx0, ry0, rx1, ry1] of retangulosDe(trecho.celulas)) {
          d.sombra.rect(ox + rx0 * t - beiral + dx, oy + ry0 * t - beiral + dy, (rx1 - rx0) * t + beiral * 2, (ry1 - ry0) * t + beiral * 2);
        }
      }
      d.sombra.fill({ color: hexParaNumero(sSol.cor) });
    }

    for (const trecho of trechos) {
      const g = new Graphics();
      d.c.addChild(g);
      const mat = materialDe(trecho.roof.material ?? '');
      const base = hexParaNumero(mat.base), escuro = hexParaNumero(mat.escuro), claro = hexParaNumero(mat.claro);
      const forma = formaDe(trecho.roof);
      let tex: Texture | null = null;
      if (ehPadraoDeCobertura(mat.padrao)) {
        const kCob = chaveCobertura(mat.id, resCob, estilo);
        d.chaves.add(kCob);
        chavesAtivas.add(kCob);
        tex = pedirCobertura(kCob, mat.id, resCob, estilo);
      }

      const { faces, cumeeiras } = aguasDoTrecho(trecho, m.grid, beiral);
      const alfaBase = trecho.roof.steep ? 0.28 : 0.18;

      for (const face of faces) {
        if (face.platibanda) {
          const outer = face.pontos.slice(0, 4).flat();
          const inner = face.pontos.slice(5, 9).flat();
          g.poly(outer).fill({ color: escuro }).poly(inner).cut();
          const ix0 = Math.min(face.pontos[5]![0], face.pontos[7]![0]);
          const iy0 = Math.min(face.pontos[5]![1], face.pontos[7]![1]);
          const ix1 = Math.max(face.pontos[5]![0], face.pontos[7]![0]);
          const iy1 = Math.max(face.pontos[5]![1], face.pontos[7]![1]);
          const w = ix1 - ix0, h = iy1 - iy0;
          const sx = -dirDoSol[0] * 0.22, sy = -dirDoSol[1] * 0.22;
          if (w > 0 && h > 0) {
            const lx = ix0 + Math.max(0, sx), ly = iy0 + Math.max(0, sy);
            const lw = Math.max(0, w - Math.abs(sx)), lh = Math.max(0, h - Math.abs(sy));
            if (lw > 0 && lh > 0) g.rect(ix0, iy0, w, h).fill({ color: 0x000000, alpha: 0.24 }).rect(lx, ly, lw, lh).cut();
            else g.rect(ix0, iy0, w, h).fill({ color: 0x000000, alpha: 0.24 });
          }
          continue;
        }

        const pts = face.pontos.flat();
        if (tex) {
          const ang = Math.atan2(face.queda[1], face.queda[0]) - Math.PI / 2;
          const escala = PERIODO_DA_COBERTURA / tex.width;
          const matrix = new Matrix().scale(escala, escala).rotate(ang);
          g.poly(pts).fill({ texture: tex, matrix, textureSpace: 'global' });
        } else {
          g.poly(pts).fill({ color: base });
        }

        const dot = face.normal[0] * dirDoSol[0] + face.normal[1] * dirDoSol[1];
        if (dot > 0.001) g.poly(pts).fill({ color: 0xffffff, alpha: alfaBase * dot });
        else if (dot < -0.001) g.poly(pts).fill({ color: 0x000000, alpha: alfaBase * -dot });
      }

      if (cumeeiras.length) {
        for (const [[x0, y0], [x1, y1]] of cumeeiras) g.moveTo(x0, y0).lineTo(x1, y1);
        g.stroke({ width: 0.12, color: claro, cap: 'round' });
      }

      if (forma.shape === 'duas-aguas') {
        for (const [rx0, ry0, rx1, ry1] of retangulosDe(trecho.celulas)) {
          const x0 = ox + rx0 * t - beiral, y0 = oy + ry0 * t - beiral;
          const x1 = ox + rx1 * t + beiral, y1 = oy + ry1 * t + beiral;
          const horiz = forma.ridge === 'h' || (forma.ridge === 'auto' && (x1 - x0) >= (y1 - y0));
          if (horiz) g.moveTo(x0, y0).lineTo(x0, y1).moveTo(x1, y0).lineTo(x1, y1);
          else g.moveTo(x0, y0).lineTo(x1, y0).moveTo(x0, y1).lineTo(x1, y1);
        }
        g.stroke({ width: 0.08, color: escuro, cap: 'round' });
      }

      const semente = m.rooms[trecho.salas[0]!]?.floor.seed ?? 1;
      for (const pos of posicoesDosDetalhes(trecho, m.grid, semente)) {
        const kDet = chaveDetalhe(pos.detalhe, mat.id, semente, resDet, estilo, pxOpts);
        d.chaves.add(kDet);
        chavesAtivas.add(kDet);
        const pronto = pedirDetalhe(kDet, pos.detalhe, mat.id, semente, resDet, estilo, pxOpts);
        if (!pronto) continue;
        const wrap = new Container();
        wrap.position.set(pos.x, pos.y);
        wrap.rotation = pos.ang;
        const sp = new Sprite(pronto.tex);
        sp.position.set(pronto.origem[0], pronto.origem[1]);
        sp.scale.set(1 / pronto.res);
        wrap.addChild(sp);
        d.c.addChild(wrap);
      }
    }
  }

  /** Há peça de jogador dentro do edifício (em alguma célula dele)? */
  function alguemDentro(m: MapaAtlas, ed: Edificio, jogadores: readonly Peca[]): boolean {
    const t = m.grid.size, [ox, oy] = m.grid.offset, celulas = new Set(ed.celulas.map(([x, y]) => `${x},${y}`));
    return jogadores.some(p => celulas.has(`${Math.floor((p.position[0] - ox) / t)},${Math.floor((p.position[1] - oy) / t)}`));
  }

  function alvoDe(d: DoEdificio): number {
    const modoTelhados = mapa?.session.roofs ?? 'auto';
    if (vista === 'construir' || !d.visivelNoMapa || modoTelhados === 'abertos') return 0;
    if (vista === 'mestre') return ALFA_DO_MESTRE;
    return !d.conhecido || (modoTelhados !== 'fechados' && d.dentro) ? 0 : 1;
  }

  function reavaliar(): void {
    const m = mapa; if (!m) return;
    // Um telhado que ninguém viu continua escondido: só se mostra o de uma casa de que algum pedaço está à vista ou explorado.
    const conhecidos = vista === 'jogador' && edificios.size ? comodosConhecidos(m) : null;
    const jogadores = Object.values(m.tokens).filter(p => p.player);
    for (const d of edificios.values()) {
      d.dentro = alguemDentro(m, d.ed, jogadores);
      d.conhecido = !conhecidos || d.ed.salas.some(id => conhecidos.has(id));
      d.visivelNoMapa = d.ed.salas.some(id => m.rooms[id]?.roof.visible);
      d.alvo = alvoDe(d);
      if (imediato || movimentoReduzido()) { d.alfa = d.alvo; d.c.alpha = d.alfa; d.c.visible = d.alfa > 0.001; }
    }
  }

  return {
    raiz,
    sincronizar(m, mud) {
      mapa = m;
      const redesenhar = !mud || mud.completo || Boolean(mud.colecoes.rooms) || mud.campos.some(c => c === 'grid' || c === 'climate' || c === 'style');
      if (redesenhar) {
        const eds = edificiosDe(m);
        const ids = new Set(eds.map(e => e.id));
        for (const [id, d] of edificios) {
          if (!ids.has(id)) { d.c.destroy({ children: true }); edificios.delete(id); }
        }
        salaParaEdificio.clear();
        chavesAtivas.clear();
        for (const ed of eds) {
          let d = edificios.get(ed.id);
          if (!d) {
            const c = new Container(), sombra = new Graphics();
            c.addChild(sombra);
            c.visible = false;
            raiz.addChild(c);
            d = { ed, c, sombra, chaves: new Set(), alfa: 0, alvo: 0, dentro: false, conhecido: false, visivelNoMapa: true };
            edificios.set(ed.id, d);
          } else {
            d.ed = ed;
          }
          for (const salaId of ed.salas) salaParaEdificio.set(salaId, ed.id);
          desenharEdificio(d, m);
        }
      }
      reavaliar();
      imediato = false;
    },
    definirVista(v) { if (v === vista) return; vista = v; imediato = true; reavaliar(); imediato = false; },
    quadro(agora) {
      if (destruido) return;
      const dt = ultimo < 0 ? 0 : Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
      for (const d of edificios.values()) {
        if (d.alfa === d.alvo) continue;
        const passo = movimentoReduzido() ? 1 : dt / DURACAO_DO_TELHADO;
        d.alfa = d.alfa < d.alvo ? Math.min(d.alvo, d.alfa + passo) : Math.max(d.alvo, d.alfa - passo);
        d.c.alpha = d.alfa; d.c.visible = d.alfa > 0.001;
      }
    },
    diagnostico: () => {
      const out: { id: string; edificio: string; alfa: number; alvo: number; dentro: boolean; conhecido: boolean }[] = [];
      for (const d of edificios.values()) {
        for (const id of d.ed.salas) out.push({ id, edificio: d.ed.id, alfa: d.alfa, alvo: d.alvo, dentro: d.dentro, conhecido: d.conhecido });
      }
      return out;
    },
    visivel: (salaId: string) => {
      const edId = salaParaEdificio.get(salaId);
      const d = edId ? edificios.get(edId) : undefined;
      return !!d && d.c.visible && d.alfa > 0.3;
    },
    chavesEmUso: () => new Set(chavesAtivas),
    destruir() {
      destruido = true;
      for (const tex of coberturas.values()) tex.destroy(true);
      coberturas.clear();
      for (const det of detalhes.values()) det.tex.destroy(true);
      detalhes.clear();
      emVoo.clear();
      chavesAtivas.clear();
      raiz.destroy({ children: true });
    },
  };
}
