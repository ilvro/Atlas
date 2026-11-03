import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PESADOS, idDaVariante, type GeradorPesado } from '../../src/procedural/pesados/index.ts';
import { COLECAO } from '../../src/procedural/colecao.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes } from '../../src/procedural/descricao.ts';
import { CATEGORIAS } from '../../src/procedural/receitas/index.ts';

test('cada gerador pesado devolve descrição válida, com pegada estável entre as variantes e partes dentro da pegada', () => {
  assert.ok(PESADOS.length >= 3);
  const ids = new Set<string>();
  for (const g of PESADOS) {
    assert.ok(CATEGORIAS.some(c => c[0] === g.categoria), g.id); assert.ok(g.variantes.length >= 1 && g.versao >= 1);
    const pegadas = g.variantes.map(v => g.gerar({ seed: v.seed, params: v.params }));
    for (const d of pegadas) {
      assert.equal(d.tipo, 'piso'); assert.ok(d.partes.length > 20, `${g.id}: só ${d.partes.length} partes (pesado é o que passa disso)`);
      for (const p of d.partes) { assert.ok(p.mat && Number.isFinite(p.z)); if (p.forma === 'poli') assert.ok(p.pts && p.pts.length >= 6 && p.pts.every(Number.isFinite)); else assert.ok([p.x, p.y, p.w, p.h].every(v => Number.isFinite(v))); }
      const c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= d.pegada[0] + 0.3 && c.y1 - c.y0 <= d.pegada[1] + 0.3, `${g.id}: partes passam da pegada`);
    }
    // Variantes que só mudam de cor têm a mesma pegada; as de tamanho (árvores) mudam só pelos parâmetros numéricos; e gerar duas vezes dá o mesmo.
    const tamanho = (v: GeradorPesado['variantes'][number]) => JSON.stringify(Object.entries(v.params).filter(([, x]) => typeof x === 'number'));
    g.variantes.forEach((v, i) => {
      assert.deepEqual(g.gerar({ seed: v.seed, params: v.params }).pegada, pegadas[i]!.pegada, `${g.id}: a pegada não é determinística`);
      const igual = g.variantes.findIndex(o => tamanho(o) === tamanho(v)); assert.deepEqual(pegadas[i]!.pegada, pegadas[igual]!.pegada, `${g.id}: a pegada muda entre variantes do mesmo tamanho`);
    });
    for (const v of g.variantes) { const id = idDaVariante(g, v.sufixo); assert.ok(!ids.has(id), `id repetido ${id}`); ids.add(id); }
  }
});

test('todo gerador pesado tem as suas variantes no catálogo (rode `npm run assar` se faltar), com a versão e a pegada certas', () => {
  for (const g of PESADOS) for (const v of g.variantes) {
    const id = idDaVariante(g, v.sufixo), item = COLECAO.find(i => i.id === id);
    assert.ok(item, `${id} não está no catálogo: rode npm run assar`);
    assert.equal(item!.origem.tipo, 'gerado'); if (item!.origem.tipo === 'gerado') { assert.equal(item!.origem.versao, g.versao, `${id}: versão velha, rode npm run assar`); assert.equal(item!.origem.seed, v.seed); assert.deepEqual(item!.origem.params, v.params); }
    const d = g.gerar({ seed: v.seed, params: v.params }); assert.ok(Math.abs(item!.pegada[0] - d.pegada[0]) < 0.01 && Math.abs(item!.pegada[1] - d.pegada[1]) < 0.01, `${id}: pegada do catálogo difere do gerador`);
    assert.ok(ACERVO.item(id), `${id} não chegou ao acervo`);
  }
});
