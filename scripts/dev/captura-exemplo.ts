/**
 * Captura um mapa de exemplo de dia (o clima principal) e de noite (um clima guardado), para conferir a composição.
 *   node scripts/dev/captura-exemplo.ts <id> <clima-guardado> [--saida-prefixo test-results/x]
 * Grava <prefixo>-dia.png e <prefixo>-noite.png.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { MapaAtlas } from '../../src/domain/mapa.ts';
import { encerrar, esperarEditor, iniciarAmbiente, novoContexto } from '../../tests/e2e/apoio.ts';
import { montarExemplo, type Exemplo } from '../exemplos/kit.ts';

const [id, guardado] = process.argv.slice(2), i = process.argv.indexOf('--saida-prefixo');
const prefixo = join(import.meta.dirname, '../..', i >= 0 ? process.argv[i + 1]! : `test-results/${id}`);
const modulo = (await import(`../exemplos/${id}.ts`)) as Record<string, unknown>, exemplo = Object.values(modulo).find((v): v is Exemplo => typeof v === 'object' && v !== null && (v as Exemplo).id === id);
if (!exemplo || !guardado) { console.error('Uso: captura-exemplo.ts <id> <clima-guardado>'); process.exit(1); }
const dia = montarExemplo(exemplo), noite: MapaAtlas = structuredClone(dia), c = noite.customClimates[guardado];
if (!c) { console.error(`Clima guardado desconhecido: ${guardado}`); process.exit(1); }
noite.climate = { preset: noite.climate.preset, ...structuredClone(c.climate) }; noite.finish = { ...noite.finish, ...structuredClone(c.finish) };
noite.id = `${dia.id}-noite`;

type Janela = { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } }; viewport(): { pintando: number; definirModoProjetor(b: boolean): void; enquadrarCaixa(c: unknown, s: boolean): void; capturar(o: unknown): Promise<{ dataUrl: string }> } };
const ambiente = await iniciarAmbiente();
try {
  const ctx = await novoContexto(ambiente, { viewport: { width: 1600, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(ambiente.url);
  await page.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null, null, { timeout: 30_000 });
  for (const [mapa, sufixo] of [[dia, 'dia'], [noite, 'noite']] as const) {
    await page.evaluate(async m => { await (window as unknown as Janela).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
    await page.evaluate(mid => { location.hash = `#/mapa/${encodeURIComponent(mid)}`; }, mapa.id);
    await esperarEditor(page);
    await page.evaluate(({ w, h }) => { const vp = (window as unknown as { __atlas: Janela['__atlas'] & { viewport: Janela['viewport'] } }).__atlas.viewport(); vp.definirModoProjetor(true); vp.enquadrarCaixa({ x0: 0, y0: 0, x1: w, y1: h }, false); }, { w: mapa.bounds.width, h: mapa.bounds.height });
    await page.waitForTimeout(300);
    await page.waitForFunction(() => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0, null, { timeout: 180_000 });
    await page.waitForTimeout(1200);
    const url = await page.evaluate(async ({ w, h }) => (await (window as unknown as { __atlas: { viewport(): { capturar(o: unknown): Promise<{ dataUrl: string }> } } }).__atlas.viewport().capturar({ caixa: { x0: 0, y0: 0, x1: w, y1: h }, ladoMaximo: 2400 })).dataUrl, { w: mapa.bounds.width, h: mapa.bounds.height });
    writeFileSync(`${prefixo}-${sufixo}.png`, Buffer.from(url.split(',')[1]!, 'base64'));
    console.log(`Gravado ${prefixo}-${sufixo}.png`);
    await page.evaluate(() => { location.hash = '#/'; });
    await page.waitForTimeout(150);
  }
} finally { await encerrar(ambiente); }
