import { BEIRAL_PADRAO, campoDosTrechos, type AmostraDoTelhado, type CampoDoTelhado } from '../domain/campo-do-telhado.ts';
import type { DetalheDeTelhado, MapaAtlas, Ponto, Telhado } from '../domain/mapa.ts';
import { telhadoEfetivo, type Trecho } from '../domain/telhado-geometria.ts';
import { assarDescricao, type Assado } from './assar.ts';
import { contextoDe, criarTela, type Tela } from './canvas.ts';
import {
  amostradorContinuo,
  capaDaCobertura,
  corDaAmostra,
  ehPadraoDeCobertura,
  hashDaPeca,
  type AmostraDeCobertura,
  type AmostradorDeCobertura,
  type CapaDeCumeeira,
  type PadraoDeCobertura,
} from './coberturas.ts';
import type { Parte } from './descricao.ts';
import {
  aplicarDesgasteDeTelhado,
  prepararDesgaste,
  type ContextoDesgaste,
  type SaidaDesgaste,
} from './desgaste-de-telhado.ts';
import { descricaoDoDetalhe, posicoesDosDetalhes, type PosicaoDeDetalhe } from './detalhes-de-telhado.ts';
import type { EstiloDeRaster, IdDoEstilo } from './estilos/index.ts';
import { materialDe, type Material } from './materiais.ts';
import { hash2D } from './ruido.ts';

/** Resolução padrão (px/m) do assado de telhado no estilo Ilustrado. */
export const RES_DO_TELHADO = 64;
const MARGEM_BASE = 0.12;
const MARGEM_COM_DETALHES = 0.55;
const MEIA_LARGURA_CAPA = 0.06;
const LIMIAR_AO_RINCAO = 0.25;

export interface ParedeExternaDoTelhado {
  path: Ponto[];
  height: number;
  material: string;
  aberturas: {
    tipo: 'door' | 'window' | 'arch' | 'secret';
    centro: Ponto;
    largura: number;
    material?: string;
  }[];
}

export interface TrechoDoTelhado {
  /** Células do trecho em coordenadas da grade. */
  celulas: [number, number][];
  /** Contorno livre em metros (quando o cômodo não usa grade). */
  outline?: Ponto[];
  /** Configuração efetiva do telhado (material, forma, desgaste, detalhes). */
  roof: Telhado;
  /** Semente resolvida do trecho (`roof.seed ?? floor.seed` da primeira sala). */
  seed: number;
}

export interface EntradaDoTelhado {
  grade: Pick<MapaAtlas['grid'], 'size' | 'offset'>;
  trechos: TrechoDoTelhado[];
  /** Paredes externas relevantes do edifício (para a fachada no N7). */
  paredes?: ParedeExternaDoTelhado[];
  /** Neve do clima (`climate.weather.snow`, 0–1) quando algum trecho usa `snow: 'auto'`. */
  neve: number;
  /** Direção e alcance discretizados do sol para sombra de detalhes (presente apenas quando há detalhes). */
  sol?: { dir: [number, number]; porMetro: number; forca: number };
  /** Gênero do mapa. */
  genero: string;
}

export interface DetalheResolvido extends PosicaoDeDetalhe {
  cobertura: string;
  seed: number;
}

/** Resultado puro (sem canvas) do assado de um telhado, útil para testes em Node e para compor `assarTelhado`. */
export interface DadosDoTelhado {
  largura: number;
  altura: number;
  /** Albedo RGBA (alfa 0 fora do beiral, 255 dentro). */
  cor: Uint8ClampedArray;
  /** Normal/AO RGBA (`R = nx*0.5+0.5`, `G = ny*0.5+0.5`, `B = AO`, `A = alfa`), ou `null` no Pixel. */
  normal: Uint8ClampedArray | null;
  origem: Ponto;
  res: number;
  detalhes: DetalheResolvido[];
}

export interface AssadoDeTelhado extends Assado {
  normal?: Tela | null;
}

const lim = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const liso = (t: number): number => t * t * (3 - 2 * t);
const entre = (a: number, b: number, x: number): number => liso(lim((x - a) / (b - a)));
const fr = (v: number): number => v - Math.floor(v);

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mixRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
  out: [number, number, number],
): void {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
}

function amplitudeRelevo(padrao: PadraoDeCobertura): number {
  switch (padrao) {
    case 'telha-canal':
    case 'telha-esmaltada':
    case 'bambu':
    case 'ondulado':
    case 'fibrocimento':
    case 'chumbo':
      return 0.042;
    case 'concreto-laje':
    case 'grama-telhado':
    case 'lona':
    case 'couro-telhado':
      return 0.018;
    default:
      return 0.032;
  }
}

const ALTURA_DETALHE: Record<DetalheDeTelhado, number> = {
  chamine: 0.9,
  cruz: 1.15,
  sino: 1.0,
  catavento: 1.15,
  claraboia: 0.16,
  'caixa-dagua': 0.95,
};

const DIRS_SONDA: readonly [number, number][] = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return [Math.cos(a) * 0.068, Math.sin(a) * 0.068];
});

interface GeometriaCapa {
  s: number;
  along: number;
  nxCross: number;
  nyCross: number;
  txLine: number;
  tyLine: number;
}

/**
 * Determina o eixo transversal (`nCross`), o eixo longitudinal (`tLine`) e a distância normalizada `s ∈ [-1, 1]`
 * até a crista de uma `cumeeira` ou `espigao`.
 */
