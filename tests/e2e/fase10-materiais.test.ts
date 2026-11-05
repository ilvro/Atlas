import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const NOVOS = ['gelo', 'neve.funda', 'rocha.rachada', 'cascalho'];
const RES_PIXEL = 16 / 1.5;

test('10.4a: captura dos quatro materiais novos (Ilustrado a 64 e a 24 px/m; Pixel) e no máximo 6 cores no Pixel', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async ([ids, resPixel]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const lado = 384, tela = document.createElement('canvas'); tela.width = ids.length * (lado + 8) + 8; tela.height = 3 * (lado + 8) + 8;
    const g = tela.getContext('2d')!; g.fillStyle = '#101014'; g.fillRect(0, 0, tela.width, tela.height);
    const cores: Record<string, number> = {};
    const linhas: [number, string][] = [[64, 'illustrated'], [24, 'illustrated'], [resPixel, 'pixel']];
    for (let l = 0; l < linhas.length; l++) for (let i = 0; i < ids.length; i++) {
      const [res, estilo] = linhas[l]!, bake = await executarBake({ tipo: 'terreno', entrada: { largura: 6, altura: 6, resolucao: 0.75, base: ids[i], camadas: [] }, res, estilo });
      g.imageSmoothingEnabled = estilo !== 'pixel'; g.drawImage(bake.bitmap, 0, 0, bake.bitmap.width, bake.bitmap.height, 8 + i * (lado + 8), 8 + l * (lado + 8), lado, lado);
      if (estilo === 'pixel') {
        const t = document.createElement('canvas'); t.width = 64; t.height = 64; const c = t.getContext('2d', { willReadFrequently: true })!; c.drawImage(bake.bitmap, 0, 0);
        const d = c.getImageData(0, 0, 64, 64).data, set = new Set<string>(); for (let k = 0; k < d.length; k += 4) set.add(`${d[k]},${d[k + 1]},${d[k + 2]}`);
        cores[ids[i]!] = set.size;
      }
    }
    return { png: tela.toDataURL('image/png'), cores };
  }, [NOVOS, RES_PIXEL] as const);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fase10-materiais-a.png', Buffer.from(r.png.split(',')[1]!, 'base64'));
  for (const id of NOVOS) assert.ok(r.cores[id]! >= 2 && r.cores[id]! <= 6, `${id}: ${r.cores[id]} cores no Pixel`);
  assert.deepEqual(erros, []); await ctx.close();
});
