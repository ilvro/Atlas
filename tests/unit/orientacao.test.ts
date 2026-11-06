import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orientacaoDominante } from '../../src/procedural/orientacao.ts';

type C = [number, number, number];
test('faixa horizontal dá ~0', () => {
  const c: C[] = []; for (let y = 0; y < 4; y++) c.push([y, 0, 40]);
  assert.ok(Math.abs(orientacaoDominante(c)) < 1e-6);
});
test('faixa vertical dá ~±π/2', () => {
  const c: C[] = []; for (let y = 0; y < 40; y++) c.push([y, 0, 4]);
  assert.ok(Math.abs(Math.abs(orientacaoDominante(c)) - Math.PI / 2) < 1e-6);
});
test('faixa diagonal (descendo para a direita) dá ~π/4', () => {
  const c: C[] = []; for (let y = 0; y < 40; y++) c.push([y, y, 4]);
  const a = orientacaoDominante(c); assert.ok(a > 0.6 && a < 0.95, String(a));
});
test('forma quase redonda e vazio dão 0', () => {
  const c: C[] = []; for (let y = 0; y < 10; y++) c.push([y, 0, 10]);
  assert.equal(orientacaoDominante(c), 0); assert.equal(orientacaoDominante([]), 0);
});
