import { Filter, GlProgram, UniformGroup, Texture } from 'pixi.js';

const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }`;

/** Acabamento comum aos dois renderizadores: saturação, contraste, tom, vinheta e granulação. */
export function filtroAcabamento() {
  const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uSaturacao;
uniform float uContraste;
uniform vec3 uTom;
uniform float uVinheta;
uniform float uGrao;
uniform float uTempo;
uniform float uPixel;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 cor = c.rgb;
  float l = dot(cor, vec3(0.299, 0.587, 0.114));
  cor = mix(vec3(l), cor, uSaturacao);
  cor = (cor - 0.5) * uContraste + 0.5;
  cor *= uTom;
  vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  float d = distance(uv, vec2(0.5));
  cor *= 1.0 - uVinheta * smoothstep(0.35, 0.85, d);
  vec2 celula = uPixel > 0.5 ? floor(gl_FragCoord.xy) : floor(gl_FragCoord.xy / 1.5);
  cor += (hash(celula + fract(uTempo) * 61.0) - 0.5) * uGrao;
  finalColor = vec4(clamp(cor, 0.0, 1.0) * c.a, c.a);
}`;
  return new Filter({
    glProgram: GlProgram.from({ vertex, fragment, name: 'atlas-acabamento' }),
    resources: { acabamento: new UniformGroup({
      uSaturacao: { value: 1, type: 'f32' }, uContraste: { value: 1, type: 'f32' }, uTom: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
      uVinheta: { value: 0.3, type: 'f32' }, uGrao: { value: 0.05, type: 'f32' }, uTempo: { value: 0, type: 'f32' }, uPixel: { value: 0, type: 'f32' },
    }) },
  });
}

/** Luz em degraus para o renderizador Pixel: a luz vira faixas planas antes de multiplicar a cena. */
export function filtroFaixas(degraus = 5) {
  const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uDegraus;
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 l = c.rgb;
  float m = max(max(l.r, l.g), 0.0001);
  m = max(m, l.b);
  // Quantiza a intensidade e mantém o tom da luz.
  float q = floor(m * uDegraus + 0.35) / uDegraus;
  finalColor = vec4(l / m * q, c.a);
}`;
  return new Filter({
    glProgram: GlProgram.from({ vertex, fragment, name: 'atlas-faixas' }),
    resources: { faixas: new UniformGroup({ uDegraus: { value: degraus, type: 'f32' } }) },
  });
}

// Paleta de 32 cores do renderizador Pixel: muitos escuros, madeiras, vinhos, verdes, azuis e luzes quentes.
export const PALETA = [
  '#0b0a10', '#16131c', '#221c27', '#2e2633', '#3b3140', '#4a4a5c', '#67708a', '#93a0b5',
  '#eef0f2', '#2b1b14', '#46291b', '#6b3e22', '#93592c', '#b97d3d', '#d9a75e', '#f6e7c1',
  '#4a1418', '#7a1f24', '#b2312e', '#e0573f', '#1d2a1f', '#2f4a32', '#4f7346', '#86a35a',
  '#1a2440', '#2a3f6b', '#3e6aa0', '#7fb0d8', '#3a2244', '#6b3d74', '#e8c4a0', '#c9bb98',
];

/** Quantização para a paleta com dithering ordenado 4×4. Roda na resolução do renderizador Pixel. */
export function filtroPaleta() {
  const canvas = document.createElement('canvas'); canvas.width = PALETA.length; canvas.height = 1;
  const ctx = canvas.getContext('2d'); PALETA.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i, 0, 1, 1); });
  const textura = Texture.from(canvas); textura.source.scaleMode = 'nearest';
  const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uPaleta;
uniform float uDither;
// Bayer 4×4 sem arrays (o Pixi compila também para GLSL ES 1.00).
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 cor = c.rgb + bayer(floor(gl_FragCoord.xy)) * uDither;
  vec3 melhor = vec3(0.0); float dist = 1e9;
  for (int i = 0; i < ${PALETA.length}; i++) {
    vec3 p = texture(uPaleta, vec2((float(i) + 0.5) / ${PALETA.length}.0, 0.5)).rgb;
    vec3 d = (cor - p) * vec3(0.30, 0.59, 0.11);
    float e = dot(d, d) + 0.25 * dot(cor - p, cor - p);
    if (e < dist) { dist = e; melhor = p; }
  }
  finalColor = vec4(melhor * c.a, c.a);
}`;
  return new Filter({
    glProgram: GlProgram.from({ vertex, fragment, name: 'atlas-paleta' }),
    resources: { uPaleta: textura.source, paleta: new UniformGroup({ uDither: { value: 0.018, type: 'f32' } }) },
  });
}
