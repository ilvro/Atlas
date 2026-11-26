import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira, tufo, type Tons as TonsDeTufo } from '../organico.ts';
import { num, parede, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { BRONZE, ID, MADEIRA, O, OURO, PATINA, S, anel, arco, bloco, desgaste, disco, em, estofado, olhar, quadro, retQ, retR, tomDaFace, type Tons } from './antiguidade.ts';

// Oriental (Q16): casa (Q16a), jardim e templo (Q16b). Madeira clara (hinoki), laca preta e vermelha, papel que brilha, granito cinza
// com musgo, bronze escuro e bambu. As mesmas regras do resto do acervo: nanquim por baixo da silhueta, volume em degraus de tom
// para o noroeste, `z` das partes até 1,5 m e a `altura` real na receita (para a sombra do sol).

const HINOKI: Tons = { nanquim: '#1e140a', sombra: '#6a5034', base: '#8e6e48', meio: '#a4825a', luz: '#bc9a6e', brilho: '#d8bc90' };
const LACA_PRETA: Tons = { nanquim: '#050404', sombra: '#100c0a', base: '#1c1614', meio: '#28201c', luz: '#3a302a', brilho: '#6e5e56' };
const VERMELHAO: Tons = { nanquim: '#1e0604', sombra: '#7a2010', base: '#a8321a', meio: '#bc4022', luz: '#d05a30', brilho: '#e88a5a' };
const PEDRA: Tons = { nanquim: '#16161a', sombra: '#55554f', base: '#74736b', meio: '#88877e', luz: '#a09f95', brilho: '#c0bfb4' };
const FERRO: Tons = { nanquim: '#080808', sombra: '#1a1a1c', base: '#2a2a2c', meio: '#38383a', luz: '#4e4e52', brilho: '#7a7a80' };
const TELHA: Tons = { nanquim: '#101214', sombra: '#353a3e', base: '#4a5055', meio: '#596066', luz: '#6e767c', brilho: '#959ea4' };
const BAMBU: Tons = { nanquim: '#1e1a08', sombra: '#6a6430', base: '#8e8644', meio: '#a49a52', luz: '#bcb066', brilho: '#d8cc88' };
const CELADON: Tons = { nanquim: '#141a16', sombra: '#5a6e60', base: '#7a9080', meio: '#8ea492', luz: '#a6baa8', brilho: '#cad8c8' };
const BARRO_VERMELHO: Tons = { nanquim: '#1e0c06', sombra: '#5a2a16', base: '#7a3c20', meio: '#8e4a28', luz: '#a85e36', brilho: '#c8845a' };
const PINHO: TonsDeTufo = { fundo: '#0e1a10', base: '#22382a', meio: '#2e4a32', luz: '#46663e', brilho: '#6a8a52' };
const PAPEL = '#e6dcc2', MUSGO = '#4e6a2e', TINTA = '#141010', DOURADO = '#c49a3e', SELO = '#a8281a';

/** Clarão no chão que soma luz (lanterna, brasa): cores escuras e saturadas, porque a emissão multiplica por até 3. */
const halo = (partes: Parte[], x: number, y: number, R: number, cor: string, alfa: number): void => { partes.push(elipse(x, y, R * 2, R * 2, cor, 0.01, { ...O, brilho: true, alfa, desfoque: R * 0.3, detalhe: 1 })); };

/** Brasas de carvão que brilham num disco de raio `R`. */
function brasas(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number, n = 16): void {
  partes.push(elipse(x, y, R * 2, R * 2, '#2a0a04', z, { ...O, detalhe: 1 }));
  partes.push(elipse(x, y, R * 1.5, R * 1.5, '#8a2a06', z + 0.002, { ...O, brilho: true, alfa: 0.7, desfoque: R * 0.25, detalhe: 1 }));
  for (let k = 0; k < n; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.85; partes.push(elipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.05 + r() * 0.05, 0.04 + r() * 0.04, r() < 0.3 ? '#1a0e0a' : r() < 0.5 ? '#8a2206' : '#b0400c', z + 0.005, { ...O, brilho: true, detalhe: 2 })); }
  partes.push(elipse(x, y, R * 0.7, R * 0.7, '#c06414', z + 0.01, { ...O, brilho: true, alfa: 0.8, desfoque: R * 0.2, detalhe: 2 }));
}

/** Pedra de jardim arredondada (bolha), com o lado da luz claro e musgo do lado de sombra. */
function pedra(partes: Parte[], r: () => number, x: number, y: number, rx: number, ry: number, z: number, musgo = 0.5): void {
  const forma = bolha(x, y, rx, ry, 14, 0.12, r, r() * 6);
  partes.push(poli(forma.map((v, i) => v + (i % 2 ? 0.03 : 0.025)), PEDRA.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(forma, PEDRA.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(bolha(x + LUZ_X * rx * 0.15, y + LUZ_Y * ry * 0.15, rx * 0.78, ry * 0.76, 12, 0.12, r), PEDRA.meio, z + 0.006, { ...S, detalhe: 2 }));
  partes.push(poli(bolha(x + LUZ_X * rx * 0.35, y + LUZ_Y * ry * 0.35, rx * 0.4, ry * 0.36, 10, 0.18, r), PEDRA.luz, z + 0.009, { ...S, alfa: 0.85, detalhe: 3 }));
  if (r() < musgo) partes.push(poli(bolha(x - LUZ_X * rx * 0.4, y - LUZ_Y * ry * 0.4, rx * 0.5, ry * 0.4, 10, 0.3, r), MUSGO, z + 0.012, { ...S, alfa: 0.75, detalhe: 2 }));
}

// ---------- Casa (Q16a) ----------

/** Mesa baixa (chabudai): tampo de laca preta com o reflexo do verniz, ou de madeira com veio. */
function mesaBaixa(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.3, H = 0.8, laca = r() < 0.5, t = laca ? LACA_PRETA : MADEIRA;
  sombraNoChao(partes, [-W / 2, -H / 2, W / 2, -H / 2, W / 2, H / 2, -W / 2, H / 2], 0.02, '#0d0a08', 0.45);
  bloco(partes, ID, W, H, t, 0.35, 0.035);
  if (laca) {
    partes.push(poli(retR(ID, 0, 0, W - 0.1, H - 0.1, 0.02), '#4a1410', 0.36, { ...O, alfa: 0.35, detalhe: 2 }), poli(retR(ID, 0, 0, W - 0.14, H - 0.14, 0.02), t.meio, 0.361, { ...O, detalhe: 1 }));
    partes.push(poli([-W / 2 + 0.12, -H / 2 + 0.08, -W / 2 + 0.42, -H / 2 + 0.08, -W / 2 + 0.2, H / 2 - 0.08, -W / 2 + 0.07, H / 2 - 0.08], '#9a8a80', 0.362, { ...S, alfa: 0.16, detalhe: 3 }));
  } else for (let v = -H / 2 + 0.08; v < H / 2 - 0.05; v += 0.06 + r() * 0.05) {
    const pts: number[] = []; for (let u = -W / 2 + 0.06; u <= W / 2 - 0.05; u += 0.2) pts.push(u, v + Math.sin(u * 6 + v * 9) * 0.012);
    partes.push(tira(pts, 0.008, t.sombra, 0.362, { ...O, alfa: 0.5, detalhe: 3 }, 0.4));
  }
  return partes;
}

/** Zabuton: almofada de chão quadrada, com a costura, as borlas dos cantos e o ponto do meio. */
function zabuton(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = ['#7a2a24', '#2e3e5e', '#6a5230', '#3e5a4a', '#5a2a40'][Math.floor(r() * 5)]!, ang = (r() - 0.5) * 0.2, f = quadro(0, 0, ang);
  sombraNoChao(partes, em(f, [-0.28, -0.3, 0.28, -0.3, 0.28, 0.3, -0.28, 0.3]), 0.01, '#0d0a08', 0.4);
  estofado(partes, f, ang, 0, 0, 0.56, 0.6, cor, 0.06, 0.08);
  partes.push(tira(em(f, [-0.24, -0.26, 0.24, -0.26, 0.24, 0.26, -0.24, 0.26, -0.24, -0.26]), 0.008, tom(cor, -0.4), 0.075, { ...O, alfa: 0.55, detalhe: 3 }));
  for (const [u, v] of [[-0.27, -0.29], [0.27, -0.29], [0.27, 0.29], [-0.27, 0.29]] as const) { const [x, y] = f(u, v); partes.push(elipse(x, y, 0.04, 0.04, DOURADO, 0.08, { contorno: 'leve', detalhe: 3 })); }
  partes.push(tira(em(f, [-0.03, -0.03, 0.03, 0.03]), 0.012, '#d8ccb0', 0.082, { ...O, detalhe: 3 }), tira(em(f, [-0.03, 0.03, 0.03, -0.03]), 0.012, '#d8ccb0', 0.082, { ...O, detalhe: 3 }));
  return partes;
}

/** Futon: o colchão (shikibuton) claro, o travesseiro de trigo-sarraceno na cabeceira (−y) e a coberta estampada com a borda virada. */
function futon(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.0, L = 2.05, cor = [ '#2e3e62', '#6a2a2a', '#3e5446', '#5a4a6a'][Math.floor(r() * 4)]!;
  sombraNoChao(partes, [-W / 2, -L / 2, W / 2, -L / 2, W / 2, L / 2, -W / 2, L / 2], 0.01, '#0d0a08', 0.4);
  estofado(partes, ID, 0, 0, 0, W, L, '#ddd2bc', 0.08, 0.06);
  estofado(partes, ID, 0, 0, -L / 2 + 0.22, 0.5, 0.2, '#b8a47a', 0.2, 0.09);
  for (let k = 0; k < 4; k++) partes.push(tira([-0.2 + k * 0.13, -L / 2 + 0.14, -0.2 + k * 0.13, -L / 2 + 0.3], 0.006, '#8a7650', 0.215, { ...O, alfa: 0.5, detalhe: 3 }));
  const v0 = -L / 2 + 0.42, v1 = L / 2 + 0.02, vc = (v0 + v1) / 2;
  estofado(partes, ID, 0, 0, vc, W + 0.08, v1 - v0, cor, 0.16, 0.08);
  // Estampa: flores de cinco pétalas brancas e ramos, como um yukata.
  for (let k = 0; k < 11; k++) {
    const x = (r() - 0.5) * (W - 0.2), y = v0 + 0.3 + r() * (v1 - v0 - 0.4), s = 0.04 + r() * 0.03;
    for (let p = 0; p < 5; p++) { const a = (p / 5) * 6.28 + k; partes.push(elipse(x + Math.cos(a) * s * 0.6, y + Math.sin(a) * s * 0.6, s * 0.75, s * 0.75, tom(cor, 0.55), 0.172, { ...O, alfa: 0.8, detalhe: 3 })); }
    partes.push(elipse(x, y, s * 0.45, s * 0.45, DOURADO, 0.173, { ...O, alfa: 0.8, detalhe: 3 }));
  }
  for (let k = 0; k < 3; k++) { const u = -0.3 + k * 0.3 + (r() - 0.5) * 0.1; partes.push(tira([u, v0 + 0.25, u + 0.04, vc, u - 0.02, v1 - 0.1], 0.05, tom(cor, -0.35), 0.174, { ...S, alfa: 0.4, detalhe: 2 }, 0.3)); }
  // A borda virada da coberta, branca, perto do travesseiro.
  partes.push(poli(retR(ID, 0, v0 + 0.06, W + 0.06, 0.13, 0.05), tom('#e8e0cc', -0.5), 0.2, { contorno: 'leve', detalhe: 2 }), poli(retR(ID, 0, v0 + 0.055, W + 0.04, 0.1, 0.04), '#e8e0cc', 0.202, { ...O, detalhe: 2 }));
  return partes;
}

/** Biombo de `n` folhas em zigue-zague: a moldura de laca preta em cima e a face pintada (ouro, pinheiro, nuvens e água) vista de frente (+y). */
function biombo(seed: number, n: number): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], pw = 0.5, ang = 0.5, dx = pw * Math.cos(ang), dy = pw * Math.sin(ang), F = 0.18;
  const W = n * dx, x0 = -W / 2, y0 = -F / 2;
  const pt = (i: number): [number, number] => [x0 + i * dx, y0 + (i % 2 ? dy / 2 : -dy / 2)];
  const sombra: number[] = [];
  for (let i = 0; i <= n; i++) { const [x, y] = pt(i); sombra.push(x, y + F); }
  for (let i = n; i >= 0; i--) { const [x, y] = pt(i); sombra.push(x, y - 0.04); }
  sombraNoChao(partes, sombra, 0.01, '#0d0a08', 0.45);
  const motivo = Math.floor(r() * 2);
  for (let i = 0; i < n; i++) {
    const [ax, ay] = pt(i), [bx, by] = pt(i + 1), nrm = Math.atan2(bx - ax, -(by - ay)), k = olhar(nrm) * 0.18;
    const face = [ax, ay, bx, by, bx, by + F, ax, ay + F];
    partes.push(poli(face, tom('#a8843a', k), 0.9, { contorno: 'leve', detalhe: 1 }));
    // A pintura: faixa de água embaixo, nuvem dourada em cima e um pinheiro (ou flores de ameixeira) que atravessa as folhas.
    const lerp = (t: number, s: number): [number, number] => [ax + (bx - ax) * t, ay + (by - ay) * t + F * s];
    const agua = [...lerp(0, 0.72), ...lerp(1, 0.72), ...lerp(1, 0.95), ...lerp(0, 0.95)];
    partes.push(poli(agua, tom('#2e4a6a', k), 0.905, { ...O, detalhe: 2 }));
    for (let w = 0; w < 2; w++) { const [qx, qy] = lerp(0.25 + w * 0.5, 0.8); partes.push(tira([qx - 0.06, qy, qx, qy - 0.02, qx + 0.06, qy], 0.012, '#d8e0e8', 0.907, { ...O, alfa: 0.8, detalhe: 3 })); }
    const [nx, ny] = lerp(0.3 + r() * 0.4, 0.2); partes.push(lente(nx - 0.08, ny, 0, 0.16, 0.05, tom('#e8c870', k), 0.906, { ...O, detalhe: 3 }));
    if (motivo === 0) {
      const [px, py] = lerp(0.5, 0.45);
      partes.push(tira([px - 0.1, py + 0.12, px, py + 0.02, px + 0.08, py - 0.05], 0.02, '#3a2a1a', 0.908, { ...O, detalhe: 2 }, 0.5));
      for (let p = 0; p < 3; p++) partes.push(elipse(px - 0.08 + p * 0.08 + (r() - 0.5) * 0.03, py - 0.02 + (r() - 0.5) * 0.04, 0.09, 0.05, tom('#2e4a2e', k), 0.909, { ...O, detalhe: 2 }));
    } else {
      const [px, py] = lerp(0.2, 0.5);
      partes.push(tira([px, py + 0.1, px + 0.1, py, px + 0.25, py - 0.03], 0.016, '#2a1a12', 0.908, { ...O, detalhe: 2 }, 0.5));
      for (let p = 0; p < 4; p++) partes.push(elipse(px + 0.04 + p * 0.06, py + 0.04 - p * 0.02 + (r() - 0.5) * 0.03, 0.035, 0.035, '#e8a8b4', 0.909, { ...O, detalhe: 3 }));
    }
    partes.push(tira([ax, ay + F, bx, by + F], 0.02, LACA_PRETA.base, 0.91, { ...O, detalhe: 2 }));
    partes.push(tira([ax, ay, bx, by], 0.05, LACA_PRETA.nanquim, 1.2, { contorno: 'leve', detalhe: 1 }), tira([ax, ay, bx, by], 0.026, tom(LACA_PRETA.luz, k), 1.205, { ...O, detalhe: 2 }));
  }
  for (let i = 0; i <= n; i++) { const [x, y] = pt(i); partes.push(elipse(x, y, 0.05, 0.05, DOURADO, 1.21, { contorno: 'leve', detalhe: 3 })); }
  return { pegada: [Math.round((W + 0.12) * 100) / 100, Math.round((dy + F + 0.12) * 100) / 100], partes };
}

