import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroDeConstrucao, aplicarEmCopia, comodos, espalhar, luzes, objetos, paredes, portas, regioes, terreno, type Construcao } from '../../src/authoring/construcao.ts';
import { celulasDaForma } from '../../src/authoring/formas.ts';
import { decodificar } from '../../src/domain/celulas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

const vazio = () => criarMapa({ id: 'teste', nome: 'Teste', agora: 1, largura: 30, altura: 20 });
const contador = () => { let n = 0; return (p: string) => `${p}${String(++n).padStart(3, '0')}`; };
const aplicar = (c: Construcao, mapa = vazio()) => { const m = aplicarEmCopia(mapa, c.comandos); validarMapa(m); return m; };
const erro = (f: () => unknown, trecho: RegExp) => assert.throws(f, e => e instanceof ErroDeConstrucao && trecho.test(e.message));

test('celulasDaForma: disco cobre as células certas e é reproduzível', () => {
  const o = { resolucao: 0.25, largura: 30, altura: 20, semente: 5 };
  const a = celulasDaForma({ disco: [5, 5], raio: 2, irregular: 0.5 }, o), b = celulasDaForma({ disco: [5, 5], raio: 2, irregular: 0.5 }, o);
  assert.deepEqual(a, b);
  assert.ok(a.length > 150 && a.length < 260);
  assert.notDeepEqual(a, celulasDaForma({ disco: [5, 5], raio: 2, irregular: 0.5 }, { ...o, semente: 6 }));
});

test('terreno: pintar e apagar geram comandos e o mapa valida', () => {
  const m0 = vazio();
  const { comandos } = terreno(m0, [{ acao: 'pintar', material: 'grama', forma: { retangulo: [0, 0, 10, 10] } }, { acao: 'apagar', forma: { disco: [5, 5], raio: 1 } }], 3);
  assert.deepEqual(comandos.map(c => c.tipo), ['terreno.pintar', 'terreno.apagar']);
  const m = aplicar({ comandos, ids: [] });
  const camada = Object.values(m.terrain.layers).find(l => l.material === 'grama')!;
  assert.ok(decodificar(camada.cells).length > 1000);
  assert.equal(m0.terrain.layers && Object.keys(m0.terrain.layers).length, 0);
});

test('terreno: material inválido lista as opções', () => {
  erro(() => terreno(vazio(), [{ acao: 'pintar', material: 'pedra.musgo', forma: { disco: [5, 5], raio: 1 } }]), /pedra\.musgo.*não existe; materiais de terreno: .*grama/);
  erro(() => terreno(vazio(), [{ acao: 'pintar', material: 'tabuas.carvalho', forma: { disco: [5, 5], raio: 1 } }]), /não serve para terreno/);
  erro(() => terreno(vazio(), [{ acao: 'pintar', forma: { disco: [5, 5], raio: 1 } }]), /exige um material/);
});

test('comodos: cria cômodo com piso e papel do tipo, e telhado', () => {
  const { comandos, ids } = comodos(vazio(), [{ rets: [[2, 2, 6, 6]], tipo: 'taverna', nome: 'Cabana', telhado: 'telha.barro', telhadoVisivel: false }], 4, contador());
  assert.deepEqual(ids, ['c001']);
  assert.deepEqual(comandos.map(c => c.tipo), ['comodo.criar', 'comodo.atualizar']);
  const m = aplicar({ comandos, ids });
  assert.equal(m.rooms.c001!.name, 'Cabana');
  assert.equal(m.rooms.c001!.roof.visible, false);
  assert.ok(Object.keys(m.walls).length >= 1);
});

test('comodos: todos os tipos têm piso e papel válidos; tipo inválido lista as opções', () => {
  for (const t of TIPOS_DE_COMODO) aplicar(comodos(vazio(), [{ rets: [[1, 1, 3, 3]], tipo: t.id }]));
  erro(() => comodos(vazio(), [{ rets: [[1, 1, 3, 3]], tipo: 'castelo' }]), /“castelo” não existe; tipos: sala, cozinha/);
  erro(() => comodos(vazio(), [{ rets: [[3, 3, 1, 1]], tipo: 'sala' }]), /retângulo inválido/);
});

test('paredes: adiciona com o padrão e sobrescreve campos; escarpa com drop e defaults', () => {
  const c = paredes(vazio(), [
    { path: [[2, 2], [8, 2]], kind: 'fence', altura: 1.1 },
    { path: [[2, 4], [8, 4]] },
    { path: [[10, 5], [10, 15]], kind: 'cliff', drop: 'a' },
  ], 1, contador());
  const m = aplicar(c);
  assert.equal(m.walls.w001!.kind, 'fence'); assert.equal(m.walls.w001!.height, 1.1);
  assert.equal(m.walls.w002!.thickness, 0.2);
  assert.equal(m.walls.w003!.kind, 'cliff');
  assert.equal(m.walls.w003!.drop, 'a');
  assert.equal(m.walls.w003!.material, 'rocha.cinza');
  assert.equal(m.walls.w003!.blocks.sight, false);
  erro(() => paredes(vazio(), [{ path: [[1, 1]] }]), /ao menos 2 pontos/);
  erro(() => paredes(vazio(), [{ path: [[1, 1], [2, 2]], kind: 'muralha' as never }]), /tipos: wall, low, fence, cliff/);
});

