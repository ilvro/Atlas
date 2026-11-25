import { test } from 'node:test';
import assert from 'node:assert/strict';
import { anguloDoMovimento, bloqueioNoCaminho, centroDaCelula, ladoDoMovimento } from '../../src/domain/movimento.ts';
import { novaLuz, novaPeca, novoObjeto } from '../../src/domain/fabrica.ts';
import { itemBloqueiaMovimentoPorPadrao } from '../../src/procedural/acervo.ts';
import { camposDoPreset, presetDeLuz } from '../../src/domain/presets.ts';
import { criarMapa, type MapaAtlas, type Abertura } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { aplicarComando } from '../../src/state/comandos.ts';

/** Uma parede vertical em x = 6 (de y = 0 a 12) e uma peça à esquerda, no centro de uma célula (grade de 1,5). */
function mapaComParede(abertura?: Partial<Abertura>): MapaAtlas {
  let m = criarMapa();
  m.walls.p = { id: 'p', path: [[6, 0], [6, 12]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null };
  if (abertura) m.openings.a = { id: 'a', wallId: 'p', at: 0.5, width: 1, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a', ...abertura };
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([2.25, 6.75]), id: 't', name: 'Muirenn' } as never });
  return m;
}
const ESQ: [number, number] = [5.25, 6.75], DIR: [number, number] = [6.75, 6.75];

test('o centro da célula é o centro do quadrado da grade onde o ponto cai', () => {
  const m = criarMapa();
  assert.deepEqual(centroDaCelula(m, [0.1, 0.1]), [0.75, 0.75]);
  assert.deepEqual(centroDaCelula(m, [1.6, 3.2]), [2.25, 3.75]);
});

test('atravessar uma parede com bloqueio de movimento é recusado; andar ao lado dela, não', () => {
  const m = mapaComParede();
  assert.equal(bloqueioNoCaminho(m, ESQ, DIR), 'Tem uma parede no caminho.');
  assert.equal(bloqueioNoCaminho(m, ESQ, [5.25, 8.25]), null);
  const baixa = { ...m, walls: { p: { ...m.walls.p!, blocks: { move: false, sight: false, light: false } } } };
  assert.equal(bloqueioNoCaminho(baixa, ESQ, DIR), null, 'uma mureta baixa que não bloqueia o movimento deixa passar');
});

test('porta aberta e arco passam; porta fechada e trancada não, e dizem por quê', () => {
  assert.equal(bloqueioNoCaminho(mapaComParede({ at: 6.75 / 12, state: 'open' }), ESQ, DIR), null);
  assert.equal(bloqueioNoCaminho(mapaComParede({ at: 6.75 / 12, kind: 'arch' }), ESQ, DIR), null);
  assert.equal(bloqueioNoCaminho(mapaComParede({ at: 6.75 / 12, state: 'closed' }), ESQ, DIR), 'A porta está fechada.');
  assert.equal(bloqueioNoCaminho(mapaComParede({ at: 6.75 / 12, state: 'locked' }), ESQ, DIR), 'A porta está trancada.');
  assert.equal(bloqueioNoCaminho(mapaComParede({ at: 0.1, state: 'open' }), ESQ, DIR), 'Tem uma parede no caminho.', 'a porta está em outro ponto da parede');
});

test('peca.mover encaixa no centro da célula, vira a peça e respeita os bloqueios', () => {
  let m = mapaComParede();
  m = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [3.2, 7.1] });
  assert.deepEqual(m.tokens.t!.position, [3.75, 6.75]);
  assert.equal(m.tokens.t!.facing, 'right');
  assert.throws(() => aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [8, 6.75] }), /parede/);
  assert.throws(() => aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [-3, 6.75] }), /Fora do mapa/);
  const livre = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [8, 6.75], livre: true });
  assert.deepEqual(livre.tokens.t!.position, [8.25, 6.75]);
});

test('peca.mover com semGrade usa a coordenada exata (movimento freeform) e ainda respeita paredes', () => {
  let m = mapaComParede();
  m = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [3.2, 7.1], semGrade: true });
  assert.deepEqual(m.tokens.t!.position, [3.2, 7.1]);
  assert.equal(m.tokens.t!.facing, 'right');
  assert.throws(() => aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [8.1, 7.1], semGrade: true }), /parede/);
  const livreSemGrade = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [8.1, 7.1], livre: true, semGrade: true });
  assert.deepEqual(livreSemGrade.tokens.t!.position, [8.1, 7.1]);
});

