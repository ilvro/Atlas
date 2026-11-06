import { lerHorario } from './clima.ts';
import type { Clima, Ponto } from './mapa.ts';

/**
 * A sombra do sol nos exteriores, derivada do clima (nunca gravada).
 *
 * Convenção de `sun.angle` (a mesma de `ceuNoHorario`): é a posição do sol no seu arco do dia, de 0 (nasce a leste) a π (põe a oeste),
 * com π/2 ao meio-dia. No mapa (x para a direita = leste, y para baixo = sul) o sol está na direção `(cos angle, −sin angle)` e a sombra cai
 * no sentido oposto, `dir = (−cos angle, sin angle)`: de manhã para oeste, ao meio-dia para baixo na tela, à tarde para leste.
 * A elevação vem da hora: 0 antes das 6h e depois das 18h30, máxima às 12h30.
 */
export interface SombraDoSol {
  /** Vetor unitário do sentido em que a sombra cai. */
  dir: Ponto;
  /** Metros de sombra por metro de altura. */
  porMetro: number;
  /** Opacidade da sombra, de 0 a 1. */
  alfa: number;
  /** Cor da sombra (#rrggbb). */
  cor: string;
}

export const NASCER_DA_SOMBRA = 6, POR_DA_SOMBRA = 18.5, ELEVACAO_MAXIMA = (70 * Math.PI) / 180;
export const PORMETRO_MINIMO = 0.25, PORMETRO_MAXIMO = 4;

/** A elevação do sol (radianos) numa hora decimal; `0` fora do dia. */
export function elevacaoDoSol(hora: number): number {
  if (hora <= NASCER_DA_SOMBRA || hora >= POR_DA_SOMBRA) return 0;
  return ELEVACAO_MAXIMA * Math.pow(Math.sin(Math.PI * (hora - NASCER_DA_SOMBRA) / (POR_DA_SOMBRA - NASCER_DA_SOMBRA)), 1.5);
}

const canais = (c: string): [number, number, number] => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
const hex = (v: readonly number[]): string => `#${v.map(x => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('')}`;

/** `null` sem sol, de noite, ou com o sol no horizonte (nada que lance sombra). `pixel`: opaca e um pouco mais clara, porque no Pixel não há desfoque. */
export function sombraDoSol(clima: Pick<Clima, 'sun' | 'time' | 'ambient' | 'weather'>, pixel = false): SombraDoSol | null {
  if (!clima.sun) return null;
  const elev = elevacaoDoSol(lerHorario(clima.time));
  if (elev <= 0) return null;
  const porMetro = Math.min(PORMETRO_MAXIMO, Math.max(PORMETRO_MINIMO, 1 / Math.tan(elev)));
  const a = clima.sun.angle, fator = pixel ? 0.55 : 0.35;
  return {
    dir: [Math.round(-Math.cos(a) * 1e6) / 1e6, Math.round(Math.sin(a) * 1e6) / 1e6],
    porMetro, alfa: pixel ? 1 : Math.min(1, Math.max(0, 0.45 * clima.sun.intensity * (1 - clima.weather.fog))),
    cor: hex(canais(clima.ambient.color).map(v => v * fator)),
  };
}
