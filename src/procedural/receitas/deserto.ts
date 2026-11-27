import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y, bolha, lente, sombraNoChao, tira } from '../organico.ts';
import { num, piso, type LuzDeReceita, type Receita } from './comum.ts';
import { ID, MADEIRA, O, S, anel, arco, bloco, disco, em, estofado, fruta, olhar, quadro, retQ, retR, tomDaFace, type Quadro, type Tons } from './antiguidade.ts';
import { brasas, halo, pedra } from './oriental.ts';
import { costela, cranio, osso } from './caverna.ts';

// Deserto (Q17): tenda e casa (Q17a), caravana e mercado (Q17b). Pelo de cabra preto das tendas, lã tingida dos kilims (vermelho de
// garança, anil, ocre), latão vazado, barro cozido, palha de palmeira e adobe. As regras do acervo: nanquim por baixo da silhueta, volume
// em degraus de tom para o noroeste, `z` das partes até 1,5 m e a `altura` real na receita (para a sombra do sol).

const PELO_DE_CABRA: Tons = { nanquim: '#070504', sombra: '#14100c', base: '#221c16', meio: '#2c241c', luz: '#3c3228', brilho: '#5e5244' };
const LATAO: Tons = { nanquim: '#241806', sombra: '#6a4c16', base: '#946e26', meio: '#ad8532', luz: '#c89e46', brilho: '#ead07c' };
const BARRO: Tons = { nanquim: '#2a160a', sombra: '#7a4a2a', base: '#a2663a', meio: '#b67a48', luz: '#ca9260', brilho: '#e2b486' };
const ADOBE: Tons = { nanquim: '#2a1c10', sombra: '#806040', base: '#a88458', meio: '#ba966a', luz: '#cca87c', brilho: '#e0c49a' };
const PRATA: Tons = { nanquim: '#161618', sombra: '#5a5c62', base: '#80848a', meio: '#989ca2', luz: '#b4b8be', brilho: '#e0e4e8' };
const PALHA = '#b89a5a', CORDA = '#a8946a', CREME = '#e2d4b4', AREIA = '#c9a874';

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

// ---------- Caravana e mercado (Q17b) ----------

const PELAGENS_DE_CAMELO = ['#b08a5a', '#9a6e42', '#c4a676', '#7a5634'];

