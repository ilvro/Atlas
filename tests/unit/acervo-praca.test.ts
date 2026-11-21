import { test } from 'node:test';
import assert from 'node:assert/strict';
import { descreverReceita, pegadaDaReceita, RECEITAS } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_DA_PRACA } from '../../src/procedural/receitas/praca.ts';
import { MATERIAIS } from '../../src/procedural/materiais.ts';
import type { Parte } from '../../src/procedural/descricao.ts';
import { caminho } from '../../src/authoring/caminho.ts';
import { terreno } from '../../src/authoring/construcao.ts';
import { Kit } from '../../scripts/exemplos/kit.ts';
import { camposDoPreset, presetDeLuz } from '../../src/domain/presets.ts';
import { luzes } from '../../src/authoring/construcao.ts';
import { aplicarEmCopia } from '../../src/authoring/construcao.ts';
import { entradaDoComodo } from '../../src/render/entradas.ts';

const partes = (id: string, params: Record<string, unknown> = {}, seed = 3): Parte[] => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };

test('as receitas da praça existem, são de exterior e respeitam os limites dos campos', () => {
  assert.deepEqual(RECEITAS_DA_PRACA.map(r => r.id), ['arquibancada', 'roseta-de-calcamento', 'arco-de-pedra', 'estatua-heroica', 'sombra-de-colosso', 'muralha-em-degraus', 'fosso-de-luz', 'tablado', 'andaime', 'casulo']);
  for (const r of RECEITAS_DA_PRACA) { assert.equal(RECEITAS[r.id], r); assert.equal(r.categoria, 'exterior'); if (r.id !== 'sombra-de-colosso') assert.ok(partes(r.id).length > 5, r.id); }
  assert.deepEqual(pegadaDaReceita('roseta-de-calcamento', { raio: 99 }), [18, 18]);
  assert.deepEqual(pegadaDaReceita('casulo', { tamanho: 3 }), [3, 3.75]);
  assert.equal(pegadaDaReceita('arco-de-pedra', { largura: 4 })[0], 5.8);
});

test('a sombra de colosso é um contorno só, macio, marcado como sombra projetada e dentro da pegada', () => {
  const ps = partes('sombra-de-colosso', { comprimento: 40 }), [w, h] = pegadaDaReceita('sombra-de-colosso', { comprimento: 40 });
  assert.equal(ps.length, 1);
  assert.ok(ps[0]!.desfoque! > 0 && ps[0]!.semSombra);
  assert.ok(RECEITAS['sombra-de-colosso']!.tags.includes('sombra-projetada'));
  assert.equal(h, 40);
  for (let i = 0; i < ps[0]!.pts!.length; i += 2) { assert.ok(Math.abs(ps[0]!.pts![i]!) <= w / 2); assert.ok(Math.abs(ps[0]!.pts![i + 1]!) <= h / 2 + 0.3); }
});

test('a arquibancada sobe para fora: a fileira externa é mais alta e a pegada cabe as partes', () => {
  const ps = partes('arquibancada', { raio: 8, degraus: 5 }), [w, h] = pegadaDaReceita('arquibancada', { raio: 8, degraus: 5 });
  const zs = ps.filter(p => p.forma === 'poli' && !p.alfa).map(p => p.z);
  assert.ok(Math.max(...zs) > 1.8 && Math.min(...zs) < 0.4);
  for (const p of ps) for (let i = 0; i < (p.pts?.length ?? 0); i += 2) { assert.ok(Math.abs(p.pts![i]!) <= w / 2 + 0.3); assert.ok(Math.abs(p.pts![i + 1]!) <= h / 2 + 0.3); }
});

test('a fonte tem três formas e cresce com o diâmetro', () => {
  assert.deepEqual(pegadaDaReceita('fonte'), [2.4, 2.4]);
  assert.deepEqual(pegadaDaReceita('fonte', { diametro: 5 }), [5, 5]);
  const borda = (forma: number) => partes('fonte', { forma, diametro: 4 }).find(p => p.forma === 'poli' && p.z === 0.2)!.pts!.length / 2;
  assert.equal(borda(1), 8);
  assert.ok(borda(2) > borda(1) && borda(0) > borda(1));
});

test('a água de turfa é um material de água escuro', () => {
  assert.equal(MATERIAIS['agua.turfa']!.uso, 'agua');
});

test('Kit.aplicar roda as ferramentas do assistente e o resultado continua editável pelo kit', () => {
  const k = new Kit({ id: 'teste-aplicar', nome: 'Teste', largura: 20, altura: 12, semente: 5 });
  k.base('grama');
  k.aplicar(m => caminho(m, { pontos: [[0, 6], [20, 6]], largura: 1.5, material: 'terra' }, 2));
  k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 2, forma: { retangulo: [12, 0, 20, 12] } }], 3));
  k.objeto('pedra.media', [4, 3]);
  k.pintar('areia', { disco: [4, 9], raio: 1.5 });
  const m = k.construir();
  const mats = Object.values(m.terrain.layers).map(l => l.material).sort();
  assert.deepEqual(mats, ['areia', 'terra']);
  assert.equal(Object.values(m.terrain.relief!.patamares)[0]!.altura, 2);
  assert.equal(Object.keys(m.props).length, 1);
  assert.deepEqual(k.construir(), m, 'construir é estável');
});

