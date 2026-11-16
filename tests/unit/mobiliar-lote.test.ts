import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ferramentasDeEscrita, type ContextoDeEscrita } from '../../src/app/ponte-escrita.ts';
import { aplicarEmCopia, comodos } from '../../src/authoring/construcao.ts';
import { formatarRelatorioDeMobilia, mobiliarLote } from '../../src/authoring/mobiliar-lote.ts';
import { pontoNoPoligono } from '../../src/domain/formas-de-comodo.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { criarStore } from '../../src/state/store.ts';

function geradorDeterministico() {
  let n = 0;
  return (prefixo: string) => `${prefixo}_${++n}`;
}

test('mobiliarLote: lote com sala e quarto gera objetos e luzes nos dois; mesma semente dá o mesmo resultado', () => {
  const base = criarMapa({ id: 'm1', nome: 'Casa Falk', agora: 1, largura: 30, altura: 20 });
  const c = comodos(base, [
    { rets: [[2, 2, 6, 5]], tipo: 'sala', nome: 'Casa Falk · sala' },
    { rets: [[6, 2, 10, 5]], tipo: 'quarto', nome: 'Casa Falk · quarto' },
  ], 10, geradorDeterministico());
  const mapa = aplicarEmCopia(base, c.comandos);

  const r1 = mobiliarLote(mapa, { comodos: c.ids, semente: 42, gerarId: geradorDeterministico() });
  const r2 = mobiliarLote(mapa, { comodos: c.ids, semente: 42, gerarId: geradorDeterministico() });
  assert.deepEqual(r1, r2);
  assert.equal(r1.relatorio.length, 2);
  assert.ok(r1.relatorio[0]!.objetos >= 2, 'esperava objetos na sala');
  assert.ok(r1.relatorio[0]!.luzes >= 1, 'esperava luz na sala');
  assert.equal(r1.relatorio[0]!.motivo, undefined);
  assert.ok(r1.relatorio[1]!.objetos >= 2, 'esperava objetos no quarto');
  assert.ok(r1.relatorio[1]!.luzes >= 1, 'esperava luz no quarto');
  assert.equal(r1.relatorio[1]!.motivo, undefined);

  const texto = formatarRelatorioDeMobilia(r1.relatorio);
  assert.match(texto, /Casa Falk · sala: \d+ objetos, \d+ luz/);
  assert.match(texto, /Casa Falk · quarto: \d+ objetos, \d+ luz/);

  const final = aplicarEmCopia(mapa, r1.comandos);
  validarMapa(final);
});

test('mobiliarLote: id inexistente, cômodo pequeno demais e função sem regras viram motivo sem derrubar o lote', () => {
  const base = criarMapa({ id: 'm2', nome: 'Teste', agora: 1, largura: 30, altura: 20 });
  const c = comodos(base, [
    { rets: [[2, 2, 3, 3]], tipo: 'enfermaria', nome: 'Cubículo' },
    { rets: [[5, 2, 9, 5]], tipo: 'sala', nome: 'Sala sem função' },
    { rets: [[10, 2, 14, 5]], tipo: 'quarto', nome: 'Quarto bom' },
  ], 1, geradorDeterministico());
  let mapa = aplicarEmCopia(base, c.comandos);
  const idPequeno = c.ids[0]!;
  const idSemRegras = c.ids[1]!;
  const idBom = c.ids[2]!;
  mapa = {
    ...mapa,
    rooms: {
      ...mapa.rooms,
      [idSemRegras]: { ...mapa.rooms[idSemRegras]!, function: 'funcao-inexistente' },
    },
  };

  const r = mobiliarLote(mapa, {
    comodos: ['c_fantasma', idPequeno, idSemRegras, idBom],
    luzes: false,
    semente: 7,
    gerarId: geradorDeterministico(),
  });
  assert.equal(r.relatorio.length, 4);
  assert.equal(r.relatorio[0]!.motivo, 'cômodo não existe');
  assert.equal(r.relatorio[1]!.motivo, 'cômodo pequeno demais');
  assert.equal(r.relatorio[2]!.motivo, 'função sem regras de mobília');
  assert.equal(r.relatorio[3]!.motivo, undefined);
  assert.ok(r.relatorio[3]!.objetos >= 2);
  assert.equal(r.relatorio[3]!.luzes, 0);
});

