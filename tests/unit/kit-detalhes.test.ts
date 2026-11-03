import { test } from 'node:test';
import assert from 'node:assert/strict';
import { funcaoProvavel } from '../../src/authoring/funcao.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { gerarLayout } from '../../src/authoring/layout.ts';
import { paletaDe, propostaDeMobilia } from '../../src/authoring/mobiliar.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { caixaDasPartes } from '../../src/procedural/descricao.ts';
import { MATERIAIS, materialDe } from '../../src/procedural/materiais.ts';
import { RECEITAS_DE_ENFEITES } from '../../src/procedural/receitas/enfeites.ts';
import { RECEITAS_DE_PAREDE } from '../../src/procedural/receitas/parede.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const receitaDe = (o: { source: unknown }) => (o.source as { recipe?: string }).recipe ?? '';

test('detalhes de parede e enfeites de mesa desenham sem erro e com a pegada que declaram', () => {
  assert.ok(RECEITAS_DE_PAREDE.length >= 16); assert.ok(RECEITAS_DE_ENFEITES.length >= 15);
  for (const r of RECEITAS_DE_PAREDE) {
    assert.equal(r.tipo, 'parede', r.id); assert.equal(r.categoria, 'parede');
    const d = descreverReceita(r.id, { seed: 1, params: {} }); assert.equal(d.tipo, 'parede'); assert.deepEqual(pegadaDaReceita(r.id), [r.pegada[0], 0.05], r.id);
    if (d.tipo === 'parede') { assert.ok(d.face.length >= 2 && d.topo.length >= 1, r.id); const c = caixaDasPartes(d.face); assert.ok(c.x1 - c.x0 <= d.largura + 0.3, `${r.id}: a face passa da largura`); }
  }
  for (const r of RECEITAS_DE_ENFEITES) {
    assert.equal(r.tipo, 'piso', r.id); assert.ok(r.tags.includes('enfeite'), r.id);
    const d = descreverReceita(r.id, { seed: 1, params: {} }); assert.ok(d.tipo === 'piso' && d.partes.length >= 2, r.id); assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    const c = caixaDasPartes(d.tipo === 'piso' ? d.partes : []); assert.ok(c.x1 - c.x0 <= r.pegada[0] + 0.15 && c.y1 - c.y0 <= r.pegada[1] + 0.15, `${r.id}: partes passam da pegada`);
  }
});

test('os 13 materiais novos de piso e papel existem com o uso certo', () => {
  const pisos = ['parquet.espinha', 'marmore.branco', 'marmore.xadrez-diagonal', 'hexagono.salvia', 'hexagono.terracota', 'tabuas.cinza'];
  const papeis = ['papel.floral-azul', 'papel.floral-rosa', 'papel.verde-esmeralda', 'papel.bordo-listras', 'papel.azul-listras', 'boiserie.escura', 'boiserie.verde'];
  for (const id of pisos) { assert.ok(MATERIAIS[id], id); assert.equal(materialDe(id).uso, 'piso'); }
  for (const id of papeis) { assert.ok(MATERIAIS[id], id); assert.equal(materialDe(id).uso, 'papel'); }
  for (const t of TIPOS_DE_COMODO) assert.ok(MATERIAIS[t.piso] && MATERIAIS[t.papel], t.id);
});

test('uma casa de investigação ganha pisos e papéis diferentes de cômodo para cômodo', () => {
  const pisos = new Set<string>(), papeis = new Set<string>();
  for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
    const m = mapaCom(sala(id, 0, 0, 4, 3, { name: 'Sala', function: 'sala', floor: { material: 'tabuas.carvalho', seed: 3 }, wallpaper: { material: 'papel.damasco-vinho', seed: 3 } })); m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 0, 4.4)!.id, 0.5);
    const p = propostaDeMobilia({ m, versao: 0, semente: 0, gerarId: contador() }, id), up = p?.comandos.find(c => c.tipo === 'comodo.atualizar') as { patch?: { floor?: { material?: string }; wallpaper?: { material?: string } } } | undefined;
    pisos.add(up?.patch?.floor?.material ?? 'tabuas.carvalho'); papeis.add(up?.patch?.wallpaper?.material ?? 'papel.damasco-vinho');
  }
  assert.ok(pisos.size >= 2 && papeis.size >= 3, `${pisos.size} pisos e ${papeis.size} papéis em 8 cômodos iguais`);
});

test('as paredes de uma sala, de um corredor e de uma biblioteca ficam bem mais cheias (quadros de vários tipos, arandelas, relógio, mapa…)', () => {
  const contar = (funcao: string, w: number, h: number) => {
    const m = mapaCom(sala('c', 0, 0, w, h, { name: 'Cômodo', function: funcao })); m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 0, Math.min(4.4, h * 1.5 - 0.1))!.id, 0.5);
    let total = 0; const tipos = new Set<string>();
    for (const semente of [1, 2, 3, 4]) { const l = gerarLayout(m, { roomId: 'c', funcao, genero: 'investigacao', semente, gerarId: contador() }), p = l.objetos.filter(o => o.elevation === 'wall'); total += p.length; for (const o of p) tipos.add(receitaDe(o)); }
    return { media: total / 4, tipos: tipos.size };
  };
  assert.ok(contar('sala', 5, 3).media >= 4, 'sala de investigação'); assert.ok(contar('corredor', 6, 1).media >= 3, 'corredor'); assert.ok(contar('biblioteca', 5, 3).media >= 4, 'biblioteca');
  assert.ok(contar('sala', 5, 3).tipos >= 4, 'quadros e detalhes de tipos diferentes');
});

