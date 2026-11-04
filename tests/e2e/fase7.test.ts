import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
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
const ferramentaAtual = (p: Page) => sessao(p, '(s) => s.ferramenta.value') as Promise<string>;

test('modos: M entra na Sessão (some a biblioteca, a pílula e as ferramentas de construir, C não troca de ferramenta); M volta e tudo reaparece', async () => {
  const ctx = await novoContexto(amb, {}, true), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo'); await retangulo(page, [6.75, 6.75], [14.25, 12.75]);
  await ferramenta(page, 'selecionar'); await clicar(page, [10.5, 9.75]);
  await page.click('[data-testid="aba-selecao"]'); const nome = page.getByLabel('Nome', { exact: true }); await nome.fill('Cozinha'); await nome.press('Enter');
  await page.locator('[data-testid="pilula"]').waitFor({ timeout: 4000 });
  await ferramenta(page, 'objeto'); await page.locator('[data-testid="biblioteca"]').waitFor();
  assert.equal(await page.locator('[data-testid="modo-construir"]').getAttribute('aria-checked'), 'true');
  // Entra na Sessão pelo atalho M.
  await semFoco(page); await page.keyboard.press('m'); await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-testid="modo-sessao"]').getAttribute('aria-checked'), 'true'); await page.locator('[data-testid="faixa-sessao"]').waitFor();
  assert.equal(await page.locator('[data-testid="biblioteca"]').count(), 0, 'sem biblioteca'); assert.equal(await page.locator('[data-testid="pilula"]').count(), 0, 'sem pílula');
  assert.equal(await ferramentaAtual(page), 'selecionar', 'a ferramenta volta a selecionar');
  assert.equal(await page.locator('[data-testid="ferramenta-comodo"]').count(), 0); assert.equal(await page.locator('[data-testid="ferramenta-selecionar"]').count(), 1); assert.equal(await page.locator('[data-testid="ferramenta-mao"]').count(), 1);
  await page.keyboard.press('c'); await page.waitForTimeout(200); assert.equal(await ferramentaAtual(page), 'selecionar', 'C não troca de ferramenta na Sessão');
  await page.keyboard.press('Control+k'); await page.locator('[data-testid="paleta"] input').fill('pintar cômodo'); await page.waitForTimeout(250);
  assert.equal(await page.locator('[role="option"]').filter({ hasText: /Pintar cômodo/ }).count(), 0, 'a paleta não oferece ações de construir'); await page.keyboard.press('Escape');
  // Volta a Construir pelo botão: tudo reaparece.
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-testid="faixa-sessao"]').count(), 0); assert.equal(await page.locator('[data-testid="ferramenta-comodo"]').count(), 1);
  await semFoco(page); await page.keyboard.press('c'); await page.waitForTimeout(200); assert.equal(await ferramentaAtual(page), 'comodo', 'C volta a funcionar');
  await page.locator('[data-testid="pilula"]').waitFor({ timeout: 4000 }).catch(() => undefined);
  assert.deepEqual(erros, []); await ctx.close();
});

test('modos: abrir outro mapa volta a Construir', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-testid="modo-sessao"]').getAttribute('aria-checked'), 'true');
  await page.keyboard.press('Alt+g'); await page.waitForTimeout(600);
  await criarMapaPelaInterface(page); await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-testid="modo-construir"]').getAttribute('aria-checked'), 'true', 'o mapa novo abre em Construir');
  assert.equal((await documento(page)).version, 5);
  assert.deepEqual(erros, []); await ctx.close();
});

const peca = (id: string, nome: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({ id, name: nome, portrait: null, sprite: null, facing: 'down', position: [x, y], size: 1, player: false, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], ...extra });
const diag = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { id: string; retrato: boolean; deitada: boolean; raio: number }[] } } }).__atlas.viewport().diagnosticoDasPecas());

test('peça: o retrato enviado aparece recortado na peça, o tamanho vale, e o estado morto deita a peça (e desfaz)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s, p) => s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p })', peca('hugo', 'Hugo', 10, 10, { size: 2 }));
  await page.waitForTimeout(300);
  let d = (await diag(page))[0]!; assert.equal(d.retrato, false, 'sem retrato: a inicial'); assert.ok(Math.abs(d.raio - 1.35) < 0.01, `tamanho 2 células de 1,5 m: raio ${d.raio}`);
  await sessao(page, '(s) => { s.selecao.value = [{ colecao: "tokens", id: "hugo" }]; }'); await page.click('[data-testid="aba-selecao"]');
  await page.locator('[data-testid="retrato-arquivo"]').setInputFiles('tests/e2e/retrato-de-teste.png');
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { retrato: boolean }[] } } }).__atlas.viewport().diagnosticoDasPecas()[0]?.retrato === true, null, { timeout: 8000 });
  const m = await documento(page); assert.ok(m.tokens.hugo!.portrait?.id, 'o retrato foi guardado como asset');
  await page.screenshot({ path: 'test-results/fase7-peca-retrato.png' });
  await page.locator('label.linha', { hasText: 'Estado' }).locator('select').selectOption('dead'); await page.waitForTimeout(300);
  d = (await diag(page))[0]!; assert.equal(d.deitada, true, 'morto: deitada'); assert.equal(d.retrato, true);
  await page.keyboard.press('Control+z'); await page.waitForTimeout(300); assert.equal((await diag(page))[0]!.deitada, false, 'desfazer levanta a peça');
  await page.locator('label.linha', { hasText: 'Jogador' }).locator('input[type=checkbox]').check(); await page.waitForTimeout(200); assert.equal((await documento(page)).tokens.hugo!.player, true);
  await page.locator('[data-testid="retrato-remover"]').click(); await page.waitForTimeout(300); assert.equal((await diag(page))[0]!.retrato, false); assert.equal((await documento(page)).tokens.hugo!.portrait, null);
  assert.deepEqual(erros, []); await ctx.close();
});

