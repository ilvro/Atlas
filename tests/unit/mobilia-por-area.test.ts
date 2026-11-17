import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propostaDeMobilia } from '../../src/authoring/mobiliar.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const estantes = (w: number, h: number): number => {
  let total = 0;
  for (let s = 0; s < 3; s++) {
    const m = mapaCom(sala('b', 0, 0, w, h, { name: 'Biblioteca', function: 'biblioteca' })); m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 0, 1.2)!.id, 0.5);
    let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente: s, gerarId: q => `${q}${++n}` }, 'b');
    total += p ? p.comandos.filter(c => c.tipo === 'item.adicionar' && (c.item as { source: { recipe?: string } }).source.recipe === 'estante.piso').length : 0;
  }
  return total;
};

test('cômodo grande ganha mais peças: a biblioteca de 100 m² tem bem mais estantes que a de 13 m²', () => {
  assert.ok(estantes(7, 7) > estantes(3, 2) + 3, `${estantes(7, 7)} × ${estantes(3, 2)}`);
});
