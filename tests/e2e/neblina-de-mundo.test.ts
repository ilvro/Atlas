import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { abrir, clientDe, criarMapaPelaInterface, documento, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

/**
 * A neblina e as bordas são do mundo: com zoom ou arrasto o mesmo pedaço de terreno mostra o mesmo padrão, só ampliado ou deslocado.
 * (Antes o ruído era medido no quadro recortado do filtro e ficava preso à tela.) O tempo corre durante o teste, mas o ruído anda
 * menos de 0,03 unidade por segundo; com movimento reduzido a deriva entre duas capturas é desprezível.
 */
let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

type Cam = { x: number; y: number; zoom: number };
const comando = (p: Page, c: unknown) => p.evaluate(`window.__atlas.sessao().store.executar(${JSON.stringify(c)})`);
const camera = (p: Page): Promise<Cam> => p.evaluate(() => { const c = (window as unknown as { __atlas: { viewport(): { camera: Cam } } }).__atlas.viewport().camera; return { x: c.x, y: c.y, zoom: c.zoom }; });
const definir = async (p: Page, c: Cam) => { await p.evaluate(`window.__atlas.viewport().definirCamera(${JSON.stringify(c)})`); await p.waitForTimeout(500); };
type Caixa = { x: number; y: number; width: number; height: number };
/** Recorte da tela que cobre a caixa de mundo `[x0, y0, x1, y1]`. */
async function recorte(p: Page, caixa: [number, number, number, number]): Promise<Buffer> {
  const a = await clientDe(p, [caixa[0], caixa[1]]), b = await clientDe(p, [caixa[2], caixa[3]]);
  const c: Caixa = { x: Math.round(Math.min(a[0], b[0])), y: Math.round(Math.min(a[1], b[1])), width: Math.round(Math.abs(b[0] - a[0])), height: Math.round(Math.abs(b[1] - a[1])) };
  return p.screenshot({ clip: c });
}
/** Correlação (Pearson) da luminância de dois recortes reamostrados para 96 × 96. */
const correlacao = (p: Page, a: Buffer, b: Buffer): Promise<number> => p.evaluate(async ([a64, b64]) => {
  const ler = async (s: string) => {
    const img = new Image(); img.src = `data:image/png;base64,${s}`; await img.decode();
    const c = document.createElement('canvas'); c.width = 96; c.height = 96; const g = c.getContext('2d', { willReadFrequently: true })!; g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, 96, 96);
    const d = g.getImageData(0, 0, 96, 96).data, l: number[] = []; for (let i = 0; i < d.length; i += 4) l.push(0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!); return l;
  };
  const A = await ler(a64!), B = await ler(b64!), n = A.length, ma = A.reduce((s, v) => s + v, 0) / n, mb = B.reduce((s, v) => s + v, 0) / n;
  let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { const x = A[i]! - ma, y = B[i]! - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return sab / Math.sqrt(saa * sbb || 1);
}, [a.toString('base64'), b.toString('base64')] as const);

/** Mapa de piso liso (só o véu dá textura), com `ajuste` aplicado; câmera enquadrada. */
async function preparar(ajuste: unknown[]) {
  const ctx = await novoContexto(amb, { reducedMotion: 'reduce' }), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  await comando(page, { tipo: 'terreno.base', material: 'pedra.escura' });
  for (const c of ajuste) await comando(page, c);
  await page.waitForTimeout(2500);
  return { ctx, page, erros };
}

/** Três pontos de vista da mesma caixa de mundo: enquadrado, ampliado 2 × com a caixa no centro e arrastado (mapa parcialmente fora). */
async function medir(p: Page, caixa: [number, number, number, number], nome: string, arrasto: [number, number]) {
  mkdirSync('test-results', { recursive: true });
  await p.evaluate('window.__atlas.viewport().enquadrar()'); await p.waitForTimeout(600);
  const base = await camera(p), inteiro = await recorte(p, caixa), repetido = await recorte(p, caixa);
  await p.screenshot({ path: `test-results/${nome}-1-inteiro.png` });
  // Ampliado: o centro da caixa vai para o centro da tela, com o dobro do zoom.
  const t = await p.evaluate(() => { const v = (window as unknown as { __atlas: { viewport(): { tela: { largura: number; altura: number } } } }).__atlas.viewport(); return v.tela; });
  const cx = (caixa[0] + caixa[2]) / 2, cy = (caixa[1] + caixa[3]) / 2, z2 = base.zoom * 2;
  await definir(p, { zoom: z2, x: t.largura / 2 - cx * z2, y: t.altura / 2 - cy * z2 });
  const ampliado = await recorte(p, caixa); await p.screenshot({ path: `test-results/${nome}-2-ampliado.png` });
  // Arrastado: mesmo zoom do enquadre, deslocado (parte do mapa sai da tela).
  await definir(p, { zoom: base.zoom, x: base.x + arrasto[0], y: base.y + arrasto[1] });
  const arrastado = await recorte(p, caixa); await p.screenshot({ path: `test-results/${nome}-3-arrastado.png` });
  const mundoAmpliado = await correlacao(p, inteiro, ampliado), mundoArrastado = await correlacao(p, inteiro, arrastado);
  // Controle: a mesma região DA TELA (e não do mundo) no enquadre e no ampliado deve diferir se o padrão é do mundo.
  await p.evaluate('window.__atlas.viewport().enquadrar()'); await p.waitForTimeout(600);
  const [sa, sb] = [await clientDe(p, [caixa[0], caixa[1]]), await clientDe(p, [caixa[2], caixa[3]])];
  const mesmaTela = await p.screenshot({ clip: { x: Math.round(sa[0]), y: Math.round(sa[1]), width: Math.round(sb[0] - sa[0]), height: Math.round(sb[1] - sa[1]) } });
  await definir(p, { zoom: z2, x: t.largura / 2 - cx * z2, y: t.altura / 2 - cy * z2 });
  const telaAmpliada = await p.screenshot({ clip: { x: Math.round(sa[0]), y: Math.round(sa[1]), width: Math.round(sb[0] - sa[0]), height: Math.round(sb[1] - sa[1]) } });
  const controle = await correlacao(p, mesmaTela, telaAmpliada);
  const piso = await correlacao(p, inteiro, repetido);
  console.log(`${nome}: repetição ${piso.toFixed(2)}, mundo ampliado ${mundoAmpliado.toFixed(2)}, mundo arrastado ${mundoArrastado.toFixed(2)}, mesma região de tela ${controle.toFixed(2)}`);
  return { mundoAmpliado, mundoArrastado, controle };
}

test('a neblina do clima é do mundo: zoom e arrasto não a prendem à tela', async () => {
  const { ctx, page, erros } = await preparar([{ tipo: 'clima.aplicar', patch: { weather: { fog: 1 } } }]);
  const m = await documento(page), { width: w, height: h } = m.bounds;
  const r = await medir(page, [w * 0.35, h * 0.35, w * 0.65, h * 0.65], 'neblina-de-mundo', [-120, -70]);
  assert.ok(r.mundoAmpliado > 0.9, `o mesmo terreno ampliado tem o mesmo padrão (${r.mundoAmpliado.toFixed(2)})`);
  assert.ok(r.mundoArrastado > 0.9, `o mesmo terreno arrastado tem o mesmo padrão (${r.mundoArrastado.toFixed(2)})`);
  assert.ok(r.mundoAmpliado > r.controle + 0.1, 'a mesma região da tela, ampliada, mostra outro padrão');
  assert.deepEqual(erros, []); await ctx.close();
});

for (const kind of ['clouds', 'fog'] as const) {
  test(`as bordas (${kind}) ficam presas à borda do mapa com zoom e arrasto`, async () => {
    const { ctx, page, erros } = await preparar([{ tipo: 'acabamento.atualizar', patch: { edges: { kind, amount: 0.7 } } }]);
    const m = await documento(page), { width: w, height: h } = m.bounds;
    // O canto de cima à esquerda: é onde a faixa de borda encontra a beirada do mapa.
    const r = await medir(page, [0, 0, w * 0.3, h * 0.3], `bordas-${kind}`, [90, 60]);
    assert.ok(r.mundoAmpliado > 0.9, `a borda ampliada acompanha o canto (${r.mundoAmpliado.toFixed(2)})`);
    assert.ok(r.mundoArrastado > 0.9, `a borda arrastada acompanha o canto (${r.mundoArrastado.toFixed(2)})`);
    assert.deepEqual(erros, []); await ctx.close();
  });
}
