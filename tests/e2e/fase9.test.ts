import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { BrowserContext, Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);
async function ferramenta(p: Page, id: string) { await p.click(`[data-testid="ferramenta-${id}"]`); await p.waitForTimeout(350); }
async function clicar(p: Page, mundo: [number, number]) { const [x, y] = await clientDe(p, mundo); await p.mouse.click(x, y); await p.waitForTimeout(250); }

/** Uma segunda aba que faz o papel de outro aplicativo da mesa: posta fatos no barramento `mesa:eventos` e anota o que ouve. */
async function aplicativoFalso(ctx: BrowserContext, app: string): Promise<{ emitir(tipo: string, dados: unknown): Promise<void>; ouvidos(): Promise<{ tipo: string; dados: unknown; app: string }[]>; atender(tipo: string, resposta: unknown): Promise<void> }> {
  const pagina = await ctx.newPage(); await pagina.goto(amb.url.replace(/\/$/, '') + '/#/falso');
  await pagina.evaluate(app => {
    const w = window as unknown as { __falso: { canal: BroadcastChannel; ouvidos: unknown[]; atender: Record<string, unknown> } };
    const canal = new BroadcastChannel('mesa:eventos'); w.__falso = { canal, ouvidos: [], atender: {} };
    canal.onmessage = e => { const ev = e.data as { app: string; tipo: string; id: string; dados: unknown }; w.__falso.ouvidos.push(ev); if (w.__falso.atender[ev.tipo] !== undefined) canal.postMessage({ contrato: 1, app, tipo: 'mesa.resposta', id: crypto.randomUUID(), em: Date.now(), campanhaId: null, dados: w.__falso.atender[ev.tipo], respondeA: ev.id }); };
  }, app);
  return {
    emitir: (tipo, dados) => pagina.evaluate(([app, tipo, dados]) => { (window as unknown as { __falso: { canal: BroadcastChannel } }).__falso.canal.postMessage({ contrato: 1, app, tipo, id: crypto.randomUUID(), em: Date.now(), campanhaId: null, dados }); }, [app, tipo, dados] as const),
    ouvidos: () => pagina.evaluate(() => (window as unknown as { __falso: { ouvidos: { tipo: string; dados: unknown; app: string }[] } }).__falso.ouvidos),
    atender: (tipo, resposta) => pagina.evaluate(([tipo, resposta]) => { (window as unknown as { __falso: { atender: Record<string, unknown> } }).__falso.atender[tipo!] = resposta; }, [tipo, resposta] as const),
  };
}

const REF_FICHA = { app: 'ficha', tipo: 'ficha', id: 'sheet-muirenn' };
const diagPecas = (p: Page) => p.evaluate(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { id: string; pips: { pv: number; pd: number } | null; estadoVisto: string }[] } } }).__atlas.viewport().diagnosticoDasPecas());

/** Abre o Atlas com uma campanha ativa que tem o personagem “Muirenn” (com o Ref de uma ficha), e um mapa com um cômodo. */
async function cenario(ctx: BrowserContext) {
  const { page, erros } = await abrir(ctx, amb.url);
  await page.evaluate(async ref => {
    const s = (window as unknown as { __atlas: { servicos(): { campanhas: { criarCampanha(d: unknown): Promise<{ id: string }>; criarEntidade(d: unknown): Promise<unknown> } } } }).__atlas.servicos();
    const c = await s.campanhas.criarCampanha({ nome: 'Casa dos Salgueiros', sistema: 'ordem-paranormal', tema: null });
    await s.campanhas.criarEntidade({ campanhaId: c.id, tipo: 'personagem', nome: 'Muirenn', refs: [ref] });
    for (const [id, nome] of [['chuva', 'Chuva forte'], ['taverna', 'Taverna animada'], ['suspense', 'Suspense na biblioteca']]) await s.campanhas.criarEntidade({ campanhaId: c.id, tipo: 'cena', nome, refs: [{ app: 'jukebox', tipo: 'cena-sonora', id }] });
    localStorage.setItem('mesa:campanha-ativa', c.id);
  }, REF_FICHA);
  await page.reload(); await page.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null, null, { timeout: 20_000 });
  await criarMapaPelaInterface(page);
  await ferramenta(page, 'comodo');
  const [ax, ay] = await clientDe(page, [3.75, 3.75]), [bx, by] = await clientDe(page, [14.25, 9.75]);
  await page.keyboard.down('Shift'); await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Shift');
  await ferramenta(page, 'selecionar');
  return { page, erros };
}

