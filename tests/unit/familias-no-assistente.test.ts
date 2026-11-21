import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arranjar } from '../../src/authoring/arranjo.ts';
import { ErroDeConstrucao, aplicarEmCopia, objetos } from '../../src/authoring/construcao.ts';
import { TODOS_OS_CONJUNTOS, espalhar, receitasDoItem, type ConjuntoDeEspalhar } from '../../src/authoring/espalhar.ts';
import { catalogo } from '../../src/app/ponte-leitura.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';

const vazio = () => criarMapa({ id: 'teste', nome: 'Teste', agora: 1, largura: 40, altura: 40 });
const idDe = (o: { source: { kind: string; recipe?: string; assetId?: string } }) => o.source.kind === 'recipe' ? o.source.recipe! : o.source.assetId!;

test('o conjunto de teste com uma família produz só itens daquela família', () => {
  const arvores = ACERVO.familia('arvore')!;
  const conjunto: ConjuntoDeEspalhar = { id: 'so-arvores', nome: 'Árvores', descricao: '', densidade: 0.15, itens: [{ familia: 'arvore', peso: 1, contexto: 'livre' }] };
  TODOS_OS_CONJUNTOS_MUTAVEL.push(conjunto);
  try {
    const novos = espalhar(vazio(), { centro: [20, 20], raio: 12, conjunto: 'so-arvores', semente: 5 });
    assert.ok(novos.length >= 5);
    for (const o of novos) assert.ok(arvores.itens.includes(idDe(o)), idDe(o));
    assert.ok(new Set(novos.map(idDe)).size > 1, 'as variantes variam');
  } finally { TODOS_OS_CONJUNTOS_MUTAVEL.pop(); }
});
test('os conjuntos convertidos mantêm o peso total e só citam famílias que existem', () => {
  const mata = TODOS_OS_CONJUNTOS.find(c => c.id === 'mata')!;
  assert.equal(mata.itens.reduce((s, i) => s + i.peso, 0), 2 + 3 + 1 + 2 + 1 + 2 + 1 + 2 + 1 + 1 + 1);
  for (const c of TODOS_OS_CONJUNTOS) for (const i of c.itens) if (i.familia !== undefined) { assert.ok(ACERVO.familia(i.familia), `${c.id}: ${i.familia}`); assert.ok(receitasDoItem(i).length > 0); }
  assert.ok(TODOS_OS_CONJUNTOS.some(c => c.itens.some(i => i.familia !== undefined)));
});
test('o catálogo traz a parte familias, a família de cada item e a busca casa o nome da família', () => {
  const fam = catalogo('familias') as { grupo: string; id: string; nome: string; itens: string[] }[];
  assert.equal(fam.length, ACERVO.familias().length);
  assert.deepEqual(fam.find(f => f.id === 'arvore')!.itens, ACERVO.familia('arvore')!.itens);
  const rec = catalogo('colecao') as { id: string; familia?: string }[];
  assert.equal(rec.find(i => i.id === 'casa:arvore-5m')!.familia, 'arvore');
  const achadas = (catalogo(undefined, 'árvore') as { familias: { id: string }[] }).familias;
  assert.ok(achadas.some(f => f.id === 'arvore'));
  const conjuntos = catalogo('conjuntos') as { id: string; itens: string[] }[];
  assert.ok(conjuntos.find(c => c.id === 'mata')!.itens.includes('familia:arvore'));
});
test('familia:<id> em atlas_objetos vira uma das variantes, pela semente', () => {
  const pedidos = Array.from({ length: 12 }, (_, i) => ({ item: 'familia:arvore', pos: [4 + i * 3, 10] as [number, number] }));
  const c = objetos(vazio(), pedidos, 3);
  const m = aplicarEmCopia(vazio(), c.comandos); validarMapa(m);
  const itens = Object.values(m.props).map(idDe), variantes = ACERVO.familia('arvore')!.itens;
  assert.ok(itens.every(i => variantes.includes(i)));
  assert.ok(new Set(itens).size > 1);
  assert.deepEqual(objetos(vazio(), pedidos, 3, (p) => p + '1').comandos.map(x => JSON.stringify(x)), objetos(vazio(), pedidos, 3, (p) => p + '1').comandos.map(x => JSON.stringify(x)), 'mesma semente, mesmo resultado');
  assert.throws(() => objetos(vazio(), [{ item: 'familia:nao-existe', pos: [1, 1] }]), (e: unknown) => e instanceof ErroDeConstrucao && /família “familia:nao-existe” não existe/.test(e.message));
});
test('familia:pedra em atlas_arranjo também sorteia variantes', () => {
  const r = arranjar(vazio(), { padrao: 'grade-solta', area: { retangulo: [4, 4, 24, 14] }, itens: [{ item: 'familia:pedra' }], espacamento: [3, 3] }, 4);
  const m = aplicarEmCopia(vazio(), r.comandos), variantes = ACERVO.familia('pedra')!.itens;
  assert.ok(Object.keys(m.props).length > 3);
  assert.ok(Object.values(m.props).every(o => variantes.includes(idDe(o))));
  assert.throws(() => arranjar(vazio(), { padrao: 'grade-solta', area: { retangulo: [4, 4, 10, 10] }, itens: [{ item: 'familia:xyz' }], espacamento: [3, 3] }, 1), /família/);
});
const TODOS_OS_CONJUNTOS_MUTAVEL = TODOS_OS_CONJUNTOS as ConjuntoDeEspalhar[];
