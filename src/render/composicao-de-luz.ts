import { Container, GlProgram, Matrix, Mesh, RenderTexture, Shader, Sprite, Texture, TextureMatrix, UniformGroup, type Renderer } from 'pixi.js';
import { AO_PADRAO, EXPOSICAO_PADRAO, RELEVO_PADRAO } from '../domain/mapa.ts';
import { ALTURA_MAXIMA } from '../procedural/altura.ts';
import { criarBloom, type PassoDeBloom } from './bloom.ts';
import type { CenaDeAltura } from './cena-de-altura.ts';
import { ALTURA_DA_LUZ, ALTURA_MAXIMA_DA_LUZ } from './luzes.ts';
import { formatoDaLuz, type FormatoDeLuz, type MapaDeLuz } from './mapa-de-luz.ts';
import { atualizarTransformDoMundo, criarQuadUnitario } from './passadas.ts';

/** Força do relevo na normal. Com 3, um só nível do mapa de 8 bits (≈ 1,6 cm) já virava uma rampa visível; juntas e biséis têm dezenas de níveis. */
export const FORCA_RELEVO_PADRAO = 1.2;
export const RAIO_AO_CURTO = 0.25;
export const RAIO_AO_LONGO = 0.7;
export const PESO_AO_CURTO = 2;
export const PESO_AO_LONGO = 1;
export const EMISSAO_PADRAO = 3;

export type Vetor3 = readonly [number, number, number];
export type AmostraAO = number | { readonly h: number; readonly peso?: number };

/**
 * Espelho puro do realce direcional usado pela composição de luz com relevo:
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

/**
 * Espelho puro da penumbra periférica estilo Darkwood aplicada fora do cone de visão:
 * com `visivel = 1` preserva a cor exata; com `visivel = 0` dessatura em 82% com tom frio azulado e reduz o brilho para 58%.
 */
export function aplicarPenumbraDarkwood(cor: readonly [number, number, number], visivel: number): [number, number, number] {
  const v = Math.min(1, Math.max(0, visivel));
  const [r, g, b] = cor;
  if (v >= 1) return [r, g, b];
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (a: number, c: number, t: number) => a + (c - a) * t;
  const sr = mix(r, luma * 0.76, 0.82) * 0.58;
  const sg = mix(g, luma * 0.84, 0.82) * 0.58;
  const sb = mix(b, luma * 0.96, 0.82) * 0.58;
  return [mix(sr, r, v), mix(sg, g, v), mix(sb, b, v)];
}

let ultimoSearchModo: string | null = null;
let ultimoModoCache: 'direcao' | 'altura' | null = null;

/** Lê o modo de depuração da luz na query string (`?luz=direcao` ou `?luz=altura`). */
export function modoDeDepuracaoDaLuz(search?: string): 'direcao' | 'altura' | null {
  const s = search ?? (typeof location !== 'undefined' ? location.search : '');
  if (!s) return null;
  if (search === undefined && s === ultimoSearchModo) return ultimoModoCache;
  let resultado: 'direcao' | 'altura' | null = null;
  try {
    const modo = new URLSearchParams(s).get('luz');
    resultado = modo === 'direcao' || modo === 'altura' ? modo : null;
  } catch {
    resultado = null;
  }
  if (search === undefined) {
    ultimoSearchModo = s;
    ultimoModoCache = resultado;
  }
  return resultado;
}

const vertex = `in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
out vec2 vLuzCoord;
out vec2 vMundoPos;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform mat3 uLuzMatriz;
uniform mat3 uMundoMatriz;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vLuzCoord = (uLuzMatriz * vec3(aUV, 1.0)).xy;
  vMundoPos = (uMundoMatriz * vec3(aUV, 1.0)).xy;
}`;

