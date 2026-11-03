import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aceitarProposta, novaProposta, previaDaProposta } from '../../src/authoring/proposta.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ErroDeComando, type Comando } from '../../src/state/comandos.ts';
import { criarStore } from '../../src/state/store.ts';

const add = (id: string): Comando => ({ tipo: 'item.adicionar', colecao: 'props', item: novoObjeto([1, 1], { id }) as never });
const nova = (versao: number, comandos: Comando[]) => novaProposta({ tipo: 'teste', rotulo: 'Mobiliar a Sala', comandos, versaoEsperada: versao, roomId: null, semente: 0 });

test('aceitar três itens é uma entrada de histórico com o rótulo da proposta, e um desfazer tira os três', () => {
  const store = criarStore(criarMapa({ id: 'm', agora: 1 }));
  aceitarProposta(store, nova(store.versaoEdicao, [add('a'), add('b'), add('c')]));
  assert.deepEqual(Object.keys(store.documento.props), ['a', 'b', 'c']);
  assert.deepEqual(store.historico, ['Mobiliar a Sala']);
  store.desfazer(); assert.deepEqual(store.documento.props, {}); assert.equal(store.historico.length, 0);
  store.refazer(); assert.equal(Object.keys(store.documento.props).length, 3);
});

test('com a versão antiga o mapa mudou: recusa e não aplica nada', () => {
  const store = criarStore(criarMapa({ id: 'm', agora: 1 })), p = nova(store.versaoEdicao, [add('a')]);
  store.executar({ tipo: 'mapa.renomear', nome: 'Outro' });
  assert.throws(() => aceitarProposta(store, p), /gere a sugestão novamente/);
  assert.deepEqual(store.documento.props, {}); assert.deepEqual(store.historico, ['Renomear mapa']);
});

test('um comando inválido no meio não deixa nada aplicado', () => {
  const store = criarStore(criarMapa({ id: 'm', agora: 1 })), antes = store.documento;
  assert.throws(() => aceitarProposta(store, nova(store.versaoEdicao, [add('a'), { tipo: 'item.remover', colecao: 'props', id: 'nao-existe' }])), ErroDeComando);
  assert.equal(store.documento, antes); assert.equal(store.historico.length, 0);
});

test('proposta vazia ou aninhada é recusada', () => {
  const m = criarMapa({ id: 'm', agora: 1 });
  assert.throws(() => previaDaProposta(m, nova(0, [])), /vazia/);
  assert.throws(() => previaDaProposta(m, nova(0, [{ tipo: 'proposta.aceitar', rotulo: 'x', comandos: [add('a')] }])), /outra/);
});

test('a prévia mostra o mapa como ficaria sem mexer no store', () => {
  const store = criarStore(criarMapa({ id: 'm', agora: 1 })), v = store.versaoEdicao;
  const previa = previaDaProposta(store.documento, nova(v, [add('a'), add('b')]));
  assert.equal(Object.keys(previa.props).length, 2); assert.deepEqual(store.documento.props, {}); assert.equal(store.versaoEdicao, v);
});
