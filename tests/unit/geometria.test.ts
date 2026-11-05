import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar, decodificar } from '../../src/domain/celulas.ts';
import { arestasCobertas, arestasDeParede, caixaDasCelulas, comodoEm, comprimentoDaParede, contornoDoComodo, facesDoContorno, indiceDeCelulas, motivoDeNaoCaber, paredesDerivadas, pontoNaParede, projetarNaParede, recalcularParedes } from '../../src/domain/geometria.ts';
import { criarMapa, type Abertura, type Comodo, type MapaAtlas } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

const retangulo = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
const sala = (id: string, cells: [number, number][]): Comodo => ({ id, name: id, function: null, cells: codificar(cells), floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null });
const mapaCom = (...salas: Comodo[]): MapaAtlas => { const m = criarMapa({ id: 'm', agora: 1 }); for (const s of salas) m.rooms[s.id] = s; recalcularParedes(m); return m; };
const porta = (wallId: string, at: number, extra: Partial<Abertura> = {}): Abertura => ({ id: 'porta', wallId, at, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a', ...extra });
const caminhos = (m: MapaAtlas) => Object.values(m.walls).map(p => p.path.map(q => q.join(',')).join('→')).sort();

test('um cômodo vira quatro paredes, uma por lado, com as pontas na grade', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  assert.equal(Object.keys(m.walls).length, 4);
  assert.deepEqual(caminhos(m), ['3,3→3,6', '3,3→6,3', '3,6→6,6', '6,3→6,6']);   // células de 1,5 m: x e y de 3 a 6
  for (const p of Object.values(m.walls)) { assert.equal(dono(p), 'a'); assert.match(p.id, /^d[hv]\d+_\d+_\d+$/); assert.equal(comprimentoDaParede(p), 3); }
  validarMapa(m);
});

test('um cômodo em L tem seis paredes', () => {
  const m = mapaCom(sala('l', [...retangulo(0, 0, 3, 1), ...retangulo(0, 1, 1, 3)]));
  assert.equal(Object.keys(m.walls).length, 6);
  validarMapa(m);
});

test('cômodos vizinhos dividem uma parede só', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(4, 2, 6, 4)));
  // A: topo, base, esquerda; B: topo, base, direita; e uma parede no meio.
  assert.equal(Object.keys(m.walls).length, 7);
  const meio = Object.values(m.walls).filter(p => p.path[0]![0] === 6 && p.path[1]![0] === 6);
  assert.equal(meio.length, 1); assert.equal(dono(meio[0]!), 'a');     // o dono é o primeiro em ordem alfabética
  assert.equal(comprimentoDaParede(meio[0]!), 3);
  assert.equal(arestasDeParede(m).get('v:4:2')!.salas.join('|'), 'a|b');
  validarMapa(m);
});

test('a parede acompanha o cômodo: pintar mais células a leva junto', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  m.rooms.a!.cells = codificar([...retangulo(2, 2, 4, 4), ...retangulo(4, 2, 5, 4)]);
  recalcularParedes(m);
  assert.deepEqual(caminhos(m), ['3,3→3,6', '3,3→7.5,3', '3,6→7.5,6', '7.5,3→7.5,6']);
  m.rooms = {}; recalcularParedes(m);
  assert.deepEqual(Object.keys(m.walls), []);
});

test('uma parede manual sobre a aresta impede a derivada de se repetir, e sobrevive ao cômodo', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  const topo = Object.values(m.walls).find(p => p.path[0]![1] === 3 && p.path[1]![1] === 3)!;
  m.walls[topo.id] = { ...topo, source: null };                       // "desanexar": agora é do mestre
  recalcularParedes(m);
  assert.equal(Object.keys(m.walls).length, 4); assert.equal(Object.values(m.walls).filter(p => !p.source).length, 1);
  assert.deepEqual(arestasCobertas(m, topo), ['h:2:2', 'h:3:2']);
  delete m.rooms.a; recalcularParedes(m);
  assert.equal(Object.keys(m.walls).length, 1);                        // só a manual fica
  assert.deepEqual(arestasCobertas(m, { path: [[3, 3.1], [6, 3.1]] }), [], 'fora da grade não cobre nada');
  assert.deepEqual(arestasCobertas(m, { path: [[3, 3], [3, 6]] }), ['v:2:2', 'v:2:3']);
});