test('ficha → peça: o personagem da campanha vira peça de jogador ligada à ficha, e os pips seguem os PV e PD que a Ficha publica', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await cenario(ctx), ficha = await aplicativoFalso(ctx, 'ficha');
  await page.click('[data-testid="aba-mapa"]');
  const botao = page.locator('[data-testid^="personagem-por-"]').first(); await botao.waitFor({ timeout: 8000 });
  await botao.click(); await page.waitForTimeout(400);
  let doc = await documento(page), peca = Object.values(doc.tokens)[0]!;
  assert.equal(peca.name, 'Muirenn'); assert.equal(peca.player, true); assert.deepEqual(peca.refs, [REF_FICHA]);
  assert.equal((await diagPecas(page))[0]!.pips, null, 'sem dados da ficha, sem pips');
  // Pôr de novo só seleciona a peça que já existe.
  await botao.click(); await page.waitForTimeout(300); assert.equal(Object.keys((await documento(page)).tokens).length, 1);

  await ficha.emitir('ficha.recursos', { ficha: REF_FICHA, pv: 12, pvMax: 20, pd: 8, pdMax: 10 });
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { pips: { pv: number } | null }[] } } }).__atlas.viewport().diagnosticoDasPecas()[0]?.pips?.pv === 12, null, { timeout: 5000 });
  assert.equal((await diagPecas(page))[0]!.estadoVisto, 'normal');
  // PV em 25% ou menos: a peça aparece ferida na tela, e o documento continua com o estado normal.
  await ficha.emitir('ficha.recursos', { ficha: REF_FICHA, pv: 4, pvMax: 20, pd: 8, pdMax: 10 });
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { estadoVisto: string }[] } } }).__atlas.viewport().diagnosticoDasPecas()[0]?.estadoVisto === 'hurt', null, { timeout: 5000 });
  assert.equal((await documento(page)).tokens[peca.id]!.figure.state, 'normal', 'o estado do documento não muda');
  await ficha.emitir('ficha.recursos', { ficha: REF_FICHA, pv: 20, pvMax: 20, pd: 10, pdMax: 10 });
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { estadoVisto: string }[] } } }).__atlas.viewport().diagnosticoDasPecas()[0]?.estadoVisto === 'normal', null, { timeout: 5000 });
  assert.equal(JSON.stringify((await documento(page)).tokens).includes('"pv"'), false, 'PV e PD não entram no documento');

  // Cartão da peça na sessão: PV e PD, e "Abrir ficha" pede ficha.abrir pelo barramento.
  await ficha.emitir('ficha.recursos', { ficha: REF_FICHA, pv: 9, pvMax: 20, pd: 7, pdMax: 10 });
  await ficha.atender('ficha.abrir', { ok: true });
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(500);
  await clicar(page, doc.tokens[peca.id]!.position as [number, number]); await page.waitForTimeout(300);
  const cartao = page.locator('[data-testid="cartao-recursos"]'); await cartao.waitFor({ timeout: 5000 });
  assert.match((await cartao.textContent()) ?? '', /PV 9\/20 · PD 7\/10/);
  await page.click('[data-testid="cartao-abrir-ficha"]'); await page.waitForTimeout(600);
  const pedido = (await ficha.ouvidos()).find(e => e.tipo === 'ficha.abrir'); assert.deepEqual((pedido?.dados as { ref: unknown } | undefined)?.ref, REF_FICHA);
  assert.deepEqual(erros, []); await ctx.close();
});

