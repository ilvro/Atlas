import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { edificiosDe } from '../../src/domain/edificios.ts';
import { criarMapa, type Comodo, type Telhado } from '../../src/domain/mapa.ts';
import {
  aguasDe,
  aguasDoTrecho,
  formaDe,
  ordemDoTrecho,
  retangulosDe,
  trechosDe,
  type Face,
  type Ret,
} from '../../src/domain/telhado-geometria.ts';

function areaPoligono(pts: readonly [number, number][]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

function somaDasAreas(faces: readonly Face[]): number {
  return faces.reduce((acc, f) => acc + areaPoligono(f.pontos), 0);
}

function areaExpandida(ret: Ret, beiral: number): number {
  return (ret[2] - ret[0] + 2 * beiral) * (ret[3] - ret[1] + 2 * beiral);
}

function comodo(id: string, celulas: [number, number][], roof: Telhado): Comodo {
  return {
    id,
    name: id,
    function: null,
    cells: codificar(celulas),
    floor: { material: 'pedra', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof,
    levelId: null,
  };
}

test('formaDe devolve os padrões quando os campos opcionais faltam', () => {
  assert.deepEqual(formaDe({ material: 'telha.barro', visible: true }), {
    shape: 'quatro-aguas',
    ridge: 'auto',
    steep: false,
    details: [],
  });
  assert.equal(ordemDoTrecho({ shape: 'plano' }), 0);
  assert.equal(ordemDoTrecho({ shape: 'quatro-aguas' }), 1);
  assert.equal(ordemDoTrecho({ shape: 'duas-aguas' }), 1);
  assert.equal(ordemDoTrecho({ shape: 'piramide' }), 2);
});

test('aguasDe: 4×2 em quatro águas, duas águas, ridge v e pirâmide 3×3 conservam a área', () => {
  const r42: Ret = [0, 0, 4, 2];

  const q = aguasDe(r42, { shape: 'quatro-aguas' });
  assert.equal(q.faces.length, 4);
  assert.equal(q.cumeeiras.length, 1);
  const [c0, c1] = q.cumeeiras[0]!;
  assert.equal(c0[1], c1[1], 'cumeeira horizontal');
  assert.ok(Math.abs(Math.hypot(c1[0] - c0[0], c1[1] - c0[1]) - 2) < 1e-9, 'cumeeira de 2 células');
  assert.ok(Math.abs(somaDasAreas(q.faces) - areaExpandida(r42, 0.25)) < 1e-6);

  const d0 = aguasDe(r42, { shape: 'duas-aguas' }, 0);
  assert.equal(d0.faces.length, 2);
  assert.equal(d0.cumeeiras.length, 1);
  assert.ok(Math.abs(Math.hypot(d0.cumeeiras[0]![1][0] - d0.cumeeiras[0]![0][0], d0.cumeeiras[0]![1][1] - d0.cumeeiras[0]![0][1]) - 4) < 1e-9);
  assert.ok(Math.abs(somaDasAreas(d0.faces) - areaExpandida(r42, 0)) < 1e-6);

  const dv = aguasDe(r42, { shape: 'duas-aguas', ridge: 'v' });
  assert.equal(dv.faces.length, 2);
  assert.equal(dv.cumeeiras[0]![0][0], dv.cumeeiras[0]![1][0], 'ridge: v gira a cumeeira para vertical');
  assert.ok(Math.abs(somaDasAreas(dv.faces) - areaExpandida(r42, 0.25)) < 1e-6);

  const p33: Ret = [1, 1, 4, 4];
  const p = aguasDe(p33, { shape: 'piramide' });
  assert.equal(p.faces.length, 4);
  assert.equal(p.cumeeiras.length, 0);
  assert.ok(p.faces.every(f => f.pontos.length === 3));
  assert.ok(Math.abs(somaDasAreas(p.faces) - areaExpandida(p33, 0.25)) < 1e-6);

  const pl = aguasDe(r42, { shape: 'plano' });
  assert.equal(pl.faces.length, 2);
  assert.deepEqual(pl.faces[0]!.normal, [0, 0]);
  assert.equal(pl.faces[1]!.platibanda, true);
  assert.ok(Math.abs(somaDasAreas(pl.faces) - areaExpandida(r42, 0.25)) < 1e-6);
});

test('retangulosDe decompõe L em 2 retângulos maximais e aguasDoTrecho junta as faces', () => {
  const emL: [number, number][] = [
    [0, 0], [1, 0], [2, 0], [3, 0],
    [0, 1], [1, 1], [2, 1], [3, 1],
    [0, 2], [0, 3],
  ];
  const rets = retangulosDe(emL);
  assert.equal(rets.length, 2);
  assert.deepEqual(rets[0], [0, 0, 4, 2]);
  assert.deepEqual(rets[1], [0, 2, 1, 4]);

  const trecho = {
    salas: ['a'],
    celulas: emL,
    roof: { material: 'telha.barro', visible: true, shape: 'duas-aguas' as const },
  };
  const aguas = aguasDoTrecho(trecho, { size: 1.5, offset: [3, 0] });
  assert.equal(aguas.faces.length, 4);
  assert.equal(aguas.cumeeiras.length, 2);
  // Em metros: o retângulo 4×2 células vira 6×3 m a partir de x = 3, e o beiral de 0,25 m vale em metros, não em células.
  const xs = aguas.faces.flatMap(f => f.pontos.map(p => p[0])), ys = aguas.faces.flatMap(f => f.pontos.map(p => p[1]));
  assert.ok(Math.abs(Math.min(...xs) - 2.75) < 1e-9);
  assert.ok(Math.abs(Math.max(...xs) - 9.25) < 1e-9);
  assert.ok(Math.abs(Math.min(...ys) + 0.25) < 1e-9);
  assert.ok(Math.abs(Math.max(...ys) - 6.25) < 1e-9);
});

test('igreja (nave em duas águas + torre em pirâmide vizinha) dá 1 edifício e 2 trechos', () => {
  const m = criarMapa();
  m.rooms = {
    nave: comodo('nave', [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]], {
      material: 'telha.ardosia',
      visible: true,
      shape: 'duas-aguas',
      steep: true,
      details: ['cruz'],
    }),
    torre: comodo('torre', [[3, 0], [3, 1]], {
      material: 'telha.escamas',
      visible: true,
      shape: 'piramide',
      steep: true,
      details: ['sino'],
    }),
  };

  const eds = edificiosDe(m);
  assert.equal(eds.length, 1);

  const trechos = trechosDe(m, eds[0]!);
  assert.equal(trechos.length, 2);
  assert.deepEqual(trechos.map(t => t.salas), [['nave'], ['torre']]);
  assert.equal(ordemDoTrecho(trechos[0]!.roof) < ordemDoTrecho(trechos[1]!.roof), true);
});
