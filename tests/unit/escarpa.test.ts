import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caixaDaEscarpa, larguraDaFace, ladoBaixo, sombrearEscarpa, type EntradaDeEscarpa } from '../../src/procedural/escarpa.ts';
import { sombrearMacico } from '../../src/procedural/macico.ts';
import { materialDe } from '../../src/procedural/materiais.ts';
import { oclusores } from '../../src/domain/visibilidade.ts';
import { chaveDaEscarpa, ehEscarpaAvulsa, entradaDaEscarpa } from '../../src/render/entradas.ts';
import type { Parede } from '../../src/domain/mapa.ts';

const RES = 16, base = (drop: 'a' | 'b', material = 'rocha.cinza'): EntradaDeEscarpa => ({ path: [[0, 0], [6, 0]], drop, altura: 3, material, seed: 5 });
/** Pixels opacos acima e abaixo da linha do caminho (y = 0). */
function metades(e: EntradaDeEscarpa, pixel: boolean) {
  const r = sombrearEscarpa(e, RES, pixel); let acima = 0, abaixo = 0;
  for (let y = 0; y < r.altura; y++) for (let x = 0; x < r.largura; x++) if (r.rgba[(y * r.largura + x) * 4 + 3]! > 128) { const m = r.origem[1] + (y + 0.5) / RES; if (m < -0.2) acima++; else if (m > 0.2) abaixo++; }
  return { r, acima, abaixo };
}

test('escarpa: a face fica do lado baixo (drop a = abaixo, b = acima num segmento horizontal)', () => {
  const a = caixaDaEscarpa(base('a')), b = caixaDaEscarpa(base('b'));
  assert.ok(a.y1 > 2 && a.y0 > -0.8, `a: ${JSON.stringify(a)}`);
  assert.ok(b.y0 < -2 && b.y1 < 0.8, `b: ${JSON.stringify(b)}`);
  assert.ok(ladoBaixo([0, 0], [6, 0], 'a')[1] > 0.99 && ladoBaixo([0, 0], [6, 0], 'b')[1] < -0.99);
  for (const pixel of [false, true]) {
    const ra = metades(base('a'), pixel), rb = metades(base('b'), pixel);
    assert.ok(ra.abaixo > 10 * ra.acima, `a: ${ra.abaixo} × ${ra.acima}`);
    assert.ok(rb.acima > 10 * rb.abaixo, `b: ${rb.acima} × ${rb.abaixo}`);
  }
});

test('escarpa: a face tem 0,35 × altura (mínimo 0,4 m) e a sombra de contato fica só fora dela', () => {
  assert.ok(Math.abs(larguraDaFace(3) - 1.05) < 1e-9); assert.equal(larguraDaFace(0.5), 0.4);
  for (const pixel of [false, true]) {
    const { r } = metades(base('a'), pixel); let sombras = 0, sobre = 0;
    for (let i = 0; i < r.largura * r.altura; i++) { const rocha = r.rgba[i * 4 + 3]! > 250, s = r.sombra[i * 4 + 3]! > 0; if (s) sombras++; if (s && rocha) sobre++; }
    assert.ok(sombras > 50, `sombras ${sombras}`); assert.equal(sobre, 0);
  }
});

test('escarpa: a chave muda com o lado, a altura, a rocha e o desenho; mover a parede não muda', () => {
  const p = (extra: Partial<Parede> = {}): Parede => ({ id: 'w1', path: [[2, 3], [8, 3]], height: 3, thickness: 0.4, material: 'rocha.cinza', kind: 'cliff', blocks: { move: true, sight: false, light: false }, drop: 'b', source: null, ...extra });
  const k = (w: Parede, estilo: 'illustrated' | 'pixel' = 'illustrated') => chaveDaEscarpa(entradaDaEscarpa(w), 48, estilo);
  const ref = k(p());
  assert.notEqual(ref, k(p({ drop: 'a' }))); assert.notEqual(ref, k(p({ height: 5 }))); assert.notEqual(ref, k(p({ material: 'rocha.nevada' }))); assert.notEqual(ref, k(p(), 'pixel'));
  assert.equal(ref, k(p({ path: [[12, 9], [18, 9]] })));
  assert.equal(entradaDaEscarpa(p({ drop: null })).drop, 'b'); assert.equal(entradaDaEscarpa(p({ material: 'parede.topo' })).material, 'rocha.cinza');
  assert.ok(ehEscarpaAvulsa(p())); assert.ok(!ehEscarpaAvulsa(p({ source: { terrainLayerId: 't' } }))); assert.ok(!ehEscarpaAvulsa(p({ kind: 'wall' })));
});

test('escarpa: rocha nevada põe neve na aresta; no Pixel poucas cores e alfa binário', () => {
  const claro = (m: string) => { const r = sombrearEscarpa(base('b', m), RES, false); let s = 0, n = 0; for (let i = 0; i < r.largura * r.altura; i++) if (r.rgba[i * 4 + 3]! > 250) { s += r.rgba[i * 4]! + r.rgba[i * 4 + 1]! + r.rgba[i * 4 + 2]!; n++; } return s / n; };
  assert.ok(claro('rocha.nevada') > claro('rocha.cinza') + 20);
  const r = sombrearEscarpa(base('a', 'rocha.nevada'), RES, true), cores = new Set<string>();
  for (let i = 0; i < r.largura * r.altura; i++) { const a = r.rgba[i * 4 + 3]!; assert.ok(a === 0 || a === 255); if (a) cores.add(`${r.rgba[i * 4]},${r.rgba[i * 4 + 1]},${r.rgba[i * 4 + 2]}`); }
  assert.ok(cores.size >= 3 && cores.size <= 12, `cores ${cores.size}`);
});

test('pé escuro por material: forte na caverna, leve nos outros', () => {
  assert.equal(materialDe('rocha.caverna').pe, 1);
  for (const id of ['rocha.cinza', 'rocha.nevada', 'rocha.arenito']) assert.ok(materialDe(id).pe! <= 0.35, id);
  const W = 160, H = 120, dentro = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - 80) / 55) ** 2 + ((y - 60) / 40) ** 2 < 1) dentro[y * W + x] = 1;
  const maxSombra = (id: string) => { const m = materialDe(id), r = sombrearMacico({ dentro, alfa: dentro.map(v => v * 255), largura: W, altura: H, res: 16, seed: 3, cores: m, pixel: false }); let mx = 0; for (let i = 3; i < r.sombra.length; i += 4) mx = Math.max(mx, r.sombra[i]!); return mx; };
  assert.ok(maxSombra('rocha.arenito') < 0.7 * maxSombra('rocha.caverna'));
});

test('escarpa avulsa bloqueia o passo mas não a visão nem a luz', () => {
  const m = { walls: { w1: { id: 'w1', path: [[0, 0], [6, 0]], height: 3, thickness: 0.4, material: 'rocha.cinza', kind: 'cliff', blocks: { move: true, sight: false, light: false }, drop: 'b', source: null } }, openings: {} } as never;
  assert.equal(oclusores(m, 'visao').length, 0); assert.equal(oclusores(m, 'luz').length, 0); assert.equal(oclusores(m, 'movimento').length, 1);
});
