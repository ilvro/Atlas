import { desenharAlturaDasPartes } from './altura.ts';
import { contornoDoComodo, facesDoContorno, fatorDaFace, caixaDasCelulas, type SegmentoDeContorno } from '../domain/geometria.ts';
import type { Faixa } from '../domain/celulas.ts';
import { decodificar } from '../domain/celulas.ts';
import type { Grade, Ponto } from '../domain/mapa.ts';
import { contextoDe, criarTela, type Contexto, type Tela } from './canvas.ts';
import { caixaDasPartes, type Descricao, type Parte } from './descricao.ts';
import { materialDe, tom } from './materiais.ts';
import { fbm, valueNoise2D } from './ruido.ts';
import { desfocarAlfa } from './desfocar.ts';
import { sombrearMacico } from './macico.ts';
import { partesParaFace } from './raster.ts';
import type { EstiloDeRaster, OpcoesDoPixel } from './estilos/index.ts';
import { pintarFacePixel } from './estilos/faces-pixel.ts';
import { RES_DA_TEXTURA_DE_AGUA, leitoDaAgua, texturaDeAgua } from './agua.ts';
import { orientacaoDominante } from './orientacao.ts';
import { descreverReceita } from './receitas/index.ts';
import { fatorDeProfundidade } from '../domain/relevo.ts';
import { ladoBaixo } from './escarpa.ts';
import { distanciaAMargem } from './profundidade.ts';

export interface Assado {
  tela: Tela;
  /** Tela de altura (cinza 0–1) alinhada à `tela`, ou `null` quando não há (Pixel, parede, terreno/cômodo antes da L4). */
  altura?: Tela | null;
  /** Canto superior esquerdo da tela, em metros (no espaço local do objeto, ou do mundo para cômodos e terreno). */
  origem: Ponto;
  res: number;
  /** Terreno com água: profundidade (R) e margem (G) das camadas de água, a `res` px/m, do mesmo tamanho do mapa. */
  agua?: { tela: Tela; res: number };
}

// ---------- Objetos de piso ----------
export const MARGEM_SOMBRA = 0.3;

/** Uma descrição pronta (de receita ou de gerador pesado) inteira, com partes e sombras, numa tela com o centro do objeto em (0, 0) do espaço local. */
export function assarDescricao(d: Descricao, seed: number, res: number, estilo: EstiloDeRaster, pixel?: OpcoesDoPixel): Assado {
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
    desenharAlturaDasPartes(actx, d.partes, { res });
  }
  return { tela, altura, origem: [x0, y0], res };
}

/** Um objeto de piso de receita inteiro (partes + sombras) numa tela, com o centro do objeto em (0, 0) do espaço local. */
export function assarObjeto(receita: string, params: Record<string, unknown>, seed: number, res: number, estilo: EstiloDeRaster, pixel?: OpcoesDoPixel): Assado {
  return assarDescricao(descreverReceita(receita, { seed, params }), seed, res, estilo, pixel);
}

// ---------- Cômodos ----------
export interface AberturaNaFace { tipo: 'door' | 'window' | 'arch' | 'secret'; centro: Ponto; largura: number; material: string }
export interface ObjetoNaFace { receita: string; params: Record<string, unknown>; seed: number; centro: Ponto }
export interface EntradaDoComodo {
  grade: { size: number; offset: [number, number] };
  celulas: Faixa[];
  outline?: Ponto[];
  piso: { material: string; seed: number };
  papel: { material: string; seed: number } | null;
  estilo: 'box' | 'solid';
  altura: number;
  aberturas: AberturaNaFace[];
  objetos: ObjetoNaFace[];
  /** Degraus do relevo (< 1 m) que cruzam o cômodo, em metros do mapa. */
  degraus?: { caminhos: Ponto[][]; drops: ('a' | 'b')[]; desnivel: number }[];
}

/** Profundidade (m) com que a face de uma parede de `altura` aparece para dentro do cômodo. */
export const profundidadeDaFace = (altura: number): number => altura * 0.42;

const MARGEM_COMODO = 0.4;

