import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { materialDe, tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { tira } from '../organico.ts';
import { mat, num, piso, type Receita } from './comum.ts';
import { setorDeAnel } from './praca.ts';

/**
 * Kit da mansão: móveis de época vistos de cima, pintados com volume (luz a noroeste, sombra a sudeste), para salões,
 * bibliotecas, salas de jantar e quartos de uma casa rica. A parede fica sempre do lado −y; a frente do móvel é +y.
 */
const K = { kit: 'mansao' };
const MOGNO = '#4a2418', MOGNO_CL = '#7a4028', LATAO = '#c9a24a', LATAO_CL = '#f0d27a', MARMORE = '#e4ded2', MARMORE_SOMBRA = '#a9a296', PORCELANA = '#f4f0e6';
const V = { contorno: 'leve' as const, detalhe: 2 as const }, D = { contorno: false as const, semSombra: true, detalhe: 3 as const };
const cor = (id: string): string => (id.startsWith('#') ? id : materialDe(id).base);

/** Retângulo girado como polígono. */
function retG(x: number, y: number, w: number, h: number, a: number): number[] {
  const c = Math.cos(a), s = Math.sin(a);
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].flatMap(([u, v]) => [x + u! * c - v! * s, y + u! * s + v! * c]);
}
/** Elipse girada como polígono. */
function elipseG(x: number, y: number, w: number, h: number, a: number, n = 18): number[] {
  const c = Math.cos(a), s = Math.sin(a), pts: number[] = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2, u = (Math.cos(t) * w) / 2, v = (Math.sin(t) * h) / 2; pts.push(x + u * c - v * s, y + u * s + v * c); }
  return pts;
}
/** Leva um ponto local (u, v) de um móvel em (x, y) girado de `a` para o mapa. */
const levar = (x: number, y: number, a: number, u: number, v: number): [number, number] => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];

/** Cadeira de jantar de espaldar estofado, com o encosto do lado −y local. */
function cadeira(partes: Parte[], x: number, y: number, a: number, estofado: string, z = 0.45): void {
  const e = cor(estofado);
  partes.push(poli(retG(x, y, 0.5, 0.5, a), MOGNO, z, V));
  partes.push(poli(retG(...levar(x, y, a, 0, 0.03), 0.4, 0.38, a), e, z + 0.02, { contorno: false, semSombra: true, detalhe: 2 }));
  partes.push(poli(retG(...levar(x, y, a, -0.04, 0), 0.24, 0.2, a), tom(e, 0.18), z + 0.03, D));
  partes.push(poli(retG(...levar(x, y, a, 0, -0.24), 0.52, 0.1, a), MOGNO_CL, z + 0.5, V));
}

/** Capitonê: botões em losango e os vincos entre eles, dentro do retângulo (x, y, w, h). */
function capitone(partes: Parte[], x: number, y: number, w: number, h: number, base: string, z: number): void {
  const nx = Math.max(2, Math.round(w / 0.22)), ny = Math.max(1, Math.round(h / 0.2)), dx = w / nx, dy = h / ny;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    if ((i + j) % 2) continue;
    const bx = x - w / 2 + i * dx, by = y - h / 2 + j * dy;
    if (i > 0 && j < ny) partes.push(tira([bx, by, bx - dx, by + dy], 0.018, tom(base, -0.55), z, D));
    if (i < nx && j < ny) partes.push(tira([bx, by, bx + dx, by + dy], 0.018, tom(base, -0.55), z, D));
    partes.push(elipse(bx, by, 0.055, 0.055, tom(base, -0.65), z + 0.002, D), elipse(bx - 0.01, by - 0.01, 0.022, 0.022, tom(base, 0.45), z + 0.003, D));
  }
}