test('rolagem sobre a peça: o resultado da Ficha flutua sobre a peça certa no mapa e no projetor; sem peça vira um aviso', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await cenario(ctx), ficha = await aplicativoFalso(ctx, 'ficha');
  await page.click('[data-testid="aba-mapa"]'); await page.locator('[data-testid^="personagem-por-"]').first().click(); await page.waitForTimeout(400);
  const doc = await documento(page), peca = Object.values(doc.tokens)[0]!;
  await page.click('[data-testid="modo-sessao"]'); await page.locator('[data-testid="dock"]').waitFor();
  await page.click('[data-testid="dock-titulo-projetor"]');
  const proj = await ctx.newPage(), errosProj: string[] = [];
  proj.on('pageerror', e => errosProj.push(e.message));
  await proj.goto(`${amb.url}#/projetor/${doc.id}`);
  await proj.waitForFunction(() => (window as unknown as { __projetor?: { doc(): { tokens: Record<string, unknown> } | null } }).__projetor?.doc()?.tokens != null, null, { timeout: 20_000 });
  await page.getByText('Conectado', { exact: true }).waitFor({ timeout: 5000 });

  await ficha.emitir('ficha.rolagem', { ficha: REF_FICHA, titulo: 'Investigação', total: 17, modificador: 5 });
  const naTela = page.locator('[data-testid="rolagem-flutuante"]').first(); await naTela.waitFor({ timeout: 4000 });
  assert.match((await naTela.textContent()) ?? '', /17.*Investigação/);
  const [px, py] = await clientDe(page, peca.position as [number, number]), caixa = (await naTela.boundingBox())!;
  assert.ok(Math.abs(caixa.x + caixa.width / 2 - px) < 90 && Math.abs(caixa.y - py) < 160, `o número está sobre a peça (${caixa.x}, ${caixa.y}) × (${px}, ${py})`);
  const noProjetor = proj.locator('[data-testid="rolagem-flutuante"]').first(); await noProjetor.waitFor({ timeout: 4000 });
  assert.match((await noProjetor.textContent()) ?? '', /17.*Investigação/);
  // Um 20 puro tem destaque; um 1, outro.
  await ficha.emitir('ficha.rolagem', { ficha: REF_FICHA, titulo: 'Furtividade', total: 25, modificador: 5 });
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="rolagem-flutuante"]')].some(e => (e as HTMLElement).dataset.tom === 'alto'), null, { timeout: 4000 });
  // Rolagem de uma ficha sem peça no mapa: aviso discreto, sem efeito sobre peça nenhuma.
  const antes = await page.locator('[data-testid="rolagem-flutuante"]').count();
  await ficha.emitir('ficha.rolagem', { ficha: { app: 'ficha', tipo: 'ficha', id: 'outra-pessoa' }, titulo: 'Percepção', total: 9 });
  await page.getByText('Rolagem: Percepção 9').waitFor({ timeout: 4000 });
  assert.equal(await page.locator('[data-testid="rolagem-flutuante"]').count(), antes);
  assert.deepEqual(errosProj, []); assert.deepEqual(erros, []); await ctx.close();
});

/** Grava ou remove um documento no banco de troca do Ateliê (`mesa-handouts-v1`), como o Ateliê o faria (contrato v1). */
async function ateliePublica(page: Page, registro: { id: string; name: string; hasUv: boolean } | null, remover?: string): Promise<void> {
  await page.evaluate(async ([registro, remover]) => {
    const db = await new Promise<IDBDatabase>((ok, erro) => {
      const p = indexedDB.open('mesa-handouts-v1', 1);
      p.onupgradeneeded = () => { p.result.createObjectStore('handouts', { keyPath: 'id' }); p.result.createObjectStore('bakes', { keyPath: ['id', 'light'] }); };
      p.onsuccess = () => ok(p.result); p.onerror = () => erro(p.error);
    });
    const c = document.createElement('canvas'); c.width = 60; c.height = 80; const g = c.getContext('2d')!; g.fillStyle = '#d9c9a0'; g.fillRect(0, 0, 60, 80); g.fillStyle = '#3a2a1e'; g.fillRect(8, 10, 44, 4);
    const png = await new Promise<Blob>(r => c.toBlob(b => r(b!), 'image/png'));
    await new Promise<void>((ok, erro) => {
      const tx = db.transaction(['handouts', 'bakes'], 'readwrite');
      if (registro) {
        tx.objectStore('handouts').put({ ...registro, category: 'cartas', tags: [], revision: 2, updatedAt: Date.now(), source: 'http://127.0.0.1:3011/', preview: png });
        tx.objectStore('bakes').put({ id: registro.id, light: 'normal', revision: 2, blob: png, width: 60, height: 80 });
        if (registro.hasUv) tx.objectStore('bakes').put({ id: registro.id, light: 'uv', revision: 2, blob: png, width: 60, height: 80 });
      }
      if (remover) { tx.objectStore('handouts').delete(remover); tx.objectStore('bakes').delete([remover, 'normal']); tx.objectStore('bakes').delete([remover, 'uv']); }
      tx.oncomplete = () => ok(); tx.onerror = () => erro(tx.error);
    });
    db.close();
  }, [registro, remover ?? null] as const);
}

