import { contextoDe, criarTela, type Contexto } from '../canvas.ts';
import type { Parte } from '../descricao.ts';
import { materialDe } from '../materiais.ts';
import { caixaDe, caminho } from '../raster.ts';
import { pintarMaterialPixel, tonsDe } from './materiais-pixel.ts';

/** Partes de objetos no estilo Pixel: cada uma vira pixels inteiros, com o material do Pixel, sombreado em degraus pela altura e sombra de contato dura. */

const TINTA = [11, 10, 16] as const;

/** A parte cabe na resolução? Abaixo de 1 px ela some; `detalhe 3` some abaixo de 24 px por célula e `detalhe 2` abaixo de 12. */
export function parteVisivel(p: Pick<Parte, 'detalhe'> & { maiorLado: number }, ppc: number | undefined, res: number): boolean {
  if (p.maiorLado * res < 0.9) return false;
  if (ppc === undefined) return true;
  if (p.detalhe === 3 && ppc < 24) return false;
  if (p.detalhe === 2 && ppc < 12) return false;
  return true;
}

/** O degrau de luz de uma parte pela altura: 0 (rente ao chão), 1 (móvel baixo) ou 2 (alto). */
export const degrauDeAltura = (z: number): 0 | 1 | 2 => (z < 0.5 ? 0 : z < 1.5 ? 1 : 2);

/** Escolhe e ordena (por altura) as partes que o Pixel desenha. */
export function partesDoPixel(partes: readonly Parte[], ppc: number | undefined, res: number): Parte[] {
  return [...partes].filter(p => { const b = caixaDe(p); return parteVisivel({ detalhe: p.detalhe, maiorLado: Math.max(b.w, b.h) }, ppc, res); }).sort((a, b) => a.z - b.z);
}

/** Alfa binário: nada de meio pixel. */
function limiar(d: Uint8ClampedArray): void { for (let i = 3; i < d.length; i += 4) d[i] = d[i]! >= 110 ? 255 : 0; }

function pintarPixelDe(d: Uint8ClampedArray, i: number, [r, g, b]: [number, number, number]): void { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
const rgb = (hex: string): [number, number, number] => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };

/** Luz de cima e da esquerda, sombra embaixo e à direita: o primeiro pixel da borda ganha o tom claro ou escuro (cores chapadas). */
function sombrearBordas(d: Uint8ClampedArray, w: number, h: number, claro: [number, number, number], escuro: [number, number, number]): void {
  const sol = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] === 255;
  const marcas = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!sol(x, y)) continue;
    if (!sol(x, y + 1) || !sol(x + 1, y)) marcas[y * w + x] = -1; else if (!sol(x, y - 1) || !sol(x - 1, y)) marcas[y * w + x] = 1;
  }
  for (let i = 0; i < marcas.length; i++) if (marcas[i]) pintarPixelDe(d, i, marcas[i]! > 0 ? claro : escuro);
}

/** Contorno de 1 px de tinta em volta do que é sólido (também por cima da sombra de contato). */
export function contornarPixels(d: Uint8ClampedArray, w: number, h: number): void {
  const sol = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3]! >= 200;
  const novos: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!sol(x, y) && (sol(x - 1, y) || sol(x + 1, y) || sol(x, y - 1) || sol(x, y + 1))) novos.push(y * w + x);
  for (const i of novos) pintarPixelDe(d, i, TINTA as unknown as [number, number, number]);
}

/**
 * Desenha as partes no contexto (já em metros) como pixel art. Cada parte é pintada numa tela de rascunho, vira alfa binário, ganha as bordas
 * claras e escuras do seu degrau de altura e a sombra de contato, e só então vai para o destino.
 */
