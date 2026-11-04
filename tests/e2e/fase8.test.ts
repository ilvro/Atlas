import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { writeFileSync } from 'node:fs';
import { codificar } from '../../src/domain/celulas.ts';
import { PALETAS_PIXEL } from '../../src/domain/paletas.ts';
import { MATERIAIS } from '../../src/procedural/materiais.ts';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
async function ferramenta(p: Page, id: string) { await p.click(`[data-testid="ferramenta-${id}"]`); await p.waitForTimeout(350); }
async function clicar(p: Page, mundo: [number, number]) { const [x, y] = await clientDe(p, mundo); await p.mouse.click(x, y); await p.waitForTimeout(150); }
async function retangulo(p: Page, a: [number, number], b: [number, number]) {
  const [ax, ay] = await clientDe(p, a), [bx, by] = await clientDe(p, b);
  await p.keyboard.down('Shift'); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up(); await p.keyboard.up('Shift');
}
const semFoco = (p: Page) => p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
const camera = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { camera: { x: number; y: number; zoom: number } } } }).__atlas.viewport().camera);

/** As cores (#rrggbb) que aparecem num retângulo do mundo, lidas dos pixels da tela. */
async function coresEm(p: Page, a: [number, number], b: [number, number]): Promise<Set<string>> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({ clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) } });
  const lista = await p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data, vistas = new Set<string>();
    for (let i = 0; i < d.length; i += 4) vistas.add('#' + [d[i]!, d[i + 1]!, d[i + 2]!].map(v => v.toString(16).padStart(2, '0')).join(''));
    return [...vistas];
  }, png.toString('base64'));
  return new Set(lista);
}

test('estilo Pixel: trocar na aba Mapa pixeliza a cena na paleta (no máximo 32 cores), desfazer volta ao Ilustrado, e a câmera fica na grade de pixels', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await page.click('[data-testid="aba-mapa"]');
  await page.getByLabel('Ver atmosfera no editor').uncheck();      // sem acabamento: só a paleta
  await page.waitForTimeout(900);
  const amostra: [[number, number], [number, number]] = [[7.5, 7.5], [13.5, 12]];
  assert.ok((await coresEm(page, ...amostra)).size > 32, 'o Ilustrado tem muitas cores');

  await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(900);
  const doc = await documento(page);
  assert.equal(doc.style.renderer, 'pixel');
  const paleta = new Set(PALETAS_PIXEL[0]!.cores.map(c => c.toLowerCase()));
  const cores = await coresEm(page, ...amostra);
  assert.ok(cores.size <= 32 && cores.size >= 2, `no Pixel a amostra tem ${cores.size} cores`);
  for (const c of cores) assert.ok(paleta.has(c), `${c} não é da paleta`);
  await page.screenshot({ path: 'test-results/fase8-pixelizada.png' });

  // A câmera: zoom em múltiplo do passo (16 px / 1,5 m) e posição em pixels inteiros, depois de zoom e arrasto.
  const passo = 16 / doc.grid.size;
  const [cx, cy] = await clientDe(page, [10, 9]);
  await page.mouse.move(cx, cy); await page.mouse.wheel(0, -120); await page.waitForTimeout(150); await page.mouse.wheel(0, -40); await page.waitForTimeout(150);
  await page.mouse.move(cx, cy); await page.mouse.down({ button: 'middle' }); await page.mouse.move(cx + 37.4, cy + 21.6, { steps: 5 }); await page.mouse.up({ button: 'middle' }); await page.waitForTimeout(150);
  const cam = await camera(page), dpr = await page.evaluate(() => devicePixelRatio);
  assert.ok(Math.abs(cam.zoom / passo - Math.round(cam.zoom / passo)) < 1e-6, `zoom ${cam.zoom} não é múltiplo de ${passo}`);
  assert.ok(Math.abs(cam.x * dpr - Math.round(cam.x * dpr)) < 1e-6 && Math.abs(cam.y * dpr - Math.round(cam.y * dpr)) < 1e-6, `câmera fora da grade: ${cam.x}, ${cam.y}`);
  assert.ok((await coresEm(page, ...amostra)).size <= 32, 'continua na paleta depois de mover');

  // Outra paleta e sem dithering: as cores vêm da nova paleta.
  await page.getByLabel('Paleta').selectOption('fantasia-quente'); await page.getByLabel('Dithering').selectOption('none'); await page.waitForTimeout(500);
  const quente = new Set(PALETAS_PIXEL[2]!.cores.map(c => c.toLowerCase()));
  for (const c of await coresEm(page, ...amostra)) assert.ok(quente.has(c), `${c} não é da paleta quente`);

  // Desfazer cada troca de estilo; no fim, o Ilustrado de volta.
  await semFoco(page);
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Control+z'); await page.waitForTimeout(250); }
  assert.equal((await documento(page)).style.renderer, 'illustrated');
  await page.waitForTimeout(500);
  assert.ok((await coresEm(page, ...amostra)).size > 32, 'de volta ao Ilustrado, com as muitas cores');
  assert.deepEqual(erros, []); await ctx.close();
});

