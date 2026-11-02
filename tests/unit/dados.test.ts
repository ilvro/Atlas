import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { criarAutosalvamento } from '../../src/data/autosalvamento.ts';
import { ErroDeBackup, deBase64, exportarBackup, importarBackup, lerPacote, nomeDoArquivo, paraBase64 } from '../../src/data/backup.ts';
import { nomeDoBanco, escopoDoCaminho } from '../../src/data/escopo.ts';
import { ErroDeConflito, abrirRepositorioMapas, type RepositorioMapas } from '../../src/data/repositorio.ts';
import { assetsDoMapa } from '../../src/domain/assets.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';
import { mapaCompleto } from './fixtures.ts';

const abertos: RepositorioMapas[] = [];
async function repo(idb = new IDBFactory(), relogio = { t: 5_000 }, nome = 'atlas-v1:/Atlas/') {
  const r = await abrirRepositorioMapas({ nome, idb, agora: () => ++relogio.t });
  abertos.push(r); return r;
}
const esperar = (ms = 5) => new Promise(r => setTimeout(r, ms));

test('o escopo do banco segue o diretório da página', () => {
  assert.equal(escopoDoCaminho('/Atlas/index.html'), '/Atlas/');
  assert.equal(escopoDoCaminho('/Atlas/'), '/Atlas/');
  assert.equal(escopoDoCaminho('/'), '/');
  assert.equal(escopoDoCaminho('/Atlas/?x=1#/mapa/a'), '/Atlas/');
  assert.equal(nomeDoBanco('/Ficha/'), 'atlas-v1:/Ficha/');
});

test('salvar sobe a revisão, carimba o tempo e devolve o mapa confirmado', async () => {
  const r = await repo(), m = mapaCompleto();
  assert.equal(m.revision, 0);
  const a = await r.salvar(m);
  assert.equal(a.revision, 1); assert.equal(a.updatedAt, 5_001); assert.equal(a.createdAt, m.createdAt);
  const b = await r.salvar({ ...a, name: 'Outra' });
  assert.equal(b.revision, 2); assert.equal((await r.obter(m.id))?.name, 'Outra');
  assert.equal(await r.obter('nao-existe'), undefined);
});

test('edição concorrente: salvar uma revisão velha dá conflito com o mapa atual, a menos que se force', async () => {
  const r = await repo(), a = await r.salvar(mapaCompleto());
  await r.salvar({ ...a, name: 'Da outra aba' });
  await assert.rejects(r.salvar({ ...a, name: 'Da minha aba' }), (e: unknown) => e instanceof ErroDeConflito && e.atual.name === 'Da outra aba');
  assert.equal((await r.obter(a.id))?.name, 'Da outra aba');
  const forcado = await r.salvar({ ...a, name: 'Da minha aba' }, { forcar: true });
  assert.equal(forcado.revision, 3);
});

test('salvar recusa mapa inválido e nada é gravado', async () => {
  const r = await repo();
  await assert.rejects(r.salvar({ ...mapaCompleto(), name: '' }), /name/);
  assert.deepEqual(await r.listar(), []);
});

test('a lista traz resumos, do mais recente ao mais antigo, e aponta registros ilegíveis em vez de falhar', async () => {
  const idb = new IDBFactory(), r = await repo(idb);
  await r.salvar(mapaCompleto()); await r.salvar(criarMapa({ id: 'vazio', nome: 'Vazio' }));
  // Um registro de uma versão futura, escrito por fora.
  const bruto = await new Promise<IDBDatabase>((ok, ruim) => { const p = idb.open('atlas-v1:/Atlas/', 1); p.onsuccess = () => ok(p.result); p.onerror = () => ruim(p.error); });
  await new Promise<void>((ok, ruim) => { const tx = bruto.transaction('mapas', 'readwrite'); tx.objectStore('mapas').put({ ...criarMapa({ id: 'futuro', nome: 'Do futuro' }), version: 9 }); tx.oncomplete = () => ok(); tx.onerror = () => ruim(tx.error); });
  bruto.close();
  const lista = await r.listar();
  // O registro do futuro foi escrito por fora com o relógio real, então é o mais recente.
  assert.deepEqual(lista.map(x => x.id), ['futuro', 'vazio', 'casa']);
  const casa = lista.find(x => x.id === 'casa')!;
  assert.deepEqual([casa.comodos, casa.objetos, casa.luzes, casa.pecas, casa.celulas], [2, 2, 2, 1, [30, 20]]);
  assert.ok(casa.area > 0);
  const futuro = lista.find(x => x.id === 'futuro')!;
  assert.match(futuro.erro ?? '', /mais nova/); assert.equal(futuro.nome, 'Do futuro');
  assert.equal(lista.find(x => x.id === 'vazio')!.erro, undefined);
  assert.ok(lista[0]!.atualizadoEm >= lista[1]!.atualizadoEm);
});