test('as escadas de pedra clareiam de baixo (+y) para cima (−y), com muretas dos dois lados', () => {
  for (const id of ['escada.pedra', 'escada.externa']) {
    const cy = (p: Parte) => p.pts!.filter((_, i) => i % 2).reduce((a, b) => a + b, 0) / (p.pts!.length / 2);
    const ps = partes(id), pisadas = ps.filter(p => p.forma === 'poli' && p.detalhe === 1 && p.alfa === undefined).sort((a, b) => cy(b) - cy(a));
    assert.ok(pisadas.length >= 5, id);
    const luz = (hex: string) => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    assert.ok(luz(pisadas.at(-1)!.mat) > luz(pisadas[0]!.mat), `${id}: o degrau de cima é mais claro`);
    const [w] = pegadaDaReceita(id);
    for (const s of [-1, 1]) assert.ok(ps.some(p => p.forma === 'ret' && Math.sign(p.x!) === s && Math.abs(p.x!) > w / 2 - 0.35 && p.z > 0.4), `${id}: mureta ${s}`);
  }
});

test('o braseiro tem pés, aro, brasa e uma bola de fogo de borda macia, com o miolo somando luz', () => {
  const ps = partes('braseiro');
  assert.deepEqual(pegadaDaReceita('braseiro'), [1, 1]);
  const fogo = ps.filter(p => p.z > 1 && p.desfoque);
  assert.ok(fogo.length >= 10, `${fogo.length} manchas de fogo`);
  assert.ok(fogo.some(p => p.brilho && p.mat === '#fffbe8'), 'miolo quase branco somando luz');
});

test('o fosso de luz tem aro de blocos e brilho no fundo, na cor pedida; a muralha sobe em patamares', () => {
  const frio = partes('fosso-de-luz'), dourado = partes('fosso-de-luz', { cor: 1 });
  assert.ok(frio.some(p => p.mat === '#cfe6ff') && dourado.some(p => p.mat === '#ffe2a0'));
  assert.ok(frio.filter(p => p.forma === 'ret' && p.z === 0.18).length >= 12, 'aro de blocos');
  const muralha = partes('muralha-em-degraus', { largura: 6, profundidade: 3, degraus: 3 }), zs = new Set(muralha.filter(p => p.forma === 'ret' && !p.alfa).map(p => Math.round(p.z * 10)));
  assert.ok(zs.size >= 3);
  assert.deepEqual(pegadaDaReceita('muralha-em-degraus', { largura: 6, profundidade: 3 }), [6, 3]);
});

test('o piso de lajes é de lajes grandes, o calçamento antigo é de pedras irregulares e o tijolo continua em fiadas', () => {
  assert.equal(MATERIAIS['laje.pedra']!.padrao, 'lajes-grandes');
  assert.equal(MATERIAIS['lajes.antigas']!.padrao, 'lajes-rusticas', 'calçamento antigo ao ar livre em pedras irregulares');
  assert.equal(MATERIAIS['tijolo']!.padrao, 'laje');
});

test('o feixe do alto é uma luz em círculo com raios, e atlas_luzes liga raios em qualquer luz', () => {
  const f = presetDeLuz('feixe')!;
  assert.equal(f.cone, null);
  assert.equal(camposDoPreset(f).rays, true);
  const k = new Kit({ id: 'teste-luz', nome: 'Teste', largura: 10, altura: 10, semente: 2 });
  const m = k.construir();
  const c = luzes(m, [{ preset: 'tocha', pos: [5, 5], raios: true }, { preset: 'vela', pos: [2, 2] }], 1, p => `${p}${Math.random().toString(36).slice(2, 8)}`);
  const ls = Object.values(aplicarEmCopia(m, c.comandos).lights);
  assert.deepEqual(ls.map(l => l.rays).sort(), [false, true]);
});

test('o degrau do relevo que cruza um cômodo entra no assado do cômodo', () => {
  const k = new Kit({ id: 'teste-tablado', nome: 'Teste', largura: 15, altura: 15, semente: 4 });
  k.base('terra');
  k.comodo([1, 1, 9, 9], 'salao', { telhado: null });
  k.aplicar(m => terreno(m, [{ acao: 'relevo', altura: 0.6, forma: { retangulo: [4.5, 4.5, 9, 9] } }], 1));
  const m = k.construir(), sala = Object.values(m.rooms)[0]!;
  const e = entradaDoComodo(m, sala);
  assert.ok(e.degraus && e.degraus.length >= 1);
  assert.equal(e.degraus[0]!.desnivel, 0.6);
});

test('tablado, andaime e lajes escuras de salão existem e cabem na pegada', () => {
  for (const [id, params] of [['tablado', { largura: 9 }], ['andaime', { comprimento: 10, largura: 3 }]] as const) {
    const ps = partes(id, params), [w, h] = pegadaDaReceita(id, params);
    assert.ok(ps.length > 20, id);
    for (const p of ps) for (let i = 0; i < (p.pts?.length ?? 0); i += 2) { assert.ok(Math.abs(p.pts![i]!) <= w / 2 + 0.3, id); assert.ok(Math.abs(p.pts![i + 1]!) <= h / 2 + 0.3, id); }
  }
  assert.equal(MATERIAIS['lajes.escuras']!.uso, 'terreno');
});
