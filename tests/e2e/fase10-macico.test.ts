import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

const RES_PIXEL = 16 / 1.5;

test('10.2a: maciço de rocha com volume (anel de caverna, rocha nevada, arenito) no Ilustrado e no Pixel', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async (resPixel) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const L = 18, A = 13, CEL = 0.5, nx = L / CEL, ny = A / CEL;
    type Faixa = [number, number, number];
    const faixas = (dentro: (x: number, y: number) => boolean): Faixa[] => {
      const f: Faixa[] = [];
      for (let y = 0; y < ny; y++) { let ini = -1; for (let x = 0; x <= nx; x++) { const d = x < nx && dentro((x + 0.5) * CEL, (y + 0.5) * CEL); if (d && ini < 0) ini = x; if (!d && ini >= 0) { f.push([y, ini, x - ini]); ini = -1; } } }
      return f;
    };
    const ond = (x: number, y: number, k: number) => Math.sin(x * 1.3 + k) * 0.5 + Math.sin(y * 1.7 + k * 2) * 0.4 + Math.sin((x + y) * 0.9 + k * 3) * 0.3;
    // (a) anel de rocha.caverna em volta de rocha.rachada, vazio além.
    const furo = (x: number, y: number) => ((x - L / 2) / 5.8) ** 2 + ((y - A / 2) / 3.6) ** 2 + ond(x, y, 1) * 0.07 < 1;
    const fora = (x: number, y: number) => (Math.abs(x - L / 2) / (L / 2 - 0.4)) ** 4 + (Math.abs(y - A / 2) / (A / 2 - 0.4)) ** 4 + ond(x, y, 5) * 0.06 < 1;
    const cena = [
      { base: 'vazio', camadas: [{ material: 'rocha.rachada', celulas: faixas((x, y) => ((x - L / 2) / 6.6) ** 2 + ((y - A / 2) / 4.4) ** 2 < 1) }, { material: 'rocha.caverna', celulas: faixas((x, y) => fora(x, y) && !furo(x, y)) }] },
      { base: 'neve.funda', camadas: [{ material: 'rocha.nevada', celulas: faixas((x, y) => ((x - 6) / 4.6) ** 2 + ((y - 6.5) / 4.8) ** 2 + ond(x, y, 2) * 0.22 < 1 || ((x - 12.5) / 3.2) ** 2 + ((y - 4) / 2.2) ** 2 + ond(x, y, 7) * 0.2 < 1) }] },
      { base: 'grama', camadas: [{ material: 'rocha.arenito', celulas: faixas((x, y) => Math.abs(y - (6.5 + Math.sin(x * 0.45) * 2.2)) < 2.3 + ond(x, y, 3) * 0.25 || ((x - 14) / 2.6) ** 2 + ((y - 10.5) / 1.7) ** 2 < 1) }] },
    ];
    const largura = 960, alt = Math.round(largura * A / L), tela = document.createElement('canvas'); tela.width = 3 * (largura + 8) + 8; tela.height = 2 * (alt + 8) + 8;
    const g = tela.getContext('2d')!; g.fillStyle = '#000'; g.fillRect(0, 0, tela.width, tela.height);
    const tempos: number[] = [], cores: number[] = [], unicos: Record<string, number> = {}, partes: string[] = [];
    for (let l = 0; l < 2; l++) for (let i = 0; i < 3; i++) {
      const estilo = l ? 'pixel' : 'illustrated', res = l ? resPixel : 48, t0 = performance.now();
      const bake = await executarBake({ tipo: 'terreno', entrada: { largura: L, altura: A, resolucao: CEL, base: cena[i]!.base, camadas: cena[i]!.camadas }, res, estilo });
      tempos.push(Math.round(performance.now() - t0));
      g.imageSmoothingEnabled = !l; g.drawImage(bake.bitmap, 0, 0, bake.bitmap.width, bake.bitmap.height, 8 + i * (largura + 8), 8 + l * (alt + 8), largura, alt);
      const um = document.createElement('canvas'); um.width = bake.bitmap.width; um.height = bake.bitmap.height; um.getContext('2d')!.drawImage(bake.bitmap, 0, 0); partes.push(um.toDataURL('image/png'));
      if (l) { const c = um.getContext('2d', { willReadFrequently: true })!, d = c.getImageData(0, 0, um.width, um.height).data, set = new Set<string>(); for (let k = 0; k < d.length; k += 4) if (d[k + 3]) set.add(`${d[k]},${d[k + 1]},${d[k + 2]}`); cores.push(set.size); unicos[i] = set.size; }
    }
    return { png: tela.toDataURL('image/png'), tempos, cores, partes };
  }, RES_PIXEL);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fase10-macico.png', Buffer.from(r.png.split(',')[1]!, 'base64'));
  console.log('macico: tempos (ms)', r.tempos.join(' '), '| cores no Pixel', r.cores.join(' '));
  r.partes.forEach((p, i) => writeFileSync(`test-results/fase10-macico-${i < 3 ? 'ilu' : 'pix'}${i % 3}.png`, Buffer.from(p.split(',')[1]!, 'base64')));
  for (const n of r.cores) assert.ok(n >= 3 && n <= 60, `cores no Pixel: ${n}`);
  assert.deepEqual(erros, []); await ctx.close();
});