test('remover apaga o mapa e o rascunho dele', async () => {
  const r = await repo(), a = await r.salvar(mapaCompleto());
  await r.salvarRascunho({ ...a, name: 'rascunho' });
  await r.remover(a.id);
  assert.equal(await r.obter(a.id), undefined); assert.equal(await r.obterRascunho(a.id), undefined);
});

test('rascunho: guarda, devolve e some quando o mapa é gravado', async () => {
  const r = await repo(), m = mapaCompleto();
  await r.salvarRascunho({ ...m, name: 'Rascunho' });
  assert.equal((await r.obterRascunho(m.id))?.mapa.name, 'Rascunho');
  assert.equal((await r.listarRascunhos()).length, 1);
  await r.salvar(m);
  assert.equal(await r.obterRascunho(m.id), undefined);
});

test('assets são endereçados pelo conteúdo: o mesmo arquivo guardado duas vezes é um só', async () => {
  const r = await repo();
  const a = await r.salvarAsset(new Blob(['retrato da Muirenn'], { type: 'image/png' })), b = await r.salvarAsset(new Blob(['retrato da Muirenn'], { type: 'image/png' }));
  assert.deepEqual(a, b); assert.equal(a.id, a.hash.slice(0, 32)); assert.equal(a.hash.length, 64);
  assert.equal((await r.listarAssets()).length, 1);
  assert.equal(await (await r.obterAsset(a.id))!.blob.text(), 'retrato da Muirenn');
  await assert.rejects(r.restaurarAsset({ id: a.id, hash: a.hash, tipo: 'image/png', blob: new Blob(['adulterado']), criadoEm: 1 }), /não bate com o hash/);
});

test('base64 vai e volta sem perder bytes, inclusive arquivos grandes', async () => {
  const bytes = new Uint8Array(100_000); for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 31) % 256;
  const volta = deBase64(await paraBase64(new Blob([bytes])), 'application/octet-stream');
  assert.deepEqual(new Uint8Array(await volta.arrayBuffer()), bytes);
});

test('os assets de um mapa são achados em retratos, máscaras e área explorada', () => {
  const m = mapaCompleto();
  m.tokens.muirenn!.portrait = { id: 'p', hash: 'abcdef012345' }; m.session.explored = { id: 'e', hash: 'abcdef012345' }; m.terrain.layers.l = { id: 'l', material: 'grama', mask: { id: 'p', hash: 'abcdef012345' }, order: 0 };
  assert.deepEqual(assetsDoMapa(m).map(a => a.id).sort(), ['e', 'p', 'mask-1'].sort());
});

test('backup completo: exportar e importar em outro banco reproduz mapas e assets', async () => {
  const origem = await repo(), destino = await repo();
  const retrato = await origem.salvarAsset(new Blob(['png'], { type: 'image/png' }));
  const m = mapaCompleto(); m.tokens.muirenn!.portrait = retrato;
  await origem.salvar(m); await origem.salvar(criarMapa({ id: 'v', nome: 'Vazio' }));
  const pacote = await exportarBackup(origem, { agora: () => 42 });
  assert.equal(pacote.formato, 'atlas.backup'); assert.equal(pacote.criadoEm, 42); assert.equal(pacote.mapas.length, 2); assert.equal(pacote.assets.length, 1);
  const rel = await importarBackup(destino, lerPacote(JSON.stringify(pacote)));
  assert.deepEqual([rel.importados.length, rel.erros.length, rel.assets], [2, 0, 1]);
  assert.deepEqual(await destino.obter('casa'), await origem.obter('casa'));
  assert.equal(await (await destino.obterAsset(retrato.id))!.blob.text(), 'png');
});

