import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { bolha, sombraNoChao, tira } from '../organico.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';

/**
 * O kit de cemitério, de vida rural e de montanha (frente E2): cruzes, túmulos, covas, jazigo, anjo e grade de ferro; pás de moinho,
 * lenha, varal, galinheiro, espantalho, barril de chuva, poste de amarração, monte de neve, carroça de feno e a lanterna do farol.
 * Pedras e cruzes vistas de cima mostram a face voltada para +y (a frente), como as faces das paredes no estilo caixa: é o que as
 * faz serem lidas como lápides, e não como tracinhos.
 */
const G = { categoria: 'exterior' as const, tipo: 'piso' as const, kit: 'rural' };
const PEDRA = { base: '#7d7f86', esc: '#55575e', cla: '#a4a6ad', fundo: '#3d3f45' }, MUSGO = '#4f7a3a', TERRA = '#5a4330', TERRA_CLARA = '#7d6248', TERRA_ESC = '#3a2a1c';
const LEVE = { contorno: 'leve' as const, detalhe: 2 as const }, MIUDO = { contorno: false as const, semSombra: true, detalhe: 3 as const };
const r0 = (seed: number) => mulberry32(seed * 7919 + 17);

/** O contorno de uma pedra de túmulo vista de frente e deitada para +y: `v` = 0 é o pé (frente), 1 o topo (fundo). */
function silhuetaDaLapide(modelo: number, w: number, prof: number): number[] {
  const y = (v: number) => prof / 2 - v * prof, h = w / 2, pts: number[] = [];
  if (modelo === 1) { pts.push(-h, y(0), -h, y(0.62)); for (let i = 0; i <= 10; i++) { const a = Math.PI + (i / 10) * Math.PI; pts.push(Math.cos(a) * h, y(0.62 + 0.38 * -Math.sin(a))); } pts.push(h, y(0)); }
  else if (modelo === 2) pts.push(-h, y(0), -h, y(0.55), -h * 0.75, y(0.8), 0, y(1), h * 0.75, y(0.8), h, y(0.55), h, y(0));
  else if (modelo === 3) pts.push(-h, y(0), -h, y(0.7), -h * 0.4, y(0.78), -h * 0.15, y(0.6), h * 0.2, y(0.66), h * 0.5, y(0.42), h, y(0.48), h, y(0));
  else pts.push(-h, y(0), -h, y(0.92), -h * 0.92, y(1), h * 0.92, y(1), h, y(0.92), h, y(0));
  return pts;
}

/** Lápide em pé: plinto, face com a silhueta do modelo, inscrição e musgo. Modelos: 0 reta, 1 arredondada, 2 gótica, 3 quebrada, 4 inclinada. */
export function lapide(seed: number, modeloPedido: number): Parte[] {
  const r = r0(seed), modelo = modeloPedido > 0 ? Math.min(5, Math.round(modeloPedido)) - 1 : Math.floor(r() * 5), w = 0.5 + r() * 0.12, prof = 0.24;
  const tom = [PEDRA.base, '#8a8780', '#6f7378', '#9a958a'][Math.floor(r() * 4)]!, forma = modelo === 4 ? (r() < 0.5 ? 1 : 0) : modelo;
  const inclina = modelo === 4 ? (r() < 0.5 ? -1 : 1) * (0.12 + r() * 0.1) : 0;
  const giro = (pts: number[]) => pts.map((v, i) => (i % 2 ? v : v + inclina * (prof / 2 - pts[i + 1]!)));
  const sil = giro(silhuetaDaLapide(forma, w, prof));
  const partes: Parte[] = [
    ret(0, prof / 2 + 0.02, w + 0.1, 0.07, PEDRA.esc, 0.12, { contorno: 'leve' }),
    poli(sil, tom, 0.95, { contorno: 'leve' }),
    poli(giro(silhuetaDaLapide(forma, w * 0.82, prof * 0.8)), PEDRA.cla, 0.96, { ...MIUDO, alfa: 0.35 }),
  ];
  // Inscrição: uma cruz pequena ou linhas de texto gravadas.
  if (r() < 0.45) partes.push(ret(inclina * 0.02, -0.02, 0.016, 0.1, PEDRA.fundo, 0.97, MIUDO), ret(inclina * 0.02, -0.04, 0.07, 0.016, PEDRA.fundo, 0.97, MIUDO));
  else for (let i = 0; i < 3; i++) partes.push(ret(inclina * (0.04 - i * 0.03), -0.05 + i * 0.04, w * (0.55 - i * 0.12), 0.012, PEDRA.fundo, 0.97, { ...MIUDO, alfa: 0.7 }));
  if (modelo === 3) partes.push(poli([0.12, 0.2, 0.3, 0.15, 0.36, 0.24, 0.16, 0.3], tom, 0.08, { contorno: 'leve' }));
  if (r() < 0.6) partes.push(elipse((r() - 0.5) * w * 0.7, prof / 2 - 0.02, 0.14 + r() * 0.1, 0.06, MUSGO, 0.98, { ...MIUDO, suave: true, alfa: 0.8 }));
  return partes;
}

