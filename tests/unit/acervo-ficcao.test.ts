import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, pegadaDaReceita, receitaDe } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DE_FICCAO } from '../../src/procedural/receitas/ficcao.ts';

const partes = (id: string, params: Record<string, unknown> = {}, seed = 3) => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };
const IDS = ['console', 'cadeira.piloto', 'mesa.navegacao', 'terminal.crt', 'beliche.capsula', 'armario.metal', 'mesa.refeitorio', 'criotubo', 'tubulacao', 'grade.ventilacao', 'painel.eletrico', 'gerador', 'caixa.carga', 'conteiner', 'bancada.ferramentas', 'extintor', 'cabos', 'escotilha', 'maca.medica', 'scanner.corpo', 'mesa.laboratorio', 'armario.amostras'];

test('o kit de ficção científica tem as 22 peças, todas do gênero ficcao-cientifica', () => {
  assert.equal(RECEITAS_DE_FICCAO.length, IDS.length);
  for (const id of IDS) { const r = receitaDe(id); assert.ok(r, id); assert.equal(r.kit, 'ficcao'); assert.ok(r.generos?.includes('ficcao-cientifica'), id); assert.ok(r.tags.every(t => t === t.toLowerCase()), id); }
});

test('campos: largura do console, portas do armário, comprimento da tubulação e estado do criotubo', () => {
  assert.deepEqual(pegadaDaReceita('console', { largura: 3 }), [3, 0.8]);
  assert.deepEqual(pegadaDaReceita('console', { largura: 50 }), [4.8, 0.8]);
  assert.deepEqual(pegadaDaReceita('armario.metal', { portas: 5 }), [2, 0.5]);
  assert.deepEqual(pegadaDaReceita('tubulacao', { largura: 8 }), [8, 0.6]);
  const estados = [0, 1, 2].map(e => JSON.stringify(partes('criotubo', { estado: e })));
  assert.equal(new Set(estados).size, 3);
  assert.ok(partes('criotubo', { estado: 0 }).some(p => p.vidro), 'fechado tem tampa de vidro');
});

test('as peças são determinísticas e variam com a semente onde há sorteio', () => {
  for (const id of ['console', 'caixa.carga', 'cabos', 'bancada.ferramentas']) {
    assert.deepEqual(partes(id, {}, 5), partes(id, {}, 5), id);
    assert.ok([1, 2, 3, 4, 6, 7].some(s => JSON.stringify(partes(id, {}, s)) !== JSON.stringify(partes(id, {}, 5))), id);
  }
});
