/** Canvas que funciona na página e num worker: `OffscreenCanvas` quando existe, `<canvas>` quando não. */
export type Tela = HTMLCanvasElement | OffscreenCanvas;
export type Contexto = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function criarTela(largura: number, altura: number): Tela {
  const w = Math.max(1, Math.ceil(largura)), h = Math.max(1, Math.ceil(altura));
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
}

export function contextoDe(tela: Tela, opcoes: CanvasRenderingContext2DSettings = {}): Contexto {
  const ctx = tela.getContext('2d', opcoes) as Contexto | null;
  if (!ctx) throw new Error('Este navegador não deu um contexto 2D.');
  return ctx;
}
