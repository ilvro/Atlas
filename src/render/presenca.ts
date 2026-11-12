import { Container, Geometry, GlProgram, Mesh, Shader, Texture, UniformGroup } from 'pixi.js';
import type { MapaAtlas, Presenca } from '../domain/mapa.ts';
import { pincelDePresenca } from '../domain/presets.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { orientacaoDominante } from '../procedural/orientacao.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO } from './particulas-config.ts';

export interface RenderDePresenca {
  /** Presenças sob a água (sob a superfície): entram antes da água. */
  readonly submerso: Container;
  /** Presenças naturais: entram antes do mapa de luz, que as escurece como ao resto. */
  readonly abaixo: Container;
  /** Presenças que brilham (sobrenaturais): ficam acima da luz. */
  readonly acima: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  /** Quantas presenças estão desenhadas (para testes). */
  contagem(): number;
  /** Quantas presenças submersas estão desenhadas (para testes). */
  contagemSubmersas(): number;
  destruir(): void;
}

// Malha própria (e não um filtro): o filtro recorta ao que está na tela e o ruído nadaria ao mexer a câmera; aqui o ruído é do mundo.
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

// A máscara (1 px por célula, ampliada em linear) é desfocada por quatro amostras; o ruído fbm decide até onde a mancha chegou
// (`uIntensidade`: 0 recolhe, 1 vai até a máscara inteira). Sem arrays constantes (GLSL ES 1.00).
const fragment = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec2 uOrigem;
uniform highp vec2 uTamanho;
uniform highp vec2 uCelula;
uniform highp float uTempo;
uniform float uIntensidade;
uniform float uPulso;
uniform float uEscala;
uniform float uSemente;
uniform float uBrilha;
uniform float uGm;
uniform float uPixel;
uniform float uPpm;
uniform float uForma;
uniform float uAngulo;
uniform vec3 uCor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float massa(vec2 uv) { return texture(uTexture, uv).a; }
// Bayer 4×4 sem arrays (o Pixi compila também para GLSL ES 1.00).
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }
void main() {
  bool pixel = uPixel > 0.5;
  // No Pixel tudo é medido em pixels do Pixel: a coordenada do mundo é arredondada ao pixel antes do ruído e da máscara.
  vec2 pos = pixel ? (floor((uOrigem + vUV * uTamanho) * uPpm) + 0.5) / uPpm : uOrigem + vUV * uTamanho;
  vec2 uv = (pos - uOrigem) / uTamanho;
  float b = pixel ? bayer(floor(pos * uPpm)) : 0.0;
  vec2 d = uCelula * 0.75;
  float m = (massa(uv) * 2.0 + massa(uv + vec2(d.x, 0.0)) + massa(uv - vec2(d.x, 0.0)) + massa(uv + vec2(0.0, d.y)) + massa(uv - vec2(0.0, d.y))) / 6.0;
  vec2 mundo = pos;
  float cA = cos(uAngulo), sA = sin(uAngulo);
  vec2 pRel = mundo - uOrigem;
  vec2 pRot = vec2(cA * pRel.x - sA * pRel.y, sA * pRel.x + cA * pRel.y);
  vec2 p = mundo * (1.4 / uEscala) + vec2(uSemente * 0.37, uSemente * 0.11);
  vec2 pLocal = pRot * (1.4 / uEscala) + vec2(uSemente * 0.37, uSemente * 0.11);
  mat2 giro = mat2(0.8, -0.6, 0.6, 0.8);

  float n = 0.0;
  if (uForma < 0.5) {
    n = ruido(p) * 0.55 + ruido(giro * p * 2.3 + uTempo * 0.05) * 0.3 + ruido(giro * giro * p * 5.1) * 0.15;
  } else if (uForma < 1.5) {
    // Manchas arrastadas (sangue seco): esticadas ao longo do ângulo
    vec2 pArr = vec2(pLocal.x * 0.32, pLocal.y * 3.2);
    n = ruido(pArr) * 0.55 + ruido(vec2(pArr.x * 0.5, pArr.y * 7.0) + 7.3) * 0.3 + ruido(giro * p * 1.5) * 0.15;
  } else {
    // Sulcos: trilhas paralelas (~1.4 a 1.5 m entre elas)
    float tremura = (ruido(vec2(pLocal.x * 0.6, pLocal.y * 0.2)) - 0.5) * 0.25;
    float rutCoord = (pRot.y + tremura) / 1.5;
    float faixa = abs(fract(rutCoord + 0.5) - 0.5) * 2.0;
    float trilha = smoothstep(0.42, 0.1, faixa);
    vec2 pSulco = vec2(pLocal.x * 0.3, pLocal.y * 2.2);
    n = trilha * 0.62 + ruido(pSulco) * 0.22 + ruido(p * 2.0) * 0.16;
  }

  float limiar = mix(0.95, 0.12, uIntensidade);
  float campo = m + (n - 0.5) * 0.9;
  float a = pixel ? step(limiar + 0.08 + b * 0.16, campo) * step(0.12 + b * 0.2, m) : smoothstep(limiar, limiar + 0.16, campo) * smoothstep(0.0, 0.3, m);
  // No Pixel a pulsação anda em degraus e o tom da mancha em três níveis.
  float fase = uTempo * uPulso * 2.4;
  float pulsa = 1.0 + uPulso * 0.35 * sin((pixel ? floor(fase * 2.0) / 2.0 : fase) + n * 6.2831);
  float tom = ruido(p * 3.7 + 11.0);
  if (uForma > 0.5 && uForma < 1.5) {
    tom = ruido(vec2(pLocal.x * 0.6, pLocal.y * 4.0) + 11.0);
  } else if (uForma > 1.5) {
    float tremura = (ruido(vec2(pLocal.x * 0.6, pLocal.y * 0.2)) - 0.5) * 0.25;
    float trilhaTom = smoothstep(0.42, 0.1, abs(fract(((pRot.y + tremura) / 1.5) + 0.5) - 0.5) * 2.0);
    tom = mix(0.3, 0.85, 1.0 - trilhaTom * 0.65) * (0.8 + 0.4 * ruido(p * 3.0));
  }
  vec3 cor = uCor * (0.62 + 0.55 * (pixel ? floor(tom * 3.0) / 3.0 : tom)) * pulsa;
  float halo = pixel ? step(0.5 + b * 0.5, smoothstep(0.0, 0.5, m) * 0.9) * 0.5 : smoothstep(0.0, 0.5, m);
  float brilho = uBrilha * 0.3 * halo * (1.0 - a) * pulsa * uIntensidade;
  float alfa = clamp(a * 0.92 + brilho, 0.0, 1.0);
  // Só o mestre vê: metade da força e hachuras.
  float risca = 0.55 + 0.45 * step(0.5, fract((mundo.x + mundo.y) * 3.0));
  alfa *= mix(1.0, 0.5 * risca, uGm);
  finalColor = vec4(cor * alfa, alfa);
}`;

const programa = () => GlProgram.from({ vertex, fragment, preferredFragmentPrecision: 'highp', name: 'atlas-presenca' });
const MARGEM = 2;     // células a mais em volta, para o desfoque e a borda irregular terem onde crescer

interface Desenho {
  mesh: Mesh<Geometry, Shader>; grupo: UniformGroup; textura: Texture; celulas: Presenca['cells']; resolucao: number; brilha: boolean; submerso: boolean;
}

export function criarPresenca(): RenderDePresenca {
  const submerso = new Container(), abaixo = new Container(), acima = new Container();
  const desenhos = new Map<string, Desenho>();
  let tempo = 0, destruido = false, prog: GlProgram | null = null;

  function apagar(d: Desenho): void { d.mesh.destroy(); d.textura.destroy(true); }

  function criar(p: Presenca, res: number, cols: number, lins: number): Desenho {
    // A caixa das células (mais a margem), em células do terreno.
    let x0 = cols, x1 = 0, y0 = lins, y1 = 0;
    for (const [y, xa, n] of p.cells) { if (y < y0) y0 = y; if (y + 1 > y1) y1 = y + 1; if (xa < x0) x0 = xa; if (xa + n > x1) x1 = xa + n; }
    x0 = Math.max(0, x0 - MARGEM); y0 = Math.max(0, y0 - MARGEM); x1 = Math.min(cols, x1 + MARGEM); y1 = Math.min(lins, y1 + MARGEM);
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!; g.fillStyle = '#fff';
    for (const [y, xa, n] of p.cells) g.fillRect(xa - x0, y - y0, n, 1);
    const textura = Texture.from(c); textura.source.scaleMode = 'linear'; textura.source.addressMode = 'clamp-to-edge';
    const [wx0, wy0, wx1, wy1] = [x0 * res, y0 * res, x1 * res, y1 * res];
    const geometria = new Geometry({ attributes: { aPosition: new Float32Array([wx0, wy0, wx1, wy0, wx1, wy1, wx0, wy1]), aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) }, indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]) });
    const grupo = new UniformGroup({
      uOrigem: { value: new Float32Array([wx0, wy0]), type: 'vec2<f32>' }, uTamanho: { value: new Float32Array([wx1 - wx0, wy1 - wy0]), type: 'vec2<f32>' },
      uCelula: { value: new Float32Array([1 / w, 1 / h]), type: 'vec2<f32>' }, uTempo: { value: 0, type: 'f32' }, uIntensidade: { value: 0.6, type: 'f32' },
      uPulso: { value: 0, type: 'f32' }, uPixel: { value: 0, type: 'f32' }, uPpm: { value: 1, type: 'f32' }, uEscala: { value: 1, type: 'f32' }, uSemente: { value: 0, type: 'f32' }, uBrilha: { value: 0, type: 'f32' }, uGm: { value: 0, type: 'f32' },
      uForma: { value: 0, type: 'f32' }, uAngulo: { value: 0, type: 'f32' },
      uCor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    });
    prog ??= programa();
    const shader = new Shader({ glProgram: prog, resources: { uTexture: textura.source, uSampler: textura.source.style, presenca: grupo } });
    const mesh = new Mesh({ geometry: geometria, shader });
    const pincel = pincelDePresenca(p.brush);
    const brilha = pincel?.brilho ?? false;
    const ehSubmerso = pincel?.submerso ?? false;
    (ehSubmerso ? submerso : brilha ? acima : abaixo).addChild(mesh);
    return { mesh, grupo, textura, celulas: p.cells, resolucao: res, brilha, submerso: ehSubmerso };
  }

  function atualizarUniformes(d: Desenho, p: Presenca, m: MapaAtlas): void {
    const b = pincelDePresenca(p.brush), n = hexParaNumero(b?.cor ?? '#ffffff'), u = d.grupo.uniforms as Record<string, unknown>;
    u.uCor = new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
    u.uIntensidade = p.intensity; u.uPulso = b?.pulso ?? 0; u.uEscala = b?.escala ?? 1; u.uBrilha = b?.brilho ? 1 : 0; u.uSemente = p.seed % 1000; u.uGm = p.gmOnly ? 1 : 0;
    const formaId = b?.forma === 'arrastado' ? 1 : b?.forma === 'sulcos' ? 2 : 0;
    u.uForma = formaId;
    const angulo = orientacaoDominante(p.cells);
    u.uAngulo = angulo !== 0 ? angulo : (formaId === 1 ? ((p.seed % 360) * Math.PI) / 180 : 0);
    const pixel = m.style.renderer === 'pixel'; u.uPixel = pixel ? 1 : 0; u.uPpm = m.style.pixel.pixelsPerCell / m.grid.size;
    const modo = pixel ? 'nearest' : 'linear'; if (d.textura.source.scaleMode !== modo) d.textura.source.scaleMode = modo;
  }

  return {
    submerso, abaixo, acima,
    sincronizar(m) {
      if (destruido) return;
      const res = m.terrain.resolution, cols = Math.ceil(m.bounds.width / res), lins = Math.ceil(m.bounds.height / res);
      for (const [id, d] of desenhos) if (!m.presence[id]) { apagar(d); desenhos.delete(id); }
      for (const p of Object.values(m.presence)) {
        let d = desenhos.get(p.id);
        const pincel = pincelDePresenca(p.brush);
        const brilha = pincel?.brilho ?? false;
        const ehSubmerso = pincel?.submerso ?? false;
        if (d && (d.celulas !== p.cells || d.resolucao !== res || d.brilha !== brilha || d.submerso !== ehSubmerso)) { apagar(d); desenhos.delete(p.id); d = undefined; }
        if (!d) { if (!p.cells.length) continue; d = criar(p, res, cols, lins); desenhos.set(p.id, d); }
        atualizarUniformes(d, p, m);
      }
    },
    quadro(dt) {
      if (destruido || !desenhos.size) return;
      tempo += Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1);
      for (const d of desenhos.values()) (d.grupo.uniforms as Record<string, unknown>).uTempo = tempo;
    },
    contagem: () => desenhos.size,
    contagemSubmersas: () => submerso.children.length,
    destruir() {
      destruido = true;
      for (const d of desenhos.values()) apagar(d);
      desenhos.clear();
      submerso.destroy({ children: true });
      abaixo.destroy({ children: true });
      acima.destroy({ children: true });
    },
  };
}
