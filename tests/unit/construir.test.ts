import { celulasDoDisco, celulasEntre } from '../../src/domain/celulas.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodificar } from '../../src/domain/celulas.ts';
import { criarMapa, type Abertura, type MapaAtlas } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ErroDeComando, aplicarComando, type Comando } from '../../src/state/comandos.ts';
import { diferencas } from '../../src/state/mudancas.ts';
import { criarStore } from '../../src/state/store.ts';

const piso = { material: 'tabuas.carvalho', seed: 1 }, papel = { material: 'papel.damasco-vinho', seed: 2 };
const retangulo = (x0: number, y0: number, x1: number, y1: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]); return c; };
const criar = (id: string, celulas: [number, number][]): Comando => ({ tipo: 'comodo.criar', id, nome: id, funcao: null, piso, papel, celulas });
const porta = (wallId: string, at: number, id = 'p1', extra: Partial<Abertura> = {}): Abertura => ({ id, wallId, at, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a', ...extra });
const comAs = (m: MapaAtlas, ...cs: Comando[]) => cs.reduce(aplicarComando, m);
const celulasDe = (m: MapaAtlas, id: string) => decodificar(m.rooms[id]!.cells).map(c => c.join(',')).sort();

test('criar um cômodo põe piso, papel e as quatro paredes, e o resultado é um mapa válido', () => {
  const m = comAs(criarMapa(), criar('sala', retangulo(2, 2, 6, 5)));
  validarMapa(m);
  assert.deepEqual(m.rooms.sala!.floor, piso); assert.deepEqual(m.rooms.sala!.wallpaper, papel);
  assert.equal(decodificar(m.rooms.sala!.cells).length, 12); assert.equal(Object.keys(m.walls).length, 4);
  assert.throws(() => aplicarComando(m, criar('sala', [[0, 0]])), /Já existe/);
  assert.throws(() => aplicarComando(m, criar('x', [])), /pelo menos uma célula/);
  assert.throws(() => aplicarComando(m, criar('x', [[-1, 0]])), /Célula inválida/);
  assert.throws(() => aplicarComando(m, criar('x', [[0.5, 0]])), /Célula inválida/);
  assert.throws(() => aplicarComando(m, criar('x', [[99, 0]])), (e: unknown) => e instanceof ErroDeComando && /rooms\.x\.cells/.test(e.message));   // fora do mapa de 30 × 20
});

test('pintar estende o cômodo e as paredes acompanham; pintar sobre outro cômodo toma as células dele', () => {
  let m = comAs(criarMapa(), criar('a', retangulo(2, 2, 4, 4)), criar('b', retangulo(6, 2, 8, 4)));
  m = aplicarComando(m, { tipo: 'comodo.pintar', id: 'a', celulas: retangulo(4, 2, 6, 4) });
  assert.equal(celulasDe(m, 'a').length, 8);
  // A e B agora se encostam: uma parede só no meio.
  assert.equal(Object.values(m.walls).filter(p => p.path[0]![0] === 9 && p.path[1]![0] === 9).length, 1);
  const tomado = aplicarComando(m, { tipo: 'comodo.pintar', id: 'b', celulas: [[5, 2], [5, 3]] });
  assert.equal(celulasDe(tomado, 'a').length, 6); assert.equal(celulasDe(tomado, 'b').length, 6);
  assert.ok(!celulasDe(tomado, 'a').includes('5,2'));
  validarMapa(tomado);
  assert.throws(() => aplicarComando(m, { tipo: 'comodo.pintar', id: 'nada', celulas: [[0, 0]] }), /não existe/);
});

test('apagar células encolhe o cômodo; apagar tudo o remove e leva o que dependia dele', () => {
  let m = comAs(criarMapa(), criar('a', retangulo(2, 2, 5, 4)));
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'props', item: { id: 'mesa', source: { kind: 'recipe', recipe: 'mesa.redonda', seed: 1, params: {} }, position: [4.5, 4.5], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true } });
  assert.equal(m.props.mesa!.roomId, 'a');
  m = aplicarComando(m, { tipo: 'comodo.apagar', celulas: [[4, 2], [4, 3]] });
  assert.equal(celulasDe(m, 'a').length, 4); assert.equal(Object.keys(m.walls).length, 4);
  m = aplicarComando(m, { tipo: 'comodo.apagar', celulas: retangulo(2, 2, 4, 4) });
  assert.deepEqual([Object.keys(m.rooms), Object.keys(m.walls)], [[], []]);
  assert.equal(m.props.mesa!.roomId, null, 'o objeto fica, só sem cômodo');
});

