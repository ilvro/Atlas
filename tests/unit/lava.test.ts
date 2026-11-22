import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLARAO_DA_LAVA, leitoDaAgua } from '../../src/procedural/agua.ts';
import { materialDe } from '../../src/procedural/materiais.ts';

// Um lago quadrado de 4 × 4 m no meio de 8 × 8 m, a 8 px/m.
const res = 8, W = 64, H = 64;
const binaria = new Uint8Array(W * H), cobertura = new Uint8Array(W * H);
for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) { binaria[y * W + x] = 1; cobertura[y * W + x] = 255; }
const entrada = (material: string) => ({ binaria, cobertura, largura: W, altura: H, res, seed: 3, material: materialDe(material), pixel: false });

test('a lava é opaca, emite dentro e aquece o chão em volta até o clarão', () => {
  const r = leitoDaAgua(entrada('agua.lava'));
  assert.ok(r.calor, 'a lava devolve o calor');
  const dentro = 32 * W + 32, perto = 32 * W + 14, longe = 32 * W + 2;
  assert.equal(r.leito[dentro * 4 + 3], 255);
  assert.ok(r.calor![dentro]! > 0);
  assert.ok(r.calor![perto]! > 0, 'o clarão passa da margem');
  assert.equal(r.calor![longe]!, 0, `nada além de ${CLARAO_DA_LAVA} m`);
  const fendas = Array.from({ length: W * H }, (_, i) => i).filter(i => binaria[i] && r.calor![i]! > 0.3).length;
  assert.ok(fendas > 0 && fendas < 32 * 32, 'há fendas acesas, mas nem toda a lava está acesa');
});

test('água comum não emite', () => {
  assert.equal(leitoDaAgua(entrada('agua.rio')).calor, undefined);
});
