import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef } from '#mesa';
import { acaoEscadaParaPeca } from '../../src/domain/andares.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { luzesDerivadas } from '../../src/domain/clima.ts';
import { ErroDeValidacao, e } from '../../src/domain/esquema.ts';
import { novaLuz, novaPeca, novoObjeto } from '../../src/domain/fabrica.ts';
import { PAREDE_PADRAO, recalcularParedes } from '../../src/domain/geometria.ts';
import { interagiveisPerto } from '../../src/domain/interacao.ts';
import { alvosDoInterruptor, luzesDeRedeDoComodo } from '../../src/domain/interagiveis.ts';
import { criarMapa, type MapaAtlas, type Regiao } from '../../src/domain/mapa.ts';
import { bloqueioNoCaminho } from '../../src/domain/movimento.ts';
import { celulasVisiveis, poligonosDeVisao } from '../../src/domain/nevoa.ts';
import { projetarParaRemoto } from '../../src/domain/projecao-remota.ts';
import { projetarParaJogadores } from '../../src/domain/projecao.ts';
import { regiaoOcupada, regioesEntradas, regioesOcupadas } from '../../src/domain/regioes.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';

const retangulo = (x0: number, y0: number, x1: number, y1: number) => {
  const cs: [number, number][] = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cs.push([x, y]);
  return codificar(cs);
};

const comodo = (id: string, x0: number, y0: number, x1: number, y1: number, levelId: string | null = null): MapaAtlas['rooms'][string] => ({
  id,
  name: id,
  function: 'sala',
  cells: retangulo(x0, y0, x1, y1),
  floor: { material: 'tabuas.carvalho', seed: 1 },
  wallpaper: null,
  wallStyle: null,
  palette: null,
  roof: { material: 'telha.barro', visible: true },
  levelId,
});

// ---- 1. projecao-remota.ts ----

test('remota: escada no térreo ou entre mapas tem interaction removida para não falhar validarMapa', () => {
  const m = criarMapa({ id: 'esc-rem', nome: 'Torre', largura: 30, altura: 20 });
  m.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  m.tokens.j = { ...novaPeca([4, 4]), id: 'j', player: true, vision: { radius: 4, dark: false } };
  m.props.escIntra = novoObjeto([4.5, 4.5], {
    id: 'escIntra',
    source: ACERVO.fonte('escada.caracol', 1),
    interaction: { kind: 'stairs', on: false, targets: [], sound: null, clue: null, toLevel: 'a1', toPosition: [5, 5] },
  });
  m.props.escMapa = novoObjeto([5, 4.5], {
    id: 'escMapa',
    source: ACERVO.fonte('escada.madeira', 1),
    interaction: { kind: 'stairs', on: false, targets: [], sound: null, clue: null, toMapId: 'outro', toTargetId: 'chegada' },
  });
  m.session.explored = { res: 0.5, cells: retangulo(4, 4, 14, 14) };

  const p = projetarParaRemoto(m, null);
  validarMapa(p);
  assert.equal(p.props.escIntra!.interaction, null);
  assert.equal(p.props.escMapa!.interaction, null);
});