function geometriaDaCapa(campo: CampoDoTelhado, a: AmostraDoTelhado, x: number, y: number): GeometriaCapa | null {
  const l0 = Math.hypot(a.gx, a.gy);
  if (l0 <= 1e-4) return null;
  const g0x = a.gx / l0;
  const g0y = a.gy / l0;

  let minDot = 1;
  let outroGx = 0;
  let outroGy = 0;
  for (let i = 0; i < DIRS_SONDA.length; i++) {
    const [dx, dy] = DIRS_SONDA[i]!;
    const nb = campo.amostrar(x + dx, y + dy);
    if (!nb) continue;
    const ln = Math.hypot(nb.gx, nb.gy);
    if (ln <= 1e-4) continue;
    const dot = (g0x * nb.gx + g0y * nb.gy) / ln;
    if (dot < minDot) {
      minDot = dot;
      outroGx = nb.gx / ln;
      outroGy = nb.gy / ln;
    }
  }
  if (minDot >= 0.7) return null;

  // `g0 - outroG` aponta do lado atual em direção ao outro lado (atravessando a linha de cumeeira/espigão).
  const dgx = g0x - outroGx;
  const dgy = g0y - outroGy;
  const dLen = Math.hypot(dgx, dgy);
  if (dLen <= 1e-4) return null;
  const dirX = dgx / dLen;
  const dirY = dgy / dLen;

  // Busca binária (4 passos → precisão ~4 mm) para achar a distância exata `dCross` até a troca de água.
  let lo = 0;
  let hi = 0.065;
  for (let step = 0; step < 4; step++) {
    const mid = (lo + hi) * 0.5;
    const nb = campo.amostrar(x + dirX * mid, y + dirY * mid);
    if (!nb) {
      hi = mid;
      continue;
    }
    const ln = Math.hypot(nb.gx, nb.gy);
    const sameSide = ln > 1e-4 && (g0x * nb.gx + g0y * nb.gy) / ln >= 0.7;
    if (sameSide) lo = mid;
    else hi = mid;
  }
  const dCross = (lo + hi) * 0.5;

  // Orientação canônica de `nCross` para que `s` mude de sinal suavemente ao cruzar a linha da crista.
  let nxCross = dirX;
  let nyCross = dirY;
  let sinal = -1;
  if (nxCross < -1e-4 || (Math.abs(nxCross) <= 1e-4 && nyCross < 0)) {
    nxCross = -nxCross;
    nyCross = -nyCross;
    sinal = 1;
  }
  const txLine = -nyCross;
  const tyLine = nxCross;
  const s = clamp((sinal * dCross) / MEIA_LARGURA_CAPA, -1, 1);
  const along = x * txLine + y * tyLine;
  return { s, along, nxCross, nyCross, txLine, tyLine };
}

interface AmostraCapa {
  t: number;
  dhds: number;
  dhda: number;
  ao: number;
  /** Cor opcional de mistura (ex.: argamassa/madeira/metal), `0` = usa só o material do telhado. */
  misturaCor: number;
  corExtra: readonly [number, number, number];
}

const COR_MADEIRA_ESCURA: readonly [number, number, number] = [66, 46, 30];
const COR_CHUMBO: readonly [number, number, number] = [108, 114, 120];
const COR_TESTEIRA: readonly [number, number, number] = [44, 34, 26];
const COR_GUARDA_PO: readonly [number, number, number] = [62, 46, 32];
const COR_RINCAO_METAL: readonly [number, number, number] = [54, 58, 62];
const COR_PLATIBANDA_TOPO: readonly [number, number, number] = [154, 150, 142];

