import { ACERVO } from '../procedural/acervo.ts';
import { criarBaker, type Baker } from '../procedural/baker.ts';
import { COLECAO, RES_DA_COLECAO } from '../procedural/colecao.ts';
import { urlDoItem } from '../render/url-da-colecao.ts';
export { gerarMiniaturaDoMapa } from '../render/miniatura.ts';

/** Um baker só para as miniaturas da biblioteca, separado do do mapa: elas não disputam a fila com o que está na tela. */
let baker: Baker | null = null;
let proximoResetBakerEm = 0;
export const COOLDOWN_RESET_BAKER_MS = 5_000;
export const MAX_PREVIAS = 300;

/** Só para testes: troca o baker das prévias e limpa o cache. */
export function _usarBakerDasPrevias(b: Baker | null): void {
  baker = b;
  proximoResetBakerEm = 0;
  for (const p of previas.values()) p.then(r => r.bitmap?.close?.()).catch(() => {});
  previas.clear();
}
const previas = new Map<string, Promise<{ bitmap: ImageBitmap; origem: [number, number]; res: number }>>();

function erroDeWorkerQuebrado(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return msg.includes('O worker de pintura quebrou');
}

export function pedirPrevia(receita: string, params: Record<string, unknown> = {}, seed = 3, res = 72): Promise<{ bitmap: ImageBitmap; origem: [number, number]; res: number }> {
  const bakerAtual = (baker ??= criarBaker({ workers: 1 }));
  const chave = `previa|${receita}|${seed}|${res}|${JSON.stringify(params)}`;
  let p = previas.get(chave);
  if (p) {
    previas.delete(chave);
    previas.set(chave, p);
  } else {
    const item = ACERVO.item(receita), arquivo = item?.fonte === 'colecao' ? COLECAO.find(i => i.id === receita) : undefined;
    p = bakerAtual.pedir(chave, arquivo ? { tipo: 'imagem', url: urlDoItem(arquivo), pegada: arquivo.pegada, res, resImagem: arquivo.res ?? RES_DA_COLECAO, harmonizar: false, alvo: null } : { tipo: 'objeto', receita, params, seed, res, estilo: 'illustrated' });
    previas.set(chave, p);
    while (previas.size > MAX_PREVIAS) {
      const maisAntiga = previas.keys().next().value;
      if (maisAntiga === undefined) break;
      const removida = previas.get(maisAntiga);
      previas.delete(maisAntiga);
      removida?.then(r => r.bitmap?.close?.()).catch(() => {});
    }
    // Falhou (worker morto, import desatualizado): sai do cache para a próxima montagem tentar de novo.
    const atual = p;
    atual.catch(erro => {
      if (previas.get(chave) === atual) previas.delete(chave);
      if (baker === bakerAtual && erroDeWorkerQuebrado(erro)) {
        const agora = Date.now();
        if (agora >= proximoResetBakerEm) {
          proximoResetBakerEm = agora + COOLDOWN_RESET_BAKER_MS;
          baker = null;
          try { bakerAtual.encerrar(); } catch { /* ignora */ }
        }
      }
    });
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