test('remota: limpa roomId de sala cortada, terrainLayerId de camada cortada e referências de luzes/donos/alvos', () => {
  const m = criarMapa({ id: 'refs-rem', nome: 'Mapa', largura: 45, altura: 30 });
  m.tokens.j = { ...novaPeca([3, 3]), id: 'j', player: true, vision: { radius: 2, dark: false } };
  // Sala distante (sem telhado para poder sumir inteira) referenciada por um objeto na área conhecida
  m.rooms.distante = { ...comodo('distante', 20, 12, 23, 15, null), roof: { material: null, visible: true } };
  m.props.propOrfaoSala = novoObjeto([3.5, 3.5], { id: 'propOrfaoSala', roomId: 'distante' });

  // Camada de terreno só fora da área (será removida) referenciada por uma parede que toca a área
  m.terrain.layers.longe = { id: 'longe', material: 'pedra', cells: retangulo(100, 80, 120, 100), order: 0, flow: null };
  m.walls.wTerreno = { ...structuredClone(PAREDE_PADRAO), id: 'wTerreno', path: [[2, 3], [6, 3]], source: { terrainLayerId: 'longe' } };

  // Luz dentro da área cujo dono (objeto) está fora da área
  m.props.donoFora = novoObjeto([35, 25], { id: 'donoFora' });
  m.lights.luzOrfa = novaLuz([3.5, 3.5], { id: 'luzOrfa', ownerId: 'donoFora' });

  // Luz dentro da área cujo dono é o jogador sobrevivente (não deve perder ownerId)
  m.lights.luzJogador = novaLuz([3, 3], { id: 'luzJogador', ownerId: 'j' });
  m.tokens.j.lightId = 'luzJogador';

  // Jogador 2 dentro da área cuja luz caiu fora da área (t.lightId deve virar null)
  m.tokens.j2 = { ...novaPeca([4, 4]), id: 'j2', player: true, vision: { radius: 1, dark: false }, lightId: 'luzFora' };
  m.lights.luzFora = novaLuz([35, 25], { id: 'luzFora', ownerId: 'j2' });

  // Interruptor dentro da área apontando para uma luz sobrevivente e uma luz fora da área
  m.props.interruptor = novoObjeto([3.5, 4], {
    id: 'interruptor',
    interaction: { kind: 'switch', on: true, targets: ['luzOrfa', 'luzFora'], sound: null, clue: null },
  });

  m.session.explored = { res: 0.5, cells: retangulo(2, 2, 12, 12) };

  const p = projetarParaRemoto(m, null);
  validarMapa(p);
  assert.equal(p.rooms.distante, undefined);
  assert.equal(p.props.propOrfaoSala!.roomId, null);
  assert.equal(p.terrain.layers.longe, undefined);
  assert.equal(p.walls.wTerreno!.source, null);
  assert.equal(p.lights.luzOrfa!.ownerId, null);
  assert.equal(p.lights.luzJogador!.ownerId, 'j');
  assert.equal(p.tokens.j2!.lightId, null);
  assert.deepEqual(p.props.interruptor!.interaction!.targets, ['luzOrfa']);
});

test('remota: paredes divididas com id de 64 caracteres mantêm comprimento <= 64 e unicidade', () => {
  const m = criarMapa({ id: 'split64', nome: 'M', largura: 45, altura: 30 });
  const id64 = 'w'.repeat(64);
  m.walls[id64] = { ...structuredClone(PAREDE_PADRAO), id: id64, path: [[2, 5], [40, 5]], source: null };
  m.session.explored = {
    res: 0.5,
    cells: codificar([
      ...Array.from({ length: 12 }, (_, i) => [6 + i, 10] as [number, number]),
      ...Array.from({ length: 12 }, (_, i) => [36 + i, 10] as [number, number]),
      ...Array.from({ length: 16 }, (_, i) => [60 + i, 10] as [number, number]),
    ]),
  };

  const p = projetarParaRemoto(m, null);
  validarMapa(p);
  const ids = Object.keys(p.walls);
  assert.equal(ids.length, 3);
  for (const wid of ids) assert.ok(wid.length <= 64, `id passou de 64 chars: ${wid.length}`);
  assert.ok(ids.includes(id64), 'maior trecho mantém id original');
});

// ---- 2. projecao.ts ----

