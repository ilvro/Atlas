import { contextoDe, criarTela, type Contexto, type Tela } from '../canvas.ts';
import { materialDe, type Area, type Material, type Padrao } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';

/**
 * Materiais no estilo Pixel: a mesma descrição (`Material`) pintada em blocos de cor sólida na grade de pixels, sem gradiente,
 * sem transparência e sem antialias. Tudo se alinha à grade do dispositivo, lida da matriz do contexto.
 */

const rgb = (hex: string): [number, number, number] => { const p = parseInt(hex.slice(1), 16); return [(p >> 16) & 255, (p >> 8) & 255, p & 255]; };

/** Mistura duas cores #rrggbb (`t` = 0 devolve `a`, 1 devolve `b`). */
export function misturarHex(a: string, b: string, t: number): string {
  const pa = rgb(a), pb = rgb(b);
  return '#' + pa.map((v, i) => Math.round(v * (1 - t) + pb[i]! * t).toString(16).padStart(2, '0')).join('');
}

/** Os tons de um material: base, claro, escuro e misturas fixas (poucas cores por material, para a paleta). */
export interface Tons { B: string; C: string; E: string; c1: string; c2: string; e1: string; e2: string }
export function tonsDe(m: Pick<Material, 'base' | 'claro' | 'escuro'>): Tons {
  return { B: m.base, C: m.claro, E: m.escuro, c1: misturarHex(m.base, m.claro, 0.3), c2: misturarHex(m.base, m.claro, 0.6), e1: misturarHex(m.base, m.escuro, 0.45), e2: misturarHex(m.base, m.escuro, 0.75) };
}

/** Encaixa `v` (local) na grade do dispositivo: o pixel do dispositivo é `coef` por unidade local, com deslocamento `desl`. */
export const encaixarNaGrade = (v: number, coef: number, desl: number): number => (Math.round(coef * v + desl) - desl) / coef;

interface Grade { sx(v: number): number; sy(v: number): number }
/** A grade de pixels do dispositivo vista do espaço local (vale para rotações de 90°). */
function gradeDe(ctx: Contexto): Grade {
  const m = ctx.getTransform();
  const ex = (coef: number, desl: number) => (v: number) => encaixarNaGrade(v, coef, desl);
  return {
    sx: Math.abs(m.a) >= Math.abs(m.b) ? ex(m.a, m.e) : ex(m.b, m.f),
    sy: Math.abs(m.d) >= Math.abs(m.c) ? ex(m.d, m.f) : ex(m.c, m.e),
  };
}

interface P { ctx: Contexto; area: Area; A: Area; m: Material; t: Tons; r: () => number; seed: number; g: Grade; px: number; res: number }

function ret(p: P, x: number, y: number, w: number, h: number, cor: string): void {
  const { sx, sy } = p.g; p.ctx.fillStyle = cor; p.ctx.fillRect(sx(x), sy(y), sx(x + w) - sx(x), sy(y + h) - sy(y));
}

// ---------- Ladrilhos de pixels (padrões periódicos e ruídos) ----------
const ladrilhos = new Map<string, Tela>();
/** Um ladrilho `w × h` de pixels pintado por `montar` (índice da cor por pixel, -1 = transparente), em cache. */
function ladrilho(chave: string, w: number, h: number, cores: string[], montar: (idx: Int16Array, w: number, h: number, r: () => number) => void): Tela {
  let t = ladrilhos.get(chave); if (t) return t;
  const idx = new Int16Array(w * h).fill(-1); montar(idx, w, h, mulberry32(chave.length * 7919 + (chave.charCodeAt(chave.length - 1) || 1)));
  t = criarTela(w, h); const c = contextoDe(t), dados = new ImageData(w, h), pal = cores.map(rgb);
  for (let i = 0; i < idx.length; i++) { const k = idx[i]!; if (k < 0) continue; dados.data[i * 4] = pal[k]![0]; dados.data[i * 4 + 1] = pal[k]![1]; dados.data[i * 4 + 2] = pal[k]![2]; dados.data[i * 4 + 3] = 255; }
  c.putImageData(dados, 0, 0); ladrilhos.set(chave, t); return t;
}

