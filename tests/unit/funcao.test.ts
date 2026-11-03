import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { mapaCom, sala } from './apoio-casa.ts';

/** O palpite para um cômodo de `w × h` células com o nome e as receitas dados. */
function palpite(nome: string, w = 4, h = 3, receitas: string[] = []) {
  const m = mapaCom(sala('c', 0, 0, w, h, { name: nome }));
  receitas.forEach((r, i) => { m.props[`o${i}`] = novoObjeto([1 + i * 0.6, 2], { id: `o${i}`, source: { kind: 'recipe', recipe: r, seed: 1, params: {} }, roomId: 'c' }); });
  return funcaoProvavel(insightDoComodo(m, 'c')!);
}

const POR_NOME: [string, string | null, number?][] = [
  ['Cozinha', 'cozinha'], ['Copa', 'cozinha'], ['Sala de jantar', 'sala'], ['Sala de estar', 'sala'], ['Sala 2', 'sala', 0.6], ['Sala', 'sala', 0.6],
  ['Sala de ritual', null], ['Quarto do Hugo', 'quarto'], ['Suíte', 'quarto'], ['Escritório', 'escritorio'], ['Gabinete', 'escritorio'], ['Biblioteca', 'biblioteca'],
  ['Banheiro', 'banheiro'], ['WC', 'banheiro'], ['Corredor', 'corredor'], ['Hall', 'corredor'], ['Enfermaria', 'hospital'], ['Taverna', 'taverna'], ['Porão', 'porao'], ['Adega', 'porao'],
  ['Ponte de comando', null], ['Cômodo', null],
];
for (const [nome, esperado, confianca] of POR_NOME) {
  test(`função pelo nome: “${nome}” → ${esperado ?? 'nada'}`, () => {
    const p = palpite(nome, 4, 3);
    assert.equal(p?.funcao ?? null, esperado);
    if (esperado) { assert.equal(p!.motivo, 'nome'); assert.ok(p!.confianca >= (confianca ?? 0.9) - 1e-9); }
  });
}

test('função pelos objetos: duas camas num cômodo sem nome útil são um quarto; um objeto só não basta', () => {
  const p = palpite('Cômodo', 4, 3, ['cama.solteiro', 'cama.solteiro']);
  assert.equal(p?.funcao, 'quarto'); assert.equal(p!.motivo, 'objetos'); assert.ok(p!.confianca >= 0.5);
  assert.equal(palpite('Cômodo', 4, 3, ['mesinha']), null, 'um móvel só não diz o bastante');
  assert.equal(palpite('Cômodo', 4, 3, ['balcao', 'balcao', 'mesa.retangular'])?.funcao, 'cozinha');
  assert.equal(palpite('Cômodo', 4, 3, ['estante', 'estante', 'poltrona'])?.funcao, 'biblioteca');
});

test('o nome vence os objetos quando é claro', () => {
  assert.equal(palpite('Biblioteca', 4, 3, ['cama.solteiro', 'cama.solteiro', 'cama.solteiro'])?.funcao, 'biblioteca');
});

test('função pelo tamanho: corredor comprido e fino, banheiro pequeno; cômodo grande vazio não diz nada', () => {
  const corredor = palpite('Cômodo', 8, 1); assert.equal(corredor?.funcao, 'corredor'); assert.equal(corredor!.motivo, 'tamanho');
  assert.equal(palpite('Cômodo', 1, 1)?.funcao, 'banheiro');      // 2,25 m²
  assert.equal(palpite('Cômodo', 4, 3), null);
});

test('só devolve funções que existem em TIPOS_DE_COMODO', () => {
  const validas = new Set(TIPOS_DE_COMODO.map(t => t.funcao));
  for (const [nome] of POR_NOME) { const p = palpite(nome); if (p) assert.ok(validas.has(p.funcao), nome); }
  for (const r of ['caixa', 'banco', 'vaso.planta']) { const p = palpite('Cômodo', 4, 3, [r, r, r]); if (p) assert.ok(validas.has(p.funcao), r); }
});
