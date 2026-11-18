import { Filter, GlProgram, Matrix, Texture, TextureMatrix, UniformGroup, type FilterSystem, type RenderSurface } from 'pixi.js';
import type { MapaDeLuz } from './mapa-de-luz.ts';

const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vLuzCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uLuzMatriz;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord(void) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) {
  gl_Position = filterVertexPosition();
  vec2 tc = filterTextureCoord();
  vTextureCoord = tc;
  vLuzCoord = (uLuzMatriz * vec3(tc, 1.0)).xy;
}`;

// Sem arrays constantes: o Pixi pode compilar para GLSL ES 1.00. Os uniformes compartilhados com o vértice são highp.
const fragment = `in vec2 vTextureCoord;
in vec2 vLuzCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uLuz;
uniform float uEscala;
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 base = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  vec3 luz = texture(uLuz, vLuzCoord).rgb * uEscala;
  vec3 cor = clamp(base * luz, 0.0, 1.0);
  finalColor = vec4(cor * c.a, c.a);
}`;

class FiltroDeComposicaoDeLuz extends Filter {
  private readonly luz: MapaDeLuz;
  private readonly grupo: UniformGroup;
  private readonly textureMatrix: TextureMatrix;

  constructor(luz: MapaDeLuz) {
    const grupo = new UniformGroup({
      uLuzMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
      uEscala: { value: 1, type: 'f32' },
    });
    const glProgram = GlProgram.from({
      vertex,
      fragment,
      preferredFragmentPrecision: 'highp',
      name: 'atlas-composicao-de-luz',
    });
    super({
      glProgram,
      resolution: 'inherit',
      antialias: 'inherit',
      resources: {
        composicao: grupo,
        uLuz: Texture.WHITE.source,
      },
    });
    this.luz = luz;
    this.grupo = grupo;
    this.textureMatrix = new TextureMatrix(Texture.WHITE);
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const sp = this.luz.sprite;
    const tex = sp.texture;
    const pronta = Boolean(tex && !tex.destroyed && tex.source && !tex.source.destroyed && tex !== Texture.EMPTY);
    const uniforms = this.grupo.uniforms as { uLuzMatriz: Matrix; uEscala: number };
    if (pronta) {
      this.textureMatrix.texture = tex;
      filterManager
        .calculateSpriteMatrix(uniforms.uLuzMatriz, sp)
        .prepend(this.textureMatrix.mapCoord);
      uniforms.uEscala = this.luz.escala;
      this.resources.uLuz = tex.source;
    } else {
      uniforms.uLuzMatriz.identity();
      uniforms.uEscala = 1;
      this.resources.uLuz = Texture.WHITE.source;
    }
    filterManager.applyFilter(this, input, output, clearMode);
  }

  override destroy(destroyPrograms = false): void {
    this.textureMatrix.destroy();
    super.destroy(destroyPrograms);
  }
}

/** Filtro em tela cheia (Ilustrado) que compõe a cena com o mapa de luz em HDR (ou 8 bits escalado). */
export function criarFiltroDeComposicaoDeLuz(luz: MapaDeLuz): Filter {
  return new FiltroDeComposicaoDeLuz(luz);
}
