import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { ID, MADEIRA, O, S, anel, arco, bloco, disco, em, estofado, fruta, olhar, quadro, retQ, retR, tomDaFace, type Quadro, type Tons } from './antiguidade.ts';
import { halo, pedra } from './oriental.ts';

// Deserto (Q17): tenda e casa (Q17a). Pelo de cabra preto das tendas, lã tingida dos kilims (vermelho de
// garança, anil, ocre), latão vazado, barro cozido, palha de palmeira e adobe. As regras do acervo: nanquim por baixo da silhueta, volume
// em degraus de tom para o noroeste, `z` das partes até 1,5 m e a `altura` real na receita (para a sombra do sol).

const PELO_DE_CABRA: Tons = { nanquim: '#070504', sombra: '#14100c', base: '#221c16', meio: '#2c241c', luz: '#3c3228', brilho: '#5e5244' };
const LATAO: Tons = { nanquim: '#241806', sombra: '#6a4c16', base: '#946e26', meio: '#ad8532', luz: '#c89e46', brilho: '#ead07c' };
const BARRO: Tons = { nanquim: '#2a160a', sombra: '#7a4a2a', base: '#a2663a', meio: '#b67a48', luz: '#ca9260', brilho: '#e2b486' };
const ADOBE: Tons = { nanquim: '#2a1c10', sombra: '#806040', base: '#a88458', meio: '#ba966a', luz: '#cca87c', brilho: '#e0c49a' };
const PRATA: Tons = { nanquim: '#161618', sombra: '#5a5c62', base: '#80848a', meio: '#989ca2', luz: '#b4b8be', brilho: '#e0e4e8' };
const PALHA = '#b89a5a', CORDA = '#a8946a', CREME = '#e2d4b4';

/** Paletas de kilim: [fundo, motivo principal, claro, segundo motivo, escuro]. */
const KILIMS: readonly (readonly [string, string, string, string, string])[] = [
  ['#8e2a1c', '#2a3458', '#d8c8a0', '#c08a2e', '#1e1410'],
  ['#2a3a62', '#a83424', '#d8c8a0', '#c89a3a', '#141018'],
  ['#b07a2a', '#6a1e16', '#e0d2b0', '#2a3458', '#2a1a10'],
  ['#ddd2ba', '#1e1a16', '#8e2a1c', '#6a5a48', '#1e1a16'],
];

const losango = (f: Quadro, u: number, v: number, w: number, h: number): number[] => em(f, [u - w / 2, v, u, v - h / 2, u + w / 2, v, u, v + h / 2]);

/**
 * Kilim (tapete de tear plano) no referencial `f`, `C` ao comprido (u) e `L` através (v): borda escura com dentes, a fileira de losangos com
 * ganchos no campo, faixas de trama nas pontas e a franja. Serve ao tapete, à tenda, aos tapetes pendurados e à manta do camelo.
 */
function kilim(partes: Parte[], r: () => number, f: Quadro, C: number, L: number, pal: readonly string[], z: number, franja = true): void {
  const [fundo, p1, claro, p2, escuro] = pal as [string, string, string, string, string];
  if (franja) for (const s of [-1, 1]) for (let v = -L / 2 + 0.03; v < L / 2 - 0.02; v += 0.04) partes.push(tira(em(f, [s * C / 2, v, s * (C / 2 + 0.05 + r() * 0.03), v + (r() - 0.5) * 0.02]), 0.014, CREME, z, { ...O, alfa: 0.9, detalhe: 3 }));
  partes.push(poli(retQ(f, 0, 0, C, L), tom(fundo, -0.5), z + 0.001, { contorno: 'leve', detalhe: 1 }));
  partes.push(poli(retQ(f, 0, 0, C - 0.025, L - 0.025), fundo, z + 0.002, { ...O, detalhe: 1 }));
  // A borda: faixa escura em volta e dentes claros nos lados longos.
  const b = Math.max(0.06, Math.min(0.16, L * 0.1)), m = 0.03;
  for (const s of [-1, 1]) {
    partes.push(poli(retQ(f, 0, s * (L / 2 - m - b / 2), C - 2 * m, b), escuro, z + 0.003, { ...O, detalhe: 1 }));
    partes.push(poli(retQ(f, s * (C / 2 - m - b / 2), 0, b, L - 2 * m), escuro, z + 0.003, { ...O, detalhe: 1 }));
    const n = Math.max(3, Math.round((C - 2 * m - 2 * b) / (b * 0.9))), dw = (C - 2 * m - 2 * b) / n, vb = s * (L / 2 - m - b), vt = s * (L / 2 - m - b * 0.25);
    for (let k = 0; k < n; k++) { const u = -C / 2 + m + b + k * dw; partes.push(poli(em(f, [u + dw * 0.1, vb, u + dw * 0.9, vb, u + dw / 2, vt]), k % 2 ? claro : p2, z + 0.004, { ...O, detalhe: 2 })); }
  }
  // O campo: faixas de trama nas pontas e a fileira de losangos.
  const cu = C / 2 - m - b - 0.02, cv = L / 2 - m - b - 0.02, faixa = Math.min(0.12, cu * 0.15);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) partes.push(poli(retQ(f, s * (cu - faixa * (k + 0.5)), 0, faixa * 0.45, cv * 2), [claro, p1, p2][k]!, z + 0.004, { ...O, detalhe: 2 }));
  const campo = cu - faixa * 3 - 0.02, n = Math.max(1, Math.round((campo * 2) / (cv * 1.7)) - (r() < 0.3 ? 1 : 0)), dw = (campo * 2) / n, dh = cv * 1.75;
  for (let k = 0; k < n; k++) {
    const u = -campo + dw * (k + 0.5), cor = k % 2 ? p2 : p1;
    partes.push(poli(losango(f, u, 0, dw * 0.92, dh), escuro, z + 0.005, { ...O, detalhe: 1 }), poli(losango(f, u, 0, dw * 0.82, dh * 0.86), cor, z + 0.006, { ...O, detalhe: 1 }));
    partes.push(poli(losango(f, u, 0, dw * 0.5, dh * 0.5), claro, z + 0.007, { ...O, detalhe: 2 }), poli(losango(f, u, 0, dw * 0.3, dh * 0.3), k % 2 ? p1 : p2, z + 0.008, { ...O, detalhe: 2 }), poli(losango(f, u, 0, dw * 0.1, dh * 0.1), escuro, z + 0.009, { ...O, detalhe: 3 }));
    // Os ganchos nas quatro pontas do losango.
    for (const [du, dv] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const pu = u + du * dw * 0.41, pv = dv * dh * 0.43;
      partes.push(tira(em(f, [pu, pv, pu + (dv ? 0.04 : 0), pv + (du ? 0.04 : 0)]), 0.018, escuro, z + 0.009, { ...O, detalhe: 3 }), tira(em(f, [pu, pv, pu - (dv ? 0.04 : 0), pv - (du ? 0.04 : 0)]), 0.018, escuro, z + 0.009, { ...O, detalhe: 3 }));
    }
    if (k < n - 1) for (const s of [-1, 1]) partes.push(poli(losango(f, u + dw / 2, s * cv * 0.62, dw * 0.22, cv * 0.5), claro, z + 0.006, { ...O, detalhe: 3 }));
  }
  // A trama: linhas finas ao comprido.
  for (let v = -L / 2 + 0.06; v < L / 2 - 0.05; v += 0.09 + r() * 0.04) partes.push(tira(em(f, [-C / 2 + 0.03, v, C / 2 - 0.03, v + (r() - 0.5) * 0.01]), 0.006, '#0d0a08', z + 0.01, { ...O, alfa: 0.12, detalhe: 3 }));
}

