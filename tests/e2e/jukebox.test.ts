import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const RAIZ_DO_JUKEBOX = new URL('../../../Jukebox/', import.meta.url).pathname;
const TIPOS: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };

/** Os arquivos do Jukebox (que não tem servidor de desenvolvimento) numa porta, para o `mesa-dev` pôr sob `/Jukebox/`. */
async function servirJukebox(): Promise<{ servidor: http.Server; porta: number }> {
  const servidor = http.createServer(async (req, res) => {
    const caminho = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!)).replace(/^(\.\.[/\\])+/, ''), arquivo = join(RAIZ_DO_JUKEBOX, caminho.endsWith('/') ? `${caminho}index.html` : caminho);
    try { const corpo = await readFile(arquivo); res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); res.end(corpo); } catch { res.writeHead(404); res.end('não achei'); }
  });
  await new Promise<void>(ok => servidor.listen(0, '127.0.0.1', ok));
  return { servidor, porta: (servidor.address() as { port: number }).port };
}
/** Um WAV mudo de `s` segundos (8 kHz, 8 bits): as faixas de verdade têm 600 MB, e o teste só precisa que elas existam. */
function wavMudo(s: number): Buffer {
  const n = Math.round(8000 * s), cab = Buffer.alloc(44);
  cab.write('RIFF', 0); cab.writeUInt32LE(36 + n, 4); cab.write('WAVEfmt ', 8); cab.writeUInt32LE(16, 16); cab.writeUInt16LE(1, 20); cab.writeUInt16LE(1, 22); cab.writeUInt32LE(8000, 24); cab.writeUInt32LE(8000, 28); cab.writeUInt16LE(1, 32); cab.writeUInt16LE(8, 34); cab.write('data', 36); cab.writeUInt32LE(n, 40);
  return Buffer.concat([cab, Buffer.alloc(n, 128)]);
}
const pedir = (p: Page, tipo: string, ref: unknown) => p.evaluate(async ([tipo, ref]) => {
  const b = (window as unknown as { __atlas: { servicos(): { barramento: { pedir(t: string, d: unknown): Promise<{ ok: boolean; motivo?: string; detalhe?: string }> } } } }).__atlas.servicos().barramento;
  const r = await b.pedir(tipo!, { ref }); return { ok: r.ok, motivo: r.motivo, detalhe: r.detalhe };
}, [tipo, ref] as const);

