import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAIS } from '../../src/procedural/materiais.ts';
import { PADROES_PIXEL, encaixarNaGrade, misturarHex, tonsDe } from '../../src/procedural/estilos/materiais-pixel.ts';
import { estiloDe } from '../../src/procedural/estilos/index.ts';

test('o Pixel sabe pintar todo padrão de todo material do catálogo', () => {
  const usados = new Set(Object.values(MATERIAIS).map(m => m.padrao));
  for (const p of usados) assert.ok(PADROES_PIXEL.includes(p), `falta o padrão ${p}`);
});

test('misturarHex e tonsDe: cores hex válidas, extremos e meio', () => {
  assert.equal(misturarHex('#000000', '#ffffff', 0), '#000000');
  assert.equal(misturarHex('#000000', '#ffffff', 1), '#ffffff');
  assert.equal(misturarHex('#000000', '#ffffff', 0.5), '#808080');
  for (const c of Object.values(tonsDe(MATERIAIS['tabuas.carvalho']!))) assert.match(c, /^#[0-9a-f]{6}$/);
});

test('encaixarNaGrade: cai num pixel do dispositivo, com deslocamento e inversão', () => {
  assert.equal(encaixarNaGrade(1.04, 10, 0), 1);
  assert.ok(Math.abs(encaixarNaGrade(1.0, 10, 0.3) * 10 + 0.3 - Math.round(1.0 * 10 + 0.3)) < 1e-9);
  assert.equal(encaixarNaGrade(0.26, -10, 0), 0.3);
});

test('a resolução do Pixel é pixelsPerCell / célula, igual para objeto, cômodo e terreno', () => {
  const pixel = estiloDe('pixel'), o = { ppc: 16, celula: 1.5 };
  for (const t of ['objeto', 'comodo', 'terreno'] as const) assert.equal(pixel.resolucao(t, o), 16 / 1.5);
  assert.equal(estiloDe('illustrated').resolucao('objeto', o), 96);
});
