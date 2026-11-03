/** Quanto e como cada tipo de partícula aparece. Sem Pixi: os números ficam testáveis. */
export type TipoDeParticula = 'chuva' | 'neve' | 'poeira' | 'brasa' | 'folha';

export const TETO_DE_PARTICULAS = 4000;

/** Partículas por metro quadrado com a intensidade em 1 (as brasas contam por luz de fogo, não por área). */
export const DENSIDADE: Record<Exclude<TipoDeParticula, 'brasa'>, number> = { chuva: 2.2, neve: 1, poeira: 0.9, folha: 0.1 };
export const BRASAS_POR_FOGO = 24, BRASAS_SOLTAS_POR_M2 = 0.04, TETO_DE_BRASAS = 600;

/** Quantas partículas um tipo precisa, proporcional à área e à intensidade (0 a 1), com teto. */
export function quantidade(densidade: number, area: number, intensidade: number, teto = TETO_DE_PARTICULAS): number {
  if (!(intensidade > 0) || !(area > 0)) return 0;
  return Math.min(teto, Math.ceil(densidade * area * Math.min(1, intensidade) - 1e-9));   // a folga evita que 2,2 × 1350 vire 2971 por erro de ponto flutuante
}

/** A chuva cai na razão `vento × 0,4` de deslocamento horizontal por vertical; o traço acompanha a inclinação. */
export const inclinacaoDaChuva = (vento: number): number => -Math.atan(vento * 0.4);

/** O fator de velocidade com movimento reduzido: tudo cai e deriva bem mais devagar. */
export const FATOR_DE_MOVIMENTO_REDUZIDO = 0.35;

/** Neblina: opacidade máxima e quanto ela vale dentro dos cômodos (50% da de fora). */
export const NEBLINA_ALFA_MAXIMO = 0.55, NEBLINA_DENTRO = 0.5;
export const alfaDaNeblina = (fog: number): number => NEBLINA_ALFA_MAXIMO * Math.min(1, Math.max(0, fog));
