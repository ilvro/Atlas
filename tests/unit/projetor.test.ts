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
  mapaNoProjetorId,
  iniciarPublicacao,
  CANAL_PROJETOR_GLOBAL,
  nomeDoCanalDoProjetor,
  projetorConectado,
  telaEscura,
  type MensagemDoMestre,
} from '../../src/app/projetor.ts';
import {
  cacheDeSessoes,
  obterSessaoParaProjetor,
  projetarAba,
  fecharAbaComSessao,
  sessao,
  servicos,
  sincronizarPublicador,
} from '../../src/app/app.ts';
import { mapaNoProjetorId as mapaNoProjetorIdReexportado, registrarAbaAberta, abasAbertas } from '../../src/app/abas.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { criarSessao, type SessaoDeEdicao } from '../../src/app/sessao.ts';
import type { RepositorioMapas } from '../../src/data/repositorio.ts';

function criarRepoMock(mapas: Record<string, MapaAtlas> = {}): RepositorioMapas {
  const dados = new Map<string, MapaAtlas>(Object.entries(mapas));
  return {
    async listar() { return []; },
    async obter(id: string) { return dados.get(id); },
    async salvar(m: MapaAtlas) { dados.set(m.id, m); return m; },
    async restaurar(m: MapaAtlas) { dados.set(m.id, m); },
    async remover(id: string) { dados.delete(id); },
    async obterRascunho() { return undefined; },
    async salvarRascunho() {},
    async descartarRascunho() {},
    async listarRascunhos() { return []; },
    async salvarAsset() { return { id: 'asset-1', hash: 'hash-1' }; },
    async obterAsset() { return undefined; },
    async listarAssets() { return []; },
    async restaurarAsset() {},
    fechar() {},
  };
}

const esperar = (ms = 15) => new Promise(resolve => setTimeout(resolve, ms));

test('mapaNoProjetorId é reexportado em abas.ts e inicia como null', () => {
  assert.equal(mapaNoProjetorId, mapaNoProjetorIdReexportado);
  mapaNoProjetorId.value = null;
  assert.equal(mapaNoProjetorId.value, null);
});

test('iniciarPublicacao transmite nos dois canais (específico e global) com _seq consistente', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-1', nome: 'Sala do Trono' });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const sess = criarSessao(mapa, repo, { salvo: true });

  const pub = iniciarPublicacao(sess, async () => null);

  const canalEsp = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const canalGlob = new BroadcastChannel(CANAL_PROJETOR_GLOBAL);

  const msgsEsp: (MensagemDoMestre & { _seq?: number })[] = [];
  const msgsGlob: (MensagemDoMestre & { _seq?: number })[] = [];

  canalEsp.onmessage = e => msgsEsp.push(e.data);
  canalGlob.onmessage = e => msgsGlob.push(e.data);

  try {
    // Projetor avisa que conectou
    canalEsp.postMessage({ tipo: 'ola', largura: 1920, altura: 1080, _seq: 1 });
    await esperar(60);

    assert.equal(projetorConectado.value, true);
    assert.ok(msgsEsp.length >= 2, 'deve ter recebido ao menos estado e camera no canal específico');
    assert.ok(msgsGlob.length >= 2, 'deve ter recebido ao menos estado e camera no canal global');

    // Verifica deduplicação por _seq: as mensagens correspondentes possuem o mesmo _seq em ambos os canais
    const estadoEsp = msgsEsp.find(m => m.tipo === 'estado');
    const estadoGlob = msgsGlob.find(m => m.tipo === 'estado');
    assert.ok(estadoEsp && estadoGlob);
    assert.equal(estadoEsp._seq, estadoGlob._seq);

    // Projetor avisa tchau
    canalEsp.postMessage({ tipo: 'tchau', _seq: 2 });
    await esperar(30);

    assert.equal(projetorConectado.value, false);
  } finally {
    pub.parar();
    canalEsp.close();
    canalGlob.close();
    sess.fechar();
  }
});

