import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

/** Assa um terreno 30x30 com uma faixa de lama sobre base vazia e devolve o alfa de um corte horizontal pela borda x = 10 m, y = 15 m. */
async function perfilDaBorda(semFiltro: boolean) {
  const ctx = await novoContexto(amb);
  if (semFiltro) {
    // Imita o WebKitGTK: sem `filter` no contexto 2D, na página e no OffscreenCanvas (worker).
    await ctx.addInitScript(() => {
      delete (CanvasRenderingContext2D.prototype as unknown as Record<string, unknown>).filter;
      if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') delete (OffscreenCanvasRenderingContext2D.prototype as unknown as Record<string, unknown>).filter;
    });
  }
  const { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async () => {
    const caminho = '/src/procedural/executar.ts';
    const { executarBake } = await import(/* @vite-ignore */ caminho);
    const res = 32, celulas: [number, number, number][] = [];
    for (let y = 10; y < 20; y++) celulas.push([y, 10, 10]);
    const t0 = performance.now();
    const b = await executarBake({ tipo: 'terreno', entrada: { largura: 30, altura: 30, resolucao: 1, base: 'vazio', camadas: [{ material: 'lama', celulas }] }, res, estilo: 'illustrated' });
    const ms = performance.now() - t0;
    const c = document.createElement('canvas'); c.width = b.bitmap.width; c.height = b.bitmap.height;
    const g = c.getContext('2d')!; g.drawImage(b.bitmap, 0, 0);
    const d = g.getImageData(Math.floor(8 * res), Math.floor(15 * res), Math.floor(4 * res), 1).data;
    return { temFiltro: 'filter' in CanvasRenderingContext2D.prototype, ms, alfa: Array.from({ length: d.length / 4 }, (_, i) => d[i * 4 + 3]!) };
  });
  assert.deepEqual(erros, []);
  await ctx.close();
  return r;
}

test('E2: sem ctx.filter a borda entre chão e vazio continua suave e igual à do Chromium', async () => {
  const com = await perfilDaBorda(false), sem = await perfilDaBorda(true);
  assert.equal(sem.temFiltro, false, 'o filtro foi removido do protótipo');
  console.log(`Assado de terreno 30x30 (sem filter): ${sem.ms.toFixed(0)} ms; com filter: ${com.ms.toFixed(0)} ms`);
  const a = sem.alfa;
  const maiorSalto = Math.max(...a.slice(1).map((v, i) => Math.abs(v - a[i]!)));
  assert.ok(maiorSalto <= 40, `salto de alfa entre pixels vizinhos: ${maiorSalto}`);
  assert.ok(a.filter((v) => v > 10 && v < 245).length >= 12, 'a rampa tem largura');
  const diff = a.reduce((s, v, i) => s + Math.abs(v - com.alfa[i]!), 0) / a.length;
  assert.ok(diff < 15, `perfil diferente do caminho com filter (média ${diff.toFixed(1)})`);
});
