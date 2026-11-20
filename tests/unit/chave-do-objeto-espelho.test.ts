import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { chaveDoObjeto, pedidoDoObjeto } from '../../src/render/entradas.ts';

test('espelhar uma receita muda a chave e o pedido de assado', () => {
  const o = novoObjeto([0, 0], { source: { kind: 'recipe', recipe: 'escrivaninha', seed: 1, params: {} } });
  const f = { ...o, flip: true };
  assert.notEqual(chaveDoObjeto(o, 40), chaveDoObjeto(f, 40));
  assert.equal((pedidoDoObjeto(o, 40) as { espelhar?: boolean }).espelhar, undefined);
  assert.equal((pedidoDoObjeto(f, 40) as { espelhar?: boolean }).espelhar, true);
});
test('a opacidade não muda a chave (é só alfa)', () => {
  const o = novoObjeto([0, 0], { source: { kind: 'recipe', recipe: 'escrivaninha', seed: 1, params: {} } });
  assert.equal(chaveDoObjeto(o, 40), chaveDoObjeto({ ...o, opacity: 0.5 }, 40));
});
