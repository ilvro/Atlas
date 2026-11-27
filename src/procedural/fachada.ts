import type { CampoDoTelhado } from '../domain/campo-do-telhado.ts';
import type { Ponto } from '../domain/mapa.ts';
import type { EntradaDoTelhado, ParedeExternaDoTelhado } from './assar-telhado.ts';
import { contextoDe, criarTela, type Contexto, type Tela } from './canvas.ts';
import type { EstiloDeRaster } from './estilos/index.ts';
import { ACHATAMENTO_DO_PAPEL } from './faces-de-parede.ts';
import { MATERIAIS, materialDe, tom } from './materiais.ts';

/** Altura visível da fachada frontal (+y) abaixo do beiral, em metros. */
export const ALTURA_DA_FACHADA = 0.9;

const ALTURA_SOMBRA_BASE = 0.18;
const ALTURA_SOMBRA_BEIRAL = 0.22;
const ALTURA_RODAPE = 0.14;
const LIMIAR_NORMAL_FRONTAL = 0.35;
const TOLERANCIA_ABERTURA = 0.12;

type AberturaExterna = ParedeExternaDoTelhado['aberturas'][number];

interface TrechoFrontal {
  a: Ponto;
  b: Ponto;
  tx: number;
  ty: number;
  comp: number;
  u0: number;
  u1: number;
  material: string;
  aberturas: AberturaExterna[];
  yOrdenacao: number;
}

function ehCoberturaRustica(matId: string | null | undefined): boolean {
  if (!matId) return false;
  return (
    matId.includes('tabuas') ||
    matId.includes('tabuinhas') ||
    matId.includes('palha') ||
    matId.includes('bambu') ||
    matId.includes('couro')
  );
}

function resolverMaterialDaFachada(p: ParedeExternaDoTelhado, e: EntradaDoTelhado): string {
  if (p.wallFace && p.wallFace !== 'parede.topo' && MATERIAIS[p.wallFace]) return p.wallFace;
  if (p.material && p.material !== 'parede.topo' && MATERIAIS[p.material]) return p.material;
  const rustico = e.trechos.some(t => ehCoberturaRustica(t.roof.material));
  if (rustico && MATERIAIS['parede.tabuas']) return 'parede.tabuas';
  return MATERIAIS['parede.reboco'] ? 'parede.reboco' : 'papel.liso-claro';
}

function coletarTrechosFrontais(e: EntradaDoTelhado, campo: CampoDoTelhado): TrechoFrontal[] {
  const paredes = e.paredes;
  if (!paredes?.length) return [];

  const beiral = campo.beiral;
  const dInt = 0.22;
  const dExt = beiral + 0.14;
  const saida: TrechoFrontal[] = [];

  for (const parede of paredes) {
    const mat = resolverMaterialDaFachada(parede, e);
    for (let i = 0; i + 1 < parede.path.length; i++) {
      let a = parede.path[i]!;
      let b = parede.path[i + 1]!;
      let dx = b[0] - a[0];
      let dy = b[1] - a[1];
      const comp = Math.hypot(dx, dy);
      if (comp < 0.08) continue;

      // Orienta sempre da esquerda para a direita (tx >= 0) para consistência visual.
      if (dx < -1e-6 || (Math.abs(dx) <= 1e-6 && dy < 0)) {
        const tmp = a;
        a = b;
        b = tmp;
        dx = -dx;
        dy = -dy;
      }

      const tx = dx / comp;
      const ty = dy / comp;
      // Duas normais unitárias; escolhemos a que aponta para +y (frente do mapa).
      let nx = -ty;
      let ny = tx;
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      if (ny <= LIMIAR_NORMAL_FRONTAL) continue;

      // Subdivide o segmento em passos de ~0,25 m para identificar exatamente os trechos expostos ao exterior.
      const passos = Math.max(2, Math.ceil(comp / 0.25));
      const du = comp / passos;
      let inicio: number | null = null;

      const fecharIntervalo = (u0: number, u1: number) => {
        if (u1 - u0 < 0.08) return;
        const ym = a[1] + ty * ((u0 + u1) * 0.5);
        saida.push({
          a,
          b,
          tx,
          ty,
          comp,
          u0,
          u1,
          material: mat,
          aberturas: parede.aberturas,
          yOrdenacao: ym,
        });
      };

      for (let s = 0; s < passos; s++) {
        const uMid = (s + 0.5) * du;
        const px = a[0] + tx * uMid;
        const py = a[1] + ty * uMid;
        const dentro = campo.amostrar(px - nx * dInt, py - ny * dInt) !== null;
        const fora = campo.amostrar(px + nx * dExt, py + ny * dExt) === null;
        if (dentro && fora) {
          if (inicio === null) inicio = s * du;
        } else if (inicio !== null) {
          fecharIntervalo(inicio, s * du);
          inicio = null;
        }
      }
      if (inicio !== null) fecharIntervalo(inicio, comp);
    }
  }

  // Trechos mais ao fundo (-y) pintam primeiro; os mais à frente (+y) ficam por cima.
  saida.sort((x, y) => x.yOrdenacao - y.yOrdenacao || x.a[0] - y.a[0]);
  return saida;
}

