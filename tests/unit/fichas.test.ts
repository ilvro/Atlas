import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaveDaRef, criarBarramento, criarRef, type CanalLike, type Entidade } from '#mesa';
import { emEstadoCritico, fracao, interpretarAjusteDeRecurso, pipsCheios, recursosParaOProjetor, refDaFicha, temPd, textoDeRecursos, tomDaRolagem, type Recursos } from '../../src/domain/fichas.ts';
import { signal } from '@preact/signals';
import { adicionarPersonagem, ajustarRecursos, ameacasComFicha, iniciarFichas, aoRolar, pecaDaFicha, personagensComFicha, recursosDaPeca, recursosDasFichas } from '../../src/app/fichas.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';

/** Um par de canais ligados: o que um posta, o outro recebe (como duas abas). */
function parDeCanais(): [() => CanalLike, () => CanalLike] {
  const a: CanalLike = { postMessage: m => queueMicrotask(() => b.onmessage?.({ data: m })), onmessage: null, close() {} };
  const b: CanalLike = { postMessage: m => queueMicrotask(() => a.onmessage?.({ data: m })), onmessage: null, close() {} };
  return [() => a, () => b];
}
const ficha = criarRef('ficha', 'ficha', 'sheet-1');
const esperar = () => new Promise(r => setTimeout(r, 5));

test('domínio: pips, fração, estado crítico e a ficha de uma lista de refs', () => {
  assert.equal(pipsCheios(20, 20), 10); assert.equal(pipsCheios(10, 20), 5); assert.equal(pipsCheios(1, 20), 1, 'qualquer vida acende um pip'); assert.equal(pipsCheios(0, 20), 0); assert.equal(pipsCheios(5, 0), 0);
  assert.equal(fracao(5, 0), 0); assert.equal(fracao(30, 20), 1);
  assert.equal(emEstadoCritico({ pv: 5, pvMax: 20 }), true, '25% é crítico'); assert.equal(emEstadoCritico({ pv: 6, pvMax: 20 }), false); assert.equal(emEstadoCritico({ pv: 0, pvMax: 0 }), false);
  assert.equal(refDaFicha([criarRef('atlas', 'mapa', 'm'), ficha]), ficha); assert.equal(refDaFicha([criarRef('atlas', 'mapa', 'm')]), null);
  assert.equal(tomDaRolagem(20), 'alto'); assert.equal(tomDaRolagem(1), 'baixo'); assert.equal(tomDaRolagem(12), 'normal'); assert.equal(tomDaRolagem(24, 5), 'alto', 'o modificador não conta');
});

test('iniciarFichas: ficha.recursos chega pelo barramento e fica por Ref; ficha.rolagem avisa os ouvintes; ao parar, nada mais chega', async () => {
  const [daFicha, doAtlas] = parDeCanais();
  const bFicha = criarBarramento({ app: 'ficha', criarCanal: daFicha }), bAtlas = criarBarramento({ app: 'atlas', criarCanal: doAtlas });
  recursosDasFichas.value = {};
  const parar = iniciarFichas(bAtlas), rolagens: unknown[] = [], cancelar = aoRolar(r => rolagens.push(r));
  bFicha.emitir('ficha.recursos', { ficha, pv: 12, pvMax: 20, pd: 8, pdMax: 10 }); await esperar();
  assert.deepEqual(recursosDasFichas.value[chaveDaRef(ficha)], { pv: 12, pvMax: 20, pd: 8, pdMax: 10 });
  const peca = novaPeca([1, 1], 'Muirenn', { refs: [ficha] });
  assert.deepEqual(recursosDaPeca(peca), { pv: 12, pvMax: 20, pd: 8, pdMax: 10 }); assert.equal(recursosDaPeca(novaPeca([1, 1], 'Sem ficha')), null);
  bFicha.emitir('ficha.recursos', { ficha, pv: 3, pvMax: 20, pd: 8, pdMax: 10 }); await esperar();
  assert.equal(recursosDaPeca(peca)!.pv, 3, 'o último vale');
  bFicha.emitir('ficha.rolagem', { ficha, titulo: 'Investigação', total: 17, modificador: 5 }); await esperar();
  assert.deepEqual(rolagens, [{ ficha, titulo: 'Investigação', total: 17, modificador: 5, tom: 'normal' }]);
  cancelar(); parar();
  bFicha.emitir('ficha.recursos', { ficha, pv: 1, pvMax: 20, pd: 8, pdMax: 10 }); await esperar();
  assert.equal(recursosDaPeca(peca)!.pv, 3, 'parou de escutar'); bFicha.fechar(); bAtlas.fechar();
});

