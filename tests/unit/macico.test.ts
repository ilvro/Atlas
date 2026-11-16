import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sombrearMacico, SOMBRA_DE_CONTATO } from '../../src/procedural/macico.ts';
import { materialDe, materiaisDo } from '../../src/procedural/materiais.ts';
import { chaveDoTerreno } from '../../src/render/entradas.ts';

const W = 160, H = 120, RES = 16;
const disco = (): Uint8Array => { const m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - 80) / 55) ** 2 + ((y - 60) / 40) ** 2 < 1) m[y * W + x] = 1; return m; };
const rodar = (id: string, pixel: boolean) => { const dentro = disco(), mat = materialDe(id); return { dentro, ...sombrearMacico({ dentro, alfa: pixel ? null : dentro.map(v => v * 255), largura: W, altura: H, res: RES, seed: 3, cores: mat, pixel }) }; };

test('maciço: quatro materiais de uso macico, o nevado com topo', () => {
  assert.deepEqual(materiaisDo('macico').map(m => m.id).sort(), ['rocha.arenito', 'rocha.caverna', 'rocha.cinza', 'rocha.nevada']);
  assert.ok(materialDe('rocha.nevada').topo);
  assert.ok(!materialDe('rocha.caverna').topo);
});

test('maciço: rocha opaca por dentro, nada por fora, sombra de contato só fora e no máximo 0,4 m', () => {
  for (const pixel of [false, true]) {
    const { dentro, rgba, sombra } = rodar('rocha.caverna', pixel);
    let rocha = 0, sombras = 0, alcance = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (dentro[i]) { rocha++; assert.equal(rgba[i * 4 + 3], 255); assert.equal(sombra[i * 4 + 3], 0); } else {
        assert.equal(rgba[i * 4 + 3], 0);
        if (sombra[i * 4 + 3]) { sombras++; alcance = Math.max(alcance, Math.hypot((x - 80) / 55, (y - 60) / 40)); }
      }
    }
    assert.ok(rocha > 1000 && sombras > 100, `${pixel}: ${rocha} ${sombras}`);
    assert.ok(alcance < 1 + (SOMBRA_DE_CONTATO + 0.2) * RES / 40, `alcance ${alcance}`);
  }
});

test('maciço: sem o aro escuro das camadas comuns (a borda não é só a cor escura do material) e com volume', () => {
  const { dentro, rgba } = rodar('rocha.cinza', false), mat = materialDe('rocha.cinza'), escuro = parseInt(mat.escuro.slice(1), 16);
  const lum = (i: number) => rgba[i * 4]! * 0.3 + rgba[i * 4 + 1]! * 0.59 + rgba[i * 4 + 2]! * 0.11;
  let soma = 0, n = 0, min = 255, max = 0;
  for (let i = 0; i < dentro.length; i++) if (dentro[i]) { const l = lum(i); soma += l; n++; min = Math.min(min, l); max = Math.max(max, l); }
  assert.ok(max - min > 60, 'relevo: a luminância varia bastante');
  assert.ok(soma / n > ((escuro >> 16) * 0.3 + ((escuro >> 8) & 255) * 0.59 + (escuro & 255) * 0.11) + 25, 'média bem mais clara que a cor escura');
});

test('maciço: determinístico, no Pixel só poucas cores, e a chave do terreno muda com o material', () => {
  const a = rodar('rocha.nevada', true), b = rodar('rocha.nevada', true);
  assert.deepEqual(a.rgba, b.rgba);
  const cores = new Set<number>(); for (let i = 0; i < W * H; i++) if (a.dentro[i]) cores.add((a.rgba[i * 4]! << 16) | (a.rgba[i * 4 + 1]! << 8) | a.rgba[i * 4 + 2]!);
  assert.ok(cores.size <= 9, `${cores.size} cores`);
  const entrada = (material: string) => ({ largura: 4, altura: 4, resolucao: 0.5, base: 'vazio', camadas: [{ material, celulas: [[0, 0, 4]] as [number, number, number][] }] });
  assert.notEqual(chaveDoTerreno(entrada('rocha.cinza'), 24), chaveDoTerreno(entrada('rocha.arenito'), 24));
});

