import { facesDoContorno, type SegmentoDeContorno } from '../domain/geometria.ts';
import type { Parede, Ponto } from '../domain/mapa.ts';
import { PISO_NO_MAPA, alturaNoMapa, desenharAlturaDasPartes, parteEscreveEmissao } from './altura.ts';
import type { Contexto } from './canvas.ts';
import type { Descricao, Parte } from './descricao.ts';
import type { EstiloDeRaster } from './estilos/index.ts';
import { MATERIAIS, materialDe, tom } from './materiais.ts';
import { partesParaFace } from './raster.ts';

/** Razão entre a profundidade rebatida da face interna e a altura da parede (`0.24 × 3 m = 0.72 m`). */
export const PROJECAO = 0.24;
/** Achatamento do desenho do papel de parede na face (1 = tamanho real; a projeção da parede achata ~0,24). */
export const ACHATAMENTO_DO_PAPEL = 0.55;
/** Proporção da altura da face ocupada pelo rodapé (os 12% de baixo). */
export const PROPORCAO_RODAPE = 0.12;
/** Altura normalizada do piso no mapa de altura (0,5 = nível do chão, `z = 0`). */
export const ALTURA_BASE_PISO = PISO_NO_MAPA;
/** Ampliação de leitura dos objetos pendurados na face. */
export const AMPLIACAO_NA_FACE: readonly [number, number] = [1.2, 1.7];

export const profundidadeDaFace = (altura: number): number => altura * PROJECAO;

export interface ParedeDaSala {
  path: readonly Ponto[];
  height: number;
  material: string;
  kind: Parede['kind'];
}

export interface AberturaDaFace {
  tipo: 'door' | 'window' | 'arch' | 'secret';
  centro: Ponto;
  largura: number;
  material: string;
}

export interface ObjetoDaFace {
  receita: string;
  params: Record<string, unknown>;
  seed: number;
  centro: Ponto;
}

export interface VaoNaFace {
  u0: number;
  u1: number;
  altura: number;
  tipo: 'door' | 'arch';
}

export interface TrechoDeFace {
  segmento: SegmentoDeContorno;
  /** Trapézio da faixa em metros do mundo, com cantos em meia-esquadria. */
  quad: [Ponto, Ponto, Ponto, Ponto];
  /** Intervalo ao longo do segmento `[u0, u1]` (m) coberto por uma parede `wall`. */
  u0: number;
  u1: number;
  altura: number;
  prof: number;
  material: string;
  vaos: VaoNaFace[];
}

export interface OpcoesCalculoFaces {
  alturaPadrao: number;
  wallFace?: string | null;
  papel?: { material: string; seed: number } | null;
  aberturas?: readonly AberturaDaFace[];
}

const TOLERANCIA_PAREDE = 0.08;
const SOBREPOSICAO_MINIMA = 0.05;
const lerpPonto = (a: Ponto, b: Ponto, t: number): Ponto => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** Distância ao longo de um segmento do contorno onde um ponto cai, ou `null` fora dele. */
export function aoLongoDoSegmento(seg: SegmentoDeContorno, p: Ponto): number | null {
  const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], c = Math.hypot(dx, dy);
  if (c < 1e-6) return null;
  const u = ((p[0] - seg.a[0]) * dx + (p[1] - seg.a[1]) * dy) / c;
  const perp = Math.abs((p[0] - seg.a[0]) * (-dy / c) + (p[1] - seg.a[1]) * (dx / c));
  return perp <= TOLERANCIA_PAREDE && u >= -0.01 && u <= c + 0.01 ? Math.max(0, Math.min(c, u)) : null;
}

/** Resolve o material da face: `sala.wallFace`, senão `sala.wallpaper`, senão o material da parede ou reboco padrão. */
export function resolverMaterialDaFace(
  wallFace?: string | null,
  papel?: { material: string } | null,
  materialParede?: string | null,
): string {
  if (wallFace) return wallFace;
  if (papel?.material) return papel.material;
  if (materialParede && materialParede !== 'parede.topo' && MATERIAIS[materialParede]) return materialParede;
  return MATERIAIS['parede.reboco'] ? 'parede.reboco' : 'papel.liso-claro';
}

/**
 * Amplia as partes de um objeto de parede (já em coordenadas da face: x ao longo da parede, y de cima para baixo) em volta
 * do centro dele, sem passar da sanca (y 0,15) nem do rodapé.
 */
