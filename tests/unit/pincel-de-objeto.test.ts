import { test } from 'node:test';
import assert from 'node:assert/strict';
import { camposDoPincel, pincelDoObjeto, PROPRIEDADES_PADRAO, type PincelDeObjeto } from '../../src/domain/pincel-de-objeto.ts';
import { PINCEL_PADRAO } from '../../src/render/pincel.ts';
import { novoObjeto } from '../../src/domain/fabrica.ts';

const base = (extra: Partial<PincelDeObjeto> = {}): PincelDeObjeto => ({ ...PINCEL_PADRAO.objeto, ...extra });
const nunca = () => { throw new Error('não devia sortear'); };

test('o pincel padrão só devolve rotation 0 e scale 1, sem sortear', () => {
  assert.deepEqual(camposDoPincel(base(), nunca), { rotation: 0, scale: 1 });
  assert.equal(PINCEL_PADRAO.objeto.escala, PROPRIEDADES_PADRAO.escala);
});
test('as propriedades fora do padrão entram, e só elas', () => {
  const c = camposDoPincel(base({ escala: 1.5, rotacao: 1, espelhado: true, opacidade: 0.5, camada: 3, sombra: false, bloqueia: false }), nunca);
  assert.deepEqual(c, { rotation: 1, scale: 1.5, flip: true, opacity: 0.5, layer: 3, castsShadow: false, blocks: { move: false, sight: false } });
});
test('rotação aleatória fica em [0, 2π)', () => {
  for (const r of [0, 0.25, 0.999999]) { const { rotation } = camposDoPincel(base({ rotacaoAleatoria: true }), () => r); assert.ok(rotation >= 0 && rotation < Math.PI * 2); }
});
test('a escala aleatória respeita a faixa', () => {
  assert.equal(camposDoPincel(base({ escala: 2, escalaAleatoria: 0.25 }), () => 0).scale, 1.5);
  assert.equal(camposDoPincel(base({ escala: 2, escalaAleatoria: 0.25 }), () => 1).scale, 2.5);
  assert.equal(camposDoPincel(base({ escala: 2, escalaAleatoria: 0.25 }), () => 0.5).scale, 2);
  assert.equal(camposDoPincel(base({ escalaAleatoria: 9 }), () => 1).scale, 1.5, 'a variação passa de 0,5 e é cortada');
});
test('o espelho aleatório inverte o espelho do pincel', () => {
  assert.equal(camposDoPincel(base({ espelhoAleatorio: true }), () => 0.1).flip, true);
  assert.equal(camposDoPincel(base({ espelhoAleatorio: true }), () => 0.9).flip, undefined);
  assert.equal(camposDoPincel(base({ espelhoAleatorio: true, espelhado: true }), () => 0.1).flip, undefined);
});
test('um rand fixo dá resultado determinístico', () => {
  const p = base({ rotacaoAleatoria: true, escalaAleatoria: 0.3, espelhoAleatorio: true });
  const sequencia = () => { const v = [0.2, 0.7, 0.4]; let i = 0; return () => v[i++ % 3]!; };
  assert.deepEqual(camposDoPincel(p, sequencia()), camposDoPincel(p, sequencia()));
});
test('pincelDoObjeto copia o jeito do objeto e mantém a colocação', () => {
  const o = novoObjeto([1, 1], { scale: 2, rotation: 0.5, flip: true, opacity: 0.6, layer: 2, castsShadow: false, blocks: { move: false, sight: false } });
  const p = pincelDoObjeto(o, base({ colocar: 'varios', area: 3 }), 'escrivaninha', null);
  assert.deepEqual([p.escala, p.rotacao, p.espelhado, p.opacidade, p.camada, p.sombra, p.bloqueia, p.colocar, p.area], [2, 0.5, true, 0.6, 2, false, false, 'varios', 3]);
});
import { patchDoObjeto, valoresDoObjeto } from '../../src/domain/pincel-de-objeto.ts';
test('patchDoObjeto traduz o painel e apaga o que volta ao padrão', () => {
  assert.deepEqual(patchDoObjeto({ escala: 2, opacidade: 0.5, espelhado: true, camada: 3, bloqueia: false }), { scale: 2, opacity: 0.5, flip: true, layer: 3, blocks: { move: false } });
  const volta = patchDoObjeto({ opacidade: 1, espelhado: false, camada: null });
  assert.deepEqual(Object.keys(volta).sort(), ['flip', 'layer', 'opacity']);
  assert.ok(Object.values(volta).every(v => v === undefined));
  assert.equal(patchDoObjeto({ escala: 999 }).scale, 50);
});
test('valoresDoObjeto lê os padrões de um objeto novo', () => {
  assert.deepEqual(valoresDoObjeto(novoObjeto([0, 0])), { escala: 1, rotacao: 0, camada: null, espelhado: false, opacidade: 1, sombra: true, bloqueia: true });
});
