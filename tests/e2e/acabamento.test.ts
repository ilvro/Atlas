import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const sessao = (p: Page, fn: string, arg?: unknown) =>
  p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);

type JanelaAtlas = { __atlas: { viewport(): { enquadrar(): void; pintando: number } | null } };

const esperarPintura = async (p: Page) => {
  await p.waitForTimeout(350);
  await p.waitForFunction(() => ((window as unknown as JanelaAtlas).__atlas.viewport()?.pintando ?? 1) === 0, null, { timeout: 15_000 });
  await p.waitForTimeout(150);
};

async function brilho(p: Page, a: [number, number], b: [number, number]): Promise<number> {
  const [x0, y0] = await clientDe(p, a), [x1, y1] = await clientDe(p, b);
  const png = await p.screenshot({
    clip: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.max(2, Math.abs(x1 - x0)), height: Math.max(2, Math.abs(y1 - y0)) },
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

test('I1: casa na neve ganha chão pisado em volta, soleira na porta e desliga com settle: false', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "limites.atualizar", largura: 24, altura: 21 });
    s.store.executar({ tipo: "terreno.base", material: "neve" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 0.95 }, sun: null } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    // Casa coberta de 6..12 m x 6..12 m (células 4..8 em grid 1,5 m)
    const cels = [];
    for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) cels.push([x, y]);
    s.store.executar({
      tipo: "comodo.criar",
      id: "casa",
      nome: "Casa",
      funcao: "sala",
      celulas: cels,
      piso: { material: "tabuas.carvalho", seed: 1 },
      papel: null,
      telhado: "casa-de-telha",
      levelId: null,
    });
    const pareSul = Object.values(s.doc.value.walls).find(w =>
      Math.abs(w.path[0][1] - 12) < 0.05 && Math.abs(w.path[1][1] - 12) < 0.05
    );
    if (!pareSul) throw new Error("parede sul não encontrada");
    s.store.executar({
      tipo: "abertura.adicionar",
      abertura: { id: "porta_frente", kind: "door", wallId: pareSul.id, at: 0.5, width: 1.2, state: "closed", material: "madeira.carvalho", swing: "a", som: null },
    });
  }`);

  await page.evaluate(() => (window as unknown as JanelaAtlas).__atlas.viewport()!.enquadrar());
  await esperarPintura(page);

  // A 0,55 m fora da parede leste (dentro do aro de 0,75 m e além do blur da sombra de contato) está a neve pisada; a 3 m está intacta
  const pertoCom = await brilho(page, [12.52, 8], [12.68, 10]);
  const longeCom = await brilho(page, [15.0, 8], [16.0, 10]);
  const soleiraCom = await brilho(page, [8.6, 12.12], [9.4, 12.48]);
  assert.ok(pertoCom < longeCom - 5, `chão perto (${pertoCom.toFixed(1)}) deve ficar mais escuro que a 3 m (${longeCom.toFixed(1)})`);
  assert.ok(soleiraCom < longeCom - 15, `soleira na porta (${soleiraCom.toFixed(1)}) deve destacar sobre a neve (${longeCom.toFixed(1)})`);

  // Desliga assentamento pela UI do inspetor ("Assentar edifícios")
  await page.click('[data-testid="aba-mapa"]');
  await page.locator('[data-testid="estilo-assentar"]').uncheck();
  await esperarPintura(page);

  const pertoSem = await brilho(page, [12.52, 8], [12.68, 10]);
  const longeSem = await brilho(page, [15.0, 8], [16.0, 10]);
  const soleiraSem = await brilho(page, [8.6, 12.12], [9.4, 12.48]);
  assert.ok(Math.abs(pertoSem - longeSem) < 8, `com settle: false, chão perto (${pertoSem.toFixed(1)}) igual ao longe (${longeSem.toFixed(1)})`);
  assert.ok(soleiraSem > soleiraCom + 12, `com settle: false, soleira some (${soleiraSem.toFixed(1)} vs ${soleiraCom.toFixed(1)})`);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('I2: parede externa ganha sombra de contato com sol desligado, mas sem sombra sob porta aberta', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "limites.atualizar", largura: 24, altura: 21 });
    s.store.executar({ tipo: "terreno.base", material: "areia" });
    s.store.executar({ tipo: "estilo.atualizar", patch: { settle: false } });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 0.95 }, sun: null } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    const cels = [];
    for (let y = 4; y < 8; y++) for (let x = 4; x < 8; x++) cels.push([x, y]);
    s.store.executar({
      tipo: "comodo.criar",
      id: "casa",
      nome: "Casa",
      funcao: "sala",
      celulas: cels,
      piso: { material: "tabuas.carvalho", seed: 1 },
      papel: null,
      telhado: null,
      levelId: null,
    });
    const pareSul = Object.values(s.doc.value.walls).find(w =>
      Math.abs(w.path[0][1] - 12) < 0.05 && Math.abs(w.path[1][1] - 12) < 0.05
    );
    s.store.executar({
      tipo: "abertura.adicionar",
      abertura: { id: "porta_aberta", kind: "door", wallId: pareSul.id, at: 0.5, width: 1.5, state: "open", material: "madeira.carvalho", swing: "b", som: null },
    });
  }`);

  await page.evaluate(() => (window as unknown as JanelaAtlas).__atlas.viewport()!.enquadrar());
  await esperarPintura(page);

  // Parede leste fica em x = 12 m; deslocamento 0,2 m cai em [12,12 .. 12,32]. A 2 m fica em [14,0 .. 15,0].
  const logoFora = await brilho(page, [12.14, 7.5], [12.30, 10.5]);
  const a2m = await brilho(page, [14.0, 7.5], [15.0, 10.5]);
  const sobPortaAberta = await brilho(page, [8.6, 12.14], [9.4, 12.30]);
  assert.ok(logoFora < a2m - 4, `pixel logo fora da parede (${logoFora.toFixed(1)}) deve ficar mais escuro que a 2 m (${a2m.toFixed(1)})`);
  assert.ok(sobPortaAberta > logoFora + 3, `sob a porta aberta (${sobPortaAberta.toFixed(1)}) não há sombra de contato (${logoFora.toFixed(1)})`);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('I3: maciço grande no navegador pinta cumeada e serra sem erros', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);

  await sessao(page, `(s) => {
    s.store.executar({ tipo: "limites.atualizar", largura: 48, altura: 36 });
    s.store.executar({ tipo: "terreno.base", material: "neve" });
    s.store.executar({ tipo: "clima.aplicar", patch: { preset: "tarde", time: "12:00", ambient: { color: "#ffffff", intensity: 0.95 }, sun: null } });
    s.store.executar({ tipo: "acabamento.atualizar", patch: { preset: "nenhum", texture: 0, vignette: 0, saturation: 1, grain: 0, tint: "#ffffff" } });
    const res = s.doc.value.terrain.resolution;
    const x0 = Math.round(6 / res), x1 = Math.round(42 / res);
    const y0 = Math.round(4 / res), y1 = Math.round(32 / res);
    const cels = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) cels.push([x, y]);
    s.store.executar({ tipo: "terreno.pintar", material: "rocha.nevada", celulas: cels, suavizar: false });
  }`);

  await page.evaluate(() => (window as unknown as JanelaAtlas).__atlas.viewport()!.enquadrar());
  await esperarPintura(page);

  const encosta = await brilho(page, [6.4, 16], [7.2, 20]);
  const cumeada = await brilho(page, [22, 16], [26, 20]);
  assert.ok(cumeada > encosta + 8, `cumeada (${cumeada.toFixed(1)}) do maciço grande deve ler mais alta/clara que a encosta (${encosta.toFixed(1)})`);
  assert.deepEqual(erros, []);
  await ctx.close();
});
