import { signal } from '@preact/signals';
import { aplicarTema, gravarTema, lerTema, observarTema, type Tema } from '#mesa';

/** O tema vem do localStorage compartilhado da mesa (`mesa:tema`); trocar aqui troca em todas as abas e aplicativos abertos. */
const storageVazio: Pick<Storage, 'getItem' | 'setItem'> = { getItem: () => null, setItem: () => {} };
function obterStorageLocal(): Pick<Storage, 'getItem' | 'setItem'> {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : storageVazio;
  } catch {
    return storageVazio;
  }
}
const storageLocal = obterStorageLocal();
export const tema = signal<Tema>(lerTema(storageLocal));

export function iniciarTema(): () => void {
  aplicarTema(document.documentElement, tema.value);
  try {
    return observarTema(window, storageLocal, novo => { tema.value = novo; aplicarTema(document.documentElement, novo); });
  } catch {
    return () => {};
  }
}

export function trocarTema(novo: Tema): void {
  try {
    gravarTema(storageLocal, novo);
  } catch { /* ignora erro de armazenamento */ }
  tema.value = novo;
  aplicarTema(document.documentElement, novo);
}
