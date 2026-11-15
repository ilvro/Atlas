import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { bolha, sombraNoChao, tira } from '../organico.ts';
import { mulberry32 } from '../ruido.ts';
import { num, piso, type Receita } from './comum.ts';

/**
 * O kit de ficção científica (frente E3): ponte de comando, alojamento, sala técnica, enfermaria e laboratório de uma nave ou estação.
 * Visual retrofuturista: metal escuro, plástico bege, telas de tubo verdes e âmbar, faixas de alerta. Objetos de parede mostram a
 * face voltada para +y (a frente), como as lápides e as faces das paredes.
 */
const G = { tipo: 'piso' as const, generos: ['ficcao-cientifica'], kit: 'ficcao' };
const M = { base: '#5d646c', esc: '#2a2e34', cla: '#9aa2ab', fundo: '#16191d' }, BEGE = '#c9c2ae', BEGE_ESC = '#8f887a', BEGE_CLA = '#e2dccb';
const CRT = '#7af0a0', AMBAR = '#ffb347', CIANO = '#7ad8f0', VERMELHO = '#c9302c', AMARELO = '#d9a62a';
const LEVE = { contorno: 'leve' as const, detalhe: 2 as const }, MIUDO = { contorno: false as const, semSombra: true, detalhe: 3 as const };
const BRILHO = { contorno: false as const, semSombra: true, suave: true, detalhe: 2 as const };
const r0 = (seed: number) => mulberry32(seed * 6151 + 29);
const circulo = (cx: number, cy: number, rx: number, ry = rx, n = 32) => Array.from({ length: n + 1 }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; }).flat();

/** Uma tela acesa: moldura, vidro escuro, brilho e linhas de texto. */
function tela(x: number, y: number, w: number, h: number, cor: string, z: number, r: () => number): Parte[] {
  const partes: Parte[] = [ret(x, y, w, h, M.fundo, z, { contorno: 'leve', raio: 0.01 }), ret(x, y, w * 0.86, h * 0.8, '#0b1a12', z + 0.005, MIUDO),
    ret(x, y, w * 1.4, h * 1.6, cor, z + 0.006, { ...BRILHO, alfa: 0.12 })];
  for (let i = 0; i < 3; i++) partes.push(ret(x - w * 0.38 + (w * 0.5 * (0.4 + r() * 0.6)) / 2, y - h * 0.25 + i * h * 0.22, w * 0.5 * (0.4 + r() * 0.6), Math.max(0.01, h * 0.07), cor, z + 0.01, { ...MIUDO, alfa: 0.9 }));
  return partes;
}
/** Uma fileira de botões coloridos. */
function botoes(x0: number, x1: number, y: number, z: number, r: () => number, d = 0.035): Parte[] {
  const partes: Parte[] = [], cores = [VERMELHO, AMARELO, CRT, '#e8e2d2', CIANO, BEGE_ESC];
  for (let x = x0; x <= x1; x += d * 1.6) partes.push(ret(x, y, d, d, cores[Math.floor(r() * cores.length)]!, z, { ...MIUDO, raio: 0.005 }));
  return partes;
}
/** Faixa de alerta amarela e preta ao longo de x. */
function alerta(x: number, y: number, w: number, h: number, z: number): Parte[] {
  const partes: Parte[] = [ret(x, y, w, h, '#1a1a1a', z, { ...MIUDO, contorno: 'leve' })], n = Math.max(2, Math.round(w / (h * 1.4)));
  for (let i = 0; i < n; i += 2) { const a = x - w / 2 + (i * w) / n, b = a + w / n; partes.push(poli([a, y + h / 2, a + h * 0.6, y - h / 2, Math.min(b + h * 0.6, x + w / 2), y - h / 2, Math.min(b, x + w / 2), y + h / 2], AMARELO, z + 0.002, MIUDO)); }
  return partes;
}
/** Uma caixa de metal com bisel (luz de noroeste). */
const caixa = (x: number, y: number, w: number, h: number, z: number, cor = M.base, raio = 0.02): Parte[] => [
  ret(x, y, w, h, cor, z, { contorno: 'leve', raio }), poli([x - w / 2, y + h / 2, x - w / 2, y - h / 2, x + w / 2, y - h / 2, x + w / 2 - 0.03, y - h / 2 + 0.03, x - w / 2 + 0.03, y - h / 2 + 0.03, x - w / 2 + 0.03, y + h / 2 - 0.03], '#ffffff', z + 0.001, { ...MIUDO, alfa: 0.12 }),
];

