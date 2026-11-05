import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area, codificar, contem, decodificar, ehCanonica, limites, normalizar, subtrair, unir } from '../../src/domain/celulas.ts';
import { criarRef } from '#mesa';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { colunas, conteudo, criarMapa, duplicarParaNovaSessao, linhas, type MapaAtlas } from '../../src/domain/mapa.ts';
import { MIGRACOES, aplicarMigracoes, lerMapa } from '../../src/domain/migracoes.ts';
import { conferirMapa, validarMapa } from '../../src/domain/validacao.ts';
import { mapaCompleto } from './fixtures.ts';

const caminhoDoErro = (m: unknown) => { try { validarMapa(m); return null; } catch (e) { if (e instanceof ErroDeValidacao) return e.caminho; throw e; } };
const mexer = (fn: (m: MapaAtlas) => void) => { const m = structuredClone(mapaCompleto()); fn(m); return m; };

test('um mapa novo é válido, vazio e no padrão de 1,5 m', () => {
  const m = criarMapa({ id: 'a', agora: 5 });
  validarMapa(m);
  assert.equal(m.schema, 'atlas.map'); assert.equal(m.version, 6); assert.equal(m.revision, 0);
  assert.equal(m.grid.size, 1.5); assert.equal(colunas(m), 30); assert.equal(linhas(m), 20);
  assert.deepEqual(Object.keys(m.rooms), []);
});

test('um mapa que usa todas as coleções é válido e sobrevive a JSON', () => {
  const m = mapaCompleto();
  validarMapa(m);
  validarMapa(JSON.parse(JSON.stringify(m)));
  assert.equal(conferirMapa(m).ok, true);
});

test('cada erro aponta o caminho exato', () => {
  assert.equal(caminhoDoErro(mexer(m => { (m as unknown as Record<string, unknown>).extra = 1; })), 'extra');
  assert.equal(caminhoDoErro(mexer(m => { m.grid.size = 0; })), 'grid.size');
  assert.equal(caminhoDoErro(mexer(m => { m.style.pixel.pixelsPerCell = 7; })), 'style.pixel.pixelsPerCell');
  assert.equal(caminhoDoErro(mexer(m => { m.climate.time = '25:00'; })), 'climate.time');
  assert.equal(caminhoDoErro(mexer(m => { m.lights.lampiao!.color = 'laranja'; })), 'lights.lampiao.color');
  assert.equal(caminhoDoErro(mexer(m => { m.lights.lampiao!.intensity = Number.NaN; })), 'lights.lampiao.intensity');
  assert.equal(caminhoDoErro(mexer(m => { (m.tokens.muirenn as unknown as Record<string, unknown>).nome = 'x'; })), 'tokens.muirenn.nome');
  assert.equal(caminhoDoErro(mexer(m => { m.props.mesa!.source = { kind: 'recipe', recipe: 'x', seed: 1.5, params: {} }; })), 'props.mesa.source.seed');
  assert.equal(caminhoDoErro(mexer(m => { (m.props.mesa!.source as unknown as { kind: string }).kind = 'magica'; })), 'props.mesa.source.kind');
  assert.equal(caminhoDoErro(mexer(m => { m.tokens.muirenn!.refs = [{ app: 'zzz' } as never]; })), 'tokens.muirenn.refs[0]');
  assert.equal(caminhoDoErro(mexer(m => { m.walls.p1!.path = [[0, 0]]; })), 'walls.p1.path');
  assert.equal(caminhoDoErro(mexer(m => { m.rooms.sala!.cells = [[2, 5, 3], [2, 6, 1]]; })), 'rooms.sala.cells');
});

test('a chave de cada coleção tem de ser o id do registro', () => {
  assert.equal(caminhoDoErro(mexer(m => { m.rooms.sala!.id = 'outra'; })), 'rooms.sala.id');
  assert.equal(caminhoDoErro(mexer(m => { m.rooms['com espaço'] = { ...m.rooms.sala!, id: 'com espaço' }; })), 'rooms.com espaço');
});

