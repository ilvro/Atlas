import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contornoDoComodo } from '../../src/domain/geometria.ts';
import { criarMapa } from '../../src/domain/mapa.ts';
import { validarMapa } from '../../src/domain/validacao.ts';
import { assarComodo } from '../../src/procedural/assar.ts';
import { ILUSTRADO } from '../../src/procedural/estilos/ilustrado.ts';
import {
  AMPLIACAO_NA_FACE,
  PROJECAO,
  ampliarNaFace,
  alturaTopoDaFace,
  calcularFacesDasParedes,
  profundidadeDaFace,
  resolverMaterialDaFace,
  type ParedeDaSala,
} from '../../src/procedural/faces-de-parede.ts';

function comCanvasSoftware<T>(fn: () => T): T {
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
    translate() { return this; }
    scale() { return this; }
  }

  class FakeImageData {
    width: number; height: number; data: Uint8ClampedArray;
    constructor(wOrData: number | Uint8ClampedArray, hOrW: number, maybeH?: number) {
      if (typeof wOrData === 'number') { this.width = wOrData; this.height = hOrW; this.data = new Uint8ClampedArray(wOrData * hOrW * 4); }
      else { this.data = wOrData; this.width = hOrW; this.height = maybeH!; }
    }
  }

  interface Gradiente { x0: number; y0: number; x1: number; y1: number; stops: [number, [number, number, number, number]][] }

  class FakeCanvas {
    width: number; height: number; _data: Uint8ClampedArray;
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

      const xf = (x: number, y: number): [number, number] => [ctm[0] * x + ctm[2] * y + ctm[4], ctm[1] * x + ctm[3] * y + ctm[5]];
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
      const blend = (idx: number, sr: number, sg: number, sb: number, sa: number) => {
        const d = self._data, a = sa / 255;
        if (a <= 0) return;
        const da = d[idx + 3]! / 255, outA = a + da * (1 - a);
        if (outA <= 0) return;
        d[idx] = Math.round((sr * a + d[idx]! * da * (1 - a)) / outA);
        d[idx + 1] = Math.round((sg * a + d[idx + 1]! * da * (1 - a)) / outA);
        d[idx + 2] = Math.round((sb * a + d[idx + 2]! * da * (1 - a)) / outA);
        d[idx + 3] = Math.round(outA * 255);
      };
      const amostrarGradiente = (gr: Gradiente, lx: number, ly: number): [number, number, number, number] => {
        const dx = gr.x1 - gr.x0, dy = gr.y1 - gr.y0, len2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((lx - gr.x0) * dx + (ly - gr.y0) * dy) / len2));
        const s = [...gr.stops].sort((a, b) => a[0] - b[0]);
        if (!s.length) return [0, 0, 0, 255];
        if (t <= s[0]![0]) return s[0]![1];
        for (let i = 0; i + 1 < s.length; i++) {
          const [t0, c0] = s[i]!, [t1, c1] = s[i + 1]!;
          if (t <= t1) {
            const f = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
            return [
              Math.round(c0[0] + (c1[0] - c0[0]) * f),
              Math.round(c0[1] + (c1[1] - c0[1]) * f),
              Math.round(c0[2] + (c1[2] - c0[2]) * f),
              Math.round(c0[3] + (c1[3] - c0[3]) * f),
            ];
          }
        }
        return s.at(-1)![1];
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
        moveTo(x: number, y: number) { curSub = [xf(x, y)]; subpaths.push(curSub); },
        lineTo(x: number, y: number) { curSub.push(xf(x, y)); },
        rect(x: number, y: number, w: number, h: number) { curSub = [xf(x, y), xf(x + w, y), xf(x + w, y + h), xf(x, y + h)]; subpaths.push(curSub); },
        roundRect(x: number, y: number, w: number, h: number) { (ctx.rect as (x: number, y: number, w: number, h: number) => void)(x, y, w, h); },
        arc(cx: number, cy: number, r: number, a0: number, a1: number, ccw = false) {
          const passos = 8, delta = ccw ? (a1 - a0 > 0 ? a1 - a0 - Math.PI * 2 : a1 - a0) : (a1 - a0 < 0 ? a1 - a0 + Math.PI * 2 : a1 - a0);
          for (let i = 0; i <= passos; i++) { const a = a0 + (delta * i) / passos; curSub.push(xf(cx + Math.cos(a) * r, cy + Math.sin(a) * r)); }
        },
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
        createLinearGradient(x0: number, y0: number, x1: number, y1: number) {
          const gr: Gradiente = { x0, y0, x1, y1, stops: [] };
          return { addColorStop(offset: number, cor: string) { gr.stops.push([offset, parseCor(cor)]); }, _grad: gr };
        },
        fillRect(x: number, y: number, w: number, h: number) {
          const fs = ctx.fillStyle, ga = ctx.globalAlpha as number, toLocal = inv(ctm);
          const grad = typeof fs === 'object' && fs !== null && '_grad' in fs ? (fs as { _grad: Gradiente })._grad : null;
          const rgba = typeof fs === 'string' ? parseCor(fs) : null;
          const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([lx, ly]) => xf(lx!, ly!));
          const px0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[0]!))));
          const px1 = Math.min(self.width - 1, Math.ceil(Math.max(...corners.map(c => c[0]!))));
          const py0 = Math.max(0, Math.floor(Math.min(...corners.map(c => c[1]!))));
          const py1 = Math.min(self.height - 1, Math.ceil(Math.max(...corners.map(c => c[1]!))));
          for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
            if (clipFn && !clipFn(px + 0.5, py + 0.5)) continue;
            const [lx, ly] = toLocal(px + 0.5, py + 0.5);
            if (lx < x || lx > x + w || ly < y || ly > y + h) continue;
            const c = grad ? amostrarGradiente(grad, lx, ly) : (rgba ?? [128, 128, 128, 255]);
            blend((py * self.width + px) * 4, c[0], c[1], c[2], Math.round(c[3] * ga));
          }
        },
        fill() {
          const fs = ctx.fillStyle;
          if (typeof fs !== 'string' || !subpaths.length) return;
          const [sr, sg, sb, sa0] = parseCor(fs), sa = Math.round(sa0 * (ctx.globalAlpha as number));
          for (let py = 0; py < self.height; py++) for (let px = 0; px < self.width; px++) {
            if (clipFn && !clipFn(px + 0.5, py + 0.5)) continue;
            if (noPoli(px + 0.5, py + 0.5, subpaths)) blend((py * self.width + px) * 4, sr, sg, sb, sa);
          }
        },
        strokeRect(x: number, y: number, w: number, h: number) { (ctx.rect as (x: number, y: number, w: number, h: number) => void)(x, y, w, h); (ctx.stroke as () => void)(); },
        stroke() {
          const ss = ctx.strokeStyle;
          if (typeof ss !== 'string') return;
          const [sr, sg, sb, sa0] = parseCor(ss), sa = Math.round(sa0 * (ctx.globalAlpha as number));
          const half = Math.max(0.5, ((ctx.lineWidth as number) * Math.hypot(ctm[0], ctm[1])) / 2);
          for (const pts of subpaths) for (let i = 0; i + 1 < pts.length; i++) {
            const a = pts[i]!, b = pts[i + 1]!;
            const minX = Math.max(0, Math.floor(Math.min(a[0], b[0]) - half)), maxX = Math.min(self.width - 1, Math.ceil(Math.max(a[0], b[0]) + half));
            const minY = Math.max(0, Math.floor(Math.min(a[1], b[1]) - half)), maxY = Math.min(self.height - 1, Math.ceil(Math.max(a[1], b[1]) + half));
            const dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy || 1;
            for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
              if (clipFn && !clipFn(px + 0.5, py + 0.5)) continue;
              const t = Math.max(0, Math.min(1, ((px + 0.5 - a[0]) * dx + (py + 0.5 - a[1]) * dy) / len2));
              if (Math.hypot(px + 0.5 - (a[0] + t * dx), py + 0.5 - (a[1] + t * dy)) <= half) blend((py * self.width + px) * 4, sr, sg, sb, sa);
            }
          }
        },
        drawImage(src: FakeCanvas, dx: number, dy: number, dw?: number, dh?: number) {
          const [sx0, sy0] = xf(dx, dy);
          const sw = (dw ?? src.width) * Math.hypot(ctm[0], ctm[1]);
          const sh = (dh ?? src.height) * Math.hypot(ctm[2], ctm[3]);
          const ga = ctx.globalAlpha as number;
          const px0 = Math.max(0, Math.floor(sx0)), px1 = Math.min(self.width - 1, Math.ceil(sx0 + sw) - 1);
          const py0 = Math.max(0, Math.floor(sy0)), py1 = Math.min(self.height - 1, Math.ceil(sy0 + sh) - 1);
          for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
            if (clipFn && !clipFn(px + 0.5, py + 0.5)) continue;
            const u = Math.min(src.width - 1, Math.max(0, Math.floor(((px + 0.5 - sx0) / Math.max(1, sw)) * src.width)));
            const v = Math.min(src.height - 1, Math.max(0, Math.floor(((py + 0.5 - sy0) / Math.max(1, sh)) * src.height)));
            const sIdx = (v * src.width + u) * 4;
            blend((py * self.width + px) * 4, src._data[sIdx]!, src._data[sIdx + 1]!, src._data[sIdx + 2]!, Math.round(src._data[sIdx + 3]! * ga));
          }
        },
      };
      return ctx;
    }
  }

  g.OffscreenCanvas = FakeCanvas;
  g.DOMMatrix = FakeDOMMatrix;
  g.ImageData = FakeImageData;
  try { return fn(); }
  finally { g.OffscreenCanvas = origOffscreen; g.DOMMatrix = origDomMatrix; g.ImageData = origImageData; }
}

