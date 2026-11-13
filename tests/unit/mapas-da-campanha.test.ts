import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapasDaCampanha, mapasDeOutrasCampanhas } from '../../src/app/mapas-da-campanha.ts';

const mapas = [
  { id: 'a', campanhaId: 'c1' }, { id: 'b', campanhaId: 'c2' }, { id: 'c', campanhaId: null }, { id: 'd', campanhaId: 'c1' },
];

test('sem campanha, devolve todos os mapas (vista geral)', () => {
  assert.deepEqual(mapasDaCampanha(mapas, null).map(m => m.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(mapasDaCampanha(mapas, undefined).map(m => m.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(mapasDeOutrasCampanhas(mapas, null), []);
});

test('com campanha, só os mapas dela, e o resto vai para "outras campanhas"', () => {
  assert.deepEqual(mapasDaCampanha(mapas, 'c1').map(m => m.id), ['a', 'd']);
  assert.deepEqual(mapasDeOutrasCampanhas(mapas, 'c1').map(m => m.id), ['b', 'c']);
  assert.deepEqual(mapasDaCampanha(mapas, 'c3'), []);
});

test('não altera a lista original', () => {
  const copia = [...mapas];
  mapasDaCampanha(mapas, 'c1'); mapasDaCampanha(mapas, null);
  assert.deepEqual(mapas, copia);
});
