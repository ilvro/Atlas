import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
const objeto = (id: string, assetId: string, x: number, y: number) => ({ id, source: { kind: 'asset', assetId }, position: [x, y], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null });
const hora = async (p: Page, time: string) => { await sessao(p, '(s, t) => s.store.executar({ tipo: "clima.aplicar", patch: { time: t } })', time); await p.waitForTimeout(900); };
/** Pixels bem mais escuros que a neve (a mediana do recorte) — a sombra e a própria árvore. */
const escuros = (p: Page, png: Buffer) => p.evaluate(async (b64) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data, luz: number[] = []; for (let i = 0; i < d.length; i += 4) luz.push(d[i]! + d[i + 1]! + d[i + 2]!);
  const mediana = [...luz].sort((a, b) => a - b)[luz.length >> 1]!; return luz.filter(v => v < mediana * 0.9).length / luz.length;
}, png.toString('base64'));

test('10.3: a sombra de um pinheiro é maior às 8h que às 12h30', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s) => { s.store.executar({ tipo: "terreno.base", material: "neve.funda" }); s.store.executar({ tipo: "item.adicionar", colecao: "props", item: ' + JSON.stringify(objeto('p1', 'casa:pinheiro-4m', 22.5, 15)) + ' }); }');
  const [x0, y0] = await clientDe(page, [12, 8]), [x1, y1] = await clientDe(page, [33, 22]), clip = { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
  mkdirSync('test-results', { recursive: true });
  const medir = async (nome: string) => { const png = await page.screenshot({ clip }); writeFileSync(`test-results/fase10-sombra-${nome}.png`, png); return escuros(page, png); };
  await hora(page, '08:00'); await page.waitForTimeout(1200);
  const manha = await medir('08h');
  await hora(page, '12:30'); const meio = await medir('12h30');
  console.log(`sombras: escuros ${manha.toFixed(4)} (8h) ${meio.toFixed(4)} (12h30)`);
  assert.ok(manha > meio * 1.15, `8h ${manha} × 12h30 ${meio}`);
  assert.deepEqual(erros, []); await ctx.close();
});

test('10.3: o Desfiladeiro às 9h — pinheiros, maciço e escarpa, sombras para o mesmo lado (captura)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const pinheiros = [[16, 12], [19, 18], [24, 11], [27, 17], [31, 13], [22, 21]].map(([x, y], i) => objeto(`p${i}`, i % 2 ? 'casa:pinheiro-3m' : 'casa:pinheiro-4m', x!, y!));
  await sessao(page, '(s, a) => { s.store.executar({ tipo: "terreno.base", material: "neve.funda" }); for (const o of a.o) s.store.executar({ tipo: "item.adicionar", colecao: "props", item: o }); s.store.executar({ tipo: "parede.adicionar", parede: a.e1 }); const cel = []; for (let y = 4; y < 12; y++) for (let x = 36; x < 48; x++) cel.push([x, y]); s.store.executar({ tipo: "terreno.pintar", material: "rocha.nevada", celulas: cel }); }', {
    o: pinheiros, e1: { id: 'e1', path: [[12, 24], [22, 24]], height: 3, thickness: 0.4, material: 'rocha.cinza', kind: 'cliff', blocks: { move: true, sight: false, light: false }, drop: 'a', source: null },
  });
  await hora(page, '09:00'); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/fase10-sombras-9h.png' });
  const m = await documento(page); assert.equal(Object.keys(m.props).length, 6);
  assert.deepEqual(erros, []); await ctx.close();
});
