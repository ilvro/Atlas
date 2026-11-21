import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { criarServidorMcp } from '../../scripts/ponte/mcp.ts';
import { registrarUso, lerUso, type RegistroDeUso } from '../../scripts/ponte/uso.ts';

test('registrarUso soma chamadas, guarda dias distintos e atualiza a última', () => {
  let d: RegistroDeUso = {};
  d = registrarUso(d, 'x', new Date('2026-01-01T10:00:00Z'));
  d = registrarUso(d, 'x', new Date('2026-01-01T11:00:00Z'));
  d = registrarUso(d, 'x', new Date('2026-01-02T09:00:00Z'));
  assert.equal(d.x!.chamadas, 3);
  assert.deepEqual(d.x!.dias, ['2026-01-01', '2026-01-02']);
  assert.equal(d.x!.ultima, '2026-01-02T09:00:00.000Z');
});

test('registrarUso corta os dias em 60', () => {
  let d: RegistroDeUso = {};
  for (let i = 0; i < 70; i++) d = registrarUso(d, 'x', new Date(Date.UTC(2026, 0, 1 + i)));
  assert.equal(d.x!.dias.length, 60);
  assert.equal(d.x!.chamadas, 70);
  assert.equal(d.x!.dias[59], '2026-03-11');
});

test('arquivo corrompido vira registro vazio', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uso-'));
  const f = path.join(dir, 'uso.json');
  fs.writeFileSync(f, '{nao é json');
  const orig = console.error; console.error = () => {};
  try { assert.deepEqual(lerUso(f), {}); } finally { console.error = orig; }
  assert.deepEqual(lerUso(path.join(dir, 'nao-existe.json')), {});
});

async function chamarEstado(arquivoDeUso: string | null | undefined) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uso-mcp-'));
  const { server, fechar } = criarServidorMcp({
    url: 'ws://127.0.0.1:1/__ponte',
    lerToken: () => 'x',
    arquivoDoCache: path.join(dir, 'ferramentas.json'),
    arquivoDoCatalogoBase: path.join(dir, 'base.json'),
    atrasosMs: [20],
    arquivoDeUso,
  });
  const client = new Client({ name: 't', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  await client.callTool({ name: 'ponte_estado', arguments: {} });
  // a gravação acontece depois da resposta: espera até aparecer (ou 1 s)
  for (let i = 0; i < 50 && arquivoDeUso && !fs.existsSync(arquivoDeUso); i++) await new Promise(r => setTimeout(r, 20));
  if (!arquivoDeUso) await new Promise(r => setTimeout(r, 100));
  await fechar(); await client.close();
}

test('MCP grava o uso quando há arquivo e não grava com null', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uso-arq-'));
  const f = path.join(dir, 'sub', 'uso.json');
  await chamarEstado(f);
  assert.equal(lerUso(f).ponte_estado!.chamadas, 1);
  const g = path.join(dir, 'nada.json');
  await chamarEstado(null);
  assert.equal(fs.existsSync(g), false);
  assert.equal(fs.existsSync(path.join(dir, 'sub', 'outro.json')), false);
});
