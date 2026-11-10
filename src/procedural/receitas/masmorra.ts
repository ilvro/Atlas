import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { mulberry32 } from '../ruido.ts';
import { tira } from '../organico.ts';
import { mat, parede, piso, type Receita } from './comum.ts';

const G = { generos: ['fantasia'], kit: 'fantasia' }, PEDRA = '#6e7078', PEDRA_ESC = '#3a3c42', ARDE = '#ff7a2a', CHAMA = '#ffc24a', BRASA = '#c8401a', AGUA = '#5d8aa0', CORDA = '#b89a62', CARVAO = '#1a1210';
const MIUDO = { contorno: false, semSombra: true, detalhe: 3 } as const, VOL = { contorno: 'leve', detalhe: 2 } as const;
/** Pontos de um círculo (ou elipse) fechado, para anéis feitos com `tira`. */
const anel = (cx: number, cy: number, rx: number, ry: number, n = 24): number[] => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cy + Math.sin((i / n) * Math.PI * 2) * ry]).flat();
/** Chamas vistas de cima: manchas laranja com miolo amarelo, espalhadas num disco. */
function chamas(r: () => number, cx: number, cy: number, raio: number, n: number, z: number): Parte[] {
  return Array.from({ length: n }, (_, i) => { const a = r() * 6.28, d = r() * raio, s = 0.07 + r() * 0.06, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d; return [elipse(x, y, s, s * 1.2, ARDE, z + i * 0.002, { ...MIUDO, suave: true }), elipse(x, y + s * 0.1, s * 0.5, s * 0.6, CHAMA, z + 0.05 + i * 0.002, { ...MIUDO, suave: true })]; }).flat();
}
const brasas = (r: () => number, cx: number, cy: number, raio: number, n: number, z: number): Parte[] =>
  Array.from({ length: n }, () => { const a = r() * 6.28, d = Math.sqrt(r()) * raio; return elipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.05 + r() * 0.04, 0.04 + r() * 0.03, r() < 0.3 ? CHAMA : BRASA, z, MIUDO); });

