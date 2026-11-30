import { elipse, poli, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { ID, O, S, anel, arco, bloco, disco, em, estofado, olhar, quadro, retQ, retR, tomDaFace, type Quadro, type Tons } from './antiguidade.ts';
import { cilindro } from './colonial.ts';
import { halo } from './oriental.ts';

// Moderno urbano (Q21): a rua (Q21a) e os interiores de escritório, mercado, lanchonete, vestiário e enfermaria (Q21b). Lataria pintada com verniz (o teto e o capô pegam o céu), vidro escuro com o reflexo do céu,
// borracha preta, plástico laranja de obra, concreto e aço galvanizado. As regras do acervo: nanquim por baixo da silhueta, volume em
// degraus de tom para o noroeste, `z` das partes até 1,5 m e a `altura` real na receita. Os veículos olham para +x.

export const tonsDe = (cor: string): Tons => ({ nanquim: tom(cor, -0.8), sombra: tom(cor, -0.42), base: cor, meio: tom(cor, 0.1), luz: tom(cor, 0.24), brilho: tom(cor, 0.55) });
export const ACO: Tons = { nanquim: '#141618', sombra: '#5a5e64', base: '#7e848a', meio: '#969ca2', luz: '#b2b8be', brilho: '#e4e8ec' };
export const GRAFITE: Tons = { nanquim: '#060708', sombra: '#16181b', base: '#24272b', meio: '#2e3237', luz: '#40454b', brilho: '#7a8088' };
export const CONCRETO: Tons = { nanquim: '#1c1c1a', sombra: '#6a6862', base: '#8a8780', meio: '#9c9990', luz: '#b2afa6', brilho: '#d2cfc6' };
const LARANJA: Tons = tonsDe('#d2561a'), AMARELO: Tons = tonsDe('#d0a018'), VERMELHO: Tons = tonsDe('#a8221a');
export const BORRACHA = '#0b0b0d', VIDRO = '#18212a', CEU = '#a8bccc', BRANCO = '#e8e8e2';

/** As cores de lataria do campo `cor`: vermelho, azul, prata, branco, preto, verde, amarelo e grafite. */
export const CORES_DE_CARRO = ['#8e1c1c', '#1e3a6e', '#9aa0a6', '#d4d8d8', '#1c1d21', '#24452f', '#c8961a', '#4a4e56'];
const corDoCampo = (r: () => number, i: number): string => CORES_DE_CARRO[i >= 0 ? Math.min(CORES_DE_CARRO.length - 1, i) : Math.floor(r() * CORES_DE_CARRO.length)]!;

/** Lanterna ou farol: a lente apagada, ou acesa (soma luz e brilha à noite). */
function lampada(partes: Parte[], f: Quadro, u: number, v: number, w: number, h: number, cor: string, acesa: string | null, z: number): void {
  partes.push(poli(retR(f, u, v, w + 0.02, h + 0.02, Math.min(w, h) * 0.45), '#0a0a0c', z, { ...O, detalhe: 2 }), poli(retR(f, u, v, w, h, Math.min(w, h) * 0.4), cor, z + 0.001, { ...O, detalhe: 2 }));
  if (acesa) partes.push(poli(retR(f, u, v, w * 0.9, h * 0.9, Math.min(w, h) * 0.4), acesa, z + 0.002, { ...O, brilho: true, detalhe: 2 }), elipse(...f(u, v), w * 2.2, h * 1.8, acesa, z + 0.003, { ...O, brilho: true, alfa: 0.35, desfoque: Math.min(w, h) * 0.5, detalhe: 2 }));
  else partes.push(elipse(...f(u - w * 0.15, v - h * 0.15), w * 0.4, h * 0.35, '#ffffff', z + 0.002, { ...S, alfa: 0.45, detalhe: 3 }));
}

/**
 * Lataria vista de cima, no referencial `f` (frente em +u): o nanquim, a base, o flanco claro do lado da luz e o escuro do outro,
 * e o tampo (capô, teto e porta-malas) num tom acima. `raio` arredonda os cantos.
 */
export function lataria(partes: Parte[], f: Quadro, u: number, L: number, W: number, t: Tons, z: number, raio: number): void {
  partes.push(poli(retR(f, u + 0.012, 0.014, L + 0.05, W + 0.05, raio + 0.02), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(f, u, 0, L, W, raio), t.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(retR(f, u - 0.02, -W * 0.36, L - 0.12, W * 0.24, raio * 0.6), t.luz, z + 0.005, { ...S, alfa: 0.75, detalhe: 2 }));
  partes.push(poli(retR(f, u + 0.02, W * 0.37, L - 0.1, W * 0.22, raio * 0.6), t.sombra, z + 0.005, { ...S, alfa: 0.85, detalhe: 2 }));
  partes.push(poli(retR(f, u, -0.01, L - 0.16, W * 0.76, raio * 0.85), t.meio, z + 0.007, { ...S, detalhe: 1 }));
}

export interface Modelo { L: number; W: number; eixo: number; cabine: [number, number]; parabrisa: number; vidroTras: number; raio: number; cacamba?: [number, number] }
export const MODELOS: Record<'sedan' | 'hatch' | 'picape' | 'van', Modelo> = {
  sedan: { L: 4.6, W: 1.8, eixo: 1.35, cabine: [-1.3, 0.62], parabrisa: 0.58, vidroTras: 0.46, raio: 0.38 },
  hatch: { L: 3.95, W: 1.74, eixo: 1.25, cabine: [-1.78, 0.42], parabrisa: 0.58, vidroTras: 0.3, raio: 0.4 },
  picape: { L: 5.3, W: 1.9, eixo: 1.6, cabine: [-0.45, 1.0], parabrisa: 0.52, vidroTras: 0.12, raio: 0.34, cacamba: [-2.52, -0.56] },
  van: { L: 5.1, W: 1.98, eixo: 1.62, cabine: [-2.42, 1.5], parabrisa: 0.5, vidroTras: 0.08, raio: 0.3 },
};

interface Acessorios { farois: boolean; giroflex?: boolean; viatura?: boolean; taxi?: boolean }

/**
 * Carro visto de cima, com a frente para +x: os pneus que escapam das caixas de roda, a lataria, o capô com os vincos, a cabine de vidro
 * escuro com o reflexo do céu no para-brisa, o teto, os retrovisores, os para-choques, os faróis e as lanternas (acesos com `farois`).
 * A picape tem a caçamba aberta; a van, o teto comprido com as nervuras.
 */
function carro(seed: number, m: Modelo, cor: string, a: Acessorios): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], f = ID, { L, W } = m, t = tonsDe(cor), [g0, g1] = m.cabine;
  sombraNoChao(partes, retR(f, 0, 0, L + 0.1, W + 0.1, m.raio), 0.01, '#0a0a0c', 0.6);
  // Os pneus, que mal escapam da lataria.
  for (const su of [-1, 1]) for (const sv of [-1, 1]) partes.push(poli(retR(f, su * m.eixo, sv * (W / 2 - 0.1), 0.64, 0.26, 0.08), BORRACHA, 0.3, { contorno: 'leve', detalhe: 1 }));
  lataria(partes, f, 0, L, W, t, 0.75, m.raio);
  // Os para-choques: a faixa de plástico escuro na frente e atrás.
  for (const s of [-1, 1]) partes.push(tira(arco(s * (L / 2 - m.raio * 0.9), 0, m.raio * 0.9, W / 2 - 0.06, s > 0 ? -1.15 : Math.PI - 1.15, s > 0 ? 1.15 : Math.PI + 1.15, 10), 0.07, '#1c1d20', 0.79, { ...O, detalhe: 2 }));
  // O capô: o reflexo largo e os dois vincos.
  const cf = L / 2 - 0.16;
  partes.push(lente(g1 + 0.1, -W * 0.12, 0, (cf - g1) * 0.85, W * 0.26, t.luz, 0.8, { ...S, alfa: 0.7, detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(tira(em(f, [g1 + 0.08, s * W * 0.24, cf - 0.08, s * W * 0.2]), 0.014, t.nanquim, 0.802, { ...O, alfa: 0.3, detalhe: 3 }));
  // As portas: as frestas no flanco.
  const portas = m.cacamba ? [g0 + 0.05, g1 - 0.25] : [g0 + 0.15, (g0 + g1) / 2 + 0.05, g1 - 0.2];
  for (const u of portas) for (const s of [-1, 1]) partes.push(tira(em(f, [u, s * (W / 2 - 0.02), u - 0.02, s * (W / 2 - 0.2)]), 0.012, t.nanquim, 0.806, { ...O, alfa: 0.55, detalhe: 3 }));
  // A caçamba da picape: as paredes, o fundo escuro com as nervuras e a tampa.
  if (m.cacamba) {
    const [c0, c1] = m.cacamba, cu = (c0 + c1) / 2, cl = c1 - c0;
    partes.push(poli(retQ(f, cu, 0, cl, W - 0.2), '#121316', 0.81, { ...O, detalhe: 1 }));
    partes.push(poli(retQ(f, cu + 0.02, -0.02, cl - 0.08, W - 0.3), '#1e2024', 0.812, { ...O, detalhe: 1 }));
    for (let v = -W / 2 + 0.25; v < W / 2 - 0.2; v += 0.16) partes.push(tira(em(f, [c0 + 0.08, v, c1 - 0.08, v]), 0.035, '#2c2f34', 0.814, { ...O, detalhe: 3 }));
    partes.push(poli(retQ(f, c1 - 0.04, 0.03, 0.05, W - 0.25), t.sombra, 0.816, { ...O, detalhe: 2 }), poli(retQ(f, c0 + 0.03, 0, 0.05, W - 0.25), t.luz, 0.816, { ...O, alfa: 0.8, detalhe: 2 }));
    if (r() < 0.6) { const k = quadro(cu - 0.3 + r() * 0.5, (r() - 0.5) * 0.4, (r() - 0.5) * 0.5); bloco(partes, k, 0.6, 0.45, tonsDe('#8a6a42'), 0.9, 0.04); }
  }
  // A cabine: o vidro em volta, o reflexo do céu no para-brisa e no vidro de trás, as colunas e o teto.
  const gu = (g0 + g1) / 2, gl = g1 - g0, tu0 = g0 + m.vidroTras, tu1 = g1 - m.parabrisa;
  partes.push(poli(retR(f, gu, 0, gl, W * 0.84, 0.26), VIDRO, 1.2, { ...O, vidro: true, detalhe: 1 }));
  partes.push(poli(em(f, [tu1 + 0.06, -W * 0.36, g1 - 0.08, -W * 0.3, g1 - 0.14, -W * 0.08, tu1 + 0.1, -W * 0.16]), CEU, 1.202, { ...S, alfa: 0.4, detalhe: 2 }));
  if (m.vidroTras > 0.15) partes.push(poli(em(f, [g0 + 0.06, -W * 0.32, tu0 - 0.04, -W * 0.34, tu0 - 0.06, -W * 0.1, g0 + 0.1, -W * 0.06]), CEU, 1.202, { ...S, alfa: 0.25, detalhe: 3 }));
  for (const s of [-1, 1]) { partes.push(tira(em(f, [tu1, s * W * 0.34, g1 - 0.06, s * W * 0.41]), 0.05, t.base, 1.204, { ...O, detalhe: 2 })); partes.push(tira(em(f, [tu0, s * W * 0.34, g0 + 0.06, s * W * 0.4]), 0.06, t.base, 1.204, { ...O, detalhe: 2 })); }
  const tl = tu1 - tu0;
  partes.push(poli(retR(f, (tu0 + tu1) / 2 + 0.01, 0.012, tl + 0.03, W * 0.74, 0.16), t.nanquim, 1.3, { ...O, detalhe: 1 }));
  partes.push(poli(retR(f, (tu0 + tu1) / 2, 0, tl, W * 0.72, 0.15), t.meio, 1.302, { ...O, detalhe: 1 }));
  partes.push(poli(retR(f, (tu0 + tu1) / 2 - tl * 0.06, -W * 0.08, tl * 0.82, W * 0.42, 0.12), t.luz, 1.304, { ...S, detalhe: 2 }));
  partes.push(lente(tu0 + tl * 0.12, -W * 0.22, 0, tl * 0.55, W * 0.08, t.brilho, 1.306, { ...S, alfa: 0.65, detalhe: 3 }));
  if (tl > 2.5) for (let u = tu0 + 0.45; u < tu1 - 0.2; u += 0.45) partes.push(tira(em(f, [u, -W * 0.33, u, W * 0.33]), 0.025, t.sombra, 1.305, { ...O, alfa: 0.6, detalhe: 3 }));
  // Os retrovisores.
  for (const s of [-1, 1]) { const [x, y] = f(g1 - 0.12, s * (W / 2 + 0.07)); partes.push(elipse(x + 0.01, y + 0.01, 0.16, 0.12, t.nanquim, 1.0, { contorno: 'leve', detalhe: 2 }), elipse(x, y, 0.13, 0.09, s < 0 ? t.luz : t.base, 1.002, { ...O, detalhe: 2 })); }
  // Faróis e lanternas.
  for (const s of [-1, 1]) {
    lampada(partes, f, L / 2 - 0.1, s * W * 0.34, 0.12, 0.3, '#cfd8dc', a.farois ? '#fff0c8' : null, 0.83);
    lampada(partes, f, -L / 2 + 0.07, s * W * 0.36, 0.08, 0.3, '#7a1010', a.farois ? '#c81808' : null, 0.83);
  }
  // A viatura: as portas pintadas de outra cor e a barra do giroflex; o táxi: o luminoso no teto.
  if (a.viatura) {
    for (const s of [-1, 1]) partes.push(poli(retR(f, gu, s * (W / 2 - 0.1), gl + 0.3, 0.18, 0.06), '#1a2a5a', 0.808, { ...O, alfa: 0.9, detalhe: 2 }));
    const bu = tu1 - 0.35;
    partes.push(poli(retR(f, bu + 0.01, 0.012, 0.3, W * 0.66, 0.06), '#08080a', 1.4, { contorno: 'leve', detalhe: 1 }));
    for (const s of [-1, 1]) {
      const acesa = a.giroflex ? (s < 0 ? '#ff2030' : '#3050ff') : null, cor = s < 0 ? '#7a1018' : '#18307a';
      partes.push(poli(retR(f, bu, s * W * 0.17, 0.24, W * 0.28, 0.05), cor, 1.402, { ...O, detalhe: 2 }));
      if (acesa) partes.push(poli(retR(f, bu, s * W * 0.17, 0.2, W * 0.24, 0.05), acesa, 1.404, { ...O, brilho: true, detalhe: 2 }), elipse(...f(bu, s * W * 0.17), 0.7, 0.8, acesa, 1.405, { ...O, brilho: true, alfa: 0.35, desfoque: 0.12, detalhe: 2 }));
      else partes.push(tira(em(f, [bu - 0.06, s * W * 0.06, bu - 0.06, s * W * 0.28]), 0.03, '#ffffff', 1.404, { ...O, alfa: 0.35, detalhe: 3 }));
    }
  }
  if (a.taxi) {
    const bu = (tu0 + tu1) / 2;
    partes.push(poli(retR(f, bu + 0.01, 0.012, 0.22, 0.62, 0.05), '#0a0a0a', 1.4, { contorno: 'leve', detalhe: 1 }), poli(retR(f, bu, 0, 0.18, 0.58, 0.04), a.farois ? '#d8c890' : '#e8e2c8', 1.402, { ...O, brilho: a.farois, detalhe: 2 }));
    for (let k = 0; k < 4; k++) partes.push(poli(retQ(f, bu + (k % 2 ? 0.045 : -0.045), -0.21 + k * 0.14, 0.07, 0.06), '#141414', 1.404, { ...O, detalhe: 3 }));
  }
  return partes;
}

// ---------- Duas rodas ----------

/** Pneu estreito visto de cima, ao longo de u. */
const pneu = (partes: Parte[], u0: number, u1: number, w: number, z: number): void => {
  partes.push(tira([u0, 0, u1, 0], w + 0.025, '#000000', z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }, 0.55), tira([u0 + 0.03, -w * 0.15, u1 - 0.03, -w * 0.15], w * 0.3, '#3a3c40', z + 0.002, { ...O, detalhe: 3 }, 0.5));
};

/** Moto de rua com a frente em +x: os pneus, o garfo, o tanque em gota, o banco, o motor e o escapamento cromado, o guidão com os retrovisores e o farol. */
function moto(seed: number, farol: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = tonsDe(corDoCampo(r, -1));
  sombraNoChao(partes, [-1.05, -0.2, 1.05, -0.2, 1.05, 0.25, -1.05, 0.25], 0.01, '#0a0a0c', 0.5);
  pneu(partes, -1.04, -0.5, 0.18, 0.3);
  pneu(partes, 0.56, 1.04, 0.13, 0.3);
  // O motor e o quadro, por baixo.
  bloco(partes, quadro(-0.08, 0), 0.5, 0.36, GRAFITE, 0.45, 0.05);
  // O escapamento do lado direito (+y).
  cilindro(partes, -0.2, 0.2, -0.95, 0.24, 0.09, 0.11, ACO, 0.55);
  partes.push(elipse(-0.97, 0.24, 0.06, 0.1, '#050505', 0.565, { ...O, detalhe: 3 }));
  // O garfo, o tanque, o banco e a rabeta.
  for (const s of [-1, 1]) partes.push(tira([0.42, s * 0.08, 0.72, s * 0.07], 0.035, ACO.luz, 0.8, { contorno: 'leve', detalhe: 2 }));
  partes.push(poli(bolha(-0.75, 0, 0.3, 0.12, 14, 0, r), t.nanquim, 0.85, { contorno: 'leve', detalhe: 1 }), poli(bolha(-0.75, -0.01, 0.28, 0.1, 14, 0, r), t.base, 0.852, { ...O, detalhe: 1 }));
  lampada(partes, ID, -1.02, 0, 0.04, 0.12, '#7a1010', farol ? '#c81808' : null, 0.86);
  partes.push(poli(bolha(-0.32, 0, 0.3, 0.15, 16, 0, r), '#08080a', 0.9, { contorno: 'leve', detalhe: 1 }), poli(bolha(-0.33, -0.02, 0.27, 0.12, 16, 0, r), '#1e1f22', 0.902, { ...O, detalhe: 1 }), lente(-0.52, -0.06, 0, 0.36, 0.05, '#4a4c50', 0.904, { ...S, alfa: 0.7, detalhe: 3 }));
  const tanque = [0.02, -0.15, 0.2, -0.17, 0.4, -0.12, 0.46, 0, 0.4, 0.12, 0.2, 0.17, 0.02, 0.15, -0.06, 0];
  partes.push(poli(tanque.map((v, i) => v + (i % 2 ? 0.012 : 0.01)), t.nanquim, 0.95, { contorno: 'leve', detalhe: 1 }), poli(tanque, t.base, 0.952, { ...O, detalhe: 1 }));
  partes.push(lente(0.06, -0.07, 0.05, 0.34, 0.11, t.luz, 0.954, { ...S, detalhe: 2 }), lente(0.12, -0.08, 0.05, 0.18, 0.035, t.brilho, 0.956, { ...S, alfa: 0.7, detalhe: 3 }));
  partes.push(elipse(0.2, 0, 0.07, 0.07, ACO.base, 0.958, { contorno: 'leve', detalhe: 3 }));
  // O farol e o painel; o guidão com as manoplas e os retrovisores.
  disco(partes, 0.7, 0, 0.09, GRAFITE, 1.0);
  lampada(partes, ID, 0.78, 0, 0.05, 0.13, '#cfd8dc', farol ? '#fff0c8' : null, 1.02);
  partes.push(tira([0.52, -0.38, 0.6, -0.2, 0.6, 0.2, 0.52, 0.38], 0.03, '#141416', 1.05, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) {
    partes.push(tira([0.53, s * 0.3, 0.51, s * 0.4], 0.05, '#050505', 1.06, { ...O, detalhe: 2 }));
    partes.push(tira([0.6, s * 0.15, 0.68, s * 0.27], 0.012, '#141416', 1.1, { ...O, detalhe: 3 }), elipse(0.69, s * 0.29, 0.08, 0.05, s < 0 ? ACO.brilho : ACO.base, 1.12, { contorno: 'leve', detalhe: 3 }));
  }
  disco(partes, 0.62, 0, 0.06, GRAFITE, 1.08);
  return partes;
}

/** Bicicleta com a frente em +x: os pneus finos, o quadro, o pedivela com os pedais, o selim e o guidão. */
function bicicleta(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = ['#2a6a9a', '#a82a22', '#1e1e22', '#5a8a3a', '#d8d4c8'][Math.floor(r() * 5)]!, t = tonsDe(cor);
  sombraNoChao(partes, [-0.9, -0.06, 0.9, -0.06, 0.9, 0.08, -0.9, 0.08], 0.01, '#0a0a0c', 0.35);
  pneu(partes, -0.88, -0.24, 0.045, 0.3);
  pneu(partes, 0.24, 0.88, 0.045, 0.3);
  // O pedivela e os pedais; a corrente.
  partes.push(tira([-0.56, 0.05, -0.05, 0.06], 0.012, '#2a2a2a', 0.34, { ...O, detalhe: 3 }));
  disco(partes, -0.05, 0.06, 0.07, ACO, 0.35);
  const ang = r() * Math.PI;
  for (const s of [-1, 1]) { const u = -0.05 + Math.cos(ang) * 0.12 * s; partes.push(tira([-0.05, 0.06 * s, u, 0.14 * s], 0.025, ACO.sombra, 0.36, { ...O, detalhe: 3 }), poli(retQ(ID, u, 0.17 * s, 0.09, 0.06), '#141416', 0.37, { contorno: 'leve', detalhe: 3 })); }
  // O quadro: o tubo de baixo, o de cima, o do selim e o garfo.
  for (const [pts, w] of [[[-0.05, 0, 0.45, 0], 0.045], [[-0.3, 0, 0.45, 0], 0.035], [[-0.56, 0, -0.3, 0], 0.03]] as const) partes.push(tira([...pts], w + 0.02, t.nanquim, 0.6, { contorno: 'leve', detalhe: 2 }), tira([...pts].map((v, i) => (i % 2 ? v - 0.006 : v)), w, t.base, 0.602, { ...O, detalhe: 2 }), tira([...pts].map((v, i) => (i % 2 ? v - 0.01 : v)), w * 0.3, t.brilho, 0.604, { ...O, alfa: 0.6, detalhe: 3 }));
  // O selim e o guidão.
  partes.push(poli([-0.42, -0.06, -0.24, -0.04, -0.16, 0, -0.24, 0.04, -0.42, 0.06, -0.45, 0], '#121214', 0.9, { contorno: 'leve', detalhe: 2 }), lente(-0.42, -0.02, 0, 0.18, 0.03, '#4a4a50', 0.902, { ...S, alfa: 0.7, detalhe: 3 }));
  partes.push(tira([0.42, -0.28, 0.48, -0.12, 0.48, 0.12, 0.42, 0.28], 0.025, ACO.base, 1.0, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) partes.push(tira([0.43, s * 0.22, 0.42, s * 0.3], 0.04, '#0a0a0a', 1.01, { ...O, detalhe: 3 }));
  disco(partes, 0.46, 0, 0.03, ACO, 1.02);
  return partes;
}

// ---------- Ônibus ----------

/** As pinturas do ônibus: a cor da saia e a da faixa. */
export const LIBRES: readonly [string, string][] = [['#c8c4b8', '#1e5aa0'], ['#d8a018', '#2a2a2a'], ['#2a6a3a', '#d8d4c4'], ['#a82a22', '#e0dcd0']];

/** Ônibus urbano visto de cima (12 m, frente em +x): o teto claro com o ar-condicionado e as escotilhas, as janelas em fita nos lados, o para-brisa largo, os retrovisores em antena e a faixa da pintura. */
function onibus(seed: number, corIdx: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 12, W = 2.5, [saia, faixa] = LIBRES[corIdx >= 0 ? Math.min(LIBRES.length - 1, corIdx) : Math.floor(r() * LIBRES.length)]!, t = tonsDe(saia), teto = tonsDe('#d4d2ca');
  sombraNoChao(partes, retR(ID, 0, 0, L + 0.1, W + 0.1, 0.25), 0.01, '#0a0a0c', 0.6);
  for (const u of [-3.4, 3.7]) for (const s of [-1, 1]) partes.push(poli(retR(ID, u, s * (W / 2 - 0.15), 1.0, 0.32, 0.08), BORRACHA, 0.3, { contorno: 'leve', detalhe: 1 }));
  lataria(partes, ID, 0, L, W, t, 0.8, 0.22);
  // A faixa e as janelas dos lados: a fita de vidro com as colunas.
  for (const s of [-1, 1]) {
    partes.push(poli(retQ(ID, -0.2, s * (W / 2 - 0.05), L - 1.0, 0.08), faixa, 0.83, { ...O, detalhe: 2 }));
    partes.push(poli(retQ(ID, -0.3, s * (W / 2 - 0.17), L - 1.6, 0.14), VIDRO, 1.0, { ...O, vidro: true, detalhe: 2 }));
    for (let u = -L / 2 + 0.6; u < L / 2 - 1.1; u += 1.25) partes.push(tira([u, s * (W / 2 - 0.24), u, s * (W / 2 - 0.1)], 0.06, t.base, 1.002, { ...O, detalhe: 3 }));
    if (s < 0) partes.push(poli(retQ(ID, -0.3, s * (W / 2 - 0.2), L - 1.7, 0.04), CEU, 1.004, { ...S, alfa: 0.3, detalhe: 3 }));
  }
  // O para-brisa e o vidro de trás.
  partes.push(poli(retR(ID, L / 2 - 0.3, 0, 0.42, W - 0.2, 0.1), VIDRO, 1.0, { ...O, vidro: true, detalhe: 1 }), poli(em(ID, [L / 2 - 0.45, -W * 0.38, L / 2 - 0.14, -W * 0.4, L / 2 - 0.16, -W * 0.05, L / 2 - 0.46, -W * 0.1]), CEU, 1.002, { ...S, alfa: 0.4, detalhe: 2 }));
  partes.push(poli(retR(ID, -L / 2 + 0.16, 0, 0.18, W - 0.5, 0.06), VIDRO, 1.0, { ...O, vidro: true, detalhe: 2 }));
  // O teto: a chapa clara, as nervuras e o reflexo.
  partes.push(poli(retR(ID, -0.15 + 0.012, 0.012, L - 1.0, W - 0.36, 0.18), teto.nanquim, 1.3, { ...O, detalhe: 1 }), poli(retR(ID, -0.15, 0, L - 1.0, W - 0.38, 0.18), teto.meio, 1.302, { ...O, detalhe: 1 }));
  partes.push(poli(retR(ID, -0.2, -W * 0.18, L - 1.3, W * 0.3, 0.12), teto.luz, 1.304, { ...S, detalhe: 2 }));
  for (let u = -L / 2 + 0.9; u < L / 2 - 0.8; u += 0.6) partes.push(tira([u, -W / 2 + 0.25, u, W / 2 - 0.25], 0.02, teto.sombra, 1.305, { ...O, alfa: 0.35, detalhe: 3 }));
  // O ar-condicionado com as ventoinhas, as escotilhas e a placa de destino.
  bloco(partes, quadro(-2.2, 0), 2.6, 1.55, ACO, 1.4, 0.1);
  for (const u of [-3.0, -2.2, -1.4]) { partes.push(elipse(u, 0, 0.5, 0.5, '#2a2d32', 1.41, { contorno: 'leve', detalhe: 2 })); for (let k = 0; k < 3; k++) partes.push(tira(arco(u, 0, 0.18, 0.18, k * 2.1, k * 2.1 + 1.4, 4), 0.06, '#5a5e64', 1.412, { ...O, detalhe: 3 })); }
  for (const u of [1.4, 3.6]) bloco(partes, quadro(u, 0), 0.8, 0.8, teto, 1.36, 0.06);
  partes.push(poli(retQ(ID, L / 2 - 0.62, 0, 0.12, W * 0.7), '#0a0a0a', 1.32, { ...O, detalhe: 2 }), poli(retQ(ID, L / 2 - 0.62, 0, 0.06, W * 0.6), '#d89a2a', 1.322, { ...O, brilho: true, alfa: 0.55, detalhe: 3 }));
  // Os retrovisores em antena e os faróis.
  for (const s of [-1, 1]) {
    partes.push(tira([L / 2 - 0.2, s * (W / 2 - 0.05), L / 2 + 0.05, s * (W / 2 + 0.15), L / 2 + 0.2, s * (W / 2 + 0.05)], 0.035, '#121214', 1.2, { contorno: 'leve', detalhe: 2 }), elipse(L / 2 + 0.2, s * (W / 2 + 0.02), 0.12, 0.2, '#141416', 1.22, { contorno: 'leve', detalhe: 2 }));
    lampada(partes, ID, L / 2 - 0.06, s * W * 0.36, 0.08, 0.32, '#cfd8dc', null, 0.86);
    lampada(partes, ID, -L / 2 + 0.06, s * W * 0.38, 0.08, 0.3, '#7a1010', null, 0.86);
  }
  return partes;
}

// ---------- Rua ----------

/** Semáforo de braço: o poste no canto (−x), o braço sobre a rua e o grupo focal deitado, com as três lentes de pala virada para +y; a acesa brilha. */
function semaforo(seed: number, sinal: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cores = ['#1aa84a', '#e0a010', '#d82018'], apagadas = ['#0e2a16', '#3a2a08', '#3a0c0a'];
  sombraNoChao(partes, anel(-1.45, 0, 0.25, 0.25, 12), 0.01, '#0a0a0c', 0.4);
  disco(partes, -1.45, 0, 0.18, CONCRETO, 0.05);
  // A botoeira de pedestre no poste.
  bloco(partes, quadro(-1.45, 0.17), 0.12, 0.08, AMARELO, 1.0, 0.015);
  disco(partes, -1.45, 0, 0.09, GRAFITE, 1.1);
  // O braço e o grupo focal.
  cilindro(partes, -1.45, 0, 1.25, 0, 0.09, 0.06, GRAFITE, 1.3);
  bloco(partes, quadro(0.85, 0), 1.0, 0.34, GRAFITE, 1.35, 0.04);
  partes.push(poli(retQ(ID, 0.85, -0.14, 1.12, 0.05), '#d8d6d0', 1.36, { ...O, alfa: 0.7, detalhe: 3 }));
  for (let k = 0; k < 3; k++) {
    const u = 0.53 + k * 0.32, acesa = sinal === 2 - k;
    // A pala: um meio anel para a frente da lente.
    partes.push(elipse(u, 0.2, 0.24, 0.12, acesa ? cores[2 - k]! : apagadas[2 - k]!, 1.37, { ...O, brilho: acesa, detalhe: 2 }));
    partes.push(tira(arco(u, 0.17, 0.13, 0.12, 0.05, Math.PI - 0.05, 8), 0.035, '#08080a', 1.38, { contorno: 'leve', detalhe: 2 }));
    if (acesa) halo(partes, u, 0.32, 0.12, tom(cores[2 - k]!, -0.55), 0.5);
  }
  partes.push(lente(0.4, -0.08, 0, 0.9, 0.035, GRAFITE.brilho, 1.39, { ...S, alfa: 0.5, detalhe: 3 }));
  if (r() < 0.5) partes.push(poli(retQ(ID, -0.6, -0.02, 0.5, 0.2), '#1e5a3a', 1.33, { contorno: 'leve', detalhe: 2 }), tira([-0.8, -0.02, -0.4, -0.02], 0.02, '#e8e8e2', 1.332, { ...O, detalhe: 3 }));
  return partes;
}

/** Hidrante de coluna: a flange no chão, o corpo vermelho, as duas bocas dos lados com as tampas na corrente, a boca grande da frente, o capuz e a porca. */
function hidrante(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = r() < 0.75 ? VERMELHO : AMARELO;
  sombraNoChao(partes, anel(0, 0, 0.22, 0.22, 12), 0.01, '#0a0a0c', 0.45);
  disco(partes, 0, 0, 0.19, t, 0.05);
  for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; partes.push(elipse(Math.cos(a) * 0.16, Math.sin(a) * 0.16, 0.03, 0.03, t.nanquim, 0.06, { ...O, detalhe: 3 })); }
  for (const s of [-1, 1]) { cilindro(partes, 0, 0, s * 0.22, 0, 0.09, 0.08, t, 0.5); disco(partes, s * 0.23, 0, 0.045, t, 0.52); partes.push(tira([s * 0.22, 0.03, s * 0.12, 0.1], 0.01, '#2a2a2a', 0.53, { ...O, detalhe: 3 })); }
  cilindro(partes, 0, 0, 0, 0.22, 0.12, 0.11, t, 0.48);
  disco(partes, 0, 0.23, 0.06, t, 0.5);
  disco(partes, 0, 0, 0.13, t, 0.7);
  disco(partes, 0, 0, 0.085, AMARELO.base === t.base ? VERMELHO : tonsDe('#c8c4b8'), 0.75);
  partes.push(poli([0, -0.035, 0.033, -0.011, 0.02, 0.028, -0.02, 0.028, -0.033, -0.011], ACO.sombra, 0.78, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Lixeira: a papeleira laranja de poste (0) ou o contêiner de lixo com rodas e tampa articulada (1). */
function lixeira(seed: number, conteiner: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  if (!conteiner) {
    const t = r() < 0.6 ? LARANJA : tonsDe('#2a6a3a');
    sombraNoChao(partes, anel(0, 0.02, 0.22, 0.2, 12), 0.01, '#0a0a0c', 0.4);
    disco(partes, 0, -0.17, 0.045, ACO, 0.5);
    disco(partes, 0, 0.02, 0.2, t, 0.8, 0.18);
    partes.push(elipse(0, 0.03, 0.3, 0.27, '#0c0c0c', 0.81, { ...O, detalhe: 1 }));
    for (let k = 0; k < 5; k++) partes.push(poli(bolha((r() - 0.5) * 0.14, 0.03 + (r() - 0.5) * 0.12, 0.04, 0.03, 6, 0.3, r), ['#d8d4c8', '#6a4a2a', '#c83a2a', '#3a6a9a'][Math.floor(r() * 4)]!, 0.75, { ...O, alfa: 0.8, detalhe: 3 }));
    partes.push(tira(arco(0, 0.02, 0.16, 0.14, Math.PI * 0.95, Math.PI * 1.55, 6), 0.025, t.brilho, 0.82, { ...O, alfa: 0.7, detalhe: 3 }));
    return partes;
  }
  const t = tonsDe(['#2a5a34', '#4a4e54', '#1e3a6a'][Math.floor(r() * 3)]!);
  sombraNoChao(partes, retR(ID, 0, 0, 1.3, 0.8, 0.1), 0.01, '#0a0a0c', 0.5);
  for (const s of [-1, 1]) partes.push(elipse(s * 0.5, 0.38, 0.18, 0.1, BORRACHA, 0.2, { contorno: 'leve', detalhe: 2 }));
  bloco(partes, ID, 1.24, 0.72, t, 1.0, 0.06);
  // A tampa: o arco das nervuras, a dobradiça atrás (−y) e a pega da frente.
  partes.push(poli(retR(ID, 0, 0.02, 1.16, 0.62, 0.06), t.meio, 1.1, { contorno: 'leve', detalhe: 1 }));
  for (const u of [-0.3, 0, 0.3]) partes.push(tira([u, -0.26, u, 0.28], 0.05, t.luz, 1.102, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(poli(retQ(ID, 0, -0.33, 1.1, 0.05), t.sombra, 1.104, { ...O, detalhe: 2 }), poli(retQ(ID, 0, 0.34, 0.5, 0.05), t.nanquim, 1.104, { ...O, detalhe: 2 }));
  if (r() < 0.5) partes.push(poli(bolha(0.4, 0.38, 0.12, 0.06, 7, 0.3, r), '#1a1a1c', 1.105, { ...O, detalhe: 3 }));
  return partes;
}

/** Caçamba de entulho: a borda amarela, as paredes que afunilam para dentro (a do lado da luz na sombra), o entulho e as faixas refletivas. */
function cacamba(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = r() < 0.6 ? AMARELO : LARANJA, U = 1.75, V = 0.85;
  sombraNoChao(partes, retQ(ID, 0, 0, 3.7, 1.9), 0.01, '#0a0a0c', 0.55);
  partes.push(poli(retQ(ID, 0.015, 0.018, 2 * U + 0.06, 2 * V + 0.06), t.nanquim, 1.1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(ID, 0, 0, 2 * U, 2 * V), t.base, 1.103, { ...O, detalhe: 1 }));
  // As paredes de dentro, que afunilam até o fundo; o fundo.
  const u = U - 0.08, v = V - 0.08, bu = U - 0.45, bv = V - 0.3;
  const faces: [number[], number][] = [[[-u, -v, u, -v, bu, -bv, -bu, -bv], Math.PI / 2], [[u, -v, u, v, bu, bv, bu, -bv], Math.PI], [[u, v, -u, v, -bu, bv, bu, bv], -Math.PI / 2], [[-u, v, -u, -v, -bu, -bv, -bu, bv], 0]];
  for (const [pts, n] of faces) partes.push(poli(pts, tomDaFace(t, olhar(n)), 1.105, { ...O, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, 0, 2 * bu, 2 * bv), t.nanquim, 1.106, { ...O, detalhe: 1 }));
  // O entulho: tijolo, concreto, tábuas, um saco.
  for (let k = 0; k < 26; k++) {
    const x = (r() - 0.5) * (2 * bu + 0.4), y = (r() - 0.5) * (2 * bv + 0.2), tipo = r();
    if (tipo < 0.35) bloco(partes, quadro(x, y, r() * 3), 0.22 + r() * 0.12, 0.1, tonsDe('#8a3a22'), 1.11 + k * 0.004, 0.02);
    else if (tipo < 0.65) partes.push(poli(bolha(x, y, 0.1 + r() * 0.12, 0.08 + r() * 0.08, 7, 0.35, r), tomDaFace(CONCRETO, r() * 2 - 1), 1.11 + k * 0.004, { contorno: 'leve', detalhe: 2 }));
    else if (tipo < 0.85) { const a = r() * 3, l = 0.5 + r() * 0.6; partes.push(tira([x - Math.cos(a) * l / 2, y - Math.sin(a) * l / 2, x + Math.cos(a) * l / 2, y + Math.sin(a) * l / 2], 0.1, '#8a6a42', 1.11 + k * 0.004, { contorno: 'leve', detalhe: 2 })); }
    else partes.push(poli(bolha(x, y, 0.2, 0.15, 9, 0.2, r), '#d4ccb4', 1.11 + k * 0.004, { contorno: 'leve', detalhe: 2 }));
  }
  // A borda dobrada, as alças de içar e as faixas refletivas nas pontas.
  partes.push(tira([-U, -V, U, -V], 0.06, t.brilho, 1.3, { ...O, alfa: 0.6, detalhe: 3 }), tira([-U, -V, -U, V], 0.06, t.luz, 1.3, { ...O, alfa: 0.6, detalhe: 3 }));
  for (const s of [-1, 1]) {
    for (let k = 0; k < 4; k++) partes.push(poli(retQ(ID, s * (U - 0.03), -V + 0.25 + k * 0.4, 0.05, 0.18), k % 2 ? '#e8e4dc' : '#c81a14', 1.31, { ...O, detalhe: 3 }));
    for (const sv of [-1, 1]) partes.push(tira(arco(s * (U + 0.04), sv * 0.55, 0.08, 0.1, s > 0 ? -1.4 : Math.PI - 1.4, s > 0 ? 1.4 : Math.PI + 1.4, 6), 0.035, ACO.sombra, 1.2, { contorno: 'leve', detalhe: 3 }));
  }
  return partes;
}

/** Ponto de ônibus: a cobertura de vidro sobre a estrutura (vê-se o banco por baixo), o painel de anúncio iluminado numa ponta e a placa no poste. */
function pontoDeOnibus(seed: number, aceso: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], C = 3.4, P = 1.4, u0 = -C / 2 + 0.1;
  sombraNoChao(partes, retQ(ID, -0.15, -0.05, 3.2, 1.25), 0.01, '#0a0a0c', 0.3);
  // O banco e os pés, por baixo da cobertura.
  bloco(partes, quadro(0.1, -0.3), 2.0, 0.36, ACO, 0.45, 0.04);
  for (let u = -0.8; u <= 1.0; u += 0.12) partes.push(tira([u, -0.46, u, -0.14], 0.03, ACO.sombra, 0.455, { ...O, alfa: 0.6, detalhe: 3 }));
  // A parede de vidro de trás e a da ponta.
  partes.push(poli(retQ(ID, 0, -P / 2 + 0.05, C - 0.3, 0.04), '#9ab4c4', 0.9, { ...O, vidro: true, alfa: 0.7, detalhe: 2 }));
  // O painel de anúncio iluminado, em pé na ponta −x.
  partes.push(poli(retQ(ID, u0, -0.05, 0.16, P - 0.25), GRAFITE.nanquim, 1.0, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, u0, -0.05, 0.1, P - 0.35), aceso ? '#e8dcb8' : '#8a8a84', 1.002, { ...O, brilho: aceso, detalhe: 2 }));
  if (aceso) for (const s of [-1, 1]) partes.push(elipse(u0 + s * 0.22, -0.05, 0.3, 1.1, '#5a4a2a', 1.003, { ...O, brilho: true, alfa: 0.6, desfoque: 0.1, detalhe: 2 }));
  // A cobertura: o vidro fumê, a moldura e os montantes; o reflexo.
  const cu = -0.2, cl = C - 0.4;
  partes.push(poli(retQ(ID, cu, -0.08, cl, P - 0.1), '#3a5060', 1.4, { ...O, vidro: true, alfa: 0.42, detalhe: 1 }));
  partes.push(tira([...retQ(ID, cu, -0.08, cl, P - 0.1), cu - cl / 2, -0.08 - (P - 0.1) / 2], 0.06, GRAFITE.base, 1.42, { contorno: 'leve', detalhe: 1 }));
  for (const u of [-0.9, 0.1, 0.9]) partes.push(tira([cu + u, -P / 2 + 0.0, cu + u, P / 2 - 0.16], 0.04, GRAFITE.luz, 1.421, { ...O, detalhe: 2 }));
  partes.push(lente(cu - cl / 2 + 0.2, -P / 2 + 0.2, 0.05, cl * 0.6, 0.12, '#c8dce8', 1.422, { ...S, alfa: 0.3, detalhe: 3 }));
  // A placa no poste, na ponta +x.
  disco(partes, C / 2 - 0.1, 0.45, 0.05, ACO, 1.2);
  partes.push(poli(retQ(ID, C / 2 - 0.1, 0.45, 0.06, 0.42), '#0a0a0c', 1.3, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, C / 2 - 0.1, 0.45, 0.04, 0.38), r() < 0.5 ? '#1e4a8a' : '#d8d4c8', 1.302, { ...O, detalhe: 2 }));
  return partes;
}

/** Orelhão: a concha de fibra em ovo (laranja ou azul) vista de cima, com a boca aberta para +y e o telefone na sombra lá dentro. */
function orelhao(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = tonsDe(r() < 0.6 ? '#d2661a' : '#1e5aa8');
  sombraNoChao(partes, anel(0, 0.05, 0.5, 0.48, 16), 0.01, '#0a0a0c', 0.4);
  // A concha: nanquim, a cúpula em volume e a borda da boca.
  partes.push(elipse(0.015, 0.018, 1.0, 0.96, t.nanquim, 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(elipse(0, 0, 0.96, 0.92, t.base, 1.402, { ...O, detalhe: 1 }));
  partes.push(elipse(LUZ_X * 0.05, LUZ_Y * 0.05, 0.82, 0.76, t.meio, 1.404, { ...S, detalhe: 1 }), elipse(LUZ_X * 0.14, LUZ_Y * 0.14, 0.5, 0.44, t.luz, 1.406, { ...S, detalhe: 2 }), elipse(LUZ_X * 0.22, LUZ_Y * 0.22, 0.16, 0.12, t.brilho, 1.408, { ...S, alfa: 0.8, detalhe: 3 }));
  // A boca: a sombra de dentro vista pela abertura da frente (+y), com o telefone, e a borda clara da fibra em volta.
  partes.push(elipse(0, 0.3, 0.62, 0.34, '#0c0c0e', 1.41, { ...O, detalhe: 1 }), elipse(0, 0.33, 0.48, 0.22, '#1a1b1e', 1.411, { ...S, detalhe: 2 }));
  bloco(partes, quadro(0, 0.3), 0.18, 0.08, GRAFITE, 1.412, 0.015);
  partes.push(tira([0.07, 0.34, 0.12, 0.4, 0.05, 0.42], 0.012, '#2a2a2e', 1.414, { ...O, detalhe: 3 }));
  partes.push(tira(arco(0, 0.3, 0.31, 0.17, Math.PI + 0.05, Math.PI * 2 - 0.05, 12), 0.04, t.brilho, 1.415, { ...O, alfa: 0.8, detalhe: 2 }), tira(arco(0, 0.3, 0.31, 0.17, 0.1, Math.PI - 0.1, 12), 0.03, t.sombra, 1.415, { ...O, detalhe: 2 }));
  partes.push(elipse(0, -0.1, 0.06, 0.06, t.nanquim, 1.414, { ...O, alfa: 0.6, detalhe: 3 }));
  return partes;
}

/** Cone de trânsito: a base quadrada, o cone laranja com as duas faixas refletivas e a boca no topo. */
function cone(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], g = (r() - 0.5) * 0.3, f = quadro(0, 0, g);
  sombraNoChao(partes, retQ(f, 0, 0, 0.38, 0.38), 0.01, '#0a0a0c', 0.4);
  bloco(partes, f, 0.36, 0.36, LARANJA, 0.04, 0.03);
  disco(partes, 0, 0, 0.13, LARANJA, 0.2);
  partes.push(tira(anel(0, 0, 0.095, 0.095, 18), 0.035, '#e8e8e2', 0.22, { ...O, detalhe: 2 }), tira(arco(0, 0, 0.095, 0.095, Math.PI * 0.95, Math.PI * 1.55, 6), 0.02, '#ffffff', 0.221, { ...O, alfa: 0.8, detalhe: 3 }));
  partes.push(tira(anel(0, 0, 0.055, 0.055, 14), 0.022, '#e8e8e2', 0.23, { ...O, alfa: 0.9, detalhe: 3 }));
  partes.push(elipse(0, 0, 0.045, 0.045, LARANJA.sombra, 0.24, { ...O, detalhe: 3 }), elipse(0.004, 0.004, 0.025, 0.025, '#1a0a04', 0.241, { ...O, detalhe: 3 }));
  return partes;
}

/** Barreira de rua: a mureta de concreto em seções de 2 m, com a encosta inclinada dos dois lados e a crista (0), ou a de plástico, em gomos vermelhos e brancos de 1,2 m (1). */
function barreira(seed: number, C: number, plastica: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, retQ(ID, 0, 0.02, C + 0.05, 0.65), 0.01, '#0a0a0c', 0.4);
  if (!plastica) {
    const n = Math.max(1, Math.round(C / 2)), l = C / n;
    for (let k = 0; k < n; k++) {
      const u = -C / 2 + l * (k + 0.5), w = l - 0.03;
      partes.push(poli(retQ(ID, u + 0.01, 0.015, w + 0.03, 0.62), CONCRETO.nanquim, 0.8, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
      partes.push(poli(retQ(ID, u, -0.16, w, 0.28), CONCRETO.luz, 0.803, { ...O, detalhe: 1 }), poli(retQ(ID, u, 0.16, w, 0.28), CONCRETO.sombra, 0.803, { ...O, detalhe: 1 }));
      partes.push(poli(retQ(ID, u, -0.02, w, 0.16), CONCRETO.meio, 0.806, { ...O, detalhe: 1 }), tira([u - w / 2, -0.09, u + w / 2, -0.09], 0.015, CONCRETO.brilho, 0.807, { ...O, alfa: 0.7, detalhe: 3 }));
      for (let j = 0; j < 3; j++) partes.push(poli(bolha(u + (r() - 0.5) * w * 0.8, (r() - 0.5) * 0.4, 0.06 + r() * 0.08, 0.03, 6, 0.4, r), CONCRETO.sombra, 0.808, { ...S, alfa: 0.35, detalhe: 3 }));
      // As faixas pretas e amarelas na crista.
      if (r() < 0.6) for (let q = -w / 2 + 0.1; q < w / 2 - 0.1; q += 0.24) partes.push(poli([q, -0.08, q + 0.12, -0.08, q + 0.06, 0.04, q - 0.06, 0.04], AMARELO.luz, 0.809, { ...O, alfa: 0.85, detalhe: 3 }));
    }
    return partes;
  }
  const n = Math.max(1, Math.round(C / 1.2)), l = C / n;
  for (let k = 0; k < n; k++) {
    const u = -C / 2 + l * (k + 0.5), t = k % 2 ? tonsDe('#d8d6cc') : tonsDe('#b42218'), f = quadro(u, 0);
    partes.push(poli(retR(f, 0.012, 0.014, l - 0.02, 0.48, 0.14), t.nanquim, 0.9, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
    partes.push(poli(retR(f, 0, 0, l - 0.06, 0.44, 0.12), t.base, 0.902, { ...O, detalhe: 1 }), poli(retR(f, -0.02, -0.06, l - 0.2, 0.22, 0.08), t.luz, 0.904, { ...S, detalhe: 2 }));
    partes.push(lente(-l / 2 + 0.15, -0.11, 0, l * 0.5, 0.04, t.brilho, 0.906, { ...S, alfa: 0.6, detalhe: 3 }));
    disco(partes, 0, 0.04, 0.06, t, 0.91);
  }
  return partes;
}

/** Bomba de gasolina na ilha: o meio-fio de concreto com as pontas zebradas, os protetores amarelos, o gabinete com os visores acesos nas duas faces e as mangueiras com os bicos. */
function bombaDeGasolina(seed: number, acesa = true): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = tonsDe(['#a8221a', '#1e4a8a', '#2a6a3a'][Math.floor(r() * 3)]!);
  sombraNoChao(partes, retQ(ID, 0, 0, 3.1, 1.25), 0.01, '#0a0a0c', 0.4);
  bloco(partes, ID, 3.0, 1.1, CONCRETO, 0.15, 0.06);
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) { const v = -0.45 + k * 0.28; partes.push(poli([s * 1.5, v, s * 1.5, v + 0.12, s * 1.32, v + 0.26, s * 1.32, v + 0.14], '#141414', 0.16, { ...O, detalhe: 3 })); }
  for (const s of [-1, 1]) { disco(partes, s * 1.2, 0, 0.09, AMARELO, 0.9); partes.push(tira(anel(s * 1.2, 0, 0.065, 0.065, 12), 0.025, '#141414', 0.91, { ...O, alfa: 0.8, detalhe: 3 })); }
  // O gabinete: corpo claro, tampo na cor da bandeira, os visores e as mangueiras.
  bloco(partes, ID, 1.0, 0.5, tonsDe('#d8d6ce'), 1.4, 0.05);
  partes.push(poli(retR(ID, 0, 0, 0.86, 0.36, 0.04), cor.base, 1.42, { contorno: 'leve', detalhe: 1 }), poli(retR(ID, -0.04, -0.05, 0.7, 0.16, 0.04), cor.luz, 1.422, { ...S, detalhe: 2 }));
  for (const s of [-1, 1]) {
    partes.push(poli(retQ(ID, -0.15, s * 0.255, 0.42, 0.05), '#0a1a10', 1.43, { ...O, detalhe: 2 }), poli(retQ(ID, -0.15, s * 0.255, 0.38, 0.03), acesa ? '#3aa860' : '#1e2a26', 1.432, { ...O, brilho: acesa, detalhe: 2 }));
    if (acesa) partes.push(elipse(-0.15, s * 0.33, 0.5, 0.14, '#0e3a1e', 1.433, { ...O, brilho: true, alfa: 0.5, desfoque: 0.04, detalhe: 3 }));
    for (const u of [0.22, 0.38]) {
      const v0 = s * 0.27, pts = [u, v0, u + 0.04, s * 0.42, u - 0.08 + r() * 0.06, s * 0.48, u - 0.18, s * 0.4, u - 0.1 + r() * 0.04, v0];
      partes.push(tira(pts, 0.035, '#08080a', 1.0, { contorno: 'leve', detalhe: 2 }));
      partes.push(poli(retQ(ID, u, s * 0.26, 0.07, 0.04), u < 0.3 ? '#2a6a2a' : '#c8a018', 1.44, { contorno: 'leve', detalhe: 3 }));
    }
  }
  partes.push(lente(-0.42, -0.2, 0, 0.8, 0.03, '#ffffff', 1.445, { ...S, alfa: 0.4, detalhe: 3 }));
  // Apagada (abandonada): a poeira assentada no tampo e as manchas de ferrugem nas quinas.
  if (!acesa) {
    partes.push(poli(retR(ID, 0.05, 0.04, 0.8, 0.3, 0.04), '#8a7a5c', 1.446, { ...S, alfa: 0.3, desfoque: 0.04, detalhe: 2 }));
    for (let k = 0; k < 4; k++) partes.push(elipse((r() - 0.5) * 0.9, (r() - 0.5) * 0.4, 0.08 + r() * 0.08, 0.05 + r() * 0.04, '#5a3420', 1.447, { ...S, alfa: 0.5, detalhe: 3 }));
  }
  return partes;
}

/**
 * Cobertura de posto (Q21d), com o teto oculto como os telhados dos exemplos: a testeira em volta (a faixa na cor da bandeira por fora e a chapa
 * branca por dentro, com as faces em degraus de tom), as colunas de chapa nos eixos das ilhas (v = ±D/4) e, acesa, as poças de luz das
 * luminárias no piso. As bombas vão por baixo, nas ilhas: com `C` 14, nas posições u = ±2,2.
 */
function coberturaDePosto(seed: number, C: number, D: number, acesa: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = tonsDe(['#b42218', '#1e4a8a', '#2a7a3a', '#c86a10'][Math.floor(r() * 4)]!), CHAPA = tonsDe('#d2d4d2');
  const U = C / 2, V = D / 2, b = 0.62, fx = 0.26;
  // As colunas: a sapata de concreto e o pilar de chapa.
  const us = C > 18 ? [-(U - 1.6), 0, U - 1.6] : [-(U - 1.6), U - 1.6];
  for (const cu of us) for (const s of [-1, 1]) {
    const cv = (s * D) / 4;
    sombraNoChao(partes, retQ(ID, cu, cv, 0.62, 0.62), 0.01, '#0a0a0c', 0.45);
    bloco(partes, quadro(cu, cv), 0.56, 0.56, CONCRETO, 0.16, 0.06);
    bloco(partes, quadro(cu, cv), 0.34, 0.34, CHAPA, 1.42, 0.05);
  }
  // As poças das luminárias, no piso, entre as colunas.
  if (acesa) for (let u = -U + 2.2; u <= U - 2.2 + 0.01; u += (C - 4.4) / Math.max(1, Math.round((C - 4.4) / 3.4))) for (const s of [-1, 1]) partes.push(elipse(u, (s * D) / 4, 1.7, 1.5, '#1e2228', 0.012, { ...O, brilho: true, alfa: 0.55, desfoque: 0.9, detalhe: 1 }));
  // A testeira: o nanquim por fora, a faixa da bandeira e a chapa, lado a lado, com a face de cada lado no tom da sua orientação.
  const lado = (e0: number, e1: number): number[][] => [
    [-U + e0, -V + e0, U - e0, -V + e0, U - e1, -V + e1, -U + e1, -V + e1], [U - e0, -V + e0, U - e0, V - e0, U - e1, V - e1, U - e1, -V + e1],
    [U - e0, V - e0, -U + e0, V - e0, -U + e1, V - e1, U - e1, V - e1], [-U + e0, V - e0, -U + e0, -V + e0, -U + e1, -V + e1, -U + e1, V - e1],
  ];
  const normais = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  lado(-0.04, b + 0.03).forEach(pts => partes.push(poli(pts, cor.nanquim, 1.5, { contorno: 'leve', sombraLeve: true, detalhe: 1 })));
  lado(0, fx).forEach((pts, i) => partes.push(poli(pts, tomDaFace(cor, olhar(normais[i]!)), 1.503, { ...O, detalhe: 1 })));
  lado(fx, b).forEach((pts, i) => partes.push(poli(pts, tomDaFace(CHAPA, olhar(normais[i]!)), 1.503, { ...O, detalhe: 1 })));
  // O friso claro na aresta de fora (lado da luz) e a borda de dentro na sombra.
  partes.push(tira([-U + 0.03, V - 0.03, -U + 0.03, -V + 0.03, U - 0.03, -V + 0.03], 0.05, cor.brilho, 1.506, { ...O, alfa: 0.7, detalhe: 2 }));
  partes.push(tira([-U + b, -V + b, U - b, -V + b, U - b, V - b, -U + b, V - b, -U + b, -V + b], 0.05, CHAPA.sombra, 1.506, { ...O, alfa: 0.8, detalhe: 2 }));
  // As juntas das placas da testeira.
  for (let u = -U + 2; u < U - 1; u += 2) for (const s of [-1, 1]) partes.push(tira([u, s * (V - fx), u, s * (V - b + 0.02)], 0.02, CHAPA.sombra, 1.507, { ...O, alfa: 0.5, detalhe: 3 }));
  return partes;
}

/** Poste de rua (Q21d): a base, a haste de aço galvanizado do pé (−x) até a cabeça (+x), a luminária fechada e, acesa, o clarão que escapa pela borda. */
function posteDeRua(sodio: boolean, acesa: boolean): Parte[] {
  const partes: Parte[] = [], px = -1.1, hx = 0.72, t = tonsDe('#8a8e92');
  sombraNoChao(partes, anel(px, 0, 0.24, 0.24, 12), 0.01, '#0a0a0c', 0.4);
  disco(partes, px, 0, 0.21, CONCRETO, 0.05);
  disco(partes, px, 0, 0.11, ACO, 1.1);
  cilindro(partes, px, 0, hx - 0.3, 0, 0.065, 0.045, ACO, 1.4);
  if (acesa) partes.push(elipse(hx, 0.02, 1.05, 0.55, sodio ? '#5a3410' : '#36404e', 1.441, { ...O, brilho: true, alfa: 0.6, desfoque: 0.14, detalhe: 2 }));
  partes.push(poli(retR(ID, hx + 0.012, 0.018, 0.84, 0.36, 0.16), t.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retR(ID, hx, 0, 0.8, 0.32, 0.15), t.base, 1.452, { ...O, detalhe: 1 }), poli(retR(ID, hx - 0.05, -0.04, 0.6, 0.18, 0.08), t.luz, 1.454, { ...S, detalhe: 2 }));
  partes.push(lente(hx - 0.32, -0.09, 0, 0.5, 0.035, t.brilho, 1.456, { ...S, alfa: 0.7, detalhe: 3 }));
  return partes;
}
const luzDoPoste = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'acesa', 1) ? { raio: 8, cor: ligado(params, 'sodio', 1) ? '#ffc27a' : '#e4ecff', intensidade: 0.85, power: 'grid', flicker: 0 } : null);
const luzDaCobertura = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'acesa', 1) ? { raio: Math.max(7, num({ seed: 0, params }, 'comprimento', 14, 8, 24) * 0.6), cor: '#eef2ff', intensidade: 0.9, power: 'grid', flicker: 0 } : null);

// ---------- Escritório, mercado e lanchonete (Q21b) ----------

const LAMINADO: Tons = tonsDe('#cdc6b6'), CINZA_CLARO: Tons = tonsDe('#c4c6c4'), PAPEL = '#eeeae0', TELA = '#2a5a8a';
const PRODUTOS = ['#c8281c', '#e0a020', '#2a6ab0', '#3a8a3a', '#e8e4d8', '#8a2a6a', '#d86a1a', '#1e1e22', '#6ab0d8', '#f0d040'];

/** Cadeira de escritório em (x, y), com o encosto para o lado `ang`: a base de cinco patas com rodízios, o assento, os braços e o encosto. */
function cadeiraDeEscritorio(partes: Parte[], r: () => number, x: number, y: number, ang: number, cor: string): void {
  const f = quadro(x, y, ang - Math.PI / 2), g = r() * 1.2;
  for (let k = 0; k < 5; k++) { const a = g + (k / 5) * Math.PI * 2, px = x + Math.cos(a) * 0.3, py = y + Math.sin(a) * 0.3; partes.push(tira([x, y, px, py], 0.04, GRAFITE.base, 0.1, { contorno: 'leve', detalhe: 2 }), elipse(px, py, 0.06, 0.06, '#0a0a0c', 0.08, { contorno: 'leve', detalhe: 3 })); }
  estofado(partes, f, ang - Math.PI / 2, 0, -0.03, 0.48, 0.46, cor, 0.48, 0.1);
  for (const s of [-1, 1]) partes.push(poli(retR(f, s * 0.26, -0.02, 0.06, 0.3, 0.03), GRAFITE.base, 0.66, { contorno: 'leve', detalhe: 2 }));
  estofado(partes, f, ang - Math.PI / 2, 0, 0.26, 0.46, 0.1, tom(cor, -0.15), 1.0, 0.05);
}

/** Monitor visto de cima, encostado no fundo da mesa: o pé, a tela em fita e a face acesa vista um pouco de frente (+y). */
function monitor(partes: Parte[], x: number, y: number, w: number, z: number, aceso = true): void {
  partes.push(elipse(x, y - 0.04, 0.2, 0.12, GRAFITE.base, z, { contorno: 'leve', detalhe: 2 }));
  partes.push(poli(retR(ID, x, y - 0.08, w, 0.05, 0.015), GRAFITE.nanquim, z + 0.3, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, x, y - 0.03, w - 0.02, 0.06), '#0c0e12', z + 0.302, { ...O, detalhe: 2 }));
  if (aceso) partes.push(poli(retQ(ID, x, y - 0.03, w - 0.05, 0.04), TELA, z + 0.304, { ...O, brilho: true, alfa: 0.8, detalhe: 2 }));
}

/** Estação de trabalho: a mesa de laminado com o fundo para −y, um ou dois monitores, o teclado, o mouse, papéis e a caneca; a cadeira de rodinhas na frente. */
function estacaoDeTrabalho(seed: number, monitores: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], yM = -0.375;
  sombraNoChao(partes, retQ(ID, 0, -0.1, 1.65, 1.3), 0.01, '#0a0a0c', 0.3);
  cadeiraDeEscritorio(partes, r, 0.05 + (r() - 0.5) * 0.2, 0.35, Math.PI / 2 + (r() - 0.5) * 0.4, ['#24272b', '#1e3a6e', '#5a1e1e'][Math.floor(r() * 3)]!);
  bloco(partes, quadro(0, yM), 1.6, 0.75, LAMINADO, 0.75, 0.02);
  partes.push(elipse(0.65, -0.68, 0.06, 0.06, '#1a1a1c', 0.78, { ...O, detalhe: 3 }));
  if (monitores >= 2) { monitor(partes, -0.3, -0.6, 0.54, 0.77); monitor(partes, 0.28, -0.6, 0.54, 0.77); } else monitor(partes, 0, -0.6, 0.6, 0.77);
  // O teclado com as teclas, o mouse e o cabo.
  partes.push(poli(retR(ID, 0, -0.27, 0.44, 0.14, 0.015), '#16181c', 0.78, { contorno: 'leve', detalhe: 2 }));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 12; j++) partes.push(poli(retQ(ID, -0.19 + j * 0.035, -0.32 + i * 0.03, 0.026, 0.022), '#3a3d44', 0.782, { ...O, detalhe: 3 }));
  partes.push(elipse(0.32, -0.26, 0.06, 0.09, '#1c1e22', 0.78, { contorno: 'leve', detalhe: 3 }), elipse(0.315, -0.28, 0.025, 0.03, '#5a5e66', 0.782, { ...S, detalhe: 3 }));
  // Papéis, a caneca e, às vezes, um vasinho.
  for (let k = 0; k < 3; k++) partes.push(poli(retQ(quadro(-0.6 + r() * 0.1, -0.3 + r() * 0.08, (r() - 0.5) * 0.5), 0, 0, 0.21, 0.29), PAPEL, 0.78 + k * 0.002, { contorno: 'leve', detalhe: 2 }));
  partes.push(tira([-0.67, -0.36, -0.55, -0.36], 0.01, '#5a5a5a', 0.79, { ...O, alfa: 0.5, detalhe: 3 }), tira([-0.67, -0.32, -0.58, -0.32], 0.01, '#5a5a5a', 0.79, { ...O, alfa: 0.5, detalhe: 3 }));
  disco(partes, 0.58, -0.32, 0.045, tonsDe(PRODUTOS[Math.floor(r() * PRODUTOS.length)]!), 0.82);
  partes.push(elipse(0.58, -0.32, 0.06, 0.06, '#2a1608', 0.84, { ...O, detalhe: 3 }));
  if (r() < 0.6) { disco(partes, 0.66, -0.62, 0.05, tonsDe('#a85a32'), 0.82); for (let k = 0; k < 6; k++) partes.push(lente(0.66, -0.62, r() * 6.28, 0.1, 0.035, k % 2 ? '#3a7a3a' : '#2a5a2a', 0.9, { contorno: 'leve', detalhe: 3 })); }
  return partes;
}

