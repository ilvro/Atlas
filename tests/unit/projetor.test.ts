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
  fichaProjetadaId,
  projetarFicha,
  forcarCameraRemota,
  type MensagemDoMestre,
} from '../../src/app/projetor.ts';
import {
  cacheDeSessoes,
  obterSessaoParaProjetor,
  obterStorePorMapaId,
  projetarAba,
  fecharAbaComSessao,
  sessao,
  servicos,
  sincronizarPublicador,
} from '../../src/app/app.ts';
import { mapaNoProjetorId as mapaNoProjetorIdReexportado, registrarAbaAberta, abasAbertas } from '../../src/app/abas.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { novaLuz } from '../../src/domain/fabrica.ts';
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

test('publicador: mudança invisível ao jogador (notas) não reenvia o estado remoto; mudança visível reenvia', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-redundante', nome: 'Cripta' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 4]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  const estados = () => msgs.filter(m => m.tipo === 'estado').length;
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1920, altura: 1080, remoto: true, _seq: 1 });
    await esperar(80);
    const inicial = estados();
    assert.ok(inicial >= 1);

    sess.store.executar({ tipo: 'mapa.notas', texto: 'o mestre anotou algo' });
    await esperar(250);
    assert.equal(estados(), inicial, 'notas não vão ao remoto, então o estado não é reenviado');

    sess.store.executar({ tipo: 'limites.atualizar', largura: 40, altura: 40 });
    await esperar(250);
    assert.ok(estados() > inicial, 'uma mudança que o jogador vê é enviada');
  } finally {
    pub.parar(); remoto.close(); sess.fechar();
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

test('projetor remoto: só o canal da sala, e só diz "ola" e "pedir-retrato"', async () => {
  const { canaisDoProjetor, nomeDoCanalDaSala, projetorPodeDizer } = await import('../../src/app/projetor.ts');
  assert.deepEqual(canaisDoProjetor('casa', 'abc123'), ['sala:abc123:atlas:projetor']);
  assert.equal(nomeDoCanalDaSala('abc123'), 'sala:abc123:atlas:projetor');
  assert.deepEqual(canaisDoProjetor('casa'), ['atlas:projetor:casa', 'atlas:projetor:ativo']);
  for (const canal of canaisDoProjetor('casa', 'abc123')) assert.ok(!['atlas:projetor:ativo', 'atlas:projetor:remoto', 'atlas:projetor:casa'].includes(canal));
  assert.equal(projetorPodeDizer({ tipo: 'ola' }, true), true);
  assert.equal(projetorPodeDizer({ tipo: 'pedir-retrato' }, true), true);
  assert.equal(projetorPodeDizer({ tipo: 'alternar-porta' }, true), true);
  for (const tipo of ['tamanho', 'soltou', 'tchau']) { assert.equal(projetorPodeDizer({ tipo }, true), false); assert.equal(projetorPodeDizer({ tipo }, false), true); }
});

test('projetor remoto: o cômodo não revelado já sai com nome neutro e a projeção remota passa em validarMapa', async () => {
  const { projetarParaRemoto } = await import('../../src/domain/projecao-remota.ts');
  const { validarMapa } = await import('../../src/domain/validacao.ts');
  const { codificar } = await import('../../src/domain/celulas.ts');
  const m = criarMapa({ id: 'm', nome: 'Mapa' });
  m.rooms.A = { id: 'A', name: 'Cofre secreto', function: 'sala', cells: codificar([[2, 2], [3, 2]]), floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null } as never;
  m.session.explored = { res: 0.5, cells: Array.from({ length: 20 }, (_, y) => [y, 0, 40] as [number, number, number]) };
  const p = projetarParaRemoto(m);
  assert.equal(p.rooms.A!.name, 'Cômodo');
  assert.doesNotThrow(() => validarMapa(p));
});

test('publicador: o destino remoto recebe a câmera no aspecto do ola remoto e ela segue a peça', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-remoto-camera', nome: 'Arena' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 60]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: { id: 'heroi', name: 'Herói', position: [4.5, 4.5], size: 1, facing: 'down', portrait: null, sprite: null, player: true, vision: { radius: 6, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], hp: null } });
  seguirJogadores.value = true;
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  const camera = () => msgs.filter(m => m.tipo === 'camera').at(-1);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1000, altura: 500, remoto: true, _seq: 1 });
    await esperar(60);
    let c = camera();
    assert.ok(c, 'a câmera chega ao remoto');
    assert.equal(c.seguir, true);
    assert.ok(Math.abs((c.caixa.x1 - c.caixa.x0) / (c.caixa.y1 - c.caixa.y0) - 2) < 0.01, 'no aspecto do ola remoto (2:1)');
    assert.ok(Math.abs((c.caixa.x0 + c.caixa.x1) / 2 - 4.5) < 0.01);

    msgs.length = 0;
    sess.store.executar({ tipo: 'peca.mover', id: 'heroi', para: [20, 10], livre: true });
    await esperar(150);
    c = camera();
    assert.ok(c, 'mover a peça manda a câmera nova ao remoto');
    assert.ok(Math.abs((c.caixa.x0 + c.caixa.x1) / 2 - 20.25) < 1, 'centrada na peça nova');

    msgs.length = 0;
    remoto.postMessage({ tipo: 'tamanho', largura: 500, altura: 1000, _seq: 2 });
    await esperar(60);
    c = camera();
    assert.ok(Math.abs((c.caixa.x1 - c.caixa.x0) / (c.caixa.y1 - c.caixa.y0) - 0.5) < 0.01, 'o tamanho novo refaz a câmera');
  } finally {
    seguirJogadores.value = false;
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: movimento livre do mestre reflete em grid.snap do estado remoto', async () => {
  const { definirMovimentoLivre, movimentoLivre } = await import('../../src/app/modo.ts');
  const mapa = criarMapa({ id: 'mapa-pub-livre', nome: 'Arena' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 60]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const estados: boolean[] = [];
  remoto.onmessage = e => { if (e.data?.tipo === 'estado') estados.push(e.data.doc.grid.snap); };
  try {
    definirMovimentoLivre(false);
    remoto.postMessage({ tipo: 'ola', largura: 1000, altura: 500, remoto: true, _seq: 1 });
    await esperar(60);
    assert.equal(estados.at(-1), true);
    definirMovimentoLivre(true);
    await esperar(60);
    assert.equal(estados.at(-1), false);
    definirMovimentoLivre(false);
    await esperar(60);
    assert.equal(estados.at(-1), true);
  } finally {
    definirMovimentoLivre(false);
    assert.equal(movimentoLivre.value, false);
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: pede ola no canal remoto ao iniciar para retomar após troca de mapa', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-precisa-ola', nome: 'Arena' });
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  const pub = iniciarPublicacao(sess, async () => null);
  try {
    await esperar(30);
    assert.ok(msgs.some(m => m?.tipo === 'precisa-ola'), 'publicador pede ola ao iniciar');
  } finally {
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: seguir jogadores, jogador seguido e controle do mestre forçam foco no destino remoto', async () => {
  const { definirControleJogadores, controleJogadores } = await import('../../src/app/modo.ts');
  const mapa = criarMapa({ id: 'mapa-pub-foco-remoto', nome: 'Torre' });
  mapa.levels = { l2: { id: 'l2', name: 'Superior', order: 1 } };
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 60]] };
  mapa.session.exploredLevels = { l2: { res: 0.5, cells: [[0, 0, 60]] } };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: { id: 'p1', name: 'Lia', position: [3, 3], size: 1, facing: 'down', portrait: null, sprite: null, player: true, vision: { radius: 6, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], hp: null } });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: { id: 'p2', name: 'Kael', position: [25, 18], size: 1, facing: 'down', portrait: null, sprite: null, player: true, vision: { radius: 6, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], hp: null, levelId: 'l2' } });

  definirControleJogadores('livres');
  seguirJogadores.value = false;
  jogadorSeguido.value = null;
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1600, altura: 900, remoto: true, _seq: 1 });
    await esperar(60);

    // 1. Ligar seguirJogadores envia camera com seguir e forcar
    msgs.length = 0;
    seguirJogadores.value = true;
    await esperar(50);
    const camSeguir = msgs.filter(m => m.tipo === 'camera').at(-1);
    assert.ok(camSeguir, 'enviou camera ao ligar seguirJogadores');
    assert.equal(camSeguir.seguir, true);
    assert.equal(camSeguir.forcar, true);

    // 2. Trocar jogadorSeguido para p2 (outro andar) envia estado do novo andar e camera com forcar centrada em p2
    msgs.length = 0;
    jogadorSeguido.value = 'p2';
    await esperar(60);
    const estadoNovoAndar = msgs.filter(m => m.tipo === 'estado').at(-1);
    assert.ok(estadoNovoAndar, 'enviou estado do novo andar ao focar jogador em outro andar');
    assert.ok(estadoNovoAndar.doc.tokens.p2, 'estado contém o token p2');
    const camP2 = msgs.filter(m => m.tipo === 'camera').at(-1);
    assert.ok(camP2, 'enviou camera para p2');
    assert.equal(camP2.forcar, true);
    assert.ok(Math.abs((camP2.caixa.x0 + camP2.caixa.x1) / 2 - 25) < 0.01);

    // 3. Mudar para Controle do mestre envia controle-jogadores e camera com forcar
    msgs.length = 0;
    definirControleJogadores('mestre');
    await esperar(50);
    const ctrl = msgs.filter(m => m.tipo === 'controle-jogadores').at(-1);
    assert.equal(ctrl?.modo, 'mestre');
    const camMestre = msgs.filter(m => m.tipo === 'camera').at(-1);
    assert.ok(camMestre, 'enviou camera ao ativar controle do mestre');
    assert.equal(camMestre.forcar, true);
  } finally {
    definirControleJogadores('livres');
    assert.equal(controleJogadores.value, 'livres');
    seguirJogadores.value = false;
    jogadorSeguido.value = null;
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('projetarAba: com destino remoto ativo, troca o mapa na Activity sem abrir janela local', async () => {
  cacheDeSessoes.clear();
  const mapaA = criarMapa({ id: 'mapa-aba-a', nome: 'Mapa A' });
  const mapaB = criarMapa({ id: 'mapa-aba-b', nome: 'Mapa B' });
  mapaA.session.explored = { res: 0.5, cells: [[0, 0, 20]] };
  mapaB.session.explored = { res: 0.5, cells: [[0, 0, 20]] };
  const repo = criarRepoMock({ [mapaA.id]: mapaA, [mapaB.id]: mapaB });
  servicos.value = { repo, campanhas: null, barramento: null };

  const sessA = criarSessao(mapaA, repo, { salvo: true });
  sessao.value = sessA;
  cacheDeSessoes.set(mapaA.id, sessA);
  mapaNoProjetorId.value = null;
  sincronizarPublicador();

  let abriuJanela = 0;
  const openOriginal = globalThis.window.open;
  globalThis.window.open = (() => { abriuJanela++; return null; }) as any;

  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const estados: string[] = [];
  remoto.onmessage = e => {
    const d = e.data;
    if (d?.tipo === 'precisa-ola') {
      remoto.postMessage({ tipo: 'ola', largura: 1280, altura: 720, remoto: true, _seq: Math.random() });
    } else if (d?.tipo === 'estado') {
      estados.push(d.doc.id);
    }
  };

  try {
    remoto.postMessage({ tipo: 'ola', largura: 1280, altura: 720, remoto: true, _seq: 1 });
    await esperar(60);
    assert.equal(projetorRemotoConectado.value, true);

    estados.length = 0;
    await projetarAba(mapaB.id);
    await esperar(80);

    assert.equal(mapaNoProjetorId.value, mapaB.id);
    assert.equal(abriuJanela, 0, 'não abre janela popup local quando destino remoto está ativo');
    assert.ok(estados.includes(mapaB.id), 'novo mapa foi publicado no canal remoto');

    // Quando desconectado (offline/presencial), continua abrindo janela local
    remoto.postMessage({ tipo: 'tchau', _seq: 2 });
    await esperar(40);
    assert.equal(projetorRemotoConectado.value, false);
    await projetarAba(mapaA.id);
    assert.equal(abriuJanela, 1, 'abre janela local quando nenhum projetor está conectado');
  } finally {
    globalThis.window.open = openOriginal;
    fecharAbaComSessao(mapaB.id);
    fecharAbaComSessao(mapaA.id);
    sessA.fechar();
    cacheDeSessoes.clear();
    sessao.value = null;
    mapaNoProjetorId.value = null;
    sincronizarPublicador();
    remoto.close();
  }
});

test('publicador: projetarFicha envia projetar-ficha e reenvia no ola quando ativa', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-ficha', nome: 'Sala' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 20]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  fichaProjetadaId.value = null;
  const pub = iniciarPublicacao(sess, async () => null);
  const local = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgsLocal: any[] = [], msgsRemoto: any[] = [];
  local.onmessage = e => msgsLocal.push(e.data);
  remoto.onmessage = e => msgsRemoto.push(e.data);

  try {
    remoto.postMessage({ tipo: 'ola', largura: 1280, altura: 720, remoto: true, _seq: 1 });
    await esperar(50);

    projetarFicha('ficha-muirenn');
    await esperar(30);
    assert.equal(fichaProjetadaId.value, 'ficha-muirenn');
    assert.deepEqual(msgsRemoto.filter(m => m.tipo === 'projetar-ficha').map(m => m.fichaId), ['ficha-muirenn']);

    // Novo projetor local conecta via ola e recebe a ficha projetada ativa
    local.postMessage({ tipo: 'ola', largura: 1280, altura: 720, _seq: 1 });
    await esperar(50);
    assert.deepEqual(msgsLocal.filter(m => m.tipo === 'projetar-ficha').map(m => m.fichaId), ['ficha-muirenn']);

    // Parar projeção envia null para ambos
    projetarFicha(null);
    await esperar(30);
    assert.equal(msgsRemoto.filter(m => m.tipo === 'projetar-ficha').at(-1)?.fichaId, null);
    assert.equal(msgsLocal.filter(m => m.tipo === 'projetar-ficha').at(-1)?.fichaId, null);
  } finally {
    projetarFicha(null);
    pub.parar(); local.close(); remoto.close(); sess.fechar();
  }
});

