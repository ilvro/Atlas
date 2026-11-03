import { signal } from '@preact/signals';
import type { Ferramenta } from '../render/pincel.ts';

/**
 * O modo do aplicativo: Construir (editar o mapa) ou Sessão (jogar o mapa). É estado do aplicativo, não do documento: o mapa é o mesmo, a
 * sessão só usa outras ferramentas e mostra outras coisas. Abrir outro mapa volta a Construir.
 */
export type Modo = 'construir' | 'sessao';
export const modo = signal<Modo>('construir');
export const emSessao = (): boolean => modo.value === 'sessao';

/** As ferramentas que existem na Sessão (a régua entra na 7.3b). */
export const FERRAMENTAS_DA_SESSAO: readonly Ferramenta[] = ['selecionar', 'mao'];
export const ROTULO_DO_MODO: Record<Modo, string> = { construir: 'Construir', sessao: 'Sessão' };
