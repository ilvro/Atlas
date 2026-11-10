import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, pegadaDaReceita, receitaDe } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DE_ARMAS } from '../../src/procedural/receitas/armas.ts';

const PISO = ['suporte-de-armas', 'suporte-de-lancas', 'manequim-de-armadura', 'mesa-de-armas', 'barril-de-flechas', 'escudos-empilhados', 'armas-caidas', 'alvo-de-arqueiro', 'boneco-de-treino', 'balista', 'catapulta', 'canhao', 'pilha-de-balas'];
const PAREDE = ['machados.cruzados', 'escudo.parede', 'arco.parede', 'lancas.parede'];
const partes = (id: string, params: Record<string, unknown> = {}, seed = 3) => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };

test('as 17 receitas de armamentos existem, com o tipo certo e de 6 a 25 partes', () => {
  assert.equal(RECEITAS_DE_ARMAS.length, 17);
  for (const id of PISO) { assert.equal(receitaDe(id)?.tipo, 'piso', id); const n = partes(id).length; assert.ok(n >= 6 && n <= 25, `${id}: ${n} partes`); }
  for (const id of PAREDE) { assert.equal(receitaDe(id)?.tipo, 'parede', id); const d = descreverReceita(id, { seed: 1, params: {} }); assert.ok(d.tipo === 'parede' && d.face.length > 0 && d.topo.length > 0, id); }
});

test('suporte-de-armas e lancas.parede mudam de pegada com a largura e respeitam os limites', () => {
  assert.deepEqual(pegadaDaReceita('suporte-de-armas'), [1.6, 0.5]);
  assert.deepEqual(pegadaDaReceita('suporte-de-armas', { largura: 2.5 }), [2.5, 0.5]);
  assert.deepEqual(pegadaDaReceita('suporte-de-armas', { largura: 99 }), [3, 0.5]);
  assert.deepEqual(pegadaDaReceita('suporte-de-armas', { largura: 0 }), [1, 0.5]);
  assert.deepEqual(pegadaDaReceita('lancas.parede'), [1.8, 0.05]);
  assert.deepEqual(pegadaDaReceita('lancas.parede', { largura: 2.6 }), [2.6, 0.05]);
  assert.deepEqual(pegadaDaReceita('lancas.parede', { largura: 99 }), [3, 0.05]);
  assert.deepEqual(pegadaDaReceita('lancas.parede', { largura: 0.1 }), [1.2, 0.05]);
});

test('suporte-de-armas, escudos-empilhados e armas-caidas variam com a semente e são determinísticos', () => {
  for (const id of ['suporte-de-armas', 'escudos-empilhados', 'armas-caidas']) {
    assert.deepEqual(partes(id, {}, 5), partes(id, {}, 5), id);
    assert.notDeepEqual(partes(id, {}, 5), partes(id, {}, 6), id);
  }
});

test('armas-caidas fica rente ao chão (z <= 0,15)', () => { for (const p of partes('armas-caidas', {}, 7)) assert.ok(p.z <= 0.15, `z ${p.z}`); });

test('escudo.parede usa o material pedido', () => {
  assert.ok(partes('escudo.parede', { cor: 'tecido.verde' }).some(p => p.mat === 'tecido.verde'));
  assert.ok(!partes('escudo.parede', { cor: 'tecido.verde' }).some(p => p.mat === 'tecido.veludo-vinho'));
  assert.ok(partes('escudo.parede').some(p => p.mat === 'tecido.veludo-vinho'));
});