test('portas acompanham a parede: se ela cresce, ficam onde estavam; se some, saem', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  const direita = Object.values(m.walls).find(p => p.path[0]![0] === 6 && p.path[1]![0] === 6)!;   // x = 6, y de 3 a 6
  m.openings.porta = porta(direita.id, 0.5);                         // no meio: (6, 4,5)
  validarMapa(m);
  // O cômodo ganha duas linhas embaixo: a parede da direita passa a ir de y = 3 a y = 9.
  m.rooms.a!.cells = codificar([...retangulo(2, 2, 4, 4), ...retangulo(2, 4, 4, 6)]);
  recalcularParedes(m);
  const nova = m.walls[m.openings.porta!.wallId]!;
  assert.equal(nova.path[0]![0], 6); assert.equal(comprimentoDaParede(nova), 6);
  assert.ok(Math.abs(m.openings.porta!.at - 0.25) < 1e-9, `at = ${m.openings.porta!.at}`);        // continua em y = 4,5
  assert.deepEqual(pontoNaParede(nova, m.openings.porta!.at * 6).ponto, [6, 4.5]);
  validarMapa(m);
  // A parede da direita anda para o lado: a porta não tem mais onde ficar.
  m.rooms.a!.cells = codificar([...retangulo(2, 2, 5, 4), ...retangulo(2, 4, 4, 6)]);
  recalcularParedes(m);
  assert.deepEqual(Object.keys(m.openings), []);
});

test('uma porta entre dois cômodos some se um deles é apagado e a parede deixa de existir', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(4, 2, 6, 4)));
  const meio = Object.values(m.walls).find(p => p.path[0]![0] === 6 && p.path[1]![0] === 6)!;
  m.openings.porta = porta(meio.id, 0.5);
  delete m.rooms.b; recalcularParedes(m);
  // A parede do meio agora é só da sala A: a porta continua (a parede ainda existe).
  assert.equal(Object.keys(m.openings).length, 1); assert.equal(dono(m.walls[m.openings.porta!.wallId]!), 'a');
  delete m.rooms.a; recalcularParedes(m);
  assert.deepEqual(Object.keys(m.openings), []);
});

test('objetos de parede acompanham a parede como as portas', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  const topo = Object.values(m.walls).find(p => p.path[0]![1] === 3 && p.path[1]![1] === 3)!;
  m.props.quadro = { id: 'quadro', source: { kind: 'recipe', recipe: 'quadro', seed: 1, params: {} }, position: [4.5, 3], rotation: 0, scale: 1, elevation: 'wall', wall: { wallId: topo.id, at: 0.5, face: 'inner' }, roomId: 'a', blocks: { move: false, sight: false }, castsShadow: false, harmonize: true, interaction: null };
  validarMapa(m);
  m.rooms.a!.cells = codificar([...retangulo(2, 2, 5, 4)]);          // topo vai de 3 m a 4,5 m de comprimento
  recalcularParedes(m);
  const q = m.props.quadro!; assert.ok(q.wall);
  assert.equal(m.walls[q.wall!.wallId]!.path[1]![0], 7.5); assert.ok(Math.abs(q.wall!.at - 1.5 / 4.5) < 1e-5);     // a posição é guardada com 6 casas
  delete m.rooms.a; recalcularParedes(m);
  assert.equal(m.props.quadro, undefined);
});

test('o cômodo de um objeto de chão acompanha a posição; luzes e peças órfãs são limpas', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  m.props.mesa = { id: 'mesa', source: { kind: 'recipe', recipe: 'mesa.redonda', seed: 1, params: {} }, position: [4.5, 4.5], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null };
  recalcularParedes(m);
  assert.equal(m.props.mesa!.roomId, 'a');
  m.props.mesa!.position = [20, 20]; recalcularParedes(m); assert.equal(m.props.mesa!.roomId, null);
  m.lights.l = { id: 'l', position: [0, 0], radius: 3, color: '#ffffff', intensity: 1, flicker: 0, cone: null, ownerId: 'fantasma', power: 'fire', on: true, nightOnly: false, preset: null, rays: false };
  recalcularParedes(m); assert.equal(m.lights.l, undefined);
});

