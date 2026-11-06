import { BlurFilter, Container, Graphics, RenderTexture, Sprite, type Renderer } from 'pixi.js';
import { DURACAO_DA_QUEDA, DURACAO_DA_VOLTA, curvaDoClarao, ehNoite, intervaloDoRelampago, luzesDerivadas, nivelDaLuz, piscarDaQueda, piscarDaVolta } from '../domain/clima.ts';
import type { Luz, MapaAtlas, Ponto } from '../domain/mapa.ts';
import { IndiceDeSegmentos, oclusores, poligonoIluminado } from '../domain/visibilidade.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { somPreferido, trovao } from '../fx/som.ts';
import { valueNoise2D } from '../procedural/ruido.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { criarFiltroDeFaixas } from './faixas.ts';
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
  /** Dispara um relâmpago agora (e o trovão, se o som estiver ligado). */
  relampagoAgora(): void;
  /** Eventos de cena: multiplicam a intensidade de todas as luzes (piscar) e a do ambiente (escurecer). 1 = sem efeito. */
  definirEfeitos(luzes: number, ambiente: number): void;
  /** Intensidade atual da luz (inclui flicker, queda de rede, relâmpago, etc.). */
  intensidade(id: string): number;
  /** Polígono de visão iluminado recortado pelas paredes (para a máscara de raios). */
  poligono(id: string): readonly number[] | null;
  /** Todas as luzes ativas (do mapa e derivadas). */
  todasAsLuzes(): readonly Luz[];
  destruir(): void;
}

interface LuzNaGPU { c: Container; s: Sprite; m: Graphics; luz: Luz; raio: number; chaveGeo: string; versaoGeo: number; semente: number; alfa: number; clarao: number; poligono: number[] }

