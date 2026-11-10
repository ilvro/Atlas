import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REGRAS_DE_MOBILIA, VARIACOES_DE_GENERO, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { gerarLayout } from '../../src/authoring/layout.ts';
import { insightDoComodo } from '../../src/authoring/insight.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import type { MapaAtlas, Objeto } from '../../src/domain/mapa.ts';
import { abertura, mapaCom, paredeEm, sala } from './apoio-casa.ts';

const contador = () => { let n = 0; return (p: string) => `${p}${++n}`; };
const receitaDe = (o: Objeto) => (o.source.kind === 'recipe' ? o.source.recipe : '');

test('toda receita citada nas regras e nas trocas existe no acervo', () => {
  const citadas = new Set<string>();
  for (const itens of Object.values(REGRAS_DE_MOBILIA)) for (const i of itens) { i.receitas.forEach(r => citadas.add(r)); i.porArea?.forEach(([, r]) => citadas.add(r)); }
  for (const v of Object.values(VARIACOES_DE_GENERO)) for (const rs of Object.values(v.trocar ?? {})) rs.forEach(r => citadas.add(r));
  for (const r of citadas) assert.ok(ACERVO.item(r), `receita inexistente: ${r}`);
});

test('forja de fantasia tem fornalha e tocha de parede', () => {
  const rs = regrasPara('forja', 'fantasia').flatMap(r => r.receitas);
  assert.ok(rs.includes('fornalha')); assert.ok(rs.includes('tocha.parede'));
});

test('capela na investigação tem vitral e púlpito', () => {
  const rs = regrasPara('capela', 'investigacao').flatMap(r => r.receitas);
  assert.ok(rs.includes('vitral')); assert.ok(rs.includes('pulpito'));
});

test('no moderno nenhuma função recebe receita só de fantasia', () => {
  for (const f of Object.keys(REGRAS_DE_MOBILIA)) for (const r of regrasPara(f, 'moderno').flatMap(x => x.receitas)) {
    const g = ACERVO.item(r)?.generos ?? []; assert.ok(!g.length || g.includes('moderno'), `${f}: ${r} é de ${g.join(',')}`);
  }
});

const comodo = (funcao: string, nome: string): MapaAtlas => {
  const m = mapaCom(sala('c', 0, 0, 6, 5, { name: nome, function: funcao }));
  m.openings.p = abertura(m, 'p', paredeEm(m, 'x', 0, 5.4)!.id, 0.5);
  return m;
};
const novas: Record<string, string[]> = {
  capela: ['pulpito', 'pia-batismal', 'tocheiro', 'velas-votivas', 'confessionario', 'imagem-de-santo', 'orgao-de-tubos', 'vitral', 'crucifixo', 'icone.parede', 'pia-de-agua-benta'],
  forja: ['fornalha', 'pedra-de-amolar', 'tina-de-agua', 'suporte-de-armas', 'suporte-de-lancas', 'mesa-de-armas', 'bancada.trabalho', 'manequim-de-armadura', 'barril-de-flechas', 'tocha.parede', 'escudo.parede', 'machados.cruzados', 'lancas.parede'],
  taverna: ['tocha.parede', 'machados.cruzados', 'escudo.parede', 'arco.parede', 'espeto-de-assar', 'mesa.taverna', 'mesa.redonda-rustica', 'banqueta'],
};

for (const [funcao, receitas] of Object.entries(novas)) test(`${funcao} de 6x5 m em fantasia: sem sobreposição bloqueante e com receita nova`, () => {
  for (const semente of [1, 2, 3, 4, 5]) {
    const m = comodo(funcao, funcao), l = gerarLayout(m, { roomId: 'c', funcao, genero: 'fantasia', semente, gerarId: contador() });
    assert.ok(l.objetos.some(o => receitas.includes(receitaDe(o))), `semente ${semente}: nenhuma receita nova`);
    const depois = { ...m, props: { ...m.props, ...Object.fromEntries(l.objetos.map(o => [o.id, o])) } }, ins = insightDoComodo(depois, 'c')!;
    const caixas = l.objetos.filter(x => x.elevation === 'floor' && x.blocks.move).map(o => ins.objetos.find(x => x.id === o.id)!.caixa);
    for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) { const a = caixas[i]!, b = caixas[j]!; assert.ok(!(a.x0 < b.x1 - 1e-6 && a.x1 > b.x0 + 1e-6 && a.y0 < b.y1 - 1e-6 && a.y1 > b.y0 + 1e-6), `semente ${semente}: móveis ${i} e ${j} se sobrepõem`); }
  }
});
