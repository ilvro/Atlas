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

const TIPOS = ['fabrica', 'oficina-de-inventor', 'clube', 'estacao-de-dirigivel'];
const ids = (uso: Parameters<typeof materiaisDo>[0]) => new Set(materiaisDo(uso).map(m => m.id));
// As medidas são em células de 1,5 m: 3 × 2 dá 13,5 m² e 10 × 8 dá 180 m².
const usadas = (f: string, w: number, h: number, semente = 3) => {
  const m = mapaCom(sala('c', 0, 0, w, h, { name: f, function: f })); m.style = { ...m.style, genre: 'vitoriano' };
  let n = 0; const p = propostaDeMobilia({ m, versao: 0, semente, gerarId: q => `${q}${++n}` }, 'c')!;
  assert.ok(p, f); return JSON.stringify(p.comandos);
};

test('vitoriano: os tipos de cômodo existem, têm regras, luz e as receitas das regras existem', () => {
  assert.ok(GENEROS.some(g => g.id === 'vitoriano'));
  for (const f of TIPOS) {
    assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f && t.id === f), f);
    assert.ok(REGRAS_DE_MOBILIA[f]?.length, `regras de ${f}`);
    assert.ok(LUZES_POR_FUNCAO[f] && !LUZES_POR_FUNCAO[f]!.semLuz, `luz de ${f}`);
    assert.ok(!FUNCOES_AO_AR_LIVRE.has(f), `${f} tem telhado`);
    for (const r of REGRAS_DE_MOBILIA[f]!) for (const n of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) assert.ok(ACERVO.item(n), `${f}/${r.id}: ${n}`);
  }
});

test('vitoriano: pisos e papéis são os da época e existem; as salas comuns diferem da investigação', () => {
  const pisos = ids('piso'), papeis = ids('papel');
  for (const t of TIPOS_DE_COMODO) {
    const m = MATERIAIS_POR_GENERO.vitoriano![t.funcao]!;
    for (const p of m.pisos) assert.ok(pisos.has(p), `${t.funcao}: piso ${p}`);
    for (const p of m.papeis) assert.ok(papeis.has(p), `${t.funcao}: papel ${p}`);
  }
  for (const f of TIPOS) { const t = TIPOS_DE_COMODO.find(x => x.funcao === f)!; assert.ok(pisos.has(t.piso) && papeis.has(t.papel), f); }
  const m = MATERIAIS_POR_GENERO.vitoriano!;
  assert.ok(m.fabrica!.papeis.includes('tijolo.fuligem') && m.clube!.papeis.includes('papel.damasco-vinho'));
  assert.notDeepEqual(PALETAS_POR_GENERO.vitoriano, PALETAS_POR_GENERO.investigacao);
  for (const f of ['sala', 'escritorio']) assert.notDeepEqual(m[f], MATERIAIS_POR_GENERO.investigacao![f], f);
});

test('vitoriano: o telhado do gênero é de ardósia, e a fábrica tem galpão de chapa (nenhum dos quatro é ao ar livre)', () => {
  const m = criarMapa(); m.style.genre = 'vitoriano';
  assert.equal(telhadoPadrao(m, 'sala', [[2, 2]])!.material, 'telha.ardosia');
  for (const f of TIPOS) assert.ok(telhadoPadrao(m, f, [[2, 2]])!.material, f);
  assert.equal(telhadoPadrao(m, 'fabrica', [[2, 2]])!.material, 'telha.chapa.cinza');
  assert.ok(ids('telhado').has(estiloDeTelhado('sobrado-de-mansarda')!.roof.material!));
});

test('vitoriano: a mobília traz as receitas da época, e o gênero aceita as receitas que herda', () => {
  const receitas = (f: string) => regrasPara(f, 'vitoriano').flatMap(r => r.receitas);
  const aceitos = generosVisiveis('vitoriano');
  for (const f of [...TIPOS, 'sala', 'escritorio', 'oficina', 'porao']) for (const n of receitas(f)) { const g = ACERVO.item(n)!.generos ?? []; assert.ok(!g.length || g.some(x => aceitos.includes(x)), `${f}: ${n}`); }
  const tem = (f: string, ...n: string[]) => { for (const x of n) assert.ok(receitas(f).includes(x), `${f} sem ${x}`); };
  tem('fabrica', 'caldeira', 'maquina-a-vapor', 'tear-mecanico', 'prensa', 'esteira', 'engrenagens', 'tubulacao.cobre', 'painel-de-manometros');
  tem('oficina-de-inventor', 'bancada-de-inventor', 'automato', 'bobina-de-tesla', 'engrenagens.parede', 'gramofone');
  tem('clube', 'lareira.nobre', 'poltrona.capitone', 'mesa.bilhar', 'gramofone', 'aparador', 'relogio.pe');
  tem('estacao-de-dirigivel', 'banca-de-jornal', 'relogio-de-rua', 'esteira', 'painel-de-manometros');
  tem('sala', 'gramofone'); tem('escritorio', 'automato', 'engrenagens.parede'); tem('oficina', 'bancada-de-inventor'); tem('porao', 'sacos');
  assert.ok(!receitas('estacao-de-dirigivel').includes('dirigivel'), 'o dirigível fica fora do salão');
  // Fora do gênero, a sala não ganha o gramofone, e o moderno (que não herda o vitoriano) não mobilia a fábrica.
  assert.ok(!regrasPara('sala', 'investigacao').flatMap(r => r.receitas).includes('gramofone'));
  assert.ok(!regrasPara('fabrica', 'moderno').flatMap(r => r.receitas).includes('caldeira'));
});

