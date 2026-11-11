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
import { criarServidorMcp, converterConteudo, anotacoesDaFerramenta, SEM_PONTE, CAMINHO_CATALOGO_BASE_PADRAO, type McpOpcoes } from '../../scripts/ponte/mcp.ts';
import { gerarCatalogoBase } from '../../scripts/ponte/catalogo.ts';

const esperar = async (cond: () => boolean | Promise<boolean>, ms = 3000) => {
  const fim = Date.now() + ms;
  while (!(await cond())) { if (Date.now() > fim) throw new Error('tempo esgotado'); await new Promise(r => setTimeout(r, 10)); }
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

async function clienteMcp(url: string, lerToken: () => string, arquivoDoCache?: string, extras?: Partial<McpOpcoes>) {
  const cache = arquivoDoCache ?? path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-')), 'ferramentas.json');
  const basePadraoVazia = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-test-base-')), 'catalogo-base.json');
  const { server, ponta, fechar } = criarServidorMcp({
    url,
    lerToken,
    arquivoDoCache: cache,
    arquivoDoCatalogoBase: extras?.arquivoDoCatalogoBase ?? basePadraoVazia,
    atrasosMs: [20],
    ...extras,
  });
  const client = new Client({ name: 't', version: '0' });
  let mudancas = 0;
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => { mudancas++; });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, ponta, mudancas: () => mudancas, fechar: async () => { await fechar(); await client.close(); } };
}

const textoDe = (r: any) => r.content.map((c: any) => c.text ?? '').join('');

test('converterConteudo converte texto e imagem', () => {
  assert.deepEqual(converterConteudo({ tipo: 'texto', texto: 'oi' }), { type: 'text', text: 'oi' });
  assert.deepEqual(converterConteudo({ tipo: 'imagem', dados: 'AA', mime: 'image/png' }), { type: 'image', data: 'AA', mimeType: 'image/png' });
});

