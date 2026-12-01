import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_DE_COMODO, FUNCOES_AO_AR_LIVRE, telhadoPadrao } from '../../src/domain/presets.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { materiaisDo } from '../../src/procedural/materiais.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { MATERIAIS_POR_GENERO, PALETAS_POR_GENERO, propostaDeMobilia } from '../../src/authoring/mobiliar.ts';
import { TODOS_OS_CONJUNTOS, receitasDoItem } from '../../src/authoring/espalhar.ts';
import { LUZES_POR_FUNCAO, LUZES_POR_GENERO, propostaDeLuzes } from '../../src/authoring/luzes.ts';
import { presetDeLuz } from '../../src/domain/presets.ts';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const TIPOS = ['acampamento', 'abrigo', 'enfermaria-improvisada', 'oficina-de-sucata', 'posto-de-guarda'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));
// As medidas são em células de 1,5 m: 3 × 2 dá 13,5 m² e 10 × 8 dá 180 m².
const usadas = (f: string, w: number, h: number, semente = 3) => {
  const m = mapaCom(sala('c', 0, 0, w, h, { name: f, function: f })); m.style = { ...m.style, genre: 'pos-apocaliptico' };
  let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente, gerarId: q => `${q}${++n}` }, 'c')!;
  assert.ok(p, f); return JSON.stringify(p.comandos);
};

test('pós-apocalíptico: os tipos novos existem, têm regras, luz e as receitas das regras existem', () => {
  for (const f of TIPOS) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f], `luz de ${f}`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
});

test('pós-apocalíptico: o acampamento é ao ar livre e sem telhado; os outros têm telhado', () => {
  const m = criarMapa(); m.style.genre = 'pos-apocaliptico';
  assert.ok(FUNCOES_AO_AR_LIVRE.has('acampamento'));
  assert.equal(telhadoPadrao(m, 'acampamento', [[2, 2]]), null);
  assert.ok(LUZES_POR_FUNCAO.acampamento!.semLuz);
  for (const f of TIPOS.filter(x => x !== 'acampamento')) { assert.ok(!FUNCOES_AO_AR_LIVRE.has(f), f); assert.ok(telhadoPadrao(m, f, [[2, 2]])!.material, f); }
  assert.equal(telhadoPadrao(m, 'abrigo', [[2, 2]])!.material, 'laje.equipada');
  assert.equal(telhadoPadrao(m, 'oficina-de-sucata', [[2, 2]])!.material, 'chapa.remendada');
  assert.ok(ids('telhado').has('chapa.remendada') && ids('telhado').has('laje.equipada'));
});

test('pós-apocalíptico: pisos, papéis e paleta do gênero existem', () => {
  const pisos = ids('piso'), papeis = ids('papel'), mats = MATERIAIS_POR_GENERO['pos-apocaliptico']!;
  for (const f of TIPOS) {
    const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!;
    assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f);
    for (const p of mats[f]!.pisos) assert.ok(pisos.has(p), `${f}: piso ${p}`);
    for (const p of mats[f]!.papeis) assert.ok(papeis.has(p), `${f}: papel ${p}`);
  }
  for (const [f, m] of Object.entries(mats)) { for (const p of m.pisos) assert.ok(pisos.has(p), `${f}: piso ${p}`); for (const p of m.papeis) assert.ok(papeis.has(p), `${f}: papel ${p}`); }
  assert.ok(mats['abrigo']!.pisos.includes('concreto.rachado'));
  assert.notEqual(PALETAS_POR_GENERO['pos-apocaliptico'], PALETAS_POR_GENERO.moderno);
});

test('pós-apocalíptico: a mobília traz as receitas do kit; os outros gêneros não as recebem', () => {
  const receitas = (f: string, g = 'pos-apocaliptico') => regrasPara(f, g).flatMap(r => r.receitas);
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('acampamento', 'barraca-improvisada', 'tonel-com-fogo', 'fogareiro', 'gerador-a-diesel', 'tanque-de-agua', 'horta-em-pneus', 'caixa-de-suprimentos', 'placa-pichada');
  tem('abrigo', 'colchao-no-chao', 'caixa-de-suprimentos', 'tanque-de-agua', 'gerador-a-diesel');
  tem('enfermaria-improvisada', 'cama-hospitalar', 'colchao-no-chao', 'caixa-de-suprimentos', 'armario-de-vestiario');
  tem('oficina-de-sucata', 'bancada.ferramentas', 'pneus-empilhados', 'carro.enferrujado', 'gerador-a-diesel');
  tem('posto-de-guarda', 'sacos-de-areia', 'caixa-de-suprimentos', 'tonel-com-fogo', 'placa-pichada');
  for (const g of ['investigacao', 'fantasia', 'moderno']) assert.ok(!receitas('acampamento', g).includes('barraca-improvisada'), g);
  assert.ok(!receitas('oficina-de-sucata', 'moderno').includes('carro.enferrujado'));
});