/** Cobre a área com o ladrilho, um pixel do ladrilho por pixel do dispositivo, alinhado à grade. */
function ladrilhar(p: P, t: Tela): void {
  const pat = p.ctx.createPattern(t as CanvasImageSource, 'repeat'); if (!pat) return;
  const dx = (p.seed * 37) % t.width, dy = (p.seed * 61) % t.height;
  pat.setTransform(new DOMMatrix().translate(p.g.sx(p.A.x) + dx * p.px, p.g.sy(p.A.y) + dy * p.px).scale(p.px));
  p.ctx.save(); p.ctx.imageSmoothingEnabled = false; p.ctx.fillStyle = pat; p.ctx.fillRect(p.g.sx(p.A.x), p.g.sy(p.A.y), p.g.sx(p.A.x + p.A.w) - p.g.sx(p.A.x), p.g.sy(p.A.y + p.A.h) - p.g.sy(p.A.y)); p.ctx.restore();
}

/** Espalha `n` manchas de até `mw × mh` pixels da cor `cor` (um blocinho de 1 a 3 pixels), com a borda dando a volta no ladrilho. */
function manchar(idx: Int16Array, w: number, h: number, r: () => number, cor: number, n: number, mw: number, mh: number): void {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * w), y = Math.floor(r() * h), bw = 1 + Math.floor(r() * mw), bh = 1 + Math.floor(r() * mh);
    for (let j = 0; j < bh; j++) for (let k = 0; k < bw; k++) idx[((y + j) % h) * w + ((x + k) % w)] = cor;
  }
}
const pontilhar = (idx: Int16Array, r: () => number, cor: number, prob: number): void => { for (let i = 0; i < idx.length; i++) if (idx[i]! < 0 && r() < prob) idx[i] = cor; };

const chaveDe = (p: P, nome: string) => `${p.m.id}|${nome}|${p.seed % 5}`;
const ruidoPixel = (p: P, nome: string, claro: number, escuro: number, bloco = false) =>
  ladrilhar(p, ladrilho(chaveDe(p, nome), 64, 64, [p.t.c1, p.t.e1, p.t.C, p.t.E], (idx, w, h, r) => {
    if (bloco) { manchar(idx, w, h, r, 1, Math.round(w * h * escuro / 2), 2, 1); manchar(idx, w, h, r, 0, Math.round(w * h * claro / 2), 2, 1); }
    else { pontilhar(idx, r, 1, escuro); pontilhar(idx, r, 0, claro); }
  }));

// ---------- Os padrões ----------
const quadros = (p: P, lado: number, cor: (i: number, j: number) => string, aoRedor?: string): void => {
  const l = Math.max(2, Math.round(lado * p.res)) * p.px;
  for (let y = Math.floor(p.A.y / l) * l, j = 0; y < p.A.y + p.A.h; y += l, j++) for (let x = Math.floor(p.A.x / l) * l, i = 0; x < p.A.x + p.A.w; x += l, i++) {
    ret(p, x, y, l, l, cor(Math.round(x / l), Math.round(y / l)));
    if (aoRedor) { ret(p, x, y, l, p.px, aoRedor); ret(p, x, y, p.px, l, aoRedor); }
  }
};

/** Fileiras de peças de comprimento variável, em degraus de pixel (tábuas, lajes). */
function fileiras(p: P, alturas: () => number, comprimentos: () => number, tom: () => string, junta: string): void {
  for (let y = p.g.sy(p.A.y); y < p.A.y + p.A.h;) {
    const alt = Math.max(3, Math.round(alturas() * p.res)) * p.px;
    let x = p.g.sx(p.A.x - p.r() * 2);
    while (x < p.A.x + p.A.w) {
      const comp = Math.max(4, Math.round(comprimentos() * p.res)) * p.px;
      ret(p, x, y, comp, alt, tom()); ret(p, x + comp - p.px, y, p.px, alt, junta); x += comp;
    }
    ret(p, p.A.x, y, p.A.w, p.px, junta); y += alt;
  }
}

