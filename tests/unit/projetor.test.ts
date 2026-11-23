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
  CANAL_PROJETOR_REMOTO,
  projetorRemotoConectado,
  nomeDoCanalDoProjetor,
  projetorConectado,
  seguirJogadores,
  jogadorSeguido,
  caixaDoProjetor,
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

test('publicador: seguir jogadores sincroniza no ola, ao ligar depois, e solta quando o projetor avisa soltou', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-seguir', nome: 'Arena' });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const sess = criarSessao(mapa, repo, { salvo: true });
  sess.store.executar({
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      id: 'heroi',
      name: 'Herói',
      position: [4.5, 4.5],
      size: 1,
      facing: 'down',
      portrait: null,
      sprite: null,
      player: true,
      vision: { radius: 18, dark: false },
      lightId: null,
      figure: { state: 'normal' },
      refs: [],
      hp: null,
    },
  });

  seguirJogadores.value = true;
  const pub = iniciarPublicacao(sess, async () => null);
  const canalEsp = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const msgs: MensagemDoMestre[] = [];
  canalEsp.onmessage = e => msgs.push(e.data);

  try {
    canalEsp.postMessage({ tipo: 'ola', largura: 1600, altura: 900, _seq: 1 });
    await esperar(60);

    const camInicial = msgs.filter((m): m is Extract<MensagemDoMestre, { tipo: 'camera' }> => m.tipo === 'camera').at(-1);
    assert.ok(camInicial?.seguir, 'camera enviada no ola deve marcar seguir: true');
    const caixaAntes = { ...camInicial!.caixa };

    // Redimensionar com seguir ativo continua seguindo os jogadores e mantém seguir: true
    msgs.length = 0;
    canalEsp.postMessage({ tipo: 'tamanho', largura: 1200, altura: 900, _seq: 2 });
    await esperar(50);
    const camResize = msgs.filter((m): m is Extract<MensagemDoMestre, { tipo: 'camera' }> => m.tipo === 'camera').at(-1);
    assert.equal(camResize?.seguir, true);

    // Projetor solta manualmente (roda/arrasto) -> mestre desativa seguirJogadores
    canalEsp.postMessage({ tipo: 'soltou', _seq: 3 });
    await esperar(40);
    assert.equal(seguirJogadores.value, false, 'soltou do projetor deve desligar seguirJogadores no mestre');

    // Mestre move o jogador enquanto desligado: câmera não deve seguir
    msgs.length = 0;
    sess.store.executar({ tipo: 'peca.mover', id: 'heroi', para: [20.25, 14.25] });
    await esperar(50);
    assert.equal(msgs.some(m => m.tipo === 'camera'), false, 'não envia camera quando seguirJogadores está false');

    // Mestre religa seguirJogadores: enquadra a nova posição e envia seguir: true para reatar o projetor
    seguirJogadores.value = true;
    await esperar(50);
    const camReatada = msgs.filter((m): m is Extract<MensagemDoMestre, { tipo: 'camera' }> => m.tipo === 'camera').at(-1);
    assert.equal(camReatada?.seguir, true, 'religar seguirJogadores deve enviar seguir: true');
    assert.notDeepEqual(caixaDoProjetor.value, caixaAntes);
    assert.ok((camReatada!.caixa.x0 + camReatada!.caixa.x1) / 2 > 15, 'câmera acompanhou a nova posição do jogador');
  } finally {
    seguirJogadores.value = false;
    pub.parar();
    canalEsp.close();
    sess.fechar();
  }
});

