import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONDICOES, atendida, corProxima, igual, medir, valoresEm, type EstadoDoTutor } from '../../src/tutorial/condicoes.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { novaLuz, novaPeca } from '../../src/domain/fabrica.ts';
import { codificar } from '../../src/domain/celulas.ts';

function estado(extra: Partial<EstadoDoTutor> = {}): EstadoDoTutor {
  const doc = criarMapa({ id: 'm', agora: 1 });
  return { doc, modo: 'construir', aba: 'mapa', ferramenta: 'selecionar', selecao: [], projetor: false, vistaDeJogador: false, sujo: false, ...extra };
}

test('igual: números a ~2% (e 0,011), textos sem maiúsculas; corProxima: cinzas pela claridade, o resto pelo matiz', () => {
  assert.equal(igual(7.1, 7), true); assert.equal(igual(7.5, 7), false); assert.equal(igual(0.005, 0), true); assert.equal(igual('Noite', 'noite'), true); assert.equal(igual('a', 'b'), false); assert.equal(igual('7', 7), false);
  assert.equal(corProxima('#ffd9a0', '#ffb36b'), true); assert.equal(corProxima('#3040ff', '#ffb36b'), false); assert.equal(corProxima('#606060', '#5a5d60'), true); assert.equal(corProxima('azul', '#ffffff'), false);
});

test('valoresEm: caminhos pontilhados e o * que percorre coleções; some o que não existe', () => {
  const e = estado(); e.doc.lights.a = { ...novaLuz([1, 1]), id: 'a', radius: 5 }; e.doc.lights.b = { ...novaLuz([2, 2]), id: 'b', radius: 8 };
  assert.deepEqual(valoresEm(e.doc, 'lights.*.radius').sort(), [5, 8]); assert.deepEqual(valoresEm(e.doc, 'climate.ambient.intensity').length, 1); assert.deepEqual(valoresEm(e.doc, 'nao.existe.aqui'), []);
});

test('as condições leem o resultado: cômodos, aberturas, luzes, peças, clima e valores', () => {
  const e = estado();
  assert.equal(atendida(['comodos', 1], e), false);
  e.doc.rooms.r = { id: 'r', name: 'Sala', function: 'sala', cells: codificar([[0, 0], [1, 0]]), floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, ceiling: null } as never;
  assert.equal(atendida(['comodos', 1], e), true); assert.equal(atendida(['comodoComFuncao', 'sala'], e), true); assert.equal(atendida(['comodoComFuncao', 'cozinha'], e), false);
  assert.equal(atendida(['comodoComPiso', 'tabuas.carvalho'], e), true); assert.equal(atendida(['comodoNomeado', 'sala'], e), true); assert.equal(atendida(['comodoComPapel', 'papel.liso-claro'], e), false);
  e.doc.lights.l = { ...novaLuz([1, 1]), id: 'l', preset: 'lamparina', radius: 7 };
  assert.equal(atendida(['luzComPreset', 'lamparina'], e), true); assert.equal(atendida(['valor', 'lights.*.radius', 7], e), true); assert.equal(atendida(['valor', 'lights.*.radius', 9], e), false);
  const t = novaPeca([1, 1], 'Ana', { player: true }); e.doc.tokens[t.id] = t; assert.equal(atendida(['pecasDeJogador', 1], e), true); assert.equal(atendida(['pecasDeJogador', 2], e), false);
  assert.equal(atendida(['regioes', 1], e), false);
  e.doc.regions.reg = { id: 'reg', polygon: [[0, 0], [3, 0], [3, 3], [0, 3]], kind: 'trigger', gmOnly: true, payload: { texto: 'Armadilha' }, refs: [] };
  assert.equal(atendida(['regioes', 1], e), true);
  assert.equal(atendida(['regiaoOcupada', 'trigger'], e), true);
  assert.equal(atendida(['comodoComLeitura'], e), false);
  e.doc.comodosExtra.r = { id: 'r', leitura: 'Poeira e livros', notasMestre: '', refs: [] };
  assert.equal(atendida(['comodoComLeitura'], e), true);
  assert.equal(atendida(['climaE', e.doc.climate.preset], e), true); assert.equal(atendida(['modo', 'sessao'], e), false); assert.equal(atendida(['modo', 'sessao'], { ...e, modo: 'sessao' }), true);
  assert.equal(atendida(['ferramenta', 'comodo'], { ...e, ferramenta: 'comodo' }), true); assert.equal(atendida(['selecionado', 'tokens'], { ...e, selecao: [{ colecao: 'tokens', id: t.id }] }), true);
  assert.equal(atendida(['ler'], e), false, '“ler” só termina com Continuar');
  assert.equal(atendida(['nao-existe'], e), false); assert.equal(atendida(undefined, e), false);
  assert.ok(Object.keys(CONDICOES).length > 25);
});

