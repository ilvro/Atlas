import type { AmostraDoTelhado } from '../domain/campo-do-telhado.ts';
import type { DesgasteEfetivo } from '../domain/telhado-geometria.ts';
import { hashDaPeca, type AmostraDeCobertura } from './coberturas.ts';
import type { Material } from './materiais.ts';
import { fbm, hash2D, valueNoise2D } from './ruido.ts';

/** Posição em metros de uma chaminé resolvida sobre o telhado. */
export interface ChamineNoTelhado {
  x: number;
  y: number;
}

/** Referência mutável de saída por pixel (evita alocação dentro do loop de `amostrarTelhado`). */
export interface SaidaDesgaste {
  rgb: [number, number, number];
  gx: number;
  gy: number;
  ao: number;
}

/** Dados pré-computados por trecho para amostrar desgaste sem alocar por pixel. */
export interface ContextoDesgaste {
  ruido: (x: number, y: number) => number;
  corMusgoBase: readonly [number, number, number];
  corMusgoEscuro: readonly [number, number, number];
  corMusgoClaro: readonly [number, number, number];
  corMatBase: readonly [number, number, number];
  corMatClaro: readonly [number, number, number];
  corMatEscuro: readonly [number, number, number];
}

export interface ParametrosDesgaste {
  wear: DesgasteEfetivo;
  snowEfetiva: number;
  seed: number;
  amostra: AmostraDoTelhado;
  cobertura: AmostraDeCobertura;
  mx: number;
  my: number;
  dvx: number;
  dvy: number;
  corMaterial: Material;
  chamines: readonly ChamineNoTelhado[];
  pixel: boolean;
  /** Contexto pré-preparado por trecho via `prepararDesgaste` (opcional). */
  ctx?: ContextoDesgaste;
}

const TAN_55 = Math.tan((55 * Math.PI) / 180); // ≈ 1.428148

const COR_MUSGO_BASE: readonly [number, number, number] = [78, 112, 42];     // #4e702a
const COR_MUSGO_ESCURO: readonly [number, number, number] = [44, 68, 26];    // #2c441a
const COR_MUSGO_CLARO: readonly [number, number, number] = [114, 150, 62];   // #72963e

const COR_SUJEIRA: readonly [number, number, number] = [38, 31, 24];
const COR_FULIGEM: readonly [number, number, number] = [28, 25, 23];         // #1c1917

const COR_SOTAO: readonly [number, number, number] = [12, 10, 9];
const COR_RIPA: readonly [number, number, number] = [84, 60, 40];
const COR_CAIBRO: readonly [number, number, number] = [56, 40, 27];
const COR_BORDA_QUEBRADA: readonly [number, number, number] = [30, 21, 15];

const COR_FOLHA_1: readonly [number, number, number] = [142, 98, 42];
const COR_FOLHA_2: readonly [number, number, number] = [114, 68, 30];
const COR_FOLHA_3: readonly [number, number, number] = [164, 122, 54];

const COR_NEVE_ALTA: readonly [number, number, number] = [233, 240, 247];    // #e9f0f7
const COR_NEVE_SOMBRA: readonly [number, number, number] = [200, 214, 230];  // #c8d6e6

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
  a: [number, number, number],
  b: readonly [number, number, number],
  t: number,
): void {
  a[0] = a[0] + (b[0] - a[0]) * t;
  a[1] = a[1] + (b[1] - a[1]) * t;
  a[2] = a[2] + (b[2] - a[2]) * t;
}

function escalarCor(c: readonly [number, number, number], k: number): [number, number, number] {
  return [clamp(c[0] * k, 0, 255), clamp(c[1] * k, 0, 255), clamp(c[2] * k, 0, 255)];
}

