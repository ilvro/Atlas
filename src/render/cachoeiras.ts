import { Container, Geometry, GlProgram, Mesh, Shader, UniformGroup } from 'pixi.js';
import type { MapaAtlas, Objeto } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO } from './particulas-config.ts';

export interface RenderDeCachoeiras {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas): void;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  /** Quantas cachoeiras animadas estão ativas (para testes). */
  contagem(): number;
  destruir(): void;
}

const vertex = `in vec2 aPosition;
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

// Listras de água descendo no eixo da queda (+y), névoa local no pé e anéis de espuma se espalhando na água de baixo.
// No Pixel tudo é medido em pixels inteiros do Pixel e o ciclo tem 4 quadros discretos.
const fragment = `in vec2 vUV;
out vec4 finalColor;
uniform highp float uLargura;
uniform highp float uQueda;
uniform highp float uTempo;
uniform float uSemente;
uniform float uEscala;
uniform float uPixel;
uniform float uPpm;
uniform vec3 uAgua;
uniform vec3 uEspuma;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }

void main() {
  bool pixel = uPixel > 0.5;
  float ppm = max(1.0, uPpm * uEscala);
  vec2 p = pixel ? (floor(vUV * ppm) + 0.5) / ppm : vUV;
  float b = pixel ? bayer(floor(vUV * ppm)) : 0.0;
  // No Pixel: 4 quadros discretos por ciclo (~1,1 s).
  float t = pixel ? floor(fract(uTempo * 0.9) * 4.0) / 4.0 : uTempo;

  float nx = p.x / (uLargura * 0.5);
  float ny = (p.y + uQueda * 0.5) / uQueda;

  // 1. Listras de água descendo entre as rochas laterais
  float bordaX = 0.66 + 0.05 * sin(ny * 5.0 + uSemente);
  float mascaraQueda = (1.0 - smoothstep(bordaX - 0.16, bordaX + 0.04, abs(nx)))
                     * smoothstep(0.02, 0.12, ny)
                     * (1.0 - smoothstep(0.88, 1.06, ny));
  vec2 q1 = vec2(p.x * 3.8 + uSemente * 0.7, p.y * 1.15 - t * 3.2);
  vec2 q2 = vec2(p.x * 7.4 - uSemente * 1.3, p.y * 1.9 - t * 4.8 + 5.3);
  float r1 = ruido(q1) * 0.6 + ruido(q2) * 0.4;
  float r2 = ruido(vec2(p.x * 11.0 + 2.1, p.y * 2.4 - t * 6.4));
  float crista = exp(-pow((ny - 0.1) / 0.09, 2.0)) * 0.35;
  float peForte = smoothstep(0.62, 0.96, ny) * 0.32;
  float listras = clamp((smoothstep(0.28, 0.76, r1 + crista + peForte) * 0.75 + smoothstep(0.54, 0.84, r2) * 0.45) * mascaraQueda, 0.0, 1.0);

  // 2. Névoa local no pé da queda
  vec2 dNevoa = vec2(p.x / (uLargura * 0.58), (p.y - uQueda * 0.42) / (uQueda * 0.3));
  float rNevoa = length(dNevoa);
  float nNevoa = ruido(vec2(p.x * 1.5 + t * 0.8 + uSemente, p.y * 1.5 - t * 0.6)) * 0.6
               + ruido(vec2(p.x * 3.0 - t * 0.6, p.y * 3.0 + t * 0.8 + 3.7)) * 0.4;
  float nevoa = (1.0 - smoothstep(0.12, 1.0, rNevoa)) * (0.45 + 0.55 * nNevoa) * 0.68;

  // 3. Espuma que se espalha em arcos na água de baixo
  vec2 dPool = vec2(p.x / (uLargura * 0.62), (p.y - uQueda * 0.38) / (uQueda * 0.62));
  float dist = length(vec2(dPool.x * 0.85, max(0.0, dPool.y)));
  float nEspuma = ruido(vec2(p.x * 2.4 + uSemente, p.y * 2.4 - t * 1.4)) * 0.65
                + ruido(vec2(p.x * 5.2 - uSemente, p.y * 5.2 - t * 2.1)) * 0.35;
  float deform = (nEspuma - 0.5) * 0.18;
  float faseOnda = (dist + deform) * 3.4 - t * 1.8;
  float anelOnda = pow(max(0.0, cos(faseOnda * 6.2831853)), 3.5) * smoothstep(0.28, 0.65, nEspuma);
  float envEspuma = smoothstep(0.05, 0.20, dist) * (1.0 - smoothstep(0.45, 0.90, dist)) * smoothstep(-0.04, 0.12, dPool.y);
  float coroa = (1.0 - smoothstep(0.06, 0.44, dist)) * smoothstep(-0.08, 0.08, dPool.y)
              * (0.45 + 0.55 * smoothstep(0.25, 0.68, nEspuma));
  float espumaBaixo = clamp(anelOnda * envEspuma * 0.92 + coroa * 0.86, 0.0, 1.0);

  if (pixel) {
    float forte = step(0.56 + b * 0.14, max(listras, espumaBaixo));
    float meio = step(0.32 + b * 0.18, max(max(listras, espumaBaixo), nevoa * 0.9));
    float a = max(forte, meio * 0.85);
    vec3 cor = forte > 0.5 ? uEspuma : uAgua;
    finalColor = vec4(cor * a, a);
    return;
  }

  float brilhoEspuma = smoothstep(0.52, 0.86, listras) * 0.85 + espumaBaixo * 0.92 + nevoa * 0.68;
  float corpoAgua = listras * 0.75 + espumaBaixo * 0.5 + nevoa * 0.4;
  float alfa = clamp(max(listras * 0.9, max(espumaBaixo * 0.85, nevoa)), 0.0, 1.0);
  vec3 cor = mix(uAgua, uEspuma, clamp(brilhoEspuma / max(corpoAgua + 0.001, 0.35), 0.0, 1.0));
  finalColor = vec4(cor * alfa, alfa);
}`;

const programa = () => GlProgram.from({ vertex, fragment, preferredFragmentPrecision: 'highp', name: 'atlas-cachoeira' });

interface Desenho {
  mesh: Mesh<Geometry, Shader>;
  grupo: UniformGroup;
  largura: number;
  queda: number;
}

const ehCachoeira = (o: Objeto): boolean =>
  o.elevation !== 'underwater' && ACERVO.item(ACERVO.idDaFonte(o.source))?.animacao === 'cachoeira';

export function criarCachoeiras(): RenderDeCachoeiras {
  const raiz = new Container();
  const desenhos = new Map<string, Desenho>();
  let tempo = 0, destruido = false, prog: GlProgram | null = null;

  function apagar(d: Desenho): void {
    d.mesh.destroy(true);
  }

  function criar(largura: number, queda: number): Desenho {
    const x0 = -largura * 0.95, x1 = largura * 0.95;
    const y0 = -queda * 0.52, y1 = queda * 1.25;
    const coords = new Float32Array([x0, y0, x1, y0, x1, y1, x0, y1]);
    const geometria = new Geometry({
      attributes: { aPosition: coords, aUV: new Float32Array(coords) },
      indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
    });
    const grupo = new UniformGroup({
      uLargura: { value: largura, type: 'f32' },
      uQueda: { value: queda, type: 'f32' },
      uTempo: { value: tempo, type: 'f32' },
      uSemente: { value: 0, type: 'f32' },
      uEscala: { value: 1, type: 'f32' },
      uPixel: { value: 0, type: 'f32' },
      uPpm: { value: 1, type: 'f32' },
      uAgua: { value: new Float32Array([0.48, 0.76, 0.86]), type: 'vec3<f32>' },
      uEspuma: { value: new Float32Array([0.93, 0.98, 1.0]), type: 'vec3<f32>' },
    });
    prog ??= programa();
    const shader = new Shader({ glProgram: prog, resources: { cachoeira: grupo } });
    const mesh = new Mesh({ geometry: geometria, shader });
    raiz.addChild(mesh);
    return { mesh, grupo, largura, queda };
  }

  return {
    raiz,
    sincronizar(m) {
      if (destruido) return;
      const pixel = m.style.renderer === 'pixel' ? 1 : 0;
      const ppm = m.style.pixel.pixelsPerCell / m.grid.size;
      const ativos = new Set<string>();
      for (const o of Object.values(m.props)) {
        if (!ehCachoeira(o)) continue;
        ativos.add(o.id);
        const [largura, queda] = ACERVO.pegadaDaFonte(o.source);
        let d = desenhos.get(o.id);
        if (d && (d.largura !== largura || d.queda !== queda)) {
          apagar(d);
          desenhos.delete(o.id);
          d = undefined;
        }
        if (!d) {
          d = criar(largura, queda);
          desenhos.set(o.id, d);
        }
        d.mesh.position.set(o.position[0], o.position[1]);
        d.mesh.rotation = o.rotation;
        d.mesh.scale.set(o.scale);
        const semente = o.source.kind === 'recipe' ? (o.source.seed % 1000) : 1;
        const u = d.grupo.uniforms as Record<string, unknown>;
        u.uLargura = largura;
        u.uQueda = queda;
        u.uSemente = semente;
        u.uEscala = o.scale;
        u.uPixel = pixel;
        u.uPpm = ppm;
      }
      for (const [id, d] of desenhos) {
        if (!ativos.has(id)) {
          apagar(d);
          desenhos.delete(id);
        }
      }
    },
    quadro(dt) {
      if (destruido || !desenhos.size) return;
      tempo += Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1);
      for (const d of desenhos.values()) (d.grupo.uniforms as Record<string, unknown>).uTempo = tempo;
    },
    contagem: () => desenhos.size,
    destruir() {
      destruido = true;
      for (const d of desenhos.values()) apagar(d);
      desenhos.clear();
      raiz.destroy({ children: true });
    },
  };
}
