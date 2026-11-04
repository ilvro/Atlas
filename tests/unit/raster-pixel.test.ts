import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elipse, ret } from '../../src/procedural/descricao.ts';
import { contornarPixels, degrauDeAltura, parteVisivel, partesDoPixel } from '../../src/procedural/estilos/partes-pixel.ts';

test('parteVisivel: some o que tem menos de 1 px; detalhe 3 some abaixo de 24 px por célula e detalhe 2 abaixo de 12', () => {
  const res = 16 / 1.5;
  assert.equal(parteVisivel({ detalhe: undefined, maiorLado: 0.05 }, 16, res), false, '0,05 m a 10,7 px/m é meio pixel');
  assert.equal(parteVisivel({ detalhe: undefined, maiorLado: 0.2 }, 16, res), true);
  assert.equal(parteVisivel({ detalhe: 3, maiorLado: 1 }, 16, res), false);
  assert.equal(parteVisivel({ detalhe: 3, maiorLado: 1 }, 24, 24 / 1.5), true);
  assert.equal(parteVisivel({ detalhe: 2, maiorLado: 1 }, 12, 12 / 1.5), true);
  assert.equal(parteVisivel({ detalhe: 2, maiorLado: 1 }, 8, 8 / 1.5), false);
  assert.equal(parteVisivel({ detalhe: 3, maiorLado: 1 }, undefined, res), true, 'sem ppc (faces) nada é cortado por detalhe');
});

test('partesDoPixel: filtra pelo detalhe e ordena pela altura', () => {
  const partes = [ret(0, 0, 1, 1, 'madeira.media', 0.8), ret(0, 0, 0.5, 0.5, 'madeira.clara', 0.2), elipse(0, 0, 0.3, 0.3, 'latao', 1.2, { detalhe: 3 }), elipse(0, 0, 0.3, 0.3, 'latao', 0.9, { detalhe: 2 })];
  assert.deepEqual(partesDoPixel(partes, 16, 16 / 1.5).map(p => p.z), [0.2, 0.8, 0.9]);
  assert.deepEqual(partesDoPixel(partes, 32, 32 / 1.5).map(p => p.z), [0.2, 0.8, 0.9, 1.2]);
  assert.deepEqual(partesDoPixel(partes, 8, 8 / 1.5).map(p => p.z), [0.2, 0.8]);
});

test('degrauDeAltura: três degraus', () => {
  assert.deepEqual([0.1, 0.49, 0.5, 1.4, 1.5, 3].map(degrauDeAltura), [0, 0, 1, 1, 2, 2]);
});

test('contornarPixels: 1 px de tinta em volta do sólido, sem tocar no sólido e sem alargar', () => {
  const w = 5, h = 5, d = new Uint8ClampedArray(w * h * 4); d[(2 * w + 2) * 4 + 3] = 255;
  contornarPixels(d, w, h);
  const alfa = (x: number, y: number) => d[(y * w + x) * 4 + 3];
  for (const [x, y] of [[2, 1], [1, 2], [3, 2], [2, 3]] as const) assert.equal(alfa(x, y), 255, `${x},${y}`);
  assert.equal(alfa(1, 1), 0, 'a diagonal não ganha contorno'); assert.equal(alfa(0, 2), 0); assert.equal(alfa(2, 2), 255);
});

import { ALFA_DA_SOMBRA, uniformizarSombra } from '../../src/procedural/estilos/partes-pixel.ts';
test('uniformizarSombra: todo alfa parcial vira o alfa da sombra; sólido e vazio ficam', () => {
  const d = new Uint8ClampedArray([0, 0, 0, 0, 0, 0, 0, 115, 0, 0, 0, 178, 0, 0, 0, 213, 0, 0, 0, 255]);
  uniformizarSombra(d);
  assert.deepEqual([3, 7, 11, 15, 19].map(i => d[i]), [0, ALFA_DA_SOMBRA, ALFA_DA_SOMBRA, ALFA_DA_SOMBRA, 255]);
});