test('anotações MCP: readOnlyHint nas de leitura e destructiveHint: false nas de criar', () => {
  assert.deepEqual(anotacoesDaFerramenta('ponte_estado'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('mesa_campanha_atual'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('atlas_catalogo'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('campanha_listar'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('campanha_ler'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('campanha_entidade_ler'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('campanha_sessao_ler'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('atlas_mapas_listar'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('atlas_mapa_ler'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('atlas_o_que_vejo'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('atlas_ver_mapa'), { readOnlyHint: true });
  assert.deepEqual(anotacoesDaFerramenta('atlas_remover'), { destructiveHint: true });
  assert.deepEqual(anotacoesDaFerramenta('atlas_abrir'), { readOnlyHint: false, destructiveHint: false });
  assert.deepEqual(anotacoesDaFerramenta('mesa_abrir_apps'), { readOnlyHint: false, destructiveHint: false });
  assert.deepEqual(anotacoesDaFerramenta('atlas_momento_testar'), { readOnlyHint: false, destructiveHint: false });
  assert.deepEqual(anotacoesDaFerramenta('atlas_mapa_criar'), { destructiveHint: false });
  assert.deepEqual(anotacoesDaFerramenta('mesa_entidade_criar'), { destructiveHint: false });
  assert.deepEqual(anotacoesDaFerramenta('atlas_terreno'), {});
  assert.deepEqual(anotacoesDaFerramenta('atlas_comodos'), {});
});

test('aviso de armazenamentos diferentes: mesmo id não avisa; ids diferentes avisam em ponte_estado e no resultado; sem armazenamento não avisa falso', async () => {
  const p = await subirPonte();
  const token = () => fs.readFileSync(path.join(p.pasta, 'token'), 'utf8').trim();
  const mcp = await clienteMcp(p.url, token);

  const uaFirefox = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';
  const uaWebkit = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15 WebKitGTK/2.44.0';

  // Caso 1: Dois registros com o mesmo id não avisam
  const abaMesa = new WebSocket(p.url, { origin: p.origem, headers: { 'user-agent': uaFirefox } });
  const abaAtlas = new WebSocket(p.url, { origin: p.origem, headers: { 'user-agent': uaWebkit } });
  const responder = (ws: WebSocket, resposta: string) => {
    ws.on('message', d => {
      const m = JSON.parse(String(d));
      if (m.tipo === 'chamar') ws.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: true, conteudo: [{ tipo: 'texto', texto: resposta }] }));
    });
  };
  responder(abaMesa, 'mesa ok');
  responder(abaAtlas, 'atlas ok');

  try {
    await Promise.all([
      new Promise<void>(r => abaMesa.once('open', () => r())),
      new Promise<void>(r => abaAtlas.once('open', () => r())),
    ]);

    abaMesa.send(JSON.stringify({
      tipo: 'registrar', app: 'mesa', titulo: 'Mesa',
      armazenamento: 'mesmo-id',
      ferramentas: [{ nome: 'mesa_ver', descricao: 'ver', esquema: { type: 'object' } }],
    }));
    abaAtlas.send(JSON.stringify({
      tipo: 'registrar', app: 'atlas', titulo: 'Atlas',
      armazenamento: 'mesmo-id',
      ferramentas: [{ nome: 'atlas_ver', descricao: 'ver', esquema: { type: 'object' } }],
    }));

    await esperar(() => mcp.ponta.ativas().length === 2);
    const estadoMesmoId = textoDe(await mcp.client.callTool({ name: 'ponte_estado', arguments: {} }));
    assert.match(estadoMesmoId, /mesa: Firefox/);
    assert.match(estadoMesmoId, /atlas: app da Mesa \(WebKit\)/);
    assert.doesNotMatch(estadoMesmoId, /lugares com dados separados/);

    const resMesmoId = await mcp.client.callTool({ name: 'atlas_ver', arguments: {} });
    assert.equal(textoDe(resMesmoId), 'atlas ok');

    // Caso 2: Mesa e Atlas com ids diferentes geram o aviso no ponte_estado e no resultado
    abaAtlas.send(JSON.stringify({
      tipo: 'registrar', app: 'atlas', titulo: 'Atlas',
      armazenamento: 'outro-id',
      ferramentas: [{ nome: 'atlas_ver', descricao: 'ver', esquema: { type: 'object' } }],
    }));

    await esperar(async () => /lugares com dados separados/.test(textoDe(await mcp.client.callTool({ name: 'ponte_estado', arguments: {} }))));
    const estadoSeparado = textoDe(await mcp.client.callTool({ name: 'ponte_estado', arguments: {} }));
    assert.match(estadoSeparado, /Mesa e Atlas estão em lugares com dados separados: mesa: Firefox; atlas: app da Mesa \(WebKit\); feche um deles\./);

    const resSeparado = await mcp.client.callTool({ name: 'atlas_ver', arguments: {} });
    assert.match(textoDe(resSeparado), /^Mesa e Atlas estão em lugares com dados separados: mesa: Firefox; atlas: app da Mesa \(WebKit\); feche um deles\.\n\natlas ok$/);

    // Caso 3: Cliente sem armazenamento é tratado como lugar desconhecido, sem aviso falso
    abaMesa.send(JSON.stringify({
      tipo: 'registrar', app: 'mesa', titulo: 'Mesa',
      ferramentas: [{ nome: 'mesa_ver', descricao: 'ver', esquema: { type: 'object' } }],
    }));

    await esperar(async () => !/lugares com dados separados/.test(textoDe(await mcp.client.callTool({ name: 'ponte_estado', arguments: {} }))));
    const estadoSemArm = textoDe(await mcp.client.callTool({ name: 'ponte_estado', arguments: {} }));
    assert.doesNotMatch(estadoSemArm, /lugares com dados separados/);
    const resSemArm = await mcp.client.callTool({ name: 'atlas_ver', arguments: {} });
    assert.equal(textoDe(resSemArm), 'atlas ok');
  } finally {
    abaMesa.terminate();
    abaAtlas.terminate();
    await mcp.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }
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

test('catálogo estável: abrir e fechar aba não muda tools/list nem notifica; erro com endereço; ferramenta removida sai', async () => {
  const p = await subirPonte();
  const token = () => fs.readFileSync(path.join(p.pasta, 'token'), 'utf8').trim();
  const cache = path.join(p.pasta, 'ferramentas.json');
  const mcp = await clienteMcp(p.url, token, cache);
  let aba = new WebSocket(p.url, { origin: p.origem });
  aba.on('error', () => {});
  aba.on('message', d => {
    const m = JSON.parse(String(d));
    if (m.tipo !== 'chamar') return;
    if (m.ferramenta === 'atlas_ver_mapa') aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: true, conteudo: [{ tipo: 'texto', texto: 'oi' }, { tipo: 'imagem', dados: 'AA==', mime: 'image/png' }] }));
    else if (m.ferramenta === 'atlas_mapa_criar') aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: true, conteudo: [{ tipo: 'texto', texto: 'criado' }] }));
    else aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: false, erro: 'deu ruim' }));
  });
  try {
    await new Promise<void>(r => aba.once('open', () => r()));
    aba.send(JSON.stringify({ tipo: 'registrar', app: 'atlas', titulo: 'Atlas', ferramentas: [
      { nome: 'atlas_ver_mapa', descricao: 'vê', esquema: { type: 'object', properties: {} } },
      { nome: 'atlas_mapa_criar', descricao: 'cria', esquema: { type: 'object' } },
    ] }));
    await esperar(() => mcp.mudancas() === 1);
    const { tools } = await mcp.client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['ponte_estado', 'atlas_ver_mapa', 'atlas_mapa_criar']);
    assert.equal(tools.find(t => t.name === 'atlas_ver_mapa')?.annotations?.readOnlyHint, true);
    assert.equal(tools.find(t => t.name === 'atlas_mapa_criar')?.annotations?.destructiveHint, false);
    assert.match(textoDe(await mcp.client.callTool({ name: 'ponte_estado', arguments: {} })), /atlas.*\(2 ferramentas\)/);

    // Chama com sucesso
    const ok: any = await mcp.client.callTool({ name: 'atlas_ver_mapa', arguments: {} });
    assert.deepEqual(ok.content, [{ type: 'text', text: 'oi' }, { type: 'image', data: 'AA==', mimeType: 'image/png' }]);

    // Fecha a aba do Atlas: listTools não muda nem notifica!
    const mudancasAntes = mcp.mudancas();
    aba.close();
    await new Promise(r => setTimeout(r, 60));
    assert.equal(mcp.mudancas(), mudancasAntes);
    const toolsDepoisDeFechar = (await mcp.client.listTools()).tools;
    assert.deepEqual(toolsDepoisDeFechar.map(t => t.name), ['ponte_estado', 'atlas_ver_mapa', 'atlas_mapa_criar']);

    // Chamar ferramenta de app fechado devolve erro com endereço
    const erroFechado: any = await mcp.client.callTool({ name: 'atlas_ver_mapa', arguments: {} });
    assert.equal(erroFechado.isError, true);
    assert.equal(textoDe(erroFechado), `O Atlas não está aberto. Abra-o em http://127.0.0.1:${p.porta}/Atlas/ (ou peça mesa_abrir_apps) e tente de novo. (não há aba da Mesa aberta para abri-lo)`);

    // Reabre a aba com ferramenta nova: notifica uma vez
    aba = new WebSocket(p.url, { origin: p.origem });
    aba.on('error', () => {});
    await new Promise<void>(r => aba.once('open', () => r()));
    aba.send(JSON.stringify({ tipo: 'registrar', app: 'atlas', titulo: 'Atlas', ferramentas: [
      { nome: 'atlas_ver_mapa', descricao: 'vê', esquema: { type: 'object', properties: {} } },
      { nome: 'atlas_mapa_criar', descricao: 'cria', esquema: { type: 'object' } },
      { nome: 'atlas_novo', descricao: 'novo', esquema: { type: 'object' } },
    ] }));
    await esperar(() => mcp.mudancas() === 2);
    assert.deepEqual((await mcp.client.listTools()).tools.map(t => t.name), ['ponte_estado', 'atlas_ver_mapa', 'atlas_mapa_criar', 'atlas_novo']);

    // Registrar as mesmas ferramentas de novo (ex.: recarregar ou focar aba) não notifica
    aba.send(JSON.stringify({ tipo: 'registrar', app: 'atlas', titulo: 'Atlas', ferramentas: [
      { nome: 'atlas_ver_mapa', descricao: 'vê', esquema: { type: 'object', properties: {} } },
      { nome: 'atlas_mapa_criar', descricao: 'cria', esquema: { type: 'object' } },
      { nome: 'atlas_novo', descricao: 'novo', esquema: { type: 'object' } },
    ] }));
    await new Promise(r => setTimeout(r, 60));
    assert.equal(mcp.mudancas(), 2);

    // Ferramenta removida do código: sai do cache quando o app dela se registra sem ela
    aba.send(JSON.stringify({ tipo: 'registrar', app: 'atlas', titulo: 'Atlas', ferramentas: [
      { nome: 'atlas_ver_mapa', descricao: 'vê', esquema: { type: 'object', properties: {} } },
    ] }));
    await esperar(() => mcp.mudancas() === 3);
    assert.deepEqual((await mcp.client.listTools()).tools.map(t => t.name), ['ponte_estado', 'atlas_ver_mapa']);
  } finally {
    aba.terminate();
    await mcp.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }
});

