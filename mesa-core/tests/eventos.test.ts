import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarBarramento, CATALOGO, criarRef, validarEvento, CONTRATO, type Barramento, type Evento } from '../src/index.ts';

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
      dados: { mapa, comodo: 'Taverna', clima: 'chuva', fichas: [ficha] },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.preparar-cena',
      dados: { mapa, fichas: ['invalido' as never] },
    })).ok,
    false
  );
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.preparar-cena',
      dados: { mapa: null },
    })).ok,
    true
  );

  // jukebox.parar
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'jukebox.parar',
      dados: { ms: 800 },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'jukebox.parar',
      dados: {},
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'jukebox.parar',
      dados: { ms: 'rapido' },
    })).ok,
    false
  );

  // atlas.momento
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.momento',
      dados: { mapa, momento: 'susto-1' },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.momento',
      dados: { mapa, momento: 123 },
    })).ok,
    false
  );
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.momento',
      dados: { mapa: null, momento: 'susto-1' },
    })).ok,
    false
  );

  // atlas.inspecionado (fato de atlas)
  const objAlvo = criarRef('atlas', 'objeto', 'm1/o1');
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'atlas.inspecionado',
      dados: { mapa, alvo: objAlvo },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'mesa',
      tipo: 'atlas.inspecionado',
      dados: { mapa, alvo: objAlvo },
    })).ok,
    false
  );
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'atlas.inspecionado',
      dados: { mapa, alvo: 'invalido' },
    })).ok,
    false
  );

  // mesa.focar (pedido para mesa)
  const itemQuadro = criarRef('mesa', 'item', 'q1/it1');
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'mesa.focar',
      dados: { ref: itemQuadro },
    })).ok,
    true
  );
  assert.equal(
    validarEvento(base({
      app: 'atlas',
      tipo: 'mesa.focar',
      dados: { ref: 'invalido' },
    })).ok,
    false
  );
});

test.after(() => { for (const b of abertos) b.fechar(); });

test('autor: aceita o válido e recusa o malformado', () => {
  const autor = { discordId: '1', nome: 'Ana', papel: 'jogador', fichas: ['f1'] };
  assert.equal(validarEvento(base({ autor: autor as never })).ok, true);
  for (const ruim of [null as unknown, 'x', { ...autor, papel: 'rei' }, { ...autor, fichas: [1] }, { ...autor, nome: 2 }, { discordId: '1' }]) {
    const r = validarEvento(base({ autor: ruim as never }));
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.motivo, 'formato');
  }
});

test('entradas da sala: atlas.mover-peca, sala.fichas, sala.salvar-ficha e sala.ficha-atualizada', () => {
  const ok = (app: Evento['app'], tipo: string, dados: unknown) => validarEvento(base({ app, tipo, dados })).ok;
  assert.equal(ok('atlas', 'atlas.mover-peca', { mapa: 'm', peca: 'p', position: [1, 2] }), true);
  assert.equal(ok('atlas', 'atlas.mover-peca', { mapa: 'm', peca: 'p', position: [1, 2], levelId: null }), true);
  assert.equal(ok('atlas', 'atlas.mover-peca', { mapa: 'm', peca: 'p', position: [1, 2], levelId: 3 }), false);
  assert.equal(ok('atlas', 'atlas.mover-peca', { mapa: 'm', peca: 'p', position: [1] }), false);
  assert.equal(ok('atlas', 'atlas.mover-peca', { mapa: 'm', position: [1, 2] }), false);
  assert.equal(ok('ficha', 'sala.fichas', {}), true);
  assert.equal(ok('ficha', 'sala.salvar-ficha', { ficha: { id: 'f' }, rev: 2 }), true);
  assert.equal(ok('ficha', 'sala.salvar-ficha', { ficha: { id: 'f' } }), true);
  assert.equal(ok('ficha', 'sala.salvar-ficha', { ficha: { id: 5 } }), false);
  assert.equal(ok('ficha', 'sala.salvar-ficha', { ficha: { id: 'f' }, rev: 'x' }), false);
  assert.equal(ok('mesa', 'sala.ficha-atualizada', { ficha: { id: 'f' }, rev: 3, conflito: true }), true);
  assert.equal(ok('mesa', 'sala.ficha-atualizada', { ficha: { id: 'f' } }), false);
  assert.equal(ok('ficha', 'sala.ficha-atualizada', { ficha: { id: 'f' }, rev: 3 }), false);
});

test('entradas da sala da R13: sala.ficha-removida, sala.conexao e sala.entregar-ficha', () => {
  const ok = (app: Evento['app'], tipo: string, dados: unknown) => validarEvento(base({ app, tipo, dados })).ok;
  assert.equal(ok('mesa', 'sala.ficha-removida', { id: 'f' }), true);
  assert.equal(ok('mesa', 'sala.ficha-removida', { id: '' }), false);
  assert.equal(ok('ficha', 'sala.ficha-removida', { id: 'f' }), false);
  assert.equal(ok('mesa', 'sala.conexao', { conectada: true, nome: 'Mesa' }), true);
  assert.equal(ok('mesa', 'sala.conexao', { conectada: false }), true);
  assert.equal(ok('mesa', 'sala.conexao', { conectada: 'sim' }), false);
  assert.equal(ok('ficha', 'sala.entregar-ficha', { fichaId: 'f', dono: '2' }), true);
  assert.equal(ok('ficha', 'sala.entregar-ficha', { fichaId: 'f' }), false);
});

