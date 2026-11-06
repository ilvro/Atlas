import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distanciaDoPercurso, distanciaEmQuadrados, pontosDaRegua, textoDaRegua } from '../../src/domain/regua.ts';

const T = 1.5;

test('em linha reta as duas regras contam igual', () => {
  assert.equal(distanciaEmQuadrados([0.75, 0.75], [6.75, 0.75], T, 'simples'), 4);
  assert.equal(distanciaEmQuadrados([0.75, 0.75], [6.75, 0.75], T, 'alternada'), 4);
  assert.equal(distanciaEmQuadrados([0.75, 0.75], [0.75, 0.75], T), 0);
});

test('regra simples: a diagonal vale 1', () => {
  assert.equal(distanciaEmQuadrados([0, 0], [4.5, 4.5], T, 'simples'), 3);
  assert.equal(distanciaEmQuadrados([0, 0], [6, 3], T, 'simples'), 4);
});

test('regra alternada: diagonais valem 1, 2, 1, 2…', () => {
  const d = (n: number) => distanciaEmQuadrados([0, 0], [n * T, n * T], T, 'alternada');
  assert.deepEqual([1, 2, 3, 4, 5].map(d), [1, 3, 4, 6, 7]);
  assert.equal(distanciaEmQuadrados([0, 0], [6, 3], T, 'alternada'), 2 + 2 + 1, '2 diagonais (3) e 2 retas');
});

test('regra euclidiana: mede a hipotenusa arredondada em quadrados', () => {
  // Triângulo 3-4-5: dx = 3 * T, dy = 4 * T -> 5 quadrados
  assert.equal(distanciaEmQuadrados([0, 0], [3 * T, 4 * T], T, 'euclidiana'), 5);
  // Diagonal pura 3x3: sqrt(9+9) = sqrt(18) = 4.24 -> arredonda para 4
  assert.equal(distanciaEmQuadrados([0, 0], [3 * T, 3 * T], T, 'euclidiana'), 4);
});

test('o percurso com dobras soma os trechos', () => {
  assert.equal(distanciaDoPercurso([[0.75, 0.75], [4.75 - 0.25, 0.75], [4.5, 6.75]], T), 3 + 4);
  assert.equal(distanciaDoPercurso([[0, 0]], T), 0);
});

test('as células do percurso não repetem a da dobra', () => {
  const g = { size: T, offset: [0, 0] as [number, number] };
  assert.deepEqual(pontosDaRegua([[0.75, 0.75], [3.75, 0.75]], g), [[0, 0], [1, 0], [2, 0]]);
  assert.deepEqual(pontosDaRegua([[0.75, 0.75], [3.75, 0.75], [3.75, 3.75]], g), [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]);
});

test('o texto diz quadrados e metros', () => {
  assert.equal(textoDaRegua(4, T), '4 quadrados · 6 m');
  assert.equal(textoDaRegua(1, T), '1 quadrado · 1,5 m');
  assert.equal(textoDaRegua(3, 1.25), '3 quadrados · 3,75 m');
});