/** Sofá Chesterfield: encosto e braços rolados da mesma altura, capitonê no encosto, almofadas de assento com brilho. */
function sofaCapitone(W: number, estofado: string): Parte[] {
  const e = cor(estofado), P = 0.95, partes: Parte[] = [];
  partes.push(ret(0, 0, W, P, tom(e, -0.35), 0.4, { raio: 0.1, ...V }));
  const n = W > 2 ? 3 : 2, wa = (W - 0.5) / n;
  for (let i = 0; i < n; i++) { const x = -W / 2 + 0.25 + wa * (i + 0.5); partes.push(ret(x, 0.14, wa - 0.03, 0.52, e, 0.5, { raio: 0.06, ...V }), ret(x - 0.04, 0.06, wa * 0.7, 0.16, tom(e, 0.22), 0.51, { raio: 0.05, ...D, alfa: 0.75 })); }
  partes.push(ret(0, -0.31, W - 0.04, 0.34, e, 0.85, { raio: 0.1, ...V }));
  capitone(partes, 0, -0.31, W - 0.5, 0.22, e, 0.86);
  partes.push(ret(0, -0.43, W - 0.2, 0.05, tom(e, 0.28), 0.87, { ...D, alfa: 0.7 }));
  for (const s of [-1, 1]) {
    partes.push(ret(s * (W / 2 - 0.13), 0.02, 0.26, P - 0.04, e, 0.8, { raio: 0.12, ...V }));
    partes.push(elipse(s * (W / 2 - 0.13), P / 2 - 0.12, 0.22, 0.16, tom(e, -0.25), 0.81, D));
    partes.push(ret(s * (W / 2 - 0.16), -0.02, 0.06, P - 0.3, tom(e, 0.25), 0.82, { ...D, alfa: 0.7 }));
  }
  return partes;
}

/** Poltrona de orelhas capitonê. */
function poltronaCapitone(estofado: string): Parte[] {
  const e = cor(estofado), partes: Parte[] = [ret(0, 0, 0.92, 0.92, tom(e, -0.35), 0.4, { raio: 0.12, ...V })];
  partes.push(ret(0, 0.12, 0.56, 0.56, e, 0.5, { raio: 0.08, ...V }), ret(-0.04, 0.04, 0.34, 0.16, tom(e, 0.22), 0.51, { raio: 0.05, ...D, alfa: 0.75 }));
  partes.push(ret(0, -0.32, 0.9, 0.28, e, 0.95, { raio: 0.1, ...V }));
  capitone(partes, 0, -0.33, 0.6, 0.16, e, 0.96);
  for (const s of [-1, 1]) partes.push(poli([s * 0.46, -0.44, s * 0.46, 0.4, s * 0.3, 0.44, s * 0.28, -0.2, s * 0.36, -0.46], e, 0.82, V), ret(s * 0.38, 0.0, 0.05, 0.5, tom(e, 0.25), 0.83, { ...D, alfa: 0.7 }));
  return partes;
}

/** Língua de fogo vista de cima. */
function chama(x: number, y: number, ang: number, len: number, larg: number, c: string, z: number, alfa: number): Parte {
  const cs = Math.cos(ang), sn = Math.sin(ang), loc = [-len * 0.25, 0, -len * 0.1, larg / 2, len * 0.35, larg * 0.4, len, 0, len * 0.35, -larg * 0.4, -len * 0.1, -larg / 2], pts: number[] = [];
  for (let i = 0; i < loc.length; i += 2) pts.push(x + loc[i]! * cs - loc[i + 1]! * sn, y + loc[i]! * sn + loc[i + 1]! * cs);
  return poli(pts, c, z, { contorno: false, semSombra: true, suave: true, alfa, detalhe: 2 });
}