test('publicador: arrasto de peça com lanterna envia peca-gesto leve (tokens + lights) e sem flood de estado', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-gesto-luz', nome: 'Corredor' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 40]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  sess.store.executar({
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: { id: 'h1', name: 'Herói', position: [3, 3], size: 1, facing: 'right', portrait: null, sprite: null, player: true, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [] },
  });
  sess.store.executar({
    tipo: 'item.adicionar',
    colecao: 'lights',
    item: novaLuz([3, 3], { id: 'l1', radius: 6, cone: { direction: 0, angle: Math.PI / 3 }, preset: 'lanterna', ownerId: 'h1' }),
  });
  sess.store.executar({ tipo: 'item.atualizar', colecao: 'tokens', id: 'h1', patch: { lightId: 'l1' } });
  seguirJogadores.value = true;
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1600, altura: 900, remoto: true, _seq: 1 });
    await esperar(60);
    msgs.length = 0;

    const gesto = sess.store.iniciarGesto('Mover peça');
    gesto.aplicar({ tipo: 'peca.mover', id: 'h1', para: [6.5, 4.5], semGrade: true, emArrasto: true, direcao: 0.5 });
    await esperar(30);

    assert.equal(msgs.some(m => m.tipo === 'estado'), false, 'não envia mapa completo durante gesto');
    const pg = msgs.filter(m => m.tipo === 'peca-gesto').at(-1);
    assert.ok(pg, 'enviou peca-gesto mesmo com lightId acoplado');
    assert.deepEqual(pg.position, [6.5, 4.5]);
    assert.equal(pg.lightDirection, 0.5);
    assert.ok(pg.caixa, 'remoto recebe caixa junto com peca-gesto quando seguir=true');
    assert.equal(msgs.some(m => m.tipo === 'camera'), false, 'não duplica pacote camera durante o gesto remoto');

    gesto.concluir();
  } finally {
    seguirJogadores.value = false;
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: retratos são enviados separadamente por destino, reenviados no ola e respondem a pedir-retrato', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-retrato', nome: 'Taverna' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 20]] };
  const blobRetrato = new Blob(['png-fake'], { type: 'image/png' });
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  sess.store.executar({
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: { id: 'h1', name: 'Muirenn', position: [3, 3], size: 1, facing: 'down', portrait: { id: 'asset-muirenn', hash: 'h1234567' }, sprite: null, player: true, vision: { radius: 6, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [] },
  });
  const pub = iniciarPublicacao(sess, async id => (id === 'asset-muirenn' ? blobRetrato : null));
  const local = new BroadcastChannel(nomeDoCanalDoProjetor(mapa.id));
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgsLocal: any[] = [], msgsRemoto: any[] = [];
  local.onmessage = e => msgsLocal.push(e.data);
  remoto.onmessage = e => msgsRemoto.push(e.data);

  try {
    // 1. Local conecta primeiro e recebe o retrato
    local.postMessage({ tipo: 'ola', largura: 1280, altura: 720, _seq: 1 });
    await esperar(60);
    assert.equal(msgsLocal.filter(m => m.tipo === 'retrato' && m.id === 'asset-muirenn').length, 1);

    // 2. Remoto conecta depois: também deve receber o retrato (set separado + ola reenvia)
    remoto.postMessage({ tipo: 'ola', largura: 1280, altura: 720, remoto: true, _seq: 1 });
    await esperar(60);
    assert.equal(msgsRemoto.filter(m => m.tipo === 'retrato' && m.id === 'asset-muirenn').length, 1);

    // 3. Pedido explícito pedir-retrato reenvia imediatamente
    msgsRemoto.length = 0;
    remoto.postMessage({ tipo: 'pedir-retrato', id: 'asset-muirenn', _seq: 2 });
    await esperar(50);
    assert.equal(msgsRemoto.filter(m => m.tipo === 'retrato' && m.id === 'asset-muirenn').length, 1);
  } finally {
    pub.parar(); local.close(); remoto.close(); sess.fechar();
  }
});

