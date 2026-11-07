import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarTutor, INSISTIR, OFERECER, porPasta, type Licao, type ArmazenamentoSimples } from '../../src/tutorial/tutor.ts';
import { LICOES, PASTAS_DE_LICOES } from '../../src/tutorial/licoes.ts';
import { atendida, CONDICOES } from '../../src/tutorial/condicoes.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import type { EstadoDoTutor } from '../../src/tutorial/condicoes.ts';

const memoria = (): ArmazenamentoSimples & { dados: Map<string, string> } => { const dados = new Map<string, string>(); return { dados, getItem: k => dados.get(k) ?? null, setItem: (k, v) => { dados.set(k, v); } }; };
const base = (): EstadoDoTutor => ({ doc: criarMapa({ id: 'm', agora: 1 }), modo: 'construir', aba: 'mapa', ferramenta: 'selecionar', selecao: [], projetor: false, vistaDeJogador: false, sujo: false });
const LICAO: Licao = { id: 'duas', titulo: 'Duas coisas', minutos: 1, proxima: 'outra', passos: [
  { diga: 'Leia', feito: ['ler'], aprendeu: 'Ler antes de fazer' },
  { diga: 'Pegue a ferramenta de cômodo', alvo: '[data-testid="ferramenta-comodo"]', feito: ['ferramenta', 'comodo'], aprendeu: ['C', 'ferramenta de cômodo'] },
  { diga: 'Agora o modo sessão, sozinho', feito: ['modo', 'sessao'], tentar: true },
] };
function montar() {
  const e = base(), arm = memoria(); let t = 0;
  const tutor = criarTutor({ licoes: [LICAO], estado: () => e, agora: () => t, armazenamento: arm });
  return { e, arm, tutor, passa: (s: number) => { t += s * 1000; } };
}

test('a lição anda sozinha quando o resultado existe, espera o Continuar nos passos de leitura e termina com o que aprendeu', () => {
  const { e, tutor } = montar();
  assert.equal(tutor.iniciar('nao-existe'), false); assert.equal(tutor.iniciar('duas'), true);
  assert.deepEqual(tutor.info(), { id: 'duas', titulo: 'Duas coisas', indice: 0, total: 3 });
  assert.equal(tutor.tique(), false, 'o passo de leitura não avança sozinho'); tutor.continuar(); assert.equal(tutor.info()!.indice, 1);
  assert.equal(tutor.tique(), false); e.ferramenta = 'comodo'; assert.equal(tutor.tique(), true); assert.equal(tutor.info()!.indice, 2);
  e.modo = 'sessao'; assert.equal(tutor.tique(), true);
  assert.equal(tutor.info(), null); const f = tutor.fim.value!;
  assert.equal(f.concluida, true); assert.equal(f.proxima, 'outra'); assert.deepEqual(f.aprendeu, ['Ler antes de fazer', ['C', 'ferramenta de cômodo']]);
  assert.deepEqual(tutor.progresso().duas, { done: true });
});

test('o tutor nunca faz o passo: sem o resultado, nada avança, e voltar a um passo o segura até a pessoa sair', () => {
  const { e, tutor } = montar(); tutor.iniciar('duas', 1);
  for (let i = 0; i < 5; i++) assert.equal(tutor.tique(), false);
  e.ferramenta = 'comodo'; tutor.voltar(); assert.equal(tutor.info()!.indice, 0);
  tutor.continuar(); assert.equal(tutor.info()!.indice, 1);        // o passo 1 já está feito, mas foi mostrado de novo: avança no próximo tique
  assert.equal(tutor.tique(), true);
  tutor.voltar(); assert.equal(tutor.info()!.indice, 1); assert.equal(tutor.tique(), false, 'o passo a que se voltou é da pessoa'); tutor.continuar(); assert.equal(tutor.info()!.indice, 2);
});

test('ajuda em degraus: o anel insiste aos 20 s, o cartão oferece os valores aos 35 s (aos 20 nos passos “sozinho”); “Mostrar onde” só nos passos sozinho', () => {
  const { tutor, passa } = montar(); tutor.iniciar('duas', 1);
  assert.deepEqual(tutor.ajuda(), { insiste: false, oferecer: false, mostrouOnde: false, valores: false });
  passa(INSISTIR + 1); assert.equal(tutor.ajuda().insiste, true); assert.equal(tutor.ajuda().oferecer, false);
  passa(OFERECER - INSISTIR); assert.equal(tutor.ajuda().oferecer, true);
  tutor.mostrarOnde(); assert.equal(tutor.ajuda().mostrouOnde, false, 'este passo não é “sozinho”');
  tutor.pedirValores(); assert.equal(tutor.ajuda().valores, true);
  tutor.iniciar('duas', 2); passa(INSISTIR + 1); assert.equal(tutor.ajuda().oferecer, true, 'passo sozinho: oferece aos 20 s'); tutor.mostrarOnde(); assert.equal(tutor.ajuda().mostrouOnde, true);
  tutor.iniciar('duas', 0); passa(100); assert.deepEqual(tutor.ajuda(), { insiste: false, oferecer: false, mostrouOnde: false, valores: false }, 'leitura não tem ajuda');
});

