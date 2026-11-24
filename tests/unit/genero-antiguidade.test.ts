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

const TIPOS = ['atrio', 'peristilo', 'triclinio', 'termas', 'templo', 'forum', 'taberna'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));

test('antiguidade: os sete tipos de cômodo existem, têm regras, luz e as receitas das regras existem', () => {
  assert.ok(GENEROS.some(g => g.id === 'antiguidade'));
  for (const f of TIPOS) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f], `luz de ${f}`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
  assert.deepEqual([...FUNCOES_AO_AR_LIVRE].filter(f => TIPOS.includes(f)).sort(), ['forum', 'peristilo']);
});

test('antiguidade: pisos e papéis de cada tipo existem e são os da época', () => {
  const pisos = ids('piso'), papeis = ids('papel');
  for (const t of TIPOS_DE_COMODO) {
    const m = MATERIAIS_POR_GENERO.antiguidade![t.funcao]!;
    for (const p of m.pisos) assert.ok(pisos.has(p), `${t.funcao}: piso ${p}`);
    for (const p of m.papeis) assert.ok(papeis.has(p), `${t.funcao}: papel ${p}`);
  }
  for (const f of TIPOS) { const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!; assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f); }
  assert.ok(MATERIAIS_POR_GENERO.antiguidade!.atrio!.pisos.includes('mosaico.romano') && MATERIAIS_POR_GENERO.antiguidade!.atrio!.papeis.includes('estuque.pompeiano'));
  assert.ok(MATERIAIS_POR_GENERO.antiguidade!.triclinio!.pisos.includes('mosaico.medalhao'));
  assert.ok(MATERIAIS_POR_GENERO.antiguidade!.taberna!.pisos.includes('terracota.quadrada'));
  assert.ok(MATERIAIS_POR_GENERO.antiguidade!.templo!.papeis.includes('parede.hieroglifos'));
  assert.notDeepEqual(PALETAS_POR_GENERO.antiguidade, PALETAS_POR_GENERO.fantasia);
});

test('antiguidade: o telhado do gênero é a telha romana, e o terraço de barro existe', () => {
  const m = criarMapa(); m.style.genre = 'antiguidade';
  assert.equal(telhadoPadrao(m, 'sala', [[2, 2]])!.material, 'telha.imbrex');
  assert.equal(estiloDeTelhado('terraco-de-barro')!.roof.material, 'terraco.barro');
  const coberturas = ids('telhado'); for (const e of ['casa-romana', 'terraco-de-barro']) assert.ok(coberturas.has(estiloDeTelhado(e)!.roof.material!), e);
});

test('antiguidade: a mobília dos tipos da época só traz itens antigos ou atemporais e traz o que se espera', () => {
  const receitas = (f: string) => regrasPara(f, 'antiguidade').flatMap(r => r.receitas);
  const aceitos = new Set(['antiguidade', 'fantasia']);
  for (const f of TIPOS) for (const n of receitas(f)) { const g = ACERVO.item(n)!.generos ?? []; assert.ok(!g.length || g.some(x => aceitos.has(x)), `${f}: ${n}`); }
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('atrio', 'impluvio', 'lucerna', 'busto-em-pedestal', 'estante-de-rolos');
  tem('peristilo', 'pergolado-com-videira', 'fonte-com-mascara', 'estatua-classica', 'coluna.dorica');
  tem('triclinio', 'triclinio', 'mesa-romana', 'lucerna', 'anfora', 'lira');
  tem('termas', 'tanque-de-banho', 'banco', 'anfora', 'lucerna');
  tem('templo', 'estatua-classica', 'altar-de-sacrificio', 'tripe-de-bronze', 'coluna.corintia');
  tem('forum', 'estatua-classica', 'aquila', 'banca-de-mercado.toldo', 'obelisco', 'coluna.jonica');
  tem('taberna', 'mesa-romana', 'anforas-empilhadas', 'pithos', 'lucerna');
  assert.ok(!receitas('sala-de-jantar').includes('mesa.oval') && receitas('sala-de-jantar').includes('mesa-romana'));
});

test('antiguidade: conjuntos ruina-classica e mercado-antigo citam só itens do acervo', () => {
  for (const id of ['ruina-classica', 'mercado-antigo']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) for (const r of receitasDoItem(i)) assert.ok(ACERVO.item(r), `${id}: ${r}`);
  }
  const ruina = TODOS_OS_CONJUNTOS.find(x => x.id === 'ruina-classica')!.itens.flatMap(i => receitasDoItem(i));
  assert.ok(ruina.includes('coluna-classica.caida') && ruina.includes('frontao-caido') && ruina.includes('coluna.dorica'));
  const mercado = TODOS_OS_CONJUNTOS.find(x => x.id === 'mercado-antigo')!.itens.flatMap(i => receitasDoItem(i));
  assert.ok(mercado.includes('banca-de-mercado.toldo') && mercado.includes('anfora') && mercado.includes('pithos') && mercado.includes('caixa'));
});

test('antiguidade: as palavras do nome dão a função', () => {
  for (const [n, f] of [['Átrio', 'atrio'], ['Peristilo', 'peristilo'], ['Triclínio', 'triclinio'], ['Termas', 'termas'], ['Templo de Júpiter', 'templo'], ['Fórum', 'forum'], ['Ágora', 'forum'], ['Taberna', 'taberna']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
  assert.equal(generoDe('antiguidade').id, 'antiguidade');
});
