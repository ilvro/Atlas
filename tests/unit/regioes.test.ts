import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef, type Ref } from '#mesa';
import { pontoNoPoligono, regiaoOcupada, regioesEntradas, regioesOcupadas } from '../../src/domain/regioes.ts';
import { reagirAoMovimento, iniciarRegioes, textoDoGatilho, type SaidasDeRegiao } from '../../src/app/regioes.ts';
import { criarMapa, type MapaAtlas, type Regiao } from '../../src/domain/mapa.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { criarStore } from '../../src/state/store.ts';

const cena = (id: string): Ref => criarRef('jukebox', 'cena-sonora', id);
const regiao = (id: string, kind: Regiao['kind'], x0: number, y0: number, x1: number, y1: number, extra: Partial<Regiao> = {}): Regiao => ({ id, polygon: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], kind, gmOnly: false, payload: {}, refs: [], ...extra });
function mapa(pecas: [string, number, number, boolean][], regioes: Regiao[]): MapaAtlas {
  const m = criarMapa({ id: 'm', agora: 1 });
  for (const [id, x, y, jogador] of pecas) m.tokens[id] = novaPeca([x, y], id, { id, player: jogador });
  for (const r of regioes) m.regions[r.id] = r;
  return m;
}
const R = regiao('cripta', 'audio', 10, 10, 20, 20, { refs: [cena('cripta')] });

test('pontoNoPoligono: dentro, fora e em polígono côncavo', () => {
  const sq = R.polygon; assert.equal(pontoNoPoligono([15, 15], sq), true); assert.equal(pontoNoPoligono([25, 15], sq), false); assert.equal(pontoNoPoligono([15, 5], sq), false);
  const L: [number, number][] = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  assert.equal(pontoNoPoligono([2, 8], L), true); assert.equal(pontoNoPoligono([8, 8], L), false);
});

test('regioesEntradas: entrar conta; já estar dentro, peça que não é de jogador e sair não contam', () => {
  const fora = mapa([['ana', 5, 15, true], ['ogro', 5, 5, false]], [R]);
  const dentro = mapa([['ana', 15, 15, true], ['ogro', 15, 15, false]], [R]);
  assert.deepEqual(regioesEntradas(fora, dentro), [{ regiao: 'cripta', peca: 'ana' }]);
  assert.deepEqual(regioesEntradas(dentro, dentro), [], 'já estava dentro');
  assert.deepEqual(regioesEntradas(dentro, fora), [], 'sair não é entrar');
  assert.deepEqual(regioesEntradas(fora, mapa([['ana', 5, 15, true], ['beto', 12, 12, true]], [R])), [{ regiao: 'cripta', peca: 'beto' }], 'uma peça nova já dentro conta');
  assert.deepEqual(regioesOcupadas(dentro).map(r => r.id), ['cripta']); assert.deepEqual(regioesOcupadas(dentro, 'trigger'), []);
});

function saidas() { const feitos: string[] = []; const s: SaidasDeRegiao = { emitir: (tipo, d) => feitos.push(`emitir ${tipo} ${(d as { regiao: { id: string } }).regiao.id}`), pedirCena: ref => feitos.push(`cena ${ref?.id ?? 'nenhuma'}`), avisar: t => feitos.push(`aviso ${t}`) }; return { feitos, s }; }

test('reagirAoMovimento: entrar em região de áudio emite o fato e pede a cena; sair volta à cena do clima (ou do mapa)', () => {
  const fora = mapa([['ana', 5, 15, true]], [R]), dentro = mapa([['ana', 15, 15, true]], [R]); fora.audioCue = cena('mapa'); dentro.audioCue = cena('mapa');
  const a = saidas(); reagirAoMovimento(fora, dentro, a.s); assert.deepEqual(a.feitos, ['emitir atlas.regiao-entrou m/cripta', 'cena cripta']);
  const b = saidas(); reagirAoMovimento(dentro, fora, b.s); assert.deepEqual(b.feitos, ['cena mapa'], 'ao sair, volta a cena do mapa');
  fora.climate.preset = 'tempestade'; fora.climateAudio.tempestade = cena('chuva');
  const c = saidas(); reagirAoMovimento(dentro, fora, c.s); assert.deepEqual(c.feitos, ['cena chuva'], 'a do clima vale mais que a do mapa');
  const d = saidas(); reagirAoMovimento(fora, fora, d.s); assert.deepEqual(d.feitos, [], 'nada mudou');
});

