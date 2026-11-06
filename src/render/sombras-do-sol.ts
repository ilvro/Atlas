import { BlurFilter, ColorMatrixFilter, Container, Graphics, Matrix, Sprite } from 'pixi.js';
import { contornar } from '../domain/contorno.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';
import { sombraDoSol, type SombraDoSol } from '../domain/sol.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { ladoBaixo } from '../procedural/escarpa.ts';
import { materialDe } from '../procedural/materiais.ts';
import { ehEscarpaAvulsa } from './entradas.ts';

/** Quanto o maciço de rocha "tem de altura" para a sombra (a mesma saturação do relevo do assar). */
export const ALTURA_DA_ROCHA = 1.5;

/** A entrada de um objeto na cena, no que a sombra precisa. */
interface EntradaVisual { c: Container; sprite: Sprite | null }

/**
 * A sombra do sol nos exteriores: todas as sombras (objetos, escarpas, maciços) são desenhadas numa cor só, dentro de um `Container` com um filtro
 * que as achata numa cor e as desfoca, e com a opacidade da sombra no próprio container: onde duas se cruzam não escurece em dobro.
 * Atualiza quando muda o clima, o mapa ou chega uma textura; nada por quadro.
 */
export function criarSombrasDoSol() {
  const raiz = new Container(), objetos = new Container(), figuras = new Graphics(), apagar = new Graphics();
  apagar.blendMode = 'erase';
  raiz.addChild(objetos, figuras, apagar);
  const achatar = new ColorMatrixFilter(), desfoque = new BlurFilter({ strength: 2, quality: 3 });
  raiz.visible = false;
  const sprites = new Map<string, Container>();
  let ligado = true, corAtual = '', pixelAtual: boolean | null = null;
  const macicos = new Map<string, { celulas: unknown; res: number; polis: Ponto[][] }>();

  function pintarCor(cor: string, pixel: boolean): void {
    if (cor === corAtual && pixel === pixelAtual) return;
    corAtual = cor; pixelAtual = pixel;
    const n = parseInt(cor.slice(1), 16);
    achatar.matrix = [0, 0, 0, 0, ((n >> 16) & 255) / 255, 0, 0, 0, 0, ((n >> 8) & 255) / 255, 0, 0, 0, 0, (n & 255) / 255, 0, 0, 0, 1, 0];
    raiz.filters = pixel ? [achatar] : [achatar, desfoque];
  }

  /** A transformação que leva o desenho do objeto (centro, rotação, escala) a uma silhueta esticada para `dir`: a base fica no pé e a ponta vai `altura × porMetro` adiante. */
  function matrizDaSombra(pos: Ponto, rot: number, escala: number, pegada: [number, number], altura: number, s: SombraDoSol): Matrix {
    const [dx, dy] = s.dir, c = Math.cos(rot) * escala, sn = Math.sin(rot) * escala;
    const extensao = Math.max(0.2, (Math.abs(dx * c + dy * sn) * pegada[0] + Math.abs(-dx * sn + dy * c) * pegada[1]) / Math.max(escala, 1e-6)), comprimento = altura * escala * s.porMetro;
    const k = 1 + comprimento / (extensao * escala || 1);
    // Linear = S · R, com S = I + (k − 1) d dᵀ e R a rotação com a escala.
    const k1 = k - 1, s00 = 1 + k1 * dx * dx, s01 = k1 * dx * dy, s11 = 1 + k1 * dy * dy;
    const r00 = c, r01 = -sn, r10 = sn, r11 = c;
    return new Matrix(s00 * r00 + s01 * r10, s01 * r00 + s11 * r10, s00 * r01 + s01 * r11, s01 * r01 + s11 * r11, pos[0] + dx * comprimento / 2, pos[1] + dy * comprimento / 2);
  }

  function poligonoMacico(m: MapaAtlas, id: string): Ponto[][] {
    const camada = m.terrain.layers[id]!, antigo = macicos.get(id);
    if (antigo && antigo.celulas === camada.cells && antigo.res === m.terrain.resolution) return antigo.polis;
    const polis = contornar(camada.cells, m.terrain.resolution, { limite: [Math.ceil(m.bounds.width / m.terrain.resolution), Math.ceil(m.bounds.height / m.terrain.resolution)] }).filter(l => l.length >= 4 && l[0]![0] === l[l.length - 1]![0] && l[0]![1] === l[l.length - 1]![1]);
    macicos.set(id, { celulas: camada.cells, res: m.terrain.resolution, polis });
    return polis;
  }

  function atualizar(m: MapaAtlas, entradas: ReadonlyMap<string, EntradaVisual>, pixel: boolean): void {
    const s = sombraDoSol(m.climate, pixel);
    figuras.clear(); apagar.clear();
    if (!s) { raiz.visible = false; for (const [id, c] of sprites) { c.destroy({ children: true }); sprites.delete(id); } return; }
    pintarCor(s.cor, pixel); raiz.alpha = s.alfa;

    // Objetos de piso, fora de cômodos, com a mesma textura que o objeto já tem.
    const vivos = new Set<string>();
    for (const o of Object.values(m.props)) {
      if (!o.castsShadow || o.elevation !== 'floor' || o.roomId !== null) continue;
      const e = entradas.get(o.id), sp = e?.sprite; if (!e || !sp || sp.destroyed || sp.texture.destroyed) continue;
      vivos.add(o.id);
      let c = sprites.get(o.id), filho = c?.children[0] as Sprite | undefined;
      if (!c || !filho) { c = new Container(); filho = new Sprite(sp.texture); c.addChild(filho); objetos.addChild(c); sprites.set(o.id, c); }
      filho.texture = sp.texture; filho.position.copyFrom(sp.position); filho.scale.copyFrom(sp.scale);
      c.setFromMatrix(matrizDaSombra(o.position, o.rotation, o.scale, ACERVO.pegadaDaFonte(o.source), ACERVO.alturaDaFonte(o.source), s));
    }
    for (const [id, c] of sprites) if (!vivos.has(id)) { c.destroy({ children: true }); sprites.delete(id); }

    // Escarpas avulsas: o corte da crista, varrido para o lado baixo, quando o sol está do lado alto.
    const v: Ponto = [0, 0];
    for (const p of Object.values(m.walls)) {
      if (!ehEscarpaAvulsa(p)) continue;
      const L = p.height * s.porMetro; v[0] = s.dir[0] * L; v[1] = s.dir[1] * L;
      for (let i = 0; i + 1 < p.path.length; i++) {
        const a = p.path[i]!, b = p.path[i + 1]!, n = ladoBaixo(a, b, p.drop ?? 'b');
        if (n[0] * s.dir[0] + n[1] * s.dir[1] < 0.05) continue;
        figuras.poly([a[0], a[1], b[0], b[1], b[0] + v[0], b[1] + v[1], a[0] + v[0], a[1] + v[1]]).fill({ color: 0xffffff });
      }
    }

    // Maciços: o contorno varrido ao longo da sombra (a figura deslocada e as faixas de cada aresta); a própria rocha não escurece.
    const vm: Ponto = [s.dir[0] * ALTURA_DA_ROCHA * s.porMetro, s.dir[1] * ALTURA_DA_ROCHA * s.porMetro], vivas = new Set<string>();
    for (const camada of Object.values(m.terrain.layers)) {
      if (materialDe(camada.material).uso !== 'macico' || !camada.cells.length) continue;
      vivas.add(camada.id);
      for (const poli of poligonoMacico(m, camada.id)) {
        figuras.poly(poli.flatMap(q => [q[0] + vm[0], q[1] + vm[1]])).fill({ color: 0xffffff });
        for (let i = 0; i + 1 < poli.length; i++) { const a = poli[i]!, b = poli[i + 1]!; figuras.poly([a[0], a[1], b[0], b[1], b[0] + vm[0], b[1] + vm[1], a[0] + vm[0], a[1] + vm[1]]).fill({ color: 0xffffff }); }
        apagar.poly(poli.flatMap(q => [q[0], q[1]])).fill({ color: 0xffffff });
      }
    }
    for (const id of macicos.keys()) if (!vivas.has(id)) macicos.delete(id);
    raiz.visible = ligado;
  }

  return {
    raiz, atualizar,
    /** O editor liga e desliga a atmosfera; sem ela, sem sombras. */
    definirLigado(l: boolean) { ligado = l; if (!l) raiz.visible = false; },
    /** Quantas sombras de objeto existem agora (testes). */
    contagem: () => sprites.size,
    destruir() { achatar.destroy(); desfoque.destroy(); },      // a árvore da cena destrói o container
  };
}
