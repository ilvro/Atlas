import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef } from '#mesa';
import { criarMapa } from '../../src/domain/mapa.ts';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { CAMPOS_DO_MESTRE, projetarParaJogadores } from '../../src/domain/projecao.ts';
import { aplicarComando, ErroDeComando } from '../../src/state/comandos.ts';
import { criarStore } from '../../src/state/store.ts';
import {
  descreverPasso,
  duracaoEstimada,
  momentoValido,
  novoMomento,
  passoValido,
  type Momento,
  type PassoDeMomento,
} from '../../src/domain/momentos.ts';
import { mapaCompleto } from './fixtures.ts';

test('migração 7 → 8: mapa v7 recebe moments: {} e preserva todo o restante', () => {
  const atual = mapaCompleto();
  const v7 = structuredClone(atual) as unknown as Record<string, any>;
  v7.version = 7;
  delete v7.moments;

  const lido = lerMapa(v7);
  assert.equal(lido.version, 8);
  assert.deepEqual(lido.moments, {});
  assert.equal(lido.name, atual.name);
  assert.equal(v7.version, 7, 'o original não é tocado');
});

test('validação aceita um momento com todos os tipos de passo', () => {
  const m = mapaCompleto();
  const momento: Momento = {
    id: 'momento-completo',
    nome: 'Cena Dramática',
    cor: '#ff3344',
    passos: [
      { tipo: 'tela', acao: 'escurecer', ms: 800 },
      { tipo: 'esperar', ms: 1000 },
      { tipo: 'som', ref: criarRef('jukebox', 'cena-sonora', 'chuva') },
      { tipo: 'silencio', ms: 1500 },
      { tipo: 'efeito', efeito: 'tremor' },
      { tipo: 'efeito', efeito: 'relampago' },
      { tipo: 'clima', clima: 'tempestade' },
      { tipo: 'camera', alvo: { colecao: 'rooms', id: 'sala' } },
      { tipo: 'letreiro', titulo: 'Kian', subtitulo: 'O Sacerdote', peca: 'muirenn', estilo: 'apresentacao', ms: 4000 },
      { tipo: 'revelar', ids: ['sala'] },
      { tipo: 'interagir', id: 'porta' },
      { tipo: 'luz', ids: ['lampiao'], acao: 'alternar' },
      { tipo: 'objeto', ids: ['mesa'], acao: 'esconder' },
      { tipo: 'pista', ref: criarRef('atelie', 'documento', 'pista-1'), mostrar: true },
      { tipo: 'nota', texto: 'Avisar o mestre para preparar os dados.' },
      { tipo: 'tela', acao: 'clarear', ms: 1200 },
    ],
  };

  assert.equal(momentoValido(momento), null);

  m.moments[momento.id] = momento;
  assert.doesNotThrow(() => validarMapa(m));
});

