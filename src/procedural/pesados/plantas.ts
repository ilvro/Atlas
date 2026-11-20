import { elipse, poli, type DescricaoDePiso, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, silhuetaDeDiscos, tira, tonsComLuz, tufo, type Disco, type Tons } from '../organico.ts';
import type { GeradorPesado } from './index.ts';

const num = (v: unknown, padrao: number, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : padrao);

/** Uma folha em forma de lente: da base (x, y) para a direção `ang`, com `len` de comprimento e `w` de largura. */
function folha(x: number, y: number, ang: number, len: number, w: number, mat: string, z: number, extra: Partial<Parte> = {}): Parte {
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

const copaRedonda = (diametro: number, seed: number): DescricaoDePiso => copaDeTufos(diametro, seed, VERDE_CLARO, { miudo: 0.15, folhas: 9 });

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
const arvoreNevada = (diametro: number, seed: number): DescricaoDePiso => copaDeTufos(diametro, seed, NEVE, { miudo: 0.2, folhas: 0, tronco: false, recorte: 0 });
/** Pinheiro de neve: a conífera com neve sobre cada ramo, do lado da luz. */
const pinheiroNevado = (diametro: number, seed: number): DescricaoDePiso => conifera(diametro, seed, true);
/** Carvalho: copa densa de muitos tufos pequenos, com folhas pintadas. */
const carvalhoGrande = (diametro: number, seed: number): DescricaoDePiso => copaDeTufos(diametro, seed, VERDE, { miudo: 0.85, folhas: 7 });

/** Tons da mata fechada à noite: verde-oliva com cachos amarelados e outros mais frios (ver `copaDeRaminhos`). */
const OLIVA: Tons = { fundo: '#1b2313', base: '#38461f', meio: '#52622b', luz: '#717f3b', brilho: '#98a157' };
const AMARELADO: Tons = { fundo: '#241f10', base: '#4a4520', meio: '#66602c', luz: '#857c3c', brilho: '#a89b55' };
const FRIO: Tons = { fundo: '#141d12', base: '#2b3d26', meio: '#3b5232', luz: '#526b42', brilho: '#768a5a' };

/**
 * Um cacho de folhas finas visto de cima (a unidade da copa de mata): fundo escuro em estrela com nanquim e sombra, duas voltas de folhas
 * estreitas que saem do centro, do escuro (atrás) ao claro (na frente e virado para a luz), e pontas acesas no lado da luz.
 */
function cacho(partes: Parte[], r: () => number, x: number, y: number, raio: number, tons: Tons, z: number, lado: number, folhasBase = 24): void {
  const n = folhasBase + Math.floor(r() * folhasBase * 0.5), luz = Math.atan2(LUZ_Y, LUZ_X), t = tonsComLuz(tons, Math.max(-0.42, Math.min(0.3, lado * 0.2))), o = { contorno: false as const, semSombra: true, suave: true };
  // A base do cacho (só sombra projetada e um miolo escuro, sem traço).
  partes.push(poli(bolha(x, y, raio * 0.62, raio * 0.62, 10, 0.25, r), t.fundo, z, { contorno: false, sombraLeve: true, detalhe: 1 }));
  const folhas: { a: number; len: number; w: number; bx: number; by: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = raio * r() * 0.22, b = r() * Math.PI * 2;
    folhas.push({ a, len: raio * (0.45 + r() * 0.55), w: raio * (0.1 + r() * 0.07), bx: x + Math.cos(b) * d, by: y + Math.sin(b) * d });
  }
  // Cada folha tem um contorno escuro um pouco maior por baixo (o nanquim da ponta) e, por cima, a folha pintada.
  for (const f of folhas) partes.push(lente(f.bx, f.by, f.a, f.len * 1.08, f.w * 1.45, t.fundo, z + 0.005, { contorno: 'leve', semSombra: true, detalhe: 1 }));
  folhas.sort((p, q) => p.len - q.len).reverse();
  folhas.forEach((f, k) => {
    const v = Math.cos(f.a - luz), alto = k / folhas.length;   // as mais curtas ficam por cima: o miolo do cacho é a parte mais alta
    const cor = v > 0.3 ? (alto > 0.5 ? t.luz : t.meio) : v < -0.35 ? t.base : (alto > 0.6 ? t.meio : t.base);
    partes.push(lente(f.bx, f.by, f.a, f.len, f.w, tom(cor, (r() - 0.5) * 0.1), z + 0.01 + alto * 0.01, { ...o, detalhe: alto > 0.5 ? 2 : 1 }));
    if (v > 0.2 && r() < 0.55) partes.push(lente(f.bx + Math.cos(f.a) * f.len * 0.35, f.by + Math.sin(f.a) * f.len * 0.35, f.a, f.len * 0.55, f.w * 0.4, t.brilho, z + 0.022, { ...o, detalhe: 3, alfa: 0.85 }));
  });
}

/**
 * Copa de mata vista de cima, no estilo das copas pintadas de mapas de batalha: dezenas de cachos de folhas finas (não bolas), com nanquim
 * e sombra em cada cacho, galhos escuros que aparecem nos vãos e cachos de tons variados (oliva, amarelado e frio). Os cachos de fora ficam
 * embaixo e os do miolo por cima, como uma cúpula; os virados para a luz (noroeste) clareiam. `ralo` (0 a 1) abre mais vãos.
 */
function copaDeRaminhos(diametro: number, seed: number, { ralo = 0.2, tons = OLIVA }: { ralo?: number; tons?: Tons } = {}): DescricaoDePiso {
  // `R` é o raio de arrumação: as folhas dos cachos da borda passam dele, e tudo tem de caber na pegada.
  const r = mulberry32(seed), R = diametro / 2 - 0.36, partes: Parte[] = [];
  // Galhos: do tronco para fora, com bifurcações; ficam sob os cachos e aparecem nos vãos.
  const galhos = 5 + Math.floor(r() * 3);
  for (let i = 0; i < galhos; i++) {
    const a = (i / galhos) * Math.PI * 2 + r() * 0.6, len = R * (0.62 + r() * 0.25), mx = Math.cos(a) * len * 0.5 + (r() - 0.5) * R * 0.12, my = Math.sin(a) * len * 0.5 + (r() - 0.5) * R * 0.12;
    partes.push(tira([0, 0, mx, my, Math.cos(a) * len, Math.sin(a) * len], R * 0.05, '#3b2e22', 1.4, { contorno: 'leve', semSombra: true, detalhe: 1 }, 0.25));
    for (const lado of [-1, 1]) if (r() < 0.75) { const b = a + lado * (0.45 + r() * 0.35), l2 = len * (0.35 + r() * 0.2); partes.push(tira([mx, my, mx + Math.cos(b) * l2, my + Math.sin(b) * l2], R * 0.025, '#45362a', 1.42, { contorno: 'leve', semSombra: true, detalhe: 2 }, 0.2)); }
  }
  partes.push(elipse(0, 0, R * 0.16, R * 0.16, '#33271d', 1.45, { contorno: 'leve', semSombra: true, detalhe: 1 }));
  // Sombra interna: o miolo da copa é escuro (nos vãos do meio não se vê o chão, e sim a sombra da própria copa).
  partes.push(poli(bolha(0, 0, R * 0.6 * (1 - ralo * 0.45), R * 0.6 * (1 - ralo * 0.45), 18, 0.18, r), '#0d120a', 1.3, { contorno: false, semSombra: true, suave: true, alfa: 0.85, detalhe: 1 }));
  // Massas de folhagem: uma no miolo e um anel de 4 a 8 em volta, com raios sorteados (o contorno sai em lóbulos). Cada massa é uma cúpula
  // de cachos com o próprio lado da luz e o próprio lado da sombra, e projeta sombra sobre as de baixo: é isso que dá volume à copa.
  const nAnel = Math.max(4, Math.min(8, Math.round(2 + R * 1.1))), massas: { x: number; y: number; r: number; z: number }[] = [];
  const giro = r() * Math.PI * 2;
  for (let i = 0; i < nAnel; i++) { const a = giro + (i / nAnel) * Math.PI * 2 + (r() - 0.5) * 0.5, rm = R * (0.36 + r() * 0.16), d = R - rm * (0.95 + r() * 0.1); massas.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: rm, z: 2 + r() * 0.3 }); }
  massas.push({ x: (r() - 0.5) * R * 0.2, y: (r() - 0.5) * R * 0.2, r: R * (0.42 + r() * 0.1), z: 2.6 });
  const miudo = 0.24, variantes = [tons, tons, tons, tons, tons, AMARELADO, FRIO];
  for (const m of massas.sort((a, b) => a.z - b.z)) {
    const ladoDaMassa = (m.x * LUZ_X + m.y * LUZ_Y) / R, tonsDaMassa = r() < 0.18 ? variantes[5 + Math.floor(r() * 2)]! : tons;
    // Silhueta da massa: contorno recortado em pontas de folha, com nanquim firme e a sombra da massa sobre o que está embaixo.
    const nPontas = Math.round(m.r * 42), fase = r() * 6, silhueta: number[] = [];
    for (let i = 0; i < nPontas; i++) {
      const a = (i / nPontas) * Math.PI * 2, lobo = 0.06 * Math.sin(a * 5 + fase) + 0.04 * Math.sin(a * 11 + fase * 2), rr = m.r * (0.92 + lobo + (i % 2 ? -0.07 - r() * 0.05 : r() * 0.04));
      silhueta.push(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr);
    }
    partes.push(poli(silhueta, tonsDaMassa.fundo, m.z, { detalhe: 1 }));
    // Por dentro, cachos miúdos e apertados (folhas de 10 a 30 cm), sem deixar ver o chão.
    const cachos: { x: number; y: number; r: number; d: number }[] = [];
    for (let tent = 0; tent < 9000 && cachos.length < 1100; tent++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * m.r * 0.9, x = m.x + Math.cos(a) * d, y = m.y + Math.sin(a) * d, rr = miudo * (0.75 + r() * 0.5);
      if (cachos.some(c => Math.hypot(c.x - x, c.y - y) < (c.r + rr) * (0.3 + ralo * 0.4))) continue;
      cachos.push({ x, y, r: rr, d: d / m.r });
    }
    for (const c of cachos.sort((a, b) => b.d - a.d)) {
      // Luz na massa: o lado noroeste de cada cúpula clareia, o sudeste escurece; o miolo de cada massa é a parte mais alta.
      const local = ((c.x - m.x) * LUZ_X + (c.y - m.y) * LUZ_Y) / m.r, t = r() < 0.12 ? variantes[Math.floor(r() * variantes.length)]! : tonsDaMassa;
      cacho(partes, r, c.x, c.y, c.r, t, m.z + 0.02 + (1 - c.d) * 0.08, local * 1.1 + ladoDaMassa * 0.35 - (c.d > 0.75 && local < 0 ? 0.6 : 0), 14);
    }
    // Volume: um véu claro no lado da luz e um escuro no lado oposto, macios, dentro da massa.
    partes.push(poli(bolha(m.x + LUZ_X * m.r * 0.3, m.y + LUZ_Y * m.r * 0.3, m.r * 0.45, m.r * 0.4, 12, 0.2, r), tonsDaMassa.brilho, m.z + 0.12, { contorno: false, semSombra: true, suave: true, alfa: 0.16, desfoque: m.r * 0.25 }));
    partes.push(poli(bolha(m.x - LUZ_X * m.r * 0.38, m.y - LUZ_Y * m.r * 0.38, m.r * 0.5, m.r * 0.42, 12, 0.2, r), '#050804', m.z + 0.12, { contorno: false, semSombra: true, suave: true, alfa: 0.32, desfoque: m.r * 0.25 }));
  }
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
  const g = copaDeTufos(diametro, seed, VERDE_CLARO, { miudo: 0.4, folhas: 3, tronco: false }), r = mulberry32(seed + 5), partes = g.partes;
  if (flores) for (let i = 0; i < 26; i++) { const a = r() * Math.PI * 2, d = (diametro / 2) * Math.sqrt(r()) * 0.85; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.07, 0.07, flores, 5.5 + r() * 0.2, { contorno: false, semSombra: true, detalhe: 3 })); }
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
  { id: 'arvore', altura: ([w]) => w * 1.6, nome: 'Árvore', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior'], generos: [], kit: 'exterior', versao: 3, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 31 }, { nome: '5 m', sufixo: '5m', params: { diametro: 5 }, seed: 32 }, { nome: '7 m', sufixo: '7m', params: { diametro: 7 }, seed: 33 }],
    gerar: p => copaRedonda(num(p.params.diametro, 5, 2, 10), p.seed) },
  { id: 'pinheiro', altura: ([w]) => w * 2, nome: 'Pinheiro', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'pinheiro', 'conifera', 'exterior'], generos: [], kit: 'exterior', versao: 3, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 41 }, { nome: '4,5 m', sufixo: '4m', params: { diametro: 4.5 }, seed: 42 }], gerar: p => pinheiro(num(p.params.diametro, 3, 2, 8), p.seed) },
  { id: 'arbusto', altura: ([w]) => w * 0.5, nome: 'Arbusto', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'exterior'], generos: [], kit: 'exterior', versao: 3,
    variantes: [{ nome: 'verde', sufixo: 'verde', params: { diametro: 1.4 }, seed: 51 }, { nome: 'florido', sufixo: 'florido', params: { diametro: 1.6, flores: '#d94a6a' }, seed: 52 }, { nome: 'grande', sufixo: 'grande', params: { diametro: 2.2 }, seed: 53 }],
    gerar: p => arbusto(num(p.params.diametro, 1.5, 0.8, 4), p.seed, typeof p.params.flores === 'string' ? p.params.flores : null) },
  { id: 'arvore-nevada', altura: ([w]) => w * 1.6, nome: 'Árvore nevada', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior', 'inverno', 'neve'], generos: [], kit: 'ermos', versao: 3, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 61 }, { nome: '5 m', sufixo: '5m', params: { diametro: 5 }, seed: 62 }], gerar: p => arvoreNevada(num(p.params.diametro, 4, 2, 8), p.seed) },
  { id: 'pinheiro-nevado', altura: ([w]) => w * 2, nome: 'Pinheiro nevado', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'pinheiro', 'conifera', 'exterior', 'inverno', 'neve'], generos: [], kit: 'ermos', versao: 3, res: 64,
    variantes: [{ nome: '3 m', sufixo: '3m', params: { diametro: 3 }, seed: 71 }, { nome: '4,5 m', sufixo: '4m', params: { diametro: 4.5 }, seed: 72 }], gerar: p => pinheiroNevado(num(p.params.diametro, 3, 2, 8), p.seed) },
  { id: 'arbusto-seco', altura: ([w]) => w * 0.4, nome: 'Arbusto seco', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'exterior', 'inverno', 'seco'], generos: [], kit: 'ermos', versao: 2, res: 64,
    variantes: [{ nome: '1,2 m', sufixo: '1m', params: { diametro: 1.2 }, seed: 81 }, { nome: '2 m', sufixo: '2m', params: { diametro: 2 }, seed: 82 }, { nome: '2 m com neve', sufixo: '2m-neve', params: { diametro: 2, neve: true }, seed: 83 }],
    gerar: p => arbustoSeco(num(p.params.diametro, 1.5, 0.8, 4), p.seed, p.params.neve === true) },
  { id: 'carvalho-grande', altura: ([w]) => w * 1.6, nome: 'Carvalho grande', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'carvalho', 'planta', 'copa', 'exterior', 'mata'], generos: [], kit: 'mata', versao: 2, res: 64,
    variantes: [{ nome: '6 m', sufixo: '6m', params: { diametro: 6 }, seed: 91 }, { nome: '7 m', sufixo: '7m', params: { diametro: 7 }, seed: 92 }, { nome: '8 m', sufixo: '8m', params: { diametro: 8 }, seed: 93 }], gerar: p => carvalhoGrande(num(p.params.diametro, 7, 5, 10), p.seed) },
  { id: 'arvore-da-mata', altura: ([w]) => w * 1.7, nome: 'Árvore da mata', categoria: 'exterior', funcoes: ['jardim'], tags: ['arvore', 'planta', 'copa', 'exterior', 'mata', 'floresta'], generos: [], kit: 'mata', versao: 2, res: 64,
    variantes: [{ nome: '4 m', sufixo: '4m', params: { diametro: 4 }, seed: 111 }, { nome: '6 m', sufixo: '6m', params: { diametro: 6 }, seed: 112 }, { nome: '8 m', sufixo: '8m', params: { diametro: 8 }, seed: 113 }, { nome: '6 m, ralinha', sufixo: '6m-rala', params: { diametro: 6, ralo: 0.7 }, seed: 114 }, { nome: '5 m, amarelada', sufixo: '5m-amarelada', params: { diametro: 5, tons: 'amarelado' }, seed: 115 }],
    gerar: p => copaDeRaminhos(num(p.params.diametro, 6, 2, 12), p.seed, { ralo: num(p.params.ralo, 0.2, 0, 1), tons: p.params.tons === 'amarelado' ? AMARELADO : p.params.tons === 'frio' ? FRIO : OLIVA }) },
  { id: 'folhagem-tropical', altura: ([w]) => w * 0.5, nome: 'Folhagem tropical', categoria: 'exterior', funcoes: ['jardim'], tags: ['arbusto', 'planta', 'folhagem', 'tropical', 'exterior', 'mata'], generos: [], kit: 'mata', versao: 1, res: 64,
    variantes: [{ nome: '1,6 m', sufixo: '1m', params: { diametro: 1.6 }, seed: 101 }, { nome: '2,4 m', sufixo: '2m', params: { diametro: 2.4 }, seed: 102 }], gerar: p => folhagemTropical(num(p.params.diametro, 2, 1, 4), p.seed) },
];
