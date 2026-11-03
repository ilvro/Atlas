import { assarDescricao } from '../assar.ts';
import { PESADOS } from './index.ts';

export interface VarianteAssada { dataUrl: string; largura: number; altura: number; partes: number; ms: number; pegada: [number, number] }

/** Assa uma variante de um gerador pesado em WebP (só roda num navegador: precisa de canvas). A imagem cobre a pegada e a margem de sombra. */
export async function assarParaWebp(geradorId: string, sufixo: string, res: number): Promise<VarianteAssada> {
  const g = PESADOS.find(x => x.id === geradorId), v = g?.variantes.find(x => x.sufixo === sufixo);
  if (!g || !v) throw new Error(`Não existe ${geradorId}-${sufixo}.`);
  const t0 = performance.now(), d = g.gerar({ seed: v.seed, params: v.params }), a = assarDescricao(d, v.seed, res);
  const tela = a.tela as OffscreenCanvas, blob = await tela.convertToBlob({ type: 'image/webp', quality: 0.92 }), ms = performance.now() - t0;
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binario = ''; for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { dataUrl: `data:image/webp;base64,${btoa(binario)}`, largura: tela.width, altura: tela.height, partes: d.partes.length, ms, pegada: d.pegada };
}
