import { elipse, type Parte } from '../descricao.ts';
import { tom } from '../materiais.ts';
import { mulberry32 } from '../ruido.ts';
import { LUZ_X, LUZ_Y } from '../organico.ts';
import { num, piso, type Receita } from './comum.ts';

// Biomas (Frente Q): o que dá caráter a caverna, selva e vulcão. Os que brilham usam partes `brilho`, que emitem acima da luz da cena
// (multiplicam a própria cor por até 3): por isso as cores do brilho são escuras e saturadas.

const O = { contorno: false as const, semSombra: true };

/** Fungos luminosos: um tufo de chapéus pequenos (2 a 7 cm) em verde-água ou lilás, com o miolo aceso e um halo fraco no chão. */
function fungosLuminosos(seed: number, R: number, lilas: boolean): Parte[] {
  const r = mulberry32(seed), partes: Parte[] = [], base = lilas ? '#3a2458' : '#14484a', aceso = lilas ? '#7a3ab0' : '#1a8a74', halo = lilas ? '#5a2a90' : '#14705e';
  partes.push(elipse(0, 0, R * 2.2, R * 2.2, halo, 0.01, { ...O, brilho: true, alfa: 0.32, desfoque: R * 0.5, detalhe: 1 }));
  const n = Math.round(10 * R * R / 0.09 + 5);
  for (let i = 0; i < n; i++) {
    const d = Math.sqrt(r()) * R, a = r() * Math.PI * 2, x = Math.cos(a) * d, y = Math.sin(a) * d, rc = 0.022 + r() * 0.04 * (1 - d / R * 0.5), z = 0.03 + r() * 0.04;
    partes.push(elipse(x + 0.006, y + 0.006, rc * 2.3, rc * 2.3, '#08060a', z - 0.001, { ...O, alfa: 0.6, detalhe: 2 }));
    partes.push(elipse(x, y, rc * 2, rc * 2, tom(base, (r() - 0.5) * 0.2), z, { contorno: 'leve', semSombra: true, detalhe: 2 }));
    partes.push(elipse(x + LUZ_X * rc * 0.3, y + LUZ_Y * rc * 0.3, rc * 1.1, rc * 1.1, aceso, z + 0.002, { ...O, brilho: true, alfa: 1, detalhe: 2 }));
  }
  return partes;
}

export const RECEITAS_DE_BIOMAS: Receita[] = [
  { id: 'fungos-luminosos', nome: 'Fungos luminosos', categoria: 'exterior', tipo: 'piso', funcoes: ['caverna', 'jardim'], kit: 'caverna', tags: ['fungos', 'cogumelos', 'brilho', 'luminoso', 'caverna', 'rasteira', 'subterraneo', 'natureza', 'magia'], pegada: [0.6, 0.6], altura: 0.08,
    campos: [{ id: 'raio', rotulo: 'Raio (m)', tipo: 'numero', padrao: 0.3, min: 0.15, max: 0.8, passo: 0.05 }, { id: 'lilas', rotulo: 'Cor (0 verde-água, 1 lilás)', tipo: 'numero', padrao: 0, min: 0, max: 1, passo: 1 }],
    gerar: p => { const R = num(p, 'raio', 0.3, 0.15, 0.8); return piso([R * 2, R * 2], fungosLuminosos(p.seed, R, num(p, 'lilas', 0, 0, 1) >= 0.5)); } },
];
