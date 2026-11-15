import test from 'node:test';
import assert from 'node:assert/strict';
import { construirEdificios } from '../../src/authoring/edificio-construir.ts';
import { aplicarEmCopia } from '../../src/authoring/construcao.ts';
import { revisarMapa } from '../../src/authoring/revisao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';

test('dois edifícios num mapa vazio entram acessíveis e mobiliados', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  const r = construirEdificios(
    m,
    [
      {
        nome: 'Casa Falk',
        origem: [3, 3],
        frente: 's',
        forma: 'L',
        alpendre: true,
        telhado: 'casa-de-telha',
        comodos: [
          { tipo: 'sala', area: 20, principal: true },
          { tipo: 'cozinha', area: 12 },
          { tipo: 'quarto', area: 10 },
        ],
      },
      {
        nome: 'Oficina de Ferro',
        origem: [18, 4],
        frente: 'o',
        forma: 'compacta',
        comodos: [
          { tipo: 'oficina', area: 18, principal: true },
          { tipo: 'deposito', area: 10 },
        ],
      },
    ],
    21,
  );

  assert.equal(r.descricoes.length, 2);
  assert.match(r.descricoes[0]!, /Casa Falk: 4 cômodos/);
  assert.match(r.descricoes[0]!, /entrada ao sul/);
  assert.match(r.descricoes[0]!, /telhado casa-de-telha/);
  assert.match(r.descricoes[1]!, /Oficina de Ferro: 2 cômodos/);

  const final = aplicarEmCopia(m, r.comandos);
  assert.equal(Object.keys(final.rooms).length, 6);
  assert.ok(Object.keys(final.openings).length >= 4);
  assert.ok(Object.keys(final.props).length >= 6);
  assert.ok(Object.keys(final.lights).length >= 2);

  const achados = revisarMapa(final).filter(a => a.regra === 'comodo-sem-acesso' || a.regra === 'interior-vazio');
  assert.deepEqual(achados, []);
});

test('um edifício que colide falha com motivo e o outro entra em uma única transação', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  const store = criarStore(m);
  let gerado: ReturnType<typeof construirEdificios> | null = null;

  store.transacao('IA: 2 edifício(s)', g => {
    gerado = construirEdificios(
      m,
      [
        {
          nome: 'Casa Boa',
          origem: [3, 3],
          frente: 'n',
          forma: 'compacta',
          comodos: [
            { tipo: 'sala', area: 16, principal: true },
            { tipo: 'quarto', area: 10 },
          ],
        },
        {
          nome: 'Casa Apertada',
          origem: [3, 3],
          lote: [3, 3],
          frente: 's',
          comodos: [
            { tipo: 'sala', area: 20, principal: true },
            { tipo: 'cozinha', area: 16 },
          ],
        },
      ],
      7,
    );
    for (const c of gerado.comandos) g.aplicar(c);
  });

  assert.equal(gerado!.descricoes.length, 2);
  assert.match(gerado!.descricoes[0]!, /Casa Boa: 2 cômodos/);
  assert.match(gerado!.descricoes[1]!, /Casa Apertada \(erro\):/);
  assert.equal(Object.keys(store.documento.rooms).length, 2);
  assert.equal(store.rotuloDesfazer, 'IA: 2 edifício(s)');

  store.desfazer();
  assert.equal(Object.keys(store.documento.rooms).length, 0);
});