test('atualizar o cômodo muda piso, papel e estilo de parede, mas não identidade nem células', () => {
  const m = comAs(criarMapa(), criar('a', retangulo(2, 2, 4, 4)));
  const d = aplicarComando(m, { tipo: 'comodo.atualizar', id: 'a', patch: { name: 'Sala de estar', function: 'sala', floor: { material: 'ladrilho.xadrez' }, wallStyle: 'solid' } });
  assert.deepEqual([d.rooms.a!.name, d.rooms.a!.function, d.rooms.a!.floor, d.rooms.a!.wallStyle], ['Sala de estar', 'sala', { material: 'ladrilho.xadrez', seed: 1 }, 'solid']);
  assert.throws(() => aplicarComando(m, { tipo: 'comodo.atualizar', id: 'a', patch: { id: 'b' } as never }), /não se editam/);
  assert.throws(() => aplicarComando(m, { tipo: 'comodo.atualizar', id: 'a', patch: { wallStyle: 'lateral' } as never }), /rooms\.a\.wallStyle/);
  assert.equal(aplicarComando(m, { tipo: 'comodo.remover', id: 'a' }).rooms.a, undefined);
  assert.equal(Object.keys(aplicarComando(m, { tipo: 'comodo.remover', id: 'a' }).walls).length, 0);
});

test('abertura: cabe, não sobrepõe, e acompanha a parede quando o cômodo cresce', () => {
  let m = comAs(criarMapa(), criar('a', retangulo(2, 2, 4, 4)));
  const topo = Object.values(m.walls).find(p => p.path[0]![1] === 3 && p.path[1]![1] === 3)!;
  m = aplicarComando(m, { tipo: 'abertura.adicionar', abertura: porta(topo.id, 0.5) });
  assert.throws(() => aplicarComando(m, { tipo: 'abertura.adicionar', abertura: porta(topo.id, 0.6, 'p2') }), /Já há uma abertura/);
  assert.throws(() => aplicarComando(m, { tipo: 'abertura.adicionar', abertura: porta(topo.id, 0.02, 'p2') }), /não cabe/);
  assert.throws(() => aplicarComando(m, { tipo: 'abertura.adicionar', abertura: porta('fantasma', 0.5, 'p2') }), /não existe/);
  assert.throws(() => aplicarComando(m, { tipo: 'abertura.adicionar', abertura: porta(topo.id, 0.5) }), /Já existe/);
  const janela = aplicarComando(m, { tipo: 'abertura.adicionar', abertura: porta(topo.id, 0.85, 'j1', { kind: 'window', width: 0.6 }) });
  validarMapa(janela);
  const abriu = aplicarComando(m, { tipo: 'abertura.atualizar', id: 'p1', patch: { state: 'open', swing: 'b' } });
  assert.deepEqual([abriu.openings.p1!.state, abriu.openings.p1!.swing], ['open', 'b']);
  assert.throws(() => aplicarComando(janela, { tipo: 'abertura.atualizar', id: 'j1', patch: { at: 0.5 } }), /Já há/);
  const maior = aplicarComando(m, { tipo: 'comodo.pintar', id: 'a', celulas: retangulo(4, 2, 6, 4) });
  assert.equal(Object.keys(maior.openings).length, 1, 'a porta continua, na parede nova');
  assert.equal(aplicarComando(m, { tipo: 'abertura.remover', id: 'p1' }).openings.p1, undefined);
});

