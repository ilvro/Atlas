import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogo, ferramentasDeLeitura } from '../../src/app/ponte-leitura.ts';
import { criadosPeloAssistente, esquemaDoPasso, TIPOS_DE_PASSO_ESQUEMA, ferramentasDeEscrita, type ContextoDeEscrita } from '../../src/app/ponte-escrita.ts';
import { area } from '../../src/domain/celulas.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { criarStore } from '../../src/state/store.ts';

function montar(comMapa = true, extra: Partial<ContextoDeEscrita> = {}) {
  const store = criarStore(criarMapa({ id: 'teste', nome: 'Teste', agora: 1, largura: 30, altura: 20 }));
  const gravados: MapaAtlas[] = [], abertos: string[] = [], sincronizados: string[] = [];
  const ctx: ContextoDeEscrita = {
    store: () => comMapa ? store : null,
    repo: () => ({ salvar: async m => { gravados.push(m); return m; } }),
    sincronizarCampanha: async m => { sincronizados.push(m.id); },
    abrirMapa: async id => { abertos.push(id); },
    ...extra,
  };
  const f = Object.fromEntries(ferramentasDeEscrita(ctx).map(x => [x.nome, x]));
  const chamar = async (nome: string, args: Record<string, unknown>) => {
    const c = (await f[nome]!.executar(args))[0]!;
    assert.equal(c.tipo, 'texto');
    return c.texto;
  };
  return { store, f, chamar, gravados, abertos, sincronizados };
}

const grama = { acao: 'pintar', material: 'grama', forma: { retangulo: [0, 0, 10, 10] } };
const terra = { acao: 'pintar', material: 'terra', forma: { faixa: [[0, 5], [10, 5]], largura: 2 } };

test('as ferramentas têm nome, descrição com unidades e esquema de objeto', () => {
  const { f } = montar();
  assert.deepEqual(Object.keys(f), ['atlas_mapa_criar', 'atlas_terreno', 'atlas_comodos', 'atlas_paredes', 'atlas_portas', 'atlas_objetos', 'atlas_espalhar', 'atlas_luzes', 'atlas_ambiente', 'atlas_regioes', 'atlas_presenca', 'atlas_notas', 'atlas_momento', 'atlas_momento_testar', 'atlas_remover', 'atlas_mover']);
  for (const x of Object.values(f)) { assert.ok(x.descricao.length > 60); assert.equal(x.esquema.type, 'object'); }
  assert.match(f.atlas_comodos!.descricao, /CÉLULAS/);
  assert.match(f.atlas_terreno!.descricao, /METROS/);
});

test('atlas_terreno com duas operações é uma entrada de histórico e desfazer volta', async () => {
  const { store, chamar } = montar();
  const antes = store.documento;
  const r = await chamar('atlas_terreno', { base: 'grama', operacoes: [grama, terra] });
  assert.match(r, /atlas_ver_mapa/);
  assert.equal(store.historico.length, 1);
  assert.equal(store.rotuloDesfazer, 'IA: terreno');
  assert.equal(store.documento.terrain.base, 'grama');
  assert.equal(Object.keys(store.documento.terrain.layers).length, 2);
  assert.ok(Object.values(store.documento.terrain.layers).every(l => area(l.cells) > 0));
  store.desfazer();
  assert.deepEqual(store.documento, antes);
  assert.equal(store.historico.length, 0);
});

test('erro de construção no meio da lista não deixa nada aplicado', async () => {
  const { store, chamar } = montar();
  const antes = store.documento;
  await assert.rejects(chamar('atlas_terreno', { operacoes: [grama, { acao: 'pintar', material: 'queijo', forma: { disco: [5, 5], raio: 1 } }] }), /queijo.*não existe/);
  assert.deepEqual(store.documento, antes);
  assert.equal(store.historico.length, 0);
});

test('erro de comando depois de comandos aplicados desfaz a transação inteira', async () => {
  const { store, chamar } = montar();
  const antes = store.documento;
  await assert.rejects(chamar('atlas_terreno', { operacoes: [grama], correnteza: { material: 'agua.rio', angulo: 0, velocidade: 1 } }), /água/);
  assert.deepEqual(store.documento, antes);
  assert.equal(store.historico.length, 0);
});

