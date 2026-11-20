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

/**
 * Amostra `fbm(ruido, x * freq + offsetX, y * freqY + offsetY, oitavas)` numa grade reduzida sobre `area`
 * e interpola por Catmull-Rom bicúbica. A grade é ancorada em múltiplos inteiros de `passo` com 2 células
 * extras em cada borda, mantendo continuidade perfeita entre ladrilhos. Vale para baixa frequência
 * (`max(freq, freqY) * 2^(oitavas - 1) <= 2` ciclos/m).
 */
export function campoDeRuido(
  ruido: (x: number, y: number) => number,
  area: { x: number; y: number; w: number; h: number },
  freq: number,
  oitavas: number,
  passo?: number,
  offsetX = 0,
  offsetY = 0,
  freqY = freq,
): (x: number, y: number) => number {
  const fMax = Math.max(freq, freqY) * (1 << Math.max(0, oitavas - 1));
  const p = passo ?? 1 / (4 * fMax);
  const inv = 1 / p;
  const gx0 = Math.floor(area.x * inv) - 2;
  const gy0 = Math.floor(area.y * inv) - 2;
  const gx1 = Math.ceil((area.x + area.w) * inv) + 2;
  const gy1 = Math.ceil((area.y + area.h) * inv) + 2;
  const nx = Math.max(4, gx1 - gx0 + 1);
  const ny = Math.max(4, gy1 - gy0 + 1);
  const dados = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    const wy = (gy0 + j) * p * freqY + offsetY;
    const base = j * nx;
    for (let i = 0; i < nx; i++) {
      dados[base + i] = fbm(ruido, (gx0 + i) * p * freq + offsetX, wy, oitavas);
    }
  }
  const ox = gx0 * p, oy = gy0 * p;
  const maxX = nx - 3, maxY = ny - 3;
  return (x: number, y: number): number => {
    const fx = (x - ox) * inv;
    const fy = (y - oy) * inv;
    let ix = Math.floor(fx);
    let iy = Math.floor(fy);
    let tx = fx - ix;
    let ty = fy - iy;
    if (ix < 1) { ix = 1; tx = 0; } else if (ix > maxX) { ix = maxX; tx = 1; }
    if (iy < 1) { iy = 1; ty = 0; } else if (iy > maxY) { iy = maxY; ty = 1; }

    const tx2 = tx * tx, tx3 = tx2 * tx;
    const wx0 = 0.5 * (-tx + 2 * tx2 - tx3);
    const wx1 = 0.5 * (2 - 5 * tx2 + 3 * tx3);
    const wx2 = 0.5 * (tx + 4 * tx2 - 3 * tx3);
    const wx3 = 0.5 * (-tx2 + tx3);

    const r0 = (iy - 1) * nx + ix - 1;
    const r1 = r0 + nx;
    const r2 = r1 + nx;
    const r3 = r2 + nx;

    const v0 = dados[r0]! * wx0 + dados[r0 + 1]! * wx1 + dados[r0 + 2]! * wx2 + dados[r0 + 3]! * wx3;
    const v1 = dados[r1]! * wx0 + dados[r1 + 1]! * wx1 + dados[r1 + 2]! * wx2 + dados[r1 + 3]! * wx3;
    const v2 = dados[r2]! * wx0 + dados[r2 + 1]! * wx1 + dados[r2 + 2]! * wx2 + dados[r2 + 3]! * wx3;
    const v3 = dados[r3]! * wx0 + dados[r3 + 1]! * wx1 + dados[r3 + 2]! * wx2 + dados[r3 + 3]! * wx3;

    const ty2 = ty * ty, ty3 = ty2 * ty;
    const res = 0.5 * (
      (2 * v1) +
      (-v0 + v2) * ty +
      (2 * v0 - 5 * v1 + 4 * v2 - v3) * ty2 +
      (-v0 + 3 * v1 - 3 * v2 + v3) * ty3
    );
    return res < 0 ? 0 : res > 1 ? 1 : res;
  };
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
