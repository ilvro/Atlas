import { elipse, poli, ret, type Parte } from '../descricao.ts';
import { mulberry32 } from '../ruido.ts';
import { LOMBADAS, folhas, mat, num, parede, piso, type Receita } from './comum.ts';

/** O acervo básico da casa: o lote 1 (22 receitas). */
export const RECEITAS_DA_CASA: Receita[] = [
  { id: 'caixa', nome: 'Caixote', categoria: 'decoracao', tipo: 'piso', funcoes: ['porao', 'deposito', 'galpao'], tags: ['caixa', 'madeira'], pegada: [0.7, 0.7],
    gerar: () => piso([0.7, 0.7], [ret(0, 0, 0.7, 0.7, 'madeira.media', 0.6, { raio: 0.03 }), ret(0, 0, 0.56, 0.56, 'madeira.clara', 0.62, { detalhe: 2, contorno: 'leve' }), ret(0, 0, 0.7, 0.05, 'madeira.escura', 0.64, { detalhe: 2 }), ret(0, 0, 0.05, 0.7, 'madeira.escura', 0.64, { detalhe: 2 })]) },

  { id: 'mesa.redonda', nome: 'Mesa redonda', categoria: 'mesas', tipo: 'piso', funcoes: ['sala', 'cozinha', 'taverna', 'biblioteca'], tags: ['mesa', 'redonda', 'toalha'], pegada: [1.26, 1.26],
    campos: [{ id: 'diametro', rotulo: 'Diâmetro', tipo: 'numero', padrao: 1.26, min: 0.6, max: 3, passo: 0.1 }, { id: 'toalha', rotulo: 'Toalha', tipo: 'material', padrao: 'tecido.linho', uso: 'objeto' }],
    gerar: p => { const d = num(p, 'diametro', 1.26, 0.6, 3), r = mulberry32(p.seed); return piso([d, d], [elipse(0, 0, d, d, mat(p, 'toalha', 'tecido.linho'), 0.76), elipse(0, 0, d * 0.8, d * 0.8, mat(p, 'toalha', 'tecido.linho'), 0.761, { contorno: 'leve', detalhe: 2 }), ...folhas(r, -d * 0.17, d * 0.14, 2, d * 0.24, 0.21), ret(d * 0.22, d * 0.16, 0.18, 0.26, 'couro.marrom', 0.8, { detalhe: 2, raio: 0.01 }), elipse(0, 0, 0.2, 0.2, 'latao', 0.9), elipse(0, 0, 0.12, 0.12, 'vidro', 1.05, { detalhe: 2 })]); } },

  { id: 'mesa.retangular', nome: 'Mesa retangular', categoria: 'mesas', tipo: 'piso', funcoes: ['sala', 'cozinha', 'taverna', 'escritorio'], tags: ['mesa', 'jantar'], pegada: [1.8, 0.9],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.8, min: 0.8, max: 5, passo: 0.1 }, { id: 'profundidade', rotulo: 'Profundidade', tipo: 'numero', padrao: 0.9, min: 0.5, max: 2, passo: 0.1 }, { id: 'madeira', rotulo: 'Madeira', tipo: 'material', padrao: 'madeira.media', uso: 'objeto' }],
    gerar: p => { const w = num(p, 'largura', 1.8, 0.8, 5), h = num(p, 'profundidade', 0.9, 0.5, 2), r = mulberry32(p.seed); return piso([w, h], [ret(0, 0, w, h, mat(p, 'madeira', 'madeira.media'), 0.76, { raio: 0.03 }), ret(0, 0, w * 0.55, h * 0.12, 'tecido.linho', 0.77, { detalhe: 2 }), ...folhas(r, -w * 0.25, 0, 2, h * 0.5, 0.21), elipse(w * 0.25, 0, 0.3, 0.3, 'porcelana', 0.8, { detalhe: 2 }), elipse(w * 0.25, 0, 0.18, 0.18, 'papel.folha', 0.81, { detalhe: 3 })]); } },

  { id: 'escrivaninha', nome: 'Escrivaninha', categoria: 'mesas', tipo: 'piso', funcoes: ['escritorio', 'biblioteca', 'quarto'], tags: ['mesa', 'trabalho', 'abajur'], pegada: [1.5, 0.8],
    gerar: p => { const r = mulberry32(p.seed); return piso([1.5, 0.8], [ret(0, 0, 1.44, 0.72, 'madeira.escura', 0.76, { raio: 0.02 }), ...folhas(r, -0.15, 0.02, 4, 0.55, 0.21), ret(-0.5, -0.12, 0.26, 0.3, '#2f4a32', 0.82, { raio: 0.01, detalhe: 2 }), elipse(0.08, -0.2, 0.06, 0.06, 'pedra.escura', 0.82, { detalhe: 3 }), elipse(0.5, 0.05, 0.36, 0.36, 'tecido.linho', 1.25), elipse(0.5, 0.05, 0.1, 0.1, 'latao', 1.27, { detalhe: 2 })]); } },

  { id: 'aparador', nome: 'Aparador', categoria: 'armazenamento', tipo: 'piso', funcoes: ['sala', 'cozinha', 'corredor'], tags: ['movel', 'madeira'], pegada: [1.7, 0.5],
    gerar: p => { const r = mulberry32(p.seed); return piso([1.7, 0.5], [ret(0, 0, 1.66, 0.46, 'madeira.escura', 0.85, { raio: 0.02 }), elipse(-0.55, 0, 0.2, 0.2, 'latao', 1.1), elipse(-0.55, 0, 0.11, 0.11, 'tecido.veludo-vinho', 1.15, { detalhe: 2 }), ret(0.1, -0.02, 0.32, 0.24, 'couro.marrom', 0.9, { raio: 0.01 }), ret(0.12, -0.04, 0.28, 0.2, LOMBADAS[Math.floor(r() * LOMBADAS.length)]!, 0.95, { raio: 0.01, detalhe: 2 }), elipse(0.55, 0.02, 0.08, 0.08, 'papel.folha', 1.0, { detalhe: 2 })]); } },

  { id: 'comoda', nome: 'Cômoda', categoria: 'armazenamento', tipo: 'piso', funcoes: ['quarto', 'sala'], tags: ['movel', 'gavetas'], pegada: [1.0, 0.5],
    gerar: () => piso([1, 0.5], [ret(0, 0, 1, 0.5, 'madeira.media', 0.85, { raio: 0.02 }), ret(0, 0, 0.94, 0.44, 'madeira.clara', 0.86, { contorno: 'leve', detalhe: 2 }), ret(0, 0, 0.012, 0.44, 'madeira.escura', 0.87, { detalhe: 3 }), elipse(-0.25, 0.1, 0.05, 0.05, 'latao', 0.9, { detalhe: 3 }), elipse(0.25, 0.1, 0.05, 0.05, 'latao', 0.9, { detalhe: 3 })]) },

  { id: 'armario', nome: 'Guarda-roupa', categoria: 'armazenamento', tipo: 'piso', funcoes: ['quarto'], tags: ['movel', 'roupas'], pegada: [1.2, 0.6],
    gerar: () => piso([1.2, 0.6], [ret(0, 0, 1.2, 0.6, 'madeira.escura', 2.0, { raio: 0.02 }), ret(0, 0, 1.12, 0.52, 'madeira.media', 2.02, { contorno: 'leve', detalhe: 2 }), ret(0, 0, 0.015, 0.52, 'madeira.escura', 2.03, { detalhe: 3 }), ret(-0.55, 0, 0.02, 0.5, 'madeira.clara', 2.03, { detalhe: 3 })]) },

  { id: 'estante.piso', nome: 'Estante baixa', categoria: 'armazenamento', tipo: 'piso', funcoes: ['biblioteca', 'sala', 'escritorio'], tags: ['livros', 'estante'], pegada: [1.6, 0.4],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.6, min: 0.6, max: 4, passo: 0.2 }],
    gerar: p => { const w = num(p, 'largura', 1.6, 0.6, 4), r = mulberry32(p.seed), partes: Parte[] = [ret(0, 0, w, 0.4, 'madeira.escura', 1.1, { raio: 0.02 })]; for (let u = -w / 2 + 0.07; u < w / 2 - 0.1;) { const l = 0.05 + r() * 0.06; partes.push(ret(u + l / 2, 0, l, 0.3 + r() * 0.05, LOMBADAS[Math.floor(r() * LOMBADAS.length)]!, 1.12, { detalhe: 2, contorno: 'leve' })); u += l + 0.004; } return piso([w, 0.4], partes); } },

  { id: 'cadeira', nome: 'Cadeira', categoria: 'assentos', tipo: 'piso', funcoes: ['sala', 'cozinha', 'escritorio', 'taverna'], tags: ['assento'], pegada: [0.5, 0.5],
    campos: [{ id: 'estofado', rotulo: 'Estofado', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }],
    gerar: p => piso([0.5, 0.5], [ret(0, 0.02, 0.46, 0.44, 'madeira.media', 0.45, { raio: 0.04 }), ret(0, 0.04, 0.34, 0.32, mat(p, 'estofado', 'tecido.veludo-vinho'), 0.5, { raio: 0.05, detalhe: 2 }), ret(0, -0.21, 0.48, 0.08, 'madeira.escura', 0.92, { raio: 0.03 })]) },

  { id: 'banco', nome: 'Banco', categoria: 'assentos', tipo: 'piso', funcoes: ['taverna', 'cozinha', 'corredor', 'igreja'], tags: ['assento', 'madeira'], pegada: [1.2, 0.35],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1.2, min: 0.4, max: 4, passo: 0.1 }],
    gerar: p => { const w = num(p, 'largura', 1.2, 0.4, 4); return piso([w, 0.35], [ret(0, 0, w, 0.35, 'madeira.media', 0.46, { raio: 0.03 }), ret(0, 0, w - 0.1, 0.012, 'madeira.escura', 0.47, { detalhe: 3 })]); } },

  { id: 'poltrona', nome: 'Poltrona', categoria: 'assentos', tipo: 'piso', funcoes: ['sala', 'biblioteca', 'escritorio'], tags: ['assento', 'couro'], pegada: [1, 1],
    campos: [{ id: 'estofado', rotulo: 'Estofado', tipo: 'material', padrao: 'couro.marrom', uso: 'objeto' }],
    gerar: p => { const e = mat(p, 'estofado', 'couro.marrom'); return piso([1, 1], [ret(0, 0.02, 0.92, 0.86, e, 0.42, { raio: 0.14 }), ret(0, 0.08, 0.6, 0.56, e, 0.5, { raio: 0.1, detalhe: 2 }), ret(-0.39, 0.06, 0.16, 0.74, e, 0.65, { raio: 0.07 }), ret(0.39, 0.06, 0.16, 0.74, e, 0.65, { raio: 0.07 }), ret(0, -0.34, 0.92, 0.2, e, 0.95, { raio: 0.08 })]); } },

  { id: 'sofa', nome: 'Sofá', categoria: 'assentos', tipo: 'piso', funcoes: ['sala'], tags: ['assento', 'estofado'], pegada: [2.0, 0.9],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2.0, min: 1.2, max: 3.5, passo: 0.1 }, { id: 'estofado', rotulo: 'Estofado', tipo: 'material', padrao: 'tecido.veludo-azul', uso: 'objeto' }],
    gerar: p => { const w = num(p, 'largura', 2, 1.2, 3.5), e = mat(p, 'estofado', 'tecido.veludo-azul'); return piso([w, 0.9], [ret(0, 0, w, 0.9, e, 0.42, { raio: 0.12 }), ret(0, 0.1, w - 0.4, 0.58, e, 0.5, { raio: 0.08, detalhe: 2, contorno: 'leve' }), ret(0, -0.36, w, 0.2, e, 0.95, { raio: 0.08 }), ret(-w / 2 + 0.1, 0.05, 0.2, 0.8, e, 0.7, { raio: 0.08 }), ret(w / 2 - 0.1, 0.05, 0.2, 0.8, e, 0.7, { raio: 0.08 }), ret(0, 0.1, 0.012, 0.56, 'ferro', 0.51, { detalhe: 3 })]); } },

  { id: 'mesinha', nome: 'Mesinha', categoria: 'mesas', tipo: 'piso', funcoes: ['sala', 'quarto', 'biblioteca'], tags: ['mesa', 'redonda'], pegada: [0.6, 0.6],
    gerar: p => { const r = mulberry32(p.seed); return piso([0.6, 0.6], [elipse(0, 0, 0.56, 0.56, 'madeira.media', 0.55), ret(-0.06, 0.04, 0.2, 0.15, LOMBADAS[Math.floor(r() * LOMBADAS.length)]!, 0.6, { raio: 0.01, detalhe: 2 }), elipse(0.12, -0.1, 0.1, 0.1, 'papel.folha', 0.62, { detalhe: 2 })]); } },

  { id: 'cama.solteiro', nome: 'Cama de solteiro', categoria: 'camas', tipo: 'piso', funcoes: ['quarto', 'hospital'], tags: ['cama', 'dormir'], pegada: [0.95, 2.0],
    campos: [{ id: 'cobertor', rotulo: 'Cobertor', tipo: 'material', padrao: 'tecido.verde', uso: 'objeto' }],
    gerar: p => piso([0.95, 2], [ret(0, 0, 0.95, 2, 'madeira.escura', 0.5, { raio: 0.03 }), ret(0, 0.02, 0.85, 1.88, 'tecido.linho', 0.56, { raio: 0.04, detalhe: 2 }), ret(0, -0.78, 0.55, 0.32, 'tecido.linho', 0.7, { raio: 0.08 }), ret(0, 0.28, 0.85, 1.3, mat(p, 'cobertor', 'tecido.verde'), 0.62, { raio: 0.04 }), ret(0, -0.12, 0.85, 0.09, 'tecido.linho', 0.63, { detalhe: 2 })]) },

  { id: 'cama.casal', nome: 'Cama de casal', categoria: 'camas', tipo: 'piso', funcoes: ['quarto'], tags: ['cama', 'dormir'], pegada: [1.7, 2.1],
    campos: [{ id: 'cobertor', rotulo: 'Colcha', tipo: 'material', padrao: 'tecido.veludo-vinho', uso: 'objeto' }],
    gerar: p => piso([1.7, 2.1], [ret(0, 0, 1.7, 2.1, 'madeira.escura', 0.5, { raio: 0.03 }), ret(0, 0.02, 1.6, 1.98, 'tecido.linho', 0.56, { raio: 0.04, detalhe: 2 }), ret(-0.4, -0.8, 0.6, 0.34, 'tecido.linho', 0.7, { raio: 0.08 }), ret(0.4, -0.8, 0.6, 0.34, 'tecido.linho', 0.7, { raio: 0.08 }), ret(0, 0.3, 1.6, 1.4, mat(p, 'cobertor', 'tecido.veludo-vinho'), 0.62, { raio: 0.04 }), ret(0, -0.1, 1.6, 0.1, 'tecido.linho', 0.63, { detalhe: 2 })]) },

  { id: 'tapete.persa', nome: 'Tapete persa', categoria: 'tapetes', tipo: 'piso', funcoes: ['sala', 'quarto', 'biblioteca', 'escritorio'], tags: ['tapete', 'persa'], pegada: [3.2, 2.2],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 3.2, min: 1, max: 8, passo: 0.2 }, { id: 'altura', rotulo: 'Profundidade', tipo: 'numero', padrao: 2.2, min: 1, max: 8, passo: 0.2 }, { id: 'material', rotulo: 'Padrão', tipo: 'material', padrao: 'tapete.persa', uso: 'objeto' }],
    gerar: p => { const w = num(p, 'largura', 3.2, 1, 8), h = num(p, 'altura', 2.2, 1, 8); return piso([w, h], [ret(0, 0, w, h, mat(p, 'material', 'tapete.persa'), 0.01, { semSombra: true, contorno: 'leve' })]); } },

  { id: 'tapete.liso', nome: 'Tapete liso', categoria: 'tapetes', tipo: 'piso', funcoes: ['sala', 'quarto', 'corredor'], tags: ['tapete'], pegada: [2.4, 1.6],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2.4, min: 0.6, max: 8, passo: 0.2 }, { id: 'altura', rotulo: 'Profundidade', tipo: 'numero', padrao: 1.6, min: 0.6, max: 8, passo: 0.2 }, { id: 'material', rotulo: 'Cor', tipo: 'material', padrao: 'carpete.vinho', uso: 'piso' }],
    gerar: p => { const w = num(p, 'largura', 2.4, 0.6, 8), h = num(p, 'altura', 1.6, 0.6, 8); return piso([w, h], [ret(0, 0, w, h, mat(p, 'material', 'carpete.vinho'), 0.01, { semSombra: true, contorno: 'leve', raio: 0.04 })]); } },

  { id: 'balcao', nome: 'Balcão com pia', categoria: 'cozinha', tipo: 'piso', funcoes: ['cozinha', 'banheiro', 'taverna'], tags: ['balcao', 'pia'], pegada: [2.0, 0.62],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2, min: 0.8, max: 5, passo: 0.2 }],
    gerar: p => { const w = num(p, 'largura', 2, 0.8, 5); return piso([w, 0.62], [ret(0, 0, w, 0.62, 'madeira.escura', 0.9, { raio: 0.02 }), ret(0, 0, w - 0.06, 0.56, 'azulejo.branco', 0.92, { contorno: 'leve', detalhe: 2 }), ret(-w * 0.18, 0, 0.6, 0.4, 'ferro', 0.88, { raio: 0.05 }), ret(-w * 0.18, 0, 0.5, 0.3, 'porcelana', 0.85, { raio: 0.04, detalhe: 2 }), elipse(-w * 0.18, -0.2, 0.05, 0.05, 'latao', 1.0, { detalhe: 3 })]); } },

  { id: 'vaso.planta', nome: 'Vaso com planta', categoria: 'decoracao', tipo: 'piso', funcoes: ['sala', 'corredor', 'escritorio', 'jardim'], tags: ['planta', 'vaso', 'folhagem'], pegada: [0.55, 0.55],
    gerar: p => { const r = mulberry32(p.seed), partes: Parte[] = [elipse(0, 0, 0.5, 0.5, 'madeira.escura', 0.5)]; for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2 + r(), d = 0.12 + r() * 0.1; partes.push(elipse(Math.cos(a) * d, Math.sin(a) * d, 0.26, 0.14, 'folhagem', 0.7 + i * 0.01, { dir: a, detalhe: 2 })); } return piso([0.55, 0.55], partes); } },

  { id: 'papeis', nome: 'Papéis soltos', categoria: 'decoracao', tipo: 'piso', funcoes: ['escritorio', 'biblioteca', 'sala', 'laboratorio'], tags: ['papel', 'pista'], pegada: [0.5, 0.4],
    gerar: p => piso([0.5, 0.4], folhas(mulberry32(p.seed), 0, 0, 3, 0.25, 0.21).map(x => ({ ...x, z: x.z - 0.7 }))) },

  { id: 'livros.pilha', nome: 'Pilha de livros', categoria: 'decoracao', tipo: 'piso', funcoes: ['biblioteca', 'escritorio', 'sala'], tags: ['livros'], pegada: [0.34, 0.26],
    gerar: p => { const r = mulberry32(p.seed), partes: Parte[] = []; for (let i = 0; i < 3 + Math.floor(r() * 2); i++) partes.push(ret((r() - 0.5) * 0.04, (r() - 0.5) * 0.03, 0.3 - i * 0.02, 0.22 - i * 0.015, LOMBADAS[Math.floor(r() * LOMBADAS.length)]!, 0.06 + i * 0.05, { raio: 0.01, detalhe: 2 })); return piso([0.34, 0.26], partes); } },

  // Objetos de parede
  { id: 'quadro', nome: 'Quadro', categoria: 'parede', tipo: 'parede', funcoes: ['sala', 'quarto', 'biblioteca', 'corredor', 'escritorio'], tags: ['pintura', 'moldura'], pegada: [1.0, 0.05],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 1, min: 0.3, max: 3, passo: 0.1 }],
    gerar: p => { const l = num(p, 'largura', 1, 0.3, 3); return parede(l, [ret(0, 1.65, l, 0.72, 'moldura.dourada', 0.03), ret(0, 1.65, l - 0.14, 0.58, 'pintura.paisagem', 0.04)], [ret(0, 0.03, l, 0.05, 'moldura.dourada', 1.6)]); } },
  { id: 'espelho', nome: 'Espelho', categoria: 'parede', tipo: 'parede', funcoes: ['banheiro', 'quarto', 'corredor', 'sala'], tags: ['espelho', 'vidro'], pegada: [0.8, 0.04],
    gerar: () => parede(0.8, [ret(0, 1.5, 0.8, 1.1, 'moldura.dourada', 0.03, { raio: 0.1 }), ret(0, 1.5, 0.68, 0.98, 'vidro', 0.04, { raio: 0.08, vidro: true })], [ret(0, 0.02, 0.8, 0.04, 'moldura.dourada', 1.5)]) },
  { id: 'estante', nome: 'Estante de parede', categoria: 'parede', tipo: 'parede', funcoes: ['biblioteca', 'escritorio', 'sala'], tags: ['livros', 'estante'], pegada: [2.6, 0.36],
    campos: [{ id: 'largura', rotulo: 'Largura', tipo: 'numero', padrao: 2.6, min: 0.8, max: 5, passo: 0.2 }],
    gerar: p => {
      const l = num(p, 'largura', 2.6, 0.8, 5), r = mulberry32(p.seed), face: Parte[] = [ret(0, 1.1, l, 2.2, 'madeira.escura', 0.35)], topo: Parte[] = [ret(0, 0.18, l, 0.36, 'madeira.escura', 2.2)];
      const prateleiras = 5, alt = 2.05 / prateleiras;
      for (let i = 0; i < prateleiras; i++) {
        const z0 = 0.08 + i * alt; face.push(ret(0, z0 + alt / 2, l - 0.1, alt - 0.05, 'pedra.escura', 0.36, { contorno: false }));
        for (let u = -l / 2 + 0.07; u < l / 2 - 0.12;) { const w = 0.06 + r() * 0.07, h = alt * (0.6 + r() * 0.3); if (r() < 0.08) { u += w * 2; continue; } face.push(ret(u + w / 2, z0 + h / 2 + 0.02, w, h, LOMBADAS[Math.floor(r() * LOMBADAS.length)]!, 0.37, { detalhe: 2, contorno: 'leve' })); u += w + 0.004; }
      }
      for (let u = -l / 2 + 0.1; u < l / 2 - 0.1; u += 0.08 + r() * 0.06) topo.push(ret(u, 0.2, 0.06, 0.24, LOMBADAS[Math.floor(r() * LOMBADAS.length)]!, 2.21, { detalhe: 2, contorno: false }));
      return parede(l, face, topo);
    } },
];