/** Camelo (dromedário) de cima, a cabeça para +x: o corpo, a corcova clara, o pescoço comprido e a cabeça; em pé com as pernas em passo, ou deitado com os joelhos dobrados para os lados; carregado com a manta de kilim, a sela de madeira, os alforjes, o tapete enrolado e o odre. */
function camelo(seed: number, deitado: boolean, carga: boolean): { pegada: [number, number]; partes: Parte[] } {
  const r = mulberry32(seed), partes: Parte[] = [], cor = PELAGENS_DE_CAMELO[Math.floor(r() * 4)]!, claro = tom(cor, 0.16), escuro = tom(cor, -0.3), nanq = tom(cor, -0.75), pal = KILIMS[Math.floor(r() * 3)]!;
  const zc = deitado ? 0.72 : 1.3, giro = (r() - 0.5) * 0.5, larg = deitado ? 0.78 : 0.58;
  // O pescoço e a cabeça giram juntos em volta da base do pescoço.
  const bx = deitado ? 0.6 : 0.66, cg = Math.cos(giro), sg = Math.sin(giro), g = (x: number, y: number): [number, number] => [bx + (x - bx) * cg - y * sg, (x - bx) * sg + y * cg];
  const gp = (pts: number[]): number[] => { const o: number[] = []; for (let i = 0; i < pts.length; i += 2) o.push(...g(pts[i]!, pts[i + 1]!)); return o; };
  sombraNoChao(partes, bolha(0.05, 0.02, deitado ? 0.85 : 0.75, deitado ? 0.5 : 0.36, 14, 0.06, r), 0.01, '#0d0a08', deitado ? 0.55 : 0.4);
  if (!deitado) {
    // As pernas em passo: finas, uma par adiante e outro atrás, com o pé largo.
    for (const [x, s, a] of [[0.5, -1, 0.35], [0.45, 1, -0.1], [-0.5, -1, -0.15], [-0.55, 1, 0.3]] as const) {
      const ang = (a > 0 ? 0 : Math.PI) + s * 0.25 + a, y = s * 0.2;
      partes.push(lente(x, y, ang, 0.5, 0.11, nanq, 0.5, { contorno: 'leve', detalhe: 2 }), lente(x, y, ang, 0.46, 0.07, escuro, 0.502, { ...O, detalhe: 2 }));
      partes.push(elipse(x + Math.cos(ang) * 0.48, y + Math.sin(ang) * 0.48, 0.1, 0.08, nanq, 0.505, { contorno: 'leve', detalhe: 3 }));
    }
  } else {
    // Deitado: os joelhos da frente e as patas de trás dobrados, saindo pelos lados.
    for (const [x, s] of [[0.42, -1], [0.42, 1], [-0.45, -1], [-0.45, 1]] as const) {
      partes.push(elipse(x, s * 0.42, 0.26, 0.17, nanq, 0.3, { contorno: 'leve', detalhe: 2 }), elipse(x + LUZ_X * 0.01, s * 0.42 + LUZ_Y * 0.01, 0.22, 0.13, escuro, 0.302, { ...O, detalhe: 2 }));
      partes.push(lente(x + 0.06, s * 0.45, 0.1 * s, 0.2, 0.07, nanq, 0.305, { contorno: 'leve', detalhe: 3 }));
    }
  }
  // O rabo.
  partes.push(tira([-0.78, 0, -0.92, 0.03, -0.98, 0.08], 0.05, escuro, zc - 0.05, { contorno: 'leve', detalhe: 2 }, 0.4));
  // O corpo: nanquim, base, o lado da luz e a barriga de sombra.
  partes.push(elipse(-0.04, 0.012, 1.66, larg + 0.06, nanq, zc, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), elipse(-0.05, 0, 1.6, larg, cor, zc + 0.003, { ...O, detalhe: 1 }));
  partes.push(elipse(-0.08, larg * 0.22, 1.3, larg * 0.4, escuro, zc + 0.005, { ...S, alfa: 0.55, detalhe: 2 }), elipse(-0.06, -larg * 0.15, 1.3, larg * 0.5, claro, zc + 0.006, { ...S, alfa: 0.5, detalhe: 2 }));
  // O pescoço e a cabeça.
  const pz = deitado ? zc + 0.2 : zc + 0.04, cz = deitado ? zc + 0.26 : zc + 0.12;
  const p0 = deitado ? 0.5 : 0.55, p1 = deitado ? 0.92 : 1.18, pesc = (k: number, d = 0): number[] => { const ida: number[] = [], volta: number[] = []; for (let i = 0; i <= 8; i++) { const t = i / 8, x = p0 + (p1 - p0) * t, w = (0.17 - 0.09 * t) * k, c = Math.sin(t * Math.PI) * 0.02 + d; ida.push(x, c - w); volta.unshift(x, c + w); } return gp([...ida, ...volta]); };
  partes.push(poli(pesc(1.18), nanq, pz, { contorno: 'leve', detalhe: 1 }), poli(pesc(1), cor, pz + 0.003, { ...O, detalhe: 1 }), poli(pesc(0.4, -0.04), claro, pz + 0.006, { ...S, alfa: 0.6, detalhe: 2 }));
  const hx = deitado ? 0.86 : 1.12, perfil: [number, number][] = [[0, 0.075], [0.1, 0.105], [0.2, 0.09], [0.32, 0.068], [0.41, 0.075], [0.47, 0.05], [0.5, 0]];
  const cab = [...perfil.map(([u, v]) => [hx + u, -v]), ...perfil.slice(0, -1).reverse().map(([u, v]) => [hx + u, v])].flat();
  partes.push(poli(gp(cab.map((v, i) => (i % 2 ? v * 1.2 : v))), nanq, cz, { contorno: 'leve', detalhe: 1 }), poli(gp(cab), cor, cz + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(gp([hx + 0.05, -0.05, hx + 0.3, -0.06, hx + 0.3, 0.0, hx + 0.05, 0.0]), claro, cz + 0.005, { ...S, alfa: 0.6, detalhe: 2 }), elipse(...g(hx + 0.41, 0), 0.12, 0.13, escuro, cz + 0.006, { ...S, alfa: 0.8, detalhe: 2 }));
  for (const s of [-1, 1]) {
    partes.push(elipse(...g(hx + 0.17, s * 0.085), 0.035, 0.03, '#120c08', cz + 0.008, { ...O, detalhe: 3 }), lente(...g(hx + 0.06, s * 0.06), Math.PI + giro - s * 0.6, 0.08, 0.035, escuro, cz + 0.007, { contorno: 'leve', detalhe: 3 }));
    partes.push(elipse(...g(hx + 0.44, s * 0.03), 0.03, 0.012, '#120c08', cz + 0.009, { ...O, detalhe: 3 }));
  }
  // A corcova: o volume mais claro, mais alto, com o pelo mais comprido.
  const hz = zc + 0.1;
  partes.push(elipse(-LUZ_X * 0.1, -LUZ_Y * 0.08, 1.0, larg * 0.85, escuro, hz - 0.002, { ...S, alfa: 0.45, desfoque: 0.1, detalhe: 2 }));
  partes.push(elipse(0.02, 0.02, 1.0, larg * 0.82, tom(cor, -0.12), hz, { ...S, alfa: 0.55, desfoque: 0.08, detalhe: 1 }), elipse(LUZ_X * 0.05, LUZ_Y * 0.04, 0.78, larg * 0.6, claro, hz + 0.003, { ...S, alfa: 0.8, desfoque: 0.08, detalhe: 2 }), elipse(LUZ_X * 0.12, LUZ_Y * 0.1, 0.36, larg * 0.28, tom(cor, 0.34), hz + 0.006, { ...S, alfa: 0.75, desfoque: 0.05, detalhe: 3 }));
  for (let k = 0; k < 14; k++) { const a = r() * 6.28, d = Math.sqrt(r()) * 0.3; partes.push(lente(Math.cos(a) * d, Math.sin(a) * d * larg * 1.2, a, 0.08, 0.02, r() < 0.5 ? escuro : tom(cor, 0.25), hz + 0.008, { ...S, alfa: 0.55, detalhe: 3 })); }
  if (carga) {
    const zk = hz + 0.04;
    // Os alforjes pendurados dos dois lados, listrados.
    for (const s of [-1, 1]) {
      const f = quadro(-0.08, s * (larg / 2 + 0.06)), c2 = s < 0 ? pal[0] : pal[3];
      estofado(partes, f, 0, 0, 0, 0.72, 0.26, c2, zk - 0.25, 0.08);
      for (const u of [-0.2, 0, 0.2]) partes.push(tira(em(f, [u, -0.12, u, 0.12]), 0.03, pal[2], zk - 0.24, { ...O, alfa: 0.8, detalhe: 3 }));
    }
    // A manta de kilim atravessada sobre a corcova e a sela de madeira em X.
    kilim(partes, r, quadro(0, 0, Math.PI / 2), larg + 0.26, 0.6, pal, zk, false);
    for (const u of [-0.3, 0.3]) for (const v of [-(larg + 0.26) / 2, (larg + 0.26) / 2]) borla(partes, u * 0.9, v, pal[2], zk + 0.02);
    for (const s of [-1, 1]) partes.push(tira([-0.25, s * 0.28, 0.25, -s * 0.28], 0.06, MADEIRA.nanquim, zk + 0.03, { contorno: 'leve', detalhe: 2 }), tira([-0.24, s * 0.27, 0.24, -s * 0.27], 0.035, MADEIRA.luz, zk + 0.032, { ...O, detalhe: 3 }));
    for (const x of [-0.25, 0.25]) partes.push(elipse(x, 0, 0.09, 0.09, MADEIRA.base, zk + 0.035, { contorno: 'leve', detalhe: 2 }));
    // O tapete enrolado atrás da sela e o odre de couro à frente.
    const rv = (larg + 0.2) / 2, rc = pal[1];
    partes.push(tira([-0.45, -rv, -0.45, rv], 0.17, tom(rc, -0.6), zk + 0.02, { contorno: 'leve', detalhe: 1 }), tira([-0.45, -rv, -0.45, rv], 0.13, rc, zk + 0.022, { ...O, detalhe: 2 }), tira([-0.47, -rv, -0.47, rv], 0.04, tom(rc, 0.3), zk + 0.024, { ...S, alfa: 0.6, detalhe: 3 }));
    for (const v of [-rv * 0.6, rv * 0.6]) partes.push(tira([-0.54, v, -0.36, v], 0.02, CORDA, zk + 0.026, { ...O, detalhe: 3 }));
    for (const s of [-1, 1]) partes.push(elipse(-0.45, s * rv, 0.13, 0.05, tom(rc, -0.3), zk + 0.026, { contorno: 'leve', detalhe: 3 }));
    partes.push(lente(0.3, larg / 2 + 0.02, 0.4, 0.3, 0.16, '#5a3a20', zk - 0.1, { contorno: 'leve', detalhe: 2 }), lente(0.32, larg / 2, 0.4, 0.2, 0.06, '#8a6a44', zk - 0.09, { ...S, alfa: 0.7, detalhe: 3 }));
  }
  const pegada: [number, number] = deitado ? [2.5, carga ? 1.5 : 1.3] : [3.0, carga ? 1.3 : 1.05];
  return { pegada, partes };
}

/** Poço do oásis: o parapeito de adobe em anel, a água funda lá dentro, a armação de madeira com a roldana e a corda, o balde de couro, o bebedouro com água e o chão molhado. */
function pocoOasis(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.72, Ri = 0.48, z = 0.7;
  sombraNoChao(partes, bolha(0, 0.12, 1.05, 0.95, 18, 0.12, r), 0.01, '#3a2414', 0.4, [0, 0]);
  // O bebedouro de adobe na frente (+y), com água.
  const bf = quadro(0, 0.9, (r() - 0.5) * 0.1);
  bloco(partes, bf, 1.3, 0.34, ADOBE, 0.4, 0.06);
  partes.push(poli(retR(bf, 0, 0, 1.12, 0.18, 0.04), '#1e3a3a', 0.41, { ...O, detalhe: 1 }), poli(retR(bf, -0.2, -0.03, 0.5, 0.05, 0.02), '#6a9a98', 0.412, { ...S, alfa: 0.4, detalhe: 3 }));
  // O parapeito: tijolos em anel, cada um no tom da luz que recebe.
  disco(partes, 0, 0, R, ADOBE, z - 0.02);
  const n = 18;
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * 6.28, a1 = ((k + 0.92) / n) * 6.28, am = (a0 + a1) / 2;
    partes.push(poli([...arco(0, 0, R - 0.03, R - 0.03, a0, a1, 3), ...arco(0, 0, Ri + 0.02, Ri + 0.02, a1, a0, 3)], tom(tomDaFace(ADOBE, olhar(am)), (r() - 0.5) * 0.08), z + 0.012, { ...O, detalhe: 2 }));
  }
  // O poço por dentro: a parede escura do lado da luz (sombra), a água e o reflexo.
  partes.push(elipse(0, 0, Ri * 2, Ri * 2, '#0c0e0e', z + 0.015, { contorno: 'leve', detalhe: 1 }));
  partes.push(elipse(-LUZ_X * 0.05, -LUZ_Y * 0.05, Ri * 1.6, Ri * 1.6, '#163236', z + 0.016, { ...O, detalhe: 1 }), tira(anel(-LUZ_X * 0.05, -LUZ_Y * 0.05, Ri * 0.55, Ri * 0.55, 24), 0.012, '#4a7a80', z + 0.017, { ...O, alfa: 0.35, detalhe: 3 }));
  partes.push(lente(-0.05, 0.12, 0.3, 0.2, 0.04, '#8ab8bc', z + 0.018, { ...S, alfa: 0.35, detalhe: 3 }));
  // A armação: dois postes no parapeito, a travessa e a roldana; a corda desce até o balde no parapeito.
  const pa = (r() - 0.5) * 0.4, pc = Math.cos(pa), ps = Math.sin(pa), P = R - 0.06;
  for (const s of [-1, 1]) disco(partes, s * P * pc, s * P * ps, 0.07, MADEIRA, z + 0.3);
  partes.push(tira([-P * pc, -P * ps, P * pc, P * ps], 0.085, MADEIRA.nanquim, 1.4, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-P * pc, -P * ps, P * pc, P * ps], 0.055, MADEIRA.base, 1.403, { ...O, detalhe: 2 }), tira([-P * pc + LUZ_X * 0.012, -P * ps + LUZ_Y * 0.012, P * pc + LUZ_X * 0.012, P * ps + LUZ_Y * 0.012], 0.018, MADEIRA.luz, 1.405, { ...O, detalhe: 3 }));
  partes.push(elipse(0, 0, 0.16, 0.08, MADEIRA.nanquim, 1.42, { contorno: 'leve', detalhe: 2 }), elipse(0, 0, 0.12, 0.05, MADEIRA.meio, 1.425, { ...O, detalhe: 3 }));
  const bb = 0.6 + r() * 0.8, bxx = Math.cos(bb + Math.PI / 2) * (R - 0.12), byy = Math.sin(bb + Math.PI / 2) * (R - 0.12);
  partes.push(tira([0, 0, bxx * 0.6, byy * 0.6, bxx, byy], 0.014, CORDA, 1.0, { ...O, detalhe: 3 }));
  disco(partes, bxx, byy, 0.1, { nanquim: '#140a04', sombra: '#3a2210', base: '#5a3a20', meio: '#6a462a', luz: '#7e5836', brilho: '#a07a50' }, z + 0.08);
  partes.push(elipse(bxx, byy, 0.12, 0.12, '#1a2a2a', z + 0.1, { ...O, detalhe: 3 }));
  // Um jarro de barro e um cântaro ao pé do poço.
  jarro(partes, r, -0.95, 0.35 + r() * 0.2, 0.15, 0.4, { alcas: 2 });
  if (r() < 0.6) jarro(partes, r, 0.92, -0.45, 0.12, 0.35, { alcas: 1, pintado: false });
  return partes;
}

