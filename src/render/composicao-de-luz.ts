import { Filter, GlProgram, Matrix, Sprite, Texture, TextureMatrix, UniformGroup, type Container, type FilterSystem, type RenderSurface } from 'pixi.js';
import type { CenaDeAltura } from './cena-de-altura.ts';
import type { MapaDeLuz } from './mapa-de-luz.ts';

const vertex = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vLuzCoord;
out vec2 vAlturaCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
uniform mat3 uLuzMatriz;
uniform mat3 uAlturaMatriz;
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
  vAlturaCoord = (uAlturaMatriz * vec3(tc, 1.0)).xy;
}`;

/** Lê o modo de depuração da luz na query string (`?luz=direcao` ou `?luz=altura`). */
export function modoDeDepuracaoDaLuz(search?: string): 'direcao' | 'altura' | null {
  const s = search ?? (typeof location !== 'undefined' ? location.search : '');
  if (!s) return null;
  try {
    const modo = new URLSearchParams(s).get('luz');
    return modo === 'direcao' || modo === 'altura' ? modo : null;
  } catch {
    return null;
  }
}

// Sem arrays constantes: o Pixi pode compilar para GLSL ES 1.00. Os uniformes compartilhados com o vértice são highp.
const fragment = `in vec2 vTextureCoord;
in vec2 vLuzCoord;
in vec2 vAlturaCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uLuz;
uniform sampler2D uDirecao;
uniform sampler2D uAltura;
uniform float uEscala;
uniform float uModoDirecao;
uniform float uModoAltura;
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  if (uModoAltura > 0.5) {
    float h = texture(uAltura, vAlturaCoord).r;
    finalColor = vec4(vec3(h) * c.a, c.a);
    return;
  }
  if (uModoDirecao > 0.5) {
    vec4 d = texture(uDirecao, vLuzCoord);
    vec2 xy = d.rg - 0.5 * d.b;
    float m = length(xy);
    vec2 dir = m > 1e-4 ? xy / m : vec2(0.0);
    float peso = smoothstep(0.001, 0.02, d.b * uEscala);
    vec3 vis = mix(vec3(0.0), vec3(dir * 0.5 + 0.5, 0.5), peso);
    finalColor = vec4(vis * c.a, c.a);
    return;
  }
  vec3 base = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  vec3 luz = texture(uLuz, vLuzCoord).rgb * uEscala;
  vec3 cor = clamp(base * luz, 0.0, 1.0);
  finalColor = vec4(cor * c.a, c.a);
}`;

class FiltroDeComposicaoDeLuz extends Filter {
  private readonly luz: MapaDeLuz;
  private readonly altura: CenaDeAltura | undefined;
  private readonly mundoIluminado: Container | undefined;
  private readonly grupo: UniformGroup;
  private readonly textureMatrix: TextureMatrix;
  private readonly alturaTextureMatrix: TextureMatrix;
  private readonly alturaSprite: Sprite;

  constructor(luz: MapaDeLuz, altura?: CenaDeAltura, mundoIluminado?: Container) {
    const grupo = new UniformGroup({
      uLuzMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
      uAlturaMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
      uEscala: { value: 1, type: 'f32' },
      uModoDirecao: { value: 0, type: 'f32' },
      uModoAltura: { value: 0, type: 'f32' },
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
        uDirecao: Texture.EMPTY.source,
        uAltura: Texture.EMPTY.source,
      },
    });
    this.luz = luz;
    this.altura = altura;
    this.mundoIluminado = mundoIluminado;
    this.grupo = grupo;
    this.textureMatrix = new TextureMatrix(Texture.WHITE);
    this.alturaTextureMatrix = new TextureMatrix(Texture.WHITE);
    this.alturaSprite = new Sprite(Texture.EMPTY);
  }

  override apply(filterManager: FilterSystem, input: Texture, output: RenderSurface, clearMode: boolean): void {
    const sp = this.luz.sprite;
    const tex = sp.texture;
    const pronta = Boolean(tex && !tex.destroyed && tex.source && !tex.source.destroyed && tex !== Texture.EMPTY);
    const dir = this.luz.direcao;
    const dirPronta = Boolean(dir && !dir.destroyed && dir.source && !dir.source.destroyed && dir !== Texture.EMPTY);
    const texAlt = this.altura?.textura;
    const altPronta = Boolean(
      this.altura &&
        this.mundoIluminado &&
        texAlt &&
        !texAlt.destroyed &&
        texAlt.source &&
        !texAlt.source.destroyed &&
        texAlt !== Texture.EMPTY,
    );
    const uniforms = this.grupo.uniforms as {
      uLuzMatriz: Matrix;
      uAlturaMatriz: Matrix;
      uEscala: number;
      uModoDirecao: number;
      uModoAltura: number;
    };
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
    this.resources.uDirecao = dirPronta ? dir.source : Texture.EMPTY.source;
    if (altPronta && texAlt && this.altura && this.mundoIluminado) {
      this.alturaTextureMatrix.texture = texAlt;
      this.alturaSprite.texture = texAlt;
      this.altura.atualizarSpriteDeMapeamento(this.alturaSprite, this.mundoIluminado);
      filterManager
        .calculateSpriteMatrix(uniforms.uAlturaMatriz, this.alturaSprite)
        .prepend(this.alturaTextureMatrix.mapCoord);
      this.resources.uAltura = texAlt.source;
    } else {
      uniforms.uAlturaMatriz.identity();
      this.resources.uAltura = Texture.EMPTY.source;
    }
    const modo = modoDeDepuracaoDaLuz();
    uniforms.uModoDirecao = modo === 'direcao' ? 1 : 0;
    uniforms.uModoAltura = modo === 'altura' ? 1 : 0;
    filterManager.applyFilter(this, input, output, clearMode);
  }

  override destroy(destroyPrograms = false): void {
    this.textureMatrix.destroy();
    this.alturaTextureMatrix.destroy();
    this.alturaSprite.destroy();
    super.destroy(destroyPrograms);
  }
}

/** Filtro em tela cheia (Ilustrado) que compõe a cena com o mapa de luz em HDR (ou 8 bits escalado). */
export function criarFiltroDeComposicaoDeLuz(luz: MapaDeLuz, altura?: CenaDeAltura, mundoIluminado?: Container): Filter {
  return new FiltroDeComposicaoDeLuz(luz, altura, mundoIluminado);
}
