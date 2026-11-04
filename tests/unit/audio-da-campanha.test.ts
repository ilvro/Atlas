import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef } from '#mesa';
import { cenaDaRegiao, cenaDeFundo, pedirCena, pedirSomDoMapa } from '../../src/app/audio-do-clima.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { criarMapa } from '../../src/domain/mapa.ts';

const chuva = criarRef('jukebox', 'cena-sonora', 'chuva'), taverna = criarRef('jukebox', 'cena-sonora', 'taverna');
const falso = () => { const pedidos: { tipo: string; dados: unknown }[] = []; return { pedidos, pedir: (tipo: string, dados: unknown) => { pedidos.push({ tipo, dados }); return Promise.resolve({ ok: true as const, resposta: { ok: true } }); } }; };

test('pedirCena e pedirSomDoMapa: pedem jukebox.tocar com o Ref, e não pedem nada sem barramento ou sem cena', () => {
  const b = falso();
  assert.equal(pedirCena(b, chuva), true); assert.deepEqual(b.pedidos, [{ tipo: 'jukebox.tocar', dados: { ref: chuva } }]);
  assert.equal(pedirCena(b, null), false); assert.equal(pedirCena(null, chuva), false);
  assert.equal(pedirSomDoMapa({ audioCue: taverna }, b), true); assert.equal(pedirSomDoMapa({ audioCue: null }, b), false); assert.equal(b.pedidos.length, 2);
});

test('mapa.audio grava e tira a cena do mapa, e desfaz com o documento', () => {
  const m = criarMapa({ id: 'm', agora: 1 }), com = aplicarComando(m, { tipo: 'mapa.audio', ref: taverna });
  assert.deepEqual(com.audioCue, taverna); assert.equal(m.audioCue, null);
  assert.equal(aplicarComando(com, { tipo: 'mapa.audio', ref: null }).audioCue, null);
});

test('cenaDaRegiao só vale para região de áudio com Ref do Jukebox; cenaDeFundo prefere a do clima', () => {
  assert.deepEqual(cenaDaRegiao({ kind: 'audio', refs: [criarRef('ficha', 'ficha', 'x'), chuva] }), chuva);
  assert.equal(cenaDaRegiao({ kind: 'trigger', refs: [chuva] }), null); assert.equal(cenaDaRegiao({ kind: 'audio', refs: [] }), null);
  const m = criarMapa({ id: 'm', agora: 1 }); m.audioCue = taverna;
  assert.deepEqual(cenaDeFundo(m), taverna);
  m.climate.preset = 'tempestade'; m.climateAudio.tempestade = chuva; assert.deepEqual(cenaDeFundo(m), chuva);
});