const PPC = 16, RES_PIXEL = PPC / 1.5;
const comodoDe = (material: string, seed = 3) => ({
  grade: { size: 1.5, offset: [0, 0] }, celulas: codificar([4, 5, 6, 7].flatMap(y => [4, 5, 6, 7].map(x => [x, y] as const))),
  piso: { material, seed }, papel: null, estilo: 'box', altura: 2.6, aberturas: [], objetos: [],
});

/** Assa o pedido no Pixel dentro da página e devolve as cores (e o alfa mínimo) do retângulo `[x0, y0, x1, y1]` em metros do mundo. */
async function coresDoBake(page: Page, pedido: unknown, regiao: [number, number, number, number]) {
  return page.evaluate(async ([pedido, regiao, res]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const r = await executarBake(pedido), t = document.createElement('canvas'); t.width = r.bitmap.width; t.height = r.bitmap.height;
    const g = t.getContext('2d', { willReadFrequently: true })!; g.drawImage(r.bitmap, 0, 0);
    const x0 = Math.round((regiao[0] - r.origem[0]) * res), y0 = Math.round((regiao[1] - r.origem[1]) * res), x1 = Math.round((regiao[2] - r.origem[0]) * res), y1 = Math.round((regiao[3] - r.origem[1]) * res);
    const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, cores = new Set<string>(); let alfaMin = 255;
    for (let i = 0; i < d.length; i += 4) { cores.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); alfaMin = Math.min(alfaMin, d[i + 3]!); }
    return { cores: cores.size, alfaMin, largura: r.bitmap.width, altura: r.bitmap.height, origem: r.origem };
  }, [pedido, regiao, RES_PIXEL] as const);
}

test('Pixel: um cômodo de tábuas assado usa no máximo 6 cores (antes da paleta), sem meio-tom nem transparência', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  // O cômodo vai de 6 a 12 m; o miolo fica longe das faces e da sombra de contato.
  const r = await coresDoBake(page, { tipo: 'comodo', entrada: comodoDe('tabuas.carvalho'), res: RES_PIXEL, estilo: 'pixel' }, [7.5, 7.5, 10.5, 10.5]);
  assert.ok(r.cores >= 2 && r.cores <= 6, `${r.cores} cores no piso`);
  assert.equal(r.alfaMin, 255);
  // A tela começa na grade de pixels: a origem vezes a resolução é inteira.
  assert.ok(Math.abs(r.origem[0] * RES_PIXEL - Math.round(r.origem[0] * RES_PIXEL)) < 1e-6 && Math.abs(r.origem[1] * RES_PIXEL - Math.round(r.origem[1] * RES_PIXEL)) < 1e-6, `origem fora da grade: ${r.origem}`);
  // Outros estilos de piso também ficam enxutos.
  for (const m of ['ladrilho.xadrez', 'laje.pedra', 'parquet.espinha', 'carpete.vinho', 'hexagono.salvia']) {
    const x = await coresDoBake(page, { tipo: 'comodo', entrada: comodoDe(m), res: RES_PIXEL, estilo: 'pixel' }, [7.5, 7.5, 10.5, 10.5]);
    assert.ok(x.cores >= 2 && x.cores <= 8, `${m}: ${x.cores} cores`);
  }
  assert.deepEqual(erros, []); await ctx.close();
});