test('sala retangular 4 × 3 m com parede de 3 m tem faixa de 0,54 m e quinas diagonais em meia-esquadria', () => {
  assert.equal(PROJECAO, 0.24);
  assert.ok(Math.abs(profundidadeDaFace(3) - 0.72) < 1e-9);
  const lacos = contornoDoComodo(criarMapa({ celula: 1 }), [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]]);
  const paredes: ParedeDaSala[] = [
    { path: [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]], height: 3, material: 'parede.topo', kind: 'wall' },
  ];
  const faces = calcularFacesDasParedes(lacos, paredes, { alturaPadrao: 3 });
  assert.equal(faces.length, 4);
  for (const f of faces) assert.ok(Math.abs(f.prof - 0.72) < 1e-9, `largura esperada 0.72 m, veio ${f.prof}`);
  const norte = faces.find(f => f.segmento.n[1] > 0.5)!;
  // Quinas internas avançam 0,54 m nos dois eixos (diagonal 45° em meia-esquadria).
  assert.ok(Math.abs(norte.quad[3][0] - (norte.segmento.a[0] - 0.72)) < 1e-6);
  assert.ok(Math.abs(norte.quad[3][1] - (norte.segmento.a[1] + 0.72)) < 1e-6);
  for (let i = 0; i < faces.length; i++) {
    assert.deepEqual(faces[i]!.quad[2], faces[(i + 1) % faces.length]!.quad[3]);
  }
});

