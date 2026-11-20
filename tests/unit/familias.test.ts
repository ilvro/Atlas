import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { FAMILIAS, GRUPOS_DE_OBJETOS } from '../../src/procedural/familias.ts';

test('todo item do acervo está em exatamente uma família', () => {
  const contagem = new Map<string, number>();
  for (const f of FAMILIAS) for (const i of f.itens) contagem.set(i, (contagem.get(i) ?? 0) + 1);
  for (const item of ACERVO.lista()) assert.equal(contagem.get(item.id), 1, item.id);
});
test('toda família tem itens, e todo item existe', () => {
  for (const f of FAMILIAS) {
    assert.ok(f.itens.length > 0, f.id);
    for (const i of f.itens) assert.ok(ACERVO.item(i), `${f.id}: ${i}`);
  }
});
test('todo grupo existe e tem famílias', () => {
  const grupos = new Set(GRUPOS_DE_OBJETOS.map(g => g.id));
  for (const f of FAMILIAS) assert.equal(grupos.has(f.grupo), true, f.id);
  for (const g of GRUPOS_DE_OBJETOS) assert.equal(FAMILIAS.some(f => f.grupo === g.id), true, g.id);
});
test('ids de família são únicos', () => {
  assert.equal(new Set(FAMILIAS.map(f => f.id)).size, FAMILIAS.length);
});
test('nenhuma família mistura piso e parede', () => {
  for (const f of FAMILIAS) assert.equal(new Set(f.itens.map(i => ACERVO.item(i)?.tipo)).size, 1, f.id);
});
test('familiaDoItem acha a família das árvores', () => {
  assert.equal(ACERVO.familiaDoItem('casa:arvore-5m')?.id, 'arvore');
  assert.ok(ACERVO.familia('arvore')?.itens.includes('casa:arvore-3m'));
  assert.equal(ACERVO.familiaDoItem('nao-existe'), undefined);
});
