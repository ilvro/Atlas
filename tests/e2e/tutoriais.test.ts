import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';
import type { Acao, Passo } from '../../src/tutorial/tutor.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

export type TutorDoTeste = { info(): { id: string; indice: number; total: number } | null; passo(): { diga: string } | null; fim: { value: { concluida: boolean } | null }; progresso(): Record<string, { done?: boolean; step?: number }>; relatorio(): { passos: Record<string, unknown> } };
const tutor = <T,>(p: Page, fn: (t: TutorDoTeste) => T): Promise<T> => p.evaluate(`(() => { const t = window.__atlas.tutor; return (${fn.toString()})(t); })()`) as Promise<T>;

/** Executa uma ação de um passo pela interface de verdade (cliques, teclas, arrastos): é o que uma pessoa faria. */
export async function fazer(page: Page, a: Acao): Promise<void> {
  switch (a[0]) {
    case 'clicar': {
      const alvo = page.locator(a[1]).first();
      // Um título de seção do dock que já está aberta não se clica de novo (fecharia).
      if (a[1].includes('dock-titulo-') && (await alvo.getAttribute('aria-expanded')) === 'true') break;
      await alvo.click({ timeout: 8000 }); break;
    }
    case 'preencher': { const c = page.locator(a[1]).first(); await c.fill(a[2]); await c.press('Enter'); break; }
    case 'escolher': await page.locator(a[1]).first().selectOption(a[2]); break;
    case 'cor': await page.locator(a[1]).first().evaluate((el, hex) => { const i = el as HTMLInputElement; i.value = hex as string; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }, a[2]); break;
    case 'tecla': await page.keyboard.press(a[1]); break;
    case 'mapa': { const [x, y] = await clientDe(page, a[1]); await page.mouse.click(x, y); break; }
    case 'retangulo': case 'arrastar': {
      const [ax, ay] = await clientDe(page, a[1]), [bx, by] = await clientDe(page, a[2]);
      if (a[0] === 'retangulo') await page.keyboard.down('Shift');
      await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 8 }); await page.mouse.up();
      if (a[0] === 'retangulo') await page.keyboard.up('Shift');
      break;
    }
  }
  await page.waitForTimeout(220);
}
export const acoesDo = (p: Passo): Acao[] => (p.acao ? (Array.isArray(p.acao[0]) ? [...p.acao as Acao[]] : [p.acao as Acao]) : []);

test('motor: a lição de teste de dois passos só completa com cliques reais, o passo não avança sozinho, e o progresso e o relatório ficam guardados', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await page.click('[data-testid="aprender"]');
  assert.equal(await page.locator('[data-testid="licao-teste-do-motor"]').count(), 0, 'a lição de teste não aparece na lista');
  // A lição de teste é oculta: inicia-se pelo módulo (a lista só mostra as de verdade).
  await page.evaluate(async () => { const caminho = '/src/app/tutoriais.ts', m = await import(/* @vite-ignore */ caminho); await m.iniciarLicao('teste-do-motor'); });
  await page.locator('[data-testid="tutor"]').waitFor({ timeout: 8000 });
  assert.match((await page.locator('[data-testid="tutor-diga"]').textContent()) ?? '', /ferramenta Cômodo/);
  assert.equal(await tutor(page, t => t.info()!.indice), 0);
  // O anel aponta para a ferramenta; esperar não faz o passo.
  await page.locator('[data-testid="tutor-anel"]').waitFor({ state: 'visible', timeout: 4000 }); await page.waitForTimeout(800);
  assert.equal(await tutor(page, t => t.info()!.indice), 0, 'o tutor não faz o passo pela pessoa');
  await page.click('[data-testid="ferramenta-comodo"]');
  await page.waitForFunction(() => (window as unknown as { __atlas: { tutor: { info(): { indice: number } | null } } }).__atlas.tutor.info()?.indice === 1, null, { timeout: 4000 });
  // O passo 2 marca os dois pontos no mapa.
  await page.locator('[data-testid="tutor-ponto"]:not([hidden]) i').first().waitFor({ state: 'visible', timeout: 4000 });
  assert.equal(await page.locator('[data-testid="tutor-ponto"]:not([hidden])').count(), 2);
  await fazer(page, ['retangulo', [3.75, 3.75], [8.25, 8.25]]);
  await page.locator('[data-testid="tutor-fim"]').waitFor({ timeout: 6000 });
  assert.match((await page.locator('[data-testid="tutor-fim"]').textContent()) ?? '', /Concluído.*Shift/s);
  assert.equal(Object.keys((await documento(page)).rooms).length, 1);
  assert.deepEqual(await tutor(page, t => t.progresso()['teste-do-motor']), { done: true });
  const rel = await tutor(page, t => t.relatorio().passos['teste-do-motor']) as { starts: number; completes: number };
  assert.equal(rel.starts, 1); assert.equal(rel.completes, 1);
  // O mapa de treino é do tutor: pode ser apagado, e volta para a galeria.
  await page.click('[data-testid="tutor-apagar-treino"]'); await page.waitForTimeout(800);
  assert.equal(await page.locator('[data-testid="galeria-vazia"]').count(), 1, 'sem o mapa de treino a galeria volta a estar vazia');
  assert.deepEqual(erros, []); await ctx.close();
});

