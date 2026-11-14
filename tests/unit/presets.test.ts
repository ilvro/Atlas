import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { FUNCOES_AO_AR_LIVRE, telhadoPadrao } from '../../src/domain/presets.ts';

test('telhadoPadrao: varia por gênero e deixa funções ao ar livre sem telhado', () => {
  const fantasia = criarMapa();
  fantasia.style.genre = 'fantasia';
  assert.equal(telhadoPadrao(fantasia, 'sala', [[2, 2]]), 'telha.palha');

  const moderno = criarMapa();
  moderno.style.genre = 'moderno';
  assert.equal(telhadoPadrao(moderno, 'escritorio', [[2, 2]]), 'telha.ardosia');

  const inv = criarMapa();
  inv.style.genre = 'investigacao';
  assert.equal(telhadoPadrao(inv, 'sala', [[2, 2]]), 'telha.barro');

  for (const f of FUNCOES_AO_AR_LIVRE) {
    assert.equal(telhadoPadrao(fantasia, f, [[2, 2]]), null, `${f} deve nascer sem telhado`);
  }
});

test('telhadoPadrao: herda o material de cômodo vizinho com telhado em 4 direções', () => {
  const m = criarMapa();
  m.style.genre = 'investigacao';
  m.rooms.viz = {
    id: 'viz',
    name: 'Sala',
    function: 'sala',
    cells: codificar([[1, 1], [1, 2]]),
    floor: { material: 'tabuas.carvalho', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { material: 'telha.ardosia', visible: true },
    levelId: null,
  };
  assert.equal(telhadoPadrao(m, 'cozinha', [[2, 1], [3, 1]]), 'telha.ardosia');
  assert.equal(telhadoPadrao(m, 'cozinha', [[3, 1]]), 'telha.barro', 'afastado usa o gênero');
  assert.equal(telhadoPadrao(m, 'varanda', [[2, 1]]), null, 'varanda ao lado de casa continua sem telhado');
});

test('telhadoPadrao: vizinho de outro nível não passa o material', () => {
  const m = criarMapa();
  m.rooms.porao = {
    id: 'porao', name: 'Porão', function: 'porao', cells: codificar([[1, 1]]),
    floor: { material: 'laje.pedra', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
    roof: { material: 'telha.ardosia', visible: true }, levelId: 'subsolo',
  };
  assert.equal(telhadoPadrao(m, 'sala', [[2, 1]]), 'telha.barro', 'no térreo, o porão de baixo não conta');
  assert.equal(telhadoPadrao(m, 'sala', [[2, 1]], 'subsolo'), 'telha.ardosia');
});
