import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mocks mínimos para ambiente Node (antes de importar módulos de app)
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
  globalThis.location = { hash: '', pathname: '/', href: 'http://localhost/', origin: 'http://localhost' } as any;
}
if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    open: () => null,
  } as any;
}

import { acaoPorId, buscarAcoes, executarAcao } from '../../src/app/acoes.ts';
import { alternarModo, iniciar, iniciarModoConstrucaoRemota, servicos } from '../../src/app/app.ts';
import {
  canalConstrucaoDaSala,
  criarRepositorioMemoria,
  emConstrucaoRemota,
  iniciarConstrucaoRemota,
  type CanalConstrucaoLike,
} from '../../src/app/construcao-remota.ts';
import { modo } from '../../src/app/modo.ts';
import { formatarRota, lerRota, rota } from '../../src/app/rotas.ts';
import { sessao, type SessaoDeEdicao } from '../../src/app/sessao.ts';
import { ErroDeConflito } from '../../src/data/repositorio.ts';
import { novaLuz } from '../../src/domain/fabrica.ts';
import { criarMapa, VERSAO_MAPA } from '../../src/domain/mapa.ts';

function criarCanalFalso(): {
  canal: CanalConstrucaoLike;
  enviadas: unknown[];
  entregar: (msg: unknown) => void;
  fechado: () => boolean;
} {
  const enviadas: unknown[] = [];
  let fechado = false;
  const canal: CanalConstrucaoLike = {
    onmessage: null,
    postMessage(msg: unknown) {
      enviadas.push(msg);
    },
    close() {
      fechado = true;
      canal.onmessage = null;
    },
  };
  return {
    canal,
    enviadas,
    entregar(msg: unknown) {
      if (!fechado) canal.onmessage?.({ data: msg });
    },
    fechado: () => fechado,
  };
}

test('rotas: lerRota e formatarRota suportam construir-remoto e emConstrucaoRemota acompanha rota', () => {
  const antiga = rota.value;
  try {
    assert.deepEqual(lerRota('#/construir-remoto/sala-1'), { tipo: 'construir-remoto', sala: 'sala-1' });
    assert.deepEqual(lerRota('#/construir-remoto/Sala_ABC-99'), { tipo: 'construir-remoto', sala: 'Sala_ABC-99' });
    assert.equal(formatarRota({ tipo: 'construir-remoto', sala: 'sala-1' }), '#/construir-remoto/sala-1');
    assert.deepEqual(lerRota(formatarRota({ tipo: 'construir-remoto', sala: 'mesa_42' })), {
      tipo: 'construir-remoto',
      sala: 'mesa_42',
    });

    for (const ruim of [
      '#/construir-remoto',
      '#/construir-remoto/',
      '#/construir-remoto/sala-1/extra',
      '#/construir-remoto/sala com espaco',
    ]) {
      assert.equal(lerRota(ruim).tipo, 'desconhecida', ruim);
    }

    rota.value = lerRota('#/construir-remoto/sala-1');
    assert.equal(emConstrucaoRemota.value, true);
    rota.value = lerRota('#/projetor-remoto/sala-1');
    assert.equal(emConstrucaoRemota.value, false);
    rota.value = lerRota('#/');
    assert.equal(emConstrucaoRemota.value, false);
  } finally {
    rota.value = antiga;
  }
});

test('canalConstrucaoDaSala usa o prefixo isolado da sala', () => {
  assert.equal(canalConstrucaoDaSala('sala-1'), 'sala:sala-1:atlas:construcao');
  assert.equal(canalConstrucaoDaSala('abc_99'), 'sala:abc_99:atlas:construcao');
});