/** Uma cruz em pé vista como a lápide: haste e braço com a face para +y. */
function cruz(seed: number, pedra: boolean): Parte[] {
  const r = r0(seed), prof = 0.34, inclina = (r() - 0.5) * (pedra ? 0.06 : 0.22), m = pedra ? '#8a8780' : '#8a7a62', esc = pedra ? PEDRA.esc : '#4a3f30';
  const at = (x: number, v: number): [number, number] => [x + inclina * v, prof / 2 - v * prof];
  const quad = (x0: number, x1: number, v0: number, v1: number) => [...at(x0, v0), ...at(x0, v1), ...at(x1, v1), ...at(x1, v0)];
  const larg = pedra ? 0.13 : 0.11, braco = pedra ? 0.46 : 0.44, vb = pedra ? 0.62 : 0.66;
  const partes: Parte[] = [
    pedra ? ret(0, prof / 2 + 0.02, 0.32, 0.08, PEDRA.esc, 0.12, { contorno: 'leve' }) : elipse(0, prof / 2 + 0.01, 0.24, 0.07, TERRA, 0.05, { contorno: false, suave: true }),
    poli(quad(-larg / 2, larg / 2, 0, 1), m, 1.1, { contorno: 'leve' }),
    poli(quad(-braco / 2, braco / 2, vb, vb + (pedra ? 0.17 : 0.15)), m, 1.12, { contorno: 'leve' }),
  ];
  if (pedra) {
    const [cx, cy] = at(0, vb + 0.08), circ: number[] = [];
    for (let i = 0; i <= 24; i++) { const a = (i / 24) * Math.PI * 2; circ.push(cx + Math.cos(a) * 0.16, cy + Math.sin(a) * 0.1); }
    partes.push(tira(circ, 0.045, m, 1.13, { contorno: 'leve' }), elipse(cx, cy, 0.08, 0.06, PEDRA.cla, 1.14, MIUDO));
    if (r() < 0.6) partes.push(elipse(-0.05, prof / 2 - 0.05, 0.12, 0.05, MUSGO, 1.15, { ...MIUDO, suave: true, alfa: 0.75 }));
  } else {
    partes.push(poli(quad(-larg / 2, -larg / 2 + 0.02, 0, 1), esc, 1.11, { ...MIUDO, alfa: 0.6 }));
    const [nx, ny] = at(0, vb + 0.06); partes.push(elipse(nx, ny, 0.025, 0.02, 'ferro', 1.14, MIUDO));
    if (r() < 0.4) { const [px, py] = at(braco / 2 - 0.06, vb + 0.02); partes.push(poli([px - 0.04, py, px + 0.04, py, px + 0.03, py + 0.14, px - 0.03, py + 0.12], ['#e8e2d2', '#7a1f24', '#2a3f6b'][Math.floor(r() * 3)]!, 1.13, { ...MIUDO, alfa: 0.9 })); }
    if (r() < 0.35) { const [gx, gy] = at(0, vb + 0.06); partes.push(elipse(gx, gy, 0.16, 0.1, '#3f6a34', 1.15, { contorno: 'leve', suave: true, detalhe: 2 }), elipse(gx, gy, 0.08, 0.05, '#7d6248', 1.16, MIUDO)); }
  }
  return partes;
}

/** Monte de terra de cova (fechada), com a borda irregular e um pouco de capim. */
function monte(r: () => number, w: number, h: number, fresca: boolean): Parte[] {
  const pts = bolha(0, 0, w / 2, h / 2, 22, 0.08, r), partes: Parte[] = [];
  sombraNoChao(partes, pts, 0.02, '#1a120a', 0.45);
  partes.push(poli(pts, fresca ? TERRA : '#56603e', 0.1, { contorno: false, suave: true }), poli(bolha(-0.04, -0.04, w * 0.36, h * 0.4, 18, 0.1, r), fresca ? TERRA_CLARA : '#6b7a48', 0.12, { ...MIUDO, suave: true, alfa: 0.8 }));
  for (let i = 0; i < 6; i++) partes.push(elipse((r() - 0.5) * w * 0.7, (r() - 0.5) * h * 0.8, 0.05 + r() * 0.05, 0.04, fresca ? TERRA_ESC : '#3f5a2c', 0.13, { ...MIUDO, alfa: 0.7 }));
  return partes;
}

/** Uma prancha de madeira vista de cima, com veio. */
const prancha = (x: number, y: number, w: number, h: number, z: number, m = 'madeira.media') => [ret(x, y, w, h, m, z, { contorno: 'leve', dir: w >= h ? 0 : Math.PI / 2 }), ret(x, y - h * 0.25, w * 0.96, h * 0.12, 'madeira.clara', z + 0.005, { ...MIUDO, alfa: 0.35 })];

