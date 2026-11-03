import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
async function ferramenta(p: Page, id: string) { await p.click(`[data-testid="ferramenta-${id}"]`); await p.waitForTimeout(350); }
async function clicar(p: Page, mundo: [number, number]) { const [x, y] = await clientDe(p, mundo); await p.mouse.click(x, y); await p.waitForTimeout(150); }
async function retangulo(p: Page, a: [number, number], b: [number, number]) {
  const [ax, ay] = await clientDe(p, a), [bx, by] = await clientDe(p, b);
  await p.keyboard.down('Shift'); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up(); await p.keyboard.up('Shift');
}
const semFoco = (p: Page) => p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
const ferramentaAtual = (p: Page) => sessao(p, '(s) => s.ferramenta.value') as Promise<string>;

test('modos: M entra na Sessão (some a biblioteca, a pílula e as ferramentas de construir, C não troca de ferramenta); M volta e tudo reaparece', async () => {
  const ctx = await novoContexto(amb, {}, true), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [10.5, 9.75]);
  await page.click('[data-testid="aba-selecao"]'); const nome = page.getByLabel('Nome', { exact: true }); await nome.fill('Cozinha'); await nome.press('Enter');
  await page.locator('[data-testid="pilula"]').waitFor({ timeout: 4000 });
  await ferramenta(page, 'objeto'); await page.locator('[data-testid="biblioteca"]').waitFor();
  assert.equal(await page.locator('[data-testid="modo-construir"]').getAttribute('aria-checked'), 'true');
  // Entra na Sessão pelo atalho M.
  await semFoco(page); await page.keyboard.press('m'); await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-testid="modo-sessao"]').getAttribute('aria-checked'), 'true'); await page.locator('[data-testid="faixa-sessao"]').waitFor();
  assert.equal(await page.locator('[data-testid="biblioteca"]').count(), 0, 'sem biblioteca'); assert.equal(await page.locator('[data-testid="pilula"]').count(), 0, 'sem pílula');
  assert.equal(await ferramentaAtual(page), 'selecionar', 'a ferramenta volta a selecionar');
  assert.equal(await page.locator('[data-testid="ferramenta-comodo"]').count(), 0); assert.equal(await page.locator('[data-testid="ferramenta-selecionar"]').count(), 1); assert.equal(await page.locator('[data-testid="ferramenta-mao"]').count(), 1);
  await page.keyboard.press('c'); await page.waitForTimeout(200); assert.equal(await ferramentaAtual(page), 'selecionar', 'C não troca de ferramenta na Sessão');
  await page.keyboard.press('Control+k'); await page.locator('[data-testid="paleta"] input').fill('pintar cômodo'); await page.waitForTimeout(250);
  assert.equal(await page.locator('[role="option"]').filter({ hasText: /Pintar cômodo/ }).count(), 0, 'a paleta não oferece ações de construir'); await page.keyboard.press('Escape');
  // Volta a Construir pelo botão: tudo reaparece.
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-testid="faixa-sessao"]').count(), 0); assert.equal(await page.locator('[data-testid="ferramenta-comodo"]').count(), 1);
  await semFoco(page); await page.keyboard.press('c'); await page.waitForTimeout(200); assert.equal(await ferramentaAtual(page), 'comodo', 'C volta a funcionar');
  await page.locator('[data-testid="pilula"]').waitFor({ timeout: 4000 }).catch(() => undefined);
  assert.deepEqual(erros, []); await ctx.close();
});

test('modos: abrir outro mapa volta a Construir', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-testid="modo-sessao"]').getAttribute('aria-checked'), 'true');
  await page.keyboard.press('Alt+g'); await page.waitForTimeout(600);
  await criarMapaPelaInterface(page); await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-testid="modo-construir"]').getAttribute('aria-checked'), 'true', 'o mapa novo abre em Construir');
  assert.equal((await documento(page)).version, 5);
  assert.deepEqual(erros, []); await ctx.close();
});

const peca = (id: string, nome: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ id, name: nome, portrait: null, sprite: null, facing: 'down', position: [x, y], size: 1, player: false, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], ...extra });
const diag = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { id: string; retrato: boolean; deitada: boolean; raio: number }[] } } }).__atlas.viewport().diagnosticoDasPecas());

