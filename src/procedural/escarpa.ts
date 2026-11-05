import type { Ponto } from '../domain/mapa.ts';
import { contextoDe, criarTela } from './canvas.ts';
import type { Assado } from './assar.ts';
import type { EstiloDeRaster } from './estilos/index.ts';
import { TRACO } from './macico.ts';
import { materialDe } from './materiais.ts';
import { fbm, valueNoise2D } from './ruido.ts';

/**
 * Escarpa avulsa vista de cima: uma faixa de rocha do lado baixo de uma linha (a crista), em 3 patamares de borda quebrada, com
 * estrias perpendiculares ao caminho, aresta clara no topo, traço de nanquim e sombra de contato no pé. Puro (só vetores);
 * `assarEscarpa` só põe o resultado numa tela. O caminho vem relativo ao primeiro ponto: mover a escarpa não refaz o desenho.
 */
export interface EntradaDeEscarpa { path: Ponto[]; drop: 'a' | 'b'; altura: number; material: string; seed: number }

export const LARGURA_MINIMA_DA_FACE = 0.4;
export const FATOR_DA_FACE = 0.35;
export const SOMBRA_DA_ESCARPA = 0.5;
/** A aresta clara do topo, um palmo para o lado alto. */
export const LABIO_DA_ESCARPA = 0.12;
const MARGEM = 0.25;

/** Largura (m) da face vista de cima: 0,35 × altura, no mínimo 0,4 m. */
export const larguraDaFace = (altura: number): number => Math.max(LARGURA_MINIMA_DA_FACE, FATOR_DA_FACE * altura);

/** O lado baixo de um segmento: `a` é o lado da normal esquerda `(-ty, tx)` do sentido do caminho (a mesma de `swing: 'a'` das portas), `b` o oposto. */
export function ladoBaixo(a: Ponto, b: Ponto, drop: 'a' | 'b'): Ponto {
  const dx = b[0] - a[0], dy = b[1] - a[1], c = Math.hypot(dx, dy) || 1, s = drop === 'a' ? 1 : -1;
  return [-dy / c * s, dx / c * s];
}

/** A caixa (m, no espaço do caminho relativo) que cabe a face, o lábio, a sombra e a borda quebrada. */
export function caixaDaEscarpa(e: Pick<EntradaDeEscarpa, 'path' | 'drop' | 'altura'>): { x0: number; y0: number; x1: number; y1: number } {
  const w = larguraDaFace(e.altura) * 1.3 + SOMBRA_DA_ESCARPA + MARGEM, caixa = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (let i = 0; i + 1 < e.path.length; i++) {
    const a = e.path[i]!, b = e.path[i + 1]!, n = ladoBaixo(a, b, e.drop);
    for (const p of [a, b]) for (const k of [w, -(LABIO_DA_ESCARPA + MARGEM)]) {
      const x = p[0] + n[0] * k, y = p[1] + n[1] * k;
      caixa.x0 = Math.min(caixa.x0, x - MARGEM); caixa.y0 = Math.min(caixa.y0, y - MARGEM); caixa.x1 = Math.max(caixa.x1, x + MARGEM); caixa.y1 = Math.max(caixa.y1, y + MARGEM);
    }
  }
  return caixa;
}

