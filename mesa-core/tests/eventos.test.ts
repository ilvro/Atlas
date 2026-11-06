import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBarramento, criarRef, validarEvento, CONTRATO, type Barramento, type Evento } from '../src/index.ts';

const ficha = criarRef('ficha', 'ficha', 's1'), mapa = criarRef('atlas', 'mapa', 'm1');
const base = (extra: Partial<Evento> & Record<string, unknown> = {}) => ({ contrato: CONTRATO, app: 'ficha', tipo: 'ficha.rolagem', id: 'e1', em: 1, campanhaId: null, dados: { ficha, titulo: 'Luta', total: 14 }, ...extra });
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));
const ate = async (ok: () => boolean, limite = 1000) => { const t = Date.now(); while (!ok() && Date.now() - t < limite) await esperar(5); };
const abertos: Barramento[] = [];
const novo = (app: Barramento['app'], extra: Parameters<typeof criarBarramento>[0] extends infer O ? Partial<O> : never = {}) => { const b = criarBarramento({ app, aviso: () => {}, ...extra }); abertos.push(b); return b; };

test('validarEvento aceita o formato do catálogo', () => assert.equal(validarEvento(base()).ok, true));

test('validarEvento recusa por formato, contrato, tipo, dono e dados', () => {
  const motivo = (v: unknown) => { const r = validarEvento(v); return r.ok ? 'ok' : r.motivo; };
  assert.equal(motivo(null), 'formato');
  assert.equal(motivo(base({ extra: 1 })), 'formato');
  assert.equal(motivo(base({ id: '' })), 'formato');
  assert.equal(motivo(base({ contrato: 2 })), 'contrato');
  assert.equal(motivo(base({ tipo: 'ficha.dancar' })), 'desconhecido');
  assert.equal(motivo(base({ app: 'atlas' })), 'dono');
  assert.equal(motivo(base({ dados: { ficha: 'x', titulo: 'a', total: 1 } })), 'dados');
  assert.equal(motivo(base({ dados: { ficha, titulo: 'a', total: Number.NaN } })), 'dados');
});

test('pedidos podem vir de qualquer aplicativo; fatos só do dono', () => {
  assert.equal(validarEvento(base({ app: 'atlas', tipo: 'jukebox.tocar', dados: { ref: mapa } })).ok, true);
  assert.equal(validarEvento(base({ app: 'atlas', tipo: 'jukebox.tocando', dados: { cena: null } })).ok, false);
  assert.equal(validarEvento(base({ app: 'jukebox', tipo: 'jukebox.tocando', dados: { cena: null } })).ok, true);
});

test('um evento emitido chega aos ouvintes do outro aplicativo e aos locais', async () => {
  const f = novo('ficha'), a = novo('atlas');
  const recebidos: Evento[] = [], locais: Evento[] = [];
  a.ouvir('ficha.rolagem', e => recebidos.push(e));
  f.ouvir('*', e => locais.push(e));
  f.emitir('ficha.rolagem', { ficha, titulo: 'Percepção', total: 17 });
  await ate(() => recebidos.length >= 1);
  assert.equal(recebidos.length, 1);
  assert.equal(recebidos[0]!.app, 'ficha');
  assert.deepEqual(recebidos[0]!.dados, { ficha, titulo: 'Percepção', total: 17 });
  assert.equal(locais.length, 1);
});

test('emitir um evento inválido lança e não envia', async () => {
  const f = novo('ficha'), a = novo('atlas'), recebidos: Evento[] = [];
  a.ouvir('*', e => recebidos.push(e));
  assert.throws(() => f.emitir('ficha.rolagem', { titulo: 'sem ficha' }), /Evento inválido \(dados\)/);
  assert.throws(() => f.emitir('atlas.cena-aberta', { mapa }), /Evento inválido \(dono\)/);
  await esperar(20);
  assert.equal(recebidos.length, 0);
});

