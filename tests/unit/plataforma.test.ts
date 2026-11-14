import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { readFile } from 'node:fs/promises';
import { CATALOGO, criarRef, enderecoDaRef, validarManifesto } from '#mesa';
import { formatarRota, lerRota } from '../../src/app/rotas.ts';
import { achar, criarProxy, lerProjeto, type Projeto } from '../../scripts/mesa-dev.ts';

test('o mesa.json do Atlas cumpre o contrato e só promete o que existe', async () => {
  const bruto = JSON.parse(await readFile(new URL('../../public/mesa.json', import.meta.url), 'utf8'));
  const v = validarManifesto(bruto);
  assert.ok(v.ok, v.ok ? '' : v.erro);
  if (!v.ok) return;
  const m = v.manifesto;
  assert.equal(m.app, 'atlas');
  for (const t of m.emite) assert.equal(CATALOGO[t]!.dono, 'atlas');
  for (const t of m.atende) assert.equal(CATALOGO[t]!.natureza, 'pedido');
});

test('toda rota do manifesto é entendida pelo roteador do Atlas (e vice-versa)', async () => {
  const m = validarManifesto(JSON.parse(await readFile(new URL('../../public/mesa.json', import.meta.url), 'utf8')));
  assert.ok(m.ok); if (!m.ok) return;
  const base = 'https://ilvro.github.io/Atlas/';
  const mapa = enderecoDaRef(m.manifesto, criarRef('atlas', 'mapa', 'casa-1'), base)!;
  assert.equal(mapa, 'https://ilvro.github.io/Atlas/#/mapa/casa-1');
  assert.deepEqual(lerRota(new URL(mapa).hash), { tipo: 'mapa', id: 'casa-1' });
  const comodo = enderecoDaRef(m.manifesto, criarRef('atlas', 'comodo', 'casa-1/biblioteca'), base)!;
  assert.equal(comodo, 'https://ilvro.github.io/Atlas/#/mapa/casa-1/comodo/biblioteca');
  assert.deepEqual(lerRota(new URL(comodo).hash), { tipo: 'mapa', id: 'casa-1', comodo: 'biblioteca' });
  assert.equal(formatarRota({ tipo: 'mapa', id: 'casa-1', comodo: 'biblioteca' }), new URL(comodo).hash);

  const objeto = enderecoDaRef(m.manifesto, criarRef('atlas', 'objeto', 'casa-1/escrivaninha'), base)!;
  assert.equal(objeto, 'https://ilvro.github.io/Atlas/#/mapa/casa-1/objeto/escrivaninha');
  assert.deepEqual(lerRota(new URL(objeto).hash), { tipo: 'mapa', id: 'casa-1', objeto: 'escrivaninha' });
  assert.equal(formatarRota({ tipo: 'mapa', id: 'casa-1', objeto: 'escrivaninha' }), new URL(objeto).hash);

  const regiao = enderecoDaRef(m.manifesto, criarRef('atlas', 'regiao', 'casa-1/armadilha'), base)!;
  assert.equal(regiao, 'https://ilvro.github.io/Atlas/#/mapa/casa-1/regiao/armadilha');
  assert.deepEqual(lerRota(new URL(regiao).hash), { tipo: 'mapa', id: 'casa-1', regiao: 'armadilha' });
  assert.equal(formatarRota({ tipo: 'mapa', id: 'casa-1', regiao: 'armadilha' }), new URL(regiao).hash);
});

test('mesa-dev: ler projetos e achar o dono de um caminho', () => {
  assert.deepEqual(lerProjeto('Atlas=5190'), { nome: 'Atlas', alvo: 'http://127.0.0.1:5190', tirarPrefixo: false });
  assert.deepEqual(lerProjeto('Ficha=http://localhost:5173/'), { nome: 'Ficha', alvo: 'http://localhost:5173', tirarPrefixo: false });
  assert.deepEqual(lerProjeto('Ficha=5173@raiz'), { nome: 'Ficha', alvo: 'http://127.0.0.1:5173', tirarPrefixo: true });
  for (const ruim of ['Atlas', '=5', 'a b=5', 'Atlas=', 'Atlas=@raiz']) assert.throws(() => lerProjeto(ruim), /Nome=porta/);
  const ps: Projeto[] = [lerProjeto('Atlas=1'), lerProjeto('Ficha=2@raiz')];
  // O padrão repassa o caminho inteiro (o projeto roda com `base: '/Atlas/'`); `@raiz` tira o prefixo.
  assert.deepEqual(achar(ps, '/Atlas/src/main.tsx?x=1'), { projeto: ps[0], caminho: '/Atlas/src/main.tsx?x=1' });
  assert.deepEqual(achar(ps, '/Ficha/a/b?x=1'), { projeto: ps[1], caminho: '/a/b?x=1' });
  assert.deepEqual(achar(ps, '/Ficha/'), { projeto: ps[1], caminho: '/' });
  assert.equal(achar(ps, '/Outro/x'), null);
  assert.equal(achar(ps, '/@vite/client'), null);
});

async function servir(corpo: (req: http.IncomingMessage) => string): Promise<{ porta: number; fechar: () => Promise<void> }> {
  const s = http.createServer((req, res) => { res.setHeader('content-type', 'text/plain'); res.end(corpo(req)); });
  await new Promise<void>(ok => s.listen(0, '127.0.0.1', ok));
  return { porta: (s.address() as AddressInfo).port, fechar: () => new Promise(ok => { s.close(() => ok()); s.closeAllConnections(); }) };
}

test('mesa-dev: encaminha cada prefixo ao seu projeto, tira o prefixo, redireciona e avisa quando o projeto está fora do ar', async () => {
  const atlas = await servir(r => `atlas:${r.url}:${r.headers['x-forwarded-prefix']}:${r.headers.host}`), ficha = await servir(r => `ficha:${r.url}`);
  const proxy = criarProxy([lerProjeto(`Atlas=${atlas.porta}`), lerProjeto(`Ficha=${ficha.porta}@raiz`), lerProjeto('Fora=1')]);
  await new Promise<void>(ok => proxy.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
  const ler = async (caminho: string, opcoes: RequestInit = {}) => { const r = await fetch(base + caminho, { redirect: 'manual', ...opcoes }); return { status: r.status, corpo: await r.text(), local: r.headers.get('location') }; };
  try {
    assert.equal((await ler('/Atlas/')).corpo, `atlas:/Atlas/:/Atlas:127.0.0.1:${atlas.porta}`);          // padrão: caminho inteiro
    assert.match((await ler('/Atlas/a/b.js?v=3')).corpo, /^atlas:\/Atlas\/a\/b\.js\?v=3:/);
    assert.equal((await ler('/Ficha/x')).corpo, 'ficha:/x');                                               // @raiz: sem prefixo
    assert.deepEqual([(await ler('/Atlas')).status, (await ler('/Atlas')).local], [302, '/Atlas/']);
    assert.equal((await ler('/Atlas?a=1')).local, '/Atlas/?a=1');
    assert.equal((await ler('/nada')).status, 404);
    const indice = await ler('/'); assert.equal(indice.status, 200); assert.match(indice.corpo, /href="\/Atlas\/"/);
    const fora = await ler('/Fora/'); assert.equal(fora.status, 502); assert.match(fora.corpo, /Fora não está respondendo/);
  } finally { await new Promise<void>(ok => { proxy.close(() => ok()); proxy.closeAllConnections(); }); await atlas.fechar(); await ficha.fechar(); }
});
