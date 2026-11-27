import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { revisarMapa } from '../../src/authoring/revisao.ts';
import { decodificar } from '../../src/domain/celulas.ts';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { FUNCOES_AO_AR_LIVRE } from '../../src/domain/presets.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { MATERIAIS } from '../../src/procedural/materiais.ts';
import { cidadeDaFronteira } from '../../scripts/exemplos/cidade-da-fronteira.ts';
import { covilNaCaverna } from '../../scripts/exemplos/covil-na-caverna.ts';
import { enseadaDosPiratas } from '../../scripts/exemplos/enseada-dos-piratas.ts';
import { Kit, montarExemplo } from '../../scripts/exemplos/kit.ts';
import { oasisDaCaravana } from '../../scripts/exemplos/oasis-da-caravana.ts';
import { temploNaEncosta } from '../../scripts/exemplos/templo-na-encosta.ts';
import { vilaDoAtrio } from '../../scripts/exemplos/vila-do-atrio.ts';

const novo = (semente = 3) => new Kit({ id: 'teste', nome: 'Teste', largura: 30, altura: 20, semente });
const celulasDe = (k: Kit, material: string) => { const m = k.construir(), c = Object.values(m.terrain.layers).find(l => l.material === material); return c ? decodificar(c.cells) : []; };

test('o mesmo script gera o mesmo JSON duas vezes, e o exemplo valida', () => {
  const a = JSON.stringify(montarExemplo(covilNaCaverna)), b = JSON.stringify(montarExemplo(covilNaCaverna));
  assert.equal(a, b);
  const m = montarExemplo(covilNaCaverna);
  validarMapa(m);
  assert.ok(Object.keys(m.props).length > 0); assert.ok(Object.keys(m.lights).length > 0);
  assert.equal(m.terrain.base, 'vazio'); assert.ok(Object.values(m.terrain.layers).some(l => l.material === 'rocha.caverna'));
});

test('semente diferente muda ids e espalhamento; ids são únicos', () => {
  const monta = (s: number) => { const k = novo(s); k.espalhar('mata', { retangulo: [2, 2, 20, 15] }); return k.construir(); };
  const a = monta(1), b = monta(2);
  assert.notDeepEqual(Object.keys(a.props), Object.keys(b.props));
  assert.ok(Object.keys(a.props).length > 5);
  assert.equal(new Set(Object.keys(a.props)).size, Object.keys(a.props).length);
  validarMapa(a);
});

test('pintar com disco cobre as células certas (res 0,25 m)', () => {
  const k = novo(); k.pintar('grama', { disco: [5, 5], raio: 2 });
  const cel = celulasDe(k, 'grama'), res = 0.25;
  assert.ok(cel.length > 0);
  for (const [i, j] of cel) assert.ok(Math.hypot((i + 0.5) * res - 5, (j + 0.5) * res - 5) <= 2 + 1e-9);
  // a área bate com π r² dentro de 5%
  assert.ok(Math.abs(cel.length * res * res - Math.PI * 4) < 0.05 * Math.PI * 4, `área ${cel.length * res * res}`);
});

test('pintar por cima tira das outras camadas; apagar volta ao base; camada vazia some', () => {
  const k = novo(); k.pintar('grama', { retangulo: [0, 0, 10, 10] }); k.pintar('terra', { disco: [5, 5], raio: 2 });
  const grama = celulasDe(k, 'grama'), terra = celulasDe(k, 'terra'), chaves = new Set(terra.map(([i, j]) => `${i},${j}`));
  for (const [i, j] of grama) assert.ok(!chaves.has(`${i},${j}`), 'sem sobreposição');
  assert.equal(grama.length + terra.length, 40 * 40);
  k.apagar({ retangulo: [0, 0, 10, 10] });
  assert.deepEqual(Object.keys(k.construir().terrain.layers), []);
});

test('faixa, polígono e células; irregular só mexe na borda e é determinístico', () => {
  const k = novo(); k.pintar('terra', { faixa: [[0, 10], [30, 10]], largura: 2 });
  const lisa = celulasDe(k, 'terra'); assert.ok(Math.abs(lisa.length * 0.0625 - 60) < 3, `faixa ${lisa.length * 0.0625} m²`);
  const k2 = novo(); k2.pintar('terra', { poligono: [[2, 2], [8, 2], [8, 8], [2, 8]] }); assert.equal(celulasDe(k2, 'terra').length, 24 * 24);
  const k3 = novo(); k3.pintar('terra', { celulas: [[1, 1], [2, 1], [1, 2]] }); assert.deepEqual(celulasDe(k3, 'terra').map(c => [...c]), [[1, 1], [2, 1], [1, 2]]);
  const torta = () => { const kk = novo(); kk.pintar('terra', { faixa: [[0, 10], [30, 10]], largura: 2, irregular: 0.6 }); return celulasDe(kk, 'terra'); };
  assert.deepEqual(torta(), torta());
  assert.notEqual(torta().length, lisa.length);
  assert.ok(Math.abs(torta().length - lisa.length) < lisa.length * 0.4);
});

