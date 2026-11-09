import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BARRA_PADRAO,
  lerBarra,
  type BarraDeEfeitos,
  type EspacoDaBarra,
} from '../../src/domain/barra-de-efeitos.ts';
import {
  barraDeEfeitos,
  definirEspaco,
  trocarEspacos,
  dispararEspaco,
  ultimoDisparo,
} from '../../src/app/barra-de-efeitos.ts';
import { modo } from '../../src/app/modo.ts';
import { tratarTecla } from '../../src/app/acoes.ts';
import { sessao } from '../../src/app/app.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarSessao } from '../../src/app/sessao.ts';
import type { PassoDeMomento } from '../../src/domain/momentos.ts';

test('BARRA_PADRAO: possui exatamente 9 espaços e os 5 primeiros pré-configurados', () => {
  assert.equal(BARRA_PADRAO.length, 9);
  assert.equal(BARRA_PADRAO[0]?.rotulo, 'Relâmpago');
  assert.equal(BARRA_PADRAO[0]?.acao.tipo, 'passo');
  assert.equal(BARRA_PADRAO[1]?.rotulo, 'Tremor');
  assert.equal(BARRA_PADRAO[2]?.rotulo, 'Luzes piscam');
  assert.equal(BARRA_PADRAO[3]?.rotulo, 'Escurecer');
  assert.equal(BARRA_PADRAO[4]?.rotulo, 'Clarão');
  assert.equal(BARRA_PADRAO[5], null);
  assert.equal(BARRA_PADRAO[6], null);
  assert.equal(BARRA_PADRAO[7], null);
  assert.equal(BARRA_PADRAO[8], null);

  const lida = lerBarra(BARRA_PADRAO);
  assert.deepEqual(lida, BARRA_PADRAO);
});

test('lerBarra: tolerante com lixo, descarta passos inválidos e rejeita esperar', () => {
  // Lixo devolve clone da padrão
  assert.deepEqual(lerBarra(null), BARRA_PADRAO);
  assert.deepEqual(lerBarra('string'), BARRA_PADRAO);
  assert.deepEqual(lerBarra({}), BARRA_PADRAO);

  // Array com menos de 9 é completado com null
  const curta = [
    { rotulo: 'Tremor', acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'tremor' } } },
  ];
  const lidaCurta = lerBarra(curta);
  assert.equal(lidaCurta.length, 9);
  assert.equal(lidaCurta[0]?.rotulo, 'Tremor');
  for (let i = 1; i < 9; i++) {
    assert.equal(lidaCurta[i], null);
  }

  // Array com mais de 9 é limitado a 9
  const longa = Array.from({ length: 15 }, () => null);
  assert.equal(lerBarra(longa).length, 9);

  // 'esperar' não é aceito como passo de espaço da barra
  const comEsperar = [
    { rotulo: 'Espera', acao: { tipo: 'passo', passo: { tipo: 'esperar', ms: 1000 } } },
  ];
  assert.equal(lerBarra(comEsperar)[0], null);

  // Passo inválido é descartado
  const comInvalido = [
    { rotulo: 'Inválido', acao: { tipo: 'passo', passo: { tipo: 'tipo-estranho' } } },
    { rotulo: 'Momento Inválido', acao: { tipo: 'momento', id: 'id com espaço' } },
    { rotulo: 'Momento Válido', acao: { tipo: 'momento', id: 'm-susto' } },
  ];
  const lidaInvalida = lerBarra(comInvalido);
  assert.equal(lidaInvalida[0], null);
  assert.equal(lidaInvalida[1], null);
  assert.equal(lidaInvalida[2]?.rotulo, 'Momento Válido');
  assert.equal(lidaInvalida[2]?.acao.tipo, 'momento');
});

test('definirEspaco e trocarEspacos: manipulam a barra e persistem', () => {
  const original = [...barraDeEfeitos.value];
  try {
    const novoItem: EspacoDaBarra = {
      rotulo: 'Grito',
      acao: { tipo: 'momento', id: 'm-grito' },
    };
    definirEspaco(5, novoItem);
    assert.equal(barraDeEfeitos.value[5]?.rotulo, 'Grito');

    trocarEspacos(0, 5);
    assert.equal(barraDeEfeitos.value[0]?.rotulo, 'Grito');
    assert.equal(barraDeEfeitos.value[5]?.rotulo, 'Relâmpago');

    // Limpar espaço
    definirEspaco(0, null);
    assert.equal(barraDeEfeitos.value[0], null);
  } finally {
    barraDeEfeitos.value = original;
  }
});