test('enfeites sobre os móveis: a sala de jantar põe pratos, velas e frutas sobre a mesa (elevation table, dentro dela); o escritório, sobre a escrivaninha', () => {
  const jantar = mapaCom(sala('j', 0, 0, 4, 3, { name: 'Sala de jantar', function: 'sala-de-jantar' })); jantar.openings.p = abertura(jantar, 'p', paredeEm(jantar, 'x', 0, 4.4)!.id, 0.5);
  for (const semente of [1, 2, 3]) {
    const l = gerarLayout(jantar, { roomId: 'j', funcao: 'sala-de-jantar', genero: 'investigacao', semente, gerarId: contador() }), mesa = l.objetos.find(o => receitaDe(o) === 'mesa.oval')!, sobre = l.objetos.filter(o => o.elevation === 'table');
    assert.ok(mesa && sobre.length >= 2, `semente ${semente}: ${sobre.length} enfeites sobre a mesa`);
    const [w, h] = ACERVO.pegadaDaFonte(mesa.source), c = Math.cos(mesa.rotation), s = Math.sin(mesa.rotation);
    for (const o of sobre) {
      const dx = o.position[0] - mesa.position[0], dy = o.position[1] - mesa.position[1], lx = dx * c + dy * s, ly = -dx * s + dy * c;
      assert.ok(Math.abs(lx) <= w / 2 + 0.01 && Math.abs(ly) <= h / 2 + 0.01, `${receitaDe(o)} fora da mesa`); assert.equal(o.blocks.move, false);
    }
    for (let i = 0; i < sobre.length; i++) for (let j = i + 1; j < sobre.length; j++) assert.ok(Math.hypot(sobre[i]!.position[0] - sobre[j]!.position[0], sobre[i]!.position[1] - sobre[j]!.position[1]) > 0.1, 'enfeites sobrepostos');
  }
  const esc = mapaCom(sala('e', 0, 0, 4, 3, { name: 'Escritório', function: 'escritorio' })); esc.props.mesa = novoObjeto([3, 0.5], { id: 'mesa', roomId: 'e', source: { kind: 'recipe', recipe: 'escrivaninha', seed: 1, params: {} } });
  const l = gerarLayout(esc, { roomId: 'e', funcao: 'escritorio', genero: 'investigacao', semente: 2, gerarId: contador() });
  assert.ok(l.objetos.filter(o => o.elevation === 'table').every(o => Math.abs(o.position[0] - 3) <= 0.76 && Math.abs(o.position[1] - 0.5) <= 0.41), 'sobre a escrivaninha que o mestre já pôs');
  assert.ok(l.objetos.some(o => o.elevation === 'table'));
});

test('as regras de “sobre” e as de parede só citam itens do tipo certo; a varanda existe como função e tem regra', () => {
  for (const [funcao, regras] of Object.entries(REGRAS_DE_MOBILIA)) for (const r of regras) for (const id of r.receitas) {
    const tipo = ACERVO.item(id)?.tipo; assert.ok(tipo, `${funcao}/${r.id}: ${id}`);
    if (r.lugar === 'sobre') assert.equal(tipo, 'piso', `${funcao}/${r.id}: só objetos de piso vão sobre móveis`);
  }
  assert.ok(TIPOS_DE_COMODO.some(t => t.funcao === 'varanda') && REGRAS_DE_MOBILIA.varanda?.length);
  const ids = regrasPara('varanda', 'investigacao').flatMap(r => r.receitas); for (const i of ['balaustrada', 'escada.externa', 'urna.pedestal']) assert.ok(ids.includes(i), i);
  const m = mapaCom(sala('v', 0, 0, 4, 2, { name: 'Varanda' })); assert.equal(funcaoProvavel(insightDoComodo(m, 'v')!)?.funcao, 'varanda');
  for (const n of ['Terraço', 'Sacada', 'Alpendre']) { const x = mapaCom(sala('v', 0, 0, 4, 2, { name: n })); assert.equal(funcaoProvavel(insightDoComodo(x, 'v')!)?.funcao, 'varanda', n); }
  assert.ok(paletaDe('investigacao', 0));
});

test('a varanda mobiliada tem balaustrada e escada nas bordas e urnas nos cantos', () => {
  const m = mapaCom(sala('v', 0, 0, 8, 2, { name: 'Varanda', function: 'varanda' })); m.openings.p = abertura(m, 'p', paredeEm(m, 'y', 0, 11.9)!.id, 0.5);
  const r = gerarLayout(m, { roomId: 'v', funcao: 'varanda', genero: 'investigacao', semente: 1, gerarId: contador() }).objetos.map(receitaDe);
  assert.ok(r.filter(x => x === 'balaustrada').length >= 2 && r.includes('urna.pedestal'), r.join(', '));
});