function projetarAberturaNoTrecho(t: TrechoFrontal, centro: Ponto): number | null {
  const rx = centro[0] - t.a[0];
  const ry = centro[1] - t.a[1];
  const u = rx * t.tx + ry * t.ty;
  const perp = Math.abs(rx * -t.ty + ry * t.tx);
  if (perp > TOLERANCIA_ABERTURA) return null;
  if (u < t.u0 + 0.04 || u > t.u1 - 0.04) return null;
  return u;
}

function corMaterialBase(id: string | undefined, padrao: string): string {
  if (id && MATERIAIS[id]) return materialDe(id).base;
  return materialDe(padrao).base;
}

function desenharPorta(
  ctx: Contexto,
  u: number,
  larguraBruta: number,
  yVis0: number,
  yBase: number,
  matId: string | undefined,
  res: number,
  pixel: boolean,
  aberta = false,
): void {
  const px = 1 / res;
  const q = (v: number) => (pixel ? Math.round(v * res) * px : v);
  const qw = (v: number) => (pixel ? Math.max(px, Math.round(v * res) * px) : v);

  const w = Math.max(0.55, Math.min(2.2, larguraBruta));
  const yTop = q(yVis0 + 0.1);
  const hTotal = Math.max(0.45, yBase - yTop);
  const x0 = q(u - w * 0.5);
  const moldura = qw(Math.min(0.08, w * 0.09));
  const vergaH = qw(0.075);
  const soleiraH = qw(0.065);

  const corMad = corMaterialBase(matId, 'madeira.escura');
  const corMoldura = tom(corMad, -0.28);
  const corFolha = tom(corMad, 0.06);
  const corFresta = tom(corMad, -0.45);
  const corHighlight = tom(corMad, 0.24);

  // Sombra projetada da verga e moldura sobre a fachada.
  ctx.fillStyle = pixel ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.32)';
  ctx.fillRect(x0 - moldura * 0.6, yTop + vergaH, w + moldura * 1.2, qw(0.055));

  // Soleira clara no pé.
  const solX = q(x0 - 0.05);
  const solW = qw(w + 0.1);
  const solY = q(yBase - soleiraH + 0.015);
  ctx.fillStyle = '#b9b09f';
  ctx.fillRect(solX, solY, solW, soleiraH);
  ctx.fillStyle = 'rgba(255,250,238,0.35)';
  ctx.fillRect(solX, solY, solW, qw(0.018));
  ctx.fillStyle = 'rgba(0,0,0,0.48)';
  ctx.fillRect(solX, solY + soleiraH - qw(0.018), solW, qw(0.018));

  // Moldura externa da porta.
  ctx.fillStyle = corMoldura;
  ctx.fillRect(x0, yTop, w, yBase - soleiraH * 0.6 - yTop);

  // Verga superior um pouco mais larga.
  const vergaX = q(x0 - 0.04);
  const vergaW = qw(w + 0.08);
  ctx.fillStyle = tom(corMad, -0.2);
  ctx.fillRect(vergaX, yTop - qw(0.015), vergaW, vergaH);
  ctx.fillStyle = 'rgba(255,248,230,0.16)';
  ctx.fillRect(vergaX, yTop - qw(0.015), vergaW, qw(0.016));

  // Vão interno: escuro/interior quando aberta; folha de tábuas verticais quando fechada.
  const fx0 = q(x0 + moldura);
  const fy0 = q(yTop + vergaH * 0.85);
  const fw = Math.max(px, w - moldura * 2);
  const fh = Math.max(px, yBase - soleiraH * 0.85 - fy0);

  if (aberta) {
    if (pixel) {
      ctx.fillStyle = '#141218';
      ctx.fillRect(fx0, fy0, fw, fh);
    } else {
      const gr = ctx.createLinearGradient(u, fy0, u, fy0 + fh);
      gr.addColorStop(0, '#0c0b10');
      gr.addColorStop(0.65, '#191720');
      gr.addColorStop(1, '#26232d');
      ctx.fillStyle = gr;
      ctx.fillRect(fx0, fy0, fw, fh);
    }
    // Borda fina da folha recolhida junto ao batente esquerdo.
    const folhaRecolhidaW = Math.min(fw * 0.14, qw(0.065));
    ctx.fillStyle = corFolha;
    ctx.fillRect(fx0, fy0, folhaRecolhidaW, fh);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(fx0 + folhaRecolhidaW, fy0, qw(0.018), fh);
    void hTotal;
    return;
  }

  ctx.fillStyle = corFolha;
  ctx.fillRect(fx0, fy0, fw, fh);

  // Tábuas verticais e divisória central (se porta dupla).
  const portaDupla = w >= 1.3;
  const nTabuas = portaDupla ? 6 : Math.max(3, Math.round(fw / 0.18));
  const lTabua = fw / nTabuas;
  for (let i = 0; i < nTabuas; i++) {
    const tx = fx0 + i * lTabua;
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(tx, fy0, lTabua, fh);
    } else {
      ctx.fillStyle = 'rgba(255,245,225,0.05)';
      ctx.fillRect(tx, fy0, lTabua, fh);
    }
    if (i > 0) {
      const meioDupla = portaDupla && i === nTabuas / 2;
      ctx.fillStyle = meioDupla ? 'rgba(0,0,0,0.62)' : corFresta;
      ctx.fillRect(q(tx), fy0, meioDupla ? qw(0.025) : qw(0.014), fh);
    }
  }

  // Travessa horizontal discreta na parte superior e inferior da folha.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(fx0, q(fy0 + fh * 0.22), fw, qw(0.028));
  ctx.fillRect(fx0, q(fy0 + fh * 0.78), fw, qw(0.028));

  // Sombra interna da moldura sobre a folha.
  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.fillRect(fx0, fy0, fw, qw(0.03));
  ctx.fillRect(fx0, fy0, qw(0.022), fh);

  // Maçaneta discreta.
  const yMac = q(fy0 + fh * 0.54);
  const rMac = qw(0.028);
  ctx.fillStyle = '#c8aa5e';
  if (portaDupla) {
    ctx.fillRect(q(u - 0.055), yMac, rMac, rMac * 1.4);
    ctx.fillRect(q(u + 0.03), yMac, rMac, rMac * 1.4);
  } else {
    ctx.fillRect(q(fx0 + fw - 0.09), yMac, rMac, rMac * 1.4);
    ctx.fillStyle = corHighlight;
    ctx.fillRect(q(fx0 + fw - 0.09), yMac, rMac, qw(0.012));
  }
  void hTotal;
}