test('Pixel: captura de cada piso, papel e terreno a 16 px por célula', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const materiais = Object.values(MATERIAIS).filter(m => m.uso === 'piso' || m.uso === 'papel' || m.uso === 'terreno' || m.uso === 'telhado');
  const png = await page.evaluate(async ([ids, usos, ppc]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho), res = ppc / 1.5;
    const colunas = 8, lado = 3 * ppc / 1.5 * 0 + 96, esc = 1, tela = document.createElement('canvas'); tela.width = colunas * (lado + 4); tela.height = Math.ceil(ids.length / colunas) * (lado + 4) + 4;
    const g = tela.getContext('2d')!; g.imageSmoothingEnabled = false; g.fillStyle = '#101014'; g.fillRect(0, 0, tela.width, tela.height);
    for (let i = 0; i < ids.length; i++) {
      const terreno = usos[i] === 'terreno';
      const pedido = terreno ? { tipo: 'terreno', entrada: { largura: 6, altura: 6, resolucao: 0.75, base: ids[i], camadas: [] }, res, estilo: 'pixel' }
        : { tipo: 'comodo', entrada: { grade: { size: 1.5, offset: [0, 0] }, celulas: [[0, 0, 4], [1, 0, 4], [2, 0, 4], [3, 0, 4]].map(([y, x0, n]) => [y, x0, n]), piso: { material: ids[i], seed: 3 }, papel: null, estilo: 'solid', altura: 2.6, aberturas: [], objetos: [] }, res, estilo: 'pixel' };
      const r = await executarBake(pedido), cx = (i % colunas) * (lado + 4) + 4, cy = Math.floor(i / colunas) * (lado + 4) + 4;
      const w = Math.min(lado, r.bitmap.width), h = Math.min(lado, r.bitmap.height), sx = Math.floor((r.bitmap.width - w) / 2), sy = Math.floor((r.bitmap.height - h) / 2);
      g.drawImage(r.bitmap, sx, sy, w, h, cx, cy, w * esc, h * esc);
    }
    return tela.toDataURL('image/png');
  }, [materiais.map(m => m.id), materiais.map(m => m.uso), PPC] as const);
  writeFileSync('test-results/fase8-materiais.png', Buffer.from(png.split(',')[1]!, 'base64'));
  // O terreno também assa no Pixel, com a borda em degraus e o aro: poucas cores, tudo opaco no miolo.
  const t = await coresDoBake(page, { tipo: 'terreno', entrada: { largura: 12, altura: 12, resolucao: 0.75, base: 'grama', camadas: [{ material: 'terra', celulas: codificar([[4, 4], [5, 4], [6, 4], [4, 5], [5, 5], [6, 5]].map(c => [c[0]! * 2, c[1]! * 2] as const)) }] }, res: RES_PIXEL, estilo: 'pixel' }, [0, 0, 12, 12]);
  assert.equal(t.alfaMin, 255); assert.ok(t.cores <= 14, `terreno com ${t.cores} cores`);
  assert.deepEqual(erros, []); await ctx.close();
});

const objeto = (id: string, fonte: Record<string, unknown>, x: number, y: number) => ({ id, source: fonte, position: [x, y], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null });
const receita = (recipe: string, seed = 5, params: Record<string, unknown> = {}) => ({ kind: 'recipe', recipe, seed, params });