test('motor: sair guarda o passo e a lista oferece continuar de onde parou; a ajuda aparece depois de um tempo parado', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await page.evaluate(async () => { const caminho = '/src/app/tutoriais.ts', m = await import(/* @vite-ignore */ caminho); await m.iniciarLicao('teste-do-motor'); });
  await page.locator('[data-testid="tutor"]').waitFor({ timeout: 8000 });
  await page.click('[data-testid="ferramenta-comodo"]'); await page.waitForFunction(() => (window as unknown as { __atlas: { tutor: { info(): { indice: number } | null } } }).__atlas.tutor.info()?.indice === 1, null, { timeout: 4000 });
  assert.equal(await page.locator('[data-testid="tutor-valores-botao"]').count(), 0, 'no começo não há ajuda');
  await page.click('[data-testid="tutor-sair"]'); await page.locator('[data-testid="tutor-fim"]').waitFor();
  assert.deepEqual(await tutor(page, t => t.progresso()['teste-do-motor']), { step: 1 });
  assert.match((await page.locator('[data-testid="tutor-fim"]').textContent()) ?? '', /Você saiu do tutorial/);
  await page.click('[data-testid="tutor-fechar"]');
  assert.deepEqual(erros, []); await ctx.close();
});
void mkdirSync; void writeFileSync;

// ---------- 9.6b: as cinco lições, percorridas pela interface, com o resultado comparado ao gabarito ----------
import { LICOES } from '../../src/tutorial/licoes.ts';

/** Cada passo, com as ações que o definem, feito com cliques de verdade. Um clique que some no meio (a pílula do assistente já aceita) não é erro. */
async function executarAcoes(page: Page, passo: Passo): Promise<void> {
  for (const a of acoesDo(passo)) {
    try { await fazer(page, a); } catch (erro) { if (!(a[0] === 'clicar' && a[1].includes('pilula'))) { await page.screenshot({ path: 'test-results/licao-erro.png' }).catch(() => undefined); throw erro; } }
  }
}
async function fotoDoMapa(page: Page): Promise<Buffer> {
  await page.mouse.move(2, 2); await page.waitForTimeout(1600);
  return page.locator('[data-testid="area-do-mapa"]').screenshot();
}
const diferenca = (page: Page, a: Buffer, b: Buffer) => page.evaluate(async ([x, y]) => {
  const ler = async (b64: string) => { const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob()), c = new OffscreenCanvas(bmp.width, bmp.height), g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(bmp, 0, 0); return g.getImageData(0, 0, bmp.width, bmp.height); };
  const A = await ler(x!), B = await ler(y!); if (A.width !== B.width || A.height !== B.height) return 255;
  let soma = 0; for (let i = 0; i < A.data.length; i += 4) soma += (Math.abs(A.data[i]! - B.data[i]!) + Math.abs(A.data[i + 1]! - B.data[i + 1]!) + Math.abs(A.data[i + 2]! - B.data[i + 2]!)) / 3;
  return soma / (A.data.length / 4);
}, [a.toString('base64'), b.toString('base64')] as const);

