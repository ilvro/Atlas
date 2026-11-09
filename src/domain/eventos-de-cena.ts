/** Efeitos curtos de cena, do domínio. */
export const EVENTOS_DE_CENA = ['tremor', 'piscar', 'escurecer', 'clarao'] as const;
export type EventoDeCena = (typeof EVENTOS_DE_CENA)[number];
export const ROTULO_DO_EVENTO: Record<EventoDeCena, string> = {
  tremor: 'Tremor',
  piscar: 'Luzes piscam',
  escurecer: 'Escurecer',
  clarao: 'Clarão',
};
