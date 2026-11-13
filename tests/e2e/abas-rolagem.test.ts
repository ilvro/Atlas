import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { abrir, criarMapaPelaInterface, encerrar, esperarMs, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const PASTA = '/tmp/claude-1000/-home-ilvro-Documents-Projects/50c9023f-ab4a-439f-85db-5b98ff3f5aee/scratchpad/abas';

test('abas que transbordam mostram setas, rolam por clique e pela roda, e o "+" fica visível', async () => {
  mkdirSync(PASTA, { recursive: true });
  const ctx = await novoContexto(amb, { viewport: { width: 1280, height: 700 } });
  await ctx.addInitScript(() => {
    try {
      if (localStorage.getItem('atlas:abas-abertas') === null) {
        const abas = Array.from({ length: 8 }, (_, i) => ({ id: `falso-${i}`, nome: `Caverna do Dragão Ancestral ${i + 1}` }));
        localStorage.setItem('atlas:abas-abertas', JSON.stringify(abas));
      }
    } catch { /* sem armazenamento */ }
  });
  const { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const direita = page.locator('[data-testid="abas-rolar-direita"]'), esquerda = page.locator('[data-testid="abas-rolar-esquerda"]');
  const lista = page.locator('.abas-lista'), mais = page.locator('[data-testid="abrir-nova-aba"]');
  const cabecalho = page.locator('header.cabecalho').last();
  await page.evaluate(() => { document.querySelector('.abas-lista')!.scrollLeft = 0; });
  await direita.waitFor({ timeout: 5000 });
  assert.equal(await esquerda.count(), 0);
  await cabecalho.screenshot({ path: `${PASTA}/antes.png` });

  await direita.click();
  await esquerda.waitFor({ timeout: 5000 });
  assert.ok(await lista.evaluate(e => e.scrollLeft) > 0);
  await cabecalho.screenshot({ path: `${PASTA}/depois.png` });

  const antes = await lista.evaluate(e => e.scrollLeft);
  const caixa = (await lista.boundingBox())!;
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
  await page.mouse.wheel(0, 200);
  await esperarMs(300);
  assert.ok(await lista.evaluate(e => e.scrollLeft) > antes);

  assert.ok(await mais.isVisible());
  const cx = (await mais.boundingBox())!, cl = (await lista.boundingBox())!;
  assert.ok(cx.x >= cl.x + cl.width - 1, 'o "+" fica fora da área rolável');
  assert.ok(cx.x + cx.width <= 1280);
  assert.deepEqual(erros, []); await ctx.close();
});
