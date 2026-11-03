import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
async function ferramenta(p: Page, id: string) { await p.click(`[data-testid="ferramenta-${id}"]`); await p.waitForTimeout(350); }
async function clicar(p: Page, mundo: [number, number]) { const [x, y] = await clientDe(p, mundo); await p.mouse.click(x, y); await p.waitForTimeout(200); }
async function retangulo(p: Page, a: [number, number], b: [number, number]) {
  const [ax, ay] = await clientDe(p, a), [bx, by] = await clientDe(p, b);
  await p.keyboard.down('Shift'); await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 6 }); await p.mouse.up(); await p.keyboard.up('Shift');
}
const pintados = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { objetosPintados(): number } } }).__atlas.viewport().objetosPintados());

test('coleção no mapa: escolher o chesterfield na biblioteca, pôr no mapa, ver a imagem pintada, e continuar depois de recarregar', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await ferramenta(page, 'objeto'); await page.locator('[data-testid="biblioteca"]').waitFor();
  const cartao = page.locator('[data-testid="receita-casa:chesterfield-vinho"]'); await cartao.waitFor();
  assert.match(await cartao.innerText(), /acervo/i, 'a marca “acervo”');
  await cartao.click(); await clicar(page, [10.5, 9.75]); await page.waitForTimeout(600);
  const m = await documento(page), o = Object.values(m.props)[0]!;
  assert.deepEqual(o.source, { kind: 'asset', assetId: 'casa:chesterfield-vinho' });
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { objetosPintados(): number } } }).__atlas.viewport().objetosPintados() >= 1, null, { timeout: 8000 });
  assert.equal(await pintados(page), 1, 'a cena tem a textura (sem o marcador)');
  // Grava, recarrega e abre de novo: o sofá continua, com a imagem.
  await page.keyboard.press('Control+s'); await page.waitForTimeout(600);
  await page.reload(); await page.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null);
  await page.locator('[data-testid^="cartao-mapa"], [data-testid="galeria"] a, [data-testid="galeria"] button').first().click({ timeout: 8000 }).catch(() => undefined);
  await page.waitForFunction(() => (window as unknown as { __atlas: { sessao(): unknown } }).__atlas.sessao() !== null, null, { timeout: 8000 });
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { objetosPintados(): number } | null } }).__atlas.viewport()?.objetosPintados() === 1, null, { timeout: 8000 });
  assert.deepEqual(Object.values((await documento(page)).props)[0]!.source, { kind: 'asset', assetId: 'casa:chesterfield-vinho' });
  assert.deepEqual(erros, []); await ctx.close();
});

test('coleção no mapa: asset desconhecido fica como marcador, sem erro', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s) => s.store.executar({ tipo: "item.adicionar", colecao: "props", item: { id: "x", source: { kind: "asset", assetId: "casa:nao-existe" }, position: [10, 10], rotation: 0, scale: 1, elevation: "floor", wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null } })');
  await page.waitForTimeout(600);
  assert.equal(await pintados(page), 0); assert.equal(Object.keys((await documento(page)).props).length, 1);
  assert.deepEqual(erros, []); await ctx.close();
});

/** Roda `executarBake` na página com uma imagem sintética (um quadrado vermelho de 100 px no meio de uma tela 400 × 300) e mede o resultado. */
async function bakeDeImagemSintetica(page: Page, harmonizar: boolean, alvo: { saturacao: number; luminancia: number; tinta: string } | null = null) {
  return page.evaluate(async ([h, alvo]) => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d')!; g.fillStyle = '#e03030'; g.fillRect(150, 100, 100, 100);
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const r = await executarBake({ tipo: 'imagem', url: c.toDataURL('image/png'), pegada: [1, 1], res: 96, resImagem: 128, harmonizar: h, alvo });
    const t = document.createElement('canvas'); t.width = r.bitmap.width; t.height = r.bitmap.height; const x = t.getContext('2d', { willReadFrequently: true })!; x.drawImage(r.bitmap, 0, 0);
    const d = x.getImageData(0, 0, t.width, t.height), px = (i: number, j: number) => Array.from(d.data.slice((j * t.width + i) * 4, (j * t.width + i) * 4 + 4));
    let x0 = t.width, x1 = -1, y0 = t.height, y1 = -1;
    for (let j = 0; j < t.height; j++) for (let i = 0; i < t.width; i++) { const o = (j * t.width + i) * 4; if (d.data[o]! > 150 && d.data[o + 1]! < 90 && d.data[o + 3]! > 200) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; } }
    const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2);
    return { largura: t.width, altura: t.height, vermelho: { x0, x1, y0, y1 }, centro: px(cx, cy), fora: px(x0 - 1, cy), maisFora: px(x0 - 3, cy), sombra: px(x1 + 5, y1 + 4), longe: px(2, 2), origem: r.origem };
  }, [harmonizar, alvo] as const);
}

