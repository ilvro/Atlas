import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALTURA_MAXIMA, desenharAlturaDasPartes, parteEscreveAltura } from '../../src/procedural/altura.ts';
import type { Contexto } from '../../src/procedural/canvas.ts';
import { elipse, poli, ret } from '../../src/procedural/descricao.ts';

interface GradienteFalso {
  addColorStop(offset: number, cor: string): void;
  _cor(x: number, y: number): [number, number, number];
}

/** Canvas 2D mínimo em memória para verificar posições, valores de cinza, alfa e domo radial sem DOM. */
function criarCanvasDeTeste(largura: number, altura: number) {
  const pixels = new Uint8ClampedArray(largura * altura * 4);
  let tracos = 0;
  // Matriz afim [a, b, c, d, e, f] (x' = a*x + c*y + e, y' = b*x + d*y + f).
  let ctm: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
  const pilha: { ctm: [number, number, number, number, number, number]; globalAlpha: number }[] = [];
  let formaAtual: ((px: number, py: number) => boolean) | null = null;

  const mult = (m: [number, number, number, number, number, number]): [number, number, number, number, number, number] => [
    ctm[0] * m[0] + ctm[2] * m[1],
    ctm[1] * m[0] + ctm[3] * m[1],
    ctm[0] * m[2] + ctm[2] * m[3],
    ctm[1] * m[2] + ctm[3] * m[3],
    ctm[0] * m[4] + ctm[2] * m[5] + ctm[4],
    ctm[1] * m[4] + ctm[3] * m[5] + ctm[5],
  ];
  const inv = (m: [number, number, number, number, number, number]) => {
    const det = m[0] * m[3] - m[1] * m[2];
    return (px: number, py: number): [number, number] => [
      (m[3] * (px - m[4]) - m[2] * (py - m[5])) / det,
      (-m[1] * (px - m[4]) + m[0] * (py - m[5])) / det,
    ];
  };
  const parseRgb = (s: string): [number, number, number] => {
    const m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s);
    if (!m) throw new Error(`Cor inesperada: ${s}`);
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  };

  const ctx = {
    globalAlpha: 1,
    fillStyle: '#000000' as string | GradienteFalso,
    save() { pilha.push({ ctm: [...ctm], globalAlpha: ctx.globalAlpha }); },
    restore() { const s = pilha.pop(); if (s) { ctm = s.ctm; ctx.globalAlpha = s.globalAlpha; } },
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { ctm = [a, b, c, d, e, f]; },
    translate(tx: number, ty: number) { ctm = mult([1, 0, 0, 1, tx, ty]); },
    scale(sx: number, sy: number) { ctm = mult([sx, 0, 0, sy, 0, 0]); },
    beginPath() { formaAtual = null; },
    rect(x: number, y: number, w: number, h: number) {
      const toLocal = inv(ctm);
      formaAtual = (px, py) => { const [lx, ly] = toLocal(px, py); return lx >= x && lx <= x + w && ly >= y && ly <= y + h; };
    },
    roundRect(x: number, y: number, w: number, h: number, _r: number) {
      const toLocal = inv(ctm);
      formaAtual = (px, py) => { const [lx, ly] = toLocal(px, py); return lx >= x && lx <= x + w && ly >= y && ly <= y + h; };
    },
    ellipse(cx: number, cy: number, rx: number, ry: number) {
      const toLocal = inv(ctm);
      formaAtual = (px, py) => { const [lx, ly] = toLocal(px, py); return ((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 <= 1; };
    },
    moveTo() {},
    lineTo() {},
    closePath() {},
    createRadialGradient(x0: number, y0: number, _r0: number, _x1: number, _y1: number, r1: number): GradienteFalso {
      const stops: { offset: number; rgb: [number, number, number] }[] = [];
      return {
        addColorStop(offset: number, cor: string) { stops.push({ offset, rgb: parseRgb(cor) }); stops.sort((a, b) => a.offset - b.offset); },
        _cor(px: number, py: number) {
          const [lx, ly] = inv(ctm)(px, py);
          const t = Math.min(1, Math.max(0, Math.hypot(lx - x0, ly - y0) / r1));
          const a = stops[0]!, b = stops[stops.length - 1]!;
          const f = b.offset === a.offset ? 0 : (t - a.offset) / (b.offset - a.offset);
          return [
            Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f),
            Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f),
            Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f),
          ];
        },
      };
    },
    fill() {
      if (!formaAtual) return;
      const estilo = ctx.fillStyle;
      const a = Math.round(ctx.globalAlpha * 255);
      for (let py = 0; py < altura; py++) {
        for (let px = 0; px < largura; px++) {
          if (!formaAtual(px + 0.5, py + 0.5)) continue;
          const [r, g, b] = typeof estilo === 'string' ? parseRgb(estilo) : estilo._cor(px + 0.5, py + 0.5);
          const idx = (py * largura + px) * 4;
          pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = a;
        }
      }
    },
    stroke() { tracos++; },
  };

  const pixel = (x: number, y: number): [number, number, number, number] => {
    const idx = (y * largura + x) * 4;
    return [pixels[idx]!, pixels[idx + 1]!, pixels[idx + 2]!, pixels[idx + 3]!];
  };
  return { ctx: ctx as unknown as Contexto, pixel, get tracos() { return tracos; } };
}

