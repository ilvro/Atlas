import { Filter, GlProgram, UniformGroup } from 'pixi.js';
import { VERTEX_FILTRO } from './passadas.ts';

/** Quantiza a intensidade da luz em `uDegraus` faixas de borda dura e mantém o tom (a cor quente continua quente). */
const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uDegraus;
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 l = c.rgb;
  float m = max(max(max(l.r, l.g), l.b), 0.0001);
  float q = floor(m * uDegraus + 0.35) / uDegraus;
  finalColor = vec4(l / m * q, c.a);
}`;

/** Os degraus da luz no Pixel (a ficha prevê de 3 a 8; fica o meio-termo). */
export const DEGRAUS_DA_LUZ = 5;

/** O filtro de faixas da luz do estilo Pixel (porte de `filtroFaixas` do protótipo). */
export function criarFiltroDeFaixas(degraus = DEGRAUS_DA_LUZ): Filter {
  return new Filter({ glProgram: GlProgram.from({ vertex: VERTEX_FILTRO, fragment, preferredFragmentPrecision: 'highp', name: 'atlas-faixas' }), resources: { faixas: new UniformGroup({ uDegraus: { value: degraus, type: 'f32' } }) } });
}
