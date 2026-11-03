import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROTULOS_DE_ESTADO, aparenciaDoEstado } from '../../src/domain/figuras.ts';
import { ESTADOS_FIGURA } from '../../src/domain/mapa.ts';

test('todo estado tem rótulo em português e uma aparência', () => {
  assert.equal(ESTADOS_FIGURA.length, 6);
  for (const e of ESTADOS_FIGURA) { assert.ok(ROTULOS_DE_ESTADO[e]); const a = aparenciaDoEstado(e); assert.ok(a.pulso >= 0 && a.pulso <= 1 && a.tremor >= 0 && a.tremor <= 1); for (const c of [a.anel, a.tinta]) if (c) assert.match(c, /^#[0-9a-f]{6}$/i); }
});

test('os seis estados: normal não muda nada; ferido tem anel vermelho; morrendo pulsa; inconsciente e morto deitam, cinzentos, e só o morto tem X; enlouquecendo treme e é roxo', () => {
  assert.deepEqual(aparenciaDoEstado('normal'), { anel: null, tinta: null, deitado: false, pulso: 0, tremor: 0, marca: null });
  const ferido = aparenciaDoEstado('hurt'); assert.equal(ferido.anel, '#e0342c'); assert.equal(ferido.deitado, false); assert.equal(ferido.pulso, 0);
  const morrendo = aparenciaDoEstado('dying'); assert.equal(morrendo.pulso, 1); assert.equal(morrendo.anel, '#e0342c'); assert.equal(morrendo.deitado, false);
  const inconsciente = aparenciaDoEstado('unconscious'), morto = aparenciaDoEstado('dead');
  assert.equal(inconsciente.deitado, true); assert.equal(morto.deitado, true); assert.ok(inconsciente.tinta && morto.tinta); assert.equal(inconsciente.marca, null); assert.equal(morto.marca, 'x');
  const louco = aparenciaDoEstado('maddened'); assert.equal(louco.tremor, 1); assert.equal(louco.anel, '#9b59d9'); assert.equal(louco.deitado, false);
  assert.equal(new Set(ESTADOS_FIGURA.map(e => JSON.stringify(aparenciaDoEstado(e)))).size, 6, 'cada estado tem uma cara própria');
});