test('correnteza vale sobre a água pintada na mesma chamada', async () => {
  const { store, chamar } = montar();
  await chamar('atlas_terreno', { operacoes: [{ acao: 'pintar', material: 'agua.rio', forma: { faixa: [[0, 5], [20, 5]], largura: 3 } }], correnteza: { material: 'agua.rio', angulo: 0, velocidade: 1.5 } });
  assert.equal(Object.values(store.documento.terrain.layers)[0]!.flow?.speed, 1.5);
  assert.equal(store.historico.length, 1);
});

test('cabana de 3 × 3 células com porta, cada chamada um passo, e o mapa valida', async () => {
  const { store, chamar } = montar();
  criadosPeloAssistente.clear();
  const r = await chamar('atlas_comodos', { comodos: [{ rets: [[2, 2, 5, 5]], tipo: 'sala', nome: 'Cabana', telhado: null }] });
  assert.equal(Object.keys(store.documento.rooms).length, 1);
  assert.equal(area(Object.values(store.documento.rooms)[0]!.cells), 9);
  const id = Object.keys(store.documento.rooms)[0]!;
  assert.ok(criadosPeloAssistente.has(id));
  assert.match(r, new RegExp(id));
  // A parede de baixo do cômodo fica em y = 7,5 m, entre x = 3 e 7,5 m.
  await chamar('atlas_portas', { portas: [{ perto: [5.25, 7.5] }] });
  assert.equal(Object.keys(store.documento.openings).length, 1);
  assert.equal(store.historico.length, 2);
  validarMapa(store.documento);
  store.desfazer();
  assert.equal(Object.keys(store.documento.openings).length, 0);
  assert.equal(Object.keys(store.documento.rooms).length, 1);
});

test('atlas_paredes cria muros avulsos e escarpas; porta sem parede perto volta como erro legível', async () => {
  const { store, chamar } = montar();
  await chamar('atlas_paredes', { paredes: [{ path: [[1, 1], [8, 1]], kind: 'fence' }, { path: [[10, 5], [10, 20]], kind: 'cliff', drop: 'b' }] });
  assert.equal(Object.keys(store.documento.walls).length, 2);
  const cliff = Object.values(store.documento.walls).find(w => w.kind === 'cliff');
  assert.equal(cliff?.drop, 'b');
  await assert.rejects(chamar('atlas_portas', { portas: [{ perto: [20, 15] }] }), /não há parede perto/);
  assert.equal(store.historico.length, 1);
});

test('argumentos inválidos e sem mapa aberto', async () => {
  const { chamar } = montar();
  await assert.rejects(chamar('atlas_comodos', { comodos: [{ rets: [[5, 5, 2, 2]], tipo: 'sala' }] }), /retângulo inválido/);
  await assert.rejects(chamar('atlas_comodos', { comodos: [{ rets: [[0, 0, 2, 2]], tipo: 'castelo' }] }), /tipos:/);
  await assert.rejects(chamar('atlas_terreno', {}), /Passe/);
  await assert.rejects(chamar('atlas_paredes', { paredes: [] }), /Falta/);
  const vazio = montar(false);
  await assert.rejects(vazio.chamar('atlas_terreno', { operacoes: [grama] }), /atlas_abrir.*atlas_mapa_criar/);
});

test('atlas_mapa_criar grava com o campanhaId, sincroniza e abre', async () => {
  const { chamar, gravados, abertos, sincronizados } = montar(false);
  const r = JSON.parse(await chamar('atlas_mapa_criar', { nome: 'Vila', largura: 20, altura: 15, base: 'grama', genero: 'fantasia', estilo: 'pixel', campanhaId: 'camp-1', notas: 'ponto de partida' }));
  assert.equal(gravados.length, 1);
  const m = gravados[0]!;
  assert.equal(m.campanhaId, 'camp-1');
  assert.deepEqual([m.name, m.bounds.width, m.bounds.height, m.terrain.base, m.style.genre, m.style.renderer, m.notes], ['Vila', 20, 15, 'grama', 'fantasia', 'pixel', 'ponto de partida']);
  assert.equal(r.id, m.id);
  assert.deepEqual(abertos, [m.id]);
  assert.deepEqual(sincronizados, [m.id]);
  validarMapa(m);
});

test('atlas_mapa_criar valida tamanho, gênero e base antes de gravar', async () => {
  const { chamar, gravados } = montar(false);
  await assert.rejects(chamar('atlas_mapa_criar', { nome: 'X', largura: 1000, altura: 10 }), /largura/);
  await assert.rejects(chamar('atlas_mapa_criar', { nome: 'X', largura: 10, altura: 10, genero: 'ficcao' }), /gêneros:/);
  await assert.rejects(chamar('atlas_mapa_criar', { nome: 'X', largura: 10, altura: 10, base: 'queijo' }), /bases:/);
  assert.equal(gravados.length, 0);
});

