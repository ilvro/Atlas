import type { PedidoDeBake, ResultadoDeBake } from './executar.ts';
import { baseDasTexturas } from './texturas-carregadas.ts';
import {
  cacheDeAssadosPadrao,
  cachePersistenteAtivo,
  pedidoCacheavel,
  type CacheDeAssados,
  type ResultadoComExtras,
} from './cache-de-assados.ts';

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

export interface OpcoesFilaDeBake<TPedido, TResultado> {
  consultarCache?: (chave: string, pedido: TPedido) => Promise<TResultado | null>;
  podeCachear?: (pedido: TPedido) => boolean;
}

/** Prioridade padrão por tipo de assado: chão (0) antes de objetos/imagens (1), que vêm antes de telhados (2). */
export function prioridadePadraoDoPedido(tipo: PedidoDeBake['tipo']): number {
  if (tipo === 'terreno' || tipo === 'comodo' || tipo === 'escarpa') return 0;
  if (tipo === 'cobertura' || tipo === 'detalhe-de-telhado' || tipo === 'telhado') return 2;
  return 1;
}

/**
 * Fila puxada pura (sem dependência de `Worker`): cada executor livre pega o próximo pedido de menor `prioridade`
 * (FIFO dentro da mesma prioridade) e executa no máximo um pedido por vez. Chaves iguais compartilham a mesma Promise.
 */
export function criarFilaDeBake<TPedido, TResultado>(
  executores: readonly ((pedido: TPedido, chave: string) => Promise<TResultado>)[],
  prioridadePadrao: (pedido: TPedido) => number = () => 1,
  opcoes: OpcoesFilaDeBake<TPedido, TResultado> = {},
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
  interface ConsultaPendente {
    prioridade: number;
    rejeitar: (e: unknown) => void;
  }

  const cache = new Map<string, Promise<TResultado>>();
  const fila: ItemNaFila[] = [];
  const naFilaPorChave = new Map<string, ItemNaFila>();
  const consultandoPorChave = new Map<string, ConsultaPendente>();
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
        p = executores[livre]!(item.pedido, item.chave);
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
        const consulta = consultandoPorChave.get(chave);
        if (consulta && prioridade < consulta.prioridade) {
          consulta.prioridade = prioridade;
        }
        return existente;
      }

      const consultar = opcoes.consultarCache;
      const cacheavel = !opcoes.podeCachear || opcoes.podeCachear(pedido);
      const p = new Promise<TResultado>((resolver, rejeitar) => {
        const enfileirar = (prio: number) => {
          const item: ItemNaFila = { chave, pedido, prioridade: prio, ordem: ++proximoOrdem, resolver, rejeitar };
          fila.push(item);
          naFilaPorChave.set(chave, item);
          despachar();
        };
        if (consultar && cacheavel) {
          const consulta: ConsultaPendente = { prioridade, rejeitar };
          consultandoPorChave.set(chave, consulta);
          Promise.resolve()
            .then(() => consultar(chave, pedido))
            .then(
              hit => {
                if (consultandoPorChave.get(chave) === consulta) consultandoPorChave.delete(chave);
                if (encerrada) { rejeitar(new Error('Baker encerrado.')); return; }
                if (hit !== null) { resolver(hit); return; }
                enfileirar(consulta.prioridade);
              },
              () => {
                if (consultandoPorChave.get(chave) === consulta) consultandoPorChave.delete(chave);
                if (encerrada) { rejeitar(new Error('Baker encerrado.')); return; }
                enfileirar(consulta.prioridade);
              },
            );
        } else {
          enfileirar(prioridade);
        }
      });

      cache.set(chave, p);
      p.catch(() => {
        if (cache.get(chave) === p) cache.delete(chave);
      });
      return p;
    },
    coletar(emUso) {
      for (const k of cache.keys()) if (!emUso.has(k)) cache.delete(k);
    },
    get pendentes() { return emExecucao + fila.length + consultandoPorChave.size; },
    encerrar() {
      encerrada = true;
      cache.clear();
      naFilaPorChave.clear();
      const erro = new Error('Baker encerrado.');
      for (const c of consultandoPorChave.values()) c.rejeitar(erro);
      consultandoPorChave.clear();
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

async function clonarResultadoParaCache(r: ResultadoComExtras): Promise<ResultadoComExtras | null> {
  if (typeof createImageBitmap !== 'function') return r;
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
      ...(r.agua && aguaBmp ? { agua: { bitmap: aguaBmp, res: r.agua.res, ...(r.agua.origem ? { origem: r.agua.origem } : {}) } } : {}),
      ...(normal ? { normal } : {}),
      ...(fachada ? { fachada } : {}),
    };
  } catch {
    for (const bmp of abertos) bmp.close();
    return null;
  }
}

function fecharCopia(copia: ResultadoComExtras): void {
  copia.bitmap.close?.();
  copia.altura?.close?.();
  copia.agua?.bitmap.close?.();
  copia.normal?.close?.();
  copia.fachada?.close?.();
}

/** Quantas falhas seguidas de worker o baker tolera antes de ficar quebrado. */
export const MAX_FALHAS_DE_WORKER = 3;

/** Workers de baker encerrado que o próximo viewport reaproveita em vez de subir threads novas. */
const workersOciosos: Worker[] = [];
const MAX_WORKERS_OCIOSOS = 6;
/** Contador de pedidos entre todos os bakers: um worker reaproveitado pode ainda responder um id antigo, que não pode colidir com um novo. */
let proximoGlobal = 0;