test('aberturas não se sobrepõem nem passam das pontas', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  const topo = Object.values(m.walls).find(p => p.path[0]![1] === 3 && p.path[1]![1] === 3)!;       // 3 m
  m.openings.p1 = porta(topo.id, 0.5); m.openings.p1.id = 'p1';
  assert.equal(motivoDeNaoCaber(m, { id: 'p2', wallId: topo.id, at: 0.6, width: 0.9 }), 'Já há uma abertura aí.');
  assert.equal(motivoDeNaoCaber(m, { id: 'p2', wallId: topo.id, at: 0.8, width: 0.9 }), null);         // encosta na outra, sem sobrepor
  assert.match(motivoDeNaoCaber(m, { id: 'p2', wallId: topo.id, at: 0.9, width: 0.9 })!, /não cabe/);   // passaria da ponta (2,7 + 0,45 > 3)
  assert.match(motivoDeNaoCaber(m, { id: 'p2', wallId: topo.id, at: 0.05, width: 0.9 })!, /não cabe/);
  assert.match(motivoDeNaoCaber(m, { id: 'p2', wallId: 'fantasma', at: 0.5, width: 0.9 })!, /não existe/);
  assert.equal(motivoDeNaoCaber(m, { id: 'p1', wallId: topo.id, at: 0.5, width: 0.9 }), null, 'a própria abertura não conta contra si');
});

test('projetar um ponto na parede dá a posição, a distância e o lado', () => {
  const p = { path: [[0, 0], [10, 0]] as [number, number][] };
  // `lado` 1 é a direita de quem anda do início ao fim (com y para baixo, abaixo de uma parede que vai para a direita).
  assert.deepEqual(projetarNaParede(p, [4, 2]), { dist: 4, distancia: 2, lado: 1 });
  assert.deepEqual(projetarNaParede(p, [4, -2]), { dist: 4, distancia: 2, lado: -1 });
  assert.equal(projetarNaParede(p, [-3, 0]).dist, 0);
  const l = { path: [[0, 0], [4, 0], [4, 3]] as [number, number][] };
  assert.equal(comprimentoDaParede(l), 7); assert.deepEqual(pontoNaParede(l, 5.5).ponto, [4, 1.5]);
});

test('comodoEm acha o cômodo sob um ponto e respeita o deslocamento da grade', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  assert.equal(comodoEm(m, [4.5, 4.5]), 'a'); assert.equal(comodoEm(m, [2.9, 4.5]), null); assert.equal(comodoEm(m, [6.1, 4.5]), null);
  m.grid.offset = [0.75, 0]; assert.equal(comodoEm(m, [3.8, 4.5]), 'a'); assert.equal(comodoEm(m, [3.7, 4.5]), null);
  assert.equal(indiceDeCelulas(m).size, 4);
});

test('contorno: normais para dentro, segmentos colineares juntos e faces em meia-esquadria', () => {
  const m = criarMapa();
  const [laco] = contornoDoComodo(m, decodificar(codificar([...retangulo(0, 0, 3, 1), ...retangulo(0, 1, 1, 3)])));
  assert.equal(laco!.length, 6);
  const topo = laco!.find(s => s.a[1] === 0 && s.b[1] === 0)!;
  assert.deepEqual(topo.n, [0, 1]); assert.equal(topo.ks.length, 3);
  const faces = facesDoContorno(laco!, 0.5);
  assert.equal(faces.length, 6);
  for (const f of faces) { assert.equal(f.quad.length, 4); assert.deepEqual(f.quad[0], f.segmento.a); }
  // Um quadrado simples: o interior das faces fecha em 0,5 m de cada canto.
  const [q] = contornoDoComodo(m, decodificar(codificar(retangulo(0, 0, 2, 2))));
  const f0 = facesDoContorno(q!, 0.5)[0]!;
  assert.ok(f0.quad.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])));
  assert.deepEqual(caixaDasCelulas(m, decodificar(codificar(retangulo(2, 3, 5, 4)))), { x0: 3, y0: 4.5, x1: 7.5, y1: 6 });
  assert.equal(caixaDasCelulas(m, []), null);
});

test('as paredes derivadas são determinísticas: a mesma geometria dá os mesmos ids', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(4, 2, 6, 4)));
  const ids = paredesDerivadas(m).map(p => p.id).sort(), outra = paredesDerivadas(structuredClone(m)).map(p => p.id).sort();
  assert.deepEqual(ids, outra); assert.equal(new Set(ids).size, ids.length);
});

import { chaveDoComodo, chaveDoObjeto, contextoDeEntradas, entradaDoComodo, entradaDoTerreno } from '../../src/render/entradas.ts';
import { salasDaAbertura } from '../../src/domain/geometria.ts';