test('mover a peça é uma entrada de histórico e desfazer a devolve', () => {
  const store = criarStore(mapaComParede());
  store.executar({ tipo: 'peca.mover', id: 't', para: [3.75, 6.75] });
  assert.deepEqual(store.documento.tokens.t!.position, [3.75, 6.75]);
  assert.equal(store.rotuloDesfazer, 'Mover peça');
  store.desfazer();
  assert.deepEqual(store.documento.tokens.t!.position, [2.25, 6.75]);
  assert.equal(store.documento.tokens.t!.facing, 'down');
});

test('o lado e o ângulo do movimento', () => {
  assert.equal(ladoDoMovimento([0, 0], [3, 1]), 'right');
  assert.equal(ladoDoMovimento([0, 0], [-3, 1]), 'left');
  assert.equal(ladoDoMovimento([0, 0], [1, 3]), 'down');
  assert.equal(ladoDoMovimento([0, 0], [1, -3]), 'up');
  assert.equal(anguloDoMovimento([0, 0], [2, 0]), 0);
  assert.ok(Math.abs(anguloDoMovimento([0, 0], [0, 2]) - Math.PI / 2) < 1e-9);
});

/** A mesma peça, agora com uma lanterna (cone) presa a ela. */
function mapaComLanterna(): MapaAtlas {
  let m = mapaComParede();
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'lights', item: { ...novaLuz([2.25, 6.75], { ...camposDoPreset(presetDeLuz('lanterna')!, Math.PI / 2), ownerId: 't' }), id: 'luz' } as never });
  return aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 't', patch: { lightId: 'luz' } });
}

test('a lanterna acompanha a peça e aponta para onde ela andou', () => {
  let m = mapaComLanterna();
  m = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [3.75, 6.75] });
  assert.deepEqual(m.lights.luz!.position, [3.75, 6.75]);
  assert.equal(m.lights.luz!.cone!.direction, 0, 'para a direita: 0 rad');
  m = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [3.75, 5.25] });
  assert.ok(Math.abs(m.lights.luz!.cone!.direction + Math.PI / 2) < 1e-9, 'para cima: -90°');
  const parada = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [3.75, 5.25] });
  assert.equal(parada.lights.luz!.cone!.direction, m.lights.luz!.cone!.direction, 'parado não muda');
});

test('uma luz redonda anda com a peça sem ganhar direção', () => {
  let m = mapaComParede();
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'lights', item: { ...novaLuz([2.25, 6.75], { ...camposDoPreset(presetDeLuz('vela')!), ownerId: 't' }), id: 'vela' } as never });
  m = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 't', patch: { lightId: 'vela' } });
  m = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [3.75, 6.75] });
  assert.deepEqual(m.lights.vela!.position, [3.75, 6.75]); assert.equal(m.lights.vela!.cone, null);
});

test('peca.virar gira o facho sem mover a peça, e recusa peça sem lanterna', () => {
  let m = mapaComLanterna();
  m = aplicarComando(m, { tipo: 'peca.virar', id: 't', direcao: Math.PI / 4 });
  assert.equal(m.lights.luz!.cone!.direction, Math.PI / 4); assert.deepEqual(m.tokens.t!.position, [2.25, 6.75]);
  assert.throws(() => aplicarComando(mapaComParede(), { tipo: 'peca.virar', id: 't', direcao: 1 }), /lanterna/);
});

test('remover a peça remove a lanterna; desfazer o movimento devolve a direção', () => {
  const sem = aplicarComando(mapaComLanterna(), { tipo: 'item.remover', colecao: 'tokens', id: 't' });
  assert.equal(sem.lights.luz, undefined);
  const store = criarStore(mapaComLanterna());
  store.executar({ tipo: 'peca.mover', id: 't', para: [3.75, 6.75] });
  assert.equal(store.documento.lights.luz!.cone!.direction, 0);
  store.desfazer();
  assert.equal(store.documento.lights.luz!.cone!.direction, Math.PI / 2); assert.deepEqual(store.documento.lights.luz!.position, [2.25, 6.75]);
});

