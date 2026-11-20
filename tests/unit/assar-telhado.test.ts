import assert from 'node:assert/strict';
import { test } from 'node:test';
import { codificar } from '../../src/domain/celulas.ts';
import { edificiosDe } from '../../src/domain/edificios.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { amostrarTelhado, type EntradaDoTelhado } from '../../src/procedural/assar-telhado.ts';
import { prioridadePadraoDoPedido } from '../../src/procedural/baker.ts';
import { chaveDoTelhado, entradaDoTelhado } from '../../src/render/entradas.ts';

const GRADE = { size: 1, offset: [0, 0] as [number, number] };

function ret(x0: number, y0: number, w: number, h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push([x, y]);
  return out;
}

function pixelEm(
  dados: { largura: number; altura: number; origem: [number, number]; res: number; cor: Uint8ClampedArray; normal: Uint8ClampedArray | null },
  wx: number,
  wy: number,
) {
  const px = Math.floor((wx - dados.origem[0]) * dados.res);
  const py = Math.floor((wy - dados.origem[1]) * dados.res);
  assert.ok(px >= 0 && px < dados.largura && py >= 0 && py < dados.altura, `ponto (${wx}, ${wy}) fora da tela`);
  const k = (py * dados.largura + px) * 4;
  return {
    r: dados.cor[k]!,
    g: dados.cor[k + 1]!,
    b: dados.cor[k + 2]!,
    a: dados.cor[k + 3]!,
    nr: dados.normal ? dados.normal[k]! : 0,
    ng: dados.normal ? dados.normal[k + 1]! : 0,
    nb: dados.normal ? dados.normal[k + 2]! : 0,
    na: dados.normal ? dados.normal[k + 3]! : 0,
  };
}

function mapaComSala(celulas: [number, number][], details?: ('chamine' | 'cruz')[]): MapaAtlas {
  const m = criarMapa({ nome: 'Teste' });
  m.grid.size = 1;
  m.rooms['s1'] = {
    id: 's1',
    name: 'Casa',
    function: null,
    cells: codificar(celulas),
    floor: { material: 'madeira.tabuas', seed: 7 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    levelId: null,
    roof: {
      material: 'telha.barro',
      visible: true,
      shape: 'duas-aguas',
      ...(details ? { details } : {}),
    },
  };
  return m;
}

test('casa 4 × 3 tem alfa 0 fora do beiral e > 0 dentro (cor e normal)', () => {
  const entrada: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(2, 2, 4, 3), // [2..6] × [2..5], com beiral 0.25 -> [1.75..6.25] × [1.75..5.25]
        roof: { material: 'telha.barro', visible: true, shape: 'quatro-aguas' },
        seed: 5,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };

  const d = amostrarTelhado(entrada, 24, 'illustrated');
  assert.ok(d.normal, 'Ilustrado gera mapa normal/AO');

  // Fora do beiral (nos cantos da margem)
  const fora1 = pixelEm(d, 1.66, 1.66);
  const fora2 = pixelEm(d, 6.32, 5.32);
  assert.equal(fora1.a, 0);
  assert.equal(fora1.na, 0);
  assert.equal(fora2.a, 0);
  assert.equal(fora2.na, 0);

  // Dentro do telhado
  const centro = pixelEm(d, 4.0, 3.5);
  const aguaNorte = pixelEm(d, 4.0, 2.3);
  const aguaSul = pixelEm(d, 4.0, 4.7);
  assert.ok(centro.a > 0 && centro.na > 0);
  assert.ok(aguaNorte.a > 0 && aguaSul.a > 0);
  // Água norte inclina para -y (G < 128), água sul inclina para +y (G > 128)
  assert.ok(aguaNorte.ng < 120, `esperava água norte ng < 120, veio ${aguaNorte.ng}`);
  assert.ok(aguaSul.ng > 136, `esperava água sul ng > 136, veio ${aguaSul.ng}`);
});

test('casa em L muda a direção da normal ao cruzar o rincão e escurece o canal B (AO) no rincão', () => {
  // Corpo horizontal [0..5] × [0..2] + ala vertical [0..2] × [2..5], ambas duas-águas.
  // O rincão interno corre na diagonal saindo de (2.25, 2.25) em direção a (1, 1).
  const entrada: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: [...ret(0, 0, 5, 2), ...ret(0, 2, 2, 3)],
        roof: { material: 'telha.barro', visible: true, shape: 'duas-aguas' },
        seed: 11,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };

  const d = amostrarTelhado(entrada, 32, 'illustrated');
  assert.ok(d.normal);

  // Lado da água sul do corpo horizontal (acima-direita do rincão): inclina para +y (ng > 128, nr ≈ 128)
  const ladoCorpo = pixelEm(d, 2.6, 1.7);
  // Lado da água leste da ala vertical (abaixo-esquerda do rincão): inclina para +x (nr > 128, ng ≈ 128)
  const ladoAla = pixelEm(d, 1.7, 2.6);
  // Bem sobre a diagonal do rincão em (1.6, 1.6)
  const noRincao = pixelEm(d, 1.6, 1.6);

  assert.ok(ladoCorpo.ng > ladoAla.ng + 25, `normal Y deve cair ao cruzar o rincão: ${ladoCorpo.ng} vs ${ladoAla.ng}`);
  assert.ok(ladoAla.nr > ladoCorpo.nr + 25, `normal X deve subir ao cruzar o rincão: ${ladoAla.nr} vs ${ladoCorpo.nr}`);

  // Canal B (AO) deve ser nitidamente menor no rincão do que no meio de uma água aberta
  const aguaAberta = pixelEm(d, 4.0, 1.6);
  assert.ok(
    noRincao.nb < aguaAberta.nb - 40,
    `AO no rincão (${noRincao.nb}) deveria ser bem menor que na água aberta (${aguaAberta.nb})`,
  );
});