test('apenas paredes wall recebem face (low e fence não) e wallFace tem prioridade sobre papel e parede', () => {
  const lacos = contornoDoComodo(criarMapa({ celula: 1 }), [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]]);
  const paredes: ParedeDaSala[] = [
    { path: [[0, 0], [4, 0]], height: 3, material: 'pedra.aparelhada', kind: 'wall' },
    { path: [[4, 0], [4, 3]], height: 1, material: 'pedra.aparelhada', kind: 'low' },
    { path: [[4, 3], [0, 3]], height: 1.2, material: 'madeira.escura', kind: 'fence' },
    { path: [[0, 3], [0, 0]], height: 3, material: 'tijolo', kind: 'wall' },
  ];
  const faces = calcularFacesDasParedes(lacos, paredes, { alturaPadrao: 2.6, wallFace: 'papel.damasco-vinho' });
  assert.equal(faces.length, 2);
  assert.ok(faces.every(f => f.material === 'papel.damasco-vinho'));
  assert.equal(resolverMaterialDaFace('papel.damasco-vinho', { material: 'papel.listras-creme' }, 'tijolo'), 'papel.damasco-vinho');
  assert.equal(resolverMaterialDaFace(undefined, { material: 'papel.listras-creme' }, 'tijolo'), 'papel.listras-creme');
  assert.equal(resolverMaterialDaFace(undefined, null, 'tijolo'), 'tijolo');
});

