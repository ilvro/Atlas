import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { abrirBanco, abrirRepositorioCampanha, criarRef, obterTudo, promessa, transacao, mesmaRef, validarEntidade, ErroCampanha, type RepositorioCampanha } from '../src/index.ts';

const abertos: RepositorioCampanha[] = [];
async function abrir(app: Parameters<typeof abrirRepositorioCampanha>[0]['app'], idb: IDBFactory, relogio = { t: 1000 }) {
  const repo = await abrirRepositorioCampanha({ app, idb, agora: () => ++relogio.t });
  abertos.push(repo); return repo;
}
const fichaRef = criarRef('ficha', 'ficha', 's1'), tokenRef = criarRef('atlas', 'token', 'm1/t1'), mapaRef = criarRef('atlas', 'mapa', 'm1');

test('cria e lista campanhas, a mais recente primeiro', async () => {
  const repo = await abrir('mesa', new IDBFactory());
  const a = await repo.criarCampanha({ nome: 'Ilha' }); const b = await repo.criarCampanha({ nome: 'Casa', sistema: 'ordem-paranormal', tema: 'ordem' });
  assert.deepEqual((await repo.listarCampanhas()).map(c => c.id), [b.id, a.id]);
  assert.equal((await repo.obterCampanha(b.id))?.sistema, 'ordem-paranormal');
  await assert.rejects(repo.criarCampanha({ nome: '   ' }), ErroCampanha);
});

test('o banco é compartilhado entre aplicativos da mesma origem', async () => {
  const idb = new IDBFactory(), mesa = await abrir('mesa', idb), atlas = await abrir('atlas', idb);
  const c = await mesa.criarCampanha({ nome: 'Ilha' });
  assert.equal((await atlas.obterCampanha(c.id))?.nome, 'Ilha');
});

test('uma entidade precisa de uma campanha existente e de dados válidos', async () => {
  const repo = await abrir('atlas', new IDBFactory());
  await assert.rejects(repo.criarEntidade({ campanhaId: 'nao-existe', tipo: 'lugar', nome: 'Casa' }), /campanha não existe/);
  const c = await repo.criarCampanha({ nome: 'Ilha' });
  await assert.rejects(repo.criarEntidade({ campanhaId: c.id, tipo: 'nada' as never, nome: 'x' }), /Tipo de entidade/);
  await assert.rejects(repo.criarEntidade({ campanhaId: c.id, tipo: 'lugar', nome: 'x', refs: [{ app: 'zzz' } as never] }), /Referência inválida/);
  const e = await repo.criarEntidade({ campanhaId: c.id, tipo: 'lugar', nome: 'Casa dos Salgueiros', refs: [mapaRef] });
  assert.equal(e.criadaPor, 'atlas');
  assert.equal((await repo.entidadeDaRef(c.id, mapaRef))?.id, e.id);
  assert.equal(await repo.entidadeDaRef(c.id, fichaRef), undefined);
});

