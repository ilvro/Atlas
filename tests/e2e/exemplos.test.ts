import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, documento, encerrar, esperarEditor, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('a galeria mostra exemplos e "Usar este exemplo" abre uma cópia nova, sem mexer no exemplo publicado', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  try {
    await page.waitForSelector('[data-testid="exemplo-desfiladeiro-nevado"]', { timeout: 15_000 });
    assert.match(await page.textContent('[data-testid="exemplo-desfiladeiro-nevado"]') ?? '', /Desfiladeiro nevado/);
    assert.ok(await page.isVisible('[data-testid="comecar-exemplos"]'));
    const publicado = await page.evaluate(async () => (await fetch('exemplos/desfiladeiro-nevado.atlas.json')).text());

    await page.click('[data-testid="usar-desfiladeiro-nevado"]');
    await esperarEditor(page);
    const doc = await documento(page);
    assert.equal(doc.name, 'Desfiladeiro nevado'); assert.notEqual(doc.id, 'desfiladeiro-nevado');
    assert.ok(Object.keys(doc.props).length > 0);
    assert.ok(Object.values(doc.props).some(p => p.source.kind === 'asset'));

    // O mapa é do mestre: editá-lo não muda o exemplo publicado.
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForSelector('[data-testid="lista-mapas"]');
    assert.equal(await page.evaluate(async () => (await fetch('exemplos/desfiladeiro-nevado.atlas.json')).text()), publicado);
    // Usar de novo cria outra cópia.
    await page.click('[data-testid="usar-desfiladeiro-nevado"]'); await esperarEditor(page);
    assert.notEqual((await documento(page)).id, doc.id);
    assert.deepEqual(erros, []);
  } finally { await ctx.close(); }
});

test('sem o índice, a galeria segue completa e não mostra a seção de exemplos', async () => {
  const ctx = await novoContexto(amb);
  await ctx.route('**/exemplos/indice.json', r => r.fulfill({ status: 404, body: 'não existe' }));
  const { page } = await abrir(ctx, amb.url);
  try {
    await page.waitForSelector('[data-testid="comecar-em-branco"]');
    await page.waitForTimeout(600);
    assert.equal(await page.locator('[data-testid="exemplos"]').count(), 0);
    assert.equal(await page.locator('[data-testid="comecar-exemplos"]').count(), 0);
  } finally { await ctx.close(); }
});