/** Uma faixa de franja/borla pendurada: bolinha com o fio. */
const borla = (partes: Parte[], x: number, y: number, cor: string, z: number, R = 0.025): void => { partes.push(elipse(x, y, R * 2, R * 2.4, cor, z, { contorno: 'leve', detalhe: 3 })); };

/** Jarro de barro visto de cima: o bojo em volume, o ombro pintado, o gargalo e a boca (ou o pano amarrado), e as alças. */
function jarro(partes: Parte[], r: () => number, x: number, y: number, R: number, z: number, o: { tons?: Tons; pintado?: boolean; alcas?: number; pano?: string | null } = {}): void {
  const t = o.tons ?? BARRO, giro = r() * 6.28;
  disco(partes, x, y, R, t, z);
  if (o.pintado ?? true) {
    const zig: number[] = []; for (let k = 0; k <= 28; k++) { const a = (k / 28) * Math.PI * 2, rr = R * (k % 2 ? 0.62 : 0.76); zig.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    partes.push(tira(anel(x, y, R * 0.82, R * 0.82, 28), R * 0.06, '#4a1e10', z + 0.014, { ...O, alfa: 0.7, detalhe: 3 }), tira(zig, R * 0.05, '#2a120a', z + 0.015, { ...O, alfa: 0.65, detalhe: 3 }));
  }
  for (let k = 0; k < (o.alcas ?? 2); k++) {
    const a = giro + k * Math.PI, c = Math.cos(a), s = Math.sin(a);
    const pts = [x + c * R * 0.42, y + s * R * 0.42, x + c * R * 0.78, y + s * R * 0.78, x + c * R * 1.0, y + s * R * 1.0];
    partes.push(tira(pts, R * 0.2, t.nanquim, z + 0.02, { contorno: 'leve', detalhe: 2 }, 0.8), tira(pts, R * 0.11, tomDaFace(t, olhar(a)), z + 0.022, { ...O, detalhe: 3 }, 0.8));
  }
  partes.push(elipse(x, y, R * 0.86, R * 0.86, t.nanquim, z + 0.024, { contorno: 'leve', detalhe: 2 }), elipse(x + LUZ_X * R * 0.03, y + LUZ_Y * R * 0.03, R * 0.76, R * 0.76, t.luz, z + 0.026, { ...O, detalhe: 2 }));
  if (o.pano) {
    partes.push(poli(bolha(x, y, R * 0.5, R * 0.5, 10, 0.12, r), tom(o.pano, -0.5), z + 0.03, { contorno: 'leve', detalhe: 2 }), poli(bolha(x + LUZ_X * 0.01, y + LUZ_Y * 0.01, R * 0.42, R * 0.42, 10, 0.12, r), o.pano, z + 0.032, { ...O, detalhe: 2 }));
    partes.push(tira(anel(x, y, R * 0.36, R * 0.36, 16), 0.01, CORDA, z + 0.034, { ...O, detalhe: 3 }));
  } else partes.push(elipse(x, y, R * 0.5, R * 0.5, '#120a06', z + 0.03, { ...O, detalhe: 2 }), elipse(x - LUZ_X * R * 0.05, y - LUZ_Y * R * 0.05, R * 0.3, R * 0.3, '#1e2e30', z + 0.031, { ...O, alfa: 0.6, detalhe: 3 }));
}

// ---------- Tenda e casa (Q17a) ----------

/** Tenda beduína aberta (beit al-sha'ar): o teto de faixas de pelo de cabra sobre três fileiras de mastros, com os picos claros nos mastros do meio, a faixa tecida clara, a sanefa com borlas na frente aberta (+y), a parede de trás que desce, os tirantes e as estacas, e o kilim com almofadas na entrada. */
function tendaBeduina(seed: number, C: number, teto = true): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], D = 4.2, T = PELO_DE_CABRA, pal = KILIMS[Math.floor(r() * 3)]!, z = 1.4;
  const np = Math.max(2, Math.round(C / 2.3)) + 1, us: number[] = [];
  for (let i = 0; i < np; i++) us.push(-C / 2 + 0.35 + (i * (C - 0.7)) / (np - 1));
  // Tirantes e estacas, na frente, atrás e nas pontas.
  const tirante = (x0: number, y0: number, x1: number, y1: number): void => {
    partes.push(tira([x0, y0, x1, y1], 0.02, CORDA, 0.3, { ...O, alfa: 0.9, detalhe: 2 }), elipse(x1, y1, 0.07, 0.07, MADEIRA.nanquim, 0.06, { contorno: 'leve', detalhe: 2 }), elipse(x1 + LUZ_X * 0.008, y1 + LUZ_Y * 0.008, 0.045, 0.045, MADEIRA.luz, 0.062, { ...O, detalhe: 3 }));
  };
  for (const u of us) for (const s of [-1, 1]) tirante(u, s * D / 2, u + (r() - 0.5) * 0.25, s * (D / 2 + 0.7 + r() * 0.08));
  for (const s of [-1, 1]) for (const v of [-D / 4, D / 4]) tirante(s * C / 2, v, s * (C / 2 + 0.55 + r() * 0.08), v + (r() - 0.5) * 0.2);
  // A entrada: kilim estendido saindo da sombra do teto, e as almofadas.
  const kc = Math.min(C * 0.55, 3.6);
  kilim(partes, r, quadro(0, D / 2 + 0.05), kc, 1.5, pal, 0.012);
  for (let k = 0; k < 2; k++) { const u = (k ? 1 : -1) * kc * (0.22 + r() * 0.1), cor = k ? pal[1] : pal[3]; estofado(partes, quadro(u, D / 2 - 0.25, (r() - 0.5) * 0.3), 0, 0, 0, 0.55, 0.42, cor, 0.04, 0.08); }
  if (!teto) {
    // Sem o teto: o chão coberto de kilims, as almofadas encostadas na parede de trás, os mastros e as paredes de pano.
    const nk = Math.max(1, Math.round(C / 3.2)), kw = (C - 0.3) / nk;
    for (let k = 0; k < nk; k++) kilim(partes, r, quadro(-C / 2 + 0.15 + kw * (k + 0.5), -0.3, (r() - 0.5) * 0.04), kw - 0.1, D - 1.2, KILIMS[(k + 1) % 4]!, 0.014 + k * 0.012);
    for (let u = -C / 2 + 0.6; u < C / 2 - 0.5; u += 0.62) { const cor = [pal[1], pal[3], pal[0]][Math.floor(r() * 3)]!; estofado(partes, quadro(u, -D / 2 + 0.32, (r() - 0.5) * 0.1), 0, 0, 0, 0.56, 0.3, cor, 0.08, 0.06); }
    for (const v of [-D / 2 + 0.15, 0, D / 2 - 0.15]) for (const u of us) { disco(partes, u, v, 0.06, MADEIRA, 0.9); }
    partes.push(poli(retQ(ID, 0, -D / 2 - 0.02, C + 0.04, 0.14), T.nanquim, 0.8, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(ID, 0, -D / 2 - 0.02, C, 0.08), T.meio, 0.803, { ...O, detalhe: 2 }));
    for (const s2 of [-1, 1]) partes.push(poli(retQ(ID, s2 * (C / 2 + 0.02), -D / 4 - 0.1, 0.14, D / 2 + 0.2), T.nanquim, 0.8, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retQ(ID, s2 * (C / 2 + 0.02), -D / 4 - 0.1, 0.08, D / 2 + 0.16), T.meio, 0.803, { ...O, detalhe: 2 }));
    for (let u = -C / 2 + 0.15; u < C / 2; u += 0.3 + r() * 0.15) partes.push(tira([u, -D / 2 - 0.06, u + 0.01, -D / 2 + 0.03], 0.02, T.nanquim, 0.806, { ...O, alfa: 0.6, detalhe: 3 }));
    return { pegada: [Math.round((C + 1.3) * 100) / 100, D + 1.6], partes };
  }
  // A sombra do teto no chão (o sol pinta a dele; esta é a penumbra de baixo).
  sombraNoChao(partes, [-C / 2, -D / 2, C / 2, -D / 2, C / 2, D / 2, -C / 2, D / 2], 0.02, '#0d0a08', 0.55);
  // O teto: as faixas tecidas ao comprido, de tons um pouco diferentes.
  partes.push(poli(retQ(ID, 0, 0, C + 0.06, D + 0.06), T.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  const nf = Math.round(D / 0.6), fl = D / nf;
  for (let k = 0; k < nf; k++) {
    const v = -D / 2 + fl * (k + 0.5), cor = r() < 0.25 ? '#4a3c2c' : k % 2 ? T.base : '#3a3026';
    partes.push(poli(retQ(ID, 0, v, C, fl + 0.005), cor, z + 0.002, { ...O, detalhe: 1 }));
    if (k) partes.push(tira([-C / 2 + 0.02, v - fl / 2, C / 2 - 0.02, v - fl / 2], 0.014, T.nanquim, z + 0.004, { ...O, alfa: 0.7, detalhe: 3 }));
  }
  // Volume: a água de trás olha para a luz (noroeste), a da frente fica de costas; os mastros do meio levantam picos claros.
  partes.push(poli(retQ(ID, 0, -D / 4, C, D / 2), T.brilho, z + 0.006, { ...S, alfa: 0.28, detalhe: 1 }), poli(retQ(ID, 0, D / 4 + 0.2, C, D / 2 - 0.4), '#000000', z + 0.006, { ...S, alfa: 0.3, detalhe: 1 }));
  for (let i = 0; i < np; i++) {
    const u = us[i]!;
    partes.push(elipse(u + LUZ_X * 0.15, -0.25, 1.6, 2.4, '#6a5a48', z + 0.008, { ...S, alfa: 0.55, desfoque: 0.35, detalhe: 2 }));
    partes.push(elipse(u + LUZ_X * 0.1, -0.15, 0.7, 0.9, '#8a7a64', z + 0.01, { ...S, alfa: 0.5, desfoque: 0.15, detalhe: 2 }));
    partes.push(elipse(u, 0, 0.16, 0.16, tom(T.brilho, 0.1), z + 0.012, { contorno: 'leve', detalhe: 3 }));
    if (i < np - 1) partes.push(elipse((u + us[i + 1]!) / 2 + 0.1, 0.4, (us[i + 1]! - u) * 0.55, 2.4, '#000000', z + 0.009, { ...S, alfa: 0.3, desfoque: 0.3, detalhe: 2 }));
  }
  // A faixa tecida clara (com zigue-zague) perto da frente.
  const fv = D / 2 - 0.45;
  partes.push(poli(retQ(ID, 0, fv, C - 0.04, 0.2), '#bcae90', z + 0.014, { ...O, detalhe: 2 }));
  const zig: number[] = []; for (let u = -C / 2 + 0.04, k = 0; u <= C / 2 - 0.04; u += 0.1, k++) zig.push(u, fv + (k % 2 ? 0.06 : -0.06));
  partes.push(tira(zig, 0.03, '#7a2418', z + 0.016, { ...O, detalhe: 3 }), tira([-C / 2 + 0.04, fv - 0.09, C / 2 - 0.04, fv - 0.09], 0.016, T.nanquim, z + 0.016, { ...O, detalhe: 3 }), tira([-C / 2 + 0.04, fv + 0.09, C / 2 - 0.04, fv + 0.09], 0.016, T.nanquim, z + 0.016, { ...O, detalhe: 3 }));
  // Remendos.
  for (let k = 0; k < 1 + Math.floor(r() * 2); k++) {
    const f = quadro((r() - 0.5) * C * 0.7, -D / 2 + 0.4 + r() * (D - 1.4), (r() - 0.5) * 0.3), w = 0.4 + r() * 0.3, h = 0.3 + r() * 0.2;
    partes.push(poli(retQ(f, 0, 0, w, h), '#3e3024', z + 0.017, { ...O, detalhe: 2 }), tira(em(f, [-w / 2, -h / 2, w / 2, -h / 2, w / 2, h / 2, -w / 2, h / 2, -w / 2, -h / 2]), 0.01, '#8a7a5a', z + 0.018, { ...O, alfa: 0.5, detalhe: 3 }));
  }
  // A sanefa da frente: ondas entre os mastros e as borlas coloridas.
  const sanefa: number[] = [-C / 2, D / 2];
  for (let i = 0; i < 24; i++) { const u = -C / 2 + ((i + 0.5) / 24) * C; sanefa.push(u, D / 2 + 0.1 + Math.sin(i * 1.3) * 0.015); }
  sanefa.push(C / 2, D / 2, C / 2, D / 2 - 0.08, -C / 2, D / 2 - 0.08);
  partes.push(poli(sanefa, T.nanquim, z + 0.02, { contorno: 'leve', detalhe: 2 }));
  for (let u = -C / 2 + 0.2, k = 0; u < C / 2 - 0.1; u += 0.32, k++) borla(partes, u, D / 2 + 0.14, [pal[1], pal[2], pal[3]][k % 3]!, z + 0.022);
  // A parede de trás que desce até o chão: a beira com as pregas.
  partes.push(poli(retQ(ID, 0, -D / 2 - 0.04, C + 0.04, 0.1), T.sombra, z + 0.021, { ...O, detalhe: 2 }));
  for (let u = -C / 2 + 0.15; u < C / 2; u += 0.3 + r() * 0.15) partes.push(tira([u, -D / 2 - 0.08, u + 0.02, -D / 2 + 0.02], 0.025, T.nanquim, z + 0.022, { ...O, alfa: 0.6, detalhe: 3 }));
  return { pegada: [Math.round((C + 1.3) * 100) / 100, D + 1.6], partes };
}

/** Tapete de chão (kilim) no tamanho pedido, em uma das famílias de cor, com o desgaste da semente. */
function tapeteDeChao(seed: number, C: number, L: number, cor: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], base = KILIMS[cor]!, pal = r() < 0.5 ? base : [base[0], base[3], base[2], base[1], base[4]];
  kilim(partes, r, ID, C, L, pal, 0.01);
  for (let k = 0; k < 2; k++) partes.push(poli(bolha((r() - 0.5) * C * 0.6, (r() - 0.5) * L * 0.5, C * 0.12, L * 0.12, 10, 0.3, r), CREME, 0.022, { ...S, alfa: 0.08, detalhe: 3 }));
  return partes;
}

