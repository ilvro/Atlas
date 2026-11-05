/** Profundidade máxima (m) guardada pela transformada de distância; mais fundo que isso é "fundo". */
export const PROFUNDIDADE_MAXIMA = 3;

/**
 * Distância à margem, em metros, de cada pixel de uma máscara binária (`1` = dentro, `0` = fora), por transformada de distância
 * de duas passadas com pesos 3-4 (chamfer), saturada em `maximo`. Pixels de fora valem 0; um pixel de dentro colado num de fora
 * vale `1 / res`. Fora da imagem conta como dentro (a camada que encosta na borda do mapa não ganha margem ali).
 */
export function distanciaAMargem(mascara: ArrayLike<number>, largura: number, altura: number, res: number, maximo = PROFUNDIDADE_MAXIMA): Float32Array {
  const n = largura * altura, INF = 1 << 28, d = new Int32Array(n);
  for (let i = 0; i < n; i++) d[i] = mascara[i] ? INF : 0;
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) {
    const i = y * largura + x; if (!d[i]) continue;
    let v = d[i]!;
    if (x > 0) v = Math.min(v, d[i - 1]! + 3);
    if (y > 0) { v = Math.min(v, d[i - largura]! + 3); if (x > 0) v = Math.min(v, d[i - largura - 1]! + 4); if (x < largura - 1) v = Math.min(v, d[i - largura + 1]! + 4); }
    d[i] = v;
  }
  for (let y = altura - 1; y >= 0; y--) for (let x = largura - 1; x >= 0; x--) {
    const i = y * largura + x; if (!d[i]) continue;
    let v = d[i]!;
    if (x < largura - 1) v = Math.min(v, d[i + 1]! + 3);
    if (y < altura - 1) { v = Math.min(v, d[i + largura]! + 3); if (x < largura - 1) v = Math.min(v, d[i + largura + 1]! + 4); if (x > 0) v = Math.min(v, d[i + largura - 1]! + 4); }
    d[i] = v;
  }
  const saida = new Float32Array(n), teto = maximo * res * 3;
  for (let i = 0; i < n; i++) saida[i] = Math.min(d[i]!, teto) / 3 / res;
  return saida;
}
