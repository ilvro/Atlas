import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { abrirRepositorioCampanha, criarRef } from '../src/index.ts';
import { conectarPonte, ferramentasDaCampanha, texto, json, imagem, type SocketMinimo, type FerramentaDaPonte } from '../src/ponte.ts';

class SocketFalso implements SocketMinimo {
  onopen: SocketMinimo['onopen'] = null; onmessage: SocketMinimo['onmessage'] = null; onclose: SocketMinimo['onclose'] = null; onerror: SocketMinimo['onerror'] = null;
  enviadas: Record<string, unknown>[] = []; fechou = false;
  readonly url: string;
  constructor(url: string) { this.url = url; }
  send(d: string) { this.enviadas.push(JSON.parse(d)); }
  close() { this.fechou = true; }
  abrir() { this.onopen?.({}); }
  receber(m: unknown) { this.onmessage?.({ data: JSON.stringify(m) }); }
  cair() { this.onclose?.({}); }
}
const esquema = { type: 'object', properties: {}, required: [] };
const ola: FerramentaDaPonte = { nome: 'ola', descricao: 'diz ola', esquema, executar: async a => [texto(`ola ${a.quem}`)] };
const quebra: FerramentaDaPonte = { nome: 'quebra', descricao: 'falha', esquema, executar: async () => { throw new Error('deu ruim'); } };
const tick = () => new Promise(r => setTimeout(r, 0));

function montar(ferramentas = [ola, quebra]) {
  const sockets: SocketFalso[] = [], agenda: { fn: () => void; ms: number }[] = [];
  const cliente = conectarPonte({
    app: 'teste', titulo: 'Teste', ferramentas, url: 'ws://x/__ponte',
    criarSocket: u => { const s = new SocketFalso(u); sockets.push(s); return s; },
    agendar: (fn, ms) => { const e = { fn, ms }; agenda.push(e); return e; },
    cancelar: () => {},
  });
  return { sockets, agenda, cliente };
}

test('ajudantes de conteúdo', () => {
  assert.deepEqual(texto('a'), { tipo: 'texto', texto: 'a' });
  assert.deepEqual(json({ a: 1 }), { tipo: 'texto', texto: '{"a":1}' });
  assert.deepEqual(imagem('data:image/png;base64,AAAA'), { tipo: 'imagem', dados: 'AAAA', mime: 'image/png' });
  assert.throws(() => imagem('nada'));
});

test('registra ao abrir, sem expor executar', () => {
  const { sockets, cliente } = montar();
  assert.equal(sockets[0]!.url, 'ws://x/__ponte');
  sockets[0]!.abrir();
  const reg = sockets[0]!.enviadas[0] as { tipo: string; app: string; ferramentas: Record<string, unknown>[] };
  assert.equal(reg.tipo, 'registrar'); assert.equal(reg.app, 'teste');
  assert.deepEqual(reg.ferramentas.map(f => Object.keys(f).sort()), [['descricao', 'esquema', 'nome'], ['descricao', 'esquema', 'nome']]);
  cliente.fechar();
});

test('responde chamar com resultado e com erro', async () => {
  const { sockets, cliente } = montar();
  const s = sockets[0]!; s.abrir();
  s.receber({ tipo: 'chamar', id: '1', ferramenta: 'ola', args: { quem: 'mundo' } });
  s.receber({ tipo: 'chamar', id: '2', ferramenta: 'quebra', args: {} });
  s.receber({ tipo: 'chamar', id: '3', ferramenta: 'nao-existe', args: {} });
  await tick();
  const res = s.enviadas.filter(m => m.tipo === 'resultado').sort((a, b) => String(a.id).localeCompare(String(b.id)));
  assert.deepEqual(res[0], { tipo: 'resultado', id: '1', ok: true, conteudo: [{ tipo: 'texto', texto: 'ola mundo' }] });
  assert.deepEqual(res[1], { tipo: 'resultado', id: '2', ok: false, erro: 'deu ruim' });
  assert.equal(res[2]!.ok, false);
  cliente.fechar();
});

