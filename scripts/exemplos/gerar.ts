/**
 * Gera os mapas de exemplo: public/exemplos/<id>.atlas.json (validado), public/exemplos/indice.json e a miniatura <id>.webp (640 × 360).
 *   npm run exemplos                    todos os exemplos
 *   npm run exemplos -- --so <id>       um só (o índice continua listando todos)
 *   npm run exemplos -- --sem-miniatura só os JSON (não precisa de navegador; a miniatura que já existe fica)
 * Mesmo script e mesma semente = mesmo JSON. A miniatura precisa de navegador: sobe o Vite e o Chromium do Playwright, como `npm run assar`.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { encerrar, esperarEditor, iniciarAmbiente } from '../../tests/e2e/apoio.ts';
import type { MapaAtlas } from '../../src/domain/mapa.ts';
import { montarExemplo, type Exemplo } from './kit.ts';
import { clareira } from './clareira.ts';
import { covilNaCaverna } from './covil-na-caverna.ts';
import { desfiladeiroNevado } from './desfiladeiro-nevado.ts';
import { entrepostoDoRio } from './entreposto-do-rio.ts';
import { grutaDosContrabandistas } from './gruta-dos-contrabandistas.ts';
import { portoNoturno } from './porto-noturno.ts';
import { ravinaNoturna } from './ravina-noturna.ts';
import { ruinaCosteira } from './ruina-costeira.ts';

/** A lista dos exemplos: os sete da Fase 10 mais a Clareira de teste. */
export const EXEMPLOS: readonly Exemplo[] = [
  desfiladeiroNevado,
  ruinaCosteira,
  ravinaNoturna,
  portoNoturno,
  entrepostoDoRio,
  covilNaCaverna,
  grutaDosContrabandistas,
  clareira,
];

const SAIDA = join(import.meta.dirname, '../../public/exemplos');
const REFERENCIAS = join(import.meta.dirname, '../../docs/referencias/exemplos');
const RESULTADOS = join(import.meta.dirname, '../../test-results');
const argumentos = process.argv.slice(2), soIdx = argumentos.indexOf('--so'), so = soIdx >= 0 ? argumentos[soIdx + 1] : null, semMiniatura = argumentos.includes('--sem-miniatura');
if (so && !EXEMPLOS.some(e => e.id === so)) { console.error(`Exemplo desconhecido: ${so}. Existem: ${EXEMPLOS.map(e => e.id).join(', ')}`); process.exit(1); }

mkdirSync(SAIDA, { recursive: true });
mkdirSync(RESULTADOS, { recursive: true });
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
    const ctx = await ambiente.navegador.newContext({ viewport: { width: 1600, height: 1080 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('atlas:sugestoes', '0'); } catch { /* sem armazenamento */ } });
    const pagina = await ctx.newPage();
    await pagina.goto(ambiente.url);
    await pagina.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null, null, { timeout: 30_000 });
    for (const e of EXEMPLOS) {
      if (so && e.id !== so) continue;
      const mapa = docs.get(e.id)!;
      // Salva no repositório do navegador de teste (descartável), abre o mapa e fotografa a área exata do mapa sem marcadores de editor.
      await pagina.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
      await pagina.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
      await esperarEditor(pagina);
      const clip = await pagina.evaluate(({ w, h }) => {
        const vp = (window as unknown as {
          __atlas: {
            viewport(): {
              definirModoProjetor(b: boolean): void;
              enquadrarCaixa(c: { x0: number; y0: number; x1: number; y1: number }, s: boolean): void;
              clientDe(p: [number, number]): [number, number];
            };
          };
        }).__atlas.viewport();
        vp.definirModoProjetor(true);
        vp.enquadrarCaixa({ x0: 0, y0: 0, x1: w, y1: h }, false);
        const [x0, y0] = vp.clientDe([0, 0]);
        const [x1, y1] = vp.clientDe([w, h]);
        return {
          x: Math.max(0, Math.round(x0)),
          y: Math.max(0, Math.round(y0)),
          width: Math.max(1, Math.round(x1 - x0)),
          height: Math.max(1, Math.round(y1 - y0)),
        };
      }, { w: mapa.bounds.width, h: mapa.bounds.height });
      await pagina.waitForTimeout(300);
      await pagina.waitForFunction(() => {
        const vp = (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport();
        return vp != null && vp.pintando === 0;
      }, null, { timeout: 30_000 });
      await pagina.waitForTimeout(900);
      const png = await pagina.screenshot({ type: 'png', clip });
      const b64Atlas = `data:image/png;base64,${png.toString('base64')}`;
      const webp = await pagina.evaluate(async dados => {
        const img = new Image(); img.src = dados; await img.decode();
        const tela = document.createElement('canvas'); tela.width = 640; tela.height = 360;
        const c = tela.getContext('2d')!, escala = Math.max(640 / img.width, 360 / img.height), w = img.width * escala, h = img.height * escala;
        c.drawImage(img, (640 - w) / 2, (360 - h) / 2, w, h);
        return tela.toDataURL('image/webp', 0.85);
      }, b64Atlas);
      writeFileSync(join(SAIDA, `${e.id}.webp`), Buffer.from(webp.split(',')[1]!, 'base64'));
      const caminhoRef = join(REFERENCIAS, `${e.id}.png`);
      if (existsSync(caminhoRef)) {
        const b64Ref = `data:image/png;base64,${readFileSync(caminhoRef).toString('base64')}`;
        const comparacao = await pagina.evaluate(async ({ atlasSrc, refSrc }) => {
          const carregar = async (src: string) => {
            const img = new Image(); img.src = src; await img.decode(); return img;
          };
          const [imgA, imgR] = await Promise.all([carregar(atlasSrc), carregar(refSrc)]);
          const alt = 720, gap = 12;
          const largA = Math.round(imgA.width * (alt / imgA.height));
          const largR = Math.round(imgR.width * (alt / imgR.height));
          const tela = document.createElement('canvas');
          tela.width = largA + gap + largR;
          tela.height = alt;
          const c = tela.getContext('2d')!;
          c.fillStyle = '#07080b';
          c.fillRect(0, 0, tela.width, tela.height);
          c.drawImage(imgA, 0, 0, largA, alt);
          c.drawImage(imgR, largA + gap, 0, largR, alt);
          return tela.toDataURL('image/png');
        }, { atlasSrc: b64Atlas, refSrc: b64Ref });
        writeFileSync(join(RESULTADOS, `fase10-${e.id}.png`), Buffer.from(comparacao.split(',')[1]!, 'base64'));
      }
      console.log(`${e.id}: miniatura gravada`);
      await pagina.evaluate(() => { location.hash = '#/'; });
    }
  } finally { await encerrar(ambiente); }
} else for (const e of EXEMPLOS) if (!existsSync(join(SAIDA, `${e.id}.webp`))) console.log(`${e.id}: sem miniatura (rode sem --sem-miniatura)`);
