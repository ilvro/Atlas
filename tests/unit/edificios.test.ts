import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { edificioDaSala, edificiosDe } from '../../src/domain/edificios.ts';
import { criarMapa, type Comodo } from '../../src/domain/mapa.ts';

function comodo(
  id: string,
  celulas: [number, number][],
  material: string | null = 'telha.barro',
  levelId: string | null = null,
): Comodo {
  return {
    id,
    name: id,
    function: null,
    cells: codificar(celulas),
    floor: { material: 'pedra', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { material, visible: true },
    levelId,
  };
}

test('duas salas lado a lado formam 1 edifício; com uma célula de folga, formam 2', () => {
  const m1 = criarMapa();
  m1.rooms = {
    b: comodo('b', [[2, 0], [2, 1]]),
    a: comodo('a', [[0, 0], [1, 0]]),
  };
  const eds1 = edificiosDe(m1);
  assert.equal(eds1.length, 1);
  assert.equal(eds1[0]!.id, 'a');
  assert.deepEqual(eds1[0]!.salas, ['a', 'b']);
  assert.equal(eds1[0]!.celulas.length, 4);
  assert.equal(edificioDaSala(m1, 'b'), eds1[0]);

  const m2 = criarMapa();
  m2.rooms = {
    a: comodo('a', [[0, 0], [1, 0]]),
    b: comodo('b', [[3, 0], [4, 0]]),
  };
  const eds2 = edificiosDe(m2);
  assert.equal(eds2.length, 2);
  assert.deepEqual(eds2.map(e => e.id), ['a', 'b']);
});

test('sala sem material fica fora e cômodos em diagonal não se unem', () => {
  const m = criarMapa();
  m.rooms = {
    sem: comodo('sem', [[1, 0]], null),
    a: comodo('a', [[0, 0]]),
    diag: comodo('diag', [[1, 1]]),
  };
  const eds = edificiosDe(m);
  assert.equal(eds.length, 2);
  assert.equal(edificioDaSala(m, 'sem'), null);
  assert.deepEqual(eds.map(e => e.id), ['a', 'diag']);
});

test('níveis diferentes não se unem, mesmo com células vizinhas ou sobrepostas', () => {
  const m = criarMapa();
  m.rooms = {
    terreo: comodo('terreo', [[0, 0], [1, 0]], 'telha.barro', 'nivel-1'),
    sobrado: comodo('sobrado', [[1, 0], [2, 0]], 'telha.barro', 'nivel-2'),
  };
  const eds = edificiosDe(m);
  assert.equal(eds.length, 2);
  assert.notEqual(edificioDaSala(m, 'terreo'), edificioDaSala(m, 'sobrado'));
});

test('id é estável quando a ordem de rooms muda e o cache devolve o mesmo array', () => {
  const s1 = comodo('sala-z', [[0, 0]]);
  const s2 = comodo('sala-a', [[1, 0]]);
  const s3 = comodo('sala-m', [[1, 1]]);

  const m1 = criarMapa();
  m1.rooms = { 'sala-z': s1, 'sala-a': s2, 'sala-m': s3 };
  const m2 = criarMapa();
  m2.rooms = { 'sala-m': s3, 'sala-z': s1, 'sala-a': s2 };

  const a1 = edificiosDe(m1);
  const a1Repetido = edificiosDe(m1);
  const a2 = edificiosDe(m2);

  assert.strictEqual(a1, a1Repetido);
  assert.equal(a1[0]!.id, 'sala-a');
  assert.equal(a2[0]!.id, 'sala-a');
  assert.deepEqual(a1, a2);
});
