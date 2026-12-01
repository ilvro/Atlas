import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificar } from '../../src/domain/celulas.ts';
import { copiasDe, novaLuz, novaPeca, novoObjeto } from '../../src/domain/fabrica.ts';
import { limparOrfaos } from '../../src/domain/geometria.ts';
import { desvincularLuz, idDaLuzPropria, luzDoObjeto, sincronizarLuzesProprias } from '../../src/domain/luz-propria.ts';
import { criarMapa, type MapaAtlas } from '../../src/domain/mapa.ts';
import { direcaoDeVisaoDaPeca } from '../../src/domain/nevoa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { criarStore, type EventoStore } from '../../src/state/store.ts';
import { mapaCom, sala } from './apoio-casa.ts';

function comInterruptorParaLuz(m: MapaAtlas, luzId: string): MapaAtlas {
  const sw = novoObjeto([2, 2], {
    id: 'int1',
    interaction: { kind: 'switch', on: true, targets: [luzId], sound: null, clue: null },
  });
  m.props[sw.id] = sw;
  return m;
}

test('R1.1 store gesto.concluir faz rollback se validarMapa falhar e avisa cancelar', () => {
  const m = criarMapa();
  const l = novaLuz([3, 3], {
    id: 'lant',
    ownerId: 't1',
    cone: { angle: Math.PI / 3, direction: 0 },
  });
  const t = novaPeca([3, 3], 'Heroi', { id: 't1', player: true, lightId: 'lant' });
  m.lights[l.id] = l;
  m.tokens[t.id] = t;

  const eventos: EventoStore['tipo'][] = [];
  const terminos: ('concluir' | 'cancelar')[] = [];
  const store = criarStore(m, {
    aoTerminarGesto: motivo => terminos.push(motivo),
  });
  store.assinar(e => eventos.push(e.tipo));
  const antes = store.documento;
  const vAntes = store.versaoEdicao;

  const g = store.iniciarGesto('Arrasto invalido');
  // direcao = 2000 passa pelo peca.mover com emArrasto: true, mas falha na faixa [-1000, 1000] do validarMapa
  g.aplicar({ tipo: 'peca.mover', id: 't1', para: [4.5, 3], livre: true, semGrade: true, emArrasto: true, direcao: 2000 });
  assert.throws(() => g.concluir());

  assert.equal(store.documento, antes);
  assert.equal(store.versaoEdicao, vAntes + 2);
  assert.equal(store.emGesto, false);
  assert.equal(store.podeDesfazer, false);
  assert.deepEqual(eventos, ['gesto', 'cancelar']);
  assert.deepEqual(terminos, ['cancelar']);
  validarMapa(store.documento);
});

test('R1.2 store fusao remove entrada no-op do desfazer e substituir cancela gesto ativo', () => {
  const store = criarStore(criarMapa({ nome: 'Original' }));
  store.executar({ tipo: 'mapa.renomear', nome: 'Temporario' }, { fusao: 'nome' });
  assert.equal(store.historico.length, 1);
  store.executar({ tipo: 'mapa.renomear', nome: 'Original' }, { fusao: 'nome' });
  assert.equal(store.podeDesfazer, false);
  assert.equal(store.historico.length, 0);

  // Também funciona quando um gesto com fusao retorna ao estado inicial da entrada fundida
  store.executar({ tipo: 'mapa.renomear', nome: 'Temporario' }, { fusao: 'nome2' });
  const gFuse = store.iniciarGesto('Voltar', { fusao: 'nome2' });
  gFuse.aplicar({ tipo: 'mapa.renomear', nome: 'Original' });
  gFuse.concluir();
  assert.equal(store.podeDesfazer, false);

  // substituir() com gesto ativo chama aoTerminarGesto('cancelar') antes de limpar o gesto
  const motivos: ('concluir' | 'cancelar')[] = [];
  const store2 = criarStore(criarMapa(), {
    aoTerminarGesto: m => motivos.push(m),
  });
  const gAtivo = store2.iniciarGesto('Ativo');
  gAtivo.aplicar({ tipo: 'mapa.renomear', nome: 'Em andamento' });
  store2.substituir(criarMapa({ id: 'outro', nome: 'Outro' }));
  assert.deepEqual(motivos, ['cancelar']);
  assert.equal(store2.emGesto, false);
  assert.equal(gAtivo.ativo, false);
});

