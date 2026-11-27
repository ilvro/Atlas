import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contem } from '../../src/domain/celulas.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { criarMapa, type Abertura, type MapaAtlas } from '../../src/domain/mapa.ts';
import { RES_NEVOA, celulasVisiveis, poligonosDeVisao, tokensDeVisaoAtivos } from '../../src/domain/nevoa.ts';
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

test('com porta aberta, arco ou janela a peça vê através da abertura; fechada ou trancada, não', () => {
  const m = dois({ state: 'open' }, [[4.5, 6]]);
  assert.ok(ve(m, 9, 6), 'em frente à porta aberta');
  assert.ok(!ve(m, 9, 1), 'mas não tudo do outro lado');
  assert.ok(!ve(dois({ state: 'closed' }, [[4.5, 6]]), 9, 6));
  assert.ok(!ve(dois({ state: 'locked' }, [[4.5, 6]]), 9, 6));
  assert.ok(ve(dois({ kind: 'window' }, [[4.5, 6]]), 9, 6), 'a janela deixa ver o outro lado');
  assert.ok(!ve(dois({ kind: 'window' }, [[4.5, 6]]), 9, 1), 'mas apenas pelo vão da janela');
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

import { comodosConhecidos, direcaoDeVisaoDaPeca, modoDeVisaoDaPeca, objetoDinamicoDeVisao, pontoVisivelAgora } from '../../src/domain/nevoa.ts';
import { novaLuz, novoObjeto } from '../../src/domain/fabrica.ts';

test('revelar região do tipo "reveal" faz a área dela contar como explorado', () => {
  let m = dois();
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'regions',
    item: {
      id: 'reg_revelar',
      polygon: [[10, 10], [20, 10], [20, 20], [10, 20]],
      kind: 'reveal',
      gmOnly: false,
      payload: {},
      refs: [],
    },
  });
  assert.ok(!contemFaixa(celulasExploradas(m), Math.floor(15 / RES_NEVOA), Math.floor(15 / RES_NEVOA)));
  const rev = aplicarComando(m, { tipo: 'sessao.revelar', ids: ['reg_revelar'] });
  assert.ok(contemFaixa(celulasExploradas(rev), Math.floor(15 / RES_NEVOA), Math.floor(15 / RES_NEVOA)));
});

test('um cômodo é conhecido se algum pedaço dele (ou o lado de fora das suas paredes) está à vista ou explorado', () => {
  let m = dois({ state: 'closed' }, [[3, 6]]);
  const sala = (id: string, cels: number[][]) => ({ tipo: 'comodo.criar', id, nome: id, funcao: null, piso: { material: 'tabuas.carvalho', seed: 1 }, papel: null, celulas: cels }) as never;
  m = aplicarComando(m, sala('aqui', [[1, 2], [1, 3], [2, 2], [2, 3]]));      // do lado da peça
  m = aplicarComando(m, sala('la', [[9, 7], [9, 8], [10, 7], [10, 8]]));       // do outro lado da parede
  assert.deepEqual([...comodosConhecidos(m)], ['aqui']);
  const revelado = aplicarComando(m, { tipo: 'sessao.revelar', ids: ['la'] });
  assert.deepEqual([...comodosConhecidos(revelado)].sort(), ['aqui', 'la']);
});

test('modo darkwood mantém visão 360° por padrão e modo cone explícito ativa cone + bolha de proximidade', () => {
  let m = criarMapa();
  m = aplicarComando(m, { tipo: 'memoria.atualizar', patch: { mode: 'darkwood' } });
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      ...novaPeca([15, 15]),
      id: 't0',
      name: 'P0',
      player: true,
      facing: 'right',
      vision: { radius: 12, dark: false },
    } as never,
  });
  assert.equal(modoDeVisaoDaPeca(m, m.tokens.t0!), 'circle', 'darkwood não impõe cone estreito por padrão');
  assert.ok(ve(m, 21, 15) && ve(m, 9, 15), 'visão 360° vê frente e trás dentro do raio');

  m = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 't0', patch: { vision: { mode: 'cone' } } });
  assert.equal(modoDeVisaoDaPeca(m, m.tokens.t0!), 'cone');
  assert.equal(direcaoDeVisaoDaPeca(m, m.tokens.t0!), 0);

  // 6 m à frente (x = 21, y = 15) dentro do cone -> visível
  assert.ok(ve(m, 21, 15), 'ponto a 6 m à frente do cone é visível');
  // 6 m atrás (x = 9, y = 15) fora do cone e fora da bolha de 1,8 m -> invisível
  assert.ok(!ve(m, 9, 15), 'ponto a 6 m atrás da peça está fora do cone e da bolha');
  // 1,2 m atrás (x = 13.8, y = 15) dentro da bolha de proximidade de 1,8 m -> visível
  assert.ok(ve(m, 13.8, 15), 'ponto a 1,2 m atrás da peça está dentro da bolha de proximidade');
});

