import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { propostaDePorta, textoDaPorta } from '../../src/authoring/portas.ts';
import { previaDaProposta } from '../../src/authoring/proposta.ts';
import { proximaSugestao, type Contexto } from '../../src/authoring/sugestoes.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import type { MapaAtlas } from '../../src/domain/mapa.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const ctx = (m: MapaAtlas, semente = 0): Contexto => ({ m, versao: 0, semente, gerarId: contador() });
const aberturaDa = (p: NonNullable<ReturnType<typeof propostaDePorta>>) => { const c = p.comandos[0]!; assert.equal(c.tipo, 'abertura.adicionar'); return (c as { abertura: import('../../src/domain/mapa.ts').Abertura }).abertura; };

test('dois cômodos lado a lado sem porta: proposta com uma porta na parede comum, que cabe', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Sala', function: 'sala' }), sala('b', 4, 0, 8, 3, { name: 'Quarto', function: 'quarto' }));
  const p = propostaDePorta(ctx(m), 'b')!; assert.ok(p); assert.equal(textoDaPorta(ctx(m), 'b'), 'Pôr uma porta para a Sala?');
  const a = aberturaDa(p), parede = m.walls[a.wallId]!;
  assert.ok(parede.path.every(q => Math.abs(q[0] - 6) < 1e-9), 'na parede comum (x = 6)'); assert.equal(a.kind, 'door'); assert.equal(a.width, 0.9); assert.equal(a.state, 'closed');
  const depois = previaDaProposta(m, p); // valida o mapa inteiro
  assert.equal(insightDoComodo(depois, 'a')!.vizinhos[0]!.ligado, true); assert.equal(insightDoComodo(depois, 'b')!.vizinhos[0]!.ligado, true);
});

test('com uma porta já ligando, não sugere porta entre os dois; o cômodo sem ligação é que recebe', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Sala', function: 'sala' }), sala('b', 4, 0, 8, 3, { name: 'Quarto', function: 'quarto' }));
  m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 6, 4.4)!.id, 0.5);
  assert.equal(propostaDePorta(ctx(m), 'b'), null); assert.equal(propostaDePorta(ctx(m), 'a')?.tipo === 'porta' && textoDaPorta(ctx(m), 'a') !== 'Pôr uma porta para a Quarto?', true);
});

test('um cômodo que só encosta no corredor recebe a porta para o corredor; a cozinha prefere a sala', () => {
  const m = mapaCom(sala('c', 0, 0, 1, 3, { name: 'Corredor', function: 'corredor' }), sala('q', 1, 0, 4, 3, { name: 'Quarto', function: 'quarto' }));
  assert.equal(textoDaPorta(ctx(m), 'q'), 'Pôr uma porta para a Corredor?');
  const dois = mapaCom(sala('k', 2, 0, 5, 3, { name: 'Cozinha', function: 'cozinha' }), sala('s', 0, 0, 2, 3, { name: 'Sala', function: 'sala' }), sala('q', 2, 3, 5, 5, { name: 'Quarto', function: 'quarto' }));
  assert.equal(textoDaPorta(ctx(dois), 'k'), 'Pôr uma porta para a Sala?');
});

test('móvel colado na parede comum empurra a porta para outra posição', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Sala', function: 'sala' }), sala('b', 4, 0, 8, 3, { name: 'Quarto', function: 'quarto' }));
  const livre = aberturaDa(propostaDePorta(ctx(m), 'b')!);
  const total = (m.walls[livre.wallId]!.path.at(-1)![1] - m.walls[livre.wallId]!.path[0]![1]), y = m.walls[livre.wallId]!.path[0]![1] + livre.at * total;
  m.props.armario = novoObjeto([5.5, y], { id: 'armario', roomId: 'b', source: { kind: 'recipe', recipe: 'armario', seed: 1, params: {} }, rotation: Math.PI / 2 });
  const depois = aberturaDa(propostaDePorta(ctx(m), 'b')!);
  assert.notEqual(depois.at, livre.at);
});

test('casa sem porta para fora: a sala recebe a porta de entrada, na parede externa mais longa; depois de pôr, ninguém mais sugere', () => {
  const m = mapaCom(sala('s', 0, 0, 4, 3, { name: 'Sala', function: 'sala' }));
  const p = propostaDePorta(ctx(m), 's')!; assert.ok(p); assert.equal(textoDaPorta(ctx(m), 's'), 'Pôr a porta de entrada?');
  const depois = previaDaProposta(m, p); assert.equal(insightDoComodo(depois, 's')!.portas[0]!.outro, null);
  assert.equal(propostaDePorta(ctx(depois), 's'), null);
  const unico = mapaCom(sala('q', 0, 0, 4, 3, { name: 'Quarto', function: 'quarto' })); assert.equal(textoDaPorta(ctx(unico), 'q'), 'Pôr a porta de entrada?', 'o único cômodo também recebe a de entrada');
  const casa = mapaCom(sala('s', 0, 0, 4, 3, { name: 'Sala', function: 'sala' }), sala('q', 4, 0, 8, 3, { name: 'Quarto', function: 'quarto' }));
  casa.openings.p = abertura(casa, 'p', paredeEm(casa, 'x', 6, 4.4)!.id, 0.5);
  assert.equal(propostaDePorta(ctx(casa), 'q'), null, 'o quarto de uma casa com sala não é quem recebe a entrada'); assert.equal(textoDaPorta(ctx(casa), 's'), 'Pôr a porta de entrada?');
});

test('"outra" anda para a próxima posição', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Sala', function: 'sala' }), sala('b', 4, 0, 8, 3, { name: 'Quarto', function: 'quarto' }));
  const a = aberturaDa(propostaDePorta(ctx(m, 0), 'b')!), b = aberturaDa(propostaDePorta(ctx(m, 1), 'b')!); assert.notEqual(a.at, b.at);
});

test('a porta entra na fila de sugestões entre a função e a mobília', () => {
  const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Cozinha', function: 'cozinha' }), sala('b', 4, 0, 8, 3, { name: 'Quarto', function: 'quarto' }));
  assert.equal(proximaSugestao(ctx(m), 'a', new Set())?.tipo, 'porta');
  assert.equal(proximaSugestao(ctx(m), 'a', new Set(['porta:a']))?.tipo, 'mobiliar');
});