test('pecaDaFicha e personagensComFicha', () => {
  const m = criarMapa({ id: 'm', agora: 1 }), p = novaPeca([2, 2], 'Ana', { refs: [ficha] }), q = novaPeca([3, 3], 'Beto'); m.tokens[p.id] = p; m.tokens[q.id] = q;
  assert.equal(pecaDaFicha(m, ficha)?.id, p.id); assert.equal(pecaDaFicha(m, criarRef('ficha', 'ficha', 'outra')), undefined);
  const base = { campanhaId: 'c', nome: 'x', tags: [], notas: '', criadaPor: 'ficha' as const, criadaEm: 1, atualizadaEm: 1 };
  const lista = personagensComFicha([{ ...base, id: '1', tipo: 'personagem', refs: [ficha] }, { ...base, id: '2', tipo: 'personagem', refs: [] }, { ...base, id: '3', tipo: 'lugar', refs: [ficha] }]);
  assert.deepEqual(lista.map(e => e.id), ['1']);
});

test('textoDeRecursos e temPd: ameaça (PD zero) mostra só PV; personagem mostra PV e PD', () => {
  assert.equal(textoDeRecursos({ pv: 8, pvMax: 10, pd: 3, pdMax: 6 }), 'PV 8/10 · PD 3/6');
  assert.equal(textoDeRecursos({ pv: 45, pvMax: 45, pd: 0, pdMax: 0 }), 'PV 45/45');
  assert.equal(temPd({ pdMax: 6 }), true); assert.equal(temPd({ pdMax: 0 }), false);
});

test('recursosParaOProjetor: só peças de jogador, e só com "Mostrar PV" ligado; a vida de um inimigo nunca sai', () => {
  const rec: Recursos = { pv: 3, pvMax: 9, pd: 1, pdMax: 4 };
  const pecas = { a: { id: 'a', player: true, refs: [ficha] }, b: { id: 'b', player: false, refs: [ficha] }, c: { id: 'c', player: true, refs: [] } };
  const dar = (p: { refs: readonly unknown[] }) => (p.refs.length ? rec : null);
  assert.deepEqual(recursosParaOProjetor(pecas, dar, true), { a: rec }, 'o inimigo (b) e a peça sem ficha (c) ficam de fora');
  assert.deepEqual(recursosParaOProjetor(pecas, dar, false), {}, 'desligado: nada vai');
});

const baseE = { campanhaId: 'c', tags: [], notas: '', criadaPor: 'ficha' as const, criadaEm: 1, atualizadaEm: 1 };
test('ameacasComFicha: só entidades `ameaca` com Ref da Ficha, em ordem alfabética', () => {
  const t = (id: string, nome: string, tipo: string, refs = [criarRef('ficha', 'ficha', id)]) => ({ ...baseE, id, tipo, nome, refs }) as never;
  const lista = ameacasComFicha([t('t2', 'Zumbi', 'ameaca'), t('t1', 'Ariranha', 'ameaca'), t('t3', 'Sem ficha', 'ameaca', []), t('p1', 'Muirenn', 'personagem'), t('t4', 'Álamo', 'ameaca')]);
  assert.deepEqual(lista.map(e => e.nome), ['Álamo', 'Ariranha', 'Zumbi']);
});

