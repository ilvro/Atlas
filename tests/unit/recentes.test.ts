import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternarFavorito, registrarRecente } from '../../src/app/recentes.ts';

test('registrarRecente põe o mais novo na frente', () => { assert.deepEqual(registrarRecente(['a', 'b'], 'c', 20), ['c', 'a', 'b']); });
test('registrarRecente não repete: sobe o que já existe', () => { assert.deepEqual(registrarRecente(['a', 'b', 'c'], 'c', 20), ['c', 'a', 'b']); });
test('registrarRecente corta no máximo', () => { assert.deepEqual(registrarRecente(['a', 'b', 'c'], 'd', 3), ['d', 'a', 'b']); });
test('registrarRecente não muda a lista original', () => { const l = ['a']; registrarRecente(l, 'b', 5); assert.deepEqual(l, ['a']); });
test('alternarFavorito acrescenta e remove', () => {
  const um = alternarFavorito([], 'x');
  assert.deepEqual(um, ['x']);
  assert.deepEqual(alternarFavorito(um, 'x'), []);
});
test('alternarFavorito mantém os outros', () => { assert.deepEqual(alternarFavorito(['a', 'b'], 'a'), ['b']); });
