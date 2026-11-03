import type { MapaAtlas } from '../domain/mapa.ts';
import { novoIdEntidade } from '../domain/fabrica.ts';
import { aplicarComando, type Comando } from '../state/comandos.ts';
import type { Store } from '../state/store.ts';

/**
 * Uma sugestão do assistente: comandos comuns, que se veem antes (prévia) e se aceitam como UMA ação.
 * `versaoEsperada` é a `versaoEdicao` do store quando foi gerada: se o mapa mudou desde então, aceitar é recusado.
 */
export interface Proposta { id: string; tipo: string; rotulo: string; comandos: Comando[]; versaoEsperada: number; roomId: string | null; semente: number }

export const novaProposta = (dados: Omit<Proposta, 'id'>): Proposta => ({ id: novoIdEntidade('s'), ...dados });

const comoComando = (p: Proposta): Comando => ({ tipo: 'proposta.aceitar', rotulo: p.rotulo, comandos: p.comandos });

/** O mapa como ficaria se a proposta fosse aceita (sem tocar em nada). Lança `ErroDeComando` se ela não cabe mais. */
export const previaDaProposta = (m: MapaAtlas, p: Proposta): MapaAtlas => aplicarComando(m, comoComando(p));

/** Aceita: uma entrada de histórico com o rótulo da proposta. Lança se o mapa mudou desde que ela foi gerada ou se algo não cabe. */
export const aceitarProposta = (store: Store, p: Proposta): MapaAtlas => store.executar(comoComando(p), { rotulo: p.rotulo, versaoEsperada: p.versaoEsperada });
