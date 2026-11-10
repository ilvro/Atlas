import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { mulberry32 } from '../ruido.ts';
import { tira } from '../organico.ts';
import { mat, num, parede, piso, type Receita } from './comum.ts';

const G = { generos: ['fantasia', 'investigacao'], kit: 'fantasia' }, PEDRA = '#6e7078', PEDRA_ESC = '#3a3c42', VINHO = '#7a1f24', CERA = '#efe6c8', AGUA = '#5d8aa0', ACO = '#c8ccd4', BRONZE = '#a8742e';
const LEVE = { contorno: 'leve' as const, detalhe: 2 as const }, MIUDO = { contorno: false as const, semSombra: true, detalhe: 3 as const };
const base = (id: string, nome: string, categoria: Receita['categoria'], funcoes: string[], tags: string[], pegada: [number, number], extra: Partial<Receita> = {}): Omit<Receita, 'gerar'> => ({ id, nome, categoria, tipo: 'piso', funcoes, tags, pegada, ...G, ...extra });
const baseParede = (id: string, nome: string, funcoes: string[], tags: string[], l: number, extra: Partial<Receita> = {}) => base(id, nome, 'parede', funcoes, tags, [l, 0.05], { tipo: 'parede', ...extra });
const octogono = (cx: number, cy: number, r: number): number[] => Array.from({ length: 8 }, (_, i) => { const a = ((i + 0.5) * Math.PI) / 4; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; }).flat();
/** O fio do topo de um objeto de parede, visto de cima, colado à parede. */
const topo = (l: number, prof: number, m: string, z: number) => [ret(0, prof / 2, l, prof, m, z)];
/** Vela com chama (a chama só quando acesa): base em (x, y), `z` do prato. */
const vela = (x: number, y: number, z: number, acesa: boolean, d = 0.06): Parte[] => [elipse(x, y, d, d, CERA, z + 0.08, { contorno: 'leve', detalhe: 2 }), ...(acesa ? [elipse(x, y, d * 2.6, d * 2.6, '#ffc24a', z + 0.1, { ...MIUDO, suave: true, alfa: 0.22 }), elipse(x, y, d * 0.8, d * 0.8, '#ff7a2a', z + 0.12, MIUDO), elipse(x, y, d * 0.4, d * 0.4, '#ffe9a8', z + 0.13, MIUDO)] : [])];
const VIDROS = ['#2a3f6b', '#7a1f24', '#c9a25a', '#2f6a4a', '#5d8aa0', '#8a3f6a'];
const MANTOS = ['#2a3f6b', '#e8e2d2', '#7a1f24'];

