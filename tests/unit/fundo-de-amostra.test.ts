import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAIS, type Material } from '../../src/procedural/materiais.ts';
import type { CatalogoDeTexturas } from '../../src/procedural/texturas.ts';
import { degradeDe, fundoDaAmostra } from '../../src/ui/fundo-de-amostra.ts';

const mats = MATERIAIS as Record<string, Material>;
mats['teste.a'] = { ...mats['lama']!, id: 'teste.a', textura: { camadas: [{ textura: 'tx_a' }, { textura: 'tx_b' }], tingir: 0.5 } };
after(() => { delete mats['teste.a']; });

const catalogo: CatalogoDeTexturas = { versao: 1, hash: 'h', texturas: [{ id: 'tx_a', nome: 'a', arquivo: 'tx_a.webp', metros: 1, pxPorMetro: 128, fonte: '', autor: '', licenca: 'CC0', url: '' }] };

test('com textura e catálogo, o fundo aponta para o arquivo da primeira camada', () => {
  const f = fundoDaAmostra(mats['teste.a']!, catalogo, 40);
  assert.match(f.backgroundImage, /url\(\/colecao\/texturas\/tx_a\.webp\)/);
  assert.ok(f.backgroundImage.includes(mats['teste.a']!.base));
  assert.equal(f.backgroundSize, 'auto, 20px 20px'); // ladrilho de 1 m numa amostra de 2 m e 40 px
});

test('sem textura, sem catálogo ou textura desconhecida, o degradê continua', () => {
  const lama = mats['lama']!, g = degradeDe(lama);
  assert.deepEqual(fundoDaAmostra({ ...lama, textura: undefined }, catalogo, 40), { backgroundImage: g });
  assert.deepEqual(fundoDaAmostra(mats['teste.a']!, null, 40), { backgroundImage: degradeDe(mats['teste.a']!) });
  assert.deepEqual(fundoDaAmostra(mats['teste.a']!, { ...catalogo, texturas: [] }, 40), { backgroundImage: degradeDe(mats['teste.a']!) });
});
