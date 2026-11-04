import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef, type Ref } from '#mesa';
import { pontoNoPoligono, regioesEntradas, regioesOcupadas } from '../../src/domain/regioes.ts';
import { reagirAoMovimento, textoDoGatilho, type SaidasDeRegiao } from '../../src/app/regioes.ts';
import { criarMapa, type MapaAtlas, type Regiao } from '../../src/domain/mapa.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';

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
});