test('pistas do Ateliê: o documento entregue aparece na lista (ao vivo), vira um objeto-pista ligado ao cômodo e, se sumir do banco, o inspetor avisa', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await cenario(ctx), atelie = await aplicativoFalso(ctx, 'atelie');
  await ferramenta(page, 'objeto'); await page.locator('[data-testid="biblioteca"]').waitFor();
  assert.equal(await page.locator('[data-testid="pistas-vazio"]').count(), 1, 'sem o Ateliê, a lista está vazia');
  await ateliePublica(page, { id: 'carta-1', name: 'Carta rasgada', hasUv: true });
  await atelie.emitir('handout-saved', {}).catch(() => undefined);      // o canal do Ateliê é outro; o aviso abaixo é o de verdade
  await page.evaluate(() => { const c = new BroadcastChannel('mesa:handout'); c.postMessage({ app: 'atelie', contract: 1, type: 'handout-saved', id: 'carta-1', revision: 2, source: 'http://127.0.0.1:3011/' }); c.close(); });
  const cartao = page.locator('[data-testid="pista-carta-1"]'); await cartao.waitFor({ timeout: 6000 });
  assert.match((await cartao.textContent()) ?? '', /Carta rasgada.*UV/);
  // O botão põe a pista no centro da vista: enquadra o cômodo para o centro cair dentro dele.
  await page.evaluate(() => (window as unknown as { __atlas: { viewport(): { focarEm(c: object): void } } }).__atlas.viewport().focarEm({ x0: 3, y0: 3, x1: 15, y1: 10.5 })); await page.waitForTimeout(300);
  await page.click('[data-testid="pista-por-carta-1"]'); await page.waitForTimeout(500);
  const doc = await documento(page), obj = Object.values(doc.props).find(o => o.interaction?.kind === 'clue')!;
  assert.ok(obj, 'o objeto-pista foi posto'); assert.equal(obj.source.kind, 'recipe');
  assert.deepEqual(obj.interaction!.clue, { app: 'atelie', tipo: 'documento', id: 'carta-1' });
  assert.ok(obj.roomId, 'o objeto sabe em que cômodo está');
  // A ligação “esta-em” (pista → cômodo) ficou no banco da campanha.
  const ligacoes = await page.evaluate(async () => {
    const s = (window as unknown as { __atlas: { servicos(): { campanhas: { listarCampanhas(): Promise<{ id: string }[]>; listarLigacoes(c: string): Promise<{ tipo: string; de: { app: string; id: string }; para: { app: string; tipo: string } }[]> } } } }).__atlas.servicos();
    const [c] = await s.campanhas.listarCampanhas(); return s.campanhas.listarLigacoes(c!.id);
  });
  assert.ok(ligacoes.some(l => l.tipo === 'esta-em' && l.de.app === 'atelie' && l.de.id === 'carta-1' && l.para.app === 'atlas' && l.para.tipo === 'comodo'), JSON.stringify(ligacoes));
  // O inspetor mostra o documento; apagado do banco, avisa que não foi encontrado e o objeto continua.
  await page.click('[data-testid="aba-selecao"]'); await page.waitForTimeout(300);
  assert.equal(await page.locator('[data-testid="pista-ausente"]').count(), 0);
  await ateliePublica(page, null, 'carta-1');
  await page.evaluate(() => { const c = new BroadcastChannel('mesa:handout'); c.postMessage({ app: 'atelie', contract: 1, type: 'handout-removed', id: 'carta-1', revision: 2, source: '' }); c.close(); });
  await page.locator('[data-testid="pista-ausente"]').waitFor({ timeout: 6000 });
  assert.equal(Object.values((await documento(page)).props).filter(o => o.interaction?.kind === 'clue').length, 1);
  assert.deepEqual(erros, []); await ctx.close();
});