async function arrastar(p: Page, de: [number, number], para: [number, number], alt = false) {
  const [ax, ay] = await clientDe(p, de), [bx, by] = await clientDe(p, para);
  if (alt) await p.keyboard.down('Alt');
  await p.mouse.move(ax, ay); await p.mouse.down(); await p.mouse.move(bx, by, { steps: 8 }); await p.mouse.up();
  if (alt) await p.keyboard.up('Alt');
  await p.waitForTimeout(250);
}
const posicao = async (p: Page, id: string) => (await documento(p)).tokens[id]!.position;
const diagMovimento = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { id: string; deslizando: boolean; trilha: number }[] } } }).__atlas.viewport().diagnosticoDasPecas());

test('movimento: na sessão a peça anda de célula em célula, a parede e a porta fechada recusam, a porta aberta deixa, e cada passo é uma entrada de histórico', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    s.store.executar({ tipo: "parede.adicionar", parede: a.parede });
    s.store.executar({ tipo: "abertura.adicionar", abertura: a.porta });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.peca });
  }`, {
    parede: { id: 'w1', path: [[12, 0], [12, 30]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, source: null },
    porta: { id: 'o1', wallId: 'w1', at: 0.5, width: 2, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' },
    peca: peca('hugo', 'Hugo', 11.25, 14.25),
  });
  await page.waitForTimeout(300);
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(300);
  // Parede: do outro lado, longe da porta.
  await arrastar(page, [11.25, 14.25], [12.75, 8.25]);
  assert.deepEqual(await posicao(page, 'hugo'), [11.25, 14.25], 'a parede recusou');
  await page.getByText('Tem uma parede no caminho.').first().waitFor({ timeout: 3000 });
  // Porta fechada.
  await arrastar(page, [11.25, 14.25], [12.75, 14.25]);
  assert.deepEqual(await posicao(page, 'hugo'), [11.25, 14.25], 'a porta fechada recusou');
  await page.getByText('A porta está fechada.').first().waitFor({ timeout: 3000 });
  // Alt = livre: atravessa a parede.
  await arrastar(page, [11.25, 14.25], [12.75, 8.25], true);
  assert.deepEqual(await posicao(page, 'hugo'), [12.75, 8.25], 'Alt anda livre');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(250);
  assert.deepEqual(await posicao(page, 'hugo'), [11.25, 14.25], 'desfazer devolve a peça');
  // Porta aberta: passa, e a peça olha para a direita.
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "o1", patch: { state: "open" } })');
  await arrastar(page, [11.25, 14.25], [12.75, 14.25]);
  assert.deepEqual(await posicao(page, 'hugo'), [12.75, 14.25]);
  assert.equal((await documento(page)).tokens.hugo!.facing, 'right');
  const rotulo = (await sessao(page, '(s) => s.rotuloDesfazer.value')) as string; assert.equal(rotulo, 'Mover peça');
  const d = (await diagMovimento(page))[0]!; assert.ok(d.deslizando || d.trilha > 0, 'a peça desliza e deixa trilha');
  // Setas: uma célula por vez, e a peça segue selecionada.
  await semFoco(page); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250);
  assert.deepEqual(await posicao(page, 'hugo'), [14.25, 14.25]);
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(250);
  assert.deepEqual(await posicao(page, 'hugo'), [14.25, 15.75]);
  // Em Construir as setas voltam ao passo fino e não encaixam.
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(300);
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
  assert.deepEqual(await posicao(page, 'hugo'), [14.25 + 0.75, 15.75]);
  assert.deepEqual(erros, []); await ctx.close();
});

test('lanterna: o inspetor põe a luz na peça, ela anda apontando para onde a peça foi, Q e E giram o facho, e remover a peça leva a luz', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s, p) => { s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p }); s.selecao.value = [{ colecao: "tokens", id: "hugo" }]; }', peca('hugo', 'Hugo', 11.25, 14.25));
  await page.click('[data-testid="aba-selecao"]');
  const seletor = page.locator('label.linha', { hasText: 'Lanterna' }).locator('select');
  await seletor.selectOption('lanterna'); await page.waitForTimeout(300);
  let m = await documento(page); const luz = Object.values(m.lights).find(l => l.ownerId === 'hugo')!;
  assert.ok(luz, 'a luz nasceu com a peça como dona'); assert.equal(m.tokens.hugo!.lightId, luz.id); assert.ok(luz.cone, 'lanterna é cone'); assert.deepEqual(luz.position, [11.25, 14.25]);
  assert.equal(Object.keys(m.lights).length, 1);
  // Trocar por uma vela troca a luz (uma só), e a vela é redonda.
  await seletor.selectOption('vela'); await page.waitForTimeout(300);
  m = await documento(page); assert.equal(Object.keys(m.lights).length, 1); assert.equal(Object.values(m.lights)[0]!.cone, null);
  await seletor.selectOption('lanterna'); await page.waitForTimeout(300);
  // Na sessão: andar para a direita aponta o facho para 0 rad; Q gira 45° para a esquerda; E volta.
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(300);
  await arrastar(page, [11.25, 14.25], [14.25, 14.25]);
  m = await documento(page); const l = Object.values(m.lights)[0]!;
  assert.deepEqual(m.tokens.hugo!.position, [14.25, 14.25]); assert.deepEqual(l.position, [14.25, 14.25]); assert.equal(l.cone!.direction, 0);
  await semFoco(page); await page.keyboard.press('q'); await page.waitForTimeout(250);
  assert.ok(Math.abs(Object.values((await documento(page)).lights)[0]!.cone!.direction + Math.PI / 4) < 1e-9, 'Q: -45°');
  await page.keyboard.press('e'); await page.waitForTimeout(250);
  assert.ok(Math.abs(Object.values((await documento(page)).lights)[0]!.cone!.direction) < 1e-9, 'E: de volta a 0');
  // Desfazer o movimento devolve a luz e a direção.
  await sessao(page, '(s) => { s.store.desfazer(); s.store.desfazer(); s.store.desfazer(); }'); await page.waitForTimeout(250);
  m = await documento(page); assert.deepEqual(Object.values(m.lights)[0]!.position, [11.25, 14.25]);
  // Remover a peça (em Construir) leva a lanterna junto.
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(300);
  await sessao(page, '(s) => s.store.executar({ tipo: "item.remover", colecao: "tokens", id: "hugo" })');
  assert.equal(Object.keys((await documento(page)).lights).length, 0);
  assert.deepEqual(erros, []); await ctx.close();
});

/** O brilho médio (0 a 255) de um retângulo do mundo, lido dos pixels da tela. */
async function brilho(p: Page, a: [number, number], b: [number, number]): Promise<number> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({ clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) } });
  return p.evaluate(async (base64: string) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d')!;
    g.drawImage(bmp, 0, 0); const d = g.getImageData(0, 0, bmp.width, bmp.height).data; let soma = 0;
    for (let i = 0; i < d.length; i += 4) soma += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!;
    return soma / (d.length / 4);
  }, png.toString('base64'));
}

/** Grama em todo o mapa, uma parede em x = 12,75 com uma porta em y = 9 e uma peça de jogador à esquerda. */
async function cenarioDaVisao(p: Page, estadoDaPorta: string, tipoDaPorta = 'door') {
  await sessao(p, `(s, a) => {
    s.store.executar({ tipo: "terreno.base", material: "grama" });
    s.store.executar({ tipo: "parede.adicionar", parede: a.parede }); s.store.executar({ tipo: "abertura.adicionar", abertura: a.porta });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.peca });
  }`, {
    parede: { id: 'w1', path: [[12.75, 0], [12.75, 30]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, source: null },
    porta: { id: 'o1', wallId: 'w1', at: 0.3, width: 2, kind: tipoDaPorta, state: estadoDaPorta, material: 'madeira.media', som: null, swing: 'a' },
    peca: peca('hugo', 'Hugo', 9.75, 9.75, { player: true, vision: { radius: 14, dark: false } }),
  });
  await p.waitForTimeout(1500);
}

test('visão: na vista de jogador o outro lado da parede é o fundo do mapa, abrir a porta revela o que ela mostra, e o mestre vê tudo', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await cenarioDaVisao(page, 'closed');
  const fora: [[number, number], [number, number]] = [[15, 9.3], [18, 10.2]], escondido: [[number, number], [number, number]] = [[15, 12], [18, 13]], dentro: [[number, number], [number, number]] = [[6, 7], [9, 8]];
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(500);
  const tudo = await brilho(page, ...fora); assert.ok(tudo > 30, `o mestre vê a grama (${tudo})`);
  await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(700);
  assert.equal(await page.locator('[data-testid="vista-jogador"]').getAttribute('aria-pressed'), 'true');
  const vizinho = await brilho(page, ...fora), proprio = await brilho(page, ...dentro);
  assert.ok(proprio > 30, `o próprio lado continua à vista (${proprio})`); assert.ok(vizinho < 18, `a porta fechada esconde o outro lado (${vizinho})`);
  await page.screenshot({ path: 'test-results/fase7-visao-fechada.png' });
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "o1", patch: { state: "open" } })'); await page.waitForTimeout(700);
  const aberta = await brilho(page, ...fora), longe = await brilho(page, ...escondido);
  assert.ok(aberta > 30, `a porta aberta mostra o que está em frente (${aberta})`); assert.ok(longe < 18, `mas não o resto (${longe})`);
  await page.screenshot({ path: 'test-results/fase7-visao-aberta.png' });
  await page.keyboard.press('Control+z'); await page.waitForTimeout(700);
  assert.ok(await brilho(page, ...fora) < 18, 'desfazer fecha a porta e a névoa volta');
  // Voltar à vista do mestre (J) mostra tudo; em Construir o mestre vê sempre tudo.
  await semFoco(page); await page.keyboard.press('j'); await page.waitForTimeout(500);
  assert.ok(await brilho(page, ...fora) > 30, 'J volta à vista do mestre');
  await page.keyboard.press('j'); await page.waitForTimeout(500); assert.ok(await brilho(page, ...fora) < 18);
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(500);
  assert.ok(await brilho(page, ...fora) > 30, 'em Construir não há névoa');
  assert.deepEqual(erros, []); await ctx.close();
});

test('memória: o que a peça já viu e deixou para trás vira esboço em papel; o nunca visto continua fundo; esquecer apaga a memória', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await cenarioDaVisao(page, 'open');
  await sessao(page, '(s) => s.store.executar({ tipo: "item.atualizar", colecao: "tokens", id: "hugo", patch: { vision: { radius: 6 } } })');
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400); await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(600);
  const lembrada: [[number, number], [number, number]] = [[5, 8.2], [7, 9.4]], nunca: [[number, number], [number, number]] = [[38, 24], [43, 28]], aqui = (x: number): [[number, number], [number, number]] => [[x - 2, 8.5], [x + 2, 10.5]];
  assert.ok(await brilho(page, ...lembrada) > 30, 'a peça enxerga o lugar');
  // A peça atravessa a porta e vai longe: o que ficou para trás sai do alcance mas fica na memória.
  await sessao(page, '(s) => s.store.executar({ tipo: "peca.mover", id: "hugo", para: [24.75, 9.75] })'); await page.waitForTimeout(1200);
  const m = await documento(page); assert.ok(m.session.explored && m.session.explored.cells.length > 0, 'o explorado foi gravado'); assert.equal(m.session.explored.res, 0.5);
  const papel = await brilho(page, ...lembrada), fundo = await brilho(page, ...nunca), vendo = await brilho(page, ...aqui(24.75));
  assert.ok(papel > 120, `memória: papel claro (${papel})`); assert.ok(fundo < 18, `nunca visto: fundo (${fundo})`); assert.ok(vendo > 20 && vendo < papel, `visível: a cena (${vendo})`);
  await page.screenshot({ path: 'test-results/fase7-memoria.png' });
  // Sem esboço, o explorado é a cena escurecida.
  await sessao(page, '(s) => s.store.executar({ tipo: "memoria.atualizar", patch: { sketch: false } })'); await page.waitForTimeout(700);
  const escura = await brilho(page, ...lembrada); assert.ok(escura > 8 && escura < papel * 0.5, `sem esboço: escurecida (${escura})`);
  await sessao(page, '(s) => s.store.executar({ tipo: "memoria.atualizar", patch: { sketch: true } })'); await page.waitForTimeout(500);
  // Recomeçar a exploração apaga a memória.
  await page.click('[data-testid="aba-mapa"]'); await page.click('[data-testid="exploracao-recomecar"]'); await page.click('[data-testid="exploracao-confirmar"]'); await page.waitForTimeout(700);
  assert.equal((await documento(page)).session.explored, null);
  assert.ok(await brilho(page, ...lembrada) < 18, 'sem memória, o lugar vira fundo de novo');
  await page.keyboard.press('Control+z'); await page.waitForTimeout(700);
  assert.ok(await brilho(page, ...lembrada) > 120, 'desfazer devolve a memória');
  assert.deepEqual(erros, []); await ctx.close();
});

const telhados = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDosTelhados(): { id: string; alfa: number; alvo: number; dentro: boolean }[] } } }).__atlas.viewport().diagnosticoDosTelhados());

test('telhado: cobre o cômodo na vista de jogador até uma peça entrar, com fade; o mestre o vê esmaecido e em Construir ele some', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, p) => {
    const celulas = []; for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) celulas.push([x, y]);
    s.store.executar({ tipo: "terreno.base", material: "grama" });
    s.store.executar({ tipo: "comodo.criar", id: "casa", nome: "Casa", funcao: null, piso: { material: "tabuas.carvalho", seed: 2 }, papel: null, celulas });
    s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { roof: { material: "telha.barro", visible: true } } });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: p });
  }`, peca('hugo', 'Hugo', 3.75, 3.75, { player: true, vision: { radius: 20, dark: false } }));
  await page.waitForTimeout(1500);
  const centro: [[number, number], [number, number]] = [[8.5, 8.5], [9.5, 9.5]];
  // Construir: sem telhado.
  assert.equal((await telhados(page))[0]!.alfa, 0, 'em Construir não há telhado');
  const piso = await brilho(page, ...centro);
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(500);
  assert.ok(Math.abs((await telhados(page))[0]!.alfa - 0.25) < 0.01, 'o mestre vê o telhado a 25%');
  await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(800);
  let t = (await telhados(page))[0]!; assert.equal(t.alfa, 1, 'os jogadores veem o telhado fechado'); assert.equal(t.dentro, false);
  const coberto = await brilho(page, ...centro); assert.ok(Math.abs(coberto - piso) > 10, `o telhado muda o que se vê (${coberto} contra ${piso})`);
  await page.screenshot({ path: 'test-results/fase7-telhado-fechado.png' });
  // A peça entra: o telhado some com fade (no meio da animação há um meio-termo).
  await sessao(page, '(s) => s.store.executar({ tipo: "peca.mover", id: "hugo", para: [9.75, 9.75], livre: true })'); await page.waitForTimeout(150);
  const meio = (await telhados(page))[0]!; assert.ok(meio.alfa > 0.02 && meio.alfa < 0.98, `no meio do fade (${meio.alfa})`);
  await page.screenshot({ path: 'test-results/fase7-telhado-meio.png' });
  await page.waitForTimeout(900);
  t = (await telhados(page))[0]!; assert.equal(t.alfa, 0); assert.equal(t.dentro, true);
  assert.ok(Math.abs(await brilho(page, ...centro) - coberto) > 10, 'sem telhado, o cômodo aparece');
  // Sair de novo fecha o telhado.
  await sessao(page, '(s) => s.store.executar({ tipo: "peca.mover", id: "hugo", para: [3.75, 3.75], livre: true })'); await page.waitForTimeout(900);
  assert.equal((await telhados(page))[0]!.alfa, 1);
  // Telhado "não visível" não aparece.
  await sessao(page, '(s) => s.store.executar({ tipo: "comodo.atualizar", id: "casa", patch: { roof: { visible: false } } })'); await page.waitForTimeout(800);
  assert.equal((await telhados(page))[0]!.alfa, 0);
  assert.deepEqual(erros, []); await ctx.close();
});

