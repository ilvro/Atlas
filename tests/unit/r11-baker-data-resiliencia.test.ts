import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { build } from 'esbuild';
import { criarBaker, MAX_FALHAS_DE_WORKER } from '../../src/procedural/baker.ts';
import type { PedidoDeBake } from '../../src/procedural/executar.ts';
import { _usarBakerDasPrevias, COOLDOWN_RESET_BAKER_MS, MAX_PREVIAS, pedirPrevia } from '../../src/ui/previa.ts';
import { ErroDeBackup, importarBackup, lerPacote } from '../../src/data/backup.ts';
import { criarAutosalvamento } from '../../src/data/autosalvamento.ts';
import { abrirRepositorioMapas, type RepositorioMapas } from '../../src/data/repositorio.ts';
import { lerAssado, listarPistas } from '../../src/data/pistas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarRef } from '#mesa';
import { criarStore } from '../../src/state/store.ts';
import { mapaCompleto } from './fixtures.ts';
import { iniciarConstrucaoRemota, type CanalConstrucaoLike } from '../../src/app/construcao-remota.ts';

const g = globalThis as Record<string, unknown>;
const tick = (ms = 10) => new Promise(r => setTimeout(r, ms));
const pedido = (n: number): PedidoDeBake => ({ tipo: 'objeto', receita: 'x', params: {}, seed: n, res: 8, estilo: 'illustrated' });

