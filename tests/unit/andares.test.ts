import assert from 'node:assert/strict';
import { test } from 'node:test';
import { andarDe, ehMultiandar, listaDeAndares, mapaDoAndar } from '../../src/domain/andares.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { novaLuz, novoObjeto, novaPeca } from '../../src/domain/fabrica.ts';
import { encaixarNaParede, PAREDE_PADRAO } from '../../src/domain/geometria.ts';
import { gerarLayout } from '../../src/authoring/layout.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { comandoDeComodoPorContorno } from '../../src/render/pincel.ts';
import { todosOsAlvos } from '../../src/render/selecao.ts';
import { registrarAbaAberta, lembrarAndarDaAba, obterAndarDaAba } from '../../src/app/abas.ts';
import { criarSessao } from '../../src/app/sessao.ts';
import { criarStore } from '../../src/state/store.ts';

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

test('H2: comandos de andar, paredes derivadas isoladas por andar, encaixe e mobília por andar', () => {
  const s = criarStore(criarMapa({ id: 'h2', nome: 'Casa', agora: 1 }));
  s.executar({ tipo: 'andar.criar', andar: { id: 'a1', name: 'Superior', order: 1 } });
  s.executar({ tipo: 'andar.atualizar', id: 'a1', patch: { name: 'Andar 1' } });
  assert.equal(s.documento.levels!.a1!.name, 'Andar 1');

  const piso = { material: 'tabuas.carvalho', seed: 1 };
  // Quarto no térreo e quarto em cima nas mesmas células [2..6, 2..5]
  const celulas: [number, number][] = [];
  for (let y = 2; y < 5; y++) for (let x = 2; x < 6; x++) celulas.push([x, y]);
  s.executar({ tipo: 'comodo.criar', id: 'r0', nome: 'Sala', funcao: 'sala', piso, papel: null, celulas, levelId: null });
  s.executar({ tipo: 'comodo.criar', id: 'r1', nome: 'Quarto', funcao: 'quarto', piso, papel: null, celulas, levelId: 'a1' });

  // Nenhum roubou células do outro, e cada andar tem 4 paredes derivadas próprias
  assert.equal(Object.keys(s.documento.rooms).length, 2);
  const paredesR0 = Object.values(s.documento.walls).filter(w => (w.levelId ?? null) === null);
  const paredesR1 = Object.values(s.documento.walls).filter(w => (w.levelId ?? null) === 'a1');
  assert.equal(paredesR0.length, 4);
  assert.equal(paredesR1.length, 4);

  // Removendo r0, encaixarNaParede com andar null não pega a parede do andar a1
  s.executar({ tipo: 'comodo.remover', id: 'r0' });
  assert.equal(encaixarNaParede(s.documento, [4.5, 3], 0.9, 0.75, false, null), null);
  assert.ok(encaixarNaParede(s.documento, [4.5, 3], 0.9, 0.75, false, 'a1'));

  // Mobília do quarto em a1 ignora cama posta no térreo no mesmo lugar
  s.executar({
    tipo: 'item.adicionar',
    colecao: 'props',
    item: novoObjeto([5.2, 4.5], { id: 'mesaT', source: { kind: 'recipe', recipe: 'cama.casal', seed: 1, params: {} }, levelId: null }) as unknown as { id: string } & Record<string, unknown>,
  });
  const layout = gerarLayout(s.documento, { roomId: 'r1', funcao: 'quarto', genero: 'investigacao', semente: 7 });
  assert.ok(layout.objetos.some(o => o.source.kind === 'recipe' && o.source.recipe.startsWith('cama')));
  assert.ok(layout.objetos.every(o => o.levelId === 'a1'));

  // Remover andar a1 apaga r1 e suas paredes; desfazer restaura
  s.executar({ tipo: 'andar.remover', id: 'a1' });
  assert.equal(s.documento.levels, undefined);
  assert.equal(s.documento.rooms.r1, undefined);
  assert.equal(Object.values(s.documento.walls).filter(w => w.levelId === 'a1').length, 0);
  s.desfazer();
  assert.equal(s.documento.levels!.a1!.name, 'Andar 1');
  assert.ok(s.documento.rooms.r1);
  assert.equal(Object.values(s.documento.walls).filter(w => w.levelId === 'a1').length, 4);
});

test('H3: andarAtivo da sessão, criação por contorno no andar e seleção isolada por andar', () => {
  const m = mapaExemplo();
  const cmd = comandoDeComodoPorContorno(m, [[1, 1], [5, 1], [5, 5], [1, 5]], 'torre', 'c_sup', 42, 'a1');
  assert.equal(typeof cmd, 'object');
  if (typeof cmd !== 'string') assert.equal(cmd.levelId, 'a1');

  registrarAbaAberta(m.id, m.name);
  lembrarAndarDaAba(m.id, 'a1');
  assert.equal(obterAndarDaAba(m.id), 'a1');

  const repoFake = { gravar: async (doc: typeof m) => doc } as never;
  const ses = criarSessao(m, repoFake, { salvo: true });
  try {
    assert.equal(ses.andarAtivo.value, 'a1');
    const alvosA1 = todosOsAlvos(mapaDoAndar(ses.doc.value, ses.andarAtivo.value)).map(a => a.id);
    assert.deepEqual(alvosA1, ['p1', 'l1']);
    ses.selecao.value = [{ colecao: 'props', id: 'p1' }];
    ses.store.executar({ tipo: 'andar.remover', id: 'a1' });
    assert.equal(ses.andarAtivo.value, null);
    assert.deepEqual(ses.selecao.value, []);
  } finally {
    ses.fechar();
  }
});
