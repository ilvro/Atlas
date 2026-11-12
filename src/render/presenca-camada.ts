import type { PincelDePresenca } from '../domain/presets.ts';

/** Onde uma presença entra na cena: sob a água, no chão (sob os objetos de piso), sob a luz (aura escura) ou acima da luz (brilha). */
export type CamadaDePresenca = 'submerso' | 'chao' | 'abaixo' | 'acima';

/** Os pincéis naturais (musgo, mofo, sangue seco, sulcos...) são tinta do chão e ficam sob os objetos; só o que é do ar (brilho, sombra, "ordem.*") fica por cima. */
export function camadaDaPresenca(p: PincelDePresenca | undefined): CamadaDePresenca {
  if (p?.submerso) return 'submerso';
  if (p?.brilho) return 'acima';
  if (!p || p.pacote === 'natural') return 'chao';
  return 'abaixo';
}

/** Opacidade máxima da mancha: translúcida, mesmo na intensidade 1 (0,45 dá cerca de 0,36). */
export const opacidadeDaPresenca = (intensidade: number): number => 0.16 + 0.44 * Math.min(1, Math.max(0, intensidade));

/** Texels da máscara por célula do terreno: a máscara é desfocada em CPU (sem `ctx.filter` no WebKitGTK) e por isso precisa de resolução acima da célula. */
export function ampliacaoDaMascara(w: number, h: number, maximo = 2048): number {
  return Math.max(1, Math.min(4, Math.floor(maximo / Math.max(w, h, 1))));
}