test('R1.3 luz-propria: id <= 64 chars, raio limitado a [0.1, 200], flicker/ownerId sincronizados e desvincularLuz', () => {
  const idLongo = 'o_'.repeat(32); // 64 chars (> 61)
  assert.equal(idLongo.length, 64);
  const lpLongo = idDaLuzPropria(idLongo);
  assert.ok(lpLongo.length <= 64);
  assert.match(lpLongo, /^[A-Za-z0-9_-]{1,64}$/);
  assert.equal(idDaLuzPropria(idLongo), lpLongo);

  // Valida no mapa completo com objeto de id de 64 chars
  const objLongo = novoObjeto([4, 4], { id: idLongo, source: ACERVO.fonte('cogumelo-gigante', 1, { brilho: 1 }) });
  const mLongo = aplicarComando(criarMapa(), { tipo: 'item.adicionar', colecao: 'props', item: objLongo });
  validarMapa(mLongo);
  assert.ok(mLongo.lights[lpLongo]);

  // Clamp de raio para [0.1, 200]
  const minObj = novoObjeto([3, 3], { scale: 0.05, source: ACERVO.fonte('cogumelo-gigante', 1, { brilho: 0.1 }) });
  const luzMin = luzDoObjeto(minObj)!;
  assert.ok(luzMin.radius >= 0.1 && luzMin.radius <= 200);

  const maxObj = novoObjeto([3, 3], { scale: 50, source: ACERVO.fonte('cogumelo-gigante', 1, { brilho: 1 }) });
  const luzMax = luzDoObjeto(maxObj)!;
  assert.equal(luzMax.radius, 200);

  // sincronizarLuzesProprias detecta flicker e ownerId divergentes
  const m = criarMapa();
  const cog = novoObjeto([5, 5], { id: 'cog1', source: ACERVO.fonte('cogumelo-gigante', 2, {}) });
  m.props[cog.id] = cog;
  sincronizarLuzesProprias(m);
  const lpId = idDaLuzPropria(cog.id);
  m.lights[lpId]!.flicker = 0.99;
  m.lights[lpId]!.ownerId = null;
  assert.equal(sincronizarLuzesProprias(m), true);
  assert.notEqual(m.lights[lpId]!.flicker, 0.99);
  assert.equal(m.lights[lpId]!.ownerId, cog.id);

  // Ao apagar brilho, sincronizarLuzesProprias remove lp-* e desvincula interruptor, token e revealed
  comInterruptorParaLuz(m, lpId);
  m.tokens.t1 = novaPeca([5, 5], 'Portador', { id: 't1', lightId: lpId });
  m.session.revealed.push(lpId);
  const semBrilho = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'props', id: cog.id, patch: { source: { params: { brilho: 0 } } } });
  assert.equal(semBrilho.lights[lpId], undefined);
  assert.deepEqual(semBrilho.props.int1!.interaction!.targets, []);
  assert.equal(semBrilho.tokens.t1!.lightId, null);
  assert.equal(semBrilho.session.revealed.includes(lpId), false);
});