/** Fogo, ofícios, masmorra e acampamento: o que dá vida a forja, pátio, masmorra e acampamento. */
export const RECEITAS_DE_MASMORRA: Receita[] = [
  { id: 'braseiro', nome: 'Braseiro', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['sala', 'porao', 'capela', 'forja', 'jardim'], tags: ['braseiro', 'fogo', 'brasa', 'luz', 'tripe'], pegada: [0.7, 0.7], ...G,
    gerar: p => { const r = mulberry32(p.seed); return piso([0.7, 0.7], [elipse(0, 0, 0.56, 0.56, 'ferro', 0.5, {}), ...[Math.PI / 2, Math.PI * 1.17, Math.PI * 1.83].map(a => tira([0, 0, Math.cos(a) * 0.33, Math.sin(a) * 0.33], 0.05, '#4a4d56', 0.3, { contorno: 'leve', detalhe: 2 })), elipse(0, 0, 0.47, 0.47, '#2a1a14', 0.52, VOL), ...brasas(r, 0, 0, 0.19, 9, 0.54), ...chamas(r, 0, 0, 0.1, 4, 0.6)]); } },
  { id: 'fogueira', nome: 'Fogueira', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['jardim'], tags: ['fogueira', 'fogo', 'acampamento', 'lenha', 'chamas'], pegada: [1.1, 1.1], ...G,
    gerar: p => { const r = mulberry32(p.seed), n = 9 + Math.floor(r() * 3), a0 = r() * 6.28; return piso([1.1, 1.1], [
      elipse(0, 0, 0.96, 0.96, '#4a4743', 0.04, {}),
      ...Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * 6.28 + (r() - 0.5) * 0.2, d = 0.46 + (r() - 0.5) * 0.04, s = 0.16 + r() * 0.1; return elipse(Math.cos(a) * d, Math.sin(a) * d, s, s * (0.75 + r() * 0.2), r() < 0.5 ? PEDRA : r() < 0.5 ? PEDRA_ESC : '#80828a', 0.15 + r() * 0.03, VOL); }),
      ...Array.from({ length: 5 }, (_, i) => { const a = a0 + i * 1.26 + (r() - 0.5) * 0.3; return tira([-Math.cos(a) * 0.32, -Math.sin(a) * 0.32, Math.cos(a) * 0.32, Math.sin(a) * 0.32], 0.09 + r() * 0.03, i % 2 ? 'madeira.escura' : 'madeira.media', 0.2 + i * 0.03, VOL); }),
      ...brasas(r, 0, 0, 0.3, 8, 0.4), ...chamas(r, 0, 0, 0.15, 6, 0.46)]); } },
  { id: 'caldeirao', nome: 'Caldeirão em tripé', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['cozinha', 'taverna', 'jardim'], tags: ['caldeirao', 'tripe', 'sopa', 'caldo', 'panela', 'bruxa'], pegada: [0.9, 0.9], ...G,
    gerar: () => piso([0.9, 0.9], [elipse(0, 0, 0.6, 0.6, 'ferro', 0.6, {}), ...[Math.PI / 2, Math.PI * 1.17, Math.PI * 1.83].map(a => tira([0, 0, Math.cos(a) * 0.42, Math.sin(a) * 0.42], 0.045, '#4a4d56', 0.5, VOL)),
      elipse(0, 0, 0.46, 0.46, '#6a7a34', 0.66, VOL), ...[[-0.1, -0.08, 0.1], [0.12, 0.1, 0.08], [0.0, 0.14, 0.06]].map(([x, y, s]) => elipse(x!, y!, s!, s!, '#8a9a4a', 0.68, { ...MIUDO, suave: true })),
      tira([0.04, 0.0, 0.34, -0.22], 0.03, 'madeira.media', 0.8, VOL), elipse(0.04, 0.0, 0.1, 0.08, 'madeira.media', 0.8, VOL), tira(anel(0, 0, 0.07, 0.07, 14), 0.025, 'ferro', 1.2, MIUDO)]) },
  { id: 'espeto-de-assar', nome: 'Espeto de assar', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['cozinha', 'taverna', 'jardim'], tags: ['espeto', 'assado', 'churrasco', 'brasa', 'cozinha', 'forquilha'], pegada: [1.6, 0.7], ...G,
    gerar: p => { const r = mulberry32(p.seed); return piso([1.6, 0.7], [
      ret(0, 0.02, 1.0, 0.4, '#2a1a14', 0.05, { raio: 0.1 }), ...brasas(r, 0, 0.02, 0.4, 10, 0.1).map(b => ({ ...b, x: b.x! * 1.2, y: b.y! * 0.45 + 0.02 })),
      ...[-0.62, 0.62].flatMap(x => [ret(x, 0, 0.06, 0.5, 'madeira.escura', 0.12, VOL), ret(x, 0, 0.07, 0.07, 'madeira.media', 0.95, VOL), ret(x - 0.03, -0.04, 0.015, 0.1, 'madeira.escura', 0.97, MIUDO), ret(x + 0.03, -0.04, 0.015, 0.1, 'madeira.escura', 0.97, MIUDO)]),
      ret(0, 0, 1.5, 0.025, 'ferro', 0.9, VOL), elipse(0, 0, 0.55, 0.3, '#8a4a24', 0.95, { contorno: 'leve' }), elipse(-0.05, -0.05, 0.3, 0.1, '#b8743c', 0.97, { ...MIUDO, suave: true }), ...[-0.15, 0.05, 0.2].map(x => ret(x, 0.02, 0.012, 0.26, '#5a2e14', 0.98, MIUDO)),
      ret(0.76, 0.1, 0.03, 0.2, 'ferro', 1.0, VOL), elipse(0.76, 0.21, 0.07, 0.07, 'madeira.escura', 1.02, VOL)]); } },
  { id: 'tocha.parede', nome: 'Tocha de parede', categoria: 'parede', tipo: 'parede', funcoes: ['corredor', 'porao', 'taverna', 'capela', 'forja'], tags: ['tocha', 'fogo', 'luz', 'suporte', 'chama'], pegada: [0.3, 0.05], ...G,
    gerar: () => parede(0.3, [ret(0, 1.55, 0.12, 0.14, 'ferro', 0.04, { raio: 0.02 }), poli([-0.03, 1.5, 0.03, 1.5, 0.045, 2.1, -0.045, 2.1], 'madeira.escura', 0.05, { contorno: 'leve' }), ret(0, 1.78, 0.18, 0.04, 'ferro', 0.07, { contorno: 'leve', detalhe: 2 }), ret(0, 1.95, 0.1, 0.04, 'ferro', 0.07, { contorno: false, detalhe: 3 }), poli([0, 2.45, 0.11, 2.2, 0.08, 2.08, -0.08, 2.08, -0.11, 2.2], ARDE, 0.08, { contorno: false, semSombra: true, detalhe: 2 }), poli([0, 2.3, 0.05, 2.18, 0, 2.1, -0.05, 2.18], CHAMA, 0.09, { contorno: false, semSombra: true, detalhe: 3 })],
      [ret(0, 0.03, 0.12, 0.06, 'ferro', 1.55), tira([0, 0.05, 0, 0.15], 0.06, 'ferro', 1.8, { contorno: 'leve', detalhe: 2 }), elipse(0, 0.15, 0.08, 0.08, 'madeira.escura', 1.9, { contorno: 'leve' }), elipse(0, 0.15, 0.14, 0.14, ARDE, 2.1, { ...MIUDO, suave: true }), elipse(0, 0.15, 0.07, 0.07, CHAMA, 2.15, { ...MIUDO, suave: true })]) },

  { id: 'fornalha', nome: 'Fornalha de forja', categoria: 'lareira-e-luz', tipo: 'piso', funcoes: ['forja'], tags: ['fornalha', 'forja', 'ferreiro', 'carvao', 'fole', 'fogo'], pegada: [1.8, 1.4], ...G,
    gerar: p => { const r = mulberry32(p.seed); return piso([1.8, 1.4], [
      ret(-0.2, 0.1, 1.4, 1.2, 'tijolo', 0.9, { raio: 0.03 }), ret(-0.2, 0.2, 1.1, 0.7, CARVAO, 0.95, { raio: 0.04, contorno: 'leve' }), ...brasas(r, -0.2, 0.2, 0.4, 10, 0.97).map(b => ({ ...b, x: -0.2 + (b.x! + 0.2) * 1.25 })), ...chamas(r, -0.2, 0.2, 0.1, 3, 1.0),
      ret(-0.2, -0.52, 1.4, 0.36, PEDRA, 1.7, { raio: 0.02, contorno: 'leve' }), ret(-0.2, -0.52, 0.5, 0.22, PEDRA_ESC, 1.75, { contorno: false, detalhe: 2 }), ...[-0.7, 0.3].map(x => ret(x, -0.52, 0.02, 0.36, PEDRA_ESC, 1.76, MIUDO)),
      poli([0.9, -0.1, 0.9, 0.65, 0.62, 0.52, 0.62, 0.05], 'couro.marrom', 0.85, { contorno: 'leve' }), ...[0.69, 0.76, 0.83].map(x => ret(x, 0.3, 0.015, 0.55 - (0.9 - x) * 0.25, '#3a2a1a', 0.87, MIUDO)), ret(0.58, 0.3, 0.12, 0.05, 'ferro', 0.8, { detalhe: 2, contorno: 'leve' }), ret(0.88, 0.7, 0.04, 0.18, 'madeira.escura', 0.95, VOL)]); } },
  { id: 'pedra-de-amolar', nome: 'Pedra de amolar', categoria: 'decoracao', tipo: 'piso', funcoes: ['forja', 'jardim'], tags: ['amolar', 'afiar', 'roda', 'pedra', 'forja', 'cocho'], pegada: [0.9, 0.6], ...G,
    gerar: () => piso([0.9, 0.6], [ret(0, 0, 0.7, 0.34, 'madeira.escura', 0.3, { raio: 0.03 }), ret(0, 0, 0.62, 0.26, AGUA, 0.32, { contorno: 'leve', detalhe: 2, raio: 0.02 }),
      ...[-1, 1].map(s => ret(0, s * 0.2, 0.8, 0.05, 'madeira.escura', 0.7, VOL)), ret(0, 0, 0.56, 0.1, '#8a8c94', 0.85, { contorno: 'leve' }), ret(-0.08, 0, 0.3, 0.02, '#b4b6be', 0.87, MIUDO), ret(0, 0, 0.03, 0.44, 'ferro', 0.88, MIUDO),
      tira([0, 0.22, 0.2, 0.27], 0.03, 'ferro', 0.95, VOL), elipse(0.2, 0.27, 0.07, 0.07, 'madeira.escura', 1.0, VOL)]) },
  { id: 'tina-de-agua', nome: 'Tina d\'água', categoria: 'decoracao', tipo: 'piso', funcoes: ['forja', 'cozinha', 'jardim', 'banheiro'], tags: ['tina', 'agua', 'barrica', 'balde', 'banho'], pegada: [0.9, 0.9], ...G,
    gerar: () => piso([0.9, 0.9], [elipse(-0.08, -0.08, 0.72, 0.72, 'madeira.escura', 0.55, {}), elipse(-0.08, -0.08, 0.6, 0.6, AGUA, 0.5, VOL), elipse(-0.14, -0.14, 0.26, 0.2, '#8fb4c6', 0.52, { ...MIUDO, suave: true, alfa: 0.6 }),
      ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * 6.28 + 0.2; return tira([-0.08 + Math.cos(a) * 0.31, -0.08 + Math.sin(a) * 0.31, -0.08 + Math.cos(a) * 0.36, -0.08 + Math.sin(a) * 0.36], 0.025, 'ferro', 0.57, MIUDO); }),
      elipse(0.3, 0.3, 0.28, 0.28, 'madeira.media', 0.4, { contorno: 'leve' }), elipse(0.3, 0.3, 0.2, 0.2, AGUA, 0.42, MIUDO), tira([0.17, 0.3, 0.3, 0.17, 0.43, 0.3], 0.02, 'ferro', 0.6, MIUDO)]) },
  { id: 'roca-de-fiar', nome: 'Roca de fiar', categoria: 'decoracao', tipo: 'piso', funcoes: ['quarto', 'sala'], tags: ['roca', 'fiar', 'roda', 'la', 'fuso', 'tecelagem'], pegada: [0.9, 0.6], ...G,
    gerar: () => { const wx = -0.25, wy = -0.03; return piso([0.9, 0.6], [ret(-0.05, 0, 0.8, 0.1, 'madeira.escura', 0.4, { raio: 0.02 }), ret(-0.35, 0, 0.08, 0.4, 'madeira.escura', 0.3, VOL),
      ret(0, 0.22, 0.5, 0.14, 'madeira.media', 0.45, { ...VOL, raio: 0.02 }), tira(anel(wx, wy, 0.2, 0.09), 0.03, 'madeira.media', 0.8, { contorno: 'leve', detalhe: 2 }),
      ...[0, 1, 2, 3].map(i => { const a = (i * Math.PI) / 4 + 0.2; return tira([wx - Math.cos(a) * 0.19, wy - Math.sin(a) * 0.085, wx + Math.cos(a) * 0.19, wy + Math.sin(a) * 0.085], 0.015, 'madeira.clara', 0.78, MIUDO); }),
      elipse(wx, wy, 0.07, 0.05, 'latao', 0.85, { contorno: 'leve', detalhe: 3 }), ret(0.1, 0, 0.3, 0.05, 'madeira.media', 0.6, VOL), ret(0.2, -0.1, 0.22, 0.03, 'madeira.clara', 0.75, VOL), tira([0.07, 0, 0.12, -0.02], 0.012, '#e8e2d2', 0.9, MIUDO),
      ret(0.37, 0, 0.04, 0.04, 'madeira.escura', 1.0, MIUDO), elipse(0.37, 0, 0.16, 0.18, '#e8e2d2', 1.05, { contorno: 'leve', suave: true, detalhe: 2 })]); } },
  { id: 'tear', nome: 'Tear', categoria: 'decoracao', tipo: 'piso', funcoes: ['quarto', 'sala'], tags: ['tear', 'tecelagem', 'tecido', 'urdidura', 'pano', 'fiar'], pegada: [1.4, 1.1], ...G,
    gerar: p => { const r = mulberry32(p.seed), cores = ['#7a1f24', '#2a3f6b', '#2f4a32', '#d9a75e', '#e0d6b8', '#46291b'], pick = () => cores[Math.floor(r() * cores.length)]!; return piso([1.4, 1.1], [
      ret(0, 0, 1.4, 1.1, '#3a2a1a', 0.5, { raio: 0.03 }), ...Array.from({ length: 4 }, (_, i) => ret(0, 0.44 - i * 0.11, 1.1, 0.11, pick(), 0.55, { contorno: false, detalhe: 2 })),
      ...Array.from({ length: 7 }, (_, i) => ret(-0.5 + i * 0.167, -0.19, 0.012, 0.52, '#d8cfae', 0.56, MIUDO)),
      ret(0, -0.5, 1.4, 0.1, 'madeira.escura', 0.9, VOL), ret(0, 0.5, 1.4, 0.1, 'madeira.escura', 0.9, VOL), ...[-0.65, 0.65].map(x => ret(x, 0, 0.1, 1.1, 'madeira.media', 0.95, VOL)),
      ret(0, 0.0, 1.2, 0.04, 'madeira.clara', 0.8, VOL), ret(0.25, 0.28, 0.4, 0.04, 'madeira.clara', 0.85, VOL)]); } },
  { id: 'mo', nome: 'Mó de moinho', categoria: 'decoracao', tipo: 'piso', funcoes: ['cozinha', 'porao', 'jardim'], tags: ['mo', 'moinho', 'farinha', 'pedra', 'grao'], pegada: [0.9, 0.9], ...G,
    gerar: () => piso([0.9, 0.9], [elipse(0, 0, 0.9, 0.9, PEDRA, 0.3, {}), elipse(0, 0.38, 0.28, 0.1, '#e8e2d0', 0.32, { ...MIUDO, suave: true }), elipse(0, 0, 0.78, 0.78, '#80828a', 0.42, VOL),
      ...Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * 6.28 + 0.3; return tira([Math.cos(a) * 0.1, Math.sin(a) * 0.1, Math.cos(a) * 0.36, Math.sin(a) * 0.36], 0.03, PEDRA_ESC, 0.43, MIUDO); }),
      elipse(0, 0, 0.16, 0.16, PEDRA_ESC, 0.44, VOL), elipse(0.3, 0.12, 0.07, 0.07, 'madeira.escura', 0.75, { contorno: 'leve', detalhe: 2 }), ret(0.2, 0.12, 0.2, 0.03, 'madeira.media', 0.8, MIUDO)]) },

  { id: 'pelourinho', nome: 'Tronco de castigo', categoria: 'exterior', tipo: 'piso', funcoes: ['porao', 'jardim'], tags: ['tronco', 'pelourinho', 'castigo', 'prisao', 'masmorra'], pegada: [1.4, 0.5], ...G,
    gerar: () => piso([1.4, 0.5], [ret(0, 0, 1.1, 0.34, 'madeira.media', 1.0, { raio: 0.02 }), ...[-0.62, 0.62].map(x => ret(x, 0, 0.16, 0.5, 'madeira.escura', 0.1, VOL)), ...[-0.62, 0.62].map(x => ret(x, 0, 0.14, 0.34, 'madeira.escura', 1.7, { contorno: 'leve', raio: 0.02 })),
      ret(0, 0, 1.06, 0.012, '#2a1a10', 1.02, MIUDO), ...[[-0.3, 0.12], [0, 0.19], [0.3, 0.12]].map(([x, d]) => elipse(x!, 0, d!, d!, '#0e0a09', 1.03, { contorno: 'leve', detalhe: 2 })),
      ret(0.5, 0.19, 0.12, 0.06, 'ferro', 1.05, VOL), ret(0.5, 0.2, 0.06, 0.06, 'latao', 1.08, { contorno: 'leve', detalhe: 3 })]) },
  { id: 'gaiola-de-ferro', nome: 'Gaiola de ferro', categoria: 'decoracao', tipo: 'piso', funcoes: ['porao', 'jardim'], tags: ['gaiola', 'ferro', 'grade', 'prisao', 'masmorra', 'jaula'], pegada: [0.9, 0.9], ...G,
    gerar: () => { const R = 0.43, barras = [-0.28, 0, 0.28].flatMap(c => { const m = Math.sqrt(R * R - c * c) * 2 - 0.04; return [ret(c, 0, 0.035, m, 'ferro', 1.45, VOL), ret(0, c, m, 0.035, 'ferro', 1.46, VOL)]; }); return piso([0.9, 0.9], [
      elipse(0, 0, 0.86, 0.86, '#1a1614', 0.05, {}), tira([-0.2, 0.1, -0.08, 0.2], 0.03, '#d8cdb0', 0.08, MIUDO), elipse(0.18, -0.15, 0.1, 0.09, '#d8cdb0', 0.08, MIUDO),
      tira(anel(0, 0, R, R, 28), 0.05, 'ferro', 1.4, { contorno: 'leve' }), ...barras, tira(anel(0, 0, 0.07, 0.07, 14), 0.03, 'ferro', 1.8, VOL), elipse(0, 0, 0.05, 0.05, 'ferro', 1.7, MIUDO)]); } },
  { id: 'mesa-de-tortura', nome: 'Potro', categoria: 'mesas', tipo: 'piso', funcoes: ['porao'], tags: ['potro', 'tortura', 'masmorra', 'grilhoes', 'roldana', 'prisao'], pegada: [1.0, 2.2], ...G,
    gerar: () => piso([1.0, 2.2], [ret(0, 0, 0.8, 1.9, 'madeira.media', 0.75, { raio: 0.03 }), ...[-1, 1].map(s => ret(s * 0.38, 0, 0.09, 2.0, 'madeira.escura', 0.7, VOL)), ...[-0.3, 0, 0.3].map(x => ret(x, 0, 0.012, 1.8, '#4a3220', 0.76, MIUDO)),
      ...[-1, 1].flatMap(s => [ret(0, s * 0.88, 0.7, 0.16, 'madeira.clara', 0.9, { contorno: 'leve', detalhe: 2, raio: 0.04 }), ...[-0.18, 0.18].map(x => ret(x, s * 0.88, 0.04, 0.2, CORDA, 0.93, MIUDO)), ...[-0.18, 0.18].flatMap(x => [tira([x, s * 0.78, x, s * 0.62], 0.025, 'ferro', 0.8, MIUDO), elipse(x, s * 0.58, 0.1, 0.1, 'ferro', 0.82, VOL)])]),
      tira([0.44, -0.88, 0.46, -1.06], 0.04, 'ferro', 0.95, VOL), elipse(0.46, -1.06, 0.08, 0.08, 'madeira.escura', 0.98, VOL)]) },
  { id: 'grilhoes.parede', nome: 'Grilhões', categoria: 'parede', tipo: 'parede', funcoes: ['porao'], tags: ['grilhoes', 'correntes', 'algemas', 'masmorra', 'prisao', 'ferro'], pegada: [0.8, 0.05], ...G,
    gerar: () => parede(0.8, [elipse(0, 2.05, 0.16, 0.16, 'ferro', 0.05, {}), elipse(0, 2.05, 0.06, 0.06, '#1a1614', 0.06, MIUDO), ...[-1, 1].flatMap(s => [tira([s * 0.04, 2.0, s * 0.14, 1.8, s * 0.24, 1.62], 0.03, '#4a4d56', 0.06, { contorno: 'leve', detalhe: 2 }), ret(s * 0.27, 1.5, 0.15, 0.2, 'ferro', 0.07, { raio: 0.03, contorno: 'leve' }), ret(s * 0.27, 1.5, 0.07, 0.1, '#1a1614', 0.08, MIUDO)])],
      [ret(0, 0.03, 0.18, 0.06, 'ferro', 2.05), ...[-1, 1].flatMap(s => [tira([s * 0.04, 0.05, s * 0.27, 0.16], 0.03, '#4a4d56', 1.8, { contorno: 'leve', detalhe: 2 }), elipse(s * 0.27, 0.18, 0.13, 0.1, 'ferro', 1.5, VOL), elipse(s * 0.27, 0.18, 0.06, 0.04, '#1a1614', 1.52, MIUDO)])]) },

  { id: 'tenda', nome: 'Tenda', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim'], tags: ['tenda', 'acampamento', 'lona', 'barraca', 'viagem'], pegada: [2.4, 2.8], ...G,
    campos: [{ id: 'lona', rotulo: 'Lona', tipo: 'material', padrao: 'tecido.linho', uso: 'objeto' }],
    gerar: p => { const l = mat(p, 'lona', 'tecido.linho'); return piso([2.4, 2.8], [
      ret(-0.525, 0, 1.05, 2.6, l, 1.1, { dir: 0 }), ret(0.525, 0, 1.05, 2.6, l, 1.1, { dir: 0 }), ret(0.525, 0, 1.05, 2.6, '#000000', 1.12, { contorno: false, semSombra: true, suave: true, alfa: 0.16, detalhe: 2 }),
      ret(0, 0, 0.06, 2.8, 'madeira.escura', 1.7, VOL), poli([-0.5, 1.3, 0.5, 1.3, 0, 0.55], '#15100c', 1.2, { contorno: 'leve' }), poli([-0.5, 1.3, -0.1, 1.3, -0.5, 0.9], l, 1.25, VOL), poli([0.5, 1.3, 0.1, 1.3, 0.5, 0.9], l, 1.25, VOL),
      ...[-1, 1].map(s => elipse(0, s * 1.36, 0.1, 0.1, 'madeira.clara', 1.75, VOL)), ...[-1, 1].flatMap(s => [-1.0, 0, 1.0].flatMap(y => [tira([s * 1.05, y, s * 1.17, y], 0.015, CORDA, 0.3, MIUDO), ret(s * 1.18, y, 0.07, 0.07, 'madeira.escura', 0.3, MIUDO)]))]); } },
  { id: 'estandarte', nome: 'Estandarte', categoria: 'exterior', tipo: 'piso', funcoes: ['jardim', 'sala', 'corredor'], tags: ['estandarte', 'bandeira', 'brasao', 'heraldica', 'pendao'], pegada: [0.6, 0.9], ...G,
    campos: [{ id: 'cor', rotulo: 'Pano', tipo: 'material', padrao: 'tecido.veludo-azul', uso: 'objeto' }],
    gerar: p => piso([0.6, 0.9], [poli([-0.22, -0.28, 0.22, -0.28, 0.22, 0.4, 0, 0.28, -0.22, 0.4], mat(p, 'cor', 'tecido.veludo-azul'), 0.9, {}), elipse(0, -0.32, 0.28, 0.28, 'madeira.escura', 0.2, VOL),
      ret(0, -0.26, 0.46, 0.035, '#d9a75e', 0.95, { contorno: false, detalhe: 3 }), poli([0, 0.0, 0.1, 0.1, 0, 0.22, -0.1, 0.1], '#d9a75e', 0.95, { contorno: false, semSombra: true, detalhe: 3 }), poli([0, 0.06, 0.05, 0.1, 0, 0.16, -0.05, 0.1], '#7a1f24', 0.96, MIUDO),
      ret(0, -0.32, 0.05, 0.05, 'madeira.clara', 1.95, VOL), elipse(0, -0.32, 0.09, 0.09, 'latao', 2.0, { contorno: 'leve', detalhe: 2 })]) },
];
