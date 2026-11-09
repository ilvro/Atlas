import { test } from 'node:test';
import assert from 'node:assert/strict';
import { obterIconeDoEspaco, type EspacoDaBarra } from '../../src/domain/barra-de-efeitos.ts';
import {
  barraDeEfeitos,
  definirEspaco,
  trocarEspacos,
  dispararEspaco,
  ultimoDisparo,
} from '../../src/app/barra-de-efeitos.ts';
import { modo } from '../../src/app/modo.ts';
import { tratarTecla } from '../../src/app/acoes.ts';
import { criarRef } from '#mesa';
import type { PassoDeMomento } from '../../src/domain/momentos.ts';

test('obterIconeDoEspaco: devolve o ícone correspondente a cada tipo de ação', () => {
  const espacoMomento: EspacoDaBarra = {
    rotulo: 'Susto',
    acao: { tipo: 'momento', id: 'm1' },
  };
  assert.equal(obterIconeDoEspaco(espacoMomento), 'play');

  const espacoRelampago: EspacoDaBarra = {
    rotulo: 'Raio',
    acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'relampago' } },
  };
  assert.equal(obterIconeDoEspaco(espacoRelampago), 'anim');

  const espacoTremor: EspacoDaBarra = {
    rotulo: 'Tremor',
    acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'tremor' } },
  };
  assert.equal(obterIconeDoEspaco(espacoTremor), 'tremor');

  const espacoPiscar: EspacoDaBarra = {
    rotulo: 'Piscar',
    acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'piscar' } },
  };
  assert.equal(obterIconeDoEspaco(espacoPiscar), 'luz');

  const espacoClarao: EspacoDaBarra = {
    rotulo: 'Clarão',
    acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'clarao' } },
  };
  assert.equal(obterIconeDoEspaco(espacoClarao), 'sol');

  const espacoSom: EspacoDaBarra = {
    rotulo: 'Grito',
    acao: { tipo: 'passo', passo: { tipo: 'som', ref: criarRef('jukebox', 'efeito', 'grito') } },
  };
  assert.equal(obterIconeDoEspaco(espacoSom), 'som');

  const espacoClima: EspacoDaBarra = {
    rotulo: 'Apagão',
    acao: { tipo: 'passo', passo: { tipo: 'clima', clima: 'apagao' } },
  };
  assert.equal(obterIconeDoEspaco(espacoClima), 'sol');

  const espacoTela: EspacoDaBarra = {
    rotulo: 'Escurecer',
    acao: { tipo: 'passo', passo: { tipo: 'tela', acao: 'escurecer', ms: 500 } },
  };
  assert.equal(obterIconeDoEspaco(espacoTela), 'olho');

  const espacoLetreiro: EspacoDaBarra = {
    rotulo: 'Capítulo',
    acao: { tipo: 'passo', passo: { tipo: 'letreiro', estilo: 'capitulo', titulo: 'Cap 1', subtitulo: '', peca: null, ms: 3000 } },
  };
  assert.equal(obterIconeDoEspaco(espacoLetreiro), 'texto');

  const espacoNota: EspacoDaBarra = {
    rotulo: 'Aviso',
    acao: { tipo: 'passo', passo: { tipo: 'nota', texto: 'Atenção' } },
  };
  assert.equal(obterIconeDoEspaco(espacoNota), 'nota');
});

test('configurar espaço 6 para o efeito Grito do Jukebox e disparar com tecla 6', async () => {
  // Configura o espaço 6 (índice 5) para som: Grito
  const gritoRef = criarRef('jukebox', 'efeito', 'grito');
  const espacoGrito: EspacoDaBarra = {
    rotulo: 'Grito',
    acao: {
      tipo: 'passo',
      passo: { tipo: 'som', ref: gritoRef },
    },
  };

  definirEspaco(5, espacoGrito);
  assert.equal(barraDeEfeitos.value[5]?.rotulo, 'Grito');
  assert.deepEqual(barraDeEfeitos.value[5]?.acao, espacoGrito.acao);

  // Espiona o disparo com saídas injetadas
  let passoExecutado: PassoDeMomento | null = null;
  const disparosFalsos = {
    executarPasso: (p: PassoDeMomento) => {
      passoExecutado = p;
    },
    tocarMomento: () => {},
    avisar: () => {},
    momentoExiste: () => true,
  };

  // Disparo direto com injeção confirma que o espaço 6 executa o efeito de som
  dispararEspaco(5, disparosFalsos);
  assert.ok(passoExecutado, 'deve ter executado o passo avulso');
  assert.equal((passoExecutado as PassoDeMomento).tipo, 'som');
  assert.deepEqual((passoExecutado as { tipo: 'som'; ref: typeof gritoRef }).ref, gritoRef);
  assert.equal(ultimoDisparo.peek()?.i, 5, 'último disparo deve ser no índice 5 (espaço 6)');

  // Garante modo sessão
  const modoAnterior = modo.value;
  modo.value = 'sessao';
  ultimoDisparo.value = null;

  try {
    // Tecla 6 na sessão dispara o espaço 5
    let preveniu = false;
    const tratou = tratarTecla({
      key: '6',
      ctrlKey: false,
      altKey: false,
      metaKey: false,
      shiftKey: false,
      target: null,
      preventDefault: () => { preveniu = true; },
    } as unknown as KeyboardEvent);

    assert.equal(tratou, true, 'deve tratar a tecla 6');
    assert.equal(preveniu, true, 'deve prevenir padrão da tecla 6 na sessão');
    assert.equal(ultimoDisparo.peek()?.i, 5, 'tecla 6 deve acionar o último disparo no índice 5');

    // Limpar o espaço 6
    definirEspaco(5, null);
    assert.equal(barraDeEfeitos.value[5], null, 'espaço 6 deve voltar a ser null');
  } finally {
    modo.value = modoAnterior;
  }
});

test('arrastar e soltar (trocarEspacos): permuta dois espaços', () => {
  const espaco1 = barraDeEfeitos.value[0]; // Relâmpago
  const espaco2 = barraDeEfeitos.value[1]; // Tremor

  trocarEspacos(0, 1);
  assert.equal(barraDeEfeitos.value[0]?.rotulo, espaco2?.rotulo);
  assert.equal(barraDeEfeitos.value[1]?.rotulo, espaco1?.rotulo);

  // Desfaz a troca
  trocarEspacos(0, 1);
  assert.equal(barraDeEfeitos.value[0]?.rotulo, espaco1?.rotulo);
  assert.equal(barraDeEfeitos.value[1]?.rotulo, espaco2?.rotulo);
});
