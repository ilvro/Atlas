import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { criarProxy, lerProjeto } from '../../scripts/mesa-dev.ts';
import { resolverArquivo, tipoDoArquivo } from '../../scripts/mesa-estatico.ts';
import { modificadoPorUltimo, planoDosProjetos, precisaConstruir, type ProjetoEstatico } from '../../scripts/mesa-tudo.ts';

const pasta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-tudo-'));
function escrever(p: string, texto: string, mtimeS?: number): void { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, texto); if (mtimeS !== undefined) fs.utimesSync(p, mtimeS, mtimeS); }

test('plano: os seis aplicativos, cada um do jeito que se comporta sob um prefixo', () => {
  const plano = planoDosProjetos('/raiz');
  assert.deepEqual(plano.map(p => p.nome), ['Atlas', 'Mesa', 'Dossie', 'Atelie', 'Tabletop', 'Jukebox']);
  const vites = plano.filter((p): p is Extract<typeof p, { tipo: 'vite' }> => p.tipo === 'vite');
  assert.deepEqual(vites.map(p => `${p.nome}:${p.porta}`), ['Atlas:5190', 'Mesa:5195', 'Dossie:5173', 'Atelie:5174', 'Tabletop:5177']);
  assert.equal(new Set(vites.map(p => p.porta)).size, vites.length, 'portas diferentes');
  const est = plano.filter((p): p is ProjetoEstatico => p.tipo === 'estatico');
  assert.deepEqual(est.map(p => p.nome), ['Jukebox']);
  assert.equal(est[0]!.construir, undefined, 'Jukebox são arquivos soltos, sem build');
  assert.equal(plano.find(p => p.nome === 'Dossie')!.pasta, path.join('/raiz', 'Dossie'));
});

test('precisaConstruir: falta o build, ou alguma fonte é mais nova que ele', () => {
  const raiz = pasta();
  const p: ProjetoEstatico = { tipo: 'estatico', nome: 'X', pasta: raiz, servir: 'dist-pages', construir: { args: [], fontes: ['src', 'index.html'] } };
  escrever(path.join(raiz, 'src', 'a.js'), 'a', 1000); escrever(path.join(raiz, 'index.html'), '<p>', 1000);
  assert.equal(precisaConstruir(p), true, 'sem build');
  escrever(path.join(raiz, 'dist-pages', 'index.html'), '<p>', 2000);
  assert.equal(precisaConstruir(p), false, 'build mais novo que as fontes');
  escrever(path.join(raiz, 'src', 'fundo', 'b.js'), 'b', 3000);
  assert.equal(precisaConstruir(p), true, 'fonte nova, no fundo de uma subpasta');
  assert.equal(precisaConstruir({ ...p, construir: undefined }), false, 'sem receita de build, nunca');
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('modificadoPorUltimo: só arquivos, ignora node_modules aninhado e o que não existe', () => {
  const raiz = pasta();
  escrever(path.join(raiz, 'src', 'a.js'), 'a', 1000); escrever(path.join(raiz, 'src', 'node_modules', 'x', 'y.js'), 'y', 9000); escrever(path.join(raiz, 'b.js'), 'b', 2000);
  assert.equal(Math.round(modificadoPorUltimo([path.join(raiz, 'src'), path.join(raiz, 'nao-existe')]) / 1000), 1000);
  assert.equal(Math.round(modificadoPorUltimo([path.join(raiz, 'src'), path.join(raiz, 'b.js')]) / 1000), 2000);
  assert.equal(modificadoPorUltimo([path.join(raiz, 'nao-existe')]), 0);
  fs.rmSync(raiz, { recursive: true, force: true });
});

test('estático: resolverArquivo acha arquivo e index, e nunca sai da pasta', () => {
  const raiz = pasta();
  escrever(path.join(raiz, 'index.html'), 'inicio'); escrever(path.join(raiz, 'sub', 'index.html'), 'sub'); escrever(path.join(raiz, 'a b.txt'), 'espaco'); escrever(path.join(path.dirname(raiz), 'segredo.txt'), 'não deve sair');
  assert.equal(resolverArquivo(raiz, '/'), path.join(raiz, 'index.html'));
  assert.equal(resolverArquivo(raiz, '/sub/?x=1#y'), path.join(raiz, 'sub', 'index.html'));
  assert.equal(resolverArquivo(raiz, '/a%20b.txt'), path.join(raiz, 'a b.txt'));
  for (const ruim of ['/../segredo.txt', '/%2e%2e/segredo.txt', '/sub/../../segredo.txt', '/nao-existe', '/%00', '/%E0%A4%A']) assert.equal(resolverArquivo(raiz, ruim), null, ruim);
  assert.equal(tipoDoArquivo('x.mp3'), 'audio/mpeg'); assert.equal(tipoDoArquivo('x.js'), 'text/javascript; charset=utf-8'); assert.equal(tipoDoArquivo('x.desconhecido'), 'application/octet-stream');
  fs.rmSync(raiz, { recursive: true, force: true }); fs.rmSync(path.join(path.dirname(raiz), 'segredo.txt'), { force: true });
});

test('mesa-dev: lerProjeto aceita Nome=estatico:pasta e recusa pasta vazia', () => {
  assert.deepEqual(lerProjeto('Jukebox=estatico:/tmp/j'), { nome: 'Jukebox', alvo: 'estatico:/tmp/j', tirarPrefixo: true, estatico: '/tmp/j' });
  assert.throws(() => lerProjeto('Jukebox=estatico:'), /Nome=porta/);
  assert.throws(() => lerProjeto('a b=estatico:/tmp'), /Nome=porta/);
});

async function pedir(porta: number, caminho: string, cabecalhos: http.OutgoingHttpHeaders = {}, metodo = 'GET'): Promise<{ status: number; corpo: string; cab: http.IncomingHttpHeaders }> {
  return new Promise((ok, erro) => { const r = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: metodo, headers: cabecalhos, setHost: true }, res => { const partes: Buffer[] = []; res.on('data', d => partes.push(d)); res.on('end', () => ok({ status: res.statusCode ?? 0, corpo: Buffer.concat(partes).toString(), cab: res.headers })); }); r.on('error', erro); r.end(); });
}