test('projecao: gmOnly em interaction remove note, noteTitle e clue; luzes removidas são podadas de targets', () => {
  const m = criarMapa({ id: 'proj-r2', nome: 'M' });
  m.tokens.j = { ...novaPeca([3, 3]), id: 'j', player: true, vision: { radius: 4, dark: false } };
  m.tokens.inimigo = { ...novaPeca([30, 20]), id: 'inimigo', player: false, lightId: 'luzInimigo' };
  m.lights.luzInimigo = novaLuz([30, 20], { id: 'luzInimigo', ownerId: 'inimigo' });
  m.lights.luzOculta = novaLuz([3, 3], { id: 'luzOculta', ownerId: 'propOculto' });
  m.lights.luzVisivel = novaLuz([3.5, 3.5], { id: 'luzVisivel' });
  m.props.propOculto = novoObjeto([3, 3], { id: 'propOculto', oculto: true });
  m.props.notaSecreta = novoObjeto([3.2, 3.2], {
    id: 'notaSecreta',
    interaction: {
      kind: 'note',
      on: false,
      targets: [],
      sound: null,
      clue: criarRef('atelie', 'documento', 'SEGREDO'),
      note: 'Texto secreto do mestre',
      noteTitle: 'Título secreto',
      gmOnly: true,
    },
  });
  m.props.notaPublica = novoObjeto([3.4, 3.2], {
    id: 'notaPublica',
    interaction: {
      kind: 'note',
      on: false,
      targets: [],
      sound: null,
      clue: null,
      note: 'Texto público',
      noteTitle: 'Título público',
      gmOnly: false,
    },
  });
  m.props.interruptor = novoObjeto([3.6, 3.2], {
    id: 'interruptor',
    interaction: {
      kind: 'switch',
      on: true,
      targets: ['luzInimigo', 'luzOculta', 'luzVisivel'],
      sound: null,
      clue: null,
    },
  });
  m.session.revealed = ['notaSecreta'];

  const p = projetarParaJogadores(m, null);
  validarMapa(p);
  assert.equal(p.props.notaSecreta!.interaction!.note, undefined);
  assert.equal(p.props.notaSecreta!.interaction!.noteTitle, undefined);
  assert.equal(p.props.notaSecreta!.interaction!.clue, null);
  assert.equal(p.props.notaPublica!.interaction!.note, 'Texto público');
  assert.equal(p.props.notaPublica!.interaction!.noteTitle, 'Título público');
  assert.deepEqual(p.props.interruptor!.interaction!.targets, ['luzVisivel']);
});

// ---- 3. esquema.ts ----

test('esquema: Object.hasOwn impede chaves de protótipo em obj e uniao', () => {
  const sObj = e.obj({ a: e.num() });
  const comToString = JSON.parse('{"a": 1, "toString": 2}');
  assert.throws(() => sObj.verificar(comToString, ''), ErroDeValidacao);

  const sCampoProto = e.obj({ constructor: e.num() });
  assert.throws(() => sCampoProto.verificar({}, ''), ErroDeValidacao);

  const sUniao = e.uniao('kind', { ok: e.obj({ kind: e.um('ok') }) });
  assert.throws(() => sUniao.verificar({ kind: 'toString' }, ''), ErroDeValidacao);
  assert.throws(() => sUniao.verificar({ kind: 'constructor' }, ''), ErroDeValidacao);

  const sUniaoProtoCampo = e.uniao('toString', { ok: e.obj({ toString: e.um('ok') }) });
  assert.throws(() => sUniaoProtoCampo.verificar({}, ''), ErroDeValidacao);
});

// ---- 4. andares.ts ----

test('acaoEscadaParaPeca ignora escadas com toMapId e encontra escada intra-mapa se houver', () => {
  const m = criarMapa({ id: 'esc-mapa', nome: 'M' });
  m.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  const peca = novaPeca([4, 4], 'Mia', { id: 'mia', player: true });

  m.props.escMapa = novoObjeto([4.2, 4], {
    id: 'escMapa',
    source: ACERVO.fonte('escada.madeira', 1),
    interaction: { kind: 'stairs', on: false, targets: [], sound: null, clue: null, toMapId: 'outro-mapa', toLevel: 'a1' },
  });
  assert.equal(acaoEscadaParaPeca(m, peca), null);

  m.props.escAndar = novoObjeto([4.8, 4], {
    id: 'escAndar',
    source: ACERVO.fonte('escada.caracol', 1),
    interaction: { kind: 'stairs', on: false, targets: [], sound: null, clue: null, toLevel: 'a1' },
  });
  const acao = acaoEscadaParaPeca(m, peca);
  assert.equal(acao?.escadaId, 'escAndar');
  assert.equal(acao?.destino, 'a1');
});

// ---- 5. Multi-level filtering ----

