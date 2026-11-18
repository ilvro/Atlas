import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desenharPartes } from '../../src/procedural/raster.ts';
import type { Contexto } from '../../src/procedural/canvas.ts';

test('parte com desfoque vira mancha chapada desfocada, somando luz quando é brilho, sem traço nem sombra', () => {
  const log: string[] = [];
  const falso = { save() {}, restore() {}, beginPath() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}, rect() {},
    set filter(v: string) { log.push(`filter ${v}`); }, set globalCompositeOperation(v: string) { log.push(`op ${v}`); },
    set globalAlpha(_v: number) {}, set fillStyle(v: string) { log.push(`fill ${v}`); }, fill() { log.push('fill()'); }, stroke() { log.push('stroke()'); } } as unknown as Contexto;
  desenharPartes(falso, [{ forma: 'elipse', x: 0, y: 0, w: 1, h: 1, mat: '#ffaa00', z: 1, desfoque: 0.1, brilho: true }], { res: 50 });
  assert.ok(log.includes('filter blur(5.00px)'));
  assert.ok(log.includes('op lighter'));
  assert.ok(log.includes('fill #ffaa00'));
  assert.ok(!log.includes('stroke()'));
});
