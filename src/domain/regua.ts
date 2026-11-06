import { celulasEntre } from './celulas.ts';
import type { Grade, Ponto } from './mapa.ts';

/** Como a régua conta as diagonais: todas valem 1, alternam 1, 2, 1, 2… (5-10-5) ou euclidiana (distância euclidiana). */
export type RegraDeDiagonal = 'simples' | 'alternada' | 'euclidiana';
export const ROTULO_DA_REGRA: Record<RegraDeDiagonal, string> = {
  simples: 'Simples (todas valem 1)',
  alternada: '5-10-5 (Alternada)',
  euclidiana: 'Euclidiana (linha reta)',
};

/** Distância entre dois pontos do mapa, em quadrados inteiros de `tamanho` metros. */
export function distanciaEmQuadrados(de: Ponto, para: Ponto, tamanho: number, regra: RegraDeDiagonal = 'simples'): number {
  const dx = Math.round(Math.abs(para[0] - de[0]) / tamanho), dy = Math.round(Math.abs(para[1] - de[1]) / tamanho);
  if (regra === 'euclidiana') return Math.round(Math.hypot(dx, dy));
  const diagonais = Math.min(dx, dy), retas = Math.max(dx, dy) - diagonais;
  return regra === 'alternada' ? retas + diagonais + Math.floor(diagonais / 2) : retas + diagonais;
}

/** O percurso inteiro (com dobras): a soma dos trechos, cada um contado pela regra. */
export function distanciaDoPercurso(pontos: readonly Ponto[], tamanho: number, regra: RegraDeDiagonal = 'simples'): number {
  let total = 0;
  for (let i = 1; i < pontos.length; i++) total += distanciaEmQuadrados(pontos[i - 1]!, pontos[i]!, tamanho, regra);
  return total;
}

/** As células da grade que o percurso cruza (sem repetir a célula de uma dobra), para pintar. */
export function pontosDaRegua(pontos: readonly Ponto[], grade: Pick<Grade, 'size' | 'offset'>): [number, number][] {
  const celula = (p: Ponto): [number, number] => [Math.floor((p[0] - grade.offset[0]) / grade.size), Math.floor((p[1] - grade.offset[1]) / grade.size)];
  const saida: [number, number][] = [];
  for (let i = 0; i < pontos.length; i++) {
    const c = celula(pontos[i]!);
    if (i === 0) { saida.push(c); continue; }
    saida.push(...celulasEntre(celula(pontos[i - 1]!), c).slice(1));
  }
  return saida;
}

/** "6 quadrados · 9 m": o texto que a régua mostra. */
export function textoDaRegua(quadrados: number, tamanho: number): string {
  const metros = Math.round(quadrados * tamanho * 100) / 100;
  return `${quadrados} ${quadrados === 1 ? 'quadrado' : 'quadrados'} · ${String(metros).replace('.', ',')} m`;
}