test('uma porta numa parede compartilhada aparece nos dois cômodos; numa parede de fora, só no dono', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(4, 2, 6, 4)));
  const meio = Object.values(m.walls).find(p => p.path[0]![0] === 6 && p.path[1]![0] === 6)!;
  const topoA = Object.values(m.walls).find(p => p.path[0]![1] === 3 && p.path[1]![1] === 3 && dono(p) === 'a')!;
  m.openings.pm = porta(meio.id, 0.5, { id: 'pm' }); m.openings.pa = porta(topoA.id, 0.5, { id: 'pa', kind: 'window', width: 0.6 });
  assert.deepEqual(salasDaAbertura(m, m.openings.pm!).sort(), ['a', 'b']); assert.deepEqual(salasDaAbertura(m, m.openings.pa!), ['a']);
  const ctx = contextoDeEntradas(m), ea = entradaDoComodo(m, m.rooms.a!, ctx), eb = entradaDoComodo(m, m.rooms.b!, ctx);
  assert.deepEqual(ea.aberturas.map(x => x.tipo).sort(), ['door', 'window']); assert.deepEqual(eb.aberturas.map(x => x.tipo), ['door']);
  assert.deepEqual(eb.aberturas[0]!.centro, [6, 4.5]);
  assert.equal(salasDaAbertura(m, { wallId: 'fantasma', at: 0.5 }).length, 0);
});

test('a chave do cache muda só quando algo que aparece no cômodo muda', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(8, 2, 10, 4)));
  const chaveDe = (x: MapaAtlas, id: string) => chaveDoComodo(entradaDoComodo(x, x.rooms[id]!), 64);
  const antes = chaveDe(m, 'a');
  const outro = structuredClone(m); outro.rooms.b!.floor = { material: 'laje.pedra', seed: 9 };
  assert.equal(chaveDe(outro, 'a'), antes, 'mexer em outro cômodo não rebaixa este');
  assert.notEqual(chaveDe(outro, 'b'), chaveDe(m, 'b'));
  const lado = structuredClone(m); lado.rooms.a!.wallStyle = 'solid'; assert.notEqual(chaveDe(lado, 'a'), antes);
  const luz = structuredClone(m); luz.lights.x = { id: 'x', position: [3, 4], radius: 3, color: '#ffffff', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null, rays: false }; assert.equal(chaveDe(luz, 'a'), antes, 'luz não entra no piso');
  const topo = Object.values(m.walls).find(p => p.path[0]![1] === 3 && p.path[1]![1] === 3 && dono(p) === 'a')!;
  const comJanela = structuredClone(m); comJanela.openings.j = porta(topo.id, 0.5, { id: 'j', kind: 'window' }); assert.notEqual(chaveDe(comJanela, 'a'), antes);
});

test('objetos de parede entram no cômodo da face; objetos de piso têm chave por receita, semente e parâmetros', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  const topo = Object.values(m.walls).find(p => p.path[0]![1] === 3 && p.path[1]![1] === 3)!;
  const base = { interaction: null, rotation: 0, scale: 1, blocks: { move: false, sight: false }, castsShadow: false, harmonize: true } as const;
  m.props.q = { id: 'q', source: { kind: 'recipe', recipe: 'quadro', seed: 4, params: { largura: 1.2 } }, position: [4.5, 3], elevation: 'wall', wall: { wallId: topo.id, at: 0.5, face: 'inner' }, roomId: 'a', ...base };
  m.props.t = { id: 't', source: { kind: 'recipe', recipe: 'tapete.persa', seed: 2, params: {} }, position: [4.5, 4.5], elevation: 'floor', wall: null, roomId: 'a', ...base };
  const e = entradaDoComodo(m, m.rooms.a!);
  assert.deepEqual(e.objetos, [{ receita: 'quadro', params: { largura: 1.2 }, seed: 4, centro: [4.5, 3] }]);
  assert.equal(chaveDoObjeto(m.props.q!, 96), null); assert.match(chaveDoObjeto(m.props.t!, 96)!, /^illustrated\|o\|96\|tapete\.persa\|2\|\{\}$/);
  assert.notEqual(chaveDoObjeto(m.props.t!, 96), chaveDoObjeto({ ...m.props.t!, source: { kind: 'recipe', recipe: 'tapete.persa', seed: 2, params: { largura: 4 } } }, 96));
  assert.equal(chaveDoObjeto({ ...m.props.t!, position: [9, 9], rotation: 1 }, 96), chaveDoObjeto(m.props.t!, 96), 'posição e rotação não mudam o desenho');
  assert.equal(entradaDoTerreno(m).camadas.length, 0);
});

