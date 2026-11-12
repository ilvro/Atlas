import { Container, Filter, GlProgram, Graphics, Rectangle, RenderTexture, Sprite, Texture, UniformGroup, type Renderer } from 'pixi.js';
import type { MapaAtlas } from '../domain/mapa.ts';
import { CORES_DA_PALETA, paletaDe } from '../domain/paletas.ts';
import { hexParaNumero } from './cores.ts';

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

// Quantização para a paleta com dithering ordenado 4×4 (porte do protótipo). Sem arrays: o Pixi pode compilar para GLSL ES 1.00.
const fragment = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uPaleta;
uniform float uDither;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec3 base = c.a > 0.0 ? c.rgb / c.a : c.rgb;
  vec3 cor = base + bayer(floor(gl_FragCoord.xy)) * uDither;
  vec3 melhor = vec3(0.0); float dist = 1e9;
  for (int i = 0; i < ${CORES_DA_PALETA}; i++) {
    vec3 p = texture(uPaleta, vec2((float(i) + 0.5) / ${CORES_DA_PALETA}.0, 0.5)).rgb;
    vec3 d = (cor - p) * vec3(0.30, 0.59, 0.11);
    float e = dot(d, d) + 0.25 * dot(cor - p, cor - p);
    if (e < dist) { dist = e; melhor = p; }
  }
  finalColor = vec4(melhor * c.a, c.a);
}`;

const DITHER_BAYER4 = 0.018;

// Dithering do alfa: a borda suave de uma máscara vira um padrão Bayer 4×4 de tudo ou nada (a névoa e a memória no Pixel).
const fragmentoDeAlfa = `in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uRevelado;
float bayer2(vec2 a) { a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer(vec2 p) { return bayer2(0.5 * p) * 0.25 + bayer2(p) - 0.47; }
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  float limiar = bayer(floor(gl_FragCoord.xy)) + 0.5;
  float a = step(limiar, c.a * uRevelado);
  vec3 cor = c.a > 0.0 ? c.rgb / c.a : c.rgb;
  finalColor = vec4(cor * a, a);
}`;

/** O filtro de dithering do alfa. `uRevelado` (0 a 1) escala o alfa antes do limiar: é como a revelação em dithering dissolve (8.4b). */
export function criarFiltroDeDitherDeAlfa(): { filtro: Filter; definirRevelado(v: number): void } {
  const grupo = new UniformGroup({ uRevelado: { value: 1, type: 'f32' } });
  const filtro = new Filter({ glProgram: GlProgram.from({ vertex, fragment: fragmentoDeAlfa, preferredFragmentPrecision: 'highp', name: 'atlas-dither-alfa' }), resources: { ditherAlfa: grupo } });
  return { filtro, definirRevelado: v => { (grupo.uniforms as Record<string, unknown>).uRevelado = v; } };
}

/** O filtro de paleta: troca as cores pelas da paleta, com ou sem dithering. */
export function criarFiltroDePaleta(): { filtro: Filter; definir(cores: readonly string[], dither: 'none' | 'bayer4'): void } {
  const canvas = document.createElement('canvas'); canvas.width = CORES_DA_PALETA; canvas.height = 1;
  const ctx = canvas.getContext('2d')!;
  const textura = Texture.from(canvas); textura.source.scaleMode = 'nearest';
  const grupo = new UniformGroup({ uDither: { value: DITHER_BAYER4, type: 'f32' } });
  const filtro = new Filter({ glProgram: GlProgram.from({ vertex, fragment, preferredFragmentPrecision: 'highp', name: 'atlas-paleta' }), resources: { uPaleta: textura.source, paleta: grupo } });
  let atual = '';
  return {
    filtro,
    definir(cores, dither) {
      const assinatura = cores.join();
      if (assinatura !== atual) { atual = assinatura; cores.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(i, 0, 1, 1); }); textura.source.update(); }
      (grupo.uniforms as Record<string, unknown>).uDither = dither === 'bayer4' ? DITHER_BAYER4 : 0;
    },
  };
}

/** Teto de uma dimensão do render target; mapas maiores perdem resolução (o zoom mínimo do Pixel já é 1 pixel por pixel da tela). */
const LIMITE_DA_TEXTURA = 8192;

export interface Pixelizacao {
  /** A cena pixelizada, ampliada em `nearest` e ocupando o mapa no mundo (em metros). */
  readonly sprite: Sprite;
  /** Pixels do Pixel por metro do mundo (`pixelsPerCell / grid.size`). */
  readonly res: number;
  /** Atualiza tamanho, paleta, dithering e fundo a partir do documento. `ligado` falso solta a textura. */
  definir(m: MapaAtlas, ligado: boolean): void;
  /** Renderiza a raiz da cena (que passa a viver aqui dentro) no render target pixelizado. */
  renderizar(raiz: Container): void;
  destruir(): void;
}

/**
 * No estilo Pixel a cena inteira (terreno a peças) é desenhada num render target de `colunas × ppc` por `linhas × ppc`, passa pelo filtro de paleta e
 * é ampliada em `nearest`. O acabamento e as sobreposições do editor ficam por cima, na resolução da tela.
 */
export function criarPixelizacao(renderer: Renderer): Pixelizacao {
  const interno = new Container(), fundo = new Graphics(), paleta = criarFiltroDePaleta(), sprite = new Sprite();
  interno.addChild(fundo); interno.filters = [paleta.filtro];
  sprite.visible = false;
  let rt: RenderTexture | null = null, ligado = false, res = 1, largura = 0, altura = 0, fundoCor = '', fundoTam = '';

  function soltar(): void { rt?.destroy(true); rt = null; sprite.texture = Texture.EMPTY; sprite.visible = false; }

  return {
    sprite,
    get res() { return res; },
    definir(m, on) {
      if (!on) { if (ligado) { ligado = false; soltar(); } return; }
      ligado = true;
      const W = m.bounds.width, H = m.bounds.height;
      res = Math.min(m.style.pixel.pixelsPerCell / m.grid.size, LIMITE_DA_TEXTURA / Math.max(W, H));
      const w = Math.max(1, Math.ceil(W * res)), h = Math.max(1, Math.ceil(H * res));
      if (!rt || w !== largura || h !== altura) {
        rt?.destroy(true); largura = w; altura = h;
        rt = RenderTexture.create({ width: w, height: h, scaleMode: 'nearest' });
        sprite.texture = rt;
      }
      sprite.scale.set(1 / res); sprite.visible = true;
      interno.scale.set(res); interno.filterArea = new Rectangle(0, 0, W, H);
      const tam = `${W}x${H}`;
      if (fundoCor !== m.backdrop.color || fundoTam !== tam) { fundoCor = m.backdrop.color; fundoTam = tam; fundo.clear().rect(0, 0, W, H).fill(hexParaNumero(m.backdrop.color)); }
      paleta.definir(paletaDe(m.style.palette).cores, m.style.pixel.dither);
    },
    renderizar(raiz) {
      if (!ligado || !rt) return;
      if (raiz.parent !== interno) interno.addChild(raiz);
      renderer.render({ container: interno, target: rt, clear: true, clearColor: [0, 0, 0, 0] });
    },
    destruir() { soltar(); interno.destroy({ children: false }); fundo.destroy(); },
  };
}