const ESPECIARIAS = ['#a8321a', '#d8a020', '#8a5a2a', '#c84a10', '#6a7a30', '#b06a3a', '#e6d6b0', '#5a2a1a', '#c86a78'];

/** Um monte de especiaria em cone (de cima): a base escura, o lado da luz claro, o pico e os grãos. */
function monte(partes: Parte[], r: () => number, x: number, y: number, R: number, cor: string, z: number): void {
  partes.push(elipse(x, y, R * 2, R * 2, tom(cor, -0.35), z, { ...O, detalhe: 1 }));
  partes.push(elipse(x + LUZ_X * R * 0.15, y + LUZ_Y * R * 0.15, R * 1.5, R * 1.5, cor, z + 0.01, { ...S, detalhe: 2 }));
  partes.push(elipse(x + LUZ_X * R * 0.3, y + LUZ_Y * R * 0.3, R * 0.8, R * 0.8, tom(cor, 0.22), z + 0.02, { ...S, alfa: 0.85, detalhe: 2 }));
  partes.push(elipse(x + LUZ_X * R * 0.05, y + LUZ_Y * R * 0.05, R * 0.25, R * 0.25, tom(cor, 0.4), z + 0.03, { ...S, alfa: 0.8, detalhe: 3 }));
  for (let k = 0; k < 6; k++) { const a = r() * 6.28, d = R * (0.5 + r() * 0.4); partes.push(elipse(x + Math.cos(a) * d, y + Math.sin(a) * d, 0.012, 0.012, tom(cor, r() < 0.5 ? -0.3 : 0.3), z + 0.015, { ...O, detalhe: 3 })); }
}