test('harmonização: a imagem com margem vazia fica do tamanho da pegada, com contorno de nanquim e sombra de contato; desligada, fica como veio', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const com = await bakeDeImagemSintetica(page, true), sem = await bakeDeImagemSintetica(page, false);
  const lado = com.vermelho.x1 - com.vermelho.x0 + 1;
  assert.ok(Math.abs(lado - 96) <= 4, `o conteúdo recortado ocupa a pegada de 1 m (96 px): ${lado}`);
  assert.ok(com.centro[0]! > 180 && com.centro[1]! < 80, 'o miolo mantém a cor da imagem');
  assert.ok(com.fora[3]! > 150 && com.fora[0]! < 60 && com.fora[1]! < 50, `um contorno escuro logo fora do conteúdo: ${com.fora}`);
  assert.ok(com.sombra[3]! > 20 && com.sombra[0]! < 20, `sombra preta de contato embaixo e à direita: ${com.sombra}`);
  assert.equal(com.longe[3], 0, 'longe do objeto, transparente');
  // A cor: com o alvo de um gênero sóbrio, o vermelho vivo fica menos saturado e mais escuro, e continua vermelho.
  const sobrio = await bakeDeImagemSintetica(page, true, { saturacao: 0.4, luminancia: 0.3, tinta: '#f1e2c8' });
  const [r0, g0, b0] = com.centro as number[], [r1, g1, b1] = sobrio.centro as number[];
  assert.ok(r1! < r0! && r1! > g1! * 1.4 && r1! > b1! * 1.4, `o vermelho vivo (${r0},${g0},${b0}) fica sóbrio (${r1},${g1},${b1}) e continua vermelho`);
  const ladoSem = sem.vermelho.x1 - sem.vermelho.x0 + 1;
  assert.ok(Math.abs(ladoSem - 75) <= 3, `sem harmonizar o quadrado de 100 px a 128 px/m fica com 75 px a 96 px/m: ${ladoSem}`);
  assert.ok(sem.maisFora[3]! < 20 && sem.fora[0]! > 100, 'sem harmonizar, sem contorno: o vizinho do conteúdo é só a borda da própria imagem');
  assert.deepEqual(erros, []); await ctx.close();
});