test('porta abre vão na faixa da face e rampa de altura sobe do piso (0,5) ao topo', () => {
  const lacos = contornoDoComodo(criarMapa({ celula: 1 }), [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]]);
  const paredes: ParedeDaSala[] = [{ path: [[0, 0], [4, 0], [4, 3], [0, 3], [0, 0]], height: 3, material: 'parede.topo', kind: 'wall' }];
  const faces = calcularFacesDasParedes(lacos, paredes, {
    alturaPadrao: 3,
    aberturas: [{ tipo: 'door', centro: [2, 0], largura: 1.2, material: 'madeira.media' }],
  });
  const norte = faces.find(f => f.segmento.n[1] > 0.5)!;
  assert.equal(norte.vaos.length, 1);
  assert.ok(norte.vaos[0]!.u0 < 2 && norte.vaos[0]!.u1 > 2);

  comCanvasSoftware(() => {
    const res = 20;
    const assado = assarComodo(
      {
        grade: { size: 1, offset: [0, 0] },
        celulas: [[0, 0, 4], [1, 0, 4], [2, 0, 4]],
        piso: { material: '#e6e0d0', seed: 1 },
        papel: { material: '#2b2024', seed: 1 },
        coberto: true,
        paredes,
        estilo: 'box',
        altura: 3,
        aberturas: [{ tipo: 'door', centro: [2, 0], largura: 1.2, material: 'madeira.media' }],
        objetos: [],
      },
      res,
      ILUSTRADO,
    );
    assert.ok(assado.altura);
    const cor = assado.tela as unknown as { width: number; _data: Uint8ClampedArray };
    const alt = assado.altura as unknown as { width: number; _data: Uint8ClampedArray };
    const px = (x: number) => Math.round((x - assado.origem[0]) * res);
    const py = (y: number) => Math.round((y - assado.origem[1]) * res);
    const luma = (x: number, y: number) => {
      const k = (py(y) * cor.width + px(x)) * 4;
      return 0.299 * cor._data[k]! + 0.587 * cor._data[k + 1]! + 0.114 * cor._data[k + 2]!;
    };
    const rAlt = (x: number, y: number) => alt._data[(py(y) * alt.width + px(x)) * 4]!;

    // No vão da porta (x = 2, y = 0.3), aparece o piso claro com altura ~0,5 (~128).
    // Fora da porta (x = 0.9, y = 0.3), aparece a face escura com altura em rampa acima de 0,5.
    assert.ok(luma(2, 0.3) > luma(0.9, 0.3) + 40, `vão da porta (${luma(2, 0.3)}) deve mostrar piso claro vs face (${luma(0.9, 0.3)})`);
    assert.ok(Math.abs(rAlt(2, 0.3) / 255 - 0.5) < 0.08, `altura no vão da porta ~0,5, veio ${rAlt(2, 0.3) / 255}`);
    assert.ok(rAlt(0.9, 0.1) > rAlt(0.9, 0.45), `altura no topo da face (${rAlt(0.9, 0.1)}) > perto do pé (${rAlt(0.9, 0.45)})`);
    assert.ok(Math.abs(alturaTopoDaFace(3) - 1) < 1e-6);
    assert.ok(Math.abs(alturaTopoDaFace(1.2) - 0.8) < 1e-6);
  });
});

test('objetos de parede são ampliados na face sem passar da sanca nem do rodapé e Comodo.wallFace valida no mapa', () => {
  const quadro = [{ forma: 'ret' as const, x: 2, y: 1.1, w: 1, h: 0.7, mat: '#000000', z: 1 }];
  const [a] = ampliarNaFace(quadro, 2, 2.6);
  assert.ok(Math.abs(a!.w! - AMPLIACAO_NA_FACE[0]) < 1e-9 && Math.abs(a!.h! - 0.7 * AMPLIACAO_NA_FACE[1]) < 1e-9);
  const alto = ampliarNaFace([{ ...quadro[0]!, y: 0.6, h: 0.8 }], 2, 2.6)[0]!;
  assert.ok(alto.y! - alto.h! / 2 >= 0.15 - 1e-9, 'não invade a sanca');

  const m = criarMapa();
  m.rooms.r1 = {
    id: 'r1', name: 'Sala', function: 'sala', cells: [[0, 0, 2], [1, 0, 2]],
    floor: { material: 'tabuas.carvalho', seed: 1 }, wallpaper: null, wallFace: 'papel.damasco-vinho',
    wallStyle: null, palette: null, roof: { material: null, visible: true }, levelId: null,
  };
  validarMapa(m);
  (m.rooms.r1 as { wallFace: unknown }).wallFace = 123;
  assert.throws(() => validarMapa(m), /rooms\.r1\.wallFace/);
});
