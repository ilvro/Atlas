import { test } from 'node:test';
import assert from 'node:assert/strict';
import { livreParaObjeto } from '../../src/domain/encaixe.ts';

test('livreParaObjeto: tabela verdade', () => {
  for (const [naGrade, snap, alt, esperado] of [
    [false, true, false, true], [false, true, true, false], [false, false, false, true], [false, false, true, false],
    [true, true, false, false], [true, true, true, true], [true, false, false, true], [true, false, true, true],
  ] as const) assert.equal(livreParaObjeto(naGrade, snap, alt), esperado);
});
