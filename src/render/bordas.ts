import { Container, Sprite, Texture, UniformGroup } from 'pixi.js';
import type { MapaAtlas } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { criarFiltroDeMundo } from './filtro-de-mundo.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO } from './particulas-config.ts';

export interface Bordas {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  definirLigado(ligado: boolean): void;
  destruir(): void;
}

/** Quanto do menor lado do mapa a faixa de borda ocupa com `amount` em 1. */
export const LARGURA_DA_BORDA = 0.25;
/** A largura da faixa em metros: `amount × 0,25 × min(w, h)`. */
export const larguraDaBorda = (amount: number, w: number, h: number): number => Math.min(1, Math.max(0, amount)) * LARGURA_DA_BORDA * Math.min(w, h);

const TIPO: Record<'none' | 'clouds' | 'dark' | 'fog', number> = { none: 0, clouds: 1, dark: 2, fog: 3 };

// fbm de 3 oitavas (cada uma gira o domínio, como na neblina). `uTipo`: 1 nuvens, 2 escuro, 3 neblina.
const fragment = `in vec2 vTextureCoord;
in vec2 vMundoUv;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec2 uTamanho;
uniform highp vec2 uDeslocamento;
uniform highp float uTempo;
uniform highp float uLargura;
uniform float uTipo;
uniform vec3 uCor;
uniform float uPixel;
uniform float uPpm;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }
float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
float fbm(vec2 p) {
  mat2 giro = mat2(0.8, -0.6, 0.6, 0.8);
  float v = ruido(p) * 0.55; p = giro * p * 2.03 + vec2(5.2, 1.3);
  v += ruido(p) * 0.3; p = giro * p * 2.07 + vec2(9.1, 4.7);
  return v + ruido(p) * 0.15;
}
float distanciaAoBorda(vec2 m) { return min(min(m.x, m.y), min(uTamanho.x - m.x, uTamanho.y - m.y)); }
void main() {
  bool pixel = uPixel > 0.5;
  vec2 mundo = vMundoUv * uTamanho;
  if (pixel) mundo = (floor(mundo * uPpm / 2.0) * 2.0 + 1.0) / uPpm;
  float L = max(uLargura, 0.001);
  // Escuro: frente quebrada e parada. Nuvens e neblina: o ruído anda com o vento e o tempo.
  bool parado = uTipo > 1.5 && uTipo < 2.5;
  vec2 mov = parado ? vec2(0.0) : uDeslocamento * 0.5 + vec2(uTempo * 0.01, 0.0);
  vec2 p = mundo * (parado ? 0.22 : 0.14) + mov;
  float n = fbm(p);
  float d = distanciaAoBorda(mundo);
  float frente = d + (n - 0.5) * L * 1.1;
  float a = 1.0 - smoothstep(0.0, L, frente);
  vec3 cor = uCor;
  float alfa = a;
  if (uTipo < 1.5) {
    // Nuvens: o topo (luz de noroeste) é claro, a base cinza-azulada; o miolo da faixa é mais denso que o fim dela.
    vec2 luz = normalize(vec2(-0.6, -0.8));
    float n2 = fbm(p + luz * 0.35);
    float relevo = clamp(0.5 + (n2 - n) * 4.0 + (a - 0.5) * 0.5, 0.0, 1.0);
    vec3 sombra = uCor * vec3(0.76, 0.81, 0.92);
    vec3 nuvem = mix(sombra, min(uCor * 1.15 + 0.06, vec3(1.0)), relevo);
    float aa = smoothstep(0.0, 0.7, a);
    // Sombra suave da nuvem, projetada para dentro do mapa.
    float sa = (1.0 - smoothstep(0.0, L, frente - L * 0.22)) * 0.22;
    alfa = aa + sa * (1.0 - aa);
    cor = (nuvem * aa + vec3(0.05, 0.06, 0.1) * sa * (1.0 - aa)) / max(alfa, 0.001);
  } else if (uTipo < 2.5) {
    // Escuro: preto, borda mais seca que a neblina.
    alfa = 1.0 - smoothstep(L * 0.1, L * 0.55, frente);
    cor = vec3(0.0);
  } else {
    alfa = a * 0.9;
  }
  if (pixel) alfa = clamp(floor(alfa * 3.0 + bayer(floor(gl_FragCoord.xy)) + 0.5) / 3.0, 0.0, 1.0);
  finalColor = vec4(cor * alfa, alfa);
}`;

/**
 * Bordas do mapa: um véu do tamanho do mapa que fecha as beiradas com nuvens, escuridão ou neblina (`finish.edges`).
 * Fica acima das partículas e abaixo das peças: faz parte do mundo, e no projetor aparece igual.
 */
export function criarBordas(): Bordas {
  const grupo = new UniformGroup({
    uTamanho: { value: new Float32Array([1, 1]), type: 'vec2<f32>' }, uDeslocamento: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uTempo: { value: 0, type: 'f32' }, uLargura: { value: 1, type: 'f32' }, uTipo: { value: 0, type: 'f32' },
    uPixel: { value: 0, type: 'f32' }, uPpm: { value: 1, type: 'f32' }, uCor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
  });
  const veu = new Sprite(Texture.WHITE);
  veu.filters = [criarFiltroDeMundo(veu, { fragment, nome: 'atlas-bordas', recursos: { bordas: grupo } })];
  const raiz = new Container(); raiz.addChild(veu); raiz.visible = false;

  let mapa: MapaAtlas | null = null, tempo = 0, desloc: [number, number] = [0, 0], ligado = true, ativo = false, destruido = false;
  const u = () => grupo.uniforms as Record<string, unknown>;

  return {
    raiz,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      if (campo('style', 'grid')) { u().uPixel = m.style.renderer === 'pixel' ? 1 : 0; u().uPpm = m.style.pixel.pixelsPerCell / m.grid.size; }
      if (campo('bounds')) { veu.width = m.bounds.width; veu.height = m.bounds.height; u().uTamanho = new Float32Array([m.bounds.width, m.bounds.height]); }
      if (campo('bounds', 'climate', 'finish')) {
        const e = m.finish.edges, a = m.climate.ambient, bruto = [1, 3, 5].map(i => parseInt(a.color.slice(i, i + 2), 16) / 255 * a.intensity);
        u().uTipo = TIPO[e.kind]; u().uLargura = larguraDaBorda(e.amount, m.bounds.width, m.bounds.height);
        // Iluminada pelo ambiente, como a neblina: de dia a nuvem é quase branca, de noite fica escura.
        u().uCor = new Float32Array(bruto.map(v => Math.min(1, 0.1 + v * 0.95)));
        ativo = e.kind !== 'none' && e.amount > 0.001; raiz.visible = ligado && ativo;
      }
    },
    quadro(dt) {
      if (destruido || !ligado || !raiz.visible || !mapa) return;
      const passo = Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1), vento = mapa.climate.weather.wind;
      tempo += passo; desloc = [desloc[0] + (0.1 + vento * 0.5) * passo, desloc[1] + 0.03 * passo];
      u().uTempo = tempo; u().uDeslocamento = new Float32Array(desloc);
    },
    definirLigado(v) { ligado = v; raiz.visible = v && ativo; },
    destruir() { destruido = true; raiz.destroy({ children: true }); },
  };
}
