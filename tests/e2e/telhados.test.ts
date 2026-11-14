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

const peca = (id: string, nome: string, x: number, y: number) => ({
  id, name: nome, portrait: null, sprite: null, facing: 'down', position: [x, y], size: 1,
  player: true, vision: { radius: 20, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [],
});

test('penumbra dos interiores: ao meio-dia, cômodo coberto sem luz fica mais escuro que a rua e acende com lamparina', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    const celulas = []; for (let y = 4; y < 8; y++) for (let x = 6; x < 10; x++) celulas.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 1 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    s.store.executar({ tipo: "comodo.criar", id: "casa", nome: "Casa", funcao: "sala", piso: { material: "areia", seed: 1 }, papel: null, telhado: "telha.barro", celulas });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.dentro });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.fora });
  }`, { dentro: peca('p1', 'Dentro', 9.75, 6.75), fora: peca('p2', 'Fora', 3.75, 9.75) });
  await page.waitForTimeout(800);

  await page.click('[data-testid="modo-sessao"]');
  await page.waitForTimeout(400);
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(900);

  const centro: [[number, number], [number, number]] = [[11.5, 8.5], [13.0, 10.0]];
  const rua: [[number, number], [number, number]] = [[5.0, 8.5], [6.5, 10.0]];

  const bRua = await brilho(page, ...rua);
  const bCentroEscuro = await brilho(page, ...centro);
  assert.ok(bCentroEscuro <= bRua * 0.7, `interior sem luz (${bCentroEscuro.toFixed(1)}) deve ficar >= 30% mais escuro que a rua (${bRua.toFixed(1)})`);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "l1", position: [12.25, 9.25], radius: 6, color: "#ffb36b", intensity: 1.2,
      flicker: 0, cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "lamparina", rays: false
    } });
  }`);
  await page.waitForTimeout(700);

  const bCentroComLuz = await brilho(page, ...centro);
  assert.ok(bCentroComLuz > bCentroEscuro * 1.3, `com lamparina dentro (${bCentroComLuz.toFixed(1)}), o centro fica bem mais claro que sem luz (${bCentroEscuro.toFixed(1)})`);
  assert.deepEqual(erros, []);
  await ctx.close();
});
