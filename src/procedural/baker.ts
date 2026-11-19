import type { PedidoDeBake, ResultadoDeBake } from './executar.ts';

/**
 * Cliente do trabalho pesado de pintura: fila, workers e cache por chave. A página mostra o resultado anterior enquanto o
 * novo não chega (quem chama guarda o que já tinha). Sem worker ou sem OffscreenCanvas, pinta na própria página.
 */
export interface Baker {
  /** Pede (ou reaproveita) o resultado da `chave`. Chaves iguais compartilham o mesmo trabalho. */
  pedir(chave: string, pedido: PedidoDeBake, prioridade?: number): Promise<ResultadoDeBake>;
  /** Esquece as chaves que não estão em `emUso`. */
  coletar(emUso: ReadonlySet<string>): void;
  readonly pendentes: number;
  readonly noWorker: boolean;
  encerrar(): void;
}

export interface FilaDeBake<TPedido, TResultado> {
  pedir(chave: string, pedido: TPedido, prioridade?: number): Promise<TResultado>;
  coletar(emUso: ReadonlySet<string>): void;
  readonly pendentes: number;
  encerrar(): void;
}

/** Prioridade padrão por tipo de assado: chão (0) antes de objetos/imagens (1), que vêm antes de telhados (2). */
export function prioridadePadraoDoPedido(tipo: PedidoDeBake['tipo']): number {
  if (tipo === 'terreno' || tipo === 'comodo' || tipo === 'escarpa') return 0;
  if (tipo === 'cobertura' || tipo === 'detalhe-de-telhado') return 2;
  return 1;
}

/**
 * Fila puxada pura (sem dependência de `Worker`): cada executor livre pega o próximo pedido de menor `prioridade`
 * (FIFO dentro da mesma prioridade) e executa no máximo um pedido por vez. Chaves iguais compartilham a mesma Promise.
 */
export function criarFilaDeBake<TPedido, TResultado>(
  executores: readonly ((pedido: TPedido) => Promise<TResultado>)[],
  prioridadePadrao: (pedido: TPedido) => number = () => 1,
): FilaDeBake<TPedido, TResultado> {
  if (!executores.length) throw new Error('Fila de bake precisa de ao menos 1 executor.');
  interface ItemNaFila {
    chave: string;
    pedido: TPedido;
    prioridade: number;
    ordem: number;
    resolver: (r: TResultado) => void;
    rejeitar: (e: unknown) => void;
  }

  const cache = new Map<string, Promise<TResultado>>();
  const fila: ItemNaFila[] = [];
  const naFilaPorChave = new Map<string, ItemNaFila>();
  const ocupado = new Array<boolean>(executores.length).fill(false);
  let proximoOrdem = 0;
  let emExecucao = 0;
  let encerrada = false;

  function despachar(): void {
    if (encerrada) return;
    while (fila.length > 0) {
      const livre = ocupado.indexOf(false);
      if (livre < 0) break;
      let melhorIdx = 0;
      for (let i = 1; i < fila.length; i++) {
        const a = fila[i]!, b = fila[melhorIdx]!;
        if (a.prioridade < b.prioridade || (a.prioridade === b.prioridade && a.ordem < b.ordem)) {
          melhorIdx = i;
        }
      }
      const item = fila.splice(melhorIdx, 1)[0]!;
      if (naFilaPorChave.get(item.chave) === item) naFilaPorChave.delete(item.chave);
      ocupado[livre] = true;
      emExecucao++;
      let p: Promise<TResultado>;
      try {
        p = executores[livre]!(item.pedido);
      } catch (erro) {
        p = Promise.reject(erro);
      }
      p.then(
        r => {
          ocupado[livre] = false;
          emExecucao--;
          despachar();
          item.resolver(r);
        },
        erro => {
          ocupado[livre] = false;
          emExecucao--;
          despachar();
          item.rejeitar(erro);
        },
      );
    }
  }

  return {
    pedir(chave, pedido, prioridade = prioridadePadrao(pedido)) {
      if (encerrada) return Promise.reject(new Error('Baker encerrado.'));
      const existente = cache.get(chave);
      if (existente) {
        const pendente = naFilaPorChave.get(chave);
        if (pendente && prioridade < pendente.prioridade) {
          pendente.prioridade = prioridade;
          pendente.ordem = ++proximoOrdem;
        }
        return existente;
      }
      const p = new Promise<TResultado>((resolver, rejeitar) => {
        const item: ItemNaFila = { chave, pedido, prioridade, ordem: ++proximoOrdem, resolver, rejeitar };
        fila.push(item);
        naFilaPorChave.set(chave, item);
      });
      cache.set(chave, p);
      p.catch(() => {
        if (cache.get(chave) === p) cache.delete(chave);
      });
      despachar();
      return p;
    },
    coletar(emUso) {
      for (const k of cache.keys()) if (!emUso.has(k)) cache.delete(k);
    },
    get pendentes() { return emExecucao + fila.length; },
    encerrar() {
      encerrada = true;
      cache.clear();
      naFilaPorChave.clear();
      const erro = new Error('Baker encerrado.');
      while (fila.length > 0) fila.shift()!.rejeitar(erro);
    },
  };
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
  const padrao = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 3) - 1));
  const n = usarWorker ? Math.max(1, opcoes.workers ?? padrao) : 0;
  const workers: Worker[] = [];
  const esperando = new Map<number, { ok: (r: ResultadoDeBake) => void; erro: (e: Error) => void; tipo: PedidoDeBake['tipo'] }>();
  let proximo = 0;

  for (let i = 0; i < n; i++) {
    const w = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; resultado?: ResultadoDeBake; erro?: string; ms?: number }>) => {
      const espera = esperando.get(e.data.id); if (!espera) return;
      esperando.delete(e.data.id);
      if (e.data.ok) {
        const r = e.data.resultado!;
        registrarAssado(espera.tipo, e.data.ms ?? 0, r.bitmap.width * r.bitmap.height);
        espera.ok(r);
      } else {
        registrarAssado(espera.tipo, e.data.ms ?? 0, 0);
        espera.erro(new Error(e.data.erro));
      }
    };
    workers.push(w);
  }

  const executores: ((pedido: PedidoDeBake) => Promise<ResultadoDeBake>)[] = workers.length
    ? workers.map(w => (pedido: PedidoDeBake) => {
        const id = ++proximo;
        return new Promise<ResultadoDeBake>((ok, erro) => {
          esperando.set(id, { ok, erro, tipo: pedido.tipo });
          w.postMessage({ id, pedido });
        });
      })
    : [
        async (pedido: PedidoDeBake) => {
          const t0 = performance.now();
          try {
            const m = await import('./executar.ts');
            const r = await m.executarBake(pedido);
            registrarAssado(pedido.tipo, performance.now() - t0, r.bitmap.width * r.bitmap.height);
            return r;
          } catch (err) {
            registrarAssado(pedido.tipo, performance.now() - t0, 0);
            throw err;
          }
        },
      ];

  const fila = criarFilaDeBake(executores, p => prioridadePadraoDoPedido(p.tipo));

  return {
    pedir(chave, pedido, prioridade) {
      return fila.pedir(chave, pedido, prioridade);
    },
    coletar(emUso) { fila.coletar(emUso); },
    get pendentes() { return fila.pendentes; },
    get noWorker() { return workers.length > 0; },
    encerrar() {
      fila.encerrar();
      for (const w of workers) w.terminate();
      workers.length = 0;
      for (const espera of esperando.values()) espera.erro(new Error('Baker encerrado.'));
      esperando.clear();
    },
  };
}
