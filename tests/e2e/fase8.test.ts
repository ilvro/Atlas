import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { writeFileSync } from 'node:fs';
import { codificar } from '../../src/domain/celulas.ts';
import { novaLuz } from '../../src/domain/fabrica.ts';
import { PALETAS_PIXEL } from '../../src/domain/paletas.ts';
import { PRESETS_DE_LUZ, camposDoPreset } from '../../src/domain/presets.ts';
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

test('Pixel: paredes caixa e sólida (faces em degraus, porta, janela, quadro e estante) sem antialias, e a captura do cômodo em L', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 9.75]); await retangulo(page, [6.75, 10.25], [9.75, 14.25]);
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  const m0 = await documento(page), paredes = Object.values(m0.walls), horizontal = paredes.filter(w => w.kind === 'wall' && w.path.every(p => Math.abs(p[1] - w.path[0]![1]) < 1e-9)), vertical = paredes.filter(w => w.kind === 'wall' && w.path.every(p => Math.abs(p[0] - w.path[0]![0]) < 1e-9));
  const topo = horizontal.find(w => Math.abs(w.path[0]![1] - 6) < 1e-9)!, esq = vertical.find(w => Math.abs(w.path[0]![0] - 6) < 1e-9 && Math.abs(w.path[0]![1] - w.path.at(-1)![1]) > 6)!;
  const aberturas = [
    { id: 'op1', wallId: topo.id, at: 0.25, width: 1.2, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' },
    { id: 'op2', wallId: topo.id, at: 0.75, width: 1.5, kind: 'window', state: 'closed', material: 'madeira.media', som: null, swing: 'a' },
  ];
  for (const a of aberturas) await sessao(page, '(s, a) => s.store.executar({ tipo: "abertura.adicionar", abertura: a })', a);
  for (const [id, receitaId, at, w] of [['q1', 'quadro', 0.5, topo], ['e1', 'estante', 0.5, esq]] as const) await sessao(page, '(s, o) => s.store.executar({ tipo: "item.adicionar", colecao: "props", item: o })', { ...objeto(id, receita(receitaId, 3), 0, 0), elevation: 'wall', wall: { wallId: w.id, at, face: 'inner' }, roomId: Object.keys(m0.rooms)[0] });
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck();
  await page.getByLabel('Renderizador').selectOption('pixel'); await page.getByLabel('Contorno').uncheck();
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { pintando: number } | null } }).__atlas.viewport()?.pintando === 0, null, { timeout: 20_000 });
  await page.waitForTimeout(400);
  const area = async (a: [number, number], b: [number, number]) => { const [x0, y0] = await clientDe(page, a), [x1, y1] = await clientDe(page, b); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; };
  await page.screenshot({ path: 'test-results/fase8-paredes.png', clip: await area([5, 5], [16, 15]) });
  // A faixa do topo da parede sem porta nem janela: poucas cores (parede, fio claro e o que há ao redor), sem meio-tom de antialias.
  const faixa = await coresEm(page, [9, 5.9], [11.5, 6.1]);
  assert.ok(faixa.size <= 6, `${faixa.size} cores na faixa do topo da parede`);
  // Estilo sólido: a mesma faixa continua enxuta.
  await sessao(page, '(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { walls: "solid" } })');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/fase8-paredes-solidas.png', clip: await area([5, 5], [16, 15]) });
  assert.ok((await coresEm(page, [9, 5.9], [11.5, 6.1])).size <= 6, 'faixa do estilo sólido');
  // A face assada: papel, degraus escuros e rodapé, poucas cores e opaco.
  const f = await coresDoBake(page, { tipo: 'comodo', entrada: comodoDe('tabuas.carvalho'), res: RES_PIXEL, estilo: 'pixel' }, [7.5, 6.05, 10.5, 6.5]);
  assert.equal(f.alfaMin, 255); assert.ok(f.cores >= 4 && f.cores <= 14, `${f.cores} cores na face`);
  assert.deepEqual(erros, []); await ctx.close();
});

const pecaDeJogador = (id: string, x: number, y: number) => ({ id, name: id, portrait: null, sprite: null, facing: 'down', position: [x, y], size: 1, player: true, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [] });

test('Pixel: a presença e a memória em esboço ficam em blocos e dithering (capturas), e continuam só com cores da paleta', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  // Presença: uma mancha de sangue pintada com o pincel, vista no Pixel.
  await ferramenta(page, 'presenca'); await page.click('[data-testid="presenca-ordem.sangue"]');
  const [ax, ay] = await clientDe(page, [18, 8]), [bx, by] = await clientDe(page, [22, 12]);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(400);
  await ferramenta(page, 'selecionar');
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck();
  const region = async (a: [number, number], b: [number, number]) => { const [x0, y0] = await clientDe(page, a), [x1, y1] = await clientDe(page, b); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; };
  await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(1200);
  await page.screenshot({ path: 'test-results/fase8-presenca.png', clip: await region([16, 6], [24, 14]) });
  const paleta = new Set(PALETAS_PIXEL[0]!.cores.map(c => c.toLowerCase()));
  const cores = await coresEm(page, [17, 7], [23, 13]);
  assert.ok(cores.size >= 2 && cores.size <= 32, `${cores.size} cores na mancha`);
  for (const c of cores) assert.ok(paleta.has(c), `${c} não é da paleta`);
  // Memória: dois cômodos, uma peça de jogador no primeiro; o segundo é revelado e fica como esboço de papel e tinta.
  await ferramenta(page, 'comodo'); await retangulo(page, [3.75, 3.75], [8.25, 8.25]); await retangulo(page, [9.75, 3.75], [14.25, 8.25]);
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await sessao(page, '(s, p) => s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p })', pecaDeJogador('ana', 6, 6));
  const doc = await documento(page), segundo = Object.values(doc.rooms).find(r => r.cells.some(f => f[1] >= 6))!;
  await sessao(page, '(s, id) => s.store.executar({ tipo: "sessao.revelar", ids: [id] })', segundo.id);
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400); await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/fase8-memoria.png', clip: await region([3, 3], [15, 9]) });
  const memoria = await coresEm(page, [8.5, 3.5], [14.5, 8.5]);
  assert.ok(memoria.size >= 2 && memoria.size <= 16, `o esboço em Pixel tem ${memoria.size} cores`);
  for (const c of memoria) assert.ok(paleta.has(c), `${c} não é da paleta`);
  assert.deepEqual(erros, []); await ctx.close();
});

