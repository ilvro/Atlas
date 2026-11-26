import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novaLuz } from '../../src/domain/fabrica.ts';
import { calcularLuzNoPonto, poligonoDaLuz, sincronizarOclusao } from '../../src/render/mapa-de-luz.ts';
import { mapaCom, sala } from './apoio-casa.ts';

test('calcularLuzNoPonto: ponto no escuro longe de luzes retorna apenas o ambiente baixo', () => {
  const tocha = novaLuz([2, 2], { id: 'tocha', radius: 5, color: '#ff9e44', intensity: 1.4 });
  const rgb = calcularLuzNoPonto([15, 15], {
    ambiente: [0.04, 0.05, 0.08],
    ambienteInterior: [0.01, 0.015, 0.025],
    emInteriorCoberto: false,
    luzes: [{ luz: tocha, intensidade: 1.4, poligono: [0, 0, 6, 0, 6, 6, 0, 6] }],
  });
  assert.ok(rgb[0] < 0.12 && rgb[1] < 0.14 && rgb[2] < 0.2, `esperado escuro, recebeu ${rgb}`);
  assert.ok(rgb[2] > rgb[0], 'mantém o tom frio do ambiente noturno');
});

test('calcularLuzNoPonto: ponto iluminado por tocha dentro do polígono fica claro e tingido pela cor quente', () => {
  const tocha = novaLuz([4, 4], { id: 'tocha', radius: 6, color: '#ff9438', intensity: 1.5 });
  const poli = [0, 0, 8, 0, 8, 8, 0, 8];
  const escuro = calcularLuzNoPonto([4.8, 4], {
    ambiente: [0.03, 0.04, 0.06],
    ambienteInterior: [0.01, 0.01, 0.02],
    emInteriorCoberto: false,
    luzes: [],
  });
  const iluminado = calcularLuzNoPonto([4.8, 4], {
    ambiente: [0.03, 0.04, 0.06],
    ambienteInterior: [0.01, 0.01, 0.02],
    emInteriorCoberto: false,
    luzes: [{ luz: tocha, intensidade: 1.5, poligono: poli }],
  });
  assert.ok(iluminado[0] > 0.75, `canal R claro perto da tocha: ${iluminado[0]}`);
  assert.ok(iluminado[0] > iluminado[1] && iluminado[1] > iluminado[2], `cor quente da tocha: ${iluminado}`);
  assert.ok(iluminado[0] > escuro[0] * 5, 'muito mais claro que o ambiente puro');
});

test('calcularLuzNoPonto: ponto próximo à tocha mas fora do polígono (atrás de parede) permanece no escuro', () => {
  const m = mapaCom(
    sala('a', 0, 0, 4, 4, { name: 'Sala A', function: 'sala' }),
    sala('b', 4, 0, 4, 4, { name: 'Sala B', function: 'quarto' }),
  );
  // Sala A vai de x=0 a x=6 (grade 1.5 m); parede divisória em x=6.
  const tocha = novaLuz([4.5, 3], { id: 'tocha', radius: 7, color: '#ff9438', intensity: 1.6 });
  m.lights.tocha = tocha;
  const { ctx } = sincronizarOclusao(null, m, null);
  const poli = poligonoDaLuz(tocha, ctx);

  const antesDaParede = calcularLuzNoPonto([5.2, 3], {
    ambiente: [0.03, 0.03, 0.05],
    ambienteInterior: [0.01, 0.01, 0.02],
    emInteriorCoberto: true,
    luzes: [{ luz: tocha, intensidade: 1.6, poligono: poli }],
  });
  const atrasDaParede = calcularLuzNoPonto([7.2, 3], {
    ambiente: [0.03, 0.03, 0.05],
    ambienteInterior: [0.01, 0.01, 0.02],
    emInteriorCoberto: true,
    luzes: [{ luz: tocha, intensidade: 1.6, poligono: poli }],
  });
  const soAmbiente = calcularLuzNoPonto([7.2, 3], {
    ambiente: [0.03, 0.03, 0.05],
    ambienteInterior: [0.01, 0.01, 0.02],
    emInteriorCoberto: true,
    luzes: [],
  });

  assert.ok(antesDaParede[0] > 0.7, `antes da parede iluminado: ${antesDaParede}`);
  assert.deepEqual(atrasDaParede, soAmbiente, 'atrás da parede só recebe o ambiente');
});

test('calcularLuzNoPonto: peça que carrega lanterna em cone (ponto === luz.position) recebe a iluminação da própria lanterna', () => {
  const m = mapaCom(sala('s', 0, 0, 6, 6, { name: 'Salão', function: 'sala' }));
  const lanterna = novaLuz([3, 3], {
    id: 'lanterna',
    radius: 9,
    color: '#eef6ff',
    intensity: 1.4,
    cone: { angle: Math.PI / 3, direction: 0 },
  });
  m.lights.lanterna = lanterna;
  const { ctx } = sincronizarOclusao(null, m, null);
  const poli = poligonoDaLuz(lanterna, ctx);

  // O vértice do cone está exatamente em [3, 3]; o portador deve ser iluminado pela própria lanterna
  const noPortador = calcularLuzNoPonto([3, 3], {
    ambiente: [0.02, 0.02, 0.03],
    ambienteInterior: [0.01, 0.01, 0.015],
    emInteriorCoberto: true,
    luzes: [{ luz: lanterna, intensidade: 1.4, poligono: poli }],
  });
  assert.ok(noPortador[0] > 0.8 && noPortador[1] > 0.82 && noPortador[2] > 0.83, `portador iluminado: ${noPortador}`);
});

test('calcularLuzNoPonto: cômodo coberto usa ambienteInterior em vez de ambiente externo', () => {
  const opBase = {
    ambiente: [0.6, 0.65, 0.7] as const,
    ambienteInterior: [0.08, 0.09, 0.11] as const,
    luzes: [],
  };
  const fora = calcularLuzNoPonto([2, 2], { ...opBase, emInteriorCoberto: false });
  const dentro = calcularLuzNoPonto([2, 2], { ...opBase, emInteriorCoberto: true });
  assert.ok(fora[0] > 0.5 && fora[1] > 0.5, `fora usa ambiente claro: ${fora}`);
  assert.ok(dentro[0] < 0.2 && dentro[1] < 0.22, `dentro usa ambienteInterior escuro: ${dentro}`);
});
