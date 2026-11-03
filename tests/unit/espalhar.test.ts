import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONJUNTOS_DE_ESPALHAR, espalhar } from '../../src/authoring/espalhar.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { malhaDoComodo, retanguloLivre } from '../../src/authoring/malha.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import type { MapaAtlas, Objeto } from '../../src/domain/mapa.ts';
import { pegadaDaReceita, receitaDe } from '../../src/procedural/receitas/index.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const receita = (o: Objeto) => (o.source.kind === 'recipe' ? o.source.recipe : '');
const comOs = (m: MapaAtlas, novos: Objeto[]): MapaAtlas => ({ ...m, props: { ...m.props, ...Object.fromEntries(novos.map(o => [o.id, o])) } });

/** Escritório de 6 × 4,5 m com porta na esquerda e uma escrivaninha encostada na parede de cima (caixa x 2,25–3,75, y 0,1–0,9). */
function escritorio(): MapaAtlas {
  const m = mapaCom(sala('e', 0, 0, 4, 3, { name: 'Escritório', function: 'escritorio' }));
  m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 0, 4.4)!.id, 0.5);
  m.props.mesa = novoObjeto([3, 0.5], { id: 'mesa', roomId: 'e', source: { kind: 'recipe', recipe: 'escrivaninha', seed: 1, params: {} } });
  return m;
}
const pedido = (centro: [number, number], raio: number, conjunto: string, semente = 1) => ({ centro, raio, conjunto, semente, gerarId: contador() });

test('os conjuntos existem e só citam receitas que existem', () => {
  assert.deepEqual(CONJUNTOS_DE_ESPALHAR.map(c => c.id), ['papelada', 'caixotes', 'bibelos', 'refeicao', 'bagunca', 'plantas']);
  for (const c of CONJUNTOS_DE_ESPALHAR) { assert.ok(c.densidade > 0); for (const i of c.itens) assert.ok(receitaDe(i.receita), i.receita); }
  assert.deepEqual(espalhar(escritorio(), pedido([3, 2], 1.5, 'nao-existe')), []);
});

test('papelada num escritório com escrivaninha põe itens sobre ela (elevation table, dentro da caixa)', () => {
  const m = escritorio(), novos = espalhar(m, pedido([3, 0.5], 1.5, 'papelada'));
  assert.ok(novos.length >= 2, `gerou ${novos.length}`);
  for (const o of novos) {
    assert.equal(o.elevation, 'table'); assert.ok(['papeis', 'livros.pilha'].includes(receita(o))); assert.equal(o.blocks.move, false);
    assert.ok(o.position[0] >= 2.25 && o.position[0] <= 3.75 && o.position[1] >= 0.1 && o.position[1] <= 0.9, `sobre a mesa: ${o.position}`);
  }
});

test('caixotes ficam de costas para a parede, a no máximo 0,6 m dela, e nada cai na frente da porta nem sobre a mesa', () => {
  const m = escritorio(), ins = insightDoComodo(m, 'e')!, malha = malhaDoComodo(m, ins);
  for (const semente of [1, 2, 3]) {
    const novos = espalhar(m, pedido([3, 2.25], 3, 'caixotes', semente)); assert.ok(novos.length >= 1, `semente ${semente}: gerou ${novos.length}`);
    for (const o of novos) {
      const [x, y] = o.position, daParede = Math.min(x, y, 6 - x, 4.5 - y);
      assert.ok(daParede <= 0.6, `${daParede.toFixed(2)} m da parede`);
      const [w, h] = pegadaDaReceita('caixa'), c = Math.abs(Math.cos(o.rotation)), s = Math.abs(Math.sin(o.rotation)), ex = (c * w + s * h) / 2, ey = (s * w + c * h) / 2;
      assert.ok(retanguloLivre(malha, { x0: x - ex, y0: y - ey, x1: x + ex, y1: y + ey }, [malha.porta]), 'fora da área da porta');
      assert.equal(o.blocks.move, true); assert.equal(o.elevation, 'floor');
    }
  }
});

test('pincelar duas vezes no mesmo ponto não dobra a quantidade', () => {
  const m = escritorio(), a = espalhar(m, pedido([3, 2.25], 3, 'caixotes', 1)), m2 = comOs(m, a), b = espalhar(m2, pedido([3, 2.25], 3, 'caixotes', 2));
  const alvo = Math.round(0.5 * Math.PI * 9);
  assert.ok(a.length + b.length <= alvo, `${a.length} + ${b.length} passa de ${alvo}`);
  const c = espalhar(comOs(m2, b), pedido([3, 2.25], 3, 'caixotes', 3)); assert.equal(c.length, 0, 'depois de cheio, nada mais');
});

test('mesma semente, mesmo resultado; sem cômodo só vale "livre"; sem mesa a papelada não nasce', () => {
  const m = escritorio(), resumo = (l: Objeto[]) => JSON.stringify(l.map(o => [receita(o), o.position, o.rotation, o.elevation]));
  assert.equal(resumo(espalhar(m, pedido([3, 2.25], 3, 'caixotes', 5))), resumo(espalhar(m, pedido([3, 2.25], 3, 'caixotes', 5))));
  assert.notEqual(resumo(espalhar(m, pedido([3, 2.25], 3, 'caixotes', 5))), resumo(espalhar(m, pedido([3, 2.25], 3, 'caixotes', 6))));
  const fora = espalhar(m, pedido([20, 20], 2, 'caixotes')); assert.equal(fora.length, 0, 'fora de cômodos não há parede');
  const plantas = espalhar(m, pedido([20, 20], 2, 'plantas')); assert.ok(plantas.every(o => o.roomId === null && receita(o) === 'vaso.planta'));
  const semMesa = escritorio(); delete semMesa.props.mesa; assert.deepEqual(espalhar(semMesa, pedido([3, 2], 1.5, 'papelada')), []);
});
