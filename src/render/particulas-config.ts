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

/** Neblina: opacidade do miolo dos bancos e quanto ela vale dentro dos cômodos (50% da de fora). */
export const NEBLINA_ALFA_MAXIMO = 0.88, NEBLINA_DENTRO = 0.5;
const limitar = (v: number): number => Math.min(1, Math.max(0, v));
/** Opacidade do miolo dos bancos: já forte com pouca neblina (o que cresce com `fog` é sobretudo a área coberta). */
export const alfaDaNeblina = (fog: number): number => (fog > 0 ? NEBLINA_ALFA_MAXIMO * Math.min(1, 0.45 + limitar(fog) * 0.75) : 0);
/** Limiar do ruído dos bancos (0 a 1): quanto menor, mais área coberta. Com `fog` 0,3 são fiapos; com 1, a névoa fecha quase tudo. */
export const coberturaDaNeblina = (fog: number): number => 0.58 - limitar(fog) * 0.42;
/**
 * Cor da névoa a partir da luz ambiente: a névoa espalha a luz, então é bem mais clara que o chão sob a mesma luz (à noite, um cinza
 * azulado; de dia, quase branca). O matiz vem do ambiente, mas puxado para o neutro.
 */
export function corDaNeblina(ambiente: { color: string; intensity: number }): [number, number, number] {
  const c = [1, 3, 5].map(i => parseInt(ambiente.color.slice(i, i + 2), 16) / 255) as [number, number, number];
  const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2] || 1, brilho = Math.min(0.92, 0.36 + 0.62 * lum * limitar(ambiente.intensity));
  return c.map(v => Math.min(1, (0.75 + 0.25 * (v / lum)) * brilho)) as [number, number, number];
}
