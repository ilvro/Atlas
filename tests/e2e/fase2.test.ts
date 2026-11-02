import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, esperarEditor, esperarMs, iniciarAmbiente, novoContexto, selecao, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const toast = (p: Page, texto: string | RegExp) => p.locator('[data-testid="toasts"] .toast', { hasText: texto });
const estado = (p: Page) => p.locator('[data-testid="estado-gravacao"]');
async function pôr(p: Page, ferramenta: 'luz' | 'objeto' | 'peca' | 'regiao', mundo: [number, number]) {
  await p.click(`[data-testid="ferramenta-${ferramenta}"]`);
  const [x, y] = await clientDe(p, mundo);
  await p.mouse.click(x, y);
  await p.click('[data-testid="ferramenta-selecionar"]');
}

test('criar, gravar, reabrir, desfazer e exportar um mapa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await page.waitForSelector('[data-testid="galeria-vazia"]');
  const id = await criarMapaPelaInterface(page);
  // O nome começa selecionado: digitar substitui.
  await page.fill('#nome-do-mapa', 'Casa dos Salgueiros'); await page.press('#nome-do-mapa', 'Enter');
  await page.waitForFunction(() => document.querySelector('[data-testid="estado-gravacao"]')?.getAttribute('data-sujo') === 'true');
  assert.match(await estado(page).innerText(), /não gravadas/);
  await page.click('[data-testid="gravar"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="estado-gravacao"]')?.getAttribute('data-sujo') === 'false');
  assert.match(await estado(page).innerText(), /Tudo gravado/);
  await toast(page, 'Mapa gravado').waitFor();

  await pôr(page, 'luz', [6, 6]);
  assert.equal(Object.keys((await documento(page)).lights).length, 1);
  await page.keyboard.press('Control+z');
  assert.equal(Object.keys((await documento(page)).lights).length, 0);
  await toast(page, /Desfeito: Adicionar luz/).waitFor();
  await page.keyboard.press('Control+Shift+z');
  assert.equal(Object.keys((await documento(page)).lights).length, 1);
  await page.click('[data-testid="gravar"]');
  await page.waitForFunction(() => document.querySelector('[data-testid="estado-gravacao"]')?.getAttribute('data-sujo') === 'false');

  // Recarregar: o mapa volta como estava.
  await page.reload(); await esperarEditor(page);
  const reaberto = await documento(page);
  assert.equal(reaberto.name, 'Casa dos Salgueiros'); assert.equal(Object.keys(reaberto.lights).length, 1); assert.equal(reaberto.id, id); assert.ok(reaberto.revision >= 3);

  // Exportar: o arquivo é um mapa válido do Atlas.
  const baixando = page.waitForEvent('download');
  await page.keyboard.press('Control+e');
  const arquivo = await baixando;
  assert.match(arquivo.suggestedFilename(), /^casa-dos-salgueiros-\d{4}-\d{2}-\d{2}\.atlas\.json$/);
  const caminho = join(await mkdtemp(join(tmpdir(), 'atlas-')), arquivo.suggestedFilename()); await arquivo.saveAs(caminho);
  const pacote = JSON.parse(await readFile(caminho, 'utf8'));
  assert.equal(pacote.formato, 'atlas.backup'); assert.equal(pacote.mapas[0].name, 'Casa dos Salgueiros'); assert.equal(Object.keys(pacote.mapas[0].lights).length, 1);
  assert.deepEqual(erros, []); await ctx.close();
});