/** Divisória de baias: o painel de tecido entre os perfis de alumínio, com os montantes e os pés. */
function divisoria(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = tonsDe(['#4a5a6a', '#6a6a64', '#3a4a5a'][Math.floor(r() * 3)]!);
  sombraNoChao(partes, retQ(ID, 0, 0.03, C, 0.14), 0.01, '#0a0a0c', 0.3);
  const n = Math.max(1, Math.round(C / 1.2));
  for (let k = 0; k <= n; k++) { const u = -C / 2 + (C * k) / n; partes.push(poli(retQ(ID, u, 0, 0.05, 0.44), ACO.sombra, 0.04, { contorno: 'leve', detalhe: 2 })); }
  partes.push(poli(retQ(ID, 0.01, 0.012, C, 0.09), t.nanquim, 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(ID, 0, 0, C - 0.02, 0.07), t.base, 1.202, { ...O, detalhe: 1 }));
  partes.push(tira([-C / 2 + 0.02, -0.02, C / 2 - 0.02, -0.02], 0.025, ACO.luz, 1.21, { ...O, detalhe: 2 }), tira([-C / 2 + 0.02, -0.025, C / 2 - 0.02, -0.025], 0.008, ACO.brilho, 1.212, { ...O, alfa: 0.8, detalhe: 3 }));
  for (let k = 0; k <= n; k++) { const u = -C / 2 + (C * k) / n; partes.push(poli(retQ(ID, u, 0, 0.05, 0.1), ACO.base, 1.22, { contorno: 'leve', detalhe: 2 })); }
  return partes;
}

