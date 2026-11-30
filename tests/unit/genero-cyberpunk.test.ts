import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_DE_COMODO, FUNCOES_AO_AR_LIVRE, telhadoPadrao } from '../../src/domain/presets.ts';
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

const TIPOS = ['clinica-clandestina', 'bar', 'hotel-capsula', 'sala-de-servidores', 'mercado-noturno'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));
// As medidas são em células de 1,5 m: 3 × 2 dá 13,5 m² e 10 × 8 dá 180 m².
const usadas = (f: string, w: number, h: number, semente = 3) => {
  const m = mapaCom(sala('c', 0, 0, w, h, { name: f, function: f })); m.style = { ...m.style, genre: 'cyberpunk' };
  let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente, gerarId: q => `${q}${++n}` }, 'c')!;
  assert.ok(p, f); return JSON.stringify(p.comandos);
};

test('cyberpunk: os tipos novos existem, têm regras, luz e as receitas das regras existem', () => {
  for (const f of TIPOS) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f], `luz de ${f}`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
});

test('cyberpunk: o mercado noturno é ao ar livre e sem telhado; os outros têm laje equipada', () => {
  const m = criarMapa(); m.style.genre = 'cyberpunk';
  assert.ok(FUNCOES_AO_AR_LIVRE.has('mercado-noturno'));
  assert.equal(telhadoPadrao(m, 'mercado-noturno', [[2, 2]]), null);
  assert.ok(LUZES_POR_FUNCAO['mercado-noturno']!.semLuz);
  for (const f of TIPOS.filter(x => x !== 'mercado-noturno')) { assert.ok(!FUNCOES_AO_AR_LIVRE.has(f), f); assert.equal(telhadoPadrao(m, f, [[2, 2]])!.material, 'laje.equipada', f); }
  assert.ok(ids('telhado').has('laje.equipada'));
});

test('cyberpunk: pisos, papéis e paleta do gênero existem', () => {
  const pisos = ids('piso'), papeis = ids('papel'), mats = MATERIAIS_POR_GENERO.cyberpunk!;
  for (const f of TIPOS) {
    const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!;
    assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f);
    for (const p of mats[f]!.pisos) assert.ok(pisos.has(p), `${f}: piso ${p}`);
    for (const p of mats[f]!.papeis) assert.ok(papeis.has(p), `${f}: papel ${p}`);
  }
  for (const [f, m] of Object.entries(mats)) { for (const p of m.pisos) assert.ok(pisos.has(p), `${f}: piso ${p}`); for (const p of m.papeis) assert.ok(papeis.has(p), `${f}: papel ${p}`); }
  assert.ok(mats['bar']!.pisos.includes('piso.neon') && mats['sala-de-servidores']!.pisos.includes('grade.cyber'));
  const pal = PALETAS_POR_GENERO.cyberpunk!;
  assert.notEqual(pal, PALETAS_POR_GENERO.moderno);
  const objetos = ids('objeto');
  for (const p of pal) for (const x of [p.madeira, p.tapete, ...p.tecidos]) assert.ok(objetos.has(x), x);
});

test('cyberpunk: a mobília traz as receitas do kit; os outros gêneros não as recebem', () => {
  const receitas = (f: string, g = 'cyberpunk') => regrasPara(f, g).flatMap(r => r.receitas);
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('clinica-clandestina', 'cadeira-de-implante', 'cama-hospitalar', 'estacao-hacker', 'rack-de-servidores', 'letreiro-neon');
  tem('bar', 'balcao-luminoso', 'cadeira', 'fliperama', 'maquina-de-venda.neon', 'letreiro-neon', 'holograma');
  tem('hotel-capsula', 'capsula-de-hotel', 'armario-de-vestiario', 'maquina-de-venda.neon', 'bebedouro.galao');
  tem('sala-de-servidores', 'rack-de-servidores', 'gaiola-de-cabos', 'estacao-hacker', 'quadro-de-cabos');
  tem('mercado-noturno', 'barraca-de-lamen', 'letreiro-neon.rua', 'maquina-de-venda.neon', 'poste-com-telas', 'lixeira', 'caixote');
  tem('taverna', 'balcao-luminoso');
  assert.ok(!receitas('taverna').includes('tapecaria'));
  for (const g of ['investigacao', 'fantasia']) { assert.ok(!receitas('bar', g).includes('balcao-luminoso'), g); assert.ok(!receitas('sala-de-servidores', g).includes('gaiola-de-cabos'), g); }
  assert.ok(!receitas('taverna', 'fantasia').includes('balcao-luminoso'));
});

