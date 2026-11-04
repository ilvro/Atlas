import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derivarPixel, type ImagemRgba } from '../../src/procedural/derivar-pixel.ts';
import { PALETAS_PIXEL } from '../../src/domain/paletas.ts';

const hex = (c: string): [number, number, number] => { const p = parseInt(c.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };
/** Imagem w × h onde `cor(x, y)` dá o #rrggbb de cada pixel, ou `null` para transparente. */
function imagem(w: number, h: number, cor: (x: number, y: number) => string | null): ImagemRgba {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = cor(x, y), o = (y * w + x) * 4; if (c) { data.set([...hex(c), 255], o); } }
  return { width: w, height: h, data };
}
const pixel = (img: ImagemRgba, x: number, y: number): string => { const o = (y * img.width + x) * 4; return [...img.data.slice(o, o + 4)].join(','); };
const cores = (img: ImagemRgba): Set<string> => { const s = new Set<string>(); for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3] === 255) s.add(`${img.data[i]},${img.data[i + 1]},${img.data[i + 2]}`); return s; };
const PALETA = PALETAS_PIXEL[0]!.cores;

test('um tabuleiro 2×2 de blocos 4×4 reduzido para 2×2 mantém 2 cores, cada uma no seu lugar', () => {
  const [a, b] = [PALETA[18]!, PALETA[26]!];
  const saida = derivarPixel(imagem(8, 8, (x, y) => ((x >> 2) + (y >> 2)) % 2 === 0 ? a : b), { largura: 2, altura: 2 }, PALETA, { dither: false, contorno: false });
  assert.equal(cores(saida).size, 2);
  assert.equal(pixel(saida, 0, 0), pixel(saida, 1, 1)); assert.equal(pixel(saida, 1, 0), pixel(saida, 0, 1)); assert.notEqual(pixel(saida, 0, 0), pixel(saida, 1, 0));
});

test('a borda dura continua dura: meio vermelho, meio azul não ganha cor intermediária', () => {
  const [a, b] = [PALETA[19]!, PALETA[27]!];
  const saida = derivarPixel(imagem(12, 12, x => (x < 6 ? a : b)), { largura: 4, altura: 4 }, PALETA, { dither: false, contorno: false });
  assert.equal(cores(saida).size, 2);
  for (let y = 0; y < 4; y++) { assert.equal(pixel(saida, 0, y), pixel(saida, 1, y)); assert.equal(pixel(saida, 2, y), pixel(saida, 3, y)); assert.notEqual(pixel(saida, 1, y), pixel(saida, 2, y)); }
});

test('a moda vence a média: um bloco com uma cor maior e uma manchinha fica na cor maior', () => {
  const a = PALETA[19]!, b = PALETA[27]!;
  const saida = derivarPixel(imagem(4, 4, (x, y) => (x === 0 && y === 0 ? b : a)), { largura: 1, altura: 1 }, PALETA, { dither: false, contorno: false });
  assert.equal(pixel(saida, 0, 0), [...hex(a), 255].join(','));
});

test('toda cor de saída está na paleta (com e sem dithering), e o alfa é binário', () => {
  const ruido = imagem(24, 24, (x, y) => (x > 19 ? null : `#${((x * 11 + y * 7) % 256).toString(16).padStart(2, '0')}${((x * 5 + y * 13) % 256).toString(16).padStart(2, '0')}${((x * 17 + y * 3) % 256).toString(16).padStart(2, '0')}`));
  const paleta = new Set(PALETA.map(c => hex(c).join(',')));
  for (const dither of [false, true]) {
    const s = derivarPixel(ruido, { largura: 12, altura: 12 }, PALETA, { dither, contorno: true, sombra: true });
    for (let i = 0; i < s.data.length; i += 4) { if (s.data[i + 3] === 255) assert.ok(paleta.has(`${s.data[i]},${s.data[i + 1]},${s.data[i + 2]}`), 'cor fora da paleta'); else assert.ok(s.data[i + 3] === 0 || s.data[i + 3] === 115, `alfa ${s.data[i + 3]}`); }
  }
});

test('o que é transparente na maior parte do bloco fica transparente; o contorno de 1 px cerca o sólido', () => {
  const a = PALETA[19]!, img = imagem(12, 12, (x, y) => (x >= 4 && x < 8 && y >= 4 && y < 8 ? a : null));
  const s = derivarPixel(img, { largura: 6, altura: 6 }, PALETA, { dither: false, contorno: true });
  assert.equal(pixel(s, 0, 0), '0,0,0,0'); assert.notEqual(pixel(s, 2, 2), '0,0,0,0');
  assert.equal(pixel(s, 1, 2).endsWith(',255'), true, 'contorno à esquerda'); assert.equal(pixel(s, 2, 1).endsWith(',255'), true, 'contorno em cima');
});
