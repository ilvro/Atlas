import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { novoObjeto, novaPeca } from '../../src/domain/fabrica.ts';
import { recalcularParedes } from '../../src/domain/geometria.ts';
import { criarMapa, type Abertura, type Comodo, type MapaAtlas, type Ponto } from '../../src/domain/mapa.ts';
import { IndiceDeSegmentos, oclusorDeToken, oclusores, oclusoresDeObjetos, oclusoresDeTokens, poligonoIluminado, segmentosParaFonte } from '../../src/domain/visibilidade.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';

const retangulo = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
const sala = (id: string, cells: [number, number][]): Comodo => ({ id, name: id, function: null, cells: codificar(cells), floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null });
const mapaCom = (...salas: Comodo[]): MapaAtlas => { const m = criarMapa({ id: 'm', agora: 1 }); for (const s of salas) m.rooms[s.id] = s; recalcularParedes(m); return m; };
const abertura = (m: MapaAtlas, wallId: string, extra: Partial<Abertura> = {}): Abertura => { const a: Abertura = { id: 'ab', wallId, at: 0.5, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a', ...extra }; m.openings[a.id] = a; return a; };
/** Quanto do polígono (lista plana) cobre: área pela fórmula do cadarço. */
const area = (p: number[]): number => { let s = 0; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) s += p[j]! * p[i + 1]! - p[i]! * p[j + 1]!; return Math.abs(s) / 2; };
const dentro = (p: number[], x: number, y: number): boolean => { let d = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const xi = p[i]!, yi = p[i + 1]!, xj = p[j]!, yj = p[j + 1]!; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; };
/** A parede de baixo ou de cima de um cômodo que fica entre duas salas. */
const paredeEntre = (m: MapaAtlas, x: number) => Object.values(m.walls).find(w => w.path.every(q => q[0] === x))!;

test('um cômodo fechado não deixa a luz vazar', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 6, 6)));      // de 3 m a 9 m
  const segs = oclusores(m, 'luz'), p = poligonoIluminado([6, 6], segs, 20, null);
  assert.ok(area(p) < 6 * 6 * 1.01, 'a luz fica dentro do cômodo de 6 × 6 m');
  assert.ok(!dentro(p, 12, 6) && !dentro(p, 6, 12));
});

test('porta fechada bloqueia, aberta deixa passar; porta secreta idem; arco sempre passa', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(4, 2, 6, 4)));    // dividem a parede em x = 6
  const meio = paredeEntre(m, 6), fechado = () => poligonoIluminado([4.5, 4.5], oclusores(m, 'luz'), 12, null);
  const porta = abertura(m, meio.id, { at: 0.5, width: 1.2 });
  assert.ok(!dentro(fechado(), 7.5, 4.5), 'porta fechada: o outro cômodo fica escuro');
  porta.state = 'open'; assert.ok(dentro(fechado(), 7.5, 4.5), 'porta aberta: a luz passa pelo vão');
  assert.ok(!dentro(fechado(), 7.5, 3.1), 'só pelo vão: a parede ao lado continua bloqueando');
  porta.state = 'locked'; assert.ok(!dentro(fechado(), 7.5, 4.5));
  porta.kind = 'secret'; porta.state = 'open'; assert.ok(dentro(fechado(), 7.5, 4.5));
  porta.kind = 'arch'; porta.state = 'closed'; assert.ok(dentro(fechado(), 7.5, 4.5), 'um arco nunca fecha');
});

test('janela deixa passar a luz, mas não a visão', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 4, 4)), sala('b', retangulo(4, 2, 6, 4)));
  abertura(m, paredeEntre(m, 6).id, { kind: 'window', width: 1.2 });
  assert.ok(dentro(poligonoIluminado([4.5, 4.5], oclusores(m, 'luz'), 12, null), 7.5, 4.5));
  assert.ok(!dentro(poligonoIluminado([4.5, 4.5], oclusores(m, 'visao'), 12, null), 7.5, 4.5));
});

