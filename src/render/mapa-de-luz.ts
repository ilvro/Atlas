import { BlurFilter, Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import { luzesDerivadas } from '../domain/clima.ts';
import type { Luz, MapaAtlas } from '../domain/mapa.ts';
import { IndiceDeSegmentos, oclusores, poligonoIluminado } from '../domain/visibilidade.ts';
import { valueNoise2D } from '../procedural/ruido.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { texturaDeBrilho } from './luzes.ts';

/** Pixels por metro do mapa de luz: baixo de propósito (a luz é suave e o desfoque esconde a resolução). */
export const RES_LUZ = 8;
const TEXTURA_MAX = 4096;

export interface MapaDeLuz {
  /** A luz já composta, para multiplicar sobre a cena (em metros). */
  readonly sprite: Sprite;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Tremulação das luzes; `agora` em milissegundos. */
  quadro(agora: number): void;
  definirLigado(ligado: boolean): void;
  destruir(): void;
}

interface LuzNaGPU { c: Container; s: Sprite; m: Graphics; luz: Luz; chaveGeo: string; versaoGeo: number; semente: number; alfa: number }

const rgb01 = (hex: string): [number, number, number] => { const n = hexParaNumero(hex); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

/**
 * Cada luz é um brilho redondo recortado pelo polígono que ela enxerga (as paredes fazem sombra), somado numa textura "bruta";
 * esta, desfocada, vai sobre a cor do ambiente numa textura final que multiplica a cena. Os polígonos só são refeitos quando a
 * luz ou as paredes mudam; a tremulação só mexe na opacidade.
 */
export function criarMapaDeLuz(renderer: Renderer): MapaDeLuz {
  const raiz = new Container(), composicao = new Container(), brutaS = new Sprite(), sprite = new Sprite();
  const blur = new BlurFilter({ strength: 2, quality: 3 }); blur.blendMode = 'add';
  brutaS.blendMode = 'add'; composicao.addChild(brutaS); composicao.filters = [blur];
  sprite.blendMode = 'multiply';
  const luzes = new Map<string, LuzNaGPU>(), ruido = valueNoise2D(7);
  let brutaRT: RenderTexture | null = null, finalRT: RenderTexture | null = null, largura = 0, altura = 0;
  let indice: IndiceDeSegmentos | null = null, versaoGeo = 0, derivadas: Luz[] = [], ambiente: [number, number, number] = [1, 1, 1];
  let sujo = true, ligado = true, destruido = false, contador = 0;

  function dimensionar(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height;
    if (brutaRT && w === largura && h === altura) return;
    largura = w; altura = h;
    const res = Math.min(RES_LUZ, TEXTURA_MAX / Math.max(w, h)), pw = Math.max(1, Math.round(w * res)), ph = Math.max(1, Math.round(h * res));
    const antigas = [brutaRT, finalRT];
    brutaRT = RenderTexture.create({ width: pw, height: ph }); finalRT = RenderTexture.create({ width: pw, height: ph });
    brutaS.texture = brutaRT; sprite.texture = finalRT; sprite.scale.set(w / pw, h / ph); raiz.scale.set(pw / w, ph / h);
    for (const t of antigas) t?.destroy(true);
    sujo = true;
  }

  function criar(l: Luz): LuzNaGPU {
    const c = new Container(), s = new Sprite(texturaDeBrilho()), m = new Graphics();
    s.anchor.set(0.5); s.blendMode = 'add'; s.mask = m; c.addChild(s, m); raiz.addChild(c);
    return { c, s, m, luz: l, chaveGeo: '', versaoGeo: -1, semente: ++contador * 13.7, alfa: -1 };
  }

  function atualizar(g: LuzNaGPU, l: Luz): void {
    g.luz = l;
    const geo = JSON.stringify([l.position, l.radius, l.cone]);
    if (geo !== g.chaveGeo || g.versaoGeo !== versaoGeo) {
      g.chaveGeo = geo; g.versaoGeo = versaoGeo;
      const pts = poligonoIluminado(l.position, indice!.perto(l.position, l.radius), l.radius, l.cone);
      g.m.clear(); if (pts.length >= 6) g.m.poly(pts).fill(0xffffff);
      g.s.position.set(l.position[0], l.position[1]); g.s.width = g.s.height = l.radius * 2;
    }
    g.s.tint = hexParaNumero(l.color); g.alfa = -1;     // a opacidade é recalculada no próximo quadro
  }

  function renderizar(): void {
    if (!brutaRT || !finalRT) return;
    renderer.render({ container: raiz, target: brutaRT, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: composicao, target: finalRT, clear: true, clearColor: [...ambiente, 1] });
    sujo = false;
  }

  return {
    sprite,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      if (campo('bounds')) dimensionar(m);
      if (!brutaRT) dimensionar(m);
      const geoMudou = col('walls') || col('openings') || col('rooms') || campo('grid') || !indice;
      if (geoMudou) { indice = new IndiceDeSegmentos(oclusores(m, 'luz')); versaoGeo++; }
      if (geoMudou || campo('climate')) derivadas = luzesDerivadas(m);
      if (campo('climate')) { const a = m.climate.ambient, [r, g, b] = rgb01(a.color); ambiente = [Math.min(1, r * a.intensity), Math.min(1, g * a.intensity), Math.min(1, b * a.intensity)]; }
      const vivos = new Set<string>();
      for (const l of [...Object.values(m.lights), ...derivadas]) { vivos.add(l.id); let g = luzes.get(l.id); if (!g) { g = criar(l); luzes.set(l.id, g); } atualizar(g, l); }
      for (const [id, g] of luzes) if (!vivos.has(id)) { g.c.destroy({ children: true }); luzes.delete(id); }
      sujo = true;
    },
    quadro(agora) {
      if (!ligado || destruido) return;
      const t = agora / 1000;
      for (const g of luzes.values()) {
        const l = g.luz, base = l.on ? Math.min(1, l.intensity) : 0;
        const k = base > 0 && l.flicker > 0 ? base * (1 - l.flicker * 0.7 * ((ruido(t * 9 + g.semente, g.semente) + 0.5 * ruido(t * 23, g.semente + 9)) / 1.5)) : base;
        if (Math.abs(k - g.alfa) > 1e-3) { g.alfa = k; g.s.alpha = k; g.c.visible = k > 0.01; sujo = true; }
      }
      if (sujo) renderizar();
    },
    definirLigado(v) { ligado = v; sprite.visible = v; if (v) sujo = true; },
    destruir() {
      destruido = true; for (const g of luzes.values()) g.c.destroy({ children: true }); luzes.clear();
      brutaRT?.destroy(true); finalRT?.destroy(true); sprite.destroy(); composicao.destroy({ children: false }); raiz.destroy({ children: true });
    },
  };
}
