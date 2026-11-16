import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { tracosDeContatoExterno } from '../../src/render/contato-externo.ts';

test('tracosDeContatoExterno desenha só o lado livre de paredes derivadas e pula portas abertas', () => {
  const store = criarStore(criarMapa({ largura: 24, altura: 18 }));
  store.executar({
    tipo: 'comodo.criar',
    id: 'sala',
    nome: 'Sala',
    funcao: 'sala',
    celulas: [[2, 2], [3, 2], [2, 3], [3, 3]],
    piso: { material: 'tabuas.carvalho', seed: 1 },
    papel: null,
    telhado: null,
    levelId: null,
  });
  store.executar({
    tipo: 'comodo.criar',
    id: 'cozinha',
    nome: 'Cozinha',
    funcao: 'cozinha',
    celulas: [[4, 2], [4, 3]],
    piso: { material: 'pedra.laje', seed: 2 },
    papel: null,
    telhado: null,
    levelId: null,
  });

  // 3x2 células totais (4,5 m x 3 m, em [3..7,5] x [3..6]): parede compartilhada em x=6 não deve gerar traço.
  const semAbertura = tracosDeContatoExterno(store.documento);
  assert.ok(semAbertura.length >= 4, 'esperava ao menos os lados externos');
  for (const t of semAbertura) {
    assert.ok(
      !(Math.abs(t.de[0] - t.para[0]) < 1e-3 && t.de[0] > 5.5 && t.de[0] < 6.5),
      `parede interna em x=6 não deve ter sombra externa (${JSON.stringify(t)})`,
    );
  }
  const sul = semAbertura.find(t => Math.abs(t.de[1] - t.para[1]) < 1e-3 && t.de[1] > 6.1);
  assert.ok(sul, 'parede sul deslocada para fora (y = 6,2 m)');
  assert.ok(Math.abs(sul.de[1] - 6.2) < 1e-3);

  const pareSul = Object.values(store.documento.walls).find(w =>
    Math.abs(w.path[0]![1] - 6) < 0.05 && Math.abs(w.path[1]![1] - 6) < 0.05 && w.path[0]![0] < 5.5,
  )!;
  store.executar({
    tipo: 'abertura.adicionar',
    abertura: { id: 'p_fechada', kind: 'door', wallId: pareSul.id, at: 0.5, width: 1.5, state: 'closed', material: 'madeira.carvalho', swing: 'b', som: null },
  });
  const comFechada = tracosDeContatoExterno(store.documento).filter(t => Math.abs(t.de[1] - 6.2) < 1e-3);
  assert.ok(comFechada.every(t => t.de[0] < 3.5 || t.para[0] <= 7.6), 'porta fechada mantém traço único da sala');
  const trechosSalaComFechada = comFechada.filter(t => Math.min(t.de[0], t.para[0]) < 3.5);
  assert.equal(trechosSalaComFechada.length, 1, 'porta fechada não interrompe a sombra de contato');

  store.executar({
    tipo: 'abertura.atualizar',
    id: 'p_fechada',
    patch: { state: 'open' },
  });
  const trechosSalaComAberta = tracosDeContatoExterno(store.documento)
    .filter(t => Math.abs(t.de[1] - 6.2) < 1e-3 && Math.min(t.de[0], t.para[0]) < 5.9);
  assert.equal(trechosSalaComAberta.length, 2, 'porta aberta divide o traço em dois trechos, sem sombra no vão');
});
