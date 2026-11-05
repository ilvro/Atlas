import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projetarParaJogadores } from '../../src/domain/projecao.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { criarRef } from '#mesa';
import { mapaCompleto } from './fixtures.ts';
import type { MapaAtlas } from '../../src/domain/mapa.ts';

/** A casa com um mestre cheio de segredos: nota, região gmOnly, secreta, presença gmOnly, inimigo fora da vista (com lanterna) e uma pista. */
function mapaComSegredos(): MapaAtlas {
  let m = mapaCompleto();
  m.walls.p2 = { id: 'p2', path: [[20, 0], [20, 12]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null };
  m.openings.cofre = { id: 'cofre', wallId: 'p2', at: 0.5, width: 0.9, kind: 'secret', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.regions.armadilha = { id: 'armadilha', polygon: [[1, 1], [2, 1], [2, 2]], kind: 'trigger', gmOnly: true, payload: { segredo: 'SEGREDO-REGIAO' }, refs: [] };
  m.presence.sangue = { id: 'sangue', brush: 'sangue', cells: [[9, 9, 3]], intensity: 1, seed: 1, gmOnly: true };
  m.props.bau = { ...m.props.mesa!, id: 'bau', interaction: { kind: 'clue', on: false, targets: [], sound: null, clue: criarRef('atelie', 'documento', 'PISTA-SECRETA') } };
  m.tokens.hugo = { ...novaPeca([5.25, 3.75]), id: 'hugo', name: 'Hugo', player: true, vision: { radius: 6, dark: false } };
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([40.5, 27.75]), id: 'monstro', name: 'MONSTRO-ESCONDIDO', player: false } as never });
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'lights', item: { ...m.lights.lampiao!, id: 'tocha-monstro', ownerId: 'monstro', position: [40.5, 27.75] } as never });
  m = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 'monstro', patch: { lightId: 'tocha-monstro' } });
  m = aplicarComando(m, { tipo: 'iniciativa.iniciar', entradas: [{ tokenId: 'hugo', value: 12 }, { tokenId: 'monstro', value: 18 }] });
  return m;
}

test('a projeção não leva nada do mestre e continua um mapa válido', () => {
  const m = mapaComSegredos(), antes = JSON.stringify(m), p = projetarParaJogadores(m);
  assert.equal(JSON.stringify(m), antes, 'não muda o original');
  validarMapa(p);
  const json = JSON.stringify(p);
  for (const segredo of ['Sessão 3.', 'A carta está atrás do quadro', 'SEGREDO-REGIAO', 'armadilha', 'sangue', 'cofre', 'MONSTRO-ESCONDIDO', 'tocha-monstro', 'PISTA-SECRETA', 'carta-queimada', 'cena-sonora']) assert.ok(!json.includes(segredo), `vazou: ${segredo}`);
  assert.equal(p.notes, ''); assert.deepEqual(p.comodosExtra, {}); assert.equal(p.campanhaId, null); assert.equal(p.audioCue, null);
  assert.deepEqual(p.session.initiative!.order.map(x => x.tokenId), ['hugo'], 'a iniciativa também perde o escondido');
});

test('a peça de jogador, a região comum e o que está à vista ficam', () => {
  const m = mapaComSegredos(), p = projetarParaJogadores(m);
  assert.ok(p.tokens.hugo); assert.ok(p.regions.entrada); assert.deepEqual(p.regions.entrada!.payload, {}); assert.ok(p.rooms.sala); assert.ok(p.props.mesa);
  const visto = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([5.25, 5.25]), id: 'ao-lado', name: 'Ao lado' } as never });
  assert.ok(projetarParaJogadores(visto).tokens['ao-lado'], 'um inimigo à vista de Hugo aparece');
});

test('a porta secreta revelada e a pista revelada aparecem', () => {
  const m = aplicarComando(mapaComSegredos(), { tipo: 'sessao.revelar', ids: ['cofre', 'bau'] }), p = projetarParaJogadores(m);
  validarMapa(p);
  assert.ok(p.openings.cofre, 'a secreta revelada é uma porta como as outras');
  assert.ok(JSON.stringify(p).includes('PISTA-SECRETA'), 'a pista revelada vai');
});
