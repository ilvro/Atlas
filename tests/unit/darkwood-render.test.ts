import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aplicarPenumbraDarkwood } from '../../src/render/composicao-de-luz.ts';
import { modoDeMemoriaEfetivo } from '../../src/render/nevoa.ts';

test('aplicarPenumbraDarkwood preserva a cor em visivel=1 e dessatura/escurece em tom frio em visivel=0', () => {
  const quente: readonly [number, number, number] = [0.9, 0.5, 0.2];
  const dentro = aplicarPenumbraDarkwood(quente, 1);
  assert.deepEqual(dentro, [0.9, 0.5, 0.2]);

  const fora = aplicarPenumbraDarkwood(quente, 0);
  const lumAntes = 0.299 * quente[0] + 0.587 * quente[1] + 0.114 * quente[2];
  const lumDepois = 0.299 * fora[0] + 0.587 * fora[1] + 0.114 * fora[2];
  assert.ok(lumDepois < lumAntes * 0.6 && lumDepois > 0.05, `escurece preservando contraste: ${lumDepois} vs ${lumAntes}`);

  // Cinza neutro fora do cone adquire matiz frio azulado (B > G > R)
  const cinzaFora = aplicarPenumbraDarkwood([0.6, 0.6, 0.6], 0);
  assert.ok(cinzaFora[2] > cinzaFora[1] && cinzaFora[1] > cinzaFora[0], `tom frio azulado: ${cinzaFora}`);

  // Cor quente saturada perde forte saturação fora do cone (spread R-B encolhe drasticamente)
  const spreadAntes = quente[0] - quente[2];
  const spreadDepois = Math.abs(fora[0] - fora[2]);
  assert.ok(spreadDepois < spreadAntes * 0.2, `dessaturação forte: ${spreadDepois} vs ${spreadAntes}`);

  // Interpolação intermediária e clamp fora de [0, 1]
  const meio = aplicarPenumbraDarkwood(quente, 0.5);
  assert.ok(Math.abs(meio[0] - (fora[0] + dentro[0]) / 2) < 1e-12);
  assert.deepEqual(aplicarPenumbraDarkwood(quente, 2), dentro);
  assert.deepEqual(aplicarPenumbraDarkwood(quente, -1), fora);
});

test('modoDeMemoriaEfetivo respeita mode explícito e fallback de sketch', () => {
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: true, paper: '#fff', ink: '#000', mode: 'darkwood' } }), 'darkwood');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: false, paper: '#fff', ink: '#000', mode: 'darkwood' } }), 'darkwood');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: true, paper: '#fff', ink: '#000' } }), 'sketch');
  assert.equal(modoDeMemoriaEfetivo({ memory: { sketch: false, paper: '#fff', ink: '#000' } }), 'shroud');
});
