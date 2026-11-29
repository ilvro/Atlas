import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  cachePersistenteAtivo,
  criarCacheDeAssados,
  hashChave,
  pedidoCacheavel,
  sha1Fallback,
} from '../../src/procedural/cache-de-assados.ts';
import { criarFilaDeBake } from '../../src/procedural/baker.ts';
import type { PedidoDeBake, ResultadoDeBake } from '../../src/procedural/executar.ts';

function blobDeTamanho(bytes: number, etiqueta = 'x'): Blob {
  const buf = new Uint8Array(bytes);
  const enc = new TextEncoder().encode(etiqueta);
  buf.set(enc.subarray(0, Math.min(enc.length, bytes)));
  return new Blob([buf], { type: 'image/png' });
}

function bitmapFalso(tag: string, fechado?: string[]): ImageBitmap {
  return {
    width: 16,
    height: 16,
    close() {
      fechado?.push(tag);
    },
    tag,
  } as unknown as ImageBitmap;
}

const decodificadorFalso = async (blob: Blob): Promise<ImageBitmap> => {
  const texto = await blob.text();
  return bitmapFalso(texto);
};

const codificadorFalso = async (bmp: ImageBitmap): Promise<Blob> => {
  const tag = (bmp as unknown as { tag?: string }).tag ?? 'bmp';
  return new Blob([tag], { type: 'image/png' });
};

test('sha1Fallback bate com crypto.subtle SHA-1', async () => {
  const entrada = 'versao-1|illustrated|o|48|mesa|1|{}';
  const esperado = await hashChave('versao-1', 'illustrated|o|48|mesa|1|{}');
  assert.equal(sha1Fallback(`${'versao-1'}|${'illustrated|o|48|mesa|1|{}'}`), esperado);
  assert.equal(sha1Fallback(entrada).length, 40);
});

test('acerto (hit) preserva cor, altura, agua, normal, fachada, origem e res', async () => {
  const idb = new IDBFactory();
  const cache = criarCacheDeAssados({
    idb,
    versao: 'v1',
    decodificar: decodificadorFalso,
    codificar: codificadorFalso,
  });

  const entrada: ResultadoDeBake & { normal: ImageBitmap; fachada: ImageBitmap } = {
    bitmap: bitmapFalso('cor-1'),
    altura: bitmapFalso('alt-1'),
    agua: { bitmap: bitmapFalso('agua-1'), res: 4 },
    normal: bitmapFalso('norm-1'),
    fachada: bitmapFalso('fach-1'),
    origem: [-1.5, 2.25],
    res: 48,
  };

  await cache.gravar('chave-1', entrada);
  const obtido = await cache.obter('chave-1');
  assert.ok(obtido);
  assert.deepEqual(obtido.origem, [-1.5, 2.25]);
  assert.equal(obtido.res, 48);
  assert.equal((obtido.bitmap as unknown as { tag: string }).tag, 'cor-1');
  assert.equal((obtido.altura as unknown as { tag: string }).tag, 'alt-1');
  assert.ok(obtido.agua);
  assert.equal(obtido.agua.res, 4);
  assert.equal((obtido.agua.bitmap as unknown as { tag: string }).tag, 'agua-1');
  assert.equal((obtido.normal as unknown as { tag: string }).tag, 'norm-1');
  assert.equal((obtido.fachada as unknown as { tag: string }).tag, 'fach-1');

  cache.fechar();
});

test('erro de versão invalida entradas gravadas com versão anterior', async () => {
  const idb = new IDBFactory();
  const c1 = criarCacheDeAssados({
    idb,
    versao: 'hash-pintor-1',
    decodificar: decodificadorFalso,
    codificar: codificadorFalso,
  });
  await c1.gravar('terreno|1', {
    bitmap: bitmapFalso('terreno-v1'),
    altura: null,
    origem: [0, 0],
    res: 32,
  });
  assert.ok(await c1.obter('terreno|1'));
  c1.fechar();

  const c2 = criarCacheDeAssados({
    idb,
    versao: 'hash-pintor-2',
    decodificar: decodificadorFalso,
    codificar: codificadorFalso,
  });
  assert.equal(await c2.obter('terreno|1'), null);
  c2.fechar();
});