test('objeto com blocks.move: true bloqueia atravessar e parar sobre ele; blocks.move: false deixa passar', () => {
  let m = criarMapa();
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([2.25, 6.75]), id: 't', name: 'Muirenn' } as never });
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'props',
    item: {
      ...novoObjeto([3.75, 6.75], { source: { kind: 'recipe', recipe: 'rochedo', seed: 1, params: {} }, blocks: { move: true, sight: false } }),
      id: 'pedra',
    } as never,
  });

  // Não pode parar sobre o obstáculo nem atravessá-lo até o outro lado.
  assert.equal(bloqueioNoCaminho(m, [2.25, 6.75], [3.75, 6.75]), 'Bloqueado por obstáculo.');
  assert.equal(bloqueioNoCaminho(m, [2.25, 6.75], [5.25, 6.75]), 'Bloqueado por obstáculo.');
  assert.throws(() => aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [3.75, 6.75] }), /obstáculo/i);
  assert.throws(() => aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [5.25, 6.75] }), /obstáculo/i);

  // Movimento livre (Alt / mestre) ainda passa, e andar ao lado do obstáculo também passa.
  assert.equal(bloqueioNoCaminho(m, [2.25, 6.75], [2.25, 8.25]), null);

  // Desligando blocks.move (com desfazer), o caminho fica livre.
  const store = criarStore(m);
  store.executar({ tipo: 'item.atualizar', colecao: 'props', id: 'pedra', patch: { blocks: { move: false } } });
  assert.equal(bloqueioNoCaminho(store.documento, [2.25, 6.75], [3.75, 6.75]), null);
  assert.equal(bloqueioNoCaminho(store.documento, [2.25, 6.75], [5.25, 6.75]), null);
  store.executar({ tipo: 'peca.mover', id: 't', para: [5.25, 6.75] });
  assert.deepEqual(store.documento.tokens.t!.position, [5.25, 6.75]);

  store.desfazer(); // desfaz mover
  store.desfazer(); // desfaz atualizar obstáculo
  assert.equal(bloqueioNoCaminho(store.documento, [2.25, 6.75], [3.75, 6.75]), 'Bloqueado por obstáculo.');
});

test('objeto obstáculo em outro andar (levelId diferente) não bloqueia o andar atual', () => {
  let m = criarMapa();
  m.levels = { andar2: { id: 'andar2', name: '1º Andar', order: 1 } };
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([2.25, 6.75]), id: 't', name: 'Muirenn' } as never });
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'props',
    item: {
      ...novoObjeto([3.75, 6.75], { source: { kind: 'recipe', recipe: 'pinheiro', seed: 1, params: {} }, blocks: { move: true, sight: false }, levelId: 'andar2' }),
      id: 'arvore-cima',
    } as never,
  });

  // Peça no térreo passa normalmente sob o objeto do 1º andar.
  assert.equal(bloqueioNoCaminho(m, [2.25, 6.75], [3.75, 6.75]), null);
  assert.equal(bloqueioNoCaminho(m, [2.25, 6.75], [5.25, 6.75]), null);
  const movido = aplicarComando(m, { tipo: 'peca.mover', id: 't', para: [5.25, 6.75] });
  assert.deepEqual(movido.tokens.t!.position, [5.25, 6.75]);

  // Já no mesmo andar ('andar2'), o objeto bloqueia.
  assert.equal(bloqueioNoCaminho(m, [2.25, 6.75], [3.75, 6.75], { levelId: 'andar2' }), 'Bloqueado por obstáculo.');
});

test('padrão de obstáculo no acervo: pedras/árvores bloqueiam, tapetes/rasteira/papéis/piso/assentos leves não', () => {
  assert.equal(itemBloqueiaMovimentoPorPadrao('rochedo'), true);
  assert.equal(itemBloqueiaMovimentoPorPadrao('pedra.grande'), true);
  assert.equal(itemBloqueiaMovimentoPorPadrao('pinheiro'), true);
  assert.equal(itemBloqueiaMovimentoPorPadrao('mesa.retangular'), true);
  assert.equal(itemBloqueiaMovimentoPorPadrao('tapete.persa'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('moita-de-samambaia'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('tufo-de-capim'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('tufo-de-grama'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('bueiro'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('faixa-continua'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('cobertura-de-posto'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('cadeira'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('banqueta'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('colchao-no-chao'), false);
  assert.equal(itemBloqueiaMovimentoPorPadrao('papeis'), false);

  // novoObjeto deriva blocks.move do padrão do acervo quando não especificado
  assert.equal(novoObjeto([0, 0], { source: { kind: 'recipe', recipe: 'bueiro', seed: 1, params: {} } }).blocks.move, false);
  assert.equal(novoObjeto([0, 0], { source: { kind: 'recipe', recipe: 'cadeira', seed: 1, params: {} } }).blocks.move, false);
  assert.equal(novoObjeto([0, 0], { source: { kind: 'recipe', recipe: 'tufo-de-capim', seed: 1, params: {} } }).blocks.move, false);
  assert.equal(novoObjeto([0, 0], { source: { kind: 'recipe', recipe: 'rochedo', seed: 1, params: {} } }).blocks.move, true);
});
