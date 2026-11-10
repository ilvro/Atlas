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
import type { AppConectado, Conteudo, FerramentaDoApp, Resultado } from './protocolo.ts';

export const ATRASOS_MS = [1000, 2000, 5000, 10000];

/** Raiz do Atlas, a partir deste arquivo (o app do Claude lança o processo de qualquer pasta). */
const raiz = path.resolve(import.meta.dirname, '..', '..');
export const CAMINHO_CACHE_PADRAO = path.join(raiz, '.ponte', 'ferramentas.json');

export interface PontaOpcoes {
  url: string;
  /** Lê o token atual (muda a cada partida do mesa-dev); pode lançar se o arquivo não existe. */
  lerToken: () => string;
  arquivoDoCache?: string;
  aoMudar?: () => void;
  atrasosMs?: number[];
}

export interface Ponta {
  conectada: () => boolean;
  /** Ferramentas ativas nas abas abertas agora. */
  ativas: () => FerramentaDoApp[];
  /** Informações dos apps conectados agora ({ armazenamento, onde }). */
  apps: () => Record<string, AppConectado>;
  /** Aviso de armazenamentos diferentes entre os apps abertos, ou `null`. */
  avisoArmazenamento: () => string | null;
  /** Catálogo persistente completo (cache mais o que está registrado agora). */
  catalogo: () => FerramentaDoApp[];
  /** Alias para `ativas()` (compatibilidade). */
  ferramentas: () => FerramentaDoApp[];
  origemHttp: () => string;
  chamar: (ferramenta: string, args: Record<string, unknown>) => Promise<Resultado>;
  fechar: () => void;
}

export function carregarCache(caminho?: string): Map<string, FerramentaDoApp> {
  const mapa = new Map<string, FerramentaDoApp>();
  if (!caminho) return mapa;
  try {
    if (fs.existsSync(caminho)) {
      const conteudo = fs.readFileSync(caminho, 'utf8');
      const dados = JSON.parse(conteudo);
      if (Array.isArray(dados)) {
        for (const item of dados) {
          if (item && typeof item.nome === 'string' && typeof item.app === 'string') {
            mapa.set(item.nome, item as FerramentaDoApp);
          }
        }
      }
    }
  } catch (e) {
    console.error('[mesa-mcp] aviso: erro ao ler cache de ferramentas:', e);
  }
  return mapa;
}

export function salvarCache(caminho: string | undefined, mapa: Map<string, FerramentaDoApp>): void {
  if (!caminho) return;
  try {
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    fs.writeFileSync(caminho, JSON.stringify([...mapa.values()], null, 2), 'utf8');
  } catch (e) {
    console.error('[mesa-mcp] aviso: erro ao salvar cache de ferramentas:', e);
  }
}

export function assinaturaDoCatalogo(catalogo: Map<string, FerramentaDoApp>): string {
  const chaves = [...catalogo.keys()].sort();
  const obj = chaves.map(k => {
    const f = catalogo.get(k)!;
    return { nome: f.nome, descricao: f.descricao, esquema: f.esquema, app: f.app };
  });
  return JSON.stringify(obj);
}

export function extrairOrigemHttp(urlWs: string): string {
  try {
    const u = new URL(urlWs);
    const proto = u.protocol === 'wss:' ? 'https:' : 'http:';
    return `${proto}//${u.host}`;
  } catch {
    return 'http://127.0.0.1:5100';
  }
}

export function nomeLegivelDoApp(app: string): string {
  const nomes: Record<string, string> = {
    atlas: 'Atlas',
    mesa: 'Mesa',
    atelie: 'Ateliê',
    dossie: 'Dossiê',
    jukebox: 'Jukebox',
    tabletop: 'Tabletop',
  };
  return nomes[app] ?? (app.charAt(0).toUpperCase() + app.slice(1));
}

function formatarNomesEmPortugues(nomes: string[]): string {
  if (nomes.length === 0) return '';
  if (nomes.length === 1) return nomes[0]!;
  if (nomes.length === 2) return `${nomes[0]} e ${nomes[1]}`;
  return `${nomes.slice(0, -1).join(', ')} e ${nomes[nomes.length - 1]}`;
}

