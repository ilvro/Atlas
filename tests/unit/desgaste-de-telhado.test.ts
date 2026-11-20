import assert from 'node:assert/strict';
import { test } from 'node:test';
import { amostrarTelhado, type DadosDoTelhado, type EntradaDoTelhado } from '../../src/procedural/assar-telhado.ts';

const GRADE = { size: 1, offset: [0, 0] as [number, number] };

function ret(x0: number, y0: number, w: number, h: number): [number, number][] {
  const out: [number, number][] = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push([x, y]);
  return out;
}

function mediaNaCaixa(
  d: DadosDoTelhado,
  wx0: number,
  wy0: number,
  wx1: number,
  wy1: number,
): { r: number; g: number; b: number; ao: number; brancos: number; escuros: number; n: number } {
  const px0 = Math.max(0, Math.floor((wx0 - d.origem[0]) * d.res));
  const py0 = Math.max(0, Math.floor((wy0 - d.origem[1]) * d.res));
  const px1 = Math.min(d.largura - 1, Math.ceil((wx1 - d.origem[0]) * d.res));
  const py1 = Math.min(d.altura - 1, Math.ceil((wy1 - d.origem[1]) * d.res));
  let r = 0, g = 0, b = 0, ao = 0, brancos = 0, escuros = 0, n = 0;
  for (let py = py0; py <= py1; py++) {
    for (let px = px0; px <= px1; px++) {
      const k = (py * d.largura + px) * 4;
      if (d.cor[k + 3]! === 0) continue;
      const cr = d.cor[k]!;
      const cg = d.cor[k + 1]!;
      const cb = d.cor[k + 2]!;
      r += cr;
      g += cg;
      b += cb;
      if (d.normal) ao += d.normal[k + 2]!;
      if (cr > 195 && cg > 205 && cb > 215) brancos++;
      if (cr < 35 && cg < 30 && cb < 28 && d.normal && d.normal[k + 2]! < 85) escuros++;
      n++;
    }
  }
  assert.ok(n > 0, 'caixa vazia na amostragem');
  return { r: r / n, g: g / n, b: b / n, ao: ao / n, brancos: brancos / n, escuros: escuros / n, n };
}

test('damage = 0 não remove nenhuma peça e bate com telhado sem wear.damage', () => {
  const semWear: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 5, 4),
        roof: { material: 'telha.barro', visible: true, shape: 'duas-aguas', wear: { moss: 0, dirt: 0, snow: 0 } },
        seed: 17,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };
  const danoZero: EntradaDoTelhado = {
    ...semWear,
    trechos: [
      {
        ...semWear.trechos[0]!,
        roof: { ...semWear.trechos[0]!.roof, wear: { moss: 0, dirt: 0, damage: 0, snow: 0 } },
      },
    ],
  };
  const comDano: EntradaDoTelhado = {
    ...semWear,
    trechos: [
      {
        ...semWear.trechos[0]!,
        roof: { ...semWear.trechos[0]!.roof, wear: { moss: 0, dirt: 0, damage: 0.75, snow: 0 } },
      },
    ],
  };

  const a = amostrarTelhado(semWear, 24, 'illustrated');
  const b = amostrarTelhado(danoZero, 24, 'illustrated');
  const c = amostrarTelhado(comDano, 24, 'illustrated');

  assert.deepEqual(a.cor, b.cor, 'damage = 0 deve ser byte a byte idêntico ao telhado sem dano');
  assert.deepEqual(a.normal, b.normal);

  const statZero = mediaNaCaixa(b, 0.4, 0.4, 4.6, 3.6);
  const statDano = mediaNaCaixa(c, 0.4, 0.4, 4.6, 3.6);
  assert.equal(statZero.escuros, 0, 'damage = 0 não pode abrir nenhum vão de peça faltando');
  assert.ok(statDano.escuros > 0.04, `damage = 0.75 deveria abrir vãos/peças faltando (veio ${(statDano.escuros * 100).toFixed(1)}%)`);
});

test('mesma semente gera saída idêntica byte a byte e semente diferente muda o dano', () => {
  const fazer = (seed: number): EntradaDoTelhado => ({
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 5, 4),
        roof: {
          material: 'telha.tabuas',
          visible: true,
          shape: 'duas-aguas',
          wear: { moss: 0.4, dirt: 0.55, damage: 0.65, snow: 0 },
        },
        seed,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  });

  const a1 = amostrarTelhado(fazer(42), 20, 'illustrated');
  const a2 = amostrarTelhado(fazer(42), 20, 'illustrated');
  const b = amostrarTelhado(fazer(99), 20, 'illustrated');

  assert.deepEqual(a1.cor, a2.cor);
  assert.deepEqual(a1.normal, a2.normal);

  let diff = 0;
  for (let i = 0; i < a1.cor.length; i += 4) {
    if (a1.cor[i + 3]! === 0) continue;
    diff += Math.abs(a1.cor[i]! - b.cor[i]!) + Math.abs(a1.cor[i + 1]! - b.cor[i + 1]!) + Math.abs(a1.cor[i + 2]! - b.cor[i + 2]!);
  }
  assert.ok(diff > 10000, `semente diferente deveria mudar o desgaste (diff=${diff})`);
});