test('importar o arquivo exportado em outro navegador recria o mapa idêntico', async () => {
  const a = await novoContexto(amb), pa = await abrir(a, amb.url);
  await criarMapaPelaInterface(pa.page);
  await pa.page.fill('#nome-do-mapa', 'Exportado'); await pa.page.press('#nome-do-mapa', 'Enter');
  await pôr(pa.page, 'peca', [9, 7.5]); await pôr(pa.page, 'regiao', [15, 9]);
  await pa.page.click('[data-testid="gravar"]'); await toast(pa.page, 'Mapa gravado').waitFor();
  const original = await documento(pa.page);
  const baixando = pa.page.waitForEvent('download'); await pa.page.keyboard.press('Control+e');
  const caminho = join(await mkdtemp(join(tmpdir(), 'atlas-')), 'mapa.atlas.json'); await (await baixando).saveAs(caminho);

  const b = await novoContexto(amb), pb = await abrir(b, amb.url);
  await pb.page.waitForSelector('[data-testid="galeria-vazia"]');
  const escolhendo = pb.page.waitForEvent('filechooser'); await pb.page.click('[data-testid="importar"]');
  await (await escolhendo).setFiles(caminho);
  await toast(pb.page, /1 mapa\(s\) importado/).waitFor();
  await pb.page.click('[data-testid="cartao-mapa"] a');
  await esperarEditor(pb.page);
  const importado = await documento(pb.page);
  assert.equal(importado.id, original.id);
  assert.deepEqual({ ...importado, revision: 0, createdAt: 0, updatedAt: 0 }, { ...original, revision: 0, createdAt: 0, updatedAt: 0 });
  // Importar de novo: o mesmo id vira cópia, sem apagar o original.
  await pb.page.click('[data-testid="abrir-paleta"]'); await pb.page.fill('[data-testid="paleta"] input', 'galeria'); await pb.page.keyboard.press('Enter');
  const escolhendo2 = pb.page.waitForEvent('filechooser'); await pb.page.click('[data-testid="importar"]'); await (await escolhendo2).setFiles(caminho);
  await pb.page.waitForFunction(() => document.querySelectorAll('[data-testid="cartao-mapa"]').length === 2);
  assert.deepEqual(pa.erros.concat(pb.erros), []); await a.close(); await b.close();
});

test('trocar o tema muda a interface e as outras abas, ao vivo', async () => {
  const ctx = await novoContexto(amb), um = await abrir(ctx, amb.url), dois = await abrir(ctx, amb.url);
  const acento = (p: Page) => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--acento').trim());
  assert.equal(await um.page.evaluate(() => document.documentElement.dataset.tema), 'ordem'); assert.equal(await acento(um.page), '#e91d25');
  await um.page.click('[data-testid="tema-prata"]');
  assert.equal(await um.page.evaluate(() => document.documentElement.dataset.tema), 'prata'); assert.equal(await acento(um.page), '#d8dbe2');
  await dois.page.waitForFunction(() => document.documentElement.dataset.tema === 'prata');
  assert.equal(await acento(dois.page), '#d8dbe2');
  assert.equal(await dois.page.evaluate(() => document.documentElement.dataset.transicao), 'tinta');
  await dois.page.click('[data-testid="tema-neutro"]');
  await um.page.waitForFunction(() => document.documentElement.dataset.tema === 'neutro');
  // O tema sobrevive a recarregar e vale para páginas novas (é o localStorage compartilhado da mesa).
  const tres = await abrir(ctx, amb.url);
  assert.equal(await tres.page.evaluate(() => document.documentElement.dataset.tema), 'neutro');
  assert.deepEqual([...um.erros, ...dois.erros, ...tres.erros], []); await ctx.close();
});

test('link profundo abre o mapa; id desconhecido e cômodo ausente avisam sem quebrar', async () => {
  const ctx = await novoContexto(amb), { page } = await abrir(ctx, amb.url);
  const id = await criarMapaPelaInterface(page);
  await page.click('[data-testid="ferramenta-selecionar"]'); await page.keyboard.press('Alt+g');
  await page.waitForSelector('[data-testid="lista-mapas"]');

  const nova = await abrir(ctx, `${amb.url}#/mapa/${id}`); await esperarEditor(nova.page);
  assert.equal((await documento(nova.page)).id, id);
  await nova.page.goto(`${amb.url}#/mapa/${id}/comodo/sala-fantasma`); await toast(nova.page, /não existe neste mapa/).waitFor();
  await nova.page.goto(`${amb.url}#/mapa/nao-existe`); await nova.page.waitForSelector('[data-testid="mapa-ausente"]');
  assert.match(await nova.page.locator('[data-testid="mapa-ausente"]').innerText(), /nao-existe/);
  await nova.page.goto(`${amb.url}#/qualquer-coisa`); await nova.page.waitForSelector('[data-testid="lista-mapas"]');
  assert.deepEqual(nova.erros, []); await ctx.close();
});