test('revelação: abrir a porta na vista de jogador revela o outro lado aos poucos, e fechar o desbota mais devagar', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await cenarioDaVisao(page, 'closed');
  const fora: [[number, number], [number, number]] = [[15, 9.3], [18, 10.2]];
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400); await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(800);
  const escuro = await brilho(page, ...fora);
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "o1", patch: { state: "open" } })');
  await page.waitForTimeout(60);
  const meio = await brilho(page, ...fora); await page.screenshot({ path: 'test-results/fase7-revelando.png' });
  await page.waitForTimeout(1400);
  const cheio = await brilho(page, ...fora);
  assert.ok(cheio > 30 && escuro < 18, `extremos (${escuro} → ${cheio})`);
  assert.ok(meio > escuro + 1 && meio < cheio - 1, `no meio da revelação há um meio-termo (${escuro} < ${meio} < ${cheio})`);
  // Descer é mais lento que subir: logo depois de fechar, ainda resta luz.
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "o1", patch: { state: "closed" } })'); await page.waitForTimeout(250);
  const saindo = await brilho(page, ...fora); assert.ok(saindo > escuro + 1, `ainda desbotando (${saindo})`);
  await page.waitForTimeout(2200); assert.ok(await brilho(page, ...fora) < 18, 'por fim volta ao fundo');
  assert.deepEqual(erros, []); await ctx.close();
});

