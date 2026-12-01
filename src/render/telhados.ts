import {
  BlurFilter,
  ColorMatrixFilter,
  Container,
  GlProgram,
  Graphics,
  Matrix,
  Mesh,
  RenderTexture,
  Shader,
  Sprite,
  Texture,
  TextureMatrix,
  UniformGroup,
  type Renderer,
} from 'pixi.js';
import { ALTURA_BASE_TELHADO, campoDoEdificio } from '../domain/campo-do-telhado.ts';
import { ehNoite, lerHorario } from '../domain/clima.ts';
import { edificiosDe, jogadorDentroDoEdificio, type Edificio } from '../domain/edificios.ts';
import {
  AO_PADRAO,
  EXPOSICAO_PADRAO,
  RELEVO_PADRAO,
  type Acabamento,
  type Clima,
  type DetalheDeTelhado,
  type MapaAtlas,
  type Peca,
  type Ponto,
} from '../domain/mapa.ts';
import { comodosConhecidos, edificioTocadoPorPoligonos, poligonosDeVisao, tokensDeVisaoAtivos, type FiltroDeVisao } from '../domain/nevoa.ts';
import { elevacaoDaLua, elevacaoDoSol, sombraDoSol } from '../domain/sol.ts';
import { aguasDoTrecho, expandirContorno, formaDe, retangulosDe, trechosDe } from '../domain/telhado-geometria.ts';
import { movimentoReduzido } from '../fx/fx.ts';
import { RES_DO_TELHADO } from '../procedural/assar-telhado.ts';
import { ErroDeBakeCancelado, type Baker } from '../procedural/baker.ts';
import { ehPadraoDeCobertura, PERIODO_DA_COBERTURA, RES_DA_COBERTURA } from '../procedural/coberturas.ts';
import { posicoesDosDetalhes } from '../procedural/detalhes-de-telhado.ts';
import type { IdDoEstilo, OpcoesDoPixel } from '../procedural/estilos/index.ts';
import { materialDe } from '../procedural/materiais.ts';
import type { Mudancas } from '../state/mudancas.ts';
import { hexParaNumero } from './cores.ts';
import {
  chaveDoTelhado,
  contextoDeEntradas,
  entradaDoTelhado,
  opcoesDoPixel,
  resolucaoDe,
  type ContextoDeEntradas,
  type EntradaDoTelhado,
} from './entradas.ts';
import type { MapaDeLuz } from './mapa-de-luz.ts';
import type { Vista } from './nevoa.ts';
import { atualizarTransformDoMundo, criarQuadUnitario } from './passadas.ts';
import { texturaPropria } from './textura-propria.ts';

/** Quanto tempo leva (em segundos) para um telhado aparecer ou sumir ao entrar/sair de uma casa. */
export const DURACAO_DO_TELHADO = 0.4;
/** O mestre vê o telhado esmaecido, para saber que ele existe sem perder o cômodo de vista. */
const ALFA_DO_MESTRE = 0.25;

export interface Telhados {
  readonly raiz: Container;
  /** Camada das fachadas frontais (+y) sob o beiral, posicionada logo abaixo das peças na cena. */
  readonly fachadaRaiz: Container;
  sincronizar(m: MapaAtlas, mudancas: Mudancas | null): void;
  definirVista(v: Vista): void;
  definirFiltroDeVisao?(filtro: FiltroDeVisao | null, minhasFichas?: readonly string[] | null): void;
  /** No modo Construir, mostra os telhados em vez de escondê-los. */
  definirNoEditor(v: boolean): void;
  forcar(alfa: number | null): void;
  quadro(agora: number): void;
  /** Atualiza luz e sombra dos telhados a partir da visão de clima (transições suaves). */
  atualizarClima?(m: MapaAtlas): void;
  /** Liga ou desliga a iluminação atmosférica e a sombra projetada. */
  definirAtmosfera?(ligada: boolean): void;
  /** Para os testes: a opacidade de cada telhado agora. */
  diagnostico(): { id: string; edificio: string; alfa: number; alvo: number; dentro: boolean; conhecido: boolean }[];
  /** Se o telhado do cômodo está visível e cobrindo a sala agora. */
  visivel(salaId: string): boolean;
  /** Chaves atualmente referenciadas no baker (para não serem coletadas enquanto em uso). */
  chavesEmUso(): Set<string>;
  destruir(): void;
}

interface TelhadoEmCache {
  cor: Texture;
  normal: Texture | null;
  especular: Texture | null;
  fachada: Texture | null;
  origem: Ponto;
  res: number;
}

interface DetalheEmCache {
  tex: Texture;
  origem: Ponto;
  res: number;
}

interface DoEdificio {
  ed: Edificio;
  corC: Container;
  normalC: Container;
  especularC: Container;
  fachadaC: Container;
  sombraC: Container;
  sombraG: Graphics;
  sombraSp: Sprite | null;
  sombraAlfaBase: number;
  chaveAssado: string;
  hMax: number;
  chaves: Set<string>;
  alfa: number;
  alvo: number;
  dentro: boolean;
  conhecido: boolean;
  visivelNoMapa: boolean;
}

const chaveCobertura = (material: string, res: number, estilo: IdDoEstilo): string =>
  `cobertura|${material}|${estilo}|${estilo === 'pixel' ? res.toFixed(3) : 'i'}`;

const chaveDetalhe = (
  detalhe: DetalheDeTelhado,
  cobertura: string,
  seed: number,
  res: number,
  estilo: IdDoEstilo,
  px?: OpcoesDoPixel,
): string =>
  `detalhe-telhado|${detalhe}|${cobertura}|${seed}|${res.toFixed(3)}|${estilo}|${px ? `${px.ppc}|${px.contorno ? 1 : 0}|${px.paleta}|${px.dither}` : 'i'}`;