test('paleta de comandos: busca sem acento, executa e fecha com Esc', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await page.click('[data-testid="ferramenta-selecionar"]');
  await page.keyboard.press('Control+k');
  const campo = page.locator('[data-testid="paleta"] input'); await campo.waitFor();
  await campo.fill('adicionar regiao'); assert.match(await page.locator('[role="option"]').first().innerText(), /Adicionar região/i);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-testid="area-do-mapa"]')?.getAttribute('data-ferramenta') === 'regiao');
  assert.equal(await page.locator('[data-testid="paleta"]').count(), 0);
  await page.keyboard.press('Control+k'); await campo.waitFor(); await campo.fill('zzzz');
  await page.locator('.paleta-vazio').waitFor(); await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-testid="paleta"]').count(), 0);
  // Esc fora da paleta volta para a ferramenta de seleção.
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-testid="area-do-mapa"]')?.getAttribute('data-ferramenta') === 'selecionar');
  assert.deepEqual(erros, []); await ctx.close();
});

test('menu radial: clique direito no vazio adiciona; sobre um item oferece remover e duplicar', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await page.click('[data-testid="ferramenta-selecionar"]');
  const [x, y] = await clientDe(page, [12, 9]);
  await page.mouse.click(x, y, { button: 'right' });
  // O contêiner do menu tem tamanho zero (os itens ficam em volta dele): espera-se o primeiro item, não o contêiner.
  const menu = page.locator('[data-testid="menu-radial"]'); await menu.locator('[role="menuitem"]').first().waitFor();
  assert.ok(await menu.locator('[role="menuitem"]').count() >= 6);
  await menu.getByRole('menuitem', { name: /Luz aqui/ }).click();
  const luzes = Object.values((await documento(page)).lights); assert.equal(luzes.length, 1);
  assert.deepEqual(luzes[0]!.position, [12, 9]);
  // Sobre o item: o clique direito o seleciona e mostra as ações dele.
  await page.mouse.click(x, y, { button: 'right' }); await menu.locator('[role="menuitem"]').first().waitFor();
  assert.deepEqual((await selecao(page)).map(a => a.colecao), ['lights']);
  await page.keyboard.press('2');   // 2 = Remover
  assert.equal(Object.keys((await documento(page)).lights).length, 0);
  assert.equal(await menu.count(), 0);
  assert.deepEqual(erros, []); await ctx.close();
});