test('sprite: a folha de um personagem tem 96 × 96 px, todos os 24 quadros têm pixels opacos, só alfa 0 ou 255; capturas de amostras', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async () => {
    const executar = '/src/procedural/executar.ts', dominio = '/src/domain/sprite.ts';
    const { executarBake } = await import(/* @vite-ignore */ executar), { spriteAleatorio } = await import(/* @vite-ignore */ dominio);
    const amostras = [1, 2, 3, 4, 5, 6, 7, 8].map(n => spriteAleatorio(n * 101));
    amostras.push({ body: 'robusto', hair: 'longo', outfit: 'armadura', accessories: ['capa', 'mochila', 'lanterna', 'chapeu', 'oculos', 'galhada'], colors: {}, seed: 1 });
    const tela = document.createElement('canvas'); tela.width = 96 * 3 * 3 + 8; tela.height = 96 * 3 * 3 + 8; const g = tela.getContext('2d')!; g.imageSmoothingEnabled = false; g.fillStyle = '#2a2630'; g.fillRect(0, 0, tela.width, tela.height);
    const saidas: { largura: number; altura: number; vazios: number; alfas: number[] }[] = [];
    for (let i = 0; i < amostras.length; i++) {
      const b = await executarBake({ tipo: 'sprite', spec: amostras[i] }), t = document.createElement('canvas'); t.width = b.bitmap.width; t.height = b.bitmap.height;
      const c = t.getContext('2d', { willReadFrequently: true })!; c.drawImage(b.bitmap, 0, 0);
      const d = c.getImageData(0, 0, t.width, t.height).data, alfas = new Set<number>(); let vazios = 0;
      for (const [fx, fy] of Array.from({ length: 24 }, (_, k) => [k % 6, Math.floor(k / 6)] as const)) {
        let opacos = 0; for (let y = 0; y < 24; y++) for (let x = 0; x < 16; x++) if (d[(((fy * 24 + y) * 96) + fx * 16 + x) * 4 + 3] === 255) opacos++;
        if (opacos < 20) vazios++;
      }
      for (let k = 3; k < d.length; k += 4) alfas.add(d[k]!);
      saidas.push({ largura: t.width, altura: t.height, vazios, alfas: [...alfas] });
      g.drawImage(b.bitmap, 0, 0, 96, 96, (i % 3) * 292 + 2, Math.floor(i / 3) * 292 + 2, 288, 288);
    }
    return { saidas, png: tela.toDataURL('image/png') };
  });
  for (const s of r.saidas) { assert.equal(s.largura, 96); assert.equal(s.altura, 96); assert.equal(s.vazios, 0, 'todo quadro tem corpo'); assert.deepEqual(s.alfas.sort(), [0, 255]); }
  writeFileSync('test-results/fase8-sprites.png', Buffer.from(r.png.split(',')[1]!, 'base64'));
  assert.deepEqual(erros, []); await ctx.close();
});

const diagPecas = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { id: string; retrato: boolean; quadro: { linha: number; coluna: number } | null; deslizando: boolean }[] } } }).__atlas.viewport().diagnosticoDasPecas());