test('as relações entre as partes são conferidas', () => {
  assert.equal(caminhoDoErro(mexer(m => { m.walls.p1!.source = { roomId: 'fantasma' }; })), 'walls.p1.source.roomId');
  assert.equal(caminhoDoErro(mexer(m => { m.openings.porta!.wallId = 'fantasma'; })), 'openings.porta.wallId');
  assert.equal(caminhoDoErro(mexer(m => { m.props.mesa!.roomId = 'fantasma'; })), 'props.mesa.roomId');
  assert.equal(caminhoDoErro(mexer(m => { m.props.quadro!.wall = null; })), 'props.quadro.wall');
  assert.equal(caminhoDoErro(mexer(m => { m.props.mesa!.wall = { wallId: 'p1', at: 0.1, face: 'inner' }; })), 'props.mesa.wall');
  assert.equal(caminhoDoErro(mexer(m => { m.lights.lampiao!.ownerId = 'fantasma'; })), 'lights.lampiao.ownerId');
  assert.equal(caminhoDoErro(mexer(m => { m.tokens.muirenn!.lightId = 'fantasma'; })), 'tokens.muirenn.lightId');
  assert.equal(caminhoDoErro(mexer(m => { m.comodosExtra.fantasma = { id: 'fantasma', leitura: '', notasMestre: '', refs: [] }; })), 'comodosExtra.fantasma');
  assert.equal(caminhoDoErro(mexer(m => { m.session.initiative!.order.push({ tokenId: 'fantasma', value: 1 }); })), 'session.initiative.order[1].tokenId');
  assert.equal(caminhoDoErro(mexer(m => { m.session.initiative!.order.push({ tokenId: 'muirenn', value: 1 }); })), 'session.initiative.order[1].tokenId');
  assert.equal(caminhoDoErro(mexer(m => { m.session.initiative!.current = 3; })), 'session.initiative.current');
  assert.equal(caminhoDoErro(mexer(m => { m.session.revealed = ['fantasma']; })), 'session.revealed');
});

test('células fora do mapa são recusadas (faixa = [linha, coluna inicial, comprimento]; o mapa tem 30 × 20 células)', () => {
  assert.equal(caminhoDoErro(mexer(m => { m.rooms.sala!.cells = [[19, 0, 30]]; })), null);      // última linha, até a última coluna
  assert.equal(caminhoDoErro(mexer(m => { m.rooms.sala!.cells = [[20, 0, 1]]; })), 'rooms.sala.cells');   // linha 20 não existe
  assert.equal(caminhoDoErro(mexer(m => { m.rooms.sala!.cells = [[0, 28, 3]]; })), 'rooms.sala.cells');   // termina na coluna 30
  assert.equal(caminhoDoErro(mexer(m => { m.rooms.sala!.cells = [[0, 28, 2]]; })), null);
  assert.equal(caminhoDoErro(mexer(m => { m.rooms.sala!.cells = [[0, 0, 31]]; })), 'rooms.sala.cells');
});

test('uma luz sem cone é um círculo; com cone, um facho — e o cone tem limites', () => {
  assert.equal(caminhoDoErro(mexer(m => { m.lights.lanterna!.cone = { angle: 0, direction: 0 }; })), 'lights.lanterna.cone.angle');
  assert.equal(caminhoDoErro(mexer(m => { m.lights.lampiao!.cone = { angle: 1, direction: 3 }; })), null);
});

test('RLE: codificar e decodificar são inversos e juntam vizinhas', () => {
  const celulas: [number, number][] = [[3, 1], [1, 0], [2, 0], [0, 0], [5, 0], [1, 1], [2, 1], [3, 1]];
  const faixas = codificar(celulas);
  assert.deepEqual(faixas, [[0, 0, 3], [0, 5, 1], [1, 1, 3]]);
  assert.deepEqual(decodificar(faixas), normalizar(celulas));
  assert.equal(area(faixas), 7);
  assert.equal(contem(faixas, 5, 0), true); assert.equal(contem(faixas, 4, 0), false); assert.equal(contem(faixas, 3, 1), true);
  assert.deepEqual(limites(faixas), { x0: 0, y0: 0, x1: 5, y1: 1 });
  assert.equal(limites([]), null);
  assert.equal(ehCanonica(faixas), true);
  assert.equal(ehCanonica([[0, 0, 2], [0, 2, 1]]), false);   // emenda
  assert.equal(ehCanonica([[1, 0, 1], [0, 0, 1]]), false);   // fora de ordem
  assert.equal(ehCanonica([[0, 0, 0]]), false);              // vazia
});

test('RLE: unir e subtrair', () => {
  const a = codificar([[0, 0], [1, 0], [2, 0]]), b = codificar([[2, 0], [3, 0]]);
  assert.deepEqual(unir(a, b), [[0, 0, 4]]);
  assert.deepEqual(subtrair(a, b), [[0, 0, 2]]);
  assert.deepEqual(subtrair(a, a), []);
});

