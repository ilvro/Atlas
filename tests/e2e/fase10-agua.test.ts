import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const RES_PIXEL = 16 / 1.5;

test('10.1a: lago sobre areia mostra o fundo arenoso na margem e azul escuro no meio, nos dois estilos', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async (resPixel) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const L = 20, A = 14, CEL = 0.5, nx = L / CEL, ny = A / CEL;
    type Faixa = [number, number, number];
    const faixas = (dentro: (x: number, y: number) => boolean): Faixa[] => {
      const f: Faixa[] = [];
      for (let y = 0; y < ny; y++) { let ini = -1; for (let x = 0; x <= nx; x++) { const d = x < nx && dentro((x + 0.5) * CEL, (y + 0.5) * CEL); if (d && ini < 0) ini = x; if (!d && ini >= 0) { f.push([y, ini, x - ini]); ini = -1; } } }
      return f;
    };
    const lago = faixas((x, y) => ((x - 10) / 7.5) ** 2 + ((y - 7) / 4.8) ** 2 + Math.sin(x * 1.3) * 0.05 < 1);
    const entrada = { largura: L, altura: A, resolucao: CEL, base: 'areia', camadas: [{ material: 'agua.lago', celulas: lago }] };
    const out: Record<string, unknown> = {}, tela = document.createElement('canvas'); tela.width = 2 * 600 + 24; tela.height = Math.round(600 * A / L) + 16;
    const g = tela.getContext('2d', { willReadFrequently: true })!; g.fillStyle = '#000'; g.fillRect(0, 0, tela.width, tela.height);
    for (let l = 0; l < 2; l++) {
      const estilo = l ? 'pixel' : 'illustrated', res = l ? resPixel : 48, bake = await executarBake({ tipo: 'terreno', entrada, res, estilo });
      g.imageSmoothingEnabled = !l; g.drawImage(bake.bitmap, 8 + l * 608, 8, 600, Math.round(600 * A / L));
      const um = document.createElement('canvas'); um.width = bake.bitmap.width; um.height = bake.bitmap.height; const c = um.getContext('2d', { willReadFrequently: true })!; c.drawImage(bake.bitmap, 0, 0);
      const px = (mx: number, my: number) => Array.from(c.getImageData(Math.round(mx * res), Math.round(my * res), 1, 1).data);
      out[estilo] = { margem: px(2.5 + 0.4, 7), meio: px(10, 7), fora: px(1, 1), cores: (() => { const d = c.getImageData(0, 0, um.width, um.height).data, s = new Set<string>(); for (let k = 0; k < d.length; k += 4) s.add(`${d[k]},${d[k + 1]},${d[k + 2]}`); return s.size; })() };
      if (bake.agua) { const ua = document.createElement('canvas'); ua.width = bake.agua.bitmap.width; ua.height = bake.agua.bitmap.height; const ca = ua.getContext('2d')!; ca.drawImage(bake.agua.bitmap, 0, 0); const a = (mx: number, my: number) => Array.from(ca.getImageData(Math.round(mx * 2), Math.round(my * 2), 1, 1).data); out[`${estilo}-agua`] = { dims: [ua.width, ua.height], meio: a(10, 7), borda: a(2.7, 7), fora: a(1, 1), res: bake.agua.res }; }
    }
    return { png: tela.toDataURL('image/png'), out };
  }, RES_PIXEL);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fase10-agua.png', Buffer.from(r.png.split(',')[1]!, 'base64'));
  const o = r.out as Record<string, any>;
  console.log('agua:', JSON.stringify(o));
  // Ilustrado: perto da margem predomina a areia (R alto), no meio a água escura (R baixo, B > R).
  assert.ok(o.illustrated.margem[0] > o.illustrated.meio[0] + 40, 'a margem é mais clara que o meio');
  assert.ok(o.illustrated.meio[2] > o.illustrated.meio[0], 'o meio é azulado');
  assert.ok(o.pixel.cores <= 40, `cores no Pixel: ${o.pixel.cores}`);
  // Textura de água: 2 px/m, profundidade alta no meio, zero fora, margem alta na borda.
  assert.deepEqual(o['illustrated-agua'].dims, [40, 28]); assert.equal(o['illustrated-agua'].res, 2);
  assert.ok(o['illustrated-agua'].meio[0] > 150 && o['illustrated-agua'].fora[0] === 0 && o['illustrated-agua'].borda[1] > 50, JSON.stringify(o['illustrated-agua']));
  assert.deepEqual(erros, []); await ctx.close();
});

