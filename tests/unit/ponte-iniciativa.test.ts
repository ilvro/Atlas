import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signal } from '@preact/signals';
import { chaveDaRef, criarRef } from '#mesa';
import { novaPeca } from '../../src/domain/fabrica.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { recursosDaPeca, recursosDasFichas } from '../../src/app/fichas.ts';
import type { SessaoDeEdicao } from '../../src/app/sessao.ts';
import {
  CANAL_COMBATE,
  executarComandoDeIniciativa,
  montarEstadoDeIniciativa,
} from '../../src/app/ponte-iniciativa.ts';

function criarSessaoFake(mapa: MapaAtlas): SessaoDeEdicao {
  const store = criarStore(mapa, { salvo: true });
  const doc = signal(store.documento);
  store.assinar(() => { doc.value = store.documento; });
  return {
    store,
    doc,
    selecao: signal([]),
    andarAtivo: signal<string | null>(null),
  } as unknown as SessaoDeEdicao;
}

test('montarEstadoDeIniciativa: sem combate e com combate ativo, incluindo PV/PD e filtro de andar', () => {
  const refPj = criarRef('ficha', 'ficha', 'pj-1');
  const m = criarMapa({ id: 'mapa-1', nome: 'Casarão', agora: 1 });
  m.levels = { andar2: { id: 'andar2', name: '2º Andar', order: 1 } };

  const pj = novaPeca([2, 2], 'Arthur', { player: true, refs: [refPj] });
  const zumbi = novaPeca([5, 5], 'Zumbi 1', { player: false, hp: { pv: 14, pvMax: 20 } });
  const cima = novaPeca([3, 3], 'Fantasma', { player: false, levelId: 'andar2', hp: { pv: 30, pvMax: 30 } });
  m.tokens[pj.id] = pj;
  m.tokens[zumbi.id] = zumbi;
  m.tokens[cima.id] = cima;

  recursosDasFichas.value = {
    [chaveDaRef(refPj)]: { pv: 18, pvMax: 24, pd: 9, pdMax: 12 },
  };

  // Sem combate ativo no térreo
  const semCombate = montarEstadoDeIniciativa(m, null, t => recursosDaPeca(t));
  assert.equal(CANAL_COMBATE, 'atlas:combate');
  assert.equal(semCombate.tipo, 'iniciativa');
  assert.equal(semCombate.mapaId, 'mapa-1');
  assert.equal(semCombate.mapaNome, 'Casarão');
  assert.equal(semCombate.ativa, false);
  assert.equal(semCombate.rodada, 1);
  assert.equal(semCombate.atual, 0);
  assert.deepEqual(semCombate.ordem, []);
  assert.equal(semCombate.combatentes.length, 2, 'apenas peças do térreo');

  const cPj = semCombate.combatentes.find(c => c.tokenId === pj.id)!;
  assert.equal(cPj.nome, 'Arthur');
  assert.equal(cPj.jogador, true);
  assert.equal(cPj.pv, 18);
  assert.equal(cPj.pvMax, 24);
  assert.equal(cPj.pd, 9);
  assert.equal(cPj.pdMax, 12);

  const cZumbi = semCombate.combatentes.find(c => c.tokenId === zumbi.id)!;
  assert.equal(cZumbi.nome, 'Zumbi 1');
  assert.equal(cZumbi.jogador, false);
  assert.equal(cZumbi.pv, 14);
  assert.equal(cZumbi.pvMax, 20);

  // Com combate ativo (novo objeto imutável, como a store produz)
  const mComCombate: MapaAtlas = {
    ...m,
    session: {
      ...m.session,
      initiative: {
        order: [
          { tokenId: pj.id, value: 19 },
          { tokenId: zumbi.id, value: 11 },
        ],
        current: 1,
        round: 2,
      },
    },
  };
  const comCombate = montarEstadoDeIniciativa(mComCombate, null, t => recursosDaPeca(t));
  assert.equal(comCombate.ativa, true);
  assert.equal(comCombate.rodada, 2);
  assert.equal(comCombate.atual, 1);
  assert.deepEqual(comCombate.ordem, [
    { tokenId: pj.id, valor: 19 },
    { tokenId: zumbi.id, valor: 11 },
  ]);

  // Filtro de outro andar
  const andar2 = montarEstadoDeIniciativa(mComCombate, 'andar2', t => recursosDaPeca(t));
  assert.deepEqual(andar2.combatentes.map(c => c.tokenId), [cima.id]);
  assert.equal(andar2.ativa, false, 'iniciativa podada quando nenhum combatente está no 2º andar');
});

