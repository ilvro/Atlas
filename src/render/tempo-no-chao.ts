import { ColorMatrixFilter, Container, Graphics, Sprite, Texture, type Renderer } from 'pixi.js';
import { decodificar } from '../domain/celulas.ts';
import { camadaDoObjeto } from '../domain/camadas.ts';
import { pontoNoPoligono } from '../domain/formas-de-comodo.ts';
import { comodoEm, indiceDeCelulas } from '../domain/geometria.ts';
import { FUNCOES_AO_AR_LIVRE } from '../domain/presets.ts';
import type { Comodo, MapaAtlas, Objeto, Ponto } from '../domain/mapa.ts';
import { ACERVO } from '../procedural/acervo.ts';
import { materialDe } from '../procedural/materiais.ts';
import { distanciaAMargem } from '../procedural/profundidade.ts';
import { fbm, hash2D, valueNoise2D } from '../procedural/ruido.ts';
import { criarCamadaEmTextura } from './camada-em-textura.ts';
import { resolucaoDe } from './entradas.ts';

const LIMIAR_NEVE = 0.2;
const LIMIAR_CHUVA = 0.3;
const DESLOCAMENTO_CHAPEU_Y = -0.05;
const TAGS_MOVEL_TEMPO = new Set(['banco', 'mesa', 'carroca', 'barril', 'caixote', 'caixa']);

export interface EntradaDeObjetoParaTempo {
  c: Container;
  sprite: Sprite | null;
  chaveTextura: string | null;
}

