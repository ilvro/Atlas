// Ruído determinístico, adaptado de Atelie/src/domain/noise.js. Nada aqui usa Math.random().
import { contextoDe, criarTela, type Tela } from './canvas.ts';

export function mulberry32(seed: number): () => number {
  let s = (Math.floor(seed) || 1) >>> 0;
  return () => { s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909); s ^= s >>> 16; return (s >>> 0) / 4294967296; };
}

export function hash2D(x: number, y: number, seed = 0): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export function valueNoise2D(seed = 0): (x: number, y: number) => number {
  const s = Math.floor(seed) || 0;
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2D(xi, yi, s) * (1 - u) + hash2D(xi + 1, yi, s) * u, b = hash2D(xi, yi + 1, s) * (1 - u) + hash2D(xi + 1, yi + 1, s) * u;
    return a * (1 - v) + b * v;
  };
}

export function fbm(ruido: (x: number, y: number) => number, x: number, y: number, oitavas = 4): number {
  let soma = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < oitavas; i++) { soma += amp * ruido(x * freq, y * freq); total += amp; freq *= 2; amp *= 0.5; }
  return soma / total;
}

/** Ruído de valor com a grade dando a volta a cada `periodo` células: emenda perfeita nas bordas. */
function ruidoPeriodico(x: number, y: number, periodo: number, seed: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (i: number) => ((i % periodo) + periodo) % periodo, g = (i: number, j: number) => hash2D(m(i), m(j), seed);
  return (g(xi, yi) * (1 - u) + g(xi + 1, yi) * u) * (1 - v) + (g(xi, yi + 1) * (1 - u) + g(xi + 1, yi + 1) * u) * v;
}

/** Ladrilho de ruído fbm em tons de cinza, contínuo nas bordas (cada oitava dá a volta na sua própria grade), para usar como padrão. */
export function ladrilhoDeRuido(tamanho: number, seed: number, celulas = 8, oitavas = 4): Tela {
  const tela = criarTela(tamanho, tamanho), ctx = contextoDe(tela), img = ctx.createImageData(tamanho, tamanho), s = Math.floor(seed) || 0;
  for (let y = 0; y < tamanho; y++) for (let x = 0; x < tamanho; x++) {
    let soma = 0, amp = 1, total = 0;
    for (let o = 0; o < oitavas; o++) { const c = celulas * 2 ** o; soma += amp * ruidoPeriodico((x / tamanho) * c, (y / tamanho) * c, c, s + 100 + o * 53); total += amp; amp *= 0.5; }
    const c = Math.max(0, Math.min(255, Math.round((soma / total) * 255))), i = (y * tamanho + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = c; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tela;
}
