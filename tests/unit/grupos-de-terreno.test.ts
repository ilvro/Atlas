import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GRUPOS_DE_TERRENO } from '../../src/procedural/grupos-de-terreno.ts';
import { MATERIAIS, materiaisDo } from '../../src/procedural/materiais.ts';

test('todo material de terreno, maciço e água está em exatamente um grupo', () => {
  const contagem = new Map<string, number>();
  for (const g of GRUPOS_DE_TERRENO) for (const m of g.materiais) contagem.set(m, (contagem.get(m) ?? 0) + 1);
  for (const u of ['terreno', 'macico', 'agua'] as const) for (const m of materiaisDo(u)) assert.equal(contagem.get(m.id), 1, m.id);
});
test('todo id de grupo existe em MATERIAIS', () => {
  for (const g of GRUPOS_DE_TERRENO) for (const m of g.materiais) assert.ok(MATERIAIS[m], m);
});
