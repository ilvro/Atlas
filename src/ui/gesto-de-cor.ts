import { useEffect } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { SessaoDeEdicao } from '../app/sessao.ts';
import type { Gesto } from '../state/store.ts';
import { tentar } from './campos.tsx';

/** O gesto de prévia de uma cor: arrastar o seletor é UM item de histórico (`confirmar` conclui, e a prévia some do histórico se nada mudou). */
export function useGestoDeCor(s: SessaoDeEdicao, rotulo: string) {
  const gesto = useSignal<Gesto | null>(null);
  const cancelar = () => { gesto.value?.cancelar(); gesto.value = null; };
  useEffect(() => () => { cancelar(); }, [s]);
  return {
    previa: (aplicar: (g: Gesto) => void) => { if (!gesto.value) { if (s.store.emGesto) return; gesto.value = s.store.iniciarGesto(rotulo); } tentar(() => aplicar(gesto.value!)); },
    confirmar: () => { try { gesto.value?.concluir(); } finally { gesto.value = null; } },
    cancelar,
  };
}