test('validação recusa ms fora da faixa, tipo desconhecido, título vazio no letreiro e ref de outro app no som', () => {
  // esperar: 100..120000 ms
  assert.match(passoValido({ tipo: 'esperar', ms: 50 }) ?? '', /espera/i);
  assert.match(passoValido({ tipo: 'esperar', ms: 200_000 }) ?? '', /espera/i);
  assert.equal(passoValido({ tipo: 'esperar', ms: 1500 }), null);

  // tela: 0..10000 ms
  assert.match(passoValido({ tipo: 'tela', acao: 'escurecer', ms: -5 }) ?? '', /tela/i);
  assert.match(passoValido({ tipo: 'tela', acao: 'escurecer', ms: 15_000 }) ?? '', /tela/i);
  assert.match(passoValido({ tipo: 'tela', acao: 'invalida', ms: 500 }) ?? '', /ação|acao/i);
  assert.equal(passoValido({ tipo: 'tela', acao: 'clarear', ms: 0 }), null);

  // letreiro: titulo não vazio, ms 1000..20000
  assert.match(passoValido({ tipo: 'letreiro', titulo: '', subtitulo: '', peca: null, estilo: 'capitulo', ms: 2000 }) ?? '', /título/i);
  assert.match(passoValido({ tipo: 'letreiro', titulo: '   ', subtitulo: '', peca: null, estilo: 'capitulo', ms: 2000 }) ?? '', /título/i);
  assert.match(passoValido({ tipo: 'letreiro', titulo: 'Título', subtitulo: '', peca: null, estilo: 'capitulo', ms: 500 }) ?? '', /letreiro/i);
  assert.match(passoValido({ tipo: 'letreiro', titulo: 'Título', subtitulo: '', peca: null, estilo: 'capitulo', ms: 25_000 }) ?? '', /letreiro/i);
  assert.equal(passoValido({ tipo: 'letreiro', titulo: 'Título', subtitulo: 'Sub', peca: null, estilo: 'capitulo', ms: 2000 }), null);

  // som: ref do jukebox cena-sonora ou efeito
  assert.match(passoValido({ tipo: 'som', ref: criarRef('atelie', 'documento', 'carta') }) ?? '', /jukebox/i);
  assert.match(passoValido({ tipo: 'som', ref: criarRef('jukebox', 'trilha' as any, 'musica') }) ?? '', /jukebox/i);
  assert.equal(passoValido({ tipo: 'som', ref: criarRef('jukebox', 'efeito', 'tiro') }), null);
  assert.equal(passoValido({ tipo: 'som', ref: criarRef('jukebox', 'cena-sonora', 'festa') }), null);

  // silencio: ms 0..30000
  assert.match(passoValido({ tipo: 'silencio', ms: -100 }) ?? '', /silêncio|silencio/i);
  assert.match(passoValido({ tipo: 'silencio', ms: 35_000 }) ?? '', /silêncio|silencio/i);
  assert.match(passoValido({ tipo: 'silencio', ms: '1000' as any }) ?? '', /silêncio|silencio/i);
  assert.equal(passoValido({ tipo: 'silencio', ms: 0 }), null);
  assert.equal(passoValido({ tipo: 'silencio', ms: 1500 }), null);
  assert.equal(passoValido({ tipo: 'silencio', ms: 30_000 }), null);

  // tipo desconhecido
  assert.match(passoValido({ tipo: 'efeito-magico' }) ?? '', /desconhecido/i);

  // momentoValido checa identificador, nome e quantidade de passos
  const base = novoMomento('m1', 'Momento 1');
  assert.equal(momentoValido(base), null);
  assert.match(momentoValido({ ...base, id: 'id com espaço' }) ?? '', /identificador/i);
  assert.match(momentoValido({ ...base, nome: '' }) ?? '', /nome/i);
  assert.match(momentoValido({ ...base, cor: 'vermelho' }) ?? '', /cor/i);
  assert.match(momentoValido({ ...base, passos: Array.from({ length: 65 }, () => ({ tipo: 'esperar', ms: 1000 } as PassoDeMomento)) }) ?? '', /60 passos/i);

  // Chave diferente do id
  const m = mapaCompleto();
  m.moments['outro-id'] = { ...base, id: 'm1' };
  assert.throws(() => validarMapa(m), /Identificador diferente da chave/);
});

test('comandos momento.salvar e momento.remover com histórico e validação', () => {
  const m = mapaCompleto();
  const momento = novoMomento('susto', 'O Grande Susto');
  momento.passos.push({ tipo: 'efeito', efeito: 'tremor' });

  // Salvar cria o momento
  const m1 = aplicarComando(m, { tipo: 'momento.salvar', momento });
  assert.equal(m1.moments.susto?.nome, 'O Grande Susto');

  // Recusa salvar momento inválido
  assert.throws(() => aplicarComando(m, { tipo: 'momento.salvar', momento: { ...momento, nome: '' } }), ErroDeComando);

  // Remover apaga o momento
  const m2 = aplicarComando(m1, { tipo: 'momento.remover', id: 'susto' });
  assert.equal(m2.moments.susto, undefined);

  // Remover inexistente recusa
  assert.throws(() => aplicarComando(m2, { tipo: 'momento.remover', id: 'susto' }), ErroDeComando);

  // Histórico com store (desfazer e refazer)
  const store = criarStore(m);
  store.executar({ tipo: 'momento.salvar', momento });
  assert.ok(store.documento.moments.susto);

  store.desfazer();
  assert.equal(store.documento.moments.susto, undefined);

  store.refazer();
  assert.ok(store.documento.moments.susto);

  store.executar({ tipo: 'momento.remover', id: 'susto' });
  assert.equal(store.documento.moments.susto, undefined);

  store.desfazer();
  assert.ok(store.documento.moments.susto);
});

