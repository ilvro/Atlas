/**
 * Descrição de desenho: o que um objeto É, em formas, materiais e alturas, e não como ele é pintado. Cada renderizador
 * (Ilustrado agora, Pixel na Fase 8) interpreta a mesma descrição. Coordenadas locais em metros, origem no centro do
 * objeto e a frente voltada para +y.
 */
export interface Parte {
  forma: 'ret' | 'elipse' | 'poli';
  /** Centro e tamanho (ret e elipse). */
  x?: number; y?: number; w?: number; h?: number;
  /** Pontos [x0, y0, x1, y1, …] (poli). */
  pts?: number[];
  /** Id de material, ou `#rrggbb`. */
  mat: string;
  /** Altura em metros: ordena o desenho, projeta a sombra e dá relevo à luz. */
  z: number;
  raio?: number;
  /** Gira o padrão do material (tábuas e veios). */
  dir?: number;
  contorno?: false | 'leve';
  semSombra?: boolean; sombraLeve?: boolean; vidro?: boolean;
  /** Pincelada: sem o traço interno nem o degradê de volume (tufos de folhagem, neve, pelo, manchas). */
  suave?: boolean;
  /** Opacidade de 0 a 1 (veladuras de sombra e luz). O Pixel não desenha o que fica abaixo de 0,5. */
  alfa?: number;
  /** Nível de detalhe: o renderizador Pixel descarta o que não cabe na resolução. */
  detalhe?: 1 | 2 | 3;
}

export interface DescricaoDePiso { tipo: 'piso'; pegada: [number, number]; partes: Parte[] }
/** Objeto de parede: `face` em (u, z) vista de frente, `topo` em (u, profundidade) vista de cima, colada à parede. */
export interface DescricaoDeParede { tipo: 'parede'; largura: number; face: Parte[]; topo: Parte[] }
export type Descricao = DescricaoDePiso | DescricaoDeParede;

export const ret = (x: number, y: number, w: number, h: number, mat: string, z: number, extra: Partial<Parte> = {}): Parte => ({ forma: 'ret', x, y, w, h, mat, z, ...extra });
export const elipse = (x: number, y: number, w: number, h: number, mat: string, z: number, extra: Partial<Parte> = {}): Parte => ({ forma: 'elipse', x, y, w, h, mat, z, ...extra });
export const poli = (pts: number[], mat: string, z: number, extra: Partial<Parte> = {}): Parte => ({ forma: 'poli', pts, mat, z, ...extra });

export interface CaixaLocal { x0: number; y0: number; x1: number; y1: number }

/** Caixa que envolve as partes (sem sombra), em metros locais. */
export function caixaDasPartes(partes: readonly Parte[]): CaixaLocal {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of partes) {
    if (p.forma === 'poli') { for (let i = 0; i < (p.pts?.length ?? 0); i += 2) { x0 = Math.min(x0, p.pts![i]!); x1 = Math.max(x1, p.pts![i]!); y0 = Math.min(y0, p.pts![i + 1]!); y1 = Math.max(y1, p.pts![i + 1]!); } }
    else { x0 = Math.min(x0, p.x! - p.w! / 2); x1 = Math.max(x1, p.x! + p.w! / 2); y0 = Math.min(y0, p.y! - p.h! / 2); y1 = Math.max(y1, p.y! + p.h! / 2); }
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : { x0: 0, y0: 0, x1: 0, y1: 0 };
}
