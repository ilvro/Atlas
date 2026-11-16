import assert from 'node:assert/strict';
import { test } from 'node:test';
import { acaoEscadaParaPeca, andarDe, andaresDosJogadores, ehMultiandar, interacaoDeEscadaPadrao, listaDeAndares, mapaDoAndar, temEscadaDeChegada } from '../../src/domain/andares.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { novaLuz, novoObjeto, novaPeca } from '../../src/domain/fabrica.ts';
import { encaixarNaParede, PAREDE_PADRAO } from '../../src/domain/geometria.ts';
import { gerarLayout } from '../../src/authoring/layout.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { projetarParaJogadores } from '../../src/domain/projecao.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { comandoDeComodoPorContorno } from '../../src/render/pincel.ts';
import { todosOsAlvos } from '../../src/render/selecao.ts';
import { registrarAbaAberta, lembrarAndarDaAba, obterAndarDaAba } from '../../src/app/abas.ts';
import { resolverAndarDoProjetor } from '../../src/app/projetor.ts';
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

test('H4: exploração isolada por andar, projeção e escolha de andar do projetor', () => {
  const base = criarMapa({ id: 'h4', nome: 'Torre', agora: 1 });
  base.bounds = { width: 30, height: 30 };
  base.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  base.tokens.h0 = novaPeca([3, 3], 'Téo', { id: 'h0', player: true });
  base.tokens.h1 = novaPeca([18, 18], 'Lia', { id: 'h1', player: true, levelId: 'a1' });
  base.tokens.e1 = novaPeca([1, 1], 'Espectro', { id: 'e1', player: false, levelId: 'a1' });
  base.props.bau = novoObjeto([18, 18], { id: 'bau', oculto: true, levelId: 'a1' });

  const s = criarStore(base);

  // Salão fechado no andar 1 bloqueia visão até [1, 1]
  s.executar({
    tipo: 'comodo.criar',
    id: 'r1',
    nome: 'Salão',
    funcao: 'sala',
    piso: { material: 'pedra.laje', seed: 1 },
    papel: null,
    celulas: [[10, 10], [11, 10], [12, 10], [13, 10], [14, 10], [15, 10], [10, 11], [11, 11], [12, 11], [13, 11], [14, 11], [15, 11], [10, 12], [11, 12], [12, 12], [13, 12], [14, 12], [15, 12], [10, 13], [11, 13], [12, 13], [13, 13], [14, 13], [15, 13], [10, 14], [11, 14], [12, 14], [13, 14], [14, 14], [15, 14], [10, 15], [11, 15], [12, 15], [13, 15], [14, 15], [15, 15]],
    levelId: 'a1',
  });

  // Mover h1 no andar 1 atualiza só exploredLevels.a1
  s.executar({ tipo: 'peca.mover', id: 'h1', para: [19, 19], livre: true });
  assert.equal(s.documento.session.explored, null);
  assert.ok(s.documento.session.exploredLevels?.a1?.cells.length);

  // Mover h0 no térreo atualiza só explored
  s.executar({ tipo: 'peca.mover', id: 'h0', para: [4.5, 4.5], livre: true });
  assert.ok((s.documento.session.explored as MapaAtlas['session']['explored'])?.cells.length);

  // Projetar para jogadores por andar
  const projA1 = projetarParaJogadores(s.documento, 'a1');
  assert.equal(projA1.session.exploredLevels, undefined);
  assert.ok(projA1.session.explored?.cells.length);
  assert.equal(projA1.tokens.h0, undefined);
  assert.ok(projA1.tokens.h1);
  assert.equal(projA1.props.bau, undefined);
  assert.equal(projA1.tokens.e1, undefined);

  // Grupo dividido e resolução automática/manual do projetor
  assert.deepEqual(andaresDosJogadores(s.documento).map(a => a.id), [null, 'a1']);
  assert.equal(resolverAndarDoProjetor(s.documento, 'a1', undefined), 'a1');
  assert.equal(resolverAndarDoProjetor(s.documento, 'a1', null), null);
  assert.equal(resolverAndarDoProjetor(s.documento, undefined, 'inexistente'), null);

  // Esquecer só o andar 1 preserva exploração do térreo
  s.executar({ tipo: 'sessao.esquecer', andar: 'a1' });
  assert.equal(s.documento.session.exploredLevels, undefined);
  assert.ok((s.documento.session.explored as MapaAtlas['session']['explored'])?.cells.length);

  s.executar({ tipo: 'sessao.esquecer', andar: null });
  assert.equal(s.documento.session.explored, null);
});

