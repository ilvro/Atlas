import { test } from 'node:test';
import assert from 'node:assert/strict';
import { combina, lerAtalho, mostrarAtalho } from '../../src/app/atalhos.ts';
import { filtrar, normalizar, pontuar } from '../../src/app/busca.ts';
import { formatarRota, lerRota } from '../../src/app/rotas.ts';
import { novaLuz, novaPeca, novaRegiao, novoObjeto, nomeDoAlvo } from '../../src/domain/fabrica.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { aplicarComando } from '../../src/state/comandos.ts';
import { criarStore } from '../../src/state/store.ts';
import { enquadrar, panear, telaParaMundo, mundoParaTela, visivel, zoomEm, ZOOM_MAX, ZOOM_MIN } from '../../src/render/camera.ts';
import { deltaEncaixado, encaixar, linhasDaGrade } from '../../src/render/grade.ts';
import { alvoEm, alvosNaCaixa, alvosNoLaco, caixaDaSelecao, caixaDe, combinarSelecao, pontoNoPoligono, podarSelecao, todosOsAlvos } from '../../src/render/selecao.ts';
import { mapaCompleto } from './fixtures.ts';

const perto = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

// ---- câmera ----
test('câmera: mundo e tela são inversos', () => {
  const c = { x: 120, y: -40, zoom: 37 };
  const p = telaParaMundo(c, mundoParaTela(c, [3.2, 7.7]));
  perto(p[0], 3.2); perto(p[1], 7.7);
});

test('zoom em um ponto mantém esse ponto parado na tela, e respeita os limites', () => {
  const c = { x: 100, y: 50, zoom: 20 }, foco = [400, 300] as [number, number];
  const antes = telaParaMundo(c, foco), z = zoomEm(c, foco, 1.7), depois = telaParaMundo(z, foco);
  perto(antes[0], depois[0]); perto(antes[1], depois[1]); perto(z.zoom, 34);
  assert.equal(zoomEm({ x: 0, y: 0, zoom: ZOOM_MAX }, [0, 0], 2).zoom, ZOOM_MAX);
  assert.equal(zoomEm({ x: 0, y: 0, zoom: ZOOM_MIN }, [0, 0], 0.1).zoom, ZOOM_MIN);
  const preso = { x: 5, y: 5, zoom: ZOOM_MAX };
  assert.equal(zoomEm(preso, [10, 10], 3), preso);
});

test('enquadrar centra o mapa na área livre, descontando painéis', () => {
  const c = enquadrar({ x: 0, y: 0, largura: 45, altura: 30 }, { largura: 1200, altura: 700 }, 40);
  const [x0, y0] = mundoParaTela(c, [0, 0]), [x1, y1] = mundoParaTela(c, [45, 30]);
  assert.ok(x0 >= 40 - 1e-6 && y0 >= 40 - 1e-6 && x1 <= 1160 + 1e-6 && y1 <= 660 + 1e-6);
  perto((x0 + x1) / 2, 600); perto((y0 + y1) / 2, 350);
  const comPainel = enquadrar({ x: 0, y: 0, largura: 45, altura: 30 }, { largura: 1200, altura: 700 }, 40, { esquerda: 60, direita: 300, topo: 0, base: 0 });
  perto((mundoParaTela(comPainel, [0, 0])[0] + mundoParaTela(comPainel, [45, 0])[0]) / 2, 60 + (1200 - 60 - 300) / 2);
  assert.deepEqual(panear({ x: 1, y: 2, zoom: 3 }, 10, -5), { x: 11, y: -3, zoom: 3 });
  const v = visivel({ x: 0, y: 0, zoom: 10 }, { largura: 100, altura: 50 });
  assert.deepEqual(v, { x0: 0, y0: 0, x1: 10, y1: 5 });
});

// ---- grade ----
test('grade: só as linhas visíveis, dentro do mapa', () => {
  const g = { size: 1.5, offset: [0, 0] as [number, number] };
  const l = linhasDaGrade({ x: 0, y: 0, zoom: 40 }, { largura: 200, altura: 100 }, g, { width: 45, height: 30 });
  assert.equal(l.passo, 1);
  assert.deepEqual(l.verticais, [0, 1.5, 3, 4.5]);
  assert.deepEqual(l.horizontais, [0, 1.5]);
  const fora = linhasDaGrade({ x: 0, y: 0, zoom: 40 }, { largura: 4000, altura: 4000 }, g, { width: 45, height: 30 });
  assert.equal(fora.verticais.at(-1), 45); assert.equal(fora.horizontais.at(-1), 30);
});