function amostrarCapa(capa: CapaDeCumeeira, s: number, along: number, seed: number): AmostraCapa {
  const absS = Math.abs(s);
  const bordaAO = 0.48 + 0.52 * (1 - entre(0.72, 1.0, absS));
  const sgn = s < 0 ? -1 : 1;

  switch (capa) {
    case 'telha-canal':
    case 'telha-esmaltada': {
      const comp = capa === 'telha-esmaltada' ? 0.24 : 0.28;
      const seg = Math.floor(along / comp);
      const f = fr(along / comp);
      const varPeca = (hashDaPeca(seg, seed + 131) - 0.5) * 0.14;
      const arco = Math.sqrt(Math.max(0, 1 - 0.92 * s * s));
      const dArcoDs = (-0.92 * s) / Math.max(0.24, arco);
      const junta = entre(0.84, 0.96, f);
      const labio = entre(0.74, 0.86, f) * (1 - junta);
      const brilho = capa === 'telha-esmaltada' ? 0.24 * Math.pow(arco, 3) : 0.14 * arco;
      const t = lim(0.48 + 0.24 * arco + brilho + varPeca - 0.38 * junta + 0.1 * labio - 0.22 * entre(0.78, 1, absS));
      const dhds = 1.05 * dArcoDs;
      const dhda = junta > 0.05 ? -1.05 : 0.16 + 0.52 * labio;
      return { t, dhds, dhda, ao: bordaAO * (1 - 0.32 * junta), misturaCor: 0, corExtra: COR_CHUMBO };
    }

    case 'tabua': {
      const comp = 1.2;
      const seg = Math.floor(along / comp);
      const f = fr(along / comp);
      const varPeca = (hashDaPeca(seg, seed + 137) - 0.5) * 0.12;
      const veio = (hash2D(Math.floor(along * 18), Math.floor((s + 1) * 10), seed + 19) - 0.5) * 0.08;
      const junta = f > 0.975 || f < 0.015 ? 1 : 0;
      const biselBorda = entre(0.74, 0.98, absS);
      const t = lim(0.46 + varPeca + veio + 0.1 * (1 - absS) - 0.26 * biselBorda - 0.3 * junta);
      const dhds = -sgn * (0.22 + 1.05 * biselBorda);
      const dhda = junta ? -0.65 : 0;
      return { t, dhds, dhda, ao: bordaAO * (1 - 0.22 * junta), misturaCor: 0.22, corExtra: COR_MADEIRA_ESCURA };
    }

    case 'ardosia': {
      const comp = 0.32;
      const seg = Math.floor(along / comp);
      const f = fr(along / comp);
      const varPeca = (hashDaPeca(seg, seed + 149) - 0.5) * 0.16;
      const junta = entre(0.89, 0.99, f);
      const crista = 1 - absS;
      const t = lim(0.5 + 0.2 * crista + varPeca - 0.34 * junta - 0.2 * entre(0.78, 1, absS));
      const dhds = -sgn * 0.8;
      const dhda = junta > 0.1 ? -0.85 : 0.08;
      return { t, dhds, dhda, ao: bordaAO * (1 - 0.28 * junta), misturaCor: 0, corExtra: COR_CHUMBO };
    }

    case 'palha': {
      const comp = 0.45;
      const f = fr(along / comp);
      const amarracao = Math.exp(-Math.pow((f - 0.5) / 0.07, 2));
      const fibra = (hash2D(Math.floor(along * 45), Math.floor((s + 1) * 8), seed + 31) - 0.5) * 0.16;
      const arco = Math.sqrt(Math.max(0, 1 - 0.88 * s * s));
      const dArcoDs = (-0.88 * s) / Math.max(0.28, arco);
      const t = lim(0.46 + 0.18 * arco + fibra - 0.24 * amarracao - 0.14 * entre(0.78, 1, absS));
      return {
        t,
        dhds: 0.72 * dArcoDs,
        dhda: (f < 0.5 ? 1 : -1) * 0.35 * amarracao,
        ao: bordaAO * (1 - 0.18 * amarracao),
        misturaCor: 0,
        corExtra: COR_MADEIRA_ESCURA,
      };
    }

    case 'pedra': {
      const comp = 0.45;
      const seg = Math.floor(along / comp);
      const f = fr(along / comp);
      const varPeca = (hashDaPeca(seg, seed + 163) - 0.5) * 0.18;
      const junta = f > 0.93 || f < 0.03 ? 1 : 0;
      const biselBorda = entre(0.72, 0.98, absS);
      const t = lim(0.52 + 0.1 * (1 - absS) + varPeca - 0.28 * junta - 0.18 * biselBorda);
      return {
        t,
        dhds: -sgn * (0.2 + 0.85 * biselBorda),
        dhda: junta ? -0.7 : 0,
        ao: bordaAO * (1 - 0.28 * junta),
        misturaCor: 0,
        corExtra: COR_CHUMBO,
      };
    }

    case 'chapa-dobrada':
    case 'fibrocimento': {
      const comp = capa === 'fibrocimento' ? 0.6 : 0.9;
      const f = fr(along / comp);
      const emenda = entre(0.95, 0.99, f);
      const crista = 1 - absS;
      const brilho = capa === 'chapa-dobrada' ? 0.22 * crista : 0.12 * crista;
      const t = lim(0.46 + brilho - 0.22 * emenda - 0.12 * entre(0.84, 1, absS));
      return {
        t,
        dhds: -sgn * (capa === 'chapa-dobrada' ? 0.7 : 0.55),
        dhda: emenda > 0.1 ? -0.5 : 0,
        ao: bordaAO * (1 - 0.18 * emenda),
        misturaCor: 0,
        corExtra: COR_CHUMBO,
      };
    }

    case 'bambu': {
      const comp = 0.35;
      const seg = Math.floor(along / comp);
      const f = fr(along / comp);
      const no = Math.exp(-Math.pow((f - 0.5) / 0.06, 2));
      const varPeca = (hashDaPeca(seg, seed + 173) - 0.5) * 0.1;
      const arco = Math.sqrt(Math.max(0, 1 - 0.92 * s * s));
      const dArcoDs = (-0.92 * s) / Math.max(0.24, arco);
      const t = lim(0.5 + 0.2 * arco + varPeca + 0.12 * no - 0.18 * entre(0.8, 1, absS));
      return {
        t,
        dhds: 0.9 * dArcoDs,
        dhda: (f < 0.5 ? 0.45 : -0.45) * no,
        ao: bordaAO * (1 - 0.15 * no),
        misturaCor: 0,
        corExtra: COR_MADEIRA_ESCURA,
      };
    }

    case 'chumbo': {
      const comp = 0.85;
      const f = fr(along / comp);
      const emenda = entre(0.95, 0.99, f);
      const arco = Math.sqrt(Math.max(0, 1 - 0.9 * s * s));
      const dArcoDs = (-0.9 * s) / Math.max(0.25, arco);
      const t = lim(0.5 + 0.24 * arco - 0.2 * emenda - 0.15 * entre(0.82, 1, absS));
      return {
        t,
        dhds: 0.88 * dArcoDs,
        dhda: emenda > 0.1 ? -0.45 : 0,
        ao: bordaAO,
        misturaCor: 0.15,
        corExtra: COR_CHUMBO,
      };
    }

    case 'couro':
    case 'lona': {
      const ponto = fr(along / 0.18);
      const costura = absS < 0.14 ? 1 : capa === 'lona' && Math.abs(absS - 0.38) < 0.07 ? 0.6 : 0;
      const traco = ponto < 0.55 ? 1 : 0.2;
      const t = lim(0.48 + 0.1 * (1 - absS) - 0.22 * costura * traco);
      return {
        t,
        dhds: -sgn * 0.35,
        dhda: 0,
        ao: bordaAO * (1 - 0.14 * costura),
        misturaCor: 0,
        corExtra: COR_MADEIRA_ESCURA,
      };
    }

    case 'grama': {
      const t = lim(0.54 + 0.08 * (1 - absS));
      return { t, dhds: -sgn * 0.25, dhda: 0, ao: 0.92, misturaCor: 0, corExtra: COR_MADEIRA_ESCURA };
    }

    case 'platibanda': {
      const biselBorda = entre(0.7, 0.98, absS);
      const t = lim(0.62 - 0.18 * biselBorda);
      return { t, dhds: -sgn * 0.6 * biselBorda, dhda: 0, ao: bordaAO, misturaCor: 0.25, corExtra: COR_PLATIBANDA_TOPO };
    }
  }
}

interface ContextoTrecho {
  material: Material;
  padrao: PadraoDeCobertura;
  amostrador: AmostradorDeCobertura;
  capa: CapaDeCumeeira;
  ampRelevo: number;
  forma: ReturnType<typeof telhadoEfetivo>;
  seed: number;
  tonsPixel: readonly [number, number, number][];
  manchaPixel: readonly [number, number, number][];
  qMancha: number;
  desgaste: ContextoDesgaste;
}

function prepararTrecho(t: TrechoDoTelhado): ContextoTrecho {
  const matBruto = materialDe(t.roof.material ?? 'telha.barro');
  const mat = ehPadraoDeCobertura(matBruto.padrao) ? matBruto : materialDe('telha.barro');
  const padrao = mat.padrao as PadraoDeCobertura;
  const E = parseHex(mat.escuro);
  const B = parseHex(mat.base);
  const C = parseHex(mat.claro);
  const M = mat.mancha ? parseHex(mat.mancha.cor) : B;
  const mix = (a: readonly [number, number, number], b: readonly [number, number, number], k: number): [number, number, number] => [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
  return {
    material: mat,
    padrao,
    amostrador: amostradorContinuo(mat, t.seed),
    capa: capaDaCobertura(padrao),
    ampRelevo: amplitudeRelevo(padrao),
    forma: telhadoEfetivo(t.roof),
    seed: t.seed,
    tonsPixel: [E, mix(B, E, 0.5), B, mix(B, C, 0.5), C],
    manchaPixel: [mix(M, [0, 0, 0], 0.35), M],
    qMancha: mat.mancha?.quanto ?? 0,
    desgaste: prepararDesgaste(mat, t.seed),
  };
}

function sombraPadrao(sol?: EntradaDoTelhado['sol']): { dir: [number, number]; porMetro: number; forca: number } {
  if (sol) return sol;
  return { dir: [0.46, 0.89], porMetro: 0.36, forca: 0.42 };
}

function pontoNoPoli(px: number, py: number, pts: readonly number[]): boolean {
  let dentro = false;
  const n = pts.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2]!;
    const yi = pts[i * 2 + 1]!;
    const xj = pts[j * 2]!;
    const yj = pts[j * 2 + 1]!;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-12) + xi) {
      dentro = !dentro;
    }
  }
  return dentro;
}