test('o cache sobrevive a reiniciar o MCP', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-mcp-cache-'));
  const cache = path.join(pasta, 'ferramentas.json');
  fs.writeFileSync(cache, JSON.stringify([
    { nome: 'atlas_guardada', descricao: 'persistida', esquema: { type: 'object' }, app: 'atlas' },
  ], null, 2));

  const mcp = await clienteMcp('ws://127.0.0.1:1/__ponte', () => { throw new Error('sem token'); }, cache);
  try {
    const { tools } = await mcp.client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['ponte_estado', 'atlas_guardada']);
  } finally {
    await mcp.fechar();
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
    await esperar(() => mcp2.ponta.conectada());
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

test('dono estável: Atlas e Mesa registram campanha_listar em ordens diferentes, o dono é sempre mesa e não sai list_changed', async () => {
  const p = await subirPonte();
  const token = () => fs.readFileSync(path.join(p.pasta, 'token'), 'utf8').trim();
  const cache = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-estavel-')), 'ferramentas.json');
  const mcp = await clienteMcp(p.url, token, cache);

  const abrirAba = (app: string) => {
    const ws = new WebSocket(p.url, { origin: p.origem });
    return new Promise<WebSocket>((res) => {
      ws.once('open', () => {
        ws.send(JSON.stringify({
          tipo: 'registrar', app, titulo: app,
          ferramentas: [{ nome: 'campanha_listar', descricao: 'listar campanhas', esquema: { type: 'object' } }],
        }));
        res(ws);
      });
    });
  };

  try {
    await esperar(() => mcp.ponta.conectada());
    // Abre ambas as abas: Atlas primeiro, depois Mesa
    const abaAtlas = await abrirAba('atlas');
    const abaMesa = await abrirAba('mesa');

    await esperar(() => mcp.ponta.apps()['atlas'] !== undefined && mcp.ponta.apps()['mesa'] !== undefined);

    const ferramentas1 = (await mcp.client.listTools()).tools;
    const dono1 = mcp.ponta.catalogo().find(f => f.nome === 'campanha_listar')?.app;
    assert.equal(dono1, 'mesa');
    assert.equal(ferramentas1.find(t => t.name === 'campanha_listar')?.description, 'listar campanhas');

    const mudancasAntes = mcp.mudancas();

    // Inverte a ordem de foco entre Atlas e Mesa (o que antes fazia oscilar a ordem no m.lista)
    abaAtlas.send(JSON.stringify({ tipo: 'foco' }));
    await new Promise(r => setTimeout(r, 60));

    const dono2 = mcp.ponta.catalogo().find(f => f.nome === 'campanha_listar')?.app;
    assert.equal(dono2, 'mesa');
    // Não emitiu list_changed pois o catálogo permaneceu idêntico e estável
    assert.equal(mcp.mudancas(), mudancasAntes);

    abaMesa.send(JSON.stringify({ tipo: 'foco' }));
    await new Promise(r => setTimeout(r, 60));

    const dono3 = mcp.ponta.catalogo().find(f => f.nome === 'campanha_listar')?.app;
    assert.equal(dono3, 'mesa');
    assert.equal(mcp.mudancas(), mudancasAntes);

    abaAtlas.terminate();
    abaMesa.terminate();
  } finally {
    await mcp.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }
});

test('erros de conexão: token errado cita o token e sem servidor cita o atalho do desktop', async () => {
  const p = await subirPonte();
  // Token errado
  const mcpTokenErrado = await clienteMcp(p.url, () => 'token-invalido-errado');
  try {
    await esperar(() => mcpTokenErrado.ponta.motivo() === 'token-invalido');
    const r1 = await mcpTokenErrado.client.callTool({ name: 'ponte_estado', arguments: {} });
    assert.match(textoDe(r1), /recusou o token/);
  } finally {
    await mcpTokenErrado.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }

  // Sem servidor
  const mcpSemServidor = await clienteMcp('ws://127.0.0.1:1/__ponte', () => 'qualquer-token');
  try {
    const r2 = await mcpSemServidor.client.callTool({ name: 'ponte_estado', arguments: {} });
    assert.match(textoDe(r2), /atalho do app de desktop/);
  } finally {
    await mcpSemServidor.fechar();
  }
});

test('prazo de chamada: escrita avisa que a operação pode ter sido feita; leitura recebe mensagem curta; resposta tardia é ignorada', async () => {
  const p = await subirPonte();
  const token = () => fs.readFileSync(path.join(p.pasta, 'token'), 'utf8').trim();
  const mcp = await clienteMcp(p.url, token, undefined, { prazoMs: 40 });
  const aba = new WebSocket(p.url, { origin: p.origem });
  aba.on('error', () => {});
  aba.on('message', d => {
    const m = JSON.parse(String(d));
    if (m.tipo === 'chamar' && m.ferramenta === 'atlas_mapa_criar') {
      setTimeout(() => {
        aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: true, conteudo: [{ tipo: 'texto', texto: 'criado atrasado' }] }));
      }, 80);
    }
  });
  try {
    await new Promise<void>(r => aba.once('open', () => r()));
    aba.send(JSON.stringify({
      tipo: 'registrar',
      app: 'atlas',
      titulo: 'Atlas',
      ferramentas: [
        { nome: 'atlas_mapa_criar', descricao: 'cria', esquema: { type: 'object' } },
        { nome: 'atlas_mapa_ler', descricao: 'lê', esquema: { type: 'object' } },
      ],
    }));
    await esperar(() => mcp.ponta.ativas().some(f => f.nome === 'atlas_mapa_criar'));

    // Chamada de escrita estoura o prazo
    const rEscrita: any = await mcp.client.callTool({ name: 'atlas_mapa_criar', arguments: {} });
    assert.equal(rEscrita.isError, true);
    assert.match(textoDe(rEscrita), /"atlas_mapa_criar" não respondeu em 0 s\. A operação pode ter sido feita mesmo assim: confira com a ferramenta de leitura/);

    // Espera a resposta tardia chegar na aba e garante que nada quebrou (resposta tardia foi ignorada sem lançar erro)
    await new Promise(r => setTimeout(r, 100));

    // Chamada de leitura estoura o prazo
    const rLeitura: any = await mcp.client.callTool({ name: 'atlas_mapa_ler', arguments: {} });
    assert.equal(rLeitura.isError, true);
    assert.match(textoDe(rLeitura), /"atlas_mapa_ler" não respondeu em 0 s; tente de novo\./);
  } finally {
    aba.terminate();
    await mcp.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }
});

