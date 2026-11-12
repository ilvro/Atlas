import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef } from '#mesa';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { decodificar } from '../../src/domain/celulas.ts';
import { etapasDaAgua } from '../../src/domain/agua.ts';
import {
  executarPasso,
  fusaoDoMomento,
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
    agua: (p, _rel, _sinal) => { chamadas.push({ tipo: 'agua', args: [p] }); return Promise.resolve(); },
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

  const passoAgua = { tipo: 'agua' as const, poligono: [[0, 0], [5, 0], [5, 5]] as [number, number][], material: 'agua', ms: 3000 };
  executarPasso(passoAgua, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'agua', args: [passoAgua] });

  executarPasso({ tipo: 'pista', ref: refPista, mostrar: true }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'pista', args: [refPista, true] });

  executarPasso({ tipo: 'nota', texto: 'Lembrar de rolar sanidade' }, saidas);
  assert.deepEqual(chamadas.pop(), { tipo: 'nota', args: ['Lembrar de rolar sanidade'] });
});

test('passo de água executa etapas não-bloqueantes sem travar store.executar e recorta aos limites', async () => {
  const store = criarStore(criarMapa());
  const poligono: [number, number][] = [[10, 10], [20, 10], [20, 20], [10, 20]];
  const passo = { tipo: 'agua' as const, poligono, material: 'agua.pantano', ms: 3000, etapas: 6 };

  const { relogio, esperas } = criarRelogioFalso();
  const sinal = new AbortController().signal;

  let intercalouComando = false;
  const executarAgua = async () => {
    const doc = store.documento;
    const res = doc.terrain.resolution;
    const totalEtapas = passo.etapas ?? 6;
    const etapas = etapasDaAgua(passo.poligono, res, totalEtapas, doc.bounds);
    const intervalo = Math.round(passo.ms / totalEtapas);
    const maxCols = Math.ceil(doc.bounds.width / res);
    const maxRows = Math.ceil(doc.bounds.height / res);

    for (let i = 0; i < etapas.length; i++) {
      if (sinal.aborted) return;
      const celulas = etapas[i]!.filter(([cx, cy]) => cx >= 0 && cy >= 0 && cx < maxCols && cy < maxRows);
      if (celulas.length > 0) {
        store.executar({
          tipo: 'terreno.pintar',
          material: passo.material,
          celulas,
          suavizar: true,
        }, { rotulo: 'Água que sobe' });
      }
      if (i === 2) {
        assert.doesNotThrow(() => {
          store.executar({ tipo: 'mapa.renomear', nome: 'Pântano Inundado' });
        }, 'store não pode estar bloqueado por gesto');
        intercalouComando = true;
      }
      await relogio.esperar(intervalo, sinal);
    }
  };

  await executarAgua();

  assert.ok(intercalouComando, 'conseguiu executar comando durante o passo de água');
  assert.equal(esperas.length, 6);
  assert.deepEqual(esperas, [500, 500, 500, 500, 500, 500]);

  const camada = Object.values(store.documento.terrain.layers).find(l => l.material === 'agua.pantano');
  assert.ok(camada, 'camada de água existe');
  const celulasPintadas = new Set(decodificar(camada.cells).map(([x, y]) => `${x},${y}`));
  for (let y = 12; y <= 18; y++) {
    for (let x = 12; x <= 18; x++) {
      const cx = Math.floor(x / store.documento.terrain.resolution);
      const cy = Math.floor(y / store.documento.terrain.resolution);
      assert.ok(celulasPintadas.has(`${cx},${cy}`), `célula ${cx},${cy} está coberta`);
    }
  }
});

