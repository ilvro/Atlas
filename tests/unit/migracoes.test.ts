import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { mapaCompleto } from './fixtures.ts';

test('migração 6→7: a grade ganha personalização visual e desacoplamento do encaixe', () => {
  const atual = mapaCompleto();
  const v6 = structuredClone(atual) as unknown as Record<string, any>;
  v6.version = 6;
  delete v6.grid.snap;
  delete v6.grid.lineStyle;
  delete v6.grid.color;
  delete v6.grid.opacity;
  delete v6.grid.lineWidth;

  const lido = lerMapa(v6);
  assert.equal(lido.version, 8);
  assert.equal(lido.grid.snap, true);
  assert.equal(lido.grid.lineStyle, 'solid');
  assert.equal(lido.grid.color, 'auto');
  assert.equal(lido.grid.opacity, 0.1);
  assert.equal(lido.grid.lineWidth, 1);
  assert.deepEqual(lido, atual, 'a migração restaura todos os novos campos no padrão');
  assert.equal(v6.version, 6, 'o original não é tocado');
});

test('migração 7→8: momentos adicionados vazios sem perder nada', () => {
  const atual = mapaCompleto();
  const v7 = structuredClone(atual) as unknown as Record<string, any>;
  v7.version = 7;
  delete v7.moments;

  const lido = lerMapa(v7);
  assert.equal(lido.version, 8);
  assert.deepEqual(lido.moments, {});
  assert.deepEqual(lido, atual, 'a migração restaura moments: {}');
  assert.equal(v7.version, 7, 'o original não é tocado');
});