test('peça: o retrato enviado aparece recortado na peça, o tamanho vale, e o estado morto deita a peça (e desfaz)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s, p) => s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p })', peca('hugo', 'Hugo', 10, 10, { size: 2 }));
  await page.waitForTimeout(300);
  let d = (await diag(page))[0]!; assert.equal(d.retrato, false, 'sem retrato: a inicial'); assert.ok(Math.abs(d.raio - 1.35) < 0.01, `tamanho 2 células de 1,5 m: raio ${d.raio}`);
  await sessao(page, '(s) => { s.selecao.value = [{ colecao: "tokens", id: "hugo" }]; }'); await page.click('[data-testid="aba-selecao"]');
  await page.locator('[data-testid="retrato-arquivo"]').setInputFiles('tests/e2e/retrato-de-teste.png');
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { retrato: boolean }[] } } }).__atlas.viewport().diagnosticoDasPecas()[0]?.retrato === true, null, { timeout: 8000 });
  const m = await documento(page); assert.ok(m.tokens.hugo!.portrait?.id, 'o retrato foi guardado como asset');
  await page.screenshot({ path: 'test-results/fase7-peca-retrato.png' });
  await page.locator('label.linha', { hasText: 'Estado' }).locator('select').selectOption('dead'); await page.waitForTimeout(300);
  d = (await diag(page))[0]!; assert.equal(d.deitada, true, 'morto: deitada'); assert.equal(d.retrato, true);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300); assert.equal((await diag(page))[0]!.deitada, false, 'desfazer levanta a peça');
  await page.locator('label.linha', { hasText: 'Jogador' }).locator('input[type=checkbox]').check(); await page.waitForTimeout(200); assert.equal((await documento(page)).tokens.hugo!.player, true);
  await page.locator('[data-testid="retrato-remover"]').click(); await page.waitForTimeout(300); assert.equal((await diag(page))[0]!.retrato, false); assert.equal((await documento(page)).tokens.hugo!.portrait, null);
  assert.deepEqual(erros, []); await ctx.close();
});

async function arrastar(p: Page, de: [number, number], para: [number, number], alt = false) {
  const [ax, ay] = await clientDe(p, de), [bx, by] = await clientDe(p, para);
  if (alt) await p.keyboard.down('Alt');
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 8 }); await p.mouse.up();
  if (alt) await p.keyboard.up('Alt');
  await p.waitForTimeout(250);
}
const posicao = async (p: Page, id: string) => (await documento(p)).tokens[id]!.position;
const diagMovimento = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { id: string; deslizando: boolean; trilha: number }[] } } }).__atlas.viewport().diagnosticoDasPecas());