test('desempenho: a vista de jogador com 2 peças e 10 luzes não derruba os quadros', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await cenarioDaVisao(page, 'open');
  await sessao(page, `(s, a) => {
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.p2 });
    for (let i = 0; i < 10; i++) s.store.executar({ tipo: "item.adicionar", colecao: "lights", item: { id: "luz" + i, position: [4 + i * 3.5, 5 + (i % 3) * 8], radius: 8, color: "#ffb36b", intensity: 1, flicker: 0.2, cone: null, ownerId: null, power: "fire", on: true, nightOnly: false, preset: null } });
  }`, { p2: peca('ana', 'Ana', 24.75, 9.75, { player: true, vision: { radius: 14, dark: false } }) });
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400); await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(1000);
  const fps = await page.evaluate(() => new Promise<number>(ok => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 >= 2000) ok(n / 2); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  console.log(`# quadros por segundo com 2 peças e 10 luzes: ${fps.toFixed(1)}`);
  assert.ok(fps > 25, `${fps} quadros por segundo`);
  assert.deepEqual(erros, []); await ctx.close();
});

const reguaDiag = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDaRegua(): { quadrados: number; texto: string; pontos: number } | null } } }).__atlas.viewport().diagnosticoDaRegua());

test('régua: R só vale na Sessão; medir 4 células em reta mostra "4 quadrados"; um clique faz dobra; Esc limpa; não mexe no documento', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  // Em Construir o R continua sendo região. (Ao criar o mapa o campo do nome ganha o foco depois de 400 ms: espera passar.)
  await page.waitForTimeout(700); await semFoco(page); await page.keyboard.press('r'); await page.waitForTimeout(200); assert.equal(await ferramentaAtual(page), 'regiao');
  await page.keyboard.press('v'); await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-testid="ferramenta-regua"]').count(), 1);
  await semFoco(page); await page.keyboard.press('r'); await page.waitForTimeout(200); assert.equal(await ferramentaAtual(page), 'regua');
  const antes = JSON.stringify(await documento(page));
  // Arrasta do centro da célula (3,3) ao da (7,3): 4 quadrados, 6 m.
  const [ax, ay] = await clientDe(page, [5.25, 5.25]), [bx, by] = await clientDe(page, [11.25, 5.25]);
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(200);
  assert.deepEqual(await reguaDiag(page), { quadrados: 4, texto: '4 quadrados · 6 m', pontos: 2 });
  // Um clique em outro lugar acrescenta uma dobra (mais 3 quadrados para baixo).
  await clicar(page, [11.25, 9.75]);
  assert.deepEqual(await reguaDiag(page), { quadrados: 7, texto: '7 quadrados · 10,5 m', pontos: 3 });
  // Diagonal: a regra alternada conta 1, 2, 1… (3 diagonais = 4).
  await page.keyboard.press('Escape'); await page.waitForTimeout(150); assert.equal(await reguaDiag(page), null, 'Esc limpa a régua');
  assert.equal(await ferramentaAtual(page), 'regua', 'o primeiro Esc só limpa a régua');
  const [cx, cy] = await clientDe(page, [5.25, 5.25]), [dx, dy] = await clientDe(page, [9.75, 9.75]);
  const medir = async () => { await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(dx, dy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(150); return reguaDiag(page); };
  assert.equal((await medir())?.quadrados, 3, 'simples: a diagonal vale 1');
  await page.keyboard.press('Escape'); await page.click('[data-testid="aba-mapa"]'); await page.locator('[data-testid="painel-mapa"] .linha', { hasText: 'Diagonal' }).locator('select').selectOption('alternada', { timeout: 3000 });
  await page.waitForTimeout(200);
  assert.equal((await medir())?.quadrados, 4, 'alternada: 1 + 2 + 1');
  // Trocar de ferramenta limpa a régua; o documento nunca mudou.
  await page.keyboard.press('v'); await page.waitForTimeout(200); assert.equal(await reguaDiag(page), null);
  assert.equal(JSON.stringify(await documento(page)), antes, 'a régua não mexe no documento');
  assert.deepEqual(erros, []); await ctx.close();
});

