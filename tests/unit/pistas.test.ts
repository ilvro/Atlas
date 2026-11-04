import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BANCO_DE_PISTAS, idDaPista, lerAssado, listarPistas, pistaDoRegistro, refDaPista } from '../../src/data/pistas.ts';

/** Cria o banco de troca como o Ateliê o cria (contrato v1: stores `handouts` e `bakes`). */
async function criarBancoDoAtelie(registros: unknown[], assados: unknown[] = []): Promise<void> {
  await new Promise<void>((ok, erro) => {
    const p = indexedDB.open(BANCO_DE_PISTAS, 1);
    p.onupgradeneeded = () => { p.result.createObjectStore('handouts', { keyPath: 'id' }); p.result.createObjectStore('bakes', { keyPath: ['id', 'light'] }); };
    p.onerror = () => erro(p.error);
    p.onsuccess = () => { const db = p.result, tx = db.transaction(['handouts', 'bakes'], 'readwrite'); for (const r of registros) tx.objectStore('handouts').put(r); for (const a of assados) tx.objectStore('bakes').put(a); tx.oncomplete = () => { db.close(); ok(); }; tx.onerror = () => erro(tx.error); };
  });
}
const nomesDeBancos = async () => (await indexedDB.databases()).map(d => d.name);

test('sem o banco do Ateliê: lista vazia e o Atlas não cria o banco (o Ateliê ainda precisa fazer o upgrade dele)', async () => {
  assert.deepEqual(await listarPistas(), []); assert.equal(await lerAssado('x', 'normal'), undefined);
  assert.ok(!(await nomesDeBancos()).includes(BANCO_DE_PISTAS), 'o Atlas criou o banco do Ateliê');
});

test('com o banco do contrato v1: lista os resumos do mais recente ao mais antigo, ignora registros sem o mínimo, e lê os assados', async () => {
  const preview = new Blob(['p'], { type: 'image/png' }), normal = new Blob(['n'], { type: 'image/png' }), uv = new Blob(['u'], { type: 'image/png' });
  await criarBancoDoAtelie([
    { id: 'a', name: 'Carta rasgada', category: 'cartas', tags: ['mistério'], revision: 3, updatedAt: 100, hasUv: true, source: 'https://x.github.io/Atelie/', preview },
    { id: 'b', name: 'Mapa do tesouro', category: 'mapas', tags: [], revision: 1, updatedAt: 200, hasUv: false, source: 'https://x.github.io/Atelie/', preview: null },
    { id: 'sem-nome', revision: 1 },
  ], [{ id: 'a', light: 'normal', revision: 3, blob: normal, width: 1200, height: 800 }, { id: 'a', light: 'uv', revision: 3, blob: uv, width: 1200, height: 800 }]);
  const lista = await listarPistas();
  assert.deepEqual(lista.map(p => p.id), ['b', 'a']);
  assert.equal(lista[1]!.hasUv, true); assert.deepEqual(lista[1]!.tags, ['mistério']); assert.equal(lista[0]!.preview, null);
  const n = await lerAssado('a', 'normal'), u = await lerAssado('a', 'uv');
  assert.ok(n && u && n.width === 1200 && n.revision === 3); assert.equal(await lerAssado('b', 'uv'), undefined);
});

test('pistaDoRegistro e o Ref do documento (mesa:atelie/documento/<id>)', () => {
  assert.equal(pistaDoRegistro({ id: 'x' }), null); assert.equal(pistaDoRegistro(null), null);
  assert.deepEqual(pistaDoRegistro({ id: 'x', name: 'N' }), { id: 'x', name: 'N', category: '', tags: [], revision: 0, updatedAt: 0, hasUv: false, source: '', preview: null });
  const ref = refDaPista('abc-123'); assert.deepEqual(ref, { app: 'atelie', tipo: 'documento', id: 'abc-123' });
  assert.equal(idDaPista(ref), 'abc-123'); assert.equal(idDaPista({ app: 'ficha', tipo: 'ficha', id: 'x' }), null); assert.equal(idDaPista(null), null);
});
