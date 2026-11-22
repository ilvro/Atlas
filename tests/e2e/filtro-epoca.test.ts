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
  await page.selectOption('[data-testid="filtro-epoca"]', 'todas');
  await page.locator('[data-testid="familia-notebook"]').waitFor();
  assert.ok(await grade.locator('button').count() > curta, '"Todas" devolve tudo');
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas.filtroDeEpoca')), 'todas');
  await page.selectOption('[data-testid="filtro-epoca"]', 'mapa');
  assert.equal(await page.locator('[data-testid="familia-notebook"]').count(), 0);
  await page.locator('[data-testid="busca-objeto"]').fill('notebook');
  await page.locator('[data-testid="familia-notebook"]').waitFor();
  assert.match(await page.locator('[data-testid="familia-notebook"] .selo-acervo').innerText(), /moderno/i, 'selo do gênero');
  await page.locator('[data-testid="busca-objeto"]').fill('');
  // Bioma: Natureza + "Frio e neve" tira a palmeira; o terreno perde a areia.
  await page.selectOption('[data-testid="filtro-epoca"]', 'todas'); await page.selectOption('[data-testid="filtro-grupo"]', 'natureza');
  await page.locator('[data-testid="familia-palmeira"]').waitFor();
  await page.selectOption('[data-testid="filtro-bioma"]', 'frio');
  await page.locator('[data-testid="familia-palmeira"]').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas.filtroDeBioma')), 'frio');
  await page.click('[data-testid="ferramenta-terreno"]'); await page.locator('[data-testid="grupo-terreno-neve"]').waitFor();
  assert.equal(await page.locator('[data-testid="grupo-terreno-areia"]').count(), 0);
  await page.selectOption('[data-testid="filtro-bioma"]', '');
  await page.locator('[data-testid="grupo-terreno-areia"]').waitFor();
  // Recentes começa recolhido e "Ver mais…" guarda o estado.
  await page.click('[data-testid="ferramenta-objeto"]');
  assert.equal(await page.locator('[data-testid="aba-recentes"]').count(), 0, 'recentes recolhido');
  await page.click('[data-testid="recentes-alternar"]'); await page.locator('[data-testid="aba-recentes"]').waitFor();
  assert.equal(await page.locator('[data-testid="prop-opacidade"]').count(), 0, 'propriedades raras recolhidas');
  await page.click('[data-testid="prop-ver-mais"]'); await page.locator('[data-testid="prop-opacidade"]').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas.propriedadesAbertas')), '1');
  await page.click('[data-testid="prop-ver-mais"]'); await page.locator('[data-testid="prop-opacidade"]').waitFor({ state: 'detached' });
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas.propriedadesAbertas')), '0');
  assert.deepEqual(erros, []);
  await ctx.close();
});