test('adicionarPersonagem com uma ameaça: vira peça de inimigo ligada à ficha (uma por ficha); personagem segue sendo peça de jogador', () => {
  const doc = criarMapa({ nome: 'T', campanhaId: null }), comandos: string[] = [];
  const s = { store: { documento: doc, executar: (c: { tipo: string; item?: { id: string } }) => { comandos.push(c.tipo); if (c.tipo === 'item.adicionar') (doc.tokens as Record<string, unknown>)[c.item!.id] = c.item; } }, selecao: signal<unknown[]>([]) } as never;
  const zumbi = { ...baseE, id: 'e-t1', tipo: 'ameaca', nome: 'Zumbi de Sangue', refs: [criarRef('ficha', 'ficha', 'threat-1')] } as unknown as Entidade;
  const muirenn = { ...baseE, id: 'e-p1', tipo: 'personagem', nome: 'Muirenn', refs: [criarRef('ficha', 'ficha', 'sheet-1')] } as unknown as Entidade;
  const a = adicionarPersonagem(s, zumbi, [4.5, 4.5])!, b = adicionarPersonagem(s, muirenn, [6.5, 4.5])!;
  assert.equal(a.player, false, 'ameaça é inimigo: não dá visão nem explorado'); assert.equal(a.name, 'Zumbi de Sangue'); assert.deepEqual(a.refs, [criarRef('ficha', 'ficha', 'threat-1')]);
  assert.equal(b.player, true);
  const de = adicionarPersonagem(s, zumbi, [8.5, 4.5])!;
  assert.equal(de.id, a.id, 'pôr de novo só seleciona a peça que já existe'); assert.equal(Object.keys(doc.tokens).length, 2);
  assert.equal(adicionarPersonagem(s, { ...zumbi, tipo: 'lugar' } as unknown as Entidade), null, 'só personagem e ameaça viram peça');
  assert.equal(adicionarPersonagem(s, { ...zumbi, refs: [] } as unknown as Entidade), null, 'sem ficha, nada');
  assert.deepEqual(comandos, ['item.adicionar', 'item.adicionar']);
});

test('interpretarAjusteDeRecurso: interpreta deltas com sinal e números absolutos', () => {
  assert.deepEqual(interpretarAjusteDeRecurso('-5'), { delta: -5 });
  assert.deepEqual(interpretarAjusteDeRecurso('+3'), { delta: 3 });
  assert.deepEqual(interpretarAjusteDeRecurso('18'), { absoluto: 18 });
  assert.deepEqual(interpretarAjusteDeRecurso('  +10  '), { delta: 10 });
  assert.deepEqual(interpretarAjusteDeRecurso('0'), { absoluto: 0 });
  assert.equal(interpretarAjusteDeRecurso(''), null);
  assert.equal(interpretarAjusteDeRecurso('abc'), null);
});

test('ajustarRecursos: aplica atualização otimista imediata limitando a [0, max] e envia pedido', async () => {
  const ref = criarRef('ficha', 'ficha', 'sheet-ajuste');
  const chave = chaveDaRef(ref);
  recursosDasFichas.value = { [chave]: { pv: 20, pvMax: 30, pd: 5, pdMax: 10 } };

  const pedidos: unknown[] = [];
  const barramentoFalso = {
    pedir: async (tipo: string, dados: unknown) => {
      pedidos.push({ tipo, dados });
      return { ok: true, resposta: { ok: true } } as any;
    },
  };

  // Delta PV positivo
  ajustarRecursos(barramentoFalso, ref, { deltaPv: 5 });
  assert.equal(recursosDasFichas.value[chave]!.pv, 25);

  // Delta PV que ultrapassa o máximo
  ajustarRecursos(barramentoFalso, ref, { deltaPv: 20 });
  assert.equal(recursosDasFichas.value[chave]!.pv, 30);

  // Delta PV negativo que cai abaixo de zero
  ajustarRecursos(barramentoFalso, ref, { deltaPv: -50 });
  assert.equal(recursosDasFichas.value[chave]!.pv, 0);

  // Valor absoluto de PV e PD
  ajustarRecursos(barramentoFalso, ref, { pv: 15, pd: 8 });
  assert.equal(recursosDasFichas.value[chave]!.pv, 15);
  assert.equal(recursosDasFichas.value[chave]!.pd, 8);

  assert.equal(pedidos.length, 4);
  assert.deepEqual((pedidos[0] as any).tipo, 'ficha.ajustar-recursos');
  assert.deepEqual((pedidos[0] as any).dados, { ficha: ref, deltaPv: 5 });
});
