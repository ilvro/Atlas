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
import { lerMensagem, appDoPrefixo } from './protocolo.ts';
import type { AppConectado, Conteudo, FerramentaDoApp, Resultado, AnotacoesDaFerramenta } from './protocolo.ts';
import { lerPreset, adicionarAoPreset } from './presets.ts';

export const ATRASOS_MS = [1000, 2000, 5000, 10000];
export const PRAZO_DA_CHAMADA_MS = 50_000;
export const PRAZOS_ESPECIAIS_MS: Record<string, number> = { atlas_momento_testar: 120_000 };

export function erroDePrazo(ferramenta: string, prazoMs: number): string {
  const s = Math.round(prazoMs / 1000);
  if (ehLeitura(ferramenta)) {
    return `"${ferramenta}" não respondeu em ${s} s; tente de novo.`;
  }
  return `"${ferramenta}" não respondeu em ${s} s. A operação pode ter sido feita mesmo assim: confira com a ferramenta de leitura (ex.: atlas_mapa_ler, campanha_ler) antes de repetir.`;
}

/** Raiz do Atlas, a partir deste arquivo (o app do Claude lança o processo de qualquer pasta). */
const raiz = path.resolve(import.meta.dirname, '..', '..');
export const CAMINHO_CACHE_PADRAO = path.join(raiz, '.ponte', 'ferramentas.json');
export const CAMINHO_CATALOGO_BASE_PADRAO = path.join(raiz, 'scripts', 'ponte', 'catalogo-base.json');

export interface PontaOpcoes {
  url: string;
  /** Lê o token atual (muda a cada partida do mesa-dev); pode lançar se o arquivo não existe. */
  lerToken: () => string;
  arquivoDoCache?: string;
  arquivoDoCatalogoBase?: string;
  aoMudar?: () => void;
  atrasosMs?: number[];
  prazoMs?: number;
}

export interface Ponta {
  conectada: () => boolean;
  motivo: () => 'sem-servidor' | 'token-invalido' | null;
  /** Ferramentas ativas nas abas abertas agora. */
  ativas: () => FerramentaDoApp[];
  /** Informações dos apps conectados agora ({ armazenamento, onde }). */
  apps: () => Record<string, AppConectado>;
  /** Aviso de armazenamentos diferentes entre os apps abertos, ou `null`. */
  avisoArmazenamento: () => string | null;
  /** Catálogo persistente completo (cache mais o que está registrado agora). */
  catalogo: () => FerramentaDoApp[];
  origemHttp: () => string;
  chamar: (ferramenta: string, args: Record<string, unknown>, prazoMs?: number) => Promise<Resultado>;
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
    return { nome: f.nome, descricao: f.descricao, esquema: f.esquema, app: f.app, anotacoes: f.anotacoes };
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
    ficha: { rotulo: 'Dossiê', caminho: 'Dossie', artigo: 'O', temAbrirApps: true },
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
    nome === 'plataforma_guia' ||
    nome === 'mesa_campanha_atual' ||
    nome === 'atlas_catalogo' ||
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

export function anotacoesDaFerramenta(nome: string, declaradas?: AnotacoesDaFerramenta): { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean } {
  if (declaradas) {
    const res: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean } = {};
    if (typeof declaradas.leitura === 'boolean') res.readOnlyHint = declaradas.leitura;
    if (typeof declaradas.destrutiva === 'boolean') res.destructiveHint = declaradas.destrutiva;
    if (typeof declaradas.idempotente === 'boolean') res.idempotentHint = declaradas.idempotente;
    return res;
  }
  if (nome === 'atlas_remover') return { destructiveHint: true };
  if (nome === 'atlas_abrir' || nome === 'mesa_abrir_apps' || nome === 'atlas_momento_testar') {
    return { readOnlyHint: false, destructiveHint: false };
  }
  if (ehLeitura(nome)) return { readOnlyHint: true };
  if (ehCriacao(nome)) return { destructiveHint: false };
  return {};
}

