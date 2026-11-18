import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALTURA_MAXIMA, PINTORES_DE_ALTURA, alturaPorLuminancia, desenharAlturaDasPartes, parteEscreveAltura, parteEscreveEmissao, pintarAlturaDoMaterial } from '../../src/procedural/altura.ts';
import { assarComodo, assarTerreno } from '../../src/procedural/assar.ts';
import type { Contexto } from '../../src/procedural/canvas.ts';
import { elipse, poli, ret } from '../../src/procedural/descricao.ts';
import { ILUSTRADO } from '../../src/procedural/estilos/ilustrado.ts';
import { PIXEL } from '../../src/procedural/estilos/pixel.ts';
import { materialDe, pintarMaterial } from '../../src/procedural/materiais.ts';

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
  const pilha: { ctm: [number, number, number, number, number, number]; globalAlpha: number; globalCompositeOperation: string }[] = [];
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
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000' as string | GradienteFalso,
    save() { pilha.push({ ctm: [...ctm], globalAlpha: ctx.globalAlpha, globalCompositeOperation: ctx.globalCompositeOperation }); },
    restore() { const s = pilha.pop(); if (s) { ctm = s.ctm; ctx.globalAlpha = s.globalAlpha; ctx.globalCompositeOperation = s.globalCompositeOperation; } },
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
      const lighter = ctx.globalCompositeOperation === 'lighter';
      for (let py = 0; py < altura; py++) {
        for (let px = 0; px < largura; px++) {
          if (!formaAtual(px + 0.5, py + 0.5)) continue;
          const [r, g, b] = typeof estilo === 'string' ? parseRgb(estilo) : estilo._cor(px + 0.5, py + 0.5);
          const idx = (py * largura + px) * 4;
          if (lighter) {
            pixels[idx] = Math.min(255, pixels[idx]! + r);
            pixels[idx + 1] = Math.min(255, pixels[idx + 1]! + g);
            pixels[idx + 2] = Math.min(255, pixels[idx + 2]! + b);
            pixels[idx + 3] = Math.min(255, pixels[idx + 3]! + a);
          } else {
            pixels[idx] = r; pixels[idx + 1] = g; pixels[idx + 2] = b; pixels[idx + 3] = a;
          }
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

test('desenharAlturaDasPartes: duas partes (z 0,4 e 1,2) produzem alturas em R (0,1 e 0,3) e brilho escreve emissão em G preservando R', () => {
  const res = 20; // 1 m = 20 px; tela de 4 m x 2 m (80 x 40 px), origem em (-2, -1)
  const tela = criarCanvasDeTeste(80, 40);
  tela.ctx.setTransform(res, 0, 0, res, 40, 20);

  const partes = [
    ret(0.5, 0, 0.8, 0.8, 'ferro', 1.2),
    ret(-0.8, 0, 0.8, 0.8, 'madeira.media', 0.4),
    elipse(0, 0, 0.5, 0.5, '#ffaa00', 2.0, { brilho: true }),
    elipse(0.5, 0, 0.4, 0.4, '#ffdd88', 2.2, { brilho: true, alfa: 0.4 }),
  ];
  desenharAlturaDasPartes(tela.ctx, partes, { res });

  // Parte em x = -0.8 m -> px = 40 - 16 = 24, py = 20; z = 0.4 -> R = 0.1, G = 0
  const p1 = tela.pixel(24, 20);
  assert.equal(p1[3], 255);
  assert.ok(Math.abs(p1[0] / 255 - 0.1) < 0.01, `esperava ~0.1, veio ${p1[0] / 255}`);
  assert.equal(p1[1], 0);
  assert.equal(p1[2], 0);

  // Parte em x = +0.5 m -> px = 40 + 10 = 50, py = 20; z = 1.2 + brilho alfa 0.4 -> R = 0.3 preservado, G = 0.4
  const p2 = tela.pixel(50, 20);
  assert.equal(p2[3], 255);
  assert.ok(Math.abs(p2[0] / 255 - 0.3) < 0.01, `esperava R ~0.3, veio ${p2[0] / 255}`);
  assert.ok(Math.abs(p2[1] / 255 - 0.4) < 0.01, `esperava G ~0.4, veio ${p2[1] / 255}`);
  assert.equal(p2[2], 0);

  // Centro (0, 0) -> px = 40, py = 20: coberto apenas pela parte `brilho` (alfa padrão 1), altura R = 0 e emissão G = 1
  const centro = tela.pixel(40, 20);
  assert.deepEqual(centro, [0, 255, 0, 255]);
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
  assert.deepEqual(tela.pixel(30, 30), [255, 0, 0, 255]);

  const pMeioAlfa = tela.pixel(46, 46);
  assert.equal(pMeioAlfa[3], 255);
  assert.ok(Math.abs(pMeioAlfa[0] / 255 - 0.5) < 0.01);
  assert.equal(pMeioAlfa[1], 0);

  assert.equal(parteEscreveAltura(poli([0, 0, 1, 0, 0, 1], 'pedra', 1)), true);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { suave: true })), false);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { desfoque: 0.1 })), false);
  assert.equal(parteEscreveAltura(ret(0, 0, 1, 1, 'pedra', 1, { brilho: true })), false);
  assert.equal(parteEscreveEmissao(ret(0, 0, 1, 1, 'pedra', 1, { brilho: true })), true);
  assert.equal(parteEscreveEmissao(ret(0, 0, 1, 1, 'pedra', 1)), false);
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