test('publicador: forcarCameraRemota reenvia camera com forcar mesmo já estando em controle do mestre', async () => {
  const { definirControleJogadores } = await import('../../src/app/modo.ts');
  const mapa = criarMapa({ id: 'mapa-pub-forcar', nome: 'Sala' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 20]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  definirControleJogadores('mestre');
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1280, altura: 720, remoto: true, _seq: 1 });
    await esperar(60);
    assert.ok(caixaDoProjetor.value, 'ola remoto inicializa caixaDoProjetor');
    msgs.length = 0;

    forcarCameraRemota();
    await esperar(40);
    const cam = msgs.filter(m => m.tipo === 'camera').at(-1);
    assert.ok(cam && cam.forcar === true, 'forcarCameraRemota envia camera com forcar: true');
  } finally {
    definirControleJogadores('livres');
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: arrasto em gesto de peça de jogador com mudança em session.explored ainda envia peca-gesto', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-gesto-explored', nome: 'Masmorra' });
  mapa.session.explored = { res: 0.5, cells: [] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  sess.store.executar({
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: { id: 'h1', name: 'Herói', position: [3, 3], size: 1, facing: 'right', portrait: null, sprite: null, player: true, vision: { radius: 6, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [] },
  });
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1600, altura: 900, remoto: true, _seq: 1 });
    await esperar(60);
    msgs.length = 0;

    const g = sess.store.iniciarGesto('Mover');
    g.aplicar({ tipo: 'peca.mover', id: 'h1', para: [6, 3], livre: true, semGrade: true });
    await esperar(40);
    const gestos = msgs.filter(m => m.tipo === 'peca-gesto');
    assert.ok(gestos.length >= 1, 'enviou peca-gesto mesmo com session.explored alterado');
    assert.deepEqual(gestos[0].position, [6, 3]);
    g.cancelar();
  } finally {
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: alternar-porta remoto só executa quando controleJogadores está em livres e porta é válida', async () => {
  const { definirControleJogadores } = await import('../../src/app/modo.ts');
  const mapa = criarMapa({ id: 'mapa-pub-porta', nome: 'Taverna' });
  mapa.walls.w1 = { id: 'w1', kind: 'wall', path: [[0, 0], [6, 0]], height: 2.8, thickness: 0.2, material: 'parede.reboco', blocks: { sight: true, move: true, light: true }, drop: null, source: null, levelId: null };
  mapa.openings.d1 = { id: 'd1', kind: 'door', wallId: 'w1', at: 0.5, width: 1, state: 'closed', material: 'madeira.escura', som: null, swing: 'a' };
  mapa.openings.dLock = { id: 'dLock', kind: 'door', wallId: 'w1', at: 0.2, width: 1, state: 'locked', material: 'madeira.escura', som: null, swing: 'a' };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  const alternadas: string[] = [];
  const pub = iniciarPublicacao(sess, async () => null, id => alternadas.push(id));
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  try {
    definirControleJogadores('mestre');
    remoto.postMessage({ tipo: 'alternar-porta', id: 'd1', _seq: 1 });
    await esperar(30);
    assert.deepEqual(alternadas, [], 'recusa quando controle é do mestre');

    definirControleJogadores('livres');
    remoto.postMessage({ tipo: 'alternar-porta', id: 'dLock', _seq: 2 });
    await esperar(30);
    assert.deepEqual(alternadas, [], 'recusa porta trancada');

    remoto.postMessage({ tipo: 'alternar-porta', id: 'd1', _seq: 3 });
    await esperar(30);
    assert.deepEqual(alternadas, ['d1'], 'aceita porta livre');
  } finally {
    definirControleJogadores('livres');
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: forcarCameraRemota funciona em Jogadores livres e filtroDeVisao envia visao-remota', async () => {
  const { definirControleJogadores } = await import('../../src/app/modo.ts');
  const { definirFiltroDeVisao, filtroDeVisao, forcarCameraRemota } = await import('../../src/app/projetor.ts');
  const mapa = criarMapa({ id: 'mapa-pub-visao', nome: 'Praça' });
  mapa.session.explored = { res: 0.5, cells: [[0, 0, 8]] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  sess.store.executar({
    tipo: 'item.adicionar',
    colecao: 'tokens',
    item: {
      id: 'p1', name: 'Rowan', position: [5, 5], size: 1, facing: 'down',
      portrait: null, sprite: null, player: true, vision: { radius: 10, dark: false },
      lightId: null, figure: { state: 'normal' }, refs: [], hp: null,
    },
  });
  definirControleJogadores('livres');
  definirFiltroDeVisao({ tipo: 'todos' });
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1280, altura: 720, _seq: 1 });
    await esperar(80);
    const visaoInicial = msgs.find(m => m.tipo === 'visao-remota');
    assert.deepEqual(visaoInicial?.filtro, { tipo: 'todos' });

    msgs.length = 0;
    forcarCameraRemota();
    await esperar(50);
    const camForcada = msgs.find(m => m.tipo === 'camera' && m.forcar === true);
    assert.ok(camForcada, 'forcarCameraRemota envia camera com forcar: true mesmo em Jogadores livres');

    msgs.length = 0;
    definirFiltroDeVisao({ tipo: 'foco', tokenId: 'p1' });
    await esperar(50);
    const visaoFoco = msgs.find(m => m.tipo === 'visao-remota');
    assert.deepEqual(visaoFoco?.filtro, { tipo: 'foco', tokenId: 'p1' });
  } finally {
    definirFiltroDeVisao({ tipo: 'todos' });
    definirControleJogadores('livres');
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('publicador: arrasto de ameaça visível envia peca-gesto ao remoto; fora da visão não vaza (anti-spoiler)', async () => {
  const mapa = criarMapa({ id: 'mapa-pub-gesto-ameaca', nome: 'Cripta' });
  mapa.session.explored = { res: 0.5, cells: [] };
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  const peca = (id: string, player: boolean, position: [number, number]) => ({ id, name: id, position, size: 1, facing: 'right' as const, portrait: null, sprite: null, player, vision: { radius: 6, dark: false }, lightId: null, figure: { state: 'normal' as const }, refs: [] });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca('h1', true, [3, 3]) });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca('orc', false, [4, 3]) });
  sess.store.executar({ tipo: 'item.adicionar', colecao: 'tokens', item: peca('longe', false, [40, 25]) });
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  const msgs: any[] = [];
  remoto.onmessage = e => msgs.push(e.data);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1600, altura: 900, remoto: true, _seq: 1 });
    await esperar(60);
    msgs.length = 0;

    const g = sess.store.iniciarGesto('Mover ameaça');
    g.aplicar({ tipo: 'peca.mover', id: 'orc', para: [5, 3], livre: true, semGrade: true });
    await esperar(40);
    assert.ok(msgs.some(m => m.tipo === 'peca-gesto' && m.id === 'orc'), 'ameaça visível anda em tempo real');
    g.cancelar();

    msgs.length = 0;
    const g2 = sess.store.iniciarGesto('Mover escondida');
    g2.aplicar({ tipo: 'peca.mover', id: 'longe', para: [41, 25], livre: true, semGrade: true });
    await esperar(40);
    assert.ok(!msgs.some(m => m.tipo === 'peca-gesto' && m.id === 'longe'), 'ameaça fora da visão não vaza posição');
    g2.cancelar();
  } finally {
    pub.parar(); remoto.close(); sess.fechar();
  }
});

