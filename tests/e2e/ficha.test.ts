import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { abrir, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const RAIZ_DA_FICHA = fileURLToPath(new URL('../../../Ficha teste - Ordem II/', import.meta.url));

test('Ficha no contrato (9.2a), com a Ficha de verdade sob o mesa-dev: publica as personagens com retrato, rola e avisa recursos, abre a ficha pedida', async () => {
  const { criarProxy, lerProjeto } = await import('../../scripts/mesa-dev.ts'), { createServer } = await import('vite');
  const fichaVite = await createServer({ root: RAIZ_DA_FICHA, configFile: `${RAIZ_DA_FICHA}vite.config.js`, base: '/Ficha/', logLevel: 'error', server: { port: 0, strictPort: false, host: '127.0.0.1' } });
  await fichaVite.listen();
  const atlasVite = await createServer({ configFile: new URL('../../vite.config.ts', import.meta.url).pathname, base: '/Atlas/', logLevel: 'error', server: { port: 0, strictPort: false, host: '127.0.0.1' } });
  await atlasVite.listen();
  const porta = (v: typeof atlasVite) => (v.httpServer!.address() as { port: number }).port;
  const proxy = criarProxy([lerProjeto(`Atlas=${porta(atlasVite)}`), lerProjeto(`Ficha=${porta(fichaVite)}`)]);
  await new Promise<void>(ok => proxy.listen(0, '127.0.0.1', ok));
  const origem = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`, ctx = await novoContexto(amb, { viewport: { width: 1500, height: 900 } });
  try {
    const atlas = await abrir(ctx, `${origem}/Atlas/`), a = atlas.page;
    await a.click('[data-testid="nova-campanha"]'); await a.fill('[data-testid="nova-campanha-nome"]', 'A Ilha'); await a.press('[data-testid="nova-campanha-nome"]', 'Enter');
    await a.getByText(/Campanha “A Ilha” criada/).first().waitFor();
    await criarMapaPelaInterface(a);
    const campanhaId = await a.evaluate(() => localStorage.getItem('mesa:campanha-ativa')!);

    const errosDaFicha: string[] = [], f = await ctx.newPage();
    f.on('pageerror', e => errosDaFicha.push(String(e))); f.on('console', m => { if (m.type() === 'error') errosDaFicha.push(m.text()); });
    await f.goto(`${origem}/Ficha/`);
    const entidades = () => a.evaluate(async id => { const s = (window as unknown as { __atlas: { servicos(): { campanhas: { listarEntidades(c: string): Promise<{ id: string; tipo: string; nome: string; criadaPor: string; refs: { app: string; tipo: string; id: string }[]; retrato?: Blob }[]> } } } }).__atlas.servicos(); return (await s.campanhas.listarEntidades(id)).map(e => ({ id: e.id, tipo: e.tipo, nome: e.nome, criadaPor: e.criadaPor, refs: e.refs, retrato: e.retrato ? e.retrato.size : 0 })); }, campanhaId);
    for (let i = 0; i < 80 && !(await entidades()).some(e => e.tipo === 'personagem'); i++) await a.waitForTimeout(250);
    await a.waitForTimeout(2500);
    const lista = (await entidades()).filter(e => e.tipo === 'personagem');
    console.log('# personagens publicadas:', lista.length, lista.slice(0, 4).map(e => `${e.nome} (${e.retrato} B)`).join(', '));
    assert.ok(lista.length >= 1 && lista.length < 30, 'só as personagens, não as ameaças');
    assert.ok(lista.every(e => e.criadaPor === 'ficha' && e.refs[0]!.app === 'ficha' && e.refs[0]!.tipo === 'ficha'));
    assert.ok(lista.some(e => e.retrato > 0 && e.retrato <= 512 * 1024), 'alguma personagem publicou o retrato');

    // O retrato publicado vira o retrato da peça quando a personagem entra no mapa.
    await a.click('[data-testid="aba-mapa"]');
    const comRetrato = lista.find(e => e.retrato > 0)!;
    const botao = a.locator(`[data-testid="personagem-por-${comRetrato.id}"]`); await botao.waitFor({ timeout: 10_000 }); await botao.click();
    await a.waitForFunction(() => Object.values((window as unknown as { __atlas: { sessao(): { store: { documento: { tokens: Record<string, { portrait: unknown }> } } } } }).__atlas.sessao().store.documento.tokens).some(t => t.portrait), null, { timeout: 8000 });
    const peca = await a.evaluate(() => Object.values((window as unknown as { __atlas: { sessao(): { store: { documento: { tokens: Record<string, { name: string; player: boolean; refs: unknown[]; portrait: unknown }> } } } } }).__atlas.sessao().store.documento.tokens)[0]!);
    assert.equal(peca.name, comRetrato.nome); assert.equal(peca.player, true); assert.deepEqual(peca.refs, comRetrato.refs);

    // Rolar na Ficha chega ao Atlas como ficha.rolagem; os recursos (PV/PD) vêm como ficha.recursos.
    await a.evaluate(() => { const w = window as unknown as { __ouvidos: { tipo: string; dados: unknown }[]; __atlas: { servicos(): { barramento: { ouvir(t: string, f: (e: { tipo: string; dados: unknown }) => void): void } } } }; w.__ouvidos = []; for (const t of ['ficha.rolagem', 'ficha.recursos']) w.__atlas.servicos().barramento.ouvir(t, e => w.__ouvidos.push({ tipo: e.tipo, dados: e.dados })); });
    await f.bringToFront(); await f.waitForSelector('[data-roll]', { timeout: 15_000 });
    await f.locator('[data-roll]').first().click({ force: true }); await f.waitForTimeout(1500); await f.keyboard.press('Space');      // a cena de dados espera o arremesso
    await a.waitForFunction(() => (window as unknown as { __ouvidos: { tipo: string }[] }).__ouvidos.some(e => e.tipo === 'ficha.rolagem'), null, { timeout: 30_000 });
    const rolagem = (await a.evaluate(() => (window as unknown as { __ouvidos: { tipo: string; dados: { ficha: { app: string; tipo: string }; titulo: string; total: number } }[] }).__ouvidos)).find(e => e.tipo === 'ficha.rolagem')!.dados;
    assert.equal(rolagem.ficha.app, 'ficha'); assert.equal(rolagem.ficha.tipo, 'ficha'); assert.ok(rolagem.titulo.length > 0); assert.ok(Number.isFinite(rolagem.total));
    // Pedir a outra ficha: a Ficha troca para ela (e atende o pedido).
    const outra = lista.find(e => e.id !== comRetrato.id && e.refs[0]!.id !== peca.refs.map(r => (r as { id: string }).id)[0])!;
    const resposta = await a.evaluate(async ref => (await (window as unknown as { __atlas: { servicos(): { barramento: { pedir(t: string, d: unknown): Promise<{ ok: boolean; detalhe?: string }> } } } }).__atlas.servicos().barramento.pedir('ficha.abrir', { ref })), outra.refs[0]);
    assert.equal(resposta.ok, true, resposta.detalhe);
    const inexistente = await a.evaluate(async () => (await (window as unknown as { __atlas: { servicos(): { barramento: { pedir(t: string, d: unknown): Promise<{ ok: boolean; detalhe?: string }> } } } }).__atlas.servicos().barramento.pedir('ficha.abrir', { ref: { app: 'ficha', tipo: 'ficha', id: 'nao-existe' } })));
    assert.equal(inexistente.ok, false); assert.match(inexistente.detalhe ?? '', /não existe/);
    assert.deepEqual(errosDaFicha.filter(e => !/service|sw\.js|favicon|manifest/i.test(e)), []);
  } finally { await ctx.close(); await atlasVite.close(); await fichaVite.close(); await new Promise<void>(ok => { proxy.close(() => ok()); proxy.closeAllConnections(); }); }
});