function corDaParte(matId: string): [number, number, number] {
  if (matId.startsWith('#')) return parseHex(matId);
  return parseHex(materialDe(matId).base);
}

/**
 * Rasterizador puro (sem canvas) das partes de um detalhe de telhado em `cor` e `normal`,
 * usado por `amostrarTelhado` (testes unitários em Node sem DOM/OffscreenCanvas).
 */
function comporDetalhesPuro(
  cor: Uint8ClampedArray,
  normal: Uint8ClampedArray | null,
  W: number,
  H: number,
  x0: number,
  y0: number,
  res: number,
  detalhes: readonly DetalheResolvido[],
  sol: EntradaDoTelhado['sol'],
  pixel: boolean,
): void {
  if (!detalhes.length) return;
  const s = sombraPadrao(sol);
  // Guarda a máscara do telhado para que a sombra projetada do detalhe caia apenas sobre o telhado.
  const mascaraTelhado = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) mascaraTelhado[i] = cor[i * 4 + 3]!;

  for (const d of detalhes) {
    const desc = descricaoDoDetalhe(d.detalhe, { cobertura: d.cobertura, semente: d.seed });
    const partes = [...desc.partes].sort((a, b) => a.z - b.z);
    const cos = Math.cos(d.ang);
    const sin = Math.sin(d.ang);
    const alt = ALTURA_DETALHE[d.detalhe] ?? 0.8;
    const sdx = clamp(s.dir[0] * alt * s.porMetro, -1.1, 1.1);
    const sdy = clamp(s.dir[1] * alt * s.porMetro, -1.1, 1.1);

    const raio = Math.max(desc.pegada[0], desc.pegada[1]) * 0.75 + Math.hypot(sdx, sdy) + 0.15;
    const px0 = Math.max(0, Math.floor((d.x - raio - x0) * res));
    const py0 = Math.max(0, Math.floor((d.y - raio - y0) * res));
    const px1 = Math.min(W - 1, Math.ceil((d.x + raio - x0) * res));
    const py1 = Math.min(H - 1, Math.ceil((d.y + raio - y0) * res));

    const dentroDaParte = (p: Parte, lx: number, ly: number): boolean => {
      if (p.forma === 'ret') {
        const px = p.x ?? 0;
        const py = p.y ?? 0;
        const pw = p.w ?? 0;
        const ph = p.h ?? 0;
        return Math.abs(lx - px) <= pw * 0.5 && Math.abs(ly - py) <= ph * 0.5;
      }
      if (p.forma === 'elipse') {
        const rx = Math.max(1e-4, (p.w ?? 0) * 0.5);
        const ry = Math.max(1e-4, (p.h ?? 0) * 0.5);
        const dx = (lx - (p.x ?? 0)) / rx;
        const dy = (ly - (p.y ?? 0)) / ry;
        return dx * dx + dy * dy <= 1;
      }
      return p.pts ? pontoNoPoli(lx, ly, p.pts) : false;
    };

    // 1. Sombra projetada sobre a água do telhado + AO de contato.
    const alfaSombra = pixel ? Math.min(0.55, s.forca) : s.forca;
    for (let py = py0; py <= py1; py++) {
      const wy = y0 + (py + 0.5) / res;
      for (let px = px0; px <= px1; px++) {
        if (!mascaraTelhado[py * W + px]) continue;
        const wx = x0 + (px + 0.5) / res;
        // Coordenadas locais no espaço da sombra projetada
        const rxS = wx - (d.x + sdx);
        const ryS = wy - (d.y + sdy);
        const lxS = rxS * cos + ryS * sin;
        const lyS = -rxS * sin + ryS * cos;
        let emSombra = false;
        for (let i = 0; i < partes.length; i++) {
          const p = partes[i]!;
          if (p.semSombra) continue;
          if (dentroDaParte(p, lxS, lyS)) { emSombra = true; break; }
        }
        const k = (py * W + px) * 4;
        if (emSombra) {
          const mul = 1 - alfaSombra;
          cor[k] = Math.round(cor[k]! * mul);
          cor[k + 1] = Math.round(cor[k + 1]! * mul);
          cor[k + 2] = Math.round(cor[k + 2]! * mul);
        }
        if (normal) {
          const distBase = Math.hypot(wx - d.x, wy - d.y);
          const rBase = Math.max(desc.pegada[0], desc.pegada[1]) * 0.65;
          if (distBase < rBase + 0.16) {
            const fAO = 0.62 + 0.38 * entre(rBase * 0.5, rBase + 0.16, distBase);
            normal[k + 2] = Math.round(normal[k + 2]! * fAO);
          }
        }
      }
    }

    // 2. Partes do detalhe por cima (cor e normal).
    for (let py = py0; py <= py1; py++) {
      const wy = y0 + (py + 0.5) / res;
      for (let px = px0; px <= px1; px++) {
        const wx = x0 + (px + 0.5) / res;
        const rx = wx - d.x;
        const ry = wy - d.y;
        const lx = rx * cos + ry * sin;
        const ly = -rx * sin + ry * cos;
        let pintou = false;
        let r = 0, g = 0, b = 0;
        let nLocalX = 0, nLocalY = 0;
        for (let i = 0; i < partes.length; i++) {
          const p = partes[i]!;
          if (pixel && (p.detalhe ?? 1) >= 3) continue;
          if (!dentroDaParte(p, lx, ly)) continue;
          const [pr, pg, pb] = corDaParte(p.mat);
          const a = p.alfa ?? 1;
          if (!pintou || a >= 0.99) {
            r = pr; g = pg; b = pb;
          } else {
            r = r * (1 - a) + pr * a;
            g = g * (1 - a) + pg * a;
            b = b * (1 - a) + pb * a;
          }
          // Normal biselada simples pelo centro da parte.
          if (p.forma === 'ret') {
            const dx = (lx - (p.x ?? 0)) / Math.max(0.02, (p.w ?? 0) * 0.5);
            const dy = (ly - (p.y ?? 0)) / Math.max(0.02, (p.h ?? 0) * 0.5);
            nLocalX = Math.abs(dx) > 0.7 ? Math.sign(dx) * 0.45 : 0;
            nLocalY = Math.abs(dy) > 0.7 ? Math.sign(dy) * 0.45 : 0;
          } else if (p.forma === 'elipse') {
            nLocalX = ((lx - (p.x ?? 0)) / Math.max(0.02, (p.w ?? 0) * 0.5)) * 0.55;
            nLocalY = ((ly - (p.y ?? 0)) / Math.max(0.02, (p.h ?? 0) * 0.5)) * 0.55;
          } else {
            nLocalX = 0;
            nLocalY = 0;
          }
          pintou = true;
        }
        if (!pintou) continue;
        const k = (py * W + px) * 4;
        cor[k] = Math.round(r);
        cor[k + 1] = Math.round(g);
        cor[k + 2] = Math.round(b);
        cor[k + 3] = 255;
        if (normal) {
          const nxW = nLocalX * cos - nLocalY * sin;
          const nyW = nLocalX * sin + nLocalY * cos;
          const inv = 1 / Math.hypot(nxW, nyW, 1);
          normal[k] = Math.round((nxW * inv * 0.5 + 0.5) * 255);
          normal[k + 1] = Math.round((nyW * inv * 0.5 + 0.5) * 255);
          normal[k + 2] = 245;
          normal[k + 3] = 255;
        }
      }
    }
  }
}

