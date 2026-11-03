import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { verificarCasa } from '../unit/apoio-casa.ts';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
async function ferramenta(p: Page, id: string) { await p.click(`[data-testid="ferramenta-${id}"]`); await p.waitForTimeout(350); }
async function retangulo(p: Page, a: [number, number], b: [number, number]) {
  const [ax, ay] = await clientDe(p, a), [bx, by] = await clientDe(p, b);
  await p.keyboard.down('Shift'); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up(); await p.keyboard.up('Shift');
}
const fantasma = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { contagemDoFantasma(): number } } }).__atlas.viewport().contagemDoFantasma());

test('fantasma da proposta: o que a prévia acrescenta aparece (2 objetos e 1 luz) e `null` limpa', async () => {
  const ctx = await novoContexto(amb, {}, true), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await ferramenta(page, 'selecionar');
  await page.evaluate(() => {
    const w = window as unknown as { __atlas: { sessao(): { doc: { value: Record<string, any> } }; viewport(): { mostrarProposta(m: unknown): void } } };
    const previa = structuredClone(w.__atlas.sessao().doc.value);
    const obj = (id: string, recipe: string, x: number) => ({ id, source: { kind: 'recipe', recipe, seed: 3, params: {} }, position: [x, 9], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true });
    previa.props = { n1: obj('n1', 'cama.solteiro', 8.5), n2: obj('n2', 'mesinha', 10.5) };
    previa.lights = { l1: { id: 'l1', position: [12, 9], radius: 5, color: '#ffb36b', intensity: 1, flicker: 0.1, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, preset: null } };
    w.__atlas.viewport().mostrarProposta(previa);
  });
  await page.waitForTimeout(500);
  assert.equal(await fantasma(page), 3);
  assert.deepEqual(Object.keys((await documento(page)).props), [], 'o fantasma não toca no documento');
  await page.evaluate(() => (window as unknown as { __atlas: { viewport(): { mostrarProposta(m: null): void } } }).__atlas.viewport().mostrarProposta(null));
  assert.equal(await fantasma(page), 0);
  assert.deepEqual(erros, []); await ctx.close();
});

async function clicar(p: Page, mundo: [number, number]) { const [x, y] = await clientDe(p, mundo); await p.mouse.click(x, y); await p.waitForTimeout(150); }
const historico = (p: Page): Promise<string[]> => sessao(p, '(s) => [...s.store.historico]') as Promise<string[]>;
async function renomear(p: Page, mundo: [number, number], nome: string) {
  await ferramenta(p, 'selecionar'); await clicar(p, mundo);
  await p.click('[data-testid="aba-selecao"]');
  const campo = p.getByLabel('Nome', { exact: true }); await campo.fill(nome); await campo.press('Enter'); await p.waitForTimeout(700);
}

test('pílula: renomear um cômodo para "Cozinha" oferece a função, com fantasma; aceitar é uma entrada; desfazer volta; dispensar não volta', async () => {
  const ctx = await novoContexto(amb, {}, true), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  const antes = (await documento(page)).rooms; const id = Object.keys(antes)[0]!;
  await renomear(page, [10.5, 9.75], 'Cozinha');
  const pilula = page.locator('[data-testid="pilula"]'); await pilula.waitFor({ timeout: 3000 });
  assert.match(await pilula.innerText(), /Usar como Cozinha\?/);
  assert.ok(await fantasma(page) >= 1, 'o fantasma mostra o cômodo que muda');
  const n = (await historico(page)).length;
  await page.click('[data-testid="pilula-aceitar"]'); await page.waitForTimeout(300);
  let sala = (await documento(page)).rooms[id]!;
  assert.equal(sala.function, 'cozinha'); assert.equal(sala.floor.material, 'ladrilho.cozinha'); assert.equal(sala.wallpaper?.material, 'papel.listras-creme');
  assert.equal((await historico(page)).length, n + 1, 'uma entrada de histórico'); assert.equal((await historico(page)).at(-1), 'Usar como Cozinha');
  await page.waitForTimeout(700); assert.match(await pilula.innerText(), /Pôr a porta de entrada\?/, 'a função já está certa: a próxima da fila é a porta de entrada (único cômodo)');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(700);
  sala = (await documento(page)).rooms[id]!; assert.notEqual(sala.function, 'cozinha');
  // Depois de desfazer, a sugestão de função volta; dispensar a tira e ela não volta (a próxima da fila aparece).
  await pilula.waitFor({ timeout: 3000 }); assert.match(await pilula.innerText(), /Usar como Cozinha\?/);
  await page.click('[data-testid="pilula-dispensar"]'); await page.waitForTimeout(800);
  await clicar(page, [30, 25]); await clicar(page, [10.5, 9.75]); await page.waitForTimeout(800);
  assert.ok(!/Usar como/.test(await pilula.innerText().catch(() => '')), 'a função dispensada não volta');
  assert.deepEqual(erros, []); await ctx.close();
});

