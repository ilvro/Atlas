import test from 'node:test';
import assert from 'node:assert/strict';
import { construirEdificios } from '../../src/authoring/edificio-construir.ts';
import { aplicarEmCopia } from '../../src/authoring/construcao.ts';
import { revisarMapa } from '../../src/authoring/revisao.ts';
import { pontoNoPoligono } from '../../src/domain/formas-de-comodo.ts';
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

test('edifício com rotacao produz cômodos outline oblíquos com paredes, aberturas, telhado e mobília alinhados', () => {
  const m = criarMapa({ largura: 60, altura: 60 });
  const r = construirEdificios(
    m,
    [
      {
        nome: 'Casarão Oblíquo',
        origem: [6, 6],
        frente: 's',
        forma: 'L',
        alpendre: true,
        rotacao: 0.3,
        telhado: 'casa-de-telha',
        comodos: [
          { tipo: 'sala', area: 20, principal: true },
          { tipo: 'cozinha', area: 12 },
          { tipo: 'quarto', area: 10 },
        ],
      },
    ],
    42,
  );

  assert.equal(r.descricoes.length, 1);
  assert.doesNotMatch(r.descricoes[0]!, /\(erro\)/);

  const final = aplicarEmCopia(m, r.comandos);
  const salas = Object.values(final.rooms);
  assert.equal(salas.length, 4);
  for (const s of salas) {
    assert.ok(s.outline && s.outline.length >= 4, `sala ${s.name} sem outline`);
    // Nenhuma aresta permanece puramente horizontal ou vertical após rotacao = 0.3 rad
    const p0 = s.outline[0]!, p1 = s.outline[1]!;
    assert.ok(Math.abs(p1[0] - p0[0]) > 0.05 && Math.abs(p1[1] - p0[1]) > 0.05);
  }
  assert.ok(Object.keys(final.openings).length >= 3);
  assert.ok(Object.keys(final.props).length >= 4);
  assert.ok(Object.keys(final.lights).length >= 1);

  for (const prop of Object.values(final.props)) {
    if (!prop.roomId) continue;
    if (prop.wall) {
      assert.ok(final.walls[prop.wall.wallId], `wallId ${prop.wall.wallId} ausente`);
      continue;
    }
    const outline = final.rooms[prop.roomId]!.outline!;
    assert.ok(pontoNoPoligono(prop.position, outline), `prop ${prop.id} fora do outline rotacionado`);
  }

  const achados = revisarMapa(final).filter(a => a.regra === 'comodo-sem-acesso' || a.regra === 'interior-vazio' || a.regra === 'edificio-sem-telhado');
  assert.deepEqual(achados, []);
});