test('atlas_mobiliar: mobília 40 cômodos de "Lysdal · a vila (neve)" numa chamada (com luzes: false) e Ctrl+Z desfaz tudo de uma vez', async () => {
  const inicial = criarMapa({ id: 'lysdal', nome: 'Lysdal · a vila (neve)', agora: 1, largura: 120, altura: 90 });
  inicial.style.genre = 'fantasia';
  const store = criarStore(inicial);
  const ctx: ContextoDeEscrita = {
    store: () => store,
    repo: () => null,
    abrirMapa: async () => {},
  };
  const f = Object.fromEntries(ferramentasDeEscrita(ctx).map(x => [x.nome, x]));

  const tipos = ['sala', 'quarto', 'cozinha', 'taverna', 'capela', 'forja', 'porao', 'biblioteca'];
  const pedidos = Array.from({ length: 40 }, (_, i) => {
    const col = i % 8, lin = Math.floor(i / 8);
    const x0 = 2 + col * 9, y0 = 2 + lin * 8;
    const tipo = tipos[i % tipos.length]!;
    return { rets: [[x0, y0, x0 + 4, y0 + 3]], tipo, nome: `Casa ${i + 1} · ${tipo}` };
  });
  await f.atlas_comodos!.executar({ comodos: pedidos, semente: 1 });
  const antesDeMobiliar = store.documento;
  const idsDosComodos = Object.keys(antesDeMobiliar.rooms);
  assert.equal(idsDosComodos.length, 40);

  const histAntes = store.historico.length;
  const res = (await f.atlas_mobiliar!.executar({ comodos: idsDosComodos, luzes: false, semente: 11 }))[0]!;
  assert.equal(res.tipo, 'texto');
  assert.match(res.texto, /mobiliar 40 cômodo\(s\)/);
  assert.match(res.texto, /Casa 1 · sala: \d+ objetos, 0 luzes/);
  assert.equal(store.historico.length, histAntes + 1);
  assert.equal(Object.keys(store.documento.lights).length, 0);
  assert.ok(Object.keys(store.documento.props).length >= 80, `esperava >= 80 objetos nos 40 cômodos, vieram ${Object.keys(store.documento.props).length}`);
  validarMapa(store.documento);

  store.desfazer();
  assert.deepEqual(store.documento, antesDeMobiliar);
  assert.equal(Object.keys(store.documento.props).length, 0);
});

test('mobiliarLote em torre circular e sala em polígono rotacionado mantém móveis dentro do contorno', () => {
  const base = criarMapa({ id: 'm3', nome: 'Torre e Casa', agora: 1, largura: 40, altura: 30 });
  const ang = Math.PI / 6;
  const c = Math.cos(ang), s = Math.sin(ang);
  const rot = (lx: number, ly: number): [number, number] => [24 + lx * c - ly * s, 14 + lx * s + ly * c];
  const polyRot = [rot(-3, -2.25), rot(3, -2.25), rot(3, 2.25), rot(-3, 2.25)];
  const cmd = comodos(base, [
    { circulo: { centro: [10, 10], raio: 4, lados: 24 }, tipo: 'sala', nome: 'Torre redonda' },
    { poligono: polyRot, tipo: 'sala', nome: 'Sala inclinada' },
  ], 10, geradorDeterministico());
  const mapa = aplicarEmCopia(base, cmd.comandos);
  const res = mobiliarLote(mapa, { comodos: cmd.ids, semente: 7, gerarId: geradorDeterministico() });
  assert.equal(res.relatorio.length, 2);
  assert.ok(res.relatorio[0]!.objetos >= 2, `esperava >= 2 objetos na torre circular, veio ${res.relatorio[0]!.objetos}`);
  assert.ok(res.relatorio[1]!.objetos >= 2, `esperava >= 2 objetos na sala inclinada, veio ${res.relatorio[1]!.objetos}`);

  const final = aplicarEmCopia(mapa, res.comandos);
  validarMapa(final);
  for (const o of Object.values(final.props)) {
    const out = final.rooms[o.roomId!]!.outline!;
    if (o.elevation === 'wall') {
      assert.ok(o.wall?.wallId && final.walls[o.wall.wallId], `objeto de parede ${o.id} sem parede válida`);
    } else {
      assert.ok(pontoNoPoligono(o.position, out), `objeto ${o.id} fora do contorno`);
    }
  }
  for (const l of Object.values(final.lights)) {
    const dentro = Object.values(final.rooms).some(r => r.outline && pontoNoPoligono(l.position, r.outline));
    assert.ok(dentro, `luz ${l.id} fora do contorno`);
  }
});
