import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes, type Parte } from '../../src/procedural/descricao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_ERMOS } from '../../src/procedural/receitas/ermos.ts';

const partesDe = (id: string, seed: number, params: Record<string, unknown> = {}): Parte[] => { const d = descreverReceita(id, { seed, params }); assert.equal(d.tipo, 'piso'); return d.tipo === 'piso' ? d.partes : []; };

test('as receitas de ermos desenham sem erro, com pegada declarada e partes dentro da pegada', () => {
  assert.deepEqual(RECEITAS_ERMOS.map(r => r.id), ['rochedo', 'seixos', 'galho-seco', 'treno']);
  for (const r of RECEITAS_ERMOS) {
    assert.equal(r.categoria, 'exterior'); assert.equal(r.kit, 'ermos'); assert.ok(r.tags.length >= 3);
    for (const params of r.id === 'rochedo' ? [{}, { tamanho: 5, cobertura: 1 }, { tamanho: 1.5, cobertura: 2 }] : [{}]) for (const seed of [1, 2, 3]) {
      const d = descreverReceita(r.id, { seed, params }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
      for (const p of d.partes) assert.ok(p.forma === 'poli' ? p.pts!.length >= 6 && p.pts!.every(Number.isFinite) : [p.x, p.y, p.w, p.h].every(v => Number.isFinite(v)), r.id);
      const [pw, ph] = pegadaDaReceita(r.id, params), c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= pw + 0.2 && c.y1 - c.y0 <= ph + 0.2, `${r.id}/${seed}: partes passam da pegada`);
    }
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
  }
});

test('o rochedo muda de forma com a semente e de partes com a cobertura, e cresce com o tamanho', () => {
  assert.notDeepEqual(partesDe('rochedo', 1), partesDe('rochedo', 2));
  const nada = partesDe('rochedo', 1, { cobertura: 0 }), musgo = partesDe('rochedo', 1, { cobertura: 1 }), neve = partesDe('rochedo', 1, { cobertura: 2 });
  assert.ok(musgo.length > nada.length && neve.length > nada.length); assert.ok(neve.some(p => p.mat === '#f4f8fc')); assert.ok(musgo.some(p => p.mat === '#4f7a3a' || p.mat === '#678f45'));
  assert.ok(pegadaDaReceita('rochedo', { tamanho: 5 })[0] > pegadaDaReceita('rochedo', { tamanho: 2 })[0]);
  assert.notDeepEqual(partesDe('seixos', 1), partesDe('seixos', 2)); assert.notDeepEqual(partesDe('galho-seco', 1), partesDe('galho-seco', 2));
});

test('as receitas de ermos chegam ao acervo', () => { for (const r of RECEITAS_ERMOS) assert.ok(ACERVO.item(r.id), r.id); });
