// Textura de terreno em metros: leitura bilinear, sem repetição visível, e mapa de gradiente para a paleta.
// Funções puras e determinísticas (nada de Math.random); quem chama passa o array de saída, sem alocação por pixel.

/** Imagem RGBA de 8 bits, `dados.length === largura * altura * 4`. */
export interface Pixels { dados: Uint8ClampedArray; largura: number; altura: number }

export interface MascaraDeCamada { freq: number; limiar: number; suave: number; semente: number }
export interface CamadaDeTextura { textura: string; escala?: number; mascara?: MascaraDeCamada }
export interface ReceitaDeTextura { camadas: CamadaDeTextura[]; tingir: number }

/** Campo de ruído: `(x, y) => 0..1` (ex.: `valueNoise2D(seed)`). */
export type Ruido = (x: number, y: number) => number;

type Cor3 = readonly [number, number, number];

const passo = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const mod = (n: number, m: number): number => ((n % m) + m) % m;

/** Leitura bilinear com volta nas bordas; `u` e `v` em pixels (centro do pixel i em i + 0,5). Escreve `o = [r, g, b, a]`. */
export function amostrar(t: Pixels, u: number, v: number, o: number[]): void {
  const { dados, largura: W, altura: H } = t;
  const fu = u - 0.5, fv = v - 0.5;
  const iu = Math.floor(fu), iv = Math.floor(fv), tu = fu - iu, tv = fv - iv;
  const x0 = mod(iu, W), x1 = (x0 + 1) % W, y0 = mod(iv, H), y1 = (y0 + 1) % H;
  const a = (y0 * W + x0) * 4, b = (y0 * W + x1) * 4, c = (y1 * W + x0) * 4, d = (y1 * W + x1) * 4;
  const w00 = (1 - tu) * (1 - tv), w10 = tu * (1 - tv), w01 = (1 - tu) * tv, w11 = tu * tv;
  for (let k = 0; k < 4; k++) o[k] = dados[a + k]! * w00 + dados[b + k]! * w10 + dados[c + k]! * w01 + dados[d + k]! * w11;
}

const ANGULO = (37 * Math.PI) / 180, COS = Math.cos(ANGULO), SEN = Math.sin(ANGULO);
/** Deslocamento fixo (em pixels) da segunda leitura, no lugar de um valor de semente. */
const DESLOC_U = 137.31, DESLOC_V = 59.77;
const aux: number[] = [0, 0, 0, 0];

/**
 * Lê a textura no ponto (`x`, `y`) em metros, a `pxPorMetro` pixels por metro. Mistura uma leitura direta com outra girada
 * ~37° e deslocada, por `passo(0.35, 0.65, ruido(x / 3.5, y / 3.5))`, e aplica variação de brilho de ±8% em escala de ~6 m.
 */
export function amostrarSemRepeticao(t: Pixels, pxPorMetro: number, x: number, y: number, ruido: Ruido, o: number[]): void {
  const u = x * pxPorMetro, v = y * pxPorMetro;
  amostrar(t, u, v, o);
  const w = passo(0.35, 0.65, ruido(x / 3.5, y / 3.5));
  if (w > 0) {
    amostrar(t, u * COS - v * SEN + DESLOC_U, u * SEN + v * COS + DESLOC_V, aux);
    for (let k = 0; k < 4; k++) o[k] = o[k]! + (aux[k]! - o[k]!) * w;
  }
  const brilho = 1 + 0.16 * (ruido(x / 6 + 31.7, y / 6 + 17.3) - 0.5);
  o[0] = o[0]! * brilho; o[1] = o[1]! * brilho; o[2] = o[2]! * brilho;
}

/**
 * Peso (0 a 1) de uma camada em (`x`, `y`) metros. Sem máscara vale 1. Com máscara, entra onde o ruído passa de `limiar`,
 * com borda de largura `suave`; `limiar >= 1` nunca entra (o ruído fica em 0..1).
 */
export function pesoDaCamada(c: CamadaDeTextura, x: number, y: number, ruido: Ruido): number {
  const m = c.mascara;
  if (!m) return 1;
  const n = ruido(x * m.freq + m.semente * 17.31, y * m.freq + m.semente * 9.73);
  if (m.suave <= 0) return n > m.limiar ? 1 : 0;
  return passo(m.limiar, m.limiar + m.suave, n);
}

/**
 * `o` ← a cor escolhida pela luminância de `o` (0 a 1): preto = `escuro`, meio = `base`, branco = `claro`; `forca` (0 a 1)
 * mistura o resultado com a cor original. Mantém o alfa de `o`.
 */
export function mapaDeGradiente(o: number[], escuro: Cor3, base: Cor3, claro: Cor3, forca: number): void {
  const L = Math.min(1, Math.max(0, (0.2126 * o[0]! + 0.7152 * o[1]! + 0.0722 * o[2]!) / 255));
  const [a, b, t] = L < 0.5 ? [escuro, base, L * 2] as const : [base, claro, (L - 0.5) * 2] as const;
  for (let k = 0; k < 3; k++) o[k] = o[k]! + (a[k]! + (b[k]! - a[k]!) * t - o[k]!) * forca;
}
