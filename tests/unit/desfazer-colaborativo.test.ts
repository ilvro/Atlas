import { describe, it } from 'node:test';
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

import { desfazer as desfazerApp, refazer as refazerApp } from '../../src/app/app.ts';
import {
  desfazerConstrucaoRemota,
  iniciarConstrucaoRemota,
  podeDesfazerRemoto,
  podeRefazerRemoto,
  refazerConstrucaoRemota,
  rotuloDesfazerRemoto,
  rotuloRefazerRemoto,
  type CanalConstrucaoLike,
} from '../../src/app/construcao-remota.ts';
import {
  calcularInversoComandos,
  criarPilhaDesfazerColaborativo,
  filtrarComandosCompensatorios,
} from '../../src/app/desfazer-colaborativo.ts';
import { modo } from '../../src/app/modo.ts';
import { lerRota, rota } from '../../src/app/rotas.ts';
import { sessao } from '../../src/app/sessao.ts';
import { novaLuz, novaPeca, novoObjeto } from '../../src/domain/fabrica.ts';
import { criarMapa, type Abertura, type MapaAtlas, type Parede } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { aplicarComando, type Comando } from '../../src/state/comandos.ts';

function aplicarLista(mapa: MapaAtlas, cmds: readonly Comando[]): MapaAtlas {
  let atual = mapa;
  for (const c of cmds) atual = aplicarComando(atual, c);
  return atual;
}

function paredeLivre(id: string, x0 = 2, y0 = 2, x1 = 10, y1 = 2): Omit<Parede, 'source'> {
  return {
    id,
    path: [[x0, y0], [x1, y1]],
    height: 2.6,
    thickness: 0.2,
    material: 'parede.topo',
    kind: 'wall',
    blocks: { move: true, sight: true, light: true },
    drop: null,
  };
}

