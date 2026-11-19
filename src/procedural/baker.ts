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

type AssadoMedido = { tipo: PedidoDeBake['tipo']; ms: number; px: number };
type GlobalMedicao = { __atlasMedirAssados?: boolean; __atlasAssados?: AssadoMedido[] };

function registrarAssado(tipo: PedidoDeBake['tipo'], ms: number, px: number): void {
  const g = globalThis as unknown as GlobalMedicao;
  if (!g.__atlasMedirAssados) return;
  (g.__atlasAssados ??= []).push({ tipo, ms, px });
}

export function criarBaker(opcoes: { workers?: number } = {}): Baker {
  const usarWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  const n = usarWorker ? Math.max(1, Math.min(opcoes.workers ?? 2, navigator.hardwareConcurrency ? Math.max(1, navigator.hardwareConcurrency - 1) : 2)) : 0;
  const workers: Worker[] = [], cargas: number[] = [], esperando = new Map<number, { ok: (r: ResultadoDeBake) => void; erro: (e: Error) => void; worker: number; tipo: PedidoDeBake['tipo'] }>();
  let proximo = 0, pendentes = 0;
  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; resultado?: ResultadoDeBake; erro?: string; ms?: number }>) => {
      const espera = esperando.get(e.data.id); if (!espera) return;
      esperando.delete(e.data.id); cargas[espera.worker]!--; pendentes--;
      if (e.data.ok) {
        const r = e.data.resultado!;
        registrarAssado(espera.tipo, e.data.ms ?? 0, r.bitmap.width * r.bitmap.height);
        espera.ok(r);
      } else {
        registrarAssado(espera.tipo, e.data.ms ?? 0, 0);
        espera.erro(new Error(e.data.erro));
      }
    };
    workers.push(w); cargas.push(0);
  }
  const cache = new Map<string, Promise<ResultadoDeBake>>();

  const executar = (pedido: PedidoDeBake): Promise<ResultadoDeBake> => {
    pendentes++;
    if (!workers.length) {
      const t0 = performance.now();
      return import('./executar.ts')
        .then(m => m.executarBake(pedido))
        .then(
          r => { registrarAssado(pedido.tipo, performance.now() - t0, r.bitmap.width * r.bitmap.height); return r; },
          err => { registrarAssado(pedido.tipo, performance.now() - t0, 0); throw err; },
        )
        .finally(() => { pendentes--; });
    }
    const escolhido = cargas.indexOf(Math.min(...cargas)), id = ++proximo;
    return new Promise<ResultadoDeBake>((ok, erro) => { esperando.set(id, { ok, erro, worker: escolhido, tipo: pedido.tipo }); cargas[escolhido]!++; workers[escolhido]!.postMessage({ id, pedido }); });
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
