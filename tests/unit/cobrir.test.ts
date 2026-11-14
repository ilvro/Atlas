import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cobrirCasas } from '../../src/authoring/cobrir.ts';
import { aplicarEmCopia } from '../../src/authoring/construcao.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { criarMapa, type Comodo } from '../../src/domain/mapa.ts';

function comodo(
  id: string,
  celulas: [number, number][],
  funcao: string | null = 'sala',
  material: string | null = null,
  visible = true,
): Comodo {
  return {
    id,
    name: id,
    function: funcao,
    cells: codificar(celulas),
    floor: { material: 'tabuas.carvalho', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { material, visible },
    levelId: null,
  };
}

test('cobrirCasas: deixa varanda de fora, herda material do vizinho em cadeia e não toca quem já tem telhado', () => {
  const m0 = criarMapa();
  m0.style.genre = 'investigacao';
  m0.rooms = {
    a_distante: comodo('a_distante', [[4, 0], [5, 0]], 'cozinha', null),
    b_meio: comodo('b_meio', [[2, 0], [3, 0]], 'corredor', null),
    c_varanda: comodo('c_varanda', [[0, 1], [1, 1]], 'varanda', null),
    z_existente: comodo('z_existente', [[0, 0], [1, 0]], 'sala', 'telha.ardosia', false),
  };

  const comandos = cobrirCasas(m0);
  assert.equal(comandos.length, 2);

  const m1 = aplicarEmCopia(m0, comandos);
  assert.equal(m1.rooms.z_existente!.roof.material, 'telha.ardosia');
  assert.equal(m1.rooms.z_existente!.roof.visible, false);
  assert.equal(m1.rooms.c_varanda!.roof.material, null);
  assert.equal(m1.rooms.b_meio!.roof.material, 'telha.ardosia');
  assert.equal(m1.rooms.a_distante!.roof.material, 'telha.ardosia');
});

test('cobrirCasas: casa isolada sem telhado usa o padrão do gênero', () => {
  const m0 = criarMapa();
  m0.style.genre = 'fantasia';
  m0.rooms = {
    a: comodo('a', [[0, 0]], 'sala', null),
    b: comodo('b', [[1, 0]], 'quarto', null),
  };

  const m1 = aplicarEmCopia(m0, cobrirCasas(m0));
  assert.equal(m1.rooms.a!.roof.material, 'telha.palha');
  assert.equal(m1.rooms.b!.roof.material, 'telha.palha');
});
