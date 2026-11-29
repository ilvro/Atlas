import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novaLuz, novaPeca } from '../../src/domain/fabrica.ts';
import { luzesDisponiveisParaPeca, type Recursos } from '../../src/domain/fichas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { camposDoPreset, presetDeLuz } from '../../src/domain/presets.ts';
import { criarStore } from '../../src/state/store.ts';
import { alternarLuzDaPeca, atualizarLuzDaPeca, mirarLuzDaPeca, restaurarPadraoLuzDaPeca, rotuloDaLuz } from '../../src/app/luz-da-peca.ts';

function mapaComPeca(extra: Partial<ReturnType<typeof novaPeca>> = {}) {
  const m = criarMapa();
  const peca = novaPeca([4.5, 4.5], 'Arthur', { id: 't1', player: true, facing: 'right', ...extra });
  m.tokens[peca.id] = peca;
  return { m, peca };
}

test('rotuloDaLuz devolve nomes amigáveis e fallback seguro', () => {
  assert.equal(rotuloDaLuz('lanterna'), 'Lanterna');
  assert.equal(rotuloDaLuz('lamparina'), 'Lamparina');
  assert.equal(rotuloDaLuz('tocha'), 'Tocha');
  assert.equal(rotuloDaLuz('vela'), 'Vela');
  assert.equal(rotuloDaLuz('holofote'), 'Holofote');
  assert.equal(rotuloDaLuz(null), 'Luz');
  assert.equal(rotuloDaLuz('inexistente'), 'Luz');
});

test('luzesDisponiveisParaPeca usa presets padrão sem ficha e presets da ficha quando presentes', () => {
  const { m, peca } = mapaComPeca();
  const semFicha = luzesDisponiveisParaPeca(m, peca, null);
  assert.deepEqual(semFicha.presets, ['lanterna', 'lamparina', 'tocha', 'vela']);
  assert.equal(semFicha.ativa, false);
  assert.equal(semFicha.presetAtivo, null);

  const rec: Recursos = { pv: 12, pvMax: 12, pd: 6, pdMax: 6, luzes: ['lamparina', 'vela'] };
  const comFicha = luzesDisponiveisParaPeca(m, peca, rec);
  assert.deepEqual(comFicha.presets, ['lamparina', 'vela']);
  assert.equal(comFicha.ativa, false);
  assert.equal(comFicha.presetAtivo, null);

  const luzTocha = novaLuz([4.5, 4.5], { id: 'l1', ...camposDoPreset(presetDeLuz('tocha')!), ownerId: peca.id, on: true });
  m.lights[luzTocha.id] = luzTocha;
  peca.lightId = luzTocha.id;

  const comAtivaDiferente = luzesDisponiveisParaPeca(m, peca, rec);
  assert.deepEqual(comAtivaDiferente.presets, ['tocha', 'lamparina', 'vela']);
  assert.equal(comAtivaDiferente.ativa, true);
  assert.equal(comAtivaDiferente.presetAtivo, 'tocha');
});