/** Canvas 2D software mínimo para executar `pintarMaterial`, `pintarAlturaDoMaterial`, `assarComodo` e `assarTerreno` em Node. */
function comOffscreenEmMemoria<T>(fn: () => T): T {
  const g = globalThis as Record<string, unknown>;
  const origOffscreen = g.OffscreenCanvas;
  const origDomMatrix = g.DOMMatrix;
  const origImageData = g.ImageData;

  const parseCor = (s: string): [number, number, number, number] => {
    if (s.startsWith('#')) {
      const n = parseInt(s.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
    }
    const mRgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(s);
    if (mRgb) return [Number(mRgb[1]), Number(mRgb[2]), Number(mRgb[3]), 255];
    const mRgba = /^rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)$/.exec(s);
    if (mRgba) return [Number(mRgba[1]), Number(mRgba[2]), Number(mRgba[3]), Math.round(Number(mRgba[4]) * 255)];
    return [0, 0, 0, 255];
  };

  class FakeDOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    translate() { return this; }
    scale() { return this; }
  }

  class FakeImageData {
    width: number;
    height: number;
    data: Uint8ClampedArray;
    constructor(wOrData: number | Uint8ClampedArray, hOrW: number, maybeH?: number) {
      if (typeof wOrData === 'number') {
        this.width = wOrData;
        this.height = hOrW;
        this.data = new Uint8ClampedArray(wOrData * hOrW * 4);
      } else {
        this.data = wOrData;
        this.width = hOrW;
        this.height = maybeH!;
      }
    }
  }

  class FakeCanvas {
    width: number;
    height: number;
    _data: Uint8ClampedArray;
    constructor(w: number, h: number) {
      this.width = Math.max(1, Math.round(w));
      this.height = Math.max(1, Math.round(h));
      this._data = new Uint8ClampedArray(this.width * this.height * 4);
    }
    getContext(_tipo: string) {
      const self = this;
      let ctm: [number, number, number, number, number, number] = [1, 0, 0, 1, 0, 0];
      let clipFn: ((px: number, py: number) => boolean) | null = null;
      let subpaths: [number, number][][] = [];
      let curSub: [number, number][] = [];
      const stack: { ctm: [number, number, number, number, number, number]; globalAlpha: number; globalCompositeOperation: string; clipFn: ((px: number, py: number) => boolean) | null }[] = [];

      const inv = (m: [number, number, number, number, number, number]) => {
        const det = m[0] * m[3] - m[1] * m[2] || 1;
        return (px: number, py: number): [number, number] => [
          (m[3] * (px - m[4]) - m[2] * (py - m[5])) / det,
          (-m[1] * (px - m[4]) + m[0] * (py - m[5])) / det,
        ];
      };
      const mult = (m: [number, number, number, number, number, number]): [number, number, number, number, number, number] => [
        ctm[0] * m[0] + ctm[2] * m[1], ctm[1] * m[0] + ctm[3] * m[1],
        ctm[0] * m[2] + ctm[2] * m[3], ctm[1] * m[2] + ctm[3] * m[3],
        ctm[0] * m[4] + ctm[2] * m[5] + ctm[4], ctm[1] * m[4] + ctm[3] * m[5] + ctm[5],
      ];
      const noPoli = (px: number, py: number, polis: [number, number][][]) => {
        let dentro = false;
        for (const pts of polis) {
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i]![0], yi = pts[i]![1], xj = pts[j]![0], yj = pts[j]![1];
            if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) dentro = !dentro;
          }
        }
        return dentro;
      };
      const blend = (idx: number, sr: number, sg: number, sb: number, sa: number, op: string) => {
        const d = self._data;
        if (op === 'destination-in') { d[idx + 3] = Math.round(d[idx + 3]! * (sa / 255)); return; }
        if (op === 'source-in') { const da = d[idx + 3]! / 255; d[idx] = sr; d[idx + 1] = sg; d[idx + 2] = sb; d[idx + 3] = Math.round(sa * da); return; }
        const a = sa / 255;
        if (a <= 0) return;
        const da = d[idx + 3]! / 255;
        if (op === 'multiply') {
          const mr = (d[idx]! * sr) / 255, mg = (d[idx + 1]! * sg) / 255, mb = (d[idx + 2]! * sb) / 255;
          d[idx] = Math.round(d[idx]! * (1 - a) + mr * a);
          d[idx + 1] = Math.round(d[idx + 1]! * (1 - a) + mg * a);
          d[idx + 2] = Math.round(d[idx + 2]! * (1 - a) + mb * a);
          return;
        }
        const outA = a + da * (1 - a);
        if (outA <= 0) return;
        d[idx] = Math.round((sr * a + d[idx]! * da * (1 - a)) / outA);
        d[idx + 1] = Math.round((sg * a + d[idx + 1]! * da * (1 - a)) / outA);
        d[idx + 2] = Math.round((sb * a + d[idx + 2]! * da * (1 - a)) / outA);
        d[idx + 3] = Math.round(outA * 255);
      };

      const ctx: Record<string, unknown> = {
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '#000000',
        strokeStyle: '#000000',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        shadowColor: 'transparent',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        imageSmoothingEnabled: true,
        getTransform() { return { a: ctm[0], b: ctm[1], c: ctm[2], d: ctm[3], e: ctm[4], f: ctm[5] }; },
        setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { ctm = [a, b, c, d, e, f]; },
        translate(tx: number, ty: number) { ctm = mult([1, 0, 0, 1, tx, ty]); },
        rotate(ang: number) { const c = Math.cos(ang), s = Math.sin(ang); ctm = mult([c, s, -s, c, 0, 0]); },
        scale(sx: number, sy: number) { ctm = mult([sx, 0, 0, sy, 0, 0]); },
        transform(a: number, b: number, c: number, d: number, e: number, f: number) { ctm = mult([a, b, c, d, e, f]); },
        save() { stack.push({ ctm: [...ctm], globalAlpha: ctx.globalAlpha as number, globalCompositeOperation: ctx.globalCompositeOperation as string, clipFn }); },
        restore() { const s = stack.pop(); if (s) { ctm = s.ctm; ctx.globalAlpha = s.globalAlpha; ctx.globalCompositeOperation = s.globalCompositeOperation; clipFn = s.clipFn; } },
        beginPath() { subpaths = []; curSub = []; },
        moveTo(x: number, y: number) { curSub = [[ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]]; subpaths.push(curSub); },
        lineTo(x: number, y: number) { curSub.push([ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]]); },
        closePath() {},
        clip() { const snap = subpaths.map(s => [...s]); const prev = clipFn; clipFn = (px, py) => (prev ? prev(px, py) : true) && noPoli(px, py, snap); },
        createImageData(w: number, h: number) { return new FakeImageData(w, h); },
        getImageData(sx: number, sy: number, sw: number, sh: number) {
          const out = new FakeImageData(sw, sh);
          for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
            const ox = sx + x, oy = sy + y;
            if (ox < 0 || oy < 0 || ox >= self.width || oy >= self.height) continue;
            const sIdx = (oy * self.width + ox) * 4, dIdx = (y * sw + x) * 4;
            out.data[dIdx] = self._data[sIdx]!; out.data[dIdx + 1] = self._data[sIdx + 1]!; out.data[dIdx + 2] = self._data[sIdx + 2]!; out.data[dIdx + 3] = self._data[sIdx + 3]!;
          }
          return out;
        },
        putImageData(img: FakeImageData, dx: number, dy: number) {
          for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
            const tx = dx + x, ty = dy + y;
            if (tx < 0 || ty < 0 || tx >= self.width || ty >= self.height) continue;
            const sIdx = (y * img.width + x) * 4, dIdx = (ty * self.width + tx) * 4;
            self._data[dIdx] = img.data[sIdx]!; self._data[dIdx + 1] = img.data[sIdx + 1]!; self._data[dIdx + 2] = img.data[sIdx + 2]!; self._data[dIdx + 3] = img.data[sIdx + 3]!;
          }
        },
        createPattern(img: FakeCanvas) { return { _img: img, setTransform() {} }; },
        createLinearGradient() { return { addColorStop() {} }; },
        fillRect(x: number, y: number, w: number, h: number) {
          const fs = ctx.fillStyle;
          const op = ctx.globalCompositeOperation as string;
          const ga = ctx.globalAlpha as number;
          const toLocal = inv(ctm);
          const pat = typeof fs === 'object' && fs !== null && '_img' in fs ? (fs as { _img: FakeCanvas })._img : null;
          const rgba = typeof fs === 'string' ? parseCor(fs) : [128, 128, 128, 255] as [number, number, number, number];
          const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([lx, ly]) => [ctm[0] * lx! + ctm[2] * ly! + ctm[4], ctm[1] * lx! + ctm[3] * ly! + ctm[5]]);
          const px0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]!))));
          const px1 = Math.min(self.width - 1, Math.ceil(Math.max(...corners.map(c => c[0]!))));
          const py0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]!))));
          const py1 = Math.min(self.height - 1, Math.ceil(Math.max(...corners.map(c => c[1]!))));
          for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
            if (clipFn && !clipFn(px + 0.5, py + 0.5)) continue;
            const [lx, ly] = toLocal(px + 0.5, py + 0.5);
            if (lx < x || lx > x + w || ly < y || ly > y + h) continue;
            if (pat) {
              const tx = ((px % pat.width) + pat.width) % pat.width, ty = ((py % pat.height) + pat.height) % pat.height;
              const pIdx = (ty * pat.width + tx) * 4;
              blend((py * self.width + px) * 4, pat._data[pIdx]!, pat._data[pIdx + 1]!, pat._data[pIdx + 2]!, Math.round(pat._data[pIdx + 3]! * ga), op);
            } else {
              blend((py * self.width + px) * 4, rgba[0], rgba[1], rgba[2], Math.round(rgba[3] * ga), op);
            }
          }
        },
        stroke() {
          const ss = ctx.strokeStyle;
          if (typeof ss !== 'string') return;
          const [sr, sg, sb, sa0] = parseCor(ss);
          const sa = Math.round(sa0 * (ctx.globalAlpha as number));
          const op = ctx.globalCompositeOperation as string;
          const half = Math.max(0.5, ((ctx.lineWidth as number) * Math.hypot(ctm[0], ctm[1])) / 2);
          for (const pts of subpaths) {
            for (let i = 0; i + 1 < pts.length; i++) {
              const a = pts[i]!, b = pts[i + 1]!;
              const minX = Math.max(0, Math.floor(Math.min(a[0], b[0]) - half)), maxX = Math.min(self.width - 1, Math.ceil(Math.max(a[0], b[0]) + half));
              const minY = Math.max(0, Math.floor(Math.min(a[1], b[1]) - half)), maxY = Math.min(self.height - 1, Math.ceil(Math.max(a[1], b[1]) + half));
              const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
              for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
                if (clipFn && !clipFn(px + 0.5, py + 0.5)) continue;
                const t = Math.max(0, Math.min(1, ((px + 0.5 - a[0]) * dx + (py + 0.5 - a[1]) * dy) / len2));
                const d = Math.hypot(px + 0.5 - (a[0] + t * dx), py + 0.5 - (a[1] + t * dy));
                if (d <= half) blend((py * self.width + px) * 4, sr, sg, sb, sa, op);
              }
            }
          }
        },
        drawImage(src: FakeCanvas, dx: number, dy: number, dw?: number, dh?: number) {
          const sx0 = ctm[0] * dx + ctm[2] * dy + ctm[4];
          const sy0 = ctm[1] * dx + ctm[3] * dy + ctm[5];
          const sw = (dw ?? src.width) * Math.hypot(ctm[0], ctm[1]);
          const sh = (dh ?? src.height) * Math.hypot(ctm[2], ctm[3]);
          const op = ctx.globalCompositeOperation as string;
          const ga = ctx.globalAlpha as number;
          const px0 = Math.max(0, Math.floor(sx0)), px1 = Math.min(self.width - 1, Math.ceil(sx0 + sw) - 1);
          const py0 = Math.max(0, Math.floor(sy0)), py1 = Math.min(self.height - 1, Math.ceil(sy0 + sh) - 1);
          for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
            if (clipFn && !clipFn(px + 0.5, py + 0.5)) continue;
            const u = Math.min(src.width - 1, Math.max(0, Math.floor(((px + 0.5 - sx0) / sw) * src.width)));
            const v = Math.min(src.height - 1, Math.max(0, Math.floor(((py + 0.5 - sy0) / sh) * src.height)));
            const sIdx = (v * src.width + u) * 4;
            blend((py * self.width + px) * 4, src._data[sIdx]!, src._data[sIdx + 1]!, src._data[sIdx + 2]!, Math.round(src._data[sIdx + 3]! * ga), op);
          }
        },
      };
      return ctx;
    }
  }

  g.OffscreenCanvas = FakeCanvas;
  g.DOMMatrix = FakeDOMMatrix;
  g.ImageData = FakeImageData;
  try {
    return fn();
  } finally {
    g.OffscreenCanvas = origOffscreen;
    g.DOMMatrix = origDomMatrix;
    g.ImageData = origImageData;
  }
}

