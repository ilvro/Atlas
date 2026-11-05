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
