import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) =>
  p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);

async function brilho(p: Page, a: [number, number], b: [number, number]): Promise<number> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({
    clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) },
  });
  return p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let soma = 0;
    for (let i = 0; i < d.length; i += 4) soma += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    return soma / (d.length / 4);
  }, png.toString('base64'));
}

type JanelaAtlas = { __atlas: { viewport(): { enquadrar(): void; pintando: number; tintDeObjeto(id: string): number | null } | null } };
const esperarPintura = async (p: Page) => {
  await p.waitForTimeout(350);
  await p.waitForFunction(() => ((window as unknown as JanelaAtlas).__atlas.viewport()?.pintando ?? 1) === 0, null, { timeout: 15_000 });
  await p.waitForTimeout(150);
};

test('relevo: metade a −25 m fica >= 20% mais escura, árvore recebe tint e clima altera o tom', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "limites.atualizar", largura: 30, altura: 20 });
    s.store.executar({ tipo: "terreno.base", material: "grama" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 0.9 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    // Metade direita (x >= 15 m -> coluna >= 60 em res=0.25) rebaixada para -25 m
    const celulas = [];
    for (let y = 0; y < 80; y++) for (let x = 60; x < 120; x++) celulas.push([x, y]);
    s.store.executar({ tipo: "relevo.pintar", altura: -25, celulas });
    s.store.executar({
      tipo: "item.adicionar",
      colecao: "props",
      item: {
        id: "arvore_baixa",
        source: { kind: "recipe", recipe: "arvore", seed: 1, params: {} },
        position: [24, 10],
        rotation: 0,
        scale: 1,
        elevation: "floor",
        wall: null,
        roomId: null,
        blocks: { move: true, sight: true },
        castsShadow: true,
        harmonize: false,
        interaction: null,
      },
    });
  }`);

  await page.evaluate(() => (window as unknown as JanelaAtlas).__atlas.viewport()!.enquadrar());
  await esperarPintura(page);

  const bAlta = await brilho(page, [4, 5], [12, 15]);
  const bBaixa = await brilho(page, [18, 5], [22, 15]);
  assert.ok(bBaixa <= bAlta * 0.8, `metade baixa (${bBaixa.toFixed(1)}) deve ficar >= 20% abaixo da alta (${bAlta.toFixed(1)})`);

  const tintDia = await page.evaluate(() => (window as unknown as JanelaAtlas).__atlas.viewport()!.tintDeObjeto('arvore_baixa'));
  assert.ok(tintDia !== null && tintDia !== 0xffffff, `árvore na metade baixa deve ter tint != 0xffffff, obteve ${tintDia}`);

  // Trocar o clima refaz o tom da metade baixa e dos objetos
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "crepusculo", time: "18:30", ambient: { color: "#4a5c8a", intensity: 0.5 }, sun: { angle: 1.57, color: "#ff9955", intensity: 0.4 } } });
  }`);
  await esperarPintura(page);

  const tintNoite = await page.evaluate(() => (window as unknown as JanelaAtlas).__atlas.viewport()!.tintDeObjeto('arvore_baixa'));
  assert.notEqual(tintNoite, tintDia, 'trocar o clima deve recalcular o tint do objeto no relevo');
  assert.deepEqual(erros, []);
  await ctx.close();
});
