import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAMERA_REMOTA_INICIAL, decidirCamera } from '../../src/app/camera-remota.ts';

const A = { x0: 0, y0: 0, x1: 10, y1: 10 }, B = { x0: 5, y0: 5, x1: 20, y1: 20 }, C = { x0: 1, y0: 1, x1: 3, y1: 3 };

test('seguindo, camera comum é aplicada', () => {
  const r = decidirCamera(CAMERA_REMOTA_INICIAL, { tipo: 'camera', caixa: A });
  assert.deepEqual(r.caixa, A); assert.equal(r.estado.modo, 'seguindo');
});
test('mexeu entra em livre', () => {
  assert.equal(decidirCamera(CAMERA_REMOTA_INICIAL, { tipo: 'mexeu' }).estado.modo, 'livre');
});
test('livre ignora camera comum, mas guarda a última', () => {
  const livre = decidirCamera(decidirCamera(CAMERA_REMOTA_INICIAL, { tipo: 'camera', caixa: A }).estado, { tipo: 'mexeu' }).estado;
  const r = decidirCamera(livre, { tipo: 'camera', caixa: B });
  assert.equal(r.caixa, undefined); assert.equal(r.estado.modo, 'livre'); assert.deepEqual(r.estado.ultima, B);
});
test('livre, camera imediata é aplicada e volta a seguir', () => {
  const livre = decidirCamera(CAMERA_REMOTA_INICIAL, { tipo: 'mexeu' }).estado;
  const r = decidirCamera(livre, { tipo: 'camera', caixa: C, imediata: true });
  assert.deepEqual(r.caixa, C); assert.equal(r.estado.modo, 'seguindo');
});
test('Seguir o mestre volta e aplica a última', () => {
  let e = decidirCamera(CAMERA_REMOTA_INICIAL, { tipo: 'camera', caixa: A }).estado;
  e = decidirCamera(e, { tipo: 'mexeu' }).estado;
  e = decidirCamera(e, { tipo: 'camera', caixa: B }).estado;
  const r = decidirCamera(e, { tipo: 'seguir-mestre' });
  assert.deepEqual(r.caixa, B); assert.equal(r.estado.modo, 'seguindo');
});
test('Seguir o mestre sem nenhuma camera recebida não aplica nada', () => {
  const r = decidirCamera(decidirCamera(CAMERA_REMOTA_INICIAL, { tipo: 'mexeu' }).estado, { tipo: 'seguir-mestre' });
  assert.equal(r.caixa, undefined); assert.equal(r.estado.modo, 'seguindo');
});
test('livre, camera com forcar é aplicada e volta a seguir', () => {
  const livre = decidirCamera(decidirCamera(CAMERA_REMOTA_INICIAL, { tipo: 'camera', caixa: A }).estado, { tipo: 'mexeu' }).estado;
  const r = decidirCamera(livre, { tipo: 'camera', caixa: C, forcar: true });
  assert.deepEqual(r.caixa, C); assert.equal(r.estado.modo, 'seguindo');
});