test('obterStorePorMapaId acha o mapa pedido mesmo com outra aba ativa; sem ele, devolve null', () => {
  const mapaA = criarMapa({ id: 'mapa-a2', nome: 'A' });
  const mapaB = criarMapa({ id: 'mapa-b2', nome: 'B' });
  const repo = criarRepoMock({ [mapaA.id]: mapaA, [mapaB.id]: mapaB });
  const sessA = criarSessao(mapaA, repo, { salvo: true });
  const sessB = criarSessao(mapaB, repo, { salvo: true });
  cacheDeSessoes.set(mapaA.id, sessA);
  sessao.value = sessB; // o mestre está olhando a aba B enquanto projeta o A
  mapaNoProjetorId.value = null;
  try {
    assert.equal(obterStorePorMapaId('mapa-a2'), sessA.store, 'o mapa projetado vem do cache');
    assert.equal(obterStorePorMapaId('mapa-b2'), sessB.store, 'o mapa ativo');
    assert.equal(obterStorePorMapaId('mapa-z'), null, 'instância sem o mapa não tem store');
    assert.equal(obterStorePorMapaId(undefined), null);
  } finally {
    sessA.fechar(); sessB.fechar(); cacheDeSessoes.clear(); sessao.value = null; mapaNoProjetorId.value = null;
  }
});

