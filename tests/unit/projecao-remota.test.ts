import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { pecasDoJogador, projetarParaRemoto } from '../../src/domain/projecao-remota.ts';
import { projetarParaJogadores } from '../../src/domain/projecao.ts';
import { edificiosDe } from '../../src/domain/edificios.ts';
import { decodificar, codificar } from '../../src/domain/celulas.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { celulasVisiveis, RES_NEVOA } from '../../src/domain/nevoa.ts';
import { trechosDe } from '../../src/domain/telhado-geometria.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';

const retangulo = (x0: number, y0: number, x1: number, y1: number) => { const cs: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cs.push([x, y]); return codificar(cs); };
const comodo = (id: string, name: string, cells: ReturnType<typeof codificar>) => ({ id, name, function: 'sala', cells, floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null });
const parede = (id: string, path: [number, number][], source: MapaAtlas['walls'][string]['source'] = null) => ({ id, path, height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall' as const, blocks: { move: true, sight: true, light: true }, drop: null, source });
const objeto = (id: string, x: number, y: number, extra: object = {}) => ({ id, source: { kind: 'recipe' as const, recipe: 'mesa.redonda', seed: 1, params: {} }, position: [x, y] as [number, number], rotation: 0, scale: 1, elevation: 'floor' as const, wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null, ...extra });
const luz = (id: string, x: number, y: number) => ({ id, position: [x, y] as [number, number], radius: 4, color: '#ffffff', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire' as const, on: true, nightOnly: false, preset: null, rays: false });

/** Dois cômodos longe um do outro: A (explorado, com o jogador) e B (não explorado, cheio de segredos). */
function mapaDeDois(): MapaAtlas {
  const m = criarMapa({ id: 'dois', nome: 'Cripta do Rei Louco', largura: 45, altura: 30 });
  m.levels = { sub: { id: 'sub', name: 'Câmara do Tesouro', order: 1 } };
  m.groundLevelName = 'Saguão Secreto';
  m.backdrop.title = { text: 'TITULO-SECRETO', font: 'x', position: [30, 20] };
  m.terrain.layers.chao = { id: 'chao', material: 'pedra', cells: retangulo(0, 0, 160, 120), order: 0, flow: null };
  m.rooms.A = comodo('A', 'Sala A', retangulo(1, 1, 5, 5)); // x e y de 1,5 a 7,5
  m.rooms.B = comodo('B', 'COFRE-SECRETO', retangulo(15, 10, 19, 14)); // x de 22,5 a 28,5; y de 15 a 21
  m.walls.wA = parede('wA', [[1.5, 1.5], [7.5, 1.5], [7.5, 7.5], [1.5, 7.5], [1.5, 1.5]], { roomId: 'A' });
  m.walls.wB = parede('wB', [[22.5, 15], [28.5, 15], [28.5, 21], [22.5, 21], [22.5, 15]], { roomId: 'B' });
  m.walls.wLonga = parede('wLonga', [[4, 6], [26, 6]]); // toca A, termina perto de B
  m.openings.pA = { id: 'pA', wallId: 'wA', at: 0.1, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.openings.pB = { id: 'pB', wallId: 'wB', at: 0.5, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.openings.pLonga = { id: 'pLonga', wallId: 'wLonga', at: 0.95, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.props.oA = objeto('oA', 4, 4, { interaction: { kind: 'note', on: false, targets: [], sound: null, clue: null, note: 'NOTA-SECRETA', noteTitle: 'TITULO-NOTA' } });
  m.props.oB = objeto('oB', 25, 18, { roomId: 'B' });
  m.lights.lA = luz('lA', 4, 4); m.lights.lB = luz('lB', 25, 18);
  m.presence.pA = { id: 'pA', brush: 'musgo', cells: [[16, 16, 4]], intensity: 1, seed: 1, gmOnly: false };
  m.presence.pB = { id: 'pB', brush: 'musgo', cells: [[80, 80, 4]], intensity: 1, seed: 1, gmOnly: false };
  m.regions.r = { id: 'r', polygon: [[24, 17], [26, 17], [26, 19]], kind: 'trigger', gmOnly: false, payload: {}, refs: [] };
  m.tokens.hugo = { ...novaPeca([4, 4]), id: 'hugo', name: 'Hugo', player: true, vision: { radius: 3, dark: false } };
  m.session = { explored: { res: 0.5, cells: retangulo(2, 2, 16, 16) }, initiative: null, revealed: ['A'], event: 'EVENTO-SECRETO' };
  return m;
}

test('remota: nada do cômodo não explorado sai', () => {
  const m = mapaDeDois(), antes = JSON.stringify(m), p = projetarParaRemoto(m);
  assert.equal(JSON.stringify(m), antes, 'não muda o original');
  validarMapa(p);
  const json = JSON.stringify(p);
  for (const segredo of ['COFRE-SECRETO', 'TITULO-SECRETO', 'Cripta do Rei Louco', 'Câmara do Tesouro', 'Saguão Secreto', 'NOTA-SECRETA', 'TITULO-NOTA', 'EVENTO-SECRETO']) assert.ok(!json.includes(segredo), `vazou: ${segredo}`);
  assert.equal(p.rooms.B, undefined);
  assert.equal(p.props.oB, undefined); assert.equal(p.lights.lB, undefined);
  assert.equal(p.walls.wB, undefined); assert.equal(p.openings.pB, undefined);
  assert.equal(p.presence.pB, undefined); assert.ok(p.presence.pA, 'a presença dentro fica');
  assert.deepEqual(p.regions, {});
  // terreno: nenhuma célula além da área (explorado x de 1 a 8 m, mais a folga de 0,5 m)
  for (const c of Object.values(p.terrain.layers)) for (const [x, y] of decodificar(c.cells)) assert.ok(x * 0.25 < 8.5 && y * 0.25 < 8.5, `terreno fora: ${x},${y}`);
  assert.ok(p.terrain.layers.chao!.cells.length > 0);
});

test('remota: o cômodo explorado sai inteiro, com o nome só se revelado', () => {
  const m = mapaDeDois(), p = projetarParaRemoto(m);
  assert.deepEqual(p.rooms.A!.cells, m.rooms.A!.cells);
  assert.equal(p.rooms.A!.name, 'Sala A');
  assert.ok(p.props.oA); assert.ok(p.lights.lA); assert.ok(p.walls.wA); assert.ok(p.openings.pA); assert.ok(p.tokens.hugo);
  assert.deepEqual(p.walls.wA!.path, m.walls.wA!.path, 'a parede inteira dentro não muda');
  m.session.revealed = [];
  const nao = projetarParaRemoto(m);
  assert.equal(nao.rooms.A!.name, 'Cômodo'); assert.doesNotThrow(() => validarMapa(nao)); assert.equal(nao.rooms.A!.function, null);
  assert.ok(nao.rooms.A!.cells.length > 0);
});

test('remota: a parede que sai da área é aparada, e a porta fora do trecho some', () => {
  const p = projetarParaRemoto(mapaDeDois());
  const w = p.walls.wLonga!;
  assert.ok(w, 'toca a área');
  for (const [x] of w.path) assert.ok(x <= 8.6, `a parede segue fora: ${x}`);
  assert.equal(p.openings.pLonga, undefined, 'a porta perto de B sai');
});

test('remota: a parede que atravessa duas áreas explora dois trechos, com as aberturas certas', () => {
  const m = criarMapa({ id: 'x', nome: 'x', largura: 45, altura: 30 });
  m.walls.w = parede('w', [[2, 5], [40, 5]]); // 38 m
  m.openings.a1 = { id: 'a1', wallId: 'w', at: 6 / 38, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.openings.a2 = { id: 'a2', wallId: 'w', at: 20 / 38, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.openings.a3 = { id: 'a3', wallId: 'w', at: 33 / 38, width: 0.9, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' };
  m.props.p3 = objeto('p3', 35, 5, { elevation: 'wall', wall: { wallId: 'w', at: 33 / 38, face: 'inner' } });
  m.props.p2 = objeto('p2', 22, 5, { elevation: 'wall', wall: { wallId: 'w', at: 20 / 38, face: 'inner' } });
  // explorado: x de 3 a 9 e de 30 a 38 (y de 3 a 7); o meio fica escuro
  m.session = { explored: { res: 0.5, cells: codificar([...decodificar(retangulo(6, 6, 18, 14)), ...decodificar(retangulo(60, 6, 76, 14))]) }, initiative: null, revealed: [], event: null };
  m.tokens = {};
  const p = projetarParaRemoto(m);
  assert.deepEqual(Object.keys(p.walls).sort(), ['w', 'w_2']);
  assert.doesNotThrow(() => validarMapa(p), 'ids passam na validação');
  const maior = p.walls.w!, outro = p.walls.w_2!;
  assert.ok(maior.path[0]![0] > 29 && outro.path[0]![0] < 10, 'o trecho maior (x > 29) fica com o id original');
  assert.equal(p.openings.a2, undefined, 'a porta na área escura some');
  assert.equal(p.openings.a1!.wallId, 'w_2'); assert.equal(p.openings.a3!.wallId, 'w');
  const x = (t: typeof maior, at: number) => t.path[0]![0] + at * (t.path.at(-1)![0] - t.path[0]![0]);
  assert.ok(Math.abs(x(outro, p.openings.a1!.at) - 8) < 1e-6 && Math.abs(x(maior, p.openings.a3!.at) - 35) < 1e-6);
  assert.equal(p.props.p3!.wall!.wallId, 'w'); assert.equal(p.props.p2, undefined);
});

test('remota: nomes do mapa e dos andares são neutralizados', () => {
  const p = projetarParaRemoto(mapaDeDois());
  assert.equal(p.name, 'Mapa'); assert.equal(p.groundLevelName, 'Mapa');
  assert.equal(p.levels!.sub!.name, 'Andar 1');
  assert.equal(p.backdrop.title, null);
});

test('remota: sem névoa sai igual à projeção local', () => {
  const m = mapaDeDois(); m.session.explored = null; m.session.revealed = [];
  assert.deepEqual(projetarParaRemoto(m), projetarParaJogadores(m));
});

test('remota: num mapa de exemplo com névoa parcial, nada fica fora da área', () => {
  const arquivos = readdirSync('public/exemplos').filter(f => f.endsWith('.atlas.json'));
  assert.ok(arquivos.length > 0);
  for (const f of arquivos) {
    const m = JSON.parse(readFileSync(`public/exemplos/${f}`, 'utf8')) as MapaAtlas;
    const cx = m.bounds.width / 2, cy = m.bounds.height / 2;
    const x0 = cx - 5, x1 = cx + 5, y0 = cy - 4, y1 = cy + 4; // o explorado, em metros
    m.session = { explored: { res: 0.5, cells: retangulo(x0 * 2, y0 * 2, x1 * 2, y1 * 2) }, initiative: null, revealed: [], event: null };
    m.tokens = {}; m.tokens.j = { ...novaPeca([cx, cy]), id: 'j', player: true, vision: { radius: 2, dark: false } };
    const p = projetarParaRemoto(m), folga = 0.5 + 1e-6;
    const dentro = (x: number, y: number) => x >= x0 - folga && x <= x1 + folga && y >= y0 - folga && y <= y1 + folga;
    for (const o of Object.values(p.props)) assert.ok(dentro(o.position[0], o.position[1]), `${f}: objeto ${o.id} fora`);
    for (const l of Object.values(p.lights)) assert.ok(dentro(l.position[0], l.position[1]), `${f}: luz ${l.id} fora`);
    const g = m.grid.size;
    const edOriginalPorSala = new Map<string, ReturnType<typeof edificiosDe>[number]>();
    for (const ed of edificiosDe(m)) for (const id of ed.salas) edOriginalPorSala.set(id, ed);
    for (const r of Object.values(p.rooms)) {
      const edOrig = edOriginalPorSala.get(r.id);
      if (edOrig) {
        // Edifício com telhado conhecido preserva as células estruturais inteiras (sem cortar o telhado em escada),
        // mantendo o nome oculto e ao menos uma célula do edifício perto da área explorada/visível.
        assert.deepEqual(r.cells, m.rooms[r.id]!.cells, `${f}: edifício com telhado ${r.id} preserva cells`);
        assert.equal(r.name, 'Cômodo', `${f}: nome do cômodo ${r.id} continua oculto`);
        assert.equal(r.function, null, `${f}: função do cômodo ${r.id} continua oculta`);
        assert.ok(
          edOrig.celulas.some(([cx, cy]) => {
            const x = m.grid.offset[0] + (cx + 0.5) * g, y = m.grid.offset[1] + (cy + 0.5) * g;
            const mg = g / 2 + 0.8;
            return x >= x0 - mg && x <= x1 + mg && y >= y0 - mg && y <= y1 + mg;
          }),
          `${f}: edifício com telhado ${r.id} é realmente tocado pela área`,
        );
      } else {
        for (const [x, y] of decodificar(r.cells)) assert.ok(dentro(m.grid.offset[0] + (x + 0.5) * g, m.grid.offset[1] + (y + 0.5) * g), `${f}: célula do cômodo ${r.id} fora`);
      }
    }
    for (const w of Object.values(p.walls)) for (const [x, y] of w.path) assert.ok(dentro(x, y), `${f}: parede ${w.id} fora`);
    const t = m.terrain.resolution;
    for (const c of Object.values(p.terrain.layers)) for (const [x, y] of decodificar(c.cells)) assert.ok(dentro((x + 0.5) * t, (y + 0.5) * t), `${f}: terreno ${c.id} fora`);
    for (const x of Object.values(p.presence)) for (const [cx2, cy2] of decodificar(x.cells)) assert.ok(dentro((cx2 + 0.5) * t, (cy2 + 0.5) * t), `${f}: presença fora`);
    assert.equal(p.name, 'Mapa');
    assert.ok(Object.keys(p.props).length < Object.keys(m.props).length || Object.keys(m.props).length === 0, `${f}: cortou objetos`);
  }
});

test('remota igual à local dentro da área: a visão do receptor e as células de terreno coincidem (Sala da guarda, peça na rocha)', () => {
  const m = JSON.parse(readFileSync(new URL('../../public/exemplos/sala-da-guarda.atlas.json', import.meta.url), 'utf8')) as MapaAtlas;
  m.tokens.hugo = { ...novaPeca([9.75, 9.75]), id: 'hugo', name: 'Hugo', player: true, vision: { radius: 6, dark: false } };
  const local = projetarParaJogadores(m, null);
  m.session.explored = { res: RES_NEVOA, cells: celulasVisiveis(local, RES_NEVOA) };
  const L = projetarParaJogadores(m, null), R = projetarParaRemoto(m, null);
  const chaves = (cs: ReturnType<typeof celulasVisiveis>) => new Set(decodificar(cs).map(([x, y]) => `${x},${y}`));
  const vl = chaves(celulasVisiveis(L, RES_NEVOA)), vr = chaves(celulasVisiveis(R, RES_NEVOA));
  assert.ok(vl.size > 100);
  assert.deepEqual([...vr].sort(), [...vl].sort(), 'o receptor enxerga as mesmas células com o documento remoto e com o local');
  // Cada célula de terreno visível no local está no remoto (o recorte não come nada dentro da área).
  const [ox, oy] = [0, 0], t = L.terrain.resolution;
  for (const [id, camada] of Object.entries(L.terrain.layers)) {
    const rem = new Set(decodificar(R.terrain.layers[id]?.cells ?? []).map(([x, y]) => `${x},${y}`));
    const faltam = decodificar(camada.cells).filter(([x, y]) => vl.has(`${Math.floor(((x + 0.5) * t + ox) / RES_NEVOA)},${Math.floor(((y + 0.5) * t + oy) / RES_NEVOA)}`) && !rem.has(`${x},${y}`));
    assert.equal(faltam.length, 0, `camada ${id}: nada visível foi cortado`);
  }
  assert.ok(Object.keys(R.terrain.layers).length > 0);
});

test('pecasDoJogador: marca só as peças de jogador ligadas às fichas informadas', () => {
  const m = criarMapa({ id: 'm1', nome: 'M' });
  m.tokens.mia = { ...novaPeca([2, 2]), id: 'mia', player: true, refs: [{ app: 'ficha', tipo: 'ficha', id: 'f1' }] };
  m.tokens.leo = { ...novaPeca([4, 2]), id: 'leo', player: true, refs: [{ app: 'ficha', tipo: 'ficha', id: 'f2' }] };
  m.tokens.monstro = { ...novaPeca([6, 2]), id: 'monstro', player: false, refs: [{ app: 'ficha', tipo: 'ficha', id: 'f1' }] };
  assert.deepEqual([...pecasDoJogador(m, ['f1'])], ['mia']);
  assert.deepEqual([...pecasDoJogador(m, ['f1', 'f2'])].sort(), ['leo', 'mia']);
  assert.deepEqual([...pecasDoJogador(m, [])], []);
  assert.deepEqual([...pecasDoJogador(null, ['f1'])], []);
});

test('remota em modo darkwood recorta o nunca explorado, mantém o explorado exterior e sanitiza nomes, notas, regiões e NPCs fora da visão', () => {
  const m = mapaDeDois();
  m.memory = { ...m.memory, mode: 'darkwood' };
  m.props.oB = objeto('oB', 25, 18, {
    roomId: 'B',
    interaction: { kind: 'note', on: false, targets: [], sound: null, clue: null, note: 'NOTA-NO-COFRE', noteTitle: 'TITULO-NO-COFRE', toMapId: 'mapa-secreto', toTargetId: 'alvo-secreto' },
  });
  m.props.oOculto = objeto('oOculto', 4, 4, { oculto: true });
  m.tokens.npcFora = { ...novaPeca([7, 7]), id: 'npcFora', name: 'Monstro Oculto', player: false };
  m.tokens.hugo = { ...novaPeca([4, 4]), id: 'hugo', name: 'Hugo', player: true, vision: { radius: 3, dark: false, mode: 'cone', angle: 60 }, facing: 'right' };

  const p = projetarParaRemoto(m);
  validarMapa(p);

  // Área explorada (A e entorno explorado) permanece, mas cômodo B nunca explorado é recortado
  assert.ok(p.rooms.A, 'cômodo A explorado permanece');
  assert.equal(p.rooms.B, undefined, 'cômodo B nunca explorado não vaza');
  assert.ok(p.props.oA, 'mobília explorada permanece');
  assert.equal(p.props.oB, undefined, 'objeto de cômodo não explorado não vaza');

  // Spoilers continuam removidos/neutralizados
  assert.equal(p.rooms.A!.name, 'Sala A', 'cômodo revelado mantém o nome');
  assert.equal(p.props.oOculto, undefined, 'objeto oculto continua removido');
  assert.equal(p.tokens.npcFora, undefined, 'NPC fora da visão ativa continua removido mesmo na área explorada');
  assert.deepEqual(p.regions, {});
  assert.equal(p.session.event, null);
  const json = JSON.stringify(p);
  for (const segredo of ['COFRE-SECRETO', 'TITULO-SECRETO', 'Cripta do Rei Louco', 'Câmara do Tesouro', 'Saguão Secreto', 'NOTA-SECRETA', 'TITULO-NOTA', 'NOTA-NO-COFRE', 'TITULO-NO-COFRE', 'mapa-secreto', 'alvo-secreto', 'EVENTO-SECRETO', 'Monstro Oculto']) {
    assert.ok(!json.includes(segredo), `vazou em darkwood: ${segredo}`);
  }
});

test('remota: edifício com telhado tocado parcialmente (Enseada dos Piratas) preserva cells inteiras sem vazar interior', () => {
  const m = JSON.parse(readFileSync(new URL('../../public/exemplos/enseada-dos-piratas.atlas.json', import.meta.url), 'utf8')) as MapaAtlas;
  // Jogador fora da Taverna do Papagaio (canto sudoeste/oeste), explorando só o lado esquerdo da taverna (x 1..6.5, y 2..12)
  m.session = { explored: { res: 0.5, cells: retangulo(2, 4, 13, 24) }, initiative: null, revealed: [], event: null };
  m.tokens = { j: { ...novaPeca([2.2, 8.5]), id: 'j', player: true, vision: { radius: 4, dark: false } } };

  const p = projetarParaRemoto(m);
  validarMapa(p);

  const tavernaOrig = m.rooms.cc37cd116tq!;
  const tavernaRem = p.rooms.cc37cd116tq!;
  assert.ok(tavernaRem, 'Taverna do Papagaio conhecida entra no remoto');
  assert.deepEqual(tavernaRem.cells, tavernaOrig.cells, 'cells da taverna ficam inteiras (sem telhado cortado em escada)');
  assert.deepEqual(trechosDe(p, edificiosDe(p)[0]!), trechosDe(m, edificiosDe(m)[0]!), 'geometria do telhado é idêntica à do desktop');
  assert.equal(tavernaRem.name, 'Cômodo', 'nome do cômodo não revelado continua oculto');
  assert.equal(tavernaRem.function, null, 'função do cômodo não revelado continua oculta');
  assert.equal(p.rooms.ccf70ku18jq, undefined, 'Fortim distante não explorado não entra');
  // Objetos internos fora da área explorada (lado direito da taverna, x > 7) continuam cortados
  for (const o of Object.values(p.props)) assert.ok(o.position[0] <= 7.1, `objeto fora da área vazou: ${o.id} em x=${o.position[0]}`);
  const json = JSON.stringify(p);
  assert.ok(!json.includes('Taverna do Papagaio'));
  assert.ok(!json.includes('Fortim de São Brás'));
});

test('remota: edifício multi-cômodo com telhado preserva todo o edifício conectado quando tocado, mantendo salas não reveladas e edifícios distantes isolados', () => {
  const m = criarMapa({ id: 'multi', nome: 'Vila', largura: 40, altura: 30 });
  m.rooms.alaOeste = {
    ...comodo('alaOeste', 'Ala Oeste Secreta', retangulo(2, 2, 4, 4)),
    roof: { material: 'telha.barro', visible: true, shape: 'duas-aguas' },
  };
  m.rooms.alaLeste = {
    ...comodo('alaLeste', 'Cofre da Ala Leste', retangulo(4, 2, 6, 4)),
    roof: { material: 'telha.barro', visible: true, shape: 'duas-aguas' },
  };
  m.rooms.torreLonge = {
    ...comodo('torreLonge', 'Torre Oculta', retangulo(18, 12, 20, 14)),
    roof: { material: 'telha.ardosia', visible: true, shape: 'piramide' },
  };
  m.props.tesouroLeste = objeto('tesouroLeste', 7.5, 4.5, {
    roomId: 'alaLeste',
    interaction: { kind: 'note', on: false, targets: [], sound: null, clue: null, note: 'SENHA-LESTE', noteTitle: 'TITULO-LESTE' },
  });
  m.props.bauTorre = objeto('bauTorre', 28, 19, { roomId: 'torreLonge' });
  // Explora apenas fora da parede oeste (x = 1.5..2.8, y = 3..6), tocando só a borda externa da alaOeste
  m.session = { explored: { res: 0.5, cells: retangulo(3, 6, 6, 12) }, initiative: null, revealed: [], event: null };
  m.tokens = { j: { ...novaPeca([2.2, 4.5]), id: 'j', player: true, vision: { radius: 3, dark: false } } };

  const p = projetarParaRemoto(m);
  validarMapa(p);

  assert.deepEqual(p.rooms.alaOeste!.cells, m.rooms.alaOeste!.cells);
  assert.deepEqual(p.rooms.alaLeste!.cells, m.rooms.alaLeste!.cells);
  assert.equal(p.rooms.alaOeste!.name, 'Cômodo');
  assert.equal(p.rooms.alaLeste!.name, 'Cômodo');
  assert.equal(p.rooms.alaLeste!.function, null);
  assert.equal(p.rooms.torreLonge, undefined, 'edifício distante nunca visto continua fora');
  assert.equal(p.props.tesouroLeste, undefined, 'objeto interno não explorado na Ala Leste continua oculto');
  assert.equal(p.props.bauTorre, undefined);
  const json = JSON.stringify(p);
  for (const segredo of ['Ala Oeste Secreta', 'Cofre da Ala Leste', 'Torre Oculta', 'SENHA-LESTE', 'TITULO-LESTE']) {
    assert.ok(!json.includes(segredo), `vazou segredo: ${segredo}`);
  }
});

test('remota: filtro de visão foco oculta NPCs visíveis apenas para outro personagem', () => {
  const m = criarMapa({ id: 'foco-remoto', nome: 'Taverna', largura: 30, altura: 20 });
  m.walls.div = { id: 'div', kind: 'wall', path: [[15, 0], [15, 20]], height: 2.8, thickness: 0.2, material: 'parede.reboco', blocks: { sight: true, move: true, light: true }, drop: null, source: null, levelId: null };
  m.session.explored = { res: 0.5, cells: retangulo(0, 0, 60, 40) };
  m.tokens = {
    rowan: { ...novaPeca([5, 10]), id: 'rowan', name: 'Rowan', player: true, vision: { radius: 8, dark: false } },
    muirenn: { ...novaPeca([22, 10]), id: 'muirenn', name: 'Muirenn', player: true, vision: { radius: 8, dark: false } },
    npcRowan: { ...novaPeca([8, 10]), id: 'npcRowan', name: 'Bandido', player: false, vision: { radius: 0, dark: false } },
    npcMuirenn: { ...novaPeca([25, 10]), id: 'npcMuirenn', name: 'Guarda', player: false, vision: { radius: 0, dark: false } },
  };

  const focoMuirenn = projetarParaRemoto(m, null, { tipo: 'foco', tokenId: 'muirenn' });
  assert.equal(focoMuirenn.tokens.npcRowan, undefined, 'NPC visto só por Rowan não vaza no foco de Muirenn');
  assert.ok(focoMuirenn.tokens.npcMuirenn, 'NPC visto por Muirenn aparece');

  const individual = projetarParaRemoto(m, null, { tipo: 'individual', grupos: {} });
  assert.ok(individual.tokens.npcRowan, 'no modo individual, estado geral mantém NPCs visíveis para filtragem local');
  assert.ok(individual.tokens.npcMuirenn);
});
