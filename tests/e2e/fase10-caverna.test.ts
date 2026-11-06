import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

type Item = { tipo: 'gerado'; gerador: string; params: Record<string, unknown>; seed: number } | { tipo: 'objeto'; receita: string; params: Record<string, unknown>; seed: number };
const o = (receita: string, params: Record<string, unknown>, seed: number, x: number, y: number): [Item, number, number] => [{ tipo: 'objeto', receita, params, seed }, x, y];
const ITENS: [Item, number, number][] = [
  o('ossada', {}, 1, 3, 2.5), o('ossada', {}, 2, 6.5, 2.5), o('cranio-animal', {}, 3, 9.5, 2.5), o('cranio-animal', { chifres: 1 }, 4, 11, 2.5),
  o('pilha-de-ossos', {}, 5, 14, 2.5), o('pilha-de-peles', {}, 6, 18, 2.5), o('buraco', { largura: 2 }, 7, 22.5, 2.5),
  o('estalagmite', { tamanho: 0.5 }, 8, 3, 7), o('estalagmite', { tamanho: 0.8 }, 9, 4.5, 7), o('estalagmite', {}, 10, 5.8, 7), o('arvore-morta-caida', {}, 11, 11, 7), o('buraco', { largura: 1 }, 12, 16, 7),
];

test('10.5e: captura da caverna sobre rocha rachada, com pouca luz (Ilustrado e Pixel)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async ([itens]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const W = 28, H = 10, AGUA: number[][] = [], saida: string[] = [], opacos: number[] = [];
    for (const estilo of ['illustrated', 'pixel'] as const) {
      const res = estilo === 'pixel' ? 16 / 1.5 : 40, fator = estilo === 'pixel' ? 4 : 1, tela = document.createElement('canvas'); tela.width = Math.round(W * res); tela.height = Math.round(H * res);
      const g = tela.getContext('2d')!; g.imageSmoothingEnabled = estilo !== 'pixel';
      const chao = await executarBake({ tipo: 'terreno', entrada: { largura: W, altura: H, resolucao: 0.75, base: 'rocha.rachada', camadas: [] }, res, estilo });
      g.drawImage(chao.bitmap, 0, 0, tela.width, tela.height); g.save();
      let n = 0;
      for (const [item, x, y] of itens) {
        const b = await executarBake({ ...item, res, estilo }), dx = (x + b.origem[0]) * res, dy = (y + b.origem[1]) * res;
        g.drawImage(b.bitmap, dx, dy, b.bitmap.width, b.bitmap.height);
        const t = document.createElement('canvas'); t.width = b.bitmap.width; t.height = b.bitmap.height; const c = t.getContext('2d', { willReadFrequently: true })!; c.drawImage(b.bitmap, 0, 0);
        const d = c.getImageData(0, 0, t.width, t.height).data; let o = 0; for (let k = 3; k < d.length; k += 4) if (d[k]! > 128) o++; opacos.push(o); n++;
      }
      g.restore(); g.fillStyle = 'rgba(8,10,20,0.42)'; g.globalCompositeOperation = 'multiply'; g.fillRect(0, 0, tela.width, tela.height); g.globalCompositeOperation = 'source-over';
      const grande = document.createElement('canvas'); grande.width = tela.width * fator; grande.height = tela.height * fator; const gg = grande.getContext('2d')!; gg.imageSmoothingEnabled = false; gg.drawImage(tela, 0, 0, grande.width, grande.height);
      saida.push(grande.toDataURL('image/png'));
    }
    return { png: saida, opacos };
  }, [ITENS] as const);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fase10-caverna.png', Buffer.from(r.png[0]!.split(',')[1]!, 'base64')); writeFileSync('test-results/fase10-caverna-pixel.png', Buffer.from(r.png[1]!.split(',')[1]!, 'base64'));
  r.opacos.forEach((o, i) => assert.ok(o > 3, `item ${i}: ${o} pixels opacos`));
  assert.deepEqual(erros, []); await ctx.close();
});
