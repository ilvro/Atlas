import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, pegadaDaReceita, RECEITAS } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DA_PRACA } from '../../src/procedural/receitas/praca.ts';
import { MATERIAIS } from '../../src/procedural/materiais.ts';
import type { Parte } from '../../src/procedural/descricao.ts';
import { caminho } from '../../src/authoring/caminho.ts';
import { terreno } from '../../src/authoring/construcao.ts';
import { Kit } from '../../scripts/exemplos/kit.ts';

const partes = (id: string, params: Record<string, unknown> = {}, seed = 3): Parte[] => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };

test('as receitas da praça existem, são de exterior e respeitam os limites dos campos', () => {
  assert.deepEqual(RECEITAS_DA_PRACA.map(r => r.id), ['arquibancada', 'roseta-de-calcamento', 'arco-de-pedra', 'estatua-heroica', 'casulo']);
  for (const r of RECEITAS_DA_PRACA) { assert.equal(RECEITAS[r.id], r); assert.equal(r.categoria, 'exterior'); assert.ok(partes(r.id).length > 5, r.id); }
  assert.deepEqual(pegadaDaReceita('roseta-de-calcamento', { raio: 99 }), [18, 18]);
  assert.deepEqual(pegadaDaReceita('casulo', { tamanho: 3 }), [3, 3.75]);
  assert.equal(pegadaDaReceita('arco-de-pedra', { largura: 4 })[0], 5.8);
});

test('a arquibancada sobe para fora: a fileira externa é mais alta e a pegada cabe as partes', () => {
  const ps = partes('arquibancada', { raio: 8, degraus: 5 }), [w, h] = pegadaDaReceita('arquibancada', { raio: 8, degraus: 5 });
  const zs = ps.filter(p => p.forma === 'poli' && !p.alfa).map(p => p.z);
  assert.ok(Math.max(...zs) > 1.8 && Math.min(...zs) < 0.4);
  for (const p of ps) for (let i = 0; i < (p.pts?.length ?? 0); i += 2) { assert.ok(Math.abs(p.pts![i]!) <= w / 2 + 0.3); assert.ok(Math.abs(p.pts![i + 1]!) <= h / 2 + 0.3); }
});

test('a fonte tem três formas e cresce com o diâmetro', () => {
  assert.deepEqual(pegadaDaReceita('fonte'), [2.4, 2.4]);
  assert.deepEqual(pegadaDaReceita('fonte', { diametro: 5 }), [5, 5]);
  const borda = (forma: number) => partes('fonte', { forma, diametro: 4 }).find(p => p.forma === 'poli' && p.z === 0.2)!.pts!.length / 2;
  assert.equal(borda(1), 8);
  assert.ok(borda(2) > borda(1) && borda(0) > borda(1));
});

test('a água de turfa é um material de água escuro', () => {
  assert.equal(MATERIAIS['agua.turfa']!.uso, 'agua');
});

test('Kit.aplicar roda as ferramentas do assistente e o resultado continua editável pelo kit', () => {
  const k = new Kit({ id: 'teste-aplicar', nome: 'Teste', largura: 20, altura: 12, semente: 5 });
  k.base('grama');
  k.aplicar(m => caminho(m, { pontos: [[0, 6], [20, 6]], largura: 1.5, material: 'terra' }, 2));
  k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 2, forma: { retangulo: [12, 0, 20, 12] } }], 3));
  k.objeto('pedra.media', [4, 3]);
  k.pintar('areia', { disco: [4, 9], raio: 1.5 });
  const m = k.construir();
  const mats = Object.values(m.terrain.layers).map(l => l.material).sort();
  assert.deepEqual(mats, ['areia', 'terra']);
  assert.equal(Object.values(m.terrain.relief!.patamares)[0]!.altura, 2);
  assert.equal(Object.keys(m.props).length, 1);
  assert.deepEqual(k.construir(), m, 'construir é estável');
});