/** Copiadora multifuncional: o corpo cinza-claro, a tampa do vidro com a pega, o painel com a tela acesa, a bandeja de saída com folhas e as gavetas de papel na frente. */
function copiadora(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, retQ(ID, 0, 0, 1.15, 0.75), 0.01, '#0a0a0c', 0.35);
  bloco(partes, quadro(-0.5, -0.02), 0.22, 0.4, CINZA_CLARO, 0.85, 0.02);
  for (let k = 0; k < 4; k++) partes.push(poli(retQ(quadro(-0.5 + (r() - 0.5) * 0.02, -0.02, (r() - 0.5) * 0.08), 0, 0, 0.19, 0.28), PAPEL, 0.87 + k * 0.003, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, quadro(0.08, 0), 0.92, 0.66, CINZA_CLARO, 1.1, 0.04);
  for (const v of [0.2, 0.28]) partes.push(tira([-0.32, v, 0.48, v], 0.008, CINZA_CLARO.nanquim, 1.105, { ...O, alfa: 0.6, detalhe: 3 }));
  // A tampa do vidro e o alimentador de originais.
  bloco(partes, quadro(-0.04, -0.06), 0.6, 0.44, tonsDe('#8a8c8e'), 1.2, 0.03);
  partes.push(poli(retQ(ID, -0.04, -0.12, 0.42, 0.16), '#5a5c5e', 1.22, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, -0.04, 0.14, 0.24, 0.03), '#4a4c4e', 1.22, { ...O, detalhe: 3 }));
  // O painel de comando com a tela e os botões.
  partes.push(poli(retR(ID, 0.4, 0.1, 0.22, 0.26, 0.02), '#1c1e22', 1.2, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0.4, 0.05, 0.16, 0.1), '#3a7ab0', 1.202, { ...O, brilho: true, alfa: 0.7, detalhe: 2 }));
  for (let k = 0; k < 6; k++) partes.push(elipse(0.34 + (k % 3) * 0.06, 0.15 + Math.floor(k / 3) * 0.05, 0.03, 0.03, k === 5 ? '#2a8a3a' : '#5a5e66', 1.203, { ...O, detalhe: 3 }));
  return partes;
}

