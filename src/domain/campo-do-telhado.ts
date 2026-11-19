import type { Edificio } from './edificios.ts';
import { pontoNoPoligono } from './formas-de-comodo.ts';
import type { FormaDeTelhado, MapaAtlas, Ponto } from './mapa.ts';
import {
  expandirContorno,
  ordemDoTrecho,
  retangulosDe,
  telhadoEfetivo,
  trechosDe,
  type FormaResolvida,
  type Ret,
  type Trecho,
} from './telhado-geometria.ts';

/** Altura absoluta da base do telhado (nível do beiral), em metros. */
export const ALTURA_BASE_TELHADO = 3;
/** Beiral padrão adicionado em torno de cada retângulo ou contorno, em metros. */
export const BEIRAL_PADRAO = 0.25;

const LARGURA_BEIRAL = 0.08;
const LIMIAR_RINCAO = 0.02;
const LIMIAR_AO_RINCAO = 0.25;
const RAIO_ARESTA = 0.06;
const ALTURA_PLANO = 0.05;
const ALTURA_PLATIBANDA = 0.2;
const LARGURA_PLATIBANDA_MAX = 0.14;
const EPS_GEO = 1e-6;

const RAD = Math.PI / 180;
const TAN_30 = Math.tan(30 * RAD);
const TAN_50 = Math.tan(50 * RAD);
const TAN_70 = Math.tan(70 * RAD);
const TAN_25 = Math.tan(25 * RAD);
const TAN_75 = Math.tan(75 * RAD);
const TAN_35 = Math.tan(35 * RAD);

const DIRS_ARESTA: readonly [number, number][] = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return [Math.cos(a) * RAIO_ARESTA, Math.sin(a) * RAIO_ARESTA];
});

export type PecaDoTelhado = 'agua' | 'cumeeira' | 'espigao' | 'rincao' | 'beiral' | 'plano';