test('desacoplamento entre aba ativa do editor e mapaNoProjetorId', async () => {
  const mapaA = criarMapa({ id: 'mapa-a', nome: 'Mapa A' });
  const mapaB = criarMapa({ id: 'mapa-b', nome: 'Mapa B' });
  const repo = criarRepoMock({ [mapaA.id]: mapaA, [mapaB.id]: mapaB });

  const sessA = criarSessao(mapaA, repo, { salvo: true });
  const sessB = criarSessao(mapaB, repo, { salvo: true });

  // 1. Sem mapaNoProjetorId, obterSessaoParaProjetor devolve a sessão ativa
  sessao.value = sessA;
  mapaNoProjetorId.value = null;
  assert.equal(obterSessaoParaProjetor(), sessA);

  // 2. Com mapaNoProjetorId apontando para mapaB em cacheDeSessoes
  cacheDeSessoes.set(mapaB.id, sessB);
  mapaNoProjetorId.value = mapaB.id;

  // Editor continua no mapaA, mas o projetor lê a sessão do mapaB!
  assert.equal(sessao.value?.doc.value.id, 'mapa-a');
  assert.equal(mapaNoProjetorId.value, 'mapa-b');
  assert.equal(obterSessaoParaProjetor(), sessB);

  // Trocar o editor para uma terceira sessão não afeta a sessão do projetor
  const mapaC = criarMapa({ id: 'mapa-c', nome: 'Mapa C' });
  const sessC = criarSessao(mapaC, repo, { salvo: true });
  sessao.value = sessC;

  assert.equal(obterSessaoParaProjetor(), sessB);

  // Limpeza
  sessA.fechar();
  sessB.fechar();
  sessC.fechar();
  cacheDeSessoes.clear();
  sessao.value = null;
  mapaNoProjetorId.value = null;
});

test('cacheDeSessoes retém até 3 sessões e protege sessão ativa e mapaNoProjetorId', async () => {
  cacheDeSessoes.clear();
  const repo = criarRepoMock();
  const sessoes: SessaoDeEdicao[] = [];

  for (let i = 1; i <= 4; i++) {
    const m = criarMapa({ id: `m${i}`, nome: `Mapa ${i}` });
    sessoes.push(criarSessao(m, repo, { salvo: true }));
  }

  // Define sessão ativa como m1 e projetor como m2
  sessao.value = sessoes[0]!;
  mapaNoProjetorId.value = 'm2';

  // Adiciona m1, m2 e m3 ao cache
  cacheDeSessoes.set('m1', sessoes[0]!);
  cacheDeSessoes.set('m2', sessoes[1]!);
  cacheDeSessoes.set('m3', sessoes[2]!);
  assert.equal(cacheDeSessoes.size, 3);

  // Através de projetarAba ou sincronização, o cache limita a 3
  // Simulando a adição de m4 via projetarAba com repo mock
  servicos.value = { repo: criarRepoMock({ m4: sessoes[3]!.doc.value }), campanhas: null, barramento: null };
  await projetarAba('m4');

  // m4 agora é mapaNoProjetorId
  assert.equal(mapaNoProjetorId.value, 'm4');
  assert.equal(cacheDeSessoes.size, 3);
  assert.ok(cacheDeSessoes.has('m4'));

  // Limpeza
  for (const s of sessoes) {
    try { s.fechar(); } catch { /* ignora */ }
  }
  cacheDeSessoes.clear();
  sessao.value = null;
  mapaNoProjetorId.value = null;
});

test('fecharAbaComSessao descarrega a sessão do cache e limpa mapaNoProjetorId se correspondente', () => {
  cacheDeSessoes.clear();
  abasAbertas.value = [];

  const mapa = criarMapa({ id: 'mapa-fechar', nome: 'Para Fechar' });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const sess = criarSessao(mapa, repo, { salvo: true });

  registrarAbaAberta(mapa.id, mapa.name);
  cacheDeSessoes.set(mapa.id, sess);
  mapaNoProjetorId.value = mapa.id;

  assert.equal(cacheDeSessoes.has(mapa.id), true);
  assert.equal(mapaNoProjetorId.value, mapa.id);

  fecharAbaComSessao(mapa.id);

  assert.equal(cacheDeSessoes.has(mapa.id), false);
  assert.equal(mapaNoProjetorId.value, null);
  assert.equal(abasAbertas.value.some(a => a.id === mapa.id), false);
});

