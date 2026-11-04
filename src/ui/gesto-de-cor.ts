import { useSignal } from '@preact/signals';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import type { Gesto } from '../state/store.ts';
import { tentar } from './campos.tsx';

/** O gesto de prévia de uma cor: arrastar o seletor é UM item de histórico (`confirmar` conclui, e a prévia some do histórico se nada mudou). */
export function useGestoDeCor(s: SessaoDeEdicao, rotulo: string) {
  const gesto = useSignal<Gesto | null>(null);
  return {
    previa: (aplicar: (g: Gesto) => void) => { if (!gesto.value) { if (s.store.emGesto) return; gesto.value = s.store.iniciarGesto(rotulo); } tentar(() => aplicar(gesto.value!)); },
    confirmar: () => { gesto.value?.concluir(); gesto.value = null; },
  };
}
