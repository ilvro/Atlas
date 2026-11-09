import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocket } from 'ws';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ToolListChangedNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { criarPonte } from '../../scripts/ponte/servidor.ts';
import { criarServidorMcp, converterConteudo, SEM_PONTE } from '../../scripts/ponte/mcp.ts';

const esperar = async (cond: () => boolean, ms = 3000) => {
  const fim = Date.now() + ms;
  while (!cond()) { if (Date.now() > fim) throw new Error('tempo esgotado'); await new Promise(r => setTimeout(r, 10)); }
};

async function subirPonte() {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-mcp-'));
  const servidor = http.createServer((_q, s) => s.end('ok'));
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  const porta = (servidor.address() as AddressInfo).port;
  const origem = `http://127.0.0.1:${porta}`;
  const ponte = criarPonte({ origem, pastaDoToken: pasta });
  servidor.on('upgrade', (req, socket, cabeca) => { if (!ponte.aceitar(req, socket, cabeca)) socket.destroy(); });
  return { pasta, origem, porta, ponte, servidor, url: `ws://127.0.0.1:${porta}/__ponte` };
}

async function clienteMcp(url: string, lerToken: () => string) {
  const { server, fechar } = criarServidorMcp({ url, lerToken, atrasosMs: [20] });
  const client = new Client({ name: 't', version: '0' });
  let mudancas = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => { mudancas++; });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, mudancas: () => mudancas, fechar: async () => { await fechar(); await client.close(); } };
}

const textoDe = (r: any) => r.content.map((c: any) => c.text ?? '').join('');

test('converterConteudo converte texto e imagem', () => {
  assert.deepEqual(converterConteudo({ tipo: 'texto', texto: 'oi' }), { type: 'text', text: 'oi' });
  assert.deepEqual(converterConteudo({ tipo: 'imagem', dados: 'AA', mime: 'image/png' }), { type: 'image', data: 'AA', mimeType: 'image/png' });
});

test('sem ponte: só ponte_estado, com a explicação', async () => {
  const mcp = await clienteMcp('ws://127.0.0.1:1/__ponte', () => { throw new Error('sem token'); });
  try {
    const { tools } = await mcp.client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['ponte_estado']);
    const r = await mcp.client.callTool({ name: 'ponte_estado', arguments: {} });
    assert.match(textoDe(r), /npm run mesa-dev/);
    assert.equal(textoDe(r), SEM_PONTE);
    const x: any = await mcp.client.callTool({ name: 'atlas_x', arguments: {} });
    assert.equal(x.isError, true);
  } finally { await mcp.fechar(); }
});

test('com ponte e aba falsa: lista, chama, converte e avisa mudanças', async () => {
  const p = await subirPonte();
  const token = () => fs.readFileSync(path.join(p.pasta, 'token'), 'utf8').trim();
  const mcp = await clienteMcp(p.url, token);
  const aba = new WebSocket(p.url, { origin: p.origem });
  aba.on('error', () => {});
  aba.on('message', d => {
    const m = JSON.parse(String(d));
    if (m.tipo !== 'chamar') return;
    if (m.ferramenta === 'atlas_ver') aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: true, conteudo: [{ tipo: 'texto', texto: 'oi' }, { tipo: 'imagem', dados: 'AA==', mime: 'image/png' }] }));
    else aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: false, erro: 'deu ruim' }));
  });
  try {
    await new Promise<void>(r => aba.once('open', () => r()));
    aba.send(JSON.stringify({ tipo: 'registrar', app: 'atlas', titulo: 'Atlas', ferramentas: [
      { nome: 'atlas_ver', descricao: 'vê', esquema: { type: 'object', properties: {} } },
      { nome: 'atlas_falha', descricao: 'falha', esquema: { type: 'object' } },
    ] }));
    await esperar(() => mcp.mudancas() > 0);
    const { tools } = await mcp.client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['ponte_estado', 'atlas_ver', 'atlas_falha']);
    assert.match(textoDe(await mcp.client.callTool({ name: 'ponte_estado', arguments: {} })), /atlas \(2 ferramentas\)/);

    const ok: any = await mcp.client.callTool({ name: 'atlas_ver', arguments: {} });
    assert.deepEqual(ok.content, [{ type: 'text', text: 'oi' }, { type: 'image', data: 'AA==', mimeType: 'image/png' }]);
    const erro: any = await mcp.client.callTool({ name: 'atlas_falha', arguments: {} });
    assert.equal(erro.isError, true);
    assert.equal(textoDe(erro), 'deu ruim');
    const some: any = await mcp.client.callTool({ name: 'atlas_nada', arguments: {} });
    assert.equal(some.isError, true);

    const antes = mcp.mudancas();
    aba.close();
    await esperar(() => mcp.mudancas() > antes);
    assert.deepEqual((await mcp.client.listTools()).tools.map(t => t.name), ['ponte_estado']);
  } finally {
    aba.terminate();
    await mcp.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }
});

test('reconecta relendo o token quando a ponte reinicia', async () => {
  const p1 = await subirPonte();
  const mcp = await clienteMcp(p1.url, () => { throw new Error('x'); });
  await mcp.fechar();
  // Segunda rodada: ponte cai e volta na mesma porta com token novo.
  const pasta = p1.pasta;
  const mcp2 = await clienteMcp(p1.url, () => fs.readFileSync(path.join(pasta, 'token'), 'utf8').trim());
  try {
    await esperar(() => mcp2.mudancas() > 0);
    p1.ponte.fechar();
    p1.servidor.closeAllConnections();
    await new Promise<void>(r => p1.servidor.close(() => r()));
    const ponte2 = criarPonte({ origem: p1.origem, pastaDoToken: pasta });
    const servidor2 = http.createServer();
    servidor2.on('upgrade', (req, socket, cabeca) => { if (!ponte2.aceitar(req, socket, cabeca)) socket.destroy(); });
    await new Promise<void>(r => servidor2.listen(p1.porta, '127.0.0.1', r));
    try {
      let estado = '';
      const fim = Date.now() + 3000;
      while (!/Ponte conectada/.test(estado) && Date.now() < fim) {
        estado = textoDe(await mcp2.client.callTool({ name: 'ponte_estado', arguments: {} }));
        await new Promise(r => setTimeout(r, 20));
      }
      assert.match(estado, /Ponte conectada/);
    } finally { ponte2.fechar(); servidor2.closeAllConnections(); servidor2.close(); }
  } finally { await mcp2.fechar(); }
});