test('notificação de progresso: cliente com progressToken recebe avisos a cada intervalo', async () => {
  const p = await subirPonte();
  const token = () => fs.readFileSync(path.join(p.pasta, 'token'), 'utf8').trim();
  const mcp = await clienteMcp(p.url, token, undefined, { intervaloDeProgressoMs: 25, prazoMs: 250 });
  const aba = new WebSocket(p.url, { origin: p.origem });
  aba.on('error', () => {});
  aba.on('message', d => {
    const m = JSON.parse(String(d));
    if (m.tipo === 'chamar') {
      setTimeout(() => {
        aba.send(JSON.stringify({ tipo: 'resultado', id: m.id, ok: true, conteudo: [{ tipo: 'texto', texto: 'sucesso' }] }));
      }, 70);
    }
  });
  try {
    await new Promise<void>(r => aba.once('open', () => r()));
    aba.send(JSON.stringify({
      tipo: 'registrar',
      app: 'atlas',
      titulo: 'Atlas',
      ferramentas: [{ nome: 'atlas_mapa_criar', descricao: 'cria', esquema: { type: 'object' } }],
    }));
    await esperar(() => mcp.ponta.ativas().some(f => f.nome === 'atlas_mapa_criar'));

    const notificacoes: any[] = [];
    const r: any = await mcp.client.callTool(
      { name: 'atlas_mapa_criar', arguments: {} },
      undefined,
      { onprogress: p => notificacoes.push(p) },
    );
    assert.equal(r.isError, undefined);
    assert.equal(textoDe(r), 'sucesso');
    assert.ok(notificacoes.length >= 2, `esperava >= 2 notificações, recebeu ${notificacoes.length}`);
    assert.equal(notificacoes[0].message, 'esperando a aba…');
    assert.equal(notificacoes[0].progress, 1);
  } finally {
    aba.terminate();
    await mcp.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }
});