test('modo cone (Darkwood): parede dentro da bolha de proximidade ou dentro do cone bloqueia a visão', () => {
  let m = criarMapa();
  // Parede atrás a 0,7 m (x = 14.3) e parede à frente a 3 m (x = 18)
  m.walls.tras = {
    id: 'tras', path: [[14.3, 12], [14.3, 18]], height: 2.6, thickness: 0.2,
    material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null,
  };
  m.walls.frente = {
    id: 'frente', path: [[18, 12], [18, 18]], height: 2.6, thickness: 0.2,
    material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null,
  };
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      ...novaPeca([15, 15]),
      id: 't0',
      name: 'P0',
      player: true,
      facing: 'right',
      vision: { radius: 12, dark: false, mode: 'cone', angle: 85, proximity: 1.8 },
    } as never,
  });
  assert.ok(!ve(m, 13.8, 15), 'parede dentro da bolha de 1,8 m bloqueia visão a 1,2 m atrás');
  assert.ok(ve(m, 16.5, 15), 'antes da parede frontal é visível');
  assert.ok(!ve(m, 20, 15), 'atrás da parede frontal é bloqueado');
});

test('objeto com blocks.sight: true projeta sombra de visão atrás dele', () => {
  let m = criarMapa();
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      ...novaPeca([10, 15]),
      id: 't0',
      name: 'P0',
      player: true,
      facing: 'right',
      vision: { radius: 14, dark: false, mode: 'cone' },
    } as never,
  });
  // Sem obstáculo, vê (18, 15)
  assert.ok(ve(m, 18, 15));
  // Pilar que bloqueia visão em (14, 15)
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'props',
    item: novoObjeto([14, 15], {
      id: 'pilar1',
      source: { kind: 'recipe', recipe: 'pilar', seed: 1, params: {} },
      scale: 1.5,
      blocks: { move: true, sight: true },
    }) as never,
  });
  assert.ok(!ve(m, 18, 15), 'atrás do pilar com blocks.sight: true fica em sombra de visão');
  assert.ok(ve(m, 16, 17.5), 'ao lado do pilar dentro do cone continua visível');
});

test('peca.virar gira a direção do cone de visão (com ou sem lanterna) e revela o que estava atrás', () => {
  let m = criarMapa();
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      ...novaPeca([15, 15]),
      id: 't0',
      name: 'P0',
      player: true,
      facing: 'right',
      vision: { radius: 12, dark: false, mode: 'cone' },
    } as never,
  });
  assert.ok(ve(m, 21, 15) && !ve(m, 9, 15));

  // Vira 180° (olhando para a esquerda = Math.PI)
  m = aplicarComando(m, { tipo: 'peca.virar', id: 't0', direcao: Math.PI });
  assert.equal(m.tokens.t0!.vision.direction, Math.PI);
  assert.equal(m.tokens.t0!.facing, 'left');
  assert.ok(ve(m, 9, 15), 'agora enxerga 6 m à esquerda');
  assert.ok(!ve(m, 21, 15), 'e não enxerga mais 6 m à direita');

  // Com lanterna em cone de alcance maior (16 m), o cone de visão estende até o raio da lanterna
  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'lights',
    item: {
      ...novaLuz([15, 15], { radius: 16, cone: { angle: Math.PI / 3, direction: Math.PI }, ownerId: 't0', on: true }),
      id: 'lant',
    } as never,
  });
  m = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'tokens', id: 't0', patch: { lightId: 'lant' } });
  m = aplicarComando(m, { tipo: 'peca.virar', id: 't0', direcao: 0 });
  assert.equal(m.lights.lant!.cone!.direction, 0);
  assert.equal(m.tokens.t0!.vision.direction, 0);
  assert.ok(ve(m, 29, 15), 'alcance do cone acompanha os 16 m da lanterna acesa');
});

test('pontoVisivelAgora testa cone Darkwood, bolha de proximidade, margem e paredes', () => {
  let m = criarMapa();
  m.walls.frente = {
    id: 'frente', path: [[19, 10], [19, 20]], height: 2.6, thickness: 0.2,
    material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null,
  };
  m = aplicarComando(m, { tipo: 'memoria.atualizar', patch: { mode: 'darkwood' } });
  // Sem peças de jogador, nenhum ponto é visível
  assert.equal(pontoVisivelAgora(m, [15, 15]), false);

  m = aplicarComando(m, {
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      ...novaPeca([15, 15]),
      id: 't0',
      name: 'P0',
      player: true,
      facing: 'right',
      vision: { radius: 12, dark: false, mode: 'cone', angle: 85, proximity: 1.8 },
    } as never,
  });

  // Ponto à frente dentro do cone e antes da parede -> true
  assert.equal(pontoVisivelAgora(m, [17.5, 15]), true);
  // Ponto atrás fora da bolha de proximidade -> false
  assert.equal(pontoVisivelAgora(m, [10, 15]), false);
  // Ponto atrás dentro da bolha de proximidade (1,2 m atrás) -> true
  assert.equal(pontoVisivelAgora(m, [13.8, 15]), true);
  // Ponto atrás da parede (x = 21) -> false
  assert.equal(pontoVisivelAgora(m, [21, 15]), false);
  // Ponto logo fora da bolha (1,95 m atrás): com margem 0 é false, com margem 0,25 a borda entra na bolha -> true
  assert.equal(pontoVisivelAgora(m, [13.05, 15], 0), false);
  assert.equal(pontoVisivelAgora(m, [13.05, 15], 0.25), true);
});