test('portas na sessão: clicar abre e fecha (e a vista de jogador acompanha), trancada não abre, Shift+clique só seleciona', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await cenarioDaVisao(page, 'closed');
  const fora: [[number, number], [number, number]] = [[15, 9.3], [18, 10.2]];
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400); await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(700);
  assert.ok(await brilho(page, ...fora) < 18, 'fechada: o outro lado está escondido');
  const estado = async () => (await documento(page)).openings.o1!.state;
  await clicar(page, [12.75, 9]); await page.waitForTimeout(700);
  assert.equal(await estado(), 'open', 'clicar abre'); assert.equal((await sessao(page, '(s) => s.rotuloDesfazer.value')) as string, 'Abrir a porta');
  assert.ok(await brilho(page, ...fora) > 30, 'aberta: a vista de jogador vê o outro lado');
  assert.ok((await documento(page)).session.explored, 'abrir a porta soma ao explorado');
  await clicar(page, [12.75, 9]); await page.waitForTimeout(500); assert.equal(await estado(), 'closed', 'clicar de novo fecha');
  // O cartão da porta, na sessão, tranca; trancada não abre e avisa.
  await page.locator('[data-testid="cartao-trancar"]').click(); await page.waitForTimeout(250); assert.equal(await estado(), 'locked');
  await clicar(page, [12.75, 9]); assert.equal(await estado(), 'locked', 'trancada não abre');
  await page.getByText('Trancada', { exact: true }).first().waitFor({ timeout: 3000 });
  // Shift+clique só seleciona.
  await page.locator('[data-testid="cartao-trancar"]').click(); await page.waitForTimeout(250); assert.equal(await estado(), 'closed', 'destranca pelo cartão');
  const [x, y] = await clientDe(page, [12.75, 9]); await page.keyboard.down('Shift'); await page.mouse.click(x, y); await page.keyboard.up('Shift'); await page.waitForTimeout(200);
  assert.equal(await estado(), 'closed', 'Shift+clique não abre');
  // Em Construir, clicar numa porta só a seleciona.
  await page.click('[data-testid="modo-construir"]'); await page.waitForTimeout(400); await clicar(page, [12.75, 9]); assert.equal(await estado(), 'closed');
  assert.deepEqual(erros, []); await ctx.close();
});

