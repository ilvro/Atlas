import { Container, Geometry, GlProgram, Mesh, Shader, Texture, UniformGroup } from 'pixi.js';
import type { MapaAtlas } from '../domain/mapa.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { tamanhoDoObjeto } from './selecao.ts';
import { materialDe } from '../procedural/materiais.ts';
import { hexParaNumero } from './cores.ts';
import { FATOR_DE_MOVIMENTO_REDUZIDO } from './particulas-config.ts';

// Malha própria (como a presença): o ruído é do mundo, não da tela, e não nada quando a câmera anda.
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

// A textura de água (2 px/m): R = profundidade (0 a 1 sobre 3 m), G = margem (1 na borda, 0 a 0,6 m dela), B = índice da camada de água (50, 100, 150, 200).
// A superfície é só o que se mexe por cima do leito já assado: brilho de ondas, sombras de ondulação, espuma, correnteza e cáusticas.
// No Pixel tudo vai em pixels inteiros do Pixel, com 4 quadros por ciclo e sem meios-tons (a paleta do mapa faz o resto).
const fragment = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uObjetos;
uniform highp vec2 uTamanho;
uniform highp float uTempo;
uniform vec2 uSol;
uniform vec3 uLuz;
uniform vec3 uEspuma;
uniform vec2 uFlow0;
uniform vec2 uFlow1;
uniform vec2 uFlow2;
uniform vec2 uFlow3;
uniform vec4 uCaustica;
uniform vec4 uForcaEspuma;
uniform float uPixel;
uniform float uPpm;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
// Altura da água: duas camadas de ruído rolando em direções diferentes, devagar; \`v\` é a correnteza (m/s).
float altura(vec2 p, float t, vec2 v) { return ruido(p * 1.1 + vec2(t * 0.35, t * 0.12) - v * t * 0.9) * 0.6 + ruido(p * 2.3 + vec2(-t * 0.22, t * 0.3) + 17.0 - v * t * 1.3) * 0.4; }
// Rede de luz: onde dois ruídos se cruzam (a diferença fica perto de zero) nasce uma linha fina.
float causticas(vec2 p, float t) {
  float a = ruido(p * 1.25 + vec2(t * 0.22, t * 0.14)), b = ruido(p * 1.25 * 1.7 + vec2(-t * 0.18, t * 0.1) + 5.0), c = ruido(p * 2.1 + vec2(t * 0.1, -t * 0.2) + 9.0);
  return max(1.0 - smoothstep(0.0, 0.075, abs(a - b)), 0.6 * (1.0 - smoothstep(0.0, 0.06, abs(b - c))));
}
void main() {
  bool pixel = uPixel > 0.5;
  vec2 mundo = vUV * uTamanho;
  vec2 p = pixel ? (floor(mundo * uPpm) + 0.5) / uPpm : mundo;
  vec2 uv = p / uTamanho;
  vec4 d = texture(uTexture, uv);
  float dentro = smoothstep(0.12, 0.5, max(d.g, min(1.0, d.r * 4.0)));
  if (dentro < 0.01) { finalColor = vec4(0.0); return; }
  float idx = floor(d.b * 255.0 / 50.0 + 0.5);
  vec2 v = idx < 1.5 ? uFlow0 : idx < 2.5 ? uFlow1 : idx < 3.5 ? uFlow2 : uFlow3;
  float rede = idx < 1.5 ? uCaustica.x : idx < 2.5 ? uCaustica.y : idx < 3.5 ? uCaustica.z : uCaustica.w;
  float forcaDaEspuma = idx < 1.5 ? uForcaEspuma.x : idx < 2.5 ? uForcaEspuma.y : idx < 3.5 ? uForcaEspuma.z : uForcaEspuma.w;
  float t = pixel ? floor(uTempo * 3.3) / 3.3 : uTempo;       // no Pixel a superfície tem 4 quadros por ciclo de ~1,2 s
  float vel = length(v);
  float e = 0.12;
  float h = altura(p, t, v);
  vec2 grad = vec2(altura(p + vec2(e, 0.0), t, v) - h, altura(p + vec2(0.0, e), t, v) - h) / e;
  vec3 n = normalize(vec3(-grad * 0.55, 1.0));
  vec3 l = normalize(vec3(uSol * 0.6, 0.8));
  float brilho = pow(max(0.0, dot(n, l)), 28.0) * (0.2 + 0.6 * d.r);
  float sombra = clamp(0.5 - h, 0.0, 0.5) * (0.12 + 0.2 * d.r);
  // Espuma: faixas de ruído que avançam e recuam na zona da margem (período de 4 a 6 s); a correnteza as arrasta.
  float onda = 0.5 + 0.5 * sin(t * 1.2 + ruido(p * 0.9 - v * t * 0.6) * 6.2831);
  float margem = clamp(d.g * 2.0, 0.0, 1.0);
  float faixa = margem * (0.5 + 0.5 * onda) + (ruido(p * 3.2 + t * 0.15 - v * t * 1.1) - 0.5) * 0.5;
  float espuma = smoothstep(0.42, 0.58, faixa) * 0.85 * dentro;
  // Anel de espuma em volta dos objetos de piso que tocam a água (pedras, cascos): a máscara deles vem de "uObjetos".
  float c0 = texture(uObjetos, uv).a, viz = 0.0;
  for (int i = 0; i < 8; i++) { float an = float(i) * 0.7854; viz += texture(uObjetos, uv + vec2(cos(an), sin(an)) * 0.4 / uTamanho).a; }
  viz /= 8.0;
  float anel = (1.0 - smoothstep(0.2, 0.6, c0)) * smoothstep(0.02, 0.3, viz);
  espuma = max(espuma, smoothstep(0.34, 0.56, anel * (0.6 + 0.4 * onda) + (ruido(p * 3.0 + t * 0.2 - v * t * 0.8) - 0.5) * 0.8) * 0.9 * dentro);
  espuma *= forcaDaEspuma;
  // Rio: fiapos de espuma esticados no sentido da corrente, mais fortes onde a água é rasa.
  if (vel > 0.01) {
    vec2 dir = v / vel, perp = vec2(-dir.y, dir.x);
    vec2 q = vec2(dot(p, dir) * 0.35 - t * vel * 0.8, dot(p, perp) * 1.6);
    float fio = smoothstep(0.74, 0.86, ruido(q) * 0.7 + ruido(q * 2.1 + 3.0) * 0.3) * clamp(vel / 1.5, 0.0, 1.0) * (1.0 - 0.6 * d.r);
    espuma = max(espuma, fio * 0.55 * dentro);
  }
  // Cáusticas: rede de luz sobre o leito, mais forte no raso.
  float luzDoLeito = rede * causticas(p, t) * (0.9 - 0.55 * d.r) * dentro;
  if (pixel) {
    float fe = step(0.5, espuma), br = step(0.5, brilho * 2.4), cl = step(0.5, luzDoLeito);
    float algo = max(fe, max(br, cl));
    vec3 cor = fe > 0.5 ? uEspuma : cl > 0.5 ? mix(uEspuma, uLuz, 0.5) : mix(uEspuma, uLuz, 0.7);
    finalColor = vec4(cor * algo, algo);
    return;
  }
  float claro = clamp(brilho * 0.55 + espuma + luzDoLeito * 0.55, 0.0, 1.0), escuro = sombra * dentro;
  float a = clamp(claro + escuro, 0.0, 1.0);
  vec3 cor = (uEspuma * espuma + uLuz * (brilho * 0.55 + luzDoLeito * 0.55)) / max(brilho * 0.55 + espuma + luzDoLeito * 0.55, 0.001) * claro;
  finalColor = vec4(cor, a);
}`;

export interface RenderDeAgua {
  readonly raiz: Container;
  /** Chegou o resultado do terreno: a textura de água dele (ou `undefined`, se não há água). */
  aplicar(agua: { bitmap: ImageBitmap; res: number } | undefined, m: MapaAtlas): void;
  /** O clima ou o estilo mudou: luz do sol, cor da espuma. */
  sincronizar(m: MapaAtlas): void;
  /** Os objetos de piso mudaram: refaz a máscara do anel de espuma. */
  objetos(m: MapaAtlas): void;
  /** A água no ponto (profundidade 0 a 1 e cor do fundo), ou `null` se ali não há água. */
  submersao(x: number, y: number): Submersao | null;
  /** `dt` em segundos. */
  quadro(dt: number): void;
  /** Para os testes. */
  ativa(): boolean;
  destruir(): void;
}

/** As camadas de água na ordem em que o assar numera a textura (o `B` dela): as que têm células, pela ordem de pintura. */
const camadasDeAgua = (m: MapaAtlas) => Object.values(m.terrain.layers).filter(c => c.cells.length && materialDe(c.material).uso === 'agua').sort((a, b) => a.order - b.order);

interface Desenho { mesh: Mesh<Geometry, Shader>; grupo: UniformGroup; textura: Texture; mascara: HTMLCanvasElement; texMascara: Texture; dados: Uint8ClampedArray; largura: number; altura: number; res: number }

/** Quanto um objeto submerso é tingido e esmaecido, a cor da água e a profundidade (0 a 1) no ponto dele. */
export interface Submersao { profundidade: number; cor: number; material: string }

export function criarAgua(): RenderDeAgua {
  const raiz = new Container();
  let desenho: Desenho | null = null, mapaAtual: MapaAtlas | null = null, tempo = 0, destruido = false, prog: GlProgram | null = null;

  const apagar = () => { if (desenho) { desenho.mesh.destroy(); desenho.textura.destroy(true); desenho.texMascara.destroy(true); desenho = null; } };
  const cor3 = (hex: string) => { const n = hexParaNumero(hex); return new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]); };

  function sincronizar(m: MapaAtlas): void {
    mapaAtual = m;
    if (!desenho) return;
    const u = desenho.grupo.uniforms as Record<string, unknown>, sol = m.climate.sun;
    const espuma = camadasDeAgua(m).map(c => materialDe(c.material)).find(x => x.espuma)?.espuma ?? '#f2fbff';
    u.uSol = sol ? new Float32Array([Math.cos(sol.angle), Math.sin(sol.angle)]) : new Float32Array([-0.5, -0.7]);
    u.uLuz = cor3(sol?.color ?? m.climate.ambient.color); u.uEspuma = cor3(espuma);
    const pixel = m.style.renderer === 'pixel', camadas = camadasDeAgua(m);
    u.uPixel = pixel ? 1 : 0; u.uPpm = m.style.pixel.pixelsPerCell / m.grid.size;
    const vel = (i: number) => { const f = camadas[i]?.flow; return f ? new Float32Array([Math.cos(f.angle) * f.speed, Math.sin(f.angle) * f.speed]) : new Float32Array([0, 0]); };
    u.uFlow0 = vel(0); u.uFlow1 = vel(1); u.uFlow2 = vel(2); u.uFlow3 = vel(3);
    u.uCaustica = new Float32Array([0, 1, 2, 3].map(i => (camadas[i] && materialDe(camadas[i]!.material).causticas ? 1 : 0)));
    u.uForcaEspuma = new Float32Array([0, 1, 2, 3].map(i => (camadas[i] ? materialDe(camadas[i]!.material).espumaForca ?? 1 : 1)));
    const modo = pixel ? 'nearest' : 'linear'; if (desenho.textura.source.scaleMode !== modo) desenho.textura.source.scaleMode = modo;
  }

  /** Pinta a pegada dos objetos de piso que barram o passo (fora de cômodos) na máscara. */
  function objetos(m: MapaAtlas): void {
    if (!desenho) return;
    const g = desenho.mascara.getContext('2d')!, r = desenho.res;
    g.clearRect(0, 0, desenho.mascara.width, desenho.mascara.height); g.fillStyle = '#fff';
    for (const o of Object.values(m.props)) {
      if (o.elevation !== 'floor' || o.roomId !== null || !o.blocks.move) continue;   // o que flutua ou não barra o passo (vitórias-régias, barcos atracados) não quebra onda
      const [w, h] = tamanhoDoObjeto(o);
      g.save(); g.translate(o.position[0] * r, o.position[1] * r); g.rotate(o.rotation); g.beginPath(); g.ellipse(0, 0, Math.max(0.5, w * r / 2), Math.max(0.5, h * r / 2), 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    desenho.texMascara.source.update();
  }

  return {
    raiz,
    objetos,
    submersao(x, y) {
      if (!desenho) return null;
      const ix = Math.floor(x * desenho.res), iy = Math.floor(y * desenho.res);
      if (ix < 0 || iy < 0 || ix >= desenho.largura || iy >= desenho.altura) return null;
      const k = (iy * desenho.largura + ix) * 4, prof = desenho.dados[k]! / 255;
      if (prof <= 0 && desenho.dados[k + 1]! === 0) return null;
      const camada = (desenho.dados[k + 2]! / 50 | 0) - 1, material = mapaAtual ? camadasDeAgua(mapaAtual)[Math.max(0, camada)]?.material : undefined;
      if (!material) return null;
      return { profundidade: prof, cor: hexParaNumero(materialDe(material).fundo ?? materialDe(material).escuro), material };
    },
    aplicar(agua, m) {
      if (destruido) return;
      mapaAtual = m;
      apagar();
      if (!agua) return;
      const textura = Texture.from(agua.bitmap); textura.source.scaleMode = 'linear'; textura.source.addressMode = 'clamp-to-edge';
      const w = agua.bitmap.width / agua.res, h = agua.bitmap.height / agua.res;
      const geometria = new Geometry({ attributes: { aPosition: new Float32Array([0, 0, w, 0, w, h, 0, h]), aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]) }, indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]) });
      const grupo = new UniformGroup({
        uTamanho: { value: new Float32Array([w, h]), type: 'vec2<f32>' }, uTempo: { value: tempo, type: 'f32' }, uSol: { value: new Float32Array([-0.5, -0.7]), type: 'vec2<f32>' },
        uLuz: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' }, uEspuma: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
        uFlow0: { value: new Float32Array(2), type: 'vec2<f32>' }, uFlow1: { value: new Float32Array(2), type: 'vec2<f32>' }, uFlow2: { value: new Float32Array(2), type: 'vec2<f32>' }, uFlow3: { value: new Float32Array(2), type: 'vec2<f32>' },
        uCaustica: { value: new Float32Array(4), type: 'vec4<f32>' }, uForcaEspuma: { value: new Float32Array([1, 1, 1, 1]), type: 'vec4<f32>' }, uPixel: { value: 0, type: 'f32' }, uPpm: { value: 1, type: 'f32' },
      });
      prog ??= GlProgram.from({ vertex, fragment, name: 'atlas-agua' });
      // A cópia na CPU da profundidade (R) e do índice da camada (B), para os objetos submersos; e a máscara dos objetos, na mesma grade.
      const copia = document.createElement('canvas'); copia.width = agua.bitmap.width; copia.height = agua.bitmap.height;
      const cg = copia.getContext('2d', { willReadFrequently: true })!; cg.drawImage(agua.bitmap, 0, 0);
      const dados = cg.getImageData(0, 0, copia.width, copia.height).data;
      const mascara = document.createElement('canvas'); mascara.width = copia.width; mascara.height = copia.height;
      const texMascara = Texture.from(mascara); texMascara.source.scaleMode = 'linear'; texMascara.source.addressMode = 'clamp-to-edge';
      const mesh = new Mesh({ geometry: geometria, shader: new Shader({ glProgram: prog, resources: { uTexture: textura.source, uObjetos: texMascara.source, uSampler: textura.source.style, agua: grupo } }) });
      raiz.addChild(mesh); desenho = { mesh, grupo, textura, mascara, texMascara, dados, largura: copia.width, altura: copia.height, res: agua.res }; sincronizar(m); objetos(m);
    },
    sincronizar,
    quadro(dt) {
      if (destruido || !desenho) return;
      tempo += Math.min(0.1, dt) * (movimentoReduzido() ? FATOR_DE_MOVIMENTO_REDUZIDO : 1);
      (desenho.grupo.uniforms as Record<string, unknown>).uTempo = tempo;
    },
    ativa: () => desenho !== null,
    destruir() { destruido = true; apagar(); raiz.destroy({ children: true }); },
  };
}