test('objetoDinamicoDeVisao identifica documentos, pistas, notas e itens de mesa sem ocultar mobília fixa', () => {
  const mesa = novoObjeto([4, 4], { source: { kind: 'recipe', recipe: 'mesa.redonda', seed: 1, params: {} }, elevation: 'floor' });
  const estante = novoObjeto([4, 4], { source: { kind: 'recipe', recipe: 'estante', seed: 1, params: {} }, elevation: 'wall' });
  const pista = novoObjeto([4, 4], {
    source: { kind: 'recipe', recipe: 'mesa.redonda', seed: 1, params: {} },
    interaction: { kind: 'clue', on: false, targets: [], sound: null, clue: null },
  });
  const nota = novoObjeto([4, 4], {
    source: { kind: 'recipe', recipe: 'caixa', seed: 1, params: {} },
    interaction: { kind: 'note', on: false, targets: [], sound: null, clue: null, note: 'segredo' },
  });
  const itemMesa = novoObjeto([4, 4], { source: { kind: 'recipe', recipe: 'livro.aberto', seed: 1, params: {} }, elevation: 'table' });
  const papeisChao = novoObjeto([4, 4], { source: { kind: 'recipe', recipe: 'papeis', seed: 1, params: {} }, elevation: 'floor' });

  assert.equal(objetoDinamicoDeVisao(mesa), false);
  assert.equal(objetoDinamicoDeVisao(estante), false);
  assert.equal(objetoDinamicoDeVisao(pista), true);
  assert.equal(objetoDinamicoDeVisao(nota), true);
  assert.equal(objetoDinamicoDeVisao(itemMesa), true);
  assert.equal(objetoDinamicoDeVisao(papeisChao), true);
});

test('tokensDeVisaoAtivos e poligonosDeVisao respeitam FiltroDeVisao (todos, foco, individual e grupos)', () => {
  const base = dois(undefined, [[3, 6], [9, 6]]);
  const m: MapaAtlas = {
    ...base,
    tokens: {
      t0: { ...base.tokens.t0!, refs: [{ app: 'ficha', tipo: 'ficha', id: 'f-rowan' }] },
      t1: { ...base.tokens.t1!, refs: [{ app: 'ficha', tipo: 'ficha', id: 'f-muirenn' }] },
      t2: { ...novaPeca([11, 10]), id: 't2', name: 'Kael', player: true, vision: { radius: 8, dark: false }, refs: [{ app: 'ficha', tipo: 'ficha', id: 'f-kael' }] },
    },
  };

  // Todos
  assert.equal(tokensDeVisaoAtivos(m, { tipo: 'todos' }).length, 3);
  assert.ok(pontoVisivelAgora(m, [3, 6], 0.2, { tipo: 'todos' }));
  assert.ok(pontoVisivelAgora(m, [9, 6], 0.2, { tipo: 'todos' }));

  // Foco em t1 (esconde sala de t0!)
  assert.deepEqual(tokensDeVisaoAtivos(m, { tipo: 'foco', tokenId: 't1' }).map(t => t.id), ['t1']);
  assert.ok(!pontoVisivelAgora(m, [3, 6], 0.2, { tipo: 'foco', tokenId: 't1' }), 't0 oculto no foco de t1');
  assert.ok(pontoVisivelAgora(m, [9, 6], 0.2, { tipo: 'foco', tokenId: 't1' }), 't1 visível no foco de t1');

  // Individual sem grupos (solo)
  const ind = { tipo: 'individual' as const };
  assert.deepEqual(tokensDeVisaoAtivos(m, ind, ['f-rowan']).map(t => t.id), ['t0']);
  assert.ok(pontoVisivelAgora(m, [3, 6], 0.2, ind, ['f-rowan']));
  assert.ok(!pontoVisivelAgora(m, [9, 6], 0.2, ind, ['f-rowan']));

  // Individual com grupos (t0 e t1 no Grupo A; t2 solo)
  const comGrupos = { tipo: 'individual' as const, grupos: { t0: 'A', t1: 'A' } };
  assert.deepEqual(tokensDeVisaoAtivos(m, comGrupos, ['f-rowan']).map(t => t.id).sort(), ['t0', 't1']);
  assert.deepEqual(tokensDeVisaoAtivos(m, comGrupos, ['f-kael']).map(t => t.id), ['t2']);

  // Espectador (minhasFichas vazio/nulo) vê todos os jogadores
  assert.equal(tokensDeVisaoAtivos(m, comGrupos, []).length, 3);
  assert.equal(tokensDeVisaoAtivos(m, comGrupos, null).length, 3);
});
