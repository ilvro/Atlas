import { test } from 'node:test';
import assert from 'node:assert/strict';
import { camadaDoObjeto, camadaPadrao, ehArvore } from '../../src/domain/camadas.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';
import { ACERVO } from '../../src/procedural/acervo.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { alvoEm } from '../../src/render/selecao.ts';

test('camadaPadrao atribui camadas corretas por tipo de objeto', () => {
  const arvore = novoObjeto([0, 0], { source: ACERVO.fonte('casa:arvore-3m', 1) });
  const pinheiro = novoObjeto([0, 0], { source: ACERVO.fonte('casa:pinheiro-3m', 1) });
  const carvalho = novoObjeto([0, 0], { source: ACERVO.fonte('casa:carvalho-grande-6m', 1) });
  const tronco = novoObjeto([0, 0], { source: ACERVO.fonte('tronco.caido', 1) });
  const toco = novoObjeto([0, 0], { source: ACERVO.fonte('toco', 1) });
  const pedra = novoObjeto([0, 0], { source: ACERVO.fonte('pedra.pequena', 1) });
  const mesa = novoObjeto([0, 0], { source: ACERVO.fonte('mesa.retangular', 1) });
  const itemMesa = novoObjeto([0, 0], { source: ACERVO.fonte('papeis', 1), elevation: 'table' });
  const tapete = novoObjeto([0, 0], { source: ACERVO.fonte('tapete.persa', 1) });
  const arvoreMortaCaida = novoObjeto([0, 0], { source: ACERVO.fonte('arvore-morta-caida', 1) });
  const teto = novoObjeto([0, 0], { source: ACERVO.fonte('caixa', 1), elevation: 'ceiling' });

  // Árvores em pé ficam na camada 2 (acima de troncos e pedras)
  assert.equal(camadaPadrao(arvore), 2);
  assert.equal(camadaPadrao(pinheiro), 2);
  assert.equal(camadaPadrao(carvalho), 2);
  assert.ok(ehArvore('casa:arvore-3m'));
  assert.ok(ehArvore('casa:pinheiro-3m'));

  // Troncos caídos, tocos e pedras ficam na camada 0 (piso)
  assert.equal(camadaPadrao(tronco), 0);
  assert.equal(camadaPadrao(toco), 0);
  assert.equal(camadaPadrao(pedra), 0);
  assert.equal(camadaPadrao(mesa), 0);
  assert.equal(ehArvore('tronco.caido'), false);
  assert.equal(ehArvore('toco'), false);
  assert.equal(ehArvore('arvore-morta-caida'), false);
  assert.equal(camadaPadrao(arvoreMortaCaida), 0);

  // Objetos sobre a mesa ficam na camada 1
  assert.equal(camadaPadrao(itemMesa), 1);

  // Tapetes ficam na camada -1 (abaixo de móveis)
  assert.equal(camadaPadrao(tapete), -1);

  // Teto fica na camada 3
  assert.equal(camadaPadrao(teto), 3);
});

test('camadaDoObjeto respeita override explícito em o.layer', () => {
  const arvore = novoObjeto([0, 0], { source: ACERVO.fonte('casa:arvore-3m', 1) });
  assert.equal(camadaDoObjeto(arvore), 2);

  // Forçar árvore para trás
  arvore.layer = -5;
  assert.equal(camadaDoObjeto(arvore), -5);

  const tronco = novoObjeto([0, 0], { source: ACERVO.fonte('tronco.caido', 1) });
  assert.equal(camadaDoObjeto(tronco), 0);

  // Forçar tronco para frente
  tronco.layer = 10;
  assert.equal(camadaDoObjeto(tronco), 10);
});

test('alvoEm seleciona a árvore quando sobreposta a um tronco criado depois', () => {
  const m = criarMapa();
  // Árvore criada primeiro
  m.props.arv = novoObjeto([10, 10], { id: 'arv', source: ACERVO.fonte('casa:arvore-5m', 1) });
  // Tronco caído sob a árvore criado depois
  m.props.tronco = novoObjeto([10, 10], { id: 'tronco', source: ACERVO.fonte('tronco.caido', 1) });

  // Clicar no ponto [10, 10] deve selecionar o alvo mais alto (a árvore, zIndex 2)
  const hit = alvoEm(m, [10, 10]);
  assert.equal(hit?.colecao, 'props');
  assert.equal(hit?.id, 'arv');
});
