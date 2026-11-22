import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBaker, MAX_FALHAS_DE_WORKER } from '../../src/procedural/baker.ts';
import type { PedidoDeBake } from '../../src/procedural/executar.ts';

class WorkerFalso {
  static todos: WorkerFalso[] = [];
  onerror: ((e: { message: string }) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postado: { id: number }[] = [];
  terminado = false;
  constructor() { WorkerFalso.todos.push(this); }
  postMessage(m: { id: number }) { this.postado.push(m); }
  terminate() { this.terminado = true; }
}

const pedido = (n: number): PedidoDeBake => ({ tipo: 'objeto', receita: 'x', params: {}, seed: n, res: 8, estilo: 'illustrated' });
const g = globalThis as Record<string, unknown>;

async function comWorkersFalsos(fn: () => Promise<void>): Promise<void> {
  const antes = { Worker: g.Worker, OffscreenCanvas: g.OffscreenCanvas };
  g.Worker = WorkerFalso; g.OffscreenCanvas = class {};
  WorkerFalso.todos = [];
  try { await fn(); } finally { g.Worker = antes.Worker; g.OffscreenCanvas = antes.OffscreenCanvas; }
}
const tick = () => new Promise(r => setTimeout(r, 5));

test('baker: erro do worker rejeita a tarefa pendente e a seguinte cria um worker novo', async () => {
  await comWorkersFalsos(async () => {
    const baker = criarBaker({ workers: 1, cache: null });
    const a = baker.pedir('a', pedido(1));
    await tick();
    assert.equal(WorkerFalso.todos.length, 1);
    WorkerFalso.todos[0]!.onerror!({ message: '504 Outdated Optimize Dep' });
    await assert.rejects(a, /504/);
    assert.ok(WorkerFalso.todos[0]!.terminado);
    const b = baker.pedir('b', pedido(2));
    await tick();
    assert.equal(WorkerFalso.todos.length, 2);
    WorkerFalso.todos[1]!.onmessage!({ data: { id: WorkerFalso.todos[1]!.postado[0]!.id, ok: true, resultado: { bitmap: { width: 1, height: 1 } } } });
    await b;
    baker.encerrar();
  });
});

test('baker: depois de falhas seguidas fica quebrado, avisa uma vez e rejeita na hora', async () => {
  await comWorkersFalsos(async () => {
    const avisos: unknown[][] = [];
    const warn = console.warn; console.warn = (...a: unknown[]) => { avisos.push(a); };
    try {
      const baker = criarBaker({ workers: 1, cache: null });
      for (let i = 0; i < MAX_FALHAS_DE_WORKER; i++) {
        const p = baker.pedir(`k${i}`, pedido(i));
        await tick();
        WorkerFalso.todos[i]!.onerror!({ message: 'x' });
        await assert.rejects(p);
      }
      assert.equal(avisos.length, 1);
      assert.match(String(avisos[0]![0]), /pintura do Atlas parou/);
      await assert.rejects(baker.pedir('depois', pedido(9)), /quebrou/);
      assert.equal(WorkerFalso.todos.length, MAX_FALHAS_DE_WORKER);
      assert.equal(avisos.length, 1);
      baker.encerrar();
    } finally { console.warn = warn; }
  });
});

test('previa: promessa rejeitada sai do cache e a próxima pedida tenta de novo', async () => {
  const { pedirPrevia, _usarBakerDasPrevias } = await import('../../src/ui/previa.ts');
  let chamadas = 0;
  const falso = {
    pedir: () => (++chamadas === 1 ? Promise.reject(new Error('morreu')) : Promise.resolve({ bitmap: {}, origem: [0, 0], res: 1 })),
    coletar() {}, pendentes: 0, noWorker: true, encerrar() {},
  };
  _usarBakerDasPrevias(falso as never);
  await assert.rejects(pedirPrevia('qualquer'), /morreu/);
  await tick();
  await pedirPrevia('qualquer');
  assert.equal(chamadas, 2);
  _usarBakerDasPrevias(null);
});
