// Ruído determinístico, adaptado de Atelie/src/domain/noise.js.

export function mulberry32(seed) {
  let s = (Math.floor(seed) || 1) >>> 0;
  return function rand() {
    s = Math.imul(s ^ (s >>> 15), 2246822507) ^ Math.imul(s ^ (s >>> 13), 3266489909);
    s ^= s >>> 16;
    return (s >>> 0) / 4294967296;
  };
}

export function hash2D(x, y, seed = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1442695041);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export function valueNoise2D(seed = 0) {
  const s = Math.floor(seed) || 0;
  return function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash2D(xi, yi, s) * (1 - u) + hash2D(xi + 1, yi, s) * u;
    const b = hash2D(xi, yi + 1, s) * (1 - u) + hash2D(xi + 1, yi + 1, s) * u;
    return a * (1 - v) + b * v;
  };
}

export function fbm(noise, x, y, octaves = 4) {
  let sum = 0, amp = 1, freq = 1, total = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * freq, y * freq); total += amp; freq *= 2; amp *= 0.5; }
  return sum / total;
}

/** Ladrilho de ruído fbm em tons de cinza, contínuo nas bordas, para usar como padrão de canvas. */
export function noiseTile(size, seed, cells = 8, octaves = 4) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(size, size);
  const noise = valueNoise2D(seed);
  // Contínuo nas bordas: mistura o ruído com cópias deslocadas de um período.
  const sample = (x, y) => fbm((u, v) => noise(((u % cells) + cells) % cells + 100, ((v % cells) + cells) % cells + 100), x, y, octaves);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * cells, v = y / size * cells;
    const fx = u / cells, fy = v / cells;
    const n = sample(u, v) * (1 - fx) * (1 - fy) + sample(u - cells, v) * fx * (1 - fy) + sample(u, v - cells) * (1 - fx) * fy + sample(u - cells, v - cells) * fx * fy;
    const c = Math.max(0, Math.min(255, Math.round(n * 255)));
    const i = (y * size + x) * 4;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = c; image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}
