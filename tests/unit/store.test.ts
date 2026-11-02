import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conteudo, criarMapa, type Luz, type MapaAtlas, type Peca } from '../../src/domain/mapa.ts';
import { ErroDeComando, aplicarComando, type Comando } from '../../src/state/comandos.ts';
import { diferencas } from '../../src/state/mudancas.ts';
import { ErroDeStore, criarStore, type EventoStore } from '../../src/state/store.ts';
import { mapaCompleto } from './fixtures.ts';

const luz = (id: string, extra: Partial<Luz> = {}): Luz => ({ id, position: [4, 4], radius: 5, color: '#ffaa55', intensity: 1, flicker: 0, cone: null, ownerId: null, power: 'fire', on: true, nightOnly: false, ...extra });
const peca = (id: string, extra: Partial<Peca> = {}): Peca => ({ id, name: id, portrait: null, sprite: null, facing: 'down', position: [3, 3], size: 1, vision: { radius: 8, dark: false }, lightId: null, figure: { state: 'normal' }, refs: [], ...extra });
const add = (colecao: 'lights' | 'tokens', item: Luz | Peca): Comando => ({ tipo: 'item.adicionar', colecao, item: item as never });

test('comandos são puros: o mapa recebido nunca muda e o novo vem congelado', () => {
  const antes = criarMapa({ id: 'a', agora: 1 }), snapshot = JSON.stringify(antes);
  const depois = aplicarComando(antes, add('lights', luz('l1')));
  assert.equal(JSON.stringify(antes), snapshot);
  assert.ok(depois.lights.l1);
  assert.throws(() => { (depois as { name: string }).name = 'x'; }, TypeError);
  assert.throws(() => { depois.lights.l1!.radius = 1; }, TypeError);
});

test('um comando que não muda nada devolve o mesmo documento', () => {
  const m = mapaCompleto();
  assert.equal(aplicarComando(m, { tipo: 'mapa.renomear', nome: m.name }), m);
  assert.equal(aplicarComando(m, { tipo: 'estilo.atualizar', patch: { walls: m.style.walls } }), m);
});

test('compartilhamento estrutural: só o que mudou ganha referência nova', () => {
  const m = mapaCompleto(), depois = aplicarComando(m, { tipo: 'item.atualizar', colecao: 'lights', id: 'lampiao', patch: { radius: 9 } });
  assert.equal(depois.lights.lampiao!.radius, 9);
  assert.notEqual(depois.lights, m.lights); assert.notEqual(depois.lights.lampiao, m.lights.lampiao);
  assert.equal(depois.lights.lanterna, m.lights.lanterna);
  assert.equal(depois.rooms, m.rooms); assert.equal(depois.props, m.props); assert.equal(depois.tokens, m.tokens);
  assert.deepEqual(diferencas(m, depois), { completo: false, colecoes: { lights: ['lampiao'] }, campos: [] });
});

test('patches profundos mesclam por dentro e `undefined` apaga', () => {
  const m = criarMapa(), d = aplicarComando(m, { tipo: 'estilo.atualizar', patch: { pixel: { pixelsPerCell: 24 } } });
  assert.deepEqual(d.style.pixel, { pixelsPerCell: 24, dither: 'bayer4', outline: true });
  const l = aplicarComando(d, add('lights', luz('l', { cone: { angle: 1, direction: 0 } })));
  const sem = aplicarComando(l, { tipo: 'item.atualizar', colecao: 'lights', id: 'l', patch: { cone: null } });
  assert.equal(sem.lights.l!.cone, null);
});

test('um comando que deixaria o mapa inválido é recusado inteiro, com o motivo', () => {
  const m = criarMapa();
  assert.throws(() => aplicarComando(m, add('lights', luz('l', { color: 'laranja' }))), (e: unknown) => e instanceof ErroDeComando && /lights\.l\.color/.test(e.message));
  assert.throws(() => aplicarComando(m, { tipo: 'grade.atualizar', patch: { size: 0 } }), /grid\.size/);
  assert.throws(() => aplicarComando(m, add('tokens', peca('t', { lightId: 'nao-existe' }))), /tokens\.t\.lightId/);
  assert.throws(() => aplicarComando(m, { tipo: 'item.atualizar', colecao: 'lights', id: 'fantasma', patch: {} }), /Não existe/);
  const um = aplicarComando(m, add('lights', luz('l')));
  assert.throws(() => aplicarComando(um, add('lights', luz('l'))), /Já existe/);
  assert.throws(() => aplicarComando(um, { tipo: 'item.atualizar', colecao: 'lights', id: 'l', patch: { id: 'outro' } }), /identificador não muda/);
  assert.throws(() => aplicarComando(um, { tipo: 'selecao.mover', alvos: [{ colecao: 'lights', id: 'l' }], delta: [Number.NaN, 0] }), /Deslocamento inválido/);
});

