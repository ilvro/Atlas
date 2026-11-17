import { elipse, ret, type Parte } from '../descricao.ts';
import { materialDe, tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LOMBADAS } from './comum.ts';

/**
 * Móvel alto rebatido (como nas plantas de mesa pintadas): dentro da mesma pegada, o tampo aparece numa faixa junto da
 * parede (−y) e a frente do móvel (+y) é desenhada em pé, com portas, gavetas, vitrine ou prateleiras de livros, rodapé e
 * puxadores. Como o móvel sempre encosta o −y na parede, a frente fica virada para o cômodo em qualquer parede.
 */
export interface OpcoesDeFrente {
  madeira: string;
  divisao: 'portas' | 'gavetas' | 'vitrine' | 'livros' | 'portas-e-gavetas';
  /** Quantas portas (ou colunas de gavetas). */
  colunas?: number;
  /** Quantas fileiras de gavetas ou prateleiras. */
  fileiras?: number;
  /** Altura do móvel (m), para o z das partes. */
  altura: number;
  /** Cor do painel das portas, quando diferente da madeira (portas lisas pintadas). */
  painel?: string;
  /** Fração da pegada que o tampo ocupa (o resto é a frente). */
  tampo?: number;
  seed?: number;
}

const D = { contorno: false as const, semSombra: true, detalhe: 3 as const };
const cor = (id: string): string => (id.startsWith('#') ? id : materialDe(id).base);

