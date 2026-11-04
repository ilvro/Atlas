import type { MapaAtlas, Ponto, Regiao } from './mapa.ts';

/** Ponto dentro de um polígono (par-ímpar). A borda conta como dentro só por acaso; regiões são áreas, não linhas. */
export function pontoNoPoligono(p: Ponto, poligono: readonly Ponto[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const [xi, yi] = poligono[i]!, [xj, yj] = poligono[j]!;
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** As regiões em que alguma peça de jogador está agora (todas, ou só as de um tipo). */
export function regioesOcupadas(m: Pick<MapaAtlas, 'regions' | 'tokens'>, kind?: Regiao['kind']): Regiao[] {
  const jogadores = Object.values(m.tokens).filter(t => t.player);
  return Object.values(m.regions).filter(r => (!kind || r.kind === kind) && jogadores.some(t => pontoNoPoligono([t.position[0], t.position[1]], r.polygon)));
}

/**
 * As regiões em que alguma peça de jogador **passou a estar** de `antes` para `depois`: a peça está dentro agora e não estava (ou não existia).
 * Uma peça que já estava dentro, e peças que não são de jogador, não contam.
 */
export function regioesEntradas(antes: Pick<MapaAtlas, 'regions' | 'tokens'>, depois: Pick<MapaAtlas, 'regions' | 'tokens'>): { regiao: string; peca: string }[] {
  const saida: { regiao: string; peca: string }[] = [];
  for (const r of Object.values(depois.regions)) {
    const antiga = antes.regions[r.id] ?? r;
    for (const t of Object.values(depois.tokens)) {
      if (!t.player || !pontoNoPoligono([t.position[0], t.position[1]], r.polygon)) continue;
      const a = antes.tokens[t.id], estavaDentro = !!a && a.player && pontoNoPoligono([a.position[0], a.position[1]], antiga.polygon);
      if (!estavaDentro) saida.push({ regiao: r.id, peca: t.id });
    }
  }
  return saida;
}
