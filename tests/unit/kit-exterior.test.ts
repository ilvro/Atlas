import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONJUNTOS_EXTERIORES, TODOS_OS_CONJUNTOS, espalhar } from '../../src/authoring/espalhar.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import type { MapaAtlas, Objeto } from '../../src/domain/mapa.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes } from '../../src/procedural/descricao.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_EXTERIORES } from '../../src/procedural/receitas/exterior.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const id = (o: Objeto) => ACERVO.idDaFonte(o.source);
const pedido = (centro: [number, number], raio: number, conjunto: string, semente = 1) => ({ centro, raio, conjunto, semente, gerarId: contador() });
const gramado = (): MapaAtlas => { const m = mapaCom(sala('c', 12, 8, 16, 11, { name: 'Casa', function: 'sala' })); m.terrain = { ...m.terrain, base: 'grama' }; m.openings.p = abertura(m, 'p', paredeEm(m, 'y', 12, 5.9)!.id, 0.5); return m; };

test('as receitas do kit exterior desenham sem erro, com pegada estável e partes dentro da pegada', () => {
  assert.ok(RECEITAS_EXTERIORES.length >= 10);
  for (const r of RECEITAS_EXTERIORES) {
    assert.equal(r.categoria, 'exterior'); assert.equal(r.kit, 'exterior');
    const d = descreverReceita(r.id, { seed: 1, params: {} }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    const c = caixaDasPartes(d.tipo === 'piso' ? d.partes : []); assert.ok(c.x1 - c.x0 <= r.pegada[0] + 0.2 && c.y1 - c.y0 <= r.pegada[1] + 0.2, `${r.id}: partes passam da pegada`);
  }
  assert.ok(pegadaDaReceita('cerca', { largura: 4 })[0] > pegadaDaReceita('cerca', { largura: 1 })[0], 'a cerca tem trecho com largura');
  assert.equal(RECEITAS_EXTERIORES.filter(r => r.id.startsWith('pedra.')).length, 3);
});

test('os conjuntos exteriores só citam itens do acervo, e as árvores levam a tag `arvore`', () => {
  assert.deepEqual(CONJUNTOS_EXTERIORES.map(c => c.id), ['mata', 'jardim', 'cemiterio']); assert.equal(TODOS_OS_CONJUNTOS.length, 6);
  for (const c of CONJUNTOS_EXTERIORES) for (const i of c.itens) assert.ok(ACERVO.item(i.receita), i.receita);
  for (const a of ['casa:arvore-3m', 'casa:arvore-5m', 'casa:arvore-7m', 'casa:pinheiro-3m', 'casa:pinheiro-4m']) assert.ok(ACERVO.item(a)?.tags.includes('arvore'), a);
  assert.ok(!ACERVO.item('casa:arbusto-verde')?.tags.includes('arvore'));
});

test('mata num gramado põe pedras e tocos sob as árvores (dentro da copa), e as árvores sozinhas ficam soltas', () => {
  const m = gramado();
  for (const semente of [1, 2, 3]) {
    const novos = espalhar(m, pedido([30, 25], 9, 'mata', semente)), arvores = novos.filter(o => ACERVO.item(id(o))?.tags.includes('arvore')), sob = novos.filter(o => /^(pedra|toco|tronco)/.test(id(o)));
    assert.ok(arvores.length >= 3, `semente ${semente}: ${arvores.length} árvores`); assert.ok(sob.length >= 1, `semente ${semente}: ${sob.length} itens sob árvores`);
    for (const o of sob) assert.ok(arvores.some(a => Math.hypot(a.position[0] - o.position[0], a.position[1] - o.position[1]) <= ACERVO.pegadaDaFonte(a.source)[0] / 2 + 0.01), `semente ${semente}: ${id(o)} não está sob nenhuma copa`);
    assert.ok(novos.every(o => o.roomId === null), 'longe da casa, nada fica "dentro" de cômodo');
  }
});

test('mata respeita árvores que já existem: pedras podem cair sob elas', () => {
  const m = gramado(), arvore = novoObjeto([30, 25], { id: 'arv', source: ACERVO.fonte('casa:arvore-7m', 1), blocks: { move: false, sight: false } });
  m.props.arv = arvore;
  const sob = espalhar(m, pedido([30, 25], 3, 'mata', 4)).filter(o => /^(pedra|toco|tronco)/.test(id(o)));
  for (const o of sob) assert.ok(Math.hypot(o.position[0] - 30, o.position[1] - 25) <= 3.51, 'dentro da copa de 7 m');
});

test('nada cai na frente de uma porta externa (semicírculo de 1,5 m), em nenhum conjunto', () => {
  const m = gramado(), ins = insightDoComodo(m, 'c')!, porta = ins.portas.find(p => p.outro === null)!, fora: [number, number] = [-porta.normal[0], -porta.normal[1]];
  for (const conjunto of ['mata', 'jardim', 'cemiterio']) for (const semente of [1, 2, 3, 4]) {
    for (const o of espalhar(m, pedido([porta.centro[0] + fora[0] * 2, porta.centro[1] + fora[1] * 2], 5, conjunto, semente))) {
      const dx = o.position[0] - porta.centro[0], dy = o.position[1] - porta.centro[1], noLadoDeFora = dx * fora[0] + dy * fora[1] >= -0.2;
      assert.ok(!(noLadoDeFora && Math.hypot(dx, dy) < 1.5), `${conjunto}/${semente}: ${id(o)} a ${Math.hypot(dx, dy).toFixed(2)} m da porta`);
    }
  }
});

test('jardim põe canteiros e arbustos; cemitério põe lápides em fileiras; e a mesma semente dá o mesmo resultado', () => {
  const m = gramado(), resumo = (l: Objeto[]) => JSON.stringify(l.map(o => [id(o), o.position, o.rotation]));
  const jardim = espalhar(m, pedido([40, 10], 6, 'jardim', 2)); assert.ok(jardim.some(o => id(o) === 'canteiro') && jardim.length >= 5, jardim.map(id).join(','));
  const cem = espalhar(m, pedido([40, 10], 7, 'cemiterio', 3)), lapides = cem.filter(o => id(o) === 'lapide'); assert.ok(lapides.length >= 8, `${lapides.length} lápides`);
  for (const o of lapides) { const dx = ((o.position[0] - 40) / 1.3) % 1, dy = ((o.position[1] - 10) / 1.9) % 1, perto = (v: number) => Math.min(Math.abs(v), 1 - Math.abs(v)); assert.ok(perto(dx) * 1.3 <= 0.1 && perto(dy) * 1.9 <= 0.1, 'cada lápide fica num ponto da grade, com só um leve tremor'); }
  for (const o of lapides) assert.ok(Math.abs(o.rotation) < 0.1, 'todas viradas para o mesmo lado');
  assert.equal(resumo(espalhar(m, pedido([30, 25], 8, 'mata', 7))), resumo(espalhar(m, pedido([30, 25], 8, 'mata', 7))));
  assert.notEqual(resumo(espalhar(m, pedido([30, 25], 8, 'mata', 7))), resumo(espalhar(m, pedido([30, 25], 8, 'mata', 8))));
});