test('H5: escadas entre andares, validação, ação radial perto/longe e par automático', () => {
  const m = mapaExemplo();
  const caracol = interacaoDeEscadaPadrao(m, null, 'escada.caracol');
  assert.equal(caracol?.kind, 'stairs');
  assert.equal(caracol?.toLevel, 'a1');

  const alcapao = interacaoDeEscadaPadrao(m, null, 'alcapao');
  assert.equal(alcapao?.kind, 'stairs');
  assert.equal(alcapao?.toLevel, 'b1');
  assert.equal(interacaoDeEscadaPadrao(m, null, 'mesa.cavalete'), null);

  m.props.esc0 = novoObjeto([4.5, 4.5], {
    id: 'esc0',
    source: ACERVO.fonte('escada.caracol', 1),
    interaction: { kind: 'stairs', on: false, targets: [], sound: null, clue: null, toLevel: 'b1', toPosition: [6, 6] },
  });
  m.tokens.heroi = novaPeca([4.5, 5.2], 'Mia', { id: 'heroi', player: true });
  m.lights.lan = novaLuz([4.5, 5.2], { id: 'lan', ownerId: 'heroi' });
  m.tokens.heroi.lightId = 'lan';

  // Validação: mesmo andar ou andar inexistente falham
  const invalidaMesmo = structuredClone(m);
  invalidaMesmo.props.esc0!.interaction!.toLevel = null;
  assert.throws(() => validarMapa(invalidaMesmo), ErroDeValidacao);

  const invalidaFalsa = structuredClone(m);
  invalidaFalsa.props.esc0!.interaction!.toLevel = 'nao_existe';
  assert.throws(() => validarMapa(invalidaFalsa), ErroDeValidacao);

  // Perto da escada (< 1,5 m) mostra "Descer para Porão"; longe retorna null
  const perto = acaoEscadaParaPeca(m, m.tokens.heroi);
  assert.equal(perto?.rotulo, 'Descer para Porão');
  assert.equal(perto?.subindo, false);
  assert.deepEqual(perto?.posicao, [6, 6]);

  const longe = acaoEscadaParaPeca(m, { ...m.tokens.heroi, position: [10, 10] });
  assert.equal(longe, null);

  // Par automático: ainda não há escada no porão em [6, 6]
  assert.equal(temEscadaDeChegada(m, 'b1', [6, 6], 2), false);
  m.props.escB = novoObjeto([6, 6], {
    id: 'escB',
    source: ACERVO.fonte('escada.caracol', 1),
    levelId: 'b1',
    interaction: { kind: 'stairs', on: false, targets: [], sound: null, clue: null, toLevel: null, toPosition: [4.5, 4.5] },
  });
  assert.equal(temEscadaDeChegada(m, 'b1', [6, 6], 2), true);

  // Subir de volta aparece quando está no porão perto de escB
  const s = criarStore(m);
  s.executar({ tipo: 'peca.mudarAndar', id: 'heroi', levelId: perto!.destino, position: perto!.posicao });
  assert.equal(s.documento.tokens.heroi!.levelId, 'b1');
  assert.equal(s.documento.lights.lan!.levelId, 'b1');
  assert.ok(s.documento.session.exploredLevels?.b1?.cells.length);
  const acaoSubir = acaoEscadaParaPeca(s.documento, s.documento.tokens.heroi!);
  assert.equal(acaoSubir?.rotulo, 'Subir para Térreo');
  assert.equal(acaoSubir?.subindo, true);

  // Desfazer volta ao térreo
  s.desfazer();
  assert.equal(s.documento.tokens.heroi!.levelId, undefined);
  assert.equal(s.documento.lights.lan!.levelId, undefined);

  // Remover porão desvincula esc0 em vez de deixar destino quebrado
  s.executar({ tipo: 'andar.remover', id: 'b1' });
  assert.equal(s.documento.props.esc0!.interaction, null);
});
