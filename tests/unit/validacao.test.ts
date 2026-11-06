import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { mapaCompleto } from './fixtures.ts';

const caminhoDoErro = (m: unknown) => {
  try {
    validarMapa(m);
    return null;
  } catch (e) {
    if (e instanceof ErroDeValidacao) return e.caminho;
    throw e;
  }
};

const mexer = (fn: (m: any) => void) => {
  const m = structuredClone(mapaCompleto());
  fn(m);
  return m;
};

test('v7: validação dos campos de personalização e tipo da grade', () => {
  assert.equal(caminhoDoErro(mexer(() => {})), null);

  // kind
  assert.equal(caminhoDoErro(mexer(x => { x.grid.kind = 'hex'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.kind = 'triangular'; })), 'grid.kind');

  // snap
  assert.equal(caminhoDoErro(mexer(x => { x.grid.snap = false; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.snap = 'nao'; })), 'grid.snap');

  // lineStyle
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'dashed'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'dotted'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'corners'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineStyle = 'ondulada'; })), 'grid.lineStyle');

  // color
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = 'auto'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = '#ffffff'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = '#ff1f1f'; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = 'vermelho'; })), 'grid.color');
  assert.equal(caminhoDoErro(mexer(x => { x.grid.color = '#fff'; })), 'grid.color');

  // opacity
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 0.05; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 1; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 0.04; })), 'grid.opacity');
  assert.equal(caminhoDoErro(mexer(x => { x.grid.opacity = 1.1; })), 'grid.opacity');

  // lineWidth
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 0.5; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 5; })), null);
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 0.4; })), 'grid.lineWidth');
  assert.equal(caminhoDoErro(mexer(x => { x.grid.lineWidth = 5.1; })), 'grid.lineWidth');
});
