import { contornoDoComodo, facesDoContorno, caixaDasCelulas, type SegmentoDeContorno } from '../domain/geometria.ts';
import type { Faixa } from '../domain/celulas.ts';
import { decodificar } from '../domain/celulas.ts';
import type { Ponto } from '../domain/mapa.ts';
import { contextoDe, criarTela, type Contexto, type Tela } from './canvas.ts';
import { caixaDasPartes, type Descricao, type Parte } from './descricao.ts';
import { materialDe, tom } from './materiais.ts';
import { fbm, valueNoise2D } from './ruido.ts';
import { partesParaFace } from './raster.ts';
import type { EstiloDeRaster, OpcoesDoPixel } from './estilos/index.ts';
import { descreverReceita } from './receitas/index.ts';

export interface Assado { tela: Tela; /** Canto superior esquerdo da tela, em metros (no espaço local do objeto, ou do mundo para cômodos e terreno). */ origem: Ponto; res: number }

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
  return { tela, origem: [x0, y0], res };
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
  piso: { material: string; seed: number };
  papel: { material: string; seed: number } | null;
  estilo: 'box' | 'solid';
  altura: number;
  aberturas: AberturaNaFace[];
  objetos: ObjetoNaFace[];
}

/** Profundidade (m) com que a face de uma parede de `altura` aparece para dentro do cômodo. */
export const profundidadeDaFace = (altura: number): number => altura * 0.21;

const MARGEM_COMODO = 0.4;

/** Onde um ponto do mundo cai sobre um segmento do contorno: distância ao longo dele, ou `null` se não está nele. */
function ao_longo(seg: SegmentoDeContorno, p: Ponto): number | null {
  const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], c = Math.hypot(dx, dy);
  const u = ((p[0] - seg.a[0]) * dx + (p[1] - seg.a[1]) * dy) / c, perp = Math.abs((p[0] - seg.a[0]) * -dy / c + (p[1] - seg.a[1]) * dx / c);
  return perp <= 0.08 && u >= -0.01 && u <= c + 0.01 ? Math.max(0, Math.min(c, u)) : null;
}

function desenharAbertura(ctx: Contexto, a: AberturaNaFace, u: number, H: number, res: number, estilo: EstiloDeRaster): void {
  const w = a.largura, mad = a.material || 'madeira.media';
  if (a.tipo === 'door' || a.tipo === 'arch') {
    ctx.fillStyle = '#0a080b'; ctx.beginPath();
    if (a.tipo === 'arch') { ctx.rect(u - w / 2 + 0.08, H - 1.7, w - 0.16, 1.7); ctx.moveTo(u - w / 2 + 0.08, H - 1.7); ctx.arc(u, H - 1.7, w / 2 - 0.08, Math.PI, 0); } else ctx.rect(u - w / 2 + 0.08, H - 2.15, w - 0.16, 2.15);
    ctx.fill();
    if (a.tipo === 'door') estilo.desenharPartes(ctx, partesParaFace([
      { forma: 'ret', x: -w / 2 + 0.08, y: 1.08, w: 0.1, h: 2.16, mat: mad, z: 0.1 }, { forma: 'ret', x: w / 2 - 0.08, y: 1.08, w: 0.1, h: 2.16, mat: mad, z: 0.1 },
      { forma: 'ret', x: 0, y: 2.18, w: w - 0.06, h: 0.1, mat: mad, z: 0.1 },
    ], u, H), { res, seed: 1, sombras: false });
  } else if (a.tipo === 'window') {
    const l = w, cortina = 'cortina.vinho';
    estilo.desenharPartes(ctx, partesParaFace([
      { forma: 'ret', x: 0, y: 1.55, w: l * 0.82, h: 1.3, mat: mad, z: 0.04 }, { forma: 'ret', x: 0, y: 1.55, w: l * 0.68, h: 1.16, mat: 'vidro', z: 0.05, vidro: true },
      { forma: 'ret', x: 0, y: 1.55, w: 0.04, h: 1.16, mat: mad, z: 0.06 }, { forma: 'ret', x: 0, y: 1.55, w: l * 0.68, h: 0.04, mat: mad, z: 0.06 },
      { forma: 'ret', x: -l * 0.4, y: 1.5, w: 0.22, h: 1.5, mat: cortina, z: 0.08 }, { forma: 'ret', x: l * 0.4, y: 1.5, w: 0.22, h: 1.5, mat: cortina, z: 0.08 },
      { forma: 'ret', x: 0, y: 0.88, w: l * 0.9, h: 0.07, mat: 'madeira.escura', z: 0.09 },
    ], u, H), { res, seed: 1, sombras: false });
  }
  // Porta secreta: parece parede; só uma fresta quase invisível.
  else { ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.01; ctx.strokeRect(u - w / 2, H - 2.1, w, 2.1); }
}

