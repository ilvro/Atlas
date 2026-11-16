import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa, type Objeto } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { ehComodoAoArLivre, ehMovelAoArLivre } from '../../src/render/tempo-no-chao.ts';

function movel(id: string, recipe: string, x: number, y: number, extra: Partial<Objeto> = {}): Objeto {
  return {
    id,
    source: { kind: 'recipe', recipe, seed: 1, params: {} },
    position: [x, y],
    rotation: 0,
    scale: 1,
    elevation: 'floor',
    wall: null,
    roomId: null,
    blocks: { move: true, sight: false },
    castsShadow: true,
    harmonize: false,
    interaction: null,
    ...extra,
  };
}

test('ehComodoAoArLivre e ehMovelAoArLivre identificam pisos abertos e móveis externos', () => {
  const store = criarStore(criarMapa({ largura: 24, altura: 18 }));
  store.executar({
    tipo: 'comodo.criar',
    id: 'coberto',
    nome: 'Sala',
    funcao: 'sala',
    celulas: [[2, 2], [3, 2], [2, 3], [3, 3]],
    piso: { material: 'tabuas.carvalho', seed: 1 },
    papel: null,
    telhado: 'casa-de-telha',
    levelId: null,
  });
  store.executar({
    tipo: 'comodo.criar',
    id: 'patio',
    nome: 'Pátio',
    funcao: 'patio',
    celulas: [[4, 2], [5, 2], [4, 3], [5, 3]],
    piso: { material: 'pedra.laje', seed: 2 },
    papel: null,
    telhado: null,
    levelId: null,
  });

  const m = store.documento;
  assert.equal(ehComodoAoArLivre(m.rooms.coberto!), false);
  assert.equal(ehComodoAoArLivre(m.rooms.patio!), true);

  assert.equal(ehMovelAoArLivre(m, movel('b_fora', 'banco.jardim', 12, 12)), true);
  assert.equal(ehMovelAoArLivre(m, movel('b_patio', 'banco', 7.5, 4.5)), true);
  assert.equal(ehMovelAoArLivre(m, movel('m_fora', 'mesa.taverna', 12, 12)), true);
  assert.equal(ehMovelAoArLivre(m, movel('c_fora', 'carroca', 12, 12)), true);
  assert.equal(ehMovelAoArLivre(m, movel('r_fora', 'barril', 12, 12)), true);
  assert.equal(ehMovelAoArLivre(m, movel('x_fora', 'caixa', 12, 12)), true);

  assert.equal(ehMovelAoArLivre(m, movel('b_dentro', 'banco', 4.5, 4.5)), false, 'móvel dentro de cômodo coberto não recebe chapéu');
  assert.equal(ehMovelAoArLivre(m, movel('arv_fora', 'arvore', 12, 12)), false, 'não-móvel fora da lista');
  assert.equal(ehMovelAoArLivre(m, movel('b_sub', 'banco', 12, 12, { elevation: 'underwater' })), false, 'submerso não recebe chapéu');
});
