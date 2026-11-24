import { elipse, poli, type DescricaoDePiso, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, silhuetaDeDiscos, tira, tonsComLuz, tufo, type Disco, type Tons } from '../organico.ts';
import type { GeradorPesado } from './index.ts';

const num = (v: unknown, padrao: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : padrao);

/** Uma folha em forma de lente: da base (x, y) para a direção `ang`, com `len` de comprimento e `w` de largura. */
export function folha(x: number, y: number, ang: number, len: number, w: number, mat: string, z: number, extra: Partial<Parte> = {}): Parte {
  const c = Math.cos(ang), s = Math.sin(ang), local = [0, 0, len * 0.3, w / 2, len * 0.7, w / 3, len, 0, len * 0.7, -w / 3, len * 0.3, -w / 2];
  const pts: number[] = []; for (let i = 0; i < local.length; i += 2) pts.push(x + local[i]! * c - local[i + 1]! * s, y + local[i]! * s + local[i + 1]! * c);
  return poli(pts, mat, z, { contorno: false, sombraLeve: true, ...extra });
}
/** Uma estrela de `pontas` pontas (copa de pinheiro): raio externo `re`, interno `ri`. */
const estrela = (cx: number, cy: number, pontas: number, re: number, ri: number, giro: number): number[] => { const pts: number[] = []; for (let i = 0; i < pontas * 2; i++) { const a = giro + (i / (pontas * 2)) * Math.PI * 2, r = i % 2 ? ri : re; pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } return pts; };

/** Os tons das copas: verde de mata, verde-claro de jardim e neve (com o verde-escuro só nas frestas). */
const VERDE: Tons = { fundo: '#122a18', base: '#24492b', meio: '#35643a', luz: '#4f8547', brilho: '#79a95c' };
const VERDE_CLARO: Tons = { fundo: '#173520', base: '#2c5a31', meio: '#417a42', luz: '#5f9a51', brilho: '#8dbf6b' };
const NEVE: Tons = { fundo: '#36504c', base: '#b0c2d8', meio: '#d9e4f0', luz: '#f0f5fa', brilho: '#ffffff' };

/**
 * Copa vista de cima, como nas copas ilustradas: uma silhueta lobada (a única parte com contorno e sombra) e, por cima, tufos em três anéis,
 * de fora para dentro, cada um pintado do escuro à luz para o noroeste. `miudo` (0 a 1) troca poucos tufos grandes por muitos pequenos.
 */
