import { effect } from '@preact/signals';
import type { Barramento, Ref } from '#mesa';
import { mapaDoAndar } from '../domain/andares.ts';
import type { Recursos } from '../domain/fichas.ts';
import type { MapaAtlas, Peca } from '../domain/mapa.ts';
import { caixaDaSelecao } from '../render/selecao.ts';
import { servicos, sessao, viewport } from './app.ts';
import { focarTurnoAtualDaIniciativa } from './projetor.ts';
import { ajustarRecursosDaPeca, recursosDaPeca, recursosDasFichas, type AjusteRecursoPatch } from './fichas.ts';
import { definirControleJogadores, definirMovimentoLivre } from './modo.ts';
import type { SessaoDeEdicao } from './sessao.ts';

export const CANAL_COMBATE = 'atlas:combate';

export interface CombatenteDoAtlas {
  tokenId: string;
  nome: string;
  jogador: boolean;
  estado: string;
  refs: Ref[];
  pv?: number;
  pvMax?: number;
  pd?: number;
  pdMax?: number;
}

export interface EstadoDeIniciativaAtlas {
  tipo: 'iniciativa';
  mapaId: string;
  mapaNome: string;
  ativa: boolean;
  rodada: number;
  atual: number;
  ordem: { tokenId: string; valor: number }[];
  combatentes: CombatenteDoAtlas[];
}

export type ComandoDeIniciativaMesa =
  | { tipo: 'estado' }
  | { tipo: 'iniciar'; entradas?: { tokenId: string; valor: number }[] }
  | { tipo: 'passo'; direcao: 1 | -1 }
  | { tipo: 'definir-valor'; tokenId: string; valor: number }
  | { tipo: 'focar-peca'; tokenId: string }
  | { tipo: 'ajustar-pv'; tokenId: string; deltaPv?: number; pv?: number; deltaPd?: number; pd?: number }
  | { tipo: 'encerrar' };

export interface CanalCombateLike {
  postMessage(msg: unknown): void;
  onmessage: ((ev: { data: unknown }) => void) | null;
  close(): void;
}

/** Monta o snapshot puro de iniciativa e combatentes do andar ativo do mapa. */
export function montarEstadoDeIniciativa(
  m: MapaAtlas,
  andar: string | null,
  lerRecursos: (t: Peca) => Recursos | null,
): EstadoDeIniciativaAtlas {
  const escopo = mapaDoAndar(m, andar);
  const combatentes: CombatenteDoAtlas[] = Object.values(escopo.tokens).map(t => {
    const rec = lerRecursos(t);
    const item: CombatenteDoAtlas = {
      tokenId: t.id,
      nome: t.name,
      jogador: t.player,
      estado: t.figure.state,
      refs: t.refs,
    };
    if (rec) {
      item.pv = rec.pv;
      item.pvMax = rec.pvMax;
      item.pd = rec.pd;
      item.pdMax = rec.pdMax;
    }
    return item;
  });

  const ini = escopo.session.initiative;
  if (ini) {
    return {
      tipo: 'iniciativa',
      mapaId: m.id,
      mapaNome: m.name,
      ativa: true,
      rodada: ini.round,
      atual: ini.current,
      ordem: ini.order.map(e => ({ tokenId: e.tokenId, valor: e.value })),
      combatentes,
    };
  }

  return {
    tipo: 'iniciativa',
    mapaId: m.id,
    mapaNome: m.name,
    ativa: false,
    rodada: 1,
    atual: 0,
    ordem: [],
    combatentes,
  };
}

export interface DepsComandoDeIniciativa {
  sessao: SessaoDeEdicao;
  barramento?: Pick<Barramento, 'pedir'> | null;
  focarPeca?: (id: string) => void;
}