test('inspeção de pista: clicar abre o documento grande, a luz UV revela o assado UV sob a lanterna, e "Mostrar aos jogadores" leva tudo ao projetor (lanterna fluida)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await cenario(ctx);
  await ateliePublica(page, { id: 'carta-uv', name: 'Carta com tinta invisível', hasUv: true });
  await ferramenta(page, 'objeto'); await page.locator('[data-testid="pista-carta-uv"]').waitFor({ timeout: 6000 }).catch(async () => { await page.evaluate(() => { const c = new BroadcastChannel('mesa:handout'); c.postMessage({ app: 'atelie', contract: 1, type: 'handout-saved', id: 'carta-uv', revision: 2, source: '' }); c.close(); }); await page.locator('[data-testid="pista-carta-uv"]').waitFor({ timeout: 6000 }); });
  await page.evaluate(() => (window as unknown as { __atlas: { viewport(): { focarEm(c: object): void } } }).__atlas.viewport().focarEm({ x0: 3, y0: 3, x1: 15, y1: 10.5 })); await page.waitForTimeout(300);
  await page.click('[data-testid="pista-por-carta-uv"]'); await page.waitForTimeout(500);
  const doc = await documento(page), obj = Object.values(doc.props).find(o => o.interaction?.kind === 'clue')!;
  await page.click('[data-testid="modo-sessao"]'); await page.locator('[data-testid="dock"]').waitFor();
  await page.click('[data-testid="dock-titulo-projetor"]');
  const proj = await ctx.newPage(); await proj.goto(`${amb.url}#/projetor/${doc.id}`);
  await proj.waitForFunction(() => (window as unknown as { __projetor?: { doc(): unknown } }).__projetor?.doc() != null, null, { timeout: 20_000 });
  await page.getByText('Conectado', { exact: true }).waitFor({ timeout: 5000 });
  await page.click('[data-testid="dock-titulo-projetor"]');       // recolhe a seção para o dock não cobrir a pista

  // Clicar na pista abre a inspeção; Esc fecha; abrir de novo.
  await clicar(page, obj.position as [number, number]); await page.waitForTimeout(800);
  await page.locator('[data-testid="inspecao"]').waitFor({ timeout: 6000 });
  await page.keyboard.press('Escape'); await page.locator('[data-testid="inspecao"]').waitFor({ state: 'detached', timeout: 3000 });
  await clicar(page, obj.position as [number, number]); await page.locator('[data-testid="inspecao"]').waitFor({ timeout: 6000 });
  const visor = page.locator('[data-testid="inspecao-visor"]'), caixa = (await visor.boundingBox())!;
  assert.equal(await visor.getAttribute('data-uv'), '0', 'sem a luz UV não há lanterna');
  // Zoom com a roda.
  await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2); await page.mouse.wheel(0, -300); await page.waitForTimeout(200);
  assert.ok(Number(await visor.getAttribute('data-zoom')) > 1.3, 'a roda aproxima');
  // Luz UV: a lanterna segue o ponteiro.
  await page.click('[data-testid="inspecao-uv"]');
  await page.mouse.move(caixa.x + caixa.width * 0.4, caixa.y + caixa.height * 0.4); await page.waitForTimeout(150);
  const a = [Number(await visor.getAttribute('data-lx')), Number(await visor.getAttribute('data-ly'))];
  await page.mouse.move(caixa.x + caixa.width * 0.6, caixa.y + caixa.height * 0.55, { steps: 6 }); await page.waitForTimeout(150);
  const b = [Number(await visor.getAttribute('data-lx')), Number(await visor.getAttribute('data-ly'))];
  assert.equal(await visor.getAttribute('data-uv'), '1'); assert.ok(b[0]! > a[0]! && b[1]! > a[1]!, `a lanterna andou com o ponteiro: ${a} → ${b}`);

  // Mostrar aos jogadores: o projetor abre o documento, segue a lanterna e a pista fica revelada.
  await page.click('[data-testid="inspecao-mostrar"]');
  await proj.locator('[data-testid="projetor-inspecao"]').waitFor({ timeout: 6000 });
  await page.mouse.move(caixa.x + caixa.width * 0.3, caixa.y + caixa.height * 0.3, { steps: 8 }); await page.waitForTimeout(700);
  const pv = proj.locator('[data-testid="projetor-visor"]');
  await proj.waitForFunction(() => { const c = document.querySelector('[data-testid="projetor-visor"]') as HTMLElement | null; return c?.dataset.uv === '1'; }, null, { timeout: 4000 });
  const lp = [Number(await pv.getAttribute('data-lx')), Number(await pv.getAttribute('data-ly'))], lm = [Number(await visor.getAttribute('data-lx')), Number(await visor.getAttribute('data-ly'))];
  assert.ok(Math.abs(lp[0]! - lm[0]!) < 0.08 && Math.abs(lp[1]! - lm[1]!) < 0.08, `o projetor segue a lanterna: ${lp} ≈ ${lm}`);
  assert.ok((await documento(page)).session.revealed.includes(obj.id), 'a pista entrou nos revelados');
  await proj.screenshot({ path: 'test-results/fase9-inspecao-projetor.png' });
  // Esc fecha nos dois lados.
  await page.keyboard.press('Escape'); await proj.locator('[data-testid="projetor-inspecao"]').waitFor({ state: 'detached', timeout: 4000 });
  assert.equal(await page.locator('[data-testid="inspecao"]').count(), 0);
  assert.deepEqual(erros, []); await ctx.close();
});