test('pílulas: renomear para "Quarto" e aceitar função e mobília gera um quarto mobiliado, com fantasma antes, desfazível em duas entradas', async () => {
  const ctx = await novoContexto(amb, {}, true), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  const id = Object.keys((await documento(page)).rooms)[0]!;
  await renomear(page, [10.5, 9.75], 'Quarto');
  const pilula = page.locator('[data-testid="pilula"]'); await pilula.waitFor({ timeout: 3000 });
  assert.match(await pilula.innerText(), /Usar como Quarto\?/);
  const n = (await historico(page)).length;
  await page.click('[data-testid="pilula-aceitar"]');
  await page.waitForFunction(() => /porta de entrada/.test(document.querySelector('[data-testid="pilula"]')?.textContent ?? ''), null, { timeout: 4000 });
  await page.click('[data-testid="pilula-dispensar"]');
  await page.waitForFunction(() => /Mobiliar/.test(document.querySelector('[data-testid="pilula"]')?.textContent ?? ''), null, { timeout: 4000 });
  await page.waitForTimeout(500);
  assert.ok(await fantasma(page) >= 3, `o fantasma mostra a mobília antes de aceitar (${await fantasma(page)})`);
  assert.deepEqual(Object.keys((await documento(page)).props), [], 'ainda nada no documento');
  await page.click('[data-testid="pilula-aceitar"]'); await page.waitForTimeout(500);
  const m = await documento(page), receitas = Object.values(m.props).map(o => (o.source as { recipe: string }).recipe);
  await page.screenshot({ path: 'test-results/fase5-quarto.png' });
  assert.ok(receitas.some(r => r.startsWith('cama.')), 'tem cama'); assert.ok(Object.keys(m.props).length >= 3);
  assert.equal(m.rooms[id]!.function, 'quarto');
  assert.deepEqual((await historico(page)).slice(n), ['Usar como Quarto', 'Mobiliar a Quarto']);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  assert.deepEqual(Object.keys((await documento(page)).props), [], 'um desfazer tira a mobília inteira'); assert.equal((await documento(page)).rooms[id]!.function, 'quarto');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  assert.notEqual((await documento(page)).rooms[id]!.function, 'quarto');
  assert.deepEqual(erros, []); await ctx.close();
});

test('pincel de espalhar: uma pincelada sobre a escrivaninha põe papéis (elevation table) em uma entrada; desfazer tira todos; Alt apaga', async () => {
  const ctx = await novoContexto(amb, {}, true), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  const id = Object.keys((await documento(page)).rooms)[0]!;
  await sessao(page, '(s, id) => s.store.executar({ tipo: "item.adicionar", colecao: "props", item: { id: "mesa", source: { kind: "recipe", recipe: "escrivaninha", seed: 1, params: {} }, position: [10.5, 7.35], rotation: 0, scale: 1, elevation: "floor", wall: null, roomId: id, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true } })', id);
  await ferramenta(page, 'selecionar'); await clicar(page, [30, 25]);
  await page.keyboard.press('s'); await page.waitForTimeout(350);
  assert.equal(await page.locator('[data-testid="espalhar-papelada"]').count(), 1, 'a biblioteca lista os conjuntos');
  const n = (await historico(page)).length;
  const [ax, ay] = await clientDe(page, [9.9, 7.35]), [bx, by] = await clientDe(page, [11.1, 7.35]);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
  const m = await documento(page), papeis = Object.values(m.props).filter(o => o.id !== 'mesa');
  assert.ok(papeis.length >= 2, `espalhou ${papeis.length}`);
  for (const o of papeis) { assert.equal(o.elevation, 'table'); assert.ok(['papeis', 'livros.pilha'].includes((o.source as { recipe: string }).recipe)); assert.ok(o.position[0] > 9.7 && o.position[0] < 11.3 && o.position[1] > 6.9 && o.position[1] < 7.8); }
  assert.equal((await historico(page)).length, n + 1, 'uma pincelada, uma entrada'); assert.equal((await historico(page)).at(-1), 'Espalhar');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  assert.deepEqual(Object.keys((await documento(page)).props), ['mesa'], 'desfazer tira todos');
  await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(300);
  assert.ok(Object.keys((await documento(page)).props).length >= 3);
  // Alt + arrastar remove os do conjunto dentro do pincel (a escrivaninha, que não é do conjunto, fica).
  await page.keyboard.down('Alt'); await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt'); await page.waitForTimeout(400);
  assert.deepEqual(Object.keys((await documento(page)).props), ['mesa']);
  assert.deepEqual(erros, []); await ctx.close();
});

