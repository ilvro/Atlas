import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CORES_DA_PALETA, PALETAS_PIXEL, paletaDe } from '../../src/domain/paletas.ts';

test('toda paleta tem 32 cores hex válidas e distintas, e ids únicos', () => {
  assert.equal(new Set(PALETAS_PIXEL.map(p => p.id)).size, PALETAS_PIXEL.length);
  for (const p of PALETAS_PIXEL) {
    assert.equal(p.cores.length, CORES_DA_PALETA, p.id);
    for (const c of p.cores) assert.match(c, /^#[0-9a-f]{6}$/i, `${p.id}: ${c}`);
    assert.equal(new Set(p.cores.map(c => c.toLowerCase())).size, p.cores.length, `${p.id} repete cor`);
  }
});

test('paletaDe: id conhecido, e desconhecido cai na primeira (a do protótipo)', () => {
  assert.equal(paletaDe('fantasia-quente').id, 'fantasia-quente');
  assert.equal(paletaDe('xyz'), PALETAS_PIXEL[0]);
  assert.equal(PALETAS_PIXEL[0]!.id, 'investigacao-sepia');
});
