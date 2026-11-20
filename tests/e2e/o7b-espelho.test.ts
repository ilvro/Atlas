import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const exec = (p: Page, cmd: unknown) => p.evaluate(`(() => window.__atlas.sessao().store.executar(${JSON.stringify(cmd)}))()`);
const objeto = (id: string, x: number, y: number, fonte: unknown, extra: object = {}) => ({
  tipo: 'item.adicionar', colecao: 'props',
  item: { id, source: fonte, position: [x, y], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null, ...extra },
});
const diferenca = (p: Page, a: Buffer, b: Buffer) => p.evaluate(async ([a64, b64]) => {
  const ler = async (s: string) => { const img = new Image(); img.src = `data:image/png;base64,${s}`; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
  const A = await ler(a64!), B = await ler(b64!); let t = 0; for (let i = 0; i < A.length; i += 4) t += Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!); return t / (A.length / 4);
}, [a.toString('base64'), b.toString('base64')]);

test('O7b: espelho e opacidade aparecem no mapa (receita e imagem da coleção)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const rec = { kind: 'recipe', recipe: 'escrivaninha', seed: 5, params: {} }, arv = { kind: 'asset', assetId: 'casa:arvore-5m' };
  await exec(page, objeto('d0', 10, 10, rec)); await exec(page, objeto('d1', 16, 10, rec, { flip: true })); await exec(page, objeto('d2', 22, 10, rec, { flip: true, opacity: 0.5 }));
  await exec(page, objeto('a0', 10, 20, arv)); await exec(page, objeto('a1', 17, 20, arv, { flip: true })); await exec(page, objeto('a2', 24, 20, arv, { flip: true, opacity: 0.5 }));
  await page.waitForTimeout(3500);
  const recorte = async (x: number, y: number, r: number) => { const [x0, y0] = await clientDe(page, [x - r, y - r]), [x1, y1] = await clientDe(page, [x + r, y + r]); return page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } }); };
  mkdirSync('test-results', { recursive: true });
  const [x0, y0] = await clientDe(page, [6, 6]), [x1, y1] = await clientDe(page, [29, 25]);
  await page.screenshot({ path: 'test-results/o7b-espelho.png', clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  assert.ok(await diferenca(page, await recorte(10, 10, 2.5), await recorte(16, 10, 2.5)) > 1, 'a escrivaninha espelhada difere da normal');
  assert.ok(await diferenca(page, await recorte(16, 10, 2.5), await recorte(22, 10, 2.5)) > 1, 'a opacidade muda o desenho');
  assert.ok(await diferenca(page, await recorte(10, 20, 4), await recorte(17, 20, 4)) > 0.2, 'a árvore espelhada difere da normal');
  assert.deepEqual(erros, []);
  await ctx.close();
});
