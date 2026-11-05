/**
 * Gera os mapas de exemplo: public/exemplos/<id>.atlas.json (validado), public/exemplos/indice.json e a miniatura <id>.webp (640 × 360).
 *   npm run exemplos                    todos os exemplos
 *   npm run exemplos -- --so <id>       um só (o índice continua listando todos)
 *   npm run exemplos -- --sem-miniatura só os JSON (não precisa de navegador; a miniatura que já existe fica)
 * Mesmo script e mesma semente = mesmo JSON. A miniatura precisa de navegador: sobe o Vite e o Chromium do Playwright, como `npm run assar`.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { encerrar, esperarEditor, iniciarAmbiente } from '../../tests/e2e/apoio.ts';
import type { MapaAtlas } from '../../src/domain/mapa.ts';
import { montarExemplo, type Exemplo } from './kit.ts';
import { clareira } from './clareira.ts';

/** A lista dos exemplos: acrescente aqui os novos. */
export const EXEMPLOS: readonly Exemplo[] = [clareira];

const SAIDA = join(import.meta.dirname, '../../public/exemplos');
const argumentos = process.argv.slice(2), soIdx = argumentos.indexOf('--so'), so = soIdx >= 0 ? argumentos[soIdx + 1] : null, semMiniatura = argumentos.includes('--sem-miniatura');
if (so && !EXEMPLOS.some(e => e.id === so)) { console.error(`Exemplo desconhecido: ${so}. Existem: ${EXEMPLOS.map(e => e.id).join(', ')}`); process.exit(1); }

mkdirSync(SAIDA, { recursive: true });
const docs = new Map<string, MapaAtlas>();
for (const e of EXEMPLOS) {
  const mapa = montarExemplo(e);           // valida (validarMapa) ou lança
  docs.set(e.id, mapa);
  if (so && e.id !== so) continue;
  writeFileSync(join(SAIDA, `${e.id}.atlas.json`), JSON.stringify(mapa) + '\n');
  console.log(`${e.id}: ${e.largura} × ${e.altura} m, ${Object.keys(mapa.props).length} objetos, ${Object.keys(mapa.lights).length} luzes, ${Object.keys(mapa.rooms).length} cômodos`);
}
const indice = EXEMPLOS.map(e => ({ id: e.id, nome: e.nome, descricao: e.descricao, tamanho: [e.largura, e.altura], miniatura: `${e.id}.webp` }));
writeFileSync(join(SAIDA, 'indice.json'), JSON.stringify(indice, null, 2) + '\n');

if (!semMiniatura) {
  const ambiente = await iniciarAmbiente();
  try {
    const ctx = await ambiente.navegador.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('atlas:sugestoes', '0'); } catch { /* sem armazenamento */ } });
    const pagina = await ctx.newPage();
    await pagina.goto(ambiente.url);
    await pagina.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null, null, { timeout: 30_000 });
    for (const e of EXEMPLOS) {
      if (so && e.id !== so) continue;
      const mapa = docs.get(e.id)!;
      // Salva no repositório do navegador de teste (descartável), abre o mapa e fotografa só a área dele.
      await pagina.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
      await pagina.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
      await esperarEditor(pagina);
      await pagina.waitForTimeout(2500);
      const png = await pagina.locator('[data-testid="area-do-mapa"]').screenshot({ type: 'png' });
      const webp = await pagina.evaluate(async dados => {
        const img = new Image(); img.src = dados; await img.decode();
        const tela = document.createElement('canvas'); tela.width = 640; tela.height = 360;
        const c = tela.getContext('2d')!, escala = Math.max(640 / img.width, 360 / img.height), w = img.width * escala, h = img.height * escala;
        c.drawImage(img, (640 - w) / 2, (360 - h) / 2, w, h);
        return tela.toDataURL('image/webp', 0.85);
      }, `data:image/png;base64,${png.toString('base64')}`);
      writeFileSync(join(SAIDA, `${e.id}.webp`), Buffer.from(webp.split(',')[1]!, 'base64'));
      console.log(`${e.id}: miniatura gravada`);
      await pagina.evaluate(() => { location.hash = '#/'; });
    }
  } finally { await encerrar(ambiente); }
} else for (const e of EXEMPLOS) if (!existsSync(join(SAIDA, `${e.id}.webp`))) console.log(`${e.id}: sem miniatura (rode sem --sem-miniatura)`);