test('publicador: tela e letreiro só enviam com projetor conectado; ola reenvia cortina escura', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-tela', nome: 'Sala do Trono' });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const sess = criarSessao(mapa, repo, { salvo: true });
  const pub = iniciarPublicacao(sess, async () => null);

  const canalEsp = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const msgsEsp: (MensagemDoMestre & { _seq?: number })[] = [];
  canalEsp.onmessage = e => msgsEsp.push(e.data);

  try {
    // 1. Desconectado: tela e letreiro não transmitem, mas telaEscura acompanha
    assert.equal(projetorConectado.value, false);
    assert.equal(telaEscura.value, false);

    pub.tela('escurecer', 800);
    assert.equal(telaEscura.value, true);
    pub.letreiro({
      tipo: 'letreiro',
      titulo: 'Kian',
      subtitulo: 'O Primeiro',
      peca: null,
      estilo: 'apresentacao',
      ms: 4000,
    });
    pub.letreiro(null);

    await esperar(30);
    assert.equal(msgsEsp.length, 0, 'nenhuma mensagem deve ser enviada sem projetor conectado');

    // 2. Projetor conecta com 'ola': deve receber estado, câmera E a cortina escura reenviada
    canalEsp.postMessage({ tipo: 'ola', largura: 1920, altura: 1080, _seq: 1 });
    await esperar(60);

    assert.equal(projetorConectado.value, true);
    const msgTela = msgsEsp.find(m => m.tipo === 'tela');
    assert.ok(msgTela, 'deve ter reenviado a cortina escura no ola');
    assert.equal(msgTela.tipo, 'tela');
    assert.equal((msgTela as any).acao, 'escurecer');
    assert.equal((msgTela as any).ms, 800);

    // 3. Conectado: tela clarear envia mensagem e atualiza telaEscura
    msgsEsp.length = 0;
    pub.tela('clarear', 300);
    await esperar(30);

    assert.equal(telaEscura.value, false);
    assert.equal(msgsEsp.some(m => m.tipo === 'tela' && (m as any).acao === 'clarear'), true);

    // 4. letreiro-fim quando l === null
    msgsEsp.length = 0;
    pub.letreiro(null);
    await esperar(30);
    assert.equal(msgsEsp.some(m => m.tipo === 'letreiro-fim'), true);
  } finally {
    pub.parar();
    canalEsp.close();
    sess.fechar();
    assert.equal(telaEscura.value, false);
  }
});

test('publicador: retrato é enviado antes do letreiro quando a peça tem portrait', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-letreiro', nome: 'Sala do Trono' });
  const assetRetrato = new Blob(['imagem-de-teste'], { type: 'image/png' });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const sess = criarSessao(mapa, repo, { salvo: true });
  const pub = iniciarPublicacao(sess, async id => (id === 'asset-retrato-1' ? assetRetrato : null));

  const canalEsp = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const msgsEsp: (MensagemDoMestre & { _seq?: number })[] = [];
  canalEsp.onmessage = e => msgsEsp.push(e.data);

  try {
    // Conecta projetor
    canalEsp.postMessage({ tipo: 'ola', largura: 1920, altura: 1080, _seq: 1 });
    await esperar(60);

    msgsEsp.length = 0;

    // Adiciona peça com portrait que ainda não teve o retrato enviado
    sess.store.executar({
      tipo: 'item.adicionar',
      colecao: 'tokens',
      item: {
        id: 'token-vilao',
        name: 'Vilão',
        position: [5, 5],
        size: 1,
        facing: 'down',
        sprite: null,
        player: false,
        vision: { radius: 0, dark: false },
        lightId: null,
        figure: { state: 'normal' },
        refs: [],
        portrait: { id: 'asset-retrato-1', hash: 'hash-12345678' },
      },
    });

    // Dispara letreiro apontando para a peça com retrato
    pub.letreiro({
      tipo: 'letreiro',
      titulo: 'O Inimigo',
      subtitulo: 'Ameaça Suprema',
      peca: 'token-vilao',
      estilo: 'apresentacao',
      ms: 5000,
    });

    await esperar(60);

    const idxRetrato = msgsEsp.findIndex(m => m.tipo === 'retrato' && (m as any).id === 'asset-retrato-1');
    const idxLetreiro = msgsEsp.findIndex(m => m.tipo === 'letreiro' && (m as any).titulo === 'O Inimigo');

    assert.ok(idxRetrato !== -1, 'deve ter enviado o retrato');
    assert.ok(idxLetreiro !== -1, 'deve ter enviado o letreiro');
    assert.ok(idxRetrato < idxLetreiro, 'o retrato DEVE ser enviado antes do letreiro');
    assert.equal((msgsEsp[idxLetreiro] as any).retrato, 'asset-retrato-1');
  } finally {
    pub.parar();
    canalEsp.close();
    sess.fechar();
  }
});
