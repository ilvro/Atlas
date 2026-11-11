import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abrir, encerrar, esperarEditor, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

type Cap = { dataUrl: string; largura: number; altura: number; pxPorMetro: number; caixa: { x0: number; y0: number; x1: number; y1: number }; bytes: number; qualidade: number };
type VP = { camera: { x: number; y: number; zoom: number }; capturar(o?: { caixa?: unknown; ladoMaximo?: number }): Promise<Cap> };

test('capturar: o mapa inteiro cabe em ladoMaximo, não é vazio e a câmera e o modo voltam', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  try {
    const mapa = JSON.parse(readFileSync(new URL('../../public/exemplos/covil-na-caverna.atlas.json', import.meta.url), 'utf8'));
    await page.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
    await page.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
    await esperarEditor(page);
    // Câmera diferente do enquadre inicial, para provar a restauração.
    const antes = await page.evaluate(() => { const v = (window as unknown as { __atlas: { viewport(): VP } }).__atlas.viewport(); v.camera; return structuredClone(v.camera); });
    const r = await page.evaluate(async () => {
      const v = (window as unknown as { __atlas: { viewport(): VP } }).__atlas.viewport();
      const c = await v.capturar({ ladoMaximo: 800 });
      if (!c.dataUrl.startsWith('data:image/jpeg;base64,')) throw new Error(`não é JPEG: ${c.dataUrl.slice(0, 30)}`);
      const img = new Image(); img.src = c.dataUrl; await img.decode();
      const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
      const g = t.getContext('2d')!; g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, t.width, t.height).data;
      let soma = 0, soma2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i]! + d[i + 1]! + d[i + 2]!) / 3; soma += l; soma2 += l * l; n++; }
      const media = soma / n;
      const parcial = await v.capturar({ caixa: { x0: 0, y0: 0, x1: 10, y1: 10 }, ladoMaximo: 400 });
      return { w: img.width, h: img.height, dw: c.largura, dh: c.altura, esc: c.pxPorMetro, caixa: c.caixa, variancia: soma2 / n - media * media, parcial: { w: parcial.largura, h: parcial.altura, esc: parcial.pxPorMetro }, depois: structuredClone(v.camera) };
    });
    console.log('captura', JSON.stringify(r));
    assert.equal(Math.max(r.w, r.h), 800, 'o maior lado é ladoMaximo');
    assert.equal(r.w, r.dw); assert.equal(r.h, r.dh);
    assert.deepEqual(r.caixa, { x0: 0, y0: 0, x1: mapa.bounds.width, y1: mapa.bounds.height });
    assert.ok(r.variancia > 50, `imagem não vazia (variância ${r.variancia})`);
    assert.ok(Math.abs(r.w / r.h - mapa.bounds.width / mapa.bounds.height) < 0.03, 'proporção do mapa');
    assert.ok(Math.abs(r.esc * mapa.bounds.width - r.w) < 3, 'escala coerente com a largura');
    assert.equal(Math.max(r.parcial.w, r.parcial.h), 400);
    assert.deepEqual(r.depois, antes, 'a câmera voltou');
    assert.deepEqual(erros, []);
  } finally { await ctx.close(); }
});

test('capturar: o mapa grande (porto-noturno) sai em JPEG com base64 até 700 000', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  try {
    const mapa = JSON.parse(readFileSync(new URL('../../public/exemplos/porto-noturno.atlas.json', import.meta.url), 'utf8'));
    await page.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
    await page.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
    await esperarEditor(page);
    const r = await page.evaluate(async () => {
      const c = await (window as unknown as { __atlas: { viewport(): VP } }).__atlas.viewport().capturar();
      return { prefixo: c.dataUrl.slice(0, 23), b64: c.dataUrl.length - c.dataUrl.indexOf(',') - 1, w: c.largura, h: c.altura, bytes: c.bytes, q: c.qualidade };
    });
    console.log('captura porto', JSON.stringify(r));
    assert.equal(r.prefixo, 'data:image/jpeg;base64,');
    assert.ok(r.b64 <= 700_000, `base64 ${r.b64}`);
    assert.ok(Math.max(r.w, r.h) <= 1280);
    assert.deepEqual(erros, []);
  } finally { await ctx.close(); }
});