/**
 * Se houver mais de um armazenamento diferente entre os apps abertos, gera o aviso para Claude e o mestre.
 * Apps sem armazenamento declarado são tratados como lugar desconhecido, sem disparar aviso falso.
 */
export function gerarAvisoArmazenamento(
  apps: Record<string, AppConectado>,
  appsAbertos?: Iterable<string>,
): string | null {
  const chaves = appsAbertos ? [...appsAbertos] : Object.keys(apps);
  const entradas = chaves
    .map(app => ({ app, info: apps[app] }))
    .filter((x): x is { app: string; info: AppConectado } => Boolean(x.info && typeof x.info.armazenamento === 'string' && x.info.armazenamento.trim() !== ''));

  const ids = new Set(entradas.map(x => x.info.armazenamento));
  if (ids.size <= 1) return null;

  const nomes = formatarNomesEmPortugues(entradas.map(x => nomeLegivelDoApp(x.app)));
  const detalhes = entradas.map(x => `${x.app}: ${x.info.onde ?? 'outro navegador'}`).join('; ');
  return `${nomes} estão em lugares com dados separados: ${detalhes}; feche um deles.`;
}

export function erroAppFechado(app: string, origem = 'http://127.0.0.1:5100'): string {
  const info: Record<string, { rotulo: string; caminho: string; artigo: string; temAbrirApps?: boolean }> = {
    atlas: { rotulo: 'Atlas', caminho: 'Atlas', artigo: 'O', temAbrirApps: true },
    mesa: { rotulo: 'Mesa', caminho: 'Mesa', artigo: 'A', temAbrirApps: false },
    atelie: { rotulo: 'Ateliê', caminho: 'Atelie', artigo: 'O', temAbrirApps: true },
    dossie: { rotulo: 'Dossiê', caminho: 'Dossie', artigo: 'O', temAbrirApps: true },
    jukebox: { rotulo: 'Jukebox', caminho: 'Jukebox', artigo: 'O', temAbrirApps: true },
    tabletop: { rotulo: 'Tabletop', caminho: 'Tabletop', artigo: 'O', temAbrirApps: true },
  };
  const dados = info[app] ?? { rotulo: app, caminho: app, artigo: 'O', temAbrirApps: true };
  const base = origem.replace(/\/+$/, '');
  const url = `${base}/${dados.caminho}/`;
  const sufixoAbrir = dados.temAbrirApps ? ' (ou peça mesa_abrir_apps)' : '';
  const verbo = dados.artigo === 'A' ? 'Abra-a' : 'Abra-o';
  return `${dados.artigo} ${dados.rotulo} não está abert${dados.artigo === 'A' ? 'a' : 'o'}. ${verbo} em ${url}${sufixoAbrir} e tente de novo.`;
}

export function ehLeitura(nome: string): boolean {
  return (
    nome === 'ponte_estado' ||
    nome === 'mesa_campanha_atual' ||
    nome.startsWith('campanha_') ||
    nome.endsWith('_ler') ||
    nome.endsWith('_listar') ||
    nome.endsWith('_o_que_vejo') ||
    nome.endsWith('_ver_mapa')
  );
}

export function ehCriacao(nome: string): boolean {
  return nome.endsWith('_criar');
}

export function anotacoesDaFerramenta(nome: string): { readOnlyHint?: boolean; destructiveHint?: boolean } {
  if (ehLeitura(nome)) return { readOnlyHint: true };
  if (ehCriacao(nome)) return { destructiveHint: false };
  return {};
}

