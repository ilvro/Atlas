/**
 * Prancha de terreno: cada material num quadro de 6 × 6 m, lado a lado, à tarde e à noite com uma tocha no meio de cada quadro.
 * Serve para conferir textura, escala e tom de materiais novos contra os que já existem.
 *
 *   node scripts/dev/prancha-terreno.ts [--saida test-results/x.png] material1 material2 …
 *   (sem materiais: o lote 2 da Frente P, ao lado da grama e da terra do lote 1)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { MapaAtlas } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { materialDe } from '../../src/procedural/materiais.ts';
import { encerrar, esperarEditor, iniciarAmbiente, novoContexto } from '../../tests/e2e/apoio.ts';
import { Kit } from '../exemplos/kit.ts';

const args = process.argv.slice(2), iSaida = args.indexOf('--saida');
const SAIDA = join(import.meta.dirname, '../..', iSaida >= 0 ? args[iSaida + 1]! : 'test-results/prancha-terreno.png');
const pedidos = args.filter((a, i) => i !== iSaida && i !== iSaida + 1);
const MATERIAIS = pedidos.length ? pedidos : ['grama', 'terra', 'grama.escura', 'grama.acinzentada', 'lama', 'areia', 'areia.molhada', 'cascalho', 'pedregulho', 'neve', 'neve.funda', 'neve.pisada', 'terra.congelada'];

const LADO = 6, VAO = 1, COLUNAS = Math.min(5, MATERIAIS.length), LINHAS = Math.ceil(MATERIAIS.length / COLUNAS);
const LARGURA = COLUNAS * (LADO + VAO) + VAO, ALTURA = LINHAS * (LADO + VAO) + VAO;
const origem = (i: number): [number, number] => [VAO + (i % COLUNAS) * (LADO + VAO), VAO + Math.floor(i / COLUNAS) * (LADO + VAO)];

function montar(noite: boolean): MapaAtlas {
  const k = new Kit({ id: `prancha-terreno-${noite ? 'noite' : 'dia'}`, nome: 'Prancha de terreno', largura: LARGURA, altura: ALTURA, semente: 31 });
  k.estilo({ genre: 'fantasia', palette: 'fantasia' });
  k.fundo({ kind: 'solid', color: '#14171a' });
  k.base('rocha.rachada');
  MATERIAIS.forEach((mat, i) => { const [x, y] = origem(i); k.pintar(mat, { retangulo: [x, y, x + LADO, y + LADO] }); });
  if (noite) {
    MATERIAIS.forEach((_, i) => { const [x, y] = origem(i); k.luz('tocha', [x + LADO / 2, y + LADO / 2], { radius: 5, intensity: 1.1, flicker: 0 }); });
    k.clima('noite', { time: '23:00', tempo: { rain: 0, snow: 0, fog: 0, wind: 0 } });
  } else k.clima('tarde', { time: '15:00', tempo: { rain: 0, snow: 0, fog: 0, wind: 0 } });
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
  await page.waitForTimeout(700);
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
  const rotulos = MATERIAIS.map(id => `${id} — ${materialDe(id).nome}`);
  const png = await page.evaluate(async ({ imagens, rotulos, colunas, largura, lado, vao }) => {
    const imgs = await Promise.all(imagens.map(async s => { const i = new Image(); i.src = s; await i.decode(); return i; }));
    const W = imgs[0]!.width, H = imgs[0]!.height, TITULO = 30, c = document.createElement('canvas');
    c.width = W; c.height = (H + TITULO) * imgs.length;
    const x = c.getContext('2d')!; x.fillStyle = '#0d1015'; x.fillRect(0, 0, c.width, c.height);
    const pxm = W / largura;
    imgs.forEach((img, n) => {
      const y0 = n * (H + TITULO);
      x.fillStyle = '#e7eef8'; x.font = '600 18px sans-serif'; x.fillText(n ? 'Noite, uma tocha por quadro' : 'Tarde', 8, y0 + 22);
      x.drawImage(img, 0, y0 + TITULO);
      x.font = '600 13px sans-serif';
      rotulos.forEach((r, i) => {
        const px = (vao + (i % colunas) * (lado + vao)) * pxm, py = y0 + TITULO + (vao + Math.floor(i / colunas) * (lado + vao)) * pxm - 4;
        const tw = x.measureText(r).width + 8; x.fillStyle = 'rgba(10,14,20,0.8)'; x.fillRect(px, py - 13, tw, 16); x.fillStyle = '#f2ede4'; x.fillText(r, px + 4, py);
      });
    });
    return c.toDataURL('image/png');
  }, { imagens: [dia, noite], rotulos, colunas: COLUNAS, largura: LARGURA, lado: LADO, vao: VAO });
  mkdirSync(dirname(SAIDA), { recursive: true });
  writeFileSync(SAIDA, Buffer.from(png.split(',')[1]!, 'base64'));
  console.log(`Prancha gravada em ${SAIDA}`);
} finally { await encerrar(ambiente); }
