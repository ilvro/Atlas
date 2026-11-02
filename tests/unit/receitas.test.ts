import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caixaDasPartes } from '../../src/procedural/descricao.ts';
import { MATERIAIS, materialDe, materiaisDo, tom } from '../../src/procedural/materiais.ts';
import { CATEGORIAS, RECEITAS, descreverReceita, funcoesDeComodo, listaDeReceitas, pegadaDaReceita } from '../../src/procedural/receitas.ts';
import { PRESETS_DE_ACABAMENTO, PRESETS_DE_LUZ, TIPOS_DE_COMODO, camposDoPreset, posicaoDeTitulo, presetDeLuz } from '../../src/domain/presets.ts';
import { novaLuz } from '../../src/domain/fabrica.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

const todasAsPartes = (id: string, params: Record<string, unknown> = {}, seed = 3) => { const d = descreverReceita(id, { seed, params }); return d.tipo === 'piso' ? d.partes : [...d.face, ...d.topo]; };

test('o lote 1 tem as receitas do roteiro, em todas as categorias', () => {
  const ids = Object.keys(RECEITAS);
  assert.ok(ids.length >= 20, `${ids.length} receitas`);
  for (const necessaria of ['mesa.redonda', 'mesa.retangular', 'cadeira', 'cama.solteiro', 'cama.casal', 'estante', 'estante.piso', 'armario', 'tapete.persa', 'papeis', 'livros.pilha', 'sofa', 'quadro', 'caixa']) assert.ok(RECEITAS[necessaria], necessaria);
  for (const [cat] of CATEGORIAS) assert.ok(listaDeReceitas().some(r => r.categoria === cat), `categoria ${cat} vazia`);
  assert.equal(new Set(ids).size, ids.length);
});

test('toda receita gera partes finitas, com materiais que existem, e a pegada confere com as partes', () => {
  for (const r of listaDeReceitas()) {
    for (const seed of [1, 99, 123456]) {
      const partes = todasAsPartes(r.id, {}, seed);
      assert.ok(partes.length > 0, r.id);
      for (const p of partes) {
        assert.ok(Number.isFinite(p.z), `${r.id}: z`);
        const nums = p.forma === 'poli' ? p.pts! : [p.x!, p.y!, p.w!, p.h!];
        assert.ok(nums.every(Number.isFinite), `${r.id}: números não finitos`);
        assert.ok(p.mat.startsWith('#') || MATERIAIS[p.mat], `${r.id}: material ${p.mat} não existe`);
        if (p.forma !== 'poli') assert.ok(p.w! > 0 && p.h! > 0, `${r.id}: parte sem área`);
      }
    }
    const d = descreverReceita(r.id, { seed: 1, params: {} });
    assert.equal(d.tipo, r.tipo, r.id);
    if (d.tipo === 'piso') {
      const c = caixaDasPartes(d.partes);
      // As partes ficam dentro da pegada declarada (com folga para o que sai um pouco, como tampos e almofadas).
      assert.ok(c.x1 - c.x0 <= d.pegada[0] * 1.25 + 0.05 && c.y1 - c.y0 <= d.pegada[1] * 1.25 + 0.05, `${r.id}: partes ${(c.x1 - c.x0).toFixed(2)}×${(c.y1 - c.y0).toFixed(2)} fora da pegada ${d.pegada}`);
    }
  }
});

test('as receitas são determinísticas: mesma semente, mesmo desenho; sementes diferentes variam o que é aleatório', () => {
  for (const id of ['estante', 'estante.piso', 'mesa.retangular', 'livros.pilha', 'papeis']) {
    assert.deepEqual(todasAsPartes(id, {}, 5), todasAsPartes(id, {}, 5), id);
    assert.notDeepEqual(todasAsPartes(id, {}, 5), todasAsPartes(id, {}, 6), id);
  }
  assert.deepEqual(todasAsPartes('cadeira', {}, 1), todasAsPartes('cadeira', {}, 2), 'a cadeira não é aleatória');
});

