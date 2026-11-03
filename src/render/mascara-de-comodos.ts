import type { Graphics } from 'pixi.js';
import type { MapaAtlas } from '../domain/mapa.ts';

/** Preenche o `Graphics` com as células de todos os cômodos (em metros): serve de máscara, normal ou invertida. */
export function desenharComodos(g: Graphics, m: Pick<MapaAtlas, 'rooms' | 'grid'>): void {
  const t = m.grid.size, [ox, oy] = m.grid.offset;
  g.clear();
  for (const sala of Object.values(m.rooms)) for (const [y, x0, n] of sala.cells) g.rect(ox + x0 * t, oy + y * t, n * t, t);
  g.fill(0xffffff);
}

/** As faixas de todos os cômodos em metros, com o total de área, para sortear pontos dentro deles (poeira). */
export interface FaixasDeComodos { faixas: { x: number; y: number; w: number; h: number }[]; area: number }
export function faixasDosComodos(m: Pick<MapaAtlas, 'rooms' | 'grid'>): FaixasDeComodos {
  const t = m.grid.size, [ox, oy] = m.grid.offset, faixas: FaixasDeComodos['faixas'] = [];
  let area = 0;
  for (const sala of Object.values(m.rooms)) for (const [y, x0, n] of sala.cells) { faixas.push({ x: ox + x0 * t, y: oy + y * t, w: n * t, h: t }); area += n * t * t; }
  return { faixas, area };
}
