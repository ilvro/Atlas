import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { mulberry32 } from '../ruido.ts';
import { tira } from '../organico.ts';
import { mat, num, parede, piso, type Receita } from './comum.ts';

const G = { generos: ['fantasia'], kit: 'fantasia' }, ACO = '#9aa0aa', ACO_C = '#c8ccd4', PEDRA = '#6e7078', PEDRA_ESC = '#3a3c42', PALHA = '#c9ae5a', PALHA_C = '#e0c878', VINHO = '#7a1f24', CORDA = '#d8cdb0';
const CORES = ['#7a1f24', '#2a3f6b', '#2f4a32', '#b97d3d', '#d9d2c0', '#1a2440', '#4a1418'];
const MIUDO = { contorno: false, semSombra: true, detalhe: 3 } as const, VOL = { contorno: 'leve', detalhe: 2 } as const;

/** Gira pontos locais [u, v, …] em torno da origem e os leva a (x, y). */
const rot = (x: number, y: number, a: number, pts: number[]): number[] => { const c = Math.cos(a), s = Math.sin(a); return pts.map((v, i) => (i % 2 ? y + pts[i - 1]! * s + v * c : x + v * c - pts[i + 1]! * s)); };
const P = (x: number, y: number, a: number, pts: number[], m: string, z: number, extra: Partial<Parte> = {}): Parte => poli(rot(x, y, a, pts), m, z, extra);
/** Retângulo girado: vai de u0 a u1 ao longo do eixo `a`, com largura w. */
const seg = (x: number, y: number, a: number, u0: number, u1: number, w: number, m: string, z: number, extra: Partial<Parte> = {}): Parte => P(x, y, a, [u0, -w / 2, u1, -w / 2, u1, w / 2, u0, w / 2], m, z, extra);
/** Faixa entre dois pontos. */
const lin = (x0: number, y0: number, x1: number, y1: number, w: number, m: string, z: number, extra: Partial<Parte> = {}): Parte => seg((x0 + x1) / 2, (y0 + y1) / 2, Math.atan2(y1 - y0, x1 - x0), -Math.hypot(x1 - x0, y1 - y0) / 2, Math.hypot(x1 - x0, y1 - y0) / 2, w, m, z, extra);

/** Espada deitada com centro (x, y), ao longo de `a`: lâmina, canal, guarda, punho e pomo. */
const espada = (x: number, y: number, a: number, len: number, z: number, ex: Partial<Parte> = {}): Parte[] => {
  const e = len / 2, c = Math.cos(a), s = Math.sin(a);
  return [P(x, y, a, [-e + 0.24, -0.028, e - 0.1, -0.022, e, 0, e - 0.1, 0.022, -e + 0.24, 0.028], ACO, z, ex), seg(x, y, a, -e + 0.28, e - 0.12, 0.008, ACO_C, z + 0.002, { ...MIUDO, ...ex }),
    seg(x, y, a, -e + 0.2, -e + 0.24, 0.2, 'latao', z + 0.003, { ...VOL, ...ex }), seg(x, y, a, -e + 0.04, -e + 0.2, 0.035, 'couro.marrom', z + 0.002, { ...VOL, ...ex }), elipse(x + c * (-e + 0.02), y + s * (-e + 0.02), 0.07, 0.07, 'latao', z + 0.004, { ...VOL, ...ex })];
};
/** Machado deitado: cabo e lâmina em crescente para o lado `lado` (±1), com espigão do outro. */
const machado = (x: number, y: number, a: number, len: number, z: number, lado: number, ex: Partial<Parte> = {}): Parte[] => {
  const e = len / 2;
  return [seg(x, y, a, -e, e, 0.045, 'madeira.media', z, ex), P(x, y, a, [e - 0.17, 0, e - 0.27, lado * 0.17, e - 0.11, lado * 0.25, e - 0.03, lado * 0.2, e - 0.06, 0], ACO, z + 0.004, { ...VOL, ...ex }),
    P(x, y, a, [e - 0.17, 0, e - 0.1, -lado * 0.07, e, -lado * 0.03, e - 0.05, 0], PEDRA_ESC, z + 0.004, { ...MIUDO, ...ex })];
};
/** Elmo visto de cima: calota, aba da viseira à frente (+y) e cume. */
const elmo = (x: number, y: number, d: number, z: number, ex: Partial<Parte> = {}): Parte[] => [elipse(x, y, d, d * 1.08, ACO, z, ex), seg(x, y, Math.PI / 2, -d * 0.45, d * 0.45, d * 0.07, ACO_C, z + 0.002, { ...MIUDO, ...ex }), ret(x, y + d * 0.28, d * 0.62, d * 0.07, '#1a1410', z + 0.003, { ...MIUDO, ...ex })];