function persa(p: P): void {
  const { area: a, m, t, px } = p, borda = m.borda ?? m.escuro, meio = m.meio ?? m.claro, snap = (v: number) => Math.round(v / px) * px;
  const b = Math.max(2 * px, snap(Math.min(a.w, a.h) * 0.11));
  ret(p, a.x, a.y, a.w, a.h, borda); ret(p, a.x + b, a.y + b, a.w - 2 * b, a.h - 2 * b, m.base);
  for (const k of [px, b - 2 * px]) { if (k < px) continue; ret(p, a.x + k, a.y + k, a.w - 2 * k, px, t.C); ret(p, a.x + k, a.y + a.h - k - px, a.w - 2 * k, px, t.C); ret(p, a.x + k, a.y + k, px, a.h - 2 * k, t.C); ret(p, a.x + a.w - k - px, a.y + k, px, a.h - 2 * k, t.C); }
  for (let y = a.y + b + 2 * px; y < a.y + a.h - b - px; y += 4 * px) for (let x = a.x + b + 2 * px + (Math.round(y / px / 4) % 2) * 2 * px; x < a.x + a.w - b - px; x += 4 * px) ret(p, x, y, px, px, t.e1);
  const cx = snap(a.x + a.w / 2), cy = snap(a.y + a.h / 2), rx = snap(a.w * 0.22), ry = snap(a.h * 0.3);
  const losango = (rx2: number, ry2: number, cor: string) => { const n = Math.max(1, Math.round(ry2 / px)); for (let k = -n; k <= n; k++) { const hw = snap(rx2 * (1 - Math.abs(k) / (n + 1))); if (hw > 0) ret(p, cx - hw, cy + k * px, 2 * hw, px, cor); } };
  losango(rx, ry, borda); losango(rx * 0.7, ry * 0.6, t.C); losango(rx * 0.4, ry * 0.32, meio);
  ret(p, cx - px, cy - px, 2 * px, 2 * px, borda);
}