/**
 * Amostra um edifício inteiro de telhado em buffers puros RGBA (`cor` e `normal`), sem depender de Canvas/DOM.
 * Usado diretamente pelos testes unitários em Node e como base para `assarTelhado`.
 */
export function amostrarTelhado(
  e: EntradaDoTelhado,
  res: number,
  estiloId: IdDoEstilo = 'illustrated',
  opcoes: { semDetalhes?: boolean } = {},
): DadosDoTelhado {
  const trechosDom: Trecho[] = e.trechos.map(t => ({
    salas: [],
    celulas: t.celulas,
    ...(t.outline ? { outline: t.outline } : {}),
    roof: t.roof,
  }));
  const campo = campoDosTrechos(trechosDom, e.grade, BEIRAL_PADRAO);
  if (campo.caixa.w <= 0 || campo.caixa.h <= 0) {
    return {
      largura: 1,
      altura: 1,
      cor: new Uint8ClampedArray(4),
      normal: estiloId === 'pixel' ? null : new Uint8ClampedArray([128, 128, 255, 0]),
      origem: [0, 0],
      res,
      detalhes: [],
    };
  }

  const detalhes: DetalheResolvido[] = [];
  for (let i = 0; i < e.trechos.length; i++) {
    const t = e.trechos[i]!;
    const dom = trechosDom[i]!;
    for (const pos of posicoesDosDetalhes(dom, e.grade, t.seed, campo)) {
      detalhes.push({ ...pos, cobertura: t.roof.material ?? 'telha.barro', seed: t.seed });
    }
  }

  const pixel = estiloId === 'pixel';
  const margem = detalhes.length > 0 ? MARGEM_COM_DETALHES : MARGEM_BASE;
  const encaixe = (v: number) => (pixel ? Math.floor(v * res) / res : v);
  const x0 = encaixe(campo.caixa.x0 - margem);
  const y0 = encaixe(campo.caixa.y0 - margem);
  const W = Math.max(1, Math.ceil((campo.caixa.x1 + margem - x0) * res));
  const H = Math.max(1, Math.ceil((campo.caixa.y1 + margem - y0) * res));

  const cor = new Uint8ClampedArray(W * H * 4);
  const normal = pixel ? null : new Uint8ClampedArray(W * H * 4);
  if (normal) {
    for (let i = 0; i < W * H; i++) {
      const k = i * 4;
      normal[k] = 128;
      normal[k + 1] = 128;
      normal[k + 2] = 255;
      normal[k + 3] = 0;
    }
  }

  const ctxs = e.trechos.map(prepararTrecho);
  const chamines = detalhes.filter(d => d.detalhe === 'chamine');
  const eps = Math.max(0.004, 0.75 / res);
  const inv2Eps = 1 / (2 * eps);
  const am0: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  const amU1: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  const amU2: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  const amV1: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  const amV2: AmostraDeCobertura = { t: 0, m: 0, h: 0, id: 0 };
  const rgbOut: [number, number, number] = [0, 0, 0];
  const saidaDesgaste: SaidaDesgaste = { rgb: rgbOut, gx: 0, gy: 0, ao: 1 };

  for (let py = 0; py < H; py++) {
    const my = y0 + (py + 0.5) / res;
    const rowOff = py * W * 4;
    for (let px = 0; px < W; px++) {
      const mx = x0 + (px + 0.5) / res;
      const a = campo.amostrar(mx, my);
      if (!a) continue;

      const ct = ctxs[a.indiceTrecho]!;
      const uCov = a.u;
      const vCov = -a.v;
      ct.amostrador(uCov, vCov, am0);

      // Cor base da cobertura (albedo puro, sem luz direta da cena).
      if (pixel) {
        const tLim = lim(am0.t);
        const peso = ct.qMancha > 0 ? entre(1 - ct.qMancha - 0.12, 1 - ct.qMancha + 0.12, am0.m) : 0;
        const cPx = peso > 0.5 ? ct.manchaPixel[tLim < 0.42 ? 0 : 1]! : ct.tonsPixel[Math.min(4, Math.floor(tLim * 5))]!;
        rgbOut[0] = cPx[0];
        rgbOut[1] = cPx[1];
        rgbOut[2] = cPx[2];
      } else {
        corDaAmostra(ct.material, am0.t, am0.m, rgbOut);
      }

      // Normal da água + micro-relevo da peça (em float).
      let gxTot = a.gx;
      let gyTot = a.gy;
      const gLen = Math.hypot(a.gx, a.gy);
      let dvx = 0;
      let dvy = 1;
      let dux = 1;
      let duy = 0;
      if (gLen > 1e-4) {
        dvx = -a.gx / gLen;
        dvy = -a.gy / gLen;
        const shape = ct.forma.shape;
        if (shape === 'cupula' || shape === 'bulbo' || shape === 'cone') {
          dux = -dvy;
          duy = dvx;
        } else if (Math.abs(dvy) >= Math.abs(dvx)) {
          if (dvy < 0) { dux = -dvy; duy = dvx; }
          else { dux = dvy; duy = -dvx; }
        } else {
          if (dvx > 0) { dux = -dvy; duy = dvx; }
          else { dux = dvy; duy = -dvx; }
        }
      }

      if (!pixel) {
        ct.amostrador(uCov + eps, vCov, amU1);
        ct.amostrador(uCov - eps, vCov, amU2);
        ct.amostrador(uCov, vCov + eps, amV1);
        ct.amostrador(uCov, vCov - eps, amV2);
        const dhDu = (amU1.h - amU2.h) * inv2Eps;
        const dhDv = (amV1.h - amV2.h) * inv2Eps;
        const mgx = clamp(ct.ampRelevo * (dhDu * dux + dhDv * dvx), -1.6, 1.6);
        const mgy = clamp(ct.ampRelevo * (dhDu * duy + dhDv * dvy), -1.6, 1.6);
        gxTot += mgx;
        gyTot += mgy;
      }

      // AO base (canal B da normal): oclusão miúda de frestas, rincões e borda do beiral.
      let ao = 1;
      if (!pixel) {
        // Frestas e juntas fundas da cobertura
        ao *= 0.82 + 0.18 * entre(0, 0.38, am0.h);
        // Rincões e encontros entre trechos
        if (a.folgaRincao < LIMIAR_AO_RINCAO) {
          ao *= 0.42 + 0.58 * entre(0, LIMIAR_AO_RINCAO, a.folgaRincao);
        }
        // Borda do beiral
        if (a.distAresta < 0.1) {
          ao *= 0.66 + 0.34 * entre(0, 0.1, a.distAresta);
        }
        // Base de cúpula/bulbo/cone sobre o tambor/plinto
        if (
          (ct.forma.shape === 'cupula' || ct.forma.shape === 'bulbo' || ct.forma.shape === 'cone') &&
          a.peca === 'agua' &&
          a.v < 0.09
        ) {
          ao *= 0.64 + 0.36 * entre(0, 0.09, a.v);
        }
      }

      // Acabamento por peça do campo: cumeeira, espigão, rincão, beiral, oitão e platibanda.
      if (a.peca === 'cumeeira' || a.peca === 'espigao') {
        const geo = geometriaDaCapa(campo, a, mx, my);
        if (geo) {
          const cap = amostrarCapa(ct.capa, geo.s, geo.along, ct.seed);
          corDaAmostra(ct.material, cap.t, 0, rgbOut);
          if (cap.misturaCor > 0) {
            mixRgb(rgbOut, cap.corExtra, cap.misturaCor, rgbOut);
          }
          if (!pixel) {
            // Normal da capa substitui a micro-textura da água sobre a crista.
            gxTot = cap.dhds * geo.nxCross + cap.dhda * geo.txLine;
            gyTot = cap.dhds * geo.nyCross + cap.dhda * geo.tyLine;
            ao *= cap.ao;
          }
        }
      } else if (a.peca === 'rincao' || a.folgaRincao < 0.022) {
        const calha = 1 - entre(0.004, 0.022, a.folgaRincao);
        if (calha > 0.01) {
          mixRgb(rgbOut, COR_RINCAO_METAL, calha * 0.72, rgbOut);
          if (!pixel) {
            gxTot *= 1 - calha * 0.45;
            gyTot *= 1 - calha * 0.45;
            ao *= 1 - calha * 0.25;
          }
        }
      } else if (a.peca === 'beiral') {
        if (ct.forma.shape === 'plano') {
          // Platibanda em relevo no telhado plano.
          const dPlat = a.distAresta;
          const bordaExt = 1 - entre(0, 0.032, dPlat);
          const bordaInt = entre(0.105, 0.14, dPlat);
          const topo = 1 - Math.max(bordaExt, bordaInt);
          mixRgb(rgbOut, COR_PLATIBANDA_TOPO, 0.55 + 0.25 * topo, rgbOut);
          if (bordaExt > 0.2 || bordaInt > 0.2) {
            const esc = 1 - 0.28 * Math.max(bordaExt, bordaInt);
            rgbOut[0] *= esc;
            rgbOut[1] *= esc;
            rgbOut[2] *= esc;
          }
          if (!pixel) {
            // Normal biselada na borda da platibanda.
            const dirBorda = bordaExt > bordaInt ? 0.65 * bordaExt : -0.65 * bordaInt;
            const dcx = mx - (campo.caixa.x0 + campo.caixa.w * 0.5);
            const dcy = my - (campo.caixa.y0 + campo.caixa.h * 0.5);
            const dl = Math.hypot(dcx, dcy) || 1;
            gxTot = (-dcx / dl) * dirBorda;
            gyTot = (-dcy / dl) * dirBorda;
            ao *= 0.85 + 0.15 * topo;
          }
        } else if (a.v > a.distAresta + 0.015) {
          // Oitão (borda perpendicular à cumeeira em duas-águas / holandês / abóbada): guarda-pó de madeira.
          if (a.distAresta < 0.072) {
            const kGP = 1 - entre(0.056, 0.072, a.distAresta);
            const veio = (hash2D(Math.floor(mx * 24), Math.floor(my * 24), ct.seed + 83) - 0.5) * 18;
            const gpCor: [number, number, number] = [
              clamp(COR_GUARDA_PO[0] + veio, 0, 255),
              clamp(COR_GUARDA_PO[1] + veio * 0.8, 0, 255),
              clamp(COR_GUARDA_PO[2] + veio * 0.6, 0, 255),
            ];
            mixRgb(rgbOut, gpCor, kGP * 0.88, rgbOut);
            if (!pixel) {
              const bisel = 1 - entre(0, 0.025, a.distAresta);
              gxTot = a.gx * 0.6 + dux * (bisel * 0.5);
              gyTot = a.gy * 0.6 + duy * (bisel * 0.5);
              ao *= 0.72 + 0.28 * entre(0, 0.04, a.distAresta);
            }
          }
        } else {
          // Beiral: testeira escura nos últimos ~6 cm e sombra embaixo.
          const kTesteira = 1 - entre(0.032, 0.062, a.distAresta);
          if (kTesteira > 0.01) {
            mixRgb(rgbOut, COR_TESTEIRA, kTesteira * 0.82, rgbOut);
            if (!pixel) {
              // Borda do beiral inclina levemente para fora (queda d'água) com sombra inferior.
              gxTot -= dvx * 0.55 * kTesteira;
              gyTot -= dvy * 0.55 * kTesteira;
              ao *= 1 - 0.35 * kTesteira;
            }
          }
        }
      } else if (a.peca === 'plano' && ct.forma.shape === 'plano') {
        // Sombra interna da platibanda sobre a laje plana.
        if (a.distAresta < 0.38) {
          const sInt = 1 - entre(0.14, 0.38, a.distAresta);
          const esc = 1 - 0.22 * sInt;
          rgbOut[0] *= esc;
          rgbOut[1] *= esc;
          rgbOut[2] *= esc;
          if (!pixel) ao *= 1 - 0.42 * sInt;
        }
      }

      // Desgaste (N5): dano, remendos, sujeira, fuligem, musgo e neve (por último).
      const wear = ct.forma.wear;
      const snowEfetiva = wear.snow === 'auto' ? e.neve : wear.snow;
      if (wear.damage > 0 || wear.dirt > 0 || wear.moss > 0 || snowEfetiva > 0 || chamines.length > 0) {
        saidaDesgaste.gx = gxTot;
        saidaDesgaste.gy = gyTot;
        saidaDesgaste.ao = ao;
        aplicarDesgasteDeTelhado(
          {
            wear,
            snowEfetiva,
            seed: ct.seed,
            amostra: a,
            cobertura: am0,
            mx,
            my,
            dvx,
            dvy,
            corMaterial: ct.material,
            chamines,
            pixel,
            ctx: ct.desgaste,
          },
          saidaDesgaste,
        );
        gxTot = saidaDesgaste.gx;
        gyTot = saidaDesgaste.gy;
        ao = saidaDesgaste.ao;
      }

      const k = rowOff + px * 4;
      cor[k] = Math.round(clamp(rgbOut[0], 0, 255));
      cor[k + 1] = Math.round(clamp(rgbOut[1], 0, 255));
      cor[k + 2] = Math.round(clamp(rgbOut[2], 0, 255));
      cor[k + 3] = 255;

      if (normal) {
        const invN = 1 / Math.hypot(-gxTot, -gyTot, 1);
        const nx = -gxTot * invN;
        const ny = -gyTot * invN;
        normal[k] = Math.round(clamp(nx * 0.5 + 0.5, 0, 1) * 255);
        normal[k + 1] = Math.round(clamp(ny * 0.5 + 0.5, 0, 1) * 255);
        normal[k + 2] = Math.round(clamp(ao, 0, 1) * 255);
        normal[k + 3] = 255;
      }
    }
  }

  if (!opcoes.semDetalhes && detalhes.length > 0) {
    comporDetalhesPuro(cor, normal, W, H, x0, y0, res, detalhes, e.sol, pixel);
  }

  return { largura: W, altura: H, cor, normal, origem: [x0, y0], res, detalhes };
}

