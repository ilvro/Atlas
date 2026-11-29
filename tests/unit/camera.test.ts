import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passoDoZoomSuave, zoomEm, type Camera } from '../../src/render/camera.ts';

const inicio: Camera = { x: 100, y: 50, zoom: 20 };

test('zoom suave converge ao alvo sem saltar e termina cravando o alvo', () => {
  const alvo = zoomEm(inicio, [400, 300], 2);
  let atual = inicio, quadros = 0, fim = false;
  const zooms: number[] = [];
  while (!fim && quadros < 200) {
    const p = passoDoZoomSuave(atual, alvo, 16);
    atual = p.camera; fim = p.fim; quadros++;
    zooms.push(atual.zoom);
  }
  assert.ok(fim, 'chegou ao alvo');
  assert.deepEqual(atual, alvo);
  assert.ok(quadros > 8, `animou em vários quadros (${quadros}), não instantâneo`);
  assert.ok(zooms[0]! > inicio.zoom && zooms[0]! < alvo.zoom, 'o primeiro quadro fica entre o início e o alvo');
  for (let i = 1; i < zooms.length; i++) assert.ok(zooms[i]! >= zooms[i - 1]!, 'monotônico');
});

test('zoom suave: rolagens seguidas acumulam sobre o alvo e o passo não depende do ritmo dos quadros', () => {
  const foco: [number, number] = [400, 300];
  const a1 = zoomEm(inicio, foco, 1.2), a2 = zoomEm(a1, foco, 1.2), a3 = zoomEm(a2, foco, 1.2);
  assert.ok(Math.abs(a3.zoom - inicio.zoom * 1.2 ** 3) < 1e-9, 'três rolagens = 1,2³');
  const um = passoDoZoomSuave(inicio, a3, 32).camera;
  const dois = passoDoZoomSuave(passoDoZoomSuave(inicio, a3, 16).camera, a3, 16).camera;
  assert.ok(Math.abs(um.zoom - dois.zoom) / um.zoom < 1e-9, 'dois quadros de 16 ms = um de 32 ms');
});

test('zoom suave: o zoom out também é logarítmico (mesma sensação do zoom in)', () => {
  const entra = passoDoZoomSuave({ x: 0, y: 0, zoom: 10 }, { x: 0, y: 0, zoom: 20 }, 40).camera.zoom / 10;
  const sai = 20 / passoDoZoomSuave({ x: 0, y: 0, zoom: 20 }, { x: 0, y: 0, zoom: 10 }, 40).camera.zoom;
  assert.ok(Math.abs(entra - sai) < 1e-9);
});
