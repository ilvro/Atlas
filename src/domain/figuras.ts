import { ESTADOS_FIGURA } from './mapa.ts';

export type EstadoDaFigura = (typeof ESTADOS_FIGURA)[number];
export const ROTULOS_DE_ESTADO: Record<EstadoDaFigura, string> = { normal: 'Normal', hurt: 'Ferido', dying: 'Morrendo', unconscious: 'Inconsciente', dead: 'Morto', maddened: 'Enlouquecendo' };

export interface AparenciaDoEstado {
  /** Cor do anel; `null` usa o acento do tema. */
  anel: string | null;
  /** Cor que escurece e acinzenta o retrato; `null` não mexe. */
  tinta: string | null;
  deitado: boolean;
  /** 0 a 1: o anel pulsa. */
  pulso: number;
  /** 0 a 1: a peça treme. */
  tremor: number;
  marca: 'x' | null;
}

/** Como cada estado parece no mapa (adaptado do Tabletop: ferido tinge de vermelho, morrendo pulsa, inconsciente e morto deitam e perdem a cor, enlouquecendo treme e roxo). */
export function aparenciaDoEstado(estado: EstadoDaFigura): AparenciaDoEstado {
  switch (estado) {
    case 'hurt': return { anel: '#e0342c', tinta: null, deitado: false, pulso: 0, tremor: 0, marca: null };
    case 'dying': return { anel: '#e0342c', tinta: '#b08080', deitado: false, pulso: 1, tremor: 0, marca: null };
    case 'unconscious': return { anel: '#8a8d96', tinta: '#8a8d96', deitado: true, pulso: 0, tremor: 0, marca: null };
    case 'dead': return { anel: '#5a5d66', tinta: '#5a5d66', deitado: true, pulso: 0, tremor: 0, marca: 'x' };
    case 'maddened': return { anel: '#9b59d9', tinta: '#b79adb', deitado: false, pulso: 0, tremor: 1, marca: null };
    default: return { anel: null, tinta: null, deitado: false, pulso: 0, tremor: 0, marca: null };
  }
}
