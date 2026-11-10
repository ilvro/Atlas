import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { lerMensagem } from '../../scripts/ponte/protocolo.ts';
import { criarPonte, rotuloDoLugar } from '../../scripts/ponte/servidor.ts';

test('rotuloDoLugar reconhece Firefox, Chrome, WebKitGTK e outros', () => {
  assert.equal(rotuloDoLugar('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0'), 'Firefox');
  assert.equal(rotuloDoLugar('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'), 'Chrome');
  assert.equal(rotuloDoLugar('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15 WebKitGTK/2.44.0'), 'app da Mesa (WebKit)');
  assert.equal(rotuloDoLugar('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'), 'outro navegador');
  assert.equal(rotuloDoLugar(''), 'outro navegador');
  assert.equal(rotuloDoLugar(null), 'outro navegador');
  assert.equal(rotuloDoLugar(undefined), 'outro navegador');
});

test('lerMensagem aceita as formas válidas', () => {
  const f = { nome: 'atlas_x', descricao: 'd', esquema: { type: 'object' } };
  assert.deepEqual(lerMensagem(JSON.stringify({ tipo: 'registrar', app: 'atlas', titulo: 'T', ferramentas: [f], armazenamento: 'arm-1' })), { tipo: 'registrar', app: 'atlas', titulo: 'T', ferramentas: [f], armazenamento: 'arm-1' });
  assert.deepEqual(lerMensagem('{"tipo":"foco"}'), { tipo: 'foco' });
  assert.deepEqual(lerMensagem('{"tipo":"ola","token":"abc"}'), { tipo: 'ola', token: 'abc' });
  assert.deepEqual(lerMensagem('{"tipo":"chamar","id":"1","ferramenta":"atlas_x","args":{"a":1}}'), { tipo: 'chamar', id: '1', ferramenta: 'atlas_x', args: { a: 1 } });
  assert.deepEqual(lerMensagem('{"tipo":"resultado","id":"1","ok":true,"conteudo":[{"tipo":"texto","texto":"oi"},{"tipo":"imagem","dados":"AA","mime":"image/png"}]}'),
    { tipo: 'resultado', id: '1', ok: true, conteudo: [{ tipo: 'texto', texto: 'oi' }, { tipo: 'imagem', dados: 'AA', mime: 'image/png' }] });
  assert.deepEqual(lerMensagem('{"tipo":"resultado","id":"1","ok":false,"erro":"x"}'), { tipo: 'resultado', id: '1', ok: false, erro: 'x' });
  const msgFerramentas = lerMensagem(JSON.stringify({ tipo: 'ferramentas', lista: [{ ...f, app: 'atlas', onde: 'Firefox', armazenamento: 'arm-1' }], apps: { atlas: { onde: 'Firefox', armazenamento: 'arm-1' } } }));
  assert.equal(msgFerramentas?.tipo, 'ferramentas');
  if (msgFerramentas?.tipo === 'ferramentas') {
    assert.deepEqual(msgFerramentas.apps, { atlas: { onde: 'Firefox', armazenamento: 'arm-1' } });
    assert.equal(msgFerramentas.lista[0]?.armazenamento, 'arm-1');
    assert.equal(msgFerramentas.lista[0]?.onde, 'Firefox');
  }
});

test('lerMensagem recusa lixo', () => {
  for (const t of ['', 'nada', '[]', 'null', '42', '{}', '{"tipo":"x"}', '{"tipo":"ola"}', '{"tipo":"chamar","id":1}',
    '{"tipo":"registrar","app":"a","titulo":"t","ferramentas":[{"nome":"x"}]}',
    '{"tipo":"resultado","id":"1","ok":true,"conteudo":[{"tipo":"video"}]}',
    '{"tipo":"resultado","id":"1","ok":false}', '{"tipo":"ferramentas","lista":[{"nome":"a","descricao":"","esquema":{}}]}'])
    assert.equal(lerMensagem(t), null, t);
});

