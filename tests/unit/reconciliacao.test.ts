import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarReconciliador, LIMIAR_SNAPSHOT } from '../../src/app/reconciliacao.ts';
import { novaLuz, novoObjeto } from '../../src/domain/fabrica.ts';
import { criarMapa, type MapaAtlas, type Parede } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ErroDeComando, type Comando } from '../../src/state/comandos.ts';

function contadorIds(prefixo = 'op') {
  let n = 0;
  return () => `${prefixo}-${++n}`;
}

function paredeLivre(id: string, x0 = 2, y0 = 2, x1 = 8, y1 = 2): Omit<Parede, 'source'> {
  return {
    id,
    path: [[x0, y0], [x1, y1]],
    height: 2.6,
    thickness: 0.2,
    material: 'parede.topo',
    kind: 'wall',
    blocks: { move: true, sight: true, light: true },
    drop: null,
  };
}

test('criarReconciliador: aplica opsIniciais em ordem crescente de rev e tolera ErroDeComando', () => {
  const mapaBase = criarMapa({ id: 'rec-1', nome: 'Mapa Inicial', agora: 1 });
  const luz1 = novaLuz([3, 3], { id: 'l-init' });

  const rec = criarReconciliador(mapaBase, 4, [
    // Rev <= revInicial deve ser ignorada
    { rev: 4, opId: 'antiga', comandos: [{ tipo: 'mapa.renomear', nome: 'Não Deve Aplicar' }] },
    // Fora de ordem propositalmente (rev 6 antes da rev 5)
    {
      rev: 6,
      opId: 'op-6',
      comandos: [
        { tipo: 'item.remover', colecao: 'props', id: 'nao-existe' },
        { tipo: 'item.adicionar', colecao: 'lights', item: luz1 },
      ],
    },
    { rev: 5, opId: 'op-5', comandos: [{ tipo: 'mapa.renomear', nome: 'Nome na Rev 5' }] },
  ]);

  assert.equal(rec.baseRev, 6);
  assert.equal(rec.ultimaRevSnapshot, 4);
  assert.equal(rec.pendentes.length, 0);
  assert.equal(rec.mapaConfirmado.name, 'Nome na Rev 5');
  assert.ok(rec.mapaConfirmado.lights['l-init']);
  assert.equal(rec.mapaVisivel, rec.mapaConfirmado);
});

test('aoEditarLocal: gera opId injetado, enfileira pendentes e devolve mensagem sem alterar mapaConfirmado', () => {
  const base = criarMapa({ id: 'rec-2', nome: 'Taverna', agora: 1 });
  const rec = criarReconciliador(base, 10, [], { gerarOpId: contadorIds('local') });

  assert.throws(
    () => rec.aoEditarLocal([]),
    (e: unknown) => e instanceof ErroDeComando,
  );

  const edit1 = rec.aoEditarLocal([{ tipo: 'mapa.renomear', nome: 'Taverna Otimista' }], 'Renomear');
  assert.deepEqual(edit1.mensagem, {
    tipo: 'construcao.comando',
    baseRev: 10,
    opId: 'local-1',
    comandos: [{ tipo: 'mapa.renomear', nome: 'Taverna Otimista' }],
    rotulo: 'Renomear',
  });
  assert.equal(edit1.mapaVisivel.name, 'Taverna Otimista');
  assert.equal(rec.mapaConfirmado.name, 'Taverna');
  assert.equal(rec.baseRev, 10);
  assert.equal(rec.pendentes.length, 1);

  const edit2 = rec.aoEditarLocal([{ tipo: 'mapa.notas', texto: 'Rascunho' }]);
  assert.equal('rotulo' in edit2.mensagem, false);
  assert.equal(edit2.mensagem.opId, 'local-2');
  assert.equal(edit2.mensagem.baseRev, 10);
  assert.equal(rec.mapaVisivel.notes, 'Rascunho');
  assert.equal(rec.pendentes.length, 2);
});

