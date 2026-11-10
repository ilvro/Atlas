import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, pegadaDaReceita, RECEITAS } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DE_CASTELO } from '../../src/procedural/receitas/castelo.ts';
import type { Parte } from '../../src/procedural/descricao.ts';

const partes = (id: string, params: Record<string, unknown> = {}, seed = 3): Parte[] => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };
const IDS = ['escada.madeira', 'escada.pedra', 'escada.caracol', 'escada.de-mao', 'alcapao', 'mesa.cavalete', 'mesa.banquete', 'mesa.redonda-rustica', 'bancada.trabalho', 'enxergao', 'monte-de-palha', 'saco-de-dormir', 'cama.dossel', 'beliche', 'trono', 'banqueta', 'cadeira.espaldar'];
const cy = (p: Parte) => (p.forma === 'poli' ? p.pts!.filter((_, i) => i % 2).reduce((a, b) => a + b, 0) / (p.pts!.length / 2) : p.y!);
const zMax = (ps: Parte[]) => Math.max(...ps.map(p => p.z));

test('as 17 receitas do castelo existem, com categoria, kit e funções válidas', () => {
  assert.equal(RECEITAS_DE_CASTELO.length, 17);
  for (const id of IDS) { const r = RECEITAS[id]; assert.ok(r, id); assert.equal(r.kit, 'fantasia'); assert.deepEqual(r.generos, ['fantasia']); assert.ok(r.tags.every(t => t === t.toLowerCase())); }
  for (const id of ['escada.madeira', 'escada.pedra', 'escada.caracol', 'escada.de-mao', 'alcapao']) assert.equal(RECEITAS[id]!.categoria, 'decoracao', id);
  for (const id of ['mesa.cavalete', 'mesa.banquete', 'mesa.redonda-rustica', 'bancada.trabalho']) assert.equal(RECEITAS[id]!.categoria, 'mesas', id);
  for (const id of ['enxergao', 'monte-de-palha', 'saco-de-dormir', 'cama.dossel', 'beliche']) assert.equal(RECEITAS[id]!.categoria, 'camas', id);
  for (const id of ['trono', 'banqueta', 'cadeira.espaldar']) assert.equal(RECEITAS[id]!.categoria, 'assentos', id);
});

test('escadas e mesas com campo mudam de pegada e respeitam os limites', () => {
  const casos: [string, string, number, number, number, number][] = [
    ['escada.madeira', 'largura', 0.8, 2.4, 1.2, 0], ['escada.madeira', 'comprimento', 1.6, 5, 2.6, 1], ['escada.pedra', 'largura', 1, 4, 1.4, 0], ['escada.pedra', 'comprimento', 1.6, 6, 2.8, 1],
    ['escada.caracol', 'diametro', 1.6, 3.6, 2.2, 0], ['escada.de-mao', 'comprimento', 1.6, 4, 2.4, 1],
    ['mesa.cavalete', 'largura', 1.4, 4, 2.2, 0], ['mesa.banquete', 'largura', 2.4, 7, 4, 0], ['mesa.redonda-rustica', 'diametro', 0.8, 2, 1.1, 0], ['bancada.trabalho', 'largura', 1.2, 3, 1.8, 0],
  ];
  for (const [id, campo, min, max, pad, eixo] of casos) {
    assert.equal(pegadaDaReceita(id)[eixo], pad, `${id} padrão`);
    assert.equal(pegadaDaReceita(id, { [campo]: max - 0.1 })[eixo], max - 0.1, `${id}.${campo}`);
    assert.equal(pegadaDaReceita(id, { [campo]: 999 })[eixo], max, `${id} máx`);
    assert.equal(pegadaDaReceita(id, { [campo]: -5 })[eixo], min, `${id} mín`);
  }
});

test('nas escadas retas o z dos degraus cresce de +y para −y', () => {
  for (const id of ['escada.madeira', 'escada.pedra', 'escada.de-mao']) {
    const ps = partes(id), l = pegadaDaReceita(id)[1];
    const embaixo = ps.filter(p => cy(p) > l / 6), emCima = ps.filter(p => cy(p) < -l / 6);
    assert.ok(embaixo.length && emCima.length, id);
    assert.ok(zMax(emCima) > zMax(embaixo), `${id}: ${zMax(emCima)} <= ${zMax(embaixo)}`);
    const degraus = ps.filter(p => p.forma === 'ret' && p.alfa === undefined && p.h! < 0.4 && p.w! > 0.3 && cy(p) > -l / 2 + 0.05).sort((a, b) => b.y! - a.y!);
    for (let i = 1; i < degraus.length; i++) assert.ok(degraus[i]!.z >= degraus[i - 1]!.z, `${id}: degrau ${i}`);
  }
});

test('a escada em caracol tem de 12 a 16 degraus em cunha e pelo menos 10 alturas distintas', () => {
  for (const d of [1.6, 2.2, 3.6]) {
    const ps = partes('escada.caracol', { diametro: d }), cunhas = ps.filter(p => p.forma === 'poli');
    assert.ok(cunhas.length >= 12 && cunhas.length <= 16, `${d}: ${cunhas.length}`);
    assert.ok(new Set(cunhas.map(p => p.z)).size >= 10);
  }
});

test('a mesa de banquete com mais largura tem mais partes', () => {
  assert.ok(partes('mesa.banquete', { largura: 7 }).length > partes('mesa.banquete', { largura: 2.4 }).length);
});

test('o monte de palha varia com a semente', () => {
  assert.deepEqual(partes('monte-de-palha', {}, 4), partes('monte-de-palha', {}, 4));
  assert.notDeepEqual(partes('monte-de-palha', {}, 4), partes('monte-de-palha', {}, 5));
});

test('as camas usam o material pedido', () => {
  assert.ok(partes('enxergao', { cobertor: 'tecido.cinza' }).some(p => p.mat === 'tecido.cinza'));
  assert.ok(partes('saco-de-dormir', { manta: 'tecido.mostarda' }).some(p => p.mat === 'tecido.mostarda'));
  assert.ok(partes('cama.dossel', { tecido: 'tecido.verde' }).some(p => p.mat === 'tecido.verde'));
  assert.ok(!partes('cama.dossel', { tecido: 'tecido.verde' }).some(p => p.mat === 'tecido.veludo-vinho'));
});

test('o alçapão fica rente ao chão', () => assert.ok(zMax(partes('alcapao')) < 0.1));
