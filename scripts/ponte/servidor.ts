/**
 * Servidor da ponte do assistente (só desenvolvimento): liga as abas abertas (Atlas, Mesa…) ao servidor MCP.
 * Vive dentro do mesa-dev, em /__ponte, via `upgrade`; nada disto existe no build.
 */
import type http from 'node:http';
import type { Duplex } from 'node:stream';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import { lerMensagem, type Ferramenta, type FerramentaDoApp, type Resultado, type AppConectado, appDoPrefixo } from './protocolo.ts';

export const CAMINHO_DA_PONTE = '/__ponte';
export const TEMPO_DA_CHAMADA_MS = 60_000;
export const TEMPO_DE_ABERTURA_MS = 20_000;
/** Apps que `mesa_abrir_apps` sabe abrir (ids da ponte). */
const APPS_ABRIVEIS = ['atlas', 'ficha', 'atelie', 'jukebox'];

/** Traduz o User-Agent em um rótulo legível ("Firefox", "Chrome", "app da Mesa", "app da Mesa (WebKit)" ou "outro navegador"). */
export function rotuloDoLugar(userAgent?: string | null): string {
  if (!userAgent) return 'outro navegador';
  if (/MesaVTT/.test(userAgent)) return 'app da Mesa';
  if (/WebKitGTK/i.test(userAgent)) return 'app da Mesa (WebKit)';
  if (/Firefox/i.test(userAgent)) return 'Firefox';
  if (/Chrome|Chromium/i.test(userAgent)) return 'Chrome';
  return 'outro navegador';
}

export interface OpcoesDaPonte {
  /** Única origem aceita para abas, ex.: `http://127.0.0.1:5100`. */
  origem: string;
  /** Pasta onde `token` é gravado (ex.: `Atlas/.ponte`). */
  pastaDoToken: string;
  /** Só para testes. */
  tempoDaChamadaMs?: number;
  /** Quanto esperar um app fechado se registrar depois de pedir à Mesa para abri-lo (padrão 20 s). Só para testes. */
  tempoDeAberturaMs?: number;
}
export interface Ponte {
  /** Entrega o `upgrade` à ponte se o caminho for `/__ponte` (devolve `true`); senão não toca no socket. */
  aceitar(req: http.IncomingMessage, socket: Duplex, cabeca: Buffer): boolean;
  /** Número de abas conectadas. */
  abas(): number;
  fechar(): void;
}

interface Aba {
  ws: WebSocket;
  app: string;
  titulo: string;
  ferramentas: Ferramenta[];
  armazenamento?: string;
  onde: string;
  foco: number;
}
interface Pendente { mcp: WebSocket | null; aba: Aba; id: string; timer: NodeJS.Timeout; interno?: (r: Resultado | { ok: false; erro: string }) => void }