test('publicador: seguir um jogador específico enquadra só a peça dele', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-um-jogador', nome: 'Arena' });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const sess = criarSessao(mapa, repo, { salvo: true });
  const peca = (id: string, x: number) => ({ id, name: id, position: [x, 10.5] as [number, number], size: 1, facing: 'down' as const, portrait: null, sprite: null, player: true, vision: { radius: 18, dark: false }, lightId: null, figure: { state: 'normal' as const }, refs: [], hp: null });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca('a', 4.5) });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca('b', 40.5) });
  seguirJogadores.value = true;
  jogadorSeguido.value = 'b';
  const pub = iniciarPublicacao(sess, async () => null);
  const canalEsp = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const msgs: MensagemDoMestre[] = [];
  canalEsp.onmessage = e => msgs.push(e.data);
  try {
    canalEsp.postMessage({ tipo: 'ola', largura: 1600, altura: 900, _seq: 1 });
    await esperar(60);
    const cam = msgs.filter((m): m is Extract<MensagemDoMestre, { tipo: 'camera' }> => m.tipo === 'camera').at(-1);
    assert.ok(cam?.seguir);
    assert.ok(Math.abs((cam!.caixa.x0 + cam!.caixa.x1) / 2 - 40.5) < 0.01, 'centrada no jogador b');
    assert.ok(cam!.caixa.x1 - cam!.caixa.x0 < 30, 'não enquadra o grupo todo');
  } finally {
    seguirJogadores.value = false; jogadorSeguido.value = null;
    pub.parar(); canalEsp.close(); sess.fechar();
  }
});

test('publicador: arrastar peça em movimento livre (gesto) envia câmera e estado em tempo real ao projetor', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-freeform', nome: 'Arena' });
  const repo = criarRepoMock({ [mapa.id]: mapa });
  const sess = criarSessao(mapa, repo, { salvo: true });
  sess.store.executar({
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      id: 'heroi',
      name: 'Herói',
      position: [4.5, 4.5],
      size: 1,
      facing: 'down',
      portrait: null,
      sprite: null,
      player: true,
      vision: { radius: 18, dark: false },
      lightId: null,
      figure: { state: 'normal' },
      refs: [],
      hp: null,
    },
  });
  seguirJogadores.value = true;
  const pub = iniciarPublicacao(sess, async () => null);
  const canalEsp = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const msgs: MensagemDoMestre[] = [];
  canalEsp.onmessage = e => msgs.push(e.data);
  try {
    canalEsp.postMessage({ tipo: 'ola', largura: 1600, altura: 900, _seq: 1 });
    await esperar(60);
    msgs.length = 0;

    // Simula arrasto contínuo em freeform (com gesto ativo)
    const gesto = sess.store.iniciarGesto('Mover peça');
    gesto.aplicar({ tipo: 'peca.mover', id: 'heroi', para: [10.3, 6.8], semGrade: true, emArrasto: true });
    await esperar(30);

    // Ainda antes de concluir o gesto, o projetor já recebeu peca-gesto leve com posição e câmera em tempo real
    const msgGesto = msgs.filter((m): m is Extract<MensagemDoMestre, { tipo: 'peca-gesto' }> => m.tipo === 'peca-gesto').at(-1);
    assert.ok(msgGesto, 'enviou mensagem leve peca-gesto durante o arrasto');
    assert.deepEqual(msgGesto!.position, [10.3, 6.8]);
    assert.ok(msgGesto!.caixa, 'incluiu a câmera da peça seguida');
    assert.equal(msgGesto!.seguir, true);
    assert.ok(Math.abs((msgGesto!.caixa!.x0 + msgGesto!.caixa!.x1) / 2 - 10.3) < 0.01);

    gesto.concluir();
    assert.equal(sess.store.historico.length, 2, 'adicionar + 1 entrada para o arrasto todo');
  } finally {
    seguirJogadores.value = false;
    pub.parar(); canalEsp.close(); sess.fechar();
  }
});