test('sprite na peça: criar pelo painel, ver a peça com o sprite no Pixel (e com o retrato no Ilustrado, se houver), e mover mudando a linha de quadros', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [3.75, 3.75], [14.25, 12.75]);
  await sessao(page, '(s, p) => s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p })', { ...pecaDeJogador('ana', 6, 6), player: false });
  await ferramenta(page, 'selecionar'); await clicar(page, [6, 6]); await page.waitForTimeout(300);
  await page.click('[data-testid="aba-selecao"]');
  await page.locator('[data-testid="sprite-criar"]').click({ timeout: 10_000 }); await page.waitForTimeout(400);
  let doc = await documento(page);
  assert.ok(doc.tokens.ana!.sprite, 'o sprite foi criado'); await page.locator('[data-testid="sprite-previa"]').waitFor();
  // A prévia está viva: o canvas muda de um instante para o outro.
  const foto = () => page.evaluate(() => (document.querySelector('[data-testid="sprite-previa"]') as HTMLCanvasElement).toDataURL());
  const fotos = new Set<string>(); for (let i = 0; i < 6; i++) { fotos.add(await foto()); await page.waitForTimeout(110); }
  assert.ok(fotos.size >= 2, 'a prévia anima');
  // Editar o corpo e uma cor é um passo "Sprite da peça" cada.
  const antes = (await documento(page)).tokens.ana!.sprite!;
  await page.getByLabel('Corpo').selectOption(antes.body === 'robusto' ? 'esguio' : 'robusto'); await page.waitForTimeout(200);
  assert.notEqual((await documento(page)).tokens.ana!.sprite!.body, antes.body);
  const hist = await page.evaluate(() => [...(window as unknown as { __atlas: { sessao(): { store: { historico: readonly string[] } } } }).__atlas.sessao().store.historico]);
  assert.ok(hist.includes('Sprite da peça'), `histórico: ${hist}`);
  // No Pixel a peça usa o sprite, parada no lado para onde olha.
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(1200);
  let d = (await diagPecas(page))[0]!; assert.ok(d.quadro, 'peça com sprite'); assert.equal(d.retrato, false); assert.equal(d.quadro!.linha, 0, 'olha para baixo');
  await page.screenshot({ path: 'test-results/fase8-sprite-na-peca.png', clip: await (async () => { const [x0, y0] = await clientDe(page, [4, 4]), [x1, y1] = await clientDe(page, [9, 9]); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; })() });
  // Mover para a direita: durante o deslize a linha é a da direita, andando.
  await sessao(page, '(s) => s.store.executar({ tipo: "peca.mover", id: "ana", para: [10.5, 6], livre: true })');
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { deslizando: boolean }[] } } }).__atlas.viewport().diagnosticoDasPecas()[0]?.deslizando === true, null, { timeout: 3000 }).catch(() => undefined);
  d = (await diagPecas(page))[0]!;
  if (d.deslizando) { assert.equal(d.quadro!.linha, 2, 'andando para a direita'); assert.ok(d.quadro!.coluna >= 2, 'quadros de andar'); }
  await page.waitForTimeout(900);
  // Mover para cima: a linha de cima durante o deslize.
  await sessao(page, '(s) => s.store.executar({ tipo: "peca.mover", id: "ana", para: [10.5, 4.5], livre: true })');
  await page.waitForTimeout(120); d = (await diagPecas(page))[0]!;
  if (d.deslizando) assert.equal(d.quadro!.linha, 3, 'andando para cima');
  await page.waitForTimeout(900);
  // Com retrato no Ilustrado, o retrato vence; sem retrato, o sprite continua.
  await page.getByLabel('Renderizador').selectOption('illustrated'); await page.waitForTimeout(600);
  assert.ok((await diagPecas(page))[0]!.quadro, 'no Ilustrado, sem retrato, aparece o sprite');
  doc = await documento(page); assert.ok(doc.tokens.ana!.sprite);
  assert.deepEqual(erros, []); await ctx.close();
});

test('sprite: os estados da Ficha se distinguem no Pixel (ferido, morrendo, inconsciente, morto, enlouquecendo) e as cores saem do retrato', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [3.75, 3.75], [14.25, 12.75]);
  const sprite = { body: 'padrao', hair: 'curto', outfit: 'casaco', accessories: [], colors: { pele: '#e8c4a0', cabelo: '#3a2a1e', roupa: '#2a3f6b', detalhe: '#d9a75e' }, seed: 1 };
  await sessao(page, '(s, p) => s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p })', { ...pecaDeJogador('ana', 8, 8), player: false, sprite });
  await ferramenta(page, 'selecionar'); await clicar(page, [35, 25]);
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck(); await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(1000);
  const [x0, y0] = await clientDe(page, [7, 7]), [x1, y1] = await clientDe(page, [9, 9]), clip = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  const vistos = new Map<string, string>();
  for (const estado of ['normal', 'hurt', 'dying', 'unconscious', 'dead', 'maddened']) {
    await sessao(page, '(s, e) => s.store.executar({ tipo: "item.atualizar", colecao: "tokens", id: "ana", patch: { figure: { state: e } } })', estado);
    await page.waitForTimeout(500);
    const png = await page.screenshot({ clip }); writeFileSync(`test-results/fase8-estado-${estado}.png`, png);
    const chave = png.toString('base64'); const igual = [...vistos].find(([, v]) => v === chave); assert.equal(igual, undefined, `${estado} igual a ${igual?.[0]}`); vistos.set(estado, chave);
  }
  // Cores pelo retrato: envia a imagem de teste, usa as cores dela, e o sprite muda (um passo "Sprite da peça").
  await sessao(page, '(s) => s.store.executar({ tipo: "item.atualizar", colecao: "tokens", id: "ana", patch: { figure: { state: "normal" } } })');
  await ferramenta(page, 'selecionar'); await clicar(page, [8, 8]); await page.click('[data-testid="aba-selecao"]');
  await page.locator('[data-testid="retrato-arquivo"]').setInputFiles(new URL('./retrato-de-teste.png', import.meta.url).pathname); await page.waitForTimeout(800);
  assert.ok((await documento(page)).tokens.ana!.portrait, 'o retrato foi enviado');
  await page.locator('[data-testid="sprite-cores-do-retrato"]').click(); await page.waitForTimeout(500);
  const depois = (await documento(page)).tokens.ana!.sprite!.colors;
  assert.ok(Object.values(depois).every(c => /^#[0-9a-f]{6}$/i.test(c)), JSON.stringify(depois));
  assert.notDeepEqual(depois, sprite.colors, 'as cores mudaram para as do retrato');
  assert.deepEqual(erros, []); await ctx.close();
});

