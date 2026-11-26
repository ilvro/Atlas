import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) =>
  p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);

async function brilho(p: Page, a: [number, number], b: [number, number]): Promise<number> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({
    clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) },
  });
  return p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let soma = 0;
    for (let i = 0; i < d.length; i += 4) soma += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    return soma / (d.length / 4);
  }, png.toString('base64'));
}

const peca = (id: string, nome: string, x: number, y: number) => ({
  id, name: nome, portrait: null, sprite: null, facing: 'down', position: [x, y], size: 1,
  player: true, vision: { radius: 20, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [],
});

test('penumbra dos interiores: ao meio-dia, cômodo coberto sem luz fica mais escuro que a rua e acende com lamparina', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    const celulas = []; for (let y = 4; y < 8; y++) for (let x = 6; x < 10; x++) celulas.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 1 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    s.store.executar({ tipo: "comodo.criar", id: "casa", nome: "Casa", funcao: "sala", piso: { material: "areia", seed: 1 }, papel: null, telhado: "telha.barro", celulas });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.dentro });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.fora });
  }`, { dentro: peca('p1', 'Dentro', 9.75, 6.75), fora: peca('p2', 'Fora', 3.75, 9.75) });
  await page.waitForTimeout(800);

  await page.click('[data-testid="modo-sessao"]');
  await page.waitForTimeout(400);
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(900);

  const centro: [[number, number], [number, number]] = [[11.5, 8.5], [13.0, 10.0]];
  const rua: [[number, number], [number, number]] = [[5.0, 8.5], [6.5, 10.0]];

  const bRua = await brilho(page, ...rua);
  const bCentroEscuro = await brilho(page, ...centro);
  assert.ok(bCentroEscuro <= bRua * 0.7, `interior sem luz (${bCentroEscuro.toFixed(1)}) deve ficar >= 30% mais escuro que a rua (${bRua.toFixed(1)})`);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "l1", position: [12.25, 9.25], radius: 6, color: "#ffb36b", intensity: 1.2,
      flicker: 0, cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "lamparina", rays: false
    } });
  }`);
  await page.waitForTimeout(700);

  const bCentroComLuz = await brilho(page, ...centro);
  assert.ok(bCentroComLuz > bCentroEscuro * 1.3, `com lamparina dentro (${bCentroComLuz.toFixed(1)}), o centro fica bem mais claro que sem luz (${bCentroEscuro.toFixed(1)})`);
  assert.deepEqual(erros, []);
  await ctx.close();
});

const telhados = (p: Page) =>
  p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDosTelhados(): { id: string; edificio: string; alfa: number; alvo: number; dentro: boolean; conhecido: boolean }[] } } }).__atlas.viewport().diagnosticoDosTelhados());

