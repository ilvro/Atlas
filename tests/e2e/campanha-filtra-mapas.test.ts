import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const CAPTURAS = '/tmp/claude-1000/-home-ilvro-Documents-Projects/50c9023f-ab4a-439f-85db-5b98ff3f5aee/scratchpad/campanha';

const criarCampanha = async (page: Page, nome: string) => {
  await page.click('[data-testid="nova-campanha"]');
  await page.fill('[data-testid="nova-campanha-nome"]', nome);
  await page.keyboard.press('Enter');
  await page.waitForFunction(n => [...document.querySelectorAll('[data-testid="campanha-ativa"] option')].some(o => o.textContent === n), nome);
};
const escolher = (page: Page, rotulo: string) => page.selectOption('[data-testid="campanha-ativa"]', { label: rotulo });
const voltarParaGaleria = async (page: Page) => { await page.evaluate(() => { location.hash = '#/'; }); await page.waitForSelector('[data-testid="campanha-ativa"]'); };
const novoMapa = async (page: Page, nome: string) => {
  const id = await criarMapaPelaInterface(page);
  await page.fill('#nome-do-mapa', nome); await page.keyboard.press('Enter');
  await page.waitForFunction(n => document.querySelector<HTMLInputElement>('#nome-do-mapa')?.value === n, nome);
  await page.click('[data-testid="gravar"]');
  await page.waitForSelector('[data-testid="estado-gravacao"][data-sujo="false"]');
  await voltarParaGaleria(page);
  return id;
};
const nomesNaGaleria = async (page: Page) => (await page.locator('[data-testid="lista-mapas"] .cartao h3').allTextContents()).sort();
const limparAvisos = async (page: Page) => { await page.evaluate(() => document.querySelectorAll('[role="status"].toast, .toast').forEach(e => e.remove())); };
const contador = (page: Page) => page.locator('.lateral-conta').first().textContent();

test('a campanha selecionada filtra a galeria e o "+" da barra de abas; "Sem campanha" é a vista geral', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarCampanha(page, 'Alfa'); await criarCampanha(page, 'Beta'); await criarCampanha(page, 'Gama');
  await escolher(page, 'Alfa'); const a1 = await novoMapa(page, 'Mapa A1'); await novoMapa(page, 'Mapa A2');
  await escolher(page, 'Beta'); await novoMapa(page, 'Mapa B1');
  await escolher(page, 'Sem campanha'); await novoMapa(page, 'Mapa Solto');

  // Criar com campanha selecionada liga o mapa a ela.
  await page.evaluate(() => { localStorage.getItem('mesa:campanha-ativa'); });
  await escolher(page, 'Alfa');
  assert.deepEqual(await nomesNaGaleria(page), ['Mapa A1', 'Mapa A2']);
  assert.equal(await contador(page), '2');
  assert.equal(await page.locator('.cartao .selo').count(), 0, 'na vista filtrada o selo da campanha some');
  await limparAvisos(page); await page.screenshot({ path: `${CAPTURAS}/galeria-filtrada.png` });

  await escolher(page, 'Beta');
  assert.deepEqual(await nomesNaGaleria(page), ['Mapa B1']);

  await escolher(page, 'Sem campanha');
  assert.deepEqual(await nomesNaGaleria(page), ['Mapa A1', 'Mapa A2', 'Mapa B1', 'Mapa Solto']);
  assert.equal(await contador(page), '4');
  assert.equal(await page.locator('.cartao .selo').count(), 3, 'na vista geral o selo mostra a campanha');
  await limparAvisos(page); await page.screenshot({ path: `${CAPTURAS}/galeria-geral.png` });

  // Campanha sem mapas: vazio próprio, com atalho para a vista geral.
  await escolher(page, 'Gama');
  await page.waitForSelector('[data-testid="galeria-vazia-campanha"]');
  assert.equal(await page.locator('[data-testid="galeria-vazia"]').count(), 0);
  assert.equal(await contador(page), '0');
  assert.equal(await page.locator('[data-testid="exemplos"]').count() <= 1, true);
  await limparAvisos(page); await page.screenshot({ path: `${CAPTURAS}/galeria-campanha-vazia.png` });
  await page.click('[data-testid="ver-todos-mapas"]');
  await page.waitForSelector('[data-testid="lista-mapas"]');
  assert.equal(await page.locator('[data-testid="campanha-ativa"]').inputValue(), '');
  assert.equal((await nomesNaGaleria(page)).length, 4);

  // "+" da barra de abas: primeiro os mapas da campanha ativa, o resto atrás de "Outras campanhas".
  await escolher(page, 'Alfa');
  await page.locator('[data-testid="cartao-mapa"]', { hasText: 'Mapa A1' }).locator('.cartao-link').click();
  await page.waitForSelector('#nome-do-mapa');
  assert.equal((await documento(page)).id, a1);
  // Cada mapa criado deixou uma aba aberta: fecha as outras para que o "+" as liste.
  while (await page.locator('.aba-mapa:not(.ativa) .botao-fechar-aba').count()) await page.locator('.aba-mapa:not(.ativa) .botao-fechar-aba').first().click({ force: true });
  await page.waitForFunction(() => document.querySelectorAll('.aba-mapa').length === 1);
  await page.click('[data-testid="abrir-nova-aba"]');
  await page.waitForSelector('.item-mapa-aba:has-text("Mapa A2")');
  assert.equal(await page.locator('.item-mapa-aba', { hasText: 'Mapa B1' }).count(), 0);
  assert.equal(await page.locator('.item-mapa-aba', { hasText: 'Mapa Solto' }).count(), 0);
  await page.click('[data-testid="aba-outras-campanhas"]');
  assert.equal(await page.locator('[data-testid="item-mapa-outra-campanha"]').count(), 2);
  assert.equal(await page.locator('.item-mapa-aba', { hasText: 'Mapa B1' }).count(), 1);
  await limparAvisos(page); await page.screenshot({ path: `${CAPTURAS}/mais-abas.png` });
  assert.deepEqual(erros, []); await ctx.close();
});

test('a campanha escolhida persiste, e uma campanha que sumiu cai em "Sem campanha"', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarCampanha(page, 'Alfa'); await novoMapa(page, 'Mapa A1');
  await page.evaluate(() => localStorage.setItem('mesa:campanha-ativa', 'inexistente'));
  await page.reload(); await page.waitForSelector('[data-testid="campanha-ativa"]');
  assert.equal(await page.locator('[data-testid="campanha-ativa"]').inputValue(), '');
  assert.deepEqual(await nomesNaGaleria(page), ['Mapa A1']);
  assert.deepEqual(erros, []); await ctx.close();
});