test('criarRepositorioMemoria: opera em memória sem IndexedDB, trata conflitos, rascunhos e assets', async () => {
  const repo = criarRepositorioMemoria();
  try {
    const mapa = criarMapa({ id: 'mem-1', nome: 'Taverna Remota' });
    assert.deepEqual(await repo.listar(), []);
    assert.equal(await repo.obter('mem-1'), undefined);

    const salvo1 = await repo.salvar(mapa);
    assert.equal(salvo1.revision, 1);
    assert.equal((await repo.obter('mem-1'))?.name, 'Taverna Remota');
    assert.equal((await repo.listar()).length, 1);

    const salvo2 = await repo.salvar({ ...salvo1, name: 'Taverna Atualizada' });
    assert.equal(salvo2.revision, 2);

    await assert.rejects(
      repo.salvar({ ...salvo1, name: 'Desatualizado' }),
      (e: unknown) => e instanceof ErroDeConflito && e.atual.name === 'Taverna Atualizada',
    );
    const forcado = await repo.salvar({ ...salvo1, name: 'Forçado' }, { forcar: true });
    assert.equal(forcado.revision, 3);

    await repo.salvarRascunho({ ...forcado, name: 'Rascunho Local' });
    assert.equal((await repo.obterRascunho('mem-1'))?.mapa.name, 'Rascunho Local');
    assert.equal((await repo.listarRascunhos()).length, 1);
    await repo.descartarRascunho('mem-1');
    assert.equal(await repo.obterRascunho('mem-1'), undefined);

    await repo.restaurar({ ...forcado, name: 'Restaurado' });
    assert.equal((await repo.obter('mem-1'))?.name, 'Restaurado');

    const refAsset = await repo.salvarAsset(new Blob(['imagem-remota'], { type: 'image/png' }));
    assert.equal(refAsset.id, refAsset.hash.slice(0, 32));
    assert.equal((await repo.listarAssets()).length, 1);
    assert.equal(await (await repo.obterAsset(refAsset.id))?.blob.text(), 'imagem-remota');
    await assert.rejects(
      repo.restaurarAsset({
        id: refAsset.id,
        hash: refAsset.hash,
        tipo: 'image/png',
        blob: new Blob(['adulterado']),
        criadoEm: 1,
      }),
      /não bate com o hash/,
    );

    await repo.remover('mem-1');
    assert.equal(await repo.obter('mem-1'), undefined);
  } finally {
    repo.fechar();
  }
});

test('iniciarConstrucaoRemota: anuncia pronto, abre mapa com ops (tolerando conflitos) e limpa ao receber construcao.fechada', () => {
  const canaisAbertos: string[] = [];
  const falso = criarCanalFalso();
  const avisosPai: { msg: unknown; origem: string }[] = [];
  const antigaRota = rota.value;
  rota.value = lerRota('#/construir-remoto/sala-1');
  modo.value = 'sessao';

  const ponte = iniciarConstrucaoRemota({
    salaId: 'sala-1',
    criarCanal: nome => {
      canaisAbertos.push(nome);
      return falso.canal;
    },
    postarPai: (msg, origem) => {
      avisosPai.push({ msg, origem });
    },
    origemPai: 'https://mesa.exemplo',
  });

  try {
    assert.deepEqual(canaisAbertos, ['sala:sala-1:atlas:construcao']);
    assert.deepEqual(falso.enviadas, [{ tipo: 'atlas-construcao.pronto' }]);
    assert.deepEqual(avisosPai, [
      { msg: { tipo: 'atlas-construcao.pronto' }, origem: 'https://mesa.exemplo' },
    ]);
    assert.equal(sessao.value, null);

    // Envia mapa em versão 7 (sem moments) para validar migração via lerMapa + ops com comando conflitante no meio
    const base = criarMapa({ id: 'mapa-remoto-1', nome: 'Porão' }) as unknown as Record<string, unknown>;
    base.version = 7;
    delete base.moments;

    const luz = novaLuz([4, 4]);
    falso.entregar({
      tipo: 'construcao.estado',
      rev: 0,
      mapa: base,
      ops: [
        {
          rev: 2,
          opId: 'op-2',
          comandos: [
            // Comando inválido/conflitante (item inexistente -> ErroDeComando) deve ser tolerado
            { tipo: 'item.remover', colecao: 'props', id: 'nao-existe' },
            { tipo: 'item.adicionar', colecao: 'lights', item: luz },
          ],
        },
        {
          rev: 1,
          opId: 'op-1',
          comandos: [{ tipo: 'mapa.renomear', nome: 'Porão Colaborativo' }],
        },
      ],
    });

    const aberta: SessaoDeEdicao | null = sessao.peek();
    assert.ok(aberta, 'deve inicializar a sessão após construcao.estado');
    assert.equal(modo.value, 'construir');
    assert.equal(aberta.doc.value.id, 'mapa-remoto-1');
    assert.equal(aberta.doc.value.version, VERSAO_MAPA);
    assert.equal(aberta.doc.value.name, 'Porão Colaborativo');
    assert.ok(aberta.doc.value.lights[luz.id], 'luz adicionada pela op-2 deve existir');
    assert.equal(ponte.rev, 2);
    assert.equal(ponte.mapaId, 'mapa-remoto-1');

    // Novo estado no mesmo mapa substitui o documento sem quebrar a sessão
    const atualizado = criarMapa({ id: 'mapa-remoto-1', nome: 'Porão Renovado' });
    falso.entregar({
      tipo: 'construcao.estado',
      rev: 5,
      mapa: atualizado,
      ops: [],
    });
    const atualizada: SessaoDeEdicao | null = sessao.peek();
    assert.equal(atualizada?.doc.value.name, 'Porão Renovado');
    assert.equal(atualizada?.doc.value.lights[luz.id], undefined);
    assert.equal(ponte.rev, 5);

    // Fechamento da construção limpa a sessão e volta para espera limpa
    falso.entregar({ tipo: 'construcao.fechada' });
    assert.equal(sessao.peek(), null);
    assert.equal(ponte.mapaId, null);
    assert.equal(ponte.rev, 0);
  } finally {
    ponte.parar();
    assert.equal(falso.fechado(), true);
    rota.value = antigaRota;
    modo.value = 'construir';
  }
});

