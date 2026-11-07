import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alvosDoInterruptor, acaoDoInterativo, ROTULO_DA_INTERACAO } from '../../src/domain/interagiveis.ts';
import { interagiveisPerto } from '../../src/domain/interacao.ts';
import { nivelDaLuz } from '../../src/domain/clima.ts';
import type { MapaAtlas } from '../../src/domain/mapa.ts';
import { aplicarComando, ErroDeComando } from '../../src/state/comandos.ts';
import { criarStore } from '../../src/state/store.ts';
import { SONS_DE_INTERACAO, tocar } from '../../src/fx/som.ts';
import { mapaCompleto } from './fixtures.ts';

/** A casa com duas luzes de rede (uma na sala, outra na biblioteca), a de fogo da sala e um interruptor na sala. */
function casa(extra: Record<string, unknown> = {}): MapaAtlas {
  const m = mapaCompleto(), luz = (id: string, x: number, y: number, power: 'grid' | 'fire') => ({ ...m.lights.lampiao!, id, position: [x, y] as [number, number], ownerId: null, power, on: true });
  m.lights.redeSala = luz('redeSala', 5, 5, 'grid'); m.lights.redeBiblioteca = luz('redeBiblioteca', 15, 4, 'grid');
  m.props.interruptor = { ...m.props.mesa!, id: 'interruptor', position: [4, 3.1], elevation: 'floor', roomId: 'sala', interaction: { kind: 'switch', on: true, targets: [], sound: null, clue: null }, ...extra } as never;
  return m;
}

test('um interruptor sem alvos controla as luzes de rede do cômodo e não as de fogo', () => {
  const m = casa();
  assert.deepEqual(alvosDoInterruptor(m, m.props.interruptor!), ['redeSala']);
  const apagado = aplicarComando(m, { tipo: 'interagir', id: 'interruptor' });
  assert.equal(apagado.props.interruptor!.interaction!.on, false);
  assert.equal(apagado.lights.redeSala!.on, false); assert.equal(apagado.lights.lampiao!.on, true, 'a de fogo fica'); assert.equal(apagado.lights.redeBiblioteca!.on, true, 'a de outro cômodo fica');
  const aceso = aplicarComando(apagado, { tipo: 'interagir', id: 'interruptor' });
  assert.equal(aceso.lights.redeSala!.on, true);
});

test('com alvos escolhidos, só eles; alvo que sumiu cai no padrão', () => {
  const m = casa({ interaction: { kind: 'switch', on: true, targets: ['redeBiblioteca', 'lampiao'], sound: null, clue: null } });
  assert.deepEqual(alvosDoInterruptor(m, m.props.interruptor!), ['redeBiblioteca', 'lampiao']);
  const r = aplicarComando(m, { tipo: 'interagir', id: 'interruptor' });
  assert.equal(r.lights.redeBiblioteca!.on, false); assert.equal(r.lights.lampiao!.on, false); assert.equal(r.lights.redeSala!.on, true);
});

test('usar o interruptor é uma entrada de histórico e desfazer devolve as luzes', () => {
  const st = criarStore(casa());
  st.executar({ tipo: 'interagir', id: 'interruptor' }, { rotulo: 'Interruptor' });
  assert.equal(st.documento.lights.redeSala!.on, false); assert.equal(st.historico.at(-1), 'Interruptor');
  st.desfazer(); assert.equal(st.documento.lights.redeSala!.on, true); assert.equal(st.documento.props.interruptor!.interaction!.on, true);
});

test('a gaveta só alterna o estado; objeto comum e pista recusam', () => {
  const m = casa({ interaction: { kind: 'drawer', on: false, targets: [], sound: null, clue: null } });
  const r = aplicarComando(m, { tipo: 'interagir', id: 'interruptor' });
  assert.equal(r.props.interruptor!.interaction!.on, true); assert.equal(r.lights.redeSala!.on, true, 'gaveta não mexe nas luzes');
  assert.throws(() => aplicarComando(casa(), { tipo: 'interagir', id: 'mesa' }), ErroDeComando);
  assert.throws(() => aplicarComando(casa({ interaction: { kind: 'clue', on: false, targets: [], sound: null, clue: null } }), { tipo: 'interagir', id: 'interruptor' }), ErroDeComando);
});

test('no apagão, o interruptor ligado não acende a luz de rede (o clima manda)', () => {
  const m = casa(); m.climate = { ...m.climate, gridPower: false };
  assert.equal(nivelDaLuz(m.lights.redeSala!, m), 0);
  const ligado = aplicarComando(aplicarComando(m, { tipo: 'interagir', id: 'interruptor' }), { tipo: 'interagir', id: 'interruptor' });
  assert.equal(ligado.lights.redeSala!.on, true); assert.equal(nivelDaLuz(ligado.lights.redeSala!, ligado), 0);
});

test('Enter: o interagível ao alcance da peça é achado, junto das portas', () => {
  const m = casa(), perto = interagiveisPerto(m, { position: [4, 4], facing: 'up' });
  assert.deepEqual(perto.map(x => [x.tipo, x.id]), [['objeto', 'interruptor']]);
  assert.deepEqual(interagiveisPerto(m, { position: [10, 8], facing: 'up' }), []);
});

test('cada som novo existe e tocar não lança sem AudioContext', () => {
  assert.deepEqual([...SONS_DE_INTERACAO], ['porta-abrir', 'porta-fechar', 'trancada', 'interruptor', 'gaveta']);
  for (const nome of SONS_DE_INTERACAO) assert.doesNotThrow(() => tocar(nome));
  assert.doesNotThrow(() => tocar('pop'));
});

test('objeto com nota: rótulo e ação retornam "Nota" e "Ler nota"', () => {
  const m = casa({ interaction: { kind: 'note', on: false, targets: [], sound: null, clue: null, note: 'Diário secreto', noteTitle: 'Diário', gmOnly: true } });
  assert.equal(ROTULO_DA_INTERACAO[m.props.interruptor!.interaction!.kind], 'Nota');
  assert.equal(acaoDoInterativo(m.props.interruptor!), 'Ler nota');
  const r = aplicarComando(m, { tipo: 'interagir', id: 'interruptor' });
  assert.equal(r.props.interruptor!.interaction!.kind, 'note');
});
