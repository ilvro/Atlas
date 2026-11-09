import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  novoMomento,
  moverPasso,
  duplicarPasso,
  removerPasso,
  adicionarPasso,
  atualizarPasso,
  type Momento,
} from '../../src/domain/momentos.ts';
import { buscarAcoes, acaoPorId } from '../../src/app/acoes.ts';
import { sessao } from '../../src/app/app.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarSessao } from '../../src/app/sessao.ts';

test('moverPasso: move um passo e respeita os limites da lista', () => {
  const m: Momento = {
    id: 'm1',
    nome: 'Momento',
    cor: null,
    passos: [
      { tipo: 'esperar', ms: 1000 },
      { tipo: 'efeito', efeito: 'tremor' },
      { tipo: 'clima', clima: 'noite' },
    ],
  };

  // Move o passo 0 para a posição 2
  const m2 = moverPasso(m, 0, 2);
  assert.equal(m2.passos[0]?.tipo, 'efeito');
  assert.equal(m2.passos[1]?.tipo, 'clima');
  assert.equal(m2.passos[2]?.tipo, 'esperar');

  // Mover para fora dos limites faz clamp
  const m3 = moverPasso(m, 2, -10);
  assert.equal(m3.passos[0]?.tipo, 'clima');
  assert.equal(m3.passos[1]?.tipo, 'esperar');

  // Índice de origem inválido devolve o mesmo momento
  const m4 = moverPasso(m, 99, 1);
  assert.equal(m4, m);
});

test('duplicarPasso: clona o passo e insere logo a seguir', () => {
  const m: Momento = {
    id: 'm1',
    nome: 'Momento',
    cor: null,
    passos: [
      { tipo: 'esperar', ms: 1000 },
      { tipo: 'efeito', efeito: 'tremor' },
    ],
  };

  const m2 = duplicarPasso(m, 0);
  assert.equal(m2.passos.length, 3);
  assert.deepEqual(m2.passos[0], m2.passos[1]);
  assert.notEqual(m2.passos[0], m2.passos[1]); // cópia profunda
  assert.equal(m2.passos[2]?.tipo, 'efeito');

  // Índice inválido não muda
  assert.equal(duplicarPasso(m, -1), m);
  assert.equal(duplicarPasso(m, 5), m);
});

test('removerPasso: remove o passo do índice indicado', () => {
  const m: Momento = {
    id: 'm1',
    nome: 'Momento',
    cor: null,
    passos: [
      { tipo: 'esperar', ms: 1000 },
      { tipo: 'efeito', efeito: 'tremor' },
    ],
  };

  const m2 = removerPasso(m, 0);
  assert.equal(m2.passos.length, 1);
  assert.equal(m2.passos[0]?.tipo, 'efeito');

  // Índice inválido não muda
  assert.equal(removerPasso(m, -1), m);
});

test('adicionarPasso e atualizarPasso: inserem e substituem passos', () => {
  const m = novoMomento('m1', 'Momento');
  assert.equal(m.passos.length, 0);

  const m2 = adicionarPasso(m, { tipo: 'esperar', ms: 500 });
  assert.equal(m2.passos.length, 1);
  assert.equal(m2.passos[0]?.tipo, 'esperar');

  const m3 = adicionarPasso(m2, { tipo: 'efeito', efeito: 'relampago' }, 0);
  assert.equal(m3.passos.length, 2);
  assert.equal(m3.passos[0]?.tipo, 'efeito');
  assert.equal(m3.passos[1]?.tipo, 'esperar');

  const m4 = atualizarPasso(m3, 1, { tipo: 'clima', clima: 'chuva' });
  assert.equal(m4.passos[1]?.tipo, 'clima');
});

test('buscarAcoes e acaoPorId: listam momentos do mapa na paleta de comandos', () => {
  const mapa = criarMapa({ id: 'mapa-acoes-momento', nome: 'Mansão' });
  mapa.moments['m-susto'] = {
    id: 'm-susto',
    nome: 'Susto da Criatura',
    cor: '#ff0000',
    passos: [{ tipo: 'efeito', efeito: 'tremor' }],
  };
  mapa.moments['m-calmaria'] = {
    id: 'm-calmaria',
    nome: 'Calmaria',
    cor: null,
    passos: [{ tipo: 'clima', clima: 'dia' }],
  };

  const s = criarSessao(mapa, {
    async listar() { return []; },
    async obter() { return undefined; },
    async salvar() { return mapa; },
    async restaurar() {},
    async remover() {},
    async obterRascunho() { return undefined; },
    async salvarRascunho() {},
    async descartarRascunho() {},
    async listarRascunhos() { return []; },
    async salvarAsset() { return { id: '', hash: '' }; },
    async obterAsset() { return undefined; },
    async listarAssets() { return []; },
    async restaurarAsset() {},
    fechar() {},
  }, { salvo: true });

  const sessaoAnterior = sessao.value;
  sessao.value = s;

  try {
    const acoes = buscarAcoes('Susto');
    const acaoSusto = acoes.find(a => a.id === 'momento-m-susto');
    assert.ok(acaoSusto, 'deve encontrar a ação do momento de susto');
    assert.equal(acaoSusto.nome, 'Tocar momento: Susto da Criatura');
    assert.equal(acaoSusto.grupo, 'Momentos');

    const porId = acaoPorId('momento-m-calmaria');
    assert.ok(porId, 'deve resolver acaoPorId para momento');
    assert.equal(porId.nome, 'Tocar momento: Calmaria');
  } finally {
    sessao.value = sessaoAnterior;
    s.fechar();
  }
});