/** Almofadas de chão (majlis): o colchão baixo listrado, as almofadas de encosto em fila atrás (−y) com o losango e as borlas, e às vezes uma almofada solta na frente. */
function almofadas(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.0, D = 0.85, pal = KILIMS[Math.floor(r() * 4)]!, fundo = pal[0] === '#ddd2ba' ? '#7a2418' : pal[0];
  sombraNoChao(partes, [-W / 2, -D / 2, W / 2, -D / 2, W / 2, D / 2, -W / 2, D / 2], 0.01, '#0d0a08', 0.4);
  estofado(partes, ID, 0, 0, 0, W, D, fundo, 0.08, 0.06);
  for (const [v, cor, w] of [[D / 2 - 0.1, pal[2], 0.05], [D / 2 - 0.17, pal[3], 0.025], [D / 2 - 0.05, pal[4], 0.02]] as const) partes.push(tira([-W / 2 + 0.05, v, W / 2 - 0.05, v], w, cor, 0.092, { ...O, alfa: 0.9, detalhe: 3 }));
  for (let u = -W / 2 + 0.12; u < W / 2 - 0.08; u += 0.16) partes.push(poli(losango(ID, u, D / 2 - 0.1, 0.06, 0.04), pal[1], 0.094, { ...O, detalhe: 3 }));
  const n = r() < 0.5 ? 3 : 4, cw = (W - 0.12) / n;
  for (let k = 0; k < n; k++) {
    const u = -W / 2 + 0.06 + cw * (k + 0.5), cor = [pal[1], pal[3], fundo, pal[1]][k]!, f = quadro(u, -D / 2 + 0.15, (r() - 0.5) * 0.08);
    estofado(partes, f, 0, 0, 0, cw - 0.05, 0.26, cor, 0.24, 0.06);
    partes.push(poli(losango(f, 0, 0, cw * 0.42, 0.16), tom(cor, 0.35), 0.255, { ...O, detalhe: 3 }), poli(losango(f, 0, 0, cw * 0.18, 0.07), pal[4], 0.256, { ...O, detalhe: 3 }));
    for (const s of [-1, 1]) { const [x, y] = f(s * (cw / 2 - 0.04), 0.13); borla(partes, x, y + 0.02, pal[2], 0.26, 0.02); }
  }
  if (r() < 0.6) { const f = quadro((r() - 0.5) * 0.8, 0.12, (r() - 0.5) * 0.7), cor = pal[3]; estofado(partes, f, 0, 0, 0, 0.42, 0.42, cor, 0.16, 0.1); partes.push(poli(losango(f, 0, 0, 0.2, 0.2), tom(cor, 0.4), 0.172, { ...O, detalhe: 3 })); for (const [u, v] of [[-0.21, -0.21], [0.21, -0.21], [0.21, 0.21], [-0.21, 0.21]] as const) { const [x, y] = f(u, v); borla(partes, x, y, pal[1], 0.175, 0.02); } }
  return partes;
}

