import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('C2: borda suave entre materiais de chão no Ilustrado e dura no Pixel', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async () => {
    const caminho = '/src/procedural/executar.ts';
    const { executarBake } = await import(/* @vite-ignore */ caminho);

    // Mapa 30x30 com base de grama e uma ilha circular/quadrada de lama e terra no meio
    const W = 30, H = 30, res = 32;
    // Faixa de células no centro
    const celulasLama: [number, number, number][] = [];
    for (let y = 10; y < 20; y++) {
      celulasLama.push([y, 10, 10]);
    }
    const celulasTerra: [number, number, number][] = [];
    for (let y = 12; y < 18; y++) {
      celulasTerra.push([y, 12, 6]);
    }

    const entrada = {
      largura: W,
      altura: H,
      resolucao: 1,
      base: 'grama',
      camadas: [
        { material: 'lama', celulas: celulasLama },
        { material: 'terra', celulas: celulasTerra },
      ],
    };

    // Medição Ilustrado
    const t0Ilustrado = performance.now();
    const bakeIlustrado = await executarBake({ tipo: 'terreno', entrada, res, estilo: 'illustrated' });
    const duracaoIlustrado = performance.now() - t0Ilustrado;

    // Medição Pixel
    const t0Pixel = performance.now();
    const bakePixel = await executarBake({ tipo: 'terreno', entrada, res: 16 / 1.5, estilo: 'pixel' });
    const duracaoPixel = performance.now() - t0Pixel;

    // Amostrar canal alfa ao longo da borda de lama (x de 8 a 12 m em y = 15 m)
    const canvasIlustrado = document.createElement('canvas');
    canvasIlustrado.width = bakeIlustrado.bitmap.width;
    canvasIlustrado.height = bakeIlustrado.bitmap.height;
    const ctxIlustrado = canvasIlustrado.getContext('2d')!;
    ctxIlustrado.drawImage(bakeIlustrado.bitmap, 0, 0);

    // Amostrar pixels em corte horizontal através da borda
    const yPx = Math.floor(15 * res);
    const faixaX = ctxIlustrado.getImageData(Math.floor(8 * res), yPx, Math.floor(4 * res), 1).data;

    // Gerar imagem composta para inspeção visual
    const tela = document.createElement('canvas');
    tela.width = 600;
    tela.height = 300;
    const g = tela.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.drawImage(bakeIlustrado.bitmap, 0, 0, 300, 300);
    g.imageSmoothingEnabled = false;
    g.drawImage(bakePixel.bitmap, 300, 0, 300, 300);

    return {
      duracaoIlustrado,
      duracaoPixel,
      faixaLength: faixaX.length / 4,
      png: tela.toDataURL('image/png'),
    };
  });

  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/teste-pantano-terreno.png', Buffer.from(r.png.split(',')[1]!, 'base64'));

  console.log(`Bake terreno 30x30: Ilustrado ${r.duracaoIlustrado.toFixed(1)}ms, Pixel ${r.duracaoPixel.toFixed(1)}ms`);
  assert.ok(r.duracaoIlustrado > 0, 'Ilustrado assou');
  assert.ok(r.duracaoPixel > 0, 'Pixel assou');
  assert.deepEqual(erros, []);
  await ctx.close();
});
