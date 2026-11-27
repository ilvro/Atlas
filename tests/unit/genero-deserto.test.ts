import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FUNCOES_AO_AR_LIVRE, GENEROS, TIPOS_DE_COMODO, estiloDeTelhado, generoDe, telhadoPadrao } from '../../src/domain/presets.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { materiaisDo } from '../../src/procedural/materiais.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { MATERIAIS_POR_GENERO, PALETAS_POR_GENERO, propostaDeMobilia } from '../../src/authoring/mobiliar.ts';
import { TODOS_OS_CONJUNTOS, receitasDoItem } from '../../src/authoring/espalhar.ts';
import { LUZES_POR_FUNCAO } from '../../src/authoring/luzes.ts';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const TIPOS = ['tenda', 'patio-com-fonte', 'bazar', 'salao-de-cha'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));

test('deserto: os tipos de cômodo existem, têm regras, luz e as receitas das regras existem; o pátio com fonte é ao ar livre', () => {
  assert.ok(GENEROS.some(g => g.id === 'deserto'));
  for (const f of [...TIPOS, 'deposito']) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f], `luz de ${f}`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
  assert.deepEqual([...FUNCOES_AO_AR_LIVRE].filter(f => TIPOS.includes(f)), ['patio-com-fonte']);
  const m = criarMapa(); m.style.genre = 'deserto';
  assert.equal(telhadoPadrao(m, 'patio-com-fonte', [[2, 2]]), null);
});

test('deserto: pisos e papéis são os da época e existem', () => {
  const pisos = ids('piso'), papeis = ids('papel');
  for (const t of TIPOS_DE_COMODO) {
    const m = MATERIAIS_POR_GENERO.deserto![t.funcao]!;
    for (const p of m.pisos) assert.ok(pisos.has(p), `${t.funcao}: piso ${p}`);
    for (const p of m.papeis) assert.ok(papeis.has(p), `${t.funcao}: papel ${p}`);
  }
  for (const f of TIPOS) { const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!; assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f); }
  assert.ok(MATERIAIS_POR_GENERO.deserto!['patio-com-fonte']!.pisos.includes('zellige') && MATERIAIS_POR_GENERO.deserto!['patio-com-fonte']!.papeis.includes('adobe'));
  assert.ok(MATERIAIS_POR_GENERO.deserto!.tenda!.papeis.includes('taipa'));
  assert.notDeepEqual(PALETAS_POR_GENERO.deserto, PALETAS_POR_GENERO.fantasia);
});

test('deserto: o telhado do gênero é o terraço de barro', () => {
  const m = criarMapa(); m.style.genre = 'deserto';
  assert.equal(telhadoPadrao(m, 'sala', [[2, 2]])!.material, 'terraco.barro');
  assert.ok(ids('telhado').has(estiloDeTelhado('terraco-de-barro')!.roof.material!));
});

test('deserto: a mobília traz as receitas da época', () => {
  const receitas = (f: string) => regrasPara(f, 'deserto').flatMap(r => r.receitas);
  const aceitos = new Set(['deserto', 'fantasia']);
  for (const f of [...TIPOS, 'deposito', 'sala', 'cozinha']) for (const n of receitas(f)) { const g = ACERVO.item(n)!.generos ?? []; assert.ok(!g.length || g.some(x => aceitos.has(x)), `${f}: ${n}`); }
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('tenda', 'mesa-de-latao', 'tapete-de-chao', 'almofadas', 'narguile', 'bau-pintado', 'jarro-de-barro', 'cesto', 'lanterna-marroquina');
  tem('patio-com-fonte', 'fonte', 'poco.oasis', 'casa:tamareira-5m', 'lanterna-marroquina', 'toldo-listrado', 'jarro-de-barro');
  tem('bazar', 'banca-de-especiarias', 'tapetes-pendurados', 'cesto', 'cantaros-empilhados', 'tapete-de-chao');
  tem('salao-de-cha', 'mesa-de-latao', 'almofadas', 'narguile', 'lanterna-marroquina', 'tapete-de-chao');
  tem('deposito', 'cantaros-empilhados', 'jarro-de-barro', 'cesto', 'bau-pintado');
  tem('sala', 'almofadas', 'mesa-de-latao', 'tapete-de-chao'); tem('cozinha', 'mesa-de-latao', 'almofadas');
  assert.ok(!receitas('cozinha').includes('geladeira') && !receitas('deposito').includes('barril'));
  // Fora do gênero, o depósito continua com o que tinha.
  assert.ok(regrasPara('deposito', 'investigacao').flatMap(r => r.receitas).includes('barril'));
});

test('deserto: a proposta de mobília da tenda e do salão de chá usa as receitas da época', () => {
  for (const [f, esperadas] of [['tenda', ['mesa-de-latao', 'almofadas']], ['salao-de-cha', ['mesa-de-latao', 'almofadas']], ['bazar', ['banca-de-especiarias']]] as const) {
    const m = mapaCom(sala('c', 0, 0, 6, 5, { name: f, function: f })); m.style = { ...m.style, genre: 'deserto' };
    let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente: 3, gerarId: q => `${q}${++n}` }, 'c')!;
    assert.ok(p, f);
    const usadas = JSON.stringify(p.comandos);
    for (const r of esperadas) assert.ok(usadas.includes(`"${r}"`), `${f}: ${r}`);
  }
});

test('deserto: conjuntos oasis e acampamento-de-caravana citam só itens do acervo', () => {
  for (const id of ['oasis', 'acampamento-de-caravana']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) for (const r of receitasDoItem(i)) assert.ok(ACERVO.item(r), `${id}: ${r}`);
  }
  const o = TODOS_OS_CONJUNTOS.find(x => x.id === 'oasis')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['poco.oasis', 'casa:tamareira-5m', 'camelo', 'jarro-de-barro']) assert.ok(o.includes(r), r);
  const a = TODOS_OS_CONJUNTOS.find(x => x.id === 'acampamento-de-caravana')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['tenda-beduina', 'fogueira-de-caravana', 'camelo', 'cantaros-empilhados', 'palanquim']) assert.ok(a.includes(r), r);
});

test('deserto: as palavras do nome dão a função, e "salão de chá" não vira casa de chá', () => {
  for (const [n, f] of [['Tenda', 'tenda'], ['Tenda beduína', 'tenda'], ['Bazar', 'bazar'], ['Souk', 'bazar'], ['Oásis', 'patio-com-fonte'], ['Caravançará', 'patio-com-fonte'], ['Pátio com fonte', 'patio-com-fonte'],
    ['Salão de chá', 'salao-de-cha'], ['Majlis', 'salao-de-cha'], ['Casa de chá', 'casa-de-cha'], ['Pátio', 'patio'], ['Depósito', 'deposito'], ['Venda', 'loja']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
  assert.equal(generoDe('deserto').id, 'deserto');
});