/** Onde um ponto do mundo cai sobre um segmento do contorno: distância ao longo dele, ou `null` se não está nele. */
function ao_longo(seg: SegmentoDeContorno, p: Ponto): number | null {
  const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], c = Math.hypot(dx, dy);
  const u = ((p[0] - seg.a[0]) * dx + (p[1] - seg.a[1]) * dy) / c, perp = Math.abs((p[0] - seg.a[0]) * -dy / c + (p[1] - seg.a[1]) * dx / c);
  return perp <= 0.08 && u >= -0.01 && u <= c + 0.01 ? Math.max(0, Math.min(c, u)) : null;
}

/** As partes (na face: u ao longo da parede, altura do chão para cima) que enfeitam uma abertura: o batente da porta, a janela com cortina. */
function partesDaAbertura(a: AberturaNaFace, u: number, H: number): Parte[] {
  const w = a.largura, mad = a.material || 'madeira.media';
  if (a.tipo === 'door') return partesParaFace([
    { forma: 'ret', x: -w / 2 + 0.08, y: 1.08, w: 0.1, h: 2.16, mat: mad, z: 0.1 }, { forma: 'ret', x: w / 2 - 0.08, y: 1.08, w: 0.1, h: 2.16, mat: mad, z: 0.1 },
    { forma: 'ret', x: 0, y: 2.18, w: w - 0.06, h: 0.1, mat: mad, z: 0.1 },
  ], u, H);
  if (a.tipo === 'window') {
    const l = w, cortina = 'cortina.vinho';
    return partesParaFace([
      { forma: 'ret', x: 0, y: 1.55, w: l * 0.82, h: 1.3, mat: mad, z: 0.04 }, { forma: 'ret', x: 0, y: 1.55, w: l * 0.68, h: 1.16, mat: 'vidro', z: 0.05, vidro: true },
      { forma: 'ret', x: 0, y: 1.55, w: 0.04, h: 1.16, mat: mad, z: 0.06 }, { forma: 'ret', x: 0, y: 1.55, w: l * 0.68, h: 0.04, mat: mad, z: 0.06 },
      { forma: 'ret', x: -l * 0.4, y: 1.5, w: 0.22, h: 1.5, mat: cortina, z: 0.08 }, { forma: 'ret', x: l * 0.4, y: 1.5, w: 0.22, h: 1.5, mat: cortina, z: 0.08 },
      { forma: 'ret', x: 0, y: 0.88, w: l * 0.9, h: 0.07, mat: 'madeira.escura', z: 0.09 },
    ], u, H);
  }
  return [];
}

function desenharAbertura(ctx: Contexto, a: AberturaNaFace, u: number, H: number, res: number, estilo: EstiloDeRaster): void {
  const w = a.largura;
  if (a.tipo === 'door' || a.tipo === 'arch') {
    ctx.fillStyle = '#0a080b'; ctx.beginPath();
    if (a.tipo === 'arch') { ctx.rect(u - w / 2 + 0.08, H - 1.7, w - 0.16, 1.7); ctx.moveTo(u - w / 2 + 0.08, H - 1.7); ctx.arc(u, H - 1.7, w / 2 - 0.08, Math.PI, 0); } else ctx.rect(u - w / 2 + 0.08, H - 2.15, w - 0.16, 2.15);
    ctx.fill();
  }
  const partes = partesDaAbertura(a, u, H);
  if (partes.length) estilo.desenharPartes(ctx, partes, { res, seed: 1, sombras: false });
  // Porta secreta: parece parede; só uma fresta quase invisível.
  if (a.tipo === 'secret') { ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.01; ctx.strokeRect(u - w / 2, H - 2.1, w, 2.1); }
}

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

/** Ampliação de leitura dos objetos pendurados na face (a face comprime a altura da parede; quadros e espelhos sumiriam). */
export const AMPLIACAO_NA_FACE: readonly [number, number] = [1.2, 1.7];

/**
 * Amplia as partes de um objeto de parede (já em coordenadas da face: x ao longo da parede, y de cima para baixo) em volta
 * do centro dele, sem passar da sanca (y 0,15) nem do rodapé (y H − 0,2).
 */
