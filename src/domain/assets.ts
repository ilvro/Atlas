import type { MapaAtlas, RefAsset } from './mapa.ts';

/** Todos os assets (imagens guardadas à parte) que um mapa referencia, sem repetir. */
export function assetsDoMapa(m: MapaAtlas): RefAsset[] {
  const achados = new Map<string, RefAsset>();
  const ver = (r: RefAsset | null | undefined) => { if (r) achados.set(r.id, r); };
  for (const t of Object.values(m.tokens)) ver(t.portrait);
  ver(m.session.explored);
  return [...achados.values()];
}