test('atlas_objetos: 200 objetos são uma entrada de histórico; item desconhecido sugere parecidos e não aplica nada', async () => {
  const { store, chamar } = montar();
  const antes = store.documento;
  const lote = Array.from({ length: 200 }, (_, i) => ({ item: 'lapide', pos: [1 + (i % 20), 1 + Math.floor(i / 20)] }));
  await chamar('atlas_objetos', { objetos: lote });
  assert.equal(Object.keys(store.documento.props).length, 200);
  assert.equal(store.historico.length, 1);
  validarMapa(store.documento);
  store.desfazer();
  assert.equal(Object.keys(store.documento.props).length, 0);
  await assert.rejects(chamar('atlas_objetos', { objetos: [...lote.slice(0, 2), { item: 'lapid', pos: [2, 2] }] }), /lapid.*não existe.*parecidos: .*lapide/);
  assert.deepEqual(store.documento, antes);
  await assert.rejects(chamar('atlas_objetos', { objetos: [...lote, lote[0]!, lote[0]!].slice(0, 201) }), /até 200/);
});

test('atlas_espalhar gera objetos de um conjunto na forma; conjunto desconhecido sugere', async () => {
  const { store, chamar } = montar();
  await chamar('atlas_espalhar', { conjunto: 'mata', forma: { retangulo: [2, 2, 20, 15] }, semente: 3 });
  const n = Object.keys(store.documento.props).length;
  assert.ok(n > 3, `esperava vários objetos, vieram ${n}`);
  assert.equal(store.historico.length, 1);
  validarMapa(store.documento);
  await assert.rejects(chamar('atlas_espalhar', { conjunto: 'mat', forma: { disco: [5, 5], raio: 2 } }), /parecidos: .*mata/);
});