test('Jukebox no contrato (9.4a e 9.4d), com o Jukebox de verdade sob o mesa-dev: publica cenas e efeitos na campanha, toca a cena pedida pelo clima, toca o efeito da porta, e recusa com motivo o que não tem', async () => {
  const { criarProxy, lerProjeto } = await import('../../scripts/mesa-dev.ts'), { createServer } = await import('vite');
  const { servidor, porta } = await servirJukebox();
  const vite = await createServer({ configFile: new URL('../../vite.config.ts', import.meta.url).pathname, base: '/Atlas/', logLevel: 'error', server: { port: 0, strictPort: false, host: '127.0.0.1' } });
  await vite.listen();
  const proxy = criarProxy([lerProjeto(`Atlas=${(vite.httpServer!.address() as { port: number }).port}`), lerProjeto(`Jukebox=${porta}@raiz`)]);
  await new Promise<void>(ok => proxy.listen(0, '127.0.0.1', ok));
  const origem = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`, ctx = await novoContexto(amb, { viewport: { width: 1500, height: 900 } });
  try {
    // Uma cena do próprio usuário com duas faixas do preset de exemplo (as cenas de fábrica usam outras faixas): o Jukebox a lê do localStorage ao abrir.
    await ctx.addInitScript(() => {
      if (!location.pathname.includes('/Jukebox/')) return;
      const faixa = (title: string) => ({ songId: `x-${title}`, title, originalTitle: title, sourceName: `${title}.mp3`, volume: 0.4, currentTime: 0, region: null, activeEffects: [], selectionFadeEnabled: false, selectionStopEnabled: false });
      if (!localStorage.getItem('jukebox-scenes-v1')) localStorage.setItem('jukebox-scenes-v1', JSON.stringify([{ id: 'cena-de-teste', name: 'Aurora e Batalha', createdAt: 1, masterVolume: 1, tracks: [faixa('Aurora'), faixa('Batalha')] }]));
    });
    await ctx.route('**/Jukebox/sample/*.mp3', r => r.fulfill({ body: wavMudo(3), contentType: 'audio/wav' }));
    const atlas = await abrir(ctx, `${origem}/Atlas/`), a = atlas.page;
    await a.click('[data-testid="nova-campanha"]'); await a.fill('[data-testid="nova-campanha-nome"]', 'A Ilha'); await a.press('[data-testid="nova-campanha-nome"]', 'Enter');
    await a.getByText(/Campanha “A Ilha” criada/).first().waitFor();
    await criarMapaPelaInterface(a);
    const campanhaId = await a.evaluate(() => localStorage.getItem('mesa:campanha-ativa')!);

    // O Jukebox abre com a campanha ativa e carrega o preset de exemplo (as faixas viram WAVs mudos).
    const j = await ctx.newPage(), errosDoJukebox: string[] = []; j.on('pageerror', e => errosDoJukebox.push(e.message));
    await j.goto(`${origem}/Jukebox/`);
    await j.waitForFunction(() => (window as unknown as { __jukeboxMesa?: { pronto: boolean } }).__jukeboxMesa?.pronto === true, null, { timeout: 15_000 });
    await j.mouse.click(5, 5);      // um gesto do usuário na página: o navegador deixa o áudio tocar depois
    await j.evaluate(() => document.getElementById('load-sample-btn')!.click());      // o botão fica numa aba escondida
    await j.waitForFunction(() => (window as unknown as { __jukeboxMesa: { efeitosDisponiveis(): unknown[] } }).__jukeboxMesa.efeitosDisponiveis().length >= 1, null, { timeout: 90_000 });
    await j.waitForFunction(() => document.querySelectorAll('.song-item').length >= 28, null, { timeout: 90_000 }).catch(() => undefined);
    console.log('# faixas carregadas no Jukebox:', await j.evaluate(() => document.querySelectorAll('.song-item').length), await j.evaluate(() => [...document.querySelectorAll('.song-item .title-input')].slice(0, 6).map(e => (e as HTMLInputElement).value)));
    await j.waitForTimeout(1200);

    // As cenas e o efeito aparecem como entidades da campanha, criadas pelo Jukebox.
    const entidades = () => a.evaluate(async id => { const s = (window as unknown as { __atlas: { servicos(): { campanhas: { listarEntidades(c: string): Promise<{ tipo: string; nome: string; criadaPor: string; refs: { app: string; tipo: string; id: string }[] }[]> } } } }).__atlas.servicos(); return s.campanhas.listarEntidades(id); }, campanhaId);
    await a.waitForFunction(async id => (await (window as unknown as { __atlas: { servicos(): { campanhas: { listarEntidades(c: string): Promise<{ tipo: string }[]> } } } }).__atlas.servicos().campanhas.listarEntidades(id)).some(e => e.tipo === 'efeito'), campanhaId, { timeout: 15_000 });
    const todas = await entidades(), cenas = todas.filter(e => e.tipo === 'cena'), efeitos = todas.filter(e => e.tipo === 'efeito');
    assert.ok(cenas.length >= 11, `${cenas.length} cenas`); assert.ok(cenas.every(e => e.criadaPor === 'jukebox' && e.refs[0]!.app === 'jukebox' && e.refs[0]!.tipo === 'cena-sonora'));
    assert.equal(efeitos.length, 1); assert.deepEqual([efeitos[0]!.criadaPor, efeitos[0]!.refs[0]!.tipo], ['jukebox', 'efeito']); assert.match(efeitos[0]!.refs[0]!.id, /^plankton-meme-with-sound/, 'o id é o título sem acento e sem símbolos');

    // O Atlas pede cenas ao Jukebox de verdade: as que têm faixas carregadas tocam; as outras voltam com o motivo.
    await a.evaluate(() => { const w = window as unknown as { __tocando: unknown[]; __atlas: { servicos(): { barramento: { ouvir(t: string, f: (e: { dados: unknown }) => void): void } } } }; w.__tocando = []; w.__atlas.servicos().barramento.ouvir('jukebox.tocando', e => w.__tocando.push(e.dados)); });
    const respostas: { id: string; ok: boolean; motivo?: string }[] = [];
    for (const c of cenas) { const r = await pedir(a, 'jukebox.tocar', c.refs[0]); respostas.push({ id: c.refs[0]!.id, ok: r.ok, ...(r.ok ? {} : { motivo: r.detalhe ?? r.motivo }) }); }
    console.log(`# cenas que tocaram por inteiro: ${respostas.filter(r => r.ok).length} de ${respostas.length}; as outras: ${[...new Set(respostas.filter(r => !r.ok).map(r => r.motivo))].join(' | ')}`);
    assert.ok(respostas.every(r => r.ok || (r.motivo && r.motivo.length > 5)), 'quem não toca explica por quê');
    const tocou = respostas.find(r => r.ok); assert.ok(tocou, 'pelo menos uma cena do preset toca por inteiro');
    assert.ok((await a.evaluate(() => (window as unknown as { __tocando: { cena: { id: string } | null }[] }).__tocando)).some(t => t.cena?.id === tocou!.id), 'o Jukebox avisou jukebox.tocando com a cena');
    const desconhecida = await pedir(a, 'jukebox.tocar', { app: 'jukebox', tipo: 'cena-sonora', id: 'nao-existe' }); assert.equal(desconhecida.ok, false); assert.match(desconhecida.detalhe ?? '', /não encontrada/);

    // O clima escolhido no Atlas: trocar para ele pede a cena ao Jukebox.
    const nomeDaCena = cenas.find(c => c.refs[0]!.id === tocou!.id)!.nome;
    await a.click('[data-testid="aba-mapa"]'); await a.evaluate(() => (window as unknown as { __atlas: { sessao(): { store: { executar(c: unknown): void } } } }).__atlas.sessao().store.executar({ tipo: 'clima.predefinir', id: 'noite' }));
    const campo = a.locator('[data-testid="som-do-clima"]'); await campo.waitFor(); await a.waitForFunction(() => (document.querySelector('[data-testid="som-do-clima"]') as HTMLSelectElement).options.length > 5, null, { timeout: 8000 });
    await campo.selectOption({ label: nomeDaCena });
    await j.evaluate(() => document.getElementById('stop-all-button')!.click());      // Stop All: nada toca, e o Jukebox avisa `cena: null`
    await a.waitForFunction(() => (window as unknown as { __tocando: { cena: unknown }[] }).__tocando.at(-1)?.cena === null, null, { timeout: 4000 });
    await a.evaluate(() => { (window as unknown as { __tocando: unknown[] }).__tocando.length = 0; });
    await a.evaluate(async () => { const s = (window as unknown as { __atlas: { sessao(): { store: { executar(c: unknown): void } } } }).__atlas.sessao(); s.store.executar({ tipo: 'clima.predefinir', id: 'tarde' }); await new Promise(r => setTimeout(r, 300)); s.store.executar({ tipo: 'clima.predefinir', id: 'noite' }); });
    await a.waitForFunction(id => (window as unknown as { __tocando: { cena: { id: string } | null }[] }).__tocando.some(t => t.cena?.id === id), tocou.id, { timeout: 5000 });      // trocar o clima tocou a cena escolhida
    // A cena já tocava (pedida acima): pedir de novo não a desliga e continua atendido.
    assert.deepEqual((await pedir(a, 'jukebox.tocar', cenas.find(c => c.refs[0]!.id === tocou!.id)!.refs[0])).ok, true, 'pedir a cena que já toca não a desliga');

    // O efeito: o Jukebox toca a faixa sfx; um efeito que não existe volta com motivo.
    const efeito = efeitos[0]!.refs[0];
    assert.equal((await pedir(a, 'jukebox.efeito', efeito)).ok, true);
    await j.waitForFunction(() => { const e = (window as unknown as { __jukeboxMesa: { efeitosDisponiveis(): { state: { status: string; audio: HTMLAudioElement } }[] } }).__jukeboxMesa.efeitosDisponiveis()[0]!.state; return e.status === 'playing' || e.audio.currentTime > 0; }, null, { timeout: 4000 });
    const sem = await pedir(a, 'jukebox.efeito', { app: 'jukebox', tipo: 'efeito', id: 'nao-existe' }); assert.equal(sem.ok, false); assert.match(sem.detalhe ?? '', /não está carregado/);
    assert.equal((await pedir(a, 'jukebox.efeito', { app: 'jukebox', tipo: 'cena-sonora', id: 'x' })).ok, false, 'uma cena não é um efeito');

    // A porta com o efeito escolhido: ao abrir na sessão, o Atlas pede o efeito (e não toca o sintetizado).
    await a.evaluate(() => {
      const w = window as unknown as { __respostas: [string, boolean][]; __atlas: { servicos(): { barramento: { pedir(t: string, d: unknown, o?: unknown): Promise<{ ok: boolean }> } } } };
      w.__respostas = []; const b = w.__atlas.servicos().barramento, original = b.pedir.bind(b);
      b.pedir = async (t, d, o) => { const r = await original(t, d, o); w.__respostas.push([t, r.ok]); return r; };
    });
    await a.click('[data-testid="modo-construir"]').catch(() => undefined);
    await a.evaluate(async ref => {
      const s = (window as unknown as { __atlas: { sessao(): { store: { executar(c: unknown): void } } } }).__atlas.sessao();
      const cel = (x: number, y: number) => [x, y] as const, celulas = [] as (readonly [number, number])[]; for (let y = 2; y < 6; y++) for (let x = 2; x < 8; x++) celulas.push(cel(x, y));
      s.store.executar({ tipo: 'comodo.criar', id: 'sala', nome: 'Sala', funcao: 'sala', piso: { material: 'tabuas.carvalho', seed: 1 }, papel: null, celulas });
      s.store.executar({ tipo: 'parede.adicionar', parede: { id: 'p1', path: [[9, 3], [9, 9]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, drop: null, source: null } });
      s.store.executar({ tipo: 'abertura.adicionar', abertura: { id: 'porta', wallId: 'p1', at: 0.5, width: 1.5, kind: 'door', state: 'closed', material: 'madeira.media', som: ref, swing: 'a' } });
    }, efeito);
    await a.click('[data-testid="modo-sessao"]'); await a.waitForTimeout(500);
    await a.evaluate(() => { (window as unknown as { __atlas: { viewport(): { focarEm(c: object): void } } }).__atlas.viewport().focarEm({ x0: 2, y0: 2, x1: 14, y1: 10 }); });
    const [x, y] = await clientDe(a, [9, 6]); await a.mouse.click(x, y); await a.waitForTimeout(900);
    assert.equal((await documento(a)).openings.porta!.state, 'open');
    const resp = await a.evaluate(() => (window as unknown as { __respostas: [string, boolean][] }).__respostas);
    assert.ok(resp.some(([t, ok]) => t === 'jukebox.efeito' && ok), `a porta pediu o efeito ao Jukebox: ${JSON.stringify(resp)}`);
    assert.deepEqual(errosDoJukebox.filter(e => !/play\(\)|NotAllowed|The play/.test(e)), []); assert.deepEqual(atlas.erros, []);
  } finally { await ctx.close(); await vite.close(); await new Promise<void>(ok => { proxy.close(() => ok()); proxy.closeAllConnections(); }); await new Promise<void>(ok => { servidor.close(() => ok()); servidor.closeAllConnections(); }); }
});
