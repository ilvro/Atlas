import type { MapaAtlas } from '../domain/mapa.ts';
import { hexParaNumero } from './cores.ts';

/** Pixels por metro da memória: o traço precisa de mais resolução do que as máscaras. */
export const RES_MEMORIA = 16;
/** Pixels por metro da memória e das máscaras da névoa: no Pixel, os do próprio Pixel (o esboço tem de cair na grade dele). */
export const resDaMemoria = (m: Pick<MapaAtlas, 'style' | 'grid'>): number => (m.style.renderer === 'pixel' ? m.style.pixel.pixelsPerCell / m.grid.size : RES_MEMORIA);
const PAPEIS: Record<string, string> = { 'papel-claro': '#e6dcc3', 'papel-velho': '#d3bf96', 'papel-pardo': '#c9b48a' };

/** A cor do papel: um hex, ou o nome de um papel conhecido (qualquer outro vira o claro). */
export const corDoPapel = (paper: string): number => hexParaNumero(/^#[0-9a-f]{6}$/i.test(paper) ? paper : PAPEIS[paper] ?? PAPEIS['papel-claro']!);