/** Tansu em escada (kaidan-dansu): quatro degraus de madeira escura que sobem para o fundo (−y), com as cantoneiras de ferro. */
function tansu(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 0.9, D = 1.6, n = 4, d = D / n;
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2, -W / 2, D / 2], 0.02, '#0d0a08', 0.45);
  for (let j = 0; j < n; j++) {
    const vc = D / 2 - (j + 0.5) * d, z = 0.38 + j * 0.35, f = quadro(0, vc);
    bloco(partes, f, W, d + 0.01, MADEIRA, z, 0.03);
    for (let v = -d / 2 + 0.06; v < d / 2 - 0.03; v += 0.05 + r() * 0.04) partes.push(tira(em(f, [-W / 2 + 0.05, v, 0, v + (r() - 0.5) * 0.02, W / 2 - 0.05, v]), 0.006, MADEIRA.sombra, z + 0.007, { ...O, alfa: 0.45, detalhe: 3 }));
    if (j < n - 1) partes.push(poli(retQ(f, 0, -d / 2 + 0.07, W, 0.14), '#0d0a08', z + 0.008, { ...S, alfa: 0.38, detalhe: 2 }));
    for (const s of [-1, 1]) {
      const cu = s * (W / 2 - 0.015), cv = d / 2 - 0.015;
      partes.push(poli(em(f, [cu, cv, cu - s * 0.12, cv, cu - s * 0.12, cv - 0.035, cu - s * 0.035, cv - 0.035, cu - s * 0.035, cv - 0.1, cu, cv - 0.1]), FERRO.base, z + 0.009, { contorno: 'leve', detalhe: 2 }));
      const [px, py] = f(cu - s * 0.025, cv - 0.025); partes.push(elipse(px, py, 0.014, 0.014, FERRO.brilho, z + 0.01, { ...O, detalhe: 3 }));
    }
    // A argola de ferro da gaveta do degrau de cima, pendurada na beira.
    const [ax, ay] = f(0, d / 2 - 0.02); partes.push(tira(arco(ax, ay, 0.05, 0.035, 0, Math.PI, 8), 0.012, FERRO.luz, z + 0.01, { contorno: 'leve', detalhe: 3 }));
  }
  return partes;
}

/** Irori: o fogo no chão. Moldura de madeira, cinza, brasas que brilham, lenha, peixes no espeto e a chaleira de ferro pendurada no gancho com o peixe de madeira. */
function irori(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 1.3, I = L - 0.24;
  halo(partes, 0, 0, 0.75, '#6a2004', 0.24);
  bloco(partes, ID, L, L, MADEIRA, 0.06, 0.1);
  partes.push(poli(retQ(ID, 0, 0, I, I), '#5e5a52', 0.065, { ...O, detalhe: 1 }), poli(bolha(0, 0, I * 0.45, I * 0.45, 16, 0.08, r), '#7e7a70', 0.066, { ...S, detalhe: 1 }));
  for (let k = 0; k < 30; k++) partes.push(elipse((r() - 0.5) * I * 0.9, (r() - 0.5) * I * 0.9, 0.025, 0.02, r() < 0.5 ? '#9a968c' : '#4a4640', 0.067, { ...O, alfa: 0.7, detalhe: 3 }));
  // O fosso é rebaixado: a borda do noroeste faz sombra na cinza.
  partes.push(poli([-I / 2, -I / 2, I / 2, -I / 2, I / 2 - 0.1, -I / 2 + 0.1, -I / 2 + 0.1, -I / 2 + 0.1, -I / 2 + 0.1, I / 2 - 0.1, -I / 2, I / 2], '#0d0a08', 0.068, { ...S, alfa: 0.45, detalhe: 2 }));
  brasas(partes, r, 0, 0, 0.27, 0.07);
  for (let k = 0; k < 4; k++) {
    const a = k * (Math.PI / 2) + 0.4 + r() * 0.3, c = Math.cos(a), s = Math.sin(a);
    partes.push(tira([c * 0.48, s * 0.48, c * 0.14, s * 0.14], 0.075, MADEIRA.nanquim, 0.09, { contorno: 'leve', detalhe: 1 }), tira([c * 0.48, s * 0.48, c * 0.16, s * 0.16], 0.05, tom(MADEIRA.base, olhar(a + Math.PI / 2) * 0.2), 0.092, { ...O, detalhe: 2 }));
    partes.push(elipse(c * 0.15, s * 0.15, 0.06, 0.06, '#b0400c', 0.095, { ...O, brilho: true, detalhe: 3 }));
  }
  // Peixes no espeto, fincados na cinza e inclinados para o fogo.
  for (let k = 0; k < 3; k++) {
    const a = 0.9 + k * 0.55 + Math.PI, c = Math.cos(a), s = Math.sin(a), x = c * 0.4, y = s * 0.4;
    partes.push(tira([c * 0.5, s * 0.5, c * 0.28, s * 0.28], 0.012, '#c8b088', 0.25, { contorno: 'leve', detalhe: 3 }));
    partes.push(lente(x + c * 0.07, y + s * 0.07, a + Math.PI, 0.17, 0.06, '#6a5a40', 0.3, { contorno: 'leve', detalhe: 2 }), lente(x + c * 0.06, y + s * 0.06, a + Math.PI, 0.12, 0.025, '#a8946a', 0.305, { ...O, detalhe: 3 }));
  }
  // A chaleira de ferro (tetsubin), com a alça, o bico e a tampa.
  partes.push(lente(0.12, 0.02, 0.3, 0.1, 0.045, FERRO.base, 0.52, { contorno: 'leve', detalhe: 2 }));
  disco(partes, 0, 0, 0.15, FERRO, 0.55);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.28; partes.push(elipse(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.018, 0.018, tom(FERRO.base, olhar(a) * 0.35), 0.575, { ...O, detalhe: 3 })); }
  disco(partes, 0, 0, 0.07, FERRO, 0.58);
  partes.push(tira(arco(0, 0, 0.16, 0.16, Math.PI * 0.95, Math.PI * 2.05, 10), 0.016, FERRO.luz, 0.7, { contorno: 'leve', detalhe: 2 }));
  // O peixe de madeira (yokozaru) que trava a altura do gancho, e o bambu que sobe.
  partes.push(elipse(0, 0, 0.05, 0.05, BAMBU.base, 0.75, { contorno: 'leve', detalhe: 2 }));
  partes.push(lente(-0.17, -0.02, 0, 0.36, 0.11, HINOKI.nanquim, 1.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), lente(-0.16, -0.025, 0, 0.33, 0.085, HINOKI.meio, 1.305, { ...O, detalhe: 2 }));
  partes.push(poli([0.16, -0.02, 0.24, -0.08, 0.24, 0.04], HINOKI.base, 1.304, { contorno: 'leve', detalhe: 2 }), elipse(-0.1, -0.04, 0.025, 0.025, TINTA, 1.31, { ...O, detalhe: 3 }));
  for (let k = 0; k < 4; k++) partes.push(tira([-0.05 + k * 0.045, -0.06, -0.03 + k * 0.045, 0.0], 0.006, HINOKI.sombra, 1.31, { ...O, alfa: 0.7, detalhe: 3 }));
  return partes;
}

/** Andon: lâmpada de papel de chão, com a moldura de laca, o papel aceso, o prato de óleo e a chama, e o clarão no chão. */
function andon(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], s = 0.36, z = 0.75;
  halo(partes, 0, 0, 0.36, '#7a3a08', 0.32);
  for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) partes.push(ret(u * (s / 2 + 0.02), v * (s / 2 + 0.02), 0.05, 0.05, LACA_PRETA.base, 0.08, { contorno: 'leve', detalhe: 2 }));
  partes.push(poli(retQ(ID, 0, 0, s + 0.04, s + 0.04), LACA_PRETA.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, 0, s, s), '#8a5a26', z + 0.003, { ...O, brilho: true, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, 0, s - 0.07, s - 0.07), '#6a3a10', z + 0.005, { ...O, brilho: true, detalhe: 1 }));
  partes.push(elipse(0, 0, s * 0.8, s * 0.8, '#9a5216', z + 0.006, { ...O, brilho: true, alfa: 0.7, desfoque: 0.05, detalhe: 2 }));
  // O prato de óleo e a chama.
  partes.push(elipse(0.02, 0.02, 0.1, 0.1, '#2a1a0e', z + 0.008, { contorno: 'leve', detalhe: 2 }), lente(0.02, 0.02, -0.6 + r() * 0.2, 0.06, 0.03, '#c88a2a', z + 0.01, { ...O, brilho: true, desfoque: 0.005, detalhe: 2 }));
  // A grade de ripas (kumiko) sobre o papel e a moldura de cima, com a alça.
  for (const k of [-1, 1]) { partes.push(tira([k * s / 6, -s / 2, k * s / 6, -s / 2 + 0.035], 0.01, LACA_PRETA.base, z + 0.012, { ...O, detalhe: 3 }), tira([k * s / 6, s / 2, k * s / 6, s / 2 - 0.035], 0.01, LACA_PRETA.base, z + 0.012, { ...O, detalhe: 3 }), tira([-s / 2, k * s / 6, -s / 2 + 0.035, k * s / 6], 0.01, LACA_PRETA.base, z + 0.012, { ...O, detalhe: 3 }), tira([s / 2, k * s / 6, s / 2 - 0.035, k * s / 6], 0.01, LACA_PRETA.base, z + 0.012, { ...O, detalhe: 3 })); }
  partes.push(tira([-s / 2, -s / 2, s / 2, -s / 2, s / 2, s / 2, -s / 2, s / 2, -s / 2, -s / 2], 0.026, LACA_PRETA.meio, z + 0.015, { contorno: 'leve', detalhe: 2 }));
  partes.push(tira([-s / 2 - 0.02, 0, s / 2 + 0.02, 0], 0.026, LACA_PRETA.luz, z + 0.05, { contorno: 'leve', detalhe: 2 }));
  return partes;
}