/** Narguilé: o vaso de vidro colorido, o prato e o fornilho com as brasas que brilham, e uma ou duas mangueiras enroladas no chão com as boquilhas. */
function narguile(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], vidro = ['#2a6a5a', '#2a4a8a', '#8a2a3a', '#7a5a1a'][Math.floor(r() * 4)]!, mang = ['#3a2a4a', '#5a1e1e', '#1e3a2e'][Math.floor(r() * 3)]!;
  halo(partes, 0, 0, 0.2, '#4a1404', 0.12);
  sombraNoChao(partes, bolha(0, 0, 0.17, 0.17, 12, 0.04, r), 0.01, '#0d0a08', 0.45);
  const nh = r() < 0.5 ? 1 : 2;
  for (let h = 0; h < nh; h++) {
    const a0 = r() * 6.28 + h * 2.8, pts: number[] = [];
    for (let k = 0; k <= 14; k++) { const t = k / 14, a = a0 + t * 2.6 * (h ? -1 : 1), d = 0.12 + t * 0.26 + Math.sin(t * 9) * 0.03; pts.push(Math.cos(a) * d, Math.sin(a) * d); }
    partes.push(tira(pts, 0.038, tom(mang, -0.6), 0.04, { contorno: 'leve', detalhe: 2 }), tira(pts, 0.024, mang, 0.042, { ...O, detalhe: 2 }), tira(pts.map((v, i) => v + (i % 2 ? LUZ_Y : LUZ_X) * 0.006), 0.008, tom(mang, 0.5), 0.044, { ...O, alfa: 0.6, detalhe: 3 }));
    const n = pts.length, ex = pts[n - 2]!, ey = pts[n - 1]!, ang = Math.atan2(ey - pts[n - 3]!, ex - pts[n - 4]!);
    partes.push(lente(ex, ey, ang, 0.12, 0.035, LATAO.base, 0.05, { contorno: 'leve', detalhe: 2 }), lente(ex, ey, ang, 0.1, 0.014, LATAO.brilho, 0.052, { ...O, detalhe: 3 }));
  }
  const tv: Tons = { nanquim: tom(vidro, -0.75), sombra: tom(vidro, -0.4), base: vidro, meio: tom(vidro, 0.12), luz: tom(vidro, 0.3), brilho: tom(vidro, 0.6) };
  disco(partes, 0, 0, 0.15, tv, 0.3);
  partes.push(tira(arco(0, 0, 0.12, 0.12, Math.PI * 1.05, Math.PI * 1.45, 6), 0.018, '#ffffff', 0.32, { ...S, alfa: 0.45, detalhe: 3 }));
  disco(partes, 0, 0, 0.11, LATAO, 0.6);
  partes.push(tira(anel(0, 0, 0.09, 0.09, 20), 0.008, LATAO.sombra, 0.615, { ...O, alfa: 0.7, detalhe: 3 }));
  disco(partes, 0, 0, 0.055, BARRO, 0.7);
  partes.push(elipse(0, 0, 0.07, 0.07, '#9a948a', 0.715, { ...O, detalhe: 3 }));
  for (let k = 0; k < 3; k++) { const a = r() * 6.28; partes.push(ret(Math.cos(a) * 0.014, Math.sin(a) * 0.014, 0.024, 0.024, '#2a1a12', 0.72, { contorno: 'leve', detalhe: 3 }), ret(Math.cos(a) * 0.014, Math.sin(a) * 0.014, 0.012, 0.012, '#6a1e06', 0.722, { ...O, brilho: true, detalhe: 3 })); }
  return partes;
}

