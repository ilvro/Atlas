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

test('a sala monta o estar de frente para a lareira: sofá virado para ela, mesa de centro e poltronas ladeando a mesa', () => {
  let ok = 0;
  for (let s = 0; s < 6; s++) {
    const m = mapaCom(sala('s', 0, 0, 6, 5, { name: 'Sala', function: 'sala' })); m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 0, 1.2)!.id, 0.5);
    let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente: s, gerarId: q => `${q}${++n}` }, 's'); if (!p) continue;
    const itens = p.comandos.flatMap(c => (c.tipo === 'item.adicionar' ? [c.item as unknown as { source: { kind: string; recipe?: string; assetId?: string }; position: [number, number]; rotation: number }] : []));
    const nome = (o: (typeof itens)[number]) => o.source.recipe ?? o.source.assetId ?? '';
    const lareira = itens.find(o => nome(o).startsWith('lareira')), sofa = itens.find(o => /sofa|chesterfield/.test(nome(o))), mesa = itens.find(o => nome(o) === 'mesa.centro');
    if (!lareira || !sofa || !mesa) continue;
    // O sofá olha para a lareira: a frente dele (+y local) aponta para ela.
    const fx = -Math.sin(sofa.rotation), fy = Math.cos(sofa.rotation), dx = lareira.position[0] - sofa.position[0], dy = lareira.position[1] - sofa.position[1];
    const poltronas = itens.filter(o => /poltrona/.test(nome(o)) && Math.hypot(o.position[0] - mesa.position[0], o.position[1] - mesa.position[1]) < 1.8);
    if ((fx * dx + fy * dy) / Math.hypot(dx, dy) > 0.9 && poltronas.length >= 1) ok++;
  }
  assert.ok(ok >= 3, `${ok} de 6 salas com o estar de frente para a lareira`);
});
