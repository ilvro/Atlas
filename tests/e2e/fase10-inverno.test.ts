import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

type Item = { tipo: 'gerado'; gerador: string; params: Record<string, unknown>; seed: number } | { tipo: 'objeto'; receita: string; params: Record<string, unknown>; seed: number };
const ITENS: [Item, number, number][] = [
  [{ tipo: 'gerado', gerador: 'arvore-nevada', params: { diametro: 5 }, seed: 62 }, 3, 3], [{ tipo: 'gerado', gerador: 'arvore-nevada', params: { diametro: 3 }, seed: 61 }, 7.5, 2],
  [{ tipo: 'gerado', gerador: 'pinheiro-nevado', params: { diametro: 4.5 }, seed: 72 }, 11, 3.2], [{ tipo: 'gerado', gerador: 'pinheiro-nevado', params: { diametro: 3 }, seed: 71 }, 14.5, 2.2],
  [{ tipo: 'gerado', gerador: 'arbusto-seco', params: { diametro: 2, neve: true }, seed: 83 }, 18, 2], [{ tipo: 'gerado', gerador: 'arbusto-seco', params: { diametro: 2 }, seed: 82 }, 21, 2],
  [{ tipo: 'objeto', receita: 'rochedo', params: { tamanho: 4, cobertura: 0 }, seed: 5 }, 3, 7.5], [{ tipo: 'objeto', receita: 'rochedo', params: { tamanho: 3, cobertura: 1 }, seed: 6 }, 8, 7.5],
  [{ tipo: 'objeto', receita: 'rochedo', params: { tamanho: 3, cobertura: 2 }, seed: 7 }, 12.5, 7.5], [{ tipo: 'objeto', receita: 'seixos', params: {}, seed: 3 }, 16, 7.5],
  [{ tipo: 'objeto', receita: 'galho-seco', params: {}, seed: 4 }, 19, 7.5], [{ tipo: 'objeto', receita: 'treno', params: {}, seed: 1 }, 22, 7.5],
];

test('10.5a: captura dos objetos de inverno e rocha sobre neve funda (Ilustrado e Pixel)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async ([itens]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const W = 24, H = 10, saida: string[] = [], opacos: number[] = [];
    for (const estilo of ['illustrated', 'pixel'] as const) {
      const res = estilo === 'pixel' ? 16 / 1.5 : 40, fator = estilo === 'pixel' ? 4 : 1, tela = document.createElement('canvas'); tela.width = Math.round(W * res); tela.height = Math.round(H * res);
      const g = tela.getContext('2d')!; g.imageSmoothingEnabled = estilo !== 'pixel';
      const chao = await executarBake({ tipo: 'terreno', entrada: { largura: W, altura: H, resolucao: 0.75, base: 'neve.funda', camadas: [] }, res, estilo });
      g.drawImage(chao.bitmap, 0, 0, tela.width, tela.height);
      let n = 0;
      for (const [item, x, y] of itens) {
        const b = await executarBake({ ...item, res, estilo }), dx = (x + b.origem[0]) * res, dy = (y + b.origem[1]) * res;
        g.drawImage(b.bitmap, dx, dy, b.bitmap.width, b.bitmap.height);
        const t = document.createElement('canvas'); t.width = b.bitmap.width; t.height = b.bitmap.height; const c = t.getContext('2d', { willReadFrequently: true })!; c.drawImage(b.bitmap, 0, 0);
        const d = c.getImageData(0, 0, t.width, t.height).data; let o = 0; for (let k = 3; k < d.length; k += 4) if (d[k]! > 128) o++; opacos.push(o); n++;
      }
      const grande = document.createElement('canvas'); grande.width = tela.width * fator; grande.height = tela.height * fator; const gg = grande.getContext('2d')!; gg.imageSmoothingEnabled = false; gg.drawImage(tela, 0, 0, grande.width, grande.height);
      saida.push(grande.toDataURL('image/png'));
    }
    return { png: saida, opacos };
  }, [ITENS] as const);
  mkdirSync('test-results', { recursive: true });
  writeFileSync('test-results/fase10-inverno.png', Buffer.from(r.png[0]!.split(',')[1]!, 'base64')); writeFileSync('test-results/fase10-inverno-pixel.png', Buffer.from(r.png[1]!.split(',')[1]!, 'base64'));
  r.opacos.forEach((o, i) => assert.ok(o > 3, `item ${i}: ${o} pixels opacos`));
  assert.deepEqual(erros, []); await ctx.close();
});
