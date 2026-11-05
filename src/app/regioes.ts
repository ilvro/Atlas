import { criarRef, type Ref } from '#mesa';
import { regioesEntradas, regioesOcupadas } from '../domain/regioes.ts';
import type { MapaAtlas } from '../domain/mapa.ts';
import { cenaDaRegiao, cenaDeFundo } from './audio-do-clima.ts';
import type { SessaoDeEdicao } from './sessao.ts';

/** O que reagir a um movimento precisa de fora: emitir o fato, pedir a cena e avisar o mestre. Injetado para testar sem barramento. */
export interface SaidasDeRegiao { emitir(tipo: string, dados: unknown): void; pedirCena(ref: Ref | null): void; avisar(texto: string): void }

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
  for (const { regiao, peca } of regioesEntradas(antes, depois)) {
    const r = depois.regions[regiao]!, nome = nomeDaRegiao(r), quem = depois.tokens[peca]?.name;
    // `nome` e `peca` são acréscimos opcionais ao fato (o catálogo só exige `mapa` e `regiao`): é o que o registro da sessão da Mesa mostra.
    saidas.emitir('atlas.regiao-entrou', { mapa: criarRef('atlas', 'mapa', depois.id), regiao: criarRef('atlas', 'regiao', `${depois.id}/${regiao}`), nome, ...(quem ? { peca: quem } : {}) });
    if (r.kind === 'audio') cena = cenaDaRegiao(r) ?? cena;
    if (r.kind === 'trigger') { const t = textoDoGatilho(r.payload); if (t) saidas.avisar(t); }
  }
  if (cena) { saidas.pedirCena(cena); return; }
  if (regioesOcupadas(antes, 'audio').length && !regioesOcupadas(depois, 'audio').length) saidas.pedirCena(cenaDeFundo(depois));
}

/** Acompanha o movimento das peças na sessão aberta. Só vale com o modo Sessão ligado. Devolve o cancelamento. */
export function iniciarRegioes(s: SessaoDeEdicao, emSessao: () => boolean, saidas: SaidasDeRegiao): () => void {
  let anterior = s.store.documento;
  return s.store.assinar(e => {
    const antes = anterior; anterior = e.documento;
    if (!emSessao() || (e.tipo !== 'executar' && e.tipo !== 'refazer') || !e.mudancas.colecoes.tokens) return;
    try { reagirAoMovimento(antes, e.documento, saidas); } catch (erro) { console.warn('Atlas: não consegui reagir ao movimento', erro); }
  });
}
