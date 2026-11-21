import { BlurFilter, ColorMatrixFilter, Container, Graphics, Matrix, Sprite, type Renderer } from 'pixi.js';
import { contornar } from '../domain/contorno.ts';
import type { MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { alturaEm, bordasDoRelevo, DEGRAU_TRANSPONIVEL } from '../domain/relevo.ts';
import { sombraDoSol, type SombraDoSol } from '../domain/sol.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { ladoBaixo } from '../procedural/escarpa.ts';
import { materialDe } from '../procedural/materiais.ts';
import { criarCamadaEmTextura } from './camada-em-textura.ts';
import { ehEscarpaAvulsa } from './entradas.ts';

/** Resolução (px/m) da textura das sombras no Ilustrado: macia, mas nítida o bastante para a sombra de uma tora (30 cm) não sumir no desfoque. */
const RES_DA_SOMBRA = 24;
/** Quanto o maciço de rocha "tem de altura" para a sombra (a mesma saturação do relevo do assar). */
export const ALTURA_DA_ROCHA = 1.5;

/**
 * Objeto que é só sombra (tag `sombra-projetada`, ex.: `sombra-de-colosso`): a silhueta de algo fora do mapa. Não aparece como objeto;
 * entra na camada das sombras do sol como está, sem esticar, e some quando não há sol, como as outras sombras.
 */
export function ehSombraProjetada(o: Pick<Objeto, 'source'>): boolean {
  return ACERVO.item(ACERVO.idDaFonte(o.source))?.tags.includes('sombra-projetada') ?? false;
}

/** A entrada de um objeto na cena, no que a sombra precisa. */
interface EntradaVisual { c: Container; sprite: Sprite | null }

/**
 * A sombra do sol nos exteriores: todas as sombras (objetos, escarpas, maciços) são desenhadas numa cor só, dentro de um `Container` com um filtro
 * que as achata numa cor e as desfoca, e com a opacidade da sombra no próprio container: onde duas se cruzam não escurece em dobro.
 * Atualiza quando muda o clima, o mapa ou chega uma textura; nada por quadro. O desenho (com os filtros) vai para uma textura
 * própria em metros, e a cena recebe só o sprite dela (ver `camada-em-textura.ts`).
 */
export function criarSombrasDoSol(renderer: Renderer) {
  const raiz = new Container(), desenho = new Container(), objetos = new Container(), figuras = new Graphics(), apagar = new Graphics();
  const camada = criarCamadaEmTextura(renderer);
  apagar.blendMode = 'erase';
  desenho.addChild(objetos, figuras, apagar);
  // Multiplica: a sombra só escurece o que está embaixo (em modo normal, a cor da sombra clareava um chão mais escuro que ela).
  camada.sprite.blendMode = 'multiply';
  raiz.addChild(camada.sprite);
  const achatar = new ColorMatrixFilter(), desfoque = new BlurFilter({ strength: 1.4, quality: 3 });
  raiz.visible = false;
  const sprites = new Map<string, Container>();
  let ligado = true, corAtual = '', pixelAtual: boolean | null = null;
  const macicos = new Map<string, { celulas: unknown; res: number; polis: Ponto[][] }>();

  function pintarCor(cor: string, pixel: boolean): void {
    if (cor === corAtual && pixel === pixelAtual) return;
    corAtual = cor; pixelAtual = pixel;
    const n = parseInt(cor.slice(1), 16);
    achatar.matrix = [0, 0, 0, 0, ((n >> 16) & 255) / 255, 0, 0, 0, 0, ((n >> 8) & 255) / 255, 0, 0, 0, 0, (n & 255) / 255, 0, 0, 0, 1, 0];
    desenho.filters = pixel ? [achatar] : [achatar, desfoque];
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
    pintarCor(s.cor, pixel); camada.sprite.alpha = s.alfa;

    // Objetos de piso, fora de cômodos, com a mesma textura que o objeto já tem.
    const vivos = new Set<string>();
    for (const o of Object.values(m.props)) {
      const projetada = ehSombraProjetada(o);
      if ((!o.castsShadow && !projetada) || o.elevation !== 'floor' || o.roomId !== null) continue;
      const e = entradas.get(o.id), sp = e?.sprite; if (!e || !sp || sp.destroyed || sp.texture.destroyed) continue;
      vivos.add(o.id);
      let c = sprites.get(o.id), filho = c?.children[0] as Sprite | undefined;
      if (!c || !filho) { c = new Container(); filho = new Sprite(sp.texture); c.addChild(filho); objetos.addChild(c); sprites.set(o.id, c); }
      c.alpha = o.opacity ?? 1;
      filho.texture = sp.texture; filho.position.copyFrom(sp.position); filho.scale.copyFrom(sp.scale);
      if (projetada) { c.position.set(o.position[0], o.position[1]); c.rotation = o.rotation; c.scale.set(o.scale); c.skew.set(0, 0); }
      else c.setFromMatrix(matrizDaSombra(o.position, o.rotation, o.scale, ACERVO.pegadaDaFonte(o.source), ACERVO.alturaDaFonte(o.source), s));
    }
    for (const [id, c] of sprites) if (!vivos.has(id)) { c.destroy({ children: true }); sprites.delete(id); }

    // Escarpas avulsas (sem relevo, que projeta abaixo com comprimento próprio): o corte da crista varrido para o lado baixo.
    const v: Ponto = [0, 0];
    for (const p of Object.values(m.walls)) {
      if (!ehEscarpaAvulsa(p) || (p.source && 'reliefStep' in p.source)) continue;
      const L = p.height * s.porMetro; v[0] = s.dir[0] * L; v[1] = s.dir[1] * L;
      for (let i = 0; i + 1 < p.path.length; i++) {
        const a = p.path[i]!, b = p.path[i + 1]!, n = ladoBaixo(a, b, p.drop ?? 'b');
        if (n[0] * s.dir[0] + n[1] * s.dir[1] < 0.05) continue;
        figuras.poly([a[0], a[1], b[0], b[1], b[0] + v[0], b[1] + v[1], a[0] + v[0], a[1] + v[1]]).fill({ color: 0xffffff });
      }
    }

    // Relevo em patamares: cada borda projeta sombra na direção oposta ao sol (até 15 m) e uma faixa de base independente do sol, apenas sobre o lado baixo.
    const alcancaBaixo = (p: Ponto, n: Ponto, L: number, limiar: number, dir: Ponto = s.dir): number => {
      const passo = Math.max(0.25, L / 12);
      let valido = 0;
      for (let d = passo; d <= L + 1e-4; d += passo) {
        const dist = Math.min(d, L);
        const h = alturaEm(m, [p[0] + n[0] * 0.05 + dir[0] * dist, p[1] + n[1] * 0.05 + dir[1] * dist]);
        if (h >= limiar) break;
        valido = dist;
      }
      return valido;
    };
    for (const borda of bordasDoRelevo(m)) {
      if (borda.desnivel < DEGRAU_TRANSPONIVEL) continue;
      const L = Math.min(borda.desnivel * 0.85, 15), base = Math.min(2.4, 0.45 + 0.2 * borda.desnivel);
      for (let idx = 0; idx < borda.caminhos.length; idx++) {
        const caminho = borda.caminhos[idx]!, drop = borda.drops[idx] ?? 'b';
        for (let i = 0; i + 1 < caminho.length; i++) {
          const a = caminho[i]!, b = caminho[i + 1]!, n = ladoBaixo(a, b, drop);
          // Oclusão de base: faixa colada ao pé, na normal baixa, qualquer que seja o lado do sol.
          if (borda.desnivel >= 1.5) {
            const ba = alcancaBaixo(a, n, base, borda.limiar, n), bb = alcancaBaixo(b, n, base, borda.limiar, n);
            if (ba > 0 || bb > 0) figuras.poly([a[0], a[1], b[0], b[1], b[0] + n[0] * bb, b[1] + n[1] * bb, a[0] + n[0] * ba, a[1] + n[1] * ba]).fill({ color: 0xffffff });
          }
          if (n[0] * s.dir[0] + n[1] * s.dir[1] < 0.05) continue;
          const la = alcancaBaixo(a, n, L, borda.limiar);
          const lb = alcancaBaixo(b, n, L, borda.limiar);
          if (la <= 0 && lb <= 0) continue;
          figuras.poly([
            a[0], a[1], b[0], b[1],
            b[0] + s.dir[0] * lb, b[1] + s.dir[1] * lb,
            a[0] + s.dir[0] * la, a[1] + s.dir[1] * la,
          ]).fill({ color: 0xffffff });
        }
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
    if (ligado) camada.renderizar(desenho, m.bounds.width, m.bounds.height, pixel ? m.style.pixel.pixelsPerCell / m.grid.size : RES_DA_SOMBRA, { pixel });
  }

  return {
    raiz, atualizar,
    /** O editor liga e desliga a atmosfera; sem ela, sem sombras. */
    definirLigado(l: boolean) { ligado = l; if (!l) raiz.visible = false; },
    /** Quantas sombras de objeto existem agora (testes). */
    contagem: () => sprites.size,
    destruir() { achatar.destroy(); desfoque.destroy(); camada.destruir(); desenho.destroy({ children: true }); },      // a árvore da cena destrói `raiz`
  };
}
