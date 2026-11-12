import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const RAIZ_DO_JUKEBOX = new URL('../../../Jukebox/', import.meta.url).pathname;
const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

async function servirJukebox(): Promise<{ servidor: http.Server; porta: number }> {
  const servidor = http.createServer(async (req, res) => {
    const caminho = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]!)).replace(/^(\.\.[/\\])+/, '');
    const arquivo = join(RAIZ_DO_JUKEBOX, caminho.endsWith('/') ? `${caminho}index.html` : caminho);
    try {
      const corpo = await readFile(arquivo);
      res.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(corpo);
    } catch {
      res.writeHead(404);
      res.end('não achei');
    }
  });
  await new Promise<void>(ok => servidor.listen(0, '127.0.0.1', ok));
  return { servidor, porta: (servidor.address() as { port: number }).port };
}

const MP3_MINIMO = Buffer.from([
  0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0xff, 0xfb, 0x90, 0x64, 0x00, 0x00,
]);

const JPEG_MINIMO = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

test('Jukebox E2E: recebe música enviada pelo conector, exibe no player e exporta no zip sem perder metadados', async () => {
  const { servidor, porta } = await servirJukebox();
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync('/tmp'), 'jukebox-e2e-'));

  try {
    const ctx = await novoContexto(amb, { viewport: { width: 1280, height: 800 } });
    try {
      // Desliga File System Access API para cair no fluxo de exportação zip
      await ctx.addInitScript(() => {
        // @ts-ignore
        delete window.showDirectoryPicker;
      });

      const page = await ctx.newPage();
      await page.goto(`http://127.0.0.1:${porta}/`);
      await page.waitForLoadState('domcontentloaded');

      // 1. Carrega o preset sample da Jukebox
      await page.hover('#manage-songs-btn');
      await page.locator('#load-sample-btn').click({ force: true });
      await page.waitForSelector('.song-item', { timeout: 15_000 });

      // 2. Simula o recebimento de música via conector (receberMusicaNoPlayer)
      const resReceber = await page.evaluate(async ({ pasta, item, audioBase64, capaBase64 }) => {
        // @ts-ignore
        const { receberMusicaNoPlayer } = await import('./upload-song.js');
        return receberMusicaNoPlayer({
          pasta,
          item,
          audio: audioBase64,
          capa: capaBase64,
        });
      }, {
        pasta: 'sample',
        item: {
          currentTitle: 'Sombras%20no%20Lago',
          genres: ['horror'],
          tags: ['ambient'],
        },
        audioBase64: MP3_MINIMO.toString('base64'),
        capaBase64: JPEG_MINIMO.toString('base64'),
      });

      assert.equal(resReceber.recebido, true);
      assert.equal(resReceber.titulo, 'Sombras no Lago');

      // 3. Filtra na busca para trazer o cartão ao topo da lista virtual
      await page.fill('#searchBar', 'sombras');
      await page.waitForTimeout(300);
      const inputTitulo = page.locator('.song-item input.title-input').first();
      await inputTitulo.waitFor({ timeout: 5_000 });
      assert.equal(await inputTitulo.inputValue(), 'Sombras no Lago');

      // Limpa a busca para salvar o preset inteiro
      await page.fill('#searchBar', '');
      await page.waitForTimeout(300);

      // 4. Clica em salvar preset e captura o download exportado
      const downloadPromise = page.waitForEvent('download');
      await page.hover('#manage-songs-btn');
      await page.locator('#save-preset-btn').click({ force: true });
      const download = await downloadPromise;

      const nomeBaixado = download.suggestedFilename();
      const caminhoBaixado = path.join(tmp, nomeBaixado);
      await download.saveAs(caminhoBaixado);
      assert.ok(fs.existsSync(caminhoBaixado));

      // 5. Inspeciona os metadados exportados (zip ou json): a música enviada pelo conector está lá
      let metadata: any;
      if (nomeBaixado.endsWith('.zip')) {
        const jsonText = execFileSync('unzip', ['-p', caminhoBaixado, 'preset_metadata.json'], { encoding: 'utf8' });
        metadata = JSON.parse(jsonText);
      } else {
        const jsonText = fs.readFileSync(caminhoBaixado, 'utf8');
        metadata = JSON.parse(jsonText);
      }
      assert.ok(Array.isArray(metadata));
      const achada = metadata.find((m: any) => m.currentTitle === 'Sombras%20no%20Lago');
      assert.ok(achada, 'Música enviada pelo conector deve ser preservada no preset_metadata.json exportado');
      assert.deepEqual(achada.genres, ['horror']);
      assert.deepEqual(achada.tags, ['ambient']);
    } finally {
      await ctx.close();
    }
  } finally {
    servidor.close();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