test('seleção por retângulo e por laço, mover com encaixe, remover com Desfazer no aviso', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await pôr(page, 'peca', [6, 6]); await pôr(page, 'objeto', [9, 6]); await pôr(page, 'luz', [18, 15]);
  const [ax, ay] = await clientDe(page, [4.5, 4.5]), [bx, by] = await clientDe(page, [10.5, 7.5]);
  // Retângulo: pega a peça e o objeto, deixa a luz.
  await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 4 }); await page.mouse.move(bx, by, { steps: 4 }); await page.mouse.up();
  assert.deepEqual((await selecao(page)).map(a => a.colecao).sort(), ['props', 'tokens']);
  assert.match(await page.locator('[data-testid="contagem-selecao"]').innerText(), /2 selecionado/);
  // Clique no vazio limpa.
  const [vx, vy] = await clientDe(page, [30, 22]); await page.mouse.click(vx, vy);
  assert.equal((await selecao(page)).length, 0);
  // Laço (Alt): um triângulo que envolve só a luz.
  const laco = [await clientDe(page, [16, 13.5]), await clientDe(page, [20.5, 13.5]), await clientDe(page, [18, 17])];
  await page.keyboard.down('Alt'); await page.mouse.move(...laco[0]!); await page.mouse.down();
  for (const p of [...laco.slice(1), laco[0]!]) await page.mouse.move(p[0], p[1], { steps: 5 });
  await page.mouse.up(); await page.keyboard.up('Alt');
  assert.deepEqual((await selecao(page)).map(a => a.colecao), ['lights']);
  // Shift soma.
  const [px, py] = await clientDe(page, [6, 6]); await page.keyboard.down('Shift'); await page.mouse.click(px, py); await page.keyboard.up('Shift');
  assert.equal((await selecao(page)).length, 2);

  // Mover a peça: o arrasto vira UMA entrada de histórico e termina num encaixe de meia célula (0,75 m).
  await page.mouse.click(vx, vy);
  const antes = (await documento(page)); const peca = Object.values(antes.tokens)[0]!;
  const [tx, ty] = await clientDe(page, peca.position); const [dx, dy] = await clientDe(page, [peca.position[0] + 3.1, peca.position[1] + 2.3]);
  const n = await page.evaluate(() => (window as unknown as { __atlas: { sessao(): { store: { historico: string[] } } } }).__atlas.sessao().store.historico.length);
  await page.mouse.move(tx, ty); await page.mouse.down(); await page.mouse.move(dx, dy, { steps: 12 }); await page.mouse.up();
  const depois = Object.values((await documento(page)).tokens)[0]!;
  for (const v of depois.position) assert.ok(Math.abs(v / 0.75 - Math.round(v / 0.75)) < 1e-6, `${v} deveria estar na grade de 0,75 m`);
  assert.ok(depois.position[0] - peca.position[0] > 2.9 && depois.position[1] - peca.position[1] > 2);
  assert.equal(await page.evaluate(() => (window as unknown as { __atlas: { sessao(): { store: { historico: string[] } } } }).__atlas.sessao().store.historico.length), n + 1);
  await page.keyboard.press('Control+z');
  assert.deepEqual(Object.values((await documento(page)).tokens)[0]!.position, peca.position);

  // Esc no meio do arrasto cancela e não deixa nada no histórico.
  await page.mouse.move(tx, ty); await page.mouse.down(); await page.mouse.move(dx, dy, { steps: 6 }); await page.keyboard.press('Escape'); await page.mouse.up();
  assert.deepEqual(Object.values((await documento(page)).tokens)[0]!.position, peca.position);

  // Selecionar tudo, remover, e desfazer pelo botão do aviso.
  await page.keyboard.press('Control+a'); await page.keyboard.press('Delete');
  const doc = await documento(page); assert.equal(Object.keys(doc.tokens).length + Object.keys(doc.props).length + Object.keys(doc.lights).length, 0);
  await toast(page, /3 itens removidos/).locator('.toast-acao').click();
  const restaurado = await documento(page); assert.equal(Object.keys(restaurado.tokens).length + Object.keys(restaurado.props).length + Object.keys(restaurado.lights).length, 3);
  assert.deepEqual(erros, []); await ctx.close();
});

test('Alt desliga o encaixe na grade; as setas movem em meia célula e Shift em uma célula', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await pôr(page, 'objeto', [9, 9]);
  const id = Object.keys((await documento(page)).props)[0]!;
  await page.keyboard.press('ArrowRight'); assert.equal((await documento(page)).props[id]!.position[0], 9.75);
  await page.keyboard.press('Shift+ArrowDown'); assert.equal((await documento(page)).props[id]!.position[1], 10.5);
  const p = (await documento(page)).props[id]!.position; const [x, y] = await clientDe(page, p);
  await page.keyboard.down('Alt'); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 37, y + 11, { steps: 8 }); await page.mouse.up(); await page.keyboard.up('Alt');
  const q = (await documento(page)).props[id]!.position;
  assert.ok(Math.abs(q[0] / 0.75 - Math.round(q[0] / 0.75)) > 1e-3, 'sem encaixe, a posição cai fora da grade');
  assert.deepEqual(erros, []); await ctx.close();
});