/** Banca de especiarias: a mesa de madeira com as tigelas e cestos de montes coloridos, a balança de latão, e na frente (+y) os sacos abertos com a boca enrolada. */
function bancaDeEspeciarias(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], W = 2.0, D = 0.9, z = 0.8, cores = [...ESPECIARIAS].sort(() => r() - 0.5);
  sombraNoChao(partes, [-W / 2, -D / 2 - 0.2, W / 2, -D / 2 - 0.2, W / 2, D / 2, -W / 2, D / 2], 0.01, '#0d0a08', 0.45);
  bloco(partes, quadro(0, -0.2), W, D, MADEIRA, z, 0.04);
  for (let v = -D / 2 + 0.06; v < D / 2 - 0.04; v += 0.18) partes.push(tira([-W / 2 + 0.05, v - 0.2, W / 2 - 0.05, v - 0.2], 0.008, MADEIRA.nanquim, z + 0.007, { ...O, alfa: 0.5, detalhe: 3 }));
  // As tigelas (barro) e os cestos rasos (palha) com os montes, em duas fileiras.
  let c = 0;
  for (let j = 0; j < 2; j++) for (let i = 0; i < 5; i++) {
    if (j === 0 && i === 4) continue;
    const x = -W / 2 + 0.22 + i * 0.39 + (r() - 0.5) * 0.04, y = -0.2 + (j ? 0.2 : -0.2) + (r() - 0.5) * 0.03, R = 0.15 + r() * 0.025, cesto = r() < 0.4;
    partes.push(elipse(x + 0.01, y + 0.012, R * 2 + 0.03, R * 2 + 0.03, '#1a0e06', z + 0.05, { contorno: 'leve', detalhe: 2 }), elipse(x, y, R * 2, R * 2, cesto ? PALHA : BARRO.base, z + 0.052, { ...O, detalhe: 2 }));
    partes.push(tira(anel(x, y, R * 0.92, R * 0.92, 20), 0.02, cesto ? tom(PALHA, 0.15) : BARRO.luz, z + 0.054, { ...O, detalhe: 3 }));
    monte(partes, r, x, y, R * 0.78, cores[c++ % cores.length]!, z + 0.06);
  }
  // A balança de latão no canto.
  const bx = W / 2 - 0.2, by = -0.42;
  partes.push(tira([bx - 0.14, by, bx + 0.14, by], 0.014, LATAO.base, z + 0.25, { contorno: 'leve', detalhe: 2 }));
  for (const s of [-1, 1]) disco(partes, bx + s * 0.14, by, 0.07, LATAO, z + 0.15);
  partes.push(elipse(bx, by, 0.04, 0.04, LATAO.luz, z + 0.27, { contorno: 'leve', detalhe: 3 }));
  // Os paus de canela amarrados.
  for (let k = 0; k < 5; k++) partes.push(tira([bx - 0.12 + k * 0.012, by + 0.12, bx + 0.08 + k * 0.012, by + 0.2], 0.018, '#7a4a26', z + 0.06 + k * 0.002, { contorno: 'leve', detalhe: 3 }));
  // Os sacos na frente, de boca enrolada.
  for (let k = 0; k < 3; k++) {
    const x = -0.65 + k * 0.65 + (r() - 0.5) * 0.1, y = 0.55 + (r() - 0.5) * 0.06, R = 0.24 + r() * 0.04;
    partes.push(poli(bolha(x + 0.01, y + 0.015, R + 0.03, R * 0.92 + 0.03, 12, 0.08, r), '#2a1e10', 0.45, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(bolha(x, y, R, R * 0.92, 12, 0.08, r), '#a08a5a', 0.452, { ...O, detalhe: 1 }));
    partes.push(tira(anel(x, y, R * 0.8, R * 0.74, 20), R * 0.22, '#b8a272', 0.455, { contorno: 'leve', detalhe: 2 }));
    monte(partes, r, x, y, R * 0.62, cores[c++ % cores.length]!, 0.46);
  }
  return partes;
}

/** Tapetes pendurados para venda: a vara entre dois postes e três kilims dobrados por cima, com a face da frente (+y) vista um pouco de frente e a beira do avesso atrás. */
function tapetesPendurados(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], C = 3.0, F = 0.6, z = 1.2;
  sombraNoChao(partes, [-C / 2, -0.15, C / 2, -0.15, C / 2, F, -C / 2, F], 0.01, '#0d0a08', 0.35);
  const cortes = [0, 0.3 + r() * 0.1, 0.62 + r() * 0.1, 1], ini = Math.floor(r() * 4);
  for (let i = 0; i < 3; i++) {
    const a = -C / 2 + 0.1 + cortes[i]! * (C - 0.2), b = -C / 2 + 0.1 + cortes[i + 1]! * (C - 0.2), w = b - a - 0.05, cu = (a + b) / 2, pal = KILIMS[(ini + i) % 4]!;
    partes.push(poli(retQ(ID, cu, -0.07, w, 0.12), tom(pal[0], -0.45), z, { contorno: 'leve', detalhe: 2 }));
    kilim(partes, r, quadro(cu, 0.05 + F / 2, Math.PI / 2), F, w, pal, z + 0.01, true);
    partes.push(poli(retQ(ID, cu, 0.0, w + 0.01, 0.09), tom(pal[0], 0.12), z + 0.25, { contorno: 'leve', detalhe: 2 }), poli(retQ(ID, cu, -0.02, w, 0.03), tom(pal[0], 0.3), z + 0.252, { ...S, alfa: 0.6, detalhe: 3 }));
  }
  for (const s of [-1, 1]) disco(partes, s * (C / 2 + 0.02), 0, 0.06, MADEIRA, z + 0.2);
  partes.push(tira([-C / 2 - 0.05, 0, C / 2 + 0.05, 0], 0.07, MADEIRA.nanquim, z + 0.27, { contorno: 'leve', detalhe: 1 }), tira([-C / 2 - 0.04, -0.01, C / 2 + 0.04, -0.01], 0.03, MADEIRA.luz, z + 0.272, { ...O, detalhe: 3 }));
  return partes;
}