test('R1.4 desvincularLuz limpa referências em remover(), andar.remover e limparOrfaos()', () => {
  // 1. item.remover de luz
  let m = criarMapa();
  m.lights.l1 = novaLuz([2, 2], { id: 'l1' });
  comInterruptorParaLuz(m, 'l1');
  m.tokens.t1 = novaPeca([2, 2], 'T1', { id: 't1', lightId: 'l1' });
  m.session.revealed.push('l1');
  m = aplicarComando(m, { tipo: 'item.remover', colecao: 'lights', id: 'l1' });
  assert.deepEqual(m.props.int1!.interaction!.targets, []);
  assert.equal(m.tokens.t1!.lightId, null);
  assert.deepEqual(m.session.revealed, []);

  // 2. andar.remover
  let mAndar = criarMapa();
  mAndar.levels = { a2: { id: 'a2', name: '2º andar', order: 1 } };
  mAndar.lights.l2 = novaLuz([2, 2], { id: 'l2', levelId: 'a2' });
  comInterruptorParaLuz(mAndar, 'l2'); // interruptor no térreo apontando para luz do 2º andar
  mAndar.tokens.t1 = novaPeca([2, 2], 'T1', { id: 't1', lightId: 'l2' });
  mAndar.session.revealed.push('l2');
  mAndar = aplicarComando(mAndar, { tipo: 'andar.remover', id: 'a2' });
  assert.equal(mAndar.lights.l2, undefined);
  assert.deepEqual(mAndar.props.int1!.interaction!.targets, []);
  assert.equal(mAndar.tokens.t1!.lightId, null);
  assert.equal(mAndar.session.revealed.includes('l2'), false);

  // 3. limparOrfaos() direto
  const mOrfao = criarMapa();
  mOrfao.lights.lOrfa = novaLuz([2, 2], { id: 'lOrfa', ownerId: 'prop_sumiu' });
  comInterruptorParaLuz(mOrfao, 'lOrfa');
  mOrfao.tokens.t1 = novaPeca([2, 2], 'T1', { id: 't1', lightId: 'lOrfa' });
  mOrfao.session.revealed.push('lOrfa');
  limparOrfaos(mOrfao);
  assert.equal(mOrfao.lights.lOrfa, undefined);
  assert.deepEqual(mOrfao.props.int1!.interaction!.targets, []);
  assert.equal(mOrfao.tokens.t1!.lightId, null);
  assert.equal(mOrfao.session.revealed.includes('lOrfa'), false);
  // desvincularLuz exportado diretamente também funciona isolado
  desvincularLuz(mOrfao, 'inexistente');
});

test('R1.5 selecao.mover carrega luz da peça, desanexa prop de parede e peca.virar+peca.mover mantém direção sincronizada', () => {
  const m = mapaCom(sala('s', 0, 0, 8, 8));
  const idParede = Object.keys(m.walls)[0]!;
  m.props.quadro = novoObjeto([1.5, 0], {
    id: 'quadro',
    elevation: 'wall',
    wall: { wallId: idParede, at: 0.25, face: 'inner' },
    roomId: 's',
  });
  m.lights.lant = novaLuz([3.75, 3.75], {
    id: 'lant',
    ownerId: 't1',
    cone: { angle: Math.PI / 3, direction: 0 },
  });
  m.tokens.t1 = novaPeca([3.75, 3.75], 'Peca', { id: 't1', player: true, lightId: 'lant' });

  // Mover seleção de token + quadro de parede (sem incluir a luz nos alvos)
  let d = aplicarComando(m, {
    tipo: 'selecao.mover',
    alvos: [{ colecao: 'tokens', id: 't1' }, { colecao: 'props', id: 'quadro' }],
    delta: [1.5, 1.5],
  });
  assert.deepEqual(d.tokens.t1!.position, [5.25, 5.25]);
  assert.deepEqual(d.lights.lant!.position, [5.25, 5.25]);
  assert.equal(d.props.quadro!.wall, null);
  assert.equal(d.props.quadro!.elevation, 'floor');

  // Se ambos token e luz estão em alvos, a luz desloca uma vez só
  const dAmbos = aplicarComando(m, {
    tipo: 'selecao.mover',
    alvos: [{ colecao: 'tokens', id: 't1' }, { colecao: 'lights', id: 'lant' }],
    delta: [1.5, 0],
  });
  assert.deepEqual(dAmbos.lights.lant!.position, [5.25, 3.75]);

  // peca.virar depois peca.mover não pode deixar vision.direction dessincronizada do cone da lanterna
  d = aplicarComando(d, { tipo: 'peca.virar', id: 't1', direcao: Math.PI / 2 });
  assert.equal(d.lights.lant!.cone!.direction, Math.PI / 2);
  assert.equal(d.tokens.t1!.vision.direction, Math.PI / 2);
  d = aplicarComando(d, { tipo: 'peca.mover', id: 't1', para: [6.75, 5.25] }); // move para a direita (0 rad)
  assert.equal(d.lights.lant!.cone!.direction, 0);
  assert.equal(d.tokens.t1!.vision.direction, 0);
  assert.equal(direcaoDeVisaoDaPeca(d, d.tokens.t1!), 0);
});

