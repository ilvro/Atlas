import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { circulacao, malhaDoComodo, marcarRetangulo, retanguloLivre, indiceNaMalha, RES_MALHA } from '../../src/authoring/malha.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';
import type { MapaAtlas, Objeto } from '../../src/domain/mapa.ts';

/** Um quarto de 6 × 4,5 m com portas nas paredes esquerda (x = 0) e direita (x = 6), a meia altura. */
function quartoComDuasPortas(): MapaAtlas {
  const m = mapaCom(sala('q', 0, 0, 4, 3));
  m.openings.pe = abertura(m, 'pe', paredeEm(m, 'x', 0, 4.4)!.id, 0.5);
  m.openings.pd = abertura(m, 'pd', paredeEm(m, 'x', 6, 4.4)!.id, 0.5);
  return m;
}
const movel = (id: string, x: number, y: number, extra: Partial<Objeto> = {}) => novoObjeto([x, y], { id, source: { kind: 'recipe', recipe: 'caixa', seed: 1, params: {} }, roomId: 'q', ...extra });

test('a malha cobre a caixa do cômodo em sub-células de 0,25 m, e `dentro` segue as células do cômodo', () => {
  const m = mapaCom(sala('a', 0, 0, 2, 1), sala('b', 0, 1, 1, 2));         // em L: o canto de baixo à direita é vazio
  const malha = malhaDoComodo(m, insightDoComodo(m, 'a')!);
  assert.equal(malha.res, RES_MALHA); assert.equal(malha.colunas, 12); assert.equal(malha.linhas, 6);
  assert.equal(malha.dentro.reduce((a, b) => a + b, 0), 12 * 6, 'a sala "a" é um retângulo cheio');
  const b = malhaDoComodo(m, insightDoComodo(m, 'b')!);
  assert.equal(b.colunas, 6); assert.equal(b.dentro.reduce((s, v) => s + v, 0), 36);
});

test('retanguloLivre: dentro do cômodo e longe do que está ocupado; marcarRetangulo ocupa', () => {
  const m = quartoComDuasPortas(), malha = malhaDoComodo(m, insightDoComodo(m, 'q')!);
  assert.equal(retanguloLivre(malha, { x0: 1, y0: 1, x1: 2, y1: 2 }, [malha.ocupada]), true);
  assert.equal(retanguloLivre(malha, { x0: -0.5, y0: 1, x1: 0.5, y1: 2 }, []), false, 'sai do cômodo');
  marcarRetangulo(malha, { x0: 1.4, y0: 1.4, x1: 1.6, y1: 1.6 }, 'ocupada');
  assert.equal(retanguloLivre(malha, { x0: 1, y0: 1, x1: 2, y1: 2 }, [malha.ocupada]), false);
  assert.equal(retanguloLivre(malha, { x0: 1, y0: 1, x1: 2, y1: 2 }, []), true, 'sem a camada a evitar, nada impede');
});

test('a área da porta fica na frente dela, do lado de dentro', () => {
  const m = quartoComDuasPortas(), ins = insightDoComodo(m, 'q')!, malha = malhaDoComodo(m, ins);
  const cel = (x: number, y: number) => malha.porta[indiceNaMalha(malha, Math.floor((x - malha.x0) / malha.res), Math.floor((y - malha.y0) / malha.res))];
  const p = ins.portas.find(x => x.id === 'pe')!;
  assert.equal(cel(p.centro[0] + 0.3, p.centro[1]), 1, 'logo à frente da porta da esquerda');
  assert.equal(cel(p.centro[0] + 1.5, p.centro[1]), 0, 'longe da porta');
  assert.equal(cel(3, 0.4), 0, 'nem toda a parede');
});

test('circulação: cômodo vazio com duas portas está ligado e a faixa liga as duas', () => {
  const m = quartoComDuasPortas(), ins = insightDoComodo(m, 'q')!, malha = malhaDoComodo(m, ins), c = circulacao(malha, ins);
  assert.equal(c.ligada, true); assert.deepEqual(c.isoladas, []);
  const noMeio = c.faixa[indiceNaMalha(malha, Math.floor(3 / malha.res), Math.floor(ins.portas[0]!.centro[1] / malha.res))];
  assert.equal(noMeio, 1, 'a faixa passa pelo meio, na altura das portas');
  assert.equal(c.faixa[indiceNaMalha(malha, 12, 0)], 0, 'e não cobre o cômodo todo');
});

test('um móvel de parede a parede separa as portas; tapete não bloqueia', () => {
  const m = quartoComDuasPortas();
  // Uma barreira de caixotes: uma fileira de x = 2,9 a 3,1 por toda a altura (4,5 m).
  for (let k = 0; k < 9; k++) m.props[`b${k}`] = movel(`b${k}`, 3, 0.25 + k * 0.5, { source: { kind: 'recipe', recipe: 'caixa', seed: 1, params: {} } });
  m.props = { ...m.props };
  let ins = insightDoComodo(m, 'q')!, c = circulacao(malhaDoComodo(m, ins), ins);
  assert.equal(c.ligada, false); assert.equal(c.isoladas.length, 1); assert.ok(['pe', 'pd'].includes(c.isoladas[0]!));
  // Trocando os caixotes por tapetes (não bloqueiam), a passagem volta.
  for (const k of Object.keys(m.props)) m.props[k] = { ...m.props[k]!, blocks: { move: false, sight: false } };
  ins = insightDoComodo(m, 'q')!; c = circulacao(malhaDoComodo(m, ins), ins);
  assert.equal(c.ligada, true);
  // E um objeto sobre a mesa não ocupa o chão.
  const m2 = quartoComDuasPortas(); m2.props.p = movel('p', 3, 2.25, { elevation: 'table' });
  assert.equal(malhaDoComodo(m2, insightDoComodo(m2, 'q')!).ocupada.reduce((a, b) => a + b, 0), 0);
});

test('com uma porta só, ela tem de alcançar o meio do cômodo; cômodo sem portas está ligado', () => {
  const m = mapaCom(sala('q', 0, 0, 4, 3)); m.openings.p = abertura(m, 'p', paredeEm(m, 'y', 0, 4.4)!.id, 0.5);
  let ins = insightDoComodo(m, 'q')!, c = circulacao(malhaDoComodo(m, ins), ins);
  assert.equal(c.ligada, true); assert.ok(c.faixa.some(v => v === 1));
  // Cercando a porta com caixotes, ela não alcança o meio.
  for (let k = 0; k < 12; k++) m.props[`c${k}`] = movel(`c${k}`, 0.25 + k * 0.5, 1.0);
  ins = insightDoComodo(m, 'q')!; c = circulacao(malhaDoComodo(m, ins), ins);
  assert.equal(c.ligada, false); assert.deepEqual(c.isoladas, ['p']);
  const vazio = mapaCom(sala('v', 0, 0, 2, 2)), iv = insightDoComodo(vazio, 'v')!, cv = circulacao(malhaDoComodo(vazio, iv), iv);
  assert.equal(cv.ligada, true); assert.ok(cv.faixa.every(v => v === 0));
});

test('uma casa de 3 cômodos de 6 × 4,5 m calcula as malhas depressa', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3), sala('b', 4, 0, 8, 3), sala('c', 8, 0, 12, 3));
  const t0 = performance.now();
  for (const id of ['a', 'b', 'c']) { const ins = insightDoComodo(m, id)!; circulacao(malhaDoComodo(m, ins), ins); }
  console.log(`# malha das 3 salas: ${(performance.now() - t0).toFixed(2)} ms`);
});
