import { test } from 'node:test';
import assert from 'node:assert/strict';
import { area, codificar, contem, decodificar, ehCanonica, limites, normalizar, subtrair, unir } from '../../src/domain/celulas.ts';
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
  assert.equal(m.schema, 'atlas.map'); assert.equal(m.version, 1); assert.equal(m.revision, 0);
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
  assert.throws(() => lerMapa({ ...criarMapa(), version: 2 }), /mais nova/);
  const original = mapaCompleto(), lido = lerMapa(original);
  assert.deepEqual(lido, original); assert.notEqual(lido, original);
  assert.deepEqual(MIGRACOES, {});
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