test('migrações: a cadeia roda em ordem, não toca no original e exige todos os passos', () => {
  const v1 = { schema: 'atlas.map', version: 1, nome: 'a' };
  const tabela = { 1: (d: Record<string, unknown>) => ({ ...d, nome: undefined, name: d.nome }), 2: (d: Record<string, unknown>) => ({ ...d, extra: 'novo' }) };
  const v3 = aplicarMigracoes(v1, tabela, 3);
  assert.deepEqual(v3, { schema: 'atlas.map', version: 3, nome: undefined, name: 'a', extra: 'novo' });
  assert.deepEqual(v1, { schema: 'atlas.map', version: 1, nome: 'a' });
  assert.throws(() => aplicarMigracoes(v1, { 1: tabela[1] }, 3), /Não há migração da versão 2 para a 3/);
  assert.throws(() => aplicarMigracoes({ ...v1, version: 4 }, tabela, 3), /mais nova que a 3/);
});

test('lerMapa recusa o que não é mapa e devolve cópias independentes do que leu', () => {
  assert.throws(() => lerMapa(null), /não é um mapa/);
  assert.throws(() => lerMapa({ schema: 'outra.coisa', version: 1 }), /atlas\.map/);
  assert.throws(() => lerMapa({ schema: 'atlas.map', version: 'x' }), /Versão inválida/);
  assert.throws(() => lerMapa({ ...criarMapa(), version: 7 }), /mais nova/);
  const original = mapaCompleto(), lido = lerMapa(original);
  assert.deepEqual(lido, original); assert.notEqual(lido, original);
  assert.deepEqual(Object.keys(MIGRACOES), ['1', '2', '3', '4', '5']);
});

test('conteúdo ignora revisão e carimbos de tempo, e só eles', () => {
  const a = mapaCompleto(), b = { ...structuredClone(a), revision: 9, createdAt: 5, updatedAt: 7 };
  assert.equal(conteudo(a), conteudo(b));
  b.name = 'Outro'; assert.notEqual(conteudo(a), conteudo(b));
});

test('duplicar para nova sessão mantém o mapa e zera o que aconteceu na sessão', () => {
  const m = mapaCompleto(), c = duplicarParaNovaSessao(m, { id: 'copia', agora: 9 });
  validarMapa(c);
  assert.notEqual(c.id, m.id); assert.equal(c.revision, 0); assert.equal(c.createdAt, 9); assert.equal(c.name, 'Casa dos Salgueiros (cópia)');
  assert.deepEqual(c.session, { explored: null, initiative: null, revealed: [], event: null });
  assert.deepEqual(c.rooms, m.rooms); assert.notEqual(c.rooms, m.rooms);
  assert.equal(m.session.revealed.length, 1);
});

test('migração 1→2: mapas da Fase 2 abrem no formato novo, sem perder nada', () => {
  // Um mapa como a Fase 2 o gravava: terreno base 'terra', luzes sem preset, portas sem lado.
  const atual = mapaCompleto(), v1 = structuredClone(atual) as unknown as Record<string, any>;
  v1.version = 1; v1.terrain = { resolution: 0.25, base: 'terra', layers: {} };
  for (const l of Object.values(v1.lights) as Record<string, unknown>[]) delete l.preset;
  for (const a of Object.values(v1.openings) as Record<string, unknown>[]) delete a.swing;
  const lido = lerMapa(v1);
  assert.equal(lido.version, 6); assert.equal(lido.terrain.base, 'vazio');
  assert.equal(lido.lights.lampiao!.preset, null); assert.equal(lido.openings.porta!.swing, 'a');
  assert.deepEqual(lido.rooms, atual.rooms); assert.deepEqual(lido.props, atual.props);
  assert.equal(v1.version, 1, 'o original não é tocado');
  // Um terreno base escolhido pelo mestre (com camadas) é respeitado; máscaras de imagem viram células vazias.
  const v1b = structuredClone(v1); v1b.terrain = { resolution: 0.25, base: 'terra', layers: { l1: { id: 'l1', material: 'grama', mask: { id: 'm', hash: 'abcdef012345' }, order: 0 } } };
  const lidob = lerMapa(v1b);
  assert.equal(lidob.terrain.base, 'terra'); assert.deepEqual(lidob.terrain.layers.l1, { id: 'l1', material: 'grama', cells: [], order: 0, flow: null });
});

