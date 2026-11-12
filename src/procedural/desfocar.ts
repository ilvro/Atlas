/**
 * Desfoque do canal alfa sem `ctx.filter` (que o WebKitGTK não tem): três passadas de caixa separáveis
 * (horizontal e vertical) aproximam a gaussiana de desvio `sigma`, em pixels. Puro: só vetores.
 * `dados` é RGBA (4 bytes por pixel); só o alfa é lido e escrito, o resto fica como está. Mexe no próprio `dados`.
 */
export function desfocarAlfa(dados: Uint8ClampedArray, largura: number, altura: number, sigma: number): Uint8ClampedArray {
  if (sigma <= 0 || largura < 1 || altura < 1) return dados;
  // Largura ideal das caixas para n=3 passadas (Kovesi): w = sqrt(12σ²/n + 1)
  const ideal = Math.sqrt((12 * sigma * sigma) / 3 + 1);
  let wl = Math.floor(ideal); if (wl % 2 === 0) wl--;
  const wu = wl + 2, m = Math.round((12 * sigma * sigma - 3 * wl * wl - 12 * wl - 9) / (-4 * wl - 4));
  const raios = [0, 1, 2].map((i) => ((i < m ? wl : wu) - 1) / 2);
  const n = largura * altura, a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = dados[i * 4 + 3]!;
  for (const r of raios) {
    if (r < 1) continue;
    caixa(a, b, largura, altura, r, 1, largura);       // horizontal: a -> b
    caixa(b, a, altura, largura, r, largura, 1);       // vertical: b -> a
  }
  for (let i = 0; i < n; i++) dados[i * 4 + 3] = Math.round(a[i]!);
  return dados;
}

/** Média móvel de raio `r`: `linhas` linhas de `compr` amostras; a amostra i da linha l está em `l * passoLinha + i * passoAmostra`. Nas pontas repete o último pixel. */
function caixa(src: Float32Array, dst: Float32Array, compr: number, linhas: number, r: number, passoAmostra: number, passoLinha: number): void {
  const inv = 1 / (2 * r + 1);
  for (let l = 0; l < linhas; l++) {
    const o = l * passoLinha;
    const at = (i: number) => src[o + Math.min(compr - 1, Math.max(0, i)) * passoAmostra]!;
    let soma = 0;
    for (let i = -r; i <= r; i++) soma += at(i);
    for (let i = 0; i < compr; i++) {
      dst[o + i * passoAmostra] = soma * inv;
      soma += at(i + r + 1) - at(i - r);
    }
  }
}