test('progresso e registro ficam no armazenamento; sair guarda o passo; o relatório junta tudo; sem armazenamento tudo continua funcionando', () => {
  const { arm, tutor, passa } = montar();
  tutor.iniciar('duas', 1); passa(12); tutor.pular(); tutor.voltar(); tutor.pedirValores(); passa(3); tutor.parar();
  assert.deepEqual(tutor.progresso().duas, { step: 1 }); assert.equal(tutor.fim.value!.concluida, false); assert.equal(tutor.fim.value!.proxima, null);
  const rel = tutor.relatorio(); assert.equal(rel.passos.duas!.starts, 1); assert.equal(rel.passos.duas!.completes, 0);
  assert.equal(rel.passos.duas!.steps[1]!.skips, 1); assert.equal(rel.passos.duas!.steps[1]!.seconds, 15, "12 s da primeira vez e 3 s da volta"); assert.equal(rel.passos.duas!.steps[2]!.backs, 1); assert.equal(rel.passos.duas!.steps[1]!.hints, 1);
  assert.ok(arm.dados.has('atlas-tutoriais-v1') && arm.dados.has('atlas-tutoriais-registro-v1'));
  const sem = criarTutor({ licoes: [LICAO], estado: base, armazenamento: null }); assert.equal(sem.iniciar('duas'), true); sem.continuar(); assert.equal(sem.info()!.indice, 1);
});

test('porPasta: agrupa na ordem das pastas, esconde as ocultas e junta o resto em “Outros”', () => {
  const l = (id: string, pasta?: string, oculta?: boolean): Licao => ({ id, titulo: id, minutos: 1, passos: [], ...(pasta ? { pasta } : {}), ...(oculta ? { oculta } : {}) });
  const grupos = porPasta([l('a', 'x'), l('b', 'y'), l('c'), l('d', 'x', true), l('e', 'x')], [{ id: 'x', nome: 'X', sobre: '' }, { id: 'y', nome: 'Y', sobre: '' }, { id: 'z', nome: 'Z', sobre: '' }]);
  assert.deepEqual(grupos.map(g => [g.pasta.nome, g.licoes.map(x => x.id)]), [['X', ['a', 'e']], ['Y', ['b']], ['Outros', ['c']]]);
});

test('catálogo de lições: todas têm id, título, passos válidos com condições registradas e pastas conhecidas', () => {
  const pastasConhecidas = new Set(PASTAS_DE_LICOES.map(p => p.id));
  const ids = new Set(LICOES.map(l => l.id));
  assert.equal(ids.size, LICOES.length, 'não há lições com id duplicado');

  for (const l of LICOES) {
    assert.ok(l.id.trim().length > 0);
    assert.ok(l.titulo.trim().length > 0);
    assert.ok(l.minutos > 0);
    assert.ok(l.passos.length > 0, `lição ${l.id} precisa ter passos`);
    if (l.pasta) assert.ok(pastasConhecidas.has(l.pasta), `pasta da lição ${l.id} deve existir em PASTAS_DE_LICOES`);
    if (l.proxima) assert.ok(ids.has(l.proxima), `proxima lição ${l.proxima} deve existir em LICOES`);

    for (const [i, p] of l.passos.entries()) {
      assert.ok(p.diga.trim().length > 0, `passo ${i + 1} da lição ${l.id} precisa de texto`);
      const cond = p.feito[0];
      assert.ok(cond in CONDICOES, `condição "${cond}" no passo ${i + 1} da lição ${l.id} precisa estar em CONDICOES`);
    }
  }
});

test('condições do tutor: presencaPintada e climaSalvo', () => {
  const e = base();
  assert.equal(atendida(['presencaPintada', 'corrupcao'], e), false);
  e.doc.presence.p1 = { id: 'p1', brush: 'corrupcao', cells: [], intensity: 1, seed: 1, gmOnly: false };
  assert.equal(atendida(['presencaPintada', 'corrupcao'], e), true);
  assert.equal(atendida(['presencaPintada', 'mofo'], e), false);

  assert.equal(atendida(['climaSalvo', 1], e), false);
  e.doc.customClimates.c1 = { id: 'c1', name: 'Névoa Carmesim', climate: e.doc.climate, finish: e.doc.finish };
  assert.equal(atendida(['climaSalvo', 1], e), true);
});