/** Lareira nobre de mármore: lareira entalhada contra a parede (−y), com prateleira, mísulas, enfeites, boca com fogo e a soleira à frente. */
function lareiraNobre(W: number, fogo: boolean, seed: number): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], P = 1.1, yM = -P / 2 + 0.28;
  // Soleira de mármore à frente, com friso escuro.
  partes.push(ret(0, 0.22, W * 0.82, 0.62, MARMORE_SOMBRA, 0.04, { raio: 0.02, ...V }), ret(0, 0.21, W * 0.78, 0.56, MARMORE, 0.05, { raio: 0.02, contorno: false, semSombra: true, detalhe: 2 }));
  partes.push(ret(0, 0.21, W * 0.7, 0.46, tom(MARMORE, -0.08), 0.051, { ...D, alfa: 0.6 }));
  // Boca da lareira, toras e fogo.
  const bw = W * 0.46;
  partes.push(ret(0, 0.02, bw, 0.34, '#120b0a', 0.3, { raio: 0.03, contorno: 'leve' }), ret(0, -0.04, bw - 0.08, 0.16, '#2a1610', 0.31, D));
  if (fogo) {
    for (let k = 0; k < 3; k++) partes.push(poli(retG((k - 1) * bw * 0.22, 0.04 + (r() - 0.5) * 0.04, bw * 0.4, 0.07, (r() - 0.5) * 0.5), k % 2 ? '#3a2416' : '#4e3020', 0.33, V));
    partes.push(elipse(0, 0.04, bw * 0.75, 0.2, '#c8401a', 0.34, { ...D, suave: true, alfa: 0.9 }));
    for (let k = 0; k < 6; k++) partes.push(chama((r() - 0.5) * bw * 0.5, 0.06, -Math.PI / 2 + (r() - 0.5) * 0.7, 0.16 + r() * 0.08, 0.1, '#ff6a18', 0.36 + k * 0.002, 0.88));
    for (let k = 0; k < 4; k++) partes.push(chama((r() - 0.5) * bw * 0.35, 0.06, -Math.PI / 2 + (r() - 0.5) * 0.5, 0.11 + r() * 0.05, 0.065, '#ffd66a', 0.37 + k * 0.002, 0.92));
  }
  // Atiçadores em latão ao lado da boca.
  partes.push(ret(bw / 2 + 0.14, 0.2, 0.05, 0.05, LATAO, 0.6, V), tira([bw / 2 + 0.14, 0.2, bw / 2 + 0.18, 0.02], 0.015, '#2e2a26', 0.5, D));
  // Corpo da lareira: pilastras, verga entalhada e prateleira com mísulas.
  for (const s of [-1, 1]) {
    partes.push(ret(s * (W / 2 - 0.16), yM + 0.1, 0.3, 0.52, MARMORE_SOMBRA, 1.15, { raio: 0.02, ...V }), ret(s * (W / 2 - 0.17), yM + 0.08, 0.24, 0.46, MARMORE, 1.16, { contorno: false, semSombra: true, detalhe: 2 }));
    partes.push(ret(s * (W / 2 - 0.17), yM + 0.31, 0.2, 0.06, tom(MARMORE, -0.15), 1.17, D));
  }
  partes.push(ret(0, yM - 0.04, W, 0.34, MARMORE, 1.3, { raio: 0.02, ...V }));
  partes.push(ret(0, yM + 0.11, W - 0.04, 0.05, tom(MARMORE, -0.2), 1.31, D));
  for (let x = -W / 2 + 0.08; x < W / 2 - 0.05; x += 0.1) partes.push(ret(x, yM + 0.1, 0.05, 0.04, tom(MARMORE, 0.08), 1.32, D));
  partes.push(ret(-0.02, yM - 0.12, W - 0.1, 0.06, '#ffffff', 1.33, { ...D, alfa: 0.6 }));
  // Enfeites na prateleira: relógio, dois castiçais, vasos.
  partes.push(ret(0, yM - 0.08, 0.26, 0.14, MOGNO, 1.45, V), elipse(0, yM - 0.08, 0.1, 0.1, PORCELANA, 1.5, D));
  for (const s of [-1, 1]) { partes.push(elipse(s * W * 0.3, yM - 0.06, 0.1, 0.1, LATAO, 1.5, V), elipse(s * W * 0.3, yM - 0.06, 0.04, 0.04, '#fff2b8', 1.55, D)); partes.push(elipse(s * W * 0.42, yM - 0.06, 0.09, 0.09, '#3d5a7a', 1.45, V)); }
  return partes;
}

/** Luminária de pé com cúpula plissada e franja. */
function luminariaFranja(seed: number, cupula: string): Parte[] {
  const r = mulberry32(seed), c = cor(cupula), partes: Parte[] = [elipse(0.03, 0.04, 0.5, 0.5, '#000000', 0.05, { ...D, alfa: 0.25 })];
  partes.push(elipse(0, 0, 0.52, 0.52, tom(c, -0.3), 1.5, V), elipse(0, 0, 0.46, 0.46, c, 1.52, { contorno: false, semSombra: true, detalhe: 2 }));
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; partes.push(tira([Math.cos(a) * 0.08, Math.sin(a) * 0.08, Math.cos(a) * 0.23, Math.sin(a) * 0.23], 0.01, tom(c, -0.25), 1.53, D)); }
  for (let k = 0; k < 28; k++) { const a = (k / 28) * Math.PI * 2 + r() * 0.05; partes.push(elipse(Math.cos(a) * 0.255, Math.sin(a) * 0.255, 0.025, 0.025, LATAO, 1.54, D)); }
  partes.push(elipse(-0.06, -0.06, 0.18, 0.14, tom(c, 0.35), 1.53, { ...D, suave: true, alfa: 0.6 }), elipse(0, 0, 0.12, 0.12, '#fff3c8', 1.56, D), elipse(0, 0, 0.05, 0.05, LATAO_CL, 1.6, D));
  return partes;
}

