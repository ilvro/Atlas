import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ferramentasDeLeitura, resumirMapa, type ContextoDeLeitura } from '../../src/app/ponte-leitura.ts';
import { codificar } from '../../src/domain/celulas.ts';
import { lerMapa } from '../../src/domain/migracoes.ts';
import { criarMapa, type Comodo } from '../../src/domain/mapa.ts';
import { circulo } from '../../src/domain/formas-de-comodo.ts';
import { listaDeReceitas } from '../../src/procedural/receitas/index.ts';
import { PRESETS_DE_CLIMA } from '../../src/domain/presets.ts';

const entreposto = lerMapa(JSON.parse(readFileSync('public/exemplos/entreposto-do-rio.atlas.json', 'utf8')));
const covil = lerMapa(JSON.parse(readFileSync('public/exemplos/covil-na-caverna.atlas.json', 'utf8')));
const outro = criarMapa({ id: 'outro', nome: 'Outro' });

function montar(aberto: typeof covil | null, extra: Partial<ContextoDeLeitura> = {}) {
  const abertos: string[] = [];
  const mapas = [covil, outro];
  const ctx: ContextoDeLeitura = {
    repo: () => ({
      listar: async () => mapas.map(m => ({ id: m.id, nome: m.name, revisao: m.revision, criadoEm: m.createdAt, atualizadoEm: m.updatedAt, campanhaId: m.campanhaId, comodos: Object.keys(m.rooms).length, objetos: Object.keys(m.props).length, luzes: Object.keys(m.lights).length, pecas: Object.keys(m.tokens).length, celulas: [30, 23] as [number, number], area: 0 })),
      obter: async id => mapas.find(m => m.id === id),
    }),
    mapaAberto: () => aberto, abrirMapa: async id => { abertos.push(id); },
    ...extra,
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
  assert.deepEqual(Object.keys(f), ['atlas_o_que_vejo', 'atlas_mapas_listar', 'atlas_mapa_ler', 'atlas_catalogo', 'atlas_abrir', 'atlas_revisar', 'atlas_ver_mapa']);
  for (const x of Object.values(f)) { assert.ok(x.descricao.length > 20); assert.equal(x.esquema.type, 'object'); }
  assert.ok(f.atlas_revisar!.descricao.length >= 60 && f.atlas_revisar!.descricao.length <= 180);
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

test('resumirMapa identifica contorno circular (>= 12 lados) e polígono arredondado a 0,1 m', () => {
  const m = criarMapa({ id: 'circ', nome: 'Farol' });
  m.rooms.r1 = {
    id: 'r1', name: 'Torre', function: 'torre', cells: codificar([[9, 9], [10, 9], [9, 10], [10, 10]]),
    outline: circulo([15.04, 15.02], 3),
    floor: { material: 'pedra.laje', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
    roof: { material: 'telha.escamas', shape: 'cone', steep: true, visible: true }, levelId: null,
  };
  m.rooms.r2 = {
    id: 'r2', name: 'Octógono', function: 'sala', cells: codificar([[2, 2], [3, 2]]),
    outline: circulo([5, 5], 2, 8),
    floor: { material: 'pedra.laje', seed: 1 }, wallpaper: null, wallStyle: null, palette: null,
    roof: { material: 'telha.barro', visible: true }, levelId: null,
  };
  const r = resumirMapa(m) as { comodos: Record<string, unknown>[] };
  const c1 = r.comodos.find(c => c.id === 'r1')!;
  const c2 = r.comodos.find(c => c.id === 'r2')!;
  assert.equal(c1.forma, 'circulo');
  assert.deepEqual(c1.centro, [15, 15]);
  assert.equal(c1.raio, 3);
  assert.equal(c2.forma, 'poligono');
  assert.equal((c2.vertices as [number, number][]).length, 8);
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

test('atlas_catalogo: demais partes, conjuntos, comodos, busca, índice e parte inválida', async () => {
  const { chamar } = montar(null);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'colecao' })).length > 0);
  const conjuntos = JSON.parse(await chamar('atlas_catalogo', { parte: 'conjuntos' })) as { id: string; arranjo?: string; itens: string[] }[];
  assert.ok(conjuntos.some(c => c.id === 'mata' && c.itens.length > 0));
  assert.equal(conjuntos.find(c => c.id === 'cemiterio')?.arranjo, 'fileiras');
  const comodos = JSON.parse(await chamar('atlas_catalogo', { parte: 'comodos' })) as { id: string; mobilia: boolean; semTelhado: boolean }[];
  assert.equal(comodos.find(c => c.id === 'sala')?.mobilia, true);
  assert.equal(comodos.find(c => c.id === 'sala')?.semTelhado, false);
  assert.equal(comodos.find(c => c.id === 'varanda')?.semTelhado, true);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'materiais' })).piso.length > 0);
  assert.equal(JSON.parse(await chamar('atlas_catalogo', { parte: 'climas' })).climas.length, PRESETS_DE_CLIMA.length);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'luzes' })).length > 0);
  assert.ok(JSON.parse(await chamar('atlas_catalogo', { parte: 'presenca' })).pincéis.length > 0);
  const mo = JSON.parse(await chamar('atlas_catalogo', { parte: 'momentos' }));
  assert.equal(mo.limites.passosPorMomento, 60);
  assert.equal(mo.tiposDePasso.length, 15);
  const indice = JSON.parse(await chamar('atlas_catalogo'));
  assert.ok(indice.partes.receitas > 0);
  assert.ok(indice.partes.conjuntos > 0);
  assert.ok(indice.partes.comodos > 0);
  assert.match(indice.dica, /use busca para procurar por palavra/);
  const b = JSON.parse(await chamar('atlas_catalogo', { busca: 'cemiterio' })) as {
    receitas: { id: string }[];
    colecao: { id: string }[];
    conjuntos: { id: string }[];
    materiais: { id: string }[];
  };
  assert.ok(b.conjuntos.some(c => c.id === 'cemiterio'));
  assert.ok(b.receitas.some(r => r.id === 'lapide'));
  assert.ok(b.receitas.some(r => r.id === 'banco.jardim'));
  await assert.rejects(chamar('atlas_catalogo', { parte: 'xyz' }), /Parte desconhecida.*conjuntos.*comodos/);
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