function desenharJanela(
  ctx: Contexto,
  u: number,
  larguraBruta: number,
  yVis0: number,
  yBase: number,
  matId: string | undefined,
  res: number,
  pixel: boolean,
): void {
  const px = 1 / res;
  const q = (v: number) => (pixel ? Math.round(v * res) * px : v);
  const qw = (v: number) => (pixel ? Math.max(px, Math.round(v * res) * px) : v);

  const w = Math.max(0.5, Math.min(2.0, larguraBruta * 0.92));
  const hVis = yBase - yVis0;
  const hWin = Math.min(0.45, hVis * 0.5);
  const yTop = q(yVis0 + (hVis - hWin) * 0.36);
  const x0 = q(u - w * 0.5);
  const quadro = qw(0.055);
  const vergaH = qw(0.055);
  const peitorilH = qw(0.065);

  const corMad = corMaterialBase(matId, 'madeira.media');
  const corCaixilho = tom(corMad, -0.18);
  const corPeitoril = tom(corMad, -0.28);

  // Sombra da janela projetada na parede (abaixo do peitoril e ao lado).
  ctx.fillStyle = pixel ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.3)';
  ctx.fillRect(q(x0 - 0.05), q(yTop + hWin + peitorilH - 0.01), qw(w + 0.1), qw(0.065));

  // Verga superior.
  const vx0 = q(x0 - 0.045);
  const vw = qw(w + 0.09);
  ctx.fillStyle = corPeitoril;
  ctx.fillRect(vx0, q(yTop - vergaH * 0.7), vw, vergaH);
  ctx.fillStyle = 'rgba(255,248,232,0.18)';
  ctx.fillRect(vx0, q(yTop - vergaH * 0.7), vw, qw(0.015));

  // Caixilho externo de madeira.
  ctx.fillStyle = corCaixilho;
  ctx.fillRect(x0, yTop, w, hWin);

  // Vidro escuro azulado/acinzentado.
  const gx0 = q(x0 + quadro);
  const gy0 = q(yTop + quadro);
  const gw = Math.max(px, w - quadro * 2);
  const gh = Math.max(px, hWin - quadro * 2);

  if (pixel) {
    ctx.fillStyle = '#223344';
    ctx.fillRect(gx0, gy0, gw, gh);
    // Reflexo diagonal em degrau simples.
    ctx.fillStyle = '#3f5a74';
    ctx.fillRect(gx0 + px, gy0 + px, Math.max(px, gw * 0.35), px);
    ctx.fillRect(gx0 + px, gy0 + px * 2, Math.max(px, gw * 0.2), px);
  } else {
    const gr = ctx.createLinearGradient(gx0, gy0, gx0, gy0 + gh);
    gr.addColorStop(0, '#182430');
    gr.addColorStop(0.55, '#25384a');
    gr.addColorStop(1, '#31495e');
    ctx.fillStyle = gr;
    ctx.fillRect(gx0, gy0, gw, gh);

    // Reflexo diagonal sutil no vidro.
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx0, gy0, gw, gh);
    ctx.clip();
    ctx.fillStyle = 'rgba(205, 230, 250, 0.16)';
    ctx.beginPath();
    ctx.moveTo(gx0 + gw * 0.08, gy0);
    ctx.lineTo(gx0 + gw * 0.34, gy0);
    ctx.lineTo(gx0 + gw * 0.04, gy0 + gh);
    ctx.lineTo(gx0 - gw * 0.14, gy0 + gh);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(205, 230, 250, 0.09)';
    ctx.beginPath();
    ctx.moveTo(gx0 + gw * 0.44, gy0);
    ctx.lineTo(gx0 + gw * 0.56, gy0);
    ctx.lineTo(gx0 + gw * 0.26, gy0 + gh);
    ctx.lineTo(gx0 + gw * 0.14, gy0 + gh);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Sombra interna da moldura sobre o vidro.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(gx0, gy0, gw, qw(0.025));

  // Cruz de montantes (1 vertical no centro ou 2 se janela larga, + 1 horizontal).
  const espMontante = qw(0.032);
  ctx.fillStyle = corCaixilho;
  if (gw > 0.95) {
    ctx.fillRect(q(gx0 + gw / 3 - espMontante * 0.5), gy0, espMontante, gh);
    ctx.fillRect(q(gx0 + (gw * 2) / 3 - espMontante * 0.5), gy0, espMontante, gh);
  } else {
    ctx.fillRect(q(u - espMontante * 0.5), gy0, espMontante, gh);
  }
  ctx.fillRect(gx0, q(gy0 + gh * 0.5 - espMontante * 0.5), gw, espMontante);

  // Peitoril saliente abaixo.
  const px0 = q(x0 - 0.065);
  const pw = qw(w + 0.13);
  const py0 = q(yTop + hWin - qw(0.01));
  ctx.fillStyle = corPeitoril;
  ctx.fillRect(px0, py0, pw, peitorilH);
  ctx.fillStyle = 'rgba(255,248,232,0.26)';
  ctx.fillRect(px0, py0, pw, qw(0.02));
  ctx.fillStyle = 'rgba(0,0,0,0.42)';
  ctx.fillRect(px0, py0 + peitorilH - qw(0.018), pw, qw(0.018));
}