test('inspetor: editar uma luz (cor, alcance, facho) cria itens de histórico e valores inválidos são recusados', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page); await pôr(page, 'luz', [9, 9]);
  const [x, y] = await clientDe(page, [9, 9]); await page.mouse.click(x, y);
  await page.waitForSelector('[data-testid="titulo-selecao"]');
  assert.match(await page.locator('[data-testid="titulo-selecao"]').innerText(), /Luz/i);
  const luz = async () => Object.values((await documento(page)).lights)[0]!;
  const alcance = page.locator('.linha', { hasText: 'Alcance' }).locator('input');
  await alcance.fill('9'); await alcance.press('Enter'); assert.equal((await luz()).radius, 9);
  await alcance.fill('0'); await alcance.press('Enter');
  await toast(page, /Valor inválido/).waitFor(); assert.equal((await luz()).radius, 9);
  await page.locator('.linha', { hasText: 'Facho' }).locator('input').check();
  assert.ok((await luz()).cone); assert.match(await page.locator('[data-testid="titulo-selecao"]').innerText(), /Lanterna/i);
  await page.locator('.linha', { hasText: 'Acesa' }).locator('input').uncheck(); assert.equal((await luz()).on, false);
  await page.keyboard.press('i'); assert.equal((await luz()).on, true);
  await page.click('[data-testid="aba-historico"]');
  const itens = await page.locator('[data-testid="painel-historico"] li').allInnerTexts();
  assert.ok(itens[0]!.includes('Acender') && itens.some(t => /Alcance da luz/.test(t)) && itens.some(t => /Virar lanterna/.test(t)));
  assert.deepEqual(erros, []); await ctx.close();
});

test('o rascunho automático sobrevive a recarregar e pode ser recuperado; descartar o limpa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const id = await criarMapaPelaInterface(page);
  await page.click('[data-testid="aba-mapa"]');
  await page.fill('#nome-do-mapa', 'Gravado'); await page.press('#nome-do-mapa', 'Enter'); await page.click('[data-testid="gravar"]'); await toast(page, 'Mapa gravado').waitFor();
  await pôr(page, 'luz', [9, 9]); await page.fill('#nome-do-mapa', 'Esqueci de gravar'); await page.press('#nome-do-mapa', 'Enter');
  await esperarMs(1700);   // o rascunho espera uma pausa de 1,2 s
  await page.reload(); await esperarEditor(page);
  const aviso = toast(page, /alterações de .* que não foram gravadas/); await aviso.waitFor();
  assert.equal((await documento(page)).name, 'Gravado');
  await aviso.locator('.toast-acao').click();
  const recuperado = await documento(page);
  assert.equal(recuperado.name, 'Esqueci de gravar'); assert.equal(Object.keys(recuperado.lights).length, 1);
  assert.match(await estado(page).innerText(), /não gravadas/);
  await page.click('[data-testid="gravar"]'); await toast(page, 'Mapa gravado').waitFor();
  await page.reload(); await esperarEditor(page); await esperarMs(400);
  assert.equal(await toast(page, /não foram gravadas/).count(), 0, 'depois de gravar não há mais rascunho');
  assert.equal((await documento(page)).id, id);
  assert.deepEqual(erros, []); await ctx.close();
});

