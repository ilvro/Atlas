import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ferramentasDeLeitura, resumirMapa, type ContextoDeLeitura } from '../../src/app/ponte-leitura.ts';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { listaDeReceitas } from '../../src/procedural/receitas/index.ts';
import { PRESETS_DE_CLIMA } from '../../src/domain/presets.ts';

const entreposto = lerMapa(JSON.parse(readFileSync('public/exemplos/entreposto-do-rio.atlas.json', 'utf8')));
const covil = lerMapa(JSON.parse(readFileSync('public/exemplos/covil-na-caverna.atlas.json', 'utf8')));
const outro = criarMapa({ id: 'outro', nome: 'Outro' });

function montar(aberto: typeof covil | null) {
  const abertos: string[] = [];
  const mapas = [covil, outro];
  const ctx: ContextoDeLeitura = {
    repo: () => ({
      listar: async () => mapas.map(m => ({ id: m.id, nome: m.name, revisao: m.revision, criadoEm: m.createdAt, atualizadoEm: m.updatedAt, campanhaId: m.campanhaId, comodos: Object.keys(m.rooms).length, objetos: Object.keys(m.props).length, luzes: Object.keys(m.lights).length, pecas: Object.keys(m.tokens).length, celulas: [30, 23] as [number, number], area: 0 })),
      obter: async id => mapas.find(m => m.id === id),
    }),
    mapaAberto: () => aberto, abrirMapa: async id => { abertos.push(id); },
  };
  const f = Object.fromEntries(ferramentasDeLeitura(ctx).map(x => [x.nome, x]));
  const chamar = async (nome: string, args: Record<string, unknown> = {}) => {
    const c = (await f[nome]!.executar(args))[0]!;
    assert.equal(c.tipo, 'texto');
    return c.texto;
  };
  return { f, chamar, abertos };
}

test('as ferramentas têm nome, descrição e esquema de objeto', () => {
  const { f } = montar(null);
  assert.deepEqual(Object.keys(f), ['atlas_o_que_vejo', 'atlas_mapas_listar', 'atlas_mapa_ler', 'atlas_catalogo', 'atlas_abrir', 'atlas_ver_mapa']);
  for (const x of Object.values(f)) { assert.ok(x.descricao.length > 20); assert.equal(x.esquema.type, 'object'); }
});

test('atlas_mapas_listar lista os mapas e o aberto', async () => {
  const { chamar } = montar(covil);
  const r = JSON.parse(await chamar('atlas_mapas_listar'));
  assert.equal(r.aberto, covil.id);
  assert.deepEqual(r.mapas.map((m: { id: string }) => m.id), [covil.id, 'outro']);
});

test('atlas_mapa_ler do covil: contagens certas, sem células cruas e curto', async () => {
  const { chamar } = montar(covil);
  const texto = await chamar('atlas_mapa_ler');
  assert.ok(texto.length < 8000, `grande demais: ${texto.length}`);
  const r = JSON.parse(texto);
  assert.equal(r.id, covil.id);
  assert.equal(r.objetos.reduce((s: number, g: { quantidade: number }) => s + g.quantidade, 0), Object.keys(covil.props).length);
  assert.equal(r.luzes.length, Object.keys(covil.lights).length);
  assert.equal(r.regioes.length, Object.keys(covil.regions).length);
  assert.equal(r.terreno.camadas.length, Object.keys(covil.terrain.layers).length);
  assert.equal(r.pecas.length, Object.keys(covil.tokens).length);
  assert.ok(r.terreno.camadas.every((c: { celulas: number }) => c.celulas > 0));
  assert.ok(!texto.includes('"cells"'));
  assert.equal(resumirMapa(covil).nome, covil.name);
});

test('atlas_mapa_ler por id e com id desconhecido', async () => {
  const { chamar } = montar(null);
  assert.equal(JSON.parse(await chamar('atlas_mapa_ler', { id: 'outro' })).nome, 'Outro');
  await assert.rejects(chamar('atlas_mapa_ler', { id: 'nao-existe' }), /Não existe mapa/);
  await assert.rejects(chamar('atlas_mapa_ler'), /Não há mapa aberto/);
});

test('atlas_catalogo lista todas as receitas com os campos', async () => {
  const { chamar } = montar(null);
  const r = JSON.parse(await chamar('atlas_catalogo', { parte: 'receitas' })) as { id: string; campos?: { id: string; padrao: unknown }[] }[];
  const todas = listaDeReceitas();
  assert.deepEqual(r.map(x => x.id), todas.map(x => x.id));
  const comCampos = todas.find(x => x.campos?.length)!;
  assert.deepEqual(r.find(x => x.id === comCampos.id)!.campos!.map(c => c.id), comCampos.campos!.map(c => c.id));
});