test('fase 5: três cômodos viram uma casa (pintar, nomear, aceitar as pílulas até acabarem, desfazer e refazer, e à noite)', async () => {
  const ctx = await novoContexto(amb, {}, true), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo');
  await retangulo(page, [3.75, 3.75], [8.25, 8.25]); await retangulo(page, [9.75, 3.75], [14.25, 8.25]); await retangulo(page, [3.75, 9.75], [8.25, 12.75]);
  const centros: [string, [number, number]][] = [['Sala', [6, 6]], ['Cozinha', [12, 6]], ['Quarto', [6, 11.25]]];
  assert.equal(Object.keys((await documento(page)).rooms).length, 3);
  for (const [nome, centro] of centros) await renomear(page, centro, nome);
  const base = (await historico(page)).length;
  // Aceita as pílulas, cômodo por cômodo, até uma volta inteira sem nenhuma.
  let aceitas = 0;
  for (let volta = 0; volta < 6; volta++) {
    let andou = false;
    for (const [, centro] of centros) {
      await ferramenta(page, 'selecionar'); await clicar(page, centro); await page.waitForTimeout(650);
      for (let i = 0; i < 6 && await page.locator('[data-testid="pilula"]').count(); i++) {
        await page.click('[data-testid="pilula-aceitar"]'); aceitas++; andou = true; await page.waitForTimeout(650);
      }
    }
    if (!andou) break;
  }
  const casa = await documento(page);
  assert.ok(aceitas >= 8, `${aceitas} sugestões aceitas`);
  assert.equal((await historico(page)).length - base, aceitas, 'uma entrada de histórico por pílula');
  verificarCasa(casa, { Sala: 'sala', Cozinha: 'cozinha', Quarto: 'quarto' });
  await ferramenta(page, 'selecionar'); await clicar(page, [40, 25]); await page.waitForTimeout(500);
  await page.screenshot({ path: 'test-results/fase5-casa.png' });
  console.log(`# casa pela interface: ${aceitas} pílulas, ${Object.keys(casa.props).length} objetos, ${Object.keys(casa.lights).length} luzes, ${Object.keys(casa.openings).length} portas`);

  // Desfazer a última pílula e refazer.
  const luzes = Object.keys(casa.lights).length, objetos = Object.keys(casa.props).length, portas = Object.keys(casa.openings).length;
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300);
  const menos = await documento(page);
  assert.ok(Object.keys(menos.lights).length < luzes || Object.keys(menos.props).length < objetos || Object.keys(menos.openings).length < portas, 'desfazer tira o que a última pílula pôs');
  await page.keyboard.press('Control+Shift+z'); await page.waitForTimeout(300);
  assert.deepEqual(await documento(page).then(d => [Object.keys(d.lights).length, Object.keys(d.props).length, Object.keys(d.openings).length]), [luzes, objetos, portas]);
  // À noite as luzes acesas é que iluminam a casa.
  await page.click('[data-testid="aba-mapa"]'); await page.click('[data-testid="clima-noite"]'); await page.waitForTimeout(2200);
  await page.screenshot({ path: 'test-results/fase5-casa-noite.png' });
  assert.deepEqual(erros, []); await ctx.close();
});

test('sugestões desligadas: nenhuma pílula; ligar pela aba Mapa traz a pílula de volta, e a preferência vale ao recarregar', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);       // sem `true`: as sugestões começam desligadas
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await renomear(page, [10.5, 9.75], 'Cozinha'); await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-testid="pilula"]').count(), 0, 'desligadas: nada aparece');
  await page.click('[data-testid="aba-mapa"]');
  await page.getByLabel('Sugestões do assistente').check();
  await clicar(page, [30, 25]); await clicar(page, [10.5, 9.75]);
  await page.locator('[data-testid="pilula"]').waitFor({ timeout: 4000 });
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas:sugestoes')), '1');
  assert.deepEqual(erros, []); await ctx.close();
});
