import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef } from '#mesa';
import {
  executarPasso,
  momentoEmCurso,
  pararMomento,
  tocarMomento,
  type Relogio,
  type SaidasDeMomento,
} from '../../src/app/momentos.ts';
import type { Momento } from '../../src/domain/momentos.ts';

function criarSaidas() {
  const chamadas: Array<{ tipo: string; args: any[] }> = [];
  const saidas: SaidasDeMomento = {
    som: ref => chamadas.push({ tipo: 'som', args: [ref] }),
    silencio: ms => chamadas.push({ tipo: 'silencio', args: [ms] }),
    efeito: e => chamadas.push({ tipo: 'efeito', args: [e] }),
    clima: id => chamadas.push({ tipo: 'clima', args: [id] }),
    tela: (acao, ms) => chamadas.push({ tipo: 'tela', args: [acao, ms] }),
    letreiro: l => chamadas.push({ tipo: 'letreiro', args: [l] }),
    camera: alvo => chamadas.push({ tipo: 'camera', args: [alvo] }),
    revelar: ids => chamadas.push({ tipo: 'revelar', args: [ids] }),
    interagir: id => chamadas.push({ tipo: 'interagir', args: [id] }),
    luz: (ids, acao) => chamadas.push({ tipo: 'luz', args: [ids, acao] }),
    objeto: (ids, acao) => chamadas.push({ tipo: 'objeto', args: [ids, acao] }),
    pista: (ref, mostrar) => chamadas.push({ tipo: 'pista', args: [ref, mostrar] }),
    nota: texto => chamadas.push({ tipo: 'nota', args: [texto] }),
  };
  return { saidas, chamadas };
}