function copaDeTufos(diametro: number, seed: number, tons: Tons, { miudo = 0.3, folhas = 4, tronco = true, recorte = 10 }: { miudo?: number; folhas?: number; tronco?: boolean; recorte?: number } = {}): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], discos: (Disco & { z: number })[] = [];
  const anel = (n: number, dist: number, raio: number, z: number): void => {
    const giro = r() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.35, rr = raio * (0.85 + r() * 0.3), d = Math.min(dist * (0.92 + r() * 0.12), R - rr);
      discos.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rr, z: z + r() * 0.05 });
    }
  };
  const k = 1 - miudo * 0.35, ext = 0.34 * k, med = 0.31 * k;
  anel(Math.round((7 + R * 1.2) / k), R * (1 - ext), R * ext, 2.2);
  anel(Math.round((4 + R * 0.6) / k), R * 0.42, R * med, 2.6);
  anel(Math.round(2 + miudo * 3), R * 0.14, R * med, 3);
  if (tronco) partes.push(elipse(R * 0.05, R * 0.08, R * 0.2, R * 0.2, 'madeira.escura', 1.2, { contorno: false, semSombra: true, detalhe: 3 }));
  partes.push(poli(silhuetaDeDiscos(discos, 120), tons.fundo, 2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (const d of discos.sort((a, b) => a.z - b.z)) {
    const lado = (d.x * LUZ_X + d.y * LUZ_Y) / R;   // 1: virado para a luz; −1: o lado da sombra
    tufo(partes, r, d.x, d.y, d.r, tonsComLuz(tons, lado * 0.12 - (d.z < 2.5 ? 0.04 : 0)), d.z, folhas, 18, recorte);
  }
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

/** Os tons de outono (`tons: 'outono-laranja' | 'outono-vermelha'`) de `arvore` e `carvalho-grande`, ou `null` para o verde de cada uma. */
const outono = (t: unknown): Partial<OpcoesDaCopa> | null =>
  t === 'outono-laranja' ? { tons: LARANJA, variantes: [AMARELO_OUTONO, VERMELHO], nanquim: NANQUIM_OUTONO, galhos: '#3a2a1e' }
    : t === 'outono-vermelha' ? { tons: VERMELHO, variantes: [LARANJA, VINHO], nanquim: NANQUIM_OUTONO, galhos: '#3a2a1e' } : null;
const copaRedonda = (diametro: number, seed: number, tons?: unknown): DescricaoDePiso => copaDeRaminhos(diametro, seed, { tons: JARDIM, variantes: [JARDIM_SOL, JARDIM_FRIO], folha: Math.min(0.85, 0.45 + diametro * 0.07), ralo: 0, ...outono(tons) });

/**
 * Conífera vista de cima: silhueta de muitas pontas irregulares e, por cima, cinco camadas de ramos em lente fina, do escuro de fora ao claro
 * do topo, com agulhas nas bordas; os ramos virados para a luz clareiam. Com `neve`, a neve cobre o meio de cada ramo (branca na luz, azulada
 * na sombra) e o verde só aparece nas pontas e nas frestas.
 */
function conifera(diametro: number, seed: number, neve: boolean): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], pontas = Math.round(22 + R * 4), luz = Math.atan2(LUZ_Y, LUZ_X);
  const verdes = neve ? ['#143426', '#1b422f', '#235139', '#2d6043', '#386e4d'] : ['#173f2c', '#1f5036', '#296141', '#34734c', '#418559'];
  const borda: number[] = []; for (let i = 0; i < pontas * 2; i++) { const a = (i / (pontas * 2)) * Math.PI * 2, rr = i % 2 ? R * (0.72 + r() * 0.08) : R * (0.86 + r() * 0.14); borda.push(Math.cos(a) * rr, Math.sin(a) * rr); }
  partes.push(poli(borda, '#0f241a', 2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  const o = { contorno: false as const, semSombra: true, suave: true };
  for (let c = 0; c < verdes.length; c++) {
    const raio = R * (0.96 - c * 0.17), n = Math.round(pontas * (1 - c * 0.12)), giro = r() * Math.PI, z = 2.1 + c * 0.3;
    for (let i = 0; i < n; i++) {
      const a = giro + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.2, f = Math.cos(a - luz), len = raio * (0.72 + r() * 0.28), w = raio * 0.26, x0 = Math.cos(a) * raio * 0.08, y0 = Math.sin(a) * raio * 0.08;
      const cor = tom(verdes[c]!, f * 0.1);
      partes.push(lente(x0, y0, a, len, w, cor, z, { ...o, detalhe: 1 }));
      for (let k = 1; k <= 3; k++) for (const lado of [-1, 1]) partes.push(lente(x0 + Math.cos(a) * len * (0.25 + k * 0.18), y0 + Math.sin(a) * len * (0.25 + k * 0.18), a + lado * 0.55, len * 0.22, w * 0.14, tom(cor, lado * f > 0 ? 0.14 : -0.2), z + 0.005, { ...o, detalhe: 3 }));
      if (neve) {
        const ox = LUZ_X * w * 0.12, oy = LUZ_Y * w * 0.12;
        partes.push(lente(x0 + ox, y0 + oy, a, len * 0.9, w * 1.05, f > -0.15 ? '#dfe8f3' : '#b3c4da', z + 0.02, { ...o, detalhe: 1 }));
        if (f > -0.5) partes.push(lente(x0 + ox * 2, y0 + oy * 2, a, len * 0.72, w * 0.62, f > 0.3 ? '#ffffff' : '#eef3f9', z + 0.025, { ...o, detalhe: 2 }));
      } else partes.push(lente(x0, y0, a + 0.05 * Math.sign(f || 1), len * 0.75, w * 0.35, tom(cor, 0.1 + Math.max(0, f) * 0.15), z + 0.01, { ...o, detalhe: 2 }));
    }
  }
  if (neve) partes.push(poli(bolha(R * 0.03, R * 0.03, R * 0.2, R * 0.2, 14, 0.2, r), '#c3d1e2', 3.5, { ...o, detalhe: 1 }), poli(bolha(LUZ_X * R * 0.04, LUZ_Y * R * 0.04, R * 0.16, R * 0.16, 14, 0.2, r), '#eef3f9', 3.55, { ...o, detalhe: 1 }));
  partes.push(poli(bolha(LUZ_X * R * 0.05, LUZ_Y * R * 0.05, R * 0.12, R * 0.12, 10, 0.2, r), neve ? '#ffffff' : '#4f9363', 3.6, { ...o, detalhe: 2 }));
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

const pinheiro = (diametro: number, seed: number): DescricaoDePiso => conifera(diametro, seed, false);
/** Árvore vista de cima coberta de neve: copa de tufos brancos sombreados de azul, o verde só nas frestas. */
const arvoreNevada = (diametro: number, seed: number): DescricaoDePiso => copaDeRaminhos(diametro, seed, { tons: NEVADA, variantes: [NEVADA_SOL, NEVADA_FRIA], folha: 0.9, ralo: 0.15, nanquim: ['#1a2330', '#2c3846'], galhos: '#3a3430' });
/** Pinheiro de neve: a conífera com neve sobre cada ramo, do lado da luz. */
const pinheiroNevado = (diametro: number, seed: number): DescricaoDePiso => conifera(diametro, seed, true);
/** Carvalho: copa densa de muitos tufos pequenos, com folhas pintadas. */
const carvalhoGrande = (diametro: number, seed: number, tons?: unknown): DescricaoDePiso => copaDeRaminhos(diametro, seed, { tons: CARVALHO, variantes: [CARVALHO_SOL, CARVALHO_FRIO], folha: 0.8, ralo: 0.05, ...outono(tons) });

/** Tons da mata fechada: verde-oliva acinzentado, com moitas amareladas e outras mais frias (ver `copaDeRaminhos`). */
const OLIVA: Tons = { fundo: '#272a1c', base: '#4a4e33', meio: '#5e633e', luz: '#777b4d', brilho: '#91935e' };
const AMARELADO: Tons = { fundo: '#30291a', base: '#56492b', meio: '#6a5b35', luz: '#806e42', brilho: '#968352' };
const FRIO: Tons = { fundo: '#20271e', base: '#384332', meio: '#46533f', luz: '#58654e', brilho: '#6f7b62' };
const NANQUIM = '#12150e';
/** Verdes das copas de raminhos fora da mata: carvalho (fundo e frio), jardim (vivo) e neve (branco sobre azul, o verde só nas frestas). */
const CARVALHO: Tons = { fundo: '#1c2a17', base: '#33502c', meio: '#43663a', luz: '#5a7e48', brilho: '#76985a' };
const CARVALHO_SOL: Tons = { fundo: '#2a2c18', base: '#4e582e', meio: '#64703a', luz: '#7e8a4a', brilho: '#98a25c' };
const CARVALHO_FRIO: Tons = { fundo: '#16241c', base: '#2a4234', meio: '#365440', luz: '#466a50', brilho: '#5c8064' };
const JARDIM: Tons = { fundo: '#1e3018', base: '#3a5e2e', meio: '#4c763a', luz: '#64904a', brilho: '#84ac5e' };
const JARDIM_SOL: Tons = { fundo: '#2c3418', base: '#566a2e', meio: '#6c843a', luz: '#889e4a', brilho: '#a6b85e' };
const JARDIM_FRIO: Tons = { fundo: '#1c2e1e', base: '#345634', meio: '#426a40', luz: '#568252', brilho: '#6e9a68' };
const NEVADA: Tons = { fundo: '#3a4c58', base: '#9aaec4', meio: '#c4d2e2', luz: '#e4ecf4', brilho: '#ffffff' };
const NEVADA_SOL: Tons = { fundo: '#465860', base: '#a8b8c8', meio: '#d0dce6', luz: '#eef2f6', brilho: '#ffffff' };
const NEVADA_FRIA: Tons = { fundo: '#2e4050', base: '#8aa0ba', meio: '#b2c4da', luz: '#d6e2f0', brilho: '#f2f6fb' };
/** Outono: laranja (com moitas amarelas e vermelhas), vermelho (com laranja e vinho); o nanquim é castanho, não verde. */
const LARANJA: Tons = { fundo: '#3a1d0c', base: '#86421a', meio: '#a85a20', luz: '#c97a2a', brilho: '#e4a242' };
const AMARELO_OUTONO: Tons = { fundo: '#3a2a0e', base: '#8a6a1c', meio: '#a88524', luz: '#c6a232', brilho: '#e0c04c' };
const VERMELHO: Tons = { fundo: '#34110e', base: '#7c2618', meio: '#9c361e', luz: '#bc4e28', brilho: '#d8723a' };
const VINHO: Tons = { fundo: '#2a0e12', base: '#5e1c20', meio: '#7a2828', luz: '#963a32', brilho: '#b05440' };
const NANQUIM_OUTONO = ['#1a0f08', '#26160c'] as const;
/** A cor entre `a` e `b` (t de 0 a 1): os raminhos variam em tons contínuos, não em degraus. */
export function misturar(a: string, b: string, t: number): string {
  const p = (h: string, k: number) => parseInt(h.slice(1 + k * 2, 3 + k * 2), 16), c = [0, 1, 2].map(k => Math.round(p(a, k) + (p(b, k) - p(a, k)) * t));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Um raminho visto de cima: braços (ângulo, comprimento, largura) saindo de (x, y). Sorteado uma vez e desenhado duas (nanquim e cor). */
interface Raminho { x: number; y: number; bracos: { a: number; len: number; w: number }[] }

function sortearRaminho(r: () => number, x: number, y: number, raio: number): Raminho {
  const n = 9 + Math.floor(r() * 4), giro = r() * Math.PI * 2, bracos: Raminho['bracos'] = [];
  for (let i = 0; i < n; i++) bracos.push({ a: giro + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.4, len: raio * (0.6 + r() * 0.4), w: raio * (0.11 + r() * 0.04) });
  return { x, y, bracos };
}

/** Desenha o raminho: cada braço é uma lente com dois pares de folíolos em ponta, o que serrilha a borda. `engorda` (m) alarga tudo: o nanquim. */
function desenharRaminho(partes: Parte[], f: Raminho, cor: string, z: number, engorda: number, sombra: boolean): void {
  const o = { contorno: false as const, suave: true };
  for (const b of f.bracos) {
    const c = Math.cos(b.a), s = Math.sin(b.a);
    partes.push(lente(f.x, f.y, b.a, b.len + engorda, b.w + engorda * 2, cor, z, { ...o, ...(sombra ? { sombraLeve: true } : { semSombra: true }), detalhe: 1 }));
    for (const [t, k] of [[0.3, 0.42], [0.52, 0.34], [0.72, 0.24]] as const) for (const lado of [-1, 1]) {
      const a = b.a + lado * 0.65;
      partes.push(lente(f.x + c * b.len * t, f.y + s * b.len * t, a, b.len * k + engorda, b.w * 0.6 + engorda * 2, cor, z, { ...o, semSombra: true, detalhe: 2 }));
    }
  }
}

/**
 * Copa de mata vista de cima, desenhada como nas copas de mapas de batalha pintados à mão. Não há uma massa redonda: a copa é feita de
 * raminhos estrelados (folíolos em ponta) em três camadas, da de baixo (raminhos maiores e escuros, que fazem a silhueta) à de cima (menores
 * e claros, só no miolo das moitas). Cada camada tem o nanquim por baixo de todos os seus raminhos, então a borda da copa e a de cada camada
 * seguem as pontas das folhas. Moitas de tamanhos bem diferentes dão o contorno irregular; galhos aparecem entre as camadas; os vãos são
 * escuros. A luz vem do noroeste. `ralo` (0 a 1) espaça os raminhos.
 */
export interface OpcoesDaCopa { ralo: number; tons: Tons; variantes: readonly [Tons, Tons]; folha: number; nanquim: readonly [string, string]; galhos: string }
export function copaDeRaminhos(diametro: number, seed: number, { ralo = 0.2, tons = OLIVA, variantes = [AMARELADO, FRIO], folha = 1, nanquim = [NANQUIM, '#1d2116'], galhos = '#4a3828' }: Partial<OpcoesDaCopa> = {}): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2 - 0.3 * folha, partes: Parte[] = [];
  // Moitas: uma grande perto do miolo e de 2 a 6 em volta, com raios bem diferentes; a copa é a união delas.
  const moitas: { x: number; y: number; r: number; tons: Tons }[] = [];
  const variar = (): Tons => (r() < 0.14 ? (r() < 0.4 ? variantes[0] : variantes[1]) : tons);
  moitas.push({ x: (r() - 0.5) * R * 0.25, y: (r() - 0.5) * R * 0.25, r: R * (0.5 + r() * 0.1), tons: variar() });
  const nM = 2 + Math.floor(R * 0.8 + r() * 2), giro = r() * Math.PI * 2;
  for (let i = 0; i < nM; i++) {
    const a = giro + (i / nM) * Math.PI * 2 + (r() - 0.5) * 0.9, rm = R * (0.26 + r() * 0.22), d = Math.max(0, R - rm * (1 + r() * 0.25));
    moitas.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rm, tons: variar() });
  }
  // Os vãos entre os raminhos de baixo são sombra da própria copa, não chão.
  for (const m of moitas) partes.push(poli(bolha(m.x, m.y, m.r * 0.78, m.r * 0.78, 14, 0.2, r), '#0c0f09', 1.8, { contorno: false, semSombra: true, suave: true, alfa: 0.85, desfoque: m.r * 0.15, detalhe: 1 }));
  // Galhos: do tronco para fora, entre a camada de baixo e a do meio.
  const nG = 4 + Math.floor(r() * 3);
  for (let i = 0; i < nG; i++) {
    const a = (i / nG) * Math.PI * 2 + r() * 0.7, len = R * (0.38 + r() * 0.18), mx = Math.cos(a) * len * 0.5 + (r() - 0.5) * 0.3, my = Math.sin(a) * len * 0.5 + (r() - 0.5) * 0.3;
    partes.push(tira([0, 0, mx, my, Math.cos(a + (r() - 0.5) * 0.4) * len, Math.sin(a + (r() - 0.5) * 0.4) * len], (0.1 + R * 0.025) * Math.min(1, folha * 1.5), galhos, 2.12, { contorno: 'leve', semSombra: true, detalhe: 1 }, 0.3));
  }
  // Camadas: raio do raminho, até onde vai na moita e a altura.
  const camadas = [{ raio: 0.68 * folha, alcance: 0.92, z: 2 }, { raio: 0.56 * folha, alcance: 0.66, z: 2.3 }, { raio: 0.45 * folha, alcance: 0.4, z: 2.6 }];
  camadas.forEach((cam, c) => {
    const lista: { f: Raminho; cor: string }[] = [], minimo = cam.raio * (0.85 + ralo * 0.6);
    for (const m of moitas) {
      const alcance = Math.max(0.05, m.r * cam.alcance - cam.raio * 0.35), alvo = Math.ceil((Math.PI * alcance * alcance) / (minimo * minimo) * 1.2) + 1;
      const aqui: { x: number; y: number }[] = [];
      for (let t = 0; t < alvo * 12 && aqui.length < alvo; t++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * alcance, x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d;
        if (aqui.some(q => Math.hypot(q.x - x, q.y - y) < minimo)) continue;
        aqui.push({ x, y });
        // A cor: a camada de cima é mais clara; o lado noroeste da copa e de cada moita clareia, o sudeste escurece.
        const lado = (x * LUZ_X + y * LUZ_Y) / R * 0.6 + ((x - m.x) * LUZ_X + (y - m.y) * LUZ_Y) / m.r * 0.6 + (r() - 0.5) * 0.3;
        const escala = [m.tons.fundo, m.tons.base, m.tons.meio, m.tons.luz, m.tons.brilho], k = Math.max(0, Math.min(3.999, 1.5 + c * 0.9 + lado * 1.1 + (r() - 0.5) * 0.4)), k0 = Math.floor(k);
        lista.push({ f: sortearRaminho(r, x, y, cam.raio * (0.85 + r() * 0.3)), cor: misturar(escala[k0]!, escala[k0 + 1]!, k - k0) });
      }
    }
    // Os de fora primeiro: o miolo fica por cima.
    lista.sort((p, q) => Math.hypot(q.f.x, q.f.y) - Math.hypot(p.f.x, p.f.y));
    for (const { f } of lista) desenharRaminho(partes, f, nanquim[c === 0 ? 0 : 1], cam.z, (c === 0 ? 0.05 : 0.032) * Math.min(1, folha * 1.4), true);
    lista.forEach(({ f, cor }, i) => desenharRaminho(partes, f, cor, cam.z + 0.01 + (i / lista.length) * 0.02, 0, false));
  });
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

/** Arbusto sem folhas: galhos finos que se ramificam do centro (3 níveis), de 1 a 3 cm; com `neve`, tufos brancos nos nós. */
function arbustoSeco(diametro: number, seed: number, neve: boolean): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], cores = ['#3a2c22', '#5b4636'];
  const galho = (x: number, y: number, ang: number, comp: number, nivel: number): void => {
    const larg = [0.05, 0.035, 0.02][nivel]!, ex = x + Math.cos(ang) * comp, ey = y + Math.sin(ang) * comp;
    partes.push(folha(x, y, ang, comp, larg, cores[nivel === 2 ? 1 : (r() < 0.5 ? 0 : 1)]!, 1 + nivel * 0.3 + r() * 0.05, { detalhe: nivel < 2 ? 1 : 2, semSombra: true }));
    if (neve && nivel > 0 && r() < 0.5) partes.push(elipse(ex, ey, 0.07, 0.05, '#f4f8fc', 2.5, { contorno: false, semSombra: true, detalhe: 3 }));
    if (nivel >= 2) return;
    const filhos = 2 + Math.floor(r() * 2);
    for (let i = 0; i < filhos; i++) { const t = 0.45 + r() * 0.5; galho(x + Math.cos(ang) * comp * t, y + Math.sin(ang) * comp * t, ang + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.5), comp * (0.5 + r() * 0.25), nivel + 1); }
  };
  const base = 5 + Math.floor(r() * 3);
  for (let i = 0; i < base; i++) galho(0, 0, (i / base) * Math.PI * 2 + r() * 0.5, R * (0.4 + r() * 0.15), 0);
  partes.push(elipse(0, 0, 0.1, 0.1, '#3a2c22', 0.9, { contorno: false, semSombra: true }));
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