/** Toldo listrado sobre quatro varas: a lona em listras da frente para o fundo, caindo para a frente (+y) e cedendo no meio, a sanefa em ondas, os remates das varas e os tirantes da frente. */
function toldoListrado(seed: number, C: number, L: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], [c1, c2] = ([['#a8281a', CREME], ['#24447e', CREME], ['#2e5a3a', CREME], ['#b8862e', '#6a1e16']] as const)[Math.floor(r() * 4)]!, z = 1.4;
  for (const s of [-1, 1]) { const x0 = s * (C / 2 - 0.05), x1 = x0 + s * 0.1 + (r() - 0.5) * 0.1, y1 = L / 2 + 0.42; partes.push(tira([x0, L / 2 - 0.05, x1, y1], 0.018, CORDA, 0.3, { ...O, detalhe: 2 }), elipse(x1, y1, 0.07, 0.07, MADEIRA.nanquim, 0.06, { contorno: 'leve', detalhe: 2 })); }
  sombraNoChao(partes, [-C / 2, -L / 2, C / 2, -L / 2, C / 2, L / 2, -C / 2, L / 2], 0.02, '#0d0a08', 0.45);
  partes.push(poli(retQ(ID, 0, 0, C + 0.04, L + 0.04), tom(c1, -0.75), z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }));
  const n = Math.max(4, Math.round(C / 0.26)), sw = C / n;
  for (let k = 0; k < n; k++) partes.push(poli(retQ(ID, -C / 2 + sw * (k + 0.5), 0, sw + 0.004, L), k % 2 ? c2 : c1, z + 0.002, { ...O, detalhe: 1 }));
  // Volume: claro no fundo (preso alto), escurecendo para a frente, e a barriga do meio.
  for (let k = 0; k < 3; k++) partes.push(poli(retQ(ID, 0, L / 2 - (L / 6) * (k + 0.5), C, L / 3), '#000000', z + 0.004, { ...S, alfa: 0.06 + k * 0.0 + (2 - k) * 0.06, detalhe: 1 }));
  partes.push(poli(retQ(ID, 0, -L / 2 + L * 0.12, C, L * 0.24), '#ffffff', z + 0.005, { ...S, alfa: 0.12, detalhe: 2 }), elipse(0, L * 0.1, C * 0.8, L * 0.6, '#000000', z + 0.006, { ...S, alfa: 0.12, desfoque: L * 0.15, detalhe: 2 }));
  // A sanefa: uma onda por listra, alternando as cores.
  for (let k = 0; k < n; k++) {
    const u = -C / 2 + sw * (k + 0.5), cor = k % 2 ? c2 : c1;
    partes.push(poli(arco(u, L / 2, sw / 2, 0.1, 0, Math.PI, 6), tom(cor, -0.15), z + 0.008, { contorno: 'leve', detalhe: 2 }));
  }
  partes.push(tira([-C / 2, -L / 2, C / 2, -L / 2], 0.05, MADEIRA.base, z + 0.01, { contorno: 'leve', detalhe: 2 }));
  for (const [x, y] of [[-C / 2, -L / 2], [C / 2, -L / 2], [-C / 2, L / 2], [C / 2, L / 2]] as const) { partes.push(elipse(x, y, 0.08, 0.08, MADEIRA.nanquim, z + 0.02, { contorno: 'leve', detalhe: 2 }), elipse(x + LUZ_X * 0.01, y + LUZ_Y * 0.01, 0.05, 0.05, MADEIRA.luz, z + 0.022, { ...O, detalhe: 3 })); }
  return partes;
}

/** Palanquim: a liteira com a cobertura de pano em domo (bordas de ouro, nervuras e o remate), as franjas, e as duas varas de carregar com as ponteiras de latão. */
function palanquim(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], pano = ['#7a1c24', '#24386a', '#1e4a3a', '#6a2a5a'][Math.floor(r() * 4)]!, W = 1.3, D = 1.0, z = 1.25;
  sombraNoChao(partes, [-0.65, -0.5, 0.65, -0.5, 0.65, 0.5, -0.65, 0.5], 0.01, '#0d0a08', 0.4);
  for (const s of [-1, 1]) {
    const v = s * 0.44;
    partes.push(tira([-1.55, v, 1.55, v], 0.075, MADEIRA.nanquim, 0.95, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), tira([-1.54, v, 1.54, v], 0.045, MADEIRA.base, 0.953, { ...O, detalhe: 2 }), tira([-1.53, v - 0.01, 1.53, v - 0.01], 0.014, MADEIRA.luz, 0.955, { ...O, detalhe: 3 }));
    for (const u of [-1.55, 1.55]) partes.push(elipse(u, v, 0.08, 0.08, LATAO.base, 0.96, { contorno: 'leve', detalhe: 3 }));
  }
  const t: Tons = { nanquim: tom(pano, -0.8), sombra: tom(pano, -0.4), base: pano, meio: tom(pano, 0.1), luz: tom(pano, 0.24), brilho: tom(pano, 0.5) };
  partes.push(poli(retR(ID, 0.012, 0.016, W + 0.05, D + 0.05, 0.12), t.nanquim, z, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), poli(retR(ID, 0, 0, W, D, 0.1), t.base, z + 0.003, { ...O, detalhe: 1 }));
  partes.push(poli(retR(ID, LUZ_X * 0.04, LUZ_Y * 0.03, W * 0.8, D * 0.76, 0.12), t.meio, z + 0.006, { ...S, detalhe: 1 }), poli(retR(ID, LUZ_X * 0.1, LUZ_Y * 0.08, W * 0.46, D * 0.42, 0.12), t.luz, z + 0.009, { ...S, detalhe: 2 }), poli(retR(ID, LUZ_X * 0.16, LUZ_Y * 0.13, W * 0.18, D * 0.16, 0.06), t.brilho, z + 0.012, { ...S, alfa: 0.7, detalhe: 3 }));
  for (const [cu, cv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) partes.push(tira([cu * (W / 2 - 0.05), cv * (D / 2 - 0.05), 0, 0], 0.018, LATAO.luz, z + 0.015, { ...O, alfa: 0.85, detalhe: 3 }));
  partes.push(tira(retR(ID, 0, 0, W - 0.04, D - 0.04, 0.09).concat(retR(ID, 0, 0, W - 0.04, D - 0.04, 0.09).slice(0, 2)), 0.028, LATAO.luz, z + 0.016, { ...O, detalhe: 2 }));
  for (let u = -W / 2 + 0.1; u < W / 2 - 0.05; u += 0.2) for (let v = -D / 2 + 0.12; v < D / 2 - 0.05; v += 0.2) if (Math.abs(u) + Math.abs(v) > 0.2) partes.push(poli(losango(ID, u, v, 0.05, 0.05), t.brilho, z + 0.013, { ...O, alfa: 0.5, detalhe: 3 }));
  for (let u = -W / 2 + 0.06; u <= W / 2 - 0.05; u += 0.12) for (const s of [-1, 1]) borla(partes, u, s * (D / 2 + 0.025), LATAO.luz, z + 0.017, 0.018);
  disco(partes, 0, 0, 0.08, LATAO, z + 0.2);
  partes.push(elipse(0, 0, 0.04, 0.04, LATAO.brilho, z + 0.24, { contorno: 'leve', detalhe: 3 }));
  return partes;
}