test('os parâmetros mudam o tamanho, e valores absurdos são presos aos limites', () => {
  assert.deepEqual(pegadaDaReceita('tapete.persa'), [3.2, 2.2]);
  assert.deepEqual(pegadaDaReceita('tapete.persa', { largura: 5, altura: 4 }), [5, 4]);
  assert.deepEqual(pegadaDaReceita('tapete.persa', { largura: 500, altura: -3 }), [8, 1]);
  assert.deepEqual(pegadaDaReceita('mesa.redonda', { diametro: 2 }), [2, 2]);
  assert.deepEqual(pegadaDaReceita('mesa.retangular', { largura: 'larga' }), [1.8, 0.9], 'valor de tipo errado vira o padrão');
  assert.equal(todasAsPartes('cama.casal', { cobertor: 'tecido.verde' }).some(p => p.mat === 'tecido.verde'), true);
  assert.equal(descreverReceita('estante', { seed: 1, params: { largura: 4 } }).tipo === 'parede' && (descreverReceita('estante', { seed: 1, params: { largura: 4 } }) as { largura: number }).largura, 4);
});

test('uma receita desconhecida vira um caixote, nunca um erro', () => {
  assert.deepEqual(descreverReceita('nao-existe', { seed: 1, params: {} }), descreverReceita('caixa', { seed: 1, params: {} }));
});

test('os campos editáveis de cada receita têm padrão dentro dos limites', () => {
  for (const r of listaDeReceitas()) for (const c of r.campos ?? []) {
    if (c.tipo === 'numero') { assert.ok(typeof c.padrao === 'number' && c.min! <= c.padrao && c.padrao <= c.max!, `${r.id}.${c.id}`); assert.ok(c.passo! > 0); }
    else { assert.ok(MATERIAIS[String(c.padrao)], `${r.id}.${c.id}: ${c.padrao}`); assert.ok(c.uso); }
  }
  assert.ok(funcoesDeComodo().includes('cozinha') && funcoesDeComodo().includes('quarto'));
});

test('materiais: todos têm cores válidas, e há de cada uso', () => {
  for (const m of Object.values(MATERIAIS)) for (const c of [m.base, m.escuro, m.claro]) assert.match(c, /^#[0-9a-f]{6}$/i, m.id);
  for (const uso of ['piso', 'papel', 'objeto', 'terreno'] as const) assert.ok(materiaisDo(uso).length >= 5, uso);
  assert.equal(materialDe('#336699').base, '#336699'); assert.equal(materialDe('nao-existe').id, 'pedra.escura');
  assert.equal(tom('#808080', 1), '#ffffff'); assert.equal(tom('#808080', -1), '#000000');
});

test('tipos de cômodo e predefinições só usam materiais que existem', () => {
  for (const t of TIPOS_DE_COMODO) { assert.equal(MATERIAIS[t.piso]?.uso, 'piso', t.id); assert.equal(MATERIAIS[t.papel]?.uso, 'papel', t.id); }
  assert.equal(new Set(TIPOS_DE_COMODO.map(t => t.id)).size, TIPOS_DE_COMODO.length);
});

test('predefinições de luz: lamparinas em círculo, lanternas em cone, e viram luzes válidas no mapa', () => {
  const circulos = PRESETS_DE_LUZ.filter(p => p.cone === null).map(p => p.id), cones = PRESETS_DE_LUZ.filter(p => p.cone !== null).map(p => p.id);
  for (const id of ['vela', 'lamparina', 'tocha', 'lampada', 'neon']) assert.ok(circulos.includes(id), id);
  for (const id of ['lanterna', 'holofote', 'farol']) assert.ok(cones.includes(id), id);
  let m = criarMapa();
  for (const p of PRESETS_DE_LUZ) m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'lights', item: novaLuz([3, 3], camposDoPreset(p, 1.5)) as never });
  validarMapa(m);
  const lanterna = Object.values(m.lights).find(l => l.preset === 'lanterna')!;
  assert.ok(Math.abs(lanterna.cone!.angle - Math.PI / 3) < 1e-9); assert.equal(lanterna.cone!.direction, 1.5); assert.equal(lanterna.power, 'battery');
  assert.equal(Object.values(m.lights).find(l => l.preset === 'vela')!.cone, null);
  assert.equal(presetDeLuz('nao-existe'), undefined);
});

test('predefinições de acabamento cabem no documento, e a cartela de título fica dentro do mapa', () => {
  let m = criarMapa();
  for (const p of PRESETS_DE_ACABAMENTO) { m = aplicarComando(m, { tipo: 'acabamento.atualizar', patch: { preset: p.id, ...p.valores } }); validarMapa(m); }
  for (const onde of ['inferior-direito', 'inferior-esquerdo', 'superior-direito', 'superior-esquerdo', 'topo'] as const) {
    const [x, y] = posicaoDeTitulo(45, 30, onde); assert.ok(x >= 0 && x + 7 <= 45 && y >= 0 && y <= 30, onde);
  }
});