class WorkerFalso {
  static todos: WorkerFalso[] = [];
  onerror: ((e: { message: string }) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postado: { id: number }[] = [];
  terminado = false;
  constructor() { WorkerFalso.todos.push(this); }
  postMessage(m: { id: number }) { this.postado.push(m); }
  terminate() { this.terminado = true; }
}

async function comWorkersFalsos(fn: () => Promise<void>): Promise<void> {
  const antes = { Worker: g.Worker, OffscreenCanvas: g.OffscreenCanvas };
  g.Worker = WorkerFalso;
  g.OffscreenCanvas = class {};
  WorkerFalso.todos = [];
  try { await fn(); } finally { g.Worker = antes.Worker; g.OffscreenCanvas = antes.OffscreenCanvas; }
}

async function carregarComponenteBundle(caminhoRelativo: string): Promise<Record<string, unknown>> {
  const res = await build({
    stdin: {
      contents: `export * from './${caminhoRelativo}';\nexport { h, render } from 'preact';\nexport { signal } from '@preact/signals';\n`,
      resolveDir: process.cwd(),
      loader: 'ts',
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    jsxImportSource: 'preact',
    alias: { '#mesa': `${process.cwd()}/mesa-core/src/index.ts` },
    loader: { '.ts': 'ts', '.tsx': 'tsx' },
  });
  const codigo = res.outputFiles[0]!.text;
  const url = `data:text/javascript;base64,${Buffer.from(codigo, 'utf8').toString('base64')}`;
  return (await import(url)) as Record<string, unknown>;
}

async function esperarNovoWorker(anterior: number): Promise<WorkerFalso> {
  const limite = Date.now() + 1_000;
  while (Date.now() <= limite) {
    const ultimo = WorkerFalso.todos.at(-1);
    if (WorkerFalso.todos.length > anterior && ultimo && ultimo.postado.length > 0) return ultimo;
    await tick(5);
  }
  throw new Error(`Worker não foi criado a tempo (total=${WorkerFalso.todos.length}, anterior=${anterior})`);
}

const abertos: RepositorioMapas[] = [];
async function abrirRepo(idb = new IDBFactory(), nome = 'atlas-r11:/Atlas/'): Promise<RepositorioMapas> {
  let t = 10_000;
  const r = await abrirRepositorioMapas({ nome, idb, agora: () => ++t });
  abertos.push(r);
  return r;
}
test.after(() => { for (const r of abertos) r.fechar(); });

// ---- 1. baker.ts ----
test('baker: resposta tardia de id desconhecido fecha ImageBitmaps transferidos para não vazar VRAM', async () => {
  await comWorkersFalsos(async () => {
    const baker = criarBaker({ workers: 1, cache: null });
    const p = baker.pedir('a', pedido(1));
    await tick();
    const w = WorkerFalso.todos[0]!;
    const fechados: string[] = [];
    const bmp = (nome: string) => ({ width: 1, height: 1, close: () => { fechados.push(nome); } });

    // Resposta tardia de um worker reutilizado (id que não está em esperando)
    w.onmessage!({
      data: {
        id: 999999,
        ok: true,
        resultado: {
          bitmap: bmp('bitmap'),
          altura: bmp('altura'),
          agua: { bitmap: bmp('agua'), res: 1 },
          normal: bmp('normal'),
          fachada: bmp('fachada'),
        },
      },
    });
    assert.deepEqual(fechados, ['bitmap', 'altura', 'agua', 'normal', 'fachada']);

    // Resposta tardia com ok: false não deve lançar nem afetar o pedido ativo
    w.onmessage!({ data: { id: 999998, ok: false, erro: 'tardio' } });

    w.onmessage!({ data: { id: w.postado[0]!.id, ok: true, resultado: { bitmap: { width: 2, height: 2 } } } });
    const r = await p;
    assert.equal(r.bitmap.width, 2);
    baker.encerrar();
  });
});

// ---- 2. previa.ts ----
test('previa: reseta singleton baker ao quebrar e respeita cooldown para evitar loop infinito', async () => {
  await comWorkersFalsos(async () => {
    const nowOriginal = Date.now;
    const warnOriginal = console.warn;
    let agora = 100_000;
    const agoraStub = () => agora;
    Date.now = agoraStub;
    console.warn = () => {};
    _usarBakerDasPrevias(null);
    try {
      // Quebra o primeiro baker (3 falhas seguidas)
      for (let i = 0; i < MAX_FALHAS_DE_WORKER; i++) {
        const antes = WorkerFalso.todos.length;
        const p = pedirPrevia(`quebra1-${i}`);
        const w = await esperarNovoWorker(antes);
        w.onerror!({ message: 'falha' });
        await assert.rejects(p);
      }
      // Próxima chamada dispara "O worker de pintura quebrou" e reseta o singleton
      await assert.rejects(pedirPrevia('dispara-reset-1'), /O worker de pintura quebrou/);
      await tick();

      // Como estava fora do cooldown, a chamada seguinte cria um baker novo (novo Worker)
      const antesDeRecuperar = WorkerFalso.todos.length;
      const pRecup = pedirPrevia('recupera-2');
      const wRecup = await esperarNovoWorker(antesDeRecuperar);
      assert.equal(WorkerFalso.todos.length, antesDeRecuperar + 1);

      // Agora dentro do cooldown (< 5s): quebra o segundo baker e verifica que NÃO reseta imediatamente
      agora += 1_000;
      wRecup.onerror!({ message: 'falha-2' });
      await assert.rejects(pRecup);
      for (let i = 1; i < MAX_FALHAS_DE_WORKER; i++) {
        const antes = WorkerFalso.todos.length;
        const p = pedirPrevia(`quebra2-${i}`);
        const w = await esperarNovoWorker(antes);
        w.onerror!({ message: 'falha-2' });
        await assert.rejects(p);
      }
      await assert.rejects(pedirPrevia('dentro-cooldown-a'), /O worker de pintura quebrou/);
      await tick();
      const workersDuranteCooldown = WorkerFalso.todos.length;
      await assert.rejects(pedirPrevia('dentro-cooldown-b'), /O worker de pintura quebrou/);
      assert.equal(WorkerFalso.todos.length, workersDuranteCooldown, 'não deve recriar baker durante cooldown');

      // Após passar o cooldown, um erro de worker quebrado volta a permitir reset e recuperação
      agora += COOLDOWN_RESET_BAKER_MS + 100;
      await assert.rejects(pedirPrevia('apos-cooldown'), /O worker de pintura quebrou/);
      await tick();
      const pFinal = pedirPrevia('funciona-depois');
      const wFinal = await esperarNovoWorker(workersDuranteCooldown);
      assert.equal(WorkerFalso.todos.length, workersDuranteCooldown + 1);
      wFinal.onmessage!({ data: { id: wFinal.postado[0]!.id, ok: true, resultado: { bitmap: { width: 4, height: 4 }, origem: [0, 0], res: 72 } } });
      const ok = await pFinal;
      assert.equal(ok.bitmap.width, 4);
    } finally {
      _usarBakerDasPrevias(null);
      Date.now = nowOriginal;
      console.warn = warnOriginal;
    }
  });
});

test('previa: limita cache LRU a MAX_PREVIAS e fecha ImageBitmap ao evictar', async () => {
  const fechados: number[] = [];
  const falso = {
    pedir: (_chave: string, p: { seed: number }) =>
      Promise.resolve({ bitmap: { close: () => { fechados.push(p.seed); } }, origem: [0, 0], res: 72 }),
    repriorizar() {},
    coletar() {},
    pendentes: 0,
    noWorker: true,
    encerrar() {},
  };
  _usarBakerDasPrevias(falso as never);
  try {
    for (let s = 1; s <= MAX_PREVIAS; s++) {
      await pedirPrevia('item', {}, s);
    }
    assert.equal(fechados.length, 0);

    // Reacessa seed=1 para torná-lo mais recente; seed=2 passa a ser o mais antigo
    await pedirPrevia('item', {}, 1);

    // Inserir o 301º deve evictar e fechar o seed=2 (não o 1)
    await pedirPrevia('item', {}, MAX_PREVIAS + 1);
    await tick();
    assert.deepEqual(fechados, [2]);
  } finally {
    _usarBakerDasPrevias(null);
  }
});

// ---- 3. backup.ts ----
test('backup: lerPacote rejeita versao não inteira, zero ou negativa; importarBackup valida assets e isola erros por mapa', async () => {
  for (const v of [0, -1, 1.5, null, '1', 2]) {
    assert.throws(
      () => lerPacote(JSON.stringify({ formato: 'atlas.backup', versao: v, criadoEm: 1, mapas: [], assets: [] })),
      ErroDeBackup,
    );
  }

  const r = await abrirRepo();
  const mapa1 = criarMapa({ id: 'm1', nome: 'Primeiro' });
  const mapa2 = criarMapa({ id: 'm2', nome: 'Segundo' });
  const relAssets = await importarBackup(r, {
    formato: 'atlas.backup',
    versao: 1,
    criadoEm: 1,
    assets: [null, undefined, 42, [], { id: 123 }, { id: 'sem-hash', base64: 'YQ==' }, { id: 'a1', hash: 'h', base64: 'YQ==' }] as never,
    mapas: [mapa1, mapa2],
  });
  assert.equal(relAssets.erros.length, 7);
  assert.deepEqual(relAssets.importados.map(x => x.id), ['m1', 'm2']);

  // Erro de leitura ou gravação (ex.: quota / registro corrompido) em um mapa não aborta os demais
  const obterOriginal = r.obter.bind(r);
  const restaurarOriginal = r.restaurar.bind(r);
  r.obter = async id => {
    if (id === 'm1') throw new Error('registro existente corrompido');
    return obterOriginal(id);
  };
  r.restaurar = async m => {
    if (m.id === 'm2') throw new Error('QuotaExceededError');
    return restaurarOriginal(m);
  };
  const mapa3 = criarMapa({ id: 'm3', nome: 'Terceiro' });
  const relMapas = await importarBackup(r, {
    formato: 'atlas.backup',
    versao: 1,
    criadoEm: 1,
    assets: [],
    mapas: [mapa1, mapa2, mapa3],
  }, { conflito: 'substituir' });
  assert.equal(relMapas.erros.length, 2);
  assert.match(relMapas.erros[0]!.motivo, /corrompido/);
  assert.match(relMapas.erros[1]!.motivo, /QuotaExceededError/);
  assert.deepEqual(relMapas.importados.map(x => x.id), ['m3']);
});

// ---- 4. autosalvamento.ts, repositorio.ts, pistas.ts, tema.ts, construcao-remota.ts ----
function relogioFalso() {
  const tarefas = new Map<number, { fn: () => void; ms: number }>();
  let n = 0;
  return {
    agendar: (fn: () => void, ms: number) => { tarefas.set(++n, { fn, ms }); return n; },
    cancelar: (id: unknown) => { tarefas.delete(id as number); },
    pendentes: () => tarefas.size,
  };
}

test('autosalvamento: captura erros em descartarRascunho/rascunhoParaRecuperar e nunca re-agenda após fechar()', async () => {
  const r = await abrirRepo();
  const salvo = await r.salvar(mapaCompleto());
  const store = criarStore(salvo);
  const rel = relogioFalso();
  const erros: unknown[] = [];

  // 1) descartarRascunho falha ao voltar ao estado limpo -> vira erro e reporta sem unhandled rejection
  const descartarOriginal = r.descartarRascunho.bind(r);
  r.descartarRascunho = async () => { throw new Error('falha descartar'); };
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar, aoErro: e => erros.push(e) });
  store.executar({ tipo: 'mapa.renomear', nome: 'Tmp' });
  store.desfazer();
  await tick(20);
  assert.equal(auto.estado, 'erro');
  assert.equal(erros.length, 1);

  // 2) rascunhoParaRecuperar sobrevive a erro de repo.obter e de repo.descartarRascunho
  await r.salvarRascunho({ ...salvo, name: 'Rascunho' });
  const obterOriginal = r.obter.bind(r);
  r.obter = async () => { throw new Error('mapa salvo corrompido'); };
  const rec = await auto.rascunhoParaRecuperar();
  assert.equal(rec?.rascunho.mapa.name, 'Rascunho');
  assert.equal(rec?.obsoleto, false);

  r.obter = obterOriginal;
  await r.salvarRascunho(salvo); // igual ao gravado -> tenta descartar
  assert.equal(await auto.rascunhoParaRecuperar(), undefined); // não lança mesmo com descartarRascunho falhando
  r.descartarRascunho = descartarOriginal;

  // 3) salvarAgora não re-arma agendarRascunho após fechar()
  let liberar!: () => void;
  const portao = new Promise<void>(ok => { liberar = ok; });
  const salvarOriginal = r.salvar.bind(r);
  r.salvar = async (m, o) => { await portao; return salvarOriginal(m, o); };

  const gravando = auto.salvarAgora();
  await tick(10);
  store.executar({ tipo: 'mapa.notas', texto: 'edicao durante salvar' });
  auto.fechar();
  liberar();
  await gravando;
  assert.equal(rel.pendentes(), 0, 'não deve agendar rascunho depois de fechar()');

  // E uma chamada de salvarAgora depois de fechado retorna cedo sem salvar nem agendar
  let salvouDepois = false;
  r.salvar = async () => { salvouDepois = true; return salvo; };
  await auto.salvarAgora();
  assert.equal(salvouDepois, false);
  assert.equal(rel.pendentes(), 0);
});