const PINTORES: Record<Padrao, (p: P) => void> = {
  tabuas: p => {
    const alt = Math.max(3, Math.round((p.m.largura ?? 0.2) * p.res) + 1) / p.res;      // pelo menos 3 pixels de altura
    fileiras(p, () => alt, () => 1.4 + p.r() * 2.2, () => (p.r() < 0.5 ? p.t.B : p.t.c1), p.t.e1);
  },
  xadrez: p => quadros(p, p.m.lado ?? 0.4, (i, j) => ((i + j) % 2 === 0 ? p.t.E : p.t.C)),
  laje: p => fileiras(p, () => 0.42 + p.r() * 0.2, () => 0.5 + p.r() * 0.8, () => [p.t.B, p.t.c1, p.t.c2][Math.floor(p.r() * 3)]!, p.t.e1),
  damasco: p => ladrilhar(p, ladrilho(chaveDe(p, 'damasco'), 8, 10, [p.t.C, p.t.e1], (idx, w) => {
    for (const [ox, oy] of [[1, 0], [5, 5]] as const) { idx[oy * w + ox] = 0; idx[(oy + 1) * w + ox] = 0; for (const d of [-1, 0, 1]) idx[(oy + 1) * w + ox + d] = 0; idx[(oy + 2) * w + ox] = 0; idx[(oy + 1) * w + ox + (ox === 1 ? 3 : -3)] = 1; }
  })),
  floral: p => ladrilhar(p, ladrilho(chaveDe(p, 'floral'), 12, 12, [p.t.C, p.m.ouro ?? p.t.E, p.t.e1], (idx, w) => {
    for (const [ox, oy] of [[3, 3], [9, 9]] as const) { for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) idx[(oy + dy) * w + ox + dx] = 0; idx[oy * w + ox] = 1; idx[(oy + 2) * w + ox + 2] = 2; idx[(oy - 2) * w + ox - 2 + w * 0] = 2; }
  })),
  listras: p => ladrilhar(p, ladrilho(chaveDe(p, 'listras'), 8, 1, [p.t.B, p.t.C, p.m.ouro ?? p.t.C], idx => { for (let x = 0; x < 8; x++) idx[x] = x % 4 < 2 ? 0 : 1; if (p.m.ouro) idx[7] = 2; })),
  veio: p => ladrilhar(p, ladrilho(chaveDe(p, 'veio'), 48, 24, [p.t.e1, p.t.c1], (idx, w, h, r) => {
    for (let y = 0; y < h; y++) if (r() < 0.55) { const x0 = Math.floor(r() * w), len = 3 + Math.floor(r() * 9), cor = r() < 0.7 ? 0 : 1; for (let k = 0; k < len; k++) idx[y * w + ((x0 + k) % w)] = cor; }
  })),
  trama: p => ruidoPixel(p, 'trama', 0.1, 0.1),
  couro: p => ruidoPixel(p, 'couro', 0.05, 0.12),
  metal: p => ruidoPixel(p, 'metal', 0.07, 0.06),
  liso: p => ruidoPixel(p, 'liso', 0.025, 0.025),
  vidro: p => ladrilhar(p, ladrilho(chaveDe(p, 'vidro'), 9, 9, [p.t.C, p.t.c1], idx => { for (let k = 0; k < 9; k++) { idx[k * 9 + ((9 - k) % 9)] = 0; if (k < 4) idx[k * 9 + ((8 - k) % 9)] = 1; } })),
  pregas: p => ladrilhar(p, ladrilho(chaveDe(p, 'pregas'), 4, 1, [p.t.E, p.t.B, p.t.C], idx => { idx[0] = 0; idx[1] = 1; idx[2] = 2; idx[3] = 1; })),
  pintura: p => { const { area: a, px } = p; ret(p, a.x, a.y, a.w, a.h * 0.55, '#3a4a5a'); ret(p, a.x, a.y + a.h * 0.55, a.w, a.h * 0.45, '#1d2a1f'); ret(p, a.x, a.y + a.h * 0.55 - px, a.w, px, '#8a7a5a'); },
  persa,
  grama: p => ladrilhar(p, ladrilho(chaveDe(p, 'grama'), 64, 64, [p.t.c1, p.t.e1, p.t.C, p.t.E], (idx, w, h, r) => { manchar(idx, w, h, r, 1, 150, 1, 2); manchar(idx, w, h, r, 0, 110, 1, 2); manchar(idx, w, h, r, 3, 25, 1, 1); })),
  terra: p => ruidoPixel(p, 'terra', 0.1, 0.12, true),
  lama: p => ruidoPixel(p, 'lama', 0.06, 0.16, true),
  areia: p => ruidoPixel(p, 'areia', 0.09, 0.07),
  neve: p => ruidoPixel(p, 'neve', 0.03, 0.05),
  pedra: p => ladrilhar(p, ladrilho(chaveDe(p, 'pedra'), 64, 64, [p.t.c2, p.t.e1, p.t.E], (idx, w, h, r) => {
    for (let i = 0; i < 70; i++) { const x = Math.floor(r() * w), y = Math.floor(r() * h), bw = 2 + Math.floor(r() * 2); for (let k = 0; k < bw; k++) { idx[(y % h) * w + ((x + k) % w)] = r() < 0.5 ? 0 : 1; idx[((y + 1) % h) * w + ((x + k) % w)] = 2; } }
  })),
  espinha: p => ladrilhar(p, ladrilho(chaveDe(p, 'espinha'), 24, 24, [p.t.B, p.t.c1, p.t.c2, p.t.e1], idx => {
    const m = (v: number, n: number) => ((v % n) + n) % n;
    for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) {
      const j = Math.floor(m(x - y, 24) / 6), fatia = j % 2 === 0 ? m(x + y, 24) : m(x - y, 24), banda = Math.floor(fatia / 3);
      idx[y * 24 + x] = fatia % 3 === 0 ? 3 : (banda * 7 + j * 5) % 3;
    }
  })),
  marmore: p => {
    const l = Math.max(4, Math.round((p.m.lado ?? 0.8) * p.res)) * p.px;
    for (let y = Math.floor(p.A.y / l) * l; y < p.A.y + p.A.h; y += l) for (let x = Math.floor(p.A.x / l) * l; x < p.A.x + p.A.w; x += l) {
      ret(p, x, y, l, l, p.r() < 0.5 ? p.t.B : p.t.c1);
      let vx = x + Math.floor(p.r() * (l / p.px)) * p.px; for (let k = 0; k < Math.round(l / p.px); k++) { ret(p, vx, y + k * p.px, p.px, p.px, p.t.c2); vx += (p.r() < 0.5 ? -1 : 1) * p.px * (p.r() < 0.4 ? 1 : 0); }
      ret(p, x, y, l, p.px, p.t.e1); ret(p, x, y, p.px, l, p.t.e1);
    }
  },
  losango: p => {
    const s = Math.max(2, Math.round(((p.m.lado ?? 0.5) * p.res) / 1.414));
    ladrilhar(p, ladrilho(chaveDe(p, `losango${s}`), 2 * s, 2 * s, [p.t.E, p.t.C], (idx, w, h) => {
      const m = (v: number, n: number) => ((v % n) + n) % n;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) idx[y * w + x] = (Math.floor(m(x + y, w) / s) + Math.floor(m(x - y, w) / s)) % 2;
    }));
  },
  hexagono: p => {
    const R = p.m.lado ?? 0.2, w = Math.max(3, Math.round(R * 1.732 * p.res)), h = Math.max(3, Math.round(R * 1.5 * p.res)), cw = w * p.px, ch = h * p.px;
    for (let y = Math.floor(p.A.y / ch) * ch, j = 0; y < p.A.y + p.A.h; y += ch, j++) for (let x = Math.floor(p.A.x / cw) * cw - (j % 2 ? cw / 2 : 0); x < p.A.x + p.A.w; x += cw) ret(p, x, y, cw, ch, [p.t.B, p.t.c1, p.t.e1][Math.floor(p.r() * 3)]!);
  },
  lambri: p => {
    const w = Math.max(5, Math.round(0.62 * p.res)) * p.px, h = Math.max(8, Math.round(1.1 * p.res)) * p.px, gap = p.px;
    for (let x = Math.floor(p.A.x / (w + gap)) * (w + gap); x < p.A.x + p.A.w; x += w + gap) for (let y = Math.floor(p.A.y / (h + gap)) * (h + gap); y < p.A.y + p.A.h; y += h + gap) {
      ret(p, x, y, w, h, p.r() < 0.5 ? p.t.B : p.t.c1);
      ret(p, x + p.px, y + p.px, w - 2 * p.px, p.px, p.t.e1); ret(p, x + p.px, y + h - 2 * p.px, w - 2 * p.px, p.px, p.t.e1); ret(p, x + p.px, y + p.px, p.px, h - 2 * p.px, p.t.e1); ret(p, x + w - 2 * p.px, y + p.px, p.px, h - 2 * p.px, p.t.e1);
    }
    for (let y = Math.floor(p.A.y / (h + gap)) * (h + gap); y < p.A.y + p.A.h; y += h + gap) ret(p, p.A.x, y + h, p.A.w, gap, p.t.E);
  },
};

