import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contornoDoComodo, facesDoContorno, fatorDaFace } from '../../src/domain/geometria.ts';
import { profundidadeDaFace } from '../../src/procedural/assar.ts';

test('a face da parede do fundo é a mais alta, as laterais menores e a da frente quase some', () => {
  assert.equal(fatorDaFace([0, 1]), 1);
  assert.ok(Math.abs(fatorDaFace([1, 0]) - 0.45) < 1e-9);
  assert.ok(Math.abs(fatorDaFace([0, -1]) - 0.18) < 1e-9);
  assert.ok(profundidadeDaFace(2.6) > 1);
});

test('facesDoContorno com profundidade por lado: cada face tem a sua e as quinas fecham', () => {
  const laco = contornoDoComodo({ grid: { size: 1.5, offset: [0, 0] } } as never, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]])[0]!;
  const faces = facesDoContorno(laco, 1, n => fatorDaFace(n));
  const norte = faces.find(f => f.segmento.n[1] > 0.5)!, sul = faces.find(f => f.segmento.n[1] < -0.5)!;
  assert.equal(norte.prof, 1); assert.ok(Math.abs(sul.prof - 0.18) < 1e-9);
  // A borda interna da face norte fica 1 m para dentro.
  assert.ok(Math.abs(norte.quad[2][1] - norte.segmento.a[1] - 1) < 1e-6);
  // Faces vizinhas compartilham a quina interna.
  for (let i = 0; i < faces.length; i++) { const a = faces[i]!, b = faces[(i + 1) % faces.length]!; assert.deepEqual(a.quad[2], b.quad[3]); }
  // Sem a função, todas iguais (o comportamento antigo).
  assert.ok(facesDoContorno(laco, 0.5).every(f => f.prof === 0.5));
});

test('objetos de parede são ampliados na face, em volta do próprio centro, sem passar da sanca nem do rodapé', async () => {
  const { ampliarNaFace, AMPLIACAO_NA_FACE } = await import('../../src/procedural/assar.ts');
  const quadro = [{ forma: 'ret' as const, x: 2, y: 1.1, w: 1, h: 0.7, mat: '#000000', z: 1 }];
  const [a] = ampliarNaFace(quadro, 2, 2.6);
  assert.ok(Math.abs(a!.w! - AMPLIACAO_NA_FACE[0]) < 1e-9 && Math.abs(a!.h! - 0.7 * AMPLIACAO_NA_FACE[1]) < 1e-9);
  assert.equal(a!.x, 2); assert.equal(a!.y, 1.1);
  const alto = ampliarNaFace([{ ...quadro[0]!, y: 0.6, h: 0.8 }], 2, 2.6)[0]!;
  assert.ok(alto.y! - alto.h! / 2 >= 0.15 - 1e-9, 'não invade a sanca');
});