export interface SaidaDaEscarpa { largura: number; altura: number; origem: Ponto; rgba: Uint8ClampedArray; sombra: Uint8ClampedArray }
type Cor = [number, number, number];
const rgb = (h: string): Cor => { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const misturar = (a: Cor, b: Cor, t: number): Cor => { const k = t < 0 ? 0 : t > 1 ? 1 : t; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; };
const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const LUZ: Ponto = [-Math.SQRT1_2, -Math.SQRT1_2];      // a luz vem de noroeste, como no maciço

export function sombrearEscarpa(e: EntradaDeEscarpa, res: number, pixel: boolean): SaidaDaEscarpa {
  const cx = caixaDaEscarpa(e), x0 = pixel ? Math.floor(cx.x0 * res) / res : cx.x0, y0 = pixel ? Math.floor(cx.y0 * res) / res : cx.y0;
  const W = Math.max(1, Math.ceil((cx.x1 - x0) * res)), H = Math.max(1, Math.ceil((cx.y1 - y0) * res)), n = W * H;
  const rgba = new Uint8ClampedArray(n * 4), sombra = new Uint8ClampedArray(n * 4);
  const mat = materialDe(e.material), pe = Math.min(1, Math.max(0, mat.pe ?? 1)), pesoSombra = 0.35 + 0.65 * pe;
  const cBase = rgb(mat.base), cEsc = rgb(mat.escuro), cCla = rgb(mat.claro), cTopo = mat.topo ? rgb(mat.topo) : null, tinta = rgb(TRACO), escuridao: Cor = [7, 10, 14], neveSombra: Cor = [184, 200, 220];
  const s = Math.floor(e.seed) || 1, rBorda = valueNoise2D(s * 11 + 1), rPatamar = valueNoise2D(s * 11 + 2), rEstria = valueNoise2D(s * 11 + 3), rNeve = valueNoise2D(s * 11 + 4), rPonta = valueNoise2D(s * 11 + 5), rGrao = valueNoise2D(s * 11 + 6);
  const w = larguraDaFace(e.altura), segs: { a: Ponto; t: Ponto; n: Ponto; c: number; ini: number }[] = [];
  let total = 0;
  for (let i = 0; i + 1 < e.path.length; i++) {
    const a = e.path[i]!, b = e.path[i + 1]!, c = Math.hypot(b[0] - a[0], b[1] - a[1]); if (c < 1e-6) continue;
    segs.push({ a, t: [(b[0] - a[0]) / c, (b[1] - a[1]) / c], n: ladoBaixo(a, b, e.drop), c, ini: total }); total += c;
  }
  const lip = pixel ? 1 / res : LABIO_DA_ESCARPA, dentro = new Uint8Array(pixel ? n : 0);
  const info = (x: number, y: number) => {
    const px = x0 + (x + 0.5) / res, py = y0 + (y + 0.5) / res;
    let melhor = Infinity, seg = segs[0]!, q = 0, v = 0, sobra = 0;
    for (const g of segs) {
      const rx = px - g.a[0], ry = py - g.a[1], proj = rx * g.t[0] + ry * g.t[1], qq = Math.min(g.c, Math.max(0, proj)), dx = rx - qq * g.t[0], dy = ry - qq * g.t[1], d = Math.hypot(dx, dy);
      if (d < melhor) { melhor = d; seg = g; q = qq; v = (dx * g.n[0] + dy * g.n[1] >= 0 ? 1 : -1) * d; sobra = proj - qq; }
    }
    const u = seg.ini + q, borda = w * (1 + (fbm(rBorda, u * 1.1, 0.5, 3) - 0.5) * 0.5), ponta = Math.min(u, total - u) + (fbm(rPonta, u * 2, 3, 2) - 0.5) * 0.3;
    const foraDaPonta = (sobra < -1e-9 && seg === segs[0] && q === 0) || (sobra > 1e-9 && seg === segs[segs.length - 1] && q === seg.c);
    return { seg, u, v, borda, ponta: foraDaPonta ? -1 : ponta, px, py };
  };

  // Passada 1 (Pixel): a máscara binária, para o contorno de 1 px.
  if (pixel) for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const f = info(x, y);
    if (f.v >= -lip && f.v <= f.borda && f.ponta > 0) dentro[i] = 1;
  }

  const alcance = pixel ? (pe < 0.5 ? 1.01 : 2.01) / res : SOMBRA_DA_ESCARPA, sombraPixel = rgb('#0b0e12');
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const f = info(x, y), o = i * 4, t = Math.min(1, Math.max(0, f.v / f.borda));
    const interior = f.v >= -lip && f.v <= f.borda && f.ponta > 0;
    const dBorda = Math.min(f.borda - f.v, f.v + lip, f.ponta);      // distância (m) à borda mais próxima, para a cobertura do Ilustrado
    const lit = f.seg.n[0] * LUZ[0] + f.seg.n[1] * LUZ[1];      // + a face olha para a luz, − olha para longe
    if (interior || (!pixel && dBorda > -1 / res && f.v >= -lip - 1 / res && f.ponta > -1 / res && f.v <= f.borda + 1 / res)) {
      let cor: Cor;
      if (pixel) {
        const viz = (dx: number, dy: number) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < W && yy < H && dentro[yy * W + xx]! > 0; };
        const contorno = !(viz(-1, 0) && viz(1, 0) && viz(0, -1) && viz(0, 1));
        const ft = t + (fbm(rPatamar, f.u * 1.7, t * 2.5, 2) - 0.5) * 0.3, alto = ft < 0.5, claro = lit >= 0;
        cor = alto ? (claro ? cBase : misturar(cBase, cEsc, 0.35)) : (claro ? misturar(cBase, cEsc, 0.5) : cEsc);
        if (f.v < 1.5 / res) cor = cCla;
        if (cTopo && (f.v < 0 || t + (fbm(rNeve, f.u * 1.6, 2, 2) - 0.5) * 0.3 < 0.22)) cor = lit >= -0.2 ? cTopo : misturar(cTopo, neveSombra, 1);
        if (contorno) cor = tinta;
      } else {
        const ft = t + (fbm(rPatamar, f.u * 1.7, t * 2.5, 3) - 0.5) * 0.3, banda = Math.floor(Math.min(0.999, Math.max(0, ft)) * 3), fr = Math.min(1, Math.max(0, ft)) * 3 - banda;
        const tom = banda === 0 ? misturar(cBase, cCla, 0.3) : banda === 1 ? cBase : misturar(cBase, cEsc, 0.55);
        const estria = fbm(rEstria, f.u * 13, t * 1.1, 2) - 0.5, grao = (fbm(rGrao, f.px * 6, f.py * 6, 3) - 0.5) * 0.35;
        const luz = lit * 0.35 + estria * 0.9 + grao + (fr > 0.8 ? -0.25 : fr < 0.12 ? 0.25 : 0);      // o degrau pega luz na quebra e sombra logo abaixo
        cor = luz >= 0 ? misturar(tom, cCla, luz * 0.8) : misturar(tom, cEsc, -luz * 1.1);
        let tinto = 0;
        if (banda > 0 && fr < 0.07) tinto = 0.75;
        if (f.v < 0) cor = misturar(cor, cCla, 0.75);      // a aresta clara do topo
        if (f.v >= 0 && f.v < 0.05) tinto = Math.max(tinto, 0.7);
        if (cTopo) {
          const m = f.v < 0 ? 1 : 1 - suave(0.1, 0.3, t + (fbm(rNeve, f.u * 1.6, 2, 3) - 0.5) * 0.35);
          if (m > 0) { cor = misturar(cor, lit >= -0.2 ? cTopo : misturar(cTopo, neveSombra, 0.9), m); tinto *= 1 - m * 0.6; }
        }
        cor = misturar(cor, escuridao, suave(0.55, 1, t) * 0.7 * pe);      // pé da parede
        tinto = Math.max(tinto, 0.85 * (1 - suave(0, 1.6 / res, Math.min(f.borda - f.v, f.v + lip))));
        if (tinto > 0) cor = misturar(cor, tinta, tinto);
      }
      rgba[o] = cor[0]; rgba[o + 1] = cor[1]; rgba[o + 2] = cor[2];
      rgba[o + 3] = pixel ? 255 : Math.min(1, Math.max(0, dBorda * res + 0.5)) * 255;
    }
    // Sombra de contato no pé da face (só do lado baixo, sem passar das pontas).
    if (!interior && f.v > f.borda && f.ponta > 0) {
      const d = f.v - f.borda; if (d >= alcance) continue;
      if (pixel) { sombra[o] = sombraPixel[0]; sombra[o + 1] = sombraPixel[1]; sombra[o + 2] = sombraPixel[2]; sombra[o + 3] = 255; }
      else { sombra[o] = 4; sombra[o + 1] = 6; sombra[o + 2] = 10; sombra[o + 3] = Math.pow(1 - d / alcance, 1.8) * 0.6 * pesoSombra * 255; }
    }
  }
  return { largura: W, altura: H, origem: [x0, y0], rgba, sombra };
}

/** A escarpa numa tela, com a origem no espaço do caminho relativo. */
export function assarEscarpa(e: EntradaDeEscarpa, res: number, estilo: EstiloDeRaster): Assado {
  const r = sombrearEscarpa(e, res, estilo.id === 'pixel'), tela = criarTela(r.largura, r.altura), ctx = contextoDe(tela);
  const poe = (dados: Uint8ClampedArray) => { const t = criarTela(r.largura, r.altura), c = contextoDe(t); c.putImageData(new ImageData(dados as Uint8ClampedArray<ArrayBuffer>, r.largura, r.altura), 0, 0); ctx.drawImage(t as CanvasImageSource, 0, 0); };
  poe(r.sombra); poe(r.rgba);
  return { tela, origem: r.origem, res };
}