test('remover um token leva a luz dele, a vez na iniciativa e o que foi revelado', () => {
  const m = mapaCompleto(), d = aplicarComando(m, { tipo: 'item.remover', colecao: 'tokens', id: 'muirenn' });
  assert.equal(d.tokens.muirenn, undefined); assert.equal(d.lights.lanterna, undefined);
  assert.equal(d.session.initiative, null);
  assert.ok(d.lights.lampiao);
});

test('remover um objeto leva a luz que era dele; remover a luz solta o token', () => {
  const m = mapaCompleto(), semMesa = aplicarComando(m, { tipo: 'item.remover', colecao: 'props', id: 'mesa' });
  assert.equal(semMesa.lights.lampiao, undefined); assert.ok(semMesa.lights.lanterna);
  const semLanterna = aplicarComando(m, { tipo: 'item.remover', colecao: 'lights', id: 'lanterna' });
  assert.equal(semLanterna.tokens.muirenn!.lightId, null);
});

test('mover a seleção desloca objetos, luzes, peças e regiões', () => {
  const m = mapaCompleto(), d = aplicarComando(m, { tipo: 'selecao.mover', delta: [1, -2], alvos: [
    { colecao: 'props', id: 'mesa' }, { colecao: 'lights', id: 'lampiao' }, { colecao: 'tokens', id: 'muirenn' }, { colecao: 'regions', id: 'entrada' }] });
  assert.deepEqual(d.props.mesa!.position, [8.5, 4.2]);
  assert.deepEqual(d.lights.lampiao!.position, [8.5, 4.2]);
  assert.deepEqual(d.tokens.muirenn!.position, [6.25, 4.75]);
  assert.deepEqual(d.regions.entrada!.polygon[0], [4, 1]);
  assert.deepEqual(diferencas(m, d).colecoes, { props: ['mesa'], lights: ['lampiao'], tokens: ['muirenn'], regions: ['entrada'] });
});

test('histórico: desfazer e refazer com rótulos, e uma ação nova apaga o refazer', () => {
  const s = criarStore(criarMapa({ id: 'a' })), eventos: string[] = [];
  s.assinar(e => eventos.push(`${e.tipo}:${e.rotulo}`));
  s.executar({ tipo: 'mapa.renomear', nome: 'Casa' });
  s.executar(add('lights', luz('l1')), { rotulo: 'Acender lampião' });
  assert.deepEqual(s.historico, ['Renomear mapa', 'Acender lampião']);
  assert.equal(s.rotuloDesfazer, 'Acender lampião');
  s.desfazer(); assert.equal(s.documento.lights.l1, undefined); assert.equal(s.rotuloRefazer, 'Acender lampião');
  s.refazer(); assert.ok(s.documento.lights.l1);
  s.desfazer(); s.executar({ tipo: 'mapa.notas', texto: 'x' });
  assert.equal(s.podeRefazer, false);
  assert.deepEqual(eventos, ['executar:Renomear mapa', 'executar:Acender lampião', 'desfazer:Acender lampião', 'refazer:Acender lampião', 'desfazer:Acender lampião', 'executar:Editar notas']);
});

test('o histórico guarda no máximo 150 ações', () => {
  const s = criarStore(criarMapa());
  for (let i = 0; i < 160; i++) s.executar({ tipo: 'mapa.renomear', nome: `n${i}` });
  assert.equal(s.historico.length, 150);
  for (let i = 0; i < 150; i++) s.desfazer();
  assert.equal(s.documento.name, 'n9'); assert.equal(s.podeDesfazer, false);
});