test('cada aplicativo só altera etiquetas, notas e as próprias referências de uma entidade alheia', async () => {
  const idb = new IDBFactory(), mesa = await abrir('mesa', idb), ficha = await abrir('ficha', idb), atlas = await abrir('atlas', idb);
  const c = await mesa.criarCampanha({ nome: 'Ilha' });
  const e = await mesa.criarEntidade({ campanhaId: c.id, tipo: 'personagem', nome: 'Muirenn' });
  // A Ficha acrescenta a própria referência: permitido.
  await ficha.salvarEntidade({ ...e, refs: [fichaRef] });
  // O Atlas acrescenta o token dele: permitido, e a referência da Ficha é preservada.
  const depois = (await atlas.obterEntidade(e.id))!;
  await atlas.salvarEntidade({ ...depois, refs: [...depois.refs, tokenRef] });
  assert.deepEqual((await mesa.obterEntidade(e.id))!.refs, [fichaRef, tokenRef]);
  const atual0 = (await atlas.obterEntidade(e.id))!;
  // Etiquetas e notas: qualquer aplicativo altera.
  await atlas.salvarEntidade({ ...atual0, tags: ['npc'], notas: 'Vista no porto' });
  assert.deepEqual((await mesa.obterEntidade(e.id))!.tags, ['npc']);
  assert.equal((await mesa.obterEntidade(e.id))!.notas, 'Vista no porto');
  // Mudar o nome, o retrato, ou mexer na referência de outro aplicativo: recusado.
  const atual = (await atlas.obterEntidade(e.id))!;
  await assert.rejects(atlas.salvarEntidade({ ...atual, nome: 'Outra' }), /só altera etiquetas, notas e as próprias referências/);
  await assert.rejects(atlas.salvarEntidade({ ...atual, retrato: new Blob(['x']) }), /só altera etiquetas, notas e as próprias referências/);
  await assert.rejects(atlas.salvarEntidade({ ...atual, refs: [tokenRef] }), /só altera etiquetas, notas e as próprias referências/);
  // Quem criou altera tudo.
  await mesa.salvarEntidade({ ...atual, nome: 'Muirenn da Lua Pálida', notas: 'Herborista' });
  assert.equal((await ficha.obterEntidade(e.id))!.nome, 'Muirenn da Lua Pálida');
});

test('não se cria nem se muda a origem de uma entidade por outra porta', async () => {
  const idb = new IDBFactory(), mesa = await abrir('mesa', idb), atlas = await abrir('atlas', idb);
  const c = await mesa.criarCampanha({ nome: 'Ilha' }), e = await mesa.criarEntidade({ campanhaId: c.id, tipo: 'nota', nome: 'N' });
  await assert.rejects(atlas.salvarEntidade({ ...e, id: 'nova', criadaPor: 'mesa' }), /nasce do aplicativo que a salva/);
  await assert.rejects(mesa.salvarEntidade({ ...e, criadaPor: 'atlas' }), /Origem e campanha não mudam/);
  await assert.rejects(mesa.salvarEntidade({ ...e, campanhaId: 'outra' }), /Origem e campanha não mudam/);
});

test('ligações: sem duplicata, sem auto-ligação, e só o criador remove', async () => {
  const idb = new IDBFactory(), mesa = await abrir('mesa', idb), atlas = await abrir('atlas', idb);
  const c = await mesa.criarCampanha({ nome: 'Ilha' });
  const l1 = await atlas.ligar({ campanhaId: c.id, de: tokenRef, para: fichaRef, tipo: 'aparece-em' });
  const l2 = await atlas.ligar({ campanhaId: c.id, de: tokenRef, para: fichaRef, tipo: 'aparece-em' });
  assert.equal(l1.id, l2.id);
  assert.equal((await mesa.listarLigacoes(c.id)).length, 1);
  assert.equal((await mesa.listarLigacoes(c.id, mapaRef)).length, 0);
  assert.equal((await mesa.listarLigacoes(c.id, fichaRef)).length, 1);
  await assert.rejects(atlas.ligar({ campanhaId: c.id, de: tokenRef, para: tokenRef, tipo: 'esta-em' }), /não se liga a si mesma/);
  await assert.rejects(mesa.removerLigacao(l1.id), /Só atlas remove/);
  await atlas.removerLigacao(l1.id);
  assert.equal((await mesa.listarLigacoes(c.id)).length, 0);
});

test('remover uma entidade leva junto as ligações que tocam as referências dela', async () => {
  const repo = await abrir('mesa', new IDBFactory());
  const c = await repo.criarCampanha({ nome: 'Ilha' });
  const e = await repo.criarEntidade({ campanhaId: c.id, tipo: 'lugar', nome: 'Biblioteca', refs: [mapaRef] });
  await repo.ligar({ campanhaId: c.id, de: mapaRef, para: fichaRef, tipo: 'menciona' });
  await repo.ligar({ campanhaId: c.id, de: tokenRef, para: fichaRef, tipo: 'aparece-em' });
  await repo.removerEntidade(e.id);
  assert.equal(await repo.obterEntidade(e.id), undefined);
  const restam = await repo.listarLigacoes(c.id);
  assert.equal(restam.length, 1);
  assert.ok(mesmaRef(restam[0]!.de, tokenRef));
});