test('alturaPorLuminancia e pintarAlturaDoMaterial: padrão laje dá valor menor nas juntas que no miolo da laje', () => {
  // 1) Teste puro direto sobre uma grade conhecida de lajes (miolo claro #c8c8c8, junta escura #282828)
  const res = 40;
  const W = 120, H = 120; // 3 m × 3 m
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const junta = (y % 40) < 2 || (x % 40) < 2;
      const c = junta ? 40 : 200;
      const k = (y * W + x) * 4;
      rgba[k] = c; rgba[k + 1] = c; rgba[k + 2] = c; rgba[k + 3] = 255;
    }
  }
  const alt = alturaPorLuminancia(rgba, W, H, res);
  const hJunta = alt[(1 * W + 20) * 4]!;
  const hMiolo = alt[(20 * W + 20) * 4]!;
  assert.ok(hJunta < 128, `junta abaixo de 0.5 (${hJunta})`);
  assert.ok(hMiolo > 128, `miolo acima de 0.5 (${hMiolo})`);
  assert.ok(hJunta < hMiolo, `junta (${hJunta}) deve ser menor que miolo (${hMiolo})`);

  // 2) Teste de ponta a ponta com `pintarAlturaDoMaterial` no material real 'calcada' (padrão 'laje')
  assert.deepEqual(PINTORES_DE_ALTURA, {}, 'PINTORES_DE_ALTURA começa vazio na L4');
  comOffscreenEmMemoria(() => {
    const area = { x: 0, y: 0, w: 3, h: 3 };
    const corTela = new OffscreenCanvas(W, H) as unknown as { width: number; height: number; _data: Uint8ClampedArray; getContext(t: string): Contexto };
    const corCtx = corTela.getContext('2d');
    corCtx.setTransform(res, 0, 0, res, 0, 0);
    pintarMaterial(corCtx, 'calcada', area, 1);

    const altTela = new OffscreenCanvas(W, H) as unknown as { width: number; height: number; _data: Uint8ClampedArray; getContext(t: string): Contexto };
    const altCtx = altTela.getContext('2d');
    altCtx.setTransform(res, 0, 0, res, 0, 0);
    pintarAlturaDoMaterial(altCtx, 'calcada', area, 1, { res });

    // Acha no próprio desenho de 'calcada' (padrão 'laje') o pixel mais escuro (junta) e o mais claro (miolo de laje) na faixa central
    let minLum = Infinity, maxLum = -Infinity, pJunta = 0, pMiolo = 0;
    for (let y = 24; y < 96; y++) {
      for (let x = 24; x < 96; x++) {
        const i = (y * W + x) * 4;
        const l = corTela._data[i]! + corTela._data[i + 1]! + corTela._data[i + 2]!;
        if (l < minLum) { minLum = l; pJunta = i; }
        if (l > maxLum) { maxLum = l; pMiolo = i; }
      }
    }
    assert.equal(materialDe('calcada').padrao, 'laje');
    assert.ok(altTela._data[pJunta]! < altTela._data[pMiolo]!, `altura na junta (${altTela._data[pJunta]}) < miolo (${altTela._data[pMiolo]})`);
  });
});

