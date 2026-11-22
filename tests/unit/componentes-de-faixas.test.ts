import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentesDeFaixas, orientacaoDominante } from '../../src/procedural/orientacao.ts';

test('corridas de linhas vizinhas que se sobrepõem são o mesmo talhão; separadas são outros', () => {
  // Talhão deitado (10 × 3) em cima e talhão em pé (3 × 10) embaixo, sem se tocar.
  const deitado: [number, number, number][] = [[0, 0, 10], [1, 0, 10], [2, 0, 10]];
  const emPe: [number, number, number][] = Array.from({ length: 10 }, (_, i) => [5 + i, 20, 3] as [number, number, number]);
  const partes = componentesDeFaixas([...emPe, ...deitado]);
  assert.equal(partes.length, 2);
  const [a, b] = partes.sort((p, q) => p[0]![0] - q[0]![0]);
  assert.equal(a!.length, 3); assert.equal(b!.length, 10);
  assert.ok(Math.abs(orientacaoDominante(a!)) < 0.1, 'o deitado segue x');
  assert.ok(Math.abs(Math.abs(orientacaoDominante(b!)) - Math.PI / 2) < 0.1, 'o em pé segue y');
});

test('corridas que só se tocam na diagonal são talhões diferentes', () => {
  assert.equal(componentesDeFaixas([[0, 0, 2], [1, 2, 2]]).length, 2);
  assert.equal(componentesDeFaixas([[0, 0, 3], [1, 2, 2]]).length, 1);
});
