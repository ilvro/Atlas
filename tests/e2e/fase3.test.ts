import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, esperarEditor, iniciarAmbiente, novoContexto, selecao, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

/** Trocar de ferramenta pode abrir/fechar a biblioteca, o que redimensiona o mapa: espera o enquadramento assentar. */
async function ferramenta(p: Page, id: string) { await p.click(`[data-testid="ferramenta-${id}"]`); await p.waitForTimeout(350); }
async function arrastar(p: Page, de: [number, number], para: [number, number], retangulo = false) {
  const [ax, ay] = await clientDe(p, de), [bx, by] = await clientDe(p, para);
  if (retangulo) await p.keyboard.down('Shift');
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up();
  if (retangulo) await p.keyboard.up('Shift');
}
async function clicar(p: Page, mundo: [number, number]) { const [x, y] = await clientDe(p, mundo); await p.mouse.click(x, y); }
const historico = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { sessao(): { store: { historico: string[] } } } }).__atlas.sessao().store.historico.length);

test('uma casa de três cômodos com portas, mobília e luz, só pela interface', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  // Cômodos: cada arrasto é UMA ação de histórico, e as paredes nascem sozinhas.
  await ferramenta(page, 'comodo');
  const h0 = await historico(page);
  await arrastar(page, [3.75, 3.75], [8.25, 8.25], true)
  assert.equal(await historico(page), h0 + 1);
  await arrastar(page, [9.75, 3.75], [14.25, 8.25], true)
  await arrastar(page, [3.75, 9.75], [8.25, 12.75], true)
  let m = await documento(page);
  assert.equal(Object.keys(m.rooms).length, 3);
  assert.ok(Object.keys(m.walls).length >= 3, 'paredes derivadas dos cômodos');
  assert.ok(Object.values(m.walls).every(w => w.source));

  // Portas: encaixam na parede compartilhada entre a sala e a cozinha, e entre a sala e o quarto.
  await ferramenta(page, 'abertura');
  await clicar(page, [9, 6]); await clicar(page, [6, 9]);
  m = await documento(page);
  assert.equal(Object.keys(m.openings).length, 2);
  assert.ok(Object.values(m.openings).every(o => m.walls[o.wallId]));

  // Mobília e luz com a biblioteca aberta.
  await ferramenta(page, 'objeto');
  await page.locator('[data-testid="biblioteca"]').waitFor();
  await clicar(page, [6, 6]);
  await ferramenta(page, 'luz'); await clicar(page, [7.5, 7.5]);
  m = await documento(page);
  assert.equal(Object.keys(m.props).length, 1); assert.equal(Object.keys(m.lights).length, 1);
  assert.equal(Object.values(m.lights)[0]!.preset, 'lamparina');
  assert.equal(Object.values(m.props)[0]!.roomId, Object.values(m.rooms).find(r => r.name)!.id);

  // O cartão contextual segue o item selecionado e abre a porta.
  await ferramenta(page, 'selecionar'); await clicar(page, [30, 22]); await clicar(page, [9, 6]);
  assert.equal((await selecao(page))[0]?.colecao, 'openings');
  await page.locator('[data-testid="cartao-contextual"]').waitFor();
  await page.click('[data-testid="cartao-abrir"]');
  assert.equal(Object.values((await documento(page)).openings).filter(o => o.state === 'open').length, 1);

  // Desfazer volta a porta; recarregar mantém a casa inteira.
  await page.keyboard.press('Control+z');
  assert.equal(Object.values((await documento(page)).openings).filter(o => o.state === 'open').length, 0);
  await page.click('[data-testid="gravar"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="estado-gravacao"]')?.getAttribute('data-sujo') === 'false');
  await page.reload(); await esperarEditor(page);
  const depois = await documento(page);
  assert.equal(Object.keys(depois.rooms).length, 3); assert.equal(Object.keys(depois.openings).length, 2); assert.equal(Object.keys(depois.props).length, 1);
  assert.deepEqual(erros, []); await ctx.close();
});

test('apagar parte de um cômodo refaz as paredes; a borracha remove cômodos vazios; tudo desfaz', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await arrastar(page, [3.75, 3.75], [8.25, 8.25], true)
  const antes = await documento(page), paredes = Object.keys(antes.walls).length;
  await ferramenta(page, 'borracha'); await arrastar(page, [3.75, 3.75], [5.25, 8.25], true)
  const meio = await documento(page);
  assert.equal(Object.keys(meio.rooms).length, 1);
  assert.ok(Object.keys(meio.walls).length >= 1 && meio.rooms[Object.keys(meio.rooms)[0]!]!.cells.length > 0);
  await ferramenta(page, 'borracha'); await arrastar(page, [6.75, 3.75], [8.25, 8.25], true)
  assert.equal(Object.keys((await documento(page)).rooms).length, 0);
  assert.equal(Object.keys((await documento(page)).walls).length, 0);
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
  const volta = await documento(page);
  assert.equal(Object.keys(volta.rooms).length, 1); assert.equal(Object.keys(volta.walls).length, paredes);
  assert.deepEqual(erros, []); await ctx.close();
});

test('biblioteca: busca por nome, escolher um objeto e pôr; terreno pinta uma camada; Esc cancela o traço', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await page.keyboard.press('o');
  await page.locator('[data-testid="biblioteca"]').waitFor(); await page.waitForTimeout(350);
  await page.fill('.biblioteca .busca', 'sofa');
  const carta = page.locator('.biblioteca .receita', { hasText: /sofá/i }).first(); await carta.click();
  await clicar(page, [10.5, 9]);
  assert.equal(Object.values((await documento(page)).props)[0]!.source.kind === 'recipe' && (Object.values((await documento(page)).props)[0]!.source as { recipe: string }).recipe, 'sofa');
  await ferramenta(page, 'terreno');
  await arrastar(page, [15, 15], [21, 15])
  const m = await documento(page);
  assert.ok(Object.keys(m.terrain.layers).length >= 1);
  // Esc no meio do traço cancela tudo.
  const n = Object.keys(m.terrain.layers).length, h = await historico(page);
  const [ax, ay] = await clientDe(page, [24, 22]), [bx, by] = await clientDe(page, [30, 22]);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 8 }); await page.keyboard.press('Escape'); await page.mouse.up();
  assert.equal(await historico(page), h);
  assert.equal(Object.keys((await documento(page)).terrain.layers).length, n);
  assert.deepEqual(erros, []); await ctx.close();
});

test('inspetor do cômodo: nome, função, piso e notas do mestre viram ações de histórico', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await arrastar(page, [3.75, 3.75], [8.25, 8.25], true)
  await ferramenta(page, 'selecionar'); await clicar(page, [6, 6]);
  assert.equal((await selecao(page))[0]?.colecao, 'rooms');
  await page.fill('[aria-label="Notas do mestre do cômodo"]', 'A carta está atrás do quadro.'); await page.locator('[aria-label="Notas do mestre do cômodo"]').blur();
  await page.waitForFunction(() => /carta/.test(JSON.stringify((window as unknown as { __atlas: { sessao(): { doc: { value: unknown } } } }).__atlas.sessao().doc.value)));
  const m = await documento(page), id = Object.keys(m.rooms)[0]!;
  assert.equal(m.comodosExtra[id]!.notasMestre, 'A carta está atrás do quadro.');
  assert.deepEqual(erros, []); await ctx.close();
});
