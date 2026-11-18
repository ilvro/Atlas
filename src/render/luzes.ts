import { BufferImageSource, Texture } from 'pixi.js';

/** Altura padrão (em metros) de uma luz de parede/chão no cálculo de relevo; feixes (`rays`) usam 6 m. */
export const ALTURA_DA_LUZ = 1.6;
/** Resolução da textura radial de direção da luz. */
export const TAMANHO_TEXTURA_DIRECAO = 256;

let textura: Texture | null = null;
let texturaPixel: Texture | null = null;
let texturaDirecaoFloat: Texture | null = null;
let texturaDirecao8: Texture | null = null;

/** Mesma curva de queda radial de `texturaDeBrilho`: 1 no centro, 0 na borda (`r >= 1`). */
export function quedaDaLuz(r: number): number {
  if (r <= 0) return 1;
  if (r >= 1) return 0;
  if (r < 0.22) return 1 - (0.3 * r) / 0.22;
  if (r < 0.55) return 0.7 - (0.45 * (r - 0.22)) / 0.33;
  return 0.25 * (1 - (r - 0.55) / 0.45);
}

/**
 * Calcula os canais `(R, G, B, A)` do texel `(u, v)` da textura de direção (centro em `tamanho / 2`).
 * Codifica `R = (0.5 - 0.5·dx)·f`, `G = (0.5 - 0.5·dy)·f`, `B = f`, `A = f` para que a soma
 * aditiva de várias luzes permita recuperar a soma vetorial pesada via `d.rg - 0.5 * d.b`.
 */
export function pixelDeDirecao(u: number, v: number, tamanho = TAMANHO_TEXTURA_DIRECAO): [number, number, number, number] {
  const centro = tamanho / 2;
  const dx = (u - centro) / centro;
  const dy = (v - centro) / centro;
  const f = quedaDaLuz(Math.hypot(dx, dy));
  return [(0.5 - 0.5 * dx) * f, (0.5 - 0.5 * dy) * f, f, f];
}

const _f32 = new Float32Array(1);
const _u32 = new Uint32Array(_f32.buffer);

/** Converte um número para IEEE 754 binary16 (uint16) para upload em `rgba16float`. */
export function floatParaHalf(v: number): number {
  _f32[0] = v;
  const x = _u32[0]!;
  const sign = (x >>> 16) & 0x8000;
  const mant = x & 0x007fffff;
  const exp = (x >>> 23) & 0xff;
  if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x0200 : 0);
  const e = exp - 112;
  if (e >= 31) return sign | 0x7c00;
  if (e <= 0) {
    if (e < -10) return sign;
    const m = (mant | 0x00800000) >> (1 - e);
    return sign | ((m + 0x1000) >> 13);
  }
  return sign | ((e << 10) + ((mant + 0x1000) >> 13));
}

/** Textura 256×256 que guarda em cada texel o vetor do pixel até o centro da luz, pesado pela queda `f`. */
export function texturaDeDirecao(ehFloat = false): Texture {
  const cache = ehFloat ? texturaDirecaoFloat : texturaDirecao8;
  if (cache && !cache.destroyed) return cache;
  const N = TAMANHO_TEXTURA_DIRECAO;
  const total = N * N * 4;
  const dados = ehFloat ? new Uint16Array(total) : new Uint8Array(total);
  for (let v = 0; v < N; v++) {
    for (let u = 0; u < N; u++) {
      const [r, g, b, a] = pixelDeDirecao(u, v, N);
      const i = (v * N + u) * 4;
      if (ehFloat) {
        dados[i] = floatParaHalf(r);
        dados[i + 1] = floatParaHalf(g);
        dados[i + 2] = floatParaHalf(b);
        dados[i + 3] = floatParaHalf(a);
      } else {
        dados[i] = Math.round(r * 255);
        dados[i + 1] = Math.round(g * 255);
        dados[i + 2] = Math.round(b * 255);
        dados[i + 3] = Math.round(a * 255);
      }
    }
  }
  const source = new BufferImageSource({
    resource: dados,
    width: N,
    height: N,
    format: ehFloat ? 'rgba16float' : 'rgba8unorm',
    scaleMode: 'linear',
    alphaMode: 'no-premultiply-alpha',
  });
  const tex = new Texture({ source });
  if (ehFloat) texturaDirecaoFloat = tex;
  else texturaDirecao8 = tex;
  return tex;
}

/** O brilho de uma luz: um degradê radial branco que o Pixi tinge com a cor da luz e soma à cena. */
export function texturaDeBrilho(): Texture {
  if (textura && !textura.destroyed) return textura;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!, gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.7)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.25)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  textura = Texture.from(c);
  return textura;
}

/** No estilo Pixel o halo tem 2 faixas concêntricas de borda dura (degraus a 50% e 100% do raio). */
export function texturaDeBrilhoPixel(): Texture {
  if (texturaPixel && !texturaPixel.destroyed) return texturaPixel;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(64, 64, 64, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(64, 64, 32, 0, Math.PI * 2); g.fill();
  texturaPixel = Texture.from(c);
  texturaPixel.source.scaleMode = 'nearest';
  return texturaPixel;
}
