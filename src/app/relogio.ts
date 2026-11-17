import { signal } from '@preact/signals';

/** Estado em memória do cronômetro da sessão (não grava no histórico de undo da Store). */
export const estadoCronometro = signal<{ segundos: number; rodando: boolean }>({
  segundos: 0,
  rodando: false,
});