/** Lustre de cristal visto de baixo para cima (de cima, no mapa): aro de latão, braços com velas e gotas de cristal. */
function lustre(Dm: number, bracos: number): Parte[] {
  const R = Dm / 2, partes: Parte[] = [];
  partes.push(setorDeAnelP(0, 0, R * 0.55, R * 0.62, LATAO, 3.0));
  for (let k = 0; k < bracos; k++) {
    const a = (k / bracos) * Math.PI * 2, x = Math.cos(a) * R * 0.85, y = Math.sin(a) * R * 0.85;
    partes.push(tira([Math.cos(a) * R * 0.15, Math.sin(a) * R * 0.15, x, y], 0.03, LATAO, 3.02, D));
    partes.push(elipse(x, y, 0.13, 0.13, LATAO_CL, 3.05, V), elipse(x, y, 0.06, 0.06, PORCELANA, 3.1, D), elipse(x, y, 0.05, 0.07, '#ffd66a', 3.15, { ...D, alfa: 0.95 }));
    const b = a + Math.PI / bracos; partes.push(elipse(Math.cos(b) * R * 0.7, Math.sin(b) * R * 0.7, 0.06, 0.09, '#dff2ff', 3.04, { ...D, alfa: 0.85 }));
  }
  for (let k = 0; k < bracos * 2; k++) { const a = (k / (bracos * 2)) * Math.PI * 2; partes.push(elipse(Math.cos(a) * R * 0.4, Math.sin(a) * R * 0.4, 0.05, 0.07, '#eaf8ff', 3.03, { ...D, alfa: 0.85 })); }
  partes.push(elipse(0, 0, R * 0.3, R * 0.3, LATAO, 3.1, V), elipse(0, 0, R * 0.16, R * 0.16, '#eaf8ff', 3.12, { ...D, alfa: 0.9 }), elipse(-R * 0.05, -R * 0.05, R * 0.06, R * 0.06, '#ffffff', 3.13, D));
  return partes;
}
const setorDeAnelP = (cx: number, cy: number, r0: number, r1: number, c: string, z: number): Parte => poli(setorDeAnel(cx, cy, r0, r1, 0, Math.PI * 2, 36), c, z, { contorno: 'leve', semSombra: true, detalhe: 2 });

/** Candelabro de pé (tocheiro de salão): base trípode, prato e cinco velas acesas. */
function candelabroDePe(): Parte[] {
  const partes: Parte[] = [elipse(0, 0, 0.4, 0.4, '#2e2a26', 0.1, V)];
  for (let k = 0; k < 3; k++) { const a = Math.PI / 2 + (k / 3) * Math.PI * 2; partes.push(tira([0, 0, Math.cos(a) * 0.2, Math.sin(a) * 0.2], 0.04, LATAO, 0.15, D)); }
  partes.push(elipse(0, 0, 0.34, 0.34, LATAO, 1.6, V));
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 - Math.PI / 2, x = k ? Math.cos(a) * 0.12 : 0, y = k ? Math.sin(a) * 0.12 : 0; partes.push(elipse(x, y, 0.06, 0.06, PORCELANA, 1.75, D), elipse(x, y, 0.035, 0.05, '#ffd66a', 1.8, { ...D, alfa: 0.95 })); }
  return partes;
}