/** Conexão com a ponte: reconecta em silêncio, relendo o token a cada tentativa. */
export function conectarNaPonte(op: PontaOpcoes): Ponta {
  const atrasos = op.atrasosMs ?? ATRASOS_MS;
  const caminhoCache = op.arquivoDoCache ?? CAMINHO_CACHE_PADRAO;
  const catalogo = carregarCache(caminhoCache);
  let ultimaAssinatura = assinaturaDoCatalogo(catalogo);

  let ws: WebSocket | null = null;
  let aberta = false;
  let ativas: FerramentaDoApp[] = [];
  let appsConectados: Record<string, AppConectado> = {};
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
        aberta = true;
        tentativa = 0;
        ativas = m.lista;

        if (m.apps) {
          appsConectados = m.apps;
        } else {
          appsConectados = {};
          for (const f of m.lista) {
            if (!appsConectados[f.app]) {
              appsConectados[f.app] = {
                ...(f.armazenamento ? { armazenamento: f.armazenamento } : {}),
                onde: f.onde ?? 'outro navegador',
              };
            }
          }
        }

        // Ferramenta removida do código: sai do cache quando o app dela se registra sem ela.
        const appsAtivos = new Set(m.lista.map(f => f.app));
        for (const [nome, f] of catalogo) {
          if (appsAtivos.has(f.app) && !m.lista.some(nova => nova.nome === nome)) {
            catalogo.delete(nome);
          }
        }
        // Incorpora / atualiza as ferramentas registradas no catálogo.
        for (const f of m.lista) {
          catalogo.set(f.nome, f);
        }

        const novaAssinatura = assinaturaDoCatalogo(catalogo);
        if (novaAssinatura !== ultimaAssinatura) {
          ultimaAssinatura = novaAssinatura;
          salvarCache(caminhoCache, catalogo);
          op.aoMudar?.();
        }
      } else if (m.tipo === 'resultado') {
        const r = pendentes.get(m.id);
        if (r) { pendentes.delete(m.id); r(m); }
      }
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      if (ws !== socket) return;
      ws = null;
      aberta = false;
      ativas = [];
      appsConectados = {};
      falharPendentes('A ponte caiu durante a chamada. Confira se o `npm run mesa-dev` ainda está rodando e tente de novo.');
      reagendar();
    });
  }
  abrir();

  const origemHttp = () => extrairOrigemHttp(op.url);

  return {
    conectada: () => aberta,
    ativas: () => ativas,
    apps: () => appsConectados,
    avisoArmazenamento: () => gerarAvisoArmazenamento(appsConectados),
    catalogo: () => [...catalogo.values()],
    ferramentas: () => ativas,
    origemHttp,
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
  annotations: { readOnlyHint: true },
  readOnlyHint: true,
};

export function textoDoEstado(
  conectada: boolean,
  ferramentas: FerramentaDoApp[],
  appsInfo?: Record<string, AppConectado>,
): string {
  if (!conectada) return SEM_PONTE;
  const porApp = new Map<string, number>();
  for (const f of ferramentas) porApp.set(f.app, (porApp.get(f.app) ?? 0) + 1);
  if (porApp.size === 0) return 'Ponte conectada, mas nenhuma aba está aberta. Abra a Mesa ou o Atlas em http://127.0.0.1:5100/.';

  const infoDe = (app: string) => {
    if (appsInfo?.[app]) return appsInfo[app];
    const f = ferramentas.find(x => x.app === app);
    return f ? { onde: f.onde, armazenamento: f.armazenamento } : undefined;
  };

  const apps = [...porApp].map(([app, n]) => {
    const info = infoDe(app);
    const onde = info?.onde ? `: ${info.onde}` : '';
    return `${app}${onde} (${n} ferramentas)`;
  }).join('; ');

  let texto = `Ponte conectada. Apps com aba aberta: ${apps}.`;

  const mapaAbertos: Record<string, AppConectado> = {};
  for (const app of porApp.keys()) {
    const info = infoDe(app);
    if (info) mapaAbertos[app] = info;
  }
  const aviso = gerarAvisoArmazenamento(mapaAbertos);
  if (aviso) texto += `\n${aviso}`;

  return texto;
}

/** Ferramentas para o `tools/list`: `ponte_estado` sempre, depois as do catálogo. */
export function listarFerramentas(catalogo: FerramentaDoApp[]) {
  return [
    FERRAMENTA_ESTADO,
    ...catalogo.map(f => {
      const anotacoes = anotacoesDaFerramenta(f.nome);
      return {
        name: f.nome,
        description: f.descricao,
        inputSchema: (f.esquema ?? { type: 'object', properties: {} }) as { type: 'object'; [k: string]: unknown },
        ...(Object.keys(anotacoes).length > 0 ? { annotations: anotacoes } : {}),
        ...anotacoes,
      };
    }),
  ];
}