test('versaoEsperada protege sugestões geradas para um mapa que já mudou', () => {
  const s = criarStore(criarMapa()), v = s.versaoEdicao;
  s.executar({ tipo: 'mapa.renomear', nome: 'A' });
  assert.throws(() => s.executar({ tipo: 'mapa.renomear', nome: 'B' }, { versaoEsperada: v }), (e: unknown) => e instanceof ErroDeStore && /gere a sugestão novamente/.test(e.message));
  assert.equal(s.documento.name, 'A');
});

test('gesto: o mapa muda a cada passo, mas o histórico recebe uma entrada só', () => {
  const s = criarStore(mapaCompleto()), eventos: EventoStore[] = [];
  s.assinar(e => eventos.push(e));
  const g = s.iniciarGesto('Mover Muirenn');
  for (let i = 0; i < 20; i++) g.aplicar({ tipo: 'selecao.mover', alvos: [{ colecao: 'tokens', id: 'muirenn' }], delta: [0.1, 0] });
  assert.equal(s.emGesto, true); assert.equal(s.podeDesfazer, false);
  assert.ok(Math.abs(s.documento.tokens.muirenn!.position[0] - 7.25) < 1e-9);
  g.concluir();
  assert.equal(s.emGesto, false); assert.deepEqual(s.historico, ['Mover Muirenn']);
  assert.equal(eventos.filter(e => e.tipo === 'gesto').length, 20);
  assert.equal(eventos.at(-1)!.tipo, 'concluir');
  s.desfazer(); assert.deepEqual(s.documento.tokens.muirenn!.position, [5.25, 6.75]);
});

test('gesto cancelado volta ao mapa de antes; gesto sem efeito não vira entrada', () => {
  const s = criarStore(mapaCompleto()), antes = s.documento;
  const g = s.iniciarGesto('Mover');
  g.aplicar({ tipo: 'selecao.mover', alvos: [{ colecao: 'tokens', id: 'muirenn' }], delta: [5, 5] });
  g.cancelar();
  assert.equal(s.documento, antes); assert.equal(s.podeDesfazer, false);
  const vazio = s.iniciarGesto('Nada'); vazio.concluir();
  assert.equal(s.podeDesfazer, false);
  assert.throws(() => vazio.aplicar({ tipo: 'mapa.renomear', nome: 'x' }), /já terminou/);
});

test('durante um gesto não se executa por fora, e Ctrl+Z cancela o gesto em vez de desfazer o anterior', () => {
  const s = criarStore(mapaCompleto());
  s.executar({ tipo: 'mapa.renomear', nome: 'Antes' });
  const g = s.iniciarGesto('Mover');
  g.aplicar({ tipo: 'selecao.mover', alvos: [{ colecao: 'tokens', id: 'muirenn' }], delta: [1, 0] });
  assert.throws(() => s.executar({ tipo: 'mapa.renomear', nome: 'x' }), /gesto em andamento/);
  assert.throws(() => s.iniciarGesto('outro'), /Já há um gesto/);
  s.desfazer();
  assert.equal(g.ativo, false); assert.equal(s.documento.name, 'Antes'); assert.deepEqual(s.documento.tokens.muirenn!.position, [5.25, 6.75]);
  assert.equal(s.historico.length, 1);
});

test('transação: vários comandos, uma entrada; se falhar, nada fica', () => {
  const s = criarStore(criarMapa());
  s.transacao('Montar canto', g => {
    g.aplicar(add('lights', luz('a')));
    g.aplicar(add('lights', luz('b')));
    g.aplicar({ tipo: 'item.atualizar', colecao: 'lights', id: 'a', patch: { radius: 2 } });
  });
  assert.deepEqual(s.historico, ['Montar canto']);
  assert.deepEqual(Object.keys(s.documento.lights), ['a', 'b']);
  assert.throws(() => s.transacao('Quebra', g => { g.aplicar(add('lights', luz('c'))); g.aplicar(add('lights', luz('a'))); }), /Já existe/);
  assert.equal(s.documento.lights.c, undefined); assert.equal(s.emGesto, false); assert.equal(s.historico.length, 1);
  s.desfazer(); assert.deepEqual(s.documento.lights, {});
});

