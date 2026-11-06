import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mocks para ambiente Node
const storageMock: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = new Proxy(storageMock, {
    get(target, prop: string) {
      if (prop === 'getItem') return (k: string) => target[k] ?? null;
      if (prop === 'setItem') return (k: string, v: string) => { target[k] = String(v); };
      if (prop === 'removeItem') return (k: string) => { delete target[k]; };
      if (prop === 'clear') return () => { for (const k in target) delete target[k]; };
      return target[prop];
    },
    set(target, prop: string, value: string) {
      target[prop] = String(value);
      return true;
    },
  });
}
if (typeof globalThis.location === 'undefined') {
  globalThis.location = { hash: '', pathname: '/', href: 'http://localhost/' } as any;
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    open: () => null,
  } as any;
}

import {
  modo,
  FERRAMENTAS_DA_SESSAO,
  regraDaRegua,
  definirRegraDaRegua,
  vistaDeJogador,
  vistaAtual,
} from '../../src/app/modo.ts';
import { ROTULO_DA_REGRA, type RegraDeDiagonal } from '../../src/domain/regua.ts';
import { acaoPorId, executarAcao } from '../../src/app/acoes.ts';
import { secoesAbertasNoDock, abrirSecaoNoDock, alternarSecaoNoDock } from '../../src/app/dock.ts';

test('regras da régua e alternância de diagonais', () => {
  assert.equal(ROTULO_DA_REGRA.simples, 'Simples (todas valem 1)');
  assert.equal(ROTULO_DA_REGRA.alternada, '5-10-5 (Alternada)');
  assert.equal(ROTULO_DA_REGRA.euclidiana, 'Euclidiana (linha reta)');

  definirRegraDaRegua('alternada');
  assert.equal(regraDaRegua.value, 'alternada');

  definirRegraDaRegua('euclidiana');
  assert.equal(regraDaRegua.value, 'euclidiana');

  definirRegraDaRegua('simples');
  assert.equal(regraDaRegua.value, 'simples');
});

test('alternar vista de jogador na barra inferior', () => {
  vistaDeJogador.value = false;
  modo.value = 'sessao';
  assert.equal(vistaAtual(), 'mestre');

  const acao = acaoPorId('vista-jogador');
  assert.ok(acao);
  executarAcao(acao);

  assert.equal(vistaDeJogador.value, true);
  assert.equal(vistaAtual(), 'jogador');

  executarAcao(acao);
  assert.equal(vistaDeJogador.value, false);
  assert.equal(vistaAtual(), 'mestre');

  modo.value = 'construir';
});

test('ferramentas visíveis mudam conforme o modo', () => {
  modo.value = 'construir';
  assert.equal(modo.value, 'construir');

  modo.value = 'sessao';
  assert.deepEqual([...FERRAMENTAS_DA_SESSAO], ['selecionar', 'mao', 'regua']);

  modo.value = 'construir';
});

test('controle de abertura e alternância de seções no Dock', () => {
  secoesAbertasNoDock.value = { ...secoesAbertasNoDock.value, projetor: false };
  assert.equal(secoesAbertasNoDock.value.projetor, false);

  abrirSecaoNoDock('projetor');
  assert.equal(secoesAbertasNoDock.value.projetor, true);

  alternarSecaoNoDock('projetor');
  assert.equal(secoesAbertasNoDock.value.projetor, false);

  alternarSecaoNoDock('projetor');
  assert.equal(secoesAbertasNoDock.value.projetor, true);
});
