import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarFilaDeBake, ErroDeBakeCancelado, prioridadePadraoDoPedido } from '../../src/procedural/baker.ts';

function esperar(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function criarExecutoresFalsos<T>(n: number, handler: (pedido: T, indice: number) => Promise<string>) {
  const ativos = new Array<number>(n).fill(0);
  const picos = new Array<number>(n).fill(0);
  const executores = Array.from({ length: n }, (_, i) => async (pedido: T): Promise<string> => {
    ativos[i]!++;
    picos[i] = Math.max(picos[i]!, ativos[i]!);
    try {
      return await handler(pedido, i);
    } finally {
      ativos[i]!--;
    }
  });
  return { executores, picos };
}

test('fila puxada com 2 executores: 4 pedidos de 10 ms terminam antes de 1 pedido de 100 ms', async () => {
  type Pedido = { nome: string; duracao: number };
  const concluidos: string[] = [];
  const { executores, picos } = criarExecutoresFalsos<Pedido>(2, async p => {
    await esperar(p.duracao);
    concluidos.push(p.nome);
    return p.nome;
  });

  const fila = criarFilaDeBake(executores);
  const pLongo = fila.pedir('longo', { nome: 'longo', duracao: 100 });
  const pCurtos = [1, 2, 3, 4].map(i =>
    fila.pedir(`curto-${i}`, { nome: `curto-${i}`, duracao: 10 }),
  );

  assert.equal(fila.pendentes, 5);
  await Promise.all(pCurtos);
  assert.deepEqual(concluidos, ['curto-1', 'curto-2', 'curto-3', 'curto-4']);

  await pLongo;
  assert.deepEqual(concluidos, ['curto-1', 'curto-2', 'curto-3', 'curto-4', 'longo']);
  assert.equal(fila.pendentes, 0);
  assert.deepEqual(picos, [1, 1]);
});

test('prioridade 0 passa na frente da 1 e da 2, mantendo FIFO na mesma prioridade', async () => {
  const liberadores: Array<() => void> = [];
  const iniciados: string[] = [];
  const { executores } = criarExecutoresFalsos<string>(2, async nome => {
    iniciados.push(nome);
    await new Promise<void>(resolve => liberadores.push(resolve));
    return nome;
  });

  const fila = criarFilaDeBake(executores);
  // Ocupa os 2 executores iniciais
  const p0 = fila.pedir('ocupado-0', 'ocupado-0', 1);
  const p1 = fila.pedir('ocupado-1', 'ocupado-1', 1);
  assert.deepEqual(iniciados, ['ocupado-0', 'ocupado-1']);

  // Enfileira pedidos em prioridades mistas
  const qA = fila.pedir('p2-a', 'p2-a', 2);
  const qB = fila.pedir('p1-a', 'p1-a', 1);
  const qC = fila.pedir('p0-a', 'p0-a', 0);
  const qD = fila.pedir('p1-b', 'p1-b', 1);
  const qE = fila.pedir('p0-b', 'p0-b', 0);
  const qF = fila.pedir('p2-b', 'p2-b', 2);

  // Libera os dois ocupados e vai liberando conforme entram
  liberadores.shift()!();
  liberadores.shift()!();
  await esperar(0);
  while (liberadores.length > 0) {
    liberadores.shift()!();
    await esperar(0);
  }

  await Promise.all([p0, p1, qA, qB, qC, qD, qE, qF]);
  assert.deepEqual(iniciados, [
    'ocupado-0',
    'ocupado-1',
    'p0-a',
    'p0-b',
    'p1-a',
    'p1-b',
    'p2-a',
    'p2-b',
  ]);
});

test('chaves iguais compartilham o mesmo trabalho e promovem prioridade enquanto na fila', async () => {
  const liberadores: Array<() => void> = [];
  const iniciados: string[] = [];
  let execucoes = 0;

  const { executores } = criarExecutoresFalsos<string>(1, async nome => {
    execucoes++;
    iniciados.push(nome);
    await new Promise<void>(resolve => liberadores.push(resolve));
    return `ok:${nome}`;
  });

  const fila = criarFilaDeBake(executores);
  const pOcupado = fila.pedir('ocupado', 'ocupado', 0);
  const pBaixo = fila.pedir('alvo', 'alvo', 2);
  const pOutro = fila.pedir('medio', 'medio', 1);

  // Requisita a mesma chave que ainda está na fila com prioridade melhor (0 < 2)
  const pPromovido = fila.pedir('alvo', 'alvo', 0);
  assert.equal(pBaixo, pPromovido);

  while (liberadores.length > 0 || fila.pendentes > 0) {
    if (liberadores.length > 0) liberadores.shift()!();
    await esperar(0);
  }

  const [r1, r2] = await Promise.all([pBaixo, pPromovido, pOcupado, pOutro]);
  assert.equal(r1, 'ok:alvo');
  assert.equal(r2, 'ok:alvo');
  assert.equal(execucoes, 3);
  assert.deepEqual(iniciados, ['ocupado', 'alvo', 'medio']);
});

test('falha em um pedido libera o executor e limpa o cache para nova tentativa', async () => {
  let tentativas = 0;
  const { executores } = criarExecutoresFalsos<string>(1, async nome => {
    if (nome === 'instavel' && tentativas++ === 0) throw new Error('falhou');
    return `ok:${nome}`;
  });

  const fila = criarFilaDeBake(executores);
  await assert.rejects(() => fila.pedir('instavel', 'instavel'), /falhou/);
  assert.equal(fila.pendentes, 0);

  const r = await fila.pedir('instavel', 'instavel');
  assert.equal(r, 'ok:instavel');
  assert.equal(tentativas, 2);
});

test('prioridade padrão por tipo de pedido segue a tabela chão < objetos < telhados', () => {
  assert.equal(prioridadePadraoDoPedido('terreno'), 0);
  assert.equal(prioridadePadraoDoPedido('comodo'), 0);
  assert.equal(prioridadePadraoDoPedido('escarpa'), 0);
  assert.equal(prioridadePadraoDoPedido('objeto'), 1);
  assert.equal(prioridadePadraoDoPedido('gerado'), 1);
  assert.equal(prioridadePadraoDoPedido('imagem'), 1);
  assert.equal(prioridadePadraoDoPedido('sprite'), 1);
  assert.equal(prioridadePadraoDoPedido('cobertura'), 2);
  assert.equal(prioridadePadraoDoPedido('detalhe-de-telhado'), 2);
});

test('coletar remove da fila o que saiu de uso, rejeita com ErroDeBakeCancelado e preserva o que está em uso', async () => {
  const liberadores: Array<() => void> = [];
  const iniciados: string[] = [];
  const { executores } = criarExecutoresFalsos<string>(1, async nome => {
    iniciados.push(nome);
    await new Promise<void>(resolve => liberadores.push(resolve));
    return `ok:${nome}`;
  });
  const fila = criarFilaDeBake(executores);
  const pOcupado = fila.pedir('ocupado', 'ocupado', 0);
  const pVelho = fila.pedir('velho', 'velho', 0);
  const pAtual = fila.pedir('atual', 'atual', 1);
  const rejeicao = assert.rejects(pVelho, (e: unknown) => e instanceof ErroDeBakeCancelado && e.name === 'BakeCancelado');

  fila.coletar(new Set(['ocupado', 'atual']));
  await rejeicao;
  assert.equal(fila.pendentes, 2);

  while (liberadores.length > 0 || fila.pendentes > 0) {
    if (liberadores.length > 0) liberadores.shift()!();
    await esperar(0);
  }
  assert.equal(await pOcupado, 'ok:ocupado');
  assert.equal(await pAtual, 'ok:atual');
  assert.deepEqual(iniciados, ['ocupado', 'atual']);
});

test('consulta de cache cancelada por coletar não enfileira trabalho e descarta o resultado', async () => {
  let liberarConsulta!: (v: string | null) => void;
  const descartados: string[] = [];
  let execucoes = 0;
  const { executores } = criarExecutoresFalsos<string>(1, async nome => { execucoes++; return `ok:${nome}`; });
  const fila = criarFilaDeBake(executores, () => 1, {
    consultarCache: () => new Promise<string | null>(resolve => { liberarConsulta = resolve; }),
    descartar: r => descartados.push(r),
  });
  const p = fila.pedir('a', 'a');
  const rejeicao = assert.rejects(p, ErroDeBakeCancelado);
  await esperar(0);
  assert.equal(fila.pendentes, 1);

  fila.coletar(new Set());
  await rejeicao;
  assert.equal(fila.pendentes, 0);
  liberarConsulta('do-cache');
  await esperar(5);
  assert.equal(execucoes, 0);
  assert.deepEqual(descartados, ['do-cache']);
  assert.equal(fila.pendentes, 0);
});

test('repriorizar sobe e desce a prioridade de quem ainda espera na fila', async () => {
  const ordem: string[] = [];
  const { executores } = criarExecutoresFalsos<string>(1, async p => { await esperar(5); ordem.push(p); return p; });
  const fila = criarFilaDeBake(executores);
  const ocupa = fila.pedir('ocupa', 'ocupa', 0);        // ocupa o único executor
  const a = fila.pedir('a', 'a', 1), b = fila.pedir('b', 'b', 5), c = fila.pedir('c', 'c', 3);
  fila.repriorizar('b', 0);                              // sobe: passa à frente
  fila.repriorizar('a', 9);                              // desce: vai para o fim
  fila.repriorizar('inexistente', 0);                    // no-op
  await Promise.all([ocupa, a, b, c]);
  assert.deepEqual(ordem, ['ocupa', 'b', 'c', 'a']);
});
