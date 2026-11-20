import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('O9: no modo Vários, arrastar com área planta um bosque variado, e Ctrl+Z desfaz tudo de uma vez', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await page.click('[data-testid="ferramenta-objeto"]');
  await page.evaluate(() => {
    const s = (window as unknown as { __atlas: { sessao(): { pincel: { value: { objeto: Record<string, unknown> } } } } }).__atlas.sessao();
    s.pincel.value = { ...s.pincel.value, objeto: { ...s.pincel.value.objeto, item: 'casa:arvore-5m', familia: 'arvore', varianteAleatoria: true, colocar: 'varios', area: 4, densidade: 1, selecionarAoPor: true } } as never;
  });
  const [x0, y0] = await clientDe(page, [8, 12]), [x1, y1] = await clientDe(page, [32, 12]);
  await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: 30 }); await page.mouse.up();
  const props = Object.values((await documento(page)).props);
  assert.ok(props.length >= 6, `um bosque, não uma árvore (${props.length})`);
  assert.ok(new Set(props.map(o => o.source.kind === 'asset' ? o.source.assetId : '')).size > 1, 'variantes diferentes');
  for (const o of props) assert.ok(o.position[0] > 3 && o.position[0] < 37 && Math.abs(o.position[1] - 12) <= 5, 'perto do caminho');
  await page.keyboard.press('Control+z');
  assert.equal(Object.keys((await documento(page)).props).length, 0, 'um só desfazer');
  assert.deepEqual(erros, []); await ctx.close();
});
