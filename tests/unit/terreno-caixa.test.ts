import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leitoDaAgua, texturaDeAgua } from '../../src/procedural/agua.ts';
import { sombrearMacico } from '../../src/procedural/macico.ts';
import { PADROES_DE_COBERTURA } from '../../src/procedural/coberturas.ts';
import { materialDe, padraoDependeDaArea, type Padrao } from '../../src/procedural/materiais.ts';

test('padraoDependeDaArea classifica corretamente padrões dependentes de A vs invariantes no mundo', () => {
  const dependentes: Padrao[] = [
    'tabuas', 'xadrez', 'laje', 'damasco', 'listras', 'veio', 'losango',
    'hexagono', 'floral', 'lambri', 'vidro', 'pregas', 'pintura',
    'grama', 'terra', 'lama', 'areia', 'pedra',
  ];
  const invariantes: Padrao[] = [
    'liso', 'trama', 'couro', 'metal', 'persa', 'espinha', 'marmore', 'marchetaria',
    'gelo', 'dunas', 'rachado', 'cascalho', 'paralelepipedo', 'lajegrama', 'sulcos',
    'molhada', 'palha-chao', 'lajes-rusticas', 'lajes-grandes', 'chapa-xadrez',
    'grade-metal', 'toras', 'manchado', 'painel', 'acolchoado', 'pisada', 'placas', 'neve',
    ...PADROES_DE_COBERTURA,
  ];
  for (const p of dependentes) assert.equal(padraoDependeDaArea(p), true, p);
  for (const p of invariantes) assert.equal(padraoDependeDaArea(p), false, p);
});

test('leitoDaAgua e texturaDeAgua em sub-caixa preservam coordenadas do mundo', () => {
  const W = 128, H = 96, res = 16;
  const x0 = 24, y0 = 16, cw = 80, ch = 64;
  const fullBin = new Uint8Array(W * H);
  for (let y = 32; y < 64; y++) for (let x = 40; x < 88; x++) fullBin[y * W + x] = 1;
  const fullCob = fullBin.map(v => v * 255);

  const subBin = new Uint8Array(cw * ch);
  const subCob = new Uint8Array(cw * ch);
  for (let ly = 0; ly < ch; ly++) for (let lx = 0; lx < cw; lx++) {
    const k = (y0 + ly) * W + (x0 + lx);
    subBin[ly * cw + lx] = fullBin[k]!;
    subCob[ly * cw + lx] = fullCob[k]!;
  }

  for (const pixel of [false, true]) {
    const mat = materialDe('agua.mar');
    const full = leitoDaAgua({ binaria: fullBin, cobertura: pixel ? null : fullCob, largura: W, altura: H, res, seed: 13, material: mat, pixel });
    const sub = leitoDaAgua({ binaria: subBin, cobertura: pixel ? null : subCob, largura: cw, altura: ch, res, seed: 13, material: mat, pixel, origemPx: [x0, y0] });

    for (let ly = 0; ly < ch; ly++) for (let lx = 0; lx < cw; lx++) {
      const si = (ly * cw + lx) * 4, fi = ((y0 + ly) * W + (x0 + lx)) * 4;
      for (let c = 0; c < 4; c++) {
        assert.equal(sub.leito[si + c], full.leito[fi + c], `leito pixel=${pixel} (${lx},${ly}) ch=${c}`);
        assert.equal(sub.margem[si + c], full.margem[fi + c], `margem pixel=${pixel} (${lx},${ly}) ch=${c}`);
      }
    }

    if (!pixel && typeof ImageData !== 'undefined') {
      const imgFull = texturaDeAgua([{ profundidade: full.profundidade, binaria: fullBin }], W, H, res, W / res, H / res)!;
      const imgSub = texturaDeAgua([{ profundidade: sub.profundidade, binaria: subBin, x0, y0, cw, ch }], W, H, res, W / res, H / res)!;
      assert.deepEqual(imgSub.data, imgFull.data);
    }
  }
});

test('sombrearMacico em sub-caixa com origemPx preserva resultado no Ilustrado e no Pixel', () => {
  const W = 128, H = 96, res = 16;
  const x0 = 16, y0 = 12, cw = 96, ch = 72;
  const fullDentro = new Uint8Array(W * H);
  for (let y = 28; y < 68; y++) for (let x = 32; x < 96; x++) fullDentro[y * W + x] = 1;
  const fullAlfa = fullDentro.map(v => v * 255);

  const subDentro = new Uint8Array(cw * ch);
  const subAlfa = new Uint8Array(cw * ch);
  for (let ly = 0; ly < ch; ly++) for (let lx = 0; lx < cw; lx++) {
    const k = (y0 + ly) * W + (x0 + lx);
    subDentro[ly * cw + lx] = fullDentro[k]!;
    subAlfa[ly * cw + lx] = fullAlfa[k]!;
  }

  for (const pixel of [false, true]) {
    const cores = materialDe('rocha.arenito');
    const full = sombrearMacico({ dentro: fullDentro, alfa: pixel ? null : fullAlfa, largura: W, altura: H, res, seed: 11, cores, pixel });
    const sub = sombrearMacico({ dentro: subDentro, alfa: pixel ? null : subAlfa, largura: cw, altura: ch, res, seed: 11, cores, pixel, origemPx: [x0, y0] });

    for (let ly = 0; ly < ch; ly++) for (let lx = 0; lx < cw; lx++) {
      const si = (ly * cw + lx) * 4, fi = ((y0 + ly) * W + (x0 + lx)) * 4;
      for (let c = 0; c < 4; c++) {
        assert.equal(sub.rgba[si + c], full.rgba[fi + c], `macico rgba pixel=${pixel} (${lx},${ly}) ch=${c}`);
        assert.equal(sub.sombra[si + c], full.sombra[fi + c], `macico sombra pixel=${pixel} (${lx},${ly}) ch=${c}`);
      }
    }
  }
});