test('atlas_catalogo: demais partes, índice e parte inválida', async () => {
  const { chamar } = montar(null);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'colecao' })).length > 0);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'materiais' })).piso.length > 0);
  assert.equal(JSON.parse(await chamar('atlas_catalogo', { parte: 'climas' })).climas.length, PRESETS_DE_CLIMA.length);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'luzes' })).length > 0);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'presenca' })).pincéis.length > 0);
  const mo = JSON.parse(await chamar('atlas_catalogo', { parte: 'momentos' }));
  assert.equal(mo.limites.passosPorMomento, 60);
  assert.equal(mo.tiposDePasso.length, 14);
  assert.ok(JSON.parse(await chamar('atlas_catalogo')).partes.receitas > 0);
  await assert.rejects(chamar('atlas_catalogo', { parte: 'xyz' }), /Parte desconhecida/);
});

test('atlas_abrir navega até o mapa e recusa id que não existe', async () => {
  const { chamar, abertos } = montar(null);
  await chamar('atlas_abrir', { id: 'outro' });
  assert.deepEqual(abertos, ['outro']);
  await assert.rejects(chamar('atlas_abrir', { id: 'x' }), /Não existe mapa/);
  await assert.rejects(chamar('atlas_abrir', {}), /Falta/);
});

test('atlas_o_que_vejo: mapa, modo, câmera e seleção de um cômodo e dois objetos', async () => {
  const comodo = Object.values(entreposto.rooms)[0]!, objetos = Object.values(entreposto.props).slice(0, 2);
  assert.equal(objetos.length, 2);
  const ctx: ContextoDeLeitura = {
    repo: () => null, mapaAberto: () => entreposto, abrirMapa: async () => {},
    modo: () => 'sessao', caixaVisivel: () => ({ x0: 1.04, y0: 2, x1: 31.5, y1: 20 }),
    selecao: () => [{ colecao: 'rooms', id: comodo.id }, ...objetos.map(o => ({ colecao: 'props' as const, id: o.id })), { colecao: 'props', id: 'fantasma' }],
  };
  const f = ferramentasDeLeitura(ctx).find(x => x.nome === 'atlas_o_que_vejo')!;
  const r = JSON.parse(((await f.executar({}))[0] as { texto: string }).texto);
  assert.deepEqual(r.mapa, { id: entreposto.id, nome: entreposto.name });
  assert.equal(r.modo, 'Sessão');
  assert.deepEqual(r.camera.caixa, [1, 2, 31.5, 20]);
  assert.deepEqual(r.selecao.map((s: { id: string }) => s.id), [comodo.id, ...objetos.map(o => o.id)]);
  assert.equal(r.selecao[0].tipo, 'comodo'); assert.equal(r.selecao[0].nome, comodo.name);
  assert.equal(r.selecao[1].tipo, 'objeto'); assert.equal(typeof r.selecao[1].nome, 'string');
  assert.equal(r.selecao[1].posicao.length, 2);
});

test('atlas_o_que_vejo sem mapa aberto', async () => {
  const { chamar } = montar(null);
  assert.equal(JSON.parse(await chamar('atlas_o_que_vejo')).mapa, null);
});

test('atlas_ver_mapa: captura com sucesso, com aviso, e trata erro como texto', async () => {
  const ctx: ContextoDeLeitura = {
    repo: () => null,
    mapaAberto: () => covil,
    abrirMapa: async () => {},
    capturar: async (opcoes) => {
      if (opcoes.ladoMaximo === 666) throw new Error('simulação de falha');
      return {
        dataUrl: 'data:image/jpeg;base64,1234',
        largura: 800,
        altura: 600,
        pxPorMetro: 40,
        bytes: 12345,
        qualidade: 0.85,
        caixa: { x0: 0, y0: 0, x1: 20, y1: 15 },
        ...(opcoes.ladoMaximo === 999 ? { aviso: 'a cena ainda estava pintando; a imagem pode estar incompleta' } : {}),
      };
    },
  };
  const f = ferramentasDeLeitura(ctx).find(x => x.nome === 'atlas_ver_mapa')!;

  // Sucesso normal
  const r1 = await f.executar({});
  assert.equal(r1.length, 2);
  assert.equal(r1[0]!.tipo, 'imagem');
  assert.equal(r1[1]!.tipo, 'texto');
  assert.match((r1[1] as { texto: string }).texto, /800×600 px/);
  assert.ok(!(r1[1] as { texto: string }).texto.includes('Aviso:'));

  // Com aviso
  const r2 = await f.executar({ ladoMaximo: 999 });
  assert.equal(r2.length, 2);
  assert.match((r2[1] as { texto: string }).texto, /Aviso: a cena ainda estava pintando/);

  // Com erro lançado
  const r3 = await f.executar({ ladoMaximo: 666 });
  assert.equal(r3.length, 1);
  assert.equal(r3[0]!.tipo, 'texto');
  assert.equal((r3[0] as { texto: string }).texto, 'não consegui capturar: simulação de falha');
});