test('comandoDaEtapaDeAgua: baixar troca só as células dessa água por deixar, ou devolve o terreno', async () => {
  const { comandoDaEtapaDeAgua } = await import('../../src/domain/agua.ts');
  let mapa = criarMapa({ id: 'a', agora: 1, largura: 20, altura: 20 });
  mapa = aplicarComando(mapa, { tipo: 'terreno.pintar', material: 'agua.pantano', celulas: [[1, 1], [2, 1]] });
  mapa = aplicarComando(mapa, { tipo: 'terreno.pintar', material: 'grama', celulas: [[3, 1]] });
  const celulas: [number, number][] = [[1, 1], [2, 1], [3, 1], [4, 1]];
  const subir = comandoDaEtapaDeAgua(mapa, { material: 'agua.pantano' }, celulas);
  assert.equal(subir?.tipo, 'terreno.pintar'); assert.equal((subir as { lembrar?: boolean }).lembrar, true);
  const troca = comandoDaEtapaDeAgua(mapa, { material: 'agua.pantano', acao: 'baixar', deixar: 'lama' }, celulas);
  assert.deepEqual(troca, { tipo: 'terreno.pintar', material: 'lama', celulas: [[1, 1], [2, 1]] });
  const apaga = comandoDaEtapaDeAgua(mapa, { material: 'agua.pantano', acao: 'baixar' }, celulas);
  assert.deepEqual(apaga, { tipo: 'terreno.emergir', material: 'agua.pantano', celulas: [[1, 1], [2, 1]] });
  assert.equal(comandoDaEtapaDeAgua(mapa, { material: 'agua.pantano', acao: 'baixar' }, [[3, 1]]), null);
  // aplicado: a grama fica intocada e a lama toma o lugar da água
  const depois = aplicarComando(mapa, troca!);
  const de = (mat: string) => Object.values(depois.terrain.layers).find(l => l.material === mat)?.cells;
  assert.equal(de('agua.pantano'), undefined);
  assert.equal(decodificar(de('lama')!).length, 2);
  assert.equal(decodificar(de('grama')!).length, 1);
  const sem = aplicarComando(mapa, apaga!);
  assert.equal(Object.values(sem.terrain.layers).some(l => l.material === 'agua.pantano'), false);
  assert.equal(decodificar(Object.values(sem.terrain.layers).find(l => l.material === 'grama')!.cells).length, 1);
});

test('um momento inteiro é uma entrada de histórico e um desfazer; dois momentos são duas', async () => {
  const store = criarStore(criarMapa());
  const { saidas } = criarSaidas();
  const { relogio } = criarRelogioFalso();
  let n = 0;
  saidas.agua = async (p) => {
    const x = n++;
    store.executar({ tipo: 'terreno.pintar', material: p.material, celulas: [[x, 0]], lembrar: true }, { rotulo: 'Momento: Enchente', fusao: fusaoDoMomento() });
  };
  saidas.luz = () => { store.executar({ tipo: 'mapa.renomear', nome: 'Escuro' }, { rotulo: 'Momento: Enchente', fusao: fusaoDoMomento() }); };
  const momento: Momento = { id: 'm1', nome: 'Enchente', cor: null, passos: [
    { tipo: 'agua', poligono: [[1, 1], [2, 1], [2, 2]], material: 'agua.lago', ms: 100 },
    { tipo: 'luz', ids: ['x'], acao: 'desligar' } as never,
    { tipo: 'agua', poligono: [[1, 1], [2, 1], [2, 2]], material: 'agua.lago', ms: 100 },
  ] };
  const antes = store.documento;
  assert.equal(await tocarMomento('a', momento, saidas, relogio), 'fim');
  assert.equal(store.historico.length, 1);
  assert.notEqual(store.documento, antes);
  store.desfazer();
  assert.equal(JSON.stringify(store.documento.terrain), JSON.stringify(antes.terrain));
  assert.equal(store.documento.name, antes.name);
  assert.equal(fusaoDoMomento(), undefined);
  // dois momentos seguidos: duas entradas
  await tocarMomento('a', momento, saidas, relogio);
  await tocarMomento('a', momento, saidas, relogio);
  assert.equal(store.historico.length, 2);
});

test('transacao com fusao funde na entrada do topo; outro comando no meio quebra a fusão', () => {
  const store = criarStore(criarMapa());
  store.transacao('a', g => { g.aplicar({ tipo: 'mapa.renomear', nome: 'A' }); }, { fusao: 'k' });
  store.executar({ tipo: 'mapa.renomear', nome: 'B' }, { fusao: 'k' });
  store.transacao('c', g => { g.aplicar({ tipo: 'mapa.renomear', nome: 'C' }); }, { fusao: 'k' });
  assert.equal(store.historico.length, 1);
  store.executar({ tipo: 'mapa.renomear', nome: 'D' });
  store.transacao('e', g => { g.aplicar({ tipo: 'mapa.renomear', nome: 'E' }); }, { fusao: 'k' });
  assert.equal(store.historico.length, 3);
});