export function ampliarNaFace(partes: readonly Parte[], u: number, H: number): Parte[] {
  if (!partes.length) return [];
  let y0 = Infinity, y1 = -Infinity;
  for (const p of partes) {
    if (p.forma === 'poli') for (let i = 1; i < p.pts!.length; i += 2) { y0 = Math.min(y0, p.pts![i]!); y1 = Math.max(y1, p.pts![i]!); }
    else { y0 = Math.min(y0, p.y! - p.h! / 2); y1 = Math.max(y1, p.y! + p.h! / 2); }
  }
  const [sx, sy0] = AMPLIACAO_NA_FACE, cy = (y0 + y1) / 2, meia = (y1 - y0) / 2, limite = Math.min(cy - 0.15, H - 0.2 - cy);
  const sy = meia > 0 ? Math.max(1, Math.min(sy0, limite / meia)) : sy0;
  const X = (x: number) => u + (x - u) * sx, Y = (y: number) => cy + (y - cy) * sy;
  return partes.map(p => (p.forma === 'poli' ? { ...p, pts: p.pts!.map((v, i) => (i % 2 ? Y(v) : X(v))) } : { ...p, x: X(p.x!), y: Y(p.y!), w: p.w! * sx, h: p.h! * sy }));
}

/** O cômodo inteiro numa tela: piso, sombra de contato com as paredes e, no estilo caixa, as faces internas. */
export function assarComodo(e: EntradaDoComodo, res: number, estilo: EstiloDeRaster): Assado {
  const grade: Grade = { size: e.grade.size, offset: e.grade.offset, kind: 'square', visible: false, snap: true, lineStyle: 'solid', color: 'auto', opacity: 0.1, lineWidth: 1 };
  const cells = decodificar(e.celulas);
  const caixa = e.outline && e.outline.length >= 3 ? caixaDoContorno(e.outline) : caixaDasCelulas({ grid: grade }, cells);
  if (!caixa) return { tela: criarTela(1, 1), origem: [0, 0], res };
  const pixel = estilo.id === 'pixel', encaixe = (v: number) => (pixel ? Math.floor(v * res) / res : v);      // no Pixel a tela começa na grade de pixels
  const x0 = encaixe(caixa.x0 - MARGEM_COMODO), y0 = encaixe(caixa.y0 - MARGEM_COMODO);
  const tela = criarTela((caixa.x1 - x0 + MARGEM_COMODO) * res, (caixa.y1 - y0 + MARGEM_COMODO) * res), ctx = contextoDe(tela);
  const base = () => ctx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  base();
  const lacos = contornoDoComodo({ grid: grade }, cells, e.outline);
  const tracar = () => { ctx.beginPath(); for (const laco of lacos) { ctx.moveTo(laco[0]!.a[0], laco[0]!.a[1]); for (const s of laco) ctx.lineTo(s.b[0], s.b[1]); ctx.closePath(); } };

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

  if (e.estilo === 'box') {
    const H = e.altura, profMax = profundidadeDaFace(H), papel = e.papel ?? { material: 'papel.liso-claro', seed: 1 };
    for (const laco of lacos) for (const f of facesDoContorno(laco, profMax, n => profMax * fatorDaFace(n))) {
      const s = f.segmento, prof = f.prof, k = prof / H, comp = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), dx = (s.b[0] - s.a[0]) / comp, dy = (s.b[1] - s.a[1]) / comp;
      if (pixel) {
        const objetos = e.objetos.flatMap(o => { const u = ao_longo(s, o.centro); if (u === null) return []; const d = descreverReceita(o.receita, { seed: o.seed, params: o.params }); return d.tipo === 'parede' ? [{ partes: ampliarNaFace(partesParaFace(d.face, u, H), u, H) }] : []; });
        const aberturas = e.aberturas.flatMap(a => { const u = ao_longo(s, a.centro); return u === null ? [] : [{ tipo: a.tipo, u, largura: a.largura, material: a.material, partes: partesDaAbertura(a, u, H) }]; });
        pintarFacePixel(ctx, { segmento: s, quad: f.quad, H, prof, papel, aberturas, objetos }, res, [x0, y0]);
        continue;
      }
      ctx.save(); base();
      ctx.beginPath(); ctx.moveTo(f.quad[0][0], f.quad[0][1]); for (const q of f.quad.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.clip();
      ctx.transform(dx, dy, s.n[0] * k, s.n[1] * k, s.a[0], s.a[1]);
      const sementeDaFace = Math.round(s.a[0] * 13 + s.a[1] * 7);
      // A face da parede, de cima (y = 0, junto do topo da parede) até o chão (y = H): sanca, papel de parede e rodapé.
      estilo.pintarMaterial(ctx, papel.material, { x: 0, y: 0, w: comp, h: H }, papel.seed + sementeDaFace, { res });
      const corLam = materialDe('madeira.escura').base;
      ctx.fillStyle = tom(corLam, -0.2); ctx.fillRect(0, H - 0.16, comp, 0.16);
      ctx.fillStyle = tom(corLam, 0.25); ctx.fillRect(0, H - 0.17, comp, 0.025);
      ctx.fillStyle = '#e6dccb'; ctx.globalAlpha = 0.85; ctx.fillRect(0, 0, comp, 0.12); ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0.12, comp, 0.03);
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(0.3, 'rgba(0,0,0,0.0)'); gr.addColorStop(0.92, 'rgba(0,0,0,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.38)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, comp, H);
      // A face que olha para a luz (noroeste) clareia um pouco; a oposta, escurece.
      const luz = -(s.n[0] * -0.7071 + s.n[1] * -0.7071);
      ctx.fillStyle = luz > 0 ? `rgba(255,240,215,${(0.08 * luz).toFixed(3)})` : `rgba(0,0,0,${(-0.12 * luz).toFixed(3)})`; ctx.fillRect(0, 0, comp, H);
      for (const a of e.aberturas) { const u = ao_longo(s, a.centro); if (u !== null) desenharAbertura(ctx, a, u, H, res, estilo); }
      for (const o of e.objetos) {
        const u = ao_longo(s, o.centro); if (u === null) continue;
        const d = descreverReceita(o.receita, { seed: o.seed, params: o.params });
        if (d.tipo === 'parede') estilo.desenharPartes(ctx, ampliarNaFace(partesParaFace(d.face, u, H), u, H), { res, seed: o.seed, sombras: false });
      }
      ctx.restore();
    }
  }
  return { tela, origem: [x0, y0], res };
}