/** Mesa de jantar oval posta: tampo lustrado, caminho de mesa, pratos, taças, talheres e castiçais; cadeiras em volta. */
function conjuntoDeJantar(W: number, estofado: string, toalha: string): { pegada: [number, number]; partes: Parte[] } {
  const H = 1.3, partes: Parte[] = [], n = Math.max(2, Math.floor((W - 0.6) / 0.62)), passo = (W - 0.7) / n;
  // Cadeiras dos lados e das cabeceiras.
  for (let i = 0; i < n; i++) { const x = -W / 2 + 0.35 + passo * (i + 0.5); cadeira(partes, x, -H / 2 - 0.22, 0, estofado); cadeira(partes, x, H / 2 + 0.22, Math.PI, estofado); }
  cadeira(partes, -W / 2 - 0.22, 0, -Math.PI / 2, estofado); cadeira(partes, W / 2 + 0.22, 0, Math.PI / 2, estofado);
  // Tampo.
  partes.push(elipse(0, 0, W, H, tom(MOGNO, -0.2), 0.74, V), elipse(0, 0, W - 0.06, H - 0.06, MOGNO, 0.75, { contorno: false, semSombra: true, detalhe: 1 }));
  partes.push(elipse(-W * 0.12, -H * 0.18, W * 0.5, H * 0.2, MOGNO_CL, 0.751, { ...D, suave: true, alfa: 0.55 }));
  partes.push(ret(0, 0, W - 0.7, 0.34, cor(toalha), 0.76, { raio: 0.02, contorno: false, semSombra: true, detalhe: 2 }), ret(0, 0, W - 0.78, 0.26, tom(cor(toalha), 0.15), 0.761, { ...D, alfa: 0.5 }));
  // Lugares postos.
  const lugar = (x: number, y: number, a: number): void => {
    partes.push(elipse(x, y, 0.26, 0.26, '#d8d2c6', 0.77, { contorno: 'leve', semSombra: true, detalhe: 2 }), elipse(x, y, 0.18, 0.18, PORCELANA, 0.771, D), elipse(x, y, 0.08, 0.08, tom('#3d5a7a', 0.3), 0.772, D));
    const [gx, gy] = levar(x, y, a, 0.16, -0.12); partes.push(elipse(gx, gy, 0.07, 0.07, '#cfe6ee', 0.78, { ...D, alfa: 0.8 }));
    for (const s of [-1, 1]) { const [tx, ty] = levar(x, y, a, s * 0.17, 0.02); partes.push(poli(retG(tx, ty, 0.02, 0.18, a), '#d8dde2', 0.773, D)); }
  };
  for (let i = 0; i < n; i++) { const x = -W / 2 + 0.35 + passo * (i + 0.5); lugar(x, -H / 2 + 0.2, 0); lugar(x, H / 2 - 0.2, Math.PI); }
  lugar(-W / 2 + 0.2, 0, -Math.PI / 2); lugar(W / 2 - 0.2, 0, Math.PI / 2);
  // Castiçais e fruteira no centro.
  for (const x of [-W * 0.22, W * 0.22]) partes.push(elipse(x, 0, 0.16, 0.16, LATAO, 0.85, V), ...[-0.06, 0, 0.06].map(dx => elipse(x + dx, 0, 0.035, 0.035, '#ffd66a', 0.9, D)));
  partes.push(elipse(0, 0, 0.3, 0.3, '#c9c4b8', 0.82, V), ...[[-0.05, -0.03, '#a8322a'], [0.05, 0.02, '#d9a23a'], [0, 0.06, '#6f8a2e'], [0.02, -0.06, '#7a2a4a']].map(([x, y, c]) => elipse(x as number, y as number, 0.09, 0.09, c as string, 0.85, V)));
  return { pegada: [W + 0.9, H + 0.9], partes };
}

/** Mesa de centro oval entalhada, com bandeja, livros e um vaso de flores. */
function mesaDeCentro(W: number, seed: number): Parte[] {
  const r = mulberry32(seed), H = W * 0.5, partes: Parte[] = [];
  partes.push(elipse(0, 0, W, H, tom(MOGNO, -0.25), 0.42, V), elipse(0, 0, W - 0.08, H - 0.08, MOGNO, 0.43, { contorno: false, semSombra: true, detalhe: 1 }), elipse(0, 0, W - 0.22, H - 0.2, tom(MOGNO, 0.08), 0.431, { ...D, alfa: 0.7 }));
  partes.push(elipse(-W * 0.12, -H * 0.15, W * 0.45, H * 0.25, MOGNO_CL, 0.432, { ...D, suave: true, alfa: 0.5 }));
  partes.push(elipse(W * 0.18, 0.02, 0.34, 0.24, LATAO, 0.46, V), elipse(W * 0.18 - 0.05, 0, 0.08, 0.08, PORCELANA, 0.5, D), elipse(W * 0.18 + 0.06, 0.02, 0.08, 0.08, PORCELANA, 0.5, D));
  partes.push(ret(-W * 0.2, 0.03, 0.26, 0.18, ['#7a1f24', '#2a3f6b', '#2f4a32'][Math.floor(r() * 3)]!, 0.46, { raio: 0.01, ...V }), ret(-W * 0.2 + 0.02, 0.01, 0.24, 0.16, '#3a2a20', 0.48, { raio: 0.01, ...V }));
  partes.push(elipse(0, -0.02, 0.16, 0.16, '#3d5a7a', 0.5, V), ...Array.from({ length: 5 }, () => elipse((r() - 0.5) * 0.14, -0.02 + (r() - 0.5) * 0.14, 0.07, 0.07, r() < 0.5 ? '#c8304a' : '#f0e0a0', 0.6, D)));
  return partes;
}