export interface CaixaDoTelhado {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

export interface AmostraDoTelhado {
  /** Altura absoluta do telhado em metros (`ALTURA_BASE_TELHADO + h_r`). */
  h: number;
  /** Derivada parcial `∂h/∂x` em float (aponta na direção de subida / para dentro; a normal da água é `normalize(-gx, -gy, 1)`). */
  gx: number;
  /** Derivada parcial `∂h/∂y` em float (aponta na direção de subida / para dentro; a normal da água é `normalize(-gx, -gy, 1)`). */
  gy: number;
  /** Posição em metros ao longo da aresta de beiral mais próxima (contínua dentro da água). */
  u: number;
  /** Distância em metros ao beiral da água vencedora (`0` no beiral, cresce para a cumeeira). */
  v: number;
  /** Trecho vencedor neste ponto. */
  trecho: Trecho;
  /** Índice do trecho vencedor em `CampoDoTelhado.trechos`. */
  indiceTrecho: number;
  /** Classificação geométrica da peça do telhado neste ponto. */
  peca: PecaDoTelhado;
  /** Distância em metros até a borda externa (beiral) da peça vencedora. */
  distAresta: number;
  /** Diferença `h_1 - h_2` em metros até o segundo retângulo/trecho em rincão real, ou `Infinity` quando não há encontro próximo. */
  folgaRincao: number;
}

export type Amostra = AmostraDoTelhado;

export interface CampoDoTelhado {
  /** Caixa envolvente do telhado com beiral, em metros. */
  caixa: CaixaDoTelhado;
  /** Trechos do edifício que compõem o campo. */
  trechos: Trecho[];
  /** Beiral usado na construção do campo, em metros. */
  beiral: number;
  /** Altura máxima absoluta (`ALTURA_BASE_TELHADO + max h_r`) do edifício, em metros. */
  alturaMaxima: number;
  /** Amostra o campo no ponto `(x, y)` em metros; devolve `null` fora do telhado. */
  amostrar(x: number, y: number): AmostraDoTelhado | null;
}

interface BordasAbertas {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

interface PecaRet {
  tipo: 'ret';
  idx: number;
  trecho: Trecho;
  indiceTrecho: number;
  forma: FormaResolvida;
  ordem: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  k: number;
  k1: number;
  k2: number;
  scaleZ: number;
  horizontal: boolean;
  meioVao: number;
  aberta: BordasAbertas;
  maxH: number;
}

interface ArestaContorno {
  ax: number;
  ay: number;
  ex: number;
  ey: number;
  len: number;
  len2: number;
  nxIn: number;
  nyIn: number;
  perimInicio: number;
}

interface PecaContorno {
  tipo: 'contorno';
  idx: number;
  trecho: Trecho;
  indiceTrecho: number;
  forma: FormaResolvida;
  ordem: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  rBase: number;
  k: number;
  scaleZ: number;
  ext: Ponto[];
  arestas: ArestaContorno[];
  maxH: number;
}

type Peca = PecaRet | PecaContorno;

interface Aval {
  h: number;
  gx: number;
  gy: number;
  u: number;
  v: number;
  distAresta: number;
  plano: boolean;
  beiral: boolean;
}

interface RetBase {
  ret: Ret;
  trecho: Trecho;
  indiceTrecho: number;
  forma: FormaResolvida;
  ordem: number;
}

function criarAval(): Aval {
  return { h: 0, gx: 0, gy: 0, u: 0, v: 0, distAresta: 0, plano: false, beiral: false };
}

function copiarAval(dst: Aval, src: Aval): void {
  dst.h = src.h;
  dst.gx = src.gx;
  dst.gy = src.gy;
  dst.u = src.u;
  dst.v = src.v;
  dst.distAresta = src.distAresta;
  dst.plano = src.plano;
  dst.beiral = src.beiral;
}

function suportaExtensaoDeCumeeira(shape: FormaDeTelhado): boolean {
  return (
    shape === 'quatro-aguas' ||
    shape === 'duas-aguas' ||
    shape === 'mansarda' ||
    shape === 'holandes' ||
    shape === 'abobada' ||
    shape === 'pagode'
  );
}

function temCumeeiraCentral(shape: FormaDeTelhado): boolean {
  return suportaExtensaoDeCumeeira(shape) || shape === 'piramide';
}

function ehFormaDuasAguasEixo(shape: FormaDeTelhado): boolean {
  return shape === 'duas-aguas' || shape === 'holandes' || shape === 'abobada';
}

function ehFormaSuave(shape: FormaDeTelhado): boolean {
  return shape === 'cupula' || shape === 'bulbo' || shape === 'abobada';
}

function horizontalDe(forma: FormaResolvida, w: number, h: number): boolean {
  return forma.ridge === 'h' || (forma.ridge === 'auto' && w >= h);
}

function alturaDuasInclinacoes(d: number, meioVao: number, k1: number, k2: number): { h: number; dhdd: number } {
  const dQuebra = 0.4 * meioVao;
  if (d <= dQuebra) return { h: k1 * d, dhdd: k1 };
  return { h: k1 * dQuebra + k2 * (d - dQuebra), dhdd: k2 };
}

function perfilBulbo(s: number): { f: number; dfds: number } {
  const s2 = s * s;
  const om = Math.max(1 - s2, 0.0064);
  const g1 = Math.pow(Math.max(0, 1 - s2), 0.65);
  const dg1 = -1.3 * s * Math.pow(om, -0.35);
  const e = Math.exp(-6 * s2);
  const g2 = 0.55 * e * Math.max(0, 1 - s2);
  const dg2 = 0.55 * e * (-12 * s * Math.max(0, 1 - s2) - 2 * s);
  return { f: g1 + g2, dfds: dg1 + dg2 };
}

function estimarMaxHRet(forma: FormaResolvida, w: number, h: number, horizontal: boolean, meioVao: number): number {
  const k = forma.steep ? TAN_50 : TAN_30;
  const k1 = forma.steep ? TAN_75 : TAN_70;
  const k2 = forma.steep ? TAN_35 : TAN_25;
  const scaleZ = forma.steep ? 1.25 : 1.0;
  const r = Math.min(w, h) / 2;
  switch (forma.shape) {
    case 'plano':
      return ALTURA_PLATIBANDA;
    case 'quatro-aguas':
      return k * meioVao;
    case 'piramide':
    case 'cone':
      return k * r;
    case 'duas-aguas':
      return k * (horizontal ? h / 2 : w / 2);
    case 'uma-agua':
      return k * (forma.ridge === 'v' ? w : h);
    case 'mansarda':
      return alturaDuasInclinacoes(meioVao, meioVao, k1, k2).h;
    case 'holandes': {
      const mv = horizontal ? h / 2 : w / 2;
      return alturaDuasInclinacoes(mv, mv, k1, k2).h;
    }
    case 'cupula':
      return scaleZ * r;
    case 'bulbo':
      return (forma.steep ? 1.3 : 1.0) * r * 1.55;
    case 'abobada':
      return scaleZ * (horizontal ? h / 2 : w / 2);
    case 'pagode':
      return k * Math.pow(Math.max(0, meioVao), 1.6);
  }
}

function construirPecasRetangulares(bases: readonly RetBase[], beiral: number, inicioIdx: number): PecaRet[] {
  const pecas: PecaRet[] = [];

  for (let i = 0; i < bases.length; i++) {
    const b = bases[i]!;
    const [bx0, by0, bx1, by1] = b.ret;
    const bw = bx1 - bx0;
    const bh = by1 - by0;
    let x0 = bx0 - beiral;
    let y0 = by0 - beiral;
    let x1 = bx1 + beiral;
    let y1 = by1 + beiral;
    const aberta: BordasAbertas = { left: false, right: false, top: false, bottom: false };
    let forcarHorizontal: boolean | null = null;

    if (suportaExtensaoDeCumeeira(b.forma.shape)) {
      const querVertical = b.forma.ridge === 'v' || (b.forma.ridge === 'auto' && bw <= bh + EPS_GEO);
      const querHorizontal = b.forma.ridge === 'h' || (b.forma.ridge === 'auto' && bh <= bw + EPS_GEO);

      for (let j = 0; j < bases.length; j++) {
        if (i === j) continue;
        const a = bases[j]!;
        if (!temCumeeiraCentral(a.forma.shape)) continue;
        const [ax0, ay0, ax1, ay1] = a.ret;
        const aw = ax1 - ax0;
        const ah = ay1 - ay0;
        const aHoriz = horizontalDe(a.forma, aw + 2 * beiral, ah + 2 * beiral);
        const hMaxA = estimarMaxHRet(a.forma, aw + 2 * beiral, ah + 2 * beiral, aHoriz, Math.min(aw, ah) / 2 + beiral);

        // B encosta na borda superior ou inferior de A -> estende B em Y até a linha média de A.
        if (querVertical && bx0 >= ax0 - EPS_GEO && bx1 <= ax1 + EPS_GEO && bw < aw - EPS_GEO && bw <= ah + EPS_GEO) {
          if (ehFormaDuasAguasEixo(a.forma.shape) && !aHoriz) continue;
          const cyA = (ay0 + ay1) / 2;
          const hMaxB = estimarMaxHRet(b.forma, bw + 2 * beiral, bh + (ah / 2) + beiral, false, bw / 2 + beiral);
          if (hMaxB > hMaxA + EPS_GEO) continue;
          if (Math.abs(by0 - ay1) <= EPS_GEO && !aberta.top) {
            y0 = cyA;
            aberta.top = true;
            forcarHorizontal = false;
          } else if (Math.abs(by1 - ay0) <= EPS_GEO && !aberta.bottom) {
            y1 = cyA;
            aberta.bottom = true;
            forcarHorizontal = false;
          }
        }

        // B encosta na borda esquerda ou direita de A -> estende B em X até a linha média de A.
        if (querHorizontal && by0 >= ay0 - EPS_GEO && by1 <= ay1 + EPS_GEO && bh < ah - EPS_GEO && bh <= aw + EPS_GEO) {
          if (ehFormaDuasAguasEixo(a.forma.shape) && aHoriz) continue;
          const cxA = (ax0 + ax1) / 2;
          const hMaxB = estimarMaxHRet(b.forma, bw + (aw / 2) + beiral, bh + 2 * beiral, true, bh / 2 + beiral);
          if (hMaxB > hMaxA + EPS_GEO) continue;
          if (Math.abs(bx0 - ax1) <= EPS_GEO && !aberta.left) {
            x0 = cxA;
            aberta.left = true;
            forcarHorizontal = true;
          } else if (Math.abs(bx1 - ax0) <= EPS_GEO && !aberta.right) {
            x1 = cxA;
            aberta.right = true;
            forcarHorizontal = true;
          }
        }
      }
    }

    const w = x1 - x0;
    const h = y1 - y0;
    const horizontal = forcarHorizontal ?? horizontalDe(b.forma, w, h);
    const meioVao =
      aberta.top || aberta.bottom
        ? w / 2
        : aberta.left || aberta.right
          ? h / 2
          : Math.min(w, h) / 2;
    const k = b.forma.steep ? TAN_50 : TAN_30;
    const k1 = b.forma.steep ? TAN_75 : TAN_70;
    const k2 = b.forma.steep ? TAN_35 : TAN_25;
    const scaleZ = b.forma.shape === 'bulbo' ? (b.forma.steep ? 1.3 : 1.0) : (b.forma.steep ? 1.25 : 1.0);
    const maxH = estimarMaxHRet(b.forma, w, h, horizontal, meioVao);

    pecas.push({
      tipo: 'ret',
      idx: inicioIdx + pecas.length,
      trecho: b.trecho,
      indiceTrecho: b.indiceTrecho,
      forma: b.forma,
      ordem: b.ordem,
      x0,
      y0,
      x1,
      y1,
      w,
      h,
      cx: (x0 + x1) / 2,
      cy: (y0 + y1) / 2,
      k,
      k1,
      k2,
      scaleZ,
      horizontal,
      meioVao,
      aberta,
      maxH,
    });
  }

  return pecas;
}

function centroideDoPoligono(pts: readonly Ponto[]): Ponto {
  let a2 = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    const c = x0 * y1 - x1 * y0;
    a2 += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  if (Math.abs(a2) > 1e-9) return [cx / (3 * a2), cy / (3 * a2)];
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

function construirPecaContorno(
  trecho: Trecho,
  indiceTrecho: number,
  beiral: number,
  idx: number,
): PecaContorno | null {
  if (!trecho.outline || trecho.outline.length < 3) return null;
  const ext = expandirContorno(trecho.outline, beiral);
  if (ext.length < 3) return null;

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [px, py] of ext) {
    if (px < x0) x0 = px;
    if (py < y0) y0 = py;
    if (px > x1) x1 = px;
    if (py > y1) y1 = py;
  }

  const arestas: ArestaContorno[] = [];
  let perim = 0;
  for (let i = 0; i < ext.length; i++) {
    const a = ext[i]!;
    const b = ext[(i + 1) % ext.length]!;
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    // `expandirContorno` devolve polígono normalizado anti-horário (Y para baixo): `[ey/len, -ex/len]` aponta para dentro.
    arestas.push({
      ax: a[0],
      ay: a[1],
      ex,
      ey,
      len,
      len2: len * len,
      nxIn: ey / len,
      nyIn: -ex / len,
      perimInicio: perim,
    });
    perim += len;
  }
  if (arestas.length < 3) return null;

  const [cx, cy] = centroideDoPoligono(ext);
  let rSoma = 0;
  for (const ar of arestas) {
    const proj = Math.max(0, Math.min(1, ((cx - ar.ax) * ar.ex + (cy - ar.ay) * ar.ey) / ar.len2));
    const qx = ar.ax + proj * ar.ex;
    const qy = ar.ay + proj * ar.ey;
    rSoma += Math.hypot(cx - qx, cy - qy);
  }
  const rBase = Math.max(0.05, rSoma / arestas.length);
  const forma = telhadoEfetivo(trecho.roof);
  const k = forma.steep ? TAN_50 : TAN_30;
  const scaleZ = forma.shape === 'bulbo' ? (forma.steep ? 1.3 : 1.0) : (forma.steep ? 1.25 : 1.0);
  const maxH =
    forma.shape === 'plano'
      ? ALTURA_PLATIBANDA
      : forma.shape === 'cupula'
        ? scaleZ * rBase
        : forma.shape === 'bulbo'
          ? scaleZ * rBase * 1.55
          : k * rBase;

  return {
    tipo: 'contorno',
    idx,
    trecho,
    indiceTrecho,
    forma,
    ordem: ordemDoTrecho(trecho.roof),
    x0,
    y0,
    x1,
    y1,
    w: x1 - x0,
    h: y1 - y0,
    cx,
    cy,
    rBase,
    k,
    scaleZ,
    ext,
    arestas,
    maxH,
  };
}

function avaliarRet(p: PecaRet, x: number, y: number, out: Aval): boolean {
  if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return false;

  const dxL = x - p.x0;
  const dxR = p.x1 - x;
  const dyT = y - p.y0;
  const dyB = p.y1 - y;

  const eL = p.aberta.left ? Infinity : dxL;
  const eR = p.aberta.right ? Infinity : dxR;
  const eT = p.aberta.top ? Infinity : dyT;
  const eB = p.aberta.bottom ? Infinity : dyB;
  const distAresta = Math.max(0, Math.min(eL, eR, eT, eB));

  out.distAresta = distAresta;
  out.plano = false;
  out.beiral = distAresta <= LARGURA_BEIRAL;

  switch (p.forma.shape) {
    case 'plano': {
      const largPlat = Math.min(LARGURA_PLATIBANDA_MAX, p.w / 4, p.h / 4);
      const naPlat = distAresta <= largPlat;
      out.h = naPlat ? ALTURA_PLATIBANDA : ALTURA_PLANO;
      out.gx = 0;
      out.gy = 0;
      out.u = dxL;
      out.v = naPlat ? distAresta : dyT;
      out.beiral = naPlat;
      out.plano = !naPlat;
      return true;
    }

    case 'uma-agua': {
      if (p.forma.ridge === 'v') {
        out.h = p.k * dxR;
        out.gx = -p.k;
        out.gy = 0;
        out.u = dyT;
        out.v = dxR;
      } else {
        out.h = p.k * dyB;
        out.gx = 0;
        out.gy = -p.k;
        out.u = dxL;
        out.v = dyB;
      }
      return true;
    }

    case 'duas-aguas': {
      if (p.horizontal) {
        if (dyT <= dyB) {
          out.h = p.k * dyT;
          out.gx = 0;
          out.gy = p.k;
          out.u = dxL;
          out.v = dyT;
        } else {
          out.h = p.k * dyB;
          out.gx = 0;
          out.gy = -p.k;
          out.u = dxL;
          out.v = dyB;
        }
      } else {
        if (dxL <= dxR) {
          out.h = p.k * dxL;
          out.gx = p.k;
          out.gy = 0;
          out.u = dyT;
          out.v = dxL;
        } else {
          out.h = p.k * dxR;
          out.gx = -p.k;
          out.gy = 0;
          out.u = dyT;
          out.v = dxR;
        }
      }
      return true;
    }

    case 'quatro-aguas': {
      const dx = Math.min(eL, eR);
      const dy = Math.min(eT, eB);
      if (dy <= dx) {
        if (eT <= eB) {
          out.h = p.k * eT;
          out.gx = 0;
          out.gy = p.k;
          out.u = dxL;
          out.v = eT;
        } else {
          out.h = p.k * eB;
          out.gx = 0;
          out.gy = -p.k;
          out.u = dxL;
          out.v = eB;
        }
      } else {
        if (eL <= eR) {
          out.h = p.k * eL;
          out.gx = p.k;
          out.gy = 0;
          out.u = dyT;
          out.v = eL;
        } else {
          out.h = p.k * eR;
          out.gx = -p.k;
          out.gy = 0;
          out.u = dyT;
          out.v = eR;
        }
      }
      return true;
    }

    case 'piramide': {
      const hw = p.w / 2;
      const hh = p.h / 2;
      const hApice = p.k * Math.min(hw, hh);
      const tx = Math.min(dxL, dxR) / hw;
      const ty = Math.min(dyT, dyB) / hh;
      if (ty <= tx) {
        const s = hApice / hh;
        if (dyT <= dyB) {
          out.h = s * dyT;
          out.gx = 0;
          out.gy = s;
          out.u = dxL;
          out.v = dyT;
        } else {
          out.h = s * dyB;
          out.gx = 0;
          out.gy = -s;
          out.u = dxL;
          out.v = dyB;
        }
      } else {
        const s = hApice / hw;
        if (dxL <= dxR) {
          out.h = s * dxL;
          out.gx = s;
          out.gy = 0;
          out.u = dyT;
          out.v = dxL;
        } else {
          out.h = s * dxR;
          out.gx = -s;
          out.gy = 0;
          out.u = dyT;
          out.v = dxR;
        }
      }
      return true;
    }

    case 'mansarda': {
      const dx = Math.min(eL, eR);
      const dy = Math.min(eT, eB);
      const d = Math.min(dx, dy);
      const { h: hVal, dhdd } = alturaDuasInclinacoes(d, p.meioVao, p.k1, p.k2);
      out.h = hVal;
      if (dy <= dx) {
        if (eT <= eB) {
          out.gx = 0;
          out.gy = dhdd;
          out.u = dxL;
          out.v = eT;
        } else {
          out.gx = 0;
          out.gy = -dhdd;
          out.u = dxL;
          out.v = eB;
        }
      } else {
        if (eL <= eR) {
          out.gx = dhdd;
          out.gy = 0;
          out.u = dyT;
          out.v = eL;
        } else {
          out.gx = -dhdd;
          out.gy = 0;
          out.u = dyT;
          out.v = eR;
        }
      }
      return true;
    }

    case 'holandes': {
      if (p.horizontal) {
        const d = Math.min(dyT, dyB);
        const { h: hVal, dhdd } = alturaDuasInclinacoes(d, p.h / 2, p.k1, p.k2);
        out.h = hVal;
        out.gx = 0;
        out.gy = dyT <= dyB ? dhdd : -dhdd;
        out.u = dxL;
        out.v = d;
      } else {
        const d = Math.min(dxL, dxR);
        const { h: hVal, dhdd } = alturaDuasInclinacoes(d, p.w / 2, p.k1, p.k2);
        out.h = hVal;
        out.gx = dxL <= dxR ? dhdd : -dhdd;
        out.gy = 0;
        out.u = dyT;
        out.v = d;
      }
      return true;
    }

    case 'pagode': {
      const dx = Math.min(eL, eR);
      const dy = Math.min(eT, eB);
      const d = Math.max(0, Math.min(dx, dy));
      const hVal = p.k * Math.pow(d, 1.6);
      const dhdd = 1.6 * p.k * Math.pow(d, 0.6);
      out.h = hVal;
      if (dy <= dx) {
        if (eT <= eB) {
          out.gx = 0;
          out.gy = dhdd;
          out.u = dxL;
          out.v = eT;
        } else {
          out.gx = 0;
          out.gy = -dhdd;
          out.u = dxL;
          out.v = eB;
        }
      } else {
        if (eL <= eR) {
          out.gx = dhdd;
          out.gy = 0;
          out.u = dyT;
          out.v = eL;
        } else {
          out.gx = -dhdd;
          out.gy = 0;
          out.u = dyT;
          out.v = eR;
        }
      }
      return true;
    }

    case 'abobada': {
      if (p.horizontal) {
        const r = p.h / 2;
        const t = y - p.cy;
        const z = Math.sqrt(Math.max(0, r * r - t * t));
        const denom = Math.max(z, r * 0.08);
        out.h = p.scaleZ * z;
        out.gx = 0;
        out.gy = (-p.scaleZ * t) / denom;
        out.u = dxL;
        out.v = Math.min(dyT, dyB);
      } else {
        const r = p.w / 2;
        const t = x - p.cx;
        const z = Math.sqrt(Math.max(0, r * r - t * t));
        const denom = Math.max(z, r * 0.08);
        out.h = p.scaleZ * z;
        out.gx = (-p.scaleZ * t) / denom;
        out.gy = 0;
        out.u = dyT;
        out.v = Math.min(dxL, dxR);
      }
      return true;
    }

    case 'cupula': {
      const r = Math.min(p.w, p.h) / 2;
      const px = x - p.cx;
      const py = y - p.cy;
      const rho = Math.hypot(px, py);
      if (rho < r) {
        const z = Math.sqrt(Math.max(0, r * r - rho * rho));
        const denom = Math.max(z, r * 0.08);
        out.h = p.scaleZ * z;
        out.gx = (-p.scaleZ * px) / denom;
        out.gy = (-p.scaleZ * py) / denom;
        out.u = (Math.atan2(py, px) + Math.PI) * r;
        out.v = r - rho;
      } else {
        out.h = 0;
        out.gx = 0;
        out.gy = 0;
        out.u = dxL;
        out.v = distAresta;
        out.plano = !out.beiral;
      }
      return true;
    }

    case 'bulbo': {
      const r = Math.min(p.w, p.h) / 2;
      const px = x - p.cx;
      const py = y - p.cy;
      const rho = Math.hypot(px, py);
      if (rho < r) {
        const s = rho / r;
        const { f, dfds } = perfilBulbo(s);
        const dhdrho = p.scaleZ * dfds;
        out.h = p.scaleZ * r * f;
        if (rho > EPS_GEO) {
          out.gx = (dhdrho * px) / rho;
          out.gy = (dhdrho * py) / rho;
        } else {
          out.gx = 0;
          out.gy = 0;
        }
        out.u = (Math.atan2(py, px) + Math.PI) * r;
        out.v = r - rho;
      } else {
        out.h = 0;
        out.gx = 0;
        out.gy = 0;
        out.u = dxL;
        out.v = distAresta;
        out.plano = !out.beiral;
      }
      return true;
    }

    case 'cone': {
      const r = Math.min(p.w, p.h) / 2;
      const px = x - p.cx;
      const py = y - p.cy;
      const rho = Math.hypot(px, py);
      if (rho < r) {
        out.h = p.k * (r - rho);
        if (rho > EPS_GEO) {
          out.gx = (-p.k * px) / rho;
          out.gy = (-p.k * py) / rho;
        } else {
          out.gx = 0;
          out.gy = 0;
        }
        out.u = (Math.atan2(py, px) + Math.PI) * r;
        out.v = r - rho;
      } else {
        out.h = 0;
        out.gx = 0;
        out.gy = 0;
        out.u = dxL;
        out.v = distAresta;
        out.plano = !out.beiral;
      }
      return true;
    }
  }
}

function avaliarContorno(p: PecaContorno, x: number, y: number, out: Aval): boolean {
  if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) return false;
  if (!pontoNoPoligono([x, y], p.ext)) return false;

