import type { SegmentoDeContorno } from '../../domain/geometria.ts';
import type { Ponto } from '../../domain/mapa.ts';
import { contextoDe, criarTela, type Contexto } from '../canvas.ts';
import type { Parte } from '../descricao.ts';
import { materialDe } from '../materiais.ts';
import { caixaDe } from '../raster.ts';
import { pintarMaterialPixel, tonsDe } from './materiais-pixel.ts';

/**
 * A face interna de uma parede (estilo caixa) no Pixel. Tudo é feito em pixels do dispositivo: o papel é pintado num rascunho, a face é cortada em
 * fileiras de 1 px de profundidade e cada fileira vai do começo ao fim do trapézio (por isso a meia-esquadria dos cantos vira degraus de pixel).
 */

export interface FaceDoComodo {
  segmento: SegmentoDeContorno; quad: [Ponto, Ponto, Ponto, Ponto];
  /** Altura da parede e profundidade da face (m). */
  H: number; prof: number;
  papel: { material: string; seed: number };
  /** Aberturas (centro `u` ao longo da face) e objetos de parede (partes já na face: x = u + dx, y = altura do chão para cima). */
  aberturas: { tipo: 'door' | 'window' | 'arch' | 'secret'; u: number; largura: number; material: string; partes: Parte[] }[];
  objetos: { partes: Parte[] }[];
}

const lerp = (a: Ponto, b: Ponto, t: number): Ponto => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const RODAPE = 'madeira.escura', RODAPE_CLARO = 'madeira.media';

/** A cor chapada de uma parte numa face pequena: o tom do material (vidro claro). */
function corDaParte(p: Parte): string { const t = tonsDe(materialDe(p.mat)); return p.vidro ? t.C : t.B; }

export function pintarFacePixel(ctx: Contexto, f: FaceDoComodo, res: number, origem: Ponto): void {
  const { segmento: s, quad } = f, n = Math.max(3, Math.round(f.prof * res));
  const dev = (p: Ponto): Ponto => [p[0] * res - origem[0] * res, p[1] * res - origem[1] * res];
  const Q = quad.map(dev) as [Ponto, Ponto, Ponto, Ponto];
  const bx = Math.floor(Math.min(...Q.map(q => q[0]))) - 1, by = Math.floor(Math.min(...Q.map(q => q[1]))) - 1;
  const ex = Math.ceil(Math.max(...Q.map(q => q[0]))) + 1, ey = Math.ceil(Math.max(...Q.map(q => q[1]))) + 1, bw = ex - bx, bh = ey - by;
  if (bw <= 0 || bh <= 0) return;
  const vertical = Math.abs(s.n[0]) > Math.abs(s.n[1]);       // profundidade em x (parede vertical) ou em y (horizontal)
  const sinal = vertical ? Math.sign(s.n[0]) : Math.sign(s.n[1]);
  const linha = vertical ? Math.round(dev(s.a)[0]) : Math.round(dev(s.a)[1]);
  const papelTons = tonsDe(materialDe(f.papel.material)), ruido = Math.round(s.a[0] * 13 + s.a[1] * 7);
  // Rascunho com o papel e com o rodapé, em pixels do dispositivo (o pixel do rascunho é o pixel da tela do cômodo).
  const rascunho = (material: string, seed: number): ReturnType<typeof criarTela> => {
    const t = criarTela(bw, bh), c = contextoDe(t, { willReadFrequently: false });
    c.setTransform(res, 0, 0, res, -origem[0] * res - bx, -origem[1] * res - by);
    c.save(); c.beginPath(); c.rect((bx + origem[0] * res) / res, (by + origem[1] * res) / res, bw / res, bh / res); c.clip();
    pintarMaterialPixel(c, material, { x: (bx + origem[0] * res) / res, y: (by + origem[1] * res) / res, w: bw / res, h: bh / res }, seed, { res, dir: vertical ? Math.PI / 2 : 0 });
    c.restore(); return t;
  };
  const papel = rascunho(f.papel.material, f.papel.seed + ruido), madeira = rascunho(RODAPE, 3 + ruido);
  const baseboard = Math.max(1, Math.round((0.9 / f.H) * n)), primeiroRodape = n - baseboard;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  const luzRodape = tonsDe(materialDe(RODAPE_CLARO)).c1;
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, a = lerp(Q[0], Q[3], t), b = lerp(Q[1], Q[2], t);
    const dep0 = linha + (sinal > 0 ? k : -k - 1);                         // a fileira de profundidade k
    const along = vertical ? [a[1], b[1]] : [a[0], b[0]], i0 = Math.round(Math.min(...along)), i1 = Math.round(Math.max(...along));
    if (i1 <= i0) continue;
    const rx = vertical ? dep0 : i0, ry = vertical ? i0 : dep0, rw = vertical ? 1 : i1 - i0, rh = vertical ? i1 - i0 : 1;
    if (k >= primeiroRodape) {
      if (k === primeiroRodape) { ctx.fillStyle = luzRodape; ctx.fillRect(rx, ry, rw, rh); }
      else ctx.drawImage(madeira as CanvasImageSource, rx - bx, ry - by, rw, rh, rx, ry, rw, rh);
    } else if (k === 0 || k === primeiroRodape - 1) { ctx.fillStyle = k === 0 ? papelTons.e2 : papelTons.e1; ctx.fillRect(rx, ry, rw, rh); }
    else ctx.drawImage(papel as CanvasImageSource, rx - bx, ry - by, rw, rh, rx, ry, rw, rh);
  }
  // Aberturas e objetos de parede: formas chapadas mapeadas da face (u, altura) para pixels.
  const ponto = (u: number, y: number): Ponto => dev([s.a[0] + ((s.b[0] - s.a[0]) / Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])) * u + s.n[0] * (y / f.H) * f.prof, s.a[1] + ((s.b[1] - s.a[1]) / Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])) * u + s.n[1] * (y / f.H) * f.prof]);
  const forma = (u0: number, u1: number, y0: number, y1: number, cor: string): void => {
    const p0 = ponto(u0, y0), p1 = ponto(u1, y1), x0 = Math.min(p0[0], p1[0]), x1 = Math.max(p0[0], p1[0]), yy0 = Math.min(p0[1], p1[1]), yy1 = Math.max(p0[1], p1[1]);
    if ((x1 - x0) < 0.4 && (yy1 - yy0) < 0.4) return;
    const rx = Math.round(x0), ry = Math.round(yy0); ctx.fillStyle = cor; ctx.fillRect(rx, ry, Math.max(1, Math.round(x1) - rx), Math.max(1, Math.round(yy1) - ry));
  };
  const partes = (lista: readonly Parte[]) => { for (const p of [...lista].sort((x, y) => x.z - y.z)) { const b = caixaDe(p); forma(b.x, b.x + b.w, b.y, b.y + b.h, corDaParte(p)); } };
  for (const a of f.aberturas) {
    if (a.tipo === 'secret') continue;
    const meia = a.largura / 2 - 0.08, alto = a.tipo === 'arch' ? 1.7 + meia : 2.15;
    forma(a.u - meia, a.u + meia, f.H - alto, f.H, '#0a080b');
    partes(a.partes);
  }
  for (const o of f.objetos) partes(o.partes);
  ctx.restore();
}
