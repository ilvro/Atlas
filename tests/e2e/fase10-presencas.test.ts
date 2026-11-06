import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
const presencas = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { contagemDePresencas(): number } } }).__atlas.viewport().contagemDePresencas());
const presencasSubmersas = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { contagemDePresencasSubmersas(): number } } }).__atlas.viewport().contagemDePresencasSubmersas());

const celulasDe = (x0: number, y0: number, x1: number, y1: number) => {
  const c: [number, number][] = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]);
  return c;
};

test('10.6c: presenças novas (sangue-seco, fuligem, sulcos, algas) e renderização submersa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  // Terreno base de terra com um lago de água à direita
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "terreno.base", material: "terra" });
    s.store.executar({
      tipo: "terreno.pintar",
      material: "agua.lago",
      celulas: ${JSON.stringify(celulasDe(22, 4, 38, 24))},
      suavizar: false
    });
  }`);
  await page.waitForTimeout(1000);

  // Pintar as quatro novas presenças
  // 1. sangue-seco: manchas arrastadas
  // 2. fuligem: pó/manchas de preto queimado
  // 3. sulcos: trilhas paralelas ao longo do percurso
  // 4. algas: verde sob a água (submerso)
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "presenca.pintar", brush: "sangue-seco", celulas: ${JSON.stringify(celulasDe(4, 4, 16, 9))} });
    s.store.executar({ tipo: "presenca.pintar", brush: "fuligem", celulas: ${JSON.stringify(celulasDe(4, 11, 14, 16))} });
    s.store.executar({ tipo: "presenca.pintar", brush: "sulcos", celulas: ${JSON.stringify(celulasDe(4, 18, 20, 23))} });
    s.store.executar({ tipo: "presenca.pintar", brush: "algas", celulas: ${JSON.stringify(celulasDe(24, 7, 34, 19))} });
  }`);
  await page.waitForTimeout(1500);

  // Todas as 4 presenças foram desenhadas
  assert.equal(await presencas(page), 4, 'todas as 4 presenças devem estar ativas');
  // Apenas a presença de algas deve estar no container submerso
  assert.equal(await presencasSubmersas(page), 1, 'algas deve estar no container submerso sob a água');

  // Captura do mapa com as novas presenças no estilo Ilustrado
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/fase10-presencas.png' });

  // Alternar para o estilo Pixel
  await sessao(page, '(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { renderer: "pixel" } })');
  await page.waitForTimeout(1000);

  assert.equal(await presencas(page), 4, 'as 4 presenças continuam ativas no Pixel');
  assert.equal(await presencasSubmersas(page), 1, 'algas continua submersa no Pixel');
  await page.screenshot({ path: 'test-results/fase10-presencas-pixel.png' });

  // Voltar ao estilo Ilustrado e testar ferramentas e biblioteca
  await sessao(page, '(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { renderer: "illustrated" } })');
  await page.click('[data-testid="ferramenta-presenca"]');
  await page.waitForTimeout(500);

  // A biblioteca deve listar os 4 pincéis novos no grupo Natural
  assert.equal(await page.locator('[data-testid="presenca-sangue-seco"]').count(), 1, 'botão do pincel sangue-seco na biblioteca');
  assert.equal(await page.locator('[data-testid="presenca-fuligem"]').count(), 1, 'botão do pincel fuligem na biblioteca');
  assert.equal(await page.locator('[data-testid="presenca-sulcos"]').count(), 1, 'botão do pincel sulcos na biblioteca');
  assert.equal(await page.locator('[data-testid="presenca-algas"]').count(), 1, 'botão do pincel algas na biblioteca');

  assert.deepEqual(erros, []);
  await ctx.close();
});