/** Conexão com a ponte: reconecta em silêncio, relendo o token a cada tentativa. */
export function conectarNaPonte(op: PontaOpcoes): Ponta {
  const atrasos = op.atrasosMs ?? ATRASOS_MS;
  const caminhoBase = op.arquivoDoCatalogoBase ?? CAMINHO_CATALOGO_BASE_PADRAO;
  const base = carregarCache(caminhoBase);
  const caminhoCache = op.arquivoDoCache ?? CAMINHO_CACHE_PADRAO;
  const cache = carregarCache(caminhoCache);
  const catalogo = new Map<string, FerramentaDoApp>();
  for (const [k, v] of base) catalogo.set(k, v);
  for (const [k, v] of cache) catalogo.set(k, v);
  let ultimaAssinatura = assinaturaDoCatalogo(catalogo);

  let ws: WebSocket | null = null;
  let aberta = false;
  let motivo: 'sem-servidor' | 'token-invalido' | null = 'sem-servidor';
  let estadoLog: 'conectado' | 'token-recusado' | 'desconectado' | null = null;
  let ativas: FerramentaDoApp[] = [];
  let appsConectados: Record<string, AppConectado> = {};
  let tentativa = 0;
  let parado = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  interface PendenteMcp {
    resolver: (r: Resultado) => void;
    timer: NodeJS.Timeout;
  }
  const pendentes = new Map<string, PendenteMcp>();

  const falharPendentes = (erro: string) => {
    for (const [id, p] of pendentes) {
      clearTimeout(p.timer);
      p.resolver({ tipo: 'resultado', id, ok: false, erro });
    }
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
    try {
      token = op.lerToken();
    } catch {
      motivo = 'sem-servidor';
      reagendar();
      return;
    }
    const socket = new WebSocket(op.url, { maxPayload: 100 * 1024 * 1024 });
    ws = socket;
    socket.on('open', () => { socket.send(JSON.stringify({ tipo: 'ola', token })); });
    socket.on('message', dados => {
      const m = lerMensagem(String(dados));
      if (!m) return;
      if (m.tipo === 'ferramentas') {
        aberta = true;
        motivo = null;
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
          if (nome === 'jukebox_preset_ler' || nome === 'jukebox_preset_adicionar') continue;
          if (appsAtivos.has(f.app) && !m.lista.some(nova => nova.nome === nome)) {
            catalogo.delete(nome);
          }
        }

        // Incorpora / atualiza as ferramentas registradas no catálogo com dono estável.
        const porNome = new Map<string, FerramentaDoApp[]>();
        for (const f of m.lista) {
          const lista = porNome.get(f.nome);
          if (lista) lista.push(f);
          else porNome.set(f.nome, [f]);
        }

        for (const [nome, grupo] of porNome) {
          if (grupo.length === 1) {
            catalogo.set(nome, grupo[0]!);
          } else {
            const donoPrefixo = appDoPrefixo(nome);
            const porPrefixo = donoPrefixo ? grupo.find(f => f.app === donoPrefixo) : undefined;
            if (porPrefixo) {
              catalogo.set(nome, porPrefixo);
            } else {
              const atual = catalogo.get(nome);
              const noGrupo = atual ? grupo.find(f => f.app === atual.app) : undefined;
              catalogo.set(nome, noGrupo ?? grupo[0]!);
            }
          }
        }

        if (estadoLog !== 'conectado') {
          estadoLog = 'conectado';
          console.error(`[mesa-mcp] conectado à ponte (${appsAtivos.size} ${appsAtivos.size === 1 ? 'app' : 'apps'})`);
        }

        const novaAssinatura = assinaturaDoCatalogo(catalogo);
        if (novaAssinatura !== ultimaAssinatura) {
          ultimaAssinatura = novaAssinatura;
          salvarCache(caminhoCache, catalogo);
          op.aoMudar?.();
        }
      } else if (m.tipo === 'resultado') {
        const p = pendentes.get(m.id);
        if (p) {
          clearTimeout(p.timer);
          pendentes.delete(m.id);
          p.resolver(m);
        }
      }
    });
    socket.on('error', () => {
      motivo = 'sem-servidor';
    });
    socket.on('close', (code: number) => {
      if (ws !== socket) return;
      ws = null;
      aberta = false;
      ativas = [];
      appsConectados = {};
      if (code === 4401) {
        motivo = 'token-invalido';
        if (estadoLog !== 'token-recusado') {
          estadoLog = 'token-recusado';
          console.error('[mesa-mcp] token recusado pela ponte');
        }
      } else {
        motivo = 'sem-servidor';
        if (estadoLog !== 'desconectado') {
          estadoLog = 'desconectado';
          console.error('[mesa-mcp] desconectado da ponte');
        }
      }
      falharPendentes('A ponte caiu durante a chamada. Confira se o `npm run mesa-dev` ainda está rodando e tente de novo.');
      reagendar();
    });
  }
  abrir();

  const origemHttp = () => extrairOrigemHttp(op.url);

  return {
    conectada: () => aberta,
    motivo: () => motivo,
    ativas: () => ativas,
    apps: () => appsConectados,
    avisoArmazenamento: () => gerarAvisoArmazenamento(appsConectados),
    catalogo: () => [...catalogo.values()],
    origemHttp,
    chamar: (ferramenta, args, prazoMs) => new Promise<Resultado>(resolver => {
      if (!ws || !aberta) {
        const erro = motivo === 'token-invalido' ? TOKEN_INVALIDO : SEM_PONTE;
        resolver({ tipo: 'resultado', id: '', ok: false, erro });
        return;
      }
      const id = `m${++seq}`;
      const prazo = prazoMs ?? op.prazoMs ?? PRAZOS_ESPECIAIS_MS[ferramenta] ?? PRAZO_DA_CHAMADA_MS;
      const timer = setTimeout(() => {
        if (pendentes.has(id)) {
          pendentes.delete(id);
          resolver({
            tipo: 'resultado',
            id,
            ok: false,
            erro: erroDePrazo(ferramenta, prazo),
          });
        }
      }, prazo);

      pendentes.set(id, {
        resolver,
        timer,
      });
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

export const SEM_PONTE = 'A ponte não está conectada. Abra a Mesa pelo atalho do app de desktop, ou rode `npm run mesa-dev` no Atlas e abra http://127.0.0.1:5100/.';
export const TOKEN_INVALIDO = 'A ponte respondeu, mas recusou o token: outro `mesa-dev` ou outro atalho do desktop está rodando, ou o token mudou. Feche as cópias extras e reinicie o app do Claude se persistir.';

export const FERRAMENTA_ESTADO = {
  name: 'ponte_estado',
  description: 'Diz se a ponte com a plataforma está conectada e quais apps (abas abertas) e ferramentas estão disponíveis.',
  inputSchema: { type: 'object' as const, properties: {} },
  annotations: { readOnlyHint: true },
};

export const ESQUEMA_PRESET_LER = {
  type: 'object' as const,
  properties: {
    pasta: { type: 'string', description: 'Caminho da pasta do preset no disco.' },
  },
  required: ['pasta'],
  additionalProperties: false,
};

export const ESQUEMA_PRESET_ADICIONAR = {
  type: 'object' as const,
  properties: {
    pasta: { type: 'string', description: 'Caminho da pasta do preset no disco.' },
    arquivo: { type: 'string', description: 'Caminho do arquivo MP3 no disco.' },
    titulo: { type: 'string', description: 'Título legível da música (1 a 120 caracteres).' },
    generos: {
      type: 'array',
      items: { type: 'string', enum: ['fun', 'hopeful', 'mystery', 'suspense', 'horror', 'sfx'] },
      description: 'Gêneros: fun, hopeful, mystery, suspense, horror, sfx.',
    },
    tags: {
      type: 'array',
      items: { type: 'string', enum: ['ambient', 'investigation', 'event', 'battle', 'emotional'] },
      description: 'Tags: ambient, investigation, event, battle, emotional.',
    },
    grupo: { type: 'string', description: 'Nome da pasta/grupo dentro do preset (opcional).' },
    capa: { type: 'string', description: 'Caminho de imagem JPEG para a capa (opcional; usa padrão se omitida).' },
    criar: { type: 'boolean', description: 'Cria a pasta e o preset se não existirem (apenas em pasta vazia).' },
    substituir: { type: 'boolean', description: 'Sobrescreve se a música já existir no preset.' },
  },
  required: ['pasta', 'arquivo', 'titulo'],
  additionalProperties: false,
};

export const FERRAMENTA_PRESET_LER = {
  name: 'jukebox_preset_ler',
  description: 'Lê músicas e metadados de uma pasta de preset da Jukebox no disco.',
  inputSchema: ESQUEMA_PRESET_LER,
  annotations: { readOnlyHint: true },
};

export const FERRAMENTA_PRESET_ADICIONAR = {
  name: 'jukebox_preset_adicionar',
  description: 'Adiciona música MP3 a uma pasta de preset da Jukebox no disco.',
  inputSchema: ESQUEMA_PRESET_ADICIONAR,
  annotations: { destructiveHint: false },
};

export function textoDoEstado(
  conectada: boolean,
  ferramentas: FerramentaDoApp[],
  appsInfo?: Record<string, AppConectado>,
  motivo?: 'sem-servidor' | 'token-invalido' | null,
): string {
  if (!conectada) return motivo === 'token-invalido' ? TOKEN_INVALIDO : SEM_PONTE;
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

export const CAMINHO_GUIA_PADRAO = path.join(raiz, 'docs', 'assistente', 'guia');

export interface SecaoDoGuia { nome: string; resumo: string; texto: string }

/** Lê os `*.md` da pasta do guia (ordem alfabética). O resumo é a linha `> resumo: …` do começo do arquivo. */
export function lerGuia(pasta: string): SecaoDoGuia[] {
  let arquivos: string[];
  try {
    arquivos = fs.readdirSync(pasta).filter(a => a.endsWith('.md')).sort();
  } catch {
    return [];
  }
  return arquivos.map(a => {
    const texto = fs.readFileSync(path.join(pasta, a), 'utf8');
    const primeira = texto.split('\n', 1)[0] ?? '';
    const m = /^>\s*resumo:\s*(.*)$/i.exec(primeira);
    return { nome: a.slice(0, -3), resumo: m ? m[1]!.trim() : primeira.replace(/^[#>\s]+/, '').trim(), texto };
  });
}

export function ferramentaGuia(secoes: SecaoDoGuia[]) {
  return {
    name: 'plataforma_guia',
    description: 'Guia de como usar a plataforma. Sem `secao`, lista as seções; com `secao`, devolve o texto. Consulte antes de compor um mapa, criar um momento, planejar uma sessão ou criar documentos e fichas.',
    inputSchema: {
      type: 'object' as const,
      properties: { secao: { type: 'string', enum: secoes.map(s => s.nome), description: 'Nome da seção; omita para ver o índice.' } },
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  };
}

export function textoDoGuia(secoes: SecaoDoGuia[], secao?: unknown) {
  const lista = secoes.map(s => s.nome).join(', ');
  if (secao === undefined || secao === null || secao === '') {
    if (secoes.length === 0) return { content: [{ type: 'text' as const, text: 'O guia está vazio.' }] };
    return { content: [{ type: 'text' as const, text: `Seções do guia (chame plataforma_guia com a seção):\n${secoes.map(s => `- ${s.nome}: ${s.resumo}`).join('\n')}` }] };
  }
  const achada = typeof secao === 'string' ? secoes.find(s => s.nome === secao) : undefined;
  if (!achada) return { isError: true, content: [{ type: 'text' as const, text: `Seção "${String(secao)}" não existe. Seções: ${lista || '(nenhuma)'}.` }] };
  return { content: [{ type: 'text' as const, text: achada.texto }] };
}

/** Ferramentas para o `tools/list`: `ponte_estado` e `plataforma_guia` sempre, depois as do catálogo. */
export function listarFerramentas(catalogo: FerramentaDoApp[], guia: SecaoDoGuia[] = []) {
  return [
    FERRAMENTA_ESTADO,
    ferramentaGuia(guia),
    ...catalogo.map(f => {
      const anotacoes = anotacoesDaFerramenta(f.nome, f.anotacoes);
      return {
        name: f.nome,
        description: f.descricao,
        inputSchema: (f.esquema ?? { type: 'object', properties: {} }) as { type: 'object'; [k: string]: unknown },
        ...(Object.keys(anotacoes).length > 0 ? { annotations: anotacoes } : {}),
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

/** `tools/call`: roteia para `ponte_estado`, ferramentas locais de preset ou para a ponte e converte o resultado. */
export async function chamarFerramenta(ponta: Ponta, nome: string, args: Record<string, unknown>, prazoMs?: number, guia: SecaoDoGuia[] = []) {
  if (nome === 'plataforma_guia') return textoDoGuia(guia, args.secao);
  const ativas = ponta.ativas();
  const apps = ponta.apps();
  if (nome === FERRAMENTA_ESTADO.name) return { content: [{ type: 'text' as const, text: textoDoEstado(ponta.conectada(), ativas, apps, ponta.motivo()) }] };

  if (nome === 'jukebox_preset_ler') {
    try {
      const pasta = String(args?.pasta ?? '');
      if (!pasta) throw new Error('Parâmetro "pasta" é obrigatório');
      const resultado = lerPreset(pasta);
      return { content: [{ type: 'text' as const, text: JSON.stringify(resultado, null, 2) }] };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: (err as Error).message }] };
    }
  }

  if (nome === 'jukebox_preset_adicionar') {
    try {
      const pasta = String(args?.pasta ?? '');
      const arquivo = String(args?.arquivo ?? '');
      const titulo = String(args?.titulo ?? '');
      if (!pasta) throw new Error('Parâmetro "pasta" é obrigatório');
      if (!arquivo) throw new Error('Parâmetro "arquivo" é obrigatório');
      if (!titulo) throw new Error('Parâmetro "titulo" é obrigatório');

      const r = adicionarAoPreset({
        pasta,
        arquivo,
        titulo,
        generos: Array.isArray(args?.generos) ? (args.generos as string[]).map(String) : undefined,
        tags: Array.isArray(args?.tags) ? (args.tags as string[]).map(String) : undefined,
        grupo: typeof args?.grupo === 'string' ? args.grupo : undefined,
        capa: typeof args?.capa === 'string' ? args.capa : undefined,
        criar: Boolean(args?.criar),
        substituir: Boolean(args?.substituir),
      });

      let avisoJukebox: string | null = null;
      const TAMANHO_MAXIMO_RECEBER_BYTES = 50 * 1024 * 1024;
      const jukeboxConectada = ponta.conectada() && (
        ponta.apps().jukebox !== undefined ||
        ponta.ativas().some(f => f.nome.startsWith('jukebox_'))
      );

      if (jukeboxConectada) {
        try {
          const caminhoAudio = path.join(r.pasta, r.arquivos[0]!);
          const caminhoCapa = path.join(r.pasta, r.arquivos[1]!);
          const tamanhoAudio = fs.statSync(caminhoAudio).size;

          if (tamanhoAudio <= TAMANHO_MAXIMO_RECEBER_BYTES) {
            const audioBase64 = fs.readFileSync(caminhoAudio).toString('base64');
            const capaBase64 = fs.readFileSync(caminhoCapa).toString('base64');
            const resp = await ponta.chamar('jukebox_preset_receber', {
              pasta: path.basename(r.pasta),
              item: r.item,
              audio: audioBase64,
              capa: capaBase64,
            });

            if (resp.ok && Array.isArray(resp.conteudo)) {
              const textoResp = resp.conteudo.map(c => c.tipo === 'texto' ? c.texto : '').join('');
              try {
                const dados = JSON.parse(textoResp);
                if (!dados.recebido) {
                  avisoJukebox = dados.motivo ?? 'reabra o preset na Jukebox para ver a música';
                }
              } catch {
                avisoJukebox = 'reabra o preset na Jukebox para ver a música';
              }
            } else if (!resp.ok) {
              avisoJukebox = resp.erro ?? 'reabra o preset na Jukebox para ver a música';
            }
          } else {
            avisoJukebox = 'áudio maior que 50 MB: reabra o preset na Jukebox para ver a música';
          }
        } catch (err) {
          avisoJukebox = `não foi possível enviar à Jukebox aberta: ${(err as Error).message}. Reabra o preset na Jukebox para ver a música.`;
        }
      } else {
        avisoJukebox = 'reabra o preset na Jukebox para ver a música';
      }

      const baseMsg = `Música “${r.titulo}” ${r.substituido ? 'substituída' : 'adicionada'} com sucesso no preset “${r.pasta}”. Arquivos gravados: ${r.arquivos.join(', ')}.`;
      const msg = avisoJukebox ? `${baseMsg}\n\nAviso: ${avisoJukebox}` : baseMsg;
      const resultadoJson = {
        adicionada: true,
        ...r,
        ...(avisoJukebox ? { aviso: avisoJukebox } : {}),
      };
      return {
        content: [
          { type: 'text' as const, text: `${msg}\n\n${JSON.stringify(resultadoJson, null, 2)}` },
        ],
      };
    } catch (err) {
      return { isError: true, content: [{ type: 'text' as const, text: (err as Error).message }] };
    }
  }

  if (!ponta.conectada()) {
    const erro = ponta.motivo() === 'token-invalido' ? TOKEN_INVALIDO : SEM_PONTE;
    return { isError: true, content: [{ type: 'text' as const, text: erro }] };
  }
  const catalogo = ponta.catalogo();
  const ferramenta = catalogo.find(f => f.nome === nome);
  if (!ferramenta)
    return { isError: true, content: [{ type: 'text' as const, text: `A ferramenta "${nome}" não está disponível. Rode \`ponte_estado\` para ver o que está conectado.` }] };
  // App fechado: repassa mesmo assim; o servidor da ponte tenta abri-lo pela Mesa e, se não der, devolve o motivo.
  const r = await ponta.chamar(nome, args, prazoMs);
  if (!r.ok && r.fechado) {
    const origem = ponta.origemHttp();
    return { isError: true, content: [{ type: 'text' as const, text: `${erroAppFechado(ferramenta.app, origem)} (${r.erro})` }] };
  }
  const aviso = ponta.avisoArmazenamento();
  if (!r.ok) return acrescentarAviso({ isError: true, content: [{ type: 'text' as const, text: r.erro }] }, aviso);
  return acrescentarAviso({ content: r.conteudo.map(converterConteudo) }, aviso);
}

export interface McpOpcoes {
  url: string;
  lerToken: () => string;
  arquivoDoCache?: string;
  arquivoDoCatalogoBase?: string;
  atrasosMs?: number[];
  prazoMs?: number;
  intervaloDeProgressoMs?: number;
  instrucoes?: string;
  /** Pasta dos `*.md` do guia; lida uma vez na partida. */
  pastaDoGuia?: string;
}

/** Monta o servidor MCP `mesa` (sem transporte) sobre uma conexão com a ponte. */
export function criarServidorMcp(op: McpOpcoes) {
  const server = new Server(
    { name: 'mesa', version: '0.2.0' },
    {
      capabilities: { tools: { listChanged: true } },
      ...(op.instrucoes !== undefined ? { instructions: op.instrucoes } : {}),
    },
  );
  const guia = lerGuia(op.pastaDoGuia ?? CAMINHO_GUIA_PADRAO);
  let pronto = false;
  const ponta = conectarNaPonte({
    ...op,
    aoMudar: () => { if (pronto) server.sendToolListChanged().catch(() => {}); },
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: listarFerramentas(ponta.catalogo(), guia) }));
  server.setRequestHandler(CallToolRequestSchema, async (req, extra) => {
    const progressToken = req.params._meta?.progressToken;
    let timerProgresso: NodeJS.Timeout | null = null;
    let progressoN = 0;
    if (progressToken !== undefined && extra?.sendNotification) {
      const intervalo = op.intervaloDeProgressoMs ?? 5000;
      timerProgresso = setInterval(() => {
        progressoN++;
        extra.sendNotification({
          method: 'notifications/progress',
          params: { progressToken, progress: progressoN, message: 'esperando a aba…' },
        }).catch(() => {});
      }, intervalo);
    }
    try {
      return await chamarFerramenta(ponta, req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>, op.prazoMs, guia);
    } finally {
      if (timerProgresso) clearInterval(timerProgresso);
    }
  });
  server.oninitialized = () => { pronto = true; };
  return { server, ponta, fechar: () => { ponta.fechar(); return server.close(); } };
}

async function principal() {
  const porta = process.env.MESA_PORTA ?? '5100';
  const arquivoDoToken = path.join(raiz, '.ponte', 'token');
  const caminhoInstrucoes = path.join(raiz, 'docs', 'assistente', 'nucleo.md');
  let instrucoes: string | undefined;
  try {
    if (fs.existsSync(caminhoInstrucoes)) {
      instrucoes = fs.readFileSync(caminhoInstrucoes, 'utf8');
    } else {
      console.error(`[mesa-mcp] aviso: arquivo de instruções não encontrado em ${caminhoInstrucoes}`);
    }
  } catch (e) {
    console.error('[mesa-mcp] aviso: erro ao ler instruções:', e);
  }

  const { server } = criarServidorMcp({
    url: `ws://127.0.0.1:${porta}/__ponte`,
    lerToken: () => fs.readFileSync(arquivoDoToken, 'utf8').trim(),
    arquivoDoCache: CAMINHO_CACHE_PADRAO,
    arquivoDoCatalogoBase: CAMINHO_CATALOGO_BASE_PADRAO,
    instrucoes,
  });
  await server.connect(new StdioServerTransport());
  console.error(`[mesa-mcp] pronto; ponte em ws://127.0.0.1:${porta}/__ponte`);
}

if (import.meta.main) principal().catch(e => { console.error('[mesa-mcp] erro:', e); process.exit(1); });