test('cyberpunk: a proposta de mobília dá o que cabe; o que é grande só vem nas áreas maiores', () => {
  for (const [f, esperadas] of [['clinica-clandestina', ['cadeira-de-implante', 'cama-hospitalar']], ['bar', ['balcao-luminoso', 'letreiro-neon']],
    ['hotel-capsula', ['capsula-de-hotel', 'maquina-de-venda.neon']], ['sala-de-servidores', ['rack-de-servidores', 'quadro-de-cabos']],
    ['mercado-noturno', ['barraca-de-lamen', 'letreiro-neon.rua']]] as const) {
    const u = usadas(f, 10, 8);
    for (const r of esperadas) assert.ok(u.includes(`"${r}"`), `${f}: ${r}`);
  }
  assert.ok(!usadas('bar', 3, 2).includes('"holograma"'), 'bar pequeno sem holograma');
  assert.ok(usadas('sala-de-servidores', 10, 8).includes('"gaiola-de-cabos"'), 'sala grande com gaiola');
  assert.ok(!usadas('sala-de-servidores', 3, 2).includes('"gaiola-de-cabos"'), 'sala pequena sem gaiola');
  assert.ok(!usadas('mercado-noturno', 3, 2).includes('"barraca-de-lamen"'), 'mercado pequeno sem barraca');
});

test('cyberpunk: conjuntos beco-de-neon e mercado-noturno citam só itens do acervo', () => {
  for (const id of ['beco-de-neon', 'mercado-noturno']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) { const rs = receitasDoItem(i); assert.ok(rs.length, `${id}: ${JSON.stringify(i)}`); for (const r of rs) assert.ok(ACERVO.item(r), `${id}: ${r}`); }
  }
  const beco = TODOS_OS_CONJUNTOS.find(x => x.id === 'beco-de-neon')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['letreiro-neon.rua', 'cacamba', 'lixeira', 'quadro-de-cabos', 'antena-parabolica', 'drone']) assert.ok(beco.includes(r), r);
  const mer = TODOS_OS_CONJUNTOS.find(x => x.id === 'mercado-noturno')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['barraca-de-lamen', 'letreiro-neon.rua', 'poste-com-telas', 'maquina-de-venda.neon', 'holograma']) assert.ok(mer.includes(r), r);
});

test('cyberpunk: as palavras do nome dão a função; "Clínica improvisada" e "Bar" mantêm o que já eram', () => {
  for (const [n, f] of [['Clínica clandestina', 'clinica-clandestina'], ['Clínica de implantes', 'clinica-clandestina'], ['Ripperdoc', 'clinica-clandestina'],
    ['Covil hacker', 'sala-de-servidores'], ['Toca do hacker', 'sala-de-servidores'], ['Servidores', 'sala-de-servidores'], ['Sala de servidores', 'sala-de-servidores'], ['Data center', 'sala-de-servidores'],
    ['Hotel cápsula', 'hotel-capsula'], ['Cápsulas', 'hotel-capsula'], ['Bar de néon', 'bar'], ['Boteco', 'bar'], ['Neon bar', 'bar'],
    ['Mercado noturno', 'mercado-noturno'], ['Feira noturna', 'mercado-noturno'],
    ['Clínica improvisada', 'enfermaria-improvisada'], ['Enfermaria', 'hospital'], ['Mercado', 'mercado'], ['Bar', 'taverna'], ['Taverna', 'taverna']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
});