export function criarBaker(opcoes: { workers?: number; cache?: CacheDeAssados | null; reaproveitarWorkers?: boolean } = {}): Baker {
  const usarWorker = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
  const padrao = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 3) - 1));
  const n = usarWorker ? Math.max(1, opcoes.workers ?? padrao) : 0;
  const cache =
    opcoes.cache !== undefined
      ? opcoes.cache
      : cachePersistenteAtivo() && typeof indexedDB !== 'undefined'
        ? cacheDeAssadosPadrao()
        : null;
  const workers: (Worker | null)[] = new Array<Worker | null>(n).fill(null);
  const esperando = new Map<number, { ok: (r: ResultadoDeBake) => void; erro: (e: Error) => void; tipo: PedidoDeBake['tipo']; indice: number }>();
  let encerrado = false;
  /** Falhas seguidas de worker (zera quando um worker responde). Na `MAX_FALHAS_DE_WORKER`-ésima o baker fica quebrado. */
  let falhasSeguidas = 0;
  let quebrado = false;

  /** O worker morreu (falha de import, erro não tratado, mensagem ilegível): rejeita o que estava nele e o descarta; o próximo `pedir` cria outro. */
  function workerFalhou(indice: number, w: Worker, motivo: string): void {
    if (workers[indice] !== w) return;
    workers[indice] = null;
    w.terminate();
    const erro = new Error(`O worker de pintura falhou: ${motivo}`);
    for (const [id, espera] of [...esperando]) {
      if (espera.indice !== indice) continue;
      esperando.delete(id);
      espera.erro(erro);
    }
    if (++falhasSeguidas >= MAX_FALHAS_DE_WORKER && !quebrado) {
      quebrado = true;
      console.warn('A pintura do Atlas parou (miniaturas ou mapa); recarregue a página (Ctrl+Shift+R).', motivo);
    }
  }

  function garantirWorker(indice: number): Worker {
    let w = workers[indice];
    if (!w) {
      w = (opcoes.reaproveitarWorkers && workersOciosos.pop()) || new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
      const criado = w;
      w.onerror = (e: ErrorEvent) => workerFalhou(indice, criado, e.message || 'erro ao carregar o worker');
      w.onmessageerror = () => workerFalhou(indice, criado, 'mensagem ilegível');
      w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; resultado?: ResultadoDeBake; erro?: string; ms?: number }>) => {
        falhasSeguidas = 0;
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
      workers[indice] = w;
    }
    return w;
  }

  const executores: ((pedido: PedidoDeBake, chave: string) => Promise<ResultadoDeBake>)[] = n > 0
    ? Array.from({ length: n }, (_, i) => (pedido: PedidoDeBake, chave: string) => {
        if (quebrado) return Promise.reject(new Error('O worker de pintura quebrou; recarregue a página.'));
        const w = garantirWorker(i);
        const id = ++proximoGlobal;
        return new Promise<ResultadoDeBake>((ok, erro) => {
          esperando.set(id, { ok, erro, tipo: pedido.tipo, indice: i });
          const pedidoNoWorker = pedido.tipo === 'terreno' && !pedido.baseTexturas ? { ...pedido, baseTexturas: baseDasTexturas() } : pedido;
          w.postMessage({
            id,
            pedido: pedidoNoWorker,
            ...(cache && pedidoCacheavel(pedido) ? { cacheChave: chave } : {}),
          });
        });
      })
    : [
        async (pedido: PedidoDeBake, chave: string) => {
          const t0 = performance.now();
          try {
            const m = await import('./executar.ts');
            const r = (await m.executarBake(pedido)) as ResultadoComExtras;
            registrarAssado(pedido.tipo, performance.now() - t0, r.bitmap.width * r.bitmap.height);
            if (cache && pedidoCacheavel(pedido)) {
              void clonarResultadoParaCache(r)
                .then(copia => {
                  if (!copia) return;
                  return cache.gravar(chave, copia).finally(() => {
                    if (copia !== r) fecharCopia(copia);
                  });
                })
                .catch(() => {});
            }
            return r;
          } catch (err) {
            registrarAssado(pedido.tipo, performance.now() - t0, 0);
            throw err;
          }
        },
      ];

  const fila = criarFilaDeBake(executores, p => prioridadePadraoDoPedido(p.tipo), {
    consultarCache: cache ? chave => cache.obter(chave) : undefined,
    podeCachear: pedidoCacheavel,
  });

  return {
    pedir(chave, pedido, prioridade) {
      return fila.pedir(chave, pedido, prioridade);
    },
    coletar(emUso) { fila.coletar(emUso); },
    get pendentes() { return fila.pendentes; },
    get noWorker() { return n > 0 && !encerrado; },
    encerrar() {
      encerrado = true;
      fila.encerrar();
      for (const w of workers) {
        if (!w) continue;
        if (opcoes.reaproveitarWorkers && workersOciosos.length < MAX_WORKERS_OCIOSOS) { w.onmessage = w.onerror = w.onmessageerror = null; workersOciosos.push(w); }
        else w.terminate();
      }
      workers.length = 0;
      for (const espera of esperando.values()) espera.erro(new Error('Baker encerrado.'));
      esperando.clear();
    },
  };
}