test('maciço 60×40 m lê como serra com trechos longos no miolo (média ≥ 3 m)', () => {
  const res = 16, W60 = 960, H40 = 640;
  const dentro = new Uint8Array(W60 * H40);
  for (let y = 16; y < 624; y++) for (let x = 16; x < 944; x++) dentro[y * W60 + x] = 1;
  const mat = materialDe('rocha.cinza');
  const a = sombrearMacico({ dentro, alfa: null, largura: W60, altura: H40, res, seed: 11, cores: mat, pixel: true });
  const b = sombrearMacico({ dentro, alfa: null, largura: W60, altura: H40, res, seed: 11, cores: mat, pixel: true });
  assert.deepEqual(a.rgba, b.rgba);

  const x0 = 208, x1 = W60 - 208, compM = (x1 - x0) / res;
  let tot = 0, linhas = 0;
  for (const y of [220, 260, 320, 380, 420]) {
    let trans = 0, prev = -1;
    for (let x = x0; x < x1; x++) {
      const i = (y * W60 + x) * 4;
      const cor = (a.rgba[i]! << 16) | (a.rgba[i + 1]! << 8) | a.rgba[i + 2]!;
      if (prev !== -1 && cor !== prev) trans++;
      prev = cor;
    }
    tot += trans; linhas++;
  }
  const media = compM / (tot / linhas + 1);
  assert.ok(media >= 3, `média de trechos no miolo (${media.toFixed(2)} m) deve ser ≥ 3 m`);
});

test('maciço pequeno 6×6 m mantém referência anterior dentro de limiar mínimo', () => {
  const res = 16, w = 96, h = 96, dentro = new Uint8Array(w * h);
  for (let y = 16; y < 80; y++) for (let x = 16; x < 80; x++) dentro[y * w + x] = 1;
  const { rgba } = sombrearMacico({
    dentro,
    alfa: dentro.map(v => v * 255),
    largura: w,
    altura: h,
    res,
    seed: 11,
    cores: materialDe('rocha.cinza'),
    pixel: false,
  });
  const ref: [number, number, number, number, number, number][] = [
    [20, 20, 87, 91, 96, 255], [32, 20, 105, 109, 114, 255], [48, 20, 105, 109, 114, 255], [64, 20, 54, 57, 62, 255], [72, 20, 95, 99, 104, 255],
    [20, 32, 105, 109, 114, 255], [32, 32, 141, 146, 151, 255], [48, 32, 144, 149, 154, 255], [64, 32, 93, 97, 103, 255], [72, 32, 27, 30, 34, 255],
    [20, 48, 100, 104, 109, 255], [32, 48, 141, 146, 151, 255], [48, 48, 128, 133, 138, 255], [64, 48, 29, 32, 36, 255], [72, 48, 17, 20, 24, 255],
    [20, 64, 78, 82, 87, 255], [32, 64, 47, 50, 55, 255], [48, 64, 32, 35, 40, 255], [64, 64, 22, 25, 29, 255], [72, 64, 18, 21, 25, 255],
    [20, 72, 56, 60, 65, 255], [32, 72, 67, 71, 76, 255], [48, 72, 52, 56, 61, 255], [64, 72, 71, 75, 80, 255], [72, 72, 77, 81, 86, 255],
  ];
  let soma = 0;
  for (const [x, y, r, g, b, a] of ref) {
    const i = (y * w + x) * 4;
    soma += Math.abs(rgba[i]! - r) + Math.abs(rgba[i + 1]! - g) + Math.abs(rgba[i + 2]! - b) + Math.abs(rgba[i + 3]! - a);
  }
  const mediaDiff = soma / (ref.length * 4);
  assert.ok(mediaDiff < 2, `diferença média (${mediaDiff.toFixed(2)}) no maciço 6×6 m deve ficar abaixo de 2`);
});