test('aoReceberAplicada: ignora duplicata antiga e pede ressincronização em lacuna de rev', () => {
  const base = criarMapa({ id: 'rec-3', nome: 'Base', agora: 1 });
  const rec = criarReconciliador(base, 2);

  // Duplicata (rev <= baseRev)
  const dup = rec.aoReceberAplicada({
    rev: 2,
    opId: 'op-dup',
    comandos: [{ tipo: 'mapa.renomear', nome: 'Velho' }],
  });
  assert.equal(dup.ignorada, true);
  assert.equal(dup.aplicada, false);
  assert.equal(dup.precisaRessincronizar, false);
  assert.equal(rec.mapaConfirmado.name, 'Base');

  // Lacuna (rev 4 quando baseRev é 2)
  const lacuna = rec.aoReceberAplicada({
    rev: 4,
    opId: 'op-4',
    comandos: [{ tipo: 'mapa.renomear', nome: 'Saltado' }],
  });
  assert.equal(lacuna.precisaRessincronizar, true);
  assert.equal(lacuna.aplicada, false);
  assert.equal(rec.baseRev, 2);
  assert.equal(rec.mapaConfirmado.name, 'Base');
});

test('dois clientes paralelos editando terreno, cômodo, objetos e paredes em conflito convergem exatamente para o mesmo MapaAtlas', () => {
  // Estado inicial compartilhado com uma parede livre `w1` e um objeto `o1`
  const m0Base = criarMapa({ id: 'conv-1', nome: 'Pátio', agora: 1, largura: 30, altura: 20 });
  const objExistente = novoObjeto([4, 4], { id: 'o-compartilhado' });
  const initRec = criarReconciliador(m0Base, 0, [
    { rev: 1, opId: 'init-1', comandos: [{ tipo: 'parede.adicionar', parede: paredeLivre('w-conflito', 10, 2, 16, 2) }] },
    { rev: 2, opId: 'init-2', comandos: [{ tipo: 'item.adicionar', colecao: 'props', item: objExistente }] },
  ]);
  const mapaInicial = initRec.mapaConfirmado;

  const clienteA = criarReconciliador(mapaInicial, 2, [], { gerarOpId: contadorIds('cliA') });
  const clienteB = criarReconciliador(mapaInicial, 2, [], { gerarOpId: contadorIds('cliB') });

  // Cliente A em paralelo:
  // 1) Pinta terreno de grama + cria um cômodo com telhado
  const opA1 = clienteA.aoEditarLocal(
    [
      { tipo: 'terreno.pintar', material: 'grama', celulas: [[1, 1], [1, 2], [2, 1], [2, 2]] },
      {
        tipo: 'comodo.criar',
        id: 'sala-a',
        nome: 'Guarita',
        funcao: 'sala',
        piso: { material: 'tabuas.carvalho', seed: 7 },
        papel: { material: 'papel.damasco-vinho', seed: 3 },
        telhado: 'telha.barro',
        celulas: [[4, 4], [5, 4], [4, 5], [5, 5]],
      },
    ],
    'Terreno e guarita',
  );
  // 2) Tenta colocar uma porta na parede `w-conflito` (que B vai remover!)
  const opA2 = clienteA.aoEditarLocal(
    [
      {
        tipo: 'abertura.adicionar',
        abertura: {
          id: 'porta-conflito',
          wallId: 'w-conflito',
          at: 0.5,
          width: 0.9,
          kind: 'door',
          state: 'closed',
          material: 'madeira.media',
          som: null,
          swing: 'a',
        },
      },
    ],
    'Pôr porta na parede',
  );
  // 3) Move `o-compartilhado` (que B também vai editar em conflito diferente)
  const opA3 = clienteA.aoEditarLocal(
    [{ tipo: 'item.atualizar', colecao: 'props', id: 'o-compartilhado', patch: { position: [5, 5] } }],
    'Mover caixa',
  );

  // Cliente B em paralelo:
  // 1) Pinta terra sobrepondo parcialmente [2, 2] e coloca um objeto novo
  const objB = novoObjeto([8, 8], { id: 'o-de-b' });
  const opB1 = clienteB.aoEditarLocal(
    [
      { tipo: 'terreno.pintar', material: 'terra', celulas: [[2, 2], [2, 3], [3, 2]] },
      { tipo: 'item.adicionar', colecao: 'props', item: objB },
    ],
    'Terra e caixa B',
  );
  // 2) Remove a parede `w-conflito` e remove `o-compartilhado` (conflitando com opA2 e opA3!)
  const opB2 = clienteB.aoEditarLocal(
    [
      { tipo: 'parede.remover', id: 'w-conflito' },
      { tipo: 'item.remover', colecao: 'props', id: 'o-compartilhado' },
    ],
    'Demolir parede e limpar caixa',
  );

  // Ordem canônica atribuída pelo servidor (intercalada): B1 (3), A1 (4), B2 (5), A2 (6), A3 (7)
  const sequenciaServidor = [
    { rev: 3, opId: opB1.mensagem.opId, comandos: opB1.mensagem.comandos, rotulo: opB1.mensagem.rotulo },
    { rev: 4, opId: opA1.mensagem.opId, comandos: opA1.mensagem.comandos, rotulo: opA1.mensagem.rotulo },
    { rev: 5, opId: opB2.mensagem.opId, comandos: opB2.mensagem.comandos, rotulo: opB2.mensagem.rotulo },
    { rev: 6, opId: opA2.mensagem.opId, comandos: opA2.mensagem.comandos, rotulo: opA2.mensagem.rotulo },
    { rev: 7, opId: opA3.mensagem.opId, comandos: opA3.mensagem.comandos, rotulo: opA3.mensagem.rotulo },
  ];

  // Cliente A recebe rev 3..7
  const resA3 = clienteA.aoReceberAplicada(sequenciaServidor[0]!);
  assert.equal(resA3.eraLocal, false);
  // opA1, opA2, opA3 ainda são válidas depois de B1
  assert.equal(clienteA.pendentes.length, 3);

  const resA4 = clienteA.aoReceberAplicada(sequenciaServidor[1]!);
  assert.equal(resA4.eraLocal, true);
  assert.equal(clienteA.pendentes.length, 2);

  // Ao chegar B2 (rev 5, que apagou w-conflito e o-compartilhado), opA2 e opA3 ficam impossíveis e devem ser descartadas!
  const resA5 = clienteA.aoReceberAplicada(sequenciaServidor[2]!);
  assert.equal(resA5.descartadas.length, 2);
  assert.deepEqual(resA5.descartadas.map(d => d.opId), ['cliA-2', 'cliA-3']);
  assert.equal(clienteA.pendentes.length, 0);

  clienteA.aoReceberAplicada(sequenciaServidor[3]!);
  clienteA.aoReceberAplicada(sequenciaServidor[4]!);

  // Cliente B recebe rev 3..7
  for (const op of sequenciaServidor) {
    clienteB.aoReceberAplicada(op);
  }

  assert.equal(clienteA.baseRev, 7);
  assert.equal(clienteB.baseRev, 7);
  assert.equal(clienteA.pendentes.length, 0);
  assert.equal(clienteB.pendentes.length, 0);

  // Convergência exata bit a bit + mapa válido
  validarMapa(clienteA.mapaConfirmado);
  validarMapa(clienteB.mapaConfirmado);
  assert.equal(JSON.stringify(clienteA.mapaConfirmado), JSON.stringify(clienteB.mapaConfirmado));
  assert.equal(JSON.stringify(clienteA.mapaVisivel), JSON.stringify(clienteB.mapaVisivel));
  assert.ok(clienteA.mapaConfirmado.rooms['sala-a']);
  assert.ok(clienteA.mapaConfirmado.props['o-de-b']);
  assert.equal(clienteA.mapaConfirmado.walls['w-conflito'], undefined);
  assert.equal(clienteA.mapaConfirmado.openings['porta-conflito'], undefined);
  assert.equal(clienteA.mapaConfirmado.props['o-compartilhado'], undefined);
});

