import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) =>
  p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);

type JanelaAtlas = { __atlas: { viewport(): { enquadrar(): void; pintando: number } | null } };
const esperarPintura = async (p: Page) => {
  await p.waitForTimeout(350);
  await p.waitForFunction(() => ((window as unknown as JanelaAtlas).__atlas.viewport()?.pintando ?? 1) === 0, null, { timeout: 15_000 });
  await p.waitForTimeout(150);
};

async function corEm(p: Page, pt: [number, number]): Promise<{ r: number; g: number; b: number; luma: number }> {
  const [x, y] = await clientDe(p, pt);
  const png = await p.screenshot({ clip: { x: Math.max(0, x - 4), y: Math.max(0, y - 4), width: 8, height: 8 } });
  return p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let r = 0, gg = 0, b = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]!; gg += d[i + 1]!; b += d[i + 2]!; }
    r /= n; gg /= n; b /= n;
    return { r, g: gg, b, luma: 0.299 * r + 0.587 * gg + 0.114 * b };
  }, png.toString('base64'));
}

test('cômodo circular: centro tem cor do piso, 4,5 m fora tem terreno e 3,9 m a 45° tem face escura', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "limites.atualizar", largura: 30, altura: 20 });
    s.store.executar({ tipo: "terreno.base", material: "grama" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 0.9 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 0.9 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    const pts = [];
    for (let i = 0; i < 24; i++) {
      const ang = -(2 * Math.PI * i) / 24;
      pts.push([+(15 + 4 * Math.cos(ang)).toFixed(4), +(10 + 4 * Math.sin(ang)).toFixed(4)]);
    }
    s.store.executar({
      tipo: "comodo.criar",
      id: "torre",
      nome: "Torre Redonda",
      funcao: null,
      celulas: [],
      outline: pts,
      piso: { material: "marmore.branco", seed: 1 },
      papel: { material: "papel.liso-claro", seed: 1 },
      telhado: null,
    });
    s.store.executar({ tipo: "comodo.atualizar", id: "torre", patch: { wallStyle: "box" } });
  }`);

  await page.evaluate(() => (window as unknown as JanelaAtlas).__atlas.viewport()?.enquadrar());
  await esperarPintura(page);

  const centro = await corEm(page, [15, 10]);
  const fora = await corEm(page, [19.5, 10]);
  const d45 = 3.9 * Math.SQRT1_2;
  const face45 = await corEm(page, [15 + d45, 10 + d45]);

  // Piso de mármore branco no centro é bem mais claro que grama do terreno fora
  assert.ok(centro.luma > fora.luma + 30, `centro (${centro.luma.toFixed(1)}) deve ter piso claro e superar terreno fora (${fora.luma.toFixed(1)})`);
  // Terreno externo é predominantemente verde (grama), diferente do mármore neutro
  assert.ok(fora.g > fora.r + 10, `fora (${fora.r.toFixed(1)}, ${fora.g.toFixed(1)}) deve ter cor esverdeada do terreno`);
  // Face oblíqua a 3,9 m (45°) é visivelmente mais escura que o centro iluminado do piso
  assert.ok(face45.luma < centro.luma - 15, `face a 3,9 m a 45° (${face45.luma.toFixed(1)}) deve ser mais escura que centro (${centro.luma.toFixed(1)})`);

  assert.deepEqual(erros, []);
  await ctx.close();
});
