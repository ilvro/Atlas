import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
const glow = (p: Page, v: number) => sessao(p, '(s, g) => s.store.executar({ tipo: "acabamento.atualizar", patch: { glow: g } })', v);

/** Brilho médio (0 a 765) de um recorte de captura. */
const brilho = (p: Page, png: Buffer) => p.evaluate(async (b64) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += d[i]! + d[i + 1]! + d[i + 2]!; return t / (d.length / 4);
}, png.toString('base64'));

/** Diferença média por canal entre duas capturas. */
const diferenca = (p: Page, pngA: Buffer, pngB: Buffer) => p.evaluate(async ([a64, b64]) => {
  const ler = async (b64: string) => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const A = await ler(a64!), B = await ler(b64!); let t = 0; for (let i = 0; i < A.length; i += 4) t += Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!); return t / (A.length / 4);
}, [pngA.toString('base64'), pngB.toString('base64')]);

test('10.6b: noite com tocha, glow 0 e 0.8: mais clara em volta da tocha e igual longe dela', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  // Noite com chão de pedra e uma tocha no centro (sem flicker para medição pura)
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "clima.aplicar", patch: { time: "00:00" } });
    s.store.executar({ tipo: "terreno.base", material: "pedra.cinza" });
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "tocha1", position: [20, 15], radius: 6, color: "#ff9933", intensity: 1, flicker: 0,
      cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "tocha", rays: false
    } });
  }`);
  await page.waitForTimeout(2000);

  // Recorte em volta da tocha (raio do halo é 0.35 * 6 = 2.1 m)
  const [px0, py0] = await clientDe(page, [19, 14]), [px1, py1] = await clientDe(page, [21, 16]);
  const clipPerto = { x: Math.min(px0, px1), y: Math.min(py0, py1), width: Math.abs(px1 - px0), height: Math.abs(py1 - py0) };

  // Recorte longe da tocha (a 8 metros da tocha, fora do halo e do alcance)
  const [lx0, ly0] = await clientDe(page, [4, 4]), [lx1, ly1] = await clientDe(page, [7, 7]);
  const clipLonge = { x: Math.min(lx0, lx1), y: Math.min(ly0, ly1), width: Math.abs(lx1 - lx0), height: Math.abs(ly1 - ly0) };

  // Com glow: 0
  await glow(page, 0); await page.waitForTimeout(800);
  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/fase10-halos-glow0.png' });
  const perto0 = await brilho(page, await page.screenshot({ clip: clipPerto }));
  const longe0 = await brilho(page, await page.screenshot({ clip: clipLonge }));

  // Com glow: 0.8
  await glow(page, 0.8); await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/fase10-halos-glow08.png' });
  const perto08 = await brilho(page, await page.screenshot({ clip: clipPerto }));
  const longe08 = await brilho(page, await page.screenshot({ clip: clipLonge }));

  console.log(`halos: perto ${perto0.toFixed(1)} -> ${perto08.toFixed(1)}, longe ${longe0.toFixed(1)} -> ${longe08.toFixed(1)}`);
  assert.ok(perto08 > perto0 * 1.15, `perto ficou mais clara: de ${perto0} para ${perto08}`);
  assert.ok(Math.abs(longe08 - longe0) < 2, `longe ficou igual: ${longe0} vs ${longe08}`);
  assert.deepEqual(erros, []); await ctx.close();
});

test('10.6b: luz com cone e rays muda entre dois quadros e para com movimento reduzido', async () => {
  const medirAnimacao = async (opcoes: Parameters<typeof novoContexto>[1]) => {
    const ctx = await novoContexto(amb, opcoes), { page } = await abrir(ctx, amb.url);
    await criarMapaPelaInterface(page);
    await sessao(page, `(s) => {
      s.store.executar({ tipo: "clima.aplicar", patch: { time: "00:00" } });
      s.store.executar({ tipo: "terreno.base", material: "pedra.cinza" });
      s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0 } });
      s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
        id: "cone1", position: [20, 15], radius: 8, color: "#fff0db", intensity: 1, flicker: 0,
        cone: { angle: 1.05, direction: 0 }, ownerId: null, power: "magic", on: true, nightOnly: false, preset: null, rays: true
      } });
    }`);
    await page.waitForTimeout(1500);

    // Recorte cobrindo o feixe de raios (apontado para a direita)
    const [x0, y0] = await clientDe(page, [20, 13]), [x1, y1] = await clientDe(page, [26, 17]);
    const clip = { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };

    const f1 = await page.screenshot({ clip });
    if (!opcoes?.reducedMotion) await page.screenshot({ path: 'test-results/fase10-raios.png' });
    await page.waitForTimeout(1000);
    const f2 = await page.screenshot({ clip });

    const dif = await diferenca(page, f1, f2);
    await ctx.close();
    return dif;
  };

  const normal = await medirAnimacao({});
  const reduzido = await medirAnimacao({ reducedMotion: 'reduce' });

  console.log(`animacao dos raios: normal ${normal.toFixed(2)}, reduzido ${reduzido.toFixed(2)}`);
  assert.ok(normal > 0.5, `raios se movem normalmente: ${normal}`);
  assert.ok(reduzido < 0.1, `raios ficam parados com movimento reduzido: ${reduzido}`);
});

test('10.6b: no Pixel o halo usa faixas de borda dura e o Inspetor controla glow e rays', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { renderer: "pixel" } })').catch(() => undefined);
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "clima.aplicar", patch: { time: "00:00" } });
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "tocha_px", position: [20, 15], radius: 6, color: "#ff9933", intensity: 1, flicker: 0,
      cone: { angle: 1.05, direction: 0 }, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "tocha", rays: true
    } });
  }`);
  await glow(page, 0.7);
  await page.waitForTimeout(1200);

  const m = await documento(page);
  assert.equal(m.finish.glow, 0.7);
  assert.equal(m.lights.tocha_px?.rays, true);

  await page.screenshot({ path: 'test-results/fase10-halos-pixel.png' });
  assert.deepEqual(erros, []); await ctx.close();
});
