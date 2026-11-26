import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUNCOES_AO_AR_LIVRE, GENEROS, TIPOS_DE_COMODO, estiloDeTelhado, generoDe, telhadoPadrao } from '../../src/domain/presets.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { materiaisDo } from '../../src/procedural/materiais.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { MATERIAIS_POR_GENERO, PALETAS_POR_GENERO } from '../../src/authoring/mobiliar.ts';
import { TODOS_OS_CONJUNTOS, receitasDoItem } from '../../src/authoring/espalhar.ts';
import { LUZES_POR_FUNCAO } from '../../src/authoring/luzes.ts';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const TIPOS = ['sala-de-tatami', 'casa-de-cha', 'dojo', 'santuario', 'jardim'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));

test('oriental: os tipos de cômodo existem, têm regras, luz e as receitas das regras existem; o jardim é ao ar livre', () => {
  assert.ok(GENEROS.some(g => g.id === 'oriental'));
  for (const f of TIPOS) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f], `luz de ${f}`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
  assert.deepEqual([...FUNCOES_AO_AR_LIVRE].filter(f => TIPOS.includes(f)), ['jardim']);
  const m = criarMapa(); m.style.genre = 'oriental';
  assert.equal(telhadoPadrao(m, 'jardim', [[2, 2]]), null);
});

test('oriental: pisos e papéis são os da época e existem', () => {
  const pisos = ids('piso'), papeis = ids('papel');
  for (const t of TIPOS_DE_COMODO) {
    const m = MATERIAIS_POR_GENERO.oriental![t.funcao]!;
    for (const p of m.pisos) assert.ok(pisos.has(p), `${t.funcao}: piso ${p}`);
    for (const p of m.papeis) assert.ok(papeis.has(p), `${t.funcao}: papel ${p}`);
  }
  for (const f of TIPOS) { const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!; assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f); }
  const tatami = MATERIAIS_POR_GENERO.oriental!['sala-de-tatami']!;
  assert.ok(tatami.pisos.includes('tatami') && tatami.papeis.includes('shoji'));
  assert.ok(MATERIAIS_POR_GENERO.oriental!.santuario!.pisos.includes('tabuas.laqueadas') && MATERIAIS_POR_GENERO.oriental!.santuario!.papeis.includes('madeira.laqueada'));
  assert.notDeepEqual(PALETAS_POR_GENERO.oriental, PALETAS_POR_GENERO.fantasia);
});

test('oriental: o telhado do gênero é a telha curva cinza', () => {
  const m = criarMapa(); m.style.genre = 'oriental';
  assert.equal(telhadoPadrao(m, 'sala', [[2, 2]])!.material, 'telha.curva.cinza');
  assert.ok(ids('telhado').has(estiloDeTelhado('casa-japonesa')!.roof.material!));
});

test('oriental: a mobília traz as receitas da época', () => {
  const receitas = (f: string) => regrasPara(f, 'oriental').flatMap(r => r.receitas);
  const aceitos = new Set(['oriental', 'fantasia']);
  for (const f of TIPOS) for (const n of receitas(f)) { const g = ACERVO.item(n)!.generos ?? []; assert.ok(!g.length || g.some(x => aceitos.has(x)), `${f}: ${n}`); }
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('sala-de-tatami', 'mesa-baixa', 'zabuton', 'tansu', 'biombo', 'pergaminho-de-parede', 'ikebana', 'andon');
  tem('casa-de-cha', 'irori', 'mesa-baixa', 'bule-e-xicaras.oriental', 'zabuton', 'bonsai', 'andon');
  tem('dojo', 'suporte-de-espadas', 'armadura-oriental', 'pergaminho-de-parede', 'zabuton', 'andon');
  tem('santuario', 'estatua-sentada', 'incensario', 'andon', 'zabuton', 'ikebana');
  tem('jardim', 'lanterna-de-pedra', 'bacia-de-pedra', 'rastelado', 'bonsai', 'casa:cerejeira-4m', 'casa:bambuzal-2m', 'pedra.grande');
  tem('cozinha', 'irori', 'tansu', 'bule-e-xicaras.oriental', 'mesa-baixa', 'zabuton');
  assert.ok(!receitas('cozinha').includes('geladeira') && !receitas('cozinha').includes('lareira.pedra'));
});

test('oriental: conjuntos jardim-de-pedras e bosque-de-bambu citam só itens do acervo', () => {
  for (const id of ['jardim-de-pedras', 'bosque-de-bambu']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) for (const r of receitasDoItem(i)) assert.ok(ACERVO.item(r), `${id}: ${r}`);
  }
  const jp = TODOS_OS_CONJUNTOS.find(x => x.id === 'jardim-de-pedras')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['rastelado', 'pedra.grande', 'lanterna-de-pedra', 'bacia-de-pedra', 'bonsai']) assert.ok(jp.includes(r), r);
  const bb = TODOS_OS_CONJUNTOS.find(x => x.id === 'bosque-de-bambu')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['casa:bambuzal-2m', 'casa:bambuzal-4m', 'lanterna-de-pedra', 'muro-de-bambu']) assert.ok(bb.includes(r), r);
});

test('oriental: as palavras do nome dão a função', () => {
  for (const [n, f] of [['Sala de tatami', 'sala-de-tatami'], ['Washitsu', 'sala-de-tatami'], ['Casa de chá', 'casa-de-cha'], ['Dojo', 'dojo'], ['Dōjō', 'dojo'], ['Santuário', 'santuario'], ['Jinja', 'santuario'], ['Templo xintoísta', 'santuario'], ['Templo de Júpiter', 'templo']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
  assert.equal(generoDe('oriental').id, 'oriental');
});