test('vitoriano: a proposta de mobília de cada tipo usa as receitas da época; as máquinas grandes só vêm nas áreas maiores', () => {
  for (const [f, esperadas] of [['fabrica', ['caldeira', 'tear-mecanico']], ['oficina-de-inventor', ['bancada-de-inventor']], ['clube', ['lareira.']], ['estacao-de-dirigivel', ['relogio-de-rua']]] as const) {
    const u = usadas(f, 10, 8);
    for (const r of esperadas) assert.ok(u.includes(r.endsWith('.') ? `"${r}` : `"${r}"`), `${f}: ${r}`);
  }
  assert.ok(!usadas('fabrica', 3, 2).includes('maquina-a-vapor'), 'fábrica pequena sem máquina a vapor');
  assert.ok(!usadas('fabrica', 3, 2).includes('tear-mecanico'), 'fábrica pequena sem tear');
  assert.ok(usadas('fabrica', 10, 8).includes('maquina-a-vapor'), 'fábrica grande com máquina a vapor');
  assert.ok(!usadas('oficina-de-inventor', 3, 2).includes('bobina-de-tesla') && usadas('oficina-de-inventor', 10, 8).includes('bobina-de-tesla'));
});

test('vitoriano: conjuntos rua-de-paralelepipedo e patio-de-fabrica citam só itens do acervo', () => {
  for (const id of ['rua-de-paralelepipedo', 'patio-de-fabrica']) {
    const c = TODOS_OS_CONJUNTOS.find(x => x.id === id)!; assert.ok(c, id);
    for (const i of c.itens) for (const r of receitasDoItem(i)) assert.ok(ACERVO.item(r), `${id}: ${r}`);
  }
  const rua = TODOS_OS_CONJUNTOS.find(x => x.id === 'rua-de-paralelepipedo')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['lampiao-a-gas', 'banca-de-jornal', 'relogio-de-rua', 'carruagem-fechada']) assert.ok(rua.includes(r), r);
  const pat = TODOS_OS_CONJUNTOS.find(x => x.id === 'patio-de-fabrica')!.itens.flatMap(i => receitasDoItem(i));
  for (const r of ['chamine-industrial', 'tubulacao.cobre', 'esteira', 'carroca', 'caixote', 'barril', 'sacos']) assert.ok(pat.includes(r), r);
});

test('vitoriano: as palavras do nome dão a função, e "oficina" sozinha, "caldeira" e "clube" soltos não confundem', () => {
  for (const [n, f] of [['Fábrica', 'fabrica'], ['Fábrica de tecidos', 'fabrica'], ['Tecelagem', 'fabrica'], ['Usina', 'fabrica'], ['Sala da caldeira', 'fabrica'], ['Casa das caldeiras', 'fabrica'],
    ['Oficina de inventor', 'oficina-de-inventor'], ['Oficina do inventor', 'oficina-de-inventor'], ['Laboratório de inventor', 'oficina-de-inventor'], ['Oficina', 'oficina'], ['Oficina do Hugo', 'oficina'],
    ['Estação de dirigível', 'estacao-de-dirigivel'], ['Doca do dirigível', 'estacao-de-dirigivel'], ['Dirigível', 'estacao-de-dirigivel'], ['Estação', 'estacao'],
    ['Clube', 'clube'], ['Clube de cavalheiros', 'clube']] as const) {
    const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: n })), 'c')!);
    assert.equal(p?.funcao, f, n); assert.equal(p!.motivo, 'nome');
  }
  const p = funcaoProvavel(insightDoComodo(mapaCom(sala('c', 0, 0, 4, 3, { name: 'Caldeira de cobre' })), 'c')!); assert.notEqual(p?.funcao, 'fabrica');
  assert.equal(generoDe('vitoriano').id, 'vitoriano');
});