test('mestre controla telhados na sessão: chave geral nos três estados (chega ao projetor) e abrir/fechar por casa no menu', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const mapaId = await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    const cel = (x0, x1, y0, y1) => { const r = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) r.push([x, y]); return r; };
    const piso = { material: "areia", seed: 1 };
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "comodo.criar", id: "tavA", nome: "Taverna A", funcao: "taverna", piso, papel: null, telhado: "telha.barro", celulas: cel(4, 7, 4, 8) });
    s.store.executar({ tipo: "comodo.criar", id: "tavB", nome: "Taverna B", funcao: "cozinha", piso, papel: null, telhado: "telha.barro", celulas: cel(7, 10, 4, 8) });
    s.store.executar({ tipo: "comodo.criar", id: "anexo", nome: "Anexo", funcao: "sala", piso, papel: null, telhado: "telha.barro", celulas: cel(12, 16, 4, 8) });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.p1 });
    s.store.executar({ tipo: "sessao.revelar", ids: ["tavA", "tavB", "anexo"] });
  }`, { p1: peca('p1', 'Heroi', 8.25, 8.25) });
  await page.waitForTimeout(800);

  await page.click('[data-testid="modo-sessao"]');
  await page.locator('[data-testid="sessao-telhados"]').waitFor();
  await page.click('[data-testid="dock-titulo-projetor"]');

  const proj = await ctx.newPage(), errosProj: string[] = [];
  proj.on('pageerror', e => errosProj.push(e.message));
  proj.on('console', m => { if (m.type() === 'error') errosProj.push(m.text()); });
  await proj.goto(`${amb.url}#/projetor/${mapaId}`);
  await proj.waitForFunction(() => (window as unknown as { __projetor?: { doc(): unknown } }).__projetor?.doc() != null, null, { timeout: 20_000 });
  await page.locator('[data-testid="dock-projetor-estado"]', { hasText: 'Projetor local conectado' }).waitFor({ timeout: 5000 });

  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(500);

  const porId = (lista: { id: string; alvo: number }[]) => Object.fromEntries(lista.map(x => [x.id, x.alvo]));
  const telhadosProj = () => proj.evaluate(() => (window as unknown as { __projetor: { viewport(): { diagnosticoDosTelhados(): { id: string; alvo: number }[] } } }).__projetor.viewport().diagnosticoDosTelhados());
  const esperaProjRoofs = (esperado: string | undefined) =>
    proj.waitForFunction(`(() => window.__projetor.doc().session.roofs === ${JSON.stringify(esperado)})()`, null, { timeout: 6000 });

  // Estado inicial: 'auto' — taverna aberta (peça dentro), anexo fechado.
  const botao = page.locator('[data-testid="sessao-telhados"]');
  assert.equal(await botao.getAttribute('data-modo-telhados'), 'auto');
  assert.deepEqual(porId(await telhados(page)), { tavA: 0, tavB: 0, anexo: 1 });
  assert.deepEqual(porId(await telhadosProj()), { tavA: 0, tavB: 0, anexo: 1 });

  // Clique 1: 'fechados' ("Telhados: sempre") — cobre tudo, até onde há peça dentro.
  await botao.click();
  await esperaProjRoofs('fechados');
  await page.waitForTimeout(300);
  assert.equal(await botao.getAttribute('data-modo-telhados'), 'fechados');
  assert.match(await botao.innerText(), /sempre/i);
  assert.deepEqual(porId(await telhados(page)), { tavA: 1, tavB: 1, anexo: 1 });
  assert.deepEqual(porId(await telhadosProj()), { tavA: 1, tavB: 1, anexo: 1 });

  // Clique 2: 'abertos' ("Telhados: abertos") — some com todos.
  await botao.click();
  await esperaProjRoofs('abertos');
  await page.waitForTimeout(300);
  assert.equal(await botao.getAttribute('data-modo-telhados'), 'abertos');
  assert.match(await botao.innerText(), /abertos/i);
  assert.deepEqual(porId(await telhados(page)), { tavA: 0, tavB: 0, anexo: 0 });
  assert.deepEqual(porId(await telhadosProj()), { tavA: 0, tavB: 0, anexo: 0 });

  // Clique 3: volta para 'auto'.
  await botao.click();
  await esperaProjRoofs(undefined);
  await page.waitForTimeout(300);
  assert.equal(await botao.getAttribute('data-modo-telhados'), 'auto');

  // Tira a peça da taverna para testarmos o menu de contexto na taverna vazia.
  await sessao(page, '(s) => s.store.executar({ tipo: "peca.mover", id: "p1", para: [2.25, 2.25] })');
  await page.waitForTimeout(400);
  assert.deepEqual(porId(await telhados(page)), { tavA: 1, tavB: 1, anexo: 1 });

  // Na vista do mestre, o clique direito sobre célula da taverna abre/fecha todas as salas do edifício num só gesto ("Telhado"),
  // enquanto a vista de jogador / projetor mantém casas com telhado cobertas.
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(300);
  const [rx, ry] = await clientDe(page, [8.25, 8.25]);
  await page.mouse.click(rx, ry, { button: 'right' });
  const menu = page.locator('[data-testid="menu-radial"]');
  await menu.getByRole('menuitem', { name: 'Abrir telhado da casa' }).click();
  await page.waitForTimeout(400);

  let doc = await documento(page);
  assert.equal(doc.rooms.tavA!.roof.visible, false);
  assert.equal(doc.rooms.tavB!.roof.visible, false);
  assert.equal(doc.rooms.anexo!.roof.visible, true);
  assert.deepEqual(porId(await telhados(page)), { tavA: 0, tavB: 0, anexo: 0.25 });
  assert.deepEqual(porId(await telhadosProj()), { tavA: 1, tavB: 1, anexo: 1 });
  assert.equal(await sessao(page, '(s) => s.rotuloDesfazer.value'), 'Telhado');

  // Segundo clique direito na outra sala do mesmo edifício oferece "Fechar telhado da casa".
  const [rx2, ry2] = await clientDe(page, [12.75, 8.25]);
  await page.mouse.click(rx2, ry2, { button: 'right' });
  await menu.getByRole('menuitem', { name: 'Fechar telhado da casa' }).waitFor();
  await page.keyboard.press('Escape');

  // Um Ctrl+Z desfaz todas as salas da casa juntas.
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(400);
  doc = await documento(page);
  assert.equal(doc.rooms.tavA!.roof.visible, true);
  assert.equal(doc.rooms.tavB!.roof.visible, true);
  assert.deepEqual(porId(await telhados(page)), { tavA: 0.25, tavB: 0.25, anexo: 0.25 });

  assert.deepEqual(erros, []);
  assert.deepEqual(errosProj, []);
  await ctx.close();
});

