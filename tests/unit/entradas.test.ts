import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area, codificar } from '../../src/domain/celulas.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { aplicarComando, type Comando } from '../../src/state/comandos.ts';
import { chaveDoItem, chaveDoObjeto, chaveDoTerreno, entradaDoTerreno, pedidoDoItem } from '../../src/render/entradas.ts';
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

test('item com pixelArquivo: no Pixel (ppc múltiplo de 16) o pedido e a chave usam o arquivo manual; em outro ppc, a derivação; no Ilustrado, nada muda', () => {
  const item = { id: 'casa:x', nome: 'X', arquivo: 'gerados/x.webp', categoria: 'decoracao', pegada: [1, 1], funcoes: [], tags: [], generos: [], kit: null, pixelArquivo: 'pixel/x.png', origem: { tipo: 'achado', autor: 'A', fonte: 'F', url: 'u', licenca: 'CC0-1.0', arquivoOriginal: 'o' } } as never;
  const px = (ppc: number) => ({ ppc, contorno: true, paleta: 'investigacao-sepia', dither: 'bayer4' as const });
  const manual = pedidoDoItem(item, [1, 1], true, 32 / 1.5, 'investigacao', 'pixel', px(32));
  assert.equal(manual.tipo, 'imagem'); assert.match((manual as { url: string }).url, /pixel\/x\.png$/); assert.deepEqual((manual as { pixelManual?: unknown }).pixelManual, { escala: 2 }); assert.equal((manual as { harmonizar: boolean }).harmonizar, false);
  const derivada = pedidoDoItem(item, [1, 1], true, 24 / 1.5, 'investigacao', 'pixel', px(24));
  assert.match((derivada as { url: string }).url, /gerados\/x\.webp$/); assert.equal((derivada as { pixelManual?: unknown }).pixelManual, undefined); assert.equal((derivada as { harmonizar: boolean }).harmonizar, true);
  const ilustrado = pedidoDoItem(item, [1, 1], true, 96, 'investigacao', 'illustrated');
  assert.match((ilustrado as { url: string }).url, /gerados\/x\.webp$/);
  assert.match(chaveDoItem('casa:x', item, true, 32 / 1.5, 'investigacao', 'pixel', px(32)), /\|manual:pixel\/x\.png:2$/);
  assert.notEqual(chaveDoItem('casa:x', item, true, 24 / 1.5, 'investigacao', 'pixel', px(24)), chaveDoItem('casa:x', item, true, 24 / 1.5, 'investigacao', 'pixel', { ...px(24), paleta: 'moderno-claro' }), 'a imagem derivada depende da paleta');
});

test('I1: entradaDoTerreno calcula assentamento por material base, soleira nas portas externas e respeita style.settle', () => {
  const rodar = (m: ReturnType<typeof criarMapa>, c: Comando) => aplicarComando(m, c);
  let m = criarMapa({ largura: 24, altura: 21 });
  m = rodar(m, { tipo: 'terreno.base', material: 'neve' });
  m = rodar(m, {
    tipo: 'comodo.criar',
    id: 'c1',
    nome: 'Casa',
    funcao: 'sala',
    piso: { material: 'tabuas.carvalho', seed: 1 },
    papel: null,
    telhado: 'casa-de-telha',
    celulas: [[4, 4], [5, 4], [4, 5], [5, 5]],
  });
  const paredeSul = Object.values(m.walls).find(w => Math.abs(w.path[0]![1] - 9) < 0.05 && Math.abs(w.path[1]![1] - 9) < 0.05)!;
  m = rodar(m, {
    tipo: 'abertura.adicionar',
    abertura: { id: 'p1', kind: 'door', wallId: paredeSul.id, at: 0.5, width: 1.2, state: 'closed', material: 'madeira.carvalho', swing: 'a', som: null },
  });

  const entNeve = entradaDoTerreno(m);
  assert.equal(entNeve.assentamento?.material, 'neve.pisada');
  assert.ok(area(entNeve.assentamento!.celulas) > 0);
  assert.equal(entNeve.assentamento!.soleiras.length, 1);
  assert.deepEqual(entNeve.assentamento!.soleiras[0]!.normal, [0, 1]);
  assert.equal(entNeve.assentamento!.soleiras[0]!.largura, 1.2);

  const mGrama = rodar(m, { tipo: 'terreno.base', material: 'grama' });
  assert.equal(entradaDoTerreno(mGrama).assentamento?.material, 'terra');

  const mAreia = rodar(m, { tipo: 'terreno.base', material: 'areia' });
  const entAreia = entradaDoTerreno(mAreia);
  assert.equal(entAreia.assentamento?.material, null);
  assert.equal(entAreia.assentamento?.celulas.length, 0);
  assert.equal(entAreia.assentamento?.soleiras.length, 1);

  const mSem = rodar(m, { tipo: 'estilo.atualizar', patch: { settle: false } });
  assert.equal(entradaDoTerreno(mSem).assentamento, undefined);
  assert.notEqual(chaveDoTerreno(entNeve, 20), chaveDoTerreno(entradaDoTerreno(mSem), 20));
  void codificar;
});
