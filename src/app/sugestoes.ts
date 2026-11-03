import { effect, signal } from '@preact/signals';
import { aceitarProposta, previaDaProposta, type Proposta } from '../authoring/proposta.ts';
import { chaveDeDispensa, outraDoMesmoTipo, proximaSugestao, type Contexto } from '../authoring/sugestoes.ts';
import { tocar } from '../fx/som.ts';
import type { Viewport } from '../render/viewport.ts';
import type { EventoStore } from '../state/store.ts';
import type { SessaoDeEdicao } from './sessao.ts';
import { avisar } from './toasts.ts';

/** A sugestão que está na pílula agora (uma por vez, no cômodo em foco). */
export const sugestao = signal<Proposta | null>(null);

const CHAVE = 'atlas:sugestoes';
let inicial = true; try { inicial = localStorage.getItem(CHAVE) !== '0'; } catch { /* padrão ligado */ }
/** Preferência local, como o "Ver atmosfera no editor": não vai para o mapa. */
export const sugestoesLigadas = signal(inicial);
export function definirSugestoesLigadas(v: boolean): void {
  sugestoesLigadas.value = v; try { localStorage.setItem(CHAVE, v ? '1' : '0'); } catch { /* ignora */ }
  if (!v) sugestao.value = null; else recalcularAgora?.();
}

/** O cômodo a que a pílula se refere (para a interface posicioná-la). */
export const comodoEmFoco = signal<string | null>(null);

let atual: SessaoDeEdicao | null = null, recalcularAgora: (() => void) | null = null;
const dispensadas = new Set<string>();
const sementes = new Map<string, number>();
const EVENTOS = new Set(['executar', 'concluir', 'desfazer', 'refazer']);
const ATRASO = 300;

const contexto = (s: SessaoDeEdicao, semente = 0): Contexto => ({ m: s.store.documento, versao: s.store.versaoEdicao, semente });

/**
 * Liga o assistente a uma sessão: 300 ms depois de uma edição (nunca durante um gesto) olha o cômodo em foco e, se houver
 * uma sugestão, a mostra na pílula e como fantasma no mapa. Devolve a função que desliga tudo (ao fechar o mapa).
 */
export function iniciarSugestoes(s: SessaoDeEdicao, viewport: { atual: Viewport | null }): () => void {
  atual = s; dispensadas.clear(); sementes.clear(); sugestao.value = null; comodoEmFoco.value = null;
  let relogio: ReturnType<typeof setTimeout> | undefined, ultimoCriado: string | null = null, vivo = true;

  const existe = (id: string | null): id is string => !!id && !!s.store.documento.rooms[id];
  function escolherFoco(): string | null {
    const alvos = s.selecao.peek(), salas = alvos.filter(a => a.colecao === 'rooms');
    if (alvos.length === 1 && salas.length === 1 && existe(salas[0]!.id)) return salas[0]!.id;
    if (existe(ultimoCriado)) return ultimoCriado;
    return existe(comodoEmFoco.peek()) ? comodoEmFoco.peek() : null;
  }
  function recalcular(): void {
    if (!vivo) return;
    if (!sugestoesLigadas.peek() || s.store.emGesto) { sugestao.value = null; return; }
    const foco = escolherFoco(); comodoEmFoco.value = foco;
    if (!foco) { sugestao.value = null; return; }
    const p = proximaSugestao(contexto(s, sementes.get(foco) ?? 0), foco, dispensadas);
    // Gerar de novo dá ids novos: se nada mudou (mesmo tipo, cômodo, semente e versão do mapa), a pílula na tela fica como está.
    const atual = sugestao.peek();
    if (p && atual && p.tipo === atual.tipo && p.roomId === atual.roomId && p.semente === atual.semente && p.versaoEsperada === atual.versaoEsperada) return;
    if (!p && !atual) return;
    sugestao.value = p;
  }
  const agendar = () => { clearTimeout(relogio); relogio = setTimeout(recalcular, ATRASO); };
  recalcularAgora = () => { clearTimeout(relogio); recalcular(); };

  const sairStore = s.store.assinar((e: EventoStore) => {
    if (!EVENTOS.has(e.tipo)) return;
    const salas = e.mudancas.colecoes.rooms?.filter(id => !!e.documento.rooms[id]);
    if (salas?.length) ultimoCriado = salas.at(-1)!;
    // Qualquer edição torna velha a sugestão que estava na tela (a versão esperada mudou).
    if (sugestao.peek() && sugestao.peek()!.versaoEsperada !== e.versaoEdicao) sugestao.value = null;
    agendar();
  });
  const sairSelecao = effect(() => { s.selecao.value; agendar(); });
  // O fantasma acompanha a sugestão; se a prévia não cabe mais, a sugestão some.
  const sairFantasma = effect(() => {
    const p = sugestao.value, v = viewport.atual; if (!v) return;
    if (!p) { v.mostrarProposta(null); return; }
    try { v.mostrarProposta(previaDaProposta(s.store.documento, p)); } catch { sugestao.value = null; }
  });
  return () => {
    vivo = false; clearTimeout(relogio); sairStore(); sairSelecao(); sairFantasma();
    viewport.atual?.mostrarProposta(null); sugestao.value = null; comodoEmFoco.value = null;
    if (atual === s) { atual = null; recalcularAgora = null; }
  };
}

/** Aceita a sugestão da pílula: uma entrada de histórico, com Desfazer à mão. */
export function aceitarSugestao(): void {
  const s = atual, p = sugestao.peek(); if (!s || !p) return;
  try { aceitarProposta(s.store, p); } catch (erro) { avisar(String(erro instanceof Error ? erro.message : erro), { tipo: 'erro' }); tocar('erro'); sugestao.value = null; recalcularAgora?.(); return; }
  tocar('pop'); sugestao.value = null;
  avisar(`Sugestão aceita: ${p.rotulo}`, { acao: { rotulo: 'Desfazer', fazer: () => { if (atual === s && s.store.podeDesfazer) s.store.desfazer(); } } });
}

/** Outra sugestão do mesmo tipo (a semente seguinte). */
export function outraSugestao(): void {
  const s = atual, p = sugestao.peek(); if (!s || !p?.roomId) return;
  const nova = outraDoMesmoTipo(contexto(s), p); if (!nova) return;
  sementes.set(p.roomId, nova.semente); sugestao.value = nova;
}

/** "Agora não": este tipo de sugestão não volta para este cômodo até fechar o mapa. */
export function dispensarSugestao(): void {
  const p = sugestao.peek(); if (!p?.roomId) return;
  dispensadas.add(chaveDeDispensa(p.tipo, p.roomId)); sugestao.value = null; recalcularAgora?.();
}