test('Pixel: um objeto assado tem alfa binário (mais a sombra dura), contorno de tinta de 1 px e poucas cores', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const medir = (contorno: boolean) => page.evaluate(async ([contorno, ppc]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const r = await executarBake({ tipo: 'objeto', receita: 'sofa', params: {}, seed: 5, res: ppc / 1.5, estilo: 'pixel', pixel: { ppc, contorno } });
    const t = document.createElement('canvas'); t.width = r.bitmap.width; t.height = r.bitmap.height; const g = t.getContext('2d', { willReadFrequently: true })!; g.drawImage(r.bitmap, 0, 0);
    const d = g.getImageData(0, 0, t.width, t.height).data, alfas = new Set<number>(), cores = new Set<string>(); let tinta = 0;
    for (let i = 0; i < d.length; i += 4) { alfas.add(d[i + 3]!); if (d[i + 3] === 255) { cores.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); if (d[i] === 11 && d[i + 1] === 10 && d[i + 2] === 16) tinta++; } }
    return { alfas: [...alfas].sort((a, b) => a - b), cores: cores.size, tinta, largura: t.width, altura: t.height, origem: r.origem };
  }, [contorno, 16] as const);
  const com = await medir(true), sem = await medir(false);
  assert.ok(com.alfas.every(a => a === 0 || a === 115 || a === 255), `meios-tons no objeto: ${com.alfas}`);
  assert.ok(com.tinta > 20, `contorno de tinta: ${com.tinta} pixels`); assert.ok(sem.tinta < com.tinta / 2, 'sem a opção, sem o contorno');
  assert.ok(com.cores <= 24, `${com.cores} cores sólidas no sofá`);
  const res = 16 / 1.5; assert.ok(Math.abs(com.origem[0] * res - Math.round(com.origem[0] * res)) < 1e-6, 'a origem fica na grade de pixels');
  assert.deepEqual(erros, []); await ctx.close();
});

test('Pixel: a casa de móveis no Pixel não tem nenhum objeto como marcador (receitas e itens gerados da coleção, todos pintados)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [3.75, 3.75], [14.25, 12.75]);
  const itens = [
    objeto('o1', receita('sofa', 5), 5.5, 5.5), objeto('o2', receita('mesa.retangular', 5), 9, 7.5), objeto('o3', receita('cama.casal', 5), 12.2, 10.5), objeto('o4', receita('estante.piso', 5), 5.2, 11.2),
    objeto('o5', receita('cadeira', 5), 8, 8.8), objeto('o6', receita('tapete.persa', 5), 8.5, 11), objeto('o7', receita('vaso.planta', 5), 13, 5),
    objeto('o8', { kind: 'asset', assetId: 'casa:chesterfield-vinho' }, 10.5, 5.2), objeto('o9', { kind: 'asset', assetId: 'casa:arbusto-verde' }, 4.5, 8.5),
  ];
  for (const o of itens) await sessao(page, '(s, o) => s.store.executar({ tipo: "item.adicionar", colecao: "props", item: o })', o);
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck();
  await page.getByLabel('Renderizador').selectOption('pixel');
  await page.waitForFunction(() => { const v = (window as unknown as { __atlas: { viewport(): { pintando: number; objetosPintados(): number } | null } }).__atlas.viewport(); return v !== null && v.pintando === 0 && v.objetosPintados() === 9; }, null, { timeout: 20_000 });
  assert.equal(await page.evaluate(() => (window as unknown as { __atlas: { viewport(): { objetosPintados(): number } } }).__atlas.viewport().objetosPintados()), 9, 'todos pintados, nenhum marcador');
  await page.waitForTimeout(300);
  const cores = await coresEm(page, [4, 4], [14, 12.5]); assert.ok(cores.size <= 32, `${cores.size} cores na cena`);
  await page.screenshot({ path: 'test-results/fase8-objetos.png', clip: await (async () => { const [x0, y0] = await clientDe(page, [3.5, 3.5]), [x1, y1] = await clientDe(page, [14.5, 13]); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; })() });
  // De volta ao Ilustrado os objetos continuam pintados (a textura do outro estilo fica até a nova chegar).
  await page.getByLabel('Renderizador').selectOption('illustrated');
  await page.waitForFunction(() => { const v = (window as unknown as { __atlas: { viewport(): { pintando: number; objetosPintados(): number } | null } }).__atlas.viewport(); return v !== null && v.pintando === 0 && v.objetosPintados() === 9; }, null, { timeout: 20_000 });
  assert.deepEqual(erros, []); await ctx.close();
});
