import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMapa } from '../../src/domain/mapa.ts';
import { abrir, criarMapaPelaInterface, encerrar, iniciarAmbiente, novoContexto, type Ambiente } from './apoio.ts';

let amb: Ambiente;
before(async () => { amb = await iniciarAmbiente(); });
after(async () => { await encerrar(amb); });

test('o "+" da barra de abas lista mapas gravados fora desta aba, sem recarregar', async () => {
  const ctx = await novoContexto(amb), { page, erros } = await abrir(ctx, amb.url);
  await criarMapaPelaInterface(page);
  const externo = criarMapa({ nome: 'Mapa Externo', largura: 20, altura: 15 });
  // Grava direto no repositório (como o assistente ou outra instância do Atlas fazem), sem passar pela lista do app.
  await page.evaluate(async m => { await (window as unknown as { __atlas: { servicos(): { repo: { salvar(m: unknown, o: unknown): Promise<unknown> } } } }).__atlas.servicos().repo.salvar(m, { forcar: true }); }, externo);
  await page.click('[data-testid="abrir-nova-aba"]');
  await page.waitForSelector('.item-mapa-aba:has-text("Mapa Externo")', { timeout: 5000 });
  assert.equal(await page.locator('.item-mapa-aba', { hasText: 'Mapa Externo' }).count(), 1);
  assert.deepEqual(erros, []); await ctx.close();
});