test('portas: encaixam num cômodo criado antes, encadeando com aplicarEmCopia', () => {
  const sala = comodos(vazio(), [{ rets: [[2, 2, 8, 8]], tipo: 'sala' }], 1, contador());
  assert.throws(() => portas(vazio(), [{ perto: [6, 12] }]), ErroDeConstrucao); // sem o cômodo, não há parede
  const m1 = aplicarEmCopia(vazio(), sala.comandos);
  const c = portas(m1, [{ perto: [6, 12] }], 1, contador());
  assert.equal(c.comandos[0]!.tipo, 'abertura.adicionar');
  const m = aplicar(c, m1);
  assert.equal(Object.values(m.openings).length, 1);
  assert.equal(Object.keys(m1.openings).length, 0);
});

test('portas: duas na mesma parede não se sobrepõem; sem parede perto, erro claro', () => {
  const m1 = aplicar(comodos(vazio(), [{ rets: [[2, 2, 8, 8]], tipo: 'sala' }], 1, contador()));
  const c = portas(m1, [{ perto: [6, 12], tipo: 'door' }, { perto: [9, 12], tipo: 'window', estado: 'open' }], 1, contador());
  const m = aplicar(c, m1);
  assert.equal(Object.keys(m.openings).length, 2);
  erro(() => portas(m1, [{ perto: [25, 15] }]), /não há parede perto de \[25, 15\]/);
  erro(() => portas(m1, [{ perto: [6, 12], tipo: 'portao' as never }]), /tipos: door, window, arch, secret/);
  erro(() => portas(m1, [{ perto: [6, 12] }, { perto: [6, 12] }]), /./); // a segunda cairia sobre a primeira
});

test('objetos: item.adicionar em props; reprodutível pela semente; item inválido sugere', () => {
  const pedidos = [{ item: 'casa:arvore-5m', pos: [5, 5] as [number, number] }, { item: 'caixa', pos: [8, 8] as [number, number], rotacao: 1, escala: 1.5, camada: 'table' as const }];
  const a = objetos(vazio(), pedidos, 9, contador()), b = objetos(vazio(), pedidos, 9, contador());
  assert.deepEqual(a.comandos, b.comandos);
  const m = aplicar(a);
  assert.equal(m.props.o002!.rotation, 1); assert.equal(m.props.o002!.scale, 1.5); assert.equal(m.props.o002!.elevation, 'table');
  assert.equal(m.props.o001!.source.kind, 'asset');
  erro(() => objetos(vazio(), [{ item: 'arvore-xyz', pos: [1, 1] }]), /“arvore-xyz” não existe; (parecidos|itens do acervo): /);
  erro(() => objetos(vazio(), [{ item: 'caixa', pos: [1, 1] }, { item: 'zzz', pos: [1, 1] }]), /zzz/);
});

test('espalhar: cria objetos dentro da forma, reprodutível; conjunto inválido lista as opções', () => {
  const pedido = { conjunto: 'mata', forma: { retangulo: [2, 2, 20, 15] as [number, number, number, number] } };
  const a = espalhar(vazio(), pedido, 1, contador()), b = espalhar(vazio(), pedido, 1, contador());
  assert.ok(a.ids.length > 5);
  assert.deepEqual(a.comandos, b.comandos);
  const m = aplicar(a);
  for (const o of Object.values(m.props)) assert.ok(o.position[0] >= 2 && o.position[0] <= 20 && o.position[1] >= 2 && o.position[1] <= 15);
  erro(() => espalhar(vazio(), { conjunto: 'deserto', forma: { disco: [5, 5], raio: 2 } }), /conjuntos: .*mata/);
});

test('luzes: predefinição, cone e sobrescritas; predefinição inválida lista as opções', () => {
  const c = luzes(vazio(), [{ preset: 'fogueira', pos: [5, 5] }, { preset: 'lanterna', pos: [8, 8], direcao: 1, raio: 9, cor: '#ffffff', intensidade: 0.5 }], 1, contador());
  const m = aplicar(c);
  assert.equal(m.lights.l001!.preset, 'fogueira'); assert.equal(m.lights.l002!.radius, 9); assert.equal(m.lights.l002!.intensity, 0.5);
  erro(() => luzes(vazio(), [{ preset: 'sol', pos: [1, 1] }]), /predefinições: .*vela/);
});

test('regioes: polígono, payload e somenteMestre; erros', () => {
  const c = regioes(vazio(), [{ poligono: [[1, 1], [5, 1], [5, 5]], tipo: 'note', nome: 'Altar', texto: 'Pó.' }, { poligono: [[1, 1], [5, 1], [5, 5]], tipo: 'reveal', somenteMestre: false }], 1, contador());
  const m = aplicar(c);
  assert.deepEqual(m.regions.r001!.payload, { nome: 'Altar', texto: 'Pó.' }); assert.equal(m.regions.r001!.gmOnly, true); assert.equal(m.regions.r002!.gmOnly, false);
  erro(() => regioes(vazio(), [{ poligono: [[1, 1], [2, 2]], tipo: 'note' }]), /ao menos 3 pontos/);
  erro(() => regioes(vazio(), [{ poligono: [[1, 1], [2, 2], [3, 1]], tipo: 'zona' as never }]), /tipos: reveal, trigger, note, audio/);
});

test('o mapa recebido não é alterado', () => {
  const m = vazio(), antes = JSON.stringify(m);
  espalhar(m, { conjunto: 'mata', forma: { disco: [10, 10], raio: 4 } }, 2);
  objetos(m, [{ item: 'caixa', pos: [1, 1] }]);
  assert.equal(JSON.stringify(m), antes);
});