test('modo construir-remoto: iniciar() não abre IndexedDB, trava modo em construir e desabilita ações locais/sessão', async () => {
  const antigaRota = rota.value;
  const idbOriginal = globalThis.indexedDB;
  const bcOriginal = globalThis.BroadcastChannel;
  const canais: { nome: string; mensagens: unknown[]; fechado: boolean; entregar: (msg: unknown) => void }[] = [];

  class BroadcastChannelFalso {
    onmessage: ((ev: { data: unknown }) => void) | null = null;
    private registro: { nome: string; mensagens: unknown[]; fechado: boolean; entregar: (msg: unknown) => void };
    constructor(nome: string) {
      this.registro = {
        nome,
        mensagens: [],
        fechado: false,
        entregar: msg => {
          if (!this.registro.fechado) this.onmessage?.({ data: msg });
        },
      };
      canais.push(this.registro);
    }
    postMessage(msg: unknown) {
      this.registro.mensagens.push(msg);
    }
    close() {
      this.registro.fechado = true;
      this.onmessage = null;
    }
  }

  let abrirIdbChamado = false;
  (globalThis as any).indexedDB = {
    open() {
      abrirIdbChamado = true;
      throw new Error('IndexedDB não deve ser aberto em construir-remoto');
    },
    databases() {
      abrirIdbChamado = true;
      throw new Error('IndexedDB não deve ser consultado em construir-remoto');
    },
  };
  (globalThis as any).BroadcastChannel = BroadcastChannelFalso;

  try {
    rota.value = lerRota('#/construir-remoto/sala-lock');
    await iniciar();

    assert.equal(abrirIdbChamado, false);
    assert.ok(servicos.value, 'servicos deve estar preenchido com repositório em memória');
    assert.equal(servicos.value.campanhas, null);
    assert.equal(servicos.value.barramento, null);
    assert.equal(canais[0]?.nome, 'sala:sala-lock:atlas:construcao');

    const primeiro = canais[0]!;
    assert.deepEqual(primeiro.mensagens, [{ tipo: 'atlas-construcao.pronto' }]);

    // Simula chegada de estado pelo canal da sala aberto por iniciar()
    const mapa = criarMapa({ id: 'm-lock', nome: 'Sala Travada' });
    primeiro.entregar({ tipo: 'construcao.estado', rev: 0, mapa, ops: [] });
    assert.equal(sessao.value?.doc.value.id, 'm-lock');

    assert.equal(modo.value, 'construir');
    alternarModo();
    assert.equal(modo.value, 'construir');

    // Mesmo tentando forçar o signal de modo, o effect do app trava em 'construir'
    modo.value = 'sessao';
    assert.equal(modo.value, 'construir');

    // Ações de alternar modo / galeria / gravar / novo mapa ficam desabilitadas
    const idsDisponiveis = new Set(buscarAcoes('').map(a => a.id));
    assert.equal(idsDisponiveis.has('modo'), false);
    assert.equal(idsDisponiveis.has('galeria'), false);
    assert.equal(idsDisponiveis.has('gravar'), false);
    assert.equal(idsDisponiveis.has('novo-mapa'), false);
    assert.equal(idsDisponiveis.has('desfazer'), true);
    assert.equal(idsDisponiveis.has('telhados-no-editor'), true);

    // Chamar executarAcao em 'modo' não muda o modo
    const acaoModo = acaoPorId('modo');
    assert.ok(acaoModo);
    executarAcao(acaoModo);
    assert.equal(modo.value, 'construir');
  } finally {
    const limpar = iniciarModoConstrucaoRemota('cleanup');
    limpar();
    assert.equal(canais[0]?.fechado, true);
    rota.value = antigaRota;
    sessao.value = null;
    servicos.value = null;
    modo.value = 'construir';
    (globalThis as any).indexedDB = idbOriginal;
    (globalThis as any).BroadcastChannel = bcOriginal;
  }
});
