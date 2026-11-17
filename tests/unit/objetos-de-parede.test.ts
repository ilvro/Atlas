import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarEmCopia, comodos, objetos } from '../../src/authoring/construcao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { Kit } from '../../scripts/exemplos/kit.ts';

let n = 0;
const id = (p: string) => `${p}${++n}`;

test('atlas_objetos prende objeto de parede à face do cômodo mais próxima', () => {
  let m = criarMapa({ largura: 12, altura: 12 });
  m = aplicarEmCopia(m, comodos(m, [{ rets: [[1, 1, 6, 6]], tipo: 'sala' }], 1, id).comandos);
  const c = objetos(m, [{ item: 'quadro', pos: [4.5, 1.9] }, { item: 'cadeira', pos: [4, 4] }], 1, id);
  const r = aplicarEmCopia(m, c.comandos), [quadro, cadeira] = c.ids.map(i => r.props[i]!);
  assert.equal(quadro!.elevation, 'wall');
  assert.ok(quadro!.wall && r.walls[quadro!.wall.wallId]);
  assert.ok(quadro!.roomId);
  assert.ok(Math.abs(quadro!.position[1] - 1.5) < 0.01, 'encostado na parede norte');
  assert.equal(cadeira!.wall ?? null, null);
  assert.throws(() => objetos(m, [{ item: 'quadro', pos: [10, 10] }], 1, id), /parede/);
});

test('o kit dos exemplos também pendura objetos de parede', () => {
  const k = new Kit({ id: 'teste-parede', nome: 'Teste', largura: 12, altura: 12, semente: 3 });
  k.comodo([1, 1, 6, 6], 'sala');
  const oid = k.objeto('arandela', [1.8, 4.5]);
  const o = k.construir().props[oid]!;
  assert.equal(o.elevation, 'wall'); assert.ok(o.wall);
  assert.throws(() => k.objeto('quadro', [10, 10]));
});