/** Cântaros empilhados: um grupo de jarros de barro de vários tamanhos, uns abertos, outros cobertos de pano amarrado, e um deitado na frente. */
function cantarosEmpilhados(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  const vagas: [number, number, number][] = [[-0.42, -0.24, 0.22], [0.04, -0.27, 0.21], [0.46, -0.2, 0.2], [-0.2, 0.14, 0.19], [0.24, 0.12, 0.2], [-0.58, 0.2, 0.14], [0.58, 0.22, 0.14]];
  const n = 5 + Math.floor(r() * 3), panos = [KILIMS[0]![0], KILIMS[1]![0], '#d8ccb0', KILIMS[2]![0]];
  sombraNoChao(partes, bolha(0, 0, 0.72, 0.48, 14, 0.06, r), 0.01, '#0d0a08', 0.45);
  const usadas = vagas.slice(0, n).sort((a, b) => a[1] - b[1]);
  usadas.forEach(([x, y, R], i) => {
    const tons: Tons = r() < 0.3 ? ADOBE : BARRO, pano = r() < 0.4 ? panos[Math.floor(r() * panos.length)]! : null;
    jarro(partes, r, x + (r() - 0.5) * 0.04, y + (r() - 0.5) * 0.04, R * (0.9 + r() * 0.15), 0.55 + i * 0.02, { tons, pintado: r() < 0.6, alcas: r() < 0.5 ? 2 : 0, pano });
  });
  // O cântaro deitado: o bojo em lente e a boca virada para o lado.
  const ang = (r() - 0.5) * 0.6, dx = Math.cos(ang), dy = Math.sin(ang), x0 = -0.1, y0 = 0.42;
  partes.push(lente(x0 - dx * 0.24, y0 - dy * 0.24, ang, 0.5, 0.3, BARRO.nanquim, 0.25, { contorno: 'leve', sombraLeve: true, detalhe: 1 }), lente(x0 - dx * 0.22, y0 - dy * 0.22, ang, 0.46, 0.26, BARRO.base, 0.253, { ...O, detalhe: 1 }));
  partes.push(lente(x0 - dx * 0.18, y0 - dy * 0.18 - 0.04, ang, 0.34, 0.08, BARRO.luz, 0.256, { ...S, alfa: 0.8, detalhe: 2 }));
  partes.push(elipse(x0 + dx * 0.28, y0 + dy * 0.28, 0.07, 0.12, BARRO.sombra, 0.26, { contorno: 'leve', detalhe: 2 }), elipse(x0 + dx * 0.29, y0 + dy * 0.29, 0.04, 0.08, '#120a06', 0.262, { ...O, detalhe: 3 }));
  return partes;
}