test('atlas_luzes acende luzes do preset; preset desconhecido sugere', async () => {
  const { store, chamar } = montar();
  await chamar('atlas_luzes', { luzes: [{ preset: 'fogueira', pos: [10, 10] }, { preset: 'lanterna', pos: [5, 5], direcao: 1, raio: 12, cor: '#ffffff' }] });
  const ls = Object.values(store.documento.lights);
  assert.equal(ls.length, 2);
  assert.equal(ls.find(l => l.preset === 'fogueira')!.radius, 8);
  assert.equal(ls.find(l => l.preset === 'lanterna')!.radius, 12);
  assert.equal(store.historico.length, 1);
  await assert.rejects(chamar('atlas_luzes', { luzes: [{ preset: 'tocha2', pos: [1, 1] }] }), /parecidos: tocha/);
  await assert.rejects(chamar('atlas_luzes', { luzes: [{ preset: 'tocha', pos: [1, 1], cor: 'vermelho' }] }), /#rrggbb/);
});

test('atlas_ambiente: clima + horário + acabamento + guardar numa entrada só', async () => {
  const { store, chamar } = montar();
  await chamar('atlas_ambiente', {
    clima: { preset: 'entardecer', horario: '18:15', tempo: { fog: 0.3 } },
    acabamento: { preset: 'sepia', vignette: 0.6 },
    guardarClima: { id: 'fim-de-tarde', nome: 'Fim de tarde' },
  });
  const m = store.documento;
  assert.equal(store.historico.length, 1);
  assert.equal(m.climate.preset, 'entardecer');
  assert.equal(m.climate.time, '18:15');
  assert.equal(m.climate.weather.fog, 0.3);
  assert.equal(m.climate.weather.dust, 0.25);
  assert.equal(m.finish.vignette, 0.6);
  assert.equal(m.finish.preset, 'personalizado');
  assert.equal(m.finish.saturation, 0.45);
  assert.equal(m.customClimates['fim-de-tarde']!.name, 'Fim de tarde');
  validarMapa(m);
});

test('atlas_ambiente: erros legíveis para valores fora da faixa e ids desconhecidos', async () => {
  const { store, chamar } = montar();
  const antes = store.documento;
  await assert.rejects(chamar('atlas_ambiente', { clima: { ambiente: { color: '#ffffff', intensity: 2 } } }), /clima\.ambiente\.intensity.*entre 0 e 1/);
  await assert.rejects(chamar('atlas_ambiente', { clima: { horario: '25:00' } }), /HH:MM/);
  await assert.rejects(chamar('atlas_ambiente', { clima: { preset: 'entardec' } }), /parecidos: .*entardecer/);
  await assert.rejects(chamar('atlas_ambiente', { acabamento: { preset: 'quent' } }), /parecidos: quente/);
  await assert.rejects(chamar('atlas_ambiente', { acabamento: { vignette: 3 } }), /vignette/);
  await assert.rejects(chamar('atlas_ambiente', { guardarClima: { id: 'noite', nome: 'x' } }), /Já existe/);
  await assert.rejects(chamar('atlas_ambiente', {}), /Passe/);
  assert.deepEqual(store.documento, antes);
  await chamar('atlas_ambiente', { clima: { preset: 'noite', sol: null } });
  assert.equal(store.documento.climate.sun, null);
});

test('atlas_regioes cria regiões; atlas_presenca pinta e ajusta a intensidade', async () => {
  const { store, chamar } = montar();
  await chamar('atlas_regioes', { regioes: [{ poligono: [[1, 1], [5, 1], [5, 5]], tipo: 'reveal', nome: 'Entrada', texto: 'Cheiro de mofo', somenteMestre: false }] });
  const r = Object.values(store.documento.regions)[0]!;
  assert.equal(r.kind, 'reveal'); assert.equal(r.gmOnly, false); assert.equal(r.payload.nome, 'Entrada');
  await assert.rejects(chamar('atlas_regioes', { regioes: [{ poligono: [[1, 1], [5, 1]], tipo: 'reveal' }] }), /3 pontos/);
  await chamar('atlas_presenca', { pincel: 'musgo', forma: { disco: [10, 10], raio: 3 }, intensidade: 0.9 });
  const p = Object.values(store.documento.presence);
  assert.equal(p.length, 1); assert.equal(p[0]!.brush, 'musgo'); assert.equal(p[0]!.intensity, 0.9); assert.ok(area(p[0]!.cells) > 0);
  assert.equal(store.historico.length, 2);
  validarMapa(store.documento);
  await assert.rejects(chamar('atlas_presenca', { pincel: 'mus', forma: { disco: [10, 10], raio: 3 } }), /parecidos: musgo/);
});

test('atlas_notas escreve a nota do mapa e dos cômodos; cômodo inexistente é erro', async () => {
  const { store, chamar } = montar();
  await chamar('atlas_comodos', { comodos: [{ rets: [[2, 2, 5, 5]], tipo: 'sala' }] });
  const id = Object.keys(store.documento.rooms)[0]!;
  await chamar('atlas_notas', { mapa: 'Ponto de partida', comodos: [{ id, leitura: 'Uma sala fria.', notasMestre: 'Alçapão sob o tapete.' }] });
  assert.equal(store.documento.notes, 'Ponto de partida');
  assert.equal(store.documento.comodosExtra[id]!.leitura, 'Uma sala fria.');
  assert.equal(store.documento.comodosExtra[id]!.notasMestre, 'Alçapão sob o tapete.');
  assert.equal(store.historico.length, 2);
  await assert.rejects(chamar('atlas_notas', { comodos: [{ id: 'c_x', leitura: 'a' }] }), /não existe/);
  await assert.rejects(chamar('atlas_notas', {}), /Passe/);
});

// ---------- momentos ----------
const chegada = (comodo: string) => [
  { tipo: 'tela', acao: 'escurecer', ms: 800 },
  { tipo: 'letreiro', titulo: 'Porto Velho', subtitulo: '', peca: null, estilo: 'apresentacao', ms: 4000 },
  { tipo: 'clima', clima: 'neblina' },
  { tipo: 'camera', alvo: { colecao: 'rooms', id: comodo } },
  { tipo: 'tela', acao: 'clarear', ms: 800 },
];

async function comSala() {
  const m = montar();
  await m.chamar('atlas_comodos', { comodos: [{ rets: [[2, 2, 5, 5]], tipo: 'sala' }] });
  return { ...m, sala: Object.keys(m.store.documento.rooms)[0]! };
}

test('atlas_momento válido vira um momento.salvar, um passo de desfazer, e o id é do assistente', async () => {
  const { store, chamar, sala } = await comSala();
  const antes = store.historico.length;
  const r = await chamar('atlas_momento', { nome: 'Chegada', cor: '#44aa88', passos: chegada(sala) });
  assert.equal(store.historico.length, antes + 1);
  assert.equal(store.rotuloDesfazer, 'IA: momento');
  const [id, m] = Object.entries(store.documento.moments)[0]!;
  assert.match(r, new RegExp(id));
  assert.equal(m.nome, 'Chegada');
  assert.equal(m.passos.length, 5);
  assert.ok(criadosPeloAssistente.has(id));
  store.desfazer();
  assert.deepEqual(store.documento.moments, {});
});

test('atlas_momento: clima, cômodo, peça e interagir inexistentes voltam com o índice do passo', async () => {
  const { store, chamar, sala } = await comSala();
  const antes = store.documento;
  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'esperar', ms: 500 }, { tipo: 'clima', clima: 'nevoa-roxa' }] }), /Passo 2 \(clima\): o clima “nevoa-roxa” não existe/);
  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'revelar', ids: [sala, 'c_fantasma'] }] }), /Passo 1 \(revelar\): o cômodo “c_fantasma” não existe/);
  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'camera', alvo: { colecao: 'rooms', id: 'c_fantasma' } }] }), /Passo 1 \(camera\).*c_fantasma/);
  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'letreiro', titulo: 'A', subtitulo: '', peca: 'p_sumiu', estilo: 'capitulo', ms: 2000 }] }), /peça “p_sumiu”/);
  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'interagir', id: 'o_nada' }] }), /Passo 1 \(interagir\)/);
  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'esperar', ms: 5 }] }), /Passo 1: Tempo de espera/);
  assert.deepEqual(store.documento, antes);
});