/** Bebedouro de galão: o corpo branco, as torneiras na frente (+y) sobre a bandeja, o galão azul de cabeça para baixo e o copinho do lado. */
function bebedouroDeGalao(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, retQ(ID, 0, 0, 0.4, 0.4), 0.01, '#0a0a0c', 0.35);
  bloco(partes, ID, 0.34, 0.34, tonsDe('#dcdcd6'), 1.0, 0.03);
  partes.push(poli(retQ(ID, 0, 0.17, 0.2, 0.06), '#3a3c40', 1.0, { contorno: 'leve', detalhe: 3 }));
  for (const [s, c] of [[-1, '#2a5aa8'], [1, '#b8281c']] as const) partes.push(elipse(s * 0.06, 0.16, 0.04, 0.05, c, 1.02, { contorno: 'leve', detalhe: 3 }));
  // O galão: o azul translúcido, os anéis do plástico, o ombro e o fundo, o brilho.
  partes.push(elipse(0.01, 0.012, 0.31, 0.31, '#0c2440', 1.3, { contorno: 'leve', detalhe: 1 }), elipse(0, 0, 0.29, 0.29, '#3a7ac0', 1.302, { ...O, vidro: true, alfa: 0.85, detalhe: 1 }));
  for (const R of [0.11, 0.075]) partes.push(tira(anel(0, 0, R, R, 20), 0.012, '#6aa8e0', 1.305, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(elipse(0, 0, 0.08, 0.08, '#2a5a98', 1.31, { ...O, alfa: 0.8, detalhe: 3 }), lente(-0.1, -0.06, -0.6, 0.12, 0.035, '#e8f4ff', 1.312, { ...S, alfa: 0.7, detalhe: 3 }));
  cilindro(partes, -0.2, -0.1, -0.2, 0.06, 0.07, 0.07, tonsDe('#dcdcd6'), 0.9);
  if (r() < 0.5) partes.push(elipse(0.12, 0.26, 0.05, 0.05, '#f0f0ec', 0.03, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Um produto de prateleira visto de cima, num retângulo de `w` × `h`: caixas com o rótulo, latas ou garrafas com a tampa. */
function produtos(partes: Parte[], r: () => number, x0: number, y0: number, w: number, h: number, z: number): void {
  const tipo = Math.floor(r() * 3), cor = PRODUTOS[Math.floor(r() * PRODUTOS.length)]!, t = tonsDe(cor);
  if (tipo === 0) { // caixas em fila
    const bw = 0.1 + r() * 0.08, bh = h * 0.9;
    for (let x = x0 + bw / 2; x < x0 + w - bw / 2 + 0.001; x += bw + 0.01) { partes.push(poli(retQ(ID, x, y0 + h / 2, bw, bh), t.base, z, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, x - bw * 0.1, y0 + h / 2, bw * 0.6, bh * 0.3), r() < 0.5 ? '#f0ece0' : t.luz, z + 0.002, { ...O, detalhe: 3 })); }
    return;
  }
  const R = tipo === 1 ? 0.035 : 0.03, passo = R * 2 + 0.01;
  for (let x = x0 + R; x < x0 + w - R + 0.001; x += passo) for (let y = y0 + R; y < y0 + h - R + 0.001; y += passo) {
    if (tipo === 1) partes.push(elipse(x, y, R * 2, R * 2, ACO.base, z, { contorno: 'leve', detalhe: 2 }), elipse(x, y, R * 1.3, R * 1.3, cor, z + 0.001, { ...O, detalhe: 3 }), elipse(x - R * 0.3, y - R * 0.3, R * 0.5, R * 0.5, ACO.brilho, z + 0.002, { ...O, alfa: 0.7, detalhe: 3 }));
    else partes.push(elipse(x, y, R * 2, R * 2, tom(cor, -0.3), z, { contorno: 'leve', vidro: true, detalhe: 2 }), elipse(x, y, R * 0.9, R * 0.9, cor, z + 0.001, { ...O, detalhe: 3 }), elipse(x - R * 0.35, y - R * 0.35, R * 0.5, R * 0.4, '#ffffff', z + 0.002, { ...S, alfa: 0.5, detalhe: 3 }));
  }
}

/** Gôndola de mercado de dupla face: o painel do meio, as prateleiras de cima dos dois lados cheias de produtos e as etiquetas de preço na borda. */
function gondola(seed: number, C: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], D = 0.9;
  sombraNoChao(partes, retQ(ID, 0, 0, C + 0.05, D + 0.05), 0.01, '#0a0a0c', 0.4);
  bloco(partes, ID, C, D, CINZA_CLARO, 1.35, 0.02);
  partes.push(poli(retQ(ID, 0, 0, C - 0.02, 0.06), CINZA_CLARO.sombra, 1.36, { ...O, detalhe: 2 }), tira([-C / 2 + 0.02, -0.02, C / 2 - 0.02, -0.02], 0.012, CINZA_CLARO.brilho, 1.362, { ...O, alfa: 0.8, detalhe: 3 }));
  const nb = Math.max(1, Math.round(C)), bw = C / nb;
  for (let b = 0; b < nb; b++) for (const s of [-1, 1]) {
    const x0 = -C / 2 + b * bw + 0.03, y0 = s < 0 ? -D / 2 + 0.04 : 0.05;
    partes.push(poli(retQ(ID, x0 + (bw - 0.06) / 2, y0 + 0.18, bw - 0.06, 0.36), '#9a9c9c', 1.37, { ...O, detalhe: 2 }));
    produtos(partes, r, x0, y0 + 0.01, (bw - 0.06) / 2 - 0.01, 0.34, 1.4);
    produtos(partes, r, x0 + (bw - 0.06) / 2 + 0.01, y0 + 0.01, (bw - 0.06) / 2 - 0.01, 0.34, 1.4);
    const ye = s < 0 ? -D / 2 + 0.02 : D / 2 - 0.02;
    partes.push(tira([x0, ye, x0 + bw - 0.06, ye], 0.03, '#e8e4d8', 1.45, { ...O, detalhe: 3 }));
    for (let k = 0; k < 3; k++) partes.push(poli(retQ(ID, x0 + 0.12 + k * (bw - 0.2) / 2.2, ye, 0.07, 0.025), '#e8c020', 1.452, { ...O, detalhe: 3 }));
  }
  for (const s of [-1, 1]) partes.push(poli(retQ(ID, s * (C / 2 - 0.02), 0, 0.04, D), CINZA_CLARO.base, 1.46, { contorno: 'leve', detalhe: 2 }));
  return partes;
}

/** Caixa de mercado: o balcão com a esteira e as compras, o leitor de vidro, a área de ensacar com as sacolas; do lado do operador (−y), o terminal com a tela acesa, a gaveta, a maquininha, o banco e o poste com o número aceso. */
function caixaRegistradora(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], yB = 0.2;
  sombraNoChao(partes, retQ(ID, 0, 0.05, 2.25, 1.0), 0.01, '#0a0a0c', 0.35);
  // O banco do operador.
  disco(partes, 0.35, -0.35, 0.16, GRAFITE, 0.6);
  partes.push(elipse(0.35, -0.35, 0.24, 0.24, '#3a3d44', 0.62, { ...S, detalhe: 2 }), elipse(0.33, -0.37, 0.12, 0.1, '#5a5e66', 0.622, { ...S, alfa: 0.7, detalhe: 3 }));
  bloco(partes, quadro(0, yB), 2.2, 0.62, tonsDe('#d0ccc0'), 0.9, 0.03);
  // A esteira de borracha com as nervuras e as compras.
  partes.push(poli(retQ(ID, -0.5, yB, 1.1, 0.44), '#101012', 0.92, { contorno: 'leve', detalhe: 1 }));
  for (let u = -1.02; u < 0.03; u += 0.06) partes.push(tira([u, yB - 0.2, u, yB + 0.2], 0.012, '#26282c', 0.922, { ...O, detalhe: 3 }));
  for (let k = 0; k < 5; k++) { const x = -0.95 + k * 0.2 + r() * 0.05, y = yB + (r() - 0.5) * 0.2, c = tonsDe(PRODUTOS[Math.floor(r() * PRODUTOS.length)]!); if (r() < 0.5) bloco(partes, quadro(x, y, (r() - 0.5) * 0.6), 0.12 + r() * 0.06, 0.08 + r() * 0.05, c, 0.95, 0.01); else disco(partes, x, y, 0.035 + r() * 0.02, c, 0.95); }
  partes.push(poli(retQ(ID, -0.62, yB, 0.03, 0.4), '#2a6ab0', 0.96, { contorno: 'leve', detalhe: 3 }));
  // O leitor e a balança, as sacolas.
  partes.push(poli(retQ(ID, 0.25, yB, 0.32, 0.36), '#1a1c20', 0.93, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0.25, yB, 0.24, 0.26), '#5a2020', 0.932, { ...O, vidro: true, alfa: 0.8, detalhe: 2 }), tira([0.15, yB, 0.35, yB], 0.01, '#ff4030', 0.934, { ...O, brilho: true, detalhe: 3 }));
  for (let k = 0; k < 2; k++) partes.push(poli(bolha(0.72 + k * 0.2, yB + (r() - 0.5) * 0.1, 0.12, 0.16, 9, 0.18, r), '#ecece6', 1.0 + k * 0.01, { contorno: 'leve', detalhe: 2 }), elipse(0.72 + k * 0.2, yB, 0.08, 0.04, '#bcbcb4', 1.005 + k * 0.01, { ...O, detalhe: 3 }));
  // O terminal com a tela para o operador, a gaveta e a maquininha.
  partes.push(poli(retR(ID, 0.5, yB - 0.25, 0.36, 0.05, 0.01), '#101014', 1.25, { contorno: 'leve', detalhe: 1 }), poli(retQ(ID, 0.5, yB - 0.29, 0.32, 0.04), '#3a8ad0', 1.252, { ...O, brilho: true, alfa: 0.8, detalhe: 2 }));
  partes.push(poli(retQ(ID, 0.5, yB - 0.14, 0.4, 0.12), '#2a2c30', 0.95, { contorno: 'leve', detalhe: 2 }), poli(retR(quadro(0.0, yB - 0.18, 0.3), 0, 0, 0.08, 0.14, 0.015), '#1c1e22', 0.97, { contorno: 'leve', detalhe: 3 }));
  // O poste do número do caixa, aceso.
  disco(partes, -1.0, yB - 0.22, 0.04, ACO, 1.2);
  partes.push(poli(retQ(ID, -1.0, yB - 0.22, 0.24, 0.1), '#141416', 1.4, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, -1.0, yB - 0.22, 0.2, 0.06), '#d83a2a', 1.402, { ...O, brilho: true, alfa: 0.9, detalhe: 2 }));
  return partes;
}