export function movelComFrente(w: number, d: number, o: OpcoesDeFrente): Parte[] {
  const r = mulberry32(o.seed ?? 1), base = cor(o.madeira), z = o.altura, ft = o.tampo ?? 0.36, partes: Parte[] = [];
  const yT0 = -d / 2, yT1 = -d / 2 + d * ft, yF0 = yT1, yF1 = d / 2, hf = yF1 - yF0;
  // Corpo inteiro (dá a sombra e o contorno), tampo com veio e quina clara, frente um pouco mais escura.
  partes.push(ret(0, 0, w, d, tom(base, -0.35), z - 0.06, { raio: 0.015, contorno: 'leve' }));
  partes.push(ret(0, (yT0 + yT1) / 2, w - 0.02, yT1 - yT0 - 0.01, o.madeira, z + 0.01, { dir: 0, contorno: false, semSombra: true, detalhe: 1 }));
  partes.push(ret(0, yT1 - 0.012, w - 0.02, 0.02, tom(base, 0.35), z + 0.012, D));
  partes.push(ret(0, (yF0 + yF1) / 2, w - 0.03, hf - 0.02, tom(base, -0.12), z - 0.05, { contorno: false, semSombra: true, detalhe: 2 }));
  // Rodapé.
  partes.push(ret(0, yF1 - 0.03, w - 0.02, 0.05, tom(base, -0.5), z - 0.015, D));
  const altFrente = hf - 0.07, y0 = yF0 + 0.01;
  const painel = (x: number, y: number, pw: number, ph: number, c: string): void => {
    partes.push(ret(x, y, pw, ph, tom(c, -0.3), z - 0.012, D), ret(x - 0.004, y - 0.004, pw - 0.03, ph - 0.03, c, z - 0.011, D));
    partes.push(ret(x, y - ph / 2 + 0.012, pw - 0.03, 0.01, tom(c, 0.3), z - 0.01, D), ret(x - pw / 2 + 0.012, y, 0.01, ph - 0.03, tom(c, 0.25), z - 0.01, D));
  };
  const puxador = (x: number, y: number): void => { partes.push(elipse(x, y, 0.035, 0.035, '#c9a24a', z - 0.005, D), elipse(x - 0.006, y - 0.006, 0.014, 0.014, '#f0d27a', z - 0.004, D)); };
  const n = Math.max(1, o.colunas ?? Math.max(2, Math.round(w / 0.55))), cw = (w - 0.06) / n;
  if (o.divisao === 'portas' || o.divisao === 'portas-e-gavetas') {
    const hg = o.divisao === 'portas-e-gavetas' ? altFrente * 0.25 : 0, hp = altFrente - hg;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.03 + cw * (i + 0.5);
      painel(x, y0 + hp / 2, cw - 0.02, hp - 0.01, o.painel ?? tom(base, -0.05));
      puxador(x + (i % 2 ? -1 : 1) * (cw / 2 - 0.05), y0 + hp * 0.55);
      if (hg) { painel(x, y0 + hp + hg / 2, cw - 0.02, hg - 0.01, tom(base, -0.05)); puxador(x, y0 + hp + hg / 2); }
    }
  } else if (o.divisao === 'gavetas') {
    const f = Math.max(1, o.fileiras ?? 3), hg = altFrente / f;
    for (let j = 0; j < f; j++) for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.03 + cw * (i + 0.5), y = y0 + hg * (j + 0.5);
      painel(x, y, cw - 0.02, hg - 0.012, tom(base, -0.04 + j * 0.03)); puxador(x - cw * 0.22, y); puxador(x + cw * 0.22, y);
    }
  } else if (o.divisao === 'vitrine') {
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.03 + cw * (i + 0.5), pw = cw - 0.03;
      partes.push(ret(x, y0 + altFrente / 2, pw, altFrente - 0.01, '#2a2e33', z - 0.012, D));
      const f = Math.max(1, o.fileiras ?? 2), hp = altFrente / f;
      for (let j = 0; j < f; j++) {
        const y = y0 + hp * (j + 0.5);
        for (let k = 0; k < Math.max(1, Math.round(pw / 0.14)); k++) partes.push(elipse(x - pw / 2 + 0.08 + k * 0.14, y, Math.min(0.1, hp * 0.6), Math.min(0.1, hp * 0.6), r() < 0.5 ? '#f2eee4' : '#c9a45a', z - 0.011, D));
        partes.push(ret(x, y + hp / 2 - 0.01, pw, 0.012, tom(base, 0.15), z - 0.01, D));
      }
      partes.push(ret(x - pw * 0.2, y0 + altFrente * 0.4, pw * 0.15, altFrente * 0.7, '#ffffff', z - 0.009, { ...D, alfa: 0.55 }));
      partes.push(ret(x - pw / 2 + 0.01, y0 + altFrente / 2, 0.02, altFrente, tom(base, 0.1), z - 0.008, D), ret(x + pw / 2 - 0.01, y0 + altFrente / 2, 0.02, altFrente, tom(base, -0.2), z - 0.008, D));
    }
  } else {
    // Prateleiras de livros: fileiras de lombadas de alturas e cores variadas, com um ou outro livro deitado.
    const f = Math.max(1, o.fileiras ?? 2), hp = altFrente / f;
    for (let j = 0; j < f; j++) {
      const yb = y0 + hp * (j + 1) - 0.012;
      partes.push(ret(0, y0 + hp * (j + 0.5), w - 0.06, hp - 0.02, '#1c120c', z - 0.012, D));
      for (let x = -w / 2 + 0.05; x < w / 2 - 0.06;) {
        const l = 0.03 + r() * 0.035, h = hp * (0.55 + r() * 0.35), c = LOMBADAS[Math.floor(r() * LOMBADAS.length)]!;
        if (r() < 0.06 && x + 0.2 < w / 2 - 0.06) { partes.push(ret(x + 0.08, yb - 0.02, 0.16, 0.035, c, z - 0.01, D)); x += 0.18; continue; }
        partes.push(ret(x + l / 2, yb - h / 2, l - 0.004, h, c, z - 0.01, D), ret(x + l / 2, yb - h * 0.7, l - 0.01, 0.008, tom(c, 0.4), z - 0.009, D));
        x += l + 0.003;
      }
      partes.push(ret(0, yb + 0.006, w - 0.04, 0.014, tom(base, 0.2), z - 0.008, D));
    }
  }
  return partes;
}