test('portas na sessão: Enter com a peça ao lado interage com a porta; longe, não faz nada', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => {
    s.store.executar({ tipo: "parede.adicionar", parede: a.parede }); s.store.executar({ tipo: "abertura.adicionar", abertura: a.porta });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.perto }); s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.longe });
  }`, {
    parede: { id: 'w1', path: [[12, 0], [12, 30]], height: 2.6, thickness: 0.2, material: 'parede.topo', kind: 'wall', blocks: { move: true, sight: true, light: true }, source: null },
    porta: { id: 'o1', wallId: 'w1', at: 0.3, width: 2, kind: 'door', state: 'closed', material: 'madeira.media', som: null, swing: 'a' },
    perto: peca('perto', 'Perto', 11.25, 9.75, { facing: 'right' }), longe: peca('longe', 'Longe', 5.25, 9.75, { facing: 'right' }),
  });
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400);
  const estado = async () => (await documento(page)).openings.o1!.state;
  await clicar(page, [5.25, 9.75]); await semFoco(page); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  assert.equal(await estado(), 'closed', 'longe da porta, nada acontece');
  await clicar(page, [11.25, 9.75]); await semFoco(page); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  assert.equal(await estado(), 'open', 'Enter com a peça ao lado abre a porta');
  await page.keyboard.press('Enter'); await page.waitForTimeout(250); assert.equal(await estado(), 'closed', 'Enter de novo fecha');
  assert.deepEqual(erros, []); await ctx.close();
});

test('portas secretas: parecem parede na vista de jogador mesmo abertas, até o mestre revelar (que emite atlas.revelado)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await cenarioDaVisao(page, 'closed', 'secret');
  const fora: [[number, number], [number, number]] = [[15, 9.3], [18, 10.2]];
  await page.evaluate(() => { const w = window as unknown as { __atlas: { servicos(): { barramento: { ouvir(t: string, f: (e: unknown) => void): void } } }; __revelado?: unknown[] }; w.__revelado = []; w.__atlas.servicos().barramento.ouvir('atlas.revelado', e => w.__revelado!.push(e)); });
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(400); await page.click('[data-testid="vista-jogador"]'); await page.waitForTimeout(700);
  // O mestre abre a secreta por baixo dos panos (como um mapa feito em Construir): os jogadores ainda não veem nada além da parede.
  await sessao(page, '(s) => s.store.executar({ tipo: "abertura.atualizar", id: "o1", patch: { state: "open" } })'); await page.waitForTimeout(700);
  assert.ok(await brilho(page, ...fora) < 18, 'secreta aberta e não revelada ainda é parede para os jogadores');
  // Selecionar com Shift+clique mostra o cartão com "Revelar aos jogadores".
  const [x, y] = await clientDe(page, [12.75, 9]); await page.keyboard.down('Shift'); await page.mouse.click(x, y); await page.keyboard.up('Shift');
  await page.locator('[data-testid="cartao-revelar"]').click(); await page.waitForTimeout(800);
  assert.deepEqual((await documento(page)).session.revealed, ['o1']);
  assert.ok(await brilho(page, ...fora) > 30, 'revelada e aberta: os jogadores veem o outro lado');
  assert.equal(await page.locator('[data-testid="cartao-revelar"]').count(), 0, 'o botão some depois de revelar');
  const eventos = await page.evaluate(() => (window as unknown as { __revelado: { tipo: string }[] }).__revelado);
  assert.equal(eventos.length, 1); assert.equal(eventos[0]!.tipo, 'atlas.revelado');
  assert.equal(await page.evaluate(() => (window as unknown as { __atlas: { sessao(): { rotuloDesfazer: { value: string } } } }).__atlas.sessao().rotuloDesfazer.value), 'Revelar aos jogadores');
  assert.deepEqual(erros, []); await ctx.close();
});

const historico = (p: Page) => sessao(p, '(s) => s.store.historico.length') as Promise<number>;
const eventosDiag = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDosEventos(): { ativos: string[]; ambiente: number; luzes: number; clarao: number } } } }).__atlas.viewport().diagnosticoDosEventos());

test('dock: o clima ao vivo muda com a transição escolhida (o meio de 3 s fica entre os dois brilhos)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s) => s.store.executar({ tipo: "terreno.base", material: "grama" })'); await page.waitForTimeout(500);
  assert.equal(await page.locator('[data-testid="dock"]').count(), 0, 'o dock só existe na Sessão');
  await page.click('[data-testid="modo-sessao"]'); await page.locator('[data-testid="dock"]').waitFor();
  const area: [[number, number], [number, number]] = [[3, 3], [12, 12]];
  await page.click('[data-testid="dock-clima-tarde"]'); await page.waitForTimeout(2500);
  const dia = await brilho(page, ...area);
  await page.click('[data-testid="dock-duracao-3"]'); assert.equal(await page.locator('[data-testid="dock-duracao-3"]').getAttribute('aria-pressed'), 'true');
  await page.click('[data-testid="dock-clima-noite"]'); await page.waitForTimeout(1500);
  assert.equal((await documento(page)).climate.preset, 'noite');
  const meio = await brilho(page, ...area); await page.waitForTimeout(3200);
  const noite = await brilho(page, ...area);
  console.log(`# brilho dia/meio/noite: ${dia.toFixed(1)} / ${meio.toFixed(1)} / ${noite.toFixed(1)}`);
  assert.ok(noite < meio - 3 && meio < dia - 3, `o meio da transição fica entre os dois (${dia} > ${meio} > ${noite})`);
  assert.deepEqual(erros, []); await ctx.close();
});

