import { Filter, GlProgram, UniformGroup } from 'pixi.js';

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
  return new Filter({ glProgram: GlProgram.from({ vertex, fragment, name: 'atlas-faixas' }), resources: { faixas: new UniformGroup({ uDegraus: { value: degraus, type: 'f32' } }) } });
}