test('camadas de terreno: células dentro do mapa, em faixas canônicas', () => {
  const m = mexer(x => { x.terrain.layers.g = { id: 'g', material: 'grama', cells: [[0, 0, 10], [1, 3, 4]], order: 0, flow: null }; });
  validarMapa(m);
  assert.equal(caminhoDoErro(mexer(x => { x.terrain.layers.g = { id: 'g', material: 'grama', cells: [[119, 170, 11]], order: 0, flow: null }; })), 'terrain.layers.g.cells');   // 180 × 120 células de 0,25 m
  assert.equal(caminhoDoErro(mexer(x => { x.terrain.layers.g = { id: 'g', material: 'grama', cells: [[0, 0, 5], [0, 4, 3]], order: 0, flow: null }; })), 'terrain.layers.g.cells');
});

test('migração 2→3: o mapa da Fase 3 abre no formato novo, com clima, tempo e presença por células', () => {
  const atual = mapaCompleto(), v2 = structuredClone(atual) as unknown as Record<string, any>;
  v2.version = 2; delete v2.climateAudio; delete v2.customClimates; delete v2.climate.weather; delete v2.climate.gridPower;
  v2.presence.musgo = { id: 'musgo', brush: 'musgo', mask: { id: 'mask-1', hash: 'abcdef012345' }, intensity: 0.6, seed: 4, gmOnly: false };
  const lido = lerMapa(v2);
  assert.equal(lido.version, 6);
  assert.deepEqual(lido.climate.weather, { rain: 0, snow: 0, fog: 0, wind: 0, dust: 0, embers: 0, leaves: 0, lightning: 0 });
  assert.equal(lido.climate.gridPower, true); assert.deepEqual(lido.climateAudio, {}); assert.deepEqual(lido.customClimates, {});
  assert.deepEqual(lido.presence.musgo!.cells, []); assert.ok(!('mask' in lido.presence.musgo!));
  assert.deepEqual(lido.rooms, atual.rooms); assert.equal(lido.climate.time, atual.climate.time);
  assert.equal(v2.version, 2, 'o original não é tocado');
  // Um mapa v1 passa pelas duas migrações de uma vez.
  const v1 = structuredClone(v2); v1.version = 1; v1.terrain = { resolution: 0.25, base: 'terra', layers: {} };
  for (const l of Object.values(v1.lights) as Record<string, unknown>[]) delete l.preset;
  for (const a of Object.values(v1.openings) as Record<string, unknown>[]) delete a.swing;
  assert.equal(lerMapa(v1).version, 6);
});

test('tempo e clima: limites e campos desconhecidos são recusados com o caminho', () => {
  validarMapa(mexer(x => { x.climate.weather.rain = 1; x.climate.weather.wind = -0.5; x.climate.gridPower = false; }));
  assert.equal(caminhoDoErro(mexer(x => { x.climate.weather.lightning = 2; })), 'climate.weather.lightning');
  assert.equal(caminhoDoErro(mexer(x => { x.climate.weather.wind = -1.5; })), 'climate.weather.wind');
  assert.equal(caminhoDoErro(mexer(x => { (x.climate.weather as unknown as Record<string, number>).granizo = 1; })), 'climate.weather.granizo');
  assert.equal(caminhoDoErro(mexer(x => { (x.climate as unknown as Record<string, unknown>).gridPower = 'sim'; })), 'climate.gridPower');
});

test('clima do usuário, áudio do clima e presença por células são validados', () => {
  const salvo = (m: ReturnType<typeof mapaCompleto>) => ({ id: 'noite-de-vela', name: 'Noite de vela', climate: { ambient: m.climate.ambient, sun: null, time: '23:00', weather: m.climate.weather, gridPower: false }, finish: { texture: 0.2, vignette: 0.5, saturation: 0.9, grain: 0.05, tint: '#ffffff', grade: { lift: 0, gamma: 1, gain: 1 }, edges: { kind: 'none' as const, amount: 0 }, glow: 0 } });
  validarMapa(mexer(x => { x.customClimates['noite-de-vela'] = salvo(x); x.climateAudio.tempestade = criarRef('jukebox', 'cena-sonora', 'chuva-forte'); }));
  assert.equal(caminhoDoErro(mexer(x => { x.customClimates.outro = salvo(x); })), 'customClimates.outro.id');
  assert.equal(caminhoDoErro(mexer(x => { (x.climateAudio as Record<string, unknown>).tempestade = { app: 'x' }; })), 'climateAudio.tempestade');
  assert.equal(caminhoDoErro(mexer(x => { (x.climateAudio as Record<string, unknown>)['com espaço'] = criarRef('jukebox', 'cena-sonora', 'a'); })), 'climateAudio.com espaço');
  assert.equal(caminhoDoErro(mexer(x => { x.presence.musgo!.cells = [[119, 170, 11]]; })), 'presence.musgo.cells');
  assert.equal(caminhoDoErro(mexer(x => { x.presence.musgo!.cells = [[0, 0, 5], [0, 4, 3]]; })), 'presence.musgo.cells');
});