test('edição do mesmo mapa em duas abas: a segunda a gravar recebe um conflito e pode sobrescrever', async () => {
  const ctx = await novoContexto(amb), a = await abrir(ctx, amb.url);
  const id = await criarMapaPelaInterface(a.page);
  const b = await abrir(ctx, `${amb.url}#/mapa/${id}`); await esperarEditor(b.page);
  await a.page.fill('#nome-do-mapa', 'Da aba A'); await a.page.press('#nome-do-mapa', 'Enter'); await a.page.click('[data-testid="gravar"]'); await toast(a.page, 'Mapa gravado').waitFor();
  await b.page.fill('#nome-do-mapa', 'Da aba B'); await b.page.press('#nome-do-mapa', 'Enter'); await b.page.click('[data-testid="gravar"]');
  await toast(b.page, /alterado em outra aba/).waitFor();
  assert.equal(await b.page.locator('[data-testid="estado-gravacao"]').getAttribute('data-estado'), 'conflito');
  await toast(b.page, /alterado em outra aba/).locator('.toast-acao').click();
  await toast(b.page, 'Mapa gravado').waitFor();
  const c = await abrir(ctx, `${amb.url}#/mapa/${id}`); await esperarEditor(c.page);
  assert.equal((await documento(c.page)).name, 'Da aba B');
  await ctx.close();
});

test('animações: ligadas criam efeitos; desligadas ou com movimento reduzido, não', async () => {
  const efeitos = (p: Page) => p.locator('#fx-layer > *').count();
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await pôr(page, 'luz', [6, 6]); assert.ok(await efeitos(page) > 0, 'com animações ligadas, o item novo solta efeitos');
  await page.waitForFunction(() => document.querySelectorAll('#fx-layer > *').length === 0, null, { timeout: 4000 });
  await page.click('[data-testid="alternar-fx"]');
  await pôr(page, 'luz', [9, 6]); assert.equal(await efeitos(page), 0);
  assert.equal(await page.evaluate(() => localStorage.getItem('atlas:fx')), '0');
  await ctx.close();

  const reduzido = await novoContexto(amb, { reducedMotion: 'reduce' }), r = await abrir(reduzido, amb.url);
  await criarMapaPelaInterface(r.page); await pôr(r.page, 'luz', [6, 6]);
  assert.equal(await efeitos(r.page), 0, 'movimento reduzido no sistema vence a preferência do usuário');
  assert.equal(Object.keys((await documento(r.page)).lights).length, 1, 'e o resultado é o mesmo');
  assert.deepEqual([...erros, ...r.erros], []); await reduzido.close();
});

test('campanha: o mapa vira um "lugar" na campanha, acompanha o nome e sobrevive à remoção do mapa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await page.click('[data-testid="nova-campanha"]'); await page.fill('[data-testid="nova-campanha-nome"]', 'A Ilha'); await page.press('[data-testid="nova-campanha-nome"]', 'Enter');
  await toast(page, /Campanha “A Ilha” criada/).waitFor();
  const id = await criarMapaPelaInterface(page);
  const entidades = () => page.evaluate(async () => {
    type Camp = { listarCampanhas(): Promise<{ id: string }[]>; listarEntidades(c: string): Promise<unknown[]> };
    const s = (window as unknown as { __atlas: { servicos(): { campanhas: Camp } } }).__atlas.servicos();
    const [c] = await s.campanhas.listarCampanhas(); return { campanha: c, entidades: await s.campanhas.listarEntidades(c!.id) } as { campanha: { id: string; nome: string }; entidades: { nome: string; tipo: string; refs: { app: string; tipo: string; id: string }[]; criadaPor: string }[] };
  });
  let r = await entidades();
  assert.equal(r.campanha.nome, 'A Ilha'); assert.equal((await documento(page)).campanhaId, r.campanha.id);
  assert.deepEqual(r.entidades.map(e => [e.nome, e.tipo, e.criadaPor, e.refs]), [['Mapa sem nome', 'lugar', 'atlas', [{ app: 'atlas', tipo: 'mapa', id }]]]);
  await page.fill('#nome-do-mapa', 'Casa dos Salgueiros'); await page.press('#nome-do-mapa', 'Enter'); await page.click('[data-testid="gravar"]'); await toast(page, 'Mapa gravado').waitFor();
  await esperarMs(150); r = await entidades(); assert.equal(r.entidades[0]!.nome, 'Casa dos Salgueiros');
  // Remover o mapa da galeria mantém o lugar, sem a referência; desfazer religa a mesma entidade.
  await page.keyboard.press('Alt+g'); await page.click('[data-testid="remover-mapa"]', { force: true });
  await toast(page, /removido/).waitFor(); r = await entidades(); assert.equal(r.entidades.length, 1); assert.deepEqual(r.entidades[0]!.refs, []);
  await toast(page, /removido/).locator('.toast-acao').click(); await toast(page, 'Mapa restaurado').waitFor();
  r = await entidades(); assert.equal(r.entidades.length, 1); assert.equal(r.entidades[0]!.refs.length, 1);
  assert.deepEqual(erros, []); await ctx.close();
});

