import type { MapaAtlas } from '../domain/mapa.ts';
import { camadaDoObjeto } from '../domain/camadas.ts';
import { corDoNome, hexParaNumero } from './cores.ts';

const css = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

/** Prévia do mapa para a galeria, em Canvas 2D: fundo, cômodos, paredes, luzes e peças. Os mesmos dados que o viewport usa. */
export function desenharMiniatura(canvas: HTMLCanvasElement | OffscreenCanvas, m: MapaAtlas, acento = '#e91d25'): void {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const w = canvas.width, h = canvas.height, margem = 10, esc = Math.min((w - 2 * margem) / m.bounds.width, (h - 2 * margem) / m.bounds.height);
  const ox = (w - m.bounds.width * esc) / 2, oy = (h - m.bounds.height * esc) / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = m.backdrop.color; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(ox, oy, m.bounds.width * esc, m.bounds.height * esc);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = 1; ctx.strokeRect(ox + 0.5, oy + 0.5, m.bounds.width * esc, m.bounds.height * esc);
  const t = m.grid.size * esc;
  for (const sala of Object.values(m.rooms)) { ctx.fillStyle = css(corDoNome(sala.floor.material, 0.32, 0.3)); for (const [y, x0, n] of sala.cells) ctx.fillRect(ox + x0 * t, oy + y * t, n * t + 0.5, t + 0.5); }
  ctx.strokeStyle = '#16141a'; ctx.lineCap = 'round';
  for (const p of Object.values(m.walls)) { ctx.lineWidth = Math.max(1.5, p.thickness * esc); ctx.beginPath(); p.path.forEach(([x, y], i) => i ? ctx.lineTo(ox + x * esc, oy + y * esc) : ctx.moveTo(ox + x * esc, oy + y * esc)); ctx.stroke(); }
  for (const l of Object.values(m.lights)) { const g = ctx.createRadialGradient(ox + l.position[0] * esc, oy + l.position[1] * esc, 0, ox + l.position[0] * esc, oy + l.position[1] * esc, Math.max(6, Math.min(l.radius, 4) * esc)); g.addColorStop(0, `${l.color}aa`); g.addColorStop(1, `${l.color}00`); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }
  for (const o of Object.values(m.props).sort((a, b) => camadaDoObjeto(a) - camadaDoObjeto(b))) { ctx.fillStyle = css(corDoNome(o.source.kind === 'recipe' ? o.source.recipe : o.source.assetId, 0.35, 0.38)); ctx.fillRect(ox + o.position[0] * esc - 2, oy + o.position[1] * esc - 2, 4, 4); }
  for (const p of Object.values(m.tokens)) { ctx.fillStyle = css(hexParaNumero(acento)); ctx.beginPath(); ctx.arc(ox + p.position[0] * esc, oy + p.position[1] * esc, 3.5, 0, 7); ctx.fill(); }
}
