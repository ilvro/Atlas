/**
 * Servidor MCP (stdio) da ponte do assistente, só desenvolvimento. O app do Claude lança este processo; ele fala MCP
 * por stdin/stdout e repassa tudo para a ponte do mesa-dev (/__ponte). Stdout é só do protocolo: logs vão para stderr.
 */
import fs from 'node:fs';
import path from 'node:path';
import { WebSocket } from 'ws';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { lerMensagem } from './protocolo.ts';
import type { Conteudo, FerramentaDoApp, Resultado } from './protocolo.ts';

export const ATRASOS_MS = [1000, 2000, 5000, 10000];

export interface PontaOpcoes {
  url: string;
  /** Lê o token atual (muda a cada partida do mesa-dev); pode lançar se o arquivo não existe. */
  lerToken: () => string;
  aoMudar?: () => void;
  atrasosMs?: number[];
}

export interface Ponta {
  conectada: () => boolean;
  ferramentas: () => FerramentaDoApp[];
  chamar: (ferramenta: string, args: Record<string, unknown>) => Promise<Resultado>;
  fechar: () => void;
}

/** Conexão com a ponte: reconecta em silêncio, relendo o token a cada tentativa. */
export function conectarNaPonte(op: PontaOpcoes): Ponta {
  const atrasos = op.atrasosMs ?? ATRASOS_MS;
  let ws: WebSocket | null = null;
  let aberta = false;
  let lista: FerramentaDoApp[] = [];
  let tentativa = 0;
  let parado = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  const pendentes = new Map<string, (r: Resultado) => void>();

  const falharPendentes = (erro: string) => {
    for (const [id, r] of pendentes) r({ tipo: 'resultado', id, ok: false, erro });
    pendentes.clear();
  };
  const reagendar = () => {
    if (parado) return;
    const espera = atrasos[Math.min(tentativa, atrasos.length - 1)];
    tentativa++;
    temporizador = setTimeout(abrir, espera);
  };
  function abrir() {
    if (parado) return;
    let token: string;
    try { token = op.lerToken(); } catch { reagendar(); return; }
    const socket = new WebSocket(op.url);
    ws = socket;
    socket.on('open', () => { socket.send(JSON.stringify({ tipo: 'ola', token })); });
    socket.on('message', dados => {
      const m = lerMensagem(String(dados));
      if (!m) return;
      if (m.tipo === 'ferramentas') {
        const antes = JSON.stringify(lista);
        const primeira = !aberta;
        aberta = true; tentativa = 0; lista = m.lista;
        if (primeira || antes !== JSON.stringify(lista)) op.aoMudar?.();
      } else if (m.tipo === 'resultado') {
        const r = pendentes.get(m.id);
        if (r) { pendentes.delete(m.id); r(m); }
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      if (ws !== socket) return;
      const eraAberta = aberta;
      ws = null; aberta = false;
      const tinha = lista.length > 0;
      lista = [];
      falharPendentes('A ponte caiu durante a chamada. Confira se o `npm run mesa-dev` ainda está rodando e tente de novo.');
      if (eraAberta || tinha) op.aoMudar?.();
      reagendar();
    });
  }
  abrir();

  return {
    conectada: () => aberta,
    ferramentas: () => lista,
    chamar: (ferramenta, args) => new Promise<Resultado>(resolver => {
      if (!ws || !aberta) { resolver({ tipo: 'resultado', id: '', ok: false, erro: SEM_PONTE }); return; }
      const id = `m${++seq}`;
      pendentes.set(id, resolver);
      ws.send(JSON.stringify({ tipo: 'chamar', id, ferramenta, args }));
    }),
    fechar: () => {
      parado = true;
      if (temporizador) clearTimeout(temporizador);
      falharPendentes('Servidor MCP encerrado.');
      ws?.terminate();
    },
  };
}

export const SEM_PONTE = 'A ponte não está conectada. Rode `npm run mesa-dev` no Atlas e abra a Mesa ou o Atlas em http://127.0.0.1:5100/.';

export const FERRAMENTA_ESTADO = {
  name: 'ponte_estado',
  description: 'Diz se a ponte com a plataforma está conectada e quais apps (abas abertas) e ferramentas estão disponíveis.',
  inputSchema: { type: 'object' as const, properties: {} },
};

export function textoDoEstado(conectada: boolean, ferramentas: FerramentaDoApp[]): string {
  if (!conectada) return SEM_PONTE;
  const porApp = new Map<string, number>();
  for (const f of ferramentas) porApp.set(f.app, (porApp.get(f.app) ?? 0) + 1);
  if (porApp.size === 0) return 'Ponte conectada, mas nenhuma aba está aberta. Abra a Mesa ou o Atlas em http://127.0.0.1:5100/.';
  const apps = [...porApp].map(([app, n]) => `${app} (${n} ferramentas)`).join(', ');
  return `Ponte conectada. Apps com aba aberta: ${apps}.`;
}

/** Ferramentas para o `tools/list`: `ponte_estado` sempre, depois as das abas. */
export function listarFerramentas(ferramentas: FerramentaDoApp[]) {
  return [
    FERRAMENTA_ESTADO,
    ...ferramentas.map(f => ({ name: f.nome, description: f.descricao, inputSchema: f.esquema as { type: 'object'; [k: string]: unknown } })),
  ];
}

export function converterConteudo(c: Conteudo) {
  return c.tipo === 'texto' ? { type: 'text' as const, text: c.texto } : { type: 'image' as const, data: c.dados, mimeType: c.mime };
}

/** `tools/call`: roteia para `ponte_estado` ou para a ponte e converte o resultado. */
export async function chamarFerramenta(ponta: Ponta, nome: string, args: Record<string, unknown>) {
  if (nome === FERRAMENTA_ESTADO.name) return { content: [{ type: 'text' as const, text: textoDoEstado(ponta.conectada(), ponta.ferramentas()) }] };
  if (!ponta.conectada()) return { isError: true, content: [{ type: 'text' as const, text: SEM_PONTE }] };
  if (!ponta.ferramentas().some(f => f.nome === nome))
    return { isError: true, content: [{ type: 'text' as const, text: `A ferramenta "${nome}" não está disponível (a aba do app foi fechada?). Rode \`ponte_estado\` para ver o que está conectado.` }] };
  const r = await ponta.chamar(nome, args);
  if (!r.ok) return { isError: true, content: [{ type: 'text' as const, text: r.erro }] };
  return { content: r.conteudo.map(converterConteudo) };
}

export interface McpOpcoes { url: string; lerToken: () => string; atrasosMs?: number[] }

/** Monta o servidor MCP `mesa` (sem transporte) sobre uma conexão com a ponte. */
export function criarServidorMcp(op: McpOpcoes) {
  const server = new Server({ name: 'mesa', version: '0.1.0' }, { capabilities: { tools: { listChanged: true } } });
  let pronto = false;
  const ponta = conectarNaPonte({
    ...op,
    aoMudar: () => { if (pronto) server.sendToolListChanged().catch(() => {}); },
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listarFerramentas(ponta.ferramentas()) }));
  server.setRequestHandler(CallToolRequestSchema, async req => chamarFerramenta(ponta, req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>));
  server.oninitialized = () => { pronto = true; };
  return { server, ponta, fechar: () => { ponta.fechar(); return server.close(); } };
}

/** Raiz do Atlas, a partir deste arquivo (o app do Claude lança o processo de qualquer pasta). */
const raiz = path.resolve(import.meta.dirname, '..', '..');

async function principal() {
  const porta = process.env.MESA_PORTA ?? '5100';
  const arquivoDoToken = path.join(raiz, '.ponte', 'token');
  const { server } = criarServidorMcp({
    url: `ws://127.0.0.1:${porta}/__ponte`,
    lerToken: () => fs.readFileSync(arquivoDoToken, 'utf8').trim(),
  });
  await server.connect(new StdioServerTransport());
  console.error(`[mesa-mcp] pronto; ponte em ws://127.0.0.1:${porta}/__ponte`);
}

if (import.meta.main) principal().catch(e => { console.error('[mesa-mcp] erro:', e); process.exit(1); });
