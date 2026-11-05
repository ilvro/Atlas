import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clareira } from '../../scripts/exemplos/clareira.ts';
import { Kit, montarExemplo } from '../../scripts/exemplos/kit.ts';
import { decodificar } from '../../src/domain/celulas.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

const novo = (semente = 3) => new Kit({ id: 'teste', nome: 'Teste', largura: 30, altura: 20, semente });
const celulasDe = (k: Kit, material: string) => { const m = k.construir(), c = Object.values(m.terrain.layers).find(l => l.material === material); return c ? decodificar(c.cells) : []; };

test('o mesmo script gera o mesmo JSON duas vezes, e a Clareira valida', () => {
  const a = JSON.stringify(montarExemplo(clareira)), b = JSON.stringify(montarExemplo(clareira));
  assert.equal(a, b);
  const m = montarExemplo(clareira);
  validarMapa(m);
  assert.equal(Object.keys(m.props).length, 6); assert.equal(Object.keys(m.lights).length, 1);
  assert.equal(m.terrain.base, 'grama'); assert.ok(Object.values(m.terrain.layers).some(l => l.material === 'terra'));
});

test('semente diferente muda ids e espalhamento; ids são únicos', () => {
  const monta = (s: number) => { const k = novo(s); k.espalhar('mata', { retangulo: [2, 2, 20, 15] }); return k.construir(); };
  const a = monta(1), b = monta(2);
  assert.notDeepEqual(Object.keys(a.props), Object.keys(b.props));
  assert.ok(Object.keys(a.props).length > 5);
  assert.equal(new Set(Object.keys(a.props)).size, Object.keys(a.props).length);
  validarMapa(a);
});

test('pintar com disco cobre as células certas (res 0,25 m)', () => {
  const k = novo(); k.pintar('grama', { disco: [5, 5], raio: 2 });
  const cel = celulasDe(k, 'grama'), res = 0.25;
  assert.ok(cel.length > 0);
  for (const [i, j] of cel) assert.ok(Math.hypot((i + 0.5) * res - 5, (j + 0.5) * res - 5) <= 2 + 1e-9);
  // a área bate com π r² dentro de 5%
  assert.ok(Math.abs(cel.length * res * res - Math.PI * 4) < 0.05 * Math.PI * 4, `área ${cel.length * res * res}`);
});

test('pintar por cima tira das outras camadas; apagar volta ao base; camada vazia some', () => {
  const k = novo(); k.pintar('grama', { retangulo: [0, 0, 10, 10] }); k.pintar('terra', { disco: [5, 5], raio: 2 });
  const grama = celulasDe(k, 'grama'), terra = celulasDe(k, 'terra'), chaves = new Set(terra.map(([i, j]) => `${i},${j}`));
  for (const [i, j] of grama) assert.ok(!chaves.has(`${i},${j}`), 'sem sobreposição');
  assert.equal(grama.length + terra.length, 40 * 40);
  k.apagar({ retangulo: [0, 0, 10, 10] });
  assert.deepEqual(Object.keys(k.construir().terrain.layers), []);
});

test('faixa, polígono e células; irregular só mexe na borda e é determinístico', () => {
  const k = novo(); k.pintar('terra', { faixa: [[0, 10], [30, 10]], largura: 2 });
  const lisa = celulasDe(k, 'terra'); assert.ok(Math.abs(lisa.length * 0.0625 - 60) < 3, `faixa ${lisa.length * 0.0625} m²`);
  const k2 = novo(); k2.pintar('terra', { poligono: [[2, 2], [8, 2], [8, 8], [2, 8]] }); assert.equal(celulasDe(k2, 'terra').length, 24 * 24);
  const k3 = novo(); k3.pintar('terra', { celulas: [[1, 1], [2, 1], [1, 2]] }); assert.deepEqual(celulasDe(k3, 'terra').map(c => [...c]), [[1, 1], [2, 1], [1, 2]]);
  const torta = () => { const kk = novo(); kk.pintar('terra', { faixa: [[0, 10], [30, 10]], largura: 2, irregular: 0.6 }); return celulasDe(kk, 'terra'); };
  assert.deepEqual(torta(), torta());
  assert.notEqual(torta().length, lisa.length);
  assert.ok(Math.abs(torta().length - lisa.length) < lisa.length * 0.4);
});

test('cômodos, portas, luzes, clima e acabamento validam', () => {
  const k = novo(); k.base('grama');
  const id = k.comodo([2, 2, 6, 5], 'taverna', { nome: 'Taverna do Cais', telhado: 'telha.barro' });
  k.porta([9, 5]);
  k.luz('lanterna', [4, 4], { direcao: 1 }); k.luz('tocha', [10, 10]);
  k.clima('noite', { time: '22:00', tempo: { fog: 0.3 } }); k.acabamento('frio', { glow: 0.4 });
  const m = k.construir(); validarMapa(m);
  assert.equal(m.rooms[id]!.name, 'Taverna do Cais'); assert.equal(m.rooms[id]!.roof.material, 'telha.barro');
  assert.equal(Object.keys(m.openings).length, 1);
  assert.equal(m.climate.weather.fog, 0.3); assert.equal(m.finish.glow, 0.4); assert.equal(m.finish.preset, 'personalizado');
  assert.ok(Object.values(m.lights).some(l => l.cone));
});

test('erros claros para nomes desconhecidos', () => {
  const k = novo();
  assert.throws(() => k.comodo([0, 0, 2, 2], 'nada'), /tipo de cômodo/); assert.throws(() => k.luz('nada', [1, 1]), /luz/);
  assert.throws(() => k.objeto('nada', [1, 1]), /item desconhecido/); assert.throws(() => k.clima('nada'), /clima/);
  assert.throws(() => k.espalhar('nada', { disco: [1, 1], raio: 1 }), /conjunto/); assert.throws(() => k.porta([5, 5]), /parede/);
});
