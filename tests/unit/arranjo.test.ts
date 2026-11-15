import test from 'node:test';
import assert from 'node:assert/strict';
import { arranjar } from '../../src/authoring/arranjo.ts';
import { ErroDeConstrucao, aplicarEmCopia, comodos, portas } from '../../src/authoring/construcao.ts';
import { revisarMapa } from '../../src/authoring/revisao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';

test('fileiras em 10×6 m com espaçamento 1,5×2 m gera cerca de 20 itens com desalinho', () => {
  const m = criarMapa({ largura: 30, altura: 30 });
  const r = arranjar(
    m,
    {
      padrao: 'fileiras',
      area: { retangulo: [4, 4, 14, 10] },
      itens: [{ item: 'lapide' }],
      espacamento: [1.5, 2],
    },
    7,
  );

  assert.ok(r.ids.length >= 12 && r.ids.length <= 21, `esperava perto de 18-20 itens, veio ${r.ids.length}`);
  const final = aplicarEmCopia(m, r.comandos);
  const xs = new Set(Object.values(final.props).map(o => o.position[0]));
  assert.ok(xs.size > 6, 'os valores de x não devem ficar todos alinhados mecanicamente');
});

test('arranjo dentro de cômodo evita cair sobre uma porta', () => {
  let m = criarMapa({ largura: 30, altura: 30 });
  m = aplicarEmCopia(m, comodos(m, [{ rets: [[2, 2, 8, 6]], tipo: 'deposito' }], 1).comandos);
  // Porta na parede sul em x = 6.75, y = 9
  m = aplicarEmCopia(m, portas(m, [{ perto: [6.75, 9], tipo: 'door' }], 1).comandos);

  const r = arranjar(
    m,
    {
      padrao: 'fileiras',
      area: { retangulo: [3.2, 3.2, 11.8, 8.8] },
      itens: [{ item: 'caixote' }],
      espacamento: [1.1, 1.1],
      falhas: 0,
    },
    3,
  );

  assert.ok(r.ids.length > 0);
  const final = aplicarEmCopia(m, r.comandos);
  for (const obj of Object.values(final.props)) {
    const [ox, oy] = obj.position;
    const sobrePorta = Math.abs(ox - 6.75) < 0.7 && Math.abs(oy - 9) < 0.9;
    assert.equal(sobrePorta, false, `caixote caiu perto demais da porta: [${ox}, ${oy}]`);
  }
});

test('mesma semente dá o mesmo resultado e sementes diferentes variam', () => {
  const m = criarMapa({ largura: 30, altura: 30 });
  const pedido = {
    padrao: 'aglomerado' as const,
    area: { disco: [15, 15] as [number, number], raio: 6 },
    itens: [{ item: 'tenda' }, { item: 'fogueira', peso: 0.4 }],
    espacamento: [2.2, 2.2] as [number, number],
  };

  let seq1 = 0;
  const a1 = arranjar(m, pedido, 55, p => `${p}${++seq1}`);
  let seq2 = 0;
  const a2 = arranjar(m, pedido, 55, p => `${p}${++seq2}`);
  assert.deepEqual(a1.comandos, a2.comandos);

  let seq3 = 0;
  const b = arranjar(m, pedido, 56, p => `${p}${++seq3}`);
  assert.notDeepEqual(a1.comandos, b.comandos);
});

test('item inexistente dá ErroDeConstrucao com parecidos', () => {
  const m = criarMapa({ largura: 30, altura: 30 });
  assert.throws(
    () =>
      arranjar(
        m,
        {
          padrao: 'circulo',
          area: { disco: [15, 15], raio: 5 },
          itens: [{ item: 'caixote-inexistente' }],
          espacamento: [1.5, 1.5],
        },
        1,
      ),
    (err: unknown) => err instanceof ErroDeConstrucao && /parecidos:/.test(err.message) && /caixote/.test(err.message),
  );
});

test('demais padrões (grade-solta, ao-longo, circulo, bordas) funcionam e respeitam regras', () => {
  const m = criarMapa({ largura: 45, altura: 45 });

  const alongo = arranjar(
    m,
    {
      padrao: 'ao-longo',
      area: { faixa: [[5, 20], [35, 20]], largura: 4 },
      itens: [{ item: 'poste.luz' }],
      espacamento: [6, 2.5],
      falhas: 0,
    },
    1,
  );
  assert.ok(alongo.ids.length >= 8);

  const circ = arranjar(
    m,
    {
      padrao: 'circulo',
      area: { disco: [20, 20], raio: 6 },
      itens: [{ item: 'cadeira' }],
      espacamento: [1.5, 2],
      falhas: 0,
    },
    2,
  );
  assert.ok(circ.ids.length >= 10);

  const bordas = arranjar(
    m,
    {
      padrao: 'bordas',
      area: { retangulo: [4, 4, 14, 14] },
      itens: [{ item: 'barril' }],
      espacamento: [1.6, 1.6],
      falhas: 0,
    },
    3,
  );
  assert.ok(bordas.ids.length >= 12);

  const solta = arranjar(
    m,
    {
      padrao: 'grade-solta',
      area: { retangulo: [25, 25, 35, 35] },
      itens: [{ item: 'pedra.pequena' }],
      espacamento: [2, 2],
    },
    4,
  );
  assert.ok(solta.ids.length >= 12);
});

test('cemitério com 3 receitas variadas e quadras não dispara fileiras-mecanicas em revisarMapa', () => {
  const m = criarMapa({ largura: 45, altura: 45 });
  const r = arranjar(
    m,
    {
      padrao: 'fileiras',
      area: { retangulo: [5, 5, 22, 16] },
      itens: [
        { item: 'lapide', peso: 3, escala: [0.9, 1.1] },
        { item: 'cruz.pedra', peso: 2, escala: [0.9, 1.15] },
        { item: 'tumulo', peso: 1, escala: [0.95, 1.1] },
      ],
      espacamento: [1.8, 2.2],
      grupos: { tamanho: [4, 2], vazio: 1.8 },
    },
    19,
  );

  assert.ok(r.ids.length >= 20, `esperava cemitério povoado, veio ${r.ids.length}`);
  const final = aplicarEmCopia(m, r.comandos);
  const mecanicas = revisarMapa(final).filter(a => a.regra === 'fileiras-mecanicas');
  assert.deepEqual(mecanicas, []);
});
