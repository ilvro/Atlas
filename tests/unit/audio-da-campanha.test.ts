import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef } from '#mesa';
import { cenaDaRegiao, cenaDeFundo, pedirCena, pedirSilencio, pedirSomDoMapa } from '../../src/app/audio-do-clima.ts';
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

test('pedirSilencio: pede jukebox.parar com ms ou vazio, e não pede sem barramento', () => {
  const b = falso();
  assert.equal(pedirSilencio(b, 1500), true);
  assert.deepEqual(b.pedidos[0], { tipo: 'jukebox.parar', dados: { ms: 1500 } });
  assert.equal(pedirSilencio(b), true);
  assert.deepEqual(b.pedidos[1], { tipo: 'jukebox.parar', dados: {} });
  assert.equal(pedirSilencio(null, 1500), false);
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

import { tocarSomEscolhido, ehEfeitoDoJukebox } from '../../src/app/audio-do-clima.ts';
const efeito = criarRef('jukebox', 'efeito', 'porta-rangendo');

test('tocarSomEscolhido: o efeito do Jukebox toca no lugar do sintetizado; se o Jukebox não atende, o sintetizado toca (uma vez); sem escolha, só o sintetizado', async () => {
  let sintetizados = 0; const som = () => { sintetizados++; };
  const atende = { pedir: async (tipo: string) => { assert.equal(tipo, 'jukebox.efeito'); return { ok: true as const, resposta: { ok: true } }; } };
  assert.equal(await tocarSomEscolhido(atende, efeito, som), 'efeito'); assert.equal(sintetizados, 0);
  const recusa = { pedir: async () => ({ ok: false as const, motivo: 'recusado' as const, detalhe: 'Este efeito não está carregado.' }) };
  assert.equal(await tocarSomEscolhido(recusa, efeito, som), 'sintetizado'); assert.equal(sintetizados, 1);
  const semResposta = { pedir: async () => ({ ok: false as const, motivo: 'sem-resposta' as const }) };
  assert.equal(await tocarSomEscolhido(semResposta, efeito, som), 'sintetizado'); assert.equal(sintetizados, 2);
  const quebra = { pedir: () => Promise.reject(new Error('canal fechado')) };
  assert.equal(await tocarSomEscolhido(quebra, efeito, som), 'sintetizado'); assert.equal(sintetizados, 3);
  assert.equal(await tocarSomEscolhido(atende, null, som), 'sintetizado'); assert.equal(await tocarSomEscolhido(null, efeito, som), 'sintetizado'); assert.equal(sintetizados, 5);
  assert.equal(await tocarSomEscolhido(atende, chuva, som), 'sintetizado', 'uma cena não é um efeito'); assert.equal(sintetizados, 6);
  assert.equal(ehEfeitoDoJukebox(efeito), true); assert.equal(ehEfeitoDoJukebox(chuva), false); assert.equal(ehEfeitoDoJukebox(undefined), false);
});