/**
 * Compõe um detalhe assado (`assarDescricao`) sobre as telas de `cor` e `normal` do telhado,
 * projetando a sombra própria na água (recortada à silhueta do telhado) e transferindo a normal derivada da altura do detalhe.
 */
function comporDetalhesNaTela(
  tela: Tela,
  normalTela: Tela | null,
  x0: number,
  y0: number,
  res: number,
  detalhes: readonly DetalheResolvido[],
  sol: EntradaDoTelhado['sol'],
  estilo: EstiloDeRaster,
): void {
  if (!detalhes.length) return;
  const W = tela.width;
  const H = tela.height;
  const ctx = contextoDe(tela, { willReadFrequently: true });
  const pixel = estilo.id === 'pixel';
  const s = sombraPadrao(sol);

  // Máscara do telhado para recortar as sombras projetadas (não vazar para fora do beiral).
  const mascTelhado = criarTela(W, H);
  const mctx = contextoDe(mascTelhado);
  mctx.drawImage(tela as CanvasImageSource, 0, 0);

  const sombraCamada = criarTela(W, H);
  const sctx = contextoDe(sombraCamada);

  const nctx = normalTela ? contextoDe(normalTela, { willReadFrequently: true }) : null;
  const nDados = nctx ? nctx.getImageData(0, 0, W, H) : null;
  const assados = detalhes.map(d => {
    const desc = descricaoDoDetalhe(d.detalhe, { cobertura: d.cobertura, semente: d.seed });
    return { d, desc, assado: assarDescricao(desc, d.seed, res, estilo) };
  });

  for (const { d, desc, assado } of assados) {
    const dw = assado.tela.width;
    const dh = assado.tela.height;

    // 1. Sombra projetada do detalhe sobre a água (silhueta deslocada na direção do sol).
    const alt = ALTURA_DETALHE[d.detalhe] ?? 0.8;
    const sdx = clamp(s.dir[0] * alt * s.porMetro, -1.1, 1.1);
    const sdy = clamp(s.dir[1] * alt * s.porMetro, -1.1, 1.1);

    const sil = criarTela(dw, dh);
    const silCtx = contextoDe(sil);
    silCtx.drawImage(assado.tela as CanvasImageSource, 0, 0);
    silCtx.globalCompositeOperation = 'source-in';
    silCtx.fillStyle = '#0c0a08';
    silCtx.fillRect(0, 0, dw, dh);

    sctx.save();
    sctx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    sctx.translate(d.x + sdx, d.y + sdy);
    sctx.rotate(d.ang);
    sctx.globalAlpha = pixel ? Math.min(0.55, s.forca) : s.forca;
    if (!pixel && 'filter' in sctx) sctx.filter = `blur(${Math.max(1, 0.04 * res).toFixed(1)}px)`;
    sctx.drawImage(sil as CanvasImageSource, assado.origem[0], assado.origem[1], dw / res, dh / res);
    sctx.restore();

    // 2. Normal + AO de contato do detalhe.
    if (nDados && assado.altura) {
      const detCor = contextoDe(assado.tela, { willReadFrequently: true }).getImageData(0, 0, dw, dh).data;
      const detAlt = contextoDe(assado.altura, { willReadFrequently: true }).getImageData(0, 0, dw, dh).data;
      const cos = Math.cos(d.ang);
      const sin = Math.sin(d.ang);
      const rPx = Math.hypot(dw, dh) * 0.5 + 0.16 * res;
      const cxPx = (d.x - x0) * res;
      const cyPx = (d.y - y0) * res;
      const px0 = Math.max(0, Math.floor(cxPx - rPx));
      const py0 = Math.max(0, Math.floor(cyPx - rPx));
      const px1 = Math.min(W - 1, Math.ceil(cxPx + rPx));
      const py1 = Math.min(H - 1, Math.ceil(cyPx + rPx));
      const rBaseM = Math.max(desc.pegada[0], desc.pegada[1]) * 0.6;

      for (let py = py0; py <= py1; py++) {
        const wy = y0 + (py + 0.5) / res;
        for (let px = px0; px <= px1; px++) {
          const wx = x0 + (px + 0.5) / res;
          const kOut = (py * W + px) * 4;
          const distBase = Math.hypot(wx - d.x, wy - d.y);
          if (nDados.data[kOut + 3]! > 0 && distBase < rBaseM + 0.16) {
            const fAO = 0.62 + 0.38 * entre(rBaseM * 0.45, rBaseM + 0.16, distBase);
            nDados.data[kOut + 2] = Math.round(nDados.data[kOut + 2]! * fAO);
          }

          const rx = wx - d.x;
          const ry = wy - d.y;
          const lx = rx * cos + ry * sin;
          const ly = -rx * sin + ry * cos;
          const sx = Math.floor((lx - assado.origem[0]) * res);
          const sy = Math.floor((ly - assado.origem[1]) * res);
          if (sx < 0 || sy < 0 || sx >= dw || sy >= dh) continue;
          const aDet = detCor[(sy * dw + sx) * 4 + 3]! / 255;
          if (aDet < 0.08) continue;

          const sL = detAlt[(sy * dw + Math.max(0, sx - 1)) * 4]! / 255;
          const sR = detAlt[(sy * dw + Math.min(dw - 1, sx + 1)) * 4]! / 255;
          const sU = detAlt[(Math.max(0, sy - 1) * dw + sx) * 4]! / 255;
          const sD = detAlt[(Math.min(dh - 1, sy + 1) * dw + sx) * 4]! / 255;
          const gLx = (sR - sL) * 4.5;
          const gLy = (sD - sU) * 4.5;
          const gWx = gLx * cos - gLy * sin;
          const gWy = gLx * sin + gLy * cos;
          const inv = 1 / Math.hypot(-gWx, -gWy, 1);
          const nr = clamp((-gWx * inv) * 0.5 + 0.5, 0, 1) * 255;
          const ng = clamp((-gWy * inv) * 0.5 + 0.5, 0, 1) * 255;
          const prevA = nDados.data[kOut + 3]! / 255;
          if (prevA > 0) {
            nDados.data[kOut] = Math.round(nDados.data[kOut]! * (1 - aDet) + nr * aDet);
            nDados.data[kOut + 1] = Math.round(nDados.data[kOut + 1]! * (1 - aDet) + ng * aDet);
            nDados.data[kOut + 2] = Math.round(nDados.data[kOut + 2]! * (1 - aDet) + 245 * aDet);
            nDados.data[kOut + 3] = Math.max(nDados.data[kOut + 3]!, Math.round(aDet * 255));
          } else {
            nDados.data[kOut] = Math.round(nr);
            nDados.data[kOut + 1] = Math.round(ng);
            nDados.data[kOut + 2] = 245;
            nDados.data[kOut + 3] = Math.round(aDet * 255);
          }
        }
      }
    }
  }

  // Recorta todas as sombras projetadas à silhueta do telhado e compõe sobre a cor.
  sctx.save();
  sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalCompositeOperation = 'destination-in';
  sctx.drawImage(mascTelhado as CanvasImageSource, 0, 0);
  sctx.restore();

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(sombraCamada as CanvasImageSource, 0, 0);
  ctx.restore();

  // 3. Desenha todos os detalhes (cor) por cima das sombras projetadas.
  for (const { d, assado } of assados) {
    ctx.save();
    ctx.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
    ctx.translate(d.x, d.y);
    ctx.rotate(d.ang);
    ctx.drawImage(assado.tela as CanvasImageSource, assado.origem[0], assado.origem[1], assado.tela.width / res, assado.tela.height / res);
    ctx.restore();
  }

  if (nctx && nDados) {
    nctx.setTransform(1, 0, 0, 1, 0, 0);
    nctx.putImageData(nDados, 0, 0);
  }
}

