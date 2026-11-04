/** Efeitos curtos de cena, do render e não do documento: o mestre os dispara ao vivo e nada fica gravado. */
export const EVENTOS_DE_CENA = ['tremor', 'piscar', 'escurecer', 'clarao'] as const;
export type EventoDeCena = (typeof EVENTOS_DE_CENA)[number];
export const ROTULO_DO_EVENTO: Record<EventoDeCena, string> = { tremor: 'Tremor', piscar: 'Luzes piscam', escurecer: 'Escurecer', clarao: 'Clarão' };
export const DURACAO_DO_EVENTO_MS: Record<EventoDeCena, number> = { tremor: 800, piscar: 1500, escurecer: 4000, clarao: 350 };

export interface EstadoDosEventos {
  /** Deslocamento da câmera, em pixels da tela. */
  tremor: [number, number];
  /** Multiplicador da intensidade das luzes do mapa (1 = normal). */
  luzes: number;
  /** Multiplicador do ambiente (1 = normal). */
  ambiente: number;
  /** Opacidade do branco por cima de tudo (0 = nada). */
  clarao: number;
  /** Quais eventos estão rodando agora. */
  ativos: EventoDeCena[];
}

export interface EventosDeCena {
  disparar(e: EventoDeCena, agora: number): void;
  estado(agora: number): EstadoDosEventos;
}

/** Com movimento reduzido o tremor vira um clarão curto. */
export function criarEventosDeCena(reduzido: () => boolean): EventosDeCena {
  const inicio = new Map<EventoDeCena, number>();
  return {
    disparar(e, agora) { inicio.set(reduzido() && e === 'tremor' ? 'clarao' : e, agora); },
    estado(agora) {
      const s: EstadoDosEventos = { tremor: [0, 0], luzes: 1, ambiente: 1, clarao: 0, ativos: [] };
      for (const [e, t0] of inicio) {
        const ms = agora - t0, u = ms / DURACAO_DO_EVENTO_MS[e];
        if (u >= 1) { inicio.delete(e); continue; }
        s.ativos.push(e);
        if (e === 'tremor') { const a = 9 * (1 - u) ** 2; s.tremor = [Math.sin(ms * 0.11) * a, Math.cos(ms * 0.087 + 1) * a * 0.8]; }
        else if (e === 'piscar') s.luzes = u > 0.8 ? 0.15 + 0.85 * ((u - 0.8) / 0.2) : Math.sin(ms * 0.045) + 0.6 * Math.sin(ms * 0.13) > 0 ? 1 : 0.12;
        else if (e === 'escurecer') s.ambiente = ms < 400 ? 1 - 0.7 * (ms / 400) : u > 0.75 ? 0.3 + 0.7 * ((u - 0.75) / 0.25) : 0.3;
        else s.clarao = Math.max(s.clarao, (reduzido() ? 0.4 : 0.9) * (1 - u) ** 2);
      }
      return s;
    },
  };
}
