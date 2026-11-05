import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanciaAMargem, PROFUNDIDADE_MAXIMA } from '../../src/procedural/profundidade.ts';

function quadrado(lado: number, margem: number): { m: Uint8Array; w: number } {
  const w = lado + 2 * margem, m = new Uint8Array(w * w);
  for (let y = margem; y < margem + lado; y++) for (let x = margem; x < margem + lado; x++) m[y * w + x] = 1;
  return { m, w };
}

test('distância à margem: quadrado 10 x 10 a 1 px/m tem 1 na borda e 5 no centro', () => {
  const { m, w } = quadrado(10, 1), d = distanciaAMargem(m, w, w, 1, 99);
  assert.equal(d[0], 0);
  assert.equal(d[1 * w + 1], 1);
  assert.equal(d[5 * w + 5], 5);
  assert.equal(d[6 * w + 6], 5);
  assert.equal(d[1 * w + 5], 1);
});

test('distância à margem: em metros, saturada no máximo e quase euclidiana na diagonal', () => {
  const { m, w } = quadrado(40, 2), d = distanciaAMargem(m, w, w, 4);          // 4 px/m: o centro está a 5 m
  assert.equal(d[22 * w + 22]!, PROFUNDIDADE_MAXIMA);
  assert.ok(Math.abs(d[2 * w + 2]! - 0.25) < 1e-6);
  const p = distanciaAMargem(m, w, w, 4, 99);
  assert.ok(Math.abs(p[22 * w + 22]! - 5) < 0.2, String(p[22 * w + 22]));
});

test('distância à margem: fora da imagem conta como dentro', () => {
  const d = distanciaAMargem(new Uint8Array(16).fill(1), 4, 4, 1, 99);
  assert.ok(d[0]! > 10);
});