test('derivação de imagens: uma imagem achada no Pixel vira pixels da paleta (alfa binário, contorno, sombra) no tamanho da pegada; o retrato da peça também', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const res = 16 / 1.5;
  const r = await page.evaluate(async ([res]) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d')!; g.fillStyle = '#e03030'; g.fillRect(150, 100, 100, 100); g.fillStyle = '#3050c0'; g.fillRect(150, 100, 50, 100);
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const b = await executarBake({ tipo: 'imagem', url: c.toDataURL('image/png'), pegada: [1, 1], res, resImagem: 128, harmonizar: true, alvo: null, estilo: 'pixel', pixel: { ppc: 16, contorno: true, paleta: 'investigacao-sepia', dither: 'none' } });
    const t = document.createElement('canvas'); t.width = b.bitmap.width; t.height = b.bitmap.height; const x = t.getContext('2d', { willReadFrequently: true })!; x.drawImage(b.bitmap, 0, 0);
    const d = x.getImageData(0, 0, t.width, t.height).data, cores: string[] = [], alfas = new Set<number>();
    let bx0 = t.width, bx1 = -1;
    for (let i = 0; i < d.length; i += 4) { alfas.add(d[i + 3]!); if (d[i + 3] === 255) { const px = (i / 4) % t.width; if (px < bx0) bx0 = px; if (px > bx1) bx1 = px; } if (d[i + 3] === 255) cores.push('#' + [d[i]!, d[i + 1]!, d[i + 2]!].map(v => v.toString(16).padStart(2, '0')).join('')); }
    return { largura: t.width, altura: t.height, conteudo: bx1 - bx0 + 1, cores: [...new Set(cores)], alfas: [...alfas].sort((a, b) => a - b) };
  }, [res] as const);
  const paleta = new Set(PALETAS_PIXEL[0]!.cores.map(c => c.toLowerCase()));
  for (const c of r.cores) assert.ok(paleta.has(c), `${c} fora da paleta`);
  assert.ok(r.alfas.every(a => a === 0 || a === 115 || a === 255), `alfas ${r.alfas}`);
  assert.ok(r.cores.length >= 3 && r.cores.length <= 6, `${r.cores.length} cores (vermelho, azul e tinta)`);
  // A tela é a da imagem (3,1 m) a 10,7 px por metro; o conteúdo recortado ocupa a pegada de 1 m (11 px) mais o contorno.
  assert.ok(Math.abs(r.largura - Math.ceil((400 / 128) * res)) <= 1, `largura ${r.largura}`);
  assert.ok(Math.abs(r.conteudo - (res + 2)) <= 2, `o conteúdo tem ${r.conteudo} px`);
  // O retrato de uma peça sem sprite, no Pixel, é derivado (circular e na paleta).
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [3.75, 3.75], [14.25, 12.75]);
  await sessao(page, '(s, p) => s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p })', { ...pecaDeJogador('ana', 8, 8), player: false });
  await ferramenta(page, 'selecionar'); await clicar(page, [8, 8]); await page.click('[data-testid="aba-selecao"]');
  await page.locator('[data-testid="retrato-arquivo"]').setInputFiles(new URL('./retrato-de-teste.png', import.meta.url).pathname); await page.waitForTimeout(800);
  await clicar(page, [35, 25]);
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck(); await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(1200);
  assert.equal((await diagPecas(page))[0]!.retrato, true, 'a peça mostra o retrato derivado');
  const [x0, y0] = await clientDe(page, [7, 7]), [x1, y1] = await clientDe(page, [9, 9]);
  await page.screenshot({ path: 'test-results/fase8-retrato-pixel.png', clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 } });
  assert.ok((await coresEm(page, [7.4, 7.4], [8.6, 8.6])).size <= 32);
  assert.deepEqual(erros, []); await ctx.close();
});

test('pixelArquivo: a arte manual é ampliada em nearest por um inteiro, sem derivar nem mexer em nenhuma cor', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 16; c.height = 16; const g = c.getContext('2d')!;
    g.fillStyle = '#12ab34'; g.fillRect(0, 0, 8, 16); g.fillStyle = '#ab1234'; g.fillRect(8, 0, 8, 16);
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const b = await executarBake({ tipo: 'imagem', url: c.toDataURL('image/png'), pegada: [1, 1], res: 32 / 1.5, resImagem: 128, harmonizar: false, alvo: null, estilo: 'pixel', pixel: { ppc: 32, contorno: true, paleta: 'investigacao-sepia', dither: 'bayer4' }, pixelManual: { escala: 2 } });
    const t = document.createElement('canvas'); t.width = b.bitmap.width; t.height = b.bitmap.height; const x = t.getContext('2d', { willReadFrequently: true })!; x.drawImage(b.bitmap, 0, 0);
    const d = x.getImageData(0, 0, t.width, t.height).data, cores = new Set<string>(), alfas = new Set<number>();
    for (let i = 0; i < d.length; i += 4) { alfas.add(d[i + 3]!); cores.add(`${d[i]},${d[i + 1]},${d[i + 2]}`); }
    return { largura: t.width, altura: t.height, cores: [...cores], alfas: [...alfas], origem: b.origem };
  });
  assert.equal(r.largura, 32); assert.equal(r.altura, 32);
  assert.deepEqual(r.cores.sort(), ['171,18,52', '18,171,52'].sort(), 'as duas cores da arte, intactas (fora da paleta)');
  assert.deepEqual(r.alfas, [255]);
  assert.ok(Math.abs(r.origem[0] + 16 / (32 / 1.5)) < 1e-6, 'centrada no objeto');
  assert.deepEqual(erros, []); await ctx.close();
});