test('neve num telhado plano cobre claramente mais que numa água íngreme (steep: true)', () => {
  const plano: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 4, 4),
        roof: { material: 'telha.barro', visible: true, shape: 'plano', wear: { moss: 0, dirt: 0, damage: 0, snow: 0.75 } },
        seed: 7,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };
  const ingreme: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 4, 4),
        roof: { material: 'telha.barro', visible: true, shape: 'duas-aguas', steep: true, wear: { moss: 0, dirt: 0, damage: 0, snow: 0.75 } },
        seed: 7,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };

  const dPlano = amostrarTelhado(plano, 24, 'illustrated');
  const dIngreme = amostrarTelhado(ingreme, 24, 'illustrated');

  const sPlano = mediaNaCaixa(dPlano, 0.5, 0.5, 3.5, 3.5);
  const sIngreme = mediaNaCaixa(dIngreme, 0.5, 0.5, 3.5, 3.5);

  assert.ok(
    sPlano.brancos > sIngreme.brancos + 0.45,
    `plano (${(sPlano.brancos * 100).toFixed(1)}%) deveria ter muito mais neve que íngreme (${(sIngreme.brancos * 100).toFixed(1)}%)`,
  );
  assert.ok(sPlano.b > sIngreme.b + 40, `albedo azulado da neve no plano (${sPlano.b.toFixed(1)}) deve superar o íngreme (${sIngreme.b.toFixed(1)})`);
});

test('anel em volta da chaminé reduz a neve perto da chaminé', () => {
  const entrada: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 6, 4),
        roof: {
          material: 'telha.barro',
          visible: true,
          shape: 'duas-aguas',
          details: ['chamine'],
          wear: { moss: 0, dirt: 0.1, damage: 0, snow: 'auto' },
        },
        seed: 13,
      },
    ],
    neve: 0.9,
    genero: 'investigacao',
  };

  // semDetalhes: true permite medir a água exatamente ao redor da chaminé sem a sombra/tijolo do detalhe interferir.
  const d = amostrarTelhado(entrada, 28, 'illustrated', { semDetalhes: true });
  const ch = d.detalhes.find(x => x.detalhe === 'chamine');
  assert.ok(ch, 'deveria existir uma chaminé resolvida');

  const perto = mediaNaCaixa(d, ch.x - 0.3, ch.y - 0.3, ch.x + 0.3, ch.y + 0.3);
  // Ponto na mesma água, afastado em X (mais de 1.8 m da chaminé).
  const outroX = ch.x > 3 ? 1.0 : 5.0;
  const longe = mediaNaCaixa(d, outroX - 0.35, ch.y - 0.3, outroX + 0.35, ch.y + 0.3);

  assert.ok(
    longe.brancos > perto.brancos + 0.5,
    `longe da chaminé (${(longe.brancos * 100).toFixed(1)}%) deve ter bem mais neve que perto (${(perto.brancos * 100).toFixed(1)}%)`,
  );
});

test('musgo é mais forte na água voltada para -y (norte) que na água voltada para +y (sul)', () => {
  const entrada: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 8, 4),
        roof: {
          material: 'telha.barro',
          visible: true,
          shape: 'duas-aguas',
          ridge: 'h',
          wear: { moss: 0.65, dirt: 0, damage: 0, snow: 0 },
        },
        seed: 21,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };

  const d = amostrarTelhado(entrada, 24, 'illustrated');
  // Água norte: y em [0.2, 1.8] (queda para -y); água sul: y em [2.2, 3.8] (queda para +y).
  const norte = mediaNaCaixa(d, 0.4, 0.25, 7.6, 1.75);
  const sul = mediaNaCaixa(d, 0.4, 2.25, 7.6, 3.75);

  // Na telha de barro (vermelha), musgo verde eleva (G - R) drasticamente.
  const verdeNorte = norte.g - norte.r;
  const verdeSul = sul.g - sul.r;
  assert.ok(
    verdeNorte > verdeSul + 10,
    `água norte (-y) deveria ser mais esverdeada (G-R=${verdeNorte.toFixed(1)}) que água sul (+y, G-R=${verdeSul.toFixed(1)})`,
  );
});

test('fuligem escurece a cobertura a sotavento (+x) da chaminé e modo pixel funciona sem normal', () => {
  const entrada: EntradaDoTelhado = {
    grade: GRADE,
    trechos: [
      {
        celulas: ret(0, 0, 6, 4),
        roof: {
          material: 'telha.tabuinhas',
          visible: true,
          shape: 'duas-aguas',
          details: ['chamine'],
          wear: { moss: 0, dirt: 0.15, damage: 0, snow: 0 },
        },
        seed: 31,
      },
    ],
    neve: 0,
    genero: 'investigacao',
  };

  const d = amostrarTelhado(entrada, 24, 'illustrated', { semDetalhes: true });
  const ch = d.detalhes.find(x => x.detalhe === 'chamine');
  assert.ok(ch);

  const sotavento = mediaNaCaixa(d, ch.x + 0.25, ch.y - 0.18, ch.x + 0.85, ch.y + 0.18);
  const barlavento = mediaNaCaixa(d, ch.x - 1.1, ch.y - 0.18, ch.x - 0.5, ch.y + 0.18);
  const lumSota = sotavento.r + sotavento.g + sotavento.b;
  const lumBarla = barlavento.r + barlavento.g + barlavento.b;
  assert.ok(
    lumSota < lumBarla - 25,
    `sotavento (+x) da chaminé (${lumSota.toFixed(1)}) deveria ficar mais escuro por fuligem que barlavento (${lumBarla.toFixed(1)})`,
  );

  const dPixel = amostrarTelhado(entrada, 16, 'pixel');
  assert.equal(dPixel.normal, null);
});