test('pedir devolve a resposta de quem atende', async () => {
  const atlas = novo('atlas'), jukebox = novo('jukebox');
  let pedido: unknown;
  jukebox.atender('jukebox.tocar', dados => { pedido = dados; return { ok: true, dados: { tocando: true } }; });
  const r = await atlas.pedir('jukebox.tocar', { ref: criarRef('jukebox', 'cena-sonora', 'chuva') });
  assert.equal(r.ok, true);
  assert.deepEqual((pedido as { ref: unknown }).ref, criarRef('jukebox', 'cena-sonora', 'chuva'));
});

test('pedir sem ninguém atendendo termina por prazo, para o chamador oferecer abrir o aplicativo', async () => {
  const atlas = novo('atlas');
  const r = await atlas.pedir('ficha.abrir', { ref: ficha }, { prazoMs: 40 });
  assert.deepEqual(r, { ok: false, motivo: 'sem-resposta' });
});

test('quem atende pode recusar ou falhar', async () => {
  const atlas = novo('atlas'), ateliê = novo('atelie');
  ateliê.atender('atelie.abrir', () => ({ ok: false, motivo: 'documento na lixeira' }));
  assert.deepEqual(await atlas.pedir('atelie.abrir', { ref: criarRef('atelie', 'documento', 'd1') }), { ok: false, motivo: 'recusado', detalhe: 'documento na lixeira' });
  ateliê.atender('atelie.abrir', () => { throw new Error('quebrou'); });
  const r = await atlas.pedir('atelie.abrir', { ref: criarRef('atelie', 'documento', 'd1') });
  assert.equal(r.ok, false);
  assert.match(String((r as { detalhe?: string }).detalhe), /quebrou/);
});

test('só se pode atender e pedir o que é pedido do catálogo', async () => {
  const f = novo('ficha');
  assert.throws(() => f.atender('ficha.rolagem', () => ({ ok: true })), /não é um pedido/);
  await assert.rejects(f.pedir('ficha.rolagem', {}), /não é um pedido/);
});

test('evento desconhecido ou de outro contrato é ignorado e avisado uma vez só', async () => {
  const avisos: string[] = [];
  const a = novo('atlas', { aviso: m => avisos.push(m) });
  const bruto = new BroadcastChannel('mesa:eventos');
  for (let i = 0; i < 3; i++) bruto.postMessage(base({ tipo: 'ficha.dancar', id: `x${i}` }));
  bruto.postMessage(base({ contrato: 9 }));
  await esperar(30); bruto.close();
  assert.equal(avisos.length, 2);
  assert.match(avisos[0]!, /desconhecido/); assert.match(avisos[1]!, /contrato/);
  void a;
});

test('um ouvinte que falha não derruba os outros', async () => {
  const avisos: string[] = [], f = novo('ficha', { aviso: m => avisos.push(m) }), vistos: string[] = [];
  f.ouvir('*', () => { throw new Error('ouvinte ruim'); });
  f.ouvir('*', e => vistos.push(e.tipo));
  f.emitir('ficha.recursos', { ficha, pv: 3, pvMax: 15, pd: 4, pdMax: 17 });
  assert.deepEqual(vistos, ['ficha.recursos']);
  assert.match(avisos[0]!, /ouvinte ruim/);
});

test('o campanhaId do barramento vai no envelope', () => {
  const f = novo('ficha', { campanhaId: 'c1' }); let visto: Evento | undefined;
  f.ouvir('*', e => { visto = e; });
  f.emitir('ficha.recursos', { ficha, pv: 1, pvMax: 1, pd: 1, pdMax: 1 });
  assert.equal(visto?.campanhaId, 'c1');
});

test('validação de ficha.ajustar-recursos e atlas.preparar-cena', () => {
  // ficha.ajustar-recursos
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'ficha.ajustar-recursos',
      dados: { ficha, deltaPv: -5, deltaPd: 2 },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'ficha.ajustar-recursos',
      dados: { ficha, pv: 20 },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'ficha.ajustar-recursos',
      dados: { deltaPv: -5 },
    })).ok,
    false
  );

  // atlas.preparar-cena
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.preparar-cena',
      dados: { mapa, comodo: 'Taverna', clima: 'chuva' },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.preparar-cena',
      dados: { mapa: null },
    })).ok,
    true
  );
});

test.after(() => { for (const b of abertos) b.fechar(); });
