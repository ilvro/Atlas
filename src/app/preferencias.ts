import { signal } from '@preact/signals';

const CHAVE_OBJETOS_NA_GRADE = 'atlas:objetos-na-grade';

function lerBool(chave: string, padrao: boolean): boolean {
  try {
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(chave) : null;
    return v === null ? padrao : v === '1';
  } catch { return padrao; }
}

/** Objetos e luzes encaixam na grade por padrão? Falso: ficam onde o cursor está e `Alt` encaixa. Fica no navegador, nunca no mapa. */
export const objetosNaGrade = signal<boolean>(lerBool(CHAVE_OBJETOS_NA_GRADE, false));

export function definirObjetosNaGrade(v: boolean): void {
  objetosNaGrade.value = v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_OBJETOS_NA_GRADE, v ? '1' : '0'); } catch { /* só some ao recarregar */ }
}

/** Painel de propriedades do objeto: o bloco "Ver mais…" está aberto? Preferência do editor, no navegador. */
export const propriedadesAbertas = signal<boolean>(lerBool('atlas.propriedadesAbertas', false));
export function definirPropriedadesAbertas(v: boolean): void {
  propriedadesAbertas.value = v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('atlas.propriedadesAbertas', v ? '1' : '0'); } catch { /* só some ao recarregar */ }
}

/** Recentes e Favoritos da biblioteca estão abertos? Recolhidos por padrão. */
export const recentesAbertos = signal<boolean>(lerBool('atlas.recentesAbertos', false));
export function definirRecentesAbertos(v: boolean): void {
  recentesAbertos.value = v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('atlas.recentesAbertos', v ? '1' : '0'); } catch { /* só some ao recarregar */ }
}

/** Avisar com toast quando um jogador move a própria peça online (R15). Ligado por padrão. */
export const avisarMovimentoDeJogador = signal<boolean>(lerBool('atlas:avisar-movimento-jogador', true));
export function definirAvisarMovimentoDeJogador(v: boolean): void {
  avisarMovimentoDeJogador.value = v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem('atlas:avisar-movimento-jogador', v ? '1' : '0'); } catch { /* só some ao recarregar */ }
}

export const CHAVE_INSPETOR_ABERTO = 'atlas.inspetorAberto';

/** Resolve o estado inicial do inspetor a partir do valor salvo e da largura do viewport. */
export function inspetorAbertoInicial(salvo: string | null, larguraViewport?: number): boolean {
  if (salvo !== null) return salvo === '1';
  if (larguraViewport !== undefined && larguraViewport <= 960) return false;
  return true;
}

function lerInspetorInicial(): boolean {
  try {
    const salvo = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE_INSPETOR_ABERTO) : null;
    const largura = typeof window !== 'undefined' ? window.innerWidth : undefined;
    return inspetorAbertoInicial(salvo, largura);
  } catch {
    return true;
  }
}

/** O inspetor lateral (Mapa / Seleção / Histórico) está aberto? */
export const inspetorAberto = signal<boolean>(lerInspetorInicial());
export function definirInspetorAberto(v: boolean): void {
  inspetorAberto.value = v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_INSPETOR_ABERTO, v ? '1' : '0'); } catch { /* só some ao recarregar */ }
}