export function ampliarNaFace(partes: readonly Parte[], u: number, H: number): Parte[] {
  if (!partes.length) return [];
  let y0 = Infinity, y1 = -Infinity;
  for (const p of partes) {
    if (p.forma === 'poli') for (let i = 1; i < p.pts!.length; i += 2) { y0 = Math.min(y0, p.pts![i]!); y1 = Math.max(y1, p.pts![i]!); }
    else { y0 = Math.min(y0, p.y! - p.h! / 2); y1 = Math.max(y1, p.y! + p.h! / 2); }
  }
  const rodape = Math.max(0.2, H * PROPORCAO_RODAPE);
  const [sx, sy0] = AMPLIACAO_NA_FACE, cy = (y0 + y1) / 2, meia = (y1 - y0) / 2, limite = Math.min(cy - 0.15, H - rodape - cy);
  const sy = meia > 0 ? Math.max(1, Math.min(sy0, limite / meia)) : sy0;
  const X = (x: number) => u + (x - u) * sx, Y = (y: number) => cy + (y - cy) * sy;
  return partes.map(p => (p.forma === 'poli' ? { ...p, pts: p.pts!.map((v, i) => (i % 2 ? Y(v) : X(v))) } : { ...p, x: X(p.x!), y: Y(p.y!), w: p.w! * sx, h: p.h! * sy }));
}

/** Partes (u ao longo da parede, altura do chão para cima) que enfeitam uma abertura na face. */
export function partesDaAbertura(a: AberturaDaFace, u: number, H: number): Parte[] {
  const w = a.largura, mad = a.material || 'madeira.media';
  if (a.tipo === 'door') {
    const hVao = Math.min(H * 0.85, 2.16);
    return partesParaFace([
      { forma: 'ret', x: -w / 2 + 0.08, y: hVao / 2, w: 0.1, h: hVao, mat: mad, z: 0.1 },
      { forma: 'ret', x: w / 2 - 0.08, y: hVao / 2, w: 0.1, h: hVao, mat: mad, z: 0.1 },
      { forma: 'ret', x: 0, y: hVao + 0.02, w: w - 0.06, h: 0.1, mat: mad, z: 0.1 },
    ], u, H);
  }
  if (a.tipo === 'arch') {
    const hVao = Math.min(H * 0.85, 1.85);
    return partesParaFace([
      { forma: 'ret', x: -w / 2 + 0.06, y: hVao * 0.45, w: 0.09, h: hVao * 0.9, mat: 'pedra.aparelhada', z: 0.1 },
      { forma: 'ret', x: w / 2 - 0.06, y: hVao * 0.45, w: 0.09, h: hVao * 0.9, mat: 'pedra.aparelhada', z: 0.1 },
    ], u, H);
  }
  if (a.tipo === 'window') {
    const l = w, cortina = 'cortina.vinho';
    const cy = Math.min(H * 0.56, 1.55), hWin = Math.min(H * 0.46, 1.3);
    const hVidro = Math.max(0.25, hWin - 0.14);
    const yPeitoril = Math.max(0.18, cy - hWin / 2 - 0.03);
    return partesParaFace([
      { forma: 'ret', x: 0, y: cy, w: l * 0.82, h: hWin, mat: mad, z: 0.04 },
      { forma: 'ret', x: 0, y: cy, w: l * 0.68, h: hVidro, mat: 'vidro', z: 0.05, vidro: true },
      { forma: 'ret', x: 0, y: cy, w: 0.04, h: hVidro, mat: mad, z: 0.06 },
      { forma: 'ret', x: 0, y: cy, w: l * 0.68, h: 0.04, mat: mad, z: 0.06 },
      { forma: 'ret', x: -l * 0.4, y: cy, w: 0.2, h: hWin + 0.16, mat: cortina, z: 0.08 },
      { forma: 'ret', x: l * 0.4, y: cy, w: 0.2, h: hWin + 0.16, mat: cortina, z: 0.08 },
      { forma: 'ret', x: 0, y: yPeitoril, w: l * 0.92, h: 0.09, mat: 'madeira.escura', z: 0.09 },
    ], u, H);
  }
  return [];
}

