import { centroDaAbertura, comprimentoDaParede, pontoNaParede } from './geometria.ts';
import type { MapaAtlas, Peca, Ponto } from './mapa.ts';

/** Até onde uma peça alcança para abrir uma porta ou mexer num objeto, em metros. */
export const ALCANCE_DE_INTERACAO = 1.2;

/** Algo com que uma peça pode interagir. A 7.6a acrescenta os objetos interativos. */
export interface Interagivel { tipo: 'abertura' | 'objeto'; id: string; distancia: number; aFrente: boolean }

const OLHAR: Record<Peca['facing'], Ponto> = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

/** O ponto do segmento a→b mais perto de p. */
function pontoMaisPerto(p: Ponto, a: Ponto, b: Ponto): Ponto {
  const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy, u = q < 1e-12 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q));
  return [a[0] + dx * u, a[1] + dy * u];
}

/**
 * As portas (e portas secretas) ao alcance da peça, a que estiver à frente dela primeiro e, entre iguais, a mais perto.
 * A distância é até o vão da porta, não até o centro: uma porta larga também se alcança pelo lado.
 */
export function interagiveisPerto(m: Pick<MapaAtlas, 'walls' | 'openings'> & Partial<Pick<MapaAtlas, 'props'>>, peca: Pick<Peca, 'position' | 'facing'>, alcance = ALCANCE_DE_INTERACAO): Interagivel[] {
  const p: Ponto = [peca.position[0], peca.position[1]], olhar = OLHAR[peca.facing], saida: Interagivel[] = [];
  for (const o of Object.values(m.openings)) {
    if (o.kind !== 'door' && o.kind !== 'secret') continue;
    const parede = m.walls[o.wallId]; if (!parede) continue;
    const c = centroDaAbertura(parede, o), meia = o.width / 2, comp = comprimentoDaParede(parede);
    const perto = pontoMaisPerto(p, pontoNaParede(parede, Math.max(0, c - meia)).ponto, pontoNaParede(parede, Math.min(comp, c + meia)).ponto);
    const distancia = Math.hypot(perto[0] - p[0], perto[1] - p[1]);
    if (distancia > alcance) continue;
    const aFrente = distancia < 1e-6 || ((perto[0] - p[0]) * olhar[0] + (perto[1] - p[1]) * olhar[1]) / distancia > 0.5;
    saida.push({ tipo: 'abertura', id: o.id, distancia, aFrente });
  }
  // Objetos interativos (interruptor, gaveta): alcançados pelo ponto onde estão.
  for (const o of Object.values(m.props ?? {})) {
    if (!o.interaction) continue;
    const dx = o.position[0] - p[0], dy = o.position[1] - p[1], distancia = Math.hypot(dx, dy);
    if (distancia > alcance + (o.elevation === 'wall' ? 0.3 : 0.5)) continue;
    saida.push({ tipo: 'objeto', id: o.id, distancia, aFrente: distancia < 1e-6 || (dx * olhar[0] + dy * olhar[1]) / distancia > 0.5 });
  }
  return saida.sort((x, y) => Number(y.aFrente) - Number(x.aFrente) || x.distancia - y.distancia);
}