test('o vão recorta a parede em dois pedaços, também numa parede dobrada', () => {
  const m = criarMapa({ id: 'm', agora: 1 });
  m.walls.w = { id: 'w', path: [[0, 0], [4, 0], [4, 4]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null };
  assert.equal(oclusores(m, 'luz').length, 2);
  abertura(m, 'w', { kind: 'arch', at: 0.25, width: 2 });                 // centro a 2 m: de 1 a 3 m
  const s = oclusores(m, 'luz'); assert.equal(s.length, 3);
  assert.deepEqual(s[0], { a: [0, 0], b: [1, 0] }); assert.deepEqual(s[1], { a: [3, 0], b: [4, 0] }); assert.deepEqual(s[2], { a: [4, 0], b: [4, 4] });
  abertura(m, 'w', { id: 'dobra', kind: 'arch', at: 0.5, width: 1 });      // sobre a dobra (4 m de 8): de 3,5 a 4,5 m
  assert.equal(oclusores(m, 'luz').length, 3);                            // o trecho vertical perde o começo, o horizontal perde o fim
  m.walls.w!.blocks.light = false; assert.equal(oclusores(m, 'luz').length, 0);
});

test('um cone de 60° não ilumina atrás de si', () => {
  const cone = { angle: Math.PI / 3, direction: 0 }, p = poligonoIluminado([10, 10], [], 8, cone);
  assert.ok(dentro(p, 14, 10) && !dentro(p, 6, 10) && !dentro(p, 10, 15), 'só à frente');
  assert.ok(Math.abs(area(p) - (Math.PI * 64) / 6) < 1.5, 'cerca de um sexto do disco');
  assert.deepEqual(p.slice(0, 2), [10, 10]);
});

test('o alcance limita o polígono', () => {
  const p = poligonoIluminado([0, 0], [], 5, null);
  assert.ok(Math.abs(area(p) - Math.PI * 25) < 1.5);
  for (let i = 0; i < p.length; i += 2) assert.ok(Math.hypot(p[i]!, p[i + 1]!) <= 5 + 1e-9);
});

test('o índice devolve o mesmo polígono que a lista inteira', () => {
  const m = mapaCom(sala('a', retangulo(2, 2, 6, 5)), sala('b', retangulo(6, 2, 9, 5)), sala('c', retangulo(2, 5, 9, 8)), sala('longe', retangulo(40, 40, 44, 44)));
  abertura(m, paredeEntre(m, 9).id, { kind: 'arch', width: 1 });
  const todos = oclusores(m, 'luz'), indice = new IndiceDeSegmentos(todos);
  for (const o of [[6, 6], [11, 6], [20, 8], [42, 42], [3.3, 3.3]] as Ponto[]) {
    for (const cone of [null, { angle: 1.2, direction: 0.7 }]) {
      assert.deepEqual(poligonoIluminado(o, indice.perto(o, 9), 9, cone), poligonoIluminado(o, todos, 9, cone));
    }
  }
  assert.ok(indice.perto([6, 6], 9).length < todos.length, 'o índice descarta o que está longe');
});

test('pilar quadrado e armário rotacionado projetam cone de sombra atrás de uma luz próxima', () => {
  const m = criarMapa({ id: 'm', agora: 1 });
  m.props.pilar = novoObjeto([6, 5], { id: 'pilar', source: ACERVO.fonte('pilar', 1), scale: 2 }); // 1 m × 1 m quadrado -> octógono
  m.props.armario = novoObjeto([10, 10], { id: 'armario', source: ACERVO.fonte('armario', 1), rotation: Math.PI / 4 }); // 1.2 m × 0.6 m rotacionado

  const objs = oclusoresDeObjetos(m);
  assert.equal(objs.length, 2);
  assert.equal(objs.find(o => o.id === 'pilar')!.segmentos.length, 8, 'pilar quadrado vira octógono inscrito');
  assert.equal(objs.find(o => o.id === 'armario')!.segmentos.length, 4, 'armário retangular tem 4 lados');

  const segsPilar = segmentosParaFonte([4, 5], [], objs);
  const pPilar = poligonoIluminado([4, 5], segsPilar, 10, null);
  assert.ok(dentro(pPilar, 5.2, 5), 'antes do pilar está iluminado');
  assert.ok(!dentro(pPilar, 8, 5), 'atrás do pilar fica na sombra');
  assert.ok(dentro(pPilar, 8, 7), 'ao lado do cone de sombra continua iluminado');

  // Luz a sudoeste do armário girado a 45° projeta sombra na diagonal nordeste/oposta
  const posLuzArmario: Ponto = [8.5, 8.5];
  const pArmario = poligonoIluminado(posLuzArmario, segmentosParaFonte(posLuzArmario, [], objs), 10, null);
  assert.ok(!dentro(pArmario, 11.8, 11.8), 'atrás do armário rotacionado fica na sombra');
  assert.ok(dentro(pArmario, 11, 8.5), 'fora da sombra lateral do armário continua iluminado');
});

test('objetos baixos, iluminação, escadas e árvores sem bloqueio de visão não bloqueiam luz', () => {
  const m = criarMapa({ id: 'm', agora: 1 });
  m.props.tapete = novoObjeto([5, 5], { id: 'tapete', source: ACERVO.fonte('tapete.persa', 1) });
  m.props.mesa = novoObjeto([7, 5], { id: 'mesa', source: ACERVO.fonte('mesa.retangular', 1) });
  m.props.poste = novoObjeto([9, 5], { id: 'poste', source: ACERVO.fonte('poste.luz', 1) });
  m.props.escada = novoObjeto([11, 5], { id: 'escada', source: ACERVO.fonte('escada.madeira', 1) });
  m.props.arvore = novoObjeto([13, 5], { id: 'arvore', source: ACERVO.fonte('casa:arvore-5m', 1) });
  m.props.cerca = novoObjeto([15, 5], { id: 'cerca', source: ACERVO.fonte('cerca', 1) });

  assert.equal(oclusoresDeObjetos(m).length, 0);
  const p = poligonoIluminado([3, 5], segmentosParaFonte([3, 5], [], oclusoresDeObjetos(m)), 15, null);
  assert.ok(dentro(p, 16, 5), 'luz atravessa tapetes, mesas, postes, escadas, árvores e cercas');
});

test('luz posicionada dentro ou sobre uma lareira não sofre auto-oclusão, mas respeita filtros e overrides', () => {
  const m = criarMapa({ id: 'm', agora: 1 });
  m.props.lareira = novoObjeto([6, 5], { id: 'lareira', source: ACERVO.fonte('lareira.pedra', 1) });
  m.props.mesaBloq = novoObjeto([10, 5], { id: 'mesaBloq', source: ACERVO.fonte('mesa.retangular', 1), blocks: { move: true, sight: false, light: true } });
  m.props.pilarOff = novoObjeto([3, 5], { id: 'pilarOff', source: ACERVO.fonte('pilar', 1), blocks: { move: true, sight: true, light: false } });
  m.props.oculto = novoObjeto([6, 8], { id: 'oculto', source: ACERVO.fonte('pilar', 1), oculto: true });
  m.props.paredeProp = novoObjeto([6, 2], { id: 'paredeProp', source: ACERVO.fonte('estante', 1), elevation: 'wall' });
  m.props.andar2 = novoObjeto([6, 10], { id: 'andar2', source: ACERVO.fonte('pilar', 1), levelId: 'a2' });

  const objsTerreo = oclusoresDeObjetos(m);
  assert.deepEqual(objsTerreo.map(o => o.id).sort(), ['lareira', 'mesaBloq']);
  assert.deepEqual(oclusoresDeObjetos(m, { levelId: 'a2' }).map(o => o.id), ['andar2']);

  // Luz dentro da lareira não é bloqueada pela própria lareira, mas continua bloqueada por mesaBloq
  const segsLareira = segmentosParaFonte([6, 5], [], objsTerreo);
  const pLareira = poligonoIluminado([6, 5], segsLareira, 8, null);
  assert.ok(dentro(pLareira, 6, 8), 'luz na lareira ilumina o cômodo sem auto-oclusão');
  assert.ok(dentro(pLareira, 3, 5), 'pilar com blocks.light=false não bloqueia');
  assert.ok(!dentro(pLareira, 12, 5), 'objeto com blocks.light=true projeta sombra atrás de si');
});

test('oclusor de token ignora mortos/outro andar e não bloqueia a lanterna do próprio portador', () => {
  const m = criarMapa({ id: 'm', agora: 1 });
  m.tokens.portador = novaPeca([4, 5], 'Investigador', { id: 'portador', size: 1, lightId: 'l1' });
  m.tokens.aliado = novaPeca([7, 5], 'Aliado', { id: 'aliado', size: 1.5 });
  m.tokens.morto = novaPeca([4, 8], 'Caído', { id: 'morto', figure: { state: 'dead' } });
  m.tokens.andar2 = novaPeca([4, 2], 'Outro andar', { id: 'andar2', levelId: 'a2' });

  assert.equal(oclusorDeToken(m.tokens.portador).length, 8, 'octógono leve');
  const tokens = oclusoresDeTokens(m);
  assert.deepEqual(tokens.map(t => t.id).sort(), ['aliado', 'portador']);
  assert.ok(Math.abs(tokens.find(t => t.id === 'portador')!.raio - 0.28) < 1e-6);
  assert.ok(Math.abs(tokens.find(t => t.id === 'aliado')!.raio - 0.42) < 1e-6);

  // Lanterna na mão do portador (0.35 m à frente, dentro de r + 0.15 = 0.43 m) não sofre auto-oclusão, mas gera sombra atrás do aliado
  const posLanterna: Ponto = [4.35, 5];
  const segs = segmentosParaFonte(posLanterna, [], [], tokens, { ownerId: 'portador', lightId: 'l1' });
  const poli = poligonoIluminado(posLanterna, segs, 10, null);
  assert.ok(dentro(poli, 2, 5), 'ilumina atrás do próprio portador sem auto-bloqueio');
  assert.ok(dentro(poli, 5.5, 5), 'ilumina entre os dois tokens');
  assert.ok(!dentro(poli, 9.5, 5), 'segundo token projeta sombra atrás de si');
});
