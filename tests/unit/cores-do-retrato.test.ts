import { test } from 'node:test';
import assert from 'node:assert/strict';
import { coresDominantes, sugerirCoresDoSprite, type Pixels } from '../../src/procedural/cores-do-retrato.ts';
import { CORES_PADRAO } from '../../src/domain/sprite.ts';

/** Uma imagem de 4 blocos de cor (2 × 2) com o tamanho do bloco dado. */
function blocos(cores: string[], lado = 20): Pixels {
  const w = lado * 2, data = new Uint8ClampedArray(w * w * 4);
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const p = parseInt(cores[(y < lado ? 0 : 2) + (x < lado ? 0 : 1)]!.slice(1), 16), o = (y * w + x) * 4;
    data[o] = (p >> 16) & 255; data[o + 1] = (p >> 8) & 255; data[o + 2] = p & 255; data[o + 3] = 255;
  }
  return { width: w, height: w, data };
}

test('coresDominantes: uma imagem de 4 blocos devolve as 4 cores', () => {
  const entrada = ['#c03030', '#30a040', '#3050c0', '#d0b030'], saida = coresDominantes(blocos(entrada), 5);
  assert.deepEqual([...saida].sort(), [...entrada].sort());
});

test('coresDominantes: ignora o transparente, o quase preto e o quase branco; sem nada útil devolve vazio', () => {
  const img = blocos(['#c03030', '#020202', '#fafafa', '#c03030']);
  assert.deepEqual(coresDominantes(img, 5), ['#c03030']);
  const transp = blocos(['#c03030', '#c03030', '#c03030', '#c03030']); for (let i = 3; i < transp.data.length; i += 4) (transp.data as Uint8ClampedArray)[i] = 0;
  assert.deepEqual(coresDominantes(transp, 5), []);
  assert.deepEqual(coresDominantes(blocos(['#c03030', '#30a040', '#3050c0', '#d0b030']), 5), coresDominantes(blocos(['#c03030', '#30a040', '#3050c0', '#d0b030']), 5), 'determinístico');
});

test('sugerirCoresDoSprite: a pele vai para o campo de pele, o cabelo é o mais escuro, e roupa e detalhe são os mais saturados', () => {
  const s = sugerirCoresDoSprite(['#e8c4a0', '#2a1c14', '#1f4fd0', '#d0a020', '#808080']);
  assert.equal(s.pele, '#e8c4a0'); assert.equal(s.cabelo, '#2a1c14'); assert.equal(s.roupa, '#1f4fd0'); assert.equal(s.detalhe, '#d0a020');
});

test('sugerirCoresDoSprite: com poucas cores, o resto fica no padrão', () => {
  assert.deepEqual(sugerirCoresDoSprite([]), CORES_PADRAO);
  const s = sugerirCoresDoSprite(['#d9a77e']); assert.equal(s.pele, '#d9a77e'); assert.equal(s.roupa, CORES_PADRAO.roupa);
});
