/**
 * Prancha de biomas: recortes de 14 × 14 m montados só com o acervo (terreno, plantas e objetos), de dia e de noite, para conferir se
 * cada bioma lê à primeira vista. Cada recorte é uma função abaixo; acrescente um quando o acervo ganhar um bioma.
 *
 *   node scripts/dev/prancha-biomas.ts [--saida test-results/x.png] [--sem-luz] [selva praia deserto outono oriental caverna …]
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MapaAtlas, Ponto } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { encerrar, esperarEditor, iniciarAmbiente, novoContexto } from '../../tests/e2e/apoio.ts';
import { Kit } from '../exemplos/kit.ts';

const L = 14;
type Recorte = (k: Kit, o: Ponto, noite: boolean) => void;
const em = (o: Ponto, x: number, y: number): Ponto => [o[0] + x, o[1] + y];
const ret = (o: Ponto, x0: number, y0: number, x1: number, y1: number) => ({ retangulo: [o[0] + x0, o[1] + y0, o[0] + x1, o[1] + y1] as [number, number, number, number] });

const RECORTES: Record<string, Recorte> = {
  selva(k, o) {
    k.pintar('chao.de.selva', ret(o, 0, 0, L, L));
    k.pintar('agua.tropical', { poligono: [em(o, 9, 0), em(o, 12, 0), em(o, 11, 6), em(o, 13, 14), em(o, 9.5, 14), em(o, 8.5, 7)], irregular: 0.6 });
    k.objeto('casa:arvore-de-selva-8m', em(o, 3.5, 4)); k.objeto('casa:arvore-de-selva-5m', em(o, 4, 10.5)); k.objeto('casa:arvore-de-selva-5m', em(o, 13.5, 3));
    for (const [x, y] of [[7, 2], [1.5, 7.5], [7.5, 9], [6.5, 13], [13, 9]] as const) k.objeto('casa:folhagem-tropical-2m', em(o, x, y));
    for (const [x, y] of [[6, 6], [2, 13], [12.5, 12.5], [7.5, 4.5]] as const) k.objeto('folhas-largas', em(o, x, y));
    k.objeto('casa:bambuzal-2m', em(o, 7.5, 11));
  },
  praia(k, o) {
    k.pintar('areia', ret(o, 0, 0, L, L));
    k.pintar('areia.molhada', { poligono: [em(o, 7, 0), em(o, L, 0), em(o, L, L), em(o, 8.5, L)], irregular: 0.5 });
    k.pintar('agua.tropical', { poligono: [em(o, 9, 0), em(o, L, 0), em(o, L, L), em(o, 10.5, L), em(o, 9.6, 7)], irregular: 0.7 });
    k.objeto('casa:coqueiro-6m', em(o, 4, 3.5), { rotation: 0.3 }); k.objeto('casa:coqueiro-4m', em(o, 6, 9), { rotation: -0.4 }); k.objeto('casa:coqueiro-6m', em(o, 2.5, 11.5), { rotation: 0.9 });
    k.objeto('casa:arvore-de-mangue-4m', em(o, 11.5, 12));
    for (const [x, y] of [[1, 6], [8, 3]] as const) k.objeto('casa:folhagem-tropical-1m', em(o, x, y));
  },
  deserto(k, o) {
    k.pintar('areia.duna', ret(o, 0, 0, L, L));
    k.pintar('terra.rachada', { poligono: [em(o, 0, 8), em(o, 7, 9), em(o, 8, 14), em(o, 0, 14)], irregular: 0.6 });
    k.pintar('grama', { disco: em(o, 10, 4.5), raio: 2.6, irregular: 0.6 });
    k.pintar('agua.tropical', { disco: em(o, 10, 4.5), raio: 1.5, irregular: 0.4 });
    k.objeto('casa:tamareira-5m', em(o, 7.5, 2.5)); k.objeto('casa:tamareira-5m', em(o, 12.5, 6.5));
    k.objeto('casa:saguaro-a', em(o, 3, 3)); k.objeto('casa:saguaro-b', em(o, 4.5, 11)); k.objeto('casa:opuntia-a', em(o, 1.5, 7)); k.objeto('casa:opuntia-b', em(o, 10, 11.5));
    k.objeto('casa:cacto-redondo-grupo', em(o, 6.5, 7)); k.objeto('casa:cacto-redondo-um', em(o, 12.5, 12.5)); k.objeto('casa:arbusto-seco-1m', em(o, 2, 12.8));
  },
  outono(k, o) {
    k.pintar('grama.outono', ret(o, 0, 0, L, L));
    k.pintar('folhas.outono', { poligono: [em(o, 1, 1), em(o, 9, 0.5), em(o, 10, 7), em(o, 4, 9), em(o, 0.5, 7)], irregular: 0.7 });
    k.pintar('terra', { poligono: [em(o, 0, 11), em(o, L, 9.5), em(o, L, 11), em(o, 0, 12.5)], irregular: 0.3 });
    k.objeto('casa:carvalho-grande-7m-outono-laranja', em(o, 4.5, 4.5)); k.objeto('casa:arvore-5m-outono-vermelha', em(o, 11, 4)); k.objeto('casa:arvore-5m-outono-laranja', em(o, 10.5, 13.5));
    k.objeto('casa:arvore-5m', em(o, 2.5, 14)); k.objeto('casa:arbusto-grande', em(o, 7.5, 8.5));
  },
  oriental(k, o) {
    k.pintar('grama', ret(o, 0, 0, L, L));
    k.pintar('cascalho', { poligono: [em(o, 3, 3), em(o, 11, 3), em(o, 11, 11), em(o, 3, 11)] });
    k.pintar('agua.lago', { disco: em(o, 7.5, 7.5), raio: 2.4, irregular: 0.5 });
    k.objeto('casa:cerejeira-6m', em(o, 3, 3)); k.objeto('casa:cerejeira-4m', em(o, 11.5, 11)); k.objeto('casa:cerejeira-5m-rala', em(o, 12, 3));
    k.objeto('casa:bambuzal-4m', em(o, 2, 11.5)); k.objeto('casa:bambuzal-2m', em(o, 5, 13));
    for (const [x, y] of [[5, 5.5], [9.8, 9.6], [5.6, 9.5]] as const) k.objeto('pedra.media', em(o, x, y));
  },
};

const args = process.argv.slice(2), iSaida = args.indexOf('--saida'), semLuz = args.includes('--sem-luz');
const SAIDA = join(import.meta.dirname, '../..', iSaida >= 0 ? args[iSaida + 1]! : 'test-results/prancha-biomas.png');
const pedidos = args.filter((a, i) => i !== iSaida && i !== iSaida + 1 && a !== '--sem-luz');
const NOMES = pedidos.length ? pedidos : Object.keys(RECORTES);
for (const n of NOMES) if (!RECORTES[n]) { console.error(`Recorte desconhecido: ${n} (há ${Object.keys(RECORTES).join(', ')})`); process.exit(1); }
const VAO = 1, COLUNAS = Math.min(3, NOMES.length), LINHAS = Math.ceil(NOMES.length / COLUNAS);
const LARGURA = COLUNAS * (L + VAO) + VAO, ALTURA = LINHAS * (L + VAO) + VAO;
const origem = (i: number): Ponto => [VAO + (i % COLUNAS) * (L + VAO), VAO + Math.floor(i / COLUNAS) * (L + VAO)];

function montar(noite: boolean): MapaAtlas {
  const k = new Kit({ id: `prancha-biomas-${noite ? 'noite' : 'dia'}`, nome: 'Prancha de biomas', largura: LARGURA, altura: ALTURA, semente: 7 });
  k.estilo({ genre: 'fantasia', palette: 'fantasia' });
  k.fundo({ kind: 'solid', color: '#14171a' });
  k.base('rocha.rachada');
  NOMES.forEach((n, i) => { const o = origem(i); RECORTES[n]!(k, o, noite); if (noite && !semLuz && n !== 'caverna') k.luz('fogueira', [o[0] + L / 2, o[1] + L / 2], { radius: 9, intensity: 1, flicker: 0 }); });
  if (noite) k.clima('noite', { time: '23:00', tempo: { rain: 0, snow: 0, fog: 0, wind: 0 } });
  else k.clima('tarde', { time: '15:30', tempo: { rain: 0, snow: 0, fog: 0, wind: 0 } });
  k.acabamento('neutro', { vignette: 0, edges: { kind: 'none', amount: 0 } });
  const mapa = k.construir();
  validarMapa(mapa);
  return mapa;
}

async function capturar(page: import('playwright').Page, mapa: MapaAtlas): Promise<string> {
  await page.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o?: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, mapa);
  await page.evaluate(id => { location.hash = `#/mapa/${encodeURIComponent(id)}`; }, mapa.id);
  await esperarEditor(page);
  await page.evaluate(({ w, h }) => {
    const vp = (window as unknown as { __atlas: { viewport(): { definirModoProjetor(b: boolean): void; enquadrarCaixa(c: unknown, s: boolean): void } } }).__atlas.viewport();
    vp.definirModoProjetor(true); vp.enquadrarCaixa({ x0: 0, y0: 0, x1: w, y1: h }, false);
  }, { w: LARGURA, h: ALTURA });
  await page.waitForTimeout(300);
  await page.waitForFunction(() => (window as unknown as { __atlas?: { viewport(): { pintando: number } | null } }).__atlas?.viewport()?.pintando === 0, null, { timeout: 120_000 });
  await page.waitForTimeout(1200);
  const url = await page.evaluate(async ({ w, h }) => (await (window as unknown as { __atlas: { viewport(): { capturar(o: unknown): Promise<{ dataUrl: string }> } } }).__atlas.viewport().capturar({ caixa: { x0: 0, y0: 0, x1: w, y1: h }, ladoMaximo: 2400 })).dataUrl, { w: LARGURA, h: ALTURA });
  await page.evaluate(() => { location.hash = '#/'; });
  await page.waitForTimeout(150);
  return url;
}

const ambiente = await iniciarAmbiente();
try {
  const ctx = await novoContexto(ambiente, { viewport: { width: 1600, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto(ambiente.url);
  await page.waitForFunction(() => (window as unknown as { __atlas?: { servicos(): unknown } }).__atlas?.servicos() != null, null, { timeout: 30_000 });
  const dia = await capturar(page, montar(false)), noite = await capturar(page, montar(true));
  const png = await page.evaluate(async ({ imagens, nomes, colunas, largura, lado, vao }) => {
    const imgs = await Promise.all(imagens.map(async s => { const i = new Image(); i.src = s; await i.decode(); return i; }));
    const W = imgs[0]!.width, H = imgs[0]!.height, TITULO = 30, c = document.createElement('canvas');
    c.width = W; c.height = (H + TITULO) * imgs.length;
    const x = c.getContext('2d')!; x.fillStyle = '#0d1015'; x.fillRect(0, 0, c.width, c.height);
    const pxm = W / largura;
    imgs.forEach((img, n) => {
      const y0 = n * (H + TITULO);
      x.fillStyle = '#e7eef8'; x.font = '600 18px sans-serif'; x.fillText(n ? 'Noite' : 'Tarde', 8, y0 + 22);
      x.drawImage(img, 0, y0 + TITULO);
      x.font = '600 14px sans-serif';
      nomes.forEach((r, i) => { const px = (vao + (i % colunas) * (lado + vao)) * pxm, py = y0 + TITULO + (vao + Math.floor(i / colunas) * (lado + vao)) * pxm + 16; const tw = x.measureText(r).width + 8; x.fillStyle = 'rgba(10,14,20,0.8)'; x.fillRect(px, py - 14, tw, 18); x.fillStyle = '#f2ede4'; x.fillText(r, px + 4, py); });
    });
    return c.toDataURL('image/png');
  }, { imagens: [dia, noite], nomes: NOMES, colunas: COLUNAS, largura: LARGURA, lado: L, vao: VAO });
  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, Buffer.from(png.split(',')[1]!, 'base64'));
  console.log(`Prancha gravada em ${SAIDA}`);
} finally { await encerrar(ambiente); }
