import type { Material } from './materiais.ts';
import { fbm, hash2D, valueNoise2D } from './ruido.ts';
import { PROFUNDIDADE_DO_LEITO_MAXIMA, PROFUNDIDADE_MAXIMA, distanciaAMargem } from './profundidade.ts';

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
  /** Deslocamento em pixels no mapa quando assada numa sub-caixa (preserva as coordenadas do mundo no ruído). */
  origemPx?: [number, number];
}
export interface SaidaDaAgua {
  /** RGBA do leito tingido (a água por cima do que está embaixo). */
  leito: Uint8ClampedArray;
  /** RGBA da faixa de areia molhada em volta da água. */
  margem: Uint8ClampedArray;
  /** Só em água clara (`material.absorcao`, Ilustrado): RGBA que multiplica o chão de baixo antes do leito (a cor que a água tira dele). */
  absorcao?: Uint8ClampedArray;
  /** Distância à margem em metros, saturada (0 fora da água). */
  profundidade: Float32Array;
  /** Só em água que brilha (`material.brilho`): quanto cada pixel emite (0 a 1); na lava, também no clarão em volta. */
  calor?: Float32Array;
}

/** Faixas de profundidade do Pixel: limites em metros entre raso, meio e fundo. */
export const FAIXAS_DO_PIXEL = [0.5, 1.5] as const;

