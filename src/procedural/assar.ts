import { ALTURA_MAXIMA, temAlturaPropria, PISO_NO_MAPA, RAIO_PASSA_ALTA, alturaPorLuminancia, desenharAlturaDasPartes, pintarAlturaDoMaterial } from './altura.ts';
import { contornoDoComodo, caixaDasCelulas } from '../domain/geometria.ts';
import {
  AMPLIACAO_NA_FACE,
  ampliarNaFace,
  aoLongoDoSegmento,
  calcularFacesDasParedes,
  desenharFacesDasParedes,
  partesDaAbertura,
  profundidadeDaFace,
  type AberturaDaFace,
  type ObjetoDaFace,
  type ParedeDaSala,
} from './faces-de-parede.ts';
import type { Faixa } from '../domain/celulas.ts';
import { decodificar } from '../domain/celulas.ts';
import type { Grade, Ponto } from '../domain/mapa.ts';
import { contextoDe, criarTela, type Contexto, type Tela } from './canvas.ts';
import { caixaDasPartes, espelharDescricao, type Descricao, type Parte } from './descricao.ts';
import { materialDe, padraoDependeDaArea, tom } from './materiais.ts';
import { fbm, valueNoise2D } from './ruido.ts';
import { desfocarAlfa } from './desfocar.ts';
import { SOMBRA_DE_CONTATO, sombrearMacico } from './macico.ts';
import { partesParaFace } from './raster.ts';
import type { EstiloDeRaster, OpcoesDoPixel } from './estilos/index.ts';
import { pintarFacePixel } from './estilos/faces-pixel.ts';
import { RES_DA_TEXTURA_DE_AGUA, leitoDaAgua, texturaDeAgua, type CamadaDeAguaParaTextura } from './agua.ts';
import { orientacaoDominante } from './orientacao.ts';
import { descreverReceita, receitaDe } from './receitas/index.ts';
import { fatorDeProfundidade } from '../domain/relevo.ts';
import { ladoBaixo } from './escarpa.ts';
import { PROFUNDIDADE_MAXIMA, distanciaAMargem } from './profundidade.ts';

export interface Assado {
  tela: Tela;
  /** Tela de altura (cinza 0–1) alinhada à `tela`, ou `null` quando não há (Pixel, parede, escarpa). */
  altura?: Tela | null;
  /** Tela de normal (RG = N.xy * 0,5 + 0,5, B = AO, A = alfa) alinhada à `tela`, usada pelos telhados. */
  normal?: Tela | null;
  /** Tela da fachada sob o beiral frontal (+y), alinhada à mesma origem e resolução do telhado. */
  fachada?: Tela | null;
  /** Canto superior esquerdo da tela, em metros (no espaço local do objeto, ou do mundo para cômodos e terreno). */
  origem: Ponto;
  res: number;
  /** Terreno com água: profundidade (R) e margem (G) das camadas de água, a `res` px/m, do mesmo tamanho do mapa (ou do ladrilho, com `origem`). */
  agua?: { tela: Tela; res: number; origem?: Ponto };
}

// ---------- Objetos de piso ----------
export const MARGEM_SOMBRA = 0.3;

/** Uma descrição pronta (de receita ou de gerador pesado) inteira, com partes e sombras, numa tela com o centro do objeto em (0, 0) do espaço local. */
export function assarDescricao(d: Descricao, seed: number, res: number, estilo: EstiloDeRaster, pixel?: OpcoesDoPixel, alturaReal?: number): Assado {
  const partes = d.tipo === 'piso' ? d.partes : [...d.face.map(p => ({ ...p })), ...d.topo];
  const c = caixaDasPartes(partes), encaixe = (v: number) => (estilo.id === 'pixel' ? Math.floor(v * res) / res : v);      // no Pixel a tela começa na grade de pixels
  const x0 = encaixe(c.x0 - MARGEM_SOMBRA), y0 = encaixe(c.y0 - MARGEM_SOMBRA);
  const tela = criarTela((c.x1 + MARGEM_SOMBRA - x0) * res, (c.y1 + MARGEM_SOMBRA - y0) * res), ctx = contextoDe(tela, { willReadFrequently: estilo.id === 'pixel' });
  ctx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  estilo.desenharPartes(ctx, d.tipo === 'piso' ? d.partes : d.face, { res, seed, sombras: true, ppc: pixel?.ppc });
  estilo.finalizar?.(ctx, tela.width, tela.height, { contorno: pixel?.contorno ?? false });
  let altura: Tela | null = null;
  if (estilo.id !== 'pixel' && d.tipo === 'piso') {
    altura = criarTela(tela.width, tela.height);
    const actx = contextoDe(altura);
    actx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    desenharAlturaDasPartes(actx, d.partes, { res, ...(alturaReal !== undefined ? { teto: alturaReal } : {}) });
  }
  return { tela, altura, origem: [x0, y0], res };
}

/** Um objeto de piso de receita inteiro (partes + sombras) numa tela, com o centro do objeto em (0, 0) do espaço local. */
export function assarObjeto(receita: string, params: Record<string, unknown>, seed: number, res: number, estilo: EstiloDeRaster, pixel?: OpcoesDoPixel, espelhar = false): Assado {
  // A altura declarada da receita limita o mapa de altura: o `z` das partes também ordena o desenho (runas a 0,5 num círculo
  // de 2 cm), e sem o teto esses entalhes viravam cristas.
  const d = descreverReceita(receita, { seed, params });
  return assarDescricao(espelhar ? espelharDescricao(d) : d, seed, res, estilo, pixel, receitaDe(receita)?.altura);
}

// ---------- Cômodos ----------
export type AberturaNaFace = AberturaDaFace;
export type ObjetoNaFace = ObjetoDaFace;
export interface EntradaDoComodo {
  grade: { size: number; offset: [number, number] };
  celulas: Faixa[];
  outline?: Ponto[];
  piso: { material: string; seed: number };
  papel: { material: string; seed: number } | null;
  wallFace?: string;
  coberto?: boolean;
  paredes?: ParedeDaSala[];
  estilo: 'box' | 'solid';
  altura: number;
  aberturas: AberturaNaFace[];
  objetos: ObjetoNaFace[];
  /** Degraus do relevo (< 1 m) que cruzam o cômodo, em metros do mapa. */
  degraus?: { caminhos: Ponto[][]; drops: ('a' | 'b')[]; desnivel: number }[];
}

export { AMPLIACAO_NA_FACE, ampliarNaFace, profundidadeDaFace };

const MARGEM_COMODO = 0.4;

