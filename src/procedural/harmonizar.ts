/**
 * Harmonização de imagens da coleção: recorte do vazio, contorno de nanquim e sombra de contato, para um objeto achado ficar do tamanho da
 * pegada e com o traço dos móveis procedurais. Funções puras sobre pixels (RGBA, alfa direto), testáveis sem navegador.
 */
export interface Pixels { width: number; height: number; data: Uint8ClampedArray }
export type Rgb = readonly [number, number, number];

/** O nanquim das receitas (o contorno `rgba(14,10,12,…)` de `raster.ts`). */
export const COR_DO_CONTORNO: Rgb = [14, 10, 12];

export const novosPixels = (width: number, height: number): Pixels => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });

/** A caixa dos pixels com alfa acima de `limiar` (fim exclusivo), ou `null` se a imagem está vazia. */
export function caixaDoConteudo(img: Pixels, limiar = 8): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]! > limiar) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

/** Máximo (dilatação) do alfa numa janela quadrada de raio `r`, separável. */
function dilatar(alfa: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  const h1 = new Uint8ClampedArray(alfa.length), h2 = new Uint8ClampedArray(alfa.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) m = Math.max(m, alfa[y * w + k]!); h1[y * w + x] = m; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let m = 0; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) m = Math.max(m, h1[k * w + x]!); h2[y * w + x] = m; }
  return h2;
}
const alfaDe = (img: Pixels): Uint8ClampedArray => { const a = new Uint8ClampedArray(img.width * img.height); for (let i = 0; i < a.length; i++) a[i] = img.data[i * 4 + 3]!; return a; };

/** Põe `topo` sobre `base` (mesmo tamanho), com a composição "over" de alfa direto. Devolve uma imagem nova. */
export function sobrepor(base: Pixels, topo: Pixels): Pixels {
  const saida = novosPixels(base.width, base.height);
  for (let i = 0; i < base.width * base.height; i++) {
    const o = i * 4, at = topo.data[o + 3]! / 255, ab = base.data[o + 3]! / 255, ao = at + ab * (1 - at);
    if (ao <= 0) continue;
    for (let c = 0; c < 3; c++) saida.data[o + c] = (topo.data[o + c]! * at + base.data[o + c]! * ab * (1 - at)) / ao;
    saida.data[o + 3] = ao * 255;
  }
  return saida;
}

/** A imagem com um contorno de `px` pixels na cor dada, desenhado por baixo (o conteúdo não muda; só cresce para fora). */
export function contorno(img: Pixels, px: number, cor: Rgb = COR_DO_CONTORNO): Pixels {
  if (px <= 0) return img;
  const dil = dilatar(alfaDe(img), img.width, img.height, Math.ceil(px)), anel = novosPixels(img.width, img.height);
  for (let i = 0; i < dil.length; i++) { anel.data[i * 4] = cor[0]; anel.data[i * 4 + 1] = cor[1]; anel.data[i * 4 + 2] = cor[2]; anel.data[i * 4 + 3] = dil[i]!; }
  return sobrepor(anel, img);
}

/** Desfoque de caixa do alfa, `r` pixels, em duas passadas (aproxima um desfoque suave). */
function desfocar(alfa: Uint8ClampedArray, w: number, h: number, r: number): Uint8ClampedArray {
  let atual = Float32Array.from(alfa);
  for (let passada = 0; passada < 2; passada++) {
    const a = new Float32Array(atual.length), b = new Float32Array(atual.length), n = 2 * r + 1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = x - r; k <= x + r; k++) if (k >= 0 && k < w) s += atual[y * w + k]!; a[y * w + x] = s / n; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let k = y - r; k <= y + r; k++) if (k >= 0 && k < h) s += a[k * w + x]!; b[y * w + x] = s / n; }
    atual = b;
  }
  return Uint8ClampedArray.from(atual);
}

/** A sombra de contato: o alfa da imagem desfocado em `raioPx`, deslocado por `deslocamento` (pixels) e com `opacidade` (0 a 1), em preto. Mesmo tamanho; vai por baixo. */
export function sombraDeContato(img: Pixels, raioPx: number, deslocamento: readonly [number, number], opacidade: number): Pixels {
  const { width: w, height: h } = img, desf = raioPx > 0 ? desfocar(alfaDe(img), w, h, Math.ceil(raioPx)) : alfaDe(img), saida = novosPixels(w, h);
  const [dx, dy] = [Math.round(deslocamento[0]), Math.round(deslocamento[1])];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - dx, sy = y - dy; if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    saida.data[(y * w + x) * 4 + 3] = desf[sy * w + sx]! * opacidade;
  }
  return saida;
}

/** A direção da luz do mapa para a sombra (a mesma das receitas: para baixo e à direita) e as larguras, em metros. */
export const SOMBRA_DE_CONTATO = { raio: 0.035, deslocamento: [0.03, 0.035] as const, opacidade: 0.5, contorno: 1.5 / 128 };

/** Para onde a cor de uma imagem é puxada: saturação e luminância médias (0 a 1) e uma tinta leve. Vem do gênero do mapa. */
export interface AlvoDeCor { saturacao: number; luminancia: number; tinta: string }

const luma = (r: number, g: number, b: number) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
/** Saturação (HSL) de um pixel, 0 a 1. */
function saturacao(r: number, g: number, b: number): number { const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2; return mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1)); }

/** A saturação e a luminância médias dos pixels com alfa acima de 0,5. */
export function medirCor(img: Pixels): { saturacao: number; luminancia: number; pixels: number } {
  let s = 0, l = 0, n = 0;
  for (let i = 0; i < img.width * img.height; i++) { const o = i * 4; if (img.data[o + 3]! <= 127) continue; s += saturacao(img.data[o]!, img.data[o + 1]!, img.data[o + 2]!); l += luma(img.data[o]!, img.data[o + 1]!, img.data[o + 2]!); n++; }
  return n ? { saturacao: s / n, luminancia: l / n, pixels: n } : { saturacao: 0, luminancia: 0, pixels: 0 };
}

/**
 * Aproxima a saturação e a luminância médias da imagem das do alvo, por `forca` (0 a 1), e multiplica por uma tinta leve.
 * O matiz não muda (a saturação gira em torno do cinza do próprio pixel); pixels transparentes ficam como estão.
 */
export function puxarCor(img: Pixels, alvo: AlvoDeCor, forca = 0.6): Pixels {
  const m = medirCor(img); if (!m.pixels) return img;
  const fs = m.saturacao > 0.02 ? Math.min(3, Math.max(0.2, (m.saturacao + (alvo.saturacao - m.saturacao) * forca) / m.saturacao)) : 1;
  const fl = m.luminancia > 0.02 ? Math.min(3, Math.max(0.3, (m.luminancia + (alvo.luminancia - m.luminancia) * forca) / m.luminancia)) : 1;
  const t = parseInt(alvo.tinta.slice(1), 16), tinta = [(t >> 16) & 255, (t >> 8) & 255, t & 255].map(c => 0.8 + 0.2 * (c / 255));
  const saida = { width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) };
  for (let i = 0; i < img.width * img.height; i++) {
    const o = i * 4; if (img.data[o + 3]! === 0) continue;
    const r = img.data[o]!, g = img.data[o + 1]!, b = img.data[o + 2]!, y = 0.299 * r + 0.587 * g + 0.114 * b;
    for (let c = 0; c < 3; c++) saida.data[o + c] = (y + (img.data[o + c]! - y) * fs) * fl * tinta[c]!;
  }
  return saida;
}