const pedidosDeCena = async (jukebox: Awaited<ReturnType<typeof aplicativoFalso>>) => (await jukebox.ouvidos()).filter(e => e.tipo === 'jukebox.tocar').map(e => (e.dados as { ref: { id: string } }).ref.id);

test('cena sonora: escolher a cena do mapa e de cada clima entre as da campanha; trocar o clima e abrir a sessão pedem a cena certa; “Ouvir” também', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await cenario(ctx), jukebox = await aplicativoFalso(ctx, 'jukebox');
  await page.click('[data-testid="aba-mapa"]');
  // O campo provisório da 4.7a sumiu: o som do clima e o do mapa usam a mesma escolha de cena, com as cenas da campanha.
  const clima = page.locator('[data-testid="som-do-clima"]'), mapa = page.locator('[data-testid="som-do-mapa"]');
  await clima.waitFor({ timeout: 6000 }); await mapa.waitFor();
  await page.waitForFunction(() => (document.querySelector('[data-testid="som-do-mapa"]') as HTMLSelectElement).options.length >= 4, null, { timeout: 6000 });
  assert.equal((await mapa.locator('option').allTextContents())[0], 'Nenhuma'); assert.ok((await mapa.locator('option').allTextContents()).includes('Taverna animada'));
  // Escolher a cena de “Noite” e a do mapa; cada escolha é um passo de histórico.
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "noite" })'); await page.waitForTimeout(500);
  await clima.selectOption({ label: 'Suspense na biblioteca' }); await mapa.selectOption({ label: 'Taverna animada' }); await page.waitForTimeout(300);
  const doc = await documento(page);
  assert.deepEqual(doc.climateAudio.noite, { app: 'jukebox', tipo: 'cena-sonora', id: 'suspense' }); assert.deepEqual(doc.audioCue, { app: 'jukebox', tipo: 'cena-sonora', id: 'taverna' });
  // “Ouvir” pede a cena ao Jukebox na hora.
  await page.click('[data-testid="som-do-mapa-ouvir"]'); await page.waitForTimeout(500);
  assert.deepEqual(await pedidosDeCena(jukebox), ['taverna']);
  // Abrir a sessão pede a cena do mapa; trocar para a Tarde (sem cena) não pede nada; voltar à Noite pede a do clima.
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(700);
  assert.deepEqual(await pedidosDeCena(jukebox), ['taverna', 'taverna']);
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "tarde" })'); await page.waitForTimeout(500);
  assert.equal((await pedidosDeCena(jukebox)).length, 2, 'o clima Tarde não tem cena');
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "noite" })'); await page.waitForTimeout(500);
  assert.deepEqual(await pedidosDeCena(jukebox), ['taverna', 'taverna', 'suspense']);
  // Tirar a cena do mapa: “Nenhuma”.
  await page.click('[data-testid="modo-construir"]'); await page.click('[data-testid="aba-mapa"]'); await mapa.selectOption({ label: 'Nenhuma' }); await page.waitForTimeout(300);
  assert.equal((await documento(page)).audioCue, null);
  assert.deepEqual(erros, []); await ctx.close();
});

