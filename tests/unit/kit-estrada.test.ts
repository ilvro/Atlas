import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes, type Parte } from '../../src/procedural/descricao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_ESTRADA } from '../../src/procedural/receitas/estrada.ts';

const partesDe = (id: string, seed: number, params: Record<string, unknown> = {}): Parte[] => { const d = descreverReceita(id, { seed, params }); assert.equal(d.tipo, 'piso'); return d.tipo === 'piso' ? d.partes : []; };
const VARIACOES: Record<string, Record<string, unknown>[]> = { carroca: [{}, { carga: 1 }], cavalo: [{}, { pelagem: 1 }, { pelagem: 2 }, { pelagem: 3 }], 'carrinho-de-carga': [{}, { carga: 0 }] };

test('as receitas da estrada desenham sem erro, com pegada declarada e partes dentro dela', () => {
  assert.deepEqual(RECEITAS_ESTRADA.map(r => r.id), ['carroca', 'cavalo', 'fardo-de-feno', 'bebedouro', 'carrinho-de-mao', 'carrinho-de-carga']);
  for (const r of RECEITAS_ESTRADA) {
    assert.equal(r.kit, 'estrada'); assert.ok(r.tags.length >= 3);
    for (const params of VARIACOES[r.id] ?? [{}]) for (const seed of [1, 2, 3]) {
      const d = descreverReceita(r.id, { seed, params }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
      for (const p of d.partes) assert.ok(p.forma === 'poli' ? p.pts!.length >= 6 && p.pts!.every(Number.isFinite) : [p.x, p.y, p.w, p.h].every(v => Number.isFinite(v)), r.id);
      const [pw, ph] = pegadaDaReceita(r.id, params), c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= pw + 0.2 && c.y1 - c.y0 <= ph + 0.2, `${r.id}/${seed}: partes passam da pegada (${c.x1 - c.x0} × ${c.y1 - c.y0} em ${pw} × ${ph})`);
    }
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    assert.ok(ACERVO.item(r.id), r.id);
  }
});

test('a carga e a pelagem mudam o desenho; a semente muda a forma', () => {
  assert.notDeepEqual(partesDe('carroca', 1, { carga: 0 }), partesDe('carroca', 1, { carga: 1 }));
  assert.notDeepEqual(partesDe('carrinho-de-carga', 1, { carga: 0 }), partesDe('carrinho-de-carga', 1, { carga: 1 }));
  for (const k of [1, 2, 3]) assert.notDeepEqual(partesDe('cavalo', 1, { pelagem: 0 }), partesDe('cavalo', 1, { pelagem: k }));
  assert.ok(partesDe('cavalo', 1, { pelagem: 3 }).length > partesDe('cavalo', 1, { pelagem: 0 }).length);
  for (const id of ['carroca', 'cavalo', 'fardo-de-feno', 'bebedouro', 'carrinho-de-mao']) assert.notDeepEqual(partesDe(id, 1), partesDe(id, 2), id);
});