test('migração 3→4: o mapa da Fase 4 ganha o gênero "investigacao" e o resto fica igual', () => {
  const atual = mapaCompleto(), v3 = structuredClone(atual) as unknown as Record<string, any>;
  v3.version = 3; delete v3.style.genre;
  const lido = lerMapa(v3);
  assert.equal(lido.version, 6); assert.equal(lido.style.genre, 'investigacao');
  assert.deepEqual(lido.rooms, atual.rooms); assert.deepEqual(lido.climate, atual.climate);
  assert.equal(v3.version, 3, 'o original não é tocado');
  const moderno = structuredClone(atual); moderno.style.genre = 'moderno'; assert.equal(lerMapa(moderno).style.genre, 'moderno');
  const sem = structuredClone(atual) as unknown as Record<string, any>; sem.style.genre = ''; assert.throws(() => lerMapa(sem), /genre/);
});

test('generoDe: id desconhecido vale como investigacao', async () => {
  const { generoDe, GENEROS } = await import('../../src/domain/presets.ts');
  assert.equal(generoDe('xyz').id, 'investigacao'); assert.equal(generoDe('fantasia').id, 'fantasia');
  assert.deepEqual(GENEROS.map(g => g.id), ['investigacao', 'moderno', 'fantasia']);
});

test('migração 4→5: o mapa da Fase 6 ganha `player: false`, `interaction: null` e o explorado vazio, sem perder nada', () => {
  const atual = mapaCompleto(), v4 = structuredClone(atual) as unknown as Record<string, any>;
  v4.version = 4;
  for (const o of Object.values(v4.props) as Record<string, unknown>[]) delete o.interaction;
  for (const k of Object.values(v4.tokens) as Record<string, unknown>[]) delete k.player;
  v4.session.explored = { id: 'antigo', hash: 'abcdef012345' };          // como um mapa antigo poderia ter guardado
  const lido = lerMapa(v4);
  assert.equal(lido.version, 6);
  assert.ok(Object.values(lido.props).every(o => o.interaction === null)); assert.ok(Object.values(lido.tokens).every(k => k.player === false));
  assert.equal(lido.session.explored, null);
  assert.deepEqual(lido.rooms, atual.rooms); assert.deepEqual(lido.climate, atual.climate);
  assert.equal(v4.version, 4, 'o original não é tocado');
});

test('v5: o interruptor só controla luzes que existem, o explorado precisa ser canônico e `duplicarParaNovaSessao` o zera', () => {
  const m = mapaCompleto(), luz = Object.keys(m.lights)[0]!, mesa = Object.keys(m.props)[0]!;
  const com = (interaction: unknown, explored: unknown = null) => { const x = structuredClone(m) as unknown as Record<string, any>; x.props[mesa].interaction = interaction; x.session.explored = explored; return x; };
  assert.doesNotThrow(() => lerMapa(com({ kind: 'switch', on: true, targets: [luz], sound: null, clue: null })));
  assert.throws(() => lerMapa(com({ kind: 'switch', on: true, targets: ['luz-que-nao-existe'], sound: null, clue: null })), /luz que não existe/);
  assert.throws(() => lerMapa(com({ kind: 'porta-mágica', on: true, targets: [], sound: null, clue: null })), /interaction/);
  assert.doesNotThrow(() => lerMapa(com(null, { res: 0.5, cells: [[0, 0, 4], [1, 2, 3]] })));
  assert.throws(() => lerMapa(com(null, { res: 0.5, cells: [[0, 0, 4], [0, 3, 2]] })), /faixas|sobreposição/i);
  assert.throws(() => lerMapa(com(null, { res: 5, cells: [] })), /explored/);
  assert.equal(duplicarParaNovaSessao({ ...m, session: { ...m.session, explored: { res: 0.5, cells: [[0, 0, 4]] } } }).session.explored, null);
});