test('catálogo base: base com jukebox_listar e cache vazio traz a ferramenta sem aba aberta', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-mcp-base-'));
  const arquivoBase = path.join(pasta, 'catalogo-base.json');
  fs.writeFileSync(arquivoBase, JSON.stringify([
    { nome: 'jukebox_listar', descricao: 'lista', esquema: { type: 'object' }, app: 'jukebox' },
  ]));
  const mcp = await clienteMcp('ws://127.0.0.1:1/__ponte', () => { throw new Error('sem token'); }, undefined, {
    arquivoDoCatalogoBase: arquivoBase,
  });
  try {
    const { tools } = await mcp.client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['ponte_estado', 'jukebox_listar']);
  } finally {
    await mcp.fechar();
  }
});

test('catálogo base: cache com descrição nova vence a base', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-mcp-base-'));
  const arquivoBase = path.join(pasta, 'catalogo-base.json');
  const arquivoCache = path.join(pasta, 'ferramentas.json');
  fs.writeFileSync(arquivoBase, JSON.stringify([
    { nome: 'jukebox_listar', descricao: 'descrição velha', esquema: { type: 'object' }, app: 'jukebox' },
  ]));
  fs.writeFileSync(arquivoCache, JSON.stringify([
    { nome: 'jukebox_listar', descricao: 'descrição nova do cache', esquema: { type: 'object' }, app: 'jukebox' },
  ]));
  const mcp = await clienteMcp('ws://127.0.0.1:1/__ponte', () => { throw new Error('sem token'); }, arquivoCache, {
    arquivoDoCatalogoBase: arquivoBase,
  });
  try {
    const { tools } = await mcp.client.listTools();
    const jb = tools.find(t => t.name === 'jukebox_listar');
    assert.equal(jb?.description, 'descrição nova do cache');
  } finally {
    await mcp.fechar();
  }
});