test('publicador: destinos local e remoto são separados, e só o remoto recebe a projeção remota', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-remoto', nome: 'Cripta Secreta' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 4]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  const pub = iniciarPublicacao(sess, async () => null);
  const local = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgsLocal: any[] = [], msgsRemoto: any[] = [];
  local.onmessage = e => msgsLocal.push(e.data);
  remoto.onmessage = e => msgsRemoto.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1920, altura: 1080, remoto: true, _seq: 1 });
    await esperar(60);
    assert.equal(projetorRemotoConectado.value, true);
    assert.equal(projetorConectado.value, false, 'o ola remoto não liga o projetor local');
    assert.equal(msgsLocal.length, 0, 'nada vai ao canal local');
    const estadoRemoto = msgsRemoto.find(m => m.tipo === 'estado');
    assert.ok(estadoRemoto, 'o remoto recebe o estado');
    assert.equal(estadoRemoto.doc.name, 'Mapa', 'e é a projeção remota');
    assert.ok(msgsRemoto.some(m => m.tipo === 'camera'));
    assert.ok(!msgsRemoto.some(m => m.tipo === 'aviso-sem-nevoa'), 'com névoa não há aviso');

    local.postMessage({ tipo: 'ola', largura: 1280, altura: 720, _seq: 1 });
    await esperar(60);
    assert.equal(projetorConectado.value, true);
    assert.equal(msgsLocal.find(m => m.tipo === 'estado').doc.name, 'Cripta Secreta', 'o local segue com a projeção de hoje');

    local.postMessage({ tipo: 'tchau', _seq: 2 });
    await esperar(30);
    assert.equal(projetorConectado.value, false);
    assert.equal(projetorRemotoConectado.value, true, 'o tchau local não desliga o remoto');

    local.postMessage({ tipo: 'ola', largura: 1280, altura: 720, _seq: 3 });
    await esperar(30);
    remoto.postMessage({ tipo: 'tchau', _seq: 2 });
    await esperar(30);
    assert.equal(projetorRemotoConectado.value, false);
    assert.equal(projetorConectado.value, true, 'o tchau remoto não desliga o local');
  } finally {
    pub.parar(); local.close(); remoto.close(); sess.fechar();
  }
});

test('publicador: sem névoa e com destino remoto, avisa a ponte uma vez por mapa', async () => {
  const mapa = criarMapa({ id: 'mapa-sem-nevoa', nome: 'Aberto' });
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1920, altura: 1080, remoto: true, _seq: 1 });
    await esperar(60);
    remoto.postMessage({ tipo: 'tamanho', largura: 1000, altura: 600, _seq: 2 });
    await esperar(60);
    const avisos = msgs.filter(m => m.tipo === 'aviso-sem-nevoa');
    assert.equal(avisos.length, 1);
    assert.equal(avisos[0].mapa, 'mapa-sem-nevoa');
    assert.ok(msgs.findIndex(m => m.tipo === 'aviso-sem-nevoa') < msgs.findIndex(m => m.tipo === 'estado'), 'o aviso vem antes do estado');
  } finally {
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('projetor remoto: só o canal da sala, e só diz "ola"', async () => {
  const { canaisDoProjetor, nomeDoCanalDaSala, projetorPodeDizer } = await import('../../src/app/projetor.ts');
  assert.deepEqual(canaisDoProjetor('casa', 'abc123'), ['sala:abc123:atlas:projetor']);
  assert.equal(nomeDoCanalDaSala('abc123'), 'sala:abc123:atlas:projetor');
  assert.deepEqual(canaisDoProjetor('casa'), ['atlas:projetor:casa', 'atlas:projetor:ativo']);
  for (const canal of canaisDoProjetor('casa', 'abc123')) assert.ok(!['atlas:projetor:ativo', 'atlas:projetor:remoto', 'atlas:projetor:casa'].includes(canal));
  assert.equal(projetorPodeDizer({ tipo: 'ola' }, true), true);
  for (const tipo of ['tamanho', 'soltou', 'tchau']) { assert.equal(projetorPodeDizer({ tipo }, true), false); assert.equal(projetorPodeDizer({ tipo }, false), true); }
});

test('projetor remoto: o cômodo sem nome (não revelado) ganha um nome neutro e o mapa passa em validarMapa', async () => {
  const { prepararDocRemoto } = await import('../../src/app/projetor.ts');
  const { criarMapa } = await import('../../src/domain/mapa.ts');
  const { validarMapa } = await import('../../src/domain/validacao.ts');
  const m = criarMapa({ id: 'm', nome: 'Mapa' });
  const comodo = { id: 'A', name: '', function: null, cells: [], floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null };
  const doc = { ...m, rooms: { A: comodo as never } };
  assert.throws(() => validarMapa(doc));
  const pronto = prepararDocRemoto(doc);
  assert.doesNotThrow(() => validarMapa(pronto));
  assert.equal(pronto.rooms.A!.name.length > 0, true);
  assert.equal(prepararDocRemoto(m), m, 'sem cômodo vazio, devolve o mesmo objeto');
});
