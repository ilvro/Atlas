import { Container, Graphics, Sprite, Texture, UniformGroup, type Filter } from 'pixi.js';
import type { MapaAtlas } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { criarFiltroDeMundo } from './filtro-de-mundo.ts';
import { desenharComodos } from './mascara-de-comodos.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO, NEBLINA_DENTRO, alfaDaNeblina, coberturaDaNeblina, corDaNeblina } from './particulas-config.ts';

export interface Neblina {
  readonly raiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  definirLigado(ligado: boolean): void;
  destruir(): void;
}

// Bancos de névoa: fbm com deformação de domínio em baixa frequência (formas de 8 a 15 m, esticadas pelo vento), com vãos limpos entre os bancos
// e bordas roídas por um ruído fino. A luz direta (fogueira, tocha) abre a névoa e esquenta a borda. Sem arrays constantes (GLSL ES 1.00).
const fragment = `in vec2 vTextureCoord;
in vec2 vMundoUv;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uLuz;
uniform highp vec2 uTamanho;
uniform highp vec2 uDeslocamento;
uniform highp float uTempo;
uniform vec3 uCor;
uniform float uAlfa;
uniform float uCobertura;
uniform float uPixel;
uniform float uPpm;
uniform float uUsarLuz;
uniform float uEscalaLuz;
float hash(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }
float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
// Cada oitava gira o domínio: o ruído de valor é alinhado à grade, e sem isso a névoa sai quadriculada.
float fbm(vec2 p) {
  mat2 giro = mat2(0.8, -0.6, 0.6, 0.8);
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * ruido(p); p = giro * p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v / 0.9375;
}
void main() {
  bool pixel = uPixel > 0.5;
  vec2 mundo = vMundoUv * uTamanho;
  if (pixel) mundo = (floor(mundo * uPpm / 2.0) * 2.0 + 1.0) / uPpm;
  // Esticada no sentido do vento (x) e arrastada por ele; as camadas andam em velocidades diferentes, então a forma muda devagar.
  vec2 p = vec2(mundo.x * 0.62, mundo.y) * 0.085;
  vec2 d = uDeslocamento * 0.085;
  vec2 q = vec2(fbm(p - d * 0.6 + vec2(0.0, uTempo * 0.004)), fbm(p - d * 0.6 + vec2(5.2, 1.3)));
  vec2 r = vec2(fbm(p + 1.5 * q - d + vec2(1.7, 9.2)), fbm(p + 1.5 * q - d + vec2(8.3, 2.8)));
  float n = fbm(p + 1.2 * r - d * 1.1);
  // Volume de algodão: lóbulos de 2 a 4 m na borda dos bancos.
  n += (fbm(p * 3.2 + r * 1.5 - d * 1.4) - 0.5) * 0.22;
  float densidade = smoothstep(uCobertura, uCobertura + 0.42, n);
  // Bordas em fiapos: um ruído fino, esticado e deformado pelo mesmo campo, rói só a borda dos bancos (o miolo fica cheio).
  float fino = fbm(vec2(mundo.x * 0.22, mundo.y * 0.4) + r * 2.0 - uDeslocamento * 0.4);
  densidade *= mix(0.35 + 0.9 * fino, 1.0, smoothstep(0.35, 0.9, densidade));
  densidade = smoothstep(0.0, 1.0, densidade);
  densidade = max(densidade, uCobertura < 0.4 ? (0.4 - uCobertura) * 0.35 : 0.0);
  // A luz direta abre a névoa (o calor do fogo e a claridade) e tinge de leve o que sobra em volta.
  vec3 luz = vec3(0.0);
  if (uUsarLuz > 0.5) luz = texture(uLuz, vMundoUv).rgb * uEscalaLuz;
  float claro = dot(luz, vec3(0.3, 0.5, 0.2));
  densidade *= 1.0 - 0.9 * smoothstep(0.12, 0.9, claro);
  // O miolo do banco é mais claro que a borda (a luz espalha mais onde a névoa é funda).
  vec3 cor = uCor * (0.78 + 0.34 * densidade) + luz * 0.22;
  float a = densidade * uAlfa;
  if (pixel) a = clamp(floor(densidade * 3.0 + bayer(floor(gl_FragCoord.xy)) + 0.5) / 3.0, 0.0, 1.0) * uAlfa;
  finalColor = vec4(cor * a, a);
}`;

