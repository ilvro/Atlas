import type { Material } from './materiais.ts';
import { fbm, valueNoise2D } from './ruido.ts';
import { PROFUNDIDADE_MAXIMA, distanciaAMargem } from './profundidade.ts';

/** Largura (m) da faixa de areia molhada que escurece o chão em volta da água. */
export const MARGEM_MOLHADA = 0.3;
/** Até onde (m) da borda a espuma e o canal de margem valem. */
export const ZONA_DE_ESPUMA = 0.6;
/** Pixels por metro das texturas de profundidade e margem que o assar devolve em `Assado.agua`. */
export const RES_DA_TEXTURA_DE_AGUA = 2;

const rgb = (hex: string): [number, number, number] => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** As cores e a transparência de um material de água, com padrões para o que faltar. */
export function coresDaAgua(m: Pick<Material, 'base' | 'escuro' | 'raso' | 'fundo' | 'transparencia'>): { raso: [number, number, number]; fundo: [number, number, number]; transparencia: number } {
  return { raso: rgb(m.raso ?? m.base), fundo: rgb(m.fundo ?? m.escuro), transparencia: m.transparencia ?? 0.15 };
}

export interface EntradaDaAgua {
  /** `1` onde há água (já com a borda torcida por ruído). */
  binaria: Uint8Array;
  /** Cobertura suave 0 a 255 (Ilustrado); `null` no Pixel. */
  cobertura: Uint8Array | null;
  largura: number; altura: number; res: number; seed: number; material: Material; pixel: boolean;
}
export interface SaidaDaAgua {
  /** RGBA do leito tingido (a água por cima do que está embaixo). */
  leito: Uint8ClampedArray;
  /** RGBA da faixa de areia molhada em volta da água. */
  margem: Uint8ClampedArray;
  /** Distância à margem em metros, saturada (0 fora da água). */
  profundidade: Float32Array;
}

/** Faixas de profundidade do Pixel: limites em metros entre raso, meio e fundo. */
export const FAIXAS_DO_PIXEL = [0.5, 1.5] as const;

/**
 * O leito de uma camada de água: a cor passa de `raso` a `fundo` com a distância à margem e a água fica mais opaca com a profundidade
 * (o que está embaixo aparece perto da margem), mais uma faixa escura de areia molhada de 0,3 m em volta. No Pixel o leito vem em três faixas
 * de cor, a mais rasa vazada em xadrez, e a margem em degraus de 2 pixels.
 */
export function leitoDaAgua(e: EntradaDaAgua): SaidaDaAgua {
  const { binaria, cobertura, largura: W, altura: H, res, pixel } = e, n = W * H;
  const cores = coresDaAgua(e.material), profundidade = distanciaAMargem(binaria, W, H, res, PROFUNDIDADE_MAXIMA);
  const terra = new Uint8Array(n); for (let i = 0; i < n; i++) terra[i] = binaria[i] ? 0 : 1;
  const aFora = distanciaAMargem(terra, W, H, res, MARGEM_MOLHADA + 1 / res);
  const leito = new Uint8ClampedArray(n * 4), margem = new Uint8ClampedArray(n * 4), ruido = valueNoise2D(7000 + e.seed), ruidoFundo = valueNoise2D(7100 + e.seed);
  const opaco = 1 - cores.transparencia, [m0, m1, m2] = rgb(e.material.escuro).map(v => v * 0.55) as [number, number, number];
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const k = i * 4, mx = x / res, my = y / res;
    if (binaria[i]) {
      const d = Math.max(0, profundidade[i]! + (fbm(ruidoFundo, mx * 0.9, my * 0.9, 2) - 0.5) * 0.7);
      if (pixel) {
        const faixa = d < FAIXAS_DO_PIXEL[0] ? 0 : d < FAIXAS_DO_PIXEL[1] ? 1 : 2, t = faixa === 0 ? 0 : faixa === 1 ? 0.5 : 1;
        if (faixa === 0 && ((x + y) & 1)) continue;                        // o raso é vazado em xadrez: o leito aparece por entre os pixels
        leito[k] = cores.raso[0] + (cores.fundo[0] - cores.raso[0]) * t; leito[k + 1] = cores.raso[1] + (cores.fundo[1] - cores.raso[1]) * t; leito[k + 2] = cores.raso[2] + (cores.fundo[2] - cores.raso[2]) * t; leito[k + 3] = 255;
      } else {
        const t = suave(0, PROFUNDIDADE_MAXIMA, d), a = ((cobertura ? cobertura[i]! / 255 : 1)) * (0.14 + (opaco - 0.14) * t);
        leito[k] = cores.raso[0] + (cores.fundo[0] - cores.raso[0]) * t; leito[k + 1] = cores.raso[1] + (cores.fundo[1] - cores.raso[1]) * t; leito[k + 2] = cores.raso[2] + (cores.fundo[2] - cores.raso[2]) * t; leito[k + 3] = a * 255;
      }
    } else if (aFora[i]! > 0 && aFora[i]! <= MARGEM_MOLHADA + 1e-6) {
      const f = aFora[i]! / MARGEM_MOLHADA;
      if (pixel) { if (aFora[i]! * res <= 2.01) { margem[k] = m0; margem[k + 1] = m1; margem[k + 2] = m2; margem[k + 3] = 255; } }
      else { const a = 0.5 * (1 - f) * (0.7 + 0.3 * fbm(ruido, mx * 2, my * 2, 2)); margem[k] = m0 * 0.6; margem[k + 1] = m1 * 0.6; margem[k + 2] = m2 * 0.6; margem[k + 3] = a * 255; }
    }
  }
  return { leito, margem, profundidade };
}

/** Quantas camadas de água distintas a superfície sabe animar (cada uma com a sua correnteza). */
export const MAX_CAMADAS_DE_AGUA = 4;
/** Funde a profundidade (R), a margem (G: 1 na borda, 0 a 0,6 m) e o índice da camada (B: `(i + 1) × 50`, de 1 a 4) das camadas de água numa textura de 2 px/m; R e G guardam o maior valor. */
export function texturaDeAgua(camadas: { profundidade: Float32Array; binaria: Uint8Array }[], W: number, H: number, res: number, largura: number, altura: number): ImageData | null {
  if (!camadas.length) return null;
  const wa = Math.max(1, Math.ceil(largura * RES_DA_TEXTURA_DE_AGUA)), ha = Math.max(1, Math.ceil(altura * RES_DA_TEXTURA_DE_AGUA)), dados = new ImageData(wa, ha);
  for (let i = 3; i < dados.data.length; i += 4) dados.data[i] = 255;
  camadas.slice(0, MAX_CAMADAS_DE_AGUA).forEach((c, idx) => { for (let ya = 0; ya < ha; ya++) for (let xa = 0; xa < wa; xa++) {
    const px = Math.min(W - 1, Math.floor((xa + 0.5) / RES_DA_TEXTURA_DE_AGUA * res)), py = Math.min(H - 1, Math.floor((ya + 0.5) / RES_DA_TEXTURA_DE_AGUA * res)), j = py * W + px;
    if (!c.binaria[j]) continue;
    const d = c.profundidade[j]!, k = (ya * wa + xa) * 4, r = Math.min(1, d / PROFUNDIDADE_MAXIMA) * 255, g = Math.max(0, 1 - d / ZONA_DE_ESPUMA) * 255;
    if (r > dados.data[k]!) dados.data[k] = r;
    if (g > dados.data[k + 1]!) dados.data[k + 1] = g;
    dados.data[k + 2] = (idx + 1) * 50;
  } });
  return dados;
}
