import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { recalcularParedes } from '../../src/domain/geometria.ts';
import { novaPeca, novoObjeto } from '../../src/domain/fabrica.ts';
import {
  aplicarVinculoDeVolta,
  criarTransicaoDeRetorno,
  entradasDeTransicao,
  jaTemVinculoDeVolta,
  posicoesDeChegadaDasPecas,
  resolverChegada,
  transicaoDaAbertura,
  transicaoDoObjeto,
  transicaoPertoDaPeca,
} from '../../src/domain/transicao-mapa.ts';
import { aplicarComando } from '../../src/state/comandos.ts';

const caminhoDoErro = (m: unknown): string | null => {
  try {
    validarMapa(m);
    return null;
  } catch (e) {
    if (e instanceof ErroDeValidacao) return e.caminho;
    throw e;
  }
};

function criarMapaComComodo(): MapaAtlas {
  const m = criarMapa({ id: 'mapa-1', nome: 'Rua do Porto', largura: 30, altura: 20, celula: 1.5 });
  m.rooms.r1 = {
    id: 'r1',
    name: 'Salão da Taverna',
    function: 'sala',
    cells: [
      [2, 2, 4],
      [3, 2, 4],
      [4, 2, 4],
      [5, 2, 4],
    ],
    floor: { material: 'madeira', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof: { material: null, visible: true },
    levelId: null,
  };
  recalcularParedes(m);
  const paredeTopo = Object.values(m.walls).find(w => w.path[0]![1] === 3 && w.path[1]![1] === 3)!;
  m.openings.porta1 = {
    id: 'porta1',
    wallId: paredeTopo.id,
    at: 0.5,
    width: 1.2,
    kind: 'door',
    state: 'closed',
    material: 'madeira',
    som: null,
    swing: 'a',
  };
  m.openings.janela1 = {
    id: 'janela1',
    wallId: paredeTopo.id,
    at: 0.2,
    width: 1.0,
    kind: 'window',
    state: 'closed',
    material: 'vidro',
    som: null,
    swing: 'a',
  };
  m.props.escada1 = novoObjeto([6, 6], {
    id: 'escada1',
    roomId: 'r1',
    source: { kind: 'recipe', recipe: 'escada.madeira', seed: 1, params: {} },
  });
  return m;
}

test('validação: aceita transition em Abertura e toMapId em escada mesmo em mapa de 1 só andar', () => {
  const m = criarMapaComComodo();
  m.openings.porta1!.transition = {
    toMapId: 'mapa-taverna',
    toTargetId: 'porta-entrada',
    toLevel: null,
    toPosition: [4.5, 3.9],
    label: 'Interior da Taverna',
  };
  assert.equal(caminhoDoErro(m), null);

  // transition nula ou ausente também é válida
  m.openings.porta1!.transition = null;
  assert.equal(caminhoDoErro(m), null);

  // Recusa toMapId vazio ou inválido
  m.openings.porta1!.transition = { toMapId: '' };
  assert.equal(caminhoDoErro(m), 'openings.porta1.transition.toMapId');
  m.openings.porta1!.transition = null;

  // Escada vinculada a outro mapa em mapa de 1 só andar (térreo -> térreo ou térreo -> andar do destino)
  m.props.escada1!.interaction = {
    kind: 'stairs',
    on: false,
    targets: [],
    sound: null,
    clue: null,
    toMapId: 'masmorra-subterranea',
    toTargetId: 'escada-chegada',
    toLevel: 'andar-2-destino',
    toPosition: [9, 12],
  };
  assert.equal(caminhoDoErro(m), null);

  // Mesmo toLevel === null (igual ao andar atual null) é aceito quando toMapId está definido
  m.props.escada1!.interaction.toLevel = null;
  assert.equal(caminhoDoErro(m), null);

  // Sem toMapId, escada para o mesmo andar ou andar inexistente continua sendo recusada
  m.props.escada1!.interaction.toMapId = null;
  assert.equal(caminhoDoErro(m), 'props.escada1.interaction.toLevel');
});

test('entradasDeTransicao: lista portas/arcos e escadas/alçapões ignorando janelas e objetos comuns', () => {
  const m = criarMapaComComodo();
  m.props.mesa = novoObjeto([4.5, 4.5], {
    id: 'mesa',
    roomId: 'r1',
    source: { kind: 'recipe', recipe: 'mesa.retangular', seed: 1, params: {} },
  });

  const entradas = entradasDeTransicao(m);
  assert.equal(entradas.length, 2);

  const entradaPorta = entradas.find(e => e.id === 'porta1');
  assert.ok(entradaPorta);
  assert.equal(entradaPorta.colecao, 'openings');
  assert.equal(entradaPorta.levelId, null);
  assert.deepEqual(entradaPorta.posicao, [6, 3]);
  assert.ok(entradaPorta.nome.includes('Porta'));
  assert.ok(entradaPorta.nome.includes('Salão da Taverna'));

  const entradaEscada = entradas.find(e => e.id === 'escada1');
  assert.ok(entradaEscada);
  assert.equal(entradaEscada.colecao, 'props');
  assert.equal(entradaEscada.levelId, null);
  assert.deepEqual(entradaEscada.posicao, [6, 6]);
});

test('resolverChegada: resolve porta com deslocamento para dentro do cômodo, escada, fallback toPosition e centro', () => {
  const destino = criarMapaComComodo();
  destino.levels = {
    porao: { id: 'porao', name: 'Porão', order: -1 },
  };
  destino.props.escadaPorao = novoObjeto([7.5, 8], {
    id: 'escadaPorao',
    levelId: 'porao',
    source: { kind: 'recipe', recipe: 'alcapao', seed: 2, params: {} },
  });

  // 1. Chegada numa porta existente: desloca 0.9 m para dentro do cômodo (y = 3 + 0.9 = 3.9)
  const chegadaPorta = resolverChegada(destino, {
    toMapId: destino.id,
    toTargetId: 'porta1',
  });
  assert.equal(chegadaPorta.alvoId, 'porta1');
  assert.equal(chegadaPorta.levelId, null);
  assert.equal(chegadaPorta.posicao[0], 6);
  assert.ok(Math.abs(chegadaPorta.posicao[1] - 3.9) < 1e-4);

  // 2. Chegada numa escada existente em outro andar
  const chegadaEscada = resolverChegada(destino, {
    toMapId: destino.id,
    toTargetId: 'escadaPorao',
  });
  assert.equal(chegadaEscada.alvoId, 'escadaPorao');
  assert.equal(chegadaEscada.levelId, 'porao');
  assert.deepEqual(chegadaEscada.posicao, [7.5, 8]);

  // 3. Fallback para toPosition e toLevel quando toTargetId foi removido
  const chegadaPosicao = resolverChegada(destino, {
    toMapId: destino.id,
    toTargetId: 'alvo-apagado',
    toLevel: 'porao',
    toPosition: [12, 14],
  });
  assert.equal(chegadaPosicao.alvoId, null);
  assert.equal(chegadaPosicao.levelId, 'porao');
  assert.deepEqual(chegadaPosicao.posicao, [12, 14]);

  // 4. Fallback para o centro do mapa no térreo quando nada existe
  const chegadaCentro = resolverChegada(destino, {
    toMapId: destino.id,
    toTargetId: 'alvo-apagado',
  });
  assert.equal(chegadaCentro.alvoId, null);
  assert.equal(chegadaCentro.levelId, null);
  assert.deepEqual(chegadaCentro.posicao, [15, 10]);
});

test('posicoesDeChegadaDasPecas: distribui grupo de jogadores ao redor da chegada dentro dos limites', () => {
  const destino = criarMapaComComodo();
  const posicoes = posicoesDeChegadaDasPecas(destino, [6, 3.9], 4);
  assert.equal(posicoes.length, 4);
  assert.deepEqual(posicoes[0], [6, 3.9]);

  const unicas = new Set(posicoes.map(p => `${p[0]},${p[1]}`));
  assert.equal(unicas.size, 4);
  for (const [x, y] of posicoes) {
    assert.ok(x >= 0 && x <= destino.bounds.width);
    assert.ok(y >= 0 && y <= destino.bounds.height);
  }
});

test('transicaoPertoDaPeca: encontra porta e escada vinculadas a até 1,5 m no mesmo andar', () => {
  const m = criarMapaComComodo();
  m.openings.porta1!.transition = { toMapId: 'mapa-taverna', toTargetId: 'porta-entrada' };
  m.props.escada1!.interaction = {
    kind: 'stairs',
    on: false,
    targets: [],
    sound: null,
    clue: null,
    toMapId: 'mapa-porao',
    toTargetId: 'escada-porao',
  };

  assert.equal(transicaoDaAbertura(m.openings.porta1!)?.toMapId, 'mapa-taverna');
  assert.equal(transicaoDoObjeto(m.props.escada1!)?.toMapId, 'mapa-porao');

  // Peça perto da porta (6, 3)
  const pecaPertoPorta = novaPeca([6, 4.1], 'Arthur', { player: true });
  const achadaPorta = transicaoPertoDaPeca(m, pecaPertoPorta);
  assert.ok(achadaPorta);
  assert.equal(achadaPorta.colecao, 'openings');
  assert.equal(achadaPorta.id, 'porta1');
  assert.equal(achadaPorta.transicao.toMapId, 'mapa-taverna');

  // Peça perto da escada (6, 6)
  const pecaPertoEscada = novaPeca([6.5, 6.4], 'Kaiser', { player: true });
  const achadaEscada = transicaoPertoDaPeca(m, pecaPertoEscada);
  assert.ok(achadaEscada);
  assert.equal(achadaEscada.colecao, 'props');
  assert.equal(achadaEscada.id, 'escada1');
  assert.equal(achadaEscada.transicao.toMapId, 'mapa-porao');

  // Peça em outro andar não aciona
  const pecaOutroAndar = novaPeca([6, 4.1], 'Joui', { player: true, levelId: 'andar-1' });
  assert.equal(transicaoPertoDaPeca(m, pecaOutroAndar), null);

  // Peça longe (> 1.5 m) não aciona
  const pecaLonge = novaPeca([15, 15], 'Erin', { player: true });
  assert.equal(transicaoPertoDaPeca(m, pecaLonge), null);
});

test('comandos e vínculo de volta: abertura.atualizar grava transition e aplicarVinculoDeVolta cria vínculo recíproco em porta e escada', () => {
  const mapaA = criarMapaComComodo();
  const mapaB = criarMapaComComodo();
  mapaB.id = 'mapa-taverna';
  mapaB.name = 'Interior da Taverna';

  // 1. Vincula porta1 do Mapa A à porta1 do Mapa B via comando abertura.atualizar
  const mapaAVinculado = aplicarComando(mapaA, {
    tipo: 'abertura.atualizar',
    id: 'porta1',
    patch: {
      transition: {
        toMapId: mapaB.id,
        toTargetId: 'porta1',
        toLevel: null,
        toPosition: [6, 3],
        label: mapaB.name,
      },
    },
  });
  assert.equal(mapaAVinculado.openings.porta1?.transition?.toMapId, 'mapa-taverna');
  assert.equal(mapaAVinculado.openings.porta1?.transition?.toTargetId, 'porta1');

  // 2. Gera transição de retorno de porta1 do Mapa A e aplica na porta1 do Mapa B
  const retornoPorta = criarTransicaoDeRetorno(mapaAVinculado, { colecao: 'openings', id: 'porta1' });
  assert.ok(retornoPorta);
  assert.equal(retornoPorta.toMapId, 'mapa-1');
  assert.equal(retornoPorta.toTargetId, 'porta1');
  assert.deepEqual(retornoPorta.toPosition, [6, 3]);

  assert.equal(jaTemVinculoDeVolta(mapaB, 'porta1', 'mapa-1', 'porta1'), false);
  const mapaBComVoltaPorta = aplicarVinculoDeVolta(mapaB, 'porta1', retornoPorta);
  assert.ok(mapaBComVoltaPorta);
  assert.equal(caminhoDoErro(mapaBComVoltaPorta), null);
  assert.equal(jaTemVinculoDeVolta(mapaBComVoltaPorta, 'porta1', 'mapa-1', 'porta1'), true);
  assert.equal(mapaBComVoltaPorta.openings.porta1?.transition?.toMapId, 'mapa-1');
  assert.equal(mapaBComVoltaPorta.openings.porta1?.transition?.toTargetId, 'porta1');

  // 3. Vínculo de volta em escada (props) no Mapa B
  const retornoEscada = criarTransicaoDeRetorno(mapaAVinculado, { colecao: 'props', id: 'escada1' });
  assert.ok(retornoEscada);
  assert.equal(jaTemVinculoDeVolta(mapaB, 'escada1', 'mapa-1', 'escada1'), false);

  const mapaBComVoltaEscada = aplicarVinculoDeVolta(mapaB, 'escada1', retornoEscada);
  assert.ok(mapaBComVoltaEscada);
  assert.equal(caminhoDoErro(mapaBComVoltaEscada), null);
  assert.equal(jaTemVinculoDeVolta(mapaBComVoltaEscada, 'escada1', 'mapa-1', 'escada1'), true);
  assert.equal(mapaBComVoltaEscada.props.escada1?.interaction?.kind, 'stairs');
  assert.equal(mapaBComVoltaEscada.props.escada1?.interaction?.toMapId, 'mapa-1');
  assert.equal(mapaBComVoltaEscada.props.escada1?.interaction?.toTargetId, 'escada1');

  // 4. Alvo inexistente devolve null
  assert.equal(aplicarVinculoDeVolta(mapaB, 'inexistente', retornoPorta), null);
});

