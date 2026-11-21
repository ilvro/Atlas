import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, criarMapaPelaInterface, encerrar, esperarMs, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('catálogo flutuante: abre ao passar o mouse na prévia, busca, escolhe e fecha; a família na mão fica presa no alto', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await page.click('[data-testid="ferramenta-objeto"]');
  const biblioteca = page.locator('[data-testid="biblioteca"]');

  // Rolar a gaveta até o fim não tira a família na mão do lugar.
  const topoAntes = (await biblioteca.locator('[data-testid="familia-na-mao"]').boundingBox())!.y;
  await biblioteca.locator('.biblioteca-corpo').evaluate(el => { el.scrollTop = el.scrollHeight; });
  await esperarMs(100);
  const topoDepois = (await biblioteca.locator('[data-testid="familia-na-mao"]').boundingBox())!.y;
  assert.ok(Math.abs(topoDepois - topoAntes) < 12, `a família na mão ficou presa (${topoAntes} → ${topoDepois})`);
  await page.screenshot({ path: 'test-results/catalogo-topo-preso.png' });

  await biblioteca.locator('[data-testid="abrir-catalogo"]').hover();
  const catalogo = page.locator('[data-testid="catalogo-flutuante"]');
  await catalogo.waitFor({ state: 'visible', timeout: 2000 });
  await catalogo.hover();
  await esperarMs(700);
  assert.ok(await catalogo.isVisible(), 'fica aberto com o mouse em cima');
  await esperarMs(400);
  await page.screenshot({ path: 'test-results/catalogo-aberto.png' });

  await catalogo.locator('[data-testid="busca-catalogo"]').fill('pedra');
  await esperarMs(400);
  await page.screenshot({ path: 'test-results/catalogo-busca.png' });
  await catalogo.locator('[data-testid="catalogo-pedra"]').click();
  await catalogo.waitFor({ state: 'detached', timeout: 2000 });
  assert.equal(await biblioteca.locator('[data-testid="familia-nome"]').innerText(), '☆Pedra');

  // Sair com o mouse fecha.
  await biblioteca.locator('[data-testid="abrir-catalogo"]').hover();
  await catalogo.waitFor({ state: 'visible', timeout: 2000 });
  await page.mouse.move(900, 500);
  await catalogo.waitFor({ state: 'detached', timeout: 2000 });
  assert.deepEqual(erros, []); await ctx.close();
});