export const RECEITAS_RURAIS: Receita[] = [
  // ---------- Cemitério ----------
  { id: 'cruz.madeira', nome: 'Cruz de madeira', ...G, funcoes: ['cemiterio', 'jardim'], tags: ['cruz', 'cemiterio', 'tumulo', 'madeira', 'cova'], pegada: [0.45, 0.4], altura: 1.2,
    gerar: p => piso([0.45, 0.4], cruz(p.seed, false)) },
  { id: 'cruz.pedra', nome: 'Cruz de pedra', ...G, funcoes: ['cemiterio', 'jardim', 'capela'], tags: ['cruz', 'cemiterio', 'tumulo', 'pedra', 'celta'], pegada: [0.5, 0.45], altura: 1.4,
    gerar: p => piso([0.5, 0.45], cruz(p.seed, true)) },
  { id: 'tumulo', nome: 'Túmulo (laje)', ...G, funcoes: ['cemiterio', 'capela', 'porao'], tags: ['tumulo', 'cemiterio', 'laje', 'pedra', 'cova', 'sepultura'], pegada: [1.0, 2.2],
    gerar: p => {
      const r = r0(p.seed), tom = ['#8a8780', '#7d7f86', '#6f7378'][Math.floor(r() * 3)]!, partes: Parte[] = [];
      sombraNoChao(partes, [-0.55, -1.15, 0.55, -1.15, 0.55, 1.15, -0.55, 1.15], 0.02, '#120c08', 0.4);
      partes.push(ret(0, 0, 1.0, 2.2, PEDRA.esc, 0.25, { contorno: 'leve', raio: 0.03 }), ret(0, -0.02, 0.9, 2.08, tom, 0.3, { contorno: 'leve', raio: 0.02 }),
        ret(-0.02, -0.04, 0.84, 2.0, PEDRA.cla, 0.31, { ...MIUDO, alfa: 0.25 }));
      if (r() < 0.6) partes.push(ret(0, -0.35, 0.05, 0.7, PEDRA.esc, 0.32, MIUDO), ret(0, -0.5, 0.36, 0.05, PEDRA.esc, 0.32, MIUDO));
      else for (let i = 0; i < 4; i++) partes.push(ret(0, -0.6 + i * 0.12, 0.6 - (i % 2) * 0.16, 0.02, PEDRA.fundo, 0.32, { ...MIUDO, alfa: 0.7 }));
      if (r() < 0.5) partes.push(poli([-0.2, 0.3, 0.05, 0.45, 0.02, 0.62, 0.28, 0.8], PEDRA.fundo, 0.33, { ...MIUDO, alfa: 0.6 }));
      if (r() < 0.7) partes.push(elipse((r() - 0.5) * 0.6, 0.6 + r() * 0.4, 0.3, 0.16, MUSGO, 0.34, { ...MIUDO, suave: true, alfa: 0.7 }));
      if (r() < 0.45) partes.push(...lapide(p.seed + 3, 0).map(q => ({ ...q, ...(q.forma === 'poli' ? { pts: q.pts!.map((v, i) => (i % 2 ? v - 0.98 : v)) } : { y: q.y! - 0.98 }) })));
      return piso([1.0, 2.2], partes);
    } },
  { id: 'cova', nome: 'Cova (monte de terra)', ...G, funcoes: ['cemiterio'], tags: ['cova', 'cemiterio', 'terra', 'sepultura', 'monte'], pegada: [0.9, 1.9], campos: [{ id: 'fresca', rotulo: 'Fresca (1) ou antiga (0)', tipo: 'numero', padrao: 1, min: 0, max: 1, passo: 1 }],
    gerar: p => piso([0.9, 1.9], monte(r0(p.seed), 0.9, 1.9, num(p, 'fresca', 1, 0, 1) >= 0.5)) },
  { id: 'cova.aberta', nome: 'Cova aberta', ...G, funcoes: ['cemiterio'], tags: ['cova', 'cemiterio', 'buraco', 'terra', 'sepultura', 'pa'], pegada: [1.8, 2.4],
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [];
      partes.push(ret(-0.3, 0, 1.0, 2.1, TERRA_ESC, 0.02, { contorno: 'leve', raio: 0.04 }), ret(-0.3, 0.05, 0.86, 1.94, '#22180f', 0.03, { contorno: false, semSombra: true }),
        ret(-0.3, -0.92, 0.86, 0.14, TERRA, 0.035, { ...MIUDO, alfa: 0.8 }), ret(-0.71, 0, 0.06, 1.94, TERRA, 0.035, { ...MIUDO, alfa: 0.6 }), ret(-0.3, 0.1, 0.7, 1.7, '#0e0a06', 0.036, { ...MIUDO, suave: true, alfa: 0.7 }));
      const pilha = bolha(0.6, 0.1, 0.32, 0.95, 20, 0.12, r);
      sombraNoChao(partes, pilha, 0.03, '#120c08', 0.5);
      partes.push(poli(pilha, TERRA, 0.4, { contorno: false, suave: true }), poli(bolha(0.55, 0.05, 0.2, 0.7, 16, 0.15, r), TERRA_CLARA, 0.45, { ...MIUDO, suave: true }));
      for (let i = 0; i < 7; i++) partes.push(elipse(0.6 + (r() - 0.5) * 0.4, (r() - 0.5) * 1.6, 0.06, 0.05, TERRA_ESC, 0.46, { ...MIUDO, alfa: 0.7 }));
      if (r() < 0.75) partes.push(ret(0.62, -0.55, 0.05, 0.75, 'madeira.media', 0.9, { contorno: 'leve' }), ret(0.62, -0.08, 0.18, 0.22, 'ferro', 0.6, { contorno: 'leve', raio: 0.04 }), ret(0.62, -0.92, 0.14, 0.04, 'madeira.escura', 0.95, LEVE));
      return piso([1.8, 2.4], partes);
    } },
  { id: 'jazigo', nome: 'Jazigo (mausoléu)', ...G, funcoes: ['cemiterio'], tags: ['jazigo', 'mausoleu', 'cemiterio', 'tumulo', 'cripta', 'pedra', 'familia'], pegada: [2.6, 3.4], altura: 3.2,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [], pedra = ['#8a8780', '#7d7f86', '#9a958a'][Math.floor(r() * 3)]!;
      sombraNoChao(partes, [-1.3, -1.6, 1.3, -1.6, 1.3, 1.7, -1.3, 1.7], 0.02, '#120c08', 0.5);
      partes.push(ret(0, 0.1, 2.6, 3.2, PEDRA.esc, 0.3, { contorno: 'leve' }), ret(0, 1.45, 1.6, 0.3, pedra, 0.15, { contorno: 'leve' }), ret(0, 1.62, 1.8, 0.22, PEDRA.esc, 0.08, { contorno: 'leve' }));
      // Telhado em duas águas ao longo de y (cumeeira no meio), de ardósia; frontão de pedra na frente.
      partes.push(poli([-1.25, -1.45, 0, -1.45, 0, 1.15, -1.25, 1.15], 'telha.ardosia', 3.0, { contorno: 'leve', dir: Math.PI / 2 }),
        poli([0, -1.45, 1.25, -1.45, 1.25, 1.15, 0, 1.15], 'telha.ardosia', 3.0, { contorno: 'leve', dir: -Math.PI / 2 }),
        poli([0, -1.45, 1.25, -1.45, 1.25, 1.15, 0, 1.15], '#0b0d12', 3.01, { ...MIUDO, alfa: 0.35 }),
        ret(0, -0.15, 0.08, 2.6, PEDRA.cla, 3.05, { contorno: 'leve' }),
        poli([-1.3, 1.15, 1.3, 1.15, 0, 1.38], pedra, 3.02, { contorno: 'leve' }), poli([-0.9, 1.17, 0.9, 1.17, 0, 1.32], PEDRA.esc, 3.03, { ...MIUDO, alfa: 0.5 }));
      for (const x of [-0.7, 0.7]) partes.push(elipse(x, 1.3, 0.2, 0.2, PEDRA.cla, 2.6, { contorno: 'leve' }));
      partes.push(ret(0, 1.18, 0.12, 0.42, PEDRA.cla, 3.3, { contorno: 'leve' }), ret(0, 1.08, 0.32, 0.1, PEDRA.cla, 3.32, { contorno: 'leve' }));
      for (let i = 0; i < 4; i++) partes.push(elipse((r() - 0.5) * 2, (r() - 0.5) * 2.4, 0.3 + r() * 0.3, 0.2, MUSGO, 3.06, { ...MIUDO, suave: true, alfa: 0.55 }));
      return piso([2.6, 3.4], partes);
    } },
  { id: 'anjo', nome: 'Anjo de túmulo', ...G, funcoes: ['cemiterio', 'jardim', 'capela'], tags: ['anjo', 'estatua', 'cemiterio', 'pedra', 'tumulo'], pegada: [1.0, 0.9], altura: 1.8,
    gerar: p => {
      const r = r0(p.seed), M = '#b8b4aa', E = '#86827a', partes: Parte[] = [ret(0, 0.05, 0.62, 0.62, PEDRA.esc, 0.6, { contorno: 'leve' }), ret(0, 0.05, 0.5, 0.5, '#9a968c', 0.65, MIUDO)];
      for (const s of [-1, 1]) {
        const asa = [s * 0.08, -0.05, s * 0.3, -0.32, s * 0.48, -0.36, s * 0.46, -0.2, s * 0.38, 0.0, s * 0.24, 0.12, s * 0.1, 0.08];
        partes.push(poli(asa, M, 1.65, { contorno: 'leve' }));
        for (let k = 0; k < 4; k++) partes.push(lenteDePena(s * (0.18 + k * 0.07), -0.12 + k * 0.03, s, E));
      }
      partes.push(elipse(0, 0.1, 0.34, 0.3, M, 1.6, { contorno: 'leve' }), elipse(0, 0.14, 0.2, 0.16, E, 1.61, { ...MIUDO, alfa: 0.4 }), elipse(0, -0.02, 0.16, 0.16, M, 1.8, { contorno: 'leve' }),
        elipse(-0.03, -0.05, 0.08, 0.07, '#d0ccc2', 1.81, MIUDO));
      if (r() < 0.6) partes.push(elipse(0.1, 0.22, 0.2, 0.08, MUSGO, 1.62, { ...MIUDO, suave: true, alfa: 0.6 }));
      return piso([1.0, 0.9], partes);
    } },
  { id: 'grade.ferro', nome: 'Grade de ferro', ...G, funcoes: ['cemiterio', 'jardim'], tags: ['grade', 'ferro', 'cerca', 'cemiterio', 'limite'], pegada: [2.0, 0.14], altura: 1.4,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2, min: 0.6, max: 6, passo: 0.2 }],
    gerar: p => {
      const w = num(p, 'largura', 2, 0.6, 6), n = Math.max(3, Math.round(w / 0.14)), partes: Parte[] = [ret(0, 0, w, 0.06, 'ferro', 1.2, { contorno: 'leve' }), ret(0, -0.012, w, 0.015, '#6a6d77', 1.21, MIUDO)];
      for (let i = 0; i <= n; i++) { const x = -w / 2 + (i * w) / n; partes.push(elipse(x, 0, 0.06, 0.06, 'ferro', 1.35, { contorno: 'leve', detalhe: 2 }), elipse(x - 0.01, -0.01, 0.025, 0.025, '#7a7e88', 1.36, MIUDO)); }
      for (const x of [-w / 2, w / 2]) partes.push(ret(x, 0, 0.14, 0.14, 'ferro', 1.4, { contorno: 'leve' }), elipse(x, 0, 0.08, 0.08, '#6a6d77', 1.42, MIUDO));
      return piso([w, 0.14], partes);
    } },
  { id: 'portao.ferro', nome: 'Portão de ferro com pilares', ...G, funcoes: ['cemiterio', 'jardim'], tags: ['portao', 'ferro', 'cemiterio', 'entrada', 'pilar', 'pedra'], pegada: [2.6, 0.8], altura: 2.4,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [];
      for (const s of [-1, 1]) partes.push(ret(s * 1.1, 0, 0.42, 0.42, '#8a8780', 2.2, { contorno: 'leve' }), ret(s * 1.1, 0, 0.5, 0.5, PEDRA.cla, 2.4, { contorno: 'leve' }), elipse(s * 1.1, 0, 0.22, 0.22, '#9a968c', 2.5, LEVE));
      const aberto = r() < 0.4;
      for (const s of [-1, 1]) {
        const ang = aberto ? s * 0.9 : 0, x0 = s * 0.88, len = 0.86, ex = x0 - s * Math.cos(ang) * len, ey = Math.sin(Math.abs(ang)) * len;
        partes.push(tira([x0, 0, ex, ey], 0.07, 'ferro', 1.8, { contorno: 'leve' }));
        for (let k = 1; k < 8; k++) { const t = k / 8; partes.push(elipse(x0 + (ex - x0) * t, ey * t, 0.06, 0.06, '#5a5d66', 1.9, { contorno: 'leve', detalhe: 2 })); }
        partes.push(elipse(x0 + (ex - x0) * 0.5, ey * 0.5, 0.18, 0.1, 'ferro', 1.85, { contorno: 'leve', alfa: 0.9 }));
      }
      if (r() < 0.6) partes.push(elipse(-1.1 + (r() - 0.5) * 0.2, 0.15, 0.2, 0.1, MUSGO, 2.55, { ...MIUDO, suave: true, alfa: 0.6 }));
      return piso([2.6, 0.8], partes);
    } },

  // ---------- Rural e montanha ----------
  { id: 'pas.moinho', nome: 'Pás de moinho', ...G, funcoes: ['jardim'], tags: ['moinho', 'pas', 'velas', 'vento', 'madeira'], pegada: [7, 7], altura: 9,
    campos: [{ id: 'raio', rotulo: 'Raio das pás', tipo: 'numero', padrao: 3.5, min: 2, max: 6, passo: 0.25 }],
    gerar: p => {
      const R = num(p, 'raio', 3.5, 2, 6), r = r0(p.seed), partes: Parte[] = [], giro = 0.785 + (r() - 0.5) * 0.3, lona = r() < 0.7;
      for (let k = 0; k < 4; k++) {
        const a = giro + (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a), px = -s, py = c, at = (u: number, v: number) => [c * u + px * v, s * u + py * v];
        partes.push(tira([...at(0.2, 0), ...at(R, 0)], 0.1, 'madeira.escura', 8.6, { contorno: 'leve' }));
        const quadro = [...at(R * 0.22, 0.05), ...at(R * 0.98, 0.05), ...at(R * 0.98, R * 0.24), ...at(R * 0.22, R * 0.2)];
        partes.push(poli(quadro, lona ? '#d8ccaa' : 'madeira.clara', 8.5, { contorno: 'leve', alfa: lona ? 0.92 : 1 }));
        for (let i = 1; i <= 6; i++) { const u = R * (0.22 + (0.76 * i) / 6); partes.push(tira([...at(u, 0.05), ...at(u, R * (0.2 + 0.04 * (i / 6)))], 0.035, 'madeira.media', 8.55, MIUDO)); }
        partes.push(tira([...at(R * 0.22, R * 0.12), ...at(R * 0.98, R * 0.14)], 0.03, 'madeira.media', 8.55, MIUDO));
      }
      partes.push(elipse(0, 0, 0.6, 0.6, 'madeira.escura', 8.7, { contorno: 'leve' }), elipse(0, 0, 0.3, 0.3, 'ferro', 8.8, LEVE));
      return piso([2 * R, 2 * R], partes);
    } },
  { id: 'pilha-de-lenha', nome: 'Pilha de lenha', ...G, funcoes: ['jardim', 'cozinha', 'varanda'], tags: ['lenha', 'madeira', 'pilha', 'toras', 'inverno'], pegada: [1.8, 0.7], altura: 1.2,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [ret(0, 0, 1.8, 0.7, 'madeira.escura', 0.3, { contorno: 'leve' })];
      for (let fila = 0; fila < 3; fila++) for (let i = 0; i < 8; i++) {
        const x = -0.78 + i * 0.22 + (r() - 0.5) * 0.04, y = -0.22 + fila * 0.22, d = 0.17 + r() * 0.05;
        partes.push(ret(x, y, d, 0.2, ['madeira.media', 'madeira.escura', '#6b4a2e'][Math.floor(r() * 3)]!, 1.0 + fila * 0.02, { contorno: 'leve', dir: Math.PI / 2, raio: 0.06 }));
      }
      for (let i = 0; i < 9; i++) partes.push(elipse(-0.9, -0.28 + i * 0.07 + (r() - 0.5) * 0.02, 0.06, 0.07, '#c9a06a', 1.05, { contorno: 'leve', detalhe: 3 }), elipse(0.9, -0.28 + i * 0.07, 0.06, 0.07, '#b08850', 1.05, { contorno: 'leve', detalhe: 3 }));
      if (r() < 0.5) for (let i = 0; i < 4; i++) partes.push(poli(bolha(-0.6 + i * 0.4 + (r() - 0.5) * 0.1, -0.12 + (r() - 0.5) * 0.2, 0.18, 0.1, 10, 0.2, r), '#eef3f8', 1.12, { contorno: false, suave: true, detalhe: 2 }));
      return piso([1.8, 0.7], partes);
    } },
  { id: 'varal', nome: 'Varal com roupas', ...G, funcoes: ['jardim', 'quintal'], tags: ['varal', 'roupa', 'quintal', 'corda'], pegada: [3.2, 0.6], altura: 1.8,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [];
      for (const x of [-1.5, 1.5]) partes.push(ret(x, 0, 0.1, 0.1, 'madeira.escura', 1.8, { contorno: 'leve' }), ret(x, 0, 0.1, 0.4, 'madeira.media', 1.75, LEVE));
      partes.push(tira([-1.5, -0.12, 0, -0.08, 1.5, -0.12], 0.015, '#d8ccaa', 1.7, MIUDO), tira([-1.5, 0.12, 0, 0.16, 1.5, 0.12], 0.015, '#d8ccaa', 1.7, MIUDO));
      const cores = ['tecido.linho', '#7a1f24', '#2a3f6b', '#d8ccaa', 'tecido.cinza', '#8a9a7b'];
      let x = -1.25;
      while (x < 1.2) { const w = 0.3 + r() * 0.35, y = r() < 0.5 ? -0.06 : 0.18; partes.push(ret(x + w / 2, y, w, 0.2, cores[Math.floor(r() * cores.length)]!, 1.6, { contorno: 'leve', detalhe: 2 }), ret(x + w / 2, y - 0.08, w, 0.03, '#000000', 1.61, { ...MIUDO, alfa: 0.25 })); x += w + 0.08 + r() * 0.12; }
      return piso([3.2, 0.6], partes);
    } },
  { id: 'galinheiro', nome: 'Galinheiro', ...G, funcoes: ['jardim', 'quintal'], tags: ['galinheiro', 'galinha', 'quintal', 'fazenda', 'cercado'], pegada: [2.6, 2.0], altura: 1.6,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [ret(0.35, 0.2, 1.9, 1.6, '#5a4a34', 0.02, { contorno: false, suave: true }), ret(0.35, 0.2, 1.8, 1.5, TERRA, 0.03, { ...MIUDO, suave: true })];
      partes.push(poli([-1.3, -1.0, -0.1, -1.0, -0.1, 0.0, -1.3, 0.0], 'telha.tabuinhas', 1.6, { contorno: 'leve', dir: Math.PI }), ret(-0.7, -0.5, 0.06, 1.0, 'madeira.escura', 1.65, MIUDO),
        ret(-0.7, 0.04, 0.3, 0.12, 'madeira.media', 0.4, LEVE));
      for (const [ax, ay, bx, by] of [[-0.6, 0.0, 1.3, 0.0], [1.3, 0.0, 1.3, 1.0], [1.3, 1.0, -0.6, 1.0], [-0.6, 1.0, -0.6, 0.0]] as const) partes.push(tira([ax, ay, bx, by], 0.03, 'madeira.media', 0.9, { contorno: 'leve' }));
      for (let i = 0; i < 5; i++) { const x = -0.3 + r() * 1.4, y = 0.2 + r() * 0.65, a = r() * 6.28; partes.push(elipse(x, y, 0.2, 0.14, r() < 0.7 ? '#efe9dc' : '#9a5a2a', 0.25, { contorno: 'leve', detalhe: 2 }), elipse(x + Math.cos(a) * 0.1, y + Math.sin(a) * 0.07, 0.08, 0.08, '#efe9dc', 0.28, LEVE), elipse(x + Math.cos(a) * 0.13, y + Math.sin(a) * 0.09, 0.04, 0.03, '#c9302c', 0.3, MIUDO)); }
      return piso([2.6, 2.0], partes);
    } },
  { id: 'espantalho', nome: 'Espantalho', ...G, funcoes: ['jardim', 'quintal'], tags: ['espantalho', 'fazenda', 'plantacao', 'palha', 'horror'], pegada: [1.4, 0.6], altura: 1.9,
    gerar: p => {
      const r = r0(p.seed), roupa = ['#5a4a34', '#2a3f6b', '#6e1f2a'][Math.floor(r() * 3)]!, partes: Parte[] = [ret(0, 0, 1.3, 0.08, 'madeira.media', 1.5, { contorno: 'leve' })];
      partes.push(ret(-0.4, 0.04, 0.45, 0.2, roupa, 1.55, { contorno: 'leve' }), ret(0.4, 0.04, 0.45, 0.2, roupa, 1.55, { contorno: 'leve' }), ret(0, 0.06, 0.4, 0.34, roupa, 1.5, { contorno: 'leve' }));
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) partes.push(poli([s * 0.62, 0.0, s * (0.72 + r() * 0.06), -0.05 + i * 0.05, s * 0.62, 0.05], '#d9bb72', 1.56, MIUDO));
      partes.push(elipse(0, 0, 0.42, 0.42, '#b08f4e', 1.9, { contorno: 'leve' }), elipse(0, 0, 0.24, 0.24, '#8a6a3c', 1.92, LEVE), elipse(0, 0, 0.18, 0.18, '#584322', 1.93, MIUDO));
      if (r() < 0.5) partes.push(elipse(0.28, -0.1, 0.16, 0.1, '#14141a', 1.95, { contorno: 'leve', detalhe: 2 }));
      return piso([1.4, 0.6], partes);
    } },
  { id: 'barril-de-chuva', nome: 'Barril de chuva', ...G, funcoes: ['jardim', 'quintal', 'varanda'], tags: ['barril', 'agua', 'chuva', 'quintal'], pegada: [0.75, 0.75], altura: 1.0,
    gerar: () => {
      const aro = (rr: number) => Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return [Math.cos(a) * rr, Math.sin(a) * rr]; }).flat();
      return piso([0.75, 0.75], [elipse(0, 0, 0.72, 0.72, 'madeira.media', 0.95, { contorno: 'leve' }), elipse(0, 0, 0.58, 0.58, '#2c4250', 0.96, { contorno: 'leve' }),
        elipse(-0.08, -0.08, 0.3, 0.2, '#5d8aa0', 0.97, { ...MIUDO, suave: true, alfa: 0.6 }), tira(aro(0.335), 0.03, 'ferro', 0.98, MIUDO),
        ret(0.3, -0.3, 0.08, 0.08, 'ferro', 1.4, LEVE), ret(0.33, -0.12, 0.05, 0.3, 'ferro', 1.3, LEVE)]);
    } },
  { id: 'poste-de-amarracao', nome: 'Poste de amarração', ...G, funcoes: ['jardim', 'taverna'], tags: ['poste', 'amarracao', 'cavalo', 'rua', 'madeira'], pegada: [2.2, 0.3], altura: 1.1,
    gerar: p => { const r = r0(p.seed); return piso([2.2, 0.3], [...[-0.95, 0.95].map(x => ret(x, 0, 0.16, 0.16, 'madeira.escura', 1.05, { contorno: 'leve' })), ...prancha(0, 0, 2.2, 0.1, 1.1), ...(r() < 0.5 ? [tira([0.3, 0.02, 0.45, 0.12, 0.38, 0.2], 0.025, '#b08f4e', 1.12, MIUDO)] : [])]); } },
  { id: 'monte-de-neve', nome: 'Monte de neve', ...G, funcoes: ['jardim'], tags: ['neve', 'monte', 'inverno', 'gelo', 'natureza'], pegada: [2, 1.4], altura: 0.7,
    campos: [{ id: 'tamanho', rotulo: 'Tamanho', tipo: 'numero', padrao: 1, min: 0.4, max: 3, passo: 0.1 }],
    gerar: p => {
      const k = num(p, 'tamanho', 1, 0.4, 3), r = r0(p.seed), w = 2 * k, h = 1.4 * k, base = bolha(0, 0, w / 2 * 0.95, h / 2 * 0.95, 26, 0.12, r), partes: Parte[] = [];
      sombraNoChao(partes, base, 0.02, '#4a5a70', 0.5, [0.1, 0.12]);
      partes.push(poli(base, '#c9d4e0', 0.3 * k, { contorno: false, suave: true }), poli(bolha(-0.06 * w, -0.06 * h, w * 0.36, h * 0.34, 20, 0.14, r), '#e6ecf2', 0.32 * k, { ...MIUDO, suave: true }),
        poli(bolha(-0.12 * w, -0.12 * h, w * 0.18, h * 0.16, 16, 0.2, r), '#ffffff', 0.34 * k, { ...MIUDO, suave: true, alfa: 0.85 }));
      if (r() < 0.4) partes.push(tira([(r() - 0.5) * w * 0.4, h * 0.1, (r() - 0.5) * w * 0.4, h * 0.3], 0.03 * k, '#5a4430', 0.36 * k, MIUDO));
      return piso([w, h], partes);
    } },
  { id: 'carroca-de-feno', nome: 'Carroça de feno', ...G, funcoes: ['jardim', 'celeiro', 'estabulo'], tags: ['carroca', 'feno', 'fazenda', 'veiculo', 'madeira'], pegada: [3.2, 1.7], altura: 1.8,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [];
      for (const [x, y] of [[-0.9, -0.82], [-0.9, 0.82], [0.8, -0.82], [0.8, 0.82]] as const) partes.push(ret(x, y, 0.62, 0.1, 'madeira.escura', 0.7, { contorno: 'leve', raio: 0.04 }), ret(x, y, 0.1, 0.12, 'ferro', 0.75, MIUDO));
      partes.push(ret(-0.05, 0, 2.4, 1.5, 'madeira.media', 0.9, { contorno: 'leve', dir: 0 }), tira([1.15, -0.2, 1.6, -0.12], 0.06, 'madeira.escura', 0.8, LEVE), tira([1.15, 0.2, 1.6, 0.12], 0.06, 'madeira.escura', 0.8, LEVE));
      const feno = bolha(-0.05, 0, 1.15, 0.72, 24, 0.08, r);
      partes.push(poli(feno, '#b08f4e', 1.6, { contorno: 'leve', suave: true }), poli(bolha(-0.15, -0.1, 0.8, 0.45, 18, 0.12, r), '#d9bb72', 1.7, { ...MIUDO, suave: true }));
      for (let i = 0; i < 18; i++) { const x = -0.05 + (r() - 0.5) * 2, y = (r() - 0.5) * 1.2, a = r() * 3.14; partes.push(tira([x, y, x + Math.cos(a) * 0.2, y + Math.sin(a) * 0.2], 0.02, r() < 0.5 ? '#e8cf86' : '#8a6a3c', 1.75, MIUDO)); }
      return piso([3.2, 1.7], partes);
    } },
  { id: 'lanterna.farol', nome: 'Lanterna de farol', ...G, funcoes: ['jardim'], tags: ['farol', 'lanterna', 'luz', 'lente', 'torre', 'costa'], pegada: [3, 3], altura: 2.5,
    gerar: () => {
      const oct = (rr: number) => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) * Math.PI) / 4; return [Math.cos(a) * rr, Math.sin(a) * rr]; }).flat();
      const partes: Parte[] = [poli(oct(1.5), '#5d6168', 0.2, { contorno: 'leve' }), poli(oct(1.38), '#6e737a', 0.22, MIUDO)];
      for (let i = 0; i < 32; i++) { const a = (i / 32) * Math.PI * 2; partes.push(elipse(Math.cos(a) * 1.42, Math.sin(a) * 1.42, 0.05, 0.05, 'ferro', 1.1, MIUDO)); }
      partes.push(tira([...oct(1.42), ...oct(1.42).slice(0, 2)], 0.04, 'ferro', 1.15, { contorno: 'leve' }), poli(oct(0.95), 'vidro', 1.4, { contorno: 'leve', vidro: true }),
        poli(oct(0.95), '#ffe9a8', 1.41, { ...MIUDO, suave: true, alfa: 0.35 }), poli(oct(0.55), 'latao', 1.6, { contorno: 'leve' }),
        elipse(0, 0, 0.7, 0.7, '#ffd36a', 1.65, { ...MIUDO, suave: true, alfa: 0.55 }), elipse(0, 0, 0.32, 0.32, '#fff6d6', 1.7, MIUDO), poli(oct(0.3), '#9a6a2a', 2.4, { contorno: 'leve' }), elipse(0, 0, 0.12, 0.12, 'latao', 2.5, LEVE));
      return piso([3, 3], partes);
    } },
];

/** Uma pena da asa do anjo. */
function lenteDePena(x: number, y: number, s: number, cor: string): Parte {
  return poli([x, y, x + s * 0.08, y - 0.08, x + s * 0.11, y - 0.05, x + s * 0.03, y + 0.04], cor, 1.66, MIUDO);
}