// Sem arrays constantes: o Pixi pode compilar para GLSL ES 1.00. Os uniformes compartilhados com o vértice são highp.
const fragment = `in vec2 vUV;
in vec2 vLuzCoord;
in vec2 vMundoPos;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uLuz;
uniform sampler2D uDirecao;
uniform sampler2D uAltura;
uniform sampler2D uMascaraInterior;
uniform sampler2D uVisivel;
uniform float uEscala;
uniform float uEscalaHdr;
uniform float uModoDirecao;
uniform float uModoAltura;
uniform float uDarkwood;
uniform vec2 uDarkwoodBounds;
uniform vec3 uAmbiente;
uniform vec3 uAmbienteInterior;
uniform vec2 uAlturaTexel;
uniform float uPassoEmMetros;
uniform float uAlturaMaxima;
uniform float uForca;
uniform float uRelevo;
uniform float uAO;
uniform float uAlturaDaLuz;
uniform float uAlcance;
uniform float uAlturaMaxDaLuz;
uniform float uEmissao;
uniform highp float uTempo;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float ruido1D(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash21(vec2(i, 0.0)), hash21(vec2(i + 1.0, 0.0)), f);
}

float ruido2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float amostraAltura(vec2 offset) {
  return texture(uAltura, vUV + offset * uAlturaTexel).r * uAlturaMaxima;
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

vec3 aplicarDarkwood(vec3 cor) {
  if (uDarkwood <= 0.5) return cor;
  vec2 uvVis = clamp(vMundoPos / max(uDarkwoodBounds, vec2(0.001)), vec2(0.0), vec2(1.0));
  float vis = clamp(texture(uVisivel, uvVis).a, 0.0, 1.0);
  float luma = dot(cor, vec3(0.299, 0.587, 0.114));
  vec3 sombrio = mix(cor, vec3(luma * 0.76, luma * 0.84, luma * 0.96), 0.82) * 0.58;
  return mix(sombrio, cor, vis);
}

void main() {
  vec4 c = texture(uTexture, vUV);
  vec4 alt = texture(uAltura, vUV);
  if (uModoAltura > 0.5) {
    finalColor = vec4((vec3(alt.r) * c.a) / uEscalaHdr, c.a);
    return;
  }
  if (uModoDirecao > 0.5) {
    vec4 d = texture(uDirecao, vLuzCoord);
    vec2 xy = d.rg - 0.5 * d.b;
    float m = length(xy);
    vec2 dir = m > 1e-4 ? xy / m : vec2(0.0);
    float peso = smoothstep(0.001, 0.02, d.b * uEscala);
    vec3 vis = mix(vec3(0.0), vec3(dir * 0.5 + 0.5, 0.5), peso);
    finalColor = vec4((vis * c.a) / uEscalaHdr, c.a);
    return;
  }

  vec3 base = c.a > 0.0 ? c.rgb / c.a : vec3(0.0);
  float dentro = texture(uMascaraInterior, vLuzCoord).r;
  vec3 ambBase = mix(uAmbiente, uAmbienteInterior, dentro);
  vec3 direta = max(texture(uLuz, vLuzCoord).rgb * uEscala, vec3(0.0));
  float emissao = uPassoEmMetros > 0.0 ? alt.g : 0.0;
  float cint = 1.0;
  if (emissao > 0.0001 && uTempo > 0.0) {
    cint = 0.85 + 0.15 * ruido1D(uTempo * 7.0 + ruido2D(vMundoPos / 0.5) * 17.0);
  }
  vec3 luzEmissiva = base * emissao * uEmissao * cint;

  if (uPassoEmMetros <= 0.0 || (uRelevo <= 0.0001 && uAO <= 0.0001)) {
    vec3 cor = aplicarDarkwood(max(base * (ambBase + direta) + luzEmissiva, vec3(0.0)));
    finalColor = vec4((cor * c.a) / uEscalaHdr, c.a);
    return;
  }

  vec3 ambiente = ambBase;
  vec3 luzDireta = direta;

  if (uRelevo > 0.0001) {
    // Normal por Sobel 3x3 em metros (Y cresce para baixo no mundo/tela).
    // O passo do Sobel tem no mínimo 3 cm no mundo: o mapa de altura tem 8 bits (1 nível ≈ 1,6 cm), e com 1 texel de tela
    // no zoom alto cada nível virava uma rampa de 45° e o relevo desenhava curvas de nível.
    float k = max(1.0, 0.03 / max(uPassoEmMetros, 1e-5));
    float hTL = amostraAltura(vec2(-k, -k));
    float hT  = amostraAltura(vec2( 0.0, -k));
    float hTR = amostraAltura(vec2( k, -k));
    float hL  = amostraAltura(vec2(-k,  0.0));
    float hR  = amostraAltura(vec2( k,  0.0));
    float hBL = amostraAltura(vec2(-k,  k));
    float hB  = amostraAltura(vec2( 0.0,  k));
    float hBR = amostraAltura(vec2( k,  k));
    float gx = (hTR + 2.0 * hR + hBR) - (hTL + 2.0 * hL + hBL);
    float gy = (hBL + 2.0 * hB + hBR) - (hTL + 2.0 * hT + hTR);
    vec3 N = normalize(vec3(-gx * uForca, -gy * uForca, 8.0 * k * uPassoEmMetros));

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
    // A luz não sobe acima de si: o topo de uma muralha mais alta que a tocha fica no escuro (a face voltada para ela, não).
    float hSup = amostraAltura(vec2(0.0, 0.0)) - 0.5 * uAlturaMaxima;
    luzDireta *= 1.0 - 0.85 * peso * uRelevo * smoothstep(alturaDaLuz - 0.3, alturaDaLuz + 0.5, hSup);
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

  vec3 cor = aplicarDarkwood(max(base * (ambiente * (1.0 - fatorAO) + luzDireta * (1.0 - 0.5 * fatorAO)) + luzEmissiva, vec3(0.0)));
  finalColor = vec4((cor * c.a) / uEscalaHdr, c.a);
}`;