function intervalosDeParedeNoSegmento(
  seg: SegmentoDeContorno,
  paredes: readonly ParedeDaSala[],
): { u0: number; u1: number; altura: number; material: string }[] {
  const dx = seg.b[0] - seg.a[0], dy = seg.b[1] - seg.a[1], comp = Math.hypot(dx, dy);
  if (comp < 1e-6) return [];
  const tx = dx / comp, ty = dy / comp;
  const brutos: { u0: number; u1: number; altura: number; material: string }[] = [];

  for (const w of paredes) {
    if (w.kind !== 'wall') continue;
    for (let i = 0; i + 1 < w.path.length; i++) {
      const p0 = w.path[i]!, p1 = w.path[i + 1]!;
      const perp0 = Math.abs((p0[0] - seg.a[0]) * (-ty) + (p0[1] - seg.a[1]) * tx);
      const perp1 = Math.abs((p1[0] - seg.a[0]) * (-ty) + (p1[1] - seg.a[1]) * tx);
      if (perp0 > TOLERANCIA_PAREDE || perp1 > TOLERANCIA_PAREDE) continue;
      const q0 = (p0[0] - seg.a[0]) * tx + (p0[1] - seg.a[1]) * ty;
      const q1 = (p1[0] - seg.a[0]) * tx + (p1[1] - seg.a[1]) * ty;
      const lo = Math.max(0, Math.min(q0, q1)), hi = Math.min(comp, Math.max(q0, q1));
      if (hi - lo >= SOBREPOSICAO_MINIMA) brutos.push({ u0: lo, u1: hi, altura: w.height, material: w.material });
    }
  }

  brutos.sort((a, b) => a.u0 - b.u0 || a.u1 - b.u1);
  const saida: { u0: number; u1: number; altura: number; material: string }[] = [];
  let cursor = 0;
  for (const iv of brutos) {
    const u0 = Math.max(cursor, iv.u0);
    if (iv.u1 - u0 < SOBREPOSICAO_MINIMA) continue;
    const ant = saida.at(-1);
    if (ant && Math.abs(ant.u1 - u0) < 1e-4 && ant.altura === iv.altura && ant.material === iv.material) {
      ant.u1 = iv.u1;
    } else {
      saida.push({ u0, u1: iv.u1, altura: iv.altura, material: iv.material });
    }
    cursor = iv.u1;
  }
  return saida;
}

/**
 * Calcula as faixas de face interna das paredes de um cômodo: apenas lados coincidentes com paredes `wall`
 * recebem faixa com largura `PROJECAO × altura`, cantos em meia-esquadria e vãos de portas/arcos.
 */
export function calcularFacesDasParedes(
  lacos: readonly SegmentoDeContorno[][],
  paredes: readonly ParedeDaSala[] | undefined,
  op: OpcoesCalculoFaces,
): TrechoDeFace[] {
  const saida: TrechoDeFace[] = [];
  const aberturas = op.aberturas ?? [];

  for (const laco of lacos) {
    const intervalosPorSeg = laco.map(s => {
      const comp = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      if (comp < 1e-6) return [];
      if (paredes === undefined) return [{ u0: 0, u1: comp, altura: op.alturaPadrao, material: 'parede.topo' }];
      return intervalosDeParedeNoSegmento(s, paredes);
    });
    const profs = intervalosPorSeg.map(ivs => (ivs.length ? profundidadeDaFace(Math.max(...ivs.map(x => x.altura))) : 0));
    const faces = facesDoContorno(laco, 0, (_n, _s, i) => profs[i]!);

    for (let i = 0; i < faces.length; i++) {
      const f = faces[i]!, s = f.segmento, ivs = intervalosPorSeg[i]!;
      if (!ivs.length) continue;
      const comp = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
      for (const iv of ivs) {
        const t0 = iv.u0 <= 1e-4 ? 0 : iv.u0 / comp;
        const t1 = iv.u1 >= comp - 1e-4 ? 1 : iv.u1 / comp;
        const quad: [Ponto, Ponto, Ponto, Ponto] = t0 === 0 && t1 === 1
          ? f.quad
          : [
              lerpPonto(f.quad[0], f.quad[1], t0),
              lerpPonto(f.quad[0], f.quad[1], t1),
              lerpPonto(f.quad[3], f.quad[2], t1),
              lerpPonto(f.quad[3], f.quad[2], t0),
            ];
        const vaos: VaoNaFace[] = [];
        for (const a of aberturas) {
          if (a.tipo !== 'door' && a.tipo !== 'arch') continue;
          const u = aoLongoDoSegmento(s, a.centro);
          if (u === null || u < iv.u0 - 0.01 || u > iv.u1 + 0.01) continue;
          const va0 = Math.max(iv.u0, u - a.largura / 2 + 0.08);
          const va1 = Math.min(iv.u1, u + a.largura / 2 - 0.08);
          const altVao = Math.min(iv.altura * 0.85, a.tipo === 'arch' ? 1.85 : 2.15);
          if (va1 - va0 > 0.02) vaos.push({ u0: va0, u1: va1, altura: altVao, tipo: a.tipo });
        }
        vaos.sort((a, b) => a.u0 - b.u0);
        saida.push({
          segmento: s,
          quad,
          u0: iv.u0,
          u1: iv.u1,
          altura: iv.altura,
          prof: profundidadeDaFace(iv.altura),
          material: resolverMaterialDaFace(op.wallFace, op.papel, iv.material),
          vaos,
        });
      }
    }
  }
  return saida;
}

