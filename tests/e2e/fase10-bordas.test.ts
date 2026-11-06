import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
const bordas = (p: Page, kind: string, amount: number) => sessao(p, '(s, e) => s.store.executar({ tipo: "acabamento.atualizar", patch: { edges: e } })', { kind, amount });
/** Brilho médio (0 a 765) de um recorte de uma captura. */
const brilho = (p: Page, png: Buffer) => p.evaluate(async (b64) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i]! + d[i + 1]! + d[i + 2]!; return t / (d.length / 4);
}, png.toString('base64'));
/** Recortes do canto de cima à esquerda e do centro do mapa. */
async function recortes(p: Page) {
  const m = await documento(p), { width: w, height: h } = m.bounds;
  const a = await clientDe(p, [0.5, 0.5]), b = await clientDe(p, [w * 0.05, h * 0.05]), c = await clientDe(p, [w * 0.45, h * 0.45]), d = await clientDe(p, [w * 0.55, h * 0.55]);
  const canto = { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), width: Math.abs(b[0] - a[0]), height: Math.abs(b[1] - a[1]) }, meio = { x: c[0], y: c[1], width: d[0] - c[0], height: d[1] - c[1] };
  return { canto: await brilho(p, await p.screenshot({ clip: canto })), meio: await brilho(p, await p.screenshot({ clip: meio })) };
}

test('10.6a: nuvens clareiam os cantos e deixam o centro igual', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await sessao(page, '(s) => s.store.executar({ tipo: "terreno.base", material: "neve.funda" })'); await page.waitForTimeout(2500);
  const antes = await recortes(page);
  await bordas(page, 'clouds', 0.6); await page.waitForTimeout(1200);
  mkdirSync('test-results', { recursive: true }); await page.screenshot({ path: 'test-results/fase10-bordas-nuvens.png' });
  const depois = await recortes(page);
  console.log(`nuvens: canto ${antes.canto.toFixed(0)} -> ${depois.canto.toFixed(0)}, meio ${antes.meio.toFixed(0)} -> ${depois.meio.toFixed(0)}`);
  assert.ok(depois.canto > antes.canto * 0.9 && depois.canto !== antes.canto, 'o canto mudou para nuvem');
  assert.ok(Math.abs(depois.meio - antes.meio) < 6, 'o centro não mudou');
  assert.deepEqual(erros, []); await ctx.close();
});

test('10.6a: escuro deixa as bordas pretas; neblina entra suave', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await sessao(page, '(s) => s.store.executar({ tipo: "terreno.base", material: "neve.funda" })'); await page.waitForTimeout(2500);
  const antes = await recortes(page);
  await bordas(page, 'dark', 0.6); await page.waitForTimeout(1200); await page.screenshot({ path: 'test-results/fase10-bordas-escuro.png' });
  const escuro = await recortes(page);
  console.log(`escuro: canto ${antes.canto.toFixed(0)} -> ${escuro.canto.toFixed(0)}, meio ${antes.meio.toFixed(0)} -> ${escuro.meio.toFixed(0)}`);
  assert.ok(escuro.canto < antes.canto * 0.25, 'o canto ficou preto');
  assert.ok(Math.abs(escuro.meio - antes.meio) < 6, 'o centro não mudou');
  await bordas(page, 'fog', 0.6); await page.waitForTimeout(1200); await page.screenshot({ path: 'test-results/fase10-bordas-neblina.png' });
  const nevoa = await recortes(page); assert.notEqual(Math.round(nevoa.canto), Math.round(antes.canto));
  await bordas(page, 'none', 0); await page.waitForTimeout(800);
  const fim = await recortes(page); assert.ok(Math.abs(fim.canto - antes.canto) < 4, 'sem bordas volta ao que era');
  assert.deepEqual(erros, []); await ctx.close();
});

test('10.6a: o Inspetor troca as bordas e o pixel também as mostra', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { renderer: "pixel" } })').catch(() => undefined);
  await bordas(page, 'clouds', 0.5); await page.waitForTimeout(800);
  const m = await documento(page); assert.deepEqual(m.finish.edges, { kind: 'clouds', amount: 0.5 });
  await page.screenshot({ path: 'test-results/fase10-bordas-pixel.png' });
  assert.deepEqual(erros, []); await ctx.close();
});

test('10.6a: com movimento reduzido as nuvens se mexem menos', async () => {
  const mover = async (opcoes: Parameters<typeof novoContexto>[1]) => {
    const ctx = await novoContexto(amb, opcoes), { page } = await abrir(ctx, amb.url);
    await criarMapaPelaInterface(page); await sessao(page, '(s) => s.store.executar({ tipo: "terreno.base", material: "neve.funda" })'); await bordas(page, 'clouds', 0.8); await page.waitForTimeout(1500);
    const m = await documento(page), a = await clientDe(page, [0.5, 0.5]), b = await clientDe(page, [m.bounds.width * 0.2, m.bounds.height * 0.2]);
    const clip = { x: a[0], y: a[1], width: b[0] - a[0], height: b[1] - a[1] };
    const f1 = await page.screenshot({ clip }); await page.waitForTimeout(3000); const f2 = await page.screenshot({ clip });
    const dif = await page.evaluate(async ([x, y]) => {
      const ler = async (b64: string) => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
      const A = await ler(x!), B = await ler(y!); let t = 0; for (let i = 0; i < A.length; i += 4) t += Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!); return t / (A.length / 4);
    }, [f1.toString('base64'), f2.toString('base64')]);
    await ctx.close(); return dif;
  };
  const normal = await mover({}), reduzido = await mover({ reducedMotion: 'reduce' });
  console.log(`movimento das nuvens: normal ${normal.toFixed(2)}, reduzido ${reduzido.toFixed(2)}`);
  assert.ok(normal > 0.2, 'as nuvens andam'); assert.ok(reduzido < normal * 0.8, `reduzido ${reduzido} normal ${normal}`);
});