test('executarComandoDeIniciativa: iniciar, passo, definir-valor, ajustar-pv, focar-peca e encerrar', async () => {
  const refPj = criarRef('ficha', 'ficha', 'pj-2');
  const m = criarMapa({ id: 'mapa-2', nome: 'Cripta', agora: 1 });
  const pj = novaPeca([2, 2], 'Beatriz', { player: true, refs: [refPj] });
  const zumbi = novaPeca([6, 4], 'Zumbi 1', { player: false, hp: { pv: 20, pvMax: 20 } });
  m.tokens[pj.id] = pj;
  m.tokens[zumbi.id] = zumbi;

  recursosDasFichas.value = {
    [chaveDaRef(refPj)]: { pv: 15, pvMax: 20, pd: 8, pdMax: 10 },
  };

  const s = criarSessaoFake(m);
  const pedidos: { tipo: string; dados: unknown }[] = [];
  const barramento = {
    pedir: async (tipo: string, dados: unknown) => {
      pedidos.push({ tipo, dados });
      return { ok: true as const, resposta: { ok: true } };
    },
  };
  const focados: string[] = [];

  // 1. Iniciar combate (também ativa Jogadores livres + movimento em grid)
  const { controleJogadores, definirControleJogadores, definirMovimentoLivre, movimentoLivre } = await import('../../src/app/modo.ts');
  definirControleJogadores('mestre');
  definirMovimentoLivre(true);
  assert.equal(executarComandoDeIniciativa({ tipo: 'iniciar' }, { sessao: s, barramento }), true);
  assert.equal(controleJogadores.value, 'livres');
  assert.equal(movimentoLivre.value, false);
  assert.ok(s.store.documento.session.initiative);
  assert.equal(s.store.documento.session.initiative!.order.length, 2);
  assert.equal(s.store.documento.session.initiative!.round, 1);
  assert.equal(s.store.documento.session.initiative!.current, 0);

  // 2. Definir valores e reordenar
  assert.equal(
    executarComandoDeIniciativa({ tipo: 'definir-valor', tokenId: zumbi.id, valor: 18 }, { sessao: s }),
    true,
  );
  assert.equal(
    executarComandoDeIniciativa({ tipo: 'definir-valor', tokenId: pj.id, valor: 12 }, { sessao: s }),
    true,
  );
  assert.deepEqual(
    s.store.documento.session.initiative!.order,
    [
      { tokenId: zumbi.id, value: 18 },
      { tokenId: pj.id, value: 12 },
    ],
  );

  // 3. Passo +1 e +1 (avança para rodada 2) e -1 (volta para rodada 1)
  assert.equal(executarComandoDeIniciativa({ tipo: 'passo', direcao: 1 }, { sessao: s }), true);
  assert.equal(s.store.documento.session.initiative!.current, 1);
  assert.equal(s.store.documento.session.initiative!.round, 1);

  assert.equal(executarComandoDeIniciativa({ tipo: 'passo', direcao: 1 }, { sessao: s }), true);
  assert.equal(s.store.documento.session.initiative!.current, 0);
  assert.equal(s.store.documento.session.initiative!.round, 2);

  assert.equal(executarComandoDeIniciativa({ tipo: 'passo', direcao: -1 }, { sessao: s }), true);
  assert.equal(s.store.documento.session.initiative!.current, 1);
  assert.equal(s.store.documento.session.initiative!.round, 1);

  // 4. Ajustar PV em ameaça com hp local
  assert.equal(
    executarComandoDeIniciativa({ tipo: 'ajustar-pv', tokenId: zumbi.id, deltaPv: -6 }, { sessao: s, barramento }),
    true,
  );
  assert.deepEqual(s.store.documento.tokens[zumbi.id]!.hp, { pv: 14, pvMax: 20 });

  // 5. Ajustar PV/PD em PJ ligado à ficha
  assert.equal(
    executarComandoDeIniciativa(
      { tipo: 'ajustar-pv', tokenId: pj.id, deltaPv: -3, deltaPd: -2 },
      { sessao: s, barramento },
    ),
    true,
  );
  assert.deepEqual(recursosDasFichas.value[chaveDaRef(refPj)], { pv: 12, pvMax: 20, pd: 6, pdMax: 10 });
  assert.equal(pedidos.length, 1);
  assert.equal(pedidos[0]!.tipo, 'ficha.ajustar-recursos');

  // 6. Focar peça
  assert.equal(
    executarComandoDeIniciativa(
      { tipo: 'focar-peca', tokenId: pj.id },
      { sessao: s, focarPeca: id => focados.push(id) },
    ),
    true,
  );
  assert.deepEqual(s.selecao.value, [{ colecao: 'tokens', id: pj.id }]);
  assert.deepEqual(focados, [pj.id]);

  // 7. Encerrar combate
  assert.equal(executarComandoDeIniciativa({ tipo: 'encerrar' }, { sessao: s }), true);
  assert.equal(s.store.documento.session.initiative, null);
});

test('iniciativa: iniciar e passar a vez selecionam a peça do turno e a passam a seguir', async () => {
  const { jogadorSeguido } = await import('../../src/app/projetor.ts');
  const m = criarMapa({ id: 'mapa-foco', nome: 'Foco', agora: 1 });
  const a = novaPeca([2, 2], 'Ana', { player: true });
  const orc = novaPeca([6, 6], 'Orc', { player: false });
  m.tokens[a.id] = a;
  m.tokens[orc.id] = orc;
  const s = criarSessaoFake(m);
  jogadorSeguido.value = null;
  executarComandoDeIniciativa({ tipo: 'iniciar', entradas: [{ tokenId: a.id, valor: 20 }, { tokenId: orc.id, valor: 10 }] }, { sessao: s });
  assert.deepEqual(s.selecao.value, [{ colecao: 'tokens', id: a.id }]);
  assert.equal(jogadorSeguido.value, a.id);
  executarComandoDeIniciativa({ tipo: 'passo', direcao: 1 }, { sessao: s });
  assert.deepEqual(s.selecao.value, [{ colecao: 'tokens', id: orc.id }]);
  assert.equal(jogadorSeguido.value, orc.id, 'combatente que não é jogador também vira alvo');
  executarComandoDeIniciativa({ tipo: 'passo', direcao: -1 }, { sessao: s });
  assert.equal(jogadorSeguido.value, a.id);
  jogadorSeguido.value = null;
});
