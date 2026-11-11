import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, pegadaDaReceita, receitaDe } from '../../src/procedural/receitas/index.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { ehArvore } from '../../src/domain/camadas.ts';
import { catalogo } from '../../src/app/ponte-leitura.ts';

const partes = (id: string, params: Record<string, unknown> = {}, seed = 3) => {
  const d = descreverReceita(id, { seed, params });
  return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo];
};

test('as três receitas existem no catálogo e no acervo, com tipo piso e metadados certos', () => {
  for (const id of ['arvore-morta', 'carroca-tombada', 'laje-de-pedra']) {
    const r = receitaDe(id);
    assert.ok(r, `receita ${id} existe`);
    assert.equal(r.tipo, 'piso', id);
    assert.equal(r.categoria, 'exterior', id);
    assert.ok(r.tags.includes('pantano'), `${id} tem tag pantano`);
    assert.ok(ACERVO.item(id), `${id} existe no acervo`);

    const ps = partes(id);
    assert.ok(ps.length >= 6 && ps.length <= 25, `${id}: ${ps.length} partes (esperado de 6 a 25)`);
  }

  const cat = catalogo('receitas') as { id: string }[];
  for (const id of ['arvore-morta', 'carroca-tombada', 'laje-de-pedra']) {
    assert.ok(cat.some(r => r.id === id), `${id} está em atlas_catalogo`);
  }
});

test('arvore-morta: pegada, campos, galhos em leque e camada de árvore', () => {
  assert.deepEqual(pegadaDaReceita('arvore-morta'), [4, 4]);
  assert.deepEqual(pegadaDaReceita('arvore-morta', { tamanho: 5 }), [5, 5]);
  assert.deepEqual(pegadaDaReceita('arvore-morta', { tamanho: 2 }), [3, 3]);
  assert.deepEqual(pegadaDaReceita('arvore-morta', { tamanho: 10 }), [6, 6]);

  // Varia com a semente e é determinística
  assert.deepEqual(partes('arvore-morta', {}, 1), partes('arvore-morta', {}, 1));
  assert.notDeepEqual(partes('arvore-morta', {}, 1), partes('arvore-morta', {}, 2));

  // É reconhecida como árvore em pé para camadas
  assert.equal(ehArvore('arvore-morta'), true);

  // Tem galhos secos e raízes (partes com z elevado)
  const ps = partes('arvore-morta');
  assert.ok(ps.some(p => p.z >= 1.5), 'tem galhos altos');
});

test('carroca-tombada: pegada, carga espalhada e roda solta', () => {
  assert.deepEqual(pegadaDaReceita('carroca-tombada'), [3.6, 2.4]);

  const comCarga = partes('carroca-tombada', { carga: 1 }, 5);
  const semCarga = partes('carroca-tombada', { carga: 0 }, 5);
  assert.ok(comCarga.length > semCarga.length, 'com carga tem mais partes que sem carga');

  // Varia com a semente e é determinística
  assert.deepEqual(partes('carroca-tombada', {}, 3), partes('carroca-tombada', {}, 3));
  assert.notDeepEqual(partes('carroca-tombada', {}, 3), partes('carroca-tombada', {}, 4));

  // Tem roda deitada (círculos em ferro e madeira) e roda em pé
  assert.ok(semCarga.some(p => p.forma === 'elipse' && p.mat === 'ferro'), 'roda solta deitada no chão');
});

test('laje-de-pedra: pegada, rachaduras e musgo opcional', () => {
  assert.deepEqual(pegadaDaReceita('laje-de-pedra'), [3, 2]);
  assert.deepEqual(pegadaDaReceita('laje-de-pedra', { largura: 4, comprimento: 3 }), [4, 3]);
  assert.deepEqual(pegadaDaReceita('laje-de-pedra', { largura: 1, comprimento: 1 }), [2, 1.5]);
  assert.deepEqual(pegadaDaReceita('laje-de-pedra', { largura: 10, comprimento: 10 }), [4, 3.5]);

  const comMusgo = partes('laje-de-pedra', { musgo: 1 }, 7);
  const semMusgo = partes('laje-de-pedra', { musgo: 0 }, 7);
  assert.ok(comMusgo.length > semMusgo.length, 'com musgo tem partes de vegetação');

  // Varia com a semente e é determinística
  assert.deepEqual(partes('laje-de-pedra', {}, 7), partes('laje-de-pedra', {}, 7));
  assert.notDeepEqual(partes('laje-de-pedra', {}, 7), partes('laje-de-pedra', {}, 8));

  // Tem rachaduras (faixas escuras)
  assert.ok(semMusgo.some(p => p.mat === '#2e3036'), 'rachaduras presentes');
});
