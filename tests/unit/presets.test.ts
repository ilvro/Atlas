import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ESTILOS_DE_TELHADO, FUNCOES_AO_AR_LIVRE, estiloDeTelhado, telhadoPadrao } from '../../src/domain/presets.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

test('ESTILOS_DE_TELHADO: todos os 12 estilos são únicos e passam na validação do mapa', () => {
  assert.equal(ESTILOS_DE_TELHADO.length, 12);
  assert.equal(new Set(ESTILOS_DE_TELHADO.map(e => e.id)).size, 12);
  for (const e of ESTILOS_DE_TELHADO) {
    const m = criarMapa();
    m.rooms.r1 = {
      id: 'r1',
      name: e.nome,
      function: 'sala',
      cells: codificar([[1, 1], [2, 1]]),
      floor: { material: 'tabuas.carvalho', seed: 1 },
      wallpaper: null,
      wallStyle: null,
      palette: null,
      roof: { ...e.roof, visible: true },
      levelId: null,
    };
    assert.doesNotThrow(() => validarMapa(m), e.id);
  }
});

test('telhadoPadrao: varia por gênero/função e deixa funções ao ar livre sem telhado', () => {
  const fantasia = criarMapa();
  fantasia.style.genre = 'fantasia';
  assert.deepEqual(telhadoPadrao(fantasia, 'sala', [[2, 2]]), estiloDeTelhado('choupana')!.roof);

  const moderno = criarMapa();
  moderno.style.genre = 'moderno';
  assert.deepEqual(telhadoPadrao(moderno, 'escritorio', [[2, 2]]), estiloDeTelhado('laje-moderna')!.roof);

  const inv = criarMapa();
  inv.style.genre = 'investigacao';
  assert.deepEqual(telhadoPadrao(inv, 'sala', [[2, 2]]), estiloDeTelhado('casa-velha')!.roof);

  assert.deepEqual(telhadoPadrao(inv, 'capela', [[2, 2]]), estiloDeTelhado('igreja')!.roof);
  assert.deepEqual(telhadoPadrao(inv, 'forja', [[2, 2]]), estiloDeTelhado('casa-de-pedra')!.roof);
  assert.deepEqual(telhadoPadrao(inv, 'torre', [[2, 2]]), estiloDeTelhado('torre')!.roof);
  assert.deepEqual(telhadoPadrao(inv, 'campanario', [[2, 2]]), estiloDeTelhado('torre')!.roof);

  for (const f of FUNCOES_AO_AR_LIVRE) {
    assert.equal(telhadoPadrao(fantasia, f, [[2, 2]]), null, `${f} deve nascer sem telhado`);
  }
});

test('telhadoPadrao: herda do cômodo vizinho em 4 direções, exceto quando a função pede estilo próprio', () => {
  const m = criarMapa();
  m.style.genre = 'investigacao';
  m.rooms.nave = {
    id: 'nave',
    name: 'Nave',
    function: 'capela',
    cells: codificar([[1, 1], [1, 2]]),
    floor: { material: 'laje.pedra', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { ...estiloDeTelhado('igreja')!.roof, visible: true },
    levelId: null,
  };
  assert.deepEqual(telhadoPadrao(m, 'cozinha', [[2, 1], [3, 1]]), estiloDeTelhado('igreja')!.roof);
  assert.deepEqual(telhadoPadrao(m, 'torre', [[2, 1]]), estiloDeTelhado('torre')!.roof, 'torre ao lado da nave vira Torre');
  assert.deepEqual(telhadoPadrao(m, 'cozinha', [[3, 1]]), estiloDeTelhado('casa-velha')!.roof, 'afastado usa o gênero');
  assert.equal(telhadoPadrao(m, 'varanda', [[2, 1]]), null, 'varanda ao lado de casa continua sem telhado');
});

test('telhadoPadrao: vizinho de outro nível não passa o telhado', () => {
  const m = criarMapa();
  m.rooms.porao = {
    id: 'porao', name: 'Porão', function: 'porao', cells: codificar([[1, 1]]),
    floor: { material: 'laje.pedra', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
    roof: { material: 'telha.ardosia', visible: true }, levelId: 'subsolo',
  };
  assert.deepEqual(telhadoPadrao(m, 'sala', [[2, 1]]), estiloDeTelhado('casa-velha')!.roof, 'no térreo, o porão de baixo não conta');
  assert.deepEqual(telhadoPadrao(m, 'sala', [[2, 1]], 'subsolo'), { material: 'telha.ardosia' });
});
