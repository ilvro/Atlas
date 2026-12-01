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

import {
  cursoresAtivos,
  deveEnviarCursor,
  EXPIRACAO_CURSOR_MS,
  INTERVALO_ENVIO_CURSOR_MS,
  registrarCursorRemoto,
  TOLERANCIA_SKEW_RELOGIO_MS,
  type CursorRemoto,
} from '../../src/domain/cursores-remotos.ts';
import { corDoPing } from '../../src/domain/pings.ts';
import {
  cursoresRemotos,
  enviarCursorRemoto,
  iniciarConstrucaoRemota,
  meuDiscordIdRemoto,
  type CanalConstrucaoLike,
} from '../../src/app/construcao-remota.ts';
import { modo } from '../../src/app/modo.ts';
import { lerRota, rota } from '../../src/app/rotas.ts';
import { sessao } from '../../src/app/sessao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';

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

describe('cursores-remotos (S5)', () => {
  it('cursoresAtivos filtra por levelId, expira após 5 s, ignora meuDiscordId e gera cor estável com corDoPing', () => {
    const cMestre: CursorRemoto = {
      discordId: 'mestre-1',
      nome: 'Mestre',
      cor: corDoPing('mestre-1', 'mestre'),
      x: 5,
      y: 6,
      levelId: null,
      ferramenta: 'comodo',
      pintando: true,
      atualizadoEm: 1000,
    };
    const cJogA: CursorRemoto = {
      discordId: 'jog-a',
      nome: 'Ana',
      cor: corDoPing('jog-a', 'jogador'),
      x: 10,
      y: 12,
      levelId: 'l2',
      ferramenta: 'parede',
      pintando: false,
      atualizadoEm: 2000,
    };
    const cJogB: CursorRemoto = {
      discordId: 'jog-b',
      nome: 'Beto',
      cor: corDoPing('jog-b', 'jogador'),
      x: 3,
      y: 4,
      levelId: null,
      ferramenta: 'terreno',
      pintando: false,
      atualizadoEm: 3000,
    };

    const lista = [cMestre, cJogA, cJogB];

    // Cor estável com corDoPing: mestre fixo e jogadores estáveis
    assert.equal(cMestre.cor, corDoPing('outro-mestre', 'mestre'));
    assert.equal(cJogA.cor, corDoPing('jog-a', 'jogador'));
    assert.match(cJogA.cor, /^#[0-9a-f]{6}$/);

    // No térreo (levelId: null) em t=3500, exclui jog-a (l2) e opcionalmente ignora meuDiscordId
    const terreo = cursoresAtivos(lista, 3500, { levelId: null, meuDiscordId: 'mestre-1' });
    assert.deepEqual(terreo.map(c => c.discordId), ['jog-b']);

    // No andar l2 em t=3500, mostra apenas jog-a
    const andar2 = cursoresAtivos(lista, 3500, { levelId: 'l2' });
    assert.deepEqual(andar2.map(c => c.discordId), ['jog-a']);

    // Expiração exatamente em 5000 ms (4999 ativo, 5000 expirado)
    assert.equal(cursoresAtivos([cMestre], 1000 + EXPIRACAO_CURSOR_MS - 1).length, 1);
    assert.equal(cursoresAtivos([cMestre], 1000 + EXPIRACAO_CURSOR_MS).length, 0);
    // Leve dessincronia positiva (+500 ms no futuro) é tolerada; futuro extremo (> 60 s) é descartado
    assert.equal(cursoresAtivos([cMestre], 500).length, 1);
    assert.equal(cursoresAtivos([cMestre], 1000 - TOLERANCIA_SKEW_RELOGIO_MS).length, 1);
    assert.equal(cursoresAtivos([cMestre], 1000 - TOLERANCIA_SKEW_RELOGIO_MS - 1).length, 0);
  });

  it('cursores-remotos tolera clock skew positivo (+500 ms) e ignora entradas já expiradas em registrarCursorRemoto', () => {
    const base: CursorRemoto = {
      discordId: 'u-ativo',
      nome: 'Ativo',
      cor: corDoPing('u-ativo', 'jogador'),
      x: 4,
      y: 5,
      levelId: null,
      ferramenta: 'parede',
      pintando: false,
      atualizadoEm: 10_000,
    };

    // Entrada com +500 ms de skew em relação a `agora` é aceita e preservada por cursoresAtivos
    let lista = registrarCursorRemoto(
      [base],
      {
        discordId: 'u-skew',
        nome: 'Remoto',
        x: 7,
        y: 8,
        levelId: null,
        ferramenta: 'comodo',
        atualizadoEm: 10_500,
      },
      10_000,
    );
    assert.deepEqual(lista.map(c => c.discordId), ['u-ativo', 'u-skew']);
    assert.deepEqual(cursoresAtivos(lista, 10_000).map(c => c.discordId), ['u-ativo', 'u-skew']);

    // Entrada já expirada em relação a `agora` é ignorada (não inserida), enquanto cursores válidos permanecem
    lista = registrarCursorRemoto(
      lista,
      {
        discordId: 'u-expirado',
        nome: 'Velho',
        x: 1,
        y: 1,
        levelId: null,
        ferramenta: 'selecionar',
        atualizadoEm: 4_000,
      },
      10_000,
    );
    assert.deepEqual(lista.map(c => c.discordId), ['u-ativo', 'u-skew']);
  });

  it('registrarCursorRemoto atualiza cursor existente sem duplicar e remove expirados', () => {
    let lista: CursorRemoto[] = [];
    lista = registrarCursorRemoto(lista, {
      discordId: 'u1',
      nome: 'Alice',
      papel: 'jogador',
      x: 1,
      y: 2,
      levelId: null,
      ferramenta: 'selecionar',
      pintando: false,
      atualizadoEm: 1000,
    });
    lista = registrarCursorRemoto(lista, {
      discordId: 'u2',
      nome: 'Mestre',
      papel: 'mestre',
      x: 3,
      y: 4,
      levelId: null,
      ferramenta: 'comodo',
      pintando: true,
      atualizadoEm: 2000,
    });
    assert.equal(lista.length, 2);

    // Atualiza u1 aos 3000 ms (ainda não expirou u2)
    lista = registrarCursorRemoto(lista, {
      discordId: 'u1',
      nome: 'Alice',
      papel: 'jogador',
      x: 8,
      y: 9,
      levelId: 'l2',
      ferramenta: 'parede',
      pintando: true,
      atualizadoEm: 3000,
    });
    assert.equal(lista.length, 2);
    const u1 = lista.find(c => c.discordId === 'u1')!;
    assert.equal(u1.x, 8);
    assert.equal(u1.y, 9);
    assert.equal(u1.levelId, 'l2');
    assert.equal(u1.pintando, true);
    assert.equal(u1.cor, corDoPing('u1', 'jogador'));

    // Novo cursor em 7500 ms remove u2 (atualizadoEm=2000 -> 5500 ms atrás >= 5000) e mantém u1 (4500 ms atrás)
    lista = registrarCursorRemoto(lista, {
      discordId: 'u3',
      nome: 'Cris',
      x: 12,
      y: 14,
      levelId: null,
      ferramenta: 'objeto',
      atualizadoEm: 7500,
    });
    assert.deepEqual(lista.map(c => c.discordId), ['u1', 'u3']);
  });

  it('deveEnviarCursor respeita throttle de ~15/s mas dispara imediatamente ao trocar pintando', () => {
    assert.equal(INTERVALO_ENVIO_CURSOR_MS, 67);
    assert.equal(deveEnviarCursor(1000, 1030, false, false), false);
    assert.equal(deveEnviarCursor(1000, 1066, false, false), false);
    assert.equal(deveEnviarCursor(1000, 1067, false, false), true);
    // Trocar pintando libera imediatamente mesmo dentro da janela de throttle
    assert.equal(deveEnviarCursor(1000, 1005, false, true), true);
    assert.equal(deveEnviarCursor(1000, 1005, true, false), true);
    assert.equal(deveEnviarCursor(1000, 1005, true, true), false);
  });

  it('construcao-remota integra cursores recebidos, envio com throttle e limpeza em parar()', () => {
    const falso = criarCanalFalso();
    const antigaRota = rota.value;
    rota.value = lerRota('#/construir-remoto/sala-cursores');
    let relogio = 10_000;

    const ponte = iniciarConstrucaoRemota({
      salaId: 'sala-cursores',
      criarCanal: () => falso.canal,
      agora: () => relogio,
    });

    try {
      const mapa = criarMapa({ id: 'm-cur', nome: 'Oficina' });
      falso.entregar({
        tipo: 'construcao.estado',
        rev: 0,
        mapa,
        ops: [],
        eu: { discordId: 'eu-123' },
      });
      assert.equal(meuDiscordIdRemoto.peek(), 'eu-123');

      falso.entregar({ tipo: 'construcao.identidade', discordId: 'eu-456' });
      assert.equal(meuDiscordIdRemoto.peek(), 'eu-456');

      falso.enviadas.length = 0;

      // Receber construcao.cursor popula cursoresRemotos
      falso.entregar({
        tipo: 'construcao.cursor',
        autor: { discordId: 'colega-1', nome: 'Lucas', papel: 'jogador', fichas: [] },
        x: 12.5,
        y: 8.25,
        levelId: null,
        ferramenta: 'comodo',
        pintando: true,
      });
      assert.equal(cursoresRemotos.peek().length, 1);
      assert.deepEqual(cursoresRemotos.peek()[0], {
        discordId: 'colega-1',
        nome: 'Lucas',
        cor: corDoPing('colega-1', 'jogador'),
        x: 12.5,
        y: 8.25,
        levelId: null,
        ferramenta: 'comodo',
        pintando: true,
        atualizadoEm: 10_000,
      });

      // Enviar via enviarCursorRemoto respeita throttle (~15/s) e troca imediata de pintando
      enviarCursorRemoto({ x: 1, y: 2, levelId: null, ferramenta: 'selecionar', pintando: false });
      assert.equal(falso.enviadas.length, 1);
      assert.deepEqual(falso.enviadas[0], {
        tipo: 'construcao.cursor',
        x: 1,
        y: 2,
        levelId: null,
        ferramenta: 'selecionar',
        pintando: false,
      });

      relogio += 20;
      enviarCursorRemoto({ x: 2, y: 3, levelId: null, ferramenta: 'selecionar', pintando: false });
      assert.equal(falso.enviadas.length, 1, 'dentro de 67 ms não deve reenviar');

      // Troca de pintando envia imediatamente mesmo em 20 ms
      relogio += 10;
      enviarCursorRemoto({ x: 2.5, y: 3.5, levelId: null, ferramenta: 'comodo', pintando: true });
      assert.equal(falso.enviadas.length, 2);
      assert.deepEqual(falso.enviadas[1], {
        tipo: 'construcao.cursor',
        x: 2.5,
        y: 3.5,
        levelId: null,
        ferramenta: 'comodo',
        pintando: true,
      });

      // Após >= 67 ms envia novamente
      relogio += INTERVALO_ENVIO_CURSOR_MS;
      enviarCursorRemoto({ x: 4, y: 5, levelId: 'l2', ferramenta: 'comodo', pintando: true });
      assert.equal(falso.enviadas.length, 3);

      // parar() limpa estado e desconecta emissor
      ponte.parar();
      assert.deepEqual(cursoresRemotos.peek(), []);
      assert.equal(meuDiscordIdRemoto.peek(), null);

      relogio += 1000;
      enviarCursorRemoto({ x: 9, y: 9, levelId: null, ferramenta: 'selecionar', pintando: false });
      assert.equal(falso.enviadas.length, 3, 'após parar() não deve mais emitir cursores');
    } finally {
      ponte.parar();
      rota.value = antigaRota;
      sessao.value = null;
      modo.value = 'construir';
    }
  });
});