/** Até onde (m) o clarão da lava aquece e chamusca o chão em volta. */
export const CLARAO_DA_LAVA = 1.4;
const CROSTA: [number, number, number][] = [[18, 12, 11], [36, 22, 17], [58, 34, 24]];
const BRASA: [number, number, number][] = [[110, 22, 8], [190, 52, 10], [232, 98, 20], [246, 140, 40]];
const rampa = (cores: [number, number, number][], t: number): [number, number, number] => {
  const x = Math.min(0.999, Math.max(0, t)) * (cores.length - 1), i = Math.floor(x), f = x - i, a = cores[i]!, b = cores[i + 1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
};

/** Ruído celular: distância (m) do ponto à borda da placa mais próxima (F2 − F1 de pontos sorteados numa grade de `lado` m). */
function bordaDePlaca(x: number, y: number, lado: number, seed: number): number {
  const gx = Math.floor(x / lado), gy = Math.floor(y / lado);
  let f1 = Infinity, f2 = Infinity;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = gx + i, cy = gy + j, px = (cx + hash2D(cx, cy, seed)) * lado, py = (cy + hash2D(cx, cy, seed + 1)) * lado, d = Math.hypot(x - px, y - py);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return (f2 - f1) / 2;
}

/**
 * Lava: placas de crosta escura separadas por uma rede de fendas acesas (bordas de células), que se alargam onde o rio é fundo, até virar
 * um canal derretido no miolo; junto à margem a crosta esfria e as fendas somem. Fora, um anel de chão chamuscado e aquecido de laranja.
 * `calor` diz o quanto cada pixel emite: o assar o grava no canal de emissão do mapa de altura, e a composição de luz o faz brilhar acima
 * da luz da cena (a emissão multiplica a própria cor por até 3, então as cores ficam escuras e quem dá o brilho é o calor).
 */
function leitoDeLava(e: EntradaDaAgua, profundidade: Float32Array): SaidaDaAgua {
  const { binaria, cobertura, largura: W, altura: H, res, pixel } = e, [ox, oy] = e.origemPx ?? [0, 0], n = W * H, forca = Math.min(1, Math.max(0, e.material.brilho ?? 1));
  const terra = new Uint8Array(n); for (let i = 0; i < n; i++) terra[i] = binaria[i] ? 0 : 1;
  const aFora = distanciaAMargem(terra, W, H, res, CLARAO_DA_LAVA + 1 / res);
  const leito = new Uint8ClampedArray(n * 4), margem = new Uint8ClampedArray(n * 4), calor = new Float32Array(n);
  const torcao = valueNoise2D(7300 + e.seed), grao = valueNoise2D(7400 + e.seed), sementeDasPlacas = 7500 + e.seed;
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const k = i * 4, mx = (ox + x) / res, my = (oy + y) / res;
    if (binaria[i]) {
      const fundo = suave(0.25, 2.4, profundidade[i]!);
      const wx = mx + (fbm(torcao, mx * 0.6, my * 0.6, 2) - 0.5) * 0.7, wy = my + (fbm(torcao, mx * 0.6 + 9, my * 0.6 + 4, 2) - 0.5) * 0.7;
      const borda = Math.min(bordaDePlaca(wx, wy, 0.95, sementeDasPlacas), bordaDePlaca(wx * 2.1 + 3, wy * 2.1 + 7, 0.95, sementeDasPlacas + 2) / 2.1 + 0.035 - fundo * 0.03);
      const largura = 0.03 + fundo * 0.06, fenda = 1 - suave(largura * 0.3, largura, borda);
      const derretido = suave(0.55, 1, fundo) * (0.75 + 0.25 * fbm(grao, mx * 0.8, my * 0.8, 2));
      let t = Math.max(fenda * (0.45 + 0.55 * fundo), derretido);
      if (pixel) t = t > 0.6 ? 1 : t > 0.25 ? 0.5 : 0;
      const crosta = rampa(CROSTA, fbm(grao, mx * 3, my * 3, 2)), brasa = rampa(BRASA, t), m = suave(0.02, 0.25, t);
      const a = pixel ? 255 : (cobertura ? cobertura[i]! : 255);
      leito[k] = crosta[0] + (brasa[0] - crosta[0]) * m; leito[k + 1] = crosta[1] + (brasa[1] - crosta[1]) * m; leito[k + 2] = crosta[2] + (brasa[2] - crosta[2]) * m; leito[k + 3] = a;
      calor[i] = forca * (0.03 + 0.5 * t) * (a / 255);
    } else if (aFora[i]! > 0 && aFora[i]! <= CLARAO_DA_LAVA + 1e-6) {
      const f = aFora[i]! / CLARAO_DA_LAVA, perto = (1 - f) * (1 - f);
      if (pixel) { if (aFora[i]! * res <= 2.01) { margem[k] = 34; margem[k + 1] = 20; margem[k + 2] = 16; margem[k + 3] = 255; } continue; }
      // Junto à borda, chão chamuscado; mais longe, o chão tinge de laranja (a emissão multiplica essa cor: o clarão sai laranja, não branco).
      const chamusco = suave(0.3, 0, aFora[i]!) * (0.7 + 0.3 * fbm(grao, mx * 2, my * 2, 2));
      margem[k] = 48 * chamusco + 214 * (1 - chamusco); margem[k + 1] = 24 * chamusco + 74 * (1 - chamusco); margem[k + 2] = 14 * chamusco + 12 * (1 - chamusco);
      margem[k + 3] = Math.min(255, Math.max(chamusco * 0.75, perto * 0.7) * 255);
      calor[i] = forca * perto * 0.22;
    }
  }
  return { leito, margem, profundidade, calor };
}

/**
 * O leito de uma camada de água: a cor passa de `raso` a `fundo` com a distância à margem e a água fica mais opaca com a profundidade
 * (o que está embaixo aparece perto da margem), mais uma faixa escura de areia molhada de 0,3 m em volta. No Pixel o leito vem em três faixas
 * de cor, a mais rasa vazada em xadrez, e a margem em degraus de 2 pixels.
 */