test('alternarLuzDaPeca cria luz com item da ficha, apaga, reacende, troca mantendo ownerId e levelId e desfaz', () => {
  const { m, peca } = mapaComPeca({ levelId: 'andar-2' });
  m.levels = { 'andar-2': { id: 'andar-2', name: '2º andar', order: 1 } };
  const store = criarStore(m);
  const rec: Recursos = { pv: 10, pvMax: 10, pd: 4, pdMax: 4, luzes: ['lamparina', 'lanterna'] };

  assert.equal(alternarLuzDaPeca(store, 'inexistente'), null);

  // 1. Cria a luz usando o primeiro item da ficha ('lamparina')
  const r1 = alternarLuzDaPeca(store, peca.id, { recursos: rec });
  assert.deepEqual(r1, { ligada: true, preset: 'lamparina' });
  const t1 = store.documento.tokens[peca.id]!;
  assert.ok(t1.lightId);
  const luz1 = store.documento.lights[t1.lightId!]!;
  assert.equal(luz1.preset, 'lamparina');
  assert.equal(luz1.on, true);
  assert.equal(luz1.ownerId, peca.id);
  assert.equal(luz1.levelId, 'andar-2');

  // 2. Apaga a luz existente
  const r2 = alternarLuzDaPeca(store, peca.id, { recursos: rec });
  assert.deepEqual(r2, { ligada: false, preset: 'lamparina' });
  assert.equal(store.documento.lights[luz1.id]!.on, false);

  // 3. Reacende a mesma luz
  const r3 = alternarLuzDaPeca(store, peca.id, { recursos: rec });
  assert.deepEqual(r3, { ligada: true, preset: 'lamparina' });
  assert.equal(store.documento.lights[luz1.id]!.on, true);

  // 4. Troca para 'lanterna' mantendo ownerId e levelId, removendo a antiga numa só transação
  const r4 = alternarLuzDaPeca(store, peca.id, { preset: 'lanterna', recursos: rec });
  assert.deepEqual(r4, { ligada: true, preset: 'lanterna' });
  const t4 = store.documento.tokens[peca.id]!;
  assert.ok(t4.lightId && t4.lightId !== luz1.id);
  assert.equal(store.documento.lights[luz1.id], undefined);
  const luz2 = store.documento.lights[t4.lightId!]!;
  assert.equal(luz2.preset, 'lanterna');
  assert.equal(luz2.on, true);
  assert.equal(luz2.ownerId, peca.id);
  assert.equal(luz2.levelId, 'andar-2');
  assert.ok(luz2.cone);

  // 5. Desfazer restaura a lamparina anterior em um passo
  store.desfazer();
  assert.equal(store.documento.tokens[peca.id]!.lightId, luz1.id);
  assert.equal(store.documento.lights[luz1.id]?.preset, 'lamparina');
  assert.equal(store.documento.lights[luz2.id], undefined);
});

test('mirarLuzDaPeca gira o cone da lanterna e a direção de visão da peça', () => {
  const { m, peca } = mapaComPeca();
  const store = criarStore(m);
  alternarLuzDaPeca(store, peca.id, { preset: 'lanterna' });

  assert.equal(mirarLuzDaPeca(store, 'inexistente', Math.PI / 2), false);
  assert.equal(mirarLuzDaPeca(store, peca.id, Number.NaN), false);

  const ok = mirarLuzDaPeca(store, peca.id, Math.PI / 2);
  assert.equal(ok, true);
  const t = store.documento.tokens[peca.id]!;
  const luz = store.documento.lights[t.lightId!]!;
  assert.equal(luz.cone?.direction, Math.PI / 2);
  assert.equal(t.vision.direction, Math.PI / 2);
  assert.equal(t.facing, 'down');
});

test('atualizarLuzDaPeca limita o alcance, valida a cor, funde no histórico e restaura o preset', () => {
  const { m, peca } = mapaComPeca();
  const store = criarStore(m);
  assert.equal(atualizarLuzDaPeca(store, peca.id, { radius: 5 }), false, 'sem luz vinculada não faz nada');
  alternarLuzDaPeca(store, peca.id, { preset: 'lanterna' });
  const luz = () => store.documento.lights[store.documento.tokens[peca.id]!.lightId!]!;
  const padrao = presetDeLuz('lanterna')!;

  assert.equal(atualizarLuzDaPeca(store, peca.id, { radius: 500 }), true);
  assert.equal(luz().radius, 40);
  assert.equal(atualizarLuzDaPeca(store, peca.id, { radius: 0.2 }), true);
  assert.equal(luz().radius, 1);
  assert.equal(atualizarLuzDaPeca(store, peca.id, { radius: Number.NaN }), false);
  assert.equal(atualizarLuzDaPeca(store, peca.id, { color: 'vermelho' }), false);
  assert.equal(atualizarLuzDaPeca(store, peca.id, { color: '#FF8800' }), true);
  assert.equal(luz().color, '#ff8800');
  assert.equal(atualizarLuzDaPeca(store, peca.id, {}), false);

  store.desfazer();
  assert.equal(luz().on, true, 'as edições fundidas se desfazem juntas, sem apagar a luz');
  assert.equal(luz().radius, padrao.radius);
  assert.equal(luz().color, padrao.color);

  atualizarLuzDaPeca(store, peca.id, { radius: 3, color: '#00ff00' });
  assert.equal(restaurarPadraoLuzDaPeca(store, peca.id), true);
  assert.equal(luz().radius, padrao.radius);
  assert.equal(luz().color, padrao.color);
  assert.equal(restaurarPadraoLuzDaPeca(store, 'inexistente'), false);
});