test('reagirAoMovimento: com duas peças, a região só deixa de valer quando a última sai; gatilho mostra o texto; região de áudio sem cena só emite', () => {
  const dois = mapa([['ana', 15, 15, true], ['beto', 12, 12, true]], [R]), umSai = mapa([['ana', 15, 15, true], ['beto', 3, 3, true]], [R]);
  const a = saidas(); reagirAoMovimento(dois, umSai, a.s); assert.deepEqual(a.feitos, [], 'a Ana continua dentro: a cena não muda');
  const G = regiao('alçapão', 'trigger', 0, 0, 5, 5, { payload: { texto: ' O chão range. ' } }), antes = mapa([['ana', 8, 8, true]], [G]), depois = mapa([['ana', 2, 2, true]], [G]);
  const b = saidas(); reagirAoMovimento(antes, depois, b.s); assert.deepEqual(b.feitos, ['emitir atlas.regiao-entrou m/alçapão', 'aviso O chão range.']);
  const muda = regiao('vazia', 'audio', 0, 0, 5, 5), c = saidas(); reagirAoMovimento(mapa([['ana', 8, 8, true]], [muda]), mapa([['ana', 2, 2, true]], [muda]), c.s);
  assert.deepEqual(c.feitos, ['emitir atlas.regiao-entrou m/vazia']);
  assert.equal(textoDoGatilho({ texto: ' oi ' }), 'oi'); assert.equal(textoDoGatilho({ text: 'hi' }), 'hi'); assert.equal(textoDoGatilho({ texto: '  ' }), null); assert.equal(textoDoGatilho({ x: 1 }), null);

  // Gatilho com clima, cena do Jukebox e efeito
  const feitosGatilho: string[] = [];
  const saidasRicas: SaidasDeRegiao = {
    ...saidas().s,
    pedirCena: ref => feitosGatilho.push(`cena ${ref?.id}`),
    avisar: t => feitosGatilho.push(`aviso ${t}`),
    trocarClima: c => feitosGatilho.push(`clima ${c}`),
    dispararEfeito: e => feitosGatilho.push(`efeito ${e}`),
  };
  const Grich = regiao('emboscada', 'trigger', 0, 0, 5, 5, {
    payload: { texto: 'Uma armadilha dispara!', clima: 'tempestade', efeito: 'relampago' },
    refs: [cena('suspense')],
  });
  reagirAoMovimento(mapa([['ana', 8, 8, true]], [Grich]), mapa([['ana', 2, 2, true]], [Grich]), saidasRicas);
  assert.deepEqual(feitosGatilho, [
    'aviso Uma armadilha dispara!',
    'clima tempestade',
    'efeito relampago',
    'cena suspense',
  ]);
});

test('regiaoOcupada: só peça de jogador dentro conta; região inexistente não', () => {
  const m = mapa([['ana', 15, 15, true], ['ogro', 12, 12, false]], [R]);
  assert.equal(regiaoOcupada(m, 'cripta'), true);
  assert.equal(regiaoOcupada(mapa([['ogro', 12, 12, false], ['ana', 5, 5, true]], [R]), 'cripta'), false);
  assert.equal(regiaoOcupada(m, 'nada'), false);
});

function gatilho(disparo?: string, efeito?: string) {
  const G = regiao('g', 'trigger', 0, 0, 10, 10, { payload: { texto: 'Boo', ...(disparo ? { disparo } : {}), ...(efeito ? { efeito } : {}) } });
  const fora = mapa([['ana', 50, 50, true], ['beto', 50, 50, true]], [G]);
  const um = mapa([['ana', 2, 2, true], ['beto', 50, 50, true]], [G]), dois = mapa([['ana', 2, 2, true], ['beto', 3, 3, true]], [G]);
  return { fora, um, dois };
}
function saidasComEstado() {
  const feitos: string[] = [], disparados = new Set<string>();
  const s: SaidasDeRegiao = { emitir: tipo => feitos.push(tipo), pedirCena() {}, avisar: t => feitos.push(`aviso ${t}`), dispararEfeito: e => feitos.push(`efeito ${e}`), jaDisparou: id => disparados.has(id), marcarDisparo: id => { disparados.add(id); } };
  return { feitos, s };
}
const avisos = (f: string[]) => f.filter(x => x.startsWith('aviso')).length;