/** Folhagem tropical: folhas largas e escuras saindo do centro, com nervura clara e recortes, em duas voltas. */
function folhagemTropical(diametro: number, seed: number): DescricaoDePiso {
  const r = mulberry32(seed), R = diametro / 2, partes: Parte[] = [], voltas = [['#12301c', '#1a4527'], ['#1f5a30', '#2b7040'], ['#2f7a45', '#3f9355']];
  for (let v = 0; v < voltas.length; v++) {
    const n = 6 + v * 2, len = R * (1 - v * 0.22);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + v * 0.4 + r() * 0.3, c = voltas[v]![i % 2]!, z = 1 + v * 0.8 + i * 0.02;
      partes.push(folha(0, 0, a, len, len * 0.5, tom(c, -0.3), z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), folha(0, 0, a, len * 0.94, len * 0.4, c, z + 0.1, { detalhe: 2, semSombra: true }));
      partes.push(folha(0, 0, a, len * 0.9, 0.025, tom(c, 0.45), z + 0.2, { detalhe: 3, semSombra: true }));
      for (const lado of [-1, 1]) for (let k = 1; k <= 3; k++) { const t = k / 4; partes.push(folha(Math.cos(a) * len * t, Math.sin(a) * len * t, a + lado * 0.9, len * 0.2, 0.015, tom(c, 0.3), z + 0.25, { detalhe: 3, semSombra: true })); }
    }
  }
  partes.push(elipse(0, 0, R * 0.2, R * 0.2, '#0f2a17', 4, { contorno: false, semSombra: true }));
  return { tipo: 'piso', pegada: [diametro, diametro], partes };
}

