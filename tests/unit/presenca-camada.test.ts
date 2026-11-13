import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PINCEIS_DE_PRESENCA, pincelDePresenca } from '../../src/domain/presets.ts';
import { ampliacaoDaMascara, camadaDaPresenca, opacidadeDaPresenca } from '../../src/render/presenca-camada.ts';

test('os pincéis de chão ficam sob os objetos e só o que é do ar fica acima', () => {
  for (const id of ['musgo', 'mofo', 'poca', 'sangue-seco', 'fuligem', 'sulcos']) assert.equal(camadaDaPresenca(pincelDePresenca(id)), 'chao', id);
  assert.equal(camadaDaPresenca(pincelDePresenca('algas')), 'submerso');
  assert.equal(camadaDaPresenca(pincelDePresenca('sombra')), 'abaixo');
  assert.equal(camadaDaPresenca(pincelDePresenca('ordem.morte')), 'abaixo');
  for (const p of PINCEIS_DE_PRESENCA.filter(p => p.brilho)) assert.equal(camadaDaPresenca(p), 'acima', p.id);
});

test('a presença é translúcida: mesmo na intensidade máxima a opacidade fica bem abaixo de 1', () => {
  assert.ok(opacidadeDaPresenca(0.45) < 0.4);
  assert.ok(opacidadeDaPresenca(1) <= 0.6);
  assert.ok(opacidadeDaPresenca(2) <= 0.6);
  assert.ok(opacidadeDaPresenca(0.2) < opacidadeDaPresenca(0.8));
});

test('a máscara ganha resolução acima da célula, sem estourar o tamanho da textura', () => {
  assert.equal(ampliacaoDaMascara(100, 80), 4);
  assert.equal(ampliacaoDaMascara(1000, 500), 2);
  assert.equal(ampliacaoDaMascara(5000, 10), 1);
});

test('na cena, a tinta do chão fica sobre os cômodos, sob as escarpas e sob os objetos de piso', async () => {
  const { readFileSync } = await import('node:fs');
  const fonte = readFileSync(new URL('../../src/render/cena.ts', import.meta.url), 'utf8');
  const linha = fonte.split('\n').find(l => l.includes('raiz.addChild('))!;
  const pos = (nome: string) => linha.indexOf(nome);
  const ordem = ['agua.raiz', 'comodosC', 'presenca.chao', 'escarpasC', 'objetosC', 'presenca.abaixo', 'luz.sprite', 'presenca.acima'].map(pos);
  assert.ok(ordem.every(p => p >= 0));
  assert.deepEqual([...ordem].sort((a, b) => a - b), ordem);
});

test('a espuma não cerca plantas nem coisas finas, mas cerca pedras e troncos', async () => {
  const { geraAnelDeEspuma, forcaDoAnel } = await import('../../src/render/espuma.ts');
  const receita = (recipe: string) => ({ kind: 'recipe' as const, recipe, seed: 1, params: {} });
  for (const id of ['junco', 'vitoria-regia', 'tufo-de-grama', 'galho-seco', 'raiz-exposta']) assert.equal(geraAnelDeEspuma(receita(id), [1.5, 1.5]), false, id);
  for (const id of ['tronco.caido', 'rochedo', 'laje-de-pedra', 'coluna-caida']) assert.equal(geraAnelDeEspuma(receita(id), [2, 1]), true, id);
  assert.ok(forcaDoAnel([0.6, 0.6]) < forcaDoAnel([3, 2]));
  assert.ok(forcaDoAnel([9, 9]) <= 1);
});
