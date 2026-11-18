import { Container, Geometry, GlProgram, Graphics, Mesh, RendererType, RenderTexture, Shader, Sprite, Texture, UniformGroup, type Renderer } from 'pixi.js';
import { DURACAO_DA_QUEDA, DURACAO_DA_VOLTA, LUZ_INTERIOR_PADRAO, curvaDoClarao, ehNoite, intervaloDoRelampago, luzesDerivadas, nivelDaLuz, piscarDaQueda, piscarDaVolta } from '../domain/clima.ts';
import type { Luz, MapaAtlas } from '../domain/mapa.ts';
import {
  IndiceDeSegmentos,
  oclusores,
  oclusoresDeObjetos,
  oclusoresDeTokens,
  poligonoIluminado,
  segmentosParaFonte,
  type OclusorDeObjeto,
  type OclusorDeToken,
} from '../domain/visibilidade.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { somPreferido, trovao } from '../fx/som.ts';
import { valueNoise2D } from '../procedural/ruido.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import { criarFiltroDeFaixas } from './faixas.ts';
import { ALTURA_DA_LUZ, ALTURA_DO_FEIXE, ALTURA_MAXIMA_DA_LUZ, texturaDeBrilho, texturaDeDirecao } from './luzes.ts';

export { ALTURA_DA_LUZ };

/** Pixels por metro do mapa de luz: baixo de propósito (a luz é suave e o desfoque esconde a resolução). */
export const RES_LUZ = 8;
/** Quanto da luz ambiente do céu chega ao interior de cômodos cobertos por telhado. */
export const FATOR_DO_INTERIOR = LUZ_INTERIOR_PADRAO;
const TEXTURA_MAX = 4096;

/** Escala usada quando o renderizador cai no caminho de 8 bits: guarda `luz / ESCALA_HDR` e decodifica no filtro. */
export const ESCALA_HDR = 4;

export type FormatoDeLuz = 'rgba16float' | 'rgba8unorm';

export interface InfoDeRendererDeLuz {
  readonly type?: number;
  readonly context?: {
    readonly webGLVersion?: number;
    readonly extensions?: { readonly colorBufferFloat?: unknown };
  };
}

/** Escolhe o formato das texturas do mapa de luz: 16-bit float quando há WebGL2 com `EXT_color_buffer_float`; caso contrário 8 bits escalado. */
export function formatoDaLuz(renderer: Renderer | InfoDeRendererDeLuz): { formato: FormatoDeLuz; escala: number } {
  const info = renderer as InfoDeRendererDeLuz;
  const ehWebGL = info.type === undefined || info.type === RendererType.WEBGL;
  if (ehWebGL && info.context?.webGLVersion === 2 && info.context.extensions?.colorBufferFloat) {
    return { formato: 'rgba16float', escala: 1 };
  }
  return { formato: 'rgba8unorm', escala: ESCALA_HDR };
}

/** Codifica uma intensidade/canal linear para armazenamento na textura do mapa de luz. */
export function codificarLuz(v: number, escala: number): number {
  const n = Math.max(0, v) / Math.max(1, escala);
  return escala > 1 ? Math.min(1, n) : n;
}

/** Decodifica uma amostra lida da textura do mapa de luz para intensidade linear. */
export function decodificarLuz(v: number, escala: number): number {
  return v * escala;
}

export interface MapaDeLuz {
  /** A luz já composta (em metros): no Pixel multiplica a cena; no Ilustrado é amostrada pelo filtro de composição. */
  readonly sprite: Sprite;
  /** Mapa de direção dominante da luz (Ilustrado): `R/G` deslocados por `0.5 * B`, `B` = soma das intensidades. */
  readonly direcao: Texture;
  /** Fator de escala para decodificar a textura da luz (`1` em float ou no Pixel; `ESCALA_HDR` em 8 bits). */
  readonly escala: number;
  /** Cor efetiva do ambiente (já multiplicada por efeitos e clarão de relâmpago), em escala linear. */
  readonly ambiente: readonly [number, number, number];
  /** Alcance médio (m) das luzes ativas ponderado pela intensidade (padrão `6`). */
  readonly alcance: number;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  /** Tremulação das luzes; `agora` em milissegundos. */
  quadro(agora: number): void;
  definirLigado(ligado: boolean): void;
  /** Dispara um relâmpago agora (e o trovão, se o som estiver ligado). */
  relampagoAgora(): void;
  /** Eventos de cena: multiplicam a intensidade de todas as luzes (piscar) e a do ambiente (escurecer). 1 = sem efeito. */
  definirEfeitos(luzes: number, ambiente: number): void;
  /** Intensidade atual da luz (inclui flicker, queda de rede, relâmpago, etc.). */
  intensidade(id: string): number;
  /** Polígono de visão iluminado recortado pelas paredes (para a máscara de raios). */
  poligono(id: string): readonly number[] | null;
  /** Todas as luzes ativas (do mapa e derivadas). */
  todasAsLuzes(): readonly Luz[];
  destruir(): void;
}

