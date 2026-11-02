import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acharRefs, chaveDaRef, criarRef, ehRef, formatarRef, lerRef, mesmaRef, partesDoId } from '../src/index.ts';

test('formatar e ler uma referência é uma volta completa', () => {
  const r = criarRef('ficha', 'ficha', 'sheet-1730-ab');
  assert.equal(formatarRef(r), 'mesa:ficha/ficha/sheet-1730-ab');
  assert.deepEqual(lerRef(formatarRef(r)), r);
});

test('a revisão vai depois do arroba e volta como número', () => {
  const r = criarRef('atelie', 'documento', '0b5c-uuid', 7);
  assert.equal(formatarRef(r), 'mesa:atelie/documento/0b5c-uuid@7');
  assert.deepEqual(lerRef('mesa:atelie/documento/0b5c-uuid@7'), r);
});

test('tipos compostos guardam <pai>/<filho> no id', () => {
  const r = criarRef('atlas', 'comodo', 'mapa-1/biblioteca');
  assert.equal(formatarRef(r), 'mesa:atlas/comodo/mapa-1/biblioteca');
  assert.deepEqual(lerRef(formatarRef(r)), r);
  assert.deepEqual(partesDoId(r.id), { id: 'mapa-1/biblioteca', pai: 'mapa-1', filho: 'biblioteca' });
  assert.deepEqual(partesDoId('simples'), { id: 'simples', pai: 'simples', filho: '' });
});

test('rejeita o que não é referência', () => {
  for (const ruim of [null, 'x', {}, { app: 'ficha', tipo: 'a', id: '' }, { app: 'nada', tipo: 'a', id: '1' }, { app: 'ficha', tipo: 'A B', id: '1' },
    { app: 'ficha', tipo: 'a', id: 'com espaço' }, { app: 'ficha', tipo: 'a', id: '1', extra: true }, { app: 'ficha', tipo: 'a', id: '1', rev: -1 }, { app: 'ficha', tipo: 'a', id: '1', rev: 1.5 }]) {
    assert.equal(ehRef(ruim), false, JSON.stringify(ruim));
  }
  assert.throws(() => criarRef('ficha', 'a', ''));
  for (const texto of ['', 'ficha/ficha/1', 'mesa:ficha/ficha', 'mesa:nada/x/1', 'mesa:ficha/X/1', 'mesa:ficha/a/com espaço']) assert.equal(lerRef(texto), null, texto);
});

test('igualdade ignora a revisão, a menos que se peça', () => {
  const a = criarRef('atelie', 'documento', 'd', 1), b = criarRef('atelie', 'documento', 'd', 2);
  assert.equal(mesmaRef(a, b), true);
  assert.equal(mesmaRef(a, b, true), false);
  assert.equal(chaveDaRef(a), 'atelie/documento/d');
});

test('acha referências em notas, em ordem e sem repetir', () => {
  const achadas = acharRefs('Veja [[mesa:ficha/ficha/s1]] e (mesa:atlas/mapa/m1), de novo mesa:ficha/ficha/s1. Fim.');
  assert.deepEqual(achadas.map(formatarRef), ['mesa:ficha/ficha/s1', 'mesa:atlas/mapa/m1']);
});