test('duracaoEstimada calcula a soma das esperas mais a extensão do último visual', () => {
  const m = novoMomento('m1', 'Teste Duração');
  assert.equal(duracaoEstimada(m), 0);

  // Apenas esperas somam
  m.passos = [
    { tipo: 'esperar', ms: 1000 },
    { tipo: 'esperar', ms: 2500 },
  ];
  assert.equal(duracaoEstimada(m), 3500);

  // Letreiro lançado no início que ultrapassa a soma das esperas
  m.passos = [
    { tipo: 'tela', acao: 'escurecer', ms: 800 }, // t=0..800
    { tipo: 'esperar', ms: 1000 },                // t=1000
    { tipo: 'letreiro', titulo: 'Kian', subtitulo: '', peca: null, estilo: 'apresentacao', ms: 4000 }, // t=1000..5000
    { tipo: 'esperar', ms: 1000 },                // t=2000
  ];
  // tempoAtual = 2000 ms, mas letreiro termina em 1000 + 4000 = 5000 ms
  assert.equal(duracaoEstimada(m), 5000);

  // Espera final após o término do letreiro
  m.passos.push({ tipo: 'esperar', ms: 4000 }); // tempoAtual = 6000 ms > 5000 ms
  assert.equal(duracaoEstimada(m), 6000);
});

test('descreverPasso gera resumo em português e aponta quando alvo sumiu', () => {
  const m = mapaCompleto();

  assert.equal(descreverPasso({ tipo: 'esperar', ms: 1500 }), 'Esperar 1,5 s');
  assert.equal(descreverPasso({ tipo: 'som', ref: criarRef('jukebox', 'efeito', 'trovao') }), 'Som: trovao');
  assert.equal(descreverPasso({ tipo: 'silencio', ms: 1500 }), 'Silêncio (1,5 s)');
  assert.equal(descreverPasso({ tipo: 'efeito', efeito: 'tremor' }), 'Efeito: Tremor');
  assert.equal(descreverPasso({ tipo: 'efeito', efeito: 'relampago' }), 'Efeito: Relâmpago');
  assert.equal(descreverPasso({ tipo: 'clima', clima: 'tempestade' }), 'Clima: tempestade');
  assert.equal(descreverPasso({ tipo: 'tela', acao: 'escurecer', ms: 800 }), 'Tela: Escurecer (0,8 s)');
  assert.equal(descreverPasso({ tipo: 'tela', acao: 'clarear', ms: 1000 }), 'Tela: Clarear (1 s)');
  assert.equal(descreverPasso({ tipo: 'pista', ref: criarRef('atelie', 'documento', 'doc1'), mostrar: true }), 'Pista: doc1');
  assert.equal(descreverPasso({ tipo: 'nota', texto: 'Aviso rápido' }), 'Nota: Aviso rápido');

  // Letreiro com título
  assert.equal(descreverPasso({ tipo: 'letreiro', titulo: 'Kian', subtitulo: '', peca: null, estilo: 'apresentacao', ms: 4000 }), 'Letreiro: Kian');

  // Letreiro sem título mas com peça existente
  assert.equal(descreverPasso({ tipo: 'letreiro', titulo: '', subtitulo: '', peca: 'muirenn', estilo: 'apresentacao', ms: 4000 }, m), 'Letreiro: Muirenn');
  // Letreiro sem título com peça inexistente
  assert.equal(descreverPasso({ tipo: 'letreiro', titulo: '', subtitulo: '', peca: 'fantasma', estilo: 'apresentacao', ms: 4000 }, m), 'Letreiro: (sumiu)');

  // Câmera em cômodo, peça ou região
  assert.equal(descreverPasso({ tipo: 'camera', alvo: { colecao: 'rooms', id: 'sala' } }, m), 'Câmera: Sala');
  assert.equal(descreverPasso({ tipo: 'camera', alvo: { colecao: 'rooms', id: 'sumiu' } }, m), 'Câmera: (sumiu)');
  assert.equal(descreverPasso({ tipo: 'camera', alvo: { colecao: 'tokens', id: 'muirenn' } }, m), 'Câmera: Muirenn');
  assert.equal(descreverPasso({ tipo: 'camera', alvo: { colecao: 'tokens', id: 'sumiu' } }, m), 'Câmera: (sumiu)');
  assert.equal(descreverPasso({ tipo: 'camera', alvo: { colecao: 'regions', id: 'entrada' } }, m), 'Câmera: Região entrada');
  assert.equal(descreverPasso({ tipo: 'camera', alvo: { colecao: 'regions', id: 'sumiu' } }, m), 'Câmera: (sumiu)');

  // Revelar
  assert.equal(descreverPasso({ tipo: 'revelar', ids: ['sala'] }, m), 'Revelar: Sala');
  assert.equal(descreverPasso({ tipo: 'revelar', ids: ['sumiu'] }, m), 'Revelar: (sumiu)');

  // Interagir
  assert.equal(descreverPasso({ tipo: 'interagir', id: 'mesa' }, m), 'Interagir: mesa.redonda');
  assert.equal(descreverPasso({ tipo: 'interagir', id: 'porta' }, m), 'Interagir: Porta');
  assert.equal(descreverPasso({ tipo: 'interagir', id: 'sumiu' }, m), 'Interagir: (sumiu)');

  // Luz
  assert.equal(descreverPasso({ tipo: 'luz', ids: ['lampiao'], acao: 'ligar' }, m), 'Ligar luz: Luz (lamparina)');
  assert.equal(descreverPasso({ tipo: 'luz', ids: ['mesa'], acao: 'desligar' }, m), 'Desligar luz: mesa.redonda');
  assert.equal(descreverPasso({ tipo: 'luz', ids: ['sumiu'], acao: 'alternar' }, m), 'Alternar luz: (sumiu)');

  // Objeto
  assert.equal(descreverPasso({ tipo: 'objeto', ids: ['mesa'], acao: 'esconder' }, m), 'Esconder objeto: mesa.redonda');
  assert.equal(descreverPasso({ tipo: 'objeto', ids: ['mesa'], acao: 'mostrar' }, m), 'Mostrar objeto: mesa.redonda');
  assert.equal(descreverPasso({ tipo: 'objeto', ids: ['sumiu'], acao: 'esconder' }, m), 'Esconder objeto: (sumiu)');

  // Revelar com região
  assert.equal(descreverPasso({ tipo: 'revelar', ids: ['entrada'] }, m), 'Revelar: Região entrada');
});