/** Fogueira de caravana: o anel de pedras, a cinza, as brasas e as chamas que brilham, os gravetos, o bule de café de latão (dallah) na beira e as xícaras, e o feixe de lenha seca. */
function fogueiraDeCaravana(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [];
  halo(partes, 0, 0, 0.75, '#6a1e04', 0.3);
  sombraNoChao(partes, bolha(0, 0, 0.62, 0.6, 14, 0.12, r), 0.012, '#1a1008', 0.5, [0, 0]);
  partes.push(poli(bolha(0, 0, 0.4, 0.4, 14, 0.1, r), '#5a544c', 0.03, { ...S, detalhe: 1 }), poli(bolha(0, 0, 0.32, 0.32, 12, 0.12, r), '#7a746a', 0.032, { ...S, alfa: 0.7, detalhe: 2 }));
  brasas(partes, r, 0, 0, 0.26, 0.04, 20);
  const n = 9;
  for (let k = 0; k < n; k++) { const a = (k / n) * 6.28 + r() * 0.2, d = 0.48 + r() * 0.04; pedra(partes, r, Math.cos(a) * d, Math.sin(a) * d, 0.1 + r() * 0.03, 0.08 + r() * 0.02, 0.1, 0); }
  // Os gravetos cruzados, com as pontas acesas.
  for (let k = 0; k < 4; k++) {
    const a = k * 1.57 + r() * 0.5, c = Math.cos(a), s = Math.sin(a);
    partes.push(tira([c * 0.36, s * 0.36, c * 0.05, s * 0.05], 0.05, '#2a1e14', 0.12, { contorno: 'leve', detalhe: 2 }), tira([c * 0.34, s * 0.34, c * 0.08, s * 0.08], 0.028, '#5a4a38', 0.122, { ...O, detalhe: 3 }));
    partes.push(elipse(c * 0.08, s * 0.08, 0.05, 0.05, '#c05010', 0.124, { ...O, brilho: true, detalhe: 3 }));
  }
  // As chamas: línguas que somam luz e o miolo claro.
  for (let k = 0; k < 7; k++) { const a = r() * 6.28; partes.push(lente(Math.cos(a) * 0.03, Math.sin(a) * 0.03, a, 0.2 + r() * 0.12, 0.09, k % 2 ? '#9a3a0a' : '#7a2606', 0.3 + k * 0.005, { ...O, brilho: true, alfa: 0.7, desfoque: 0.02, detalhe: 2 })); }
  partes.push(elipse(0, 0, 0.16, 0.16, '#a8601a', 0.34, { ...O, brilho: true, alfa: 0.55, desfoque: 0.04, detalhe: 2 }));
  // A dallah na beira das brasas: o bojo, o bico longo e curvo, a tampa em ponta e a alça.
  const a = 0.6 + r() * 0.4, dx = Math.cos(a) * 0.3, dy = Math.sin(a) * 0.3, ab = a + 2.2;
  partes.push(tira([dx + Math.cos(ab) * 0.06, dy + Math.sin(ab) * 0.06, dx + Math.cos(ab) * 0.15, dy + Math.sin(ab) * 0.15, dx + Math.cos(ab + 0.4) * 0.21, dy + Math.sin(ab + 0.4) * 0.21], 0.03, LATAO.base, 0.36, { contorno: 'leve', detalhe: 2 }, 0.5));
  partes.push(tira(arco(dx, dy, 0.1, 0.1, ab + 2.5, ab + 3.8, 6), 0.018, LATAO.sombra, 0.37, { contorno: 'leve', detalhe: 3 }));
  disco(partes, dx, dy, 0.085, LATAO, 0.38);
  disco(partes, dx, dy, 0.045, LATAO, 0.44);
  partes.push(elipse(dx, dy, 0.02, 0.02, LATAO.brilho, 0.47, { contorno: 'leve', detalhe: 3 }));
  // As xícaras (finjan) numa pedra lisa e o feixe de lenha.
  const xx = Math.cos(a + 1.5) * 0.7, xy = Math.sin(a + 1.5) * 0.7;
  pedra(partes, r, xx, xy, 0.14, 0.11, 0.06, 0);
  for (let k = 0; k < 2 + Math.floor(r() * 2); k++) { const cx = xx - 0.05 + k * 0.06, cy = xy + (r() - 0.5) * 0.05; partes.push(elipse(cx, cy, 0.055, 0.055, '#e8e0d0', 0.12, { contorno: 'leve', detalhe: 3 }), elipse(cx, cy, 0.035, 0.035, '#3a1e0a', 0.122, { ...O, detalhe: 3 })); }
  const lx = Math.cos(a + Math.PI) * 0.68, ly = Math.sin(a + Math.PI) * 0.68, la = a + Math.PI / 2 + (r() - 0.5) * 0.4;
  for (let k = 0; k < 4; k++) { const o = (k - 1.5) * 0.045; partes.push(tira([lx - Math.cos(la) * 0.25 - Math.sin(la) * o, ly - Math.sin(la) * 0.25 + Math.cos(la) * o, lx + Math.cos(la) * 0.25 - Math.sin(la) * o, ly + Math.sin(la) * 0.25 + Math.cos(la) * o], 0.035, k % 2 ? '#6a5a44' : '#4e4030', 0.08 + k * 0.004, { contorno: 'leve', detalhe: 2 }, 0.7)); }
  return partes;
}

/** Ossada de camelo meio enterrada na areia: a coluna comprida, as costelas grandes, a bacia, o pescoço dobrado com o crânio de focinho longo, os ossos das pernas espalhados e a areia que cobre parte de tudo. */
function ossadaDeCamelo(seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], cor = ['#e0d6bc', '#d6caa8', '#cfc4a6'][Math.floor(r() * 3)]!, curva = (u: number): number => Math.sin(u * 2.4 + 0.3) * 0.08;
  sombraNoChao(partes, bolha(0.1, 0.05, 1.25, 0.55, 18, 0.15, r), 0.02, '#4a3420', 0.35, [0, 0]);
  // A coluna, da bacia (−0,95) aos ombros (0,55).
  for (let i = 0; i < 18; i++) { const u = i / 17, x = -0.95 + u * 1.5, t = 0.07 - Math.abs(u - 0.6) * 0.03; partes.push(poli(bolha(x, curva(u), t, t * 0.8, 7, 0.15, r), cor, 0.22 + u * 0.001, { contorno: 'leve', sombraLeve: true, detalhe: 2 })); }
  const n = 9;
  for (let i = 0; i < n; i++) { const u = 0.45 + (i / (n - 1)) * 0.5, x = -0.95 + u * 1.5, len = 0.34 + 0.16 * Math.sin((i / (n - 1)) * Math.PI); for (const lado of [-1, 1]) if (r() > 0.1) costela(partes, x, curva(u) + lado * 0.03, lado * Math.PI / 2 - lado * 0.25, len, 0.045, -lado * 0.6, cor, 0.2); }
  for (const lado of [-1, 1]) partes.push(poli(bolha(-0.98, curva(0) + lado * 0.14, 0.14, 0.09, 9, 0.2, r, lado * 0.5), cor, 0.23, { contorno: 'leve', sombraLeve: true, detalhe: 2 }));
  // O pescoço, dobrado para um lado, e o crânio.
  const lado = r() < 0.5 ? -1 : 1;
  let x = 0.55, y = curva(1), a = 0;
  for (let i = 0; i < 8; i++) { a += lado * 0.18; x += Math.cos(a) * 0.09; y += Math.sin(a) * 0.09; partes.push(poli(bolha(x, y, 0.055, 0.045, 7, 0.15, r, a), cor, 0.22, { contorno: 'leve', sombraLeve: true, detalhe: 2 })); }
  cranio(partes, x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3, a + lado * 0.2, 0.5, 0.26, false, cor);
  // As pernas: ossos longos soltos.
  for (let k = 0; k < 4; k++) { const ox = -0.8 + k * 0.5 + (r() - 0.5) * 0.2, oy = (k % 2 ? 1 : -1) * (0.42 + r() * 0.12); osso(partes, ox, oy, (r() - 0.5) * 1.2 + (k % 2 ? 0.2 : -0.2), 0.5 + r() * 0.12, 0.055, 0.18, cor, r); }
  // A areia que cobre parte: dunas pequenas em veladura, claras do lado da luz.
  for (let k = 0; k < 4; k++) {
    const sx = -0.9 + k * 0.55 + (r() - 0.5) * 0.2, sy = (r() - 0.5) * 0.7, rx = 0.22 + r() * 0.18, ry = 0.14 + r() * 0.1;
    partes.push(poli(bolha(sx, sy, rx, ry, 12, 0.2, r), AREIA, 0.3, { ...S, alfa: 0.85, detalhe: 2 }), poli(bolha(sx + LUZ_X * rx * 0.2, sy + LUZ_Y * ry * 0.2, rx * 0.6, ry * 0.5, 10, 0.2, r), tom(AREIA, 0.15), 0.302, { ...S, alfa: 0.6, detalhe: 3 }));
  }
  return partes;
}

