import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TIPOS_DE_COMODO, FUNCOES_AO_AR_LIVRE, telhadoPadrao } from '../../src/domain/presets.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { materiaisDo } from '../../src/procedural/materiais.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { MATERIAIS_POR_GENERO, propostaDeMobilia } from '../../src/authoring/mobiliar.ts';
import { TODOS_OS_CONJUNTOS, receitasDoItem } from '../../src/authoring/espalhar.ts';
import { LUZES_POR_FUNCAO } from '../../src/authoring/luzes.ts';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { mapaCom, sala } from './apoio-casa.ts';

const TIPOS = ['mercado', 'lanchonete', 'garagem', 'posto', 'vestiario'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));
// As medidas são em células de 1,5 m: 3 × 2 dá 13,5 m² e 10 × 8 dá 180 m².
const usadas = (f: string, w: number, h: number, semente = 3) => {
  const m = mapaCom(sala('c', 0, 0, w, h, { name: f, function: f })); m.style = { ...m.style, genre: 'moderno' };
  let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente, gerarId: q => `${q}${++n}` }, 'c')!;
  assert.ok(p, f); return JSON.stringify(p.comandos);
};

test('moderno: os tipos novos existem, têm regras, luz, telhado e as receitas das regras existem', () => {
  for (const f of TIPOS) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f] && !LUZES_POR_FUNCAO[f]!.semLuz, `luz de ${f}`);
    assert.ok(!FUNCOES_AO_AR_LIVRE.has(f), `${f} tem telhado`);
  }
  for (const f of [...TIPOS, 'escritorio', 'hospital']) for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  // A enfermaria já existia (função `hospital`): não ganha tipo duplicado.
  assert.ok(!TIPOS_DE_COMODO.some(t => t.funcao === 'enfermaria'));
});

test('moderno: pisos e papéis dos tipos novos existem', () => {
  const pisos = ids('piso'), papeis = ids('papel');
  for (const f of TIPOS) {
    const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!, m = MATERIAIS_POR_GENERO.moderno![f]!;
    assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f);
    for (const p of m.pisos) assert.ok(pisos.has(p), `${f}: piso ${p}`);
    for (const p of m.papeis) assert.ok(papeis.has(p), `${f}: papel ${p}`);
  }
  assert.ok(MATERIAIS_POR_GENERO.moderno!.lanchonete!.pisos.includes('ladrilho.xadrez'));
});

test('moderno: telhado de laje, e a garagem de galpão de zinco (nenhum é ao ar livre)', () => {
  const m = criarMapa(); m.style.genre = 'moderno';
  for (const f of TIPOS) assert.ok(telhadoPadrao(m, f, [[2, 2]])!.material, f);
  assert.equal(telhadoPadrao(m, 'garagem', [[2, 2]])!.material, telhadoPadrao(m, 'oficina', [[2, 2]])!.material);
  assert.notEqual(telhadoPadrao(m, 'garagem', [[2, 2]])!.material, telhadoPadrao(m, 'mercado', [[2, 2]])!.material);
});

test('moderno: a mobília traz as receitas do kit urbano; os outros gêneros não as recebem', () => {
  const receitas = (f: string, g = 'moderno') => regrasPara(f, g).flatMap(r => r.receitas);
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('mercado', 'gondola', 'freezer', 'caixa-registradora');
  tem('lanchonete', 'mesa-de-lanchonete', 'balcao', 'maquina-de-venda');
  tem('garagem', 'carro.sedan', 'bancada.ferramentas', 'barril');
  tem('posto', 'gondola', 'freezer', 'caixa-registradora', 'maquina-de-venda');
  tem('vestiario', 'armario-de-vestiario', 'banco');
  tem('escritorio', 'estacao-de-trabalho', 'divisoria', 'copiadora', 'bebedouro.galao');
  tem('hospital', 'cama-hospitalar', 'armario-de-vestiario');
  assert.ok(!receitas('posto').includes('bomba-de-gasolina'), 'as bombas ficam fora');
  for (const g of ['investigacao', 'fantasia', 'vitoriano']) {
    assert.ok(!receitas('escritorio', g).includes('estacao-de-trabalho'), g);
    assert.ok(!receitas('hospital', g).includes('cama-hospitalar'), g);
    assert.equal(receitas('mercado', g).length, 0, g);
  }
});

test('moderno: a proposta de mobília de cada tipo usa as receitas do kit; o que é grande só vem nas áreas maiores', () => {
  for (const [f, esperadas] of [['mercado', ['gondola', 'freezer', 'caixa-registradora']], ['lanchonete', ['mesa-de-lanchonete']], ['garagem', ['carro.', 'bancada.ferramentas']],
    ['posto', ['caixa-registradora', 'gondola']], ['vestiario', ['armario-de-vestiario']], ['escritorio', ['estacao-de-trabalho']], ['hospital', ['cama-hospitalar']]] as const) {
    const u = usadas(f, 10, 8);
    for (const r of esperadas) assert.ok(u.includes(r.endsWith('.') ? `"${r}` : `"${r}"`), `${f}: ${r}`);
  }
  assert.ok(!usadas('garagem', 3, 2).includes('"carro.'), 'garagem pequena sem carro');
  assert.ok(!usadas('mercado', 3, 2).includes('"freezer"'), 'mercado pequeno sem freezer');
  assert.ok(!usadas('escritorio', 3, 2).includes('"divisoria"'), 'escritório pequeno sem divisória');
  assert.ok(usadas('escritorio', 10, 8).includes('"divisoria"'), 'escritório grande com divisória');
});

test('moderno: conjuntos rua-urbana e estacionamento citam só itens do acervo', () => {
  for (const id of ['rua-urbana', 'estacionamento']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) { const rs = receitasDoItem(i); assert.ok(rs.length, `${id}: ${JSON.stringify(i)}`); for (const r of rs) assert.ok(ACERVO.item(r), `${id}: ${r}`); }
  }
  const rua = TODOS_OS_CONJUNTOS.find(x => x.id === 'rua-urbana')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['semaforo', 'hidrante', 'lixeira', 'ponto-de-onibus', 'orelhao', 'cone', 'carro.sedan']) assert.ok(rua.includes(r), r);
  const est = TODOS_OS_CONJUNTOS.find(x => x.id === 'estacionamento')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['carro.hatch', 'cacamba', 'cone', 'barreira']) assert.ok(est.includes(r), r);
});

test('moderno: as palavras do nome dão a função, e "posto" só vale em nome inteiro ou de gasolina', () => {
  for (const [n, f] of [['Lanchonete', 'lanchonete'], ['Diner', 'lanchonete'], ['Cafeteria', 'lanchonete'], ['Mercado', 'mercado'], ['Supermercado', 'mercado'], ['Garagem', 'garagem'], ['Garagem do Hugo', 'garagem'],
    ['Vestiário', 'vestiario'], ['Posto', 'posto'], ['Posto de gasolina', 'posto'], ['Posto de combustível', 'posto'], ['Loja de conveniência', 'posto'],
    ['Enfermaria', 'hospital'], ['Escritório', 'escritorio'], ['Mercearia', 'loja'], ['Oficina', 'oficina']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
  for (const n of ['Posto avançado', 'Posto de guarda', 'Posto de vigia']) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!); assert.notEqual(p?.funcao, 'posto', n);
  }
});