test('mesa-dev: serve a pasta estática sob o prefixo, com Range, HEAD, 404 e sem sair da pasta', async () => {
  const raiz = pasta();
  escrever(path.join(raiz, 'index.html'), '<p>oi</p>'); escrever(path.join(raiz, 'mesa.json'), '{"app":"x"}'); escrever(path.join(raiz, 'faixa.bin'), '0123456789');
  const proxy = criarProxy([lerProjeto(`Jukebox=estatico:${raiz}`)]);
  await new Promise<void>(ok => proxy.listen(0, '127.0.0.1', ok));
  const porta = (proxy.address() as { port: number }).port;
  try {
    const raizPagina = await pedir(porta, '/Jukebox/');
    assert.equal(raizPagina.status, 200); assert.equal(raizPagina.corpo, '<p>oi</p>'); assert.match(String(raizPagina.cab['content-type']), /text\/html/); assert.equal(raizPagina.cab['cache-control'], 'no-cache');
    assert.equal((await pedir(porta, '/Jukebox')).status, 302, 'sem a barra final, redireciona');
    assert.equal((await pedir(porta, '/Jukebox/mesa.json?v=1')).corpo, '{"app":"x"}');
    assert.equal((await pedir(porta, '/Jukebox/nao-existe')).status, 404);
    assert.equal((await pedir(porta, '/Jukebox/%2e%2e/etc/passwd')).status, 404);
    const parte = await pedir(porta, '/Jukebox/faixa.bin', { range: 'bytes=2-5' });
    assert.equal(parte.status, 206); assert.equal(parte.corpo, '2345'); assert.equal(parte.cab['content-range'], 'bytes 2-5/10');
    const fim = await pedir(porta, '/Jukebox/faixa.bin', { range: 'bytes=-3' });
    assert.equal(fim.corpo, '789'); assert.equal((await pedir(porta, '/Jukebox/faixa.bin', { range: 'bytes=50-60' })).status, 416);
    const cabeca = await pedir(porta, '/Jukebox/faixa.bin', {}, 'HEAD');
    assert.equal(cabeca.status, 200); assert.equal(cabeca.corpo, ''); assert.equal(cabeca.cab['content-length'], '10');
  } finally { await new Promise<void>(ok => proxy.close(() => ok())); fs.rmSync(raiz, { recursive: true, force: true }); }
});
