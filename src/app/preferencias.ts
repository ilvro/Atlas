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
