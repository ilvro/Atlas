import { signal } from '@preact/signals';

/** Gaveta flutuante de prévia da ficha (statblock do Dossiê) colada ao token. */
export const previaDaFichaAberta = signal<boolean>(false);

/** Quando fixada, a prévia fica ancorada no canto superior da tela em vez de seguir o token no mapa. */
export const previaFixada = signal<boolean>(false);

/**
 * Calcula a posição em pixels na tela da gaveta da ficha em relação à caixa do token selecionado.
 */
export function calcularPosicaoDaPrevia(
  caixaToken: { cx0: number; cy0: number; cx1: number; cy1: number },
  limitesArea: { left: number; right: number; top: number; bottom: number },
  dimensoes: { largura: number; altura: number } = { largura: 380, altura: 500 },
): { x: number; y: number } {
  const { cx0, cy0, cx1, cy1 } = caixaToken;
  const { largura, altura } = dimensoes;

  // Tenta posicionar à direita do token
  let x = cx1 + 14;
  if (x + largura > limitesArea.right - 10) {
    // Se não couber à direita, posiciona à esquerda
    x = cx0 - largura - 14;
  }
  // Clampa dentro da área do mapa
  x = Math.max(limitesArea.left + 10, Math.min(limitesArea.right - largura - 10, x));

  let y = (cy0 + cy1) / 2 - altura / 2;
  y = Math.max(limitesArea.top + 10, Math.min(limitesArea.bottom - altura - 10, y));

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Gera a URL para exibir a ficha ou ameaça no modo compacto do Dossiê.
 */
export function urlDaPreviaDaFicha(fichaId: string): string {
  return `../Dossie/?ficha=${encodeURIComponent(fichaId)}&compacto=1`;
}
