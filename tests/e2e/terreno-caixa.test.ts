import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { entradaDoTerreno, resolucaoDe } from '../../src/render/entradas.ts';
import { encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

async function abrirPaginaLimpa(ctx: Awaited<ReturnType<typeof novoContexto>>) {
  const page = await ctx.newPage();
  const erros: string[] = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));
  await page.goto(`${amb.url}mesa.json`);
  return { page, erros };
}

for (const id of ['ruina-costeira', 'porto-noturno', 'gruta-dos-contrabandistas']) {
  test(`M3: terreno por caixa equivale ao terreno em tela cheia em ${id} (>= 99,9% dos pixels com diff <= 1/255)`, async () => {
    const mapa = lerMapa(JSON.parse(readFileSync(`public/exemplos/${id}.atlas.json`, 'utf8')));
    const ent = entradaDoTerreno(mapa);
    const res = resolucaoDe(mapa, 'terreno');

    const ctx = await novoContexto(amb);
    try {
      const { page, erros } = await abrirPaginaLimpa(ctx);
      const resultado = await page.evaluate(async ({ ent, res }) => {
        const pAssar = '/src/procedural/assar.ts';
        const pEstilos = '/src/procedural/estilos/index.ts';
        const { assarTerreno } = await import(/* @vite-ignore */ pAssar) as typeof import('../../src/procedural/assar.ts');
        const { estiloDe } = await import(/* @vite-ignore */ pEstilos) as typeof import('../../src/procedural/estilos/index.ts');

        const compararTelas = (a: OffscreenCanvas, b: OffscreenCanvas) => {
          const da = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
          const db = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
          const total = a.width * a.height;
          let dentro = 0, maxD = 0;
          for (let i = 0; i < da.length; i += 4) {
            const m = Math.max(
              Math.abs(da[i]! - db[i]!),
              Math.abs(da[i + 1]! - db[i + 1]!),
              Math.abs(da[i + 2]! - db[i + 2]!),
              Math.abs(da[i + 3]! - db[i + 3]!),
            );
            if (m <= 1) dentro++;
            if (m > maxD) maxD = m;
          }
          return { total, pct: (dentro / total) * 100, diffGt1: total - dentro, maxD };
        };

        const est = estiloDe('illustrated');
        const comCaixa = assarTerreno(ent, res, est);
        const semCaixa = assarTerreno(ent, res, est, { semCaixa: true });
        const out: Record<string, { pct: number; diffGt1: number; maxD: number }> = {
          cor: compararTelas(comCaixa.tela as OffscreenCanvas, semCaixa.tela as OffscreenCanvas),
        };
        if (comCaixa.altura && semCaixa.altura) {
          out.altura = compararTelas(comCaixa.altura as OffscreenCanvas, semCaixa.altura as OffscreenCanvas);
        }
        if (comCaixa.agua && semCaixa.agua) {
          out.agua = compararTelas(comCaixa.agua.tela as OffscreenCanvas, semCaixa.agua.tela as OffscreenCanvas);
        }
        return out;
      }, { ent, res });

      assert.deepEqual(erros, []);
      for (const [k, v] of Object.entries(resultado)) {
        assert.ok(v.pct >= 99.9, `${id} ${k}: apenas ${v.pct.toFixed(4)}% dos pixels <= 1/255 (${v.diffGt1} diffs, maxD=${v.maxD})`);
      }
    } finally {
      await ctx.close();
    }
  });
}

test('M3: estilo Pixel com resolução inteira preserva >= 99,9% dos pixels em ruina-costeira', async () => {
  const mapa = lerMapa(JSON.parse(readFileSync('public/exemplos/ruina-costeira.atlas.json', 'utf8')));
  const ent = entradaDoTerreno(mapa);
  const ctx = await novoContexto(amb);
  try {
    const { page, erros } = await abrirPaginaLimpa(ctx);
    const resultado = await page.evaluate(async ({ ent }) => {
      const pAssar = '/src/procedural/assar.ts';
      const pEstilos = '/src/procedural/estilos/index.ts';
      const { assarTerreno } = await import(/* @vite-ignore */ pAssar) as typeof import('../../src/procedural/assar.ts');
      const { estiloDe } = await import(/* @vite-ignore */ pEstilos) as typeof import('../../src/procedural/estilos/index.ts');
      const est = estiloDe('pixel');
      const comCaixa = assarTerreno(ent, 16, est);
      const semCaixa = assarTerreno(ent, 16, est, { semCaixa: true });
      const comparar = (a: OffscreenCanvas, b: OffscreenCanvas) => {
        const da = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
        const db = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
        const total = a.width * a.height;
        let dentro = 0;
        for (let i = 0; i < da.length; i += 4) {
          if (Math.max(Math.abs(da[i]! - db[i]!), Math.abs(da[i + 1]! - db[i + 1]!), Math.abs(da[i + 2]! - db[i + 2]!), Math.abs(da[i + 3]! - db[i + 3]!)) <= 1) dentro++;
        }
        return (dentro / total) * 100;
      };
      return {
        cor: comparar(comCaixa.tela as OffscreenCanvas, semCaixa.tela as OffscreenCanvas),
        agua: comparar(comCaixa.agua!.tela as OffscreenCanvas, semCaixa.agua!.tela as OffscreenCanvas),
      };
    }, { ent });
    assert.deepEqual(erros, []);
    assert.ok(resultado.cor >= 99.9, `pixel cor ${resultado.cor}`);
    assert.ok(resultado.agua >= 99.9, `pixel agua ${resultado.agua}`);
  } finally {
    await ctx.close();
  }
});

test('M3: pintarMaterial porPixel em sub-caixa com setTransform(-x0, -y0) produz pixels idênticos ao mapa inteiro', async () => {
  const ctx = await novoContexto(amb);
  try {
    const { page, erros } = await abrirPaginaLimpa(ctx);
    const res = await page.evaluate(async () => {
      const pMat = '/src/procedural/materiais.ts';
      const { pintarMaterial } = await import(/* @vite-ignore */ pMat) as typeof import('../../src/procedural/materiais.ts');
      const r = 32, W = 320, H = 256, x0 = 96, y0 = 64, cw = 160, ch = 128;
      const cFull = new OffscreenCanvas(W, H), gFull = cFull.getContext('2d')!;
      gFull.setTransform(r, 0, 0, r, 0, 0);
      pintarMaterial(gFull, 'areia.molhada', { x: 0, y: 0, w: W / r, h: H / r }, 11, { dir: 0 });

      const cBox = new OffscreenCanvas(cw, ch), gBox = cBox.getContext('2d')!;
      gBox.setTransform(r, 0, 0, r, -x0, -y0);
      pintarMaterial(gBox, 'areia.molhada', { x: x0 / r, y: y0 / r, w: cw / r, h: ch / r }, 11, { dir: 0 });

      const dFull = gFull.getImageData(x0, y0, cw, ch).data;
      const dBox = gBox.getImageData(0, 0, cw, ch).data;
      let diff = 0;
      for (let i = 0; i < dFull.length; i += 4) {
        if (Math.max(Math.abs(dFull[i]! - dBox[i]!), Math.abs(dFull[i + 1]! - dBox[i + 1]!), Math.abs(dFull[i + 2]! - dBox[i + 2]!), Math.abs(dFull[i + 3]! - dBox[i + 3]!)) > 1) diff++;
      }
      return { total: cw * ch, diff };
    });
    assert.deepEqual(erros, []);
    assert.equal(res.diff, 0);
  } finally {
    await ctx.close();
  }
});