// ---------- 10.1b: superfície animada ----------
import type { Page } from 'playwright';
import { clientDe, criarMapaPelaInterface } from './apoio.ts';

const sessao = (p: Page, fn: string, arg?: unknown) => p.evaluate(`(() => { const s = window.__atlas.sessao(); const f = ${fn}; return f(s, ${JSON.stringify(arg ?? null)}); })()`);

/** Diferença média por canal entre duas capturas, dentro de um retângulo (fração do recorte). */
const diferenca = (p: Page, a: Buffer, b: Buffer, r: [number, number, number, number]) => p.evaluate(async ([ia, ib, rr]) => {
  const ler = async (b64: string) => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0); return g.getImageData(Math.floor(rr[0] * img.width), Math.floor(rr[1] * img.height), Math.floor(rr[2] * img.width), Math.floor(rr[3] * img.height)).data; };
  const da = await ler(ia as string), db = await ler(ib as string); let s = 0; for (let i = 0; i < da.length; i++) if (i % 4 < 3) s += Math.abs(da[i]! - db[i]!); return s / (da.length * 0.75);
}, [a.toString('base64'), b.toString('base64'), r] as const);

async function lagoNoMapa(page: Page) {
  await criarMapaPelaInterface(page);
  const celulas: number[][] = [];
  for (let y = 0; y < 108; y++) for (let x = 0; x < 192; x++) if (((x - 96) / 40) ** 2 + ((y - 54) / 24) ** 2 < 1) celulas.push([x, y]);
  await sessao(page, '(s, c) => { s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0 } }); s.store.executar({ tipo: "terreno.base", material: "areia" }); s.store.executar({ tipo: "terreno.pintar", material: "agua.lago", celulas: c }); }', celulas);
  await page.waitForFunction('window.__atlas.viewport()?.aguaAtiva() ?? false', null, { timeout: 15000 });
}

const medirMovimento = async (page: Page) => {
  const [x0, y0] = await clientDe(page, [4, 2]), [x1, y1] = await clientDe(page, [44, 26]), clip = { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
  await page.waitForTimeout(600);
  const a = await page.screenshot({ clip }); await page.waitForTimeout(1000); const b = await page.screenshot({ clip });
  return { a, b, agua: await diferenca(page, a, b, [0.4, 0.4, 0.2, 0.2]), terra: await diferenca(page, a, b, [0.02, 0.02, 0.15, 0.15]) };
};

test('10.1b: a água se mexe e a terra em volta não', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await lagoNoMapa(page);
  const r = await medirMovimento(page); mkdirSync('test-results', { recursive: true }); writeFileSync('test-results/fase10-agua-superficie.png', r.a);
  console.log(`superficie: diferença na água ${r.agua.toFixed(3)}, na terra ${r.terra.toFixed(3)}`);
  assert.ok(r.agua > 0.4, `água ${r.agua}`); assert.ok(r.terra < 0.05, `terra ${r.terra}`);
  assert.deepEqual(erros, []); await ctx.close();
});

test('10.1b: com movimento reduzido a água se mexe bem menos', async () => {
  const normal = await novoContexto(amb), n = await abrir(normal, amb.url); await lagoNoMapa(n.page); const rn = await medirMovimento(n.page);
  const reduzido = await novoContexto(amb, { reducedMotion: 'reduce' }), p = await abrir(reduzido, amb.url); await lagoNoMapa(p.page); const rr = await medirMovimento(p.page);
  console.log(`movimento reduzido: normal ${rn.agua.toFixed(3)}, reduzido ${rr.agua.toFixed(3)}`);
  assert.ok(rr.agua < rn.agua * 0.7, `reduzido ${rr.agua} normal ${rn.agua}`);
  await normal.close(); await reduzido.close();
});