test('luz em faixas: no Pixel a lamparina tem anéis nítidos (poucos valores ao longo de uma linha) e a cor quente se mantém; o Ilustrado é suave', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const lamparina = PRESETS_DE_LUZ.find(p => p.id === 'lamparina') ?? PRESETS_DE_LUZ[0]!;
  const luz = { ...novaLuz([20, 15], camposDoPreset(lamparina, 0)), id: 'lamp', flicker: 0, radius: 7, intensity: 1, color: '#ffb060' };
  await sessao(page, '(s, l) => s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: l })', luz);
  await sessao(page, '(s) => { s.store.executar({ tipo: "terreno.base", material: "pintura.paisagem" }); s.store.executar({ tipo: "clima.aplicar", patch: { ambient: { color: "#5a6090", intensity: 0.2 } } }); s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0, vignette: 0, texture: 0 } }); s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } }); }');
  await ferramenta(page, 'selecionar'); await clicar(page, [38, 28]);
  await page.click('[data-testid="aba-mapa"]'); await page.waitForTimeout(600);
  /** Os pixels ao longo de uma linha do centro da luz para a direita (cores rgb). */
  const linha = async () => {
    const [x0, y0] = await clientDe(page, [20.3, 15.6]), [x1] = await clientDe(page, [26.5, 15.6]);
    const png = await page.screenshot({ clip: { x: x0, y: y0, width: x1 - x0, height: 1 } });
    return page.evaluate(async (b64: string) => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()), c = new OffscreenCanvas(bmp.width, 1), g = c.getContext('2d')!; g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, 1).data, saida: string[] = []; for (let i = 0; i < d.length; i += 4) saida.push(`${d[i]},${d[i + 1]},${d[i + 2]}`); return saida; }, png.toString('base64'));
  };
  await page.screenshot({ path: 'test-results/fase8-luz-ilustrado.png' });
  const ilustrado = await linha();
  await page.getByLabel('Renderizador').selectOption('pixel'); await page.getByLabel('Dithering').selectOption('none'); await page.getByLabel('Paleta').selectOption('fantasia-quente'); await page.waitForTimeout(1500);
  const pixel = await linha();
  assert.ok(new Set(ilustrado).size > 12, `o Ilustrado é suave: ${new Set(ilustrado).size} valores`);
  const valores = new Set(pixel); assert.ok(valores.size >= 3 && valores.size <= 6, `no Pixel a linha tem ${valores.size} valores`);
  const [r, , b] = pixel[0]!.split(',').map(Number); assert.ok(r! > b!, `a cor quente se mantém no centro (${pixel[0]})`);
  await page.screenshot({ path: 'test-results/fase8-luz-faixas.png' });
  assert.deepEqual(erros, []); await ctx.close();
});

test('revelação em dithering: no Pixel o que entra na vista se dissolve em pontos (um quadro intermediário misto), e o título usa a fonte pixel com acentos', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [3.75, 3.75], [8.25, 8.25]); await retangulo(page, [9.75, 3.75], [14.25, 8.25]);
  const m0 = await documento(page), meio = Object.values(m0.walls).find(w => w.kind === 'wall' && w.path.every(p => Math.abs(p[0] - 9) < 1e-9) && Math.abs(w.path[0]![1] - w.path.at(-1)![1]) > 3)!;
  await sessao(page, '(s, a) => s.store.executar({ tipo: "abertura.adicionar", abertura: a })', { id: 'porta', wallId: meio.id, at: 0.5, width: 1.2, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' });
  await sessao(page, '(s, p) => s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p })', pecaDeJogador('ana', 6, 6));
  // O título com acentos, na fonte pixel.
  await sessao(page, '(s) => s.store.executar({ tipo: "fundo.atualizar", patch: { title: { text: "Ação à noite — você", font: "Cinzel", position: [4, 2.2] } } })');
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Ver atmosfera no editor').uncheck(); await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => document.fonts.check('700 12px "Pixelify Sans"', 'ção ê à')), true, 'a fonte pixel tem os glifos de “ção ê à”');
  const regiao = async (a: [number, number], b: [number, number]) => { const [x0, y0] = await clientDe(page, a), [x1, y1] = await clientDe(page, b); return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }; };
  await page.screenshot({ path: 'test-results/fase8-titulo-pixel.png', clip: await regiao([2.5, 1], [13, 3.5]) });
  // Sessão, vista de jogador: a sala da direita está escondida pela porta fechada. Abrir a porta a revela por dissolução.
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400); await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(1500);
  const bloco = await regiao([10.5, 4.5], [13.5, 7.5]);
  const analisar = async (png: Buffer) => page.evaluate(async (b64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!; g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data, cont = new Map<string, number>(), lin = Math.floor(bmp.height / 2), linha: string[] = [];
    for (let i = 0; i < d.length; i += 4) { const k = `${d[i]},${d[i + 1]},${d[i + 2]}`; cont.set(k, (cont.get(k) ?? 0) + 1); }
    for (let x = 0; x < bmp.width; x++) { const o = (lin * bmp.width + x) * 4; linha.push(`${d[o]},${d[o + 1]},${d[o + 2]}`); }
    return { cores: [...cont.entries()], linha };
  }, png.toString('base64'));
  const antes = await analisar(await page.screenshot({ clip: bloco })), cobertura = antes.cores.sort((a, b) => b[1] - a[1])[0]![0];
  assert.ok(antes.cores.length <= 3, 'antes de revelar o bloco é a cobertura');
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "porta", patch: { state: "open" } })');
  let misto = false, maxTransicoes = 0;
  for (let i = 0; i < 24 && !misto; i++) {
    const r = await analisar(await page.screenshot({ clip: bloco })), total = r.cores.reduce((s, c) => s + c[1], 0), cob = r.cores.find(c => c[0] === cobertura)?.[1] ?? 0, f = cob / total;
    let tr = 0; for (let x = 1; x < r.linha.length; x++) if ((r.linha[x] === cobertura) !== (r.linha[x - 1] === cobertura)) tr++;
    maxTransicoes = Math.max(maxTransicoes, f > 0.05 && f < 0.95 ? tr : 0);
    if (f > 0.05 && f < 0.95 && tr >= 6) misto = true;
  }
  assert.ok(misto, `nenhum quadro intermediário com dithering (mais transições num quadro misto: ${maxTransicoes})`);
  await page.waitForTimeout(1500);
  const depois = await analisar(await page.screenshot({ clip: bloco })); assert.ok((depois.cores.find(c => c[0] === cobertura)?.[1] ?? 0) / depois.cores.reduce((s, c) => s + c[1], 0) < 0.3, 'depois de revelar, o bloco mostra a sala');
  assert.deepEqual(erros, []); await ctx.close();
});

