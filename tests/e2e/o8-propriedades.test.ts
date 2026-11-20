import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('O8: as propriedades do pincel valem ao pôr, e o inspetor edita o objeto posto', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await page.click('[data-testid="ferramenta-objeto"]');
  const biblioteca = page.locator('[data-testid="biblioteca"]');
  await biblioteca.locator('[data-testid="prop-escala"]').fill('150'); await page.keyboard.press('Enter');
  await biblioteca.locator('[data-testid="prop-espelhar-h"]').click();
  await biblioteca.locator('[data-testid="prop-opacidade"]').fill('60'); await page.keyboard.press('Enter');
  const [x, y] = await clientDe(page, [12, 12]); await page.mouse.click(x, y);
  let props = Object.values((await documento(page)).props);
  assert.equal(props.length, 1);
  assert.equal(props[0]!.scale, 1.5); assert.equal(props[0]!.flip, true); assert.equal(props[0]!.opacity, 0.6);
  await page.click('[data-testid="aba-selecao"]');
  const inspetor = page.locator('aside.inspetor');
  await inspetor.locator('[data-testid="prop-opacidade"]').fill('30'); await page.keyboard.press('Enter');
  await inspetor.locator('[data-testid="prop-espelhar-v"]').click();
  props = Object.values((await documento(page)).props);
  assert.equal(props[0]!.opacity, 0.3);
  assert.equal(props[0]!.flip ?? false, false, '↕ inverte o espelho');
  assert.ok(Math.abs(props[0]!.rotation - Math.PI) < 1e-6, '↕ soma 180°');
  await inspetor.locator('[data-testid="prop-opacidade"]').fill('100'); await page.keyboard.press('Enter');
  assert.equal(Object.values((await documento(page)).props)[0]!.opacity, undefined, 'opacidade 100% sai do documento');
  await page.screenshot({ path: 'test-results/o8-painel.png' });
  assert.deepEqual(erros, []); await ctx.close();
});