// ---------- 10.1c: correnteza, cáusticas e Pixel ----------
/** Deslocamento horizontal (px, positivo = para a direita) que melhor leva a captura `a` à `b` na faixa central. */
const deslocamento = (p: Page, a: Buffer, b: Buffer) => p.evaluate(async ([ia, ib]) => {
  const ler = async (b64: string) => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0); return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data }; };
  const A = await ler(ia as string), B = await ler(ib as string), x0 = Math.floor(A.w * 0.4), x1 = Math.floor(A.w * 0.6), y0 = Math.floor(A.h * 0.4), y1 = Math.floor(A.h * 0.6);
  let melhor = 0, menor = Infinity;
  for (let s = -30; s <= 30; s++) { let soma = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * A.w + x) * 4, j = (y * A.w + x + s) * 4; soma += (A.d[i]! + A.d[i + 1]! + A.d[i + 2]! > 270 ? 1 : 0) !== (B.d[j]! + B.d[j + 1]! + B.d[j + 2]! > 270 ? 1 : 0) ? 1 : 0; } if (soma < menor) { menor = soma; melhor = s; } }
  return melhor;
}, [a.toString('base64'), b.toString('base64')] as const);

test('10.1c: a espuma e as ondas de um rio andam no sentido da correnteza', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const celulas: number[][] = []; for (let y = 30; y < 80; y++) for (let x = 20; x < 170; x++) celulas.push([x, y]);
  const sentidos: number[] = [];
  for (const angle of [0, Math.PI]) {
    await sessao(page, '(s, a) => { s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0 } }); s.store.executar({ tipo: "terreno.base", material: "areia" }); s.store.executar({ tipo: "terreno.pintar", material: "agua.rio", celulas: a.c }); s.store.executar({ tipo: "terreno.correnteza", material: "agua.rio", flow: { angle: a.angle, speed: 0.8 } }); }', { c: celulas, angle });
    await page.waitForFunction('window.__atlas.viewport()?.aguaAtiva() ?? false', null, { timeout: 15000 }); await page.waitForTimeout(800);
    const [x0, y0] = await clientDe(page, [4, 2]), [x1, y1] = await clientDe(page, [44, 26]), clip = { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
    const a = await page.screenshot({ clip }); await page.waitForTimeout(120); const b = await page.screenshot({ clip }); writeFileSync(`test-results/fase10-agua-rio-${sentidos.length}.png`, a); sentidos.push(await deslocamento(page, a, b));
  }
  console.log('correnteza: deslocamento (px) para 0 rad e π rad:', sentidos.join(' '));
  assert.ok(sentidos[0]! > 0, `0 rad: ${sentidos[0]}`); assert.ok(sentidos[1]! < 0, `π rad: ${sentidos[1]}`);
  assert.deepEqual(erros, []); await ctx.close();
});

test('10.1c: a gruta tem cáusticas e o Pixel desenha a água em pixels inteiros (capturas)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const celulas: number[][] = []; for (let y = 0; y < 108; y++) for (let x = 0; x < 192; x++) if (((x - 96) / 50) ** 2 + ((y - 54) / 30) ** 2 < 1) celulas.push([x, y]);
  await sessao(page, '(s, c) => { s.store.executar({ tipo: "acabamento.atualizar", patch: { grain: 0 } }); s.store.executar({ tipo: "terreno.base", material: "rocha.rachada" }); s.store.executar({ tipo: "terreno.pintar", material: "agua.gruta", celulas: c }); }', celulas);
  await page.waitForFunction('window.__atlas.viewport()?.aguaAtiva() ?? false', null, { timeout: 15000 });
  const [x0, y0] = await clientDe(page, [4, 2]), [x1, y1] = await clientDe(page, [44, 26]), clip = { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
  await page.waitForTimeout(900);
  const a = await page.screenshot({ clip }); writeFileSync('test-results/fase10-agua-gruta.png', a);
  await page.waitForTimeout(500); const b = await page.screenshot({ clip });
  assert.ok(await diferenca(page, a, b, [0.4, 0.4, 0.2, 0.2]) > 0.4, 'as cáusticas se mexem');
  await sessao(page, '(s) => s.store.executar({ tipo: "estilo.atualizar", patch: { renderer: "pixel" } })');
  await page.waitForTimeout(1800);
  const c = await page.screenshot({ clip }); writeFileSync('test-results/fase10-agua-gruta-pixel.png', c);
  await page.waitForTimeout(700); const d = await page.screenshot({ clip });
  assert.ok(await diferenca(page, c, d, [0.4, 0.4, 0.2, 0.2]) > 0.2, 'a água do Pixel anda por quadros');
  assert.deepEqual(erros, []); await ctx.close();
});

