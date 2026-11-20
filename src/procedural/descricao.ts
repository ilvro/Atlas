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
  /** Borda macia (m): a parte vira uma mancha de cor chapada desfocada, sem traço nem sombra (fogo, brilho, névoa). */
  desfoque?: number;
  /** Soma a luz em vez de cobrir (com `desfoque`): o miolo do fogo e os brilhos clareiam o que está embaixo. */
  brilho?: boolean;
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

const espelharParte = (p: Parte): Parte => {
  const q: Parte = { ...p };
  if (q.x !== undefined) q.x = 0 - q.x;
  if (q.pts) {
    const n = q.pts.length / 2, out: number[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(0 - q.pts[i * 2]!, q.pts[i * 2 + 1]!);
    q.pts = out;
  }
  if (q.dir !== undefined) q.dir = Math.PI - q.dir;
  return q;
};

/** Espelha a descrição na horizontal (eixo x local / eixo u da parede). Pura; espelhar duas vezes devolve o original. */
export function espelharDescricao(d: Descricao): Descricao {
  if (d.tipo === 'piso') return { ...d, partes: d.partes.map((p) => espelharParte(p)) };
  return { ...d, face: d.face.map((p) => espelharParte(p)), topo: d.topo.map((p) => espelharParte(p)) };
}