const piso1 = (id: string, nome: string, categoria: Receita['categoria'], funcoes: string[], tags: string[], pegada: [number, number], extra: Partial<Receita>, gerar: Receita['gerar']): Receita => ({ id, nome, categoria, tipo: 'piso', funcoes, tags, pegada, ...G, ...extra, gerar });
const parede1 = (id: string, nome: string, funcoes: string[], tags: string[], largura: number, extra: Partial<Receita>, gerar: Receita['gerar']): Receita => ({ id, nome, categoria: 'parede', tipo: 'parede', funcoes, tags, pegada: [largura, 0.05], ...G, ...extra, gerar });
const campoLargura = (padrao: number, min: number, max: number) => [{ id: 'largura', rotulo: 'Largura', tipo: 'numero' as const, padrao, min, max, passo: 0.1 }];

/** Armamentos e equipamento de guarnição: arsenal, pátio de treino e muralha. */
export const RECEITAS_DE_ARMAS: Receita[] = [
  piso1('suporte-de-armas', 'Suporte de armas', 'armazenamento', ['forja', 'porao', 'corredor'], ['arma', 'armas', 'espada', 'machado', 'maca', 'suporte', 'arsenal', 'cavalete'], [1.6, 0.5], { campos: campoLargura(1.6, 1, 3) },
    p => {
      const w = num(p, 'largura', 1.6, 1, 3), r = mulberry32(p.seed), n = Math.floor((w - 0.3) / 0.34) + 1, x0 = -((n - 1) * 0.34) / 2, partes: Parte[] = [ret(0, 0, w, 0.5, 'madeira.escura', 0.5, { raio: 0.02 }), ret(0, -0.15, w - 0.04, 0.07, 'madeira.media', 0.9, VOL), ret(0, 0.15, w - 0.04, 0.07, 'madeira.media', 0.9, VOL), ...[-1, 1].map(s => ret(s * (w / 2 - 0.04), 0, 0.08, 0.5, 'madeira.escura', 0.95, VOL))];
      for (let i = 0; i < n; i++) {
        const x = x0 + i * 0.34, k = Math.floor(r() * 3);
        if (k === 0) partes.push(ret(x, 0, 0.22, 0.04, 'latao', 1.1, VOL), elipse(x, 0, 0.07, 0.07, 'latao', 1.3, MIUDO)); // espada: guarda e pomo
        else if (k === 1) partes.push(elipse(x, 0, 0.26, 0.07, ACO, 1.15, VOL), elipse(x, 0, 0.045, 0.045, 'madeira.media', 1.3, MIUDO)); // machado: cabeça e cabo
        else partes.push(elipse(x, 0, 0.13, 0.13, 'ferro', 1.2, VOL), ...[0, 1, 2, 3].map(j => elipse(x + Math.cos(j * Math.PI / 2) * 0.07, Math.sin(j * Math.PI / 2) * 0.07, 0.035, 0.035, ACO_C, 1.25, MIUDO))); // maça
      }
      return piso([w, 0.5], partes);
    }),
  piso1('suporte-de-lancas', 'Suporte de lanças', 'armazenamento', ['forja', 'porao', 'corredor'], ['lanca', 'lancas', 'haste', 'pique', 'suporte', 'arsenal'], [1.2, 0.4], {},
    p => {
      const r = mulberry32(p.seed), n = 5 + Math.floor(r() * 3), passo = 0.96 / (n - 1), partes: Parte[] = [ret(0, 0, 1.2, 0.4, 'madeira.escura', 0.5, { raio: 0.02 }), ret(0, -0.1, 1.16, 0.08, 'madeira.media', 1.0, VOL), ret(0, 0.1, 1.16, 0.08, 'madeira.media', 1.0, VOL), ...[-1, 1].map(s => ret(s * 0.56, 0, 0.08, 0.4, 'madeira.escura', 1.05, VOL))];
      for (let i = 0; i < n; i++) { const x = -0.48 + i * passo, y = (r() - 0.5) * 0.14; partes.push(elipse(x, y, 0.05, 0.05, 'madeira.clara', 1.7, VOL), poli([x - 0.035, y, x, y - 0.05, x + 0.035, y, x, y + 0.05], ACO, 2.0, { contorno: 'leve', detalhe: 3 })); }
      return piso([1.2, 0.4], partes);
    }),
  piso1('manequim-de-armadura', 'Armadura em suporte', 'decoracao', ['forja', 'corredor', 'sala', 'quarto'], ['armadura', 'manequim', 'elmo', 'cavaleiro', 'peitoral', 'suporte'], [0.7, 0.6], {},
    () => piso([0.7, 0.6], [ret(0, 0, 0.7, 0.08, 'madeira.escura', 0.1, { raio: 0.02 }), ret(0, 0, 0.08, 0.6, 'madeira.escura', 0.11, { raio: 0.02 }), elipse(0, 0.02, 0.36, 0.22, ACO, 1.3, VOL), ...[-1, 1].map(s => elipse(s * 0.21, 0, 0.18, 0.2, ACO, 1.4, VOL)), ...[-1, 1].map(s => elipse(s * 0.21, 0, 0.12, 0.13, ACO_C, 1.42, MIUDO)), ret(0, 0.03, 0.03, 0.2, ACO_C, 1.33, MIUDO), ...elmo(0, -0.02, 0.22, 1.7, VOL), ret(0, -0.02, 0.04, 0.24, VINHO, 1.8, MIUDO)])),
  piso1('mesa-de-armas', 'Mesa do armeiro', 'mesas', ['forja', 'porao'], ['mesa', 'armeiro', 'bancada', 'espada', 'elmo', 'adaga', 'rustica'], [1.8, 0.8], {},
    p => {
      const r = mulberry32(p.seed), ex = { sombraLeve: true };
      return piso([1.8, 0.8], [ret(0, 0, 1.8, 0.8, 'madeira.escura', 0.8, { raio: 0.02 }), ...[-0.3, -0.1, 0.1, 0.3].map(y => ret(0, y, 1.76, 0.18, r() < 0.5 ? 'madeira.media' : 'madeira.escura', 0.82, VOL)),
        ret(0.5, 0.05, 0.45, 0.32, 'tecido.cinza', 0.86, { raio: 0.04, ...VOL }), ...espada(-0.35, -0.2, 0.08, 0.85, 0.9, ex), ...espada(-0.3, 0.2, -0.05, 0.8, 0.9, ex), ...elmo(0.55, -0.15, 0.26, 0.95, VOL),
        P(0.55, 0.17, 0.4, [-0.13, -0.02, 0.1, -0.015, 0.16, 0, 0.1, 0.015, -0.13, 0.02], ACO, 0.9, ex), seg(0.55, 0.17, 0.4, -0.15, -0.12, 0.09, 'latao', 0.91, VOL), elipse(0.08, 0.02, 0.14, 0.09, PEDRA, 0.9, VOL), elipse(0.08, 0.02, 0.08, 0.05, '#80828a', 0.92, MIUDO)]);
    }),
  piso1('barril-de-flechas', 'Barril de flechas', 'armazenamento', ['forja', 'porao'], ['barril', 'flecha', 'flechas', 'arqueiro', 'aljava', 'penas'], [0.6, 0.6], {},
    p => {
      const r = mulberry32(p.seed), cores = ['#7a1f24', '#d9d2c0', '#2a3f6b', '#b97d3d', '#2f4a32'], partes: Parte[] = [elipse(0, 0, 0.6, 0.6, 'madeira.escura', 0.8, { contorno: 'leve' }), elipse(0, 0, 0.5, 0.5, '#2a1a10', 0.82, VOL), elipse(0, 0, 0.55, 0.55, 'ferro', 0.81, { contorno: false, semSombra: true, detalhe: 2 })];
      for (let i = 0; i < 8; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 0.17, x = Math.cos(a) * d, y = Math.sin(a) * d, z = 0.9 + r() * 0.1; partes.push(elipse(x, y, 0.025, 0.025, 'madeira.clara', z, MIUDO), elipse(x + 0.02, y - 0.02, 0.06, 0.07, cores[Math.floor(r() * cores.length)]!, z + 0.003, MIUDO)); }
      return piso([0.6, 0.6], partes);
    }),
  piso1('escudos-empilhados', 'Escudos encostados', 'decoracao', ['forja', 'porao', 'corredor'], ['escudo', 'escudos', 'broquel', 'brasao', 'heraldica', 'pilha'], [1.0, 0.7], {},
    p => {
      const r = mulberry32(p.seed), cor = () => CORES[Math.floor(r() * CORES.length)]!, c1 = cor(), c2 = cor(), c3 = cor();
      return piso([1.0, 0.7], [elipse(-0.24, 0.05, 0.52, 0.52, c1, 0.3), P(0.25, -0.02, 0.5, [0, -0.3, 0.13, -0.2, 0.2, -0.05, 0.16, 0.15, 0, 0.3, -0.16, 0.15, -0.2, -0.05, -0.13, -0.2], c2, 0.4),
        P(0, 0.02, 0.2, [-0.23, -0.26, 0.23, -0.26, 0.23, 0.04, 0.14, 0.2, 0, 0.3, -0.14, 0.2, -0.23, 0.04], c3, 0.5),
        elipse(-0.24, 0.05, 0.46, 0.46, ACO, 0.31, { ...MIUDO, alfa: 0.55 }), elipse(-0.24, 0.05, 0.14, 0.14, ACO_C, 0.33, VOL),
        P(0.25, -0.02, 0.5, [0, -0.24, 0.08, -0.1, 0, 0.24, -0.08, -0.1], 'latao', 0.41, MIUDO), elipse(0.25, -0.02, 0.1, 0.1, 'latao', 0.42, VOL),
        P(0, 0.02, 0.2, [-0.03, -0.22, 0.03, -0.22, 0.03, 0.22, -0.03, 0.22], 'latao', 0.51, MIUDO), P(0, 0.02, 0.2, [-0.18, -0.06, 0.18, -0.06, 0.18, 0, -0.18, 0], 'latao', 0.51, MIUDO)]);
    }),
  piso1('armas-caidas', 'Armas caídas', 'decoracao', ['porao', 'forja', 'jardim'], ['arma', 'espada', 'machado', 'elmo', 'batalha', 'caidas', 'chao'], [1.2, 1.0], {},
    p => {
      const r = mulberry32(p.seed), ex = { sombraLeve: true };
      return piso([1.2, 1.0], [...espada(-0.1, 0.2, (r() - 0.5) * 1.6, 0.9, 0.06, ex), ...machado(0.15, -0.2, Math.PI + (r() - 0.5) * 1.6, 0.8, 0.1, r() < 0.5 ? 1 : -1, ex), ...elmo(-0.38, -0.28, 0.26, 0.13, ex)].map(q => ({ ...q, z: Math.min(q.z, 0.15) })));
    }),
  piso1('alvo-de-arqueiro', 'Alvo de arqueiro', 'exterior', ['jardim'], ['alvo', 'arqueiro', 'arco', 'treino', 'flecha', 'palha', 'fardo'], [1.0, 0.6], {},
    () => piso([1.0, 0.6], [...[-1, 1].map(s => ret(s * 0.38, 0.14, 0.07, 0.44, 'madeira.escura', 0.4, { raio: 0.02 })), ret(0, -0.2, 0.7, 0.06, 'madeira.escura', 0.45, VOL), elipse(0, -0.05, 0.94, 0.42, PALHA, 0.9), elipse(0, -0.05, 0.86, 0.36, '#e8e2d2', 0.92, VOL), elipse(0, -0.05, 0.66, 0.28, '#2a3f6b', 0.93, MIUDO), elipse(0, -0.05, 0.48, 0.2, '#e8e2d2', 0.94, MIUDO), elipse(0, -0.05, 0.3, 0.13, VINHO, 0.95, MIUDO), elipse(0, -0.05, 0.12, 0.05, 'latao', 0.96, MIUDO),
      ...[-0.18, 0.2].map((x, i) => [lin(x, 0.0, x + 0.03, 0.34, 0.025, 'madeira.clara', 1.0, MIUDO), elipse(x + 0.03, 0.36, 0.06, 0.08, i ? VINHO : '#d9d2c0', 1.01, MIUDO)]).flat()])),
  piso1('boneco-de-treino', 'Boneco de treino', 'exterior', ['jardim', 'forja'], ['boneco', 'treino', 'poste', 'espantalho', 'escudo', 'palha', 'pratica'], [0.9, 0.7], {},
    () => piso([0.9, 0.7], [ret(0, 0, 0.7, 0.12, 'madeira.escura', 0.1, { raio: 0.02 }), ret(0, 0, 0.12, 0.6, 'madeira.escura', 0.11, { raio: 0.02 }), ret(0, 0, 0.8, 0.08, 'madeira.media', 1.4, VOL), elipse(0, 0, 0.14, 0.14, 'madeira.media', 1.6, VOL), elipse(0, 0, 0.32, 0.32, PALHA, 1.7, VOL),
      elipse(-0.06, -0.06, 0.18, 0.14, PALHA_C, 1.72, MIUDO), ret(0.06, 0.07, 0.11, 0.09, 'tecido.cinza', 1.73, MIUDO), ...[-0.02, 0.02].map(d => ret(0.06 + d * 1.2, 0.07, 0.01, 0.1, '#46291b', 1.74, MIUDO)), elipse(0.3, 0.12, 0.26, 0.26, 'madeira.escura', 1.45, VOL), elipse(0.3, 0.12, 0.1, 0.1, 'ferro', 1.5, MIUDO), ...[-0.38, 0.38].map(x => ret(x, 0, 0.06, 0.1, 'couro.marrom', 1.42, MIUDO))])),
  piso1('balista', 'Balista', 'exterior', ['jardim', 'varanda'], ['balista', 'cerco', 'besta', 'virote', 'maquina', 'guerra'], [2.2, 2.4], {},
    () => piso([2.2, 2.4], [lin(0, 0.1, -0.8, 0.95, 0.1, 'madeira.escura', 0.4, VOL), lin(0, 0.1, 0.8, 0.95, 0.1, 'madeira.escura', 0.4, VOL), lin(0, 0.1, 0, -0.95, 0.1, 'madeira.escura', 0.4, VOL), ret(0, -0.05, 0.2, 2.3, 'madeira.media', 0.9, { raio: 0.02 }), ret(0, -0.05, 0.08, 2.2, 'madeira.escura', 0.92, MIUDO), ret(0, 0.6, 0.36, 0.2, 'madeira.escura', 0.95, VOL),
      tira(Array.from({ length: 9 }, (_, i) => { const t = (i / 8) * 2 - 1; return [t * 1.05, 0.6 - 0.8 * t * t]; }).flat(), 0.1, ACO, 1.0, { contorno: 'leve' }, 0.5), lin(-1.05, -0.2, 0, -0.55, 0.018, CORDA, 1.02, MIUDO), lin(1.05, -0.2, 0, -0.55, 0.018, CORDA, 1.02, MIUDO),
      ret(0, -1.05, 0.34, 0.14, 'madeira.escura', 0.95, { raio: 0.03, ...VOL }), ...[-1, 1].map(s => ret(s * 0.24, -1.05, 0.12, 0.04, 'ferro', 0.97, MIUDO)), ret(0, 0.2, 0.035, 1.5, 'madeira.clara', 1.05, MIUDO), poli([-0.045, 0.95, 0, 1.15, 0.045, 0.95], ACO, 1.06, { contorno: 'leve', detalhe: 3 }), ret(0, -0.5, 0.07, 0.14, VINHO, 1.06, MIUDO)])),
  piso1('catapulta', 'Catapulta', 'exterior', ['jardim'], ['catapulta', 'cerco', 'trabuco', 'pedra', 'maquina', 'guerra'], [2.4, 3.4], {},
    () => piso([2.4, 3.4], [...[-1, 1].map(s => ret(s * 0.8, 0, 0.14, 3.4, 'madeira.escura', 0.5, { raio: 0.02 })), ...[-1.4, 0, 1.4].map(y => ret(0, y, 1.7, 0.14, 'madeira.media', 0.52, VOL)), ...[-1, 1].flatMap(sx => [-1.1, 1.1].map(sy => ret(sx * 1.1, sy, 0.12, 0.5, 'ferro', 0.35, { ...VOL, raio: 0.03 }))), ...[-1.1, 1.1].map(y => ret(0, y, 2.1, 0.06, 'madeira.escura', 0.3, MIUDO)),
      ...[-1, 1].map(s => ret(s * 0.62, 0.2, 0.2, 0.24, 'madeira.escura', 1.0, VOL)), ret(0, 0.2, 1.3, 0.14, 'madeira.media', 1.02, VOL), ...[-1, 1].map(s => elipse(s * 0.38, 0.2, 0.26, 0.26, PALHA, 1.05, VOL)), ret(0, -0.5, 0.16, 1.5, 'madeira.media', 1.1, { raio: 0.03 }), ret(0, 0.5, 0.2, 0.5, 'madeira.escura', 1.08, VOL),
      elipse(0, -1.2, 0.44, 0.38, 'madeira.escura', 1.15, VOL), elipse(0, -1.2, 0.26, 0.24, PEDRA, 1.25, VOL), ret(0, -1.55, 0.7, 0.14, 'madeira.escura', 0.6, VOL), ...[-1, 1].map(s => ret(s * 0.42, -1.55, 0.14, 0.05, 'ferro', 0.62, MIUDO)), lin(0, -1.0, 0, -1.5, 0.025, CORDA, 1.12, MIUDO)])),
  piso1('canhao', 'Canhão', 'exterior', ['jardim', 'varanda', 'porao'], ['canhao', 'artilharia', 'polvora', 'bronze', 'cerco', 'carreta'], [1.2, 2.2], {},
    () => piso([1.2, 2.2], [...[-1, 1].map(s => ret(s * 0.5, 0.1, 0.1, 0.8, 'madeira.escura', 0.45, { raio: 0.03 })), ...[-1, 1].map(s => ret(s * 0.5, 0.1, 0.11, 0.06, 'ferro', 0.47, MIUDO)), ...[-1, 1].map(s => ret(s * 0.3, -0.1, 0.12, 1.1, 'madeira.media', 0.55, VOL)), ret(0, -0.8, 0.2, 0.7, 'madeira.media', 0.52, VOL), ret(0, 0.1, 1.0, 0.07, 'ferro', 0.5, VOL), ret(0, 0.1, 0.62, 0.06, 'madeira.escura', 0.56, MIUDO),
      poli([-0.17, -0.8, 0.17, -0.8, 0.12, 1.0, -0.12, 1.0], 'latao', 0.9, { contorno: 'leve' }), ret(0, 1.04, 0.32, 0.1, 'latao', 0.92, VOL), elipse(0, -0.85, 0.14, 0.14, 'latao', 0.92, VOL), ...[-0.5, 0, 0.5].map(y => ret(0, y, 0.34 - y * 0.06, 0.05, 'ferro', 0.93, MIUDO)), ret(0, 0.8, 0.2, 0.04, 'ferro', 0.93, MIUDO), elipse(0, -0.55, 0.05, 0.05, '#1a1410', 0.95, MIUDO), ret(-0.05, -0.2, 0.05, 1.0, '#e0b86a', 0.94, { ...MIUDO, alfa: 0.5 })])),
  piso1('pilha-de-balas', 'Pilha de balas de canhão', 'exterior', ['jardim', 'porao', 'varanda'], ['balas', 'bala', 'canhao', 'municao', 'esferas', 'pilha', 'ferro'], [0.7, 0.7], {},
    () => {
      const camadas: [number, number, number][][] = [[[-0.22, 0.14], [0, 0.14], [0.22, 0.14], [-0.11, -0.05], [0.11, -0.05], [0, -0.24]].map(([x, y]) => [x!, y!, 0.11]), [[-0.11, 0.077], [0.11, 0.077], [0, -0.113]].map(([x, y]) => [x!, y!, 0.27]), [[0, 0.014, 0.43]]], partes: Parte[] = [];
      camadas.forEach((c, k) => c.forEach(([x, y, z]) => partes.push(elipse(x, y, 0.22, 0.22, '#4a4d56', z, k ? VOL : { contorno: 'leve' }), elipse(x - 0.045, y - 0.045, 0.07, 0.06, '#8a8d97', z + 0.01, MIUDO))));
      return piso([0.7, 0.7], partes);
    }),

  parede1('machados.cruzados', 'Machados cruzados', ['taverna', 'sala', 'forja', 'corredor'], ['machado', 'machados', 'cruzados', 'trofeu', 'arma', 'parede'], 1.0, {},
    () => parede(1.0, [elipse(0, 1.7, 0.7, 0.7, 'madeira.escura', 0.03, VOL), ...machado(0, 1.7, Math.atan2(0.84, 0.72), 1.1, 0.05, -1), ...machado(0, 1.7, Math.PI - Math.atan2(0.84, 0.72), 1.1, 0.07, 1), elipse(0, 1.7, 0.08, 0.08, 'ferro', 0.09, MIUDO)],
      [ret(0, 0.03, 0.7, 0.05, 'madeira.escura', 1.7), ret(-0.22, 0.07, 0.12, 0.06, ACO, 2.1, VOL), ret(0.22, 0.07, 0.12, 0.06, ACO, 2.1, VOL)])),
  parede1('escudo.parede', 'Escudo de parede', ['taverna', 'sala', 'corredor', 'forja'], ['escudo', 'brasao', 'redondo', 'umbo', 'heraldica', 'parede'], 0.7, { campos: [{ id: 'cor', rotulo: 'Cor', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }] },
    p => { const c = mat(p, 'cor', 'tecido.veludo-vinho'); return parede(0.7, [elipse(0, 1.7, 0.7, 0.7, 'ferro', 0.03), elipse(0, 1.7, 0.62, 0.62, c, 0.04, VOL), ret(0, 1.7, 0.62, 0.08, 'latao', 0.05, MIUDO), ret(0, 1.7, 0.08, 0.62, 'latao', 0.05, MIUDO), elipse(0, 1.7, 0.2, 0.2, ACO, 0.07, VOL), elipse(0, 1.7, 0.06, 0.06, ACO_C, 0.09, MIUDO)], [ret(0, 0.05, 0.7, 0.1, c, 1.7), ret(0, 0.1, 0.2, 0.1, ACO, 1.78, VOL)]); }),
  parede1('arco.parede', 'Arco e aljava', ['taverna', 'sala', 'forja', 'quarto'], ['arco', 'aljava', 'flechas', 'arqueiro', 'parede', 'cacador'], 0.9, {},
    () => parede(0.9, [tira(Array.from({ length: 9 }, (_, i) => { const t = (i / 8) * 2 - 1; return [-0.15 - 0.15 * (1 - t * t), 1.75 + t * 0.6]; }).flat(), 0.05, 'madeira.media', 0.04, VOL, 0.6), lin(-0.15, 1.15, -0.15, 2.35, 0.012, CORDA, 0.03, MIUDO),
      seg(0.22, 1.7, Math.PI / 2 + 0.12, -0.42, 0.42, 0.17, 'couro.marrom', 0.05, VOL), seg(0.22, 1.7, Math.PI / 2 + 0.12, -0.3, -0.26, 0.17, 'latao', 0.06, MIUDO), ...[0.12, 0.2, 0.28].map((u, i) => elipse(u, 2.18 + i * 0.01, 0.045, 0.15, [VINHO, '#d9d2c0', '#2a3f6b'][i]!, 0.06, MIUDO)), lin(-0.15, 1.7, 0.22, 1.7, 0.02, 'couro.marrom', 0.07, MIUDO)],
      [ret(-0.3, 0.04, 0.05, 0.05, 'madeira.media', 1.8, VOL), ret(0.22, 0.07, 0.17, 0.1, 'couro.marrom', 1.8, VOL)])),
  parede1('lancas.parede', 'Lanças na parede', ['corredor', 'forja', 'sala', 'porao'], ['lanca', 'lancas', 'haste', 'pique', 'arma', 'parede', 'ganchos'], 1.8, { campos: campoLargura(1.8, 1.2, 3) },
    p => {
      const l = num(p, 'largura', 1.8, 1.2, 3), zs = l > 2 ? [1.45, 1.75, 2.05] : [1.55, 1.95], hx = l / 2 - 0.3;
      return parede(l, [...zs.flatMap((z, i) => { const s = i % 2 ? -1 : 1; return [ret(0, z, l - 0.2, 0.04, 'madeira.clara', 0.05, VOL), poli([s * (l / 2 - 0.2), z - 0.04, s * (l / 2 - 0.02), z, s * (l / 2 - 0.2), z + 0.04], ACO, 0.05, { contorno: 'leve', detalhe: 3 })]; }), ...[-hx, hx].map(x => ret(x, (zs[0]! + zs[zs.length - 1]!) / 2, 0.07, zs[zs.length - 1]! - zs[0]! + 0.2, 'ferro', 0.03, VOL)), ...[-hx, hx].flatMap(x => zs.map(z => ret(x, z - 0.04, 0.08, 0.04, 'ferro', 0.03, MIUDO)))],
        [ret(0, 0.06, l - 0.2, 0.04, 'madeira.clara', 1.8, VOL), ...[-hx, hx].map(x => ret(x, 0.05, 0.07, 0.1, 'ferro', 1.8, VOL))]);
    }),
];