  let melhorDist = Infinity;
  let melhorQx = x;
  let melhorQy = y;
  let melhorU = 0;
  let melhorAresta = p.arestas[0]!;

  for (let i = 0; i < p.arestas.length; i++) {
    const ar = p.arestas[i]!;
    const proj = Math.max(0, Math.min(1, ((x - ar.ax) * ar.ex + (y - ar.ay) * ar.ey) / ar.len2));
    const qx = ar.ax + proj * ar.ex;
    const qy = ar.ay + proj * ar.ey;
    const d = Math.hypot(x - qx, y - qy);
    if (d < melhorDist) {
      melhorDist = d;
      melhorQx = qx;
      melhorQy = qy;
      melhorU = ar.perimInicio + proj * ar.len;
      melhorAresta = ar;
    }
  }

  out.distAresta = melhorDist;
  out.u = melhorU;
  out.v = melhorDist;
  out.plano = false;
  out.beiral = melhorDist <= LARGURA_BEIRAL;

  if (p.forma.shape === 'plano') {
    const largPlat = Math.min(LARGURA_PLATIBANDA_MAX, p.w / 4, p.h / 4);
    const naPlat = melhorDist <= largPlat;
    out.h = naPlat ? ALTURA_PLATIBANDA : ALTURA_PLANO;
    out.gx = 0;
    out.gy = 0;
    out.beiral = naPlat;
    out.plano = !naPlat;
    return true;
  }

