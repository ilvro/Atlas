import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { atividade, desfazerChamada, limparAtividade, podeDesfazerChamada, MAX_CHAMADAS, registrarChamada } from '../../src/app/atividade-do-assistente.ts';
import { ferramentasDeEscrita, type ContextoDeEscrita } from '../../src/app/ponte-escrita.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';

function montar() {
  const store = criarStore(criarMapa({ id: 'teste', nome: 'Teste', agora: 1, largura: 30, altura: 20 }));
  const ctx: ContextoDeEscrita = { store: () => store, repo: () => ({ salvar: async m => m }), abrirMapa: async () => {} };
  const f = Object.fromEntries(ferramentasDeEscrita(ctx).map(x => [x.nome, x]));
  return { store, f, executar: (nome: string, args: Record<string, unknown>) => f[nome]!.executar(args) };
}

beforeEach(() => { limparAtividade(); });


test('a lista registra sucesso e erro, da mais nova para a mais velha, até 100', async () => {
  const { executar } = montar();
  await executar('atlas_notas', { mapa: 'oi' });
  await assert.rejects(executar('atlas_remover', { ids: ['nao-existe'] }), /Não existe/);
  const [novo, velho] = atividade.value;
  assert.equal(novo!.ok, false);
  assert.match(novo!.erro!, /nao-existe/);
  assert.ok(velho);
  for (let i = 0; i < 120; i++) registrarChamada({ rotulo: `x${i}`, ids: [], ok: true });
  assert.equal(atividade.value.length, MAX_CHAMADAS);
  assert.equal(atividade.value[0]!.rotulo, 'x119');
});

test('Desfazer só vale na chamada mais recente e enquanto ela é o topo do histórico', async () => {
  const { store, executar } = montar();
  await executar('atlas_notas', { mapa: 'primeira' });
  await executar('atlas_notas', { mapa: 'segunda' });
  const [segunda, primeira] = atividade.value;
  assert.ok(segunda!.ref && primeira!.ref);
  assert.equal(podeDesfazerChamada(primeira!, store), false);
  assert.equal(podeDesfazerChamada(segunda!, store), true);
  store.executar({ tipo: 'mapa.renomear', nome: 'Outro' });
  assert.equal(podeDesfazerChamada(segunda!, store), false);
  store.desfazer();
  assert.equal(podeDesfazerChamada(segunda!, store), false, 'depois de desfazer a edição do mestre a versão mudou: conservador');
  assert.equal(desfazerChamada(segunda!, store), false);
});

test('desfazer a chamada no topo desfaz a transação inteira', async () => {
  const { store, executar } = montar();
  const antes = store.documento.notes;
  await executar('atlas_notas', { mapa: 'nova nota' });
  const c = atividade.value[0]!;
  assert.equal(desfazerChamada(c, store), true);
  assert.equal(store.documento.notes, antes);
});

test('remover age direto, sem pedir confirmação, mesmo sobre o que não foi criado nesta aba', async () => {
  const { store, executar } = montar();
  await executar('atlas_comodos', { comodos: [{ rets: [[1, 1, 4, 4]], tipo: 'sala', nome: 'Salão' }] });
  const id = Object.keys(store.documento.rooms)[0]!;
  const r = (await executar('atlas_remover', { ids: [id] }))[0]!;
  assert.match((r as { texto: string }).texto, /Removido: 1 cômodo \(“Salão”\)/);
  assert.equal(Object.keys(store.documento.rooms).length, 0);
  assert.equal(atividade.value[0]!.rotulo, 'remover');
  assert.equal(atividade.value[0]!.ok, true);
});

test('mover: age direto, cômodo não se move, delta inválido é recusado', async () => {
  const { store, executar } = montar();
  await executar('atlas_luzes', { luzes: [{ preset: 'vela', pos: [5, 5] }] });
  const id = Object.keys(store.documento.lights)[0]!;
  await executar('atlas_mover', { ids: [id], delta: [2, 1] });
  assert.deepEqual(store.documento.lights[id]!.position, [7, 6]);
  await executar('atlas_comodos', { comodos: [{ rets: [[1, 1, 4, 4]], tipo: 'sala', nome: 'Salão' }] });
  const sala = Object.keys(store.documento.rooms)[0]!;
  await assert.rejects(executar('atlas_mover', { ids: [sala], delta: [1, 1] }), /só objetos, luzes/);
  await assert.rejects(executar('atlas_mover', { ids: [id], delta: [1] }), /delta/);
});
