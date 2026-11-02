import { pintarIlustrado, pintarPixel, material, tom } from './materiais.js';

function caixa(p) {
  if (p.forma === 'poli') {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < p.pts.length; i += 2) { x0 = Math.min(x0, p.pts[i]); x1 = Math.max(x1, p.pts[i]); y0 = Math.min(y0, p.pts[i + 1]); y1 = Math.max(y1, p.pts[i + 1]); }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
}

function caminho(ctx, p) {
  ctx.beginPath();
  if (p.forma === 'elipse') ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
  else if (p.forma === 'poli') { ctx.moveTo(p.pts[0], p.pts[1]); for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i + 1]); ctx.closePath(); }
  else if (p.raio) ctx.roundRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h, p.raio);
  else ctx.rect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
}

const ordenar = partes => [...partes].sort((a, b) => a.z - b.z);

/** Renderizador Ilustrado: cada parte com sombra suave pela altura, material pintado, sombreado e traço de nanquim. */
function partesIlustrado(ctx, partes, { res, seed = 1, sombras = true }) {
  partes.forEach((p, i) => {
    const b = caixa(p), s = seed * 31 + i;
    if (sombras && !p.semSombra && p.z > 0.03) {
      const leve = p.sombraLeve ? 0.35 : 1;
      ctx.save(); ctx.shadowColor = `rgba(0,0,0,${0.55 * leve})`;
      ctx.shadowBlur = (0.04 + p.z * 0.08) * res; ctx.shadowOffsetX = ctx.shadowOffsetY = (0.015 + p.z * 0.045) * res * leve;
      ctx.fillStyle = '#000'; caminho(ctx, p); ctx.fill(); ctx.restore();
    }
    ctx.save(); caminho(ctx, p); ctx.clip();
    pintarIlustrado(ctx, p.mat, b, s, { dir: p.dir ?? 0 });
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, 'rgba(255,236,210,0.16)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
    if (p.vidro) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = Math.min(b.w, b.h) * 0.08; ctx.beginPath(); ctx.moveTo(b.x + b.w * 0.2, b.y + b.h); ctx.lineTo(b.x + b.w * 0.6, b.y); ctx.stroke(); }
    caminho(ctx, p); ctx.lineWidth = Math.min(0.06, Math.min(b.w, b.h) * 0.18); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
    ctx.restore();
    if (p.contorno !== false) {
      const leve = p.contorno === 'leve';
      caminho(ctx, p); ctx.strokeStyle = `rgba(14,10,12,${leve ? 0.45 : 0.9})`; ctx.lineWidth = leve ? 0.01 : 0.02; ctx.stroke();
      if (!leve) { ctx.save(); ctx.translate(0.004, -0.003); caminho(ctx, p); ctx.strokeStyle = 'rgba(14,10,12,0.3)'; ctx.lineWidth = 0.01; ctx.stroke(); ctx.restore(); }
    }
  });
}

let temp = null;
function tela(w, h) {
  if (!temp) temp = document.createElement('canvas');
  if (temp.width !== w || temp.height !== h) { temp.width = w; temp.height = h; }
  const c = temp.getContext('2d', { willReadFrequently: true }); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
  return c;
}

const rgb = hex => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };

/** Alfa binário: nada de meio pixel. */
export function limiar(img) { const d = img.data; for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 110 ? 255 : 0; }

/** Sombreado por borda: luz de cima/esquerda, sombra embaixo/direita (1 pixel). */
function sombrearBordas(img, claro, escuro) {
  const { width: w, height: h, data: d } = img, a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
  const marcas = new Int8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!a(x, y)) continue;
    if (!a(x, y + 1) || !a(x + 1, y)) marcas[y * w + x] = -1; else if (!a(x, y - 1) || !a(x - 1, y)) marcas[y * w + x] = 1;
  }
  const [cr, cg, cb] = rgb(claro), [er, eg, eb] = rgb(escuro);
  for (let i = 0; i < marcas.length; i++) if (marcas[i]) {
    const j = i * 4, [r, g, b] = marcas[i] > 0 ? [cr, cg, cb] : [er, eg, eb], k = marcas[i] > 0 ? 0.55 : 0.7;
    d[j] = d[j] * (1 - k) + r * k; d[j + 1] = d[j + 1] * (1 - k) + g * k; d[j + 2] = d[j + 2] * (1 - k) + b * k;
  }
}

/** Contorno de 1 pixel ao redor do que é opaco. */
export function contornar(img, cor = '#0b0a10') {
  const { width: w, height: h, data: d } = img, [r, g, b] = rgb(cor), a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : d[(y * w + x) * 4 + 3];
  const novos = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!a(x, y) && (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1))) novos.push((y * w + x) * 4);
  for (const j of novos) { d[j] = r; d[j + 1] = g; d[j + 2] = b; d[j + 3] = 255; }
}

/** Renderizador Pixel: cada parte vira uma área de pixels inteiros, com cor do material e sombreado em degraus. */
function partesPixel(ctx, partes, { res, seed = 1 }) {
  const { width: W, height: H } = ctx.canvas, m = ctx.getTransform(), px = 1 / res;
  partes.forEach((p, i) => {
    const b = caixa(p);
    // Detalhes menores que um pixel somem; os de nível 3 precisam de pelo menos dois.
    const lado = Math.max(b.w, b.h) * res;
    if (lado < 0.9 || (p.detalhe >= 3 && lado < 2)) return;
    const t = tela(W, H); t.setTransform(m);
    t.save(); caminho(t, p); t.clip(); pintarPixel(t, p.mat, b, seed * 31 + i, { dir: p.dir ?? 0, px }); t.restore();
    const img = t.getImageData(0, 0, W, H); limiar(img);
    const mat = material(p.mat); sombrearBordas(img, mat.claro, tom(mat.base, -0.5));
    t.putImageData(img, 0, 0);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(t.canvas, 0, 0); ctx.restore();
  });
}

/**
 * Desenha as partes de uma descrição no contexto (já transformado para metros). O mesmo conjunto de partes
 * serve aos dois renderizadores; `estilo` escolhe a interpretação.
 */
export function desenharPartes(ctx, partes, { estilo, res, seed, sombras = true }) {
  const lista = ordenar(partes);
  if (estilo === 'pixel') partesPixel(ctx, lista, { res, seed }); else partesIlustrado(ctx, lista, { res, seed, sombras });
}

/**
 * Objeto completo no Pixel: desenhado numa camada própria para receber contorno e sombra de 1 pixel
 * sem misturar com o que já está embaixo.
 */
export function desenharObjetoPixel(ctx, partes, { res, seed }) {
  const { width: W, height: H } = ctx.canvas, camada = document.createElement('canvas');
  camada.width = W; camada.height = H;
  const c = camada.getContext('2d', { willReadFrequently: true }); c.setTransform(ctx.getTransform());
  partesPixel(c, ordenar(partes), { res, seed });
  c.setTransform(1, 0, 0, 1, 0, 0);
  const img = c.getImageData(0, 0, W, H); contornar(img); c.putImageData(img, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.45; ctx.filter = 'brightness(0)'; ctx.drawImage(camada, 1, 1); ctx.filter = 'none'; ctx.globalAlpha = 1;
  ctx.drawImage(camada, 0, 0); ctx.restore();
}
