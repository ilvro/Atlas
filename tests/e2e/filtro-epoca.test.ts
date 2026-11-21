import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('biblioteca: o gênero do mapa filtra a grade; "Todas" e a busca devolvem o que ficou fora; o bioma filtra o terreno', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await page.evaluate(() => { (window as unknown as { __atlas: { sessao(): { store: { executar(c: unknown): void } } } }).__atlas.sessao().store.executar({ tipo: 'estilo.atualizar', patch: { genre: 'fantasia' } }); });
  await page.click('[data-testid="ferramenta-objeto"]'); await page.locator('[data-testid="biblioteca"]').waitFor();
  const grade = page.locator('[data-testid="lista-receitas"]');
  await page.locator('[data-testid="familia-caixote"]').waitFor();
  assert.equal(await page.locator('[data-testid="familia-notebook"]').count(), 0, 'fantasia não mostra o notebook');
  const curta = await grade.locator('button').count();
  await page.click('[data-testid="epoca-todas"]');
  await page.locator('[data-testid="familia-notebook"]').waitFor();
  assert.ok(await grade.locator('button').count() > curta, '"Todas" devolve tudo');
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas.filtroDeEpoca')), 'todas');
  await page.click('[data-testid="epoca-mapa"]');
  assert.equal(await page.locator('[data-testid="familia-notebook"]').count(), 0);
  await page.locator('[data-testid="busca-objeto"]').fill('notebook');
  await page.locator('[data-testid="familia-notebook"]').waitFor();
  assert.match(await page.locator('[data-testid="familia-notebook"] .selo-acervo').innerText(), /moderno/i, 'selo do gênero');
  await page.locator('[data-testid="busca-objeto"]').fill('');
  // Bioma: Natureza + "Frio e neve" tira a palmeira; o terreno perde a areia.
  await page.click('[data-testid="epoca-todas"]'); await page.click('[data-testid="grupo-natureza"]');
  await page.locator('[data-testid="familia-palmeira"]').waitFor();
  await page.click('[data-testid="bioma-frio"]');
  await page.locator('[data-testid="familia-palmeira"]').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas.filtroDeBioma')), 'frio');
  await page.click('[data-testid="ferramenta-terreno"]'); await page.locator('[data-testid="grupo-terreno-neve"]').waitFor();
  assert.equal(await page.locator('[data-testid="grupo-terreno-areia"]').count(), 0);
  await page.click('[data-testid="bioma-todos"]');
  await page.locator('[data-testid="grupo-terreno-areia"]').waitFor();
  assert.deepEqual(erros, []);
  await ctx.close();
});