/** Mesa de latão: a bandeja redonda gravada sobre o pé dobrável de madeira, com o bule de prata, os copos de chá com hortelã e o açucareiro. */
function mesaDeLatao(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.4, z = 0.45;
  sombraNoChao(partes, bolha(0, 0, R, R, 16, 0.02, r), 0.01, '#0d0a08', 0.45);
  for (const a of [0.785, 2.356, 3.927, 5.498]) partes.push(tira([Math.cos(a) * 0.18, Math.sin(a) * 0.18, Math.cos(a) * (R + 0.03), Math.sin(a) * (R + 0.03)], 0.045, MADEIRA.nanquim, 0.2, { contorno: 'leve', detalhe: 2 }), tira([Math.cos(a) * 0.2, Math.sin(a) * 0.2, Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02)], 0.025, tomDaFace(MADEIRA, olhar(a)), 0.202, { ...O, detalhe: 3 }));
  partes.push(elipse(0.01, 0.012, R * 2 + 0.04, R * 2 + 0.04, LATAO.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(0, 0, R * 2, R * 2, LATAO.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(elipse(0, 0, R * 1.8, R * 1.8, LATAO.meio, z + 0.005, { ...O, detalhe: 1 }), tira(anel(0, 0, R * 0.95, R * 0.95, 36), 0.02, LATAO.luz, z + 0.006, { ...O, detalhe: 2 }));
  // A gravação: a estrela de oito pontas e os anéis de arabesco.
  for (const g of [0, Math.PI / 4]) { const q = quadro(0, 0, g), s = R * 0.5; partes.push(tira(em(q, [-s, -s, s, -s, s, s, -s, s, -s, -s]), 0.008, LATAO.sombra, z + 0.007, { ...O, alfa: 0.6, detalhe: 3 })); }
  for (const k of [0.78, 0.84]) partes.push(tira(anel(0, 0, R * k, R * k, 36), 0.006, LATAO.sombra, z + 0.007, { ...O, alfa: 0.55, detalhe: 3 }));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.28; partes.push(elipse(Math.cos(a) * R * 0.81, Math.sin(a) * R * 0.81, 0.02, 0.02, LATAO.sombra, z + 0.007, { ...O, alfa: 0.6, detalhe: 3 })); }
  partes.push(lente(-R * 0.6, -R * 0.2, -0.9, R * 0.8, R * 0.2, LATAO.brilho, z + 0.008, { ...S, alfa: 0.3, detalhe: 2 }));
  // O bule de prata (bico para +x) e a tampa em cone.
  const bx = 0.04 + (r() - 0.5) * 0.06, by = -0.04 + (r() - 0.5) * 0.06;
  partes.push(tira([bx + 0.07, by, bx + 0.15, by - 0.03, bx + 0.2, by - 0.07], 0.025, PRATA.sombra, z + 0.12, { contorno: 'leve', detalhe: 2 }, 0.6));
  partes.push(tira(arco(bx, by, 0.11, 0.11, Math.PI * 0.75, Math.PI * 1.25, 6), 0.02, PRATA.base, z + 0.13, { contorno: 'leve', detalhe: 2 }));
  disco(partes, bx, by, 0.085, PRATA, z + 0.14);
  disco(partes, bx, by, 0.042, PRATA, z + 0.2);
  partes.push(elipse(bx, by, 0.022, 0.022, LATAO.luz, z + 0.22, { contorno: 'leve', detalhe: 3 }));
  // Os copos de vidro com chá (âmbar) e a borda dourada, em volta.
  const n = 3 + Math.floor(r() * 4), a0 = r() * 6.28;
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * 4.6, x = Math.cos(a) * 0.27, y = Math.sin(a) * 0.27;
    partes.push(elipse(x + 0.006, y + 0.008, 0.085, 0.085, '#2a1a0a', z + 0.04, { contorno: 'leve', detalhe: 2 }), elipse(x, y, 0.075, 0.075, '#c89a3a', z + 0.042, { ...O, detalhe: 2 }), elipse(x, y, 0.06, 0.06, '#7a2e0c', z + 0.044, { ...O, vidro: true, detalhe: 2 }));
    partes.push(elipse(x + LUZ_X * 0.012, y + LUZ_Y * 0.012, 0.02, 0.014, '#f0c890', z + 0.046, { ...S, alfa: 0.7, detalhe: 3 }));
    if (r() < 0.5) partes.push(lente(x, y, r() * 6.28, 0.05, 0.022, '#4a7a3a', z + 0.048, { contorno: 'leve', detalhe: 3 }));
  }
  if (r() < 0.7) { const a = a0 + 5.3, x = Math.cos(a) * 0.24, y = Math.sin(a) * 0.24; disco(partes, x, y, 0.05, PRATA, z + 0.06); for (let k = 0; k < 4; k++) partes.push(ret(x + (r() - 0.5) * 0.04, y + (r() - 0.5) * 0.04, 0.014, 0.014, '#f4f0e4', z + 0.12, { ...O, detalhe: 3 })); }
  for (let k = 0; k < 2; k++) { const x = (r() - 0.5) * 0.3, y = 0.15 + r() * 0.1; for (let f = 0; f < 4; f++) partes.push(lente(x, y, f * 1.6 + r(), 0.045, 0.02, f % 2 ? '#3e6a2e' : '#5a8a3e', z + 0.05, { contorno: 'leve', detalhe: 3 })); }
  return partes;
}

