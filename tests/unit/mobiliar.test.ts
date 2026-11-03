import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MATERIAIS_POR_GENERO, PALETAS_POR_GENERO, paletaDe, paramsDaPaleta, propostaDeMobilia } from '../../src/authoring/mobiliar.ts';
import { previaDaProposta } from '../../src/authoring/proposta.ts';
import { proximaSugestao, type Contexto } from '../../src/authoring/sugestoes.ts';
import { GENEROS, TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { materialDe, MATERIAIS } from '../../src/procedural/materiais.ts';
import { receitaDe } from '../../src/procedural/receitas.ts';
import type { Objeto } from '../../src/domain/mapa.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const quarto = (extra: Parameters<typeof sala>[5] = {}) => { const m = mapaCom(sala('q', 0, 0, 4, 3, { name: 'Quarto', function: 'quarto', ...extra })); m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 0, 4.4)!.id, 0.5); return m; };
const ctx = (m: ReturnType<typeof quarto>, semente = 0): Contexto => ({ m, versao: 0, semente, gerarId: contador() });

test('todos os materiais das tabelas existem, com o uso certo', () => {
  for (const [genero, porFuncao] of Object.entries(MATERIAIS_POR_GENERO)) for (const [funcao, mats] of Object.entries(porFuncao)) {
    assert.ok(mats.pisos.length && mats.papeis.length, `${genero}/${funcao}`);
    for (const id of mats.pisos) { assert.ok(MATERIAIS[id], id); assert.equal(materialDe(id).uso, 'piso', id); }
    for (const id of mats.papeis) { assert.ok(MATERIAIS[id], id); assert.equal(materialDe(id).uso, 'papel', id); }
  }
  for (const [genero, paletas] of Object.entries(PALETAS_POR_GENERO)) for (const p of paletas) {
    for (const id of [p.madeira, p.tapete, ...p.tecidos]) { assert.ok(MATERIAIS[id], `${genero}/${id}`); assert.equal(materialDe(id).uso, 'objeto', id); }
    assert.equal(p.tecidos[1], 'tecido.linho', 'o segundo tecido é o linho das toalhas');
  }
  assert.deepEqual(Object.keys(MATERIAIS_POR_GENERO).sort(), GENEROS.map(g => g.id).sort()); assert.deepEqual(Object.keys(PALETAS_POR_GENERO).sort(), GENEROS.map(g => g.id).sort());
  for (const t of TIPOS_DE_COMODO) assert.deepEqual([MATERIAIS_POR_GENERO.investigacao![t.funcao]!.pisos[0], MATERIAIS_POR_GENERO.investigacao![t.funcao]!.papeis[0]], [t.piso, t.papel], 'o par do tipo vem primeiro');
});

test('a paleta preenche os campos de material com tecidos, madeira e tapete dela', () => {
  const p = paletaDe('investigacao', 0);
  assert.equal(paramsDaPaleta(p, 'sofa').estofado, p.tecidos[0]); assert.equal(paramsDaPaleta(p, 'cama.casal').cobertor, p.tecidos[0]);
  assert.equal(paramsDaPaleta(p, 'mesa.redonda').toalha, p.tecidos[1]); assert.equal(paramsDaPaleta(p, 'mesa.retangular').madeira, p.madeira);
  assert.equal(paramsDaPaleta(p, 'tapete.persa').material, p.tapete);
  assert.deepEqual(paramsDaPaleta(p, 'tapete.liso'), {}, 'o tapete liso usa material de piso: não é da paleta');
  assert.deepEqual(paramsDaPaleta(p, 'quadro'), {});
});

test('a proposta de um quarto vazio tem cama e uma paleta só', () => {
  const m = quarto(), p = propostaDeMobilia(ctx(m, 0), 'q')!;
  assert.ok(p); assert.equal(p.tipo, 'mobiliar'); assert.equal(p.rotulo, 'Mobiliar a Quarto');
  const objetos = itensDe(p).map(o => o.source as { recipe: string; params: Record<string, string> });
  assert.ok(objetos.some(o => o.recipe.startsWith('cama.')), 'tem cama'); assert.ok(objetos.length >= 3);
  const paleta = paletaDe('investigacao', 0);
  for (const o of objetos) for (const [campo, v] of Object.entries(o.params)) {
    const c = receitaDe(o.recipe)!.campos!.find(x => x.id === campo); if (!c || c.tipo !== 'material' || c.uso !== 'objeto') continue;
    assert.ok([paleta.madeira, paleta.tapete, ...paleta.tecidos].includes(v), `${o.recipe}.${campo} = ${v} não é da paleta ${paleta.nome}`);
  }
  validar(m, p);
});
const itensDe = (p: NonNullable<ReturnType<typeof propostaDeMobilia>>): Objeto[] => p.comandos.flatMap(c => (c.tipo === 'item.adicionar' ? [c.item as unknown as Objeto] : []));
const validar = (m: ReturnType<typeof quarto>, p: NonNullable<ReturnType<typeof propostaDeMobilia>>) => assert.ok(previaDaProposta(m, p), 'a proposta aceita passa na validação do mapa');

test('piso escolhido à mão não é trocado; o par de um tipo de cômodo é trocado quando o gênero pede', () => {
  const t = TIPOS_DE_COMODO.find(x => x.funcao === 'quarto')!;
  const aMao = quarto({ floor: { material: 'laje.pedra', seed: 1 } }); aMao.style = { ...aMao.style, genre: 'moderno' };
  assert.ok(!propostaDeMobilia(ctx(aMao), 'q')!.comandos.some(c => c.tipo === 'comodo.atualizar'));
  const doTipo = quarto({ floor: { material: t.piso, seed: 1 }, wallpaper: { material: t.papel, seed: 1 } }); doTipo.style = { ...doTipo.style, genre: 'moderno' };
  const troca = propostaDeMobilia(ctx(doTipo), 'q')!.comandos.find(c => c.tipo === 'comodo.atualizar') as { patch: { floor: { material: string } } };
  assert.equal(troca.patch.floor.material, 'tabuas.claras');
  const investigacao = quarto({ floor: { material: t.piso, seed: 1 }, wallpaper: { material: t.papel, seed: 1 } });
  assert.ok(!propostaDeMobilia(ctx(investigacao), 'q')!.comandos.some(c => c.tipo === 'comodo.atualizar'), 'investigação, semente 0: já é o par do tipo');
});

test('cômodo já mobiliado não recebe a sugestão de novo; outra semente traz outra paleta e outro arranjo', () => {
  const m = quarto(), p = propostaDeMobilia(ctx(m, 0), 'q')!, mobiliado = previaDaProposta(m, p);
  assert.equal(propostaDeMobilia(ctx(mobiliado as never, 0), 'q'), null, 'nada a acrescentar');
  assert.notEqual(proximaSugestao(ctx(mobiliado as never, 0), 'q', new Set())?.tipo, 'mobiliar');
  const b = propostaDeMobilia(ctx(m, 1), 'q')!, resumo = (x: typeof p) => JSON.stringify(itensDe(x).map(o => [o.source, o.position]));
  assert.notEqual(resumo(p), resumo(b));
  assert.notEqual(paletaDe('investigacao', 0).nome, paletaDe('investigacao', 1).nome);
});

test('sem função ou sem cômodo: nada; cômodo minúsculo: quase nada, sem lançar', () => {
  assert.equal(propostaDeMobilia(ctx(quarto({ function: null })), 'q'), null);
  assert.equal(propostaDeMobilia(ctx(quarto()), 'nao-existe'), null);
  const pequeno = mapaCom(sala('p', 0, 0, 1, 1, { name: 'Quarto', function: 'quarto' }));
  const p = propostaDeMobilia({ m: pequeno, versao: 0, semente: 0 }, 'p');
  assert.ok(p === null || itensDe(p).filter(o => o.elevation === 'floor').length === 0, 'não cabe móvel de piso num cômodo de 1,5 × 1,5 m');
});