test('atlas_ver_mapa: captura com sucesso, com aviso, vista (planta/telhados) e trata erro como texto', async () => {
  const vistasRecebidas: (string | undefined)[] = [];
  const ctx: ContextoDeLeitura = {
    repo: () => null,
    mapaAberto: () => covil,
    abrirMapa: async () => {},
    capturar: async (opcoes) => {
      vistasRecebidas.push(opcoes.vista);
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

  // Sucesso normal (padrão planta)
  const r1 = await f.executar({});
  assert.equal(r1.length, 2);
  assert.equal(r1[0]!.tipo, 'imagem');
  assert.equal(r1[1]!.tipo, 'texto');
  assert.match((r1[1] as { texto: string }).texto, /800×600 px \(vista: planta\)/);
  assert.ok(!(r1[1] as { texto: string }).texto.includes('Aviso:'));
  assert.equal(vistasRecebidas.at(-1), 'planta');

  // Vista de telhados
  const rTelhados = await f.executar({ vista: 'telhados' });
  assert.equal(rTelhados.length, 2);
  assert.match((rTelhados[1] as { texto: string }).texto, /vista: telhados/);
  assert.equal(vistasRecebidas.at(-1), 'telhados');

  // Vista inválida é recusada
  await assert.rejects(f.executar({ vista: 'andar' }), /"vista" deve ser "planta" ou "telhados"/);

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

test('mapa aberto com edições não gravadas: ler devolve o documento vivo e naoSalvo; listar e o_que_vejo marcam', async () => {
  const editado = { ...covil, name: 'Covil editado' };
  const { chamar } = montar(editado, { naoSalvo: () => true });
  const porId = JSON.parse(await chamar('atlas_mapa_ler', { id: covil.id })), semId = JSON.parse(await chamar('atlas_mapa_ler'));
  assert.equal(porId.nome, 'Covil editado'); assert.equal(porId.naoSalvo, true);
  assert.equal(semId.nome, 'Covil editado'); assert.equal(semId.naoSalvo, true);
  assert.equal(JSON.parse(await chamar('atlas_mapa_ler', { id: 'outro' })).naoSalvo, false, 'um mapa do disco nunca está sujo');
  const lista = JSON.parse(await chamar('atlas_mapas_listar'));
  assert.equal(lista.mapas.find((m: { id: string }) => m.id === covil.id).naoSalvo, true);
  assert.equal('naoSalvo' in lista.mapas.find((m: { id: string }) => m.id === 'outro'), false);
  assert.equal(JSON.parse(await chamar('atlas_o_que_vejo')).mapa.naoSalvo, true);
});

test('mapa aberto gravado: naoSalvo é false e some da lista e do o_que_vejo', async () => {
  const { chamar } = montar(covil, { naoSalvo: () => false });
  assert.equal(JSON.parse(await chamar('atlas_mapa_ler')).naoSalvo, false);
  assert.equal('naoSalvo' in JSON.parse(await chamar('atlas_mapas_listar')).mapas[0], false);
  assert.equal('naoSalvo' in JSON.parse(await chamar('atlas_o_que_vejo')).mapa, false);
});

/** Um relógio falso: cada `dormir` avança o tempo e, no instante pedido, o editor "nasce". */
function relogio(nasceEmMs: number | null) {
  let agora = 0, esperas = 0;
  return { dormir: async (ms: number) => { agora += ms; esperas++; }, editorPronto: () => nasceEmMs !== null && agora >= nasceEmMs, esperas: () => esperas, agora: () => agora };
}

test('atlas_abrir espera o editor nascer (100 ms por vez) e só então responde', async () => {
  const r = relogio(700);
  const { chamar, abertos } = montar(null, { editorPronto: r.editorPronto, dormir: r.dormir });
  const resposta = JSON.parse(await chamar('atlas_abrir', { id: 'outro' }));
  assert.deepEqual(abertos, ['outro']);
  assert.equal(resposta.aberto, 'outro'); assert.equal('aviso' in resposta, false);
  assert.equal(r.agora(), 700); assert.equal(r.esperas(), 7);
});

test('atlas_abrir com o editor já pronto não espera; sem aparecer em 10 s responde aberto com aviso', async () => {
  const pronto = relogio(0);
  assert.equal('aviso' in JSON.parse(await montar(null, { editorPronto: pronto.editorPronto, dormir: pronto.dormir }).chamar('atlas_abrir', { id: 'outro' })), false);
  assert.equal(pronto.esperas(), 0);
  const nunca = relogio(null);
  const { chamar } = montar(null, { editorPronto: nunca.editorPronto, dormir: nunca.dormir });
  const r = JSON.parse(await chamar('atlas_abrir', { id: 'outro' }));
  assert.equal(r.aberto, 'outro'); assert.match(r.aviso, /editor ainda não apareceu/);
  assert.equal(nunca.agora(), 10_000);
});

test('atlas_ver_mapa espera o viewport até 5 s antes de dizer que o editor não está na tela', async () => {
  let viewportExiste = false;
  const r = relogio(300);
  const ctx: ContextoDeLeitura = {
    repo: () => null, mapaAberto: () => covil, abrirMapa: async () => {}, dormir: async ms => { await r.dormir(ms); viewportExiste = r.editorPronto(); }, editorPronto: () => viewportExiste,
    capturar: () => viewportExiste ? Promise.resolve({ dataUrl: 'data:image/jpeg;base64,12', largura: 10, altura: 10, pxPorMetro: 1, bytes: 10, qualidade: 0.8, caixa: { x0: 0, y0: 0, x1: 1, y1: 1 } }) : null,
  };
  const f = Object.fromEntries(ferramentasDeLeitura(ctx).map(x => [x.nome, x]));
  assert.equal((await f.atlas_ver_mapa!.executar({}))[0]!.tipo, 'imagem');
  assert.equal(r.agora(), 300);

  const nunca = relogio(null);
  const f2 = Object.fromEntries(ferramentasDeLeitura({ ...ctx, capturar: () => null, editorPronto: nunca.editorPronto, dormir: nunca.dormir }).map(x => [x.nome, x]));
  await assert.rejects(f2.atlas_ver_mapa!.executar({}), /editor não está na tela/);
  assert.equal(nunca.agora(), 5_000);
});

test('atlas_o_que_vejo espera o editor (até 5 s) para trazer a câmera', async () => {
  let viewportExiste = false;
  const r = relogio(200);
  const { chamar } = montar(covil, { dormir: async ms => { await r.dormir(ms); viewportExiste = r.editorPronto(); }, editorPronto: () => viewportExiste, caixaVisivel: () => viewportExiste ? { x0: 0, y0: 0, x1: 10, y1: 10 } : null });
  assert.deepEqual(JSON.parse(await chamar('atlas_o_que_vejo')).camera.caixa, [0, 0, 10, 10]);
});

test('mapa em aba de segundo plano: ler devolve o documento vivo e naoSalvo; listar marca', async () => {
  const emAba = { ...covil, id: 'outro', name: 'Outro editado' };
  const { chamar } = montar(covil, { sessaoEmCache: id => id === 'outro' ? { mapa: emAba, naoSalvo: true } : null });
  const r = JSON.parse(await chamar('atlas_mapa_ler', { id: 'outro' }));
  assert.equal(r.nome, 'Outro editado'); assert.equal(r.naoSalvo, true);
  const lista = JSON.parse(await chamar('atlas_mapas_listar'));
  assert.equal(lista.mapas.find((m: { id: string }) => m.id === 'outro').naoSalvo, true);
  assert.equal('naoSalvo' in lista.mapas.find((m: { id: string }) => m.id === covil.id), false);
});

test('mapa em aba de segundo plano sem edições: naoSalvo false e fora da marca da lista', async () => {
  const { chamar } = montar(covil, { sessaoEmCache: id => id === 'outro' ? { mapa: { ...covil, id: 'outro' }, naoSalvo: false } : null });
  assert.equal(JSON.parse(await chamar('atlas_mapa_ler', { id: 'outro' })).naoSalvo, false);
  assert.equal('naoSalvo' in JSON.parse(await chamar('atlas_mapas_listar')).mapas[1], false);
});

function criarComodoTeste(
  id: string,
  nome: string,
  rets: [number, number, number, number][],
  roof: Comodo['roof'],
  funcao: string | null = 'sala',
): Comodo {
  const celulas: [number, number][] = [];
  for (const [x0, y0, x1, y1] of rets) {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) celulas.push([x, y]);
  }
  return {
    id,
    name: nome,
    function: funcao,
    cells: codificar(celulas),
    floor: { material: 'tabuas.carvalho', seed: 1 },
    wallpaper: null,
    wallStyle: null,
    palette: null,
    roof,
    levelId: null,
  };
}

test('atlas_mapa_ler: edifícios, forma em L (rets), telhado de estilo/ajustado, resumo.retangulares e filtro comodos', async () => {
  const m = criarMapa({ id: 'vila', nome: 'Vila' });
  // Edifício 1 (em L): duas salas que se tocam com prefixo "Casa Falk · "
  const c1 = criarComodoTeste('c1', 'Casa Falk · sala', [[2, 2, 6, 5]], { material: 'telha.ardosia', visible: true, shape: 'duas-aguas', steep: true, details: ['cruz'] }, 'capela');
  const c2 = criarComodoTeste('c2', 'Casa Falk · anexo', [[4, 5, 6, 7]], { material: 'telha.ardosia', visible: true, shape: 'piramide', steep: false, details: ['chamine'] }, 'sala');
  // Edifício 2 (cômodo único em L): 2 rets iguais aos de entrada, sem telhado
  const retsEmL: [number, number, number, number][] = [[10, 2, 14, 4], [10, 4, 12, 6]];
  const cL = criarComodoTeste('cL', 'Oficina em L', retsEmL, { material: null, visible: false }, 'forja');
  // Edifício 3 (retangular simples)
  const cRet = criarComodoTeste('cRet', 'Cabana', [[16, 2, 19, 5]], { material: 'telha.palha', visible: true, shape: 'quatro-aguas', steep: false, details: [] }, 'quarto');
  // Varanda ao ar livre sem telhado (não entra em edifício nem em comodosSemTelhado)
  const cVar = criarComodoTeste('cVar', 'Varanda', [[16, 5, 19, 6]], { material: null, visible: false }, 'varanda');

  m.rooms = { c1, c2, cL, cRet, cVar };

  const { chamar } = montar(m);
  const r = JSON.parse(await chamar('atlas_mapa_ler'));

  const porId = Object.fromEntries(r.comodos.map((c: { id: string }) => [c.id, c]));
  // Cômodo em L devolve os 2 rets de entrada
  assert.deepEqual(porId.cL.rets, retsEmL);
  assert.equal(porId.cL.telhado, null);
  assert.equal(porId.cL.area, 12 * 2.25);

  // Telhado de estilo igreja volta como { estilo: 'igreja' }
  assert.deepEqual(porId.c1.telhado, { estilo: 'igreja' });
  // Telhado ajustado volta por campos
  assert.deepEqual(porId.c2.telhado, { cobertura: 'telha.ardosia', forma: 'piramide', ingreme: false, detalhes: ['chamine'] });
  // Choupana volta como { estilo: 'choupana' }
  assert.deepEqual(porId.cRet.telhado, { estilo: 'choupana' });

  // Duas salas que se tocam caem no mesmo edificio
  assert.equal(porId.c1.edificio, 'c1');
  assert.equal(porId.c2.edificio, 'c1');
  assert.equal('edificio' in porId.cVar, false);

  const ed1 = r.edificios.find((e: { id: string }) => e.id === 'c1');
  assert.equal(ed1.nome, 'Casa Falk');
  assert.deepEqual(ed1.salas, ['c1', 'c2']);
  assert.deepEqual(ed1.telhados, ['igreja', 'telha.ardosia']);
  assert.equal(ed1.area, (12 + 4) * 2.25);
  assert.deepEqual(ed1.caixa, [3, 3, 6, 7.5]);

  // Resumo: 3 edifícios (c1+c2 em L, cL em L, cRet retangular) -> retangulares = 1, comodosSemTelhado = 1 (cL)
  assert.equal(r.resumo.edificios, 3);
  assert.equal(r.resumo.retangulares, 1);
  assert.equal(r.resumo.comodosSemTelhado, 1);
  assert.equal(r.resumo.areaMin, 9 * 2.25);
  assert.equal(r.resumo.areaMax, 16 * 2.25);

  // Filtro opcional comodos: limita aos ids pedidos
  const filtrado = JSON.parse(await chamar('atlas_mapa_ler', { comodos: ['cL'] }));
  assert.deepEqual(filtrado.comodos.map((c: { id: string }) => c.id), ['cL']);
  assert.deepEqual(filtrado.comodos[0].rets, retsEmL);
});

test('resumirMapa: troca rets por retsResumidos quando o JSON passa de 60 KB, salvo com filtro comodos', () => {
  const m = criarMapa({ id: 'grande', nome: 'Grande' });
  m.notes = 'x'.repeat(61_000);
  m.rooms = {
    c1: criarComodoTeste('c1', 'Casa', [[2, 2, 6, 5], [4, 5, 6, 7]], { material: null, visible: false }),
  };
  const r = resumirMapa(m) as { comodos: { id: string; rets?: unknown; retsResumidos?: number }[] };
  assert.equal('rets' in r.comodos[0]!, false);
  assert.equal(r.comodos[0]!.retsResumidos, 2);

  const detalhado = resumirMapa(m, { comodos: ['c1'] }) as { comodos: { id: string; rets?: unknown; retsResumidos?: number }[] };
  assert.equal(Array.isArray(detalhado.comodos[0]!.rets), true);
  assert.equal('retsResumidos' in detalhado.comodos[0]!, false);
});

test('atlas_revisar: devolve achados e resumo do mapa aberto (ou por id) e filtra por regras', async () => {
  const m = criarMapa({ id: 'vila', nome: 'Vila', largura: 30, altura: 20 });
  m.terrain.base = 'grama';
  m.rooms = {
    c1: criarComodoTeste('c1', 'Casa fechada', [[2, 2, 5, 5]], { material: null, visible: false }),
  };
  const { chamar } = montar(m);

  const tudo = JSON.parse(await chamar('atlas_revisar'));
  assert.ok(Array.isArray(tudo.achados));
  assert.ok(tudo.achados.some((a: { regra: string }) => a.regra === 'comodo-sem-acesso'));
  assert.ok(tudo.achados.some((a: { regra: string }) => a.regra === 'edificio-sem-telhado'));
  assert.ok(tudo.achados.some((a: { regra: string }) => a.regra === 'interior-vazio'));
  assert.equal(tudo.resumo.erros, 1);
  assert.ok(tudo.resumo.avisos >= 2);
  assert.equal(typeof tudo.resumo.dicas, 'number');

  const filtrado = JSON.parse(await chamar('atlas_revisar', { regras: ['comodo-sem-acesso'] }));
  assert.equal(filtrado.achados.length, 1);
  assert.equal(filtrado.achados[0].regra, 'comodo-sem-acesso');
  assert.deepEqual(filtrado.resumo, { erros: 1, avisos: 0, dicas: 0 });

  await assert.rejects(chamar('atlas_revisar', { regras: [123] }), /regras/);
});

test('resumirMapa: inclui patamares de relevo e escarpas derivadas', () => {
  const m = criarMapa({ id: 'vale', nome: 'Vale', largura: 20, altura: 20 });
  const celulas = codificar([[10, 10], [10, 11], [11, 10], [11, 11]]);
  m.terrain.relief = { patamares: { 'p-200': { id: 'p-200', altura: -20, cells: celulas } } };
  m.walls = {
    wr_0_1: { id: 'wr_0_1', kind: 'cliff', path: [[2.5, 2.5], [3, 2.5]], height: 20, thickness: 0.4, blocks: { move: true, sight: false, light: false }, material: 'rocha.cinza', drop: 'b', source: { reliefStep: 0 } },
  };
  const r = resumirMapa(m) as { relevo: { altura: number; area: number; caixa: number[] }[]; escarpasDerivadas: number };
  assert.equal(r.escarpasDerivadas, 1);
  assert.equal(r.relevo.length, 1);
  assert.equal(r.relevo[0]!.altura, -20);
  assert.ok(r.relevo[0]!.area > 0);
  assert.deepEqual(r.relevo[0]!.caixa, [2.5, 2.5, 0.5, 0.5]);
});

test('multiandar: resumirMapa lista andares, atlas_o_que_vejo traz andarAtivo e atlas_ver_mapa alterna e restaura andar', async () => {
  const m = criarMapa({ id: 'moinho', nome: 'Moinho', largura: 30, altura: 20 });
  m.levels = {
    porao: { id: 'porao', name: 'Porão', order: -1 },
    alto: { id: 'alto', name: '1º andar', order: 1 },
  };
  const cSub = criarComodoTeste('cSub', 'Subsolo', [[2, 2, 5, 5]], { material: null, visible: false });
  cSub.levelId = 'porao';
  const cTer = criarComodoTeste('cTer', 'Térreo', [[2, 2, 5, 5]], { material: 'telha.barro', visible: true });
  m.rooms = { cSub, cTer };
  m.props = {
    p1: { id: 'p1', source: { kind: 'recipe', recipe: 'barril', seed: 1, params: {} }, position: [4, 4], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: false, interaction: null, levelId: 'porao' },
    p2: { id: 'p2', source: { kind: 'recipe', recipe: 'barril', seed: 2, params: {} }, position: [4, 4], rotation: 0, scale: 1, elevation: 'floor', wall: null, roomId: null, blocks: { move: true, sight: false }, castsShadow: true, harmonize: false, interaction: null, levelId: null },
  };
  m.lights = {
    l1: { id: 'l1', position: [4, 4], radius: 4, color: '#ffaa55', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', preset: 'tocha', on: true, nightOnly: false, rays: false, levelId: 'alto' },
  };

  const resumo = resumirMapa(m) as {
    andares: { id: string | null; nome: string; ordem: number }[];
    comodos: { id: string; andar: string | null }[];
    objetos: { fonte: string; andar: string | null }[];
    luzes: { id: string; andar: string | null }[];
  };
  assert.deepEqual(resumo.andares.map(a => a.id), ['porao', null, 'alto']);
  assert.equal(resumo.comodos.find(c => c.id === 'cSub')?.andar, 'porao');
  assert.equal(resumo.comodos.find(c => c.id === 'cTer')?.andar, null);
  assert.equal(resumo.objetos.length, 2);
  assert.deepEqual(resumo.objetos.map(o => o.andar).sort(), ['porao', null].sort());
  assert.equal(resumo.luzes[0]?.andar, 'alto');

  let ativo: string | null = 'alto';
  const historicoAndar: (string | null)[] = [];
  const { f, chamar } = montar(m, {
    andarAtivo: () => ativo,
    definirAndarAtivo: id => { ativo = id; historicoAndar.push(id); },
    capturar: () => Promise.resolve({ dataUrl: 'data:image/jpeg;base64,12', largura: 10, altura: 10, pxPorMetro: 1, bytes: 10, qualidade: 0.8, caixa: { x0: 0, y0: 0, x1: 1, y1: 1 } }),
  });

  const vejo = JSON.parse(await chamar('atlas_o_que_vejo'));
  assert.deepEqual(vejo.andarAtivo, { id: 'alto', nome: '1º andar', ordem: 1 });

  const cap = await f.atlas_ver_mapa!.executar({ andar: 'porao' });
  assert.equal(cap[0]!.tipo, 'imagem');
  const bCap = cap[1]!;
  assert.match(bCap.tipo === 'texto' ? bCap.texto : '', /Porão/);
  assert.deepEqual(historicoAndar, ['porao', 'alto']);
  assert.equal(ativo, 'alto');

  await f.atlas_ver_mapa!.executar({ andar: null });
  assert.equal(ativo, 'alto');

  await assert.rejects(f.atlas_ver_mapa!.executar({ andar: 'inexistente' }), /não existe/);
  assert.equal(ativo, 'alto');
});