// ---------- Terreno ----------
export interface EntradaDeTerreno {
  largura: number; altura: number; resolucao: number; base: string;
  camadas: { material: string; celulas: Faixa[]; /** Correnteza (só em camadas de água). */ flow?: { angle: number; speed: number } | null }[];
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

/** O WebKitGTK não tem `filter` no contexto 2D (nem no OffscreenCanvas). */
const temFiltro = (c: Contexto): boolean => 'filter' in c;

const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Máscara alfa desfocada (0,5 m) com bordas do mapa estendidas para camadas. */
function mascaraSuavizada(celulas: readonly Faixa[], resolucao: number, W: number, Hh: number, res: number): Uint8ClampedArray {
  const mascara = criarTela(W, Hh), mc = contextoDe(mascara);
  mc.setTransform(res, 0, 0, res, 0, 0); mc.fillStyle = '#fff';
  for (const [y, x0, n] of celulas) mc.fillRect(x0 * resolucao, y * resolucao, n * resolucao, resolucao);
  const blur = Math.max(1, 0.5 * res), P = Math.ceil(blur * 3), estendida = criarTela(W + 2 * P, Hh + 2 * P), ec = contextoDe(estendida), M = mascara as CanvasImageSource;
  ec.imageSmoothingEnabled = false;
  ec.drawImage(M, P, P);
  ec.drawImage(M, 0, 0, 1, Hh, 0, P, P, Hh);
  ec.drawImage(M, W - 1, 0, 1, Hh, P + W, P, P, Hh);
  ec.drawImage(M, 0, 0, W, 1, P, 0, W, P);
  ec.drawImage(M, 0, Hh - 1, W, 1, P, P + Hh, W, P);
  ec.drawImage(M, 0, 0, 1, 1, 0, 0, P, P);
  ec.drawImage(M, W - 1, 0, 1, 1, P + W, 0, P, P);
  ec.drawImage(M, 0, Hh - 1, 1, 1, 0, P + Hh, P, P);
  ec.drawImage(M, W - 1, Hh - 1, 1, 1, P + W, P + Hh, P, P);
  if (temFiltro(ec)) {
    const mac = contextoDe(criarTela(W + 2 * P, Hh + 2 * P));
    mac.filter = `blur(${blur}px)`; mac.drawImage(estendida as CanvasImageSource, 0, 0);
    return mac.getImageData(P, P, W, Hh).data;
  }
  const bruta = ec.getImageData(0, 0, W + 2 * P, Hh + 2 * P);
  desfocarAlfa(bruta.data, bruta.width, bruta.height, blur);
  const recorte = new Uint8ClampedArray(W * Hh * 4);
  for (let y = 0; y < Hh; y++) recorte.set(bruta.data.subarray(((y + P) * bruta.width + P) * 4, ((y + P) * bruta.width + P + W) * 4), y * W * 4);
  return recorte;
}

function rasterizarFaixasEmAlfa(celulas: readonly Faixa[], resolucao: number, Mw: number, Mh: number, mRes: number, buf: Uint8ClampedArray): void {
  buf.fill(0);
  const scale = resolucao * mRes;
  for (const [y, x0, n] of celulas) {
    const y0 = Math.max(0, Math.floor(y * scale));
    const y1 = Math.min(Mh, Math.ceil((y + 1) * scale));
    if (y1 <= y0) continue;
    const xStart = Math.max(0, Math.floor(x0 * scale));
    const xEnd = Math.min(Mw, Math.ceil((x0 + n) * scale));
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
  gain: Float32Array;
  bias: Float32Array;
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
): MascaraDeRelevoComposta {
  const mapaGrande = largura * altura >= 8000;
  const mRes = mapaGrande ? Math.min(res, 4) : Math.min(res, 8);
  const Mw = Math.max(1, Math.ceil(largura * mRes));
  const Mh = Math.max(1, Math.ceil(altura * mRes));
  const total = Mw * Mh;
  const gain = new Float32Array(total).fill(1);
  const bias = new Float32Array(total);
  const buf = new Uint8ClampedArray(total * 4);

  for (const f of faixas) {
    const p = fatorDeProfundidade(f.altura, topo);
    if (p <= 0 || !f.celulas.length) continue;
    rasterizarFaixasEmAlfa(f.celulas, resolucao, Mw, Mh, mRes, buf);
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
  return { Mw, Mh, mRes, gain, bias };
}

/** O terreno todo numa tela só. Cada camada tem a borda torcida por ruído (orgânica, não um borrão) e um aro escuro por baixo: a transição automática. */
export function assarTerreno(e: EntradaDeTerreno, res: number, estilo: EstiloDeRaster): Assado {
  const pixel = estilo.id === 'pixel', W = Math.ceil(e.largura * res), Hh = Math.ceil(e.altura * res), tela = criarTela(W, Hh), ctx = contextoDe(tela);
  ctx.setTransform(res, 0, 0, res, 0, 0);
  if (e.base !== 'vazio') estilo.pintarMaterial(ctx, e.base, { x: 0, y: 0, w: e.largura, h: e.altura }, 7, { res });
  const aguas: { profundidade: Float32Array; binaria: Uint8Array }[] = [];
  e.camadas.forEach((camada, idx) => {
    if (!camada.celulas.length) return;
    const fonte = mascaraSuavizada(camada.celulas, e.resolucao, W, Hh, res);
    const ruido = valueNoise2D(1000 + idx * 17);
    const material = materialDe(camada.material), macico = material.uso === 'macico', agua = material.uso === 'agua';
    const corpo = new ImageData(W, Hh), aro = new ImageData(W, Hh), binaria = new Uint8Array(pixel || macico || agua ? W * Hh : 0), cobertura = new Uint8Array((macico || agua) && !pixel ? W * Hh : 0), ruidoFino = valueNoise2D(3000 + idx * 31);
    for (let k = 0, px = 0; k < fonte.length; k += 4, px++) {
      const b = fonte[k + 3]! / 255; if (b < 0.02) continue;
      const mx = (px % W) / res, my = Math.floor(px / W) / res;
      let v = b + (fbm(ruido, mx * 1.3, my * 1.3, 3) - 0.5) * 0.5;
      if (macico) v += pixel ? (fbm(ruidoFino, mx * 3.5, my * 3.5, 3) - 0.5) * 0.35 : (fbm(ruidoFino, mx * 1.5, my * 1.5, 2) - 0.5) * 0.5 + (fbm(ruidoFino, mx * 6 + 9, my * 6, 1) - 0.5) * 0.06;      // borda de rocha: lóbulos grandes e arredondados (Ilustrado), degraus no Pixel
      if (agua) { binaria[px] = v >= 0.5 ? 1 : 0; if (!pixel) cobertura[px] = suave(0.47, 0.53, v) * 255; }
      else if (macico) { binaria[px] = v >= 0.5 ? 1 : 0; if (!pixel) cobertura[px] = suave(0.47, 0.53, v) * 255; }
      else if (pixel) binaria[px] = v >= 0.5 ? 1 : 0;
      else { corpo.data[k + 3] = suave(0.22, 0.78, v) * 255; aro.data[k + 3] = suave(0.12, 0.45, v) * 255; }
    }
    if (agua) {
      // Água: o que está embaixo continua à vista e ganha a cor do leito pela profundidade; a margem é uma faixa de areia molhada.
      const r = leitoDaAgua({ binaria, cobertura: pixel ? null : cobertura, largura: W, altura: Hh, res, seed: 13 + idx * 5, material, pixel });
      const poe = (dados: Uint8ClampedArray) => { const t = criarTela(W, Hh), c = contextoDe(t); c.putImageData(new ImageData(dados as Uint8ClampedArray<ArrayBuffer>, W, Hh), 0, 0); ctx.drawImage(t as CanvasImageSource, 0, 0); };
      ctx.setTransform(1, 0, 0, 1, 0, 0); poe(r.margem); poe(r.leito); ctx.setTransform(res, 0, 0, res, 0, 0);
      aguas.push({ profundidade: r.profundidade, binaria });
      return;
    }
    if (macico) {
      // Maciço: volume próprio (patamares, estrias, sombra de contato) e nenhum aro escuro das camadas comuns.
      const r = sombrearMacico({ dentro: binaria, alfa: pixel ? null : cobertura, largura: W, altura: Hh, res, seed: 11 + idx * 5, cores: material, pixel });
      const poe = (dados: Uint8ClampedArray) => { const t = criarTela(W, Hh), c = contextoDe(t); c.putImageData(new ImageData(dados as Uint8ClampedArray<ArrayBuffer>, W, Hh), 0, 0); ctx.drawImage(t as CanvasImageSource, 0, 0); };
      ctx.setTransform(1, 0, 0, 1, 0, 0); poe(r.sombra); poe(r.rgba); ctx.setTransform(res, 0, 0, res, 0, 0);
      return;
    }
    if (pixel) {
      // Borda em degraus de pixel: a camada é tudo ou nada, e o aro escuro é a vizinhança de 1 pixel dela.
      for (let px = 0; px < binaria.length; px++) {
        const x = px % W, y = (px - x) / W, dentro = binaria[px]!;
        corpo.data[px * 4 + 3] = dentro ? 255 : 0;
        aro.data[px * 4 + 3] = dentro || (x > 0 && binaria[px - 1]) || (x < W - 1 && binaria[px + 1]) || (y > 0 && binaria[px - W]) || (y < Hh - 1 && binaria[px + W]) ? 255 : 0;
      }
    }
    const comAlfa = (dados: ImageData, cor: string | null) => {
      const t = criarTela(W, Hh), c = contextoDe(t); c.putImageData(dados, 0, 0);
      if (cor) { c.globalCompositeOperation = 'source-in'; c.fillStyle = cor; c.fillRect(0, 0, W, Hh); }
      return t;
    };
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = pixel ? 1 : 0.5; ctx.drawImage(comAlfa(aro, material.escuro) as CanvasImageSource, 0, 0); ctx.globalAlpha = 1;
    const pintada = criarTela(W, Hh), pc = contextoDe(pintada);
    pc.setTransform(res, 0, 0, res, 0, 0); estilo.pintarMaterial(pc, camada.material, { x: 0, y: 0, w: e.largura, h: e.altura }, 11 + idx * 5, { res, dir: material.padrao === 'sulcos' ? orientacaoDominante(camada.celulas) : 0 });
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.globalCompositeOperation = 'destination-in'; pc.drawImage(comAlfa(corpo, null) as CanvasImageSource, 0, 0);
    ctx.drawImage(pintada as CanvasImageSource, 0, 0); ctx.setTransform(res, 0, 0, res, 0, 0);
  });
  if (e.assentamento) pintarAssentamento(ctx, e, W, Hh, res, estilo);
  if (e.relevo?.faixas.length) {
    const img = ctx.getImageData(0, 0, W, Hh);
    const pxDados = img.data;
    const nr = parseInt(e.relevo.neblina.slice(1, 3), 16), ng = parseInt(e.relevo.neblina.slice(3, 5), 16), nb = parseInt(e.relevo.neblina.slice(5, 7), 16);
    if (!pixel) {
      const { Mw, Mh, mRes, gain, bias } = comporMascaraDeRelevo(e.relevo.faixas, e.relevo.topo, e.resolucao, e.largura, e.altura, res);
      const sx0 = new Int32Array(W), sx1 = new Int32Array(W);
      const stx = new Float32Array(W);
      const escalaX = mRes / res;
      for (let x = 0; x < W; x++) {
        const fx = Math.max(0, Math.min(Mw - 1, (x + 0.5) * escalaX - 0.5));
        const x0 = Math.floor(fx), x1 = Math.min(Mw - 1, x0 + 1);
        sx0[x] = x0; sx1[x] = x1; stx[x] = fx - x0;
      }
      for (let y = 0; y < Hh; y++) {
        const fy = Math.max(0, Math.min(Mh - 1, (y + 0.5) * escalaX - 0.5));
        const y0 = Math.floor(fy), y1 = Math.min(Mh - 1, y0 + 1), ty = fy - y0;
        const row0 = y0 * Mw, row1 = y1 * Mw;
        const pxRow = y * W * 4;
        for (let x = 0; x < W; x++) {
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
      const Mw = Math.max(1, Math.ceil(e.largura * mRes));
      const Mh = Math.max(1, Math.ceil(e.altura * mRes));
      const masc = new Uint8ClampedArray(Mw * Mh * 4);
      const escala = mRes / res;
      for (const f of e.relevo.faixas) {
        const p = fatorDeProfundidade(f.altura, e.relevo.topo);
        if (p <= 0 || !f.celulas.length) continue;
        rasterizarFaixasEmAlfa(f.celulas, e.resolucao, Mw, Mh, mRes, masc);
        const esc = 1 - 0.6 * p, alfaMax = 0.25 * p;
        for (let y = 0; y < Hh; y++) {
          const my = Math.min(Mh - 1, Math.floor((y + 0.5) * escala));
          const mRow = my * Mw, pxRow = y * W * 4;
          for (let x = 0; x < W; x++) {
            const k = pxRow + x * 4;
            if (!pxDados[k + 3]) continue;
            const mx = Math.min(Mw - 1, Math.floor((x + 0.5) * escala));
            const m = masc[(mRow + mx) * 4 + 3]! / 255;
            if (m < 0.5) continue;
            const limiar = (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
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
    ctx.setTransform(res, 0, 0, res, 0, 0);
  }
  if (e.relevo?.degraus?.length) pintarDegraus(ctx, e.relevo.degraus, res, pixel);
  const dadosDaAgua = texturaDeAgua(aguas, W, Hh, res, e.largura, e.altura);
  if (dadosDaAgua) { const ta = criarTela(dadosDaAgua.width, dadosDaAgua.height); contextoDe(ta).putImageData(dadosDaAgua, 0, 0); return { tela, origem: [0, 0], res, agua: { tela: ta, res: RES_DA_TEXTURA_DE_AGUA } }; }
  return { tela, origem: [0, 0], res };
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

/**
 * Degraus < 1 m como talude: faixa de sombra em degradê no lado baixo, hachuras curtas de declive ao longo do
 * contorno, quebra escura no pé da crista e borda clara no topo. No Pixel, menos camadas e traço de 1 px.
 */
export function pintarDegraus(ctx: Contexto, degraus: readonly { caminhos: Ponto[][]; drops: ('a' | 'b')[]; desnivel?: number }[], res: number, pixel: boolean): void {
  ctx.save();
  ctx.setTransform(res, 0, 0, res, 0, 0);
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

function pintarAssentamento(ctx: Contexto, e: EntradaDeTerreno, W: number, Hh: number, res: number, estilo: EstiloDeRaster): void {
  const assent = e.assentamento;
  if (!assent) return;
  const pixel = estilo.id === 'pixel';
  const preencherFaixas = (faixas: readonly Faixa[], destino: Uint8Array, valor: number) => {
    for (const [fy, fx0, fn] of faixas) {
      const py0 = Math.max(0, Math.floor(fy * e.resolucao * res));
      const py1 = Math.min(Hh - 1, Math.ceil((fy + 1) * e.resolucao * res) - 1);
      const px0 = Math.max(0, Math.floor(fx0 * e.resolucao * res));
      const px1 = Math.min(W - 1, Math.ceil((fx0 + fn) * e.resolucao * res) - 1);
      for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) destino[y * W + x] = valor;
    }
  };

  if (assent.material && assent.celulas.length) {
    const anel = new Uint8Array(W * Hh);
    preencherFaixas(assent.celulas, anel, 1);
    const foraSalas = new Uint8Array(W * Hh).fill(1);
    if (assent.salas?.length) preencherFaixas(assent.salas, foraSalas, 0);
    const dist = assent.salas?.length ? distanciaAMargem(foraSalas, W, Hh, res, 0.9) : null;
    const macia = dist ? null : mascaraSuavizada(assent.celulas, e.resolucao, W, Hh, res);
    const ruido = valueNoise2D(4711);
    const mascaraImg = new ImageData(W, Hh);
    for (let y = 0, i = 0; y < Hh; y++) for (let x = 0; x < W; x++, i++) {
      if (!anel[i]) continue;
      const mx = x / res, my = y / res;
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
    const mascTela = criarTela(W, Hh);
    contextoDe(mascTela).putImageData(mascaraImg, 0, 0);
    const pintada = criarTela(W, Hh), pc = contextoDe(pintada);
    pc.setTransform(res, 0, 0, res, 0, 0);
    estilo.pintarMaterial(pc, assent.material, { x: 0, y: 0, w: e.largura, h: e.altura }, 29, { res });
    pc.setTransform(1, 0, 0, 1, 0, 0);
    // Sujeira de piso gasto junto à fundação para distinguir o aro mesmo sobre neve clara
    pc.fillStyle = '#3e362e';
    pc.globalAlpha = pixel ? 0.24 : 0.38;
    pc.fillRect(0, 0, W, Hh);
    pc.globalAlpha = 1;
    pc.globalCompositeOperation = 'destination-in';
    pc.drawImage(mascTela as CanvasImageSource, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(pintada as CanvasImageSource, 0, 0);
    ctx.setTransform(res, 0, 0, res, 0, 0);
  }

  if (assent.soleiras.length) {
    const corLeque = materialDe(assent.material ?? 'terra');
    ctx.save();
    ctx.setTransform(res, 0, 0, res, 0, 0);
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