const normalizar = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const limitar = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const suave = (a: number, b: number, x: number): number => {
  const t = limitar((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hexRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Verdadeiro se o cômodo está exposto ao céu (sem material de telhado ou com função aberta). */
export function ehComodoAoArLivre(s: Pick<Comodo, 'roof' | 'function'>): boolean {
  return !s.roof.material || (s.function !== null && FUNCOES_AO_AR_LIVRE.has(s.function));
}

/** Verdadeiro se o objeto de piso está fora de cômodos cobertos e representa móvel de exterior que acumula neve. */
export function ehMovelAoArLivre(
  m: Pick<MapaAtlas, 'rooms' | 'grid'>,
  o: Objeto,
  indice: Map<number, string> = indiceDeCelulas(m),
): boolean {
  if (o.wall || o.elevation === 'underwater') return false;
  const idCel = comodoEm(m, o.position, indice);
  if (idCel && m.rooms[idCel] && !ehComodoAoArLivre(m.rooms[idCel]!)) return false;
  for (const s of Object.values(m.rooms)) {
    if (s.outline && !ehComodoAoArLivre(s) && pontoNoPoligono(o.position, s.outline)) return false;
  }
  const item = ACERVO.item(ACERVO.idDaFonte(o.source));
  if (!item) return false;
  for (const tag of item.tags) if (TAGS_MOVEL_TEMPO.has(normalizar(tag))) return true;
  const raizId = normalizar(item.id).split(/[.-]/)[0] ?? '';
  return TAGS_MOVEL_TEMPO.has(raizId);
}

interface CaixaSala {
  minX: number; minY: number; maxX: number; maxY: number;
  poligono: Ponto[] | null;
  celulasSet: Set<number> | null;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer4 = (x: number, y: number): number => (BAYER4[((y & 3) << 2) | (x & 3)]! + 0.5) / 16;

function geometriaDaSala(m: Pick<MapaAtlas, 'grid'>, s: Comodo): CaixaSala | null {
  if (s.outline && s.outline.length >= 3) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of s.outline) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
    return { minX, minY, maxX, maxY, poligono: s.outline, celulasSet: null };
  }
  const cels = decodificar(s.cells);
  if (!cels.length) return null;
  const t = m.grid.size, [ox, oy] = m.grid.offset;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const set = new Set<number>();
  for (const [cx, cy] of cels) {
    if (cx < x0) x0 = cx;
    if (cy < y0) y0 = cy;
    if (cx + 1 > x1) x1 = cx + 1;
    if (cy + 1 > y1) y1 = cy + 1;
    set.add(cy * 200_003 + cx);
  }
  return {
    minX: ox + x0 * t, minY: oy + y0 * t,
    maxX: ox + x1 * t, maxY: oy + y1 * t,
    poligono: null, celulasSet: set,
  };
}

function chaveDaSalaNoChao(m: MapaAtlas, s: Comodo, snow: number, rain: number): string {
  const px = m.style.renderer === 'pixel' ? `${m.style.pixel.pixelsPerCell}|${m.style.pixel.dither}` : 'ilus';
  const forma = s.outline ? JSON.stringify(s.outline) : s.cells;
  return `${s.id}|${m.grid.size}|${m.grid.offset.join(',')}|${m.style.renderer}|${px}|${snow.toFixed(2)}|${rain.toFixed(2)}|${forma}`;
}

function criarTexturaDePiso(
  m: MapaAtlas,
  s: Comodo,
  geom: CaixaSala,
  snow: number,
  rain: number,
): Texture | null {
  const pixel = m.style.renderer === 'pixel';
  const res = pixel ? m.style.pixel.pixelsPerCell / m.grid.size : Math.min(16, resolucaoDe(m, 'comodo'));
  const W = Math.max(1, Math.ceil((geom.maxX - geom.minX) * res));
  const H = Math.max(1, Math.ceil((geom.maxY - geom.minY) * res));
  const dentro = new Uint8Array(W * H);
  const t = m.grid.size, [ox, oy] = m.grid.offset;

  let temPixel = false;
  for (let py = 0; py < H; py++) {
    const wy = geom.minY + (py + 0.5) / res;
    const cy = Math.floor((wy - oy) / t);
    for (let px = 0; px < W; px++) {
      const wx = geom.minX + (px + 0.5) / res;
      const hit = geom.poligono
        ? pontoNoPoligono([wx, wy], geom.poligono)
        : geom.celulasSet!.has(cy * 200_003 + Math.floor((wx - ox) / t));
      if (hit) { dentro[py * W + px] = 1; temPixel = true; }
    }
  }
  if (!temPixel) return null;

  const dist = snow > LIMIAR_NEVE ? distanciaAMargem(dentro, W, H, res, 1.5) : null;
  const matNeve = materialDe('neve');
  const [bR, bG, bB] = hexRgb(matNeve.base), [cR, cG, cB] = hexRgb(matNeve.claro ?? matNeve.base);
  const rNeve = valueNoise2D(17 + s.id.length * 13), rBrilho = valueNoise2D(97 + s.id.length * 7);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H), d = img.data;

  for (let py = 0, i = 0; py < H; py++) {
    const wy = geom.minY + (py + 0.5) / res;
    for (let px = 0; px < W; px++, i++) {
      if (!dentro[i]) continue;
      const wx = geom.minX + (px + 0.5) / res;
      const idx = i * 4;

      if (snow > LIMIAR_NEVE && dist) {
        const dp = dist[i]!;
        const ruido = fbm(rNeve, wx * 1.4, wy * 1.4, 3);
        const encosto = Math.exp(-dp / 0.55) * 0.45;
        const bordaIrreg = suave(0.16, 0.44, (1 - Math.min(1, dp / 1.5)) * 0.42 + ruido * 0.78 + snow * 0.35);
        const alfaBruto = limitar(0.7 * snow * (0.72 + encosto + (ruido - 0.5) * 0.45) * bordaIrreg, 0, 0.94);
        const alfa = pixel ? (alfaBruto > bayer4(px, py) * 0.65 ? Math.min(1, 0.7 * snow) : 0) : alfaBruto;
        const mixClaro = suave(0.32, 0.78, ruido * 0.75 + encosto * 0.45 + (hash2D(px, py, 3) - 0.5) * 0.12);
        d[idx] = Math.round(bR + (cR - bR) * mixClaro);
        d[idx + 1] = Math.round(bG + (cG - bG) * mixClaro);
        d[idx + 2] = Math.round(bB + (cB - bB) * mixClaro);
        d[idx + 3] = Math.round(alfa * 255);
      } else if (rain > LIMIAR_CHUVA) {
        const brilho = fbm(rBrilho, wx * 2.2, wy * 2.2, 2);
        const escorregadio = pixel
          ? (brilho > 0.62 + bayer4(px, py) * 0.14 ? 0.08 : 0)
          : 0.08 * suave(0.6, 0.9, brilho);
        d[idx] = 236; d[idx + 1] = 246; d[idx + 2] = 255;
        d[idx + 3] = Math.round(escorregadio * 255);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = pixel ? 'nearest' : 'linear';
  return tex;
}

/**
 * Efeitos do clima no chão ao ar livre (neve acumulada e pisos molhados pela chuva)
 * e chapéu de neve sobre móveis em áreas abertas. Só recalcula quando clima, cômodos ou objetos mudam.
 */
/** Resolução (px/m) da textura dos chapéus de neve. */
const RES_DOS_CHAPEUS = 24;

export function criarTempoNoChao(renderer: Renderer) {
  const chao = new Container();
  // Os chapéus de neve usam filtro (silhueta branca): são desenhados numa textura própria em metros e a cena recebe só o sprite.
  const chapeus = new Container();
  const desenhoDosChapeus = Object.assign(new Container(), { sortableChildren: true });
  const camadaDosChapeus = criarCamadaEmTextura(renderer);
  chapeus.addChild(camadaDosChapeus.sprite);
  const chuvaEscuroG = new Graphics();
  const pisosC = new Container();
  chao.addChild(chuvaEscuroG, pisosC);

  const achatarBranco = new ColorMatrixFilter();
  achatarBranco.matrix = [
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 0, 1,
    0, 0, 0, 1, 0,
  ];

  const spritesDePiso = new Map<string, { chave: string; sprite: Sprite; tex: Texture }>();
  const caps = new Map<string, { chave: string; c: Container; rot: Container; mask: Graphics }>();
  let ligado = true;
  let ultimaChaveEscuro = '';

  function limparPisos(): void {
    ultimaChaveEscuro = '';
    chuvaEscuroG.clear();
    for (const [id, ent] of spritesDePiso) {
      ent.sprite.destroy();
      ent.tex.destroy(true);
      spritesDePiso.delete(id);
    }
  }

  function limparChapeus(): void {
    for (const [id, ent] of caps) {
      ent.c.destroy({ children: true });
      caps.delete(id);
    }
    camadaDosChapeus.sprite.visible = false;
  }

  function atualizarPisos(m: MapaAtlas): void {
    const snow = m.climate.weather.snow, rain = m.climate.weather.rain;
    const temNeve = snow > LIMIAR_NEVE, temChuva = rain > LIMIAR_CHUVA;
    if (!ligado || (!temNeve && !temChuva)) { limparPisos(); return; }

    const abertas = Object.values(m.rooms).filter(ehComodoAoArLivre);
    // Chuva sem neve espessa: escurece os pisos abertos em 15% abaixo do véu especular.
    const keyEscuro = temChuva
      ? `${rain.toFixed(2)}|${m.grid.size}|${m.grid.offset.join(',')}|${abertas.map(s => `${s.id}:${s.cells}:${s.outline?.length ?? 0}`).join(';')}`
      : '';
    if (keyEscuro !== ultimaChaveEscuro) {
      ultimaChaveEscuro = keyEscuro;
      chuvaEscuroG.clear();
      if (temChuva && abertas.length) {
        const t = m.grid.size, [ox, oy] = m.grid.offset;
        for (const s of abertas) {
          if (s.outline && s.outline.length >= 3) chuvaEscuroG.poly(s.outline.flat());
          else for (const [cx, cy] of decodificar(s.cells)) chuvaEscuroG.rect(ox + cx * t, oy + cy * t, t, t);
        }
        chuvaEscuroG.fill({ color: 0x000000, alpha: 0.15 });
      }
    }

    const ativos = new Set<string>();
    for (const s of abertas) {
      const geom = geometriaDaSala(m, s);
      if (!geom) continue;
      ativos.add(s.id);
      const chave = chaveDaSalaNoChao(m, s, snow, rain);
      const atual = spritesDePiso.get(s.id);
      if (atual && atual.chave === chave) continue;
      if (atual) { atual.sprite.destroy(); atual.tex.destroy(true); spritesDePiso.delete(s.id); }
      const tex = criarTexturaDePiso(m, s, geom, snow, rain);
      if (!tex) continue;
      const sprite = new Sprite(tex);
      sprite.position.set(geom.minX, geom.minY);
      sprite.width = geom.maxX - geom.minX;
      sprite.height = geom.maxY - geom.minY;
      pisosC.addChild(sprite);
      spritesDePiso.set(s.id, { chave, sprite, tex });
    }
    for (const [id, ent] of [...spritesDePiso]) {
      if (!ativos.has(id)) { ent.sprite.destroy(); ent.tex.destroy(true); spritesDePiso.delete(id); }
    }
  }

  function atualizarChapeus(m: MapaAtlas, objetos: Map<string, EntradaDeObjetoParaTempo>): void {
    const snow = m.climate.weather.snow;
    if (!ligado || snow <= LIMIAR_NEVE) { limparChapeus(); return; }

    const indice = indiceDeCelulas(m);
    const ativos = new Set<string>();
    for (const [id, ent] of objetos) {
      const o = m.props[id], sp = ent.sprite;
      if (!o || !sp || !ent.c.visible || !ehMovelAoArLivre(m, o, indice)) continue;
      ativos.add(id);
      const chave = `${ent.chaveTextura ?? ''}|${o.position[0]},${o.position[1]}|${o.rotation}|${o.scale}|${snow.toFixed(2)}`;
      const rec = caps.get(id);
      if (rec && rec.chave === chave) continue;
      if (rec) { rec.c.destroy({ children: true }); caps.delete(id); }

      const c = new Container();
      c.position.set(o.position[0], o.position[1] + DESLOCAMENTO_CHAPEU_Y);
      c.scale.set(o.scale);
      c.zIndex = camadaDoObjeto(o) + 0.01;
      c.alpha = 0.6 * snow;
      c.filters = [achatarBranco];

      const rot = new Container();
      rot.rotation = o.rotation;
      const copia = new Sprite(sp.texture);
      copia.position.copyFrom(sp.position);
      copia.scale.copyFrom(sp.scale);
      rot.addChild(copia);

      const [w, h] = ACERVO.pegadaDaFonte(o.source);
      const raio = Math.max(w, h) + 0.5;
      const mask = new Graphics().rect(-raio, -raio - 0.1, raio * 2, raio + 0.12).fill(0xffffff);
      rot.mask = mask;
      c.addChild(rot, mask);
      desenhoDosChapeus.addChild(c);
      caps.set(id, { chave, c, rot, mask });
    }
    for (const [id, rec] of [...caps]) {
      if (!ativos.has(id)) { rec.c.destroy({ children: true }); caps.delete(id); }
    }
    camadaDosChapeus.sprite.visible = caps.size > 0;
    if (caps.size > 0) camadaDosChapeus.renderizar(desenhoDosChapeus, m.bounds.width, m.bounds.height, RES_DOS_CHAPEUS);
  }

  return {
    chao,
    chapeus,
    atualizar(m: MapaAtlas, objetos: Map<string, EntradaDeObjetoParaTempo>): void {
      atualizarPisos(m);
      atualizarChapeus(m, objetos);
    },
    definirLigado(l: boolean, m: MapaAtlas | null, objetos: Map<string, EntradaDeObjetoParaTempo>): void {
      ligado = l;
      if (!ligado) { limparPisos(); limparChapeus(); return; }
      if (m) { atualizarPisos(m); atualizarChapeus(m, objetos); }
    },
    destruir(): void {
      limparPisos();
      limparChapeus();
      camadaDosChapeus.destruir();
      desenhoDosChapeus.destroy({ children: true });
    },
  };
}
