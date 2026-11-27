import type { MapaAtlas } from '../domain/mapa.ts';
import { aplicarComando, ErroDeComando, type Comando } from '../state/comandos.ts';
import { clonar, congelar } from '../state/imutavel.ts';

/** Limiar padrão de operações confirmadas desde o último snapshot para sugerir compactação. */
export const LIMIAR_SNAPSHOT = 40;

export type ComandoRemoto = Comando | ({ tipo: string } & Record<string, unknown>);

export interface OperacaoPendente {
  opId: string;
  comandos: Comando[];
  rotulo?: string;
}

export interface EntradaAplicada {
  rev: number;
  opId: string;
  comandos: readonly ComandoRemoto[];
  rotulo?: string;
}

export interface MensagemConstrucaoComando {
  tipo: 'construcao.comando';
  baseRev: number;
  opId: string;
  comandos: Comando[];
  rotulo?: string;
}

export interface ResultadoEdicaoLocal {
  mapaVisivel: MapaAtlas;
  mensagem: MensagemConstrucaoComando;
}

export interface SugestaoSnapshot {
  rev: number;
  mapa: MapaAtlas;
}

export interface ResultadoAplicada {
  aplicada: boolean;
  ignorada: boolean;
  precisaRessincronizar: boolean;
  eraLocal: boolean;
  mapaVisivel: MapaAtlas;
  baseRev: number;
  descartadas: readonly OperacaoPendente[];
  snapshotSugerido?: SugestaoSnapshot;
}

export interface OpcoesReconciliador {
  gerarOpId?: () => string;
  limiarSnapshot?: number;
}

export interface Reconciliador {
  readonly baseRev: number;
  readonly mapaConfirmado: MapaAtlas;
  readonly mapaVisivel: MapaAtlas;
  readonly ultimaRevSnapshot: number;
  readonly pendentes: readonly OperacaoPendente[];
  aoEditarLocal(comandos: readonly Comando[], rotulo?: string): ResultadoEdicaoLocal;
  aoReceberAplicada(entrada: EntradaAplicada): ResultadoAplicada;
  marcarSnapshotEnviado(rev: number): void;
}

const ehObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function aplicarTolerante(mapa: MapaAtlas, comandos: readonly ComandoRemoto[]): MapaAtlas {
  let atual = mapa;
  for (const cmd of comandos) {
    if (!ehObj(cmd) || typeof cmd.tipo !== 'string' || !cmd.tipo) continue;
    try {
      atual = aplicarComando(atual, cmd as Comando);
    } catch (erro) {
      if (erro instanceof ErroDeComando) continue;
      throw erro;
    }
  }
  return atual;
}

/**
 * Reconciliador determinístico puro para construção colaborativa:
 * mantém `mapaConfirmado` na revisão `baseRev` da sala e re-aplica as operações locais
 * ainda pendentes por cima para compor `mapaVisivel`, garantindo convergência idêntica
 * entre todos os clientes ao ordenar pela sequência `rev`.
 */
export function criarReconciliador(
  mapaInicial: MapaAtlas,
  revInicial = 0,
  opsIniciais: readonly EntradaAplicada[] = [],
  opcoes: OpcoesReconciliador = {},
): Reconciliador {
  const gerarOpId = opcoes.gerarOpId ?? (() => crypto.randomUUID());
  const limiarSnapshot = Math.max(1, opcoes.limiarSnapshot ?? LIMIAR_SNAPSHOT);

  let mapaConfirmado = congelar(clonar(mapaInicial));
  let baseRev = revInicial;
  const ultimaRevInicial = revInicial;
  let ultimaRevSnapshot = ultimaRevInicial;

  if (opsIniciais.length > 0) {
    const ordenadas = [...opsIniciais].sort((a, b) => a.rev - b.rev);
    for (const op of ordenadas) {
      if (!Number.isInteger(op.rev) || op.rev <= baseRev) continue;
      mapaConfirmado = aplicarTolerante(mapaConfirmado, op.comandos);
      baseRev = op.rev;
    }
  }

  let mapaVisivel = mapaConfirmado;
  let pendentes: OperacaoPendente[] = [];

  return {
    get baseRev() {
      return baseRev;
    },
    get mapaConfirmado() {
      return mapaConfirmado;
    },
    get mapaVisivel() {
      return mapaVisivel;
    },
    get ultimaRevSnapshot() {
      return ultimaRevSnapshot;
    },
    get pendentes() {
      return [...pendentes];
    },

    aoEditarLocal(comandos, rotulo) {
      if (comandos.length === 0) {
        throw new ErroDeComando('Uma operação de edição precisa de ao menos um comando.');
      }
      const cmds = clonar(comandos) as Comando[];
      let proximo = mapaVisivel;
      for (const cmd of cmds) {
        proximo = aplicarComando(proximo, cmd);
      }
      const opId = gerarOpId();
      const pendente: OperacaoPendente = rotulo !== undefined
        ? { opId, comandos: cmds, rotulo }
        : { opId, comandos: cmds };
      pendentes.push(pendente);
      mapaVisivel = proximo;
      return {
        mapaVisivel,
        mensagem: {
          tipo: 'construcao.comando',
          baseRev,
          opId,
          comandos: clonar(cmds) as Comando[],
          ...(rotulo !== undefined ? { rotulo } : {}),
        },
      };
    },

    aoReceberAplicada(entrada) {
      if (!Number.isInteger(entrada.rev) || entrada.rev <= baseRev) {
        return {
          aplicada: false,
          ignorada: true,
          precisaRessincronizar: false,
          eraLocal: false,
          mapaVisivel,
          baseRev,
          descartadas: [],
        };
      }
      if (entrada.rev > baseRev + 1) {
        return {
          aplicada: false,
          ignorada: false,
          precisaRessincronizar: true,
          eraLocal: false,
          mapaVisivel,
          baseRev,
          descartadas: [],
        };
      }

      mapaConfirmado = aplicarTolerante(mapaConfirmado, entrada.comandos);
      baseRev = entrada.rev;

      const idx = pendentes.findIndex(p => p.opId === entrada.opId);
      const eraLocal = idx !== -1;
      if (eraLocal) pendentes.splice(idx, 1);

      const sobreviventes: OperacaoPendente[] = [];
      const descartadas: OperacaoPendente[] = [];
      let proximoVisivel = mapaConfirmado;
      for (const p of pendentes) {
        let tentativa = proximoVisivel;
        let falhou = false;
        for (const cmd of p.comandos) {
          try {
            tentativa = aplicarComando(tentativa, cmd);
          } catch (erro) {
            if (erro instanceof ErroDeComando) {
              falhou = true;
              break;
            }
            throw erro;
          }
        }
        if (falhou) {
          descartadas.push(p);
        } else {
          proximoVisivel = tentativa;
          sobreviventes.push(p);
        }
      }
      pendentes = sobreviventes;
      mapaVisivel = proximoVisivel;

      const precisaSnapshot = baseRev - ultimaRevSnapshot >= limiarSnapshot;
      return {
        aplicada: true,
        ignorada: false,
        precisaRessincronizar: false,
        eraLocal,
        mapaVisivel,
        baseRev,
        descartadas,
        ...(precisaSnapshot ? { snapshotSugerido: { rev: baseRev, mapa: mapaConfirmado } } : {}),
      };
    },

    marcarSnapshotEnviado(rev) {
      if (Number.isInteger(rev) && rev > ultimaRevSnapshot && rev <= baseRev) {
        ultimaRevSnapshot = rev;
      }
    },
  };
}