test('dock: eventos de cena não mudam o documento; arrastar a intensidade de uma presença é uma entrada de histórico', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, '(s) => s.store.executar({ tipo: "item.adicionar", colecao: "presence", item: { id: "pr1", brush: "musgo", cells: [[4, 4, 6]], intensity: 0, seed: 3, gmOnly: false } })');
  await page.click('[data-testid="modo-sessao"]'); await page.locator('[data-testid="dock"]').waitFor();
  const antes = JSON.stringify(await documento(page)), n0 = await historico(page);
  for (const e of ['tremor', 'piscar', 'escurecer', 'clarao']) {
    await page.click(`[data-testid="dock-evento-${e}"]`); await page.waitForTimeout(60);
    assert.ok((await eventosDiag(page)).ativos.includes(e), `${e} está rodando`);
  }
  const d = await eventosDiag(page); assert.ok(d.ambiente < 1 || d.luzes < 1 || d.clarao > 0, 'os eventos têm efeito');
  assert.equal(JSON.stringify(await documento(page)), antes, 'eventos de cena não mudam o documento'); assert.equal(await historico(page), n0);
  // Presença: arrastar de 0 a 1.
  await page.click('[data-testid="dock-titulo-presenca"]');
  const slider = page.locator('[data-testid="dock-presenca-pr1"]'), caixa = (await slider.boundingBox())!;
  await page.mouse.move(caixa.x + 3, caixa.y + caixa.height / 2); await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2, { steps: 6 }); await page.waitForTimeout(100);
  const meio = (await documento(page)).presence.pr1!.intensity; assert.ok(meio > 0.2 && meio < 0.8, `ao vivo, no meio do arrasto (${meio})`);
  await page.mouse.move(caixa.x + caixa.width + 20, caixa.y + caixa.height / 2, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(200);
  assert.ok((await documento(page)).presence.pr1!.intensity > 0.95, 'chegou a 1');
  assert.equal(await historico(page), n0 + 1, 'o arrasto inteiro é UMA entrada de histórico');
  assert.deepEqual(erros, []); await ctx.close();
});