/** Mesa de carteado: tampo redondo de feltro verde com borda de mogno, cartas e fichas; quatro cadeiras em volta. */
function mesaDeCarteado(seed: number, estofado: string): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], R = 0.62;
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k / 4) * Math.PI * 2, d = R + 0.3; cadeira(partes, Math.cos(a) * d, Math.sin(a) * d, a + Math.PI / 2, estofado); }
  partes.push(elipse(0, 0, R * 2, R * 2, MOGNO, 0.74, V), elipse(0, 0, R * 2 - 0.14, R * 2 - 0.14, '#2f6a45', 0.75, { contorno: false, semSombra: true, detalhe: 2 }), elipse(-0.12, -0.12, R * 0.9, R * 0.7, '#3f8a5a', 0.751, { ...D, suave: true, alfa: 0.5 }));
  for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k / 4) * Math.PI * 2; for (let c = 0; c < 2; c++) partes.push(poli(retG(Math.cos(a) * R * 0.6 + c * 0.05, Math.sin(a) * R * 0.6, 0.1, 0.14, a + r() * 0.5), '#f4f0e6', 0.76 + c * 0.001, { contorno: 'leve', semSombra: true, detalhe: 3 })); }
  for (let k = 0; k < 9; k++) partes.push(elipse((r() - 0.5) * 0.3, (r() - 0.5) * 0.3, 0.06, 0.06, ['#c8304a', '#2a3f9b', '#f0f0f0'][k % 3]!, 0.78, { contorno: 'leve', semSombra: true, detalhe: 3 }));
  return partes;
}

/** Escadaria nobre de madeira (sobe de +y para −y): degraus de madeira clareando para cima, passadeira vermelha com varões de latão, balaústres, corrimão e pilares de arranque. */
function escadariaNobre(W: number, L: number, passadeira: string): Parte[] {
  const n = Math.max(4, Math.round(L / 0.3)), passo = L / n, partes: Parte[] = [ret(0, 0, W, L, '#1a0f0a', 0.05, V)], wc = W * 0.55, c = cor(passadeira);
  for (let i = 0; i < n; i++) {
    const y = L / 2 - (i + 0.5) * passo, t = i / (n - 1), z = 0.1 + i * 0.17, base = tom(MOGNO_CL, -0.35 + t * 0.35);
    partes.push(ret(0, y, W - 0.3, passo * 0.96, base, z, { contorno: 'leve', dir: 0, detalhe: 1 }));
    partes.push(ret(0, y + passo * 0.42, W - 0.32, 0.035, tom(base, 0.35), z + 0.004, { ...D, alfa: 0.8 }));
    if (i < n - 1) partes.push(ret(0, y - passo * 0.38, W - 0.3, passo * 0.2, '#000000', z + 0.003, { ...D, alfa: 0.35 }));
    partes.push(ret(0, y, wc, passo * 0.98, tom(c, -0.25 + t * 0.25), z + 0.006, { contorno: false, semSombra: true, detalhe: 2 }));
    partes.push(ret(0, y + passo * 0.4, wc, 0.03, tom(c, 0.2), z + 0.007, { ...D, alfa: 0.7 }));
    partes.push(ret(0, y - passo * 0.47, wc + 0.08, 0.025, LATAO, z + 0.008, D));
    partes.push(ret(-wc / 2 + 0.05, y, 0.03, passo * 0.9, LATAO, z + 0.007, { ...D, alfa: 0.5 }), ret(wc / 2 - 0.05, y, 0.03, passo * 0.9, LATAO, z + 0.007, { ...D, alfa: 0.5 }));
  }
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.08);
    for (let i = 0; i < n; i++) partes.push(elipse(x, L / 2 - (i + 0.5) * passo, 0.06, 0.06, MOGNO, 0.6 + i * 0.17, D));
    for (let k = 0; k < 3; k++) { const y = L / 2 - ((k + 0.5) * L) / 3; partes.push(ret(x, y, 0.1, L / 3 + 0.01, MOGNO_CL, 1.1 + (k + 0.5) * (n / 3) * 0.17, { raio: 0.04, ...V }), ret(x - 0.02, y, 0.03, L / 3, tom(MOGNO_CL, 0.35), 1.11 + (k + 0.5) * (n / 3) * 0.17, D)); }
    partes.push(ret(x, L / 2 - 0.1, 0.2, 0.2, MOGNO, 1.3, { raio: 0.03, ...V }), elipse(x, L / 2 - 0.1, 0.12, 0.12, LATAO, 1.4, V));
  }
  return partes;
}

