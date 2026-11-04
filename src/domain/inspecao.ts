/**
 * A matemática da inspeção de um documento: onde a imagem fica na tela, zoom em torno de um ponto, arrasto e a posição da lanterna UV
 * em frações da imagem (para o projetor mostrar a mesma coisa em qualquer tamanho de tela).
 */
export interface Vista { zoom: number; /** Fração (0 a 1) da imagem que está no centro da tela. */ cx: number; cy: number }
export interface Tamanho { largura: number; altura: number }

export const VISTA_INICIAL: Vista = { zoom: 1, cx: 0.5, cy: 0.5 };
export const ZOOM_MIN = 0.5, ZOOM_MAX = 8;
/** O documento ocupa no máximo esta parte da tela com zoom 1. */
const MARGEM = 0.9;

/** Pixels de tela por pixel da imagem com zoom 1 (a imagem inteira cabe na tela, com folga). */
export const escalaBase = (tela: Tamanho, img: Tamanho): number => Math.min(tela.largura / img.largura, tela.altura / img.altura) * MARGEM;

/** O retângulo da imagem na tela. */
export function retanguloDaImagem(v: Vista, tela: Tamanho, img: Tamanho): { x: number; y: number; w: number; h: number } {
  const e = escalaBase(tela, img) * v.zoom, w = img.largura * e, h = img.altura * e;
  return { x: tela.largura / 2 - v.cx * w, y: tela.altura / 2 - v.cy * h, w, h };
}

/** Um ponto da tela em frações da imagem (pode cair fora de 0 a 1). */
export function paraFracao(p: readonly [number, number], v: Vista, tela: Tamanho, img: Tamanho): [number, number] {
  const r = retanguloDaImagem(v, tela, img); return [(p[0] - r.x) / r.w, (p[1] - r.y) / r.h];
}
/** Uma fração da imagem na tela. */
export function paraTela(f: readonly [number, number], v: Vista, tela: Tamanho, img: Tamanho): [number, number] {
  const r = retanguloDaImagem(v, tela, img); return [r.x + f[0] * r.w, r.y + f[1] * r.h];
}

const limitar = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));

/** Muda o zoom mantendo fixo o ponto da imagem que está sob `foco` (px da tela). */
export function zoomEm(v: Vista, fator: number, foco: readonly [number, number], tela: Tamanho, img: Tamanho): Vista {
  const zoom = limitar(v.zoom * fator, ZOOM_MIN, ZOOM_MAX); if (zoom === v.zoom) return v;
  const f = paraFracao(foco, v, tela, img), e = escalaBase(tela, img) * zoom, w = img.largura * e, h = img.altura * e;
  // Depois do zoom, `f` tem de continuar sob `foco`: foco = centro + (f - c) * tamanho.
  return { zoom, cx: f[0] - (foco[0] - tela.largura / 2) / w, cy: f[1] - (foco[1] - tela.altura / 2) / h };
}

/** Arrasta a imagem `dx`, `dy` pixels da tela (o centro anda ao contrário). O centro fica dentro da imagem. */
export function arrastar(v: Vista, dx: number, dy: number, tela: Tamanho, img: Tamanho): Vista {
  const e = escalaBase(tela, img) * v.zoom;
  return { ...v, cx: limitar(v.cx - dx / (img.largura * e), 0, 1), cy: limitar(v.cy - dy / (img.altura * e), 0, 1) };
}

/** Média móvel exponencial: `atual` caminha para `alvo` (constante de tempo `tau`, em segundos; `dt` em segundos). */
export const suavizar = (atual: number, alvo: number, dt: number, tau = 0.07): number => atual + (alvo - atual) * (1 - Math.exp(-Math.max(0, dt) / tau));

/** O raio da lanterna UV em frações da largura da imagem (cresce um pouco com o zoom para sempre caber um pedaço legível). */
export const RAIO_DA_LANTERNA = 0.13;