test('plataforma: um pedido atlas.focar vindo de outro aplicativo abre o mapa e é respondido', async () => {
  const ctx = await novoContexto(amb), atlas = await abrir(ctx, amb.url);
  const id = await criarMapaPelaInterface(atlas.page);
  await atlas.page.keyboard.press('Alt+g'); await atlas.page.waitForSelector('[data-testid="lista-mapas"]');
  // Uma página "da Ficha" na mesma origem pede ao Atlas que mostre o mapa.
  const ficha = await ctx.newPage(); await ficha.goto(`${amb.url}icone.svg`);
  const resposta = await ficha.evaluate(async (mapaId: string) => {
    const canal = new BroadcastChannel('mesa:eventos'), pedido = crypto.randomUUID();
    return new Promise<unknown>(ok => {
      canal.onmessage = e => { if (e.data?.respondeA === pedido) { canal.close(); ok(e.data); } };
      canal.postMessage({ contrato: 1, app: 'ficha', tipo: 'atlas.focar', id: pedido, em: Date.now(), campanhaId: null, dados: { ref: { app: 'atlas', tipo: 'mapa', id: mapaId } } });
      setTimeout(() => ok('sem resposta'), 4000);
    });
  }, id) as { app: string; dados: { ok: boolean } };
  assert.equal(resposta.app, 'atlas'); assert.equal(resposta.dados.ok, true);
  await esperarEditor(atlas.page); assert.equal((await documento(atlas.page)).id, id);
  assert.deepEqual(atlas.erros, []); await ctx.close();
});

test('o cômodo de um link profundo é enquadrado', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const id = await criarMapaPelaInterface(page);
  // Cria um cômodo direto no armazenamento (a ferramenta de cômodo chega na Fase 3) e abre pelo link profundo.
  await page.evaluate(async (mapaId: string) => {
    const s = (window as unknown as { __atlas: { servicos(): { repo: { obter(i: string): Promise<Record<string, unknown>>; salvar(m: unknown): Promise<unknown> } } } }).__atlas.servicos();
    const m = await s.repo.obter(mapaId) as { rooms: Record<string, unknown> };
    m.rooms.biblioteca = { id: 'biblioteca', name: 'Biblioteca', function: null, cells: [[10, 20, 4], [11, 20, 4]], floor: { material: 'ladrilho.xadrez', seed: 1 }, wallpaper: null, wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null };
    await s.repo.salvar(m);
  }, id);
  await page.goto(`${amb.url}#/mapa/${id}/comodo/biblioteca`); await page.reload(); await esperarEditor(page);
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { camera: { zoom: number } } } }).__atlas.viewport().camera.zoom > 40);
  const [x, y] = await clientDe(page, [33, 16.5]);   // o centro do cômodo: colunas 20–23 e linhas 10–11, com células de 1,5 m
  const area = await page.locator('[data-testid="area-do-mapa"]').boundingBox();
  assert.ok(Math.abs(x - (area!.x + area!.width / 2)) < 30 && Math.abs(y - (area!.y + area!.height / 2)) < 30, 'o cômodo está no centro da vista');
  assert.deepEqual(erros, []); await ctx.close();
});

