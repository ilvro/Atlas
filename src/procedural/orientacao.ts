/**
 * Orientação dominante de uma camada de terreno, em radianos em [−π/2, π/2]: o ângulo do eixo maior da forma (análise de
 * componentes principais das células). `celulas` são as corridas `[linha, x0, n]` da camada. Uma forma quase redonda (ou vazia) dá 0.
 */
export function orientacaoDominante(celulas: ReadonlyArray<readonly [number, number, number]>): number {
  let s = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (const [y, x0, n] of celulas) {
    if (n <= 0) continue;
    const cy = y + 0.5, somaX = n * x0 + (n * (n - 1)) / 2, somaX2 = n * x0 * x0 + x0 * n * (n - 1) + ((n - 1) * n * (2 * n - 1)) / 6;
    s += n; sx += somaX + n / 2; sy += n * cy; sxx += somaX2 + somaX + n / 4; syy += n * cy * cy; sxy += cy * (somaX + n / 2);
  }
  if (s === 0) return 0;
  const mx = sx / s, my = sy / s, cxx = sxx / s - mx * mx, cyy = syy / s - my * my, cxy = sxy / s - mx * my;
  if (Math.hypot(cxx - cyy, 2 * cxy) < 0.15 * (cxx + cyy)) return 0;      // quase isotrópica: não há direção
  return 0.5 * Math.atan2(2 * cxy, cxx - cyy);
}

/**
 * Separa as corridas `[linha, x0, n]` de uma camada em partes conectadas (vizinhança de 4): duas corridas de linhas vizinhas que se
 * sobrepõem em x são da mesma parte. Cada talhão de terra arada ou campo de dunas ganha assim a sua própria direção.
 */
export function componentesDeFaixas<F extends readonly [number, number, number]>(faixas: readonly F[]): F[][] {
  const ordem = faixas.map((_, i) => i).sort((a, b) => faixas[a]![0] - faixas[b]![0] || faixas[a]![1] - faixas[b]![1]);
  const pai = faixas.map((_, i) => i), raiz = (i: number): number => { while (pai[i] !== i) { pai[i] = pai[pai[i]!]!; i = pai[i]!; } return i; };
  const porLinha = new Map<number, number[]>();
  for (const i of ordem) { const y = faixas[i]![0]; const l = porLinha.get(y); if (l) l.push(i); else porLinha.set(y, [i]); }
  for (const i of ordem) {
    const [y, x0, n] = faixas[i]!;
    for (const j of porLinha.get(y - 1) ?? []) { const [, a0, m] = faixas[j]!; if (a0 < x0 + n && x0 < a0 + m) pai[raiz(i)] = raiz(j); }
  }
  const grupos = new Map<number, F[]>();
  for (const i of ordem) { const r = raiz(i); const g = grupos.get(r); if (g) g.push(faixas[i]!); else grupos.set(r, [faixas[i]!]); }
  return [...grupos.values()];
}