async function subir(tempoDaChamadaMs?: number) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-'));
  const servidor = http.createServer((_q, s) => s.end('ok'));
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  const porta = (servidor.address() as AddressInfo).port;
  const origem = `http://127.0.0.1:${porta}`;
  const ponte = criarPonte({ origem, pastaDoToken: pasta, tempoDaChamadaMs });
  servidor.on('upgrade', (req, socket, cabeca) => { if (!ponte.aceitar(req, socket, cabeca)) socket.destroy(); });
  const abertos: WebSocket[] = [];
  const url = `ws://127.0.0.1:${porta}/__ponte`;
  const conectar = async (origemDoCliente?: string, userAgent?: string) => {
    const ws = new WebSocket(url, {
      ...(origemDoCliente ? { origin: origemDoCliente } : {}),
      ...(userAgent ? { headers: { 'user-agent': userAgent } } : {}),
    });
    abertos.push(ws);
    const fila: any[] = [], espera: ((m: any) => void)[] = [];
    ws.on('message', d => { const m = JSON.parse(String(d)); const e = espera.shift(); if (e) e(m); else fila.push(m); });
    ws.on('error', () => {});
    await new Promise<void>((res, rej) => { ws.once('open', () => res()); ws.once('error', rej); });
    return { ws, proxima: () => new Promise<any>(r => { const m = fila.shift(); if (m) r(m); else espera.push(r); }) };
  };
  const aba = async (app: string, nomes: string[], userAgent?: string, armazenamento?: string) => {
    const c = await conectar(origem, userAgent);
    c.ws.send(JSON.stringify({
      tipo: 'registrar',
      app,
      titulo: app,
      ferramentas: nomes.map(nome => ({ nome, descricao: nome, esquema: { type: 'object' } })),
      ...(armazenamento ? { armazenamento } : {}),
    }));
    return c;
  };
  const mcp = async () => {
    const c = await conectar();
    c.ws.send(JSON.stringify({ tipo: 'ola', token: fs.readFileSync(path.join(pasta, 'token'), 'utf8') }));
    return c;
  };
  const encerrar = async () => {
    abertos.forEach(w => w.terminate()); ponte.fechar();
    await new Promise<void>(r => servidor.close(() => r()));
    fs.rmSync(pasta, { recursive: true, force: true });
  };
  return { ponte, pasta, origem, url, conectar, aba, mcp, encerrar };
}
const pausa = (ms = 50) => new Promise(r => setTimeout(r, ms));

test('grava um token de 64 hex em .ponte/token', async () => {
  const s = await subir();
  try { assert.match(fs.readFileSync(path.join(s.pasta, 'token'), 'utf8'), /^[0-9a-f]{64}$/); } finally { await s.encerrar(); }
});

test('aba com Origin errado é recusada', async () => {
  const s = await subir();
  try { await assert.rejects(s.conectar('http://evil.example')); assert.equal(s.ponte.abas(), 0); } finally { await s.encerrar(); }
});

test('MCP sem token (ou com token errado) é fechado', async () => {
  const s = await subir();
  try {
    for (const msg of [{ tipo: 'chamar', id: '1', ferramenta: 'x', args: {} }, { tipo: 'ola', token: 'errado' }]) {
      const c = await s.conectar();
      const fechou = new Promise<number>(r => c.ws.once('close', code => r(code)));
      c.ws.send(JSON.stringify(msg));
      assert.equal(await fechou, 4401);
    }
  } finally { await s.encerrar(); }
});

test('uma chamada vai à aba do app certo e o resultado volta ao MCP', async () => {
  const s = await subir();
  try {
    const atlas = await s.aba('atlas', ['atlas_mapa_ler']);
    const mesa = await s.aba('mesa', ['mesa_sessao_ler']);
    const c = await s.mcp();
    await pausa();
    const l = await c.proxima();
    assert.equal(l.tipo, 'ferramentas');
    assert.deepEqual(l.lista.map((f: any) => `${f.app}:${f.nome}`).sort(), ['atlas:atlas_mapa_ler', 'mesa:mesa_sessao_ler']);
    c.ws.send(JSON.stringify({ tipo: 'chamar', id: 'a', ferramenta: 'mesa_sessao_ler', args: { n: 1 } }));
    const pedido = await mesa.proxima();
    assert.equal(pedido.tipo, 'chamar'); assert.equal(pedido.ferramenta, 'mesa_sessao_ler'); assert.deepEqual(pedido.args, { n: 1 });
    mesa.ws.send(JSON.stringify({ tipo: 'resultado', id: pedido.id, ok: true, conteudo: [{ tipo: 'texto', texto: 'oi' }] }));
    assert.deepEqual(await c.proxima(), { tipo: 'resultado', id: 'a', ok: true, conteudo: [{ tipo: 'texto', texto: 'oi' }] });
    void atlas;
    c.ws.send(JSON.stringify({ tipo: 'chamar', id: 'b', ferramenta: 'inexistente', args: {} }));
    const r = await c.proxima();
    assert.equal(r.ok, false); assert.match(r.erro, /desconhecida/);
  } finally { await s.encerrar(); }
});

