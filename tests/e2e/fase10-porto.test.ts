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
  o('navio', { comprimento: 22, mastros: 3 }, 1, 12, 3.5), o('barcaca', {}, 2, 24, 3),
  o('cais-segmento', { comprimento: 10, largura: 2.5 }, 3, 8, 8.5), o('estaca', {}, 4, 2.4, 8.5), o('estaca', {}, 5, 13.6, 8.5), o('guindaste-de-cais', {}, 6, 18, 8.5),
  o('barraca-de-feira', { paleta: 0 }, 7, 3, 13), o('barraca-de-feira', { paleta: 1 }, 8, 7, 13), o('barraca-de-feira', { paleta: 3 }, 9, 11, 13),
  o('caixote', {}, 10, 15, 13), o('pilha-de-caixotes', {}, 11, 17.5, 13), o('barril', {}, 12, 20, 12.5), o('pilha-de-barris', {}, 13, 22, 13), o('sacos', {}, 14, 24.5, 12.8),
  o('rede-de-pesca', {}, 15, 3, 16.5), o('ancora', {}, 16, 6, 16.5), o('rolo-de-corda', {}, 17, 8, 16.5), o('lanterna-de-poste', {}, 18, 10, 16.5),
];

test('10.5c: captura do porto sobre areia e água (Ilustrado e Pixel)', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  const r = await page.evaluate(async ([itens]) => {
    const caminho = '/src/procedural/executar.ts', { executarBake } = await import(/* @vite-ignore */ caminho);
    const W = 28, H = 18, AGUA = Array.from({ length: 10 }, (_, y) => [y, 0, 37]), saida: string[] = [], opacos: number[] = [];
    for (const estilo of ['illustrated', 'pixel'] as const) {
      const res = estilo === 'pixel' ? 16 / 1.5 : 40, fator = estilo === 'pixel' ? 4 : 1, tela = document.createElement('canvas'); tela.width = Math.round(W * res); tela.height = Math.round(H * res);
      const g = tela.getContext('2d')!; g.imageSmoothingEnabled = estilo !== 'pixel';
      const chao = await executarBake({ tipo: 'terreno', entrada: { largura: W, altura: H, resolucao: 0.75, base: 'areia', camadas: [{ material: 'agua.mar', celulas: AGUA }] }, res, estilo });
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
  writeFileSync('test-results/fase10-porto.png', Buffer.from(r.png[0]!.split(',')[1]!, 'base64')); writeFileSync('test-results/fase10-porto-pixel.png', Buffer.from(r.png[1]!.split(',')[1]!, 'base64'));
  r.opacos.forEach((o, i) => assert.ok(o > 3, `item ${i}: ${o} pixels opacos`));
  assert.deepEqual(erros, []); await ctx.close();
});
