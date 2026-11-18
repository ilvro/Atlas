import { Filter, GlProgram, Matrix, Sprite, Texture, TextureMatrix, UniformGroup, type Container, type FilterSystem, type RenderSurface } from 'pixi.js';
import { AO_PADRAO, RELEVO_PADRAO } from '../domain/mapa.ts';
import { ALTURA_MAXIMA } from '../procedural/altura.ts';
import type { CenaDeAltura } from './cena-de-altura.ts';
import { ALTURA_DA_LUZ, ALTURA_MAXIMA_DA_LUZ } from './luzes.ts';
import type { MapaDeLuz } from './mapa-de-luz.ts';

export const FORCA_RELEVO_PADRAO = 3;
export const RAIO_AO_CURTO = 0.25;
export const RAIO_AO_LONGO = 0.7;
export const PESO_AO_CURTO = 2;
export const PESO_AO_LONGO = 1;

export type Vetor3 = readonly [number, number, number];
export type AmostraAO = number | { readonly h: number; readonly peso?: number };

/**
 * Espelho puro do realce direcional usado pelo filtro de luz com relevo:
 * `clamp(dot(N, L), 0, 1) / max(L.z, 0.25)` com `N` e `L` normalizados.
 */
export function realceDoRelevo(N: Vetor3, L: Vetor3): number {
  const nLen = Math.hypot(N[0], N[1], N[2]) || 1;
  const lLen = Math.hypot(L[0], L[1], L[2]) || 1;
  const nx = N[0] / nLen, ny = N[1] / nLen, nz = N[2] / nLen;
  const lx = L[0] / lLen, ly = L[1] / lLen, lz = L[2] / lLen;
  const lambert = Math.min(1, Math.max(0, nx * lx + ny * ly + nz * lz));
  return lambert / Math.max(lz, 0.25);
}

/**
 * Espelho puro da oclusão de contato e de canto por altura:
 * calcula a média ponderada de `max(0, h - h0)` e aplica `smoothstep(0, 0.6, ao)`.
 */
export function oclusaoDeAmostras(h0: number, amostras: readonly AmostraAO[]): number {
  let soma = 0;
  let pesos = 0;
  for (const a of amostras) {
    const h = typeof a === 'number' ? a : a.h;
    const peso = typeof a === 'number' ? 1 : (a.peso ?? 1);
    if (peso <= 0) continue;
    soma += Math.max(0, h - h0) * peso;
    pesos += peso;
  }
  if (pesos <= 0) return 0;
  const ao = soma / pesos;
  const t = Math.min(1, Math.max(0, ao / 0.6));
  return t * t * (3 - 2 * t);
}

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
uniform vec3 uAmbiente;
uniform vec2 uAlturaTexel;
uniform float uPassoEmMetros;
uniform float uAlturaMaxima;
uniform float uForca;
uniform float uRelevo;
uniform float uAO;
uniform float uAlturaDaLuz;
uniform float uAlcance;
uniform float uAlturaMaxDaLuz;

float amostraAltura(vec2 offset) {
  return texture(uAltura, vAlturaCoord + offset * uAlturaTexel).r * uAlturaMaxima;
}