function criarCanalFalso() {
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

describe('desfazer-colaborativo (S6)', () => {
  it('principal S6: A cria cômodo, B coloca mesa dentro; A desfaz e cômodo some mantendo mesa de B intacta', () => {
    const m0 = criarMapa({ id: 's6-sala', nome: 'Taberna', largura: 30, altura: 20 });
    const pilhaA = criarPilhaDesfazerColaborativo();

    const cmdCriarSala: Comando = {
      tipo: 'comodo.criar',
      id: 'sala-a',
      nome: 'Salão',
      funcao: 'taverna',
      piso: { material: 'tabuas.carvalho', seed: 11 },
      papel: { material: 'papel.damasco-vinho', seed: 3 },
      telhado: 'telha.barro',
      celulas: [[2, 2], [3, 2], [2, 3], [3, 3]],
    };
    const m1 = aplicarComando(m0, cmdCriarSala);
    pilhaA.registrarPendente('op-a1', 'Criar Salão', m0, m1, [cmdCriarSala], 'normal');
    assert.equal(pilhaA.confirmar('op-a1'), true);

    // Usuário B coloca uma mesa dentro do cômodo criado por A (centro da célula [2,2] -> [3.75, 3.75])
    const mesaB = novoObjeto([3.75, 3.75], { id: 'mesa-b' });
    const m2 = aplicarComando(m1, { tipo: 'item.adicionar', colecao: 'props', item: mesaB });
    assert.equal(m2.props['mesa-b']?.roomId, 'sala-a');

    // Usuário A desfaz sua própria ação: o cômodo é removido, mas a mesa de B permanece intacta!
    const prepDesfazer = pilhaA.prepararDesfazer(m2);
    assert.ok(prepDesfazer);
    assert.equal(prepDesfazer.rotulo, 'Criar Salão');
    const m3 = aplicarLista(m2, prepDesfazer.comandos);
    validarMapa(m3);

    assert.equal(m3.rooms['sala-a'], undefined);
    assert.ok(m3.props['mesa-b'], 'mesa colocada pelo usuário B deve permanecer no mapa');
    assert.equal(m3.props['mesa-b']!.roomId, null);

    // Usuário A refaz sua ação: o cômodo volta e a mesa de B continua lá
    const prepRefazer = pilhaA.prepararRefazer(m3);
    assert.ok(prepRefazer);
    const m4 = aplicarLista(m3, prepRefazer.comandos);
    validarMapa(m4);
    assert.ok(m4.rooms['sala-a']);
    assert.equal(m4.props['mesa-b']?.roomId, 'sala-a');
  });

  it('cômodo: restaura células roubadas ao desfazer comodo.criar, comodo.pintar e comodo.apagar mantendo notas', () => {
    let m = criarMapa({ id: 's6-cels', nome: 'Casarão', largura: 30, altura: 20 });
    const cmdSalaBase: Comando = {
      tipo: 'comodo.criar',
      id: 'sala-base',
      nome: 'Corredor',
      funcao: null,
      piso: { material: 'tabuas.carvalho', seed: 1 },
      papel: null,
      celulas: [[1, 1], [2, 1], [3, 1]],
    };
    m = aplicarComando(m, cmdSalaBase);
    m = aplicarComando(m, {
      tipo: 'comodo.notas',
      id: 'sala-base',
      patch: { leitura: 'Texto antigo', notasMestre: 'Segredo' },
    });

    // A cria sala-nova roubando [3,1] de sala-base
    const pilha = criarPilhaDesfazerColaborativo();
    const cmdNova: Comando = {
      tipo: 'comodo.criar',
      id: 'sala-nova',
      nome: 'Copa',
      funcao: 'cozinha',
      piso: { material: 'pedra.laje', seed: 2 },
      papel: null,
      celulas: [[3, 1], [4, 1]],
    };
    const mDepoisNova = aplicarComando(m, cmdNova);
    pilha.registrarPendente('op-1', 'Criar Copa', m, mDepoisNova, [cmdNova], 'normal');
    pilha.confirmar('op-1');

    const desfeito1 = aplicarLista(mDepoisNova, pilha.prepararDesfazer(mDepoisNova)!.comandos);
    assert.equal(desfeito1.rooms['sala-nova'], undefined);
    assert.deepEqual(desfeito1.rooms['sala-base']!.cells, m.rooms['sala-base']!.cells);

    // A pinta células adicionais [4,1] e [2,2] e apaga [1,1]
    const cmdPintar: Comando = { tipo: 'comodo.pintar', id: 'sala-base', celulas: [[4, 1]] };
    const mPintado = aplicarComando(m, cmdPintar);
    const invPintar = calcularInversoComandos(m, mPintado, [cmdPintar]);
    const mPintarDesfeito = aplicarLista(mPintado, invPintar);
    assert.deepEqual(mPintarDesfeito.rooms['sala-base']!.cells, m.rooms['sala-base']!.cells);

    const cmdApagar: Comando = { tipo: 'comodo.apagar', celulas: [[1, 1]], levelId: null };
    const mApagado = aplicarComando(m, cmdApagar);
    const invApagar = calcularInversoComandos(m, mApagado, [cmdApagar]);
    const mApagarDesfeito = aplicarLista(mApagado, invApagar);
    assert.deepEqual(mApagarDesfeito.rooms['sala-base']!.cells, m.rooms['sala-base']!.cells);

    // A remove sala-base inteira e depois desfaz -> restaura cômodo e notas
    const cmdRem: Comando = { tipo: 'comodo.remover', id: 'sala-base' };
    const mSemSala = aplicarComando(m, cmdRem);
    assert.equal(mSemSala.comodosExtra['sala-base'], undefined);
    const invRem = calcularInversoComandos(m, mSemSala, [cmdRem]);
    const mRestaurado = aplicarLista(mSemSala, invRem);
    assert.ok(mRestaurado.rooms['sala-base']);
    assert.equal(mRestaurado.comodosExtra['sala-base']?.leitura, 'Texto antigo');
    assert.equal(mRestaurado.comodosExtra['sala-base']?.notasMestre, 'Segredo');
  });

  it('terreno: A pinta [1,1]..[2,2] com grama e B pinta [5,5] com água; A desfaz mantendo água de B', () => {
    const m0 = criarMapa({ id: 's6-terreno', nome: 'Bosque', largura: 30, altura: 20 });
    const pilhaA = criarPilhaDesfazerColaborativo();

    const cmdGrama: Comando = {
      tipo: 'terreno.pintar',
      material: 'grama',
      celulas: [[1, 1], [1, 2], [2, 1], [2, 2]],
    };
    const m1 = aplicarComando(m0, cmdGrama);
    pilhaA.registrarPendente('op-grama', 'Pintar grama', m0, m1, [cmdGrama], 'normal');
    pilhaA.confirmar('op-grama');

    // B pinta [5,5] com água
    const m2 = aplicarComando(m1, {
      tipo: 'terreno.pintar',
      material: 'agua',
      celulas: [[5, 5]],
    });

    // A desfaz grama -> células de A somem, água de B fica intacta
    const prep = pilhaA.prepararDesfazer(m2)!;
    const m3 = aplicarLista(m2, prep.comandos);
    validarMapa(m3);
    assert.equal(m3.terrain.layers['t_grama'], undefined);
    assert.ok(m3.terrain.layers['t_agua']);
    assert.deepEqual(m3.terrain.layers['t_agua']!.cells, [[5, 5, 1]]);

    // Também restaura material anterior quando A pintou por cima de terra existente
    const mComTerra = aplicarComando(m0, {
      tipo: 'terreno.pintar',
      material: 'terra',
      celulas: [[1, 1], [2, 2]],
    });
    const mSobrescrito = aplicarComando(mComTerra, {
      tipo: 'terreno.pintar',
      material: 'grama',
      celulas: [[1, 1], [3, 3]],
    });
    const invSobre = calcularInversoComandos(mComTerra, mSobrescrito, [
      { tipo: 'terreno.pintar', material: 'grama', celulas: [[1, 1], [3, 3]] },
    ]);
    const mVoltaTerra = aplicarLista(mSobrescrito, invSobre);
    assert.deepEqual(mVoltaTerra.terrain.layers['t_terra']?.cells, [[1, 1, 1], [2, 2, 1]]);
    assert.equal(mVoltaTerra.terrain.layers['t_grama'], undefined);
  });

  it('itens, seleção, luzes com dono, visibilidade, camadas, paredes e aberturas: desfazer + refazer', () => {
    const m0 = criarMapa({ id: 's6-itens', nome: 'Oficina', largura: 30, altura: 20 });
    const pilha = criarPilhaDesfazerColaborativo();
    let atual = m0;

    // 1. item.adicionar
    const objA = novoObjeto([4, 4], { id: 'bau-a' });
    const mAdd = aplicarComando(atual, { tipo: 'item.adicionar', colecao: 'props', item: objA });
    pilha.registrarPendente('op-1', 'Pôr baú', atual, mAdd, [{ tipo: 'item.adicionar', colecao: 'props', item: objA }]);
    pilha.confirmar('op-1');
    atual = mAdd;

    // 2. item.atualizar (inclui campo opcional ausente antes)
    const cmdUpd: Comando = {
      tipo: 'item.atualizar',
      colecao: 'props',
      id: 'bau-a',
      patch: { rotation: 1.5, opacity: 0.5 },
    };
    const mUpd = aplicarComando(atual, cmdUpd);
    pilha.registrarPendente('op-2', 'Editar baú', atual, mUpd, [cmdUpd]);
    pilha.confirmar('op-2');
    atual = mUpd;

    // 3. objeto.camada + objeto.visibilidade
    const cmdVis: Comando = { tipo: 'objeto.visibilidade', ids: ['bau-a'], acao: 'esconder' };
    const mVis = aplicarComando(atual, cmdVis);
    pilha.registrarPendente('op-3', 'Esconder baú', atual, mVis, [cmdVis]);
    pilha.confirmar('op-3');
    atual = mVis;
    assert.equal(atual.props['bau-a']!.oculto, true);

    const cmdCamada: Comando = { tipo: 'objeto.camada', ids: ['bau-a'], modo: 'subir' };
    const mCamada = aplicarComando(atual, cmdCamada);
    pilha.registrarPendente('op-4', 'Subir camada', atual, mCamada, [cmdCamada]);
    pilha.confirmar('op-4');
    atual = mCamada;

    // 4. selecao.mover em 2 alvos, mas colega B apaga o 2º alvo antes de A desfazer
    const objB = novoObjeto([8, 8], { id: 'cadeira-b' });
    atual = aplicarComando(atual, { tipo: 'item.adicionar', colecao: 'props', item: objB });
    const cmdMover: Comando = {
      tipo: 'selecao.mover',
      alvos: [
        { colecao: 'props', id: 'bau-a' },
        { colecao: 'props', id: 'cadeira-b' },
      ],
      delta: [2, -1],
    };
    const mMov = aplicarComando(atual, cmdMover);
    pilha.registrarPendente('op-5', 'Mover móveis', atual, mMov, [cmdMover]);
    pilha.confirmar('op-5');
    atual = mMov;

    // Colega B remove cadeira-b
    atual = aplicarComando(atual, { tipo: 'item.remover', colecao: 'props', id: 'cadeira-b' });

    // Desfaz mover -> move apenas bau-a de volta, sem lançar erro por cadeira-b ausente!
    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos);
    assert.deepEqual(atual.props['bau-a']!.position, [4, 4]);

    // Refaz mover -> move bau-a novamente para [6, 3]
    atual = aplicarLista(atual, pilha.prepararRefazer(atual)!.comandos);
    assert.deepEqual(atual.props['bau-a']!.position, [6, 3]);

    // Desfaz mover, camada, visibilidade, atualizar, adicionar em sequência
    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos); // mover
    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos); // camada
    assert.equal(atual.props['bau-a']!.layer, undefined);

    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos); // visibilidade
    assert.equal(atual.props['bau-a']!.oculto, undefined);

    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos); // atualizar
    assert.equal(atual.props['bau-a']!.rotation, 0);
    assert.equal(atual.props['bau-a']!.opacity, undefined);

    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos); // adicionar
    assert.equal(atual.props['bau-a'], undefined);

    // Refaz tudo de volta até o estado editado
    while (pilha.podeRefazer) {
      atual = aplicarLista(atual, pilha.prepararRefazer(atual)!.comandos);
    }
    assert.ok(atual.props['bau-a']);
    assert.equal(atual.props['bau-a']!.rotation, 1.5);
    assert.equal(atual.props['bau-a']!.oculto, true);
    assert.deepEqual(atual.props['bau-a']!.position, [6, 3]);

    // 5. parede.adicionar + abertura.adicionar + desfazer + refazer
    const parede = paredeLivre('w-1', 2, 2, 10, 2);
    const cmdParede: Comando = { tipo: 'parede.adicionar', parede };
    const mPar = aplicarComando(atual, cmdParede);
    pilha.registrarPendente('op-6', 'Desenhar parede', atual, mPar, [cmdParede]);
    pilha.confirmar('op-6');
    atual = mPar;

    const porta: Abertura = {
      id: 'ab-1',
      wallId: 'w-1',
      at: 0.5,
      width: 1,
      kind: 'door',
      state: 'closed',
      material: 'madeira.media',
      som: null,
      swing: 'a',
    };
    const cmdAb: Comando = { tipo: 'abertura.adicionar', abertura: porta };
    const mAb = aplicarComando(atual, cmdAb);
    pilha.registrarPendente('op-7', 'Pôr porta', atual, mAb, [cmdAb]);
    pilha.confirmar('op-7');
    atual = mAb;

    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos);
    assert.equal(atual.openings['ab-1'], undefined);
    atual = aplicarLista(atual, pilha.prepararDesfazer(atual)!.comandos);
    assert.equal(atual.walls['w-1'], undefined);

    atual = aplicarLista(atual, pilha.prepararRefazer(atual)!.comandos);
    assert.ok(atual.walls['w-1']);
    atual = aplicarLista(atual, pilha.prepararRefazer(atual)!.comandos);
    assert.ok(atual.openings['ab-1']);

    // 6. item.remover de token com luz própria (ownerId + lightId) restaura ambos em ordem válida
    const peca = novaPeca([12, 12], 'Exploradora', { id: 'tok-1', lightId: 'luz-tok-1' });
    const luzTok = novaLuz([12, 12], { id: 'luz-tok-1', ownerId: 'tok-1', on: false });
    const mSemLuz = aplicarComando(atual, {
      tipo: 'item.adicionar',
      colecao: 'tokens',
      item: { ...peca, lightId: null },
    });
    const mComLuz = aplicarComando(mSemLuz, {
      tipo: 'item.adicionar',
      colecao: 'lights',
      item: luzTok,
    });
    const mLigado = aplicarComando(mComLuz, {
      tipo: 'item.atualizar',
      colecao: 'tokens',
      id: 'tok-1',
      patch: { lightId: 'luz-tok-1' },
    });
    const mRemovido = aplicarComando(mLigado, {
      tipo: 'item.remover',
      colecao: 'tokens',
      id: 'tok-1',
    });
    assert.equal(mRemovido.tokens['tok-1'], undefined);
    assert.equal(mRemovido.lights['luz-tok-1'], undefined);

    const invRem = calcularInversoComandos(mLigado, mRemovido, [
      { tipo: 'item.remover', colecao: 'tokens', id: 'tok-1' },
    ]);
    const mRestaurado = aplicarLista(mRemovido, invRem);
    validarMapa(mRestaurado);
    assert.equal(mRestaurado.tokens['tok-1']?.lightId, 'luz-tok-1');
    assert.equal(mRestaurado.lights['luz-tok-1']?.ownerId, 'tok-1');
    assert.equal(mRestaurado.lights['luz-tok-1']?.on, false);
  });

  it('proposta.aceitar, luz.estado, relevo, presenca e comandos de mapa/clima/andar invertem corretamente', () => {
    let m0 = criarMapa({ id: 's6-extra', nome: 'Original', largura: 30, altura: 20 });
    const luz = novaLuz([5, 5], { id: 'l-1', on: true });
    m0 = aplicarComando(m0, { tipo: 'item.adicionar', colecao: 'lights', item: luz });

    const proposta: Comando = {
      tipo: 'proposta.aceitar',
      rotulo: 'Pacote',
      comandos: [
        { tipo: 'mapa.renomear', nome: 'Alterado' },
        { tipo: 'luz.estado', ids: ['l-1'], acao: 'desligar' },
        { tipo: 'relevo.pintar', altura: 2, celulas: [[2, 2], [3, 2]] },
        { tipo: 'presenca.pintar', brush: 'musgo', celulas: [[4, 4]] },
        { tipo: 'andar.criar', andar: { id: 'andar-2', name: 'Subsolo', order: -1 } },
      ],
    };

    const m1 = aplicarComando(m0, proposta);
    const inverso = calcularInversoComandos(m0, m1, [proposta]);
    const m2 = aplicarLista(m1, inverso);
    validarMapa(m2);

    assert.equal(m2.name, 'Original');
    assert.equal(m2.lights['l-1']?.on, true);
    assert.equal(m2.terrain.relief, undefined);
    assert.deepEqual(m2.presence, {});
    assert.equal(m2.levels, undefined);

    // filtrarComandosCompensatorios pula comandos cujo alvo foi removido por outro usuário
    const filtrados = filtrarComandosCompensatorios(m0, [
      { tipo: 'item.remover', colecao: 'props', id: 'inexistente' },
      { tipo: 'mapa.renomear', nome: 'Sobrevivente' },
    ]);
    assert.deepEqual(filtrados, [{ tipo: 'mapa.renomear', nome: 'Sobrevivente' }]);
  });

  it('integração com iniciarConstrucaoRemota: confirma, desfaz, refaz, ignora op remota, cancela gesto e limpa ao sair', () => {
    const falso = criarCanalFalso();
    const antigaRota = rota.value;
    rota.value = lerRota('#/construir-remoto/sala-s6');
    let seqId = 0;

    const ponte = iniciarConstrucaoRemota({
      salaId: 'sala-s6',
      criarCanal: () => falso.canal,
      gerarOpId: () => `s6-op-${++seqId}`,
    });

    try {
      const base = criarMapa({ id: 'mapa-s6', nome: 'Forte' });
      falso.entregar({ tipo: 'construcao.estado', rev: 0, mapa: base, ops: [] });
      falso.enviadas.length = 0;

      const s = sessao.peek()!;
      assert.ok(s);
      assert.equal(podeDesfazerRemoto.peek(), false);
      assert.equal(podeRefazerRemoto.peek(), false);

      // 1. Edição local ainda pendente não habilita podeDesfazerRemoto antes da confirmação
      const mesa = novoObjeto([4, 4], { id: 'mesa-a' });
      s.store.executar({ tipo: 'item.adicionar', colecao: 'props', item: mesa }, { rotulo: 'Pôr mesa' });
      assert.equal(podeDesfazerRemoto.peek(), false);

      const msgAdd = falso.enviadas[0] as { tipo: string; opId: string; comandos: Comando[]; rotulo: string };
      assert.equal(msgAdd.tipo, 'construcao.comando');

      // Confirmação da própria op habilita podeDesfazerRemoto
      falso.entregar({
        tipo: 'construcao.aplicada',
        rev: 1,
        opId: msgAdd.opId,
        comandos: msgAdd.comandos,
        rotulo: msgAdd.rotulo,
      });
      assert.equal(podeDesfazerRemoto.peek(), true);
      assert.equal(rotuloDesfazerRemoto.peek(), 'Pôr mesa');
      assert.equal(podeRefazerRemoto.peek(), false);

      // 2. Operação de outro participante não entra na pilha local de desfazer
      const cadeiraB = novoObjeto([8, 8], { id: 'cadeira-b' });
      falso.entregar({
        tipo: 'construcao.aplicada',
        rev: 2,
        opId: 'op-colega-b',
        comandos: [{ tipo: 'item.adicionar', colecao: 'props', item: cadeiraB }],
        rotulo: 'Pôr cadeira',
      });
      assert.equal(rotuloDesfazerRemoto.peek(), 'Pôr mesa');
      assert.ok(s.doc.peek().props['cadeira-b']);

      // 3. Gesto em andamento: desfazerConstrucaoRemota() cancela o gesto e não mexe na pilha confirmada
      const gesto = s.store.iniciarGesto('Mover temporário');
      gesto.aplicar({ tipo: 'selecao.mover', alvos: [{ colecao: 'props', id: 'mesa-a' }], delta: [3, 0] });
      assert.equal(s.store.emGesto, true);
      const resGesto = desfazerConstrucaoRemota();
      assert.equal(resGesto, '');
      assert.equal(s.store.emGesto, false);
      assert.deepEqual(s.doc.peek().props['mesa-a']!.position, [4, 4]);
      assert.equal(podeDesfazerRemoto.peek(), true);

      // 4. desfazerConstrucaoRemota() (via app.desfazer()) envia construcao.comando compensatório e habilita refazer
      falso.enviadas.length = 0;
      desfazerApp();
      assert.equal(falso.enviadas.length, 1);
      const msgDesf = falso.enviadas[0] as { tipo: string; opId: string; comandos: Comando[]; rotulo: string };
      assert.equal(msgDesf.tipo, 'construcao.comando');
      assert.deepEqual(msgDesf.comandos, [{ tipo: 'item.remover', colecao: 'props', id: 'mesa-a' }]);
      assert.equal(s.doc.peek().props['mesa-a'], undefined);
      assert.ok(s.doc.peek().props['cadeira-b'], 'cadeira de B permanece intacta');
      assert.equal(podeDesfazerRemoto.peek(), false);
      assert.equal(podeRefazerRemoto.peek(), true);
      assert.equal(rotuloRefazerRemoto.peek(), 'Pôr mesa');

      // Confirmação do undo não apaga a pilha de refazer
      falso.entregar({
        tipo: 'construcao.aplicada',
        rev: 3,
        opId: msgDesf.opId,
        comandos: msgDesf.comandos,
        rotulo: msgDesf.rotulo,
      });
      assert.equal(podeRefazerRemoto.peek(), true);
      assert.equal(podeDesfazerRemoto.peek(), false);

      // 5. refazerConstrucaoRemota() (via app.refazer()) envia construcao.comando de refazer
      falso.enviadas.length = 0;
      refazerApp();
      assert.equal(falso.enviadas.length, 1);
      const msgRef = falso.enviadas[0] as { tipo: string; opId: string; comandos: Comando[]; rotulo: string };
      assert.equal(msgRef.tipo, 'construcao.comando');
      assert.equal(msgRef.comandos[0]!.tipo, 'item.adicionar');
      assert.ok(s.doc.peek().props['mesa-a']);
      assert.equal(podeRefazerRemoto.peek(), false);
      assert.equal(podeDesfazerRemoto.peek(), true);

      falso.entregar({
        tipo: 'construcao.aplicada',
        rev: 4,
        opId: msgRef.opId,
        comandos: msgRef.comandos,
        rotulo: msgRef.rotulo,
      });

      // Desfaz de novo para testar limpeza de refazer quando há nova edição própria
      falso.enviadas.length = 0;
      const rotuloDesf2 = desfazerConstrucaoRemota();
      assert.equal(rotuloDesf2, 'Pôr mesa');
      const msgDesf2 = falso.enviadas[0] as { opId: string; comandos: Comando[] };
      falso.entregar({ tipo: 'construcao.aplicada', rev: 5, opId: msgDesf2.opId, comandos: msgDesf2.comandos });
      assert.equal(podeRefazerRemoto.peek(), true);

      // 6. Nova edição própria confirmada limpa podeRefazerRemoto
      falso.enviadas.length = 0;
      s.store.executar({ tipo: 'mapa.renomear', nome: 'Forte Novo' }, { rotulo: 'Renomear mapa' });
      const msgRen = falso.enviadas[0] as { opId: string; comandos: Comando[] };
      falso.entregar({ tipo: 'construcao.aplicada', rev: 6, opId: msgRen.opId, comandos: msgRen.comandos });
      assert.equal(podeRefazerRemoto.peek(), false);
      assert.equal(podeDesfazerRemoto.peek(), true);
      assert.equal(rotuloDesfazerRemoto.peek(), 'Renomear mapa');

      // 7. construcao.estado (troca de mapa) limpa a pilha e os signals
      falso.entregar({
        tipo: 'construcao.estado',
        rev: 0,
        mapa: criarMapa({ id: 'outro-mapa', nome: 'Outro' }),
        ops: [],
      });
      assert.equal(podeDesfazerRemoto.peek(), false);
      assert.equal(podeRefazerRemoto.peek(), false);
      assert.equal(rotuloDesfazerRemoto.peek(), '');
      assert.equal(rotuloRefazerRemoto.peek(), '');

      // Sem nada para desfazer/refazer retorna null
      assert.equal(desfazerConstrucaoRemota(), null);
      assert.equal(refazerConstrucaoRemota(), null);
    } finally {
      ponte.parar();
      assert.equal(podeDesfazerRemoto.peek(), false);
      assert.equal(podeRefazerRemoto.peek(), false);
      rota.value = antigaRota;
      sessao.value = null;
      modo.value = 'construir';
    }
  });
});
