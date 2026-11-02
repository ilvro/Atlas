/// <reference lib="webworker" />
import { executarBake, type PedidoDeBake } from './executar.ts';

interface Mensagem { id: number; pedido: PedidoDeBake }

self.onmessage = async (e: MessageEvent<Mensagem>) => {
  const { id, pedido } = e.data;
  try {
    const r = await executarBake(pedido);
    (self as unknown as Worker).postMessage({ id, ok: true, resultado: r }, [r.bitmap]);
  } catch (erro) { (self as unknown as Worker).postMessage({ id, ok: false, erro: erro instanceof Error ? erro.message : String(erro) }); }
};