test('desenharAlturaDasPartes: duas partes (z 0,4 e 1,2) produzem alturas 0,1 e 0,3 nas posições certas e brilho não escreve', () => {
  const res = 20; // 1 m = 20 px; tela de 4 m x 2 m (80 x 40 px), origem em (-2, -1)
  const tela = criarCanvasDeTeste(80, 40);
  tela.ctx.setTransform(res, 0, 0, res, 40, 20);

  const partes = [
    ret(0.5, 0, 0.8, 0.8, 'ferro', 1.2),
    ret(-0.8, 0, 0.8, 0.8, 'madeira.media', 0.4),
    elipse(0, 0, 0.5, 0.5, '#ffaa00', 2.0, { brilho: true }),
  ];
  desenharAlturaDasPartes(tela.ctx, partes, { res });

  // Parte em x = -0.8 m -> px = 40 - 16 = 24, py = 20; z = 0.4 -> v = 0.1
  const p1 = tela.pixel(24, 20);
  assert.equal(p1[3], 255);
  assert.ok(Math.abs(p1[0] / 255 - 0.1) < 0.01, `esperava ~0.1, veio ${p1[0] / 255}`);
  assert.equal(p1[0], p1[1]);
  assert.equal(p1[1], p1[2]);

  // Parte em x = +0.5 m -> px = 40 + 10 = 50, py = 20; z = 1.2 -> v = 0.3
  const p2 = tela.pixel(50, 20);
  assert.equal(p2[3], 255);
  assert.ok(Math.abs(p2[0] / 255 - 0.3) < 0.01, `esperava ~0.3, veio ${p2[0] / 255}`);

  // Centro (0, 0) -> px = 40, py = 20: coberto apenas pela parte `brilho`, deve ficar transparente (altura 0)
  const centro = tela.pixel(40, 20);
  assert.deepEqual(centro, [0, 0, 0, 0]);
  assert.equal(tela.tracos, 0, 'tela de altura nunca desenha traço');
});

test('desenharAlturaDasPartes: ordena por z crescente, aplica teto em ALTURA_MAXIMA e ignora suave, desfoque, alfa < 0.5 e semSombra', () => {
  const res = 20;
  const tela = criarCanvasDeTeste(60, 60);
  tela.ctx.setTransform(res, 0, 0, res, 30, 30);

  const partes = [
    ret(0, 0, 1.0, 1.0, 'madeira.escura', 6.0), // z > ALTURA_MAXIMA -> clampa em 1.0 (listed first)
    ret(0, 0, 1.0, 1.0, 'madeira.clara', 0.8),  // z menor, deve ficar por baixo
    ret(0, 0, 1.0, 1.0, 'folha', 3.0, { suave: true }),
    ret(0, 0, 1.0, 1.0, 'nevoa', 3.0, { desfoque: 0.2 }),
    ret(0, 0, 1.0, 1.0, 'vidro', 3.0, { alfa: 0.49 }),
    ret(0, 0, 1.0, 1.0, 'tapete.persa', 3.0, { semSombra: true }),
    ret(0.8, 0.8, 0.5, 0.5, 'madeira.media', 2.0, { alfa: 0.5 }), // alfa >= 0.5 escreve
  ];
  desenharAlturaDasPartes(tela.ctx, partes, { res });

  assert.equal(ALTURA_MAXIMA, 4);
  assert.deepEqual(tela.pixel(30, 30), [255, 255, 255, 255]);

  const pMeioAlfa = tela.pixel(46, 46);
  assert.equal(pMeioAlfa[3], 255);
  assert.ok(Math.abs(pMeioAlfa[0] / 255 - 0.5) < 0.01);

  assert.equal(parteEscreveAltura(poli([0, 0, 1, 0, 0, 1], 'pedra', 1)), true);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { suave: true })), false);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { desfoque: 0.1 })), false);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { brilho: true })), false);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { alfa: 0.49 })), false);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { alfa: 0.5 })), true);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { semSombra: true })), false);
});

test('desenharAlturaDasPartes: parte com raio recebe domo (v no centro, ~15% menor na borda)', () => {
  const res = 100;
  const tela = criarCanvasDeTeste(120, 120);
  tela.ctx.setTransform(res, 0, 0, res, 60, 60);

  // z = 2.0 -> v = 0.5 (128 no centro, ~108 na borda)
  desenharAlturaDasPartes(tela.ctx, [ret(0, 0, 1.0, 1.0, 'madeira.media', 2.0, { raio: 0.15 })], { res });

  const centro = tela.pixel(60, 60);
  const borda = tela.pixel(109, 60);
  assert.equal(centro[3], 255);
  assert.equal(borda[3], 255);
  assert.ok(Math.abs(centro[0] / 255 - 0.5) < 0.015, `centro ${centro[0] / 255}`);
  assert.ok(Math.abs(borda[0] / 255 - 0.5 * 0.85) < 0.02, `borda ${borda[0] / 255}`);
  assert.ok(centro[0] > borda[0], 'centro deve ser mais alto que a borda');
});
