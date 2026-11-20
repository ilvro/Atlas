import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { entradaDoTerreno, ladrilhosDoTerreno, LADO_DO_LADRILHO, resolucaoDe } from '../../src/render/entradas.ts';
import { abrir, encerrar, esperarEditor, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

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
  test(`M4: terreno em ladrilhos de 16 m equivale ao terreno inteiro e não tem costura nas emendas (${id})`, async () => {
    const mapa = lerMapa(JSON.parse(readFileSync(`public/exemplos/${id}.atlas.json`, 'utf8')));
    const ent = entradaDoTerreno(mapa);
    const res = resolucaoDe(mapa, 'terreno');
    const tiles = ladrilhosDoTerreno(ent, res);

    const ctx = await novoContexto(amb);
    try {
      const { page, erros } = await abrirPaginaLimpa(ctx);
      const resultado = await page.evaluate(async ({ ent, tiles, res, lado }) => {
        const pAssar = '/src/procedural/assar.ts';
        const pEstilos = '/src/procedural/estilos/index.ts';
        const { assarTerreno } = await import(/* @vite-ignore */ pAssar) as typeof import('../../src/procedural/assar.ts');
        const { estiloDe } = await import(/* @vite-ignore */ pEstilos) as typeof import('../../src/procedural/estilos/index.ts');

        const est = estiloDe('illustrated');
        const inteiro = assarTerreno(ent, res, est);

        const compCor = new OffscreenCanvas(inteiro.tela.width, inteiro.tela.height);
        const cCor = compCor.getContext('2d')!;
        const compAlt = inteiro.altura ? new OffscreenCanvas(inteiro.altura.width, inteiro.altura.height) : null;
        const cAlt = compAlt?.getContext('2d') ?? null;
        const compAgua = inteiro.agua ? new OffscreenCanvas(inteiro.agua.tela.width, inteiro.agua.tela.height) : null;
        const cAgua = compAgua?.getContext('2d') ?? null;
        if (cAgua && compAgua) {
          cAgua.fillStyle = '#000';
          cAgua.fillRect(0, 0, compAgua.width, compAgua.height);
        }

        for (const t of tiles) {
          const r = assarTerreno(t.entrada, res, est);
          cCor.drawImage(r.tela as CanvasImageSource, Math.round(r.origem[0] * res), Math.round(r.origem[1] * res));
          if (cAlt && r.altura) {
            cAlt.drawImage(r.altura as CanvasImageSource, Math.round(r.origem[0] * res), Math.round(r.origem[1] * res));
          }
          if (cAgua && r.agua) {
            const ox = Math.round((r.agua.origem?.[0] ?? 0) * r.agua.res);
            const oy = Math.round((r.agua.origem?.[1] ?? 0) * r.agua.res);
            cAgua.drawImage(r.agua.tela as CanvasImageSource, ox, oy);
          }
        }

        const medirDiferenca = (a: OffscreenCanvas, b: OffscreenCanvas, pxPorM: number) => {
          const da = a.getContext('2d')!.getImageData(0, 0, a.width, a.height).data;
          const db = b.getContext('2d')!.getImageData(0, 0, b.width, b.height).data;
          const total = a.width * a.height;
          let diffGt1 = 0, maxD = 0;
          for (let i = 0; i < da.length; i += 4) {
            const m = Math.max(
              Math.abs(da[i]! - db[i]!),
              Math.abs(da[i + 1]! - db[i + 1]!),
              Math.abs(da[i + 2]! - db[i + 2]!),
              Math.abs(da[i + 3]! - db[i + 3]!),
            );
            if (m > 1) diffGt1++;
            if (m > maxD) maxD = m;
          }

          // Faixa de 4 px ao longo de cada emenda vertical (x = 16*i) e horizontal (y = 16*j).
          let emendaTotal = 0, emendaDiffGt2 = 0, emendaMaxD = 0;
          const checarPx = (x: number, y: number) => {
            if (x < 0 || x >= a.width || y < 0 || y >= a.height) return;
            const k = (y * a.width + x) * 4;
            const m = Math.max(
              Math.abs(da[k]! - db[k]!),
              Math.abs(da[k + 1]! - db[k + 1]!),
              Math.abs(da[k + 2]! - db[k + 2]!),
              Math.abs(da[k + 3]! - db[k + 3]!),
            );
            emendaTotal++;
            if (m > 2) emendaDiffGt2++;
            if (m > emendaMaxD) emendaMaxD = m;
          };
          for (let xM = lado; xM < ent.largura - 1e-6; xM += lado) {
            const sx = Math.round(xM * pxPorM);
            for (let y = 0; y < a.height; y++) {
              for (let dx = -2; dx < 2; dx++) checarPx(sx + dx, y);
            }
          }
          for (let yM = lado; yM < ent.altura - 1e-6; yM += lado) {
            const sy = Math.round(yM * pxPorM);
            for (let x = 0; x < a.width; x++) {
              for (let dy = -2; dy < 2; dy++) checarPx(x, sy + dy);
            }
          }

          return {
            pctDiff: (diffGt1 / total) * 100,
            maxD,
            emendaPctDiff: emendaTotal > 0 ? (emendaDiffGt2 / emendaTotal) * 100 : 0,
            emendaMaxD,
          };
        };

        const out: Record<string, ReturnType<typeof medirDiferenca>> = {
          cor: medirDiferenca(inteiro.tela as OffscreenCanvas, compCor, res),
        };
        if (inteiro.altura && compAlt) out.altura = medirDiferenca(inteiro.altura as OffscreenCanvas, compAlt, res);
        if (inteiro.agua && compAgua) out.agua = medirDiferenca(inteiro.agua.tela as OffscreenCanvas, compAgua, inteiro.agua.res);
        return out;
      }, { ent, tiles, res, lado: LADO_DO_LADRILHO });

      assert.deepEqual(erros.filter(e => !/status of 403/.test(e)), []);
      for (const [k, v] of Object.entries(resultado)) {
        assert.ok(v.pctDiff < 1, `${id} ${k}: ${v.pctDiff.toFixed(4)}% dos pixels diferem (maxD=${v.maxD})`);
        assert.ok(v.emendaPctDiff < 1, `${id} ${k} emenda 4px: ${v.emendaPctDiff.toFixed(4)}% diferem (emendaMaxD=${v.emendaMaxD})`);
      }
    } finally {
      await ctx.close();
    }
  });
}