test('exportar só um mapa leva só os assets dele; e o arquivo avulso volta a ser importável', async () => {
  const r = await repo(), usado = await r.salvarAsset(new Blob(['usado'])), solto = await r.salvarAsset(new Blob(['solto']));
  const m = mapaCompleto(); m.tokens.muirenn!.portrait = usado;
  await r.salvar(m); await r.salvar(criarMapa({ id: 'v' }));
  const pacote = await exportarBackup(r, { ids: ['casa'] });
  assert.deepEqual([pacote.mapas.length, pacote.assets.map(a => a.id)], [1, [usado.id]]);
  assert.notEqual(solto.id, usado.id);
  const avulso = lerPacote(JSON.stringify(m));
  assert.equal(avulso.mapas.length, 1);
});

test('importar com id repetido: copia, substitui ou pula', async () => {
  const r = await repo(), a = await r.salvar(mapaCompleto());
  const pacote = lerPacote(JSON.stringify({ ...a, name: 'Do arquivo' }));
  const pulou = await importarBackup(r, pacote, { conflito: 'pular' });
  assert.deepEqual([pulou.importados.length, pulou.pulados.length], [0, 1]);
  assert.equal((await r.obter('casa'))?.name, 'Casa dos Salgueiros');
  const copiou = await importarBackup(r, pacote, { conflito: 'copia', novoId: () => 'casa-2' });
  assert.deepEqual(copiou.importados.map(x => [x.id, x.comoCopia]), [['casa-2', true]]);
  assert.equal((await r.obter('casa-2'))?.name, 'Do arquivo (importado)');
  assert.deepEqual((await r.obter('casa-2'))?.session, a.session);
  const trocou = await importarBackup(r, pacote, { conflito: 'substituir' });
  assert.equal(trocou.importados[0]!.substituiu, true);
  const depois = (await r.obter('casa'))!;
  assert.equal(depois.name, 'Do arquivo'); assert.ok(depois.revision > a.revision);
});

test('um mapa ruim no pacote não derruba os outros e a mensagem diz qual é', async () => {
  const r = await repo(), bom = mapaCompleto(), ruim = { ...criarMapa({ id: 'ruim', nome: 'Quebrado' }), grid: { kind: 'square', size: -3, offset: [0, 0], visible: true } };
  const rel = await importarBackup(r, lerPacote(JSON.stringify({ formato: 'atlas.backup', versao: 1, criadoEm: 1, mapas: [bom, ruim, 42], assets: [{ id: 'x', hash: 'y', tipo: 'a/b', base64: btoa('oi'), criadoEm: 1 }] })));
  assert.deepEqual(rel.importados.map(x => x.id), ['casa']);
  assert.equal(rel.erros.length, 3);
  assert.deepEqual(rel.erros.map(e => e.nome), ['asset x', 'Quebrado', null]);
  assert.match(rel.erros.find(e => e.nome === 'Quebrado')!.motivo, /grid\.size/);
});

test('lerPacote recusa o que não é backup e backups de versão futura', () => {
  assert.throws(() => lerPacote('{lixo'), ErroDeBackup);
  assert.throws(() => lerPacote('[]'), /não é um backup/);
  assert.throws(() => lerPacote('{"formato":"outro"}'), /não é um backup/);
  assert.throws(() => lerPacote('{"formato":"atlas.backup","versao":7,"mapas":[],"assets":[]}'), /Atualize o Atlas/);
  assert.throws(() => lerPacote('{"formato":"atlas.backup","versao":1}'), /incompleto/);
});

