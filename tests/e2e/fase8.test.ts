import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { PALETAS_PIXEL } from '../../src/domain/paletas.ts';
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
const camera = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { camera: { x: number; y: number; zoom: number } } } }).__atlas.viewport().camera);

/** As cores (#rrggbb) que aparecem num retângulo do mundo, lidas dos pixels da tela. */
async function coresEm(p: Page, a: [number, number], b: [number, number]): Promise<Set<string>> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({ clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) } });
  const lista = await p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data, vistas = new Set<string>();
    for (let i = 0; i < d.length; i += 4) vistas.add('#' + [d[i]!, d[i + 1]!, d[i + 2]!].map(v => v.toString(16).padStart(2, '0')).join(''));
    return [...vistas];
  }, png.toString('base64'));
  return new Set(lista);
}

test('estilo Pixel: trocar na aba Mapa pixeliza a cena na paleta (no máximo 32 cores), desfazer volta ao Ilustrado, e a câmera fica na grade de pixels', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await page.click('[data-testid="aba-mapa"]');
  await page.getByLabel('Ver atmosfera no editor').uncheck();      // sem acabamento: só a paleta
  await page.waitForTimeout(900);
  const amostra: [[number, number], [number, number]] = [[7.5, 7.5], [13.5, 12]];
  assert.ok((await coresEm(page, ...amostra)).size > 32, 'o Ilustrado tem muitas cores');

  await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(900);
  const doc = await documento(page);
  assert.equal(doc.style.renderer, 'pixel');
  const paleta = new Set(PALETAS_PIXEL[0]!.cores.map(c => c.toLowerCase()));
  const cores = await coresEm(page, ...amostra);
  assert.ok(cores.size <= 32 && cores.size >= 3, `no Pixel a amostra tem ${cores.size} cores`);
  for (const c of cores) assert.ok(paleta.has(c), `${c} não é da paleta`);
  await page.screenshot({ path: 'test-results/fase8-pixelizada.png' });

  // A câmera: zoom em múltiplo do passo (16 px / 1,5 m) e posição em pixels inteiros, depois de zoom e arrasto.
  const passo = 16 / doc.grid.size;
  const [cx, cy] = await clientDe(page, [10, 9]);
  await page.mouse.move(cx, cy); await page.mouse.wheel(0, -120); await page.waitForTimeout(150); await page.mouse.wheel(0, -40); await page.waitForTimeout(150);
  await page.mouse.move(cx, cy); await page.mouse.down({ button: 'middle' }); await page.mouse.move(cx + 37.4, cy + 21.6, { steps: 5 }); await page.mouse.up({ button: 'middle' }); await page.waitForTimeout(150);
  const cam = await camera(page), dpr = await page.evaluate(() => devicePixelRatio);
  assert.ok(Math.abs(cam.zoom / passo - Math.round(cam.zoom / passo)) < 1e-6, `zoom ${cam.zoom} não é múltiplo de ${passo}`);
  assert.ok(Math.abs(cam.x * dpr - Math.round(cam.x * dpr)) < 1e-6 && Math.abs(cam.y * dpr - Math.round(cam.y * dpr)) < 1e-6, `câmera fora da grade: ${cam.x}, ${cam.y}`);
  assert.ok((await coresEm(page, ...amostra)).size <= 32, 'continua na paleta depois de mover');

  // Outra paleta e sem dithering: as cores vêm da nova paleta.
  await page.getByLabel('Paleta').selectOption('fantasia-quente'); await page.getByLabel('Dithering').selectOption('none'); await page.waitForTimeout(500);
  const quente = new Set(PALETAS_PIXEL[2]!.cores.map(c => c.toLowerCase()));
  for (const c of await coresEm(page, ...amostra)) assert.ok(quente.has(c), `${c} não é da paleta quente`);

  // Desfazer cada troca de estilo; no fim, o Ilustrado de volta.
  await semFoco(page);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(250); }
  assert.equal((await documento(page)).style.renderer, 'illustrated');
  await page.waitForTimeout(500);
  assert.ok((await coresEm(page, ...amostra)).size > 32, 'de volta ao Ilustrado, com as muitas cores');
  assert.deepEqual(erros, []); await ctx.close();
});
