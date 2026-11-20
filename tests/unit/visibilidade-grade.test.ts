import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poligonoIluminado, type Segmento } from '../../src/domain/visibilidade.ts';

/** A versão linear de referência: um raio contra todos os segmentos, para cada ângulo. */
function referencia(o: [number, number], segs: readonly Segmento[], alcance: number): number[] {
  const angulos: number[] = [];
  for (const s of segs) for (const p of [s.a, s.b]) {
    if (Math.hypot(p[0] - o[0], p[1] - o[1]) > alcance * 1.5) continue;
    const a = Math.atan2(p[1] - o[1], p[0] - o[0]); angulos.push(a - 1e-4, a, a + 1e-4);
  }
  for (let i = 0; i < 96; i++) angulos.push(-Math.PI + i * Math.PI * 2 / 96);
  angulos.sort((a, b) => a - b);
  const pontos: number[] = [];
  for (const a of angulos) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let melhor = Infinity;
    for (const s of segs) {
      const sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1], den = dx * sy - dy * sx;
      if (Math.abs(den) < 1e-12) continue;
      const t = ((s.a[0] - o[0]) * sy - (s.a[1] - o[1]) * sx) / den, u = ((s.a[0] - o[0]) * dy - (s.a[1] - o[1]) * dx) / den;
      if (t > 1e-6 && u >= -1e-9 && u <= 1 + 1e-9 && t < melhor) melhor = t;
    }
    const t = Math.min(alcance, melhor);
    pontos.push(o[0] + dx * t, o[1] + dy * t);
  }
  return pontos;
}

function sorteio(semente: number): () => number {
  let s = semente >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

test('poligonoIluminado: com muitos segmentos (grade de raios) dá o mesmo polígono da conta linear', () => {
  const r = sorteio(7);
  for (let rodada = 0; rodada < 40; rodada++) {
    const alcance = 4 + r() * 16, o: [number, number] = [20 + r() * 4, 20 + r() * 4];
    const segs: Segmento[] = [];
    const n = 30 + Math.floor(r() * 120);
    for (let i = 0; i < n; i++) {
      const ax = o[0] + (r() - 0.5) * alcance * 3, ay = o[1] + (r() - 0.5) * alcance * 3, c = 0.3 + r() * 5, ang = r() * Math.PI * 2;
      segs.push({ a: [ax, ay], b: [ax + Math.cos(ang) * c, ay + Math.sin(ang) * c] });
    }
    // Segmentos alinhados aos eixos e encostados nas quinas da grade.
    segs.push({ a: [o[0] - alcance, o[1] + 2], b: [o[0] + alcance, o[1] + 2] }, { a: [o[0] + 3, o[1] - alcance], b: [o[0] + 3, o[1] + alcance] });
    const esperado = referencia(o, segs.filter(s => true), alcance), obtido = poligonoIluminado(o, segs, alcance, null);
    assert.equal(obtido.length, esperado.length, `rodada ${rodada}: mesmo número de vértices`);
    for (let i = 0; i < esperado.length; i++) assert.ok(Math.abs(obtido[i]! - esperado[i]!) < 1e-6, `rodada ${rodada}, vértice ${i}: ${obtido[i]} ≠ ${esperado[i]}`);
  }
});
