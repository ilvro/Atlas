import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desfocarAlfa } from '../../src/procedural/desfocar.ts';

const alfa = (a: number[][]) => { const h = a.length, w = a[0]!.length, d = new Uint8ClampedArray(w * h * 4); a.forEach((l, y) => l.forEach((v, x) => { d[(y * w + x) * 4 + 3] = v; d[(y * w + x) * 4] = 7; })); return { d, w, h }; };
const linha = (d: Uint8ClampedArray, w: number, y: number) => Array.from({ length: w }, (_, x) => d[(y * w + x) * 4 + 3]!);

test('um degrau vira uma rampa monotônica', () => {
  const w = 80, { d } = alfa([Array.from({ length: w }, (_, x) => (x < 40 ? 255 : 0))]);
  desfocarAlfa(d, w, 1, 4);
  const l = linha(d, w, 0);
  for (let x = 1; x < w; x++) assert.ok(l[x]! <= l[x - 1]!, `não monotônico em ${x}`);
  assert.ok(l[10]! > 250 && l[70]! < 5);
  assert.ok(l.filter((v) => v > 5 && v < 250).length >= 6, 'rampa larga o bastante');
});

test('a soma do alfa é preservada dentro de 2%', () => {
  const w = 60, h = 60, g: number[][] = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (x > 20 && x < 40 && y > 15 && y < 45 ? 255 : 0)));
  const { d } = alfa(g), antes = g.flat().reduce((s, v) => s + v, 0);
  desfocarAlfa(d, w, h, 3);
  const depois = linha(d, w * h, 0).reduce((s, v) => s + v, 0);
  assert.ok(Math.abs(depois - antes) / antes < 0.02, `${antes} -> ${depois}`);
});

test('o raio da rampa é compatível com o sigma (vira gaussiana de desvio ~sigma)', () => {
  const w = 101, sigma = 5, { d } = alfa([Array.from({ length: w }, (_, x) => (x === 50 ? 255 : 0))]);
  desfocarAlfa(d, w, 1, sigma);
  const l = linha(d, w, 0), s = l.reduce((a, v) => a + v, 0);
  let var2 = 0; l.forEach((v, x) => { var2 += (v / s) * (x - 50) ** 2; });
  assert.ok(Math.abs(Math.sqrt(var2) - sigma) < 0.6, `desvio ${Math.sqrt(var2)}`);
});

test('só o alfa muda; sigma 0 não faz nada; vertical borra também', () => {
  const { d, w, h } = alfa([[0, 0, 0], [0, 255, 0], [0, 0, 0]]);
  const copia = d.slice(); desfocarAlfa(d, w, h, 0); assert.deepEqual(d, copia);
  desfocarAlfa(d, w, h, 1);
  assert.ok(d[1 * 4 + 3]! > 0, 'o pixel de cima recebeu alfa (vertical)');
  for (let i = 0; i < w * h; i++) assert.equal(d[i * 4], 7, 'o vermelho não muda');
});