  if (p.forma.shape === 'cupula' || p.forma.shape === 'bulbo') {
    const px = x - p.cx;
    const py = y - p.cy;
    const rho = Math.hypot(px, py);
    const rEff = Math.max(rho + melhorDist, EPS_GEO);
    const s = Math.min(1, rho / rEff);
    if (p.forma.shape === 'cupula') {
      const z = Math.sqrt(Math.max(0, 1 - s * s));
      const denom = Math.max(z, 0.08);
      out.h = p.scaleZ * p.rBase * z;
      if (rho > EPS_GEO) {
        const mag = (-p.scaleZ * (p.rBase / rEff) * s) / denom;
        out.gx = (mag * px) / rho;
        out.gy = (mag * py) / rho;
      } else {
        out.gx = 0;
        out.gy = 0;
      }
    } else {
      const { f, dfds } = perfilBulbo(s);
      out.h = p.scaleZ * p.rBase * f;
      if (rho > EPS_GEO) {
        const mag = p.scaleZ * (p.rBase / rEff) * dfds;
        out.gx = (mag * px) / rho;
        out.gy = (mag * py) / rho;
      } else {
        out.gx = 0;
        out.gy = 0;
      }
    }
    return true;
  }

  // Cone e demais formas inclinadas em contorno livre: `k * distAresta`.
  out.h = p.k * melhorDist;
  if (melhorDist > EPS_GEO) {
    out.gx = (p.k * (x - melhorQx)) / melhorDist;
    out.gy = (p.k * (y - melhorQy)) / melhorDist;
  } else {
    out.gx = p.k * melhorAresta.nxIn;
    out.gy = p.k * melhorAresta.nyIn;
  }
  return true;
}

function avaliarPeca(p: Peca, x: number, y: number, out: Aval): boolean {
  return p.tipo === 'ret' ? avaliarRet(p, x, y, out) : avaliarContorno(p, x, y, out);
}

function gradientesDistintos(gx1: number, gy1: number, gx2: number, gy2: number): boolean {
  const l1 = Math.hypot(gx1, gy1);
  const l2 = Math.hypot(gx2, gy2);
  if (l1 <= 0.05 && l2 <= 0.05) return false;
  if (l1 <= 0.05 || l2 <= 0.05) return true;
  const cos = (gx1 * gx2 + gy1 * gy2) / (l1 * l2);
  return cos < 0.85;
}

/**
 * Analisa o cruzamento entre `melhor` e `segunda` nas duas direções perpendiculares ao encontro
 * (`±(grad2 - grad1)`):
 * - `'rincao'`: `segunda` vence em `+u` e `melhor` vence em `-u` (encontro real de duas águas).
 * - `'segunda-domina'`: empate numérico em `(x, y)` onde `segunda` domina em `+u` e `melhor` nunca vence em `-u` (`melhor` está enterrada).
 * - `'nenhum'`: superfícies coplanares ou `segunda` fica enterrada sem cruzar `melhor`.
 */
function analisarEncontro(
  melhor: Peca,
  segunda: Peca,
  av1: Aval,
  av2: Aval,
  x: number,
  y: number,
  tmp1: Aval,
  tmp2: Aval,
): 'rincao' | 'segunda-domina' | 'nenhum' {
  if (!gradientesDistintos(av1.gx, av1.gy, av2.gx, av2.gy)) return 'nenhum';
  const dgx = av2.gx - av1.gx;
  const dgy = av2.gy - av1.gy;
  const dLen = Math.hypot(dgx, dgy);
  if (dLen < 0.05) return 'nenhum';
  const ux = dgx / dLen;
  const uy = dgy / dLen;
  const diff = Math.max(0, av1.h - av2.h);
  const passoMais = Math.min(0.35, diff / Math.max(dLen, 0.2) + 0.04);
  const passoMenos = 0.04;

  const px1 = x + ux * passoMais;
  const py1 = y + uy * passoMais;
  const segundaVenceMais =
    avaliarPeca(segunda, px1, py1, tmp2) && (!avaliarPeca(melhor, px1, py1, tmp1) || tmp2.h > tmp1.h + 1e-4);
  if (!segundaVenceMais) return 'nenhum';

  const px2 = x - ux * passoMenos;
  const py2 = y - uy * passoMenos;
  const melhorVenceMenos =
    avaliarPeca(melhor, px2, py2, tmp1) && (!avaliarPeca(segunda, px2, py2, tmp2) || tmp1.h > tmp2.h + 1e-4);
  if (melhorVenceMenos) return 'rincao';
  return diff <= 1e-5 ? 'segunda-domina' : 'nenhum';
}

function detectarCumeeiraOuEspigao(
  p: Peca,
  pecas: readonly Peca[],
  av: Aval,
  x: number,
  y: number,
  tmp: Aval,
  tmpOutro: Aval,
): 'cumeeira' | 'espigao' | null {
  if (ehFormaSuave(p.forma.shape) || p.forma.shape === 'plano' || p.forma.shape === 'uma-agua') {
    return null;
  }
  const l0 = Math.hypot(av.gx, av.gy);
  if (l0 <= 0.15) return null;
  const nx0 = av.gx / l0;
  const ny0 = av.gy / l0;
  const multi = pecas.length > 1;

  let minDot = 1;
  for (let i = 0; i < DIRS_ARESTA.length; i++) {
    const [dx, dy] = DIRS_ARESTA[i]!;
    const nx = x + dx;
    const ny = y + dy;
    if (!avaliarPeca(p, nx, ny, tmp)) continue;
    if (multi) {
      let coberta = false;
      for (let j = 0; j < pecas.length; j++) {
        const outra = pecas[j]!;
        if (outra === p) continue;
        if (avaliarPeca(outra, nx, ny, tmpOutro) && tmpOutro.h > tmp.h + 1e-4) {
          coberta = true;
          break;
        }
      }
      if (coberta) continue;
    }
    const l = Math.hypot(tmp.gx, tmp.gy);
    if (l <= 0.15) continue;
    const dot = (nx0 * tmp.gx + ny0 * tmp.gy) / l;
    if (dot < minDot) minDot = dot;
  }

  if (minDot >= 0.7) return null;
  if (p.forma.shape === 'piramide' || p.forma.shape === 'cone') return 'espigao';
  return minDot < -0.5 ? 'cumeeira' : 'espigao';
}

/** Constrói o campo de altura diretamente a partir de trechos já resolvidos e da grade do mapa. */
export function campoDosTrechos(
  trechosEntrada: readonly Trecho[],
  grade: Pick<MapaAtlas['grid'], 'size' | 'offset'>,
  beiral = BEIRAL_PADRAO,
): CampoDoTelhado {
  const trechos = [...trechosEntrada];
  const bases: RetBase[] = [];
  const pecasContorno: PecaContorno[] = [];
  const t = grade.size;
  const [ox, oy] = grade.offset;

  for (let i = 0; i < trechos.length; i++) {
    const trecho = trechos[i]!;
    if (trecho.outline && trecho.outline.length >= 3) {
      const pc = construirPecaContorno(trecho, i, beiral, 0);
      if (pc) pecasContorno.push(pc);
      continue;
    }
    const forma = telhadoEfetivo(trecho.roof);
    const ordem = ordemDoTrecho(trecho.roof);
    for (const [cx0, cy0, cx1, cy1] of retangulosDe(trecho.celulas)) {
      bases.push({
        ret: [ox + cx0 * t, oy + cy0 * t, ox + cx1 * t, oy + cy1 * t],
        trecho,
        indiceTrecho: i,
        forma,
        ordem,
      });
    }
  }

  const pecasRet = construirPecasRetangulares(bases, beiral, 0);
  for (let i = 0; i < pecasContorno.length; i++) {
    pecasContorno[i]!.idx = pecasRet.length + i;
  }
  const pecas: Peca[] = [...pecasRet, ...pecasContorno];

  if (!pecas.length) {
    return {
      caixa: { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 },
      trechos,
      beiral,
      alturaMaxima: ALTURA_BASE_TELHADO,
      amostrar: () => null,
    };
  }

  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  let maxH = 0;
  for (const p of pecas) {
    if (p.x0 < x0) x0 = p.x0;
    if (p.y0 < y0) y0 = p.y0;
    if (p.x1 > x1) x1 = p.x1;
    if (p.y1 > y1) y1 = p.y1;
    if (p.maxH > maxH) maxH = p.maxH;
  }

  const caixa: CaixaDoTelhado = { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
  const alturaMaxima = ALTURA_BASE_TELHADO + maxH;

  // Buffers reutilizáveis fora da alocação por amostra (uso síncrono).
  const atual = criarAval();
  const melhorAv = criarAval();
  const segundaAv = criarAval();
  const tmp1 = criarAval();
  const tmp2 = criarAval();

  function amostrar(x: number, y: number): AmostraDoTelhado | null {
    if (x < x0 || x > x1 || y < y0 || y > y1) return null;

    let melhor: Peca | null = null;
    let segunda: Peca | null = null;

    for (let i = 0; i < pecas.length; i++) {
      const p = pecas[i]!;
      if (!avaliarPeca(p, x, y, atual)) continue;

      if (
        !melhor ||
        atual.h > melhorAv.h + 1e-9 ||
        (Math.abs(atual.h - melhorAv.h) <= 1e-9 && p.ordem > melhor.ordem)
      ) {
        if (melhor) {
          segunda = melhor;
          copiarAval(segundaAv, melhorAv);
        }
        melhor = p;
        copiarAval(melhorAv, atual);
      } else if (!segunda || atual.h > segundaAv.h + 1e-9) {
        segunda = p;
        copiarAval(segundaAv, atual);
      }
    }

    if (!melhor) return null;

    let folgaRincao = Infinity;
    let emRincao = false;
    if (segunda) {
      const diff = melhorAv.h - segundaAv.h;
      if (diff < LIMIAR_AO_RINCAO) {
        const encontro = analisarEncontro(melhor, segunda, melhorAv, segundaAv, x, y, tmp1, tmp2);
        if (encontro === 'rincao') {
          folgaRincao = diff;
          if (diff < LIMIAR_RINCAO) emRincao = true;
        } else if (encontro === 'segunda-domina') {
          const prevMelhor = melhor;
          melhor = segunda;
          segunda = prevMelhor;
          copiarAval(tmp1, melhorAv);
          copiarAval(melhorAv, segundaAv);
          copiarAval(segundaAv, tmp1);
        }
      }
    }

    let peca: PecaDoTelhado;
    if (melhorAv.beiral) {
      peca = 'beiral';
    } else if (emRincao) {
      peca = 'rincao';
    } else if (melhorAv.plano) {
      peca = 'plano';
    } else {
      peca = detectarCumeeiraOuEspigao(melhor, pecas, melhorAv, x, y, tmp1, tmp2) ?? 'agua';
    }

    return {
      h: ALTURA_BASE_TELHADO + melhorAv.h,
      gx: melhorAv.gx,
      gy: melhorAv.gy,
      u: melhorAv.u,
      v: melhorAv.v,
      trecho: melhor.trecho,
      indiceTrecho: melhor.indiceTrecho,
      peca,
      distAresta: melhorAv.distAresta,
      folgaRincao,
    };
  }

  return { caixa, trechos, beiral, alturaMaxima, amostrar };
}

/** Constrói o campo de altura do telhado de um edifício inteiro, em metros. */
export function campoDoEdificio(
  m: Pick<MapaAtlas, 'rooms' | 'grid'>,
  ed: Edificio,
  beiral = BEIRAL_PADRAO,
): CampoDoTelhado {
  return campoDosTrechos(trechosDe(m, ed), m.grid, beiral);
}
