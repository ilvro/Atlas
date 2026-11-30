import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compartilhar } from '../../src/state/imutavel.ts';

test('compartilhar: faixas de números iguais reaproveitam a referência velha', () => {
  const velho = { cells: [[0, 1, 2], [3, 4, 5]], nome: 'a' };
  const novo = { cells: [[0, 1, 2], [3, 4, 5]], nome: 'a' };
  assert.equal(compartilhar(velho, novo), velho);
});

test('compartilhar: só o que mudou ganha referência nova', () => {
  const velho = { cells: [[0, 1, 2], [3, 4, 5]], grade: { a: 1 } };
  const novo = { cells: [[0, 1, 2], [3, 4, 6]], grade: { a: 1 } };
  const r = compartilhar(velho, novo);
  assert.notEqual(r, velho);
  assert.equal(r.cells[0], velho.cells[0]);
  assert.notEqual(r.cells[1], velho.cells[1]);
  assert.equal(r.grade, velho.grade);
});

test('compartilhar: tamanhos diferentes e NaN', () => {
  assert.deepEqual(compartilhar({ v: [1, 2] }, { v: [1, 2, 3] }), { v: [1, 2, 3] });
  const velho = { v: [NaN, 1] };
  assert.equal(compartilhar(velho, { v: [NaN, 1] }), velho);
});
