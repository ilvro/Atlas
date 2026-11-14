import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DETALHES_DE_TELHADO, type Telhado } from '../../src/domain/mapa.ts';
import type { Trecho } from '../../src/domain/telhado-geometria.ts';
import { descricaoDoDetalhe, posicoesDosDetalhes } from '../../src/procedural/detalhes-de-telhado.ts';
import { MATERIAIS } from '../../src/procedural/materiais.ts';

const GRADE = { size: 1.5, offset: [0, 0] as [number, number] };
const retangulo = (x0: number, y0: number, w: number, h: number): [number, number][] => { const c: [number, number][] = []; for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) c.push([x, y]); return c; };
const trecho = (celulas: [number, number][], roof: Partial<Telhado>): Trecho => ({ salas: ['a'], celulas, roof: { material: 'telha.barro', visible: true, ...roof } });

test('todo detalhe tem desenho, com materiais do catálogo (ou cor) e altura acima do telhado', () => {
  for (const d of DETALHES_DE_TELHADO) for (const cobertura of ['telha.barro', 'telha.pedra', 'telha.zinco']) {
    const desc = descricaoDoDetalhe(d, { cobertura, semente: 4 });
    assert.ok(desc.partes.length >= 3, `${d} quase sem partes`);
    for (const p of desc.partes) {
      assert.ok(p.mat.startsWith('#') || MATERIAIS[p.mat], `${d}: material desconhecido ${p.mat}`);
      assert.ok(p.z > 0, `${d}: parte sem altura`);
    }
    // O Pixel descarta o detalhe 3: sobra o bastante para o detalhe ser reconhecível.
    assert.ok(desc.partes.filter(p => (p.detalhe ?? 1) <= 2).length >= 2, `${d} some no Pixel`);
  }
});

test('a chaminé muda com a cobertura: pedra no telhado de pedra, cano de metal no zinco, tijolo no barro', () => {
  const mats = (c: string) => descricaoDoDetalhe('chamine', { cobertura: c, semente: 1 }).partes.map(p => p.mat);
  assert.ok(mats('telha.pedra').includes('laje.pedra'));
  assert.ok(mats('telha.barro').includes('tijolo'));
  assert.ok(mats('telha.zinco').includes('ferro') && !mats('telha.zinco').includes('tijolo'));
});

test('as posições caem dentro do trecho e se repetem com a mesma semente', () => {
  const casos: [Trecho, string][] = [
    [trecho(retangulo(2, 3, 6, 3), { shape: 'duas-aguas', details: ['chamine', 'cruz', 'catavento', 'claraboia'] }), 'duas águas'],
    [trecho(retangulo(0, 0, 3, 3), { shape: 'piramide', details: ['sino', 'catavento'] }), 'pirâmide'],
    [trecho(retangulo(0, 0, 4, 4), { shape: 'plano', details: ['caixa-dagua', 'claraboia'] }), 'laje'],
    [trecho([...retangulo(0, 0, 5, 2), ...retangulo(0, 2, 2, 3)], { shape: 'quatro-aguas', details: [...DETALHES_DE_TELHADO] }), 'em L'],
  ];
  for (const [t, nome] of casos) for (const semente of [1, 2, 3, 7, 11]) {
    const ps = posicoesDosDetalhes(t, GRADE, semente);
    assert.equal(ps.length, t.roof.details!.length, nome);
    assert.deepEqual(ps, posicoesDosDetalhes(t, GRADE, semente), `${nome}: a mesma semente repete`);
    for (const p of ps) {
      const cx = Math.floor(p.x / GRADE.size), cy = Math.floor(p.y / GRADE.size);
      assert.ok(t.celulas.some(([x, y]) => x === cx && y === cy), `${nome}: ${p.detalhe} fora do trecho em (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
    }
    for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++)
      assert.ok(Math.hypot(ps[a]!.x - ps[b]!.x, ps[a]!.y - ps[b]!.y) > 0.5, `${nome}: ${ps[a]!.detalhe} e ${ps[b]!.detalhe} um em cima do outro`);
  }
});

test('a cruz fica na ponta da cumeeira voltada para a frente do mapa; o cata-vento no meio dela', () => {
  const vertical = trecho(retangulo(0, 0, 3, 6), { shape: 'duas-aguas', details: ['cruz', 'catavento'] });
  const [cruz, cata] = posicoesDosDetalhes(vertical, GRADE, 1);
  assert.ok(cruz!.y > 7, `a cruz vai para baixo (+y), ficou em ${cruz!.y}`);
  assert.ok(Math.abs(cata!.y - 4.5) < 0.01 && Math.abs(cata!.x - 2.25) < 0.01);
});

test('sem detalhes, nenhuma posição', () => {
  assert.deepEqual(posicoesDosDetalhes(trecho(retangulo(0, 0, 2, 2), {}), GRADE, 1), []);
});
