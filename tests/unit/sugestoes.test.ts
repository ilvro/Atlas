import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previaDaProposta } from '../../src/authoring/proposta.ts';
import { proximaSugestao, textoDaSugestao, type Contexto } from '../../src/authoring/sugestoes.ts';
import { TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const ctx = (m: ReturnType<typeof mapaCom>): Contexto => ({ m, versao: 0, semente: 0 });
const cozinha = TIPOS_DE_COMODO.find(t => t.id === 'cozinha')!, sala_ = TIPOS_DE_COMODO.find(t => t.id === 'sala')!;
const salaTipo = (nome: string, funcao: string | null) => sala('c', 0, 0, 4, 3, { name: nome, function: funcao, floor: { material: sala_.piso, seed: 7 }, wallpaper: { material: sala_.papel, seed: 7 } });

test('renomear "Sala 2" para "Cozinha" sugere a função e troca piso e papel pelos da cozinha', () => {
  const m = mapaCom(salaTipo('Cozinha', 'sala')), c = ctx(m);
  const p = proximaSugestao(c, 'c', new Set())!;
  assert.equal(p.tipo, 'funcao'); assert.equal(p.rotulo, 'Usar como Cozinha'); assert.equal(textoDaSugestao(c, p), 'Usar como Cozinha?');
  const depois = previaDaProposta(m, p).rooms.c!;
  assert.equal(depois.function, 'cozinha'); assert.equal(depois.floor.material, cozinha.piso); assert.equal(depois.wallpaper!.material, cozinha.papel);
  assert.equal(depois.floor.seed, 7, 'as sementes ficam');
  assert.equal(m.rooms.c!.function, 'sala', 'a prévia não toca no original');
});

test('com o piso escolhido à mão, troca só a função', () => {
  const m = mapaCom(salaTipo('Cozinha', 'sala')); m.rooms.c = { ...m.rooms.c!, floor: { material: 'laje.pedra', seed: 7 } };
  const depois = previaDaProposta(m, proximaSugestao(ctx(m), 'c', new Set())!).rooms.c!;
  assert.equal(depois.function, 'cozinha'); assert.equal(depois.floor.material, 'laje.pedra'); assert.equal(depois.wallpaper!.material, sala_.papel);
});

test('cômodo sem função recebe a função do nome, mesmo sem par de piso e papel conhecido', () => {
  const m = mapaCom(sala('c', 0, 0, 4, 3, { name: 'Quarto do Hugo' }));
  const p = proximaSugestao(ctx(m), 'c', new Set())!, depois = previaDaProposta(m, p).rooms.c!;
  assert.equal(depois.function, 'quarto'); assert.equal(depois.floor.material, 'piso.madeira-escura');
});

test('dispensada não volta; função já certa, nome vago e cômodo inexistente não sugerem nada', () => {
  const m = mapaCom(salaTipo('Cozinha', 'sala'));
  assert.equal(proximaSugestao(ctx(m), 'c', new Set(['funcao:c']))?.tipo, 'porta', 'dispensada a função, a próxima da fila aparece');
  assert.equal(proximaSugestao(ctx(m), 'c', new Set(['funcao:outro']))?.tipo, 'funcao');
  const certa = mapaCom(salaTipo('Cozinha', 'cozinha'));
  assert.equal(proximaSugestao(ctx(certa), 'c', new Set())?.tipo, 'porta', 'função já certa: a próxima da fila (a porta de entrada, no único cômodo)');
  assert.equal(proximaSugestao(ctx(certa), 'c', new Set(['porta:c']))?.tipo, 'mobiliar');
  assert.equal(proximaSugestao(ctx(certa), 'c', new Set(['porta:c', 'mobiliar:c']))?.tipo, 'luz');
  assert.equal(proximaSugestao(ctx(certa), 'c', new Set(['porta:c', 'mobiliar:c', 'luz:c'])), null);
  assert.equal(proximaSugestao(ctx(mapaCom(salaTipo('Sala 2', null))), 'c', new Set())?.rotulo, 'Usar como Sala', '"Sala 2" tem função "sala" pelo nome (0,6)');
  assert.equal(proximaSugestao(ctx(mapaCom(salaTipo('Ponte de comando', null))), 'c', new Set(['porta:c'])), null, 'sem função: nada além da porta');
  assert.equal(proximaSugestao(ctx(m), 'x', new Set()), null);
});

test('a proposta guarda a versão e a semente do contexto', () => {
  const m = mapaCom(salaTipo('Cozinha', 'sala')), p = proximaSugestao({ m, versao: 5, semente: 3 }, 'c', new Set())!;
  assert.equal(p.versaoEsperada, 5); assert.equal(p.semente, 3); assert.equal(p.roomId, 'c');
});
