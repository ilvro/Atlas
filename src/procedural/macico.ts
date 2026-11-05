import { distanciaAMargem } from './profundidade.ts';
import { fbm, hash2D, valueNoise2D } from './ruido.ts';
import { celulasDeVoronoi } from './voronoi.ts';

/**
 * Maciço de rocha visto de cima: a máscara de uma camada de terreno de uso `macico` vira uma massa com volume. A altura é a distância
 * à borda (saturada) mais bossas largas por ruído, em patamares de borda quebrada; cada quebra de patamar pega luz de noroeste
 * (aresta clara de um lado, sombra e traço de nanquim do outro), as faces são facetadas (Voronoi) e estriadas na direção da encosta.
 * Puro (só vetores): o `assarTerreno` põe o resultado na tela.
 */
export const ALTURA_DO_MACICO = 1.5;
export const SOMBRA_DE_CONTATO = 0.6;
export const PATAMARES_ILUSTRADO = 5;
export const PATAMARES_PIXEL = 3;
export const TRACO = '#070a0e';

export interface CoresDoMacico { base: string; escuro: string; claro: string; topo?: string }
export interface EntradaDoMacico {
  /** Máscara binária (1 = rocha), `largura × altura`. */
  dentro: Uint8Array;
  /** Cobertura suave da borda (0–255) no Ilustrado; `null` no Pixel (tudo ou nada). */
  alfa: Uint8Array | null;
  largura: number; altura: number; res: number; seed: number; cores: CoresDoMacico; pixel: boolean;
}
/** `rgba`: a rocha; `sombra`: a sombra de contato sobre o que está embaixo (para desenhar antes da rocha). */
export interface SaidaDoMacico { rgba: Uint8ClampedArray; sombra: Uint8ClampedArray }

type Cor = [number, number, number];
const rgb = (h: string): Cor => { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const misturar = (a: Cor, b: Cor, t: number, o: Cor): void => { const k = Math.min(1, Math.max(0, t)); o[0] = a[0] + (b[0] - a[0]) * k; o[1] = a[1] + (b[1] - a[1]) * k; o[2] = a[2] + (b[2] - a[2]) * k; };
const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const limitar = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** Desfoque de caixa separável com bordas repetidas. */
function desfocar(a: Float32Array, W: number, H: number, r: number): Float32Array {
  const tmp = new Float32Array(a.length), out = new Float32Array(a.length), n = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    let s = 0; const o = y * W;
    for (let i = -r; i <= r; i++) s += a[o + limitar(i, 0, W - 1)]!;
    for (let x = 0; x < W; x++) { tmp[o + x] = s / n; s += a[o + Math.min(W - 1, x + r + 1)]! - a[o + Math.max(0, x - r)]!; }
  }
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += tmp[limitar(i, 0, H - 1) * W + x]!;
    for (let y = 0; y < H; y++) { out[y * W + x] = s / n; s += tmp[Math.min(H - 1, y + r + 1) * W + x]! - tmp[Math.max(0, y - r) * W + x]!; }
  }
  return out;
}