test('op multi-comando com erro parcial é tolerada por comando em aoReceberAplicada para convergência idêntica', () => {
  const m0 = criarMapa({ id: 'conv-parcial', nome: 'Base', agora: 1 });
  const recA = criarReconciliador(m0, 0);
  const recB = criarReconciliador(m0, 0);

  const objOk = novoObjeto([6, 6], { id: 'obj-ok' });
  const comandosMisto: Comando[] = [
    { tipo: 'item.remover', colecao: 'props', id: 'fantasma' }, // lança ErroDeComando
    { tipo: 'item.adicionar', colecao: 'props', item: objOk },   // deve continuar sendo aplicado
  ];

  recA.aoReceberAplicada({ rev: 1, opId: 'misto-1', comandos: comandosMisto });
  recB.aoReceberAplicada({ rev: 1, opId: 'misto-1', comandos: comandosMisto });

  assert.ok(recA.mapaConfirmado.props['obj-ok']);
  assert.equal(JSON.stringify(recA.mapaConfirmado), JSON.stringify(recB.mapaConfirmado));
});

test('compactação por snapshot dispara ao atingir LIMIAR_SNAPSHOT (40 ops) com mapaConfirmado e respeita marcarSnapshotEnviado', () => {
  const m0 = criarMapa({ id: 'snap-1', nome: 'Inicial', agora: 1 });
  const rec = criarReconciliador(m0, 10, [], { gerarOpId: contadorIds('s') });

  // Cria uma edição pendente local que NÃO deve vazar para o snapshot de mapaConfirmado
  rec.aoEditarLocal([{ tipo: 'mapa.notas', texto: 'Pendente local não confirmado' }]);

  let ultimoSugerido: { rev: number; mapa: MapaAtlas } | undefined;
  for (let i = 1; i <= LIMIAR_SNAPSHOT - 1; i++) {
    const rev = 10 + i;
    const res = rec.aoReceberAplicada({
      rev,
      opId: `remota-${i}`,
      comandos: [{ tipo: 'mapa.renomear', nome: `Nome ${rev}` }],
    });
    assert.equal(res.snapshotSugerido, undefined, `não deve sugerir snapshot na rev ${rev}`);
    ultimoSugerido = res.snapshotSugerido;
  }
  assert.equal(ultimoSugerido, undefined);

  // Na 40ª operação (rev 50, pois 50 - 10 === 40), sugere snapshot com mapaConfirmado
  const res40 = rec.aoReceberAplicada({
    rev: 50,
    opId: 'remota-40',
    comandos: [{ tipo: 'mapa.renomear', nome: 'Nome 50' }],
  });
  assert.ok(res40.snapshotSugerido);
  assert.equal(res40.snapshotSugerido.rev, 50);
  assert.equal(res40.snapshotSugerido.mapa.name, 'Nome 50');
  assert.equal(res40.snapshotSugerido.mapa.notes, '', 'snapshot usa mapaConfirmado, sem pendentes locais');
  assert.equal(rec.mapaVisivel.notes, 'Pendente local não confirmado');

  // Marca como enviado e verifica que só volta a sugerir após mais 40 ops (rev 90)
  rec.marcarSnapshotEnviado(50);
  assert.equal(rec.ultimaRevSnapshot, 50);

  for (let rev = 51; rev < 90; rev++) {
    const res = rec.aoReceberAplicada({
      rev,
      opId: `remota-${rev}`,
      comandos: [{ tipo: 'mapa.renomear', nome: `Nome ${rev}` }],
    });
    assert.equal(res.snapshotSugerido, undefined);
  }

  const res90 = rec.aoReceberAplicada({
    rev: 90,
    opId: 'remota-90',
    comandos: [{ tipo: 'mapa.renomear', nome: 'Nome 90' }],
  });
  assert.ok(res90.snapshotSugerido);
  assert.equal(res90.snapshotSugerido.rev, 90);
});