/** Freezer horizontal: o corpo branco, as duas tampas de vidro de correr com os potes e picolés por baixo, a geada e a faixa de cor na frente. */
function freezer(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], C = 1.8, D = 0.82, faixa = PRODUTOS[Math.floor(r() * 4)]!;
  sombraNoChao(partes, retQ(ID, 0, 0, C + 0.05, D + 0.05), 0.01, '#0a0a0c', 0.4);
  bloco(partes, ID, C, D, tonsDe('#e0e0da'), 0.88, 0.05);
  partes.push(poli(retQ(ID, 0, D / 2 - 0.03, C - 0.06, 0.04), faixa, 0.925, { ...O, detalhe: 2 }));
  partes.push(poli(retQ(ID, 0, -0.02, C - 0.14, D - 0.2), '#a8b8c0', 0.9, { ...O, detalhe: 1 }));
  for (let k = 0; k < 22; k++) {
    const x = -C / 2 + 0.15 + r() * (C - 0.3), y = -D / 2 + 0.16 + r() * (D - 0.36), c = PRODUTOS[Math.floor(r() * PRODUTOS.length)]!;
    if (r() < 0.5) disco(partes, x, y, 0.07, tonsDe(c), 0.905 + k * 0.0005);
    else partes.push(poli(retQ(quadro(x, y, (r() - 0.5) * 0.4), 0, 0, 0.2, 0.08), c, 0.905 + k * 0.0005, { contorno: 'leve', detalhe: 2 }));
  }
  for (let k = 0; k < 5; k++) partes.push(poli(bolha(-C / 2 + 0.2 + r() * (C - 0.4), -D / 2 + 0.15 + r() * 0.1, 0.12, 0.05, 8, 0.3, r), '#f4faff', 0.92, { ...S, alfa: 0.6, detalhe: 3 }));
  // As tampas de vidro, uma meio aberta sobre a outra, com o puxador e o reflexo.
  const ab = 0.1 + r() * 0.3;
  for (const [u, z] of [[-C / 4 + 0.02, 0.93], [C / 4 - 0.02 - ab, 0.94]] as const) {
    partes.push(poli(retQ(ID, u, -0.02, C / 2 - 0.06, D - 0.18), '#c8e0ec', z, { ...O, vidro: true, alfa: 0.35, detalhe: 1 }));
    partes.push(tira([u - C / 4 + 0.05, -D / 2 + 0.1, u - C / 4 + 0.05, D / 2 - 0.14], 0.03, ACO.luz, z + 0.002, { contorno: 'leve', detalhe: 2 }));
    partes.push(lente(u - C / 4 + 0.15, -D / 2 + 0.2, 0.35, 0.5, 0.05, '#ffffff', z + 0.003, { ...S, alfa: 0.35, detalhe: 3 }));
  }
  return partes;
}