export function leitoDaAgua(e: EntradaDaAgua): SaidaDaAgua {
  const { binaria, cobertura, largura: W, altura: H, res, pixel } = e, [ox, oy] = e.origemPx ?? [0, 0], n = W * H;
  const cores = coresDaAgua(e.material), profundidade = distanciaAMargem(binaria, W, H, res, PROFUNDIDADE_MAXIMA);
  if (e.material.lava) return leitoDeLava(e, profundidade);
  // Água clara: a cor vai de raso a fundo numa rampa mais longa (`fundoEm`), e a água absorve do leito a cor de `absorcao`.
  const fundoEm = Math.min(PROFUNDIDADE_DO_LEITO_MAXIMA, Math.max(PROFUNDIDADE_MAXIMA, e.material.fundoEm ?? PROFUNDIDADE_MAXIMA));
  const rampa = fundoEm > PROFUNDIDADE_MAXIMA && !pixel ? distanciaAMargem(binaria, W, H, res, fundoEm) : profundidade;
  const absorve = e.material.absorcao && !pixel ? rgb(e.material.absorcao) : null, absorcao = absorve ? new Uint8ClampedArray(n * 4) : undefined;
  const terra = new Uint8Array(n); for (let i = 0; i < n; i++) terra[i] = binaria[i] ? 0 : 1;
  const aFora = distanciaAMargem(terra, W, H, res, MARGEM_MOLHADA + 1 / res);
  const leito = new Uint8ClampedArray(n * 4), margem = new Uint8ClampedArray(n * 4), ruido = valueNoise2D(7000 + e.seed), ruidoFundo = valueNoise2D(7100 + e.seed);
  const opaco = 1 - cores.transparencia, [m0, m1, m2] = rgb(e.material.escuro).map(v => v * 0.55) as [number, number, number];
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
    const k = i * 4, mx = (ox + x) / res, my = (oy + y) / res;
    if (binaria[i]) {
      const d = Math.max(0, profundidade[i]! + (fbm(ruidoFundo, mx * 0.9, my * 0.9, 2) - 0.5) * 0.7);
      if (pixel) {
        const faixa = d < FAIXAS_DO_PIXEL[0] ? 0 : d < FAIXAS_DO_PIXEL[1] ? 1 : 2, t = faixa === 0 ? 0 : faixa === 1 ? 0.5 : 1;
        if (faixa === 0 && (((ox + x) + (oy + y)) & 1)) continue;                        // o raso é vazado em xadrez: o leito aparece por entre os pixels
        leito[k] = cores.raso[0] + (cores.fundo[0] - cores.raso[0]) * t; leito[k + 1] = cores.raso[1] + (cores.fundo[1] - cores.raso[1]) * t; leito[k + 2] = cores.raso[2] + (cores.fundo[2] - cores.raso[2]) * t; leito[k + 3] = 255;
      } else {
        const dr = rampa === profundidade ? d : Math.max(0, rampa[i]! + (fbm(ruidoFundo, mx * 0.9, my * 0.9, 2) - 0.5) * 0.7 * (fundoEm / PROFUNDIDADE_MAXIMA));
        const t = suave(0, fundoEm, dr), cob = cobertura ? cobertura[i]! / 255 : 1, a = cob * (0.14 + (opaco - 0.14) * t);
        if (absorve && absorcao) { absorcao[k] = absorve[0]; absorcao[k + 1] = absorve[1]; absorcao[k + 2] = absorve[2]; absorcao[k + 3] = cob * 255; }
        leito[k] = cores.raso[0] + (cores.fundo[0] - cores.raso[0]) * t; leito[k + 1] = cores.raso[1] + (cores.fundo[1] - cores.raso[1]) * t; leito[k + 2] = cores.raso[2] + (cores.fundo[2] - cores.raso[2]) * t; leito[k + 3] = a * 255;
      }
    } else if (aFora[i]! > 0 && aFora[i]! <= MARGEM_MOLHADA + 1e-6) {
      const f = aFora[i]! / MARGEM_MOLHADA;
      if (pixel) { if (aFora[i]! * res <= 2.01) { margem[k] = m0; margem[k + 1] = m1; margem[k + 2] = m2; margem[k + 3] = 255; } }
      else { const a = 0.5 * (1 - f) * (0.7 + 0.3 * fbm(ruido, mx * 2, my * 2, 2)); margem[k] = m0 * 0.6; margem[k + 1] = m1 * 0.6; margem[k + 2] = m2 * 0.6; margem[k + 3] = a * 255; }
    }
  }
  // Água que brilha sem ser lava (ácida, mágica): emite pela opacidade do leito, mais no fundo; a superfície continua animada.
  if (e.material.brilho) {
    const calor = new Float32Array(n), forca = Math.min(1, Math.max(0, e.material.brilho));
    for (let i = 0; i < n; i++) if (binaria[i]) calor[i] = forca * (0.35 + 0.65 * suave(0, PROFUNDIDADE_MAXIMA, profundidade[i]!)) * (leito[i * 4 + 3]! / 255);
    return { leito, margem, profundidade, calor, ...(absorcao ? { absorcao } : {}) };
  }
  return { leito, margem, profundidade, ...(absorcao ? { absorcao } : {}) };
}

