import { test } from 'node:test';
import assert from 'node:assert/strict';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import type { MapaAtlas, Objeto } from '../../src/domain/mapa.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { gerarLayout, rotacaoDeParede } from '../../src/authoring/layout.ts';
import { circulacao, malhaDoComodo, retanguloLivre } from '../../src/authoring/malha.ts';
import { pegadaDaReceita } from '../../src/procedural/receitas.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const receitaDe = (o: Objeto) => (o.source.kind === 'recipe' ? o.source.recipe : '');

/** Um cômodo `q` de 6 × 4,5 m com uma porta na parede da esquerda, a meia altura. */
function quarto(extra: Parameters<typeof sala>[5] = {}): MapaAtlas {
  const m = mapaCom(sala('q', 0, 0, 4, 3, { name: 'Quarto', function: 'quarto', ...extra }));
  m.openings.porta = abertura(m, 'porta', paredeEm(m, 'x', 0, 4.4)!.id, 0.5);
  return m;
}
const pedir = (m: MapaAtlas, semente = 1, funcao = 'quarto', roomId = 'q') => gerarLayout(m, { roomId, funcao, genero: 'investigacao', semente, gerarId: contador() });
const comOs = (m: MapaAtlas, novos: Objeto[]): MapaAtlas => ({ ...m, props: { ...m.props, ...Object.fromEntries(novos.map(o => [o.id, o])) } });

test('a rotação de parede: a normal para dentro da parede de cima dá 0, e as outras giram em múltiplos de 90°', () => {
  assert.equal(rotacaoDeParede([0, 1]), 0);
  assert.ok(Math.abs(rotacaoDeParede([-1, 0]) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(Math.abs(rotacaoDeParede([0, -1])) - Math.PI) < 1e-9);
  assert.ok(Math.abs(rotacaoDeParede([1, 0]) + Math.PI / 2) < 1e-9);
});

test('móvel de parede: fundo (−y local) encostado, a meia profundidade da parede e com a rotação da fórmula', () => {
  const l = pedir(quarto());
  const camas = l.objetos.filter(o => receitaDe(o).startsWith('cama.')); assert.ok(camas.length >= 1, 'o quarto ganha cama');
  for (const o of camas) {
    const [, h] = pegadaDaReceita(receitaDe(o)), normais: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const linhas = [{ n: normais[0]!, d: o.position[1] }, { n: normais[1]!, d: 4.5 - o.position[1] }, { n: normais[2]!, d: o.position[0] }, { n: normais[3]!, d: 6 - o.position[0] }];
    const parede = linhas.find(x => Math.abs(x.d - (h / 2 + 0.1)) < 1e-6);
    assert.ok(parede, `a cama fica a ${(h / 2 + 0.1).toFixed(2)} m de uma parede`);
    const esperado = rotacaoDeParede(parede!.n), dif = Math.atan2(Math.sin(o.rotation - esperado), Math.cos(o.rotation - esperado));
    assert.ok(Math.abs(dif) < 1e-9, 'o fundo da cama está na parede');
  }
});

test('quarto de 6 × 4,5 m com porta: nada na frente da porta e a circulação continua ligada', () => {
  for (const semente of [1, 2, 3, 4, 5]) {
    const m = quarto(), l = pedir(m, semente), ins = insightDoComodo(m, 'q')!, malha = malhaDoComodo(m, ins);
    assert.ok(l.objetos.length >= 3, `semente ${semente}: gerou ${l.objetos.length}`);
    for (const o of l.objetos.filter(x => x.elevation === 'floor' && x.blocks.move)) {
      const [w, h] = pegadaDaReceita(receitaDe(o)), c = Math.abs(Math.cos(o.rotation)), s = Math.abs(Math.sin(o.rotation)), ex = (c * w + s * h) / 2, ey = (s * w + c * h) / 2;
      assert.ok(retanguloLivre(malha, { x0: o.position[0] - ex, y0: o.position[1] - ey, x1: o.position[0] + ex, y1: o.position[1] + ey }, [malha.porta]), `semente ${semente}: ${receitaDe(o)} tapa a porta`);
    }
    const depois = comOs(m, l.objetos), ins2 = insightDoComodo(depois, 'q')!;
    assert.equal(circulacao(malhaDoComodo(depois, ins2), ins2).ligada, true, `semente ${semente}: a porta ainda alcança o meio`);
    // Nada sai do cômodo nem se sobrepõe a outro móvel que bloqueia.
    const caixas = l.objetos.filter(x => x.elevation === 'floor' && x.blocks.move).map(o => insightDoComodo(depois, 'q')!.objetos.find(x => x.id === o.id)!.caixa);
    for (const c of caixas) assert.ok(c.x0 >= 0 && c.y0 >= 0 && c.x1 <= 6 && c.y1 <= 4.5, 'dentro do cômodo');
    for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) { const a = caixas[i]!, b = caixas[j]!; assert.ok(!(a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6), `móveis ${i} e ${j} se sobrepõem`); }
  }
});