export interface ComposicaoDeLuz {
  /** Sprite em tela cheia posicionado no espaço do mundo com a cena iluminada + bloom. */
  readonly sprite: Sprite;
  readonly pronta: boolean;
  definirRelevo(v: number): void;
  definirAO(v: number): void;
  definirGlow(v: number): void;
  definirExposicao(v: number): void;
  definirDarkwood(ativo: boolean, mascara: Texture | null, bounds: { width: number; height: number } | null): void;
  /** Renderiza `mundoIluminado` em `corRT`, compõe luz/relevo/AO/emissão em `hdrRT`, aplica bloom e escreve `saidaRT`. */
  atualizar(mundoIluminado: Container, ativo: boolean, tempoSeg: number): void;
  destruir(): void;
}

/**
 * Composição em tela cheia (Ilustrado): renderiza `mundoIluminado` em `corRT`, compõe em `hdrRT`
 * (luz HDR, direção, relevo, AO e emissão cintilante) e aplica bloom em `saidaRT`.
 */
export function criarComposicaoDeLuz(renderer: Renderer, luz: MapaDeLuz, altura: CenaDeAltura): ComposicaoDeLuz {
  const quad = criarQuadUnitario();
  const grupo = new UniformGroup({
    uLuzMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
    uMundoMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
    uEscala: { value: 1, type: 'f32' },
    uEscalaHdr: { value: 1, type: 'f32' },
    uModoDirecao: { value: 0, type: 'f32' },
    uModoAltura: { value: 0, type: 'f32' },
    uDarkwood: { value: 0, type: 'f32' },
    uDarkwoodBounds: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
    uAmbiente: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    uAmbienteInterior: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    uAlturaTexel: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uPassoEmMetros: { value: 0, type: 'f32' },
    uAlturaMaxima: { value: ALTURA_MAXIMA, type: 'f32' },
    uForca: { value: FORCA_RELEVO_PADRAO, type: 'f32' },
    uRelevo: { value: RELEVO_PADRAO, type: 'f32' },
    uAO: { value: AO_PADRAO, type: 'f32' },
    uAlturaDaLuz: { value: ALTURA_DA_LUZ, type: 'f32' },
    uAlcance: { value: 6, type: 'f32' },
    uAlturaMaxDaLuz: { value: ALTURA_MAXIMA_DA_LUZ, type: 'f32' },
    uEmissao: { value: EMISSAO_PADRAO, type: 'f32' },
    uTempo: { value: 0, type: 'f32' },
  });
  const prog = GlProgram.from({ vertex, fragment, preferredFragmentPrecision: 'highp', name: 'atlas-composicao-de-luz' });
  const shader = new Shader({
    glProgram: prog,
    resources: {
      composicao: grupo,
      uTexture: Texture.EMPTY.source,
      uLuz: Texture.EMPTY.source,
      uDirecao: Texture.EMPTY.source,
      uAltura: Texture.EMPTY.source,
      uMascaraInterior: Texture.EMPTY.source,
      uVisivel: Texture.EMPTY.source,
    },
  });
  const mesh = new Mesh({ geometry: quad, shader });
  const bloom: PassoDeBloom = criarBloom();
  const sprite = new Sprite(Texture.EMPTY);
  sprite.visible = false;

  const textureMatrix = new TextureMatrix(Texture.WHITE);
  const camAtual = new Matrix();
  const camInv = new Matrix();
  const spInv = new Matrix();

  let corRT: RenderTexture | null = null;
  let hdrRT: RenderTexture | null = null;
  let saidaRT: RenderTexture | null = null;
  let largura = 0;
  let alturaTela = 0;
  let resolucao = 0;
  let formatoAtivo: FormatoDeLuz = 'rgba8unorm';
  let escalaHdrAtiva = 1;
  let relevo = RELEVO_PADRAO;
  let ao = AO_PADRAO;
  let glow = 0;
  let exposicao = EXPOSICAO_PADRAO;
  let darkwoodAtivo = false;
  let darkwoodMascara: Texture | null = null;
  let darkwoodLargura = 1;
  let darkwoodAltura = 1;
  let pronta = false;
  let destruida = false;

  function dimensionar(): void {
    const w = Math.max(1, Math.round(renderer.screen.width));
    const h = Math.max(1, Math.round(renderer.screen.height));
    const r = renderer.resolution || 1;
    const { formato, escala } = formatoDaLuz(renderer);
    if (corRT && hdrRT && saidaRT && w === largura && h === alturaTela && r === resolucao && formato === formatoAtivo) return;

    corRT?.destroy(true);
    hdrRT?.destroy(true);
    saidaRT?.destroy(true);
    corRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
    hdrRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear', format: formato });
    saidaRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
    sprite.texture = saidaRT;
    mesh.scale.set(w, h);
    largura = w;
    alturaTela = h;
    resolucao = r;
    formatoAtivo = formato;
    escalaHdrAtiva = escala;
  }

  return {
    sprite,
    get pronta() {
      return pronta && Boolean(saidaRT);
    },
    definirRelevo(v) {
      relevo = Math.min(1, Math.max(0, Number.isFinite(v) ? v : RELEVO_PADRAO));
    },
    definirAO(v) {
      ao = Math.min(1, Math.max(0, Number.isFinite(v) ? v : AO_PADRAO));
    },
    definirGlow(v) {
      glow = Math.max(0, Number.isFinite(v) ? v : 0);
    },
    definirExposicao(v) {
      exposicao = Math.min(4, Math.max(0, Number.isFinite(v) ? v : EXPOSICAO_PADRAO));
    },
    definirDarkwood(ativo, mascara, bounds) {
      darkwoodAtivo = ativo;
      darkwoodMascara = mascara;
      darkwoodLargura = bounds && bounds.width > 0 ? bounds.width : 1;
      darkwoodAltura = bounds && bounds.height > 0 ? bounds.height : 1;
    },
    atualizar(mundoIluminado, ativo, tempoSeg) {
      if (destruida) return;
      if (!ativo) {
        sprite.visible = false;
        mundoIluminado.renderable = true;
        return;
      }

      dimensionar();
      if (!corRT || !hdrRT || !saidaRT) return;

      atualizarTransformDoMundo(mundoIluminado, camAtual);
      camInv.copyFrom(camAtual).invert();

      const prevRenderable = mundoIluminado.renderable;
      mundoIluminado.renderable = true;
      renderer.render({ container: mundoIluminado, target: corRT, transform: camAtual, clear: true, clearColor: [0, 0, 0, 0] });
      mundoIluminado.renderable = prevRenderable;

      const u = grupo.uniforms as {
        uLuzMatriz: Matrix;
        uMundoMatriz: Matrix;
        uEscala: number;
        uEscalaHdr: number;
        uModoDirecao: number;
        uModoAltura: number;
        uDarkwood: number;
        uDarkwoodBounds: Float32Array;
        uAmbiente: Float32Array;
        uAmbienteInterior: Float32Array;
        uAlturaTexel: Float32Array;
        uPassoEmMetros: number;
        uAlturaMaxima: number;
        uForca: number;
        uRelevo: number;
        uAO: number;
        uAlturaDaLuz: number;
        uAlcance: number;
        uAlturaMaxDaLuz: number;
        uEmissao: number;
        uTempo: number;
      };

      u.uMundoMatriz.set(largura, 0, 0, alturaTela, 0, 0).prepend(camInv);

      const sp = luz.sprite;
      const tex = sp.texture;
      const luzPronta = Boolean(tex && !tex.destroyed && tex.source && !tex.source.destroyed && tex !== Texture.EMPTY);
      if (luzPronta) {
        textureMatrix.texture = tex;
        sp.updateLocalTransform();
        spInv.copyFrom(sp.localTransform).invert();
        u.uLuzMatriz
          .copyFrom(u.uMundoMatriz)
          .prepend(spInv)
          .scale(1 / Math.max(1, tex.orig.width), 1 / Math.max(1, tex.orig.height))
          .translate(sp.anchor.x, sp.anchor.y)
          .prepend(textureMatrix.mapCoord);
        u.uEscala = luz.escala;
        shader.resources.uLuz = tex.source;
      } else {
        u.uLuzMatriz.identity();
        u.uEscala = 1;
        shader.resources.uLuz = Texture.EMPTY.source;
      }

      const mascInt = luz.mascaraInterior;
      const mascIntPronta = Boolean(luzPronta && mascInt && !mascInt.destroyed && mascInt.source && !mascInt.source.destroyed && mascInt !== Texture.EMPTY);
      shader.resources.uMascaraInterior = mascIntPronta ? mascInt.source : Texture.EMPTY.source;

      const dir = luz.direcao;
      const dirPronta = Boolean(dir && !dir.destroyed && dir.source && !dir.source.destroyed && dir !== Texture.EMPTY);
      shader.resources.uDirecao = dirPronta ? dir.source : Texture.EMPTY.source;

      const texAlt = altura.textura;
      const altPronta = Boolean(texAlt && !texAlt.destroyed && texAlt.source && !texAlt.source.destroyed && texAlt !== Texture.EMPTY);
      if (altPronta && texAlt) {
        shader.resources.uAltura = texAlt.source;
        u.uAlturaTexel[0] = 1 / Math.max(1, texAlt.source.pixelWidth);
        u.uAlturaTexel[1] = 1 / Math.max(1, texAlt.source.pixelHeight);
        u.uPassoEmMetros = altura.metrosPorTexel;
      } else {
        shader.resources.uAltura = Texture.EMPTY.source;
        u.uAlturaTexel[0] = 0;
        u.uAlturaTexel[1] = 0;
        u.uPassoEmMetros = 0;
      }

      const amb = luz.ambiente;
      u.uAmbiente[0] = amb[0];
      u.uAmbiente[1] = amb[1];
      u.uAmbiente[2] = amb[2];
      const ambInt = luz.ambienteInterior;
      u.uAmbienteInterior[0] = ambInt[0];
      u.uAmbienteInterior[1] = ambInt[1];
      u.uAmbienteInterior[2] = ambInt[2];
      u.uEscalaHdr = escalaHdrAtiva;
      u.uAlturaMaxima = ALTURA_MAXIMA;
      u.uForca = FORCA_RELEVO_PADRAO;
      u.uAlturaDaLuz = ALTURA_DA_LUZ;
      u.uAlcance = luz.alcance;
      u.uAlturaMaxDaLuz = ALTURA_MAXIMA_DA_LUZ;
      u.uEmissao = EMISSAO_PADRAO;
      u.uTempo = tempoSeg;
      u.uRelevo = altPronta && dirPronta ? relevo : 0;
      u.uAO = altPronta ? ao : 0;
      const modo = modoDeDepuracaoDaLuz();
      u.uModoDirecao = modo === 'direcao' ? 1 : 0;
      u.uModoAltura = modo === 'altura' ? 1 : 0;

      const visPronta = Boolean(
        darkwoodAtivo &&
        darkwoodMascara &&
        !darkwoodMascara.destroyed &&
        darkwoodMascara.source &&
        !darkwoodMascara.source.destroyed &&
        darkwoodMascara !== Texture.EMPTY,
      );
      if (visPronta && darkwoodMascara) {
        u.uDarkwood = 1;
        u.uDarkwoodBounds[0] = darkwoodLargura;
        u.uDarkwoodBounds[1] = darkwoodAltura;
        shader.resources.uVisivel = darkwoodMascara.source;
      } else {
        u.uDarkwood = 0;
        u.uDarkwoodBounds[0] = 1;
        u.uDarkwoodBounds[1] = 1;
        shader.resources.uVisivel = Texture.EMPTY.source;
      }

      shader.resources.uTexture = corRT.source;
      renderer.render({ container: mesh, target: hdrRT, clear: true, clearColor: [0, 0, 0, 0] });

      const pxPorMetro = Math.hypot(camAtual.a, camAtual.b);
      bloom.processar(renderer, hdrRT, {
        saidaRT,
        glow: modo ? 0 : glow,
        pxPorMetro,
        escalaHdr: escalaHdrAtiva,
        formato: formatoAtivo,
        exposure: exposicao,
        curvaDeTom: !modo,
      });

      sprite.setFromMatrix(camInv);
      sprite.visible = true;
      mundoIluminado.renderable = false;
      pronta = true;
    },
    destruir() {
      destruida = true;
      pronta = false;
      corRT?.destroy(true);
      hdrRT?.destroy(true);
      saidaRT?.destroy(true);
      corRT = null;
      hdrRT = null;
      saidaRT = null;
      bloom.destruir();
      textureMatrix.destroy();
      mesh.destroy();
      shader.destroy(false);
      prog.destroy();
      quad.destroy(true);
      sprite.destroy();
    },
  };
}
