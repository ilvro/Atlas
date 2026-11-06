import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) =>
  p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);

const cachoeirasAtivas = (p: Page) =>
  p.evaluate(() => (window as unknown as { __atlas: { viewport(): { contagemDeCachoeiras(): number } } }).__atlas.viewport().contagemDeCachoeiras());

const celulasDe = (x0: number, y0: number, x1: number, y1: number) => {
  const c: [number, number][] = [];
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) c.push([x, y]);
  return c;
};

/** Diferença média por canal entre duas capturas. */
const diferenca = (p: Page, pngA: Buffer, pngB: Buffer) => p.evaluate(async ([a64, b64]) => {
  const ler = async (b64: string) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
    return g.getImageData(0, 0, c.width, c.height).data;
  };
  const A = await ler(a64!), B = await ler(b64!);
  let t = 0;
  for (let i = 0; i < A.length; i += 4) t += Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!);
  return t / (A.length / 4);
}, [pngA.toString('base64'), pngB.toString('base64')]);

test('10.6d: cachoeira animada assa rocha e borda e anima listras, névoa no pé e espuma em Ilustrado e Pixel', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  await sessao(page, `(s) => {
    const r = s.doc.value.terrain.resolution;
    const retangulo = (x0, y0, x1, y1) => {
      const c = [];
      for (let y = Math.round(y0 / r); y < Math.round(y1 / r); y++)
        for (let x = Math.round(x0 / r); x < Math.round(x1 / r); x++)
          c.push([x, y]);
      return c;
    };
    s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0 } });
    s.store.executar({ tipo: "terreno.base", material: "lajes.gramadas" });
    s.store.executar({
      tipo: "terreno.pintar",
      material: "agua.rio",
      celulas: [...retangulo(16, 2, 20, 7.5), ...retangulo(13, 10, 23, 17)],
      suavizar: true
    });
    s.store.executar({
      tipo: "parede.adicionar",
      parede: {
        id: "escarpa-cachoeira",
        path: [[10, 8], [26, 8]],
        kind: "cliff",
        height: 3.5,
        thickness: 0.4,
        material: "rocha.cinza",
        blocks: { move: true, sight: false, light: false },
        drop: "a"
      }
    });
    s.store.executar({
      tipo: "item.adicionar",
      colecao: "props",
      item: {
        id: "cach1",
        source: { kind: "recipe", recipe: "cachoeira", seed: 42, params: { largura: 3.5, queda: 4.5 } },
        position: [18, 9.5],
        rotation: 0,
        scale: 1,
        elevation: "floor",
        wall: null,
        roomId: null,
        blocks: { move: true, sight: false },
        castsShadow: true,
        harmonize: true,
        interaction: null
      }
    });
  }`);
  await page.waitForFunction('window.__atlas.viewport()?.aguaAtiva() ?? false', null, { timeout: 15000 });
  await page.waitForTimeout(1000);

  assert.equal(await cachoeirasAtivas(page), 1, 'uma cachoeira animada ativa');

  mkdirSync('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/fase10-cachoeira.png' });

  // Recorte sobre o corpo e o pé da cachoeira e recorte longe da água
  const [cx0, cy0] = await clientDe(page, [16.5, 7.5]), [cx1, cy1] = await clientDe(page, [19.5, 13.5]);
  const clipCachoeira = { x: Math.min(cx0, cx1), y: Math.min(cy0, cy1), width: Math.abs(cx1 - cx0), height: Math.abs(cy1 - cy0) };

  const [lx0, ly0] = await clientDe(page, [2, 2]), [lx1, ly1] = await clientDe(page, [6, 6]);
  const clipLonge = { x: Math.min(lx0, lx1), y: Math.min(ly0, ly1), width: Math.abs(lx1 - lx0), height: Math.abs(ly1 - ly0) };

  const quadroA = await page.screenshot({ clip: clipCachoeira });
  const longeA = await page.screenshot({ clip: clipLonge });
  await page.waitForTimeout(450);
  const quadroB = await page.screenshot({ clip: clipCachoeira });
  const longeB = await page.screenshot({ clip: clipLonge });

  const diffCachoeira = await diferenca(page, quadroA, quadroB);
  const diffLonge = await diferenca(page, longeA, longeB);
  assert.ok(diffCachoeira > 1.5, `a cachoeira se mexe entre dois quadros (diff=${diffCachoeira.toFixed(2)})`);
  assert.equal(diffLonge, 0, 'fora da água e da cachoeira nada muda');

  // Estilo Pixel (4 quadros)
  await sessao(page, '(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { renderer: "pixel" } })');
  await page.waitForTimeout(1200);
  assert.equal(await cachoeirasAtivas(page), 1, 'cachoeira ativa no Pixel');
  await page.screenshot({ path: 'test-results/fase10-cachoeira-pixel.png' });

  const pxA = await page.screenshot({ clip: clipCachoeira });
  await page.waitForTimeout(400);
  const pxB = await page.screenshot({ clip: clipCachoeira });
  const diffPixel = await diferenca(page, pxA, pxB);
  assert.ok(diffPixel > 0.5, `a cachoeira anima em quadros no Pixel (diff=${diffPixel.toFixed(2)})`);

  assert.deepEqual(erros, []);
  await ctx.close();
});
