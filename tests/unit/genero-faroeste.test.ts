import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENEROS, TIPOS_DE_COMODO, estiloDeTelhado, generoDe, generosVisiveis, telhadoPadrao } from '../../src/domain/presets.ts';
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

const TIPOS = ['saloon', 'xerifado', 'armazem-geral', 'banco', 'estacao'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));

test('faroeste: os tipos de cômodo existem, têm regras, luz e as receitas das regras existem', () => {
  assert.ok(GENEROS.some(g => g.id === 'faroeste'));
  for (const f of [...TIPOS, 'estabulo']) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f], `luz de ${f}`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
});

test('faroeste: pisos e papéis são os da época e existem', () => {
  const pisos = ids('piso'), papeis = ids('papel');
  for (const t of TIPOS_DE_COMODO) {
    const m = MATERIAIS_POR_GENERO.faroeste![t.funcao]!;
    for (const p of m.pisos) assert.ok(pisos.has(p), `${t.funcao}: piso ${p}`);
    for (const p of m.papeis) assert.ok(papeis.has(p), `${t.funcao}: papel ${p}`);
  }
  for (const f of TIPOS) { const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!; assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f); }
  const m = MATERIAIS_POR_GENERO.faroeste!;
  assert.ok(m.saloon!.pisos.includes('tabuas.gastas') && m.saloon!.papeis.includes('tabuas.descascadas'));
  assert.ok(m.banco!.pisos.includes('ladrilho.hidraulico') && m.banco!.papeis.includes('caiado'));
  assert.ok(m.estacao!.pisos.includes('tijoleira') && m.estacao!.papeis.includes('tijolo.fuligem'));
  assert.notDeepEqual(PALETAS_POR_GENERO.faroeste, PALETAS_POR_GENERO.investigacao);
});

test('faroeste: o telhado do gênero é a cabana de tábuas', () => {
  const m = criarMapa(); m.style.genre = 'faroeste';
  assert.equal(telhadoPadrao(m, 'sala', [[2, 2]])!.material, 'telha.tabuas');
  assert.ok(ids('telhado').has(estiloDeTelhado('cabana-de-tabuas')!.roof.material!));
});

test('faroeste: a mobília traz as receitas da época, e o gênero aceita as receitas que herda', () => {
  const receitas = (f: string) => regrasPara(f, 'faroeste').flatMap(r => r.receitas);
  const aceitos = generosVisiveis('faroeste');
  for (const f of [...TIPOS, 'estabulo', 'taverna', 'escritorio']) for (const n of receitas(f)) { const g = ACERVO.item(n)!.generos ?? []; assert.ok(!g.length || g.some(x => aceitos.includes(x)), `${f}: ${n}`); }
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('saloon', 'balcao-de-saloon', 'mesa-de-poquer', 'cadeira', 'piano-de-armario', 'escarradeira', 'cabeca-de-bufalo', 'placa-de-procurado');
  tem('xerifado', 'mesa-de-xerife', 'cela-de-xerife', 'cofre', 'placa-de-procurado', 'escarradeira');
  tem('armazem-geral', 'balcao', 'estante.piso', 'sacos', 'barril');
  tem('banco', 'balcao', 'cofre', 'placa-de-procurado');
  tem('estacao', 'balcao', 'banco.longo', 'caixote', 'relogio.parede');
  tem('estabulo', 'poste-de-amarrar', 'bomba-de-manivela', 'cavalo'); tem('taverna', 'balcao-de-saloon', 'mesa-de-poquer');
  // Fora do gênero, a taverna e o estábulo continuam com o que tinham, e os tipos da época não mobiliam na investigação.
  assert.ok(regrasPara('taverna', 'investigacao').flatMap(r => r.receitas).includes('balcao'));
  assert.ok(!regrasPara('estabulo', 'investigacao').flatMap(r => r.receitas).includes('poste-de-amarrar'));
  assert.ok(!regrasPara('saloon', 'investigacao').flatMap(r => r.receitas).includes('balcao-de-saloon'));
});

test('faroeste: a proposta de mobília de cada tipo usa as receitas da época', () => {
  for (const [f, esperadas] of [['saloon', ['balcao-de-saloon', 'mesa-de-poquer']], ['xerifado', ['mesa-de-xerife']], ['armazem-geral', ['sacos']], ['banco', ['cofre']], ['estacao', ['relogio.parede']], ['estabulo', ['cavalo']]] as const) {
    const m = mapaCom(sala('c', 0, 0, 8, 6, { name: f, function: f })); m.style = { ...m.style, genre: 'faroeste' };
    let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente: 3, gerarId: q => `${q}${++n}` }, 'c')!;
    assert.ok(p, f);
    const usadas = JSON.stringify(p.comandos);
    for (const r of esperadas) assert.ok(usadas.includes(`"${r}"`), `${f}: ${r}`);
  }
});

test('faroeste: conjuntos rua-de-fronteira e deserto-de-cactos citam só itens do acervo', () => {
  for (const id of ['rua-de-fronteira', 'deserto-de-cactos']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) for (const r of receitasDoItem(i)) assert.ok(ACERVO.item(r), `${id}: ${r}`);
  }
  const rua = TODOS_OS_CONJUNTOS.find(x => x.id === 'rua-de-fronteira')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['poste-de-amarrar', 'bomba-de-manivela', 'diligencia', 'carroca-coberta', 'cavalo']) assert.ok(rua.includes(r), r);
  const des = TODOS_OS_CONJUNTOS.find(x => x.id === 'deserto-de-cactos')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['casa:saguaro-a', 'casa:opuntia-a', 'casa:cacto-redondo-grupo', 'casa:arbusto-seco-1m', 'rochedo', 'cranio-de-boi']) assert.ok(des.includes(r), r);
});

test('faroeste: as palavras do nome dão a função, e "banco" e "armazém" só valem na acepção da época', () => {
  for (const [n, f] of [['Saloon', 'saloon'], ['Xerife', 'xerifado'], ['Xerifado', 'xerifado'], ['Delegacia', 'xerifado'], ['Armazém geral', 'armazem-geral'], ['Empório', 'armazem-geral'],
    ['Estação', 'estacao'], ['Estação ferroviária', 'estacao'], ['Rancho', 'estabulo'], ['Banco', 'banco'], ['Banco da Fronteira', 'banco'], ['Banco Nacional', 'banco'],
    ['Armazém do Ben', 'deposito'], ['Banco do jardim', 'sala'], ['Taverna', 'taverna'], ['Estábulo', 'estabulo']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    if (n === 'Banco do jardim') { assert.notEqual(p?.funcao, 'banco', n); continue; }
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
  assert.equal(generoDe('faroeste').id, 'faroeste');
});