test('sujo: mapa novo precisa salvar; editar e desfazer volta a ficar limpo', () => {
  const novo = criarStore(criarMapa(), { salvo: false });
  assert.equal(novo.sujo, true);
  const s = criarStore(mapaCompleto());
  assert.equal(s.sujo, false);
  s.executar({ tipo: 'mapa.renomear', nome: 'Outro' }); assert.equal(s.sujo, true);
  s.desfazer(); assert.equal(s.sujo, false);
  s.executar({ tipo: 'mapa.renomear', nome: 'Outro' }); s.refazer(); assert.equal(s.sujo, true);
});

test('marcarSalvo aceita a revisão do repositório e as edições feitas enquanto gravava', () => {
  const s = criarStore(mapaCompleto());
  s.executar({ tipo: 'mapa.renomear', nome: 'v2' });
  const enviado = s.documento;
  s.executar({ tipo: 'mapa.notas', texto: 'escrevi durante a gravação' });
  s.marcarSalvo({ ...enviado, revision: 5, updatedAt: 9_999 });
  assert.equal(s.documento.revision, 5); assert.equal(s.documento.updatedAt, 9_999);
  assert.equal(s.sujo, true);                       // as notas ainda não foram gravadas
  s.desfazer();
  assert.equal(s.documento.revision, 5);            // o carimbo é do disco, não da edição
  assert.equal(s.sujo, false);                      // voltou exatamente ao que foi gravado
  assert.throws(() => s.marcarSalvo({ ...mapaCompleto(), id: 'outro' }), /outro mapa/);
  assert.throws(() => s.marcarSalvo({ ...enviado, revision: 2 }), /obsoleta/);
});

test('substituir troca o mapa, zera o histórico e avisa que mudou tudo', () => {
  const s = criarStore(mapaCompleto()), eventos: EventoStore[] = [];
  s.executar({ tipo: 'mapa.renomear', nome: 'x' });
  s.assinar(e => eventos.push(e));
  s.substituir(criarMapa({ id: 'novo', nome: 'Novo' }), { salvo: false });
  assert.equal(s.documento.id, 'novo'); assert.equal(s.podeDesfazer, false); assert.equal(s.sujo, true);
  assert.equal(eventos[0]!.tipo, 'substituir'); assert.equal(eventos[0]!.mudancas.completo, true);
  assert.throws(() => s.substituir({ ...criarMapa(), name: '' }), /name/);
});

test('o mapa inicial inválido não entra no store', () => {
  assert.throws(() => criarStore({ ...criarMapa(), grid: { kind: 'square', size: -1, offset: [0, 0], visible: true } }), /grid\.size/);
});

test('conteúdo do mapa gravado e do atual coincidem depois de uma ida e volta', () => {
  const s = criarStore(mapaCompleto());
  const antes = conteudo(s.documento);
  s.executar({ tipo: 'item.adicionar', colecao: 'lights', item: luz('x') as never });
  s.executar({ tipo: 'item.remover', colecao: 'lights', id: 'x' });
  assert.equal(conteudo(s.documento), antes); assert.equal(s.sujo, false);
});

test('diferencas: campos do topo e troca completa', () => {
  const m = criarMapa({ id: 'a' }), d = aplicarComando(m, { tipo: 'clima.aplicar', patch: { preset: 'noite' } });
  assert.deepEqual(diferencas(m, d), { completo: false, colecoes: {}, campos: ['climate'] });
  assert.equal(diferencas(m, criarMapa({ id: 'b' })).completo, true);
  assert.equal(diferencas(null, m).completo, true);
});

test('o documento do store continua um MapaAtlas válido em qualquer estado do histórico', () => {
  const s = criarStore(mapaCompleto());
  const passos: Comando[] = [add('lights', luz('x')), { tipo: 'item.remover', colecao: 'props', id: 'mesa' }, { tipo: 'item.remover', colecao: 'tokens', id: 'muirenn' }, { tipo: 'clima.aplicar', patch: { preset: 'apagao' } }];
  for (const p of passos) s.executar(p);
  const estados: MapaAtlas[] = [s.documento];
  while (s.podeDesfazer) estados.push(s.desfazer());
  while (s.podeRefazer) estados.push(s.refazer());
  assert.equal(estados.length, 9);
});
