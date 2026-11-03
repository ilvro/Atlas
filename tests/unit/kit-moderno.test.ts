import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aceitarProposta } from '../../src/authoring/proposta.ts';
import { proximaSugestao } from '../../src/authoring/sugestoes.ts';
import { caixaDasPartes } from '../../src/procedural/descricao.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { descreverReceita, pegadaDaReceita } from '../../src/procedural/receitas/index.ts';
import { RECEITAS_MODERNAS } from '../../src/procedural/receitas/moderno.ts';
import { PALETAS_POR_GENERO, paramsDaPaleta } from '../../src/authoring/mobiliar.ts';
import { REGRAS_DE_MOBILIA, regrasPara } from '../../src/authoring/regras-mobilia.ts';
import { materialDe, MATERIAIS } from '../../src/procedural/materiais.ts';
import { criarStore } from '../../src/state/store.ts';
import { mapaCom, sala, verificarCasa } from './apoio-casa.ts';

test('as receitas do kit moderno desenham sem erro, com pegada estável e partes dentro da pegada', () => {
  assert.ok(RECEITAS_MODERNAS.length >= 10);
  for (const r of RECEITAS_MODERNAS) {
    assert.deepEqual(r.generos, ['moderno']); assert.equal(r.kit, 'moderno');
    const d = descreverReceita(r.id, { seed: 1, params: {} }); assert.ok(d.tipo === 'piso' && d.partes.length >= 3, r.id);
    assert.deepEqual(pegadaDaReceita(r.id), r.pegada, `${r.id}: pegada declarada × desenhada`);
    const c = caixaDasPartes(d.tipo === 'piso' ? d.partes : []); assert.ok(c.x1 - c.x0 <= r.pegada[0] + 0.2 && c.y1 - c.y0 <= r.pegada[1] + 0.2, `${r.id}: partes passam da pegada`);
    assert.ok(ACERVO.item(r.id), r.id);
  }
});

test('o gênero moderno troca os itens antigos pelos novos e não usa os do kit investigação', () => {
  const ids = (f: string) => regrasPara(f, 'moderno').flatMap(r => r.receitas);
  assert.ok(ids('sala').includes('sofa.canto') && ids('sala').includes('rack.tv') && !ids('sala').includes('lareira.marmore'));
  assert.ok(ids('quarto').includes('cama.box') && ids('quarto').includes('guarda-roupa.liso') && !ids('quarto').some(i => i.startsWith('cama.casal')));
  assert.ok(['geladeira', 'fogao', 'balcao'].every(i => ids('cozinha').includes(i)));
  assert.ok(['vaso.moderno', 'box.banheiro'].every(i => ids('banheiro').includes(i)) && !ids('banheiro').includes('banheira.pes'));
  assert.ok(ids('escritorio').includes('escrivaninha.computador')); assert.ok(ids('sala-de-jantar').includes('mesa.vidro') && !ids('sala-de-jantar').includes('cristaleira'));
  for (const funcao of Object.keys(REGRAS_DE_MOBILIA)) for (const i of ids(funcao)) assert.ok(!(ACERVO.item(i)?.generos ?? []).includes('investigacao') || (ACERVO.item(i)?.generos ?? []).includes('moderno'), `${funcao}: ${i} é só da investigação`);
});

test('as paletas e os materiais do moderno existem e são claros', () => {
  for (const p of PALETAS_POR_GENERO.moderno!) for (const id of [p.madeira, p.tapete, ...p.tecidos]) { assert.ok(MATERIAIS[id], id); assert.equal(materialDe(id).uso, 'objeto'); }
  assert.equal(paramsDaPaleta(PALETAS_POR_GENERO.moderno![0]!, 'cama.box').cobertor, 'tecido.mostarda', 'o edredom leva o tom de destaque da paleta');
  assert.equal(paramsDaPaleta(PALETAS_POR_GENERO.moderno![0]!, 'sofa.canto').estofado, 'tecido.cinza');
});

test('a mesma casa de três cômodos mobiliada de moderno não lembra a de investigação, e é jogável', () => {
  const casa = (genero: string) => {
    const m = mapaCom(sala('a', 0, 0, 4, 3, { name: 'Sala' }), sala('b', 4, 0, 8, 3, { name: 'Cozinha' }), sala('c', 8, 0, 12, 3, { name: 'Quarto' })); m.style = { ...m.style, genre: genero };
    const store = criarStore(m);
    for (let v = 0; v < 12; v++) { let andou = false; for (const id of Object.keys(store.documento.rooms)) { const p = proximaSugestao({ m: store.documento, versao: store.versaoEdicao, semente: 0 }, id, new Set()); if (p) { aceitarProposta(store, p); andou = true; } } if (!andou) break; }
    return store.documento;
  };
  const moderna = casa('moderno'), antiga = casa('investigacao');
  verificarCasa(moderna, { Sala: 'sala', Cozinha: 'cozinha', Quarto: 'quarto' });
  const itens = (m: ReturnType<typeof casa>) => new Set(Object.values(m.props).map(o => ACERVO.idDaFonte(o.source)));
  const so = (a: Set<string>, b: Set<string>) => [...a].filter(i => !b.has(i));
  assert.ok(so(itens(moderna), itens(antiga)).length >= 3, `só ${so(itens(moderna), itens(antiga)).join(', ')} é novo`);
  assert.ok(![...itens(moderna)].some(i => i.startsWith('casa:chesterfield') || i === 'lareira.marmore'));
  assert.ok(moderna.climate.preset && Object.values(moderna.lights).every(l => l.power === 'grid'), 'as luzes do moderno são de rede');
});