test('condições de momentos e barra de efeitos', () => {
  const e = estado();
  assert.equal(atendida(['momentoCriado', 'O porão acorda'], e), false);
  e.doc.moments.m1 = {
    id: 'm1',
    nome: 'O porão acorda',
    cor: null,
    passos: [{ tipo: 'efeito', efeito: 'tremor' }],
  };
  assert.equal(atendida(['momentoCriado', 'O porão acorda'], e), true);
  assert.equal(atendida(['momentoCriado', 'Outro'], e), false);

  assert.equal(atendida(['momentoTocado'], e), false);
  e.ultimoMomentoTocadoId = 'm1';
  assert.equal(atendida(['momentoTocado'], e), true);

  assert.equal(atendida(['regiaoComMomento'], e), false);
  e.doc.regions.r1 = {
    id: 'r1',
    polygon: [[0, 0], [3, 0], [3, 3], [0, 3]],
    kind: 'trigger',
    gmOnly: true,
    payload: { momento: 'm1' },
    refs: [],
  };
  assert.equal(atendida(['regiaoComMomento'], e), true);

  assert.equal(atendida(['espacoDisparado', 3], e), false);
  e.ultimoDisparo = { i: 2, quando: 1000 };
  assert.equal(atendida(['espacoDisparado', 3], e), true);
});

test('medir: "quase lá" para valores numéricos; nada para o resto', () => {
  const e = estado(); e.doc.lights.l = { ...novaLuz([1, 1]), id: 'l', radius: 5 };
  assert.deepEqual(medir(['valor', 'lights.*.radius', 8], e), { texto: 'Agora 5, falta chegar a 8', falta: 3 });
  assert.equal(medir(['valor', 'lights.*.radius', 5], e)!.texto, 'Pronto'); assert.equal(medir(['valor', 'lights.*.color', '#fff'], e), null); assert.equal(medir(['comodos', 1], e), null);
});

test('e e selecionadoEm: a ferramenta e o item certo, no lugar certo (uma seleção antiga em outro lugar não vale)', () => {
  const e = estado({ ferramenta: 'selecionar' });
  e.doc.rooms.r = { id: 'r', name: 'Sala', function: 'sala', cells: codificar([[2, 2], [3, 2], [2, 3], [3, 3]]), floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, ceiling: null } as never;
  e.doc.lights.l = { ...novaLuz([6, 5.25]), id: 'l' };
  const com = (selecao: { colecao: string; id: string }[], ferramenta = 'selecionar') => ({ ...e, selecao, ferramenta });
  assert.equal(atendida(['selecionadoEm', 'rooms', [4.5, 4.5]], com([{ colecao: 'rooms', id: 'r' }])), true);
  assert.equal(atendida(['selecionadoEm', 'rooms', [12, 12]], com([{ colecao: 'rooms', id: 'r' }])), false, 'outro cômodo');
  assert.equal(atendida(['selecionadoEm', 'lights', [6.5, 5.25]], com([{ colecao: 'lights', id: 'l' }])), true);
  assert.equal(atendida(['selecionadoEm', 'lights', [12, 12]], com([{ colecao: 'lights', id: 'l' }])), false);
  const passo = ['e', ['ferramenta', 'selecionar'], ['selecionadoEm', 'lights', [6, 5.25]]] as const;
  assert.equal(atendida(passo, com([{ colecao: 'lights', id: 'l' }], 'luz')), false, 'a luz recém-posta já vem selecionada, mas a ferramenta é outra');
  assert.equal(atendida(passo, com([{ colecao: 'lights', id: 'l' }])), true);
});
