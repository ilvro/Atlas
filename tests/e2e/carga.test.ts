import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { entradaDoTerreno, ladrilhosDoTerreno, resolucaoDe } from '../../src/render/entradas.ts';
import { abrir, documento, encerrar, esperarEditor, esperarMs, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

interface AssadoMedido { tipo: string; ms: number; px: number }

test('M7: primeira imagem em baixa resolução aparece em <= 1,5 s e depois é trocada pela resolução cheia', async () => {
  const mapa = lerMapa(JSON.parse(readFileSync('public/exemplos/porto-noturno.atlas.json', 'utf8')));
  const resTerreno = resolucaoDe(mapa, 'terreno');
  const resComodo = resolucaoDe(mapa, 'comodo');
  const ladrilhos = ladrilhosDoTerreno(entradaDoTerreno(mapa), resTerreno);
  const nComodos = Object.keys(mapa.rooms).length;

  const ctx = await novoContexto(amb);
  try {
    await ctx.addInitScript(() => {
      const g = globalThis as unknown as { __atlasMedirAssados?: boolean; __atlasAssados?: AssadoMedido[] };
      g.__atlasMedirAssados = true;
      g.__atlasAssados = [];
    });

    const { page, erros } = await abrir(ctx, amb.url);
    const t0 = performance.now();
    await page.click('[data-testid="usar-porto-noturno"]');
    await esperarEditor(page);

    const box = await page.locator('[data-testid="area-do-mapa"] canvas').boundingBox();
    assert.ok(box && box.width > 100 && box.height > 100, 'canvas do mapa visível');
    const clip = {
      x: Math.round(box.x + box.width * 0.35),
      y: Math.round(box.y + box.height * 0.35),
      width: Math.round(box.width * 0.3),
      height: Math.round(box.height * 0.3),
    };

    let apareceuAntesDe1500 = false;
    let tempoAparicao = 0;
    let pintandoNaAparicao = -1;

    while (performance.now() - t0 <= 1500) {
      const png = await page.screenshot({ clip });
      const stats = await page.evaluate(async (b64: string) => {
        const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
        const c = new OffscreenCanvas(bmp.width, bmp.height);
        const g = c.getContext('2d')!;
        g.drawImage(bmp, 0, 0);
        const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
        let naoFundo = 0;
        let somaBrilho = 0;
        const total = bmp.width * bmp.height;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i]!, gr = d[i + 1]!, b = d[i + 2]!;
          // Fundo vazio do editor é #0e1015 (14, 16, 21)
          if (Math.abs(r - 14) > 4 || Math.abs(gr - 16) > 4 || Math.abs(b - 21) > 4) naoFundo++;
          somaBrilho += 0.3 * r + 0.59 * gr + 0.11 * b;
        }
        const pintando = (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando ?? -1;
        return { pctNaoFundo: (naoFundo / total) * 100, brilhoMedio: somaBrilho / total, pintando };
      }, png.toString('base64'));

      if (stats.pctNaoFundo > 5 && stats.brilhoMedio > 17) {
        apareceuAntesDe1500 = true;
        tempoAparicao = Math.round(performance.now() - t0);
        pintandoNaAparicao = stats.pintando;
        break;
      }
      await esperarMs(40);
    }

    assert.ok(apareceuAntesDe1500, `centro do mapa deveria mostrar o chão em <= 1,5 s`);

    await page.waitForFunction(
      () => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0,
      null,
      { polling: 50, timeout: 30_000 },
    );

    const doc = await documento(page);
    assert.equal(resolucaoDe(doc, 'terreno'), resTerreno);
    assert.equal(resolucaoDe(doc, 'comodo'), resComodo);

    const assados = await page.evaluate(() => (globalThis as unknown as { __atlasAssados?: AssadoMedido[] }).__atlasAssados ?? []);
    const terrenos = assados.filter(a => a.tipo === 'terreno');
    const comodos = assados.filter(a => a.tipo === 'comodo');

    // Cada ladrilho de terreno e cada cômodo deve ter 1 prévia (res/4 -> 1/16 dos pixels) e 1 assado em resolução cheia.
    assert.equal(terrenos.length, ladrilhos.length * 2, `esperado ${ladrilhos.length * 2} assados de terreno (prévia + cheia), veio ${terrenos.length}`);
    assert.equal(comodos.length, nComodos * 2, `esperado ${nComodos * 2} assados de cômodo (prévia + cheia), veio ${comodos.length}`);

    const pxCheiosEsperados = ladrilhos.map(l => Math.round(l.caixa.w * resTerreno) * Math.round(l.caixa.h * resTerreno)).sort((a, b) => a - b);
    const pxPreviasEsperados = ladrilhos.map(l => Math.round(l.caixa.w * (resTerreno / 4)) * Math.round(l.caixa.h * (resTerreno / 4))).sort((a, b) => a - b);
    const pxTerrenosObtidos = terrenos.map(t => t.px).sort((a, b) => a - b);
    assert.deepEqual(pxTerrenosObtidos, [...pxPreviasEsperados, ...pxCheiosEsperados].sort((a, b) => a - b));

    assert.deepEqual(erros.filter(e => !/status of 403/.test(e)), []);
    console.log(`M7 porto-noturno: chão visível em ${tempoAparicao} ms (pintando=${pintandoNaAparicao}), ${terrenos.length} assados de terreno, ${comodos.length} de cômodo`);
  } finally {
    await ctx.close();
  }
});
