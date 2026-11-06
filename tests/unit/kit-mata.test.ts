import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes, type Parte } from '../../src/procedural/descricao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_MATA } from '../../src/procedural/receitas/mata.ts';
import { PESADOS } from '../../src/procedural/pesados/index.ts';

const partesDe = (id: string, seed: number, params: Record<string, unknown> = {}): Parte[] => { const d = descreverReceita(id, { seed, params }); assert.equal(d.tipo, 'piso'); return d.tipo === 'piso' ? d.partes : []; };
const VARIACOES: Record<string, Record<string, unknown>[]> = {
  'mureta-de-pedra': [{}, { largura: 8, falha: 1 }, { largura: 1, falha: 0 }], 'circulo-runico': [{}, { raio: 1, raios: 0 }, { raio: 5, raios: 12 }], 'vitoria-regia': [{}, { flor: 1 }],
};

test('as receitas de mata e ruína desenham sem erro, com pegada declarada e partes dentro dela', () => {
  assert.deepEqual(RECEITAS_MATA.map(r => r.id), ['tufo-de-grama', 'junco', 'vitoria-regia', 'raiz-exposta', 'mureta-de-pedra', 'coluna-arruinada', 'coluna-caida', 'circulo-runico', 'escombros', 'viga-partida', 'tabua-solta']);
  for (const r of RECEITAS_MATA) {
    assert.equal(r.categoria, 'exterior'); assert.ok(r.kit === 'mata' || r.kit === 'ruina'); assert.ok(r.tags.length >= 3);
    for (const params of VARIACOES[r.id] ?? [{}]) for (const seed of [1, 2, 3]) {
      const d = descreverReceita(r.id, { seed, params }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
      for (const p of d.partes) assert.ok(p.forma === 'poli' ? p.pts!.length >= 6 && p.pts!.every(Number.isFinite) : [p.x, p.y, p.w, p.h].every(v => Number.isFinite(v)), r.id);
      const [pw, ph] = pegadaDaReceita(r.id, params), c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= pw + 0.2 && c.y1 - c.y0 <= ph + 0.2, `${r.id}/${seed}: partes passam da pegada (${c.x1 - c.x0} × ${c.y1 - c.y0} em ${pw} × ${ph})`);
    }
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    assert.ok(ACERVO.item(r.id), r.id);
  }
});

test('semente muda a forma; mureta cresce com a largura e quebra com a falha; o círculo ganha raios; a vitória-régia ganha flor', () => {
  for (const id of ['tufo-de-grama', 'junco', 'raiz-exposta', 'escombros', 'coluna-caida', 'viga-partida']) assert.notDeepEqual(partesDe(id, 1), partesDe(id, 2), id);
  assert.ok(pegadaDaReceita('mureta-de-pedra', { largura: 6 })[0] > pegadaDaReceita('mureta-de-pedra', { largura: 2 })[0]);
  assert.ok(partesDe('mureta-de-pedra', 3, { largura: 8, falha: 0 }).length > partesDe('mureta-de-pedra', 3, { largura: 8, falha: 1 }).length);
  assert.ok(partesDe('circulo-runico', 1, { raios: 8 }).length > partesDe('circulo-runico', 1, { raios: 0 }).length);
  assert.ok(partesDe('vitoria-regia', 1, { flor: 1 }).length > partesDe('vitoria-regia', 1, { flor: 0 }).length);
  assert.ok(pegadaDaReceita('circulo-runico', { raio: 4 })[0] > pegadaDaReceita('circulo-runico', { raio: 2 })[0]);
});

test('carvalho grande e folhagem tropical: muitas partes, dentro da pegada, semente diferente = forma diferente', () => {
  for (const id of ['carvalho-grande', 'folhagem-tropical']) {
    const g = PESADOS.find(x => x.id === id)!; assert.ok(g, id); assert.equal(g.kit, 'mata');
    for (const v of g.variantes) { const d = g.gerar({ seed: v.seed, params: v.params }), c = caixaDasPartes(d.partes); assert.ok(d.partes.length > 80, `${id}/${v.nome}: ${d.partes.length} partes`); assert.ok(c.x1 - c.x0 <= d.pegada[0] + 0.3 && c.y1 - c.y0 <= d.pegada[1] + 0.3, `${id}/${v.nome}: passa da pegada`); }
    assert.notDeepEqual(g.gerar({ seed: 1, params: g.variantes[0]!.params }).partes, g.gerar({ seed: 2, params: g.variantes[0]!.params }).partes);
  }
  assert.ok(PESADOS.find(x => x.id === 'carvalho-grande')!.variantes.every(v => (v.params.diametro as number) >= 6 && (v.params.diametro as number) <= 8));
});
