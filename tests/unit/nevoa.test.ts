import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contem } from '../../src/domain/celulas.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { criarMapa, type Abertura, type MapaAtlas } from '../../src/domain/mapa.ts';
import { RES_NEVOA, celulasVisiveis, poligonosDeVisao } from '../../src/domain/nevoa.ts';
import { aplicarComando } from '../../src/state/comandos.ts';

/** Dois cômodos lado a lado separados por uma parede em x = 6 (de y = 0 a 12); uma peça de jogador em (3, 6). */
function dois(abertura?: Partial<Abertura>, jogadores: [number, number][] = [[3, 6]]): MapaAtlas {
  let m = criarMapa();
  m.walls.p = { id: 'p', path: [[6, 0], [6, 12]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null };
  if (abertura) m.openings.a = { id: 'a', wallId: 'p', at: 0.5, width: 1.2, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a', ...abertura };
  jogadores.forEach(([x, y], i) => { m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: { ...novaPeca([x, y]), id: `t${i}`, name: `P${i}`, player: true, vision: { radius: 20, dark: false } } as never }); });
  return m;
}
const ve = (m: MapaAtlas, x: number, y: number) => { const f = celulasVisiveis(m); return contem(f, Math.floor(x / RES_NEVOA), Math.floor(y / RES_NEVOA)); };

test('a peça vê o próprio cômodo e não o vizinho, com a parede entre os dois', () => {
  const m = dois();
  assert.ok(ve(m, 3, 6) && ve(m, 1, 2) && ve(m, 5.5, 11));
  assert.ok(!ve(m, 9, 6) && !ve(m, 8, 2));
});

test('com a porta aberta a peça vê pela porta; fechada, trancada ou janela, não', () => {
  const m = dois({ state: 'open' }, [[4.5, 6]]);
  assert.ok(ve(m, 9, 6), 'em frente à porta aberta');
  assert.ok(!ve(m, 9, 1), 'mas não tudo do outro lado');
  assert.ok(!ve(dois({ state: 'closed' }, [[4.5, 6]]), 9, 6));
  assert.ok(!ve(dois({ state: 'locked' }, [[4.5, 6]]), 9, 6));
  assert.ok(!ve(dois({ kind: 'window' }, [[4.5, 6]]), 9, 6), 'a janela deixa a luz, não a visão');
  assert.ok(ve(dois({ kind: 'arch' }, [[4.5, 6]]), 9, 6), 'o arco deixa ver');
});

test('duas peças somam a visão; peça de mestre e peça cega não veem', () => {
  const m = dois({ state: 'closed' }, [[3, 6], [9, 6]]);
  assert.ok(ve(m, 1, 2) && ve(m, 10, 2));
  assert.equal(poligonosDeVisao(m).length, 2);
  const mestre = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 't1', patch: { player: false } });
  assert.ok(!ve(mestre, 10, 2));
  const cega = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 't1', patch: { vision: { radius: 0 } } });
  assert.equal(poligonosDeVisao(cega).length, 1);
});

test('o raio de visão limita o alcance', () => {
  const m = aplicarComando(dois(), { tipo: 'item.atualizar', colecao: 'tokens', id: 't0', patch: { vision: { radius: 2 } } });
  assert.ok(ve(m, 3, 7) && !ve(m, 3, 10) && !ve(m, 0.3, 11.5));
});

import { area, contem as contemFaixa } from '../../src/domain/celulas.ts';
import { celulasExploradas } from '../../src/domain/nevoa.ts';
import { criarStore } from '../../src/state/store.ts';

const exp = (m: MapaAtlas, x: number, y: number) => { const r = m.session.explored?.res ?? RES_NEVOA; return contemFaixa(m.session.explored?.cells ?? [], Math.floor(x / r), Math.floor(y / r)); };