test('atlas_momento: luz, objeto e região de revelar', async () => {
  const { store, chamar, sala } = await comSala();
  await chamar('atlas_objetos', { objetos: [{ pos: [3, 3], item: 'caixa' }] });
  const objId = Object.keys(store.documento.props)[0]!;
  await chamar('atlas_luzes', { luzes: [{ pos: [3, 3], preset: 'tocha', dono: objId }] });
  const luzId = Object.keys(store.documento.lights)[0]!;
  await chamar('atlas_regioes', { regioes: [{ poligono: [[1, 1], [4, 1], [4, 4], [1, 4]], tipo: 'reveal' }] });
  const regId = Object.keys(store.documento.regions)[0]!;

  await chamar('atlas_momento', {
    nome: 'Cena Nova',
    passos: [
      { tipo: 'luz', ids: [luzId, objId], acao: 'alternar' },
      { tipo: 'objeto', ids: [objId], acao: 'esconder' },
      { tipo: 'revelar', ids: [sala, regId] },
    ],
  });
  assert.equal(Object.keys(store.documento.moments).length, 1);

  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'luz', ids: ['luz_fantasma'], acao: 'ligar' }] }), /Passo 1 \(luz\): a luz ou objeto “luz_fantasma” não existe/);
  await assert.rejects(chamar('atlas_momento', { nome: 'x', passos: [{ tipo: 'objeto', ids: ['obj_fantasma'], acao: 'mostrar' }] }), /Passo 1 \(objeto\): o objeto “obj_fantasma” não existe/);
});

test('atlas_momento: clima salvo do mapa vale; refs de som só têm o formato conferido', async () => {
  const { store, chamar } = await comSala();
  await chamar('atlas_ambiente', { clima: { preset: 'neblina' }, guardarClima: { id: 'meu-clima', nome: 'Meu clima' } });
  await chamar('atlas_momento', { nome: 'Som', passos: [{ tipo: 'clima', clima: 'meu-clima' }, { tipo: 'som', ref: { app: 'jukebox', tipo: 'cena-sonora', id: 'qualquer-coisa' } }] });
  assert.equal(Object.keys(store.documento.moments).length, 1);
  await assert.rejects(chamar('atlas_momento', { nome: 'Som', passos: [{ tipo: 'som', ref: { app: 'atelie', tipo: 'documento', id: 'a' } }] }), /Passo 1: .*Jukebox/);
});