export function criarPonte(opcoes: OpcoesDaPonte): Ponte {
  const token = randomBytes(32).toString('hex');
  fs.mkdirSync(opcoes.pastaDoToken, { recursive: true });
  fs.writeFileSync(path.join(opcoes.pastaDoToken, 'token'), token, { mode: 0o600 });

  const wss = new WebSocketServer({ noServer: true, maxPayload: 100 * 1024 * 1024 });
  const abas = new Set<Aba>();
  const mcps = new Set<WebSocket>();
  const pendentes = new Map<string, Pendente>();
  let relogio = 0, proximo = 0;
  const limite = opcoes.tempoDaChamadaMs ?? TEMPO_DA_CHAMADA_MS;
  const limiteAbertura = opcoes.tempoDeAberturaMs ?? TEMPO_DE_ABERTURA_MS;
  const aberturas = new Map<string, Promise<string | null>>();
  const aoRegistrar = new Set<() => void>();

  const enviar = (ws: WebSocket, m: unknown) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); };

  /** A aba que vale para um app: a que teve foco por último. */
  const abaDoApp = (app: string): Aba | undefined =>
    [...abas].filter(a => a.app === app).sort((x, y) => y.foco - x.foco)[0];

  function appsInfo(): Record<string, AppConectado> {
    const apps = [...new Set([...abas].map(a => a.app))];
    const res: Record<string, AppConectado> = {};
    for (const app of apps) {
      const a = abaDoApp(app);
      if (a) res[app] = { ...(a.armazenamento ? { armazenamento: a.armazenamento } : {}), onde: a.onde };
    }
    return res;
  }

  function lista(): FerramentaDoApp[] {
    const apps = [...new Set([...abas].map(a => a.app))];
    return apps.flatMap(app => {
      const a = abaDoApp(app)!;
      return a.ferramentas.map(f => ({
        ...f,
        app,
        ...(a.armazenamento ? { armazenamento: a.armazenamento } : {}),
        onde: a.onde,
      }));
    });
  }

  const avisarMcps = () => {
    const l = lista();
    const info = appsInfo();
    for (const m of mcps) enviar(m, { tipo: 'ferramentas', lista: l, apps: info });
  };

  function responder(id: string, r: Resultado | { ok: false; erro: string }) {
    const p = pendentes.get(id);
    if (!p) return;
    clearTimeout(p.timer); pendentes.delete(id);
    if (p.interno) p.interno(r as Resultado);
    else if (p.mcp) enviar(p.mcp, { ...r, tipo: 'resultado', id: p.id });
  }

  /** Pede à aba da Mesa para abrir o app e espera ele se registrar. `null` = abriu; senão, o motivo da falha. Uma abertura por app. */
  function abrirApp(app: string): Promise<string | null> {
    const em = aberturas.get(app);
    if (em) return em;
    const p = (async (): Promise<string | null> => {
      if (!APPS_ABRIVEIS.includes(app)) return 'esse app não pode ser aberto pela Mesa';
      const mesa = abaDoApp('mesa');
      if (!mesa) return 'não há aba da Mesa aberta para abri-lo';
      const chave = `${relogio++}`;
      const aviso = new Promise<string | null>(resolver => {
        const timer = setTimeout(() => { pendentes.delete(chave); resolver('a Mesa não respondeu ao pedido de abertura'); }, limite);
        pendentes.set(chave, { mcp: null, aba: mesa, id: chave, timer, interno: r => {
          if (!r.ok) return resolver(`a Mesa não conseguiu abrir (${r.erro})`);
          const t = r.conteudo.find(c => c.tipo === 'texto');
          let aviso = '';
          try { aviso = (JSON.parse(t?.tipo === 'texto' ? t.texto : '{}') as { aviso?: string }).aviso ?? ''; } catch { /* sem aviso */ }
          resolver(aviso ? `__aviso__${aviso}` : null);
        } });
      });
      enviar(mesa.ws, { tipo: 'chamar', id: chave, ferramenta: 'mesa_abrir_apps', args: { apps: [app] } });
      const resposta = await aviso;
      if (resposta !== null && !resposta.startsWith('__aviso__')) return resposta;
      if (abaDoApp(app)) return null;
      const dica = resposta ? ` ${resposta.slice(9)}` : '';
      return await new Promise<string | null>(resolver => {
        const feito = (r: string | null) => { clearTimeout(timer); aoRegistrar.delete(ver); resolver(r); };
        const ver = () => { if (abaDoApp(app)) feito(null); };
        const timer = setTimeout(() => feito(`o app não se registrou em ${Math.round(limiteAbertura / 1000)} s.${dica}`), limiteAbertura);
        aoRegistrar.add(ver);
      });
    })().finally(() => aberturas.delete(app));
    aberturas.set(app, p);
    return p;
  }

  async function chamar(mcp: WebSocket, id: string, ferramenta: string, args: Record<string, unknown>) {
    const falha = (erro: string, fechado = false) => enviar(mcp, { tipo: 'resultado', id, ok: false, erro, ...(fechado ? { fechado: true } : {}) });
    const achar = () => { const alvo = lista().find(f => f.nome === ferramenta); return alvo && abaDoApp(alvo.app); };
    let aba = achar();
    if (!aba) {
      const app = appDoPrefixo(ferramenta);
      if (!app || abaDoApp(app)) return falha(`Ferramenta desconhecida: ${ferramenta}. Abra o app correspondente no navegador.`);
      const motivo = await abrirApp(app);
      if (motivo) return falha(motivo, true);
      aba = achar();
      if (!aba) return falha(`Ferramenta desconhecida: ${ferramenta}. Abra o app correspondente no navegador.`);
    }
    if (mcp.readyState !== mcp.OPEN) return;
    const chave = `${relogio++}`; // id interno único, para não colidir entre clientes MCP
    const timer = setTimeout(() => responder(chave, { ok: false, erro: 'a aba não respondeu' }), limite);
    pendentes.set(chave, { mcp, aba, id, timer });
    enviar(aba.ws, { tipo: 'chamar', id: chave, ferramenta, args });
  }

  function ligarAba(ws: WebSocket, userAgent?: string) {
    const onde = rotuloDoLugar(userAgent);
    const aba: Aba = { ws, app: '', titulo: '', ferramentas: [], onde, foco: ++relogio };
    ws.on('message', dados => {
      const m = lerMensagem(String(dados));
      if (!m) return;
      if (m.tipo === 'registrar') {
        aba.app = m.app;
        aba.titulo = m.titulo;
        aba.ferramentas = m.ferramentas;
        aba.armazenamento = m.armazenamento;
        aba.foco = ++relogio;
        abas.add(aba);
        avisarMcps();
        for (const f of [...aoRegistrar]) f();
      } else if (m.tipo === 'foco' && abas.has(aba)) {
        aba.foco = ++relogio;
        avisarMcps();
      } else if (m.tipo === 'resultado') {
        const p = pendentes.get(m.id);
        if (p && p.aba === aba) responder(m.id, m);
      }
    });
    ws.on('close', () => {
      const tinha = abas.delete(aba);
      for (const [chave, p] of [...pendentes]) if (p.aba === aba) responder(chave, { ok: false, erro: 'a aba fechou antes de responder' });
      if (tinha) avisarMcps();
    });
  }

  function conferirToken(recebido: unknown, esperado: string): boolean {
    if (typeof recebido !== 'string') return false;
    const a = Buffer.from(recebido);
    const b = Buffer.from(esperado);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  function ligarMcp(ws: WebSocket) {
    let autenticado = false;
    ws.on('message', dados => {
      const m = lerMensagem(String(dados));
      if (!autenticado) {
        if (m?.tipo === 'ola' && conferirToken(m.token, token)) {
          autenticado = true;
          mcps.add(ws);
          enviar(ws, { tipo: 'ferramentas', lista: lista(), apps: appsInfo() });
        } else {
          ws.close(4401, 'token inválido');
        }
        return;
      }
      if (m?.tipo === 'chamar') chamar(ws, m.id, m.ferramenta, m.args);
    });
    ws.on('close', () => {
      mcps.delete(ws);
      for (const [chave, p] of [...pendentes]) if (p.mcp === ws) { clearTimeout(p.timer); pendentes.delete(chave); }
    });
  }

  return {
    aceitar(req, socket, cabeca) {
      if ((req.url ?? '').split('?')[0] !== CAMINHO_DA_PONTE) return false;
      const origem = req.headers.origin;
      const userAgent = req.headers['user-agent'];
      // Navegadores sempre mandam Origin: só a nossa passa. Sem Origin é o cliente MCP (Node), que prova quem é com o token.
      if (origem !== undefined && origem !== opcoes.origem) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy();
        return true;
      }
      wss.handleUpgrade(req, socket, cabeca, ws => (origem === undefined ? ligarMcp : (s: WebSocket) => ligarAba(s, userAgent))(ws));
      return true;
    },
    abas: () => abas.size,
    fechar() {
      for (const p of pendentes.values()) clearTimeout(p.timer);
      pendentes.clear();
      for (const c of wss.clients) c.terminate();
      wss.close();
    },
  };
}
