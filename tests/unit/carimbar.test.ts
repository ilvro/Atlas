import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carimbar } from '../../src/authoring/carimbar.ts';
import { PINCEL_PADRAO } from '../../src/render/pincel.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import type { PincelDeObjeto } from '../../src/domain/pincel-de-objeto.ts';
import { mulberry32 } from '../../src/procedural/ruido.ts';

const arvores = ACERVO.familiaDoItem('casa:arvore-5m')!;
const pincel = (extra: Partial<PincelDeObjeto> = {}): PincelDeObjeto => ({ ...PINCEL_PADRAO.objeto, item: 'casa:arvore-5m', familia: arvores.id, colocar: 'varios', ...extra });
const raio = (id: string, escala: number) => Math.max(...ACERVO.item(id)!.pegada) * escala / 2;

test('sem área, sai um objeto no centro, com a variante do pincel', () => {
  const c = carimbar([5, 6], pincel(), arvores, [], mulberry32(1));
  assert.equal(c.length, 1); assert.deepEqual(c[0]!.posicao, [5, 6]); assert.equal(c[0]!.item, 'casa:arvore-5m');
});
test('com área, todos ficam dentro do círculo e há mais de um', () => {
  const c = carimbar([20, 20], pincel({ area: 8, densidade: 1 }), arvores, [], mulberry32(7));
  assert.ok(c.length > 1);
  for (const k of c) assert.ok(Math.hypot(k.posicao[0] - 20, k.posicao[1] - 20) <= 8 + 1e-9);
});
test('não sobrepõe os já existentes nem entre si', () => {
  const existente = { pos: [20, 20] as [number, number], raio: 3 };
  const c = carimbar([20, 20], pincel({ area: 8, densidade: 2 }), arvores, [existente], mulberry32(3));
  for (const k of c) assert.ok(Math.hypot(k.posicao[0] - 20, k.posicao[1] - 20) >= (3 + raio(k.item, k.campos.scale)) * 0.75 - 1e-9);
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    const a = c[i]!, b = c[j]!;
    assert.ok(Math.hypot(a.posicao[0] - b.posicao[0], a.posicao[1] - b.posicao[1]) >= (raio(a.item, a.campos.scale) + raio(b.item, b.campos.scale)) * 0.75 - 1e-9);
  }
});
test('com o dado ligado, as variantes variam; desligado, é sempre a do pincel', () => {
  const com = carimbar([20, 20], pincel({ area: 12, densidade: 1, varianteAleatoria: true }), arvores, [], mulberry32(5));
  assert.ok(new Set(com.map(k => k.item)).size > 1);
  const sem = carimbar([20, 20], pincel({ area: 12, densidade: 1 }), arvores, [], mulberry32(5));
  assert.ok(sem.every(k => k.item === 'casa:arvore-5m'));
});
test('é determinística para o mesmo rand', () => {
  const p = pincel({ area: 6, varianteAleatoria: true, rotacaoAleatoria: true, escalaAleatoria: 0.2 });
  assert.deepEqual(carimbar([10, 10], p, arvores, [], mulberry32(9)), carimbar([10, 10], p, arvores, [], mulberry32(9)));
});
test('a densidade maior põe mais objetos', () => {
  const n = (d: number) => carimbar([20, 20], pincel({ area: 10, densidade: d }), arvores, [], mulberry32(2)).length;
  assert.ok(n(1) >= n(0.2));
});