// ---------- Receitas ----------

const DE = { generos: ['deserto', 'fantasia'], kit: 'deserto' };
const luzMarroquina = (pendurada: boolean): LuzDeReceita => ({ raio: pendurada ? 4.5 : 3.5, cor: '#ffa858', intensidade: 0.8, power: 'fire', flicker: 0.12 });

/** O kit do deserto: tenda e casa (Q17a), caravana e mercado (Q17b). */
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

  // Q17b: caravana e mercado.
  { id: 'camelo', nome: 'Camelo', categoria: 'exterior', tipo: 'piso', funcoes: ['estrada', 'estabulo', 'jardim', 'patio'], ...DE, tags: ['camelo', 'dromedario', 'animal', 'montaria', 'caravana', 'carga', 'alforje', 'deserto'], pegada: [3.0, 1.05], altura: 2.1,
    campos: [{ id: 'pose', rotulo: 'Pose (0 em pé, 1 deitado)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }, { id: 'carga', rotulo: 'Carregado (0 não, 1 sim)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const c = camelo(p.seed, Math.round(num(p, 'pose', 0, 0, 1)) === 1, Math.round(num(p, 'carga', 0, 0, 1)) === 1); return piso(c.pegada, c.partes); } },
  { id: 'poco.oasis', nome: 'Poço do oásis', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'patio-com-fonte', 'praca', 'estrada'], ...DE, tags: ['poco', 'oasis', 'agua', 'adobe', 'roldana', 'balde', 'bebedouro', 'deserto'], pegada: [2.2, 2.2], altura: 2.2,
    gerar: p => piso([2.2, 2.2], pocoOasis(p.seed)) },
  { id: 'banca-de-especiarias', nome: 'Banca de especiarias', categoria: 'exterior', tipo: 'piso', funcoes: ['bazar', 'mercado', 'praca', 'loja'], ...DE, tags: ['banca', 'especiarias', 'mercado', 'souk', 'bazar', 'tempero', 'saco', 'balanca', 'deserto'], pegada: [2.2, 1.7], altura: 1.0,
    gerar: p => piso([2.2, 1.7], bancaDeEspeciarias(p.seed)) },
  { id: 'tapetes-pendurados', nome: 'Tapetes pendurados', categoria: 'exterior', tipo: 'piso', funcoes: ['bazar', 'mercado', 'praca', 'loja'], ...DE, tags: ['tapete', 'kilim', 'pendurado', 'venda', 'mercado', 'souk', 'bazar', 'vara', 'deserto'], pegada: [3.2, 0.9], altura: 2.0,
    gerar: p => piso([3.2, 0.9], tapetesPendurados(p.seed)) },
  { id: 'toldo-listrado', nome: 'Toldo listrado', categoria: 'exterior', tipo: 'piso', funcoes: ['bazar', 'mercado', 'praca', 'patio-com-fonte', 'varanda'], ...DE, tags: ['toldo', 'listrado', 'lona', 'sombra', 'mercado', 'souk', 'bazar', 'deserto'], pegada: [3.6, 3.1], altura: 2.6,
    campos: [{ id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 3.5, min: 2, max: 8, passo: 0.25 }, { id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2.5, min: 1.5, max: 5, passo: 0.25 }],
    gerar: p => { const C = num(p, 'comprimento', 3.5, 2, 8), L = num(p, 'largura', 2.5, 1.5, 5); return piso([Math.round((C + 0.1) * 100) / 100, Math.round((L + 0.6) * 100) / 100], toldoListrado(p.seed, C, L)); } },
  { id: 'palanquim', nome: 'Palanquim', categoria: 'exterior', tipo: 'piso', funcoes: ['estrada', 'praca', 'patio-com-fonte', 'salao'], ...DE, tags: ['palanquim', 'liteira', 'varas', 'nobre', 'cortina', 'ouro', 'caravana', 'deserto'], pegada: [3.2, 1.1], altura: 1.8,
    gerar: p => piso([3.2, 1.1], palanquim(p.seed)) },
  { id: 'cantaros-empilhados', nome: 'Cântaros empilhados', categoria: 'cozinha', tipo: 'piso', funcoes: ['deposito', 'cozinha', 'bazar', 'patio-com-fonte', 'mercado'], ...DE, tags: ['cantaro', 'jarro', 'barro', 'agua', 'pote', 'grupo', 'deposito', 'deserto'], pegada: [1.5, 1.1], altura: 0.8,
    gerar: p => piso([1.5, 1.1], cantarosEmpilhados(p.seed)) },
  { id: 'fogueira-de-caravana', nome: 'Fogueira de caravana', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['jardim', 'tenda', 'estrada'], ...DE, tags: ['fogueira', 'fogo', 'acampamento', 'caravana', 'cafe', 'dallah', 'pedras', 'brasa', 'deserto', 'luz', 'brilho'], pegada: [1.6, 1.6], altura: 1.0,
    luz: (): LuzDeReceita => ({ raio: 6.5, cor: '#ff9040', intensidade: 1.0, power: 'fire', flicker: 0.3 }),
    gerar: p => piso([1.6, 1.6], fogueiraDeCaravana(p.seed)) },
  { id: 'ossada-de-camelo', nome: 'Ossada de camelo', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'estrada'], ...DE, tags: ['ossos', 'ossada', 'camelo', 'esqueleto', 'cranio', 'areia', 'deserto', 'ermo'], pegada: [3.0, 1.7], altura: 0.35,
    gerar: p => piso([3.0, 1.7], ossadaDeCamelo(p.seed)) },
];