const somarCor = (cor: number, v: number): number => { const c = (n: number) => Math.min(255, Math.round(n * 255 + v * 255)); return (c(((cor >> 16) & 255) / 255) << 16) | (c(((cor >> 8) & 255) / 255) << 8) | c((cor & 255) / 255); };
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
  // No Pixel a luz final passa por um filtro de faixas (degraus de borda dura) antes de multiplicar a cena.
  const passadaFaixas = new Container(), faixasS = new Sprite(); passadaFaixas.addChild(faixasS); passadaFaixas.filters = [criarFiltroDeFaixas()];
  const luzes = new Map<string, LuzNaGPU>(), ruido = valueNoise2D(7);
  let brutaRT: RenderTexture | null = null, finalRT: RenderTexture | null = null, faixasRT: RenderTexture | null = null, largura = 0, altura = 0, resAtual = 0, pixel = false, pxPorMetro = 0;
  let indice: IndiceDeSegmentos | null = null, versaoGeo = 0, derivadas: Luz[] = [], ambiente: [number, number, number] = [1, 1, 1];
  let sujo = true, ligado = true, destruido = false, contador = 0;
  // O estado do momento (clima): o mapa atual, se é noite, a queda de energia, o relâmpago e os trovões a caminho.
  let mapa: MapaAtlas | null = null, noite = false, redeAnterior: boolean | null = null, queda = 0, volta = 0;
  let efLuzes = 1, efAmbiente = 1, flash = 0, forcaDoRaio = 0, proximoRaio = Infinity, ultimoQuadro = -1, claraoAtual = 0;
  const trovoes: number[] = [];

  let todasLuzes: Luz[] = [];

  function dimensionar(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height, ehPixel = m.style.renderer === 'pixel', r0 = ehPixel ? m.style.pixel.pixelsPerCell / m.grid.size : RES_LUZ;
    if (brutaRT && w === largura && h === altura && r0 === resAtual) return;
    largura = w; altura = h; resAtual = r0; pixel = ehPixel;
    const res = Math.min(r0, TEXTURA_MAX / Math.max(w, h)), pw = Math.max(1, Math.round(w * res)), ph = Math.max(1, Math.round(h * res)); pxPorMetro = res;
    const antigas = [brutaRT, finalRT, faixasRT], modo = pixel ? 'nearest' : 'linear';
    brutaRT = RenderTexture.create({ width: pw, height: ph, scaleMode: modo }); finalRT = RenderTexture.create({ width: pw, height: ph, scaleMode: modo });
    faixasRT = pixel ? RenderTexture.create({ width: pw, height: ph, scaleMode: 'nearest' }) : null;
    // Pixel: sem desfoque, em resolução do Pixel, e as faixas depois da composição. Ilustrado: a luz suave de sempre.
    composicao.filters = pixel ? [] : [blur]; faixasS.texture = finalRT;
    brutaS.texture = brutaRT; sprite.texture = pixel ? faixasRT! : finalRT; sprite.scale.set(w / pw, h / ph); raiz.scale.set(pw / w, ph / h);
    for (const t of antigas) t?.destroy(true);
    sujo = true;
  }

  function criar(l: Luz): LuzNaGPU {
    const c = new Container(), s = new Sprite(texturaDeBrilho()), m = new Graphics();
    s.anchor.set(0.5); s.blendMode = 'add'; s.mask = m; c.addChild(s, m); raiz.addChild(c);
    return { c, s, m, luz: l, raio: l.radius, chaveGeo: '', versaoGeo: -1, semente: ++contador * 13.7, alfa: -1, clarao: -1, poligono: [] };
  }

  function atualizar(g: LuzNaGPU, l: Luz): void {
    g.luz = l;
    const geo = JSON.stringify([l.position, l.radius, l.cone]);
    if (geo !== g.chaveGeo || g.versaoGeo !== versaoGeo) {
      g.chaveGeo = geo; g.versaoGeo = versaoGeo;
      const pts = poligonoIluminado(l.position, indice!.perto(l.position, l.radius), l.radius, l.cone);
      g.poligono = pts;
      g.m.clear(); if (pts.length >= 6) g.m.poly(pts).fill(0xffffff);
      g.s.position.set(l.position[0], l.position[1]); g.s.width = g.s.height = l.radius * 2; g.raio = l.radius;
    }
    g.s.tint = hexParaNumero(l.color);
    if (g.alfa < 0 && mapa) {
      const daRede = l.power === 'grid';
      const nivel = nivelDaLuz(l, mapa, queda > 0 ? { redeLigada: true, noite } : { noite });
      const piscar = !daRede ? 1 : queda > 0 ? piscarDaQueda(queda) : volta > 0 ? piscarDaVolta(volta) : 1;
      g.alfa = nivel * piscar * efLuzes * Math.min(1, l.intensity);
    }
  }

  /** Um relâmpago: o clarão entra pelas janelas e, um instante depois, o trovão (se o som estiver ligado). */
  function disparar(): void {
    if (!ligado) return;
    flash = 1; if (somPreferido()) trovoes.push(0.4 + Math.random() * 1.2);
  }

  function renderizar(): void {
    if (!brutaRT || !finalRT) return;
    renderer.render({ container: raiz, target: brutaRT, clear: true, clearColor: [0, 0, 0, 0] });
    const brilho = claraoAtual * 0.35, amb: [number, number, number, number] = [Math.min(1, ambiente[0] * efAmbiente + brilho), Math.min(1, ambiente[1] * efAmbiente + brilho), Math.min(1, ambiente[2] * efAmbiente + brilho), 1];
    renderer.render({ container: composicao, target: finalRT, clear: true, clearColor: amb });
    if (pixel && faixasRT) renderer.render({ container: passadaFaixas, target: faixasRT, clear: true, clearColor: [0, 0, 0, 1] });
    sujo = false;
  }

  return {
    sprite,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      if (campo('climate')) {
        noite = ehNoite(m);
        // A queda de energia pisca antes de apagar, e a volta pisca de leve; abrir ou importar um mapa não anima.
        const rede = m.climate.gridPower;
        if (redeAnterior !== null && rede !== redeAnterior && !tudo && !movimentoReduzido()) { queda = rede ? 0 : DURACAO_DA_QUEDA; volta = rede ? DURACAO_DA_VOLTA : 0; }
        redeAnterior = rede;
        const forca = m.climate.weather.lightning;
        if (forca !== forcaDoRaio) { forcaDoRaio = forca; proximoRaio = intervaloDoRelampago(forca, Math.random()); }
      }
      if (campo('bounds', 'style', 'grid')) dimensionar(m);
      if (!brutaRT) dimensionar(m);
      const geoMudou = col('walls') || col('openings') || col('rooms') || campo('grid') || !indice;
      if (geoMudou) { indice = new IndiceDeSegmentos(oclusores(m, 'luz')); versaoGeo++; }
      if (geoMudou || col('lights') || campo('climate')) derivadas = luzesDerivadas(m);
      if (campo('climate')) { const a = m.climate.ambient, [r, g, b] = rgb01(a.color); ambiente = [Math.min(1, r * a.intensity), Math.min(1, g * a.intensity), Math.min(1, b * a.intensity)]; }
      todasLuzes = [...Object.values(m.lights), ...derivadas];
      const vivos = new Set<string>();
      for (const l of todasLuzes) { vivos.add(l.id); let g = luzes.get(l.id); if (!g) { g = criar(l); luzes.set(l.id, g); } atualizar(g, l); }
      for (const [id, g] of luzes) if (!vivos.has(id)) { g.c.destroy({ children: true }); luzes.delete(id); }
      sujo = true;
    },
    quadro(agora) {
      if (destruido) return;
      const dt = ultimoQuadro < 0 ? 0 : Math.min(0.1, (agora - ultimoQuadro) / 1000); ultimoQuadro = agora;
      if (!ligado || !mapa) return;
      const t = agora / 1000, reduzido = movimentoReduzido();
      if (queda > 0) { queda = Math.max(0, queda - dt); sujo = true; }
      if (volta > 0) { volta = Math.max(0, volta - dt); sujo = true; }
      if (forcaDoRaio > 0 && (proximoRaio -= dt) <= 0) { disparar(); proximoRaio = intervaloDoRelampago(forcaDoRaio, Math.random()); }
      for (let i = trovoes.length - 1; i >= 0; i--) if ((trovoes[i]! -= dt) <= 0) { trovoes.splice(i, 1); trovao(); }
      const f = flash; flash = Math.max(0, flash - dt * 2.2);
      const clarao = curvaDoClarao(f, reduzido);
      if (clarao !== claraoAtual) { claraoAtual = clarao; sujo = true; }
      for (const g of luzes.values()) {
        const l = g.luz, daRede = l.power === 'grid';
        // Durante o piscar da queda a rede ainda "existe": a luz tremula e só depois apaga (quando o documento já diz que a rede caiu).
        const nivel = nivelDaLuz(l, mapa, queda > 0 ? { redeLigada: true, noite } : { noite });
        const piscar = !daRede ? 1 : queda > 0 ? piscarDaQueda(queda) : volta > 0 ? piscarDaVolta(volta) : 1;
        const janela = l.id.startsWith('janela:');          // só a luz do céu pelas janelas leva o clarão
        let k = nivel * piscar * efLuzes * Math.min(1, l.intensity);
        if (k > 0 && l.flicker > 0) {
          const f = (ruido(t * 9 + g.semente, g.semente) + 0.5 * ruido(t * 23, g.semente + 9)) / 1.5;
          if (!pixel) k *= 1 - l.flicker * 0.7 * f;
          else {
            // No Pixel a chama treme no raio, em passos de 1 pixel (a intensidade contínua faria as faixas cintilarem).
            const raio = Math.round(l.radius * (1 - l.flicker * 0.3 * f) * pxPorMetro) / pxPorMetro;
            if (raio !== g.raio) { g.raio = raio; g.s.width = g.s.height = raio * 2; sujo = true; }
          }
        } else if (pixel && g.raio !== l.radius) { g.raio = l.radius; g.s.width = g.s.height = l.radius * 2; sujo = true; }
        if (janela) k = Math.min(1, k + clarao * 1.2);
        if (Math.abs(k - g.alfa) > 1e-3) { g.alfa = k; g.s.alpha = k; g.c.visible = k > 0.01; sujo = true; }
        if (janela && clarao !== g.clarao) { g.clarao = clarao; g.s.tint = clarao > 0 ? somarCor(hexParaNumero(l.color), clarao * 0.6) : hexParaNumero(l.color); }
      }
      if (sujo) renderizar();
    },
    relampagoAgora: disparar,
    definirEfeitos(luzes, ambiente) { if (luzes === efLuzes && ambiente === efAmbiente) return; efLuzes = luzes; efAmbiente = ambiente; sujo = true; },
    definirLigado(v) { ligado = v; sprite.visible = v; if (v) sujo = true; },
    intensidade: (id: string) => { const g = luzes.get(id); return g ? Math.max(0, g.alfa) : 0; },
    poligono: (id: string) => { const g = luzes.get(id); return g?.poligono && g.poligono.length >= 6 ? g.poligono : null; },
    todasAsLuzes: () => todasLuzes,
    destruir() {
      destruido = true; for (const g of luzes.values()) g.c.destroy({ children: true }); luzes.clear();
      brutaRT?.destroy(true); finalRT?.destroy(true); faixasRT?.destroy(true); passadaFaixas.destroy({ children: false }); faixasS.destroy(); sprite.destroy(); composicao.destroy({ children: false }); raiz.destroy({ children: true });
    },
  };
}