test('validação de passos de luz e objeto', () => {
  assert.equal(passoValido({ tipo: 'luz', ids: ['l1', 'o1'], acao: 'alternar' }), null);
  assert.equal(passoValido({ tipo: 'luz', ids: ['l1'], acao: 'ligar' }), null);
  assert.equal(passoValido({ tipo: 'luz', ids: ['l1'], acao: 'desligar' }), null);
  assert.match(passoValido({ tipo: 'luz', ids: ['l1'], acao: 'piscar' }) ?? '', /Ação de luz/);
  assert.match(passoValido({ tipo: 'luz', ids: 'l1', acao: 'ligar' }) ?? '', /Lista de identificadores/);

  assert.equal(passoValido({ tipo: 'objeto', ids: ['o1'], acao: 'mostrar' }), null);
  assert.equal(passoValido({ tipo: 'objeto', ids: ['o1'], acao: 'esconder' }), null);
  assert.match(passoValido({ tipo: 'objeto', ids: ['o1'], acao: 'apagar' }) ?? '', /Ação de objeto/);
  assert.match(passoValido({ tipo: 'objeto', ids: 'o1', acao: 'mostrar' }) ?? '', /Lista de identificadores/);
});

test('projeção para jogadores esvazia moments e lista em CAMPOS_DO_MESTRE', () => {
  const m = mapaCompleto();
  const momento = novoMomento('secreto', 'Surpresa');
  m.moments[momento.id] = momento;

  assert.ok(CAMPOS_DO_MESTRE.includes('moments'));

  const projetado = projetarParaJogadores(m);
  assert.deepEqual(projetado.moments, {});
  assert.ok(!('secreto' in projetado.moments));
  assert.ok(m.moments.secreto, 'o mapa do mestre não é alterado');
});
