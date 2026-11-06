import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes, type Parte } from '../../src/procedural/descricao.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_CAVERNA } from '../../src/procedural/receitas/caverna.ts';

const partesDe = (id: string, seed: number, params: Record<string, unknown> = {}): Parte[] => { const d = descreverReceita(id, { seed, params }); assert.equal(d.tipo, 'piso'); return d.tipo === 'piso' ? d.partes : []; };
const VARIACOES: Record<string, Record<string, unknown>[]> = { 'cranio-animal': [{}, { chifres: 1 }], buraco: [{}, { largura: 0.8 }, { largura: 3 }], estalagmite: [{}, { tamanho: 0.4 }, { tamanho: 0.8 }] };

test('as receitas da caverna desenham sem erro, com pegada declarada e partes dentro dela', () => {
  assert.deepEqual(RECEITAS_CAVERNA.map(r => r.id), ['ossada', 'cranio-animal', 'pilha-de-ossos', 'pilha-de-peles', 'buraco', 'estalagmite', 'arvore-morta-caida']);
  for (const r of RECEITAS_CAVERNA) {
    assert.equal(r.kit, 'ermos'); assert.ok(r.tags.includes('caverna'));
    for (const params of VARIACOES[r.id] ?? [{}]) for (const seed of [1, 2, 3, 4]) {
      const d = descreverReceita(r.id, { seed, params }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
      for (const p of d.partes) assert.ok(p.forma === 'poli' ? p.pts!.length >= 6 && p.pts!.every(Number.isFinite) : [p.x, p.y, p.w, p.h].every(v => Number.isFinite(v)), r.id);
      const [pw, ph] = pegadaDaReceita(r.id, params), c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= pw + 0.2 && c.y1 - c.y0 <= ph + 0.2, `${r.id}/${seed}: partes passam da pegada (${c.x1 - c.x0} × ${c.y1 - c.y0} em ${pw} × ${ph})`);
    }
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    assert.ok(ACERVO.item(r.id), r.id);
  }
});

test('chifres e largura mudam o desenho; a semente muda a forma; o buraco nasce bloqueando o passo', () => {
  assert.notDeepEqual(partesDe('cranio-animal', 1, { chifres: 0 }), partesDe('cranio-animal', 1, { chifres: 1 }));
  assert.ok(pegadaDaReceita('buraco', { largura: 3 })[0] > pegadaDaReceita('buraco', { largura: 1 })[0]);
  for (const id of ['ossada', 'pilha-de-ossos', 'pilha-de-peles', 'buraco', 'estalagmite', 'arvore-morta-caida']) assert.notDeepEqual(partesDe(id, 1), partesDe(id, 2), id);
  assert.equal(novoObjeto([0, 0], { source: { kind: 'recipe', recipe: 'buraco', seed: 1, params: {} } }).blocks.move, true);
});
