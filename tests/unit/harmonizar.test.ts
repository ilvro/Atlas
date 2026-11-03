import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caixaDoConteudo, contorno, novosPixels, sobrepor, sombraDeContato, type Pixels } from '../../src/procedural/harmonizar.ts';

/** Uma imagem w × h transparente com um quadrado opaco (cor dada) de x0,y0 a x1,y1 (fim exclusivo). */
function quadrado(w: number, h: number, x0: number, y0: number, x1: number, y1: number, cor: [number, number, number] = [200, 40, 40]): Pixels {
  const p = novosPixels(w, h); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const o = (y * w + x) * 4; p.data[o] = cor[0]; p.data[o + 1] = cor[1]; p.data[o + 2] = cor[2]; p.data[o + 3] = 255; }
  return p;
}
const alfa = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3]!;

test('caixaDoConteudo acha o quadrado do meio e devolve null numa imagem vazia', () => {
  assert.deepEqual(caixaDoConteudo(quadrado(20, 16, 6, 4, 14, 10)), { x0: 6, y0: 4, x1: 14, y1: 10 });
  assert.equal(caixaDoConteudo(novosPixels(5, 5)), null);
  const fraco = quadrado(10, 10, 2, 2, 5, 5); for (let i = 0; i < 100; i++) fraco.data[i * 4 + 3] = Math.min(fraco.data[i * 4 + 3]!, 6);
  assert.equal(caixaDoConteudo(fraco), null, 'alfa abaixo do limiar não conta');
  assert.notEqual(caixaDoConteudo(fraco, 2), null);
});

test('contorno cresce 1 px para fora, na cor do nanquim, e não mexe no conteúdo', () => {
  const img = quadrado(20, 16, 6, 4, 14, 10), c = contorno(img, 1);
  assert.deepEqual(caixaDoConteudo(c), { x0: 5, y0: 3, x1: 15, y1: 11 }, '1 px a mais de cada lado');
  assert.deepEqual([...c.data.slice((5 * 20 + 6) * 4, (5 * 20 + 6) * 4 + 4)], [200, 40, 40, 255], 'o conteúdo fica igual');
  const o = (4 * 20 + 5) * 4, anel = [c.data[o]!, c.data[o + 1]!, c.data[o + 2]!, c.data[o + 3]!];
  assert.deepEqual(anel, [14, 10, 12, 255], 'o anel é o nanquim');
  assert.equal(contorno(img, 0), img);
  assert.deepEqual(caixaDoConteudo(contorno(img, 2)), { x0: 4, y0: 2, x1: 16, y1: 12 });
});

test('sombraDeContato fica deslocada na direção da luz, mais fraca que o objeto, e é preta', () => {
  const img = quadrado(30, 24, 8, 6, 16, 14), s = sombraDeContato(img, 1, [3, 4], 0.5);
  assert.ok(alfa(s, 12 + 3, 10 + 4) > 100 && alfa(s, 12 + 3, 10 + 4) <= 128, 'centro da sombra, deslocado, ~metade do alfa');
  assert.equal(alfa(s, 2, 2), 0); assert.ok(alfa(s, 12, 10) > 0 && alfa(s, 12, 10) <= 128);
  const caixa = caixaDoConteudo(s, 20)!; assert.ok(caixa.x0 >= 8 + 3 - 2 && caixa.x1 <= 16 + 3 + 2 && caixa.y1 <= 14 + 4 + 2, 'a sombra segue o objeto deslocado');
  assert.deepEqual([s.data[(14 * 30 + 15) * 4], s.data[(14 * 30 + 15) * 4 + 1], s.data[(14 * 30 + 15) * 4 + 2]], [0, 0, 0]);
  assert.equal(alfa(sombraDeContato(img, 0, [0, 0], 1), 10, 8), 255, 'sem desfoque e sem deslocamento, a sombra é o alfa');
});

test('sobrepor: o conteúdo cobre a sombra por baixo e a sombra aparece onde não há conteúdo', () => {
  const img = quadrado(30, 24, 8, 6, 16, 14), c = sobrepor(sombraDeContato(img, 1, [3, 4], 0.5), img);
  assert.deepEqual([...c.data.slice((8 * 30 + 10) * 4, (8 * 30 + 10) * 4 + 4)], [200, 40, 40, 255], 'sobre o conteúdo, a cor dele');
  assert.ok(alfa(c, 17, 16) > 0 && c.data[(16 * 30 + 17) * 4]! < 10, 'fora do conteúdo, a sombra escura');
});

import { GENEROS } from '../../src/domain/presets.ts';
import { medirCor, puxarCor, type AlvoDeCor } from '../../src/procedural/harmonizar.ts';

test('puxarCor aproxima a saturação e a luminância médias do alvo e não mexe nos pixels transparentes', () => {
  const viva = quadrado(10, 10, 2, 2, 8, 8, [255, 20, 20]), alvo: AlvoDeCor = { saturacao: 0.4, luminancia: 0.3, tinta: '#ffffff' };
  const antes = medirCor(viva), depois = medirCor(puxarCor(viva, alvo));
  assert.ok(Math.abs(depois.saturacao - alvo.saturacao) < Math.abs(antes.saturacao - alvo.saturacao), `saturação ${antes.saturacao.toFixed(2)} → ${depois.saturacao.toFixed(2)} (alvo 0,4)`);
  assert.ok(Math.abs(depois.luminancia - alvo.luminancia) < Math.abs(antes.luminancia - alvo.luminancia) + 1e-9);
  const p = puxarCor(viva, alvo); assert.equal(p.data[3], 0, 'transparente continua transparente'); assert.deepEqual([...p.data.slice(0, 3)], [0, 0, 0]);
  assert.ok(medirCor(puxarCor(viva, alvo, 1)).saturacao <= medirCor(puxarCor(viva, alvo, 0.3)).saturacao + 1e-9, 'quanto maior a força, mais perto do alvo');
});

test('puxarCor mantém o matiz: vermelho continua vermelho, verde continua verde; e uma imagem vazia volta igual', () => {
  const alvo: AlvoDeCor = { saturacao: 0.4, luminancia: 0.4, tinta: '#f1e2c8' };
  const v = puxarCor(quadrado(4, 4, 0, 0, 4, 4, [220, 30, 30]), alvo), g = puxarCor(quadrado(4, 4, 0, 0, 4, 4, [30, 200, 40]), alvo);
  assert.ok(v.data[0]! > v.data[1]! * 1.5 && v.data[0]! > v.data[2]! * 1.5, 'vermelho');
  assert.ok(g.data[1]! > g.data[0]! * 1.4 && g.data[1]! > g.data[2]! * 1.4, 'verde');
  const vazio = novosPixels(3, 3); assert.equal(puxarCor(vazio, alvo), vazio);
});

test('todo gênero tem um alvo de cor válido', () => {
  for (const g of GENEROS) { assert.ok(g.alvoDeCor.saturacao > 0 && g.alvoDeCor.saturacao <= 1 && g.alvoDeCor.luminancia > 0 && g.alvoDeCor.luminancia <= 1, g.id); assert.match(g.alvoDeCor.tinta, /^#[0-9a-f]{6}$/i); }
  assert.ok(GENEROS.find(g => g.id === 'moderno')!.alvoDeCor.luminancia > GENEROS.find(g => g.id === 'investigacao')!.alvoDeCor.luminancia);
});