function desenharArco(
  ctx: Contexto,
  u: number,
  larguraBruta: number,
  yVis0: number,
  yBase: number,
  res: number,
  pixel: boolean,
): void {
  const px = 1 / res;
  const q = (v: number) => (pixel ? Math.round(v * res) * px : v);
  const qw = (v: number) => (pixel ? Math.max(px, Math.round(v * res) * px) : v);

  const w = Math.max(0.6, Math.min(2.4, larguraBruta));
  const yTop = q(yVis0 + 0.1);
  const hTotal = Math.max(0.45, yBase - yTop);
  const borda = qw(0.085);
  const rExt = Math.min(w * 0.5, hTotal * 0.48);
  const rInt = Math.max(0.15, rExt - borda);
  const cyArc = q(yTop + rExt);

  // Borda/aduelas de pedra ao redor do arco.
  ctx.fillStyle = '#7b766e';
  ctx.beginPath();
  ctx.moveTo(u - w * 0.5, yBase);
  ctx.lineTo(u - w * 0.5, cyArc);
  ctx.arc(u, cyArc, rExt, Math.PI, 0, false);
  ctx.lineTo(u + w * 0.5, yBase);
  ctx.closePath();
  ctx.fill();

  // Juntas das aduelas de pedra.
  ctx.strokeStyle = 'rgba(20,18,16,0.45)';
  ctx.lineWidth = qw(0.016);
  const nAduelas = 7;
  for (let i = 1; i < nAduelas; i++) {
    const ang = Math.PI + (i / nAduelas) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(u + Math.cos(ang) * rInt, cyArc + Math.sin(ang) * rInt);
    ctx.lineTo(u + Math.cos(ang) * rExt, cyArc + Math.sin(ang) * rExt);
    ctx.stroke();
  }
  // Juntas horizontais nas pilastras laterais.
  for (let y = cyArc + 0.14; y < yBase - 0.06; y += 0.14) {
    ctx.beginPath();
    ctx.moveTo(u - w * 0.5, y);
    ctx.lineTo(u - rInt, y);
    ctx.moveTo(u + rInt, y);
    ctx.lineTo(u + w * 0.5, y);
    ctx.stroke();
  }

  // Vão arqueado escuro.
  if (pixel) {
    ctx.fillStyle = '#141218';
  } else {
    const gr = ctx.createLinearGradient(u, yTop, u, yBase);
    gr.addColorStop(0, '#0c0b10');
    gr.addColorStop(0.65, '#191720');
    gr.addColorStop(1, '#26232d');
    ctx.fillStyle = gr;
  }
  ctx.beginPath();
  ctx.moveTo(u - rInt, yBase);
  ctx.lineTo(u - rInt, cyArc);
  ctx.arc(u, cyArc, rInt, Math.PI, 0, false);
  ctx.lineTo(u + rInt, yBase);
  ctx.closePath();
  ctx.fill();

  // Soleira discreta no pé.
  ctx.fillStyle = '#a39c90';
  ctx.fillRect(q(u - w * 0.5 - 0.03), q(yBase - qw(0.045)), qw(w + 0.06), qw(0.045));
}

