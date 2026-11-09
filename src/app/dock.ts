import { signal } from '@preact/signals';
import { embutido } from './embutido.ts';
import { tocar } from '../fx/som.ts';

/** Quais seções do dock estão abertas. */
// Embutido na Mesa o espaço é curto: o dock começa com as seções recolhidas, para não cobrir o mapa.
export const secoesAbertasNoDock = signal<Record<string, boolean>>({
  clima: !embutido,
  cena: !embutido,
  presenca: false,
  momentos: false,
  iniciativa: false,
  personagens: false,
  pistas: false,
  projetor: false,
});

export function alternarSecaoNoDock(id: string): void {
  const aberta = secoesAbertasNoDock.value[id] ?? false;
  secoesAbertasNoDock.value = { ...secoesAbertasNoDock.value, [id]: !aberta };
  tocar('selecionar');
}

export function abrirSecaoNoDock(id: string): void {
  secoesAbertasNoDock.value = { ...secoesAbertasNoDock.value, [id]: true };
  tocar('selecionar');
}