/** Lanterna de papel pendurada (chōchin), vista de cima: o papel aceso em volta, as costelas em anéis e a tampa de laca no meio. */
function lanternaDePapel(vermelha: boolean): Parte[] {
  const partes: Parte[] = [], R = 0.22, z = 1.4, papel = vermelha ? '#6e140a' : '#7e5222';
  halo(partes, 0, 0, 0.38, vermelha ? '#5a1004' : '#6a3006', 0.3);
  partes.push(elipse(0, 0, R * 2 + 0.03, R * 2 + 0.03, '#1a0a04', z, { contorno: 'leve', detalhe: 1 }));
  partes.push(elipse(0, 0, R * 2, R * 2, papel, z + 0.003, { ...O, brilho: true, detalhe: 1 }));
  partes.push(elipse(0, 0, R * 1.3, R * 1.3, tom(papel, 0.18), z + 0.005, { ...O, brilho: true, alfa: 0.8, desfoque: 0.04, detalhe: 2 }));
  for (const k of [0.95, 0.84, 0.7, 0.55]) partes.push(tira(anel(0, 0, R * k, R * k, 32), 0.007, tom(papel, -0.55), z + 0.01, { ...O, alfa: 0.55, detalhe: 3 }));
  if (vermelha) for (let k = 0; k < 2; k++) partes.push(tira(arco(0, 0, R * 0.78, R * 0.78, 0.5 + k * Math.PI, 1.5 + k * Math.PI, 8), 0.03, TINTA, z + 0.012, { ...O, alfa: 0.6, detalhe: 3 }));
  disco(partes, 0, 0, 0.05, LACA_PRETA, z + 0.02);
  partes.push(tira(anel(0, 0, 0.022, 0.022, 12), 0.01, DOURADO, z + 0.04, { contorno: 'leve', detalhe: 3 }));
  partes.push(elipse(0, 0, 0.012, 0.012, TINTA, z + 0.045, { ...O, detalhe: 3 }));
  return partes;
}

/** Pergaminho de parede (kakejiku): montagem de seda, os rolos de madeira, e uma pintura a nanquim (montanhas, caligrafia ou ameixeira) com o selo vermelho. */
function pergaminho(seed: number, l: number): { face: Parte[]; topo: Parte[] } {
  const r = mulberry32(seed), face: Parte[] = [], z0 = 0.03, topoY = 2.05, baseY = 0.7, w = l * 0.84, wp = l * 0.6;
  const seda = ['#5a6a4a', '#7a5a3a', '#4a4a5e', '#6a4a3e'][Math.floor(r() * 4)]!, pTopo = topoY - 0.24, pBase = baseY + 0.16;
  face.push(tira([-0.12, topoY, 0, topoY + 0.13, 0.12, topoY], 0.012, '#5a4a2a', z0, { ...O, detalhe: 3 }), elipse(0, topoY + 0.13, 0.03, 0.03, FERRO.luz, z0 + 0.001, { ...O, detalhe: 3 }));
  face.push(ret(0, (topoY + baseY) / 2, w + 0.02, topoY - baseY + 0.02, '#1a1410', z0 + 0.002), ret(0, (topoY + baseY) / 2, w, topoY - baseY, seda, z0 + 0.004, { ...O, detalhe: 1 }));
  for (let k = 0; k < 18; k++) face.push(elipse((r() - 0.5) * w * 0.9, baseY + 0.05 + r() * (topoY - baseY - 0.1), 0.02, 0.02, tom(seda, 0.3), z0 + 0.005, { ...O, alfa: 0.6, detalhe: 3 }));
  face.push(ret(0, pTopo + 0.03, wp + 0.04, 0.04, DOURADO, z0 + 0.006, { ...O, detalhe: 2 }), ret(0, pBase - 0.03, wp + 0.04, 0.04, DOURADO, z0 + 0.006, { ...O, detalhe: 2 }));
  face.push(ret(0, (pTopo + pBase) / 2, wp, pTopo - pBase, PAPEL, z0 + 0.007, { ...O, detalhe: 1 }));
  const tema = Math.floor(r() * 3), alto = pTopo - pBase;
  if (tema === 0) {
    // Montanhas na névoa: três planos, do mais claro (longe) ao mais escuro (perto), e um pinheiro.
    for (let p = 0; p < 3; p++) {
      const pts: number[] = [-wp / 2, pBase + alto * (0.2 + p * 0.0)], topo = pBase + alto * (0.85 - p * 0.22);
      for (let k = 0; k <= 6; k++) { const u = -wp / 2 + (k / 6) * wp; pts.push(u, pBase + alto * 0.18 + (topo - pBase - alto * 0.18) * Math.pow(Math.sin(((k / 6) + p * 0.3 + r() * 0.1) * Math.PI), 2) * (0.6 + r() * 0.4)); }
      pts.push(wp / 2, pBase + alto * 0.2, wp / 2, pBase, -wp / 2, pBase);
      face.push(poli(pts, ['#b8b4a8', '#8a8678', '#4a4840'][p]!, z0 + 0.008 + p * 0.001, { ...O, alfa: 0.85, detalhe: 2 }));
    }
    face.push(tira([wp * 0.2, pBase + 0.02, wp * 0.15, pBase + alto * 0.3, wp * 0.22, pBase + alto * 0.42], 0.016, TINTA, z0 + 0.012, { ...O, detalhe: 2 }, 0.5));
    for (let k = 0; k < 3; k++) face.push(elipse(wp * 0.16 + k * 0.03, pBase + alto * (0.3 + k * 0.05), 0.09, 0.035, '#2a3a2a', z0 + 0.013, { ...O, detalhe: 3 }));
  } else if (tema === 1) {
    // Caligrafia: uma coluna de traços grossos de pincel, de cima para baixo.
    let y = pTopo - 0.08;
    for (let k = 0; k < 4 && y > pBase + 0.12; k++) {
      const h = 0.14 + r() * 0.06;
      face.push(tira([-0.06, y, 0.06, y - 0.02], 0.022, TINTA, z0 + 0.01, { ...O, detalhe: 2 }, 0.4), tira([0.0, y + 0.01, -0.02, y - h * 0.6, 0.03, y - h], 0.026, TINTA, z0 + 0.01, { ...O, detalhe: 2 }, 0.3));
      if (r() < 0.6) face.push(tira([-0.07, y - h * 0.4, -0.02, y - h * 0.55], 0.016, TINTA, z0 + 0.011, { ...O, detalhe: 3 }, 0.3));
      y -= h + 0.06;
    }
  } else {
    // Ramo de ameixeira em flor.
    const ramo = [-wp / 2 + 0.02, pBase + alto * 0.25, -wp * 0.1, pBase + alto * 0.4, wp * 0.05, pBase + alto * 0.62, wp * 0.3, pBase + alto * 0.78];
    face.push(tira(ramo, 0.022, '#2a1a12', z0 + 0.01, { ...O, detalhe: 2 }, 0.4));
    for (let k = 0; k < 9; k++) { const t = 0.15 + r() * 0.8, i = Math.min(2, Math.floor(t * 3)) * 2, f = t * 3 - i / 2, x = ramo[i]! + (ramo[i + 2]! - ramo[i]!) * f + (r() - 0.5) * 0.06, y = ramo[i + 1]! + (ramo[i + 3]! - ramo[i + 1]!) * f + (r() - 0.5) * 0.06; face.push(elipse(x, y, 0.035, 0.035, '#d06a7a', z0 + 0.012, { ...O, detalhe: 3 }), elipse(x, y, 0.012, 0.012, '#e8c060', z0 + 0.013, { ...O, detalhe: 3 })); }
  }
  face.push(ret(wp * 0.36, pBase + 0.07, 0.035, 0.045, SELO, z0 + 0.014, { ...O, detalhe: 3 }));
  face.push(ret(0, topoY, w + 0.04, 0.035, MADEIRA.base, z0 + 0.015, { contorno: 'leve', detalhe: 2 }));
  face.push(ret(0, baseY, w + 0.04, 0.045, MADEIRA.meio, z0 + 0.015, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) face.push(ret(s * (w / 2 + 0.05), baseY, 0.06, 0.06, LACA_PRETA.meio, z0 + 0.016, { contorno: 'leve', detalhe: 2 }));
  const topo = [ret(0, 0.025, w + 0.16, 0.04, MADEIRA.base, 2.05, { contorno: 'leve' })];
  return { face, topo };
}

/** Ikebana: vaso raso (suiban) com água e o espeto de flores, e o arranjo de três ramos (céu, homem, terra) com folhas e flores. */
function ikebana(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], camelia = r() < 0.5, vaso = r() < 0.5 ? CELADON : LACA_PRETA;
  sombraNoChao(partes, bolha(0, 0, 0.22, 0.22, 12, 0.04, r), 0.01, '#0d0a08', 0.4);
  disco(partes, 0, 0, 0.2, vaso, 0.25);
  partes.push(elipse(0, 0, 0.32, 0.32, '#22343a', 0.27, { ...O, detalhe: 1 }), elipse(-0.04, -0.04, 0.12, 0.05, '#6a8a90', 0.272, { ...S, alfa: 0.5, detalhe: 3 }));
  partes.push(elipse(0.04, 0.03, 0.08, 0.08, '#1a1a1a', 0.275, { contorno: 'leve', detalhe: 3 }));
  const a0 = -2.2 + r() * 0.4, ramos: [number, number, number][] = [[a0, 0.42, 0.75], [a0 + 1.3, 0.3, 0.6], [a0 - 1.4, 0.22, 0.45]];
  for (const [a, L, z] of ramos) {
    const pts: number[] = [0.04, 0.03];
    for (let k = 1; k <= 4; k++) { const t = k / 4, b = a + Math.sin(t * 3) * 0.25; pts.push(0.04 + Math.cos(b) * L * t, 0.03 + Math.sin(b) * L * t); }
    partes.push(tira(pts, 0.022, '#2a1a10', z, { contorno: 'leve', detalhe: 2 }, 0.4));
    for (let k = 1; k < 4; k++) { const x = pts[k * 2]!, y = pts[k * 2 + 1]!, s = r() < 0.5 ? 1 : -1; partes.push(lente(x, y, a + s * 1.1, 0.09, 0.04, k % 2 ? '#2e4a26' : '#3e5e30', z + 0.005, { contorno: 'leve', detalhe: 3 })); }
    const fx = pts[pts.length - 2]!, fy = pts[pts.length - 1]!;
    const flores = camelia ? 1 : 3;
    for (let k = 0; k < flores; k++) {
      const x = fx - Math.cos(a) * k * 0.09, y = fy - Math.sin(a) * k * 0.09, R = camelia ? 0.06 : 0.032, cor = camelia ? (r() < 0.6 ? '#a81c24' : '#e8e0d8') : '#e8a0b0';
      for (let p = 0; p < 5; p++) { const b = (p / 5) * 6.28; partes.push(elipse(x + Math.cos(b) * R * 0.55, y + Math.sin(b) * R * 0.55, R * 0.9, R * 0.9, tom(cor, olhar(b) * 0.15), z + 0.01, { contorno: 'leve', detalhe: 3 })); }
      partes.push(elipse(x, y, R * 0.5, R * 0.5, '#e8c040', z + 0.012, { ...O, detalhe: 3 }));
    }
  }
  return partes;
}

/** Bonsai: pinheiro em miniatura num vaso raso esmaltado, com tronco torcido, almofadas de agulhas e musgo. */
function bonsai(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], vaso: Tons = r() < 0.5 ? { nanquim: '#0e1418', sombra: '#2a3a48', base: '#3a4e60', meio: '#4a6072', luz: '#5e7688', brilho: '#8aa0b0' } : BARRO_VERMELHO;
  sombraNoChao(partes, [-0.27, -0.19, 0.27, -0.19, 0.27, 0.19, -0.27, 0.19], 0.01, '#0d0a08', 0.45);
  bloco(partes, ID, 0.52, 0.36, vaso, 0.25, 0.04);
  partes.push(poli(retQ(ID, 0, 0, 0.44, 0.28), '#3a2a1a', 0.26, { ...O, detalhe: 1 }));
  for (let k = 0; k < 5; k++) partes.push(poli(bolha((r() - 0.5) * 0.36, (r() - 0.5) * 0.2, 0.06, 0.04, 8, 0.3, r), MUSGO, 0.262, { ...S, alfa: 0.9, detalhe: 2 }));
  const tronco = [-0.1, 0.06, -0.05, 0.0, -0.1, -0.06, 0.0, -0.1, 0.12, -0.06];
  partes.push(tira(tronco, 0.06, '#1e1410', 0.4, { contorno: 'leve', detalhe: 1 }, 0.5), tira(tronco.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * 0.01), 0.03, '#6a5040', 0.405, { ...O, detalhe: 2 }, 0.5));
  const almofadas: [number, number, number, number][] = [[-0.22, -0.02, 0.13, 0.55], [0.16, -0.12, 0.14, 0.62], [0.02, -0.16, 0.12, 0.68], [0.2, 0.08, 0.1, 0.5]];
  for (const [x, y, R, z] of almofadas) { partes.push(tira([0, -0.05, x * 0.7, y * 0.7, x, y], 0.022, '#3a2a20', z - 0.05, { contorno: 'leve', detalhe: 2 }, 0.5)); tufo(partes, r, x, y, R, PINHO, z, 8, 14, 5); }
  return partes;
}