test('R1.6 comodo.pintar/apagar limpam outline e terreno.apagar limpa submerged', () => {
  let m = aplicarComando(criarMapa(), {
    tipo: 'comodo.criar',
    id: 'torre',
    nome: 'Torre',
    funcao: 'sala',
    piso: { material: 'madeira', seed: 1 },
    papel: null,
    telhado: 'telha.escamas',
    celulas: [[2, 2]],
    outline: [[3, 3], [6, 3], [6, 6], [3, 6]],
  });
  assert.ok(m.rooms.torre!.outline);

  // Pintar célula adicional remove outline para que as paredes derivadas acompanhem as células
  const pintado = aplicarComando(m, { tipo: 'comodo.pintar', id: 'torre', celulas: [[4, 2]] });
  assert.equal(pintado.rooms.torre!.outline, undefined);

  // Apagar célula também remove outline
  const apagado = aplicarComando(m, { tipo: 'comodo.apagar', celulas: [[2, 2]] });
  assert.equal(apagado.rooms.torre!.outline, undefined);

  // terreno.apagar limpa terrain.submerged
  let mt = aplicarComando(criarMapa(), { tipo: 'terreno.pintar', material: 'grama', celulas: [[1, 1], [2, 1]] });
  mt = aplicarComando(mt, { tipo: 'terreno.pintar', material: 'agua', celulas: [[1, 1], [2, 1]], lembrar: true });
  assert.ok(mt.terrain.submerged && Object.keys(mt.terrain.submerged).length > 0);
  mt = aplicarComando(mt, { tipo: 'terreno.apagar', celulas: [[1, 1], [2, 1]] });
  assert.equal(mt.terrain.submerged, undefined);
  // Células restantes em submerged seguem codificadas corretamente
  assert.deepEqual(codificar([]), []);
});

test('R1.7 copiasDe evita duplicar lp-* com dono copiado e limita nome da peça a 120 caracteres', () => {
  const cog = novoObjeto([4, 4], { id: 'cog1', source: ACERVO.fonte('cogumelo-gigante', 1, {}) });
  let m = aplicarComando(criarMapa(), { tipo: 'item.adicionar', colecao: 'props', item: cog });
  const lpId = idDaLuzPropria(cog.id);
  assert.ok(m.lights[lpId]);

  const nomeLongo = 'A'.repeat(118);
  const peca = novaPeca([2, 2], nomeLongo, { id: 't1' });
  m = aplicarComando(m, { tipo: 'item.adicionar', colecao: 'tokens', item: peca });

  const { comandos, alvos } = copiasDe(m, [
    { colecao: 'props', id: cog.id },
    { colecao: 'lights', id: lpId },
    { colecao: 'tokens', id: peca.id },
  ], [1, 1]);

  // lp-* não deve ser duplicada diretamente quando o dono também está nos alvos
  assert.equal(comandos.filter(c => c.colecao === 'lights').length, 0);
  assert.equal(alvos.filter(a => a.colecao === 'lights').length, 0);
  const tokenCopia = comandos.find(c => c.colecao === 'tokens')!.item;
  assert.ok(String(tokenCopia.name).length <= 120);
  assert.ok(String(tokenCopia.name).endsWith(' (cópia)'));

  for (const cmd of comandos) m = aplicarComando(m, cmd);
  validarMapa(m);
  // Agora há exatamente 2 luzes próprias: uma do original e uma do copiado
  assert.equal(Object.keys(m.lights).length, 2);

  // Copiar apenas a lp-* sem o dono ainda cria uma cópia independente da luz
  const soLuz = copiasDe(m, [{ colecao: 'lights', id: lpId }], [2, 0]);
  assert.equal(soLuz.comandos.length, 1);
  assert.equal(soLuz.comandos[0]!.item.ownerId, null);
});
