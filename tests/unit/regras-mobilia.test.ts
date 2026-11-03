import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENEROS, TIPOS_DE_COMODO } from '../../src/domain/presets.ts';
import { receitaDe } from '../../src/procedural/receitas.ts';
import { REGRAS_DE_MOBILIA, VARIACOES_DE_GENERO, regrasPara } from '../../src/authoring/regras-mobilia.ts';

const funcoes = TIPOS_DE_COMODO.map(t => t.funcao);

test('toda função de TIPOS_DE_COMODO tem regra', () => {
  for (const f of funcoes) assert.ok(REGRAS_DE_MOBILIA[f]?.length, f);
  for (const f of Object.keys(REGRAS_DE_MOBILIA)) assert.ok(funcoes.includes(f), `regra para função desconhecida: ${f}`);
});

for (const genero of GENEROS.map(g => g.id)) for (const funcao of funcoes) {
  test(`regras de ${funcao} (${genero}): receitas existem e são do tipo certo; junto aponta para item da regra com prioridade menor`, () => {
    const regras = regrasPara(funcao, genero), ids = new Set(regras.map(r => r.id));
    assert.equal(ids.size, regras.length, 'ids únicos');
    for (const r of regras) {
      assert.ok(r.receitas.length > 0, r.id);
      for (const nome of [...r.receitas, ...(r.porArea?.map(p => p[1]) ?? [])]) {
        const rec = receitaDe(nome); assert.ok(rec, `${r.id}: a receita “${nome}” não existe`);
        assert.equal(rec!.tipo === 'parede', r.lugar === 'na-parede', `${r.id}/${nome}: só receitas de parede vão “na-parede”, e elas só vão lá`);
      }
      assert.ok(r.quantos[0] >= 0 && r.quantos[1] >= r.quantos[0] && r.quantos[1] > 0, r.id);
      if (r.lugar === 'junto') {
        assert.ok(r.junto, `${r.id} é “junto” e precisa de âncora`);
        const ancora = regras.find(x => x.id === r.junto!.de); assert.ok(ancora, `${r.id}: a âncora “${r.junto!.de}” não está na regra`);
        assert.ok(ancora!.prioridade < r.prioridade, `${r.id}: a âncora vem antes`);
      }
    }
    assert.deepEqual(regras.map(r => r.prioridade), [...regras.map(r => r.prioridade)].sort((a, b) => a - b), 'ordenadas por prioridade');
  });
}

test('o gênero muda a mobília: fantasia não tem cadeira na taverna nem na cozinha nem sofá; moderno não tem estante no quarto; investigação é o padrão', () => {
  const receitas = (f: string, g: string) => regrasPara(f, g).flatMap(r => r.receitas);
  assert.ok(!receitas('taverna', 'fantasia').includes('cadeira')); assert.ok(receitas('taverna', 'fantasia').includes('banco'));
  assert.ok(!receitas('cozinha', 'fantasia').includes('cadeira'));
  assert.ok(!receitas('sala', 'fantasia').includes('sofa')); assert.ok(receitas('sala', 'fantasia').includes('poltrona'));
  assert.ok(receitas('quarto', 'investigacao').includes('estante')); assert.ok(!receitas('quarto', 'moderno').includes('estante'));
  assert.deepEqual(regrasPara('quarto', 'investigacao'), regrasPara('quarto', 'genero-que-nao-existe'));
  assert.deepEqual(Object.keys(VARIACOES_DE_GENERO).sort(), GENEROS.map(g => g.id).sort());
  assert.deepEqual(regrasPara('funcao-inexistente', 'moderno'), []);
});

test('o quarto troca a cama de solteiro pela de casal quando é grande', () => {
  const cama = regrasPara('quarto', 'investigacao').find(r => r.id === 'cama')!;
  assert.deepEqual(cama.receitas, ['cama.solteiro']); assert.deepEqual(cama.porArea, [[12, 'cama.casal']]);
});
