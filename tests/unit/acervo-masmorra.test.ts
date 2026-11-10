import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECEITAS, descreverReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DE_MASMORRA } from '../../src/procedural/receitas/masmorra.ts';

const IDS_PISO = ['braseiro', 'fogueira', 'caldeirao', 'espeto-de-assar', 'fornalha', 'pedra-de-amolar', 'tina-de-agua', 'roca-de-fiar', 'tear', 'mo', 'pelourinho', 'gaiola-de-ferro', 'mesa-de-tortura', 'tenda', 'estandarte'];
const IDS_PAREDE = ['tocha.parede', 'grilhoes.parede'];
const partes = (id: string, params: Record<string, unknown> = {}, seed = 3) => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };

test('o lote de fogo, ofícios, masmorra e acampamento tem as 17 receitas, com o tipo certo', () => {
  assert.equal(RECEITAS_DE_MASMORRA.length, 17);
  for (const id of IDS_PISO) assert.equal(RECEITAS[id]?.tipo, 'piso', id);
  for (const id of IDS_PAREDE) assert.equal(RECEITAS[id]?.tipo, 'parede', id);
  for (const id of ['braseiro', 'fogueira', 'caldeirao', 'espeto-de-assar', 'fornalha']) assert.equal(RECEITAS[id]!.categoria, 'lareira-e-luz', id);
  for (const id of ['tenda', 'estandarte']) assert.equal(RECEITAS[id]!.categoria, 'exterior', id);
  for (const r of RECEITAS_DE_MASMORRA) assert.deepEqual(r.generos, ['fantasia'], r.id);
});

test('fogueira e tear variam com a semente e são determinísticos', () => {
  for (const id of ['fogueira', 'tear']) {
    assert.deepEqual(partes(id, {}, 5), partes(id, {}, 5), id);
    assert.notDeepEqual(partes(id, {}, 5), partes(id, {}, 6), id);
  }
});

test('tenda e estandarte usam o material pedido', () => {
  assert.ok(partes('tenda', { lona: 'tecido.verde' }).some(p => p.mat === 'tecido.verde'));
  assert.ok(!partes('tenda').some(p => p.mat === 'tecido.verde'));
  assert.ok(partes('tenda').some(p => p.mat === 'tecido.linho'));
  assert.ok(partes('estandarte', { cor: 'tecido.veludo-vinho' }).some(p => p.mat === 'tecido.veludo-vinho'));
  assert.ok(partes('estandarte').some(p => p.mat === 'tecido.veludo-azul'));
});

test('tocha.parede e grilhoes.parede são de parede, com topo não vazio', () => {
  for (const id of IDS_PAREDE) {
    const d = descreverReceita(id, { seed: 1, params: {} });
    assert.equal(d.tipo, 'parede', id);
    assert.ok(d.tipo === 'parede' && d.topo.length > 0 && d.face.length > 0, id);
  }
});
