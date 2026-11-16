import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { circulo } from '../../src/domain/formas-de-comodo.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { abertura, mapaCom, sala } from './apoio-casa.ts';

test('uma sala de 4 × 3 células (grade de 1,5 m) tem 27 m² e 21 m de perímetro', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3)), i = insightDoComodo(m, 'a')!;
  assert.equal(i.area, 27); assert.equal(i.perimetro, 21); assert.equal(i.externo, 21);
  assert.deepEqual(i.caixa, { x0: 0, y0: 0, x1: 6, y1: 4.5 });
  assert.equal(insightDoComodo(m, 'nao-existe'), null);
});

test('vizinhos: metros de parede em comum, e passam a ligados com um arco', () => {
  const m = mapaCom(sala('a', 0, 0, 3, 3), sala('b', 3, 0, 6, 2));
  const i = insightDoComodo(m, 'a')!;
  assert.deepEqual(i.vizinhos, [{ id: 'b', comprimento: 3, ligado: false }]); assert.equal(i.externo, i.perimetro - 3);
  const comum = Object.values(m.walls).find(w => w.path.every(p => p[0] === 4.5) && w.path.some(p => p[1] === 0))!;
  m.openings.arco = abertura(m, 'arco', comum.id, 0.25, 'arch');
  assert.equal(insightDoComodo(m, 'a')!.vizinhos[0]!.ligado, true);
});

test('porta entre dois cômodos aparece nos dois, com `outro` trocado e normais opostas; janela externa tem `outro: null`', () => {
  const m = mapaCom(sala('a', 0, 0, 3, 3), sala('b', 3, 0, 6, 3));
  const comum = Object.values(m.walls).find(w => w.path.every(p => p[0] === 4.5) && Math.abs(w.path[0]![1] - w.path.at(-1)![1]) >= 4.4)!;
  m.openings.p = abertura(m, 'p', comum.id, 0.5);
  const topo = Object.values(m.walls).find(w => w.path.every(p => p[1] === 0) && w.path.some(p => p[0] === 0))!;
  m.openings.j = abertura(m, 'j', topo.id, 0.25, 'window');
  const a = insightDoComodo(m, 'a')!, b = insightDoComodo(m, 'b')!;
  assert.equal(a.portas.length, 1); assert.equal(b.portas.length, 1);
  assert.equal(a.portas[0]!.outro, 'b'); assert.equal(b.portas[0]!.outro, 'a');
  assert.ok(Math.abs(a.portas[0]!.normal[0] + b.portas[0]!.normal[0]) < 1e-9 && Math.abs(a.portas[0]!.normal[0]) > 0.5, 'normais opostas');
  assert.deepEqual(a.janelas.map(j => j.outro), [null]); assert.equal(b.janelas.length, 0);
  assert.equal(a.janelas[0]!.normal[1], 1, 'a janela do topo aponta para dentro (y para baixo)');
});

test('objetos do cômodo entram, inclusive os de parede, com a caixa já girada; luzes pela posição', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3));
  const mesa = novoObjeto([3, 2], { id: 'o1', source: { kind: 'recipe', recipe: 'mesa.retangular', seed: 1, params: {} }, roomId: 'a', rotation: Math.PI / 2 });
  const quadro = novoObjeto([1, 0.05], { id: 'o2', source: { kind: 'recipe', recipe: 'quadro', seed: 1, params: {} }, roomId: 'a', elevation: 'wall' });
  const fora = novoObjeto([20, 20], { id: 'o3', source: { kind: 'recipe', recipe: 'caixa', seed: 1, params: {} }, roomId: null });
  m.props = { o1: mesa, o2: quadro, o3: fora };
  m.lights.l1 = { id: 'l1', position: [1, 1], radius: 4, color: '#fff', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null, rays: false };
  m.lights.l2 = { ...m.lights.l1, id: 'l2', position: [30, 30] };
  const i = insightDoComodo(m, 'a')!;
  assert.deepEqual(i.objetos.map(o => o.id).sort(), ['o1', 'o2']); assert.deepEqual(i.luzes, ['l1']);
  const c = i.objetos.find(o => o.id === 'o1')!.caixa;
  assert.ok(Math.abs((c.x1 - c.x0) - 0.9) < 1e-9 && Math.abs((c.y1 - c.y0) - 1.8) < 1e-9, 'a mesa de 1,8 × 0,9 girada 90° ocupa 0,9 × 1,8');
});

test('cômodo com outline (círculo e polígono estreito sem células) calcula caixa, área e perímetro reais', () => {
  const m = mapaCom(sala('torre', 0, 0, 1, 1, { cells: codificar([]), outline: circulo([10, 10], 4, 24) }));
  m.lights.l1 = { id: 'l1', position: [10, 10], radius: 4, color: '#fff', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null, rays: false };
  const i = insightDoComodo(m, 'torre')!;
  assert.ok(i, 'não retorna null mesmo com cells vazio');
  assert.ok(Math.abs(i.caixa.x0 - 6) < 1e-4 && Math.abs(i.caixa.x1 - 14) < 1e-4);
  assert.ok(Math.abs(i.caixa.y0 - 6) < 1e-4 && Math.abs(i.caixa.y1 - 14) < 1e-4);
  const areaEsperada = 24 * 0.5 * 16 * Math.sin((2 * Math.PI) / 24);
  assert.ok(Math.abs(i.area - areaEsperada) < 1e-3, `esperava área ~${areaEsperada}, veio ${i.area}`);
  assert.ok(Math.abs(i.perimetro - 24 * 2 * 4 * Math.sin(Math.PI / 24)) < 1e-2);
  assert.deepEqual(i.luzes, ['l1']);

  // Polígono diagonal fino sem células cujo centro caia dentro
  const diag = [[2, 2], [6, 6], [5.4, 6.6], [1.4, 2.6]] as [number, number][];
  m.rooms.diag = { ...m.rooms.torre!, id: 'diag', outline: diag };
  const id = insightDoComodo(m, 'diag')!;
  assert.ok(id && id.area > 4 && id.caixa.x0 === 1.4 && id.caixa.x1 === 6);
});