export function desenharPartesPixel(ctx: Contexto, partes: readonly Parte[], { res, seed, sombras, ppc }: { res: number; seed: number; sombras: boolean; ppc?: number }): void {
  const lista = partesDoPixel(partes, ppc, res); if (!lista.length) return;
  const W = ctx.canvas.width, H = ctx.canvas.height, m = ctx.getTransform(), px = 1 / res;
  const rascunho = criarTela(W, H), rc = contextoDe(rascunho, { willReadFrequently: true });
  lista.forEach((p, i) => {
    const b = caixaDe(p), cantos = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => [m.a * x! + m.c * y! + m.e, m.b * x! + m.d * y! + m.f] as const);
    const bx = Math.max(0, Math.floor(Math.min(...cantos.map(c => c[0])) - 3)), by = Math.max(0, Math.floor(Math.min(...cantos.map(c => c[1])) - 3));
    const ex = Math.min(W, Math.ceil(Math.max(...cantos.map(c => c[0])) + 3)), ey = Math.min(H, Math.ceil(Math.max(...cantos.map(c => c[1])) + 3)), bw = ex - bx, bh = ey - by;
    if (bw <= 0 || bh <= 0) return;
    rc.setTransform(1, 0, 0, 1, 0, 0); rc.clearRect(bx, by, bw, bh);
    rc.setTransform(m); rc.save(); caminho(rc, p); rc.clip();
    pintarMaterialPixel(rc, p.mat, { x: b.x - px, y: b.y - px, w: b.w + 2 * px, h: b.h + 2 * px }, seed * 31 + i, { dir: p.dir ?? 0, res });
    rc.restore(); rc.setTransform(1, 0, 0, 1, 0, 0);
    const img = rc.getImageData(bx, by, bw, bh), d = img.data; limiar(d);
    let x0 = bw, y0 = bh, x1 = -1, y1 = -1;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) if (d[(y * bw + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return;
    const tons = tonsDe(materialDe(p.mat)), nivel = degrauDeAltura(p.z);
    if (Math.min(x1 - x0, y1 - y0) >= 3) sombrearBordas(d, bw, bh, rgb([tons.c1, tons.c2, tons.C][nivel]!), rgb([tons.e1, tons.e2, tons.E][nivel]!));
    if (p.vidro) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (d[(y * bw + x) * 4 + 3] && Math.abs((x - x0) - (y1 - y) - (x1 - x0) * 0.25) < 0.5) pintarPixelDe(d, y * bw + x, rgb('#dbe9f1'));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (sombras && !p.semSombra && p.z > 0.03) {
      // Sombra de contato: a silhueta deslocada 1 px (2 px para o que é alto), só o que sai por baixo da parte.
      const desl = p.sombraLeve || p.z < 0.5 ? 1 : 2, sombra = new ImageData(bw, bh), s = sombra.data;
      for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
        if (d[(y * bw + x) * 4 + 3] !== 255) continue;
        const tx = x + desl, ty = y + desl; if (tx >= bw || ty >= bh || d[(ty * bw + tx) * 4 + 3] === 255) continue;
        const j = (ty * bw + tx) * 4; s[j] = TINTA[0]; s[j + 1] = TINTA[1]; s[j + 2] = TINTA[2]; s[j + 3] = ALFA_DA_SOMBRA;
      }
      rc.putImageData(sombra, bx, by); ctx.drawImage(rascunho as CanvasImageSource, bx, by, bw, bh, bx, by, bw, bh);
    }
    rc.putImageData(img, bx, by); ctx.drawImage(rascunho as CanvasImageSource, bx, by, bw, bh, bx, by, bw, bh);
    ctx.restore();
  });
}

/** Sombras de partes diferentes se acumulam; no fim todo alfa parcial vira o mesmo alfa da sombra, e o resto fica sólido. */
export const ALFA_DA_SOMBRA = 115;
export function uniformizarSombra(d: Uint8ClampedArray): void { for (let i = 3; i < d.length; i += 4) if (d[i]! > 0 && d[i]! < 255) d[i] = ALFA_DA_SOMBRA; }

/** O passo final do objeto: a sombra com um único tom e o contorno de 1 px de tinta (quando `style.pixel.outline`). */
export function finalizarPixel(ctx: Contexto, largura: number, altura: number, { contorno }: { contorno: boolean }): void {
  const img = ctx.getImageData(0, 0, largura, altura); uniformizarSombra(img.data);
  if (contorno) contornarPixels(img.data, largura, altura);
  ctx.putImageData(img, 0, 0);
}