function criarRelogioFalso() {
  const esperas: number[] = [];
  const relogio: Relogio = {
    esperar(ms, sinal) {
      esperas.push(ms);
      if (sinal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return new Promise<void>((resolve, reject) => {
        const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
        sinal.addEventListener('abort', onAbort, { once: true });
        queueMicrotask(() => {
          if (!sinal.aborted) {
            sinal.removeEventListener('abort', onAbort);
            resolve();
          }
        });
      });
    },
  };
  return { relogio, esperas };
}

function criarRelogioControlavel() {
  const pendentes: Array<{ resolve: () => void; reject: (err: any) => void }> = [];
  const relogio: Relogio = {
    esperar(ms, sinal) {
      if (sinal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
      return new Promise<void>((resolve, reject) => {
        const item = { resolve, reject };
        pendentes.push(item);
        sinal.addEventListener(
          'abort',
          () => {
            const idx = pendentes.indexOf(item);
            if (idx !== -1) pendentes.splice(idx, 1);
            reject(new DOMException('Aborted', 'AbortError'));
          },
          { once: true },
        );
      });
    },
  };
  return {
    relogio,
    pendentes,
    avancar: () => pendentes.shift()?.resolve(),
  };
}

test('ordem dos passos e das esperas: tocarMomento executa passos em sequência e esperar não chama saída', async () => {
  const { saidas, chamadas } = criarSaidas();
  const { relogio, esperas } = criarRelogioFalso();

  const momento: Momento = {
    id: 'm1',
    nome: 'Momento Sequencial',
    cor: null,
    passos: [
      { tipo: 'efeito', efeito: 'tremor' },
      { tipo: 'esperar', ms: 500 },
      { tipo: 'clima', clima: 'tempestade' },
      { tipo: 'esperar', ms: 1200 },
      { tipo: 'nota', texto: 'Aviso final' },
    ],
  };

  const resultado = await tocarMomento('mapa-1', momento, saidas, relogio);
  assert.equal(resultado, 'fim');

  // Esperas foram chamadas no relógio
  assert.deepEqual(esperas, [500, 1200]);

  // Saídas respeitam a ordem e não incluem 'esperar'
  assert.deepEqual(chamadas, [
    { tipo: 'efeito', args: ['tremor'] },
    { tipo: 'clima', args: ['tempestade'] },
    { tipo: 'nota', args: ['Aviso final'] },
  ]);
});

test('cancelar no meio para os passos seguintes, não limpa tela nem letreiro se não foram usados, e devolve cancelado', async () => {
  const { saidas, chamadas } = criarSaidas();
  const { relogio } = criarRelogioControlavel();

  const momento: Momento = {
    id: 'm-simples',
    nome: 'Sem tela nem letreiro',
    cor: null,
    passos: [
      { tipo: 'efeito', efeito: 'tremor' },
      { tipo: 'esperar', ms: 5000 },
      { tipo: 'clima', clima: 'noite' },
    ],
  };

  const promessa = tocarMomento('mapa-1', momento, saidas, relogio);
  // O passo 1 é instantâneo e síncrono; ao suspender no primeiro await, já está no passo 2
  assert.equal(momentoEmCurso.value?.passo, 2);

  // Cancela
  pararMomento();
  const res = await promessa;

  assert.equal(res, 'cancelado');
  assert.equal(momentoEmCurso.value, null);
  // Não executou o clima
  assert.deepEqual(chamadas, [{ tipo: 'efeito', args: ['tremor'] }]);
});

test('cancelar no meio limpa a tela e o letreiro só quando foram usados', async () => {
  const { saidas, chamadas } = criarSaidas();
  const { relogio } = criarRelogioControlavel();

  const momento: Momento = {
    id: 'm-visual',
    nome: 'Com tela e letreiro',
    cor: null,
    passos: [
      { tipo: 'tela', acao: 'escurecer', ms: 800 },
      { tipo: 'letreiro', titulo: 'Kian', subtitulo: '', peca: null, estilo: 'apresentacao', ms: 3000 },
      { tipo: 'esperar', ms: 4000 },
      { tipo: 'clima', clima: 'noite' },
    ],
  };

  const promessa = tocarMomento('mapa-1', momento, saidas, relogio);
  await Promise.resolve();
  assert.equal(momentoEmCurso.value?.passo, 3);

  // Ao cancelar, deve chamar saidas.tela('clarear', 300) e saidas.letreiro(null)
  pararMomento();
  const res = await promessa;

  assert.equal(res, 'cancelado');
  assert.equal(momentoEmCurso.value, null);

  assert.deepEqual(chamadas, [
    { tipo: 'tela', args: ['escurecer', 800] },
    { tipo: 'letreiro', args: [{ tipo: 'letreiro', titulo: 'Kian', subtitulo: '', peca: null, estilo: 'apresentacao', ms: 3000 }] },
    { tipo: 'tela', args: ['clarear', 300] },
    { tipo: 'letreiro', args: [null] },
  ]);
});

test('tocar um segundo momento cancela o primeiro', async () => {
  const { saidas } = criarSaidas();
  const controlavel = criarRelogioControlavel();
  const instantaneo = criarRelogioFalso();

  const m1: Momento = {
    id: 'm1',
    nome: 'Primeiro',
    cor: null,
    passos: [
      { tipo: 'esperar', ms: 10_000 },
      { tipo: 'nota', texto: 'primeiro fim' },
    ],
  };

  const m2: Momento = {
    id: 'm2',
    nome: 'Segundo',
    cor: null,
    passos: [
      { tipo: 'efeito', efeito: 'piscar' },
    ],
  };

  const p1 = tocarMomento('mapa-1', m1, saidas, controlavel.relogio);
  await Promise.resolve();

  // Iniciar o segundo momento cancela o primeiro
  const p2 = tocarMomento('mapa-1', m2, saidas, instantaneo.relogio);

  const [res1, res2] = await Promise.all([p1, p2]);
  assert.equal(res1, 'cancelado');
  assert.equal(res2, 'fim');
  assert.equal(momentoEmCurso.value, null);
});

test('passo que lança erro não interrompe o resto do momento', async () => {
  const { saidas, chamadas } = criarSaidas();
  const { relogio } = criarRelogioFalso();

  // Falha proposital no clima
  saidas.clima = () => {
    throw new Error('Falha no clima simulada');
  };

  const momento: Momento = {
    id: 'm-erro',
    nome: 'Tolerante a falhas',
    cor: null,
    passos: [
      { tipo: 'clima', clima: 'tempestade' },
      { tipo: 'esperar', ms: 100 },
      { tipo: 'efeito', efeito: 'relampago' },
    ],
  };

  const res = await tocarMomento('mapa-1', momento, saidas, relogio);
  assert.equal(res, 'fim');

  // O efeito rodou mesmo com erro no passo anterior
  assert.deepEqual(chamadas, [{ tipo: 'efeito', args: ['relampago'] }]);
});

test('momentoEmCurso acompanha o passo a cada iteração e volta a null no fim', async () => {
  const { saidas } = criarSaidas();
  const { relogio } = criarRelogioFalso();

  const historicoPassos: Array<{ passo: number; total: number }> = [];

  const momento: Momento = {
    id: 'm-progresso',
    nome: 'Progresso',
    cor: null,
    passos: [
      { tipo: 'efeito', efeito: 'piscar' },
      { tipo: 'esperar', ms: 100 },
      { tipo: 'nota', texto: 'fim' },
    ],
  };

  assert.equal(momentoEmCurso.value, null);

  saidas.efeito = () => {
    if (momentoEmCurso.value) {
      historicoPassos.push({ passo: momentoEmCurso.value.passo, total: momentoEmCurso.value.total });
    }
  };
  saidas.nota = () => {
    if (momentoEmCurso.value) {
      historicoPassos.push({ passo: momentoEmCurso.value.passo, total: momentoEmCurso.value.total });
    }
  };

  const res = await tocarMomento('mapa-1', momento, saidas, relogio);
  assert.equal(res, 'fim');
  assert.equal(momentoEmCurso.value, null);

  assert.deepEqual(historicoPassos, [
    { passo: 1, total: 3 },
    { passo: 3, total: 3 },
  ]);
});

test('executarPasso despacha cada tipo instantâneo e ignora esperar', () => {
  const { saidas, chamadas } = criarSaidas();

  const refSom = criarRef('jukebox', 'cena-sonora', 'chuva');
  const refPista = criarRef('atelie', 'documento', 'doc-1');

  executarPasso({ tipo: 'esperar', ms: 5000 }, saidas);
  assert.equal(chamadas.length, 0);

  executarPasso({ tipo: 'som', ref: refSom }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'som', args: [refSom] });

  executarPasso({ tipo: 'silencio', ms: 1200 }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'silencio', args: [1200] });

  executarPasso({ tipo: 'efeito', efeito: 'relampago' }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'efeito', args: ['relampago'] });

  executarPasso({ tipo: 'clima', clima: 'dia' }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'clima', args: ['dia'] });

  executarPasso({ tipo: 'tela', acao: 'clarear', ms: 500 }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'tela', args: ['clarear', 500] });

  const letreiroPasso = { tipo: 'letreiro' as const, titulo: 'A Chegada', subtitulo: '', peca: null, estilo: 'capitulo' as const, ms: 2000 };
  executarPasso(letreiroPasso, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'letreiro', args: [letreiroPasso] });

  executarPasso({ tipo: 'camera', alvo: { colecao: 'tokens', id: 't1' } }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'camera', args: [{ colecao: 'tokens', id: 't1' }] });

  executarPasso({ tipo: 'revelar', ids: ['sala', 'quarto'] }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'revelar', args: [['sala', 'quarto']] });

  executarPasso({ tipo: 'interagir', id: 'porta-1' }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'interagir', args: ['porta-1'] });

  executarPasso({ tipo: 'luz', ids: ['luz-1'], acao: 'alternar' }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'luz', args: [['luz-1'], 'alternar'] });

  executarPasso({ tipo: 'objeto', ids: ['obj-1'], acao: 'esconder' }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'objeto', args: [['obj-1'], 'esconder'] });

  executarPasso({ tipo: 'pista', ref: refPista, mostrar: true }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'pista', args: [refPista, true] });

  executarPasso({ tipo: 'nota', texto: 'Lembrar de rolar sanidade' }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'nota', args: ['Lembrar de rolar sanidade'] });
});
