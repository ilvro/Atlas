import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FAMILIAS, sortearVariante } from '../../src/procedural/familias.ts';
import { PINCEL_PADRAO } from '../../src/render/pincel.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';

test('sortearVariante nunca repete o atual numa família de 2 ou mais', () => {
  for (const f of FAMILIAS.filter(f => f.itens.length >= 2))
    for (const atual of f.itens) for (const r of [0, 0.3, 0.5, 0.99, 0.999999]) assert.notEqual(sortearVariante(f, atual, () => r), atual);
});

test('sortearVariante numa família de 1 devolve o próprio item', () => {
  assert.equal(sortearVariante({ id: 'x', nome: 'X', grupo: 'g', itens: ['a'] }, 'a', () => 0.7), 'a');
});

test('sortearVariante é determinística para o mesmo rand', () => {
  const f = FAMILIAS.find(f => f.itens.length >= 2)!;
  assert.equal(sortearVariante(f, f.itens[0]!, () => 0.42), sortearVariante(f, f.itens[0]!, () => 0.42));
});

test('o pincel padrão aponta para a família do seu item', () => {
  assert.equal(ACERVO.familiaDoItem(PINCEL_PADRAO.objeto.item)?.id, PINCEL_PADRAO.objeto.familia);
  assert.equal(PINCEL_PADRAO.objeto.varianteAleatoria, false);
});