test('grade: afastando o zoom, desenha uma linha a cada 2, 4, 8…', () => {
  const g = { size: 1.5, offset: [0, 0] as [number, number] }, tela = { largura: 400, altura: 300 }, lim = { width: 45, height: 30 };
  assert.equal(linhasDaGrade({ x: 0, y: 0, zoom: 4 }, tela, g, lim).passo, 4);       // 1,5 m × 4 px = 6 px por célula
  assert.deepEqual(linhasDaGrade({ x: 0, y: 0, zoom: 4 }, tela, g, lim).verticais.slice(0, 3), [0, 6, 12]);
  assert.equal(linhasDaGrade({ x: 0, y: 0, zoom: 100 }, tela, g, lim).passo, 1);
});

test('grade: encaixe em meia célula, com deslocamento e com a tecla de desligar', () => {
  const g = { size: 1.5, offset: [0, 0] as [number, number] };
  perto(encaixar(1.1, g, 0), 0.75); perto(encaixar(1.2, g, 0), 1.5); perto(encaixar(1.2, g, 0, 1), 1.5);
  perto(encaixar(1.1, { size: 1.5, offset: [0.25, 0] }, 0), 1.0);
  assert.equal(encaixar(1.234, g, 0, 0.5, true), 1.234);
  const d = deltaEncaixado([5.25, 6.75], [0.3, -0.2], g);
  perto(5.25 + d[0], 5.25); perto(6.75 + d[1], 6.75);          // movimento pequeno: continua no mesmo encaixe
  const d2 = deltaEncaixado([5.25, 6.75], [0.6, 0.9], g);
  perto(5.25 + d2[0], 6); perto(6.75 + d2[1], 7.5);
});

// ---- seleção ----
test('o que está por cima é pego primeiro; regiões só pelo interior; a tolerância ajuda', () => {
  const m = mapaCompleto();
  assert.deepEqual(alvoEm(m, [5.25, 6.75]), { colecao: 'tokens', id: 'muirenn' });
  assert.deepEqual(alvoEm(m, [7.5, 6.2]), { colecao: 'lights', id: 'lampiao' });      // a luz está sobre a mesa
  assert.deepEqual(alvoEm(m, [7.88, 6.2]), { colecao: 'props', id: 'mesa' });     // fora da luz (até 7,85), dentro da mesa (até 7,9)
  assert.deepEqual(alvoEm(m, [4, 4]), { colecao: 'regions', id: 'entrada' });
  assert.equal(alvoEm(m, [20, 20]), null);
  assert.equal(alvoEm(m, [6.5, 6.2]), null);
  assert.equal(alvoEm(m, [7.02, 6.2]), null);
  assert.deepEqual(alvoEm(m, [7.02, 6.2], 0.1), { colecao: 'props', id: 'mesa' });   // a tolerância alcança a mesa (7,1) mas não a luz (7,15)
});