export function sombrearMacico(e: EntradaDoMacico): SaidaDoMacico {
  const { dentro, alfa, largura: W, altura: H, res, pixel } = e, n = W * H, N = pixel ? PATAMARES_PIXEL : PATAMARES_ILUSTRADO;
  const rgba = new Uint8ClampedArray(n * 4), sombra = new Uint8ClampedArray(n * 4);
  const cBase = rgb(e.cores.base), cEsc = rgb(e.cores.escuro), cCla = rgb(e.cores.claro), cTopo = e.cores.topo ? rgb(e.cores.topo) : null, tinta = rgb(TRACO);
  const cNeveSombra: Cor = [184, 200, 220], cNeveSombraPixel: Cor = [150, 168, 196], escuridao: Cor = [7, 10, 14];
  const s = Math.floor(e.seed) || 1, rGrande = valueNoise2D(s * 13 + 1), rCorte = valueNoise2D(s * 13 + 2), rGrao = valueNoise2D(s * 13 + 3), rEstria = valueNoise2D(s * 13 + 4), rRevela = valueNoise2D(s * 13 + 9), rNeve = valueNoise2D(s * 13 + 5);
  const vor = celulasDeVoronoi({ x: 0, y: 0, w: W / res, h: H / res }, 1.6, s * 7 + 3), rTorce = valueNoise2D(s * 13 + 6), rFalha = valueNoise2D(s * 13 + 7);

  const dist = distanciaAMargem(dentro, W, H, res, ALTURA_DO_MACICO + 0.5);
  const suavizada = desfocar(dist, W, H, Math.max(2, Math.round(0.28 * res)));      // direção da encosta estável: sem raios onde o gradiente gira
  const ativo = (i: number) => dentro[i]! > 0 || (alfa !== null && alfa[i]! > 0);

  // 1. Altura bruta (0 a 1) e a mesma em patamares (`z`: patamar + um declive leve na face).
  const bruta = new Float32Array(n), z = new Float32Array(n);
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    if (!ativo(i)) continue;
    const mx = x / res, my = y / res, d = dist[i]!;
    const interior = suave(0.2, 1.2, d);
    const b = 0.1 + Math.min(d, ALTURA_DO_MACICO) / ALTURA_DO_MACICO * 0.55 + (fbm(rGrande, mx * 0.34, my * 0.34, 3) - 0.5) * 1.15 * interior + (fbm(rCorte, mx * 1.25, my * 1.25, 2) - 0.5) * 0.3 + (fbm(rCorte, mx * 5, my * 5, 1) - 0.5) * 0.04;      // lóbulos grandes, não serrilhado
    const bb = limitar(b, 0, 0.999); bruta[i] = bb;
    const f = bb * N, nivel = Math.floor(f);
    z[i] = nivel + (pixel ? 0 : (f - nivel) * 0.3) + 1;                 // fora da rocha z = 0: a borda externa também pega luz e sombra
  }

  const zb = pixel ? z : desfocar(z, W, H, Math.max(1, Math.round(0.06 * res))), zf = pixel ? z : desfocar(z, W, H, Math.max(1, Math.round(0.018 * res)));
  const k = pixel ? 1 : Math.max(1, Math.round(0.026 * res)), ks = Math.max(2, Math.round(0.07 * res)), kg = Math.max(2, Math.round(0.25 * res));
  const cor: Cor = [0, 0, 0], neve: Cor = [0, 0, 0], tmp: Cor = [0, 0, 0], tom: Cor = [0, 0, 0];
  const px = (xx: number) => limitar(xx, 0, W - 1), py = (yy: number) => limitar(yy, 0, H - 1);
  const tons: Cor[] = []; for (let l = 0; l < N; l++) { const t = l / (N - 1), c: Cor = [0, 0, 0]; if (t < 0.5) misturar(cEsc, cBase, 0.2 + t * 2 * 0.7, c); else misturar(cBase, cCla, (t - 0.5) * 2 * 0.22, c); tons.push(c); }

  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    if (!ativo(i)) continue;
    const mx = x / res, my = y / res, nivel = Math.floor(z[i]!) - 1, d = dist[i]!;
    let sombraLuz: number, sMacia = 0, sLit = 0, revela = 0;                                         // > 0 claro, < 0 escuro
    let tinto = 0;                                                 // quanto vai para o nanquim (0 a 1)
    const alto = tons[limitar(nivel, 0, N - 1)]!;
    if (pixel) {
      const adiante = (z[y * W + px(x + 1)]! - z[i]!) + (z[py(y + 1) * W + x]! - z[i]!), atras = (z[y * W + px(x - 1)]! - z[i]!) + (z[py(y - 1) * W + x]! - z[i]!);
      sombraLuz = adiante > 0.5 ? 0.9 : atras > 0.5 ? -0.9 : 0;
      if (d <= 1.01 / res * 1) tinto = 1;
      tom[0] = alto[0]; tom[1] = alto[1]; tom[2] = alto[2];
      if (sombraLuz > 0) { tom[0] = cCla[0]; tom[1] = cCla[1]; tom[2] = cCla[2]; } else if (sombraLuz < 0) { tom[0] = cEsc[0]; tom[1] = cEsc[1]; tom[2] = cEsc[2]; }      // poucas cores: a luz e a sombra são fixas
    } else {
      const zx = zf[y * W + px(x + k)]! - zf[y * W + px(x - k)]!, zy = zf[py(y + k) * W + x]! - zf[py(y - k) * W + x]!;
      const lit = limitar((zx + zy) * 1.1, -1, 1);
      const macia = limitar(((zb[y * W + px(x + ks)]! - zb[y * W + px(x - ks)]!) + (zb[py(y + ks) * W + x]! - zb[py(y - ks) * W + x]!)) * 0.9, -1, 1);
      const rx = bruta[y * W + px(x + ks * 2)]! - bruta[y * W + px(x - ks * 2)]!, ry = bruta[py(y + ks * 2) * W + x]! - bruta[py(y - ks * 2) * W + x]!;
      const larga = limitar((rx + ry) * 3, -1, 1);
      // Facetas: Voronoi com o domínio torcido (fendas tortas, só em parte do caminho) e cada faceta inclinada para um lado.
      const wx = mx + (fbm(rTorce, mx * 1.6, my * 1.6, 2) - 0.5) * 0.5, wy = my + (fbm(rTorce, mx * 1.6 + 40, my * 1.6 + 40, 2) - 0.5) * 0.5;
      const v = vor.consultar(wx, wy), aberta = fbm(rFalha, mx * 1.1, my * 1.1, 2) > 0.6, fenda = aberta && v.borda < 0.045 ? 1 - v.borda / 0.045 : 0;      // poucas fendas, só em parte do caminho
      const ang = v.sitio.azar * 6.2832, faceta = (Math.cos(ang) + Math.sin(ang)) * 0.35 * (0.4 + 0.6 * suave(0, 0.5, v.borda));
      // Estrias: ruído esticado ao longo da encosta (perpendicular à borda), só nas faces.
      const gx = suavizada[y * W + px(x + kg)]! - suavizada[y * W + px(x - kg)]!, gy = suavizada[py(y + kg) * W + x]! - suavizada[py(y - kg) * W + x]!, gl = Math.hypot(gx, gy) * res / (2 * kg);
      let estria = 0;
      revela = 0;
      if (gl > 0.4 && d < ALTURA_DO_MACICO + 0.2) {
        // Estrias: ruído de alta frequência "borrado" ao longo da encosta (sem coordenada tangente, logo sem raios nem emendas).
        const gn = Math.hypot(gx, gy) || 1, ux = gx / gn, uy = gy / gn, w = suave(0.4, 0.9, gl);
        let sn = 0, sr = 0;
        for (const t of [-0.32, -0.16, 0, 0.16, 0.32]) { sn += rEstria((mx + ux * t) * 15, (my + uy * t) * 15); sr += rRevela((mx + ux * t) * 9, (my + uy * t) * 9); }
        estria = (sn / 5 - 0.5) * 3.2 * w; revela = suave(0.5, 0.68, sr / 5) * w;
      }
      const grao = (fbm(rGrao, mx * 5, my * 5, 3) - 0.5) * 0.3 + (fbm(rGrao, mx * 17 + 30, my * 17, 2) - 0.5) * 0.42 * suave(0.05, 0.4, d) + (hash2D(x, y, s) - 0.5) * 0.05;
      sombraLuz = lit * 0.8 + macia * 0.7 + larga * 0.35 + faceta + estria * 0.22 + grao - fenda * 0.8;
      sMacia = macia; sLit = lit;
      tinto = Math.max(suave(0.3, 0.85, -macia) * 0.7, fenda * 0.7, (1 - suave(0, 0.05, d)) * 0.6);
      if (sombraLuz >= 0) misturar(alto, cCla, Math.min(1, sombraLuz) * 0.55, tom); else misturar(alto, cEsc, Math.min(1, -sombraLuz) * 0.85, tom);
    }
    cor[0] = tom[0]; cor[1] = tom[1]; cor[2] = tom[2];
    if (cTopo) {
      let m: number;
      if (pixel) {
        m = bruta[i]! + (fbm(rNeve, mx * 2.6, my * 2.6, 3) - 0.5) * 0.4 > 0.7 ? 1 : 0;
        if (m > 0) { if (sombraLuz >= -0.15) { neve[0] = cTopo[0]; neve[1] = cTopo[1]; neve[2] = cTopo[2]; } else misturar(cTopo, cNeveSombraPixel, 1, neve); }
      } else {
        // A neve segue o relevo: cobre os patamares altos e as faces voltadas para a luz, com borda macia, e a rocha aparece em estrias.
        const nv = bruta[i]! + sMacia * 0.12 + sLit * 0.06 + (fbm(rNeve, mx * 1.8, my * 1.8, 3) - 0.5) * 0.42;
        m = suave(0.56, 0.74, nv) * (1 - 0.7 * revela);
        if (m > 0) misturar(cTopo, cNeveSombra, limitar(-(sombraLuz - 0.05) * 0.8, 0, 1) * 0.95, neve);
      }
      if (m > 0) { misturar(cor, neve, m, cor); tinto *= 1 - m * (pixel ? 0.75 : 0.6); }
    }
    if (tinto > 0) misturar(cor, tinta, tinto, tmp), (cor[0] = tmp[0], cor[1] = tmp[1], cor[2] = tmp[2]);
    if (!pixel) misturar(cor, escuridao, (1 - suave(0, 0.7, d)) * 0.82, cor);      // pé da parede: a face escurece quase ao negro do vão
    const o = i * 4;
    rgba[o] = cor[0]; rgba[o + 1] = cor[1]; rgba[o + 2] = cor[2]; rgba[o + 3] = alfa ? alfa[i]! : 255;
  }

  // 2. Sombra de contato: a rocha escurece o que está embaixo, 0,4 m para fora, empurrada para sudeste (a luz vem de noroeste).
  const fora = new Uint8Array(n); for (let i = 0; i < n; i++) fora[i] = dentro[i] ? 0 : 1;
  const alcance = pixel ? Math.max(2.01 / res, 0.15) : SOMBRA_DE_CONTATO, dFora = distanciaAMargem(fora, W, H, res, alcance + 0.01), desl = pixel ? 1 : Math.max(1, Math.round(0.1 * res));
  const sombraPixel = rgb('#0b0e12');
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    if (dentro[i]) continue;
    const dd = dFora[py(y - desl) * W + px(x - desl)]!, o = i * 4;
    if (dd >= alcance && (pixel || dFora[i]! >= alcance)) continue;
    if (pixel) { sombra[o] = sombraPixel[0]; sombra[o + 1] = sombraPixel[1]; sombra[o + 2] = sombraPixel[2]; sombra[o + 3] = 255; }
    else { const ao = Math.pow(Math.max(0, 1 - dFora[i]! / alcance), 1.8) * 0.62, sudeste = Math.pow(1 - dd / alcance, 1.6) * 0.74; sombra[o] = 4; sombra[o + 1] = 6; sombra[o + 2] = 10; sombra[o + 3] = Math.max(ao, sudeste) * 255; }
  }
  return { rgba, sombra };
}