/**
 * Assa o telhado inteiro de um edifício em duas telas alinhadas:
 * - `tela`: albedo RGBA (alfa 0 fora do beiral, 255 dentro), sem iluminação direta da cena;
 * - `normal`: `R = nx*0.5+0.5`, `G = ny*0.5+0.5`, `B = AO`, `A = alfa` (ausente/`null` no estilo Pixel).
 */
export function assarTelhado(e: EntradaDoTelhado, res: number, estilo: EstiloDeRaster): AssadoDeTelhado {
  const dados = amostrarTelhado(e, res, estilo.id, { semDetalhes: true });
  const tela = criarTela(dados.largura, dados.altura);
  const ctx = contextoDe(tela, { willReadFrequently: dados.detalhes.length > 0 });
  const imgCor = ctx.createImageData(dados.largura, dados.altura);
  imgCor.data.set(dados.cor);
  ctx.putImageData(imgCor, 0, 0);

  let normal: Tela | null = null;
  if (dados.normal) {
    normal = criarTela(dados.largura, dados.altura);
    const nctx = contextoDe(normal, { willReadFrequently: dados.detalhes.length > 0 });
    const imgN = nctx.createImageData(dados.largura, dados.altura);
    imgN.data.set(dados.normal);
    nctx.putImageData(imgN, 0, 0);
  }

  if (dados.detalhes.length > 0) {
    comporDetalhesNaTela(tela, normal, dados.origem[0], dados.origem[1], res, dados.detalhes, e.sol, estilo);
  }

  return { tela, altura: null, normal, origem: dados.origem, res };
}