test('nome do arquivo: sem acento, sem símbolo, com data', () => {
  assert.equal(nomeDoArquivo('Casa dos Salgueiros — 1º andar!', new Date('2026-11-02T12:00:00Z')), 'casa-dos-salgueiros-1o-andar-2026-11-02.atlas.json');
  assert.equal(nomeDoArquivo('???', new Date('2026-11-02T12:00:00Z')), 'mapa-2026-11-02.atlas.json');
});

test('dois aplicativos na mesma origem não se misturam: o nome do banco tem o escopo', async () => {
  const idb = new IDBFactory(), a = await repo(idb, { t: 1 }, 'atlas-v1:/Atlas/'), b = await repo(idb, { t: 1 }, 'atlas-v1:/Outro/');
  await a.salvar(mapaCompleto());
  assert.equal((await a.listar()).length, 1); assert.equal((await b.listar()).length, 0);
});

// ---- Autossalvamento ----
function relogioFalso() {
  const tarefas = new Map<number, { fn: () => void; ms: number }>(); let n = 0;
  return { agendar: (fn: () => void, ms: number) => { tarefas.set(++n, { fn, ms }); return n; }, cancelar: (id: unknown) => { tarefas.delete(id as number); }, pendentes: () => tarefas.size, disparar: () => { const t = [...tarefas.values()]; tarefas.clear(); t.forEach(x => x.fn()); } };
}

test('rascunho automático: grava depois da pausa, só uma vez por rajada, e não toca no mapa gravado', async () => {
  const r = await repo(), salvo = await r.salvar(mapaCompleto()), store = criarStore(salvo), rel = relogioFalso();
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar });
  assert.equal(auto.estado, 'limpo');
  store.executar({ tipo: 'mapa.renomear', nome: 'A' }); store.executar({ tipo: 'mapa.renomear', nome: 'B' }); store.executar({ tipo: 'mapa.renomear', nome: 'C' });
  assert.equal(auto.estado, 'pendente'); assert.equal(rel.pendentes(), 1);
  rel.disparar(); await esperar(30);
  assert.equal((await r.obterRascunho(salvo.id))?.mapa.name, 'C');
  assert.equal((await r.obter(salvo.id))?.name, 'Casa dos Salgueiros');
  auto.fechar();
});

test('rascunho automático: voltar ao gravado apaga o rascunho', async () => {
  const r = await repo(), salvo = await r.salvar(mapaCompleto()), store = criarStore(salvo), rel = relogioFalso();
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar });
  store.executar({ tipo: 'mapa.renomear', nome: 'A' }); rel.disparar(); await esperar(30);
  assert.ok(await r.obterRascunho(salvo.id));
  store.desfazer(); await esperar(30);
  assert.equal(await r.obterRascunho(salvo.id), undefined); assert.equal(auto.estado, 'limpo'); assert.equal(rel.pendentes(), 0);
  auto.fechar();
});

test('salvarAgora grava o mapa, confirma no store e limpa o rascunho', async () => {
  const r = await repo(), store = criarStore(mapaCompleto(), { salvo: false }), rel = relogioFalso();
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar });
  assert.equal(store.sujo, true);
  const confirmado = await auto.salvarAgora();
  assert.equal(confirmado.revision, 1); assert.equal(store.documento.revision, 1); assert.equal(store.sujo, false); assert.equal(auto.estado, 'limpo');
  store.executar({ tipo: 'mapa.renomear', nome: 'Depois' });
  const segundo = await auto.salvarAgora();
  assert.equal(segundo.revision, 2); assert.equal((await r.obter('casa'))?.name, 'Depois');
  auto.fechar();
});

test('salvarAgora em conflito muda o estado e lança; forçar resolve', async () => {
  const r = await repo(), salvo = await r.salvar(mapaCompleto()), store = criarStore(salvo), rel = relogioFalso();
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar });
  await r.salvar({ ...salvo, name: 'Outra aba' });
  store.executar({ tipo: 'mapa.renomear', nome: 'Minha aba' });
  await assert.rejects(auto.salvarAgora(), ErroDeConflito);
  assert.equal(auto.estado, 'conflito');
  await auto.salvarAgora({ forcar: true });
  assert.equal((await r.obter('casa'))?.name, 'Minha aba'); assert.equal(auto.estado, 'limpo');
  auto.fechar();
});