test('atlas_momento: substituir só vale para ids criados pelo assistente', async () => {
  const { store, chamar } = await comSala();
  store.transacao('mestre', g => g.aplicar({ tipo: 'momento.salvar', momento: { id: 'do-mestre', nome: 'Meu', cor: null, passos: [] } }));
  await assert.rejects(chamar('atlas_momento', { id: 'do-mestre', nome: 'Troca', passos: [] }), /é do mestre; crie outro/);
  assert.equal(store.documento.moments['do-mestre']!.nome, 'Meu');
  await chamar('atlas_momento', { nome: 'Novo', passos: [{ tipo: 'esperar', ms: 1000 }] });
  const id = Object.keys(store.documento.moments).find(k => k !== 'do-mestre')!;
  await chamar('atlas_momento', { id, nome: 'Refeito', passos: [{ tipo: 'nota', texto: 'oi' }] });
  assert.equal(store.documento.moments[id]!.nome, 'Refeito');
  assert.equal(Object.keys(store.documento.moments).length, 2);
});

test('atlas_momento_testar: resultado e descrições; sem executor ou momento é erro', async () => {
  const tocados: string[] = []; let parou = false;
  const m = montar(true, { tocarMomento: async id => { tocados.push(id); return 'fim'; }, pararMomento: () => { parou = true; } });
  await m.chamar('atlas_comodos', { comodos: [{ rets: [[2, 2, 5, 5]], tipo: 'sala' }] });
  const sala = Object.keys(m.store.documento.rooms)[0]!;
  await m.chamar('atlas_momento', { nome: 'Chegada', passos: chegada(sala) });
  const id = Object.keys(m.store.documento.moments)[0]!;
  const r = JSON.parse(await m.chamar('atlas_momento_testar', { id }));
  assert.deepEqual(tocados, [id]);
  assert.equal(r.resultado, 'fim');
  assert.equal(r.passos.length, 5);
  assert.match(r.passos[1], /Letreiro: Porto Velho/);
  assert.equal(parou, false);
  await assert.rejects(m.chamar('atlas_momento_testar', { id: 'nao-existe' }), /não existe/);
  const sem = montar(true);
  await sem.chamar('atlas_momento', { nome: 'M', passos: [] });
  await assert.rejects(sem.chamar('atlas_momento_testar', { id: Object.keys(sem.store.documento.moments)[0]! }), /não consegue tocar/);
});

test('o esquema dos passos bate com o catálogo de momentos', () => {
  const cat = catalogo('momentos') as { tiposDePasso: { tipo: string; campos: Record<string, unknown> }[] };
  const esquema = esquemaDoPasso().oneOf as { properties: Record<string, any> }[];
  assert.deepEqual(cat.tiposDePasso.map(t => t.tipo), [...TIPOS_DE_PASSO_ESQUEMA]);
  assert.deepEqual(esquema.map(e => e.properties.tipo.const), [...TIPOS_DE_PASSO_ESQUEMA]);
  for (const t of cat.tiposDePasso) {
    const props = esquema.find(e => e.properties.tipo.const === t.tipo)!.properties;
    assert.deepEqual(Object.keys(props).filter(k => k !== 'tipo').sort(), Object.keys(t.campos).sort(), t.tipo);
  }
});

test('as ferramentas do Atlas têm descrições curtas e somam menos de 20 KB', () => {
  const ctxL = { repo: () => null, mapaAberto: () => null, abrirMapa: async () => {} };
  const ctxE = { store: () => null, repo: () => null, abrirMapa: async () => {} };
  const todas = [...ferramentasDeLeitura(ctxL), ...ferramentasDeEscrita(ctxE)];
  assert.equal(todas.length, 22);
  for (const f of todas) {
    assert.ok(f.descricao.length <= 800, `${f.nome} passou de 800 caracteres: ${f.descricao.length}`);
    assert.ok(f.descricao.length >= 40, `${f.nome} descrição muito curta: ${f.descricao.length}`);
  }
  const bytes = Buffer.byteLength(JSON.stringify(todas));
  assert.ok(bytes < 20_000, `Esperava soma das atlas_* menor que 20 KB (20000 bytes), obteve ${bytes}`);
});


test('orçamento: descrições até 400 caracteres e campos até 80', () => {
  const { f } = montar();
  const varrer = (o: unknown, limite: number): string[] => !o || typeof o !== 'object' ? [] : [...(typeof (o as { description?: unknown }).description === 'string' && ((o as { description: string }).description.length > limite) ? [(o as { description: string }).description] : []), ...Object.values(o).flatMap(v => varrer(v, limite))];
  for (const x of Object.values(f)) { assert.ok(x.descricao.length <= 400, x.nome); assert.deepEqual(varrer(x.esquema, 80), [], x.nome); }
});
