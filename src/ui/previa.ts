import { ACERVO } from '../procedural/acervo.ts';
import { criarBaker, type Baker } from '../procedural/baker.ts';
import { COLECAO, RES_DA_COLECAO } from '../procedural/colecao.ts';
import { urlDoItem } from '../render/url-da-colecao.ts';

/** Um baker só para as miniaturas da biblioteca, separado do do mapa: elas não disputam a fila com o que está na tela. */
let baker: Baker | null = null;
const previas = new Map<string, Promise<{ bitmap: ImageBitmap; origem: [number, number]; res: number }>>();

export function pedirPrevia(receita: string, params: Record<string, unknown> = {}, seed = 3): Promise<{ bitmap: ImageBitmap; origem: [number, number]; res: number }> {
  baker ??= criarBaker({ workers: 1 });
  const chave = `previa|${receita}|${seed}|${JSON.stringify(params)}`;
  let p = previas.get(chave);
  if (!p) {
    const item = ACERVO.item(receita), arquivo = item?.fonte === 'colecao' ? COLECAO.find(i => i.id === receita) : undefined;
    p = baker.pedir(chave, arquivo ? { tipo: 'imagem', url: urlDoItem(arquivo), pegada: arquivo.pegada, res: 72, resImagem: arquivo.res ?? RES_DA_COLECAO, harmonizar: false, alvo: null } : { tipo: 'objeto', receita, params, seed, res: 72 });
    previas.set(chave, p);
  }
  return p;
}

/** Desenha a prévia centrada e inteira num canvas, sem distorcer. */
export function desenharPrevia(canvas: HTMLCanvasElement, r: { bitmap: ImageBitmap }): void {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const k = Math.min((canvas.width - 6) / r.bitmap.width, (canvas.height - 6) / r.bitmap.height, 1), w = r.bitmap.width * k, h = r.bitmap.height * k;
  ctx.imageSmoothingQuality = 'high'; ctx.drawImage(r.bitmap, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}
