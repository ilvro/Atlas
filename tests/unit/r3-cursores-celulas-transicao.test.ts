import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { criarRef } from '#mesa';
import { codificar, normalizar, subtrair } from '../../src/domain/celulas.ts';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { novaLuz, novaPeca } from '../../src/domain/fabrica.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { DURACAO_PING_MS, pingsAtivos, TOLERANCIA_SKEW_RELOGIO_MS, type Ping } from '../../src/domain/pings.ts';
import { transferirJogadoresParaMapa } from '../../src/domain/transicao-mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { mapaCompleto } from './fixtures.ts';

const caminhoDoErro = (m: unknown): string | null => {
  try {
    validarMapa(m);
    return null;
  } catch (e) {
    if (e instanceof ErroDeValidacao) return e.caminho;
    throw e;
  }
};

describe('Ficha R3: pings, celulas, transicao-mapa e validacao', () => {
  it('pingsAtivos tolera clock skew positivo (+500 ms) mas continua expirando após DURACAO_PING_MS e descartando futuro extremo', () => {
    const ping: Ping = {
      id: 'p1',
      mapa: 'm1',
      ponto: [2, 3],
      levelId: null,
      discordId: 'u1',
      nome: 'Ana',
      papel: 'jogador',
      em: 10_000,
    };

    assert.equal(pingsAtivos([ping], 9_500).length, 1);
    assert.equal(pingsAtivos([ping], 10_000 - TOLERANCIA_SKEW_RELOGIO_MS).length, 1);
    assert.equal(pingsAtivos([ping], 10_000 - TOLERANCIA_SKEW_RELOGIO_MS - 1).length, 0);
    assert.equal(pingsAtivos([ping], 10_000 + DURACAO_PING_MS - 1).length, 1);
    assert.equal(pingsAtivos([ping], 10_000 + DURACAO_PING_MS).length, 0);
  });

  it('celulas não sofre colisão de hash até x <= 200_000 (multiplicador 200_003)', () => {
    // Sob 100_003, (100_005, 0) colidia com (2, 1) porque 0*100_003 + 100_005 === 1*100_003 + 2
    const norm = normalizar([[100_005, 0], [2, 1], [199_999, 0], [0, 1]]);
    assert.equal(norm.length, 4);
    assert.deepEqual(norm, [[100_005, 0], [199_999, 0], [0, 1], [2, 1]]);

    const faixasA = codificar([[100_005, 0], [2, 1]]);
    const faixasB = codificar([[2, 1]]);
    assert.deepEqual(subtrair(faixasA, faixasB), [[0, 100_005, 1]]);

    // Também não colide no limite exato x0 + n = 200_000 (x = 199_999..200_000)
    const limite = normalizar([[200_000, 0], [0, 1]]);
    assert.deepEqual(limite, [[200_000, 0], [0, 1]]);
  });

  it('transferirJogadoresParaMapa gera novo ID para luz portada quando o ID já existe no destino', () => {
    const origem = criarMapa({ id: 'origem', nome: 'Origem', largura: 20, altura: 20 });
    const destino = criarMapa({ id: 'destino', nome: 'Destino', largura: 20, altura: 20 });

    const luzDestinoExistente = novaLuz([10, 10], { id: 'l-colisao', color: '#112233', radius: 4 });
    destino.lights[luzDestinoExistente.id] = luzDestinoExistente;

    // Caso 1: peça nova no destino com lightId colidente
    const luzOrigem1 = novaLuz([2, 2], { id: 'l-colisao', ownerId: 't1', color: '#ffaa00', radius: 7 });
    origem.lights[luzOrigem1.id] = luzOrigem1;
    origem.tokens.t1 = novaPeca([2, 2], 'Arthur', {
      id: 't1',
      player: true,
      lightId: luzOrigem1.id,
    });

    // Caso 2: peça já existente no destino (por ref) sem luz própria, cuja luz de origem colide com outra luz do destino
    const luzDestinoExistente2 = novaLuz([14, 14], { id: 'l-colisao-2', color: '#445566', radius: 3 });
    destino.lights[luzDestinoExistente2.id] = luzDestinoExistente2;
    const refP2 = criarRef('ficha', 'personagem', 'kaiser-1');
    destino.tokens['t2-dest'] = novaPeca([3, 3], 'Kaiser', {
      id: 't2-dest',
      player: true,
      lightId: null,
      refs: [refP2],
    });
    const luzOrigem2 = novaLuz([5, 5], { id: 'l-colisao-2', ownerId: 't2', color: '#ffeeaa', radius: 6 });
    origem.lights[luzOrigem2.id] = luzOrigem2;
    origem.tokens.t2 = novaPeca([5, 5], 'Kaiser', {
      id: 't2',
      player: true,
      lightId: luzOrigem2.id,
      refs: [refP2],
    });

    const res = transferirJogadoresParaMapa(origem, destino, { toMapId: destino.id });
    assert.equal(caminhoDoErro(res.mapa), null);

    // As luzes pré-existentes no destino permanecem intactas
    assert.equal(res.mapa.lights['l-colisao']!.color, '#112233');
    assert.equal(res.mapa.lights['l-colisao']!.ownerId, null);
    assert.equal(res.mapa.lights['l-colisao-2']!.color, '#445566');
    assert.equal(res.mapa.lights['l-colisao-2']!.ownerId, null);

    // As duas peças transferidas receberam novos IDs únicos para suas luzes
    const t1Dest = res.mapa.tokens.t1!;
    assert.ok(t1Dest.lightId);
    assert.notEqual(t1Dest.lightId, 'l-colisao');
    assert.equal(res.mapa.lights[t1Dest.lightId!]!.id, t1Dest.lightId);
    assert.equal(res.mapa.lights[t1Dest.lightId!]!.ownerId, 't1');
    assert.equal(res.mapa.lights[t1Dest.lightId!]!.color, '#ffaa00');

    const t2Dest = res.mapa.tokens['t2-dest']!;
    assert.ok(t2Dest.lightId);
    assert.notEqual(t2Dest.lightId, 'l-colisao-2');
    assert.notEqual(t2Dest.lightId, t1Dest.lightId);
    assert.equal(res.mapa.lights[t2Dest.lightId!]!.id, t2Dest.lightId);
    assert.equal(res.mapa.lights[t2Dest.lightId!]!.ownerId, 't2-dest');
    assert.equal(res.mapa.lights[t2Dest.lightId!]!.color, '#ffeeaa');
  });

  it('validacao rejeita células de terrain.submerged fora dos limites do mapa', () => {
    const valido = structuredClone(mapaCompleto());
    const celT = Math.ceil(valido.bounds.width / valido.terrain.resolution);
    const linT = Math.ceil(valido.bounds.height / valido.terrain.resolution);

    valido.terrain.submerged = {
      t_grama: { material: 'grama', order: 0, cells: [[0, 0, celT], [linT - 1, 0, 1]] },
    };
    assert.equal(caminhoDoErro(valido), null);

    const foraY = structuredClone(valido);
    foraY.terrain.submerged = {
      t_grama: { material: 'grama', cells: [[linT, 0, 1]] },
    };
    assert.equal(caminhoDoErro(foraY), 'terrain.submerged.t_grama.cells');

    const foraX = structuredClone(valido);
    foraX.terrain.submerged = {
      t_grama: { material: 'grama', cells: [[0, celT - 1, 2]] },
    };
    assert.equal(caminhoDoErro(foraX), 'terrain.submerged.t_grama.cells');
  });
});
