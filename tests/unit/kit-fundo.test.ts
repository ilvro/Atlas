import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes, type Parte } from '../../src/procedural/descricao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_FUNDO } from '../../src/procedural/receitas/fundo.ts';

const partesDe = (id: string, seed: number, params: Record<string, unknown> = {}): Parte[] => { const d = descreverReceita(id, { seed, params }); assert.equal(d.tipo, 'piso'); return d.tipo === 'piso' ? d.partes : []; };
const SUBMERSOS = ['coral', 'ourico', 'anemona', 'alga', 'rocha-submersa'];

test('as receitas do fundo e dos barcos desenham sem erro, com pegada declarada e partes dentro dela', () => {
  assert.deepEqual(RECEITAS_FUNDO.map(r => r.id), [...SUBMERSOS, 'barco-a-remo', 'barco-de-vela', 'bote-com-carga']);
  for (const r of RECEITAS_FUNDO) {
    assert.ok(r.kit === 'fundo' || r.kit === 'barcos'); assert.ok(r.tags.length >= 3);
    for (const params of r.id === 'coral' ? [{}, { cor: 1 }] : [{}]) for (const seed of [1, 2, 3, 4]) {
      const d = descreverReceita(r.id, { seed, params }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
      for (const p of d.partes) assert.ok(p.forma === 'poli' ? p.pts!.length >= 6 && p.pts!.every(Number.isFinite) : [p.x, p.y, p.w, p.h].every(v => Number.isFinite(v)), r.id);
      const [pw, ph] = pegadaDaReceita(r.id, params), c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= pw + 0.2 && c.y1 - c.y0 <= ph + 0.2, `${r.id}/${seed}: partes passam da pegada (${c.x1 - c.x0} × ${c.y1 - c.y0} em ${pw} × ${ph})`);
    }
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    assert.ok(ACERVO.item(r.id), r.id);
  }
});

test('o fundo nasce submerso e os barcos não; a cor e a semente mudam o desenho', () => {
  for (const r of RECEITAS_FUNDO) assert.equal(ACERVO.item(r.id)?.submerso === true, SUBMERSOS.includes(r.id), r.id);
  assert.notDeepEqual(partesDe('coral', 1, { cor: 0 }), partesDe('coral', 1, { cor: 1 }));
  for (const r of RECEITAS_FUNDO) assert.notDeepEqual(partesDe(r.id, 1), partesDe(r.id, 2), r.id);
});
