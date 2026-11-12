import { contem, codificar, type Celula, type Faixa } from './celulas.ts';
import type { MapaAtlas, Ponto } from './mapa.ts';
import { materialDe } from '../procedural/materiais.ts';
import { pontoNoPoligono } from './regioes.ts';
import type { CelulaDoComando } from '../state/comandos-construir.ts';

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

/**
 * Divide as células do polígono (em metros) em anéis concêntricos do centro para a borda,
 * em `totalEtapas` fatias (padrão 6). A união de todas as fatias cobre todas as células do polígono.
 * Células fora do mapa (negativas ou além de `limites`) são recortadas.
 */
export function etapasDaAgua(
  poligono: readonly Ponto[],
  res: number,
  totalEtapas = 6,
  limites?: { width: number; height: number } | { largura: number; altura: number } | readonly [number, number],
): CelulaDoComando[][] {
  if (poligono.length < 3 || totalEtapas <= 0) return [];

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let somaX = 0, somaY = 0;
  for (const [x, y] of poligono) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    somaX += x; somaY += y;
  }
  const centroX = somaX / poligono.length, centroY = somaY / poligono.length;

  let maxW: number | undefined;
  let maxH: number | undefined;
  if (limites) {
    if ('width' in limites) {
      maxW = limites.width;
      maxH = limites.height;
    } else if ('largura' in limites) {
      maxW = limites.largura;
      maxH = limites.altura;
    } else {
      maxW = limites[0];
      maxH = limites[1];
    }
  }
  const maxCols = maxW !== undefined ? Math.ceil(maxW / res) : undefined;
  const maxRows = maxH !== undefined ? Math.ceil(maxH / res) : undefined;

  const cx0 = Math.max(0, Math.floor(minX / res));
  const cx1 = maxCols !== undefined ? Math.min(maxCols - 1, Math.ceil(maxX / res)) : Math.ceil(maxX / res);
  const cy0 = Math.max(0, Math.floor(minY / res));
  const cy1 = maxRows !== undefined ? Math.min(maxRows - 1, Math.ceil(maxY / res)) : Math.ceil(maxY / res);

  const celulas: { c: CelulaDoComando; d: number }[] = [];
  if (cx0 <= cx1 && cy0 <= cy1) {
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const x = (cx + 0.5) * res, y = (cy + 0.5) * res;
        if (pontoNoPoligono([x, y], poligono)) {
          const d = Math.hypot(x - centroX, y - centroY);
          celulas.push({ c: [cx, cy], d });
        }
      }
    }
  }

  if (celulas.length === 0) {
    const cx = Math.floor(centroX / res), cy = Math.floor(centroY / res);
    if (cx >= 0 && cy >= 0 && (maxCols === undefined || cx < maxCols) && (maxRows === undefined || cy < maxRows)) {
      celulas.push({ c: [cx, cy], d: 0 });
    }
  }

  celulas.sort((a, b) => a.d - b.d);

  const etapas: CelulaDoComando[][] = Array.from({ length: totalEtapas }, () => []);
  const total = celulas.length;
  if (total === 0) return etapas;

  for (let i = 0; i < total; i++) {
    const etapaIdx = Math.min(totalEtapas - 1, Math.floor((i / total) * totalEtapas));
    etapas[etapaIdx]!.push(celulas[i]!.c);
  }
  return etapas;
}
