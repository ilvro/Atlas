import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('fase 13: projetor exibe cortina preta com transição e letreiro de apresentação', async () => {
  const ctx = await novoContexto(amb);
  const { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const doc = await documento(page);

  const proj = await ctx.newPage();
  const errosProj: string[] = [];
  proj.on('pageerror', e => errosProj.push(e.message));

  await proj.goto(`${amb.url}#/projetor/${doc.id}`);
  await proj.waitForFunction(() => (window as unknown as { __projetor?: { doc(): unknown } }).__projetor?.doc() != null, null, { timeout: 20_000 });
  await proj.locator('[data-testid="projetor-cortina"]').waitFor({ timeout: 5000 });

  // 1. O mestre escurece a tela e exibe letreiro
  await page.evaluate(() => {
    const s = (window as unknown as { __atlas: { sessao(): { doc: { value: { id: string } } } } }).__atlas.sessao();
    const canal = new BroadcastChannel(`atlas:projetor:${s.doc.value.id}`);
    canal.postMessage({ tipo: 'tela', acao: 'escurecer', ms: 500 });
    canal.postMessage({
      tipo: 'letreiro',
      titulo: 'Kian',
      subtitulo: 'O Primeiro Ocultista',
      estilo: 'apresentacao',
      retrato: null,
      ms: 10000,
    });
  });

  // O projetor deve exibir a cortina escurecida e o letreiro de apresentação
  await proj.waitForFunction(() => {
    const c = (window as unknown as { __projetor?: { cortina(): { escurecer: boolean } } }).__projetor?.cortina();
    return c?.escurecer === true;
  }, null, { timeout: 5000 });

  const letreiro = proj.locator('[data-testid="projetor-letreiro"]');
  await letreiro.waitFor({ timeout: 5000 });
  assert.equal(await letreiro.getAttribute('data-estilo'), 'apresentacao');
  assert.ok((await letreiro.textContent())?.includes('Kian'));
  assert.ok((await letreiro.textContent())?.includes('O Primeiro Ocultista'));

  // Captura para visualização
  await proj.screenshot({ path: 'test-results/fase13-letreiro-projetor.png' });

  // 2. O mestre limpa o letreiro e clareia a tela
  await page.evaluate(() => {
    const s = (window as unknown as { __atlas: { sessao(): { doc: { value: { id: string } } } } }).__atlas.sessao();
    const canal = new BroadcastChannel(`atlas:projetor:${s.doc.value.id}`);
    canal.postMessage({ tipo: 'letreiro-fim' });
    canal.postMessage({ tipo: 'tela', acao: 'clarear', ms: 200 });
  });

  // Letreiro deve sumir na hora
  await proj.locator('[data-testid="projetor-letreiro"]').waitFor({ state: 'detached', timeout: 5000 });

  // Cortina deve clarear
  await proj.waitForFunction(() => {
    const c = (window as unknown as { __projetor?: { cortina(): { escurecer: boolean } } }).__projetor?.cortina();
    return c?.escurecer === false;
  }, null, { timeout: 5000 });

  assert.deepEqual(errosProj, []);
  assert.deepEqual(erros, []);
  await ctx.close();
});