/** Executa um comando de iniciativa/combate vindo da Mesa sobre a sessão aberta no Atlas. */
export function executarComandoDeIniciativa(
  cmd: ComandoDeIniciativaMesa,
  deps: DepsComandoDeIniciativa,
): boolean {
  const { sessao: s, barramento, focarPeca } = deps;
  const doc = s.store.documento;

  switch (cmd.tipo) {
    case 'estado':
      return false;

    case 'iniciar': {
      const andar = s.andarAtivo.peek();
      const escopo = mapaDoAndar(doc, andar);
      let entradas: { tokenId: string; value: number }[];
      if (Array.isArray(cmd.entradas) && cmd.entradas.length > 0) {
        const vistos = new Set<string>();
        entradas = [];
        for (const e of cmd.entradas) {
          if (!e || typeof e.tokenId !== 'string' || vistos.has(e.tokenId) || !doc.tokens[e.tokenId]) continue;
          vistos.add(e.tokenId);
          entradas.push({ tokenId: e.tokenId, value: Number(e.valor) || 0 });
        }
      } else {
        entradas = Object.keys(escopo.tokens).map(tokenId => ({ tokenId, value: 0 }));
      }
      if (!entradas.length) return false;
      try {
        s.store.executar({ tipo: 'iniciativa.iniciar', entradas }, { rotulo: 'Começar a iniciativa' });
        definirControleJogadores('livres');
        definirMovimentoLivre(false);
        focarTurnoAtualDaIniciativa(s);
        return true;
      } catch {
        return false;
      }
    }

    case 'passo': {
      if (!doc.session.initiative) return false;
      try {
        s.store.executar({ tipo: 'iniciativa.passo', passo: cmd.direcao === -1 ? -1 : 1 });
        focarTurnoAtualDaIniciativa(s);
        return true;
      } catch {
        return false;
      }
    }

    case 'definir-valor': {
      if (!doc.session.initiative) return false;
      try {
        s.store.executar({ tipo: 'iniciativa.valor', tokenId: cmd.tokenId, value: Number(cmd.valor) || 0 });
        return true;
      } catch {
        return false;
      }
    }

    case 'encerrar': {
      if (!doc.session.initiative) return false;
      try {
        s.store.executar({ tipo: 'iniciativa.encerrar' });
        return true;
      } catch {
        return false;
      }
    }

    case 'focar-peca': {
      if (!doc.tokens[cmd.tokenId]) return false;
      s.selecao.value = [{ colecao: 'tokens', id: cmd.tokenId }];
      focarPeca?.(cmd.tokenId);
      return true;
    }

    case 'ajustar-pv': {
      const token = doc.tokens[cmd.tokenId];
      if (!token) return false;
      const patch: AjusteRecursoPatch = {};
      if (cmd.deltaPv !== undefined) patch.deltaPv = cmd.deltaPv;
      if (cmd.pv !== undefined) patch.pv = cmd.pv;
      if (cmd.deltaPd !== undefined) patch.deltaPd = cmd.deltaPd;
      if (cmd.pd !== undefined) patch.pd = cmd.pd;
      ajustarRecursosDaPeca(s, token, patch, barramento);
      return true;
    }

    default:
      return false;
  }
}

/**
 * Abre a ponte de combate/iniciativa no `BroadcastChannel('atlas:combate')`.
 * Publica automaticamente o estado de iniciativa quando o documento, andar ou recursos das fichas mudam,
 * e atende comandos enviados pela Mesa.
 */
export function iniciarPonteDeIniciativa(
  criarCanal?: (nome: string) => CanalCombateLike,
): () => void {
  let canal: CanalCombateLike | null = null;
  try {
    canal = criarCanal
      ? criarCanal(CANAL_COMBATE)
      : typeof BroadcastChannel !== 'undefined'
        ? (new BroadcastChannel(CANAL_COMBATE) as unknown as CanalCombateLike)
        : null;
  } catch {
    canal = null;
  }
  if (!canal) return () => {};

  const ativo = canal;
  let ultimoJson = '';

  const publicar = (s: SessaoDeEdicao, doc: MapaAtlas, andar: string | null, forcar: boolean) => {
    const estado = montarEstadoDeIniciativa(doc, andar, t => recursosDaPeca(t));
    const json = JSON.stringify(estado);
    if (!forcar && json === ultimoJson) return;
    ultimoJson = json;
    try {
      ativo.postMessage(estado);
    } catch { /* ignora erro de postMessage */ }
  };

  const pararEffect = effect(() => {
    const s = sessao.value;
    if (!s) return;
    const doc = s.doc.value;
    const andar = s.andarAtivo.value;
    void recursosDasFichas.value;
    publicar(s, doc, andar, false);
  });

  ativo.onmessage = ev => {
    const msg = ev.data as ComandoDeIniciativaMesa | null | undefined;
    if (!msg || typeof msg !== 'object' || typeof msg.tipo !== 'string') return;
    const s = sessao.peek();
    if (!s) return;
    if (msg.tipo === 'estado') {
      publicar(s, s.doc.peek(), s.andarAtivo.peek(), true);
      return;
    }
    executarComandoDeIniciativa(msg, {
      sessao: s,
      barramento: servicos.peek()?.barramento,
      focarPeca: id => {
        const caixa = caixaDaSelecao(s.store.documento, [{ colecao: 'tokens', id }]);
        if (caixa) viewport.atual?.focarEm(caixa);
      },
    });
  };

  return () => {
    pararEffect();
    try {
      ativo.onmessage = null;
      ativo.close();
    } catch { /* ignora */ }
  };
}
