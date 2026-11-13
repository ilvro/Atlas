import assert from 'node:assert/strict';
import test from 'node:test';
import { calcularRespiracao, curvaDeRespiracao } from '../../src/render/respiracao.ts';

test('curvaDeRespiracao inspira em 42% do ciclo e expira no restante', () => {
  assert.equal(curvaDeRespiracao(0), 0);
  assert.ok(Math.abs(curvaDeRespiracao(0.42) - 1) < 1e-9);
  assert.ok(Math.abs(curvaDeRespiracao(1) - 0) < 1e-9);
  assert.ok(curvaDeRespiracao(0.21) > 0 && curvaDeRespiracao(0.21) < 1);
  assert.ok(curvaDeRespiracao(0.71) > 0 && curvaDeRespiracao(0.71) < 1);
  assert.equal(curvaDeRespiracao(-0.58), curvaDeRespiracao(0.42));
});

test('calcularRespiracao varia amplitude e tremor conforme o estado', () => {
  const normal = calcularRespiracao(0.42 * 4.2, 0, { period: 4.2, amp: 1, tremor: 0 });
  const critico = calcularRespiracao(0.42 * 2.4, 0, { period: 2.4, amp: 1.7, tremor: 0 });
  assert.ok(normal.lift > 0);
  assert.ok(normal.expand > 0);
  assert.ok(critico.lift > normal.lift);
  assert.ok(critico.expand > normal.expand);

  const semTremor = calcularRespiracao(1, 0, { period: 3.2, amp: 0.75, tremor: 0 });
  const comTremor = calcularRespiracao(1, 0, { period: 3.2, amp: 0.75, tremor: 1 });
  assert.notEqual(comTremor.sway, semTremor.sway);
});