export function converterConteudo(c: Conteudo) {
  return c.tipo === 'texto' ? { type: 'text' as const, text: c.texto } : { type: 'image' as const, data: c.dados, mimeType: c.mime };
}

export function acrescentarAviso<T extends { content: Array<{ type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }> }>(
  resultado: T,
  aviso: string | null,
): T {
  if (!aviso) return resultado;
  const primeiro = resultado.content[0];
  if (primeiro && primeiro.type === 'text') {
    return {
      ...resultado,
      content: [
        { type: 'text' as const, text: `${aviso}\n\n${primeiro.text}` },
        ...resultado.content.slice(1),
      ],
    };
  }
  return {
    ...resultado,
    content: [{ type: 'text' as const, text: aviso }, ...resultado.content],
  };
}

/** `tools/call`: roteia para `ponte_estado` ou para a ponte e converte o resultado. */
export async function chamarFerramenta(ponta: Ponta, nome: string, args: Record<string, unknown>) {
  const ativas = ponta.ativas ? ponta.ativas() : ponta.ferramentas();
  const apps = ponta.apps ? ponta.apps() : undefined;
  if (nome === FERRAMENTA_ESTADO.name) return { content: [{ type: 'text' as const, text: textoDoEstado(ponta.conectada(), ativas, apps) }] };
  if (!ponta.conectada()) return { isError: true, content: [{ type: 'text' as const, text: SEM_PONTE }] };
  const catalogo = ponta.catalogo ? ponta.catalogo() : ativas;
  const ferramenta = catalogo.find(f => f.nome === nome);
  if (!ferramenta)
    return { isError: true, content: [{ type: 'text' as const, text: `A ferramenta "${nome}" não está disponível. Rode \`ponte_estado\` para ver o que está conectado.` }] };
  if (!ativas.some(f => f.nome === nome)) {
    const origem = ponta.origemHttp ? ponta.origemHttp() : 'http://127.0.0.1:5100';
    return { isError: true, content: [{ type: 'text' as const, text: erroAppFechado(ferramenta.app, origem) }] };
  }
  const r = await ponta.chamar(nome, args);
  const aviso = ponta.avisoArmazenamento ? ponta.avisoArmazenamento() : (apps ? gerarAvisoArmazenamento(apps) : null);
  if (!r.ok) return acrescentarAviso({ isError: true, content: [{ type: 'text' as const, text: r.erro }] }, aviso);
  return acrescentarAviso({ content: r.conteudo.map(converterConteudo) }, aviso);
}

export interface McpOpcoes {
  url: string;
  lerToken: () => string;
  arquivoDoCache?: string;
  atrasosMs?: number[];
}

/** Monta o servidor MCP `mesa` (sem transporte) sobre uma conexão com a ponte. */
export function criarServidorMcp(op: McpOpcoes) {
  const server = new Server({ name: 'mesa', version: '0.1.0' }, { capabilities: { tools: { listChanged: true } } });
  let pronto = false;
  const ponta = conectarNaPonte({
    ...op,
    aoMudar: () => { if (pronto) server.sendToolListChanged().catch(() => {}); },
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listarFerramentas(ponta.catalogo()) }));
  server.setRequestHandler(CallToolRequestSchema, async req => chamarFerramenta(ponta, req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>));
  server.oninitialized = () => { pronto = true; };
  return { server, ponta, fechar: () => { ponta.fechar(); return server.close(); } };
}

async function principal() {
  const porta = process.env.MESA_PORTA ?? '5100';
  const arquivoDoToken = path.join(raiz, '.ponte', 'token');
  const { server } = criarServidorMcp({
    url: `ws://127.0.0.1:${porta}/__ponte`,
    lerToken: () => fs.readFileSync(arquivoDoToken, 'utf8').trim(),
    arquivoDoCache: CAMINHO_CACHE_PADRAO,
  });
  await server.connect(new StdioServerTransport());
  console.error(`[mesa-mcp] pronto; ponte em ws://127.0.0.1:${porta}/__ponte`);
}

if (import.meta.main) principal().catch(e => { console.error('[mesa-mcp] erro:', e); process.exit(1); });
