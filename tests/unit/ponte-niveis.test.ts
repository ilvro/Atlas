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
import { criarPonte } from '../../scripts/ponte/servidor.ts';
import { criarServidorMcp, anotacoesDaFerramenta, nomeEfetivo, CAMINHO_CATALOGO_BASE_PADRAO, FERRAMENTAS_INTERNAS_OCULTAS } from '../../scripts/ponte/mcp.ts';
import { SEMPRE, ehSempre, ehDestrutiva, linhaDoIndice, indiceSobDemanda, sugerirNomes } from '../../scripts/ponte/niveis.ts';

const LOCAIS = ['ponte_estado', 'plataforma_guia', 'plataforma_ferramentas', 'plataforma_executar', 'plataforma_executar_destrutiva'];
const base: any[] = JSON.parse(fs.readFileSync(CAMINHO_CATALOGO_BASE_PADRAO, 'utf8'));
const textoDe = (r: any) => r.content.map((c: any) => c.text ?? '').join('\n');
const esperar = async (cond: () => boolean, ms = 3000) => {
  const fim = Date.now() + ms;
  while (!cond()) { if (Date.now() > fim) throw new Error('tempo esgotado'); await new Promise(r => setTimeout(r, 10)); }
};

async function mcpComBase() {
  const { server, fechar } = criarServidorMcp({
    url: 'ws://127.0.0.1:1/__ponte',
    lerToken: () => { throw new Error('sem token'); },
    arquivoDoCache: path.join(os.tmpdir(), `vazio-${Date.now()}-${Math.random()}`, 'ferramentas.json'),
    arquivoDoCatalogoBase: CAMINHO_CATALOGO_BASE_PADRAO,
    atrasosMs: [20],
  });
  const client = new Client({ name: 't', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, fechar: async () => { await fechar(); await client.close(); } };
}

test('SEMPRE: 26 nomes únicos; todos existem no catálogo-base ou são locais', () => {
  assert.equal(SEMPRE.length, 26);
  assert.equal(new Set(SEMPRE).size, 26);
  const nomes = new Set(base.map(f => f.nome));
  for (const n of SEMPRE) assert.ok(nomes.has(n) || n === 'ponte_estado' || n === 'plataforma_guia', `${n} não existe no catálogo-base`);
});

test('tools/list: as 26 SEMPRE mais as 3 locais novas, nada além, e abaixo de 24.000 bytes', async () => {
  const mcp = await mcpComBase();
  try {
    const { tools } = await mcp.client.listTools();
    assert.deepEqual(tools.map(t => t.name).sort(), [...new Set([...LOCAIS, ...SEMPRE])].sort());
    assert.equal(tools.length, 29);
    const bytes = Buffer.byteLength(JSON.stringify(tools));
    assert.ok(bytes < 24_000, `tools/list tem ${bytes} bytes`);
  } finally { await mcp.fechar(); }
});

test('o índice de plataforma_ferramentas traz toda ferramenta que não é SEMPRE nem interna', async () => {
  const mcp = await mcpComBase();
  try {
    const { tools } = await mcp.client.listTools();
    const indice = tools.find(t => t.name === 'plataforma_ferramentas')!.description!;
    assert.match(indice, /^Ferramentas sob demanda: carregue/);
    const esperadas = base.map(f => f.nome).filter(n => !ehSempre(n) && !FERRAMENTAS_INTERNAS_OCULTAS.includes(n));
    assert.ok(esperadas.length > 30);
    for (const n of esperadas) assert.ok(indice.includes(`${n} (`), `${n} falta no índice`);
    for (const n of FERRAMENTAS_INTERNAS_OCULTAS) assert.equal(indice.includes(n), false);
    for (const n of SEMPRE) assert.equal(indice.includes(`${n} (`), false, `${n} é SEMPRE e não entra no índice`);
  } finally { await mcp.fechar(); }
});

test('destrutivas sob demanda do catálogo-base são exatamente as 12 das Decisões', () => {
  const destrutivas = [...new Set(base
    .filter(f => !ehSempre(f.nome) && !FERRAMENTAS_INTERNAS_OCULTAS.includes(f.nome))
    .filter(f => ehDestrutiva(anotacoesDaFerramenta(f.nome, f.anotacoes)))
    .map(f => f.nome))].sort();
  assert.deepEqual(destrutivas, ['atelie_documento_editar', 'atlas_ambiente', 'atlas_andares', 'atlas_arranjo', 'atlas_caminho', 'dossie_ficha_editar',
    'jukebox_efeito', 'jukebox_parar', 'jukebox_tocar', 'mesa_elenco', 'mesa_entidade_editar', 'mesa_sessao_editar']);
});

test('linhaDoIndice, indiceSobDemanda e sugerirNomes', () => {
  assert.equal(linhaDoIndice('Cria um momento. Detalhes: algo.'), 'Cria um momento');
  const longa = linhaDoIndice('Dispõe até 300 objetos em padrões geométricos com variação controlada pelo mestre em qualquer área');
  assert.ok(longa.length <= 71 && longa.endsWith('…') && !/\s…$/.test(longa), longa);
  assert.equal(
    indiceSobDemanda([{ nome: 'atlas_x', descricao: 'Faz x. Mais.', app: 'atlas' }, { nome: 'atlas_abrir', descricao: 'sempre', app: 'atlas' }, { nome: 'jukebox_y', descricao: 'Toca y', app: 'jukebox' }]),
    'Atlas: atlas_x (Faz x)\nJukebox: jukebox_y (Toca y)');
  const nomes = ['atlas_momento', 'atlas_momento_testar', 'atlas_ambiente', 'mesa_elenco', 'jukebox_tocar'];
  assert.deepEqual(sugerirNomes('atlas_moment', nomes).slice(0, 2), ['atlas_momento', 'atlas_momento_testar']);
  assert.ok(sugerirNomes('atlas_nada', nomes).length <= 3);
  assert.equal(sugerirNomes('zzz', nomes).length, 0);
});

test('plataforma_ferramentas: esquema e guia de atlas_momento, erro com sugestões para o nome desconhecido', async () => {
  const mcp = await mcpComBase();
  try {
    const r: any = await mcp.client.callTool({ name: 'plataforma_ferramentas', arguments: { nomes: ['atlas_momento', 'atlas_momentoo', 'nao_existe'] } });
    assert.notEqual(r.isError, true);
    const blocos = r.content.map((c: any) => c.text as string);
    const momento = JSON.parse(blocos[0]!);
    assert.equal(momento.nome, 'atlas_momento');
    assert.equal(momento.app, 'atlas');
    assert.ok(momento.esquema?.properties);
    assert.ok(momento.descricao.length > 20);
    assert.ok(momento.executor === 'plataforma_executar' || momento.executor === 'plataforma_executar_destrutiva');
    assert.match(blocos[1]!, /^## atlas_momento\n/);
    assert.equal(/^## atlas_momento\n[\s\S]*^## /m.test(blocos[1]!), false, 'só a seção da ferramenta');
    const erro = JSON.parse(blocos[2]!);
    assert.equal(erro.nome, 'atlas_momentoo');
    assert.ok(erro.erro);
    assert.ok(erro.sugestoes.includes('atlas_momento'));
    assert.deepEqual(JSON.parse(blocos[3]!).sugestoes, []);
    // destrutiva: o executor indicado é o destrutivo
    const arr: any = await mcp.client.callTool({ name: 'plataforma_ferramentas', arguments: { nomes: ['atlas_arranjo'] } });
    assert.equal(JSON.parse(arr.content[0].text).executor, 'plataforma_executar_destrutiva');
    // limite de 8
    const muitos: any = await mcp.client.callTool({ name: 'plataforma_ferramentas', arguments: { nomes: Array(9).fill('atlas_momento') } });
    assert.equal(muitos.isError, true);
  } finally { await mcp.fechar(); }
});

async function ponteComAba(ferramentas: any[], chamadas: Array<{ ferramenta: string; args: any }>) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-niveis-'));
  const servidor = http.createServer((_q, s) => s.end('ok'));
  await new Promise<void>(r => servidor.listen(0, '127.0.0.1', r));
  const porta = (servidor.address() as AddressInfo).port;
  const origem = `http://127.0.0.1:${porta}`;
  const ponte = criarPonte({ origem, pastaDoToken: pasta });
  servidor.on('upgrade', (req, socket, cabeca) => { if (!ponte.aceitar(req, socket, cabeca)) socket.destroy(); });
  const url = `ws://127.0.0.1:${porta}/__ponte`;
  const arquivoDeUso = path.join(pasta, 'uso.json');
  const { server, fechar } = criarServidorMcp({
    url,
    lerToken: () => fs.readFileSync(path.join(pasta, 'token'), 'utf8').trim(),
    arquivoDoCache: path.join(pasta, 'ferramentas.json'),
    arquivoDoCatalogoBase: path.join(pasta, 'sem-base.json'),
    atrasosMs: [20],
    arquivoDeUso,
  });
  const client = new Client({ name: 't', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  const aba = new WebSocket(url, { origin: origem });
  aba.on('error', () => {});
  aba.on('message', d => {
    const m = JSON.parse(String(d));
    if (m.tipo !== 'chamar') return;
    chamadas.push({ ferramenta: m.ferramenta, args: m.args });
    aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: true, conteudo: [{ tipo: 'texto', texto: `ok ${m.ferramenta}` }] }));
  });
  await new Promise<void>(r => aba.once('open', () => r()));
  aba.send(JSON.stringify({ tipo: 'registrar', app: 'atlas', titulo: 'Atlas', ferramentas }));
  await new Promise(r => setTimeout(r, 100));
  return {
    client, arquivoDeUso,
    fechar: async () => { aba.terminate(); await fechar(); await client.close(); ponte.fechar(); servidor.closeAllConnections(); servidor.close(); },
  };
}

test('executores: o destrutivo e o não destrutivo se separam, com os args intactos; nome desconhecido sugere; uso registra o nome efetivo', async () => {
  const chamadas: Array<{ ferramenta: string; args: any }> = [];
  const esquema = { type: 'object', properties: {} };
  const p = await ponteComAba([
    { nome: 'atlas_arranjo', descricao: 'Arranja.', esquema, anotacoes: { destrutiva: true } },
    { nome: 'atlas_notas', descricao: 'Notas.', esquema, anotacoes: { destrutiva: false } },
    { nome: 'atlas_leitora', descricao: 'Lê.', esquema, anotacoes: { leitura: true } },
    { nome: 'atlas_salvar', descricao: 'Salva.', esquema, anotacoes: { destrutiva: false } },
  ], chamadas);
  try {
    const e1: any = await p.client.callTool({ name: 'plataforma_executar', arguments: { ferramenta: 'atlas_arranjo', args: { a: 1 } } });
    assert.equal(e1.isError, true);
    assert.match(textoDe(e1), /plataforma_executar_destrutiva/);
    const e2: any = await p.client.callTool({ name: 'plataforma_executar_destrutiva', arguments: { ferramenta: 'atlas_notas', args: {} } });
    assert.equal(e2.isError, true);
    assert.match(textoDe(e2), /plataforma_executar\b(?!_)/);
    assert.equal(chamadas.length, 0);

    const ok1: any = await p.client.callTool({ name: 'plataforma_executar_destrutiva', arguments: { ferramenta: 'atlas_arranjo', args: { a: 1, b: [2] } } });
    assert.equal(textoDe(ok1), 'ok atlas_arranjo');
    assert.deepEqual(chamadas.at(-1), { ferramenta: 'atlas_arranjo', args: { a: 1, b: [2] } });
    const ok2: any = await p.client.callTool({ name: 'plataforma_executar', arguments: { ferramenta: 'atlas_notas', args: { x: 'y' } } });
    assert.equal(textoDe(ok2), 'ok atlas_notas');
    assert.deepEqual(chamadas.at(-1), { ferramenta: 'atlas_notas', args: { x: 'y' } });
    // sem args: padrão {}; leitura e SEMPRE não destrutiva também passam pelo executor
    await p.client.callTool({ name: 'plataforma_executar', arguments: { ferramenta: 'atlas_leitora' } });
    assert.deepEqual(chamadas.at(-1), { ferramenta: 'atlas_leitora', args: {} });
    await p.client.callTool({ name: 'plataforma_executar', arguments: { ferramenta: 'atlas_salvar' } });
    assert.equal(chamadas.at(-1)!.ferramenta, 'atlas_salvar');

    // nome desconhecido, os próprios executores e args inválidos
    const d: any = await p.client.callTool({ name: 'plataforma_executar', arguments: { ferramenta: 'atlas_arranj', args: {} } });
    assert.equal(d.isError, true);
    assert.match(textoDe(d), /atlas_arranjo/);
    for (const alvo of ['plataforma_executar', 'plataforma_executar_destrutiva', 'plataforma_ferramentas']) {
      const x: any = await p.client.callTool({ name: 'plataforma_executar', arguments: { ferramenta: alvo, args: {} } });
      assert.equal(x.isError, true);
    }
    const ruim: any = await p.client.callTool({ name: 'plataforma_executar', arguments: { ferramenta: 'atlas_notas', args: [] } });
    assert.equal(ruim.isError, true);

    // chamada direta de uma sob demanda continua aceita
    const direta: any = await p.client.callTool({ name: 'atlas_notas', arguments: { z: 1 } });
    assert.equal(textoDe(direta), 'ok atlas_notas');

    // o registro de uso guarda o nome efetivo, não o do executor
    await esperar(() => { try { return JSON.parse(fs.readFileSync(p.arquivoDeUso, 'utf8')).atlas_notas?.chamadas === 3; } catch { return false; } });
    const uso = JSON.parse(fs.readFileSync(p.arquivoDeUso, 'utf8'));
    // só as chamadas que citam o próprio executor como alvo caem no nome dele (uma cada)
    assert.equal(uso.plataforma_executar.chamadas, 1);
    assert.equal(uso.plataforma_executar_destrutiva.chamadas, 1);
    assert.equal(uso.atlas_notas.chamadas, 3); // e2 (erro), ok2 e a direta
    assert.equal(uso.atlas_arranjo.chamadas, 2); // e1 (erro) e ok1
  } finally { await p.fechar(); }
});

test('uma ferramenta nova fora de SEMPRE não entra no tools/list e entra no índice', async () => {
  const p = await ponteComAba([
    { nome: 'atlas_nova_coisa', descricao: 'Faz uma coisa nova. Mais detalhes.', esquema: { type: 'object' } },
    { nome: 'atlas_salvar', descricao: 'Salva.', esquema: { type: 'object' } },
  ], []);
  try {
    const { tools } = await p.client.listTools();
    assert.equal(tools.some(t => t.name === 'atlas_nova_coisa'), false);
    assert.equal(tools.some(t => t.name === 'atlas_salvar'), true);
    assert.match(tools.find(t => t.name === 'plataforma_ferramentas')!.description!, /Atlas: atlas_nova_coisa \(Faz uma coisa nova\)/);
  } finally { await p.fechar(); }
});

test('nomeEfetivo: executores devolvem args.ferramenta (se for string); o resto, o nome da chamada', () => {
  assert.equal(nomeEfetivo({ params: { name: 'plataforma_executar', arguments: { ferramenta: 'atlas_notas' } } }), 'atlas_notas');
  assert.equal(nomeEfetivo({ params: { name: 'plataforma_executar_destrutiva', arguments: { ferramenta: 'atlas_arranjo' } } }), 'atlas_arranjo');
  assert.equal(nomeEfetivo({ params: { name: 'plataforma_executar', arguments: { ferramenta: 3 } } }), 'plataforma_executar');
  assert.equal(nomeEfetivo({ params: { name: 'plataforma_executar' } }), 'plataforma_executar');
  assert.equal(nomeEfetivo({ params: { name: 'atlas_salvar', arguments: { ferramenta: 'x' } } }), 'atlas_salvar');
});