interface LuzNaGPU {
  c: Container;
  mesh: Mesh<Geometry, Shader>;
  shader: Shader;
  grupo: UniformGroup;
  m: Graphics;
  cDir: Container;
  meshDir: Mesh<Geometry, Shader>;
  shaderDir: Shader;
  grupoDir: UniformGroup;
  mDir: Graphics;
  luz: Luz;
  raio: number;
  chaveGeo: string;
  versaoGeo: number;
  semente: number;
  alfa: number;
  clarao: number;
  corR: number;
  corG: number;
  corB: number;
  poligono: number[];
}

const rgb01 = (hex: string): [number, number, number] => { const n = hexParaNumero(hex); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };

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

const fragmentLuz = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec3 uCor;
uniform float uIntensidade;
void main() {
  vec4 t = texture(uTexture, vUV);
  finalColor = vec4(t.rgb * uCor * uIntensidade, t.a);
}`;

const fragmentDirecao = `in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uIntensidade;
uniform float uAlturaNorm;
void main() {
  vec4 t = texture(uTexture, vUV);
  finalColor = vec4(t.rgb * uIntensidade, t.b * uIntensidade * uAlturaNorm);
}`;

// Blur gaussiano separável (9 amostras, pesos somando 1.0) feito direto entre RenderTextures para preservar valores HDR > 1.
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

interface ObjetoComCaixa { oclusor: OclusorDeObjeto; x0: number; y0: number; x1: number; y1: number }

export interface ContextoDeOclusao {
  nivel: string | null;
  indiceParedes: IndiceDeSegmentos;
  objetos: ObjetoComCaixa[];
  tokens: OclusorDeToken[];
  tokensPorId: Map<string, OclusorDeToken>;
  versaoEstatica: number;
}

/** Determina o andar representado por `m` (quando já filtrado por `mapaDoAndar`, todos os itens compartilham o mesmo `levelId`). */
export function nivelAtivoDe(m: Pick<MapaAtlas, 'lights' | 'tokens' | 'props' | 'rooms' | 'walls'>): string | null {
  let primeiroNaoNulo: string | null = null;
  for (const c of [m.lights, m.tokens, m.props, m.rooms, m.walls]) {
    for (const item of Object.values(c)) {
      const nivel = item.levelId ?? null;
      if (nivel === null) return null;
      if (primeiroNaoNulo === null) primeiroNaoNulo = nivel;
    }
  }
  return primeiroNaoNulo;
}

function empacotarObjetos(lista: readonly OclusorDeObjeto[]): ObjetoComCaixa[] {
  return lista.map(oclusor => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of oclusor.poligono) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return { oclusor, x0, y0, x1, y1 };
  });
}

function tokenMudou(a: OclusorDeToken, b: OclusorDeToken): boolean {
  return a.centro[0] !== b.centro[0] || a.centro[1] !== b.centro[1] || a.raio !== b.raio || a.lightId !== b.lightId;
}

/** Atualiza o índice estático (`walls` + `props`) separado dos `tokens` dinâmicos para recálculo seletivo por luz. */
export function sincronizarOclusao(
  atual: ContextoDeOclusao | null,
  m: MapaAtlas,
  mud: Mudancas | null,
): { ctx: ContextoDeOclusao; estaticoMudou: boolean; tokensMudados: OclusorDeToken[] } {
  const tudo = !mud || mud.completo;
  const col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c];
  const campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
  const estaticoMudou = !atual || col('walls') || col('openings') || col('rooms') || col('props') || campo('grid');
  const tokensMudaram = estaticoMudou || col('tokens');
  if (!estaticoMudou && !tokensMudaram) return { ctx: atual, estaticoMudou: false, tokensMudados: [] };

  const nivel = nivelAtivoDe(m);
  const indiceParedes = estaticoMudou ? new IndiceDeSegmentos(oclusores(m, 'luz')) : atual.indiceParedes;
  const objetos = estaticoMudou ? empacotarObjetos(oclusoresDeObjetos(m, { levelId: nivel })) : atual.objetos;
  const versaoEstatica = estaticoMudou ? (atual?.versaoEstatica ?? 0) + 1 : atual.versaoEstatica;

  const tokens = tokensMudaram ? oclusoresDeTokens(m, nivel) : atual!.tokens;
  const tokensPorId = tokensMudaram ? new Map(tokens.map(t => [t.id, t])) : atual!.tokensPorId;
  const tokensMudados: OclusorDeToken[] = [];
  if (!estaticoMudou && tokensMudaram && atual) {
    for (const ant of atual.tokens) {
      const novo = tokensPorId.get(ant.id);
      if (!novo) tokensMudados.push(ant);
      else if (tokenMudou(ant, novo)) tokensMudados.push(ant, novo);
    }
    for (const novo of tokens) {
      if (!atual.tokensPorId.has(novo.id)) tokensMudados.push(novo);
    }
  }

  return {
    ctx: { nivel, indiceParedes, objetos, tokens, tokensPorId, versaoEstatica },
    estaticoMudou,
    tokensMudados,
  };
}

/** Verifica se uma luz é alcançada por algum token alterado (ou é portada por ele). */
export function luzAfetadaPorTokens(l: Luz, mudados: readonly OclusorDeToken[]): boolean {
  const alcance = l.radius * 1.5;
  for (const t of mudados) {
    if (l.ownerId === t.id || t.lightId === l.id) return true;
    const r = alcance + t.raio;
    const dx = t.centro[0] - l.position[0], dy = t.centro[1] - l.position[1];
    if (dx * dx + dy * dy <= r * r) return true;
  }
  return false;
}

/** Calcula o polígono iluminado de `l` considerando paredes, objetos altos e tokens fora da margem do portador. */
export function poligonoDaLuz(l: Luz, ctx: ContextoDeOclusao): number[] {
  const paredesPerto = ctx.indiceParedes.perto(l.position, l.radius);
  const r = l.radius * 1.5, lx = l.position[0], ly = l.position[1];
  const objsPerto: OclusorDeObjeto[] = [];
  for (const o of ctx.objetos) {
    if (o.x1 < lx - r || o.x0 > lx + r || o.y1 < ly - r || o.y0 > ly + r) continue;
    objsPerto.push(o.oclusor);
  }
  const tokensPerto: OclusorDeToken[] = [];
  for (const t of ctx.tokens) {
    const rt = r + t.raio;
    const dx = t.centro[0] - lx, dy = t.centro[1] - ly;
    if (dx * dx + dy * dy <= rt * rt) tokensPerto.push(t);
  }
  const segs = segmentosParaFonte(l.position, paredesPerto, objsPerto, tokensPerto, { ownerId: l.ownerId, lightId: l.id });
  return poligonoIluminado(l.position, segs, l.radius, l.cone);
}

/**
 * Cada luz é um brilho redondo recortado pelo polígono que ela enxerga (as paredes fazem sombra), somado numa textura "bruta"
 * via `Mesh` + `Shader` (sem o limite `[0, 1]` do `Sprite`); no Ilustrado, esta passa por blur gaussiano separável direto em
 * `RenderTexture` e é composta por filtro em HDR (ou 8 bits escalado). No Pixel mantém o caminho em faixas e `multiply`.
 */
export function criarMapaDeLuz(renderer: Renderer): MapaDeLuz {
  const raiz = new Container(), raizDirecao = new Container(), interior = new Graphics(), composicao = new Container(), brutaS = new Sprite(), sprite = new Sprite();
  brutaS.blendMode = 'add'; composicao.addChild(brutaS);
  sprite.blendMode = 'multiply';
  // No Pixel a luz final passa por um filtro de faixas (degraus de borda dura) antes de multiplicar a cena.
  const passadaFaixas = new Container(), faixasS = new Sprite(); passadaFaixas.addChild(faixasS); passadaFaixas.filters = [criarFiltroDeFaixas()];
  const progLuz = GlProgram.from({ vertex: vertexQuad, fragment: fragmentLuz, preferredFragmentPrecision: 'highp', name: 'atlas-luz-hdr' });
  const progDirecao = GlProgram.from({ vertex: vertexQuad, fragment: fragmentDirecao, preferredFragmentPrecision: 'highp', name: 'atlas-luz-direcao' });
  const progBlur = GlProgram.from({ vertex: vertexQuad, fragment: fragmentBlur, preferredFragmentPrecision: 'highp', name: 'atlas-luz-blur' });
  const quadLuz = new Geometry({
    attributes: {
      aPosition: new Float32Array([-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5]),
      aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
  const quadTela = new Geometry({
    attributes: {
      aPosition: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
      aUV: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    },
    indexBuffer: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
  const blurHGrupo = new UniformGroup({ uPasso: { value: new Float32Array([0, 0]), type: 'vec2<f32>' }, uLimites: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' } });
  const blurVGrupo = new UniformGroup({ uPasso: { value: new Float32Array([0, 0]), type: 'vec2<f32>' }, uLimites: { value: new Float32Array([0, 0, 1, 1]), type: 'vec4<f32>' } });
  const blurHShader = new Shader({ glProgram: progBlur, resources: { uTexture: Texture.EMPTY.source, blur: blurHGrupo } });
  const blurVShader = new Shader({ glProgram: progBlur, resources: { uTexture: Texture.EMPTY.source, blur: blurVGrupo } });
  const blurH = new Mesh({ geometry: quadTela, shader: blurHShader });
  const blurV = new Mesh({ geometry: quadTela, shader: blurVShader });
  blurV.blendMode = 'add';

  const luzes = new Map<string, LuzNaGPU>(), ruido = valueNoise2D(7);
  let brutaRT: RenderTexture | null = null, desfoqueRT: RenderTexture | null = null, finalRT: RenderTexture | null = null, faixasRT: RenderTexture | null = null;
  let brutaDirRT: RenderTexture | null = null, direcaoRT: RenderTexture | null = null;
  let largura = 0, altura = 0, resAtual = 0, pixel = false, pxPorMetro = 0, escalaAtiva = 1, ehFloatAtivo = false;
  let oclusao: ContextoDeOclusao | null = null, derivadas: Luz[] = [], ambiente: [number, number, number] = [1, 1, 1];
  let sujo = true, ligado = true, destruido = false, contador = 0, interiorPronto = false;
  // O estado do momento (clima): o mapa atual, se é noite, a queda de energia, o relâmpago e os trovões a caminho.
  let mapa: MapaAtlas | null = null, noite = false, redeAnterior: boolean | null = null, queda = 0, volta = 0;
  let efLuzes = 1, efAmbiente = 1, flash = 0, forcaDoRaio = 0, proximoRaio = Infinity, ultimoQuadro = -1, claraoAtual = 0;
  const trovoes: number[] = [];

  let todasLuzes: Luz[] = [];

  function aplicarAlfa(g: LuzNaGPU, k: number): void {
    g.alfa = k;
    const visivel = k > 0.01;
    g.c.visible = visivel;
    g.mesh.visible = visivel;
    g.cDir.visible = visivel;
    g.meshDir.visible = visivel;
    const u = pixel ? Math.min(1, k) : codificarLuz(k, escalaAtiva);
    (g.grupo.uniforms as Record<string, unknown>).uIntensidade = u;
    (g.grupoDir.uniforms as Record<string, unknown>).uIntensidade = u;
  }

  function aplicarCor(g: LuzNaGPU, r: number, gCor: number, b: number): void {
    if (r === g.corR && gCor === g.corG && b === g.corB) return;
    g.corR = r; g.corG = gCor; g.corB = b;
    (g.grupo.uniforms as Record<string, unknown>).uCor = new Float32Array([r, gCor, b]);
  }

  function dimensionar(m: MapaAtlas): void {
    const w = m.bounds.width, h = m.bounds.height, ehPixel = m.style.renderer === 'pixel', r0 = ehPixel ? m.style.pixel.pixelsPerCell / m.grid.size : RES_LUZ;
    if (brutaRT && w === largura && h === altura && r0 === resAtual && ehPixel === pixel) return;
    largura = w; altura = h; resAtual = r0; pixel = ehPixel;
    const res = Math.min(r0, TEXTURA_MAX / Math.max(w, h)), pw = Math.max(1, Math.round(w * res)), ph = Math.max(1, Math.round(h * res)); pxPorMetro = res;
    const { formato, escala: escalaHDR } = formatoDaLuz(renderer);
    const escalaAntes = escalaAtiva;
    escalaAtiva = pixel ? 1 : escalaHDR;
    ehFloatAtivo = !pixel && formato === 'rgba16float';
    const antigas = [brutaRT, desfoqueRT, finalRT, faixasRT, brutaDirRT, direcaoRT];
    if (pixel) {
      brutaRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'nearest' });
      desfoqueRT = null;
      finalRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'nearest' });
      faixasRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'nearest' });
      brutaDirRT = null;
      direcaoRT = null;
      brutaS.texture = brutaRT; faixasS.texture = finalRT;
      sprite.texture = faixasRT; sprite.renderable = true; sprite.visible = ligado;
    } else {
      brutaRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'linear', format: formato });
      desfoqueRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'linear', format: formato });
      finalRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'linear', format: formato });
      brutaDirRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'linear', format: formato });
      direcaoRT = RenderTexture.create({ width: pw, height: ph, scaleMode: 'linear', format: formato });
      faixasRT = null;
      const dirSource = texturaDeDirecao(ehFloatAtivo).source;
      for (const g of luzes.values()) g.shaderDir.resources.uTexture = dirSource;
      blurHShader.resources.uTexture = brutaRT.source;
      blurVShader.resources.uTexture = desfoqueRT.source;
      const lim = new Float32Array([0.5 / pw, 0.5 / ph, 1 - 0.5 / pw, 1 - 0.5 / ph]);
      (blurHGrupo.uniforms as Record<string, unknown>).uPasso = new Float32Array([1.35 / pw, 0]);
      (blurVGrupo.uniforms as Record<string, unknown>).uPasso = new Float32Array([0, 1.35 / ph]);
      (blurHGrupo.uniforms as Record<string, unknown>).uLimites = lim;
      (blurVGrupo.uniforms as Record<string, unknown>).uLimites = lim;
      blurH.scale.set(pw, ph); blurV.scale.set(pw, ph);
      sprite.texture = finalRT; sprite.renderable = false; sprite.visible = true;
    }
    sprite.scale.set(w / pw, h / ph); raiz.scale.set(pw / w, ph / h); raizDirecao.scale.set(pw / w, ph / h); interior.scale.set(pw / w, ph / h);
    for (const t of antigas) t?.destroy(true);
    if (escalaAtiva !== escalaAntes) {
      for (const g of luzes.values()) if (g.alfa >= 0) aplicarAlfa(g, g.alfa);
    }
    sujo = true;
  }

  function criar(l: Luz): LuzNaGPU {
    const c = new Container(), m = new Graphics();
    const grupo = new UniformGroup({
      uCor: { value: new Float32Array([1, 1, 1]), type: 'vec3<f32>' },
      uIntensidade: { value: 1, type: 'f32' },
    });
    const shader = new Shader({ glProgram: progLuz, resources: { uTexture: texturaDeBrilho().source, luz: grupo } });
    const mesh = new Mesh({ geometry: quadLuz, shader });
    mesh.blendMode = 'add'; mesh.mask = m; mesh.visible = false;
    c.addChild(mesh, m); raiz.addChild(c);

    const cDir = new Container(), mDir = new Graphics();
    const grupoDir = new UniformGroup({
      uIntensidade: { value: 1, type: 'f32' },
      uAlturaNorm: { value: ALTURA_DA_LUZ / ALTURA_MAXIMA_DA_LUZ, type: 'f32' },
    });
    const shaderDir = new Shader({ glProgram: progDirecao, resources: { uTexture: texturaDeDirecao(ehFloatAtivo).source, direcao: grupoDir } });
    const meshDir = new Mesh({ geometry: quadLuz, shader: shaderDir });
    meshDir.blendMode = 'add'; meshDir.mask = mDir; meshDir.visible = false;
    cDir.addChild(meshDir, mDir); raizDirecao.addChild(cDir);

    return {
      c, mesh, shader, grupo, m,
      cDir, meshDir, shaderDir, grupoDir, mDir,
      luz: l, raio: l.radius, chaveGeo: '', versaoGeo: -1, semente: ++contador * 13.7, alfa: -1, clarao: -1, corR: -1, corG: -1, corB: -1, poligono: [],
    };
  }

  function atualizar(g: LuzNaGPU, l: Luz): void {
    g.luz = l;
    const geo = JSON.stringify([l.position, l.radius, l.cone, l.ownerId]);
    if (oclusao && (geo !== g.chaveGeo || g.versaoGeo !== oclusao.versaoEstatica)) {
      g.chaveGeo = geo; g.versaoGeo = oclusao.versaoEstatica;
      const pts = poligonoDaLuz(l, oclusao);
      g.poligono = pts;
      g.m.clear(); if (pts.length >= 6) g.m.poly(pts).fill(0xffffff);
      g.mDir.clear(); if (pts.length >= 6) g.mDir.poly(pts).fill(0xffffff);
      g.mesh.position.set(l.position[0], l.position[1]);
      g.mesh.scale.set(l.radius * 2);
      g.meshDir.position.set(l.position[0], l.position[1]);
      g.meshDir.scale.set(l.radius * 2);
      g.raio = l.radius;
    } else if (!pixel && g.raio !== l.radius) {
      g.raio = l.radius;
      g.mesh.scale.set(l.radius * 2);
      g.meshDir.scale.set(l.radius * 2);
    }
    const [r, gCor, b] = rgb01(l.color);
    const c = g.clarao > 0 && l.id.startsWith('janela:') ? g.clarao * 0.6 : 0;
    aplicarCor(g, Math.min(1, r + c), Math.min(1, gCor + c), Math.min(1, b + c));
    (g.grupoDir.uniforms as Record<string, unknown>).uAlturaNorm = (l.rays ? ALTURA_DO_FEIXE : ALTURA_DA_LUZ) / ALTURA_MAXIMA_DA_LUZ;
    if (g.alfa < 0 && mapa) {
      const daRede = l.power === 'grid';
      const nivel = nivelDaLuz(l, mapa, queda > 0 ? { redeLigada: true, noite } : { noite });
      const piscar = !daRede ? 1 : queda > 0 ? piscarDaQueda(queda) : volta > 0 ? piscarDaVolta(volta) : 1;
      const base = pixel ? Math.min(3, Math.max(0, l.intensity)) : Math.max(0, l.intensity);
      aplicarAlfa(g, nivel * piscar * efLuzes * base);
    }
  }

  /** Um relâmpago: o clarão entra pelas janelas e, um instante depois, o trovão (se o som estiver ligado). */
  function disparar(): void {
    if (!ligado) return;
    flash = 1; if (somPreferido()) trovoes.push(0.4 + Math.random() * 1.2);
  }

  function desenharInterior(m: MapaAtlas): void {
    const t = m.grid.size, [ox, oy] = m.grid.offset;
    interior.clear();
    let tem = false;
    for (const sala of Object.values(m.rooms)) {
      if (!sala.roof.material) continue;
      if (sala.outline && sala.outline.length >= 3) {
        interior.moveTo(sala.outline[0]![0], sala.outline[0]![1]);
        for (let i = 1; i < sala.outline.length; i++) interior.lineTo(sala.outline[i]![0], sala.outline[i]![1]);
        interior.closePath();
        tem = true;
      } else {
        for (const [y, x0, n] of sala.cells) {
          interior.rect(ox + x0 * t, oy + y * t, n * t, t);
          tem = true;
        }
      }
    }
    if (tem) interior.fill(0xffffff);
    interiorPronto = true;
  }

  function renderizar(): void {
    if (!brutaRT || !finalRT) return;
    renderer.render({ container: raiz, target: brutaRT, clear: true, clearColor: [0, 0, 0, 0] });
    const brilho = claraoAtual * 0.35;
    const fatorInterior = mapa?.climate.interiorLight ?? FATOR_DO_INTERIOR;
    if (pixel) {
      const amb: [number, number, number, number] = [Math.min(1, ambiente[0] * efAmbiente + brilho), Math.min(1, ambiente[1] * efAmbiente + brilho), Math.min(1, ambiente[2] * efAmbiente + brilho), 1];
      const intR = Math.min(1, ambiente[0] * efAmbiente * fatorInterior + brilho * 0.3);
      const intG = Math.min(1, ambiente[1] * efAmbiente * fatorInterior + brilho * 0.3);
      const intB = Math.min(1, ambiente[2] * efAmbiente * fatorInterior + brilho * 0.3);
      interior.tint = (Math.round(intR * 255) << 16) | (Math.round(intG * 255) << 8) | Math.round(intB * 255);
      renderer.render({ container: interior, target: finalRT, clear: true, clearColor: amb });
      renderer.render({ container: composicao, target: finalRT, clear: false });
      if (faixasRT) renderer.render({ container: passadaFaixas, target: faixasRT, clear: true, clearColor: [0, 0, 0, 1] });
    } else if (desfoqueRT) {
      const amb: [number, number, number, number] = [
        codificarLuz(ambiente[0] * efAmbiente + brilho, escalaAtiva),
        codificarLuz(ambiente[1] * efAmbiente + brilho, escalaAtiva),
        codificarLuz(ambiente[2] * efAmbiente + brilho, escalaAtiva),
        1,
      ];
      const intR = Math.min(1, codificarLuz(ambiente[0] * efAmbiente * fatorInterior + brilho * 0.3, escalaAtiva));
      const intG = Math.min(1, codificarLuz(ambiente[1] * efAmbiente * fatorInterior + brilho * 0.3, escalaAtiva));
      const intB = Math.min(1, codificarLuz(ambiente[2] * efAmbiente * fatorInterior + brilho * 0.3, escalaAtiva));
      interior.tint = (Math.round(intR * 255) << 16) | (Math.round(intG * 255) << 8) | Math.round(intB * 255);
      blurHShader.resources.uTexture = brutaRT.source;
      blurVShader.resources.uTexture = desfoqueRT.source;
      renderer.render({ container: blurH, target: desfoqueRT, clear: true, clearColor: [0, 0, 0, 0] });
      renderer.render({ container: interior, target: finalRT, clear: true, clearColor: amb });
      renderer.render({ container: blurV, target: finalRT, clear: false });
      if (brutaDirRT && direcaoRT) {
        renderer.render({ container: raizDirecao, target: brutaDirRT, clear: true, clearColor: [0, 0, 0, 0] });
        blurHShader.resources.uTexture = brutaDirRT.source;
        renderer.render({ container: blurH, target: desfoqueRT, clear: true, clearColor: [0, 0, 0, 0] });
        blurVShader.resources.uTexture = desfoqueRT.source;
        renderer.render({ container: blurV, target: direcaoRT, clear: true, clearColor: [0, 0, 0, 0] });
      }
    }
    sujo = false;
  }

  const ambienteEfetivo: [number, number, number] = [1, 1, 1];

  return {
    sprite,
    get direcao() { return !pixel && direcaoRT ? direcaoRT : Texture.EMPTY; },
    get escala() { return escalaAtiva; },
    get ambiente(): readonly [number, number, number] {
      const brilho = claraoAtual * 0.35;
      ambienteEfetivo[0] = ambiente[0] * efAmbiente + brilho;
      ambienteEfetivo[1] = ambiente[1] * efAmbiente + brilho;
      ambienteEfetivo[2] = ambiente[2] * efAmbiente + brilho;
      return ambienteEfetivo;
    },
    get alcance() {
      let somaPeso = 0, somaRaio = 0;
      for (const g of luzes.values()) {
        const k = Math.max(0, g.alfa);
        if (k > 0.01) {
          somaPeso += k;
          somaRaio += k * g.luz.radius;
        }
      }
      return somaPeso > 0 ? somaRaio / somaPeso : 6;
    },
    sincronizar(m, mud) {
      if (destruido) return;
      const tudo = !mud || mud.completo, col = (c: string) => tudo || !!(mud!.colecoes as Record<string, unknown>)[c], campo = (...c: string[]) => tudo || c.some(x => mud!.campos.includes(x));
      mapa = m;
      if (campo('climate')) {
        noite = ehNoite(m);
        // A queda de energia pisca antes de apagar, e a volta pisca de leve; abrir ou importar um mapa não anima.
        const rede = m.climate.gridPower;
        if (redeAnterior !== null && rede !== redeAnterior && !tudo && !movimentoReduzido()) { queda = rede ? 0 : DURACAO_DA_QUEDA; volta = rede ? DURACAO_DA_VOLTA : 0; }
        redeAnterior = rede;
        const forca = m.climate.weather.lightning;
        if (forca !== forcaDoRaio) { forcaDoRaio = forca; proximoRaio = intervaloDoRelampago(forca, Math.random()); }
      }
      if (campo('bounds', 'style', 'grid')) dimensionar(m);
      if (!brutaRT) dimensionar(m);
      const { ctx, estaticoMudou, tokensMudados } = sincronizarOclusao(oclusao, m, mud);
      oclusao = ctx;
      if (tokensMudados.length > 0) {
        for (const g of luzes.values()) if (luzAfetadaPorTokens(g.luz, tokensMudados)) g.versaoGeo = -1;
      }
      if (col('rooms') || campo('grid') || !interiorPronto) desenharInterior(m);
      if (estaticoMudou || col('lights') || campo('climate')) derivadas = luzesDerivadas(m);
      if (campo('climate', 'style')) {
        const a = m.climate.ambient, [r, g, b] = rgb01(a.color);
        ambiente = pixel ? [Math.min(1, r * a.intensity), Math.min(1, g * a.intensity), Math.min(1, b * a.intensity)] : [r * a.intensity, g * a.intensity, b * a.intensity];
      }
      todasLuzes = [...Object.values(m.lights), ...derivadas];
      const vivos = new Set<string>();
      for (const l of todasLuzes) { vivos.add(l.id); let g = luzes.get(l.id); if (!g) { g = criar(l); luzes.set(l.id, g); } atualizar(g, l); }
      for (const [id, g] of luzes) if (!vivos.has(id)) {
        g.shader.destroy(false); g.c.destroy({ children: true });
        g.shaderDir.destroy(false); g.cDir.destroy({ children: true });
        luzes.delete(id);
      }
      sujo = true;
    },
    quadro(agora) {
      if (destruido) return;
      const dt = ultimoQuadro < 0 ? 0 : Math.min(0.1, (agora - ultimoQuadro) / 1000); ultimoQuadro = agora;
      if (!ligado || !mapa) return;
      const t = agora / 1000, reduzido = movimentoReduzido();
      if (queda > 0) { queda = Math.max(0, queda - dt); sujo = true; }
      if (volta > 0) { volta = Math.max(0, volta - dt); sujo = true; }
      if (forcaDoRaio > 0 && (proximoRaio -= dt) <= 0) { disparar(); proximoRaio = intervaloDoRelampago(forcaDoRaio, Math.random()); }
      for (let i = trovoes.length - 1; i >= 0; i--) if ((trovoes[i]! -= dt) <= 0) { trovoes.splice(i, 1); trovao(); }
      const f = flash; flash = Math.max(0, flash - dt * 2.2);
      const clarao = curvaDoClarao(f, reduzido);
      if (clarao !== claraoAtual) { claraoAtual = clarao; sujo = true; }
      for (const g of luzes.values()) {
        const l = g.luz, daRede = l.power === 'grid';
        // Durante o piscar da queda a rede ainda "existe": a luz tremula e só depois apaga (quando o documento já diz que a rede caiu).
        const nivel = nivelDaLuz(l, mapa, queda > 0 ? { redeLigada: true, noite } : { noite });
        const piscar = !daRede ? 1 : queda > 0 ? piscarDaQueda(queda) : volta > 0 ? piscarDaVolta(volta) : 1;
        const janela = l.id.startsWith('janela:');          // só a luz do céu pelas janelas leva o clarão
        let k = nivel * piscar * efLuzes * (pixel ? Math.min(3, Math.max(0, l.intensity)) : Math.max(0, l.intensity));
        if (k > 0 && l.flicker > 0) {
          const f = (ruido(t * 9 + g.semente, g.semente) + 0.5 * ruido(t * 23, g.semente + 9)) / 1.5;
          if (!pixel) k *= 1 - l.flicker * 0.7 * f;
          else {
            // No Pixel a chama treme no raio, em passos de 1 pixel (a intensidade contínua faria as faixas cintilarem).
            const raio = Math.round(l.radius * (1 - l.flicker * 0.3 * f) * pxPorMetro) / pxPorMetro;
            if (raio !== g.raio) { g.raio = raio; g.mesh.scale.set(raio * 2); sujo = true; }
          }
        } else if (pixel && g.raio !== l.radius) { g.raio = l.radius; g.mesh.scale.set(l.radius * 2); sujo = true; }
        if (janela) k = pixel ? Math.min(3, k + clarao * 1.2) : k + clarao * 1.2;
        if (Math.abs(k - g.alfa) > 1e-3) { aplicarAlfa(g, k); sujo = true; }
        if (janela && clarao !== g.clarao) {
          g.clarao = clarao;
          const [r, gCor, b] = rgb01(l.color), c = clarao > 0 ? clarao * 0.6 : 0;
          aplicarCor(g, Math.min(1, r + c), Math.min(1, gCor + c), Math.min(1, b + c));
        }
      }
      if (sujo) renderizar();
    },
    relampagoAgora: disparar,
    definirEfeitos(luzes, ambiente) { if (luzes === efLuzes && ambiente === efAmbiente) return; efLuzes = luzes; efAmbiente = ambiente; sujo = true; },
    definirLigado(v) { ligado = v; sprite.visible = pixel ? v : true; sprite.renderable = pixel; if (v) sujo = true; },
    intensidade: (id: string) => { const g = luzes.get(id); return g ? Math.max(0, g.alfa) : 0; },
    poligono: (id: string) => { const g = luzes.get(id); return g?.poligono && g.poligono.length >= 6 ? g.poligono : null; },
    todasAsLuzes: () => todasLuzes,
    destruir() {
      destruido = true;
      for (const g of luzes.values()) {
        g.shader.destroy(false); g.c.destroy({ children: true });
        g.shaderDir.destroy(false); g.cDir.destroy({ children: true });
      }
      luzes.clear();
      blurH.destroy(); blurV.destroy(); blurHShader.destroy(false); blurVShader.destroy(false);
      quadLuz.destroy(true); quadTela.destroy(true); progLuz.destroy(); progDirecao.destroy(); progBlur.destroy();
      brutaRT?.destroy(true); desfoqueRT?.destroy(true); finalRT?.destroy(true); faixasRT?.destroy(true);
      brutaDirRT?.destroy(true); direcaoRT?.destroy(true);
      passadaFaixas.destroy({ children: false }); faixasS.destroy(); interior.destroy(); sprite.destroy(); composicao.destroy({ children: false }); raiz.destroy({ children: true }); raizDirecao.destroy({ children: true });
    },
  };
}
