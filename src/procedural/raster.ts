import type { Contexto } from './canvas.ts';
import { caixaDasPartes, type Parte } from './descricao.ts';
import { pintarMaterial, tom, materialDe } from './materiais.ts';

export function caixaDe(p: Parte): { x: number; y: number; w: number; h: number } {
  if (p.forma === 'poli') { const pts = p.pts ?? [], xs = pts.filter((_, i) => i % 2 === 0), ys = pts.filter((_, i) => i % 2 === 1); const x0 = Math.min(...xs), y0 = Math.min(...ys); return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 }; }
  return { x: p.x! - p.w! / 2, y: p.y! - p.h! / 2, w: p.w!, h: p.h! };
}

export function caminho(ctx: Contexto, p: Parte): void {
  ctx.beginPath();
  if (p.forma === 'elipse') ctx.ellipse(p.x!, p.y!, p.w! / 2, p.h! / 2, 0, 0, Math.PI * 2);
  else if (p.forma === 'poli') { const pts = p.pts!; ctx.moveTo(pts[0]!, pts[1]!); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!); ctx.closePath(); }
  else if (p.raio) ctx.roundRect(p.x! - p.w! / 2, p.y! - p.h! / 2, p.w!, p.h!, p.raio);
  else ctx.rect(p.x! - p.w! / 2, p.y! - p.h! / 2, p.w!, p.h!);
}

/**
 * Renderizador Ilustrado: cada parte com sombra suave pela altura, material pintado, sombreado e traço de nanquim.
 * O contexto já está em metros; `res` (px por metro) só serve às sombras, que o canvas mede em pixels.
 */
export function desenharPartes(ctx: Contexto, partes: readonly Parte[], { res, seed = 1, sombras = true }: { res: number; seed?: number; sombras?: boolean }): void {
  [...partes].sort((a, b) => a.z - b.z).forEach((p, i) => {
    const b = caixaDe(p), s = seed * 31 + i;
    const alfa = p.alfa ?? 1;
    if (sombras && !p.semSombra && p.z > 0.03) {
      const leve = p.sombraLeve ? 0.35 : 1;
      ctx.save(); ctx.globalAlpha = alfa; ctx.shadowColor = `rgba(0,0,0,${0.55 * leve})`; ctx.shadowBlur = (0.04 + p.z * 0.08) * res; ctx.shadowOffsetX = ctx.shadowOffsetY = (0.015 + p.z * 0.045) * res * leve;
      ctx.fillStyle = '#000'; caminho(ctx, p); ctx.fill(); ctx.restore();
    }
    ctx.save(); caminho(ctx, p); ctx.clip(); ctx.globalAlpha = alfa;
    pintarMaterial(ctx, p.mat, b, s, { dir: p.dir ?? 0 });
    if (p.suave) { ctx.restore(); return; }
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

/** Leva partes de uma face (u ao longo da parede, z do chão para cima) para o espaço da face (u, w = H − z). */
export function partesParaFace(partes: readonly Parte[], u: number, alturaDaParede: number): Parte[] {
  return partes.map(p => p.forma === 'poli' ? { ...p, pts: p.pts!.map((v, i) => (i % 2 ? alturaDaParede - v : u + v)) } : { ...p, x: u + p.x!, y: alturaDaParede - p.y! });
}

export { caixaDasPartes, tom, materialDe };