test('movimento: na sessão a peça anda de célula em célula, a parede e a porta fechada recusam, a porta aberta deixa, e cada passo é uma entrada de histórico', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    s.store.executar({ tipo: "parede.adicionar", parede: a.parede });
    s.store.executar({ tipo: "abertura.adicionar", abertura: a.porta });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.peca });
  }`, {
    parede: { id: 'w1', path: [[12, 0], [12, 30]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, source: null },
    porta: { id: 'o1', wallId: 'w1', at: 0.5, width: 2, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' },
    peca: peca('hugo', 'Hugo', 11.25, 14.25),
  });
  await page.waitForTimeout(300);
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(300);
  // Parede: do outro lado, longe da porta.
  await arrastar(page, [11.25, 14.25], [12.75, 8.25]);
  assert.deepEqual(await posicao(page, 'hugo'), [11.25, 14.25], 'a parede recusou');
  await page.getByText('Tem uma parede no caminho.').first().waitFor({ timeout: 3000 });
  // Porta fechada.
  await arrastar(page, [11.25, 14.25], [12.75, 14.25]);
  assert.deepEqual(await posicao(page, 'hugo'), [11.25, 14.25], 'a porta fechada recusou');
  await page.getByText('A porta está fechada.').first().waitFor({ timeout: 3000 });
  // Alt = livre: atravessa a parede.
  await arrastar(page, [11.25, 14.25], [12.75, 8.25], true);
  assert.deepEqual(await posicao(page, 'hugo'), [12.75, 8.25], 'Alt anda livre');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(250);
  assert.deepEqual(await posicao(page, 'hugo'), [11.25, 14.25], 'desfazer devolve a peça');
  // Porta aberta: passa, e a peça olha para a direita.
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "o1", patch: { state: "open" } })');
  await arrastar(page, [11.25, 14.25], [12.75, 14.25]);
  assert.deepEqual(await posicao(page, 'hugo'), [12.75, 14.25]);
  assert.equal((await documento(page)).tokens.hugo!.facing, 'right');
  const rotulo = (await sessao(page, '(s) => s.rotuloDesfazer.value')) as string; assert.equal(rotulo, 'Mover peça');
  const d = (await diagMovimento(page))[0]!; assert.ok(d.deslizando || d.trilha > 0, 'a peça desliza e deixa trilha');
  // Setas: uma célula por vez, e a peça segue selecionada.
  await semFoco(page); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
  assert.deepEqual(await posicao(page, 'hugo'), [14.25, 14.25]);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250);
  assert.deepEqual(await posicao(page, 'hugo'), [14.25, 15.75]);
  // Em Construir as setas voltam ao passo fino e não encaixam.
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  assert.deepEqual(await posicao(page, 'hugo'), [14.25 + 0.75, 15.75]);
  assert.deepEqual(erros, []); await ctx.close();
});

test('lanterna: o inspetor põe a luz na peça, ela anda apontando para onde a peça foi, Q e E giram o facho, e remover a peça leva a luz', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s, p) => { s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p }); s.selecao.value = [{ colecao: "tokens", id: "hugo" }]; }', peca('hugo', 'Hugo', 11.25, 14.25));
  await page.click('[data-testid="aba-selecao"]');
  const seletor = page.locator('label.linha', { hasText: 'Lanterna' }).locator('select');
  await seletor.selectOption('lanterna'); await page.waitForTimeout(300);
  let m = await documento(page); const luz = Object.values(m.lights).find(l => l.ownerId === 'hugo')!;
  assert.ok(luz, 'a luz nasceu com a peça como dona'); assert.equal(m.tokens.hugo!.lightId, luz.id); assert.ok(luz.cone, 'lanterna é cone'); assert.deepEqual(luz.position, [11.25, 14.25]);
  assert.equal(Object.keys(m.lights).length, 1);
  // Trocar por uma vela troca a luz (uma só), e a vela é redonda.
  await seletor.selectOption('vela'); await page.waitForTimeout(300);
  m = await documento(page); assert.equal(Object.keys(m.lights).length, 1); assert.equal(Object.values(m.lights)[0]!.cone, null);
  await seletor.selectOption('lanterna'); await page.waitForTimeout(300);
  // Na sessão: andar para a direita aponta o facho para 0 rad; Q gira 45° para a esquerda; E volta.
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(300);
  await arrastar(page, [11.25, 14.25], [14.25, 14.25]);
  m = await documento(page); const l = Object.values(m.lights)[0]!;
  assert.deepEqual(m.tokens.hugo!.position, [14.25, 14.25]); assert.deepEqual(l.position, [14.25, 14.25]); assert.equal(l.cone!.direction, 0);
  await semFoco(page); await page.keyboard.press('q'); await page.waitForTimeout(250);
  assert.ok(Math.abs(Object.values((await documento(page)).lights)[0]!.cone!.direction + Math.PI / 4) < 1e-9, 'Q: -45°');
  await page.keyboard.press('e'); await page.waitForTimeout(250);
  assert.ok(Math.abs(Object.values((await documento(page)).lights)[0]!.cone!.direction) < 1e-9, 'E: de volta a 0');
  // Desfazer o movimento devolve a luz e a direção.
  await sessao(page, '(s) => { s.store.desfazer(); s.store.desfazer(); s.store.desfazer(); }'); await page.waitForTimeout(250);
  m = await documento(page); assert.deepEqual(Object.values(m.lights)[0]!.position, [11.25, 14.25]);
  // Remover a peça (em Construir) leva a lanterna junto.
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(300);
  await sessao(page, '(s) => s.store.executar({ tipo: "item.remover", colecao: "tokens", id: "hugo" })');
  assert.equal(Object.keys((await documento(page)).lights).length, 0);
  assert.deepEqual(erros, []); await ctx.close();
});
