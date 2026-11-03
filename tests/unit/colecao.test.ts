import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ErroDeValidacao } from '../../src/domain/esquema.ts';
import { COLECAO, validarColecao, type ItemDaColecao } from '../../src/procedural/colecao.ts';

const RAIZ = join(import.meta.dirname, '../../public/colecao'), LICENCAS = readFileSync(join(import.meta.dirname, '../../docs/LICENCAS.md'), 'utf8');
const KB = 1024, MB = 1024 * 1024;

const gerado = (id = 'casa:teste', extra: Partial<ItemDaColecao> = {}): ItemDaColecao => ({ id, nome: 'Teste', arquivo: `gerados/${id.slice(5)}.webp`, categoria: 'decoracao', pegada: [1, 1], funcoes: ['sala'], tags: [], generos: [], kit: null, origem: { tipo: 'gerado', gerador: 'g', params: {}, seed: 1, versao: 1 }, ...extra });
const achado = (id = 'casa:achado', origem: Record<string, unknown> = {}): ItemDaColecao => gerado(id, { origem: { tipo: 'achado', autor: 'Fulano', fonte: 'OpenGameArt', url: 'https://opengameart.org/x', licenca: 'CC0-1.0', arquivoOriginal: 'x.png', ...origem } as never });
const catalogo = (...itens: unknown[]) => ({ versao: 1, itens });
const recusa = (itens: unknown[], aviso: RegExp) => assert.throws(() => validarColecao(catalogo(...itens)), (e: unknown) => e instanceof ErroDeValidacao && aviso.test(e.message));

test('validarColecao aceita itens gerados e achados com licença permitida', () => {
  assert.equal(validarColecao(catalogo(gerado(), achado(), achado('casa:com-credito', { licenca: 'CC-BY-4.0' }))).length, 3);
  assert.deepEqual(validarColecao(catalogo()), []);
});

test('validarColecao recusa item sem licença, licença que não permite redistribuir, id sem “casa:”, pegada zero e o resto do que está errado', () => {
  recusa([achado('casa:a', { licenca: undefined })], /Licença não aceita/);
  recusa([achado('casa:a', { licenca: 'CC-BY-NC-4.0' })], /Licença não aceita/);
  recusa([achado('casa:a', { licenca: 'uso pessoal' })], /Licença não aceita/);
  recusa([achado('casa:a', { autor: '' })], /sem autor/);
  recusa([gerado('sofa')], /começar com “casa:”/);
  recusa([gerado('casa:a', { pegada: [0, 1] })], /pegada/);
  recusa([gerado('casa:a', { pegada: [1, -1] })], /pegada/);
  recusa([gerado('casa:a'), gerado('casa:a')], /repetido/);
  recusa([gerado('casa:a', { categoria: 'inexistente' as never })], /Categoria/);
  recusa([gerado('casa:a', { funcoes: ['sala-de-estrelas'] })], /Função/);
  recusa([gerado('casa:a', { arquivo: '../fora.webp' })], /arquivo/);
  recusa([{ ...gerado('casa:a'), origem: { tipo: 'misteriosa' } }], /origem/);
  assert.throws(() => validarColecao({ versao: 2, itens: [] }), ErroDeValidacao);
});

function arquivosDe(dir: string): string[] { return readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? arquivosDe(p) : [p]; }); }

test('a coleção da casa: ids únicos com prefixo, todo arquivo existe e todo arquivo está no catálogo', () => {
  assert.equal(new Set(COLECAO.map(i => i.id)).size, COLECAO.length);
  for (const i of COLECAO) { assert.match(i.id, /^casa:/); assert.ok(statSync(join(RAIZ, i.arquivo), { throwIfNoEntry: false })?.isFile(), `falta ${i.arquivo}`); assert.ok(i.pegada[0] > 0 && i.pegada[1] > 0); }
  const noDisco = arquivosDe(RAIZ).map(p => relative(RAIZ, p)).filter(p => p !== 'colecao.json').sort(), noCatalogo = COLECAO.map(i => i.arquivo).sort();
  assert.deepEqual(noDisco, noCatalogo, 'cada arquivo de public/colecao/ (fora o JSON) está no catálogo, e vice-versa');
});

test('todo item da coleção aparece em LICENCAS.md, e todo achado tem licença aceita', () => {
  for (const i of COLECAO) {
    assert.ok(LICENCAS.includes(i.arquivo), `${i.arquivo} não está em docs/LICENCAS.md`);
    if (i.origem.tipo === 'achado') { assert.ok(['CC0-1.0', 'CC-BY-4.0'].includes(i.origem.licenca)); assert.ok(LICENCAS.includes(i.origem.autor), `${i.arquivo}: o autor não está em LICENCAS.md`); }
  }
});

test('tamanhos: cada arquivo até 400 KB e a coleção inteira até 15 MB', () => {
  let total = 0;
  for (const p of arquivosDe(RAIZ)) { const t = statSync(p).size; total += t; if (p.endsWith('colecao.json')) continue; assert.ok(t <= 400 * KB, `${relative(RAIZ, p)} tem ${(t / KB).toFixed(0)} KB (o limite é 400)`); }
  assert.ok(total <= 15 * MB, `public/colecao/ tem ${(total / MB).toFixed(1)} MB (o limite é 15)`);
});