/** Quantas camadas de água distintas a superfície sabe animar (cada uma com a sua correnteza). */
export const MAX_CAMADAS_DE_AGUA = 4;
/** Camada de água assada (opcionalmente numa sub-caixa `[x0, y0, cw, ch]`) para compor a textura da superfície. */
export interface CamadaDeAguaParaTextura {
  profundidade: Float32Array;
  binaria: Uint8Array;
  x0?: number;
  y0?: number;
  cw?: number;
  ch?: number;
  /** Índice real da camada de água no mapa (0..3), preservado quando camadas anteriores ficam fora do ladrilho. */
  indice?: number;
}

/** Funde a profundidade (R), a margem (G: 1 na borda, 0 a 0,6 m) e o índice da camada (B: `(i + 1) × 50`, de 1 a 4) das camadas de água numa textura de 2 px/m; R e G guardam o maior valor. */
export function texturaDeAgua(
  camadas: CamadaDeAguaParaTextura[],
  W: number,
  H: number,
  res: number,
  largura: number,
  altura: number,
  recortePx?: { x0: number; y0: number; w: number; h: number },
): ImageData | null {
  if (!camadas.length) return null;
  const waFull = Math.max(1, Math.ceil(largura * RES_DA_TEXTURA_DE_AGUA));
  const haFull = Math.max(1, Math.ceil(altura * RES_DA_TEXTURA_DE_AGUA));
  const ax0 = recortePx?.x0 ?? 0, ay0 = recortePx?.y0 ?? 0;
  const wa = recortePx?.w ?? waFull, ha = recortePx?.h ?? haFull;
  const dados = new ImageData(wa, ha);
  for (let i = 3; i < dados.data.length; i += 4) dados.data[i] = 255;
  for (let i = 0; i < camadas.length; i++) {
    const c = camadas[i]!, idx = c.indice ?? i;
    if (idx < 0 || idx >= MAX_CAMADAS_DE_AGUA) continue;
    const cx0 = c.x0 ?? 0, cy0 = c.y0 ?? 0, cw = c.cw ?? W, ch = c.ch ?? H;
    for (let yOut = 0; yOut < ha; yOut++) {
      const ya = ay0 + yOut;
      const py = Math.min(H - 1, Math.floor((ya + 0.5) / RES_DA_TEXTURA_DE_AGUA * res)), ly = py - cy0;
      if (ly < 0 || ly >= ch) continue;
      for (let xOut = 0; xOut < wa; xOut++) {
        const xa = ax0 + xOut;
        const px = Math.min(W - 1, Math.floor((xa + 0.5) / RES_DA_TEXTURA_DE_AGUA * res)), lx = px - cx0;
        if (lx < 0 || lx >= cw) continue;
        const j = ly * cw + lx;
        if (!c.binaria[j]) continue;
        const d = c.profundidade[j]!, k = (yOut * wa + xOut) * 4, r = Math.min(1, d / PROFUNDIDADE_MAXIMA) * 255, g = Math.max(0, 1 - d / ZONA_DE_ESPUMA) * 255;
        if (r > dados.data[k]!) dados.data[k] = r;
        if (g > dados.data[k + 1]!) dados.data[k + 1] = g;
        dados.data[k + 2] = (idx + 1) * 50;
      }
    }
  }
  return dados;
}