/** O kit de igreja: capela, igreja, cripta e mosteiro, além do altar e do banco da fantasia. */
export const RECEITAS_DE_IGREJA: Receita[] = [
  { ...base('pulpito', 'Púlpito', 'decoracao', ['capela'], ['pulpito', 'tribuna', 'igreja', 'sermao', 'madeira'], [1.2, 1.2]),
    gerar: () => piso([1.2, 1.2], [
      poli(octogono(0, 0.1, 0.5), 'madeira.escura', 1.1), poli(octogono(0, 0.1, 0.4), 'madeira.media', 1.15, LEVE),
      ...[0, 1, 2].map(i => ret(0, -0.45 - i * 0.1, 0.4, 0.09, i % 2 ? 'madeira.media' : 'madeira.clara', 0.9 - i * 0.3, LEVE)),
      ret(0, 0.12, 0.36, 0.28, 'madeira.clara', 1.25, { ...LEVE, raio: 0.02 }), ret(-0.09, 0.12, 0.16, 0.22, 'papel.folha', 1.3, MIUDO), ret(0.09, 0.12, 0.16, 0.22, 'papel.folha', 1.3, MIUDO), ret(0, 0.12, 0.012, 0.22, '#8a7e60', 1.31, MIUDO),
      ret(0, 0.3, 0.5, 0.04, 'latao', 1.2, MIUDO), elipse(0, -0.08, 0.1, 0.06, 'latao', 1.26, MIUDO)]) },

  { ...base('pia-batismal', 'Pia batismal', 'decoracao', ['capela'], ['pia', 'batismo', 'bacia', 'pedra', 'igreja'], [0.9, 0.9]),
    gerar: () => piso([0.9, 0.9], [
      poli(octogono(0, 0, 0.45), 'laje.pedra', 0.8), poli(octogono(0, 0, 0.38), PEDRA_ESC, 0.85, LEVE), poli(octogono(0, 0, 0.31), AGUA, 0.87, { contorno: false, semSombra: true, detalhe: 2 }),
      elipse(-0.08, -0.08, 0.16, 0.1, '#a9c9d8', 0.88, { ...MIUDO, suave: true, alfa: 0.6 }), elipse(0.06, 0.1, 0.1, 0.06, '#a9c9d8', 0.88, { ...MIUDO, suave: true, alfa: 0.4 }),
      ...[0, 2, 4, 6].map(i => ret(Math.cos(((i + 0.5) * Math.PI) / 4) * 0.415, Math.sin(((i + 0.5) * Math.PI) / 4) * 0.415, 0.05, 0.05, PEDRA, 0.9, MIUDO))]) },

  { ...base('confessionario', 'Confessionário', 'armazenamento', ['capela'], ['confessionario', 'confissao', 'cabine', 'igreja', 'madeira'], [2.2, 1.1]),
    gerar: () => piso([2.2, 1.1], [
      ret(0, 0, 2.2, 1.1, 'madeira.escura', 1.9, { raio: 0.02 }),
      ...[-0.75, 0, 0.75].map((x, i) => ret(x, -0.02, i === 1 ? 0.76 : 0.64, 1.0, i === 1 ? 'madeira.media' : 'madeira.escura', i === 1 ? 2.3 : 2.0, { ...LEVE, dir: Math.PI / 2 })),
      poli([-0.38, -0.5, 0.38, -0.5, 0, -0.38], 'madeira.escura', 2.45, MIUDO), ret(0, 0.0, 0.04, 0.9, 'madeira.escura', 2.35, MIUDO),
      ret(0, 0.46, 0.52, 0.12, 'cortina.vinho', 1.9, { ...LEVE, contorno: 'leve' }), ret(0, 0.52, 0.56, 0.04, 'latao', 2.0, MIUDO),
      ...[-1, 1].flatMap(s => [ret(s * 0.4, 0.05, 0.05, 0.6, 'madeira.clara', 1.7, LEVE), ...[-0.2, -0.1, 0, 0.1, 0.2].map(y => ret(s * 0.4, 0.05 + y, 0.06, 0.012, 'madeira.escura', 1.75, MIUDO)), ret(s * 0.75, 0.46, 0.5, 0.1, 'madeira.media', 1.2, LEVE), ret(s * 0.75, 0.48, 0.3, 0.05, VINHO, 1.25, MIUDO)])]) },

  { ...base('genuflexorio', 'Genuflexório', 'assentos', ['capela'], ['genuflexorio', 'ajoelhar', 'reza', 'oracao', 'igreja'], [0.7, 0.6]),
    gerar: () => piso([0.7, 0.6], [
      ret(0, 0, 0.7, 0.6, 'madeira.escura', 0.3, { raio: 0.02 }), ret(0, 0.17, 0.5, 0.22, VINHO, 0.4, { ...LEVE, raio: 0.04 }),
      ret(0, -0.18, 0.66, 0.2, 'madeira.escura', 0.95, { raio: 0.02 }), ret(0, -0.18, 0.56, 0.12, 'madeira.media', 0.98, LEVE), ret(0, -0.19, 0.3, 0.08, VINHO, 1.0, { ...MIUDO, raio: 0.03 }),
      ...[-1, 1].map(s => ret(s * 0.31, 0.05, 0.06, 0.5, 'madeira.escura', 0.6, LEVE))]) },

  { ...base('atril', 'Atril com livro', 'decoracao', ['capela', 'biblioteca'], ['atril', 'livro', 'biblia', 'leitura', 'latao'], [0.6, 0.6]),
    gerar: () => piso([0.6, 0.6], [
      elipse(0, 0, 0.5, 0.5, 'latao', 0.1, { raio: 0.02 }), elipse(0, 0, 0.3, 0.3, 'latao', 0.2, LEVE), elipse(0, 0, 0.1, 0.1, 'latao', 1.0, LEVE),
      ret(0, 0, 0.5, 0.4, 'latao', 1.2, { ...LEVE, raio: 0.02 }),
      ret(-0.115, 0, 0.22, 0.34, 'papel.folha', 1.25, { contorno: 'leve', detalhe: 2 }), ret(0.115, 0, 0.22, 0.34, 'papel.folha', 1.25, { contorno: 'leve', detalhe: 2 }), ret(0, 0, 0.014, 0.34, '#8a7e60', 1.26, MIUDO),
      ...[-0.1, -0.04, 0.02, 0.08].flatMap(y => [ret(-0.115, y, 0.16, 0.012, '#8a7e60', 1.26, MIUDO), ret(0.115, y, 0.16, 0.012, '#8a7e60', 1.26, MIUDO)]),
      ret(0.04, 0.22, 0.03, 0.13, VINHO, 1.27, MIUDO)]) },

  { ...base('tocheiro', 'Tocheiro', 'lareira-e-luz', ['capela', 'sala', 'corredor'], ['tocheiro', 'candelabro', 'vela', 'luz', 'ferro'], [0.5, 0.5]),
    gerar: p => { const r = mulberry32(p.seed), n = 3 + Math.floor(r() * 3), ps: Parte[] = [elipse(0, 0, 0.5, 0.5, 'ferro', 0.15, { raio: 0.02 }), elipse(0, 0, 0.12, 0.12, 'ferro', 1.2, LEVE)];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2, x = Math.cos(a) * 0.17, y = Math.sin(a) * 0.17; ps.push(tira([0, 0, x, y], 0.03, 'ferro', 1.4, { contorno: false, semSombra: true, detalhe: 2 }), elipse(x, y, 0.14, 0.14, 'ferro', 1.45, LEVE), ...vela(x, y, 1.45, true, 0.07)); }
      return piso([0.5, 0.5], ps); } },

  { ...base('velas-votivas', 'Velas votivas', 'lareira-e-luz', ['capela'], ['velas', 'votivas', 'promessa', 'vela', 'luz', 'ferro'], [1.2, 0.5]),
    gerar: p => { const r = mulberry32(p.seed), ps: Parte[] = [ret(0, 0, 1.2, 0.5, 'ferro', 0.45, { raio: 0.02 })], fila = [[-0.17, 0.9], [0, 0.7], [0.17, 0.5]];
      for (const [y, z] of fila) ps.push(ret(0, y!, 1.12, 0.15, 'ferro', z!, LEVE));
      for (const [y, z] of fila) for (let i = 0; i < 9; i++) ps.push(...vela(-0.5 + i * 0.125, y!, z!, r() < 0.45, 0.06));
      return piso([1.2, 0.5], ps); } },

  { ...base('sarcofago', 'Sarcófago', 'decoracao', ['capela', 'porao'], ['sarcofago', 'tumulo', 'cripta', 'jazigo', 'pedra', 'cavaleiro'], [1.1, 2.3]),
    gerar: () => piso([1.1, 2.3], [
      ret(0, 0, 1.1, 2.3, PEDRA, 0.6, { raio: 0.05 }), ret(0, 0, 0.96, 2.16, 'laje.pedra', 0.8, { ...LEVE, raio: 0.04 }), ret(0, 0, 0.8, 2.0, PEDRA, 0.85, { ...LEVE, raio: 0.03 }),
      ret(0, -0.82, 0.3, 0.2, '#8d8f98', 0.88, { ...MIUDO, raio: 0.05 }),
      poli([-0.2, -0.66, 0.2, -0.66, 0.24, -0.3, 0.16, 0.9, -0.16, 0.9, -0.24, -0.3], '#9a9ca4', 0.9, LEVE), poli([-0.14, 0.4, 0.14, 0.4, 0.17, 0.92, -0.17, 0.92], '#8d8f98', 0.92, MIUDO),
      elipse(0, -0.82, 0.2, 0.22, '#b4b6bd', 0.95, LEVE),
      ret(0, 0.1, 0.05, 1.0, 'ferro', 0.97, { ...LEVE }), ret(0, -0.4, 0.22, 0.04, 'ferro', 0.98, MIUDO), elipse(0, 0.62, 0.07, 0.07, 'latao', 0.98, MIUDO),
      ret(-0.06, -0.3, 0.1, 0.07, '#b4b6bd', 1.0, MIUDO), ret(0.06, -0.3, 0.1, 0.07, '#b4b6bd', 1.0, MIUDO)]) },

  { ...base('caixao', 'Caixão', 'decoracao', ['capela', 'porao'], ['caixao', 'esquife', 'funeral', 'morte', 'cripta', 'madeira'], [0.8, 2.0], { campos: [{ id: 'madeira', rotulo: 'Madeira', tipo: 'material', padrao: 'madeira.escura', uso: 'objeto' }] }),
    gerar: p => { const m = mat(p, 'madeira', 'madeira.escura'), forma = [-0.22, -1, 0.22, -1, 0.4, -0.5, 0.26, 1, -0.26, 1, -0.4, -0.5], menor = forma.map((v, i) => (i % 2 ? v * 0.88 : v * 0.8));
      return piso([0.8, 2.0], [poli(forma, m, 0.7, { dir: Math.PI / 2 }), poli(menor, m, 0.78, { ...LEVE, dir: Math.PI / 2 }), ret(0, -0.3, 0.05, 0.7, 'latao', 0.82, LEVE), ret(0, -0.5, 0.26, 0.05, 'latao', 0.83, LEVE),
        ...[-1, 1].flatMap(s => [ret(s * 0.3, -0.25, 0.04, 0.16, 'latao', 0.8, MIUDO), ret(s * 0.3, 0.45, 0.04, 0.16, 'latao', 0.8, MIUDO)])]); } },

  { ...base('orgao-de-tubos', 'Órgão de tubos', 'decoracao', ['capela'], ['orgao', 'tubos', 'musica', 'igreja', 'teclado', 'coro'], [2.6, 1.0]),
    gerar: () => { const n = 15, tubos: Parte[] = [];
      for (let i = 0; i < n; i++) { const x = -1.12 + (i * 2.24) / (n - 1), k = 1 - Math.abs(x) / 1.2; tubos.push(elipse(x, -0.32, 0.15, 0.15, ACO, 1.5 + k * 0.9, { contorno: 'leve' }), elipse(x, -0.32, 0.07, 0.07, '#7c828c', 1.5 + k * 0.9 + 0.02, MIUDO)); if (i % 2) tubos.push(elipse(x - 0.07, -0.12, 0.11, 0.11, ACO, 1.4 + k * 0.5, LEVE)); }
      return piso([2.6, 1.0], [ret(0, -0.2, 2.6, 0.6, 'madeira.escura', 1.2, { raio: 0.03 }), ...tubos, ret(0, 0.17, 1.1, 0.36, 'madeira.media', 1.0, { ...LEVE, raio: 0.02 }),
        ret(0, 0.12, 0.9, 0.1, '#e8e2d2', 1.05, MIUDO), ret(0, 0.22, 0.9, 0.1, '#e8e2d2', 1.06, MIUDO), ...[-0.6, 0.6].flatMap(x => [ret(x, 0.17, 0.12, 0.2, 'madeira.escura', 1.02, MIUDO), elipse(x, 0.17, 0.05, 0.05, 'latao', 1.08, MIUDO)]),
        ret(0, 0.4, 0.8, 0.24, 'madeira.escura', 0.5, { ...LEVE, raio: 0.02 }), ret(0, 0.4, 0.7, 0.16, 'madeira.media', 0.55, MIUDO)]); } },

  { ...base('relicario', 'Relicário em pedestal', 'decoracao', ['capela'], ['relicario', 'reliquia', 'pedestal', 'ouro', 'gema', 'igreja'], [0.6, 0.6]),
    gerar: () => piso([0.6, 0.6], [
      ret(0, 0, 0.58, 0.58, PEDRA, 0.9, { raio: 0.02 }), ret(0, 0, 0.46, 0.46, 'laje.pedra', 0.95, LEVE),
      ret(0, 0, 0.4, 0.26, 'latao', 1.2, { ...LEVE, raio: 0.03 }), ret(0, 0, 0.32, 0.18, 'vidro', 1.25, { ...LEVE, vidro: true, raio: 0.02 }), ret(0, 0, 0.4, 0.03, 'latao', 1.3, MIUDO),
      elipse(0, 0, 0.09, 0.09, '#b3203a', 1.32, { contorno: 'leve', detalhe: 3 }), ...[-1, 1].flatMap(sx => [-1, 1].map(sy => elipse(sx * 0.18, sy * 0.1, 0.04, 0.04, '#5d8aa0', 1.3, MIUDO)))]) },

  { ...base('imagem-de-santo', 'Imagem de santo', 'decoracao', ['capela', 'jardim'], ['santo', 'imagem', 'estatua', 'devocao', 'nicho', 'igreja'], [0.8, 0.8]),
    gerar: p => { const r = mulberry32(p.seed), manto = MANTOS[Math.floor(r() * MANTOS.length)]!;
      return piso([0.8, 0.8], [ret(0, 0, 0.78, 0.78, 'laje.pedra', 0.3, { raio: 0.03 }), ret(0, -0.1, 0.44, 0.4, PEDRA, 0.9, { ...LEVE, raio: 0.02 }),
        poli([0, -0.38, 0.22, -0.18, 0.2, 0.1, 0, 0.14, -0.2, 0.1, -0.22, -0.18], manto, 1.5), ret(0, -0.12, 0.1, 0.3, '#d9a75e', 1.55, MIUDO), ret(0, 0.02, 0.18, 0.08, '#d9b99a', 1.55, MIUDO),
        elipse(0, -0.18, 0.3, 0.3, 'latao', 1.75, { contorno: 'leve' }), elipse(0, -0.18, 0.22, 0.22, '#e0c06a', 1.76, MIUDO), elipse(0, -0.18, 0.12, 0.12, '#d9b99a', 1.8, LEVE),
        ...[-0.25, 0.25].flatMap(x => [ret(x, 0.28, 0.1, 0.1, 'latao', 0.35, LEVE), ...vela(x, 0.28, 0.35, r() < 0.8, 0.06)])]); } },

  { ...base('passadeira', 'Passadeira da nave', 'tapetes', ['capela', 'corredor', 'sala'], ['passadeira', 'tapete', 'nave', 'igreja', 'corredor', 'vinho'], [1.4, 6.0], { campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.4, min: 1, max: 2.5, passo: 0.1 }, { id: 'comprimento', rotulo: 'Comprimento', tipo: 'numero', padrao: 6, min: 2, max: 14, passo: 0.5 }] }),
    gerar: p => { const w = num(p, 'largura', 1.4, 1, 2.5), l = num(p, 'comprimento', 6, 2, 14), c = l - 0.2, ouro = { contorno: false as const, semSombra: true, detalhe: 2 as const }, motivos = Math.max(1, Math.floor((l - 0.6) / 1.2));
      return piso([w, l], [ret(0, 0, w, c, VINHO, 0.02, { sombraLeve: true }),
        ...[-1, 1].map(s => ret(s * (w / 2 - 0.09), 0, 0.06, c - 0.12, '#d9a75e', 0.025, ouro)), ...[-1, 1].map(s => ret(0, s * (c / 2 - 0.09), w - 0.12, 0.06, '#d9a75e', 0.025, ouro)),
        ...Array.from({ length: motivos }, (_, i) => { const y = (i - (motivos - 1) / 2) * 1.2, k = Math.min(0.3, w * 0.22); return [poli([0, y - k, k * 0.7, y, 0, y + k, -k * 0.7, y], '#d9a75e', 0.03, ouro), poli([0, y - k * 0.5, k * 0.35, y, 0, y + k * 0.5, -k * 0.35, y], '#4a1418', 0.035, MIUDO)]; }).flat(),
        ...[-1, 1].map(s => ret(0, s * (l / 2 - 0.05), w - 0.04, 0.1, 'tecido.linho', 0.02, { contorno: false, semSombra: true, detalhe: 3 }))]); } },

  { ...base('sino', 'Sino de bronze', 'decoracao', ['capela', 'jardim'], ['sino', 'bronze', 'torre', 'campanario', 'igreja'], [1.0, 1.0]),
    gerar: () => piso([1.0, 1.0], [
      elipse(0, 0, 1.0, 1.0, '#6e4a22', 0.5, { raio: 0.02 }), elipse(0, 0, 0.84, 0.84, BRONZE, 0.6, LEVE), elipse(0, 0, 0.62, 0.62, '#c99a4a', 0.7, LEVE), elipse(0, 0, 0.4, 0.4, '#dcb460', 0.8, LEVE),
      elipse(-0.06, -0.06, 0.22, 0.22, '#f0d08a', 0.85, { ...MIUDO, suave: true, alfa: 0.7 }), elipse(0, 0, 0.14, 0.14, 'ferro', 0.9, LEVE),
      ret(0, 0, 0.9, 0.14, 'madeira.escura', 1.1, { ...LEVE, raio: 0.02 }), ...[-1, 1].map(s => elipse(s * 0.42, 0, 0.1, 0.1, 'ferro', 1.15, MIUDO)), elipse(0, 0, 0.1, 0.1, 'ferro', 1.15, MIUDO)]) },

  // Objetos de parede. Na face a unidade é (u, z); no topo, (u, profundidade).
  { ...baseParede('crucifixo', 'Crucifixo', ['capela', 'quarto', 'hospital'], ['crucifixo', 'cruz', 'cristo', 'igreja', 'religiao'], 0.6),
    gerar: () => parede(0.6, [ret(0, 1.85, 0.1, 0.72, 'madeira.escura', 0.04, LEVE), ret(0, 2.0, 0.4, 0.1, 'madeira.escura', 0.04, LEVE), ret(0, 2.22, 0.16, 0.04, 'latao', 0.05, MIUDO),
      ret(0, 1.86, 0.07, 0.34, '#e0d4b8', 0.06, MIUDO), ret(0, 2.0, 0.36, 0.035, '#e0d4b8', 0.06, MIUDO), elipse(0, 2.07, 0.08, 0.08, '#e0d4b8', 0.07, MIUDO), ret(0, 1.72, 0.1, 0.1, '#c9bfa4', 0.07, MIUDO)],
      [ret(0, 0.03, 0.1, 0.05, 'madeira.escura', 2.0), ret(0, 0.03, 0.4, 0.05, 'madeira.escura', 2.0)]) },

  { ...baseParede('vitral', 'Vitral', ['capela', 'biblioteca', 'sala'], ['vitral', 'janela', 'vidro', 'igreja', 'colorido', 'gotico'], 1.2, { campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.2, min: 0.8, max: 2.4, passo: 0.1 }] }),
    gerar: p => { const l = num(p, 'largura', 1.2, 0.8, 2.4), r = mulberry32(p.seed), n = Math.max(3, Math.round(l / 0.3)), s = l / n, alto = (x: number) => 1.85 + 0.65 * (1 - Math.min(1, Math.abs(x) / (l / 2))) ** 0.55, cor = () => VIDROS[Math.floor(r() * VIDROS.length)]!, v = { contorno: false as const, vidro: true, detalhe: 2 as const }, face: Parte[] = [
        poli([-l / 2 - 0.05, 1.0, l / 2 + 0.05, 1.0, l / 2 + 0.05, 1.85, ...[0.75, 0.5, 0.25, 0].flatMap(k => [k * (l / 2 + 0.05), alto(k * l / 2) + 0.05]), ...[-0.25, -0.5, -0.75].flatMap(k => [k * (l / 2 + 0.05), alto(k * l / 2) + 0.05]), -l / 2 - 0.05, 1.85], 'ferro', 0.03)];
      for (let i = 0; i < n; i++) { const x0 = -l / 2 + i * s + 0.02, x1 = x0 + s - 0.04; for (let j = 0; j < 4; j++) face.push(ret((x0 + x1) / 2, 1.1 + j * 0.2, s - 0.04, 0.17, cor(), 0.04, v)); face.push(poli([x0, 1.9, x1, 1.9, x1, alto(x1) - 0.03, x0, alto(x0) - 0.03], cor(), 0.04, v)); }
      return parede(l, face, topo(l + 0.1, 0.16, 'laje.pedra', 1.0)); } },

  { ...baseParede('pia-de-agua-benta', 'Pia de água benta', ['capela'], ['pia', 'agua-benta', 'agua', 'concha', 'pedra', 'igreja'], 0.5),
    gerar: () => parede(0.5, [ret(0, 1.4, 0.3, 0.5, PEDRA_ESC, 0.03, LEVE), ret(0, 1.5, 0.06, 0.2, 'latao', 0.04, MIUDO), ret(0, 1.56, 0.16, 0.05, 'latao', 0.04, MIUDO), elipse(0, 1.18, 0.4, 0.28, PEDRA, 0.05, LEVE), ret(0, 1.28, 0.4, 0.1, PEDRA_ESC, 0.04, MIUDO), elipse(0, 1.22, 0.3, 0.1, AGUA, 0.06, MIUDO)],
      [elipse(0, 0.12, 0.42, 0.24, PEDRA, 1.2), elipse(0, 0.12, 0.32, 0.16, PEDRA_ESC, 1.22, LEVE), elipse(0, 0.12, 0.26, 0.12, AGUA, 1.23, MIUDO), elipse(-0.04, 0.1, 0.08, 0.04, '#a9c9d8', 1.24, { ...MIUDO, alfa: 0.6 })]) },

  { ...baseParede('icone.parede', 'Ícone dourado', ['capela', 'quarto', 'corredor'], ['icone', 'santo', 'ouro', 'devocao', 'igreja', 'pintura'], 0.5),
    gerar: () => parede(0.5, [ret(0, 1.7, 0.46, 0.64, 'madeira.escura', 0.03, { raio: 0.03 }), ret(0, 1.7, 0.4, 0.58, 'latao', 0.04, { ...LEVE, raio: 0.02 }), ret(0, 1.72, 0.34, 0.5, '#e0c06a', 0.045, MIUDO),
      poli([-0.15, 1.45, -0.1, 1.62, 0.1, 1.62, 0.15, 1.45], VINHO, 0.05, LEVE), ret(0, 1.62, 0.07, 0.07, '#d9b99a', 0.05, MIUDO), elipse(0, 1.82, 0.26, 0.26, 'latao', 0.05, LEVE), elipse(0, 1.82, 0.14, 0.17, '#d9b99a', 0.06, LEVE), ret(0, 1.52, 0.04, 0.1, '#2a3f6b', 0.06, MIUDO)],
      topo(0.5, 0.05, 'madeira.escura', 2.02)) },
];
