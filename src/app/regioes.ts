import { criarRef, type Ref } from '#mesa';
import { signal } from '@preact/signals';
import { regiaoOcupada, regioesEntradas, regioesOcupadas } from '../domain/regioes.ts';
import { EVENTOS_DE_CENA, type EventoDeCena } from '../render/eventos-de-cena.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { cenaDaRegiao, cenaDeFundo } from './audio-do-clima.ts';
import type { Store } from '../state/store.ts';

/** Quando um gatilho dispara: quando o grupo entra (padrão), só uma vez até o mestre rearmar, ou a cada jogador que entra. */
export type ModoDeDisparo = 'uma-vez' | 'ao-ocupar' | 'cada-jogador';
export function modoDeDisparo(payload: Record<string, unknown>): ModoDeDisparo {
  const d = payload.disparo; return d === 'uma-vez' || d === 'cada-jogador' ? d : 'ao-ocupar';
}

const CHAVE_DISPARADOS = 'atlas:gatilhos-disparados';
function lerDisparados(): Record<string, string[]> {
  try {
    const bruto = typeof localStorage !== 'undefined' ? localStorage.getItem(CHAVE_DISPARADOS) : null;
    const d = bruto ? JSON.parse(bruto) as unknown : null;
    if (!d || typeof d !== 'object') return {};
    const r: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(d)) if (Array.isArray(v)) r[k] = v.filter((x): x is string => typeof x === 'string');
    return r;
  } catch { return {}; }
}
/** Gatilhos 'uma-vez' que já dispararam, por id de mapa. Vive no app (não no documento) para não sujar o histórico; fica no localStorage. */
export const gatilhosDisparados = signal<Record<string, string[]>>(lerDisparados());
function gravarDisparados(v: Record<string, string[]>): void {
  gatilhosDisparados.value = v;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(CHAVE_DISPARADOS, JSON.stringify(v)); } catch { /* ignora quota */ }
}
export function gatilhoJaDisparou(mapaId: string, regiaoId: string): boolean { return !!gatilhosDisparados.peek()[mapaId]?.includes(regiaoId); }
export function marcarGatilhoDisparado(mapaId: string, regiaoId: string): void {
  if (gatilhoJaDisparou(mapaId, regiaoId)) return;
  const atual = gatilhosDisparados.peek(); gravarDisparados({ ...atual, [mapaId]: [...(atual[mapaId] ?? []), regiaoId] });
}
export function rearmarGatilho(mapaId: string, regiaoId: string): void {
  const atual = gatilhosDisparados.peek(), lista = atual[mapaId]; if (!lista?.includes(regiaoId)) return;
  gravarDisparados({ ...atual, [mapaId]: lista.filter(x => x !== regiaoId) });
}

/** O que reagir a um movimento precisa de fora: emitir o fato, pedir a cena e avisar o mestre. Injetado para testar sem barramento. */
export interface SaidasDeRegiao {
  emitir(tipo: string, dados: unknown): void;
  pedirCena(ref: Ref | null): void;
  avisar(texto: string): void;
  trocarClima?(climaId: string): void;
  dispararEfeito?(efeito: 'relampago' | EventoDeCena): void;
  tocarMomento?(id: string): void;
  /** Só para o modo 'uma-vez': já disparou (e o mestre não rearmou)? */
  jaDisparou?(regiaoId: string): boolean;
  marcarDisparo?(regiaoId: string): void;
}

/** O nome de uma região para quem lê o registro: o que o mestre deu a ela (`nome` no payload), senão o tipo. */
export function nomeDaRegiao(r: Pick<MapaAtlas['regions'][string], 'kind' | 'payload'>): string {
  const n = r.payload.nome ?? r.payload.name;
  if (typeof n === 'string' && n.trim()) return n.trim();
  return { reveal: 'Região de revelação', trigger: 'Região de gatilho', note: 'Região de nota', audio: 'Região de áudio' }[r.kind];
}

/** O texto de um gatilho (o que o mestre escreveu na região), ou `null`. */
export function textoDoGatilho(payload: Record<string, unknown>): string | null {
  const t = payload.texto ?? payload.text; return typeof t === 'string' && t.trim() ? t.trim() : null;
}

