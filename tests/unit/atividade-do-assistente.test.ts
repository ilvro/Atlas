import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';
import { atividade, desfazerChamada, limparAtividade, pedidos, pedirConfirmacao, podeDesfazerChamada, MAX_CHAMADAS, registrarChamada } from '../../src/app/atividade-do-assistente.ts';
import { criadosPeloAssistente, ferramentasDeEscrita, type ContextoDeEscrita } from '../../src/app/ponte-escrita.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { criarStore } from '../../src/state/store.ts';

type Resposta = 'permitir' | 'recusar' | 'sem-resposta';

function montar(confirmar?: ContextoDeEscrita['confirmar']) {
  const store = criarStore(criarMapa({ id: 'teste', nome: 'Teste', agora: 1, largura: 30, altura: 20 }));
  const ctx: ContextoDeEscrita = { store: () => store, repo: () => ({ salvar: async m => m }), abrirMapa: async () => {}, confirmar };
  const f = Object.fromEntries(ferramentasDeEscrita(ctx).map(x => [x.nome, x]));
  return { store, f, executar: (nome: string, args: Record<string, unknown>) => f[nome]!.executar(args) };
}

beforeEach(() => { limparAtividade(); criadosPeloAssistente.clear(); });


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

test('o que o assistente criou é removido direto', async () => {
  const { store, executar } = montar(async () => { throw new Error('não devia pedir'); });
  await executar('atlas_comodos', { comodos: [{ rets: [[1, 1, 4, 4]], tipo: 'sala', nome: 'Salão' }] });
  const id = Object.keys(store.documento.rooms)[0]!;
  assert.ok(criadosPeloAssistente.has(id));
  await executar('atlas_remover', { ids: [id] });
  assert.equal(Object.keys(store.documento.rooms).length, 0);
  assert.equal(atividade.value[0]!.rotulo, 'remover');
  assert.equal(atividade.value[0]!.ok, true);
});

test('remover algo do mestre fica pendente até a resposta; permitir remove, recusar vira erro', async () => {
  let responder!: (r: Resposta) => void, pedido = '';
  const { store, executar } = montar(d => { pedido = d; return new Promise<Resposta>(r => { responder = r; }); });
  await executar('atlas_comodos', { comodos: [{ rets: [[1, 1, 4, 4]], tipo: 'sala', nome: 'Salão' }] });
  const id = Object.keys(store.documento.rooms)[0]!;
  criadosPeloAssistente.delete(id);            // agora é "do mestre"
  const p = executar('atlas_remover', { ids: [id] });
  await new Promise(r => setTimeout(r, 5));
  assert.match(pedido, /Remover 1 cômodo/);
  assert.match(pedido, /Salão/);
  assert.equal(Object.keys(store.documento.rooms).length, 1, 'nada some antes da resposta');
  responder('recusar');
  await assert.rejects(p, /o mestre recusou/);
  assert.equal(Object.keys(store.documento.rooms).length, 1);
  assert.equal(atividade.value[0]!.ok, false);
  assert.equal(atividade.value[0]!.erro, 'o mestre recusou');

  const p2 = executar('atlas_remover', { ids: [id] });
  await new Promise(r => setTimeout(r, 5));
  responder('permitir');
  await p2;
  assert.equal(Object.keys(store.documento.rooms).length, 0);
});

test('sem resposta do mestre a ferramenta volta com erro', async () => {
  const { store, executar } = montar(async () => 'sem-resposta');
  await executar('atlas_comodos', { comodos: [{ rets: [[1, 1, 4, 4]], tipo: 'sala', nome: 'Salão' }] });
  const id = Object.keys(store.documento.rooms)[0]!;
  criadosPeloAssistente.delete(id);
  await assert.rejects(executar('atlas_remover', { ids: [id] }), /o mestre não respondeu/);
});

test('mover: do assistente direto, cômodo não se move, delta inválido é recusado', async () => {
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

test('pedirConfirmacao entra em `pedidos`, responde e expira', async () => {
  const p = pedirConfirmacao('Remover algo');
  assert.equal(pedidos.value.length, 1);
  pedidos.value[0]!.responder('permitir');
  assert.equal(await p, 'permitir');
  assert.equal(pedidos.value.length, 0);
  assert.equal(await pedirConfirmacao('de novo', 5), 'sem-resposta');
  assert.equal(pedidos.value.length, 0);
});