test('fase 6: ala da mansão (8 cômodos mobiliados pelo assistente e pela coleção), de tarde e à noite', async () => {
  const ctx = await novoContexto(amb, { viewport: { width: 1920, height: 1080 } }), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const t0 = Date.now();
  const resumo = await page.evaluate(async () => {
    const w = window as unknown as { __atlas: { sessao(): { store: { executar(c: unknown, o?: unknown): unknown; documento: any; versaoEdicao: number } }; viewport(): { enquadrarMapa?: () => void } | null } };
    const s = w.__atlas.sessao(), c1 = '/src/authoring/sugestoes.ts', c2 = '/src/authoring/proposta.ts', c3 = '/src/domain/fabrica.ts', c4 = '/src/procedural/acervo.ts';
    const { proximaSugestao } = await import(/* @vite-ignore */ c1), { aceitarProposta } = await import(/* @vite-ignore */ c2), { novoObjeto } = await import(/* @vite-ignore */ c3), { ACERVO } = await import(/* @vite-ignore */ c4);
    const retangulo = (x0: number, y0: number, x1: number, y1: number) => { const r: [number, number][] = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) r.push([x, y]); return r; };
    const comodos: [string, string, number, number, number, number][] = [
      ['corredor', 'Corredor', 0, 0, 2, 11], ['jantar', 'Sala de jantar', 2, 6, 5, 11], ['lareira', 'Sala de estar', 5, 0, 12, 5], ['salao', 'Salão', 5, 5, 12, 11],
      ['biblioteca', 'Biblioteca', 12, 0, 16, 4], ['jogos', 'Sala de jogos', 12, 4, 16, 7], ['banheiro', 'Banheiro', 12, 7, 14, 9], ['quarto', 'Quarto', 14, 7, 16, 10], ['varanda', 'Varanda', 5, 11, 12, 13],
    ];
    s.store.executar({ tipo: 'limites.atualizar', largura: 36, altura: 28 });
    for (const [id, nome, x0, y0, x1, y1] of comodos) s.store.executar({ tipo: 'comodo.criar', id, nome, funcao: null, piso: { material: 'tabuas.carvalho', seed: 3 }, papel: { material: 'papel.damasco-vinho', seed: 3 }, celulas: retangulo(x0, y0, x1, y1) });
    // O assistente: aceita as sugestões de cada cômodo até não haver mais (como a Fase 5), exceto as luzes da varanda (sem função).
    let aceitas = 0;
    for (let volta = 0; volta < 14; volta++) { let andou = false; for (const [id] of comodos) { const p = proximaSugestao({ m: s.store.documento, versao: s.store.versaoEdicao, semente: 0 }, id, new Set()); if (p) { aceitarProposta(s.store, p); aceitas++; andou = true; } } if (!andou) break; }
    // À mão, onde a referência tem algo marcante: um tapete grande, um divã e uma poltrona capitonê e uma palmeira no salão.
    const pr = (idItem: string, x: number, y: number, rot = 0, extra: Record<string, unknown> = {}) => s.store.executar({ tipo: 'item.adicionar', colecao: 'props', item: novoObjeto([x, y], { source: ACERVO.fonte(idItem, 5), rotation: rot, blocks: { move: false, sight: false }, ...extra }) });
    pr('casa:tapete-persa-g-vinho', 13.5, 12.75); pr('casa:diva-couro', 9.7, 14.6, 0); pr('casa:poltrona-capitone-verde', 11.4, 14.4, -Math.PI / 2); pr('casa:palmeira-pedra', 8.4, 10.6);
    // O entorno: gramado, calçada até uma fonte, jardim ao lado e mata do outro (o espalhar contextual).
    const c5 = '/src/authoring/espalhar.ts', { espalhar } = await import(/* @vite-ignore */ c5), res = s.store.documento.terrain.resolution;
    s.store.executar({ tipo: 'terreno.base', material: 'grama' });
    const celulasDe = (x0: number, y0: number, x1: number, y1: number) => { const r: [number, number][] = []; for (let y = Math.floor(y0 / res); y < Math.ceil(y1 / res); y++) for (let x = Math.floor(x0 / res); x < Math.ceil(x1 / res); x++) r.push([x, y]); return r; };
    s.store.executar({ tipo: 'terreno.pintar', material: 'calcada', celulas: celulasDe(12.2, 19.6, 15.2, 24.5) });
    pr('fonte', 13.7, 25.2); pr('casa:arbusto-florido', 9, 21); pr('casa:arbusto-verde', 18.5, 21);
    for (const [conjunto, cx, cy, raio, semente] of [['jardim', 6, 24, 5, 3], ['jardim', 21, 24.5, 4, 4], ['mata', 31, 8, 7, 5], ['mata', 31, 21, 6, 6], ['cemiterio', 28, 25, 3.5, 7]] as const) {
      for (const o of espalhar(s.store.documento, { centro: [cx, cy], raio, conjunto, semente })) s.store.executar({ tipo: 'item.adicionar', colecao: 'props', item: o });
    }
    return { aceitas, objetos: Object.keys(s.store.documento.props).length, luzes: Object.keys(s.store.documento.lights).length, portas: Object.keys(s.store.documento.openings).length };
  });
  await page.click('[data-testid="enquadrar"]'); await page.waitForTimeout(300);
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { pintando: number } | null } }).__atlas.viewport()?.pintando === 0, null, { timeout: 60_000 });
  await page.waitForTimeout(800);
  const primeiraPintura = Date.now() - t0;
  console.log(`# ala da mansão: ${resumo.aceitas} sugestões, ${resumo.objetos} objetos, ${resumo.luzes} luzes, ${resumo.portas} portas; primeira pintura completa em ${(primeiraPintura / 1000).toFixed(1)} s`);
  const m = await documento(page);
  assert.equal(Object.keys(m.rooms).length, 9);
  const tabela = Object.values(m.props).filter(o => o.elevation === 'table').length, deParede = Object.values(m.props).filter(o => o.elevation === 'wall').length, pisos = new Set(Object.values(m.rooms).map(r => r.floor.material)), papeis = new Set(Object.values(m.rooms).map(r => r.wallpaper?.material));
  console.log(`# detalhes: ${deParede} objetos de parede, ${tabela} enfeites sobre mesas, ${pisos.size} pisos e ${papeis.size} papéis diferentes nos 9 cômodos`);
  assert.ok(resumo.objetos >= 150, `${resumo.objetos} objetos`); assert.ok(deParede >= 20, `${deParede} objetos de parede`); assert.ok(tabela >= 8, `${tabela} enfeites sobre mesas`); assert.ok(pisos.size >= 4 && papeis.size >= 5, `${pisos.size} pisos, ${papeis.size} papéis`);
  const assets = Object.values(m.props).filter(o => o.source.kind === 'asset').length; assert.ok(assets >= 9, `${assets} itens da coleção`);
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "tarde" })'); await page.waitForTimeout(2000);
  await page.screenshot({ path: 'test-results/fase6-mansao.png' });
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "noite" })'); await page.waitForTimeout(2400);
  await page.screenshot({ path: 'test-results/fase6-mansao-noite.png' });
  assert.deepEqual(erros, []); await ctx.close();
});