test('telhado por edifício: faces texturizadas, luz e sombra do sol e cobertura distinta', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    const cel = []; for (let y = 4; y < 7; y++) for (let x = 6; x < 10; x++) cel.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 1 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    s.store.executar({ tipo: "comodo.criar", id: "casa", nome: "Casa", funcao: "sala", piso: { material: "areia", seed: 1 }, papel: null, telhado: "telha.barro", celulas: cel });
    s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { roof: { shape: "quatro-aguas", details: ["chamine"] } } });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.fora });
    s.store.executar({ tipo: "sessao.revelar", ids: ["casa"] });
  }`, { fora: peca('p1', 'Fora', 6.5, 12.5) });
  await page.waitForTimeout(900);

  await page.click('[data-testid="modo-sessao"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(900);

  const bNorte = await brilho(page, [11.0, 6.2], [13.0, 7.6]);
  const bSul = await brilho(page, [11.0, 8.9], [13.0, 10.3]);
  const diffQuatro = Math.abs(bNorte - bSul) / Math.max(bNorte, bSul);
  assert.ok(diffQuatro > 0.1 && bNorte > bSul, `face norte (${bNorte.toFixed(1)}) deve ficar >10% mais clara que sul (${bSul.toFixed(1)}) ao meio-dia`);

  const faixaSombra: [[number, number], [number, number]] = [[11.0, 10.85], [13.0, 11.25]];
  const bComTelhado = await brilho(page, ...faixaSombra);

  // Sem sun (luz de cima à esquerda) + duas águas com ridge: 'v' -> divisão vertical entre oeste e leste
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "clima.aplicar", patch: { sun: null } });
    s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { roof: { shape: "duas-aguas", ridge: "v", details: [] } } });
  }`);
  await page.waitForTimeout(800);

  const bOeste = await brilho(page, [9.2, 7.0], [11.5, 9.5]);
  const bLeste = await brilho(page, [12.5, 7.0], [14.8, 9.5]);
  assert.ok(bOeste > bLeste * 1.1, `duas águas ridge v: lado oeste (${bOeste.toFixed(1)}) mais claro que leste (${bLeste.toFixed(1)})`);

  // Trocar cobertura para telha.ardosia muda visivelmente os pixels do telhado
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { roof: { material: "telha.ardosia" } } });
  }`);
  await page.waitForTimeout(900);
  const bArdosia = await brilho(page, [9.2, 7.0], [11.5, 9.5]);
  assert.ok(Math.abs(bOeste - bArdosia) > 15, `telha.barro (${bOeste.toFixed(1)}) e telha.ardosia (${bArdosia.toFixed(1)}) devem divergir em luminosidade`);

  // Sem telhado ao meio-dia: a faixa ao sul do edifício perde a sombra do telhado e fica mais clara
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "clima.aplicar", patch: { sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { roof: { material: null, visible: false } } });
  }`);
  await page.waitForTimeout(800);
  const bSemTelhado = await brilho(page, ...faixaSombra);
  assert.ok(bSemTelhado > bComTelhado, `faixa de sombra ao sul sem telhado (${bSemTelhado.toFixed(1)}) deve ficar mais clara que com telhado (${bComTelhado.toFixed(1)})`);

  assert.deepEqual(erros, []);
  await ctx.close();
});