function arbusto(diametro: number, seed: number, flores: string | null): DescricaoDePiso {
  const g = copaDeRaminhos(diametro, seed, { tons: JARDIM, variantes: [JARDIM_SOL, JARDIM_FRIO], folha: 0.36, ralo: 0 }), r = mulberry32(seed + 5), partes = g.partes;
  if (flores) for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = (diametro / 2) * Math.sqrt(r()) * 0.5; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.07, 0.07, flores, 5.5 + r() * 0.2, { contorno: false, semSombra: true, detalhe: 3 })); }
  return { tipo: 'piso', pegada: g.pegada, partes };
}

function vaso(mat: string, d: number): Parte[] { return [elipse(0, 0, d, d, mat, 0.5, { contorno: 'leve' }), elipse(0, 0, d * 0.82, d * 0.82, '#2a1b12', 0.52, { contorno: false, semSombra: true }), elipse(0, 0, d * 0.6, d * 0.6, '#3a2618', 0.53, { contorno: false, semSombra: true, detalhe: 3 })]; }

/** Palmeira em vaso: frondes longas saindo do centro, cada uma com folíolos dos dois lados. */
function palmeira(seed: number, vasoMat: string): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [...vaso(vasoMat, 0.55)], frondes = 11;
  for (let f = 0; f < frondes; f++) {
    const a = (f / frondes) * Math.PI * 2 + r() * 0.3, comp = 0.55 + r() * 0.2, z = 0.8 + f * 0.04;
    partes.push(folha(0, 0, a, comp, 0.03, '#2c5a32', z, { detalhe: 2 }));
    for (let k = 1; k <= 9; k++) for (const lado of [-1, 1]) { const t = k / 9.5, ang = a + lado * (0.95 - t * 0.35); partes.push(folha(Math.cos(a) * comp * t * 0.9, Math.sin(a) * comp * t * 0.9, ang, 0.2 * (1 - t * 0.5), 0.045, k % 2 ? '#3a7a40' : '#2f6a38', z + 0.02 + k * 0.002, { detalhe: 3, semSombra: true })); }
  }
  partes.push(elipse(0, 0, 0.1, 0.1, '#1d3d24', 1.4, { contorno: false, semSombra: true }));
  return { tipo: 'piso', pegada: [1.1, 1.1], partes };
}

