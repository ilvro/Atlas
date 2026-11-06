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
