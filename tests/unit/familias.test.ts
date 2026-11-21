import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { BIOMAS, FAMILIAS, GRUPOS_DE_OBJETOS, familiasVisiveis } from '../../src/procedural/familias.ts';
import { GRUPOS_DE_TERRENO } from '../../src/procedural/grupos-de-terreno.ts';
import { GENEROS } from '../../src/domain/presets.ts';
import { listaDeReceitas } from '../../src/procedural/receitas/index.ts';

test('todo item do acervo está em exatamente uma família', () => {
  const contagem = new Map<string, number>();
  for (const f of FAMILIAS) for (const i of f.itens) contagem.set(i, (contagem.get(i) ?? 0) + 1);
  for (const item of ACERVO.lista()) assert.equal(contagem.get(item.id), 1, item.id);
});
test('toda família tem itens, e todo item existe', () => {
  for (const f of FAMILIAS) {
    assert.ok(f.itens.length > 0, f.id);
    for (const i of f.itens) assert.ok(ACERVO.item(i), `${f.id}: ${i}`);
  }
});
test('todo grupo existe e tem famílias', () => {
  const grupos = new Set(GRUPOS_DE_OBJETOS.map(g => g.id));
  for (const f of FAMILIAS) assert.equal(grupos.has(f.grupo), true, f.id);
  for (const g of GRUPOS_DE_OBJETOS) assert.equal(FAMILIAS.some(f => f.grupo === g.id), true, g.id);
});
test('ids de família são únicos', () => {
  assert.equal(new Set(FAMILIAS.map(f => f.id)).size, FAMILIAS.length);
});
test('nenhuma família mistura piso e parede', () => {
  for (const f of FAMILIAS) assert.equal(new Set(f.itens.map(i => ACERVO.item(i)?.tipo)).size, 1, f.id);
});
test('familiaDoItem acha a família das árvores', () => {
  assert.equal(ACERVO.familiaDoItem('casa:arvore-5m')?.id, 'arvore');
  assert.ok(ACERVO.familia('arvore')?.itens.includes('casa:arvore-3m'));
  assert.equal(ACERVO.familiaDoItem('nao-existe'), undefined);
});

// Gênero ainda não criado em `GENEROS` (a ficha E4 o cria); sai daqui então.
const GENEROS_PLANEJADOS = ['ficcao-cientifica'];
test('todo gênero e bioma citado nas famílias existe', () => {
  const generos = new Set([...GENEROS.map(g => g.id), ...GENEROS_PLANEJADOS]), biomas = new Set<string>(BIOMAS.map(b => b.id));
  for (const f of FAMILIAS) {
    for (const g of f.generos ?? []) assert.ok(generos.has(g), `${f.id}: gênero ${g}`);
    for (const b of f.biomas ?? []) assert.ok(biomas.has(b), `${f.id}: bioma ${b}`);
  }
  for (const g of GRUPOS_DE_TERRENO) for (const b of g.biomas ?? []) assert.ok(biomas.has(b), `${g.id}: bioma ${b}`);
});
test('receita com gêneros e família com gêneros se cruzam; família atemporal não tem só receitas marcadas', () => {
  const porFamilia = new Map<string, { marcadas: number; total: number }>();
  for (const r of listaDeReceitas()) {
    const fam = ACERVO.familiaDoItem(r.id);
    if (!fam) continue;
    const c = porFamilia.get(fam.id) ?? { marcadas: 0, total: 0 };
    c.total++;
    if (r.generos?.length) {
      c.marcadas++;
      // Família marcada: todo gênero de receita marcada tem de cruzar com os dela.
      if (fam.generos?.length) assert.ok(r.generos.some(g => fam.generos!.includes(g)), `${fam.id} (${r.id}): ${r.generos} x ${fam.generos}`);
    }
    porFamilia.set(fam.id, c);
  }
  // Família sem `generos` só é aceita se ao menos uma receita dela também for livre (o caixote tem uma receita só de ficção científica e várias livres).
  for (const [id, c] of porFamilia) if (c.marcadas > 0 && c.marcadas === c.total) assert.ok(ACERVO.familia(id)?.generos?.length, `${id}: todas as receitas têm gêneros, a família também deveria`);
});
test('familiasVisiveis filtra por gênero e bioma e deixa passar o atemporal', () => {
  const ids = (g: string | null, b: string | null) => familiasVisiveis(g, b).map(f => f.id);
  assert.equal(ids('fantasia', null).includes('notebook'), false);
  assert.equal(ids('fantasia', null).includes('caixote'), true);
  assert.equal(ids(null, null).length, FAMILIAS.length);
  assert.equal(ids(null, 'deserto').includes('arvore-nevada'), false);
  assert.equal(ids(null, 'deserto').includes('pedra'), true);
});
