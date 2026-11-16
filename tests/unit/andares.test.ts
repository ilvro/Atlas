import assert from 'node:assert/strict';
import { test } from 'node:test';
import { andarDe, ehMultiandar, listaDeAndares, mapaDoAndar } from '../../src/domain/andares.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { novaLuz, novoObjeto, novaPeca } from '../../src/domain/fabrica.ts';
import { PAREDE_PADRAO } from '../../src/domain/geometria.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

function mapaExemplo() {
  const m = criarMapa({ id: 'multi', nome: 'Moinho', agora: 1 });
  m.levels = {
    b1: { id: 'b1', name: 'Porão', order: -1 },
    a1: { id: 'a1', name: 'Andar 1', order: 1 },
  };
  m.terrain.base = 'grama';
  m.climate.weather.rain = 0.8;

  m.rooms.r0 = {
    id: 'r0', name: 'Térreo', function: 'sala', cells: codificar([[1, 1], [2, 1]]),
    floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
    roof: { material: null, visible: true }, levelId: null,
  };
  m.rooms.r1 = {
    id: 'r1', name: 'Depósito', function: 'deposito', cells: codificar([[1, 1], [2, 1]]),
    floor: { material: 'tabuas.carvalho', seed: 2 }, wallpaper: null, wallStyle: null, palette: null,
    roof: { material: null, visible: true }, levelId: 'a1',
  };

  m.walls.w0 = { ...structuredClone(PAREDE_PADRAO), id: 'w0', path: [[1.5, 1.5], [4.5, 1.5]], source: null, levelId: null };
  m.walls.w1 = { ...structuredClone(PAREDE_PADRAO), id: 'w1', path: [[1.5, 1.5], [4.5, 1.5]], source: null, levelId: 'a1' };
  m.openings.op0 = { id: 'op0', wallId: 'w0', at: 0.5, width: 1, kind: 'door', state: 'closed', material: 'madeira', som: null, swing: 'a' };
  m.openings.op1 = { id: 'op1', wallId: 'w1', at: 0.5, width: 1, kind: 'door', state: 'closed', material: 'madeira', som: null, swing: 'a' };

  m.props.p1 = novoObjeto([2, 2], { id: 'p1', levelId: 'a1' });
  m.lights.l1 = novaLuz([2, 2], { id: 'l1', levelId: 'a1' });
  m.tokens.t0 = novaPeca([2, 2], 'A', { id: 't0', levelId: null });
  m.tokens.tb = novaPeca([2, 2], 'B', { id: 'tb', levelId: 'b1' });
  m.session.explored = { res: 0.5, cells: codificar([[0, 0]]) };
  m.session.exploredLevels = { a1: { res: 0.5, cells: codificar([[3, 3]]) } };
  validarMapa(m);
  return m;
}

test('listaDeAndares ordena porões, térreo e andares de cima; ehMultiandar detecta levels', () => {
  const simples = criarMapa({ id: 's', nome: 'Simples', agora: 1 });
  assert.equal(ehMultiandar(simples), false);
  assert.deepEqual(listaDeAndares(simples), [{ id: null, nome: 'Térreo', order: 0 }]);

  const m = mapaExemplo();
  m.groundLevelName = 'Salão Principal';
  assert.equal(ehMultiandar(m), true);
  assert.deepEqual(listaDeAndares(m), [
    { id: 'b1', nome: 'Porão', order: -1 },
    { id: null, nome: 'Salão Principal', order: 0 },
    { id: 'a1', nome: 'Andar 1', order: 1 },
  ]);
  assert.equal(andarDe({}), null);
  assert.equal(andarDe({ levelId: 'a1' }), 'a1');
});

test('mapaDoAndar: sem levels dá o mesmo conteúdo no térreo; separa entidades, portas e porão; cache preserva referência', () => {
  const simples = criarMapa({ id: 's', nome: 'Simples', agora: 1 });
  const filtradoSimples = mapaDoAndar(simples, null);
  assert.deepEqual(filtradoSimples, simples);
  assert.equal(mapaDoAndar(simples, null), filtradoSimples);

  const m = mapaExemplo();
  const terreo = mapaDoAndar(m, null);
  const cima = mapaDoAndar(m, 'a1');
  const porao = mapaDoAndar(m, 'b1');

  assert.deepEqual(Object.keys(terreo.rooms), ['r0']);
  assert.deepEqual(Object.keys(terreo.walls), ['w0']);
  assert.deepEqual(Object.keys(terreo.openings), ['op0']);
  assert.deepEqual(Object.keys(terreo.props), []);
  assert.deepEqual(Object.keys(terreo.tokens), ['t0']);
  assert.equal(terreo.terrain.base, 'grama');

  assert.deepEqual(Object.keys(cima.rooms), ['r1']);
  assert.deepEqual(Object.keys(cima.walls), ['w1']);
  assert.deepEqual(Object.keys(cima.openings), ['op1']);
  assert.deepEqual(Object.keys(cima.props), ['p1']);
  assert.deepEqual(Object.keys(cima.lights), ['l1']);
  assert.equal(cima.terrain.base, 'grama');
  assert.equal(cima.climate.weather.rain, 0.8);
  assert.deepEqual(cima.session.explored, { res: 0.5, cells: codificar([[3, 3]]) });

  assert.deepEqual(Object.keys(porao.tokens), ['tb']);
  assert.equal(porao.terrain.base, 'vazio');
  assert.deepEqual(porao.terrain.layers, {});
  assert.equal(porao.backdrop.kind, 'solid');
  assert.equal(porao.backdrop.color, '#141210');
  assert.equal(porao.climate.weather.rain, 0);
  assert.equal(porao.session.explored, null);

  assert.equal(mapaDoAndar(m, 'a1'), cima);
});

test('validação: recusa order 0, order repetida e levelId/exploredLevels inexistente', () => {
  const m = mapaExemplo();
  const mOrder0 = structuredClone(m);
  mOrder0.levels!.x = { id: 'x', name: 'X', order: 0 };
  assert.throws(() => validarMapa(mOrder0), ErroDeValidacao);

  const mRep = structuredClone(m);
  mRep.levels!.a2 = { id: 'a2', name: 'A2', order: 1 };
  assert.throws(() => validarMapa(mRep), ErroDeValidacao);

  const mPropOrfao = structuredClone(m);
  mPropOrfao.props.p1!.levelId = 'naoexiste';
  assert.throws(() => validarMapa(mPropOrfao), ErroDeValidacao);

  const mExpOrfao = structuredClone(m);
  mExpOrfao.session.exploredLevels!.naoexiste = { res: 0.5, cells: [] };
  assert.throws(() => validarMapa(mExpOrfao), ErroDeValidacao);
});
