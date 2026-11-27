import type { Autor, Resposta } from '#mesa';
import { andarDe } from '../domain/andares.ts';
import type { Ponto } from '../domain/mapa.ts';
import type { Store } from '../state/store.ts';

export interface DadosMoverPeca {
  mapa: string;
  peca: string;
  position: Ponto;
  levelId?: string | null;
  emArrasto?: boolean;
}

export interface ContextoMoverPeca {
  store: () => Store | null;
  movimentoLivre?: () => boolean;
  controleJogadores?: () => 'livres' | 'mestre';
  aoMover?: (info: { autor: Autor; pecaNome: string }) => void;
}

/**
 * Atende `atlas.mover-peca` vindo da sala online (R15):
 * - recusa se o controle estiver com o mestre;
 * - recusa se não houver mapa aberto ou se o mapa aberto não for o pedido;
 * - recusa se `autor` faltar;
 * - recusa se a peça não existir, não for `player`, ou nenhuma `ref` dela apontar para uma ficha em `autor.fichas`;
 * - aplica com `peca.mover` (com desfazer, encaixe na grade e colisão com paredes e portas fechadas).
 */
export function atenderMoverPeca(
  ctx: ContextoMoverPeca,
  dados: DadosMoverPeca,
  autor: Autor | undefined,
): Resposta {
  if (ctx.controleJogadores?.() === 'mestre') return { ok: false, motivo: 'O mestre está no controle.' };
  const store = ctx.store();
  if (!store) return { ok: false, motivo: 'Nenhum mapa aberto.' };
  const doc = store.documento;
  if (doc.id !== dados.mapa) return { ok: false, motivo: 'Outro mapa está aberto.' };
  if (!autor) return { ok: false, motivo: 'Autor ausente.' };

  const peca = doc.tokens[dados.peca];
  if (!peca || !peca.player) return { ok: false, motivo: 'Essa peça não pode ser movida pelo jogador.' };

  const pertence = peca.refs.some(
    r => r.app === 'ficha' && r.tipo === 'ficha' && autor.fichas.includes(r.id),
  );
  if (!pertence) return { ok: false, motivo: 'Essa peça não pertence a você.' };

  if (dados.levelId !== undefined && dados.levelId !== andarDe(peca)) {
    return { ok: false, motivo: 'A peça está em outro andar.' };
  }

  const semGrade = !doc.grid.snap || ctx.movimentoLivre?.() === true;
  try {
    store.executar(
      { tipo: 'peca.mover', id: peca.id, para: dados.position, livre: false, semGrade, ...(dados.emArrasto ? { emArrasto: true } : {}) },
      { fusao: `mover-peca-remota:${peca.id}` },
    );
  } catch (erro) {
    return { ok: false, motivo: erro instanceof Error ? erro.message : String(erro) };
  }

  if (!dados.emArrasto) ctx.aoMover?.({ autor, pecaNome: peca.name || 'peça' });
  return { ok: true };
}
