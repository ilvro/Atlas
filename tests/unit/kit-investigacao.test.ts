import { test } from 'node:test';
import assert from 'node:assert/strict';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { gerarLayout } from '../../src/authoring/layout.ts';
import { circulacao, malhaDoComodo, retanguloLivre } from '../../src/authoring/malha.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes } from '../../src/procedural/descricao.ts';
import { RECEITAS_DE_INVESTIGACAO } from '../../src/procedural/receitas/investigacao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

test('as receitas do kit investigação desenham sem erro, com pegada estável e partes dentro da pegada', () => {
  assert.ok(RECEITAS_DE_INVESTIGACAO.length >= 12);
  for (const r of RECEITAS_DE_INVESTIGACAO) {
    assert.deepEqual(r.generos, ['investigacao']); assert.equal(r.kit, 'investigacao');
    const a = descreverReceita(r.id, { seed: 1, params: {} }), b = descreverReceita(r.id, { seed: 7, params: {} });
    assert.equal(a.tipo, r.tipo); assert.ok(a.tipo === 'piso' && a.partes.length >= 4, `${r.id}: poucas partes`);
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: a pegada declarada difere da desenhada`);
    assert.deepEqual(pegadaDaReceita(r.id, {}), pegadaDaReceita(r.id, { qualquer: 1 }), `${r.id}: pegada estável`); assert.deepEqual((b as { pegada: number[] }).pegada, r.pegada);
    const c = caixaDasPartes(a.tipo === 'piso' ? a.partes : []); assert.ok(c.x1 - c.x0 <= r.pegada[0] + 0.2 && c.y1 - c.y0 <= r.pegada[1] + 0.2, `${r.id}: partes passam da pegada`);
    assert.ok(ACERVO.item(r.id), r.id);
  }
});

test('as regras só citam itens que existem; as funções novas estão em TIPOS_DE_COMODO e têm regra', () => {
  for (const f of ['sala-de-jantar', 'sala-de-jogos']) { assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f), f); assert.ok(REGRAS_DE_MOBILIA[f]?.length, f); }
  for (const [funcao, regras] of Object.entries(REGRAS_DE_MOBILIA)) for (const r of regras) for (const id of r.receitas) assert.ok(ACERVO.item(id), `${funcao}/${r.id}: ${id}`);
  const ids = (f: string) => regrasPara(f, 'investigacao').flatMap(r => r.receitas);
  assert.ok(ids('sala').includes('lareira.marmore')); assert.ok(ids('sala-de-jantar').includes('mesa.oval')); assert.ok(ids('sala-de-jogos').includes('mesa.bilhar'));
  assert.deepEqual(['banheira.pes', 'vaso.sanitario', 'pia.pedestal'].filter(i => ids('banheiro').includes(i)), ['banheira.pes', 'vaso.sanitario', 'pia.pedestal']);
  assert.ok(!regrasPara('sala', 'moderno').some(r => r.receitas.includes('lareira.marmore')), 'o kit é só da investigação');
  assert.ok(!regrasPara('sala', 'moderno').some(r => r.id === 'poltrona-lareira'), 'e quem dependia da lareira sai com ela');
});

test('sinais fortes e nomes: piano → sala, bilhar → sala-de-jogos, banheira → banheiro; "jantar" vai para a sala de jantar', () => {
  const m = (nome: string, receitas: string[]) => { const x = mapaCom(sala('c', 0, 0, 4, 3, { name: nome })); receitas.forEach((r, i) => { x.props[`o${i}`] = novoObjeto([1 + i * 0.6, 2], { id: `o${i}`, source: { kind: 'recipe', recipe: r, seed: 1, params: {} }, roomId: 'c' }); }); return funcaoProvavel(insightDoComodo(x, 'c')!); };
  assert.equal(m('Cômodo', ['mesa.bilhar', 'mesa.bilhar'])?.funcao, 'sala-de-jogos'); assert.equal(m('Cômodo', ['banheira.pes', 'banheira.pes'])?.funcao, 'banheiro');
  assert.equal(m('Cômodo', ['piano.cauda', 'piano.cauda'])?.funcao, 'sala'); assert.equal(m('Sala de jantar', [])?.funcao, 'sala-de-jantar'); assert.equal(m('Sala de estar', [])?.funcao, 'sala');
});

test('banheiro de 9 m² mobiliado tem banheira, vaso e pia, sem tampar a porta e com a circulação ligada', () => {
  for (const semente of [0, 1, 2, 3]) {
    const mapa = mapaCom(sala('b', 0, 0, 2, 2, { name: 'Banheiro', function: 'banheiro' })); mapa.openings.p = abertura(mapa, 'p', paredeEm(mapa, 'x', 0, 2.9)!.id, 0.5);
    const l = gerarLayout(mapa, { roomId: 'b', funcao: 'banheiro', genero: 'investigacao', semente, gerarId: (p => { let n = 0; return () => `${p}${++n}`; })('o') });
    const receitas = l.objetos.map(o => (o.source.kind === 'recipe' ? o.source.recipe : ''));
    for (const r of ['banheira.pes', 'vaso.sanitario', 'pia.pedestal']) assert.ok(receitas.includes(r), `semente ${semente}: falta ${r} (${receitas.join(', ')})`);
    const com = { ...mapa, props: { ...mapa.props, ...Object.fromEntries(l.objetos.map(o => [o.id, o])) } }, ins = insightDoComodo(com, 'b')!, malha = malhaDoComodo(com, ins);
    assert.equal(circulacao(malha, ins).ligada, true, `semente ${semente}: circulação`);
    for (const o of ins.objetos) if (o.elevation === 'floor') assert.ok(retanguloLivre(malha, o.caixa, [malha.porta]), `semente ${semente}: ${o.receita} tapa a porta`);
  }
});
