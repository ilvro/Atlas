import test from 'node:test';
import assert from 'node:assert/strict';
import { amostrar, amostrarSemRepeticao, mapaDeGradiente, pesoDaCamada, type Pixels } from '../../src/procedural/textura-de-terreno.ts';
import { valueNoise2D } from '../../src/procedural/ruido.ts';

const imagem = (largura: number, altura: number, f: (i: number, j: number) => number[]): Pixels => {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let j = 0; j < altura; j++) for (let i = 0; i < largura; i++) dados.set(f(i, j), (j * largura + i) * 4);
  return { dados, largura, altura };
};
const perto = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) <= e, `${a} != ${b}`);

test('amostrar interpola e volta nas bordas', () => {
  const t = imagem(2, 1, (i) => (i === 0 ? [0, 0, 0, 255] : [100, 200, 40, 255]));
  const o = [0, 0, 0, 0];
  amostrar(t, 0.5, 0.5, o); assert.deepEqual(o, [0, 0, 0, 255]);
  amostrar(t, 1.0, 0.5, o); perto(o[0]!, 50); perto(o[1]!, 100);
  amostrar(t, 2.0, 0.5, o); perto(o[0]!, 50);
  amostrar(t, 2.5, 0.5, o); perto(o[0]!, 0);
  amostrar(t, 2.5 + 20, 0.5 + 7, o); perto(o[0]!, 0);
  amostrar(t, -0.5, 0.5, o); perto(o[0]!, 100);
});

test('textura de cor única só varia no brilho, dentro de ±8%', () => {
  const t = imagem(8, 8, () => [100, 150, 200, 255]);
  const r = valueNoise2D(3), o = [0, 0, 0, 0];
  for (let i = 0; i < 400; i++) {
    amostrarSemRepeticao(t, 32, i * 0.73 - 50, i * 1.31 + 9, r, o);
    for (const [k, c] of [[0, 100], [1, 150], [2, 200]] as const) assert.ok(o[k]! >= c * 0.92 - 1e-9 && o[k]! <= c * 1.08 + 1e-9);
    perto(o[3]!, 255, 1e-9);
  }
});

test('amostrarSemRepeticao é determinístico', () => {
  const t = imagem(4, 4, (i, j) => [i * 60, j * 60, (i + j) * 30, 255]);
  const a = [0, 0, 0, 0], b = [0, 0, 0, 0];
  amostrarSemRepeticao(t, 16, 12.3, -4.4, valueNoise2D(5), a);
  amostrarSemRepeticao(t, 16, 12.3, -4.4, valueNoise2D(5), b);
  assert.deepEqual(a, b);
});

test('pesoDaCamada: sem máscara vale 1; limiar 1 nunca entra; limiar 0 com borda entra', () => {
  const r = valueNoise2D(9);
  assert.equal(pesoDaCamada({ textura: 'a' }, 1, 2, r), 1);
  const fechada = { textura: 'b', mascara: { freq: 0.3, limiar: 1, suave: 0.1, semente: 4 } };
  const aberta = { textura: 'b', mascara: { freq: 0.3, limiar: -0.5, suave: 0.1, semente: 4 } };
  for (let i = 0; i < 300; i++) {
    assert.equal(pesoDaCamada(fechada, i * 0.37, i * 0.91, r), 0);
    assert.equal(pesoDaCamada(aberta, i * 0.37, i * 0.91, r), 1);
  }
});

test('mapaDeGradiente: força 0 não muda; força 1 leva preto ao escuro e branco ao claro', () => {
  const E = [10, 20, 30] as const, B = [100, 120, 80] as const, C = [220, 230, 200] as const;
  let o = [77, 120, 200, 255];
  mapaDeGradiente(o, E, B, C, 0); assert.deepEqual(o, [77, 120, 200, 255]);
  o = [0, 0, 0, 255]; mapaDeGradiente(o, E, B, C, 1); assert.deepEqual(o, [10, 20, 30, 255]);
  o = [255, 255, 255, 255]; mapaDeGradiente(o, E, B, C, 1); for (let k = 0; k < 3; k++) perto(o[k]!, C[k]!);
  o = [128, 128, 128, 255]; mapaDeGradiente(o, E, B, C, 1); for (let k = 0; k < 3; k++) assert.ok(Math.abs(o[k]! - B[k]!) < 2);
});