/** Pré-computa ruído e cores derivadas do material para uso sem alocação por pixel. */
export function prepararDesgaste(corMaterial: Material, seed: number): ContextoDesgaste {
  let corMusgoBase = COR_MUSGO_BASE;
  let corMusgoEscuro = COR_MUSGO_ESCURO;
  let corMusgoClaro = COR_MUSGO_CLARO;

  if (corMaterial.mancha?.cor) {
    const mc = parseHex(corMaterial.mancha.cor);
    if (mc[1] >= mc[0] * 0.85) {
      corMusgoBase = mc;
      corMusgoEscuro = escalarCor(mc, 0.64);
      corMusgoClaro = [
        clamp(mc[0] * 1.18 + 14, 0, 255),
        clamp(mc[1] * 1.2 + 16, 0, 255),
        clamp(mc[2] * 1.12 + 8, 0, 255),
      ];
    }
  }

  return {
    ruido: valueNoise2D(seed * 37 + 911),
    corMusgoBase,
    corMusgoEscuro,
    corMusgoClaro,
    corMatBase: parseHex(corMaterial.base),
    corMatClaro: parseHex(corMaterial.claro),
    corMatEscuro: parseHex(corMaterial.escuro),
  };
}

/**
 * Pinta o vão escuro do sótão com ripado perpendicular ao caimento (`v`) e caibros longitudinais (`u`),
 * usado quando uma peça cai ou quando um buraco maior se abre no telhado.
 */
function pintarVaoComRipas(
  u: number,
  v: number,
  seed: number,
  a: AmostraDoTelhado,
  pixel: boolean,
  saida: SaidaDesgaste,
): void {
  const fRipa = fr(v / 0.26);
  const dRipa = Math.abs(fRipa - 0.5);
  const fCaibro = fr(u / 0.62);
  const dCaibro = Math.abs(fCaibro - 0.5);

  const veioRipa = (hash2D(Math.floor(u * 28), Math.floor(v * 14), seed + 463) - 0.5) * 18;
  if (dRipa < 0.13) {
    // Ripa de madeira escura perpendicular à queda d'água.
    const borda = 1 - entre(0.07, 0.13, dRipa);
    saida.rgb[0] = clamp(COR_RIPA[0] * (0.7 + 0.3 * borda) + veioRipa, 0, 255);
    saida.rgb[1] = clamp(COR_RIPA[1] * (0.7 + 0.3 * borda) + veioRipa * 0.75, 0, 255);
    saida.rgb[2] = clamp(COR_RIPA[2] * (0.7 + 0.3 * borda) + veioRipa * 0.55, 0, 255);
    if (!pixel) {
      saida.gx = a.gx * 0.32;
      saida.gy = a.gy * 0.32;
      saida.ao = 0.44 * (0.78 + 0.22 * borda);
    }
  } else if (dCaibro < 0.06) {
    // Caibro estrutural mais fundo correndo na direção da queda.
    const borda = 1 - entre(0.028, 0.06, dCaibro);
    saida.rgb[0] = clamp(COR_CAIBRO[0] * (0.74 + 0.26 * borda) + veioRipa * 0.5, 0, 255);
    saida.rgb[1] = clamp(COR_CAIBRO[1] * (0.74 + 0.26 * borda) + veioRipa * 0.4, 0, 255);
    saida.rgb[2] = clamp(COR_CAIBRO[2] * (0.74 + 0.26 * borda) + veioRipa * 0.3, 0, 255);
    if (!pixel) {
      saida.gx = a.gx * 0.2;
      saida.gy = a.gy * 0.2;
      saida.ao = 0.32;
    }
  } else {
    // Vão escuro do sótão.
    const grao = (hash2D(Math.floor(u * 20), Math.floor(v * 20), seed + 479) - 0.5) * 6;
    saida.rgb[0] = clamp(COR_SOTAO[0] + grao, 0, 255);
    saida.rgb[1] = clamp(COR_SOTAO[1] + grao, 0, 255);
    saida.rgb[2] = clamp(COR_SOTAO[2] + grao, 0, 255);
    if (!pixel) {
      saida.gx = a.gx * 0.08;
      saida.gy = a.gy * 0.08;
      saida.ao = 0.20;
    }
  }
}

/**
 * Aplicador determinístico de desgaste por pixel do telhado:
 * dano (peças faltando, peças tortas, buracos grandes e remendos),
 * sujeira (rincões, chaminés, beiral, manchas de desgaste e folhas secas),
 * fuligem de chaminés, musgo em fios e neve (aplicada por último).
 */
