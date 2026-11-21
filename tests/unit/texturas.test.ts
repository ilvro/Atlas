import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { validarCatalogo, type TexturaDoCatalogo } from '../../src/procedural/texturas.ts';

const RAIZ = join(import.meta.dirname, '../../public/colecao/texturas');
const textura = (id = 'a', extra: Partial<TexturaDoCatalogo> = {}): TexturaDoCatalogo => ({ id, nome: id, arquivo: `${id}.webp`, metros: 2, pxPorMetro: 128, fonte: 'Poly Haven', autor: 'Fulano', licenca: 'CC0', url: 'https://polyhaven.com/a/x', ...extra });
const catalogo = (...texturas: unknown[]) => ({ versao: 1, hash: 'abc', texturas });
const recusa = (texturas: unknown[], aviso: RegExp) => assert.throws(() => validarCatalogo(catalogo(...texturas)), (e: unknown) => e instanceof ErroDeValidacao && aviso.test(e.message));

test('validarCatalogo aceita texturas CC0 com ou sem deslocamento', () => {
  assert.equal(validarCatalogo(catalogo(textura('a'), textura('b', { deslocamento: 'b-alt.webp' }))).texturas.length, 2);
});

test('validarCatalogo recusa licença que não seja CC0, metros <= 0, id repetido e o resto do que está errado', () => {
  recusa([textura('a', { licenca: 'CC-BY-4.0' as never })], /só CC0/);
  recusa([textura('a', { licenca: undefined as never })], /só CC0/);
  recusa([textura('a', { metros: 0 })], /metros/);
  recusa([textura('a', { metros: -1 })], /metros/);
  recusa([textura('a'), textura('a')], /repetido/);
  recusa([textura('a', { arquivo: '../a.webp' })], /arquivo/);
  recusa([textura('a', { deslocamento: 'a.png' })], /deslocamento/);
  recusa([textura('a', { autor: '' })], /autor/);
  assert.throws(() => validarCatalogo({ versao: 2, hash: 'x', texturas: [] }), ErroDeValidacao);
  assert.throws(() => validarCatalogo({ versao: 1, texturas: [] }), ErroDeValidacao);
});

test('o catálogo real é válido, todo arquivo listado existe e o hash é o SHA-1 dos arquivos', () => {
  const c = validarCatalogo(JSON.parse(readFileSync(join(RAIZ, 'texturas.json'), 'utf8')));
  assert.ok(c.texturas.length >= 8);
  const hash = createHash('sha1');
  for (const t of c.texturas) {
    for (const a of [t.arquivo, ...(t.deslocamento ? [t.deslocamento] : [])]) { assert.ok(statSync(join(RAIZ, a), { throwIfNoEntry: false })?.isFile(), `falta ${a}`); hash.update(readFileSync(join(RAIZ, a))); }
    assert.equal(t.pxPorMetro, 128);
  }
  assert.equal(c.hash, hash.digest('hex'));
});
