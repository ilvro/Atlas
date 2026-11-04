import { CORES_PADRAO, TONS_DE_PELE, type CampoDeCor } from '../domain/sprite.ts';
import { mulberry32 } from './ruido.ts';

/** Uma imagem em pixels RGBA (o `ImageData` do navegador serve, e um objeto simples nos testes). */
export interface Pixels { width: number; height: number; data: ArrayLike<number> }

type Rgb = [number, number, number];
const aHex = (c: Rgb): string => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
const deHex = (h: string): Rgb => { const p = parseInt(h.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const dist2 = (a: Rgb, b: Rgb): number => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
const luminancia = (c: Rgb): number => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const saturacao = (c: Rgb): number => { const mx = Math.max(...c), mn = Math.min(...c); return mx === 0 ? 0 : (mx - mn) / mx; };

/**
 * As `k` cores dominantes de uma imagem (k-médias, com semente fixa): só pixels opacos e que não são quase pretos nem quase brancos.
 * Devolve hex, da mais comum para a menos; menos de `k` se a imagem tem menos cores.
 */
export function coresDominantes(img: Pixels, k = 5): string[] {
  const pontos: Rgb[] = [], passo = Math.max(1, Math.floor((img.width * img.height) / 6000));
  for (let i = 0; i < img.width * img.height; i += passo) {
    const o = i * 4; if (img.data[o + 3]! < 200) continue;
    const c: Rgb = [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!], l = luminancia(c);
    if (l > 0.06 && l < 0.94) pontos.push(c);
  }
  if (!pontos.length) return [];
  // Centros iniciais: o primeiro ponto sorteado e depois o mais distante dos já escolhidos (para quando todos os pontos já estão cobertos).
  const r = mulberry32(7), centros: Rgb[] = [pontos[Math.floor(r() * pontos.length)]!];
  while (centros.length < k) {
    let melhor: Rgb | null = null, md = 0;
    for (const p of pontos) { const d = Math.min(...centros.map(c => dist2(c, p))); if (d > md) { md = d; melhor = p; } }
    if (!melhor) break; centros.push(melhor);
  }
  let tamanhos: number[] = [];
  for (let volta = 0; volta < 12; volta++) {
    const soma = centros.map(() => [0, 0, 0]), n = centros.map(() => 0);
    for (const p of pontos) {
      let m = 0, md = Infinity; centros.forEach((c, i) => { const d = dist2(c, p); if (d < md) { md = d; m = i; } });
      soma[m]![0]! += p[0]; soma[m]![1]! += p[1]; soma[m]![2]! += p[2]; n[m]!++;
    }
    centros.forEach((c, i) => { if (n[i]) { c[0] = soma[i]![0]! / n[i]!; c[1] = soma[i]![1]! / n[i]!; c[2] = soma[i]![2]! / n[i]!; } });
    tamanhos = n;
  }
  return centros.map((c, i) => ({ c, n: tamanhos[i]! })).filter(x => x.n > 0).sort((a, b) => b.n - a.n).map(x => aHex(x.c));
}

/**
 * As cores do sprite a partir das dominantes do retrato: a pele é a mais próxima de um tom de pele; o cabelo, a mais escura das que sobram (com alguma
 * saturação, se houver); a roupa e o detalhe, as duas mais saturadas das restantes. O que faltar fica na cor padrão.
 */
export function sugerirCoresDoSprite(cores: readonly string[]): Record<CampoDeCor, string> {
  const resto = cores.map(deHex), saida: Record<CampoDeCor, string> = { ...CORES_PADRAO };
  const tirar = (c: Rgb) => { resto.splice(resto.indexOf(c), 1); return aHex(c); };
  const peles = TONS_DE_PELE.map(deHex), distanciaDePele = (c: Rgb) => Math.min(...peles.map(p => dist2(c, p)));
  if (resto.length) saida.pele = tirar(resto.reduce((a, b) => (distanciaDePele(b) < distanciaDePele(a) ? b : a)));
  if (resto.length) { const coloridas = resto.filter(c => saturacao(c) > 0.12), base = coloridas.length ? coloridas : resto; saida.cabelo = tirar(base.reduce((a, b) => (luminancia(b) < luminancia(a) ? b : a))); }
  const vivas = [...resto].sort((a, b) => saturacao(b) - saturacao(a));
  if (vivas[0]) saida.roupa = tirar(vivas[0]);
  if (vivas[1]) saida.detalhe = tirar(vivas[1]);
  return saida;
}
