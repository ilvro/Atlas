import type { Ponto } from './mapa.ts';
/**
 * Células de um cômodo guardadas em RLE por linha: `[y, x0, comprimento]`, em ordem e sem emendas.
 * Pintar no grid é o gesto principal; o contorno é derivado e fica em cache fora do documento.
 */
export type Celula = readonly [x: number, y: number];
export type Faixa = readonly [y: number, x0: number, comprimento: number];

const chave = (x: number, y: number) => y * 100_003 + x;

/** Remove repetições e ordena por linha e coluna. */
export function normalizar(celulas: Iterable<Celula>): Celula[] {
  const vistas = new Map<number, Celula>();
  for (const [x, y] of celulas) vistas.set(chave(x, y), [x, y]);
  return [...vistas.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

export function codificar(celulas: Iterable<Celula>): Faixa[] {
  const faixas: [number, number, number][] = [];
  for (const [x, y] of normalizar(celulas)) {
    const ultima = faixas.at(-1);
    if (ultima && ultima[0] === y && ultima[1] + ultima[2] === x) ultima[2]++;
    else faixas.push([y, x, 1]);
  }
  return faixas;
}

export function decodificar(faixas: readonly Faixa[]): Celula[] {
  const saida: Celula[] = [];
  for (const [y, x0, n] of faixas) for (let i = 0; i < n; i++) saida.push([x0 + i, y]);
  return saida;
}

export const area = (faixas: readonly Faixa[]): number => faixas.reduce((s, f) => s + f[2], 0);

export function contem(faixas: readonly Faixa[], x: number, y: number): boolean {
  for (const [fy, x0, n] of faixas) if (fy === y && x >= x0 && x < x0 + n) return true;
  return false;
}

export function limites(faixas: readonly Faixa[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (!faixas.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [y, fx, n] of faixas) { x0 = Math.min(x0, fx); x1 = Math.max(x1, fx + n - 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
}

/** Une e subtrai conjuntos de células, devolvendo faixas. */
export const unir = (a: readonly Faixa[], b: readonly Faixa[]): Faixa[] => codificar([...decodificar(a), ...decodificar(b)]);
export function subtrair(a: readonly Faixa[], b: readonly Faixa[]): Faixa[] {
  const fora = new Set(decodificar(b).map(([x, y]) => chave(x, y)));
  return codificar(decodificar(a).filter(([x, y]) => !fora.has(chave(x, y))));
}

/** As faixas estão ordenadas, sem sobreposição nem emendas? (invariante do documento) */
export function ehCanonica(faixas: readonly Faixa[]): boolean {
  for (let i = 0; i < faixas.length; i++) {
    const [y, x0, n] = faixas[i]!;
    if (!Number.isInteger(y) || !Number.isInteger(x0) || !Number.isInteger(n) || n < 1) return false;
    const anterior = faixas[i - 1];
    if (anterior && (y < anterior[0] || (y === anterior[0] && x0 <= anterior[1] + anterior[2]))) return false;
  }
  return true;
}

/** Células entre duas (linha de Bresenham), para a pincelada não deixar buracos quando o mouse anda rápido. */
export function celulasEntre(a: readonly [number, number], b: readonly [number, number]): [number, number][] {
  const saida: [number, number][] = []; let x = a[0], y = a[1]; const dx = Math.abs(b[0] - x), dy = -Math.abs(b[1] - y), sx = x < b[0] ? 1 : -1, sy = y < b[1] ? 1 : -1; let erro = dx + dy;
  for (;;) { saida.push([x, y]); if (x === b[0] && y === b[1]) break; const e2 = 2 * erro; if (e2 >= dy) { erro += dy; x += sx; } if (e2 <= dx) { erro += dx; y += sy; } }
  return saida;
}

/** Células de uma grade de `res` metros dentro de um círculo de `raio` metros em torno de `centro`. */
export function celulasDoDisco(centro: Ponto, raio: number, res: number, colunas: number, linhas: number): [number, number][] {
  const saida: [number, number][] = [], i0 = Math.floor((centro[0] - raio) / res), i1 = Math.floor((centro[0] + raio) / res), j0 = Math.floor((centro[1] - raio) / res), j1 = Math.floor((centro[1] + raio) / res);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (i < 0 || j < 0 || i >= colunas || j >= linhas) continue;
    if (Math.hypot((i + 0.5) * res - centro[0], (j + 0.5) * res - centro[1]) <= raio) saida.push([i, j]);
  }
  return saida;
}