test('mover uma peça de jogador acumula o explorado e nunca o encolhe; desfazer devolve o de antes', () => {
  const store = criarStore(dois({ state: 'open', at: 6.75 / 12 }, [[3, 6]]));
  assert.equal(store.documento.session.explored, null);
  store.executar({ tipo: 'peca.mover', id: 't0', para: [4.5, 6.75] });
  const a = store.documento.session.explored!; assert.equal(a.res, RES_NEVOA); const areaA = area(a.cells);
  assert.ok(exp(store.documento, 1, 2) && !exp(store.documento, 9, 1));
  store.executar({ tipo: 'peca.mover', id: 't0', para: [8.25, 6.75] });         // passa pela porta aberta
  const b = store.documento.session.explored!; assert.ok(area(b.cells) > areaA);
  assert.ok(exp(store.documento, 10, 6), 'viu o outro lado'); assert.ok(exp(store.documento, 1, 2), 'e o primeiro cômodo continua explorado');
  store.executar({ tipo: 'peca.mover', id: 't0', para: [3.75, 6.75] });
  assert.ok(area(store.documento.session.explored!.cells) >= area(b.cells), 'voltar não encolhe');
  store.desfazer(); store.desfazer();
  assert.deepEqual(store.documento.session.explored, a, 'desfazer devolve o explorado de antes');
});

test('peça do mestre não explora; "esquecer" zera; revelar faz o cômodo contar como explorado', () => {
  let m = dois({ state: 'open' }, [[3, 6]]);
  m = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 't0', patch: { player: false } });
  assert.equal(aplicarComando(m, { tipo: 'peca.mover', id: 't0', para: [4.5, 6.75] }).session.explored, null);
  m = aplicarComando(dois({ state: 'open' }), { tipo: 'peca.mover', id: 't0', para: [4.5, 6.75] });
  assert.ok(m.session.explored);
  assert.equal(aplicarComando(m, { tipo: 'sessao.esquecer' }).session.explored, null);
  // Um cômodo à direita da parede, revelado pelo mestre.
  const cels = [[9, 7], [9, 8], [10, 7], [10, 8]];   // x de 13,5 a 16,5; y de 10,5 a 13,5
  m = aplicarComando(m, { tipo: 'comodo.criar', id: 'sala', nome: 'Sala', funcao: null, piso: { material: 'tabuas.carvalho', seed: 1 }, papel: null, celulas: cels } as never);
  assert.ok(!contemFaixa(celulasExploradas(m), Math.floor(15 / RES_NEVOA), Math.floor(11.5 / RES_NEVOA)));
  const rev = aplicarComando(m, { tipo: 'sessao.revelar', ids: ['sala'] });
  assert.deepEqual(rev.session.revealed, ['sala']); assert.ok(contemFaixa(celulasExploradas(rev), Math.floor(15 / RES_NEVOA), Math.floor(11.5 / RES_NEVOA)), 'o centro do cômodo conta como explorado');
  assert.deepEqual(aplicarComando(rev, { tipo: 'sessao.ocultar', ids: ['sala'] }).session.revealed, []);
  assert.throws(() => aplicarComando(m, { tipo: 'sessao.revelar', ids: ['nao-existe'] }), /não é um cômodo/);
});

import { comodosConhecidos } from '../../src/domain/nevoa.ts';

test('um cômodo é conhecido se algum pedaço dele (ou o lado de fora das suas paredes) está à vista ou explorado', () => {
  let m = dois({ state: 'closed' }, [[3, 6]]);
  const sala = (id: string, cels: number[][]) => ({ tipo: 'comodo.criar', id, nome: id, funcao: null, piso: { material: 'tabuas.carvalho', seed: 1 }, papel: null, celulas: cels }) as never;
  m = aplicarComando(m, sala('aqui', [[1, 2], [1, 3], [2, 2], [2, 3]]));      // do lado da peça
  m = aplicarComando(m, sala('la', [[9, 7], [9, 8], [10, 7], [10, 8]]));       // do outro lado da parede
  assert.deepEqual([...comodosConhecidos(m)], ['aqui']);
  const revelado = aplicarComando(m, { tipo: 'sessao.revelar', ids: ['la'] });
  assert.deepEqual([...comodosConhecidos(revelado)].sort(), ['aqui', 'la']);
});