test('o projetor remoto fixa o mapa em mapaNoProjetorId ao dizer "ola"', async () => {
  const mapa = criarMapa({ id: 'mapa-pin-ola', nome: 'Pin' });
  const sess = criarSessao(mapa, criarRepoMock({ [mapa.id]: mapa }), { salvo: true });
  mapaNoProjetorId.value = null;
  const pub = iniciarPublicacao(sess, async () => null);
  const remoto = new BroadcastChannel(CANAL_PROJETOR_REMOTO);
  try {
    remoto.postMessage({ tipo: 'ola', largura: 1600, altura: 900, remoto: true, _seq: 1 });
    await esperar(60);
    assert.equal(mapaNoProjetorId.value, 'mapa-pin-ola');
  } finally {
    mapaNoProjetorId.value = null; pub.parar(); remoto.close(); sess.fechar();
  }
});

test('caixaDosJogadores: segue combatente da iniciativa que não é jogador, mas ignora peça fora dela', async () => {
  const { caixaDosJogadores } = await import('../../src/app/projetor.ts');
  const m = criarMapa({ id: 'mapa-caixa-ini', nome: 'Caixa' });
  const mk = (id: string, x: number, player: boolean) => ({ id, name: id, position: [x, 10.5] as [number, number], size: 1, facing: 'down' as const, portrait: null, sprite: null, player, vision: { radius: 18, dark: false }, lightId: null, figure: { state: 'normal' as const }, refs: [], hp: null });
  m.tokens.p = mk('p', 4.5, true) as never;
  m.tokens.orc = mk('orc', 12.5, false) as never;
  m.tokens.solto = mk('solto', 20.5, false) as never;
  const centro = (c: { x0: number; x1: number }) => (c.x0 + c.x1) / 2;
  assert.ok(Math.abs(centro(caixaDosJogadores(m, 16 / 9, 5, undefined, 'orc')) - 4.5) < 0.01, 'fora da iniciativa: enquadra os jogadores');
  m.session.initiative = { order: [{ tokenId: 'p', value: 5 }, { tokenId: 'orc', value: 3 }], current: 1, round: 1 };
  assert.ok(Math.abs(centro(caixaDosJogadores(m, 16 / 9, 5, undefined, 'orc')) - 12.5) < 0.01, 'na iniciativa: enquadra o combatente');
  assert.ok(Math.abs(centro(caixaDosJogadores(m, 16 / 9, 5, undefined, 'solto')) - 4.5) < 0.01, 'peça fora da iniciativa não vira alvo');
});

test('caixaDosJogadores: ameaça da iniciativa fora da vista dos jogadores não é revelada', async () => {
  const { caixaDosJogadores } = await import('../../src/app/projetor.ts');
  const m = criarMapa({ id: 'mapa-caixa-oculta', nome: 'Oculta' });
  const mk = (id: string, x: number, player: boolean) => ({ id, name: id, position: [x, 10.5] as [number, number], size: 1, facing: 'down' as const, portrait: null, sprite: null, player, vision: { radius: 6, dark: false }, lightId: null, figure: { state: 'normal' as const }, refs: [], hp: null });
  m.tokens.p = mk('p', 4.5, true) as never;
  m.tokens.orc = mk('orc', 80.5, false) as never;
  m.session.initiative = { order: [{ tokenId: 'p', value: 5 }, { tokenId: 'orc', value: 3 }], current: 1, round: 1 };
  const c = caixaDosJogadores(m, 16 / 9, 5, undefined, 'orc');
  assert.ok(Math.abs((c.x0 + c.x1) / 2 - 4.5) < 0.01, 'fica nos jogadores');
});