/** Mesa de lanchonete: a mesa de fórmica com a borda cromada encostada na parede (−y), os dois bancos estofados de vinil com o encosto alto, o porta-guardanapos, os molhos, o cardápio e, às vezes, um prato. */
function mesaDeLanchonete(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], vinil = ['#a8221c', '#2a7a7a', '#c86a1a'][Math.floor(r() * 3)]!, tampo = tonsDe(['#d8c8a0', '#c8d8d8', '#e0d0c8'][Math.floor(r() * 3)]!);
  sombraNoChao(partes, retQ(ID, 0, 0, 1.75, 1.4), 0.01, '#0a0a0c', 0.3);
  for (const s of [-1, 1]) {
    const f = quadro(s * 0.62, 0, 0);
    bloco(partes, f, 0.52, 1.36, tonsDe('#3a3a3e'), 0.4, 0.02);
    estofado(partes, f, 0, -s * 0.04, 0.02, 0.4, 1.28, vinil, 0.45, 0.08);
    for (let v = -0.42; v <= 0.42; v += 0.42) partes.push(tira([s * 0.62 - s * 0.04 - 0.16, v, s * 0.62 - s * 0.04 + 0.16, v], 0.012, tom(vinil, -0.5), 0.462, { ...O, alfa: 0.6, detalhe: 3 }));
    estofado(partes, quadro(s * 0.78, 0), 0, 0, 0.02, 0.16, 1.32, tom(vinil, -0.1), 1.05, 0.06);
    partes.push(tira([s * 0.86, -0.66, s * 0.86, 0.68], 0.02, ACO.luz, 1.07, { ...O, detalhe: 3 }));
  }
  bloco(partes, quadro(0, -0.08), 0.74, 1.12, tampo, 0.75, 0.025);
  partes.push(tira([...retR(quadro(0, -0.08), 0, 0, 0.72, 1.1, 0.04), ...retR(quadro(0, -0.08), 0, 0, 0.72, 1.1, 0.04).slice(0, 2)], 0.02, ACO.luz, 0.76, { ...O, detalhe: 2 }));
  // O porta-guardanapos, os molhos, o sal e a pimenta, o cardápio.
  bloco(partes, quadro(0, -0.55), 0.14, 0.08, ACO, 0.85, 0.01);
  partes.push(poli(retQ(ID, 0, -0.55, 0.1, 0.03), PAPEL, 0.87, { ...O, detalhe: 3 }));
  disco(partes, -0.13, -0.56, 0.035, VERMELHO, 0.9); disco(partes, 0.13, -0.56, 0.035, AMARELO, 0.9);
  for (const s of [-1, 1]) disco(partes, s * 0.22, -0.5, 0.02, s < 0 ? tonsDe('#e8e8e2') : GRAFITE, 0.88);
  bloco(partes, quadro(-0.2, -0.38, 0.2), 0.14, 0.04, tonsDe('#a8221c'), 0.85, 0.008);
  if (r() < 0.7) for (const s of [-1, 1]) if (r() < 0.7) {
    const x = s * 0.18, y = 0.05 + r() * 0.2;
    partes.push(elipse(x, y, 0.26, 0.26, '#a0a098', 0.77, { contorno: 'leve', detalhe: 2 }), elipse(x, y, 0.24, 0.24, '#f0eee6', 0.772, { ...O, detalhe: 2 }));
    disco(partes, x - 0.03, y, 0.055, tonsDe('#b8742a'), 0.78);
    for (let k = 0; k < 7; k++) partes.push(tira([x + 0.03 + r() * 0.04, y - 0.06 + r() * 0.1, x + 0.06 + r() * 0.05, y - 0.04 + r() * 0.1], 0.016, '#e8b84a', 0.79, { contorno: 'leve', detalhe: 3 }));
  }
  return partes;
}