test('gatilho "ao-ocupar" (padrão): dois jogadores entrando em sequência disparam uma vez; esvaziar e reentrar dispara de novo; o fato sai por jogador', () => {
  const { fora, um, dois } = gatilho(undefined, 'clarao'), a = saidasComEstado();
  reagirAoMovimento(fora, um, a.s); reagirAoMovimento(um, dois, a.s);
  assert.equal(avisos(a.feitos), 1); assert.deepEqual(a.feitos.filter(x => x.startsWith('efeito')), ['efeito clarao']);
  assert.equal(a.feitos.filter(x => x === 'atlas.regiao-entrou').length, 2, 'o fato é por jogador');
  reagirAoMovimento(dois, fora, a.s); reagirAoMovimento(fora, um, a.s);
  assert.equal(avisos(a.feitos), 2, 'região esvaziou e foi ocupada de novo');
  const b = saidasComEstado(); reagirAoMovimento(fora, dois, b.s);
  assert.equal(avisos(b.feitos), 1, 'dois entrando no mesmo movimento: uma vez'); assert.equal(b.feitos.filter(x => x === 'atlas.regiao-entrou').length, 2);
});

test('gatilho "uma-vez": dispara uma vez e não de novo ao reentrar, até rearmar', () => {
  const { fora, um } = gatilho('uma-vez'), a = saidasComEstado();
  reagirAoMovimento(fora, um, a.s); reagirAoMovimento(um, fora, a.s); reagirAoMovimento(fora, um, a.s);
  assert.equal(avisos(a.feitos), 1);
  assert.equal(a.s.jaDisparou!('g'), true);
});

test('gatilho "cada-jogador": dispara a cada entrada', () => {
  const { fora, um, dois } = gatilho('cada-jogador'), a = saidasComEstado();
  reagirAoMovimento(fora, um, a.s); reagirAoMovimento(um, dois, a.s);
  assert.equal(avisos(a.feitos), 2);
});

test('gatilho: aceita os eventos de cena no efeito e ignora valores desconhecidos', () => {
  for (const e of ['tremor', 'piscar', 'escurecer', 'clarao', 'relampago']) { const { fora, um } = gatilho(undefined, e), a = saidasComEstado(); reagirAoMovimento(fora, um, a.s); assert.ok(a.feitos.includes(`efeito ${e}`), e); }
  const { fora, um } = gatilho(undefined, 'xis'), a = saidasComEstado(); reagirAoMovimento(fora, um, a.s); assert.ok(!a.feitos.some(x => x.startsWith('efeito')));
});

test('iniciarRegioes: reage a executar e ao concluir de um gesto (com o antes de antes do gesto), mas não ao refazer nem ao gesto em andamento', () => {
  const { fora, um } = gatilho('cada-jogador'), store = criarStore(fora, { salvo: true }), a = saidasComEstado();
  iniciarRegioes({ store }, () => true, a.s);
  const mover = (x: number, y: number) => ({ tipo: 'item.atualizar', colecao: 'tokens', id: 'ana', patch: { position: [x, y] } }) as never;
  const g = store.iniciarGesto('Mover');
  g.aplicar(mover(30, 30)); g.aplicar(mover(2, 2));
  assert.equal(avisos(a.feitos), 0, 'durante o gesto nada dispara');
  g.concluir(); assert.equal(avisos(a.feitos), 1, 'ao concluir, comparado ao estado de antes do gesto');
  store.desfazer(); store.refazer(); assert.equal(avisos(a.feitos), 1, 'refazer não dispara de novo');
  store.executar(mover(50, 50)); const g2 = store.iniciarGesto('Mover'); g2.aplicar(mover(2, 2)); g2.aplicar(mover(60, 60)); g2.cancelar();
  store.executar(mover(2, 2)); assert.equal(avisos(a.feitos), 2, 'executar volta a reagir, com o antes correto após cancelar');
  void um;
});