test('remover a campanha leva tudo que é dela e nada do que é de outra', async () => {
  const repo = await abrir('mesa', new IDBFactory());
  const a = await repo.criarCampanha({ nome: 'A' }), b = await repo.criarCampanha({ nome: 'B' });
  for (const c of [a, b]) {
    await repo.criarEntidade({ campanhaId: c.id, tipo: 'nota', nome: 'N' });
    await repo.ligar({ campanhaId: c.id, de: mapaRef, para: fichaRef, tipo: 'menciona' });
    await repo.salvarSessao({ id: `s-${c.id}`, campanhaId: c.id, nome: 'S', data: 1, roteiro: [mapaRef], registro: '', criadaEm: 1, atualizadaEm: 1 });
  }
  await repo.removerCampanha(a.id);
  assert.equal(await repo.obterCampanha(a.id), undefined);
  assert.equal((await repo.listarEntidades(a.id)).length + (await repo.listarLigacoes(a.id)).length + (await repo.listarSessoes(a.id)).length, 0);
  assert.equal((await repo.listarEntidades(b.id)).length, 1);
  assert.equal((await repo.listarLigacoes(b.id)).length, 1);
  assert.equal((await repo.listarSessoes(b.id)).length, 1);
});

test('uma transação que falha no meio não grava nada do que veio antes', async () => {
  const idb = new IDBFactory(), banco = await abrirBanco('teste-atomico', 1, [{ nome: 'itens', chave: 'id' }], idb);
  await assert.rejects(transacao(banco, ['itens'], 'readwrite', async tx => {
    await promessa(tx.objectStore('itens').put({ id: 'a' }));
    await promessa(tx.objectStore('itens').put({ id: 'b' }));
    throw new Error('falhou no meio');
  }), /falhou no meio/);
  assert.deepEqual(await transacao(banco, ['itens'], 'readonly', tx => obterTudo(tx.objectStore('itens'))), []);
  await transacao(banco, ['itens'], 'readwrite', async tx => { await promessa(tx.objectStore('itens').put({ id: 'c' })); });
  assert.deepEqual(await transacao(banco, ['itens'], 'readonly', tx => obterTudo(tx.objectStore('itens'))), [{ id: 'c' }]);
  banco.close();
});

test('remover entidade ou ligação de outro aplicativo é recusado e não muda nada', async () => {
  const idb = new IDBFactory(), mesa = await abrir('mesa', idb), atlas = await abrir('atlas', idb);
  const c = await mesa.criarCampanha({ nome: 'A' }), e = await mesa.criarEntidade({ campanhaId: c.id, tipo: 'lugar', nome: 'Casa', refs: [mapaRef] });
  await mesa.ligar({ campanhaId: c.id, de: mapaRef, para: fichaRef, tipo: 'menciona' });
  await assert.rejects(atlas.removerEntidade(e.id), /Só mesa remove/);
  assert.equal((await mesa.obterEntidade(e.id))?.nome, 'Casa');
  assert.equal((await mesa.listarLigacoes(c.id)).length, 1);
});

test('validarEntidade recusa campos desconhecidos e textos longos demais', () => {
  const ok = { id: 'e', campanhaId: 'c', tipo: 'nota', nome: 'N', refs: [], tags: [], notas: '', criadaPor: 'mesa', criadaEm: 1, atualizadaEm: 1 };
  validarEntidade(ok);
  assert.throws(() => validarEntidade({ ...ok, extra: 1 }), /Campo desconhecido/);
  assert.throws(() => validarEntidade({ ...ok, nome: 'x'.repeat(201) }), /até 200/);
  assert.throws(() => validarEntidade({ ...ok, tags: [1] }), /Etiquetas/);
});

test.after(() => { for (const r of abertos) r.fechar(); });