test('inspetor: escolher Igreja na nave e Torre no campanário e ver na vista de jogador', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s) => {
    const cel = (x0, x1, y0, y1) => { const r = []; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) r.push([x, y]); return r; };
    const piso = { material: "laje.pedra", seed: 1 };
    s.store.executar({ tipo: "comodo.criar", id: "nave", nome: "Nave", funcao: "sala", piso, papel: null, telhado: "telha.barro", celulas: cel(4, 8, 4, 7) });
    s.store.executar({ tipo: "comodo.criar", id: "torre", nome: "Campanário", funcao: "sala", piso, papel: null, telhado: "telha.barro", celulas: cel(8, 10, 4, 7) });
    s.store.executar({ tipo: "sessao.revelar", ids: ["nave", "torre"] });
  }`);
  await page.waitForTimeout(500);

  await page.click('[data-testid="ferramenta-selecionar"]');
  const [nx, ny] = await clientDe(page, [9.0, 8.25]);
  await page.mouse.click(nx, ny);
  await page.click('[data-testid="aba-selecao"]');
  await page.click('[data-testid="telhado-igreja"]');

  const [tx, ty] = await clientDe(page, [13.5, 8.25]);
  await page.mouse.click(tx, ty);
  await page.click('[data-testid="telhado-torre"]');
  await page.locator('[data-testid="telhado-ajustar"] > summary').click();
  await page.locator('[data-testid="telhado-ajustar"] select').first().waitFor();

  const doc = await documento(page);
  assert.equal(doc.rooms.nave!.roof.material, 'telha.ardosia');
  assert.equal(doc.rooms.nave!.roof.shape, 'duas-aguas');
  assert.deepEqual(doc.rooms.nave!.roof.details, ['cruz']);
  assert.equal(doc.rooms.torre!.roof.material, 'telha.escamas');
  assert.equal(doc.rooms.torre!.roof.shape, 'piramide');
  assert.deepEqual(doc.rooms.torre!.roof.details, ['sino']);

  await page.click('[data-testid="modo-sessao"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(800);

  const diag = await telhados(page);
  assert.deepEqual(diag.map(d => [d.id, d.alvo]), [['nave', 1], ['torre', 1]]);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('capturar com vista de telhados em Construir: mostra o telhado na imagem e mantém o editor com telhados abertos', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s) => {
    const cel = []; for (let y = 4; y < 8; y++) for (let x = 6; x < 10; x++) cel.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 1 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    s.store.executar({ tipo: "comodo.criar", id: "casa", nome: "Casa", funcao: "sala", piso: { material: "marmore.branco", seed: 1 }, papel: null, telhado: "telha.ardosia", celulas: cel });
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "l1", position: [12.0, 9.0], radius: 6, color: "#fffae0", intensity: 1.4,
      flicker: 0, cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "lamparina", rays: false
    } });
  }`);
  await page.waitForTimeout(800);

  const r = await page.evaluate(async () => {
    type Cap = { dataUrl: string };
    type VP = {
      capturar(o?: { caixa?: { x0: number; y0: number; x1: number; y1: number }; vista?: 'planta' | 'telhados' }): Promise<Cap>;
      diagnosticoDosTelhados(): { id: string; alfa: number; alvo: number }[];
    };
    const vp = (window as unknown as { __atlas: { viewport(): VP } }).__atlas.viewport();
    const corMedia = async (dataUrl: string) => {
      const img = new Image(); img.src = dataUrl; await img.decode();
      const c = new OffscreenCanvas(img.width, img.height);
      const g = c.getContext('2d')!; g.drawImage(img, 0, 0);
      const x0 = Math.floor(img.width * 0.35), y0 = Math.floor(img.height * 0.35);
      const w = Math.max(1, Math.floor(img.width * 0.3)), h = Math.max(1, Math.floor(img.height * 0.3));
      const d = g.getImageData(x0, y0, w, h).data;
      let r = 0, gr = 0, b = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) { r += d[i]!; gr += d[i + 1]!; b += d[i + 2]!; }
      return [r / n, gr / n, b / n] as [number, number, number];
    };
    const caixa = { x0: 9, y0: 6, x1: 15, y1: 12 };
    const capPlanta = await vp.capturar({ caixa, vista: 'planta' });
    const capTelhados = await vp.capturar({ caixa, vista: 'telhados' });
    const diagDepois = vp.diagnosticoDosTelhados();
    return {
      planta: await corMedia(capPlanta.dataUrl),
      telhados: await corMedia(capTelhados.dataUrl),
      diagDepois,
    };
  });

  const dist = Math.hypot(r.planta[0] - r.telhados[0], r.planta[1] - r.telhados[1], r.planta[2] - r.telhados[2]);
  assert.ok(dist > 30, `cor média da planta (${r.planta.map(x => x.toFixed(1)).join(',')}) deve diferir do telhado de ardósia (${r.telhados.map(x => x.toFixed(1)).join(',')}); dist=${dist.toFixed(1)}`);
  assert.deepEqual(r.diagDepois.map(d => [d.id, d.alfa, d.alvo]), [['casa', 0, 0]], 'vista do editor permanece Construir (telhado escondido)');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('telhado iluminado pela cena: noite escura, lampião da rua clareia borda, lamparina interna não vaza e fade por edifício continua', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    const cel = []; for (let y = 4; y < 7; y++) for (let x = 6; x < 10; x++) cel.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 1 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    s.store.executar({ tipo: "comodo.criar", id: "casa", nome: "Casa", funcao: "sala", piso: { material: "areia", seed: 1 }, papel: null, telhado: "telha.barro", celulas: cel });
    s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { roof: { shape: "quatro-aguas", details: [] } } });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.fora });
    s.store.executar({ tipo: "sessao.revelar", ids: ["casa"] });
  }`, { fora: peca('p1', 'Fora', 6.5, 12.5) });
  await page.waitForTimeout(900);

  await page.click('[data-testid="modo-sessao"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(900);

  const centroTelhado: [[number, number], [number, number]] = [[10.8, 7.2], [13.2, 9.2]];
  const bordaOeste: [[number, number], [number, number]] = [[9.1, 7.2], [10.4, 9.2]];

  const bMeioDia = await brilho(page, ...centroTelhado);

  // 1) À noite (23:00), telhado longe de luz fica bem mais escuro que ao meio-dia
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "noite", time: "23:00", ambient: { color: "#1c2440", intensity: 0.25 }, sun: { angle: 1.57, color: "#9fb3e8", intensity: 0.35 } } });
  }`);
  await page.waitForTimeout(1900);

  const bNoiteSemLuz = await brilho(page, ...centroTelhado);
  const bBordaNoite = await brilho(page, ...bordaOeste);
  assert.ok(bNoiteSemLuz < bMeioDia * 0.45, `à noite (${bNoiteSemLuz.toFixed(1)}) deve ficar bem mais escuro que ao meio-dia (${bMeioDia.toFixed(1)})`);

  // 2) Lamparina dentro da casa coberta NÃO clareia o telhado
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "interna", position: [12.0, 8.25], radius: 6, color: "#ffb36b", intensity: 2.0,
      flicker: 0, cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "lamparina", rays: false
    } });
  }`);
  await page.waitForTimeout(600);

  const bNoiteComInterna = await brilho(page, ...centroTelhado);
  assert.ok(Math.abs(bNoiteComInterna - bNoiteSemLuz) < 3, `lamparina interna (${bNoiteComInterna.toFixed(1)}) não deve clarear o telhado (${bNoiteSemLuz.toFixed(1)})`);

  // 3) Lampião na rua ao lado do telhado clareia claramente a borda próxima
  await sessao(page, `(s) => {
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "lampiao", position: [8.0, 8.25], radius: 7, color: "#ffc078", intensity: 2.2,
      flicker: 0, cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: "lampiao", rays: false
    } });
  }`);
  await page.waitForTimeout(600);

  const bBordaComLampiao = await brilho(page, ...bordaOeste);
  assert.ok(bBordaComLampiao > bBordaNoite * 1.4 && bBordaComLampiao - bBordaNoite > 12, `lampião na rua (${bBordaComLampiao.toFixed(1)}) deve clarear a borda próxima do telhado (${bBordaNoite.toFixed(1)})`);

  // 4) Fade por edifício continua funcionando (entrar abre o telhado e revela a lamparina; sair fecha)
  await sessao(page, `(s) => s.store.executar({ tipo: "item.atualizar", colecao: "tokens", id: "p1", patch: { position: [12.0, 8.25] } })`);
  await page.waitForTimeout(700);
  const diagDentro = await telhados(page);
  assert.deepEqual(diagDentro.map(d => [d.id, d.alfa, d.alvo]), [['casa', 0, 0]], 'entrar na casa abre o telhado');
  const bInteriorAberto = await brilho(page, ...centroTelhado);
  assert.ok(bInteriorAberto > bNoiteComInterna + 15, `com telhado aberto (${bInteriorAberto.toFixed(1)}), a lamparina interna aparece bem mais clara que o telhado fechado (${bNoiteComInterna.toFixed(1)})`);

  await sessao(page, `(s) => s.store.executar({ tipo: "item.atualizar", colecao: "tokens", id: "p1", patch: { position: [6.5, 12.5] } })`);
  await page.waitForTimeout(700);
  const diagFora = await telhados(page);
  assert.deepEqual(diagFora.map(d => [d.id, d.alfa, d.alvo]), [['casa', 1, 1]], 'sair da casa volta a fechar o telhado');

  assert.deepEqual(erros, []);
  await ctx.close();
});

async function corMediaTela(p: Page, a: [number, number], b: [number, number]): Promise<[number, number, number]> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({
    clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.max(1, Math.abs(x1 - x0)), height: Math.max(1, Math.abs(y1 - y0)) },
  });
  return p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height);
    const g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0);
    const d = g.getImageData(0, 0, bmp.width, bmp.height).data;
    let r = 0, gr = 0, bl = 0;
    const n = d.length / 4;
    for (let i = 0; i < d.length; i += 4) { r += d[i]!; gr += d[i + 1]!; bl += d[i + 2]!; }
    return [r / n, gr / n, bl / n] as [number, number, number];
  }, png.toString('base64'));
}

const distCor = (a: readonly [number, number, number], b: readonly [number, number, number]): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('fachada sob o beiral: mostra parede, porta e janela com telhado fechado, desliga com facades: false e fica atrás das peças', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    const cel = []; for (let y = 4; y < 7; y++) for (let x = 6; x < 10; x++) cel.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 1 }, sun: { angle: -1.57, color: "#fff8e8", intensity: 0.9 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    s.store.executar({ tipo: "comodo.criar", id: "casa", nome: "Casa", funcao: "sala", piso: { material: "madeira.tabuas", seed: 1 }, papel: null, telhado: "telha.barro", celulas: cel });
    s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { wallFace: "parede.tabuas", roof: { shape: "duas-aguas", ridge: "h", details: [] } } });
    const doc = s.doc.value;
    const paredeSul = Object.values(doc.walls).find(w => w.path.length >= 2 && w.path.every(p => Math.abs(p[1] - 10.5) < 0.05));
    if (!paredeSul) throw new Error("Parede sul não encontrada");
    const p0x = paredeSul.path[0][0], p1x = paredeSul.path[paredeSul.path.length - 1][0];
    const atParaX = (x) => (x - p0x) / (p1x - p0x);
    s.store.executar({ tipo: "abertura.adicionar", abertura: {
      id: "ab-porta", wallId: paredeSul.id, kind: "door", at: atParaX(10.8), width: 1.1,
      state: "closed", swing: "a", material: "madeira.escura", som: null
    } });
    s.store.executar({ tipo: "abertura.adicionar", abertura: {
      id: "ab-janela", wallId: paredeSul.id, kind: "window", at: atParaX(13.2), width: 1.1,
      state: "closed", swing: "a", material: "madeira.media", som: null
    } });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.fora });
    s.store.executar({ tipo: "sessao.revelar", ids: ["casa"] });
  }`, { fora: peca('p1', 'Fora', 6.0, 13.5) });
  await page.waitForTimeout(900);

  await page.click('[data-testid="modo-sessao"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(3200);

  // Casa vai de x: 9..15, y: 6..10.5; beiral sul em y = 10.75; faixa da fachada em y = 10.75..11.65.
  const faixaParede: [[number, number], [number, number]] = [[11.6, 10.9], [12.4, 11.5]];
  const faixaJanela: [[number, number], [number, number]] = [[12.9, 10.95], [13.5, 11.4]];
  const chaoLivre: [[number, number], [number, number]] = [[11.0, 13.0], [13.0, 14.0]];

  const corChao = await corMediaTela(page, ...chaoLivre);
  const corFachada = await corMediaTela(page, ...faixaParede);
  const corJanela = await corMediaTela(page, ...faixaJanela);

  // 1) Com facades ligado (padrão), a faixa abaixo do beiral difere claramente do chão livre e a janela difere do chão.
  const dFachadaChao = distCor(corFachada, corChao);
  const dJanelaChao = distCor(corJanela, corChao);
  assert.ok(dFachadaChao > 35, `fachada sob o beiral (${corFachada.map(v => v.toFixed(0))}) deve diferir do chão (${corChao.map(v => v.toFixed(0))}); dist=${dFachadaChao.toFixed(1)}`);
  assert.ok(dJanelaChao > 40, `janela na fachada (${corJanela.map(v => v.toFixed(0))}) deve diferir do chão (${corChao.map(v => v.toFixed(0))}); dist=${dJanelaChao.toFixed(1)}`);

  // 2) Com style.facades: false, a mesma faixa volta a ter a cor do chão.
  await sessao(page, `(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { facades: false } })`);
  await page.waitForTimeout(3200);

  const corSemFachada = await corMediaTela(page, ...faixaParede);
  const dSemFachadaChao = distCor(corSemFachada, corChao);
  const dComVsSem = distCor(corSemFachada, corFachada);
  assert.ok(
    dSemFachadaChao < 40 && dSemFachadaChao < dFachadaChao * 0.5 && dComVsSem > 45,
    `com facades: false, a faixa (${corSemFachada.map(v => v.toFixed(0))}) deve voltar ao chão (${corChao.map(v => v.toFixed(0))}); dSemChao=${dSemFachadaChao.toFixed(1)}, dComChao=${dFachadaChao.toFixed(1)}, dComVsSem=${dComVsSem.toFixed(1)}`,
  );

  // 3) Com facades: true novamente, uma peça na rua bem em frente à fachada aparece POR CIMA dela.
  await sessao(page, `(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { facades: true } })`);
  await page.waitForTimeout(1200);

  const zonaPeca: [[number, number], [number, number]] = [[11.75, 10.95], [12.25, 11.45]];
  const corAntesPeca = await corMediaTela(page, ...zonaPeca);

  await sessao(page, `(s) => s.store.executar({ tipo: "item.atualizar", colecao: "tokens", id: "p1", patch: { position: [12.0, 11.2] } })`);
  await page.waitForTimeout(500);

  const corComPeca = await corMediaTela(page, ...zonaPeca);
  const dPeca = distCor(corComPeca, corAntesPeca);
  assert.ok(dPeca > 25, `peça em frente à fachada deve aparecer por cima dela (antes=${corAntesPeca.map(v => v.toFixed(0))}, com=${corComPeca.map(v => v.toFixed(0))}, dist=${dPeca.toFixed(1)})`);

  assert.deepEqual(erros, []);
  await ctx.close();
});

