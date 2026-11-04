import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { chaveDoObjeto, chaveDoTerreno, entradaDoTerreno } from '../../src/render/entradas.ts';
import { mapaCompleto } from './fixtures.ts';

test('chaveDoObjeto: receita, item da coleção conhecido, asset desconhecido (null) e objeto de parede (null)', () => {
  const receita = novoObjeto([1, 1], { source: { kind: 'recipe', recipe: 'sofa', seed: 4, params: { largura: 2 } } });
  assert.equal(chaveDoObjeto(receita, 96), 'illustrated|o|96|sofa|4|{"largura":2}');
  const conhecido = novoObjeto([1, 1], { source: { kind: 'asset', assetId: 'casa:chesterfield-vinho' } });
  assert.equal(chaveDoObjeto(conhecido, 96), 'illustrated|a|96|casa:chesterfield-vinho|-');
  assert.equal(chaveDoObjeto(novoObjeto([1, 1], { source: { kind: 'asset', assetId: 'casa:nao-existe' } }), 96), null);
  assert.equal(chaveDoObjeto(novoObjeto([1, 1], { elevation: 'wall', source: { kind: 'recipe', recipe: 'quadro', seed: 1, params: {} } }), 96), null);
});

test('as chaves começam pelo estilo e estilos diferentes têm chaves diferentes', () => {
  const o = novoObjeto([1, 1], { source: { kind: 'recipe', recipe: 'sofa', seed: 4, params: {} } });
  assert.ok(chaveDoObjeto(o, 96, 'investigacao', 'pixel')!.startsWith('pixel|'));
  assert.notEqual(chaveDoObjeto(o, 96, 'investigacao', 'pixel'), chaveDoObjeto(o, 96, 'investigacao', 'illustrated'));
  const item = novoObjeto([1, 1], { source: { kind: 'asset', assetId: 'casa:chesterfield-vinho' } });
  assert.notEqual(chaveDoObjeto(item, 96, 'investigacao', 'pixel'), chaveDoObjeto(item, 96));
  const entrada = entradaDoTerreno(mapaCompleto());
  assert.notEqual(chaveDoTerreno(entrada, 24, 'pixel'), chaveDoTerreno(entrada, 24, 'illustrated'));
});