test('repositorio: salvar com forcar:true ignora registro corrompido existente', async () => {
  const idb = new IDBFactory();
  const r = await abrirRepo(idb, 'atlas-r11-forcar:/Atlas/');
  const m = mapaCompleto();
  // Grava um registro corrompido direto no IndexedDB
  const db = await new Promise<IDBDatabase>((ok, erro) => {
    const p = idb.open('atlas-r11-forcar:/Atlas/', 1);
    p.onsuccess = () => ok(p.result);
    p.onerror = () => erro(p.error);
  });
  await new Promise<void>((ok, erro) => {
    const tx = db.transaction('mapas', 'readwrite');
    tx.objectStore('mapas').put({ id: m.id, version: 99, revision: 4, grid: 'lixo' });
    tx.oncomplete = () => ok();
    tx.onerror = () => erro(tx.error);
  });
  db.close();

  await assert.rejects(r.obter(m.id));
  await assert.rejects(r.salvar(m));
  const confirmado = await r.salvar(m, { forcar: true });
  assert.equal(confirmado.revision, 5);
  assert.equal((await r.obter(m.id))?.name, m.name);
});

test('pistas: indexedDB.databases rejeitando retorna lista vazia sem erro', async () => {
  const idbOriginal = g.indexedDB as IDBFactory;
  const databasesOriginal = idbOriginal.databases;
  idbOriginal.databases = () => Promise.reject(new Error('databases() indisponível'));
  try {
    assert.deepEqual(await listarPistas(), []);
    assert.equal(await lerAssado('x', 'normal'), undefined);
  } finally {
    idbOriginal.databases = databasesOriginal;
  }
});