function retangulo(ctx: Contexto, x0: number, y0: number, x1: number, y1: number): void {
  ctx.moveTo(x0, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.closePath();
}

/** Traça o caminho sólido da face em coordenadas `(u, y)` (`y = 0` topo, `y = H` pé), recortando vãos de porta/arco. */
function tracarSolidoSemVaos(ctx: Contexto, u0: number, u1: number, H: number, vaos: readonly VaoNaFace[]): void {
  ctx.beginPath();
  let cur = u0;
  for (const v of vaos) {
    if (v.u0 > cur + 1e-4) retangulo(ctx, cur, 0, v.u0, H);
    const yLintel = H - v.altura;
    if (yLintel > 0.02) {
      if (v.tipo === 'arch') {
        const r = (v.u1 - v.u0) / 2, yArc = Math.min(H, yLintel + r);
        ctx.moveTo(v.u0, 0); ctx.lineTo(v.u1, 0); ctx.lineTo(v.u1, yArc);
        ctx.arc((v.u0 + v.u1) / 2, yArc, r, 0, Math.PI, true);
        ctx.closePath();
      } else {
        retangulo(ctx, v.u0, 0, v.u1, yLintel);
      }
    }
    cur = Math.max(cur, v.u1);
  }
  if (u1 > cur + 1e-4) retangulo(ctx, cur, 0, u1, H);
}

/** Altura normalizada no topo da face, na mesma escala absoluta de `alturaNoMapa` (piso em 0,5, satura em +2 m = 1,0). */
export function alturaTopoDaFace(altura: number): number {
  return alturaNoMapa(Math.max(0, altura));
}

function desenharAberturaNaFace(ctx: Contexto, a: AberturaDaFace, u: number, H: number, res: number, estilo: EstiloDeRaster): void {
  const partes = partesDaAbertura(a, u, H);
  if (partes.length) estilo.desenharPartes(ctx, partes, { res, seed: 1, sombras: false });
  if (a.tipo === 'secret') {
    const w = a.largura;
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 0.01;
    ctx.strokeRect(u - w / 2, H - Math.min(H * 0.85, 2.1), w, Math.min(H * 0.85, 2.1));
  }
}

export interface OpcoesDesenhoFaces {
  res: number;
  origem: Ponto;
  estilo: EstiloDeRaster;
  papelSeed: number;
  aberturas: readonly AberturaDaFace[];
  objetos: readonly ObjetoDaFace[];
  descrever: (receita: string, seed: number, params: Record<string, unknown>) => Descricao;
}

/** Pinta as faces internas no canvas de cor (`ctx`) e a rampa de altura (`0.5` no pé até `altura/ALTURA_MAXIMA` no topo) em `actx`. */
export function desenharFacesDasParedes(
  ctx: Contexto,
  actx: Contexto | null,
  faces: readonly TrechoDeFace[],
  op: OpcoesDesenhoFaces,
): void {
  const { res, origem, estilo, papelSeed } = op;
  const corLam = materialDe('madeira.escura').base;

  for (const f of faces) {
    const s = f.segmento, H = f.altura, prof = f.prof, k = prof / H;
    const comp = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
    if (comp < 1e-6) continue;
    const dx = (s.b[0] - s.a[0]) / comp, dy = (s.b[1] - s.a[1]) / comp;
    const sementeDaFace = Math.round(s.a[0] * 13 + s.a[1] * 7);
    const wTrecho = f.u1 - f.u0;
    const rodapeH = H * PROPORCAO_RODAPE;

    // 1. Cor: face recortada em meia-esquadria + vãos de portas/arcos.
    ctx.save();
    ctx.setTransform(res, 0, 0, res, -origem[0] * res, -origem[1] * res);
    ctx.beginPath(); ctx.moveTo(f.quad[0][0], f.quad[0][1]); for (const q of f.quad.slice(1)) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.clip();
    ctx.transform(dx, dy, s.n[0] * k, s.n[1] * k, s.a[0], s.a[1]);

    ctx.save();
    if (f.vaos.length) { tracarSolidoSemVaos(ctx, f.u0, f.u1, H, f.vaos); ctx.clip(); }
    // O papel vai com achatamento suave (`ACHATAMENTO_DO_PAPEL`), não com o da projeção (`k`, ~0,2): achatado por inteiro, o
    // motivo do papel (damasco, listra, flor) virava uma linha e a face lia como uma faixa lisa.
    ctx.save();
    ctx.setTransform(res, 0, 0, res, -origem[0] * res, -origem[1] * res);
    ctx.transform(dx, dy, s.n[0] * ACHATAMENTO_DO_PAPEL, s.n[1] * ACHATAMENTO_DO_PAPEL, s.a[0], s.a[1]);
    estilo.pintarMaterial(ctx, f.material, { x: f.u0, y: 0, w: wTrecho, h: prof / ACHATAMENTO_DO_PAPEL + 0.05 }, papelSeed + sementeDaFace, { res });
    ctx.restore();
    // Rodapé (12% de baixo, mais escuro) e sanca no topo.
    ctx.fillStyle = tom(corLam, -0.22); ctx.fillRect(f.u0, H - rodapeH, wTrecho, rodapeH);
    ctx.fillStyle = tom(corLam, 0.22); ctx.fillRect(f.u0, H - rodapeH - 0.015, wTrecho, 0.025);
    ctx.fillStyle = '#e6dccb'; ctx.globalAlpha = 0.85; ctx.fillRect(f.u0, 0, wTrecho, 0.12); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(f.u0, 0.12, wTrecho, 0.03);
    // Degradê vertical de luz (mais escuro embaixo).
    const gr = ctx.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(0,0,0,0.18)'); gr.addColorStop(0.32, 'rgba(0,0,0,0.0)'); gr.addColorStop(0.88, 'rgba(0,0,0,0.08)'); gr.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = gr; ctx.fillRect(f.u0, 0, wTrecho, H);
    // Iluminação direcional conforme orientação da face.
    const luz = -(s.n[0] * -0.7071 + s.n[1] * -0.7071);
    ctx.fillStyle = luz > 0 ? `rgba(255,240,215,${(0.08 * luz).toFixed(3)})` : `rgba(0,0,0,${(-0.12 * luz).toFixed(3)})`;
    ctx.fillRect(f.u0, 0, wTrecho, H);
    ctx.restore();

    for (const a of op.aberturas) {
      const u = aoLongoDoSegmento(s, a.centro);
      if (u !== null && u >= f.u0 - 0.01 && u <= f.u1 + 0.01) desenharAberturaNaFace(ctx, a, u, H, res, estilo);
    }
    const emissivos: Parte[] = [];
    for (const o of op.objetos) {
      const u = aoLongoDoSegmento(s, o.centro);
      if (u === null || u < f.u0 - 0.01 || u > f.u1 + 0.01) continue;
      const d = op.descrever(o.receita, o.seed, o.params);
      if (d.tipo !== 'parede') continue;
      const partes = ampliarNaFace(partesParaFace(d.face, u, H), u, H);
      estilo.desenharPartes(ctx, partes, { res, seed: o.seed, sombras: false });
      for (const p of partes) if (parteEscreveEmissao(p)) emissivos.push(p);
    }
    ctx.restore();

    // 2. Mapa de altura: rampa do pé (0.5, altura do piso) até o topo (`altura/ALTURA_MAXIMA`), pulando os vãos de porta.
    if (actx) {
      actx.save();
      actx.setTransform(res, 0, 0, res, -origem[0] * res, -origem[1] * res);
      actx.beginPath(); actx.moveTo(f.quad[0][0], f.quad[0][1]); for (const q of f.quad.slice(1)) actx.lineTo(q[0], q[1]); actx.closePath(); actx.clip();
      actx.transform(dx, dy, s.n[0] * k, s.n[1] * k, s.a[0], s.a[1]);
      actx.save();
      if (f.vaos.length) { tracarSolidoSemVaos(actx, f.u0, f.u1, H, f.vaos); actx.clip(); }
      const cPe = Math.round(ALTURA_BASE_PISO * 255);
      const cTopo = Math.round(alturaTopoDaFace(H) * 255);
      const grAlt = actx.createLinearGradient(0, 0, 0, H);
      grAlt.addColorStop(0, `rgb(${cTopo},0,0)`);
      grAlt.addColorStop(1, `rgb(${cPe},0,0)`);
      actx.fillStyle = grAlt;
      actx.fillRect(f.u0, 0, wTrecho, H);
      actx.restore();
      if (emissivos.length) desenharAlturaDasPartes(actx, emissivos, { res });
      actx.restore();
    }
  }
}
