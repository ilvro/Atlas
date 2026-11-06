import { contem, codificar, type Celula, type Faixa } from './celulas.ts';
import type { MapaAtlas, Ponto } from './mapa.ts';
import { materialDe } from '../procedural/materiais.ts';

/** O material da camada de água que cobre o ponto (em metros), ou `null` se ali não há água. */
export function aguaEm(m: Pick<MapaAtlas, 'terrain'>, p: Ponto): string | null {
  const r = m.terrain.resolution, x = Math.floor(p[0] / r), y = Math.floor(p[1] / r);
  for (const c of Object.values(m.terrain.layers)) if (materialDe(c.material).uso === 'agua' && contem(c.cells, x, y)) return c.material;
  return null;
}

/**
 * Arredonda as células de `faixas` perto de `onde` (a caixa do que acabou de ser pintado): média numa janela de raio `raio` células,
 * mantida onde passa de 50%. Tira quinas e pontas da borda sem mexer no resto da camada.
 */
export function suavizarMargem(faixas: readonly Faixa[], onde: { x0: number; y0: number; x1: number; y1: number }, raio = 3): Faixa[] {
  const x0 = onde.x0 - raio - 1, y0 = onde.y0 - raio - 1, x1 = onde.x1 + raio + 1, y1 = onde.y1 + raio + 1, W = x1 - x0 + 1, H = y1 - y0 + 1;
  const dentro = new Uint8Array(W * H);
  for (const [y, xa, n] of faixas) { if (y < y0 || y > y1) continue; for (let x = Math.max(xa, x0); x < Math.min(xa + n, x1 + 1); x++) dentro[(y - y0) * W + (x - x0)] = 1; }
  // Soma por janela (tabela de somas acumuladas).
  const S = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) S[(y + 1) * (W + 1) + x + 1] = dentro[y * W + x]! + S[y * (W + 1) + x + 1]! + S[(y + 1) * (W + 1) + x]! - S[y * (W + 1) + x]!;
  const fora: Celula[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // Só dentro da caixa pedida (mais a folga): o contorno da tela de trabalho não é tocado.
    if (x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
    const ax = Math.max(0, x - raio), ay = Math.max(0, y - raio), bx = Math.min(W, x + raio + 1), by = Math.min(H, y + raio + 1);
    const soma = S[by * (W + 1) + bx]! - S[ay * (W + 1) + bx]! - S[by * (W + 1) + ax]! + S[ay * (W + 1) + ax]!, total = (bx - ax) * (by - ay);
    if (soma * 2 > total) fora.push([x + x0, y + y0]);
  }
  const resto: Celula[] = [];
  for (const [y, xa, n] of faixas) for (let x = xa; x < xa + n; x++) if (x < x0 || x > x1 || y < y0 || y > y1) resto.push([x, y]);
  return codificar([...resto, ...fora.filter(([x, y]) => x >= 0 && y >= 0)]);
}