test('catálogo base: aba do Atlas registrando sem uma ferramenta da base faz ela sair', async () => {
  const p = await subirPonte();
  const token = () => fs.readFileSync(path.join(p.pasta, 'token'), 'utf8').trim();
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-mcp-base-'));
  const arquivoBase = path.join(pasta, 'catalogo-base.json');
  const arquivoCache = path.join(pasta, 'ferramentas.json');
  fs.writeFileSync(arquivoBase, JSON.stringify([
    { nome: 'atlas_antiga', descricao: 'antiga', esquema: { type: 'object' }, app: 'atlas' },
    { nome: 'atlas_continua', descricao: 'continua', esquema: { type: 'object' }, app: 'atlas' },
  ]));
  const mcp = await clienteMcp(p.url, token, arquivoCache, { arquivoDoCatalogoBase: arquivoBase });
  const aba = new WebSocket(p.url, { origin: p.origem });
  aba.on('error', () => {});
  try {
    await new Promise<void>(r => aba.once('open', () => r()));
    // Aba do Atlas se registra apenas com 'atlas_continua'
    aba.send(JSON.stringify({
      tipo: 'registrar',
      app: 'atlas',
      titulo: 'Atlas',
      ferramentas: [
        { nome: 'atlas_continua', descricao: 'continua', esquema: { type: 'object' } },
      ],
    }));
    await esperar(() => mcp.mudancas() === 1);
    const { tools } = await mcp.client.listTools();
    assert.deepEqual(tools.map(t => t.name), ['ponte_estado', 'atlas_continua']);
  } finally {
    aba.terminate();
    await mcp.fechar();
    p.ponte.fechar();
    p.servidor.closeAllConnections();
    p.servidor.close();
  }
});

