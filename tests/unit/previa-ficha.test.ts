import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  previaDaFichaAberta,
  previaFixada,
  calcularPosicaoDaPrevia,
  urlDaPreviaDaFicha,
} from '../../src/app/previa-ficha.ts';
import { criarRef } from '#mesa';
import { refDaFicha } from '../../src/domain/fichas.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';

test('previa-ficha: signals de estado iniciam falsos e alternam corretamente', () => {
  previaDaFichaAberta.value = false;
  previaFixada.value = false;

  assert.equal(previaDaFichaAberta.value, false);
  assert.equal(previaFixada.value, false);

  previaDaFichaAberta.value = true;
  assert.equal(previaDaFichaAberta.value, true);

  previaFixada.value = true;
  assert.equal(previaFixada.value, true);

  previaDaFichaAberta.value = false;
  previaFixada.value = false;
});

test('previa-ficha: identificacao de peca com ficha vs peca sem ficha', () => {
  const refFicha = criarRef('ficha', 'ficha', 'personagem-123');
  const comFicha = novaPeca([2, 2], 'Heroi', { refs: [refFicha] });
  const semFicha = novaPeca([4, 4], 'Inimigo Comum', { refs: [] });

  assert.deepEqual(refDaFicha(comFicha.refs), refFicha);
  assert.equal(refDaFicha(semFicha.refs), null);
});

test('previa-ficha: formatacao de URL para o modo compacto do Dossie', () => {
  assert.equal(urlDaPreviaDaFicha('sheet-1'), '../Dossie/?ficha=sheet-1&compacto=1');
  assert.equal(urlDaPreviaDaFicha('fichas/herói & monstro'), '../Dossie/?ficha=fichas%2Fher%C3%B3i%20%26%20monstro&compacto=1');
});

test('previa-ficha: geometria de posicionamento da gaveta em relacao ao token', () => {
  const limites = { left: 0, right: 1200, top: 0, bottom: 800 };

  // Caso 1: Token no centro da tela -> cabe a direita
  const posCentro = calcularPosicaoDaPrevia(
    { cx0: 400, cy0: 300, cx1: 440, cy1: 340 },
    limites
  );
  assert.equal(posCentro.x, 454, 'deve ficar a direita do token');
  assert.equal(posCentro.y, 70, 'deve ficar centralizado verticalmente');

  // Caso 2: Token proximo da borda direita -> posiciona a esquerda do token
  const posBordaDireita = calcularPosicaoDaPrevia(
    { cx0: 1100, cy0: 300, cx1: 1140, cy1: 340 },
    limites
  );
  assert.equal(posBordaDireita.x, 1100 - 380 - 14, 'deve transbordar para a esquerda do token');
});


test('calcularPosicaoDaPrevia respeita tamanhos customizados e limitarTamanhoDaPrevia aplica mínimo e máximo', async () => {
  const { limitarTamanhoDaPrevia } = await import('../../src/app/previa-ficha.ts');
  const area = { left: 0, right: 1200, top: 50, bottom: 800 };
  const pos = calcularPosicaoDaPrevia({ cx0: 100, cy0: 300, cx1: 140, cy1: 340 }, area, { largura: 600, altura: 700 });
  assert.equal(pos.x, 154);
  assert.equal(pos.y, 60, 'clampa no topo quando a altura é grande');
  const colado = calcularPosicaoDaPrevia({ cx0: 1000, cy0: 300, cx1: 1040, cy1: 340 }, area, { largura: 600, altura: 400 });
  assert.equal(colado.x, 386, 'vai para a esquerda do token');

  const janela = { largura: 1000, altura: 700 };
  assert.deepEqual(limitarTamanhoDaPrevia({ largura: 100, altura: 100 }, janela), { largura: 320, altura: 320 });
  assert.deepEqual(limitarTamanhoDaPrevia({ largura: 5000, altura: 5000 }, janela), { largura: 900, altura: 628 });
  assert.deepEqual(limitarTamanhoDaPrevia({ largura: Number.NaN, altura: 400 }, janela), { largura: 440, altura: 400 });
});
