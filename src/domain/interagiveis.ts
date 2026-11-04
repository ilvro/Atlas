import { comodoEm, indiceDeCelulas } from './geometria.ts';
import type { MapaAtlas, Objeto } from './mapa.ts';

export const ROTULO_DA_INTERACAO: Record<NonNullable<Objeto['interaction']>['kind'], string> = { switch: 'Interruptor', drawer: 'Gaveta', clue: 'Pista' };

/** O cômodo onde o objeto está (o que ele guarda, ou o que a posição dele cai). */
const comodoDo = (m: MapaAtlas, o: Objeto): string | null => o.roomId ?? comodoEm(m, o.position);

/** As luzes de rede (`power: 'grid'`) dentro de um cômodo. */
export function luzesDeRedeDoComodo(m: MapaAtlas, comodo: string | null): string[] {
  if (!comodo) return [];
  const indice = indiceDeCelulas(m);
  return Object.values(m.lights).filter(l => l.power === 'grid' && comodoEm(m, l.position, indice) === comodo).map(l => l.id);
}

/** O que um interruptor liga e desliga: as luzes escolhidas ou, sem escolha, as de rede do cômodo dele (nunca as de fogo). */
export function alvosDoInterruptor(m: MapaAtlas, o: Objeto): string[] {
  const escolhidas = o.interaction?.targets.filter(id => m.lights[id]) ?? [];
  return escolhidas.length ? escolhidas : luzesDeRedeDoComodo(m, comodoDo(m, o));
}

/** O que o objeto interativo é agora, em palavras ("Apagar as luzes", "Abrir a gaveta"). */
export function acaoDoInterativo(o: Objeto): string {
  const i = o.interaction; if (!i) return '';
  return i.kind === 'switch' ? (i.on ? 'Apagar as luzes' : 'Acender as luzes') : i.kind === 'drawer' ? (i.on ? 'Fechar a gaveta' : 'Abrir a gaveta') : 'Inspecionar a pista';
}
