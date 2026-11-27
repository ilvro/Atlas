import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENEROS, TIPOS_DE_COMODO, FUNCOES_AO_AR_LIVRE, estiloDeTelhado, generoDe, generosVisiveis, telhadoPadrao } from '../../src/domain/presets.ts';
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

const TIPOS = ['conves', 'cabine-do-capitao', 'taverna-do-porto', 'fortim', 'casa-colonial'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));

test('colonial: os tipos de cômodo existem, têm regras, luz e as receitas das regras existem', () => {
  assert.ok(GENEROS.some(g => g.id === 'colonial'));
  for (const f of [...TIPOS, 'porao']) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f], `luz de ${f}`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
  assert.ok(FUNCOES_AO_AR_LIVRE.has('conves') && FUNCOES_AO_AR_LIVRE.has('fortim') && !FUNCOES_AO_AR_LIVRE.has('cabine-do-capitao'));
  assert.ok(LUZES_POR_FUNCAO.conves!.semLuz && LUZES_POR_FUNCAO.fortim!.semLuz);
});

test('colonial: pisos e papéis são os da época e existem', () => {
  const pisos = ids('piso'), papeis = ids('papel');
  for (const t of TIPOS_DE_COMODO) {
    const m = MATERIAIS_POR_GENERO.colonial![t.funcao]!;
    for (const p of m.pisos) assert.ok(pisos.has(p), `${t.funcao}: piso ${p}`);
    for (const p of m.papeis) assert.ok(papeis.has(p), `${t.funcao}: papel ${p}`);
  }
  for (const f of TIPOS) { const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!; assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f); }
  const m = MATERIAIS_POR_GENERO.colonial!;
  assert.ok(m.conves!.pisos.includes('tabuas.gastas') && m.fortim!.papeis.includes('pedra.aparelhada') && m['casa-colonial']!.papeis.includes('caiado'));
  assert.notDeepEqual(PALETAS_POR_GENERO.colonial, PALETAS_POR_GENERO.investigacao);
  assert.notDeepEqual(MATERIAIS_POR_GENERO.colonial!.sala, MATERIAIS_POR_GENERO.investigacao!.sala);
});

test('colonial: o telhado do gênero é a casa colonial de telha de barro', () => {
  const m = criarMapa(); m.style.genre = 'colonial';
  assert.equal(telhadoPadrao(m, 'sala', [[2, 2]])!.material, 'telha.barro');
  assert.equal(telhadoPadrao(m, 'conves', [[2, 2]]), null);
  assert.equal(telhadoPadrao(m, 'fortim', [[2, 2]]), null);
  assert.ok(ids('telhado').has(estiloDeTelhado('casa-colonial')!.roof.material!));
});

test('colonial: a mobília traz as receitas da época, e o gênero aceita as receitas que herda', () => {
  const receitas = (f: string) => regrasPara(f, 'colonial').flatMap(r => r.receitas);
  const aceitos = generosVisiveis('colonial');
  for (const f of [...TIPOS, 'porao', 'taverna', 'quarto', 'escritorio', 'deposito', 'loja']) for (const n of receitas(f)) { const g = ACERVO.item(n)!.generos ?? []; assert.ok(!g.length || g.some(x => aceitos.includes(x)), `${f}: ${n}`); }
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('conves', 'timao', 'mastro', 'canhao-naval', 'barril-de-rum', 'rolo-de-corda', 'bandeira-pirata');
  tem('cabine-do-capitao', 'mesa-de-cartografo', 'bau-de-tesouro', 'mapa-do-tesouro', 'luneta-e-sextante', 'rede-de-dormir', 'estante');
  tem('taverna-do-porto', 'mesa.taverna', 'barril-de-rum', 'balcao');
  tem('fortim', 'canhao-de-forte', 'pilha-de-balas', 'sino-de-cais', 'bandeira-pirata');
  tem('casa-colonial', 'oratorio', 'rede-de-dormir', 'botica', 'bau');
  tem('porao', 'barril-de-rum', 'fardos-de-acucar'); tem('quarto', 'rede-de-dormir'); tem('loja', 'botica');
  // Fora do gênero, o porão continua com o que tinha, e os tipos da época não mobiliam na investigação.
  assert.ok(regrasPara('porao', 'investigacao').flatMap(r => r.receitas).includes('caixa'));
  assert.ok(!regrasPara('porao', 'investigacao').flatMap(r => r.receitas).includes('barril-de-rum'));
  assert.ok(!regrasPara('conves', 'investigacao').flatMap(r => r.receitas).includes('timao'));
});

test('colonial: a proposta de mobília de cada tipo usa as receitas da época', () => {
  for (const [f, esperadas] of [['conves', ['mastro', 'canhao-naval']], ['cabine-do-capitao', ['mesa-de-cartografo', 'bau-de-tesouro']], ['taverna-do-porto', ['barril-de-rum']], ['fortim', ['canhao-de-forte']], ['casa-colonial', ['oratorio']], ['porao', ['barril-de-rum']]] as const) {
    const m = mapaCom(sala('c', 0, 0, 8, 6, { name: f, function: f })); m.style = { ...m.style, genre: 'colonial' };
    let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente: 3, gerarId: q => `${q}${++n}` }, 'c')!;
    assert.ok(p, f);
    const usadas = JSON.stringify(p.comandos);
    for (const r of esperadas) assert.ok(usadas.includes(`"${r}"`) || (f === 'porao' && usadas.includes('fardos-de-acucar')), `${f}: ${r}`);
  }
});

test('colonial: conjuntos enseada e tesouro-espalhado citam só itens do acervo', () => {
  for (const id of ['enseada', 'tesouro-espalhado']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) for (const r of receitasDoItem(i)) assert.ok(ACERVO.item(r), `${id}: ${r}`);
  }
  const en = TODOS_OS_CONJUNTOS.find(x => x.id === 'enseada')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['casa:coqueiro-4m', 'canoa', 'cabana-de-palha', 'rede-de-pesca', 'barril', 'rolo-de-corda', 'ancora']) assert.ok(en.includes(r), r);
  const te = TODOS_OS_CONJUNTOS.find(x => x.id === 'tesouro-espalhado')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['bau-de-tesouro', 'moedas-espalhadas', 'ossada', 'bandeira-pirata']) assert.ok(te.includes(r), r);
});

test('colonial: as palavras do nome dão a função, e "forte", "cabine" e "casa grande" só valem na acepção da época', () => {
  for (const [n, f] of [['Convés', 'conves'], ['Convés principal', 'conves'], ['Cabine do capitão', 'cabine-do-capitao'], ['Camarote do capitão', 'cabine-do-capitao'], ['Cabine', 'cabine-do-capitao'],
    ['Porão', 'porao'], ['Porão de carga', 'porao'], ['Fortim', 'fortim'], ['Fortaleza', 'fortim'], ['Forte', 'fortim'], ['Forte São José', 'fortim'], ['Taverna do porto', 'taverna-do-porto'],
    ['Taverna', 'taverna'], ['Casa colonial', 'casa-colonial'], ['Casa grande', 'casa-colonial']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
  for (const n of ['Sala forte', 'Cofre forte', 'Cabine de teste']) { const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!); assert.ok(!['fortim', 'cabine-do-capitao'].includes(p?.funcao ?? ''), n); }
  assert.equal(generoDe('colonial').id, 'colonial');
});
