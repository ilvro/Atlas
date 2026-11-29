import { signal } from '@preact/signals';

/** Gaveta flutuante de prévia da ficha (statblock do Dossiê) colada ao token. */
export const previaDaFichaAberta = signal<boolean>(false);

/** Quando fixada, a prévia fica ancorada no canto superior da tela em vez de seguir o token no mapa. */
export const previaFixada = signal<boolean>(false);

/** Posição manual definida pelo usuário ao arrastar a janela de prévia pela tela. */
export const posicaoManualPrevia = signal<{ x: number; y: number } | null>(null);

/** Indica se a janela de prévia está sendo ativamente arrastada pelo usuário. */
export const arrastandoPrevia = signal<boolean>(false);

export const TAMANHO_PADRAO_PREVIA = { largura: 440, altura: 540 } as const;
export const TAMANHO_MIN_PREVIA = { largura: 320, altura: 320 } as const;
const CHAVE_TAMANHO_PREVIA = 'atlas:previa-ficha-tamanho';

/** Mantém o tamanho entre o mínimo e o que cabe na janela (até 900 px). */
export function limitarTamanhoDaPrevia(
  t: { largura: number; altura: number },
  janela: { largura: number; altura: number } = { largura: globalThis.innerWidth ?? 1280, altura: globalThis.innerHeight ?? 800 },
): { largura: number; altura: number } {
  const maxL = Math.max(TAMANHO_MIN_PREVIA.largura, Math.min(900, janela.largura - 24));
  const maxA = Math.max(TAMANHO_MIN_PREVIA.altura, Math.min(900, janela.altura - 72));
  const ok = (v: number, d: number) => (Number.isFinite(v) ? v : d);
  return {
    largura: Math.round(Math.min(maxL, Math.max(TAMANHO_MIN_PREVIA.largura, ok(t.largura, TAMANHO_PADRAO_PREVIA.largura)))),
    altura: Math.round(Math.min(maxA, Math.max(TAMANHO_MIN_PREVIA.altura, ok(t.altura, TAMANHO_PADRAO_PREVIA.altura)))),
  };
}

function lerTamanhoSalvo(): { largura: number; altura: number } {
  try {
    const bruto = globalThis.localStorage?.getItem(CHAVE_TAMANHO_PREVIA);
    if (bruto) {
      const v = JSON.parse(bruto) as { largura?: unknown; altura?: unknown };
      if (typeof v.largura === 'number' && typeof v.altura === 'number') return limitarTamanhoDaPrevia({ largura: v.largura, altura: v.altura });
    }
  } catch { /* sem armazenamento: usa o padrão */ }
  return limitarTamanhoDaPrevia({ ...TAMANHO_PADRAO_PREVIA });
}

/** Tamanho da janela de prévia, lembrado entre sessões. */
export const tamanhoPrevia = signal<{ largura: number; altura: number }>(lerTamanhoSalvo());

export function salvarTamanhoDaPrevia(): void {
  try { globalThis.localStorage?.setItem(CHAVE_TAMANHO_PREVIA, JSON.stringify(tamanhoPrevia.peek())); } catch { /* ignora */ }
}

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