/** O cômodo inteiro numa tela: piso, sombra de contato com as paredes e, no estilo caixa, as quatro faces internas. */
export function assarComodo(e: EntradaDoComodo, res: number, estilo: EstiloDeRaster): Assado {
  const cells = decodificar(e.celulas), caixa = caixaDasCelulas({ grid: { size: e.grade.size, offset: e.grade.offset, kind: 'square', visible: true } }, cells);
  if (!caixa) return { tela: criarTela(1, 1), origem: [0, 0], res };
  const pixel = estilo.id === 'pixel', encaixe = (v: number) => (pixel ? Math.floor(v * res) / res : v);      // no Pixel a tela começa na grade de pixels
  const x0 = encaixe(caixa.x0 - MARGEM_COMODO), y0 = encaixe(caixa.y0 - MARGEM_COMODO);
  const tela = criarTela((caixa.x1 - x0 + MARGEM_COMODO) * res, (caixa.y1 - y0 + MARGEM_COMODO) * res), ctx = contextoDe(tela);
  const base = () => ctx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  base();
  const lacos = contornoDoComodo({ grid: { size: e.grade.size, offset: e.grade.offset, kind: 'square', visible: true } }, cells);
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
  ctx.restore();

  if (e.estilo === 'box') {
    const H = e.altura, prof = profundidadeDaFace(H), k = prof / H, papel = e.papel ?? { material: 'papel.liso-claro', seed: 1 };
    for (const laco of lacos) for (const f of facesDoContorno(laco, prof)) {
      const s = f.segmento, comp = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), dx = (s.b[0] - s.a[0]) / comp, dy = (s.b[1] - s.a[1]) / comp;
      ctx.save(); base();
      ctx.beginPath(); ctx.moveTo(f.quad[0][0], f.quad[0][1]); for (const q of f.quad.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.clip();
      ctx.transform(dx, dy, s.n[0] * k, s.n[1] * k, s.a[0], s.a[1]);
      const sementeDaFace = Math.round(s.a[0] * 13 + s.a[1] * 7);
      estilo.pintarMaterial(ctx, papel.material, { x: 0, y: 0, w: comp, h: H }, papel.seed + sementeDaFace, { res });
      estilo.pintarMaterial(ctx, 'madeira.escura', { x: 0, y: H - 0.9, w: comp, h: 0.9 }, 3 + sementeDaFace, { res });
      ctx.fillStyle = tom(materialDe('madeira.media').base, 0.1); ctx.fillRect(0, H - 0.93, comp, 0.05);
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.35, 'rgba(0,0,0,0.12)'); gr.addColorStop(0.9, 'rgba(0,0,0,0.1)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, comp, H);
      for (const a of e.aberturas) { const u = ao_longo(s, a.centro); if (u !== null) desenharAbertura(ctx, a, u, H, res, estilo); }
      for (const o of e.objetos) {
        const u = ao_longo(s, o.centro); if (u === null) continue;
        const d = descreverReceita(o.receita, { seed: o.seed, params: o.params });
        if (d.tipo === 'parede') estilo.desenharPartes(ctx, partesParaFace(d.face, u, H), { res, seed: o.seed, sombras: false });
      }
      ctx.restore();
    }
  }
  return { tela, origem: [x0, y0], res };
}

// ---------- Terreno ----------
export interface EntradaDeTerreno {
  largura: number; altura: number; resolucao: number; base: string;
  camadas: { material: string; celulas: Faixa[] }[];
}

const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** O terreno todo numa tela só. Cada camada tem a borda torcida por ruído (orgânica, não um borrão) e um aro escuro por baixo: a transição automática. */
export function assarTerreno(e: EntradaDeTerreno, res: number, estilo: EstiloDeRaster): Assado {
  const pixel = estilo.id === 'pixel', W = Math.ceil(e.largura * res), Hh = Math.ceil(e.altura * res), tela = criarTela(W, Hh), ctx = contextoDe(tela);
  ctx.setTransform(res, 0, 0, res, 0, 0);
  if (e.base !== 'vazio') estilo.pintarMaterial(ctx, e.base, { x: 0, y: 0, w: e.largura, h: e.altura }, 7, { res });
  e.camadas.forEach((camada, idx) => {
    if (!camada.celulas.length) return;
    const mascara = criarTela(W, Hh), mc = contextoDe(mascara);
    mc.setTransform(res, 0, 0, res, 0, 0); mc.fillStyle = '#fff';
    for (const [y, x0, n] of camada.celulas) mc.fillRect(x0 * e.resolucao, y * e.resolucao, n * e.resolucao, e.resolucao);
    const macia = criarTela(W, Hh), mac = contextoDe(macia);
    mac.filter = `blur(${Math.max(1, 0.5 * res)}px)`; mac.drawImage(mascara as CanvasImageSource, 0, 0);
    const fonte = mac.getImageData(0, 0, W, Hh).data, ruido = valueNoise2D(1000 + idx * 17);
    const corpo = new ImageData(W, Hh), aro = new ImageData(W, Hh), binaria = new Uint8Array(pixel ? W * Hh : 0);
    for (let k = 0, px = 0; k < fonte.length; k += 4, px++) {
      const b = fonte[k + 3]! / 255; if (b < 0.04) continue;
      const v = b + (fbm(ruido, (px % W) / res * 1.3, Math.floor(px / W) / res * 1.3, 3) - 0.5) * 0.5;
      if (pixel) binaria[px] = v >= 0.5 ? 1 : 0;
      else { corpo.data[k + 3] = suave(0.47, 0.53, v) * 255; aro.data[k + 3] = suave(0.3, 0.47, v) * 255; }
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
    const material = materialDe(camada.material);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = pixel ? 1 : 0.5; ctx.drawImage(comAlfa(aro, material.escuro) as CanvasImageSource, 0, 0); ctx.globalAlpha = 1;
    const pintada = criarTela(W, Hh), pc = contextoDe(pintada);
    pc.setTransform(res, 0, 0, res, 0, 0); estilo.pintarMaterial(pc, camada.material, { x: 0, y: 0, w: e.largura, h: e.altura }, 11 + idx * 5, { res });
    pc.setTransform(1, 0, 0, 1, 0, 0); pc.globalCompositeOperation = 'destination-in'; pc.drawImage(comAlfa(corpo, null) as CanvasImageSource, 0, 0);
    ctx.drawImage(pintada as CanvasImageSource, 0, 0); ctx.setTransform(res, 0, 0, res, 0, 0);
  });
  return { tela, origem: [0, 0], res };
}

export type { Parte };