test('pós-apocalíptico: a proposta de mobília dá um mapa de três cômodos típicos; o que é grande só vem nas áreas maiores', () => {
  for (const [f, esperadas] of [['abrigo', ['colchao-no-chao', 'caixa-de-suprimentos']], ['enfermaria-improvisada', ['cama-hospitalar', 'caixa-de-suprimentos']],
    ['oficina-de-sucata', ['bancada.ferramentas', 'pneus-empilhados']], ['posto-de-guarda', ['sacos-de-areia', 'caixa-de-suprimentos', 'tonel-com-fogo']],
    ['acampamento', ['barraca-improvisada', 'caixa-de-suprimentos']]] as const) {
    const u = usadas(f, 10, 8);
    for (const r of esperadas) assert.ok(u.includes(`"${r}"`), `${f}: ${r}`);
  }
  assert.ok(!usadas('oficina-de-sucata', 3, 2).includes('"carro.enferrujado"'), 'oficina pequena sem carcaça');
  assert.ok(usadas('oficina-de-sucata', 10, 8).includes('"carro.enferrujado"'), 'oficina grande com carcaça');
  assert.ok(!usadas('acampamento', 3, 2).includes('"barraca-improvisada"'), 'acampamento pequeno sem barraca');
});

test('pós-apocalíptico: conjuntos estrada-abandonada e acampamento-de-sobreviventes citam só itens do acervo', () => {
  for (const id of ['estrada-abandonada', 'acampamento-de-sobreviventes']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) { const rs = receitasDoItem(i); assert.ok(rs.length, `${id}: ${JSON.stringify(i)}`); for (const r of rs) assert.ok(ACERVO.item(r), `${id}: ${r}`); }
  }
  const est = TODOS_OS_CONJUNTOS.find(x => x.id === 'estrada-abandonada')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['carro.enferrujado', 'onibus-tombado', 'barricada', 'pneus-empilhados', 'placa-pichada', 'cerca-de-arame-farpado']) assert.ok(est.includes(r), r);
  const acp = TODOS_OS_CONJUNTOS.find(x => x.id === 'acampamento-de-sobreviventes')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['barraca-improvisada', 'tonel-com-fogo', 'fogareiro', 'horta-em-pneus', 'tanque-de-agua', 'gerador-a-diesel', 'torre-de-vigia']) assert.ok(acp.includes(r), r);
});

test('pós-apocalíptico: as palavras do nome dão a função, e "Posto avançado" é posto de guarda, não o posto de gasolina', () => {
  for (const [n, f] of [['Abrigo', 'abrigo'], ['Bunker', 'abrigo'], ['Refúgio', 'abrigo'], ['Acampamento', 'acampamento'], ['Acampamento dos sobreviventes', 'acampamento'],
    ['Sucata', 'oficina-de-sucata'], ['Ferro-velho', 'oficina-de-sucata'], ['Oficina de sucata', 'oficina-de-sucata'],
    ['Posto avançado', 'posto-de-guarda'], ['Posto de guarda', 'posto-de-guarda'], ['Guarita', 'posto-de-guarda'],
    ['Enfermaria improvisada', 'enfermaria-improvisada'], ['Clínica improvisada', 'enfermaria-improvisada'],
    ['Posto', 'posto'], ['Posto de gasolina', 'posto'], ['Enfermaria', 'hospital'], ['Oficina', 'oficina']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
});

test('pós-apocalíptico: herda trocas modernas em banheiro/sala/escritório/quarto e usa luz pequena omnidirecional', () => {
  assert.deepEqual(regrasPara('banheiro', 'pos-apocaliptico').find(r => r.id === 'vaso')?.receitas, ['vaso.moderno']);
  assert.deepEqual(regrasPara('banheiro', 'pos-apocaliptico').find(r => r.id === 'pia')?.receitas, ['balcao']);
  assert.ok(regrasPara('sala', 'pos-apocaliptico').flatMap(r => r.receitas).includes('sofa.canto'));
  assert.deepEqual(regrasPara('escritorio', 'pos-apocaliptico').find(r => r.id === 'escrivaninha')?.receitas, ['escrivaninha.computador']);
  assert.deepEqual(regrasPara('quarto', 'pos-apocaliptico').find(r => r.id === 'armario')?.receitas, ['guarda-roupa.liso']);
  assert.deepEqual(regrasPara('quarto', 'pos-apocaliptico').find(r => r.id === 'cama')?.receitas, ['colchao-no-chao', 'cama.solteiro']);

  const pequena = presetDeLuz(LUZES_POR_GENERO['pos-apocaliptico']!.pequena)!;
  assert.ok(pequena);
  assert.equal(pequena.cone, null);
  const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Abrigo', function: 'abrigo' }));
  m.style = { ...m.style, genre: 'pos-apocaliptico' };
  const prop = propostaDeLuzes({ m, versao: 0, semente: 1, gerarId: q => `${q}1` }, 'a')!;
  assert.equal((prop.comandos[0] as { item: { cone: unknown } }).item.cone, null);
});
