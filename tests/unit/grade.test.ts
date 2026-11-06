import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  segmentosTracejados,
  intersecoesDaGrade,
  celulasHexagonaisVisiveis,
  verticesHexagonaisVisiveis,
  ajustarGradePorAlinhamento,
} from '../../src/render/grade.ts';
import type { Camera, Tela } from '../../src/render/camera.ts';

test('grade: segmentosTracejados divide intervalos respeitando comprimento e espaçamento', () => {
  const segs = segmentosTracejados(0, 10, 2, 1);
  assert.deepEqual(segs, [
    [0, 2],
    [3, 5],
    [6, 8],
    [9, 10],
  ]);

  // Limites invertidos ou vazios
  assert.deepEqual(segmentosTracejados(5, 5, 2, 1), []);
  assert.deepEqual(segmentosTracejados(5, 2, 2, 1), []);

  // Parâmetros inválidos
  assert.deepEqual(segmentosTracejados(0, 10, 0, 1), []);
  assert.deepEqual(segmentosTracejados(0, 10, 2, 0), []);
  assert.deepEqual(segmentosTracejados(0, 10, -1, 1), []);
});

test('grade: intersecoesDaGrade calcula produto cartesiano das linhas visíveis', () => {
  const linhas = {
    verticais: [0, 1.5, 3],
    horizontais: [2, 4],
    passo: 1,
  };
  const pts = intersecoesDaGrade(linhas);
  assert.equal(pts.length, 6);
  assert.deepEqual(pts, [
    [0, 2],
    [0, 4],
    [1.5, 2],
    [1.5, 4],
    [3, 2],
    [3, 4],
  ]);
});

test('grade: celulasHexagonaisVisiveis gera células com 6 vértices a distância R do centro', () => {
  const camera: Camera = { x: 5, y: 5, zoom: 40 };
  const tela: Tela = { largura: 400, altura: 400 };
  const grade = { size: 2, offset: [0, 0] as [number, number] };
  const limites = { width: 10, height: 10 };

  const hexes = celulasHexagonaisVisiveis(camera, tela, grade, limites);
  assert.ok(hexes.length > 0, 'deve gerar hexágonos dentro dos limites visíveis');

  for (const h of hexes) {
    assert.equal(h.vertices.length, 6, 'cada hexágono deve possuir 6 vértices');
    const [cx, cy] = h.centro;
    for (const [vx, vy] of h.vertices) {
      const dist = Math.hypot(vx - cx, vy - cy);
      // R = size / 2 = 1.0
      assert.ok(Math.abs(dist - 1.0) < 1e-4, `o vértice deve estar a raio R=1 do centro (dist: ${dist})`);
    }
  }

  const vertices = verticesHexagonaisVisiveis(camera, tela, grade, limites);
  assert.equal(vertices.length, hexes.length);
  assert.deepEqual(vertices[0], hexes[0]!.vertices);
});

test('grade: ajustarGradePorAlinhamento calibra offset e size', () => {
  const grade0 = { size: 1.5, offset: [0.2, 0.4] as [number, number] };

  // 1. Modo offset: arrastar com delta positivo
  const resOffset = ajustarGradePorAlinhamento(grade0, [10, 10], [10.3, 10.5], 'offset');
  assert.equal(resOffset.size, 1.5);
  // dx = 0.3 -> ox = 0.2 + 0.3 = 0.5
  // dy = 0.5 -> oy = 0.4 + 0.5 = 0.9
  assert.equal(resOffset.offset[0], 0.5);
  assert.equal(resOffset.offset[1], 0.9);

  // Modo offset: arrastar com delta negativo com wrap-around modulo size
  const resOffsetNeg = ajustarGradePorAlinhamento(grade0, [10, 10], [9.5, 9.8], 'offset');
  // dx = -0.5 -> ox = (0.2 - 0.5) % 1.5 = -0.3 -> + 1.5 = 1.2
  // dy = -0.2 -> oy = (0.4 - 0.2) % 1.5 = 0.2
  assert.equal(resOffsetNeg.offset[0], 1.2);
  assert.equal(resOffsetNeg.offset[1], 0.2);

  // 2. Modo escala: arrastar canto de 3 células
  // origem = [0, 0], novoPonto = [6, 6], celulas = 3 -> dist = 6 -> novoTamanho = 6 / 3 = 2.0
  const resEscala = ajustarGradePorAlinhamento(grade0, [0, 0], [6, 6], 'escala', 3);
  assert.equal(resEscala.size, 2);
  assert.deepEqual(resEscala.offset, grade0.offset);

  // Modo escala: clamps no mínimo de 0.25 e máximo de 10
  const resMin = ajustarGradePorAlinhamento(grade0, [0, 0], [0.1, 0.1], 'escala', 3);
  assert.equal(resMin.size, 0.25);

  const resMax = ajustarGradePorAlinhamento(grade0, [0, 0], [50, 50], 'escala', 3);
  assert.equal(resMax.size, 10);
});
