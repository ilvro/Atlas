import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { corDoPing, DURACAO_PING_MS, pingsAtivos, setaNaBorda, type Ping } from '../../src/domain/pings.ts';

describe('pings (R15b)', () => {
  it('pingsAtivos expira em 3 s', () => {
    const base: Ping = {
      id: 'p1',
      mapa: 'm1',
      ponto: [2, 3],
      levelId: null,
      discordId: 'u1',
      nome: 'Ana',
      papel: 'jogador',
      em: 1000,
    };
    assert.equal(pingsAtivos([base], 1000).length, 1);
    assert.equal(pingsAtivos([base], 1000 + DURACAO_PING_MS - 1).length, 1);
    assert.equal(pingsAtivos([base], 1000 + DURACAO_PING_MS).length, 0);
    assert.equal(pingsAtivos([base], 999).length, 0);
  });

  it('corDoPing é estável para o mesmo id e fixa para o mestre', () => {
    assert.equal(corDoPing('123', 'mestre'), corDoPing('456', 'mestre'));
    const c1 = corDoPing('jogador-abc', 'jogador');
    const c2 = corDoPing('jogador-abc', 'jogador');
    assert.equal(c1, c2);
    assert.match(c1, /^#[0-9a-f]{6}$/);
  });

  it('setaNaBorda devolve null dentro da tela e posição na borda quando fora', () => {
    assert.equal(setaNaBorda([400, 300], 800, 600), null);
    assert.equal(setaNaBorda([0, 0], 800, 600), null);

    const dir = setaNaBorda([1200, 300], 800, 600, 24);
    assert.ok(dir);
    assert.equal(Math.round(dir.x), 800 - 24);
    assert.equal(Math.round(dir.y), 300);
    assert.ok(Math.abs(dir.angulo) < 1e-6);

    const cima = setaNaBorda([400, -200], 800, 600, 24);
    assert.ok(cima);
    assert.equal(Math.round(cima.x), 400);
    assert.equal(Math.round(cima.y), 24);
    assert.ok(Math.abs(cima.angulo + Math.PI / 2) < 1e-6);
  });
});
