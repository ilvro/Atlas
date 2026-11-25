// Regra pura do fundo de uma amostra de material: a textura de verdade (Ilustrado) quando há catálogo, senão o degradê de três cores.
import type { Material } from '../procedural/materiais.ts';
import type { CatalogoDeTexturas } from '../procedural/texturas.ts';
import { baseDasTexturas } from '../procedural/texturas-carregadas.ts';

/** Quantos metros de chão a amostra mostra. */
export const METROS_DA_AMOSTRA = 2;

export const degradeDe = (m: Pick<Material, 'claro' | 'base' | 'escuro'>): string => `linear-gradient(135deg, ${m.claro} 0%, ${m.base} 50%, ${m.escuro} 100%)`;

/** O fundo da amostra: a primeira camada da textura (se o catálogo a conhece), ladrilhada em ~2 m (com a `escala` da camada), com o tom base da camada (ou a `base` do material) por cima na força de `tingir`. */
export function fundoDaAmostra(m: Pick<Material, 'claro' | 'base' | 'escuro' | 'textura'>, catalogo: CatalogoDeTexturas | null | undefined, tamanho: number): { backgroundImage: string; backgroundSize?: string } {
  const primeira = m.textura?.camadas[0], t = primeira && catalogo?.texturas.find(x => x.id === primeira.textura);
  if (!m.textura || !t) return { backgroundImage: degradeDe(m) };
  const lado = Math.max(4, Math.round((tamanho * t.metros * (primeira.escala ?? 1)) / METROS_DA_AMOSTRA * 100) / 100);
  const cor = primeira.tons?.[1] ?? m.base, forca = Math.round(Math.min(1, Math.max(0, m.textura.tingir)) * 100);
  const tinta = `linear-gradient(color-mix(in srgb, ${cor} ${forca}%, transparent), color-mix(in srgb, ${cor} ${forca}%, transparent))`;
  return { backgroundImage: `${tinta}, url(${baseDasTexturas()}${t.arquivo})`, backgroundSize: `auto, ${lado}px ${lado}px` };
}