test('M4: pintar 1 célula num canto do editor reassa apenas 1 ou 2 ladrilhos', async () => {
  const ctx = await novoContexto(amb);
  try {
    await ctx.addInitScript(() => {
      const g = globalThis as unknown as { __atlasMedirAssados?: boolean; __atlasAssados?: { tipo: string; ms: number; px: number }[] };
      g.__atlasMedirAssados = true;
      g.__atlasAssados = [];
    });
    const { page, erros } = await abrir(ctx, amb.url);
    await page.click('[data-testid="usar-ruina-costeira"]');
    await esperarEditor(page);
    await page.waitForFunction(
      () => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0,
      null,
      { polling: 50, timeout: 30_000 },
    );

    const iniciais = await page.evaluate(() => {
      const g = globalThis as unknown as { __atlasAssados?: { tipo: string }[] };
      const count = (g.__atlasAssados ?? []).filter(a => a.tipo === 'terreno').length;
      g.__atlasAssados = [];
      return count;
    });
    assert.ok(iniciais >= 9, `esperava >= 9 ladrilhos na abertura de ruina-costeira (50×37 m), obteve ${iniciais}`);

    await page.evaluate(() => {
      const atlas = (window as unknown as { __atlas: { sessao(): { store: { executar(c: unknown): void } } } }).__atlas;
      atlas.sessao().store.executar({ tipo: 'terreno.pintar', material: 'terra', celulas: [[2, 2]] });
    });

    await page.waitForTimeout(250);
    await page.waitForFunction(
      () => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0,
      null,
      { polling: 50, timeout: 15_000 },
    );

    const reassados = await page.evaluate(() => {
      const g = globalThis as unknown as { __atlasAssados?: { tipo: string }[] };
      return (g.__atlasAssados ?? []).filter(a => a.tipo === 'terreno').length;
    });
    assert.deepEqual(erros.filter(e => !/status of 403/.test(e)), []);
    assert.ok(reassados >= 1 && reassados <= 2, `esperava 1 ou 2 ladrilhos reassados ao pintar no canto, obteve ${reassados}`);
  } finally {
    await ctx.close();
  }
});