test('dispararEspaco: chama o executor certo para passo e momento, e avisa se momento não existe', () => {
  const passosExecutados: PassoDeMomento[] = [];
  const momentosTocados: string[] = [];
  const avisos: string[] = [];

  const injetadas = {
    executarPasso: (p: PassoDeMomento) => passosExecutados.push(p),
    tocarMomento: (id: string) => momentosTocados.push(id),
    avisar: (msg: string) => avisos.push(msg),
    momentoExiste: (id: string) => id === 'm-existente',
  };

  const backup = [...barraDeEfeitos.value];
  try {
    definirEspaco(0, {
      rotulo: 'Tremor',
      acao: { tipo: 'passo', passo: { tipo: 'efeito', efeito: 'tremor' } },
    });
    definirEspaco(1, {
      rotulo: 'Clímax',
      acao: { tipo: 'momento', id: 'm-existente' },
    });
    definirEspaco(2, {
      rotulo: 'Apagado',
      acao: { tipo: 'momento', id: 'm-inexistente' },
    });
    definirEspaco(3, null);

    // 1. Dispara passo
    assert.equal(dispararEspaco(0, injetadas), true);
    assert.equal(passosExecutados.length, 1);
    assert.equal(passosExecutados[0]?.tipo, 'efeito');
    assert.equal(ultimoDisparo.value?.i, 0);

    // 2. Dispara momento existente
    assert.equal(dispararEspaco(1, injetadas), true);
    assert.equal(momentosTocados.length, 1);
    assert.equal(momentosTocados[0], 'm-existente');
    assert.equal(ultimoDisparo.value?.i, 1);

    // 3. Dispara momento inexistente -> avisa e não toca
    assert.equal(dispararEspaco(2, injetadas), false);
    assert.equal(momentosTocados.length, 1);
    assert.equal(avisos.length, 1);
    assert.match(avisos[0]!, /não existe neste mapa/i);

    // 4. Espaço vazio -> não dispara
    assert.equal(dispararEspaco(3, injetadas), false);
    assert.equal(dispararEspaco(99, injetadas), false);
  } finally {
    barraDeEfeitos.value = backup;
  }
});

test('teclas 1-9: resolvem para espaço na Sessão e para ferramenta no Construir', () => {
  const mapa = criarMapa({ id: 'mapa-teclas', nome: 'Mansão' });
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
  const modoAnterior = modo.value;
  sessao.value = s;

  try {
    // 1. No modo Construir: tecla '2' escolhe a ferramenta 'mao'
    modo.value = 'construir';
    s.ferramenta.value = 'selecionar';
    const eventoConstruir = {
      key: '2',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      target: null,
      preventDefault() {},
    } as unknown as KeyboardEvent;

    const tratouConstruir = tratarTecla(eventoConstruir);
    assert.equal(tratouConstruir, true);
    assert.equal(s.ferramenta.value, 'mao', 'tecla 2 no modo Construir ativa a ferramenta mao');

    // 2. No modo Sessão: tecla '2' dispara o espaço 1 da barra de efeitos (Tremor)
    modo.value = 'sessao';
    s.ferramenta.value = 'selecionar';
    ultimoDisparo.value = null;

    const eventoSessao = {
      key: '2',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      target: null,
      preventDefault() {},
    } as unknown as KeyboardEvent;

    const tratouSessao = tratarTecla(eventoSessao);
    assert.equal(tratouSessao, true);
    assert.equal(ultimoDisparo.peek()?.i, 1, 'tecla 2 no modo Sessão dispara o espaço 1 da barra de efeitos');
    assert.equal(s.ferramenta.value, 'selecionar', 'ferramenta não é alterada na Sessão ao apertar número');

    // 3. Foco em campo de texto não dispara nem consome a tecla
    const inputMock = {
      tagName: 'INPUT',
      type: 'text',
      closest: (sel: string) => (sel.includes('input') ? { tagName: 'INPUT', type: 'text' } : null),
    } as unknown as HTMLElement;

    const eventoInput = {
      key: '2',
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      target: inputMock,
      preventDefault() {},
    } as unknown as KeyboardEvent;

    const tratouInput = tratarTecla(eventoInput);
    assert.equal(tratouInput, false, 'tecla 2 dentro de input não intercepta');
  } finally {
    sessao.value = sessaoAnterior;
    modo.value = modoAnterior;
    s.fechar();
  }
});
