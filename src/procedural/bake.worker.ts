/// <reference lib="webworker" />
import { executarBake, type PedidoDeBake } from './executar.ts';
import {
  bitmapParaPng,
  cacheDeAssadosPadrao,
  type ResultadoComExtras,
} from './cache-de-assados.ts';

interface Mensagem {
  id: number;
  pedido: PedidoDeBake;
  cacheChave?: string;
}

async function clonarResultado(r: ResultadoComExtras): Promise<ResultadoComExtras | null> {
  const abertos: ImageBitmap[] = [];
  const clonar = async (bmp: ImageBitmap): Promise<ImageBitmap> => {
    const copia = await createImageBitmap(bmp);
    abertos.push(copia);
    return copia;
  };
  try {
    const [bitmap, altura, aguaBmp, normal, fachada] = await Promise.all([
      clonar(r.bitmap),
      r.altura ? clonar(r.altura) : Promise.resolve(null),
      r.agua ? clonar(r.agua.bitmap) : Promise.resolve(undefined),
      r.normal ? clonar(r.normal) : Promise.resolve(undefined),
      r.fachada ? clonar(r.fachada) : Promise.resolve(undefined),
    ]);
    return {
      bitmap,
      altura,
      origem: r.origem,
      res: r.res,
      ...(r.agua && aguaBmp ? { agua: { bitmap: aguaBmp, res: r.agua.res } } : {}),
      ...(normal ? { normal } : {}),
      ...(fachada ? { fachada } : {}),
    };
  } catch {
    for (const bmp of abertos) bmp.close();
    return null;
  }
}

async function gravarEmSegundoPlano(chave: string, copia: ResultadoComExtras): Promise<void> {
  try {
    const [cor, altura, aguaBlob, normal, fachada] = await Promise.all([
      bitmapParaPng(copia.bitmap),
      copia.altura ? bitmapParaPng(copia.altura) : Promise.resolve(null),
      copia.agua ? bitmapParaPng(copia.agua.bitmap) : Promise.resolve(undefined),
      copia.normal ? bitmapParaPng(copia.normal) : Promise.resolve(undefined),
      copia.fachada ? bitmapParaPng(copia.fachada) : Promise.resolve(undefined),
    ]);
    await cacheDeAssadosPadrao().gravarBruto(chave, {
      cor,
      altura,
      agua: copia.agua && aguaBlob ? { blob: aguaBlob, res: copia.agua.res } : null,
      ...(normal !== undefined ? { normal } : {}),
      ...(fachada !== undefined ? { fachada } : {}),
      origem: copia.origem,
      res: copia.res,
    });
  } catch {
    // Falha silenciosa: não deve interromper o worker.
  } finally {
    copia.bitmap.close();
    copia.altura?.close();
    copia.agua?.bitmap.close();
    copia.normal?.close();
    copia.fachada?.close();
  }
}

self.onmessage = async (e: MessageEvent<Mensagem>) => {
  const { id, pedido, cacheChave } = e.data;
  const t0 = performance.now();
  try {
    const r = (await executarBake(pedido)) as ResultadoComExtras;
    const ms = performance.now() - t0;
    const copia = cacheChave ? await clonarResultado(r) : null;
    const transferir: Transferable[] = [r.bitmap];
    if (r.altura) transferir.push(r.altura);
    if (r.agua) transferir.push(r.agua.bitmap);
    if (r.normal) transferir.push(r.normal);
    if (r.fachada) transferir.push(r.fachada);
    (self as unknown as Worker).postMessage({ id, ok: true, resultado: r, ms }, transferir);
    if (cacheChave && copia) {
      void gravarEmSegundoPlano(cacheChave, copia);
    }
  } catch (erro) {
    (self as unknown as Worker).postMessage({
      id,
      ok: false,
      erro: erro instanceof Error ? erro.message : String(erro),
      ms: performance.now() - t0,
    });
  }
};