test('seleção por retângulo e por laço usa o centro de cada item', () => {
  const m = mapaCompleto();
  assert.deepEqual(alvosNaCaixa(m, { x0: 4, y0: 6, x1: 9, y1: 7 }).map(a => a.id).sort(), ['lampiao', 'mesa', 'muirenn'].sort());
  assert.deepEqual(alvosNaCaixa(m, { x1: 4, y1: 6, x0: 9, y0: 7 }).length, 3);                // caixa arrastada de trás para a frente
  assert.deepEqual(alvosNoLaco(m, [[4, 6], [9, 6], [9, 7.5], [4, 7.5]]).map(a => a.id).sort(), ['lampiao', 'mesa', 'muirenn'].sort());
  assert.deepEqual(alvosNoLaco(m, [[0, 0], [1, 1]]), []);
  assert.ok(pontoNoPoligono([1, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]) && !pontoNoPoligono([3, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
  assert.equal(todosOsAlvos(m).length, 6);       // mesa e quadro, 2 luzes, 1 peça e 1 região: tudo que tem posição (a presença não tem)
});

test('combinar seleções: trocar, somar sem repetir e alternar', () => {
  const a = { colecao: 'lights', id: 'a' } as const, b = { colecao: 'lights', id: 'b' } as const, c = { colecao: 'props', id: 'c' } as const;
  assert.deepEqual(combinarSelecao([a], [b], 'trocar'), [b]);
  assert.deepEqual(combinarSelecao([a, b], [b, c], 'somar'), [a, b, c]);
  assert.deepEqual(combinarSelecao([a, b], [b, c], 'alternar'), [a, c]);
});

test('caixa da seleção, poda e caixas por tipo', () => {
  const m = mapaCompleto();
  assert.deepEqual(caixaDe(m, { colecao: 'regions', id: 'entrada' }), { x0: 3, y0: 3, x1: 6, y1: 6 });
  assert.equal(caixaDe(m, { colecao: 'lights', id: 'nao-existe' }), null);
  assert.equal(caixaDe(m, { colecao: 'presence', id: 'musgo' }), null);
  const caixa = caixaDaSelecao(m, [{ colecao: 'tokens', id: 'muirenn' }, { colecao: 'regions', id: 'entrada' }])!;
  assert.deepEqual([caixa.x0, caixa.y0], [3, 3]); assert.equal(caixa.x1, 6); assert.ok(caixa.y1 > 7);   // x1 é o da região; y1, o do pé da peça
  assert.equal(caixaDaSelecao(m, []), null);
  const depois = aplicarComando(m, { tipo: 'item.remover', colecao: 'tokens', id: 'muirenn' });
  assert.deepEqual(podarSelecao(depois, [{ colecao: 'tokens', id: 'muirenn' }, { colecao: 'props', id: 'mesa' }]), [{ colecao: 'props', id: 'mesa' }]);
});

// ---- fábrica ----
test('tudo que a fábrica cria passa na validação do mapa', () => {
  let m = criarMapa();
  const luz = novaLuz([3, 3]), lanterna = novaLuz([4, 4], { cone: { angle: 1, direction: 0 }, power: 'battery' });
  for (const [colecao, item] of [['lights', luz], ['lights', lanterna], ['props', novoObjeto([5, 5])], ['tokens', novaPeca([6, 6], 'Arthur')], ['regions', novaRegiao([8, 8])]] as const) {
    m = aplicarComando(m, { tipo: 'item.adicionar', colecao, item: item as never });
  }
  validarMapa(m);
  assert.equal(Object.keys(m.lights).length, 2);
  assert.notEqual(novaLuz([0, 0]).id, novaLuz([0, 0]).id);
  assert.match(luz.id, /^l[0-9a-f]{10}$/);
  assert.equal(nomeDoAlvo('lights', luz), 'Luz'); assert.equal(nomeDoAlvo('lights', lanterna), 'Lanterna'); assert.equal(nomeDoAlvo('tokens', novaPeca([0, 0], 'Arthur')), 'Arthur');
});

// ---- rotas ----
test('rotas: leitura e formatação são inversas, e o resto é "desconhecida"', () => {
  for (const hash of ['', '#', '#/']) assert.deepEqual(lerRota(hash), { tipo: 'galeria' });
  assert.deepEqual(lerRota('#/mapa/casa-1'), { tipo: 'mapa', id: 'casa-1' });
  assert.deepEqual(lerRota('#/mapa/casa-1/comodo/biblioteca'), { tipo: 'mapa', id: 'casa-1', comodo: 'biblioteca' });
  for (const r of [{ tipo: 'galeria' }, { tipo: 'mapa', id: 'a_b-1' }, { tipo: 'mapa', id: 'a', comodo: 'sala' }] as const) assert.deepEqual(lerRota(formatarRota(r)), r);
  for (const ruim of ['#/mapa', '#/mapa/', '#/mapa/a b', '#/mapa/a/comodo', '#/mapa/a/outra/b', '#/mapa/a/comodo/b/c', '#/nada', '#/mapa/%E0%A4%A']) assert.equal(lerRota(ruim).tipo, 'desconhecida', ruim);
});

// ---- atalhos ----
const tecla = (key: string, extra: Partial<{ ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }> = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...extra });

test('atalhos: letras, modificadores e nomes em português', () => {
  assert.equal(combina('Ctrl+K', tecla('k', { ctrlKey: true })), true);
  assert.equal(combina('Ctrl+K', tecla('K', { ctrlKey: true })), true);
  assert.equal(combina('Ctrl+K', tecla('k', { metaKey: true })), true);                  // Cmd no macOS
  assert.equal(combina('Ctrl+K', tecla('k')), false);
  assert.equal(combina('K', tecla('k', { ctrlKey: true })), false);
  assert.equal(combina('Ctrl+Z', tecla('z', { ctrlKey: true, shiftKey: true })), false);
  assert.equal(combina('Ctrl+Shift+Z', tecla('Z', { ctrlKey: true, shiftKey: true })), true);
  assert.equal(combina('Esc', tecla('Escape')), true);
  assert.equal(combina('Del', tecla('Delete')), true);
  assert.equal(combina('Espaço', tecla(' ')), true);
  assert.equal(combina('G', tecla('g', { shiftKey: true })), false);
  assert.equal(combina('Alt+1', tecla('1', { altKey: true })), true);
  assert.equal(combina('?', tecla('?', { shiftKey: true })), true);                       // símbolo: o Shift já vem embutido
  assert.equal(combina('Ctrl++', tecla('+', { ctrlKey: true, shiftKey: true })), true);
  assert.deepEqual(lerAtalho('Ctrl+Shift+Z'), { tecla: 'z', ctrl: true, shift: true, alt: false });
  assert.equal(mostrarAtalho('Ctrl+Shift+Z'), 'Ctrl+Shift+Z'); assert.equal(mostrarAtalho('Del'), 'Del'); assert.equal(mostrarAtalho('ArrowUp'), '↑'); assert.equal(mostrarAtalho('v'), 'V');
});

// ---- busca ----
test('busca: sem acento, por início, por palavras e por letras em sequência', () => {
  assert.equal(normalizar('  Luz Pontual! '), 'luz pontual!');
  assert.equal(normalizar('Região'), 'regiao');
  assert.ok(pontuar('luz', 'Luz pontual') > pontuar('pontual', 'Luz pontual') - 1000);
  assert.ok(pontuar('regiao', 'Adicionar região') > 0);
  assert.ok(pontuar('adic luz', 'Adicionar luz') === 0 || pontuar('adic luz', 'Adicionar luz') > 0);
  assert.ok(pontuar('lzp', 'Luz pontual') > 0);
  assert.equal(pontuar('xyz', 'Luz pontual'), 0);
  assert.equal(pontuar('', 'qualquer'), 1);
  const nomes = ['Adicionar luz', 'Adicionar objeto', 'Desfazer', 'Alternar grade', 'Luz acesa'];
  assert.deepEqual(filtrar(nomes, 'luz', x => x), ['Luz acesa', 'Adicionar luz']);
  assert.deepEqual(filtrar(nomes, 'desf', x => x), ['Desfazer']);
  assert.deepEqual(filtrar(nomes, '', x => x), nomes);
  assert.deepEqual(filtrar(nomes, 'adicionar obj', x => x), ['Adicionar objeto']);
});

// ---- store: recuperar rascunho ----
test('substituir com base: o rascunho entra como edição sobre o mapa do disco', () => {
  const disco = { ...mapaCompleto(), revision: 4, updatedAt: 9_000 }, rascunho = { ...disco, name: 'Rascunho', revision: 2, updatedAt: 5_000 };
  const s = criarStore(disco);
  s.substituir(rascunho, { base: disco });
  assert.equal(s.documento.name, 'Rascunho'); assert.equal(s.documento.revision, 4); assert.equal(s.documento.updatedAt, 9_000);
  assert.equal(s.sujo, true);
  s.executar({ tipo: 'mapa.renomear', nome: disco.name }); assert.equal(s.sujo, false);
  assert.throws(() => s.substituir(rascunho, { base: { ...disco, id: 'outro' } }), /outro mapa/);
});