test('dock: iniciativa com duas peças — a faixa segue a ordem, passar a vez duas vezes sobe a rodada, a peça da vez ganha o anel e encerrar limpa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await sessao(page, `(s, a) => { s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.a }); s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.b }); }`, { a: peca('a', 'Ana', 5.25, 5.25), b: peca('b', 'Beto', 9.75, 5.25) });
  await page.click('[data-testid="modo-sessao"]'); await page.locator('[data-testid="dock"]').waitFor();
  await page.click('[data-testid="dock-titulo-iniciativa"]');
  await page.locator('[data-testid="dock-iniciativa-valor-a"]').fill('10'); await page.locator('[data-testid="dock-iniciativa-valor-b"]').fill('15');
  await page.click('[data-testid="dock-iniciativa-comecar"]'); await page.locator('[data-testid="faixa-iniciativa"]').waitFor();
  const ini = async () => (await documento(page)).session.initiative!;
  assert.deepEqual((await ini()).order.map(x => x.tokenId), ['b', 'a']);
  const vez = async () => (await diag(page)).filter(x => (x as unknown as { vez: boolean }).vez).map(x => x.id);
  await page.waitForTimeout(200); assert.deepEqual(await vez(), ['b'], 'o anel está na peça da vez');
  assert.equal(await page.locator('[data-testid="iniciativa-entrada-b"]').getAttribute('data-atual'), 'true');
  await page.click('[data-testid="iniciativa-proxima"]'); await page.waitForTimeout(200); assert.deepEqual(await vez(), ['a']); assert.equal((await ini()).round, 1);
  await page.click('[data-testid="iniciativa-proxima"]'); await page.waitForTimeout(200);
  assert.equal((await ini()).round, 2); assert.equal((await ini()).current, 0); assert.match((await page.locator('[data-testid="iniciativa-rodada"]').textContent()) ?? '', /Rodada 2/);
  await page.click('[data-testid="iniciativa-anterior"]'); await page.waitForTimeout(150); assert.equal((await ini()).round, 1, 'voltar desce a rodada');
  await page.locator('[data-testid="iniciativa-valor-a"]').fill('99'); await page.locator('[data-testid="iniciativa-valor-a"]').press('Tab'); await page.waitForTimeout(150);
  assert.deepEqual((await ini()).order.map(x => x.tokenId), ['a', 'b'], 'editar o valor reordena');
  await page.click('[data-testid="iniciativa-encerrar"]'); await page.waitForTimeout(200);
  assert.equal((await documento(page)).session.initiative, null); assert.equal(await page.locator('[data-testid="faixa-iniciativa"]').count(), 0);
  assert.deepEqual(await vez(), [], 'sem anel depois de encerrar');
  assert.deepEqual(erros, []); await ctx.close();
});
