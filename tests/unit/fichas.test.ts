import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveDaRef, criarBarramento, criarRef, type CanalLike } from '#mesa';
import { emEstadoCritico, fracao, pipsCheios, refDaFicha, tomDaRolagem } from '../../src/domain/fichas.ts';
import { iniciarFichas, aoRolar, pecaDaFicha, personagensComFicha, recursosDaPeca, recursosDasFichas } from '../../src/app/fichas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';

/** Um par de canais ligados: o que um posta, o outro recebe (como duas abas). */
function parDeCanais(): [() => CanalLike, () => CanalLike] {
  const a: CanalLike = { postMessage: m => queueMicrotask(() => b.onmessage?.({ data: m })), onmessage: null, close() {} };
  const b: CanalLike = { postMessage: m => queueMicrotask(() => a.onmessage?.({ data: m })), onmessage: null, close() {} };
  return [() => a, () => b];
}
const ficha = criarRef('ficha', 'ficha', 'sheet-1');
const esperar = () => new Promise(r => setTimeout(r, 5));

test('domínio: pips, fração, estado crítico e a ficha de uma lista de refs', () => {
  assert.equal(pipsCheios(20, 20), 10); assert.equal(pipsCheios(10, 20), 5); assert.equal(pipsCheios(1, 20), 1, 'qualquer vida acende um pip'); assert.equal(pipsCheios(0, 20), 0); assert.equal(pipsCheios(5, 0), 0);
  assert.equal(fracao(5, 0), 0); assert.equal(fracao(30, 20), 1);
  assert.equal(emEstadoCritico({ pv: 5, pvMax: 20 }), true, '25% é crítico'); assert.equal(emEstadoCritico({ pv: 6, pvMax: 20 }), false); assert.equal(emEstadoCritico({ pv: 0, pvMax: 0 }), false);
  assert.equal(refDaFicha([criarRef('atlas', 'mapa', 'm'), ficha]), ficha); assert.equal(refDaFicha([criarRef('atlas', 'mapa', 'm')]), null);
  assert.equal(tomDaRolagem(20), 'alto'); assert.equal(tomDaRolagem(1), 'baixo'); assert.equal(tomDaRolagem(12), 'normal'); assert.equal(tomDaRolagem(24, 5), 'alto', 'o modificador não conta');
});

test('iniciarFichas: ficha.recursos chega pelo barramento e fica por Ref; ficha.rolagem avisa os ouvintes; ao parar, nada mais chega', async () => {
  const [daFicha, doAtlas] = parDeCanais();
  const bFicha = criarBarramento({ app: 'ficha', criarCanal: daFicha }), bAtlas = criarBarramento({ app: 'atlas', criarCanal: doAtlas });
  recursosDasFichas.value = {};
  const parar = iniciarFichas(bAtlas), rolagens: unknown[] = [], cancelar = aoRolar(r => rolagens.push(r));
  bFicha.emitir('ficha.recursos', { ficha, pv: 12, pvMax: 20, pd: 8, pdMax: 10 }); await esperar();
  assert.deepEqual(recursosDasFichas.value[chaveDaRef(ficha)], { pv: 12, pvMax: 20, pd: 8, pdMax: 10 });
  const peca = novaPeca([1, 1], 'Muirenn', { refs: [ficha] });
  assert.deepEqual(recursosDaPeca(peca), { pv: 12, pvMax: 20, pd: 8, pdMax: 10 }); assert.equal(recursosDaPeca(novaPeca([1, 1], 'Sem ficha')), null);
  bFicha.emitir('ficha.recursos', { ficha, pv: 3, pvMax: 20, pd: 8, pdMax: 10 }); await esperar();
  assert.equal(recursosDaPeca(peca)!.pv, 3, 'o último vale');
  bFicha.emitir('ficha.rolagem', { ficha, titulo: 'Investigação', total: 17, modificador: 5 }); await esperar();
  assert.deepEqual(rolagens, [{ ficha, titulo: 'Investigação', total: 17, modificador: 5, tom: 'normal' }]);
  cancelar(); parar();
  bFicha.emitir('ficha.recursos', { ficha, pv: 1, pvMax: 20, pd: 8, pdMax: 10 }); await esperar();
  assert.equal(recursosDaPeca(peca)!.pv, 3, 'parou de escutar'); bFicha.fechar(); bAtlas.fechar();
});

test('pecaDaFicha e personagensComFicha', () => {
  const m = criarMapa({ id: 'm', agora: 1 }), p = novaPeca([2, 2], 'Ana', { refs: [ficha] }), q = novaPeca([3, 3], 'Beto'); m.tokens[p.id] = p; m.tokens[q.id] = q;
  assert.equal(pecaDaFicha(m, ficha)?.id, p.id); assert.equal(pecaDaFicha(m, criarRef('ficha', 'ficha', 'outra')), undefined);
  const base = { campanhaId: 'c', nome: 'x', tags: [], notas: '', criadaPor: 'ficha' as const, criadaEm: 1, atualizadaEm: 1 };
  const lista = personagensComFicha([{ ...base, id: '1', tipo: 'personagem', refs: [ficha] }, { ...base, id: '2', tipo: 'personagem', refs: [] }, { ...base, id: '3', tipo: 'lugar', refs: [ficha] }]);
  assert.deepEqual(lista.map(e => e.id), ['1']);
});
