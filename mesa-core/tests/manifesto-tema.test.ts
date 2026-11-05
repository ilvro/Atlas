import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAVE_TEMA, aplicarTema, criarRef, descobrir, enderecoDaRef, gravarTema, lerTema, luminancia, observarTema, resolverRota, textoSobre, tokensDoTema, validarManifesto, type Manifesto } from '../src/index.ts';

const atlas: Manifesto = {
  app: 'atlas', nome: 'Atlas', contrato: 1, icone: './icone.svg',
  rotas: { mapa: './#/mapa/{id}', comodo: './#/mapa/{pai}/comodo/{filho}' },
  oferece: ['mapa', 'comodo'], emite: ['atlas.cena-aberta', 'atlas.regiao-entrou'], atende: ['atlas.focar'],
};

test('manifesto válido passa; o que foge do contrato é recusado com o motivo', () => {
  assert.equal(validarManifesto(atlas).ok, true);
  const erro = (m: unknown) => { const r = validarManifesto(m); return r.ok ? 'ok' : r.erro; };
  assert.match(erro({ ...atlas, contrato: 2 }), /Contrato 2/);
  assert.match(erro({ ...atlas, app: 'x' }), /desconhecido/);
  assert.match(erro({ ...atlas, extra: 1 }), /Campo desconhecido/);
  assert.match(erro({ ...atlas, rotas: { mapa: './sem-marcador' } }), /marcador/);
  assert.match(erro({ ...atlas, emite: ['ficha.rolagem'] }), /não é um fato de atlas/);
  assert.match(erro({ ...atlas, atende: ['jukebox.tocar'] }), /não é um pedido de atlas/);
  assert.match(erro({ ...atlas, emite: ['atlas.nada'] }), /não é um fato/);
});

test('rotas: marcadores simples e compostos, com codificação', () => {
  assert.equal(resolverRota('./#/mapa/{id}', 'm1'), './#/mapa/m1');
  assert.equal(resolverRota('./#/mapa/{pai}/comodo/{filho}', 'm1/sala de estar'), './#/mapa/m1/comodo/sala%20de%20estar');
  assert.throws(() => resolverRota('./#/mapa/{pai}/comodo/{filho}', 'm1'), /precisa de “filho”/);
});

test('o endereço de uma referência só existe no aplicativo dono e para tipos com rota', () => {
  const base = 'https://ilvro.github.io/Atlas/';
  assert.equal(enderecoDaRef(atlas, criarRef('atlas', 'mapa', 'm1'), base), 'https://ilvro.github.io/Atlas/#/mapa/m1');
  assert.equal(enderecoDaRef(atlas, criarRef('atlas', 'comodo', 'm1/biblioteca'), base), 'https://ilvro.github.io/Atlas/#/mapa/m1/comodo/biblioteca');
  assert.equal(enderecoDaRef(atlas, criarRef('ficha', 'ficha', 's1'), base), null);
  assert.equal(enderecoDaRef(atlas, criarRef('atlas', 'token', 'm1/t'), base), null);
});

test('descobrir busca mesa.json ao lado e ignora respostas ruins', async () => {
  const vistas: string[] = [];
  const buscar = (corpo: unknown, ok = true) => (async (url: URL | RequestInfo) => { vistas.push(String(url)); return { ok, json: async () => corpo } as Response; }) as typeof fetch;
  assert.deepEqual(await descobrir('https://ilvro.github.io/Atlas/', buscar(atlas)), atlas);
  assert.deepEqual(vistas, ['https://ilvro.github.io/Atlas/mesa.json']);
  assert.equal(await descobrir('https://x/', buscar(atlas, false)), null);
  assert.equal(await descobrir('https://x/', buscar({ nada: 1 })), null);
  assert.equal(await descobrir('https://x/', (async () => { throw new Error('rede'); }) as typeof fetch), null);
});

test('tema: tokens, contraste e destaque próprio', () => {
  const ordem = tokensDoTema({ id: 'ordem' });
  assert.equal(ordem['--acento'], '#e91d25'); assert.equal(ordem['--acento-texto'], '#ffffff');
  const atlas = tokensDoTema({ id: 'atlas' });
  assert.equal(atlas['--acento'], '#14b3ae'); assert.equal(atlas['--acento-texto'], '#0b0c10'); assert.equal(atlas['--superficie'], '#101817');
  const prata = tokensDoTema({ id: 'vigilia' });
  assert.equal(prata['--acento-texto'], '#0b0c10');
  assert.equal(tokensDoTema({ id: 'neutro', acento: '#2E8B57' })['--acento'], '#2e8b57');
  assert.equal(tokensDoTema({ id: 'neutro', acento: 'verde' })['--acento'], '#d9a23b');
  assert.ok(luminancia('#ffffff') > 0.99 && luminancia('#000000') === 0);
  assert.equal(textoSobre('#101010'), '#ffffff');
  assert.match(String(ordem['--acento-escuro']), /^#[0-9a-f]{6}$/);
});

test('tema: leitura tolerante e gravação', () => {
  const guardado = new Map<string, string>();
  const armazenamento = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => { guardado.set(k, v); } };
  assert.deepEqual(lerTema(armazenamento), { id: 'atlas' });
  gravarTema(armazenamento, { id: 'vigilia', acento: '#aabbcc' });
  assert.deepEqual(lerTema(armazenamento), { id: 'vigilia', acento: '#aabbcc' });
  guardado.set(CHAVE_TEMA, '{lixo'); assert.deepEqual(lerTema(armazenamento), { id: 'atlas' });
  guardado.set(CHAVE_TEMA, JSON.stringify({ id: 'inexistente' })); assert.deepEqual(lerTema(armazenamento), { id: 'atlas' });
  guardado.set(CHAVE_TEMA, JSON.stringify({ id: 'neutro', acento: 'x' })); assert.deepEqual(lerTema(armazenamento), { id: 'neutro' });
  assert.doesNotThrow(() => gravarTema({ setItem: () => { throw new Error('cheio'); } }, { id: 'ordem' }));
});

test('tema: aplicar escreve tokens e atributos; observar reage ao evento storage de outra aba', () => {
  const props = new Map<string, string>(), alvo = { style: { setProperty: (n: string, v: string) => { props.set(n, v); } }, dataset: {} as Record<string, string | undefined> };
  aplicarTema(alvo, { id: 'vigilia' });
  assert.equal(props.get('--acento'), '#cfd8d3'); assert.equal(alvo.dataset.tema, 'vigilia'); assert.equal(alvo.dataset.transicao, 'tinta');

  const guardado = new Map<string, string>([[CHAVE_TEMA, JSON.stringify({ id: 'neutro' })]]);
  const armazenamento = { getItem: (k: string) => guardado.get(k) ?? null };
  const ouvintes = new Set<(e: Event) => void>();
  const janela = { addEventListener: (_: string, f: (e: Event) => void) => { ouvintes.add(f); }, removeEventListener: (_: string, f: (e: Event) => void) => { ouvintes.delete(f); } };
  const vistos: string[] = [];
  const parar = observarTema(janela as never, armazenamento, t => vistos.push(t.id));
  for (const f of ouvintes) f({ key: 'outra-chave' } as unknown as Event);
  for (const f of ouvintes) f({ key: CHAVE_TEMA } as unknown as Event);
  assert.deepEqual(vistos, ['neutro']);
  parar(); assert.equal(ouvintes.size, 0);
});