for (const id of ['primeira-casa', 'assistente', 'terreno-e-espalhar', 'climas', 'sessao']) {
  test(`lição “${id}”: percorrida pela interface, cada passo avança só com o resultado, termina concluída e o mapa fica como o gabarito`, async () => {
    const licao = LICOES.find(l => l.id === id)!;
    const ctx = await novoContexto(amb, { viewport: { width: 1600, height: 960 } }, id === 'assistente'), { page, erros } = await abrir(ctx, amb.url);
    // 1. O gabarito: o resultado final montado à mão (os mesmos gestos, sem o tutor), num mapa novo.
    await criarMapaPelaInterface(page); await page.waitForTimeout(500);
    if (licao.mapa) await page.evaluate(m => (window as unknown as { __atlas: { sessao(): { store: { executar(c: unknown): void } } } }).__atlas.sessao().store.executar({ tipo: 'limites.atualizar', largura: m.largura, altura: m.altura }), licao.mapa);
    await page.waitForTimeout(400); await page.evaluate(() => (window as unknown as { __atlas: { viewport(): { enquadrar(): void } } }).__atlas.viewport().enquadrar());
    await page.click('[data-testid="aba-mapa"]');
    for (const passo of licao.passos) { if (passo.feito[0] === 'ler') continue; await executarAcoes(page, passo); }
    const alvo = await fotoDoMapa(page);
    mkdirSync('test-results', { recursive: true }); writeFileSync(`test-results/licao-${id}-alvo.png`, alvo);
    if (process.env.ATUALIZAR_ALVOS) { mkdirSync('public/tutoriais', { recursive: true }); writeFileSync(`public/tutoriais/${id}.jpg`, await page.locator('[data-testid="area-do-mapa"]').screenshot({ type: 'jpeg', quality: 72 })); }
    // 2. A lição de verdade: o tutor aponta; cada passo só avança quando o resultado existe.
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForFunction(() => document.querySelector('[data-testid="novo-mapa"]') !== null, null, { timeout: 8000 });
    await page.evaluate(async id => { const caminho = '/src/app/tutoriais.ts', m = await import(/* @vite-ignore */ caminho); await m.iniciarLicao(id); }, id);
    await page.locator('[data-testid="tutor"]').waitFor({ timeout: 10_000 });
    // Um passo cujo resultado já existe ao chegar (a luz recém-posta já vem selecionada) passa na hora: vale "por qualquer caminho".
    let i = 0;
    while (i < licao.passos.length) {
      await page.waitForFunction(n => ((window as unknown as { __atlas: { tutor: { info(): { indice: number } | null } } }).__atlas.tutor.info()?.indice ?? 99) >= n, i, { timeout: 8000 }).catch(async e => { throw new Error(`esperando o passo ${i + 1}: ${JSON.stringify(await tutor(page, t => t.info()))} ${String(e).slice(0, 80)} erros=${JSON.stringify(erros)}`); });
      i = (await tutor(page, t => t.info()?.indice)) ?? licao.passos.length;
      if (i >= licao.passos.length) break;
      const passo = licao.passos[i]!;
      assert.match((await page.locator('[data-testid="tutor-diga"]').textContent()) ?? '', /\S/);
      if (passo.feito[0] === 'ler') { await page.click('[data-testid="tutor-continuar"]'); i++; continue; }
      await page.waitForTimeout(150);
      const ainda = await tutor(page, t => t.info()?.indice);
      if (ainda !== i) { i = ainda ?? licao.passos.length; continue; }
      await executarAcoes(page, passo);
      await page.waitForFunction(n => { const info = (window as unknown as { __atlas: { tutor: { info(): { indice: number } | null } } }).__atlas.tutor.info(); return !info || info.indice > n; }, i, { timeout: 8000 }).catch(async () => { await page.screenshot({ path: `test-results/licao-${id}-falhou-${i + 1}.png` }); const d = await documento(page); throw new Error(`o passo ${i + 1} (“${passo.diga}”) não terminou depois das ações; peças: ${JSON.stringify(Object.values(d.tokens).map(t => [t.name, t.player, t.position]))}`); });
      i++;
    }
    await page.locator('[data-testid="tutor-fim"]').waitFor({ timeout: 8000 });
    assert.deepEqual(await page.evaluate(id => (window as unknown as { __atlas: { tutor: TutorDoTeste } }).__atlas.tutor.progresso()[id], id), { done: true });
    assert.match((await page.locator('[data-testid="tutor-fim"]').textContent()) ?? '', /Concluído/);
    await page.locator('[data-testid="tutor-fim"]').evaluate(el => { (el as HTMLElement).style.display = 'none'; });
    const feito = await fotoDoMapa(page); writeFileSync(`test-results/licao-${id}-final.png`, feito);
    const d = await diferenca(page, alvo, feito); console.log(`# lição ${id}: diferença média ${d.toFixed(2)} (de 255)`);
    assert.ok(d < 22, `a lição “${id}” terminou diferente do gabarito: ${d.toFixed(1)}`);
    assert.deepEqual(erros, []); await ctx.close();
  });
}
