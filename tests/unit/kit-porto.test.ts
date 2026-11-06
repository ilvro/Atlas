import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes, type Parte } from '../../src/procedural/descricao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_PORTO } from '../../src/procedural/receitas/porto.ts';

const partesDe = (id: string, seed: number, params: Record<string, unknown> = {}): Parte[] => { const d = descreverReceita(id, { seed, params }); assert.equal(d.tipo, 'piso'); return d.tipo === 'piso' ? d.partes : []; };
const VARIACOES: Record<string, Record<string, unknown>[]> = {
  navio: [{}, { comprimento: 14, mastros: 2 }, { comprimento: 30, mastros: 3 }], 'cais-segmento': [{}, { comprimento: 12, largura: 4 }, { comprimento: 1, largura: 1 }], 'barraca-de-feira': [{}, { paleta: 1 }, { paleta: 3 }],
};

test('as receitas do porto desenham sem erro, com pegada declarada e partes dentro dela', () => {
  assert.deepEqual(RECEITAS_PORTO.map(r => r.id), ['navio', 'barcaca', 'guindaste-de-cais', 'cais-segmento', 'estaca', 'barraca-de-feira', 'caixote', 'pilha-de-caixotes', 'barril', 'pilha-de-barris', 'sacos', 'rede-de-pesca', 'ancora', 'rolo-de-corda', 'lanterna-de-poste']);
  for (const r of RECEITAS_PORTO) {
    assert.equal(r.kit, 'porto'); assert.ok(r.tags.length >= 3);
    for (const params of VARIACOES[r.id] ?? [{}]) for (const seed of [1, 2, 3]) {
      const d = descreverReceita(r.id, { seed, params }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
      for (const p of d.partes) assert.ok(p.forma === 'poli' ? p.pts!.length >= 6 && p.pts!.every(Number.isFinite) : [p.x, p.y, p.w, p.h].every(v => Number.isFinite(v)), r.id);
      const [pw, ph] = pegadaDaReceita(r.id, params), c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= pw + 0.2 && c.y1 - c.y0 <= ph + 0.2, `${r.id}/${seed}: partes passam da pegada (${c.x1 - c.x0} × ${c.y1 - c.y0} em ${pw} × ${ph})`);
    }
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    assert.ok(ACERVO.item(r.id), r.id);
  }
});

test('navio cresce com o comprimento e ganha mastro; cais cresce; barraca muda de cor; a semente muda a forma', () => {
  assert.ok(pegadaDaReceita('navio', { comprimento: 30 })[0] > pegadaDaReceita('navio', { comprimento: 14 })[0]);
  assert.ok(partesDe('navio', 1, { mastros: 3 }).length > partesDe('navio', 1, { mastros: 2 }).length);
  assert.ok(pegadaDaReceita('cais-segmento', { comprimento: 8 })[0] > pegadaDaReceita('cais-segmento', { comprimento: 2 })[0]);
  assert.ok(partesDe('cais-segmento', 1, { comprimento: 8 }).length > partesDe('cais-segmento', 1, { comprimento: 2 }).length);
  assert.notDeepEqual(partesDe('barraca-de-feira', 1, { paleta: 0 }), partesDe('barraca-de-feira', 1, { paleta: 1 }));
  for (const id of ['cais-segmento', 'sacos', 'rede-de-pesca', 'pilha-de-caixotes', 'pilha-de-barris', 'barcaca']) assert.notDeepEqual(partesDe(id, 1), partesDe(id, 2), id);
});