test('jukebox.mix, jukebox.efeito-tocado e jukebox.arquivo', async () => {
  const estado = { volume: 0.5, efeitos: ['lowpass'], ajustes: { lowpass: { frequency: 800 } }, regioes: [] };
  const faixa = { faixaId: 'ab12', url: 'sample/a.mp3', titulo: 'Chuva', loop: true, posicao: 12.5, taxa: 1, desde: 1000, pausada: false, estado };
  const mix = (dados: unknown, app: Evento['app'] = 'jukebox') => validarEvento(base({ app, tipo: 'jukebox.mix', dados }));
  assert.equal(mix({ cena: criarRef('jukebox', 'cena-sonora', 'c1'), mestre: 1, faixas: [faixa, { ...faixa, crossfade: true }] }).ok, true);
  assert.equal(mix({ cena: null, mestre: 1, faixas: [] }).ok, true);
  // a ponte do mestre tira `titulo`, `url` e `cena` antes de mandar à sala: continua válido
  const { titulo: _t, url: _u, ...semTexto } = faixa;
  assert.equal(mix({ mestre: 1, faixas: [semTexto] }).ok, true);
  assert.equal(mix({ cena: 'x', mestre: 1, faixas: [] }).ok, false);
  assert.equal(mix({ mestre: '1', faixas: [] }).ok, false);
  assert.equal(mix({ mestre: 1, faixas: {} }).ok, false);
  assert.equal(mix({ mestre: 1, faixas: [{ ...faixa, faixaId: '' }] }).ok, false);
  assert.equal(mix({ mestre: 1, faixas: [{ ...faixa, pausada: 'não' }] }).ok, false);
  assert.equal(mix({ mestre: 1, faixas: [{ ...faixa, posicao: Number.NaN }] }).ok, false);
  assert.equal(mix({ mestre: 1, faixas: [{ ...faixa, estado: { ...estado, efeitos: [1] } }] }).ok, false);
  assert.equal(mix({ mestre: 1, faixas: [{ ...faixa, estado: { volume: 1 } }] }).ok, false);
  assert.equal(mix({ mestre: 1, faixas: [faixa] }, 'atlas').ok, false);

  const tocado = (dados: unknown, app: Evento['app'] = 'jukebox') => validarEvento(base({ app, tipo: 'jukebox.efeito-tocado', dados })).ok;
  assert.equal(tocado({ faixaId: 'ab12', titulo: 'Trovão', estado }), true);
  assert.equal(tocado({ faixaId: 'ab12', url: 'sample/t.mp3', estado }), true);
  assert.equal(tocado({ titulo: 'Trovão', estado }), false);
  assert.equal(tocado({ faixaId: 'ab12', titulo: 'Trovão' }), false);
  assert.equal(tocado({ faixaId: 'ab12', titulo: 'Trovão', estado }, 'mesa'), false);

  const arquivo = (dados: unknown, app: Evento['app'] = 'mesa') => validarEvento(base({ app, tipo: 'jukebox.arquivo', dados })).ok;
  assert.equal(arquivo({ faixaId: 'ab12' }), true);
  assert.equal(arquivo({ faixaId: '' }), false);
  assert.equal(arquivo({}), false);
  assert.equal(arquivo({ faixaId: 7 }), false);
});

test('jukebox.ouvir', () => {
  const ouvir = (dados: unknown, app: Evento['app'] = 'mesa') => validarEvento(base({ app, tipo: 'jukebox.ouvir', dados })).ok;
  assert.equal(ouvir({ ligado: true }), true);
  assert.equal(ouvir({ ligado: false }), true);
  assert.equal(ouvir({}), false);
  assert.equal(ouvir({ ligado: 1 }), false);
  assert.equal(ouvir({ ligado: 'true' }), false);
  assert.equal(CATALOGO['jukebox.ouvir']?.natureza, 'pedido');
  assert.equal(CATALOGO['jukebox.ouvir']?.dono, 'jukebox');
});

test('a resposta de jukebox.arquivo, com um Blob, passa pela validação do envelope', () => {
  // O BroadcastChannel do Node não clona Blob (o dos navegadores clona); o ida e volta real foi conferido no Chromium.
  const resposta = (dados: unknown) => validarEvento(base({ app: 'jukebox', tipo: 'mesa.resposta', respondeA: 'p1', dados }));
  assert.equal(resposta({ ok: true, dados: { blob: new Blob([new Uint8Array([1, 2])], { type: 'audio/mpeg' }), tipo: 'audio/mpeg' } }).ok, true);
  assert.equal(resposta({ ok: false, motivo: 'desconhecida' }).ok, true);
});