test('gerarCatalogoBase sobre cache de teste gera JSON ordenado, descarta campos de rede e avisa de apps faltantes', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'ponte-mcp-gerar-'));
  const cache = path.join(pasta, 'ferramentas.json');
  const destino = path.join(pasta, 'catalogo-base.json');
  fs.writeFileSync(cache, JSON.stringify([
    { nome: 'z_ferramenta', descricao: 'z', esquema: {}, app: 'atlas', armazenamento: 'id1', onde: 'Firefox' },
    { nome: 'a_ferramenta', descricao: 'a', esquema: {}, app: 'mesa', armazenamento: 'id2' },
  ]));
  const r = gerarCatalogoBase(cache, destino);
  assert.equal(r.total, 2);
  assert.deepEqual(r.faltantes.sort(), ['atelie', 'ficha', 'jukebox']);
  const gerado = JSON.parse(fs.readFileSync(destino, 'utf8'));
  assert.equal(gerado.length, 2);
  assert.equal(gerado[0].nome, 'a_ferramenta');
  assert.equal(gerado[1].nome, 'z_ferramenta');
  assert.equal(gerado[0].armazenamento, undefined);
  assert.equal(gerado[0].onde, undefined);
});

test('com .ponte apagado, tools/list traz as 4 jukebox_* e mesa_elenco do catalogo-base padrão', async () => {
  const cacheInexistente = path.join(os.tmpdir(), `inexistente-${Date.now()}`, 'ferramentas.json');
  const { server, fechar } = criarServidorMcp({
    url: 'ws://127.0.0.1:1/__ponte',
    lerToken: () => { throw new Error('sem token'); },
    arquivoDoCache: cacheInexistente,
    arquivoDoCatalogoBase: CAMINHO_CATALOGO_BASE_PADRAO,
  });
  const client = new Client({ name: 't', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const { tools } = await client.listTools();
    const nomes = tools.map(t => t.name);
    assert.ok(nomes.includes('jukebox_listar'));
    assert.ok(nomes.includes('jukebox_tocar'));
    assert.ok(nomes.includes('jukebox_efeito'));
    assert.ok(nomes.includes('jukebox_parar'));
    assert.ok(nomes.includes('mesa_elenco'));
    assert.ok(nomes.includes('mesa_elenco_ler'));
  } finally {
    await fechar();
    await client.close();
  }
});

test('anotações declaradas vencem o palpite por nome', () => {
  // Sem declarada, atlas_terreno cai no palpite {}
  assert.deepEqual(anotacoesDaFerramenta('atlas_terreno'), {});
  // Com declarada destrutiva: true, vira destructiveHint: true
  assert.deepEqual(anotacoesDaFerramenta('atlas_terreno', { destrutiva: true }), { destructiveHint: true });
  // Leitura declarada
  assert.deepEqual(anotacoesDaFerramenta('minha_leitura', { leitura: true }), { readOnlyHint: true });
  // Abertura / idempotente declarada
  assert.deepEqual(anotacoesDaFerramenta('minha_abrir', { destrutiva: false, idempotente: true }), { destructiveHint: false, idempotentHint: true });
});

test('todas as ferramentas do Atlas e da Mesa declaram anotacoes e trazem annotations no tools/list', async () => {
  const { ferramentasDeLeitura } = await import('../../src/app/ponte-leitura.ts');
  const { ferramentasDeEscrita } = await import('../../src/app/ponte-escrita.ts');
  const { ferramentasDaCampanha } = await import('../../mesa-core/src/ponte.ts');
  // @ts-ignore
  const { ferramentasDeCena, ferramentasDeElenco, ferramentasDeEntidade, ferramentasDeSessao } = await import('../../../Mesa/src/app/ponte-escrita.ts');

  const fakeCtxAtlasLeitura = { repo: () => null, mapaAberto: () => null, abrirMapa: async () => {} };
  const fakeCtxAtlasEscrita = { repo: () => null, store: () => null, abrirMapa: async () => {} };
  const atlasTools = [
    ...ferramentasDaCampanha(async () => null as any),
    ...ferramentasDeLeitura(fakeCtxAtlasLeitura),
    ...ferramentasDeEscrita(fakeCtxAtlasEscrita),
  ];

  const fakeCtxMesa: any = { campanha: async () => null, entidades: async () => [], ligacoes: async () => [], sessoes: async () => [] };
  const mesaTools = [
    ...ferramentasDeSessao(fakeCtxMesa),
    ...ferramentasDeEntidade(fakeCtxMesa),
    ...ferramentasDeCena(fakeCtxMesa),
    ...ferramentasDeElenco(fakeCtxMesa),
    { nome: 'mesa_campanha_atual', anotacoes: { leitura: true } },
    { nome: 'mesa_o_que_vejo', anotacoes: { leitura: true } },
  ];

  for (const t of atlasTools) {
    assert.ok(t.anotacoes, `Ferramenta do Atlas "${t.nome}" deve declarar anotacoes`);
  }
  for (const t of mesaTools) {
    assert.ok(t.anotacoes, `Ferramenta da Mesa "${t.nome}" deve declarar anotacoes`);
  }

  // Verifica no tools/list a partir do catalogo-base
  const { server, fechar } = criarServidorMcp({
    url: 'ws://127.0.0.1:1/__ponte',
    lerToken: () => { throw new Error('sem token'); },
    arquivoDoCache: path.join(os.tmpdir(), `vazio-${Date.now()}`, 'ferramentas.json'),
    arquivoDoCatalogoBase: CAMINHO_CATALOGO_BASE_PADRAO,
  });
  const client = new Client({ name: 't', version: '0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  try {
    const { tools } = await client.listTools();
    const atlasENomes = [...atlasTools.map(t => t.nome), ...mesaTools.map(t => t.nome)];
    for (const nome of atlasENomes) {
      const tool = tools.find(t => t.name === nome);
      assert.ok(tool, `Ferramenta "${nome}" deve estar no catálogo`);
      assert.ok(tool.annotations, `Ferramenta "${nome}" deve trazer annotations no tools/list`);
    }
  } finally {
    await fechar();
    await client.close();
  }
});

test('instruções do servidor: client.getInstructions() devolve o texto configurado ou undefined', async () => {
  // Com instruções
  const mcpCom = await clienteMcp('ws://127.0.0.1:1/__ponte', () => { throw new Error('sem token'); }, undefined, {
    instrucoes: 'instruções de teste da plataforma',
  });
  try {
    assert.equal(mcpCom.client.getInstructions(), 'instruções de teste da plataforma');
  } finally {
    await mcpCom.fechar();
  }

  // Sem instruções
  const mcpSem = await clienteMcp('ws://127.0.0.1:1/__ponte', () => { throw new Error('sem token'); });
  try {
    assert.equal(mcpSem.client.getInstructions(), undefined);
  } finally {
    await mcpSem.fechar();
  }
});