test('despejo LRU apaga registros com usadoEm mais antigo quando ultrapassa o limite', async () => {
  const idb = new IDBFactory();
  let relogio = 10;
  const cache = criarCacheDeAssados({
    idb,
    versao: 'v1',
    limiteBytes: 1000,
    agora: () => relogio,
    decodificar: decodificadorFalso,
    codificar: codificadorFalso,
  });

  await cache.gravarBruto('a', { cor: blobDeTamanho(400, 'a'), altura: null, agua: null, origem: [0, 0], res: 32 });
  relogio = 20;
  await cache.gravarBruto('b', { cor: blobDeTamanho(400, 'b'), altura: null, agua: null, origem: [0, 0], res: 32 });

  // Acessa 'a' em t=25: agora 'b' (t=20) passa a ser o mais antigo.
  relogio = 25;
  const hitA = await cache.obterBruto('a');
  assert.ok(hitA);
  assert.equal(hitA.usadoEm, 25);

  // Gravar 'c' (400B): 400 + 400 + 400 = 1200 > 1000 -> deve despejar 'b', mantendo 'a' e 'c'.
  relogio = 30;
  await cache.gravarBruto('c', { cor: blobDeTamanho(400, 'c'), altura: null, agua: null, origem: [0, 0], res: 32 });

  assert.ok(await cache.obterBruto('a'));
  assert.equal(await cache.obterBruto('b'), null);
  assert.ok(await cache.obterBruto('c'));

  // Gravar 'd' (700B) em t=40: 400 + 400 + 700 = 1500 > 1000 -> precisa despejar 'a' e 'c'.
  relogio = 40;
  await cache.gravarBruto('d', { cor: blobDeTamanho(700, 'd'), altura: null, agua: null, origem: [0, 0], res: 32 });
  assert.equal(await cache.obterBruto('a'), null);
  assert.equal(await cache.obterBruto('c'), null);
  assert.ok(await cache.obterBruto('d'));

  // Entrada maior que o limite inteiro é ignorada sem destruir as existentes.
  relogio = 50;
  await cache.gravarBruto('gigante', { cor: blobDeTamanho(1500, 'g'), altura: null, agua: null, origem: [0, 0], res: 32 });
  assert.equal(await cache.obterBruto('gigante'), null);
  assert.ok(await cache.obterBruto('d'));

  cache.fechar();
});

