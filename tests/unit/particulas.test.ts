import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DENSIDADE, TETO_DE_PARTICULAS, alfaDaNeblina, inclinacaoDaChuva, quantidade } from '../../src/render/particulas-config.ts';

test('a quantidade cresce com a área e a intensidade, e tem teto', () => {
  assert.equal(quantidade(2, 100, 0), 0); assert.equal(quantidade(2, 0, 1), 0); assert.equal(quantidade(2, 100, -1), 0);
  assert.equal(quantidade(2, 100, 1), 200); assert.equal(quantidade(2, 100, 0.5), 100);
  assert.ok(quantidade(2, 400, 1) > quantidade(2, 100, 1));
  assert.equal(quantidade(2, 100, 5), 200, 'a intensidade passa de 1 não conta');
  assert.equal(quantidade(DENSIDADE.chuva, 45 * 30, 1), 2970);
  assert.equal(quantidade(DENSIDADE.chuva, 600 * 600, 1), TETO_DE_PARTICULAS, 'um mapa enorme não passa do teto');
  assert.equal(quantidade(10, 100, 1, 50), 50, 'o teto pode ser outro');
});

test('a chuva se inclina para o lado do vento, na razão de 0,4', () => {
  assert.equal(inclinacaoDaChuva(0), -0); assert.ok(Math.abs(inclinacaoDaChuva(0)) === 0);
  assert.ok(inclinacaoDaChuva(1) < 0 && inclinacaoDaChuva(-1) > 0, 'sinais opostos para ventos opostos');
  assert.ok(Math.abs(inclinacaoDaChuva(1) + Math.atan(0.4)) < 1e-12);
  assert.ok(Math.abs(inclinacaoDaChuva(0.5)) < Math.abs(inclinacaoDaChuva(1)));
});

test('a neblina vai de transparente até 55% de opacidade', () => {
  assert.equal(alfaDaNeblina(0), 0); assert.equal(alfaDaNeblina(1), 0.55); assert.equal(alfaDaNeblina(2), 0.55); assert.equal(alfaDaNeblina(-1), 0);
  assert.ok(Math.abs(alfaDaNeblina(0.5) - 0.275) < 1e-12);
});