export const RECEITAS_DE_FICCAO: Receita[] = [
  // ---------- Ponte de comando ----------
  { id: 'console', nome: 'Console de comando', ...G, categoria: 'mesas', funcoes: ['ponte-de-comando', 'laboratorio', 'sala-de-maquinas'], tags: ['console', 'painel', 'controle', 'nave', 'tela', 'computador'], pegada: [1.8, 0.8], altura: 1.1,
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.8, min: 0.9, max: 4.8, passo: 0.3 }],
    gerar: p => {
      const w = num(p, 'largura', 1.8, 0.9, 4.8), r = r0(p.seed), cor = r() < 0.5 ? CRT : AMBAR, n = Math.max(1, Math.round(w / 0.6)), partes: Parte[] = [];
      partes.push(...caixa(0, 0, w, 0.8, 0.9, M.esc), ret(0, -0.12, w - 0.08, 0.46, BEGE, 1.0, { contorno: 'leve', raio: 0.02 }), ret(0, 0.27, w - 0.08, 0.2, BEGE_ESC, 0.95, LEVE));
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * (w / n); partes.push(...tela(x, -0.18, Math.min(0.45, w / n - 0.1), 0.26, i === Math.floor(n / 2) ? AMBAR : cor, 1.05, r)); }
      partes.push(...botoes(-w / 2 + 0.12, w / 2 - 0.12, 0.05, 1.03, r), ...botoes(-w / 2 + 0.12, w / 2 - 0.12, 0.12, 1.03, r, 0.03));
      partes.push(ret(0, 0.28, Math.min(w - 0.4, 0.9), 0.12, '#2f3338', 0.97, { contorno: 'leve', raio: 0.01 }));
      for (let i = 0; i < 12; i++) partes.push(ret(-0.42 + i * 0.075, 0.28, 0.05, 0.05, BEGE_CLA, 0.98, MIUDO));
      return piso([w, 0.8], partes);
    } },
  { id: 'cadeira.piloto', nome: 'Cadeira de piloto', ...G, categoria: 'assentos', funcoes: ['ponte-de-comando', 'laboratorio', 'escritorio'], tags: ['cadeira', 'piloto', 'assento', 'nave', 'giratoria'], pegada: [0.72, 0.75], altura: 1.2,
    gerar: () => {
      const partes: Parte[] = [];
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + 0.3; partes.push(tira([0, 0, Math.cos(a) * 0.32, Math.sin(a) * 0.32], 0.05, M.esc, 0.12, MIUDO), elipse(Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0.06, 0.06, '#111', 0.1, MIUDO)); }
      partes.push(ret(0, 0.06, 0.56, 0.52, '#3b3f45', 0.5, { contorno: 'leve', raio: 0.1 }), ret(0, 0.07, 0.42, 0.4, BEGE_ESC, 0.52, { ...LEVE, raio: 0.08 }),
        poli([-0.3, -0.18, -0.24, -0.34, 0.24, -0.34, 0.3, -0.18, 0.26, -0.12, -0.26, -0.12], '#3b3f45', 1.15, { contorno: 'leve' }), ret(0, -0.25, 0.36, 0.08, BEGE_ESC, 1.17, MIUDO),
        ret(-0.31, 0.06, 0.07, 0.4, M.esc, 0.7, LEVE), ret(0.31, 0.06, 0.07, 0.4, M.esc, 0.7, LEVE), ret(0.31, 0.2, 0.05, 0.08, VERMELHO, 0.72, MIUDO));
      return piso([0.72, 0.75], partes);
    } },
  { id: 'mesa.navegacao', nome: 'Mesa de navegação', ...G, categoria: 'mesas', funcoes: ['ponte-de-comando'], tags: ['mesa', 'navegacao', 'mapa', 'estrelas', 'holograma', 'nave'], pegada: [2.0, 1.4], altura: 1.0,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [...caixa(0, 0, 2.0, 1.4, 0.9, M.esc, 0.08), ret(0, 0, 1.76, 1.16, '#08141c', 0.95, { contorno: 'leve', raio: 0.05 }), ret(0, 0, 1.9, 1.3, CIANO, 0.951, { ...BRILHO, alfa: 0.08 })];
      for (let i = 0; i < 40; i++) partes.push(elipse((r() - 0.5) * 1.6, (r() - 0.5) * 1.0, 0.02, 0.02, r() < 0.8 ? '#cfe8f0' : AMBAR, 0.96, MIUDO));
      for (const rr of [0.2, 0.36, 0.5]) partes.push(tira(circulo(0.1, 0, rr, rr * 0.8), 0.008, CIANO, 0.955, { ...MIUDO, alfa: 0.7 }));
      partes.push(elipse(0.1, 0, 0.08, 0.08, AMBAR, 0.96, MIUDO), elipse(0.46, -0.1, 0.05, 0.05, CIANO, 0.96, MIUDO), tira([-0.6, 0.3, -0.1, 0.1, 0.46, -0.1], 0.01, AMBAR, 0.957, { ...MIUDO, alfa: 0.8 }),
        ...botoes(-0.8, 0.8, 0.64, 0.97, r, 0.03));
      return piso([2.0, 1.4], partes);
    } },
  { id: 'terminal.crt', nome: 'Terminal de tubo', ...G, categoria: 'decoracao', funcoes: ['ponte-de-comando', 'laboratorio', 'escritorio', 'deposito', 'sala-de-maquinas'], tags: ['terminal', 'computador', 'crt', 'monitor', 'tela', 'teclado'], pegada: [0.6, 0.7], altura: 0.5,
    gerar: p => {
      const r = r0(p.seed), cor = r() < 0.6 ? CRT : AMBAR;
      return piso([0.6, 0.7], [ret(0, -0.1, 0.5, 0.42, BEGE, 0.45, { contorno: 'leve', raio: 0.04 }), ...[0, 1, 2, 3].map(i => ret(0, -0.24 + i * 0.04, 0.3, 0.012, BEGE_ESC, 0.46, MIUDO)),
        ...tela(0, 0.13, 0.42, 0.1, cor, 0.47, r), ret(0, 0.27, 0.5, 0.14, BEGE_ESC, 0.08, { contorno: 'leve', raio: 0.01 }), ...[0, 1].flatMap(j => Array.from({ length: 8 }, (_, i) => ret(-0.2 + i * 0.057, 0.245 + j * 0.05, 0.04, 0.035, BEGE_CLA, 0.09, MIUDO)))]);
    } },
  // ---------- Alojamento ----------
  { id: 'beliche.capsula', nome: 'Beliche-cápsula', ...G, categoria: 'camas', funcoes: ['cabine', 'dormitorio', 'quarto'], tags: ['beliche', 'capsula', 'cama', 'dormir', 'nave', 'alojamento'], pegada: [1.0, 2.2], altura: 1.4,
    gerar: p => {
      const r = r0(p.seed), coberta = ['#4a5a6a', '#6e4a3a', '#5a6a4a'][Math.floor(r() * 3)]!;
      return piso([1.0, 2.2], [ret(0, 0, 1.0, 2.2, BEGE, 1.3, { contorno: 'leve', raio: 0.4 }), ret(0, 0.05, 0.8, 1.96, '#3b3f45', 1.32, { ...LEVE, raio: 0.32 }),
        ret(0, 0.25, 0.72, 1.3, coberta, 1.34, { contorno: 'leve', raio: 0.08 }), ret(0, -0.62, 0.6, 0.3, '#e8e2d2', 1.35, { contorno: 'leve', raio: 0.1 }),
        ret(0, -0.62, 0.92, 0.7, 'vidro', 1.38, { contorno: 'leve', vidro: true, raio: 0.3, alfa: 0.55 }), ret(0.36, 0.3, 0.06, 0.06, CRT, 1.36, MIUDO), ret(0.36, 0.4, 0.06, 0.06, AMBAR, 1.36, MIUDO)]);
    } },
  { id: 'armario.metal', nome: 'Armário de metal', ...G, categoria: 'armazenamento', funcoes: ['cabine', 'dormitorio', 'deposito', 'baia-de-carga', 'sala-de-maquinas', 'hospital'], tags: ['armario', 'metal', 'lockers', 'guardar', 'nave'], pegada: [1.2, 0.5], altura: 1.9,
    campos: [{ id: 'portas', rotulo: 'Portas', tipo: 'numero', padrao: 3, min: 1, max: 6, passo: 1 }],
    gerar: p => {
      const n = Math.round(num(p, 'portas', 3, 1, 6)), w = n * 0.4, r = r0(p.seed), cor = [M.base, '#5a6a5a', '#6a5a4a'][Math.floor(r() * 3)]!, partes: Parte[] = [...caixa(0, -0.05, w, 0.4, 1.9, cor)];
      for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * 0.4; partes.push(ret(x, 0.2, 0.37, 0.1, cor, 1.0, { contorno: 'leve' }), ret(x + 0.12, 0.2, 0.03, 0.06, M.cla, 1.02, MIUDO), ...[0, 1, 2].map(k => ret(x - 0.06, -0.14 + k * 0.05, 0.16, 0.015, M.esc, 1.91, MIUDO)), ret(x, -0.22, 0.1, 0.04, BEGE_CLA, 1.92, MIUDO)); if (r() < 0.2) partes.push(ret(x, 0.27, 0.37, 0.12, M.esc, 0.5, { ...LEVE, alfa: 0.9 })); }
      return piso([w, 0.5], partes);
    } },
  { id: 'mesa.refeitorio', nome: 'Mesa de refeitório (bancos presos)', ...G, categoria: 'mesas', funcoes: ['refeitorio', 'cabine', 'baia-de-carga'], tags: ['mesa', 'refeitorio', 'banco', 'comer', 'nave', 'metal'], pegada: [2.4, 1.7], altura: 0.8,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [...caixa(0, 0, 2.4, 0.8, 0.78, M.cla, 0.03), ret(0, 0, 2.3, 0.7, '#b8bec5', 0.79, MIUDO)];
      for (const s of [-1, 1]) partes.push(ret(0, s * 0.68, 2.2, 0.3, M.base, 0.45, { contorno: 'leve', raio: 0.04 }), ret(0, s * 0.68, 2.1, 0.22, BEGE_ESC, 0.46, MIUDO));
      for (let i = 0; i < 4; i++) {
        if (r() < 0.3) continue; const x = -0.85 + i * 0.57, s = i % 2 ? 1 : -1;
        partes.push(ret(x, s * 0.2, 0.36, 0.26, '#8a9096', 0.8, { contorno: 'leve', raio: 0.03 }), elipse(x - 0.07, s * 0.2, 0.12, 0.12, ['#8a6a3c', '#6a7a4a', '#b8a070'][Math.floor(r() * 3)]!, 0.81, MIUDO), elipse(x + 0.1, s * 0.2 - 0.04, 0.08, 0.08, BEGE_CLA, 0.82, LEVE));
      }
      return piso([2.4, 1.7], partes);
    } },
  { id: 'criotubo', nome: 'Criotubo', ...G, categoria: 'camas', funcoes: ['criogenia', 'hospital', 'laboratorio'], tags: ['criotubo', 'hibernacao', 'capsula', 'criogenia', 'nave', 'vidro'], pegada: [1.1, 2.5], altura: 1.2,
    campos: [{ id: 'estado', rotulo: 'Estado (0 fechado, 1 aberto, 2 quebrado)', tipo: 'numero', padrao: 0, min: 0, max: 2, passo: 1 }],
    gerar: p => {
      const est = Math.round(num(p, 'estado', 0, 0, 2)), r = r0(p.seed), partes: Parte[] = [];
      sombraNoChao(partes, [-0.55, -1.2, 0.55, -1.2, 0.55, 1.2, -0.55, 1.2], 0.02, '#000000', 0.4);
      partes.push(ret(0, 0.05, 1.1, 2.35, BEGE, 0.8, { contorno: 'leve', raio: 0.45 }), ret(0, 0.1, 0.84, 2.0, '#d8e6ea', 0.85, { ...LEVE, raio: 0.36 }), ret(0, -1.08, 0.7, 0.24, M.esc, 1.0, { contorno: 'leve', raio: 0.06 }),
        ...tela(0, -1.1, 0.3, 0.12, CIANO, 1.02, r));
      if (est !== 1) partes.push(elipse(0, -0.55, 0.26, 0.24, '#b8c8cc', 0.86, { ...MIUDO, alfa: 0.7 }), ret(0, 0.25, 0.4, 1.1, '#b8c8cc', 0.86, { ...MIUDO, raio: 0.15, alfa: 0.6 }));
      if (est === 0) partes.push(ret(0, 0.1, 0.92, 2.08, 'vidro', 1.15, { contorno: 'leve', vidro: true, raio: 0.4, alfa: 0.6 }), ret(0, 0.1, 0.92, 2.08, '#e8f6ff', 1.16, { ...BRILHO, alfa: 0.25 }));
      if (est === 1) partes.push(ret(0.55, 0.25, 0.3, 1.9, 'vidro', 1.15, { contorno: 'leve', vidro: true, raio: 0.12, alfa: 0.55 }));
      if (est === 2) {
        for (let i = 0; i < 9; i++) { const x = (r() - 0.5) * 1.4, y = (r() - 0.5) * 2.4, a = r() * 6.28, l = 0.08 + r() * 0.18; partes.push(poli([x, y, x + Math.cos(a) * l, y + Math.sin(a) * l, x + Math.cos(a + 0.5) * l * 0.6, y + Math.sin(a + 0.5) * l * 0.6], '#cfe8f0', 0.9 + r() * 0.3, { contorno: 'leve', detalhe: 2, alfa: 0.75 })); }
        partes.push(poli(bolha(0.2, 0.7, 0.55, 0.35, 14, 0.3, r), '#6a9a8a', 0.03, { ...BRILHO, alfa: 0.5 }));
      }
      for (const s of [-1, 1]) partes.push(tira([s * 0.3, -1.2, s * 0.35, -1.45, s * 0.5, -1.55], 0.04, s < 0 ? '#2a2e34' : '#7a1f24', 0.05, MIUDO));
      return piso([1.1, 2.5], partes);
    } },
  // ---------- Técnico ----------
  { id: 'tubulacao', nome: 'Tubulação', ...G, categoria: 'decoracao', funcoes: ['sala-de-maquinas', 'corredor-tecnico', 'baia-de-carga'], tags: ['tubo', 'cano', 'tubulacao', 'industrial', 'nave', 'vapor'], pegada: [3, 0.6], altura: 0.6,
    campos: [{ id: 'largura', rotulo: 'Comprimento', tipo: 'numero', padrao: 3, min: 1, max: 12, passo: 0.5 }],
    gerar: p => {
      const w = num(p, 'largura', 3, 1, 12), r = r0(p.seed), partes: Parte[] = [], ys = [-0.18, 0.04, 0.22], ds = [0.2, 0.14, 0.1];
      ys.forEach((y, k) => {
        const cor = [M.base, '#6a5a4a', '#5a6a5a'][k]!;
        partes.push(ret(0, y, w, ds[k]!, cor, 0.5 - k * 0.1, { contorno: 'leve', raio: ds[k]! / 2 }), ret(0, y - ds[k]! * 0.22, w, ds[k]! * 0.18, M.cla, 0.501 - k * 0.1, { ...MIUDO, alfa: 0.5 }));
        for (let x = -w / 2 + 0.5; x < w / 2; x += 1) partes.push(ret(x, y, 0.06, ds[k]! + 0.05, M.esc, 0.51 - k * 0.1, MIUDO));
      });
      for (let x = -w / 2 + 0.25; x < w / 2; x += 1.5) partes.push(ret(x, 0.02, 0.06, 0.58, '#3b3f45', 0.55, LEVE));
      if (r() < 0.7) { const x = (r() - 0.5) * (w - 0.6); partes.push(tira(circulo(x, -0.18, 0.12), 0.03, VERMELHO, 0.62, LEVE), ret(x, -0.18, 0.2, 0.025, VERMELHO, 0.63, MIUDO)); }
      return piso([w, 0.6], partes);
    } },
  { id: 'grade.ventilacao', nome: 'Grade de ventilação (piso)', ...G, categoria: 'decoracao', funcoes: ['corredor-tecnico', 'sala-de-maquinas', 'eclusa', 'baia-de-carga'], tags: ['ventilacao', 'duto', 'grade', 'piso', 'nave'], pegada: [1.0, 1.0], altura: 0.02,
    gerar: p => {
      const r = r0(p.seed), aberta = r() < 0.25, partes: Parte[] = [ret(0, 0, 1.0, 1.0, M.esc, 0.02, { contorno: 'leve' }), ret(0, 0, 0.86, 0.86, '#07090b', 0.021, MIUDO)];
      for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + r(); partes.push(poli([0, 0, Math.cos(a) * 0.38, Math.sin(a) * 0.38, Math.cos(a + 0.5) * 0.36, Math.sin(a + 0.5) * 0.36], '#1f2328', 0.0215, MIUDO)); }
      if (!aberta) for (let i = 0; i < 9; i++) partes.push(ret(-0.38 + i * 0.095, 0, 0.035, 0.86, M.base, 0.025, MIUDO));
      else partes.push(ret(0.62, 0.1, 0.86, 0.86, M.base, 0.04, { contorno: 'leve', alfa: 0.95 }));
      for (const [x, y] of [[-0.44, -0.44], [0.44, -0.44], [-0.44, 0.44], [0.44, 0.44]] as const) partes.push(elipse(x, y, 0.035, 0.035, M.cla, 0.026, MIUDO));
      return piso([1.0, 1.0], partes);
    } },
  { id: 'painel.eletrico', nome: 'Painel elétrico', ...G, categoria: 'armazenamento', funcoes: ['sala-de-maquinas', 'corredor-tecnico', 'baia-de-carga', 'deposito'], tags: ['painel', 'eletrico', 'disjuntor', 'energia', 'nave', 'cabos'], pegada: [1.0, 0.7], altura: 1.8,
    gerar: p => {
      const r = r0(p.seed), aberto = r() < 0.5, partes: Parte[] = [...caixa(0, -0.08, 1.0, 0.34, 1.8, M.base), ...alerta(0, 0.12, 1.0, 0.06, 1.81), ret(0, -0.2, 0.3, 0.05, BEGE_CLA, 1.82, MIUDO)];
      if (aberto) {
        partes.push(ret(0, 0.18, 0.9, 0.08, '#1f2328', 0.9, { contorno: 'leve' }), ret(0.62, 0.32, 0.06, 0.48, M.base, 1.0, { contorno: 'leve' }));
        for (let i = 0; i < 10; i++) partes.push(ret(-0.38 + i * 0.085, 0.18, 0.05, 0.05, r() < 0.15 ? VERMELHO : BEGE_CLA, 0.92, MIUDO));
      } else partes.push(ret(0, 0.18, 0.92, 0.07, M.base, 0.9, LEVE), ret(0.3, 0.18, 0.05, 0.05, M.cla, 0.92, MIUDO));
      partes.push(tira([-0.3, 0.24, -0.4, 0.45, -0.2, 0.6], 0.04, '#111', 0.05, MIUDO), tira([0.1, 0.24, 0.2, 0.5, 0.45, 0.58], 0.035, '#7a1f24', 0.05, MIUDO));
      return piso([1.0, 0.7], partes);
    } },
  { id: 'gerador', nome: 'Gerador (núcleo)', ...G, categoria: 'decoracao', funcoes: ['sala-de-maquinas'], tags: ['gerador', 'reator', 'motor', 'energia', 'nucleo', 'nave'], pegada: [2.6, 2.6], altura: 2.5,
    gerar: p => {
      const r = r0(p.seed), cor = r() < 0.5 ? CIANO : AMBAR, oct = (rr: number) => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) * Math.PI) / 4; return [Math.cos(a) * rr, Math.sin(a) * rr]; }).flat();
      const partes: Parte[] = [poli(oct(1.3), M.esc, 0.4, { contorno: 'leve' }), poli(oct(1.16), M.base, 0.42, MIUDO)];
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; partes.push(tira([Math.cos(a) * 0.72, Math.sin(a) * 0.72, Math.cos(a) * 1.08, Math.sin(a) * 1.08], 0.07, i % 2 ? M.cla : M.base, 1.4, MIUDO)); }
      partes.push(tira(circulo(0, 0, 1.12), 0.12, AMARELO, 0.45, MIUDO), elipse(0, 0, 1.4, 1.4, M.esc, 1.6, { contorno: 'leve' }), elipse(0, 0, 1.1, 1.1, cor, 1.65, { ...BRILHO, alfa: 0.5 }),
        elipse(0, 0, 0.9, 0.9, '#2a2e34', 1.7, { contorno: 'leve' }), elipse(0, 0, 0.6, 0.6, cor, 1.75, { ...BRILHO, alfa: 0.85 }), elipse(0, 0, 0.3, 0.3, '#f4fbff', 1.8, MIUDO),
        ...[0, 1, 2, 3].map(k => { const a = (k / 4) * Math.PI * 2 + 0.785; return ret(Math.cos(a) * 0.55, Math.sin(a) * 0.55, 0.16, 0.16, M.esc, 2.2, LEVE); }));
      return piso([2.6, 2.6], partes);
    } },
  { id: 'caixa.carga', nome: 'Caixa de carga', ...G, categoria: 'armazenamento', funcoes: ['baia-de-carga', 'deposito', 'eclusa'], tags: ['caixa', 'carga', 'caixote', 'container', 'nave', 'industrial'], pegada: [1.2, 1.2], altura: 1.2,
    gerar: p => {
      const r = r0(p.seed), cor = ['#c79a2a', '#6a6f5a', '#8a3a24', '#5d646c', '#3f5a6a'][Math.floor(r() * 5)]!, partes: Parte[] = [...caixa(0, 0, 1.2, 1.2, 1.2, cor, 0.04), ret(0, 0, 1.0, 1.0, '#000000', 1.201, { ...MIUDO, alfa: 0.12 })];
      for (const [x, y] of [[-0.52, -0.52], [0.52, -0.52], [-0.52, 0.52], [0.52, 0.52]] as const) partes.push(ret(x, y, 0.16, 0.16, M.esc, 1.21, LEVE));
      partes.push(ret(0, 0, 1.2, 0.06, M.esc, 1.205, MIUDO), ret(0, 0, 0.06, 1.2, M.esc, 1.205, MIUDO), ret(-0.25, -0.28, 0.36, 0.12, '#e8e2d2', 1.21, { ...MIUDO, alfa: 0.8 }));
      for (let i = 0; i < 3; i++) partes.push(ret(0.2 + i * 0.07, 0.3, 0.04, 0.2, '#111', 1.21, { ...MIUDO, alfa: 0.7 }));
      return piso([1.2, 1.2], partes);
    } },
  { id: 'conteiner', nome: 'Contêiner', ...G, categoria: 'armazenamento', funcoes: ['baia-de-carga', 'deposito'], tags: ['conteiner', 'carga', 'container', 'porto', 'hangar', 'metal'], generos: ['ficcao-cientifica', 'moderno'], pegada: [6.0, 2.4], altura: 2.6,
    gerar: p => {
      const r = r0(p.seed), cor = ['#8a3a24', '#3f5a6a', '#6a6f5a', '#c79a2a', '#5d646c'][Math.floor(r() * 5)]!, partes: Parte[] = [];
      sombraNoChao(partes, [-3, -1.2, 3, -1.2, 3, 1.2, -3, 1.2], 0.02, '#000000', 0.35);
      partes.push(ret(0, 0, 6.0, 2.4, cor, 2.6, { contorno: 'leve' }));
      for (let x = -2.85; x < 3; x += 0.2) partes.push(ret(x, 0, 0.08, 2.3, '#000000', 2.601, { ...MIUDO, alfa: 0.18 }), ret(x + 0.06, 0, 0.03, 2.3, '#ffffff', 2.602, { ...MIUDO, alfa: 0.12 }));
      partes.push(ret(-2.95, 0, 0.1, 2.4, M.esc, 2.61, MIUDO), ret(2.95, 0, 0.1, 2.4, M.esc, 2.61, MIUDO));
      for (let i = 0; i < 5; i++) partes.push(elipse((r() - 0.5) * 5.4, (r() - 0.5) * 2, 0.4 + r() * 0.6, 0.2 + r() * 0.3, '#5a3a24', 2.605, { ...BRILHO, alfa: 0.35 }));
      return piso([6.0, 2.4], partes);
    } },
  { id: 'bancada.ferramentas', nome: 'Bancada de ferramentas', ...G, categoria: 'mesas', funcoes: ['sala-de-maquinas', 'oficina', 'baia-de-carga', 'deposito'], tags: ['bancada', 'ferramentas', 'oficina', 'reparo', 'nave', 'metal'], generos: ['ficcao-cientifica', 'moderno'], pegada: [2.0, 0.8], altura: 0.95,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [...caixa(0, 0, 2.0, 0.8, 0.9, M.base, 0.02), ret(0, 0, 1.9, 0.7, '#4a5056', 0.905, MIUDO), ret(-0.8, -0.2, 0.22, 0.3, M.esc, 1.0, LEVE), ret(-0.8, -0.05, 0.3, 0.06, M.cla, 1.02, MIUDO)];
      const ferr = [() => [tira([0, 0, 0.26, 0], 0.035, M.cla, 0.92, MIUDO), elipse(0.28, 0, 0.07, 0.07, M.cla, 0.92, MIUDO)], () => [ret(0, 0, 0.22, 0.03, M.cla, 0.92, MIUDO), ret(-0.14, 0, 0.1, 0.05, VERMELHO, 0.92, MIUDO)], () => [ret(0, 0, 0.16, 0.12, AMARELO, 0.95, LEVE), ret(0.05, 0, 0.04, 0.04, '#111', 0.96, MIUDO)], () => [elipse(0, 0, 0.12, 0.12, M.cla, 0.93, LEVE), elipse(0, 0, 0.05, 0.05, '#111', 0.94, MIUDO)]];
      for (let i = 0; i < 6; i++) { const x = -0.45 + r() * 1.3, y = (r() - 0.5) * 0.5, a = r() * 6.28; partes.push(...(ferr[Math.floor(r() * ferr.length)]!() as Parte[]).map(q => girar(q, x, y, a))); }
      return piso([2.0, 0.8], partes);
    } },
  { id: 'extintor', nome: 'Extintor', ...G, categoria: 'decoracao', funcoes: ['sala-de-maquinas', 'corredor-tecnico', 'ponte-de-comando', 'baia-de-carga', 'cozinha', 'deposito'], tags: ['extintor', 'incendio', 'seguranca', 'vermelho'], generos: ['ficcao-cientifica', 'moderno'], pegada: [0.3, 0.32], altura: 0.7,
    gerar: () => piso([0.3, 0.32], [elipse(0, 0, 0.22, 0.22, VERMELHO, 0.65, { contorno: 'leve' }), elipse(-0.03, -0.03, 0.1, 0.1, '#e86a5a', 0.66, MIUDO), ret(0, 0, 0.08, 0.06, '#1a1a1a', 0.72, LEVE), tira([0.03, 0.02, 0.1, 0.1, 0.06, 0.15], 0.03, '#1a1a1a', 0.7, MIUDO)]) },
  { id: 'cabos', nome: 'Cabos no chão', ...G, categoria: 'decoracao', funcoes: ['sala-de-maquinas', 'corredor-tecnico', 'baia-de-carga', 'ponte-de-comando', 'laboratorio'], tags: ['cabos', 'fios', 'eletrica', 'bagunca', 'nave'], generos: ['ficcao-cientifica', 'moderno'], pegada: [2.0, 0.7], altura: 0.06,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [], cores = ['#111', '#1a1a1a', '#7a1f24', '#2a3f6b', '#c79a2a'];
      for (let k = 0; k < 5; k++) { const pts: number[] = []; let y = (r() - 0.5) * 0.4; for (let x = -1; x <= 1.001; x += 0.25) { y += (r() - 0.5) * 0.18; y = Math.max(-0.3, Math.min(0.3, y)); pts.push(x, y); } partes.push(tira(pts, 0.03 + r() * 0.02, cores[k]!, 0.03 + k * 0.002, { contorno: 'leve', detalhe: 2 })); }
      partes.push(ret((r() - 0.5) * 1.2, (r() - 0.5) * 0.3, 0.16, 0.12, M.esc, 0.06, LEVE), ret(-0.98, 0, 0.06, 0.3, M.base, 0.05, MIUDO));
      return piso([2.0, 0.7], partes);
    } },
  { id: 'escotilha', nome: 'Escotilha com escada', ...G, categoria: 'decoracao', funcoes: ['corredor-tecnico', 'sala-de-maquinas', 'eclusa', 'baia-de-carga'], tags: ['escotilha', 'escada', 'alcapao', 'descer', 'nave', 'duto'], pegada: [1.0, 1.0], altura: 0.05,
    gerar: p => {
      const r = r0(p.seed), aberta = r() < 0.6, partes: Parte[] = [ret(0, 0, 1.0, 1.0, M.esc, 0.03, { contorno: 'leve', raio: 0.06 }), ...alerta(0, -0.45, 0.9, 0.06, 0.035), ...alerta(0, 0.45, 0.9, 0.06, 0.035)];
      if (aberta) {
        partes.push(ret(0, 0, 0.78, 0.78, '#050608', 0.031, { ...MIUDO, raio: 0.04 }), ret(-0.22, 0, 0.05, 0.78, M.base, 0.032, MIUDO), ret(0.22, 0, 0.05, 0.78, M.base, 0.032, MIUDO));
        for (let i = 0; i < 4; i++) partes.push(ret(0, -0.3 + i * 0.2, 0.44, 0.035, M.cla, 0.033 - i * 0.0003, { ...MIUDO, alfa: 1 - i * 0.2 }));
        partes.push(ret(0.75, 0, 0.5, 0.86, M.base, 0.06, { contorno: 'leve', raio: 0.05 }));
      } else partes.push(ret(0, 0, 0.82, 0.82, M.base, 0.04, { contorno: 'leve', raio: 0.05 }), tira(circulo(0, 0, 0.18), 0.04, M.cla, 0.05, LEVE), ret(0, 0, 0.36, 0.04, M.cla, 0.05, MIUDO));
      return piso([1.0, 1.0], partes);
    } },
  // ---------- Enfermaria e laboratório ----------
  { id: 'maca.medica', nome: 'Maca médica', ...G, categoria: 'camas', funcoes: ['hospital', 'laboratorio'], tags: ['maca', 'medico', 'enfermaria', 'cama', 'hospital', 'cirurgia'], generos: ['ficcao-cientifica', 'moderno'], pegada: [1.0, 2.3], altura: 1.0,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [ret(0, 0.05, 0.9, 2.1, M.cla, 0.8, { contorno: 'leve', raio: 0.06 }), ret(0, 0.1, 0.78, 1.9, '#d8e6ea', 0.85, { ...LEVE, raio: 0.08 }), ret(0, -0.7, 0.5, 0.3, '#f0f4f6', 0.87, { contorno: 'leve', raio: 0.1 })];
      for (const s of [-1, 1]) partes.push(ret(s * 0.47, 0.2, 0.04, 1.4, M.base, 0.95, LEVE));
      partes.push(tira([0.45, -1.1, 0.2, -0.95, 0.05, -0.85], 0.08, M.base, 1.9, LEVE), elipse(0.05, -0.85, 0.22, 0.22, BEGE, 1.95, { contorno: 'leve' }), elipse(0.05, -0.85, 0.14, 0.14, '#fff6d6', 1.96, MIUDO));
      partes.push(elipse(-0.55, -0.85, 0.12, 0.12, M.esc, 1.6, LEVE), ret(-0.55, -0.85, 0.12, 0.16, '#cfe8f0', 1.7, { ...LEVE, alfa: 0.8 }));
      if (r() < 0.4) partes.push(elipse(0.1, 0.4, 0.3, 0.2, '#6e1f2a', 0.88, { ...BRILHO, alfa: 0.5 }));
      return piso([1.0, 2.3], partes);
    } },
  { id: 'scanner.corpo', nome: 'Scanner de corpo', ...G, categoria: 'camas', funcoes: ['hospital', 'laboratorio'], tags: ['scanner', 'medico', 'diagnostico', 'anel', 'hospital', 'nave'], pegada: [1.6, 2.6], altura: 1.8,
    gerar: p => {
      const r = r0(p.seed), cor = r() < 0.5 ? CIANO : CRT;
      return piso([1.6, 2.6], [ret(0, 0.2, 0.7, 2.3, M.base, 0.6, { contorno: 'leve', raio: 0.08 }), ret(0, 0.2, 0.56, 2.1, '#d8e6ea', 0.7, { ...LEVE, raio: 0.1 }),
        ret(0, -0.35, 1.6, 0.7, BEGE, 1.7, { contorno: 'leve', raio: 0.3 }), ret(0, -0.35, 0.9, 0.5, '#2a2e34', 1.72, { ...LEVE, raio: 0.2 }), ret(0, -0.35, 1.0, 0.55, cor, 1.73, { ...BRILHO, alfa: 0.35 }),
        ...tela(0.55, -0.35, 0.3, 0.16, cor, 1.75, r), ...botoes(-0.65, -0.35, -0.5, 1.74, r, 0.03)]);
    } },
  { id: 'mesa.laboratorio', nome: 'Bancada de laboratório', ...G, categoria: 'mesas', funcoes: ['laboratorio', 'hospital'], tags: ['laboratorio', 'bancada', 'vidraria', 'ciencia', 'microscopio', 'amostras'], generos: ['ficcao-cientifica', 'moderno', 'investigacao'], pegada: [2.0, 0.9], altura: 0.95,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [...caixa(0, 0, 2.0, 0.9, 0.9, '#d8dcd8', 0.02), ret(0, 0, 1.9, 0.8, '#eef0ec', 0.905, MIUDO)];
      partes.push(ret(-0.65, -0.1, 0.22, 0.3, M.esc, 1.05, LEVE), elipse(-0.65, -0.18, 0.1, 0.1, '#111', 1.3, LEVE), elipse(-0.65, 0.04, 0.16, 0.12, M.base, 1.0, MIUDO));
      partes.push(ret(0.1, -0.22, 0.5, 0.12, M.base, 0.98, LEVE)); for (let i = 0; i < 6; i++) partes.push(elipse(-0.12 + i * 0.09, -0.22, 0.05, 0.05, ['#7a1f24', CRT, AMBAR, CIANO][Math.floor(r() * 4)]!, 1.05, MIUDO));
      for (let i = 0; i < 4; i++) { const x = 0.35 + r() * 0.5, y = 0.05 + r() * 0.25, d = 0.1 + r() * 0.08; partes.push(elipse(x, y, d, d, 'vidro', 1.0, { ...LEVE, vidro: true }), elipse(x, y, d * 0.6, d * 0.6, ['#7a1f24', CRT, AMBAR, CIANO][Math.floor(r() * 4)]!, 1.01, { ...MIUDO, alfa: 0.7 })); }
      partes.push(ret(-0.15, 0.22, 0.3, 0.22, 'papel.folha', 0.91, { ...MIUDO, alfa: 0.9 }));
      return piso([2.0, 0.9], partes);
    } },
  { id: 'armario.amostras', nome: 'Armário de amostras', ...G, categoria: 'armazenamento', funcoes: ['laboratorio', 'hospital', 'criogenia'], tags: ['amostras', 'frascos', 'armario', 'laboratorio', 'vidro', 'especime'], generos: ['ficcao-cientifica', 'moderno', 'investigacao'], pegada: [1.2, 0.55], altura: 1.9,
    gerar: p => {
      const r = r0(p.seed), partes: Parte[] = [...caixa(0, -0.08, 1.2, 0.36, 1.9, '#d8dcd8', 0.02), ret(0, 0.18, 1.14, 0.14, '#cfe8f0', 1.0, { contorno: 'leve', vidro: true, alfa: 0.6 })];
      for (let i = 0; i < 7; i++) { const x = -0.48 + i * 0.16; partes.push(elipse(x, -0.08, 0.1, 0.1, 'vidro', 1.92, { ...LEVE, vidro: true }), elipse(x, -0.08, 0.06, 0.06, ['#6a8a4a', '#8a6a3a', '#7a1f24', '#c9c2ae', CIANO][Math.floor(r() * 5)]!, 1.93, { ...MIUDO, alfa: 0.85 })); }
      for (let i = 0; i < 4; i++) partes.push(ret(-0.42 + i * 0.28, 0.22, 0.14, 0.04, BEGE_CLA, 1.01, MIUDO));
      return piso([1.2, 0.55], partes);
    } },
];

/** Gira e desloca uma parte (para espalhar ferramentas sobre a bancada). */
function girar(q: Parte, x: number, y: number, a: number): Parte {
  const c = Math.cos(a), s = Math.sin(a), t = (u: number, v: number): [number, number] => [x + u * c - v * s, y + u * s + v * c];
  if (q.forma === 'poli') return { ...q, pts: q.pts!.flatMap((v, i, arr) => (i % 2 ? [] : t(v, arr[i + 1]!))) };
  if (q.forma === 'ret') { const hw = q.w! / 2, hh = q.h! / 2, cx = q.x!, cy = q.y!; return { ...q, forma: 'poli', pts: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].flatMap(([u, v]) => t(cx + u!, cy + v!)) }; }
  const [nx, ny] = t(q.x!, q.y!); return { ...q, x: nx, y: ny };
}
