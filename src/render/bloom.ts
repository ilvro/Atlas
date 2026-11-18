import { Geometry, GlProgram, Mesh, RenderTexture, Shader, Texture, UniformGroup, type Renderer } from 'pixi.js';
import type { FormatoDeLuz } from './mapa-de-luz.ts';

/** Limiar acima do qual a cor HDR entra no bloom (`max(cor - 0.9, 0)`). */
export const LIMIAR_BLOOM = 0.9;
/** Raio (m) da passada estreita de bloom. */
export const RAIO_BLOOM_CURTO = 0.5;
/** Raio (m) da passada larga de bloom. */
export const RAIO_BLOOM_LONGO = 2.0;

/** Extração pura do limiar de bloom (`max(cor - 0.9, 0)` por canal). */
export function limiarDoBloom(cor: readonly [number, number, number], limiar = LIMIAR_BLOOM): [number, number, number] {
  return [
    Math.max(0, cor[0] - limiar),
    Math.max(0, cor[1] - limiar),
    Math.max(0, cor[2] - limiar),
  ];
}

export interface PassoDeBloom {
  processar(
    renderer: Renderer,
    hdrRT: RenderTexture,
    op: { saidaRT: RenderTexture; glow: number; pxPorMetro: number; escalaHdr: number; formato: FormatoDeLuz },
  ): void;
  destruir(): void;
}

const vertexQuad = `in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}`;

const fragmentExtrair = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec2 uTexel;
uniform float uEscalaHdr;
uniform float uLimiar;
vec3 extrair(vec2 uv) {
  vec3 c = texture(uTexture, clamp(uv, vec2(0.0), vec2(1.0))).rgb * uEscalaHdr;
  return max(c - uLimiar, vec3(0.0));
}
void main() {
  vec3 soma = (
    extrair(vUV + vec2(-uTexel.x, -uTexel.y)) +
    extrair(vUV + vec2( uTexel.x, -uTexel.y)) +
    extrair(vUV + vec2(-uTexel.x,  uTexel.y)) +
    extrair(vUV + vec2( uTexel.x,  uTexel.y))
  ) * 0.25;
  finalColor = vec4(soma / uEscalaHdr, 1.0);
}`;

// Blur gaussiano separável (9 amostras, pesos somando 1.0) feito direto em RenderTextures para preservar HDR.
const fragmentBlur = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec2 uPasso;
uniform vec4 uLimites;
vec4 amostra(float k) {
  return texture(uTexture, clamp(vUV + uPasso * k, uLimites.xy, uLimites.zw));
}
void main() {
  vec4 soma = amostra(0.0) * 0.202362;
  soma += (amostra(-1.0) + amostra(1.0)) * 0.179044;
  soma += (amostra(-2.0) + amostra(2.0)) * 0.124009;
  soma += (amostra(-3.0) + amostra(3.0)) * 0.067234;
  soma += (amostra(-4.0) + amostra(4.0)) * 0.028532;
  finalColor = soma;
}`;