function caixaDoContorno(pts: readonly Ponto[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (pts.length < 3) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** Ampliação de leitura dos objetos pendurados na face. */

/** O cômodo inteiro numa tela: piso, sombra de contato com as paredes e, no estilo caixa, as faces internas. */
export function assarComodo(e: EntradaDoComodo, res: number, estilo: EstiloDeRaster): Assado {
  const grade: Grade = { size: e.grade.size, offset: e.grade.offset, kind: 'square', visible: false, snap: true, lineStyle: 'solid', color: 'auto', opacity: 0.1, lineWidth: 1 };
  const cells = decodificar(e.celulas);
  const caixa = e.outline && e.outline.length >= 3 ? caixaDoContorno(e.outline) : caixaDasCelulas({ grid: grade }, cells);
  if (!caixa) return { tela: criarTela(1, 1), altura: null, origem: [0, 0], res };
  const pixel = estilo.id === 'pixel', encaixe = (v: number) => (pixel ? Math.floor(v * res) / res : v);      // no Pixel a tela começa na grade de pixels
  const x0 = encaixe(caixa.x0 - MARGEM_COMODO), y0 = encaixe(caixa.y0 - MARGEM_COMODO);
  const tela = criarTela((caixa.x1 - x0 + MARGEM_COMODO) * res, (caixa.y1 - y0 + MARGEM_COMODO) * res), ctx = contextoDe(tela);
  const base = () => ctx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  base();
  const lacos = contornoDoComodo({ grid: grade }, cells, e.outline);
  const tracar = (c: Contexto = ctx) => { c.beginPath(); for (const laco of lacos) { c.moveTo(laco[0]!.a[0], laco[0]!.a[1]); for (const s of laco) c.lineTo(s.b[0], s.b[1]); c.closePath(); } };

  ctx.save(); tracar(); ctx.clip();
  estilo.pintarMaterial(ctx, e.piso.material, { x: caixa.x0, y: caixa.y0, w: caixa.x1 - caixa.x0, h: caixa.y1 - caixa.y0 }, e.piso.seed, { res });
  // Sombra de contato: o piso escurece junto das paredes.
  if (pixel) {
    // No Pixel é uma faixa dura de 2 pixels (3 no estilo sólido) junto da parede.
    ctx.strokeStyle = '#120d10'; ctx.lineJoin = 'miter'; ctx.lineWidth = (e.estilo === 'solid' ? 6 : 4) / res; tracar(); ctx.stroke();
  } else {
  ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 0.35 * res; ctx.lineWidth = 0.25; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; tracar(); ctx.stroke();
  if (e.estilo === 'solid') { ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 0.5 * res; ctx.shadowOffsetX = 0.12 * res; ctx.shadowOffsetY = 0.18 * res; ctx.lineWidth = 0.5; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; tracar(); ctx.stroke(); }
  }
  if (e.degraus?.length) pintarDegrausConstruidos(ctx, e.degraus, res, pixel);
  ctx.restore();

  let altura: Tela | null = null;
  let actx: Contexto | null = null;
  if (!pixel) {
    altura = criarTela(tela.width, tela.height);
    actx = contextoDe(altura);
    actx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    actx.save(); tracar(actx); actx.clip();
    actx.fillStyle = `rgb(${Math.round(PISO_NO_MAPA * 255)},0,0)`;
    actx.fillRect(caixa.x0, caixa.y0, caixa.x1 - caixa.x0, caixa.y1 - caixa.y0);
    pintarAlturaDoMaterial(actx, e.piso.material, { x: caixa.x0, y: caixa.y0, w: caixa.x1 - caixa.x0, h: caixa.y1 - caixa.y0 }, e.piso.seed, { res });
    if (e.degraus?.length) pintarAlturaDegrausConstruidos(actx, e.degraus);
    actx.restore();
  }

  if (e.estilo === 'box' && e.coberto !== false) {
    const faces = calcularFacesDasParedes(lacos, e.paredes, { alturaPadrao: e.altura, wallFace: e.wallFace, papel: e.papel, aberturas: e.aberturas });
    if (pixel) {
      const seedPapel = e.papel?.seed ?? 1;
      for (const f of faces) {
        const s = f.segmento, H = f.altura;
        const objetos = e.objetos.flatMap(o => { const u = aoLongoDoSegmento(s, o.centro); if (u === null || u < f.u0 - 0.01 || u > f.u1 + 0.01) return []; const d = descreverReceita(o.receita, { seed: o.seed, params: o.params }); return d.tipo === 'parede' ? [{ partes: ampliarNaFace(partesParaFace(d.face, u, H), u, H) }] : []; });
        const aberturas = e.aberturas.flatMap(a => { const u = aoLongoDoSegmento(s, a.centro); return u === null || u < f.u0 - 0.01 || u > f.u1 + 0.01 ? [] : [{ tipo: a.tipo, u, largura: a.largura, material: a.material, partes: partesDaAbertura(a, u, H) }]; });
        pintarFacePixel(ctx, { segmento: s, quad: f.quad, H, prof: f.prof, papel: { material: f.material, seed: seedPapel }, aberturas, objetos }, res, [x0, y0]);
      }
    } else {
      desenharFacesDasParedes(ctx, actx, faces, {
        res,
        origem: [x0, y0],
        estilo,
        papelSeed: e.papel?.seed ?? 1,
        aberturas: e.aberturas,
        objetos: e.objetos,
        descrever: (receita, seed, params) => descreverReceita(receita, { seed, params }),
      });
    }
  }
  return { tela, altura, origem: [x0, y0], res };
}

// ---------- Terreno ----------
export interface EntradaDeTerreno {
  largura: number; altura: number; resolucao: number; base: string;
  /** Recorte do ladrilho em metros; sem ele, assa o mapa inteiro (`[0, 0, largura, altura]`). */
  recorte?: { x: number; y: number; w: number; h: number };
  camadas: {
    material: string;
    celulas: Faixa[];
    /** Correnteza (só em camadas de água). */
    flow?: { angle: number; speed: number } | null;
    /** Orientação dominante (para `sulcos` quando recortada por ladrilho). */
    dir?: number;
    /** Índice real da camada de água no mapa (0..3) para preservar o canal B quando camadas anteriores ficam fora do ladrilho. */
    indiceAgua?: number;
  }[];
  /** Patamares abaixo do topo (em metros) para escurecer e enevoar, e degraus < 1 m. */
  relevo?: {
    faixas: { altura: number; celulas: Faixa[] }[];
    topo: number;
    neblina: string;
    /** Degraus transponíveis: `desnivel` (m) alarga a faixa de declive; sem ele, vale 0,5 m. */
    degraus?: { caminhos: Ponto[][]; drops: ('a' | 'b')[]; desnivel?: number }[];
  };
  /** Aro de chão pisado em volta dos edifícios cobertos do térreo e soleiras nas portas de fora. */
  assentamento?: {
    celulas: Faixa[];
    salas?: Faixa[];
    material: string | null;
    soleiras: { centro: Ponto; normal: Ponto; largura: number }[];
  };
}

/** Margem (m) usada no recorte e assado do relevo. */
export const MARGEM_RELEVO = 2.5;
/** Margem (m) usada no recorte e assado do assentamento. */
export const MARGEM_ASSENTAMENTO = 2;

/** Margens (m) das camadas de terreno por uso do material, compartilhadas entre `ladrilhosDoTerreno` e `assarTerreno`. */
export function margensDoTerreno(res: number): { base: number; agua: number; macico: number } {
  const base = Math.max(1.5, RAIO_PASSA_ALTA, 1 / Math.max(1e-6, res)) + 1;
  const agua = base + PROFUNDIDADE_MAXIMA;
  const macico = Math.max(base + Math.max(PROFUNDIDADE_MAXIMA, SOMBRA_DE_CONTATO + 0.15), 10);
  return { base, agua, macico };
}

/** O WebKitGTK não tem `filter` no contexto 2D (nem no OffscreenCanvas). */
const temFiltro = (c: Contexto): boolean => 'filter' in c;

const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

interface CaixaPx { x0: number; y0: number; cw: number; ch: number }

function caixaDaCamada(
  celulas: readonly Faixa[],
  resolucao: number,
  res: number,
  W: number,
  Hh: number,
  margemM: number,
  janela?: { x0: number; y0: number; x1: number; y1: number },
): CaixaPx | null {
  let gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity;
  for (const [y, x0, n] of celulas) {
    if (n <= 0) continue;
    if (x0 < gx0) gx0 = x0;
    if (x0 + n > gx1) gx1 = x0 + n;
    if (y < gy0) gy0 = y;
    if (y + 1 > gy1) gy1 = y + 1;
  }
  if (!Number.isFinite(gx0)) return null;
  let x0 = Math.max(0, Math.floor((gx0 * resolucao - margemM) * res));
  let y0 = Math.max(0, Math.floor((gy0 * resolucao - margemM) * res));
  let x1 = Math.min(W, Math.ceil((gx1 * resolucao + margemM) * res));
  let y1 = Math.min(Hh, Math.ceil((gy1 * resolucao + margemM) * res));
  if (janela) {
    x0 = Math.max(x0, janela.x0);
    y0 = Math.max(y0, janela.y0);
    x1 = Math.min(x1, janela.x1);
    y1 = Math.min(y1, janela.y1);
  }
  if (x1 <= x0 || y1 <= y0) return null;
  return { x0, y0, cw: x1 - x0, ch: y1 - y0 };
}

/** Máscara alfa desfocada (0,5 m) com bordas estendidas para camadas, na caixa `[x0, y0, cw, ch]` quando fornecida. */
function mascaraSuavizada(celulas: readonly Faixa[], resolucao: number, W: number, Hh: number, res: number, box?: CaixaPx): Uint8ClampedArray {
  const x0 = box?.x0 ?? 0, y0 = box?.y0 ?? 0, cw = box?.cw ?? W, ch = box?.ch ?? Hh;
  const mascara = criarTela(cw, ch), mc = contextoDe(mascara);
  mc.setTransform(res, 0, 0, res, -x0, -y0); mc.fillStyle = '#fff';
  for (const [y, cx0, n] of celulas) mc.fillRect(cx0 * resolucao, y * resolucao, n * resolucao, resolucao);
  const blur = Math.max(1, 0.5 * res), P = Math.ceil(blur * 3), estendida = criarTela(cw + 2 * P, ch + 2 * P), ec = contextoDe(estendida), M = mascara as CanvasImageSource;
  ec.imageSmoothingEnabled = false;
  ec.drawImage(M, P, P);
  ec.drawImage(M, 0, 0, 1, ch, 0, P, P, ch);
  ec.drawImage(M, cw - 1, 0, 1, ch, P + cw, P, P, ch);
  ec.drawImage(M, 0, 0, cw, 1, P, 0, cw, P);
  ec.drawImage(M, 0, ch - 1, cw, 1, P, P + ch, cw, P);
  ec.drawImage(M, 0, 0, 1, 1, 0, 0, P, P);
  ec.drawImage(M, cw - 1, 0, 1, 1, P + cw, 0, P, P);
  ec.drawImage(M, 0, ch - 1, 1, 1, 0, P + ch, P, P);
  ec.drawImage(M, cw - 1, ch - 1, 1, 1, P + cw, P + ch, P, P);
  if (temFiltro(ec)) {
    const mac = contextoDe(criarTela(cw + 2 * P, ch + 2 * P));
    mac.filter = `blur(${blur}px)`; mac.drawImage(estendida as CanvasImageSource, 0, 0);
    return mac.getImageData(P, P, cw, ch).data;
  }
  const bruta = ec.getImageData(0, 0, cw + 2 * P, ch + 2 * P);
  desfocarAlfa(bruta.data, bruta.width, bruta.height, blur);
  const recorte = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) recorte.set(bruta.data.subarray(((y + P) * bruta.width + P) * 4, ((y + P) * bruta.width + P + cw) * 4), y * cw * 4);
  return recorte;
}

function rasterizarFaixasEmAlfa(
  celulas: readonly Faixa[],
  resolucao: number,
  Mw: number,
  Mh: number,
  mRes: number,
  buf: Uint8ClampedArray,
  mx0 = 0,
  my0 = 0,
): void {
  buf.fill(0);
  const scale = resolucao * mRes;
  for (const [y, x0, n] of celulas) {
    const y0 = Math.max(0, Math.floor(y * scale) - my0);
    const y1 = Math.min(Mh, Math.ceil((y + 1) * scale) - my0);
    if (y1 <= y0) continue;
    const xStart = Math.max(0, Math.floor(x0 * scale) - mx0);
    const xEnd = Math.min(Mw, Math.ceil((x0 + n) * scale) - mx0);
    if (xEnd <= xStart) continue;
    for (let py = y0; py < y1; py++) {
      const row = py * Mw;
      for (let px = xStart; px < xEnd; px++) buf[(row + px) * 4 + 3] = 255;
    }
  }
  desfocarAlfa(buf, Mw, Mh, Math.max(1, 0.5 * mRes));
}

export interface MascaraDeRelevoComposta {
  Mw: number;
  Mh: number;
  mRes: number;
  mx0: number;
  my0: number;
  gain: Float32Array;
  bias: Float32Array;
}

function caixaDoRelevo(
  largura: number,
  altura: number,
  mRes: number,
  recorte?: { x: number; y: number; w: number; h: number },
): { Mw: number; Mh: number; mx0: number; my0: number } {
  const MwFull = Math.max(1, Math.ceil(largura * mRes));
  const MhFull = Math.max(1, Math.ceil(altura * mRes));
  if (!recorte) return { Mw: MwFull, Mh: MhFull, mx0: 0, my0: 0 };
  const mx0 = Math.max(0, Math.floor((recorte.x - MARGEM_RELEVO) * mRes));
  const my0 = Math.max(0, Math.floor((recorte.y - MARGEM_RELEVO) * mRes));
  const mx1 = Math.min(MwFull, Math.ceil((recorte.x + recorte.w + MARGEM_RELEVO) * mRes));
  const my1 = Math.min(MhFull, Math.ceil((recorte.y + recorte.h + MARGEM_RELEVO) * mRes));
  return { Mw: Math.max(1, mx1 - mx0), Mh: Math.max(1, my1 - my0), mx0, my0 };
}

/**
 * Compõe todos os patamares do relevo numa grade reduzida com extensão de bordas segura (`desfocarAlfa`),
 * unificando múltiplas passadas em fatores afins (`out = cor * gain + neblina * bias`) para assar mapas grandes rapidamente.
 */
export function comporMascaraDeRelevo(
  faixas: readonly { altura: number; celulas: Faixa[] }[],
  topo: number,
  resolucao: number,
  largura: number,
  altura: number,
  res: number,
  recorte?: { x: number; y: number; w: number; h: number },
): MascaraDeRelevoComposta {
  const mapaGrande = largura * altura >= 8000;
  const mRes = mapaGrande ? Math.min(res, 4) : Math.min(res, 8);
  const { Mw, Mh, mx0, my0 } = caixaDoRelevo(largura, altura, mRes, recorte);
  const total = Mw * Mh;
  const gain = new Float32Array(total).fill(1);
  const bias = new Float32Array(total);
  const buf = new Uint8ClampedArray(total * 4);

  for (const f of faixas) {
    const p = fatorDeProfundidade(f.altura, topo);
    if (p <= 0 || !f.celulas.length) continue;
    rasterizarFaixasEmAlfa(f.celulas, resolucao, Mw, Mh, mRes, buf, mx0, my0);
    const esc = 1 - 0.6 * p, alfaMax = 0.25 * p;
    const cMul = (1 - alfaMax) * esc, cAdd = alfaMax * esc;
    for (let q = 0; q < total; q++) {
      const t = buf[q * 4 + 3]! / 255;
      if (t <= 0.01) continue;
      const kTier = 1 - t + t * cMul;
      const bTier = t * cAdd;
      gain[q] = gain[q]! * kTier;
      bias[q] = bias[q]! * kTier + bTier;
    }
  }
  return { Mw, Mh, mRes, mx0, my0, gain, bias };
}

/** Compõe a altitude média (m) de todos os patamares do relevo na mesma grade reduzida de `comporMascaraDeRelevo`. */
export function comporAltitudeDoRelevo(
  faixas: readonly { altura: number; celulas: Faixa[] }[],
  topo: number,
  resolucao: number,
  largura: number,
  altura: number,
  res: number,
  recorte?: { x: number; y: number; w: number; h: number },
): { Mw: number; Mh: number; mRes: number; mx0: number; my0: number; altitudes: Float32Array } {
  const mapaGrande = largura * altura >= 8000;
  const mRes = mapaGrande ? Math.min(res, 4) : Math.min(res, 8);
  const { Mw, Mh, mx0, my0 } = caixaDoRelevo(largura, altura, mRes, recorte);
  const total = Mw * Mh;
  const somaPeso = new Float32Array(total);
  const somaAlt = new Float32Array(total);
  const buf = new Uint8ClampedArray(total * 4);

  for (const f of faixas) {
    if (!f.celulas.length) continue;
    rasterizarFaixasEmAlfa(f.celulas, resolucao, Mw, Mh, mRes, buf, mx0, my0);
    for (let q = 0; q < total; q++) {
      const t = buf[q * 4 + 3]! / 255;
      if (t <= 0.004) continue;
      somaPeso[q]! += t;
      somaAlt[q]! += t * f.altura;
    }
  }
  const altitudes = new Float32Array(total);
  for (let q = 0; q < total; q++) {
    const w = somaPeso[q]!;
    if (w <= 0) altitudes[q] = topo;
    else {
      const wTopo = Math.max(0, 1 - w);
      altitudes[q] = (wTopo * topo + somaAlt[q]!) / (wTopo + w);
    }
  }
  return { Mw, Mh, mRes, mx0, my0, altitudes };
}

/** O terreno todo numa tela só (ou o ladrilho `e.recorte`). Cada camada tem a borda torcida por ruído (orgânica, não um borrão) e um aro escuro por baixo: a transição automática. */
export function assarTerreno(e: EntradaDeTerreno, res: number, estilo: EstiloDeRaster, op?: { semCaixa?: boolean }): Assado {
  const pixel = estilo.id === 'pixel', W = Math.ceil(e.largura * res), Hh = Math.ceil(e.altura * res);
  const rec = e.recorte ?? { x: 0, y: 0, w: e.largura, h: e.altura };
  const rx0 = e.recorte ? Math.max(0, Math.round(rec.x * res)) : 0;
  const ry0 = e.recorte ? Math.max(0, Math.round(rec.y * res)) : 0;
  const rx1 = e.recorte ? (rec.x + rec.w >= e.largura - 1e-9 ? W : Math.min(W, Math.round((rec.x + rec.w) * res))) : W;
  const ry1 = e.recorte ? (rec.y + rec.h >= e.altura - 1e-9 ? Hh : Math.min(Hh, Math.round((rec.y + rec.h) * res))) : Hh;
  const outW = Math.max(1, rx1 - rx0), outH = Math.max(1, ry1 - ry0);
  const origem: Ponto = [rx0 / res, ry0 / res];
  const recorteM = { x: rx0 / res, y: ry0 / res, w: outW / res, h: outH / res };
  const resetTransform = (c: Contexto) => c.setTransform(res, 0, 0, res, -rx0, -ry0);

  const tela = criarTela(outW, outH), ctx = contextoDe(tela, pixel ? undefined : { willReadFrequently: true });
  resetTransform(ctx);
  const areaBase = pixel || (e.base !== 'vazio' && padraoDependeDaArea(materialDe(e.base).padrao)) ? { x: 0, y: 0, w: e.largura, h: e.altura } : recorteM;
  if (e.base !== 'vazio') estilo.pintarMaterial(ctx, e.base, areaBase, 7, { res });
  const altura = pixel ? null : criarTela(outW, outH);
  const actx = altura ? contextoDe(altura, { willReadFrequently: true }) : null;
  if (actx) {
    resetTransform(actx);
    if (e.base !== 'vazio') {
      if (temAlturaPropria(materialDe(e.base), res)) {
        pintarAlturaDoMaterial(actx, e.base, areaBase, 7, { res });
      } else {
        const rPx = e.recorte ? Math.max(1, Math.round(RAIO_PASSA_ALTA * res)) : 0;
        const bx0 = Math.max(0, rx0 - rPx), by0 = Math.max(0, ry0 - rPx);
        const bx1 = Math.min(W, rx1 + rPx), by1 = Math.min(Hh, ry1 + rPx);
        const bw = bx1 - bx0, bh = by1 - by0;
        if (bx0 === rx0 && by0 === ry0 && bw === outW && bh === outH) {
          const baseImg = ctx.getImageData(0, 0, outW, outH);
          const altImg = actx.createImageData(outW, outH);
          altImg.data.set(alturaPorLuminancia(baseImg.data, outW, outH, res));
          actx.setTransform(1, 0, 0, 1, 0, 0);
          actx.putImageData(altImg, 0, 0);
          resetTransform(actx);
        } else {
          const bt = criarTela(bw, bh), bctx = contextoDe(bt, { willReadFrequently: true });
          bctx.setTransform(res, 0, 0, res, -bx0, -by0);
          const areaMargem = pixel || padraoDependeDaArea(materialDe(e.base).padrao)
            ? { x: 0, y: 0, w: e.largura, h: e.altura }
            : { x: bx0 / res, y: by0 / res, w: bw / res, h: bh / res };
          estilo.pintarMaterial(bctx, e.base, areaMargem, 7, { res });
          const lumAlt = alturaPorLuminancia(bctx.getImageData(0, 0, bw, bh).data, bw, bh, res);
          const altImg = actx.createImageData(outW, outH);
          const ox = rx0 - bx0, oy = ry0 - by0;
          for (let ly = 0; ly < outH; ly++) {
            const srcOff = ((oy + ly) * bw + ox) * 4;
            altImg.data.set(lumAlt.subarray(srcOff, srcOff + outW * 4), ly * outW * 4);
          }
          actx.setTransform(1, 0, 0, 1, 0, 0);
          actx.putImageData(altImg, 0, 0);
          resetTransform(actx);
        }
      }
    }
  }
  const aguas: CamadaDeAguaParaTextura[] = [];
  const margens = margensDoTerreno(res);
  e.camadas.forEach((camada, idx) => {
    if (!camada.celulas.length) return;
    const material = materialDe(camada.material), macico = material.uso === 'macico', agua = material.uso === 'agua', franja = material.franja ?? 0;
    const margemM = macico ? margens.macico : agua ? margens.agua : margens.base;
    const margemPx = Math.ceil(margemM * res);
    const janela = e.recorte
      ? { x0: Math.max(0, rx0 - margemPx), y0: Math.max(0, ry0 - margemPx), x1: Math.min(W, rx1 + margemPx), y1: Math.min(Hh, ry1 + margemPx) }
      : undefined;
    const box = op?.semCaixa ? { x0: 0, y0: 0, cw: W, ch: Hh } : caixaDaCamada(camada.celulas, e.resolucao, res, W, Hh, margemM, janela);
    if (!box) return;
    const { x0, y0, cw, ch } = box;
    const dx = x0 - rx0, dy = y0 - ry0;
    const fonte = mascaraSuavizada(camada.celulas, e.resolucao, W, Hh, res, box);
    const ruido = valueNoise2D(1000 + idx * 17);
    const corpo = new ImageData(cw, ch), aro = new ImageData(cw, ch), binaria = new Uint8Array(pixel || macico || agua ? cw * ch : 0), cobertura = new Uint8Array((macico || agua) && !pixel ? cw * ch : 0), ruidoFino = valueNoise2D(3000 + idx * 31);
    for (let ly = 0, px = 0, k = 0; ly < ch; ly++) {
      const my = (y0 + ly) / res;
      for (let lx = 0; lx < cw; lx++, px++, k += 4) {
        const b = fonte[k + 3]! / 255; if (b < 0.02) continue;
        const mx = (x0 + lx) / res;
        let v = b + (fbm(ruido, mx * 1.3, my * 1.3, 3) - 0.5) * 0.5;
        // Franja: manchas miúdas (30 a 60 cm) do vizinho entrando na camada e da camada saindo para o vizinho.
        if (franja > 0 && !pixel) v += (fbm(ruidoFino, mx * 2.6 + 31, my * 2.6, 3) - 0.5) * 0.9 * franja;
        if (macico) v += pixel ? (fbm(ruidoFino, mx * 3.5, my * 3.5, 3) - 0.5) * 0.35 : (fbm(ruidoFino, mx * 1.5, my * 1.5, 2) - 0.5) * 0.5 + (fbm(ruidoFino, mx * 6 + 9, my * 6, 1) - 0.5) * 0.06;      // borda de rocha: lóbulos grandes e arredondados (Ilustrado), degraus no Pixel
        if (agua) { binaria[px] = v >= 0.5 ? 1 : 0; if (!pixel) cobertura[px] = suave(0.47, 0.53, v) * 255; }
        else if (macico) { binaria[px] = v >= 0.5 ? 1 : 0; if (!pixel) cobertura[px] = suave(0.47, 0.53, v) * 255; }
        else if (pixel) binaria[px] = v >= 0.5 ? 1 : 0;
        else if (franja > 0) { corpo.data[k + 3] = suave(0.38, 0.62, v) * 255; aro.data[k + 3] = suave(0.3, 0.5, v) * 120; }
        else { corpo.data[k + 3] = suave(0.22, 0.78, v) * 255; aro.data[k + 3] = suave(0.12, 0.45, v) * 255; }
      }
    }
    if (agua) {
      // Água: o que está embaixo continua à vista e ganha a cor do leito pela profundidade; a margem é uma faixa de areia molhada.
      const r = leitoDaAgua({ binaria, cobertura: pixel ? null : cobertura, largura: cw, altura: ch, res, seed: 13 + idx * 5, material, pixel, origemPx: [x0, y0] });
      const poe = (dados: Uint8ClampedArray) => { const t = criarTela(cw, ch), c = contextoDe(t); c.putImageData(new ImageData(dados as Uint8ClampedArray<ArrayBuffer>, cw, ch), 0, 0); ctx.drawImage(t as CanvasImageSource, dx, dy); };
      ctx.setTransform(1, 0, 0, 1, 0, 0); poe(r.margem); poe(r.leito); resetTransform(ctx);
      if (actx) {
        const aguaAlt = new Uint8ClampedArray(cw * ch * 4);
        const pisoByte = Math.round(PISO_NO_MAPA * 255);
        for (let px = 0; px < cw * ch; px++) {
          const k = px * 4;
          aguaAlt[k] = pisoByte; aguaAlt[k + 1] = 0; aguaAlt[k + 2] = 0; aguaAlt[k + 3] = cobertura[px]!;
        }
        const t = criarTela(cw, ch);
        contextoDe(t).putImageData(new ImageData(aguaAlt as Uint8ClampedArray<ArrayBuffer>, cw, ch), 0, 0);
        actx.setTransform(1, 0, 0, 1, 0, 0);
        actx.drawImage(t as CanvasImageSource, dx, dy);
        resetTransform(actx);
      }
      aguas.push({ profundidade: r.profundidade, binaria, x0, y0, cw, ch, indice: camada.indiceAgua ?? aguas.length });
      return;
    }
    if (macico) {
      // Maciço: volume próprio (patamares, estrias, sombra de contato) e nenhum aro escuro das camadas comuns.
      const r = sombrearMacico({ dentro: binaria, alfa: pixel ? null : cobertura, largura: cw, altura: ch, res, seed: 11 + idx * 5, cores: material, pixel, origemPx: [x0, y0] });
      const poe = (dados: Uint8ClampedArray) => { const t = criarTela(cw, ch), c = contextoDe(t); c.putImageData(new ImageData(dados as Uint8ClampedArray<ArrayBuffer>, cw, ch), 0, 0); ctx.drawImage(t as CanvasImageSource, dx, dy); };
      ctx.setTransform(1, 0, 0, 1, 0, 0); poe(r.sombra); poe(r.rgba); resetTransform(ctx);
      if (actx) {
        const altMacico = alturaPorLuminancia(r.rgba, cw, ch, res);
        const t = criarTela(cw, ch);
        contextoDe(t).putImageData(new ImageData(altMacico as Uint8ClampedArray<ArrayBuffer>, cw, ch), 0, 0);
        actx.setTransform(1, 0, 0, 1, 0, 0);
        actx.drawImage(t as CanvasImageSource, dx, dy);
        resetTransform(actx);
      }
      return;
    }
    if (pixel) {
      // Borda em degraus de pixel: a camada é tudo ou nada, e o aro escuro é a vizinhança de 1 pixel dela.
      for (let px = 0; px < binaria.length; px++) {
        const x = px % cw, y = (px - x) / cw, dentro = binaria[px]!;
        corpo.data[px * 4 + 3] = dentro ? 255 : 0;
        aro.data[px * 4 + 3] = dentro || (x > 0 && binaria[px - 1]) || (x < cw - 1 && binaria[px + 1]) || (y > 0 && binaria[px - cw]) || (y < ch - 1 && binaria[px + cw]) ? 255 : 0;
      }
    }
    const comAlfa = (dados: ImageData, cor: string | null) => {
      const t = criarTela(cw, ch), c = contextoDe(t); c.putImageData(dados, 0, 0);
      if (cor) { c.globalCompositeOperation = 'source-in'; c.fillStyle = cor; c.fillRect(0, 0, cw, ch); }
      return t;
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = pixel ? 1 : 0.5; ctx.drawImage(comAlfa(aro, material.escuro) as CanvasImageSource, dx, dy); ctx.globalAlpha = 1;
    const pintada = criarTela(cw, ch), pc = contextoDe(pintada, { willReadFrequently: !pixel });
    const dir = material.padrao === 'sulcos' ? (camada.dir ?? orientacaoDominante(camada.celulas)) : 0;
    const caixaM = { x: x0 / res, y: y0 / res, w: cw / res, h: ch / res };
    const areaMaterial = pixel || padraoDependeDaArea(material.padrao) ? { x: 0, y: 0, w: e.largura, h: e.altura } : caixaM;
    pc.setTransform(res, 0, 0, res, -x0, -y0); estilo.pintarMaterial(pc, camada.material, areaMaterial, 11 + idx * 5, { res, dir });
    const mascCorpo = comAlfa(corpo, null);
    if (actx) {
      const altTela = criarTela(cw, ch), atc = contextoDe(altTela);
      if (temAlturaPropria(material, res)) {
        atc.setTransform(res, 0, 0, res, -x0, -y0);
        pintarAlturaDoMaterial(atc, camada.material, areaMaterial, 11 + idx * 5, { res, dir });
        atc.setTransform(1, 0, 0, 1, 0, 0);
      } else {
        pc.setTransform(1, 0, 0, 1, 0, 0);
        const corImg = pc.getImageData(0, 0, cw, ch);
        const altImg = atc.createImageData(cw, ch);
        altImg.data.set(alturaPorLuminancia(corImg.data, cw, ch, res));
        atc.putImageData(altImg, 0, 0);
      }
      atc.globalCompositeOperation = 'destination-in';
      atc.drawImage(mascCorpo as CanvasImageSource, 0, 0);
      actx.setTransform(1, 0, 0, 1, 0, 0);
      actx.drawImage(altTela as CanvasImageSource, dx, dy);
      resetTransform(actx);
    }
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.globalCompositeOperation = 'destination-in'; pc.drawImage(mascCorpo as CanvasImageSource, 0, 0);
    ctx.drawImage(pintada as CanvasImageSource, dx, dy); resetTransform(ctx);
  });
  if (e.assentamento) pintarAssentamento(ctx, e, W, Hh, res, estilo, rx0, ry0, outW, outH);
  if (e.relevo?.faixas.length) {
    const img = ctx.getImageData(0, 0, outW, outH);
    const pxDados = img.data;
    const nr = parseInt(e.relevo.neblina.slice(1, 3), 16), ng = parseInt(e.relevo.neblina.slice(3, 5), 16), nb = parseInt(e.relevo.neblina.slice(5, 7), 16);
    if (!pixel) {
      const { Mw, Mh, mRes, mx0, my0, gain, bias } = comporMascaraDeRelevo(e.relevo.faixas, e.relevo.topo, e.resolucao, e.largura, e.altura, res, e.recorte);
      const sx0 = new Int32Array(outW), sx1 = new Int32Array(outW);
      const stx = new Float32Array(outW);
      const escalaX = mRes / res;
      for (let x = 0; x < outW; x++) {
        const fx = Math.max(0, Math.min(Mw - 1, (rx0 + x + 0.5) * escalaX - 0.5 - mx0));
        const x0 = Math.floor(fx), x1 = Math.min(Mw - 1, x0 + 1);
        sx0[x] = x0; sx1[x] = x1; stx[x] = fx - x0;
      }
      for (let y = 0; y < outH; y++) {
        const fy = Math.max(0, Math.min(Mh - 1, (ry0 + y + 0.5) * escalaX - 0.5 - my0));
        const y0 = Math.floor(fy), y1 = Math.min(Mh - 1, y0 + 1), ty = fy - y0;
        const row0 = y0 * Mw, row1 = y1 * Mw;
        const pxRow = y * outW * 4;
        for (let x = 0; x < outW; x++) {
          const k = pxRow + x * 4;
          if (!pxDados[k + 3]) continue;
          const x0 = sx0[x]!, x1 = sx1[x]!, tx = stx[x]!;
          const gTop = gain[row0 + x0]! + (gain[row0 + x1]! - gain[row0 + x0]!) * tx;
          const gBot = gain[row1 + x0]! + (gain[row1 + x1]! - gain[row1 + x0]!) * tx;
          const g = gTop + (gBot - gTop) * ty;
          const bTop = bias[row0 + x0]! + (bias[row0 + x1]! - bias[row0 + x0]!) * tx;
          const bBot = bias[row1 + x0]! + (bias[row1 + x1]! - bias[row1 + x0]!) * tx;
          const b = bTop + (bBot - bTop) * ty;
          if (g >= 0.9999 && b <= 1e-5) continue;
          pxDados[k] = Math.round(pxDados[k]! * g + nr * b);
          pxDados[k + 1] = Math.round(pxDados[k + 1]! * g + ng * b);
          pxDados[k + 2] = Math.round(pxDados[k + 2]! * g + nb * b);
        }
      }
    } else {
      const mRes = e.largura * e.altura >= 8000 ? Math.min(res, 6) : res;
      const { Mw, Mh, mx0, my0 } = caixaDoRelevo(e.largura, e.altura, mRes, e.recorte);
      const masc = new Uint8ClampedArray(Mw * Mh * 4);
      const escala = mRes / res;
      for (const f of e.relevo.faixas) {
        const p = fatorDeProfundidade(f.altura, e.relevo.topo);
        if (p <= 0 || !f.celulas.length) continue;
        rasterizarFaixasEmAlfa(f.celulas, e.resolucao, Mw, Mh, mRes, masc, mx0, my0);
        const esc = 1 - 0.6 * p, alfaMax = 0.25 * p;
        for (let y = 0; y < outH; y++) {
          const gy = ry0 + y;
          const my = Math.max(0, Math.min(Mh - 1, Math.floor((gy + 0.5) * escala) - my0));
          const mRow = my * Mw, pxRow = y * outW * 4;
          for (let x = 0; x < outW; x++) {
            const k = pxRow + x * 4;
            if (!pxDados[k + 3]) continue;
            const gx = rx0 + x;
            const mx = Math.max(0, Math.min(Mw - 1, Math.floor((gx + 0.5) * escala) - mx0));
            const m = masc[(mRow + mx) * 4 + 3]! / 255;
            if (m < 0.5) continue;
            const limiar = (BAYER4[(gy & 3) * 4 + (gx & 3)]! + 0.5) / 16;
            const alfa = Math.min(2, Math.floor((alfaMax / 0.125) + (1 - limiar) * 0.999)) * 0.125;
            pxDados[k] = Math.round((pxDados[k]! * (1 - alfa) + nr * alfa) * esc);
            pxDados[k + 1] = Math.round((pxDados[k + 1]! * (1 - alfa) + ng * alfa) * esc);
            pxDados[k + 2] = Math.round((pxDados[k + 2]! * (1 - alfa) + nb * alfa) * esc);
          }
        }
      }
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.putImageData(img, 0, 0);
    resetTransform(ctx);
  }
  if (actx && e.relevo && (e.relevo.faixas.length > 0 || e.relevo.topo !== 0)) {
    const altImg = actx.getImageData(0, 0, outW, outH);
    const aDados = altImg.data;
    if (!e.relevo.faixas.length) {
      const delta = e.relevo.topo / 40;
      for (let k = 0; k < aDados.length; k += 4) {
        if (!aDados[k + 3]) continue;
        const c = Math.max(0, Math.min(255, Math.round((aDados[k]! / 255 + delta) * 255)));
        aDados[k] = c; aDados[k + 1] = 0; aDados[k + 2] = 0;
      }
    } else {
      const { Mw, Mh, mRes, mx0, my0, altitudes } = comporAltitudeDoRelevo(e.relevo.faixas, e.relevo.topo, e.resolucao, e.largura, e.altura, res, e.recorte);
      const sx0 = new Int32Array(outW), sx1 = new Int32Array(outW), stx = new Float32Array(outW);
      const escalaX = mRes / res;
      for (let x = 0; x < outW; x++) {
        const fx = Math.max(0, Math.min(Mw - 1, (rx0 + x + 0.5) * escalaX - 0.5 - mx0));
        const x0 = Math.floor(fx), x1 = Math.min(Mw - 1, x0 + 1);
        sx0[x] = x0; sx1[x] = x1; stx[x] = fx - x0;
      }
      for (let y = 0; y < outH; y++) {
        const fy = Math.max(0, Math.min(Mh - 1, (ry0 + y + 0.5) * escalaX - 0.5 - my0));
        const y0 = Math.floor(fy), y1 = Math.min(Mh - 1, y0 + 1), ty = fy - y0;
        const row0 = y0 * Mw, row1 = y1 * Mw, pxRow = y * outW * 4;
        for (let x = 0; x < outW; x++) {
          const k = pxRow + x * 4;
          if (!aDados[k + 3]) continue;
          const x0 = sx0[x]!, x1 = sx1[x]!, tx = stx[x]!;
          const aTop = altitudes[row0 + x0]! + (altitudes[row0 + x1]! - altitudes[row0 + x0]!) * tx;
          const aBot = altitudes[row1 + x0]! + (altitudes[row1 + x1]! - altitudes[row1 + x0]!) * tx;
          const alt = aTop + (aBot - aTop) * ty;
          const c = Math.max(0, Math.min(255, Math.round((aDados[k]! / 255 + alt / 40) * 255)));
          aDados[k] = c; aDados[k + 1] = 0; aDados[k + 2] = 0;
        }
      }
    }
    actx.setTransform(1, 0, 0, 1, 0, 0);
    actx.putImageData(altImg, 0, 0);
    resetTransform(actx);
  }
  if (e.relevo?.degraus?.length) pintarDegraus(ctx, e.relevo.degraus, res, pixel, [rx0, ry0]);
  const waFull = Math.max(1, Math.ceil(e.largura * RES_DA_TEXTURA_DE_AGUA));
  const haFull = Math.max(1, Math.ceil(e.altura * RES_DA_TEXTURA_DE_AGUA));
  const ax0 = e.recorte ? Math.max(0, Math.round(rec.x * RES_DA_TEXTURA_DE_AGUA)) : 0;
  const ay0 = e.recorte ? Math.max(0, Math.round(rec.y * RES_DA_TEXTURA_DE_AGUA)) : 0;
  const ax1 = e.recorte ? (rec.x + rec.w >= e.largura - 1e-9 ? waFull : Math.min(waFull, Math.round((rec.x + rec.w) * RES_DA_TEXTURA_DE_AGUA))) : waFull;
  const ay1 = e.recorte ? (rec.y + rec.h >= e.altura - 1e-9 ? haFull : Math.min(haFull, Math.round((rec.y + rec.h) * RES_DA_TEXTURA_DE_AGUA))) : haFull;
  const recorteAgua = e.recorte ? { x0: ax0, y0: ay0, w: Math.max(1, ax1 - ax0), h: Math.max(1, ay1 - ay0) } : undefined;
  const dadosDaAgua = texturaDeAgua(aguas, W, Hh, res, e.largura, e.altura, recorteAgua);
  if (dadosDaAgua) {
    const ta = criarTela(dadosDaAgua.width, dadosDaAgua.height);
    contextoDe(ta).putImageData(dadosDaAgua, 0, 0);
    const aguaOrigem: Ponto | undefined = e.recorte ? [ax0 / RES_DA_TEXTURA_DE_AGUA, ay0 / RES_DA_TEXTURA_DE_AGUA] : undefined;
    return { tela, altura, origem, res, agua: { tela: ta, res: RES_DA_TEXTURA_DE_AGUA, ...(aguaOrigem ? { origem: aguaOrigem } : {}) } };
  }
  return { tela, altura, origem, res };
}

/** Largura (m) da faixa de declive de um degrau transponível: ~0,55 m para 0,5 m de desnível. */
export const larguraDoDeclive = (desnivel: number): number => Math.min(0.85, Math.max(0.3, 0.35 + 0.4 * desnivel));

/**
 * Degraus do relevo dentro de um cômodo, como degrau construído (tablado, estrado, nave elevada): o espelho do degrau
 * em faixa escura do lado baixo, a sombra curta que ele projeta, a linha dura do pé e a quina clara e gasta no alto.
 * Desenha no sistema de coordenadas atual do contexto (metros do mapa).
 */
export function pintarDegrausConstruidos(ctx: Contexto, degraus: readonly { caminhos: Ponto[][]; drops: ('a' | 'b')[]; desnivel?: number }[], res: number, pixel: boolean): void {
  ctx.save();
  ctx.lineCap = 'butt'; ctx.lineJoin = 'miter';
  const px = 1 / res, enc = (v: number) => (pixel ? Math.max(px, Math.round(v * res) * px) : v);
  for (const deg of degraus) {
    const h = deg.desnivel ?? 0.5, espelho = enc(Math.min(0.32, 0.1 + h * 0.22)), sombra = enc(Math.min(0.9, 0.25 + h * 0.6));
    for (let idx = 0; idx < deg.caminhos.length; idx++) {
      const path = deg.caminhos[idx]!, drop = deg.drops[idx] ?? 'b';
      if (path.length < 2) continue;
      const normal = (i: number): Ponto => ladoBaixo(path[Math.max(0, i - 1)]!, path[Math.min(path.length - 1, i + 1)]!, drop);
      const deslocar = (d: number) => {
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) { const p = path[i]!, n = normal(i), x = p[0] + n[0] * d, y = p[1] + n[1] * d; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      };
      // Sombra projetada no piso de baixo, em degradê curto.
      const camadas = pixel ? 2 : 4;
      for (let k = 0; k < camadas; k++) {
        const t = k / camadas, w = (sombra - espelho) / camadas;
        ctx.strokeStyle = `rgba(0, 0, 0, ${(0.42 * Math.pow(1 - t, 1.6)).toFixed(3)})`; ctx.lineWidth = w + (pixel ? 0 : 0.01);
        deslocar(espelho + (k + 0.5) * w);
      }
      // O espelho do degrau: faixa escura com um fio de luz no meio (a pedra do espelho).
      ctx.strokeStyle = 'rgba(14, 10, 8, 0.62)'; ctx.lineWidth = espelho; deslocar(espelho / 2);
      if (!pixel) { ctx.strokeStyle = 'rgba(255, 245, 225, 0.08)'; ctx.lineWidth = espelho * 0.3; deslocar(espelho * 0.45); }
      // Linha dura do pé e quina clara no alto.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)'; ctx.lineWidth = pixel ? px : 0.03; deslocar(espelho);
      ctx.strokeStyle = `rgba(255, 248, 232, ${pixel ? 0.55 : 0.42})`; ctx.lineWidth = pixel ? px : 0.07; deslocar(pixel ? -px / 2 : -0.04);
    }
  }
  ctx.restore();
}

/** Altura dos degraus construídos dentro de um cômodo (rampa suave do lado alto até a crista e queda pelo espelho). */
export function pintarAlturaDegrausConstruidos(ctx: Contexto, degraus: readonly { caminhos: Ponto[][]; drops: ('a' | 'b')[]; desnivel?: number }[]): void {
  ctx.save();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  const cinza = (v: number) => {
    const c = Math.max(0, Math.min(255, Math.round(v * 255)));
    return `rgb(${c},0,0)`;
  };
  for (const deg of degraus) {
    const h = deg.desnivel ?? 0.5;
    const espelho = Math.min(0.32, 0.1 + h * 0.22);
    const delta = Math.min(0.35, Math.max(0.04, h / ALTURA_MAXIMA));
    for (let idx = 0; idx < deg.caminhos.length; idx++) {
      const path = deg.caminhos[idx]!, drop = deg.drops[idx] ?? 'b';
      if (path.length < 2) continue;
      const normal = (i: number): Ponto => ladoBaixo(path[Math.max(0, i - 1)]!, path[Math.min(path.length - 1, i + 1)]!, drop);
      const deslocar = (d: number) => {
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
          const p = path[i]!, n = normal(i), x = p[0] + n[0] * d, y = p[1] + n[1] * d;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      const altoL = 0.24, passos = 4;
      for (let k = passos - 1; k >= 0; k--) {
        const t = (k + 0.5) / passos;
        ctx.strokeStyle = cinza(0.5 + delta * (1 - t));
        ctx.lineWidth = altoL / passos + 0.01;
        deslocar(-t * altoL);
      }
      for (let k = passos - 1; k >= 0; k--) {
        const t = (k + 0.5) / passos;
        ctx.strokeStyle = cinza(0.5 + delta * (1 - t));
        ctx.lineWidth = espelho / passos + 0.01;
        deslocar(t * espelho);
      }
      ctx.strokeStyle = cinza(0.5 + delta);
      ctx.lineWidth = 0.04;
      deslocar(0);
    }
  }
  ctx.restore();
}

/**
 * Degraus < 1 m como talude: faixa de sombra em degradê no lado baixo, hachuras curtas de declive ao longo do
 * contorno, quebra escura no pé da crista e borda clara no topo. No Pixel, menos camadas e traço de 1 px.
 */
export function pintarDegraus(
  ctx: Contexto,
  degraus: readonly { caminhos: Ponto[][]; drops: ('a' | 'b')[]; desnivel?: number }[],
  res: number,
  pixel: boolean,
  origemPx: readonly [number, number] = [0, 0],
): void {
  ctx.save();
  ctx.setTransform(res, 0, 0, res, -origemPx[0], -origemPx[1]);
  ctx.lineCap = pixel ? 'butt' : 'round';
  ctx.lineJoin = 'round';
  const px = 1 / res;
  for (const deg of degraus) {
    const L = larguraDoDeclive(deg.desnivel ?? 0.5);
    for (let idx = 0; idx < deg.caminhos.length; idx++) {
      const path = deg.caminhos[idx]!, drop = deg.drops[idx] ?? 'b';
      if (path.length < 2) continue;
      const normal = (i: number): Ponto => ladoBaixo(path[Math.max(0, i - 1)]!, path[Math.min(path.length - 1, i + 1)]!, drop);
      const deslocar = (d: number) => {
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) { const p = path[i]!, n = normal(i), x = p[0] + n[0] * d, y = p[1] + n[1] * d; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.stroke();
      };
      // Faixa de declive: camadas concêntricas do pé da crista para baixo, cada uma mais rala (um degradê sem sobreposição nas quinas).
      const camadas = pixel ? 2 : 5, passo = L / camadas;
      for (let k = 0; k < camadas; k++) {
        const t = k / camadas;
        ctx.strokeStyle = `rgba(0, 0, 0, ${(0.34 * Math.pow(1 - t, 1.4)).toFixed(3)})`;
        ctx.lineWidth = passo + (pixel ? 0 : 0.01);
        deslocar((k + 0.5) * passo);
      }
      // Hachuras de declive: traços curtos e irregulares no sentido da queda, como taludes de terra batida.
      let semente = Math.round(Math.abs(path[0]![0] * 73.1 + path[0]![1] * 19.7) * 1000) % 2147483647 || 1;
      const rnd = () => { semente = (semente * 16807) % 2147483647; return semente / 2147483647; };
      ctx.strokeStyle = pixel ? 'rgba(0, 0, 0, 0.5)' : 'rgba(30, 22, 16, 0.26)';
      ctx.lineWidth = pixel ? px : 0.035;
      ctx.beginPath();
      const espaco = pixel ? 0.6 : 0.42;
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i]!, b = path[i + 1]!, comp = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (comp < 1e-6) continue;
        const n = ladoBaixo(a, b, drop), tx = (b[0] - a[0]) / comp, ty = (b[1] - a[1]) / comp;
        for (let d = espaco * (0.3 + rnd() * 0.6); d < comp; d += espaco * (0.75 + rnd() * 0.5)) {
          const ox = a[0] + tx * d, oy = a[1] + ty * d, l = L * (0.45 + rnd() * 0.35), inc = (rnd() - 0.5) * 0.12;
          ctx.moveTo(ox + n[0] * 0.06, oy + n[1] * 0.06);
          ctx.lineTo(ox + n[0] * l + tx * inc, oy + n[1] * l + ty * inc);
        }
      }
      ctx.stroke();
      // Quebra escura no pé da crista e borda clara no topo.
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.32)'; ctx.lineWidth = pixel ? px : 0.045; deslocar(pixel ? px / 2 : 0.025);
      ctx.strokeStyle = `rgba(255, 250, 240, ${pixel ? 0.5 : 0.34})`; ctx.lineWidth = pixel ? px : 0.06; deslocar(pixel ? -px / 2 : -0.035);
    }
  }
  ctx.restore();
}

function pintarAssentamento(
  ctx: Contexto,
  e: EntradaDeTerreno,
  W: number,
  Hh: number,
  res: number,
  estilo: EstiloDeRaster,
  rx0 = 0,
  ry0 = 0,
  outW = W,
  outH = Hh,
): void {
  const assent = e.assentamento;
  if (!assent) return;
  const pixel = estilo.id === 'pixel';
  const margemPx = e.recorte ? Math.ceil(MARGEM_ASSENTAMENTO * res) : 0;
  const ax0 = e.recorte ? Math.max(0, rx0 - margemPx) : 0;
  const ay0 = e.recorte ? Math.max(0, ry0 - margemPx) : 0;
  const ax1 = e.recorte ? Math.min(W, rx0 + outW + margemPx) : W;
  const ay1 = e.recorte ? Math.min(Hh, ry0 + outH + margemPx) : Hh;
  const aw = ax1 - ax0, ah = ay1 - ay0;
  const preencherFaixas = (faixas: readonly Faixa[], destino: Uint8Array, valor: number) => {
    for (const [fy, fx0, fn] of faixas) {
      const py0 = Math.max(ax0 * 0 + ay0, Math.floor(fy * e.resolucao * res));
      const py1 = Math.min(ay1 - 1, Math.ceil((fy + 1) * e.resolucao * res) - 1);
      if (py1 < py0) continue;
      const px0 = Math.max(ax0, Math.floor(fx0 * e.resolucao * res));
      const px1 = Math.min(ax1 - 1, Math.ceil((fx0 + fn) * e.resolucao * res) - 1);
      if (px1 < px0) continue;
      for (let y = py0; y <= py1; y++) {
        const row = (y - ay0) * aw;
        for (let x = px0; x <= px1; x++) destino[row + (x - ax0)] = valor;
      }
    }
  };

  if (assent.material && assent.celulas.length && aw > 0 && ah > 0) {
    const anel = new Uint8Array(aw * ah);
    preencherFaixas(assent.celulas, anel, 1);
    const foraSalas = new Uint8Array(aw * ah).fill(1);
    if (assent.salas?.length) preencherFaixas(assent.salas, foraSalas, 0);
    const dist = assent.salas?.length ? distanciaAMargem(foraSalas, aw, ah, res, 0.9) : null;
    const macia = dist ? null : mascaraSuavizada(assent.celulas, e.resolucao, W, Hh, res, { x0: ax0, y0: ay0, cw: aw, ch: ah });
    const ruido = valueNoise2D(4711);
    const mascaraImg = new ImageData(aw, ah);
    for (let ly = 0, i = 0; ly < ah; ly++) {
      const y = ay0 + ly, my = y / res;
      for (let lx = 0; lx < aw; lx++, i++) {
        if (!anel[i]) continue;
        const x = ax0 + lx, mx = x / res;
        const torcao = (fbm(ruido, mx * 1.4, my * 1.4, 3) - 0.5) * 0.34;
        let t = 0;
        if (dist) {
          if (!foraSalas[i]) continue;
          t = Math.max(0, Math.min(1, 1 - (dist[i]! + torcao) / 0.75));
        } else if (macia) {
          t = Math.max(0, Math.min(1, macia[i * 4 + 3]! / 255 + torcao));
        }
        if (t <= 0) continue;
        if (pixel) {
          const limiar = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
          if (t * 0.85 > limiar * 0.8 + 0.15) mascaraImg.data[i * 4 + 3] = 255;
        } else {
          mascaraImg.data[i * 4 + 3] = Math.round(0.85 * suave(0, 1, t) * 255);
        }
      }
    }
    const mascTela = criarTela(aw, ah);
    contextoDe(mascTela).putImageData(mascaraImg, 0, 0);
    const pintada = criarTela(aw, ah), pc = contextoDe(pintada);
    pc.setTransform(res, 0, 0, res, -ax0, -ay0);
    const areaAssent = pixel || padraoDependeDaArea(materialDe(assent.material).padrao)
      ? { x: 0, y: 0, w: e.largura, h: e.altura }
      : { x: ax0 / res, y: ay0 / res, w: aw / res, h: ah / res };
    estilo.pintarMaterial(pc, assent.material, areaAssent, 29, { res });
    pc.setTransform(1, 0, 0, 1, 0, 0);
    // Sujeira de piso gasto junto à fundação para distinguir o aro mesmo sobre neve clara
    pc.fillStyle = '#3e362e';
    pc.globalAlpha = pixel ? 0.24 : 0.38;
    pc.fillRect(0, 0, aw, ah);
    pc.globalAlpha = 1;
    pc.globalCompositeOperation = 'destination-in';
    pc.drawImage(mascTela as CanvasImageSource, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(pintada as CanvasImageSource, ax0 - rx0, ay0 - ry0);
    ctx.setTransform(res, 0, 0, res, -rx0, -ry0);
  }

  if (assent.soleiras.length) {
    const corLeque = materialDe(assent.material ?? 'terra');
    ctx.save();
    ctx.setTransform(res, 0, 0, res, -rx0, -ry0);
    for (const sol of assent.soleiras) {
      const [cx, cy] = sol.centro, [nx, ny] = sol.normal;
      const ang = Math.atan2(ny, nx);
      const wLaje = sol.largura + 0.3;
      const fundoLaje = 0.5;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);

      // Leque de chão gasto saindo da soleira até 1,5 m
      if (!pixel) {
        const g = ctx.createRadialGradient(0.15, 0, 0.1, 0.2, 0, 1.5);
        g.addColorStop(0, corLeque.escuro);
        g.addColorStop(0.5, corLeque.base);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -wLaje * 0.45);
        ctx.arc(0.15, 0, 1.5, -0.68, 0.68);
        ctx.lineTo(0, wLaje * 0.45);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = corLeque.base;
        ctx.fillRect(0.5, -wLaje * 0.55, 0.75, wLaje * 1.1);
      }

      // Laje de pedra (largura da porta + 0,3 m por 0,5 m de fundo, do lado de fora)
      ctx.fillStyle = 'rgba(7, 10, 14, 0.25)';
      ctx.fillRect(0.06, -wLaje / 2 + 0.04, fundoLaje, wLaje);
      ctx.fillStyle = '#8b877f';
      ctx.fillRect(0.04, -wLaje / 2, fundoLaje, wLaje);
      ctx.fillStyle = '#b4b0a6';
      ctx.fillRect(0.04, -wLaje / 2, 0.07, wLaje);
      ctx.strokeStyle = '#3a3834';
      ctx.lineWidth = 0.06;
      ctx.strokeRect(0.04, -wLaje / 2, fundoLaje, wLaje);

      ctx.restore();
    }
    ctx.restore();
  }
}

export type { Parte };