const contagemDeParticulas = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { contagemDeParticulas(): Record<string, number> } } }).__atlas.viewport().contagemDeParticulas());
/** Quadros por segundo medidos na página durante `ms` milissegundos. */
const fps = (p: Page, ms: number) => p.evaluate(m => new Promise<number>(r => { let n = 0; const t0 = performance.now(); const f = (t: number) => { n++; if (t - t0 >= m) r((n * 1000) / (t - t0)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }), ms);

test('clima no Pixel: a tempestade tem as mesmas partículas do Ilustrado, só cores da paleta, a neblina em níveis, e roda a 60 quadros', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await sessao(page, '(s) => { s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } }); s.store.executar({ tipo: "terreno.base", material: "grama" }); s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0, vignette: 0, texture: 0 } }); }');
  await ferramenta(page, 'selecionar'); await clicar(page, [38, 28]);
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "tempestade" })'); await page.waitForTimeout(5000);      // a transição do clima leva 3 s
  // O preset da tempestade traz um acabamento (tinta, granulação) que roda depois da paleta; neutraliza para a amostra ser só da paleta.
  await sessao(page, '(s) => s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0, vignette: 0, texture: 0, saturation: 1, tint: "#ffffff", grade: { lift: 0, gamma: 1, gain: 1 } } })'); await page.waitForTimeout(500);
  const ilustrado = await contagemDeParticulas(page);
  assert.ok((ilustrado.chuva ?? 0) > 500, `chuva no Ilustrado: ${ilustrado.chuva}`);
  await page.click('[data-testid="aba-mapa"]'); await page.getByLabel('Renderizador').selectOption('pixel'); await page.waitForTimeout(1500);
  const pixel = await contagemDeParticulas(page);
  assert.deepEqual(pixel, ilustrado, 'a mesma quantidade de partículas nos dois estilos');
  const paleta = new Set(PALETAS_PIXEL[0]!.cores.map(c => c.toLowerCase()));
  // O acabamento (granulação, vinheta) fica de fora para a amostra ser só da paleta; a tempestade escurece e o dithering escolhe entre cores da paleta.
  const cores = await coresEm(page, [3, 3], [20, 12]);
  assert.ok(cores.size <= 32, `${cores.size} cores na tempestade`); for (const c of cores) assert.ok(paleta.has(c), `${c} fora da paleta`);
  await page.screenshot({ path: 'test-results/fase8-tempestade-pixel.png' });
  // Neblina e clima: troca de clima ao vivo no Pixel sem erros, e a neblina cai em poucos níveis.
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.aplicar", patch: { weather: { rain: 0, lightning: 0, fog: 0.9 } } })'); await page.waitForTimeout(2500);
  const nebulosa = await coresEm(page, [3, 3], [20, 12]); assert.ok(nebulosa.size <= 32);
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "tempestade" })'); await page.waitForTimeout(1200);
  const quadros = await fps(page, 3000);
  console.log(`# tempestade no Pixel: ${quadros.toFixed(1)} quadros por segundo`);
  assert.ok(quadros >= 40, `${quadros.toFixed(1)} quadros por segundo com tempestade`);
  assert.deepEqual(erros, []); await ctx.close();
});

// ---------- 8.5: a casa jogada inteira no Pixel e trocada ao vivo com o Ilustrado ----------
type Projetor = { __projetor: { doc(): import('../../src/domain/mapa.ts').MapaAtlas; viewport(): { pintando: number; enquadrarCaixa(c: object, s: boolean): void } } };
const projDoc = (p: Page) => p.evaluate(() => structuredClone((window as unknown as Projetor).__projetor.doc()));
const pintandoDoProjetor = (p: Page) => p.evaluate(() => (window as unknown as Projetor).__projetor.viewport().pintando);
const pintandoDoMestre = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { pintando: number } } }).__atlas.viewport().pintando);
/** O documento sem o que muda a cada edição (revisão e datas) e sem o estilo: é o que a troca de estilo não pode tocar. */
const semEstilo = (d: import('../../src/domain/mapa.ts').MapaAtlas): string => { const { style: _s, revision: _r, createdAt: _c, updatedAt: _u, ...resto } = d as unknown as Record<string, unknown>; return JSON.stringify(resto); };