// ---------- 10.1d: objetos submersos e anel de espuma ----------
const rocha = (id: string, x: number, y: number, elevation: 'floor' | 'underwater' = 'floor') => ({ id, source: { kind: 'recipe', recipe: 'rochedo', seed: 3, params: {} }, position: [x, y], rotation: 0, scale: 1.4, elevation, wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: false, harmonize: true, interaction: null });
/** Luminância média de um anel (raios em metros) em volta de um ponto do mundo, numa captura que começa em `origem` (metros) a `px` pixels por metro. */
const luzDoAnel = (p: Page, png: Buffer, centro: [number, number], r0: number, r1: number, pxm: number) => p.evaluate(async ([b64, c, a, b, k]) => {
  const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d', { willReadFrequently: true })!; g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data; let soma = 0, n = 0;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) { const r = Math.hypot(x - (c as number[])[0]!, y - (c as number[])[1]!) / (k as number); if (r >= (a as number) && r <= (b as number)) { const i = (y * img.width + x) * 4; soma += d[i]! + d[i + 1]! + d[i + 2]!; n++; } }
  return soma / n / 3;
}, [png.toString('base64'), centro, r0, r1, pxm] as const);

test('10.1d: um objeto de piso na água ganha anel de espuma; o submerso fica tingido e mais escuro', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await lagoNoMapa(page);
  await sessao(page, '(s, a) => { for (const o of a.o) s.store.executar({ tipo: "item.adicionar", colecao: "props", item: o }); }', { o: [rocha('a', 18, 13.5), rocha('b', 30, 13.5)] });
  const [x0, y0] = await clientDe(page, [4, 2]), [x1, y1] = await clientDe(page, [44, 26]), [cx, cy] = await clientDe(page, [18, 13.5]), [bx, by] = await clientDe(page, [30, 13.5]), [qx, qy] = await clientDe(page, [24, 13.5]);
  const clip = { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) }, pxm = Math.abs(x1 - x0) / 40;
  await page.waitForFunction('window.__atlas.viewport()?.objetosPintados() >= 2', null, { timeout: 15000 }); await page.waitForTimeout(1200);
  const base = await page.screenshot({ clip }); writeFileSync('test-results/fase10-agua-objetos.png', base);
  const rel = (x: number, y: number): [number, number] => [x - clip.x, y - clip.y];
  // Anel de espuma: o anel em volta da pedra é mais claro que um anel igual num ponto de água sem objeto.
  const comAnel = await luzDoAnel(page, base, rel(cx, cy), 2.25, 2.7, pxm), semAnel = await luzDoAnel(page, base, rel(qx, qy), 2.25, 2.7, pxm);
  console.log(`anel de espuma: ${comAnel.toFixed(1)} com objeto, ${semAnel.toFixed(1)} sem`);
  assert.ok(comAnel > semAnel + 6, `anel ${comAnel} × ${semAnel}`);
  // Submerso: o miolo da pedra B fica mais escuro depois de afundar.
  const antes = await luzDoAnel(page, base, rel(bx, by), 0, 0.5, pxm);
  await sessao(page, '(s) => s.store.executar({ tipo: "item.atualizar", colecao: "props", id: "b", patch: { elevation: "underwater" } })'); await page.waitForTimeout(800);
  const sub = await page.screenshot({ clip }); writeFileSync('test-results/fase10-agua-submerso.png', sub);
  const depois = await luzDoAnel(page, sub, rel(bx, by), 0, 0.5, pxm);
  console.log(`pedra submersa: ${antes.toFixed(1)} → ${depois.toFixed(1)}`);
  assert.ok(depois < antes - 15, `submerso ${depois} antes ${antes}`);
  assert.deepEqual(erros, []); await ctx.close();
});