/** Tapete redondo: anéis de cercadura, pétalas no campo e medalhão. */
function tapeteRedondo(Dm: number, material: string): Parte[] {
  const m = materialDe(material), R = Dm / 2, partes: Parte[] = [], B = m.borda ?? m.escuro, M = m.meio ?? m.claro;
  partes.push(elipse(0, 0, Dm + 0.06, Dm + 0.06, m.claro, 0.01, { contorno: false, semSombra: true }));
  partes.push(elipse(0, 0, Dm, Dm, B, 0.012, { contorno: 'leve', semSombra: true }));
  partes.push(poli(setorDeAnel(0, 0, R * 0.88, R * 0.92, 0, Math.PI * 2, 48), m.claro, 0.014, D));
  const nR = Math.round(R * 10);
  for (let k = 0; k < nR; k++) { const a = (k / nR) * Math.PI * 2; partes.push(elipse(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, R * 0.08, R * 0.08, M, 0.015, D), elipse(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8, R * 0.03, R * 0.03, m.claro, 0.016, D)); }
  partes.push(elipse(0, 0, R * 1.4, R * 1.4, m.base, 0.017, { contorno: false, semSombra: true, detalhe: 2 }));
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; partes.push(poli(elipseG(Math.cos(a) * R * 0.42, Math.sin(a) * R * 0.42, R * 0.34, R * 0.14, a, 12), M, 0.018, D)); }
  partes.push(elipse(0, 0, R * 0.5, R * 0.5, B, 0.019, D), elipse(0, 0, R * 0.32, R * 0.32, m.claro, 0.02, D), elipse(0, 0, R * 0.16, R * 0.16, M, 0.021, D));
  return partes;
}

