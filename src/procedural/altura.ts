import { contextoDe, criarTela, type Contexto } from './canvas.ts';
import type { Parte } from './descricao.ts';
import { ALTURAS_DE_PADRAO, materialDe, pintarMaterial, pxDe, type Area, type Material, type Padrao } from './materiais.ts';
import { caixaDe, caminho, ordenarPartes } from './raster.ts';

/** Metros por unidade do mapa de altura: `0,5 + z / ALTURA_MAXIMA` cobre de −2 m a +2 m em volta do piso. */
export const ALTURA_MAXIMA = 4;
/** O piso no mapa de altura. */
export const PISO_NO_MAPA = 0.5;
/** Valor (0–1) de uma altura `z` (m) no mapa: absoluto, com o piso em 0,5; abaixo do piso (escada que desce, poço) vale. */
export const alturaNoMapa = (z: number): number => Math.min(1, Math.max(0, PISO_NO_MAPA + z / ALTURA_MAXIMA));

/** Raio (m) da média móvel usada no passa-alta de reserva por luminância. */
export const RAIO_PASSA_ALTA = 0.5;

export type PintorDeAltura = (ctx: Contexto, mat: Material, area: Area, seed: number, px: number, dir?: number) => void;

/** Registro de pintores de altura dedicados por padrão de material (a mesma geometria do desenho; ver `ALTURAS_DE_PADRAO`). */
export const PINTORES_DE_ALTURA: Partial<Record<Padrao, PintorDeAltura>> = ALTURAS_DE_PADRAO;

const limitar = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const limitarInt = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

const canalR = (v: number): string => {
  const c = Math.round(limitar(v) * 255);
  return `rgb(${c},0,0)`;
};

const canalG = (v: number): string => {
  const c = Math.round(limitar(v) * 255);
  return `rgb(0,${c},0)`;
};

/**
 * Converte uma imagem RGBA em mapa de altura por passa-alta da luminância (`0.5 + 0.35 * (L - média_0.5m)`),
 * preservando o canal alfa original. Juntas e frestas escuras ficam abaixo de 0,5 e miolos claros acima.
 */
export function alturaPorLuminancia(rgba: Uint8ClampedArray, largura: number, altura: number, res: number): Uint8ClampedArray {
  const n = largura * altura;
  const out = new Uint8ClampedArray(n * 4);
  if (largura < 1 || altura < 1) return out;

  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    lum[i] = (0.299 * rgba[k]! + 0.587 * rgba[k + 1]! + 0.114 * rgba[k + 2]!) / 255;
  }

  const r = Math.max(1, Math.round(RAIO_PASSA_ALTA * res));
  const win = 2 * r + 1;
  const tmp = new Float32Array(n);
  const media = new Float32Array(n);

  for (let y = 0; y < altura; y++) {
    const o = y * largura;
    let s = 0;
    for (let i = -r; i <= r; i++) s += lum[o + limitarInt(i, 0, largura - 1)]!;
    for (let x = 0; x < largura; x++) {
      tmp[o + x] = s / win;
      s += lum[o + limitarInt(x + r + 1, 0, largura - 1)]! - lum[o + limitarInt(x - r, 0, largura - 1)]!;
    }
  }

  for (let x = 0; x < largura; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += tmp[limitarInt(i, 0, altura - 1) * largura + x]!;
    for (let y = 0; y < altura; y++) {
      media[y * largura + x] = s / win;
      s += tmp[limitarInt(y + r + 1, 0, altura - 1) * largura + x]! - tmp[limitarInt(y - r, 0, altura - 1) * largura + x]!;
    }
  }

  for (let i = 0; i < n; i++) {
    const k = i * 4;
    const passaAlta = lum[i]! - media[i]!;
    const c = Math.round(limitar(0.5 + 0.35 * passaAlta) * 255);
    out[k] = c;
    out[k + 1] = 0;
    out[k + 2] = 0;
    out[k + 3] = rgba[k + 3]!;
  }
  return out;
}

/**
 * Pinta a altura de um material em `area` (em metros). Usa o pintor dedicado em `PINTORES_DE_ALTURA` quando existir;
 * caso contrário, usa a reserva por luminância (`0.5 + 0.35 * passaAlta`).
 */
export function pintarAlturaDoMaterial(ctx: Contexto, id: string, area: Area, seed = 1, o: { dir?: number; res?: number } = {}): void {
  const mat = materialDe(id);
  const res = o.res ?? (typeof ctx.getTransform === 'function' ? 1 / pxDe(ctx) : 1);
  const pintor = PINTORES_DE_ALTURA[mat.padrao];
  if (pintor) {
    ctx.save();
    if (o.dir) {
      const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(o.dir);
      ctx.translate(-cx, -cy);
    }
    pintor(ctx, mat, area, seed, 1 / res, o.dir);
    ctx.restore();
    return;
  }

  let s = res;
  if (area.w * area.h * s * s > 9e6) s = Math.sqrt(9e6 / Math.max(1e-6, area.w * area.h));
  const W = Math.max(1, Math.ceil(area.w * s));
  const H = Math.max(1, Math.ceil(area.h * s));
  const sx = W / Math.max(1e-6, area.w);
  const sy = H / Math.max(1e-6, area.h);
  const tmp = criarTela(W, H);
  const tc = contextoDe(tmp, { willReadFrequently: true });
  tc.setTransform(sx, 0, 0, sy, -area.x * sx, -area.y * sy);
  pintarMaterial(tc, id, area, seed, { dir: o.dir });
  const img = tc.getImageData(0, 0, W, H);
  img.data.set(alturaPorLuminancia(img.data, W, H, (sx + sy) * 0.5));
  tc.setTransform(1, 0, 0, 1, 0, 0);
  tc.putImageData(img, 0, 0);
  ctx.save();
  ctx.drawImage(tmp as CanvasImageSource, area.x, area.y, area.w, area.h);
  ctx.restore();
}

