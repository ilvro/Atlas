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
  await page.getByText('Conectado', { exact: true }).waitFor({ timeout: 5000 });

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

  // Clique direito sobre célula da taverna abre/fecha todas as salas do edifício num só gesto ("Telhado").
  const [rx, ry] = await clientDe(page, [8.25, 8.25]);
  await page.mouse.click(rx, ry, { button: 'right' });
  const menu = page.locator('[data-testid="menu-radial"]');
  await menu.getByRole('menuitem', { name: 'Abrir telhado da casa' }).click();
  await page.waitForTimeout(400);

  let doc = await documento(page);
  assert.equal(doc.rooms.tavA!.roof.visible, false);
  assert.equal(doc.rooms.tavB!.roof.visible, false);
  assert.equal(doc.rooms.anexo!.roof.visible, true);
  assert.deepEqual(porId(await telhados(page)), { tavA: 0, tavB: 0, anexo: 1 });
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
  assert.deepEqual(porId(await telhados(page)), { tavA: 1, tavB: 1, anexo: 1 });

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
