import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright';
import { build, preview, type PreviewServer } from 'vite';
import { esperarEditor, esperarMs } from './apoio.ts';

interface AssadoMedido {
  tipo: string;
  ms: number;
  px: number;
}

const TIPOS_NAO_CACHEAVEIS = new Set(['sprite']);
const CONFIG_VITE = new URL('../../vite.config.ts', import.meta.url).pathname;

async function esperarPintura(page: Page, timeout = 120_000): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0,
    null,
    { polling: 50, timeout },
  );
}

async function esperarCacheAssentar(page: Page): Promise<number> {
  const lerContagem = () =>
    page.evaluate(
      () =>
        new Promise<number>(resolver => {
          const req = indexedDB.open('atlas-assados-v1', 1);
          req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains('assados')) {
              req.result.createObjectStore('assados', { keyPath: 'chaveHash' });
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction('assados', 'readonly');
            const c = tx.objectStore('assados').count();
            c.onsuccess = () => {
              const n = c.result;
              db.close();
              resolver(n);
            };
            c.onerror = () => {
              db.close();
              resolver(0);
            };
          };
          req.onerror = () => resolver(0);
        }),
    );

  let anterior = -1;
  let estavel = 0;
  const limite = Date.now() + 20_000;
  while (Date.now() < limite) {
    const atual = await lerContagem();
    if (atual > 0 && atual === anterior) {
      estavel++;
      if (estavel >= 4) return atual;
    } else {
      anterior = atual;
      estavel = 0;
    }
    await esperarMs(200);
  }
  return anterior;
}

let servidor: PreviewServer;
let navegador: Browser;
let url: string;

before(async () => {
  await build({ configFile: CONFIG_VITE, logLevel: 'error' });
  servidor = await preview({
    configFile: CONFIG_VITE,
    logLevel: 'error',
    preview: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  url = servidor.resolvedUrls!.local[0]!;
  navegador = await chromium.launch({
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
  });
});

after(async () => {
  await navegador?.close();
  await new Promise<void>((resolver, rejeitar) => {
    if (!servidor) { resolver(); return; }
    servidor.httpServer.close(err => (err ? rejeitar(err) : resolver()));
  });
});

test('cache persistente no build: reabrir porto-noturno reaproveita assados do IndexedDB em < 1,5 s', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 860 } });
  try {
    await ctx.addInitScript(() => {
      try {
        if (localStorage.getItem('atlas:sugestoes') === null) localStorage.setItem('atlas:sugestoes', '0');
      } catch { /* sem armazenamento */ }
      const g = globalThis as unknown as { __atlasMedirAssados?: boolean; __atlasAssados?: AssadoMedido[] };
      g.__atlasMedirAssados = true;
      g.__atlasAssados = [];
    });

    const page = await ctx.newPage();
    const erros: string[] = [];
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
    page.on('pageerror', e => erros.push(`pageerror: ${e.message}`));

    await page.goto(`${url}?diagnostico`);
    await page.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null, null, { timeout: 20_000 });
    await page.waitForSelector('[data-testid="usar-porto-noturno"]', { timeout: 20_000 });
    await page.evaluate(() => {
      (globalThis as unknown as { __atlasAssados?: AssadoMedido[] }).__atlasAssados = [];
    });

    const tFrio0 = performance.now();
    await page.click('[data-testid="usar-porto-noturno"]');
    await esperarEditor(page);
    await esperarPintura(page);
    const frioMs = performance.now() - tFrio0;

    const assadosFrio = await page.evaluate(
      () => (globalThis as unknown as { __atlasAssados?: AssadoMedido[] }).__atlasAssados ?? [],
    );
    assert.ok(assadosFrio.length > 0, 'esperava assados na primeira abertura');

    const gravados = await esperarCacheAssentar(page);
    assert.ok(gravados > 0, `esperava entradas gravadas no IndexedDB (achou ${gravados})`);

    const tQuente0 = performance.now();
    await page.reload();
    await esperarEditor(page);
    const quenteEditorMs = performance.now() - tQuente0;
    await esperarPintura(page, 30_000);
    const quenteMs = performance.now() - tQuente0;

    const assadosQuente = await page.evaluate(
      () => (globalThis as unknown as { __atlasAssados?: AssadoMedido[] }).__atlasAssados ?? [],
    );
    const rebatidos = assadosQuente.filter(a => !TIPOS_NAO_CACHEAVEIS.has(a.tipo));

    console.log(
      `[M5 e2e build] porto-noturno: frio ${(frioMs / 1000).toFixed(2)} s (${assadosFrio.length} assados) | reabertura ${(quenteMs / 1000).toFixed(2)} s (editor ${(quenteEditorMs / 1000).toFixed(2)} s, pintura ${((quenteMs - quenteEditorMs) / 1000).toFixed(2)} s; ${rebatidos.length} cacheáveis reassados, ${gravados} no IDB)`,
    );

    assert.equal(rebatidos.length, 0, `não deveria reassar itens cacheáveis na reabertura: ${JSON.stringify(rebatidos)}`);
    assert.ok(quenteMs < 1500, `reabertura levou ${quenteMs.toFixed(0)} ms (meta < 1500 ms)`);
    assert.deepEqual(erros, [], `erros inesperados: ${erros.join('; ')}`);
  } finally {
    await ctx.close();
  }
});