test('atualizar registra de novo; fechar fecha o socket e não reconecta', () => {
  const { sockets, agenda, cliente } = montar();
  sockets[0]!.abrir();
  cliente.atualizar([ola]);
  const reg = sockets[0]!.enviadas.filter(m => m.tipo === 'registrar');
  assert.equal(reg.length, 2); assert.equal((reg[1]!.ferramentas as unknown[]).length, 1);
  cliente.fechar(); assert.equal(sockets[0]!.fechou, true);
  sockets[0]!.cair(); assert.equal(agenda.length, 0);
});

test('reconecta com 1 s, 2 s, 5 s e depois 10 s; abrir zera a espera', () => {
  const { sockets, agenda, cliente } = montar();
  const esperas: number[] = [];
  for (let i = 0; i < 5; i++) { sockets.at(-1)!.cair(); esperas.push(agenda.at(-1)!.ms); agenda.at(-1)!.fn(); }
  assert.deepEqual(esperas, [1000, 2000, 5000, 10000, 10000]);
  assert.equal(sockets.length, 6);
  sockets.at(-1)!.abrir(); sockets.at(-1)!.cair();
  assert.equal(agenda.at(-1)!.ms, 1000);
  cliente.fechar();
});

test('ferramentas da campanha: esquemas válidos, leitura e sem blobs', async () => {
  const idb = new IDBFactory();
  const repo = await abrirRepositorioCampanha({ app: 'mesa', idb });
  const c = await repo.criarCampanha({ nome: 'Ilha', sistema: 'ordem-paranormal' });
  await repo.criarCampanha({ nome: 'Casa' });
  const mapa = criarRef('atlas', 'mapa', 'm1');
  const e = await repo.criarEntidade({ campanhaId: c.id, tipo: 'lugar', nome: 'Farol', tags: ['costa'], notas: 'Velho.', refs: [mapa], retrato: new Blob(['xx'], { type: 'image/png' }) });
  const outra = await repo.criarEntidade({ campanhaId: c.id, tipo: 'personagem', nome: 'Zé' });
  await repo.ligar({ campanhaId: c.id, de: mapa, para: criarRef('mesa', 'entidade', outra.id), tipo: 'aparece-em' });
  const s = { id: 's1', campanhaId: c.id, nome: 'Noite 1', data: 5, roteiro: [mapa], registro: 'ok', criadaEm: 1, atualizadaEm: 1 };
  await repo.salvarSessao(s);

  const f = Object.fromEntries(ferramentasDaCampanha(async () => repo).map(x => [x.nome, x]));
  assert.deepEqual(Object.keys(f).sort(), ['campanha_entidade_ler', 'campanha_ler', 'campanha_listar', 'campanha_sessao_ler']);
  for (const x of Object.values(f)) {
    assert.equal(x.esquema.type, 'object'); assert.ok(x.esquema.properties); assert.ok(Array.isArray(x.esquema.required));
  }
  const ler = async (n: string, a: Record<string, unknown> = {}) => JSON.parse(((await f[n]!.executar(a))[0] as { texto: string }).texto);

  const lista = await ler('campanha_listar');
  assert.equal(lista.length, 2); assert.deepEqual(Object.keys(lista[0]).sort(), ['id', 'nome', 'sistema']);

  const camp = await ler('campanha_ler', { campanhaId: c.id });
  assert.equal(camp.campanha.nome, 'Ilha');
  assert.deepEqual(camp.entidades.lugar[0], { id: e.id, nome: 'Farol', tags: ['costa'], refs: [mapa], retrato: true });
  assert.equal(camp.entidades.personagem.length, 1);
  assert.deepEqual(camp.sessoes, [{ id: 's1', nome: 'Noite 1', data: 5, roteiro: 1 }]);

  const ent = await ler('campanha_entidade_ler', { id: e.id });
  assert.equal(ent.entidade.notas, 'Velho.'); assert.equal(ent.entidade.retrato, true); assert.equal(ent.ligacoes.length, 1);

  const ses = await ler('campanha_sessao_ler', { id: 's1' });
  assert.equal(ses.sessao.registro, 'ok'); assert.equal(ses.sessao.roteiro.length, 1);

  await assert.rejects(f.campanha_ler!.executar({ campanhaId: 'nao' }), /não encontrada/);
  await assert.rejects(f.campanha_entidade_ler!.executar({}), /Falta/);
  await assert.rejects(f.campanha_sessao_ler!.executar({ id: 'x' }), /não encontrada/);
  repo.fechar();
});
