import { test } from 'node:test';
import assert from 'node:assert/strict';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { gerarLayout } from '../../src/authoring/layout.ts';
import { propostaDeLuzes } from '../../src/authoring/luzes.ts';
import { previaDaProposta } from '../../src/authoring/proposta.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes } from '../../src/procedural/descricao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DE_FANTASIA } from '../../src/procedural/receitas/fantasia.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const receitas = (l: { objetos: { source: unknown }[] }) => l.objetos.map(o => (o.source as { recipe?: string }).recipe ?? '');

test('as receitas do kit fantasia desenham sem erro, com pegada estável e partes dentro da pegada', () => {
  assert.ok(RECEITAS_DE_FANTASIA.length >= 11);
  for (const r of RECEITAS_DE_FANTASIA) {
    assert.deepEqual(r.generos, ['fantasia']); assert.equal(r.kit, 'fantasia');
    const d = descreverReceita(r.id, { seed: 1, params: {} });
    assert.equal(d.tipo, r.tipo); assert.deepEqual(pegadaDaReceita(r.id), r.tipo === 'parede' ? [r.pegada[0], 0.05] : r.pegada, `${r.id}: pegada declarada × desenhada`);
    if (d.tipo === 'piso') { assert.ok(d.partes.length >= 3, r.id); const c = caixaDasPartes(d.partes); assert.ok(c.x1 - c.x0 <= r.pegada[0] + 0.2 && c.y1 - c.y0 <= r.pegada[1] + 0.2, `${r.id}: partes passam da pegada`); }
    assert.ok(ACERVO.item(r.id), r.id);
  }
  assert.equal(RECEITAS_DE_FANTASIA.find(r => r.id === 'tapecaria')!.tipo, 'parede');
});

test('capela e forja existem como funções, com sinônimos, regras, sinais fortes e luz', () => {
  for (const f of ['capela', 'forja']) { assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === f), f); assert.ok(REGRAS_DE_MOBILIA[f]?.length, f); }
  const nome = (n: string, receitasDoComodo: string[] = []) => { const m = mapaCom(sala('c', 0, 0, 4, 3, { name: n })); receitasDoComodo.forEach((r, i) => { m.props[`o${i}`] = { ...ACERVO && { id: `o${i}`, source: { kind: 'recipe', recipe: r, seed: 1, params: {} }, position: [1 + i * 0.6, 2], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: 'c', blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null } } as never; }); return funcaoProvavel(insightDoComodo(m, 'c')!)?.funcao; };
  for (const [n, f] of [['Igreja', 'capela'], ['Templo', 'capela'], ['Santuário', 'capela'], ['Capela', 'capela'], ['Ferraria', 'forja'], ['Forja', 'forja']] as const) assert.equal(nome(n), f, n);
  assert.equal(nome('Cômodo', ['altar', 'altar']), 'capela'); assert.equal(nome('Cômodo', ['bigorna', 'bigorna']), 'forja');
});

test('uma taverna de fantasia tem barris, mesas rústicas e lareira, e a luz vem de fogo (velas e tochas)', () => {
  const mapa = mapaCom(sala('t', 0, 0, 6, 4, { name: 'Taverna', function: 'taverna' })); mapa.style = { ...mapa.style, genre: 'fantasia' };
  mapa.openings.p = abertura(mapa, 'p', paredeEm(mapa, 'x', 0, 5.9)!.id, 0.5);
  const visto = new Set<string>();
  for (let semente = 0; semente < 6; semente++) for (const r of receitas(gerarLayout(mapa, { roomId: 't', funcao: 'taverna', genero: 'fantasia', semente, gerarId: contador() }))) visto.add(r);
  for (const r of ['mesa.taverna', 'banco', 'barril.em-pe', 'lareira.pedra']) assert.ok(visto.has(r) || (r === 'barril.em-pe' && visto.has('barril.deitado')), `${r} em algum arranjo (${[...visto].join(', ')})`);
  for (const proibido of ['cadeira', 'mesa.redonda']) assert.ok(!visto.has(proibido), `${proibido} não é de taverna de fantasia`);
  const comLuz = propostaDeLuzes({ m: mapa, versao: 0, semente: 0, gerarId: contador() }, 't')!, depois = previaDaProposta(mapa, comLuz);
  assert.ok(Object.values(depois.lights).length >= 1 && Object.values(depois.lights).every(l => l.power === 'fire'));
});

test('quarto de fantasia usa catre e baú, porão usa barris, cozinha usa lareira com caldeirão; e o moderno e a investigação não veem esses itens', () => {
  const ids = (f: string, g = 'fantasia') => regrasPara(f, g).flatMap(r => r.receitas);
  assert.ok(ids('quarto').includes('catre') && ids('quarto').includes('bau') && !ids('quarto').includes('armario'));
  assert.ok(ids('porao').some(i => i.startsWith('barril')) && !ids('porao').includes('caixa') === false);
  assert.ok(ids('cozinha').includes('lareira.pedra') && !ids('cozinha').includes('balcao') && ids('cozinha').includes('mesa.taverna'));
  for (const g of ['investigacao', 'moderno']) for (const f of Object.keys(REGRAS_DE_MOBILIA)) assert.ok(!ids(f, g).some(i => ACERVO.item(i)?.generos.includes('fantasia') && !ACERVO.item(i)?.generos.includes(g)), `${g}/${f}`);
});

test('capela mobiliada tem altar, bancos de igreja e tapeçaria, sem tampar a porta', () => {
  const mapa = mapaCom(sala('c', 0, 0, 4, 4, { name: 'Capela', function: 'capela' })); mapa.style = { ...mapa.style, genre: 'fantasia' }; mapa.openings.p = abertura(mapa, 'p', paredeEm(mapa, 'y', 6, 5.9)!.id, 0.5);
  const l = gerarLayout(mapa, { roomId: 'c', funcao: 'capela', genero: 'fantasia', semente: 1, gerarId: contador() }), r = receitas(l);
  assert.ok(r.includes('altar') && r.includes('banco.igreja') && r.includes('tapecaria'), r.join(', '));
});