test('tema: acesso bloqueado a localStorage (SecurityError) é tratado com segurança', async () => {
  const descOriginal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const winOriginal = g.window;
  const docOriginal = g.document;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('Blocked by sandbox', 'SecurityError'); },
  });
  const props: Record<string, string> = {};
  const dataset: Record<string, string> = {};
  g.document = { documentElement: { style: { setProperty: (k: string, v: string) => { props[k] = v; } }, dataset } };
  g.window = { addEventListener: () => {}, removeEventListener: () => {} };
  try {
    const mod = await import(`../../src/app/tema.ts?r11-sandbox=${Date.now()}`);
    const parar = mod.iniciarTema();
    mod.trocarTema({ id: 'ordem' });
    assert.equal(mod.tema.value.id, 'ordem');
    assert.equal(dataset.tema, 'ordem');
    assert.ok(props['--acento']);
    parar();
  } finally {
    if (descOriginal) Object.defineProperty(globalThis, 'localStorage', descOriginal);
    else delete g.localStorage;
    g.window = winOriginal;
    g.document = docOriginal;
  }
});

test('construcao-remota: location.origin === "null" usa "*" no postMessage do pai', () => {
  const locOriginal = g.location;
  g.location = { origin: 'null', pathname: '/', href: 'about:blank', hash: '' };
  const enviadasPai: { msg: unknown; origem: string }[] = [];
  const canal: CanalConstrucaoLike = { onmessage: null, postMessage() {}, close() {} };
  try {
    const sessaoRemota = iniciarConstrucaoRemota({
      salaId: 'sala-r11',
      criarCanal: () => canal,
      postarPai: (msg, origem) => { enviadasPai.push({ msg, origem }); },
    });
    assert.equal(enviadasPai.length, 1);
    assert.equal(enviadasPai[0]!.origem, '*');
    sessaoRemota.parar();
  } finally {
    g.location = locOriginal;
  }
});