test('interagiveis: alvosDoInterruptor e luzesDeRedeDoComodo filtram por levelId', () => {
  const m = criarMapa({ id: 'int-lvl', nome: 'M' });
  m.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  m.rooms.r0 = comodo('r0', 2, 2, 5, 5, null);
  m.rooms.r1 = comodo('r1', 2, 2, 5, 5, 'a1');
  m.lights.l0 = novaLuz([5, 5], { id: 'l0', power: 'grid', levelId: null });
  m.lights.l1 = novaLuz([5, 5], { id: 'l1', power: 'grid', levelId: 'a1' });

  const sw0 = novoObjeto([4.5, 4.5], {
    id: 'sw0',
    roomId: null,
    levelId: null,
    interaction: { kind: 'switch', on: true, targets: [], sound: null, clue: null },
  });
  const sw1 = novoObjeto([4.5, 4.5], {
    id: 'sw1',
    roomId: null,
    levelId: 'a1',
    interaction: { kind: 'switch', on: true, targets: [], sound: null, clue: null },
  });

  assert.deepEqual(alvosDoInterruptor(m, sw0), ['l0']);
  assert.deepEqual(alvosDoInterruptor(m, sw1), ['l1']);
  assert.deepEqual(luzesDeRedeDoComodo(m, 'r0'), ['l0']);
  assert.deepEqual(luzesDeRedeDoComodo(m, 'r1'), ['l1']);
});

