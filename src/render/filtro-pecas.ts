import { Texture, UniformGroup, type Filter, type Sprite } from 'pixi.js';
import { criarFiltroDeMundo } from './filtro-de-mundo.ts';

/**
 * Curva suave de visibilidade na sombra (espelho puro do GLSL `smoothstep(0.035, 0.16, luma)`):
 * na escuridão completa (`luma <= 0.035`) a parte da criatura some (`0`);
 * a partir de `0.16` fica totalmente visível (`1`), com transição orgânica na penumbra.
 */
export function alfaDaSombraNaPeca(luma: number): number {
  const t = Math.min(1, Math.max(0, (luma - 0.035) / (0.16 - 0.035)));
  return t * t * (3 - 2 * t);
}

const fragment = `in vec2 vTextureCoord;
in vec2 vMundoUv;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uLuz;
uniform sampler2D uMascaraInterior;
uniform sampler2D uVisivel;
uniform highp vec2 uTamanho;
uniform vec3 uAmbiente;
uniform vec3 uAmbienteInterior;
uniform float uEscalaLuz;
uniform float uPiso;
uniform float uUsarVisao;
uniform float uRecortarSombra;

void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  if (c.a <= 0.001) {
    finalColor = vec4(0.0);
    return;
  }
  vec2 uv = clamp(vMundoUv, vec2(0.0), vec2(1.0));
  float dentro = texture(uMascaraInterior, uv).r;
  vec3 ambBase = mix(uAmbiente, uAmbienteInterior, dentro);

  // Amostra a luz direta no pixel e suaviza com vizinhos curtos (0,20 m) para compensar o oclusor central do próprio token.
  vec2 passo = vec2(0.20) / max(uTamanho, vec2(1.0));
  vec3 d0 = max(texture(uLuz, uv).rgb * uEscalaLuz, vec3(0.0));
  vec3 d1 = max(texture(uLuz, clamp(uv + vec2(passo.x, 0.0), vec2(0.0), vec2(1.0))).rgb * uEscalaLuz, vec3(0.0));
  vec3 d2 = max(texture(uLuz, clamp(uv - vec2(passo.x, 0.0), vec2(0.0), vec2(1.0))).rgb * uEscalaLuz, vec3(0.0));
  vec3 d3 = max(texture(uLuz, clamp(uv + vec2(0.0, passo.y), vec2(0.0), vec2(1.0))).rgb * uEscalaLuz, vec3(0.0));
  vec3 d4 = max(texture(uLuz, clamp(uv - vec2(0.0, passo.y), vec2(0.0), vec2(1.0))).rgb * uEscalaLuz, vec3(0.0));
  vec3 dViz = max(max(d1, d2), max(d3, d4));
  vec3 direta = mix(d0, max(d0, dViz), 0.45);

  vec3 luzTotal = ambBase + direta;
  vec3 iluminacao = max(vec3(uPiso), min(vec3(1.15), luzTotal));

  float vis = 1.0;
  if (uUsarVisao > 0.5) {
    vis = clamp(texture(uVisivel, uv).a, 0.0, 1.0);
  }

  float alfaSombra = 1.0;
  if (uRecortarSombra > 0.5) {
    float luma = max(max(luzTotal.r, luzTotal.g), luzTotal.b);
    alfaSombra = smoothstep(0.035, 0.16, luma);
  }

  float alfaFinal = c.a * vis * alfaSombra;
  if (alfaFinal <= 0.001) {
    finalColor = vec4(0.0);
    return;
  }
  vec3 corBase = c.rgb / c.a;
  vec3 corFinal = min(vec3(1.0), corBase * iluminacao);
  finalColor = vec4(corFinal * alfaFinal, alfaFinal);
}`;

export interface ParametrosFiltroPecas {
  largura: number;
  altura: number;
  luz: Texture;
  mascaraInterior: Texture;
  visivel: Texture;
  escalaLuz: number;
  ambiente: readonly [number, number, number];
  ambienteInterior: readonly [number, number, number];
  piso: number;
  usarVisao: boolean;
  recortarSombra: boolean;
}

export interface FiltroDePecas {
  readonly filtro: Filter;
  atualizar(p: ParametrosFiltroPecas): void;
  destruir(): void;
}

/**
 * Filtro de mundo aplicado sobre as peças no modo Ilustrado:
 * ilumina cada pixel do token pela luz real do mapa naquele ponto e, na vista dos jogadores,
 * recorta criaturas pixel a pixel pela linha de visão e pela escuridão (só a parte iluminada aparece).
 */
export function criarFiltroDePecas(spriteRef: Sprite): FiltroDePecas {
  const tamanho = new Float32Array([1, 1]);
  const amb = new Float32Array([1, 1, 1]);
  const ambInt = new Float32Array([1, 1, 1]);
  const grupo = new UniformGroup({
    uTamanho: { value: tamanho, type: 'vec2<f32>' },
    uAmbiente: { value: amb, type: 'vec3<f32>' },
    uAmbienteInterior: { value: ambInt, type: 'vec3<f32>' },
    uEscalaLuz: { value: 1, type: 'f32' },
    uPiso: { value: 0.28, type: 'f32' },
    uUsarVisao: { value: 0, type: 'f32' },
    uRecortarSombra: { value: 0, type: 'f32' },
  });

  const filtro = criarFiltroDeMundo(spriteRef, {
    fragment,
    nome: 'atlas-pecas-luz',
    recursos: {
      pecasLuz: grupo,
      uLuz: Texture.EMPTY.source,
      uMascaraInterior: Texture.EMPTY.source,
      uVisivel: Texture.WHITE.source,
    },
  });

  return {
    filtro,
    atualizar(p) {
      tamanho[0] = Math.max(1, p.largura);
      tamanho[1] = Math.max(1, p.altura);
      amb[0] = p.ambiente[0]; amb[1] = p.ambiente[1]; amb[2] = p.ambiente[2];
      ambInt[0] = p.ambienteInterior[0]; ambInt[1] = p.ambienteInterior[1]; ambInt[2] = p.ambienteInterior[2];
      const u = grupo.uniforms as Record<string, unknown>;
      u.uEscalaLuz = p.escalaLuz;
      u.uPiso = p.piso;
      u.uUsarVisao = p.usarVisao ? 1 : 0;
      u.uRecortarSombra = p.recortarSombra ? 1 : 0;
      const res = filtro.resources as Record<string, unknown>;
      const texLuz = p.luz !== Texture.EMPTY ? p.luz.source : Texture.EMPTY.source;
      const texInt = p.mascaraInterior !== Texture.EMPTY ? p.mascaraInterior.source : Texture.EMPTY.source;
      const texVis = p.visivel !== Texture.EMPTY ? p.visivel.source : Texture.WHITE.source;
      if (res.uLuz !== texLuz) res.uLuz = texLuz;
      if (res.uMascaraInterior !== texInt) res.uMascaraInterior = texInt;
      if (res.uVisivel !== texVis) res.uVisivel = texVis;
    },
    destruir() {
      filtro.destroy();
    },
  };
}
