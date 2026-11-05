import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const RES_PIXEL = 16 / 1.5;

test('10.2c: a crista em C com três escarpas, três rochas, nos dois estilos', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async (resPixel) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const L = 18, A = 13;
    // O C do Desfiladeiro: topo, costas e base, com o lado baixo para dentro; caminhos relativos, como a cena os pede.
    const C = (material: string) => [
      { path: [[0, 0], [11, 0]], drop: 'a', altura: 3, material, seed: 3 },
      { path: [[0, 0], [0, 7]], drop: 'b', altura: 3, material, seed: 4 },
      { path: [[0, 0], [11, 0]], drop: 'b', altura: 3, material, seed: 5 },
    ];
    const materiais = ['rocha.cinza', 'rocha.nevada', 'rocha.arenito'], fundos = ['neve.funda', 'neve.funda', 'grama'];
    const tela = document.createElement('canvas'), largura = 640, alt = Math.round(largura * A / L); tela.width = 3 * (largura + 8) + 8; tela.height = 2 * (alt + 8) + 8;
    const g = tela.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, tela.width, tela.height);
    const cores: number[] = [], tempos: number[] = [];
    for (let l = 0; l < 2; l++) for (let i = 0; i < 3; i++) {
      const estilo = l ? 'pixel' : 'illustrated', res = l ? resPixel : 48, ppm = largura / L;
      const fundo = await executarBake({ tipo: 'terreno', entrada: { largura: L, altura: A, resolucao: 0.5, base: fundos[i], camadas: [] }, res, estilo });
      const x = 8 + i * (largura + 8), y = 8 + l * (alt + 8);
      g.imageSmoothingEnabled = !l; g.drawImage(fundo.bitmap, 0, 0, fundo.bitmap.width, fundo.bitmap.height, x, y, largura, alt);
      const [a, b, c] = C(materiais[i]!), pos = [[3, 3], [3, 3], [3, 10]] as const;
      for (const [k, e] of [a, b, c].entries()) {
        const t0 = performance.now(), bake = await executarBake({ tipo: 'escarpa', entrada: e, res, estilo }); tempos.push(Math.round(performance.now() - t0));
        const px = x + (pos[k]![0] + bake.origem[0]) * ppm, py = y + (pos[k]![1] + bake.origem[1]) * ppm;
        g.drawImage(bake.bitmap, 0, 0, bake.bitmap.width, bake.bitmap.height, px, py, bake.bitmap.width / bake.res * ppm, bake.bitmap.height / bake.res * ppm);
        if (l) { const um = document.createElement('canvas'); um.width = bake.bitmap.width; um.height = bake.bitmap.height; const c2 = um.getContext('2d', { willReadFrequently: true })!; c2.drawImage(bake.bitmap, 0, 0); const d = c2.getImageData(0, 0, um.width, um.height).data, set = new Set<string>(); for (let q = 0; q < d.length; q += 4) if (d[q + 3]) set.add(`${d[q]},${d[q + 1]},${d[q + 2]}`); cores.push(set.size); }
      }
    }
    return { png: tela.toDataURL('image/png'), cores, tempos };
  }, RES_PIXEL);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fase10-escarpa.png', Buffer.from(r.png.split(',')[1]!, 'base64'));
  console.log('escarpa: tempos (ms)', r.tempos.join(' '), '| cores no Pixel', r.cores.join(' '));
  for (const n of r.cores) assert.ok(n >= 3 && n <= 40, `cores no Pixel: ${n}`);
  assert.deepEqual(erros, []); await ctx.close();
});

async function arrastar(p: Page, de: [number, number], para: [number, number]) {
  const [ax, ay] = await clientDe(p, de), [bx, by] = await clientDe(p, para);
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up();
}

