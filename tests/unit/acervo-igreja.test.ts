import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, listaDeReceitas, pegadaDaReceita, receitaDe } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DE_IGREJA } from '../../src/procedural/receitas/igreja.ts';

const PISO = ['pulpito', 'pia-batismal', 'confessionario', 'genuflexorio', 'atril', 'tocheiro', 'velas-votivas', 'sarcofago', 'caixao', 'orgao-de-tubos', 'relicario', 'imagem-de-santo', 'passadeira', 'sino'];
const PAREDE = ['crucifixo', 'vitral', 'pia-de-agua-benta', 'icone.parede'];
const partes = (id: string, params: Record<string, unknown> = {}, seed = 3) => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };
const largura = (id: string, params: Record<string, unknown> = {}) => { const d = descreverReceita(id, { seed: 1, params }); return d.tipo === 'parede' ? d.largura : NaN; };

test('as 18 receitas de igreja existem, com o tipo certo e a função capela', () => {
  assert.equal(RECEITAS_DE_IGREJA.length, 18);
  for (const id of PISO) assert.equal(receitaDe(id)?.tipo, 'piso', id);
  for (const id of PAREDE) assert.equal(receitaDe(id)?.tipo, 'parede', id);
  for (const r of RECEITAS_DE_IGREJA) assert.ok(r.funcoes.includes('capela'), r.id);
  for (const id of ['sarcofago', 'caixao']) assert.ok(receitaDe(id)!.funcoes.includes('porao'), id);
  assert.equal(new Set(listaDeReceitas().map(r => r.id)).size, listaDeReceitas().length);
});

test('a passadeira responde a largura e comprimento, presos aos limites', () => {
  assert.deepEqual(pegadaDaReceita('passadeira'), [1.4, 6]);
  assert.deepEqual(pegadaDaReceita('passadeira', { largura: 2, comprimento: 10 }), [2, 10]);
  assert.deepEqual(pegadaDaReceita('passadeira', { largura: 50, comprimento: 500 }), [2.5, 14]);
  assert.deepEqual(pegadaDaReceita('passadeira', { largura: 0, comprimento: 0 }), [1, 2]);
  assert.ok(partes('passadeira').every(p => p.z <= 0.05));
});

test('o vitral responde à largura e respeita os limites', () => {
  assert.equal(largura('vitral'), 1.2);
  assert.equal(largura('vitral', { largura: 2 }), 2);
  assert.equal(largura('vitral', { largura: 9 }), 2.4);
  assert.equal(largura('vitral', { largura: 0.1 }), 0.8);
  assert.ok(partes('vitral').some(p => p.vidro));
});

test('vitral, velas votivas e imagem de santo variam com a semente e são determinísticos', () => {
  for (const id of ['vitral', 'velas-votivas', 'imagem-de-santo']) {
    assert.deepEqual(partes(id, {}, 5), partes(id, {}, 5), id);
    assert.ok([1, 2, 3, 4, 6, 7, 8].some(s => JSON.stringify(partes(id, {}, s)) !== JSON.stringify(partes(id, {}, 5))), id);
  }
});

test('o caixão usa a madeira pedida', () => {
  assert.ok(partes('caixao').some(p => p.mat === 'madeira.escura'));
  assert.ok(partes('caixao', { madeira: 'madeira.clara' }).some(p => p.mat === 'madeira.clara'));
  assert.ok(!partes('caixao', { madeira: 'madeira.clara' }).some(p => p.mat === 'madeira.escura'));
});