test('migração 5→6: o mapa da Fase 9 ganha os campos neutros da Fase 10, sem perder nada', () => {
  const atual = mapaCompleto();
  atual.terrain.layers.g = { id: 'g', material: 'grama', cells: [[0, 0, 10]], order: 0, flow: null };
  atual.customClimates.vela = { id: 'vela', name: 'Vela', climate: (({ preset: _p, ...c }) => c)(atual.climate), finish: (({ preset: _p, ...f }) => f)(atual.finish) };
  const v5 = structuredClone(atual) as unknown as Record<string, any>;
  v5.version = 5;
  for (const c of Object.values(v5.terrain.layers) as Record<string, unknown>[]) delete c.flow;
  for (const p of Object.values(v5.walls) as Record<string, unknown>[]) delete p.drop;
  for (const l of Object.values(v5.lights) as Record<string, unknown>[]) delete l.rays;
  delete v5.finish.edges; delete v5.finish.glow;
  delete v5.customClimates.vela.finish.edges; delete v5.customClimates.vela.finish.glow;
  const lido = lerMapa(v5);
  assert.equal(lido.version, 6);
  assert.ok(Object.values(lido.terrain.layers).every(c => c.flow === null));
  assert.ok(Object.values(lido.walls).every(p => p.drop === null));
  assert.ok(Object.values(lido.lights).every(l => l.rays === false));
  assert.deepEqual(lido.finish.edges, { kind: 'none', amount: 0 }); assert.equal(lido.finish.glow, 0);
  assert.deepEqual(lido.customClimates.vela!.finish.edges, { kind: 'none', amount: 0 });
  assert.deepEqual(lido, atual, 'ida e volta: nada se perde');
  assert.equal(v5.version, 5, 'o original não é tocado');
});

test('v6: validação dos campos novos', () => {
  const com = (fn: (x: any) => void) => { const x = structuredClone(mapaCompleto()) as any; x.terrain.layers.g = { id: 'g', material: 'agua', cells: [[0, 0, 4]], order: 0, flow: null }; fn(x); return x; };
  assert.equal(caminhoDoErro(com(() => {})), null);
  assert.equal(caminhoDoErro(com(x => { x.finish.edges = { kind: 'chuva', amount: 0.5 }; })), 'finish.edges.kind');
  assert.equal(caminhoDoErro(com(x => { x.finish.glow = 2; })), 'finish.glow');
  assert.equal(caminhoDoErro(com(x => { x.finish.edges.amount = 1.5; })), 'finish.edges.amount');
  assert.equal(caminhoDoErro(com(x => { x.terrain.layers.g.flow = { angle: 1, speed: 2 }; })), null);
  assert.equal(caminhoDoErro(com(x => { x.terrain.layers.g.flow = { angle: 1, speed: 4 }; })), 'terrain.layers.g.flow.speed');
  assert.equal(caminhoDoErro(com(x => { x.terrain.layers.g.flow = { angle: Infinity, speed: 1 }; })), 'terrain.layers.g.flow.angle');
  const p = Object.keys(structuredClone(mapaCompleto()).walls)[0]!;
  assert.equal(caminhoDoErro(com(x => { x.walls[p].kind = 'cliff'; x.walls[p].drop = 'b'; })), null);
  assert.equal(caminhoDoErro(com(x => { x.walls[p].drop = 'c'; })), `walls.${p}.drop`);
  assert.equal(caminhoDoErro(com(x => { x.walls[p].drop = 'a'; })), null, 'drop fora de uma escarpa é tolerado');
  assert.equal(caminhoDoErro(com(x => { x.walls[p].source = { terrainLayerId: 'g' }; })), null);
  assert.equal(caminhoDoErro(com(x => { x.walls[p].source = { terrainLayerId: 'nao-existe' }; })), `walls.${p}.source.terrainLayerId`);
  const o = Object.keys(mapaCompleto().props)[0]!;
  assert.equal(caminhoDoErro(com(x => { x.props[o].elevation = 'underwater'; })), null);
  assert.equal(caminhoDoErro(com(x => { x.lights[Object.keys(x.lights)[0]!].rays = 'sim'; })), `lights.${Object.keys(mapaCompleto().lights)[0]}.rays`);
});
