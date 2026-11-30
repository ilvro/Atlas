import { corDoPing } from './pings.ts';

/** Tempo após o qual um cursor remoto parado desaparece (5 s). */
export const EXPIRACAO_CURSOR_MS = 5000;

/** Intervalo mínimo entre envios de posição de cursor (~15/s). */
export const INTERVALO_ENVIO_CURSOR_MS = 67;

export interface CursorRemoto {
  discordId: string;
  nome: string;
  cor: string;
  x: number;
  y: number;
  levelId: string | null;
  ferramenta: string;
  pintando: boolean;
  atualizadoEm: number;
}

export interface EntradaCursorRemoto {
  discordId: string;
  nome: string;
  papel?: 'mestre' | 'jogador';
  cor?: string;
  x: number;
  y: number;
  levelId: string | null;
  ferramenta: string;
  pintando?: boolean;
  atualizadoEm: number;
}

/**
 * Substitui ou insere o cursor de `entrada.discordId` na lista e remove cursores já expirados
 * em relação a `agora` (padrão: `entrada.atualizadoEm`).
 */
export function registrarCursorRemoto(
  lista: readonly CursorRemoto[],
  entrada: EntradaCursorRemoto,
  agora = entrada.atualizadoEm,
): CursorRemoto[] {
  const proximo: CursorRemoto = {
    discordId: entrada.discordId,
    nome: entrada.nome,
    cor: entrada.cor ?? corDoPing(entrada.discordId, entrada.papel ?? 'jogador'),
    x: entrada.x,
    y: entrada.y,
    levelId: entrada.levelId,
    ferramenta: entrada.ferramenta,
    pintando: Boolean(entrada.pintando),
    atualizadoEm: entrada.atualizadoEm,
  };
  const filtrados = lista.filter(
    c => c.discordId !== entrada.discordId && agora - c.atualizadoEm >= 0 && agora - c.atualizadoEm < EXPIRACAO_CURSOR_MS,
  );
  return [...filtrados, proximo];
}

/**
 * Filtra cursores ainda ativos (não expirados), opcionalmente restringindo ao mesmo `levelId`
 * e ignorando o próprio `meuDiscordId`.
 */
export function cursoresAtivos(
  lista: readonly CursorRemoto[],
  agora: number,
  opcoes?: { levelId?: string | null; meuDiscordId?: string | null; expiracaoMs?: number },
): CursorRemoto[] {
  const expiracaoMs = opcoes?.expiracaoMs ?? EXPIRACAO_CURSOR_MS;
  const meuId = opcoes?.meuDiscordId ?? null;
  const filtrarAndar = opcoes?.levelId !== undefined;
  const andarAlvo = opcoes?.levelId ?? null;
  return lista.filter(c => {
    if (agora - c.atualizadoEm < 0 || agora - c.atualizadoEm >= expiracaoMs) return false;
    if (meuId !== null && c.discordId === meuId) return false;
    if (filtrarAndar && c.levelId !== andarAlvo) return false;
    return true;
  });
}

/**
 * Throttle de envio de cursor: dispara imediatamente quando `pintando` muda de estado;
 * caso contrário respeita o intervalo mínimo (`INTERVALO_ENVIO_CURSOR_MS`).
 */
export function deveEnviarCursor(
  ultimoEnvioEm: number,
  agora: number,
  pintandoAntes: boolean,
  pintandoAgora: boolean,
  intervaloMs = INTERVALO_ENVIO_CURSOR_MS,
): boolean {
  if (pintandoAntes !== pintandoAgora) return true;
  return agora - ultimoEnvioEm >= intervaloMs;
}
