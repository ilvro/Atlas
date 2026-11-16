import type { Graphics } from 'pixi.js';
import { areaDoPoligono, pontoNoPoligono } from '../domain/formas-de-comodo.ts';
import type { MapaAtlas, Ponto } from '../domain/mapa.ts';

/** Preenche o `Graphics` com as células de todos os cômodos (em metros): serve de máscara, normal ou invertida. */
export function desenharComodos(g: Graphics, m: Pick<MapaAtlas, 'rooms' | 'grid'>): void {
  const t = m.grid.size, [ox, oy] = m.grid.offset;
  g.clear();
  for (const sala of Object.values(m.rooms)) {
    if (sala.outline && sala.outline.length >= 3) {
      g.moveTo(sala.outline[0]![0], sala.outline[0]![1]);
      for (let i = 1; i < sala.outline.length; i++) g.lineTo(sala.outline[i]![0], sala.outline[i]![1]);
      g.closePath();
    } else {
      for (const [y, x0, n] of sala.cells) g.rect(ox + x0 * t, oy + y * t, n * t, t);
    }
  }
  g.fill(0xffffff);
}

function segmentoCruzaCaixaAberta(
  ax: number, ay: number, bx: number, by: number,
  x0: number, y0: number, x1: number, y1: number,
): boolean {
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  const clip = (p: number, q: number): boolean => {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  if (!clip(-dx, ax - x0) || !clip(dx, x1 - ax) || !clip(-dy, ay - y0) || !clip(dy, y1 - ay)) return false;
  if (t0 >= t1 - 1e-9) return false;
  const tm = (t0 + t1) * 0.5;
  const mx = ax + tm * dx, my = ay + tm * dy;
  return mx > x0 + 1e-9 && mx < x1 - 1e-9 && my > y0 + 1e-9 && my < y1 - 1e-9;
}

function caixaDentroDoPoligono(
  x0: number, y0: number, x1: number, y1: number,
  outline: readonly Ponto[],
): boolean {
  const eps = Math.min(1e-6, (x1 - x0) * 0.05, (y1 - y0) * 0.05);
  if (
    !pontoNoPoligono([(x0 + x1) * 0.5, (y0 + y1) * 0.5], outline) ||
    !pontoNoPoligono([x0 + eps, y0 + eps], outline) ||
    !pontoNoPoligono([x1 - eps, y0 + eps], outline) ||
    !pontoNoPoligono([x0 + eps, y1 - eps], outline) ||
    !pontoNoPoligono([x1 - eps, y1 - eps], outline)
  ) return false;
  const n = outline.length;
  for (let i = 0; i < n; i++) {
    const a = outline[i]!, b = outline[(i + 1) % n]!;
    if (segmentoCruzaCaixaAberta(a[0], a[1], b[0], b[1], x0, y0, x1, y1)) return false;
  }
  return true;
}

function faixasDoContorno(outline: readonly Ponto[], passoBase: number): { x: number; y: number; w: number; h: number }[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of outline) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const amostrar = (passo: number): { x: number; y: number; w: number; h: number }[] => {
    const out: { x: number; y: number; w: number; h: number }[] = [];
    for (let y0 = minY; y0 < maxY - 1e-9; y0 += passo) {
      const y1 = Math.min(maxY, y0 + passo);
      const h = y1 - y0;
      if (h <= 1e-6) continue;
      let ini = -1, fim = 0;
      for (let x0 = minX; x0 < maxX - 1e-9; x0 += passo) {
        const x1 = Math.min(maxX, x0 + passo);
        if (x1 - x0 <= 1e-6) continue;
        if (caixaDentroDoPoligono(x0, y0, x1, y1, outline)) {
          if (ini < 0) ini = x0;
          fim = x1;
        } else if (ini >= 0) {
          out.push({ x: ini, y: y0, w: fim - ini, h });
          ini = -1;
        }
      }
      if (ini >= 0) out.push({ x: ini, y: y0, w: fim - ini, h });
    }
    return out;
  };
  let passo = Math.max(0.05, passoBase);
  let faixas = amostrar(passo);
  while (faixas.length === 0 && passo > 0.05) {
    passo = Math.max(0.05, passo * 0.5);
    faixas = amostrar(passo);
  }
  return faixas;
}

/** As faixas de todos os cômodos em metros, com o total de área, para sortear pontos dentro deles (poeira). */
export interface FaixasDeComodos { faixas: { x: number; y: number; w: number; h: number }[]; area: number }
export function faixasDosComodos(m: Pick<MapaAtlas, 'rooms' | 'grid'>): FaixasDeComodos {
  const t = m.grid.size, [ox, oy] = m.grid.offset, faixas: FaixasDeComodos['faixas'] = [];
  const passo = Math.min(0.5, t / 2);
  let area = 0;
  for (const sala of Object.values(m.rooms)) {
    if (sala.outline && sala.outline.length >= 3) {
      faixas.push(...faixasDoContorno(sala.outline, passo));
      area += areaDoPoligono(sala.outline);
    } else {
      for (const [y, x0, n] of sala.cells) {
        faixas.push({ x: ox + x0 * t, y: oy + y * t, w: n * t, h: t });
        area += n * t * t;
      }
    }
  }
  return { faixas, area };
}
