import { test } from 'node:test';
import assert from 'node:assert/strict';
import { definirValor, iniciar, ordenar, passo, podar } from '../../src/domain/iniciativa.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { aplicarComando, ErroDeComando } from '../../src/state/comandos.ts';

const E = (tokenId: string, value: number) => ({ tokenId, value });
const ids = (ini: { order: { tokenId: string }[] }) => ini.order.map(x => x.tokenId).join('');

test('ordena do maior para o menor, e o empate mantém a ordem de entrada', () => {
  assert.equal(ids({ order: ordenar([E('a', 10), E('b', 15), E('c', 10), E('d', 20)]) }), 'dbac');
  const ini = iniciar([E('a', '12' as never), E('b', 'x' as never)]);
  assert.deepEqual(ini, { order: [E('a', 12), E('b', 0)], current: 0, round: 1 });
});

test('passar da última peça sobe a rodada; voltar da primeira desce, sem passar de 1', () => {
  let ini = iniciar([E('a', 3), E('b', 2), E('c', 1)]);
  ini = passo(ini); ini = passo(ini); assert.equal(ini.current, 2); assert.equal(ini.round, 1);
  ini = passo(ini); assert.equal(ini.current, 0); assert.equal(ini.round, 2);
  ini = passo(ini, -1); assert.equal(ini.current, 2); assert.equal(ini.round, 1);
  ini = { ...ini, current: 0 }; ini = passo(ini, -1); assert.equal(ini.round, 1, 'a rodada nunca fica abaixo de 1');
  assert.equal(passo({ order: [], current: 0, round: 1 }).round, 1);
});

test('mudar um valor reordena e a vez fica na mesma peça', () => {
  let ini = iniciar([E('a', 10), E('b', 5), E('c', 1)]);
  ini = passo(ini); // vez de b
  ini = definirValor(ini, 'c', 20);
  assert.equal(ids(ini), 'cab'); assert.equal(ini.order[ini.current]!.tokenId, 'b');
});

test('antes de alguém jogar, a vez fica no topo ao mexer nos valores', () => {
  let ini = iniciar([E('a', 10), E('b', 5)]);
  ini = definirValor(ini, 'b', 30);
  assert.equal(ids(ini), 'ba'); assert.equal(ini.current, 0);
});

test('podar tira peças que sumiram e mantém a vez na sua peça', () => {
  const ini = { ...iniciar([E('a', 3), E('b', 2), E('c', 1)]), current: 2 };
  const sem = podar(ini, t => t !== 'a')!;
  assert.equal(ids(sem), 'bc'); assert.equal(sem.order[sem.current]!.tokenId, 'c');
  const semVez = podar({ ...ini, current: 1 }, t => t !== 'b')!;
  assert.equal(semVez.current, 1);
  assert.equal(podar(ini, () => true), ini);
  assert.equal(podar(ini, () => false), null);
  assert.equal(podar(null, () => true), null);
});

function mapaComPecas(): MapaAtlas {
  let m = criarMapa();
  for (const id of ['a', 'b', 'c']) m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([1, 1]), id } as never });
  return m;
}

test('os comandos conduzem a iniciativa e removem a peça que sai', () => {
  let m = mapaComPecas();
  m = aplicarComando(m, { tipo: 'iniciativa.iniciar', entradas: [E('a', 5), E('b', 15), E('c', 10)] });
  assert.equal(ids(m.session.initiative!), 'bca');
  m = aplicarComando(m, { tipo: 'iniciativa.passo', passo: 1 });
  m = aplicarComando(m, { tipo: 'iniciativa.valor', tokenId: 'a', value: 30 });
  assert.equal(ids(m.session.initiative!), 'abc'); assert.equal(m.session.initiative!.order[m.session.initiative!.current]!.tokenId, 'c');
  m = aplicarComando(m, { tipo: 'item.remover', colecao: 'tokens', id: 'c' });
  assert.equal(ids(m.session.initiative!), 'ab');
  m = aplicarComando(m, { tipo: 'iniciativa.encerrar' });
  assert.equal(m.session.initiative, null);
});

test('os comandos recusam peça inexistente, repetida, valor ruim e iniciativa que não existe', () => {
  const m = mapaComPecas();
  assert.throws(() => aplicarComando(m, { tipo: 'iniciativa.iniciar', entradas: [] }), ErroDeComando);
  assert.throws(() => aplicarComando(m, { tipo: 'iniciativa.iniciar', entradas: [E('z', 1)] }), ErroDeComando);
  assert.throws(() => aplicarComando(m, { tipo: 'iniciativa.iniciar', entradas: [E('a', 1), E('a', 2)] }), ErroDeComando);
  assert.throws(() => aplicarComando(m, { tipo: 'iniciativa.iniciar', entradas: [E('a', 1000)] }), ErroDeComando);
  assert.throws(() => aplicarComando(m, { tipo: 'iniciativa.passo', passo: 1 }), ErroDeComando);
  assert.throws(() => aplicarComando(m, { tipo: 'iniciativa.encerrar' }), ErroDeComando);
  const com = aplicarComando(m, { tipo: 'iniciativa.iniciar', entradas: [E('a', 1)] });
  assert.throws(() => aplicarComando(com, { tipo: 'iniciativa.valor', tokenId: 'b', value: 1 }), ErroDeComando);
});