/** Espada japonesa deitada ao longo de u (de −L/2, o cabo, a +L/2, a ponta da bainha), curvando de leve para +v. */
function espada(partes: Parte[], v: number, L: number, z: number, cabo: string): void {
  const curva = (u: number) => v - 0.03 * (1 - Math.pow((u / (L / 2)), 2)), pts = (a: number, b: number, n = 8): number[] => { const p: number[] = []; for (let k = 0; k <= n; k++) { const u = a + (k / n) * (b - a); p.push(u, curva(u)); } return p; };
  const ct = -L / 2 + L * 0.26;
  partes.push(tira(pts(ct, L / 2), 0.04, LACA_PRETA.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(pts(ct, L / 2), 0.026, LACA_PRETA.meio, z + 0.003, { ...O, detalhe: 2 }));
  partes.push(tira(pts(ct + 0.02, L / 2 - 0.02).map((p, i) => (i % 2 ? p - 0.007 : p)), 0.006, LACA_PRETA.brilho, z + 0.005, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(ret(L / 2 - 0.015, curva(L / 2 - 0.015), 0.03, 0.04, OURO.base, z + 0.006, { contorno: 'leve', detalhe: 3 }));
  partes.push(ret(ct + L * 0.12, curva(ct + L * 0.12), 0.025, 0.045, '#5a4a8a', z + 0.006, { ...O, detalhe: 3 }));
  partes.push(tira(pts(-L / 2, ct, 4), 0.034, '#e0d8c4', z + 0.004, { contorno: 'leve', detalhe: 2 }));
  for (let u = -L / 2 + 0.03; u < ct - 0.02; u += 0.035) partes.push(lente(u, curva(u) - 0.012, Math.PI / 2, 0.024, 0.02, cabo, z + 0.006, { ...O, detalhe: 3 }));
  partes.push(ret(-L / 2 + 0.01, curva(-L / 2), 0.025, 0.038, FERRO.luz, z + 0.007, { contorno: 'leve', detalhe: 3 }));
  partes.push(elipse(ct, curva(ct), 0.035, 0.085, FERRO.nanquim, z + 0.008, { contorno: 'leve', detalhe: 2 }), elipse(ct, curva(ct), 0.022, 0.068, OURO.sombra, z + 0.009, { ...O, detalhe: 3 }));
}

/** Suporte de espadas (katana-kake): a base e as duas cabeceiras de laca com fio dourado, a katana em cima e a wakizashi embaixo. */
function suporteDeEspadas(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cabo = r() < 0.5 ? '#1e2a4a' : '#141010';
  sombraNoChao(partes, [-0.46, -0.16, 0.46, -0.16, 0.46, 0.16, -0.46, 0.16], 0.01, '#0d0a08', 0.4);
  bloco(partes, ID, 0.88, 0.14, LACA_PRETA, 0.05, 0.02);
  for (const s of [-1, 1]) { bloco(partes, quadro(s * 0.36, 0), 0.07, 0.32, LACA_PRETA, 0.5, 0.015); partes.push(tira([s * 0.36, -0.13, s * 0.36, 0.13], 0.006, DOURADO, 0.506, { ...O, detalhe: 3 })); }
  espada(partes, 0.08, 0.64, 0.42, cabo);
  espada(partes, -0.05, 0.96, 0.55, cabo);
  return partes;
}

/** Armadura oriental no baú (yoroi-bitsu): as ombreiras (sode) de lâminas amarradas, o peito, e o elmo com a nuca, as abas e o crescente dourado. */
function armaduraOriental(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], laca = r() < 0.5 ? LACA_PRETA : { ...VERMELHAO, base: '#7e1c12', meio: '#962618', luz: '#b03a22' }, corda = r() < 0.5 ? '#2a3e7a' : '#a8281a';
  sombraNoChao(partes, [-0.4, -0.3, 0.4, -0.3, 0.4, 0.3, -0.4, 0.3], 0.02, '#0d0a08', 0.45);
  bloco(partes, ID, 0.74, 0.52, LACA_PRETA, 0.45, 0.04);
  // O peito (dō), de lâminas laqueadas.
  disco(partes, 0, 0.03, 0.27, laca, 0.95, 0.2);
  for (let k = 0; k < 4; k++) partes.push(tira(arco(0, 0.03, 0.26 - k * 0.04, 0.19 - k * 0.03, 0.15, Math.PI - 0.15, 10), 0.01, corda, 0.965, { ...O, alfa: 0.8, detalhe: 3 }));
  // Ombreiras: placas largas com as cordas em colunas.
  for (const s of [-1, 1]) {
    const f = quadro(s * 0.34, 0.04, s * 0.12), w = 0.2, h = 0.34;
    bloco(partes, f, w, h, laca, 1.0, 0.02, s * 0.12);
    for (let k = 1; k < 5; k++) partes.push(tira(em(f, [-w / 2 + 0.01, -h / 2 + k * (h / 5), w / 2 - 0.01, -h / 2 + k * (h / 5)]), 0.008, tom(laca.base, -0.4), 1.006, { ...O, detalhe: 3 }));
    for (let k = 0; k < 4; k++) partes.push(tira(em(f, [-w / 2 + 0.03 + k * 0.047, -h / 2 + 0.02, -w / 2 + 0.03 + k * 0.047, h / 2 - 0.02]), 0.012, corda, 1.008, { ...O, detalhe: 3 }));
    partes.push(tira(em(f, [-w / 2, h / 2 - 0.02, w / 2, h / 2 - 0.02]), 0.02, DOURADO, 1.01, { ...O, detalhe: 3 }));
  }
  // O elmo (kabuto): a nuca de lâminas (shikoro) em leque para trás, as abas viradas (fukigaeshi) e a calota de gomos.
  const hy = 0.0;
  partes.push(poli([...arco(0, hy, 0.3, 0.28, Math.PI * 0.95, Math.PI * 2.05, 16), ...arco(0, hy, 0.13, 0.13, Math.PI * 2.05, Math.PI * 0.95, 12)], laca.nanquim, 1.22, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 3; k++) partes.push(tira(arco(0, hy, 0.28 - k * 0.05, 0.26 - k * 0.045, Math.PI * 0.97, Math.PI * 2.03, 16), 0.04, tom(laca.base, 0.1 - k * 0.1), 1.225 + k * 0.003, { ...O, detalhe: 2 }), tira(arco(0, hy, 0.26 - k * 0.05, 0.24 - k * 0.045, Math.PI * 1.05, Math.PI * 1.95, 16), 0.008, corda, 1.234 + k * 0.003, { ...O, detalhe: 3 }));
  for (const s of [-1, 1]) partes.push(lente(s * 0.13, hy + 0.06, s > 0 ? 0.35 : Math.PI - 0.35, 0.16, 0.09, laca.meio, 1.25, { contorno: 'leve', detalhe: 2 }), lente(s * 0.15, hy + 0.065, s > 0 ? 0.35 : Math.PI - 0.35, 0.11, 0.04, DOURADO, 1.255, { ...O, detalhe: 3 }));
  disco(partes, 0, hy, 0.15, FERRO, 1.3);
  for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.28; partes.push(tira([Math.cos(a) * 0.03, hy + Math.sin(a) * 0.03, Math.cos(a) * 0.145, hy + Math.sin(a) * 0.145], 0.006, olhar(a) > 0 ? FERRO.brilho : FERRO.nanquim, 1.33, { ...O, alfa: 0.7, detalhe: 3 })); }
  partes.push(tira(anel(0, hy, 0.03, 0.03, 12), 0.012, DOURADO, 1.335, { contorno: 'leve', detalhe: 3 }));
  partes.push(tira(arco(0, hy, 0.16, 0.15, 0.25, Math.PI - 0.25, 10), 0.035, laca.nanquim, 1.34, { contorno: 'leve', detalhe: 2 }));
  // O crescente (kuwagata): dois chifres dourados para a frente (+y).
  for (const s of [-1, 1]) { const pts = [s * 0.02, hy + 0.15, s * 0.08, hy + 0.24, s * 0.16, hy + 0.36]; partes.push(tira(pts, 0.045, OURO.nanquim, 1.42, { contorno: 'leve', detalhe: 1 }, 0.3), tira(pts, 0.028, s < 0 ? OURO.luz : OURO.base, 1.425, { ...O, detalhe: 2 }, 0.3)); }
  partes.push(elipse(0, hy + 0.16, 0.06, 0.04, OURO.meio, 1.43, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Bule e xícaras orientais: bandeja, bule (kyusu) com cabo de lado e três copos (yunomi) com chá verde. */
function buleOriental(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], bule = r() < 0.5 ? BARRO_VERMELHO : CELADON, z = 0.8;
  bloco(partes, ID, 0.46, 0.3, r() < 0.5 ? LACA_PRETA : HINOKI, z, 0.02);
  const bx = -0.1, by = 0.0;
  partes.push(lente(bx + 0.07, by - 0.02, -0.3, 0.09, 0.03, bule.base, z + 0.02, { contorno: 'leve', detalhe: 2 }));
  partes.push(tira([bx, by + 0.05, bx - 0.02, by + 0.14], 0.026, bule.nanquim, z + 0.03, { contorno: 'leve', detalhe: 2 }), tira([bx, by + 0.06, bx - 0.02, by + 0.135], 0.014, bule.meio, z + 0.032, { ...O, detalhe: 3 }));
  disco(partes, bx, by, 0.075, bule, z + 0.035);
  partes.push(tira(anel(bx, by, 0.045, 0.045, 16), 0.008, bule.nanquim, z + 0.05, { ...O, alfa: 0.7, detalhe: 3 }), elipse(bx, by, 0.022, 0.022, bule.sombra, z + 0.052, { contorno: 'leve', detalhe: 3 }));
  for (const [x, y] of [[0.06, -0.07], [0.14, 0.0], [0.06, 0.07]] as const) {
    disco(partes, x, y, 0.035, { nanquim: '#1a1814', sombra: '#8a8274', base: '#b8b0a0', meio: '#ccc4b4', luz: '#ded8ca', brilho: '#f0ece2' }, z + 0.03);
    partes.push(elipse(x, y, 0.05, 0.05, '#6a7a2a', z + 0.04, { ...O, detalhe: 3 }), elipse(x - 0.008, y - 0.008, 0.016, 0.01, '#a8b860', z + 0.041, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  return partes;
}

// ---------- Jardim e templo (Q16b) ----------

/** Torii: a viga de cima (kasagi) preta com as pontas que se abrem, a de baixo (shimaki) em vermelhão e as bases de pedra dos pilares. */
function torii(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], L = 4.4, P = 1.6;
  for (const s of [-1, 1]) { pedra(partes, r, s * P, 0, 0.36, 0.36, 0.12, 0.3); disco(partes, s * P, 0, 0.21, VERMELHAO, 0.3); partes.push(tira(anel(s * P, 0, 0.2, 0.2, 20), 0.05, LACA_PRETA.base, 0.305, { ...O, detalhe: 2 })); }
  // Contorno das vigas: corpo reto que se abre nas pontas (sorimashi).
  const viga = (w: number, abre: number, comp: number): number[] => {
    const pts: number[] = [], n = 16;
    for (let k = 0; k <= n; k++) { const u = -comp / 2 + (k / n) * comp, t = Math.pow(Math.abs(u) / (comp / 2), 4); pts.push(u, -(w / 2 + abre * t)); }
    for (let k = n; k >= 0; k--) { const u = -comp / 2 + (k / n) * comp, t = Math.pow(Math.abs(u) / (comp / 2), 4); pts.push(u, w / 2 + abre * t * 0.6); }
    return pts;
  };
  // A trave de baixo (nuki) aparece só nas pontas, além dos pilares.
  for (const s of [-1, 1]) partes.push(poli(retQ(ID, s * (P + 0.32), 0, 0.3, 0.22), VERMELHAO.nanquim, 1.0, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, s * (P + 0.31), -0.01, 0.26, 0.17), VERMELHAO.meio, 1.003, { ...O, detalhe: 2 }));
  partes.push(poli(viga(0.62, 0.05, L).map((v, i) => v + (i % 2 ? 0.03 : 0.02)), VERMELHAO.nanquim, 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(viga(0.58, 0.05, L - 0.04), VERMELHAO.base, 1.403, { ...O, detalhe: 1 }));
  partes.push(poli(viga(0.58, 0.05, L - 0.04).map((v, i) => (i % 2 ? Math.min(v, -0.12) : v)), VERMELHAO.luz, 1.405, { ...O, detalhe: 2 }));
  partes.push(poli(viga(0.44, 0.1, L + 0.2).map((v, i) => v + (i % 2 ? 0.02 : 0.015)), VERMELHAO.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  partes.push(poli(viga(0.42, 0.1, L + 0.18), VERMELHAO.meio, 1.453, { ...O, detalhe: 1 }));
  partes.push(tira([-(L + 0.1) / 2, -0.1, 0, -0.08, (L + 0.1) / 2, -0.1], 0.1, VERMELHAO.luz, 1.455, { ...O, detalhe: 2 }));
  partes.push(tira([-(L + 0.1) / 2, -0.05, 0, -0.03, (L + 0.1) / 2, -0.05], 0.025, VERMELHAO.brilho, 1.456, { ...O, alfa: 0.6, detalhe: 3 }));
  // As pontas da viga, cobertas de cobre escuro (as tampas pretas que leem de longe).
  const contorno = viga(0.42, 0.1, L + 0.18), corte = (L + 0.18) / 2 - 0.34;
  for (const s of [-1, 1]) { const pts: number[] = []; for (let i = 0; i < contorno.length; i += 2) if (contorno[i]! * s >= corte) pts.push(contorno[i]!, contorno[i + 1]!); partes.push(poli(pts, LACA_PRETA.base, 1.457, { ...O, detalhe: 2 })); }
  // A placa (gakuzuka) com o nome, no meio, presa na trave e vista de cima por trás da viga.
  partes.push(poli(retQ(ID, 0, 0.36, 0.34, 0.12), LACA_PRETA.nanquim, 1.1, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0, 0.36, 0.3, 0.08), DOURADO, 1.103, { ...O, detalhe: 3 }));
  return partes;
}

/** Lanterna de pedra (tōrō): o chapéu sextavado com as pontas enroladas, a joia no alto, musgo e, acesa, o clarão em volta. */
function lanternaDePedra(seed: number, acesa: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.5, z = 1.35, giro = Math.PI / 6;
  if (acesa) halo(partes, 0, 0, 0.7, '#6a3006', 0.32);
  const v = (k: number, rr = R): [number, number] => { const a = giro + (k / 6) * Math.PI * 2; return [Math.cos(a) * rr, Math.sin(a) * rr]; };
  sombraNoChao(partes, Array.from({ length: 6 }, (_, k) => v(k, 0.42)).flat(), 0.02, '#0d0a08', 0.4);
  partes.push(poli(Array.from({ length: 6 }, (_, k) => v(k, R + 0.04)).flat().map((p, i) => p + (i % 2 ? 0.025 : 0.02)), PEDRA.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let k = 0; k < 6; k++) {
    const [ax, ay] = v(k), [bx, by] = v(k + 1), am = giro + ((k + 0.5) / 6) * Math.PI * 2;
    partes.push(poli([0, 0, ax, ay, bx, by], tomDaFace(PEDRA, olhar(am)), z + 0.004, { ...O, detalhe: 1 }));
    partes.push(tira([0, 0, ax * 0.98, ay * 0.98], 0.012, PEDRA.nanquim, z + 0.006, { ...O, alfa: 0.4, detalhe: 3 }));
  }
  for (let k = 0; k < 6; k++) { const [x, y] = v(k, R + 0.02), a = giro + (k / 6) * Math.PI * 2; disco(partes, x, y, 0.055, PEDRA, z + 0.01); partes.push(tira(arco(x, y, 0.035, 0.035, a, a + 4.5, 8), 0.01, PEDRA.nanquim, z + 0.03, { ...O, alfa: 0.7, detalhe: 3 })); }
  for (let k = 0; k < 4; k++) { const a = 0.4 + r() * 1.4, d = 0.2 + r() * 0.2; partes.push(poli(bolha(Math.cos(a) * d, Math.sin(a) * d, 0.1 + r() * 0.06, 0.07, 9, 0.3, r), MUSGO, z + 0.008, { ...S, alfa: 0.75, detalhe: 2 })); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.28; partes.push(lente(Math.cos(a) * 0.04, Math.sin(a) * 0.04, a, 0.12, 0.07, tom(PEDRA.base, olhar(a) * 0.3), z + 0.06, { contorno: 'leve', detalhe: 3 })); }
  disco(partes, 0, 0, 0.075, PEDRA, z + 0.1);
  partes.push(elipse(LUZ_X * 0.02, LUZ_Y * 0.02, 0.03, 0.03, PEDRA.brilho, z + 0.12, { ...O, detalhe: 3 }));
  return partes;
}

/** Ponte arqueada (taikobashi): o tabuado que sobe e desce (claro do lado da luz), os apoios de pedra e os guarda-corpos em vermelhão com os remates de bronze. */
function ponteArqueada(seed: number, vao: number): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], L = vao + 1.2, D = 1.4, Y = D / 2 + 0.13;
  for (const s of [-1, 1]) { bloco(partes, quadro(s * (L / 2 - 0.25), 0), 0.5, D + 0.7, PEDRA, 0.15, 0.06); desgaste(partes, r, quadro(s * (L / 2 - 0.25), 0), 0.5, D + 0.7, PEDRA, 0.15, 2); }
  partes.push(poli(retQ(ID, 0, 0, L - 0.4, D + 0.06), HINOKI.nanquim, 0.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (let u = -L / 2 + 0.3; u < L / 2 - 0.3; u += 0.18) {
    const c = (u + 0.09) / (L / 2), k = -c * 0.24 + (r() - 0.5) * 0.06 + 0.04, z = 0.5 + (1 - c * c) * 0.3;
    partes.push(poli(retQ(ID, u + 0.09, 0, 0.165, D), tom(HINOKI.base, k), z, { ...O, detalhe: 1 }));
    partes.push(tira([u + 0.172, -D / 2, u + 0.172, D / 2], 0.012, HINOKI.nanquim, z + 0.002, { ...O, alfa: 0.6, detalhe: 3 }));
    if (r() < 0.3) partes.push(tira([u + 0.04, -D / 2 + 0.1 + r() * 0.4, u + 0.14, -D / 2 + 0.2 + r() * 0.8], 0.006, HINOKI.sombra, z + 0.003, { ...O, alfa: 0.5, detalhe: 3 }));
  }
  const n = Math.max(2, Math.round((L - 0.6) / 1.5)), passo = (L - 0.6) / n;
  for (const s of [-1, 1]) {
    const y = s * Y;
    partes.push(tira([-L / 2 + 0.3, y, L / 2 - 0.3, y], 0.11, VERMELHAO.nanquim, 1.1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-L / 2 + 0.3, y, L / 2 - 0.3, y], 0.08, VERMELHAO.base, 1.103, { ...O, detalhe: 1 }), tira([-L / 2 + 0.3, y - 0.02, L / 2 - 0.3, y - 0.02], 0.025, VERMELHAO.luz, 1.105, { ...O, detalhe: 2 }));
    for (let i = 0; i <= n; i++) {
      const x = -L / 2 + 0.3 + i * passo, ponta = i === 0 || i === n;
      disco(partes, x, y, ponta ? 0.1 : 0.075, VERMELHAO, 1.12);
      if (ponta) { disco(partes, x, y, 0.08, BRONZE, 1.2); partes.push(elipse(x + LUZ_X * 0.015, y + LUZ_Y * 0.015, 0.03, 0.03, OURO.brilho, 1.25, { ...O, detalhe: 3 })); }
    }
  }
  return { pegada: [Math.round(L * 100) / 100, D + 0.7], partes };
}

/** Sino de templo (bonshō) na estrutura aberta (shōrō): quatro pilares, as vigas, o sino de bronze com pátina e o tronco de bater pendurado por cordas. */
function sinoDeTemplo(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], A = 1.2, bx = -0.3;
  sombraNoChao(partes, [-A - 0.15, -A - 0.15, A + 0.15, -A - 0.15, A + 0.15, A + 0.15, -A - 0.15, A + 0.15], 0.01, '#0d0a08', 0.3);
  bloco(partes, ID, 2 * A + 0.5, 2 * A + 0.5, PEDRA, 0.12, 0.08);
  // O sino, visto de cima: a coroa abaulada, a boca que se abre e a pátina.
  disco(partes, bx, 0, 0.55, BRONZE, 1.0);
  partes.push(tira(anel(bx, 0, 0.53, 0.53, 32), 0.04, BRONZE.sombra, 1.02, { ...O, alfa: 0.8, detalhe: 2 }), tira(anel(bx, 0, 0.36, 0.36, 28), 0.02, BRONZE.nanquim, 1.025, { ...O, alfa: 0.5, detalhe: 3 }));
  for (let k = 0; k < 9; k++) { const a = r() * 6.28, d = 0.15 + r() * 0.35; partes.push(poli(bolha(bx + Math.cos(a) * d, Math.sin(a) * d, 0.07 + r() * 0.06, 0.05, 8, 0.3, r), PATINA, 1.03, { ...S, alfa: 0.55, detalhe: 2 })); }
  // O tronco de bater (shumoku), apontado para o sino, com as duas cordas.
  const t0 = bx + 0.62, t1 = A - 0.05;
  partes.push(tira([t0, 0, t1, 0], 0.22, HINOKI.nanquim, 1.1, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([t0, 0, t1, 0], 0.18, HINOKI.base, 1.103, { ...O, detalhe: 1 }), tira([t0, -0.04, t1, -0.04], 0.06, HINOKI.luz, 1.105, { ...O, detalhe: 2 }));
  partes.push(elipse(t0, 0, 0.05, 0.18, HINOKI.sombra, 1.106, { contorno: 'leve', detalhe: 2 }));
  for (const u of [t0 + 0.15, t1 - 0.15]) partes.push(tira([u, -0.1, u, 0.1], 0.03, '#d8c8a0', 1.11, { contorno: 'leve', detalhe: 3 }), elipse(u, 0, 0.05, 0.05, '#c8b890', 1.112, { contorno: 'leve', detalhe: 3 }));
  // Pilares, as vigas de cima nos lados e a viga do sino.
  for (const [x, y] of [[-A, -A], [A, -A], [A, A], [-A, A]] as const) bloco(partes, quadro(x, y), 0.24, 0.24, HINOKI, 1.4, 0.03);
  for (const s of [-1, 1]) bloco(partes, quadro(0, s * A), 2 * A + 0.3, 0.18, HINOKI, 1.45, 0.025);
  bloco(partes, quadro(bx, 0, Math.PI / 2), 2 * A, 0.2, HINOKI, 1.48, 0.025, Math.PI / 2);
  partes.push(elipse(bx, 0, 0.12, 0.22, BRONZE.base, 1.49, { contorno: 'leve', detalhe: 2 }));
  return partes;
}

/** Incensário (jōkōro): o pedestal de pedra, a bacia de bronze com cinza e varetas acesas, o telhado da tampa e a fumaça. */
function incensario(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  bloco(partes, ID, 1.2, 1.2, PEDRA, 0.3, 0.08);
  for (const s of [-1, 1]) { bloco(partes, quadro(s * 0.46, 0), 0.12, 0.2, BRONZE, 0.85, 0.02); }
  disco(partes, 0, 0, 0.42, BRONZE, 0.8);
  partes.push(elipse(0, 0, 0.72, 0.72, '#7a746a', 0.83, { ...O, detalhe: 1 }), elipse(LUZ_X * 0.05, LUZ_Y * 0.05, 0.5, 0.5, '#948e84', 0.832, { ...S, detalhe: 2 }));
  for (let k = 0; k < 7; k++) partes.push(poli(bolha(Math.cos(k) * 0.33, Math.sin(k) * 0.33, 0.07, 0.04, 8, 0.3, r), PATINA, 0.82, { ...S, alfa: 0.6, detalhe: 3 }));
  for (let k = 0; k < 16; k++) {
    const a = r() * 6.28, d = 0.26 + r() * 0.07, x = Math.cos(a) * d, y = Math.sin(a) * d, b = a + (r() - 0.5) * 0.8;
    partes.push(tira([x, y, x + Math.cos(b) * 0.06, y + Math.sin(b) * 0.06], 0.008, '#6a4a2a', 0.84, { ...O, detalhe: 3 }), elipse(x + Math.cos(b) * 0.06, y + Math.sin(b) * 0.06, 0.016, 0.016, '#b0400c', 0.842, { ...O, brilho: true, detalhe: 3 }));
  }
  // O telhado da tampa: quatro águas com as faces na luz, as pontas viradas e a joia.
  const T = 0.3;
  partes.push(poli([-T - 0.03, -T - 0.03, T + 0.05, -T - 0.03, T + 0.05, T + 0.05, -T - 0.03, T + 0.05], BRONZE.nanquim, 1.2, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  const faces: [number[], number][] = [[[-T, -T, T, -T, 0, 0], -Math.PI / 2], [[T, -T, T, T, 0, 0], 0], [[T, T, -T, T, 0, 0], Math.PI / 2], [[-T, T, -T, -T, 0, 0], Math.PI]];
  for (const [pts, n] of faces) partes.push(poli(pts, tomDaFace(BRONZE, olhar(n)), 1.205, { ...O, detalhe: 1 }));
  for (const [x, y] of [[-T, -T], [T, -T], [T, T], [-T, T]] as const) partes.push(tira([x * 0.2, y * 0.2, x * 1.1, y * 1.1], 0.02, BRONZE.brilho, 1.21, { ...O, alfa: 0.6, detalhe: 3 }), elipse(x * 1.12, y * 1.12, 0.05, 0.05, BRONZE.luz, 1.212, { contorno: 'leve', detalhe: 3 }));
  disco(partes, 0, 0, 0.06, OURO, 1.25);
  // A fumaça que sobe e deriva.
  for (let k = 0; k < 4; k++) {
    const a = r() * 6.28, pts: number[] = [];
    let x = Math.cos(a) * 0.32, y = Math.sin(a) * 0.32;
    for (let j = 0; j < 6; j++) { pts.push(x, y); x += 0.08 + Math.sin(j * 1.3 + k) * 0.07; y += -0.06 + Math.cos(j * 1.1 + k) * 0.05; }
    partes.push(tira(pts, 0.1, '#d8d4cc', 1.45, { ...S, alfa: 0.18, desfoque: 0.04, detalhe: 2 }, 0.3));
  }
  return partes;
}

/** Guardião de pedra (komainu) sentado de frente (+y), em pedestal: juba de cachos, cauda em chama atrás; `boca` aberta (a) ou fechada com chifre (un). */
function komainu(partes: Parte[], r: () => number, cx: number, boca: boolean, s: number): void {
  const t: Tons = { ...PEDRA, base: '#7e7d74', meio: '#929188', luz: '#aaa99e' };
  bloco(partes, quadro(cx, 0), 0.9, 0.9, PEDRA, 0.45, 0.07);
  desgaste(partes, r, quadro(cx, 0), 0.9, 0.9, PEDRA, 0.45, 2);
  // Cauda: chamas enroladas atrás.
  for (let k = 0; k < 3; k++) { const x = cx + s * (k - 1) * 0.1, y = -0.28 - (k === 1 ? 0.04 : 0); disco(partes, x, y, 0.08, t, 0.85); partes.push(tira(arco(x, y, 0.05, 0.05, 0, 4.5 * s, 8), 0.012, t.nanquim, 0.87, { ...O, alfa: 0.6, detalhe: 3 })); }
  disco(partes, cx, -0.1, 0.25, t, 0.9, 0.2);
  for (const k of [-1, 1]) disco(partes, cx + k * 0.12, 0.28, 0.065, t, 0.6);
  disco(partes, cx, 0.06, 0.2, t, 1.0);
  // Juba de cachos em volta da cabeça.
  for (let k = 0; k < 11; k++) { const a = (k / 11) * 6.28; disco(partes, cx + Math.cos(a) * 0.14, 0.1 + Math.sin(a) * 0.13, 0.05, t, 1.15); }
  disco(partes, cx, 0.12, 0.12, t, 1.25);
  partes.push(elipse(cx, 0.22, 0.13, 0.08, t.meio, 1.28, { contorno: 'leve', detalhe: 2 }));
  for (const k of [-1, 1]) partes.push(elipse(cx + k * 0.05, 0.17, 0.035, 0.03, t.nanquim, 1.29, { ...O, detalhe: 3 }));
  if (boca) partes.push(elipse(cx, 0.25, 0.09, 0.04, '#141414', 1.3, { contorno: 'leve', detalhe: 2 }), ret(cx, 0.235, 0.06, 0.012, '#d8d4c8', 1.305, { ...O, detalhe: 3 }));
  else { partes.push(tira([cx - 0.05, 0.25, cx + 0.05, 0.25], 0.01, t.nanquim, 1.3, { ...O, detalhe: 3 })); disco(partes, cx, 0.04, 0.035, t, 1.32); }
  for (let k = 0; k < 3; k++) partes.push(poli(bolha(cx + (r() - 0.3) * 0.5, (r() - 0.3) * 0.5, 0.08, 0.06, 8, 0.3, r), MUSGO, 0.47, { ...S, alfa: 0.6, detalhe: 3 }));
}

/** Estátua sentada (Buda em meditação) sobre o lótus: pétalas em dois anéis, pernas cruzadas, mãos no colo, cabeça de cachos com o coque, e a auréola atrás. */
function estatuaSentada(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], bronze = r() < 0.6, t = bronze ? BRONZE : PEDRA;
  sombraNoChao(partes, bolha(0, 0, 1.05, 1.05, 16, 0.03, r), 0.02, '#0d0a08', 0.45);
  const oct = Array.from({ length: 8 }, (_, k) => { const a = Math.PI / 8 + (k / 8) * Math.PI * 2; return [Math.cos(a) * 1.05, Math.sin(a) * 1.05]; }).flat();
  partes.push(poli(oct.map((v, i) => v + (i % 2 ? 0.03 : 0.025)), PEDRA.nanquim, 0.25, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(oct, PEDRA.base, 0.253, { ...O, detalhe: 1 }), poli(oct.map(v => v * 0.9), PEDRA.meio, 0.255, { ...O, detalhe: 1 }));
  // O lótus: uma coroa de pétalas curtas em volta de um assento redondo e liso.
  for (const [anelR, n, z, off] of [[0.92, 16, 0.5, 0], [0.8, 16, 0.55, 0.5]] as const) for (let k = 0; k < n; k++) {
    const a = ((k + off) / n) * Math.PI * 2, x = Math.cos(a) * (anelR - 0.36), y = Math.sin(a) * (anelR - 0.36);
    partes.push(lente(x, y, a, 0.36, 0.3, t.nanquim, z, { contorno: 'leve', detalhe: 1 }), lente(x, y, a, 0.33, 0.24, tom(t.base, olhar(a) * 0.3), z + 0.003, { ...O, detalhe: 2 }), lente(x + Math.cos(a) * 0.04, y + Math.sin(a) * 0.04, a, 0.22, 0.05, tom(t.base, olhar(a) * 0.3 + 0.15), z + 0.005, { ...O, alfa: 0.6, detalhe: 3 }));
  }
  disco(partes, 0, 0, 0.6, t, 0.6);
  // A figura: joelhos abertos dos dois lados, o manto caído entre eles, as mãos no colo, o tronco e os ombros.
  for (const k of [-1, 1]) disco(partes, k * 0.36, 0.2, 0.19, t, 0.9, 0.16);
  partes.push(poli([-0.36, 0.08, 0.36, 0.08, 0.3, 0.36, 0, 0.42, -0.3, 0.36], tom(t.base, -0.05), 0.92, { contorno: 'leve', detalhe: 1 }));
  for (let k = 0; k < 3; k++) partes.push(tira([-0.22 + k * 0.03, 0.14 + k * 0.08, 0, 0.2 + k * 0.08, 0.22 - k * 0.03, 0.14 + k * 0.08], 0.014, t.sombra, 0.925, { ...O, alfa: 0.6, detalhe: 3 }));
  disco(partes, 0, 0.17, 0.11, t, 0.96, 0.07);
  partes.push(tira(anel(0, 0.17, 0.04, 0.025, 12), 0.012, t.nanquim, 0.97, { ...O, alfa: 0.7, detalhe: 3 }));
  // O tronco: costas largas atrás (−y), cintura estreita no colo, e o manto que cruza do ombro esquerdo.
  const tronco = [-0.34, -0.2, -0.2, -0.3, 0.2, -0.3, 0.34, -0.2, 0.3, -0.02, 0.16, 0.1, -0.16, 0.1, -0.3, -0.02];
  partes.push(poli(tronco.map((v, i) => v + (i % 2 ? 0.025 : 0.02)), t.nanquim, 1.0, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(tronco, t.base, 1.003, { ...O, detalhe: 1 }));
  partes.push(poli([-0.3, -0.2, -0.18, -0.27, 0.05, -0.27, 0.0, 0.05, -0.14, 0.08, -0.26, -0.02], t.meio, 1.005, { ...S, detalhe: 2 }), poli([-0.27, -0.2, -0.17, -0.25, -0.05, -0.25, -0.12, -0.05, -0.22, -0.06], t.luz, 1.007, { ...S, alfa: 0.8, detalhe: 3 }));
  partes.push(tira([-0.3, -0.2, -0.05, -0.05, 0.2, 0.08], 0.022, t.sombra, 1.01, { ...O, alfa: 0.7, detalhe: 3 }, 0.4));
  // Os braços: dos ombros descem pelos lados até as mãos no colo.
  for (const k of [-1, 1]) {
    const braco = [k * 0.33, -0.18, k * 0.36, 0.0, k * 0.24, 0.13, k * 0.1, 0.17];
    partes.push(tira(braco, 0.13, t.nanquim, 1.02, { contorno: 'leve', detalhe: 1 }, 0.7), tira(braco, 0.1, k < 0 ? t.meio : t.base, 1.023, { ...O, detalhe: 2 }, 0.7));
  }
  disco(partes, 0, 0.17, 0.1, t, 1.03, 0.065);
  // A cabeça, inclinada sobre o peito, com o coque e os cachos em relevo baixo; as orelhas compridas dos lados.
  for (const k of [-1, 1]) partes.push(lente(k * 0.15, -0.1, Math.PI / 2, 0.13, 0.05, tom(t.base, k < 0 ? 0.15 : -0.2), 1.2, { contorno: 'leve', detalhe: 3 }));
  disco(partes, 0, -0.1, 0.15, t, 1.25);
  for (let k = 0; k < 14; k++) { const a = (k / 14) * 6.28, rr = k % 2 ? 0.1 : 0.07; partes.push(elipse(Math.cos(a) * rr, -0.1 + Math.sin(a) * rr, 0.03, 0.03, tom(t.base, olhar(a) * 0.25), 1.27, { ...O, detalhe: 3 })); }
  disco(partes, 0, -0.12, 0.06, t, 1.3);
  if (bronze) for (let k = 0; k < 8; k++) { const a = r() * 6.28, d = r() * 0.5; partes.push(poli(bolha(Math.cos(a) * d, Math.sin(a) * d * 0.8, 0.06, 0.04, 8, 0.3, r), PATINA, 1.31, { ...S, alfa: 0.45, detalhe: 3 })); }
  return partes;
}

/** Uma carpa (koi) nadando, com a sombra no fundo, as nadadeiras, a cauda em leque e as manchas do padrão. */
function carpa(partes: Parte[], r: () => number, x: number, y: number, ang: number, L: number, z: number): void {
  const padroes: [string, string[]][] = [['#ece6dc', ['#c83a1a', '#d84a22']], ['#141414', ['#c83a1a', '#ece6dc']], ['#d8a030', ['#e8c060']], ['#d8641e', ['#ece6dc']], ['#c8ccd0', ['#2a3a5a']]];
  const [base, manchas] = padroes[Math.floor(r() * padroes.length)]!, b = (r() - 0.5) * 0.7, c = Math.cos(ang), s = Math.sin(ang);
  const P = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c], espinha: number[] = [];
  for (let k = 0; k <= 8; k++) { const t = k / 8, u = (t - 0.5) * L, v = b * L * 0.3 * (1 - t) * (1 - t); espinha.push(...P(u, v)); }
  partes.push(tira(espinha.map((p, i) => p + (i % 2 ? 0.08 : 0.06)), L * 0.3, '#06100e', z - 0.05, { ...S, alfa: 0.35, desfoque: 0.03, detalhe: 2 }, 0.3));
  const [tx, ty] = [espinha[0]!, espinha[1]!], at = ang + Math.PI + b * 0.8;
  for (const d of [-0.45, 0.45]) partes.push(lente(tx, ty, at + d, L * 0.26, L * 0.14, tom(base, 0.1), z, { ...O, alfa: 0.8, detalhe: 2 }));
  for (const d of [-1, 1]) { const [px, py] = P(L * 0.2, d * L * 0.08); partes.push(lente(px, py, ang + Math.PI + d * 2.2, L * 0.18, L * 0.1, tom(base, 0.15), z, { ...O, alfa: 0.75, detalhe: 3 })); }
  partes.push(tira(espinha, L * 0.3, tom(base, -0.4), z + 0.002, { contorno: 'leve', detalhe: 1 }, 0.3), tira(espinha, L * 0.25, base, z + 0.004, { ...O, detalhe: 1 }, 0.35));
  for (let k = 0; k < 3; k++) { const i = 2 + Math.floor(r() * 5); partes.push(elipse(espinha[i * 2]! + (r() - 0.5) * L * 0.05, espinha[i * 2 + 1]! + (r() - 0.5) * L * 0.05, L * (0.12 + r() * 0.08), L * (0.1 + r() * 0.06), manchas[k % manchas.length]!, z + 0.006, { ...O, alfa: 0.95, detalhe: 2 })); }
  partes.push(tira(espinha.slice(4, 16).map((p, i) => p + (i % 2 ? LUZ_Y : LUZ_X) * L * 0.03), L * 0.05, tom(base, 0.35), z + 0.008, { ...S, alfa: 0.5, detalhe: 3 }, 0.3));
  for (const d of [-1, 1]) { const [ox, oy] = P(L * 0.43, d * L * 0.05); partes.push(elipse(ox, oy, L * 0.03, L * 0.03, '#0a0a0a', z + 0.01, { ...O, detalhe: 3 })); }
}

function carpas(seed: number): Parte[] {
  // Os peixes se espalham num anel e apontam no sentido em que a cena gira o cardume (`animacao: 'nadar'` em render/cena.ts:
  // semente % 997 abaixo da metade gira no sentido horário da tela), então nadam para a frente enquanto rodeiam o lago.
  const r = mulberry32(seed), partes: Parte[] = [], n = 5 + Math.floor(r() * 3), giro = r() * 6.28, sentido = (seed % 997) / 997 < 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = giro + (i / n) * 6.28 + (r() - 0.5) * 0.5, d = 0.45 + r() * 0.4, x = Math.cos(a) * d * 1.15, y = Math.sin(a) * d * 0.85;
    carpa(partes, r, x, y, Math.atan2(y, x) + sentido * Math.PI / 2 + (r() - 0.5) * 0.4, 0.5 + r() * 0.22, 0.3 + i * 0.01);
  }
  return partes;
}

/** Cascalho rastelado: sulcos paralelos (cada um com a crista clara do lado da luz) e, com `circulo`, anéis em volta do centro, onde se põe uma pedra. */
function rastelado(seed: number, C: number, Lg: number, circulo: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], passo = 0.1, z = 0.004, Rmax = circulo ? Math.min(C, Lg) * 0.36 : 0;
  const sulco = (pts: number[]): void => {
    partes.push(tira(pts, 0.034, '#3e3a32', z + 0.001, { ...S, alfa: 0.42, detalhe: 2 }));
    partes.push(tira(pts.map((p, i) => p + (i % 2 ? LUZ_Y : LUZ_X) * 0.03), 0.026, '#f4efe4', z + 0.002, { ...S, alfa: 0.55, detalhe: 2 }));
  };
  for (let y = -Lg / 2 + passo * 0.75; y < Lg / 2 - passo * 0.4; y += passo) {
    const trechos: [number, number][] = [];
    if (circulo && Math.abs(y) < Rmax) { const dx = Math.sqrt(Rmax * Rmax - y * y); trechos.push([-C / 2 + 0.05, -dx], [dx, C / 2 - 0.05]); } else trechos.push([-C / 2 + 0.05, C / 2 - 0.05]);
    for (const [a, b] of trechos) {
      if (b - a < 0.08) continue;
      const pts: number[] = [], n = Math.max(2, Math.ceil((b - a) / 0.3));
      for (let k = 0; k <= n; k++) pts.push(a + (k / n) * (b - a), y + (k > 0 && k < n ? (r() - 0.5) * 0.012 : 0));
      sulco(pts);
    }
  }
  if (circulo) for (let R = 0.32; R < Rmax - passo * 0.3; R += passo) sulco(anel(0, 0, R, R, Math.max(16, Math.round(R * 40))));
  return partes;
}

/** Bacia de pedra (tsukubai): a bacia com o furo quadrado de água, a bica de bambu que pinga, a concha de bambu, as pedras em volta e o “mar” de seixos. */
function baciaDePedra(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  partes.push(poli(bolha(0, 0.05, 0.72, 0.6, 20, 0.08, r), '#3a3a36', 0.01, { ...O, detalhe: 1 }));
  for (let k = 0; k < 50; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.62; partes.push(elipse(Math.cos(a) * d, 0.05 + Math.sin(a) * d * 0.82, 0.04 + r() * 0.03, 0.03 + r() * 0.02, ['#5a5a54', '#76756c', '#3e3e3a', '#8e8d84'][k % 4]!, 0.015, { contorno: 'leve', detalhe: 3 })); }
  pedra(partes, r, 0, 0.5, 0.3, 0.17, 0.12, 0.2);
  pedra(partes, r, -0.5, 0.08, 0.2, 0.22, 0.32, 0.6);
  pedra(partes, r, 0.48, 0.16, 0.17, 0.15, 0.24, 0.6);
  // A bacia (chōzubachi), redonda, com o furo quadrado cheio de água.
  pedra(partes, r, 0, -0.14, 0.33, 0.31, 0.5, 0);
  for (let k = 0; k < 3; k++) partes.push(poli(bolha(0.12 + (r() - 0.5) * 0.2, 0.0 + r() * 0.08, 0.08, 0.05, 8, 0.3, r), MUSGO, 0.515, { ...S, alfa: 0.75, detalhe: 3 }));
  partes.push(poli(retQ(ID, 0, -0.14, 0.24, 0.24), PEDRA.nanquim, 0.52, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0.005, -0.135, 0.2, 0.2), '#1e3440', 0.522, { ...O, detalhe: 1 }));
  partes.push(tira([-0.08, -0.2, 0.04, -0.22], 0.02, '#8ab0bc', 0.524, { ...S, alfa: 0.5, detalhe: 3 }));
  for (const R of [0.03, 0.06]) partes.push(tira(anel(0.03, -0.12, R, R * 0.9, 14), 0.006, '#8ab0bc', 0.525, { ...O, alfa: 0.45, detalhe: 3 }));
  // A bica de bambu (kakei) que vem de trás e pinga no meio.
  const bica = [0.24, -0.7, 0.14, -0.4, 0.04, -0.15];
  partes.push(tira(bica, 0.06, BAMBU.nanquim, 0.7, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira(bica, 0.042, BAMBU.base, 0.703, { ...O, detalhe: 2 }), tira(bica.map((v, i) => v + (i % 2 ? -0.01 : -0.008)), 0.014, BAMBU.luz, 0.705, { ...O, detalhe: 3 }));
  for (const t of [0.3, 0.7]) partes.push(tira([0.24 - 0.2 * t - 0.03, -0.7 + 0.55 * t + 0.01, 0.24 - 0.2 * t + 0.03, -0.7 + 0.55 * t - 0.01], 0.012, BAMBU.sombra, 0.707, { ...O, detalhe: 3 }));
  partes.push(elipse(0.04, -0.15, 0.03, 0.03, '#0e1a10', 0.708, { ...O, detalhe: 3 }));
  // A concha (hishaku) deitada sobre a bacia.
  partes.push(tira([-0.28, -0.08, 0.18, -0.02], 0.018, BAMBU.luz, 0.6, { contorno: 'leve', detalhe: 2 }));
  partes.push(elipse(-0.3, -0.09, 0.09, 0.09, BAMBU.nanquim, 0.6, { contorno: 'leve', detalhe: 2 }), elipse(-0.3, -0.09, 0.07, 0.07, BAMBU.base, 0.602, { ...O, detalhe: 3 }), elipse(-0.3, -0.09, 0.05, 0.05, '#3a3418', 0.604, { ...O, detalhe: 3 }));
  return partes;
}

/** Muro de bambu (kenninji-gaki): as pontas das ripas dos dois lados, o capote de bambu em feixe, as amarras pretas e os postes. */
function muroDeBambu(seed: number, L: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  sombraNoChao(partes, [-L / 2, -0.12, L / 2, -0.12, L / 2, 0.14, -L / 2, 0.14], 0.01, '#0d0a08', 0.4);
  for (const s of [-1, 1]) for (let u = -L / 2 + 0.03; u < L / 2 - 0.02; u += 0.045) partes.push(elipse(u, s * 0.075, 0.044, 0.05, s < 0 ? BAMBU.meio : BAMBU.sombra, 1.4, { contorno: 'leve', detalhe: 2 }), elipse(u - 0.006, s * 0.075 - 0.008, 0.02, 0.02, BAMBU.luz, 1.402, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(tira([-L / 2, 0, L / 2, 0], 0.13, BAMBU.nanquim, 1.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-L / 2, 0, L / 2, 0], 0.11, BAMBU.base, 1.453, { ...O, detalhe: 1 }));
  for (const [v, c] of [[-0.035, BAMBU.luz], [0, BAMBU.meio], [0.035, BAMBU.sombra]] as const) partes.push(tira([-L / 2, v, L / 2, v], 0.025, c, 1.455, { ...O, detalhe: 2 }));
  for (let u = -L / 2 + 0.2; u < L / 2 - 0.1; u += 0.3) {
    partes.push(tira([u, -0.09, u + 0.015, 0.09], 0.024, '#1a1410', 1.46, { contorno: 'leve', detalhe: 2 }), elipse(u + 0.008, 0.095, 0.035, 0.03, '#1a1410', 1.462, { ...O, detalhe: 3 }));
    if (r() < 0.3) partes.push(elipse(u + 0.15, (r() - 0.5) * 0.06, 0.04, 0.03, BAMBU.sombra, 1.457, { ...O, alfa: 0.6, detalhe: 3 }));
  }
  const n = Math.max(1, Math.ceil(L / 1.8)), passo = L / n;
  for (let i = 0; i <= n; i++) { const u = -L / 2 + i * passo; disco(partes, Math.max(-L / 2 + 0.06, Math.min(L / 2 - 0.06, u)), 0, 0.07, BAMBU, 1.5); partes.push(elipse(Math.max(-L / 2 + 0.06, Math.min(L / 2 - 0.06, u)), 0, 0.07, 0.07, BAMBU.nanquim, 1.51, { ...O, detalhe: 3 })); }
  return partes;
}

/** Portão de madeira com telhado (munamon): as duas águas de telha curva em fiadas, as pontas redondas no beiral, a cumeeira e os remates (onigawara). */
function portaoDeMadeira(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 3.0, D = 1.7;
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2, -W / 2, D / 2], 0.02, '#0d0a08', 0.35);
  for (const s of [-1, 1]) bloco(partes, quadro(s * 1.1, 0), 0.3, 0.3, HINOKI, 0.1, 0.04);
  partes.push(poli(retQ(ID, 0.03, 0.035, W + 0.06, D + 0.06), TELHA.nanquim, 1.3, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  for (const s of [-1, 1]) {
    const base = tomDaFace(TELHA, olhar(s * Math.PI / 2)), y0 = s < 0 ? -D / 2 : 0, y1 = s < 0 ? 0 : D / 2;
    partes.push(poli([-W / 2, y0, W / 2, y0, W / 2, y1, -W / 2, y1], base, 1.32, { ...O, detalhe: 1 }));
    for (let u = -W / 2 + 0.1; u < W / 2 - 0.05; u += 0.2) {
      partes.push(tira([u, y0 + 0.02, u, y1 - 0.02], 0.022, tom(base, -0.45), 1.322, { ...O, alfa: 0.8, detalhe: 2 }));
      partes.push(tira([u + 0.1, y0 + 0.02, u + 0.1, y1 - 0.02], 0.08, tom(base, 0.12), 1.324, { ...O, detalhe: 2 }), tira([u + 0.08, y0 + 0.02, u + 0.08, y1 - 0.02], 0.02, tom(base, 0.32), 1.326, { ...O, alfa: 0.7, detalhe: 3 }));
      const ye = s * (D / 2 - 0.03); partes.push(elipse(u + 0.1, ye, 0.1, 0.07, tom(base, -0.2), 1.33, { contorno: 'leve', detalhe: 3 }), elipse(u + 0.1, ye, 0.04, 0.03, TELHA.brilho, 1.332, { ...O, alfa: 0.6, detalhe: 3 }));
    }
    for (let k = 0; k < 3; k++) partes.push(poli(bolha((r() - 0.5) * W * 0.8, s * (0.2 + r() * 0.5), 0.12, 0.06, 8, 0.3, r), MUSGO, 1.335, { ...S, alfa: 0.4, detalhe: 3 }));
  }
  bloco(partes, ID, W + 0.1, 0.26, { ...TELHA, base: '#3a4046', meio: '#464c52' }, 1.45, 0.05);
  for (const s of [-1, 1]) { bloco(partes, quadro(s * (W / 2 + 0.03), 0), 0.24, 0.4, TELHA, 1.48, 0.05); partes.push(tira(arco(s * (W / 2 + 0.03), 0, 0.06, 0.06, 0, 4.7, 10), 0.016, TELHA.nanquim, 1.5, { ...O, alfa: 0.7, detalhe: 3 })); }
  return partes;
}

// ---------- Receitas ----------

const OR = { generos: ['oriental', 'fantasia'], kit: 'oriental' };
const luzDePapel = (): LuzDeReceita => ({ preset: 'lanterna-de-papel', raio: 4, cor: '#ffb870', intensidade: 0.8, power: 'fire', flicker: 0.1 });

/** O kit oriental: casa (Q16a), jardim e templo (Q16b). */
export const RECEITAS_ORIENTAIS: Receita[] = [
  // Q16a: casa.
  { id: 'mesa-baixa', nome: 'Mesa baixa', categoria: 'mesas', tipo: 'piso', funcoes: ['sala-de-tatami', 'casa-de-cha', 'sala', 'sala-de-jantar', 'quarto'], ...OR, tags: ['mesa', 'baixa', 'chabudai', 'laca', 'tatami', 'japonesa', 'oriental'], pegada: [1.3, 0.8], altura: 0.35,
    gerar: p => piso([1.3, 0.8], mesaBaixa(p.seed)) },
  { id: 'zabuton', nome: 'Zabuton (almofada de chão)', categoria: 'assentos', tipo: 'piso', funcoes: ['sala-de-tatami', 'casa-de-cha', 'sala', 'sala-de-jantar', 'dojo', 'santuario'], ...OR, tags: ['zabuton', 'almofada', 'assento', 'chao', 'tatami', 'japonesa', 'oriental'], pegada: [0.65, 0.65], altura: 0.1,
    gerar: p => piso([0.65, 0.65], zabuton(p.seed)) },
  { id: 'futon', nome: 'Futon', categoria: 'camas', tipo: 'piso', funcoes: ['sala-de-tatami', 'quarto'], ...OR, tags: ['futon', 'cama', 'colchao', 'coberta', 'travesseiro', 'tatami', 'japonesa', 'oriental'], pegada: [1.1, 2.1], altura: 0.25,
    gerar: p => piso([1.1, 2.1], futon(p.seed)) },
  { id: 'biombo', nome: 'Biombo', categoria: 'decoracao', tipo: 'piso', funcoes: ['sala-de-tatami', 'casa-de-cha', 'quarto', 'sala', 'salao'], ...OR, tags: ['biombo', 'byobu', 'divisoria', 'pintura', 'ouro', 'japonesa', 'chinesa', 'oriental'], pegada: [2.6, 0.54], altura: 1.6,
    campos: [{ id: 'folhas', rotulo: 'Folhas', tipo: 'numero', padrao: 6, min: 2, max: 8, passo: 1 }],
    gerar: p => { const b = biombo(p.seed, Math.round(num(p, 'folhas', 6, 2, 8))); return piso(b.pegada, b.partes); } },
  { id: 'tansu', nome: 'Tansu em escada', categoria: 'armazenamento', tipo: 'piso', funcoes: ['sala-de-tatami', 'quarto', 'sala', 'cozinha', 'dojo'], ...OR, tags: ['tansu', 'comoda', 'escada', 'gavetas', 'madeira', 'ferro', 'japonesa', 'oriental'], pegada: [0.95, 1.65], altura: 1.8,
    gerar: p => piso([0.95, 1.65], tansu(p.seed)) },
  { id: 'irori', nome: 'Irori (fogo no chão)', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala-de-tatami', 'cozinha', 'sala', 'casa-de-cha'], ...OR, tags: ['irori', 'fogo', 'lareira', 'brasa', 'chaleira', 'tetsubin', 'cinza', 'japonesa', 'oriental', 'brilho', 'luz'], pegada: [1.3, 1.3], altura: 1.6,
    luz: (): LuzDeReceita => ({ raio: 3.5, cor: '#ff9448', intensidade: 0.7, power: 'fire', flicker: 0.3 }),
    gerar: p => piso([1.3, 1.3], irori(p.seed)) },
  { id: 'andon', nome: 'Andon (lâmpada de papel)', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala-de-tatami', 'quarto', 'casa-de-cha', 'sala', 'corredor', 'santuario'], ...OR, tags: ['andon', 'lampada', 'papel', 'luminaria', 'luz', 'oleo', 'japonesa', 'oriental', 'brilho'], pegada: [0.6, 0.6], altura: 0.9,
    luz: luzDePapel, gerar: p => piso([0.6, 0.6], andon(p.seed)) },
  { id: 'lanterna-de-papel', nome: 'Lanterna de papel', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala-de-tatami', 'casa-de-cha', 'corredor', 'santuario', 'jardim', 'taverna', 'mercado', 'varanda'], ...OR, tags: ['lanterna', 'chochin', 'papel', 'pendurada', 'luz', 'festival', 'japonesa', 'chinesa', 'oriental', 'brilho'], pegada: [0.6, 0.6], altura: 2.4,
    campos: [{ id: 'cor', rotulo: 'Cor (0 branca, 1 vermelha)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    luz: p => ({ ...luzDePapel(), cor: Math.round(Number(p.cor ?? 0)) === 1 ? '#ff8a5a' : '#ffb870' }),
    gerar: p => piso([0.6, 0.6], lanternaDePapel(Math.round(num(p, 'cor', 0, 0, 1)) === 1)) },
  { id: 'pergaminho-de-parede', nome: 'Pergaminho de parede', categoria: 'parede', tipo: 'parede', funcoes: ['sala-de-tatami', 'casa-de-cha', 'dojo', 'santuario', 'sala', 'quarto'], ...OR, tags: ['pergaminho', 'kakejiku', 'rolo', 'caligrafia', 'pintura', 'nanquim', 'tokonoma', 'japonesa', 'chinesa', 'oriental'], pegada: [0.62, 0.05],
    gerar: p => { const d = pergaminho(p.seed, 0.62); return parede(0.62, d.face, d.topo); } },
  { id: 'ikebana', nome: 'Ikebana', categoria: 'decoracao', tipo: 'piso', funcoes: ['sala-de-tatami', 'casa-de-cha', 'santuario', 'sala', 'salao'], ...OR, tags: ['ikebana', 'arranjo', 'flores', 'vaso', 'camelia', 'ameixeira', 'tokonoma', 'japonesa', 'oriental'], pegada: [0.9, 0.9], altura: 0.9,
    gerar: p => piso([0.9, 0.9], ikebana(p.seed)) },
  { id: 'bonsai', nome: 'Bonsai', categoria: 'decoracao', tipo: 'piso', funcoes: ['sala-de-tatami', 'casa-de-cha', 'jardim', 'varanda', 'sala'], ...OR, tags: ['bonsai', 'pinheiro', 'arvore', 'vaso', 'musgo', 'planta', 'japonesa', 'chinesa', 'oriental'], pegada: [0.7, 0.5], altura: 0.7,
    gerar: p => piso([0.7, 0.5], bonsai(p.seed)) },
  { id: 'suporte-de-espadas', nome: 'Suporte de espadas', categoria: 'decoracao', tipo: 'piso', funcoes: ['dojo', 'sala-de-tatami', 'salao', 'quartel'], ...OR, tags: ['espada', 'katana', 'wakizashi', 'suporte', 'laca', 'samurai', 'arma', 'japonesa', 'oriental'], pegada: [1.0, 0.4], altura: 0.6,
    gerar: p => piso([1.0, 0.4], suporteDeEspadas(p.seed)) },
  { id: 'armadura-oriental', nome: 'Armadura oriental', categoria: 'decoracao', tipo: 'piso', funcoes: ['dojo', 'salao', 'sala-de-tatami', 'quartel'], ...OR, tags: ['armadura', 'yoroi', 'samurai', 'elmo', 'kabuto', 'bau', 'laca', 'guerreiro', 'japonesa', 'oriental'], pegada: [0.95, 0.8], altura: 1.7,
    gerar: p => piso([0.95, 0.8], armaduraOriental(p.seed)) },
  { id: 'bule-e-xicaras.oriental', nome: 'Bule e xícaras orientais', categoria: 'cozinha', tipo: 'piso', funcoes: ['casa-de-cha', 'sala-de-tatami', 'sala', 'cozinha'], ...OR, tags: ['bule', 'cha', 'xicara', 'kyusu', 'yunomi', 'bandeja', 'mesa', 'japonesa', 'oriental'], pegada: [0.48, 0.32],
    gerar: p => piso([0.48, 0.32], buleOriental(p.seed)) },

  // Q16b: jardim e templo.
  { id: 'torii', nome: 'Torii', categoria: 'exterior', tipo: 'piso', funcoes: ['santuario', 'jardim', 'estrada', 'praca'], ...OR, tags: ['torii', 'portal', 'santuario', 'xinto', 'vermelho', 'templo', 'japonesa', 'oriental'], pegada: [4.6, 1.0], altura: 4.5,
    gerar: p => piso([4.6, 1.0], torii(p.seed)) },
  { id: 'lanterna-de-pedra', nome: 'Lanterna de pedra', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'santuario', 'casa-de-cha', 'praca', 'estrada'], ...OR, tags: ['lanterna', 'toro', 'pedra', 'granito', 'musgo', 'jardim', 'templo', 'luz', 'japonesa', 'oriental'], pegada: [1.1, 1.1], altura: 2.0,
    campos: [{ id: 'acesa', rotulo: 'Acesa (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: p => (Math.round(Number(p.acesa ?? 1)) === 1 ? { raio: 4, cor: '#ffb060', intensidade: 0.7, power: 'fire', flicker: 0.12 } : null),
    gerar: p => piso([1.1, 1.1], lanternaDePedra(p.seed, Math.round(num(p, 'acesa', 1, 0, 1)) === 1)) },
  { id: 'ponte-arqueada', nome: 'Ponte arqueada', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'santuario', 'estrada', 'agua'], ...OR, tags: ['ponte', 'arqueada', 'taikobashi', 'vermelho', 'lago', 'rio', 'jardim', 'japonesa', 'chinesa', 'oriental'], pegada: [6.2, 2.1], altura: 1.6,
    campos: [{ id: 'vao', rotulo: 'Vão (m)', tipo: 'numero', padrao: 5, min: 3, max: 10, passo: 0.5 }],
    gerar: p => { const b = ponteArqueada(p.seed, num(p, 'vao', 5, 3, 10)); return piso(b.pegada, b.partes); } },
  { id: 'sino-de-templo', nome: 'Sino de templo', categoria: 'exterior', tipo: 'piso', funcoes: ['santuario', 'templo', 'jardim', 'praca'], generos: ['oriental', 'fantasia'], kit: 'oriental', tags: ['sino', 'bonsho', 'bronze', 'templo', 'campanario', 'budista', 'japonesa', 'chinesa', 'oriental'], pegada: [2.9, 2.9], altura: 3.6,
    gerar: p => piso([2.9, 2.9], sinoDeTemplo(p.seed)) },
  { id: 'incensario', nome: 'Incensário', categoria: 'decoracao', tipo: 'piso', funcoes: ['santuario', 'templo', 'jardim', 'salao'], ...OR, tags: ['incenso', 'incensario', 'bronze', 'fumaca', 'templo', 'budista', 'oferenda', 'japonesa', 'chinesa', 'oriental'], pegada: [1.2, 1.2], altura: 1.5,
    gerar: p => piso([1.2, 1.2], incensario(p.seed)) },
  { id: 'guardiao-de-pedra', nome: 'Guardiões de pedra (par)', categoria: 'exterior', tipo: 'piso', funcoes: ['santuario', 'templo', 'jardim', 'praca', 'estrada'], ...OR, tags: ['guardiao', 'komainu', 'leao', 'cao', 'pedra', 'par', 'templo', 'estatua', 'japonesa', 'chinesa', 'oriental'], pegada: [3.9, 1.0], altura: 1.8,
    campos: [{ id: 'distancia', rotulo: 'Distância entre eles (m)', tipo: 'numero', padrao: 3, min: 1.4, max: 8, passo: 0.2 }],
    gerar: p => { const d = num(p, 'distancia', 3, 1.4, 8), r = mulberry32(p.seed), partes: Parte[] = []; sombraNoChao(partes, [-d / 2 - 0.48, -0.48, -d / 2 + 0.48, -0.48, -d / 2 + 0.48, 0.48, -d / 2 - 0.48, 0.48], 0.01, '#0d0a08', 0.4); sombraNoChao(partes, [d / 2 - 0.48, -0.48, d / 2 + 0.48, -0.48, d / 2 + 0.48, 0.48, d / 2 - 0.48, 0.48], 0.01, '#0d0a08', 0.4); komainu(partes, r, -d / 2, true, -1); komainu(partes, r, d / 2, false, 1); return piso([Math.round((d + 0.9) * 100) / 100, 1.0], partes); } },
  { id: 'estatua-sentada', nome: 'Estátua sentada (Buda)', categoria: 'decoracao', tipo: 'piso', funcoes: ['santuario', 'templo', 'jardim', 'salao'], ...OR, tags: ['estatua', 'buda', 'sentada', 'lotus', 'meditacao', 'bronze', 'pedra', 'templo', 'budista', 'oriental'], pegada: [2.2, 2.2], altura: 3.2,
    gerar: p => piso([2.2, 2.2], estatuaSentada(p.seed)) },
  { id: 'carpas', nome: 'Carpas', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'agua', 'santuario'], ...OR, submerso: true, animacao: 'nadar', tags: ['carpa', 'koi', 'peixe', 'lago', 'agua', 'submerso', 'jardim', 'japonesa', 'oriental'], pegada: [2.6, 2.0], altura: 0.05,
    gerar: p => piso([2.6, 2.0], carpas(p.seed)) },
  { id: 'rastelado', nome: 'Cascalho rastelado', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'santuario', 'casa-de-cha'], ...OR, tags: ['cascalho', 'rastelado', 'areia', 'zen', 'karesansui', 'jardim-seco', 'rasteira', 'chao', 'japonesa', 'oriental'], pegada: [3, 2], altura: 0.01,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 3, min: 1, max: 8, passo: 0.2 }, { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2, min: 1, max: 6, passo: 0.2 },
      { id: 'circulo', rotulo: 'Anéis no meio (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => { const C = num(p, 'comprimento', 3, 1, 8), L = num(p, 'largura', 2, 1, 6); return piso([C, L], rastelado(p.seed, C, L, Math.round(num(p, 'circulo', 1, 0, 1)) === 1)); } },
  { id: 'bacia-de-pedra', nome: 'Bacia de pedra (tsukubai)', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'casa-de-cha', 'santuario'], ...OR, tags: ['bacia', 'tsukubai', 'pedra', 'agua', 'bambu', 'bica', 'musgo', 'jardim', 'cha', 'japonesa', 'oriental'], pegada: [1.5, 1.5], altura: 0.7,
    gerar: p => piso([1.5, 1.5], baciaDePedra(p.seed)) },
  { id: 'muro-de-bambu', nome: 'Muro de bambu', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'casa-de-cha', 'santuario', 'varanda'], ...OR, tags: ['muro', 'cerca', 'bambu', 'kenninji', 'jardim', 'divisa', 'japonesa', 'oriental'], pegada: [3, 0.3], altura: 1.8,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 3, min: 1, max: 8, passo: 0.2 }],
    gerar: p => { const L = num(p, 'comprimento', 3, 1, 8); return piso([L, 0.3], muroDeBambu(p.seed, L)); } },
  { id: 'portao-de-madeira', nome: 'Portão de madeira com telhado', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'santuario', 'casa-de-cha', 'estrada'], ...OR, tags: ['portao', 'portal', 'telhado', 'telha', 'madeira', 'entrada', 'munamon', 'jardim', 'templo', 'japonesa', 'oriental'], pegada: [3.2, 1.8], altura: 3.4,
    gerar: p => piso([3.2, 1.8], portaoDeMadeira(p.seed)) },
];
