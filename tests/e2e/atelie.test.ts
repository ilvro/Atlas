import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const RAIZ_DO_ATELIE = fileURLToPath(new URL('../../../Atelie/', import.meta.url));

test('Ateliê no contrato (9.3c), com o Ateliê de verdade sob o mesa-dev: avisa o documento salvo, abre o documento pedido por "Editar no Ateliê" e recusa o que não existe', async () => {
  const { criarProxy, lerProjeto } = await import('../../scripts/mesa-dev.ts'), { createServer } = await import('vite');
  const atelieVite = await createServer({ root: RAIZ_DO_ATELIE, configFile: `${RAIZ_DO_ATELIE}vite.config.js`, base: '/Atelie/', logLevel: 'error', server: { port: 0, strictPort: false, host: '127.0.0.1' } });
  await atelieVite.listen();
  const atlasVite = await createServer({ configFile: new URL('../../vite.config.ts', import.meta.url).pathname, base: '/Atlas/', logLevel: 'error', server: { port: 0, strictPort: false, host: '127.0.0.1' } });
  await atlasVite.listen();
  const porta = (v: typeof atlasVite) => (v.httpServer!.address() as { port: number }).port;
  const proxy = criarProxy([lerProjeto(`Atlas=${porta(atlasVite)}`), lerProjeto(`Atelie=${porta(atelieVite)}`)]);
  await new Promise<void>(ok => proxy.listen(0, '127.0.0.1', ok));
  const origem = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`, ctx = await novoContexto(amb, { viewport: { width: 1500, height: 900 } });
  // Sob o mesa-dev o Ateliê guarda no navegador, como no GitHub Pages: não há servidor de API atrás do proxy. (No Vite de desenvolvimento só este gancho, ou `?storage=browser`, escolhe o modo.)
  await ctx.addInitScript(() => { (window as unknown as { __ATELIE_STORAGE: string }).__ATELIE_STORAGE = 'browser'; });
  try {
    // O Atlas, com uma campanha e um mapa com um cômodo; ele escuta o que o Ateliê avisa.
    const atlas = await abrir(ctx, `${origem}/Atlas/`), a = atlas.page;
    await a.click('[data-testid="nova-campanha"]'); await a.fill('[data-testid="nova-campanha-nome"]', 'A Ilha'); await a.press('[data-testid="nova-campanha-nome"]', 'Enter');
    await a.getByText(/Campanha “A Ilha” criada/).first().waitFor();
    await criarMapaPelaInterface(a);
    await a.click('[data-testid="ferramenta-comodo"]'); await a.waitForTimeout(350);
    const [ax, ay] = await clientDe(a, [3.75, 3.75]), [bx, by] = await clientDe(a, [14.25, 9.75]);
    await a.keyboard.down('Shift'); await a.mouse.move(ax, ay); await a.mouse.down(); await a.mouse.move(bx, by, { steps: 6 }); await a.mouse.up(); await a.keyboard.up('Shift');
    await a.click('[data-testid="ferramenta-selecionar"]'); await a.waitForTimeout(350);
    await a.evaluate(() => { const w = window as unknown as { __salvos: { dados: unknown; app: string }[] }; w.__salvos = []; const c = new BroadcastChannel('mesa:eventos'); c.onmessage = e => { if (e.data?.tipo === 'atelie.documento-salvo') w.__salvos.push(e.data); }; });

    // O Ateliê abre, cria dois documentos e arquiva o primeiro: nasce o aviso e o documento entra no banco de troca.
    const errosDoAtelie: string[] = [], t = await ctx.newPage();
    t.on('pageerror', e => errosDoAtelie.push(String(e)));
    await t.goto(`${origem}/Atelie/?diagnostics`);
    await t.waitForFunction(() => !!(window as unknown as { __atelie?: { editor?: { state?: unknown } } }).__atelie?.editor?.state, null, { timeout: 30_000 });
    const idCarta = await t.evaluate(() => {
      const editor = (window as unknown as { __atelie: { editor: { state: { handout: { id: string }; edit(d: object, o: object): void } } } }).__atelie.editor;
      const doc = structuredClone(editor.state.handout) as { id: string; name: string };
      doc.name = 'Carta para Muirenn'; editor.state.edit(doc, { label: 'Nome' });
      return doc.id;
    });
    await t.click('[data-action="archive"]');
    await t.waitForFunction(() => !(window as unknown as { __atelie: { editor: { state: { dirty: boolean } } } }).__atelie.editor.state.dirty, null, { timeout: 30_000 });
    await a.waitForFunction(() => ((window as unknown as { __salvos: unknown[] }).__salvos ?? []).length > 0, null, { timeout: 15_000 });
    const salvo = (await a.evaluate(() => (window as unknown as { __salvos: { app: string; dados: { documento: { app: string; tipo: string; id: string }; revisao?: number } }[] }).__salvos))[0]!;
    assert.equal(salvo.app, 'atelie'); assert.deepEqual(salvo.dados.documento, { app: 'atelie', tipo: 'documento', id: idCarta }); assert.ok(Number.isInteger(salvo.dados.revisao));

    // Um segundo documento fica à frente: o pedido do Atlas tem de trazer o primeiro de volta.
    await t.evaluate(() => (window as unknown as { __atelie: { editor: { createDocument(o: object): Promise<void> } } }).__atelie.editor.createDocument({ preset: 'a4' }));
    await t.waitForFunction(id => (window as unknown as { __atelie: { editor: { activeTabId: string } } }).__atelie.editor.activeTabId !== id, idCarta, { timeout: 15_000 });

    // A pista aparece no Atlas pelo banco de troca, entra no cômodo e é inspecionada na sessão.
    await a.bringToFront();
    await a.click('[data-testid="ferramenta-objeto"]'); await a.waitForTimeout(350);
    await a.locator(`[data-testid="pista-${idCarta}"]`).waitFor({ timeout: 10_000 });
    await a.evaluate(() => (window as unknown as { __atlas: { viewport(): { focarEm(c: object): void } } }).__atlas.viewport().focarEm({ x0: 3, y0: 3, x1: 15, y1: 10.5 })); await a.waitForTimeout(300);
    await a.click(`[data-testid="pista-por-${idCarta}"]`); await a.waitForTimeout(500);
    const doc = await documento(a), obj = Object.values(doc.props).find(o => o.interaction?.kind === 'clue')!;
    await a.click('[data-testid="modo-sessao"]'); await a.locator('[data-testid="dock"]').waitFor();
    await a.waitForTimeout(800);
    const [px, py] = await clientDe(a, obj.position as [number, number]);
    await a.mouse.click(px, py);
    await a.locator('[data-testid="inspecao"]').waitFor({ timeout: 8000 });

    // "Editar no Ateliê": o Ateliê atende, não abre aba nova, e o documento volta à frente.
    const abas = ctx.pages().length;
    await a.click('[data-testid="inspecao-editar"]');
    await t.waitForFunction(id => (window as unknown as { __atelie: { editor: { activeTabId: string } } }).__atelie.editor.activeTabId === id, idCarta, { timeout: 10_000 });
    await a.waitForTimeout(2200);
    assert.equal(ctx.pages().length, abas, 'o Ateliê respondeu: nada de aba nova');

    // Documento que não existe neste Ateliê: recusado com motivo (quem pede recorre à URL).
    const recusa = await a.evaluate(async () => {
      const s = (window as unknown as { __atlas: { servicos(): { barramento: { pedir(t: string, d: unknown): Promise<{ ok: boolean; motivo?: string; detalhe?: string }> } } } }).__atlas.servicos();
      return s.barramento.pedir('atelie.abrir', { ref: { app: 'atelie', tipo: 'documento', id: 'nao-existe' } });
    });
    assert.equal(recusa.ok, false); assert.equal(recusa.motivo, 'recusado'); assert.match(recusa.detalhe ?? '', /não existe/);
    assert.deepEqual(errosDoAtelie, [], 'sem erros na página do Ateliê');
  } finally { await ctx.close(); await new Promise<void>(ok => proxy.close(() => ok())); await atelieVite.close(); await atlasVite.close(); }
});