test('mesa-dev: dois aplicativos sob a mesma origem compartilham tema e campanha, como no GitHub Pages', async () => {
  const { criarProxy, lerProjeto } = await import('../../scripts/mesa-dev.ts');
  const http = await import('node:http');
  // Uma "Ficha" de mentira: só uma página, em outra porta, que lê o que a mesa compartilha.
  const ficha = http.createServer((_, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><title>Ficha</title><body>ficha</body>'); });
  await new Promise<void>(ok => ficha.listen(0, '127.0.0.1', ok));
  const portaFicha = (ficha.address() as { port: number }).port;
  // O Atlas em modo mesa: o Vite serve sob /Atlas/, como faz `npm run dev:mesa`.
  const { createServer } = await import('vite');
  const vite = await createServer({ configFile: new URL('../../vite.config.ts', import.meta.url).pathname, base: '/Atlas/', logLevel: 'error', server: { port: 0, strictPort: false, host: '127.0.0.1' } });
  await vite.listen();
  const proxy = criarProxy([lerProjeto(`Atlas=${vite.httpServer!.address() && (vite.httpServer!.address() as { port: number }).port}`), lerProjeto(`Ficha=${portaFicha}@raiz`)]);
  await new Promise<void>(ok => proxy.listen(0, '127.0.0.1', ok));
  const origem = `http://127.0.0.1:${(proxy.address() as { port: number }).port}`;
  const ctx = await novoContexto(amb);
  try {
    const atlas = await abrir(ctx, `${origem}/Atlas/`);
    await atlas.page.click('[data-testid="nova-campanha"]'); await atlas.page.fill('[data-testid="nova-campanha-nome"]', 'A Ilha'); await atlas.page.press('[data-testid="nova-campanha-nome"]', 'Enter');
    await toast(atlas.page, /Campanha “A Ilha” criada/).waitFor();
    await criarMapaPelaInterface(atlas.page);
    await atlas.page.click('[data-testid="tema-prata"]');

    const outra = await ctx.newPage(); await outra.goto(`${origem}/Ficha/`);
    assert.equal(new URL(outra.url()).origin, new URL(atlas.page.url()).origin, 'a mesma origem');
    assert.equal(await outra.evaluate(() => JSON.parse(localStorage.getItem('mesa:tema')!).id), 'prata', 'o tema é um só para os dois');
    // O banco da campanha é visto do outro aplicativo, com o "lugar" criado pelo Atlas.
    const vistas = await outra.evaluate(() => new Promise<{ campanhas: string[]; entidades: { nome: string; criadaPor: string }[] }>((ok, ruim) => {
      const p = indexedDB.open('mesa-campanha-v1'); p.onerror = () => ruim(p.error);
      p.onsuccess = () => {
        const tx = p.result.transaction(['campanhas', 'entidades'], 'readonly'), c = tx.objectStore('campanhas').getAll(), e = tx.objectStore('entidades').getAll();
        tx.oncomplete = () => ok({ campanhas: (c.result as { nome: string }[]).map(x => x.nome), entidades: e.result as { nome: string; criadaPor: string }[] });
      };
    }));
    assert.deepEqual(vistas.campanhas, ['A Ilha']); assert.deepEqual(vistas.entidades.map(x => [x.nome, x.criadaPor]), [['Mapa sem nome', 'atlas']]);
    // Os bancos internos têm escopo de caminho: o do Atlas não é visível como se fosse da Ficha.
    const nomes = await outra.evaluate(async () => (await indexedDB.databases()).map(d => d.name).sort());
    assert.ok(nomes.includes('atlas-v1:/Atlas/') && nomes.includes('mesa-campanha-v1'));
    assert.deepEqual(atlas.erros, []);
  } finally { await ctx.close(); await vite.close(); await new Promise<void>(ok => { proxy.close(() => ok()); proxy.closeAllConnections(); }); await new Promise<void>(ok => { ficha.close(() => ok()); ficha.closeAllConnections(); }); }
});