/** Os padrões que o estilo Pixel sabe pintar (todos os `Padrao`; o teste confere contra o catálogo). */
export const PADROES_PIXEL = Object.keys(PINTORES) as Padrao[];

/**
 * Pinta o material em `area` (contexto em metros, já recortado) como pixel art: base chapada e dois ou três tons em blocos de 1 a 3 pixels.
 * `res` = pixels por metro; `dir` gira o padrão, em múltiplos de 90° (girar menos borraria os pixels).
 */
export function pintarMaterialPixel(ctx: Contexto, id: string, area: Area, seed = 1, { dir = 0, res }: { dir?: number; res?: number } = {}): void {
  const m = materialDe(id), t = ctx.getTransform(), r = res ?? Math.hypot(t.a, t.b), px = 1 / r;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const g0 = gradeDe(ctx), base: P = { ctx, area, A: area, m, t: tonsDe(m), r: mulberry32(seed * 7919 + 13), seed, g: g0, px, res: r };
  ret(base, area.x, area.y, area.w, area.h, m.base);
  const quarto = Math.round(dir / (Math.PI / 2)) % 4;
  const cx = g0.sx(area.x + area.w / 2), cy = g0.sy(area.y + area.h / 2);
  if (quarto) { ctx.translate(cx, cy); ctx.rotate((quarto * Math.PI) / 2); ctx.translate(-cx, -cy); }
  const g = quarto ? gradeDe(ctx) : g0, diag = Math.hypot(area.w, area.h);
  const A: Area = { x: g.sx(cx - diag / 2), y: g.sy(cy - diag / 2), w: Math.ceil(diag * r) * px, h: Math.ceil(diag * r) * px };
  PINTORES[m.padrao]({ ...base, A, g });
  ctx.restore();
}
