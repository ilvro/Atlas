import { test } from 'node:test';
import assert from 'node:assert/strict';
import { celulasDeVoronoi } from '../../src/procedural/voronoi.ts';

const area = { x: 0, y: 0, w: 10, h: 10 };

test('mesma semente, mesmo resultado; sementes diferentes, células diferentes', () => {
  const a = celulasDeVoronoi(area, 0.5, 3), b = celulasDeVoronoi(area, 0.5, 3), c = celulasDeVoronoi(area, 0.5, 4);
  assert.deepEqual(a.sitios(), b.sitios());
  assert.notDeepEqual(a.sitios(), c.sitios());
  for (const [x, y] of [[0.1, 0.2], [3.3, 7.7], [9.9, 5]] as const) assert.deepEqual(a.consultar(x, y), b.consultar(x, y));
});

test('F2 − F1 nunca é negativo, F1 ≤ F2 e há cerca de um sítio por quadradinho', () => {
  const v = celulasDeVoronoi(area, 0.5, 9);
  for (let i = 0; i < 400; i++) { const q = v.consultar((i * 0.137) % 10, (i * 0.291) % 10); assert.ok(q.borda >= 0 && q.f1 <= q.f2); assert.equal(v.bordaEm((i * 0.137) % 10, (i * 0.291) % 10), q.borda); }
  const n = v.sitios().length; assert.ok(n > 300 && n < 500, `${n} sítios`);
});

test('o sítio mais próximo está a F1 e a distância à borda some entre duas células', () => {
  const v = celulasDeVoronoi(area, 1, 5), s = v.sitios()[10]!, q = v.consultar(s.x, s.y);
  assert.ok(q.f1 < 1e-9 && q.sitio.i === s.i && q.sitio.j === s.j);
  assert.ok(q.borda > 0.05, 'no sítio a borda está longe');
});