test('cômodos, portas, luzes, clima e acabamento validam', () => {
  const k = novo(); k.base('grama');
  const id = k.comodo([2, 2, 6, 5], 'taverna', { nome: 'Taverna do Cais', telhado: 'telha.barro' });
  k.porta([9, 5]);
  k.luz('lanterna', [4, 4], { direcao: 1 }); k.luz('tocha', [10, 10]);
  k.clima('noite', { time: '22:00', tempo: { fog: 0.3 } }); k.acabamento('frio', { glow: 0.4 });
  const m = k.construir(); validarMapa(m);
  assert.equal(m.rooms[id]!.name, 'Taverna do Cais'); assert.equal(m.rooms[id]!.roof.material, 'telha.barro');
  assert.equal(Object.keys(m.openings).length, 1);
  assert.equal(m.climate.weather.fog, 0.3); assert.equal(m.finish.glow, 0.4); assert.equal(m.finish.preset, 'personalizado');
  assert.ok(Object.values(m.lights).some(l => l.cone));
});

test('erros claros para nomes desconhecidos', () => {
  const k = novo();
  assert.throws(() => k.comodo([0, 0, 2, 2], 'nada'), /tipo de cômodo/); assert.throws(() => k.luz('nada', [1, 1]), /luz/);
  assert.throws(() => k.objeto('nada', [1, 1]), /item desconhecido/); assert.throws(() => k.clima('nada'), /clima/);
  assert.throws(() => k.espalhar('nada', { disco: [1, 1], raio: 1 }), /conjunto/); assert.throws(() => k.porta([5, 5]), /parede/);
  assert.throws(() => k.comodo([0, 0, 2, 2], 'sala', { telhado: 'inexistente' }), /telhado/);
});

test('Kit.comodo atribui telhado padrão do gênero por omissão e respeita ar livre ou telhado: null', () => {
  const k = novo();
  k.estilo({ genre: 'deserto' });
  const sala = k.comodo([1, 1, 4, 4], 'sala');
  const varanda = k.comodo([1, 4, 4, 5], 'varanda');
  const porao = k.comodo([6, 1, 8, 3], 'porao', { telhado: null });
  const m = k.construir();
  validarMapa(m);
  assert.equal(m.rooms[sala]!.roof.material, 'terraco.barro');
  assert.equal(m.rooms[varanda]!.roof.material, null);
  assert.equal(m.rooms[porao]!.roof.material, null);
});

test('todos os mapas de exemplo publicados têm construções cobertas com telhado válido', () => {
  const pastaExemplos = new URL('../../public/exemplos/', import.meta.url);
  const arquivos = readdirSync(pastaExemplos).filter(f => f.endsWith('.atlas.json')).sort();
  assert.ok(arquivos.length >= 17);
  for (const arq of arquivos) {
    const mapa = lerMapa(JSON.parse(readFileSync(new URL(arq, pastaExemplos), 'utf8')));
    validarMapa(mapa);
    const semTelhado = revisarMapa(mapa, { regras: ['edificio-sem-telhado'] });
    assert.deepEqual(semTelhado, [], `${arq} tem edifício sem telhado`);

    const exterior = mapa.terrain.base !== 'vazio'
      && mapa.terrain.base !== 'rocha.rachada'
      && MATERIAIS[mapa.terrain.base]?.uso !== 'macico';
    if (!exterior) continue;
    for (const sala of Object.values(mapa.rooms)) {
      if (sala.function && FUNCOES_AO_AR_LIVRE.has(sala.function)) continue;
      if (sala.levelId && (mapa.levels?.[sala.levelId]?.order ?? 0) < 0) continue;
      assert.ok(sala.roof.material, `${arq}: cômodo "${sala.name}" (${sala.id}) sem material de telhado`);
      assert.equal(MATERIAIS[sala.roof.material]?.uso, 'telhado', `${arq}: material inválido "${sala.roof.material}"`);
    }
  }
});

test('exemplos corrigidos geram exatamente o JSON publicado e passam validarMapa', () => {
  const pastaExemplos = new URL('../../public/exemplos/', import.meta.url);
  for (const exemplo of [cidadeDaFronteira, enseadaDosPiratas, oasisDaCaravana, temploNaEncosta, vilaDoAtrio]) {
    const gerado = montarExemplo(exemplo);
    validarMapa(gerado);
    const publicado = JSON.parse(readFileSync(new URL(`${exemplo.id}.atlas.json`, pastaExemplos), 'utf8'));
    assert.deepEqual(gerado, publicado, `${exemplo.id}.atlas.json está desatualizado em relação ao script`);
  }
});