test('assarTerreno e assarComodo geram altura em paralelo no Ilustrado (com relevo e degraus) e null no Pixel', () => {
  comOffscreenEmMemoria(() => {
    const terreno = assarTerreno(
      {
        largura: 6,
        altura: 4,
        resolucao: 1,
        base: 'calcada',
        camadas: [],
        relevo: {
          topo: 0,
          neblina: '#6e829c',
          faixas: [{ altura: -12, celulas: [[0, 3, 3], [1, 3, 3], [2, 3, 3], [3, 3, 3]] }],
        },
      },
      10,
      ILUSTRADO,
    );
    assert.ok(terreno.altura, 'terreno Ilustrado devolve tela de altura');
    const tAlt = terreno.altura as unknown as { width: number; _data: Uint8ClampedArray };
    // Esquerda (altura 0 m) ~ 0.5 (~128); direita (patamar -12 m -> 0.5 - 12/40 = 0.2 -> ~51)
    const esq = tAlt._data[(20 * tAlt.width + 10) * 4]!;
    const dir = tAlt._data[(20 * tAlt.width + 50) * 4]!;
    assert.ok(Math.abs(esq / 255 - 0.5) < 0.12, `base em 0 m ~0.5, veio ${esq / 255}`);
    assert.ok(Math.abs(dir / 255 - 0.2) < 0.12, `fosso em -12 m ~0.2, veio ${dir / 255}`);
    assert.ok(esq > dir + 40);

    const terrenoPixel = assarTerreno({ largura: 4, altura: 4, resolucao: 1, base: 'terra', camadas: [] }, 8, PIXEL);
    assert.equal(terrenoPixel.altura, null);

    const comodo = assarComodo(
      {
        grade: { size: 1, offset: [0, 0] },
        celulas: [[0, 0, 4], [1, 0, 4], [2, 0, 4], [3, 0, 4]],
        piso: { material: 'calcada', seed: 1 },
        papel: null,
        estilo: 'solid',
        altura: 2.6,
        aberturas: [],
        objetos: [],
        degraus: [{ caminhos: [[[2, 0], [2, 4]]], drops: ['b'], desnivel: 0.5 }],
      },
      20,
      ILUSTRADO,
    );
    assert.ok(comodo.altura, 'cômodo Ilustrado devolve tela de altura');
    const cAlt = comodo.altura as unknown as { width: number; _data: Uint8ClampedArray };
    const pxCrista = Math.round((2 - comodo.origem[0]) * 20);
    const pyMeio = Math.round((2 - comodo.origem[1]) * 20);
    const pxLonge = Math.round((0.8 - comodo.origem[0]) * 20);
    assert.ok(cAlt._data[(pyMeio * cAlt.width + pxCrista) * 4]! > cAlt._data[(pyMeio * cAlt.width + pxLonge) * 4]!, 'crista do degrau é mais alta que o piso plano');

    const comodoPixel = assarComodo(
      {
        grade: { size: 1, offset: [0, 0] },
        celulas: [[0, 0, 2], [1, 0, 2]],
        piso: { material: 'calcada', seed: 1 },
        papel: null,
        estilo: 'solid',
        altura: 2.6,
        aberturas: [],
        objetos: [],
      },
      8,
      PIXEL,
    );
    assert.equal(comodoPixel.altura, null);
  });
});
