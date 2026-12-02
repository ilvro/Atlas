import assert from 'node:assert/strict';
import test from 'node:test';
import { alfaDaSombraNaPeca } from '../../src/render/filtro-pecas.ts';
import { criarEventosDeCena } from '../../src/render/eventos-de-cena.ts';

test('alfaDaSombraNaPeca: esconde na escuridão completa, transita suavemente na penumbra e exibe por inteiro na luz', () => {
  assert.equal(alfaDaSombraNaPeca(0), 0);
  assert.equal(alfaDaSombraNaPeca(0.03), 0);
  const meio = alfaDaSombraNaPeca(0.0975);
  assert.ok(meio > 0.45 && meio < 0.55, `esperado ~0.5 na penumbra, veio ${meio}`);
  assert.equal(alfaDaSombraNaPeca(0.16), 1);
  assert.equal(alfaDaSombraNaPeca(0.8), 1);
});

test('criarEventosDeCena: intensidade do tremor escala a amplitude do deslocamento', () => {
  const ev = criarEventosDeCena(() => false);
  ev.disparar('tremor', 1000, 1);
  const base = ev.estado(1050).tremor;
  ev.disparar('tremor', 1000, 2);
  const dobro = ev.estado(1050).tremor;
  ev.disparar('tremor', 1000, 0.5);
  const metade = ev.estado(1050).tremor;

  assert.ok(Math.abs(dobro[0] - base[0] * 2) < 1e-6);
  assert.ok(Math.abs(dobro[1] - base[1] * 2) < 1e-6);
  assert.ok(Math.abs(metade[0] - base[0] * 0.5) < 1e-6);
  assert.ok(Math.abs(metade[1] - base[1] * 0.5) < 1e-6);
});
