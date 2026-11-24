import type { Ponto } from './mapa.ts';

export const DURACAO_PING_MS = 3000;

export interface Ping {
  id: string;
  mapa: string;
  ponto: Ponto;
  levelId: string | null;
  discordId: string;
  nome: string;
  papel: 'mestre' | 'jogador';
  em: number;
}

const COR_MESTRE = '#f59e0b';
const PALETA_JOGADORES = [
  '#38bdf8',
  '#34d399',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#a3e635',
  '#f472b6',
  '#60a5fa',
] as const;

/** Cor estável por `discordId` (com a do mestre fixa). */
export function corDoPing(discordId: string, papel: 'mestre' | 'jogador'): string {
  if (papel === 'mestre') return COR_MESTRE;
  let h = 2166136261;
  for (let i = 0; i < discordId.length; i++) {
    h ^= discordId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return PALETA_JOGADORES[(h >>> 0) % PALETA_JOGADORES.length]!;
}

/** Pings ainda dentro da janela de 3 s. */
export function pingsAtivos(pings: readonly Ping[], agora: number, duracaoMs = DURACAO_PING_MS): Ping[] {
  return pings.filter(p => agora - p.em >= 0 && agora - p.em < duracaoMs);
}

export interface SetaNaBorda {
  x: number;
  y: number;
  angulo: number;
}

/**
 * Se `pontoTela` estiver fora da caixa `[0, largura] x [0, altura]`, devolve a posição
 * na borda (com `margem` px) e o ângulo (rad) apontando para o ponto; senão `null`.
 */
export function setaNaBorda(
  pontoTela: Ponto,
  largura: number,
  altura: number,
  margem = 24,
): SetaNaBorda | null {
  const [px, py] = pontoTela;
  if (px >= 0 && px <= largura && py >= 0 && py <= altura) return null;
  const cx = largura / 2;
  const cy = altura / 2;
  const dx = px - cx;
  const dy = py - cy;
  const angulo = Math.atan2(dy, dx);
  const meiaLarg = Math.max(1, cx - margem);
  const meiaAlt = Math.max(1, cy - margem);
  const tx = Math.abs(dx) > 1e-6 ? meiaLarg / Math.abs(dx) : Infinity;
  const ty = Math.abs(dy) > 1e-6 ? meiaAlt / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  return {
    x: cx + dx * t,
    y: cy + dy * t,
    angulo,
  };
}