// ---- 5. UI: FaixaDeIniciativa, WidgetsDeTopo, Dock, PreviaDaFicha ----
test('FaixaDeIniciativa: limita cache de retratos e revoga blob URLs ao evictar ou limpar', async () => {
  const revogadas: string[] = [];
  let seq = 0;
  const createOriginal = URL.createObjectURL;
  const revokeOriginal = URL.revokeObjectURL;
  URL.createObjectURL = () => `blob:retrato-${++seq}`;
  URL.revokeObjectURL = (u: string) => { revogadas.push(u); };
  try {
    const mod = await carregarComponenteBundle('src/ui/FaixaDeIniciativa.tsx');
    const MAX_RETRATOS = mod.MAX_RETRATOS as number;
    const urlDoRetrato = mod.urlDoRetrato as (id: string, ler: (id: string) => Promise<Blob | null>) => Promise<string | null>;
    const limparRetratos = mod.limparRetratos as () => void;

    const ler = async (id: string) => new Blob([id]);
    for (let i = 1; i <= MAX_RETRATOS; i++) {
      await urlDoRetrato(`id-${i}`, ler);
    }
    assert.equal(revogadas.length, 0);

    // Reacessar id-1 atualiza LRU; o próximo item evicta id-2 (blob:retrato-2)
    await urlDoRetrato('id-1', ler);
    await urlDoRetrato(`id-${MAX_RETRATOS + 1}`, ler);
    await tick();
    assert.deepEqual(revogadas, ['blob:retrato-2']);

    limparRetratos();
    await tick();
    assert.equal(revogadas.length, MAX_RETRATOS + 1);
  } finally {
    URL.createObjectURL = createOriginal;
    URL.revokeObjectURL = revokeOriginal;
  }
});