float anelAO(float h0, float raioTexels, float c, float s) {
  float soma = 0.0;
  vec2 d0 = vec2(c, s);
  vec2 d1 = vec2(c - s, c + s) * 0.70710678;
  vec2 d2 = vec2(-s, c);
  vec2 d3 = vec2(-c - s, c - s) * 0.70710678;
  soma += max(0.0, amostraAltura( d0 * raioTexels) - h0);
  soma += max(0.0, amostraAltura( d1 * raioTexels) - h0);
  soma += max(0.0, amostraAltura( d2 * raioTexels) - h0);
  soma += max(0.0, amostraAltura( d3 * raioTexels) - h0);
  soma += max(0.0, amostraAltura(-d0 * raioTexels) - h0);
  soma += max(0.0, amostraAltura(-d1 * raioTexels) - h0);
  soma += max(0.0, amostraAltura(-d2 * raioTexels) - h0);
  soma += max(0.0, amostraAltura(-d3 * raioTexels) - h0);
  return soma;
}

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
  if (uPassoEmMetros <= 0.0 || (uRelevo <= 0.0001 && uAO <= 0.0001)) {
    vec3 cor = clamp(base * luz, 0.0, 1.0);
    finalColor = vec4(cor * c.a, c.a);
    return;
  }

  vec3 direta = max(luz - uAmbiente, vec3(0.0));
  vec3 ambBase = luz - direta;
  vec3 ambiente = ambBase;
  vec3 luzDireta = direta;

  if (uRelevo > 0.0001) {
    // Normal por Sobel 3x3 em metros (Y cresce para baixo no mundo/tela).
    float hTL = amostraAltura(vec2(-1.0, -1.0));
    float hT  = amostraAltura(vec2( 0.0, -1.0));
    float hTR = amostraAltura(vec2( 1.0, -1.0));
    float hL  = amostraAltura(vec2(-1.0,  0.0));
    float hR  = amostraAltura(vec2( 1.0,  0.0));
    float hBL = amostraAltura(vec2(-1.0,  1.0));
    float hB  = amostraAltura(vec2( 0.0,  1.0));
    float hBR = amostraAltura(vec2( 1.0,  1.0));
    float gx = (hTR + 2.0 * hR + hBR) - (hTL + 2.0 * hL + hBL);
    float gy = (hBL + 2.0 * hB + hBR) - (hTL + 2.0 * hT + hTR);
    vec3 N = normalize(vec3(-gx * uForca, -gy * uForca, 8.0 * uPassoEmMetros));

    vec4 d = texture(uDirecao, vLuzCoord);
    float peso = smoothstep(0.001, 0.02, d.b * uEscala);
    vec2 dirXY = d.b > 1e-4 ? clamp(2.0 * (d.rg - 0.5 * d.b) / d.b, vec2(-1.0), vec2(1.0)) * peso : vec2(0.0);
    float alturaDaLuz = d.a > 1e-5 && d.b > 1e-4 ? clamp((d.a / d.b) * uAlturaMaxDaLuz, 0.5, uAlturaMaxDaLuz) : uAlturaDaLuz;
    vec3 L = normalize(vec3(dirXY, alturaDaLuz / max(uAlcance, 0.5)));

    float lambert = clamp(dot(N, L), 0.0, 1.0);
    float plano = L.z;
    float realce = lambert / max(plano, 0.25);

    ambiente = ambBase * mix(1.0, 0.75 + 0.25 * N.z, uRelevo);
    luzDireta = direta * mix(1.0, realce, uRelevo * peso);
  }

  float fatorAO = 0.0;
  if (uAO > 0.0001 && c.a > 0.001) {
    float h0 = amostraAltura(vec2(0.0, 0.0));
    float rCurto = max(1.0, 0.25 / uPassoEmMetros);
    float rLongo = max(2.0, 0.70 / uPassoEmMetros);
    float aoCurto = anelAO(h0, rCurto, 1.0, 0.0);
    float aoLongo = anelAO(h0, rLongo, 0.92387953, 0.38268343);
    float ao = (aoCurto * 2.0 + aoLongo * 1.0) / 24.0;
    fatorAO = uAO * smoothstep(0.0, 0.6, ao);
  }

  vec3 cor = clamp(base * (ambiente * (1.0 - fatorAO) + luzDireta * (1.0 - 0.5 * fatorAO)), 0.0, 1.0);
  finalColor = vec4(cor * c.a, c.a);
}`;

export class FiltroDeComposicaoDeLuz extends Filter {
  private readonly luz: MapaDeLuz;
  private readonly altura: CenaDeAltura | undefined;
  private readonly mundoIluminado: Container | undefined;
  private readonly grupo: UniformGroup;
  private readonly textureMatrix: TextureMatrix;
  private readonly alturaTextureMatrix: TextureMatrix;
  private readonly alturaSprite: Sprite;
  private relevo = RELEVO_PADRAO;
  private ao = AO_PADRAO;

  constructor(luz: MapaDeLuz, altura?: CenaDeAltura, mundoIluminado?: Container) {
    const grupo = new UniformGroup({
      uLuzMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
      uAlturaMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
      uEscala: { value: 1, type: 'f32' },
      uModoDirecao: { value: 0, type: 'f32' },
      uModoAltura: { value: 0, type: 'f32' },
      uAmbiente: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
      uAlturaTexel: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
      uPassoEmMetros: { value: 0, type: 'f32' },
      uAlturaMaxima: { value: ALTURA_MAXIMA, type: 'f32' },
      uForca: { value: FORCA_RELEVO_PADRAO, type: 'f32' },
      uRelevo: { value: RELEVO_PADRAO, type: 'f32' },
      uAO: { value: AO_PADRAO, type: 'f32' },
      uAlturaDaLuz: { value: ALTURA_DA_LUZ, type: 'f32' },
      uAlcance: { value: 6, type: 'f32' },
      uAlturaMaxDaLuz: { value: ALTURA_MAXIMA_DA_LUZ, type: 'f32' },
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

  definirRelevo(v: number): void {
    this.relevo = Math.min(1, Math.max(0, Number.isFinite(v) ? v : RELEVO_PADRAO));
  }

  definirAO(v: number): void {
    this.ao = Math.min(1, Math.max(0, Number.isFinite(v) ? v : AO_PADRAO));
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
      uAmbiente: Float32Array;
      uAlturaTexel: Float32Array;
      uPassoEmMetros: number;
      uAlturaMaxima: number;
      uForca: number;
      uRelevo: number;
      uAO: number;
      uAlturaDaLuz: number;
      uAlcance: number;
      uAlturaMaxDaLuz: number;
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
      uniforms.uAlturaTexel[0] = 1 / Math.max(1, texAlt.source.pixelWidth);
      uniforms.uAlturaTexel[1] = 1 / Math.max(1, texAlt.source.pixelHeight);
      uniforms.uPassoEmMetros = this.altura.metrosPorTexel;
    } else {
      uniforms.uAlturaMatriz.identity();
      this.resources.uAltura = Texture.EMPTY.source;
      uniforms.uAlturaTexel[0] = 0;
      uniforms.uAlturaTexel[1] = 0;
      uniforms.uPassoEmMetros = 0;
    }
    const amb = this.luz.ambiente;
    uniforms.uAmbiente[0] = amb[0];
    uniforms.uAmbiente[1] = amb[1];
    uniforms.uAmbiente[2] = amb[2];
    uniforms.uAlturaMaxima = ALTURA_MAXIMA;
    uniforms.uForca = FORCA_RELEVO_PADRAO;
    uniforms.uAlturaDaLuz = ALTURA_DA_LUZ;
    uniforms.uAlcance = this.luz.alcance;
    uniforms.uAlturaMaxDaLuz = ALTURA_MAXIMA_DA_LUZ;
    uniforms.uRelevo = altPronta && dirPronta ? this.relevo : 0;
    uniforms.uAO = altPronta ? this.ao : 0;
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

/** Filtro em tela cheia (Ilustrado) que compõe a cena com o mapa de luz em HDR (ou 8 bits escalado) e realce por relevo. */
export function criarFiltroDeComposicaoDeLuz(luz: MapaDeLuz, altura?: CenaDeAltura, mundoIluminado?: Container): FiltroDeComposicaoDeLuz {
  return new FiltroDeComposicaoDeLuz(luz, altura, mundoIluminado);
}