test('foco troca a aba escolhida do mesmo app', async () => {
  const s = await subir();
  try {
    const a1 = await s.aba('atlas', ['atlas_a']);
    const a2 = await s.aba('atlas', ['atlas_a', 'atlas_b']);
    const c = await s.mcp();
    await pausa();
    assert.equal((await c.proxima()).lista.length, 2); // a2 registrou por último
    a1.ws.send('{"tipo":"foco"}');
    assert.deepEqual((await c.proxima()).lista.map((f: any) => f.nome), ['atlas_a']);
    c.ws.send(JSON.stringify({ tipo: 'chamar', id: '1', ferramenta: 'atlas_a', args: {} }));
    assert.equal((await a1.proxima()).tipo, 'chamar');
    void a2;
  } finally { await s.encerrar(); }
});

test('aba que fecha falha a chamada pendente', async () => {
  const s = await subir();
  try {
    const a = await s.aba('atlas', ['atlas_a']);
    const c = await s.mcp();
    await pausa(); await c.proxima();
    c.ws.send(JSON.stringify({ tipo: 'chamar', id: '1', ferramenta: 'atlas_a', args: {} }));
    await a.proxima();
    a.ws.close();
    const msgs = [await c.proxima(), await c.proxima()];
    const r = msgs.find(m => m.tipo === 'resultado');
    assert.equal(r.id, '1'); assert.equal(r.ok, false);
    assert.equal(msgs.find(m => m.tipo === 'ferramentas').lista.length, 0);
  } finally { await s.encerrar(); }
});

test('chamada sem resposta expira', async () => {
  const s = await subir(80);
  try {
    await s.aba('atlas', ['atlas_a']);
    const c = await s.mcp();
    await pausa(); await c.proxima();
    c.ws.send(JSON.stringify({ tipo: 'chamar', id: '1', ferramenta: 'atlas_a', args: {} }));
    const r = await c.proxima();
    assert.deepEqual(r, { tipo: 'resultado', id: '1', ok: false, erro: 'a aba não respondeu' });
  } finally { await s.encerrar(); }
});

test('ponte associa User-Agent ao rótulo e repassa armazenamento e onde ao MCP', async () => {
  const s = await subir();
  try {
    const uaFirefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';
    const uaWebkit = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15 WebKitGTK/2.44.0';
    await s.aba('mesa', ['mesa_a'], uaFirefox, 'arm-mesa');
    await s.aba('atlas', ['atlas_b'], uaWebkit, 'arm-atlas');
    const c = await s.mcp();
    await pausa();
    const msg = await c.proxima();
    assert.equal(msg.tipo, 'ferramentas');
    assert.deepEqual(msg.apps, {
      mesa: { armazenamento: 'arm-mesa', onde: 'Firefox' },
      atlas: { armazenamento: 'arm-atlas', onde: 'app da Mesa (WebKit)' },
    });
    const fMesa = msg.lista.find((f: any) => f.app === 'mesa');
    assert.equal(fMesa?.armazenamento, 'arm-mesa');
    assert.equal(fMesa?.onde, 'Firefox');
    const fAtlas = msg.lista.find((f: any) => f.app === 'atlas');
    assert.equal(fAtlas?.armazenamento, 'arm-atlas');
    assert.equal(fAtlas?.onde, 'app da Mesa (WebKit)');
  } finally { await s.encerrar(); }
});