const fragmentCombinar = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uHdr;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform float uEscalaHdr;
uniform float uGlow;
void main() {
  vec4 h = texture(uHdr, vUV);
  vec3 hdr = h.rgb * uEscalaHdr;
  if (uGlow <= 0.0001) {
    finalColor = vec4(clamp(hdr, 0.0, 1.0), h.a);
    return;
  }
  vec3 b1 = texture(uBloom1, vUV).rgb * uEscalaHdr;
  vec3 b2 = texture(uBloom2, vUV).rgb * uEscalaHdr;
  vec3 bloom = (b1 * 0.6 + b2 * 0.4) * uGlow;
  vec3 cor = clamp(hdr + bloom, 0.0, 1.0);
  float a = clamp(h.a + max(bloom.r, max(bloom.g, bloom.b)), 0.0, 1.0);
  finalColor = vec4(cor, a);
}`;

/**
 * Bloom em duas escalas (0,5 m e 2 m) sobre a textura HDR antes da curva de tom.
 * Usa apenas passadas manuais com `Mesh` + `RenderTexture` no formato da luz (sem `BlurFilter` / `filters`).
 */
export function criarBloom(): PassoDeBloom {
  const quad = new Geometry({
    attributes: {
      aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });

  const progExtrair = GlProgram.from({ vertex: vertexQuad, fragment: fragmentExtrair, preferredFragmentPrecision: 'highp', name: 'atlas-bloom-extrair' });
  const progBlur = GlProgram.from({ vertex: vertexQuad, fragment: fragmentBlur, preferredFragmentPrecision: 'highp', name: 'atlas-bloom-blur' });
  const progCombinar = GlProgram.from({ vertex: vertexQuad, fragment: fragmentCombinar, preferredFragmentPrecision: 'highp', name: 'atlas-bloom-combinar' });

  const extrairGrupo = new UniformGroup({
    uTexel: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uEscalaHdr: { value: 1, type: 'f32' },
    uLimiar: { value: LIMIAR_BLOOM, type: 'f32' },
  });
  const blurGrupo = new UniformGroup({
    uPasso: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uLimites: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' },
  });
  const combinarGrupo = new UniformGroup({
    uEscalaHdr: { value: 1, type: 'f32' },
    uGlow: { value: 0, type: 'f32' },
  });

  const extrairShader = new Shader({ glProgram: progExtrair, resources: { uTexture: Texture.EMPTY.source, extrair: extrairGrupo } });
  const blurShader = new Shader({ glProgram: progBlur, resources: { uTexture: Texture.EMPTY.source, blur: blurGrupo } });
  const combinarShader = new Shader({
    glProgram: progCombinar,
    resources: {
      uHdr: Texture.EMPTY.source,
      uBloom1: Texture.EMPTY.source,
      uBloom2: Texture.EMPTY.source,
      combinar: combinarGrupo,
    },
  });

  const extrairMesh = new Mesh({ geometry: quad, shader: extrairShader });
  const blurMesh = new Mesh({ geometry: quad, shader: blurShader });
  const combinarMesh = new Mesh({ geometry: quad, shader: combinarShader });

  let bloom1RT: RenderTexture | null = null;
  let temp1RT: RenderTexture | null = null;
  let bloom2RT: RenderTexture | null = null;
  let temp2RT: RenderTexture | null = null;
  let largura = 0;
  let altura = 0;
  let resolucao = 0;
  let formatoAtivo: FormatoDeLuz | null = null;
  let destruido = false;

  function dimensionar(w: number, h: number, r: number, formato: FormatoDeLuz): void {
    if (bloom1RT && w === largura && h === altura && r === resolucao && formato === formatoAtivo) return;
    bloom1RT?.destroy(true);
    temp1RT?.destroy(true);
    bloom2RT?.destroy(true);
    temp2RT?.destroy(true);
    const bw1 = Math.max(1, Math.round(w / 4));
    const bh1 = Math.max(1, Math.round(h / 4));
    const bw2 = Math.max(1, Math.round(w / 8));
    const bh2 = Math.max(1, Math.round(h / 8));
    bloom1RT = RenderTexture.create({ width: bw1, height: bh1, resolution: r, scaleMode: 'linear', format: formato });
    temp1RT = RenderTexture.create({ width: bw1, height: bh1, resolution: r, scaleMode: 'linear', format: formato });
    bloom2RT = RenderTexture.create({ width: bw2, height: bh2, resolution: r, scaleMode: 'linear', format: formato });
    temp2RT = RenderTexture.create({ width: bw2, height: bh2, resolution: r, scaleMode: 'linear', format: formato });
    largura = w;
    altura = h;
    resolucao = r;
    formatoAtivo = formato;
  }

  function limitesDe(rt: RenderTexture): [number, number, number, number] {
    const pw = Math.max(1, rt.source.pixelWidth);
    const ph = Math.max(1, rt.source.pixelHeight);
    return [0.5 / pw, 0.5 / ph, 1 - 0.5 / pw, 1 - 0.5 / ph];
  }

  function desfocar(renderer: Renderer, origem: RenderTexture, alvo: RenderTexture, passoX: number, passoY: number): void {
    const u = blurGrupo.uniforms as { uPasso: Float32Array; uLimites: Float32Array };
    const lim = limitesDe(origem);
    blurShader.resources.uTexture = origem.source;
    u.uPasso[0] = passoX;
    u.uPasso[1] = passoY;
    u.uLimites[0] = lim[0];
    u.uLimites[1] = lim[1];
    u.uLimites[2] = lim[2];
    u.uLimites[3] = lim[3];
    blurMesh.scale.set(alvo.width, alvo.height);
    renderer.render({ container: blurMesh, target: alvo, clear: true, clearColor: [0, 0, 0, 0] });
  }

  return {
    processar(renderer, hdrRT, op) {
      if (destruido) return;
      const w = hdrRT.width;
      const h = hdrRT.height;
      const r = hdrRT.source.resolution || 1;
      const glow = Math.max(0, Number.isFinite(op.glow) ? op.glow : 0);
      const escalaHdr = Math.max(1, op.escalaHdr);
      const cu = combinarGrupo.uniforms as { uEscalaHdr: number; uGlow: number };
      cu.uEscalaHdr = escalaHdr;
      cu.uGlow = glow;
      combinarShader.resources.uHdr = hdrRT.source;

      if (glow > 0.0001) {
        dimensionar(w, h, r, op.formato);
        if (bloom1RT && temp1RT && bloom2RT && temp2RT) {
          const eu = extrairGrupo.uniforms as { uTexel: Float32Array; uEscalaHdr: number; uLimiar: number };
          eu.uTexel[0] = 1 / Math.max(1, hdrRT.source.pixelWidth);
          eu.uTexel[1] = 1 / Math.max(1, hdrRT.source.pixelHeight);
          eu.uEscalaHdr = escalaHdr;
          eu.uLimiar = LIMIAR_BLOOM;
          extrairShader.resources.uTexture = hdrRT.source;
          extrairMesh.scale.set(bloom1RT.width, bloom1RT.height);
          renderer.render({ container: extrairMesh, target: bloom1RT, clear: true, clearColor: [0, 0, 0, 0] });

          const ppm = op.pxPorMetro > 0 ? op.pxPorMetro : 20;
          const passo1X = (RAIO_BLOOM_CURTO * ppm) / (4 * Math.max(1, w));
          const passo1Y = (RAIO_BLOOM_CURTO * ppm) / (4 * Math.max(1, h));
          desfocar(renderer, bloom1RT, temp1RT, passo1X, 0);
          desfocar(renderer, temp1RT, bloom1RT, 0, passo1Y);

          const passo2X = (RAIO_BLOOM_LONGO * ppm) / (4 * Math.max(1, w));
          const passo2Y = (RAIO_BLOOM_LONGO * ppm) / (4 * Math.max(1, h));
          desfocar(renderer, bloom1RT, temp2RT, passo2X, 0);
          desfocar(renderer, temp2RT, bloom2RT, 0, passo2Y);

          combinarShader.resources.uBloom1 = bloom1RT.source;
          combinarShader.resources.uBloom2 = bloom2RT.source;
        }
      } else {
        combinarShader.resources.uBloom1 = Texture.EMPTY.source;
        combinarShader.resources.uBloom2 = Texture.EMPTY.source;
      }

      combinarMesh.scale.set(op.saidaRT.width, op.saidaRT.height);
      renderer.render({ container: combinarMesh, target: op.saidaRT, clear: true, clearColor: [0, 0, 0, 0] });
    },
    destruir() {
      destruido = true;
      bloom1RT?.destroy(true);
      temp1RT?.destroy(true);
      bloom2RT?.destroy(true);
      temp2RT?.destroy(true);
      bloom1RT = null;
      temp1RT = null;
      bloom2RT = null;
      temp2RT = null;
      extrairMesh.destroy();
      blurMesh.destroy();
      combinarMesh.destroy();
      extrairShader.destroy(false);
      blurShader.destroy(false);
      combinarShader.destroy(false);
      progExtrair.destroy();
      progBlur.destroy();
      progCombinar.destroy();
      quad.destroy(true);
    },
  };
}