test('quarto que já tem cama não ganha outra', () => {
  const m = quarto(); m.props.cama = novoObjeto([3, 1.1], { id: 'cama', roomId: 'q', source: { kind: 'recipe', recipe: 'cama.solteiro', seed: 1, params: {} } });
  const l = pedir(m); assert.equal(l.objetos.filter(o => receitaDe(o).startsWith('cama.')).length, 0);
  assert.ok(l.objetos.some(o => receitaDe(o) === 'mesinha'), 'e a mesinha vai ao lado da cama que já estava lá');
  const mesinha = l.objetos.find(o => receitaDe(o) === 'mesinha')!; assert.ok(Math.hypot(mesinha.position[0] - 3, mesinha.position[1] - 1.1) < 1.5);
});

test('cozinha com a mesa já posta ganha cadeiras ao redor dela, viradas para ela', () => {
  const m = mapaCom(sala('k', 0, 0, 4, 3, { name: 'Cozinha', function: 'cozinha' }));
  m.openings.p = abertura(m, 'p', paredeEm(m, 'y', 4.5, 4.4)!.id, 0.9);
  m.props.mesa = novoObjeto([3, 2.25], { id: 'mesa', roomId: 'k', source: { kind: 'recipe', recipe: 'mesa.retangular', seed: 1, params: {} } });
  const l = gerarLayout(m, { roomId: 'k', funcao: 'cozinha', genero: 'investigacao', semente: 1, gerarId: contador() });
  const cadeiras = l.objetos.filter(o => receitaDe(o) === 'cadeira'); assert.ok(cadeiras.length >= 2, `gerou ${cadeiras.length} cadeiras`);
  for (const c of cadeiras) {
    assert.ok(Math.hypot(c.position[0] - 3, c.position[1] - 2.25) < 1.5, 'perto da mesa');
    // O fundo da cadeira (−y local) aponta para longe da mesa.
    const fundo: [number, number] = [Math.sin(c.rotation), -Math.cos(c.rotation)], deMesa: [number, number] = [c.position[0] - 3, c.position[1] - 2.25];
    assert.ok(fundo[0] * deMesa[0] + fundo[1] * deMesa[1] > 0, 'a cadeira olha para a mesa');
  }
  assert.equal(l.objetos.filter(o => receitaDe(o).startsWith('mesa.')).length, 0, 'e não ganha outra mesa');
});

test('um cômodo de 1,5 × 1,5 m devolve pouco ou nada sem lançar', () => {
  const m = mapaCom(sala('p', 0, 0, 1, 1, { name: 'Quarto', function: 'quarto' }));
  const l = pedir(m, 1, 'quarto', 'p'); assert.ok(l.objetos.length <= 2); assert.ok(l.faltaram.includes('cama'));
  assert.deepEqual(gerarLayout(m, { roomId: 'inexistente', funcao: 'quarto', genero: 'investigacao', semente: 1 }), { objetos: [], faltaram: [] });
});

test('mesma semente, mesmas posições; semente diferente muda alguma coisa', () => {
  const m = quarto(), a = pedir(m, 7), b = pedir(m, 7), c = pedir(m, 8);
  const resumo = (l: ReturnType<typeof pedir>) => JSON.stringify(l.objetos.map(o => [receitaDe(o), o.position, o.rotation]));
  assert.equal(resumo(a), resumo(b)); assert.notEqual(resumo(a), resumo(c));
});

test('objetos de parede (quadro, espelho) ficam na parede, longe da porta, e levam `wall`', () => {
  const l = pedir(quarto(), 3), paredes = l.objetos.filter(o => o.elevation === 'wall');
  assert.ok(paredes.length >= 1);
  for (const o of paredes) { assert.ok(o.wall && o.wall.face === 'inner'); assert.equal(o.roomId, 'q'); assert.equal(o.blocks.move, false); }
});

test('com o gênero fantasia, a cozinha usa bancos em vez de cadeiras', () => {
  const m = mapaCom(sala('k', 0, 0, 4, 3, { name: 'Cozinha', function: 'cozinha' })); m.openings.p = abertura(m, 'p', paredeEm(m, 'y', 4.5, 4.4)!.id, 0.9);
  const l = gerarLayout(m, { roomId: 'k', funcao: 'cozinha', genero: 'fantasia', semente: 1, gerarId: contador() });
  assert.ok(!l.objetos.some(o => receitaDe(o) === 'cadeira')); assert.ok(l.objetos.some(o => receitaDe(o) === 'banco'));
});
