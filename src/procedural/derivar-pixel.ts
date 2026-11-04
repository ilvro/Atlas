import { contornarPixels } from './estilos/partes-pixel.ts';

/** Uma imagem RGBA (o `ImageData` do navegador serve, e um objeto simples nos testes). */
export interface ImagemRgba { width: number; height: number; data: Uint8ClampedArray }

type Rgb = [number, number, number];
const deHex = (h: string): Rgb => { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const luminancia = (c: Rgb): number => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
export const ALFA_DA_SOMBRA_DERIVADA = 115;

// Bayer 4×4 como no filtro de paleta (valores de -0,47 a 0,53).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.47);

/** A cor mais próxima da paleta (distância pesada pela percepção, como o filtro de paleta do mapa). */
function maisProxima(c: Rgb, paleta: readonly Rgb[]): Rgb {
  let melhor = paleta[0]!, md = Infinity;
  for (const p of paleta) {
    const d0 = (c[0] - p[0]) * 0.3, d1 = (c[1] - p[1]) * 0.59, d2 = (c[2] - p[2]) * 0.11, e = d0 * d0 + d1 * d1 + d2 * d2 + 0.25 * ((c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2);
    if (e < md) { md = e; melhor = p; }
  }
  return melhor;
}

/**
 * Deriva a versão Pixel de uma imagem: reduz ao tamanho `alvo` pela **moda** da cor de cada bloco (preserva as bordas melhor que a média), alfa binário (um
 * bloco é opaco se metade dele é), mapeia as cores para a paleta (com Bayer opcional) e põe o contorno de 1 px (na cor mais escura da paleta) e a sombra de contato.
 * Pura: não toca no DOM.
 */
export function derivarPixel(img: ImagemRgba, alvo: { largura: number; altura: number }, paleta: readonly string[], o: { dither: boolean; contorno: boolean; sombra?: boolean }): ImagemRgba {
  const W = Math.max(1, Math.round(alvo.largura)), H = Math.max(1, Math.round(alvo.altura)), saida = new Uint8ClampedArray(W * H * 4), pal = paleta.map(deHex);
  const tinta = pal.reduce((a, b) => (luminancia(b) < luminancia(a) ? b : a), pal[0]!);
  for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
    const x0 = Math.floor((tx * img.width) / W), x1 = Math.max(x0 + 1, Math.floor(((tx + 1) * img.width) / W)), y0 = Math.floor((ty * img.height) / H), y1 = Math.max(y0 + 1, Math.floor(((ty + 1) * img.height) / H));
    const baldes = new Map<number, { n: number; r: number; g: number; b: number }>(); let opacos = 0, total = 0;
    for (let y = y0; y < Math.min(y1, img.height); y++) for (let x = x0; x < Math.min(x1, img.width); x++) {
      total++; const i = (y * img.width + x) * 4; if (img.data[i + 3]! < 128) continue;
      opacos++; const r = img.data[i]!, g = img.data[i + 1]!, b = img.data[i + 2]!, k = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4), bl = baldes.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
      bl.n++; bl.r += r; bl.g += g; bl.b += b; baldes.set(k, bl);
    }
    if (!total || opacos * 2 < total) continue;       // alfa binário: o bloco só é opaco se a metade dele é
    let top = { n: 0, r: 0, g: 0, b: 0 }; for (const bl of baldes.values()) if (bl.n > top.n) top = bl;
    const cor: Rgb = [top.r / top.n, top.g / top.n, top.b / top.n], limiar = o.dither ? BAYER[(ty & 3) * 4 + (tx & 3)]! * 0.018 * 255 : 0;
    const p = maisProxima([cor[0] + limiar, cor[1] + limiar, cor[2] + limiar], pal), j = (ty * W + tx) * 4;
    saida[j] = p[0]; saida[j + 1] = p[1]; saida[j + 2] = p[2]; saida[j + 3] = 255;
  }
  if (o.sombra) {
    // Sombra de contato: a silhueta deslocada 1 px, só no que fica livre.
    const sol = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && saida[(y * W + x) * 4 + 3] === 255, novos: number[] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!sol(x, y) && sol(x - 1, y - 1)) novos.push((y * W + x) * 4);
    for (const j of novos) { saida[j] = tinta[0]; saida[j + 1] = tinta[1]; saida[j + 2] = tinta[2]; saida[j + 3] = ALFA_DA_SOMBRA_DERIVADA; }
  }
  if (o.contorno) contornarPixels(saida, W, H, tinta);
  return { width: W, height: H, data: saida };
}
