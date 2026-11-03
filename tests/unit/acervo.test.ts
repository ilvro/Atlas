import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO, criarAcervo, type ItemParaOAcervo } from '../../src/procedural/acervo.ts';
import { listaDeReceitas, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';

const falso: ItemParaOAcervo = { id: 'casa:x', nome: 'Objeto X', categoria: 'decoracao', pegada: [1.2, 0.6], funcoes: ['sala'], tags: ['teste'], generos: ['investigacao'], kit: 'investigacao' };
const acervo = criarAcervo(listaDeReceitas(), [falso]);

test('o acervo conhece as receitas e a coleção, cada uma com a sua fonte', () => {
  assert.equal(acervo.lista().length, listaDeReceitas().length + 1);
  assert.equal(acervo.item('sofa')?.fonte, 'receita'); assert.equal(acervo.item('casa:x')?.fonte, 'colecao');
  assert.deepEqual(acervo.item('casa:x')?.campos, []); assert.deepEqual(acervo.item('casa:x')?.generos, ['investigacao']);
  assert.equal(acervo.item('nao-existe'), undefined);
  assert.ok(ACERVO.lista().length >= 22, 'o acervo de verdade tem as receitas da casa');
});

test('pegadaDaFonte: receita com parâmetros, item da coleção pelo catálogo e desconhecido [0,8, 0,8]', () => {
  assert.deepEqual(acervo.pegadaDaFonte({ kind: 'asset', assetId: 'casa:x' }), [1.2, 0.6]);
  assert.deepEqual(acervo.pegadaDaFonte({ kind: 'asset', assetId: 'casa:y' }), [0.8, 0.8]);
  assert.deepEqual(acervo.pegadaDaFonte({ kind: 'recipe', recipe: 'sofa', seed: 1, params: { largura: 3 } }), pegadaDaReceita('sofa', { largura: 3 }));
  assert.notDeepEqual(acervo.pegadaDaFonte({ kind: 'recipe', recipe: 'sofa', seed: 1, params: { largura: 3 } }), acervo.pegadaDaFonte({ kind: 'recipe', recipe: 'sofa', seed: 1, params: {} }));
  assert.deepEqual(acervo.pegadaDaFonte({ kind: 'recipe', recipe: 'nao-existe', seed: 1, params: {} }), [0.8, 0.8]);
});

test('fonte() põe um item no mapa e idDaFonte() volta ao id', () => {
  assert.deepEqual(acervo.fonte('casa:x', 7), { kind: 'asset', assetId: 'casa:x' });
  assert.deepEqual(acervo.fonte('sofa', 3, { largura: 2.5 }), { kind: 'recipe', recipe: 'sofa', seed: 3, params: { largura: 2.5 } });
  assert.deepEqual(acervo.fonte('sofa', 3), { kind: 'recipe', recipe: 'sofa', seed: 3, params: {} });
  assert.equal(acervo.idDaFonte({ kind: 'asset', assetId: 'casa:x' }), 'casa:x'); assert.equal(acervo.idDaFonte(acervo.fonte('sofa', 1)), 'sofa');
});
