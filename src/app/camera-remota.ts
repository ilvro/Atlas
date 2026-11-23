import type { Caixa } from '../render/selecao.ts';

/** A câmera do projetor remoto: seguindo o mestre ou livre (o jogador mexeu). */
export interface EstadoDaCameraRemota {
  readonly modo: 'seguindo' | 'livre';
  /** A última caixa que o mestre mandou (aplicada ou não), para "Seguir o mestre". */
  readonly ultima: Caixa | null;
}

export type EventoDaCameraRemota =
  | { tipo: 'camera'; caixa: Caixa; imediata?: boolean }
  | { tipo: 'mexeu' }
  | { tipo: 'seguir-mestre' };

export const CAMERA_REMOTA_INICIAL: EstadoDaCameraRemota = { modo: 'seguindo', ultima: null };

/**
 * Decide se a câmera do mestre vale agora. Seguindo, toda `camera` é aplicada; livre, só a `imediata`
 * (um momento de cena), que devolve o modo "seguindo". "Seguir o mestre" volta e aplica a última caixa.
 */
export function decidirCamera(estado: EstadoDaCameraRemota, evento: EventoDaCameraRemota): { estado: EstadoDaCameraRemota; caixa?: Caixa } {
  switch (evento.tipo) {
    case 'camera':
      if (estado.modo === 'seguindo' || evento.imediata) return { estado: { modo: 'seguindo', ultima: evento.caixa }, caixa: evento.caixa };
      return { estado: { ...estado, ultima: evento.caixa } };
    case 'mexeu':
      return { estado: estado.modo === 'livre' ? estado : { ...estado, modo: 'livre' } };
    case 'seguir-mestre':
      return { estado: { ...estado, modo: 'seguindo' }, ...(estado.ultima ? { caixa: estado.ultima } : {}) };
  }
}
