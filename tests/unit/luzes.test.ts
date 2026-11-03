import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LUZES_POR_FUNCAO, LUZES_POR_GENERO, propostaDeLuzes } from '../../src/authoring/luzes.ts';
import { previaDaProposta } from '../../src/authoring/proposta.ts';
import { proximaSugestao, type Contexto } from '../../src/authoring/sugestoes.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import type { Luz, MapaAtlas } from '../../src/domain/mapa.ts';
import { GENEROS, TIPOS_DE_COMODO, presetDeLuz } from '../../src/domain/presets.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const ctx = (m: MapaAtlas): Contexto => ({ m, versao: 0, semente: 0, gerarId: contador() });
const luzesDe = (p: NonNullable<ReturnType<typeof propostaDeLuzes>>): Luz[] => p.comandos.map(c => { assert.equal(c.tipo, 'item.adicionar'); return (c as unknown as { item: Luz }).item; });
const escritorio = (genre = 'investigacao') => { const m = mapaCom(sala('e', 0, 0, 4, 3, { name: 'Escritório', function: 'escritorio' })); m.style = { ...m.style, genre }; return m; };

test('as tabelas só citam predefinições de luz e funções que existem', () => {
  for (const g of GENEROS) for (const k of ['principal', 'pequena'] as const) assert.ok(presetDeLuz(LUZES_POR_GENERO[g.id]![k]), `${g.id}/${k}`);
  for (const t of TIPOS_DE_COMODO) assert.ok(LUZES_POR_FUNCAO[t.funcao], t.funcao);
});

test('escritório com escrivaninha recebe a luz sobre ela, com `ownerId`', () => {
  const m = escritorio(); m.props.mesa = novoObjeto([3, 0.5], { id: 'mesa', roomId: 'e', source: { kind: 'recipe', recipe: 'escrivaninha', seed: 1, params: {} } });
  const p = propostaDeLuzes(ctx(m), 'e')!, luzes = luzesDe(p);
  assert.equal(luzes.length, 1); assert.deepEqual(luzes[0]!.position, [3, 0.5]); assert.equal(luzes[0]!.ownerId, 'mesa'); assert.equal(luzes[0]!.preset, 'lamparina'); assert.equal(luzes[0]!.on, true);
  assert.equal(p.rotulo, 'Iluminar a Escritório'); previaDaProposta(m, p);
  const depois = previaDaProposta(m, p); assert.equal(propostaDeLuzes(ctx(depois), 'e'), null, 'cômodo com luz não recebe outra');
});

test('o gênero escolhe a luz: moderno é de rede (some no apagão), fantasia é fogo', () => {
  const moderno = luzesDe(propostaDeLuzes(ctx(escritorio('moderno')), 'e')!)[0]!, fantasia = luzesDe(propostaDeLuzes(ctx(escritorio('fantasia')), 'e')!)[0]!;
  assert.equal(moderno.power, 'grid'); assert.equal(fantasia.power, 'fire'); assert.equal(fantasia.preset, 'tocha');
  const quarto = mapaCom(sala('q', 0, 0, 4, 3, { name: 'Quarto', function: 'quarto' })); quarto.style = { ...quarto.style, genre: 'fantasia' };
  assert.equal(luzesDe(propostaDeLuzes(ctx(quarto), 'q')!)[0]!.preset, 'vela', 'o quarto usa a luz pequena');
});

test('cômodo grande recebe mais de uma luz, a pelo menos 2 m uma da outra; corredor, uma a cada 6 m', () => {
  const grande = mapaCom(sala('s', 0, 0, 8, 6, { name: 'Salão', function: 'taverna' })), luzes = luzesDe(propostaDeLuzes(ctx(grande), 's')!);
  assert.ok(luzes.length >= 2, `${luzes.length} luzes`);
  for (let i = 0; i < luzes.length; i++) for (let j = i + 1; j < luzes.length; j++) assert.ok(Math.hypot(luzes[i]!.position[0] - luzes[j]!.position[0], luzes[i]!.position[1] - luzes[j]!.position[1]) >= 2);
  const corredor = mapaCom(sala('c', 0, 0, 8, 1, { name: 'Corredor', function: 'corredor' }));      // 12 m
  assert.equal(luzesDe(propostaDeLuzes(ctx(corredor), 'c')!).length, 2);
});

test('sem função, sem luz a sugerir e fora da fila quando já há luz; a luz é a última sugestão', () => {
  assert.equal(propostaDeLuzes(ctx(mapaCom(sala('x', 0, 0, 4, 3, { name: 'Cômodo' }))), 'x'), null);
  const m = escritorio(), sem = new Set(['porta:e', 'mobiliar:e']);      // o único cômodo também sugere a porta de entrada
  assert.equal(proximaSugestao(ctx(m), 'e', sem)?.tipo, 'luz');
  m.lights.l = { id: 'l', position: [1, 1], radius: 4, color: '#fff', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null };
  assert.equal(proximaSugestao(ctx(m), 'e', sem), null);
});