/** A textura da luz direta do mapa (mesma caixa do mapa, em metros), para a luz abrir a névoa. */
export interface FonteDeLuzDaNeblina { textura(): Texture | null; escala(): number; }

/**
 * Bancos de névoa: um véu do tamanho do mapa, desenhado por cima das copas, com bancos que o vento arrasta e vãos limpos entre eles.
 * Dentro dos cômodos vale metade (a neblina entra pouco em casa). A cor vem do ambiente, mas a névoa espalha a luz: mesmo à noite ela é
 * mais clara que o chão. Onde há luz direta (fogueira, tocha), a névoa se abre.
 */
export function criarNeblina(fonteDeLuz?: FonteDeLuzDaNeblina): Neblina {
  const criarGrupo = (alfa: number) => new UniformGroup({
    uTamanho: { value: new Float32Array([1, 1]), type: 'vec2<f32>' }, uDeslocamento: { value: new Float32Array([0, 0]), type: 'vec2<f32>' },
    uTempo: { value: 0, type: 'f32' }, uPixel: { value: 0, type: 'f32' }, uPpm: { value: 1, type: 'f32' }, uCor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
    uAlfa: { value: alfa, type: 'f32' }, uCobertura: { value: 0.6, type: 'f32' }, uUsarLuz: { value: 0, type: 'f32' }, uEscalaLuz: { value: 1, type: 'f32' },
  });
  const grupoFora = criarGrupo(0), grupoDentro = criarGrupo(0);
  const filtros: Filter[] = [];
  const veu = (grupo: UniformGroup) => { const s = new Sprite(Texture.WHITE), f = criarFiltroDeMundo(s, { fragment, nome: 'atlas-neblina', recursos: { neblina: grupo, uLuz: Texture.WHITE.source } }); filtros.push(f); s.filters = [f]; return s; };
  const raiz = new Container(), fora = new Container(), dentro = new Container(), veuFora = veu(grupoFora), veuDentro = veu(grupoDentro);
  const mascaraFora = new Graphics(), mascaraDentro = new Graphics();
  fora.addChild(veuFora, mascaraFora); dentro.addChild(veuDentro, mascaraDentro);
  fora.setMask({ mask: mascaraFora, inverse: true }); dentro.mask = mascaraDentro; dentro.alpha = 1;
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
        const f = m.climate.weather.fog, cor = new Float32Array(corDaNeblina(m.climate.ambient)), alfa = alfaDaNeblina(f), cobertura = coberturaDaNeblina(f);
        for (const g of [grupoFora, grupoDentro]) { const u = g.uniforms as Record<string, unknown>; u.uCor = cor; u.uCobertura = cobertura; }
        (grupoFora.uniforms as Record<string, unknown>).uAlfa = alfa;
        (grupoDentro.uniforms as Record<string, unknown>).uAlfa = alfa * NEBLINA_DENTRO;
        raiz.visible = ligado && f > 0.001;
      }
    },
    quadro(dt) {
      if (destruido || !ligado || !raiz.visible || !mapa) return;
      const passo = Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1), vento = mapa.climate.weather.wind;
      tempo += passo; desloc = [desloc[0] + (0.18 + vento * 0.7) * passo, desloc[1] + 0.05 * passo];
      const arr = new Float32Array(desloc), tex = fonteDeLuz?.textura() ?? null, temLuz = !!tex && !tex.destroyed && !!tex.source && !tex.source.destroyed && mapa.style.renderer !== 'pixel';
      for (const f of filtros) f.resources.uLuz = temLuz ? tex.source : Texture.WHITE.source;
      for (const g of [grupoFora, grupoDentro]) {
        const u = g.uniforms as Record<string, unknown>;
        u.uTempo = tempo;
        u.uDeslocamento = arr;
        u.uUsarLuz = temLuz ? 1 : 0;
        u.uEscalaLuz = fonteDeLuz?.escala() ?? 1;
      }
    },
    definirLigado(v) { ligado = v; raiz.visible = v && (mapa?.climate.weather.fog ?? 0) > 0.001; },
    destruir() {
      destruido = true;
      for (const f of filtros) f.destroy();
      raiz.destroy({ children: true });
    },
  };
}