export function aplicarDesgasteDeTelhado(p: ParametrosDesgaste, saida: SaidaDesgaste): void {
  const { wear, seed, amostra: a, cobertura: am0, mx, my, dvx, dvy, chamines, pixel } = p;
  const moss = lim(wear.moss);
  const dirt = lim(wear.dirt);
  const damage = lim(wear.damage);
  const snow = lim(p.snowEfetiva);

  if (moss <= 0 && dirt <= 0 && damage <= 0 && snow <= 0 && chamines.length === 0) return;

  const ctx = p.ctx ?? prepararDesgaste(p.corMaterial, seed);
  const rn = ctx.ruido;
  const rgb = saida.rgb;

  let emBuraco = false;

  // =========================================================================
  // 1. DANO (peças faltando, peças tortas, buracos > 0,6 e remendos)
  // Invariante: quando damage <= 0, ZERO peças são removidas, entortadas ou esburacadas.
  // =========================================================================
  // Semente diferenciada por lado da água para evitar espelhamento simétrico entre águas opostas.
  const seedAgua = (seed + Math.imul(Math.round(dvx * 4), 1973) + Math.imul(Math.round(dvy * 4), 9277)) | 0;

  if (a.peca === 'agua') {
    // 1a. Remendos de reposição (agrupamentos determinísticos de peças de outro tom).
    if (damage > 0.08 || dirt > 0.25) {
      const forcaRemendo = Math.max(damage, (dirt - 0.22) * 0.8);
      const hRem = hashDaPeca(am0.id, seedAgua + 457);
      const zonaRem = fbm(rn, mx * 0.72 + 17.3, my * 0.72 + 29.1, 2);
      const limiarZona = 0.66 - forcaRemendo * 0.24;
      const ehRemendo = (zonaRem > limiarZona && hRem < 0.44 + forcaRemendo * 0.28) || hRem < forcaRemendo * 0.065;
      if (ehRemendo) {
        const tipoRem = hashDaPeca(am0.id, seedAgua + 461);
        if (tipoRem < 0.52) {
          // Peça trocada mais clara / madeira nova ou telha recente.
          const k = 0.26 + 0.24 * hashDaPeca(am0.id, seedAgua + 467);
          mixRgb(rgb, ctx.corMatClaro, k);
        } else {
          // Peça de reposição mais escura / envelhecida.
          const k = 0.26 + 0.24 * hashDaPeca(am0.id, seedAgua + 471);
          mixRgb(rgb, ctx.corMatEscuro, k);
        }
      }
    }

    if (damage > 0) {
      const hPeca = hashDaPeca(am0.id, seedAgua + 401);

      // 1b. Buracos maiores quando damage > 0.6 (ruído de baixa frequência modulado pelos limites das peças).
      if (damage > 0.6) {
        const nBuraco = fbm(rn, mx * 0.55 + 3.1, my * 0.55 + 7.7, 3);
        const modPeca = (hashDaPeca(am0.id, seedAgua + 431) - 0.5) * 0.16;
        const intensidade = (damage - 0.6) / 0.4; // 0..1
        const limiarBuraco = 0.76 - intensidade * 0.22;
        const campoBuraco = nBuraco + modPeca - (1 - am0.h) * 0.05;
        if (campoBuraco > limiarBuraco) {
          emBuraco = true;
          pintarVaoComRipas(a.u, a.v, seed, a, pixel, saida);
        } else if (campoBuraco > limiarBuraco - 0.065) {
          // Borda quebrada e escurecida ao redor do buraco grande.
          const kBorda = entre(limiarBuraco - 0.065, limiarBuraco, campoBuraco);
          mixRgb(rgb, COR_BORDA_QUEBRADA, kBorda * 0.72);
          if (!pixel) {
            saida.ao *= 1 - 0.45 * kBorda;
          }
        }
      }

      // 1c. Peças faltando (hashDaPeca < damage * 0.15).
      if (!emBuraco && hPeca < damage * 0.15) {
        emBuraco = true;
        pintarVaoComRipas(a.u, a.v, seed, a, pixel, saida);
      } else if (!emBuraco && hPeca < damage * 0.25) {
        // 1d. Peças tortas / soltas (banda damage * 0.15 .. damage * 0.25).
        const hTom = hashDaPeca(am0.id, seedAgua + 419);
        const deltaTom = 1 + (hTom - 0.5) * 0.24; // ±12%
        rgb[0] = clamp(rgb[0] * deltaTom, 0, 255);
        rgb[1] = clamp(rgb[1] * deltaTom, 0, 255);
        rgb[2] = clamp(rgb[2] * deltaTom, 0, 255);
        if (!pixel) {
          const ang = (hashDaPeca(am0.id, seedAgua + 409) - 0.5) * 0.65;
          const cosA = Math.cos(ang);
          const sinA = Math.sin(ang);
          const ngx = saida.gx * cosA - saida.gy * sinA + (hTom - 0.5) * 0.35;
          const ngy = saida.gx * sinA + saida.gy * cosA + (hashDaPeca(am0.id, seedAgua + 421) - 0.5) * 0.35;
          saida.gx = ngx;
          saida.gy = ngy;
          // AO reforçado na borda da peça levantada/torta.
          const borda = 1 - entre(0.15, 0.55, am0.h);
          saida.ao *= 0.88 - 0.26 * borda;
        }
      }
    }
  }

  // =========================================================================
  // 2. SUJEIRA (rincões, entorno de chaminés, beiral, manchas gerais e folhas secas)
  // =========================================================================
  if (dirt > 0 && !emBuraco) {
    let suj = 0;

    // 2a. Rincões (folgaRincao < 0.35).
    if (a.folgaRincao < 0.35) {
      suj = Math.max(suj, (1 - entre(0, 0.35, a.folgaRincao)) * 0.9);
    }

    // 2b. Entorno imediato da base de chaminés (dist < 0.55 m).
    for (let i = 0; i < chamines.length; i++) {
      const ch = chamines[i]!;
      const dist = Math.hypot(mx - ch.x, my - ch.y);
      if (dist < 0.55) {
        suj = Math.max(suj, (1 - entre(0.12, 0.55, dist)) * 0.85);
      }
    }

    // 2c. Últimos 30 cm do beiral em águas inclinadas (a.v < 0.30).
    const inclBase = Math.hypot(a.gx, a.gy);
    if (a.peca !== 'plano' && inclBase > 0.05 && a.v < 0.30) {
      const nBeir = fbm(rn, a.u * 2.4 + 11.3, a.v * 3.0 + 5.7, 2);
      const fBeir = (1 - entre(0.02, 0.30, a.v)) * (0.65 + 0.35 * nBeir);
      suj = Math.max(suj, fBeir * 0.72);
    }

    // 2d. Manchas orgânicas de sujeira/apodrecimento sobre a cobertura quando dirt > 0.22.
    if (dirt > 0.22) {
      const excesso = (dirt - 0.22) / 0.78;
      const nMancha = fbm(rn, mx * 1.05 + 41.2, my * 1.05 + 19.8, 3);
      const nFio = fbm(rn, a.u * 2.6 + 61.1, a.v * 0.8 + 13.4, 2);
      const combinada = nMancha * 0.65 + nFio * 0.35 + (1 - am0.h) * 0.14;
      const mancha = entre(0.68 - excesso * 0.26, 0.90 - excesso * 0.18, combinada) * excesso * 0.82;
      suj = Math.max(suj, mancha);
    }

    const kSuj = lim(suj * dirt);
    if (kSuj > 0.005) {
      mixRgb(rgb, COR_SUJEIRA, kSuj * 0.62);
      const esc = 1 - kSuj * 0.22;
      rgb[0] *= esc;
      rgb[1] *= esc;
      rgb[2] *= esc;
      if (!pixel) {
        saida.ao *= 1 - kSuj * 0.32;
      }
    }

    // 2e. Folhas secas caídas nos rincões quando dirt > 0.5 e folgaRincao < 0.18.
    if (dirt > 0.5 && a.folgaRincao < 0.18) {
      const dens = ((dirt - 0.5) * 2) * (1 - a.folgaRincao / 0.18);
      const cell = 0.055;
      const ci = Math.floor(mx / cell);
      const cj = Math.floor(my / cell);
      const hFolha = hash2D(ci, cj, seed + 521);
      if (hFolha < dens * 0.52) {
        const fx = mx / cell - ci - (0.25 + 0.5 * hash2D(ci, cj, seed + 523));
        const fy = my / cell - cj - (0.25 + 0.5 * hash2D(ci, cj, seed + 527));
        const ang = hash2D(ci, cj, seed + 541) * Math.PI;
        const cA = Math.cos(ang);
        const sA = Math.sin(ang);
        const lx = (fx * cA + fy * sA) / 0.34;
        const ly = (-fx * sA + fy * cA) / 0.18;
        const r2 = lx * lx + ly * ly;
        if (r2 < 1) {
          const hCor = hash2D(ci, cj, seed + 547);
          const corF = hCor < 0.33 ? COR_FOLHA_1 : hCor < 0.66 ? COR_FOLHA_2 : COR_FOLHA_3;
          const kF = 1 - entre(0.4, 1.0, r2);
          mixRgb(rgb, corF, kF * 0.88);
          if (!pixel) {
            saida.ao *= 0.86 + 0.14 * (1 - kF);
          }
        }
      }
    }
  }

  // =========================================================================
  // 3. FULIGEM (pluma esfumaçada a sotavento `+x` em volta de cada chaminé)
  // =========================================================================
  if (chamines.length > 0 && !emBuraco) {
    let fuligem = 0;
    for (let i = 0; i < chamines.length; i++) {
      const ch = chamines[i]!;
      const dx = mx - ch.x;
      const dy = my - ch.y;
      if (dx < -0.45 || dx > 1.75 || Math.abs(dy) > 0.95) continue;

      const hAlc = hash2D(Math.round(ch.x * 10), Math.round(ch.y * 10), seed + 509);
      const alcance = 1.05 + hAlc * 0.55; // ~1.05–1.60 m a sotavento (+x)
      const dist = Math.hypot(dx, dy);

      // Halo curto em volta da chaminé.
      const halo = 1 - entre(0.14, 0.42, dist);

      // Pluma alongada em +x com largura ~0.45 m que se dispersa com a distância.
      let pluma = 0;
      if (dx > -0.25 && dx < alcance) {
        const tX = clamp((dx + 0.2) / (alcance + 0.2), 0, 1);
        const meiaLarg = 0.22 + tX * 0.26; // ~0.44..0.96 m de largura total (meia ~0.22..0.48 m)
        const lat = 1 - entre(0, meiaLarg, Math.abs(dy));
        const lon = entre(-0.25, 0.12, dx) * (1 - entre(alcance * 0.35, alcance, dx));
        const nPluma = fbm(rn, mx * 2.1 + 73.4, my * 2.1 + 19.2, 3);
        pluma = lat * lon * (0.45 + 0.85 * nPluma);
      }

      const fLocal = Math.max(halo * 0.72, pluma * 0.82);
      if (fLocal > fuligem) fuligem = fLocal;
    }

    if (fuligem > 0.01) {
      const kFul = lim(fuligem * (0.78 + 0.22 * dirt));
      mixRgb(rgb, COR_FULIGEM, kFul * 0.78);
      if (!pixel) {
        saida.ao *= 1 - kFul * 0.25;
      }
    }
  }

  // =========================================================================
  // 4. MUSGO (fios esticados na queda, juntas/frestas, lado norte `-y`, rincões)
  // =========================================================================
  if (moss > 0 && !emBuraco) {
    // Diferencia águas simétricas sem quebrar continuidade dentro da mesma água.
    const offU = Math.round(dvx * 2) * 17.3 + Math.round(dvy * 2) * 29.1;
    const offV = Math.round(dvx * 2) * 31.7 - Math.round(dvy * 2) * 13.9;

    // Ruído fbm esticado na direção da queda: (u * 3.0, v * 0.6) + estrias finas nos canais.
    const nFio = fbm(rn, a.u * 3.0 + offU, a.v * 0.6 + offV, 3);
    const nEstria = fbm(rn, a.u * 6.4 + offU + 19.2, a.v * 0.42 + offV + 8.7, 2);
    const nDetalhe = fbm(rn, a.u * 7.8 + offU + 51.4, a.v * 2.4 + offV + 23.8, 2);

    // Orientação: mais forte nas águas voltadas para -y (norte: até ~1.5×), mais fraco em +y (~0.6×).
    const fatorNorte = dvy < 0 ? 1 + -dvy * 0.5 : 1 - dvy * 0.4;

    // Nasce nas juntas/frestas (1 - am0.h) e escorre em fios em direção ao beiral (a.v menor).
    const fresta = 1 - entre(0.12, 0.72, am0.h);
    const escorrimento = 0.84 + 0.28 * (1 - entre(0.15, 2.4, a.v));
    const bonusRincao = a.folgaRincao < 0.30 ? (1 - entre(0, 0.30, a.folgaRincao)) * 0.42 : 0;

    // Combina o campo de fios alongados com a afinidade pelas juntas e a intensidade de moss.
    const fios = nFio * 0.52 + nEstria * 0.34 + nDetalhe * 0.14;
    const potencial = (fios * 0.88 + fresta * 0.30 + bonusRincao) * fatorNorte * escorrimento;
    const limiar = 0.94 - moss * 0.50;
    const kMusgo = entre(limiar, limiar + 0.22, potencial) * (0.62 + 0.38 * moss);

    if (kMusgo > 0.01) {
      // Mistura entre frestas escuras, base e pontas mais claras.
      const tomM = lim(nDetalhe * 0.65 + am0.h * 0.35);
      const mr = tomM < 0.45
        ? ctx.corMusgoEscuro[0] + (ctx.corMusgoBase[0] - ctx.corMusgoEscuro[0]) * (tomM / 0.45)
        : ctx.corMusgoBase[0] + (ctx.corMusgoClaro[0] - ctx.corMusgoBase[0]) * ((tomM - 0.45) / 0.55);
      const mg = tomM < 0.45
        ? ctx.corMusgoEscuro[1] + (ctx.corMusgoBase[1] - ctx.corMusgoEscuro[1]) * (tomM / 0.45)
        : ctx.corMusgoBase[1] + (ctx.corMusgoClaro[1] - ctx.corMusgoBase[1]) * ((tomM - 0.45) / 0.55);
      const mb = tomM < 0.45
        ? ctx.corMusgoEscuro[2] + (ctx.corMusgoBase[2] - ctx.corMusgoEscuro[2]) * (tomM / 0.45)
        : ctx.corMusgoBase[2] + (ctx.corMusgoClaro[2] - ctx.corMusgoBase[2]) * ((tomM - 0.45) / 0.55);

      const alfaM = lim(kMusgo * 0.92);
      rgb[0] = rgb[0] + (mr - rgb[0]) * alfaM;
      rgb[1] = rgb[1] + (mg - rgb[1]) * alfaM;
      rgb[2] = rgb[2] + (mb - rgb[2]) * alfaM;

      if (!pixel) {
        // Musgo espesso suaviza levemente o micro-relevo das telhas.
        const suav = alfaM * 0.45;
        saida.gx = saida.gx + (a.gx - saida.gx) * suav;
        saida.gy = saida.gy + (a.gy - saida.gy) * suav;
      }
    }
  }

  // =========================================================================
  // 5. NEVE (aplicada POR ÚLTIMO para cobrir musgo e sujeira abaixo)
  // =========================================================================
  if (snow > 0) {
    const incl = Math.hypot(a.gx, a.gy);
    // Nada acumula acima de 55° (hypot(gx, gy) >= tan(55°) ≈ 1.428).
    const fIncl = incl >= TAN_55 ? 0 : Math.pow(1 - incl / TAN_55, 0.85);

    if (fIncl > 0 || a.peca === 'cumeeira' || a.peca === 'espigao' || a.folgaRincao < 0.30) {
      // Degelo em anel em volta de cada chaminé (dist < 0.45..0.90 m).
      let fDegelo = 1;
      for (let i = 0; i < chamines.length; i++) {
        const ch = chamines[i]!;
        const dist = Math.hypot(mx - ch.x, my - ch.y);
        if (dist < 1.05) {
          const jitter = (fbm(rn, mx * 3.1 + 19.1, my * 3.1 + 83.7, 2) - 0.5) * 0.16;
          const d = entre(0.45 + jitter, 0.90 + jitter, dist);
          if (d < fDegelo) fDegelo = d;
        }
      }

      if (fDegelo > 0.005) {
        const nDeriva = fbm(rn, mx * 0.92 + 101.3, my * 0.92 + 43.7, 3);
        const nFino = fbm(rn, mx * 3.4 + 17.9, my * 3.4 + 71.2, 2);

        const bonusRincao = a.folgaRincao < 0.35 ? (1 - entre(0, 0.35, a.folgaRincao)) * 0.36 : 0;
        const bonusCrista = a.peca === 'cumeeira' || a.peca === 'espigao' ? 0.24 : 0;
        // Borda pendurada/arredondada no beiral (distAresta < 0.14).
        let bonusBeiral = 0;
        if (a.distAresta < 0.14 && a.peca !== 'plano') {
          const ondaBeiral = fbm(rn, a.u * 2.6 + 5.1, 1.7, 2);
          bonusBeiral = (1 - entre(0.02, 0.14, a.distAresta)) * (0.14 + 0.16 * ondaBeiral);
        }

        // Em buracos abertos, neve só pega de leve nas bordas/ripas.
        const fBuraco = emBuraco ? 0.18 : 1;

        const baseAcu = (fIncl * (0.72 + 0.48 * nDeriva) + bonusRincao + bonusCrista + bonusBeiral) * snow * fDegelo * fBuraco;
        // Quando incl >= TAN_55, só permite acúmulo nulo em águas puras.
        const efetivo = incl >= TAN_55 && a.peca === 'agua' && a.folgaRincao >= 0.30 ? 0 : baseAcu;
        const kNeve = entre(0.24, 0.56, efetivo);

        if (kNeve > 0.01) {
          // Branco frio sombreado (#e9f0f7 a #c8d6e6) com variação sutil de deriva.
          const tomN = lim(0.35 + 0.45 * nDeriva + 0.2 * nFino - (a.distAresta < 0.04 ? 0.25 : 0));
          const nr = COR_NEVE_SOMBRA[0] + (COR_NEVE_ALTA[0] - COR_NEVE_SOMBRA[0]) * tomN;
          const ng = COR_NEVE_SOMBRA[1] + (COR_NEVE_ALTA[1] - COR_NEVE_SOMBRA[1]) * tomN;
          const nb = COR_NEVE_SOMBRA[2] + (COR_NEVE_ALTA[2] - COR_NEVE_SOMBRA[2]) * tomN;

          rgb[0] = rgb[0] + (nr - rgb[0]) * kNeve;
          rgb[1] = rgb[1] + (ng - rgb[1]) * kNeve;
          rgb[2] = rgb[2] + (nb - rgb[2]) * kNeve;

          if (!pixel) {
            // Apaga o micro-relevo das telhas suavizando (gx, gy) para o gradiente suave da água base (a.gx, a.gy).
            const suavN = kNeve * 0.92;
            saida.gx = saida.gx + (a.gx - saida.gx) * suavN;
            saida.gy = saida.gy + (a.gy - saida.gy) * suavN;

            // Borda pendurada/arredondada no beiral inclina suavemente para fora.
            if (a.distAresta < 0.14 && a.peca !== 'plano') {
              const arred = (1 - entre(0, 0.14, a.distAresta)) * kNeve;
              saida.gx -= dvx * 0.45 * arred;
              saida.gy -= dvy * 0.45 * arred;
            }

            // Suaviza o AO de juntas cobertas pela neve, mantendo leve sombra na borda extrema.
            const aoAlvo = a.distAresta < 0.03 ? 0.72 : 0.96;
            saida.ao = saida.ao + (aoAlvo - saida.ao) * (kNeve * 0.65);
          }
        }
      }
    }
  }
}
