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

// Mesma deformação regional do retrato vivo da Vigília (Dossiê): base fixa, peito expande, ombros/cabeça sobem e tronco balança.
const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform float uLift;
uniform float uExpand;
uniform float uHead;
uniform float uSway;
void main() {
  vec2 uv = vTextureCoord * uInputSize.xy / uOutputFrame.zw;
  float v = uv.y;
  float body = smoothstep(1.0, 0.5, v);
  float chest = exp(-pow((v - 0.56) / 0.2, 2.0));
  float head = smoothstep(0.45, 0.2, v);
  vec2 src = uv;
  src.y += uLift * body + uHead * head;
  src.x = 0.5 + (src.x - 0.5) / (1.0 + uExpand * chest);
  src.x += uSway * smoothstep(1.0, 0.15, v);
  if (src.x < 0.0 || src.x > 1.0 || src.y < 0.0 || src.y > 1.0) {
    finalColor = vec4(0.0);
    return;
  }
  vec2 tc = src * (uOutputFrame.zw * uInputSize.zw);
  finalColor = texture(uTexture, tc);
}`;

let programaCompartilhado: GlProgram | null = null;
function obterPrograma(): GlProgram {
  return (programaCompartilhado ??= GlProgram.from({
    vertex,
    fragment,
    preferredFragmentPrecision: 'highp',
    name: 'atlas-respiracao-token',
  }));
}

/** Curva de respiração da Vigília: inspira em ~42% do ciclo e expira nos 58% restantes, com easing senoidal. */
export function curvaDeRespiracao(fase: number): number {
  const p = ((fase % 1) + 1) % 1;
  const ease = (t: number) => 0.5 - 0.5 * Math.cos(Math.PI * t);
  return p < 0.42 ? ease(p / 0.42) : 1 - ease((p - 0.42) / 0.58);
}

export interface ParametrosRespiracao {
  period: number;
  amp: number;
  tremor: number;
}

/** Calcula os uniformes de respiração para um instante `t` (segundos) e deslocamento de fase `semente`. */
export function calcularRespiracao(t: number, semente: number, p: ParametrosRespiracao): {
  lift: number;
  expand: number;
  head: number;
  sway: number;
} {
  const fase = (t + semente) / p.period;
  const b = curvaDeRespiracao(fase);
  const headB = curvaDeRespiracao(fase + 0.94);
  const ts = t + semente * 1.37;
  const sway = Math.sin(ts * 0.65) * 0.6 + Math.sin(ts * 1.03 + 1.7) * 0.4;
  const tremor = p.tremor * (Math.sin(ts * 37) * 0.5 + Math.sin(ts * 23.3) * 0.5);
  return {
    lift: 0.026 * p.amp * b,
    expand: 0.065 * p.amp * b,
    head: 0.008 * p.amp * headB,
    sway: 0.0055 * sway + 0.003 * tremor,
  };
}

/** Filtro de respiração sutil para tokens imersivos (sem estilo de círculo). */
export function criarFiltroDeRespiracao(): {
  filtro: Filter;
  atualizar(t: number, semente: number, params: ParametrosRespiracao): void;
} {
  const grupo = new UniformGroup({
    uLift: { value: 0, type: 'f32' },
    uExpand: { value: 0, type: 'f32' },
    uHead: { value: 0, type: 'f32' },
    uSway: { value: 0, type: 'f32' },
  });
  const filtro = new Filter({
    glProgram: obterPrograma(),
    resources: { respiracao: grupo },
  });
  return {
    filtro,
    atualizar(t, semente, params) {
      const r = calcularRespiracao(t, semente, params);
      const u = grupo.uniforms as Record<string, number>;
      u.uLift = r.lift;
      u.uExpand = r.expand;
      u.uHead = r.head;
      u.uSway = r.sway;
    },
  };
}