/**
 * Verdadeiro se a parte contribui para o mapa de altura (partes sólidas; exclui luzes, veladuras e suaves). `semSombra` escreve:
 * a parte não projeta sombra, mas é superfície (tapete, toalha), e sem altura própria herdava o relevo do piso embaixo.
 */
export function parteEscreveAltura(p: Parte): boolean {
  return !(p.suave || p.desfoque || p.brilho || (p.alfa !== undefined && p.alfa < 0.5));
}

/** Verdadeiro se a parte escreve emissão no canal G do mapa de altura (`brilho: true`). */
export function parteEscreveEmissao(p: Parte): boolean {
  return Boolean(p.brilho);
}

const PISO_BYTE = Math.round(PISO_NO_MAPA * 255);

/**
 * Compõe uma máscara alfa de emissão (ex.: brilho com `desfoque`) no buffer RGBA do mapa de altura,
 * somando `alfa` no canal G sem rebaixar o canal R abaixo do piso nas bordas semitransparentes.
 */
export function comporEmissaoNoMapa(dst: Uint8ClampedArray, mascara: Uint8ClampedArray, alfa: number): void {
  const gEmis = limitar(alfa) * 255;
  for (let i = 0; i < dst.length; i += 4) {
    const m = mascara[i + 3]! / 255;
    if (m <= 0) continue;
    const da = dst[i + 3]! / 255;
    const outA = da + m * (1 - da);
    if (outA <= 0) continue;
    const dr = dst[i]!;
    const dg = dst[i + 1]!;
    dst[i] = Math.round((dr * da + PISO_BYTE * m * (1 - da)) / outA);
    dst[i + 1] = Math.min(255, Math.round((dg * da + gEmis * m) / outA));
    dst[i + 2] = 0;
    dst[i + 3] = Math.min(255, Math.round(outA * 255));
  }
}

/**
 * Desenha a altura no canal R (`alturaNoMapa(z)`: absoluta, piso em 0,5) das partes sólidas e a emissão no canal G (`alfa`)
 * das partes `brilho: true` na mesma ordem e geometria de `desenharPartes`, sem traço, sombra ou AO. Fundo transparente = sem objeto.
 * Partes arredondadas (`raio`) recebem um domo radial, 15% mais perto do piso na borda.
 */
export function desenharAlturaDasPartes(ctx: Contexto, partes: readonly Parte[], op: { res: number; /** Altura real do objeto (m): nenhuma parte passa dela no mapa. */ teto?: number }): void {
  ctx.save();
  ctx.globalAlpha = 1;
  for (const p of ordenarPartes(partes)) {
    if (parteEscreveEmissao(p)) {
      const alfa = p.alfa ?? 1;
      if (alfa <= 0) continue;
      if (p.desfoque && 'canvas' in ctx && typeof ctx.getImageData === 'function' && typeof ctx.putImageData === 'function' && typeof ctx.getTransform === 'function') {
        const w = ctx.canvas.width, h = ctx.canvas.height;
        if (w > 0 && h > 0) {
          const tmp = criarTela(w, h), tc = contextoDe(tmp, { willReadFrequently: true });
          const m = ctx.getTransform();
          tc.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
          if ('filter' in tc) tc.filter = `blur(${Math.max(0.5, p.desfoque * op.res).toFixed(2)}px)`;
          tc.fillStyle = '#ffffff';
          caminho(tc, p);
          tc.fill();
          const dst = ctx.getImageData(0, 0, w, h);
          const masc = tc.getImageData(0, 0, w, h);
          comporEmissaoNoMapa(dst.data, masc.data, alfa);
          ctx.save();
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.putImageData(dst, 0, 0);
          ctx.restore();
          continue;
        }
      }
      ctx.save();
      ctx.globalAlpha = 1;
      if (p.desfoque && 'filter' in ctx) ctx.filter = `blur(${Math.max(0.5, p.desfoque * op.res).toFixed(2)}px)`;
      // Onde ainda não há nada, o brilho assenta no piso (0,5); depois soma a emissão no G.
      if ('globalCompositeOperation' in ctx) ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = canalR(PISO_NO_MAPA);
      caminho(ctx, p);
      ctx.fill();
      if ('globalCompositeOperation' in ctx) ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = canalG(alfa);
      caminho(ctx, p);
      ctx.fill();
      ctx.restore();
      continue;
    }
    if (!parteEscreveAltura(p)) continue;
    const v = alturaNoMapa(op.teto !== undefined ? Math.min(p.z, op.teto) : p.z);
    caminho(ctx, p);
    if (p.raio) {
      const b = caixaDe(p);
      if (b.w > 0 && b.h > 0) {
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.scale(b.w / 2, b.h / 2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, canalR(v));
        g.addColorStop(1, canalR(PISO_NO_MAPA + (v - PISO_NO_MAPA) * 0.85));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        continue;
      }
    }
    ctx.fillStyle = canalR(v);
    ctx.fill();
  }
  ctx.restore();
}
