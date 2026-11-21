// Textura de terreno em metros: leitura bilinear, sem repetição visível, e mapa de gradiente para a paleta.
// Funções puras e determinísticas (nada de Math.random); quem chama passa o array de saída, sem alocação por pixel.

/** Imagem RGBA de 8 bits, `dados.length === largura * altura * 4`. */
export interface Pixels { dados: Uint8ClampedArray; largura: number; altura: number }

export interface MascaraDeCamada { freq: number; limiar: number; suave: number; semente: number }
/**
 * Uma camada da receita. `escala` multiplica o tamanho real da textura (2 = ladrilho duas vezes maior). `tons` (escuro, base, claro)
 * troca a paleta do material só nesta camada (o musgo verde dentro do folhiço pardo).
 */
export interface CamadaDeTextura { textura: string; escala?: number; mascara?: MascaraDeCamada; tons?: readonly [string, string, string] }
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
 * mistura o resultado com a cor original. Mantém o alfa de `o`. `tom` normaliza a luminância da textura (`media` vai ao meio
 * do gradiente e cada `desvio` anda 1/4 dele), para que uma foto escura ou clara use a paleta inteira.
 */
export function mapaDeGradiente(o: number[], escuro: Cor3, base: Cor3, claro: Cor3, forca: number, tom?: Tom): void {
  const l = (0.2126 * o[0]! + 0.7152 * o[1]! + 0.0722 * o[2]!) / 255;
  const L = Math.min(1, Math.max(0, tom ? 0.5 + (l - tom.media) * (0.25 / Math.max(1e-3, tom.desvio)) : l));
  const [a, b, t] = L < 0.5 ? [escuro, base, L * 2] as const : [base, claro, (L - 0.5) * 2] as const;
  for (let k = 0; k < 3; k++) o[k] = o[k]! + (a[k]! + (b[k]! - a[k]!) * t - o[k]!) * forca;
}

/** Média e desvio da luminância (0 a 1) de uma textura. */
export interface Tom { media: number; desvio: number }

/** Média e desvio da luminância de `t` (ou só do canal vermelho, para mapas de deslocamento em cinza). Pura. */
export function tomDaTextura(t: Pixels, soVermelho = false): Tom {
  const d = t.dados, n = t.largura * t.altura;
  let s = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const k = i * 4, l = (soVermelho ? d[k]! : 0.2126 * d[k]! + 0.7152 * d[k + 1]! + 0.0722 * d[k + 2]!) / 255;
    s += l; s2 += l * l;
  }
  const media = n ? s / n : 0;
  return { media, desvio: Math.sqrt(Math.max(0, (n ? s2 / n : 0) - media * media)) };
}

/**
 * A textura reduzida `fator` vezes (média de `fator × fator` leituras por pixel, com volta nas bordas), para ler a ~1 texel por
 * pixel do terreno sem serrilhar. O resultado continua em ladrilho. Pura.
 */
export function reduzirTextura(t: Pixels, fator: number): Pixels {
  if (fator <= 1) return t;
  const W = Math.max(1, Math.round(t.largura / fator)), H = Math.max(1, Math.round(t.altura / fator)), sx = t.largura / W, sy = t.altura / H;
  const n = Math.max(1, Math.round(fator)), dados = new Uint8ClampedArray(W * H * 4), o = [0, 0, 0, 0];
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let q = 0; q < n; q++) for (let p = 0; p < n; p++) {
      amostrar(t, (i + (p + 0.5) / n) * sx, (j + (q + 0.5) / n) * sy, o);
      r += o[0]!; g += o[1]!; b += o[2]!; a += o[3]!;
    }
    const k = (j * W + i) * 4, m = n * n;
    dados[k] = r / m; dados[k + 1] = g / m; dados[k + 2] = b / m; dados[k + 3] = a / m;
  }
  return { dados, largura: W, altura: H };
}