test('o fantasma não derruba a textura de um objeto que já está no mapa (mesmo desenho, mesma fonte da GPU)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const objeto = (id: string, x: number) => `{ id: "${id}", source: { kind: "recipe", recipe: "sofa", seed: 7, params: {} }, position: [${x}, 10], rotation: 0, scale: 1, elevation: "floor", wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: true, interaction: null }`;
  await sessao(page, `(s) => s.store.executar({ tipo: "item.adicionar", colecao: "props", item: ${objeto('real', 10)} })`);
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { objetosPintados(): number } } }).__atlas.viewport().objetosPintados() === 1, null, { timeout: 8000 });
  for (let i = 0; i < 4; i++) {
    // Uma prévia com o MESMO desenho (mesma receita, semente e parâmetros) em outro lugar; some e volta várias vezes, como a pílula faz.
    await page.evaluate(`(() => { const w = window.__atlas, previa = structuredClone(w.sessao().doc.value); previa.props.fantasma = ${objeto('fantasma', 14)}; w.viewport().mostrarProposta(previa); })()`);
    await page.waitForTimeout(250);
    await page.evaluate(() => (window as unknown as { __atlas: { viewport(): { mostrarProposta(m: null): void } } }).__atlas.viewport().mostrarProposta(null));
    await page.waitForTimeout(120);
  }
  assert.equal(await pintados(page), 1, 'o sofá do mapa continua pintado');
  await sessao(page, '(s) => s.store.executar({ tipo: "item.atualizar", colecao: "props", id: "real", patch: { rotation: 1 } })'); await page.waitForTimeout(400);
  assert.equal(await pintados(page), 1);
  assert.deepEqual(erros, []); await ctx.close();
});