/** Cesto de palha de palmeira: a borda trançada, a faixa tingida e o conteúdo (tâmaras, pães, novelos de lã ou o fundo vazio em espiral). */
function cesto(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.24 + r() * 0.05, z = 0.3, faixa = ['#8e2a1c', '#1e1a16', '#2a3a62', '#3e5a2e'][Math.floor(r() * 4)]!;
  sombraNoChao(partes, bolha(0, 0, R, R, 14, 0.04, r), 0.01, '#0d0a08', 0.45);
  partes.push(elipse(0.01, 0.012, R * 2 + 0.03, R * 2 + 0.03, '#2a1e0e', z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(0, 0, R * 2, R * 2, PALHA, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(elipse(0, 0, R * 1.7, R * 1.7, tom(PALHA, -0.3), z + 0.004, { ...O, detalhe: 1 }), tira(anel(0, 0, R * 0.62, R * 0.62, 28), R * 0.12, faixa, z + 0.005, { ...O, alfa: 0.85, detalhe: 2 }));
  // A borda trançada: gomos em diagonal, claros do lado da luz.
  for (let k = 0; k < 26; k++) { const a = (k / 26) * 6.28; partes.push(lente(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92, a + 2.2, R * 0.2, R * 0.09, tom(PALHA, olhar(a) * 0.25 + 0.05), z + 0.006, { ...O, detalhe: 3 })); }
  const tipo = Math.floor(r() * 4);
  if (tipo === 0) for (let k = 0; k < 26; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * R * 0.7; fruta(partes, Math.cos(a) * d, Math.sin(a) * d, 0.022, r() < 0.5 ? '#5a2a14' : '#7a3a1a', z + 0.01 + k * 0.001); }
  else if (tipo === 1) for (let k = 0; k < 3; k++) { const a = k * 2.1 + r(), x = Math.cos(a) * R * 0.33, y = Math.sin(a) * R * 0.33; disco(partes, x, y, R * 0.3, { nanquim: '#2a1608', sombra: '#7a4a20', base: '#a86a30', meio: '#bc7e3e', luz: '#d09a56', brilho: '#e8c080' }, z + 0.01 + k * 0.01); partes.push(tira([x - R * 0.12, y, x + R * 0.12, y], 0.008, '#5a3416', z + 0.05 + k * 0.01, { ...O, alfa: 0.7, detalhe: 3 })); }
  else if (tipo === 2) for (let k = 0; k < 4; k++) { const a = k * 1.6 + r(), x = Math.cos(a) * R * 0.32, y = Math.sin(a) * R * 0.32, cor = KILIMS[k % 3]![k % 2 ? 0 : 3]; disco(partes, x, y, R * 0.24, { nanquim: tom(cor, -0.7), sombra: tom(cor, -0.35), base: cor, meio: tom(cor, 0.1), luz: tom(cor, 0.25), brilho: tom(cor, 0.5) }, z + 0.01 + k * 0.01); for (let f = 0; f < 3; f++) partes.push(tira(arco(x, y, R * 0.2, R * 0.2, f + a, f + a + 1.6, 6), 0.006, tom(cor, -0.4), z + 0.05 + k * 0.01, { ...O, alfa: 0.7, detalhe: 3 })); }
  else { const pts: number[] = []; for (let k = 0; k <= 60; k++) { const a = k * 0.42, d = (k / 60) * R * 0.75; pts.push(Math.cos(a) * d, Math.sin(a) * d); } partes.push(tira(pts, 0.008, tom(PALHA, -0.55), z + 0.008, { ...O, alfa: 0.6, detalhe: 3 })); }
  return partes;
}

/** Lanterna marroquina de latão vazado: o corpo octogonal com vidros coloridos que brilham, a cúpula furada com o remate, e no chão a luz rendada das estrelinhas. */
function lanternaMarroquina(seed: number, pendurada: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], z = pendurada ? 1.4 : 0.55, R = pendurada ? 0.15 : 0.19;
  const vidros = [['#c87a18', '#a8301a'], ['#a8241a', '#c87a18'], ['#24508a', '#c87a18'], ['#1e7a4a', '#c87a18']][Math.floor(r() * 4)]!;
  halo(partes, 0, 0, 0.42, '#6a3006', 0.22);
  // A luz rendada: anéis de estrelinhas no chão, que somam luz.
  for (let k = 0; k < 3; k++) {
    const n = 8 + k * 6, rr = 0.2 + k * 0.08 + (pendurada ? 0.02 : 0), a0 = r() * 0.5;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * 6.28, x = Math.cos(a) * rr, y = Math.sin(a) * rr, cor = i % 3 === 0 && k === 1 ? vidros[0]! : '#a85a10';
      if (k === 1 && i % 2 === 0) partes.push(lente(x - 0.02, y, 0, 0.04, 0.014, cor, 0.012, { ...O, brilho: true, alfa: 0.55, detalhe: 3 }), lente(x, y - 0.02, Math.PI / 2, 0.04, 0.014, cor, 0.012, { ...O, brilho: true, alfa: 0.55, detalhe: 3 }));
      else partes.push(elipse(x, y, 0.024, 0.024, cor, 0.012, { ...O, brilho: true, alfa: 0.5, desfoque: 0.006, detalhe: 3 }));
    }
  }
  const oct = (k: number, giro = Math.PI / 8): number[] => { const p: number[] = []; for (let i = 0; i < 8; i++) { const a = giro + (i / 8) * 6.28; p.push(Math.cos(a) * k, Math.sin(a) * k); } return p; };
  if (!pendurada) for (let i = 0; i < 4; i++) { const a = Math.PI / 4 + (i / 4) * 6.28; partes.push(elipse(Math.cos(a) * (R + 0.02), Math.sin(a) * (R + 0.02), 0.05, 0.05, LATAO.base, 0.05, { contorno: 'leve', detalhe: 3 })); }
  partes.push(poli(oct(R + 0.025), LATAO.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  const fora = oct(R), dentro = oct(R * 0.66);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, cor = vidros[i % 2]!;
    const painel = [fora[i * 2]!, fora[i * 2 + 1]!, fora[j * 2]!, fora[j * 2 + 1]!, dentro[j * 2]!, dentro[j * 2 + 1]!, dentro[i * 2]!, dentro[i * 2 + 1]!];
    partes.push(poli(painel, cor, z + 0.003, { ...O, detalhe: 2 }), poli(painel, tom(cor, -0.45), z + 0.0035, { ...O, brilho: true, alfa: 0.6, detalhe: 2 }));
    partes.push(tira([dentro[i * 2]!, dentro[i * 2 + 1]!, fora[i * 2]!, fora[i * 2 + 1]!], 0.012, LATAO.base, z + 0.005, { ...O, detalhe: 3 }));
  }
  partes.push(elipse(0, 0, R * 2.1, R * 2.1, '#6a3008', z + 0.004, { ...O, brilho: true, alfa: 0.3, desfoque: 0.03, detalhe: 2 }));
  partes.push(tira([...fora, fora[0]!, fora[1]!], 0.014, LATAO.luz, z + 0.006, { ...O, detalhe: 3 }));
  // A cúpula de latão: faces no tom da luz, o domo, os furos acesos e o remate (com a argola, se pendurada).
  for (let i = 0; i < 8; i++) { const j = (i + 1) % 8, a = Math.PI / 8 + ((i + 0.5) / 8) * 6.28; partes.push(poli([0, 0, dentro[i * 2]!, dentro[i * 2 + 1]!, dentro[j * 2]!, dentro[j * 2 + 1]!], tomDaFace(LATAO, olhar(a)), z + 0.01, { ...O, detalhe: 2 })); }
  disco(partes, 0, 0, R * 0.4, LATAO, z + 0.02);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.28; partes.push(elipse(Math.cos(a) * R * 0.53, Math.sin(a) * R * 0.53, 0.014, 0.014, '#c87a20', z + 0.04, { ...O, brilho: true, detalhe: 3 })); }
  partes.push(elipse(0, 0, 0.04, 0.04, LATAO.brilho, z + 0.05, { contorno: 'leve', detalhe: 3 }));
  if (pendurada) partes.push(tira(anel(0, 0, 0.03, 0.03, 12), 0.01, LATAO.luz, z + 0.06, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Baú pintado: madeira em uma cor viva, a tampa em painéis com rosetas, as tachas e as cantoneiras de latão, e o fecho na frente (+y). */
function bauPintado(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.0, H = 0.56, z = 0.55, base = ['#7a2018', '#1e4a3a', '#24386a', '#8a5a1a'][Math.floor(r() * 4)]!;
  const t: Tons = { nanquim: tom(base, -0.8), sombra: tom(base, -0.45), base, meio: tom(base, 0.1), luz: tom(base, 0.22), brilho: tom(base, 0.45) };
  const ocre = '#c8962e', flor = ['#d8c8a0', '#c83a2a', '#e0b040'][Math.floor(r() * 3)]!;
  sombraNoChao(partes, [-W / 2, -H / 2, W / 2, -H / 2, W / 2, H / 2, -W / 2, H / 2], 0.02, '#0d0a08', 0.45);
  bloco(partes, ID, W, H, t, z, 0.035);
  const n = r() < 0.5 ? 2 : 3, pw = (W - 0.12) / n;
  for (let k = 0; k < n; k++) {
    const u = -W / 2 + 0.06 + pw * (k + 0.5), w = pw - 0.04, h = H - 0.16;
    partes.push(tira(em(ID, [u - w / 2, -h / 2, u + w / 2, -h / 2, u + w / 2, h / 2, u - w / 2, h / 2, u - w / 2, -h / 2]), 0.014, ocre, z + 0.042, { ...O, detalhe: 2 }));
    for (let p = 0; p < 8; p++) { const a = (p / 8) * 6.28; partes.push(elipse(u + Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0.05, 0.05, flor, z + 0.044, { ...O, detalhe: 3 })); }
    partes.push(elipse(u, 0, 0.05, 0.05, ocre, z + 0.046, { ...O, detalhe: 3 }), elipse(u, 0, 0.02, 0.02, t.nanquim, z + 0.047, { ...O, detalhe: 3 }));
    for (const s of [-1, 1]) for (const q of [-1, 1]) { partes.push(lente(u + s * w * 0.28, q * h * 0.3, Math.atan2(-q, -s), 0.06, 0.03, '#3e6a2e', z + 0.044, { ...O, detalhe: 3 })); partes.push(elipse(u + s * (w / 2 - 0.03), q * (h / 2 - 0.03), 0.02, 0.02, flor, z + 0.045, { ...O, detalhe: 3 })); }
  }
  for (let u = -W / 2 + 0.05; u <= W / 2 - 0.04; u += 0.075) for (const s of [-1, 1]) partes.push(elipse(u, s * (H / 2 - 0.018), 0.018, 0.018, LATAO.luz, z + 0.048, { contorno: 'leve', detalhe: 3 }));
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) { const cu = su * (W / 2 - 0.01), cv = sv * (H / 2 - 0.01); partes.push(poli([cu, cv, cu - su * 0.1, cv, cu - su * 0.1, cv - sv * 0.03, cu - su * 0.03, cv - sv * 0.03, cu - su * 0.03, cv - sv * 0.1, cu, cv - sv * 0.1], LATAO.base, z + 0.05, { contorno: 'leve', detalhe: 2 })); }
  partes.push(ret(0, H / 2 - 0.02, 0.09, 0.07, LATAO.meio, z + 0.052, { contorno: 'leve', detalhe: 2 }), tira(arco(0, H / 2 + 0.01, 0.03, 0.025, 0, Math.PI, 8), 0.01, LATAO.luz, z + 0.054, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Tear de chão (horizontal): as duas vigas presas às estacas, a urdidura esticada, o pano já tecido em kilim junto da viga da frente (+y), o liço sobre duas pedras, a vareta de cruz, o pente de bater e o novelo. */
function tearDeChao(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 1.1, L = 3.0, pal = KILIMS[Math.floor(r() * 4)]!, v1 = L / 2 - 0.14, v0 = -L / 2 + 0.14;
  sombraNoChao(partes, [-W / 2, v0, W / 2, v0, W / 2, v1, -W / 2, v1], 0.01, '#0d0a08', 0.25);
  for (const v of [v0, v1]) for (const s of [-1, 1]) {
    const x = s * (W / 2 + 0.2), y = v + (v > 0 ? 0.08 : -0.08);
    partes.push(tira([s * (W / 2 + 0.05), v, x, y], 0.016, CORDA, 0.08, { ...O, detalhe: 3 }), elipse(x, y, 0.07, 0.07, MADEIRA.nanquim, 0.1, { contorno: 'leve', detalhe: 2 }), elipse(x + LUZ_X * 0.01, y + LUZ_Y * 0.01, 0.045, 0.045, MADEIRA.luz, 0.102, { ...O, detalhe: 3 }));
  }
  // A urdidura: os fios esticados de uma viga à outra.
  for (let u = -W / 2 + 0.02; u <= W / 2 - 0.02; u += 0.028) partes.push(tira([u, v0, u + (r() - 0.5) * 0.004, v1], 0.006, CREME, 0.1, { ...O, alfa: 0.8, detalhe: 3 }));
  // O pano tecido, a partir da viga da frente.
  const tl = 0.7 + r() * 0.7;
  kilim(partes, r, quadro(0, v1 - tl / 2, Math.PI / 2), tl, W - 0.02, pal, 0.105, false);
  partes.push(tira([-W / 2, v1 - tl, W / 2, v1 - tl], 0.012, pal[4], 0.12, { ...O, alfa: 0.7, detalhe: 3 }));
  for (const v of [v0, v1]) { partes.push(tira([-W / 2 - 0.08, v, W / 2 + 0.08, v], 0.08, MADEIRA.nanquim, 0.14, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-W / 2 - 0.07, v, W / 2 + 0.07, v], 0.05, MADEIRA.base, 0.142, { ...O, detalhe: 2 }), tira([-W / 2 - 0.06, v - 0.012, W / 2 + 0.06, v - 0.012], 0.014, MADEIRA.luz, 0.144, { ...O, detalhe: 3 })); }
  // O liço sobre duas pedras e a vareta de cruz.
  const vl = v1 - tl - 0.35;
  for (const s of [-1, 1]) pedra(partes, r, s * (W / 2 + 0.06), vl, 0.09, 0.08, 0.1, 0);
  partes.push(tira([-W / 2 - 0.1, vl, W / 2 + 0.1, vl], 0.04, MADEIRA.nanquim, 0.26, { contorno: 'leve', detalhe: 1 }), tira([-W / 2 - 0.09, vl, W / 2 + 0.09, vl], 0.022, MADEIRA.luz, 0.262, { ...O, detalhe: 2 }));
  for (let u = -W / 2 + 0.03; u < W / 2; u += 0.056) partes.push(tira([u, vl - 0.02, u, vl + 0.04], 0.004, CREME, 0.264, { ...O, alfa: 0.7, detalhe: 3 }));
  const vc = vl - 0.45;
  partes.push(poli(retQ(ID, 0, vc, W + 0.12, 0.06), MADEIRA.nanquim, 0.12, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, 0, vc - 0.005, W + 0.1, 0.035), MADEIRA.meio, 0.122, { ...O, detalhe: 2 }));
  // O pente de bater, pousado no pano, e o novelo ao lado com o fio.
  const pf = quadro((r() - 0.5) * 0.3, v1 - tl * 0.5, (r() - 0.5) * 0.4);
  partes.push(poli(retR(pf, 0, -0.05, 0.12, 0.2, 0.03), MADEIRA.nanquim, 0.16, { contorno: 'leve', detalhe: 2 }), poli(retR(pf, 0, -0.05, 0.09, 0.17, 0.025), MADEIRA.luz, 0.162, { ...O, detalhe: 2 }));
  for (let k = 0; k < 6; k++) partes.push(tira(em(pf, [-0.04 + k * 0.016, 0.04, -0.04 + k * 0.016, 0.12]), 0.008, MADEIRA.base, 0.163, { contorno: 'leve', detalhe: 3 }));
  const nx = W / 2 + 0.18, ny = v1 - tl - 0.05, cor = pal[1];
  disco(partes, nx, ny, 0.09, { nanquim: tom(cor, -0.7), sombra: tom(cor, -0.35), base: cor, meio: tom(cor, 0.1), luz: tom(cor, 0.25), brilho: tom(cor, 0.5) }, 0.12);
  for (let f = 0; f < 3; f++) partes.push(tira(arco(nx, ny, 0.075, 0.075, f * 1.2, f * 1.2 + 1.8, 6), 0.006, tom(cor, -0.45), 0.2, { ...O, alfa: 0.7, detalhe: 3 }));
  partes.push(tira([nx - 0.08, ny, nx - 0.25, ny + 0.05, W / 2 - 0.05, v1 - tl + 0.02], 0.006, cor, 0.11, { ...O, detalhe: 3 }, 0.6));
  return partes;
}

// ---------- Receitas ----------

const DE = { generos: ['deserto', 'fantasia'], kit: 'deserto' };
const luzMarroquina = (pendurada: boolean): LuzDeReceita => ({ raio: pendurada ? 4.5 : 3.5, cor: '#ffa858', intensidade: 0.8, power: 'fire', flicker: 0.12 });

/** O kit do deserto: tenda e casa (Q17a). */
export const RECEITAS_DO_DESERTO: Receita[] = [
  // Q17a: tenda e casa.
  { id: 'tenda-beduina', nome: 'Tenda beduína', categoria: 'exterior', tipo: 'piso', funcoes: ['tenda', 'jardim', 'patio'], ...DE, tags: ['tenda', 'beduina', 'acampamento', 'pelo-de-cabra', 'lona', 'deserto', 'nomade', 'caravana', 'kilim'], pegada: [8.3, 5.8], altura: 2.4,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 7, min: 4, max: 12, passo: 0.5 }, { id: 'teto', rotulo: 'Teto (0 aberto por cima, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => { const t = tendaBeduina(p.seed, num(p, 'largura', 7, 4, 12), Math.round(num(p, 'teto', 1, 0, 1)) === 1); return piso(t.pegada, t.partes); } },
  { id: 'almofadas', nome: 'Almofadas de chão (majlis)', categoria: 'assentos', tipo: 'piso', funcoes: ['tenda', 'salao-de-cha', 'sala', 'quarto', 'salao'], ...DE, tags: ['almofada', 'colchao', 'majlis', 'assento', 'chao', 'kilim', 'arabe', 'deserto'], pegada: [2.0, 0.85], altura: 0.4,
    gerar: p => piso([2.0, 0.85], almofadas(p.seed)) },
  { id: 'tapete-de-chao', nome: 'Tapete de chão (kilim)', categoria: 'tapetes', tipo: 'piso', funcoes: ['tenda', 'salao-de-cha', 'sala', 'quarto', 'bazar', 'salao'], ...DE, tags: ['tapete', 'kilim', 'losango', 'la', 'tear', 'berbere', 'chao', 'deserto', 'arabe'], pegada: [2.6, 1.6], altura: 0.02,
    campos: [{ id: 'cor', rotulo: 'Cor (0 vermelho, 1 anil, 2 ocre, 3 preto e branco)', tipo: 'numero', padrao: 0, min: 0, max: 3, passo: 1 },
      { id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 2.6, min: 1.2, max: 6, passo: 0.1 }, { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 1.6, min: 0.8, max: 4, passo: 0.1 }],
    gerar: p => { const C = num(p, 'comprimento', 2.6, 1.2, 6), L = num(p, 'largura', 1.6, 0.8, 4); return piso([C, L], tapeteDeChao(p.seed, C, L, Math.round(num(p, 'cor', 0, 0, 3)))); } },
  { id: 'narguile', nome: 'Narguilé', categoria: 'decoracao', tipo: 'piso', funcoes: ['tenda', 'salao-de-cha', 'sala', 'taverna'], ...DE, tags: ['narguile', 'cachimbo', 'fumo', 'vidro', 'latao', 'brasa', 'arabe', 'deserto', 'brilho'], pegada: [0.9, 0.9], altura: 0.8,
    gerar: p => piso([0.9, 0.9], narguile(p.seed)) },
  { id: 'mesa-de-latao', nome: 'Mesa de latão com chá', categoria: 'mesas', tipo: 'piso', funcoes: ['tenda', 'salao-de-cha', 'sala', 'sala-de-jantar', 'bazar'], ...DE, tags: ['mesa', 'bandeja', 'latao', 'cha', 'hortela', 'bule', 'copos', 'baixa', 'arabe', 'marroquina', 'deserto'], pegada: [0.85, 0.85], altura: 0.7,
    gerar: p => piso([0.85, 0.85], mesaDeLatao(p.seed)) },
  { id: 'jarro-de-barro', nome: 'Jarro de barro', categoria: 'cozinha', tipo: 'piso', funcoes: ['tenda', 'cozinha', 'deposito', 'bazar', 'patio-com-fonte', 'jardim'], ...DE, tags: ['jarro', 'barro', 'cantaro', 'agua', 'terracota', 'pote', 'deserto'], pegada: [0.55, 0.55], altura: 0.7,
    gerar: p => { const r = mulberry32(p.seed), partes: Parte[] = []; sombraNoChao(partes, bolha(0, 0, 0.22, 0.22, 12, 0.04, r), 0.01, '#0d0a08', 0.45); jarro(partes, r, 0, 0, 0.2 + r() * 0.04, 0.55, { alcas: r() < 0.5 ? 2 : 1 }); return piso([0.55, 0.55], partes); } },
  { id: 'cesto', nome: 'Cesto de palha', categoria: 'cozinha', tipo: 'piso', funcoes: ['tenda', 'cozinha', 'deposito', 'bazar', 'mercado'], ...DE, tags: ['cesto', 'palha', 'palmeira', 'tamaras', 'pao', 'la', 'trancado', 'deserto'], pegada: [0.6, 0.6], altura: 0.4,
    gerar: p => piso([0.6, 0.6], cesto(p.seed)) },
  { id: 'lanterna-marroquina', nome: 'Lanterna marroquina', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['tenda', 'salao-de-cha', 'bazar', 'sala', 'corredor', 'patio-com-fonte', 'varanda'], ...DE, tags: ['lanterna', 'latao', 'vazada', 'vidro', 'colorida', 'marroquina', 'arabe', 'luz', 'pendurada', 'deserto', 'brilho'], pegada: [1.0, 1.0], altura: 2.2,
    campos: [{ id: 'pendurada', rotulo: 'Pendurada (0 no chão, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    luz: p => luzMarroquina(Math.round(Number(p.pendurada ?? 1)) === 1),
    gerar: p => piso([1.0, 1.0], lanternaMarroquina(p.seed, Math.round(num(p, 'pendurada', 1, 0, 1)) === 1)) },
  { id: 'bau-pintado', nome: 'Baú pintado', categoria: 'armazenamento', tipo: 'piso', funcoes: ['tenda', 'quarto', 'deposito', 'sala'], ...DE, tags: ['bau', 'arca', 'pintado', 'madeira', 'latao', 'tachas', 'flores', 'arabe', 'deserto'], pegada: [1.05, 0.6], altura: 0.6,
    gerar: p => piso([1.05, 0.6], bauPintado(p.seed)) },
  { id: 'tear-de-chao', nome: 'Tear de chão', categoria: 'decoracao', tipo: 'piso', funcoes: ['tenda', 'oficina', 'patio-com-fonte', 'jardim'], ...DE, tags: ['tear', 'tecer', 'kilim', 'urdidura', 'la', 'horizontal', 'nomade', 'deserto'], pegada: [1.5, 3.0], altura: 0.4,
    gerar: p => piso([1.5, 3.0], tearDeChao(p.seed)) },
];
