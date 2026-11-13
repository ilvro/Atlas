import { Container, Graphics, Sprite, Texture, UniformGroup } from 'pixi.js';
import type { MapaAtlas } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { criarFiltroDeMundo } from './filtro-de-mundo.ts';
import { desenharComodos } from './mascara-de-comodos.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO, NEBLINA_DENTRO, alfaDaNeblina } from './particulas-config.ts';

export interface Neblina {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  definirLigado(ligado: boolean): void;
  destruir(): void;
}

// fbm de 2 oitavas, deslocado pelo tempo e pelo vento. Sem arrays constantes (GLSL ES 1.00); uniformes compartilhados com o vértice em highp.
const fragment = `in vec2 vTextureCoord;
in vec2 vMundoUv;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform highp vec2 uTamanho;
uniform highp vec2 uDeslocamento;
uniform highp float uTempo;
uniform vec3 uCor;
uniform float uAlfa;
uniform float uPixel;
uniform float uPpm;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }
float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
void main() {
  // No Pixel o ruído é medido em blocos de 2 × 2 pixels do Pixel e a densidade cai em 3 níveis, com limiar de Bayer 4 × 4.
  bool pixel = uPixel > 0.5;
  vec2 mundo = vMundoUv * uTamanho;
  if (pixel) mundo = (floor(mundo * uPpm / 2.0) * 2.0 + 1.0) / uPpm;
  vec2 p = mundo * 0.16;
  // Cada oitava gira o domínio: o ruído de valor é alinhado à grade, e sem isso a névoa sai quadriculada.
  mat2 giro = mat2(0.8, -0.6, 0.6, 0.8);
  vec2 q = giro * p * 2.1 - uDeslocamento * 0.3 + vec2(7.3, 1.9) + vec2(uTempo * 0.012);
  vec2 r = giro * giro * p * 4.4 + uDeslocamento * 0.45 + vec2(2.7, 9.1);
  float n = ruido(p + uDeslocamento * 0.18) * 0.5 + ruido(q) * 0.3 + ruido(r) * 0.2;
  float densidade = smoothstep(0.22, 0.82, n);
  float a = (0.18 + 0.82 * densidade) * uAlfa;
  if (pixel) a = clamp(floor(densidade * 3.0 + bayer(floor(gl_FragCoord.xy)) + 0.5) / 3.0, 0.0, 1.0) * uAlfa;
  finalColor = vec4(uCor * a, a);
}`;

/**
 * Neblina rasteira: um véu do tamanho do mapa, com ruído que anda devagar e o vento empurra. Cobre o terreno inteiro;
 * dentro dos cômodos vale metade (a neblina entra pouco em casa). A cor vem do ambiente, então à noite ela é escura.
 */
export function criarNeblina(): Neblina {
  const criarGrupo = (alfa: number) => new UniformGroup({
    uTamanho: { value: new Float32Array([1, 1]), type: 'vec2<f32>' }, uDeslocamento: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uTempo: { value: 0, type: 'f32' }, uPixel: { value: 0, type: 'f32' }, uPpm: { value: 1, type: 'f32' }, uCor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    uAlfa: { value: alfa, type: 'f32' },
  });
  const grupoFora = criarGrupo(0), grupoDentro = criarGrupo(0);
  const veu = (grupo: UniformGroup) => { const s = new Sprite(Texture.WHITE); s.filters = [criarFiltroDeMundo(s, { fragment, nome: 'atlas-neblina', recursos: { neblina: grupo } })]; return s; };
  const raiz = new Container(), fora = new Container(), dentro = new Container(), veuFora = veu(grupoFora), veuDentro = veu(grupoDentro);
  const mascaraFora = new Graphics(), mascaraDentro = new Graphics();
  fora.addChild(veuFora, mascaraFora); dentro.addChild(veuDentro, mascaraDentro);
  fora.setMask({ mask: mascaraFora, inverse: true }); dentro.mask = mascaraDentro; dentro.alpha = NEBLINA_DENTRO;
  raiz.addChild(fora, dentro); raiz.visible = false;

  let mapa: MapaAtlas | null = null, tempo = 0, desloc: [number, number] = [0, 0], ligado = true, destruido = false;

  return {
    raiz,
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      for (const g of [grupoFora, grupoDentro]) {
        const u = g.uniforms as Record<string, unknown>;
        u.uPixel = m.style.renderer === 'pixel' ? 1 : 0;
        u.uPpm = m.style.pixel.pixelsPerCell / m.grid.size;
      }
      if (campo('bounds')) {
        for (const s of [veuFora, veuDentro]) { s.width = m.bounds.width; s.height = m.bounds.height; }
        const tam = new Float32Array([m.bounds.width, m.bounds.height]);
        for (const g of [grupoFora, grupoDentro]) (g.uniforms as Record<string, unknown>).uTamanho = tam;
      }
      if (col('rooms') || campo('grid')) { desenharComodos(mascaraFora, m); desenharComodos(mascaraDentro, m); }
      if (campo('climate')) {
        const f = m.climate.weather.fog, a = m.climate.ambient, bruto = [1, 3, 5].map(i => parseInt(a.color.slice(i, i + 2), 16) / 255 * a.intensity);
        // A névoa é clara, mas iluminada pelo ambiente: de noite fica escura, de dia, quase branca.
        const cor = new Float32Array(bruto.map(v => Math.min(1, 0.07 + v * 0.9)));
        const alfa = alfaDaNeblina(f);
        for (const g of [grupoFora, grupoDentro]) (g.uniforms as Record<string, unknown>).uCor = cor;
        (grupoFora.uniforms as Record<string, unknown>).uAlfa = alfa;
        (grupoDentro.uniforms as Record<string, unknown>).uAlfa = alfa * NEBLINA_DENTRO;
        raiz.alpha = alfa; raiz.visible = ligado && f > 0.001;
      }
    },
    quadro(dt) {
      if (destruido || !ligado || !raiz.visible || !mapa) return;
      const passo = Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1), vento = mapa.climate.weather.wind;
      tempo += passo; desloc = [desloc[0] + (0.18 + vento * 0.7) * passo, desloc[1] + 0.05 * passo];
      const arr = new Float32Array(desloc);
      for (const g of [grupoFora, grupoDentro]) {
        const u = g.uniforms as Record<string, unknown>;
        u.uTempo = tempo;
        u.uDeslocamento = arr;
      }
    },
    definirLigado(v) { ligado = v; raiz.visible = v && (mapa?.climate.weather.fog ?? 0) > 0.001; },
    destruir() { destruido = true; raiz.destroy({ children: true }); },
  };
}