test('uma entidade pode levar um retrato pequeno, e só pequeno', async () => {
  const repo = await abrir('ficha', new IDBFactory());
  const c = await repo.criarCampanha({ nome: 'Ilha' });
  const e = await repo.criarEntidade({ campanhaId: c.id, tipo: 'personagem', nome: 'Ana', retrato: new Blob(['x'], { type: 'image/png' }) });
  assert.ok((await repo.obterEntidade(e.id))?.retrato instanceof Blob);
  await assert.rejects(repo.criarEntidade({ campanhaId: c.id, tipo: 'personagem', nome: 'Grande', retrato: new Blob([new Uint8Array(600 * 1024)]) }), ErroCampanha);
});

test('sessão: notas do roteiro são opcionais, por chave de Ref, e validadas (formato, tamanho e quantidade)', async () => {
  const repo = await abrirRepositorioCampanha({ app: 'mesa', idb: new IDBFactory() });
  const c = await repo.criarCampanha({ nome: 'Notas' });
  const base = { id: 's1', campanhaId: c.id, nome: 'S', data: 1, roteiro: [], registro: '', criadaEm: 1, atualizadaEm: 1 };
  await repo.salvarSessao(base);                                                                           // sessão antiga, sem o campo
  await repo.salvarSessao({ ...base, roteiroNotas: { 'atlas/mapa/m1': 'Começar pela chuva' } });
  assert.deepEqual((await repo.listarSessoes(c.id))[0]!.roteiroNotas, { 'atlas/mapa/m1': 'Começar pela chuva' });
  const ruins: unknown[] = ['texto', ['a'], { 'atlas/mapa/m1': 3 }, { '': 'x' }, { 'atlas/mapa/m1': 'x'.repeat(301) }, Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`a/b/${i}`, 'x']))];
  for (const ruim of ruins) await assert.rejects(async () => repo.salvarSessao({ ...base, roteiroNotas: ruim } as never), /roteiroNotas/);
  repo.fechar();
});

test('entidade: o tipo `ameaca` (monstro) é válido e fica separado de `personagem`', async () => {
  const repo = await abrirRepositorioCampanha({ app: 'ficha', idb: new IDBFactory() });
  const c = await repo.criarCampanha({ nome: 'Ameaças' });
  const e = await repo.criarEntidade({ campanhaId: c.id, tipo: 'ameaca', nome: 'Zumbi de Sangue', refs: [criarRef('ficha', 'ficha', 'threat-1')] });
  assert.equal(e.tipo, 'ameaca');
  assert.deepEqual((await repo.listarEntidades(c.id, { tipo: 'ameaca' })).map(x => x.nome), ['Zumbi de Sangue']);
  assert.deepEqual(await repo.listarEntidades(c.id, { tipo: 'personagem' }), []);
  repo.fechar();
});

test('campanha: aceita elenco opcional (inclusive vazio) e recusa ids repetidos ou que não são texto', async () => {
  const repo = await abrirRepositorioCampanha({ app: 'mesa', idb: new IDBFactory() });
  const c = await repo.criarCampanha({ nome: 'Elenco' });
  assert.equal((await repo.obterCampanha(c.id))?.elenco, undefined);
  await repo.salvarCampanha({ ...c, elenco: [] });
  assert.deepEqual((await repo.obterCampanha(c.id))?.elenco, []);
  await repo.salvarCampanha({ ...c, elenco: ['p1', 'p2'] });
  assert.deepEqual((await repo.obterCampanha(c.id))?.elenco, ['p1', 'p2']);

  await assert.rejects(repo.salvarCampanha({ ...c, elenco: ['p1', 'p1'] }), /repetido no elenco/);
  await assert.rejects(repo.salvarCampanha({ ...c, elenco: [123 as never] }), /campanha\.elenco/);
  await assert.rejects(repo.salvarCampanha({ ...c, elenco: ['   '] }), /campanha\.elenco/);
  await assert.rejects(repo.salvarCampanha({ ...c, elenco: 'p1' as never }), /campanha\.elenco/);
  repo.fechar();
});
