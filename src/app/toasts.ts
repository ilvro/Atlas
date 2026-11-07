import { signal } from '@preact/signals';

export interface Toast {
  id: number; texto: string; tipo: 'info' | 'erro';
  acao?: { rotulo: string; fazer: () => void };
  /** Instante (ms) em que some, ou `null` enquanto o mouse está em cima. */
  fimEm: number | null; duracao: number;
}

export const toasts = signal<Toast[]>([]);
let contador = 0;
const relogios = new Map<number, ReturnType<typeof setTimeout>>();
const MAXIMO = 4;

export function fecharToast(id: number): void {
  const r = relogios.get(id); if (r) { clearTimeout(r); relogios.delete(id); }
  toasts.value = toasts.value.filter(t => t.id !== id);
}

function agendar(id: number, ms: number): void {
  const antigo = relogios.get(id); if (antigo) clearTimeout(antigo);
  const timer = setTimeout(() => fecharToast(id), ms);
  if (typeof timer.unref === 'function') timer.unref();
  relogios.set(id, timer);
}

/** Mensagem curta. Com `acao` (ex.: Desfazer), fica mais tempo na tela. */
export function avisar(texto: string, opcoes: { acao?: Toast['acao']; tipo?: Toast['tipo']; duracao?: number } = {}): number {
  const id = ++contador, duracao = opcoes.duracao ?? (opcoes.acao ? 6000 : opcoes.tipo === 'erro' ? 5000 : 2600);
  const toast: Toast = { id, texto, tipo: opcoes.tipo ?? 'info', fimEm: Date.now() + duracao, duracao, ...(opcoes.acao ? { acao: opcoes.acao } : {}) };
  const lista = [...toasts.value, toast];
  while (lista.length > MAXIMO) fecharToast(lista.shift()!.id);
  toasts.value = lista;
  agendar(id, duracao);
  return id;
}

/** Com o mouse em cima, o toast não some. */
export function pausarToast(id: number): void {
  const r = relogios.get(id); if (r) { clearTimeout(r); relogios.delete(id); }
  toasts.value = toasts.value.map(t => t.id === id ? { ...t, fimEm: null } : t);
}
export function retomarToast(id: number): void {
  const t = toasts.value.find(x => x.id === id); if (!t) return;
  toasts.value = toasts.value.map(x => x.id === id ? { ...x, fimEm: Date.now() + 1800 } : x);
  agendar(id, 1800);
}
