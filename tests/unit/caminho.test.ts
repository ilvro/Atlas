import test from 'node:test';
import assert from 'node:assert/strict';
import { caminho } from '../../src/authoring/caminho.ts';
import { aplicarEmCopia, ErroDeConstrucao } from '../../src/authoring/construcao.ts';
import { decodificar } from '../../src/domain/celulas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';

test('caminho: curva em L arredonda canto sem pintar quina viva externa', () => {
  const m = criarMapa({ largura: 25, altura: 25 });
  const c = caminho(m, {
    pontos: [[5, 5], [15, 5], [15, 15]],
    largura: 2,
    material: 'terra',
    irregular: 0,
  });
  const res = aplicarEmCopia(m, c.comandos);
  const camada = Object.values(res.terrain.layers).find(l => l.material === 'terra');
  assert.ok(camada, 'deve criar camada de terra');
  const grid = m.terrain.resolution;
  const col = (x: number) => Math.floor(x / grid);
  const conjunto = new Set(decodificar(camada.cells).map(([i, j]) => `${i},${j}`));
  // Meio do trecho inicial [5, 5] e trecho vertical [15, 12] pintados
  assert.ok(conjunto.has(`${col(5)},${col(5)}`), 'célula do início da curva presente');
  assert.ok(conjunto.has(`${col(15)},${col(12)}`), 'célula do trecho vertical presente');
  // Quina viva externa quadrada (15 + 1 - grid/2, 5 - 1 + grid/2) fica fora do canto arredondado
  const quinaX = col(16 - grid / 2), quinaY = col(4 + grid / 2);
  assert.equal(conjunto.has(`${quinaX},${quinaY}`), false, 'canto externo da curva deve ser arredondado');
});

test('caminho: largura em faixa [min, max] varia ao longo do percurso e borda envolve sem sobrepor miolo', () => {
  const m = criarMapa({ largura: 40, altura: 20 });
  const c = caminho(m, {
    pontos: [[4, 10], [20, 10], [36, 10]],
    largura: [1.5, 4.5],
    material: 'pedregulho',
    borda: { material: 'lama', largura: 0.75 },
    irregular: 0.25,
  }, 42);
  const res = aplicarEmCopia(m, c.comandos);
  const miolo = Object.values(res.terrain.layers).find(l => l.material === 'pedregulho');
  const borda = Object.values(res.terrain.layers).find(l => l.material === 'lama');
  assert.ok(miolo && borda, 'miolo e borda devem existir');

  const celMiolo = decodificar(miolo.cells);
  const celBorda = decodificar(borda.cells);
  assert.ok(celBorda.length > 0, 'borda deve ter células visíveis em torno do miolo');

  const setMiolo = new Set(celMiolo.map(([i, j]) => `${i},${j}`));
  for (const [i, j] of celBorda) {
    assert.equal(setMiolo.has(`${i},${j}`), false, `célula [${i},${j}] não deve estar na borda e no miolo ao mesmo tempo`);
  }

  // Mede altura (espessura em células Y) por coluna no miolo para confirmar variação orgânica de largura
  const porColuna = new Map<number, number>();
  for (const [i] of celMiolo) porColuna.set(i, (porColuna.get(i) ?? 0) + 1);
  const larguras = [...porColuna.values()].slice(4, -4);
  const minH = Math.min(...larguras), maxH = Math.max(...larguras);
  assert.ok(maxH > minH, `largura do miolo deve variar ao longo do caminho (min=${minH}, max=${maxH})`);
});

test('caminho: sulcos em caminho largo cria presença sulcos com intensidade 0.4 e ignora caminho estreito', () => {
  const m = criarMapa({ largura: 30, altura: 20 });
  const largo = aplicarEmCopia(m, caminho(m, {
    pontos: [[4, 10], [26, 10]],
    largura: 3,
    material: 'paralelepipedo',
    sulcos: true,
    irregular: 0,
  }, 7).comandos);
  const pres = Object.values(largo.presence).find(p => p.brush === 'sulcos');
  assert.ok(pres, 'deve criar presença de sulcos');
  assert.equal(pres.intensity, 0.4);
  assert.ok(decodificar(pres.cells).length > 10, 'sulcos devem cobrir o trajeto paralelo');

  const estreito = aplicarEmCopia(m, caminho(m, {
    pontos: [[4, 10], [26, 10]],
    largura: 1.5,
    material: 'terra',
    sulcos: true,
    irregular: 0,
  }, 7).comandos);
  assert.equal(Object.keys(estreito.presence).length, 0, 'caminho <= 2m não recebe sulcos de carroça');
});

test('caminho: mesma semente produz comandos idênticos e valida erros de entrada', () => {
  const m = criarMapa({ largura: 20, altura: 20 });
  const pedido = { pontos: [[2, 4], [10, 12], [18, 6]] as [number, number][], largura: [1.5, 3] as [number, number], material: 'terra' };
  assert.deepEqual(caminho(m, pedido, 99), caminho(m, pedido, 99));

  assert.throws(() => caminho(m, { pontos: [[2, 2]], largura: 2, material: 'terra' }), ErroDeConstrucao);
  assert.throws(() => caminho(m, { pontos: [[2, 2], [8, 8]], largura: 2, material: 'inexistente' }), ErroDeConstrucao);
  assert.throws(() => caminho(m, { pontos: [[2, 2], [8, 8]], largura: [4, 2], material: 'terra' }), ErroDeConstrucao);
});