test('parede manual: desenhar, desanexar a derivada, remover só a que é sua', () => {
  let m = comAs(criarMapa(), criar('a', retangulo(2, 2, 4, 4)));
  const nova = { id: 'm1', path: [[10, 10], [13, 10]] as [number, number][], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall' as const, blocks: { move: true, sight: true, light: true } };
  m = aplicarComando(m, { tipo: 'parede.adicionar', parede: nova });
  assert.equal(m.walls.m1!.source, null); assert.equal(Object.keys(m.walls).length, 5);
  assert.throws(() => aplicarComando(m, { tipo: 'parede.adicionar', parede: { ...nova, id: 'm2', path: [[1, 1], [1, 1]] } }), /dois pontos diferentes/);
  const derivada = Object.values(m.walls).find(p => p.source)!;
  assert.throws(() => aplicarComando(m, { tipo: 'parede.remover', id: derivada.id }), /segue o cômodo/);
  assert.throws(() => aplicarComando(m, { tipo: 'parede.desanexar', id: 'm1' }), /já é sua/);
  const solta = aplicarComando(m, { tipo: 'parede.desanexar', id: derivada.id });
  assert.equal(solta.walls[derivada.id]!.source, null);
  const semCelulas = aplicarComando(solta, { tipo: 'comodo.remover', id: 'a' });
  assert.deepEqual(Object.keys(semCelulas.walls).sort(), [derivada.id, 'm1'].sort());
  const semParede = aplicarComando(semCelulas, { tipo: 'parede.remover', id: derivada.id });
  assert.deepEqual(Object.keys(semParede.walls), ['m1']);
  assert.equal(aplicarComando(m, { tipo: 'parede.atualizar', id: 'm1', patch: { height: 1.1, kind: 'low' } }).walls.m1!.height, 1.1);
});

test('remover uma parede manual leva as aberturas dela', () => {
  let m = comAs(criarMapa(), { tipo: 'parede.adicionar', parede: { id: 'm1', path: [[3, 3], [9, 3]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true } } });
  m = aplicarComando(m, { tipo: 'abertura.adicionar', abertura: porta('m1', 0.5) });
  assert.deepEqual(Object.keys(aplicarComando(m, { tipo: 'parede.remover', id: 'm1' }).openings), []);
});

test('terreno: uma camada por material, pintar rouba da outra, apagar limpa, e base muda', () => {
  let m = comAs(criarMapa(), { tipo: 'terreno.pintar', material: 'grama', celulas: retangulo(0, 0, 10, 5) });
  assert.deepEqual(Object.keys(m.terrain.layers), ['t_grama']);
  m = aplicarComando(m, { tipo: 'terreno.pintar', material: 'terra', celulas: retangulo(8, 0, 12, 5) });
  assert.deepEqual(Object.keys(m.terrain.layers).sort(), ['t_grama', 't_terra']);
  assert.equal(decodificar(m.terrain.layers.t_grama!.cells).length, 8 * 5);          // perdeu 2 colunas
  assert.equal(decodificar(m.terrain.layers.t_terra!.cells).length, 4 * 5);
  m = aplicarComando(m, { tipo: 'terreno.apagar', celulas: retangulo(0, 0, 12, 5) });
  assert.deepEqual(m.terrain.layers, {});
  assert.equal(aplicarComando(m, { tipo: 'terreno.base', material: 'neve' }).terrain.base, 'neve');
  assert.throws(() => aplicarComando(m, { tipo: 'terreno.pintar', material: 'grama', celulas: [[500, 0]] }), /terrain\.layers/);
});

test('construir pelo store: um gesto de pintar é uma entrada de histórico e desfaz por inteiro', () => {
  const s = criarStore(criarMapa());
  s.executar(criar('a', [[2, 2]]), { rotulo: 'Criar cômodo' });
  const g = s.iniciarGesto('Pintar cômodo');
  for (let x = 3; x < 10; x++) g.aplicar({ tipo: 'comodo.pintar', id: 'a', celulas: [[x, 2]] });
  assert.equal(celulasDe(s.documento, 'a').length, 8); g.concluir();
  assert.deepEqual(s.historico, ['Criar cômodo', 'Pintar cômodo']);
  s.desfazer(); assert.equal(celulasDe(s.documento, 'a').length, 1); assert.equal(Object.keys(s.documento.walls).length, 4);
  s.desfazer(); assert.equal(Object.keys(s.documento.rooms).length, 0); assert.equal(Object.keys(s.documento.walls).length, 0);
  s.refazer(); s.refazer(); assert.equal(celulasDe(s.documento, 'a').length, 8);
  assert.deepEqual(diferencas(s.documento, aplicarComando(s.documento, { tipo: 'comodo.pintar', id: 'a', celulas: [[12, 2]] })).colecoes.rooms, ['a']);
});

test('uma casa de três cômodos com portas passa na validação em todos os passos do histórico', () => {
  const s = criarStore(criarMapa());
  s.executar(criar('sala', retangulo(2, 2, 7, 6))); s.executar(criar('cozinha', retangulo(7, 2, 10, 6))); s.executar(criar('quarto', retangulo(2, 6, 7, 9)));
  const divisa = Object.values(s.documento.walls).find(p => p.path[0]![0] === 10.5 && p.path[1]![0] === 10.5 && p.path[0]![1] === 3)!;   // a parede entre a sala e a cozinha
  s.executar({ tipo: 'abertura.adicionar', abertura: porta(divisa.id, 0.5) });
  const antes: MapaAtlas[] = [s.documento];
  while (s.podeDesfazer) antes.push(s.desfazer());
  for (const d of antes) validarMapa(d);
  assert.equal(antes.length, 5);   // o mapa de agora e mais 4 passos para trás: 3 cômodos e 1 porta
});

test('notas do cômodo: criam a entrada quando há algo escrito e a apagam quando fica vazia', () => {
  let m = comAs(criarMapa(), criar('a', retangulo(2, 2, 4, 4)));
  m = aplicarComando(m, { tipo: 'comodo.notas', id: 'a', patch: { leitura: 'O ar cheira a cera.', notasMestre: 'A carta está atrás do quadro.' } });
  assert.deepEqual(m.comodosExtra.a, { id: 'a', leitura: 'O ar cheira a cera.', notasMestre: 'A carta está atrás do quadro.', refs: [] });
  m = aplicarComando(m, { tipo: 'comodo.notas', id: 'a', patch: { refs: [{ app: 'atelie', tipo: 'documento', id: 'carta-queimada', rev: 3 }] } });
  assert.equal(m.comodosExtra.a!.refs.length, 1); assert.equal(m.comodosExtra.a!.leitura, 'O ar cheira a cera.', 'o resto fica');
  assert.throws(() => aplicarComando(m, { tipo: 'comodo.notas', id: 'a', patch: { refs: [{ app: 'zzz' } as never] } }), /comodosExtra\.a\.refs/);
  assert.throws(() => aplicarComando(m, { tipo: 'comodo.notas', id: 'nada', patch: { leitura: 'x' } }), /não existe/);
  m = aplicarComando(m, { tipo: 'comodo.notas', id: 'a', patch: { leitura: '', notasMestre: '', refs: [] } });
  assert.deepEqual(m.comodosExtra, {});
  // E as notas vão embora junto com o cômodo.
  const com = aplicarComando(aplicarComando(m, { tipo: 'comodo.notas', id: 'a', patch: { leitura: 'x' } }), { tipo: 'comodo.remover', id: 'a' });
  assert.deepEqual(com.comodosExtra, {});
});

test('fundo: a cartela de título entra e sai por comando', () => {
  let m = aplicarComando(criarMapa(), { tipo: 'fundo.atualizar', patch: { title: { text: 'Casa dos Salgueiros', font: 'Cinzel', position: [30, 27] } } });
  assert.equal(m.backdrop.title!.text, 'Casa dos Salgueiros');
  m = aplicarComando(m, { tipo: 'fundo.atualizar', patch: { title: { text: 'Casa dos Salgueiros', font: 'Cinzel', position: [2, 2] } } });
  assert.deepEqual([m.backdrop.title!.text, m.backdrop.title!.position], ['Casa dos Salgueiros', [2, 2]]);
  m = aplicarComando(m, { tipo: 'fundo.atualizar', patch: { title: null } });
  assert.equal(m.backdrop.title, null);
});

// ---- pincel: linhas e discos de células ----
test('celulasEntre liga duas células sem buracos, nos dois sentidos', () => {
  const ida = celulasEntre([0, 0], [5, 2]), volta = celulasEntre([5, 2], [0, 0]);
  assert.deepEqual(ida[0], [0, 0]); assert.deepEqual(ida.at(-1), [5, 2]);
  assert.equal(ida.length, 6);                                   // uma célula por coluna: nunca pula
  for (let k = 1; k < ida.length; k++) assert.ok(Math.abs(ida[k]![0] - ida[k - 1]![0]) <= 1 && Math.abs(ida[k]![1] - ida[k - 1]![1]) <= 1);
  assert.equal(volta.length, ida.length);
  assert.deepEqual(celulasEntre([3, 3], [3, 3]), [[3, 3]]);
});

test('celulasDoDisco devolve as células cujo centro cabe no círculo e respeita os limites', () => {
  const d = celulasDoDisco([5, 5], 1.5, 1, 20, 20);
  assert.ok(d.some(([i, j]) => i === 4 && j === 4) && d.some(([i, j]) => i === 5 && j === 5));
  assert.ok(d.every(([i, j]) => Math.hypot(i + 0.5 - 5, j + 0.5 - 5) <= 1.5));
  assert.ok(celulasDoDisco([0.2, 0.2], 3, 1, 20, 20).every(([i, j]) => i >= 0 && j >= 0));    // não sai pela borda
  assert.deepEqual(celulasDoDisco([50, 50], 1, 1, 20, 20), []);
});