test('entrar numa região: a peça de jogador que entra emite atlas.regiao-entrou, a região de áudio pede a sua cena, sair volta ao fundo, e o gatilho mostra o texto', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await cenario(ctx), jukebox = await aplicativoFalso(ctx, 'jukebox');
  const regiao = (id: string, kind: string, poly: number[][], extra: Record<string, unknown>) => ({ id, polygon: poly, kind, gmOnly: false, payload: {}, refs: [], ...extra });
  const chuva = { app: 'jukebox', tipo: 'cena-sonora', id: 'chuva' }, taverna = { app: 'jukebox', tipo: 'cena-sonora', id: 'taverna' };
  await sessao(page, `(s, a) => {
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.ana });
    s.store.executar({ tipo: "item.adicionar", colecao: "tokens", item: a.ogro });
    s.store.executar({ tipo: "item.adicionar", colecao: "regions", item: a.cripta }); s.store.executar({ tipo: "item.adicionar", colecao: "regions", item: a.alcapao });
    s.store.executar({ tipo: "mapa.audio", ref: a.taverna });
  }`, {
    ana: { id: 'ana', name: 'Ana', portrait: null, sprite: null, facing: 'down', position: [5.25, 5.25], size: 1, player: true, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [] },
    ogro: { id: 'ogro', name: 'Ogro', portrait: null, sprite: null, facing: 'down', position: [5.25, 8.25], size: 1, player: false, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [] },
    cripta: regiao('cripta', 'audio', [[9, 4.5], [13.5, 4.5], [13.5, 9], [9, 9]], { refs: [chuva] }),
    alcapao: regiao('alcapao', 'trigger', [[3, 7.5], [7.5, 7.5], [7.5, 9.5], [3, 9.5]], { payload: { texto: 'O chão range sob os pés.' } }),
    taverna,
  });
  await page.click('[data-testid="modo-sessao"]'); await page.waitForTimeout(600);
  const antes = (await pedidosDeCena(jukebox)).length;      // abrir a sessão já pediu a cena do mapa
  const entrou = async () => (await jukebox.ouvidos()).filter(e => e.tipo === 'atlas.regiao-entrou').map(e => (e.dados as { regiao: { id: string } }).regiao.id);
  const mover = (id: string, para: number[]) => sessao(page, '(s, a) => s.store.executar({ tipo: "peca.mover", id: a.id, para: a.para, livre: true })', { id, para });
  // O ogro não é de jogador: entrar na cripta não diz nada.
  await mover('ogro', [10.5, 6.75]); await page.waitForTimeout(500);
  assert.deepEqual(await entrou(), []); assert.equal((await pedidosDeCena(jukebox)).length, antes);
  // A Ana entra na cripta: o fato e o pedido da cena de lá.
  await mover('ana', [10.5, 5.25]); await page.waitForTimeout(600);
  const fatos = (await jukebox.ouvidos()).filter(e => e.tipo === 'atlas.regiao-entrou'); assert.equal(fatos.length, 1);
  assert.equal(((fatos[0]!.dados as { regiao: { tipo: string; id: string } }).regiao).id.endsWith('/cripta'), true);
  assert.deepEqual((await pedidosDeCena(jukebox)).slice(antes), ['chuva']);
  // Andar dentro da região não repete; sair volta à cena do mapa.
  await mover('ana', [12, 6.75]); await page.waitForTimeout(500);
  assert.equal((await jukebox.ouvidos()).filter(e => e.tipo === 'atlas.regiao-entrou').length, 1); assert.deepEqual((await pedidosDeCena(jukebox)).slice(antes), ['chuva']);
  await mover('ana', [5.25, 5.25]); await page.waitForTimeout(600);
  assert.deepEqual((await pedidosDeCena(jukebox)).slice(antes), ['chuva', 'taverna']);
  // O gatilho mostra o texto ao mestre.
  await mover('ana', [5.25, 8.25]); await page.waitForTimeout(500);
  await page.getByText('O chão range sob os pés.').waitFor({ timeout: 4000 });
  assert.equal((await jukebox.ouvidos()).filter(e => e.tipo === 'atlas.regiao-entrou').length, 2);
  assert.deepEqual(erros, []); await ctx.close();
});