import { encaixarNaParede, encaixarObjetoDeParede } from '../../src/domain/geometria.ts';
import { copiasDe } from '../../src/domain/fabrica.ts';

test('encaixar uma porta: no meio da célula mais próxima, inteira dentro da parede, do lado certo', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)));                    // paredes de 3 m (2 células de 1,5 m), de 3 a 6
  const e = encaixarNaParede(m, [3.7, 2.7], 0.9)!;                         // perto do topo, à esquerda do meio
  assert.equal(e.parede.path[0]![1], 3); assert.equal(e.at, 0.25); assert.deepEqual(e.ponto, [3.75, 3]);   // meio da 1ª célula: 0,75 m de 3 m
  assert.equal(e.lado, -1, 'o ponteiro está acima de uma parede que vai para a direita');
  assert.equal(encaixarNaParede(m, [5.2, 3.4], 0.9)!.at, 0.75);
  assert.equal(encaixarNaParede(m, [5.2, 3.4], 0.9)!.lado, 1);
  assert.equal(encaixarNaParede(m, [20, 20], 0.9), null, 'longe de qualquer parede');
  assert.equal(encaixarNaParede(m, [4, 3], 3.5), null, 'não cabe numa parede de 3 m');
  const larga = encaixarNaParede(m, [3.1, 2.8], 2.0)!;                     // 2 m numa parede de 3 m: não pode sair da ponta
  assert.ok(Math.abs(larga.at - 1 / 3) < 1e-5); assert.ok(larga.at * 3 - 1 >= -1e-5);
});

test('encaixar um objeto de parede: na face do cômodo que está do lado do ponteiro', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(4, 2, 6, 4)));
  const naA = encaixarObjetoDeParede(m, [5.7, 4.5], 1)!, naB = encaixarObjetoDeParede(m, [6.3, 4.5], 1)!;     // a parede do meio, x = 6
  assert.equal(naA.roomId, 'a'); assert.equal(naB.roomId, 'b'); assert.equal(naA.parede.id, naB.parede.id);
  assert.equal(encaixarObjetoDeParede(m, [3, 2.6], 1), null, 'do lado de fora da casa não há cômodo');
  assert.equal(encaixarObjetoDeParede(m, [4.5, 3.3], 1)!.roomId, 'a', 'de dentro da sala, a face é a dela');
});

test('copiar itens: ids novos, deslocamento, e nada de dono ou luz compartilhados', () => {
  const base = mapaCom(sala('a', retangulo(2, 2, 4, 4)));
  base.props.mesa = { id: 'mesa', source: { kind: 'recipe', recipe: 'mesa.redonda', seed: 1, params: {} }, position: [4.5, 4.5], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: 'a', blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null };
  base.lights.l = { id: 'l', position: [4.5, 4.5], radius: 3, color: '#ffffff', intensity: 1, flicker: 0, cone: null, ownerId: 'mesa', power: 'fire', on: true, nightOnly: false, preset: 'vela', rays: false };
  base.tokens.t = { id: 't', name: 'Arthur', portrait: null, sprite: null, facing: 'down', position: [3, 3], size: 1, player: false, vision: { radius: 8, dark: false }, lightId: 'l', figure: { state: 'normal' }, refs: [] };
  const { comandos, alvos } = copiasDe(base, [{ colecao: 'props', id: 'mesa' }, { colecao: 'lights', id: 'l' }, { colecao: 'tokens', id: 't' }, { colecao: 'rooms', id: 'a' }, { colecao: 'props', id: 'fantasma' }], [0.75, 0]);
  assert.equal(comandos.length, 3); assert.equal(alvos.length, 3);                       // o cômodo e o que não existe ficam de fora
  assert.deepEqual(comandos.map(c => c.item.position), [[5.25, 4.5], [5.25, 4.5], [3.75, 3]]);
  assert.equal(comandos[1]!.item.ownerId, null); assert.equal(comandos[2]!.item.lightId, null); assert.equal(comandos[2]!.item.name, 'Arthur (cópia)');
  let m: MapaAtlas = base; for (const c of comandos) m = aplicarComandoParaTeste(m, c);
  validarMapa(m); assert.equal(Object.keys(m.props).length, 2);
});

import { aplicarComando as aplicarComandoParaTeste } from '../../src/state/comandos.ts';
const dono = (p: { source: unknown }) => (p.source as { roomId?: string } | null)?.roomId;