/**
 * Depois de uma peça andar na sessão: avisa as regiões em que uma peça de jogador entrou (`atlas.regiao-entrou`); a de áudio pede a sua cena, a de
 * gatilho mostra o texto ao mestre; e se a última peça saiu de todas as regiões de áudio, volta a cena do clima (ou do mapa).
 */
export function reagirAoMovimento(antes: MapaAtlas, depois: MapaAtlas, saidas: SaidasDeRegiao): void {
  let cena: Ref | null = null;
  const disparados = new Set<string>(); // cada gatilho dispara as ações no máximo uma vez por movimento
  const momentos: string[] = [];
  for (const { regiao, peca } of regioesEntradas(antes, depois)) {
    const r = depois.regions[regiao]!, nome = nomeDaRegiao(r), quem = depois.tokens[peca]?.name;
    // `nome` e `peca` são acréscimos opcionais ao fato (o catálogo só exige `mapa` e `regiao`): é o que o registro da sessão da Mesa mostra.
    saidas.emitir('atlas.regiao-entrou', { mapa: criarRef('atlas', 'mapa', depois.id), regiao: criarRef('atlas', 'regiao', `${depois.id}/${regiao}`), nome, ...(quem ? { peca: quem } : {}) });
    if (r.kind === 'audio') cena = cenaDaRegiao(r) ?? cena;
    if (r.kind === 'trigger' && !disparados.has(regiao)) {
      const modo = modoDeDisparo(r.payload);
      if (modo !== 'cada-jogador' && regiaoOcupada(antes, regiao)) continue; // o grupo já estava lá
      if (modo === 'uma-vez' && saidas.jaDisparou?.(regiao)) continue;
      disparados.add(regiao); if (modo === 'uma-vez') saidas.marcarDisparo?.(regiao);
      const t = textoDoGatilho(r.payload);
      if (t) saidas.avisar(t);
      const climaId = typeof r.payload.clima === 'string' && r.payload.clima ? r.payload.clima : null;
      if (climaId && saidas.trocarClima) saidas.trocarClima(climaId);
      const efeito = r.payload.efeito;
      if ((efeito === 'relampago' || (EVENTOS_DE_CENA as readonly unknown[]).includes(efeito)) && saidas.dispararEfeito) saidas.dispararEfeito(efeito as 'relampago' | EventoDeCena);
      const cJukebox = r.refs?.find(x => x.app === 'jukebox') ?? null;
      if (cJukebox) cena = cJukebox;
      const momentoId = typeof r.payload.momento === 'string' && r.payload.momento.trim() ? r.payload.momento.trim() : null;
      if (momentoId && (!depois.moments || depois.moments[momentoId])) {
        momentos.push(momentoId);
      }
    }
  }
  if (cena) {
    saidas.pedirCena(cena);
  } else if (regioesOcupadas(antes, 'audio').length && !regioesOcupadas(depois, 'audio').length) {
    saidas.pedirCena(cenaDeFundo(depois));
  }
  for (const mId of momentos) {
    saidas.tocarMomento?.(mId);
  }
}

/**
 * Acompanha o movimento das peças na sessão aberta. Só vale com o modo Sessão ligado. Devolve o cancelamento.
 * Reage a `executar` e a `concluir` (fim de um gesto ou transação, como as setas); `refazer` não dispara de novo.
 * `anterior` é o documento do último evento que não foi passo de gesto, para o `concluir` comparar com o estado de antes do gesto.
 */
export function iniciarRegioes(s: { store: Pick<Store, 'documento' | 'assinar'> }, emSessao: () => boolean, saidas: SaidasDeRegiao): () => void {
  let anterior = s.store.documento;
  return s.store.assinar(e => {
    if (e.tipo === 'gesto') return;
    const antes = anterior; anterior = e.documento;
    if (!emSessao() || (e.tipo !== 'executar' && e.tipo !== 'concluir') || !e.mudancas.colecoes.tokens) return;
    try { reagirAoMovimento(antes, e.documento, saidas); } catch (erro) { console.warn('Atlas: não consegui reagir ao movimento', erro); }
  });
}