test('fase 9 (parte do Atlas, com Ficha, Ateliê e Jukebox falsos no barramento): a ficha vira peça, a rolagem aparece sobre ela e no projetor, a pista é inspecionada com UV no projetor, o clima e a região trocam a música', async () => {
  const ctx = await novoContexto(amb, { viewport: { width: 1600, height: 960 } }), { page, erros } = await cenario(ctx);
  const ficha = await aplicativoFalso(ctx, 'ficha'), jukebox = await aplicativoFalso(ctx, 'jukebox');
  await ateliePublica(page, { id: 'bilhete', name: 'Bilhete da biblioteca', hasUv: true });
  const chuva = { app: 'jukebox', tipo: 'cena-sonora', id: 'chuva' }, suspense = { app: 'jukebox', tipo: 'cena-sonora', id: 'suspense' };
  // A casa: o personagem da campanha vira peça; a pista entra no cômodo; as cenas sonoras ficam escolhidas.
  await page.click('[data-testid="aba-mapa"]'); await page.locator('[data-testid^="personagem-por-"]').first().click(); await page.waitForTimeout(300);
  await page.evaluate(() => (window as unknown as { __atlas: { viewport(): { focarEm(c: object): void } } }).__atlas.viewport().focarEm({ x0: 3, y0: 3, x1: 15, y1: 10.5 })); await page.waitForTimeout(250);
  await ferramenta(page, 'objeto'); await page.locator('[data-testid="pista-bilhete"]').waitFor({ timeout: 6000 }); await page.click('[data-testid="pista-por-bilhete"]'); await page.waitForTimeout(400);
  const doc0 = await documento(page), peca = Object.values(doc0.tokens)[0]!, pista = Object.values(doc0.props).find(o => o.interaction?.kind === 'clue')!;
  await sessao(page, `(s, a) => {
    s.store.executar({ tipo: "clima.audio", id: "tempestade", ref: a.chuva });
    s.store.executar({ tipo: "item.adicionar", colecao: "regions", item: { id: "biblioteca", polygon: [[11, 3.5], [14.5, 3.5], [14.5, 9], [11, 9]], kind: "audio", gmOnly: false, payload: {}, refs: [a.suspense] } });
    s.store.executar({ tipo: "item.atualizar", colecao: "tokens", id: a.peca, patch: { position: [4.5, 6.75] } });
  }`, { chuva, suspense, peca: peca.id });
  await page.click('[data-testid="modo-sessao"]'); await page.locator('[data-testid="dock"]').waitFor(); await page.click('[data-testid="dock-titulo-projetor"]');
  const proj = await ctx.newPage(); await proj.goto(`${amb.url}#/projetor/${doc0.id}`);
  await proj.waitForFunction(() => (window as unknown as { __projetor?: { doc(): { tokens: object } | null } }).__projetor?.doc()?.tokens != null, null, { timeout: 20_000 });
  await page.getByText('Conectado', { exact: true }).waitFor({ timeout: 5000 });
  await page.click('[data-testid="dock-titulo-projetor"]'); await page.click('[data-testid="dock-titulo-clima"]').catch(() => undefined);
  // 1. A ficha: PV e PD nos pips e a rolagem sobre a peça, no mapa e no projetor.
  await ficha.emitir('ficha.recursos', { ficha: REF_FICHA, pv: 14, pvMax: 20, pd: 9, pdMax: 10 });
  await page.waitForFunction(() => (window as unknown as { __atlas: { viewport(): { diagnosticoDasPecas(): { pips: { pv: number } | null }[] } } }).__atlas.viewport().diagnosticoDasPecas()[0]?.pips?.pv === 14, null, { timeout: 5000 });
  await ficha.emitir('ficha.rolagem', { ficha: REF_FICHA, titulo: 'Investigação', total: 19, modificador: 4 });
  await page.locator('[data-testid="rolagem-flutuante"]').first().waitFor({ timeout: 4000 }); await proj.locator('[data-testid="rolagem-flutuante"]').first().waitFor({ timeout: 4000 });
  // 2. A pista inspecionada com a luz UV, no projetor.
  await clicar(page, pista.position as [number, number]); await page.locator('[data-testid="inspecao"]').waitFor({ timeout: 6000 });
  await page.click('[data-testid="inspecao-uv"]'); await page.click('[data-testid="inspecao-mostrar"]');
  const caixa = (await page.locator('[data-testid="inspecao-visor"]').boundingBox())!; await page.mouse.move(caixa.x + caixa.width * 0.45, caixa.y + caixa.height * 0.5, { steps: 6 });
  await proj.locator('[data-testid="projetor-inspecao"]').waitFor({ timeout: 5000 });
  await proj.waitForFunction(() => (document.querySelector('[data-testid="projetor-visor"]') as HTMLElement | null)?.dataset.uv === '1', null, { timeout: 5000 });
  await proj.screenshot({ path: 'test-results/fase9-validacao-projetor.png' });
  await page.keyboard.press('Escape'); await proj.locator('[data-testid="projetor-inspecao"]').waitFor({ state: 'detached', timeout: 4000 });
  // 3. O clima troca a música; entrar numa região também; sair volta à do clima.
  await sessao(page, '(s) => s.store.executar({ tipo: "clima.predefinir", id: "tempestade" })'); await page.waitForTimeout(700);
  await sessao(page, '(s, a) => s.store.executar({ tipo: "peca.mover", id: a, para: [12.75, 6.75], livre: true })', peca.id); await page.waitForTimeout(700);
  await sessao(page, '(s, a) => s.store.executar({ tipo: "peca.mover", id: a, para: [4.5, 6.75], livre: true })', peca.id); await page.waitForTimeout(700);
  assert.deepEqual(await pedidosDeCena(jukebox), ['chuva', 'suspense', 'chuva'], 'clima → região de áudio → de volta ao clima');
  const fatos = (await jukebox.ouvidos()).map(e => e.tipo);
  for (const t of ['atlas.regiao-entrou', 'atlas.revelado']) assert.ok(fatos.includes(t), `o Atlas emitiu ${t}`);
  assert.ok((await documento(page)).session.revealed.includes(pista.id), 'a pista mostrada ficou revelada');
  await page.screenshot({ path: 'test-results/fase9-validacao-mestre.png' });
  assert.deepEqual(erros, []); await ctx.close();
});
