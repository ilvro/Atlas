// Só em desenvolvimento: importado por `ponte-escrita.ts` e pelo painel, que só entram pelo módulo `ponte.ts`.
import { signal } from '@preact/signals';
import type { MapaAtlas } from '../domain/mapa.ts';
import type { Alvo } from '../render/selecao.ts';
import type { Store } from '../state/store.ts';

export const MAX_CHAMADAS = 100;
/** Quanto a ferramenta espera o mestre responder a um pedido de confirmação. */
export const ESPERA_DO_PEDIDO_MS = 5 * 60 * 1000;

type StoreDaChamada = Pick<Store, 'versaoEdicao' | 'desfazer'>;

/** Uma chamada de escrita do assistente nesta aba. */
export interface ChamadaDoAssistente {
  n: number;
  rotulo: string;
  hora: number;
  /** Ids criados ou mexidos pela chamada (destaque e enquadre no mapa). */
  ids: readonly string[];
  ok: boolean;
  erro?: string;
  /** A entrada de histórico que a chamada deixou: o store e a `versaoEdicao` logo depois dela. */
  ref?: { store: StoreDaChamada; versao: number };
}

/** Da mais nova para a mais velha. */
export const atividade = signal<readonly ChamadaDoAssistente[]>([]);
let proximo = 1;

export function registrarChamada(c: Omit<ChamadaDoAssistente, 'n' | 'hora'> & { hora?: number }): ChamadaDoAssistente {
  const item: ChamadaDoAssistente = { ...c, n: proximo++, hora: c.hora ?? Date.now() };
  atividade.value = [item, ...atividade.value].slice(0, MAX_CHAMADAS);
  return item;
}

export function limparAtividade(): void { atividade.value = []; pedidos.value = []; proximo = 1; }

/** A chamada ainda é o topo do histórico do `atual`? (Nada foi feito, desfeito nem refeito depois dela.) */
export function ehTopo(c: ChamadaDoAssistente, atual: StoreDaChamada | null | undefined): boolean {
  return !!c.ref && !!atual && c.ref.store === atual && atual.versaoEdicao === c.ref.versao;
}

/** Só a chamada mais recente, bem-sucedida e ainda no topo, pode ser desfeita daqui. */
export function podeDesfazerChamada(c: ChamadaDoAssistente, atual: StoreDaChamada | null | undefined): boolean {
  return atividade.peek()[0] === c && c.ok && ehTopo(c, atual);
}

export function desfazerChamada(c: ChamadaDoAssistente, atual: StoreDaChamada | null | undefined): boolean {
  if (!podeDesfazerChamada(c, atual)) return false;
  atual!.desfazer();
  return true;
}

/** Os alvos do mapa (cômodos, objetos, luzes…) que correspondem aos ids; ids que não existem (mais) são ignorados. */
export function alvosDosIds(mapa: MapaAtlas, ids: readonly string[]): Alvo[] {
  const colecoes = ['rooms', 'walls', 'openings', 'props', 'lights', 'tokens', 'regions', 'presence'] as const;
  const alvos: Alvo[] = [];
  for (const id of ids) {
    const colecao = colecoes.find(k => (mapa[k] as Record<string, unknown>)[id]);
    if (colecao) alvos.push({ colecao, id });
  }
  return alvos;
}

// ---------- Pedidos de confirmação ----------
export type RespostaDoMestre = 'permitir' | 'recusar' | 'sem-resposta';
export interface Pedido { id: number; descricao: string; responder(r: 'permitir' | 'recusar'): void }

/** Pedidos esperando o mestre; o selo mostra quantos são. */
export const pedidos = signal<readonly Pedido[]>([]);
let proximoPedido = 1;

/** Põe um pedido no painel e espera Permitir/Recusar (ou o tempo acabar). */
export function pedirConfirmacao(descricao: string, esperaMs = ESPERA_DO_PEDIDO_MS): Promise<RespostaDoMestre> {
  return new Promise(resolver => {
    const id = proximoPedido++;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fim = (r: RespostaDoMestre) => { clearTimeout(timer); pedidos.value = pedidos.value.filter(p => p.id !== id); resolver(r); };
    timer = setTimeout(() => fim('sem-resposta'), esperaMs);
    pedidos.value = [...pedidos.value, { id, descricao, responder: r => fim(r) }];
  });
}