const rgb01 = (hex: string): [number, number, number] => {
  const n = hexParaNumero(hex);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

const normalizar3 = (x: number, y: number, z: number): [number, number, number] => {
  const len = Math.hypot(x, y, z) || 1;
  return [x / len, y / len, z / len];
};

const VERTEX_TELHADOS = `in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
out vec2 vLuzCoord;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform mat3 uLuzMatriz;
void main(void) {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vLuzCoord = (uLuzMatriz * vec3(aUV, 1.0)).xy;
}`;

const FRAGMENT_TELHADOS = `in vec2 vUV;
in vec2 vLuzCoord;
out vec4 finalColor;
uniform sampler2D uCor;
uniform sampler2D uNormal;
uniform sampler2D uEspecular;
uniform sampler2D uLuzExterna;
uniform float uEscalaLuz;
uniform float uTemLuzExterna;
uniform float uTemEspecular;
uniform vec3 uAmbiente;
uniform vec3 uSolCor;
uniform vec3 uSolDir;
uniform float uRelevo;
uniform float uAO;
uniform float uExposicao;
uniform float uUsarNormalFixa;
uniform vec3 uNormalFixa;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec4 c = texture(uCor, vUV);
  if (c.a <= 0.001) {
    finalColor = vec4(0.0);
    return;
  }
  vec3 base = c.rgb / c.a;
  vec3 N = vec3(0.0, 0.0, 1.0);
  float ao = 1.0;
  float opac = 1.0;
  float fade = c.a;
  float spec = 0.0;
  if (uUsarNormalFixa > 0.5) {
    float pesoRelevo = clamp(uRelevo / 0.7, 0.0, 1.0);
    N = normalize(mix(vec3(0.0, 0.0, 1.0), normalize(uNormalFixa), pesoRelevo));
  } else {
    vec4 n = texture(uNormal, vUV);
    if (n.a > 0.001) {
      vec3 np = n.rgb / n.a;
      vec2 nxy = np.rg * 2.0 - 1.0;
      float len2 = dot(nxy, nxy);
      if (len2 > 0.999) {
        nxy *= inversesqrt(len2) * 0.999;
        len2 = dot(nxy, nxy);
      }
      vec3 nRaw = normalize(vec3(nxy, sqrt(max(0.0, 1.0 - len2))));
      float pesoRelevo = clamp(uRelevo / 0.7, 0.0, 1.0);
      N = normalize(mix(vec3(0.0, 0.0, 1.0), nRaw, pesoRelevo));
      ao = np.b;
      opac = clamp(c.a / n.a, 0.0, 1.0);
      fade = n.a;
      if (uTemEspecular > 0.5) {
        spec = clamp(texture(uEspecular, vUV).r / n.a, 0.0, 1.0);
      }
    }
  }
  float aoAmb = mix(1.0, ao, uAO);
  float aoDir = mix(1.0, ao, uAO * 0.5);
  vec3 ext = uTemLuzExterna > 0.5 ? max(texture(uLuzExterna, vLuzCoord).rgb * uEscalaLuz, vec3(0.0)) : vec3(0.0);
  float ndl = max(dot(N, uSolDir), 0.0);
  vec3 corHDR = base * (uAmbiente * aoAmb + (uSolCor * ndl + ext) * aoDir);

  float alfaFinal = c.a;
  if (spec > 0.001) {
    vec3 H = normalize(uSolDir + vec3(0.0, 0.0, 1.0));
    float ndh = max(dot(N, H), 0.0);
    float expo = mix(24.0, 96.0, spec);
    float bril = pow(ndh, expo) * spec * (0.35 + 0.65 * smoothstep(0.0, 0.25, ndl));
    float quente = smoothstep(0.08, 0.28, base.r - base.b) * smoothstep(0.85, 0.95, opac);
    vec3 corSpec = mix(vec3(0.94, 0.97, 1.0), mix(vec3(1.0), base * 1.35, 0.78), quente);
    float pesoSpec = mix(0.85, 1.45, smoothstep(0.5, 0.9, opac));
    corHDR += (uSolCor * pesoSpec + ext * 0.45) * corSpec * bril * aoDir;
    corHDR += base * uSolCor * pow(ndh, 8.0) * spec * quente * 0.42 * aoDir;

    if (opac < 0.92) {
      float transp = 1.0 - smoothstep(0.7, 0.92, opac);
      vec3 reflexoCeu = (uAmbiente + uSolCor * 0.35) * spec * 0.26 * (1.0 - opac * 0.5) * transp;
      corHDR += reflexoCeu;
      float alfaRefl = min(0.28, (bril * 0.35 + spec * 0.08) * transp);
      alfaFinal = clamp(opac + alfaRefl, 0.0, 1.0) * fade;
    }
  }

  vec3 lit = aces(max(corHDR, vec3(0.0)) * uExposicao);
  finalColor = vec4(lit * alfaFinal, alfaFinal);
}`;

/**
 * O telhado fica acima da camada de luz (é ele que esconde o interior), então no Pixel recebe a luz do clima por tinta:
 * ambiente mais metade do sol, cada canal até 1. De dia fica como está; no entardecer e à noite escurece com o resto do mapa.
 */
export function luzSobreOsTelhados(c: Pick<MapaAtlas['climate'], 'ambient' | 'sun'>): number {
  const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
  const a = rgb(c.ambient.color), s = c.sun ? rgb(c.sun.color) : [0, 0, 0], ks = c.sun ? c.sun.intensity * 0.5 : 0;
  const canal = (i: number) => Math.round(Math.max(0.12, Math.min(1, a[i]! * c.ambient.intensity + s[i]! * ks)) * 255);
  return (canal(0) << 16) | (canal(1) << 8) | canal(2);
}

/**
 * Opacidade alvo de um telhado (`room.roof.material !== null`) para uma vista:
 * - No editor (`construir`/`mestre`), `roof.visible === false` esconde o telhado para facilitar edição/narração.
 * - Na vista de jogador/projetor (`jogador`), construções com telhado ficam SEMPRE cobertas quando conhecidas
 *   e fechadas para os jogadores (`!dentro` ou `modoTelhados === 'fechados'`), independentemente de `roof.visible`.
 */
export function alvoDoTelhado(op: {
  vista: Vista;
  modoTelhados: 'auto' | 'fechados' | 'abertos';
  visivelNoMapa: boolean;
  conhecido: boolean;
  dentro: boolean;
  noEditor: boolean;
  forcado: number | null;
}): number {
  if (op.forcado !== null) return op.visivelNoMapa ? op.forcado : 0;
  if (op.vista === 'construir') return op.noEditor && op.visivelNoMapa ? 1 : 0;
  if (op.modoTelhados === 'abertos') return 0;
  if (op.vista === 'mestre') return op.visivelNoMapa ? ALFA_DO_MESTRE : 0;
  return !op.conhecido || (op.modoTelhados !== 'fechados' && op.dentro) ? 0 : 1;
}

export function criarTelhados(op: { baker?: Baker; renderer?: Renderer; luz?: MapaDeLuz; aoPintar?(): void; caixaVisivel?(): { x0: number; y0: number; x1: number; y1: number } | null } = {}): Telhados {
  const raiz = new Container();
  const sombrasC = new Container();
  const mundoCor = new Container();
  const mundoNormal = new Container();
  const mundoEspecular = new Container();
  const saidaSprite = new Sprite(Texture.EMPTY);
  saidaSprite.visible = false;
  mundoNormal.renderable = false;
  mundoEspecular.renderable = false;
  if (op.renderer) mundoCor.renderable = false;
  raiz.addChild(sombrasC, mundoCor, mundoNormal, mundoEspecular, saidaSprite);

  const fachadaRaiz = new Container();
  const fachadaMundoCor = new Container();
  const fachadaSaidaSprite = new Sprite(Texture.EMPTY);
  fachadaSaidaSprite.visible = false;
  if (op.renderer) fachadaMundoCor.renderable = false;
  fachadaRaiz.addChild(fachadaMundoCor, fachadaSaidaSprite);

  const edificios = new Map<string, DoEdificio>();
  const salaParaEdificio = new Map<string, string>();
  const assados = new Map<string, TelhadoEmCache>();
  const coberturas = new Map<string, Texture>();
  const detalhes = new Map<string, DetalheEmCache>();
  const emVoo = new Set<string>();

  const achatar = new ColorMatrixFilter();
  const desfoque = new BlurFilter({ strength: 2, quality: 3 });
  let corSombraAtual = '';

  function atualizarFiltroSombra(cor: string): void {
    if (cor === corSombraAtual) return;
    corSombraAtual = cor;
    const n = hexParaNumero(cor);
    achatar.matrix = [
      0, 0, 0, 0, ((n >> 16) & 255) / 255,
      0, 0, 0, 0, ((n >> 8) & 255) / 255,
      0, 0, 0, 0, (n & 255) / 255,
      0, 0, 0, 1, 0,
    ];
  }

  // Passada GPU de iluminação (criada apenas quando há renderer disponível).
  let gpu: {
    quad: ReturnType<typeof criarQuadUnitario>;
    prog: GlProgram;
    grupo: UniformGroup;
    shader: Shader;
    mesh: Mesh<ReturnType<typeof criarQuadUnitario>, Shader>;
    grupoFachada: UniformGroup;
    shaderFachada: Shader;
    meshFachada: Mesh<ReturnType<typeof criarQuadUnitario>, Shader>;
    textureMatrix: TextureMatrix;
    camAtual: Matrix;
    camInv: Matrix;
    mundoMatriz: Matrix;
    spInv: Matrix;
    corRT: RenderTexture | null;
    normalRT: RenderTexture | null;
    especularRT: RenderTexture | null;
    saidaRT: RenderTexture | null;
    fachadaCorRT: RenderTexture | null;
    fachadaSaidaRT: RenderTexture | null;
    largura: number;
    altura: number;
    resolucao: number;
  } | null = null;

  if (op.renderer) {
    const quad = criarQuadUnitario();
    const criarGrupo = (usarNormalFixa: number) =>
      new UniformGroup({
        uLuzMatriz: { value: new Matrix(), type: 'mat3x3<f32>' },
        uEscalaLuz: { value: 1, type: 'f32' },
        uTemLuzExterna: { value: 0, type: 'f32' },
        uTemEspecular: { value: 0, type: 'f32' },
        uAmbiente: { value: new Float32Array([0.65, 0.65, 0.65]), type: 'vec3<f32>' },
        uSolCor: { value: new Float32Array([0.65, 0.65, 0.65]), type: 'vec3<f32>' },
        uSolDir: { value: new Float32Array([-0.55, -0.55, 0.63]), type: 'vec3<f32>' },
        uRelevo: { value: RELEVO_PADRAO, type: 'f32' },
        uAO: { value: AO_PADRAO, type: 'f32' },
        uExposicao: { value: EXPOSICAO_PADRAO, type: 'f32' },
        uUsarNormalFixa: { value: usarNormalFixa, type: 'f32' },
        uNormalFixa: { value: new Float32Array([0, 0.82, 0.57]), type: 'vec3<f32>' },
      });
    const grupo = criarGrupo(0);
    const grupoFachada = criarGrupo(1);
    const prog = GlProgram.from({
      vertex: VERTEX_TELHADOS,
      fragment: FRAGMENT_TELHADOS,
      preferredFragmentPrecision: 'highp',
      name: 'atlas-telhados-iluminados',
    });
    const shader = new Shader({
      glProgram: prog,
      resources: {
        telhados: grupo,
        uCor: Texture.EMPTY.source,
        uNormal: Texture.EMPTY.source,
        uEspecular: Texture.EMPTY.source,
        uLuzExterna: Texture.EMPTY.source,
      },
    });
    const shaderFachada = new Shader({
      glProgram: prog,
      resources: {
        telhados: grupoFachada,
        uCor: Texture.EMPTY.source,
        uNormal: Texture.EMPTY.source,
        uEspecular: Texture.EMPTY.source,
        uLuzExterna: Texture.EMPTY.source,
      },
    });
    const mesh = new Mesh({ geometry: quad, shader });
    const meshFachada = new Mesh({ geometry: quad, shader: shaderFachada });
    gpu = {
      quad,
      prog,
      grupo,
      shader,
      mesh,
      grupoFachada,
      shaderFachada,
      meshFachada,
      textureMatrix: new TextureMatrix(Texture.WHITE),
      camAtual: new Matrix(),
      camInv: new Matrix(),
      mundoMatriz: new Matrix(),
      spInv: new Matrix(),
      corRT: null,
      normalRT: null,
      especularRT: null,
      saidaRT: null,
      fachadaCorRT: null,
      fachadaSaidaRT: null,
      largura: 0,
      altura: 0,
      resolucao: 0,
    };
  }

  let mapa: MapaAtlas | null = null;
  let climaAtual: Clima | null = null;
  let acabamentoAtual: Acabamento | null = null;
  let atmosferaLigada = true;
  let vista: Vista = 'construir';
  let ultimo = -1;
  let destruido = false;
  let imediato = true;
  let forcado: number | null = null;
  let noEditor = false;

  function chavesAtivas(): Set<string> {
    const s = new Set<string>();
    for (const d of edificios.values()) {
      for (const k of d.chaves) s.add(k);
    }
    return s;
  }

  function coletarCaches(emUso: Set<string>): void {
    for (const [k, a] of assados) {
      if (emUso.has(k)) continue;
      a.cor.destroy(true);
      a.normal?.destroy(true);
      a.especular?.destroy(true);
      a.fachada?.destroy(true);
      assados.delete(k);
    }
    for (const [k, tex] of coberturas) {
      if (emUso.has(k)) continue;
      tex.destroy(true);
      coberturas.delete(k);
    }
    for (const [k, det] of detalhes) {
      if (emUso.has(k)) continue;
      det.tex.destroy(true);
      detalhes.delete(k);
    }
  }

  function redesenharPorChave(chave: string): void {
    const m = mapa; if (!m || destruido) return;
    let tocou = false;
    const ctx = contextoDeEntradas(m);
    for (const d of edificios.values()) {
      if (d.chaves.has(chave)) { desenharEdificio(d, m, ctx); tocou = true; }
    }
    coletarCaches(chavesAtivas());
    if (tocou) op.aoPintar?.();
  }

  /** O telhado toca o que a câmera mostra? Sem câmera conhecida, sim. */
  function telhadoNaTela(entrada: EntradaDoTelhado): boolean {
    const v = op.caixaVisivel?.();
    if (!v) return true;
    const { size, offset } = entrada.grade;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of entrada.trechos) {
      for (const [cx, cy] of t.celulas) {
        const x = offset[0] + cx * size, y = offset[1] + cy * size;
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x + size > x1) x1 = x + size; if (y + size > y1) y1 = y + size;
      }
      for (const [x, y] of t.outline ?? []) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    }
    if (x0 === Infinity) return true;
    return x1 >= v.x0 && x0 <= v.x1 && y1 >= v.y0 && y0 <= v.y1;
  }

  function pedirTelhado(chave: string, entrada: EntradaDoTelhado, res: number, estilo: IdDoEstilo): TelhadoEmCache | null {
    const pronto = assados.get(chave);
    if (pronto) return pronto;
    if (!op.baker || emVoo.has(chave)) return null;
    emVoo.add(chave);
    op.baker.pedir(chave, { tipo: 'telhado', entrada, res, estilo }, telhadoNaTela(entrada) ? 3 : 6).then(r => {
      emVoo.delete(chave);
      if (destruido) return;
      const cor = texturaPropria(r.bitmap);
      cor.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      const normal = r.normal ? texturaPropria(r.normal) : null;
      if (normal) normal.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      const especular = r.altura ? texturaPropria(r.altura) : null;
      if (especular) especular.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      const fachada = r.fachada ? texturaPropria(r.fachada) : null;
      if (fachada) fachada.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      assados.set(chave, { cor, normal, especular, fachada, origem: r.origem, res: r.res });
      redesenharPorChave(chave);
    }).catch(erro => {
      emVoo.delete(chave);
      if (erro instanceof ErroDeBakeCancelado) {
        // O `coletar` cancelou porque a chave saiu de uso, mas ela pode ter voltado (porta aberta e fechada de novo):
        // sem um novo pedido o edifício ficaria para sempre na prévia vetorial (top-view, sem fachada).
        if (!destruido && mapa) {
          const m = mapa;
          const ctx = contextoDeEntradas(m);
          let tocou = false;
          for (const d of edificios.values()) {
            if (d.chaveAssado === chave) { desenharEdificio(d, m, ctx); tocou = true; }
          }
          if (tocou) op.aoPintar?.();
        }
        return;
      }
      console.warn('Atlas: falha ao assar telhado', erro);
    });
    return null;
  }

  function pedirCobertura(chave: string, material: string, res: number, estilo: IdDoEstilo): Texture | null {
    const pronta = coberturas.get(chave);
    if (pronta) return pronta;
    if (!op.baker || emVoo.has(chave)) return null;
    emVoo.add(chave);
    op.baker.pedir(chave, { tipo: 'cobertura', material, seed: 1, res, estilo }).then(r => {
      emVoo.delete(chave);
      if (destruido) return;
      const tex = texturaPropria(r.bitmap);
      tex.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      coberturas.set(chave, tex);
      redesenharPorChave(chave);
    }).catch(erro => {
      emVoo.delete(chave);
      if (erro instanceof ErroDeBakeCancelado) return;
      console.warn('Atlas: falha ao assar cobertura de telhado', erro);
    });
    return null;
  }

  function pedirDetalhe(
    chave: string,
    detalhe: DetalheDeTelhado,
    cobertura: string,
    seed: number,
    res: number,
    estilo: IdDoEstilo,
    pixel?: OpcoesDoPixel,
  ): DetalheEmCache | null {
    const pronto = detalhes.get(chave);
    if (pronto) return pronto;
    if (!op.baker || emVoo.has(chave)) return null;
    emVoo.add(chave);
    op.baker.pedir(chave, { tipo: 'detalhe-de-telhado', detalhe, cobertura, seed, res, estilo, pixel }).then(r => {
      emVoo.delete(chave);
      if (destruido) return;
      const tex = texturaPropria(r.bitmap);
      tex.source.scaleMode = estilo === 'pixel' ? 'nearest' : 'linear';
      detalhes.set(chave, { tex, origem: r.origem, res: r.res });
      redesenharPorChave(chave);
    }).catch(erro => {
      emVoo.delete(chave);
      if (erro instanceof ErroDeBakeCancelado) return;
      console.warn('Atlas: falha ao assar detalhe de telhado', erro);
    });
    return null;
  }

  function atualizarSombra(d: DoEdificio, m: MapaAtlas, clima: Clima, assado: TelhadoEmCache | null): void {
    const pixel = m.style.renderer === 'pixel';
    const sSol = atmosferaLigada ? sombraDoSol(clima, pixel) : null;
    if (!sSol) {
      d.sombraAlfaBase = 0;
      d.sombraC.visible = false;
      d.sombraG.clear();
      d.sombraG.visible = false;
      if (d.sombraSp) { d.sombraSp.visible = false; d.sombraSp.texture = Texture.EMPTY; }
      return;
    }

    atualizarFiltroSombra(sSol.cor);
    const dist = Math.min(2.8, Math.max(0.35, (d.hMax - ALTURA_BASE_TELHADO) * 0.55 * sSol.porMetro));
    const dx = sSol.dir[0] * dist;
    const dy = sSol.dir[1] * dist;
    d.sombraAlfaBase = Math.max(0.35, sSol.alfa);
    d.sombraC.alpha = d.sombraAlfaBase * d.alfa;
    d.sombraC.visible = d.alfa > 0.001;

    if (assado) {
      d.sombraG.clear();
      d.sombraG.visible = false;
      if (!d.sombraSp) {
        d.sombraSp = new Sprite(assado.cor);
        d.sombraC.addChild(d.sombraSp);
      } else {
        d.sombraSp.texture = assado.cor;
      }
      d.sombraSp.position.set(assado.origem[0] + dx, assado.origem[1] + dy);
      d.sombraSp.scale.set(1 / assado.res);
      d.sombraSp.filters = pixel ? [achatar] : [achatar, desfoque];
      d.sombraSp.visible = true;
      return;
    }

    if (d.sombraSp) { d.sombraSp.visible = false; d.sombraSp.texture = Texture.EMPTY; }
    d.sombraG.clear();
    d.sombraG.visible = true;
    d.sombraG.filters = pixel ? [] : [desfoque];
    const trechos = trechosDe(m, d.ed);
    const t = m.grid.size, [ox, oy] = m.grid.offset, beiral = 0.25;
    for (const trecho of trechos) {
      if (trecho.outline && trecho.outline.length >= 3) {
        const ext = expandirContorno(trecho.outline, beiral);
        if (ext.length >= 3) d.sombraG.poly(ext.flatMap(([px, py]) => [px + dx, py + dy]));
      } else {
        for (const [rx0, ry0, rx1, ry1] of retangulosDe(trecho.celulas)) {
          d.sombraG.rect(
            ox + rx0 * t - beiral + dx,
            oy + ry0 * t - beiral + dy,
            (rx1 - rx0) * t + beiral * 2,
            (ry1 - ry0) * t + beiral * 2,
          );
        }
      }
    }
    d.sombraG.fill({ color: hexParaNumero(sSol.cor) });
  }

  function desenharPreviaVetorial(d: DoEdificio, m: MapaAtlas, clima: Clima): void {
    const estilo = m.style.renderer, pixel = estilo === 'pixel', pxOpts = opcoesDoPixel(m);
    const resCob = pixel ? Math.max(1, m.style.pixel.pixelsPerCell / m.grid.size) : RES_DA_COBERTURA;
    const resDet = resolucaoDe(m, 'objeto');
    const sun = clima.sun;
    const dirDoSol: [number, number] = sun ? [Math.cos(sun.angle), -Math.sin(sun.angle)] : [-Math.SQRT1_2, -Math.SQRT1_2];
    const trechos = trechosDe(m, d.ed);
    const t = m.grid.size, [ox, oy] = m.grid.offset, beiral = 0.25;

    for (const trecho of trechos) {
      const g = new Graphics();
      d.corC.addChild(g);
      const mat = materialDe(trecho.roof.material ?? '');
      const base = hexParaNumero(mat.base), escuro = hexParaNumero(mat.escuro), claro = hexParaNumero(mat.claro);
      const forma = formaDe(trecho.roof);
      let tex: Texture | null = null;
      if (ehPadraoDeCobertura(mat.padrao)) {
        const kCob = chaveCobertura(mat.id, resCob, estilo);
        d.chaves.add(kCob);
        tex = pedirCobertura(kCob, mat.id, resCob, estilo);
      }

      const { faces, cumeeiras } = aguasDoTrecho(trecho, m.grid, beiral);
      const alfaBase = trecho.roof.steep ? 0.28 : 0.18;

      for (const face of faces) {
        if (face.platibanda) {
          const split = face.pontos.findIndex((p, i) => i > 0 && p[0] === face.pontos[0]![0] && p[1] === face.pontos[0]![1]);
          const outer = (split > 0 ? face.pontos.slice(0, split) : face.pontos.slice(0, 4)).flat();
          const inner = (split > 0 ? face.pontos.slice(split + 1, -1) : face.pontos.slice(5, 9)).flat();
          g.poly(outer).fill({ color: escuro }).poly(inner).cut();
          let ix0 = Infinity, iy0 = Infinity, ix1 = -Infinity, iy1 = -Infinity;
          for (let i = 0; i < inner.length; i += 2) {
            const x = inner[i]!, y = inner[i + 1]!;
            if (x < ix0) ix0 = x; if (y < iy0) iy0 = y;
            if (x > ix1) ix1 = x; if (y > iy1) iy1 = y;
          }
          const w = ix1 - ix0, h = iy1 - iy0;
          const sx = -dirDoSol[0] * 0.22, sy = -dirDoSol[1] * 0.22;
          if (w > 0 && h > 0) {
            if (split > 4) {
              const innerPts = face.pontos.slice(split + 1, -1);
              g.poly(inner).fill({ color: 0x000000, alpha: 0.24 }).poly(innerPts.flatMap(([x, y]) => [x + sx, y + sy])).cut();
            } else {
              const lx = ix0 + Math.max(0, sx), ly = iy0 + Math.max(0, sy);
              const lw = Math.max(0, w - Math.abs(sx)), lh = Math.max(0, h - Math.abs(sy));
              if (lw > 0 && lh > 0) g.rect(ix0, iy0, w, h).fill({ color: 0x000000, alpha: 0.24 }).rect(lx, ly, lw, lh).cut();
              else g.rect(ix0, iy0, w, h).fill({ color: 0x000000, alpha: 0.24 });
            }
          }
          continue;
        }

        const pts = face.pontos.flat();
        if (tex) {
          const ang = Math.atan2(face.queda[1], face.queda[0]) - Math.PI / 2;
          const escala = PERIODO_DA_COBERTURA / tex.width;
          const matrix = new Matrix().scale(escala, escala).rotate(ang);
          g.poly(pts).fill({ texture: tex, matrix, textureSpace: 'global' });
        } else {
          g.poly(pts).fill({ color: base });
        }

        const dot = face.normal[0] * dirDoSol[0] + face.normal[1] * dirDoSol[1];
        if (dot > 0.001) g.poly(pts).fill({ color: 0xffffff, alpha: alfaBase * dot });
        else if (dot < -0.001) g.poly(pts).fill({ color: 0x000000, alpha: alfaBase * -dot });
      }

      if (cumeeiras.length && forma.shape !== 'cone') {
        for (const [[x0, y0], [x1, y1]] of cumeeiras) g.moveTo(x0, y0).lineTo(x1, y1);
        g.stroke({ width: 0.12, color: claro, cap: 'round' });
      }

      if (forma.shape === 'duas-aguas' && !trecho.outline) {
        for (const [rx0, ry0, rx1, ry1] of retangulosDe(trecho.celulas)) {
          const x0 = ox + rx0 * t - beiral, y0 = oy + ry0 * t - beiral;
          const x1 = ox + rx1 * t + beiral, y1 = oy + ry1 * t + beiral;
          const horiz = forma.ridge === 'h' || (forma.ridge === 'auto' && (x1 - x0) >= (y1 - y0));
          if (horiz) g.moveTo(x0, y0).lineTo(x0, y1).moveTo(x1, y0).lineTo(x1, y1);
          else g.moveTo(x0, y0).lineTo(x1, y0).moveTo(x0, y1).lineTo(x1, y1);
        }
        g.stroke({ width: 0.08, color: escuro, cap: 'round' });
      }

      const semente = m.rooms[trecho.salas[0]!]?.floor.seed ?? 1;
      for (const pos of posicoesDosDetalhes(trecho, m.grid, semente)) {
        const kDet = chaveDetalhe(pos.detalhe, mat.id, semente, resDet, estilo, pxOpts);
        d.chaves.add(kDet);
        const pronto = pedirDetalhe(kDet, pos.detalhe, mat.id, semente, resDet, estilo, pxOpts);
        if (!pronto) continue;
        const wrap = new Container();
        wrap.position.set(pos.x, pos.y);
        wrap.rotation = pos.ang;
        const sp = new Sprite(pronto.tex);
        sp.position.set(pronto.origem[0], pronto.origem[1]);
        sp.scale.set(1 / pronto.res);
        wrap.addChild(sp);
        d.corC.addChild(wrap);
      }
    }
  }

  function desenharEdificio(d: DoEdificio, m: MapaAtlas, ctx: ContextoDeEntradas): void {
    for (const ch of d.corC.removeChildren()) ch.destroy({ children: true });
    for (const ch of d.normalC.removeChildren()) ch.destroy({ children: true });
    for (const ch of d.especularC.removeChildren()) ch.destroy({ children: true });
    for (const ch of d.fachadaC.removeChildren()) ch.destroy({ children: true });
    d.chaves.clear();

    const estilo = m.style.renderer, pixel = estilo === 'pixel';
    const resTelhado = pixel ? Math.max(1, m.style.pixel.pixelsPerCell / m.grid.size) : RES_DO_TELHADO;
    const entrada = entradaDoTelhado(m, d.ed, ctx);
    const chave = chaveDoTelhado(entrada, resTelhado, estilo);
    const campo = campoDoEdificio(m, d.ed);
    d.hMax = Number.isFinite(campo.alturaMaxima) ? campo.alturaMaxima : ALTURA_BASE_TELHADO + 1.2;
    d.chaveAssado = chave;
    d.chaves.add(chave);

    const assado = pedirTelhado(chave, entrada, resTelhado, estilo);
    const clima = climaAtual ?? m.climate;

    if (assado) {
      const spCor = new Sprite(assado.cor);
      spCor.position.set(assado.origem[0], assado.origem[1]);
      spCor.scale.set(1 / assado.res);
      d.corC.addChild(spCor);

      if (assado.normal) {
        const spNorm = new Sprite(assado.normal);
        spNorm.position.set(assado.origem[0], assado.origem[1]);
        spNorm.scale.set(1 / assado.res);
        d.normalC.addChild(spNorm);
      }

      if (assado.especular) {
        const spSpec = new Sprite(assado.especular);
        spSpec.position.set(assado.origem[0], assado.origem[1]);
        spSpec.scale.set(1 / assado.res);
        d.especularC.addChild(spSpec);
      }

      if (assado.fachada) {
        const spFac = new Sprite(assado.fachada);
        spFac.position.set(assado.origem[0], assado.origem[1]);
        spFac.scale.set(1 / assado.res);
        d.fachadaC.addChild(spFac);
      }
    } else {
      desenharPreviaVetorial(d, m, clima);
    }

    atualizarSombra(d, m, clima, assado);
  }

  function sincronizarOpacidade(d: DoEdificio): void {
    const vis = d.alfa > 0.001;
    d.corC.alpha = d.alfa;
    d.corC.visible = vis;
    d.normalC.alpha = d.alfa;
    d.normalC.visible = vis;
    d.especularC.alpha = d.alfa;
    d.especularC.visible = vis;
    d.fachadaC.alpha = d.alfa;
    d.fachadaC.visible = vis;
    d.sombraC.alpha = d.sombraAlfaBase * d.alfa;
    d.sombraC.visible = vis && atmosferaLigada && d.sombraAlfaBase > 0;
  }

  function atualizarPassada(): void {
    const renderer = op.renderer;
    const m = mapa;
    if (!renderer || !gpu || !m || destruido) return;
    const pixel = m.style.renderer === 'pixel';
    if (pixel) {
      const tinta = luzSobreOsTelhados(climaAtual ?? m.climate);
      saidaSprite.visible = false;
      mundoCor.renderable = true;
      mundoNormal.renderable = false;
      mundoEspecular.renderable = false;
      mundoCor.tint = tinta;
      fachadaSaidaSprite.visible = false;
      fachadaMundoCor.renderable = true;
      fachadaMundoCor.tint = tinta;
      return;
    }

    mundoCor.tint = 0xffffff;
    fachadaMundoCor.tint = 0xffffff;
    let algumVisivel = false;
    let algumEspecularVisivel = false;
    let algumaFachadaVisivel = false;
    for (const d of edificios.values()) {
      if (d.alfa > 0.001) {
        algumVisivel = true;
        if (d.especularC.children.length > 0) algumEspecularVisivel = true;
        if (d.fachadaC.children.length > 0) algumaFachadaVisivel = true;
      }
    }
    if (!algumVisivel) {
      saidaSprite.visible = false;
      mundoCor.renderable = false;
      mundoNormal.renderable = false;
      mundoEspecular.renderable = false;
      fachadaSaidaSprite.visible = false;
      fachadaMundoCor.renderable = false;
      return;
    }

    const w = Math.max(1, Math.round(renderer.screen.width));
    const h = Math.max(1, Math.round(renderer.screen.height));
    const r = renderer.resolution || 1;
    const redimensionar = !gpu.corRT || !gpu.normalRT || !gpu.saidaRT || w !== gpu.largura || h !== gpu.altura || r !== gpu.resolucao;
    if (redimensionar) {
      gpu.corRT?.destroy(true);
      gpu.normalRT?.destroy(true);
      gpu.especularRT?.destroy(true);
      gpu.saidaRT?.destroy(true);
      gpu.fachadaCorRT?.destroy(true);
      gpu.fachadaSaidaRT?.destroy(true);
      gpu.corRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
      gpu.normalRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
      gpu.especularRT = null;
      gpu.saidaRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
      gpu.fachadaCorRT = null;
      gpu.fachadaSaidaRT = null;
      saidaSprite.texture = gpu.saidaRT;
      fachadaSaidaSprite.texture = Texture.EMPTY;
      gpu.mesh.scale.set(w, h);
      gpu.meshFachada.scale.set(w, h);
      gpu.largura = w;
      gpu.altura = h;
      gpu.resolucao = r;
    }

    atualizarTransformDoMundo(raiz, gpu.camAtual);
    gpu.camInv.copyFrom(gpu.camAtual).invert();

    mundoCor.renderable = true;
    renderer.render({ container: mundoCor, target: gpu.corRT!, transform: gpu.camAtual, clear: true, clearColor: [0, 0, 0, 0] });
    mundoCor.renderable = false;

    mundoNormal.renderable = true;
    renderer.render({ container: mundoNormal, target: gpu.normalRT!, transform: gpu.camAtual, clear: true, clearColor: [0, 0, 0, 0] });
    mundoNormal.renderable = false;

    if (algumEspecularVisivel) {
      if (!gpu.especularRT) {
        gpu.especularRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
      }
      mundoEspecular.renderable = true;
      renderer.render({ container: mundoEspecular, target: gpu.especularRT, transform: gpu.camAtual, clear: true, clearColor: [0, 0, 0, 0] });
      mundoEspecular.renderable = false;
    }

    const u = gpu.grupo.uniforms as {
      uLuzMatriz: Matrix;
      uEscalaLuz: number;
      uTemLuzExterna: number;
      uTemEspecular: number;
      uAmbiente: Float32Array;
      uSolCor: Float32Array;
      uSolDir: Float32Array;
      uRelevo: number;
      uAO: number;
      uExposicao: number;
      uUsarNormalFixa: number;
      uNormalFixa: Float32Array;
    };

    gpu.mundoMatriz.set(gpu.largura, 0, 0, gpu.altura, 0, 0).prepend(gpu.camInv);

    const luz = op.luz;
    const extTex = luz?.luzExterna;
    const spLuz = luz?.sprite;
    const baseTex = spLuz?.texture;
    const extPronta = Boolean(
      atmosferaLigada &&
      luz &&
      spLuz &&
      extTex && !extTex.destroyed && extTex.source && !extTex.source.destroyed && extTex !== Texture.EMPTY &&
      baseTex && !baseTex.destroyed && baseTex.source && !baseTex.source.destroyed && baseTex !== Texture.EMPTY,
    );
    if (extPronta && luz && spLuz && extTex) {
      gpu.textureMatrix.texture = extTex;
      spLuz.updateLocalTransform();
      gpu.spInv.copyFrom(spLuz.localTransform).invert();
      u.uLuzMatriz
        .copyFrom(gpu.mundoMatriz)
        .prepend(gpu.spInv)
        .scale(1 / Math.max(1, extTex.orig.width), 1 / Math.max(1, extTex.orig.height))
        .translate(spLuz.anchor.x, spLuz.anchor.y)
        .prepend(gpu.textureMatrix.mapCoord);
      u.uEscalaLuz = luz.escala;
      u.uTemLuzExterna = 1;
      gpu.shader.resources.uLuzExterna = extTex.source;
    } else {
      u.uLuzMatriz.identity();
      u.uEscalaLuz = 1;
      u.uTemLuzExterna = 0;
      gpu.shader.resources.uLuzExterna = Texture.EMPTY.source;
    }

    const clima = climaAtual ?? m.climate;
    const finish = acabamentoAtual ?? m.finish;

    let ambR = 0.65, ambG = 0.65, ambB = 0.65;
    let solR = 0.65, solG = 0.65, solB = 0.65;
    let dirL: [number, number, number] = normalizar3(-0.55, -0.55, 0.63);

    if (atmosferaLigada) {
      let ambLuz: readonly [number, number, number];
      if (luz) {
        ambLuz = luz.ambiente;
      } else {
        const [ar, ag, ab] = rgb01(clima.ambient.color);
        ambLuz = [ar * clima.ambient.intensity, ag * clima.ambient.intensity, ab * clima.ambient.intensity];
      }
      const lumAmb = 0.299 * ambLuz[0] + 0.587 * ambLuz[1] + 0.114 * ambLuz[2];
      if (clima.sun) {
        const sun = clima.sun;
        const hora = lerHorario(clima.time);
        const noite = ehNoite({ climate: clima });
        const [sr, sg, sb] = rgb01(sun.color);
        if (!noite) {
          const elev = clamp(elevacaoDoSol(hora), 0.42, 0.76);
          dirL = normalizar3(Math.cos(sun.angle) * Math.cos(elev), -Math.sin(sun.angle) * Math.cos(elev), Math.sin(elev));
          const fatorAmb = 1 + (0.52 - 1) * clamp(sun.intensity, 0, 1);
          ambR = ambLuz[0] * fatorAmb;
          ambG = ambLuz[1] * fatorAmb;
          ambB = ambLuz[2] * fatorAmb;
          const kSol = 0.92 * sun.intensity * (0.25 + 0.75 * clamp(lumAmb, 0, 1));
          solR = sr * kSol;
          solG = sg * kSol;
          solB = sb * kSol;
        } else {
          const elev = clamp(elevacaoDaLua(hora), 0.42, 0.76);
          dirL = normalizar3(Math.cos(sun.angle) * Math.cos(elev), -Math.sin(sun.angle) * Math.cos(elev), Math.sin(elev));
          ambR = ambLuz[0] * 0.85;
          ambG = ambLuz[1] * 0.85;
          ambB = ambLuz[2] * 0.85;
          const kSol = 0.22 * sun.intensity * Math.max(lumAmb, 0.12);
          solR = sr * kSol;
          solG = sg * kSol;
          solB = sb * kSol;
        }
      } else {
        ambR = ambLuz[0] * 0.65;
        ambG = ambLuz[1] * 0.65;
        ambB = ambLuz[2] * 0.65;
        solR = ambR;
        solG = ambG;
        solB = ambB;
      }
    }

    u.uAmbiente[0] = ambR;
    u.uAmbiente[1] = ambG;
    u.uAmbiente[2] = ambB;
    u.uSolCor[0] = solR;
    u.uSolCor[1] = solG;
    u.uSolCor[2] = solB;
    u.uSolDir[0] = dirL[0];
    u.uSolDir[1] = dirL[1];
    u.uSolDir[2] = dirL[2];
    u.uRelevo = clamp(finish.relief ?? RELEVO_PADRAO, 0, 1);
    u.uAO = clamp(finish.ao ?? AO_PADRAO, 0, 1);
    u.uExposicao = clamp(finish.exposure ?? EXPOSICAO_PADRAO, 0, 4);

    u.uUsarNormalFixa = 0;
    u.uTemEspecular = algumEspecularVisivel ? 1 : 0;
    gpu.shader.resources.uCor = gpu.corRT!.source;
    gpu.shader.resources.uNormal = gpu.normalRT!.source;
    gpu.shader.resources.uEspecular = algumEspecularVisivel && gpu.especularRT ? gpu.especularRT.source : Texture.EMPTY.source;
    renderer.render({ container: gpu.mesh, target: gpu.saidaRT!, clear: true, clearColor: [0, 0, 0, 0] });

    saidaSprite.setFromMatrix(gpu.camInv);
    saidaSprite.visible = true;

    if (algumaFachadaVisivel) {
      if (!gpu.fachadaCorRT || !gpu.fachadaSaidaRT) {
        gpu.fachadaCorRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
        gpu.fachadaSaidaRT = RenderTexture.create({ width: w, height: h, resolution: r, scaleMode: 'linear' });
        fachadaSaidaSprite.texture = gpu.fachadaSaidaRT;
      }
      fachadaMundoCor.renderable = true;
      renderer.render({ container: fachadaMundoCor, target: gpu.fachadaCorRT, transform: gpu.camAtual, clear: true, clearColor: [0, 0, 0, 0] });
      fachadaMundoCor.renderable = false;

      const uf = gpu.grupoFachada.uniforms as typeof u;
      uf.uLuzMatriz.copyFrom(u.uLuzMatriz);
      uf.uEscalaLuz = u.uEscalaLuz;
      uf.uTemLuzExterna = u.uTemLuzExterna;
      uf.uTemEspecular = 0;
      uf.uAmbiente[0] = u.uAmbiente[0]!;
      uf.uAmbiente[1] = u.uAmbiente[1]!;
      uf.uAmbiente[2] = u.uAmbiente[2]!;
      uf.uSolCor[0] = u.uSolCor[0]!;
      uf.uSolCor[1] = u.uSolCor[1]!;
      uf.uSolCor[2] = u.uSolCor[2]!;
      uf.uSolDir[0] = u.uSolDir[0]!;
      uf.uSolDir[1] = u.uSolDir[1]!;
      uf.uSolDir[2] = u.uSolDir[2]!;
      uf.uRelevo = u.uRelevo;
      uf.uAO = u.uAO;
      uf.uExposicao = u.uExposicao;
      uf.uUsarNormalFixa = 1;
      uf.uNormalFixa[0] = 0;
      uf.uNormalFixa[1] = 0.82;
      uf.uNormalFixa[2] = 0.57;
      gpu.shaderFachada.resources.uLuzExterna = gpu.shader.resources.uLuzExterna;
      gpu.shaderFachada.resources.uCor = gpu.fachadaCorRT.source;
      gpu.shaderFachada.resources.uNormal = Texture.EMPTY.source;
      gpu.shaderFachada.resources.uEspecular = Texture.EMPTY.source;
      renderer.render({ container: gpu.meshFachada, target: gpu.fachadaSaidaRT, clear: true, clearColor: [0, 0, 0, 0] });

      fachadaSaidaSprite.setFromMatrix(gpu.camInv);
      fachadaSaidaSprite.visible = true;
    } else {
      fachadaSaidaSprite.visible = false;
      fachadaMundoCor.renderable = false;
    }
  }

  /** Calcula a opacidade alvo de um telhado conforme a vista e as regras da sessão. */
  function alvoDe(d: DoEdificio): number {
    return alvoDoTelhado({
      vista,
      modoTelhados: mapa?.session.roofs ?? 'auto',
      visivelNoMapa: d.visivelNoMapa,
      conhecido: d.conhecido,
      dentro: d.dentro,
      noEditor,
      forcado,
    });
  }

  let filtroVisao: FiltroDeVisao | null = null;
  let minhasFichas: readonly string[] | null = null;

  function reavaliar(): void {
    const m = mapa; if (!m) return;
    // Um telhado que ninguém viu continua escondido: só se mostra o de uma casa de que algum pedaço está à vista ou explorado.
    const conhecidos = vista === 'jogador' && edificios.size ? comodosConhecidos(m, filtroVisao, minhasFichas) : null;
    const poligonos = vista === 'jogador' && edificios.size ? poligonosDeVisao(m, filtroVisao, minhasFichas) : null;
    const jogadores = vista === 'jogador'
      ? tokensDeVisaoAtivos(m, filtroVisao, minhasFichas)
      : Object.values(m.tokens).filter(p => p.player);
    for (const d of edificios.values()) {
      d.dentro = jogadorDentroDoEdificio(m, d.ed, jogadores);
      d.conhecido = !conhecidos || d.ed.salas.some(id => conhecidos.has(id)) || (poligonos !== null && edificioTocadoPorPoligonos(m, d.ed, poligonos));
      d.visivelNoMapa = d.ed.salas.some(id => m.rooms[id]?.roof.visible);
      d.alvo = alvoDe(d);
      if (imediato || forcado !== null || movimentoReduzido()) {
        d.alfa = d.alvo;
        sincronizarOpacidade(d);
      }
    }
  }

  return {
    raiz,
    fachadaRaiz,
    sincronizar(m, mud) {
      mapa = m;
      climaAtual = m.climate;
      acabamentoAtual = m.finish;
      const pixel = m.style.renderer === 'pixel';
      if (pixel || !op.renderer) {
        const tinta = luzSobreOsTelhados(m.climate);
        mundoCor.tint = tinta;
        mundoCor.renderable = true;
        saidaSprite.visible = false;
        fachadaMundoCor.tint = tinta;
        fachadaMundoCor.renderable = true;
        fachadaSaidaSprite.visible = false;
      } else {
        mundoCor.tint = 0xffffff;
        fachadaMundoCor.tint = 0xffffff;
      }
      const redesenhar =
        !mud ||
        mud.completo ||
        Boolean(mud.colecoes.rooms) ||
        Boolean(mud.colecoes.walls) ||
        Boolean(mud.colecoes.openings) ||
        mud.campos.some(c => c === 'grid' || c === 'climate' || c === 'style');
      if (redesenhar) {
        const eds = edificiosDe(m);
        const ids = new Set(eds.map(e => e.id));
        for (const [id, d] of edificios) {
          if (!ids.has(id)) {
            d.corC.destroy({ children: true });
            d.normalC.destroy({ children: true });
            d.especularC.destroy({ children: true });
            d.fachadaC.destroy({ children: true });
            d.sombraC.destroy({ children: true });
            edificios.delete(id);
          }
        }
        salaParaEdificio.clear();
        const ctx = contextoDeEntradas(m);
        for (const ed of eds) {
          let d = edificios.get(ed.id);
          if (!d) {
            const corC = new Container();
            const normalC = new Container();
            const especularC = new Container();
            const fachadaC = new Container();
            const sombraC = new Container();
            const sombraG = new Graphics();
            sombraC.addChild(sombraG);
            corC.visible = false;
            normalC.visible = false;
            especularC.visible = false;
            fachadaC.visible = false;
            sombraC.visible = false;
            mundoCor.addChild(corC);
            mundoNormal.addChild(normalC);
            mundoEspecular.addChild(especularC);
            fachadaMundoCor.addChild(fachadaC);
            sombrasC.addChild(sombraC);
            d = {
              ed,
              corC,
              normalC,
              especularC,
              fachadaC,
              sombraC,
              sombraG,
              sombraSp: null,
              sombraAlfaBase: 0,
              chaveAssado: '',
              hMax: ALTURA_BASE_TELHADO + 1.2,
              chaves: new Set(),
              alfa: 0,
              alvo: 0,
              dentro: false,
              conhecido: false,
              visivelNoMapa: true,
            };
            edificios.set(ed.id, d);
          } else {
            d.ed = ed;
          }
          for (const salaId of ed.salas) salaParaEdificio.set(salaId, ed.id);
          desenharEdificio(d, m, ctx);
        }
        coletarCaches(chavesAtivas());
      }
      reavaliar();
      imediato = false;
    },
    atualizarClima(m) {
      if (destruido) return;
      climaAtual = m.climate;
      acabamentoAtual = m.finish;
      const base = mapa ?? m;
      if (base.style.renderer === 'pixel' || !op.renderer) {
        const tinta = luzSobreOsTelhados(m.climate);
        mundoCor.tint = tinta;
        fachadaMundoCor.tint = tinta;
      }
      for (const d of edificios.values()) {
        atualizarSombra(d, base, m.climate, assados.get(d.chaveAssado) ?? null);
      }
    },
    definirAtmosfera(ligada) {
      if (atmosferaLigada === ligada) return;
      atmosferaLigada = ligada;
      const m = mapa;
      if (!m) return;
      const clima = climaAtual ?? m.climate;
      for (const d of edificios.values()) {
        atualizarSombra(d, m, clima, assados.get(d.chaveAssado) ?? null);
      }
    },
    definirVista(v) { if (v === vista) return; vista = v; imediato = true; reavaliar(); imediato = false; },
    definirFiltroDeVisao(f, fichas) {
      filtroVisao = f ?? null;
      minhasFichas = fichas ?? null;
      if (vista === 'jogador') { imediato = true; reavaliar(); imediato = false; }
    },
    definirNoEditor(v) { if (v === noEditor) return; noEditor = v; reavaliar(); },
    forcar(alfa) { forcado = alfa; imediato = true; reavaliar(); imediato = false; },
    quadro(agora) {
      if (destruido) return;
      const dt = ultimo < 0 ? 0 : Math.min(0.1, (agora - ultimo) / 1000); ultimo = agora;
      for (const d of edificios.values()) {
        if (d.alfa === d.alvo) continue;
        const passo = movimentoReduzido() ? 1 : dt / DURACAO_DO_TELHADO;
        d.alfa = d.alfa < d.alvo ? Math.min(d.alvo, d.alfa + passo) : Math.max(d.alvo, d.alfa - passo);
        sincronizarOpacidade(d);
      }
      atualizarPassada();
    },
    diagnostico: () => {
      const out: { id: string; edificio: string; alfa: number; alvo: number; dentro: boolean; conhecido: boolean }[] = [];
      for (const d of edificios.values()) {
        for (const id of d.ed.salas) out.push({ id, edificio: d.ed.id, alfa: d.alfa, alvo: d.alvo, dentro: d.dentro, conhecido: d.conhecido });
      }
      return out;
    },
    visivel: (salaId: string) => {
      const edId = salaParaEdificio.get(salaId);
      const d = edId ? edificios.get(edId) : undefined;
      return !!d && d.corC.visible && d.alfa > 0.3;
    },
    chavesEmUso: () => {
      const s = chavesAtivas();
      coletarCaches(s);
      return s;
    },
    destruir() {
      destruido = true;
      for (const a of assados.values()) {
        a.cor.destroy(true);
        a.normal?.destroy(true);
        a.especular?.destroy(true);
        a.fachada?.destroy(true);
      }
      assados.clear();
      for (const tex of coberturas.values()) tex.destroy(true);
      coberturas.clear();
      for (const det of detalhes.values()) det.tex.destroy(true);
      detalhes.clear();
      emVoo.clear();
      achatar.destroy();
      desfoque.destroy();
      if (gpu) {
        gpu.corRT?.destroy(true);
        gpu.normalRT?.destroy(true);
        gpu.especularRT?.destroy(true);
        gpu.saidaRT?.destroy(true);
        gpu.fachadaCorRT?.destroy(true);
        gpu.fachadaSaidaRT?.destroy(true);
        gpu.textureMatrix.destroy();
        gpu.mesh.destroy();
        gpu.meshFachada.destroy();
        gpu.shader.destroy(false);
        gpu.shaderFachada.destroy(false);
        gpu.prog.destroy();
        gpu.quad.destroy(true);
        gpu = null;
      }
      fachadaRaiz.destroy({ children: true });
      raiz.destroy({ children: true });
    },
  };
}
