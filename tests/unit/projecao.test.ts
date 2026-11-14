import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMPOS_DO_MESTRE, projetarParaJogadores } from '../../src/domain/projecao.ts';
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

test('revelar região leva células exploradas aos jogadores mesmo sendo gmOnly', () => {
  let m = mapaCompleto();
  m.regions['area-secreta'] = {
    id: 'area-secreta',
    kind: 'reveal',
    polygon: [[10, 10], [15, 10], [15, 15], [10, 15]],
    gmOnly: true,
    payload: {},
    refs: [],
  };
  m = aplicarComando(m, { tipo: 'sessao.revelar', ids: ['area-secreta'] });
  const p = projetarParaJogadores(m);
  validarMapa(p);
  assert.ok(p.session.explored, 'session.explored é preenchido');
  assert.ok(p.session.explored.cells.length > 0, 'células reveladas da região estão em session.explored');
  assert.equal(p.regions['area-secreta'], undefined, 'região gmOnly não viaja para o projetor');
});

test('região comum revelada permanece no session.revealed', () => {
  let m = mapaCompleto();
  m.regions['clube'] = {
    id: 'clube',
    kind: 'reveal',
    polygon: [[2, 2], [6, 2], [6, 6], [2, 6]],
    gmOnly: false,
    payload: {},
    refs: [],
  };
  m = aplicarComando(m, { tipo: 'sessao.revelar', ids: ['clube'] });
  const p = projetarParaJogadores(m);
  validarMapa(p);
  assert.ok(p.session.revealed.includes('clube'), 'id da região pública revelada permanece no revealed');
});

test('objeto oculto e suas luzes são excluídos da projeção para jogadores', () => {
  let m = mapaCompleto();
  m.props.bauOculto = {
    ...m.props.mesa!,
    id: 'bauOculto',
    oculto: true,
  };
  m.lights.luzBau = {
    ...m.lights.lampiao!,
    id: 'luzBau',
    ownerId: 'bauOculto',
  };
  assert.ok(CAMPOS_DO_MESTRE.includes('props.oculto'));
  const p = projetarParaJogadores(m);
  validarMapa(p);
  assert.equal(p.props.bauOculto, undefined, 'objeto oculto não vai para o projetor');
  assert.equal(p.lights.luzBau, undefined, 'luz do objeto oculto não vai para o projetor');
  assert.ok(m.props.bauOculto, 'o mapa original permanece intacto');
  assert.ok(m.lights.luzBau, 'a luz original permanece intacta');
});

test('session.roofs chega ao projetor pela projeção', () => {
  const m = aplicarComando(mapaCompleto(), { tipo: 'sessao.telhados', modo: 'fechados' });
  const p = projetarParaJogadores(m);
  validarMapa(p);
  assert.equal(p.session.roofs, 'fechados');
});
