import { projetarNaParede, centroDaAbertura } from './geometria.ts';
import type { MapaAtlas, Peca, Ponto } from './mapa.ts';
import { oclusores, type Segmento } from './visibilidade.ts';

/** O centro da célula da grade onde está o ponto (a peça sempre se encaixa no centro de uma célula). */
export function centroDaCelula(m: Pick<MapaAtlas, 'grid'>, p: Ponto): Ponto {
  const t = m.grid.size, [ox, oy] = m.grid.offset;
  return [ox + (Math.floor((p[0] - ox) / t) + 0.5) * t, oy + (Math.floor((p[1] - oy) / t) + 0.5) * t];
}

/** Onde o segmento a→b cruza o segmento s (o ponto), ou `null`. Encostar na ponta não conta como atravessar. */
function cruzamento(a: Ponto, b: Ponto, s: Segmento): Ponto | null {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = s.b[0] - s.a[0], sy = s.b[1] - s.a[1], den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const t = ((s.a[0] - a[0]) * sy - (s.a[1] - a[1]) * sx) / den, u = ((s.a[0] - a[0]) * ry - (s.a[1] - a[1]) * rx) / den;
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6 ? [a[0] + rx * t, a[1] + ry * t] : null;
}

/** Por que um passo de `de` a `para` não pode ser dado: parede, porta fechada ou porta trancada no meio do caminho. `null` se o caminho está livre (arco e porta aberta passam). */
export function bloqueioNoCaminho(m: Pick<MapaAtlas, 'walls' | 'openings'>, de: Ponto, para: Ponto): string | null {
  for (const s of oclusores(m, 'movimento')) {
    const x = cruzamento(de, para, s); if (!x) continue;
    // Se o cruzamento cai no vão de uma porta, o motivo é a porta; senão, é a parede.
    for (const o of Object.values(m.openings)) {
      const p = m.walls[o.wallId]; if (!p || (o.kind !== 'door' && o.kind !== 'secret')) continue;
      const r = projetarNaParede(p, x);
      if (r.distancia < 0.15 && Math.abs(r.dist - centroDaAbertura(p, o)) <= o.width / 2 + 0.02) return o.state === 'locked' ? 'A porta está trancada.' : 'A porta está fechada.';
    }
    return 'Tem uma parede no caminho.';
  }
  return null;
}

/** O lado para onde a peça olha ao andar de `de` a `para` (y cresce para baixo). */
export function ladoDoMovimento(de: Ponto, para: Ponto): Peca['facing'] {
  const dx = para[0] - de[0], dy = para[1] - de[1];
  return Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'down' : 'up');
}
/** O ângulo (rad) do movimento, para apontar a lanterna. */
export const anguloDoMovimento = (de: Ponto, para: Ponto): number => Math.atan2(para[1] - de[1], para[0] - de[0]);
