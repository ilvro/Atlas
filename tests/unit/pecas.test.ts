import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPeca } from '../../src/render/pecas.ts';
import type { Peca } from '../../src/domain/mapa.ts';

function pecaBase(x: number, y: number): Peca {
  return {
    id: 'p1',
    name: 'Lia',
    position: [x, y],
    size: 1,
    facing: 'down',
    portrait: null,
    sprite: null,
    player: true,
    vision: { radius: 6, dark: false },
    lightId: null,
    figure: { state: 'normal' },
    refs: [],
  };
}

test('criarPeca: redesenhar com animar=false sem mudar posição preserva deslize ativo', () => {
  const pv = criarPeca();
  pv.atualizar(pecaBase(1, 1), 1.5, 0xe91d25, null, false);
  assert.equal(pv.estado().deslizando, false);

  // Move com animar=true -> inicia deslize e trilha
  pv.atualizar(pecaBase(4, 1), 1.5, 0xe91d25, null, true);
  assert.equal(pv.estado().deslizando, true);
  assert.equal(pv.estado().trilha, 1);

  // Redesenhar peças (ex.: chegou recursos/retrato) com mesma posição e animar=false não cancela o deslize
  pv.atualizar(pecaBase(4, 1), 1.5, 0xe91d25, null, false, undefined, { pv: 10, pvMax: 10, pd: 5, pdMax: 5 }, true);
  assert.equal(pv.estado().deslizando, true);

  // Mudar de posição com animar=false (ex.: troca de andar/teleporte) encerra o deslize imediatamente
  pv.atualizar(pecaBase(8, 8), 1.5, 0xe91d25, null, false);
  assert.equal(pv.estado().deslizando, false);
  assert.equal(pv.c.x, 8);
  assert.equal(pv.c.y, 8);
});