/** Fila de armários de vestiário: o tampo de chapa com as frestas, e a frente (+y) vista um pouco de frente, com as portas, as venezianas, os puxadores e as plaquinhas; às vezes uma porta aberta. */
function armarioDeVestiario(seed: number, n: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], w = 0.4, C = n * w, D = 0.5, t = tonsDe(['#5a6a7a', '#7a7e82', '#3a5a4a', '#8a3a2a'][Math.floor(r() * 4)]!);
  sombraNoChao(partes, retQ(ID, 0, 0, C + 0.05, D + 0.05), 0.01, '#0a0a0c', 0.4);
  bloco(partes, quadro(0, -0.06), C, D - 0.12, t, 1.45, 0.02);
  for (let k = 0; k < n; k++) {
    const u = -C / 2 + w * (k + 0.5);
    partes.push(poli(retQ(ID, u, -0.06, w - 0.03, D - 0.17), k % 2 ? t.meio : t.luz, 1.47, { ...O, alfa: 0.7, detalhe: 2 }));
    for (let j = 0; j < 4; j++) partes.push(tira([u - 0.1, 0.02 + j * 0.022, u + 0.1, 0.02 + j * 0.022], 0.008, t.nanquim, 1.472, { ...O, alfa: 0.55, detalhe: 3 }));
    if (k > 0) partes.push(tira([u - w / 2, -D / 2 + 0.02, u - w / 2, D / 2 - 0.13], 0.016, t.nanquim, 1.474, { ...O, alfa: 0.8, detalhe: 3 }));
  }
  // A frente: a faixa das portas, um pouco de frente.
  const aberta = r() < 0.5 ? Math.floor(r() * n) : -1, yF = D / 2 - 0.08;
  partes.push(poli(retQ(ID, 0, yF, C, 0.16), t.nanquim, 1.3, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < n; k++) {
    const u = -C / 2 + w * (k + 0.5);
    if (k === aberta) {
      partes.push(poli(retQ(ID, u, yF, w - 0.04, 0.14), '#0e0f12', 1.302, { ...O, detalhe: 2 }));
      partes.push(tira([u - w / 2 + 0.02, yF + 0.05, u - w / 2 + 0.12, yF + 0.05 + 0.34], 0.025, t.luz, 1.31, { contorno: 'leve', detalhe: 2 }));
      continue;
    }
    partes.push(poli(retQ(ID, u, yF, w - 0.04, 0.14), k % 2 ? t.meio : t.base, 1.302, { ...O, detalhe: 2 }));
    for (let j = 0; j < 3; j++) partes.push(tira([u - 0.1, yF - 0.035 + j * 0.012, u + 0.1, yF - 0.035 + j * 0.012], 0.005, t.nanquim, 1.304, { ...O, alfa: 0.7, detalhe: 3 }));
    partes.push(poli(retQ(ID, u + 0.13, yF + 0.01, 0.025, 0.04), ACO.luz, 1.305, { ...O, detalhe: 3 }), poli(retQ(ID, u - 0.08, yF + 0.03, 0.06, 0.018), '#e8e4d8', 1.305, { ...O, detalhe: 3 }));
  }
  partes.push(lente(-C / 2 + 0.1, -D / 2 + 0.08, 0, C * 0.6, 0.04, t.brilho, 1.48, { ...S, alfa: 0.5, detalhe: 3 }));
  return partes;
}

/** Máquina de venda: o gabinete na cor da bandeira com a frente (+y) vista um pouco de frente: o vidro aceso com as fileiras de produtos e o painel de moedas; o clarão no chão. `neon` reserva a variante da Q23. */
function maquinaDeVenda(seed: number, acesa: boolean, neon = false): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], t = tonsDe(neon ? '#1a1a2a' : ['#a8221c', '#1e4a8a', '#1e1e22', '#2a6a3a'][Math.floor(r() * 4)]!), yF = 0.27;
  sombraNoChao(partes, retQ(ID, 0, -0.1, 1.0, 0.8), 0.01, '#0a0a0c', 0.4);
  if (acesa) halo(partes, -0.08, 0.42, 0.2, neon ? '#3a0a4a' : '#2a3a4a', 0.5);
  bloco(partes, quadro(0, -0.12), 0.96, 0.74, t, 1.45, 0.04);
  partes.push(poli(retQ(ID, 0, -0.3, 0.8, 0.12), t.luz, 1.46, { ...O, detalhe: 3 }));
  // A frente: o vidro com as fileiras e o painel de moedas.
  partes.push(poli(retQ(ID, 0, yF, 0.96, 0.18), t.nanquim, 1.3, { contorno: 'leve', detalhe: 1 }));
  partes.push(poli(retQ(ID, -0.1, yF, 0.66, 0.15), acesa ? (neon ? '#3a2a5a' : '#3a4a5a') : '#14181c', 1.302, { ...O, brilho: acesa, detalhe: 1 }));
  for (let i = 0; i < 4; i++) for (let j = 0; j < 7; j++) partes.push(poli(retQ(ID, -0.38 + j * 0.09, yF - 0.055 + i * 0.035, 0.06, 0.022), PRODUTOS[Math.floor(r() * PRODUTOS.length)]!, 1.304, { ...O, alfa: acesa ? 1 : 0.6, detalhe: 3 }));
  partes.push(poli(retQ(ID, 0.36, yF, 0.18, 0.15), t.sombra, 1.302, { ...O, detalhe: 2 }), poli(retQ(ID, 0.36, yF - 0.04, 0.12, 0.04), acesa ? '#3aa860' : '#0a1a10', 1.304, { ...O, brilho: acesa, detalhe: 3 }));
  for (let k = 0; k < 6; k++) partes.push(elipse(0.33 + (k % 3) * 0.03, yF + 0.01 + Math.floor(k / 3) * 0.025, 0.018, 0.018, ACO.luz, 1.305, { ...O, detalhe: 3 }));
  partes.push(poli(retQ(ID, 0.36, yF + 0.06, 0.1, 0.02), '#050505', 1.305, { ...O, detalhe: 3 }));
  if (acesa) partes.push(lente(-0.4, yF - 0.05, 0, 0.5, 0.02, '#ffffff', 1.306, { ...S, alfa: 0.3, brilho: true, detalhe: 3 }));
  return partes;
}

/** Cama hospitalar: a cabeceira (−y) e os pés de plástico, o colchão com a cabeceira erguida, o travesseiro, o lençol e o cobertor azul, as grades, os rodízios e o suporte de soro com a bolsa e o equipo. */
function camaHospitalar(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 0.95, L = 2.1, cobre = ['#6a9ac8', '#7ab0a8', '#c8c8d8'][Math.floor(r() * 3)]!;
  sombraNoChao(partes, retQ(ID, 0, 0, W + 0.1, L + 0.1), 0.01, '#0a0a0c', 0.35);
  for (const su of [-1, 1]) for (const sv of [-1, 1]) partes.push(elipse(su * (W / 2 - 0.06), sv * (L / 2 - 0.08), 0.08, 0.08, '#141416', 0.08, { contorno: 'leve', detalhe: 3 }));
  bloco(partes, ID, W, L, CINZA_CLARO, 0.5, 0.03);
  // O colchão: a parte da cabeça erguida (mais clara, pega a luz) com a dobra.
  estofado(partes, ID, 0, 0, 0.05, W - 0.1, L - 0.25, '#e8ecec', 0.62, 0.06);
  partes.push(poli(retQ(ID, 0, -0.62, W - 0.12, 0.6), '#f6f8f8', 0.7, { contorno: 'leve', detalhe: 1 }), tira([-W / 2 + 0.06, -0.32, W / 2 - 0.06, -0.32], 0.02, '#a8b0b4', 0.702, { ...O, detalhe: 3 }));
  estofado(partes, quadro(0, -0.72, (r() - 0.5) * 0.15), 0, 0, 0, 0.6, 0.32, '#ffffff', 0.74, 0.1);
  // O cobertor dobrado, com as rugas.
  const y0 = -0.05 + r() * 0.15;
  partes.push(poli(retR(ID, 0, (y0 + L / 2 - 0.15) / 2, W - 0.08, L / 2 - 0.15 - y0, 0.05), tom(cobre, -0.5), 0.71, { contorno: 'leve', detalhe: 1 }), poli(retR(ID, 0, (y0 + L / 2 - 0.15) / 2, W - 0.12, L / 2 - 0.17 - y0, 0.05), cobre, 0.712, { ...O, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, y0 + 0.07, W - 0.1, 0.14), '#f0f2f2', 0.714, { contorno: 'leve', detalhe: 2 }));
  for (let k = 0; k < 4; k++) { const y = y0 + 0.3 + r() * 0.6; partes.push(tira([-W / 2 + 0.1 + r() * 0.2, y, W / 2 - 0.1 - r() * 0.2, y + (r() - 0.5) * 0.1], 0.025, tom(cobre, -0.25), 0.716, { ...S, alfa: 0.6, detalhe: 3 }, 0.3)); }
  partes.push(lente(-W / 2 + 0.08, y0 + 0.25, Math.PI / 2, 0.6, 0.06, tom(cobre, 0.3), 0.716, { ...S, alfa: 0.6, detalhe: 3 }));
  // A cabeceira, os pés e as grades.
  bloco(partes, quadro(0, -L / 2 + 0.03), W, 0.08, tonsDe('#c8bca0'), 0.95, 0.015);
  bloco(partes, quadro(0, L / 2 - 0.03), W, 0.08, tonsDe('#c8bca0'), 0.8, 0.015);
  for (const s of [-1, 1]) partes.push(tira([s * (W / 2 + 0.01), -0.85, s * (W / 2 + 0.01), 0.1], 0.035, ACO.luz, 0.85, { contorno: 'leve', detalhe: 2 }));
  // O suporte de soro: o pé de cinco patas, a haste e a bolsa, com o equipo até a cama.
  const sx = -W / 2 - 0.22, sy = -0.8;
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3; partes.push(tira([sx, sy, sx + Math.cos(a) * 0.2, sy + Math.sin(a) * 0.2], 0.025, ACO.base, 0.08, { contorno: 'leve', detalhe: 3 })); }
  disco(partes, sx, sy, 0.025, ACO, 1.2);
  partes.push(tira([sx - 0.1, sy, sx + 0.1, sy], 0.02, ACO.luz, 1.3, { contorno: 'leve', detalhe: 3 }), poli(retR(ID, sx + 0.07, sy + 0.02, 0.1, 0.16, 0.04), '#dce8ec', 1.25, { contorno: 'leve', vidro: true, alfa: 0.8, detalhe: 2 }));
  partes.push(tira([sx + 0.07, sy + 0.1, sx + 0.12, sy + 0.4, -W / 2 + 0.12, -0.2, -W / 2 + 0.2, -0.05], 0.008, '#c8d8e0', 0.8, { ...O, alfa: 0.8, detalhe: 3 }));
  return partes;
}

// ---------- Receitas ----------

const RUA = { categoria: 'exterior' as const, tipo: 'piso' as const, generos: ['moderno', 'pos-apocaliptico', 'cyberpunk'], kit: 'moderno' };
const COR = { id: 'cor', rotulo: 'Cor (−1 sorteada; 0 vermelho, 1 azul, 2 prata, 3 branco, 4 preto, 5 verde, 6 amarelo, 7 grafite)', tipo: 'numero' as const, padrao: -1, min: -1, max: 7, passo: 1 };
const FAROIS = { id: 'farois', rotulo: 'Faróis (0 apagados, 1 acesos)', tipo: 'numero' as const, padrao: 0, min: 0, max: 1, passo: 1 };
export const ligado = (params: Record<string, unknown>, id: string, padrao = 0): boolean => Math.round(num({ seed: 0, params }, id, padrao, 0, 1)) === 1;
const luzDosFarois = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'farois') ? { raio: 3.5, cor: '#fff0d0', intensidade: 0.6, power: 'battery', flicker: 0 } : null);
const luzDoGiroflex = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'giroflex', 1) ? { raio: 5, cor: '#5a6aff', intensidade: 0.9, power: 'battery', flicker: 0.6 } : luzDosFarois(params));
const luzDoSemaforo = (params: Record<string, unknown>): LuzDeReceita => ({ raio: 2.2, cor: ['#3aff7a', '#ffc02a', '#ff3a2a'][Math.round(num({ seed: 0, params }, 'sinal', 0, 0, 2))]!, intensidade: 0.45, power: 'grid', flicker: 0 });
const luzDoPainel = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'aceso', 1) ? { raio: 2.5, cor: '#f0e6c8', intensidade: 0.5, power: 'grid', flicker: 0 } : null);
const luzDaMaquina = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'acesa', 1) ? { raio: 2.2, cor: '#d8e8ff', intensidade: 0.45, power: 'grid', flicker: 0 } : null);
const INT = { tipo: 'piso' as const, generos: ['moderno', 'pos-apocaliptico', 'cyberpunk'], kit: 'moderno' };
const luzDaBomba = (params: Record<string, unknown>): LuzDeReceita | null => (ligado(params, 'acesa', 1) ? { raio: 1.8, cor: '#7affa8', intensidade: 0.35, power: 'grid', flicker: 0 } : null);

const pegadaDe = (m: Modelo): [number, number] => [m.L + 0.1, m.W + 0.2];
const tagsDeCarro = ['carro', 'automovel', 'veiculo', 'rua', 'estacionamento', 'moderno'];
const receitaDeCarro = (id: string, nome: string, modelo: Modelo, tags: string[], extra: Partial<Receita> & { acessorios?: (p: Record<string, unknown>) => Partial<Acessorios>; corFixa?: string }): Receita => ({
  id, nome, ...RUA, funcoes: ['rua', 'estacionamento', 'garagem', 'posto'], tags: [...tagsDeCarro, ...tags], pegada: pegadaDe(modelo), altura: modelo === MODELOS.van ? 2.1 : modelo === MODELOS.picape ? 1.8 : 1.45,
  campos: extra.campos ?? [COR, FAROIS], luz: extra.luz ?? luzDosFarois,
  gerar: p => piso(pegadaDe(modelo), carro(p.seed, modelo, extra.corFixa ?? corDoCampo(mulberry32(p.seed ^ 0x5eed), Math.round(num(p, 'cor', -1, -1, 7))), { farois: ligado(p.params, 'farois'), ...extra.acessorios?.(p.params) })),
});

