import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  abrir,
  criarMapaPelaInterface,
  encerrar,
  iniciarAmbiente,
  novoContexto,
  type Ambiente,
} from './apoio.ts';

let amb: Ambiente;
before(async () => {
  amb = await iniciarAmbiente();
});
after(async () => {
  await encerrar(amb);
});

test('fase 13: barra de efeitos na tela, configuração do espaço 6 para Grito e disparo com tecla 6', async () => {
  const ctx = await novoContexto(amb);
  const { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  // 1. Alterna para o modo Sessão
  await page.click('[data-testid="modo-sessao"]');
  await page.waitForSelector('[data-testid="barra-de-efeitos"]', { timeout: 5000 });

  const barra = page.locator('[data-testid="barra-de-efeitos"]');
  await barra.waitFor({ state: 'visible' });

  // Confere que a barra está posicionada acima da barra inferior
  const barraBox = await barra.boundingBox();
  const barraInf = page.locator('[data-testid="barra-inferior"]');
  const barraInfBox = await barraInf.boundingBox();

  assert.ok(barraBox, 'barra de efeitos deve ter dimensões');
  assert.ok(barraInfBox, 'barra inferior deve ter dimensões');
  assert.ok(
    barraBox.y + barraBox.height <= barraInfBox.y + 4,
    'barra de efeitos deve estar acima da barra inferior',
  );

  // 2. O espaço 6 começa vazio
  const espaco6 = page.locator('[data-testid="barra-espaco-6"]');
  await espaco6.waitFor();
  assert.ok((await espaco6.getAttribute('class'))?.includes('vazio'));

  // 3. Clica no espaço 6 para abrir a configuração
  await espaco6.click();
  const popover = page.locator('[data-testid="popover-barra-efeitos"]');
  await popover.waitFor({ state: 'visible' });

  // 4. Configura tipo para "Som do Jukebox"
  await page.selectOption('[data-testid="popover-espaco-tipo"]', 'som');

  // Preenche rótulo "Grito"
  const inputRotulo = page.locator('[data-testid="popover-espaco-rotulo"]');
  await inputRotulo.fill('Grito');

  // Preenche ID do efeito sonoro
  const inputSomId = page.locator('[data-testid="passo-som-id"]');
  await inputSomId.fill('grito');

  // 5. Salva a configuração
  await page.click('[data-testid="popover-espaco-salvar"]');
  await popover.waitFor({ state: 'hidden' });

  // 6. Confere que o espaço 6 agora está preenchido com rótulo "Grito"
  assert.ok(!(await espaco6.getAttribute('class'))?.includes('vazio'));
  assert.ok((await espaco6.textContent())?.includes('Grito'));

  // 7. Aperta a tecla 6 para disparar o efeito
  await page.keyboard.press('6');

  // Verifica que o espaço recebeu o disparo
  await page.waitForFunction(() => {
    const el = document.querySelector('[data-testid="barra-espaco-6"]');
    return el?.classList.contains('disparado');
  }, null, { timeout: 3000 });

  // 8. Testa recolher e expandir a barra
  const toggle = page.locator('[data-testid="barra-efeitos-toggle"]');
  await toggle.click();
  assert.ok((await barra.getAttribute('class'))?.includes('recolhida'));

  // Re-expande
  await toggle.click();
  assert.ok(!(await barra.getAttribute('class'))?.includes('recolhida'));

  // Captura para visualização
  await page.screenshot({ path: 'test-results/fase13-barra-efeitos.png' });

  assert.equal(erros.length, 0, `erros de console encontrados: ${erros.join(', ')}`);
});