test('10.2c: o pincel Escarpa desenha, o inspetor troca o lado e a face muda de lado; a névoa não é cortada', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await page.click('[data-testid="ferramenta-parede"]'); await page.waitForTimeout(350);
  await page.click('[data-testid="parede-cliff"]');
  await arrastar(page, [6, 8.25], [12, 8.25]);
  let m = await documento(page); const w = Object.values(m.walls)[0]!;
  assert.equal(w.kind, 'cliff'); assert.equal(w.drop, 'b'); assert.equal(w.height, 3); assert.equal(w.thickness, 0.4); assert.equal(w.material, 'rocha.cinza');
  assert.deepEqual(w.blocks, { move: true, sight: false, light: false }); assert.equal(w.source, null);
  await page.waitForTimeout(1500);
  // Mede o brilho acima e abaixo da linha da escarpa.
  const medir = async () => {
    const wy = w.path[0]![1], [x0, y0] = await clientDe(page, [w.path[0]![0] + 0.5, wy - 1.7]), [x1, y1] = await clientDe(page, [w.path[1]![0] - 0.5, wy + 1.7]), [, ym] = await clientDe(page, [6.5, wy]);
    const png = await page.screenshot({ clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) } });
    return { png, ym: ym - Math.min(y0, y1) };
  };
  await page.click('[data-testid="ferramenta-selecionar"]'); await page.waitForTimeout(350);
  assert.deepEqual((await page.evaluate(() => (window as unknown as { __atlas: { sessao(): { selecao: { value: unknown[] } } } }).__atlas.sessao().selecao.value)).length, 1, 'a escarpa nova fica selecionada');
  const [ex, ey] = await clientDe(page, [14, 2]); await page.mouse.click(ex, ey); await page.waitForTimeout(200);      // clique no vazio: tira a seleção para medir
  const antes = await medir(); mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/fase10-escarpa-b.png', antes.png);
  const lado = async (png: Buffer, ym: number) => page.evaluate(async ([b64, y]) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
    // Desvio em relação ao fundo (o canto do recorte): a face de rocha destoa, o vazio do mapa não.
    const d = g.getImageData(0, 0, c.width, c.height).data, r0 = d[0]!, g0 = d[1]!, b0 = d[2]!; let ac = 0, ab = 0, na = 0, nb = 0;
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) { const i = (yy * c.width + xx) * 4, v = Math.abs(d[i]! - r0) + Math.abs(d[i + 1]! - g0) + Math.abs(d[i + 2]! - b0); if (yy < (y as number) - 4) { ac += v; na++; } else if (yy > (y as number) + 4) { ab += v; nb++; } }
    return { acima: ac / na, abaixo: ab / nb };
  }, [png.toString('base64'), ym] as [string, number]);
  const b = await lado(antes.png, antes.ym);
  // Troca o lado pelo inspetor.
  const [cx, cy] = await clientDe(page, [9, w.path[0]![1] + 0.8 * 0]); await page.mouse.click(cx, cy); await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/fase10-escarpa-tela.png' });
  await page.click('[data-testid="escarpa-lado"]'); await page.waitForTimeout(1200);
  m = await documento(page); assert.equal(Object.values(m.walls)[0]!.drop, 'a');
  await page.mouse.click(ex, ey); await page.waitForTimeout(300);
  const depois = await medir(); writeFileSync('test-results/fase10-escarpa-a.png', depois.png);
  const a = await lado(depois.png, depois.ym);
  // O desvio do fundo mostra de que lado está a face.
  assert.ok(b.acima > 3 * b.abaixo + 2, `drop b: a face fica acima ${JSON.stringify(b)}`);
  assert.ok(a.abaixo > 3 * a.acima + 2, `drop a: a face fica abaixo ${JSON.stringify(a)}`);
  // Visão e luz seguem livres; o passo está bloqueado.
  const vis = await page.evaluate(async () => { const caminho = '/src/domain/visibilidade.ts', { oclusores } = await import(/* @vite-ignore */ caminho); const doc = (window as unknown as { __atlas: { sessao(): { doc: { value: never } } } }).__atlas.sessao().doc.value; return ['visao', 'luz', 'movimento'].map(p => oclusores(doc, p).length); });
  assert.deepEqual(vis, [0, 0, 1]);
  assert.deepEqual(erros, []); await ctx.close();
});
