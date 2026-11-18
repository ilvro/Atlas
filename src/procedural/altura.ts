import { contextoDe, criarTela, type Contexto } from './canvas.ts';
import type { Parte } from './descricao.ts';
import { materialDe, pintarMaterial, pxDe, type Area, type Material, type Padrao } from './materiais.ts';
import { caixaDe, caminho, ordenarPartes } from './raster.ts';

/** Altura em metros correspondente ao valor máximo (1.0 / 255) no mapa de altura dos objetos. */
export const ALTURA_MAXIMA = 4;

/** Raio (m) da média móvel usada no passa-alta de reserva por luminância. */
export const RAIO_PASSA_ALTA = 0.5;

export type PintorDeAltura = (ctx: Contexto, mat: Material, area: Area, seed: number, px: number) => void;

/** Registro de pintores de altura dedicados por padrão de material (preenchido na L10). */
export const PINTORES_DE_ALTURA: Partial<Record<Padrao, PintorDeAltura>> = {};

const limitar = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const limitarInt = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

const cinza = (v: number): string => {
  const c = Math.round(limitar(v) * 255);
  return `rgb(${c},${c},${c})`;
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
    out[k + 1] = c;
    out[k + 2] = c;
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
    pintor(ctx, mat, area, seed, 1 / res);
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

/** Verdadeiro se a parte contribui para o mapa de altura (partes sólidas; exclui luzes, veladuras, suaves e itens sem sombra). */
export function parteEscreveAltura(p: Parte): boolean {
  return !(p.suave || p.desfoque || p.brilho || (p.alfa !== undefined && p.alfa < 0.5) || p.semSombra);
}

/**
 * Desenha a altura (cinza 0–1 relativa a `ALTURA_MAXIMA`) das partes sólidas na mesma ordem e geometria de
 * `desenharPartes`, sem traço, sombra ou AO. Fundo transparente = altura 0. Partes arredondadas (`raio`)
 * recebem um domo radial de `v` no centro a `0.85 * v` na borda.
 */
export function desenharAlturaDasPartes(ctx: Contexto, partes: readonly Parte[], _op: { res: number }): void {
  ctx.save();
  ctx.globalAlpha = 1;
  for (const p of ordenarPartes(partes)) {
    if (!parteEscreveAltura(p)) continue;
    const v = limitar(p.z / ALTURA_MAXIMA);
    caminho(ctx, p);
    if (p.raio) {
      const b = caixaDe(p);
      if (b.w > 0 && b.h > 0) {
        ctx.save();
        ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
        ctx.scale(b.w / 2, b.h / 2);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        g.addColorStop(0, cinza(v));
        g.addColorStop(1, cinza(v * 0.85));
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
        continue;
      }
    }
    ctx.fillStyle = cinza(v);
    ctx.fill();
  }
  ctx.restore();
}
