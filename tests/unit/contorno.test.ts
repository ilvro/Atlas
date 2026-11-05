import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { atualizarEscarpasDoMacico, contornar } from '../../src/domain/contorno.ts';
import { bloqueioNoCaminho } from '../../src/domain/movimento.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { oclusores, poligonoIluminado } from '../../src/domain/visibilidade.ts';
import { Kit } from '../../scripts/exemplos/kit.ts';
import { aplicarComando, type Comando } from '../../src/state/comandos.ts';
import { criarStore } from '../../src/state/store.ts';

const ret = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
const anel = (): [number, number][] => { const f = new Set(ret(8, 8, 48, 48).map(c => c.join())); for (const c of ret(20, 20, 36, 36)) f.delete(c.join()); return [...f].map(s => s.split(',').map(Number) as [number, number]); };
const pintar = (material: string, celulas: [number, number][]): Comando => ({ tipo: 'terreno.pintar', material, celulas });
const escarpas = (m: MapaAtlas) => Object.values(m.walls).filter(p => p.source && 'terrainLayerId' in p.source);
const fechado = (c: readonly (readonly [number, number])[]) => c.length > 2 && c[0]![0] === c.at(-1)![0] && c[0]![1] === c.at(-1)![1];

test('contornar: um quadrado é um polígono fechado de 4 vértices; um anel dá dois', () => {
  const q = contornar(codificar(ret(4, 4, 24, 24)), 0.25);
  assert.equal(q.length, 1); assert.ok(fechado(q[0]!)); assert.equal(q[0]!.length, 5);
  const xs = q[0]!.map(p => p[0]); assert.ok(Math.min(...xs) === 1 && Math.max(...xs) === 6);      // 4 a 24 células = 1 a 6 m
  const a = contornar(codificar(anel()), 0.25);
  assert.equal(a.length, 2); assert.ok(a.every(fechado));
});

test('contornar: com o limite do mapa, a rocha que encosta na borda não ganha contorno ali', () => {
  const r = contornar(codificar(ret(0, 0, 20, 20)), 0.25, { limite: [100, 100] });
  assert.equal(r.length, 1); assert.ok(!fechado(r[0]!), 'linha aberta');
  assert.ok(r[0]!.every(p => p[0] >= 0 && p[1] >= 0));
  assert.ok(r[0]!.every(p => p[0] > 4.9 || p[1] > 4.9), 'só o lado de dentro do mapa');
});

test('o contorno fica 1 célula (0,25 m) para dentro da rocha e a simplificação não passa de meia célula', () => {
  const m = aplicarComando(criarMapa(), pintar('rocha.cinza', ret(40, 40, 80, 80)));      // 10 a 20 m
  const [p] = escarpas(m); assert.ok(p && fechado(p.path));
  for (const [x, y] of p!.path) { assert.ok(x >= 10.25 - 1e-9 && x <= 19.75 + 1e-9 && y >= 10.25 - 1e-9 && y <= 19.75 + 1e-9, `${x},${y}`); }
  assert.ok(p!.path.some(q => Math.abs(q[0] - 10.25) < 1e-9));
  assert.equal(p!.kind, 'cliff'); assert.deepEqual(p!.blocks, { move: true, sight: true, light: true }); assert.equal(p!.drop, null);
  assert.deepEqual(p!.source, { terrainLayerId: 't_rocha_cinza' });
});

test('pintar maciço cria as paredes; terreno comum não; apagar e trocar o material as levam; nada fica órfão', () => {
  let m = aplicarComando(criarMapa(), pintar('grama', ret(0, 0, 180, 100)));
  assert.equal(escarpas(m).length, 0);
  m = aplicarComando(m, pintar('rocha.caverna', anel()));
  assert.equal(escarpas(m).length, 2); validarMapa(m);
  // Por cima do maciço com outro material: a camada some e as paredes vão juntas.
  const coberto = aplicarComando(m, pintar('terra', ret(0, 0, 180, 120)));
  assert.equal(escarpas(coberto).length, 0); validarMapa(coberto);
  // Tirar um pedaço refaz só o contorno.
  const furado = aplicarComando(m, { tipo: 'terreno.apagar', celulas: ret(20, 8, 36, 20) });
  assert.ok(escarpas(furado).length >= 1); validarMapa(furado);
  const tudo = aplicarComando(m, { tipo: 'terreno.apagar', celulas: ret(0, 0, 180, 120) });
  assert.equal(escarpas(tudo).length, 0); assert.deepEqual(Object.keys(tudo.walls), []);
  // Uma segunda pincelada no mesmo maciço refaz sem duplicar.
  const mais = aplicarComando(m, pintar('rocha.caverna', ret(100, 8, 110, 20)));
  assert.equal(escarpas(mais).length, 3); assert.equal(new Set(escarpas(mais).map(p => p.id)).size, 3);
});