test('exclui pedidos sprite e imagem com pixelManual do cache persistente', async () => {
  const sprite: PedidoDeBake = {
    tipo: 'sprite',
    spec: { body: 'padrao', hair: 'curto', outfit: 'tunica', accessories: [], colors: {}, seed: 1 },
  };
  const manual: PedidoDeBake = {
    tipo: 'imagem',
    url: '/colecao/mesa.png',
    pegada: [1, 1],
    res: 16,
    resImagem: 16,
    harmonizar: false,
    alvo: null,
    estilo: 'pixel',
    pixelManual: { escala: 2 },
  };
  const imagemComum: PedidoDeBake = {
    tipo: 'imagem',
    url: '/colecao/mesa.png',
    pegada: [1, 1],
    res: 48,
    resImagem: 64,
    harmonizar: true,
    alvo: null,
  };
  const objeto: PedidoDeBake = {
    tipo: 'objeto',
    receita: 'mesa',
    params: {},
    seed: 1,
    res: 48,
    estilo: 'illustrated',
  };

  assert.equal(pedidoCacheavel(sprite), false);
  assert.equal(pedidoCacheavel(manual), false);
  assert.equal(pedidoCacheavel(imagemComum), true);
  assert.equal(pedidoCacheavel(objeto), true);
  assert.equal(pedidoCacheavel({ tipo: 'terreno', entrada: { semCache: 1 } as never, res: 8, estilo: 'illustrated', semCache: true }), false);
  assert.equal(pedidoCacheavel({ tipo: 'terreno', entrada: {} as never, res: 8, estilo: 'illustrated' }), true);
  assert.equal(pedidoCacheavel({ ...imagemComum, harmonizar: false } as PedidoDeBake), false);
  assert.equal(pedidoCacheavel({ ...imagemComum, harmonizar: false, estilo: 'pixel' } as PedidoDeBake), true);

  let consultas = 0;
  let execucoes = 0;
  const fila = criarFilaDeBake<PedidoDeBake, string>(
    [async p => { execucoes++; return `assado:${p.tipo}`; }],
    () => 1,
    {
      podeCachear: pedidoCacheavel,
      consultarCache: async chave => {
        consultas++;
        return `cache:${chave}`;
      },
    },
  );

  assert.equal(await fila.pedir('k-sprite', sprite), 'assado:sprite');
  assert.equal(await fila.pedir('k-manual', manual), 'assado:imagem');
  assert.equal(consultas, 0);
  assert.equal(execucoes, 2);

  assert.equal(await fila.pedir('k-obj', objeto), 'cache:k-obj');
  assert.equal(consultas, 1);
  assert.equal(execucoes, 2);
});

test('falha silenciosamente quando IndexedDB falha ou está indisponível', async () => {
  const semIdb = criarCacheDeAssados({
    idb: undefined,
    versao: 'v1',
    decodificar: decodificadorFalso,
    codificar: codificadorFalso,
  });
  await semIdb.gravar('k', { bitmap: bitmapFalso('x'), altura: null, origem: [0, 0], res: 32 });
  assert.equal(await semIdb.obter('k'), null);

  const idbQuebrado = {
    open() {
      throw new DOMException('Aba privada bloqueada', 'SecurityError');
    },
  } as unknown as IDBFactory;

  const comErro = criarCacheDeAssados({
    idb: idbQuebrado,
    versao: 'v1',
    decodificar: decodificadorFalso,
    codificar: codificadorFalso,
  });
  await comErro.gravarBruto('k', { cor: blobDeTamanho(10), altura: null, agua: null, origem: [0, 0], res: 32 });
  assert.equal(await comErro.obter('k'), null);
  comErro.fechar();

  // Decodificador falhando (blob corrompido) também faz fallback silencioso e fecha bitmaps já abertos.
  const idb = new IDBFactory();
  const fechados: string[] = [];
  const cache = criarCacheDeAssados({
    idb,
    versao: 'v1',
    codificar: codificadorFalso,
    decodificar: async blob => {
      const txt = await blob.text();
      if (txt === 'quebrado') throw new Error('PNG inválido');
      return bitmapFalso(txt, fechados);
    },
  });
  await cache.gravarBruto('corrompido', {
    cor: new Blob(['ok'], { type: 'image/png' }),
    altura: new Blob(['quebrado'], { type: 'image/png' }),
    agua: null,
    origem: [0, 0],
    res: 32,
  });
  assert.equal(await cache.obter('corrompido'), null);
  assert.deepEqual(fechados, ['ok']);
  cache.fechar();
});

test('ativação do cache persistente: desligado em dev sem ?cache=1, ligado com ?cache=1 ou em produção', () => {
  assert.equal(cachePersistenteAtivo(true, ''), false);
  assert.equal(cachePersistenteAtivo(true, '?foo=bar'), false);
  assert.equal(cachePersistenteAtivo(true, '?cache=1'), true);
  assert.equal(cachePersistenteAtivo(true, '', '#/mapa/1?cache=1'), true);
  assert.equal(cachePersistenteAtivo(false, ''), true);
});
