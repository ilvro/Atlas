import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Autor } from '#mesa';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { atenderMoverPeca } from '../../src/app/mover-peca-remota.ts';

function cenario() {
  const m = criarMapa({ id: 'mapa-1', nome: 'Taverna' });
  m.grid.snap = true;
  m.grid.size = 1.5;
  m.grid.offset = [0, 0];
  m.tokens.t1 = {
    id: 't1',
    name: 'Lia',
    player: true,
    position: [0.75, 0.75],
    size: 1,
    facing: 'down',
    portrait: null,
    sprite: null,
    vision: { radius: 6, dark: false },
    lightId: null,
    figure: { state: 'normal' },
    refs: [{ app: 'ficha', tipo: 'ficha', id: 'ficha-lia' }],
  };
  m.tokens.t2 = {
    id: 't2',
    name: 'Kael',
    player: true,
    position: [2.25, 0.75],
    size: 1,
    facing: 'down',
    portrait: null,
    sprite: null,
    vision: { radius: 6, dark: false },
    lightId: null,
    figure: { state: 'normal' },
    refs: [{ app: 'ficha', tipo: 'ficha', id: 'ficha-kael' }],
  };
  m.tokens.npc = {
    id: 'npc',
    name: 'Guarda',
    player: false,
    position: [3.75, 0.75],
    size: 1,
    facing: 'down',
    portrait: null,
    sprite: null,
    vision: { radius: 6, dark: false },
    lightId: null,
    figure: { state: 'normal' },
    refs: [{ app: 'ficha', tipo: 'ficha', id: 'ficha-lia' }],
  };
  const store = criarStore(m, { salvo: true });
  return { store };
}

const autorLia: Autor = { discordId: 'u1', nome: 'Ana', papel: 'jogador', fichas: ['ficha-lia'] };

describe('atenderMoverPeca (R15)', () => {
  it('aceita a própria peça, encaixa na grade, permite desfazer e notifica', () => {
    const { store } = cenario();
    const avisos: string[] = [];
    const res = atenderMoverPeca(
      { store: () => store, aoMover: ({ autor, pecaNome }) => avisos.push(`${autor.nome} moveu ${pecaNome}`) },
      { mapa: 'mapa-1', peca: 't1', position: [3.1, 2.1] },
      autorLia,
    );
    assert.deepEqual(res, { ok: true });
    // [3.1, 2.1] com grade 1.5 -> célula (2, 1) -> centro [3.75, 2.25]
    assert.deepEqual(store.documento.tokens.t1!.position, [3.75, 2.25]);
    assert.deepEqual(avisos, ['Ana moveu Lia']);

    store.desfazer();
    assert.deepEqual(store.documento.tokens.t1!.position, [0.75, 0.75]);
  });

  it('recusa a peça de outro jogador ou peça que não é de jogador', () => {
    const { store } = cenario();
    const resOutro = atenderMoverPeca(
      { store: () => store },
      { mapa: 'mapa-1', peca: 't2', position: [3.75, 2.25] },
      autorLia,
    );
    assert.equal(resOutro.ok, false);
    assert.deepEqual(store.documento.tokens.t2!.position, [2.25, 0.75]);

    const resNpc = atenderMoverPeca(
      { store: () => store },
      { mapa: 'mapa-1', peca: 'npc', position: [3.75, 2.25] },
      autorLia,
    );
    assert.equal(resNpc.ok, false);
  });

  it('recusa sem autor', () => {
    const { store } = cenario();
    const res = atenderMoverPeca(
      { store: () => store },
      { mapa: 'mapa-1', peca: 't1', position: [3.75, 2.25] },
      undefined,
    );
    assert.equal(res.ok, false);
    assert.deepEqual(store.documento.tokens.t1!.position, [0.75, 0.75]);
  });

  it('recusa mapa errado ou sem mapa aberto', () => {
    const { store } = cenario();
    const resMapa = atenderMoverPeca(
      { store: () => store },
      { mapa: 'outro-mapa', peca: 't1', position: [3.75, 2.25] },
      autorLia,
    );
    assert.equal(resMapa.ok, false);

    const resSem = atenderMoverPeca(
      { store: () => null },
      { mapa: 'mapa-1', peca: 't1', position: [3.75, 2.25] },
      autorLia,
    );
    assert.equal(resSem.ok, false);
  });
});