export const RECEITAS_DA_MANSAO: Receita[] = [
  { id: 'lareira.nobre', nome: 'Lareira nobre', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala', 'sala-de-jantar', 'biblioteca', 'quarto', 'salao'], tags: ['lareira', 'marmore', 'fogo', 'mansao', 'entalhada'], pegada: [2.4, 1.1], altura: 1.6, ...K,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2.4, min: 1.6, max: 4, passo: 0.1 }, { id: 'fogo', rotulo: 'Acesa (0 não, 1 sim)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => { const W = num(p, 'largura', 2.4, 1.6, 4); return piso([W, 1.1], lareiraNobre(W, Math.round(num(p, 'fogo', 1, 0, 1)) === 1, p.seed)); } },
  { id: 'luminaria.franja', nome: 'Luminária de franja', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala', 'quarto', 'biblioteca', 'escritorio', 'salao'], tags: ['luminaria', 'abajur', 'franja', 'cupula', 'mansao'], pegada: [0.55, 0.55], altura: 1.6, ...K,
    campos: [{ id: 'cupula', rotulo: 'Cúpula', tipo: 'material', padrao: 'tecido.mostarda', uso: 'objeto' }],
    gerar: p => piso([0.55, 0.55], luminariaFranja(p.seed, mat(p, 'cupula', 'tecido.mostarda'))) },
  { id: 'lustre', nome: 'Lustre de cristal', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala', 'sala-de-jantar', 'salao', 'corredor'], tags: ['lustre', 'cristal', 'teto', 'velas', 'mansao'], pegada: [1.6, 1.6], altura: 3.2, ...K,
    campos: [{ id: 'diametro', rotulo: 'Diâmetro (m)', tipo: 'numero', padrao: 1.6, min: 0.8, max: 3, passo: 0.1 }, { id: 'bracos', rotulo: 'Braços', tipo: 'numero', padrao: 8, min: 4, max: 12, passo: 1 }],
    gerar: p => { const Dm = num(p, 'diametro', 1.6, 0.8, 3); return piso([Dm, Dm], lustre(Dm, Math.round(num(p, 'bracos', 8, 4, 12)))); } },
  { id: 'candelabro.pe', nome: 'Candelabro de pé', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala', 'salao', 'capela', 'sala-de-jantar', 'corredor'], tags: ['candelabro', 'tocheiro', 'velas', 'latao', 'mansao'], pegada: [0.42, 0.42], altura: 1.8, ...K,
    gerar: () => piso([0.42, 0.42], candelabroDePe()) },
  { id: 'jantar.posto', nome: 'Mesa de jantar posta', categoria: 'mesas', tipo: 'piso', funcoes: ['sala-de-jantar', 'salao'], tags: ['mesa', 'jantar', 'oval', 'cadeiras', 'pratos', 'banquete', 'mansao'], pegada: [4.5, 2.2], ...K,
    campos: [{ id: 'largura', rotulo: 'Comprimento da mesa (m)', tipo: 'numero', padrao: 3.6, min: 2, max: 7, passo: 0.2 }, { id: 'estofado', rotulo: 'Estofado', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }, { id: 'toalha', rotulo: 'Caminho de mesa', tipo: 'material', padrao: 'tecido.linho', uso: 'objeto' }],
    gerar: p => { const { pegada, partes } = conjuntoDeJantar(num(p, 'largura', 3.6, 2, 7), mat(p, 'estofado', 'tecido.veludo-vinho'), mat(p, 'toalha', 'tecido.linho')); return piso(pegada, partes); } },
  { id: 'sofa.capitone', nome: 'Sofá capitonê', categoria: 'assentos', tipo: 'piso', funcoes: ['sala', 'biblioteca', 'escritorio', 'salao'], tags: ['sofa', 'chesterfield', 'capitone', 'couro', 'mansao'], pegada: [2.2, 0.95], ...K,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2.2, min: 1.4, max: 3.4, passo: 0.1 }, { id: 'estofado', rotulo: 'Estofado', tipo: 'material', padrao: 'couro.marrom', uso: 'objeto' }],
    gerar: p => { const W = num(p, 'largura', 2.2, 1.4, 3.4); return piso([W, 0.95], sofaCapitone(W, mat(p, 'estofado', 'couro.marrom'))); } },
  { id: 'poltrona.capitone', nome: 'Poltrona capitonê', categoria: 'assentos', tipo: 'piso', funcoes: ['sala', 'biblioteca', 'escritorio', 'quarto', 'salao'], tags: ['poltrona', 'orelhas', 'capitone', 'couro', 'mansao'], pegada: [0.92, 0.92], ...K,
    campos: [{ id: 'estofado', rotulo: 'Estofado', tipo: 'material', padrao: 'tecido.veludo-azul', uso: 'objeto' }],
    gerar: p => piso([0.92, 0.92], poltronaCapitone(mat(p, 'estofado', 'tecido.veludo-azul'))) },
  { id: 'mesa.centro', nome: 'Mesa de centro oval', categoria: 'mesas', tipo: 'piso', funcoes: ['sala', 'biblioteca', 'salao'], tags: ['mesa', 'centro', 'oval', 'entalhada', 'mansao'], pegada: [1.4, 0.7], ...K,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 1.4, min: 0.8, max: 2.4, passo: 0.1 }],
    gerar: p => { const W = num(p, 'largura', 1.4, 0.8, 2.4); return piso([W, W * 0.5], mesaDeCentro(W, p.seed)); } },
  { id: 'mesa.carteado', nome: 'Mesa de carteado', categoria: 'mesas', tipo: 'piso', funcoes: ['sala-de-jogos', 'sala', 'taverna', 'salao'], tags: ['mesa', 'cartas', 'jogo', 'feltro', 'cadeiras', 'mansao'], pegada: [2.4, 2.4], ...K,
    campos: [{ id: 'estofado', rotulo: 'Estofado', tipo: 'material', padrao: 'couro.marrom', uso: 'objeto' }],
    gerar: p => piso([2.4, 2.4], mesaDeCarteado(p.seed, mat(p, 'estofado', 'couro.marrom'))) },
  { id: 'escadaria.nobre', nome: 'Escadaria nobre', categoria: 'decoracao', tipo: 'piso', funcoes: ['salao', 'corredor', 'sala'], tags: ['escada', 'escadaria', 'degraus', 'passadeira', 'corrimao', 'subida', 'mansao'], pegada: [2.4, 5], ...K,
    campos: [{ id: 'largura', rotulo: 'Largura (m)', tipo: 'numero', padrao: 2.4, min: 1.4, max: 5, passo: 0.1 }, { id: 'comprimento', rotulo: 'Comprimento (m)', tipo: 'numero', padrao: 5, min: 2.4, max: 9, passo: 0.1 }, { id: 'passadeira', rotulo: 'Passadeira', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }],
    gerar: p => { const W = num(p, 'largura', 2.4, 1.4, 5), L = num(p, 'comprimento', 5, 2.4, 9); return piso([W, L], escadariaNobre(W, L, mat(p, 'passadeira', 'tecido.veludo-vinho'))); } },
  { id: 'tapete.redondo', nome: 'Tapete redondo', categoria: 'tapetes', tipo: 'piso', funcoes: ['sala', 'quarto', 'biblioteca', 'escritorio'], tags: ['tapete', 'redondo', 'persa', 'mansao'], pegada: [2, 2], altura: 0.02, ...K,
    campos: [{ id: 'diametro', rotulo: 'Diâmetro (m)', tipo: 'numero', padrao: 2, min: 1, max: 4, passo: 0.1 }, { id: 'material', rotulo: 'Padrão', tipo: 'material', padrao: 'tapete.creme', uso: 'objeto' }],
    gerar: p => { const Dm = num(p, 'diametro', 2, 1, 4); return piso([Dm, Dm], tapeteRedondo(Dm, mat(p, 'material', 'tapete.creme'))); } },
];