test('estufa de vidro fechada deixa ver o piso embaixo: brilho sobre o telhado muda ao trocar o piso entre claro e escuro', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    const cel = []; for (let y = 4; y < 7; y++) for (let x = 6; x < 10; x++) cel.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "grama" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 1 }, sun: { angle: 1.57, color: "#fff8e8", intensity: 1 } } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    s.store.executar({ tipo: "comodo.criar", id: "estufa", nome: "Estufa", funcao: "sala", piso: { material: "marmore.branco", seed: 1 }, papel: null, telhado: "telha.vidro", celulas: cel });
    s.store.executar({ tipo: "comodo.atualizar", id: "estufa", patch: { roof: { shape: "duas-aguas", ridge: "h", details: [] } } });
    s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: {
      id: "l1", position: [12.0, 8.25], radius: 7, color: "#ffffff", intensity: 1.5,
      flicker: 0, cone: null, ownerId: null, power: "magic", on: true, nightOnly: false, preset: "lamparina", rays: false
    } });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.dentro });
    s.store.executar({ tipo: "sessao.revelar", ids: ["estufa"] });
    s.store.executar({ tipo: "sessao.telhados", modo: "fechados" });
  }`, { dentro: peca('p1', 'Dentro', 9.75, 6.75) });
  await page.waitForTimeout(900);

  await page.click('[data-testid="modo-sessao"]');
  await page.waitForTimeout(300);
  await page.click('[data-testid="vista-jogador"]');
  await page.waitForTimeout(3200);
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { pintando: number } } }).__atlas.viewport().pintando === 0, null, { timeout: 15_000 });
  await page.waitForTimeout(500);

  const diag = await telhados(page);
  assert.deepEqual(diag.map(d => [d.id, d.alfa, d.alvo]), [['estufa', 1, 1]], 'estufa deve estar com telhado fechado');

  const regiaoTelhado: [[number, number], [number, number]] = [[11.0, 7.2], [14.0, 9.5]];
  const bPisoClaro = await brilho(page, ...regiaoTelhado);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "comodo.atualizar", id: "estufa", patch: { floor: { material: "tabuas.escuras", seed: 1 } } });
  }`);
  await page.waitForTimeout(1000);
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { pintando: number } } }).__atlas.viewport().pintando === 0, null, { timeout: 15_000 });
  await page.waitForTimeout(500);

  const bPisoEscuro = await brilho(page, ...regiaoTelhado);
  assert.ok(
    bPisoClaro > bPisoEscuro + 18,
    `estufa de vidro fechada deve deixar ver o piso: com marmore.branco (${bPisoClaro.toFixed(1)}) deve ficar bem mais clara que com tabuas.escuras (${bPisoEscuro.toFixed(1)})`,
  );

  assert.deepEqual(erros, []);
  await ctx.close();
});
