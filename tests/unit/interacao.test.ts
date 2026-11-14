import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interagiveisPerto } from '../../src/domain/interacao.ts';
import { secretaOculta, celulasVisiveis } from '../../src/domain/nevoa.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { criarMapa, type Abertura, type MapaAtlas } from '../../src/domain/mapa.ts';
import { aplicarComando, ErroDeComando } from '../../src/state/comandos.ts';
import { contem } from '../../src/domain/celulas.ts';

/** Uma parede vertical em x = 6 e duas portas nela: uma em y = 3 e outra em y = 9 (cada uma com 1 m de vão). */
function mapa(extra: Partial<Abertura> = {}): MapaAtlas {
  const m = criarMapa();
  m.walls.p = { id: 'p', path: [[6, 0], [6, 12]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null };
  const porta = (id: string, y: number): Abertura => ({ id, wallId: 'p', at: y / 12, width: 1, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a', ...extra });
  m.openings.a = porta('a', 3); m.openings.b = porta('b', 9);
  return m;
}

test('a porta a até 1,2 m do vão está ao alcance; mais longe, não', () => {
  const m = mapa();
  assert.deepEqual(interagiveisPerto(m, { position: [5.25, 3], facing: 'right' }).map(x => x.id), ['a']);
  assert.deepEqual(interagiveisPerto(m, { position: [3.75, 3], facing: 'right' }), []);
  assert.deepEqual(interagiveisPerto(m, { position: [5.25, 6], facing: 'right' }), [], 'entre as duas portas, longe de ambas');
});

test('com duas portas ao alcance, a que está à frente da peça vem primeiro', () => {
  const m = mapa();
  m.openings.b = { ...m.openings.b!, at: 4.5 / 12 };   // a 1,5 m da outra: uma peça em y = 3,75 alcança as duas
  const p = { position: [5.75, 3.75] as [number, number] };
  assert.deepEqual(interagiveisPerto(m, { ...p, facing: 'up' }).map(x => x.id), ['a', 'b']);
  assert.deepEqual(interagiveisPerto(m, { ...p, facing: 'down' }).map(x => x.id), ['b', 'a']);
});

test('só portas e portas secretas; arcos e janelas não se abrem', () => {
  const m = mapa({ kind: 'arch' });
  assert.deepEqual(interagiveisPerto(m, { position: [5.25, 3], facing: 'right' }), []);
  m.openings.a = { ...m.openings.a!, kind: 'secret' };
  assert.deepEqual(interagiveisPerto(m, { position: [5.25, 3], facing: 'right' }).map(x => x.id), ['a']);
});

test('sessao.revelar aceita uma abertura, recusa o que não existe e some ao remover a porta', () => {
  let m = mapa({ kind: 'secret' });
  assert.equal(secretaOculta(m, m.openings.a!), true);
  m = aplicarComando(m, { tipo: 'sessao.revelar', ids: ['a'] });
  assert.equal(secretaOculta(m, m.openings.a!), false);
  assert.throws(() => aplicarComando(m, { tipo: 'sessao.revelar', ids: ['nada'] }), ErroDeComando);
  m = aplicarComando(m, { tipo: 'abertura.remover', id: 'a' });
  assert.deepEqual(m.session.revealed, []);
});

test('uma porta secreta aberta e não revelada continua sendo parede para a visão dos jogadores', () => {
  let m = mapa({ kind: 'secret', state: 'open' });
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([5.25, 3]), id: 't', player: true, vision: { radius: 6, dark: false } } as never });
  const alem = (mm: MapaAtlas) => contem(celulasVisiveis(mm), Math.floor(8 / 0.5), Math.floor(3 / 0.5));
  assert.equal(alem(m), false, 'oculta: não vê do outro lado');
  assert.equal(alem(aplicarComando(m, { tipo: 'sessao.revelar', ids: ['a'] })), true, 'revelada e aberta: vê');
});

test('sessao.explorar soma o que as peças de jogador veem agora ao explorado', () => {
  let m = mapa({ state: 'open' });
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([5.25, 3]), id: 't', player: true, vision: { radius: 6, dark: false } } as never });
  assert.equal(m.session.explored, null);
  m = aplicarComando(m, { tipo: 'sessao.explorar' });
  assert.ok(m.session.explored && contem(m.session.explored.cells, 16, 6), 'o que está além da porta aberta ficou explorado');
  const semJogador = mapa();
  assert.equal(aplicarComando(semJogador, { tipo: 'sessao.explorar' }).session.explored, null, 'sem peça de jogador, nada a explorar');
});

test('sessao.telhados alterna a chave geral entre auto, fechados e abertos', () => {
  let m = mapa();
  assert.equal(m.session.roofs, undefined);
  m = aplicarComando(m, { tipo: 'sessao.telhados', modo: 'fechados' });
  assert.equal(m.session.roofs, 'fechados');
  m = aplicarComando(m, { tipo: 'sessao.telhados', modo: 'abertos' });
  assert.equal(m.session.roofs, 'abertos');
  m = aplicarComando(m, { tipo: 'sessao.telhados', modo: 'auto' });
  assert.equal(m.session.roofs, undefined);
  assert.throws(() => aplicarComando(m, { tipo: 'sessao.telhados', modo: 'outro' as never }), ErroDeComando);
});