test('mesma entrada gera saída determinística idêntica', () => {
  const entrada: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 4, 3),
        roof: { material: 'telha.ardosia', visible: true, shape: 'quatro-aguas', details: ['chamine'] },
        seed: 42,
      },
    ],
    neve: 0,
    sol: { dir: [0.5, 0.866], porMetro: 0.4, forca: 0.4 },
    genero: 'investigacao',
  };

  const a = amostrarTelhado(entrada, 24, 'illustrated');
  const b = amostrarTelhado(entrada, 24, 'illustrated');
  assert.equal(a.largura, b.largura);
  assert.equal(a.altura, b.altura);
  assert.deepEqual(a.origem, b.origem);
  assert.deepEqual(a.cor, b.cor);
  assert.deepEqual(a.normal, b.normal);
});

test('detalhes (chaminé e cruz) aparecem na imagem', () => {
  const base: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 4, 6),
        roof: { material: 'telha.ardosia', visible: true, shape: 'duas-aguas', ridge: 'v' },
        seed: 19,
      },
    ],
    neve: 0,
    sol: { dir: [0.5, 0.866], porMetro: 0.45, forca: 0.45 },
    genero: 'investigacao',
  };
  const comDetalhes: EntradaDoTelhado = {
    ...base,
    trechos: [
      {
        ...base.trechos[0]!,
        roof: { ...base.trechos[0]!.roof, details: ['chamine', 'cruz'] },
      },
    ],
  };

  const sem = amostrarTelhado(base, 24, 'illustrated');
  const com = amostrarTelhado(comDetalhes, 24, 'illustrated');
  assert.equal(com.detalhes.length, 2);

  for (const det of com.detalhes) {
    const pCom = pixelEm(com, det.x, det.y);
    const pSem = pixelEm(sem, det.x, det.y);
    const diff = Math.abs(pCom.r - pSem.r) + Math.abs(pCom.g - pSem.g) + Math.abs(pCom.b - pSem.b);
    assert.ok(diff > 15, `detalhe ${det.detalhe} em (${det.x.toFixed(2)}, ${det.y.toFixed(2)}) deveria alterar o pixel (diff=${diff})`);
  }
});

test('estilo pixel não gera mapa normal', () => {
  const entrada: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 3, 2),
        roof: { material: 'telha.barro', visible: true, shape: 'duas-aguas' },
        seed: 3,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };
  const d = amostrarTelhado(entrada, 16, 'pixel');
  assert.equal(d.normal, null);
  assert.ok(pixelEm(d, 1.5, 1.0).a > 0);
});

test('entradaDoTelhado e chaveDoTelhado ignoram mudança de hora quando não há detalhes, e incluem sol quando há detalhes', () => {
  const mSem = mapaComSala(ret(0, 0, 4, 3));
  const edSem = edificiosDe(mSem)[0]!;
  mSem.climate.time = '09:00';
  mSem.climate.sun = { angle: 0.8, color: '#ffe8c0', intensity: 0.85 };
  const e1 = entradaDoTelhado(mSem, edSem);
  const k1 = chaveDoTelhado(e1, 64, 'illustrated');
  assert.equal(e1.sol, undefined);

  mSem.climate.time = '16:30';
  mSem.climate.sun = { angle: 2.6, color: '#ffb870', intensity: 0.6 };
  const e2 = entradaDoTelhado(mSem, edSem);
  const k2 = chaveDoTelhado(e2, 64, 'illustrated');
  assert.equal(k1, k2, 'sem detalhes, mudar a hora não deve invalidar a chave do telhado');

  const mCom = mapaComSala(ret(0, 0, 4, 3), ['chamine']);
  const edCom = edificiosDe(mCom)[0]!;
  mCom.climate.time = '09:00';
  mCom.climate.sun = { angle: 0.8, color: '#ffe8c0', intensity: 0.85 };
  const ec1 = entradaDoTelhado(mCom, edCom);
  assert.ok(ec1.sol, 'com detalhes e sol ativo, a entrada carrega direção do sol');

  mCom.climate.time = '16:30';
  mCom.climate.sun = { angle: 2.6, color: '#ffb870', intensity: 0.6 };
  const ec2 = entradaDoTelhado(mCom, edCom);
  assert.notEqual(
    chaveDoTelhado(ec1, 64, 'illustrated'),
    chaveDoTelhado(ec2, 64, 'illustrated'),
    'com detalhes, mudar o ângulo do sol muda a chave',
  );
});

test('prioridade do pedido telhado no baker é 2', () => {
  assert.equal(prioridadePadraoDoPedido('telhado'), 2);
});