test('clima (luzesDerivadas): filtra salas e luzes por levelId e propaga levelId nas janelas', () => {
  const m = criarMapa({ id: 'clima-lvl', nome: 'M' });
  m.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  m.climate.time = '23:00';
  m.rooms.r0 = comodo('r0', 2, 2, 4, 4, null);
  m.rooms.r1 = comodo('r1', 2, 2, 4, 4, 'a1');
  recalcularParedes(m);

  const topo0 = Object.values(m.walls).find(w => (w.levelId ?? null) === null && w.path.every(q => q[1] === 3))!;
  const topo1 = Object.values(m.walls).find(w => w.levelId === 'a1' && w.path.every(q => q[1] === 3))!;
  m.openings.j0 = { id: 'j0', wallId: topo0.id, at: 0.5, width: 1.2, kind: 'window', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.openings.j1 = { id: 'j1', wallId: topo1.id, at: 0.5, width: 1.2, kind: 'window', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };

  // Só o andar a1 tem luz acesa à noite
  m.lights.lamparina = novaLuz([4.5, 4.5], { id: 'lamparina', power: 'fire', color: '#ff8800', on: true, levelId: 'a1' });

  const derivadas = luzesDerivadas(m);
  const porId = new Map(derivadas.map(l => [l.id, l]));
  assert.equal(porId.get('janela:j0')?.levelId, undefined);
  assert.equal(porId.get('janela:j1')?.levelId, 'a1');
  assert.equal(porId.get('janela-fora:j0'), undefined, 'luz do andar a1 não acende janela do térreo');
  assert.equal(porId.get('janela-fora:j1')?.levelId, 'a1');
});

test('nevoa: paredes de outro andar não bloqueiam visão da peça', () => {
  const m = criarMapa({ id: 'nevoa-lvl', nome: 'M' });
  m.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  m.walls.w0 = { ...structuredClone(PAREDE_PADRAO), id: 'w0', path: [[6, 0], [6, 12]], source: null, levelId: null };
  m.tokens.j1 = { ...novaPeca([4, 6]), id: 'j1', player: true, vision: { radius: 8, dark: false }, levelId: 'a1' };

  const polys = poligonosDeVisao(m);
  assert.equal(polys.length, 1);
  // Célula x = 8 m (além da parede do térreo em x = 6) deve ser visível para j1 no andar a1
  const celX16 = codificar([[16, 12]]);
  const vis = celulasVisiveis(m);
  const temAlem = vis.some(([y, x0, n]) => y === celX16[0]![0] && x0 <= 16 && x0 + n > 16);
  assert.equal(temAlem, true);

  // Já se houver uma parede no próprio andar a1 em x = 6, bloqueia
  m.walls = { ...m.walls, w1: { ...structuredClone(PAREDE_PADRAO), id: 'w1', path: [[6, 0], [6, 12]], source: null, levelId: 'a1' } };
  const visComParede = celulasVisiveis(m);
  const temAlemComParede = visComParede.some(([y, x0, n]) => y === celX16[0]![0] && x0 <= 16 && x0 + n > 16);
  assert.equal(temAlemComParede, false);
});

test('movimento (bloqueioNoCaminho): filtra paredes por levelId quando opcoes.levelId é informado', () => {
  const m = criarMapa({ id: 'mov-lvl', nome: 'M' });
  m.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  m.walls.w0 = { ...structuredClone(PAREDE_PADRAO), id: 'w0', path: [[6, 0], [6, 12]], source: null, levelId: null };
  m.walls.w1 = { ...structuredClone(PAREDE_PADRAO), id: 'w1', path: [[9, 0], [9, 12]], source: null, levelId: 'a1' };
  m.openings.p1 = { id: 'p1', wallId: 'w1', at: 0.5, width: 1, kind: 'door', state: 'closed', material: 'madeira', som: null, swing: 'a' };

  assert.equal(bloqueioNoCaminho(m, [5, 6], [7, 6], { levelId: 'a1' }), null);
  assert.equal(bloqueioNoCaminho(m, [5, 6], [7, 6], { levelId: null }), 'Tem uma parede no caminho.');
  assert.equal(bloqueioNoCaminho(m, [8, 6], [10, 6], { levelId: null }), null);
  assert.equal(bloqueioNoCaminho(m, [8, 6], [10, 6], { levelId: 'a1' }), 'A porta está fechada.');
});

test('regioes: regioesOcupadas, regioesEntradas e regiaoOcupada respeitam levelId e mantêm assinatura compatível', () => {
  const reg: Regiao = { id: 'r1', polygon: [[10, 10], [20, 10], [20, 20], [10, 20]], kind: 'trigger', gmOnly: false, payload: {}, refs: [], levelId: 'a1' };
  const antes = criarMapa({ id: 'reg-lvl', nome: 'M' });
  antes.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  antes.regions.r1 = reg;
  antes.tokens.ana = novaPeca([15, 15], 'Ana', { id: 'ana', player: true, levelId: null });

  assert.deepEqual(regioesOcupadas(antes), []);
  assert.equal(regiaoOcupada(antes, 'r1'), false);

  const depois = structuredClone(antes);
  depois.tokens.ana!.levelId = 'a1';
  assert.deepEqual(regioesEntradas(antes, depois), [{ regiao: 'r1', peca: 'ana' }]);
  assert.deepEqual(regioesOcupadas(depois).map(r => r.id), ['r1']);
  assert.deepEqual(regioesOcupadas(depois, 'trigger', null), []);
  assert.deepEqual(regioesOcupadas(depois, 'trigger', 'a1').map(r => r.id), ['r1']);
  assert.equal(regiaoOcupada(depois, 'r1'), true);
  assert.equal(regiaoOcupada(depois, 'r1', null), false);
  assert.equal(regiaoOcupada(depois, 'r1', 'a1'), true);
});

test('interacao (interagiveisPerto): ignora portas e objetos de outros andares', () => {
  const m = criarMapa({ id: 'int-perto', nome: 'M' });
  m.levels = { a1: { id: 'a1', name: '1º Andar', order: 1 } };
  m.walls.w0 = { ...structuredClone(PAREDE_PADRAO), id: 'w0', path: [[6, 0], [6, 12]], source: null, levelId: null };
  m.walls.w1 = { ...structuredClone(PAREDE_PADRAO), id: 'w1', path: [[6, 0], [6, 12]], source: null, levelId: 'a1' };
  m.openings.p0 = { id: 'p0', wallId: 'w0', at: 0.5, width: 1, kind: 'door', state: 'closed', material: 'madeira', som: null, swing: 'a' };
  m.openings.p1 = { id: 'p1', wallId: 'w1', at: 0.5, width: 1, kind: 'door', state: 'closed', material: 'madeira', som: null, swing: 'a' };
  m.props.sw0 = novoObjeto([5.4, 6], { id: 'sw0', levelId: null, interaction: { kind: 'switch', on: false, targets: [], sound: null, clue: null } });
  m.props.sw1 = novoObjeto([5.4, 6], { id: 'sw1', levelId: 'a1', interaction: { kind: 'switch', on: false, targets: [], sound: null, clue: null } });

  assert.deepEqual(
    interagiveisPerto(m, { position: [5.25, 6], facing: 'right' }).map(x => x.id).sort(),
    ['p0', 'sw0'],
  );
  assert.deepEqual(
    interagiveisPerto(m, { position: [5.25, 6], facing: 'right', levelId: 'a1' }).map(x => x.id).sort(),
    ['p1', 'sw1'],
  );
});