test('capturar: o modo projetor esconde os fantasmas (ferramenta, proposta, laço) e os devolve ao sair', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  try {
    const mapa = JSON.parse(readFileSync(new URL('../../public/exemplos/covil-na-caverna.atlas.json', import.meta.url), 'utf8'));
    await page.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
    await page.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
    await esperarEditor(page);
    const r = await page.evaluate(async () => {
      type V = { definirModoProjetor(l: boolean): void; fantasmasVisiveis(): { ferramenta: boolean; proposta: boolean; laco: boolean }; capturar(o?: unknown): Promise<unknown> };
      const v = (window as unknown as { __atlas: { viewport(): V } }).__atlas.viewport();
      const antes = v.fantasmasVisiveis();
      v.definirModoProjetor(true); const projetor = v.fantasmasVisiveis();
      v.definirModoProjetor(false); const depois = v.fantasmasVisiveis();
      await v.capturar({ ladoMaximo: 400 }); const aposCaptura = v.fantasmasVisiveis();
      return { antes, projetor, depois, aposCaptura };
    });
    assert.deepEqual(r.antes, { ferramenta: true, proposta: true, laco: true });
    assert.deepEqual(r.projetor, { ferramenta: false, proposta: false, laco: false });
    assert.deepEqual(r.depois, r.antes);
    assert.deepEqual(r.aposCaptura, r.antes);
    assert.deepEqual(erros, []);
  } finally { await ctx.close(); }
});

test('capturar: com requestAnimationFrame simulado que nunca dispara e visibilityState = hidden, termina em menos de 10 s', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  try {
    const mapa = JSON.parse(readFileSync(new URL('../../public/exemplos/covil-na-caverna.atlas.json', import.meta.url), 'utf8'));
    await page.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
    await page.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
    await esperarEditor(page);
    const r = await page.evaluate(async () => {
      window.requestAnimationFrame = () => 0;
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
      const t0 = performance.now();
      const v = (window as unknown as { __atlas: { viewport(): VP } }).__atlas.viewport();
      const c = await v.capturar({ ladoMaximo: 400 });
      const duracao = performance.now() - t0;
      return { duracao, w: c.largura, h: c.altura, prefixo: c.dataUrl.slice(0, 23) };
    });
    assert.ok(r.duracao < 10_000, `terminou em ${r.duracao}ms (deve ser < 10s)`);
    assert.equal(r.prefixo, 'data:image/jpeg;base64,');
    assert.deepEqual(erros, []);
  } finally { await ctx.close(); }
});

test('capturar: com pintando sempre acima de 0, termina com aviso', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  try {
    const mapa = JSON.parse(readFileSync(new URL('../../public/exemplos/covil-na-caverna.atlas.json', import.meta.url), 'utf8'));
    await page.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
    await page.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
    await esperarEditor(page);
    const r = await page.evaluate(async () => {
      type VPComSim = VP & { simularPintando(n: number | null): void };
      const v = (window as unknown as { __atlas: { viewport(): VPComSim } }).__atlas.viewport();
      v.simularPintando(5);
      try {
        const c = await (v.capturar({ ladoMaximo: 400 }) as Promise<Cap & { aviso?: string }>);
        return { aviso: c.aviso, prefixo: c.dataUrl.slice(0, 23) };
      } finally {
        v.simularPintando(null);
      }
    });
    assert.equal(r.aviso, 'a cena ainda estava pintando; a imagem pode estar incompleta');
    assert.equal(r.prefixo, 'data:image/jpeg;base64,');
    assert.deepEqual(erros, []);
  } finally { await ctx.close(); }
});
