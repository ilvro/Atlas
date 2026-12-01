import { Filter, GlProgram, UniformGroup } from 'pixi.js';
import type { Acabamento, TonalizacaoDividida } from '../domain/mapa.ts';
import { hexParaRgb01, preencherRgb01 } from './cores.ts';
import { VERTEX_FILTRO } from './passadas.ts';

const LUM_R = 0.299;
const LUM_G = 0.587;
const LUM_B = 0.114;

/**
 * Espelho puro da tonalização dividida (`finish.split`) aplicada no acabamento:
 * puxa sombras e luzes para cores próprias mantendo a luminância original.
 */
export function tonalizar(cor: readonly [number, number, number], split: TonalizacaoDividida): [number, number, number] {
  const amount = Math.min(1, Math.max(0, split.amount));
  if (amount <= 0) return [cor[0], cor[1], cor[2]];
  const s = hexParaRgb01(split.shadows);
  const h = hexParaRgb01(split.highlights);
  const lumAntes = cor[0] * LUM_R + cor[1] * LUM_G + cor[2] * LUM_B;
  const x = Math.min(1, Math.max(0, lumAntes + split.balance));
  const t = x * x * (3 - 2 * x);
  const tintR = (s[0] + (h[0] - s[0]) * t) * 2;
  const tintG = (s[1] + (h[1] - s[1]) * t) * 2;
  const tintB = (s[2] + (h[2] - s[2]) * t) * 2;
  const r = cor[0] + (cor[0] * tintR - cor[0]) * amount;
  const g = cor[1] + (cor[1] * tintG - cor[1]) * amount;
  const b = cor[2] + (cor[2] * tintB - cor[2]) * amount;
  const lumDepois = r * LUM_R + g * LUM_G + b * LUM_B;
  if (lumDepois > 1e-5) {
    const k = lumAntes / lumDepois;
    return [r * k, g * k, b * k];
  }
  return [r, g, b];
}

// Sem arrays constantes: o Pixi pode compilar para GLSL ES 1.00. Os uniformes compartilhados com o vértice são highp.
const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uSaturacao;
uniform vec3 uTom;
uniform float uVinheta;
uniform float uGrao;
uniform float uTextura;
uniform float uLift;
uniform float uGamma;
uniform float uGain;
uniform float uTempo;
uniform vec3 uSplitShadows;
uniform vec3 uSplitHighlights;
uniform float uSplitBalance;
uniform float uSplitAmount;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float suave(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 cor = c.a > 1e-5 ? c.rgb / c.a : vec3(0.0);
  float l = dot(cor, vec3(0.299, 0.587, 0.114));
  cor = mix(vec3(l), cor, uSaturacao);
  cor = cor * uGain + uLift;
  cor = pow(max(cor, vec3(0.0)), vec3(1.0 / max(uGamma, 0.05)));
  cor *= uTom;
  if (uSplitAmount > 0.0001) {
    float lAntes = dot(cor, vec3(0.299, 0.587, 0.114));
    float tSplit = smoothstep(0.0, 1.0, lAntes + uSplitBalance);
    vec3 corSplit = mix(uSplitShadows, uSplitHighlights, tSplit) * 2.0;
    vec3 misturada = mix(cor, cor * corSplit, uSplitAmount);
    float lDepois = dot(misturada, vec3(0.299, 0.587, 0.114));
    cor = lDepois > 1e-5 ? misturada * (lAntes / lDepois) : misturada;
  }
  vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  float mancha = suave(uv * 14.0) * 0.6 + suave(uv * 55.0) * 0.4;
  cor *= 1.0 - uTextura * 0.38 * mancha;
  cor *= 1.0 - uVinheta * smoothstep(0.35, 0.85, distance(uv, vec2(0.5)));
  cor += (hash(floor(gl_FragCoord.xy / 1.5) + fract(uTempo) * 61.0) - 0.5) * uGrao;
  finalColor = vec4(clamp(cor, 0.0, 1.0) * c.a, c.a);
}`;

/** O acabamento da cena (saturação, tinta, tonalização dividida, textura, vinheta, granulação, curva de cor), igual nos dois renderizadores. */
export function criarFiltroAcabamento(): { filtro: Filter; aplicar(a: Acabamento, tempo?: number): void } {
  const uTom = new Float32Array([1, 1, 1]);
  const uSplitShadows = new Float32Array([0.5, 0.5, 0.5]);
  const uSplitHighlights = new Float32Array([0.5, 0.5, 0.5]);
  const grupo = new UniformGroup({
    uSaturacao: { value: 1, type: 'f32' }, uTom: { value: uTom, type: 'vec3<f32>' }, uVinheta: { value: 0, type: 'f32' }, uGrao: { value: 0, type: 'f32' },
    uTextura: { value: 0, type: 'f32' }, uLift: { value: 0, type: 'f32' }, uGamma: { value: 1, type: 'f32' }, uGain: { value: 1, type: 'f32' }, uTempo: { value: 0, type: 'f32' },
    uSplitShadows: { value: uSplitShadows, type: 'vec3<f32>' },
    uSplitHighlights: { value: uSplitHighlights, type: 'vec3<f32>' },
    uSplitBalance: { value: 0, type: 'f32' },
    uSplitAmount: { value: 0, type: 'f32' },
  });
  const filtro = new Filter({ glProgram: GlProgram.from({ vertex: VERTEX_FILTRO, fragment, preferredFragmentPrecision: 'highp', name: 'atlas-acabamento' }), resources: { acabamento: grupo } });
  return {
    filtro,
    aplicar(a, tempo = 0) {
      const u = grupo.uniforms as Record<string, unknown>;
      u.uSaturacao = a.saturation; preencherRgb01(uTom, a.tint); u.uVinheta = a.vignette; u.uGrao = a.grain; u.uTextura = a.texture;
      u.uLift = a.grade.lift; u.uGamma = a.grade.gamma; u.uGain = a.grade.gain; u.uTempo = tempo;
      const split = a.split;
      if (split) {
        preencherRgb01(uSplitShadows, split.shadows);
        preencherRgb01(uSplitHighlights, split.highlights);
        u.uSplitBalance = split.balance;
        u.uSplitAmount = split.amount;
      } else {
        uSplitShadows[0] = 0.5; uSplitShadows[1] = 0.5; uSplitShadows[2] = 0.5;
        uSplitHighlights[0] = 0.5; uSplitHighlights[1] = 0.5; uSplitHighlights[2] = 0.5;
        u.uSplitBalance = 0;
        u.uSplitAmount = 0;
      }
      grupo.update();
    },
  };
}
