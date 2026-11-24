import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa } from '../../src/domain/mapa.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { idDaLuzPropria } from '../../src/domain/luz-propria.ts';

const cogumelo = (params: Record<string, unknown> = {}) => novoObjeto([5, 5], { source: ACERVO.fonte('cogumelo-gigante', 7, params) });
const donas = (m: ReturnType<typeof criarMapa>, id: string) => Object.values(m.lights).filter(l => l.ownerId === id);

test('pôr um cogumelo gigante cria uma luz com ownerId do objeto', () => {
  const o = cogumelo();
  const m = aplicarComando(criarMapa(), { tipo: 'item.adicionar', colecao: 'props', item: o });
  const luzes = donas(m, o.id);
  assert.equal(luzes.length, 1);
  assert.equal(luzes[0]!.id, idDaLuzPropria(o.id));
  assert.deepEqual(luzes[0]!.position, [5, 5]);
  assert.equal(luzes[0]!.power, 'magic');
});

test('brilho 0 não cria luz', () => {
  const o = cogumelo({ brilho: 0 });
  const m = aplicarComando(criarMapa(), { tipo: 'item.adicionar', colecao: 'props', item: o });
  assert.equal(donas(m, o.id).length, 0);
});

test('mudar o brilho tira e põe a luz; mover a leva junto', () => {
  const o = cogumelo({ brilho: 0.7 });
  let m = aplicarComando(criarMapa(), { tipo: 'item.adicionar', colecao: 'props', item: o });
  assert.equal(donas(m, o.id).length, 1);
  m = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'props', id: o.id, patch: { source: { params: { brilho: 0 } } } });
  assert.equal(donas(m, o.id).length, 0);
  m = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'props', id: o.id, patch: { source: { params: { brilho: 0.7 } } } });
  assert.equal(donas(m, o.id).length, 1);
  m = aplicarComando(m, { tipo: 'selecao.mover', alvos: [{ colecao: 'props', id: o.id }], delta: [2, 1] });
  assert.deepEqual(donas(m, o.id)[0]!.position, [7, 6]);
});

test('apagar o objeto apaga a luz', () => {
  const o = cogumelo();
  let m = aplicarComando(criarMapa(), { tipo: 'item.adicionar', colecao: 'props', item: o });
  m = aplicarComando(m, { tipo: 'item.remover', colecao: 'props', id: o.id });
  assert.equal(Object.keys(m.lights).length, 0);
});