export const RECEITAS_DO_MODERNO_URBANO: Receita[] = [
  receitaDeCarro('carro.sedan', 'Carro sedã', MODELOS.sedan, ['seda', 'sedan'], {}),
  receitaDeCarro('carro.hatch', 'Carro hatch', MODELOS.hatch, ['hatch', 'compacto'], {}),
  receitaDeCarro('carro.picape', 'Picape', MODELOS.picape, ['picape', 'caminhonete', 'cacamba'], {}),
  receitaDeCarro('carro.van', 'Van', MODELOS.van, ['van', 'furgao', 'utilitario'], {}),
  receitaDeCarro('carro.viatura', 'Viatura de polícia', MODELOS.sedan, ['viatura', 'policia', 'giroflex', 'sirene'], {
    corFixa: '#d8dcdc', campos: [{ id: 'giroflex', rotulo: 'Giroflex (0 desligado, 1 ligado)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }, FAROIS],
    luz: luzDoGiroflex, acessorios: p => ({ viatura: true, giroflex: ligado(p, 'giroflex', 1) }),
  }),
  receitaDeCarro('carro.taxi', 'Táxi', MODELOS.sedan, ['taxi', 'luminoso'], { corFixa: '#d0a01a', campos: [FAROIS], acessorios: () => ({ taxi: true }) }),
  { id: 'moto', nome: 'Moto', ...RUA, funcoes: ['rua', 'estacionamento', 'garagem', 'posto'], tags: ['moto', 'motocicleta', 'veiculo', 'duas rodas', 'rua', 'moderno'], pegada: [2.15, 0.85], altura: 1.2,
    campos: [FAROIS], luz: luzDosFarois, gerar: p => piso([2.15, 0.85], moto(p.seed, ligado(p.params, 'farois'))) },
  { id: 'bicicleta', nome: 'Bicicleta', ...RUA, funcoes: ['rua', 'garagem', 'praca', 'jardim'], tags: ['bicicleta', 'bike', 'pedal', 'duas rodas', 'rua', 'moderno'], pegada: [1.8, 0.62], altura: 1.1,
    gerar: p => piso([1.8, 0.62], bicicleta(p.seed)) },
  { id: 'onibus', nome: 'Ônibus', ...RUA, funcoes: ['rua', 'garagem', 'estacao'], tags: ['onibus', 'coletivo', 'transporte', 'veiculo', 'rua', 'moderno'], pegada: [12.4, 3.0], altura: 3.2,
    campos: [{ id: 'cor', rotulo: 'Pintura (−1 sorteada, 0 a 3)', tipo: 'numero', padrao: -1, min: -1, max: 3, passo: 1 }],
    gerar: p => piso([12.4, 3.0], onibus(p.seed, Math.round(num(p, 'cor', -1, -1, 3)))) },
  { id: 'semaforo', nome: 'Semáforo', ...RUA, funcoes: ['rua'], tags: ['semaforo', 'sinal', 'farol', 'transito', 'cruzamento', 'rua', 'moderno', 'luz'], pegada: [3.5, 0.9], altura: 5.5,
    campos: [{ id: 'sinal', rotulo: 'Sinal (0 verde, 1 amarelo, 2 vermelho)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    luz: luzDoSemaforo, gerar: p => piso([3.5, 0.9], semaforo(p.seed, Math.round(num(p, 'sinal', 0, 0, 2)))) },
  { id: 'hidrante', nome: 'Hidrante', ...RUA, funcoes: ['rua', 'posto', 'patio'], tags: ['hidrante', 'bombeiro', 'agua', 'calcada', 'rua', 'moderno'], pegada: [0.55, 0.55], altura: 0.8,
    gerar: p => piso([0.55, 0.55], hidrante(p.seed)) },
  { id: 'lixeira', nome: 'Lixeira de rua', ...RUA, funcoes: ['rua', 'praca', 'posto', 'estacionamento', 'patio'], tags: ['lixeira', 'lixo', 'papeleira', 'conteiner', 'calcada', 'rua', 'moderno'], pegada: [1.35, 0.85], altura: 1.2,
    campos: [{ id: 'conteiner', rotulo: 'Modelo (0 papeleira, 1 contêiner)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const c = ligado(p.params, 'conteiner'); return piso(c ? [1.35, 0.85] : [0.5, 0.5], lixeira(p.seed, c)); } },
  { id: 'cacamba', nome: 'Caçamba de entulho', ...RUA, funcoes: ['rua', 'patio', 'obra'], tags: ['cacamba', 'entulho', 'obra', 'lixo', 'reforma', 'rua', 'moderno'], pegada: [3.7, 1.9], altura: 1.3,
    gerar: p => piso([3.7, 1.9], cacamba(p.seed)) },
  { id: 'ponto-de-onibus', nome: 'Ponto de ônibus', ...RUA, funcoes: ['rua', 'praca'], tags: ['ponto', 'onibus', 'abrigo', 'parada', 'banco', 'anuncio', 'rua', 'moderno', 'luz'], pegada: [3.5, 1.5], altura: 2.5,
    campos: [{ id: 'aceso', rotulo: 'Anúncio (0 apagado, 1 aceso)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDoPainel, gerar: p => piso([3.5, 1.5], pontoDeOnibus(p.seed, ligado(p.params, 'aceso', 1))) },
  { id: 'orelhao', nome: 'Orelhão', ...RUA, funcoes: ['rua', 'praca', 'posto'], tags: ['orelhao', 'telefone', 'publico', 'cabine', 'calcada', 'rua', 'moderno'], pegada: [1.05, 1.05], altura: 2.3,
    gerar: p => piso([1.05, 1.05], orelhao(p.seed)) },
  { id: 'cone', nome: 'Cone de trânsito', ...RUA, funcoes: ['rua', 'estacionamento', 'obra', 'posto'], tags: ['cone', 'transito', 'obra', 'sinalizacao', 'laranja', 'rua', 'moderno'], pegada: [0.4, 0.4], altura: 0.7,
    gerar: p => piso([0.4, 0.4], cone(p.seed)) },
  { id: 'barreira', nome: 'Barreira de rua', ...RUA, funcoes: ['rua', 'obra', 'estacionamento', 'posto-de-guarda'], tags: ['barreira', 'mureta', 'new jersey', 'bloqueio', 'obra', 'concreto', 'rua', 'moderno'], pegada: [4, 0.66], altura: 0.85,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 4, min: 1.2, max: 16, passo: 0.4 }, { id: 'plastica', rotulo: 'Modelo (0 concreto, 1 plástico)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const C = num(p, 'comprimento', 4, 1.2, 16); return piso([C, 0.66], barreira(p.seed, C, ligado(p.params, 'plastica'))); } },
  { id: 'bomba-de-gasolina', nome: 'Bomba de gasolina', ...RUA, funcoes: ['posto', 'garagem'], tags: ['bomba', 'gasolina', 'combustivel', 'posto', 'ilha', 'mangueira', 'moderno', 'luz'], pegada: [3.1, 1.25], altura: 1.9,
    campos: [{ id: 'acesa', rotulo: 'Visores acesos (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDaBomba, gerar: p => piso([3.1, 1.25], bombaDeGasolina(p.seed, ligado(p.params, 'acesa', 1))) },
  // Q21d: a cobertura das bombas e o poste de rua.
  { id: 'cobertura-de-posto', nome: 'Cobertura de posto', ...RUA, funcoes: ['posto'], tags: ['cobertura', 'posto', 'gasolina', 'marquise', 'testeira', 'bombas', 'moderno', 'luz'], pegada: [14, 8], altura: 5.2,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 14, min: 8, max: 24, passo: 1 }, { id: 'profundidade', rotulo: 'Profundidade (m)', tipo: 'numero', padrao: 8, min: 5, max: 12, passo: 1 }, { id: 'acesa', rotulo: 'Acesa (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDaCobertura, gerar: p => { const C = num(p, 'comprimento', 14, 8, 24), D = num(p, 'profundidade', 8, 5, 12); return piso([C, D], coberturaDePosto(p.seed, C, D, ligado(p.params, 'acesa', 1))); } },
  { id: 'poste-de-rua', nome: 'Poste de rua', ...RUA, funcoes: ['rua', 'estacionamento', 'posto', 'praca'], tags: ['poste', 'luz', 'iluminacao', 'luminaria', 'rua', 'sodio', 'led', 'moderno'], pegada: [2.6, 0.8], altura: 7,
    campos: [{ id: 'sodio', rotulo: 'Lâmpada (0 LED branca, 1 sódio amarela)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }, { id: 'acesa', rotulo: 'Acesa (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDoPoste, gerar: p => piso([2.6, 0.8], posteDeRua(ligado(p.params, 'sodio', 1), ligado(p.params, 'acesa', 1))) },
  // Escritório, mercado e lanchonete (Q21b)
  { id: 'estacao-de-trabalho', nome: 'Estação de trabalho', ...INT, categoria: 'mesas', funcoes: ['escritorio', 'recepcao', 'sala-de-servidores', 'delegacia'], tags: ['mesa', 'escritorio', 'computador', 'monitor', 'teclado', 'cadeira', 'baia', 'trabalho', 'moderno'], pegada: [1.65, 1.5], altura: 1.2,
    campos: [{ id: 'monitores', rotulo: 'Monitores (1 ou 2)', tipo: 'numero', padrao: 1, min: 1, max: 2, passo: 1 }],
    gerar: p => piso([1.65, 1.5], estacaoDeTrabalho(p.seed, Math.round(num(p, 'monitores', 1, 1, 2)))) },
  { id: 'divisoria', nome: 'Divisória de baia', ...INT, categoria: 'decoracao', funcoes: ['escritorio', 'recepcao'], tags: ['divisoria', 'baia', 'painel', 'escritorio', 'moderno'], pegada: [2.4, 0.45], altura: 1.4,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 2.4, min: 0.8, max: 8, passo: 0.4 }],
    gerar: p => { const C = num(p, 'comprimento', 2.4, 0.8, 8); return piso([C, 0.45], divisoria(p.seed, C)); } },
  { id: 'copiadora', nome: 'Copiadora', ...INT, categoria: 'decoracao', funcoes: ['escritorio', 'recepcao', 'biblioteca'], tags: ['copiadora', 'xerox', 'impressora', 'papel', 'escritorio', 'moderno'], pegada: [1.15, 0.75], altura: 1.25,
    gerar: p => piso([1.15, 0.75], copiadora(p.seed)) },
  { id: 'bebedouro.galao', nome: 'Bebedouro de galão', ...INT, categoria: 'cozinha', funcoes: ['escritorio', 'recepcao', 'corredor', 'vestiario', 'enfermaria'], tags: ['bebedouro', 'galao', 'agua', 'escritorio', 'moderno'], pegada: [0.45, 0.45], altura: 1.45,
    gerar: p => piso([0.45, 0.45], bebedouroDeGalao(p.seed)) },
  { id: 'gondola', nome: 'Gôndola de mercado', ...INT, categoria: 'armazenamento', funcoes: ['mercado', 'loja', 'deposito', 'posto'], tags: ['gondola', 'prateleira', 'mercado', 'produtos', 'loja', 'supermercado', 'moderno'], pegada: [2, 0.9], altura: 1.8,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 2, min: 1, max: 8, passo: 1 }],
    gerar: p => { const C = num(p, 'comprimento', 2, 1, 8); return piso([C, 0.9], gondola(p.seed, C)); } },
  { id: 'caixa-registradora', nome: 'Caixa de mercado', ...INT, categoria: 'mesas', funcoes: ['mercado', 'loja', 'posto', 'lanchonete'], tags: ['caixa', 'registradora', 'esteira', 'checkout', 'mercado', 'loja', 'moderno'], pegada: [2.25, 1.0], altura: 1.4,
    gerar: p => piso([2.25, 1.0], caixaRegistradora(p.seed)) },
  { id: 'freezer', nome: 'Freezer horizontal', ...INT, categoria: 'cozinha', funcoes: ['mercado', 'loja', 'posto', 'lanchonete', 'cozinha'], tags: ['freezer', 'sorvete', 'congelados', 'geladeira', 'mercado', 'moderno'], pegada: [1.85, 0.85], altura: 0.9,
    gerar: p => piso([1.85, 0.85], freezer(p.seed)) },
  { id: 'mesa-de-lanchonete', nome: 'Mesa de lanchonete', ...INT, categoria: 'mesas', funcoes: ['lanchonete', 'cozinha', 'bar', 'refeitorio'], tags: ['mesa', 'lanchonete', 'diner', 'banco', 'estofado', 'vinil', 'restaurante', 'moderno'], pegada: [1.75, 1.4], altura: 1.1,
    gerar: p => piso([1.75, 1.4], mesaDeLanchonete(p.seed)) },
  { id: 'armario-de-vestiario', nome: 'Armários de vestiário', ...INT, categoria: 'armazenamento', funcoes: ['vestiario', 'garagem', 'escola', 'delegacia', 'enfermaria', 'quartel'], tags: ['armario', 'vestiario', 'escaninho', 'metal', 'portas', 'moderno'], pegada: [1.6, 0.5], altura: 1.9,
    campos: [{ id: 'portas', rotulo: 'Portas', tipo: 'numero', padrao: 4, min: 2, max: 12, passo: 1 }],
    gerar: p => { const n = Math.round(num(p, 'portas', 4, 2, 12)); return piso([n * 0.4, 0.5], armarioDeVestiario(p.seed, n)); } },
  { id: 'maquina-de-venda', nome: 'Máquina de venda', ...INT, categoria: 'decoracao', funcoes: ['corredor', 'recepcao', 'posto', 'lanchonete', 'vestiario', 'estacao', 'escritorio'], tags: ['maquina', 'venda', 'refrigerante', 'salgadinho', 'automatica', 'moderno', 'luz'], pegada: [1.0, 1.1], altura: 1.9,
    campos: [{ id: 'acesa', rotulo: 'Acesa (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: luzDaMaquina, gerar: p => piso([1.0, 1.1], maquinaDeVenda(p.seed, ligado(p.params, 'acesa', 1))) },
  { id: 'cama-hospitalar', nome: 'Cama hospitalar', ...INT, categoria: 'camas', funcoes: ['enfermaria', 'hospital', 'clinica', 'quarto'], tags: ['cama', 'hospital', 'enfermaria', 'soro', 'leito', 'paciente', 'moderno'], pegada: [1.45, 2.25], altura: 1.0,
    gerar: p => piso([1.45, 2.25], camaHospitalar(p.seed)) },
];