/** Samambaia em pedestal: pedestal de pedra e frondes arqueadas, cheias de folíolos pequenos. */
function samambaia(seed: number): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [elipse(0, 0, 0.5, 0.5, 'pedra.escura', 0.4, { contorno: 'leve' }), elipse(0, 0, 0.4, 0.4, '#3a3d44', 0.45, { contorno: false, semSombra: true })], frondes = 14;
  for (let f = 0; f < frondes; f++) {
    const a = (f / frondes) * Math.PI * 2 + r() * 0.25, comp = 0.5 + r() * 0.15, z = 0.8 + f * 0.03;
    for (let k = 1; k <= 12; k++) for (const lado of [-1, 1]) { const t = k / 12.5, ang = a + lado * 1.25; partes.push(folha(Math.cos(a) * comp * t, Math.sin(a) * comp * t, ang, 0.13 * (1 - t * 0.55), 0.035, k % 2 ? '#4a8a45' : '#3c7a3c', z + k * 0.003, { detalhe: 3, semSombra: true })); }
    partes.push(folha(0, 0, a, comp, 0.02, '#274d2b', z, { detalhe: 2 }));
  }
  return { tipo: 'piso', pegada: [1.3, 1.3], partes };
}

/** Costela-de-adão (monstera): folhas grandes em coração, recortadas, com nervuras. */
function monstera(seed: number, vasoMat: string): DescricaoDePiso {
  const r = mulberry32(seed), partes: Parte[] = [...vaso(vasoMat, 0.5)], folhas = 8;
  for (let f = 0; f < folhas; f++) {
    const a = (f / folhas) * Math.PI * 2 + r() * 0.4, d = 0.12 + r() * 0.12, cx = Math.cos(a) * d, cy = Math.sin(a) * d, tam = 0.34 + r() * 0.1, z = 0.8 + f * 0.05, c = Math.cos(a), s = Math.sin(a);
    const forma: number[] = [], n = 14;
    for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, rr = tam * (0.5 + 0.5 * Math.pow(Math.abs(Math.cos(t / 2)), 0.7)) * (1 - 0.12 * (i % 3 === 0 ? 1 : 0)); forma.push(Math.cos(t) * rr * 1.1, Math.sin(t) * rr * 0.85); }
    const rot = (pts: number[]) => pts.map((v, i) => (i % 2 ? cy + pts[i - 1]! * s + v * c : cx + v * c - pts[i + 1]! * s));
    partes.push(poli(rot(forma), f % 2 ? '#2f6a38' : '#27582f', z, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
    partes.push(folha(cx, cy, a, tam * 1.1, 0.02, '#8fc27a', z + 0.01, { detalhe: 3, semSombra: true }));
    for (const lado of [-1, 1]) for (let k = 1; k <= 3; k++) partes.push(folha(cx + Math.cos(a) * tam * 0.2 * k, cy + Math.sin(a) * tam * 0.2 * k, a + lado * 0.9, tam * 0.45, 0.015, '#7db36a', z + 0.012, { detalhe: 3, semSombra: true }));
  }
  return { tipo: 'piso', pegada: [1, 1], partes };
}

const DUAS = (a: string, pa: Record<string, unknown>, b: string, pb: Record<string, unknown>) => [{ nome: a, sufixo: a, params: pa, seed: 21 }, { nome: b, sufixo: b, params: pb, seed: 22 }];

export const PLANTAS: GeradorPesado[] = [
  { id: 'palmeira', nome: 'Palmeira em vaso', categoria: 'decoracao', funcoes: ['sala', 'corredor', 'escritorio', 'biblioteca'], tags: ['planta', 'palmeira', 'vaso', 'folhagem'], generos: [], kit: null, versao: 1,
    variantes: DUAS('madeira', { vaso: 'madeira.escura' }, 'pedra', { vaso: 'pedra.escura' }), gerar: p => palmeira(p.seed, String(p.params.vaso ?? 'madeira.escura')) },
  { id: 'samambaia', nome: 'Samambaia em pedestal', categoria: 'decoracao', funcoes: ['sala', 'corredor', 'biblioteca'], tags: ['planta', 'samambaia', 'pedestal', 'folhagem'], generos: ['investigacao', 'fantasia'], kit: null, versao: 2,
    variantes: DUAS('a', {}, 'b', {}), gerar: p => samambaia(p.seed) },
  { id: 'costela-de-adao', nome: 'Costela-de-adão', categoria: 'decoracao', funcoes: ['sala', 'quarto', 'escritorio', 'corredor'], tags: ['planta', 'monstera', 'vaso', 'folhagem'], generos: [], kit: null, versao: 1,
    variantes: DUAS('madeira', { vaso: 'madeira.escura' }, 'pedra', { vaso: 'pedra.escura' }), gerar: p => monstera(p.seed, String(p.params.vaso ?? 'madeira.escura')) },
  { id: 'arvore', altura: ([w]) => w * 1.6, nome: 'Árvore', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior'], generos: [], kit: 'exterior', versao: 5, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 31 }, { nome: '5 m', sufixo: '5m', params: { diametro: 5 }, seed: 32 }, { nome: '7 m', sufixo: '7m', params: { diametro: 7 }, seed: 33 },
      { nome: '5 m, outono laranja', sufixo: '5m-outono-laranja', params: { diametro: 5, tons: 'outono-laranja' }, seed: 34 }, { nome: '5 m, outono vermelha', sufixo: '5m-outono-vermelha', params: { diametro: 5, tons: 'outono-vermelha' }, seed: 35 }],
    gerar: p => copaRedonda(num(p.params.diametro, 5, 2, 10), p.seed, p.params.tons) },
  { id: 'pinheiro', altura: ([w]) => w * 2, nome: 'Pinheiro', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'pinheiro', 'conifera', 'exterior'], generos: [], kit: 'exterior', versao: 3, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 41 }, { nome: '4,5 m', sufixo: '4m', params: { diametro: 4.5 }, seed: 42 }], gerar: p => pinheiro(num(p.params.diametro, 3, 2, 8), p.seed) },
  { id: 'arbusto', altura: ([w]) => w * 0.5, nome: 'Arbusto', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'exterior'], generos: [], kit: 'exterior', versao: 5,
    variantes: [{ nome: 'verde', sufixo: 'verde', params: { diametro: 1.4 }, seed: 51 }, { nome: 'florido', sufixo: 'florido', params: { diametro: 1.6, flores: '#d94a6a' }, seed: 52 }, { nome: 'grande', sufixo: 'grande', params: { diametro: 2.2 }, seed: 53 }],
    gerar: p => arbusto(num(p.params.diametro, 1.5, 0.8, 4), p.seed, typeof p.params.flores === 'string' ? p.params.flores : null) },
  { id: 'arvore-nevada', altura: ([w]) => w * 1.6, nome: 'Árvore nevada', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior', 'inverno', 'neve'], generos: [], kit: 'ermos', versao: 4, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 61 }, { nome: '5 m', sufixo: '5m', params: { diametro: 5 }, seed: 62 }], gerar: p => arvoreNevada(num(p.params.diametro, 4, 2, 8), p.seed) },
  { id: 'pinheiro-nevado', altura: ([w]) => w * 2, nome: 'Pinheiro nevado', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'pinheiro', 'conifera', 'exterior', 'inverno', 'neve'], generos: [], kit: 'ermos', versao: 3, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 71 }, { nome: '4,5 m', sufixo: '4m', params: { diametro: 4.5 }, seed: 72 }], gerar: p => pinheiroNevado(num(p.params.diametro, 3, 2, 8), p.seed) },
  { id: 'arbusto-seco', altura: ([w]) => w * 0.4, nome: 'Arbusto seco', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'exterior', 'inverno', 'seco'], generos: [], kit: 'ermos', versao: 2, res: 64,
    variantes: [{ nome: '1,2 m', sufixo: '1m', params: { diametro: 1.2 }, seed: 81 }, { nome: '2 m', sufixo: '2m', params: { diametro: 2 }, seed: 82 }, { nome: '2 m com neve', sufixo: '2m-neve', params: { diametro: 2, neve: true }, seed: 83 }],
    gerar: p => arbustoSeco(num(p.params.diametro, 1.5, 0.8, 4), p.seed, p.params.neve === true) },
  { id: 'carvalho-grande', altura: ([w]) => w * 1.6, nome: 'Carvalho grande', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'carvalho', 'planta', 'copa', 'exterior', 'mata'], generos: [], kit: 'mata', versao: 3, res: 64,
    variantes: [{ nome: '6 m', sufixo: '6m', params: { diametro: 6 }, seed: 91 }, { nome: '7 m', sufixo: '7m', params: { diametro: 7 }, seed: 92 }, { nome: '8 m', sufixo: '8m', params: { diametro: 8 }, seed: 93 },
      { nome: '7 m, outono laranja', sufixo: '7m-outono-laranja', params: { diametro: 7, tons: 'outono-laranja' }, seed: 94 }, { nome: '7 m, outono vermelho', sufixo: '7m-outono-vermelha', params: { diametro: 7, tons: 'outono-vermelha' }, seed: 95 }],
    gerar: p => carvalhoGrande(num(p.params.diametro, 7, 5, 10), p.seed, p.params.tons) },
  { id: 'arvore-da-mata', altura: ([w]) => w * 1.7, nome: 'Árvore da mata', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior', 'mata', 'floresta'], generos: [], kit: 'mata', versao: 12, res: 64,
    variantes: [{ nome: '4 m', sufixo: '4m', params: { diametro: 4 }, seed: 111 }, { nome: '6 m', sufixo: '6m', params: { diametro: 6 }, seed: 112 }, { nome: '8 m', sufixo: '8m', params: { diametro: 8 }, seed: 113 }, { nome: '6 m, ralinha', sufixo: '6m-rala', params: { diametro: 6, ralo: 0.7 }, seed: 114 }, { nome: '5 m, amarelada', sufixo: '5m-amarelada', params: { diametro: 5, tons: 'amarelado' }, seed: 115 }],
    gerar: p => copaDeRaminhos(num(p.params.diametro, 6, 2, 12), p.seed, { ralo: num(p.params.ralo, 0.2, 0, 1), tons: p.params.tons === 'amarelado' ? AMARELADO : p.params.tons === 'frio' ? FRIO : OLIVA }) },
  { id: 'folhagem-tropical', altura: ([w]) => w * 0.5, nome: 'Folhagem tropical', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'folhagem', 'tropical', 'exterior', 'mata'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [{ nome: '1,6 m', sufixo: '1m', params: { diametro: 1.6 }, seed: 101 }, { nome: '2,4 m', sufixo: '2m', params: { diametro: 2.4 }, seed: 102 }], gerar: p => folhagemTropical(num(p.params.diametro, 2, 1, 4), p.seed) },
];
