import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { abrir, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

type Item = { tipo: 'gerado'; gerador: string; params: Record<string, unknown>; seed: number } | { tipo: 'objeto'; receita: string; params: Record<string, unknown>; seed: number };
const g = (gerador: string, diametro: number, seed: number, x: number, y: number): [Item, number, number] => [{ tipo: 'gerado', gerador, params: { diametro }, seed }, x, y];
const o = (receita: string, params: Record<string, unknown>, seed: number, x: number, y: number): [Item, number, number] => [{ tipo: 'objeto', receita, params, seed }, x, y];
const ITENS: [Item, number, number][] = [
  g('carvalho-grande', 8, 93, 4, 4.5), g('carvalho-grande', 6, 91, 12, 3.5), g('folhagem-tropical', 2.4, 102, 17, 2.5), g('folhagem-tropical', 1.6, 101, 20.5, 2.2),
  o('tufo-de-grama', {}, 1, 16.5, 6), o('junco', {}, 2, 18, 6), o('vitoria-regia', { flor: 1 }, 3, 20, 5.5), o('raiz-exposta', {}, 4, 22, 8),
  o('mureta-de-pedra', { largura: 5 }, 5, 2, 11.5), o('coluna-arruinada', {}, 6, 9, 11), o('coluna-caida', {}, 7, 11, 11.5), o('circulo-runico', { raio: 2 }, 8, 15, 10),
  o('escombros', {}, 9, 20, 11), o('viga-partida', {}, 10, 3, 14.5), o('tabua-solta', {}, 11, 8, 14.5),
];

test('10.5b: captura da mata e da ruína sobre grama (Ilustrado e Pixel)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async ([itens]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const W = 26, H = 17, saida: string[] = [], opacos: number[] = [];
    for (const estilo of ['illustrated', 'pixel'] as const) {
      const res = estilo === 'pixel' ? 16 / 1.5 : 40, fator = estilo === 'pixel' ? 4 : 1, tela = document.createElement('canvas'); tela.width = Math.round(W * res); tela.height = Math.round(H * res);
      const g = tela.getContext('2d')!; g.imageSmoothingEnabled = estilo !== 'pixel';
      const chao = await executarBake({ tipo: 'terreno', entrada: { largura: W, altura: H, resolucao: 0.75, base: 'grama', camadas: [] }, res, estilo });
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
  writeFileSync('test-results/fase10-mata.png', Buffer.from(r.png[0]!.split(',')[1]!, 'base64')); writeFileSync('test-results/fase10-mata-pixel.png', Buffer.from(r.png[1]!.split(',')[1]!, 'base64'));
  r.opacos.forEach((o, i) => assert.ok(o > 3, `item ${i}: ${o} pixels opacos`));
  assert.deepEqual(erros, []); await ctx.close();
});