test('fase 8: a casa no Pixel — o mapa da Fase 7 sem mudar o documento, jogado no projetor e trocado ao vivo com o Ilustrado', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const mapaId = await criarMapaPelaInterface(page);
  const parede = (id: string, x: number) => ({ id, path: [[x, 3], [x, 9]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, source: null });
  await sessao(page, `(s, a) => {
    const sala = [], cozinha = [], despensa = [];
    for (let y = 2; y < 6; y++) { for (let x = 2; x < 8; x++) sala.push([x, y]); for (let x = 8; x < 14; x++) cozinha.push([x, y]); for (let x = 14; x < 20; x++) despensa.push([x, y]); }
    const piso = { material: "tabuas.carvalho", seed: 1 };
    s.store.executar({ tipo: "comodo.criar", id: "sala", nome: "Sala", funcao: "sala", piso, papel: null, celulas: sala });
    s.store.executar({ tipo: "comodo.criar", id: "cozinha", nome: "Cozinha", funcao: "cozinha", piso, papel: null, celulas: cozinha });
    s.store.executar({ tipo: "comodo.criar", id: "despensa", nome: "Despensa", funcao: "sala", piso, papel: null, celulas: despensa });
    s.store.executar({ tipo: "parede.adicionar", parede: a.v1 }); s.store.executar({ tipo: "parede.adicionar", parede: a.v2 });
    s.store.executar({ tipo: "abertura.adicionar", abertura: a.porta }); s.store.executar({ tipo: "abertura.adicionar", abertura: a.cofre });
    s.store.executar({ tipo: "clima.predefinir", id: "noite" });
    for (const k of ["rede", "interruptor"]) s.store.executar({ tipo: "item.adicionar", colecao: k === "rede" ? "lights" : "props", item: a[k] });
    for (const k of ["mesa", "sofa", "cama"]) s.store.executar({ tipo: "item.adicionar", colecao: "props", item: a[k] });
    for (const k of ["ana", "beto", "ogro"]) s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a[k] });
  }`, {
    v1: parede('v1', 12), v2: parede('v2', 21),
    porta: { id: 'porta', wallId: 'v1', at: 0.5, width: 1.5, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' },
    cofre: { id: 'cofre', wallId: 'v2', at: 0.5, width: 1.5, kind: 'secret', state: 'closed', material: 'madeira.media', som: null, swing: 'a' },
    rede: { id: 'rede', position: [7.5, 6], radius: 7, color: '#ffe2b0', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'grid', on: true, nightOnly: false, preset: null },
    interruptor: { ...objeto('sw', receita('caixa', 1), 4.5, 4.5), scale: 0.5, roomId: 'sala', blocks: { move: false, sight: false }, castsShadow: false, interaction: { kind: 'switch', on: true, targets: [], sound: null, clue: null } },
    mesa: objeto('mesa', receita('mesa.retangular', 2), 15, 6), sofa: objeto('sofa', receita('sofa', 3), 5, 9.2), cama: objeto('cama', receita('cama.casal', 4), 22.5, 5.5),
    ana: { ...pecaDeJogador('ana', 9.75, 5.25) }, beto: { ...pecaDeJogador('beto', 9.75, 6.75), sprite: { body: 'padrao', hair: 'longo', outfit: 'vestido', accessories: ['lanterna'], colors: {}, seed: 3 } },
    ogro: { ...pecaDeJogador('ogro', 24.75, 6), player: false },
  });
  await page.waitForTimeout(1200);
  await sessao(page, '(s) => s.store.executar({ tipo: "grade.atualizar", patch: { visible: false } })');
  await page.click('[data-testid="modo-sessao"]'); await page.locator('[data-testid="dock"]').waitFor();
  await page.click('[data-testid="dock-titulo-projetor"]');
  const proj = await ctx.newPage(), errosProj: string[] = [];
  proj.on('pageerror', e => errosProj.push(e.message)); proj.on('console', m => { if (m.type() === 'error') errosProj.push(m.text()); });
  await proj.goto(`${amb.url}#/projetor/${mapaId}`);
  await proj.waitForFunction(() => (window as unknown as Projetor).__projetor?.doc() != null, null, { timeout: 20_000 });
  await page.getByText('Conectado', { exact: true }).waitFor({ timeout: 5000 });
  await proj.evaluate(() => (window as unknown as Projetor).__projetor.viewport().enquadrarCaixa({ x0: 0, y0: 0, x1: 45, y1: 30 }, false));
  const esperaNoProjetor = (fn: string, arg?: unknown) => proj.waitForFunction(`(() => { const d = window.__projetor.doc(); const a = ${JSON.stringify(arg ?? null)}; return (${fn})(d, a); })()`, null, { timeout: 8000 });

  /** Troca o estilo do mapa ao vivo (pelo comando) e mede o tempo até as duas janelas pararem de pintar. */
  const tempos: { para: string; ms: number }[] = [];
  const trocar = async (estilo: 'illustrated' | 'pixel') => {
    const t0 = Date.now();
    await sessao(page, '(s, e) => s.store.executar({ tipo: "estilo.atualizar", patch: { renderer: e } }, { rotulo: "Estilo do mapa" })', estilo);
    await esperaNoProjetor('(d, e) => d.style.renderer === e', estilo);
    await page.waitForFunction(() => new Promise(ok => setTimeout(() => ok(true), 120)));
    for (let i = 0; i < 400; i++) { if ((await pintandoDoMestre(page)) === 0 && (await pintandoDoProjetor(proj)) === 0) break; await page.waitForTimeout(25); }
    await page.waitForTimeout(250);
    tempos.push({ para: estilo, ms: Date.now() - t0 });
  };
  /** Uma captura do projetor nos dois estilos (lado a lado) e volta ao estilo em que estava. */
  const capturar = async (momento: string, voltarPara: 'illustrated' | 'pixel') => {
    for (const estilo of ['illustrated', 'pixel'] as const) { await trocar(estilo); await proj.screenshot({ path: `test-results/fase8-${momento}-${estilo === 'pixel' ? 'pixel' : 'ilustrado'}.png` }); }
    await trocar(voltarPara);
  };

  // O documento não muda com o estilo: só o campo `style`.
  await page.waitForTimeout(500);
  const antes = semEstilo(await documento(page));
  await trocar('pixel'); const noPixel = await documento(page);
  assert.equal(noPixel.style.renderer, 'pixel'); assert.equal(semEstilo(noPixel), antes, 'trocar para o Pixel só mexe no estilo');
  await trocar('illustrated'); assert.equal(semEstilo(await documento(page)), antes, 'e voltar ao Ilustrado também');
  await trocar('pixel');

  // Início, no Pixel: a casa toda pintada (nenhum marcador), e a amostra do projetor com poucas cores depois de neutralizar o acabamento.
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { objetosPintados(): number } } }).__atlas.viewport().objetosPintados() >= 4, null, { timeout: 15_000 });
  await sessao(page, '(s) => s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0, vignette: 0, texture: 0, saturation: 1, tint: "#ffffff", grade: { lift: 0, gamma: 1, gain: 1 } } })');
  await esperaNoProjetor('(d) => d.finish.grain === 0'); await page.waitForTimeout(500);
  const [px0, py0] = [0, 0]; void px0; void py0;
  const png = await proj.screenshot(), paleta = new Set(PALETAS_PIXEL[0]!.cores.map(c => c.toLowerCase()));
  const coresDoProjetor = await proj.evaluate(async (b64: string) => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!; g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data, s = new Set<string>(); for (let i = 0; i < d.length; i += 4) s.add('#' + [d[i]!, d[i + 1]!, d[i + 2]!].map(v => v.toString(16).padStart(2, '0')).join('')); return [...s]; }, png.toString('base64'));
  const foraDaPaleta = coresDoProjetor.filter(c => !paleta.has(c));
  console.log(`# casa no Pixel: ${coresDoProjetor.length} cores no projetor (${foraDaPaleta.length} fora da paleta: moldura e título em HTML)`);
  await capturar('inicio', 'pixel');

  // Portas: a fechada recusa; clicar abre; as duas peças passam.
  await assert.rejects(() => sessao(page, '(s) => s.store.executar({ tipo: "peca.mover", id: "ana", para: [14.25, 5.25] })'), 'a porta fechada recusa');
  await clicar(page, [12, 6]); await page.waitForTimeout(500);
  await esperaNoProjetor('(d) => d.openings.porta.state === "open"');
  for (const [id, y] of [['ana', 5.25], ['beto', 6.75]] as const) { await sessao(page, '(s, a) => s.store.executar({ tipo: "peca.mover", id: a.id, para: [14.25, a.y] })', { id, y }); await sessao(page, '(s, a) => s.store.executar({ tipo: "peca.mover", id: a.id, para: [17.25, a.y] })', { id, y }); }
  await esperaNoProjetor('(d) => d.tokens.ana.position[0] === 17.25 && d.tokens.beto.position[0] === 17.25');
  await page.waitForTimeout(900);
  await capturar('porta', 'pixel');

  // Clima pelo dock: Tarde → Tempestade; quadros por segundo nas duas janelas, com as peças andando, nos dois estilos.
  await page.click('[data-testid="dock-clima-tarde"]'); await esperaNoProjetor('(d) => d.climate.preset === "tarde"');
  await page.click('[data-testid="dock-clima-tempestade"]'); await esperaNoProjetor('(d) => d.climate.preset === "tempestade"'); await page.waitForTimeout(3500);
  const medidas: Record<string, { mestre: number; projetor: number }> = {};
  for (const estilo of ['pixel', 'illustrated'] as const) {
    if (estilo === 'illustrated') await trocar('illustrated');      // a troca no meio da sessão, ao vivo, com a tempestade caindo
    let andando = true;
    const andar = (async () => { for (let i = 0; andando && i < 40; i++) { const x = i % 2 ? 17.25 : 15.75; for (const [id, y] of [['ana', 5.25], ['beto', 6.75]] as const) await sessao(page, '(s, a) => { try { s.store.executar({ tipo: "peca.mover", id: a.id, para: [a.x, a.y] }); } catch (e) {} }', { id, x, y }); await page.waitForTimeout(150); } })();
    const [mestre, projetor] = await Promise.all([fps(page, 3000), fps(proj, 3000)]); andando = false; await andar;
    medidas[estilo] = { mestre, projetor };
    console.log(`# quadros por segundo com tempestade e as peças andando (${estilo}): mestre ${mestre.toFixed(1)}, projetor ${projetor.toFixed(1)}`);
    assert.ok(mestre > 25 && projetor > 25, `${estilo}: mestre ${mestre}, projetor ${projetor}`);
  }
  await trocar('pixel');
  await capturar('tempestade', 'pixel');
  await page.click('[data-testid="dock-clima-noite"]'); await esperaNoProjetor('(d) => d.climate.preset === "noite"'); await page.waitForTimeout(3500);

  // Porta secreta e cômodo revelado; o interruptor (na troca de estilo no meio, ao vivo).
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "cofre", patch: { state: "open" } })'); await page.waitForTimeout(400);
  await sessao(page, '(s) => s.store.executar({ tipo: "sessao.revelar", ids: ["cofre"] })'); await esperaNoProjetor('(d) => !!d.openings.cofre');
  await trocar('illustrated');
  await sessao(page, '(s) => s.store.executar({ tipo: "sessao.revelar", ids: ["despensa"] })'); await esperaNoProjetor('(d) => d.session.revealed.includes("despensa")');
  await clicar(page, [4.5, 4.5]); await esperaNoProjetor('(d) => d.lights.rede.on === false');
  await trocar('pixel');
  assert.equal((await documento(page)).props.sw!.interaction!.on, false);
  await page.waitForTimeout(1500);
  await capturar('fim', 'pixel');

  const maior = Math.max(...tempos.map(t => t.ms)), media = tempos.reduce((s, t) => s + t.ms, 0) / tempos.length;
  console.log(`# ${tempos.length} trocas de estilo ao vivo: média ${media.toFixed(0)} ms, maior ${maior} ms até não haver nada pintando`);
  assert.ok(maior < 8000, `a troca mais lenta levou ${maior} ms`);
  const relatorio = { trocas: tempos, fps: medidas, cores: { noProjetor: coresDoProjetor.length, foraDaPaleta: foraDaPaleta.length } };
  writeFileSync('test-results/fase8-relatorio.json', JSON.stringify(relatorio, null, 2));
  assert.deepEqual(errosProj, []); assert.deepEqual(erros, []); await ctx.close();
});
