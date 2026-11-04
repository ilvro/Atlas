import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACESSORIOS, CABELOS, CAMPOS_DE_COR, CORES_PADRAO, CORPOS, ROUPAS, corDoSprite, spriteAleatorio } from '../../src/domain/sprite.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { novaPeca } from '../../src/domain/fabrica.ts';

test('spriteAleatorio: todo id existe nos catálogos, as cores são hex, e a mesma semente dá o mesmo sprite', () => {
  const ids = (l: readonly { id: string }[]) => new Set(l.map(x => x.id));
  for (let seed = 1; seed <= 200; seed++) {
    const s = spriteAleatorio(seed);
    assert.ok(ids(CORPOS).has(s.body) && ids(CABELOS).has(s.hair) && ids(ROUPAS).has(s.outfit), `seed ${seed}`);
    for (const a of s.accessories) assert.ok(ids(ACESSORIOS).has(a), a);
    assert.equal(new Set(s.accessories).size, s.accessories.length);
    for (const [campo] of CAMPOS_DE_COR) assert.match(s.colors[campo]!, /^#[0-9a-f]{6}$/i);
  }
  assert.deepEqual(spriteAleatorio(42), spriteAleatorio(42));
  assert.notDeepEqual(spriteAleatorio(1), spriteAleatorio(2));
});

test('spriteAleatorio: o sprite passa na validação do mapa quando posto numa peça', () => {
  const m = criarMapa({ id: 'm', agora: 1 }), t = novaPeca([3, 3], 'Ana', { sprite: spriteAleatorio(7) });
  m.tokens[t.id] = t; validarMapa(m);
});

test('corDoSprite: cai na cor padrão se falta ou é inválida', () => {
  const s = spriteAleatorio(3);
  assert.equal(corDoSprite({ colors: {} }, 'pele'), CORES_PADRAO.pele);
  assert.equal(corDoSprite({ colors: { pele: 'vermelho' } }, 'pele'), CORES_PADRAO.pele);
  assert.equal(corDoSprite(s, 'roupa'), s.colors.roupa);
});