test('edição durante a gravação não se perde: continua pendente', async () => {
  const r = await repo(), store = criarStore(mapaCompleto(), { salvo: false }), rel = relogioFalso();
  const salvarDeVerdade = r.salvar.bind(r);
  let liberar!: () => void; const portao = new Promise<void>(ok => { liberar = ok; });
  r.salvar = async (m, o) => { await portao; return salvarDeVerdade(m, o); };   // a gravação fica "no ar" até liberarmos
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar });
  const gravando = auto.salvarAgora();
  await esperar(10);
  assert.equal(auto.estado, 'gravando');
  store.executar({ tipo: 'mapa.notas', texto: 'durante' });       // o que foi enviado já não inclui isto
  liberar(); await gravando;
  assert.equal(store.sujo, true); assert.equal(auto.estado, 'pendente'); assert.equal(rel.pendentes(), 1);
  assert.equal(store.documento.notes, 'durante'); assert.equal(store.documento.revision, 1);
  assert.equal((await r.obter('casa'))?.notes, 'Sessão 3.');
  auto.fechar();
});

test('ao abrir: oferece o rascunho que difere do gravado, e descarta o que é igual', async () => {
  const r = await repo(), salvo = await r.salvar(mapaCompleto()), store = criarStore(salvo);
  const auto = criarAutosalvamento({ store, repo: r });
  assert.equal(await auto.rascunhoParaRecuperar(), undefined);
  await r.salvarRascunho(salvo);                            // igual ao gravado
  assert.equal(await auto.rascunhoParaRecuperar(), undefined); assert.equal(await r.obterRascunho(salvo.id), undefined);
  await r.salvarRascunho({ ...salvo, name: 'Esqueci de salvar' });
  const achado = await auto.rascunhoParaRecuperar();
  assert.equal(achado?.rascunho.mapa.name, 'Esqueci de salvar'); assert.equal(achado?.obsoleto, false);
  await r.salvar({ ...salvo, name: 'Gravado depois' });     // outra aba gravou; o rascunho é de uma revisão anterior
  await r.salvarRascunho({ ...salvo, name: 'Esqueci de salvar' });
  assert.equal((await auto.rascunhoParaRecuperar())?.obsoleto, true);
  auto.fechar();
});

test('uma falha ao gravar o rascunho vira estado "erro" e é reportada, sem lançar', async () => {
  const r = await repo(), salvo = await r.salvar(mapaCompleto()), store = criarStore(salvo), rel = relogioFalso(), erros: unknown[] = [];
  r.salvarRascunho = async () => { throw new Error('disco cheio'); };
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar, aoErro: e => erros.push(e) });
  store.executar({ tipo: 'mapa.renomear', nome: 'A' }); rel.disparar(); await esperar(30);
  assert.equal(auto.estado, 'erro'); assert.equal(erros.length, 1);
  auto.fechar();
});

test.after(() => { for (const r of abertos) r.fechar(); });

test('descarregar guarda o rascunho na hora, sem esperar a pausa, e não faz nada com o mapa limpo', async () => {
  const r = await repo(), salvo = await r.salvar(mapaCompleto()), store = criarStore(salvo), rel = relogioFalso();
  const auto = criarAutosalvamento({ store, repo: r, agendar: rel.agendar, cancelar: rel.cancelar });
  await auto.descarregar();
  assert.equal(await r.obterRascunho(salvo.id), undefined);
  store.executar({ tipo: 'mapa.renomear', nome: 'Sai da aba' });
  assert.equal(rel.pendentes(), 1);
  await auto.descarregar();
  assert.equal(rel.pendentes(), 0);
  assert.equal((await r.obterRascunho(salvo.id))?.mapa.name, 'Sai da aba');
  auto.fechar();
});
