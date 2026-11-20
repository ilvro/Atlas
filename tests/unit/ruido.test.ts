import test from 'node:test';
import assert from 'node:assert/strict';
import { campoDeRuido, fbm, valueNoise2D } from '../../src/procedural/ruido.ts';

test('campoDeRuido difere do fbm direto em menos de 0,01 para baixas frequências', () => {
  const casos = [
    { seed: 11, freq: 0.14, oitavas: 2, ox: 30, oy: 70 },
    { seed: 17, freq: 0.25, oitavas: 3, ox: 8, oy: 0 },
    { seed: 23, freq: 0.35, oitavas: 3, ox: 0, oy: 0 },
    { seed: 31, freq: 0.5, oitavas: 3, ox: 90, oy: 0 },
    { seed: 41, freq: 0.6, oitavas: 2, ox: 12, oy: 30 },
    { seed: 53, freq: 0.9, oitavas: 2, ox: 33, oy: 0 },
    { seed: 67, freq: 0.25, oitavas: 4, ox: 5, oy: 15 },
  ];
  const area = { x: -3.7, y: 2.3, w: 8.5, h: 6.4 };

  for (const c of casos) {
    const rn = valueNoise2D(c.seed);
    const campo = campoDeRuido(rn, area, c.freq, c.oitavas, undefined, c.ox, c.oy);
    let maxErro = 0;
    const passos = 80;
    for (let j = 0; j <= passos; j++) {
      const y = area.y + (j / passos) * area.h;
      for (let i = 0; i <= passos; i++) {
        const x = area.x + (i / passos) * area.w;
        const esperado = fbm(rn, x * c.freq + c.ox, y * c.freq + c.oy, c.oitavas);
        const obtido = campo(x, y);
        const erro = Math.abs(obtido - esperado);
        if (erro > maxErro) maxErro = erro;
      }
    }
    assert.ok(
      maxErro < 0.01,
      `freq=${c.freq} oitavas=${c.oitavas}: erro máximo ${maxErro.toFixed(5)} >= 0.01`,
    );
  }
});

test('campoDeRuido suporta frequência anisotrópica com erro < 0,01', () => {
  const rn = valueNoise2D(99);
  const area = { x: 0, y: 0, w: 6, h: 6 };
  const campo = campoDeRuido(rn, area, 0.8, 2, undefined, 0, 5, 0.2);
  let maxErro = 0;
  for (let j = 0; j <= 60; j++) {
    const y = (j / 60) * area.h;
    for (let i = 0; i <= 60; i++) {
      const x = (i / 60) * area.w;
      const erro = Math.abs(campo(x, y) - fbm(rn, x * 0.8, y * 0.2 + 5, 2));
      if (erro > maxErro) maxErro = erro;
    }
  }
  assert.ok(maxErro < 0.01, `erro anisotrópico ${maxErro.toFixed(5)} >= 0.01`);
});

test('campoDeRuido é idêntico em áreas recortadas (invariante a ladrilhos)', () => {
  const rn = valueNoise2D(42);
  const inteiro = campoDeRuido(rn, { x: 0, y: 0, w: 32, h: 32 }, 0.5, 3, undefined, 30, 0);
  const ladrilho = campoDeRuido(rn, { x: 16, y: 16, w: 16, h: 16 }, 0.5, 3, undefined, 30, 0);
  for (let j = 0; j <= 32; j++) {
    const y = 16 + j * 0.5;
    for (let i = 0; i <= 32; i++) {
      const x = 16 + i * 0.5;
      assert.equal(ladrilho(x, y), inteiro(x, y));
    }
  }
});
