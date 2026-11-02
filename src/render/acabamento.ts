import { Filter, GlProgram, UniformGroup } from 'pixi.js';
import type { Acabamento } from '../domain/mapa.ts';

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
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float suave(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 cor = c.rgb;
  float l = dot(cor, vec3(0.299, 0.587, 0.114));
  cor = mix(vec3(l), cor, uSaturacao);
  cor = cor * uGain + uLift;
  cor = pow(max(cor, vec3(0.0)), vec3(1.0 / max(uGamma, 0.05)));
  cor *= uTom;
  vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  float mancha = suave(uv * 14.0) * 0.6 + suave(uv * 55.0) * 0.4;
  cor *= 1.0 - uTextura * 0.38 * mancha;
  cor *= 1.0 - uVinheta * smoothstep(0.35, 0.85, distance(uv, vec2(0.5)));
  cor += (hash(floor(gl_FragCoord.xy / 1.5) + fract(uTempo) * 61.0) - 0.5) * uGrao;
  finalColor = vec4(clamp(cor, 0.0, 1.0) * c.a, c.a);
}`;

const rgb = (hex: string): Float32Array => { const p = parseInt(hex.slice(1), 16); return new Float32Array([((p >> 16) & 255) / 255, ((p >> 8) & 255) / 255, (p & 255) / 255]); };

/** O acabamento da cena (saturação, tinta, textura, vinheta, granulação, curva de cor), igual nos dois renderizadores. */
export function criarFiltroAcabamento(): { filtro: Filter; aplicar(a: Acabamento, tempo?: number): void } {
  const grupo = new UniformGroup({
    uSaturacao: { value: 1, type: 'f32' }, uTom: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' }, uVinheta: { value: 0, type: 'f32' }, uGrao: { value: 0, type: 'f32' },
    uTextura: { value: 0, type: 'f32' }, uLift: { value: 0, type: 'f32' }, uGamma: { value: 1, type: 'f32' }, uGain: { value: 1, type: 'f32' }, uTempo: { value: 0, type: 'f32' },
  });
  const filtro = new Filter({ glProgram: GlProgram.from({ vertex, fragment, name: 'atlas-acabamento' }), resources: { acabamento: grupo } });
  return {
    filtro,
    aplicar(a, tempo = 0) {
      const u = grupo.uniforms as Record<string, unknown>;
      u.uSaturacao = a.saturation; u.uTom = rgb(a.tint); u.uVinheta = a.vignette; u.uGrao = a.grain; u.uTextura = a.texture;
      u.uLift = a.grade.lift; u.uGamma = a.grade.gamma; u.uGain = a.grade.gain; u.uTempo = tempo;
    },
  };
}