test('desfazer a pincelada desfaz as paredes junto, em um passo só; refazer volta', () => {
  const s = criarStore(criarMapa());
  s.executar(pintar('rocha.cinza', ret(40, 40, 80, 80)), { rotulo: 'Pintar terreno' });
  assert.equal(escarpas(s.documento).length, 1); assert.equal(s.historico.length, 1);
  s.desfazer(); assert.equal(Object.keys(s.documento.walls).length, 0); assert.deepEqual(s.documento.terrain.layers, {});
  s.refazer(); assert.equal(escarpas(s.documento).length, 1);
});

test('as paredes do maciço sobrevivem ao recálculo dos cômodos e bloqueiam passo e visão', () => {
  let m = aplicarComando(criarMapa(), pintar('rocha.caverna', anel()));
  m = aplicarComando(m, { tipo: 'comodo.criar', id: 'sala', nome: 'Sala', funcao: null, piso: { material: 'tabuas.carvalho', seed: 1 }, papel: null, celulas: [[10, 5]] });
  assert.equal(escarpas(m).length, 2);
  // Dentro da caverna (vão de 5 a 9 m): a visão e a luz param na rocha; o passo também.
  const poli = poligonoIluminado([7, 7], oclusores(m, 'visao'), 30, null);
  let maxX = -Infinity; for (let i = 0; i < poli.length; i += 2) maxX = Math.max(maxX, poli[i]!);
  assert.ok(maxX < 9.5, `a visão vai até ${maxX}`);
  assert.ok(bloqueioNoCaminho(m, [7, 7], [14, 7]));
  assert.equal(bloqueioNoCaminho(m, [7, 7], [8, 7.5]), null);
  // Fora, ao lado da rocha, tudo livre.
  assert.equal(bloqueioNoCaminho(m, [14, 7], [15, 7]), null);
});

test('um maciço que encosta nas bordas do mapa não ganha parede em volta do mapa', () => {
  const m = aplicarComando(criarMapa({ id: 'g', agora: 1, largura: 20, altura: 12 }), pintar('rocha.cinza', ret(0, 0, 80, 48)));      // o mapa inteiro
  assert.equal(escarpas(m).length, 0);
});

test('o Kit também gera as paredes do maciço, iguais às do comando', () => {
  const k = new Kit({ id: 'k', nome: 'K', largura: 30, altura: 20, semente: 1 });
  k.pintar('grama', { retangulo: [0, 0, 30, 20] }).pintar('rocha.caverna', { disco: [15, 10], raio: 6 }).pintar('terra', { disco: [15, 10], raio: 2 });
  const m = k.construir(); validarMapa(m);
  assert.equal(escarpas(m).length, 2);
  const via = aplicarComando(structuredClone(m), { tipo: 'terreno.pintar', material: 'rocha.caverna', celulas: [] });
  assert.equal(escarpas(via).length, 2);
  // A mesma função, aplicada de novo, dá o mesmo resultado (idempotente).
  const outra = structuredClone(m); atualizarEscarpasDoMacico(outra);
  assert.deepEqual(outra.walls, m.walls);
});

test('mapa grande: o recálculo de um maciço em volta do mapa inteiro fica abaixo de 50 ms', () => {
  const m = criarMapa({ id: 'g', agora: 1, largura: 60, altura: 40 });
  const celulas = ret(0, 0, 240, 160).filter(([x, y]) => x < 24 || y < 24 || x >= 216 || y >= 136);
  m.terrain.layers.t_rocha_cinza = { id: 't_rocha_cinza', material: 'rocha.cinza', cells: codificar(celulas), order: 0, flow: null };
  atualizarEscarpasDoMacico(m);      // aquecimento
  let ms = Infinity; for (let i = 0; i < 7; i++) { const t = performance.now(); atualizarEscarpasDoMacico(m); ms = Math.min(ms, performance.now() - t); }      // o melhor de 7: a suíte roda arquivos em paralelo console.log(`recálculo do maciço 60 × 40 m: ${ms.toFixed(1)} ms`);
  assert.ok(escarpas(m).length >= 1); assert.ok(ms < 50, `${ms} ms`);
});
