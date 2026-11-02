import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import type { MapaAtlas, Ponto } from '../../src/domain/mapa.ts';

export interface Ambiente { servidor: ViteDevServer; navegador: Browser; url: string }

/** Um servidor de desenvolvimento do Atlas em porta livre e um Chromium com GPU (o Pixi precisa de WebGL). */
export async function iniciarAmbiente(): Promise<Ambiente> {
  const servidor = await createServer({ configFile: new URL('../../vite.config.ts', import.meta.url).pathname, logLevel: 'error', server: { port: 0, strictPort: false, host: '127.0.0.1' } });
  await servidor.listen();
  const url = servidor.resolvedUrls!.local[0]!;
  const navegador = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
  return { servidor, navegador, url };
}

export async function encerrar(a: Ambiente): Promise<void> { await a.navegador.close(); await a.servidor.close(); }

/** Cada teste ganha um contexto novo: IndexedDB e localStorage vazios. */
export async function novoContexto(a: Ambiente, opcoes: Parameters<Browser['newContext']>[0] = {}): Promise<BrowserContext> {
  return a.navegador.newContext({ viewport: { width: 1440, height: 860 }, acceptDownloads: true, ...opcoes });
}

export interface Pagina { page: Page; erros: string[] }
export async function abrir(ctx: BrowserContext, url: string): Promise<Pagina> {
  const page = await ctx.newPage(), erros: string[] = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
  await page.goto(url);
  await page.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null, null, { timeout: 20_000 });
  return { page, erros };
}

type Atlas = { sessao(): { doc: { value: MapaAtlas }; sujo: { value: boolean }; selecao: { value: { colecao: string; id: string }[] }; ferramenta: { value: string }; store: { sujo: boolean; podeDesfazer: boolean; historico: string[]; versaoEdicao: number } } | null; viewport(): { clientDe(p: Ponto): Ponto; camera: { zoom: number } } | null };

export const documento = (p: Page): Promise<MapaAtlas> => p.evaluate(() => structuredClone((window as unknown as { __atlas: Atlas }).__atlas.sessao()!.doc.value));
export const selecao = (p: Page): Promise<{ colecao: string; id: string }[]> => p.evaluate(() => structuredClone((window as unknown as { __atlas: Atlas }).__atlas.sessao()!.selecao.value));
export const clientDe = (p: Page, mundo: Ponto): Promise<Ponto> => p.evaluate(m => (window as unknown as { __atlas: Atlas }).__atlas.viewport()!.clientDe(m), mundo);

export async function esperarEditor(p: Page): Promise<void> {
  await p.waitForSelector('[data-testid="area-do-mapa"] canvas', { timeout: 20_000 });
  await p.waitForFunction(() => (window as unknown as { __atlas: Atlas }).__atlas.viewport() != null, null, { timeout: 20_000 });
}

/** Cria um mapa pela interface e espera o editor. Devolve o id. */
export async function criarMapaPelaInterface(p: Page): Promise<string> {
  await p.click('[data-testid="novo-mapa"]');
  await esperarEditor(p);
  return (await documento(p)).id;
}

export const esperarMs = (ms: number) => new Promise(r => setTimeout(r, ms));
