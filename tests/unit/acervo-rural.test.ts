import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, listaDeReceitas, pegadaDaReceita, receitaDe } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_RURAIS } from '../../src/procedural/receitas/rural.ts';

const partes = (id: string, params: Record<string, unknown> = {}, seed = 3) => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };
const CEMITERIO = ['cruz.madeira', 'cruz.pedra', 'tumulo', 'cova', 'cova.aberta', 'jazigo', 'anjo', 'grade.ferro', 'portao.ferro'];
const RURAL = ['pas.moinho', 'pilha-de-lenha', 'varal', 'galinheiro', 'espantalho', 'barril-de-chuva', 'poste-de-amarracao', 'monte-de-neve', 'carroca-de-feno', 'lanterna.farol'];

test('o kit rural tem as peças de cemitério e de vida rural, no kit rural, com ids únicos', () => {
  assert.equal(RECEITAS_RURAIS.length, CEMITERIO.length + RURAL.length);
  for (const id of [...CEMITERIO, ...RURAL]) assert.equal(receitaDe(id)?.kit, 'rural', id);
  for (const id of CEMITERIO) assert.ok(receitaDe(id)!.funcoes.includes('cemiterio'), id);
  assert.equal(new Set(listaDeReceitas().map(r => r.id)).size, listaDeReceitas().length);
});

test('a lápide tem cinco modelos, varia com a semente e é determinística', () => {
  assert.deepEqual(pegadaDaReceita('lapide'), [0.62, 0.32]);
  const modelos = [1, 2, 3, 4, 5].map(m => JSON.stringify(partes('lapide', { modelo: m }, 4)));
  assert.equal(new Set(modelos).size, 5, 'cada modelo desenha diferente');
  assert.deepEqual(partes('lapide', {}, 8), partes('lapide', {}, 8));
  assert.ok([1, 2, 3, 4, 5, 6].some(s => JSON.stringify(partes('lapide', {}, s)) !== JSON.stringify(partes('lapide', {}, 7))));
});

test('campos de tamanho respondem e ficam presos aos limites', () => {
  assert.deepEqual(pegadaDaReceita('grade.ferro', { largura: 4 }), [4, 0.14]);
  assert.deepEqual(pegadaDaReceita('grade.ferro', { largura: 99 }), [6, 0.14]);
  assert.deepEqual(pegadaDaReceita('pas.moinho'), [7, 7]);
  assert.deepEqual(pegadaDaReceita('pas.moinho', { raio: 5 }), [10, 10]);
  assert.deepEqual(pegadaDaReceita('monte-de-neve', { tamanho: 2 }), [4, 2.8]);
  assert.ok(partes('cova', { fresca: 0 }).some(p => p.mat === '#56603e'), 'cova antiga tem capim');
});
