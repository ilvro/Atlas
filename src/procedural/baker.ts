import type { PedidoDeBake, ResultadoDeBake } from './executar.ts';

/**
 * Cliente do trabalho pesado de pintura: fila, workers e cache por chave. A página mostra o resultado anterior enquanto o
 * novo não chega (quem chama guarda o que já tinha). Sem worker ou sem OffscreenCanvas, pinta na própria página.
 */
export interface Baker {
  /** Pede (ou reaproveita) o resultado da `chave`. Chaves iguais compartilham o mesmo trabalho. */
  pedir(chave: string, pedido: PedidoDeBake): Promise<ResultadoDeBake>;
  /** Esquece as chaves que não estão em `emUso`. */
  coletar(emUso: ReadonlySet<string>): void;
  readonly pendentes: number;
  readonly noWorker: boolean;
  encerrar(): void;
}

export function criarBaker(opcoes: { workers?: number } = {}): Baker {
  const usarWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  const n = usarWorker ? Math.max(1, Math.min(opcoes.workers ?? 2, navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 2)) : 0;
  const workers: Worker[] = [], cargas: number[] = [], esperando = new Map<number, { ok: (r: ResultadoDeBake) => void; erro: (e: Error) => void; worker: number }>();
  let proximo = 0, pendentes = 0;
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; resultado?: ResultadoDeBake; erro?: string }>) => {
      const espera = esperando.get(e.data.id); if (!espera) return;
      esperando.delete(e.data.id); cargas[espera.worker]!--; pendentes--;
      if (e.data.ok) espera.ok(e.data.resultado!); else espera.erro(new Error(e.data.erro));
    };
    workers.push(w); cargas.push(0);
  }
  const cache = new Map<string, Promise<ResultadoDeBake>>();

  const executar = (pedido: PedidoDeBake): Promise<ResultadoDeBake> => {
    pendentes++;
    if (!workers.length) return import('./executar.ts').then(m => m.executarBake(pedido)).finally(() => { pendentes--; });
    const escolhido = cargas.indexOf(Math.min(...cargas)), id = ++proximo;
    return new Promise<ResultadoDeBake>((ok, erro) => { esperando.set(id, { ok, erro, worker: escolhido }); cargas[escolhido]!++; workers[escolhido]!.postMessage({ id, pedido }); });
  };

  return {
    pedir(chave, pedido) {
      let p = cache.get(chave);
      if (!p) { p = executar(pedido); cache.set(chave, p); p.catch(() => cache.delete(chave)); }
      return p;
    },
    coletar(emUso) { for (const k of cache.keys()) if (!emUso.has(k)) cache.delete(k); },
    get pendentes() { return pendentes; },
    get noWorker() { return workers.length > 0; },
    encerrar() { for (const w of workers) w.terminate(); workers.length = 0; cache.clear(); },
  };
}