/**
 * Assa a fachada frontal (+y) sob o beiral do edifício, alinhada à mesma origem e resolução do telhado,
 * com altura expandida em baixo para comportar `ALTURA_DA_FACHADA` (0,9 m) + sombra de contato no chão.
 * Devolve `null` quando não há paredes habilitadas ou nenhuma aresta externa voltada para +y.
 */
export function assarFachada(
  e: EntradaDoTelhado,
  campo: CampoDoTelhado,
  origemCor: Ponto,
  larguraCor: number,
  alturaCor: number,
  res: number,
  estilo: EstiloDeRaster,
): Tela | null {
  if (!e.paredes?.length) return null;
  const trechos = coletarTrechosFrontais(e, campo);
  if (!trechos.length) return null;

  const pixel = estilo.id === 'pixel';
  const alturaFachada = alturaCor + Math.ceil((ALTURA_DA_FACHADA + 0.25) * res);
  const tela = criarTela(larguraCor, alturaFachada);
  const ctx = contextoDe(tela);
  if (pixel) ctx.imageSmoothingEnabled = false;

  const beiral = campo.beiral;
  const hTotal = beiral + ALTURA_DA_FACHADA;
  const seedBase = e.trechos[0]?.seed ?? 1;
  const px = 1 / res;

  for (const t of trechos) {
    const larg = t.u1 - t.u0;
    const sementeTrecho = seedBase + Math.round(t.a[0] * 17 + t.a[1] * 11 + t.u0 * 7);

    // 1. Sombra de contato na base sobre a calçada/chão (abaixo de hTotal).
    ctx.save();
    ctx.setTransform(res, 0, 0, res, -origemCor[0] * res, -origemCor[1] * res);
    ctx.transform(t.tx, t.ty, 0, 1, t.a[0], t.a[1]);
    if (pixel) {
      ctx.fillStyle = 'rgba(10,8,6,0.45)';
      ctx.fillRect(t.u0, hTotal, larg, Math.max(px, Math.round(0.08 * res) * px));
    } else {
      const grBase = ctx.createLinearGradient(0, hTotal, 0, hTotal + ALTURA_SOMBRA_BASE);
      grBase.addColorStop(0, 'rgba(10,8,6,0.36)');
      grBase.addColorStop(0.45, 'rgba(10,8,6,0.14)');
      grBase.addColorStop(1, 'rgba(10,8,6,0)');
      ctx.fillStyle = grBase;
      ctx.fillRect(t.u0 - 0.04, hTotal, larg + 0.08, ALTURA_SOMBRA_BASE);
    }
    ctx.restore();

    // 2. Corpo da fachada recortado na faixa [u0..u1] × [0..hTotal].
    ctx.save();
    ctx.setTransform(res, 0, 0, res, -origemCor[0] * res, -origemCor[1] * res);
    ctx.transform(t.tx, t.ty, 0, 1, t.a[0], t.a[1]);
    ctx.beginPath();
    ctx.rect(t.u0, 0, larg, hTotal);
    ctx.clip();

    // Material externo da parede (comprimido na vertical como em faces-de-parede.ts).
    ctx.save();
    ctx.setTransform(res, 0, 0, res, -origemCor[0] * res, -origemCor[1] * res);
    ctx.transform(t.tx, t.ty, 0, ACHATAMENTO_DO_PAPEL, t.a[0], t.a[1]);
    estilo.pintarMaterial(
      ctx,
      t.material,
      { x: t.u0, y: 0, w: larg, h: hTotal / ACHATAMENTO_DO_PAPEL + 0.06 },
      sementeTrecho,
      { res },
    );
    ctx.restore();

    // Quinas laterais sutis (dão acabamento nas extremidades da fachada).
    const quina = pixel ? px : 0.05;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(t.u0, 0, quina, hTotal);
    ctx.fillRect(t.u1 - quina, 0, quina, hTotal);

    // Rodapé escuro na base (~0,14 m).
    const yRodape = hTotal - ALTURA_RODAPE;
    ctx.fillStyle = 'rgba(18,14,12,0.5)';
    ctx.fillRect(t.u0, yRodape, larg, ALTURA_RODAPE);
    ctx.fillStyle = 'rgba(255,248,232,0.12)';
    ctx.fillRect(t.u0, yRodape - (pixel ? px : 0.015), larg, pixel ? px : 0.02);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(t.u0, hTotal - (pixel ? px : 0.024), larg, pixel ? px : 0.024);

    // Sombreamento vertical sob o beiral (~0,22 m no topo visível).
    if (pixel) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(t.u0, 0, larg, beiral + Math.max(px, Math.round(0.08 * res) * px));
      ctx.fillStyle = 'rgba(0,0,0,0.26)';
      ctx.fillRect(t.u0, beiral + Math.max(px, Math.round(0.08 * res) * px), larg, Math.max(px, Math.round(0.1 * res) * px));
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.56)';
      ctx.fillRect(t.u0, 0, larg, beiral);
      const grBeiral = ctx.createLinearGradient(0, beiral, 0, beiral + ALTURA_SOMBRA_BEIRAL);
      grBeiral.addColorStop(0, 'rgba(0,0,0,0.56)');
      grBeiral.addColorStop(0.45, 'rgba(0,0,0,0.2)');
      grBeiral.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grBeiral;
      ctx.fillRect(t.u0, beiral, larg, ALTURA_SOMBRA_BEIRAL);
    }

    // 3. Aberturas reais (porta, janela, arco) ao longo deste trecho.
    for (const ab of t.aberturas) {
      if (ab.tipo === 'secret') continue;
      const u = projetarAberturaNoTrecho(t, ab.centro);
      if (u === null) continue;
      const largDisp = Math.min(ab.largura, Math.max(0.45, larg - 0.12));
      if (ab.tipo === 'door') {
        desenharPorta(ctx, u, largDisp, beiral, hTotal, ab.material, res, pixel, ab.aberta === true);
      } else if (ab.tipo === 'window') {
        desenharJanela(ctx, u, largDisp, beiral, hTotal, ab.material, res, pixel);
      } else if (ab.tipo === 'arch') {
        desenharArco(ctx, u, largDisp, beiral, hTotal, res, pixel);
      }
    }

    ctx.restore();
  }

  return tela;
}
